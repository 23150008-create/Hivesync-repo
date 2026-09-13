<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("inventory");
requireAnyRole(["Admin", "Staff"]);

require_once("../config/mailer.php");

function postRestockRespond(
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

function postRestockHasColumn(
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

    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    ");

    $stmt->execute([
        $table,
        $column
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function postRestockSupplierUsers(
    PDO $conn,
    int $vendorId
): array {
    if (
        !postRestockHasColumn(
            $conn,
            "tbl_user",
            "vendor_id"
        )
    ) {
        return [];
    }

    $columns = ["user_id"];

    foreach (
        [
            "email",
            "full_name",
            "name",
            "username"
        ] as $column
    ) {
        if (
            postRestockHasColumn(
                $conn,
                "tbl_user",
                $column
            )
        ) {
            $columns[] = $column;
        }
    }

    $statusCondition =
        postRestockHasColumn(
            $conn,
            "tbl_user",
            "status"
        )
            ? "AND COALESCE(status, 'Active') = 'Active'"
            : "";

    $stmt = $conn->prepare("
        SELECT " .
        implode(", ", $columns) . "
        FROM tbl_user
        WHERE vendor_id = ?
        {$statusCondition}
        ORDER BY user_id ASC
    ");

    $stmt->execute([
        $vendorId
    ]);

    return $stmt->fetchAll(
        PDO::FETCH_ASSOC
    );
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    postRestockRespond(
        false,
        "Method not allowed.",
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
        postRestockRespond(
            false,
            "Invalid JSON request.",
            [],
            400
        );
    }

    $requestId = filter_var(
        $data["restock_request_id"] ?? null,
        FILTER_VALIDATE_INT
    );

    $requestNo = trim(
        (string)(
            $data["request_no"] ?? ""
        )
    );

    if (
        !$requestId &&
        $requestNo === ""
    ) {
        postRestockRespond(
            false,
            "Restock request reference is required.",
            [],
            422
        );
    }

    $where =
        $requestId
            ? "r.restock_request_id = :request_id"
            : "r.request_no = :request_no";

    $params =
        $requestId
            ? [
                ":request_id" =>
                    $requestId
              ]
            : [
                ":request_no" =>
                    $requestNo
              ];

    $stmt = $conn->prepare("
        SELECT
            r.restock_request_id,
            r.request_no,
            r.product_id,
            r.vendor_id,
            r.requested_quantity,
            r.preferred_delivery_date,
            r.remarks,
            r.status,
            r.requested_by_name,

            i.product_name,
            i.sku,
            i.quantity AS current_stock,

            COALESCE(
                NULLIF(i.unit_type, ''),
                i.unit,
                'pcs'
            ) AS unit_type

        FROM tbl_restock_request r

        INNER JOIN tbl_inv i
            ON i.product_id =
                r.product_id

        WHERE {$where}

        LIMIT 1
    ");

    $stmt->execute($params);

    $request =
        $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        postRestockRespond(
            false,
            "Restock request was not found.",
            [],
            404
        );
    }

    if (
        !in_array(
            (string)$request["status"],
            [
                "Pending Supplier",
                "Delivery Created"
            ],
            true
        )
    ) {
        postRestockRespond(
            true,
            "Restock email skipped because the request is no longer active.",
            [
                "restock_request_id" =>
                    (int)$request[
                        "restock_request_id"
                    ],
                "request_no" =>
                    $request["request_no"],
                "emails_sent" => 0,
                "emails_failed" => 0
            ]
        );
    }

    $supplierUsers =
        postRestockSupplierUsers(
            $conn,
            (int)$request["vendor_id"]
        );

    $sent = 0;
    $failed = 0;
    $recipients = [];
    $errors = [];

    foreach (
        $supplierUsers as $supplierUser
    ) {
        $email = strtolower(
            trim(
                (string)(
                    $supplierUser["email"] ??
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
            $failed++;

            $errors[] =
                "Supplier account has no valid registered email.";

            continue;
        }

        $supplierName =
            trim(
                (string)(
                    $supplierUser[
                        "full_name"
                    ] ??
                    $supplierUser[
                        "name"
                    ] ??
                    $supplierUser[
                        "username"
                    ] ??
                    "Supplier"
                )
            );

        if ($supplierName === "") {
            $supplierName =
                "Supplier";
        }

        $productName =
            (string)$request[
                "product_name"
            ];

        $sku =
            trim(
                (string)(
                    $request["sku"] ??
                    ""
                )
            );

        $unit =
            (string)$request[
                "unit_type"
            ];

        $quantity =
            (int)$request[
                "requested_quantity"
            ];

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
            (int)$request[
                "current_stock"
            ] .
            " " .
            $unit .
            "\n" .
            "Requested Quantity: " .
            $quantity .
            " " .
            $unit .
            "\n" .
            "Preferred Delivery Date: " .
            (
                !empty(
                    $request[
                        "preferred_delivery_date"
                    ]
                )
                    ? $request[
                        "preferred_delivery_date"
                      ]
                    : "Not specified"
            ) .
            "\n" .
            "Requested By: " .
            (
                trim(
                    (string)(
                        $request[
                            "requested_by_name"
                        ] ??
                        ""
                    )
                ) !== ""
                    ? $request[
                        "requested_by_name"
                      ]
                    : "System User"
            ) .
            (
                trim(
                    (string)(
                        $request[
                            "remarks"
                        ] ??
                        ""
                    )
                ) !== ""
                    ? "\nRemarks: " .
                      $request["remarks"]
                    : ""
            ) .
            "\n\nAction Required: Open HiveSync Delivery Management and create the delivery from the Restock Requests panel.";

        try {
            $emailSent =
                sendNotificationEmail(
                    $email,
                    $supplierName,
                    "New Restock Request - " .
                    $request[
                        "request_no"
                    ],
                    $message,
                    "Inventory",
                    (string)$request[
                        "request_no"
                    ],
                    $details
                );

            if ($emailSent === true) {
                $sent++;
                $recipients[] =
                    $email;
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
        } catch (Throwable $mailError) {
            $failed++;

            $errors[] =
                $mailError->getMessage();

            error_log(
                "post_restock_communication.php: " .
                $mailError->getMessage()
            );
        }
    }

    $message =
        $sent > 0
            ? "Supplier restock email sent successfully."
            : (
                !$supplierUsers
                    ? "No active supplier account is linked to this supplier."
                    : "The restock request is saved, but the supplier email could not be sent."
            );

    postRestockRespond(
        true,
        $message,
        [
            "restock_request_id" =>
                (int)$request[
                    "restock_request_id"
                ],
            "request_no" =>
                $request["request_no"],
            "emails_sent" =>
                $sent,
            "emails_failed" =>
                $failed,
            "email_recipients" =>
                array_values(
                    array_unique(
                        $recipients
                    )
                ),
            "email_errors" =>
                array_values(
                    array_unique(
                        $errors
                    )
                )
        ]
    );
} catch (Throwable $error) {
    error_log(
        "post_restock_communication.php: " .
        $error->getMessage()
    );

    postRestockRespond(
        false,
        "The restock request was saved, but post-request email communication encountered an error.",
        [
            "error" =>
                $error->getMessage()
        ],
        500
    );
}