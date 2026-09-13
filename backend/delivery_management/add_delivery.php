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

requireAuthentication();
requireAnyRole(["Admin", "Staff", "Supplier", "Vendor"]);
requireCsrfToken();







if (!empty($_POST["payload"])) {
    $data = json_decode($_POST["payload"], true);
} else {
    $data = json_decode(file_get_contents("php://input"), true);
}

if (!is_array($data)) {
    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "No delivery information was received."
    ]);

    exit;
}







function cleanDate($value)
{
    $value = trim((string)($value ?? ""));

    return $value !== "" ? $value : null;
}

function tableExists(PDO $conn, string $tableName): bool
{
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

function validatePhoneNumber(string $phone): void
{
    if ($phone !== "" && !preg_match("/^09\d{9}$/", $phone)) {
        throw new Exception(
            "Contact number must contain 11 digits and start with 09."
        );
    }
}

function validateDeliveryDate(?string $deliveryDate): void
{
    if (!$deliveryDate) {
        throw new Exception("Delivery date is required.");
    }

    $today = date("Y-m-d");

    if ($deliveryDate < $today) {
        throw new Exception("Past delivery dates are not allowed.");
    }
}

function uploadProductImage(string $imageKey): string
{
    if (
        $imageKey === "" ||
        empty($_FILES[$imageKey]) ||
        $_FILES[$imageKey]["error"] !== UPLOAD_ERR_OK
    ) {
        return "";
    }

    $file = $_FILES[$imageKey];

    $allowedExtensions = [
        "jpg",
        "jpeg",
        "png",
        "webp"
    ];

    $allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    $maximumFileSize = 5 * 1024 * 1024;

    if ((int)$file["size"] > $maximumFileSize) {
        throw new Exception(
            "Product image must not exceed 5 MB."
        );
    }

    $extension = strtolower(
        pathinfo($file["name"], PATHINFO_EXTENSION)
    );

    if (!in_array($extension, $allowedExtensions, true)) {
        throw new Exception(
            "Invalid product image. Use JPG, PNG, or WEBP."
        );
    }

    $mimeType = mime_content_type($file["tmp_name"]);

    if (!in_array($mimeType, $allowedMimeTypes, true)) {
        throw new Exception(
            "The uploaded file is not a valid product image."
        );
    }

    $uploadDirectory =
        __DIR__ . "/../uploads/products/";

    if (!is_dir($uploadDirectory)) {
        if (
            !mkdir(
                $uploadDirectory,
                0777,
                true
            ) &&
            !is_dir($uploadDirectory)
        ) {
            throw new Exception(
                "Unable to create the product upload directory."
            );
        }
    }

    $newFileName =
        "product_" .
        date("YmdHis") .
        "_" .
        bin2hex(random_bytes(4)) .
        "." .
        $extension;

    $targetPath =
        $uploadDirectory .
        $newFileName;

    if (
        !move_uploaded_file(
            $file["tmp_name"],
            $targetPath
        )
    ) {
        throw new Exception(
            "Unable to upload the product image."
        );
    }

    return "uploads/products/" . $newFileName;
}

function generateDeliveryOrderNumber(PDO $conn): string
{
    $datePrefix = "DO-" . date("Ymd") . "-";

    $stmt = $conn->prepare("
        SELECT delivery_order_no
        FROM tbl_delivery
        WHERE delivery_order_no LIKE :prefix
        ORDER BY delivery_id DESC
        LIMIT 1
    ");

    $stmt->execute([
        ":prefix" => $datePrefix . "%"
    ]);

    $lastOrderNumber = $stmt->fetchColumn();

    $nextSequence = 1;

    if ($lastOrderNumber) {
        $parts = explode("-", $lastOrderNumber);
        $lastSequence = (int)end($parts);
        $nextSequence = $lastSequence + 1;
    }

    return $datePrefix .
        str_pad(
            (string)$nextSequence,
            4,
            "0",
            STR_PAD_LEFT
        );
}

function getSupplier(
    PDO $conn,
    int $vendorId
): array {
    $stmt = $conn->prepare("
        SELECT
            vendor_id,
            vendor_name,
            contact_person,
            phone,
            address,
            status
        FROM tbl_vendor
        WHERE vendor_id = :vendor_id
        LIMIT 1
    ");

    $stmt->execute([
        ":vendor_id" => $vendorId
    ]);

    $supplier = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$supplier) {
        throw new Exception(
            "The selected supplier was not found."
        );
    }

    if ($supplier["status"] === "Archived") {
        throw new Exception(
            "The selected supplier is archived and cannot be used for a new delivery."
        );
    }

    return $supplier;
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

    $category = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$category) {
        throw new Exception(
            "The selected product category does not exist."
        );
    }

    return $category;
}

function getInventoryProduct(
    PDO $conn,
    int $productId
): array {
    $stmt = $conn->prepare("
        SELECT
            product_id,
            product_name,
            sku,
            category_id,
            category,
            vendor_id,
            quantity,
            unit_type,
            unit,
            reorder_level,
            supplier_price,
            selling_price,
            expiry_date,
            product_image,
            status
        FROM tbl_inv
        WHERE product_id = :product_id
        LIMIT 1
    ");

    $stmt->execute([
        ":product_id" => $productId
    ]);

    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        throw new Exception(
            "The selected inventory product was not found."
        );
    }

    return $product;
}

function findExistingInventoryVariant(
    PDO $conn,
    string $productName,
    int $categoryId,
    string $unitType,
    int $vendorId
): ?array {
    $stmt = $conn->prepare("
        SELECT
            product_id,
            product_name,
            sku,
            category_id,
            vendor_id,
            COALESCE(
                NULLIF(unit_type, ''),
                unit,
                'pcs'
            ) AS effective_unit,
            status
        FROM tbl_inv
        WHERE LOWER(TRIM(product_name)) =
              LOWER(TRIM(:product_name))
        AND category_id = :category_id
        AND vendor_id = :vendor_id
        AND LOWER(
            TRIM(
                COALESCE(
                    NULLIF(unit_type, ''),
                    unit,
                    'pcs'
                )
            )
        ) = LOWER(TRIM(:unit_type))
        ORDER BY
            CASE
                WHEN COALESCE(status, 'In Stock') = 'Archived'
                    THEN 1
                ELSE 0
            END,
            product_id ASC
        LIMIT 1
    ");

    $stmt->execute([
        ":product_name" => trim(
            preg_replace(
                "/\\s+/",
                " ",
                $productName
            )
        ),
        ":category_id" => $categoryId,
        ":vendor_id" => $vendorId,
        ":unit_type" => trim($unitType)
    ]);

    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    return $product ?: null;
}


function ensureUniqueSku(
    PDO $conn,
    string $sku
): void {
    $stmt = $conn->prepare("
        SELECT product_id
        FROM tbl_inv
        WHERE LOWER(TRIM(sku)) = LOWER(TRIM(:sku))
        LIMIT 1
    ");

    $stmt->execute([
        ":sku" => $sku
    ]);

    if ($stmt->fetch(PDO::FETCH_ASSOC)) {
        throw new Exception(
            "The product SKU already exists. Use a unique SKU."
        );
    }
}







function createInventoryProduct(
    PDO $conn,
    array $item,
    int $vendorId
): int {
    $productName = trim(
        $item["product_name"] ?? ""
    );

    $sku = trim(
        $item["sku"] ?? ""
    );

    $categoryId = filter_var(
        $item["category_id"] ?? null,
        FILTER_VALIDATE_INT
    );

    $unitType = trim(
        $item["unit_type"] ?? "pcs"
    );

    $unit = trim(
        $item["unit"] ?? $unitType
    );

    $reorderLevel = max(
        0,
        (int)($item["reorder_level"] ?? 5)
    );

    $supplierPrice = max(
        0,
        (float)($item["supplier_price"] ?? 0)
    );

    $sellingPrice = max(
        0,
        (float)(
            $item["retail_price"] ??
            $item["selling_price"] ??
            0
        )
    );

    $expiryDate = cleanDate(
        $item["expiry_date"] ?? null
    );

    if ($productName === "") {
        throw new Exception(
            "New product name is required."
        );
    }

    if ($sku === "") {
        throw new Exception(
            "New product SKU is required."
        );
    }

    if (!$categoryId) {
        throw new Exception(
            "New product category is required."
        );
    }

    if ($unitType === "") {
        throw new Exception(
            "New product unit is required."
        );
    }

    if ($sellingPrice <= 0) {
        throw new Exception(
            "New product retail price must be greater than zero."
        );
    }

    ensureUniqueSku(
        $conn,
        $sku
    );

    $category = getCategory(
        $conn,
        $categoryId
    );

    









    $existingVariant =
        findExistingInventoryVariant(
            $conn,
            $productName,
            (int)$categoryId,
            $unitType,
            $vendorId
        );

    if ($existingVariant) {
        if (
            strcasecmp(
                trim(
                    (string)(
                        $existingVariant["status"] ?? ""
                    )
                ),
                "Archived"
            ) === 0
        ) {
            throw new Exception(
                "This product variation already exists but is archived. Restore the existing product before receiving it again."
            );
        }

        



        return (int)$existingVariant["product_id"];
    }

    $imageKey = trim(
        $item["image_key"] ?? ""
    );

    $productImage = uploadProductImage(
        $imageKey
    );

    $columns = [
        "product_name",
        "sku",
        "category_id",
        "category",
        "vendor_id",
        "quantity",
        "unit_type",
        "reorder_level",
        "supplier_price",
        "selling_price",
        "expiry_date",
        "product_image",
        "status",
        "created_at",
        "updated_at"
    ];

    $placeholders = [
        ":product_name",
        ":sku",
        ":category_id",
        ":category",
        ":vendor_id",
        "0",
        ":unit_type",
        ":reorder_level",
        ":supplier_price",
        ":selling_price",
        ":expiry_date",
        ":product_image",
        "'Out of Stock'",
        "NOW()",
        "NOW()"
    ];

    $parameters = [
        ":product_name" => $productName,
        ":sku" => $sku,
        ":category_id" => $categoryId,
        ":category" => $category["category_name"],
        ":vendor_id" => $vendorId,
        ":unit_type" => $unitType,
        ":reorder_level" => $reorderLevel,
        ":supplier_price" => $supplierPrice,
        ":selling_price" => $sellingPrice,
        ":expiry_date" => $expiryDate,
        ":product_image" => $productImage
    ];

    if (
        columnExists(
            $conn,
            "tbl_inv",
            "unit"
        )
    ) {
        $columns[] = "unit";
        $placeholders[] = ":unit";
        $parameters[":unit"] = $unit;
    }

    $optionalConsignmentColumns = [
        "is_consignment",
        "consignment_terms",
        "consignment_start_date",
        "consignment_pullout_date",
        "consignment_notes"
    ];

    $consignmentValues = [
        "is_consignment" =>
            !empty($item["is_consignment"]) ? 1 : 0,

        "consignment_terms" =>
            trim($item["consignment_terms"] ?? ""),

        "consignment_start_date" =>
            cleanDate(
                $item["consignment_start_date"] ?? null
            ),

        "consignment_pullout_date" =>
            cleanDate(
                $item["consignment_pullout_date"] ?? null
            ),

        "consignment_notes" =>
            trim($item["consignment_notes"] ?? "")
    ];

    foreach (
        $optionalConsignmentColumns
        as $column
    ) {
        if (
            columnExists(
                $conn,
                "tbl_inv",
                $column
            )
        ) {
            $columns[] = $column;
            $placeholders[] = ":" . $column;
            $parameters[":" . $column] =
                $consignmentValues[$column];
        }
    }

    $sql = "
        INSERT INTO tbl_inv
        (
            " . implode(", ", $columns) . "
        )
        VALUES
        (
            " . implode(", ", $placeholders) . "
        )
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute($parameters);

    return (int)$conn->lastInsertId();
}







function addInventoryBatch(
    PDO $conn,
    int $productId,
    int $quantity,
    ?string $expiryDate,
    float $supplierPrice,
    int $deliveryId
): void {
    if (
        !tableExists(
            $conn,
            "tbl_inventory_batches"
        )
    ) {
        return;
    }

    








    $columns = [
        "product_id",
        "quantity",
        "expiry_date",
        "supplier_price",
        "created_at"
    ];

    $placeholders = [
        ":product_id",
        ":quantity",
        ":expiry_date",
        ":supplier_price",
        "NOW()"
    ];

    $parameters = [
        ":product_id" => $productId,
        ":quantity" => $quantity,
        ":expiry_date" => $expiryDate,
        ":supplier_price" => $supplierPrice
    ];

    if (
        columnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        )
    ) {
        $columns[] = "remaining_quantity";
        $placeholders[] = ":remaining_quantity";
        $parameters[":remaining_quantity"] = $quantity;
    }

    if (
        columnExists(
            $conn,
            "tbl_inventory_batches",
            "delivery_id"
        )
    ) {
        $columns[] = "delivery_id";
        $placeholders[] = ":delivery_id";
        $parameters[":delivery_id"] = $deliveryId;
    }

    $sql = "
        INSERT INTO tbl_inventory_batches
        (
            " . implode(", ", $columns) . "
        )
        VALUES
        (
            " . implode(", ", $placeholders) . "
        )
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute($parameters);
}


function synchronizeInventoryFromBatches(
    PDO $conn,
    int $productId
): array {
    if (
        !tableExists(
            $conn,
            "tbl_inventory_batches"
        )
    ) {
        $stmt = $conn->prepare("
            SELECT
                quantity,
                expiry_date
            FROM tbl_inv
            WHERE product_id = :product_id
            LIMIT 1
        ");

        $stmt->execute([
            ":product_id" => $productId
        ]);

        $product = $stmt->fetch(PDO::FETCH_ASSOC);

        return [
            "quantity" =>
                (int)($product["quantity"] ?? 0),
            "nearest_expiry" =>
                $product["expiry_date"] ?? null
        ];
    }

    $remainingColumn = columnExists(
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
            ) AS valid_stock,

            MIN(
                CASE
                    WHEN {$remainingColumn} > 0
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
        $summaryStmt->fetch(PDO::FETCH_ASSOC);

    $newQuantity =
        (int)($summary["valid_stock"] ?? 0);

    $nearestExpiry =
        $summary["nearest_expiry"] ?? null;

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
        ":quantity" => $newQuantity,
        ":expiry_date" => $nearestExpiry,
        ":status_quantity_1" => $newQuantity,
        ":status_quantity_2" => $newQuantity,
        ":product_id" => $productId
    ]);

    return [
        "quantity" => $newQuantity,
        "nearest_expiry" => $nearestExpiry
    ];
}







function updateInventory(
    PDO $conn,
    int $productId,
    int $quantity,
    float $supplierPrice,
    float $sellingPrice,
    ?string $expiryDate,
    int $vendorId,
    array $item
): void {
    $setClauses = [
        "supplier_price = ?",
        "selling_price = ?",
        "vendor_id = ?",
        "updated_at = NOW()"
    ];

    $parameters = [
        $supplierPrice,
        $sellingPrice,
        $vendorId
    ];

    $optionalValues = [
        "is_consignment" =>
            !empty($item["is_consignment"]) ? 1 : 0,
        "consignment_terms" =>
            trim($item["consignment_terms"] ?? ""),
        "consignment_start_date" =>
            cleanDate(
                $item["consignment_start_date"] ?? null
            ),
        "consignment_pullout_date" =>
            cleanDate(
                $item["consignment_pullout_date"] ?? null
            ),
        "consignment_notes" =>
            trim($item["consignment_notes"] ?? "")
    ];

    foreach ($optionalValues as $column => $value) {
        if (
            columnExists(
                $conn,
                "tbl_inv",
                $column
            )
        ) {
            $setClauses[] = $column . " = ?";
            $parameters[] = $value;
        }
    }

    $parameters[] = $productId;

    $stmt = $conn->prepare("
        UPDATE tbl_inv
        SET " . implode(", ", $setClauses) . "
        WHERE product_id = ?
    ");

    $stmt->execute($parameters);

    synchronizeInventoryFromBatches(
        $conn,
        $productId
    );
}













function insertProposedDeliveryItem(
    PDO $conn,
    int $deliveryId,
    array $item,
    int $vendorId,
    int $quantity,
    float $supplierPrice,
    float $retailPrice,
    ?string $expiryDate
): void {
    $productName = trim(
        (string)($item["product_name"] ?? "")
    );

    $sku = trim(
        (string)($item["sku"] ?? "")
    );

    $categoryId = filter_var(
        $item["category_id"] ?? null,
        FILTER_VALIDATE_INT
    );

    $unitType = trim(
        (string)(
            $item["unit_type"] ??
            $item["unit"] ??
            "pcs"
        )
    );

    $reorderLevel = max(
        0,
        (int)($item["reorder_level"] ?? 5)
    );

    if ($productName === "") {
        throw new Exception(
            "New product name is required."
        );
    }

    if ($sku === "") {
        throw new Exception(
            "New product SKU is required."
        );
    }

    if (!$categoryId) {
        throw new Exception(
            "New product category is required."
        );
    }

    if ($unitType === "") {
        throw new Exception(
            "New product unit is required."
        );
    }

    if ($supplierPrice < 0) {
        throw new Exception(
            "Supplier price cannot be negative."
        );
    }

    if ($retailPrice < 0) {
        throw new Exception(
            "Suggested selling price cannot be negative."
        );
    }

    





    



    ensureUniqueSku(
        $conn,
        $sku
    );

    $category = getCategory(
        $conn,
        $categoryId
    );

    $imageKey = trim(
        (string)($item["image_key"] ?? "")
    );

    $productImage = uploadProductImage(
        $imageKey
    );

    $totalPrice =
        $quantity * $retailPrice;

    $columns = [
        "delivery_id",
        "product_id",
        "product_name",
        "sku",
        "category_id",
        "category",
        "vendor_id",
        "quantity",
        "unit",
        "supplier_price",
        "retail_price",
        "total_price",
        "selling_price",
        "expiry_date",
        "created_at"
    ];

    $values = [
        ":delivery_id",
        "NULL",
        ":product_name",
        ":sku",
        ":category_id",
        ":category",
        ":vendor_id",
        ":quantity",
        ":unit",
        ":supplier_price",
        ":retail_price",
        ":total_price",
        ":selling_price",
        ":expiry_date",
        "NOW()"
    ];

    $params = [
        ":delivery_id" => $deliveryId,
        ":product_name" => $productName,
        ":sku" => $sku,
        ":category_id" => $categoryId,
        ":category" => $category["category_name"],
        ":vendor_id" => $vendorId,
        ":quantity" => $quantity,
        ":unit" => $unitType,
        ":supplier_price" => $supplierPrice,
        ":retail_price" => $retailPrice,
        ":total_price" => $totalPrice,
        ":selling_price" => $retailPrice,
        ":expiry_date" => $expiryDate
    ];

    $proposalValues = [
        "is_new_product" => 1,
        "proposed_product_name" => $productName,
        "proposed_sku" => $sku,
        "proposed_category_id" => $categoryId,
        "proposed_category" =>
            $category["category_name"],
        "proposed_unit" => $unitType,
        "proposed_reorder_level" =>
            $reorderLevel,
        "proposed_product_image" =>
            $productImage
    ];

    foreach (
        $proposalValues as
        $column => $value
    ) {
        if (
            columnExists(
                $conn,
                "tbl_delivery_items",
                $column
            )
        ) {
            $columns[] = $column;
            $values[] = ":" . $column;
            $params[":" . $column] = $value;
        }
    }

    




    $description = trim(
        (string)(
            $item["description"] ??
            $item["product_description"] ??
            ""
        )
    );

    foreach (
        [
            "proposed_description",
            "product_description",
            "description"
        ] as $descriptionColumn
    ) {
        if (
            $description !== "" &&
            columnExists(
                $conn,
                "tbl_delivery_items",
                $descriptionColumn
            )
        ) {
            $columns[] = $descriptionColumn;
            $values[] =
                ":" . $descriptionColumn;
            $params[
                ":" . $descriptionColumn
            ] = $description;
            break;
        }
    }

    $consignmentValues = [
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
        $consignmentValues as
        $column => $value
    ) {
        if (
            columnExists(
                $conn,
                "tbl_delivery_items",
                $column
            )
        ) {
            $columns[] = $column;
            $values[] = ":" . $column;
            $params[":" . $column] = $value;
        }
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_delivery_items
        (" . implode(", ", $columns) . ")
        VALUES
        (" . implode(", ", $values) . ")
    ");

    $stmt->execute($params);
}







function insertDeliveryItem(
    PDO $conn,
    int $deliveryId,
    array $product,
    array $item,
    int $vendorId,
    int $quantity,
    float $supplierPrice,
    float $retailPrice,
    ?string $expiryDate
): void {
    $totalPrice =
        $quantity *
        $retailPrice;

    $columns = [
        "delivery_id",
        "product_id",
        "product_name",
        "sku",
        "category_id",
        "category",
        "vendor_id",
        "quantity",
        "unit",
        "supplier_price",
        "retail_price",
        "total_price",
        "selling_price",
        "expiry_date",
        "created_at"
    ];

    $placeholders = [
        ":delivery_id",
        ":product_id",
        ":product_name",
        ":sku",
        ":category_id",
        ":category",
        ":vendor_id",
        ":quantity",
        ":unit",
        ":supplier_price",
        ":retail_price",
        ":total_price",
        ":selling_price",
        ":expiry_date",
        "NOW()"
    ];

    $unitValue =
        $product["unit_type"] ??
        $product["unit"] ??
        "pcs";

    $parameters = [
        ":delivery_id" => $deliveryId,
        ":product_id" => $product["product_id"],
        ":product_name" => $product["product_name"],
        ":sku" => $product["sku"],
        ":category_id" => $product["category_id"],
        ":category" => $product["category"],
        ":vendor_id" => $vendorId,
        ":quantity" => $quantity,
        ":unit" => $unitValue,
        ":supplier_price" => $supplierPrice,
        ":retail_price" => $retailPrice,
        ":total_price" => $totalPrice,
        ":selling_price" => $retailPrice,
        ":expiry_date" => $expiryDate
    ];

    $optionalValues = [
        "is_consignment" =>
            !empty($item["is_consignment"]) ? 1 : 0,

        "consignment_terms" =>
            trim($item["consignment_terms"] ?? ""),

        "consignment_start_date" =>
            cleanDate(
                $item["consignment_start_date"] ?? null
            ),

        "consignment_pullout_date" =>
            cleanDate(
                $item["consignment_pullout_date"] ?? null
            ),

        "consignment_notes" =>
            trim($item["consignment_notes"] ?? "")
    ];

    foreach (
        $optionalValues
        as $column => $value
    ) {
        if (
            columnExists(
                $conn,
                "tbl_delivery_items",
                $column
            )
        ) {
            $columns[] = $column;
            $placeholders[] = ":" . $column;
            $parameters[":" . $column] =
                $value;
        }
    }

    $sql = "
        INSERT INTO tbl_delivery_items
        (
            " . implode(", ", $columns) . "
        )
        VALUES
        (
            " . implode(", ", $placeholders) . "
        )
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute($parameters);
}







function createSupplierPayable(
    PDO $conn,
    int $vendorId,
    int $deliveryId,
    float $payableAmount,
    ?string $dueDate = null
): void {
    if (
        !tableExists(
            $conn,
            "tbl_supplier_payable"
        )
    ) {
        throw new Exception(
            "Supplier payable table is missing. Run the supplier remittance SQL before saving a delivered transaction."
        );
    }

    if ($payableAmount <= 0) {
        throw new Exception(
            "Supplier payable amount must be greater than zero. Check the supplier prices of the delivered products."
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

    if ($duplicateStmt->fetch(PDO::FETCH_ASSOC)) {
        return;
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
            "Automatically generated from delivered supplier transaction."
    ]);
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

function insertDeliveryNotification(
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
        "details" => [
            "details"
        ],
        "status" => [
            "status"
        ],
        "is_read" => [
            "is_read",
            "read_status"
        ]
    ];

    $columns = [];
    $placeholders = [];
    $parameters = [];

    foreach (
        $mapping as $key => $candidates
    ) {
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
            " .
            implode(", ", $placeholders) .
            "
        )
    ");

    $stmt->execute($parameters);
}

function getActiveDeliveryReviewerUserIds(
    PDO $conn
): array {
    if (
        !tableExists(
            $conn,
            "tbl_user"
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

    $stmt = $conn->query("
        SELECT user_id
        FROM tbl_user
        WHERE role IN ('Admin', 'Staff')
        {$statusFilter}
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

function notifyDeliveryReviewersOfSupplierDelivery(
    PDO $conn,
    int $deliveryId,
    string $deliveryOrderNumber,
    string $supplierName,
    string $submittedByName,
    int $itemsCount,
    int $newProductProposalCount = 0
): void {
    $reviewerIds =
        getActiveDeliveryReviewerUserIds($conn);

    foreach ($reviewerIds as $reviewerUserId) {
        insertDeliveryNotification(
            $conn,
            [
                "user_id" =>
                    $reviewerUserId,

                "title" =>
                    "New Supplier Delivery Request",

                "message" =>
                    sprintf(
                        "%s submitted delivery %s for review. Total units: %d.%s",
                        $supplierName,
                        $deliveryOrderNumber,
                        $itemsCount,
                        $newProductProposalCount > 0
                            ? " Includes " .
                              $newProductProposalCount .
                              " new product proposal(s)."
                            : ""
                    ),

                "type" =>
                    "Delivery",

                



                "module" =>
                    "deliveries",

                "reference_id" =>
                    $deliveryId,

                "reference_code" =>
                    $deliveryOrderNumber,

                "details" =>
                    sprintf(
                        "Submitted by %s. Open Delivery Management to review and approve or reject this request.",
                        $submittedByName
                    ),

                "status" =>
                    "Pending",

                "is_read" => 0
            ]
        );
    }
}








$currentStage = "Starting delivery transaction";

try {
    $conn->beginTransaction();

    $vendorId = filter_var(
        $data["vendor_id"] ?? null,
        FILTER_VALIDATE_INT
    );

    $deliveryOrderNumber = trim(
        $data["delivery_order_no"] ?? ""
    );

    $driver = trim(
        $data["driver"] ?? ""
    );

    $deliveryDate = cleanDate(
        $data["delivery_date"] ?? null
    );

    $businessName = trim(
        $data["business_name"] ??
        "Bacnotan Farmers Agri-Tourism Center"
    );

    $ownerName = trim(
        $data["owner_name"] ?? ""
    );

    $contactNumber = trim(
        $data["contact_number"] ?? ""
    );

    $remarks = trim(
        $data["remarks"] ?? ""
    );

    $receivedBy = trim(
        $data["received_by"] ?? ""
    );

    $notedBy = trim(
        $data["noted_by"] ?? ""
    );

    $submissionSource = ucfirst(
        strtolower(
            trim(
                (string)(
                    $data[
                        "submission_source"
                    ] ?? "Admin"
                )
            )
        )
    );

    if (
        !in_array(
            $submissionSource,
            [
                "Admin",
                "Supplier"
            ],
            true
        )
    ) {
        throw new Exception(
            "Invalid delivery submission source."
        );
    }

    $submittedByUserId = filter_var(
        $data[
            "submitted_by_user_id"
        ] ??
        $data["user_id"] ??
        null,
        FILTER_VALIDATE_INT
    );

    












    if ($submittedByUserId) {
        $userStmt = $conn->prepare("
            SELECT
                user_id,
                full_name,
                role,
                vendor_id,
                status
            FROM tbl_user
            WHERE user_id = ?
            LIMIT 1
        ");

        $userStmt->execute([
            $submittedByUserId
        ]);

        $submittedUser = $userStmt->fetch(
            PDO::FETCH_ASSOC
        );

        if ($submittedUser) {
            $resolvedRole = strtolower(
                trim(
                    (string)(
                        $submittedUser["role"] ?? ""
                    )
                )
            );

            if (
                in_array(
                    $resolvedRole,
                    [
                        "supplier",
                        "vendor"
                    ],
                    true
                )
            ) {
                $submissionSource = "Supplier";

                $accountVendorId = (int)(
                    $submittedUser["vendor_id"] ?? 0
                );

                if (
                    $accountVendorId > 0 &&
                    $vendorId > 0 &&
                    $accountVendorId !== $vendorId
                ) {
                    throw new Exception(
                        "Supplier account cannot submit a delivery for another supplier."
                    );
                }

                




                if ($accountVendorId > 0) {
                    $vendorId = $accountVendorId;
                }
            } else {
                $submissionSource = "Admin";
            }
        }
    }

    $submittedByName = trim(
        (string)(
            $data[
                "submitted_by_name"
            ] ??
            $data["user_name"] ??
            $receivedBy ??
            ""
        )
    );

    if ($submittedByName === "") {
        $submittedByName =
            $submissionSource === "Supplier"
                ? "Supplier User"
                : "System Admin";
    }

    





    $status =
        $submissionSource === "Supplier"
            ? "Pending"
            : trim(
                (string)(
                    $data["status"] ??
                    "Delivered"
                )
            );

    $dueDate = cleanDate(
        $data["due_date"] ?? null
    );

    $items = $data["items"] ?? [];

    











    $restockRequestId = filter_var(
        $data["restock_request_id"] ?? null,
        FILTER_VALIDATE_INT
    );

    if (!$vendorId) {
        throw new Exception(
            "Please select a supplier."
        );
    }

    $sessionRole = (string)($_SESSION["role"] ?? "");

    if (in_array($sessionRole, ["Supplier", "Vendor"], true)) {
        enforceSupplierVendorAccess((int)$vendorId);
    } else {
        requireModulePermission("deliveries");
        requireAnyRole(["Admin", "Staff"]);
    }

    validateDeliveryDate(
        $deliveryDate
    );

    validatePhoneNumber(
        $contactNumber
    );

    $allowedStatuses = [
        "Pending",
        "In Transit",
        "Delivered",
        "Rejected",
        "Cancelled"
    ];

    if (
        !in_array(
            $status,
            $allowedStatuses,
            true
        )
    ) {
        throw new Exception(
            "Invalid delivery status."
        );
    }

    if ($status === "Rejected") {
        throw new Exception(
            "A new delivery cannot be created as Rejected."
        );
    }

    if (
        !is_array($items) ||
        count($items) === 0
    ) {
        throw new Exception(
            "Please add at least one product to the delivery."
        );
    }

    getSupplier(
        $conn,
        $vendorId
    );

    if ($deliveryOrderNumber === "") {
        $deliveryOrderNumber =
            generateDeliveryOrderNumber($conn);
    } else {
        $duplicateOrderStmt =
            $conn->prepare("
                SELECT delivery_id
                FROM tbl_delivery
                WHERE delivery_order_no = :delivery_order_no
                LIMIT 1
            ");

        $duplicateOrderStmt->execute([
            ":delivery_order_no" =>
                $deliveryOrderNumber
        ]);

        if (
            $duplicateOrderStmt
                ->fetch(PDO::FETCH_ASSOC)
        ) {
            throw new Exception(
                "The delivery order number already exists."
            );
        }
    }

    $validItems = [];
    $itemsCount = 0;
    $retailAmount = 0;
    $supplierPayableAmount = 0;
    $newProductProposalCount = 0;

    foreach ($items as $itemIndex => $item) {
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
                "Product item " .
                ($itemIndex + 1) .
                " must have a quantity greater than zero."
            );
        }

        if ($supplierPrice < 0) {
            throw new Exception(
                "Product item " .
                ($itemIndex + 1) .
                " has an invalid supplier price."
            );
        }

        if ($retailPrice < 0) {
            throw new Exception(
                "Product item " .
                ($itemIndex + 1) .
                " has an invalid retail price."
            );
        }

        $expiryDate = cleanDate(
            $item["expiry_date"] ?? null
        );

        if (
            $expiryDate &&
            $expiryDate <= date("Y-m-d")
        ) {
            throw new Exception(
                "Product item " .
                ($itemIndex + 1) .
                " must have an expiry date later than today."
            );
        }

        $isConsignment =
            !empty($item["is_consignment"]);

        if ($isConsignment) {
            



            $startDate = $deliveryDate;

            $pulloutDate = cleanDate(
                $item["consignment_pullout_date"] ??
                null
            );

            if (!$pulloutDate) {
                throw new Exception(
                    "Consignment product item " .
                    ($itemIndex + 1) .
                    " requires a pull-out date."
                );
            }

            if ($pulloutDate <= $startDate) {
                throw new Exception(
                    "Consignment pull-out date must be later than the delivery date."
                );
            }

            $item["consignment_start_date"] =
                $startDate;

            $item["consignment_terms"] =
                trim(
                    (string)(
                        $item["consignment_terms"] ?? ""
                    )
                );

            $item["consignment_notes"] =
                trim(
                    (string)(
                        $item["consignment_notes"] ?? ""
                    )
                );
        } else {
            $item["consignment_terms"] = "";
            $item["consignment_start_date"] = null;
            $item["consignment_pullout_date"] = null;
            $item["consignment_notes"] = "";
        }

        $itemsCount += $quantity;

        $retailAmount +=
            $quantity *
            $retailPrice;

        $supplierPayableAmount +=
            $quantity *
            $supplierPrice;

        




        $validItems[] = $item;
    }

    if ($itemsCount <= 0) {
        throw new Exception(
            "The delivery must contain at least one valid product quantity."
        );
    }

    






    $deliveryStmt = $conn->prepare("
        INSERT INTO tbl_delivery
        (
            delivery_order_no,
            vendor_id,
            items_count,
            amount,
            driver,
            delivery_date,
            business_name,
            owner_name,
            contact_number,
            remarks,
            received_by,
            noted_by,
            status,
            submission_source,
            submitted_by_user_id,
            submitted_by_name,
            submitted_at,
            supplier_payable_amount,
            created_at
        )
        VALUES
        (
            :delivery_order_no,
            :vendor_id,
            :items_count,
            :amount,
            :driver,
            :delivery_date,
            :business_name,
            :owner_name,
            :contact_number,
            :remarks,
            :received_by,
            :noted_by,
            :status,
            :submission_source,
            :submitted_by_user_id,
            :submitted_by_name,
            NOW(),
            :supplier_payable_amount,
            NOW()
        )
    ");

    $currentStage = "Saving delivery header";

    $deliveryStmt->execute([
        ":delivery_order_no" =>
            $deliveryOrderNumber,

        ":vendor_id" =>
            $vendorId,

        ":items_count" =>
            $itemsCount,

        ":amount" =>
            $retailAmount,

        ":driver" =>
            $driver,

        ":delivery_date" =>
            $deliveryDate,

        ":business_name" =>
            $businessName,

        ":owner_name" =>
            $ownerName,

        ":contact_number" =>
            $contactNumber,

        ":remarks" =>
            $remarks,

        ":received_by" =>
            $receivedBy,

        ":noted_by" =>
            $notedBy,

        ":status" =>
            $status,

        ":submission_source" =>
            $submissionSource,

        ":submitted_by_user_id" =>
            $submittedByUserId ?: null,

        ":submitted_by_name" =>
            $submittedByName,

        





        ":supplier_payable_amount" =>
            $supplierPayableAmount
    ]);

    $deliveryId =
        (int)$conn->lastInsertId();

    
















    if ($restockRequestId) {
        if ($submissionSource !== "Supplier") {
            throw new Exception(
                "Only a Supplier delivery can be created from an Inventory restock request."
            );
        }

        if (
            !tableExists(
                $conn,
                "tbl_restock_request"
            )
        ) {
            throw new Exception(
                "The Inventory restock request table is missing."
            );
        }

        $currentStage =
            "Linking Inventory restock request to delivery";

        $restockStmt = $conn->prepare("
            SELECT
                restock_request_id,
                request_no,
                product_id,
                vendor_id,
                requested_quantity,
                status,
                delivery_id
            FROM tbl_restock_request
            WHERE restock_request_id = :restock_request_id
            LIMIT 1
            FOR UPDATE
        ");

        $restockStmt->execute([
            ":restock_request_id" =>
                $restockRequestId
        ]);

        $restockRequest =
            $restockStmt->fetch(PDO::FETCH_ASSOC);

        if (!$restockRequest) {
            throw new Exception(
                "The linked Inventory restock request was not found."
            );
        }

        if (
            (int)$restockRequest["vendor_id"] !==
            (int)$vendorId
        ) {
            throw new Exception(
                "The selected restock request does not belong to this Supplier."
            );
        }

        if (
            strcasecmp(
                trim(
                    (string)(
                        $restockRequest["status"] ?? ""
                    )
                ),
                "Pending Supplier"
            ) !== 0
        ) {
            throw new Exception(
                "This restock request has already been used or is no longer pending."
            );
        }

        if (
            !empty(
                $restockRequest["delivery_id"]
            )
        ) {
            throw new Exception(
                "This restock request is already linked to another delivery."
            );
        }

        




        $requestedProductId =
            (int)$restockRequest["product_id"];

        $containsRequestedProduct = false;

        foreach ($validItems as $validItem) {
            $validProductId = filter_var(
                $validItem["product_id"] ?? null,
                FILTER_VALIDATE_INT
            );

            if (
                $validProductId &&
                (int)$validProductId ===
                $requestedProductId
            ) {
                $containsRequestedProduct = true;
                break;
            }
        }

        if (!$containsRequestedProduct) {
            throw new Exception(
                "The delivery does not contain the product from the selected restock request."
            );
        }

        $linkRestockStmt = $conn->prepare("
            UPDATE tbl_restock_request
            SET
                status = 'Delivery Created',
                delivery_id = :delivery_id,
                updated_at = NOW()
            WHERE restock_request_id =
                  :restock_request_id
            AND vendor_id = :vendor_id
            AND status = 'Pending Supplier'
            AND delivery_id IS NULL
        ");

        $linkRestockStmt->execute([
            ":delivery_id" =>
                $deliveryId,

            ":restock_request_id" =>
                $restockRequestId,

            ":vendor_id" =>
                $vendorId
        ]);

        if (
            $linkRestockStmt->rowCount() !== 1
        ) {
            throw new Exception(
                "Unable to link the restock request to this delivery. Refresh and try again."
            );
        }
    }

    foreach ($validItems as $item) {
        $isNewProduct =
            !empty($item["is_new_product"]);

        if (
            $submissionSource === "Supplier" &&
            $isNewProduct
        ) {
            throw new Exception(
                "New products cannot be proposed inside Delivery Management. Submit the product through Product Proposals first and wait for BFATC approval before creating a delivery."
            );
        }

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


        





        if ($isNewProduct) {
            




            $productId =
                createInventoryProduct(
                    $conn,
                    $item,
                    $vendorId
                );
        } else {
            $productId = filter_var(
                $item["product_id"] ?? null,
                FILTER_VALIDATE_INT
            );

            if (!$productId) {
                throw new Exception(
                    "Please select an existing product or mark the item as a new product."
                );
            }
        }

        $product = getInventoryProduct(
            $conn,
            $productId
        );

        if (
            !empty(
                $product["vendor_id"]
            ) &&
            (string)$product["vendor_id"] !==
            (string)$vendorId
        ) {
            throw new Exception(
                "The selected product is not linked to the selected supplier."
            );
        }

        if ($supplierPrice <= 0) {
            $supplierPrice =
                (float)(
                    $product[
                        "supplier_price"
                    ] ?? 0
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

        if ($supplierPrice < 0) {
            throw new Exception(
                "Supplier price cannot be negative."
            );
        }

        






        if (
            $retailPrice <= 0 &&
            $status !== "Pending"
        ) {
            throw new Exception(
                "Retail price must be greater than zero."
            );
        }

        





        $currentStage =
            "Saving delivery item: " .
            (
                $product["product_name"] ??
                "Product"
            );

        insertDeliveryItem(
            $conn,
            $deliveryId,
            $product,
            $item,
            $vendorId,
            $quantity,
            $supplierPrice,
            $retailPrice,
            $expiryDate
        );

        



        if ($status === "Delivered") {
            $currentStage =
                "Creating separate inventory batch: " .
                (
                    $product[
                        "product_name"
                    ] ?? "Product"
                );

            addInventoryBatch(
                $conn,
                $productId,
                $quantity,
                $expiryDate,
                $supplierPrice,
                $deliveryId
            );

            $currentStage =
                "Updating inventory total: " .
                (
                    $product[
                        "product_name"
                    ] ?? "Product"
                );

            updateInventory(
                $conn,
                $productId,
                $quantity,
                $supplierPrice,
                $retailPrice,
                $expiryDate,
                $vendorId,
                $item
            );
        }
    }

    if (
        $submissionSource === "Supplier"
    ) {
        $currentStage =
            "Creating Admin delivery notifications";

        $supplier = getSupplier(
            $conn,
            $vendorId
        );

        notifyDeliveryReviewersOfSupplierDelivery(
            $conn,
            $deliveryId,
            $deliveryOrderNumber,
            (string)(
                $supplier[
                    "vendor_name"
                ] ?? "Supplier"
            ),
            $submittedByName,
            $itemsCount,
            $newProductProposalCount
        );
    }

    if ($status === "Delivered") {
        $currentStage = "Creating supplier payable";

        createSupplierPayable(
            $conn,
            $vendorId,
            $deliveryId,
            $supplierPayableAmount,
            $dueDate
        );
    }

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" =>
            $submissionSource === "Supplier"
                ? (
                    $newProductProposalCount > 0
                        ? "Delivery request submitted successfully. New product proposal details were saved for Admin review. Inventory will update only after approval and physical receiving."
                        : "Delivery request submitted successfully. An Admin has been notified for review."
                )
                : (
                    $status === "Delivered"
                        ? "Delivery saved successfully. Inventory and supplier payable were updated automatically."
                        : "Delivery saved successfully."
                ),

        "delivery_id" =>
            $deliveryId,

        "delivery_order_no" =>
            $deliveryOrderNumber,

        "submission_source" =>
            $submissionSource,

        "status" =>
            $status,

        "submitted_by_user_id" =>
            $submittedByUserId ?: null,

        "submitted_by_name" =>
            $submittedByName,

        "admin_notification_created" =>
            $submissionSource ===
                "Supplier",

        "new_product_proposals" =>
            $newProductProposalCount,

        "inventory_updated" =>
            $status === "Delivered",

        "awaiting_admin_review" =>
            $submissionSource ===
                "Supplier" &&
            $status === "Pending",

        "items_count" =>
            $itemsCount,

        "retail_amount" =>
            round($retailAmount, 2),

        "supplier_payable_amount" =>
            $status === "Delivered"
                ? round(
                    $supplierPayableAmount,
                    2
                )
                : 0,

        "payable_created" =>
            $status === "Delivered"
    ]);
} catch (Throwable $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "add_delivery.php [" .
        $currentStage .
        "]: " .
        $e->getMessage()
    );

    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" =>
            $currentStage .
            ": " .
            $e->getMessage()
    ]);
}