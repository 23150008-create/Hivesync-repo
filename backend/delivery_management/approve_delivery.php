<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

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




















function deliveryStatusSupportsAwaitingReceipt(
    PDO $conn
): bool {
    $stmt = $conn->prepare("
        SELECT COLUMN_TYPE
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = 'tbl_delivery'
        AND column_name = 'status'
        LIMIT 1
    ");

    $stmt->execute();

    $columnType = strtolower(
        (string)($stmt->fetchColumn() ?: "")
    );

    



    if (
        str_contains($columnType, "varchar") ||
        str_contains($columnType, "text")
    ) {
        return true;
    }

    return str_contains(
        $columnType,
        "'approved'"
    );
}

function validateDeliveryItemsForApproval(
    PDO $conn,
    array $items,
    int $vendorId,
    array $approvalItems = []
): array {
    $summary = [];
    $newProductProposals = 0;
    $totalUnits = 0;
    $priceUpdates = [];

    $approvalByItemId = [];

    foreach ($approvalItems as $approvalItem) {
        $approvalDeliveryItemId = (int)(
            $approvalItem["delivery_item_id"] ?? 0
        );

        if ($approvalDeliveryItemId > 0) {
            $approvalByItemId[
                $approvalDeliveryItemId
            ] = $approvalItem;
        }
    }

    foreach ($items as $index => $item) {
        $lineNumber = $index + 1;

        $productId = (int)(
            $item["product_id"] ?? 0
        );

        $isNewProduct =
            !empty($item["is_new_product"]) ||
            $productId <= 0;

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

        if ($quantity <= 0) {
            throw new Exception(
                "Product line {$lineNumber} has an invalid quantity."
            );
        }

        if ($supplierPrice < 0) {
            throw new Exception(
                "Product line {$lineNumber} has an invalid supplier price."
            );
        }

        if ($retailPrice < 0) {
            throw new Exception(
                "Product line {$lineNumber} has an invalid suggested selling price."
            );
        }

        if ($isNewProduct) {
            throw new Exception(
                "This delivery contains a new-product proposal. Product proposals must be approved separately before the Supplier can submit a delivery."
            );
        } else {
            $productStmt = $conn->prepare("
                SELECT
                    product_id,
                    product_name,
                    sku,
                    vendor_id,
                    selling_price
                FROM tbl_inv
                WHERE product_id = :product_id
                LIMIT 1
            ");

            $productStmt->execute([
                ":product_id" => $productId
            ]);

            $product = $productStmt->fetch(
                PDO::FETCH_ASSOC
            );

            if (!$product) {
                throw new Exception(
                    "Product line {$lineNumber} refers to a missing approved product."
                );
            }

            if (
                !empty($product["vendor_id"]) &&
                (string)$product["vendor_id"] !==
                (string)$vendorId
            ) {
                throw new Exception(
                    "Product {$product['product_name']} is not linked to this supplier."
                );
            }

            $inventorySellingPrice =
                (float)(
                    $product["selling_price"] ??
                    0
                );

            if ($retailPrice <= 0) {
                $retailPrice =
                    $inventorySellingPrice;
            }

            








            $summary[] = [
                "delivery_item_id" =>
                    (int)($item["delivery_item_id"] ?? 0),
                "type" => "Existing Product",
                "product_id" => $productId,
                "product_name" =>
                    (string)$product["product_name"],
                "sku" =>
                    (string)($product["sku"] ?? ""),
                "quantity" => $quantity,
                "supplier_price" => $supplierPrice,
                "retail_price" => $retailPrice,
                "expiry_date" =>
                    $item["expiry_date"] ?? null
            ];
        }

        $totalUnits += $quantity;
    }

    return [
        "items" => $summary,
        "items_count" => count($summary),
        "total_units" => $totalUnits,
        "new_product_proposals" =>
            $newProductProposals,
        "price_updates" =>
            $priceUpdates
    ];
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

$approvalItems =
    is_array($data["items"] ?? null)
        ? $data["items"]
        : [];

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

$currentStage =
    "Starting delivery approval";

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

    $delivery = $deliveryStmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$delivery) {
        throw new Exception(
            "The delivery request was not found."
        );
    }

    $deliveryOrderNumber = (string)(
        $delivery["delivery_order_no"] ?? ""
    );

    $vendorId = (int)(
        $delivery["vendor_id"] ?? 0
    );

    $submissionSource = (string)(
        $delivery["submission_source"] ?? "Admin"
    );

    $currentStatus = trim(
        (string)(
            $delivery["status"] ?? "Pending"
        )
    );

    if (
        strcasecmp(
            $submissionSource,
            "Supplier"
        ) !== 0
    ) {
        throw new Exception(
            "Only supplier-submitted deliveries require this approval endpoint."
        );
    }

    if ($vendorId <= 0) {
        throw new Exception(
            "The delivery is not linked to a valid supplier."
        );
    }

    


    if (
        strcasecmp(
            $currentStatus,
            "Approved"
        ) === 0
    ) {
        $conn->commit();

        respond(
            true,
            "This delivery request is already approved and awaiting physical delivery.",
            [
                "delivery_id" =>
                    $deliveryId,
                "delivery_order_no" =>
                    $deliveryOrderNumber,
                "status" => "Approved",
                "workflow_status" =>
                    "Awaiting Delivery",
                "already_processed" =>
                    true,
                "inventory_updated" =>
                    false,
                "payable_created" =>
                    false,
                "notification_sent" =>
                    false,
                "email_sent" =>
                    false
            ]
        );
    }

    if (
        strcasecmp(
            $currentStatus,
            "Pending"
        ) !== 0
    ) {
        throw new Exception(
            "Only Pending supplier deliveries can be approved. Current status: " .
            $currentStatus .
            "."
        );
    }

    



    if (
        !deliveryStatusSupportsAwaitingReceipt(
            $conn
        )
    ) {
        throw new Exception(
            "tbl_delivery.status does not currently allow the Approved status. Run the required status SQL before using the new approval workflow."
        );
    }

    $currentStage =
        "Loading delivery proposal details";

    $itemsStmt = $conn->prepare("
        SELECT *
        FROM tbl_delivery_items
        WHERE delivery_id = :delivery_id
        ORDER BY delivery_item_id ASC
        FOR UPDATE
    ");

    $itemsStmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    $items = $itemsStmt->fetchAll(
        PDO::FETCH_ASSOC
    );

    if (!$items) {
        throw new Exception(
            "The delivery has no product lines."
        );
    }

    $currentStage =
        "Validating delivery proposal";

    $approvalSummary =
        validateDeliveryItemsForApproval(
            $conn,
            $items,
            $vendorId,
            $approvalItems
        );

    









    



    $currentStage =
        "Marking delivery as approved and awaiting physical delivery";

    $updateColumns = [
        "status = 'Approved'"
    ];

    $updateParams = [
        ":delivery_id" => $deliveryId
    ];

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "reviewed_by_user_id"
        )
    ) {
        $updateColumns[] =
            "reviewed_by_user_id = :reviewed_by_user_id";

        $updateParams[
            ":reviewed_by_user_id"
        ] = $reviewedByUserId ?: null;
    }

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "reviewed_by_name"
        )
    ) {
        $updateColumns[] =
            "reviewed_by_name = :reviewed_by_name";

        $updateParams[
            ":reviewed_by_name"
        ] = $reviewedByName;
    }

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "reviewed_at"
        )
    ) {
        $updateColumns[] =
            "reviewed_at = NOW()";
    }

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "processed_at"
        )
    ) {
        


        $updateColumns[] =
            "processed_at = NULL";
    }

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "rejection_reason"
        )
    ) {
        $updateColumns[] =
            "rejection_reason = NULL";
    }

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "supplier_payable_amount"
        )
    ) {
        


        $updateColumns[] =
            "supplier_payable_amount = 0";
    }

    $updateStmt = $conn->prepare("
        UPDATE tbl_delivery
        SET " .
        implode(", ", $updateColumns) .
        "
        WHERE delivery_id = :delivery_id
        AND status = 'Pending'
    ");

    $updateStmt->execute($updateParams);

    if ($updateStmt->rowCount() !== 1) {
        throw new Exception(
            "The delivery status changed before approval could finish. Refresh and try again."
        );
    }

    $currentStage =
        "Writing approval audit record";

    insertAuditLog(
        $conn,
        $reviewedByUserId ?: null,
        $reviewedByName,
        "Supplier Delivery Approved",
        "Approved supplier delivery " .
        $deliveryOrderNumber .
        " for physical delivery. Inventory, batches and supplier payable remain unchanged until Admin/Staff receives the goods."
    );

    $conn->commit();

    










    respond(
        true,
        "Delivery request approved. It is now awaiting physical delivery. Inventory, batches and supplier payable were not changed.",
        [
            "delivery_id" =>
                $deliveryId,
            "delivery_order_no" =>
                $deliveryOrderNumber,
            "status" => "Approved",
            "workflow_status" =>
                "Awaiting Delivery",
            "reviewed_by_user_id" =>
                $reviewedByUserId ?: null,
            "reviewed_by_name" =>
                $reviewedByName,

            "items_count" =>
                (int)$approvalSummary[
                    "items_count"
                ],
            "total_units" =>
                (int)$approvalSummary[
                    "total_units"
                ],
            "new_product_proposals" =>
                (int)$approvalSummary[
                    "new_product_proposals"
                ],
            "final_price_updates" =>
                $approvalSummary[
                    "price_updates"
                ] ?? [],
            "items" =>
                $approvalSummary["items"],

            "inventory_updated" =>
                false,
            "inventory_updates" => [],
            "supplier_payable_amount" =>
                0,
            "payable_created" =>
                false,
            "already_processed" =>
                false,

            



            "post_processing_required" =>
                true,
            "post_processing_action" =>
                "approved"
        ]
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "approve_delivery.php [" .
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