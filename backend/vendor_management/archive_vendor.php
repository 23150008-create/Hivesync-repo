<?php

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("vendors");
requireAnyRole(["Admin", "Staff"]);

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Invalid request method."]);
    exit;
}

requireCsrfToken();

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "No supplier information was received."]);
    exit;
}

$vendorId = filter_var($data["vendor_id"] ?? null, FILTER_VALIDATE_INT);
$action = strtolower(trim($data["action"] ?? "archive"));

if (!$vendorId) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "A valid supplier ID is required."]);
    exit;
}

if (!in_array($action, ["archive", "restore"], true)) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Invalid supplier status action."]);
    exit;
}

try {
    $checkStmt = $conn->prepare("
        SELECT vendor_id, vendor_name, status
        FROM tbl_vendor
        WHERE vendor_id = :vendor_id
        LIMIT 1
    ");
    $checkStmt->execute([":vendor_id" => $vendorId]);
    $supplier = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$supplier) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Supplier record was not found."]);
        exit;
    }

    $newStatus = $action === "restore" ? "Active" : "Archived";

    if ($supplier["status"] === $newStatus) {
        echo json_encode([
            "success" => true,
            "message" => $action === "restore"
                ? "Supplier is already active."
                : "Supplier is already archived."
        ]);
        exit;
    }

    $stmt = $conn->prepare("
        UPDATE tbl_vendor
        SET status = :status
        WHERE vendor_id = :vendor_id
    ");
    $stmt->execute([
        ":status" => $newStatus,
        ":vendor_id" => $vendorId
    ]);

    echo json_encode([
        "success" => true,
        "message" => $action === "restore"
            ? "Supplier restored successfully and is available in Delivery Management."
            : "Supplier archived successfully. Existing products, deliveries, reports, and history were preserved."
    ]);
} catch (Throwable $e) {
    error_log("HiveSync archive vendor error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Unable to update the supplier status."]);
}
