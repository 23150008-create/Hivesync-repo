<?php
declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("inventory");
requireAnyRole(["Admin", "Staff"]);

require_once("../config/mailer.php");


function rrRespond(
    bool $ok,
    string $message,
    array $extra = [],
    int $code = 200
): void {
    http_response_code($code);

    echo json_encode(
        array_merge(
            [
                "success" => $ok,
                "message" => $message
            ],
            $extra
        ),
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


function rrHasColumn(
    PDO $conn,
    string $table,
    string $column
): bool {
    static $cache = [];

    $cacheKey =
        strtolower(trim($table)) .
        "." .
        strtolower(trim($column));

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $s = $conn->prepare(
        "SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?"
    );

    $s->execute([$table, $column]);

    $cache[$cacheKey] =
        (int)$s->fetchColumn() > 0;

    return $cache[$cacheKey];
}


function rrNumber(PDO $conn): string
{
    $prefix = "RR-" . date("Ymd") . "-";

    $s = $conn->prepare(
        "SELECT request_no
         FROM tbl_restock_request
         WHERE request_no LIKE ?
         ORDER BY restock_request_id DESC
         LIMIT 1"
    );

    $s->execute([$prefix . "%"]);

    $last = (string)($s->fetchColumn() ?: "");

    $n = 1;

    if (
        $last !== "" &&
        preg_match('/(\d{4})$/', $last, $m)
    ) {
        $n = (int)$m[1] + 1;
    }

    return $prefix .
        str_pad(
            (string)$n,
            4,
            "0",
            STR_PAD_LEFT
        );
}


function rrGetSupplierUsers(
    PDO $conn,
    int $vendorId
): array {

    if (!rrHasColumn($conn, "tbl_user", "vendor_id")) {
        return [];
    }

    $columns = ["user_id"];

    if (rrHasColumn($conn, "tbl_user", "email")) {
        $columns[] = "email";
    }

    if (rrHasColumn($conn, "tbl_user", "full_name")) {
        $columns[] = "full_name";
    }

    if (rrHasColumn($conn, "tbl_user", "name")) {
        $columns[] = "name";
    }

    if (rrHasColumn($conn, "tbl_user", "username")) {
        $columns[] = "username";
    }

    $sql =
        "SELECT " . implode(",", $columns) . "
         FROM tbl_user
         WHERE vendor_id = ?
           AND COALESCE(status,'Active') = 'Active'";

    $s = $conn->prepare($sql);
    $s->execute([$vendorId]);

    return $s->fetchAll(PDO::FETCH_ASSOC);
}


function rrCreateSupplierNotifications(
    PDO $conn,
    array $supplierUsers,
    int $requestId,
    string $requestNo,
    string $productName,
    string $sku,
    int $qty,
    string $unit
): int {

    if (!$supplierUsers) {
        return 0;
    }

    $available = [];

    foreach (
        [
            "user_id",
            "title",
            "message",
            "type",
            "module",
            "reference_id",
            "reference_code",
            "details",
            "is_read"
        ] as $c
    ) {
        if (
            rrHasColumn(
                $conn,
                "tbl_notifications",
                $c
            )
        ) {
            $available[] = $c;
        }
    }

    if (
        !in_array("title", $available, true) ||
        !in_array("message", $available, true)
    ) {
        return 0;
    }

    $count = 0;

    foreach ($supplierUsers as $supplierUser) {

        $uid =
            (int)($supplierUser["user_id"] ?? 0);

        if ($uid <= 0) {
            continue;
        }

        $values = [
            "user_id" => $uid,

            "title" =>
                "Restock Request " .
                $requestNo,

            "message" =>
                $productName .
                " needs " .
                $qty .
                " " .
                $unit .
                ". Open Delivery Management to create the delivery.",

            "type" => "Inventory",

            "module" => "Delivery",

            "reference_id" => $requestId,

            "reference_code" => $requestNo,

            "details" =>
                "Product: " .
                $productName .
                "\n" .
                (
                    $sku !== ""
                        ? "SKU: " . $sku . "\n"
                        : ""
                ) .
                "Requested: " .
                $qty .
                " " .
                $unit .
                "\nAction: Create Delivery from the Restock Requests panel.",

            "is_read" => 0
        ];

        $cols = [];
        $marks = [];
        $params = [];

        foreach ($available as $c) {
            $cols[] = "`" . $c . "`";
            $marks[] = ":" . $c;
            $params[":" . $c] = $values[$c];
        }

        if (
            rrHasColumn(
                $conn,
                "tbl_notifications",
                "created_at"
            )
        ) {
            $cols[] = "`created_at`";
            $marks[] = "NOW()";
        }

        $q = $conn->prepare(
            "INSERT INTO tbl_notifications (" .
            implode(",", $cols) .
            ")
             VALUES (" .
            implode(",", $marks) .
            ")"
        );

        $q->execute($params);

        $count++;
    }

    return $count;
}


function rrSendRestockEmails(
    array $supplierUsers,
    string $requestNo,
    string $productName,
    string $sku,
    int $currentStock,
    int $qty,
    string $unit,
    string $preferredDate,
    string $remarks,
    string $requestedBy
): array {

    $sent = 0;
    $failed = 0;
    $recipients = [];
    $errors = [];

    foreach ($supplierUsers as $supplierUser) {

        $email = strtolower(
            trim(
                (string)(
                    $supplierUser["email"] ?? ""
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
            $failed++;

            $errors[] =
                "Supplier account has no valid registered email.";

            continue;
        }

        $supplierName =
            trim(
                (string)(
                    $supplierUser["full_name"] ??
                    $supplierUser["name"] ??
                    $supplierUser["username"] ??
                    "Supplier"
                )
            );

        if ($supplierName === "") {
            $supplierName = "Supplier";
        }

        $message =
            "BFATC has submitted a new restock request for " .
            $productName .
            ". Please review the request and prepare the corresponding delivery in HiveSync.";

        $details =
            "Product: " .
            $productName .
            "\n" .

            (
                $sku !== ""
                    ? "SKU: " .
                      $sku .
                      "\n"
                    : ""
            ) .

            "Current Stock: " .
            $currentStock .
            " " .
            $unit .
            "\n" .

            "Requested Quantity: " .
            $qty .
            " " .
            $unit .
            "\n" .

            "Preferred Delivery Date: " .
            (
                $preferredDate !== ""
                    ? $preferredDate
                    : "Not specified"
            ) .
            "\n" .

            "Requested By: " .
            (
                $requestedBy !== ""
                    ? $requestedBy
                    : "System User"
            ) .

            (
                $remarks !== ""
                    ? "\nRemarks: " .
                      $remarks
                    : ""
            ) .

            "\n\nAction Required: Open HiveSync Delivery Management and create the delivery from the Restock Requests panel.";

        try {

            $emailSent =
                sendNotificationEmail(
                    $email,
                    $supplierName,
                    "New Restock Request - " .
                    $requestNo,
                    $message,
                    "Inventory",
                    $requestNo,
                    $details
                );

            if ($emailSent === true) {

                $sent++;

                $recipients[] = $email;

            } else {

                $failed++;

                $mailError =
                    function_exists(
                        "getLastMailError"
                    )
                        ? getLastMailError()
                        : "";

                $errors[] =
                    $mailError !== ""
                        ? $mailError
                        : "Unable to send restock email to " .
                          $email .
                          ".";
            }

        } catch (Throwable $emailError) {

            $failed++;

            $errors[] =
                $emailError->getMessage();

            error_log(
                "Restock request email failed for " .
                $email .
                ": " .
                $emailError->getMessage()
            );
        }
    }

    return [
        "sent" => $sent,
        "failed" => $failed,
        "recipients" => $recipients,
        "errors" => array_values(
            array_unique($errors)
        )
    ];
}


if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    rrRespond(
        false,
        "Method not allowed.",
        [],
        405
    );
}

requireCsrfToken();


$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    rrRespond(
        false,
        "Invalid JSON request.",
        [],
        400
    );
}


$productId =
    filter_var(
        $data["product_id"] ?? null,
        FILTER_VALIDATE_INT
    );

$qty =
    filter_var(
        $data["requested_quantity"] ?? null,
        FILTER_VALIDATE_INT
    );

$date =
    trim(
        (string)(
            $data["preferred_delivery_date"] ??
            ""
        )
    );

$remarks =
    trim(
        (string)(
            $data["remarks"] ??
            ""
        )
    );

$by =
    filter_var(
        $data["requested_by"] ?? null,
        FILTER_VALIDATE_INT
    );

$byName =
    trim(
        (string)(
            $data["requested_by_name"] ??
            "System User"
        )
    );


if (!$productId) {
    rrRespond(
        false,
        "A valid product is required.",
        [],
        422
    );
}

if (!$qty || $qty <= 0) {
    rrRespond(
        false,
        "Requested quantity must be greater than zero.",
        [],
        422
    );
}

if (
    $date !== "" &&
    $date < date("Y-m-d")
) {
    rrRespond(
        false,
        "Preferred delivery date cannot be in the past.",
        [],
        422
    );
}


try {

    $conn->beginTransaction();

    $s = $conn->prepare(
        "SELECT
            i.product_id,
            i.product_name,
            i.sku,
            i.vendor_id,
            i.quantity,
            i.reorder_level,
            COALESCE(
                NULLIF(i.unit_type,''),
                i.unit,
                'pcs'
            ) AS unit_type,
            v.vendor_name
         FROM tbl_inv i
         LEFT JOIN tbl_vendor v
            ON v.vendor_id = i.vendor_id
         WHERE i.product_id = ?
           AND COALESCE(
                i.status,
                'In Stock'
           ) <> 'Archived'
         LIMIT 1
         FOR UPDATE"
    );

    $s->execute([$productId]);

    $p =
        $s->fetch(PDO::FETCH_ASSOC);

    if (!$p) {
        throw new RuntimeException(
            "The selected product was not found or is archived."
        );
    }


    $vendorId =
        (int)($p["vendor_id"] ?? 0);

    if ($vendorId <= 0) {
        throw new RuntimeException(
            "Assign a supplier to this product before requesting restock."
        );
    }


    $s = $conn->prepare(
        "SELECT
            restock_request_id,
            request_no
         FROM tbl_restock_request
         WHERE product_id = ?
           AND vendor_id = ?
           AND status IN (
                'Pending Supplier',
                'Delivery Created'
           )
         ORDER BY restock_request_id DESC
         LIMIT 1
         FOR UPDATE"
    );

    $s->execute([
        $productId,
        $vendorId
    ]);

    $existing =
        $s->fetch(PDO::FETCH_ASSOC);

    if ($existing) {

        $conn->rollBack();

        rrRespond(
            false,
            "An active restock request already exists: " .
            $existing["request_no"] .
            ".",
            [
                "duplicate_request" => true,
                "request_no" =>
                    $existing["request_no"]
            ],
            409
        );
    }


    $supplierUsers =
        rrGetSupplierUsers(
            $conn,
            $vendorId
        );


    $no = rrNumber($conn);

    $s = $conn->prepare(
        "INSERT INTO tbl_restock_request
        (
            request_no,
            product_id,
            vendor_id,
            requested_quantity,
            preferred_delivery_date,
            remarks,
            status,
            requested_by,
            requested_by_name,
            created_at,
            updated_at
        )
        VALUES
        (
            ?,?,?,?,?,?,
            'Pending Supplier',
            ?,?,
            NOW(),
            NOW()
        )"
    );

    $s->execute([
        $no,
        $productId,
        $vendorId,
        $qty,
        $date !== ""
            ? $date
            : null,
        $remarks !== ""
            ? $remarks
            : null,
        $by ?: null,
        $byName
    ]);

    $id =
        (int)$conn->lastInsertId();


    $notifications =
        rrCreateSupplierNotifications(
            $conn,
            $supplierUsers,
            $id,
            $no,
            (string)$p["product_name"],
            (string)($p["sku"] ?? ""),
            (int)$qty,
            (string)$p["unit_type"]
        );


    $conn->commit();


    rrRespond(
        true,
        "Restock request sent successfully. The supplier was notified in HiveSync.",
        [
            "restock_request_id" =>
                $id,

            "request_no" =>
                $no,

            "status" =>
                "Pending Supplier",

            "supplier_notifications_created" =>
                $notifications,

            "post_processing_required" =>
                count($supplierUsers) > 0,

            "post_processing_action" =>
                "restock_request_email"
        ],
        201
    );

} catch (Throwable $e) {

    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "create_restock_request.php: " .
        $e->getMessage()
    );

    rrRespond(
        false,
        $e->getMessage(),
        [],
        500
    );
}