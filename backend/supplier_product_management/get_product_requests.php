<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("_helpers.php");

requireAuthentication();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    supplierProductRespond(
        false,
        "Invalid request method.",
        [],
        405
    );
}

if (
    !supplierProductTableExists(
        $conn,
        "tbl_supplier_product_request"
    )
) {
    supplierProductRespond(
        false,
        "The supplier product request table is missing.",
        [
            "requests" => [],
            "summary" => []
        ],
        500
    );
}

$vendorId = filter_var(
    $_GET["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

$status = trim(
    (string)($_GET["status"] ?? "")
);

$search = trim(
    (string)($_GET["search"] ?? "")
);

if (!$vendorId) {
    supplierProductRespond(
        false,
        "A valid supplier ID is required.",
        [
            "requests" => [],
            "summary" => []
        ],
        422
    );
}

if (in_array((string)($_SESSION["role"] ?? ""), ["Supplier", "Vendor"], true)) {
    enforceSupplierVendorAccess((int)$vendorId);
} else {
    requireModulePermission("vendors");
    requireAnyRole(["Admin", "Staff", "Audit"]);
}

$allowedStatuses = [
    "",
    "All",
    "Pending",
    "Approved",
    "Rejected",
    "Cancelled"
];

if (
    !in_array(
        $status,
        $allowedStatuses,
        true
    )
) {
    supplierProductRespond(
        false,
        "Invalid request status.",
        [
            "requests" => [],
            "summary" => []
        ],
        422
    );
}

try {
    $supplierStmt = $conn->prepare("
        SELECT
            vendor_id,
            vendor_name,
            status
        FROM tbl_vendor
        WHERE vendor_id = :vendor_id
        LIMIT 1
    ");

    $supplierStmt->execute([
        ":vendor_id" => $vendorId
    ]);

    $supplier = $supplierStmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$supplier) {
        supplierProductRespond(
            false,
            "The supplier record was not found.",
            [
                "requests" => [],
                "summary" => []
            ],
            404
        );
    }

    $where = [
        "r.vendor_id = :vendor_id"
    ];

    $params = [
        ":vendor_id" => $vendorId
    ];

    if (
        $status !== "" &&
        $status !== "All"
    ) {
        $where[] =
            "r.status = :status";

        $params[":status"] =
            $status;
    }

    if ($search !== "") {
        $searchValue = "%{$search}%";

        $where[] = "(
            r.request_no LIKE :search_0
            OR r.product_name LIKE :search_1
            OR r.requested_sku LIKE :search_2
            OR r.generated_sku LIKE :search_3
            OR r.category_name LIKE :search_4
            OR r.status LIKE :search_5
            OR r.product_description LIKE :search_6
            OR r.supplier_remarks LIKE :search_7
            OR r.rejection_reason LIKE :search_8
            OR EXISTS (
                SELECT 1
                FROM tbl_supplier_product_request_variants rv_search
                WHERE rv_search.request_id = r.request_id
                AND (
                    rv_search.variant_label LIKE :search_9
                    OR rv_search.requested_sku LIKE :search_10
                    OR rv_search.generated_sku LIKE :search_11
                )
            )
        )";

        for ($index = 0; $index <= 11; $index++) {
            $params[":search_{$index}"] =
                $searchValue;
        }
    }

    $whereSql =
        "WHERE " .
        implode(" AND ", $where);

    $stmt = $conn->prepare("
        SELECT
            r.request_id,
            r.request_no,
            r.vendor_id,
            v.vendor_name,
            r.product_name,
            r.requested_sku,
            r.generated_sku,
            r.category_id,
            r.category_name,
            r.unit_type,
            r.reorder_level,
            r.supplier_price,
            r.suggested_selling_price,
            r.expiry_required,
            r.product_description,
            r.supplier_remarks,
            r.product_image,
            r.status,
            r.approved_product_id,
            r.family_id,
            r.has_variants,
            r.requested_by,
            r.requested_by_name,
            r.reviewed_by,
            r.reviewed_by_name,
            r.reviewed_at,
            r.rejection_reason,
            r.created_at,
            r.updated_at,
            i.sku AS approved_product_sku,
            i.quantity AS approved_product_quantity,
            i.status AS approved_product_status
        FROM tbl_supplier_product_request r
        INNER JOIN tbl_vendor v
            ON v.vendor_id = r.vendor_id
        LEFT JOIN tbl_inv i
            ON i.product_id =
               r.approved_product_id
        {$whereSql}
        ORDER BY
            r.created_at DESC,
            r.request_id DESC
    ");

    $stmt->execute($params);

    $requests = $stmt->fetchAll(
        PDO::FETCH_ASSOC
    );

    $requestIds = array_values(
        array_filter(
            array_map(
                fn($row) =>
                    (int)(
                        $row["request_id"] ??
                        0
                    ),
                $requests
            )
        )
    );

    $variantsByRequest = [];

    if (
        count($requestIds) > 0 &&
        supplierProductTableExists(
            $conn,
            "tbl_supplier_product_request_variants"
        )
    ) {
        $placeholders = implode(
            ",",
            array_fill(
                0,
                count($requestIds),
                "?"
            )
        );

        $variantStmt = $conn->prepare("
            SELECT
                rv.request_variant_id,
                rv.request_id,
                rv.variant_label,
                rv.variant_value,
                rv.variant_unit,
                rv.selling_unit,
                rv.supplier_price,
                rv.reorder_level,
                rv.requested_sku,
                rv.generated_sku,
                rv.status,
                rv.approved_product_id,
                rv.rejection_reason,
                rv.sort_order,
                rv.created_at,
                rv.updated_at,
                i.quantity AS inventory_quantity,
                i.selling_price,
                i.publication_status,
                i.status AS inventory_status
            FROM tbl_supplier_product_request_variants rv
            LEFT JOIN tbl_inv i
                ON i.product_id =
                   rv.approved_product_id
            WHERE rv.request_id IN ({$placeholders})
            ORDER BY
                rv.request_id,
                rv.sort_order,
                rv.request_variant_id
        ");

        $variantStmt->execute($requestIds);

        foreach (
            $variantStmt->fetchAll(
                PDO::FETCH_ASSOC
            ) as $variant
        ) {
            $requestId =
                (int)$variant["request_id"];

            $variant[
                "request_variant_id"
            ] =
                (int)$variant[
                    "request_variant_id"
                ];

            $variant["request_id"] =
                $requestId;

            $variant["variant_value"] =
                $variant["variant_value"] !== null
                    ? (float)$variant[
                        "variant_value"
                    ]
                    : null;

            $variant["supplier_price"] =
                (float)$variant[
                    "supplier_price"
                ];

            $variant["reorder_level"] =
                (int)$variant[
                    "reorder_level"
                ];

            $variant["approved_product_id"] =
                $variant[
                    "approved_product_id"
                ] !== null
                    ? (int)$variant[
                        "approved_product_id"
                    ]
                    : null;

            $variant["inventory_quantity"] =
                (int)(
                    $variant[
                        "inventory_quantity"
                    ] ?? 0
                );

            $variant["selling_price"] =
                (float)(
                    $variant[
                        "selling_price"
                    ] ?? 0
                );

            $variantsByRequest[
                $requestId
            ][] = $variant;
        }
    }

    foreach ($requests as &$request) {
        $requestId =
            (int)$request["request_id"];

        $request["request_id"] =
            $requestId;
        $request["vendor_id"] =
            (int)$request["vendor_id"];
        $request["category_id"] =
            $request["category_id"] !== null
                ? (int)$request[
                    "category_id"
                ]
                : null;
        $request["reorder_level"] =
            (int)$request[
                "reorder_level"
            ];
        $request["supplier_price"] =
            (float)$request[
                "supplier_price"
            ];
        $request[
            "suggested_selling_price"
        ] =
            (float)$request[
                "suggested_selling_price"
            ];
        $request["expiry_required"] =
            (int)$request[
                "expiry_required"
            ];
        $request["approved_product_id"] =
            $request[
                "approved_product_id"
            ] !== null
                ? (int)$request[
                    "approved_product_id"
                ]
                : null;
        $request["family_id"] =
            $request["family_id"] !== null
                ? (int)$request[
                    "family_id"
                ]
                : null;
        $request["has_variants"] =
            (int)(
                $request[
                    "has_variants"
                ] ?? 0
            );

        $request["variants"] =
            $variantsByRequest[
                $requestId
            ] ?? [];

        $request["variant_count"] =
            count(
                $request["variants"]
            );

        $request["approved_variant_count"] =
            count(
                array_filter(
                    $request["variants"],
                    fn($variant) =>
                        $variant["status"] ===
                        "Approved"
                )
            );
    }

    unset($request);

    $summaryStmt = $conn->prepare("
        SELECT
            COUNT(*) AS total_requests,
            COALESCE(
                SUM(status = 'Pending'),
                0
            ) AS pending_requests,
            COALESCE(
                SUM(status = 'Approved'),
                0
            ) AS approved_requests,
            COALESCE(
                SUM(status = 'Rejected'),
                0
            ) AS rejected_requests,
            COALESCE(
                SUM(status = 'Cancelled'),
                0
            ) AS cancelled_requests
        FROM tbl_supplier_product_request
        WHERE vendor_id = :vendor_id
    ");

    $summaryStmt->execute([
        ":vendor_id" => $vendorId
    ]);

    $summary = $summaryStmt->fetch(
        PDO::FETCH_ASSOC
    ) ?: [];

    supplierProductRespond(
        true,
        "Supplier product requests loaded successfully.",
        [
            "supplier" => [
                "vendor_id" =>
                    (int)$supplier["vendor_id"],
                "vendor_name" =>
                    $supplier["vendor_name"],
                "status" =>
                    $supplier["status"]
            ],
            "requests" => $requests,
            "summary" => [
                "total_requests" =>
                    (int)(
                        $summary[
                            "total_requests"
                        ] ?? 0
                    ),
                "pending_requests" =>
                    (int)(
                        $summary[
                            "pending_requests"
                        ] ?? 0
                    ),
                "approved_requests" =>
                    (int)(
                        $summary[
                            "approved_requests"
                        ] ?? 0
                    ),
                "rejected_requests" =>
                    (int)(
                        $summary[
                            "rejected_requests"
                        ] ?? 0
                    ),
                "cancelled_requests" =>
                    (int)(
                        $summary[
                            "cancelled_requests"
                        ] ?? 0
                    )
            ]
        ]
    );
} catch (Throwable $error) {
    error_log(
        "Supplier product request list error: " .
        $error->getMessage()
    );

    supplierProductRespond(
        false,
        "Unable to load supplier product requests.",
        [
            
            "requests" => [],
            "summary" => []
        ],
        500
    );
}