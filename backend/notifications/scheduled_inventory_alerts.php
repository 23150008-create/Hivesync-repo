<?php

declare(strict_types=1);


header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

require_once("../config/database.php");
require_once("../helpers/inventory_alert_communication.php");

function scheduledInventoryRespond(
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
        JSON_UNESCAPED_SLASHES |
        JSON_PRETTY_PRINT
    );

    exit;
}



const HIVE_SYNC_ALERT_RUNNER_KEY =
    "HiveSyncInventoryAlerts2026";

$isCli =
    PHP_SAPI === "cli";

if (!$isCli) {
    $providedKey = trim(
        (string)(
            $_GET["key"] ?? ""
        )
    );

    if (
        !hash_equals(
            HIVE_SYNC_ALERT_RUNNER_KEY,
            $providedKey
        )
    ) {
        scheduledInventoryRespond(
            false,
            "Unauthorized inventory alert runner request.",
            [],
            401
        );
    }
}

try {
    $startedAt =
        date("Y-m-d H:i:s");

    $summary =
        runInventoryAlerts($conn);

    $finishedAt =
        date("Y-m-d H:i:s");

    scheduledInventoryRespond(
        true,
        "Scheduled inventory alert check completed successfully.",
        [
            "started_at" => $startedAt,
            "finished_at" => $finishedAt,
            "low_stock_alerts" =>
                (int)(
                    $summary[
                        "low_stock_alerts"
                    ] ?? 0
                ),
            "batch_expiry_alerts" =>
                (int)(
                    $summary[
                        "batch_expiry_alerts"
                    ] ?? 0
                ),
            "notifications_created" =>
                (int)(
                    $summary[
                        "notifications_created"
                    ] ?? 0
                ),
            "emails_sent" =>
                (int)(
                    $summary[
                        "emails_sent"
                    ] ?? 0
                )
        ]
    );
} catch (Throwable $error) {
    error_log(
        "scheduled_inventory_alerts.php: " .
        $error->getMessage()
    );

    scheduledInventoryRespond(
        false,
        "Scheduled inventory alert check failed.",
        [
            "error" =>
                $error->getMessage()
        ],
        500
    );
}