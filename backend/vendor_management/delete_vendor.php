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

$vendorId = filter_var(
    $data["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$vendorId) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "A valid supplier ID is required."
    ]);

    exit;
}

try {
    $checkStmt = $conn->prepare("
        SELECT vendor_id
        FROM tbl_vendor
        WHERE vendor_id = :vendor_id
        LIMIT 1
    ");

    $checkStmt->execute([
        ":vendor_id" => $vendorId
    ]);

    if (!$checkStmt->fetch(PDO::FETCH_ASSOC)) {
        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "Supplier record was not found."
        ]);

        exit;
    }

    $stmt = $conn->prepare("
        UPDATE tbl_vendor
        SET status = 'Archived'
        WHERE vendor_id = :vendor_id
    ");

    $stmt->execute([
        ":vendor_id" => $vendorId
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Supplier archived successfully."
    ]);
} catch (Exception $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to archive the supplier."
    ]);
}