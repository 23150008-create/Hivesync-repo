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

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
    respond(false, "No remittance information was received.", [], 422);
}

$vendorId = filter_var(
    $data["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

$payableIds = array_values(array_unique(array_filter(
    array_map("intval", $data["payable_ids"] ?? [])
)));

$paymentMethod = trim($data["payment_method"] ?? "");
$referenceNumber = trim($data["reference_number"] ?? "");
$preparedBy = trim($data["prepared_by"] ?? "");
$approvedBy = trim($data["approved_by"] ?? "");
$releaseDate = trim($data["release_date"] ?? "");
$remarks = trim($data["remarks"] ?? "");

$silent = filter_var(
    $data["silent"] ?? false,
    FILTER_VALIDATE_BOOLEAN
);

if (!$vendorId) {
    respond(false, "A valid supplier ID is required.", [], 422);
}

if (empty($payableIds)) {
    respond(false, "Select at least one supplier payable.", [], 422);
}

if ($preparedBy === "") {
    respond(false, "Prepared by is required.", [], 422);
}

if (
    $releaseDate !== "" &&
    $paymentMethod === ""
) {
    respond(
        false,
        "Payment method is required when a release/payment date is provided.",
        [],
        422
    );
}

if (
    $releaseDate !== "" &&
    !preg_match("/^\d{4}-\d{2}-\d{2}$/", $releaseDate)
) {
    respond(false, "A valid release/payment date is required.", [], 422);
}

if (
    $releaseDate !== "" &&
    $releaseDate > date("Y-m-d")
) {
    respond(false, "Release/payment date cannot be in the future.", [], 422);
}

$requiredTables = [
    "tbl_remittance_order",
    "tbl_remittance_order_items",
    "tbl_supplier_payable"
];

foreach ($requiredTables as $tableName) {
    if (!tableExists($conn, $tableName)) {
        respond(
            false,
            "Supplier remittance configuration is incomplete. Missing table: {$tableName}.",
            [],
            500
        );
    }
}

try {
    $conn->beginTransaction();

    $placeholders = [];
    $params = [
        ":vendor_id" => $vendorId
    ];

    foreach ($payableIds as $index => $payableId) {
        $key = ":payable_id_" . $index;
        $placeholders[] = $key;
        $params[$key] = $payableId;
    }

    $payablesStmt = $conn->prepare("
        SELECT
            sp.payable_id,
            sp.delivery_id,
            sp.balance_amount,
            sp.payment_status,
            d.delivery_order_no
        FROM tbl_supplier_payable sp
        LEFT JOIN tbl_delivery d
            ON d.delivery_id = sp.delivery_id
        WHERE sp.vendor_id = :vendor_id
        AND sp.payable_id IN (" . implode(",", $placeholders) . ")
        AND sp.balance_amount > 0
        FOR UPDATE
    ");

    $payablesStmt->execute($params);
    $payables = $payablesStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($payables) !== count($payableIds)) {
        throw new Exception(
            "One or more selected payables are unavailable or already fully paid."
        );
    }

    $totalAmount = 0;

    foreach ($payables as $payable) {
        $totalAmount += (float)$payable["balance_amount"];
    }

    if ($totalAmount <= 0) {
        throw new Exception("The remittance total must be greater than zero.");
    }

    

    $normalizedRequestedPayableIds = $payableIds;

    sort(
        $normalizedRequestedPayableIds,
        SORT_NUMERIC
    );

    $existingOrderStmt = $conn->prepare("
        SELECT
            ro.remittance_order_id,
            ro.remittance_order_no,
            ro.total_amount,
            ro.status

        FROM tbl_remittance_order ro

        WHERE ro.vendor_id = :vendor_id

        AND ro.status IN (
            'Draft',
            'Ready for Payment',
            'Released',
            'Partially Paid'
        )

        ORDER BY
            ro.remittance_order_id DESC

        FOR UPDATE
    ");

    $existingOrderStmt->execute([
        ":vendor_id" => $vendorId
    ]);

    $activeRemittanceOrders =
        $existingOrderStmt->fetchAll(
            PDO::FETCH_ASSOC
        );

    $existingOrder = null;

    foreach (
        $activeRemittanceOrders as
        $candidateOrder
    ) {
        $candidateOrderId =
            (int)$candidateOrder[
                "remittance_order_id"
            ];

        $candidateItemsStmt =
            $conn->prepare("
                SELECT
                    payable_id

                FROM tbl_remittance_order_items

                WHERE remittance_order_id =
                    :remittance_order_id

                AND payable_id IS NOT NULL

                ORDER BY payable_id ASC
            ");

        $candidateItemsStmt->execute([
            ":remittance_order_id" =>
                $candidateOrderId
        ]);

        $candidatePayableIds =
            array_map(
                "intval",
                $candidateItemsStmt->fetchAll(
                    PDO::FETCH_COLUMN
                )
            );

        $candidatePayableIds =
            array_values(
                array_unique(
                    $candidatePayableIds
                )
            );

        sort(
            $candidatePayableIds,
            SORT_NUMERIC
        );

        if (
            $candidatePayableIds ===
            $normalizedRequestedPayableIds
        ) {
            $existingOrder =
                $candidateOrder;

            break;
        }
    }

    if ($existingOrder) {
        $conn->commit();

        respond(
            true,
            "Existing remittance order reused.",
            [
                "remittance_order_id" =>
                    (int)$existingOrder[
                        "remittance_order_id"
                    ],

                "remittance_order_no" =>
                    $existingOrder[
                        "remittance_order_no"
                    ],

                "total_amount" =>
                    (float)$existingOrder[
                        "total_amount"
                    ],

                "status" =>
                    $existingOrder[
                        "status"
                    ],

                "reused" => true,
                "silent" => $silent,
                "supplier_recipients" => 0,
                "notification_sent" => false,
                "notifications_sent" => 0,
                "email_sent" => false,
                "emails_sent" => 0,
                "communication_error" => null
            ]
        );
    }

    $remittanceNo = generateDocumentNo(
        $conn,
        "tbl_remittance_order",
        "remittance_order_no",
        "REM"
    );

    $status = $releaseDate !== ""
        ? "Ready for Payment"
        : "Draft";

    $orderStmt = $conn->prepare("
        INSERT INTO tbl_remittance_order
        (
            remittance_order_no,
            vendor_id,
            total_amount,
            payment_method,
            reference_number,
            prepared_by,
            approved_by,
            release_date,
            status,
            remarks,
            created_at,
            updated_at
        )
        VALUES
        (
            :remittance_order_no,
            :vendor_id,
            :total_amount,
            :payment_method,
            :reference_number,
            :prepared_by,
            :approved_by,
            :release_date,
            :status,
            :remarks,
            NOW(),
            NOW()
        )
    ");

    $orderStmt->execute([
        ":remittance_order_no" => $remittanceNo,
        ":vendor_id" => $vendorId,
        ":total_amount" => $totalAmount,
        ":payment_method" =>
            $paymentMethod !== "" ? $paymentMethod : null,
        ":reference_number" =>
            $referenceNumber !== "" ? $referenceNumber : null,
        ":prepared_by" => $preparedBy,
        ":approved_by" =>
            $approvedBy !== "" ? $approvedBy : null,
        ":release_date" =>
            $releaseDate !== "" ? $releaseDate : null,
        ":status" => $status,
        ":remarks" => $remarks !== "" ? $remarks : null
    ]);

    $remittanceOrderId = (int)$conn->lastInsertId();

    $hasItemId = columnExists(
        $conn,
        "tbl_remittance_order_items",
        "remittance_order_item_id"
    );

    $hasPayableId = columnExists(
        $conn,
        "tbl_remittance_order_items",
        "payable_id"
    );

    $hasDeliveryId = columnExists(
        $conn,
        "tbl_remittance_order_items",
        "delivery_id"
    );

    $amountColumn = null;

    foreach (["amount", "payable_amount", "remittance_amount"] as $candidate) {
        if (columnExists(
            $conn,
            "tbl_remittance_order_items",
            $candidate
        )) {
            $amountColumn = $candidate;
            break;
        }
    }

    if (!$hasPayableId && !$hasDeliveryId) {
        throw new Exception(
            "Remittance order items must contain payable_id or delivery_id."
        );
    }

    foreach ($payables as $payable) {
        $columns = ["remittance_order_id"];
        $values = [":remittance_order_id"];
        $itemParams = [
            ":remittance_order_id" => $remittanceOrderId
        ];

        if ($hasPayableId) {
            $columns[] = "payable_id";
            $values[] = ":payable_id";
            $itemParams[":payable_id"] =
                (int)$payable["payable_id"];
        }

        if ($hasDeliveryId) {
            $columns[] = "delivery_id";
            $values[] = ":delivery_id";
            $itemParams[":delivery_id"] =
                (int)$payable["delivery_id"];
        }

        if ($amountColumn) {
            $columns[] = $amountColumn;
            $values[] = ":item_amount";
            $itemParams[":item_amount"] =
                (float)$payable["balance_amount"];
        }

        if (columnExists(
            $conn,
            "tbl_remittance_order_items",
            "created_at"
        )) {
            $columns[] = "created_at";
            $values[] = "NOW()";
        }

        $itemStmt = $conn->prepare("
            INSERT INTO tbl_remittance_order_items
            (" . implode(", ", $columns) . ")
            VALUES
            (" . implode(", ", $values) . ")
        ");

        $itemStmt->execute($itemParams);
    }

    $newPayableStatus =
        $status === "Ready for Payment"
            ? "Ready for Payment"
            : "Unpaid";

    $updatePayables = $conn->prepare("
        UPDATE tbl_supplier_payable
        SET
            payment_status = :payment_status,
            updated_at = NOW()
        WHERE vendor_id = :vendor_id
        AND payable_id IN (" . implode(",", $placeholders) . ")
    ");

    $updateParams = $params;
    $updateParams[":payment_status"] = $newPayableStatus;
    $updatePayables->execute($updateParams);

    $title =
        $status === "Ready for Payment"
            ? "Supplier Payment Available"
            : "Remittance Order Drafted";

    $message =
        $remittanceNo .
        " was created for ₱" .
        number_format($totalAmount, 2) .
        ". Status: " .
        $status .
        ".";

    

    $conn->commit();

    $supplierCommunication = [
        "recipients" => 0,
        "notifications_sent" => 0,
        "emails_sent" => 0,
        "notification_sent" => false,
        "email_sent" => false
    ];

    $communicationError = null;

    if (!$silent) {
        try {
            $supplierCommunication =
                notifySupplier(
                    $conn,
                    $vendorId,
                    $title,
                    $message,
                    "Remittance",
                    $remittanceOrderId,
                    $remittanceNo,
                    "supplier_remittances",
                    "Remittance: " .
                        $remittanceNo .
                        "\nTotal amount: ₱" .
                        number_format(
                            $totalAmount,
                            2
                        ) .
                        "\nPayment method: " .
                        (
                            $paymentMethod !== ""
                                ? $paymentMethod
                                : "To be confirmed"
                        ) .
                        "\nRelease date: " .
                        (
                            $releaseDate !== ""
                                ? $releaseDate
                                : "To be confirmed"
                        ) .
                        "\nPrepared by: " .
                        $preparedBy .
                        "\nApproved by: " .
                        (
                            $approvedBy !== ""
                                ? $approvedBy
                                : $preparedBy
                        ) .
                        "\nStatus: " .
                        $status .
                        "\nRemarks: " .
                        (
                            $remarks !== ""
                                ? $remarks
                                : "None"
                        )
                );
        } catch (Throwable $communicationException) {
            $communicationError =
                $communicationException->getMessage();

            error_log(
                "create_remittance_order.php supplier communication: " .
                $communicationError
            );
        }
    }

    respond(
        true,
        "Remittance order created successfully.",
        [
            "remittance_order_id" =>
                $remittanceOrderId,
            "remittance_order_no" =>
                $remittanceNo,
            "total_amount" =>
                $totalAmount,
            "status" =>
                $status,
            "silent" =>
                $silent,

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

            "communication_error" =>
                $communicationError
        ]
    );
} catch (Throwable $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "create_remittance_order.php: " .
        $e->getMessage()
    );

    respond(
        false,
        $e instanceof PDOException ? "Unable to create the remittance order." : ($e->getMessage() ?: "Unable to create the remittance order."),
        [],
        500
    );
}