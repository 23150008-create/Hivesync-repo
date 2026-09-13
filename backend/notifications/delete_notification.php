<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

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
    $stmt->execute([":table" => $table]);

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
        ["user_id", "recipient_user_id"]
    );
}

function notificationBelongsToUser(
    PDO $conn,
    int $notificationId,
    ?int $userId,
    string $role
): bool {
    $ownerColumn = notificationOwnerColumn($conn);

    if (!$ownerColumn) {
        return true;
    }

    if (!$userId) {
        return false;
    }

    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM tbl_notifications
        WHERE notification_id = :notification_id
        AND (
            `{$ownerColumn}` = :user_id
            OR `{$ownerColumn}` IS NULL
        )
    ");

    $stmt->execute([
        ":notification_id" => $notificationId,
        ":user_id" => $userId
    ]);

    return (int)$stmt->fetchColumn() > 0;
}


if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(false, "Only POST requests are allowed.", [], 405);
}

$data = json_decode(file_get_contents("php://input"), true);

$notificationId = filter_var(
    $data["notification_id"] ?? null,
    FILTER_VALIDATE_INT
);

$userId = filter_var(
    $data["user_id"] ?? null,
    FILTER_VALIDATE_INT
);

$role = trim((string)($data["role"] ?? ""));

if (!$notificationId) {
    respond(false, "A valid notification ID is required.", [], 422);
}

if (in_array($role, ["Supplier", "Vendor"], true)) {
    respond(
        false,
        "Supplier notifications cannot be removed.",
        [],
        403
    );
}

try {
    if (
        !notificationBelongsToUser(
            $conn,
            $notificationId,
            $userId ?: null,
            $role
        )
    ) {
        respond(false, "Notification was not found.", [], 404);
    }

    $stmt = $conn->prepare("
        DELETE FROM tbl_notifications
        WHERE notification_id = :notification_id
    ");
    $stmt->execute([
        ":notification_id" => $notificationId
    ]);

    respond(
        true,
        "Notification removed successfully."
    );
} catch (Throwable $error) {
    respond(
        false,
        "Unable to remove the notification.",
        ["error" => $error->getMessage()],
        500
    );
}