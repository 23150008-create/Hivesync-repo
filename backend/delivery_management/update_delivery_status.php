<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require_once("../config/database.php");

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

function createInventoryBatch(
    PDO $conn,
    array $item,
    int $deliveryId
): void {
    if (!tableExists($conn, "tbl_inventory_batches")) {
        return;
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
            ":delivery_id" => $deliveryId,
            ":product_id" => (int)$item["product_id"]
        ]);

        if ($duplicateStmt->fetchColumn()) {
            throw new Exception(
                "This delivery product has already been posted to Inventory."
            );
        }
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_inventory_batches
        (
            product_id,
            quantity,
            remaining_quantity,
            expiry_date,
            supplier_price,
            delivery_id,
            created_at
        )
        VALUES
        (
            :product_id,
            :quantity,
            :remaining_quantity,
            :expiry_date,
            :supplier_price,
            :delivery_id,
            NOW()
        )
    ");

    $stmt->execute([
        ":product_id" => $item["product_id"],
        ":quantity" => $item["quantity"],
        ":remaining_quantity" => $item["quantity"],
        ":expiry_date" =>
            $item["expiry_date"] ?: null,
        ":supplier_price" =>
            $item["supplier_price"],
        ":delivery_id" => $deliveryId
    ]);
}

function createInventoryHistory(
    PDO $conn,
    array $item,
    int $deliveryId,
    int $previousQuantity,
    int $newQuantity,
    int $processedBy,
    string $deliveryNumber
): void {
    if (!tableExists($conn, "tbl_inventory_history")) {
        return;
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_inventory_history
        (
            product_id,
            delivery_id,
            action_type,
            quantity,
            previous_quantity,
            new_quantity,
            remarks,
            created_by,
            created_at
        )
        VALUES
        (
            :product_id,
            :delivery_id,
            'Stock In',
            :quantity,
            :previous_quantity,
            :new_quantity,
            :remarks,
            :created_by,
            NOW()
        )
    ");

    $stmt->execute([
        ":product_id" => $item["product_id"],
        ":delivery_id" => $deliveryId,
        ":quantity" => $item["quantity"],
        ":previous_quantity" => $previousQuantity,
        ":new_quantity" => $newQuantity,
        ":remarks" =>
            "Stock received from delivery " .
            $deliveryNumber,
        ":created_by" => $processedBy
    ]);
}

function createSupplierPayable(
    PDO $conn,
    int $vendorId,
    int $deliveryId,
    float $payableAmount,
    ?string $dueDate
): void {
    if (!tableExists($conn, "tbl_supplier_payable")) {
        throw new Exception(
            "Supplier payable table is missing."
        );
    }

    $existingStmt = $conn->prepare("
        SELECT payable_id
        FROM tbl_supplier_payable
        WHERE delivery_id = :delivery_id
        LIMIT 1
    ");

    $existingStmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    if ($existingStmt->fetch(PDO::FETCH_ASSOC)) {
        return;
    }

    if ($payableAmount <= 0) {
        throw new Exception(
            "Supplier payable cannot be created because the calculated amount is zero."
        );
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
        ":vendor_id" => $vendorId,
        ":delivery_id" => $deliveryId,
        ":payable_amount" => $payableAmount,
        ":balance_amount" => $payableAmount,
        ":due_date" => $dueDate,
        ":notes" =>
            "Automatically created after delivery confirmation."
    ]);
}

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "No delivery status information was received."
    ]);

    exit;
}

$deliveryId = filter_var(
    $data["delivery_id"] ?? null,
    FILTER_VALIDATE_INT
);

$newStatus = trim(
    $data["status"] ?? ""
);

$processedBy = filter_var(
    $data["processed_by"] ?? 1,
    FILTER_VALIDATE_INT
);

$dueDate = trim(
    $data["due_date"] ?? ""
);

$dueDate = $dueDate !== ""
    ? $dueDate
    : null;

if (!$deliveryId) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "A valid delivery ID is required."
    ]);

    exit;
}

$allowedStatuses = [
    "Pending",
    "In Transit",
    "Delivered",
    "Cancelled"
];

if (!in_array($newStatus, $allowedStatuses, true)) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "Invalid delivery status."
    ]);

    exit;
}

