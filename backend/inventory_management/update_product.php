<?php
declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("inventory");
requireAnyRole(["Admin", "Staff"]);


function respond(bool $success, string $message, array $extra = [], int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode(array_merge([
        "success" => $success,
        "message" => $message
    ], $extra), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function normalizeName(string $value): string
{
    return trim(preg_replace("/\s+/", " ", $value));
}

function nullableInt($value): ?int
{
    if ($value === null || $value === "") return null;
    $n = filter_var($value, FILTER_VALIDATE_INT);
    return ($n === false || (int)$n <= 0) ? null : (int)$n;
}

function normalizeVariantUnit(string $value): string
{
    $value = strtolower(trim($value));
    $map = [
        "milliliter"=>"ml","milliliters"=>"ml","ml"=>"ml",
        "liter"=>"l","liters"=>"l","litre"=>"l","litres"=>"l","l"=>"l",
        "gram"=>"g","grams"=>"g","g"=>"g",
        "kilogram"=>"kg","kilograms"=>"kg","kg"=>"kg",
        "piece"=>"pcs","pieces"=>"pcs","pc"=>"pcs","pcs"=>"pcs",
        "pack"=>"pack","packs"=>"pack","set"=>"set","sets"=>"set"
    ];
    return $map[$value] ?? $value;
}

function variantLabel(?float $value, string $unit, string $custom): string
{
    $custom = normalizeName($custom);
    if ($custom !== "") return $custom;
    if ($value === null || $value <= 0) return "Standard";
    $formatted = abs($value - round($value)) < 0.000001
        ? (string)(int)round($value)
        : rtrim(rtrim(number_format($value, 3, ".", ""), "0"), ".");
    return $unit !== "" ? $formatted . " " . $unit : $formatted;
}

function categoryAllowsExpiry(string $name): bool
{
    return !in_array(strtolower(trim($name)), [
        "handicrafts", "souvenirs", "novelty", "novelty products"
    ], true);
}

function categoryRequiresExpiry(string $name): bool
{
    return in_array(strtolower(trim($name)), [
        "organic produce", "fresh harvest", "local delicacies"
    ], true);
}

function allowedUnits(string $name): array
{
    switch (strtolower(trim($name))) {
        case "organic produce":
        case "fresh harvest":
            return ["pcs","kg","g","bag","bundle","crate","tray"];
        case "beverages":
            return ["bottle","can","ml","liter","pack","case"];
        case "honey products":
            return ["jar","bottle","ml","liter","g","kg","pack","box"];
        case "processed goods":
            return ["pcs","pack","box","bottle","jar","can","bag","g","kg","ml"];
        case "local delicacies":
            return ["pcs","pack","box","tray","bag","g","kg"];
        case "handicrafts":
        case "souvenirs":
        case "novelty":
        case "novelty products":
            return ["pcs","set","box","pack"];
        default:
            return ["pcs","pack","box","set"];
    }
}

function saveImage(array $file, string $dir): string
{
    if (!isset($file["error"]) || $file["error"] === UPLOAD_ERR_NO_FILE) return "";
    if ($file["error"] !== UPLOAD_ERR_OK) throw new RuntimeException("The product image could not be uploaded.");
    if ((int)$file["size"] > 5 * 1024 * 1024) throw new RuntimeException("Product image must not exceed 5 MB.");

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file["tmp_name"]);
    $types = ["image/jpeg"=>"jpg","image/png"=>"png","image/webp"=>"webp"];
    if (!isset($types[$mime])) throw new RuntimeException("Only JPG, PNG, and WEBP images are allowed.");

    if (!is_dir($dir) && !mkdir($dir, 0777, true) && !is_dir($dir)) {
        throw new RuntimeException("Unable to create the product upload directory.");
    }

    $name = "product_" . date("YmdHis") . "_" . bin2hex(random_bytes(6)) . "." . $types[$mime];
    if (!move_uploaded_file($file["tmp_name"], $dir . $name)) {
        throw new RuntimeException("Unable to save the product image.");
    }
    return $name;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(false, "Method not allowed.", [], 405);
}

requireCsrfToken();

$productId = filter_var($_POST["product_id"] ?? null, FILTER_VALIDATE_INT);
$productName = normalizeName((string)($_POST["product_name"] ?? ""));
$sku = strtoupper(trim((string)($_POST["sku"] ?? "")));
$categoryId = filter_var($_POST["category_id"] ?? null, FILTER_VALIDATE_INT);
$vendorId = filter_var($_POST["vendor_id"] ?? null, FILTER_VALIDATE_INT);
$unitType = strtolower(trim((string)($_POST["unit_type"] ?? "pcs")));
$reorderLevel = max(0, (int)($_POST["reorder_level"] ?? 0));
$supplierPrice = max(0, (float)($_POST["supplier_price"] ?? 0));
$sellingPrice = max(0, (float)($_POST["selling_price"] ?? 0));
$expiryDate = trim((string)($_POST["expiry_date"] ?? ""));
$familyInput = nullableInt($_POST["family_id"] ?? null);
$requestVariantId = nullableInt($_POST["request_variant_id"] ?? null);
$variantValueRaw = trim((string)($_POST["variant_value"] ?? ""));
$variantValue = $variantValueRaw === "" ? null : (is_numeric($variantValueRaw) ? (float)$variantValueRaw : -1);
$variantUnit = normalizeVariantUnit((string)($_POST["variant_unit"] ?? ""));
$variantSort = max(0, (int)($_POST["variant_sort"] ?? 0));
$variantLabel = variantLabel($variantValue, $variantUnit, (string)($_POST["variant_label"] ?? ""));

if (!$productId) respond(false, "A valid product ID is required.", [], 422);
if ($productName === "") respond(false, "Product name is required.", [], 422);
if ($sku === "") respond(false, "SKU is required when editing an existing product.", [], 422);
if (!$categoryId || !$vendorId) respond(false, "Category and supplier are required.", [], 422);
if ($sellingPrice <= 0) respond(false, "Selling price must be greater than zero.", [], 422);
if ($variantValue !== null && $variantValue <= 0) respond(false, "Variant value must be greater than zero.", [], 422);
if ($variantValue !== null && $variantUnit === "") respond(false, "Select a unit for the product variant.", [], 422);

try {
    $stmt = $conn->prepare("SELECT * FROM tbl_inv WHERE product_id=? LIMIT 1");
    $stmt->execute([$productId]);
    $current = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$current) respond(false, "Product record was not found.", [], 404);
    if (($current["status"] ?? "") === "Archived") respond(false, "Archived products cannot be edited.", [], 409);

    $familyId = (int)(($current["family_id"] ?? null) ?: $current["product_id"]);
    if ($familyInput !== null && $familyInput !== $familyId) {
        respond(false, "Moving an existing inventory variant to another product family is not allowed from Edit Product.", [], 409);
    }

    $stmt = $conn->prepare("SELECT category_name FROM tbl_category WHERE category_id=? LIMIT 1");
    $stmt->execute([$categoryId]);
    $categoryName = (string)($stmt->fetchColumn() ?: "");
    if ($categoryName === "") respond(false, "The selected category does not exist.", [], 422);

    $stmt = $conn->prepare("SELECT vendor_id FROM tbl_vendor WHERE vendor_id=? AND COALESCE(status,'Active')<>'Archived' LIMIT 1");
    $stmt->execute([$vendorId]);
    if (!$stmt->fetchColumn()) respond(false, "The selected supplier is unavailable.", [], 422);

    $categoryAllowedUnits = allowedUnits($categoryName);

    if (!in_array($unitType, $categoryAllowedUnits, true)) {
        respond(false, "The selected stock unit is not valid for this category.", [
            "allowed_units" => $categoryAllowedUnits
        ], 422);
    }

    if (!categoryAllowsExpiry($categoryName)) $expiryDate = "";
    if (categoryRequiresExpiry($categoryName) && $expiryDate === "") {
        respond(false, "Expiry date is required for this product category.", [], 422);
    }
    if ($expiryDate !== "" && $expiryDate < date("Y-m-d")) {
        respond(false, "Expiry date cannot be in the past.", [], 422);
    }

    $stmt = $conn->prepare("SELECT product_id FROM tbl_inv WHERE UPPER(TRIM(sku))=UPPER(TRIM(?)) AND product_id<>? LIMIT 1");
    $stmt->execute([$sku, $productId]);
    if ($stmt->fetch()) respond(false, "SKU already belongs to another product variant.", [], 409);

    $stmt = $conn->prepare("
        SELECT product_id,sku,variant_label
        FROM tbl_inv
        WHERE (family_id=? OR product_id=?)
          AND product_id<>?
          AND LOWER(TRIM(COALESCE(variant_label,'Standard')))=LOWER(TRIM(?))
          AND COALESCE(status,'In Stock')<>'Archived'
        LIMIT 1
    ");
    $stmt->execute([$familyId, $familyId, $productId, $variantLabel]);
    if ($stmt->fetch(PDO::FETCH_ASSOC)) {
        respond(false, "This size / variant already exists in the product family.", [], 409);
    }

    if ($variantSort <= 0) {
        $variantSort = max(1, (int)($current["variant_sort"] ?? 1));
    }

    $productImage = (string)($current["product_image"] ?? "");
    if (isset($_FILES["product_image"])) {
        $newImage = saveImage($_FILES["product_image"], dirname(__DIR__) . "/uploads/products/");
        if ($newImage !== "") $productImage = $newImage;
    }

    $quantity = (int)($current["quantity"] ?? 0);
    $status = $quantity <= 0 ? "Out of Stock" : ($quantity <= $reorderLevel ? "Low Stock" : "In Stock");

    if ($requestVariantId === null && ($current["request_variant_id"] ?? null) !== null) {
        $requestVariantId = (int)$current["request_variant_id"];
    }

    $conn->beginTransaction();

    $stmt = $conn->prepare("
        UPDATE tbl_inv SET
            family_id=?,
            request_variant_id=?,
            product_name=?,
            variant_label=?,
            variant_value=?,
            variant_unit=?,
            variant_sort=?,
            sku=?,
            category_id=?,
            category=?,
            unit_type=?,
            unit=?,
            reorder_level=?,
            supplier_price=?,
            selling_price=?,
            expiry_date=?,
            product_image=?,
            vendor_id=?,
            status=?,
            updated_at=NOW()
        WHERE product_id=?
    ");

    $stmt->execute([
        $familyId,
        $requestVariantId,
        $productName,
        $variantLabel,
        $variantValue,
        $variantUnit !== "" ? $variantUnit : null,
        $variantSort,
        $sku,
        $categoryId,
        $categoryName,
        $unitType,
        $unitType,
        $reorderLevel,
        $supplierPrice,
        $sellingPrice,
        $expiryDate !== "" ? $expiryDate : null,
        $productImage,
        $vendorId,
        $status,
        $productId
    ]);

    $conn->commit();

    respond(true, "Product variant updated successfully. Current stock was preserved.", [
        "product_id"=>$productId,
        "family_id"=>$familyId,
        "product_name"=>$productName,
        "sku"=>$sku,
        "variant_label"=>$variantLabel,
        "variant_value"=>$variantValue,
        "variant_unit"=>$variantUnit !== "" ? $variantUnit : null,
        "quantity"=>$quantity,
        "status"=>$status
    ]);

} catch (Throwable $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    error_log("HiveSync update_product.php: " . $e->getMessage());
    respond(false, "Unable to update the product information.", ["error"=>$e->getMessage()], 500);
}