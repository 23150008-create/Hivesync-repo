<?php

declare(strict_types=1);

require_once("../config/cors.php");
require_once("../config/database.php");

function respond(
    bool $success,
    string $message,
    array $extra = [],
    int $statusCode = 200
): void {
    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "message" => $message
            ],
            $extra
        ),
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );

    exit;
}

function tableExists(
    PDO $conn,
    string $tableName
): bool {
    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
    ");

    $stmt->execute([
        ":table_name" => $tableName
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

$receivableId = filter_input(
    INPUT_GET,
    "receivable_id",
    FILTER_VALIDATE_INT
);

if (!$receivableId) {
    respond(
        false,
        "A valid receivable ID is required.",
        [],
        422
    );
}

if (
    !tableExists($conn, "tbl_receivables") ||
    !tableExists($conn, "tbl_receivable_payments")
) {
    respond(
        false,
        "Receivables tables are not installed.",
        [],
        500
    );
}

try {
    $stmt = $conn->prepare("
        SELECT
            r.receivable_id,
            r.pos_id,
            r.receivable_type,

            COALESCE(
                NULLIF(r.employee_name, ''),
                NULLIF(r.customer_name, ''),
                p.employee_name,
                p.customer_name,
                'Unknown Employee'
            ) AS employee_name,

            COALESCE(
                NULLIF(r.office_name, ''),
                p.office_name,
                'Not Specified'
            ) AS office_name,

            r.customer_name,

            p.transaction_code,
            p.transaction_date,
            p.subtotal_amount,
            p.discount,
            p.discount_percent,
            p.total_amount,
            p.transaction_status,
            p.payment_type,
            p.payment_method,
            p.payment_amount,

            r.original_amount,
            r.amount_paid,
            r.balance_amount,

            NULL AS due_date,

            r.status,
            r.notes,
            r.created_by,
            r.created_at,
            r.updated_at

        FROM tbl_receivables r

        INNER JOIN tbl_pos p
            ON p.pos_id = r.pos_id

        WHERE r.receivable_id =
            :receivable_id

        LIMIT 1
    ");

    $stmt->execute([
        ":receivable_id" => $receivableId
    ]);

    $receivable =
        $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$receivable) {
        respond(
            false,
            "Receivable record not found.",
            [],
            404
        );
    }

    $paymentsStmt = $conn->prepare("
        SELECT
            payment_id,
            payment_reference,
            amount_paid,
            payment_method,
            remarks,
            received_by,
            received_by_name,
            payment_date,
            created_at
        FROM tbl_receivable_payments
        WHERE receivable_id =
            :receivable_id
        ORDER BY
            payment_date DESC,
            payment_id DESC
    ");

    $paymentsStmt->execute([
        ":receivable_id" => $receivableId
    ]);

    $payments =
        $paymentsStmt->fetchAll(
            PDO::FETCH_ASSOC
        );

    $items = [];

    if (tableExists($conn, "tbl_pos_items")) {
        $productNameSelect =
            tableExists($conn, "tbl_inv")
                ? "i.product_name, i.sku"
                : "NULL AS product_name, NULL AS sku";

        $itemsStmt = $conn->prepare("
            SELECT
                pi.item_id,
                pi.product_id,
                {$productNameSelect},
                pi.quantity,
                pi.returned_quantity,
                pi.price,
                pi.subtotal,
                pi.refunded_amount,
                pi.item_status
            FROM tbl_pos_items pi
            " . (
                tableExists($conn, "tbl_inv")
                    ? "LEFT JOIN tbl_inv i
                       ON i.product_id =
                          pi.product_id"
                    : ""
            ) . "
            WHERE pi.pos_id = :pos_id
            ORDER BY pi.item_id ASC
        ");

        $itemsStmt->execute([
            ":pos_id" =>
                $receivable["pos_id"]
        ]);

        $items =
            $itemsStmt->fetchAll(
                PDO::FETCH_ASSOC
            );
    }

    $receivable["payments"] = $payments;
    $receivable["items"] = $items;

    respond(
        true,
        "Receivable details loaded successfully.",
        [
            "receivable" => $receivable,
            "payments" => $payments,
            "items" => $items
        ]
    );

} catch (Throwable $error) {
    respond(
        false,
        "Unable to load receivable details.",
        [
            "error" =>
                $error->getMessage()
        ],
        500
    );
}