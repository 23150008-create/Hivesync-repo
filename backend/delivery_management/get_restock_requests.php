<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireAuthentication();
requireAnyRole(["Supplier", "Vendor"]);

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

try {
    $vendorId = (int)($_SESSION["vendor_id"] ?? 0);

    if ($vendorId <= 0) {
        respond(
            false,
            "Your supplier account is not linked to a valid supplier record.",
            [
                "requests" => []
            ],
            403
        );
    }

    enforceSupplierVendorAccess($vendorId);

    $sql = "
        SELECT
            rr.*,

            COALESCE(
                i.product_name,
                CONCAT(
                    'Product #',
                    rr.product_id
                )
            ) AS product_name,

            COALESCE(
                i.sku,
                ''
            ) AS sku,

            i.category_id,

            COALESCE(
                i.category,
                ''
            ) AS category,

            COALESCE(
                i.quantity,
                0
            ) AS current_stock,

            COALESCE(
                i.reorder_level,
                0
            ) AS reorder_level,

            COALESCE(
                NULLIF(i.unit_type, ''),
                NULLIF(i.unit, ''),
                'pcs'
            ) AS unit_type,

            COALESCE(
                i.supplier_price,
                0
            ) AS supplier_price,

            COALESCE(
                i.selling_price,
                0
            ) AS selling_price,

            COALESCE(
                i.product_image,
                ''
            ) AS product_image,

            COALESCE(
                v.vendor_name,
                'Supplier'
            ) AS vendor_name,

            COALESCE(
                v.contact_person,
                ''
            ) AS contact_person,

            COALESCE(
                v.phone,
                ''
            ) AS phone

        FROM tbl_restock_request rr

        LEFT JOIN tbl_inv i
            ON i.product_id =
               rr.product_id

        LEFT JOIN tbl_vendor v
            ON v.vendor_id =
               rr.vendor_id

        WHERE rr.vendor_id =
              :vendor_id

          AND LOWER(
                TRIM(
                    COALESCE(
                        rr.status,
                        ''
                    )
                )
              ) = 'pending supplier'

        ORDER BY
            rr.created_at DESC,
            rr.restock_request_id DESC
    ";

    $stmt = $conn->prepare($sql);

    $stmt->execute([
        ":vendor_id" => $vendorId
    ]);

    $requests =
        $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );

    respond(
        true,
        "Pending supplier restock requests loaded.",
        [
            "vendor_id" =>
                $vendorId,

            "count" =>
                count($requests),

            "requests" =>
                $requests
        ]
    );
} catch (Throwable $error) {
    error_log(
        "get_restock_requests.php: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to load restock requests.",
        [
            "requests" =>
                []
        ],
        500
    );
}
