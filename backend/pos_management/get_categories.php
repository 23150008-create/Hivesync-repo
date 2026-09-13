<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");

try {
    $stmt = $conn->prepare("
        SELECT category_id, category_name
        FROM tbl_category
        ORDER BY category_name ASC
    ");

    $stmt->execute();

    echo json_encode([
        "success" => true,
        "categories" => $stmt->fetchAll(PDO::FETCH_ASSOC)
    ]);
} catch (Exception $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Failed to load categories.",
        "error" => $e->getMessage(),
        "categories" => []
    ]);
}
