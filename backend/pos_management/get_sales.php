<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");

try {
    $stmt = $conn->prepare("
        SELECT
            p.pos_id,
            p.pos_id AS sale_id,
            p.transaction_code,
            p.transaction_code AS sale_number,
            p.cashier_id,
            u.full_name AS cashier_name,
            p.total_amount,
            p.discount,
            p.payment_amount,
            p.payment_amount AS cash_amount,
            p.change_amount,
            p.transaction_date,
            p.transaction_date AS created_at
        FROM tbl_pos p
        LEFT JOIN tbl_user u ON p.cashier_id = u.user_id
        ORDER BY p.transaction_date DESC
    ");

    $stmt->execute();

    echo json_encode([
        "success" => true,
        "sales" => $stmt->fetchAll(PDO::FETCH_ASSOC)
    ]);
} catch (Exception $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Failed to load sales.",
        "error" => $e->getMessage(),
        "sales" => []
    ]);
}
