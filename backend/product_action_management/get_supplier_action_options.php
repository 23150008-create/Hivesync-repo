<?php

declare(strict_types=1);

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("_helpers.php");
require_once("../helpers/supplier_communication.php");

requireAuthentication();

$vendorId = filter_var(
    $_GET["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$vendorId) {
    productActionRespond(
        false,
        "A valid supplier ID is required.",
        ["products" => []],
        422
    );
}

if (in_array((string)($_SESSION["role"] ?? ""), ["Supplier", "Vendor"], true)) {
    enforceSupplierVendorAccess((int)$vendorId);
} else {
    requireModulePermission("vendors");
    requireAnyRole(["Admin", "Staff", "Audit"]);
}

function actionOptionColumnExists(
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

function expiryMeta(?string $expiryDate): array
{
    if (!$expiryDate) {
        return [
            "days_until_expiry" => null,
            "expiry_status" => "No Expiry",
            "recommended_action_date" => null,
            "max_action_date" => null,
            "suggested_action" => null
        ];
    }

    $today = new DateTimeImmutable("today");
    $expiry = new DateTimeImmutable($expiryDate);
    $days = (int)$today->diff($expiry)->format("%r%a");

    if ($days <= 0) {
        $status = "Expired";
        $suggestedAction = null;
        $recommended = $today->format("Y-m-d");
    } elseif ($days <= 7) {
        $status = "Critical";
        $suggestedAction = "Pull-out";
        $recommended = $today->format("Y-m-d");
    } elseif ($days <= 30) {
        $status = "Near Expiry";
        $suggestedAction = "Pull-out";
        $candidate = $expiry->modify("-3 days");
        if ($candidate < $today) {
            $candidate = $today;
        }
        $recommended = $candidate->format("Y-m-d");
    } else {
        $status = "Safe";
        $suggestedAction = null;
        $recommended = null;
    }

    return [
        "days_until_expiry" => $days,
        "expiry_status" => $status,
        "recommended_action_date" => $recommended,
        "max_action_date" => $expiry->format("Y-m-d"),
        "suggested_action" => $suggestedAction
    ];
}

function sendNearExpirySupplierNotice(
    PDO $conn,
    int $vendorId,
    array $row
): void {
    $expiryDate = $row["batch_expiry_date"] ?? null;

    if (!$expiryDate) {
        return;
    }

    $meta = expiryMeta($expiryDate);

    if (!in_array(
        $meta["expiry_status"],
        ["Near Expiry", "Critical", "Expired"],
        true
    )) {
        return;
    }

    if ((float)($row["available_request_quantity"] ?? 0) <= 0) {
        return;
    }

    $batchId = (int)$row["batch_id"];
    $referenceCode = "EXP-BATCH-" . $batchId;

    
    try {
        if (
            actionOptionColumnExists($conn, "tbl_notifications", "reference_code") &&
            actionOptionColumnExists($conn, "tbl_notifications", "created_at") &&
            actionOptionColumnExists($conn, "tbl_user", "vendor_id")
        ) {
            $duplicateStmt = $conn->prepare("
                SELECT COUNT(*)
                FROM tbl_notifications n
                INNER JOIN tbl_user u
                    ON u.user_id = n.user_id
                WHERE u.vendor_id = :vendor_id
                AND n.reference_code = :reference_code
            ");
            $duplicateStmt->execute([
                ":vendor_id" => $vendorId,
                ":reference_code" => $referenceCode
            ]);

            if ((int)$duplicateStmt->fetchColumn() > 0) {
                return;
            }
        }

        $title =
            $meta["expiry_status"] === "Expired"
                ? "Expired Product Batch"
                : "Product Near Expiration";

        $message =
            "{$row['product_name']} batch #{$batchId} " .
            (
                $meta["expiry_status"] === "Expired"
                    ? "has already expired."
                    : "expires on {$expiryDate}."
            ) .
            (
                $meta["expiry_status"] === "Expired"
                    ? " Review the batch and submit a pull-out or disposal request as appropriate."
                    : " Review the batch and submit a pull-out request if needed."
            );

        $details =
            "Product: {$row['product_name']}\n" .
            "SKU: " . ($row["sku"] ?? "") . "\n" .
            "Batch: {$batchId}\n" .
            "Available quantity: {$row['available_request_quantity']}\n" .
            "Expiry date: {$expiryDate}\n" .
            "Status: {$meta['expiry_status']}\n" .
            "Suggested action: " .
            (
                $meta["expiry_status"] === "Expired"
                    ? "Pull-out or Disposal"
                    : ($meta["suggested_action"] ?? "Review")
            );

        notifySupplier(
            $conn,
            $vendorId,
            $title,
            $message,
            "Inventory",
            $batchId,
            $referenceCode,
            "product_actions",
            $details
        );
    } catch (Throwable $communicationError) {
        error_log(
            "Near-expiry supplier notification: " .
            $communicationError->getMessage()
        );
    }
}

try {
    $batchQuantityColumn =
        actionOptionColumnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        )
            ? "b.remaining_quantity"
            : "b.quantity";

    $variantSelect = [];

    foreach (
        [
            "family_id",
            "request_variant_id",
            "variant_label",
            "variant_value",
            "variant_unit",
            "variant_sort"
        ] as $column
    ) {
        if (actionOptionColumnExists($conn, "tbl_inv", $column)) {
            $variantSelect[] = "i.`{$column}`";
        } else {
            $fallback = match ($column) {
                "family_id" => "i.product_id AS family_id",
                "variant_label" => "'Standard' AS variant_label",
                "variant_sort" => "0 AS variant_sort",
                default => "NULL AS {$column}"
            };
            $variantSelect[] = $fallback;
        }
    }

    $consignmentSelect = [];

    foreach (
        [
            "is_consignment",
            "consignment_terms",
            "consignment_start_date",
            "consignment_pullout_date",
            "consignment_notes"
        ] as $column
    ) {
        if (actionOptionColumnExists($conn, "tbl_inv", $column)) {
            $consignmentSelect[] = "i.`{$column}`";
        } else {
            $fallback =
                $column === "is_consignment"
                    ? "0 AS is_consignment"
                    : "NULL AS {$column}";
            $consignmentSelect[] = $fallback;
        }
    }

    $stmt = $conn->prepare("
        SELECT
            i.product_id,
            " . implode(",\n            ", $variantSelect) . ",
            i.product_name,
            i.sku,
            i.quantity AS total_quantity,

            COALESCE(
                NULLIF(i.unit, ''),
                NULLIF(i.unit_type, ''),
                'pcs'
            ) AS unit,

            COALESCE(
                c.category_name,
                i.category,
                'Uncategorized'
            ) AS category_name,

            i.expiry_date,
            " . implode(",\n            ", $consignmentSelect) . ",

            b.batch_id,
            {$batchQuantityColumn} AS batch_quantity,
            b.expiry_date AS batch_expiry_date,
            b.supplier_price,
            b.delivery_id,

            COALESCE(
                active_requests.reserved_quantity,
                0
            ) AS reserved_quantity,

            GREATEST(
                {$batchQuantityColumn} -
                COALESCE(
                    active_requests.reserved_quantity,
                    0
                ),
                0
            ) AS available_request_quantity

        FROM tbl_inv i

        LEFT JOIN tbl_category c
            ON c.category_id = i.category_id

        INNER JOIN tbl_inventory_batches b
            ON b.product_id = i.product_id
            AND {$batchQuantityColumn} > 0

        LEFT JOIN (
            SELECT
                batch_id,
                SUM(
                    CASE
                        WHEN status IN (
                            'Pending',
                            'Approved'
                        )
                        THEN COALESCE(
                            approved_quantity,
                            requested_quantity
                        )
                        ELSE 0
                    END
                ) AS reserved_quantity
            FROM tbl_product_action_request
            GROUP BY batch_id
        ) active_requests
            ON active_requests.batch_id = b.batch_id

        WHERE i.vendor_id = :vendor_id
        AND COALESCE(i.status, '') <> 'Archived'

        ORDER BY
            i.product_name ASC,
            COALESCE(i.variant_sort, 0) ASC,
            CASE
                WHEN b.expiry_date IS NULL THEN 1
                ELSE 0
            END,
            b.expiry_date ASC,
            b.batch_id ASC
    ");

    $stmt->execute([
        ":vendor_id" => $vendorId
    ]);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $products = [];

    foreach ($rows as $row) {
        $productId = (int)$row["product_id"];

        if (!isset($products[$productId])) {
            $variantLabel = trim(
                (string)($row["variant_label"] ?? "")
            );

            if ($variantLabel === "") {
                $variantValue = trim(
                    (string)($row["variant_value"] ?? "")
                );
                $variantUnit = trim(
                    (string)($row["variant_unit"] ?? "")
                );
                $variantLabel =
                    ($variantValue !== "" || $variantUnit !== "")
                        ? trim($variantValue . " " . $variantUnit)
                        : "Standard";
            }

            $products[$productId] = [
                "product_id" => $productId,
                "family_id" => (int)($row["family_id"] ?: $productId),
                "request_variant_id" =>
                    $row["request_variant_id"] !== null
                        ? (int)$row["request_variant_id"]
                        : null,
                "product_name" => $row["product_name"],
                "variant_label" => $variantLabel,
                "variant_value" =>
                    $row["variant_value"] !== null
                        ? (float)$row["variant_value"]
                        : null,
                "variant_unit" => $row["variant_unit"],
                "variant_sort" => (int)($row["variant_sort"] ?? 0),
                "display_name" =>
                    strtolower($variantLabel) !== "standard"
                        ? $row["product_name"] . " — " . $variantLabel
                        : $row["product_name"],
                "sku" => $row["sku"],
                "category_name" => $row["category_name"],
                "unit" => $row["unit"],
                "total_quantity" => (float)$row["total_quantity"],
                "expiry_date" => $row["expiry_date"],
                "is_consignment" => (int)($row["is_consignment"] ?? 0),
                "consignment_terms" => $row["consignment_terms"] ?? null,
                "consignment_start_date" =>
                    $row["consignment_start_date"] ?? null,
                "consignment_pullout_date" =>
                    $row["consignment_pullout_date"] ?? null,
                "consignment_notes" =>
                    $row["consignment_notes"] ?? null,
                "batches" => []
            ];
        }

        if ((float)$row["available_request_quantity"] <= 0) {
            continue;
        }

        $meta = expiryMeta(
            $row["batch_expiry_date"] ?: null
        );

        $maxActionDate = $meta["max_action_date"];

        if (
            (int)($row["is_consignment"] ?? 0) === 1 &&
            !empty($row["consignment_pullout_date"])
        ) {
            if (
                !$maxActionDate ||
                $row["consignment_pullout_date"] < $maxActionDate
            ) {
                $maxActionDate = $row["consignment_pullout_date"];
            }
        }

        $products[$productId]["batches"][] = [
            "batch_id" => (int)$row["batch_id"],
            "quantity" => (float)$row["batch_quantity"],
            "reserved_quantity" =>
                (float)$row["reserved_quantity"],
            "available_quantity" =>
                (float)$row["available_request_quantity"],
            "expiry_date" => $row["batch_expiry_date"],
            "supplier_price" =>
                (float)$row["supplier_price"],
            "delivery_id" => (int)$row["delivery_id"],
            "days_until_expiry" =>
                $meta["days_until_expiry"],
            "expiry_status" =>
                $meta["expiry_status"],
            "recommended_action_date" =>
                $meta["recommended_action_date"],
            "max_action_date" => $maxActionDate,
            "suggested_action" =>
                $meta["suggested_action"],
            "is_consignment" =>
                (int)($row["is_consignment"] ?? 0),
            "consignment_pullout_date" =>
                $row["consignment_pullout_date"] ?? null
        ];

        sendNearExpirySupplierNotice(
            $conn,
            $vendorId,
            $row
        );
    }

    $products = array_values(
        array_filter(
            $products,
            fn(array $product) =>
                count($product["batches"]) > 0
        )
    );

    productActionRespond(
        true,
        "Supplier product action options retrieved successfully.",
        [
            "products" => $products,
            "supplier_id" => $vendorId,
            "generated_at" => date("Y-m-d H:i:s")
        ]
    );

} catch (Throwable $e) {
    error_log(
        "Product action options error: " .
        $e->getMessage()
    );

    productActionRespond(
        false,
        "Unable to retrieve supplier products and batches.",
        [
            "products" => [],
            
        ],
        500
    );
}