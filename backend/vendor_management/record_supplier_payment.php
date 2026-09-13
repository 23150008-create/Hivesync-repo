<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");
require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("vendors");
requireAnyRole(["Admin", "Staff"]);
require_once("../helpers/supplier_communication.php");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Invalid request method."
    ]);
    exit;
}

requireCsrfToken();

function respond(
    bool $success,
    string $message,
    array $extra = [],
    int $statusCode = 200
): void {
    http_response_code($statusCode);

    echo json_encode(array_merge([
        "success" => $success,
        "message" => $message
    ], $extra));

    exit;
}

function tableExists(PDO $conn, string $tableName): bool
{
    
    static $cache = [];

    $cacheKey = strtolower(trim($tableName));

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
    ");

    $stmt->execute([
        ":table_name" => $tableName
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function columnExists(
    PDO $conn,
    string $tableName,
    string $columnName
): bool {
    
    static $cache = [];

    $cacheKey =
        strtolower(trim($tableName)) .
        "." .
        strtolower(trim($columnName));

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
        AND column_name = :column_name
    ");

    $stmt->execute([
        ":table_name" => $tableName,
        ":column_name" => $columnName
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function generateDocumentNo(
    PDO $conn,
    string $table,
    string $column,
    string $prefix
): string {
    $yearPrefix = $prefix . "-" . date("Y") . "-";

    $stmt = $conn->prepare("
        SELECT `{$column}`
        FROM `{$table}`
        WHERE `{$column}` LIKE :pattern
        ORDER BY 1 DESC
        LIMIT 1
    ");

    $stmt->execute([
        ":pattern" => $yearPrefix . "%"
    ]);

    $lastNumber = $stmt->fetchColumn();
    $nextNumber = 1;

    if (
        $lastNumber &&
        preg_match("/(\d+)$/", $lastNumber, $matches)
    ) {
        $nextNumber = (int)$matches[1] + 1;
    }

    return $yearPrefix .
        str_pad((string)$nextNumber, 5, "0", STR_PAD_LEFT);
}

function getExistingSupplierPaymentByToken(
    PDO $conn,
    string $requestToken
): ?array {
    if (
        $requestToken === "" ||
        !columnExists(
            $conn,
            "tbl_supplier_payment",
            "request_token"
        )
    ) {
        return null;
    }

    $stmt = $conn->prepare("
        SELECT
            sp.supplier_payment_id,
            sp.payment_no,
            sp.request_token,
            sp.remittance_order_id,
            sp.vendor_id,
            sp.amount_paid,
            sp.payment_date,
            sp.payment_method,
            sp.reference_number,
            sp.received_by,
            sp.processed_by,
            sp.remarks,
            sp.created_at,

            ro.remittance_order_no,
            ro.total_amount,
            ro.status

        FROM tbl_supplier_payment sp

        INNER JOIN tbl_remittance_order ro
            ON ro.remittance_order_id =
               sp.remittance_order_id

        WHERE sp.request_token =
            :request_token

        LIMIT 1
    ");

    $stmt->execute([
        ":request_token" => $requestToken
    ]);

    $payment =
        $stmt->fetch(PDO::FETCH_ASSOC);

    return $payment ?: null;
}

function buildExistingSupplierPaymentResponse(
    PDO $conn,
    array $payment
): array {
    $remittanceOrderId =
        (int)(
            $payment[
                "remittance_order_id"
            ] ?? 0
        );

    $totalAmount = round(
        (float)(
            $payment["total_amount"] ??
            0
        ),
        2
    );

    $totalPaidStmt = $conn->prepare("
        SELECT COALESCE(
            SUM(amount_paid),
            0
        )
        FROM tbl_supplier_payment
        WHERE remittance_order_id =
            :remittance_order_id
    ");

    $totalPaidStmt->execute([
        ":remittance_order_id" =>
            $remittanceOrderId
    ]);

    $totalPaid = round(
        (float)$totalPaidStmt->fetchColumn(),
        2
    );

    $remainingBalance = round(
        max(
            0,
            $totalAmount - $totalPaid
        ),
        2
    );

    $deliveryNumbers = [];

    if (
        $remittanceOrderId > 0 &&
        tableExists(
            $conn,
            "tbl_remittance_order_items"
        )
    ) {
        $itemsStmt = $conn->prepare("
            SELECT delivery_order_no
            FROM tbl_remittance_order_items
            WHERE remittance_order_id =
                :remittance_order_id
        ");

        $itemsStmt->execute([
            ":remittance_order_id" =>
                $remittanceOrderId
        ]);

        foreach (
            $itemsStmt->fetchAll(
                PDO::FETCH_ASSOC
            ) as $item
        ) {
            $deliveryNo = trim(
                (string)(
                    $item[
                        "delivery_order_no"
                    ] ??
                    ""
                )
            );

            if ($deliveryNo !== "") {
                $deliveryNumbers[] =
                    $deliveryNo;
            }
        }

        $deliveryNumbers =
            array_values(
                array_unique(
                    $deliveryNumbers
                )
            );
    }

    return [
        "supplier_payment_id" =>
            (int)(
                $payment[
                    "supplier_payment_id"
                ] ?? 0
            ),
        "payment_no" =>
            (string)(
                $payment[
                    "payment_no"
                ] ?? ""
            ),
        "remittance_order_id" =>
            $remittanceOrderId,
        "remittance_order_no" =>
            (string)(
                $payment[
                    "remittance_order_no"
                ] ?? ""
            ),
        "amount_paid" =>
            round(
                (float)(
                    $payment[
                        "amount_paid"
                    ] ?? 0
                ),
                2
            ),
        "total_amount" =>
            $totalAmount,
        "remaining_balance" =>
            $remainingBalance,
        "status" =>
            (string)(
                $payment["status"] ??
                (
                    $remainingBalance <= 0
                        ? "Paid"
                        : "Partially Paid"
                )
            ),
        "payment_method" =>
            (string)(
                $payment[
                    "payment_method"
                ] ?? ""
            ),
        "payment_date" =>
            (string)(
                $payment[
                    "payment_date"
                ] ?? ""
            ),
        "processed_by" =>
            (string)(
                $payment[
                    "processed_by"
                ] ?? ""
            ),
        "delivery_order_nos" =>
            $deliveryNumbers,

        
        "supplier_recipients" => 0,
        "notification_sent" => false,
        "notifications_sent" => 0,
        "email_sent" => false,
        "emails_sent" => 0,
        "communication_error" => null,

        "duplicate_request" =>
            true,
        "request_token" =>
            (string)(
                $payment[
                    "request_token"
                ] ?? ""
            )
    ];
}

function acquireSupplierPaymentRequestLock(
    PDO $conn,
    string $requestToken
): ?string {
    if ($requestToken === "") {
        return null;
    }

    $lockName =
        "hspay_" .
        substr(
            hash(
                "sha256",
                $requestToken
            ),
            0,
            58
        );

    $stmt = $conn->prepare("
        SELECT GET_LOCK(
            :lock_name,
            20
        )
    ");

    $stmt->execute([
        ":lock_name" => $lockName
    ]);

    if (
        (int)$stmt->fetchColumn() !== 1
    ) {
        throw new RuntimeException(
            "This supplier payment is still being processed. Please wait a moment and try again."
        );
    }

    return $lockName;
}

function releaseSupplierPaymentRequestLock(
    PDO $conn,
    ?string $lockName
): void {
    if (!$lockName) {
        return;
    }

    try {
        $stmt = $conn->prepare("
            SELECT RELEASE_LOCK(
                :lock_name
            )
        ");

        $stmt->execute([
            ":lock_name" => $lockName
        ]);
    } catch (Throwable $error) {
        error_log(
            "Unable to release supplier payment request lock: " .
            $error->getMessage()
        );
    }
}

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
    respond(false, "No supplier payment information was received.", [], 422);
}

$remittanceOrderId = filter_var(
    $data["remittance_order_id"] ?? null,
    FILTER_VALIDATE_INT
);

$amountPaid = (float)($data["amount_paid"] ?? 0);
$paymentDate = trim($data["payment_date"] ?? date("Y-m-d"));
$paymentMethod = trim($data["payment_method"] ?? "");
$referenceNumber = trim($data["reference_number"] ?? "");
$receivedBy = trim($data["received_by"] ?? "");
$processedBy = trim($data["processed_by"] ?? "");
$remarks = trim($data["remarks"] ?? "");

$requestToken = trim(
    (string)(
        $data["request_token"] ??
        ""
    )
);

if (
    $requestToken !== "" &&
    (
        strlen($requestToken) < 16 ||
        strlen($requestToken) > 64 ||
        !preg_match(
            '/^[A-Za-z0-9._:-]+$/',
            $requestToken
        )
    )
) {
    respond(
        false,
        "The supplier payment request token is invalid.",
        [],
        422
    );
}

if (!$remittanceOrderId) {
    respond(false, "A valid remittance order is required.", [], 422);
}

if ($amountPaid <= 0) {
    respond(false, "Payment amount must be greater than zero.", [], 422);
}

if (
    !preg_match("/^\\d{4}-\\d{2}-\\d{2}$/", $paymentDate)
) {
    respond(false, "A valid payment date is required.", [], 422);
}

if ($paymentDate > date("Y-m-d")) {
    respond(false, "Payment date cannot be in the future.", [], 422);
}

if ($paymentMethod === "") {
    respond(false, "Payment method is required.", [], 422);
}

if ($processedBy === "") {
    respond(false, "Processed by is required.", [], 422);
}

$supplierPaymentLockName = null;

try {
    
    if ($requestToken !== "") {
        $supplierPaymentLockName =
            acquireSupplierPaymentRequestLock(
                $conn,
                $requestToken
            );

        $existingPayment =
            getExistingSupplierPaymentByToken(
                $conn,
                $requestToken
            );

        if ($existingPayment) {
            if (
                (int)(
                    $existingPayment[
                        "remittance_order_id"
                    ] ?? 0
                ) !==
                (int)$remittanceOrderId
            ) {
                releaseSupplierPaymentRequestLock(
                    $conn,
                    $supplierPaymentLockName
                );

                $supplierPaymentLockName = null;

                respond(
                    false,
                    "This supplier payment request token has already been used.",
                    [],
                    409
                );
            }

            $existingResponse =
                buildExistingSupplierPaymentResponse(
                    $conn,
                    $existingPayment
                );

            releaseSupplierPaymentRequestLock(
                $conn,
                $supplierPaymentLockName
            );

            $supplierPaymentLockName = null;

            respond(
                true,
                "Supplier payment already recorded. Existing payment returned.",
                $existingResponse
            );
        }
    }

    $conn->beginTransaction();

    $orderStmt = $conn->prepare("
        SELECT
            remittance_order_id,
            remittance_order_no,
            vendor_id,
            total_amount,
            status
        FROM tbl_remittance_order
        WHERE remittance_order_id = :remittance_order_id
        FOR UPDATE
    ");

    $orderStmt->execute([
        ":remittance_order_id" => $remittanceOrderId
    ]);

    $order = $orderStmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        throw new Exception("Remittance order was not found.");
    }

    $existingPaidStmt = $conn->prepare("
        SELECT COALESCE(SUM(amount_paid), 0)
        FROM tbl_supplier_payment
        WHERE remittance_order_id = :remittance_order_id
    ");

    $existingPaidStmt->execute([
        ":remittance_order_id" => $remittanceOrderId
    ]);

    $existingPaid = (float)$existingPaidStmt->fetchColumn();
    $remaining = max(
        0,
        (float)$order["total_amount"] - $existingPaid
    );

    if ($remaining <= 0) {
        throw new Exception("This remittance order is already fully paid.");
    }

    if ($amountPaid > $remaining) {
        throw new Exception(
            "Payment amount cannot exceed the remaining remittance balance of ₱" .
            number_format($remaining, 2) .
            "."
        );
    }

    $paymentNo = generateDocumentNo(
        $conn,
        "tbl_supplier_payment",
        "payment_no",
        "PAY"
    );

    $paymentColumns = [
        "payment_no",
        "remittance_order_id",
        "vendor_id",
        "amount_paid",
        "payment_date",
        "payment_method",
        "reference_number",
        "received_by",
        "processed_by",
        "remarks",
        "created_at"
    ];

    $paymentValues = [
        ":payment_no",
        ":remittance_order_id",
        ":vendor_id",
        ":amount_paid",
        ":payment_date",
        ":payment_method",
        ":reference_number",
        ":received_by",
        ":processed_by",
        ":remarks",
        "NOW()"
    ];

    $paymentParams = [
        ":payment_no" =>
            $paymentNo,
        ":remittance_order_id" =>
            $remittanceOrderId,
        ":vendor_id" =>
            (int)$order["vendor_id"],
        ":amount_paid" =>
            $amountPaid,
        ":payment_date" =>
            $paymentDate,
        ":payment_method" =>
            $paymentMethod,
        ":reference_number" =>
            $referenceNumber !== ""
                ? $referenceNumber
                : null,
        ":received_by" =>
            $receivedBy !== ""
                ? $receivedBy
                : null,
        ":processed_by" =>
            $processedBy,
        ":remarks" =>
            $remarks !== ""
                ? $remarks
                : null
    ];

    if (
        $requestToken !== "" &&
        columnExists(
            $conn,
            "tbl_supplier_payment",
            "request_token"
        )
    ) {
        $paymentColumns[] =
            "request_token";

        $paymentValues[] =
            ":request_token";

        $paymentParams[
            ":request_token"
        ] = $requestToken;
    }

    $paymentStmt = $conn->prepare("
        INSERT INTO tbl_supplier_payment
        (
            " .
            implode(
                ", ",
                $paymentColumns
            ) .
        ")
        VALUES
        (
            " .
            implode(
                ", ",
                $paymentValues
            ) .
        ")
    ");

    $paymentStmt->execute(
        $paymentParams
    );

    $paymentId = (int)$conn->lastInsertId();

    $itemsStmt = $conn->prepare("
        SELECT *
        FROM tbl_remittance_order_items
        WHERE remittance_order_id = :remittance_order_id
        ORDER BY 1 ASC
    ");

    $itemsStmt->execute([
        ":remittance_order_id" => $remittanceOrderId
    ]);

    $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

    $deliveryNumbers = [];

    foreach ($items as $remittanceItem) {
        if (
            !empty($remittanceItem["delivery_order_no"])
        ) {
            $deliveryNumbers[] =
                trim(
                    (string)$remittanceItem[
                        "delivery_order_no"
                    ]
                );
        }
    }

    $deliveryNumbers = array_values(
        array_unique(
            array_filter($deliveryNumbers)
        )
    );

    if (empty($items)) {
        throw new Exception(
            "The remittance order has no linked supplier payable records."
        );
    }

    $remainingPayment = $amountPaid;

    foreach ($items as $item) {
        $payableId = isset($item["payable_id"])
            ? (int)$item["payable_id"]
            : 0;

        if (!$payableId && isset($item["delivery_id"])) {
            $payableLookup = $conn->prepare("
                SELECT payable_id
                FROM tbl_supplier_payable
                WHERE vendor_id = :vendor_id
                AND delivery_id = :delivery_id
                LIMIT 1
            ");

            $payableLookup->execute([
                ":vendor_id" => (int)$order["vendor_id"],
                ":delivery_id" => (int)$item["delivery_id"]
            ]);

            $payableId = (int)$payableLookup->fetchColumn();
        }

        if (!$payableId || $remainingPayment <= 0) {
            continue;
        }

        $payableStmt = $conn->prepare("
            SELECT
                payable_amount,
                paid_amount,
                balance_amount
            FROM tbl_supplier_payable
            WHERE payable_id = :payable_id
            FOR UPDATE
        ");

        $payableStmt->execute([
            ":payable_id" => $payableId
        ]);

        $payable = $payableStmt->fetch(PDO::FETCH_ASSOC);

        if (!$payable) {
            continue;
        }

        $payableBalance =
            (float)$payable["balance_amount"];

        $allocated = min(
            $remainingPayment,
            $payableBalance
        );

        $newPaid =
            (float)$payable["paid_amount"] +
            $allocated;

        $newBalance = max(
            0,
            (float)$payable["payable_amount"] -
            $newPaid
        );

        $paymentStatus = $newBalance <= 0
            ? "Paid"
            : "Partially Paid";

        $updatePayable = $conn->prepare("
            UPDATE tbl_supplier_payable
            SET
                paid_amount = :paid_amount,
                balance_amount = :balance_amount,
                payment_status = :payment_status,
                updated_at = NOW()
            WHERE payable_id = :payable_id
        ");

        $updatePayable->execute([
            ":paid_amount" => $newPaid,
            ":balance_amount" => $newBalance,
            ":payment_status" => $paymentStatus,
            ":payable_id" => $payableId
        ]);

        $remainingPayment -= $allocated;
    }

    $newTotalPaid = $existingPaid + $amountPaid;
    $newRemaining = max(
        0,
        (float)$order["total_amount"] - $newTotalPaid
    );

    $orderStatus = $newRemaining <= 0
        ? "Paid"
        : "Partially Paid";

    $updateOrder = $conn->prepare("
        UPDATE tbl_remittance_order
        SET
            status = :status,
            payment_method = :payment_method,
            reference_number = :reference_number,
            release_date = COALESCE(release_date, :payment_date),
            updated_at = NOW()
        WHERE remittance_order_id = :remittance_order_id
    ");

    $updateOrder->execute([
        ":status" => $orderStatus,
        ":payment_method" => $paymentMethod,
        ":reference_number" =>
            $referenceNumber !== "" ? $referenceNumber : null,
        ":payment_date" => $paymentDate,
        ":remittance_order_id" => $remittanceOrderId
    ]);

    

    $conn->commit();

    releaseSupplierPaymentRequestLock(
        $conn,
        $supplierPaymentLockName
    );

    $supplierPaymentLockName = null;

    $title =
        $newRemaining <= 0
            ? "Supplier Payment Completed"
            : "Supplier Partial Payment Received";

    $message =
        "BFATC recorded payment " .
        $paymentNo .
        " amounting to ₱" .
        number_format($amountPaid, 2) .
        " for remittance " .
        $order["remittance_order_no"] .
        ". Remaining balance: ₱" .
        number_format($newRemaining, 2) .
        ". Status: " .
        $orderStatus .
        ".";

    $deliveryText =
        !empty($deliveryNumbers)
            ? implode(", ", $deliveryNumbers)
            : "See remittance receipt";

    $details =
        "Payment No.: " .
        $paymentNo .
        "\nRemittance: " .
        $order["remittance_order_no"] .
        "\nDelivery: " .
        $deliveryText .
        "\nAmount paid: ₱" .
        number_format($amountPaid, 2) .
        "\nTotal remittance: ₱" .
        number_format(
            (float)$order["total_amount"],
            2
        ) .
        "\nRemaining balance: ₱" .
        number_format($newRemaining, 2) .
        "\nPayment method: " .
        $paymentMethod .
        "\nPayment date: " .
        $paymentDate .
        "\nReference: " .
        (
            $referenceNumber !== ""
                ? $referenceNumber
                : "N/A"
        ) .
        "\nReceived by: " .
        (
            $receivedBy !== ""
                ? $receivedBy
                : "Not provided"
        ) .
        "\nProcessed by: " .
        $processedBy .
        "\nStatus: " .
        $orderStatus;

    if ($remarks !== "") {
        $details .=
            "\nRemarks: " .
            $remarks;
    }

    $supplierCommunication = [
        "recipients" => 0,
        "notifications_sent" => 0,
        "emails_sent" => 0,
        "notification_sent" => false,
        "email_sent" => false
    ];

    $communicationError = null;

    try {
        $supplierCommunication =
            notifySupplier(
                $conn,
                (int)$order["vendor_id"],
                $title,
                $message,
                "Payment",
                $paymentId,
                $paymentNo,
                "supplier_payments",
                $details
            );
    } catch (Throwable $communicationException) {
        $communicationError =
            $communicationException->getMessage();

        error_log(
            "record_supplier_payment.php supplier communication: " .
            $communicationError
        );
    }

    respond(
        true,
        "Supplier payment recorded successfully.",
        [
            "supplier_payment_id" =>
                $paymentId,
            "payment_no" =>
                $paymentNo,
            "remittance_order_id" =>
                $remittanceOrderId,
            "remittance_order_no" =>
                $order["remittance_order_no"],
            "amount_paid" =>
                round($amountPaid, 2),
            "total_amount" =>
                round(
                    (float)$order["total_amount"],
                    2
                ),
            "remaining_balance" =>
                round($newRemaining, 2),
            "status" =>
                $orderStatus,
            "payment_method" =>
                $paymentMethod,
            "payment_date" =>
                $paymentDate,
            "processed_by" =>
                $processedBy,
            "delivery_order_nos" =>
                $deliveryNumbers,

            "supplier_recipients" =>
                (int)(
                    $supplierCommunication[
                        "recipients"
                    ] ?? 0
                ),

            "notification_sent" =>
                (bool)(
                    $supplierCommunication[
                        "notification_sent"
                    ] ?? false
                ),

            "notifications_sent" =>
                (int)(
                    $supplierCommunication[
                        "notifications_sent"
                    ] ?? 0
                ),

            "email_sent" =>
                (bool)(
                    $supplierCommunication[
                        "email_sent"
                    ] ?? false
                ),

            "emails_sent" =>
                (int)(
                    $supplierCommunication[
                        "emails_sent"
                    ] ?? 0
                ),

            "duplicate_request" =>
                false,
            "request_token" =>
                $requestToken !== ""
                    ? $requestToken
                    : null,

            "communication_error" =>
                $communicationError
        ]
    );
} catch (Throwable $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    releaseSupplierPaymentRequestLock(
        $conn,
        $supplierPaymentLockName
    );

    $supplierPaymentLockName = null;

    error_log(
        "record_supplier_payment.php: " .
        $e->getMessage()
    );

    respond(
        false,
        $e instanceof PDOException ? "Unable to record the supplier payment." : ($e->getMessage() ?: "Unable to record the supplier payment."),
        [],
        500
    );
}