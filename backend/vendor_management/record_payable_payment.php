<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("vendors");
requireAnyRole(["Admin", "Staff"]);

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

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "message" => $message
            ],
            $extra
        ),
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );

    exit;
}

function tableExists(
    PDO $conn,
    string $tableName
): bool {
    
    static $tableExistsCache = [];

    $cacheKey = strtolower($tableName);

    if (array_key_exists($cacheKey, $tableExistsCache)) {
        return $tableExistsCache[$cacheKey];
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

    $exists = (int)$stmt->fetchColumn() > 0;
    $tableExistsCache[$cacheKey] = $exists;

    return $exists;
}

function columnExists(
    PDO $conn,
    string $tableName,
    string $columnName
): bool {
    
    static $columnExistsCache = [];

    $cacheKey =
        strtolower($tableName) .
        "." .
        strtolower($columnName);

    if (array_key_exists($cacheKey, $columnExistsCache)) {
        return $columnExistsCache[$cacheKey];
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

    $exists = (int)$stmt->fetchColumn() > 0;
    $columnExistsCache[$cacheKey] = $exists;

    return $exists;
}

function generateDocumentNo(
    PDO $conn,
    string $table,
    string $column,
    string $prefix
): string {
    $yearPrefix =
        $prefix . "-" . date("Y") . "-";

    $stmt = $conn->prepare("
        SELECT `{$column}`
        FROM `{$table}`
        WHERE `{$column}` LIKE :pattern
        ORDER BY 1 DESC
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":pattern" => $yearPrefix . "%"
    ]);

    $lastNumber = $stmt->fetchColumn();
    $nextNumber = 1;

    if (
        $lastNumber &&
        preg_match(
            "/(\d+)$/",
            (string)$lastNumber,
            $matches
        )
    ) {
        $nextNumber =
            ((int)$matches[1]) + 1;
    }

    return $yearPrefix .
        str_pad(
            (string)$nextNumber,
            5,
            "0",
            STR_PAD_LEFT
        );
}

function insertAuditLog(
    PDO $conn,
    ?int $userId,
    string $userName,
    string $details
): void {
    if (!tableExists($conn, "tbl_audit_trail")) {
        return;
    }

    $columns = [];
    $values = [];
    $params = [];

    $data = [
        "user_id" => $userId,
        "user_name" => $userName,
        "module" => "Supplier Management",
        "action" => "Record Supplier Payment",
        "details" => $details
    ];

    foreach ($data as $column => $value) {
        if (
            !columnExists(
                $conn,
                "tbl_audit_trail",
                $column
            )
        ) {
            continue;
        }

        $placeholder =
            ":audit_" . $column;

        $columns[] = "`{$column}`";
        $values[] = $placeholder;
        $params[$placeholder] = $value;
    }

    if (
        columnExists(
            $conn,
            "tbl_audit_trail",
            "created_at"
        )
    ) {
        $columns[] = "`created_at`";
        $values[] = "NOW()";
    }

    if (!$columns) {
        return;
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_audit_trail
        (" . implode(", ", $columns) . ")
        VALUES
        (" . implode(", ", $values) . ")
    ");

    $stmt->execute($params);
}

function getSupplierUserIds(
    PDO $conn,
    int $vendorId
): array {
    if (
        !tableExists($conn, "tbl_user") ||
        !columnExists(
            $conn,
            "tbl_user",
            "vendor_id"
        )
    ) {
        return [];
    }

    $statusFilter =
        columnExists(
            $conn,
            "tbl_user",
            "status"
        )
            ? "
                AND COALESCE(
                    status,
                    'Active'
                ) = 'Active'
              "
            : "";

    $stmt = $conn->prepare("
        SELECT user_id
        FROM tbl_user
        WHERE vendor_id = :vendor_id
        AND role IN ('Supplier', 'Vendor')
        {$statusFilter}
        ORDER BY user_id ASC
    ");

    $stmt->execute([
        ":vendor_id" => $vendorId
    ]);

    return array_map(
        "intval",
        $stmt->fetchAll(PDO::FETCH_COLUMN)
    );
}

function getSupplierEmailRecipient(
    PDO $conn,
    int $vendorId
): ?array {
    if (
        !tableExists($conn, "tbl_user") ||
        !columnExists($conn, "tbl_user", "vendor_id") ||
        !columnExists($conn, "tbl_user", "email")
    ) {
        return null;
    }

    $nameColumn =
        columnExists($conn, "tbl_user", "full_name")
            ? "full_name"
            : (
                columnExists($conn, "tbl_user", "username")
                    ? "username"
                    : "email"
            );

    $statusFilter =
        columnExists($conn, "tbl_user", "status")
            ? "
                AND COALESCE(
                    status,
                    'Active'
                ) = 'Active'
              "
            : "";

    $stmt = $conn->prepare("
        SELECT
            {$nameColumn} AS recipient_name,
            email
        FROM tbl_user
        WHERE vendor_id = :vendor_id
        AND role IN ('Supplier', 'Vendor')
        {$statusFilter}
        AND email IS NOT NULL
        AND TRIM(email) <> ''
        ORDER BY user_id ASC
        LIMIT 1
    ");

    $stmt->execute([
        ":vendor_id" => $vendorId
    ]);

    $recipient =
        $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$recipient) {
        return null;
    }

    $email = strtolower(
        trim((string)($recipient["email"] ?? ""))
    );

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return null;
    }

    return [
        "name" =>
            trim(
                (string)(
                    $recipient["recipient_name"] ??
                    "Supplier"
                )
            ),
        "email" => $email
    ];
}

function insertSupplierNotification(
    PDO $conn,
    int $userId,
    int $vendorId,
    int $payableId,
    string $paymentNo,
    string $message
): void {
    if (!tableExists($conn, "tbl_notifications")) {
        return;
    }

    $data = [
        "user_id" => $userId,
        "title" => "Supplier Payment Recorded",
        "message" => $message,
        "type" => "Payment",
        "module" => "vendors",
        "reference_id" => $payableId,
        "reference_code" => $paymentNo,
        "status" => "Unread",
        "is_read" => 0
    ];

    $columns = [];
    $values = [];
    $params = [];

    foreach ($data as $column => $value) {
        if (
            !columnExists(
                $conn,
                "tbl_notifications",
                $column
            )
        ) {
            continue;
        }

        $placeholder =
            ":notification_" . $column;

        $columns[] = "`{$column}`";
        $values[] = $placeholder;
        $params[$placeholder] = $value;
    }

    if (
        columnExists(
            $conn,
            "tbl_notifications",
            "created_at"
        )
    ) {
        $columns[] = "`created_at`";
        $values[] = "NOW()";
    }

    if (!$columns) {
        return;
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_notifications
        (" . implode(", ", $columns) . ")
        VALUES
        (" . implode(", ", $values) . ")
    ");

    $stmt->execute($params);
}

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    respond(
        false,
        "No supplier payment information was received.",
        [],
        422
    );
}

$payableId = filter_var(
    $data["payable_id"] ?? null,
    FILTER_VALIDATE_INT
);

$amountPaid = round(
    (float)($data["amount_paid"] ?? 0),
    2
);

$paymentDate = trim(
    (string)(
        $data["payment_date"] ??
        date("Y-m-d")
    )
);

$paymentMethod = trim(
    (string)(
        $data["payment_method"] ?? ""
    )
);

$referenceNumber = trim(
    (string)(
        $data["reference_number"] ?? ""
    )
);

$receivedBy = trim(
    (string)(
        $data["received_by"] ?? ""
    )
);

$processedByUserId = filter_var(
    $data["processed_by_user_id"] ?? null,
    FILTER_VALIDATE_INT
);

$processedBy = trim(
    (string)(
        $data["processed_by"] ??
        "System Admin"
    )
);

$remarks = trim(
    (string)(
        $data["remarks"] ?? ""
    )
);

if (!$payableId) {
    respond(
        false,
        "A valid supplier payable is required.",
        [],
        422
    );
}

if ($amountPaid <= 0) {
    respond(
        false,
        "Payment amount must be greater than zero.",
        [],
        422
    );
}

if (
    !preg_match(
        "/^\d{4}-\d{2}-\d{2}$/",
        $paymentDate
    )
) {
    respond(
        false,
        "A valid payment date is required.",
        [],
        422
    );
}

if ($paymentDate > date("Y-m-d")) {
    respond(
        false,
        "Payment date cannot be in the future.",
        [],
        422
    );
}

if ($paymentMethod === "") {
    respond(
        false,
        "Payment method is required.",
        [],
        422
    );
}

if ($processedBy === "") {
    respond(
        false,
        "Processed by is required.",
        [],
        422
    );
}

$requiredTables = [
    "tbl_supplier_payable",
    "tbl_supplier_payment",
    "tbl_remittance_order",
    "tbl_remittance_order_items"
];

foreach ($requiredTables as $tableName) {
    if (!tableExists($conn, $tableName)) {
        respond(
            false,
            "Supplier payment configuration is incomplete. Missing {$tableName}.",
            [],
            422
        );
    }
}

try {
    $conn->beginTransaction();

    
    $payableStmt = $conn->prepare("
        SELECT
            sp.payable_id,
            sp.vendor_id,
            sp.delivery_id,
            sp.payable_amount,
            sp.paid_amount,
            sp.balance_amount,
            sp.payment_status,
            sp.due_date,
            v.vendor_name,
            d.delivery_order_no
        FROM tbl_supplier_payable sp
        LEFT JOIN tbl_vendor v
            ON v.vendor_id = sp.vendor_id
        LEFT JOIN tbl_delivery d
            ON d.delivery_id = sp.delivery_id
        WHERE sp.payable_id = :payable_id
        LIMIT 1
        FOR UPDATE
    ");

    $payableStmt->execute([
        ":payable_id" => $payableId
    ]);

    $payable =
        $payableStmt->fetch(
            PDO::FETCH_ASSOC
        );

    if (!$payable) {
        throw new Exception(
            "Supplier payable was not found."
        );
    }

    if (
        $payable["payment_status"] ===
        "Cancelled"
    ) {
        throw new Exception(
            "Cancelled supplier payables cannot be paid."
        );
    }

    $currentBalance = round(
        (float)$payable[
            "balance_amount"
        ],
        2
    );

    if ($currentBalance <= 0) {
        throw new Exception(
            "This supplier payable is already fully settled."
        );
    }

    if ($amountPaid > $currentBalance) {
        throw new Exception(
            "Payment amount cannot exceed the remaining balance of ₱" .
            number_format(
                $currentBalance,
                2
            ) .
            "."
        );
    }

    
    $remittanceNo = generateDocumentNo(
        $conn,
        "tbl_remittance_order",
        "remittance_order_no",
        "REM"
    );

    $remittanceStmt = $conn->prepare("
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
            'Released',
            :remarks,
            NOW(),
            NOW()
        )
    ");

    $remittanceStmt->execute([
        ":remittance_order_no" =>
            $remittanceNo,
        ":vendor_id" =>
            (int)$payable["vendor_id"],
        ":total_amount" =>
            $amountPaid,
        ":payment_method" =>
            $paymentMethod,
        ":reference_number" =>
            $referenceNumber !== ""
                ? $referenceNumber
                : null,
        ":prepared_by" =>
            $processedBy,
        ":approved_by" =>
            $processedBy,
        ":release_date" =>
            $paymentDate,
        ":remarks" =>
            $remarks !== ""
                ? $remarks
                : "Automatically generated from direct supplier payable payment."
    ]);

    $remittanceOrderId =
        (int)$conn->lastInsertId();

    $itemStmt = $conn->prepare("
        INSERT INTO tbl_remittance_order_items
        (
            remittance_order_id,
            payable_id,
            delivery_id,
            amount,
            created_at
        )
        VALUES
        (
            :remittance_order_id,
            :payable_id,
            :delivery_id,
            :amount,
            NOW()
        )
    ");

    $itemStmt->execute([
        ":remittance_order_id" =>
            $remittanceOrderId,
        ":payable_id" =>
            $payableId,
        ":delivery_id" =>
            (int)$payable["delivery_id"],
        ":amount" =>
            $amountPaid
    ]);

    $paymentNo = generateDocumentNo(
        $conn,
        "tbl_supplier_payment",
        "payment_no",
        "PAY"
    );

    $paymentStmt = $conn->prepare("
        INSERT INTO tbl_supplier_payment
        (
            payment_no,
            remittance_order_id,
            vendor_id,
            amount_paid,
            payment_date,
            payment_method,
            reference_number,
            received_by,
            processed_by,
            remarks,
            created_at
        )
        VALUES
        (
            :payment_no,
            :remittance_order_id,
            :vendor_id,
            :amount_paid,
            :payment_date,
            :payment_method,
            :reference_number,
            :received_by,
            :processed_by,
            :remarks,
            NOW()
        )
    ");

    $paymentStmt->execute([
        ":payment_no" =>
            $paymentNo,
        ":remittance_order_id" =>
            $remittanceOrderId,
        ":vendor_id" =>
            (int)$payable["vendor_id"],
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
    ]);

    $paymentId =
        (int)$conn->lastInsertId();

    $newPaidAmount = round(
        (float)$payable["paid_amount"] +
        $amountPaid,
        2
    );

    $newBalance = round(
        max(
            0,
            (float)$payable[
                "payable_amount"
            ] -
            $newPaidAmount
        ),
        2
    );

    $newStatus =
        $newBalance <= 0
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
        ":paid_amount" =>
            $newPaidAmount,
        ":balance_amount" =>
            $newBalance,
        ":payment_status" =>
            $newStatus,
        ":payable_id" =>
            $payableId
    ]);

    $vendorName =
        $payable["vendor_name"] ??
        "Supplier";

    $deliveryNumber =
        $payable[
            "delivery_order_no"
        ] ??
        ("Delivery " .
            $payable["delivery_id"]);

    $notificationMessage =
        "BFATC recorded payment " .
        $paymentNo .
        " amounting to ₱" .
        number_format(
            $amountPaid,
            2
        ) .
        " for " .
        $deliveryNumber .
        ". Remaining balance: ₱" .
        number_format(
            $newBalance,
            2
        ) .
        ".";

    foreach (
        getSupplierUserIds(
            $conn,
            (int)$payable["vendor_id"]
        ) as $supplierUserId
    ) {
        insertSupplierNotification(
            $conn,
            $supplierUserId,
            (int)$payable["vendor_id"],
            $payableId,
            $paymentNo,
            $notificationMessage
        );
    }

    insertAuditLog(
        $conn,
        $processedByUserId ?: null,
        $processedBy,
        "Recorded " .
        $paymentNo .
        " for supplier " .
        $vendorName .
        ", delivery " .
        $deliveryNumber .
        ", amount ₱" .
        number_format(
            $amountPaid,
            2
        ) .
        ". Remaining payable balance: ₱" .
        number_format(
            $newBalance,
            2
        ) .
        "."
    );

    $conn->commit();

    
    respond(
        true,
        "Supplier payment recorded successfully.",
        [
            "payment_id" =>
                $paymentId,
            "payment_no" =>
                $paymentNo,
            "remittance_order_id" =>
                $remittanceOrderId,
            "remittance_order_no" =>
                $remittanceNo,
            "payable_id" =>
                $payableId,
            "vendor_id" =>
                (int)$payable["vendor_id"],
            "amount_paid" =>
                $amountPaid,
            "total_paid" =>
                $newPaidAmount,
            "remaining_balance" =>
                $newBalance,
            "payment_status" =>
                $newStatus,
            "payment_date" =>
                $paymentDate,
            "payment_method" =>
                $paymentMethod,
            "reference_number" =>
                $referenceNumber,
            "received_by" =>
                $receivedBy,
            "processed_by" =>
                $processedBy,
            "post_processing_required" =>
                true,
            "post_processing_action" =>
                "payable_payment_receipt"
        ]
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "record_payable_payment.php: " .
        $error->getMessage()
    );

    respond(
        false,
        $error instanceof PDOException ? "Unable to record the supplier payment." : ($error->getMessage() ?: "Unable to record the supplier payment."),
        [],
        500
    );
}