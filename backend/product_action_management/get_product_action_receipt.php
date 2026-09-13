<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("_helpers.php");

requireAuthentication();

function receiptColumnExists(
    PDO $conn,
    string $table,
    string $column
): bool {
    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
        AND column_name = :column_name
    ");

    $stmt->execute([
        ":table_name" => $table,
        ":column_name" => $column
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

$requestId = filter_var(
    $_GET["request_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$requestId) {
    productActionRespond(
        false,
        "A valid request ID is required.",
        [],
        422
    );
}

try {
    $batchQuantityColumn =
        receiptColumnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        )
            ? "b.remaining_quantity"
            : "b.quantity";

    $stmt = $conn->prepare("
        SELECT
            r.request_id,
            r.request_no,
            r.action_type,
            r.requested_quantity,
            r.approved_quantity,
            r.reason,
            r.preferred_action_date,
            r.disposal_method,
            r.supplier_remarks,
            r.status,
            r.requested_by_name,
            r.reviewed_by_name,
            r.reviewed_at,
            r.rejection_reason,
            r.completed_by_name,
            r.completed_at,
            r.created_at,

            v.vendor_id,
            v.vendor_name,
            v.contact_person,
            v.phone,
            v.address,

            i.product_id,
            i.family_id,
            i.request_variant_id,
            i.product_name,
            i.variant_label,
            i.variant_value,
            i.variant_unit,
            i.variant_sort,
            i.sku,
            i.is_consignment,
            i.consignment_terms,
            i.consignment_start_date,
            i.consignment_pullout_date,
            i.consignment_notes,

            COALESCE(
                NULLIF(i.unit, ''),
                NULLIF(i.unit_type, ''),
                'pcs'
            ) AS unit,

            b.batch_id,
            b.quantity AS original_batch_quantity,
            {$batchQuantityColumn} AS current_batch_quantity,
            b.expiry_date,
            b.supplier_price,
            b.delivery_id,

            d.delivery_order_no,
            d.delivery_date

        FROM tbl_product_action_request r

        INNER JOIN tbl_vendor v
            ON v.vendor_id = r.vendor_id

        INNER JOIN tbl_inv i
            ON i.product_id = r.product_id

        LEFT JOIN tbl_inventory_batches b
            ON b.batch_id = r.batch_id

        LEFT JOIN tbl_delivery d
            ON d.delivery_id = b.delivery_id

        WHERE r.request_id = :request_id
        LIMIT 1
    ");

    $stmt->execute([
        ":request_id" => $requestId
    ]);

    $receipt = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$receipt) {
        productActionRespond(
            false,
            "Product action receipt was not found.",
            [],
            404
        );
    }

    if (in_array((string)($_SESSION["role"] ?? ""), ["Supplier", "Vendor"], true)) {
        enforceSupplierVendorAccess((int)$receipt["vendor_id"]);
    } else {
        requireModulePermission("vendors");
        requireAnyRole(["Admin", "Staff", "Audit"]);
    }

    $variantLabel = trim(
        (string)($receipt["variant_label"] ?? "")
    );

    if (
        $variantLabel === "" ||
        strtolower($variantLabel) === "standard"
    ) {
        $variantValue = trim(
            (string)($receipt["variant_value"] ?? "")
        );
        $variantUnit = trim(
            (string)($receipt["variant_unit"] ?? "")
        );

        $variantLabel =
            ($variantValue !== "" || $variantUnit !== "")
                ? trim($variantValue . " " . $variantUnit)
                : "Standard";
    }

    $receipt["variant_label"] = $variantLabel;
    $receipt["product_display_name"] =
        strtolower($variantLabel) !== "standard"
            ? $receipt["product_name"] . " — " . $variantLabel
            : $receipt["product_name"];

    $receipt["processed_quantity"] =
        (float)(
            $receipt["approved_quantity"] ??
            $receipt["requested_quantity"]
        );

    $receipt["receipt_no"] =
        $receipt["request_no"];

    $receipt["is_consignment"] =
        (int)($receipt["is_consignment"] ?? 0);

    $receipt["days_until_expiry"] =
        $receipt["expiry_date"]
            ? (int)(
                (
                    new DateTimeImmutable("today")
                )->diff(
                    new DateTimeImmutable(
                        $receipt["expiry_date"]
                    )
                )->format("%r%a")
            )
            : null;

    $documentTitle =
        $receipt["action_type"] === "Disposal"
            ? "PRODUCT DISPOSAL RECEIPT"
            : "SUPPLIER PULL-OUT RECEIPT";

    productActionRespond(
        true,
        "Product action receipt retrieved successfully.",
        [
            "receipt" => $receipt,
            "organization" => [
                "name" =>
                    "BACNOTAN FARMERS AGRI-TOURISM CENTER",
                "system_name" =>
                    "HiveSync",
                "document_title" =>
                    $documentTitle
            ],
            "print" => [
                "document_title" =>
                    $documentTitle,
                "receipt_no" =>
                    $receipt["receipt_no"],
                "generated_at" =>
                    date("Y-m-d H:i:s")
            ]
        ]
    );
} catch (Throwable $e) {
    error_log(
        "Product action receipt error: " .
        $e->getMessage()
    );

    productActionRespond(
        false,
        "Unable to retrieve the product action receipt.",
        [],
        500
    );
}
