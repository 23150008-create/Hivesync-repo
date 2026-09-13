<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireAuthentication();

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

function tableColumnExists(
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

try {
    $page = max(
        1,
        (int)($_GET["page"] ?? 1)
    );

    $requestedLimit = (int)(
        $_GET["limit"] ?? 20
    );

    $all =
        (string)($_GET["all"] ?? "") === "1";

    $limit = $all
        ? min(max($requestedLimit, 1), 5000)
        : min(max($requestedLimit, 1), 100);

    $offset = $all
        ? 0
        : ($page - 1) * $limit;

    $search = trim(
        (string)($_GET["search"] ?? "")
    );

    $date = trim(
        (string)($_GET["date"] ?? "")
    );

    $startDate = trim(
        (string)($_GET["start_date"] ?? "")
    );

    $endDate = trim(
        (string)($_GET["end_date"] ?? "")
    );

    $module = trim(
        (string)($_GET["module"] ?? "")
    );

    $action = trim(
        (string)($_GET["action"] ?? "")
    );

    $where = [];
    $params = [];

    if ($search !== "") {
        $where[] = "(
            a.user_name LIKE :search
            OR a.module LIKE :search
            OR a.action LIKE :search
            OR a.details LIKE :search
            OR a.created_at LIKE :search
        )";

        $params[":search"] =
            "%{$search}%";
    }

    if ($module !== "") {
        $where[] =
            "a.module = :module";

        $params[":module"] =
            $module;
    }

    if ($action !== "") {
        $where[] =
            "a.action = :action";

        $params[":action"] =
            $action;
    }

    if ($date === "today") {
        $where[] =
            "DATE(a.created_at) = CURDATE()";
    } elseif ($date === "yesterday") {
        $where[] = "
            DATE(a.created_at) =
            DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        ";
    } elseif ($date === "7days") {
        $where[] = "
            a.created_at >=
            DATE_SUB(NOW(), INTERVAL 7 DAY)
        ";
    } elseif ($date === "month") {
        $where[] = "
            MONTH(a.created_at) = MONTH(CURDATE())
            AND YEAR(a.created_at) = YEAR(CURDATE())
        ";
    } elseif ($date === "custom") {
        if (
            $startDate === "" ||
            $endDate === ""
        ) {
            respond(
                false,
                "Select both custom start and end dates.",
                [],
                422
            );
        }

        if ($startDate > $endDate) {
            respond(
                false,
                "The custom start date cannot be later than the end date.",
                [],
                422
            );
        }

        $where[] = "
            DATE(a.created_at)
            BETWEEN :start_date
            AND :end_date
        ";

        $params[":start_date"] = $startDate;
        $params[":end_date"] = $endDate;
    }

    $whereSql = count($where) > 0
        ? "WHERE " . implode(" AND ", $where)
        : "";

    $hasAuditUserId = tableColumnExists(
        $conn,
        "tbl_audit_trail",
        "user_id"
    );

    $hasUserRole = tableColumnExists(
        $conn,
        "tbl_user",
        "role"
    );

    $joinSql = "";
    $roleSelect = "NULL AS role";

    if (
        $hasAuditUserId &&
        $hasUserRole
    ) {
        $joinSql = "
            LEFT JOIN tbl_user u
                ON u.user_id = a.user_id
        ";

        $roleSelect = "
            CASE
                WHEN u.role = 'Vendor'
                THEN 'Supplier'
                ELSE u.role
            END AS role
        ";
    }

    $countStmt = $conn->prepare("
        SELECT COUNT(*)
        FROM tbl_audit_trail a
        {$joinSql}
        {$whereSql}
    ");

    foreach ($params as $key => $value) {
        $countStmt->bindValue(
            $key,
            $value
        );
    }

    $countStmt->execute();

    $total =
        (int)$countStmt->fetchColumn();

    $stmt = $conn->prepare("
        SELECT
            a.audit_id,
            a.user_id,
            a.user_name,
            {$roleSelect},
            a.module,
            a.action,
            a.details,
            a.created_at
        FROM tbl_audit_trail a
        {$joinSql}
        {$whereSql}
        ORDER BY
            a.created_at DESC,
            a.audit_id DESC
        LIMIT :limit
        OFFSET :offset
    ");

    foreach ($params as $key => $value) {
        $stmt->bindValue(
            $key,
            $value
        );
    }

    $stmt->bindValue(
        ":limit",
        $limit,
        PDO::PARAM_INT
    );

    $stmt->bindValue(
        ":offset",
        $offset,
        PDO::PARAM_INT
    );

    $stmt->execute();

    $logs = $stmt->fetchAll(
        PDO::FETCH_ASSOC
    );

    respond(
        true,
        "Audit logs loaded successfully.",
        [
            "logs" => $logs,

            "pagination" => [
                "page" =>
                    $all ? 1 : $page,

                "limit" =>
                    $limit,

                "total" =>
                    $total,

                "total_pages" =>
                    $all
                        ? 1
                        : max(
                            1,
                            (int)ceil(
                                $total / $limit
                            )
                        )
            ],

            "filters" => [
                "search" => $search,
                "module" => $module,
                "action" => $action,
                "date" => $date,
                "start_date" => $startDate,
                "end_date" => $endDate
            ]
        ]
    );
} catch (Throwable $error) {
    error_log(
        "audit_trail/get_logs.php: " .
        $error->getMessage()
    );

    respond(
        false,
        "Failed to load audit logs.",
        [
            "error" =>
                $error->getMessage(),

            "logs" => []
        ],
        500
    );
}