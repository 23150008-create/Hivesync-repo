<?php

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Only POST requests are allowed."
    ]);
    exit;
}

requireModulePermission("deliveries");
requireAnyRole(["Admin", "Staff"]);
requireCsrfToken();

http_response_code(410);

echo json_encode([
    "success" => false,
    "message" => "Permanent delivery deletion is disabled. Use Archive Delivery so inventory, supplier payable, batches, receipts, and transaction history remain preserved."
]);
