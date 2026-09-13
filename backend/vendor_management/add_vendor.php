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

$vendorName = trim($data["vendor_name"] ?? "");
$contactPerson = trim($data["contact_person"] ?? "");
$phone = trim($data["phone"] ?? "");
$address = trim($data["address"] ?? "");

if ($vendorName === "") {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Supplier name is required."]);
    exit;
}

if (mb_strlen($vendorName) < 2 || mb_strlen($vendorName) > 150) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Supplier name must contain between 2 and 150 characters."]);
    exit;
}

if ($contactPerson !== "" && mb_strlen($contactPerson) > 150) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Contact person must not exceed 150 characters."]);
    exit;
}

if ($phone !== "" && !preg_match("/^09\d{9}$/", $phone)) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Phone number must contain 11 digits and start with 09."]);
    exit;
}

if (mb_strlen($address) > 500) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Address must not exceed 500 characters."]);
    exit;
}

try {
    $duplicateStmt = $conn->prepare("
        SELECT vendor_id, vendor_name, status
        FROM tbl_vendor
        WHERE LOWER(TRIM(vendor_name)) = LOWER(TRIM(:vendor_name))
        LIMIT 1
    ");
    $duplicateStmt->execute([":vendor_name" => $vendorName]);
    $existingSupplier = $duplicateStmt->fetch(PDO::FETCH_ASSOC);

    if ($existingSupplier) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => $existingSupplier["status"] === "Archived"
                ? "This supplier already exists in Archived Suppliers. Restore the existing record instead."
                : "A supplier with this name already exists."
        ]);
        exit;
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_vendor
        (vendor_name, contact_person, phone, address, status, created_at)
        VALUES
        (:vendor_name, :contact_person, :phone, :address, 'Active', NOW())
    ");
    $stmt->execute([
        ":vendor_name" => $vendorName,
        ":contact_person" => $contactPerson,
        ":phone" => $phone,
        ":address" => $address
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Supplier added successfully and is now available in Delivery Management.",
        "vendor_id" => $conn->lastInsertId()
    ]);
} catch (Throwable $e) {
    error_log("HiveSync add vendor error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Unable to add the supplier record."]);
}
