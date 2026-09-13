<?php

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("users");

function respond(
    bool $success,
    string $message,
    int $statusCode = 200
): void {
    http_response_code($statusCode);

    echo json_encode([
        "success" => $success,
        "message" => $message
    ]);

    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(false, "Invalid request method.", 405);
}

requireCsrfToken();

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    respond(false, "No user data was received.", 400);
}

$userId = filter_var(
    $data["user_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$userId) {
    respond(false, "A valid user ID is required.", 422);
}

$sessionUserId = (int)($_SESSION["user_id"] ?? 0);
$sessionRole = (string)($_SESSION["role"] ?? "");

if ($sessionUserId === (int)$userId) {
    respond(
        false,
        "You cannot deactivate your own logged-in account.",
        409
    );
}

try {
    $conn->beginTransaction();

    $userCheck = $conn->prepare("
        SELECT
            user_id,
            role,
            status,
            full_name
        FROM tbl_user
        WHERE user_id = :user_id
        LIMIT 1
        FOR UPDATE
    ");

    $userCheck->execute([
        ":user_id" => $userId
    ]);

    $targetUser = $userCheck->fetch(PDO::FETCH_ASSOC);

    if (!$targetUser) {
        $conn->rollBack();
        respond(false, "User record was not found.", 404);
    }

    $targetRole = (string)($targetUser["role"] ?? "");
    $targetStatus = (string)($targetUser["status"] ?? "");

    if (strcasecmp($targetStatus, "Inactive") === 0) {
        $conn->rollBack();
        respond(
            false,
            "This user account is already inactive.",
            409
        );
    }

    if ($targetRole === "Admin") {
        if ($sessionRole !== "Admin") {
            $conn->rollBack();
            respond(
                false,
                "Only the current Admin can deactivate an Admin account.",
                403
            );
        }

        $activeAdminCheck = $conn->prepare("
            SELECT COUNT(*)
            FROM tbl_user
            WHERE role = 'Admin'
            AND status = 'Active'
        ");

        $activeAdminCheck->execute();
        $activeAdminCount = (int)$activeAdminCheck->fetchColumn();

        if ($activeAdminCount <= 1) {
            $conn->rollBack();
            respond(
                false,
                "The only active Admin account cannot be deactivated. Transfer Admin access first.",
                409
            );
        }
    }

    $stmt = $conn->prepare("
        UPDATE tbl_user
        SET status = 'Inactive'
        WHERE user_id = :user_id
        AND status = 'Active'
    ");

    $stmt->execute([
        ":user_id" => $userId
    ]);

    if ($stmt->rowCount() !== 1) {
        throw new RuntimeException(
            "Unable to deactivate the user account."
        );
    }

    $conn->commit();

    respond(
        true,
        "User account deactivated successfully."
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "HiveSync deactivate user error: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to deactivate the user account.",
        500
    );
}
