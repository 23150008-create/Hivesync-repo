<?php

declare(strict_types=1);

function productActionRespond(
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
        )
    );

    exit;
}

function productActionReadJson(): array
{
    $data = json_decode(
        file_get_contents("php://input"),
        true
    );

    return is_array($data)
        ? $data
        : [];
}

function productActionTableExists(
    PDO $conn,
    string $tableName
): bool {
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

function productActionColumnExists(
    PDO $conn,
    string $tableName,
    string $columnName
): bool {
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

function generateProductActionNo(
    PDO $conn
): string {
    $year = date("Y");
    $prefix = "PAR-{$year}-";

    $stmt = $conn->prepare("
        SELECT request_no
        FROM tbl_product_action_request
        WHERE request_no LIKE :pattern
        ORDER BY request_id DESC
        LIMIT 1
    ");

    $stmt->execute([
        ":pattern" => $prefix . "%"
    ]);

    $lastNumber = $stmt->fetchColumn();
    $nextNumber = 1;

    if (
        $lastNumber &&
        preg_match(
            "/(\d+)$/",
            (string)$lastNumber,
            $matches
        )
    ) {
        $nextNumber =
            (int)$matches[1] + 1;
    }

    return $prefix .
        str_pad(
            (string)$nextNumber,
            5,
            "0",
            STR_PAD_LEFT
        );
}

function logProductActionAudit(
    PDO $conn,
    ?int $userId,
    string $userName,
    string $action,
    string $details
): void {
    try {
        if (
            !productActionTableExists(
                $conn,
                "tbl_audit_trail"
            )
        ) {
            return;
        }

        $stmt = $conn->prepare("
            INSERT INTO tbl_audit_trail
            (
                user_id,
                user_name,
                module,
                action,
                details,
                created_at
            )
            VALUES
            (
                :user_id,
                :user_name,
                'Supplier Product Actions',
                :action,
                :details,
                NOW()
            )
        ");

        $stmt->execute([
            ":user_id" => $userId,
            ":user_name" =>
                $userName !== ""
                    ? $userName
                    : "Unknown User",
            ":action" => $action,
            ":details" => $details
        ]);
    } catch (Throwable $e) {
        error_log(
            "Product action audit error: " .
            $e->getMessage()
        );
    }
}

function createProductActionNotification(
    PDO $conn,
    string $title,
    string $message,
    int $referenceId
): void {
    try {
        if (
            !productActionTableExists(
                $conn,
                "tbl_notifications"
            )
        ) {
            return;
        }

        $stmt = $conn->prepare("
            INSERT INTO tbl_notifications
            (
                title,
                message,
                type,
                reference_id,
                is_read
            )
            VALUES
            (
                :title,
                :message,
                'Inventory',
                :reference_id,
                0
            )
        ");

        $stmt->execute([
            ":title" => $title,
            ":message" => $message,
            ":reference_id" => $referenceId
        ]);
    } catch (Throwable $e) {
        error_log(
            "Product action notification error: " .
            $e->getMessage()
        );
    }
}

function getSupplierEmailDetails(
    PDO $conn,
    int $vendorId
): ?array {
    try {
        if (
            !productActionTableExists(
                $conn,
                "tbl_user"
            ) ||
            !productActionColumnExists(
                $conn,
                "tbl_user",
                "vendor_id"
            )
        ) {
            return null;
        }

        $stmt = $conn->prepare("
            SELECT
                full_name,
                email
            FROM tbl_user
            WHERE vendor_id = :vendor_id
            AND status = 'Active'
            ORDER BY user_id ASC
            LIMIT 1
        ");

        $stmt->execute([
            ":vendor_id" => $vendorId
        ]);

        $user = $stmt->fetch(
            PDO::FETCH_ASSOC
        );

        if (
            !$user ||
            !filter_var(
                $user["email"] ?? "",
                FILTER_VALIDATE_EMAIL
            )
        ) {
            return null;
        }

        return $user;
    } catch (Throwable $e) {
        error_log(
            "Supplier email lookup error: " .
            $e->getMessage()
        );

        return null;
    }
}

function sendProductActionEmail(
    PDO $conn,
    int $vendorId,
    string $title,
    string $message,
    string $referenceCode,
    string $details = ""
): bool {
    try {
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

        $supplierUser =
            getSupplierEmailDetails(
                $conn,
                $vendorId
            );

        if (!$supplierUser) {
            return false;
        }

        return sendNotificationEmail(
            $supplierUser["email"],
            $supplierUser["full_name"] ??
                "Supplier",
            $title,
            $message,
            "Inventory",
            $referenceCode,
            $details
        ) === true;
    } catch (Throwable $e) {
        error_log(
            "Product action email error: " .
            $e->getMessage()
        );

        return false;
    }
}

function normalizeProductActionType(
    string $value
): string {
    $value = strtolower(
        trim($value)
    );

    if (
        in_array(
            $value,
            [
                "pull-out",
                "pullout",
                "pull out"
            ],
            true
        )
    ) {
        return "Pull-out";
    }

    if (
        in_array(
            $value,
            [
                "disposal",
                "dispose"
            ],
            true
        )
    ) {
        return "Disposal";
    }

    return "";
}