<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireAuthentication();
requireAnyRole(["Admin", "Staff"]);

$modulePermissions = $_SESSION["module_permissions"] ?? [];

if (!is_array($modulePermissions)) {
    $modulePermissions = [];
}

$hasLandingPermission = in_array("landing", $modulePermissions, true);
$hasPosPermission = in_array("pos", $modulePermissions, true);

if (!$hasLandingPermission && !$hasPosPermission) {
    authRespond(
        false,
        "You do not have permission to access this resource.",
        403
    );
}

$posId = filter_var(
    $_GET["pos_id"] ??
    $_GET["sale_id"] ??
    null,
    FILTER_VALIDATE_INT
);

if (!$posId) {
    http_response_code(422);
    echo json_encode([
        "success" => false,
        "message" => "A valid POS ID is required."
    ]);
    exit;
}

try {
    $saleStmt = $conn->prepare("
        SELECT
            p.pos_id,
            p.pos_id AS sale_id,
            p.transaction_code,
            p.transaction_code AS sale_number,
            p.customer_name,
            p.employee_name,
            p.office_name,
            p.company_address,
            p.remarks,
            p.prepared_by,
            p.received_by,
            p.cashier_id,
            p.payment_type,
            p.payment_method,
            p.payment_reference,

            COALESCE(
                u.full_name,
                p.prepared_by,
                'Unknown Cashier'
            ) AS cashier_name,

            p.subtotal_amount,
            p.total_amount,
            p.discount,
            p.discount_percent,
            p.payment_amount,
            p.change_amount,
            p.transaction_status,
            p.void_reason,
            p.voided_by,
            p.voided_at,
            p.refunded_amount,
            p.transaction_date,
            p.transaction_date AS created_at,
            p.updated_at,

            COALESCE(
                void_user.full_name,
                ''
            ) AS voided_by_name,

            r.receivable_id,
            r.receivable_type,
            r.employee_name AS receivable_employee_name,
            r.office_name AS receivable_office_name,
            r.original_amount AS receivable_original_amount,
            r.amount_paid AS receivable_amount_paid,
            r.balance_amount AS receivable_balance_amount,
            r.status AS receivable_status,
            r.notes AS receivable_notes

        FROM tbl_pos p

        LEFT JOIN tbl_user u
            ON u.user_id = p.cashier_id

        LEFT JOIN tbl_user void_user
            ON void_user.user_id = p.voided_by

        LEFT JOIN tbl_receivables r
            ON r.pos_id = p.pos_id

        WHERE p.pos_id = :pos_id
        LIMIT 1
    ");

    $saleStmt->execute([
        ":pos_id" => $posId
    ]);

    $sale = $saleStmt->fetch(PDO::FETCH_ASSOC);

    if (!$sale) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Receipt was not found."
        ]);
        exit;
    }

    if (
        ($sale["employee_name"] ?? "") === "" &&
        ($sale["receivable_employee_name"] ?? "") !== ""
    ) {
        $sale["employee_name"] =
            $sale["receivable_employee_name"];
    }

    if (
        ($sale["office_name"] ?? "") === "" &&
        ($sale["receivable_office_name"] ?? "") !== ""
    ) {
        $sale["office_name"] =
            $sale["receivable_office_name"];
    }

    $itemStmt = $conn->prepare("
        SELECT
            pi.item_id,
            pi.pos_id,
            pi.product_id,
            i.product_name,
            i.sku,
            i.unit_type,
            i.unit,
            pi.quantity,
            pi.returned_quantity,
            pi.quantity - pi.returned_quantity
                AS remaining_quantity,
            pi.price,
            pi.price AS unit_price,
            pi.subtotal,
            pi.refunded_amount,
            pi.item_status

        FROM tbl_pos_items pi

        INNER JOIN tbl_inv i
            ON i.product_id = pi.product_id

        WHERE pi.pos_id = :pos_id

        ORDER BY pi.item_id ASC
    ");

    $itemStmt->execute([
        ":pos_id" => $posId
    ]);

    $items =
        $itemStmt->fetchAll(PDO::FETCH_ASSOC);

    $returnStmt = $conn->prepare("
        SELECT
            r.return_id,
            r.return_number,
            r.return_type,
            r.return_reason,
            r.refund_amount,
            r.processed_by,
            r.processed_by_name,
            r.return_date
        FROM tbl_pos_returns r
        WHERE r.pos_id = :pos_id
        ORDER BY r.return_date DESC
    ");

    $returnStmt->execute([
        ":pos_id" => $posId
    ]);

    $returns =
        $returnStmt->fetchAll(PDO::FETCH_ASSOC);

    $subtotalAmount = round(
        (float)($sale["subtotal_amount"] ?? 0),
        2
    );

    $discountAmount = round(
        (float)($sale["discount"] ?? 0),
        2
    );

    $discountPercent = round(
        (float)($sale["discount_percent"] ?? 0),
        2
    );

    $totalAmount = round(
        (float)($sale["total_amount"] ?? 0),
        2
    );

    $paymentAmount = round(
        (float)($sale["payment_amount"] ?? 0),
        2
    );

    $changeAmount = round(
        (float)($sale["change_amount"] ?? 0),
        2
    );

    $refundedAmount = round(
        (float)($sale["refunded_amount"] ?? 0),
        2
    );

    $paymentType = trim(
        (string)($sale["payment_type"] ?? "Cash")
    );

    $paymentMethod = trim(
        (string)($sale["payment_method"] ?? "Cash")
    );

    $itemSubtotal = 0.00;

    foreach ($items as &$item) {
        $item["quantity"] =
            (int)($item["quantity"] ?? 0);

        $item["returned_quantity"] =
            (int)($item["returned_quantity"] ?? 0);

        $item["remaining_quantity"] =
            (int)($item["remaining_quantity"] ?? 0);

        $item["price"] = round(
            (float)($item["price"] ?? 0),
            2
        );

        $item["unit_price"] = round(
            (float)($item["unit_price"] ?? 0),
            2
        );

        $item["subtotal"] = round(
            (float)($item["subtotal"] ?? 0),
            2
        );

        $item["refunded_amount"] = round(
            (float)($item["refunded_amount"] ?? 0),
            2
        );

        $itemSubtotal += $item["subtotal"];
    }

    unset($item);

    $itemSubtotal = round($itemSubtotal, 2);

    $calculatedTotal = round(
        max(0, $subtotalAmount - $discountAmount),
        2
    );

    $amountPaid =
        $paymentType === "Receivable"
            ? round(
                min(
                    $paymentAmount,
                    $totalAmount
                ),
                2
            )
            : $totalAmount;

    $balanceAmount =
        $paymentType === "Receivable"
            ? round(
                max(
                    0,
                    $totalAmount - $amountPaid
                ),
                2
            )
            : 0.00;

    if (
        $paymentType === "Receivable" &&
        isset($sale["receivable_amount_paid"]) &&
        $sale["receivable_amount_paid"] !== null
    ) {
        $amountPaid = round(
            (float)$sale["receivable_amount_paid"],
            2
        );
    }

    if (
        $paymentType === "Receivable" &&
        isset($sale["receivable_balance_amount"]) &&
        $sale["receivable_balance_amount"] !== null
    ) {
        $balanceAmount = round(
            (float)$sale["receivable_balance_amount"],
            2
        );
    }

    $cashAmount =
        $paymentMethod === "Cash"
            ? $paymentAmount
            : 0.00;

    $sale["subtotal_amount"] = $subtotalAmount;
    $sale["discount"] = $discountAmount;
    $sale["discount_percent"] = $discountPercent;
    $sale["total_amount"] = $totalAmount;
    $sale["payment_amount"] = $paymentAmount;
    $sale["cash_amount"] = $cashAmount;
    $sale["change_amount"] = $changeAmount;
    $sale["refunded_amount"] = $refundedAmount;
    $sale["amount_paid"] = $amountPaid;
    $sale["balance_amount"] = $balanceAmount;
    $sale["calculated_item_subtotal"] = $itemSubtotal;
    $sale["calculated_total"] = $calculatedTotal;
    $sale["subtotal_matches_items"] =
        abs($subtotalAmount - $itemSubtotal) < 0.01;
    $sale["total_matches_computation"] =
        abs($totalAmount - $calculatedTotal) < 0.01;

    $sale["items"] = $items;
    $sale["returns"] = $returns;

    echo json_encode([
        "success" => true,
        "receipt" => $sale,
        "sale" => $sale,
        "items" => $items,
        "returns" => $returns
    ]);
} catch (Throwable $e) {
    http_response_code(500);

    error_log(
        "HiveSync get_receipt.php: " .
        $e->getMessage()
    );

    echo json_encode([
        "success" => false,
        "message" =>
            "Failed to load the receipt."
    ]);
}
