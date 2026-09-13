<?php

require_once("../config/cors.php");
require_once("../auth/auth_guard.php");

requireAuthentication(true);

$csrfToken = $_SESSION["csrf_token"] ?? "";

if (!is_string($csrfToken) || $csrfToken === "") {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to create a CSRF token."
    ]);

    exit;
}

echo json_encode([
    "success" => true,
    "csrf_token" => $csrfToken
]);
