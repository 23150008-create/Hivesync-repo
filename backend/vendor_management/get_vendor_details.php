<?php

date_default_timezone_set("Asia/Manila");





require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("vendors");

function respond(
    bool $success,
    string $message,
    array $extra = [],
    int $statusCode = 200
): void {
    http_response_code($statusCode);

    echo json_encode(array_merge([
        "success" => $success,
        "message" => $message
    ], $extra));

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

function selectColumn(
    PDO $conn,
    string $table,
    string $alias,
    string $column,
    string $fallback = "NULL"
): string {
    return columnExists($conn, $table, $column)
        ? "{$alias}.`{$column}`"
        : "{$fallback} AS `{$column}`";
}

function safeFetchAll(
    PDO $conn,
    string $sql,
    array $params,
    array &$warnings,
    string $section
): array {
    try {
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        $warnings[] =
            "{$section}: " . $e->getMessage();

        error_log(
            "HiveSync supplier profile {$section} error: " .
            $e->getMessage()
        );

        return [];
    }
}

$vendorId = filter_var(
    $_GET["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

$emptyPayload = [
    "supplier" => null,
    "summary" => [],
    "products" => [],
    "deliveries" => [],
    "payables" => [],
    "payments" => [],
    "remittances" => [],
    "consignments" => []
];

if (!$vendorId) {
    respond(
        false,
        "A valid supplier ID is required.",
        $emptyPayload,
        422
    );
}

enforceSupplierVendorAccess((int)$vendorId);

try {
    if (!tableExists($conn, "tbl_vendor")) {
        throw new Exception(
            "Supplier table is unavailable."
        );
    }

    $supplierStmt = $conn->prepare("
        SELECT
            vendor_id,
            vendor_name,
            contact_person,
            phone,
            address,
            status,
            created_at
        FROM tbl_vendor
        WHERE vendor_id = :vendor_id
        LIMIT 1
    ");

    $supplierStmt->execute([
        ":vendor_id" => $vendorId
    ]);

    $supplier =
        $supplierStmt->fetch(PDO::FETCH_ASSOC);

    if (!$supplier) {
        respond(
            false,
            "Supplier record was not found.",
            $emptyPayload,
            404
        );
    }

    $warnings = [];
    $products = [];
    $deliveries = [];
    $payables = [];
    $payments = [];
    $remittances = [];
    $consignments = [];

    

    if (tableExists($conn, "tbl_inv")) {
        $categorySelect =
            selectColumn(
                $conn,
                "tbl_inv",
                "i",
                "category",
                "'Uncategorized'"
            );

        if (
            tableExists($conn, "tbl_category") &&
            columnExists($conn, "tbl_inv", "category_id")
        ) {
            $categoryJoin = "
                LEFT JOIN tbl_category c
                    ON c.category_id = i.category_id
            ";

            $categoryExpression = "
                COALESCE(
                    c.category_name,
                    {$categorySelect},
                    'Uncategorized'
                ) AS category
            ";
        } else {
            $categoryJoin = "";
            $categoryExpression = "
                COALESCE(
                    {$categorySelect},
                    'Uncategorized'
                ) AS category
            ";
        }

        $statusFilter =
            columnExists($conn, "tbl_inv", "status")
                ? "AND COALESCE(i.status, '') <> 'Archived'"
                : "";

        $unitTypeSelect =
            selectColumn(
                $conn,
                "tbl_inv",
                "i",
                "unit_type",
                "'pcs'"
            );

        $unitSelect =
            selectColumn(
                $conn,
                "tbl_inv",
                "i",
                "unit",
                "'pcs'"
            );

        $deliveryJoin = "";

        if (
            tableExists($conn, "tbl_delivery_items") &&
            tableExists($conn, "tbl_delivery")
        ) {
            $deliveryJoin = "
                LEFT JOIN (
                    SELECT
                        di.product_id,
                        SUM(di.quantity)
                            AS total_delivered_quantity,
                        COUNT(DISTINCT di.delivery_id)
                            AS delivery_frequency,
                        MAX(d.delivery_date)
                            AS last_delivery_date
                    FROM tbl_delivery_items di
                    INNER JOIN tbl_delivery d
                        ON d.delivery_id = di.delivery_id
                    WHERE di.vendor_id = :delivery_vendor
                    AND d.status <> 'Archived'
                    GROUP BY di.product_id
                ) delivery_data
                    ON delivery_data.product_id =
                       i.product_id
            ";

            $deliverySummarySelect = "
                COALESCE(
                    delivery_data.total_delivered_quantity,
                    0
                ) AS total_delivered_quantity,

                COALESCE(
                    delivery_data.delivery_frequency,
                    0
                ) AS delivery_frequency,

                delivery_data.last_delivery_date
            ";
        } else {
            $deliverySummarySelect = "
                0 AS total_delivered_quantity,
                0 AS delivery_frequency,
                NULL AS last_delivery_date
            ";
        }

        $productParams = [
            ":vendor_id" => $vendorId
        ];

        if ($deliveryJoin !== "") {
            $productParams[":delivery_vendor"] =
                $vendorId;
        }

        $products = safeFetchAll(
            $conn,
            "
            SELECT
                i.product_id,
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "product_name",
                    "'Unnamed Product'"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "sku",
                    "''"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "category_id",
                    "NULL"
                ) . ",
                {$categoryExpression},
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "quantity",
                    "0"
                ) . " AS current_stock,
                {$unitTypeSelect},
                {$unitSelect},
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "reorder_level",
                    "0"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "supplier_price",
                    "0"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "selling_price",
                    "0"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "expiry_date",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "product_image",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "status",
                    "'Active'"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "is_consignment",
                    "0"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "consignment_terms",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "consignment_start_date",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "consignment_pullout_date",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "consignment_notes",
                    "NULL"
                ) . ",
                {$deliverySummarySelect}

            FROM tbl_inv i

            {$categoryJoin}
            {$deliveryJoin}

            WHERE i.vendor_id = :vendor_id
            {$statusFilter}

            ORDER BY
                last_delivery_date DESC,
                product_name ASC
            ",
            $productParams,
            $warnings,
            "Products"
        );
    }

    

    if (tableExists($conn, "tbl_delivery")) {
        $deliveryItemJoin = "";
        $deliveryAggregateSelect = "
            0 AS product_line_count,
            0 AS delivered_quantity,
            0 AS supplier_payable_amount
        ";
        $deliveryGroupBy = "";

        if (tableExists($conn, "tbl_delivery_items")) {
            $deliveryItemJoin = "
                LEFT JOIN tbl_delivery_items di
                    ON di.delivery_id =
                       d.delivery_id
            ";

            $deliveryAggregateSelect = "
                COUNT(di.product_id)
                    AS product_line_count,

                COALESCE(
                    SUM(di.quantity),
                    0
                ) AS delivered_quantity,

                COALESCE(
                    SUM(
                        di.quantity *
                        di.supplier_price
                    ),
                    0
                ) AS supplier_payable_amount
            ";

            $deliveryGroupBy =
                "GROUP BY d.delivery_id";
        }

        $deliveries = safeFetchAll(
            $conn,
            "
            SELECT
                d.delivery_id,
                " .
                selectColumn(
                    $conn,
                    "tbl_delivery",
                    "d",
                    "delivery_order_no",
                    "CONCAT('Delivery ', d.delivery_id)"
                ) . ",
                d.vendor_id,
                " .
                selectColumn(
                    $conn,
                    "tbl_delivery",
                    "d",
                    "items_count",
                    "0"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_delivery",
                    "d",
                    "amount",
                    "0"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_delivery",
                    "d",
                    "driver",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_delivery",
                    "d",
                    "delivery_date",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_delivery",
                    "d",
                    "remarks",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_delivery",
                    "d",
                    "received_by",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_delivery",
                    "d",
                    "noted_by",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_delivery",
                    "d",
                    "status",
                    "'Pending'"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_delivery",
                    "d",
                    "created_at",
                    "NULL"
                ) . ",
                {$deliveryAggregateSelect}

            FROM tbl_delivery d
            {$deliveryItemJoin}

            WHERE d.vendor_id = :vendor_id
            AND COALESCE(d.status, '') <> 'Archived'

            {$deliveryGroupBy}

            ORDER BY
                d.delivery_date DESC,
                d.delivery_id DESC
            ",
            [
                ":vendor_id" => $vendorId
            ],
            $warnings,
            "Deliveries"
        );
    }

    

    if (tableExists($conn, "tbl_supplier_payable")) {
        $deliveryJoin = tableExists(
            $conn,
            "tbl_delivery"
        )
            ? "
                LEFT JOIN tbl_delivery d
                    ON d.delivery_id =
                       sp.delivery_id
              "
            : "";

        $deliveryNumber = tableExists(
            $conn,
            "tbl_delivery"
        )
            ? "d.delivery_order_no"
            : "CONCAT('Delivery ', sp.delivery_id) AS delivery_order_no";

        $deliveryDate = tableExists(
            $conn,
            "tbl_delivery"
        )
            ? "d.delivery_date"
            : "NULL AS delivery_date";

        $payables = safeFetchAll(
            $conn,
            "
            SELECT
                sp.payable_id,
                sp.vendor_id,
                sp.delivery_id,
                sp.payable_amount,
                sp.paid_amount,
                sp.balance_amount,
                sp.payment_status,
                sp.due_date,
                sp.notes,
                sp.created_at,
                sp.updated_at,
                {$deliveryNumber},
                {$deliveryDate},

                CASE
                    WHEN sp.balance_amount > 0
                    AND sp.due_date IS NOT NULL
                    AND sp.due_date < CURDATE()
                        THEN 1
                    ELSE 0
                END AS is_overdue

            FROM tbl_supplier_payable sp
            {$deliveryJoin}

            WHERE sp.vendor_id = :vendor_id

            ORDER BY
                sp.created_at DESC,
                sp.payable_id DESC
            ",
            [
                ":vendor_id" => $vendorId
            ],
            $warnings,
            "Payables"
        );
    }

    

    if (tableExists($conn, "tbl_supplier_payment")) {
        $paymentIdColumn =
            columnExists(
                $conn,
                "tbl_supplier_payment",
                "supplier_payment_id"
            )
                ? "supplier_payment_id"
                : (
                    columnExists(
                        $conn,
                        "tbl_supplier_payment",
                        "payment_id"
                    )
                        ? "payment_id"
                        : null
                );

        if ($paymentIdColumn) {
            $payments = safeFetchAll(
                $conn,
                "
                SELECT
                    `{$paymentIdColumn}`
                        AS supplier_payment_id,
                    payment_no,
                    remittance_order_id,
                    vendor_id,
                    amount_paid,
                    payment_date,
                    payment_method,
                    reference_number,
                    received_by,
                    processed_by,
                    remarks,
                    created_at
                FROM tbl_supplier_payment
                WHERE vendor_id = :vendor_id
                ORDER BY
                    payment_date DESC,
                    `{$paymentIdColumn}` DESC
                ",
                [
                    ":vendor_id" => $vendorId
                ],
                $warnings,
                "Payments"
            );
        }
    }

    

    if (tableExists($conn, "tbl_remittance_order")) {
        $remittances = safeFetchAll(
            $conn,
            "
            SELECT
                remittance_order_id,
                remittance_order_no,
                vendor_id,
                total_amount,
                payment_method,
                reference_number,
                prepared_by,
                approved_by,
                release_date,
                status,
                remarks,
                created_at,
                updated_at
            FROM tbl_remittance_order
            WHERE vendor_id = :vendor_id
            ORDER BY
                created_at DESC,
                remittance_order_id DESC
            ",
            [
                ":vendor_id" => $vendorId
            ],
            $warnings,
            "Remittances"
        );
    }

    

    if (
        tableExists($conn, "tbl_consignment") &&
        columnExists(
            $conn,
            "tbl_consignment",
            "vendor_id"
        )
    ) {
        $consignments = safeFetchAll(
            $conn,
            "
            SELECT *
            FROM tbl_consignment
            WHERE vendor_id = :vendor_id
            ORDER BY consignment_id DESC
            ",
            [
                ":vendor_id" => $vendorId
            ],
            $warnings,
            "Consignments"
        );
    } elseif (
        tableExists($conn, "tbl_inv") &&
        columnExists(
            $conn,
            "tbl_inv",
            "is_consignment"
        )
    ) {
        $consignmentStatusFilter =
            columnExists(
                $conn,
                "tbl_inv",
                "status"
            )
                ? "AND COALESCE(i.status, '') <> 'Archived'"
                : "";

        $consignments = safeFetchAll(
            $conn,
            "
            SELECT
                i.product_id,
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "product_name",
                    "'Consignment Product'"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "sku",
                    "''"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "quantity",
                    "0"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "unit_type",
                    "'pcs'"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "consignment_terms",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "consignment_start_date",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "consignment_pullout_date",
                    "NULL"
                ) . ",
                " .
                selectColumn(
                    $conn,
                    "tbl_inv",
                    "i",
                    "consignment_notes",
                    "NULL"
                ) . ",

                CASE
                    WHEN " .
                    (
                        columnExists(
                            $conn,
                            "tbl_inv",
                            "consignment_pullout_date"
                        )
                            ? "i.consignment_pullout_date IS NULL"
                            : "1 = 1"
                    ) . "
                        THEN 'No Pull-out Date'

                    WHEN i.consignment_pullout_date <
                         CURDATE()
                        THEN 'Overdue'

                    WHEN i.consignment_pullout_date <=
                         DATE_ADD(
                             CURDATE(),
                             INTERVAL 7 DAY
                         )
                        THEN 'Due Soon'

                    ELSE 'Active'
                END AS consignment_status

            FROM tbl_inv i

            WHERE i.vendor_id = :vendor_id
            AND i.is_consignment = 1
            {$consignmentStatusFilter}

            ORDER BY product_name ASC
            ",
            [
                ":vendor_id" => $vendorId
            ],
            $warnings,
            "Inventory Consignments"
        );
    }

    

    $summary = [
        "product_count" => count($products),
        "delivery_count" => count($deliveries),
        "pending_deliveries" => 0,
        "in_transit_deliveries" => 0,
        "delivered_deliveries" => 0,
        "total_delivered_quantity" => 0,
        "total_delivery_value" => 0,
        "total_payable" => 0,
        "total_paid" => 0,
        "outstanding_balance" => 0,
        "ready_for_payment" => 0,
        "overdue_payments" => 0,
        "consignment_count" =>
            count($consignments),
        "last_delivery_date" => null
    ];

    foreach ($deliveries as $delivery) {
        $summary["total_delivered_quantity"] +=
            (int)($delivery["delivered_quantity"] ?? 0);

        $status =
            $delivery["status"] ?? "";

        if ($status === "Pending") {
            $summary["pending_deliveries"]++;
        } elseif ($status === "In Transit") {
            $summary["in_transit_deliveries"]++;
        } elseif ($status === "Delivered") {
            $summary["delivered_deliveries"]++;

            $summary["total_delivery_value"] +=
                (float)($delivery["amount"] ?? 0);
        }

        $deliveryDate =
            $delivery["delivery_date"] ?? null;

        if (
            $deliveryDate &&
            (
                !$summary["last_delivery_date"] ||
                $deliveryDate >
                    $summary["last_delivery_date"]
            )
        ) {
            $summary["last_delivery_date"] =
                $deliveryDate;
        }
    }

    foreach ($payables as $payable) {
        $summary["total_payable"] +=
            (float)($payable["payable_amount"] ?? 0);

        $summary["total_paid"] +=
            (float)($payable["paid_amount"] ?? 0);

        $summary["outstanding_balance"] +=
            (float)($payable["balance_amount"] ?? 0);

        if (
            ($payable["payment_status"] ?? "") ===
            "Ready for Payment"
        ) {
            $summary["ready_for_payment"] +=
                (float)(
                    $payable["balance_amount"] ?? 0
                );
        }

        if (
            (int)($payable["is_overdue"] ?? 0) === 1
        ) {
            $summary["overdue_payments"]++;
        }
    }

    $supplier["product_count"] =
        $summary["product_count"];

    $supplier["delivery_count"] =
        $summary["delivery_count"];

    $supplier["last_delivery_date"] =
        $summary["last_delivery_date"];

    $supplier["total_delivered_quantity"] =
        $summary["total_delivered_quantity"];

    $supplier["total_delivery_value"] =
        $summary["total_delivery_value"];

    respond(
        true,
        "Supplier business profile retrieved successfully.",
        [
            "supplier" => $supplier,
            "summary" => $summary,
            "products" => $products,
            "deliveries" => $deliveries,
            "payables" => $payables,
            "payments" => $payments,
            "remittances" => $remittances,
            "consignments" => $consignments,
            "warnings" => $warnings
        ]
    );
} catch (Throwable $e) {
    error_log(
        "HiveSync supplier profile fatal error: " .
        $e->getMessage()
    );

    respond(
        false,
        "Unable to retrieve the supplier business profile.",
        array_merge(
            $emptyPayload
        ),
        500
    );
}