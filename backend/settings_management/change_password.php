<?php

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireAuthentication(true);
requireCsrfToken();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Invalid request method."
    ]);

    exit;
}

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "No password data was received."
    ]);

    exit;
}

$currentPassword = (string)($data["current_password"] ?? "");
$newPassword = (string)($data["new_password"] ?? "");
$confirmPassword = (string)($data["confirm_password"] ?? "");

if (
    $currentPassword === "" ||
    $newPassword === "" ||
    $confirmPassword === ""
) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "Please complete all password fields."
    ]);

    exit;
}

if ($newPassword !== $confirmPassword) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "New password and confirm password do not match."
    ]);

    exit;
}

if ($newPassword === $currentPassword) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "New password must be different from the current password."
    ]);

    exit;
}

if ($newPassword === "HiveSync@123") {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "Please choose a password different from the default password."
    ]);

    exit;
}

if (
    strlen($newPassword) < 8 ||
    !preg_match("/[A-Z]/", $newPassword) ||
    !preg_match("/[a-z]/", $newPassword) ||
    !preg_match("/[0-9]/", $newPassword) ||
    !preg_match("/[^A-Za-z0-9]/", $newPassword)
) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "New password must be at least 8 characters and contain uppercase, lowercase, number, and special character."
    ]);

    exit;
}

$userId = (int)($_SESSION["user_id"] ?? 0);

if ($userId <= 0) {
    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Authentication required."
    ]);

    exit;
}

try {
    $stmt = $conn->prepare("
        SELECT password
        FROM tbl_user
        WHERE user_id = :user_id
        AND status = 'Active'
        LIMIT 1
    ");

    $stmt->execute([
        ":user_id" => $userId
    ]);

    $storedPassword = $stmt->fetchColumn();

    if ($storedPassword === false) {
        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User account was not found."
        ]);

        exit;
    }

    if (!password_verify($currentPassword, (string)$storedPassword)) {
        http_response_code(422);

        echo json_encode([
            "success" => false,
            "message" => "Current password is incorrect."
        ]);

        exit;
    }

    $hashedPassword = password_hash(
        $newPassword,
        PASSWORD_DEFAULT
    );

    if ($hashedPassword === false) {
        throw new RuntimeException("Unable to hash the new password.");
    }

    $update = $conn->prepare("
        UPDATE tbl_user
        SET password = :password,
            must_change_password = 0
        WHERE user_id = :user_id
        AND status = 'Active'
    ");

    $update->execute([
        ":password" => $hashedPassword,
        ":user_id" => $userId
    ]);

    if ($update->rowCount() !== 1) {
        throw new RuntimeException("Password update did not modify the expected user.");
    }

    $_SESSION["must_change_password"] = 0;

    authDestroySession();

    echo json_encode([
        "success" => true,
        "message" => "Password updated successfully. Please sign in again using your new password."
    ]);
} catch (Throwable $error) {
    error_log(
        "HiveSync change password error for user {$userId}: " .
        $error->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to update the password."
    ]);
}
