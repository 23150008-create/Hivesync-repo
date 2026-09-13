<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

function supplierProductRespond(
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

function supplierProductReadInput(): array
{
    $contentType = strtolower(
        (string)($_SERVER["CONTENT_TYPE"] ?? "")
    );

    if (str_contains($contentType, "application/json")) {
        $data = json_decode(
            file_get_contents("php://input"),
            true
        );

        return is_array($data)
            ? $data
            : [];
    }

    return $_POST;
}

function supplierProductTableExists(
    PDO $conn,
    string $table
): bool {
    static $cache = [];

    $cacheKey = strtolower(
        trim($table)
    );

    if (
        array_key_exists(
            $cacheKey,
            $cache
        )
    ) {
        return $cache[$cacheKey];
    }

    $stmt = $conn->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = :table_name
    ");

    $stmt->execute([
        ":table_name" => $table
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function supplierProductColumnExists(
    PDO $conn,
    string $table,
    string $column
): bool {
    static $cache = [];

    $cacheKey =
        strtolower(trim($table)) .
        "." .
        strtolower(trim($column));

    if (
        array_key_exists(
            $cacheKey,
            $cache
        )
    ) {
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
        ":table_name" => $table,
        ":column_name" => $column
    ]);

    $cache[$cacheKey] =
        (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function generateSupplierProductRequestNo(
    PDO $conn
): string {
    $prefix = "SPR-" . date("Y") . "-";

    $stmt = $conn->prepare("
        SELECT request_no
        FROM tbl_supplier_product_request
        WHERE request_no LIKE :pattern
        ORDER BY
            CAST(
                SUBSTRING_INDEX(
                    request_no,
                    '-',
                    -1
                ) AS UNSIGNED
            ) DESC,
            request_id DESC
        LIMIT 1
    ");

    $stmt->execute([
        ":pattern" => $prefix . "%"
    ]);

    $last =
        (string)(
            $stmt->fetchColumn() ?: ""
        );

    $next = 1;

    if (
        $last !== "" &&
        preg_match(
            "/(\d+)$/",
            $last,
            $matches
        )
    ) {
        $next =
            (int)$matches[1] + 1;
    }

    return $prefix .
        str_pad(
            (string)$next,
            5,
            "0",
            STR_PAD_LEFT
        );
}

function cleanSkuToken(
    string $value
): string {
    $value = strtoupper(
        preg_replace(
            "/[^A-Za-z0-9]+/",
            "-",
            trim($value)
        )
    );

    return trim(
        $value,
        "-"
    );
}

function generateApprovedProductSku(
    PDO $conn,
    string $categoryName,
    string $productName
): string {
    $categoryToken =
        cleanSkuToken(
            $categoryName
        );

    $productToken =
        cleanSkuToken(
            $productName
        );

    $categoryPrefix = substr(
        str_replace(
            "-",
            "",
            $categoryToken
        ),
        0,
        3
    );

    $productPrefix = substr(
        str_replace(
            "-",
            "",
            $productToken
        ),
        0,
        3
    );

    if ($categoryPrefix === "") {
        $categoryPrefix = "PRD";
    }

    if ($productPrefix === "") {
        $productPrefix = "ITEM";
    }

    $prefix =
        $categoryPrefix .
        "-" .
        $productPrefix .
        "-";

    $stmt = $conn->prepare("
        SELECT sku
        FROM tbl_inv
        WHERE sku LIKE :pattern
        ORDER BY
            CAST(
                SUBSTRING_INDEX(
                    sku,
                    '-',
                    -1
                ) AS UNSIGNED
            ) DESC,
            product_id DESC
        LIMIT 1
    ");

    $stmt->execute([
        ":pattern" => $prefix . "%"
    ]);

    $lastSku =
        (string)(
            $stmt->fetchColumn() ?: ""
        );

    $next = 1;

    if (
        $lastSku !== "" &&
        preg_match(
            "/(\d+)$/",
            $lastSku,
            $matches
        )
    ) {
        $next =
            (int)$matches[1] + 1;
    }

    return $prefix .
        str_pad(
            (string)$next,
            3,
            "0",
            STR_PAD_LEFT
        );
}

function saveSupplierProductImage(
    array $file
): ?string {
    $error = (int)(
        $file["error"] ??
        UPLOAD_ERR_NO_FILE
    );

    if ($error === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    if ($error !== UPLOAD_ERR_OK) {
        throw new RuntimeException(
            "The product image could not be uploaded."
        );
    }

    $size = (int)(
        $file["size"] ?? 0
    );

    if (
        $size <= 0 ||
        $size > 5 * 1024 * 1024
    ) {
        throw new RuntimeException(
            "Product image must not exceed 5 MB."
        );
    }

    $temporaryPath = (string)(
        $file["tmp_name"] ?? ""
    );

    if (
        $temporaryPath === "" ||
        !is_uploaded_file(
            $temporaryPath
        )
    ) {
        throw new RuntimeException(
            "The uploaded product image is invalid."
        );
    }

    $mime = (
        new finfo(
            FILEINFO_MIME_TYPE
        )
    )->file(
        $temporaryPath
    );

    $allowedTypes = [
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp"
    ];

    if (
        !isset(
            $allowedTypes[$mime]
        )
    ) {
        throw new RuntimeException(
            "Product image must be JPG, PNG, or WEBP."
        );
    }

    $uploadDirectory =
        dirname(__DIR__) .
        "/uploads/products";

    if (
        !is_dir(
            $uploadDirectory
        )
    ) {
        if (
            !mkdir(
                $uploadDirectory,
                0775,
                true
            ) &&
            !is_dir(
                $uploadDirectory
            )
        ) {
            throw new RuntimeException(
                "Unable to create the product image directory."
            );
        }
    }

    $filename =
        "supplier_request_" .
        date("YmdHis") .
        "_" .
        bin2hex(
            random_bytes(5)
        ) .
        "." .
        $allowedTypes[$mime];

    $destination =
        $uploadDirectory .
        DIRECTORY_SEPARATOR .
        $filename;

    if (
        !move_uploaded_file(
            $temporaryPath,
            $destination
        )
    ) {
        throw new RuntimeException(
            "Unable to save the product image."
        );
    }

    return $filename;
}

function logSupplierProductAudit(
    PDO $conn,
    ?int $userId,
    string $userName,
    string $action,
    string $details
): void {
    try {
        if (
            !supplierProductTableExists(
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
                'Supplier Product Requests',
                :action,
                :details,
                NOW()
            )
        ");

        $stmt->execute([
            ":user_id" =>
                $userId,
            ":user_name" =>
                trim($userName) !== ""
                    ? trim($userName)
                    : "Unknown User",
            ":action" =>
                $action,
            ":details" =>
                $details
        ]);
    } catch (Throwable $error) {
        error_log(
            "Supplier product audit error: " .
            $error->getMessage()
        );
    }
}

function createSupplierProductNotification(
    PDO $conn,
    string $title,
    string $message,
    int $referenceId
): void {
    try {
        if (
            !supplierProductTableExists(
                $conn,
                "tbl_notifications"
            )
        ) {
            return;
        }

        $columns = [
            "title",
            "message",
            "type",
            "reference_id",
            "is_read"
        ];

        $values = [
            ":title",
            ":message",
            ":type",
            ":reference_id",
            "0"
        ];

        $params = [
            ":title" =>
                $title,
            ":message" =>
                $message,
            ":type" =>
                "Supplier Product",
            ":reference_id" =>
                $referenceId
        ];

        if (
            supplierProductColumnExists(
                $conn,
                "tbl_notifications",
                "details"
            )
        ) {
            $columns[] =
                "details";

            $values[] =
                ":details";

            $params[":details"] =
                $message;
        }

        $sql = "
            INSERT INTO tbl_notifications
            (
                " .
                implode(
                    ", ",
                    $columns
                ) .
            ")
            VALUES
            (
                " .
                implode(
                    ", ",
                    $values
                ) .
            ")
        ";

        $stmt =
            $conn->prepare(
                $sql
            );

        $stmt->execute(
            $params
        );
    } catch (Throwable $error) {
        error_log(
            "Supplier product notification error: " .
            $error->getMessage()
        );
    }
}
