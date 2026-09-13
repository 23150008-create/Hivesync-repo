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
    string $table
): bool {
    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
    ");

    $stmt->execute([
        ":table_name" => $table
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

function columnExists(
    PDO $conn,
    string $table,
    string $column
): bool {
    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
        AND column_name = :column_name
    ");

    $stmt->execute([
        ":table_name" => $table,
        ":column_name" => $column
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

function generateReceivableReference(PDO $conn): string
{
    $prefix = "OR-" . date("ymd") . "-";

    $stmt = $conn->prepare("
        SELECT source_reference
        FROM tbl_receivables
        WHERE source_reference LIKE :pattern
        ORDER BY receivable_id DESC
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":pattern" => $prefix . "%"
    ]);

    $last = (string)($stmt->fetchColumn() ?: "");
    $next = 1;

    if (
        $last !== "" &&
        preg_match(
            "/^" .
            preg_quote($prefix, "/") .
            "(\d{4})$/",
            $last,
            $matches
        )
    ) {
        $next = ((int)$matches[1]) + 1;
    }

    return $prefix .
        str_pad(
            (string)$next,
            4,
            "0",
            STR_PAD_LEFT
        );
}

function insertAuditLog(
    PDO $conn,
    ?int $userId,
    string $userName,
    string $details
): void {
    if (!tableExists($conn, "tbl_audit_trail")) {
        return;
    }

    $values = [
        "user_id" => $userId,
        "user_name" => $userName,
        "module" => "Point of Sale",
        "action" => "Add Other Office Receivable",
        "details" => $details
    ];

    $columns = [];
    $marks = [];
    $params = [];

    foreach ($values as $column => $value) {
        if (!columnExists($conn, "tbl_audit_trail", $column)) {
            continue;
        }

        $columns[] = "`{$column}`";
        $marks[] = ":{$column}";
        $params[":{$column}"] = $value;
    }

    if (columnExists($conn, "tbl_audit_trail", "created_at")) {
        $columns[] = "`created_at`";
        $marks[] = "NOW()";
    }

    if (!$columns) {
        return;
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_audit_trail
        (" . implode(", ", $columns) . ")
        VALUES
        (" . implode(", ", $marks) . ")
    ");

    $stmt->execute($params);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(
        false,
        "Method not allowed.",
        [],
        405
    );
}

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    respond(
        false,
        "No receivable data was received.",
        [],
        422
    );
}

$employeeName = trim(
    (string)($data["employee_name"] ?? "")
);

$officeName = trim(
    (string)($data["office_name"] ?? "")
);

$amount = round(
    (float)($data["amount"] ?? 0),
    2
);

$remarks = trim(
    (string)($data["remarks"] ?? "")
);

$createdBy = filter_var(
    $data["created_by"] ?? null,
    FILTER_VALIDATE_INT
);

$createdByName = trim(
    (string)(
        $data["created_by_name"] ??
        "HiveSync User"
    )
);

if ($employeeName === "") {
    respond(
        false,
        "Employee name is required.",
        [],
        422
    );
}

if ($officeName === "") {
    respond(
        false,
        "Office or department is required.",
        [],
        422
    );
}

if ($amount <= 0) {
    respond(
        false,
        "Receivable amount must be greater than zero.",
        [],
        422
    );
}

if (!tableExists($conn, "tbl_receivables")) {
    respond(
        false,
        "Receivables table is not installed.",
        [],
        500
    );
}

foreach (
    [
        "source_type",
        "source_reference",
        "employee_name",
        "office_name"
    ] as $requiredColumn
) {
    if (
        !columnExists(
            $conn,
            "tbl_receivables",
            $requiredColumn
        )
    ) {
        respond(
            false,
            "Run receivables_other_offices_migration.sql first.",
            [
                "missing_column" =>
                    $requiredColumn
            ],
            500
        );
    }
}

try {
    $conn->beginTransaction();

    $sourceReference =
        generateReceivableReference($conn);

    $stmt = $conn->prepare("
        INSERT INTO tbl_receivables
        (
            pos_id,
            source_type,
            source_reference,
            receivable_type,
            employee_name,
            office_name,
            customer_name,
            original_amount,
            amount_paid,
            balance_amount,
            due_date,
            status,
            notes,
            created_by,
            created_at,
            updated_at
        )
        VALUES
        (
            NULL,
            'Other Office',
            :source_reference,
            'Employee',
            :employee_name,
            :office_name,
            :customer_name,
            :original_amount,
            0.00,
            :balance_amount,
            NULL,
            'Unpaid',
            :notes,
            :created_by,
            NOW(),
            NOW()
        )
    ");

    $stmt->execute([
        ":source_reference" =>
            $sourceReference,
        ":employee_name" =>
            $employeeName,
        ":office_name" =>
            $officeName,
        ":customer_name" =>
            $employeeName,
        ":original_amount" =>
            $amount,
        ":balance_amount" =>
            $amount,
        ":notes" =>
            $remarks !== ""
                ? $remarks
                : null,
        ":created_by" =>
            $createdBy ?: null
    ]);

    $receivableId =
        (int)$conn->lastInsertId();

    $conn->commit();

    insertAuditLog(
        $conn,
        $createdBy ?: null,
        $createdByName !== ""
            ? $createdByName
            : "HiveSync User",
        "Created {$sourceReference} for employee {$employeeName}, office {$officeName}, amount ₱" .
        number_format($amount, 2) .
        "."
    );

    respond(
        true,
        "Other office receivable created successfully.",
        [
            "receivable_id" =>
                $receivableId,
            "source_reference" =>
                $sourceReference,
            "source_type" =>
                "Other Office",
            "employee_name" =>
                $employeeName,
            "office_name" =>
                $officeName,
            "original_amount" =>
                $amount,
            "amount_paid" =>
                0.00,
            "balance_amount" =>
                $amount,
            "status" =>
                "Unpaid"
        ],
        201
    );

} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    respond(
        false,
        $error->getMessage(),
        [],
        422
    );
}