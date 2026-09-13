<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require_once("../config/database.php");

$data = json_decode(file_get_contents("php://input"), true);

$user_id = $data["user_id"] ?? "";
$full_name = trim($data["full_name"] ?? "");
$email = trim($data["email"] ?? "");
$role = $data["role"] ?? "";

if ($user_id === "" || $full_name === "" || $email === "" || $role === "") {
    echo json_encode([
        "success" => false,
        "message" => "Required fields are missing."
    ]);
    exit;
}

try {
    $check = $conn->prepare("
        SELECT user_id
        FROM tbl_user
        WHERE email = :email
        AND user_id != :user_id
        LIMIT 1
    ");

    $check->execute([
        ":email" => $email,
        ":user_id" => $user_id
    ]);

    if ($check->rowCount() > 0) {
        echo json_encode([
            "success" => false,
            "message" => "Email already exists."
        ]);
        exit;
    }

    $stmt = $conn->prepare("
        UPDATE tbl_user
        SET 
            full_name = :full_name,
            email = :email,
            role = :role
        WHERE user_id = :user_id
    ");

    $success = $stmt->execute([
        ":full_name" => $full_name,
        ":email" => $email,
        ":role" => $role,
        ":user_id" => $user_id
    ]);

    echo json_encode([
        "success" => $success,
        "message" => $success
            ? "Profile updated successfully."
            : "Profile update failed."
    ]);
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}

?>