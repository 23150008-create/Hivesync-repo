<?php

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Only POST requests are allowed."
    ]);
    exit;
}

requireModulePermission("deliveries");
requireAnyRole(["Admin", "Staff"]);
requireCsrfToken();

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || empty($data["delivery_id"])) {
    echo json_encode(["success" => false, "message" => "Delivery ID is required"]);
    exit;
}

function updateInventoryFromDeliveryItem($conn, $item, $delivery_id) {
    $product_id = $item["product_id"];
    $quantity = (int)$item["quantity"];
    $supplier_price = (float)$item["supplier_price"];
    $retail_price = (float)$item["retail_price"];
    $expiry_date = !empty($item["expiry_date"]) ? $item["expiry_date"] : null;
    $vendor_id = !empty($item["vendor_id"]) ? $item["vendor_id"] : null;

    $is_consignment = !empty($item["is_consignment"]) ? 1 : 0;
    $consignment_terms = trim($item["consignment_terms"] ?? "");
    $consignment_start_date = !empty($item["consignment_start_date"]) ? $item["consignment_start_date"] : null;
    $consignment_pullout_date = !empty($item["consignment_pullout_date"]) ? $item["consignment_pullout_date"] : null;
    $consignment_notes = trim($item["consignment_notes"] ?? "");

    $batchCheck = $conn->prepare("
        SELECT batch_id
        FROM tbl_inventory_batches
        WHERE product_id = :product_id
        AND (
            expiry_date = :expiry_date
            OR (expiry_date IS NULL AND :expiry_date IS NULL)
        )
        LIMIT 1
    ");

    $batchCheck->execute([
        ":product_id" => $product_id,
        ":expiry_date" => $expiry_date
    ]);

    $batch = $batchCheck->fetch(PDO::FETCH_ASSOC);

    if ($batch) {
        $batchUpdate = $conn->prepare("
            UPDATE tbl_inventory_batches
            SET quantity = quantity + :quantity
            WHERE batch_id = :batch_id
        ");

        $batchUpdate->execute([
            ":quantity" => $quantity,
            ":batch_id" => $batch["batch_id"]
        ]);
    } else {
        $batchInsert = $conn->prepare("
            INSERT INTO tbl_inventory_batches
            (product_id, quantity, expiry_date, supplier_price, delivery_id, created_at)
            VALUES
            (:product_id, :quantity, :expiry_date, :supplier_price, :delivery_id, NOW())
        ");

        $batchInsert->execute([
            ":product_id" => $product_id,
            ":quantity" => $quantity,
            ":expiry_date" => $expiry_date,
            ":supplier_price" => $supplier_price,
            ":delivery_id" => $delivery_id
        ]);
    }

    $invUpdate = $conn->prepare("
        UPDATE tbl_inv
        SET
            quantity = quantity + :quantity,
            supplier_price = :supplier_price,
            selling_price = :selling_price,
            expiry_date = COALESCE(:expiry_date, expiry_date),
            vendor_id = COALESCE(:vendor_id, vendor_id),
            is_consignment = :is_consignment,
            consignment_terms = :consignment_terms,
            consignment_start_date = :consignment_start_date,
            consignment_pullout_date = :consignment_pullout_date,
            consignment_notes = :consignment_notes,
            status = CASE
                WHEN quantity + :quantity_status <= 0 THEN 'Out of Stock'
                WHEN quantity + :quantity_status <= reorder_level THEN 'Low Stock'
                ELSE 'In Stock'
            END,
            updated_at = NOW()
        WHERE product_id = :product_id
    ");

    $invUpdate->execute([
        ":quantity" => $quantity,
        ":quantity_status" => $quantity,
        ":supplier_price" => $supplier_price,
        ":selling_price" => $retail_price,
        ":expiry_date" => $expiry_date,
        ":vendor_id" => $vendor_id,
        ":is_consignment" => $is_consignment,
        ":consignment_terms" => $consignment_terms,
        ":consignment_start_date" => $consignment_start_date,
        ":consignment_pullout_date" => $consignment_pullout_date,
        ":consignment_notes" => $consignment_notes,
        ":product_id" => $product_id
    ]);
}

try {
    $conn->beginTransaction();

    $delivery_id = $data["delivery_id"];
    $status = $data["status"] ?? "Pending";
    $remarks = trim($data["remarks"] ?? "");
    $received_by = trim($data["received_by"] ?? "");
    $noted_by = trim($data["noted_by"] ?? "");

    $oldStmt = $conn->prepare("
        SELECT status
        FROM tbl_delivery
        WHERE delivery_id = :delivery_id
        LIMIT 1
    ");

    $oldStmt->execute([":delivery_id" => $delivery_id]);
    $oldDelivery = $oldStmt->fetch(PDO::FETCH_ASSOC);

    if (!$oldDelivery) {
        throw new Exception("Delivery not found");
    }

    $stmt = $conn->prepare("
        UPDATE tbl_delivery
        SET
            status = :status,
            remarks = COALESCE(NULLIF(:remarks, ''), remarks),
            received_by = COALESCE(NULLIF(:received_by, ''), received_by),
            noted_by = COALESCE(NULLIF(:noted_by, ''), noted_by)
        WHERE delivery_id = :delivery_id
    ");

    $stmt->execute([
        ":status" => $status,
        ":remarks" => $remarks,
        ":received_by" => $received_by,
        ":noted_by" => $noted_by,
        ":delivery_id" => $delivery_id
    ]);

    if ($oldDelivery["status"] !== "Delivered" && $status === "Delivered") {
        $itemsStmt = $conn->prepare("
            SELECT
                product_id,
                vendor_id,
                quantity,
                supplier_price,
                retail_price,
                expiry_date,
                is_consignment,
                consignment_terms,
                consignment_start_date,
                consignment_pullout_date,
                consignment_notes
            FROM tbl_delivery_items
            WHERE delivery_id = :delivery_id
        ");

        $itemsStmt->execute([":delivery_id" => $delivery_id]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as $item) {
            updateInventoryFromDeliveryItem($conn, $item, $delivery_id);
        }
    }

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" => "Delivery updated successfully"
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
