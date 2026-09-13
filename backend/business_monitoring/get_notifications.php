<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require_once("../config/database.php");

$activeCondition = "(status IS NULL OR status = '' OR status = 'Active')";

try {
    $notifications = [];

    $stmt = $conn->prepare("
        SELECT product_name, quantity, reorder_level
        FROM tbl_inv
        WHERE $activeCondition
        AND quantity > 0
        AND quantity <= reorder_level
        ORDER BY quantity ASC
    ");
    $stmt->execute();

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
        $notifications[] = [
            "type" => "Inventory",
            "title" => "Low Stock",
            "message" => $item["product_name"] . " is low on stock. Current stock: " . $item["quantity"] . ". Reorder level: " . $item["reorder_level"] . ".",
            "priority" => "Medium"
        ];
    }

    $stmt = $conn->prepare("
        SELECT product_name
        FROM tbl_inv
        WHERE $activeCondition
        AND quantity <= 0
        ORDER BY product_name ASC
    ");
    $stmt->execute();

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
        $notifications[] = [
            "type" => "Inventory",
            "title" => "Out of Stock",
            "message" => $item["product_name"] . " is currently out of stock.",
            "priority" => "High"
        ];
    }

    $stmt = $conn->prepare("
        SELECT product_name, expiry_date
        FROM tbl_inv
        WHERE $activeCondition
        AND expiry_date IS NOT NULL
        AND expiry_date != ''
        AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        ORDER BY expiry_date ASC
    ");
    $stmt->execute();

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
        $notifications[] = [
            "type" => "Inventory",
            "title" => "Expiring Product",
            "message" => $item["product_name"] . " will expire on " . $item["expiry_date"] . ".",
            "priority" => "Medium"
        ];
    }

    $stmt = $conn->prepare("
        SELECT product_name, expiry_date
        FROM tbl_inv
        WHERE $activeCondition
        AND expiry_date IS NOT NULL
        AND expiry_date != ''
        AND expiry_date < CURDATE()
        ORDER BY expiry_date ASC
    ");
    $stmt->execute();

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
        $notifications[] = [
            "type" => "Inventory",
            "title" => "Expired Product",
            "message" => $item["product_name"] . " expired on " . $item["expiry_date"] . ".",
            "priority" => "High"
        ];
    }

    $stmt = $conn->prepare("
        SELECT delivery_id, delivery_date, status
        FROM tbl_delivery
        WHERE LOWER(TRIM(status)) = 'pending'
        ORDER BY delivery_date ASC
    ");
    $stmt->execute();

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $delivery) {
        $deliveryCode = "DEL-" . str_pad($delivery["delivery_id"], 4, "0", STR_PAD_LEFT);

        $notifications[] = [
            "type" => "Delivery",
            "title" => "Pending Delivery",
            "message" => $deliveryCode . " is still pending. Delivery date: " . $delivery["delivery_date"] . ".",
            "priority" => "Low"
        ];
    }

    $stmt = $conn->prepare("
        SELECT delivery_id, delivery_date, status
        FROM tbl_delivery
        WHERE LOWER(TRIM(status)) = 'in transit'
        ORDER BY delivery_date ASC
    ");
    $stmt->execute();

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $delivery) {
        $deliveryCode = "DEL-" . str_pad($delivery["delivery_id"], 4, "0", STR_PAD_LEFT);

        $notifications[] = [
            "type" => "Delivery",
            "title" => "Delivery In Transit",
            "message" => $deliveryCode . " is currently in transit. Delivery date: " . $delivery["delivery_date"] . ".",
            "priority" => "Medium"
        ];
    }

    $stmt = $conn->prepare("
        SELECT delivery_id, delivery_date, status
        FROM tbl_delivery
        WHERE LOWER(TRIM(status)) = 'cancelled'
        ORDER BY delivery_date ASC
    ");
    $stmt->execute();

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $delivery) {
        $deliveryCode = "DEL-" . str_pad($delivery["delivery_id"], 4, "0", STR_PAD_LEFT);

        $notifications[] = [
            "type" => "Delivery",
            "title" => "Cancelled Delivery",
            "message" => $deliveryCode . " was cancelled. Delivery date: " . $delivery["delivery_date"] . ".",
            "priority" => "High"
        ];
    }

    $stmt = $conn->prepare("
        SELECT activity_name, guide_name, schedule_date
        FROM tbl_tourism
        WHERE DATE(schedule_date) = CURDATE()
        ORDER BY schedule_date ASC
    ");
    $stmt->execute();

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $activity) {
        $notifications[] = [
            "type" => "Tourism",
            "title" => "Tourism Activity Today",
            "message" => $activity["activity_name"] . " is scheduled today with guide " . ($activity["guide_name"] ?? "N/A") . ".",
            "priority" => "Medium"
        ];
    }

    $stmt = $conn->prepare("
        SELECT transaction_code, total_amount, transaction_date
        FROM tbl_pos
        ORDER BY transaction_date DESC
        LIMIT 5
    ");
    $stmt->execute();

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $sale) {
        $notifications[] = [
            "type" => "POS",
            "title" => "Recent Sale",
            "message" => $sale["transaction_code"] . " completed with ₱" . number_format((float)$sale["total_amount"], 2) . ".",
            "priority" => "Low"
        ];
    }

    echo json_encode([
        "success" => true,
        "count" => count($notifications),
        "notifications" => $notifications
    ]);
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "notifications" => []
    ]);
}

?>