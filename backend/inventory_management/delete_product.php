<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("inventory");
requireAnyRole(["Admin", "Staff"]);

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Only POST requests are allowed."
    ]);

    exit;
}

requireCsrfToken();

$data = json_decode(
    file_get_contents("php://input"),
    true
);

$productId = filter_var(
    $data["product_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$productId) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "A valid product ID is required."
    ]);

    exit;
}

try {
    $productStmt = $conn->prepare("
        SELECT
            product_id,
            status
        FROM tbl_inv
        WHERE product_id = :product_id
        LIMIT 1
    ");

    $productStmt->execute([
        ":product_id" => $productId
    ]);

    $product =
        $productStmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "Product record was not found."
        ]);

        exit;
    }

    if ($product["status"] === "Archived") {
        echo json_encode([
            "success" => true,
            "message" => "Product is already archived."
        ]);

        exit;
    }

    $stmt = $conn->prepare("
        UPDATE tbl_inv
        SET
            status = 'Archived',
            updated_at = NOW()
        WHERE product_id = :product_id
    ");

    $stmt->execute([
        ":product_id" => $productId
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Product archived successfully."
    ]);
} catch (Throwable $e) {
    http_response_code(500);

    error_log(
        "HiveSync delete_product.php: " .
        $e->getMessage()
    );

    echo json_encode([
        "success" => false,
        "message" => "Unable to archive the product."
    ]);
}
