<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");

header("Content-Type: application/json; charset=utf-8");

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

function tableExists(
    PDO $conn,
    string $tableName
): bool {
    /*
     * Performance optimization only.
     * Cache repeated table checks during the current request.
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

function columnExists(
    PDO $conn,
    string $tableName,
    string $columnName
): bool {
    /*
     * Performance optimization only.
     * Cache repeated column checks during the current request.
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


function validDate(string $date): bool
{
    $parsed = DateTime::createFromFormat(
        "Y-m-d",
        $date
    );

    return $parsed !== false &&
        $parsed->format("Y-m-d") === $date;
}

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
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

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    respond(
        false,
        "No expense information was received.",
        [],
        422
    );
}

if (!tableExists($conn, "tbl_expense")) {
    respond(
        false,
        "Expense table is unavailable.",
        [],
        500
    );
}

$allowedCategories = [
    "Packaging",
    "Printing",
    "Office Supplies",
    "Cleaning Supplies",
    "Utilities",
    "Transportation",
    "Maintenance",
    "Marketing",
    "Miscellaneous",
    "Other"
];

$expenseCategory = trim(
    (string)($data["expense_category"] ?? "")
);

$materialName = trim(
    (string)($data["material_name"] ?? "")
);

$quantity = filter_var(
    $data["quantity"] ?? null,
    FILTER_VALIDATE_FLOAT
);

$unit = trim(
    (string)($data["unit"] ?? "")
);

$unitCost = filter_var(
    $data["unit_cost"] ?? null,
    FILTER_VALIDATE_FLOAT
);

$expenseDate = trim(
    (string)($data["expense_date"] ?? "")
);

$recordedBy = filter_var(
    $data["recorded_by"] ?? null,
    FILTER_VALIDATE_INT
);

$recordedByName = trim(
    (string)($data["recorded_by_name"] ?? "")
);

$remarks = trim(
    (string)($data["remarks"] ?? "")
);

$referenceCode = trim(
    (string)($data["reference_code"] ?? "")
);

$referenceDescription = trim(
    (string)($data["reference_description"] ?? "")
);

if (
    !in_array(
        $expenseCategory,
        $allowedCategories,
        true
    )
) {
    respond(
        false,
        "Select a valid expense category.",
        [],
        422
    );
}

if ($materialName === "") {
    respond(
        false,
        "Expense or material name is required.",
        [],
        422
    );
}

if (
    $quantity === false ||
    (float)$quantity <= 0
) {
    respond(
        false,
        "Quantity must be greater than zero.",
        [],
        422
    );
}

if ($unit === "") {
    $unit = "piece";
}

if (
    $unitCost === false ||
    (float)$unitCost < 0
) {
    respond(
        false,
        "Unit cost must be zero or greater.",
        [],
        422
    );
}

if (
    $expenseDate === "" ||
    !validDate($expenseDate)
) {
    respond(
        false,
        "A valid expense date is required.",
        [],
        422
    );
}


if ($expenseDate > date("Y-m-d")) {
    respond(
        false,
        "Expense date cannot be in the future.",
        [],
        422
    );
}

if (!$recordedBy) {
    $recordedBy = null;
}

if ($recordedByName === "") {
    $recordedByName = "Unknown User";
}

$quantity = round(
    (float)$quantity,
    2
);

$unitCost = round(
    (float)$unitCost,
    2
);

$totalCost = round(
    $quantity * $unitCost,
    2
);

try {
    $conn->beginTransaction();

    /*
    |--------------------------------------------------------------------------
    | Insert expense using a temporary unique expense number
    |--------------------------------------------------------------------------
    |
    | expense_no is NOT NULL and UNIQUE.
    | We first insert a temporary unique value, obtain expense_id, then
    | replace it with the final human-readable EXP-YYMMDD-00001 format.
    |
    */

    $temporaryExpenseNo =
        "TMP-EXP-" .
        date("YmdHis") .
        "-" .
        bin2hex(random_bytes(4));

    $insert = $conn->prepare("
        INSERT INTO tbl_expense
        (
            expense_no,
            expense_category,
            material_name,
            quantity,
            unit,
            unit_cost,
            total_cost,
            related_module,
            reference_id,
            reference_code,
            reference_description,
            expense_date,
            recorded_by,
            recorded_by_name,
            remarks,
            status,
            created_at,
            updated_at
        )
        VALUES
        (
            :expense_no,
            :expense_category,
            :material_name,
            :quantity,
            :unit,
            :unit_cost,
            :total_cost,
            'Reports',
            NULL,
            :reference_code,
            :reference_description,
            :expense_date,
            :recorded_by,
            :recorded_by_name,
            :remarks,
            'Active',
            NOW(),
            NOW()
        )
    ");

    $insert->execute([
        ":expense_no" =>
            $temporaryExpenseNo,
        ":expense_category" =>
            $expenseCategory,
        ":material_name" =>
            $materialName,
        ":quantity" =>
            $quantity,
        ":unit" =>
            $unit,
        ":unit_cost" =>
            $unitCost,
        ":total_cost" =>
            $totalCost,
        ":reference_code" =>
            $referenceCode !== ""
                ? $referenceCode
                : null,
        ":reference_description" =>
            $referenceDescription !== ""
                ? $referenceDescription
                : null,
        ":expense_date" =>
            $expenseDate,
        ":recorded_by" =>
            $recordedBy,
        ":recorded_by_name" =>
            $recordedByName,
        ":remarks" =>
            $remarks !== ""
                ? $remarks
                : null
    ]);

    $expenseId =
        (int)$conn->lastInsertId();

    if ($expenseId <= 0) {
        throw new RuntimeException(
            "Unable to generate the expense record ID."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Generate official expense number
    |--------------------------------------------------------------------------
    |
    | Example:
    | EXP-260828-00001
    |
    */

    $expenseDateObject =
        new DateTime($expenseDate);

    $expenseNo =
        "EXP-" .
        $expenseDateObject->format("ymd") .
        "-" .
        str_pad(
            (string)$expenseId,
            5,
            "0",
            STR_PAD_LEFT
        );

    $updateNumber = $conn->prepare("
        UPDATE tbl_expense
        SET
            expense_no = :expense_no,
            updated_at = NOW()
        WHERE expense_id = :expense_id
    ");

    $updateNumber->execute([
        ":expense_no" =>
            $expenseNo,
        ":expense_id" =>
            $expenseId
    ]);

    /*
    |--------------------------------------------------------------------------
    | Audit Trail
    |--------------------------------------------------------------------------
    |
    | Keep the business transaction and its audit record together.
    |
    */

    if (tableExists($conn, "tbl_audit_trail")) {
        $auditColumns = [];
        $auditValues = [];
        $auditParameters = [];

        $auditData = [
            "user_id" =>
                $recordedBy,
            "user_name" =>
                $recordedByName,
            "module" =>
                "Reports",
            "action" =>
                "Record Expense",
            "details" =>
                "Recorded {$expenseNo}: " .
                "{$expenseCategory} - {$materialName}, " .
                number_format(
                    $quantity,
                    2,
                    ".",
                    ""
                ) .
                " {$unit} × ₱" .
                number_format(
                    $unitCost,
                    2,
                    ".",
                    ","
                ) .
                " = ₱" .
                number_format(
                    $totalCost,
                    2,
                    ".",
                    ","
                ) .
                "."
        ];

        foreach (
            $auditData as
            $column => $value
        ) {
            if (
                !columnExists(
                    $conn,
                    "tbl_audit_trail",
                    $column
                )
            ) {
                continue;
            }

            $auditColumns[] =
                "`{$column}`";

            $auditValues[] =
                ":audit_{$column}";

            $auditParameters[
                ":audit_{$column}"
            ] = $value;
        }

        if (
            columnExists(
                $conn,
                "tbl_audit_trail",
                "created_at"
            )
        ) {
            $auditColumns[] =
                "`created_at`";

            $auditValues[] =
                "NOW()";
        }

        if (
            count($auditColumns) > 0
        ) {
            $auditStmt = $conn->prepare("
                INSERT INTO tbl_audit_trail
                (" .
                    implode(
                        ", ",
                        $auditColumns
                    ) .
                ")
                VALUES
                (" .
                    implode(
                        ", ",
                        $auditValues
                    ) .
                ")
            ");

            $auditStmt->execute(
                $auditParameters
            );
        }
    }

    $conn->commit();

    respond(
        true,
        "Expense recorded successfully.",
        [
            "expense" => [
                "expense_id" =>
                    $expenseId,
                "expense_no" =>
                    $expenseNo,
                "expense_category" =>
                    $expenseCategory,
                "material_name" =>
                    $materialName,
                "quantity" =>
                    $quantity,
                "unit" =>
                    $unit,
                "unit_cost" =>
                    $unitCost,
                "total_cost" =>
                    $totalCost,
                "expense_date" =>
                    $expenseDate,
                "recorded_by" =>
                    $recordedBy,
                "recorded_by_name" =>
                    $recordedByName,
                "remarks" =>
                    $remarks !== ""
                        ? $remarks
                        : null,
                "status" =>
                    "Active"
            ]
        ]
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "expense_management/add_expense.php: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to record the expense.",
        [
            "error" =>
                $error->getMessage()
        ],
        500
    );
}