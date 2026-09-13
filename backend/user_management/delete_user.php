<?php

require_once("../config/database.php");

$data = json_decode(file_get_contents("php://input"), true);

$user_id = $data["user_id"] ?? "";

if ($user_id === "") {
    echo json_encode([
        "success" => false,
        "message" => "User ID is required"
    ]);
    exit;
}

$sql = "DELETE FROM tbl_user WHERE user_id = :user_id";

$stmt = $conn->prepare($sql);
$stmt->bindParam(":user_id", $user_id);

if ($stmt->execute()) {
    echo json_encode([
        "success" => true,
        "message" => "User deleted successfully"
    ]);
} else {
    echo json_encode([
        "success" => false,
        "message" => "Failed to delete user"
    ]);
}

?>