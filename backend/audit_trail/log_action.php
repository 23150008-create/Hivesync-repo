<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");

function tableExists(PDO $conn, string $tableName): bool
{
    static $cache = [];

    $cacheKey = strtolower(trim($tableName));

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
    ");

    $stmt->execute([
        ":table_name" => $tableName
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function columnExists(
    PDO $conn,
    string $tableName,
    string $columnName
): bool {
    static $cache = [];

    $cacheKey =
        strtolower(trim($tableName)) .
        "." .
        strtolower(trim($columnName));

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
        AND column_name = :column_name
    ");

    $stmt->execute([
        ":table_name" => $tableName,
        ":column_name" => $columnName
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

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

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(
        false,
        "Only POST requests are allowed.",
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
        "No audit information was received.",
        [],
        422
    );
}

if (!tableExists($conn, "tbl_audit_trail")) {
    respond(
        false,
        "Audit trail table is unavailable.",
        [],
        500
    );
}

$userId = filter_var(
    $data["user_id"] ?? null,
    FILTER_VALIDATE_INT
);

$userName = trim(
    (string)($data["user_name"] ?? "")
);

$module = trim(
    (string)($data["module"] ?? "")
);

$action = trim(
    (string)($data["action"] ?? "")
);

$details = trim(
    (string)($data["details"] ?? "")
);

if ($userName === "") {
    $userName = "Unknown User";
}

if ($module === "" || $action === "") {
    respond(
        false,
        "Module and action are required.",
        [],
        422
    );
}

try {
    $columns = [];
    $values = [];
    $parameters = [];

    $auditData = [
        "user_id" => $userId ?: null,
        "user_name" => $userName,
        "module" => $module,
        "action" => $action,
        "details" =>
            $details !== ""
                ? $details
                : null
    ];

    foreach ($auditData as $column => $value) {
        if (!columnExists(
            $conn,
            "tbl_audit_trail",
            $column
        )) {
            continue;
        }

        $columns[] = "`{$column}`";
        $values[] = ":{$column}";
        $parameters[":{$column}"] = $value;
    }

    if (
        columnExists(
            $conn,
            "tbl_audit_trail",
            "created_at"
        )
    ) {
        $columns[] = "`created_at`";
        $values[] = "NOW()";
    }

    if (count($columns) === 0) {
        respond(
            false,
            "No compatible audit trail columns were found.",
            [],
            500
        );
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_audit_trail
        (" . implode(", ", $columns) . ")
        VALUES
        (" . implode(", ", $values) . ")
    ");

    $stmt->execute($parameters);

    respond(
        true,
        "Audit action recorded.",
        [
            "audit_id" =>
                (int)$conn->lastInsertId()
        ]
    );
} catch (Throwable $error) {
    error_log(
        "audit_trail/log_action.php: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to record the audit action.",
        [
            "error" => $error->getMessage()
        ],
        500
    );
}