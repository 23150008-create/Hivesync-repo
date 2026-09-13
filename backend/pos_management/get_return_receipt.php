<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");

$returnId = filter_var(
    $_GET["return_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$returnId) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" =>
            "A valid return ID is required."
    ]);

    exit;
}

try {
    $returnStmt = $conn->prepare("
        SELECT
            r.return_id,
            r.return_number,
            r.pos_id,
            r.transaction_code,
            r.return_type,
            r.return_reason,
            r.refund_amount,
            r.processed_by,
            r.processed_by_name,
            r.return_date,

            p.customer_name,
            p.company_address,
            p.prepared_by,
            p.received_by,
            p.transaction_date,

            COALESCE(
                u.full_name,
                r.processed_by_name,
                'Unknown User'
            ) AS processor_name

        FROM tbl_pos_returns r

        INNER JOIN tbl_pos p
            ON p.pos_id = r.pos_id

        LEFT JOIN tbl_user u
            ON u.user_id = r.processed_by

        WHERE r.return_id = :return_id
        LIMIT 1
    ");

    $returnStmt->execute([
        ":return_id" => $returnId
    ]);

    $returnRecord =
        $returnStmt->fetch(PDO::FETCH_ASSOC);

    if (!$returnRecord) {
        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" =>
                "Return receipt was not found."
        ]);

        exit;
    }

    $itemsStmt = $conn->prepare("
        SELECT
            return_item_id,
            return_id,
            pos_item_id,
            product_id,
            product_name,
            quantity_returned,
            unit_price,
            refund_amount,
            created_at
        FROM tbl_pos_return_items
        WHERE return_id = :return_id
        ORDER BY return_item_id ASC
    ");

    $itemsStmt->execute([
        ":return_id" => $returnId
    ]);

    $items =
        $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

    $returnRecord["items"] = $items;

    echo json_encode([
        "success" => true,
        "return_receipt" => $returnRecord,
        "return" => $returnRecord,
        "items" => $items
    ]);
} catch (Exception $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to retrieve the return receipt.",
        "error" => $e->getMessage()
    ]);
}
