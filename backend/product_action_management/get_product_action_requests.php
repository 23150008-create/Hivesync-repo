<?php

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("_helpers.php");

requireAuthentication();

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    productActionRespond(
        false,
        "Invalid request method.",
        [
            "requests" => [],
            "summary" => []
        ],
        405
    );
}

function buildProductActionImageUrl(?string $image): string
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

    if (
        str_starts_with(
            $image,
            "uploads/"
        )
    ) {
        return
            $baseUrl .
            ltrim($image, "/");
    }

    if (
        str_starts_with(
            $image,
            "products/"
        )
    ) {
        return
            $baseUrl .
            "uploads/" .
            ltrim($image, "/");
    }

    return
        $baseUrl .
        "uploads/products/" .
        ltrim($image, "/");
}

$vendorId = filter_var(
    $_GET["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (in_array((string)($_SESSION["role"] ?? ""), ["Supplier", "Vendor"], true)) {
    $sessionVendorId = (int)($_SESSION["vendor_id"] ?? 0);

    if ($sessionVendorId <= 0) {
        productActionRespond(
            false,
            "Your supplier account is not linked to a supplier record.",
            ["requests" => [], "summary" => []],
            403
        );
    }

    if ($vendorId && (int)$vendorId !== $sessionVendorId) {
        productActionRespond(
            false,
            "You do not have permission to access another supplier's product actions.",
            ["requests" => [], "summary" => []],
            403
        );
    }

    $vendorId = $sessionVendorId;
} else {
    requireModulePermission("vendors");
    requireAnyRole(["Admin", "Staff", "Audit"]);
}

$status = trim(
    (string)($_GET["status"] ?? "")
);

$actionType = normalizeProductActionType(
    $_GET["action_type"] ?? ""
);

$search = trim(
    (string)($_GET["search"] ?? "")
);

$allowedStatuses = [
    "",
    "All",
    "Pending",
    "Approved",
    "Rejected",
    "Completed"
];

if (
    !in_array(
        $status,
        $allowedStatuses,
        true
    )
) {
    productActionRespond(
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
    

    $hasRemainingQuantity =
        productActionColumnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        );

    $batchRemainingColumn =
        $hasRemainingQuantity
            ? "b.remaining_quantity"
            : "b.quantity";

    

    $where = [];
    $params = [];

    if ($vendorId) {
        $where[] =
            "r.vendor_id = :vendor_id";

        $params[":vendor_id"] =
            $vendorId;
    }

    if (
        $status !== "" &&
        $status !== "All"
    ) {
        $where[] =
            "r.status = :status";

        $params[":status"] =
            $status;
    }

    if ($actionType !== "") {
        $where[] =
            "r.action_type = :action_type";

        $params[":action_type"] =
            $actionType;
    }

    if ($search !== "") {
        $searchValue = "%" . $search . "%";

        $searchColumns = [
            "r.request_no",
            "v.vendor_name",
            "v.contact_person",
            "i.product_name",
            "i.sku",
            "r.reason",
            "r.requested_by_name",
            "r.reviewed_by_name"
        ];

        $searchParts = [];

        foreach ($searchColumns as $index => $column) {
            $placeholder = ":search_" . $index;
            $searchParts[] = "{$column} LIKE {$placeholder}";
            $params[$placeholder] = $searchValue;
        }

        $where[] = "(" . implode(" OR ", $searchParts) . ")";
    }

    $whereSql =
        count($where) > 0
            ? "WHERE " .
                implode(
                    " AND ",
                    $where
                )
            : "";

    

    $stmt = $conn->prepare("
        SELECT
            r.request_id,
            r.request_no,
            r.vendor_id,
            r.product_id,
            r.batch_id,
            r.action_type,
            r.requested_quantity,
            r.approved_quantity,
            r.reason,
            r.preferred_action_date,
            r.disposal_method,
            r.supplier_remarks,
            r.status,
            r.requested_by,
            r.requested_by_name,
            r.reviewed_by,
            r.reviewed_by_name,
            r.reviewed_at,
            r.rejection_reason,
            r.completed_by,
            r.completed_by_name,
            r.completed_at,
            r.created_at,
            r.updated_at,

            v.vendor_name,
            v.contact_person,
            v.phone,
            v.address,

            i.product_name,
            i.sku,
            i.product_image,

            i.family_id,
            i.request_variant_id,
            i.variant_label,
            i.variant_value,
            i.variant_unit,
            i.variant_sort,
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

            COALESCE(
                i.quantity,
                0
            ) AS current_product_quantity,

            b.quantity
                AS original_batch_quantity,

            COALESCE(
                {$batchRemainingColumn},
                0
            ) AS current_batch_quantity,

            b.expiry_date
                AS batch_expiry_date,

            b.supplier_price,
            b.delivery_id,

            d.delivery_order_no,
            d.delivery_date,
            d.status
                AS delivery_status,

            CASE
                WHEN b.batch_id IS NULL
                THEN 'No Batch Selected'

                WHEN COALESCE(
                    {$batchRemainingColumn},
                    0
                ) <= 0
                THEN 'Depleted'

                WHEN b.expiry_date IS NULL
                THEN 'No Expiry'

                WHEN b.expiry_date < CURDATE()
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
            END AS days_until_expiry,

            CASE
                WHEN r.status = 'Pending'
                THEN 'Awaiting Review'

                WHEN r.status = 'Approved'
                THEN 'Awaiting Completion'

                WHEN r.status = 'Rejected'
                THEN 'Request Rejected'

                WHEN r.status = 'Completed'
                THEN 'Inventory Updated'

                ELSE r.status
            END AS status_description

        FROM tbl_product_action_request r

        INNER JOIN tbl_vendor v
            ON v.vendor_id =
               r.vendor_id

        INNER JOIN tbl_inv i
            ON i.product_id =
               r.product_id

        LEFT JOIN tbl_inventory_batches b
            ON b.batch_id =
               r.batch_id

        LEFT JOIN tbl_delivery d
            ON d.delivery_id =
               b.delivery_id

        {$whereSql}

        ORDER BY
            CASE r.status
                WHEN 'Pending' THEN 1
                WHEN 'Approved' THEN 2
                WHEN 'Completed' THEN 3
                WHEN 'Rejected' THEN 4
                ELSE 5
            END,

            CASE
                WHEN r.preferred_action_date
                    IS NULL
                THEN 1
                ELSE 0
            END,

            r.preferred_action_date ASC,
            r.created_at DESC,
            r.request_id DESC
    ");

    foreach (
        $params as $key => $value
    ) {
        if ($key === ":vendor_id") {
            $stmt->bindValue(
                $key,
                (int)$value,
                PDO::PARAM_INT
            );
        } else {
            $stmt->bindValue(
                $key,
                (string)$value,
                PDO::PARAM_STR
            );
        }
    }

    $stmt->execute();

    $requests = $stmt->fetchAll(
        PDO::FETCH_ASSOC
    );

    

    foreach ($requests as &$request) {
        $request["request_id"] =
            (int)($request["request_id"] ?? 0);

        $request["vendor_id"] =
            (int)($request["vendor_id"] ?? 0);

        $request["product_id"] =
            (int)($request["product_id"] ?? 0);

        $request["product_image"] =
            trim(
                (string)(
                    $request["product_image"] ?? ""
                )
            );

        $request["product_image_url"] =
            buildProductActionImageUrl(
                $request["product_image"]
            );

        $request["family_id"] =
            (int)(
                $request["family_id"] ??
                $request["product_id"]
            );

        $request["request_variant_id"] =
            $request["request_variant_id"] !== null
                ? (int)$request["request_variant_id"]
                : null;

        $request["variant_value"] =
            $request["variant_value"] !== null
                ? (float)$request["variant_value"]
                : null;

        $request["variant_sort"] =
            (int)($request["variant_sort"] ?? 0);

        $request["is_consignment"] =
            (int)($request["is_consignment"] ?? 0);

        $variantLabel = trim(
            (string)($request["variant_label"] ?? "")
        );

        if (
            $variantLabel === "" ||
            strtolower($variantLabel) === "standard"
        ) {
            $variantValue = trim(
                (string)($request["variant_value"] ?? "")
            );
            $variantUnit = trim(
                (string)($request["variant_unit"] ?? "")
            );

            if ($variantValue !== "" || $variantUnit !== "") {
                $variantLabel =
                    trim($variantValue . " " . $variantUnit);
            } else {
                $variantLabel = "Standard";
            }
        }

        $request["variant_label"] = $variantLabel;

        $request["product_display_name"] =
            strtolower($variantLabel) !== "standard"
                ? $request["product_name"] . " — " . $variantLabel
                : $request["product_name"];

        $request["batch_id"] =
            $request["batch_id"] !== null
                ? (int)$request["batch_id"]
                : null;

        $request["requested_quantity"] =
            (int)(
                $request[
                    "requested_quantity"
                ] ?? 0
            );

        $request["approved_quantity"] =
            $request["approved_quantity"] !== null
                ? (int)$request[
                    "approved_quantity"
                ]
                : null;

        $request["current_product_quantity"] =
            (int)(
                $request[
                    "current_product_quantity"
                ] ?? 0
            );

        $request["original_batch_quantity"] =
            $request[
                "original_batch_quantity"
            ] !== null
                ? (int)$request[
                    "original_batch_quantity"
                ]
                : null;

        $request["current_batch_quantity"] =
            (int)(
                $request[
                    "current_batch_quantity"
                ] ?? 0
            );

        $request["supplier_price"] =
            $request["supplier_price"] !== null
                ? (float)$request[
                    "supplier_price"
                ]
                : null;

        $request["days_until_expiry"] =
            $request[
                "days_until_expiry"
            ] !== null
                ? (int)$request[
                    "days_until_expiry"
                ]
                : null;
    }

    unset($request);

    

    $summaryWhere = [];
    $summaryParams = [];

    if ($vendorId) {
        $summaryWhere[] =
            "r.vendor_id =
             :summary_vendor_id";

        $summaryParams[
            ":summary_vendor_id"
        ] = $vendorId;
    }

    if ($actionType !== "") {
        $summaryWhere[] =
            "r.action_type =
             :summary_action_type";

        $summaryParams[
            ":summary_action_type"
        ] = $actionType;
    }

    if ($search !== "") {
        $summaryWhere[] = "(
            r.request_no
                LIKE :summary_search
            OR v.vendor_name
                LIKE :summary_search
            OR v.contact_person
                LIKE :summary_search
            OR i.product_name
                LIKE :summary_search
            OR i.sku
                LIKE :summary_search
            OR r.reason
                LIKE :summary_search
            OR r.requested_by_name
                LIKE :summary_search
        )";

        $summaryParams[
            ":summary_search"
        ] = "%" . $search . "%";
    }

    $summaryWhereSql =
        count($summaryWhere) > 0
            ? "WHERE " .
                implode(
                    " AND ",
                    $summaryWhere
                )
            : "";

    

    $summaryStmt = $conn->prepare("
        SELECT
            COUNT(r.request_id)
                AS total_requests,

            COALESCE(
                SUM(
                    CASE
                        WHEN r.status = 'Pending'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS pending,

            COALESCE(
                SUM(
                    CASE
                        WHEN r.status = 'Approved'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS approved,

            COALESCE(
                SUM(
                    CASE
                        WHEN r.status = 'Rejected'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS rejected,

            COALESCE(
                SUM(
                    CASE
                        WHEN r.status = 'Completed'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS completed,

            COALESCE(
                SUM(
                    CASE
                        WHEN r.action_type = 'Pull-out'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS pullout_requests,

            COALESCE(
                SUM(
                    CASE
                        WHEN r.action_type = 'Disposal'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS disposal_requests,

            COALESCE(
                SUM(
                    r.requested_quantity
                ),
                0
            ) AS total_requested_quantity,

            COALESCE(
                SUM(
                    CASE
                        WHEN r.status = 'Completed'
                        THEN COALESCE(
                            r.approved_quantity,
                            r.requested_quantity
                        )
                        ELSE 0
                    END
                ),
                0
            ) AS total_completed_quantity

        FROM tbl_product_action_request r

        INNER JOIN tbl_vendor v
            ON v.vendor_id =
               r.vendor_id

        INNER JOIN tbl_inv i
            ON i.product_id =
               r.product_id

        {$summaryWhereSql}
    ");

    foreach (
        $summaryParams as
        $key => $value
    ) {
        if (
            $key ===
            ":summary_vendor_id"
        ) {
            $summaryStmt->bindValue(
                $key,
                (int)$value,
                PDO::PARAM_INT
            );
        } else {
            $summaryStmt->bindValue(
                $key,
                (string)$value,
                PDO::PARAM_STR
            );
        }
    }

    $summaryStmt->execute();

    $summaryResult =
        $summaryStmt->fetch(
            PDO::FETCH_ASSOC
        );

    $summary = [
        "total_requests" =>
            (int)(
                $summaryResult[
                    "total_requests"
                ] ?? 0
            ),

        "pending" =>
            (int)(
                $summaryResult[
                    "pending"
                ] ?? 0
            ),

        "approved" =>
            (int)(
                $summaryResult[
                    "approved"
                ] ?? 0
            ),

        "rejected" =>
            (int)(
                $summaryResult[
                    "rejected"
                ] ?? 0
            ),

        "completed" =>
            (int)(
                $summaryResult[
                    "completed"
                ] ?? 0
            ),

        "pullout_requests" =>
            (int)(
                $summaryResult[
                    "pullout_requests"
                ] ?? 0
            ),

        "disposal_requests" =>
            (int)(
                $summaryResult[
                    "disposal_requests"
                ] ?? 0
            ),

        "total_requested_quantity" =>
            (int)(
                $summaryResult[
                    "total_requested_quantity"
                ] ?? 0
            ),

        "total_completed_quantity" =>
            (int)(
                $summaryResult[
                    "total_completed_quantity"
                ] ?? 0
            )
    ];

    productActionRespond(
        true,
        "Product action requests retrieved successfully.",
        [
            "requests" => $requests,
            "summary" => $summary,
            "filters" => [
                "vendor_id" =>
                    $vendorId ?: null,

                "status" =>
                    $status !== ""
                        ? $status
                        : "All",

                "action_type" =>
                    $actionType !== ""
                        ? $actionType
                        : "All",

                "search" => $search
            ]
        ]
    );
} catch (Throwable $error) {
    error_log(
        "Get product action requests error: " .
        $error->getMessage()
    );

    productActionRespond(
        false,
        "Unable to retrieve product action requests.",
        [
            "requests" => [],
            "summary" => [
                "total_requests" => 0,
                "pending" => 0,
                "approved" => 0,
                "rejected" => 0,
                "completed" => 0,
                "pullout_requests" => 0,
                "disposal_requests" => 0,
                "total_requested_quantity" => 0,
                "total_completed_quantity" => 0
            ],
            
        ],
        500
    );
}