<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("../helpers/supplier_communication.php");
require_once("../helpers/inventory_alert_communication.php");


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
    







    static $tableExistsCache = [];

    $cacheKey = strtolower(trim($tableName));

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

    $cacheKey = strtolower(
        trim($tableName) . "." . trim($columnName)
    );

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

function cleanDate($value): ?string
{
    $value = trim((string)($value ?? ""));

    return $value !== ""
        ? $value
        : null;
}

function getCategory(
    PDO $conn,
    int $categoryId
): array {
    $stmt = $conn->prepare("
        SELECT
            category_id,
            category_name
        FROM tbl_category
        WHERE category_id = :category_id
        LIMIT 1
    ");

    $stmt->execute([
        ":category_id" => $categoryId
    ]);

    $category = $stmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$category) {
        throw new RuntimeException(
            "The selected product category does not exist."
        );
    }

    return $category;
}

function ensureUniqueSku(
    PDO $conn,
    string $sku,
    ?int $excludeProductId = null
): void {
    $sql = "
        SELECT product_id
        FROM tbl_inv
        WHERE LOWER(TRIM(sku)) =
              LOWER(TRIM(:sku))
    ";

    $params = [
        ":sku" => $sku
    ];

    if ($excludeProductId) {
        $sql .= "
            AND product_id <> :exclude_product_id
        ";

        $params[
            ":exclude_product_id"
        ] = $excludeProductId;
    }

    $sql .= " LIMIT 1";

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);

    if ($stmt->fetchColumn()) {
        throw new RuntimeException(
            "The product SKU {$sku} is already used by another inventory product."
        );
    }
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
    $params = [];

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

        $placeholder =
            ":audit_" . $column;

        $columns[] =
            "`{$column}`";

        $placeholders[] =
            $placeholder;

        $params[
            $placeholder
        ] = $value;
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
        (" . implode(", ", $columns) . ")
        VALUES
        (" . implode(", ", $placeholders) . ")
    ");

    $stmt->execute($params);
}







function addInventoryBatch(
    PDO $conn,
    int $productId,
    int $quantity,
    ?string $expiryDate,
    float $supplierPrice,
    int $deliveryId
): int {
    if (
        !tableExists(
            $conn,
            "tbl_inventory_batches"
        )
    ) {
        throw new RuntimeException(
            "Inventory batch table is missing."
        );
    }

    if (
        columnExists(
            $conn,
            "tbl_inventory_batches",
            "delivery_id"
        )
    ) {
        $duplicateStmt = $conn->prepare("
            SELECT batch_id
            FROM tbl_inventory_batches
            WHERE delivery_id = :delivery_id
            AND product_id = :product_id
            LIMIT 1
        ");

        $duplicateStmt->execute([
            ":delivery_id" =>
                $deliveryId,
            ":product_id" =>
                $productId
        ]);

        $existingBatchId =
            $duplicateStmt->fetchColumn();

        if ($existingBatchId) {
            throw new RuntimeException(
                "This delivery item was already received into inventory."
            );
        }
    }

    $columns = [
        "product_id",
        "quantity",
        "expiry_date",
        "supplier_price",
        "created_at"
    ];

    $values = [
        ":product_id",
        ":quantity",
        ":expiry_date",
        ":supplier_price",
        "NOW()"
    ];

    $params = [
        ":product_id" =>
            $productId,
        ":quantity" =>
            $quantity,
        ":expiry_date" =>
            $expiryDate,
        ":supplier_price" =>
            $supplierPrice
    ];

    if (
        columnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        )
    ) {
        $columns[] =
            "remaining_quantity";

        $values[] =
            ":remaining_quantity";

        $params[
            ":remaining_quantity"
        ] = $quantity;
    }

    if (
        columnExists(
            $conn,
            "tbl_inventory_batches",
            "delivery_id"
        )
    ) {
        $columns[] = "delivery_id";
        $values[] = ":delivery_id";
        $params[
            ":delivery_id"
        ] = $deliveryId;
    }

    if (
        columnExists(
            $conn,
            "tbl_inventory_batches",
            "source"
        )
    ) {
        $columns[] = "source";
        $values[] = ":source";
        $params[":source"] =
            "Delivery";
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_inventory_batches
        (" . implode(", ", $columns) . ")
        VALUES
        (" . implode(", ", $values) . ")
    ");

    $stmt->execute($params);

    return (int)$conn->lastInsertId();
}

function synchronizeInventoryFromBatches(
    PDO $conn,
    int $productId
): array {
    $quantityColumn =
        columnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        )
            ? "remaining_quantity"
            : "quantity";

    $summaryStmt = $conn->prepare("
        SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN {$quantityColumn} > 0
                        AND (
                            expiry_date IS NULL
                            OR expiry_date > CURDATE()
                        )
                        THEN {$quantityColumn}
                        ELSE 0
                    END
                ),
                0
            ) AS valid_stock,

            MIN(
                CASE
                    WHEN {$quantityColumn} > 0
                    AND expiry_date IS NOT NULL
                    AND expiry_date > CURDATE()
                    THEN expiry_date
                    ELSE NULL
                END
            ) AS nearest_expiry
        FROM tbl_inventory_batches
        WHERE product_id = :product_id
    ");

    $summaryStmt->execute([
        ":product_id" => $productId
    ]);

    $summary =
        $summaryStmt->fetch(
            PDO::FETCH_ASSOC
        ) ?: [];

    $quantity =
        (int)(
            $summary["valid_stock"] ?? 0
        );

    $nearestExpiry =
        $summary[
            "nearest_expiry"
        ] ?? null;

    $updateStmt = $conn->prepare("
        UPDATE tbl_inv
        SET
            quantity = :quantity,
            expiry_date = :expiry_date,
            status = CASE
                WHEN :status_quantity_1 <= 0
                    THEN 'Out of Stock'
                WHEN :status_quantity_2 <= reorder_level
                    THEN 'Low Stock'
                ELSE 'In Stock'
            END,
            updated_at = NOW()
        WHERE product_id = :product_id
    ");

    $updateStmt->execute([
        ":quantity" => $quantity,
        ":expiry_date" =>
            $nearestExpiry,
        ":status_quantity_1" =>
            $quantity,
        ":status_quantity_2" =>
            $quantity,
        ":product_id" =>
            $productId
    ]);

    return [
        "quantity" => $quantity,
        "nearest_expiry" =>
            $nearestExpiry
    ];
}

