<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . "/../vendor/autoload.php";



define(
    "MAIL_USERNAME",
    "hivesyncbfatc@gmail.com"
);

define(
    "MAIL_APP_PASSWORD",
    "byls ximt isdk nsse"
);


$GLOBALS["HIVESYNC_LAST_MAIL_ERROR"] = "";

function setLastMailError(
    string $message
): void {
    $GLOBALS["HIVESYNC_LAST_MAIL_ERROR"] =
        trim($message);
}

function getLastMailError(): string
{
    return trim(
        $GLOBALS["HIVESYNC_LAST_MAIL_ERROR"] ?? ""
    );
}

function createHiveSyncMailer(): PHPMailer
{
    $username = trim(MAIL_USERNAME);

    $appPassword = preg_replace(
        "/\s+/",
        "",
        trim(MAIL_APP_PASSWORD)
    );

    if ($username === "") {
        throw new Exception(
            "HiveSync sender email is not configured."
        );
    }

    if (
        $appPassword === "" ||
        $appPassword ===
            "REPLACE_WITH_NEW_16_CHARACTER_APP_PASSWORD"
    ) {
        throw new Exception(
            "HiveSync Gmail App Password is not configured."
        );
    }

    if (
        !filter_var(
            $username,
            FILTER_VALIDATE_EMAIL
        )
    ) {
        throw new Exception(
            "HiveSync sender email is invalid."
        );
    }

    $mail = new PHPMailer(true);

    $mail->isSMTP();

    $mail->SMTPOptions = [
        "ssl" => [
            "verify_peer" => false,
            "verify_peer_name" => false,
            "allow_self_signed" => true
        ]
    ];

    $mail->Host = "smtp.gmail.com";
    $mail->SMTPAuth = true;
    $mail->Username = $username;
    $mail->Password = $appPassword;

    $mail->SMTPSecure =
        PHPMailer::ENCRYPTION_STARTTLS;

    $mail->Port = 587;

    $mail->CharSet = "UTF-8";
    $mail->Encoding = "base64";

    $mail->Timeout = 8;


    $mail->SMTPDebug = 0;

    

    $mail->SMTPKeepAlive = false;
    $mail->Sender = $username;

    $mail->setFrom(
        $username,
        "HiveSync"
    );

    $mail->addReplyTo(
        $username,
        "HiveSync"
    );

    return $mail;
}


function resolveMailerError(
    Throwable $exception,
    ?PHPMailer $mail = null
): string {
    $message = trim(
        $exception->getMessage()
    );

    if (
        $mail instanceof PHPMailer &&
        trim($mail->ErrorInfo) !== ""
    ) {
        $message = trim(
            $mail->ErrorInfo
        );
    }

    if ($message === "") {
        $message =
            "The email server did not return a detailed error.";
    }

    setLastMailError($message);

    return $message;
}


