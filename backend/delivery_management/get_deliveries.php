<?php

declare(strict_types=1);

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireAuthentication();

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

function optionalItemColumn(
    PDO $conn,
    string $column,
    string $fallbackSql
): string {
    return columnExists(
        $conn,
        "tbl_delivery_items",
        $column
    )
        ? "di.`{$column}` AS `{$column}`,"
        : "{$fallbackSql} AS `{$column}`,";
}

function optionalDeliveryColumn(
    PDO $conn,
    string $column,
    string $fallbackSql
): string {
    return columnExists(
        $conn,
        "tbl_delivery",
        $column
    )
        ? "d.`{$column}` AS `{$column}`,"
        : "{$fallbackSql} AS `{$column}`,";
}

$includeArchived =
    isset($_GET["archived"]) &&
    $_GET["archived"] === "1";

$sessionRole = trim((string)($_SESSION["role"] ?? ""));
$vendorId = filter_var(
    $_GET["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (in_array($sessionRole, ["Supplier", "Vendor"], true)) {
    $vendorId = (int)($_SESSION["vendor_id"] ?? 0);

    if ($vendorId <= 0) {
        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Your supplier account is not linked to a valid supplier record.",
            "deliveries" => []
        ]);

        exit;
    }
} else {
    requireModulePermission("deliveries");
}

