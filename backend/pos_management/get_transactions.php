<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");

$search = trim(
    $_GET["search"] ?? ""
);

$status = trim(
    $_GET["status"] ?? "All"
);

$dateFrom = trim(
    $_GET["date_from"] ?? ""
);

$dateTo = trim(
    $_GET["date_to"] ?? ""
);

$page = filter_var(
    $_GET["page"] ?? 1,
    FILTER_VALIDATE_INT
);

$limit = filter_var(
    $_GET["limit"] ?? 15,
    FILTER_VALIDATE_INT
);

if (!$page || $page < 1) {
    $page = 1;
}

if (!$limit || $limit < 1) {
    $limit = 15;
}

$limit = min($limit, 100);

try {
    $conditions = [];
    $parameters = [];

    if ($search !== "") {
        $conditions[] = "
            (
                p.transaction_code LIKE :search_transaction_code
                OR p.customer_name LIKE :search_customer_name
                OR p.prepared_by LIKE :search_prepared_by
                OR u.full_name LIKE :search_cashier_name
            )
        ";

        $searchValue = "%" . $search . "%";

        $parameters[":search_transaction_code"] =
            $searchValue;
        $parameters[":search_customer_name"] =
            $searchValue;
        $parameters[":search_prepared_by"] =
            $searchValue;
        $parameters[":search_cashier_name"] =
            $searchValue;
    }

    if (
        $status !== "" &&
        $status !== "All"
    ) {
        $conditions[] =
            "p.transaction_status = :status";

        $parameters[":status"] = $status;
    }

    if ($dateFrom !== "") {
        $conditions[] =
            "p.transaction_date >= :date_from_start";

        $parameters[":date_from_start"] =
            $dateFrom . " 00:00:00";
    }

    if ($dateTo !== "") {
        $conditions[] =
            "p.transaction_date < :date_to_next_day";

        $dateToNextDay = date(
            "Y-m-d",
            strtotime($dateTo . " +1 day")
        );

        $parameters[":date_to_next_day"] =
            $dateToNextDay . " 00:00:00";
    }

    $whereClause =
        count($conditions) > 0
            ? "WHERE " . implode(
                " AND ",
                $conditions
            )
            : "";

    $countSql = "
        SELECT
            COUNT(*) AS total_records
        FROM tbl_pos p

        " . (
            $search !== ""
                ? "
                    LEFT JOIN tbl_user u
                        ON u.user_id = p.cashier_id
                  "
                : ""
        ) . "

        {$whereClause}
    ";

    $countStmt =
        $conn->prepare($countSql);

    $countStmt->execute($parameters);

    $totalRecords =
        (int)$countStmt->fetchColumn();

    $totalPages = max(
        1,
        (int)ceil(
            $totalRecords / $limit
        )
    );

    $page = min(
        $page,
        $totalPages
    );

    $offset =
        ($page - 1) * $limit;

    $sql = "
        SELECT
            p.pos_id,
            p.transaction_code,
            p.customer_name,
            p.prepared_by,
            p.received_by,
            p.cashier_id,

            COALESCE(
                u.full_name,
                p.prepared_by,
                'Unknown Cashier'
            ) AS cashier_name,

            p.subtotal_amount,
            p.discount,
            p.discount_percent,
            p.total_amount,
            p.payment_amount,
            p.change_amount,
            p.refunded_amount,

            GREATEST(
                p.total_amount -
                p.refunded_amount,
                0
            ) AS net_amount,

            p.transaction_status,
            p.void_reason,
            p.voided_at,
            p.transaction_date,

            COUNT(
                DISTINCT pi.item_id
            ) AS product_lines,

            COALESCE(
                SUM(pi.quantity),
                0
            ) AS total_items,

            COALESCE(
                SUM(pi.returned_quantity),
                0
            ) AS returned_items,

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
            END AS can_return

        FROM tbl_pos p

        LEFT JOIN tbl_user u
            ON u.user_id = p.cashier_id

        LEFT JOIN tbl_pos_items pi
            ON pi.pos_id = p.pos_id

        {$whereClause}

        GROUP BY
            p.pos_id,
            p.transaction_code,
            p.customer_name,
            p.prepared_by,
            p.received_by,
            p.cashier_id,
            u.full_name,
            p.subtotal_amount,
            p.discount,
            p.discount_percent,
            p.total_amount,
            p.payment_amount,
            p.change_amount,
            p.refunded_amount,
            p.transaction_status,
            p.void_reason,
            p.voided_at,
            p.transaction_date

        ORDER BY
            p.transaction_date DESC,
            p.pos_id DESC

        LIMIT {$limit}
        OFFSET {$offset}
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute($parameters);

    $transactions =
        $stmt->fetchAll(PDO::FETCH_ASSOC);

    $summaryStmt = $conn->prepare("
        SELECT
            COUNT(*) AS total_transactions,

            COALESCE(
                SUM(
                    CASE
                        WHEN transaction_status <> 'Voided'
                        THEN total_amount
                        ELSE 0
                    END
                ),
                0
            ) AS recorded_sales,

            COALESCE(
                SUM(refunded_amount),
                0
            ) AS total_refunded,

            COALESCE(
                SUM(
                    CASE
                        WHEN transaction_status = 'Voided'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS voided_transactions,

            COALESCE(
                SUM(
                    CASE
                        WHEN transaction_status <> 'Voided'
                        THEN GREATEST(
                            total_amount -
                            refunded_amount,
                            0
                        )
                        ELSE 0
                    END
                ),
                0
            ) AS net_sales

        FROM tbl_pos
    ");

    $summaryStmt->execute();

    $summary =
        $summaryStmt->fetch(PDO::FETCH_ASSOC);

    $from =
        $totalRecords > 0
            ? $offset + 1
            : 0;

    $to =
        $totalRecords > 0
            ? min(
                $offset +
                count($transactions),
                $totalRecords
            )
            : 0;

    echo json_encode([
        "success" => true,
        "transactions" => $transactions,
        "summary" => $summary,
        "pagination" => [
            "current_page" =>
                $page,
            "per_page" =>
                $limit,
            "total_records" =>
                $totalRecords,
            "total_pages" =>
                $totalPages,
            "from" =>
                $from,
            "to" =>
                $to,
            "has_previous" =>
                $page > 1,
            "has_next" =>
                $page < $totalPages
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to retrieve POS transactions.",
        "error" => $e->getMessage(),
        "transactions" => [],
        "pagination" => [
            "current_page" => 1,
            "per_page" => $limit,
            "total_records" => 0,
            "total_pages" => 1,
            "from" => 0,
            "to" => 0,
            "has_previous" => false,
            "has_next" => false
        ]
    ]);
}