function sendAccountCredentials(
    string $toEmail,
    string $fullName,
    string $role,
    string $position,
    string $temporaryPassword
): array {
    setLastMailError("");

    $mail = null;

    try {
        $toEmail = strtolower(
            trim($toEmail)
        );

        $fullName = trim($fullName);
        $role = trim($role);
        $position = trim($position);

        if (
            !filter_var(
                $toEmail,
                FILTER_VALIDATE_EMAIL
            )
        ) {
            $message =
                "The recipient email address is invalid.";

            setLastMailError($message);

            return [
                "success" => false,
                "message" => $message
            ];
        }

        if ($fullName === "") {
            $fullName = "HiveSync User";
        }

        $mail = createHiveSyncMailer();

        $mail->addAddress(
            $toEmail,
            $fullName
        );

        $mail->isHTML(true);

        $mail->Subject =
            "HiveSync Account Credentials";

        $safeName = htmlspecialchars(
            $fullName,
            ENT_QUOTES,
            "UTF-8"
        );

        $safeEmail = htmlspecialchars(
            $toEmail,
            ENT_QUOTES,
            "UTF-8"
        );

        $safePassword = htmlspecialchars(
            $temporaryPassword,
            ENT_QUOTES,
            "UTF-8"
        );

        $safeRole = htmlspecialchars(
            $role,
            ENT_QUOTES,
            "UTF-8"
        );

        $safePosition = htmlspecialchars(
            $position,
            ENT_QUOTES,
            "UTF-8"
        );

        $mail->Body = "
            <div style=\"
                max-width: 620px;
                margin: 24px auto;
                overflow: hidden;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 16px;
                font-family: Arial, Helvetica, sans-serif;
                color: #111827;
            \">
                <div style=\"
                    padding: 24px 28px;
                    background: #1b2430;
                    color: #ffffff;
                \">
                    <h1 style=\"
                        margin: 0;
                        color: #f4b400;
                        font-size: 25px;
                    \">
                        HiveSync
                    </h1>

                    <p style=\"
                        margin: 7px 0 0;
                        color: #e5e7eb;
                        font-size: 14px;
                    \">
                        Integrated Business and Operations
                        Management System
                    </p>
                </div>

                <div style=\"padding: 28px;\">
                    <h2 style=\"
                        margin: 0 0 18px;
                        color: #111827;
                        font-size: 21px;
                    \">
                        Account Created Successfully
                    </h2>

                    <p style=\"
                        margin: 0 0 14px;
                        line-height: 1.6;
                    \">
                        Good day,
                        <strong>{$safeName}</strong>.
                    </p>

                    <p style=\"
                        margin: 0;
                        line-height: 1.6;
                        color: #475569;
                    \">
                        Your HiveSync account has been created.
                        Use the credentials below to sign in.
                    </p>

                    <div style=\"
                        margin: 22px 0;
                        padding: 18px;
                        background: #f8fafc;
                        border: 1px solid #e5e7eb;
                        border-radius: 12px;
                    \">
                        <table style=\"
                            width: 100%;
                            border-collapse: collapse;
                        \">
                            <tr>
                                <td style=\"
                                    padding: 9px 0;
                                    color: #64748b;
                                \">
                                    Email
                                </td>

                                <td style=\"
                                    padding: 9px 0;
                                    text-align: right;
                                    font-weight: 700;
                                \">
                                    {$safeEmail}
                                </td>
                            </tr>

                            <tr>
                                <td style=\"
                                    padding: 9px 0;
                                    color: #64748b;
                                \">
                                    Temporary Password
                                </td>

                                <td style=\"
                                    padding: 9px 0;
                                    text-align: right;
                                    font-weight: 700;
                                \">
                                    {$safePassword}
                                </td>
                            </tr>

                            <tr>
                                <td style=\"
                                    padding: 9px 0;
                                    color: #64748b;
                                \">
                                    Role
                                </td>

                                <td style=\"
                                    padding: 9px 0;
                                    text-align: right;
                                    font-weight: 700;
                                \">
                                    {$safeRole}
                                </td>
                            </tr>

                            <tr>
                                <td style=\"
                                    padding: 9px 0;
                                    color: #64748b;
                                \">
                                    Position
                                </td>

                                <td style=\"
                                    padding: 9px 0;
                                    text-align: right;
                                    font-weight: 700;
                                \">
                                    {$safePosition}
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div style=\"
                        padding: 15px;
                        background: #fffbeb;
                        border: 1px solid #f4b400;
                        border-radius: 11px;
                        color: #7c5c00;
                        line-height: 1.55;
                    \">
                        For security, you must change the
                        temporary password after your first login.
                    </div>

                    <p style=\"
                        margin: 26px 0 0;
                        color: #64748b;
                        line-height: 1.6;
                    \">
                        Thank you,<br>
                        <strong style=\"color: #111827;\">
                            HiveSync
                        </strong>
                    </p>
                </div>
            </div>
        ";

        $mail->AltBody =
            "HiveSync Account Created\n\n" .
            "Good day, {$fullName}.\n\n" .
            "Your HiveSync account has been created.\n\n" .
            "Email: {$toEmail}\n" .
            "Temporary Password: {$temporaryPassword}\n" .
            "Role: {$role}\n" .
            "Position: {$position}\n\n" .
            "You must change your temporary password " .
            "after your first login.\n\n" .
            "Thank you,\nHiveSync";

        $mail->send();

        return [
            "success" => true,
            "message" =>
                "Account credentials were sent successfully."
        ];
    } catch (Throwable $exception) {
        $errorMessage = resolveMailerError(
            $exception,
            $mail
        );

        error_log(
            "HiveSync account email failed: " .
            $errorMessage
        );

        return [
            "success" => false,
            "message" => $errorMessage
        ];
    }
}



