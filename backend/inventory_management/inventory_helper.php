<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

function inventoryStockStatus(
    int $quantity,
    int $reorderLevel
): string {
    if ($quantity <= 0) {
        return "Out of Stock";
    }

    if ($quantity <= $reorderLevel) {
        return "Low Stock";
    }

    return "In Stock";
}

function inventoryStockIn(
    PDO $conn,
    $productId,
    $quantity,
    $expiryDate,
    $supplierPrice,
    $deliveryId = null,
    $createdBy = null,
    $remarks = "Stock received"
): array {
    $ownsTransaction = false;

    try {
        $productId = (int)$productId;
        $quantity = (int)$quantity;
        $supplierPrice = (float)$supplierPrice;
        $deliveryId =
            $deliveryId === null || $deliveryId === ""
                ? null
                : (int)$deliveryId;
        $createdBy =
            $createdBy === null || $createdBy === ""
                ? null
                : (int)$createdBy;
        $remarks = trim((string)$remarks);

        if ($productId <= 0) {
            return [
                "success" => false,
                "message" => "A valid product ID is required."
            ];
        }

        if ($quantity <= 0) {
            return [
                "success" => false,
                "message" => "Quantity must be greater than 0."
            ];
        }

        if (!$conn->inTransaction()) {
            $conn->beginTransaction();
            $ownsTransaction = true;
        }

        $stmt = $conn->prepare("
            SELECT
                product_id,
                quantity,
                reorder_level,
                status
            FROM tbl_inv
            WHERE product_id = ?
            LIMIT 1
            FOR UPDATE
        ");

        $stmt->execute([
            $productId
        ]);

        $product = $stmt->fetch(
            PDO::FETCH_ASSOC
        );

        if (!$product) {
            throw new RuntimeException(
                "Product ID {$productId} not found."
            );
        }

        if (
            strcasecmp(
                trim((string)($product["status"] ?? "")),
                "Archived"
            ) === 0
        ) {
            throw new RuntimeException(
                "Archived products cannot receive stock."
            );
        }

        $previousQuantity =
            (int)($product["quantity"] ?? 0);

        $stmt = $conn->prepare("
            SELECT
                batch_id,
                quantity
            FROM tbl_inventory_batches
            WHERE product_id = ?
            AND (
                expiry_date = ?
                OR (
                    expiry_date IS NULL
                    AND ? IS NULL
                )
            )
            AND (
                delivery_id = ?
                OR (
                    delivery_id IS NULL
                    AND ? IS NULL
                )
            )
            LIMIT 1
            FOR UPDATE
        ");

        $stmt->execute([
            $productId,
            $expiryDate,
            $expiryDate,
            $deliveryId,
            $deliveryId
        ]);

        $batch = $stmt->fetch(
            PDO::FETCH_ASSOC
        );

        if ($batch) {
            $newBatchQuantity =
                (int)$batch["quantity"] +
                $quantity;

            $stmt = $conn->prepare("
                UPDATE tbl_inventory_batches
                SET
                    quantity = ?,
                    supplier_price = ?,
                    updated_at = NOW()
                WHERE batch_id = ?
            ");

            $stmt->execute([
                $newBatchQuantity,
                $supplierPrice,
                $batch["batch_id"]
            ]);

            $batchId =
                (int)$batch["batch_id"];
        } else {
            $stmt = $conn->prepare("
                INSERT INTO tbl_inventory_batches
                (
                    product_id,
                    quantity,
                    expiry_date,
                    supplier_price,
                    delivery_id,
                    created_at
                )
                VALUES
                (
                    ?, ?, ?, ?, ?, NOW()
                )
            ");

            $stmt->execute([
                $productId,
                $quantity,
                $expiryDate,
                $supplierPrice,
                $deliveryId
            ]);

            $batchId =
                (int)$conn->lastInsertId();
        }

        $newQuantity =
            $previousQuantity +
            $quantity;

        $reorderLevel =
            (int)($product["reorder_level"] ?? 0);

        $newStatus =
            inventoryStockStatus(
                $newQuantity,
                $reorderLevel
            );

        $stmt = $conn->prepare("
            UPDATE tbl_inv
            SET
                quantity = ?,
                status = ?,
                updated_at = NOW()
            WHERE product_id = ?
        ");

        $stmt->execute([
            $newQuantity,
            $newStatus,
            $productId
        ]);

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
                ?, ?, 'Stock In', ?, ?, ?, ?, ?, NOW()
            )
        ");

        $stmt->execute([
            $productId,
            $deliveryId,
            $quantity,
            $previousQuantity,
            $newQuantity,
            $remarks !== ""
                ? $remarks
                : "Stock received.",
            $createdBy
        ]);

        if ($ownsTransaction) {
            $conn->commit();
        }

        return [
            "success" => true,
            "batch_id" => $batchId,
            "previous_quantity" =>
                $previousQuantity,
            "new_quantity" =>
                $newQuantity,
            "status" =>
                $newStatus
        ];
    } catch (Throwable $error) {
        if (
            $ownsTransaction &&
            $conn->inTransaction()
        ) {
            $conn->rollBack();
        }

        error_log(
            "inventoryStockIn: " .
            $error->getMessage()
        );

        return [
            "success" => false,
            "message" =>
                "Stock in error: " .
                $error->getMessage()
        ];
    }
}

function inventoryStockOut(
    PDO $conn,
    $productId,
    $quantity,
    $referenceType,
    $referenceId,
    $createdBy = null,
    $remarks = "Stock deducted"
): array {
    $ownsTransaction = false;

    try {
        $productId = (int)$productId;
        $quantity = (int)$quantity;
        $referenceType =
            trim((string)$referenceType);
        $referenceId =
            $referenceId === null ||
            $referenceId === ""
                ? null
                : (int)$referenceId;
        $createdBy =
            $createdBy === null ||
            $createdBy === ""
                ? null
                : (int)$createdBy;
        $remarks =
            trim((string)$remarks);

        if ($productId <= 0) {
            return [
                "success" => false,
                "message" => "A valid product ID is required."
            ];
        }

        if ($quantity <= 0) {
            return [
                "success" => false,
                "message" => "Quantity must be greater than 0."
            ];
        }

        if (!$conn->inTransaction()) {
            $conn->beginTransaction();
            $ownsTransaction = true;
        }

        $stmt = $conn->prepare("
            SELECT
                product_id,
                quantity,
                reorder_level,
                status
            FROM tbl_inv
            WHERE product_id = ?
            LIMIT 1
            FOR UPDATE
        ");

        $stmt->execute([
            $productId
        ]);

        $product = $stmt->fetch(
            PDO::FETCH_ASSOC
        );

        if (!$product) {
            throw new RuntimeException(
                "Product ID {$productId} not found."
            );
        }

        if (
            strcasecmp(
                trim((string)($product["status"] ?? "")),
                "Archived"
            ) === 0
        ) {
            throw new RuntimeException(
                "Archived products cannot release stock."
            );
        }

        $previousQuantity =
            (int)($product["quantity"] ?? 0);

        if ($previousQuantity < $quantity) {
            throw new RuntimeException(
                "Insufficient stock. Available: {$previousQuantity}, Requested: {$quantity}."
            );
        }

        $stmt = $conn->prepare("
            SELECT
                batch_id,
                quantity,
                expiry_date
            FROM tbl_inventory_batches
            WHERE product_id = ?
            AND quantity > 0
            ORDER BY
                CASE
                    WHEN expiry_date IS NULL
                    THEN 1
                    ELSE 0
                END,
                expiry_date ASC,
                batch_id ASC
            FOR UPDATE
        ");

        $stmt->execute([
            $productId
        ]);

        $batches = $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );

        if (!$batches) {
            throw new RuntimeException(
                "No inventory batches found for product ID {$productId}."
            );
        }

        $availableBatchQuantity = 0;

        foreach ($batches as $batch) {
            $availableBatchQuantity +=
                (int)$batch["quantity"];
        }

        if ($availableBatchQuantity < $quantity) {
            throw new RuntimeException(
                "Insufficient batch stock. Available: {$availableBatchQuantity}, Requested: {$quantity}."
            );
        }

        $remaining = $quantity;
        $deductedBatches = [];

        $updateBatch = $conn->prepare("
            UPDATE tbl_inventory_batches
            SET
                quantity = ?,
                updated_at = NOW()
            WHERE batch_id = ?
        ");

        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }

            $batchQuantity =
                (int)$batch["quantity"];

            $deductQuantity =
                min(
                    $batchQuantity,
                    $remaining
                );

            $newBatchQuantity =
                $batchQuantity -
                $deductQuantity;

            $updateBatch->execute([
                $newBatchQuantity,
                $batch["batch_id"]
            ]);

            $deductedBatches[] = [
                "batch_id" =>
                    (int)$batch["batch_id"],
                "quantity" =>
                    $deductQuantity,
                "expiry_date" =>
                    $batch["expiry_date"]
            ];

            $remaining -=
                $deductQuantity;
        }

        $newQuantity =
            $previousQuantity -
            $quantity;

        $reorderLevel =
            (int)($product["reorder_level"] ?? 0);

        $newStatus =
            inventoryStockStatus(
                $newQuantity,
                $reorderLevel
            );

        $stmt = $conn->prepare("
            UPDATE tbl_inv
            SET
                quantity = ?,
                status = ?,
                updated_at = NOW()
            WHERE product_id = ?
        ");

        $stmt->execute([
            $newQuantity,
            $newStatus,
            $productId
        ]);

        $batchDetails = json_encode(
            $deductedBatches,
            JSON_UNESCAPED_UNICODE |
            JSON_UNESCAPED_SLASHES
        );

        $historyRemarks =
            ($remarks !== ""
                ? $remarks
                : "Stock deducted.") .
            " | Reference: " .
            ($referenceType !== ""
                ? $referenceType
                : "OUT") .
            (
                $referenceId !== null
                    ? " #" . $referenceId
                    : ""
            ) .
            " | Batches: " .
            $batchDetails;

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
                ?, NULL, 'Stock Out', ?, ?, ?, ?, ?, NOW()
            )
        ");

        $stmt->execute([
            $productId,
            $quantity,
            $previousQuantity,
            $newQuantity,
            $historyRemarks,
            $createdBy
        ]);

        if ($ownsTransaction) {
            $conn->commit();
        }

        return [
            "success" => true,
            "previous_quantity" =>
                $previousQuantity,
            "new_quantity" =>
                $newQuantity,
            "status" =>
                $newStatus,
            "deducted_batches" =>
                $deductedBatches
        ];
    } catch (Throwable $error) {
        if (
            $ownsTransaction &&
            $conn->inTransaction()
        ) {
            $conn->rollBack();
        }

        error_log(
            "inventoryStockOut: " .
            $error->getMessage()
        );

        return [
            "success" => false,
            "message" =>
                "Stock out error: " .
                $error->getMessage()
        ];
    }
}

function getInventoryHistory(
    PDO $conn,
    $productId,
    $limit = 50
) {
    try {
        $productId = (int)$productId;
        $limit = max(
            1,
            min(
                200,
                (int)$limit
            )
        );

        $stmt = $conn->prepare("
            SELECT
                history_id,
                product_id,
                delivery_id,
                action_type,
                quantity,
                previous_quantity,
                new_quantity,
                remarks,
                created_by,
                created_at
            FROM tbl_inventory_history
            WHERE product_id = ?
            ORDER BY
                created_at DESC,
                history_id DESC
            LIMIT {$limit}
        ");

        $stmt->execute([
            $productId
        ]);

        return $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );
    } catch (Throwable $error) {
        error_log(
            "getInventoryHistory: " .
            $error->getMessage()
        );

        return [
            "success" => false,
            "message" =>
                $error->getMessage()
        ];
    }
}

function getInventoryBatches(
    PDO $conn,
    $productId
) {
    try {
        $productId = (int)$productId;

        $stmt = $conn->prepare("
            SELECT
                batch_id,
                product_id,
                quantity,
                expiry_date,
                supplier_price,
                delivery_id,
                created_at,
                updated_at
            FROM tbl_inventory_batches
            WHERE product_id = ?
            AND quantity > 0
            ORDER BY
                CASE
                    WHEN expiry_date IS NULL
                    THEN 1
                    ELSE 0
                END,
                expiry_date ASC,
                batch_id ASC
        ");

        $stmt->execute([
            $productId
        ]);

        return $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );
    } catch (Throwable $error) {
        error_log(
            "getInventoryBatches: " .
            $error->getMessage()
        );

        return [
            "success" => false,
            "message" =>
                $error->getMessage()
        ];
    }
}
