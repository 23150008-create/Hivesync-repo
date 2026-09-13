<?php

declare(strict_types=1);

require_once(__DIR__ . "/../config/mailer.php");

function inventoryAlertTableExists(
    PDO $conn,
    string $table
): bool {
    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
    ");

    $stmt->execute([
        ":table_name" => $table
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

function inventoryAlertColumnExists(
    PDO $conn,
    string $table,
    string $column
): bool {
    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
        AND column_name = :column_name
    ");

    $stmt->execute([
        ":table_name" => $table,
        ":column_name" => $column
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

function inventoryAlertFirstColumn(
    PDO $conn,
    string $table,
    array $candidates
): ?string {
    foreach ($candidates as $candidate) {
        if (
            inventoryAlertColumnExists(
                $conn,
                $table,
                $candidate
            )
        ) {
            return $candidate;
        }
    }

    return null;
}

function inventoryAlertOwnerColumn(
    PDO $conn
): ?string {
    return inventoryAlertFirstColumn(
        $conn,
        "tbl_notifications",
        [
            "user_id",
            "recipient_user_id"
        ]
    );
}

function inventoryAlertActiveRecipients(
    PDO $conn
): array {
    if (
        !inventoryAlertTableExists(
            $conn,
            "tbl_user"
        )
    ) {
        return [];
    }

    $stmt = $conn->prepare("
        SELECT
            user_id,
            full_name,
            email,
            role
        FROM tbl_user
        WHERE role IN ('Admin', 'Staff')
        AND COALESCE(status, 'Active') = 'Active'
        AND email IS NOT NULL
        AND TRIM(email) <> ''
        ORDER BY
            CASE
                WHEN role = 'Admin' THEN 1
                ELSE 2
            END,
            user_id ASC
    ");

    $stmt->execute();

    return $stmt->fetchAll(
        PDO::FETCH_ASSOC
    );
}

function createInventoryAlertNotification(
    PDO $conn,
    int $userId,
    string $title,
    string $message,
    string $type,
    int $referenceId,
    string $referenceCode,
    string $details
): bool {
    if (
        !inventoryAlertTableExists(
            $conn,
            "tbl_notifications"
        )
    ) {
        return false;
    }

    $ownerColumn =
        inventoryAlertOwnerColumn($conn);

    if (!$ownerColumn) {
        return false;
    }

    $duplicate = $conn->prepare("
        SELECT notification_id
        FROM tbl_notifications
        WHERE `{$ownerColumn}` = :user_id
        AND title = :title
        AND type = :type
        AND reference_id = :reference_id
        LIMIT 1
    ");

    $duplicate->execute([
        ":user_id" => $userId,
        ":title" => $title,
        ":type" => $type,
        ":reference_id" =>
            $referenceId
    ]);

    if ($duplicate->fetchColumn()) {
        return false;
    }

    $columns = [
        "`{$ownerColumn}`",
        "title",
        "message",
        "type",
        "reference_id",
        "is_read",
        "created_at"
    ];

    $values = [
        ":user_id",
        ":title",
        ":message",
        ":type",
        ":reference_id",
        "0",
        "NOW()"
    ];

    $params = [
        ":user_id" => $userId,
        ":title" => $title,
        ":message" => $message,
        ":type" => $type,
        ":reference_id" => $referenceId
    ];

    if (
        inventoryAlertColumnExists(
            $conn,
            "tbl_notifications",
            "module"
        )
    ) {
        $columns[] = "module";
        $values[] = ":module";
        $params[":module"] = "inventory";
    } elseif (
        inventoryAlertColumnExists(
            $conn,
            "tbl_notifications",
            "target_page"
        )
    ) {
        $columns[] = "target_page";
        $values[] = ":target_page";
        $params[":target_page"] =
            "inventory";
    }

    if (
        inventoryAlertColumnExists(
            $conn,
            "tbl_notifications",
            "reference_code"
        )
    ) {
        $columns[] = "reference_code";
        $values[] = ":reference_code";
        $params[":reference_code"] =
            $referenceCode;
    }

    if (
        inventoryAlertColumnExists(
            $conn,
            "tbl_notifications",
            "details"
        )
    ) {
        $columns[] = "details";
        $values[] = ":details";
        $params[":details"] = $details;
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_notifications
        (
            " . implode(", ", $columns) . "
        )
        VALUES
        (
            " . implode(", ", $values) . "
        )
    ");

    $stmt->execute($params);

    return true;
}

function sendInventoryAlertEmail(
    string $toEmail,
    string $fullName,
    string $subject,
    string $headline,
    string $message,
    string $details
): bool {
    try {
        if (
            !filter_var(
                $toEmail,
                FILTER_VALIDATE_EMAIL
            )
        ) {
            return false;
        }

        $mail = createHiveSyncMailer();

        $mail->addAddress(
            $toEmail,
            $fullName
        );

        $mail->isHTML(true);
        $mail->Subject =
            "HiveSync - " . $subject;

        $safeName = htmlspecialchars(
            $fullName,
            ENT_QUOTES,
            "UTF-8"
        );

        $safeHeadline = htmlspecialchars(
            $headline,
            ENT_QUOTES,
            "UTF-8"
        );

        $safeMessage = htmlspecialchars(
            $message,
            ENT_QUOTES,
            "UTF-8"
        );

        $safeDetails = nl2br(
            htmlspecialchars(
                $details,
                ENT_QUOTES,
                "UTF-8"
            )
        );

        $mail->Body = "
            <div style=\"
                max-width: 640px;
                margin: 20px auto;
                border: 1px solid #e5e7eb;
                border-radius: 14px;
                overflow: hidden;
                font-family: Arial, sans-serif;
                color: #1b2430;
                background: #ffffff;
            \">
                <div style=\"
                    padding: 20px 24px;
                    background: #1b2430;
                    color: #ffffff;
                \">
                    <div style=\"
                        margin-bottom: 6px;
                        color: #f4b400;
                        font-size: 12px;
                        font-weight: 700;
                    \">
                        HiveSync Inventory Alert
                    </div>

                    <h2 style=\"
                        margin: 0;
                        font-size: 21px;
                    \">
                        {$safeHeadline}
                    </h2>
                </div>

                <div style=\"
                    padding: 24px;
                \">
                    <p>
                        Good day, <strong>{$safeName}</strong>.
                    </p>

                    <p style=\"
                        line-height: 1.65;
                    \">
                        {$safeMessage}
                    </p>

                    <div style=\"
                        margin-top: 18px;
                        padding: 15px;
                        border-left: 4px solid #f4b400;
                        background: #fffdf4;
                        line-height: 1.65;
                    \">
                        {$safeDetails}
                    </div>

                    <p style=\"
                        margin-top: 20px;
                        color: #1b2430;
                    \">
                        Please open HiveSync Inventory Management for review and the appropriate action.
                    </p>
                </div>
            </div>
        ";

        $mail->AltBody =
            "HiveSync Inventory Alert\n\n" .
            $headline .
            "\n\n" .
            $message .
            "\n\n" .
            $details .
            "\n\nOpen HiveSync Inventory Management for review.";

        $mail->send();

        return true;
    } catch (Throwable $error) {
        error_log(
            "HiveSync inventory alert email failed: " .
            $error->getMessage()
        );

        return false;
    }
}

function dispatchInventoryAlertToAdminStaff(
    PDO $conn,
    string $title,
    string $message,
    string $type,
    int $referenceId,
    string $referenceCode,
    string $details
): array {
    $result = [
        "recipients" => 0,
        "notifications_created" => 0,
        "emails_sent" => 0
    ];

    $recipients =
        inventoryAlertActiveRecipients(
            $conn
        );

    foreach ($recipients as $recipient) {
        $userId = (int)(
            $recipient["user_id"] ?? 0
        );

        $email = trim(
            (string)(
                $recipient["email"] ?? ""
            )
        );

        $fullName = trim(
            (string)(
                $recipient["full_name"] ??
                "HiveSync User"
            )
        );

        if (
            $userId <= 0 ||
            $email === ""
        ) {
            continue;
        }

        $result["recipients"]++;

        /*
         * Email is sent ONLY when the notification is newly created.
         * This makes the notification row the duplicate guard for email.
         */
        $created =
            createInventoryAlertNotification(
                $conn,
                $userId,
                $title,
                $message,
                $type,
                $referenceId,
                $referenceCode,
                $details
            );

        if (!$created) {
            continue;
        }

        $result[
            "notifications_created"
        ]++;

        if (
            sendInventoryAlertEmail(
                $email,
                $fullName,
                $title,
                $title,
                $message,
                $details
            )
        ) {
            $result["emails_sent"]++;
        }
    }

    return $result;
}

function runInventoryAlerts(
    PDO $conn
): array {
    $summary = [
        "low_stock_alerts" => 0,
        "batch_expiry_alerts" => 0,
        "notifications_created" => 0,
        "emails_sent" => 0
    ];

    if (
        !inventoryAlertTableExists(
            $conn,
            "tbl_inv"
        )
    ) {
        return $summary;
    }

    /*
    |--------------------------------------------------------------------------
    | 1) Reorder / Restock Level Alerts
    |--------------------------------------------------------------------------
    |
    | Alert only products that actually have stock history / active quantity
    | state and whose current quantity is at or below reorder level.
    |
    */

    $statusCondition =
        inventoryAlertColumnExists(
            $conn,
            "tbl_inv",
            "status"
        )
            ? "
                AND COALESCE(
                    i.status,
                    'In Stock'
                ) <> 'Archived'
              "
            : "";

    $reorderStmt = $conn->prepare("
        SELECT
            i.product_id,
            i.product_name,
            i.quantity,
            COALESCE(
                i.reorder_level,
                0
            ) AS reorder_level,
            i.sku
        FROM tbl_inv i
        WHERE COALESCE(
            i.reorder_level,
            0
        ) > 0
        AND i.quantity <=
            COALESCE(
                i.reorder_level,
                0
            )
        {$statusCondition}
        ORDER BY
            i.quantity ASC,
            i.product_name ASC
        LIMIT 100
    ");

    $reorderStmt->execute();

    foreach (
        $reorderStmt->fetchAll(
            PDO::FETCH_ASSOC
        ) as $product
    ) {
        $productId = (int)(
            $product["product_id"] ?? 0
        );

        if ($productId <= 0) {
            continue;
        }

        $quantity = (int)(
            $product["quantity"] ?? 0
        );

        $reorderLevel = (int)(
            $product["reorder_level"] ?? 0
        );

        $productName =
            (string)(
                $product[
                    "product_name"
                ] ?? "Product"
            );

        $sku = trim(
            (string)(
                $product["sku"] ?? ""
            )
        );

        $message =
            $productName .
            " has reached its reorder/restock level. " .
            "Current stock: {$quantity}. " .
            "Reorder level: {$reorderLevel}.";

        $details =
            "Product: {$productName}\n" .
            (
                $sku !== ""
                    ? "SKU: {$sku}\n"
                    : ""
            ) .
            "Current stock: {$quantity}\n" .
            "Reorder level: {$reorderLevel}\n" .
            "Recommended action: Review stock and prepare a restock/delivery request.";

        $sent =
            dispatchInventoryAlertToAdminStaff(
                $conn,
                "Reorder Level Reached",
                $message,
                "Inventory",
                $productId,
                $sku !== ""
                    ? $sku
                    : "PRODUCT-{$productId}",
                $details
            );

        if (
            $sent[
                "notifications_created"
            ] > 0
        ) {
            $summary[
                "low_stock_alerts"
            ]++;
        }

        $summary[
            "notifications_created"
        ] +=
            $sent[
                "notifications_created"
            ];

        $summary["emails_sent"] +=
            $sent["emails_sent"];
    }

    /*
    |--------------------------------------------------------------------------
    | 2) Batch Expiry Alerts - EXACTLY 7 DAYS BEFORE
    |--------------------------------------------------------------------------
    |
    | Expiry monitoring is batch-based because the same product may arrive
    | in separate deliveries with different expiry dates.
    |
    */

    if (
        inventoryAlertTableExists(
            $conn,
            "tbl_inventory_batches"
        ) &&
        inventoryAlertColumnExists(
            $conn,
            "tbl_inventory_batches",
            "batch_id"
        ) &&
        inventoryAlertColumnExists(
            $conn,
            "tbl_inventory_batches",
            "product_id"
        ) &&
        inventoryAlertColumnExists(
            $conn,
            "tbl_inventory_batches",
            "expiry_date"
        ) &&
        inventoryAlertColumnExists(
            $conn,
            "tbl_inventory_batches",
            "quantity"
        )
    ) {
        $batchStmt = $conn->prepare("
            SELECT
                b.batch_id,
                b.product_id,
                b.quantity,
                b.expiry_date,
                i.product_name,
                i.sku
            FROM tbl_inventory_batches b
            INNER JOIN tbl_inv i
                ON i.product_id =
                   b.product_id
            WHERE b.expiry_date IS NOT NULL
            AND b.quantity > 0
            AND DATEDIFF(
                b.expiry_date,
                CURDATE()
            ) BETWEEN 0 AND 7
            {$statusCondition}
            ORDER BY
                b.expiry_date ASC,
                b.batch_id ASC
            LIMIT 100
        ");

        $batchStmt->execute();

        foreach (
            $batchStmt->fetchAll(
                PDO::FETCH_ASSOC
            ) as $batch
        ) {
            $batchId = (int)(
                $batch["batch_id"] ?? 0
            );

            if ($batchId <= 0) {
                continue;
            }

            $productName =
                (string)(
                    $batch[
                        "product_name"
                    ] ?? "Product"
                );

            $quantity = (int)(
                $batch["quantity"] ?? 0
            );

            $expiryDate =
                (string)(
                    $batch[
                        "expiry_date"
                    ] ?? ""
                );

            $sku = trim(
                (string)(
                    $batch["sku"] ?? ""
                )
            );

            $message =
                $productName .
                " batch #{$batchId} will expire on " .
                $expiryDate .
                ". Remaining quantity: {$quantity}.";

            $details =
                "Product: {$productName}\n" .
                (
                    $sku !== ""
                        ? "SKU: {$sku}\n"
                        : ""
                ) .
                "Batch ID: {$batchId}\n" .
                "Expiry date: {$expiryDate}\n" .
                "Remaining quantity: {$quantity}\n" .
                "Alert threshold: 7 days before expiry\n" .
                "Recommended action: Prioritize sale, review for supplier pull-out, or prepare disposal when necessary.";

            $sent =
                dispatchInventoryAlertToAdminStaff(
                    $conn,
                    "Batch Near Expiry",
                    $message,
                    "Expiration",
                    $batchId,
                    "BATCH-{$batchId}",
                    $details
                );

            if (
                $sent[
                    "notifications_created"
                ] > 0
            ) {
                $summary[
                    "batch_expiry_alerts"
                ]++;
            }

            $summary[
                "notifications_created"
            ] +=
                $sent[
                    "notifications_created"
                ];

            $summary["emails_sent"] +=
                $sent["emails_sent"];
        }
    }

    return $summary;
}