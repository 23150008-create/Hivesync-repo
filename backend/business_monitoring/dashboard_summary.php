<?php

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");

function singleValue(
    PDO $conn,
    string $sql,
    array $params = []
) {
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);

    $value = $stmt->fetchColumn();

    return $value !== false
        ? $value
        : 0;
}

function fetchAllRows(
    PDO $conn,
    string $sql,
    array $params = []
): array {
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}


function tableExists(
    PDO $conn,
    string $tableName
): bool {
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

function firstExistingTable(
    PDO $conn,
    array $tableNames
): ?string {
    foreach ($tableNames as $tableName) {
        if (tableExists($conn, $tableName)) {
            return $tableName;
        }
    }

    return null;
}


function isValidDate(string $date): bool
{
    $parsedDate = DateTime::createFromFormat(
        "Y-m-d",
        $date
    );

    return $parsedDate !== false &&
        $parsedDate->format("Y-m-d") === $date;
}

try {
    $today = date("Y-m-d");

    $startDate = trim(
        $_GET["start_date"] ??
        date("Y-m-01")
    );

    $endDate = trim(
        $_GET["end_date"] ??
        date("Y-m-d")
    );

    if (
        !isValidDate($startDate) ||
        !isValidDate($endDate)
    ) {
        throw new Exception(
            "Invalid dashboard date."
        );
    }

    if ($startDate > $endDate) {
        throw new Exception(
            "Invalid dashboard date range."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Opening cash balance
    |--------------------------------------------------------------------------
    |
    | Opening Cash Balance is stored once in tbl_system_settings and represents
    | BFATC's physical cash on hand before HiveSync's recorded cash movements.
    | If the settings table/row is unavailable, safely fall back to 0.00.
    |
    */

    $openingCashBalance = 0.0;

    if (tableExists($conn, "tbl_system_settings")) {
        $openingCashBalance = (float)singleValue(
            $conn,
            "
                SELECT COALESCE(setting_value, 0)
                FROM tbl_system_settings
                WHERE setting_key = 'opening_cash_balance'
                LIMIT 1
            "
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Sales summary
    |--------------------------------------------------------------------------
    */

    $todaysSales = singleValue(
        $conn,
        "
            SELECT
                COALESCE(
                    SUM(total_amount),
                    0
                )
            FROM tbl_pos
            WHERE DATE(transaction_date) = ?
            AND COALESCE(
                transaction_status,
                'Completed'
            ) <> 'Voided'
        ",
        [$today]
    );

    $grossSales = singleValue(
        $conn,
        "
            SELECT
                COALESCE(
                    SUM(pi.subtotal),
                    0
                )
            FROM tbl_pos_items pi
            INNER JOIN tbl_pos p
                ON p.pos_id = pi.pos_id
            WHERE DATE(p.transaction_date)
                BETWEEN ? AND ?
            AND COALESCE(
                p.transaction_status,
                'Completed'
            ) <> 'Voided'
        ",
        [
            $startDate,
            $endDate
        ]
    );

    $discountTotal = singleValue(
        $conn,
        "
            SELECT
                COALESCE(
                    SUM(discount),
                    0
                )
            FROM tbl_pos
            WHERE DATE(transaction_date)
                BETWEEN ? AND ?
            AND COALESCE(
                transaction_status,
                'Completed'
            ) <> 'Voided'
        ",
        [
            $startDate,
            $endDate
        ]
    );

    $netSales = singleValue(
        $conn,
        "
            SELECT
                COALESCE(
                    SUM(total_amount),
                    0
                )
            FROM tbl_pos
            WHERE DATE(transaction_date)
                BETWEEN ? AND ?
            AND COALESCE(
                transaction_status,
                'Completed'
            ) <> 'Voided'
        ",
        [
            $startDate,
            $endDate
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Actual cash collections
    |--------------------------------------------------------------------------
    |
    | Cash on Hand must follow when cash physically enters BFATC.
    |
    | 1. Initial POS cash is recognized on the POS transaction date.
    | 2. Later receivable cash payments are recognized on their own
    |    tbl_receivable_payments.payment_date.
    | 3. Non-cash methods are not included in Cash on Hand.
    |
    | record_payment.php keeps tbl_pos.payment_amount synchronized with the
    | cumulative receivable amount paid. Because of that, reading the current
    | POS payment_amount alone would incorrectly move later collections back
    | to the original sale date. For receivable-linked sales, derive the
    | initial amount by subtracting later payment records from the receivable's
    | cumulative amount_paid.
    |
    */

    $initialCashReceived = 0.0;
    $receivableCashReceived = 0.0;

    if (
        tableExists($conn, "tbl_receivables") &&
        tableExists($conn, "tbl_receivable_payments")
    ) {
        $initialCashReceived = singleValue(
            $conn,
            "
                SELECT
                    COALESCE(
                        SUM(
                            CASE
                                WHEN LOWER(
                                    TRIM(
                                        COALESCE(
                                            p.payment_method,
                                            ''
                                        )
                                    )
                                ) <> 'cash'
                                    THEN 0

                                WHEN r.receivable_id IS NULL
                                    THEN GREATEST(
                                        COALESCE(
                                            p.payment_amount,
                                            0
                                        ) -
                                        COALESCE(
                                            p.change_amount,
                                            0
                                        ),
                                        0
                                    )

                                ELSE GREATEST(
                                    COALESCE(
                                        r.amount_paid,
                                        0
                                    ) -
                                    COALESCE(
                                        rp.later_payments,
                                        0
                                    ),
                                    0
                                )
                            END
                        ),
                        0
                    )
                FROM tbl_pos p

                LEFT JOIN tbl_receivables r
                    ON r.pos_id = p.pos_id

                LEFT JOIN (
                    SELECT
                        receivable_id,
                        COALESCE(
                            SUM(amount_paid),
                            0
                        ) AS later_payments
                    FROM tbl_receivable_payments
                    GROUP BY receivable_id
                ) rp
                    ON rp.receivable_id =
                       r.receivable_id

                WHERE DATE(p.transaction_date) <= ?

                AND COALESCE(
                    p.transaction_status,
                    'Completed'
                ) <> 'Voided'
            ",
            [
                $endDate
            ]
        );

        $receivableCashReceived = singleValue(
            $conn,
            "
                SELECT
                    COALESCE(
                        SUM(amount_paid),
                        0
                    )
                FROM tbl_receivable_payments
                WHERE DATE(payment_date) <= ?
                AND LOWER(
                    TRIM(
                        COALESCE(
                            payment_method,
                            ''
                        )
                    )
                ) = 'cash'
            ",
            [
                $endDate
            ]
        );
    } else {
        /*
         * Compatibility fallback for installations that do not yet have
         * receivable tables. Fully/initially paid Cash POS transactions keep
         * the same original calculation.
         */
        $initialCashReceived = singleValue(
            $conn,
            "
                SELECT
                    COALESCE(
                        SUM(
                            GREATEST(
                                COALESCE(
                                    payment_amount,
                                    0
                                ) -
                                COALESCE(
                                    change_amount,
                                    0
                                ),
                                0
                            )
                        ),
                        0
                    )
                FROM tbl_pos
                WHERE DATE(transaction_date) <= ?
                AND COALESCE(
                    transaction_status,
                    'Completed'
                ) <> 'Voided'
                AND LOWER(
                    TRIM(
                        COALESCE(
                            payment_method,
                            ''
                        )
                    )
                ) = 'cash'
            ",
            [
                $endDate
            ]
        );
    }

    $cashReceived =
        (float)$initialCashReceived +
        (float)$receivableCashReceived;

    /*
    |--------------------------------------------------------------------------
    | Receivables
    |--------------------------------------------------------------------------
    */

    $totalReceivable = 0;

    $receivableTable = firstExistingTable(
        $conn,
        [
            "tbl_receivables",
            "tbl_receivable",
            "tbl_pos_receivables"
        ]
    );

    if ($receivableTable) {
        foreach (
            [
                "remaining_balance",
                "outstanding_balance",
                "balance"
            ]
            as $balanceColumn
        ) {
            if (
                columnExists(
                    $conn,
                    $receivableTable,
                    $balanceColumn
                )
            ) {
                $totalReceivable =
                    singleValue(
                        $conn,
                        "
                            SELECT
                                COALESCE(
                                    SUM(`{$balanceColumn}`),
                                    0
                                )
                            FROM `{$receivableTable}`
                        "
                    );

                break;
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Supplier and cost summary
    |--------------------------------------------------------------------------
    */

    /*
     * Supplier Remittance represents money actually paid to suppliers.
     * Delivered product value belongs to supplier payables/cost exposure;
     * it must not be presented as if cash has already been remitted.
     */
    $supplierRemittance = 0.0;
    $cashSupplierPayments = 0.0;

    if (tableExists($conn, "tbl_supplier_payment")) {
        $supplierRemittance = singleValue(
            $conn,
            "
                SELECT
                    COALESCE(
                        SUM(amount_paid),
                        0
                    )
                FROM tbl_supplier_payment
                WHERE DATE(payment_date)
                    BETWEEN ? AND ?
            ",
            [
                $startDate,
                $endDate
            ]
        );

        /*
         * Only supplier payments actually made using Cash reduce the
         * Dashboard's Cash on Hand. GCash, Bank Transfer, Cheque and other
         * payment methods remain supplier remittances but are not physical
         * cash outflows.
         */
        $cashSupplierPayments = singleValue(
            $conn,
            "
                SELECT
                    COALESCE(
                        SUM(amount_paid),
                        0
                    )
                FROM tbl_supplier_payment
                WHERE DATE(payment_date) <= ?
                AND LOWER(
                    TRIM(
                        COALESCE(
                            payment_method,
                            ''
                        )
                    )
                ) = 'cash'
            ",
            [
                $endDate
            ]
        );
    }

    $supplierCost = singleValue(
        $conn,
        "
            SELECT
                COALESCE(
                    SUM(
                        pi.quantity *
                        COALESCE(
                            i.supplier_price,
                            0
                        )
                    ),
                    0
                )
            FROM tbl_pos_items pi
            INNER JOIN tbl_pos p
                ON p.pos_id = pi.pos_id
            INNER JOIN tbl_inv i
                ON i.product_id =
                   pi.product_id
            WHERE DATE(p.transaction_date)
                BETWEEN ? AND ?
            AND COALESCE(
                p.transaction_status,
                'Completed'
            ) <> 'Voided'
        ",
        [
            $startDate,
            $endDate
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Expenses and profit
    |--------------------------------------------------------------------------
    */

    $operatingExpenses = 0;

    $cashOperatingExpenses = 0.0;

    if (tableExists($conn, "tbl_expense")) {
        $operatingExpenses = singleValue(
            $conn,
            "
                SELECT
                    COALESCE(
                        SUM(total_cost),
                        0
                    )
                FROM tbl_expense
                WHERE COALESCE(
                    status,
                    'Active'
                ) <> 'Archived'
                AND expense_date
                    BETWEEN ? AND ?
            ",
            [
                $startDate,
                $endDate
            ]
        );

        /*
         * Cash on Hand is a running balance, so use all active operating
         * expenses up to the selected end date for the cash-flow calculation.
         */
        $cashOperatingExpenses = singleValue(
            $conn,
            "
                SELECT
                    COALESCE(
                        SUM(total_cost),
                        0
                    )
                FROM tbl_expense
                WHERE COALESCE(
                    status,
                    'Active'
                ) <> 'Archived'
                AND expense_date <= ?
            ",
            [
                $endDate
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Actual cash on hand
    |--------------------------------------------------------------------------
    |
    | Running physical cash balance up to the selected end date:
    |
    | Starting cash:
    |   - opening_cash_balance from tbl_system_settings
    |
    | Cash entering BFATC:
    |   - initial Cash POS collections
    |   - later Cash receivable collections
    |
    | Cash leaving BFATC:
    |   - operating expenses
    |   - supplier payments whose payment method is Cash
    |
    | Supplier payments made through GCash, Bank Transfer, Cheque or Other
    | are still included in Supplier Remittance, but they are not deducted
    | from this physical Cash on Hand figure.
    |
    */

    $cashOnHand =
        (float)$openingCashBalance +
        (float)$cashReceived -
        (float)$cashOperatingExpenses -
        (float)$cashSupplierPayments;

    $netProfit =
        (float)$netSales -
        (float)$supplierCost -
        (float)$operatingExpenses;

    /*
    |--------------------------------------------------------------------------
    | Inventory summary
    |--------------------------------------------------------------------------
    */

    $activeInventory = singleValue(
        $conn,
        "
            SELECT COUNT(*)
            FROM tbl_inv
            WHERE COALESCE(
                status,
                'In Stock'
            ) <> 'Archived'
        "
    );

    $inventoryValue = singleValue(
        $conn,
        "
            SELECT
                COALESCE(
                    SUM(
                        quantity *
                        selling_price
                    ),
                    0
                )
            FROM tbl_inv
            WHERE COALESCE(
                status,
                'In Stock'
            ) <> 'Archived'
        "
    );

    $lowStockItems = singleValue(
        $conn,
        "
            SELECT COUNT(*)
            FROM tbl_inv
            WHERE COALESCE(
                status,
                'In Stock'
            ) <> 'Archived'
            AND quantity <=
                COALESCE(
                    reorder_level,
                    0
                )
        "
    );

    /*
    |--------------------------------------------------------------------------
    | Delivery and supplier summary
    |--------------------------------------------------------------------------
    */

    $pendingDeliveries = singleValue(
        $conn,
        "
            SELECT COUNT(*)
            FROM tbl_delivery
            WHERE status = 'Pending'
        "
    );

    $vendorPartners = singleValue(
        $conn,
        "
            SELECT COUNT(*)
            FROM tbl_vendor
            WHERE COALESCE(
                status,
                'Active'
            ) = 'Active'
        "
    );

    /*
    |--------------------------------------------------------------------------
    | Product-action approvals
    |--------------------------------------------------------------------------
    */

    $pendingApprovals = 0;

    $productActionTableExists =
        singleValue(
            $conn,
            "
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema =
                      DATABASE()
                AND table_name =
                    'tbl_product_action_request'
            "
        );

    if ((int)$productActionTableExists > 0) {
        $pendingApprovals =
            singleValue(
                $conn,
                "
                    SELECT COUNT(*)
                    FROM tbl_product_action_request
                    WHERE status = 'Pending'
                "
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Near-expiry items
    |--------------------------------------------------------------------------
    */

    $nearExpiryItems = fetchAllRows(
        $conn,
        "
            SELECT
                product_id,
                product_name,
                sku,
                quantity,
                expiry_date
            FROM tbl_inv
            WHERE expiry_date IS NOT NULL
            AND expiry_date > CURDATE()
            AND expiry_date <=
                DATE_ADD(
                    CURDATE(),
                    INTERVAL 30 DAY
                )
            AND COALESCE(
                status,
                'In Stock'
            ) <> 'Archived'
            ORDER BY
                expiry_date ASC,
                product_name ASC
            LIMIT 6
        "
    );

    /*
    |--------------------------------------------------------------------------
    | Recent sales
    |--------------------------------------------------------------------------
    */

    $recentSales = fetchAllRows(
        $conn,
        "
            SELECT
                pos_id,
                transaction_code,
                customer_name,
                total_amount,
                discount,
                payment_amount,
                change_amount,
                transaction_date
            FROM tbl_pos
            WHERE DATE(transaction_date)
                BETWEEN ? AND ?
            AND COALESCE(
                transaction_status,
                'Completed'
            ) <> 'Voided'
            ORDER BY
                transaction_date DESC,
                pos_id DESC
            LIMIT 6
        ",
        [
            $startDate,
            $endDate
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Best-selling products
    |--------------------------------------------------------------------------
    */

    $bestSellingProducts =
        fetchAllRows(
            $conn,
            "
                SELECT
                    i.product_id,
                    i.product_name,

                    COALESCE(
                        SUM(pi.quantity),
                        0
                    ) AS total_sold,

                    COALESCE(
                        SUM(pi.subtotal),
                        0
                    ) AS gross_sales,

                    COALESCE(
                        SUM(pi.subtotal),
                        0
                    ) AS total_sales

                FROM tbl_pos_items pi

                INNER JOIN tbl_pos p
                    ON p.pos_id =
                       pi.pos_id

                INNER JOIN tbl_inv i
                    ON i.product_id =
                       pi.product_id

                WHERE DATE(
                    p.transaction_date
                ) BETWEEN ? AND ?

                AND COALESCE(
                    p.transaction_status,
                    'Completed'
                ) <> 'Voided'

                GROUP BY
                    i.product_id,
                    i.product_name

                ORDER BY
                    total_sold DESC,
                    total_sales DESC

                LIMIT 6
            ",
            [
                $startDate,
                $endDate
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Supplier remittance list
    |--------------------------------------------------------------------------
    */

    $supplierRemittanceList = [];

    if (tableExists($conn, "tbl_supplier_payment")) {
        $supplierRemittanceList =
            fetchAllRows(
                $conn,
                "
                    SELECT
                        v.vendor_id,

                        COALESCE(
                            v.vendor_name,
                            'Unknown Supplier'
                        ) AS vendor_name,

                        COALESCE(
                            paid_deliveries.deliveries,
                            0
                        ) AS deliveries,

                        COALESCE(
                            payments.remittance_amount,
                            0
                        ) AS remittance_amount

                    FROM tbl_vendor v

                    LEFT JOIN (
                        SELECT
                            vendor_id,
                            COALESCE(
                                SUM(amount_paid),
                                0
                            ) AS remittance_amount
                        FROM tbl_supplier_payment
                        WHERE DATE(payment_date)
                            BETWEEN ? AND ?
                        GROUP BY vendor_id
                    ) payments
                        ON payments.vendor_id =
                           v.vendor_id

                    LEFT JOIN (
                        SELECT
                            sp.vendor_id,
                            COUNT(
                                DISTINCT roi.delivery_id
                            ) AS deliveries
                        FROM tbl_supplier_payment sp
                        LEFT JOIN tbl_remittance_order_items roi
                            ON roi.remittance_order_id =
                               sp.remittance_order_id
                        WHERE DATE(sp.payment_date)
                            BETWEEN ? AND ?
                        GROUP BY sp.vendor_id
                    ) paid_deliveries
                        ON paid_deliveries.vendor_id =
                           v.vendor_id

                    WHERE COALESCE(
                        v.status,
                        'Active'
                    ) = 'Active'

                    ORDER BY
                        COALESCE(
                            payments.remittance_amount,
                            0
                        ) DESC,
                        v.vendor_name ASC
                ",
                [
                    $startDate,
                    $endDate,
                    $startDate,
                    $endDate
                ]
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Recent deliveries
    |--------------------------------------------------------------------------
    */

    $recentDeliveries = fetchAllRows(
        $conn,
        "
            SELECT
                d.delivery_id,
                d.delivery_order_no,
                d.delivery_date,
                d.status,
                d.amount,

                COALESCE(
                    v.vendor_name,
                    d.business_name,
                    'No Supplier'
                ) AS vendor_name

            FROM tbl_delivery d

            LEFT JOIN tbl_vendor v
                ON v.vendor_id =
                   d.vendor_id

            WHERE COALESCE(
                d.status,
                ''
            ) <> 'Archived'

            ORDER BY
                d.delivery_date DESC,
                d.delivery_id DESC

            LIMIT 6
        "
    );

    /*
    |--------------------------------------------------------------------------
    | Low-stock products
    |--------------------------------------------------------------------------
    */

    $lowStockProducts = fetchAllRows(
        $conn,
        "
            SELECT
                product_id,
                product_name,
                sku,
                quantity,
                reorder_level,
                status
            FROM tbl_inv
            WHERE COALESCE(
                status,
                'In Stock'
            ) <> 'Archived'
            AND quantity <=
                COALESCE(
                    reorder_level,
                    0
                )
            ORDER BY
                quantity ASC,
                product_name ASC
            LIMIT 6
        "
    );

    /*
    |--------------------------------------------------------------------------
    | Revenue chart — last 12 months
    |--------------------------------------------------------------------------
    */

    $revenueChart = [];

    for ($index = 11; $index >= 0; $index--) {
        $monthStart = date(
            "Y-m-01",
            strtotime(
                "-{$index} months"
            )
        );

        $monthEnd = date(
            "Y-m-t",
            strtotime($monthStart)
        );

        $monthName = date(
            "M",
            strtotime($monthStart)
        );

        $monthGross = singleValue(
            $conn,
            "
                SELECT
                    COALESCE(
                        SUM(pi.subtotal),
                        0
                    )
                FROM tbl_pos_items pi
                INNER JOIN tbl_pos p
                    ON p.pos_id =
                       pi.pos_id
                WHERE DATE(
                    p.transaction_date
                ) BETWEEN ? AND ?
                AND COALESCE(
                    p.transaction_status,
                    'Completed'
                ) <> 'Voided'
            ",
            [
                $monthStart,
                $monthEnd
            ]
        );

        $monthNet = singleValue(
            $conn,
            "
                SELECT
                    COALESCE(
                        SUM(total_amount),
                        0
                    )
                FROM tbl_pos
                WHERE DATE(
                    transaction_date
                ) BETWEEN ? AND ?
                AND COALESCE(
                    transaction_status,
                    'Completed'
                ) <> 'Voided'
            ",
            [
                $monthStart,
                $monthEnd
            ]
        );

        $revenueChart[] = [
            "month_name" =>
                $monthName,

            "month_start" =>
                $monthStart,

            "gross_sales" =>
                (float)$monthGross,

            "net_sales" =>
                (float)$monthNet,

            "pos_sales" =>
                (float)$monthNet
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Final response
    |--------------------------------------------------------------------------
    */

    echo json_encode(
        [
            "success" => true,

            "filters" => [
                "start_date" =>
                    $startDate,

                "end_date" =>
                    $endDate
            ],

            "summary" => [
                "todays_sales" =>
                    (float)$todaysSales,

                "gross_sales" =>
                    (float)$grossSales,

                "discount_total" =>
                    (float)$discountTotal,

                "net_sales" =>
                    (float)$netSales,

                "cash_on_hand" =>
                    (float)$cashOnHand,

                "opening_cash_balance" =>
                    (float)$openingCashBalance,

                "total_receivable" =>
                    (float)$totalReceivable,

                "supplier_remittance" =>
                    (float)$supplierRemittance,

                "supplier_cost" =>
                    (float)$supplierCost,

                "operating_expenses" =>
                    (float)$operatingExpenses,

                "net_profit" =>
                    (float)$netProfit,

                "monthly_revenue" =>
                    (float)$netSales,

                "active_inventory" =>
                    (int)$activeInventory,

                "inventory_value" =>
                    (float)$inventoryValue,

                "low_stock_items" =>
                    (int)$lowStockItems,

                "pending_deliveries" =>
                    (int)$pendingDeliveries,

                "vendor_partners" =>
                    (int)$vendorPartners,

                "pending_approvals" =>
                    (int)$pendingApprovals
            ],

            "recent_sales" =>
                $recentSales,

            "best_selling_products" =>
                $bestSellingProducts,

            "supplier_remittance_list" =>
                $supplierRemittanceList,

            "recent_deliveries" =>
                $recentDeliveries,

            "low_stock_products" =>
                $lowStockProducts,

            "near_expiry_items" =>
                $nearExpiryItems,

            "revenue_chart" =>
                $revenueChart
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );
} catch (Throwable $e) {
    error_log(
        "HiveSync dashboard error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode(
        [
            "success" => false,
            "message" =>
                "Failed to load dashboard data.",

            "summary" => [
                "todays_sales" => 0,
                "gross_sales" => 0,
                "discount_total" => 0,
                "net_sales" => 0,
                "cash_on_hand" => 0,
                "opening_cash_balance" => 0,
                "total_receivable" => 0,
                "supplier_remittance" => 0,
                "supplier_cost" => 0,
                "operating_expenses" => 0,
                "net_profit" => 0,
                "monthly_revenue" => 0,
                "active_inventory" => 0,
                "inventory_value" => 0,
                "low_stock_items" => 0,
                "pending_deliveries" => 0,
                "vendor_partners" => 0,
                "pending_approvals" => 0
            ],

            "recent_sales" => [],
            "best_selling_products" => [],
            "supplier_remittance_list" => [],
            "recent_deliveries" => [],
            "low_stock_products" => [],
            "near_expiry_items" => [],
            "revenue_chart" => []
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );
}