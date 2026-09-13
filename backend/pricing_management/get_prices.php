<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once("../config/database.php");

try {
    $stmt = $conn->prepare("
        SELECT 
            i.product_id,
            i.product_name,
            i.category,
            i.supplier_price,
            i.selling_price,
            i.vendor_id,
            v.vendor_name
        FROM tbl_inv i
        LEFT JOIN tbl_vendor v ON i.vendor_id = v.vendor_id
        ORDER BY i.product_name ASC
    ");

    $stmt->execute();
    $prices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "prices" => $prices
    ]);
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
?>