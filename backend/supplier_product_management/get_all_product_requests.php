<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("_helpers.php");

requireModulePermission("vendors");
requireAnyRole(["Admin", "Staff", "Audit"]);

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

$status = trim((string)($_GET["status"] ?? "All"));
$search = trim((string)($_GET["search"] ?? ""));

$vendorId = filter_var(
    $_GET["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

$allowedStatuses = [
    "All",
    "Pending",
    "Approved",
    "Rejected",
    "Cancelled"
];

if (!in_array($status, $allowedStatuses, true)) {
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
    $where = [];
    $params = [];

    if ($status !== "" && $status !== "All") {
        $where[] = "r.status = :status";
        $params[":status"] = $status;
    }

    if ($vendorId) {
        $where[] = "r.vendor_id = :vendor_id";
        $params[":vendor_id"] = $vendorId;
    }

    if ($search !== "") {
        $searchValue = "%{$search}%";

        $searchColumns = [
            "r.request_no",
            "r.product_name",
            "r.requested_sku",
            "r.generated_sku",
            "r.category_name",
            "r.unit_type",
            "r.status",
            "r.requested_by_name",
            "r.reviewed_by_name",
            "r.rejection_reason",
            "v.vendor_name",
            "v.contact_person"
        ];

        $searchParts = [];

        foreach ($searchColumns as $index => $column) {
            $placeholder = ":search_{$index}";
            $searchParts[] = "{$column} LIKE {$placeholder}";
            $params[$placeholder] = $searchValue;
        }

        $where[] = "(" . implode(" OR ", $searchParts) . ")";
    }

    $whereSql =
        $where
            ? "WHERE " . implode(" AND ", $where)
            : "";

    $stmt = $conn->prepare("
        SELECT
            r.request_id,
            r.request_no,
            r.vendor_id,
            v.vendor_name,
            v.contact_person,
            v.phone,
            v.address,
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
            ON i.product_id = r.approved_product_id
        {$whereSql}
        ORDER BY
            CASE
                WHEN r.status = 'Pending' THEN 1
                WHEN r.status = 'Rejected' THEN 2
                WHEN r.status = 'Approved' THEN 3
                ELSE 4
            END,
            r.created_at DESC,
            r.request_id DESC
    ");

    $stmt->execute($params);

    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $summaryWhere = [];
    $summaryParams = [];

    if ($vendorId) {
        $summaryWhere[] = "vendor_id = :summary_vendor_id";
        $summaryParams[":summary_vendor_id"] = $vendorId;
    }

    $summaryWhereSql =
        $summaryWhere
            ? "WHERE " . implode(" AND ", $summaryWhere)
            : "";

    $summaryStmt = $conn->prepare("
        SELECT
            COUNT(*) AS total_requests,
            COALESCE(SUM(status = 'Pending'), 0) AS pending_requests,
            COALESCE(SUM(status = 'Approved'), 0) AS approved_requests,
            COALESCE(SUM(status = 'Rejected'), 0) AS rejected_requests,
            COALESCE(SUM(status = 'Cancelled'), 0) AS cancelled_requests
        FROM tbl_supplier_product_request
        {$summaryWhereSql}
    ");

    $summaryStmt->execute($summaryParams);

    $summary =
        $summaryStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    supplierProductRespond(
        true,
        "Supplier product requests loaded successfully.",
        [
            "requests" => $requests,
            "summary" => [
                "total_requests" =>
                    (int)($summary["total_requests"] ?? 0),
                "pending_requests" =>
                    (int)($summary["pending_requests"] ?? 0),
                "approved_requests" =>
                    (int)($summary["approved_requests"] ?? 0),
                "rejected_requests" =>
                    (int)($summary["rejected_requests"] ?? 0),
                "cancelled_requests" =>
                    (int)($summary["cancelled_requests"] ?? 0)
            ]
        ]
    );
} catch (Throwable $error) {
    error_log(
        "Admin supplier product request error: " .
        $error->getMessage()
    );

    supplierProductRespond(
        false,
        "Unable to load supplier product requests.",
        [
            "requests" => [],
            "summary" => [
                "total_requests" => 0,
                "pending_requests" => 0,
                "approved_requests" => 0,
                "rejected_requests" => 0,
                "cancelled_requests" => 0
            ]
        ],
        500
    );
}