try {
    $hasPayableTable = tableExists(
        $conn,
        "tbl_supplier_payable"
    );

    $hasSupplierPayableColumn = columnExists(
        $conn,
        "tbl_delivery",
        "supplier_payable_amount"
    );

    $hasNewProductFlag = columnExists(
        $conn,
        "tbl_delivery_items",
        "is_new_product"
    );

    $hasProposedProductName = columnExists(
        $conn,
        "tbl_delivery_items",
        "proposed_product_name"
    );

    










    $newProductCountExpression =
        $hasNewProductFlag
            ? "SUM(
                CASE
                    WHEN COALESCE(is_new_product, 0) = 1
                         OR product_id IS NULL
                        THEN 1
                    ELSE 0
                END
              )"
            : "SUM(
                CASE
                    WHEN product_id IS NULL
                        THEN 1
                    ELSE 0
                END
              )";

    $proposedProductPreviewExpression =
        $hasProposedProductName
            ? "GROUP_CONCAT(
                DISTINCT NULLIF(
                    TRIM(proposed_product_name),
                    ''
                )
                ORDER BY delivery_item_id
                SEPARATOR ', '
              )"
            : "NULL";

    $whereClauses = [];

    $whereClauses[] = $includeArchived
        ? "d.status = 'Archived'"
        : "d.status <> 'Archived'";

    $params = [];

    if ($vendorId) {
        $whereClauses[] =
            "d.vendor_id = :vendor_id";

        $params[":vendor_id"] =
            $vendorId;
    }

    $whereSql = implode(
        " AND ",
        $whereClauses
    );

    $supplierPayableSelect =
        $hasSupplierPayableColumn
            ? "
                COALESCE(
                    d.supplier_payable_amount,
                    payable_data.payable_amount,
                    item_totals.supplier_payable_amount,
                    0
                ) AS supplier_payable_amount,
              "
            : "
                COALESCE(
                    payable_data.payable_amount,
                    item_totals.supplier_payable_amount,
                    0
                ) AS supplier_payable_amount,
              ";

    $payableSelect = $hasPayableTable
        ? "
            payable_data.payable_id,
            payable_data.payable_amount,
            payable_data.paid_amount,
            payable_data.balance_amount,
            payable_data.payment_status,
            payable_data.due_date,
          "
        : "
            NULL AS payable_id,
            0 AS payable_amount,
            0 AS paid_amount,
            0 AS balance_amount,
            'Not Generated' AS payment_status,
            NULL AS due_date,
          ";

    $payableJoin = $hasPayableTable
        ? "
            LEFT JOIN tbl_supplier_payable payable_data
                ON payable_data.delivery_id =
                   d.delivery_id
          "
        : "
            LEFT JOIN (
                SELECT
                    NULL AS delivery_id,
                    NULL AS payable_id,
                    0 AS payable_amount,
                    0 AS paid_amount,
                    0 AS balance_amount,
                    'Not Generated' AS payment_status,
                    NULL AS due_date
            ) payable_data
                ON 1 = 0
          ";

    $submissionSourceExpression =
        columnExists(
            $conn,
            "tbl_delivery",
            "submission_source"
        )
            ? "d.submission_source"
            : "'Admin'";

    $workflowSelect = implode(
        "\n",
        [
            optionalDeliveryColumn(
                $conn,
                "submission_source",
                "'Admin'"
            ),
            optionalDeliveryColumn(
                $conn,
                "submitted_by_user_id",
                "NULL"
            ),
            optionalDeliveryColumn(
                $conn,
                "submitted_by_name",
                "NULL"
            ),
            optionalDeliveryColumn(
                $conn,
                "submitted_at",
                "NULL"
            ),
            optionalDeliveryColumn(
                $conn,
                "reviewed_by_user_id",
                "NULL"
            ),
            optionalDeliveryColumn(
                $conn,
                "reviewed_by_name",
                "NULL"
            ),
            optionalDeliveryColumn(
                $conn,
                "reviewed_at",
                "NULL"
            ),
            optionalDeliveryColumn(
                $conn,
                "rejection_reason",
                "NULL"
            ),
            optionalDeliveryColumn(
                $conn,
                "processed_at",
                "NULL"
            ),
            optionalDeliveryColumn(
                $conn,
                "archived_at",
                "NULL"
            ),
        ]
    );

    $stmt = $conn->prepare("
        SELECT
            d.delivery_id,
            d.delivery_order_no,
            d.vendor_id,

            COALESCE(
                v.vendor_name,
                d.business_name,
                'No supplier'
            ) AS vendor_name,

            v.contact_person,
            v.phone AS supplier_phone,
            v.address AS supplier_address,

            COALESCE(
                item_totals.product_line_count,
                0
            ) AS product_line_count,

            COALESCE(
                item_totals.total_units,
                d.items_count,
                0
            ) AS items_count,

            COALESCE(
                item_totals.new_product_proposal_count,
                0
            ) AS new_product_proposal_count,

            CASE
                WHEN COALESCE(
                    item_totals.new_product_proposal_count,
                    0
                ) > 0
                    THEN 1
                ELSE 0
            END AS has_new_product_proposal,

            item_totals.proposed_product_names,

            CASE
                WHEN d.status = 'Pending'
                     AND LOWER(
                         COALESCE(
                             {$submissionSourceExpression},
                             ''
                         )
                     ) = 'supplier'
                    THEN 'Pending Review'

                WHEN d.status = 'Approved'
                    THEN 'Approved / Awaiting Delivery'

                WHEN d.status = 'In Transit'
                    THEN 'In Transit'

                WHEN d.status = 'Delivered'
                    THEN 'Received / Delivered'

                WHEN d.status = 'Rejected'
                    THEN 'Rejected'

                WHEN d.status = 'Cancelled'
                    THEN 'Cancelled'

                WHEN d.status = 'Archived'
                    THEN 'Archived'

                ELSE d.status
            END AS workflow_status,

            d.amount,

            {$supplierPayableSelect}

            d.driver,
            d.delivery_date,
            d.business_name,
            d.owner_name,
            d.contact_number,
            d.remarks,
            d.received_by,
            d.noted_by,
            d.status,

            {$workflowSelect}

            d.created_at,

            {$payableSelect}

            CASE
                WHEN COALESCE(
                    payable_data.balance_amount,
                    0
                ) > 0
                AND payable_data.due_date IS NOT NULL
                AND payable_data.due_date < CURDATE()
                    THEN 1
                ELSE 0
            END AS is_payment_overdue

        FROM tbl_delivery d

        LEFT JOIN tbl_vendor v
            ON v.vendor_id = d.vendor_id

        {$payableJoin}

        LEFT JOIN (
            SELECT
                delivery_id,
                COUNT(delivery_item_id)
                    AS product_line_count,

                COALESCE(
                    SUM(quantity),
                    0
                ) AS total_units,

                COALESCE(
                    SUM(
                        quantity *
                        supplier_price
                    ),
                    0
                ) AS supplier_payable_amount,

                COALESCE(
                    {$newProductCountExpression},
                    0
                ) AS new_product_proposal_count,

                {$proposedProductPreviewExpression}
                    AS proposed_product_names

            FROM tbl_delivery_items
            GROUP BY delivery_id
        ) item_totals
            ON item_totals.delivery_id =
               d.delivery_id

        WHERE {$whereSql}

        ORDER BY
            d.delivery_date DESC,
            d.delivery_id DESC
    ");

    foreach ($params as $key => $value) {
        $stmt->bindValue(
            $key,
            $value,
            PDO::PARAM_INT
        );
    }

    $stmt->execute();

    $deliveries =
        $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );

    $hasConsignmentColumns =
        columnExists(
            $conn,
            "tbl_delivery_items",
            "is_consignment"
        );

    $consignmentSelect =
        $hasConsignmentColumns
            ? "
                di.is_consignment,
                di.consignment_terms,
                di.consignment_start_date,
                di.consignment_pullout_date,
                di.consignment_notes,
              "
            : "
                0 AS is_consignment,
                NULL AS consignment_terms,
                NULL AS consignment_start_date,
                NULL AS consignment_pullout_date,
                NULL AS consignment_notes,
              ";

    $proposalSelect = implode(
        "\n",
        [
            optionalItemColumn(
                $conn,
                "is_new_product",
                "0"
            ),
            optionalItemColumn(
                $conn,
                "proposed_product_name",
                "NULL"
            ),
            optionalItemColumn(
                $conn,
                "proposed_description",
                "NULL"
            ),
            optionalItemColumn(
                $conn,
                "proposed_sku",
                "NULL"
            ),
            optionalItemColumn(
                $conn,
                "proposed_category_id",
                "NULL"
            ),
            optionalItemColumn(
                $conn,
                "proposed_category",
                "NULL"
            ),
            optionalItemColumn(
                $conn,
                "proposed_unit",
                "NULL"
            ),
            optionalItemColumn(
                $conn,
                "proposed_reorder_level",
                "5"
            ),
            optionalItemColumn(
                $conn,
                "proposed_product_image",
                "NULL"
            ),
        ]
    );

    $itemStmt = $conn->prepare("
        SELECT
            di.delivery_item_id,
            di.delivery_id,
            di.product_id,

            {$proposalSelect}

            di.product_name AS effective_product_name,

            di.sku AS effective_sku,

            di.category_id AS effective_category_id,

            di.unit AS effective_unit,

            NULL AS effective_product_image,

            di.product_name,
            di.sku,
            di.category_id,

            COALESCE(
                c.category_name,
                di.category,
                'Uncategorized'
            ) AS category,

            di.vendor_id,

            COALESCE(
                v.vendor_name,
                'No supplier'
            ) AS vendor_name,

            di.quantity,
            di.unit,
            di.supplier_price,
            di.retail_price,
            di.total_price,
            di.selling_price,
            di.expiry_date,

            {$consignmentSelect}

            di.created_at

        FROM tbl_delivery_items di

        LEFT JOIN tbl_category c
            ON c.category_id = di.category_id

        LEFT JOIN tbl_vendor v
            ON v.vendor_id =
               di.vendor_id

        WHERE di.delivery_id =
              :delivery_id

        ORDER BY
            di.delivery_item_id ASC
    ");

    foreach ($deliveries as &$delivery) {
        $itemStmt->execute([
            ":delivery_id" =>
                $delivery["delivery_id"]
        ]);

        $delivery["items"] =
            $itemStmt->fetchAll(
                PDO::FETCH_ASSOC
            );

        foreach (
            $delivery["items"] as
            &$deliveryItem
        ) {
            $deliveryItem[
                "is_new_product"
            ] = (int)(
                $deliveryItem[
                    "is_new_product"
                ] ??
                (
                    empty(
                        $deliveryItem[
                            "product_id"
                        ]
                    )
                        ? 1
                        : 0
                )
            );

            $deliveryItem[
                "product_display_name"
            ] =
                $deliveryItem[
                    "proposed_product_name"
                ] ??
                $deliveryItem[
                    "effective_product_name"
                ] ??
                $deliveryItem[
                    "product_name"
                ] ??
                "Unnamed Product";

            $deliveryItem[
                "sku_display"
            ] =
                $deliveryItem[
                    "proposed_sku"
                ] ??
                $deliveryItem[
                    "effective_sku"
                ] ??
                $deliveryItem[
                    "sku"
                ] ??
                "";
        }

        unset($deliveryItem);

        $delivery[
            "new_product_proposal_count"
        ] = (int)(
            $delivery[
                "new_product_proposal_count"
            ] ?? 0
        );

        $delivery[
            "has_new_product_proposal"
        ] = (bool)(
            $delivery[
                "has_new_product_proposal"
            ] ?? false
        );
    }

    unset($delivery);

    echo json_encode(
        [
            "success" => true,
            "deliveries" => $deliveries
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );
} catch (Throwable $error) {
    http_response_code(500);

    error_log(
        "get_deliveries.php: " .
        $error->getMessage()
    );

    echo json_encode(
        [
            "success" => false,
            "message" =>
                "Unable to retrieve delivery transactions.",
            "deliveries" => []
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );
}