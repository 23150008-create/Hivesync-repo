<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require_once("../config/database.php");

try {
    $stmt = $conn->prepare("
        SELECT
            c.consignment_id,
            c.proprietor_name,
            c.business_name,
            c.business_address,
            c.contact_number,
            c.email_address,
            c.gcash_allowed,
            c.gcash_name,
            c.gcash_number,
            c.payment_schedule,
            c.remarks,
            c.status,
            c.created_at,
            i.item_id,
            i.quantity,
            i.product_name,
            i.product_description,
            i.product_image,
            i.unit_price,
            i.hive_price,
            i.owner_percentage,
            i.hive_percentage,
            i.owner_amount,
            i.hive_amount,
            i.total_price
        FROM tbl_consignment c
        LEFT JOIN tbl_consignment_items i
            ON c.consignment_id = i.consignment_id
        WHERE c.status != 'Archived'
        ORDER BY c.consignment_id DESC
    ");

    $stmt->execute();
    $consignments = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($consignments as &$row) {
        $row["product_image_url"] =
            !empty($row["product_image"])
                ? "http://localhost/HiveSync/backend/uploads/consignment/" . $row["product_image"]
                : "";
    }

    echo json_encode([
        "success" => true,
        "consignments" => $consignments
    ]);

} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "consignments" => []
    ]);
}

?>