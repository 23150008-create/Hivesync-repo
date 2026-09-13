<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireAuthentication();

function notificationRespond(
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

function notificationTableExists(
    PDO $conn,
    string $table
): bool {
    static $cache = [];

    $cacheKey = strtolower(trim($table));

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = :table
    ");

    $stmt->execute([
        ":table" => $table
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function notificationColumnExists(
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
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = :table
        AND column_name = :column
    ");

    $stmt->execute([
        ":table" => $table,
        ":column" => $column
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function notificationOwnerColumn(
    PDO $conn
): ?string {
    foreach (
        [
            "user_id",
            "recipient_user_id"
        ] as $column
    ) {
        if (
            notificationColumnExists(
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

function notificationIsProductAction(
    array $notification
): bool {
    $type = strtolower(
        trim(
            (string)(
                $notification["type"] ?? ""
            )
        )
    );

    $module = strtolower(
        trim(
            (string)(
                $notification["module"] ?? ""
            )
        )
    );

    $referenceCode = strtolower(
        trim(
            (string)(
                $notification["reference_code"] ?? ""
            )
        )
    );

    $title = strtolower(
        trim(
            (string)(
                $notification["title"] ?? ""
            )
        )
    );

    $message = strtolower(
        trim(
            (string)(
                $notification["message"] ?? ""
            )
        )
    );

    if (
        in_array(
            $type,
            [
                "pullout",
                "pull-out",
                "disposal"
            ],
            true
        )
    ) {
        return true;
    }

    if (
        str_starts_with(
            $referenceCode,
            "par-"
        )
    ) {
        return true;
    }

    if (
        (
            str_contains($title, "supplier") ||
            str_contains($title, "vendor")
        ) &&
        (
            str_contains($title, "pull-out request") ||
            str_contains($title, "pullout request") ||
            str_contains($title, "disposal request") ||
            str_contains($title, "product action request")
        )
    ) {
        return true;
    }

    if (
        (
            str_contains($message, "supplier") ||
            str_contains($message, "vendor") ||
            str_contains($message, "request")
        ) &&
        (
            str_contains($message, "pull-out") ||
            str_contains($message, "pullout") ||
            str_contains($message, "disposal") ||
            str_contains($message, "product action")
        )
    ) {
        return true;
    }

    return $module === "product_actions";
}

function notificationAttachProductActionVendorIds(
    PDO $conn,
    array &$notifications
): void {
    if (
        !notificationTableExists(
            $conn,
            "tbl_product_action_request"
        ) ||
        !notificationColumnExists(
            $conn,
            "tbl_product_action_request",
            "request_id"
        ) ||
        !notificationColumnExists(
            $conn,
            "tbl_product_action_request",
            "request_no"
        ) ||
        !notificationColumnExists(
            $conn,
            "tbl_product_action_request",
            "vendor_id"
        )
    ) {
        return;
    }

    $requestIds = [];
    $requestNos = [];

    foreach ($notifications as $notification) {
        if (!notificationIsProductAction($notification)) {
            continue;
        }

        $referenceId =
            $notification["reference_id"] ?? null;

        if (
            $referenceId !== null &&
            filter_var(
                $referenceId,
                FILTER_VALIDATE_INT
            ) !== false
        ) {
            $requestIds[] =
                (int)$referenceId;
        }

        $referenceCode = trim(
            (string)(
                $notification["reference_code"] ?? ""
            )
        );

        if ($referenceCode !== "") {
            $requestNos[] = $referenceCode;
        }
    }

    $requestIds =
        array_values(
            array_unique($requestIds)
        );

    $requestNos =
        array_values(
            array_unique($requestNos)
        );

    if (!$requestIds && !$requestNos) {
        return;
    }

    $conditions = [];
    $params = [];

    if ($requestIds) {
        $placeholders = [];

        foreach (
            $requestIds as
            $index => $requestId
        ) {
            $placeholder =
                ":request_id_" . $index;

            $placeholders[] =
                $placeholder;

            $params[$placeholder] =
                $requestId;
        }

        $conditions[] =
            "request_id IN (" .
            implode(", ", $placeholders) .
            ")";
    }

    if ($requestNos) {
        $placeholders = [];

        foreach (
            $requestNos as
            $index => $requestNo
        ) {
            $placeholder =
                ":request_no_" . $index;

            $placeholders[] =
                $placeholder;

            $params[$placeholder] =
                $requestNo;
        }

        $conditions[] =
            "request_no IN (" .
            implode(", ", $placeholders) .
            ")";
    }

    $stmt = $conn->prepare("
        SELECT
            request_id,
            request_no,
            vendor_id
        FROM tbl_product_action_request
        WHERE " .
        implode(" OR ", $conditions)
    );

    $stmt->execute($params);

    $rows =
        $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );

    $vendorByRequestId = [];
    $vendorByRequestNo = [];

    foreach ($rows as $row) {
        $requestId =
            (int)($row["request_id"] ?? 0);

        $requestNo =
            trim(
                (string)(
                    $row["request_no"] ?? ""
                )
            );

        $vendorId =
            (int)($row["vendor_id"] ?? 0);

        if (
            $requestId > 0 &&
            $vendorId > 0
        ) {
            $vendorByRequestId[
                (string)$requestId
            ] = $vendorId;
        }

        if (
            $requestNo !== "" &&
            $vendorId > 0
        ) {
            $vendorByRequestNo[
                strtolower($requestNo)
            ] = $vendorId;
        }
    }

    foreach ($notifications as &$notification) {
        if (!notificationIsProductAction($notification)) {
            continue;
        }

        $vendorId = 0;

        $referenceId =
            $notification["reference_id"] ?? null;

        if (
            $referenceId !== null &&
            isset(
                $vendorByRequestId[
                    (string)$referenceId
                ]
            )
        ) {
            $vendorId =
                (int)$vendorByRequestId[
                    (string)$referenceId
                ];
        }

        if ($vendorId <= 0) {
            $referenceCode = strtolower(
                trim(
                    (string)(
                        $notification[
                            "reference_code"
                        ] ?? ""
                    )
                )
            );

            if (
                $referenceCode !== "" &&
                isset(
                    $vendorByRequestNo[
                        $referenceCode
                    ]
                )
            ) {
                $vendorId =
                    (int)$vendorByRequestNo[
                        $referenceCode
                    ];
            }
        }

        $notification["vendor_id"] =
            $vendorId > 0
                ? $vendorId
                : null;
    }

    unset($notification);
}

try {
    if (
        !notificationTableExists(
            $conn,
            "tbl_notifications"
        )
    ) {
        notificationRespond(
            true,
            "No notifications are available.",
            [
                "notifications" => [],
                "unread_count" => 0
            ]
        );
    }

    $role = trim(
        (string)(
            $_SESSION["role"] ?? ""
        )
    );

    $userId = filter_var(
        $_SESSION["user_id"] ?? null,
        FILTER_VALIDATE_INT
    );

    if (!$userId) {
        notificationRespond(
            false,
            "Authentication required.",
            [],
            401
        );
    }

    $isSupplier =
        strcasecmp($role, "Supplier") === 0 ||
        strcasecmp($role, "Vendor") === 0;

    $ownerColumn =
        notificationOwnerColumn($conn);

    $where = [];
    $params = [];

    if ($ownerColumn) {
        if ($isSupplier) {
            if (!$userId) {
                $where[] = "1 = 0";
            } else {
                $where[] =
                    "`{$ownerColumn}` = :current_user_id";

                $params[
                    ":current_user_id"
                ] = $userId;
            }
        } else {
            if ($userId) {
                $where[] = "
                    (
                        `{$ownerColumn}` =
                            :current_user_id
                        OR `{$ownerColumn}` IS NULL
                    )
                ";

                $params[
                    ":current_user_id"
                ] = $userId;
            } else {
                $where[] =
                    "`{$ownerColumn}` IS NULL";
            }
        }
    } elseif ($isSupplier) {
        $where[] = "1 = 0";
    }

    $detailsSelect =
        notificationColumnExists(
            $conn,
            "tbl_notifications",
            "details"
        )
            ? "details"
            : "NULL AS details";

    $moduleSelect =
        notificationColumnExists(
            $conn,
            "tbl_notifications",
            "module"
        )
            ? "module"
            : (
                notificationColumnExists(
                    $conn,
                    "tbl_notifications",
                    "target_page"
                )
                    ? "target_page AS module"
                    : "NULL AS module"
            );

    $referenceCodeSelect =
        notificationColumnExists(
            $conn,
            "tbl_notifications",
            "reference_code"
        )
            ? "reference_code"
            : "NULL AS reference_code";

    $typeSelect =
        notificationColumnExists(
            $conn,
            "tbl_notifications",
            "type"
        )
            ? "type"
            : "'Notification' AS type";

    $referenceIdSelect =
        notificationColumnExists(
            $conn,
            "tbl_notifications",
            "reference_id"
        )
            ? "reference_id"
            : "NULL AS reference_id";

    $isReadSelect =
        notificationColumnExists(
            $conn,
            "tbl_notifications",
            "is_read"
        )
            ? "is_read"
            : "0 AS is_read";

    $createdAtSelect =
        notificationColumnExists(
            $conn,
            "tbl_notifications",
            "created_at"
        )
            ? "created_at"
            : "NULL AS created_at";

    $whereSql =
        $where
            ? "WHERE " .
              implode(
                  " AND ",
                  $where
              )
            : "";

    $orderParts = [];

    if (
        notificationColumnExists(
            $conn,
            "tbl_notifications",
            "is_read"
        )
    ) {
        $orderParts[] =
            "is_read ASC";
    }

    if (
        notificationColumnExists(
            $conn,
            "tbl_notifications",
            "created_at"
        )
    ) {
        $orderParts[] =
            "created_at DESC";
    }

    $orderParts[] =
        "notification_id DESC";

    $stmt = $conn->prepare("
        SELECT
            notification_id,
            title,
            message,
            {$typeSelect},
            {$referenceIdSelect},
            {$referenceCodeSelect},
            {$moduleSelect},
            {$detailsSelect},
            {$isReadSelect},
            {$createdAtSelect}
        FROM tbl_notifications
        {$whereSql}
        ORDER BY " .
        implode(", ", $orderParts) . "
        LIMIT 100
    ");

    $stmt->execute($params);

    $notifications =
        $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );

    notificationAttachProductActionVendorIds(
        $conn,
        $notifications
    );

    $unreadCount = 0;

    foreach (
        $notifications as
        &$notification
    ) {
        $notification[
            "notification_id"
        ] = (int)(
            $notification[
                "notification_id"
            ] ?? 0
        );

        $notification["is_read"] =
            (int)(
                $notification[
                    "is_read"
                ] ?? 0
            );

        if (
            isset($notification["vendor_id"]) &&
            $notification["vendor_id"] !== null
        ) {
            $notification["vendor_id"] =
                (int)$notification["vendor_id"];
        }

        if (
            $notification[
                "is_read"
            ] === 0
        ) {
            $unreadCount++;
        }
    }

    unset($notification);

    notificationRespond(
        true,
        "Notifications retrieved successfully.",
        [
            "notifications" =>
                $notifications,
            "unread_count" =>
                $unreadCount
        ]
    );
} catch (Throwable $error) {
    error_log(
        "notifications/get_notifications.php: " .
        $error->getMessage()
    );

    notificationRespond(
        false,
        "Unable to retrieve notifications.",
        [
            "notifications" => [],
            "unread_count" => 0
        ],
        500
    );
}