<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireAuthentication();

function respond(
    bool $success,
    string $message,
    array $extra = [],
    int $statusCode = 200
): void {
    http_response_code($statusCode);

    echo json_encode(array_merge([
        "success" => $success,
        "message" => $message
    ], $extra));

    exit;
}

$remittanceOrderId = filter_var(
    $_GET["remittance_order_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$remittanceOrderId) {
    respond(false, "A valid remittance order ID is required.", [], 422);
}

try {
    $orderStmt = $conn->prepare("
        SELECT
            ro.*,
            v.vendor_name,
            v.contact_person,
            v.phone,
            v.address
        FROM tbl_remittance_order ro
        INNER JOIN tbl_vendor v
            ON v.vendor_id = ro.vendor_id
        WHERE ro.remittance_order_id = :remittance_order_id
        LIMIT 1
    ");

    $orderStmt->execute([
        ":remittance_order_id" => $remittanceOrderId
    ]);

    $order = $orderStmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        respond(false, "Remittance order was not found.", [], 404);
    }

    $role = (string)($_SESSION["role"] ?? "");

    if ($role === "Supplier" || $role === "Vendor") {
        enforceSupplierVendorAccess((int)$order["vendor_id"]);
    } else {
        requireModulePermission("vendors");
        requireAnyRole(["Admin", "Staff", "Audit"]);
    }

    $itemsStmt = $conn->prepare("
        SELECT
            roi.*,
            sp.payable_id,
            sp.delivery_id,
            sp.payable_amount,
            sp.paid_amount,
            sp.balance_amount,
            sp.payment_status,
            d.delivery_order_no,
            d.delivery_date
        FROM tbl_remittance_order_items roi
        LEFT JOIN tbl_supplier_payable sp
            ON (
                roi.payable_id = sp.payable_id
                OR (
                    roi.delivery_id = sp.delivery_id
                    AND sp.vendor_id = :vendor_id
                )
            )
        LEFT JOIN tbl_delivery d
            ON d.delivery_id = sp.delivery_id
        WHERE roi.remittance_order_id = :remittance_order_id
        ORDER BY sp.payable_id ASC
    ");

    try {
        $itemsStmt->execute([
            ":vendor_id" => (int)$order["vendor_id"],
            ":remittance_order_id" => $remittanceOrderId
        ]);

        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $ignored) {
        $fallback = $conn->prepare("
            SELECT *
            FROM tbl_remittance_order_items
            WHERE remittance_order_id = :remittance_order_id
            ORDER BY 1 ASC
        ");

        $fallback->execute([
            ":remittance_order_id" => $remittanceOrderId
        ]);

        $items = $fallback->fetchAll(PDO::FETCH_ASSOC);
    }

    $paymentsStmt = $conn->prepare("
        SELECT *
        FROM tbl_supplier_payment
        WHERE remittance_order_id = :remittance_order_id
        ORDER BY payment_date ASC, supplier_payment_id ASC
    ");

    $paymentsStmt->execute([
        ":remittance_order_id" => $remittanceOrderId
    ]);

    $payments = $paymentsStmt->fetchAll(PDO::FETCH_ASSOC);

    respond(
        true,
        "Remittance receipt retrieved successfully.",
        [
            "order" => $order,
            "items" => $items,
            "payments" => $payments
        ]
    );
} catch (Throwable $e) {
    error_log(
        "get_remittance_receipt.php: " .
        $e->getMessage()
    );

    respond(
        false,
        "Unable to retrieve the remittance receipt.",
        [],
        500
    );
}
