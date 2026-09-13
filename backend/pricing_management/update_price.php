<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require_once("../config/database.php");

$data = json_decode(file_get_contents("php://input"), true);

try {
    $stmt = $conn->prepare("
        UPDATE tbl_inv
        SET supplier_price = :supplier_price,
            selling_price = :selling_price,
            updated_at = NOW()
        WHERE product_id = :product_id
    ");

    $stmt->execute([
        ":supplier_price" => $data["supplier_price"],
        ":selling_price" => $data["selling_price"],
        ":product_id" => $data["product_id"]
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Price updated successfully."
    ]);
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
?>