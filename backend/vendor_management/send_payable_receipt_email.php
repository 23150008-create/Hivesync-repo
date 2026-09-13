<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("../helpers/supplier_communication.php");

requireModulePermission("vendors");
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
    respond(false, "Only POST requests are allowed.", [], 405);
}

$vendorId = filter_var(
    $_POST["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

$referenceCode = trim((string)($_POST["reference_code"] ?? ""));
$paymentStatus = trim((string)($_POST["payment_status"] ?? ""));
$subject = trim((string)($_POST["subject"] ?? ""));
$message = trim((string)($_POST["message"] ?? ""));

$amountPaid = filter_var(
    $_POST["amount_paid"] ?? 0,
    FILTER_VALIDATE_FLOAT
);

$remainingBalance = filter_var(
    $_POST["remaining_balance"] ?? 0,
    FILTER_VALIDATE_FLOAT
);

if (!$vendorId) {
    respond(false, "A valid supplier ID is required.", [], 422);
}

if ($referenceCode === "") {
    respond(false, "A receipt reference is required.", [], 422);
}

if (!isset($_FILES["receipt_png"])) {
    respond(false, "The receipt PNG attachment is required.", [], 422);
}

$upload = $_FILES["receipt_png"];

if (
    !is_array($upload) ||
    !isset($upload["tmp_name"], $upload["error"], $upload["size"])
) {
    respond(false, "The receipt upload is invalid.", [], 422);
}

if ((int)$upload["error"] !== UPLOAD_ERR_OK) {
    respond(false, "The receipt PNG could not be uploaded.", [], 422);
}

$maxBytes = 8 * 1024 * 1024;

if (
    (int)$upload["size"] <= 0 ||
    (int)$upload["size"] > $maxBytes
) {
    respond(
        false,
        "The receipt PNG is empty or exceeds the 8 MB limit.",
        [],
        422
    );
}

$tmpName = (string)$upload["tmp_name"];

if ($tmpName === "" || !is_uploaded_file($tmpName)) {
    respond(false, "The uploaded receipt file is invalid.", [], 422);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = (string)$finfo->file($tmpName);

if (
    !in_array(
        $mimeType,
        ["image/png", "image/x-png"],
        true
    )
) {
    respond(false, "Only PNG receipt attachments are allowed.", [], 422);
}

$safeReference = preg_replace(
    '/[^A-Za-z0-9._-]+/',
    '_',
    $referenceCode
);

if (!$safeReference || trim($safeReference, "_") === "") {
    $safeReference = "Receipt";
}

$attachmentName =
    "Supplier_Payable_Receipt_" .
    $safeReference .
    ".png";

if ($subject === "") {
    $subject =
        "BFATC Supplier Payable Receipt - " .
        $referenceCode;
}

if ($message === "") {
    $message =
        "BFATC has recorded your supplier payment. " .
        "The official HiveSync Supplier Payable Receipt is attached as a PNG image.";
}

$amountPaid =
    $amountPaid !== false
        ? (float)$amountPaid
        : 0.0;

$remainingBalance =
    $remainingBalance !== false
        ? (float)$remainingBalance
        : 0.0;

try {
    $result =
        sendSupplierReceiptAttachmentEmail(
            $conn,
            (int)$vendorId,
            $tmpName,
            $attachmentName,
            $subject,
            $message,
            $referenceCode,
            $paymentStatus,
            $amountPaid,
            $remainingBalance
        );

    if (!($result["email_sent"] ?? false)) {
        respond(
            false,
            "The payment was saved, but the receipt email could not be sent.",
            [
                "email_sent" => false,
                "email_recipient" =>
                    $result["email_recipient"] ?? null,
                "email_error" =>
                    "Email delivery failed.",
                "emails_sent" =>
                    (int)($result["emails_sent"] ?? 0),
                "recipients" =>
                    (int)($result["recipients"] ?? 0)
            ],
            422
        );
    }

    respond(
        true,
        "Supplier payable receipt emailed successfully.",
        [
            "email_sent" => true,
            "email_recipient" =>
                $result["email_recipient"] ?? null,
            "emails_sent" =>
                (int)($result["emails_sent"] ?? 0),
            "recipients" =>
                (int)($result["recipients"] ?? 0),
            "attachment_name" =>
                $attachmentName
        ]
    );
} catch (Throwable $error) {
    error_log(
        "send_payable_receipt_email.php: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to send the supplier payable receipt email.",
        [
            "email_sent" => false,
            "email_error" =>
                "Email delivery failed."
        ],
        500
    );
}
