<?php

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireAuthentication();

$modulePermissions = $_SESSION["module_permissions"] ?? [];

if (!is_array($modulePermissions)) {
    $modulePermissions = [];
}

$hasLandingPermission = in_array("landing", $modulePermissions, true);
$hasInventoryPermission = in_array("inventory", $modulePermissions, true);

if (!$hasLandingPermission && !$hasInventoryPermission) {
    authRespond(
        false,
        "You do not have permission to access this resource.",
        403
    );
}

$landingCatalogOnly =
    $hasLandingPermission &&
    !$hasInventoryPermission;

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

function tableExists(
    PDO $conn,
    string $tableName
): bool {
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

function buildProductImageUrl(?string $image): string
{
    $image = trim((string)$image);

    if ($image === "") {
        return "";
    }

    if (
        str_starts_with($image, "http://") ||
        str_starts_with($image, "https://")
    ) {
        return $image;
    }

    $baseUrl =
        "http://localhost/HiveSync/backend/";

    if (str_starts_with($image, "uploads/")) {
        return $baseUrl . $image;
    }

    if (str_starts_with($image, "products/")) {
        return $baseUrl . "uploads/" . $image;
    }

    return $baseUrl .
        "uploads/products/" .
        $image;
}

$productId = filter_var(
    $_GET["product_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$productId) {
    respond(
        false,
        "A valid product ID is required.",
        [],
        422
    );
}

try {
    $hasCategoryTable = tableExists(
        $conn,
        "tbl_category"
    );

    $hasVendorTable = tableExists(
        $conn,
        "tbl_vendor"
    );

    $hasDeliveryTable = tableExists(
        $conn,
        "tbl_delivery"
    );

    $hasDeliveryItemsTable = tableExists(
        $conn,
        "tbl_delivery_items"
    );

    $hasBatchTable = tableExists(
        $conn,
        "tbl_inventory_batches"
    );

    $hasPosTable = tableExists(
        $conn,
        "tbl_pos"
    );

    $hasPosItemsTable = tableExists(
        $conn,
        "tbl_pos_items"
    );

    $hasInventoryHistoryTable = tableExists(
        $conn,
        "tbl_inventory_history"
    );

    $hasSupplierPayableTable = tableExists(
        $conn,
        "tbl_supplier_payable"
    );

    $hasRemainingQuantity =
        $hasBatchTable &&
        columnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        );

    $hasConsignmentColumns = columnExists(
        $conn,
        "tbl_inv",
        "is_consignment"
    );

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

    $categorySelect = $hasCategoryTable
        ? "
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
          "
        : "
            COALESCE(
                i.category,
                'Uncategorized'
            ) AS category_name,

            COALESCE(
                i.category,
                'Uncategorized'
            ) AS category,
          ";

    $categoryJoin = $hasCategoryTable
        ? "
            LEFT JOIN tbl_category c
                ON c.category_id = i.category_id
          "
        : "";

    $supplierSelect = $hasVendorTable
        ? "
            COALESCE(
                v.vendor_name,
                'No supplier'
            ) AS vendor_name,

            v.contact_person
                AS supplier_contact_person,

            v.phone
                AS supplier_phone,

            v.address
                AS supplier_address,
          "
        : "
            'No supplier'
                AS vendor_name,

            NULL
                AS supplier_contact_person,

            NULL
                AS supplier_phone,

            NULL
                AS supplier_address,
          ";

    $supplierJoin = $hasVendorTable
        ? "
            LEFT JOIN tbl_vendor v
                ON v.vendor_id = i.vendor_id
          "
        : "";

    $deliverySummarySelect =
        $hasDeliveryTable &&
        $hasDeliveryItemsTable
            ? "
                COALESCE(
                    delivery_summary.delivery_count,
                    0
                ) AS delivery_count,

                COALESCE(
                    delivery_summary.total_delivered_quantity,
                    0
                ) AS total_delivered_quantity,

                delivery_summary.last_delivery_date,
              "
            : "
                0 AS delivery_count,
                0 AS total_delivered_quantity,
                NULL AS last_delivery_date,
              ";

    $deliverySummaryJoin =
        $hasDeliveryTable &&
        $hasDeliveryItemsTable
            ? "
                LEFT JOIN (
                    SELECT
                        di.product_id,

                        COUNT(
                            DISTINCT di.delivery_id
                        ) AS delivery_count,

                        COALESCE(
                            SUM(di.quantity),
                            0
                        ) AS total_delivered_quantity,

                        MAX(d.delivery_date)
                            AS last_delivery_date

                    FROM tbl_delivery_items di

                    INNER JOIN tbl_delivery d
                        ON d.delivery_id =
                           di.delivery_id

                    WHERE COALESCE(
                        d.status,
                        'Pending'
                    ) <> 'Archived'

                    GROUP BY
                        di.product_id
                ) delivery_summary
                    ON delivery_summary.product_id =
                       i.product_id
              "
            : "";

    $salesSummarySelect =
        $hasPosItemsTable
            ? "
                COALESCE(
                    sales_summary.total_sold,
                    0
                ) AS total_sold,

                COALESCE(
                    sales_summary.total_sales_value,
                    0
                ) AS total_sales_value,
              "
            : "
                0 AS total_sold,
                0 AS total_sales_value,
              ";

    $salesSummaryJoin =
        $hasPosItemsTable
            ? "
                LEFT JOIN (
                    SELECT
                        pi.product_id,

                        COALESCE(
                            SUM(pi.quantity),
                            0
                        ) AS total_sold,

                        COALESCE(
                            SUM(pi.subtotal),
                            0
                        ) AS total_sales_value

                    FROM tbl_pos_items pi

                    GROUP BY
                        pi.product_id
                ) sales_summary
                    ON sales_summary.product_id =
                       i.product_id
              "
            : "";

    $batchQuantityColumn =
        $hasRemainingQuantity
            ? "b.remaining_quantity"
            : "b.quantity";

    $batchSummarySelect =
        $hasBatchTable
            ? "
                COALESCE(
                    batch_summary.batch_count,
                    0
                ) AS batch_count,

                COALESCE(
                    batch_summary.active_batch_count,
                    0
                ) AS active_batch_count,

                COALESCE(
                    batch_summary.batch_stock,
                    0
                ) AS batch_stock,

                batch_summary.nearest_expiry_date,
              "
            : "
                0 AS batch_count,
                0 AS active_batch_count,
                0 AS batch_stock,
                NULL AS nearest_expiry_date,
              ";

    $batchSummaryJoin =
        $hasBatchTable
            ? "
                LEFT JOIN (
                    SELECT
                        b.product_id,

                        COUNT(b.batch_id)
                            AS batch_count,

                        SUM(
                            CASE
                                WHEN {$batchQuantityColumn} > 0
                                AND (
                                    b.expiry_date IS NULL
                                    OR b.expiry_date > CURDATE()
                                )
                                THEN 1
                                ELSE 0
                            END
                        ) AS active_batch_count,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN {$batchQuantityColumn} > 0
                                    THEN {$batchQuantityColumn}
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS batch_stock,

                        MIN(
                            CASE
                                WHEN {$batchQuantityColumn} > 0
                                AND b.expiry_date > CURDATE()
                                THEN b.expiry_date
                                ELSE NULL
                            END
                        ) AS nearest_expiry_date

                    FROM tbl_inventory_batches b

                    GROUP BY
                        b.product_id
                ) batch_summary
                    ON batch_summary.product_id =
                       i.product_id
              "
            : "";

    $payableSummarySelect =
        $hasSupplierPayableTable
            ? "
                COALESCE(
                    payable_summary.total_payable,
                    0
                ) AS supplier_total_payable,

                COALESCE(
                    payable_summary.total_paid,
                    0
                ) AS supplier_total_paid,

                COALESCE(
                    payable_summary.total_balance,
                    0
                ) AS supplier_total_balance,
              "
            : "
                0 AS supplier_total_payable,
                0 AS supplier_total_paid,
                0 AS supplier_total_balance,
              ";

    $payableSummaryJoin =
        $hasSupplierPayableTable
            ? "
                LEFT JOIN (
                    SELECT
                        sp.vendor_id,

                        COALESCE(
                            SUM(sp.payable_amount),
                            0
                        ) AS total_payable,

                        COALESCE(
                            SUM(sp.paid_amount),
                            0
                        ) AS total_paid,

                        COALESCE(
                            SUM(sp.balance_amount),
                            0
                        ) AS total_balance

                    FROM tbl_supplier_payable sp

                    WHERE COALESCE(
                        sp.payment_status,
                        'Unpaid'
                    ) <> 'Cancelled'

                    GROUP BY
                        sp.vendor_id
                ) payable_summary
                    ON payable_summary.vendor_id =
                       i.vendor_id
              "
            : "";

    $productStmt = $conn->prepare("
        SELECT
            i.product_id,
            i.product_name,
            i.sku,
            i.category_id,

            {$categorySelect}

            i.quantity,
            i.unit_type,
            i.unit,
            i.reorder_level,
            i.supplier_price,
            i.selling_price,
            i.expiry_date,
            i.product_image,
            i.vendor_id,
            i.status,
            i.created_at,
            i.updated_at,

            {$supplierSelect}

            {$consignmentSelect}

            {$deliverySummarySelect}

            {$salesSummarySelect}

            {$batchSummarySelect}

            {$payableSummarySelect}

            CASE
                WHEN COALESCE(
                    batch_summary.batch_count,
                    0
                ) > 0
                THEN COALESCE(
                    batch_summary.batch_stock,
                    0
                )
                ELSE COALESCE(
                    i.quantity,
                    0
                )
            END AS computed_quantity,

            CASE
                WHEN (
                    CASE
                        WHEN COALESCE(
                            batch_summary.batch_count,
                            0
                        ) > 0
                        THEN COALESCE(
                            batch_summary.batch_stock,
                            0
                        )
                        ELSE COALESCE(
                            i.quantity,
                            0
                        )
                    END
                ) <= 0
                THEN 'Out of Stock'

                WHEN (
                    CASE
                        WHEN COALESCE(
                            batch_summary.batch_count,
                            0
                        ) > 0
                        THEN COALESCE(
                            batch_summary.batch_stock,
                            0
                        )
                        ELSE COALESCE(
                            i.quantity,
                            0
                        )
                    END
                ) <= COALESCE(
                    i.reorder_level,
                    0
                )
                THEN 'Low Stock'

                ELSE 'In Stock'
            END AS computed_status

        FROM tbl_inv i

        {$categoryJoin}

        {$supplierJoin}

        {$deliverySummaryJoin}

        {$salesSummaryJoin}

        {$batchSummaryJoin}

        {$payableSummaryJoin}

        WHERE i.product_id = :product_id

        LIMIT 1
    ");

    $productStmt->execute([
        ":product_id" => $productId
    ]);

    $product =
        $productStmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        respond(
            false,
            "Product record was not found.",
            [],
            404
        );
    }

    if (in_array(
        trim((string)($_SESSION["role"] ?? "")),
        ["Supplier", "Vendor"],
        true
    )) {
        enforceSupplierVendorAccess(
            (int)($product["vendor_id"] ?? 0)
        );
    }

    $product["quantity"] =
        (int)($product["computed_quantity"] ?? 0);

    $product["batch_stock"] =
        (int)($product["batch_stock"] ?? 0);

    $product["batch_count"] =
        (int)($product["batch_count"] ?? 0);

    $product["active_batch_count"] =
        (int)($product["active_batch_count"] ?? 0);

    $product["delivery_count"] =
        (int)($product["delivery_count"] ?? 0);

    $product["total_delivered_quantity"] =
        (int)($product["total_delivered_quantity"] ?? 0);

    $product["total_sold"] =
        (int)($product["total_sold"] ?? 0);

    $product["supplier_price"] =
        (float)($product["supplier_price"] ?? 0);

    $product["selling_price"] =
        (float)($product["selling_price"] ?? 0);

    $product["total_sales_value"] =
        (float)($product["total_sales_value"] ?? 0);

    $product["supplier_total_payable"] =
        (float)($product["supplier_total_payable"] ?? 0);

    $product["supplier_total_paid"] =
        (float)($product["supplier_total_paid"] ?? 0);

    $product["supplier_total_balance"] =
        (float)($product["supplier_total_balance"] ?? 0);

    $product["product_image_url"] =
        buildProductImageUrl(
            $product["product_image"] ?? ""
        );

    $deliveries = [];

    if (
        $hasDeliveryTable &&
        $hasDeliveryItemsTable
    ) {
        $deliveryStmt = $conn->prepare("
            SELECT
                di.delivery_item_id,
                di.delivery_id,
                d.delivery_order_no,
                d.delivery_date,
                d.status AS delivery_status,
                di.quantity,
                di.unit,
                di.supplier_price,
                di.retail_price,
                di.expiry_date,
                di.created_at,

                COALESCE(
                    v.vendor_name,
                    'No supplier'
                ) AS vendor_name

            FROM tbl_delivery_items di

            INNER JOIN tbl_delivery d
                ON d.delivery_id =
                   di.delivery_id

            LEFT JOIN tbl_vendor v
                ON v.vendor_id =
                   d.vendor_id

            WHERE di.product_id =
                  :product_id

            AND COALESCE(
                d.status,
                'Pending'
            ) <> 'Archived'

            ORDER BY
                d.delivery_date DESC,
                di.delivery_item_id DESC
        ");

        $deliveryStmt->execute([
            ":product_id" => $productId
        ]);

        $deliveries =
            $deliveryStmt->fetchAll(
                PDO::FETCH_ASSOC
            );
    }

    $batches = [];

    if ($hasBatchTable) {
        $remainingSelect =
            $hasRemainingQuantity
                ? "b.remaining_quantity"
                : "b.quantity";

        $batchStmt = $conn->prepare("
            SELECT
                b.batch_id,
                b.product_id,
                b.delivery_id,

                b.quantity
                    AS original_quantity,

                {$remainingSelect}
                    AS remaining_quantity,

                b.expiry_date,
                b.supplier_price,
                b.created_at,

                d.delivery_order_no,
                d.delivery_date,
                d.status AS delivery_status,

                COALESCE(
                    v.vendor_name,
                    'Manual Restock'
                ) AS vendor_name,

                CASE
                    WHEN {$remainingSelect} <= 0
                    THEN 'Depleted'

                    WHEN b.expiry_date IS NULL
                    THEN 'No Expiry'

                    WHEN b.expiry_date <= CURDATE()
                    THEN 'Expired'

                    WHEN b.expiry_date <=
                        DATE_ADD(
                            CURDATE(),
                            INTERVAL 7 DAY
                        )
                    THEN 'Critical'

                    WHEN b.expiry_date <=
                        DATE_ADD(
                            CURDATE(),
                            INTERVAL 30 DAY
                        )
                    THEN 'Near Expiry'

                    ELSE 'Safe'
                END AS batch_status,

                CASE
                    WHEN b.expiry_date IS NULL
                    THEN NULL

                    ELSE DATEDIFF(
                        b.expiry_date,
                        CURDATE()
                    )
                END AS days_until_expiry

            FROM tbl_inventory_batches b

            LEFT JOIN tbl_delivery d
                ON d.delivery_id =
                   b.delivery_id

            LEFT JOIN tbl_vendor v
                ON v.vendor_id =
                   d.vendor_id

            WHERE b.product_id =
                  :product_id

            ORDER BY
                CASE
                    WHEN {$remainingSelect} > 0
                    THEN 0
                    ELSE 1
                END ASC,

                CASE
                    WHEN b.expiry_date IS NULL
                    THEN 1
                    ELSE 0
                END ASC,

                b.expiry_date ASC,
                b.created_at ASC,
                b.batch_id ASC
        ");

        $batchStmt->execute([
            ":product_id" => $productId
        ]);

        $batches =
            $batchStmt->fetchAll(
                PDO::FETCH_ASSOC
            );

        foreach ($batches as &$batch) {
            $batch["original_quantity"] =
                (int)(
                    $batch["original_quantity"] ?? 0
                );

            $batch["quantity"] =
                $batch["original_quantity"];

            $batch["remaining_quantity"] =
                (int)(
                    $batch["remaining_quantity"] ?? 0
                );

            $batch["supplier_price"] =
                (float)(
                    $batch["supplier_price"] ?? 0
                );

            $batch["days_until_expiry"] =
                $batch["days_until_expiry"] !== null
                    ? (int)$batch["days_until_expiry"]
                    : null;

            $batch["batch_no"] =
                "BATCH-" .
                str_pad(
                    (string)$batch["batch_id"],
                    5,
                    "0",
                    STR_PAD_LEFT
                );
        }

        unset($batch);
    }

    $sales = [];

    if (
        $hasPosItemsTable &&
        $hasPosTable
    ) {
        $salesStmt = $conn->prepare("
            SELECT
                pi.pos_id,
                pi.product_id,
                pi.quantity,
                pi.price,
                pi.subtotal,

                p.transaction_code,
                p.customer_name,
                p.transaction_status,
                p.transaction_date

            FROM tbl_pos_items pi

            INNER JOIN tbl_pos p
                ON p.pos_id =
                   pi.pos_id

            WHERE pi.product_id =
                  :product_id

            ORDER BY
                p.transaction_date DESC,
                pi.pos_id DESC

            LIMIT 50
        ");

        $salesStmt->execute([
            ":product_id" => $productId
        ]);

        $sales =
            $salesStmt->fetchAll(
                PDO::FETCH_ASSOC
            );
    }

    $inventoryHistory = [];

    if ($hasInventoryHistoryTable) {
        $historyStmt = $conn->prepare("
            SELECT
                h.history_id,
                h.product_id,
                h.delivery_id,
                h.action_type,
                h.quantity,
                h.previous_quantity,
                h.new_quantity,
                h.remarks,
                h.created_by,
                h.created_at

            FROM tbl_inventory_history h

            WHERE h.product_id =
                  :product_id

            ORDER BY
                h.created_at DESC,
                h.history_id DESC

            LIMIT 100
        ");

        $historyStmt->execute([
            ":product_id" => $productId
        ]);

        $inventoryHistory =
            $historyStmt->fetchAll(
                PDO::FETCH_ASSOC
            );
    }

    if ($landingCatalogOnly) {
        $product = [
            "product_id" => $product["product_id"],
            "product_name" => $product["product_name"],
            "sku" => $product["sku"],
            "category_id" => $product["category_id"],
            "category_name" => $product["category_name"],
            "category" => $product["category"],
            "unit_type" => $product["unit_type"],
            "unit" => $product["unit"],
            "selling_price" => $product["selling_price"],
            "product_image" => $product["product_image"],
            "product_image_url" => $product["product_image_url"],
            "status" => $product["status"],
            "computed_status" => $product["computed_status"],
            "quantity" => $product["quantity"],
            "nearest_expiry_date" => $product["nearest_expiry_date"]
        ];

        $deliveries = [];
        $batches = [];
        $sales = [];
        $inventoryHistory = [];
    }

    respond(
        true,
        "Product business profile retrieved successfully.",
        [
            "product" => $product,
            "deliveries" => $deliveries,
            "batches" => $batches,
            "sales" => $sales,
            "inventory_history" =>
                $inventoryHistory
        ]
    );
} catch (Throwable $error) {
    error_log(
        "get_product_details.php: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to retrieve the product business profile.",
        [
        ],
        500
    );
}