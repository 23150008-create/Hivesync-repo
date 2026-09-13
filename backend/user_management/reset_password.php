<?php

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../config/mailer.php");
require_once("../auth/auth_guard.php");

requireModulePermission("users");

function generateTemporaryPassword(): string {
    $upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    $lower = "abcdefghijkmnopqrstuvwxyz";
    $digits = "23456789";
    $special = "!@#$%&*?";
    $all = $upper . $lower . $digits . $special;

    $characters = [
        $upper[random_int(0, strlen($upper) - 1)],
        $lower[random_int(0, strlen($lower) - 1)],
        $digits[random_int(0, strlen($digits) - 1)],
        $special[random_int(0, strlen($special) - 1)]
    ];

    while (count($characters) < 12) {
        $characters[] = $all[random_int(0, strlen($all) - 1)];
    }

    for ($i = count($characters) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        [$characters[$i], $characters[$j]] = [$characters[$j], $characters[$i]];
    }

    return implode("", $characters);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Invalid request method."
    ]);

    exit;
}

requireCsrfToken();

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "No user data was received."
    ]);

    exit;
}

$userId = filter_var(
    $data["user_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$userId) {
    http_response_code(422);

    echo json_encode([
        "success" => false,
        "message" => "A valid user ID is required."
    ]);

    exit;
}

try {
    $check = $conn->prepare("
        SELECT user_id, full_name, email, role, position
        FROM tbl_user
        WHERE user_id = :user_id
        AND status <> 'Archived'
        LIMIT 1
    ");

    $check->execute([":user_id" => $userId]);
    $user = $check->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User not found."
        ]);

        exit;
    }

    $temporaryPassword = generateTemporaryPassword();

    $hashedPassword = password_hash(
        $temporaryPassword,
        PASSWORD_DEFAULT
    );

    $stmt = $conn->prepare("
        UPDATE tbl_user
        SET password = :password,
            must_change_password = 1
        WHERE user_id = :user_id
    ");

    $success = $stmt->execute([
        ":password" => $hashedPassword,
        ":user_id" => $userId
    ]);

    $emailResult = false;
    $emailSent = false;

    if ($success) {
        try {
            $emailResult = sendAccountCredentials(
                $user["email"],
                $user["full_name"],
                $user["role"],
                $user["position"] ?? "N/A",
                $temporaryPassword
            );

            $emailSent = is_array($emailResult)
                ? (bool)($emailResult["success"] ?? false)
                : ($emailResult === true);
        } catch (Throwable $mailError) {
            error_log(
                "HiveSync password reset email error for user {$userId}: " .
                $mailError->getMessage()
            );
        }
    }

    echo json_encode([
        "success" => $success,
        "message" => $success
            ? ($emailSent
                ? "Password reset successfully. Temporary password was sent to email."
                : "Password reset successfully, but email sending failed.")
            : "Failed to reset password.",
        "default_password" => $temporaryPassword,
        "email_sent" => $emailSent,
        "email_result" => $emailSent
            ? "Credentials were sent successfully."
            : "Credentials email was not sent.",
        "user" => [
            "user_id" => (int)$user["user_id"],
            "full_name" => $user["full_name"],
            "email" => $user["email"],
            "role" => $user["role"],
            "position" => $user["position"]
        ]
    ]);
} catch (Throwable $error) {
    error_log(
        "HiveSync reset password error: " .
        $error->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to reset the password."
    ]);
}
