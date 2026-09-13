<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");

$posId = filter_var(
    $_GET["pos_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$posId) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" =>
            "A valid transaction ID is required."
    ]);

    exit;
}

try {
    $transactionStmt = $conn->prepare("
        SELECT
            p.*,

            COALESCE(
                u.full_name,
                p.prepared_by,
                'Unknown Cashier'
            ) AS cashier_name,

            COALESCE(
                void_user.full_name,
                ''
            ) AS voided_by_name,

            CASE
                WHEN DATEDIFF(
                    CURDATE(),
                    DATE(p.transaction_date)
                ) <= 5
                AND p.transaction_status IN (
                    'Completed',
                    'Partially Returned'
                )
                THEN 1
                ELSE 0
            END AS can_return,

            DATEDIFF(
                CURDATE(),
                DATE(p.transaction_date)
            ) AS transaction_age_days

        FROM tbl_pos p

        LEFT JOIN tbl_user u
            ON u.user_id = p.cashier_id

        LEFT JOIN tbl_user void_user
            ON void_user.user_id =
               p.voided_by

        WHERE p.pos_id = :pos_id
        LIMIT 1
    ");

    $transactionStmt->execute([
        ":pos_id" => $posId
    ]);

    $transaction =
        $transactionStmt->fetch(PDO::FETCH_ASSOC);

    if (!$transaction) {
        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" =>
                "Transaction record was not found."
        ]);

        exit;
    }

    $itemsStmt = $conn->prepare("
        SELECT
            pi.item_id,
            pi.pos_id,
            pi.product_id,
            i.product_name,
            i.sku,
            i.product_image,
            i.unit_type,
            i.unit,
            pi.quantity,
            pi.returned_quantity,

            GREATEST(
                pi.quantity -
                pi.returned_quantity,
                0
            ) AS returnable_quantity,

            pi.price,
            pi.subtotal,
            pi.refunded_amount,
            pi.item_status

        FROM tbl_pos_items pi

        INNER JOIN tbl_inv i
            ON i.product_id = pi.product_id

        WHERE pi.pos_id = :pos_id

        ORDER BY pi.item_id ASC
    ");

    $itemsStmt->execute([
        ":pos_id" => $posId
    ]);

    $items =
        $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

    $returnsStmt = $conn->prepare("
        SELECT
            r.return_id,
            r.return_number,
            r.return_type,
            r.return_reason,
            r.refund_amount,
            r.processed_by,
            r.processed_by_name,
            r.return_date
        FROM tbl_pos_returns r
        WHERE r.pos_id = :pos_id
        ORDER BY r.return_date DESC
    ");

    $returnsStmt->execute([
        ":pos_id" => $posId
    ]);

    $returns =
        $returnsStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($returns) > 0) {
        $returnIds = array_values(
            array_filter(
                array_map(
                    static fn(array $returnRecord): int =>
                        (int)($returnRecord["return_id"] ?? 0),
                    $returns
                ),
                static fn(int $returnId): bool =>
                    $returnId > 0
            )
        );

        if (count($returnIds) > 0) {
            $placeholders = implode(
                ", ",
                array_fill(
                    0,
                    count($returnIds),
                    "?"
                )
            );

            $returnItemsStmt = $conn->prepare("
                SELECT
                    return_id,
                    return_item_id,
                    pos_item_id,
                    product_id,
                    product_name,
                    quantity_returned,
                    unit_price,
                    refund_amount,
                    created_at
                FROM tbl_pos_return_items
                WHERE return_id IN ({$placeholders})
                ORDER BY
                    return_id ASC,
                    return_item_id ASC
            ");

            $returnItemsStmt->execute(
                $returnIds
            );

            $returnItemsByReturnId = [];

            foreach (
                $returnItemsStmt->fetchAll(PDO::FETCH_ASSOC)
                as $returnItem
            ) {
                $returnId =
                    (int)($returnItem["return_id"] ?? 0);

                $returnItemsByReturnId[$returnId][] =
                    $returnItem;
            }

            foreach ($returns as &$returnRecord) {
                $returnId =
                    (int)($returnRecord["return_id"] ?? 0);

                $returnRecord["items"] =
                    $returnItemsByReturnId[$returnId] ?? [];
            }

            unset($returnRecord);
        }
    }

    echo json_encode([
        "success" => true,
        "transaction" => $transaction,
        "items" => $items,
        "returns" => $returns
    ]);
} catch (Exception $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to retrieve transaction details.",
        "error" => $e->getMessage()
    ]);
}
