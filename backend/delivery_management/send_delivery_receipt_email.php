<?php

declare(strict_types=1);

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("../helpers/supplier_communication.php");


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

$deliveryId = filter_var(
    $_POST["delivery_id"] ?? null,
    FILTER_VALIDATE_INT
);

$referenceCode = trim(
    (string)(
        $_POST["reference_code"] ?? ""
    )
);

$preparedBy = trim(
    (string)(
        $_POST["prepared_by"] ?? "System User"
    )
);

$subject = trim(
    (string)(
        $_POST["subject"] ?? ""
    )
);

$message = trim(
    (string)(
        $_POST["message"] ?? ""
    )
);

if (!$deliveryId) {
    respond(
        false,
        "A valid delivery ID is required.",
        [],
        422
    );
}

if (!isset($_FILES["receipt_png"])) {
    respond(
        false,
        "The Delivery Receipt PNG attachment is required.",
        [],
        422
    );
}

$upload = $_FILES["receipt_png"];

if (
    !is_array($upload) ||
    !isset(
        $upload["tmp_name"],
        $upload["error"],
        $upload["size"]
    )
) {
    respond(
        false,
        "The Delivery Receipt upload is invalid.",
        [],
        422
    );
}

if (
    (int)$upload["error"] !==
    UPLOAD_ERR_OK
) {
    respond(
        false,
        "The Delivery Receipt PNG could not be uploaded.",
        [
            "upload_error" =>
                (int)$upload["error"]
        ],
        422
    );
}

$maxBytes = 8 * 1024 * 1024;

if (
    (int)$upload["size"] <= 0 ||
    (int)$upload["size"] > $maxBytes
) {
    respond(
        false,
        "The Delivery Receipt PNG is empty or exceeds the 8 MB limit.",
        [],
        422
    );
}

$tmpName = (string)$upload["tmp_name"];

if (
    $tmpName === "" ||
    !is_uploaded_file($tmpName)
) {
    respond(
        false,
        "The uploaded Delivery Receipt file is invalid.",
        [],
        422
    );
}

$finfo = new finfo(FILEINFO_MIME_TYPE);

$mimeType = (string)$finfo->file(
    $tmpName
);

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
    respond(
        false,
        "Only PNG Delivery Receipt attachments are allowed.",
        [
            "detected_type" =>
                $mimeType
        ],
        422
    );
}

