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

if (!$data || empty($data["consignment_id"])) {
    echo json_encode([
        "success" => false,
        "message" => "Consignment ID is required"
    ]);
    exit;
}

try {
    $stmt = $conn->prepare("
        UPDATE tbl_consignment
        SET status = 'Archived'
        WHERE consignment_id = :consignment_id
    ");

    $success = $stmt->execute([
        ":consignment_id" => $data["consignment_id"]
    ]);

    echo json_encode([
        "success" => $success,
        "message" => $success
            ? "Consignment archived successfully"
            : "Failed to archive consignment"
    ]);

} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}

?>