<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

function supplierTableExists(
    PDO $conn,
    string $tableName
): bool {
    /*
     * Performance optimization only.
     * Cache repeated table checks during the current supplier communication request.
     */
    static $cache = [];

    $cacheKey = strtolower(trim($tableName));

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
    ");

    $stmt->execute([
        ":table_name" => $tableName
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function supplierColumnExists(
    PDO $conn,
    string $tableName,
    string $columnName
): bool {
    /*
     * Performance optimization only.
     * Cache repeated column checks during the current supplier communication request.
     */
    static $cache = [];

    $cacheKey =
        strtolower(trim($tableName)) .
        "." .
        strtolower(trim($columnName));

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
        AND column_name = :column_name
    ");

    $stmt->execute([
        ":table_name" => $tableName,
        ":column_name" => $columnName
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function supplierNotificationOwnerColumn(
    PDO $conn
): ?string {
    foreach (
        [
            "user_id",
            "recipient_user_id"
        ] as $column
    ) {
        if (
            supplierColumnExists(
                $conn,
                "tbl_notifications",
                $column
            )
        ) {
            return $column;
        }
    }

    return null;
}

function getSupplierRecipients(
    PDO $conn,
    int $vendorId
): array {
    if (
        !supplierTableExists($conn, "tbl_user") ||
        !supplierColumnExists(
            $conn,
            "tbl_user",
            "vendor_id"
        )
    ) {
        return [];
    }

    $emailSelect =
        supplierColumnExists(
            $conn,
            "tbl_user",
            "email"
        )
            ? "email"
            : "NULL AS email";

    $statusCondition =
        supplierColumnExists(
            $conn,
            "tbl_user",
            "status"
        )
            ? "
                AND COALESCE(status, 'Active') = 'Active'
              "
            : "";

    $stmt = $conn->prepare("
        SELECT
            user_id,
            full_name,
            {$emailSelect}
        FROM tbl_user
        WHERE vendor_id = :vendor_id
        AND role IN ('Supplier', 'Vendor')
        {$statusCondition}
        ORDER BY user_id ASC
    ");

    $stmt->execute([
        ":vendor_id" => $vendorId
    ]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function supplierNotificationAlreadyExists(
    PDO $conn,
    int $userId,
    string $title,
    ?string $referenceCode
): bool {
    $referenceCode = trim((string)($referenceCode ?? ""));

    if (
        $userId <= 0 ||
        $referenceCode === "" ||
        !supplierTableExists($conn, "tbl_notifications")
    ) {
        return false;
    }

    $ownerColumn =
        supplierNotificationOwnerColumn(
            $conn
        );

    if (
        !$ownerColumn ||
        !supplierColumnExists(
            $conn,
            "tbl_notifications",
            "reference_code"
        ) ||
        !supplierColumnExists(
            $conn,
            "tbl_notifications",
            "title"
        )
    ) {
        return false;
    }

    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM tbl_notifications
        WHERE `{$ownerColumn}` = :user_id
        AND reference_code = :reference_code
        AND title = :title
    ");

    $stmt->execute([
        ":user_id" => $userId,
        ":reference_code" => $referenceCode,
        ":title" => $title
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

function createSupplierNotification(
    PDO $conn,
    int $userId,
    string $title,
    string $message,
    string $type,
    ?int $referenceId = null,
    ?string $referenceCode = null,
    ?string $module = null,
    ?string $details = null
): bool {
    if (
        !supplierTableExists(
            $conn,
            "tbl_notifications"
        )
    ) {
        return false;
    }

    $ownerColumn =
        supplierNotificationOwnerColumn(
            $conn
        );

    if (!$ownerColumn) {
        error_log(
            "Supplier notification skipped: tbl_notifications has no user owner column."
        );

        return false;
    }

    $data = [
        $ownerColumn => $userId,
        "title" => $title,
        "message" => $message,
        "type" => $type,
        "reference_id" => $referenceId,
        "reference_code" => $referenceCode,
        "module" => $module,
        "details" => $details,
        "is_read" => 0,
        "status" => "Unread"
    ];

    $columns = [];
    $values = [];
    $params = [];

    foreach ($data as $column => $value) {
        if (
            !supplierColumnExists(
                $conn,
                "tbl_notifications",
                $column
            )
        ) {
            continue;
        }

        $placeholder =
            ":notification_" . $column;

        $columns[] = "`{$column}`";
        $values[] = $placeholder;
        $params[$placeholder] = $value;
    }

    if (
        supplierColumnExists(
            $conn,
            "tbl_notifications",
            "created_at"
        )
    ) {
        $columns[] = "`created_at`";
        $values[] = "NOW()";
    }

    if (!$columns) {
        return false;
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_notifications
        (" . implode(", ", $columns) . ")
        VALUES
        (" . implode(", ", $values) . ")
    ");

    $stmt->execute($params);

    return true;
}

function sendSupplierNotificationEmail(
    string $email,
    string $fullName,
    string $title,
    string $message,
    string $type,
    string $referenceCode = "",
    string $details = ""
): bool {
    if (
        $email === "" ||
        !filter_var(
            $email,
            FILTER_VALIDATE_EMAIL
        )
    ) {
        return false;
    }

    $mailerPath =
        __DIR__ .
        "/../config/mailer.php";

    if (!file_exists($mailerPath)) {
        return false;
    }

    require_once($mailerPath);

    if (
        !function_exists(
            "sendNotificationEmail"
        )
    ) {
        return false;
    }

    try {
        return sendNotificationEmail(
            $email,
            $fullName !== ""
                ? $fullName
                : "Supplier",
            $title,
            $message,
            $type,
            $referenceCode,
            $details
        ) === true;
    } catch (Throwable $error) {
        error_log(
            "Supplier email failed: " .
            $error->getMessage()
        );

        return false;
    }
}

/*
|--------------------------------------------------------------------------
| Send Supplier Receipt PNG Attachment
|--------------------------------------------------------------------------
|
| Used by send_payable_receipt_email.php after the frontend captures the
| exact same Supplier Payable Receipt shown by Print Receipt.
|
| This function deliberately sends the PNG after the payment transaction
| has already been saved, so an SMTP failure cannot roll back a payment.
|
*/
function sendSupplierReceiptAttachmentEmail(
    PDO $conn,
    int $vendorId,
    string $receiptPath,
    string $attachmentName,
    string $subject,
    string $message,
    string $referenceCode = "",
    string $paymentStatus = "",
    float $amountPaid = 0.0,
    float $remainingBalance = 0.0
): array {
    $result = [
        "success" => false,
        "email_sent" => false,
        "emails_sent" => 0,
        "recipients" => 0,
        "email_recipient" => null,
        "email_error" => null
    ];

    if (
        $vendorId <= 0 ||
        $receiptPath === "" ||
        !is_file($receiptPath)
    ) {
        $result["email_error"] =
            "The receipt PNG file is not available.";

        return $result;
    }

    $mimeType =
        function_exists("mime_content_type")
            ? (string)mime_content_type(
                $receiptPath
            )
            : "image/png";

    if (
        !in_array(
            $mimeType,
            [
                "image/png",
                "image/x-png"
            ],
            true
        )
    ) {
        $result["email_error"] =
            "The receipt attachment must be a PNG image.";

        return $result;
    }

    $maxBytes = 8 * 1024 * 1024;

    $fileSize = filesize($receiptPath);

    if (
        $fileSize === false ||
        $fileSize <= 0 ||
        $fileSize > $maxBytes
    ) {
        $result["email_error"] =
            "The receipt PNG is empty or exceeds the 8 MB limit.";

        return $result;
    }

    $recipients =
        getSupplierRecipients(
            $conn,
            $vendorId
        );

    $result["recipients"] =
        count($recipients);

    if (!$recipients) {
        $result["email_error"] =
            "No active Supplier account is linked to this supplier.";

        return $result;
    }

    $mailerPath =
        __DIR__ .
        "/../config/mailer.php";

    if (!file_exists($mailerPath)) {
        $result["email_error"] =
            "HiveSync mailer configuration was not found.";

        return $result;
    }

    require_once($mailerPath);

    if (
        !function_exists(
            "createHiveSyncMailer"
        )
    ) {
        $result["email_error"] =
            "The HiveSync mailer is not configured correctly.";

        return $result;
    }

    $safeAttachmentName =
        preg_replace(
            '/[^A-Za-z0-9._-]+/',
            '_',
            trim($attachmentName)
        );

    if (
        !$safeAttachmentName ||
        strtolower(
            pathinfo(
                $safeAttachmentName,
                PATHINFO_EXTENSION
            )
        ) !== "png"
    ) {
        $safeAttachmentName =
            "Supplier_Payable_Receipt.png";
    }

    $lastError = null;

    foreach ($recipients as $recipient) {
        $email =
            strtolower(
                trim(
                    (string)(
                        $recipient["email"] ??
                        ""
                    )
                )
            );

        if (
            $email === "" ||
            !filter_var(
                $email,
                FILTER_VALIDATE_EMAIL
            )
        ) {
            continue;
        }

        $fullName =
            trim(
                (string)(
                    $recipient["full_name"] ??
                    "Supplier"
                )
            );

        if ($fullName === "") {
            $fullName = "Supplier";
        }

        $mail = null;

        try {
            $mail = createHiveSyncMailer();

            $mail->addAddress(
                $email,
                $fullName
            );

            $mail->isHTML(true);

            $mail->Subject =
                $subject !== ""
                    ? $subject
                    : "HiveSync Supplier Payable Receipt";

            $mail->addAttachment(
                $receiptPath,
                $safeAttachmentName,
                "base64",
                "image/png"
            );

            $safeName = htmlspecialchars(
                $fullName,
                ENT_QUOTES,
                "UTF-8"
            );

            $safeMessage = nl2br(
                htmlspecialchars(
                    $message,
                    ENT_QUOTES,
                    "UTF-8"
                )
            );

            $safeReference =
                htmlspecialchars(
                    $referenceCode,
                    ENT_QUOTES,
                    "UTF-8"
                );

            $safeStatus =
                htmlspecialchars(
                    $paymentStatus,
                    ENT_QUOTES,
                    "UTF-8"
                );

            $safePaid =
                number_format(
                    $amountPaid,
                    2
                );

            $safeBalance =
                number_format(
                    $remainingBalance,
                    2
                );

            $mail->Body = "
                <div style=\"
                    font-family: Arial, Helvetica, sans-serif;
                    color: #1f2937;
                    max-width: 680px;
                    margin: 0 auto;
                \">
                    <div style=\"
                        background:#1B2430;
                        color:#ffffff;
                        padding:22px 26px;
                        border-radius:12px 12px 0 0;
                    \">
                        <div style=\"
                            color:#F4B400;
                            font-size:24px;
                            font-weight:800;
                        \">HiveSync</div>
                        <div style=\"
                            margin-top:4px;
                            font-size:13px;
                            opacity:.9;
                        \">BFATC Supplier Payment Receipt</div>
                    </div>

                    <div style=\"
                        border:1px solid #E5E7EB;
                        border-top:0;
                        padding:26px;
                        border-radius:0 0 12px 12px;
                    \">
                        <p>Good day, <strong>{$safeName}</strong>.</p>

                        <p>{$safeMessage}</p>

                        <div style=\"
                            background:#F9FAFB;
                            border:1px solid #E5E7EB;
                            border-radius:10px;
                            padding:16px;
                            margin:18px 0;
                        \">
                            <div>
                                <strong>Reference:</strong>
                                {$safeReference}
                            </div>
                            <div style=\"margin-top:6px;\">
                                <strong>Amount Paid:</strong>
                                ₱{$safePaid}
                            </div>
                            <div style=\"margin-top:6px;\">
                                <strong>Remaining Balance:</strong>
                                ₱{$safeBalance}
                            </div>
                            <div style=\"margin-top:6px;\">
                                <strong>Status:</strong>
                                {$safeStatus}
                            </div>
                        </div>

                        <p>
                            The attached PNG is the Supplier Payable Receipt
                            generated by HiveSync.
                        </p>

                        <p style=\"
                            color:#6B7280;
                            font-size:12px;
                            margin-top:24px;
                        \">
                            Bacnotan Farmers Agri-Tourism Center (BFATC), La Union
                        </p>
                    </div>
                </div>
            ";

            $mail->AltBody =
                "Good day, {$fullName}.\n\n" .
                strip_tags($message) .
                "\n\nReference: " .
                $referenceCode .
                "\nAmount Paid: PHP " .
                number_format(
                    $amountPaid,
                    2
                ) .
                "\nRemaining Balance: PHP " .
                number_format(
                    $remainingBalance,
                    2
                ) .
                "\nStatus: " .
                $paymentStatus .
                "\n\nThe Supplier Payable Receipt PNG is attached.";

            $mail->send();

            $result["emails_sent"]++;
            $result["email_recipient"] =
                $email;
        } catch (Throwable $error) {
            $lastError =
                $error->getMessage();

            error_log(
                "Supplier receipt email failed for {$email}: " .
                $lastError
            );
        }
    }

    $result["email_sent"] =
        $result["emails_sent"] > 0;

    $result["success"] =
        $result["email_sent"];

    if (!$result["email_sent"]) {
        $result["email_error"] =
            $lastError ?:
            "No valid Supplier email recipient was available.";
    }

    return $result;
}

function notifySupplier(
    PDO $conn,
    int $vendorId,
    string $title,
    string $message,
    string $type,
    ?int $referenceId = null,
    ?string $referenceCode = null,
    ?string $module = null,
    ?string $details = null
): array {
    $recipients =
        getSupplierRecipients(
            $conn,
            $vendorId
        );

    $notificationCount = 0;
    $emailCount = 0;

    foreach ($recipients as $recipient) {
        $userId =
            (int)(
                $recipient["user_id"] ?? 0
            );

        $alreadyExists =
            $userId > 0
                ? supplierNotificationAlreadyExists(
                    $conn,
                    $userId,
                    $title,
                    $referenceCode
                )
                : false;

        if ($alreadyExists) {
            continue;
        }

        if ($userId > 0) {
            $created =
                createSupplierNotification(
                    $conn,
                    $userId,
                    $title,
                    $message,
                    $type,
                    $referenceId,
                    $referenceCode,
                    $module,
                    $details
                );

            if ($created) {
                $notificationCount++;
            }
        }

        $email =
            trim(
                (string)(
                    $recipient["email"] ?? ""
                )
            );

        if ($email !== "") {
            $sent =
                sendSupplierNotificationEmail(
                    $email,
                    trim(
                        (string)(
                            $recipient["full_name"] ??
                            ""
                        )
                    ),
                    $title,
                    $message,
                    $type,
                    $referenceCode ?? "",
                    $details ?? ""
                );

            if ($sent) {
                $emailCount++;
            }
        }
    }

    return [
        "recipients" =>
            count($recipients),

        "notifications_sent" =>
            $notificationCount,

        "emails_sent" =>
            $emailCount,

        "notification_sent" =>
            $notificationCount > 0,

        "email_sent" =>
            $emailCount > 0
    ];
}