try {
    $deliveryStmt = $conn->prepare("
        SELECT
            d.delivery_id,
            d.delivery_order_no,
            d.vendor_id,
            d.delivery_date,
            d.status,
            v.vendor_name
        FROM tbl_delivery d
        INNER JOIN tbl_vendor v
            ON v.vendor_id = d.vendor_id
        WHERE d.delivery_id = :delivery_id
        LIMIT 1
    ");

    $deliveryStmt->execute([
        ":delivery_id" =>
            (int)$deliveryId
    ]);

    $delivery =
        $deliveryStmt->fetch(
            PDO::FETCH_ASSOC
        );

    if (!$delivery) {
        respond(
            false,
            "The delivery record could not be found.",
            [],
            404
        );
    }

    if (
        strcasecmp(
            trim(
                (string)(
                    $delivery["status"] ?? ""
                )
            ),
            "Delivered"
        ) !== 0
    ) {
        respond(
            false,
            "The Delivery Receipt can only be emailed after the delivery is received.",
            [
                "delivery_status" =>
                    $delivery["status"] ?? null
            ],
            422
        );
    }

    $vendorId =
        (int)(
            $delivery["vendor_id"] ?? 0
        );

    if ($vendorId <= 0) {
        respond(
            false,
            "This delivery is not linked to a supplier.",
            [],
            422
        );
    }

    if ($referenceCode === "") {
        $referenceCode =
            trim(
                (string)(
                    $delivery[
                        "delivery_order_no"
                    ] ?? ""
                )
            );
    }

    if ($referenceCode === "") {
        $referenceCode =
            "DEL-" .
            str_pad(
                (string)$deliveryId,
                5,
                "0",
                STR_PAD_LEFT
            );
    }

    $recipients =
        getSupplierRecipients(
            $conn,
            $vendorId
        );

    if (!$recipients) {
        respond(
            false,
            "No active Supplier account is linked to this delivery.",
            [
                "vendor_id" =>
                    $vendorId
            ],
            422
        );
    }

    $mailerPath =
        __DIR__ .
        "/../config/mailer.php";

    if (!file_exists($mailerPath)) {
        respond(
            false,
            "HiveSync mailer configuration was not found.",
            [],
            500
        );
    }

    require_once($mailerPath);

    if (
        !function_exists(
            "createHiveSyncMailer"
        )
    ) {
        respond(
            false,
            "The HiveSync mailer is not configured correctly.",
            [],
            500
        );
    }

    $safeReference = preg_replace(
        '/[^A-Za-z0-9._-]+/',
        '_',
        $referenceCode
    );

    if (
        !$safeReference ||
        trim($safeReference, "_") === ""
    ) {
        $safeReference = "Delivery";
    }

    $attachmentName =
        "Delivery_Receipt_" .
        $safeReference .
        ".png";

    if ($subject === "") {
        $subject =
            "BFATC Delivery Receipt - " .
            $referenceCode;
    }

    if ($message === "") {
        $message =
            "BFATC has successfully received and recorded your delivery. " .
            "The official HiveSync Delivery Receipt is attached as a PNG image.";
    }

    $emailsSent = 0;
    $emailRecipient = null;
    $lastError = null;

    foreach ($recipients as $recipient) {
        $email =
            trim(
                (string)(
                    $recipient["email"] ?? ""
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
                    $delivery["vendor_name"] ??
                    "Supplier"
                )
            );

        if ($fullName === "") {
            $fullName =
                (string)(
                    $delivery["vendor_name"] ??
                    "Supplier"
                );
        }

        try {
            $mail =
                createHiveSyncMailer();

            $mail->addAddress(
                $email,
                $fullName
            );

            $mail->isHTML(true);

            $mail->Subject =
                $subject;

            $mail->addAttachment(
                $tmpName,
                $attachmentName,
                "base64",
                "image/png"
            );

            $safeName =
                htmlspecialchars(
                    $fullName,
                    ENT_QUOTES,
                    "UTF-8"
                );

            $safeMessage =
                nl2br(
                    htmlspecialchars(
                        $message,
                        ENT_QUOTES,
                        "UTF-8"
                    )
                );

            $safeReferenceHtml =
                htmlspecialchars(
                    $referenceCode,
                    ENT_QUOTES,
                    "UTF-8"
                );

            $safePreparedBy =
                htmlspecialchars(
                    $preparedBy !== ""
                        ? $preparedBy
                        : "System User",
                    ENT_QUOTES,
                    "UTF-8"
                );

            $deliveryDate =
                trim(
                    (string)(
                        $delivery[
                            "delivery_date"
                        ] ?? ""
                    )
                );

            $safeDeliveryDate =
                htmlspecialchars(
                    $deliveryDate !== ""
                        ? date(
                            "M d, Y",
                            strtotime(
                                $deliveryDate
                            )
                        )
                        : "Not specified",
                    ENT_QUOTES,
                    "UTF-8"
                );

            $mail->Body = "
                <div style=\"
                    font-family:Arial,Helvetica,sans-serif;
                    color:#1f2937;
                    max-width:680px;
                    margin:0 auto;
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
                        \">
                            BFATC Delivery Receipt
                        </div>
                    </div>

                    <div style=\"
                        border:1px solid #E5E7EB;
                        border-top:0;
                        padding:26px;
                        border-radius:0 0 12px 12px;
                    \">
                        <p>
                            Good day,
                            <strong>{$safeName}</strong>.
                        </p>

                        <p>{$safeMessage}</p>

                        <div style=\"
                            background:#F9FAFB;
                            border:1px solid #E5E7EB;
                            border-radius:10px;
                            padding:16px;
                            margin:18px 0;
                        \">
                            <div>
                                <strong>Delivery:</strong>
                                {$safeReferenceHtml}
                            </div>

                            <div style=\"margin-top:6px;\">
                                <strong>Delivery Date:</strong>
                                {$safeDeliveryDate}
                            </div>

                            <div style=\"margin-top:6px;\">
                                <strong>Status:</strong>
                                Delivered
                            </div>

                            <div style=\"margin-top:6px;\">
                                <strong>Received / Processed By:</strong>
                                {$safePreparedBy}
                            </div>
                        </div>

                        <p>
                            The attached PNG is the official
                            Delivery Receipt generated by HiveSync.
                        </p>

                        <p style=\"
                            color:#6B7280;
                            font-size:12px;
                            margin-top:24px;
                        \">
                            Bacnotan Farmers Agri-Tourism Center
                            (BFATC), La Union
                        </p>
                    </div>
                </div>
            ";

            $mail->AltBody =
                "Good day, {$fullName}.\n\n" .
                strip_tags($message) .
                "\n\nDelivery: " .
                $referenceCode .
                "\nDelivery Date: " .
                (
                    $deliveryDate !== ""
                        ? date(
                            "M d, Y",
                            strtotime(
                                $deliveryDate
                            )
                        )
                        : "Not specified"
                ) .
                "\nStatus: Delivered" .
                "\nReceived / Processed By: " .
                (
                    $preparedBy !== ""
                        ? $preparedBy
                        : "System User"
                ) .
                "\n\nThe official HiveSync Delivery Receipt PNG is attached.";

            $mail->send();

            $emailsSent++;
            $emailRecipient =
                $email;
        } catch (Throwable $mailError) {
            $lastError =
                $mailError->getMessage();

            error_log(
                "Delivery receipt email failed for {$email}: " .
                $lastError
            );
        }
    }

    if ($emailsSent <= 0) {
        respond(
            false,
            "The delivery was received, but the Delivery Receipt email could not be sent.",
            [
                "email_sent" => false,
                "email_recipient" =>
                    $emailRecipient,
                "email_error" =>
                    $lastError ?:
                    "No valid Supplier email recipient was available.",
                "emails_sent" => 0,
                "recipients" =>
                    count($recipients)
            ],
            422
        );
    }

    respond(
        true,
        "Delivery Receipt emailed successfully.",
        [
            "email_sent" => true,
            "email_recipient" =>
                $emailRecipient,
            "emails_sent" =>
                $emailsSent,
            "recipients" =>
                count($recipients),
            "delivery_id" =>
                (int)$deliveryId,
            "reference_code" =>
                $referenceCode,
            "attachment_name" =>
                $attachmentName
        ]
    );
} catch (Throwable $error) {
    error_log(
        "send_delivery_receipt_email.php: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to send the Delivery Receipt email.",
        [
            "email_sent" => false,
            "email_error" =>
                $error->getMessage()
        ],
        500
    );
}
