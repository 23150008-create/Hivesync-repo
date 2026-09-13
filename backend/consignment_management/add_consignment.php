<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require_once("../config/database.php");

try {
    $conn->beginTransaction();

    $proprietor_name = trim($_POST["proprietor_name"] ?? "");
    $business_name = trim($_POST["business_name"] ?? "");
    $business_address = trim($_POST["business_address"] ?? "");
    $contact_number = trim($_POST["contact_number"] ?? "");
    $email_address = trim($_POST["email_address"] ?? "");
    $gcash_allowed = trim($_POST["gcash_allowed"] ?? "No");
    $gcash_name = trim($_POST["gcash_name"] ?? "");
    $gcash_number = trim($_POST["gcash_number"] ?? "");
    $payment_schedule = trim($_POST["payment_schedule"] ?? "");
    $remarks = trim($_POST["remarks"] ?? "");
    $status = trim($_POST["status"] ?? "Active");

    $quantity = (int)($_POST["quantity"] ?? 0);
    $product_name = trim($_POST["product_name"] ?? "");
    $product_description = trim($_POST["product_description"] ?? "");
    $unit_price = (float)($_POST["unit_price"] ?? 0);
    $hive_price = (float)($_POST["hive_price"] ?? 0);
    $owner_percentage = (float)($_POST["owner_percentage"] ?? 0);
    $hive_percentage = (float)($_POST["hive_percentage"] ?? 0);

    if ($proprietor_name === "" || $product_name === "") {
        echo json_encode([
            "success" => false,
            "message" => "Proprietor name and product name are required"
        ]);
        exit;
    }

    $product_image = "";

    if (isset($_FILES["product_image"]) && $_FILES["product_image"]["error"] === 0) {
        $uploadDir = "../uploads/consignment/";

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $fileName = time() . "_" . basename($_FILES["product_image"]["name"]);
        $targetPath = $uploadDir . $fileName;

        if (move_uploaded_file($_FILES["product_image"]["tmp_name"], $targetPath)) {
            $product_image = $fileName;
        }
    }

    $total_price = $quantity * $hive_price;
    $owner_amount = $total_price * ($owner_percentage / 100);
    $hive_amount = $total_price * ($hive_percentage / 100);

    $stmt = $conn->prepare("
        INSERT INTO tbl_consignment
        (
            proprietor_name,
            business_name,
            business_address,
            contact_number,
            email_address,
            gcash_allowed,
            gcash_name,
            gcash_number,
            payment_schedule,
            remarks,
            status,
            created_at
        )
        VALUES
        (
            :proprietor_name,
            :business_name,
            :business_address,
            :contact_number,
            :email_address,
            :gcash_allowed,
            :gcash_name,
            :gcash_number,
            :payment_schedule,
            :remarks,
            :status,
            NOW()
        )
    ");

    $stmt->execute([
        ":proprietor_name" => $proprietor_name,
        ":business_name" => $business_name,
        ":business_address" => $business_address,
        ":contact_number" => $contact_number,
        ":email_address" => $email_address,
        ":gcash_allowed" => $gcash_allowed,
        ":gcash_name" => $gcash_name,
        ":gcash_number" => $gcash_number,
        ":payment_schedule" => $payment_schedule,
        ":remarks" => $remarks,
        ":status" => $status
    ]);

    $consignment_id = $conn->lastInsertId();

    $itemStmt = $conn->prepare("
        INSERT INTO tbl_consignment_items
        (
            consignment_id,
            quantity,
            product_name,
            product_description,
            product_image,
            unit_price,
            hive_price,
            owner_percentage,
            hive_percentage,
            owner_amount,
            hive_amount,
            total_price,
            created_at
        )
        VALUES
        (
            :consignment_id,
            :quantity,
            :product_name,
            :product_description,
            :product_image,
            :unit_price,
            :hive_price,
            :owner_percentage,
            :hive_percentage,
            :owner_amount,
            :hive_amount,
            :total_price,
            NOW()
        )
    ");

    $itemStmt->execute([
        ":consignment_id" => $consignment_id,
        ":quantity" => $quantity,
        ":product_name" => $product_name,
        ":product_description" => $product_description,
        ":product_image" => $product_image,
        ":unit_price" => $unit_price,
        ":hive_price" => $hive_price,
        ":owner_percentage" => $owner_percentage,
        ":hive_percentage" => $hive_percentage,
        ":owner_amount" => $owner_amount,
        ":hive_amount" => $hive_amount,
        ":total_price" => $total_price
    ]);

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" => "Consignment application added successfully"
    ]);

} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}

?>