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
$vendorName = trim($data["vendor_name"] ?? "");
$contactPerson = trim($data["contact_person"] ?? "");
$phone = trim($data["phone"] ?? "");
$address = trim($data["address"] ?? "");

if (!$vendorId) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "A valid supplier ID is required."]);
    exit;
}

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
    $existingStmt = $conn->prepare("
        SELECT vendor_id, vendor_name, status
        FROM tbl_vendor
        WHERE vendor_id = :vendor_id
        LIMIT 1
    ");
    $existingStmt->execute([":vendor_id" => $vendorId]);
    $existingSupplier = $existingStmt->fetch(PDO::FETCH_ASSOC);

    if (!$existingSupplier) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Supplier record was not found."]);
        exit;
    }

    if ($existingSupplier["status"] === "Archived") {
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Restore the archived supplier before editing it."]);
        exit;
    }

    $duplicateStmt = $conn->prepare("
        SELECT vendor_id
        FROM tbl_vendor
        WHERE LOWER(TRIM(vendor_name)) = LOWER(TRIM(:vendor_name))
        AND vendor_id <> :vendor_id
        LIMIT 1
    ");
    $duplicateStmt->execute([
        ":vendor_name" => $vendorName,
        ":vendor_id" => $vendorId
    ]);

    if ($duplicateStmt->fetch(PDO::FETCH_ASSOC)) {
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Another supplier already uses this supplier name."]);
        exit;
    }

    $stmt = $conn->prepare("
        UPDATE tbl_vendor
        SET vendor_name = :vendor_name,
            contact_person = :contact_person,
            phone = :phone,
            address = :address
        WHERE vendor_id = :vendor_id
    ");
    $stmt->execute([
        ":vendor_name" => $vendorName,
        ":contact_person" => $contactPerson,
        ":phone" => $phone,
        ":address" => $address,
        ":vendor_id" => $vendorId
    ]);

    echo json_encode(["success" => true, "message" => "Supplier information updated successfully."]);
} catch (Throwable $e) {
    error_log("HiveSync update vendor error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Unable to update the supplier record."]);
}
