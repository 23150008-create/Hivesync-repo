<?php

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("inventory");

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

$productId = filter_var(
    $_GET["product_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$productId) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "A valid product ID is required."
    ]);

    exit;
}

try {
    $ownershipStmt = $conn->prepare("
        SELECT vendor_id
        FROM tbl_inv
        WHERE product_id = :product_id
        LIMIT 1
    ");

    $ownershipStmt->execute([
        ":product_id" => $productId
    ]);

    $ownershipVendorId = $ownershipStmt->fetchColumn();

    if ($ownershipVendorId === false) {
        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "Product record was not found."
        ]);

        exit;
    }

    if (in_array(
        trim((string)($_SESSION["role"] ?? "")),
        ["Supplier", "Vendor"],
        true
    )) {
        enforceSupplierVendorAccess(
            (int)$ownershipVendorId
        );
    }

    $remainingColumn = columnExists(
        $conn,
        "tbl_inventory_batches",
        "remaining_quantity"
    )
        ? "b.remaining_quantity"
        : "b.quantity";

    $stmt = $conn->prepare("
        SELECT
            b.batch_id,
            b.product_id,
            b.delivery_id,
            d.delivery_order_no,
            d.delivery_date,
            b.quantity AS received_quantity,
            {$remainingColumn} AS remaining_quantity,
            b.expiry_date,
            b.supplier_price,
            b.created_at,
            CASE
                WHEN {$remainingColumn} <= 0
                    THEN 'Depleted'
                WHEN b.expiry_date IS NULL
                    THEN 'No Expiry'
                WHEN b.expiry_date < CURDATE()
                    THEN 'Expired'
                WHEN b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                    THEN 'Critical'
                WHEN b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                    THEN 'Near Expiry'
                ELSE 'Safe'
            END AS batch_status
        FROM tbl_inventory_batches b
        LEFT JOIN tbl_delivery d
            ON d.delivery_id = b.delivery_id
        WHERE b.product_id = :product_id
        ORDER BY
            CASE
                WHEN {$remainingColumn} > 0 THEN 0
                ELSE 1
            END,
            CASE
                WHEN b.expiry_date IS NULL THEN 1
                ELSE 0
            END,
            b.expiry_date ASC,
            b.created_at ASC,
            b.batch_id ASC
    ");

    $stmt->execute([
        ":product_id" => $productId
    ]);

    $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $summary = [
        "batch_count" => count($batches),
        "active_batch_count" => 0,
        "total_received" => 0,
        "total_remaining" => 0,
        "nearest_expiry_date" => null
    ];

    foreach ($batches as &$batch) {
        $batch["batch_id"] =
            (int)$batch["batch_id"];

        $batch["product_id"] =
            (int)$batch["product_id"];

        $batch["delivery_id"] =
            $batch["delivery_id"] !== null
                ? (int)$batch["delivery_id"]
                : null;

        $batch["quantity"] =
            (int)$batch["received_quantity"];

        $batch["received_quantity"] =
            (int)$batch["received_quantity"];

        $batch["remaining_quantity"] =
            (int)$batch["remaining_quantity"];

        $batch["supplier_price"] =
            (float)$batch["supplier_price"];

        $summary["total_received"] +=
            $batch["received_quantity"];

        $summary["total_remaining"] +=
            $batch["remaining_quantity"];

        if ($batch["remaining_quantity"] > 0) {
            $summary["active_batch_count"] += 1;

            if (
                $batch["expiry_date"] &&
                (
                    !$summary["nearest_expiry_date"] ||
                    $batch["expiry_date"] <
                    $summary["nearest_expiry_date"]
                )
            ) {
                $summary["nearest_expiry_date"] =
                    $batch["expiry_date"];
            }
        }
    }

    unset($batch);

    echo json_encode([
        "success" => true,
        "batches" => $batches,
        "summary" => $summary
    ]);
} catch (Throwable $e) {
    http_response_code(500);

    error_log(
        "get_product_batches.php: " .
        $e->getMessage()
    );

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to retrieve inventory batches."
    ]);
}
