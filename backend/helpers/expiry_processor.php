<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

/*
|--------------------------------------------------------------------------
| HiveSync Expiry Processor
|--------------------------------------------------------------------------
|
| Rule:
| - expiry_date > CURDATE()  => sellable
| - expiry_date <= CURDATE() => expired / non-sellable
|
| Expired remaining stock:
| - Consignment => Automatic Pull-out
| - Non-consignment => Automatic Disposal
|
| The processor is idempotent because each processed batch's remaining
| quantity is reduced to zero.
|
*/

function expiryProcessorTableExists(PDO $conn, string $table): bool
{
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

function expiryProcessorColumnExists(
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

function expiryProcessorGenerateRequestNo(PDO $conn): string
{
    $year = date("Y");
    $prefix = "PAR-{$year}-";

    $stmt = $conn->prepare("
        SELECT request_no
        FROM tbl_product_action_request
        WHERE request_no LIKE :pattern
        ORDER BY request_id DESC
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":pattern" => $prefix . "%"
    ]);

    $last = (string)($stmt->fetchColumn() ?: "");
    $next = 1;

    if (
        $last !== "" &&
        preg_match(
            "/^" . preg_quote($prefix, "/") . "(\d+)$/",
            $last,
            $matches
        )
    ) {
        $next = ((int)$matches[1]) + 1;
    }

    return $prefix .
        str_pad((string)$next, 5, "0", STR_PAD_LEFT);
}

function expiryProcessorRecalculateProduct(
    PDO $conn,
    int $productId,
    string $quantityColumn
): void {
    $stmt = $conn->prepare("
        SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN `{$quantityColumn}` > 0
                        AND (
                            expiry_date IS NULL
                            OR expiry_date > CURDATE()
                        )
                        THEN `{$quantityColumn}`
                        ELSE 0
                    END
                ),
                0
            ) AS valid_stock,

            MIN(
                CASE
                    WHEN `{$quantityColumn}` > 0
                    AND expiry_date IS NOT NULL
                    AND expiry_date > CURDATE()
                    THEN expiry_date
                    ELSE NULL
                END
            ) AS nearest_expiry

        FROM tbl_inventory_batches
        WHERE product_id = :product_id
    ");

    $stmt->execute([
        ":product_id" => $productId
    ]);

    $summary = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $quantity = (float)($summary["valid_stock"] ?? 0);
    $nearestExpiry = $summary["nearest_expiry"] ?? null;

    $reorderStmt = $conn->prepare("
        SELECT reorder_level
        FROM tbl_inv
        WHERE product_id = :product_id
        LIMIT 1
    ");

    $reorderStmt->execute([
        ":product_id" => $productId
    ]);

    $reorderLevel =
        (float)($reorderStmt->fetchColumn() ?: 0);

    $status =
        $quantity <= 0
            ? "Out of Stock"
            : (
                $quantity <= $reorderLevel
                    ? "Low Stock"
                    : "In Stock"
            );

    $update = $conn->prepare("
        UPDATE tbl_inv
        SET
            quantity = :quantity,
            expiry_date = :expiry_date,
            status = :status,
            updated_at = NOW()
        WHERE product_id = :product_id
    ");

    $update->execute([
        ":quantity" => $quantity,
        ":expiry_date" => $nearestExpiry,
        ":status" => $status,
        ":product_id" => $productId
    ]);
}

function processExpiredInventoryBatches(PDO $conn): array
{
    if (
        !expiryProcessorTableExists($conn, "tbl_inventory_batches") ||
        !expiryProcessorTableExists($conn, "tbl_inv")
    ) {
        return [
            "processed_batches" => 0,
            "processed_quantity" => 0
        ];
    }

    $quantityColumn =
        expiryProcessorColumnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        )
            ? "remaining_quantity"
            : "quantity";

    $startedTransaction = false;

    if (!$conn->inTransaction()) {
        $conn->beginTransaction();
        $startedTransaction = true;
    }

    try {
        $stmt = $conn->prepare("
            SELECT
                b.batch_id,
                b.product_id,
                b.delivery_id,
                b.expiry_date,
                b.`{$quantityColumn}` AS remaining_stock,
                i.product_name,
                i.vendor_id,
                i.quantity AS product_quantity,
                COALESCE(i.is_consignment, 0) AS is_consignment,
                COALESCE(v.vendor_name, 'Unknown Supplier') AS vendor_name
            FROM tbl_inventory_batches b
            INNER JOIN tbl_inv i
                ON i.product_id = b.product_id
            LEFT JOIN tbl_vendor v
                ON v.vendor_id = i.vendor_id
            WHERE b.`{$quantityColumn}` > 0
            AND b.expiry_date IS NOT NULL
            AND b.expiry_date <= CURDATE()
            AND COALESCE(i.status, '') <> 'Archived'
            ORDER BY b.expiry_date ASC, b.batch_id ASC
            FOR UPDATE
        ");

        $stmt->execute();
        $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $affectedProducts = [];
        $processedBatches = 0;
        $processedQuantity = 0.0;

        foreach ($batches as $batch) {
            $batchId = (int)$batch["batch_id"];
            $productId = (int)$batch["product_id"];
            $quantity = (float)$batch["remaining_stock"];

            if ($quantity <= 0) {
                continue;
            }

            $actionType =
                (int)($batch["is_consignment"] ?? 0) === 1
                    ? "Pull-out"
                    : "Disposal";

            $zero = $conn->prepare("
                UPDATE tbl_inventory_batches
                SET `{$quantityColumn}` = 0
                WHERE batch_id = :batch_id
                AND `{$quantityColumn}` > 0
            ");

            $zero->execute([
                ":batch_id" => $batchId
            ]);

            if ($zero->rowCount() !== 1) {
                continue;
            }

            $requestNo = null;

            if (
                expiryProcessorTableExists(
                    $conn,
                    "tbl_product_action_request"
                )
            ) {
                $requestNo =
                    expiryProcessorGenerateRequestNo($conn);

                $columns = [
                    "request_no",
                    "vendor_id",
                    "product_id",
                    "batch_id",
                    "action_type",
                    "requested_quantity",
                    "approved_quantity",
                    "reason",
                    "preferred_action_date",
                    "status",
                    "requested_by_name",
                    "reviewed_by_name",
                    "reviewed_at",
                    "completed_by_name",
                    "completed_at",
                    "created_at",
                    "updated_at"
                ];

                $values = [
                    ":request_no",
                    ":vendor_id",
                    ":product_id",
                    ":batch_id",
                    ":action_type",
                    ":requested_quantity",
                    ":approved_quantity",
                    ":reason",
                    ":preferred_action_date",
                    "'Completed'",
                    "'System Expiry Processor'",
                    "'System Expiry Processor'",
                    "NOW()",
                    "'System Expiry Processor'",
                    "NOW()",
                    "NOW()",
                    "NOW()"
                ];

                $params = [
                    ":request_no" => $requestNo,
                    ":vendor_id" =>
                        (int)($batch["vendor_id"] ?? 0),
                    ":product_id" => $productId,
                    ":batch_id" => $batchId,
                    ":action_type" => $actionType,
                    ":requested_quantity" => $quantity,
                    ":approved_quantity" => $quantity,
                    ":reason" =>
                        "Automatically processed because batch #{$batchId} reached expiry date {$batch['expiry_date']}.",
                    ":preferred_action_date" =>
                        $batch["expiry_date"]
                ];

                if (
                    expiryProcessorColumnExists(
                        $conn,
                        "tbl_product_action_request",
                        "transaction_source"
                    )
                ) {
                    $columns[] = "transaction_source";
                    $values[] = "'Staff/Internal'";
                }

                if (
                    expiryProcessorColumnExists(
                        $conn,
                        "tbl_product_action_request",
                        "disposal_method"
                    )
                ) {
                    $columns[] = "disposal_method";
                    $values[] =
                        $actionType === "Disposal"
                            ? "'Automatic Expiry Disposal'"
                            : "NULL";
                }

                $insert = $conn->prepare("
                    INSERT INTO tbl_product_action_request
                    (" . implode(", ", $columns) . ")
                    VALUES
                    (" . implode(", ", $values) . ")
                ");

                $insert->execute($params);
            }

            if (
                expiryProcessorTableExists(
                    $conn,
                    "tbl_inventory_history"
                )
            ) {
                $historyColumns = [
                    "product_id",
                    "action_type",
                    "quantity",
                    "remarks",
                    "created_at"
                ];

                $historyValues = [
                    ":product_id",
                    ":action_type",
                    ":quantity",
                    ":remarks",
                    "NOW()"
                ];

                $historyParams = [
                    ":product_id" => $productId,
                    ":action_type" =>
                        $actionType === "Disposal"
                            ? "Automatic Expiry Disposal"
                            : "Automatic Expiry Pull-out",
                    ":quantity" => $quantity,
                    ":remarks" =>
                        "Expired batch #{$batchId} automatically processed. " .
                        "Expiry: {$batch['expiry_date']}. " .
                        "Supplier: {$batch['vendor_name']}." .
                        (
                            $requestNo
                                ? " Reference: {$requestNo}."
                                : ""
                        )
                ];

                if (
                    expiryProcessorColumnExists(
                        $conn,
                        "tbl_inventory_history",
                        "delivery_id"
                    )
                ) {
                    $historyColumns[] = "delivery_id";
                    $historyValues[] = ":delivery_id";
                    $historyParams[":delivery_id"] =
                        $batch["delivery_id"] ?: null;
                }

                if (
                    expiryProcessorColumnExists(
                        $conn,
                        "tbl_inventory_history",
                        "previous_quantity"
                    )
                ) {
                    $historyColumns[] = "previous_quantity";
                    $historyValues[] = ":previous_quantity";
                    $historyParams[":previous_quantity"] =
                        (float)($batch["product_quantity"] ?? 0);
                }

                if (
                    expiryProcessorColumnExists(
                        $conn,
                        "tbl_inventory_history",
                        "new_quantity"
                    )
                ) {
                    $historyColumns[] = "new_quantity";
                    $historyValues[] = "NULL";
                }

                if (
                    expiryProcessorColumnExists(
                        $conn,
                        "tbl_inventory_history",
                        "created_by"
                    )
                ) {
                    $historyColumns[] = "created_by";
                    $historyValues[] = "NULL";
                }

                $history = $conn->prepare("
                    INSERT INTO tbl_inventory_history
                    (" . implode(", ", $historyColumns) . ")
                    VALUES
                    (" . implode(", ", $historyValues) . ")
                ");

                $history->execute($historyParams);
            }

            $affectedProducts[$productId] = true;
            $processedBatches++;
            $processedQuantity += $quantity;
        }

        foreach (array_keys($affectedProducts) as $productId) {
            expiryProcessorRecalculateProduct(
                $conn,
                (int)$productId,
                $quantityColumn
            );
        }

        if ($startedTransaction) {
            $conn->commit();
        }

        return [
            "processed_batches" => $processedBatches,
            "processed_quantity" => $processedQuantity
        ];
    } catch (Throwable $error) {
        if ($startedTransaction && $conn->inTransaction()) {
            $conn->rollBack();
        }

        throw $error;
    }
}
