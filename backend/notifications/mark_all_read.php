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

function tableExists(PDO $conn, string $table): bool
{
    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = :table
    ");

    $stmt->execute([
        ":table" => $table
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
        AND table_name = :table
        AND column_name = :column
    ");

    $stmt->execute([
        ":table" => $table,
        ":column" => $column
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

function firstColumn(
    PDO $conn,
    string $table,
    array $candidates
): ?string {
    foreach ($candidates as $column) {
        if (columnExists($conn, $table, $column)) {
            return $column;
        }
    }

    return null;
}

function notificationOwnerColumn(PDO $conn): ?string
{
    return firstColumn(
        $conn,
        "tbl_notifications",
        [
            "user_id",
            "recipient_user_id"
        ]
    );
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
        "Invalid JSON request.",
        [],
        400
    );
}

$userId = filter_var(
    $data["user_id"] ?? null,
    FILTER_VALIDATE_INT
);

$role = trim(
    (string)(
        $data["role"] ?? ""
    )
);

$ownerColumn =
    notificationOwnerColumn($conn);

try {
    $where = "is_read = 0";
    $params = [];

    if ($ownerColumn && $userId) {
        $where .= "
            AND (
                `{$ownerColumn}` = :user_id
                OR `{$ownerColumn}` IS NULL
            )
        ";

        $params[":user_id"] =
            $userId;
    } elseif ($ownerColumn) {
        $where .= "
            AND `{$ownerColumn}` IS NULL
        ";
    }

    $stmt = $conn->prepare("
        UPDATE tbl_notifications
        SET is_read = 1
        WHERE {$where}
    ");

    $stmt->execute($params);

    respond(
        true,
        "All visible notifications marked as read.",
        [
            "updated_count" =>
                $stmt->rowCount(),

            "role" =>
                $role
        ]
    );
} catch (Throwable $error) {
    respond(
        false,
        "Unable to update notifications.",
        [
            "error" =>
                $error->getMessage()
        ],
        500
    );
}