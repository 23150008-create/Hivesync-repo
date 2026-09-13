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

if (!is_array($data)) {
    respond(
        false,
        "No notification information was received.",
        [],
        422
    );
}

$title = trim((string)($data["title"] ?? ""));
$message = trim((string)($data["message"] ?? ""));
$type = trim((string)($data["type"] ?? "System"));
$module = trim((string)($data["module"] ?? ""));
$details = trim((string)($data["details"] ?? ""));
$referenceId = $data["reference_id"] ?? null;
$referenceCode = trim(
    (string)($data["reference_code"] ?? "")
);
$userId = filter_var(
    $data["user_id"] ??
    $data["recipient_user_id"] ??
    null,
    FILTER_VALIDATE_INT
);

$allowedTypes = [
    "Inventory",
    "Expiration",
    "Pullout",
    "Pull-out",
    "Disposal",
    "Delivery",
    "POS",
    "Sale",
    "Return",
    "User",
    "Supplier",
    "Vendor",
    "Payment",
    "Remittance",
    "Receivable",
    "Receivables",
    "Consignment",
    "Report",
    "Audit",
    "System"
];

if (!in_array($type, $allowedTypes, true)) {
    $type = "System";
}

if ($title === "" || $message === "") {
    respond(
        false,
        "Notification title and message are required.",
        [],
        422
    );
}

try {
    $mapping = [
        "user_id" => ["user_id", "recipient_user_id"],
        "title" => ["title"],
        "message" => ["message"],
        "type" => ["type"],
        "module" => ["module"],
        "reference_id" => ["reference_id"],
        "reference_code" => ["reference_code"],
        "details" => ["details"],
        "is_read" => ["is_read"]
    ];

    $values = [
        "user_id" => $userId ?: null,
        "title" => $title,
        "message" => $message,
        "type" => $type,
        "module" => $module !== "" ? $module : null,
        "reference_id" =>
            $referenceId === "" ? null : $referenceId,
        "reference_code" =>
            $referenceCode !== "" ? $referenceCode : null,
        "details" => $details !== "" ? $details : null,
        "is_read" => 0
    ];

    $columns = [];
    $placeholders = [];
    $params = [];

    foreach ($mapping as $key => $candidates) {
        $column = firstColumn(
            $conn,
            "tbl_notifications",
            $candidates
        );

        if (!$column) {
            continue;
        }

        $placeholder = ":{$key}";
        $columns[] = "`{$column}`";
        $placeholders[] = $placeholder;
        $params[$placeholder] = $values[$key];
    }

    if (columnExists($conn, "tbl_notifications", "created_at")) {
        $columns[] = "`created_at`";
        $placeholders[] = "NOW()";
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_notifications
        (" . implode(", ", $columns) . ")
        VALUES
        (" . implode(", ", $placeholders) . ")
    ");

    $stmt->execute($params);

    respond(
        true,
        "Notification created successfully.",
        [
            "notification_id" =>
                (int)$conn->lastInsertId()
        ],
        201
    );
} catch (Throwable $error) {
    respond(
        false,
        "Unable to create the notification.",
        ["error" => $error->getMessage()],
        500
    );
}