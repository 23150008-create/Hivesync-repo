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

if (
    !tableExists(
        $conn,
        "tbl_receivable_payments"
    )
) {
    respond(
        false,
        "Receivables payment table is not installed.",
        [],
        500
    );
}

$receivableId = filter_input(
    INPUT_GET,
    "receivable_id",
    FILTER_VALIDATE_INT
);

$search = trim(
    (string)($_GET["search"] ?? "")
);

$dateFrom = trim(
    (string)($_GET["date_from"] ?? "")
);

$dateTo = trim(
    (string)($_GET["date_to"] ?? "")
);

$where = ["1 = 1"];
$params = [];

if ($receivableId) {
    $where[] =
        "rp.receivable_id =
         :receivable_id";

    $params[":receivable_id"] =
        $receivableId;
}

if ($search !== "") {
    $where[] = "(
        rp.payment_reference
            LIKE :search
        OR COALESCE(
            r.employee_name,
            r.customer_name
        ) LIKE :search
        OR COALESCE(
            r.office_name,
            ''
        ) LIKE :search
        OR COALESCE(
            p.transaction_code,
            r.source_reference,
            ''
        ) LIKE :search
        OR rp.received_by_name
            LIKE :search
    )";

    $params[":search"] =
        "%" . $search . "%";
}

if ($dateFrom !== "") {
    $where[] =
        "DATE(rp.payment_date) >=
         :date_from";

    $params[":date_from"] =
        $dateFrom;
}

if ($dateTo !== "") {
    $where[] =
        "DATE(rp.payment_date) <=
         :date_to";

    $params[":date_to"] =
        $dateTo;
}

try {
    $stmt = $conn->prepare("
        SELECT
            rp.payment_id,
            rp.receivable_id,
            rp.payment_reference,
            rp.amount_paid,
            rp.payment_method,
            rp.remarks,
            rp.received_by,
            rp.received_by_name,
            rp.payment_date,

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
            r.amount_paid AS receivable_total_paid,
            r.balance_amount,
            r.status,

            p.pos_id,
            COALESCE(
                p.transaction_code,
                r.source_reference
            ) AS transaction_code,
            p.transaction_date

        FROM tbl_receivable_payments rp

        INNER JOIN tbl_receivables r
            ON r.receivable_id =
               rp.receivable_id

        LEFT JOIN tbl_pos p
            ON p.pos_id = r.pos_id

        WHERE " .
        implode(" AND ", $where) .
        "

        ORDER BY
            rp.payment_date DESC,
            rp.payment_id DESC

        LIMIT 500
    ");

    $stmt->execute($params);

    $payments =
        $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );

    $summary = [
        "payment_count" =>
            count($payments),
        "total_collected" => 0.0
    ];

    foreach ($payments as $payment) {
        $summary["total_collected"] +=
            (float)(
                $payment["amount_paid"] ??
                0
            );
    }

    $summary["total_collected"] =
        round(
            $summary["total_collected"],
            2
        );

    respond(
        true,
        "Payment history loaded successfully.",
        [
            "payments" => $payments,
            "summary" => $summary
        ]
    );

} catch (Throwable $error) {
    respond(
        false,
        "Unable to load payment history.",
        [
            "error" =>
                $error->getMessage()
        ],
        500
    );
}