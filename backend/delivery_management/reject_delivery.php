<?php

declare(strict_types=1);

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("../helpers/supplier_communication.php");


if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Only POST requests are allowed."
    ]);
    exit;
}

requireModulePermission("deliveries");
requireAnyRole(["Admin", "Staff"]);
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

function readJsonInput(): array
{
    $data = json_decode(
        file_get_contents("php://input"),
        true
    );

    return is_array($data) ? $data : [];
}

function tableExists(
    PDO $conn,
    string $tableName
): bool {
    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
    ");

    $stmt->execute([
        ":table_name" => $tableName
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

function columnExists(
    PDO $conn,
    string $tableName,
    string $columnName
): bool {
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

    return (int)$stmt->fetchColumn() > 0;
}

function firstExistingColumn(
    PDO $conn,
    string $tableName,
    array $candidates
): ?string {
    foreach ($candidates as $candidate) {
        if (
            columnExists(
                $conn,
                $tableName,
                $candidate
            )
        ) {
            return $candidate;
        }
    }

    return null;
}







function insertNotification(
    PDO $conn,
    array $notification
): void {
    if (
        !tableExists(
            $conn,
            "tbl_notifications"
        )
    ) {
        return;
    }

    $mapping = [
        "user_id" => [
            "user_id",
            "recipient_user_id"
        ],
        "title" => [
            "title",
            "notification_title"
        ],
        "message" => [
            "message",
            "notification_message"
        ],
        "type" => [
            "type",
            "notification_type"
        ],
        "module" => [
            "module",
            "target_page"
        ],
        "reference_id" => [
            "reference_id",
            "related_id"
        ],
        "reference_code" => [
            "reference_code",
            "related_code"
        ],
        "details" => ["details"],
        "status" => ["status"],
        "is_read" => [
            "is_read",
            "read_status"
        ]
    ];

    $columns = [];
    $placeholders = [];
    $parameters = [];

    foreach ($mapping as $key => $candidates) {
        if (
            !array_key_exists(
                $key,
                $notification
            )
        ) {
            continue;
        }

        $column = firstExistingColumn(
            $conn,
            "tbl_notifications",
            $candidates
        );

        if (!$column) {
            continue;
        }

        $placeholder =
            ":notification_" . $key;

        $columns[] = "`{$column}`";
        $placeholders[] = $placeholder;
        $parameters[$placeholder] =
            $notification[$key];
    }

    if (
        columnExists(
            $conn,
            "tbl_notifications",
            "created_at"
        )
    ) {
        $columns[] = "`created_at`";
        $placeholders[] = "NOW()";
    }

    if (!$columns) {
        return;
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_notifications
        (
            " . implode(", ", $columns) . "
        )
        VALUES
        (
            " . implode(", ", $placeholders) . "
        )
    ");

    $stmt->execute($parameters);
}

function getSupplierUserIds(
    PDO $conn,
    int $vendorId
): array {
    if (
        !tableExists(
            $conn,
            "tbl_user"
        ) ||
        !columnExists(
            $conn,
            "tbl_user",
            "vendor_id"
        )
    ) {
        return [];
    }

    $statusFilter = columnExists(
        $conn,
        "tbl_user",
        "status"
    )
        ? "
            AND COALESCE(
                status,
                'Active'
            ) NOT IN (
                'Archived',
                'Inactive',
                'Disabled'
            )
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

    return array_values(
        array_filter(
            array_map(
                "intval",
                $stmt->fetchAll(
                    PDO::FETCH_COLUMN
                )
            )
        )
    );
}







function insertAuditLog(
    PDO $conn,
    ?int $userId,
    string $userName,
    string $action,
    string $details
): void {
    if (
        !tableExists(
            $conn,
            "tbl_audit_trail"
        )
    ) {
        return;
    }

    $values = [
        "user_id" => $userId,
        "user_name" => $userName,
        "module" =>
            "Delivery Management",
        "action" => $action,
        "details" => $details
    ];

    $columns = [];
    $placeholders = [];
    $parameters = [];

    foreach ($values as $column => $value) {
        if (
            !columnExists(
                $conn,
                "tbl_audit_trail",
                $column
            )
        ) {
            continue;
        }

        $columns[] = "`{$column}`";
        $placeholder =
            ":audit_" . $column;
        $placeholders[] = $placeholder;
        $parameters[$placeholder] =
            $value;
    }

    if (
        columnExists(
            $conn,
            "tbl_audit_trail",
            "created_at"
        )
    ) {
        $columns[] = "`created_at`";
        $placeholders[] = "NOW()";
    }

    if (!$columns) {
        return;
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_audit_trail
        (
            " . implode(", ", $columns) . "
        )
        VALUES
        (
            " . implode(", ", $placeholders) . "
        )
    ");

    $stmt->execute($parameters);
}







$data = readJsonInput();

$deliveryId = filter_var(
    $data["delivery_id"] ?? null,
    FILTER_VALIDATE_INT
);

$reviewedByUserId = filter_var(
    $data["reviewed_by_user_id"] ??
    $data["user_id"] ??
    null,
    FILTER_VALIDATE_INT
);

$reviewedByName = trim(
    (string)(
        $data["reviewed_by_name"] ??
        $data["user_name"] ??
        "System Admin"
    )
);

$rejectionReason = trim(
    (string)(
        $data["rejection_reason"] ??
        $data["reason"] ??
        ""
    )
);

if (!$deliveryId) {
    respond(
        false,
        "A valid delivery ID is required.",
        [],
        422
    );
}

if ($reviewedByName === "") {
    $reviewedByName = "System Admin";
}

if ($rejectionReason === "") {
    respond(
        false,
        "Enter the reason for rejecting this delivery.",
        [],
        422
    );
}

if (mb_strlen($rejectionReason) > 1000) {
    respond(
        false,
        "Rejection reason must not exceed 1000 characters.",
        [],
        422
    );
}

$currentStage =
    "Starting delivery rejection";

try {
    $conn->beginTransaction();

    $currentStage =
        "Loading pending supplier delivery";

    $deliveryStmt = $conn->prepare("
        SELECT *
        FROM tbl_delivery
        WHERE delivery_id = :delivery_id
        LIMIT 1
        FOR UPDATE
    ");

    $deliveryStmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    $delivery =
        $deliveryStmt->fetch(
            PDO::FETCH_ASSOC
        );

    if (!$delivery) {
        throw new Exception(
            "The delivery request was not found."
        );
    }

    $deliveryOrderNumber =
        (string)(
            $delivery[
                "delivery_order_no"
            ] ?? ""
        );

    $vendorId =
        (int)(
            $delivery["vendor_id"] ?? 0
        );

    $submissionSource =
        (string)(
            $delivery[
                "submission_source"
            ] ?? "Admin"
        );

    $currentStatus =
        (string)(
            $delivery["status"] ??
            "Pending"
        );

    if (
        strcasecmp(
            $submissionSource,
            "Supplier"
        ) !== 0
    ) {
        throw new Exception(
            "Only supplier-submitted deliveries require this rejection endpoint."
        );
    }

    if ($currentStatus === "Rejected") {
        $conn->commit();

        respond(
            true,
            "This delivery was already rejected.",
            [
                "delivery_id" =>
                    $deliveryId,
                "delivery_order_no" =>
                    $deliveryOrderNumber,
                "status" =>
                    "Rejected",
                "rejection_reason" =>
                    $delivery[
                        "rejection_reason"
                    ] ??
                    $rejectionReason,
                "already_processed" =>
                    true,
                "notification_sent" =>
                    false,
                "email_sent" =>
                    false
            ]
        );
    }

    if ($currentStatus === "Delivered") {
        throw new Exception(
            "A delivered request can no longer be rejected."
        );
    }

    if ($currentStatus !== "Pending") {
        throw new Exception(
            "Only Pending supplier deliveries can be rejected. Current status: " .
            $currentStatus .
            "."
        );
    }

    if ($vendorId <= 0) {
        throw new Exception(
            "The delivery is not linked to a valid supplier."
        );
    }

    



    if (
        tableExists(
            $conn,
            "tbl_inventory_batches"
        ) &&
        columnExists(
            $conn,
            "tbl_inventory_batches",
            "delivery_id"
        )
    ) {
        $batchStmt = $conn->prepare("
            SELECT COUNT(*)
            FROM tbl_inventory_batches
            WHERE delivery_id = :delivery_id
        ");

        $batchStmt->execute([
            ":delivery_id" => $deliveryId
        ]);

        if (
            (int)$batchStmt->fetchColumn() > 0
        ) {
            throw new Exception(
                "This delivery already has inventory batches and cannot be rejected safely."
            );
        }
    }

    if (
        tableExists(
            $conn,
            "tbl_supplier_payable"
        )
    ) {
        $payableStmt = $conn->prepare("
            SELECT COUNT(*)
            FROM tbl_supplier_payable
            WHERE delivery_id = :delivery_id
        ");

        $payableStmt->execute([
            ":delivery_id" => $deliveryId
        ]);

        if (
            (int)$payableStmt->fetchColumn() > 0
        ) {
            throw new Exception(
                "This delivery already has a supplier payable and cannot be rejected safely."
            );
        }
    }

    $currentStage =
        "Marking delivery as rejected";

    $setClauses = [
        "status = 'Rejected'",
        "reviewed_by_user_id = :reviewed_by_user_id",
        "reviewed_by_name = :reviewed_by_name",
        "reviewed_at = NOW()",
        "rejection_reason = :rejection_reason"
    ];

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "processed_at"
        )
    ) {
        $setClauses[] =
            "processed_at = NOW()";
    }

    $updateStmt = $conn->prepare("
        UPDATE tbl_delivery
        SET " .
        implode(", ", $setClauses) .
        "
        WHERE delivery_id = :delivery_id
        AND status = 'Pending'
    ");

    $updateStmt->execute([
        ":reviewed_by_user_id" =>
            $reviewedByUserId ?: null,
        ":reviewed_by_name" =>
            $reviewedByName,
        ":rejection_reason" =>
            $rejectionReason,
        ":delivery_id" =>
            $deliveryId
    ]);

    if ($updateStmt->rowCount() !== 1) {
        throw new Exception(
            "The delivery status changed before rejection could finish. Refresh and try again."
        );
    }

    $currentStage =
        "Writing rejection audit record";

    insertAuditLog(
        $conn,
        $reviewedByUserId ?: null,
        $reviewedByName,
        "Supplier Delivery Rejected",
        "Rejected supplier delivery " .
        $deliveryOrderNumber .
        ". Reason: " .
        $rejectionReason
    );

    $conn->commit();

    











    $supplierCommunication = [
        "recipients" => 0,
        "notifications_sent" => 0,
        "emails_sent" => 0,
        "notification_sent" => false,
        "email_sent" => false
    ];

    $communicationError = null;

    try {
        $supplierCommunication = notifySupplier(
            $conn,
            $vendorId,
            "Delivery Rejected",
            "Your delivery " .
                $deliveryOrderNumber .
                " was rejected by BFATC. Reason: " .
                $rejectionReason,
            "Delivery",
            $deliveryId,
            $deliveryOrderNumber,
            "deliveries",
            "Reason: " .
                $rejectionReason .
                "\nReviewed by: " .
                $reviewedByName .
                "\nStatus: Rejected"
        );
    } catch (Throwable $communicationException) {
        $communicationError =
            $communicationException->getMessage();

        error_log(
            "reject_delivery.php supplier communication: " .
            $communicationError
        );
    }

    respond(
        true,
        "Delivery rejected successfully. Inventory and supplier payable were not changed.",
        [
            "delivery_id" =>
                $deliveryId,
            "delivery_order_no" =>
                $deliveryOrderNumber,
            "status" =>
                "Rejected",
            "reviewed_by_user_id" =>
                $reviewedByUserId ?: null,
            "reviewed_by_name" =>
                $reviewedByName,
            "rejection_reason" =>
                $rejectionReason,
            "inventory_updated" =>
                false,
            "payable_created" =>
                false,
            "already_processed" =>
                false,

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
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "reject_delivery.php [" .
        $currentStage .
        "]: " .
        $error->getMessage()
    );

    respond(
        false,
        $currentStage .
        ": " .
        $error->getMessage(),
        [],
        422
    );
}