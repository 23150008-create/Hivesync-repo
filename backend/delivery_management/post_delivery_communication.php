<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("../helpers/supplier_communication.php");
require_once("../helpers/inventory_alert_communication.php");


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

function postRespond(
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

function postReadJson(): array
{
    $data = json_decode(
        file_get_contents("php://input"),
        true
    );

    return is_array($data) ? $data : [];
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        postRespond(
            false,
            "Only POST requests are allowed.",
            [],
            405
        );
    }

    $input = postReadJson();

    $deliveryId =
        (int)($input["delivery_id"] ?? 0);

    $action =
        strtolower(
            trim(
                (string)(
                    $input["action"] ?? ""
                )
            )
        );

    if ($deliveryId <= 0) {
        postRespond(
            false,
            "A valid delivery_id is required.",
            [],
            422
        );
    }

    if (
        !in_array(
            $action,
            ["approved", "received"],
            true
        )
    ) {
        postRespond(
            false,
            "Invalid post-processing action.",
            [],
            422
        );
    }

    $stmt = $conn->prepare("
        SELECT
            delivery_id,
            delivery_order_no,
            vendor_id,
            delivery_date,
            status,
            reviewed_by_name,
            received_by_name,
            supplier_payable_amount
        FROM tbl_delivery
        WHERE delivery_id = :delivery_id
        LIMIT 1
    ");

    $stmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    $delivery =
        $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$delivery) {
        postRespond(
            false,
            "Delivery not found.",
            [],
            404
        );
    }

    $deliveryOrderNumber =
        (string)(
            $delivery[
                "delivery_order_no"
            ] ??
            "Delivery #{$deliveryId}"
        );

    $vendorId =
        (int)($delivery["vendor_id"] ?? 0);

    if ($vendorId <= 0) {
        postRespond(
            false,
            "The delivery has no valid supplier.",
            [],
            422
        );
    }

    





    if (
        $action === "approved" &&
        (string)$delivery["status"] !==
            "Approved"
    ) {
        postRespond(
            true,
            "Approval communication skipped because the delivery is no longer awaiting physical delivery.",
            [
                "skipped" => true
            ]
        );
    }

    if (
        $action === "received" &&
        (string)$delivery["status"] !==
            "Delivered"
    ) {
        postRespond(
            true,
            "Receiving communication skipped because the delivery is not in Delivered status.",
            [
                "skipped" => true
            ]
        );
    }

    $unitsStmt = $conn->prepare("
        SELECT
            COALESCE(SUM(quantity), 0)
        FROM tbl_delivery_items
        WHERE delivery_id = :delivery_id
    ");

    $unitsStmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    $totalUnits =
        (int)$unitsStmt->fetchColumn();

    $inventoryAlertSummary = [
        "low_stock_alerts" => 0,
        "batch_expiry_alerts" => 0,
        "notifications_created" => 0,
        "emails_sent" => 0
    ];

    $inventoryAlertError = null;

    





    if ($action === "received") {
        try {
            $inventoryAlertSummary =
                runInventoryAlerts($conn);
        } catch (Throwable $alertError) {
            $inventoryAlertError =
                $alertError->getMessage();

            error_log(
                "post_delivery_communication.php inventory alerts: " .
                $inventoryAlertError
            );
        }
    }

    $communicationError = null;

    $supplierCommunication = [
        "recipients" => 0,
        "notifications_sent" => 0,
        "emails_sent" => 0,
        "notification_sent" => false,
        "email_sent" => false
    ];

    try {
        if ($action === "approved") {
            $scheduledDate =
                !empty(
                    $delivery["delivery_date"]
                )
                    ? (string)$delivery[
                        "delivery_date"
                    ]
                    : null;

            $message =
                "Your delivery " .
                $deliveryOrderNumber .
                " has been approved by BFATC and is now awaiting physical delivery.";

            if ($scheduledDate) {
                $message .=
                    " Scheduled delivery date: " .
                    $scheduledDate .
                    ".";
            }

            $message .=
                " Inventory and supplier payable will be updated only after BFATC receives and verifies the goods.";

            $details =
                "Approved by: " .
                (
                    $delivery[
                        "reviewed_by_name"
                    ] ??
                    "BFATC Admin/Staff"
                ) .
                "\nStatus: Approved / Awaiting Delivery" .
                "\nTotal units proposed: " .
                $totalUnits;

            if ($scheduledDate) {
                $details .=
                    "\nScheduled delivery date: " .
                    $scheduledDate;
            }

            $supplierCommunication =
                notifySupplier(
                    $conn,
                    $vendorId,
                    "Delivery Approved - Awaiting Delivery",
                    $message,
                    "Delivery",
                    $deliveryId,
                    $deliveryOrderNumber,
                    "deliveries",
                    $details
                );
        } else {
            $supplierPayableAmount =
                (float)(
                    $delivery[
                        "supplier_payable_amount"
                    ] ??
                    0
                );

            $receivedByName =
                trim(
                    (string)(
                        $delivery[
                            "received_by_name"
                        ] ??
                        "BFATC Admin/Staff"
                    )
                );

            $supplierCommunication =
                notifySupplier(
                    $conn,
                    $vendorId,
                    "Delivery Received",
                    "BFATC received and verified your delivery " .
                        $deliveryOrderNumber .
                        ". Supplier payable created: ₱" .
                        number_format(
                            $supplierPayableAmount,
                            2
                        ) .
                        ". Product selling price and publication are handled separately by BFATC.",
                    "Delivery",
                    $deliveryId,
                    $deliveryOrderNumber,
                    "deliveries",
                    "Received by: " .
                        $receivedByName .
                        "\nApproved units: " .
                        $totalUnits .
                        "\nSupplier payable: ₱" .
                        number_format(
                            $supplierPayableAmount,
                            2
                        ) .
                        "\nStatus: Delivered / Received"
                );
        }
    } catch (
        Throwable $communicationException
    ) {
        $communicationError =
            $communicationException
                ->getMessage();

        error_log(
            "post_delivery_communication.php supplier communication: " .
            $communicationError
        );
    }

    postRespond(
        true,
        "Delivery post-processing completed.",
        [
            "delivery_id" =>
                $deliveryId,
            "action" =>
                $action,
            "supplier_recipients" =>
                (int)(
                    $supplierCommunication[
                        "recipients"
                    ] ?? 0
                ),
            "notifications_sent" =>
                (int)(
                    $supplierCommunication[
                        "notifications_sent"
                    ] ?? 0
                ),
            "emails_sent" =>
                (int)(
                    $supplierCommunication[
                        "emails_sent"
                    ] ?? 0
                ),
            "communication_error" =>
                $communicationError,
            "inventory_alerts" =>
                $inventoryAlertSummary,
            "inventory_alert_error" =>
                $inventoryAlertError
        ]
    );
} catch (Throwable $error) {
    error_log(
        "post_delivery_communication.php: " .
        $error->getMessage()
    );

    postRespond(
        false,
        $error->getMessage(),
        [],
        500
    );
}