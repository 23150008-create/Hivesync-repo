<?php

date_default_timezone_set('Asia/Manila');

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireAuthentication();
requireModulePermission("reports");

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);
    exit;
}

$action = strtolower(trim($_GET["action"] ?? ""));
$reportType = strtolower(trim($_GET["report_type"] ?? "sales"));
$period = strtolower(trim($_GET["period"] ?? "daily"));
$startDate = trim($_GET["start_date"] ?? "");
$endDate = trim($_GET["end_date"] ?? "");
$vendorId = isset($_GET["vendor_id"])
    ? max(0, (int)$_GET["vendor_id"])
    : 0;

$allowedReports = [
    "sales",
    "pos",
    "inventory",
    "delivery",
    "supplier",
    "consignment",
    "receivables",
    "remittance",
    "expense",
    "audit"
];

$allowedPeriods = [
    "daily",
    "weekly",
    "monthly",
    "yearly",
    "custom"
];

function respond(
    bool $success,
    array $payload = [],
    int $statusCode = 200
): void {
    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            ["success" => $success],
            $payload
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
    /*
     * Performance optimization only.
     * Cache repeated table checks during the current request.
     */
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
    /*
     * Performance optimization only.
     * Cache repeated column checks during the current request.
     */
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


function firstExistingTable(
    PDO $conn,
    array $tables
): ?string {
    foreach ($tables as $table) {
        if (tableExists($conn, $table)) {
            return $table;
        }
    }

    return null;
}

function firstExistingColumn(
    PDO $conn,
    string $table,
    array $columns
): ?string {
    foreach ($columns as $column) {
        if (columnExists($conn, $table, $column)) {
            return $column;
        }
    }

    return null;
}

function quoteIdentifier(string $identifier): string
{
    return "`" .
        str_replace("`", "``", $identifier) .
        "`";
}

function dateCondition(
    string $column,
    string $period,
    string $startDate,
    string $endDate,
    PDO $conn
): string {
    if ($period === "weekly") {
        return "YEARWEEK({$column}, 1) = YEARWEEK(CURDATE(), 1)";
    }

    if ($period === "monthly") {
        return "
            MONTH({$column}) = MONTH(CURDATE())
            AND YEAR({$column}) = YEAR(CURDATE())
        ";
    }

    if ($period === "yearly") {
        return "YEAR({$column}) = YEAR(CURDATE())";
    }

    if ($period === "custom") {
        return "
            DATE({$column}) BETWEEN " .
            $conn->quote($startDate) .
            " AND " .
            $conn->quote($endDate);
    }

    return "DATE({$column}) = CURDATE()";
}

function fetchAllRows(
    PDO $conn,
    string $sql
): array {
    $stmt = $conn->prepare($sql);
    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function fetchOneRow(
    PDO $conn,
    string $sql
): array {
    $stmt = $conn->prepare($sql);
    $stmt->execute();

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ?: [];
}

function scalarValue(
    PDO $conn,
    string $sql
) {
    $stmt = $conn->prepare($sql);
    $stmt->execute();

    $value = $stmt->fetchColumn();

    return $value === false || $value === null
        ? 0
        : $value;
}

function emptyFinancialSummary(): array
{
    return [
        "total_receivables" => 0,
        "original_amount" => 0,
        "amount_paid" => 0,
        "outstanding_balance" => 0
    ];
}

try {
    /*
    |--------------------------------------------------------------------------
    | Supplier dropdown source for Report Management
    |--------------------------------------------------------------------------
    */

    if ($action === "list_suppliers") {
        if (!tableExists($conn, "tbl_vendor")) {
            respond(
                true,
                [
                    "suppliers" => []
                ]
            );
        }

        $suppliers = fetchAllRows(
            $conn,
            "
                SELECT
                    vendor_id,
                    vendor_name,
                    contact_person,
                    status
                FROM tbl_vendor
                WHERE COALESCE(status, 'Active') <> 'Archived'
                ORDER BY vendor_name ASC
            "
        );

        respond(
            true,
            [
                "suppliers" => $suppliers
            ]
        );
    }

    if (!in_array($reportType, $allowedReports, true)) {
        respond(
            false,
            ["message" => "Unsupported report type."],
            422
        );
    }

    if (!in_array($period, $allowedPeriods, true)) {
        respond(
            false,
            ["message" => "Unsupported report period."],
            422
        );
    }

    if ($period === "custom") {
        if ($startDate === "" || $endDate === "") {
            respond(
                false,
                [
                    "message" =>
                        "Select both the start date and end date."
                ],
                422
            );
        }

        if ($startDate > $endDate) {
            respond(
                false,
                [
                    "message" =>
                        "Start date cannot be later than end date."
                ],
                422
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Maintain frontend compatibility:
    | "pos" and "sales" both generate the Sales / POS report.
    |--------------------------------------------------------------------------
    */

    $normalizedReportType =
        $reportType === "pos"
            ? "sales"
            : $reportType;

    $response = [
        "report_type" => $normalizedReportType,
        "period" => $period,
        "start_date" =>
            $startDate !== "" ? $startDate : null,
        "end_date" =>
            $endDate !== "" ? $endDate : null,
        "vendor_id" =>
            $vendorId > 0 ? $vendorId : null,
        "generated_at" => date("Y-m-d H:i:s"),
        "summary" => [],
        "records" => [],
        "best_sellers" => [],
        "expense_categories" => []
    ];

    /*
    |--------------------------------------------------------------------------
    | Optional supplier filter
    |--------------------------------------------------------------------------
    |
    | vendor_id = 0 means All Suppliers.
    |
    */

    $deliveryVendorFilter =
        $vendorId > 0
            ? " AND d.vendor_id = " . $vendorId . " "
            : "";

    $inventoryVendorFilter =
        $vendorId > 0
            ? " AND i.vendor_id = " . $vendorId . " "
            : "";

    $supplierVendorFilter =
        $vendorId > 0
            ? " WHERE v.vendor_id = " . $vendorId . " "
            : "";

    $paymentVendorFilter =
        $vendorId > 0
            ? " AND sp.vendor_id = " . $vendorId . " "
            : "";

    /*
    |--------------------------------------------------------------------------
    | SALES / POS REPORT
    |--------------------------------------------------------------------------
    */

    if ($normalizedReportType === "sales") {
        $date = dateCondition(
            "p.transaction_date",
            $period,
            $startDate,
            $endDate,
            $conn
        );

        $statusExpression = columnExists(
            $conn,
            "tbl_pos",
            "transaction_status"
        )
            ? "COALESCE(p.transaction_status, 'Completed')"
            : "'Completed'";

        $refundedExpression = columnExists(
            $conn,
            "tbl_pos",
            "refunded_amount"
        )
            ? "COALESCE(p.refunded_amount, 0)"
            : "0";

        $discountExpression = columnExists(
            $conn,
            "tbl_pos",
            "discount"
        )
            ? "COALESCE(p.discount, 0)"
            : "0";

        $subtotalExpression = columnExists(
            $conn,
            "tbl_pos",
            "subtotal_amount"
        )
            ? "COALESCE(p.subtotal_amount, p.total_amount)"
            : "p.total_amount";

        $activeSales = "
            {$date}
            AND {$statusExpression} <> 'Voided'
        ";

        $response["summary"] = fetchOneRow(
            $conn,
            "
                SELECT
                    COUNT(*) AS total_transactions,

                    COALESCE(
                        SUM({$subtotalExpression}),
                        0
                    ) AS gross_sales,

                    COALESCE(
                        SUM({$discountExpression}),
                        0
                    ) AS total_discount,

                    COALESCE(
                        SUM(p.total_amount),
                        0
                    ) AS recorded_sales,

                    COALESCE(
                        SUM({$refundedExpression}),
                        0
                    ) AS total_refunded,

                    COALESCE(
                        SUM(
                            GREATEST(
                                p.total_amount -
                                {$refundedExpression},
                                0
                            )
                        ),
                        0
                    ) AS net_sales,

                    COALESCE(
                        SUM(p.payment_amount),
                        0
                    ) AS cash_collected

                FROM tbl_pos p

                WHERE {$activeSales}
            "
        );

        $response["summary"]["total_sales"] =
            $response["summary"]["recorded_sales"] ?? 0;

        $response["records"] = fetchAllRows(
            $conn,
            "
                SELECT
                    p.pos_id,
                    p.transaction_code,
                    p.customer_name,

                    COALESCE(
                        u.full_name,
                        p.prepared_by,
                        'Unknown Cashier'
                    ) AS cashier_name,

                    p.prepared_by,

                    {$subtotalExpression}
                        AS subtotal_amount,

                    {$discountExpression}
                        AS discount,

                    p.total_amount,
                    p.payment_amount,
                    p.change_amount,

                    {$refundedExpression}
                        AS refunded_amount,

                    GREATEST(
                        p.total_amount -
                        {$refundedExpression},
                        0
                    ) AS net_amount,

                    {$statusExpression}
                        AS transaction_status,

                    p.transaction_date,

                    COUNT(
                        DISTINCT pi.item_id
                    ) AS product_lines,

                    COALESCE(
                        SUM(pi.quantity),
                        0
                    ) AS total_items

                FROM tbl_pos p

                LEFT JOIN tbl_user u
                    ON u.user_id = p.cashier_id

                LEFT JOIN tbl_pos_items pi
                    ON pi.pos_id = p.pos_id

                WHERE {$activeSales}

                GROUP BY
                    p.pos_id,
                    p.transaction_code,
                    p.customer_name,
                    cashier_name,
                    p.prepared_by,
                    subtotal_amount,
                    discount,
                    p.total_amount,
                    p.payment_amount,
                    p.change_amount,
                    refunded_amount,
                    net_amount,
                    transaction_status,
                    p.transaction_date

                ORDER BY
                    p.transaction_date DESC,
                    p.pos_id DESC
            "
        );

        $returnedQuantityExpression = columnExists(
            $conn,
            "tbl_pos_items",
            "returned_quantity"
        )
            ? "COALESCE(pi.returned_quantity, 0)"
            : "0";

        $itemRefundExpression = columnExists(
            $conn,
            "tbl_pos_items",
            "refunded_amount"
        )
            ? "COALESCE(pi.refunded_amount, 0)"
            : "0";

        $response["best_sellers"] = fetchAllRows(
            $conn,
            "
                SELECT
                    i.product_id,
                    i.product_name,
                    i.sku,

                    COALESCE(
                        c.category_name,
                        i.category,
                        'Uncategorized'
                    ) AS category_name,

                    COALESCE(
                        SUM(
                            GREATEST(
                                pi.quantity -
                                {$returnedQuantityExpression},
                                0
                            )
                        ),
                        0
                    ) AS total_sold,

                    COALESCE(
                        SUM(
                            GREATEST(
                                pi.subtotal -
                                {$itemRefundExpression},
                                0
                            )
                        ),
                        0
                    ) AS total_sales

                FROM tbl_pos_items pi

                INNER JOIN tbl_pos p
                    ON p.pos_id = pi.pos_id

                INNER JOIN tbl_inv i
                    ON i.product_id = pi.product_id

                LEFT JOIN tbl_category c
                    ON c.category_id = i.category_id

                WHERE {$activeSales}

                GROUP BY
                    i.product_id,
                    i.product_name,
                    i.sku,
                    category_name

                ORDER BY
                    total_sold DESC,
                    total_sales DESC,
                    i.product_name ASC
            "
        );

        respond(true, $response);
    }

    /*
    |--------------------------------------------------------------------------
    | INVENTORY REPORT
    |--------------------------------------------------------------------------
    */

    if ($normalizedReportType === "inventory") {
        $active = "
            COALESCE(i.status, 'In Stock') <> 'Archived'
        ";

        $response["summary"] = fetchOneRow(
            $conn,
            "
                SELECT
                    COUNT(*) AS total_products,

                    COALESCE(
                        SUM(
                            COALESCE(i.quantity, 0) *
                            COALESCE(i.selling_price, 0)
                        ),
                        0
                    ) AS inventory_value,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN i.quantity > 0
                                AND i.quantity <=
                                    COALESCE(i.reorder_level, 0)
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS low_stock,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN i.quantity <= 0
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS out_of_stock,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN i.expiry_date IS NOT NULL
                                AND i.expiry_date > CURDATE()
                                AND i.expiry_date <=
                                    DATE_ADD(
                                        CURDATE(),
                                        INTERVAL 30 DAY
                                    )
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS near_expiry,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN i.expiry_date IS NOT NULL
                                AND i.expiry_date <= CURDATE()
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS expired

                FROM tbl_inv i

                WHERE {$active}
            "
        );

        $response["records"] = fetchAllRows(
            $conn,
            "
                SELECT
                    i.product_id,
                    i.product_name,
                    i.sku,

                    COALESCE(
                        c.category_name,
                        i.category,
                        'Uncategorized'
                    ) AS category_name,

                    COALESCE(
                        v.vendor_name,
                        'No supplier'
                    ) AS vendor_name,

                    i.quantity,
                    i.unit_type,
                    i.unit,
                    i.reorder_level,
                    i.supplier_price,
                    i.selling_price,
                    i.expiry_date,
                    i.expiry_date
                        AS nearest_expiry_date,

                    CASE
                        WHEN i.quantity <= 0
                            THEN 'Out of Stock'
                        WHEN i.quantity <=
                             COALESCE(i.reorder_level, 0)
                            THEN 'Low Stock'
                        ELSE 'In Stock'
                    END AS stock_status

                FROM tbl_inv i

                LEFT JOIN tbl_category c
                    ON c.category_id = i.category_id

                LEFT JOIN tbl_vendor v
                    ON v.vendor_id = i.vendor_id

                WHERE {$active}

                ORDER BY
                    CASE
                        WHEN i.quantity <= 0 THEN 0
                        WHEN i.quantity <=
                             COALESCE(i.reorder_level, 0)
                        THEN 1
                        ELSE 2
                    END,
                    i.product_name ASC
            "
        );

        respond(true, $response);
    }

    /*
    |--------------------------------------------------------------------------
    | DELIVERY REPORT
    |--------------------------------------------------------------------------
    */

    if ($normalizedReportType === "delivery") {
        $date = dateCondition(
            "d.delivery_date",
            $period,
            $startDate,
            $endDate,
            $conn
        );

        $deliveryAmountColumn =
            firstExistingColumn(
                $conn,
                "tbl_delivery",
                [
                    "amount",
                    "total_amount"
                ]
            );

        $amountExpression =
            $deliveryAmountColumn
                ? "COALESCE(d." .
                  quoteIdentifier(
                      $deliveryAmountColumn
                  ) .
                  ", 0)"
                : "0";

        $statusColumn =
            firstExistingColumn(
                $conn,
                "tbl_delivery",
                [
                    "status",
                    "delivery_status"
                ]
            );

        $statusExpression =
            $statusColumn
                ? "COALESCE(d." .
                  quoteIdentifier($statusColumn) .
                  ", 'Delivered')"
                : "'Delivered'";

        $response["summary"] = fetchOneRow(
            $conn,
            "
                SELECT
                    COUNT(*) AS total_deliveries,

                    COALESCE(
                        SUM({$amountExpression}),
                        0
                    ) AS total_amount,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN {$statusExpression} = 'Pending'
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS pending,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN {$statusExpression} = 'Delivered'
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS delivered

                FROM tbl_delivery d

                WHERE {$date}
                AND {$statusExpression} <> 'Archived'
                {$deliveryVendorFilter}
            "
        );

        $hasDeliveryItems =
            tableExists(
                $conn,
                "tbl_delivery_items"
            );

        $itemsJoin = $hasDeliveryItems
            ? "
                LEFT JOIN tbl_delivery_items di
                    ON di.delivery_id = d.delivery_id
              "
            : "";

        $itemsCount = $hasDeliveryItems
            ? "COUNT(DISTINCT di.delivery_item_id)"
            : (
                columnExists(
                    $conn,
                    "tbl_delivery",
                    "items_count"
                )
                    ? "MAX(d.items_count)"
                    : "0"
            );

        $quantityColumn = $hasDeliveryItems
            ? firstExistingColumn(
                $conn,
                "tbl_delivery_items",
                [
                    "quantity",
                    "received_quantity"
                ]
            )
            : null;

        $totalQuantity =
            $hasDeliveryItems && $quantityColumn
                ? "COALESCE(SUM(di." .
                  quoteIdentifier($quantityColumn) .
                  "), 0)"
                : "0";

        $orderNoColumn =
            firstExistingColumn(
                $conn,
                "tbl_delivery",
                [
                    "delivery_order_no",
                    "delivery_no",
                    "reference_no"
                ]
            );

        $orderNoExpression =
            $orderNoColumn
                ? "d." .
                  quoteIdentifier($orderNoColumn)
                : "CAST(d.delivery_id AS CHAR)";

        $deliveryTypeColumn =
            firstExistingColumn(
                $conn,
                "tbl_delivery",
                [
                    "delivery_type",
                    "type"
                ]
            );

        $deliveryTypeExpression =
            $deliveryTypeColumn
                ? "d." .
                  quoteIdentifier(
                      $deliveryTypeColumn
                  )
                : "'Regular'";

        $receivedByColumn =
            firstExistingColumn(
                $conn,
                "tbl_delivery",
                [
                    "received_by",
                    "created_by_name"
                ]
            );

        $receivedByExpression =
            $receivedByColumn
                ? "d." .
                  quoteIdentifier(
                      $receivedByColumn
                  )
                : "'Not recorded'";

        $response["records"] = fetchAllRows(
            $conn,
            "
                SELECT
                    d.delivery_id,

                    {$orderNoExpression}
                        AS delivery_order_no,

                    COALESCE(
                        v.vendor_name,
                        'Unknown Supplier'
                    ) AS vendor_name,

                    d.delivery_date,

                    {$itemsCount}
                        AS product_lines,

                    {$itemsCount}
                        AS items_count,

                    {$totalQuantity}
                        AS total_quantity,

                    {$amountExpression}
                        AS total_amount,

                    {$amountExpression}
                        AS amount,

                    {$deliveryTypeExpression}
                        AS delivery_type,

                    {$statusExpression}
                        AS status,

                    {$receivedByExpression}
                        AS received_by

                FROM tbl_delivery d

                LEFT JOIN tbl_vendor v
                    ON v.vendor_id = d.vendor_id

                {$itemsJoin}

                WHERE {$date}
                AND {$statusExpression} <> 'Archived'
                {$deliveryVendorFilter}

                GROUP BY
                    d.delivery_id,
                    delivery_order_no,
                    v.vendor_name,
                    d.delivery_date,
                    total_amount,
                    delivery_type,
                    status,
                    received_by

                ORDER BY
                    d.delivery_date DESC,
                    d.delivery_id DESC
            "
        );

        respond(true, $response);
    }

    /*
    |--------------------------------------------------------------------------
    | SUPPLIER REPORT
    |--------------------------------------------------------------------------
    */

    if ($normalizedReportType === "supplier") {
        $hasPayables =
            tableExists($conn, "tbl_supplier_payable");

        $payableJoin = $hasPayables
            ? "
                LEFT JOIN (
                    SELECT
                        vendor_id,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN payment_status <> 'Cancelled'
                                    THEN balance_amount
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS outstanding_balance,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN payment_status = 'Ready for Payment'
                                    THEN balance_amount
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS ready_for_payment

                    FROM tbl_supplier_payable
                    GROUP BY vendor_id
                ) payable
                    ON payable.vendor_id = v.vendor_id
              "
            : "";

        $outstandingExpression = $hasPayables
            ? "COALESCE(payable.outstanding_balance, 0)"
            : "0";

        $readyExpression = $hasPayables
            ? "COALESCE(payable.ready_for_payment, 0)"
            : "0";

        $vendorStatusExpression =
            columnExists($conn, "tbl_vendor", "status")
                ? "COALESCE(v.status, 'Active')"
                : "'Active'";

        $response["summary"] = fetchOneRow(
            $conn,
            "
                SELECT
                    COUNT(*) AS total_suppliers,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN {$vendorStatusExpression} = 'Active'
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS active,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN {$vendorStatusExpression} <> 'Active'
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS inactive,

                    COALESCE(
                        SUM({$outstandingExpression}),
                        0
                    ) AS outstanding_balance,

                    COALESCE(
                        SUM({$readyExpression}),
                        0
                    ) AS ready_for_payment

                FROM tbl_vendor v

                {$payableJoin}

                {$supplierVendorFilter}
            "
        );

        $contactColumn =
            firstExistingColumn(
                $conn,
                "tbl_vendor",
                [
                    "phone",
                    "contact_number",
                    "mobile_number"
                ]
            );

        $contactExpression =
            $contactColumn
                ? "v." . quoteIdentifier($contactColumn)
                : "''";

        $response["records"] = fetchAllRows(
            $conn,
            "
                SELECT
                    v.vendor_id,
                    v.vendor_name,
                    v.contact_person,

                    {$contactExpression}
                        AS phone,

                    COALESCE(
                        products.product_count,
                        0
                    ) AS product_count,

                    COALESCE(
                        deliveries.delivery_count,
                        0
                    ) AS delivery_count,

                    COALESCE(
                        deliveries.delivered_value,
                        0
                    ) AS delivered_value,

                    {$outstandingExpression}
                        AS outstanding_balance,

                    {$readyExpression}
                        AS ready_for_payment,

                    {$vendorStatusExpression}
                        AS status

                FROM tbl_vendor v

                LEFT JOIN (
                    SELECT
                        vendor_id,
                        COUNT(*) AS product_count
                    FROM tbl_inv
                    WHERE COALESCE(
                        status,
                        'In Stock'
                    ) <> 'Archived'
                    GROUP BY vendor_id
                ) products
                    ON products.vendor_id = v.vendor_id

                LEFT JOIN (
                    SELECT
                        d.vendor_id,
                        COUNT(DISTINCT d.delivery_id)
                            AS delivery_count,

                        COALESCE(
                            SUM(
                                COALESCE(di.delivery_value, 0)
                            ),
                            0
                        ) AS delivered_value

                    FROM tbl_delivery d

                    LEFT JOIN (
                        SELECT
                            delivery_id,
                            SUM(
                                COALESCE(
                                    total_price,
                                    quantity * supplier_price,
                                    0
                                )
                            ) AS delivery_value
                        FROM tbl_delivery_items
                        GROUP BY delivery_id
                    ) di
                        ON di.delivery_id = d.delivery_id

                    WHERE COALESCE(
                        d.status,
                        'Delivered'
                    ) <> 'Archived'

                    GROUP BY d.vendor_id
                ) deliveries
                    ON deliveries.vendor_id = v.vendor_id

                {$payableJoin}

                {$supplierVendorFilter}

                ORDER BY
                    v.vendor_name ASC
            "
        );

        respond(true, $response);
    }

    /*
    |--------------------------------------------------------------------------
    | CONSIGNMENT REPORT
    |--------------------------------------------------------------------------
    */

    if ($normalizedReportType === "consignment") {
        if (
            !columnExists(
                $conn,
                "tbl_inv",
                "is_consignment"
            )
        ) {
            $response["summary"] = [
                "total_consignments" => 0,
                "delivered_quantity" => 0,
                "sold_quantity" => 0,
                "remaining_quantity" => 0,
                "amount_payable" => 0
            ];

            respond(true, $response);
        }

        $dateColumn = columnExists(
            $conn,
            "tbl_inv",
            "consignment_start_date"
        )
            ? "i.consignment_start_date"
            : "i.created_at";

        $date = dateCondition(
            $dateColumn,
            $period,
            $startDate,
            $endDate,
            $conn
        );

        $response["summary"] = fetchOneRow(
            $conn,
            "
                SELECT
                    COUNT(*) AS total_consignments,

                    COALESCE(
                        SUM(
                            COALESCE(delivered.delivered_quantity, 0)
                        ),
                        0
                    ) AS delivered_quantity,

                    COALESCE(
                        SUM(
                            COALESCE(sales.sold_quantity, 0)
                        ),
                        0
                    ) AS sold_quantity,

                    COALESCE(
                        SUM(COALESCE(i.quantity, 0)),
                        0
                    ) AS remaining_quantity,

                    COALESCE(
                        SUM(
                            COALESCE(sales.sold_quantity, 0) *
                            COALESCE(i.supplier_price, 0)
                        ),
                        0
                    ) AS amount_payable

                FROM tbl_inv i

                LEFT JOIN (
                    SELECT
                        di.product_id,
                        SUM(di.quantity)
                            AS delivered_quantity
                    FROM tbl_delivery_items di
                    INNER JOIN tbl_delivery d
                        ON d.delivery_id = di.delivery_id
                    WHERE COALESCE(di.is_consignment, 0) = 1
                    AND COALESCE(d.status, 'Delivered') = 'Delivered'
                    GROUP BY di.product_id
                ) delivered
                    ON delivered.product_id = i.product_id

                LEFT JOIN (
                    SELECT
                        pi.product_id,
                        SUM(
                            GREATEST(
                                pi.quantity -
                                COALESCE(pi.returned_quantity, 0),
                                0
                            )
                        ) AS sold_quantity
                    FROM tbl_pos_items pi
                    INNER JOIN tbl_pos p
                        ON p.pos_id = pi.pos_id
                    WHERE COALESCE(
                        p.transaction_status,
                        'Completed'
                    ) <> 'Voided'
                    GROUP BY pi.product_id
                ) sales
                    ON sales.product_id = i.product_id

                WHERE COALESCE(i.is_consignment, 0) = 1
                AND COALESCE(i.status, 'In Stock') <> 'Archived'
                AND {$date}
                {$inventoryVendorFilter}
            "
        );

        $response["records"] = fetchAllRows(
            $conn,
            "
                SELECT
                    i.product_id,
                    i.product_name,
                    i.sku,
                    i.variant_label,
                    i.variant_value,
                    i.variant_unit,

                    COALESCE(
                        v.vendor_name,
                        'Unknown Supplier'
                    ) AS vendor_name,

                    i.consignment_start_date,
                    i.consignment_pullout_date,

                    COALESCE(
                        delivered.delivered_quantity,
                        0
                    ) AS delivered_quantity,

                    COALESCE(
                        sales.sold_quantity,
                        0
                    ) AS sold_quantity,

                    COALESCE(
                        i.quantity,
                        0
                    ) AS remaining_quantity,

                    COALESCE(
                        sales.sold_quantity,
                        0
                    ) * COALESCE(
                        i.supplier_price,
                        0
                    ) AS amount_payable,

                    i.consignment_terms,
                    i.consignment_notes,

                    CASE
                        WHEN i.consignment_pullout_date IS NOT NULL
                        AND i.consignment_pullout_date < CURDATE()
                            THEN 'For Pull-Out'
                        WHEN COALESCE(i.quantity, 0) <= 0
                            THEN 'Completed'
                        ELSE 'Active'
                    END AS consignment_status,

                    CASE
                        WHEN i.consignment_pullout_date IS NOT NULL
                        AND i.consignment_pullout_date < CURDATE()
                            THEN 'For Pull-Out'
                        WHEN COALESCE(i.quantity, 0) <= 0
                            THEN 'Completed'
                        ELSE 'Active'
                    END AS status

                FROM tbl_inv i

                LEFT JOIN tbl_vendor v
                    ON v.vendor_id = i.vendor_id

                LEFT JOIN (
                    SELECT
                        di.product_id,
                        SUM(di.quantity)
                            AS delivered_quantity
                    FROM tbl_delivery_items di
                    INNER JOIN tbl_delivery d
                        ON d.delivery_id = di.delivery_id
                    WHERE COALESCE(di.is_consignment, 0) = 1
                    AND COALESCE(d.status, 'Delivered') = 'Delivered'
                    GROUP BY di.product_id
                ) delivered
                    ON delivered.product_id = i.product_id

                LEFT JOIN (
                    SELECT
                        pi.product_id,
                        SUM(
                            GREATEST(
                                pi.quantity -
                                COALESCE(pi.returned_quantity, 0),
                                0
                            )
                        ) AS sold_quantity
                    FROM tbl_pos_items pi
                    INNER JOIN tbl_pos p
                        ON p.pos_id = pi.pos_id
                    WHERE COALESCE(
                        p.transaction_status,
                        'Completed'
                    ) <> 'Voided'
                    GROUP BY pi.product_id
                ) sales
                    ON sales.product_id = i.product_id

                WHERE COALESCE(i.is_consignment, 0) = 1
                AND COALESCE(i.status, 'In Stock') <> 'Archived'
                AND {$date}
                {$inventoryVendorFilter}

                ORDER BY
                    i.consignment_pullout_date ASC,
                    i.product_name ASC,
                    i.variant_sort ASC
            "
        );

        respond(true, $response);
    }

    /*
    |--------------------------------------------------------------------------
    | RECEIVABLES REPORT
    |--------------------------------------------------------------------------
    */

    if ($normalizedReportType === "receivables") {
        $receivableTable = firstExistingTable(
            $conn,
            [
                "tbl_receivables",
                "tbl_receivable",
                "tbl_pos_receivables"
            ]
        );

        if (!$receivableTable) {
            $response["summary"] =
                emptyFinancialSummary();

            respond(true, $response);
        }

        $idColumn =
            firstExistingColumn(
                $conn,
                $receivableTable,
                [
                    "receivable_id",
                    "id"
                ]
            );

        $referenceColumn =
            firstExistingColumn(
                $conn,
                $receivableTable,
                [
                    "reference_no",
                    "transaction_code",
                    "reference_code"
                ]
            );

        $customerColumn =
            firstExistingColumn(
                $conn,
                $receivableTable,
                [
                    "customer_name",
                    "customer"
                ]
            );

        $originalColumn =
            firstExistingColumn(
                $conn,
                $receivableTable,
                [
                    "original_amount",
                    "total_amount",
                    "amount"
                ]
            );

        $paidColumn =
            firstExistingColumn(
                $conn,
                $receivableTable,
                [
                    "amount_paid",
                    "paid_amount"
                ]
            );

        $balanceColumn =
            firstExistingColumn(
                $conn,
                $receivableTable,
                [
                    "balance_amount",
                    "remaining_balance",
                    "balance",
                    "outstanding_balance"
                ]
            );

        $dateColumn =
            firstExistingColumn(
                $conn,
                $receivableTable,
                [
                    "created_at",
                    "transaction_date",
                    "date_created"
                ]
            );

        $dueColumn =
            firstExistingColumn(
                $conn,
                $receivableTable,
                ["due_date"]
            );

        $statusColumn =
            firstExistingColumn(
                $conn,
                $receivableTable,
                [
                    "payment_status",
                    "status"
                ]
            );

        $recordedByColumn =
            firstExistingColumn(
                $conn,
                $receivableTable,
                [
                    "recorded_by_name",
                    "created_by_name"
                ]
            );

        $createdByIdColumn =
            firstExistingColumn(
                $conn,
                $receivableTable,
                [
                    "created_by",
                    "recorded_by"
                ]
            );

        $tableSql =
            quoteIdentifier($receivableTable);

        $date = $dateColumn
            ? dateCondition(
                "r." .
                quoteIdentifier($dateColumn),
                $period,
                $startDate,
                $endDate,
                $conn
            )
            : "1 = 1";

        $originalExpression =
            $originalColumn
                ? "COALESCE(r." .
                  quoteIdentifier($originalColumn) .
                  ", 0)"
                : "0";

        $paidExpression =
            $paidColumn
                ? "COALESCE(r." .
                  quoteIdentifier($paidColumn) .
                  ", 0)"
                : "0";

        $balanceExpression =
            $balanceColumn
                ? "COALESCE(r." .
                  quoteIdentifier($balanceColumn) .
                  ", 0)"
                : "
                    GREATEST(
                        {$originalExpression} -
                        {$paidExpression},
                        0
                    )
                  ";

        $response["summary"] = fetchOneRow(
            $conn,
            "
                SELECT
                    COUNT(*) AS total_receivables,

                    COALESCE(
                        SUM({$originalExpression}),
                        0
                    ) AS original_amount,

                    COALESCE(
                        SUM({$paidExpression}),
                        0
                    ) AS amount_paid,

                    COALESCE(
                        SUM({$balanceExpression}),
                        0
                    ) AS outstanding_balance

                FROM {$tableSql} r

                WHERE {$date}
            "
        );

        $idExpression = $idColumn
            ? "r." .
              quoteIdentifier($idColumn)
            : "NULL";

        $referenceExpression =
            $referenceColumn
                ? "r." .
                  quoteIdentifier($referenceColumn)
                : "''";

        $customerExpression =
            $customerColumn
                ? "r." .
                  quoteIdentifier($customerColumn)
                : "'Not specified'";

        $dueExpression =
            $dueColumn
                ? "r." .
                  quoteIdentifier($dueColumn)
                : "NULL";

        $statusExpression =
            $statusColumn
                ? "r." .
                  quoteIdentifier($statusColumn)
                : "'Pending'";

        $receivableUserJoin =
            $createdByIdColumn &&
            tableExists($conn, "tbl_user")
                ? "
                    LEFT JOIN tbl_user ru
                        ON ru.user_id =
                           r." .
                           quoteIdentifier($createdByIdColumn)
                : "";

        $recordedByExpression =
            $recordedByColumn
                ? "r." .
                  quoteIdentifier($recordedByColumn)
                : (
                    $receivableUserJoin !== ""
                        ? "COALESCE(ru.full_name, 'Unknown User')"
                        : "'Unknown User'"
                );

        $orderExpression = $dateColumn
            ? "r." .
              quoteIdentifier($dateColumn) .
              " DESC"
            : (
                $idColumn
                    ? "r." .
                      quoteIdentifier($idColumn) .
                      " DESC"
                    : "1"
            );

        $response["records"] = fetchAllRows(
            $conn,
            "
                SELECT
                    {$idExpression}
                        AS receivable_id,

                    {$referenceExpression}
                        AS reference_no,

                    {$customerExpression}
                        AS customer_name,

                    {$originalExpression}
                        AS original_amount,

                    {$paidExpression}
                        AS amount_paid,

                    {$balanceExpression}
                        AS remaining_balance,

                    {$dueExpression}
                        AS due_date,

                    {$statusExpression}
                        AS payment_status,

                    {$recordedByExpression}
                        AS recorded_by_name

                FROM {$tableSql} r

                {$receivableUserJoin}

                WHERE {$date}

                ORDER BY {$orderExpression}
            "
        );

        respond(true, $response);
    }

    /*
    |--------------------------------------------------------------------------
    | REMITTANCE / PAYMENT REPORT
    |--------------------------------------------------------------------------
    */

    if ($normalizedReportType === "remittance") {
        if (!tableExists($conn, "tbl_supplier_payment")) {
            $response["summary"] = [
                "total_payments" => 0,
                "total_paid" => 0,
                "covered_deliveries" => 0,
                "remaining_balance" => 0
            ];

            respond(true, $response);
        }

        $date = dateCondition(
            "sp.payment_date",
            $period,
            $startDate,
            $endDate,
            $conn
        );

        $hasRemittanceItems =
            tableExists($conn, "tbl_remittance_order_items");

        $hasPayables =
            tableExists($conn, "tbl_supplier_payable");

        $coveredJoin = $hasRemittanceItems
            ? "
                LEFT JOIN (
                    SELECT
                        remittance_order_id,
                        COUNT(DISTINCT delivery_id)
                            AS covered_deliveries
                    FROM tbl_remittance_order_items
                    GROUP BY remittance_order_id
                ) roi
                    ON roi.remittance_order_id =
                       sp.remittance_order_id
              "
            : "";

        $coveredExpression = $hasRemittanceItems
            ? "COALESCE(roi.covered_deliveries, 0)"
            : "0";

        $balanceJoin = $hasPayables
            ? "
                LEFT JOIN (
                    SELECT
                        vendor_id,
                        COALESCE(SUM(balance_amount), 0)
                            AS remaining_balance
                    FROM tbl_supplier_payable
                    WHERE payment_status <> 'Cancelled'
                    GROUP BY vendor_id
                ) payable_balance
                    ON payable_balance.vendor_id =
                       sp.vendor_id
              "
            : "";

        $remainingExpression = $hasPayables
            ? "COALESCE(payable_balance.remaining_balance, 0)"
            : "0";

        $payableVendorFilter =
            $vendorId > 0
                ? " AND p.vendor_id = " . $vendorId . " "
                : "";

        $response["summary"] = fetchOneRow(
            $conn,
            "
                SELECT
                    COUNT(*) AS total_payments,

                    COALESCE(
                        SUM(sp.amount_paid),
                        0
                    ) AS total_paid,

                    COALESCE(
                        SUM({$coveredExpression}),
                        0
                    ) AS covered_deliveries,

                    COALESCE(
                        (
                            SELECT SUM(p.balance_amount)
                            FROM tbl_supplier_payable p
                            WHERE p.payment_status <> 'Cancelled'
                            {$payableVendorFilter}
                        ),
                        0
                    ) AS remaining_balance

                FROM tbl_supplier_payment sp

                {$coveredJoin}

                WHERE {$date}
                {$paymentVendorFilter}
            "
        );

        $response["records"] = fetchAllRows(
            $conn,
            "
                SELECT
                    sp.supplier_payment_id
                        AS payment_id,

                    sp.payment_no
                        AS payment_reference,

                    COALESCE(
                        v.vendor_name,
                        'Unknown Supplier'
                    ) AS vendor_name,

                    sp.payment_date,
                    sp.amount_paid,
                    sp.payment_method,
                    sp.reference_number,
                    sp.received_by,

                    {$coveredExpression}
                        AS covered_deliveries,

                    {$remainingExpression}
                        AS remaining_balance,

                    COALESCE(
                        NULLIF(sp.processed_by, ''),
                        'Unknown User'
                    ) AS processed_by_name,

                    sp.remarks,
                    sp.created_at

                FROM tbl_supplier_payment sp

                LEFT JOIN tbl_vendor v
                    ON v.vendor_id = sp.vendor_id

                {$coveredJoin}
                {$balanceJoin}

                WHERE {$date}
                {$paymentVendorFilter}

                ORDER BY
                    sp.payment_date DESC,
                    sp.supplier_payment_id DESC
            "
        );

        respond(true, $response);
    }

    /*
    |--------------------------------------------------------------------------
    | EXPENSE REPORT
    |--------------------------------------------------------------------------
    */

    if ($normalizedReportType === "expense") {
        if (!tableExists($conn, "tbl_expense")) {
            $response["summary"] = [
                "total_expenses" => 0,
                "total_amount" => 0,
                "total_quantity" => 0,
                "categories_used" => 0
            ];

            $response["records"] = [];
            $response["expense_categories"] = [];

            respond(true, $response);
        }

        $date = dateCondition(
            "e.expense_date",
            $period,
            $startDate,
            $endDate,
            $conn
        );

        $response["summary"] = fetchOneRow(
            $conn,
            "
                SELECT
                    COUNT(*) AS total_expenses,
                    COALESCE(SUM(e.total_cost), 0) AS total_amount,
                    COALESCE(SUM(e.quantity), 0) AS total_quantity,
                    COUNT(DISTINCT e.expense_category) AS categories_used
                FROM tbl_expense e
                WHERE {$date}
                AND COALESCE(e.status, 'Active') <> 'Archived'
            "
        );

        $response["records"] = fetchAllRows(
            $conn,
            "
                SELECT
                    e.expense_id,
                    e.expense_no,
                    e.expense_date,
                    e.expense_category,
                    e.material_name,
                    e.quantity,
                    e.unit,
                    e.unit_cost,
                    e.total_cost,
                    e.related_module,
                    e.reference_id,
                    e.reference_code,
                    e.reference_description,
                    COALESCE(
                        NULLIF(e.recorded_by_name, ''),
                        u.full_name,
                        'Unknown User'
                    ) AS recorded_by_name,
                    e.remarks,
                    e.status,
                    e.created_at,
                    e.updated_at
                FROM tbl_expense e
                LEFT JOIN tbl_user u
                    ON u.user_id = e.recorded_by
                WHERE {$date}
                AND COALESCE(e.status, 'Active') <> 'Archived'
                ORDER BY e.expense_date DESC, e.expense_id DESC
            "
        );

        $response["expense_categories"] = fetchAllRows(
            $conn,
            "
                SELECT
                    e.expense_category,
                    COUNT(*) AS expense_count,
                    COALESCE(SUM(e.quantity), 0) AS total_quantity,
                    COALESCE(SUM(e.total_cost), 0) AS total_amount
                FROM tbl_expense e
                WHERE {$date}
                AND COALESCE(e.status, 'Active') <> 'Archived'
                GROUP BY e.expense_category
                ORDER BY total_amount DESC, e.expense_category ASC
            "
        );

        respond(true, $response);
    }

    /*
    |--------------------------------------------------------------------------
    | AUDIT TRAIL REPORT
    |--------------------------------------------------------------------------
    */

    if ($normalizedReportType === "audit") {
        $date = dateCondition(
            "a.created_at",
            $period,
            $startDate,
            $endDate,
            $conn
        );

        $response["summary"] = fetchOneRow(
            $conn,
            "
                SELECT
                    COUNT(*) AS total_logs,

                    COUNT(
                        DISTINCT a.user_name
                    ) AS users_involved,

                    COUNT(
                        DISTINCT a.module
                    ) AS modules_involved,

                    COUNT(
                        DISTINCT a.action
                    ) AS actions_recorded

                FROM tbl_audit_trail a

                WHERE {$date}
            "
        );

        $auditIdExpression = columnExists(
            $conn,
            "tbl_audit_trail",
            "audit_id"
        )
            ? "a.audit_id"
            : (
                columnExists(
                    $conn,
                    "tbl_audit_trail",
                    "log_id"
                )
                    ? "a.log_id"
                    : "NULL"
            );

        $roleExpression =
            columnExists(
                $conn,
                "tbl_audit_trail",
                "role"
            )
                ? "a.role"
                : "COALESCE(u.role, 'N/A')";

        $userJoin = tableExists(
            $conn,
            "tbl_user"
        )
            ? "
                LEFT JOIN tbl_user u
                    ON u.user_id = a.user_id
              "
            : "";

        if ($userJoin === "") {
            $roleExpression = "'N/A'";
        }

        $response["records"] = fetchAllRows(
            $conn,
            "
                SELECT
                    {$auditIdExpression}
                        AS audit_id,

                    a.created_at,
                    a.user_name,

                    {$roleExpression}
                        AS role,

                    a.module,
                    a.action,
                    a.details

                FROM tbl_audit_trail a

                {$userJoin}

                WHERE {$date}

                ORDER BY
                    a.created_at DESC
            "
        );

        respond(true, $response);
    }

    respond(
        false,
        [
            "message" =>
                "Unable to generate the selected report."
        ],
        422
    );
} catch (Throwable $error) {
    error_log(
        "report_generation/get_reports.php: " .
        $error->getMessage()
    );

    respond(
        false,
        [
            "message" =>
                "Unable to generate the selected report.",
            "error" => $error->getMessage()
        ],
        500
    );
}