<?php

declare(strict_types=1);

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireAuthentication();

$sessionRole = trim((string)($_SESSION["role"] ?? ""));

if (!in_array($sessionRole, ["Supplier", "Vendor"], true)) {
    requireModulePermission("deliveries");
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

$deliveryId = filter_var(
    $_GET["delivery_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$deliveryId) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" =>
            "A valid delivery ID is required.",
        "delivery" => null
    ]);

    exit;
}

try {
    $hasPayableTable = tableExists(
        $conn,
        "tbl_supplier_payable"
    );

    $hasSupplierPayableColumn =
        columnExists(
            $conn,
            "tbl_delivery",
            "supplier_payable_amount"
        );

    $supplierPayableSelect =
        $hasSupplierPayableColumn
            ? "
                COALESCE(
                    d.supplier_payable_amount,
                    sp.payable_amount,
                    item_totals.supplier_payable_amount,
                    0
                ) AS supplier_payable_amount,
              "
            : "
                COALESCE(
                    sp.payable_amount,
                    item_totals.supplier_payable_amount,
                    0
                ) AS supplier_payable_amount,
              ";

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
                "received_by_user_id",
                "NULL"
            ),
            optionalDeliveryColumn(
                $conn,
                "received_by_name",
                "NULL"
            ),
            optionalDeliveryColumn(
                $conn,
                "received_at",
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

    $payableJoin = $hasPayableTable
        ? "
            LEFT JOIN tbl_supplier_payable sp
                ON sp.delivery_id =
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
                    NULL AS due_date,
                    NULL AS notes
            ) sp
                ON 1 = 0
          ";

    $deliveryStmt = $conn->prepare("
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

            d.amount,

            {$supplierPayableSelect}

            d.driver,
            d.delivery_date,
            d.business_name,
            d.owner_name,
            d.contact_number,
            d.remarks,
            d.received_by AS legacy_received_by,
            d.noted_by,
            d.status,

            {$workflowSelect}

            d.created_at,

            sp.payable_id,
            sp.payable_amount,
            sp.paid_amount,
            sp.balance_amount,
            sp.payment_status,
            sp.due_date,
            sp.notes AS payable_notes

        FROM tbl_delivery d

        LEFT JOIN tbl_vendor v
            ON v.vendor_id =
               d.vendor_id

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
                ) AS supplier_payable_amount

            FROM tbl_delivery_items
            GROUP BY delivery_id
        ) item_totals
            ON item_totals.delivery_id =
               d.delivery_id

        WHERE d.delivery_id =
              :delivery_id

        LIMIT 1
    ");

    $deliveryStmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    $delivery =
        $deliveryStmt->fetch(
            PDO::FETCH_ASSOC
        );

    if (!$delivery) {
        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" =>
                "Delivery transaction was not found.",
            "delivery" => null
        ]);

        exit;
    }

    if (in_array($sessionRole, ["Supplier", "Vendor"], true)) {
        enforceSupplierVendorAccess((int)($delivery["vendor_id"] ?? 0));
    }

    










    if (
        empty($delivery["received_by_name"]) &&
        !empty($delivery["legacy_received_by"])
    ) {
        $delivery["received_by_name"] =
            $delivery["legacy_received_by"];
    }

    if (
        empty($delivery["received_at"]) &&
        !empty($delivery["processed_at"]) &&
        ($delivery["status"] ?? "") === "Delivered"
    ) {
        $delivery["received_at"] =
            $delivery["processed_at"];
    }

    $delivery["approved_by_name"] =
        $delivery["reviewed_by_name"] ?? null;

    $delivery["approved_at"] =
        $delivery["reviewed_at"] ?? null;

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

    $itemsStmt = $conn->prepare("
        SELECT
            di.delivery_item_id,
            di.delivery_id,
            di.product_id,

            {$proposalSelect}

            COALESCE(
                di.proposed_product_name,
                di.product_name,
                i.product_name
            ) AS effective_product_name,

            COALESCE(
                di.proposed_sku,
                di.sku,
                i.sku
            ) AS effective_sku,

            COALESCE(
                di.proposed_category_id,
                di.category_id,
                i.category_id
            ) AS effective_category_id,

            COALESCE(
                di.proposed_unit,
                di.unit,
                i.unit_type
            ) AS effective_unit,

            COALESCE(
                di.proposed_product_image,
                i.product_image
            ) AS effective_product_image,

            di.product_name,
            di.sku,
            di.category_id,

            COALESCE(
                di.proposed_category,
                c.category_name,
                di.category,
                i.category,
                'Uncategorized'
            ) AS category,

            di.vendor_id,
            di.quantity,
            di.unit,
            di.supplier_price,
            di.retail_price,
            di.total_price,
            di.selling_price,
            di.expiry_date,

            {$consignmentSelect}

            COALESCE(
                di.proposed_product_image,
                i.product_image
            ) AS product_image,

            i.quantity
                AS current_inventory_quantity,
            i.status
                AS inventory_status,

            (
                di.quantity *
                di.supplier_price
            ) AS supplier_payable_line_total,

            (
                di.quantity *
                COALESCE(
                    di.retail_price,
                    di.selling_price,
                    0
                )
            ) AS retail_line_total,

            di.created_at

        FROM tbl_delivery_items di

        LEFT JOIN tbl_category c
            ON c.category_id =
               COALESCE(
                   di.proposed_category_id,
                   di.category_id
               )

        LEFT JOIN tbl_inv i
            ON i.product_id =
               di.product_id

        WHERE di.delivery_id =
              :delivery_id

        ORDER BY
            di.delivery_item_id ASC
    ");

    $itemsStmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    $delivery["items"] =
        $itemsStmt->fetchAll(
            PDO::FETCH_ASSOC
        );

    echo json_encode(
        [
            "success" => true,
            "delivery" => $delivery
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );
} catch (Throwable $error) {
    http_response_code(500);

    error_log(
        "get_delivery_details.php: " .
        $error->getMessage()
    );

    echo json_encode(
        [
            "success" => false,
            "message" =>
                "Unable to retrieve delivery details.",
            "delivery" => null
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );
}