function sendNotificationEmail(
    string $toEmail,
    string $recipientName,
    string $title,
    string $message,
    string $type = "System",
    string $referenceCode = "",
    string $details = ""
): bool {
    setLastMailError("");

    $mail = null;

    try {
        $toEmail = strtolower(
            trim($toEmail)
        );

        $recipientName = trim(
            $recipientName
        );

        if (
            !filter_var(
                $toEmail,
                FILTER_VALIDATE_EMAIL
            )
        ) {
            setLastMailError(
                "The recipient email address is invalid."
            );

            return false;
        }

        if ($recipientName === "") {
            $recipientName = "HiveSync User";
        }

        $mail = createHiveSyncMailer();

        $mail->addAddress(
            $toEmail,
            $recipientName
        );

        $mail->isHTML(true);

        $mail->Subject =
            "HiveSync Notification: {$title}";

        $safeName = htmlspecialchars(
            $recipientName,
            ENT_QUOTES,
            "UTF-8"
        );

        $safeTitle = htmlspecialchars(
            $title,
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

        $safeType = htmlspecialchars(
            $type,
            ENT_QUOTES,
            "UTF-8"
        );

        $safeReference = htmlspecialchars(
            $referenceCode,
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

        $referenceSection = "";

        if ($referenceCode !== "") {
            $referenceSection = "
                <div style=\"
                    margin-top: 16px;
                    padding: 13px 15px;
                    background: #fff7df;
                    border: 1px solid #f4b400;
                    border-radius: 10px;
                \">
                    <strong>Reference:</strong>
                    {$safeReference}
                </div>
            ";
        }

        $detailsSection = "";

        if ($details !== "") {
            $detailsSection = "
                <div style=\"
                    margin-top: 16px;
                    padding: 16px;
                    background: #f8fafc;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                \">
                    <strong>Additional Details</strong>

                    <p style=\"
                        margin: 9px 0 0;
                        color: #475569;
                        line-height: 1.65;
                    \">
                        {$safeDetails}
                    </p>
                </div>
            ";
        }

        $mail->Body = "
            <div style=\"
                max-width: 620px;
                margin: 24px auto;
                overflow: hidden;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 16px;
                font-family: Arial, Helvetica, sans-serif;
                color: #111827;
            \">
                <div style=\"
                    padding: 24px 28px;
                    background: #1b2430;
                    color: #ffffff;
                \">
                    <h1 style=\"
                        margin: 0;
                        color: #f4b400;
                        font-size: 25px;
                    \">
                        HiveSync
                    </h1>

                    <p style=\"
                        margin: 7px 0 0;
                        color: #e5e7eb;
                    \">
                        {$safeType} Notification
                    </p>
                </div>

                <div style=\"padding: 28px;\">
                    <p style=\"
                        margin: 0 0 16px;
                        line-height: 1.6;
                    \">
                        Good day,
                        <strong>{$safeName}</strong>.
                    </p>

                    <h2 style=\"
                        margin: 0 0 14px;
                        font-size: 21px;
                    \">
                        {$safeTitle}
                    </h2>

                    <p style=\"
                        margin: 0;
                        color: #475569;
                        line-height: 1.65;
                    \">
                        {$safeMessage}
                    </p>

                    {$referenceSection}
                    {$detailsSection}

                    <p style=\"
                        margin: 26px 0 0;
                        color: #64748b;
                        line-height: 1.6;
                    \">
                        Thank you,<br>
                        <strong style=\"color: #111827;\">
                            HiveSync
                        </strong>
                    </p>
                </div>
            </div>
        ";

        $mail->AltBody =
            "HiveSync {$type} Notification\n\n" .
            "Good day, {$recipientName}.\n\n" .
            "{$title}\n\n" .
            "{$message}\n" .
            (
                $referenceCode !== ""
                    ? "\nReference: {$referenceCode}\n"
                    : ""
            ) .
            (
                $details !== ""
                    ? "\nAdditional Details:\n{$details}\n"
                    : ""
            ) .
            "\nThank you,\nHiveSync";

        $mail->send();

        return true;
    } catch (Throwable $exception) {
        $errorMessage = resolveMailerError(
            $exception,
            $mail
        );

        error_log(
            "HiveSync notification email failed: " .
            $errorMessage
        );

        return false;
    }
}



function sendSupplierPaymentReceiptEmail(
    string $toEmail,
    string $supplierName,
    array $receipt
): array {
    setLastMailError("");

    $mail = null;

    try {
        $toEmail = strtolower(trim($toEmail));
        $supplierName = trim($supplierName);

        if (!filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
            $message = "The supplier registered email address is invalid.";
            setLastMailError($message);

            return [
                "success" => false,
                "message" => $message
            ];
        }

        if ($supplierName === "") {
            $supplierName = "Supplier";
        }

        $paymentNo = trim((string)($receipt["payment_no"] ?? ""));
        $remittanceNo = trim((string)($receipt["remittance_order_no"] ?? ""));
        $deliveryNo = trim((string)($receipt["delivery_order_no"] ?? ""));
        $paymentDate = trim((string)($receipt["payment_date"] ?? ""));
        $paymentMethod = trim((string)($receipt["payment_method"] ?? ""));
        $referenceNumber = trim((string)($receipt["reference_number"] ?? ""));
        $receivedBy = trim((string)($receipt["received_by"] ?? ""));
        $processedBy = trim((string)($receipt["processed_by"] ?? ""));
        $remarks = trim((string)($receipt["remarks"] ?? ""));
        $paymentStatus = trim((string)($receipt["payment_status"] ?? ""));

        $amountPaid = (float)($receipt["amount_paid"] ?? 0);
        $totalPaid = (float)($receipt["total_paid"] ?? 0);
        $remainingBalance = (float)($receipt["remaining_balance"] ?? 0);
        $payableAmount = (float)($receipt["payable_amount"] ?? 0);

        $safeSupplierName = htmlspecialchars(
            $supplierName,
            ENT_QUOTES,
            "UTF-8"
        );

        $safePaymentNo = htmlspecialchars(
            $paymentNo !== "" ? $paymentNo : "N/A",
            ENT_QUOTES,
            "UTF-8"
        );

        $safeRemittanceNo = htmlspecialchars(
            $remittanceNo !== "" ? $remittanceNo : "N/A",
            ENT_QUOTES,
            "UTF-8"
        );

        $safeDeliveryNo = htmlspecialchars(
            $deliveryNo !== "" ? $deliveryNo : "N/A",
            ENT_QUOTES,
            "UTF-8"
        );

        $safePaymentDate = htmlspecialchars(
            $paymentDate !== "" ? $paymentDate : "N/A",
            ENT_QUOTES,
            "UTF-8"
        );

        $safePaymentMethod = htmlspecialchars(
            $paymentMethod !== "" ? $paymentMethod : "N/A",
            ENT_QUOTES,
            "UTF-8"
        );

        $safeReferenceNumber = htmlspecialchars(
            $referenceNumber !== "" ? $referenceNumber : "N/A",
            ENT_QUOTES,
            "UTF-8"
        );

        $safeReceivedBy = htmlspecialchars(
            $receivedBy !== "" ? $receivedBy : "Not provided",
            ENT_QUOTES,
            "UTF-8"
        );

        $safeProcessedBy = htmlspecialchars(
            $processedBy !== "" ? $processedBy : "System User",
            ENT_QUOTES,
            "UTF-8"
        );

        $safePaymentStatus = htmlspecialchars(
            $paymentStatus !== "" ? $paymentStatus : "Recorded",
            ENT_QUOTES,
            "UTF-8"
        );

        $safeRemarks = nl2br(
            htmlspecialchars(
                $remarks,
                ENT_QUOTES,
                "UTF-8"
            )
        );

        $amountPaidText = number_format($amountPaid, 2);
        $payableAmountText = number_format($payableAmount, 2);
        $totalPaidText = number_format($totalPaid, 2);
        $remainingBalanceText = number_format($remainingBalance, 2);

        $remarksSection = "";

        if ($remarks !== "") {
            $remarksSection = "
                <div style=\"
                    margin-top: 18px;
                    padding: 14px 16px;
                    background: #f8fafc;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                \">
                    <div style=\"
                        margin-bottom: 6px;
                        color: #64748b;
                        font-size: 12px;
                        font-weight: 700;
                        text-transform: uppercase;
                    \">
                        Remarks
                    </div>

                    <div style=\"
                        color: #334155;
                        font-size: 14px;
                        line-height: 1.6;
                    \">
                        {$safeRemarks}
                    </div>
                </div>
            ";
        }

        $mail = createHiveSyncMailer();

        $mail->addAddress(
            $toEmail,
            $supplierName
        );

        $mail->isHTML(true);

        $mail->Subject =
            "HiveSync Supplier Payment Receipt - " .
            ($paymentNo !== "" ? $paymentNo : "Payment");

        $mail->Body = "
            <div style=\"
                max-width: 650px;
                margin: 24px auto;
                overflow: hidden;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 16px;
                font-family: Arial, Helvetica, sans-serif;
                color: #111827;
            \">
                <div style=\"
                    padding: 24px 28px;
                    background: #1b2430;
                    color: #ffffff;
                \">
                    <div style=\"
                        color: #f4b400;
                        font-size: 26px;
                        font-weight: 800;
                    \">
                        HiveSync
                    </div>

                    <div style=\"
                        margin-top: 5px;
                        color: #e5e7eb;
                        font-size: 13px;
                    \">
                        Bacnotan Farmers Agri-Tourism Center (BFATC), La Union
                    </div>
                </div>

                <div style=\"padding: 28px;\">
                    <div style=\"
                        margin-bottom: 6px;
                        color: #9a6d00;
                        font-size: 12px;
                        font-weight: 800;
                        letter-spacing: .08em;
                        text-transform: uppercase;
                    \">
                        Supplier Payment Receipt
                    </div>

                    <h2 style=\"
                        margin: 0 0 8px;
                        font-size: 22px;
                        color: #111827;
                    \">
                        Payment Recorded Successfully
                    </h2>

                    <p style=\"
                        margin: 0 0 22px;
                        color: #475569;
                        line-height: 1.65;
                    \">
                        Good day, <strong>{$safeSupplierName}</strong>.
                        BFATC has recorded the supplier payment shown below.
                        Please keep this email as your payment receipt.
                    </p>

                    <div style=\"
                        margin-bottom: 18px;
                        padding: 18px;
                        background: #fff8dc;
                        border: 1px solid #f4b400;
                        border-radius: 12px;
                    \">
                        <div style=\"
                            color: #7c5c00;
                            font-size: 12px;
                            font-weight: 700;
                            text-transform: uppercase;
                        \">
                            Amount Paid
                        </div>

                        <div style=\"
                            margin-top: 5px;
                            color: #111827;
                            font-size: 28px;
                            font-weight: 800;
                        \">
                            ₱{$amountPaidText}
                        </div>
                    </div>

                    <table style=\"
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 14px;
                    \">
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Payment No.</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">{$safePaymentNo}</td>
                        </tr>
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Delivery</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">{$safeDeliveryNo}</td>
                        </tr>
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Remittance</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">{$safeRemittanceNo}</td>
                        </tr>
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Original Payable</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">₱{$payableAmountText}</td>
                        </tr>
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Total Paid to Date</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">₱{$totalPaidText}</td>
                        </tr>
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Remaining Balance</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">₱{$remainingBalanceText}</td>
                        </tr>
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Payment Status</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">{$safePaymentStatus}</td>
                        </tr>
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Payment Date</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">{$safePaymentDate}</td>
                        </tr>
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Payment Method</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">{$safePaymentMethod}</td>
                        </tr>
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Reference No.</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">{$safeReferenceNumber}</td>
                        </tr>
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Received By</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">{$safeReceivedBy}</td>
                        </tr>
                        <tr>
                            <td style=\"padding: 9px 0; color: #64748b;\">Processed By</td>
                            <td style=\"padding: 9px 0; text-align: right; font-weight: 700;\">{$safeProcessedBy}</td>
                        </tr>
                    </table>

                    {$remarksSection}

                    <div style=\"
                        margin-top: 24px;
                        padding-top: 18px;
                        border-top: 1px solid #e5e7eb;
                        color: #64748b;
                        font-size: 12px;
                        line-height: 1.6;
                    \">
                        This is an electronically generated HiveSync supplier
                        payment receipt. No signature is required.
                    </div>

                    <p style=\"
                        margin: 22px 0 0;
                        color: #64748b;
                        line-height: 1.6;
                    \">
                        Thank you,<br>
                        <strong style=\"color: #111827;\">BFATC / HiveSync</strong>
                    </p>
                </div>
            </div>
        ";

        $mail->AltBody =
            "HIVESYNC - SUPPLIER PAYMENT RECEIPT\n\n" .
            "Supplier: {$supplierName}\n" .
            "Payment No.: " . ($paymentNo !== "" ? $paymentNo : "N/A") . "\n" .
            "Delivery: " . ($deliveryNo !== "" ? $deliveryNo : "N/A") . "\n" .
            "Remittance: " . ($remittanceNo !== "" ? $remittanceNo : "N/A") . "\n" .
            "Amount Paid: ₱{$amountPaidText}\n" .
            "Original Payable: ₱{$payableAmountText}\n" .
            "Total Paid to Date: ₱{$totalPaidText}\n" .
            "Remaining Balance: ₱{$remainingBalanceText}\n" .
            "Status: " . ($paymentStatus !== "" ? $paymentStatus : "Recorded") . "\n" .
            "Payment Date: " . ($paymentDate !== "" ? $paymentDate : "N/A") . "\n" .
            "Payment Method: " . ($paymentMethod !== "" ? $paymentMethod : "N/A") . "\n" .
            "Reference No.: " . ($referenceNumber !== "" ? $referenceNumber : "N/A") . "\n" .
            "Received By: " . ($receivedBy !== "" ? $receivedBy : "Not provided") . "\n" .
            "Processed By: " . ($processedBy !== "" ? $processedBy : "System User") .
            ($remarks !== "" ? "\nRemarks: {$remarks}" : "") .
            "\n\nThis is an electronically generated HiveSync supplier payment receipt.";

        $mail->send();

        return [
            "success" => true,
            "message" => "Supplier payment receipt sent successfully."
        ];
    } catch (Throwable $exception) {
        $errorMessage = resolveMailerError(
            $exception,
            $mail
        );

        error_log(
            "HiveSync supplier payment receipt email failed: " .
            $errorMessage
        );

        return [
            "success" => false,
            "message" => $errorMessage
        ];
    }
}