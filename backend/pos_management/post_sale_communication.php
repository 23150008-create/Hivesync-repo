<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("../helpers/inventory_alert_communication.php");
require_once("../helpers/supplier_communication.php");

requireModulePermission("pos");
requireAnyRole(["Admin", "Staff"]);

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

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(
        false,
        "Only POST requests are allowed.",
        [],
        405
    );
}

requireCsrfToken();

try {
    $data = json_decode(
        file_get_contents("php://input"),
        true
    );

    if (!is_array($data)) {
        respond(
            false,
            "No post-sale data was received.",
            [],
            422
        );
    }

    $transactionCode = trim(
        (string)(
            $data["transaction_code"] ?? ""
        )
    );

    $events =
        is_array(
            $data["reorder_events"] ?? null
        )
            ? $data["reorder_events"]
            : [];

    if ($transactionCode === "") {
        respond(
            false,
            "Transaction code is required.",
            [],
            422
        );
    }

    $saleStmt = $conn->prepare("
        SELECT
            pos_id,
            transaction_code,
            transaction_status
        FROM tbl_pos
        WHERE transaction_code = :transaction_code
        LIMIT 1
    ");

    $saleStmt->execute([
        ":transaction_code" =>
            $transactionCode
    ]);

    $sale =
        $saleStmt->fetch(PDO::FETCH_ASSOC);

    if (!$sale) {
        respond(
            false,
            "The completed POS transaction could not be found.",
            [],
            404
        );
    }

    if (
        strtolower(
            (string)(
                $sale["transaction_status"] ??
                ""
            )
        ) === "voided"
    ) {
        respond(
            true,
            "Post-sale communication skipped because the sale is voided.",
            [
                "processed_events" => 0
            ]
        );
    }

    if (count($events) === 0) {
        respond(
            true,
            "No reorder communication is required.",
            [
                "processed_events" => 0
            ]
        );
    }

    $results = [];

    $productStmt = $conn->prepare("
        SELECT
            product_id,
            product_name,
            sku,
            vendor_id,
            quantity,
            reorder_level,
            status
        FROM tbl_inv
        WHERE product_id = :product_id
        LIMIT 1
    ");

    foreach ($events as $event) {
        $productId =
            (int)(
                $event["product_id"] ?? 0
            );

        if ($productId <= 0) {
            continue;
        }

        $productStmt->execute([
            ":product_id" => $productId
        ]);

        $product =
            $productStmt->fetch(PDO::FETCH_ASSOC);

        if (!$product) {
            continue;
        }

        $productName =
            trim(
                (string)(
                    $product["product_name"] ??
                    ""
                )
            );

        $sku =
            trim(
                (string)(
                    $product["sku"] ?? ""
                )
            );

        $vendorId =
            (int)(
                $product["vendor_id"] ?? 0
            );

        $quantity =
            (int)(
                $product["quantity"] ?? 0
            );

        $reorderLevel =
            (int)(
                $product["reorder_level"] ??
                0
            );

        if (
            $reorderLevel <= 0 ||
            $quantity > $reorderLevel
        ) {
            continue;
        }

        $message =
            $productName .
            " has reached its reorder level. " .
            "Only {$quantity} unit(s) remain. " .
            "Reorder level: {$reorderLevel}.";

        $details =
            "Product: {$productName}\n" .
            ($sku !== ""
                ? "SKU: {$sku}\n"
                : "") .
            "Current stock: {$quantity}\n" .
            "Reorder level: {$reorderLevel}\n" .
            "Triggered by POS transaction: {$transactionCode}\n" .
            "Action required: Please prepare and submit a new delivery request in HiveSync.";

        $supplierResult = null;
        $adminStaffResult = null;

        try {
            if ($vendorId > 0) {
                $supplierResult =
                    notifySupplier(
                        $conn,
                        $vendorId,
                        "Restock Needed",
                        $message,
                        "Inventory",
                        $productId,
                        $sku !== ""
                            ? $sku
                            : "PRODUCT-{$productId}",
                        "deliveries",
                        $details
                    );
            }
        } catch (Throwable $supplierError) {
            error_log(
                "post_sale_communication.php supplier: " .
                $supplierError->getMessage()
            );
        }

        try {
            $adminStaffResult =
                dispatchInventoryAlertToAdminStaff(
                    $conn,
                    "Reorder Level Reached - " .
                    $transactionCode,
                    $message,
                    "Inventory",
                    $productId,
                    $sku !== ""
                        ? $sku
                        : "PRODUCT-{$productId}",
                    $details
                );
        } catch (Throwable $adminError) {
            error_log(
                "post_sale_communication.php admin/staff: " .
                $adminError->getMessage()
            );
        }

        $results[] = [
            "product_id" => $productId,
            "supplier" =>
                $supplierResult,
            "admin_staff" =>
                $adminStaffResult
        ];
    }

    respond(
        true,
        "Post-sale communication completed.",
        [
            "transaction_code" =>
                $transactionCode,
            "processed_events" =>
                count($results),
            "results" =>
                $results
        ]
    );
} catch (Throwable $error) {
    error_log(
        "post_sale_communication.php: " .
        $error->getMessage()
    );

    respond(
        false,
        "The sale was completed, but post-sale communication encountered an error.",
        [],
        500
    );
}
