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

function columnExists(
    PDO $conn,
    string $tableName,
    string $columnName
): bool {
    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
        AND column_name = :column_name
    ");

    $stmt->execute([
        ":table_name" => $tableName,
        ":column_name" => $columnName
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "No delivery information was received."
    ]);

    exit;
}

$deliveryId = filter_var(
    $data["delivery_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$deliveryId) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "A valid delivery ID is required."
    ]);

    exit;
}

try {
    $conn->beginTransaction();

    $stmt = $conn->prepare("
        SELECT
            delivery_id,
            delivery_order_no,
            status
        FROM tbl_delivery
        WHERE delivery_id = :delivery_id
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    $delivery = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$delivery) {
        throw new Exception(
            "Delivery transaction was not found."
        );
    }

    if ($delivery["status"] === "Archived") {
        $conn->commit();

        echo json_encode([
            "success" => true,
            "message" => "Delivery is already archived."
        ]);

        exit;
    }

    if (
        !in_array(
            $delivery["status"],
            [
                "Delivered",
                "Cancelled"
            ],
            true
        )
    ) {
        throw new Exception(
            "Only Delivered or Cancelled transactions can be archived. Pending and In Transit records must be completed or cancelled first."
        );
    }

    $hasArchivedAtColumn = columnExists(
        $conn,
        "tbl_delivery",
        "archived_at"
    );

    $sql = $hasArchivedAtColumn
        ? "
            UPDATE tbl_delivery
            SET
                status = 'Archived',
                archived_at = NOW()
            WHERE delivery_id = :delivery_id
          "
        : "
            UPDATE tbl_delivery
            SET status = 'Archived'
            WHERE delivery_id = :delivery_id
          ";

    $archiveStmt = $conn->prepare($sql);

    $archiveStmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" =>
            "Delivery archived successfully. Inventory, supplier payable, product batches, receipts, and historical records were preserved."
    ]);
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