try {
    $conn->beginTransaction();

    $hasProcessedAtColumn = columnExists(
        $conn,
        "tbl_delivery",
        "processed_at"
    );

    $hasSupplierPayableColumn = columnExists(
        $conn,
        "tbl_delivery",
        "supplier_payable_amount"
    );

    $processedAtSelect = $hasProcessedAtColumn
        ? "processed_at"
        : "NULL AS processed_at";

    $hasSubmissionSourceColumn = columnExists(
        $conn,
        "tbl_delivery",
        "submission_source"
    );

    $submissionSourceSelect =
        $hasSubmissionSourceColumn
            ? "submission_source"
            : "'Admin' AS submission_source";

    $deliveryStmt = $conn->prepare("
        SELECT
            delivery_id,
            delivery_order_no,
            vendor_id,
            status,
            delivery_date,
            {$submissionSourceSelect},
            {$processedAtSelect}
        FROM tbl_delivery
        WHERE delivery_id = :delivery_id
        LIMIT 1
        FOR UPDATE
    ");

    $deliveryStmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    $delivery = $deliveryStmt->fetch(PDO::FETCH_ASSOC);

    if (!$delivery) {
        throw new Exception(
            "Delivery transaction was not found."
        );
    }

    $currentStatus = $delivery["status"];

    $submissionSource = trim(
        (string)(
            $delivery["submission_source"] ??
            "Admin"
        )
    );

    /*
     * Supplier deliveries use the controlled workflow:
     *
     * Pending
     *   -> approve_delivery.php
     *   -> Approved / Awaiting Delivery
     *   -> receive_delivery.php
     *   -> Delivered + Inventory
     *
     * This legacy/general status endpoint is intentionally reserved
     * for Admin-created delivery records. Blocking Supplier records here
     * prevents the same delivery from being posted to Inventory through
     * two different endpoints.
     */
    if (
        strcasecmp(
            $submissionSource,
            "Supplier"
        ) === 0
    ) {
        throw new Exception(
            "Supplier-submitted deliveries cannot be processed through update_delivery_status.php. Use the Supplier approval and physical receiving workflow instead."
        );
    }

    if ($currentStatus === "Archived") {
        throw new Exception(
            "Archived deliveries cannot be updated."
        );
    }

    if ($currentStatus === "Cancelled") {
        throw new Exception(
            "Cancelled deliveries cannot be reopened. Create a new delivery transaction instead."
        );
    }

    if (
        $currentStatus === "Delivered" &&
        $newStatus !== "Delivered"
    ) {
        throw new Exception(
            "A delivered transaction cannot return to Pending, In Transit, or Cancelled because Inventory and supplier payable have already been posted."
        );
    }

    if (
        $currentStatus === "Pending" &&
        !in_array(
            $newStatus,
            [
                "Pending",
                "In Transit",
                "Delivered",
                "Cancelled"
            ],
            true
        )
    ) {
        throw new Exception(
            "Invalid status transition."
        );
    }

    if (
        $currentStatus === "In Transit" &&
        !in_array(
            $newStatus,
            [
                "In Transit",
                "Delivered",
                "Cancelled"
            ],
            true
        )
    ) {
        throw new Exception(
            "An In Transit delivery cannot return to Pending."
        );
    }

    $alreadyProcessed =
        $hasProcessedAtColumn &&
        !empty($delivery["processed_at"]);

    $supplierPayableAmount = 0;
    $processedItems = 0;

    if (
        $newStatus === "Delivered" &&
        !$alreadyProcessed
    ) {
        $itemsStmt = $conn->prepare("
            SELECT
                delivery_item_id,
                product_id,
                product_name,
                quantity,
                supplier_price,
                retail_price,
                selling_price,
                expiry_date,
                vendor_id
            FROM tbl_delivery_items
            WHERE delivery_id = :delivery_id
            ORDER BY delivery_item_id ASC
            FOR UPDATE
        ");

        $itemsStmt->execute([
            ":delivery_id" => $deliveryId
        ]);

        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($items) === 0) {
            throw new Exception(
                "The delivery has no product lines and cannot be confirmed."
            );
        }

        foreach ($items as $item) {
            $productId = (int)$item["product_id"];
            $quantity = (int)$item["quantity"];
            $supplierPrice =
                (float)$item["supplier_price"];

            $retailPrice = (float)(
                $item["retail_price"] ??
                $item["selling_price"] ??
                0
            );

            if ($productId <= 0 || $quantity <= 0) {
                throw new Exception(
                    "The delivery contains an invalid product or quantity."
                );
            }

            $inventoryStmt = $conn->prepare("
                SELECT
                    product_id,
                    product_name,
                    quantity,
                    reorder_level,
                    status
                FROM tbl_inv
                WHERE product_id = :product_id
                LIMIT 1
                FOR UPDATE
            ");

            $inventoryStmt->execute([
                ":product_id" => $productId
            ]);

            $inventoryProduct =
                $inventoryStmt->fetch(PDO::FETCH_ASSOC);

            if (!$inventoryProduct) {
                throw new Exception(
                    "Inventory product " .
                    $item["product_name"] .
                    " was not found."
                );
            }

            if ($inventoryProduct["status"] === "Archived") {
                throw new Exception(
                    "Archived product " .
                    $item["product_name"] .
                    " cannot receive stock."
                );
            }

            $previousQuantity =
                (int)$inventoryProduct["quantity"];

            createInventoryBatch(
                $conn,
                $item,
                $deliveryId
            );

            $remainingColumn = columnExists(
                $conn,
                "tbl_inventory_batches",
                "remaining_quantity"
            )
                ? "remaining_quantity"
                : "quantity";

            $batchSummaryStmt = $conn->prepare("
                SELECT
                    COALESCE(
                        SUM(
                            CASE
                                WHEN {$remainingColumn} > 0
                                AND (
                                    expiry_date IS NULL
                                    OR expiry_date > CURDATE()
                                )
                                THEN {$remainingColumn}
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total_stock,

                    MIN(
                        CASE
                            WHEN {$remainingColumn} > 0
                            AND expiry_date IS NOT NULL
                            AND expiry_date > CURDATE()
                            THEN expiry_date
                            ELSE NULL
                        END
                    ) AS nearest_expiry

                FROM tbl_inventory_batches
                WHERE product_id = :product_id
            ");

            $batchSummaryStmt->execute([
                ":product_id" => $productId
            ]);

            $batchSummary =
                $batchSummaryStmt->fetch(PDO::FETCH_ASSOC);

            $newQuantity = (int)(
                $batchSummary["total_stock"] ?? 0
            );

            $nearestExpiry =
                $batchSummary["nearest_expiry"] ?? null;

            $updateInventoryStmt = $conn->prepare("
                UPDATE tbl_inv
                SET
                    quantity = :new_quantity,
                    supplier_price = :supplier_price,
                    selling_price = CASE
                        WHEN :selling_price > 0
                        THEN :selling_price_value
                        ELSE selling_price
                    END,
                    vendor_id = :vendor_id,
                    expiry_date = :nearest_expiry,
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

            $updateInventoryStmt->execute([
                ":new_quantity" => $newQuantity,
                ":supplier_price" => $supplierPrice,
                ":selling_price" => $retailPrice,
                ":selling_price_value" => $retailPrice,
                ":vendor_id" => $delivery["vendor_id"],
                ":nearest_expiry" => $nearestExpiry,
                ":status_quantity_1" => $newQuantity,
                ":status_quantity_2" => $newQuantity,
                ":product_id" => $productId
            ]);

            createInventoryHistory(
                $conn,
                $item,
                $deliveryId,
                $previousQuantity,
                $newQuantity,
                $processedBy ?: 1,
                $delivery["delivery_order_no"]
            );

            $supplierPayableAmount +=
                $quantity * $supplierPrice;

            $processedItems += 1;
        }

        createSupplierPayable(
            $conn,
            (int)$delivery["vendor_id"],
            $deliveryId,
            $supplierPayableAmount,
            $dueDate
        );
    }

    $setClauses = [
        "status = :status"
    ];

    $parameters = [
        ":status" => $newStatus,
        ":delivery_id" => $deliveryId
    ];

    if (
        $newStatus === "Delivered" &&
        !$alreadyProcessed &&
        $hasProcessedAtColumn
    ) {
        $setClauses[] = "processed_at = NOW()";
    }

    if (
        $newStatus === "Delivered" &&
        $hasSupplierPayableColumn
    ) {
        $setClauses[] =
            "supplier_payable_amount = :supplier_payable_amount";

        $parameters[":supplier_payable_amount"] =
            $supplierPayableAmount > 0
                ? $supplierPayableAmount
                : (
                    (float)($data["supplier_payable_amount"] ?? 0)
                );
    }

    $updateDeliveryStmt = $conn->prepare("
        UPDATE tbl_delivery
        SET " . implode(", ", $setClauses) . "
        WHERE delivery_id = :delivery_id
    ");

    $updateDeliveryStmt->execute($parameters);

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" =>
            $newStatus === "Delivered"
                ? (
                    $alreadyProcessed
                        ? "Delivery is already confirmed and no duplicate Inventory or payable records were created."
                        : "Admin delivery confirmed successfully. Inventory, batch records, stock history, and supplier payable were updated."
                )
                : "Delivery status updated successfully.",

        "delivery_id" => $deliveryId,
        "previous_status" => $currentStatus,
        "status" => $newStatus,
        "already_processed" => $alreadyProcessed,
        "processed_items" => $processedItems,
        "supplier_payable_amount" =>
            round($supplierPayableAmount, 2)
    ]);
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}