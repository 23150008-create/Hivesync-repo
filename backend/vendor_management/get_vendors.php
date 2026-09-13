<?php

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("vendors");
requireAnyRole(["Admin", "Staff", "Audit"]);

try {
    $archived = isset($_GET["archived"]) && $_GET["archived"] === "1";

    $where = $archived
        ? "WHERE v.status = 'Archived'"
        : "WHERE v.status <> 'Archived'";

    $stmt = $conn->prepare("
        SELECT
            v.vendor_id,
            v.vendor_name,
            v.contact_person,
            v.phone,
            v.address,
            v.status,
            v.created_at,
            COUNT(DISTINCT active_product.product_id) AS product_count,
            COUNT(
                DISTINCT CASE
                    WHEN delivery_product.product_id IS NOT NULL
                    THEN d.delivery_id
                    ELSE NULL
                END
            ) AS delivery_count
        FROM tbl_vendor v
        LEFT JOIN tbl_inv active_product
            ON active_product.vendor_id = v.vendor_id
            AND COALESCE(active_product.status, 'In Stock') <> 'Archived'
        LEFT JOIN tbl_delivery d
            ON d.vendor_id = v.vendor_id
            AND COALESCE(d.status, 'Delivered') <> 'Archived'
        LEFT JOIN tbl_delivery_items di
            ON di.delivery_id = d.delivery_id
        LEFT JOIN tbl_inv delivery_product
            ON delivery_product.product_id = di.product_id
            AND delivery_product.vendor_id = v.vendor_id
            AND COALESCE(delivery_product.status, 'In Stock') <> 'Archived'
        {$where}
        GROUP BY
            v.vendor_id,
            v.vendor_name,
            v.contact_person,
            v.phone,
            v.address,
            v.status,
            v.created_at
        ORDER BY v.vendor_id DESC
    ");

    $stmt->execute();
    $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($vendors as &$vendor) {
        $vendor["vendor_id"] = (int)$vendor["vendor_id"];
        $vendor["product_count"] = (int)$vendor["product_count"];
        $vendor["delivery_count"] = (int)$vendor["delivery_count"];
    }
    unset($vendor);

    echo json_encode([
        "success" => true,
        "vendors" => $vendors
    ]);
} catch (Throwable $e) {
    error_log("HiveSync get vendors error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Unable to load supplier records.",
        "vendors" => []
    ]);
}