<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../helpers/expiry_processor.php");
require_once("../auth/auth_guard.php");

requireAuthentication();

$modulePermissions = $_SESSION["module_permissions"] ?? [];

if (!is_array($modulePermissions)) {
    $modulePermissions = [];
}

$hasLandingPermission = in_array("landing", $modulePermissions, true);
$hasPosPermission = in_array("pos", $modulePermissions, true);
$hasInventoryPermission = in_array("inventory", $modulePermissions, true);

if (
    !$hasLandingPermission &&
    !$hasPosPermission &&
    !$hasInventoryPermission
) {
    authRespond(
        false,
        "You do not have permission to access this resource.",
        403
    );
}

$landingCatalogOnly =
    $hasLandingPermission &&
    !$hasPosPermission &&
    !$hasInventoryPermission;


function tableExists(PDO $conn, string $tableName): bool
{
    



    static $cache = [];

    $cacheKey = strtolower(trim($tableName));

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
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

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function columnExists(PDO $conn, string $tableName, string $columnName): bool
{
    



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

function normalizeVariantLabel(array $product): string
{
    $label = trim((string)($product["variant_label"] ?? ""));
    if ($label !== "") {
        return $label;
    }

    $value = $product["variant_value"] ?? null;
    $unit = trim((string)($product["variant_unit"] ?? ""));

    if ($value !== null && $value !== "" && (float)$value > 0) {
        $numeric = (float)$value;

        $formatted =
            abs($numeric - round($numeric)) < 0.000001
                ? (string)(int)round($numeric)
                : rtrim(
                    rtrim(
                        number_format($numeric, 3, ".", ""),
                        "0"
                    ),
                    "."
                );

        return $unit !== ""
            ? $formatted . " " . $unit
            : $formatted;
    }

    return "Standard";
}

$role = trim((string)($_SESSION["role"] ?? ""));
$vendorId = (int)($_SESSION["vendor_id"] ?? 0);

$isSupplierRole = in_array(
    $role,
    ["Supplier", "Vendor"],
    true
);

if ($isSupplierRole && !$vendorId) {
    echo json_encode([
        "success" => true,
        "products" => [],
        "families" => [],
        "summary" => [
            "total_products" => 0,
            "total_families" => 0,
            "in_stock" => 0,
            "low_stock" => 0,
            "out_of_stock" => 0,
            "consignment_products" => 0,
            "near_expiry" => 0
        ]
    ]);
    exit;
}

try {
    processExpiredInventoryBatches($conn);

    $hasConsignmentColumns = columnExists(
        $conn,
        "tbl_inv",
        "is_consignment"
    );

    $hasBatchTable = tableExists(
        $conn,
        "tbl_inventory_batches"
    );

    $batchQuantityColumn =
        $hasBatchTable &&
        columnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        )
            ? "remaining_quantity"
            : "quantity";

    $hasPayableTable = tableExists(
        $conn,
        "tbl_supplier_payable"
    );

    $hasFamilyId = columnExists($conn, "tbl_inv", "family_id");
    $hasRequestVariantId = columnExists($conn, "tbl_inv", "request_variant_id");
    $hasVariantLabel = columnExists($conn, "tbl_inv", "variant_label");
    $hasVariantValue = columnExists($conn, "tbl_inv", "variant_value");
    $hasVariantUnit = columnExists($conn, "tbl_inv", "variant_unit");
    $hasVariantSort = columnExists($conn, "tbl_inv", "variant_sort");
    $hasPublicationStatus = columnExists($conn, "tbl_inv", "publication_status");

    $variantSelect =
        ($hasFamilyId ? "i.family_id," : "i.product_id AS family_id,") .
        ($hasRequestVariantId ? "i.request_variant_id," : "NULL AS request_variant_id,") .
        ($hasVariantLabel ? "i.variant_label," : "NULL AS variant_label,") .
        ($hasVariantValue ? "i.variant_value," : "NULL AS variant_value,") .
        ($hasVariantUnit ? "i.variant_unit," : "NULL AS variant_unit,") .
        ($hasVariantSort ? "i.variant_sort," : "0 AS variant_sort,") .
        ($hasPublicationStatus ? "i.publication_status," : "'Published' AS publication_status,");

    $consignmentSelect = $hasConsignmentColumns
        ? "
            i.is_consignment,
            i.consignment_terms,
            i.consignment_start_date,
            i.consignment_pullout_date,
            i.consignment_notes,
          "
        : "
            0 AS is_consignment,
            NULL AS consignment_terms,
            NULL AS consignment_start_date,
            NULL AS consignment_pullout_date,
            NULL AS consignment_notes,
          ";

    $batchSelect = $hasBatchTable
        ? "
            COALESCE(batch_summary.batch_count, 0) AS batch_count,
            batch_summary.nearest_expiry_date,
            COALESCE(batch_summary.batch_quantity, 0) AS batch_quantity,
            COALESCE(batch_summary.sellable_quantity, 0) AS sellable_quantity,
            COALESCE(batch_summary.expired_quantity, 0) AS expired_quantity,
            COALESCE(batch_summary.expired_batch_count, 0) AS expired_batch_count,
          "
        : "
            0 AS batch_count,
            NULL AS nearest_expiry_date,
            0 AS batch_quantity,
            COALESCE(i.quantity, 0) AS sellable_quantity,
            0 AS expired_quantity,
            0 AS expired_batch_count,
          ";

    $batchJoin = $hasBatchTable
        ? "
            LEFT JOIN (
                SELECT
                    product_id,
                    COUNT(batch_id) AS batch_count,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN {$batchQuantityColumn} > 0
                                THEN {$batchQuantityColumn}
                                ELSE 0
                            END
                        ),
                        0
                    ) AS batch_quantity,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN {$batchQuantityColumn} > 0
                                AND (
                                    expiry_date IS NULL
                                    OR expiry_date > CURDATE()
                                )
                                THEN {$batchQuantityColumn}
                                ELSE 0
                            END
                        ),
                        0
                    ) AS sellable_quantity,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN {$batchQuantityColumn} > 0
                                AND expiry_date IS NOT NULL
                                AND expiry_date <= CURDATE()
                                THEN {$batchQuantityColumn}
                                ELSE 0
                            END
                        ),
                        0
                    ) AS expired_quantity,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN {$batchQuantityColumn} > 0
                                AND expiry_date IS NOT NULL
                                AND expiry_date <= CURDATE()
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS expired_batch_count,
                    MIN(
                        CASE
                            WHEN {$batchQuantityColumn} > 0
                            AND expiry_date IS NOT NULL
                            AND expiry_date > CURDATE()
                            THEN expiry_date
                            ELSE NULL
                        END
                    ) AS nearest_expiry_date
                FROM tbl_inventory_batches
                GROUP BY product_id
            ) batch_summary
                ON batch_summary.product_id = i.product_id
          "
        : "";

    $payableSelect = $hasPayableTable
        ? "
            COALESCE(payable_summary.total_payable, 0) AS supplier_total_payable,
            COALESCE(payable_summary.total_paid, 0) AS supplier_total_paid,
            COALESCE(payable_summary.total_balance, 0) AS supplier_total_balance,
          "
        : "
            0 AS supplier_total_payable,
            0 AS supplier_total_paid,
            0 AS supplier_total_balance,
          ";

    $payableJoin = $hasPayableTable
        ? "
            LEFT JOIN (
                SELECT
                    vendor_id,
                    SUM(payable_amount) AS total_payable,
                    SUM(paid_amount) AS total_paid,
                    SUM(balance_amount) AS total_balance
                FROM tbl_supplier_payable
                WHERE payment_status <> 'Cancelled'
                GROUP BY vendor_id
            ) payable_summary
                ON payable_summary.vendor_id = i.vendor_id
          "
        : "";

    $whereClauses = [
        "COALESCE(i.status, 'In Stock') <> 'Archived'"
    ];

    $params = [];

    if ($isSupplierRole) {
        $whereClauses[] = "i.vendor_id = :vendor_id";
        $params[":vendor_id"] = $vendorId;
    }

    $whereSql = implode(" AND ", $whereClauses);

    $orderVariantSort = $hasVariantSort
        ? "COALESCE(i.variant_sort, 0)"
        : "i.product_id";

    $stmt = $conn->prepare("
        SELECT
            i.product_id,

            {$variantSelect}

            i.product_name,
            i.sku,
            i.category_id,

            COALESCE(
                c.category_name,
                i.category,
                'Uncategorized'
            ) AS category_name,

            COALESCE(
                c.category_name,
                i.category,
                'Uncategorized'
            ) AS category,

            i.quantity,
            i.unit_type,
            i.unit,
            i.reorder_level,
            i.supplier_price,
            i.selling_price,
            i.selling_price AS unit_price,
            i.expiry_date,
            i.product_image,
            i.vendor_id,

            COALESCE(
                v.vendor_name,
                'No supplier'
            ) AS vendor_name,

            v.contact_person AS supplier_contact_person,
            v.phone AS supplier_phone,
            v.address AS supplier_address,

            i.status,

            {$consignmentSelect}
            {$batchSelect}
            {$payableSelect}

            COALESCE(
                delivery_summary.delivery_count,
                0
            ) AS delivery_count,

            COALESCE(
                delivery_summary.total_delivered_quantity,
                0
            ) AS total_delivered_quantity,

            delivery_summary.last_delivery_date,

            COALESCE(
                sales_summary.total_sold,
                0
            ) AS total_sold,

            COALESCE(
                sales_summary.total_sales_value,
                0
            ) AS total_sales_value,

            i.created_at,
            i.updated_at

        FROM tbl_inv i

        LEFT JOIN tbl_category c
            ON c.category_id = i.category_id

        LEFT JOIN tbl_vendor v
            ON v.vendor_id = i.vendor_id

        {$batchJoin}
        {$payableJoin}

        LEFT JOIN (
            SELECT
                inv.product_id,

                COUNT(
                    DISTINCT di.delivery_id
                ) AS delivery_count,

                COALESCE(
                    SUM(di.quantity),
                    0
                ) AS total_delivered_quantity,

                MAX(d.delivery_date)
                    AS last_delivery_date

            FROM tbl_inv inv

            INNER JOIN tbl_delivery_items di
                ON (
                    di.product_id = inv.product_id

                    OR (
                        NULLIF(TRIM(inv.sku), '') IS NOT NULL
                        AND NULLIF(TRIM(di.sku), '') IS NOT NULL
                        AND LOWER(TRIM(di.sku)) =
                            LOWER(TRIM(inv.sku))
                    )
                )

            INNER JOIN tbl_delivery d
                ON d.delivery_id = di.delivery_id

            WHERE COALESCE(
                d.status,
                'Pending'
            ) <> 'Archived'

            GROUP BY inv.product_id
        ) delivery_summary
            ON delivery_summary.product_id = i.product_id

        LEFT JOIN (
            SELECT
                pi.product_id,
                SUM(pi.quantity) AS total_sold,
                SUM(pi.subtotal) AS total_sales_value
            FROM tbl_pos_items pi
            GROUP BY pi.product_id
        ) sales_summary
            ON sales_summary.product_id = i.product_id

        WHERE {$whereSql}

        ORDER BY
            i.product_name ASC,
            {$orderVariantSort} ASC,
            i.product_id ASC
    ");

    foreach ($params as $key => $value) {
        $stmt->bindValue(
            $key,
            $value,
            PDO::PARAM_INT
        );
    }

    $stmt->execute();
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $summary = [
        "total_products" => count($products),
        "total_families" => 0,
        "in_stock" => 0,
        "low_stock" => 0,
        "out_of_stock" => 0,
        "consignment_products" => 0,
        "near_expiry" => 0
    ];

    $today = new DateTime();
    $nearExpiryLimit = (clone $today)->modify("+10 days");
    $families = [];

    foreach ($products as &$product) {
        $product["product_id"] =
            (int)$product["product_id"];

        $product["family_id"] =
            (int)(
                $product["family_id"]
                ?: $product["product_id"]
            );

        $product["request_variant_id"] =
            $product["request_variant_id"] !== null
                ? (int)$product["request_variant_id"]
                : null;

        $product["variant_value"] =
            $product["variant_value"] !== null
                ? (float)$product["variant_value"]
                : null;

        $product["variant_sort"] =
            (int)($product["variant_sort"] ?? 0);

        $product["quantity"] =
            (int)($product["quantity"] ?? 0);

        $product["reorder_level"] =
            (int)($product["reorder_level"] ?? 0);

        $product["supplier_price"] =
            (float)($product["supplier_price"] ?? 0);

        $product["selling_price"] =
            (float)($product["selling_price"] ?? 0);

        $product["unit_price"] =
            (float)($product["unit_price"] ?? 0);

        $product["delivery_count"] =
            (int)($product["delivery_count"] ?? 0);

        $product["total_delivered_quantity"] =
            (int)($product["total_delivered_quantity"] ?? 0);

        $product["total_sold"] =
            (int)($product["total_sold"] ?? 0);

        $product["total_sales_value"] =
            (float)($product["total_sales_value"] ?? 0);

        $product["batch_count"] =
            (int)($product["batch_count"] ?? 0);

        $product["batch_quantity"] =
            (int)($product["batch_quantity"] ?? 0);

        $product["sellable_quantity"] =
            (int)($product["sellable_quantity"] ?? $product["quantity"]);

        $product["expired_quantity"] =
            (int)($product["expired_quantity"] ?? 0);

        $product["expired_batch_count"] =
            (int)($product["expired_batch_count"] ?? 0);

        $product["has_expired_stock"] =
            $product["expired_quantity"] > 0;

        $product["is_consignment"] =
            (int)($product["is_consignment"] ?? 0);

        $product["variant_label"] =
            normalizeVariantLabel($product);

        $product["display_name"] =
            $product["variant_label"] !== "Standard"
                ? trim(
                    $product["product_name"] .
                    " - " .
                    $product["variant_label"]
                )
                : (string)$product["product_name"];

        $quantity =
            $product["quantity"];

        $availableQuantity =
            $product["sellable_quantity"];

        $reorderLevel =
            $product["reorder_level"];

        if ($availableQuantity <= 0) {
            $product["computed_status"] =
                "Out of Stock";
            $summary["out_of_stock"]++;

        } elseif (
            $availableQuantity <= $reorderLevel
        ) {
            $product["computed_status"] =
                "Low Stock";
            $summary["low_stock"]++;

        } else {
            $product["computed_status"] =
                "In Stock";
            $summary["in_stock"]++;
        }

        if (
            $product["is_consignment"] === 1
        ) {
            $summary["consignment_products"]++;
        }

        $expiryValue =
            $product["nearest_expiry_date"]
            ?: $product["expiry_date"];

        if ($expiryValue) {
            try {
                $expiryDate =
                    new DateTime($expiryValue);

                if (
                    $expiryDate > $today &&
                    $expiryDate <= $nearExpiryLimit
                ) {
                    $summary["near_expiry"]++;
                }
            } catch (Exception $ignored) {
            }
        }

        $familyKey =
            (string)$product["family_id"];

        if (!isset($families[$familyKey])) {
            $families[$familyKey] = [
                "family_id" =>
                    $product["family_id"],

                "product_name" =>
                    $product["product_name"],

                "category_id" =>
                    (int)$product["category_id"],

                "category_name" =>
                    $product["category_name"],

                "vendor_id" =>
                    (int)$product["vendor_id"],

                "vendor_name" =>
                    $product["vendor_name"],

                "variant_count" => 0,
                "total_stock" => 0,
                "available_variant_count" => 0,
                "variants" => []
            ];
        }

        $families[$familyKey]["variant_count"]++;

        $families[$familyKey]["total_stock"] +=
            $product["quantity"];

        if ($product["sellable_quantity"] > 0) {
            $families[$familyKey]["available_variant_count"]++;
        }

        $families[$familyKey]["variants"][] = [
            "product_id" =>
                $product["product_id"],

            "sku" =>
                $product["sku"],

            "variant_label" =>
                $product["variant_label"],

            "variant_value" =>
                $product["variant_value"],

            "variant_unit" =>
                $product["variant_unit"],

            "variant_sort" =>
                $product["variant_sort"],

            "stock_unit" =>
                $product["unit_type"],

            "quantity" =>
                $product["quantity"],

            "sellable_quantity" =>
                $product["sellable_quantity"],

            "expired_quantity" =>
                $product["expired_quantity"],

            "has_expired_stock" =>
                $product["has_expired_stock"],

            "supplier_price" =>
                $product["supplier_price"],

            "selling_price" =>
                $product["selling_price"],

            "computed_status" =>
                $product["computed_status"],

            "expiry_date" =>
                $product["expiry_date"],

            "nearest_expiry_date" =>
                $product["nearest_expiry_date"],

            "publication_status" =>
                $product["publication_status"]
        ];
    }

    unset($product);

    $families =
        array_values($families);

    foreach ($families as &$family) {
        usort(
            $family["variants"],
            function (array $a, array $b): int {
                $aSort =
                    (int)($a["variant_sort"] ?? 0);

                $bSort =
                    (int)($b["variant_sort"] ?? 0);

                if ($aSort !== $bSort) {
                    return $aSort <=> $bSort;
                }

                $aValue =
                    $a["variant_value"];

                $bValue =
                    $b["variant_value"];

                if (
                    $aValue !== null &&
                    $bValue !== null &&
                    (float)$aValue !== (float)$bValue
                ) {
                    return
                        (float)$aValue <=>
                        (float)$bValue;
                }

                return strcmp(
                    (string)$a["variant_label"],
                    (string)$b["variant_label"]
                );
            }
        );
    }

    unset($family);

    $summary["total_families"] =
        count($families);

    if ($landingCatalogOnly) {
        $products = array_map(
            static function (array $product): array {
                return [
                    "product_id" => $product["product_id"],
                    "family_id" => $product["family_id"],
                    "request_variant_id" => $product["request_variant_id"],
                    "variant_label" => $product["variant_label"],
                    "variant_value" => $product["variant_value"],
                    "variant_unit" => $product["variant_unit"],
                    "variant_sort" => $product["variant_sort"],
                    "publication_status" => $product["publication_status"],
                    "product_name" => $product["product_name"],
                    "display_name" => $product["display_name"],
                    "sku" => $product["sku"],
                    "category_id" => $product["category_id"],
                    "category_name" => $product["category_name"],
                    "category" => $product["category"],
                    "unit_type" => $product["unit_type"],
                    "unit" => $product["unit"],
                    "selling_price" => $product["selling_price"],
                    "unit_price" => $product["unit_price"],
                    "product_image" => $product["product_image"],
                    "vendor_id" => $product["vendor_id"],
                    "vendor_name" => $product["vendor_name"],
                    "computed_status" => $product["computed_status"],
                    "available_stock" => $product["sellable_quantity"],
                    "quantity" => $product["sellable_quantity"]
                ];
            },
            $products
        );

        $families = [];
    }

    echo json_encode(
        [
            "success" => true,
            "products" => $products,
            "families" => $families,
            "summary" => $summary,
            "generated_at" => date("Y-m-d H:i:s")
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );

} catch (Throwable $error) {
    http_response_code(500);

    error_log(
        "HiveSync get_products.php: " .
        $error->getMessage()
    );

    echo json_encode(
        [
            "success" => false,
            "message" =>
                "Failed to load inventory products.",
            "error" =>
                $error->getMessage(),
            "products" => [],
            "families" => [],
            "summary" => [
                "total_products" => 0,
                "total_families" => 0,
                "in_stock" => 0,
                "low_stock" => 0,
                "out_of_stock" => 0,
                "consignment_products" => 0,
                "near_expiry" => 0
            ]
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );
}