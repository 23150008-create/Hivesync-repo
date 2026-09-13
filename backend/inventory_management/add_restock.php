<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("inventory");
requireAnyRole(["Admin", "Staff"]);


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

function tableExists(PDO $conn, string $tableName): bool
{
    static $cache = [];

    $cacheKey = strtolower(trim($tableName));

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $conn->prepare("\n        SELECT COUNT(*)\n        FROM information_schema.tables\n        WHERE table_schema = DATABASE()\n        AND table_name = :table_name\n    ");

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

    $stmt = $conn->prepare("\n        SELECT COUNT(*)\n        FROM information_schema.columns\n        WHERE table_schema = DATABASE()\n        AND table_name = :table_name\n        AND column_name = :column_name\n    ");

    $stmt->execute([
        ":table_name" => $tableName,
        ":column_name" => $columnName
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function cleanDate($value): ?string
{
    $value = trim((string)$value);

    if ($value === "") {
        return null;
    }

    $date = DateTime::createFromFormat(
        "Y-m-d",
        $value
    );

    if (!$date || $date->format("Y-m-d") !== $value) {
        throw new RuntimeException("Invalid expiry date.");
    }

    return $value;
}

function getStockStatus(
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

function createRestockNotification(
    PDO $conn,
    int $productId,
    string $productName,
    int $restockQuantity,
    int $newQuantity
): void {
    if (!tableExists($conn, "tbl_notifications")) {
        return;
    }

    $title = "Inventory Restocked";
    $message =
        "{$productName} was restocked by " .
        number_format($restockQuantity) .
        " unit(s). New stock quantity: " .
        number_format($newQuantity) .
        ".";

    $hasDetails = columnExists(
        $conn,
        "tbl_notifications",
        "details"
    );

    if ($hasDetails) {
        $stmt = $conn->prepare("\n            INSERT INTO tbl_notifications\n            (\n                title,\n                message,\n                type,\n                reference_id,\n                details,\n                is_read,\n                created_at\n            )\n            VALUES\n            (\n                :title,\n                :message,\n                'Inventory',\n                :reference_id,\n                :details,\n                0,\n                NOW()\n            )\n        ");

        $stmt->execute([
            ":title" => $title,
            ":message" => $message,
            ":reference_id" => $productId,
            ":details" =>
                "Open Inventory Management to review the updated stock and batch."
        ]);

        return;
    }

    $stmt = $conn->prepare("\n        INSERT INTO tbl_notifications\n        (\n            title,\n            message,\n            type,\n            reference_id,\n            is_read,\n            created_at\n        )\n        VALUES\n        (\n            :title,\n            :message,\n            'Inventory',\n            :reference_id,\n            0,\n            NOW()\n        )\n    ");

    $stmt->execute([
        ":title" => $title,
        ":message" => $message,
        ":reference_id" => $productId
    ]);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(false, "Only POST requests are allowed.", [], 405);
}

requireCsrfToken();

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    respond(
        false,
        "No restock information was received.",
        [],
        400
    );
}

$productId = filter_var(
    $data["product_id"] ?? null,
    FILTER_VALIDATE_INT
);

$restockQuantity = filter_var(
    $data["quantity"] ??
        $data["restock_quantity"] ??
        null,
    FILTER_VALIDATE_INT
);

$supplierPriceRaw =
    $data["supplier_price"] ?? null;

$supplierPrice =
    $supplierPriceRaw === null ||
    trim((string)$supplierPriceRaw) === ""
        ? null
        : filter_var(
            $supplierPriceRaw,
            FILTER_VALIDATE_FLOAT
        );

$expiryDateRaw = $data["expiry_date"] ?? "";
$remarks = trim((string)($data["remarks"] ?? ""));

$createdBy = filter_var(
    $data["created_by"] ??
        $data["user_id"] ??
        null,
    FILTER_VALIDATE_INT
);

$createdByName = trim(
    (string)(
        $data["created_by_name"] ??
        $data["user_name"] ??
        "System User"
    )
);

if (!$productId || $productId <= 0) {
    respond(false, "Select a valid inventory product.", [], 422);
}

if (!$restockQuantity || $restockQuantity <= 0) {
    respond(
        false,
        "Restock quantity must be greater than zero.",
        [],
        422
    );
}

if ($restockQuantity > 1000000) {
    respond(false, "Restock quantity is too large.", [], 422);
}

if (
    $supplierPrice !== null &&
    ($supplierPrice === false || $supplierPrice < 0)
) {
    respond(false, "Supplier price cannot be negative.", [], 422);
}

if (mb_strlen($remarks) > 1000) {
    respond(
        false,
        "Remarks must not exceed 1,000 characters.",
        [],
        422
    );
}

try {
    $expiryDate = cleanDate($expiryDateRaw);

    if ($expiryDate !== null && $expiryDate <= date("Y-m-d")) {
        throw new RuntimeException(
            "Expiry date must be later than today."
        );
    }

    foreach ([
        "tbl_inv",
        "tbl_inventory_batches",
        "tbl_inventory_history"
    ] as $requiredTable) {
        if (!tableExists($conn, $requiredTable)) {
            throw new RuntimeException(
                "Required inventory records are unavailable."
            );
        }
    }

    $conn->beginTransaction();

    $productStmt = $conn->prepare("\n        SELECT\n            product_id,\n            product_name,\n            quantity,\n            reorder_level,\n            supplier_price,\n            status\n        FROM tbl_inv\n        WHERE product_id = :product_id\n        AND COALESCE(status, 'In Stock') <> 'Archived'\n        LIMIT 1\n        FOR UPDATE\n    ");

    $productStmt->execute([
        ":product_id" => $productId
    ]);

    $product = $productStmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        throw new RuntimeException(
            "The selected product was not found or has been archived."
        );
    }

    $previousQuantity = (int)($product["quantity"] ?? 0);
    $newQuantity = $previousQuantity + (int)$restockQuantity;
    $reorderLevel = (int)($product["reorder_level"] ?? 0);
    $newStatus = getStockStatus($newQuantity, $reorderLevel);

    $finalSupplierPrice =
        $supplierPrice !== null
            ? (float)$supplierPrice
            : (float)($product["supplier_price"] ?? 0);

    $batchColumns = [
        "product_id",
        "quantity",
        "expiry_date",
        "supplier_price",
        "delivery_id",
        "created_at"
    ];

    $batchValues = [
        ":product_id",
        ":quantity",
        ":expiry_date",
        ":supplier_price",
        "NULL",
        "NOW()"
    ];

    $batchParams = [
        ":product_id" => $productId,
        ":quantity" => (int)$restockQuantity,
        ":expiry_date" => $expiryDate,
        ":supplier_price" => $finalSupplierPrice
    ];

    if (columnExists(
        $conn,
        "tbl_inventory_batches",
        "source"
    )) {
        $batchColumns[] = "source";
        $batchValues[] = ":source";
        $batchParams[":source"] = "Restock";
    }

    $batchStmt = $conn->prepare("\n        INSERT INTO tbl_inventory_batches\n        (" . implode(", ", $batchColumns) . ")\n        VALUES\n        (" . implode(", ", $batchValues) . ")\n    ");

    $batchStmt->execute($batchParams);
    $batchId = (int)$conn->lastInsertId();

    $nearestExpiryStmt = $conn->prepare("\n        SELECT MIN(expiry_date)\n        FROM tbl_inventory_batches\n        WHERE product_id = :product_id\n        AND quantity > 0\n        AND expiry_date IS NOT NULL\n        AND expiry_date > CURDATE()\n    ");

    $nearestExpiryStmt->execute([
        ":product_id" => $productId
    ]);

    $nearestExpiry = $nearestExpiryStmt->fetchColumn();

    if ($nearestExpiry === false) {
        $nearestExpiry = null;
    }

    $updateStmt = $conn->prepare("\n        UPDATE tbl_inv\n        SET\n            quantity = :new_quantity,\n            supplier_price = :supplier_price,\n            expiry_date = :expiry_date,\n            status = :status,\n            updated_at = NOW()\n        WHERE product_id = :product_id\n    ");

    $updateStmt->execute([
        ":new_quantity" => $newQuantity,
        ":supplier_price" => $finalSupplierPrice,
        ":expiry_date" => $nearestExpiry,
        ":status" => $newStatus,
        ":product_id" => $productId
    ]);

    $historyRemarks =
        $remarks !== ""
            ? $remarks
            : "Manual restock processed by {$createdByName}.";

    $historyStmt = $conn->prepare("\n        INSERT INTO tbl_inventory_history\n        (\n            product_id,\n            delivery_id,\n            action_type,\n            quantity,\n            previous_quantity,\n            new_quantity,\n            remarks,\n            created_by,\n            created_at\n        )\n        VALUES\n        (\n            :product_id,\n            NULL,\n            'Manual Restock',\n            :quantity,\n            :previous_quantity,\n            :new_quantity,\n            :remarks,\n            :created_by,\n            NOW()\n        )\n    ");

    $historyStmt->execute([
        ":product_id" => $productId,
        ":quantity" => (int)$restockQuantity,
        ":previous_quantity" => $previousQuantity,
        ":new_quantity" => $newQuantity,
        ":remarks" => $historyRemarks,
        ":created_by" => $createdBy ?: null
    ]);

    $historyId = (int)$conn->lastInsertId();

    createRestockNotification(
        $conn,
        $productId,
        (string)$product["product_name"],
        (int)$restockQuantity,
        $newQuantity
    );

    $conn->commit();

    respond(
        true,
        "Product restocked successfully.",
        [
            "product_id" => $productId,
            "product_name" => $product["product_name"],
            "batch_id" => $batchId,
            "history_id" => $historyId,
            "restock_quantity" => (int)$restockQuantity,
            "previous_quantity" => $previousQuantity,
            "new_quantity" => $newQuantity,
            "supplier_price" => round($finalSupplierPrice, 2),
            "expiry_date" => $expiryDate,
            "nearest_expiry_date" => $nearestExpiry,
            "stock_status" => $newStatus
        ],
        201
    );
} catch (RuntimeException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    respond(false, $e->getMessage(), [], 422);
} catch (Throwable $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "HiveSync restock error: " . $e->getMessage()
    );

    respond(
        false,
        "The restock transaction could not be completed.",
        [],
        500
    );
}