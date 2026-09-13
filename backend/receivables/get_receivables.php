<?php

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
        )
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

if (!tableExists($conn, "tbl_receivables")) {
    respond(
        false,
        "Receivables tables are not installed.",
        [],
        500
    );
}

$search = trim($_GET["search"] ?? "");
$status = trim($_GET["status"] ?? "All");
$dateFrom = trim($_GET["date_from"] ?? "");
$dateTo = trim($_GET["date_to"] ?? "");
$limit = max(
    1,
    min(
        500,
        (int)($_GET["limit"] ?? 200)
    )
);

$where = ["1 = 1"];
$params = [];

if ($search !== "") {
    $where[] = "(
        COALESCE(r.employee_name, r.customer_name) LIKE :search
        OR COALESCE(r.office_name, '') LIKE :search
        OR COALESCE(p.transaction_code, '') LIKE :search
        OR COALESCE(r.source_reference, '') LIKE :search
        OR CAST(r.receivable_id AS CHAR) LIKE :search
    )";
    $params[":search"] = "%" . $search . "%";
}

$allowedStatuses = [
    "Unpaid",
    "Partially Paid",
    "Paid",
    "Cancelled"
];

if (
    $status !== "All" &&
    in_array(
        $status,
        $allowedStatuses,
        true
    )
) {
    $where[] = "r.status = :status";
    $params[":status"] = $status;
}

if ($dateFrom !== "") {
    $where[] =
        "DATE(r.created_at) >= :date_from";
    $params[":date_from"] = $dateFrom;
}

if ($dateTo !== "") {
    $where[] =
        "DATE(r.created_at) <= :date_to";
    $params[":date_to"] = $dateTo;
}

try {
    /*
     * PANEL REQUIREMENT:
     * New employee receivables have no due date / term.
     * Historical rows are preserved, but this endpoint does not
     * classify accounts as Overdue anymore.
     */
    $conn->exec("
        UPDATE tbl_receivables
        SET status = CASE
            WHEN balance_amount <= 0
                THEN 'Paid'
            WHEN amount_paid > 0
                THEN 'Partially Paid'
            ELSE 'Unpaid'
        END
        WHERE status <> 'Cancelled'
    ");

    $sql = "
        SELECT
            r.receivable_id,
            r.pos_id,
            COALESCE(
                p.transaction_code,
                r.source_reference
            ) AS transaction_code,

            p.transaction_date,

            r.source_type,
            r.source_reference,
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

        LEFT JOIN tbl_pos p
            ON p.pos_id = r.pos_id

        WHERE " .
        implode(" AND ", $where) .
        "

        ORDER BY
            CASE r.status
                WHEN 'Unpaid' THEN 1
                WHEN 'Partially Paid' THEN 2
                WHEN 'Paid' THEN 3
                ELSE 4
            END,
            r.receivable_id DESC

        LIMIT {$limit}
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);

    $receivables =
        $stmt->fetchAll(PDO::FETCH_ASSOC);

    $summaryStmt = $conn->query("
        SELECT
            COUNT(*) AS total_accounts,
            COALESCE(
                SUM(original_amount),
                0
            ) AS original_total,
            COALESCE(
                SUM(amount_paid),
                0
            ) AS collected_total,
            COALESCE(
                SUM(balance_amount),
                0
            ) AS outstanding_total,
            SUM(status = 'Unpaid')
                AS unpaid_accounts,
            SUM(status = 'Partially Paid')
                AS partial_accounts,
            SUM(status = 'Paid')
                AS paid_accounts
        FROM tbl_receivables
        WHERE status <> 'Cancelled'
    ");

    $summary =
        $summaryStmt->fetch(PDO::FETCH_ASSOC);

    $todayStmt = $conn->query("
        SELECT
            COALESCE(
                SUM(amount_paid),
                0
            ) AS collected_today
        FROM tbl_receivable_payments
        WHERE DATE(payment_date) = CURDATE()
    ");

    $today =
        $todayStmt->fetch(PDO::FETCH_ASSOC);

    respond(
        true,
        "Receivables loaded successfully.",
        [
            "receivables" => $receivables,
            "summary" => [
                "total_accounts" =>
                    (int)(
                        $summary[
                            "total_accounts"
                        ] ?? 0
                    ),
                "original_total" =>
                    (float)(
                        $summary[
                            "original_total"
                        ] ?? 0
                    ),
                "collected_total" =>
                    (float)(
                        $summary[
                            "collected_total"
                        ] ?? 0
                    ),
                "outstanding_total" =>
                    (float)(
                        $summary[
                            "outstanding_total"
                        ] ?? 0
                    ),
                "unpaid_accounts" =>
                    (int)(
                        $summary[
                            "unpaid_accounts"
                        ] ?? 0
                    ),
                "partial_accounts" =>
                    (int)(
                        $summary[
                            "partial_accounts"
                        ] ?? 0
                    ),
                "paid_accounts" =>
                    (int)(
                        $summary[
                            "paid_accounts"
                        ] ?? 0
                    ),
                "overdue_accounts" => 0,
                "collected_today" =>
                    (float)(
                        $today[
                            "collected_today"
                        ] ?? 0
                    )
            ]
        ]
    );
} catch (Throwable $error) {
    respond(
        false,
        "Unable to load receivables.",
        [
            "error" =>
                $error->getMessage()
        ],
        500
    );
}