function updateInventoryProductDetails(
    PDO $conn,
    int $productId,
    int $vendorId,
    float $supplierPrice,
    array $item
): array {
    





    $setClauses = [
        "vendor_id = ?",
        "supplier_price = ?",
        "updated_at = NOW()"
    ];

    $params = [
        $vendorId,
        $supplierPrice
    ];

    $optionalValues = [
        "is_consignment" =>
            !empty($item["is_consignment"])
                ? 1
                : 0,

        "consignment_terms" =>
            trim(
                (string)(
                    $item[
                        "consignment_terms"
                    ] ?? ""
                )
            ),

        "consignment_start_date" =>
            cleanDate(
                $item[
                    "consignment_start_date"
                ] ?? null
            ),

        "consignment_pullout_date" =>
            cleanDate(
                $item[
                    "consignment_pullout_date"
                ] ?? null
            ),

        "consignment_notes" =>
            trim(
                (string)(
                    $item[
                        "consignment_notes"
                    ] ?? ""
                )
            )
    ];

    foreach (
        $optionalValues as
        $column => $value
    ) {
        if (
            columnExists(
                $conn,
                "tbl_inv",
                $column
            )
        ) {
            $setClauses[] =
                "`{$column}` = ?";

            $params[] = $value;
        }
    }

    $params[] = $productId;

    $stmt = $conn->prepare("
        UPDATE tbl_inv
        SET " .
        implode(", ", $setClauses) .
        "
        WHERE product_id = ?
    ");

    $stmt->execute($params);

    return synchronizeInventoryFromBatches(
        $conn,
        $productId
    );
}







function createSupplierPayable(
    PDO $conn,
    int $vendorId,
    int $deliveryId,
    float $payableAmount,
    ?string $dueDate
): bool {
    if (
        !tableExists(
            $conn,
            "tbl_supplier_payable"
        )
    ) {
        throw new RuntimeException(
            "Supplier payable table is missing."
        );
    }

    if ($payableAmount <= 0) {
        throw new RuntimeException(
            "Supplier payable amount must be greater than zero."
        );
    }

    $duplicateStmt = $conn->prepare("
        SELECT payable_id
        FROM tbl_supplier_payable
        WHERE delivery_id = :delivery_id
        LIMIT 1
    ");

    $duplicateStmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    if ($duplicateStmt->fetchColumn()) {
        return false;
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_supplier_payable
        (
            vendor_id,
            delivery_id,
            payable_amount,
            paid_amount,
            balance_amount,
            payment_status,
            due_date,
            notes,
            created_at,
            updated_at
        )
        VALUES
        (
            :vendor_id,
            :delivery_id,
            :payable_amount,
            0.00,
            :balance_amount,
            'Unpaid',
            :due_date,
            :notes,
            NOW(),
            NOW()
        )
    ");

    $stmt->execute([
        ":vendor_id" =>
            $vendorId,
        ":delivery_id" =>
            $deliveryId,
        ":payable_amount" =>
            $payableAmount,
        ":balance_amount" =>
            $payableAmount,
        ":due_date" =>
            $dueDate,
        ":notes" =>
            "Automatically generated after physical delivery was received and verified by BFATC."
    ]);

    return true;
}







$data = readJsonInput();

$deliveryId = filter_var(
    $data["delivery_id"] ?? null,
    FILTER_VALIDATE_INT
);

$receivedByUserId = filter_var(
    $data["received_by_user_id"] ??
    $data["user_id"] ??
    null,
    FILTER_VALIDATE_INT
);

$receivedByName = trim(
    (string)(
        $data["received_by_name"] ??
        $data["user_name"] ??
        "System Admin"
    )
);

$receivedItemsInput =
    is_array(
        $data["items"] ?? null
    )
        ? $data["items"]
        : [];

$receivingRemarks = trim(
    (string)(
        $data["receiving_remarks"] ??
        $data["remarks"] ??
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

if ($receivedByName === "") {
    $receivedByName =
        "System Admin";
}







$currentStage =
    "Starting physical delivery receiving";

try {
    $conn->beginTransaction();

    $currentStage =
        "Loading approved delivery";

    $deliveryStmt = $conn->prepare("
        SELECT *
        FROM tbl_delivery
        WHERE delivery_id = :delivery_id
        LIMIT 1
        FOR UPDATE
    ");

    $deliveryStmt->execute([
        ":delivery_id" =>
            $deliveryId
    ]);

    $delivery = $deliveryStmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$delivery) {
        throw new RuntimeException(
            "The delivery request was not found."
        );
    }

    $deliveryOrderNumber = trim(
        (string)(
            $delivery[
                "delivery_order_no"
            ] ?? ""
        )
    );

    $vendorId = (int)(
        $delivery["vendor_id"] ?? 0
    );

    $status = trim(
        (string)(
            $delivery["status"] ?? ""
        )
    );

    $submissionSource = trim(
        (string)(
            $delivery[
                "submission_source"
            ] ?? ""
        )
    );

    if (
        strcasecmp(
            $submissionSource,
            "Supplier"
        ) !== 0
    ) {
        throw new RuntimeException(
            "Only Supplier-submitted approved deliveries use this receiving endpoint."
        );
    }

    if ($vendorId <= 0) {
        throw new RuntimeException(
            "The delivery is not linked to a valid supplier."
        );
    }

    


    if (
        strcasecmp(
            $status,
            "Delivered"
        ) === 0
    ) {
        $conn->commit();

        respond(
            true,
            "This delivery was already physically received.",
            [
                "delivery_id" =>
                    $deliveryId,
                "delivery_order_no" =>
                    $deliveryOrderNumber,
                "status" =>
                    "Delivered",
                "already_processed" =>
                    true,
                "notification_sent" =>
                    false,
                "email_sent" =>
                    false
            ]
        );
    }

    if (
        strcasecmp(
            $status,
            "Approved"
        ) !== 0 &&
        strcasecmp(
            $status,
            "In Transit"
        ) !== 0
    ) {
        throw new RuntimeException(
            "Only Approved or In Transit deliveries can be received. Current status: {$status}."
        );
    }

    $deliveryDate =
        cleanDate(
            $delivery["delivery_date"] ?? null
        );

    $currentStage =
        "Loading delivery items";

    $itemsStmt = $conn->prepare("
        SELECT *
        FROM tbl_delivery_items
        WHERE delivery_id =
              :delivery_id
        ORDER BY delivery_item_id ASC
        FOR UPDATE
    ");

    $itemsStmt->execute([
        ":delivery_id" =>
            $deliveryId
    ]);

    $items = $itemsStmt->fetchAll(
        PDO::FETCH_ASSOC
    );

    if (!$items) {
        throw new RuntimeException(
            "The approved delivery has no product lines."
        );
    }

    


    $overridesByItemId = [];

    foreach (
        $receivedItemsInput as
        $receivedItem
    ) {
        $deliveryItemId = (int)(
            $receivedItem[
                "delivery_item_id"
            ] ?? 0
        );

        if ($deliveryItemId > 0) {
            $overridesByItemId[
                $deliveryItemId
            ] = $receivedItem;
        }
    }

    $supplierPayableAmount = 0.0;
    $inventoryUpdates = [];
    $receivedTotalUnits = 0;
    $newProductsCreated = 0; 

    foreach ($items as $index => $item) {
        $lineNumber =
            $index + 1;

        $deliveryItemId = (int)(
            $item[
                "delivery_item_id"
            ] ?? 0
        );

        $override =
            $overridesByItemId[
                $deliveryItemId
            ] ?? [];

        $proposedQuantity = (int)(
            $item["quantity"] ?? 0
        );

        $receivedQuantity = isset(
            $override[
                "received_quantity"
            ]
        )
            ? (int)$override[
                "received_quantity"
            ]
            : $proposedQuantity;

        if ($receivedQuantity <= 0) {
            throw new RuntimeException(
                "Received quantity on product line {$lineNumber} must be greater than zero."
            );
        }

        



        if (
            $receivedQuantity >
            $proposedQuantity
        ) {
            throw new RuntimeException(
                "Received quantity on product line {$lineNumber} cannot exceed the approved quantity of {$proposedQuantity}."
            );
        }

        $supplierPrice = isset(
            $override[
                "supplier_price"
            ]
        )
            ? (float)$override[
                "supplier_price"
            ]
            : (float)(
                $item[
                    "supplier_price"
                ] ?? 0
            );

        




        $retailPrice = 0.0;

        if ($supplierPrice < 0) {
            throw new RuntimeException(
                "Supplier price on product line {$lineNumber} is invalid."
            );
        }

        





        $expiryDate =
            cleanDate(
                $override[
                    "expiry_date"
                ] ??
                $item[
                    "expiry_date"
                ] ??
                null
            );

        if (
            !empty($item["is_consignment"]) &&
            $deliveryDate
        ) {
            $item["consignment_start_date"] =
                $deliveryDate;

            $pulloutDate =
                cleanDate(
                    $item[
                        "consignment_pullout_date"
                    ] ?? null
                );

            if (!$pulloutDate) {
                throw new RuntimeException(
                    "Consignment product line {$lineNumber} is missing its pull-out date."
                );
            }

            if ($pulloutDate <= $deliveryDate) {
                throw new RuntimeException(
                    "Consignment pull-out date on product line {$lineNumber} must be later than the delivery date."
                );
            }

            $item["consignment_terms"] =
                trim(
                    (string)(
                        $item[
                            "consignment_terms"
                        ] ?? ""
                    )
                );
        }

        if (
            $expiryDate &&
            $expiryDate <= date("Y-m-d")
        ) {
            throw new RuntimeException(
                "Expiry date on product line {$lineNumber} must be later than today."
            );
        }

        $productId = (int)(
            $item["product_id"] ?? 0
        );

        $isNewProduct =
            !empty(
                $item[
                    "is_new_product"
                ]
            ) ||
            $productId <= 0;

        










        if ($isNewProduct) {
            throw new RuntimeException(
                "Product line {$lineNumber} is not linked to an approved Supplier product. Submit and approve the product proposal first before using it in Delivery."
            );
        }

        





        $productStmt = $conn->prepare("
            SELECT
                product_id,
                product_name,
                sku,
                vendor_id,
                selling_price,
                status
            FROM tbl_inv
            WHERE product_id = :product_id
            LIMIT 1
            FOR UPDATE
        ");

        $productStmt->execute([
            ":product_id" =>
                $productId
        ]);

        $product = $productStmt->fetch(
            PDO::FETCH_ASSOC
        );

        if (!$product) {
            throw new RuntimeException(
                "Product line {$lineNumber} could not be linked to an inventory product."
            );
        }

        if (
            !empty(
                $product["vendor_id"]
            ) &&
            (string)$product[
                "vendor_id"
            ] !==
            (string)$vendorId
        ) {
            throw new RuntimeException(
                "Product {$product['product_name']} is not linked to this supplier."
            );
        }

        if (
            strcasecmp(
                trim(
                    (string)(
                        $product["status"] ?? ""
                    )
                ),
                "Archived"
            ) === 0
        ) {
            throw new RuntimeException(
                "Product {$product['product_name']} is archived and cannot be received."
            );
        }

        




        $retailPrice = (float)(
            $product["selling_price"] ?? 0
        );

        





        $deliveryItemUpdates = [
            "quantity = :received_quantity",
            "supplier_price = :supplier_price",
            "expiry_date = :expiry_date"
        ];

        $deliveryItemParams = [
            ":received_quantity" =>
                $receivedQuantity,
            ":supplier_price" =>
                $supplierPrice,
            ":expiry_date" =>
                $expiryDate,
            ":delivery_item_id" =>
                $deliveryItemId
        ];

        if (
            !empty($item["is_consignment"]) &&
            $deliveryDate &&
            columnExists(
                $conn,
                "tbl_delivery_items",
                "consignment_start_date"
            )
        ) {
            $deliveryItemUpdates[] =
                "consignment_start_date = :consignment_start_date";

            $deliveryItemParams[
                ":consignment_start_date"
            ] = $deliveryDate;
        }

        $updateDeliveryItemStmt =
            $conn->prepare("
                UPDATE tbl_delivery_items
                SET " .
                implode(
                    ", ",
                    $deliveryItemUpdates
                ) .
                "
                WHERE delivery_item_id =
                      :delivery_item_id
            ");

        $updateDeliveryItemStmt
            ->execute(
                $deliveryItemParams
            );

        





        $currentStage =
            "Creating inventory batch for {$product['product_name']}";

        $batchId =
            addInventoryBatch(
                $conn,
                $productId,
                $receivedQuantity,
                $expiryDate,
                $supplierPrice,
                $deliveryId
            );

        





        $currentStage =
            "Synchronizing inventory for {$product['product_name']}";

        $stockSummary =
            updateInventoryProductDetails(
                $conn,
                $productId,
                $vendorId,
                $supplierPrice,
                $item
            );

        $linePayable =
            $receivedQuantity *
            $supplierPrice;

        $supplierPayableAmount +=
            $linePayable;

        $receivedTotalUnits +=
            $receivedQuantity;

        $inventoryUpdates[] = [
            "delivery_item_id" =>
                $deliveryItemId,
            "product_id" =>
                $productId,
            "product_name" =>
                $product[
                    "product_name"
                ],
            "sku" =>
                $product[
                    "sku"
                ] ?? "",
            "batch_id" =>
                $batchId,
            "approved_quantity" =>
                $proposedQuantity,
            "received_quantity" =>
                $receivedQuantity,
            "supplier_price" =>
                $supplierPrice,
            "retail_price" =>
                $retailPrice,
            "line_payable" =>
                round(
                    $linePayable,
                    2
                ),
            "current_stock" =>
                $stockSummary[
                    "quantity"
                ],
            "nearest_expiry" =>
                $stockSummary[
                    "nearest_expiry"
                ]
        ];
    }

    if ($supplierPayableAmount <= 0) {
        throw new RuntimeException(
            "The received delivery has no valid supplier payable amount."
        );
    }

    





    $currentStage =
        "Creating supplier payable";

    $dueDate =
        cleanDate(
            $delivery[
                "due_date"
            ] ?? null
        );

    $payableCreated =
        createSupplierPayable(
            $conn,
            $vendorId,
            $deliveryId,
            $supplierPayableAmount,
            $dueDate
        );

    





    $currentStage =
        "Marking delivery as physically received";

    $updateColumns = [
        "status = 'Delivered'",
        "items_count = :items_count"
    ];

    $updateParams = [
        ":items_count" =>
            $receivedTotalUnits,
        ":delivery_id" =>
            $deliveryId
    ];

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "received_by_user_id"
        )
    ) {
        $updateColumns[] =
            "received_by_user_id = :received_by_user_id";

        $updateParams[
            ":received_by_user_id"
        ] = $receivedByUserId ?: null;
    }

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "received_by_name"
        )
    ) {
        $updateColumns[] =
            "received_by_name = :received_by_name";

        $updateParams[
            ":received_by_name"
        ] = $receivedByName;
    }

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "received_at"
        )
    ) {
        $updateColumns[] =
            "received_at = NOW()";
    }

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "received_by"
        )
    ) {
        $updateColumns[] =
            "received_by = :received_by";

        $updateParams[
            ":received_by"
        ] = $receivedByName;
    }

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "processed_at"
        )
    ) {
        $updateColumns[] =
            "processed_at = NOW()";
    }

    if (
        columnExists(
            $conn,
            "tbl_delivery",
            "supplier_payable_amount"
        )
    ) {
        $updateColumns[] =
            "supplier_payable_amount = :supplier_payable_amount";

        $updateParams[
            ":supplier_payable_amount"
        ] = $supplierPayableAmount;
    }

    if (
        $receivingRemarks !== "" &&
        columnExists(
            $conn,
            "tbl_delivery",
            "remarks"
        )
    ) {
        




        $updateColumns[] =
            "remarks = CASE
                WHEN remarks IS NULL
                     OR TRIM(remarks) = ''
                    THEN :receiving_remarks_first
                ELSE CONCAT(
                    remarks,
                    '\nReceiving: ',
                    :receiving_remarks_append
                )
            END";

        $updateParams[
            ":receiving_remarks_first"
        ] = $receivingRemarks;

        $updateParams[
            ":receiving_remarks_append"
        ] = $receivingRemarks;
    }

    $updateStmt = $conn->prepare("
        UPDATE tbl_delivery
        SET " .
        implode(
            ", ",
            $updateColumns
        ) .
        "
        WHERE delivery_id =
              :delivery_id
        AND status IN (
            'Approved',
            'In Transit'
        )
    ");

    $updateStmt->execute(
        $updateParams
    );

    if (
        $updateStmt->rowCount() !== 1
    ) {
        throw new RuntimeException(
            "The delivery status changed before receiving could finish. Refresh and try again."
        );
    }

    












    $currentStage =
        "Completing linked restock request";

    $restockRequestCompleted = false;

    if (
        tableExists(
            $conn,
            "tbl_restock_request"
        )
    ) {
        $restockStmt = $conn->prepare("
            UPDATE tbl_restock_request
            SET
                status = 'Completed',
                updated_at = NOW()
            WHERE delivery_id = :delivery_id
            AND vendor_id = :vendor_id
            AND status IN (
                'Pending Supplier',
                'Delivery Created'
            )
        ");

        $restockStmt->execute([
            ":delivery_id" => $deliveryId,
            ":vendor_id" => $vendorId
        ]);

        $restockRequestCompleted =
            $restockStmt->rowCount() > 0;
    }

    





    insertAuditLog(
        $conn,
        $receivedByUserId ?: null,
        $receivedByName,
        "Receive Supplier Delivery",
        "Physically received supplier delivery " .
        $deliveryOrderNumber .
        ". Actual units received: " .
        $receivedTotalUnits .
        ". Supplier payable: ₱" .
        number_format(
            $supplierPayableAmount,
            2
        ) .
        ". Approved catalog products received: " .
        count($inventoryUpdates) .
        ". Restock request completed: " .
        (
            $restockRequestCompleted
                ? "Yes"
                : "No linked active request"
        ) .
        "."
    );

    $conn->commit();

    











    respond(
        true,
        "Delivery received successfully. Inventory, batches and supplier payable were updated. Products without a final BFATC selling price remain unpublished until Admin/Staff completes Set Price & Publish.",
        [
            "delivery_id" =>
                $deliveryId,
            "delivery_order_no" =>
                $deliveryOrderNumber,
            "status" =>
                "Delivered",
            "received_by_user_id" =>
                $receivedByUserId ?: null,
            "received_by_name" =>
                $receivedByName,
            "received_at" =>
                date("Y-m-d H:i:s"),
            "received_total_units" =>
                $receivedTotalUnits,
            "new_products_created" =>
                $newProductsCreated,
            "supplier_payable_amount" =>
                round(
                    $supplierPayableAmount,
                    2
                ),
            "payable_created" =>
                $payableCreated,

            "restock_request_completed" =>
                $restockRequestCompleted,

            "inventory_updates" =>
                $inventoryUpdates,
            "already_processed" =>
                false,

            


            "post_processing_required" =>
                true,
            "post_processing_action" =>
                "received"
        ]
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "receive_delivery.php [" .
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