<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/database.php");

header("Content-Type: application/json; charset=utf-8");

try {
    $stmt = $conn->prepare("
        SELECT
            vendor_id,
            vendor_name
        FROM tbl_vendor
        WHERE status = 'Active'
        ORDER BY vendor_name ASC
    ");

    $stmt->execute();

    $vendors = $stmt->fetchAll(
        PDO::FETCH_ASSOC
    );

    echo json_encode(
        [
            "success" => true,
            "vendors" => $vendors
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );
} catch (Throwable $error) {
    http_response_code(500);

    error_log(
        "inventory_management/get_vendors.php: " .
        $error->getMessage()
    );

    echo json_encode([
        "success" => false,
        "message" => "Unable to load suppliers.",
        "vendors" => []
    ]);
}
