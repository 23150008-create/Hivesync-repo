<?php

declare(strict_types=1);

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");


if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Only POST requests are allowed."
    ]);
    exit;
}

requireAuthentication();
requireAnyRole(["Supplier", "Vendor"]);
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

function readInput(): array
{
    if (!empty($_POST["payload"])) {
        $data = json_decode(
            (string)$_POST["payload"],
            true
        );
    } else {
        $data = json_decode(
            file_get_contents("php://input"),
            true
        );
    }

    return is_array($data) ? $data : [];
}

function cleanDate($value): ?string
{
    $value = trim((string)($value ?? ""));
    return $value !== "" ? $value : null;
}

function tableExists(
    PDO $conn,
    string $table
): bool {
    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
    ");

    $stmt->execute([
        ":table_name" => $table
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

function columnExists(
    PDO $conn,
    string $table,
    string $column
): bool {
    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
        AND column_name = :column_name
    ");

    $stmt->execute([
        ":table_name" => $table,
        ":column_name" => $column
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

function firstExistingColumn(
    PDO $conn,
    string $table,
    array $candidates
): ?string {
    foreach ($candidates as $candidate) {
        if (
            columnExists(
                $conn,
                $table,
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
    $params = [];

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
        $params[$placeholder] =
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

    $stmt->execute($params);
}

function getActiveAdminUserIds(
    PDO $conn
): array {
    if (!tableExists($conn, "tbl_user")) {
        return [];
    }

    $statusSql = columnExists(
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

    $stmt = $conn->query("
        SELECT user_id
        FROM tbl_user
        WHERE role = 'Admin'
        {$statusSql}
        ORDER BY user_id ASC
    ");

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

    $data = [
        "user_id" => $userId,
        "user_name" => $userName,
        "module" => "Delivery Management",
        "action" => "Supplier Delivery Resubmitted",
        "details" => $details
    ];

    $columns = [];
    $values = [];
    $params = [];

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

        $columns[] = "`{$column}`";
        $placeholder = ":audit_" . $column;
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
        (
            " . implode(", ", $columns) . "
        )
        VALUES
        (
            " . implode(", ", $values) . "
        )
    ");

    $stmt->execute($params);
}

$data = readInput();

$deliveryId = filter_var(
    $data["delivery_id"] ?? null,
    FILTER_VALIDATE_INT
);

$vendorId = filter_var(
    $data["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

$submittedByUserId = filter_var(
    $data["submitted_by_user_id"] ??
    $data["user_id"] ??
    null,
    FILTER_VALIDATE_INT
);

$submittedByName = trim(
    (string)(
        $data["submitted_by_name"] ??
        $data["user_name"] ??
        "Supplier User"
    )
);

$deliveryDate = cleanDate(
    $data["delivery_date"] ?? null
);

$driver = trim(
    (string)($data["driver"] ?? "")
);

$remarks = trim(
    (string)($data["remarks"] ?? "")
);

$dueDate = cleanDate(
    $data["due_date"] ?? null
);

$items = $data["items"] ?? [];

if (!$deliveryId) {
    respond(
        false,
        "A valid delivery ID is required.",
        [],
        422
    );
}

if (!$vendorId) {
    respond(
        false,
        "A valid supplier is required.",
        [],
        422
    );
}

enforceSupplierVendorAccess((int)$vendorId);

if (!$deliveryDate) {
    respond(
        false,
        "Delivery date is required.",
        [],
        422
    );
}

if ($deliveryDate < date("Y-m-d")) {
    respond(
        false,
        "Past delivery dates are not allowed.",
        [],
        422
    );
}

if (
    !is_array($items) ||
    count($items) === 0
) {
    respond(
        false,
        "Add at least one product.",
        [],
        422
    );
}

$currentStage =
    "Starting delivery resubmission";

try {
    $conn->beginTransaction();

    $currentStage =
        "Loading rejected supplier delivery";

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

    if (
        strcasecmp(
            (string)(
                $delivery[
                    "submission_source"
                ] ?? "Admin"
            ),
            "Supplier"
        ) !== 0
    ) {
        throw new Exception(
            "Only supplier-submitted deliveries can be resubmitted."
        );
    }

    if (
        (string)(
            $delivery["status"] ?? ""
        ) !== "Rejected"
    ) {
        throw new Exception(
            "Only Rejected delivery requests can be resubmitted."
        );
    }

    if (
        (string)(
            $delivery["vendor_id"] ?? ""
        ) !==
        (string)$vendorId
    ) {
        throw new Exception(
            "This delivery is not linked to the current supplier."
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
        $check = $conn->prepare("
            SELECT COUNT(*)
            FROM tbl_inventory_batches
            WHERE delivery_id = :delivery_id
        ");

        $check->execute([
            ":delivery_id" => $deliveryId
        ]);

        if (
            (int)$check->fetchColumn() > 0
        ) {
            throw new Exception(
                "This request already has inventory batches and cannot be resubmitted safely."
            );
        }
    }

    if (
        tableExists(
            $conn,
            "tbl_supplier_payable"
        )
    ) {
        $check = $conn->prepare("
            SELECT COUNT(*)
            FROM tbl_supplier_payable
            WHERE delivery_id = :delivery_id
        ");

        $check->execute([
            ":delivery_id" => $deliveryId
        ]);

        if (
            (int)$check->fetchColumn() > 0
        ) {
            throw new Exception(
                "This request already has a supplier payable and cannot be resubmitted safely."
            );
        }
    }

    $validItems = [];
    $itemsCount = 0;
    $retailAmount = 0.0;
    $supplierPayableAmount = 0.0;

    foreach ($items as $index => $item) {
        $productId = filter_var(
            $item["product_id"] ?? null,
            FILTER_VALIDATE_INT
        );

        $quantity = (int)(
            $item["quantity"] ?? 0
        );

        $supplierPrice = (float)(
            $item["supplier_price"] ?? 0
        );

        $retailPrice = (float)(
            $item["retail_price"] ??
            $item["selling_price"] ??
            0
        );

        $expiryDate = cleanDate(
            $item["expiry_date"] ?? null
        );

        if (!$productId) {
            throw new Exception(
                "Product line " .
                ($index + 1) .
                " does not contain an approved product."
            );
        }

        $productStmt = $conn->prepare("
            SELECT
                product_id,
                product_name,
                sku,
                category_id,
                category,
                vendor_id,
                unit_type,
                unit,
                supplier_price,
                selling_price,
                status
            FROM tbl_inv
            WHERE product_id = :product_id
            LIMIT 1
        ");

        $productStmt->execute([
            ":product_id" => $productId
        ]);

        $product =
            $productStmt->fetch(
                PDO::FETCH_ASSOC
            );

        if (!$product) {
            throw new Exception(
                "Product line " .
                ($index + 1) .
                " refers to a missing product."
            );
        }

        if (
            (string)(
                $product["vendor_id"] ?? ""
            ) !==
            (string)$vendorId
        ) {
            throw new Exception(
                "Product " .
                ($product["product_name"] ?? $productId) .
                " is not linked to this supplier."
            );
        }

        if (
            (string)(
                $product["status"] ?? ""
            ) === "Archived"
        ) {
            throw new Exception(
                "Archived products cannot be resubmitted for delivery."
            );
        }

        if ($quantity <= 0) {
            throw new Exception(
                "Product line " .
                ($index + 1) .
                " must have a quantity greater than zero."
            );
        }

        if ($supplierPrice < 0) {
            throw new Exception(
                "Supplier price cannot be negative."
            );
        }

        if ($retailPrice <= 0) {
            $retailPrice =
                (float)(
                    $product[
                        "selling_price"
                    ] ?? 0
                );
        }

        if ($retailPrice <= 0) {
            throw new Exception(
                "Retail price must be greater than zero."
            );
        }

        if (
            $expiryDate &&
            $expiryDate < date("Y-m-d")
        ) {
            throw new Exception(
                "Product line " .
                ($index + 1) .
                " has a past expiry date."
            );
        }

        $isConsignment =
            !empty($item["is_consignment"]);

        $consignmentTerms = "";
        $consignmentStartDate = null;
        $consignmentPulloutDate = null;
        $consignmentNotes = "";

        if ($isConsignment) {
            $consignmentStartDate =
                $deliveryDate;

            $consignmentPulloutDate =
                cleanDate(
                    $item[
                        "consignment_pullout_date"
                    ] ?? null
                );

            if (!$consignmentPulloutDate) {
                throw new Exception(
                    "Consignment product line " .
                    ($index + 1) .
                    " requires a pull-out date."
                );
            }

            if (
                $consignmentPulloutDate <=
                $consignmentStartDate
            ) {
                throw new Exception(
                    "Consignment pull-out date must be later than the delivery date."
                );
            }

            $consignmentTerms =
                trim(
                    (string)(
                        $item[
                            "consignment_terms"
                        ] ?? ""
                    )
                );

            $consignmentNotes =
                trim(
                    (string)(
                        $item[
                            "consignment_notes"
                        ] ?? ""
                    )
                );
        }

        $validItems[] = [
            "product" => $product,
            "item" => $item,
            "quantity" => $quantity,
            "supplier_price" =>
                $supplierPrice,
            "retail_price" =>
                $retailPrice,
            "expiry_date" =>
                $expiryDate,
            "is_consignment" =>
                $isConsignment ? 1 : 0,
            "consignment_terms" =>
                $consignmentTerms,
            "consignment_start_date" =>
                $consignmentStartDate,
            "consignment_pullout_date" =>
                $consignmentPulloutDate,
            "consignment_notes" =>
                $consignmentNotes
        ];

        $itemsCount += $quantity;
        $retailAmount +=
            $quantity * $retailPrice;
        $supplierPayableAmount +=
            $quantity * $supplierPrice;
    }

    $currentStage =
        "Updating delivery request";

    $sets = [
        "items_count = :items_count",
        "amount = :amount",
        "driver = :driver",
        "delivery_date = :delivery_date",
        "remarks = :remarks",
        "status = 'Pending'",
        "submitted_by_user_id = :submitted_by_user_id",
        "submitted_by_name = :submitted_by_name",
        "submitted_at = NOW()",
        "reviewed_by_user_id = NULL",
        "reviewed_by_name = NULL",
        "reviewed_at = NULL",
        "rejection_reason = NULL"
    ];

    $params = [
        ":items_count" => $itemsCount,
        ":amount" => $retailAmount,
        ":driver" => $driver,
        ":delivery_date" => $deliveryDate,
        ":remarks" => $remarks,
        ":submitted_by_user_id" =>
            $submittedByUserId ?: null,
        ":submitted_by_name" =>
            $submittedByName,
        ":delivery_id" => $deliveryId
    ];

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "supplier_payable_amount"
        )
    ) {
        $sets[] =
            "supplier_payable_amount = :supplier_payable_amount";

        $params[
            ":supplier_payable_amount"
        ] = $supplierPayableAmount;
    }

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "processed_at"
        )
    ) {
        $sets[] = "processed_at = NULL";
    }

    $updateStmt = $conn->prepare("
        UPDATE tbl_delivery
        SET " .
        implode(", ", $sets) .
        "
        WHERE delivery_id = :delivery_id
        AND status = 'Rejected'
    ");

    $updateStmt->execute($params);

    if ($updateStmt->rowCount() !== 1) {
        throw new Exception(
            "The delivery changed before resubmission could finish. Refresh and try again."
        );
    }

    



    $deleteItems = $conn->prepare("
        DELETE FROM tbl_delivery_items
        WHERE delivery_id = :delivery_id
    ");

    $deleteItems->execute([
        ":delivery_id" => $deliveryId
    ]);

    $currentStage =
        "Saving corrected delivery items";

    $itemStmt = $conn->prepare("
        INSERT INTO tbl_delivery_items
        (
            delivery_id,
            product_id,
            product_name,
            sku,
            category_id,
            category,
            vendor_id,
            quantity,
            unit,
            supplier_price,
            retail_price,
            total_price,
            selling_price,
            expiry_date,
            is_consignment,
            consignment_terms,
            consignment_start_date,
            consignment_pullout_date,
            consignment_notes,
            created_at
        )
        VALUES
        (
            :delivery_id,
            :product_id,
            :product_name,
            :sku,
            :category_id,
            :category,
            :vendor_id,
            :quantity,
            :unit,
            :supplier_price,
            :retail_price,
            :total_price,
            :selling_price,
            :expiry_date,
            :is_consignment,
            :consignment_terms,
            :consignment_start_date,
            :consignment_pullout_date,
            :consignment_notes,
            NOW()
        )
    ");

    foreach ($validItems as $row) {
        $product = $row["product"];

        $itemStmt->execute([
            ":delivery_id" =>
                $deliveryId,
            ":product_id" =>
                $product["product_id"],
            ":product_name" =>
                $product["product_name"],
            ":sku" =>
                $product["sku"],
            ":category_id" =>
                $product["category_id"],
            ":category" =>
                $product["category"],
            ":vendor_id" =>
                $vendorId,
            ":quantity" =>
                $row["quantity"],
            ":unit" =>
                $product["unit"] ??
                $product["unit_type"] ??
                "pcs",
            ":supplier_price" =>
                $row["supplier_price"],
            ":retail_price" =>
                $row["retail_price"],
            ":total_price" =>
                $row["quantity"] *
                $row["retail_price"],
            ":selling_price" =>
                $row["retail_price"],
            ":expiry_date" =>
                $row["expiry_date"],
            ":is_consignment" =>
                $row["is_consignment"],
            ":consignment_terms" =>
                $row["consignment_terms"],
            ":consignment_start_date" =>
                $row["consignment_start_date"],
            ":consignment_pullout_date" =>
                $row["consignment_pullout_date"],
            ":consignment_notes" =>
                $row["consignment_notes"]
        ]);
    }

    $deliveryOrderNumber =
        (string)(
            $delivery[
                "delivery_order_no"
            ] ?? ""
        );

    $currentStage =
        "Notifying Admin users";

    foreach (
        getActiveAdminUserIds($conn)
        as $adminId
    ) {
        insertNotification(
            $conn,
            [
                "user_id" => $adminId,
                "title" =>
                    "Supplier Delivery Resubmitted",
                "message" =>
                    $submittedByName .
                    " corrected and resubmitted delivery " .
                    $deliveryOrderNumber .
                    " for review.",
                "type" => "Delivery",
                "module" => "deliveries",
                "reference_id" =>
                    $deliveryId,
                "reference_code" =>
                    $deliveryOrderNumber,
                "details" =>
                    "The previous rejection reason was cleared. Review the corrected delivery request.",
                "status" => "Pending",
                "is_read" => 0
            ]
        );
    }

    insertAuditLog(
        $conn,
        $submittedByUserId ?: null,
        $submittedByName,
        "Resubmitted rejected delivery " .
        $deliveryOrderNumber .
        " for Admin review."
    );

    $conn->commit();

    respond(
        true,
        "Delivery request resubmitted successfully. Admin has been notified for another review.",
        [
            "delivery_id" =>
                $deliveryId,
            "delivery_order_no" =>
                $deliveryOrderNumber,
            "status" => "Pending",
            "items_count" =>
                $itemsCount,
            "supplier_payable_amount" =>
                round(
                    $supplierPayableAmount,
                    2
                )
        ]
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "resubmit_delivery.php [" .
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