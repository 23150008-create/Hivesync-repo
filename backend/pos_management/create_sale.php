<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");


require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../helpers/expiry_processor.php");
require_once("../auth/auth_guard.php");

requireAuthentication();
requireAnyRole(["Admin", "Staff"]);

$modulePermissions = $_SESSION["module_permissions"] ?? [];

if (!is_array($modulePermissions)) {
    $modulePermissions = [];
}

$hasLandingPermission = in_array("landing", $modulePermissions, true);
$hasPosPermission = in_array("pos", $modulePermissions, true);

if (!$hasLandingPermission && !$hasPosPermission) {
    authRespond(
        false,
        "You do not have permission to access this resource.",
        403
    );
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Only POST requests are allowed."
    ]);

    exit;
}

requireCsrfToken();

require_once("../helpers/inventory_alert_communication.php");
require_once("../helpers/supplier_communication.php");

function tableExists(PDO $conn, string $tableName): bool
{
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


function respond(
    bool $success,
    string $message,
    array $extra = [],
    int $statusCode = 200
): void {
    http_response_code($statusCode);

    echo json_encode(array_merge([
        "success" => $success,
        "message" => $message
    ], $extra));

    exit;
}

function generateTransactionCode(PDO $conn): string
{
    $year = date("y");
    $prefix = $year . "-";

    $stmt = $conn->prepare("
        SELECT transaction_code
        FROM tbl_pos
        WHERE transaction_code LIKE :pattern
        ORDER BY pos_id DESC
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":pattern" => $prefix . "%"
    ]);

    $lastCode = $stmt->fetchColumn();
    $nextNumber = 1;

    if (
        $lastCode &&
        preg_match(
            "/^" . preg_quote($prefix, "/") . "(\d{5})$/",
            $lastCode,
            $matches
        )
    ) {
        $nextNumber = ((int)$matches[1]) + 1;
    }

    return $prefix .
        str_pad(
            (string)$nextNumber,
            5,
            "0",
            STR_PAD_LEFT
        );
}


function generateReceivablePaymentReference(PDO $conn): string
{
    $prefix = "RP-" . date("ymd") . "-";

    $stmt = $conn->prepare("
        SELECT payment_reference
        FROM tbl_receivable_payments
        WHERE payment_reference LIKE :pattern
        ORDER BY payment_id DESC
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":pattern" => $prefix . "%"
    ]);

    $lastReference = $stmt->fetchColumn();
    $nextNumber = 1;

    if (
        $lastReference &&
        preg_match(
            "/^" . preg_quote($prefix, "/") . "(\d{4})$/",
            $lastReference,
            $matches
        )
    ) {
        $nextNumber = ((int)$matches[1]) + 1;
    }

    return $prefix .
        str_pad(
            (string)$nextNumber,
            4,
            "0",
            STR_PAD_LEFT
        );
}



function getExistingSaleByRequestToken(
    PDO $conn,
    string $requestToken
): ?array {
    if (
        $requestToken === "" ||
        !columnExists(
            $conn,
            "tbl_pos",
            "request_token"
        )
    ) {
        return null;
    }

    $stmt = $conn->prepare("
        SELECT
            pos_id,
            transaction_code,
            request_token,
            customer_name,
            employee_name,
            office_name,
            cashier_id,
            subtotal_amount,
            total_amount,
            discount,
            discount_percent,
            payment_amount,
            payment_type,
            payment_method,
            payment_reference,
            change_amount,
            transaction_status,
            transaction_date
        FROM tbl_pos
        WHERE request_token = :request_token
        LIMIT 1
    ");

    $stmt->execute([
        ":request_token" => $requestToken
    ]);

    $sale = $stmt->fetch(PDO::FETCH_ASSOC);

    return $sale ?: null;
}


function buildExistingSaleResponse(
    PDO $conn,
    array $sale
): array {
    $posId = (int)($sale["pos_id"] ?? 0);

    $paymentType = trim(
        (string)(
            $sale["payment_type"] ??
            "Cash"
        )
    );

    $paymentMethod = trim(
        (string)(
            $sale["payment_method"] ??
            "Cash"
        )
    );

    $totalAmount = round(
        (float)($sale["total_amount"] ?? 0),
        2
    );

    $paymentAmount = round(
        (float)($sale["payment_amount"] ?? 0),
        2
    );

    $amountPaid =
        $paymentType === "Receivable"
            ? min(
                $paymentAmount,
                $totalAmount
            )
            : $totalAmount;

    $balanceAmount =
        $paymentType === "Receivable"
            ? round(
                max(
                    0,
                    $totalAmount - $amountPaid
                ),
                2
            )
            : 0.00;

    $receivableId = null;

    if (
        $posId > 0 &&
        tableExists(
            $conn,
            "tbl_receivables"
        )
    ) {
        $receivableStmt = $conn->prepare("
            SELECT receivable_id
            FROM tbl_receivables
            WHERE pos_id = :pos_id
            ORDER BY receivable_id DESC
            LIMIT 1
        ");

        $receivableStmt->execute([
            ":pos_id" => $posId
        ]);

        $receivableValue =
            $receivableStmt->fetchColumn();

        if ($receivableValue !== false) {
            $receivableId =
                (int)$receivableValue;
        }
    }

    return [
        "pos_id" => $posId,
        "sale_id" => $posId,
        "transaction_code" =>
            (string)(
                $sale["transaction_code"] ??
                ""
            ),
        "sale_number" =>
            (string)(
                $sale["transaction_code"] ??
                ""
            ),
        "subtotal_amount" =>
            round(
                (float)(
                    $sale["subtotal_amount"] ??
                    0
                ),
                2
            ),
        "discount" =>
            round(
                (float)(
                    $sale["discount"] ??
                    0
                ),
                2
            ),
        "discount_percent" =>
            round(
                (float)(
                    $sale["discount_percent"] ??
                    0
                ),
                2
            ),
        "total_amount" =>
            $totalAmount,
        "cash_amount" =>
            $paymentMethod === "Cash"
                ? $paymentAmount
                : 0,
        "payment_amount" =>
            $paymentAmount,
        "change_amount" =>
            round(
                (float)(
                    $sale["change_amount"] ??
                    0
                ),
                2
            ),
        "payment_type" =>
            $paymentType,
        "payment_method" =>
            $paymentMethod,
        "payment_reference" =>
            (string)(
                $sale["payment_reference"] ??
                ""
            ),
        "receivable_id" =>
            $receivableId,
        "amount_paid" =>
            $amountPaid,
        "balance_amount" =>
            $balanceAmount,
        "due_date" => null,
        "employee_name" =>
            $paymentType === "Receivable"
                ? (
                    $sale["employee_name"] ??
                    null
                )
                : null,
        "office_name" =>
            $paymentType === "Receivable"
                ? (
                    $sale["office_name"] ??
                    null
                )
                : null,
        "transaction_status" =>
            (string)(
                $sale["transaction_status"] ??
                "Completed"
            ),

        "post_processing_required" =>
            false,
        "post_processing_action" =>
            "reorder_notifications",
        "reorder_events" => [],
        "duplicate_request" => true,
        "request_token" =>
            (string)(
                $sale["request_token"] ??
                ""
            )
    ];
}


function acquireCheckoutRequestLock(
    PDO $conn,
    string $requestToken
): ?string {
    if ($requestToken === "") {
        return null;
    }

    $lockName =
        "hsp_" .
        substr(
            hash(
                "sha256",
                $requestToken
            ),
            0,
            60
        );

    $stmt = $conn->prepare("
        SELECT GET_LOCK(
            :lock_name,
            20
        )
    ");

    $stmt->execute([
        ":lock_name" => $lockName
    ]);

    $acquired =
        (int)$stmt->fetchColumn();

    if ($acquired !== 1) {
        throw new Exception(
            "This checkout is still being processed. Please wait a moment and try again."
        );
    }

    return $lockName;
}


function releaseCheckoutRequestLock(
    PDO $conn,
    ?string $lockName
): void {
    if (!$lockName) {
        return;
    }

    try {
        $stmt = $conn->prepare("
            SELECT RELEASE_LOCK(
                :lock_name
            )
        ");

        $stmt->execute([
            ":lock_name" => $lockName
        ]);
    } catch (Throwable $error) {
        error_log(
            "Unable to release POS checkout request lock: " .
            $error->getMessage()
        );
    }
}


$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    respond(
        false,
        "No transaction data was received.",
        [],
        422
    );
}

$items = $data["items"] ?? [];

$requestToken = trim(
    (string)(
        $data["request_token"] ??
        ""
    )
);

if (
    $requestToken !== "" &&
    (
        strlen($requestToken) < 16 ||
        strlen($requestToken) > 64 ||
        !preg_match(
            '/^[A-Za-z0-9._:-]+$/',
            $requestToken
        )
    )
) {
    respond(
        false,
        "The checkout request token is invalid.",
        [],
        422
    );
}


$cashierId = (int)($_SESSION["user_id"] ?? 0);

if ($cashierId <= 0) {
    respond(
        false,
        "A valid logged-in cashier is required.",
        [],
        401
    );
}

$customerName = trim(
    $data["customer_name"] ?? "WALK IN CLIENT"
);

$companyAddress = trim(
    $data["company_address"] ?? ""
);

$remarks = trim(
    $data["remarks"] ?? ""
);

$preparedBy = trim(
    $data["prepared_by"] ?? ""
);

$receivedBy = trim(
    $data["received_by"] ?? ""
);

$paymentType = trim(
    (string)($data["payment_type"] ?? "Cash")
);

$allowedPaymentTypes = [
    "Cash",
    "Receivable"
];

if (!in_array($paymentType, $allowedPaymentTypes, true)) {
    respond(
        false,
        "Invalid payment type.",
        [],
        422
    );
}

$employeeName = trim(
    (string)($data["employee_name"] ?? "")
);

$officeName = trim(
    (string)($data["office_name"] ?? "")
);

$receivableNotes = trim(
    (string)($data["receivable_notes"] ?? "")
);

$cashAmount = (float)(
    $data["cash_amount"] ??
    $data["payment_amount"] ??
    0
);

$paymentMethod = trim(
    (string)(
        $data["payment_method"] ??
        "Cash"
    )
);

$paymentReference = trim(
    (string)(
        $data["payment_reference"] ??
        $data["reference_number"] ??
        ""
    )
);

$allowedPaymentMethods = [
    "Cash",
    "GCash",
    "Maya",
    "Bank Transfer",
    "Other"
];

if (
    !in_array(
        $paymentMethod,
        $allowedPaymentMethods,
        true
    )
) {
    respond(
        false,
        "Invalid payment method.",
        [],
        422
    );
}

if (
    (
        $paymentType === "Cash" ||
        (
            $paymentType === "Receivable" &&
            $cashAmount > 0
        )
    ) &&
    $paymentMethod !== "Cash" &&
    $paymentReference === ""
) {
    respond(
        false,
        "A payment reference number is required for {$paymentMethod}.",
        [],
        422
    );
}

$discountPercent = max(
    0,
    min(
        100,
        (float)($data["discount_percent"] ?? 0)
    )
);

$requestedDiscountAmount = max(
    0,
    (float)($data["discount"] ?? 0)
);

if (!is_array($items) || count($items) === 0) {
    respond(
        false,
        "The cart is empty.",
        [],
        422
    );
}

if ($customerName === "") {
    respond(
        false,
        "Customer name is required.",
        [],
        422
    );
}


$cashierColumns = [
    "user_id",
    "full_name",
    "role"
];

if (columnExists($conn, "tbl_user", "status")) {
    $cashierColumns[] = "status";
}

$cashierStmt = $conn->prepare("
    SELECT " . implode(", ", $cashierColumns) . "
    FROM tbl_user
    WHERE user_id = :user_id
    LIMIT 1
");

$cashierStmt->execute([
    ":user_id" => $cashierId
]);

$cashier = $cashierStmt->fetch(PDO::FETCH_ASSOC);

if (!$cashier) {
    respond(
        false,
        "The logged-in cashier account was not found.",
        [],
        403
    );
}

if (
    !in_array(
        $cashier["role"] ?? "",
        ["Admin", "Staff"],
        true
    )
) {
    respond(
        false,
        "Only Admin and Staff accounts may process sales.",
        [],
        403
    );
}

if (
    isset($cashier["status"]) &&
    in_array(
        strtolower((string)$cashier["status"]),
        ["archived", "inactive", "disabled"],
        true
    )
) {
    respond(
        false,
        "The cashier account is not active.",
        [],
        403
    );
}

$preparedBy =
    trim((string)($cashier["full_name"] ?? "")) !== ""
        ? trim((string)$cashier["full_name"])
        : $preparedBy;

$checkoutLockName = null;

try {
    if ($requestToken !== "") {
        $checkoutLockName =
            acquireCheckoutRequestLock(
                $conn,
                $requestToken
            );

        $existingSale =
            getExistingSaleByRequestToken(
                $conn,
                $requestToken
            );

        if ($existingSale) {
            if (
                (int)(
                    $existingSale["cashier_id"] ??
                    0
                ) !==
                (int)$cashierId
            ) {
                releaseCheckoutRequestLock(
                    $conn,
                    $checkoutLockName
                );

                $checkoutLockName = null;

                respond(
                    false,
                    "This checkout request token has already been used.",
                    [],
                    409
                );
            }

            $existingResponse =
                buildExistingSaleResponse(
                    $conn,
                    $existingSale
                );

            releaseCheckoutRequestLock(
                $conn,
                $checkoutLockName
            );

            $checkoutLockName = null;

            respond(
                true,
                "Sale already completed. Existing transaction returned.",
                $existingResponse
            );
        }
    }

    processExpiredInventoryBatches($conn);

    $conn->beginTransaction();

    $validatedItems = [];
    $subtotalAmount = 0;
    $reorderEvents = [];

    $hasBatchTable = tableExists(
        $conn,
        "tbl_inventory_batches"
    );

    if (!$hasBatchTable) {
        throw new Exception(
            "Inventory batch tracking is not configured."
        );
    }

    $remainingColumn = columnExists(
        $conn,
        "tbl_inventory_batches",
        "remaining_quantity"
    )
        ? "remaining_quantity"
        : "quantity";

    foreach ($items as $cartItem) {
        $productId = filter_var(
            $cartItem["product_id"] ?? null,
            FILTER_VALIDATE_INT
        );

        $quantity = filter_var(
            $cartItem["quantity"] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$productId || !$quantity || $quantity <= 0) {
            throw new Exception(
                "A cart item contains an invalid product or quantity."
            );
        }

        $productStmt = $conn->prepare("
            SELECT
                i.product_id,
                i.product_name,
                i.sku,
                i.quantity,
                i.reorder_level,
                i.selling_price,
                i.status,
                i.vendor_id,

                COALESCE(
                    (
                        SELECT SUM(
                            CASE
                                WHEN b.{$remainingColumn} > 0
                                AND (
                                    b.expiry_date IS NULL
                                    OR b.expiry_date > CURDATE()
                                )
                                THEN b.{$remainingColumn}
                                ELSE 0
                            END
                        )
                        FROM tbl_inventory_batches b
                        WHERE b.product_id =
                              i.product_id
                    ),
                    0
                ) AS valid_batch_stock

            FROM tbl_inv i
            WHERE i.product_id = :product_id
            AND COALESCE(
                i.status,
                'In Stock'
            ) <> 'Archived'
            LIMIT 1
            FOR UPDATE
        ");

        $productStmt->execute([
            ":product_id" => $productId
        ]);

        $product = $productStmt->fetch(PDO::FETCH_ASSOC);

        if (!$product) {
            throw new Exception(
                "A product in the cart no longer exists or has been archived."
            );
        }

        $availableStock = (int)(
            $product["valid_batch_stock"] ?? 0
        );

        if ($availableStock < $quantity) {
            throw new Exception(
                $product["product_name"] .
                " has only " .
                $availableStock .
                " valid batch item(s) available."
            );
        }

        $unitPrice = (float)$product["selling_price"];

        if ($unitPrice <= 0) {
            throw new Exception(
                $product["product_name"] .
                " does not have a valid selling price."
            );
        }

        $lineSubtotal = $quantity * $unitPrice;
        $subtotalAmount += $lineSubtotal;

        $validatedItems[] = [
            "product_id" => (int)$product["product_id"],
            "product_name" => $product["product_name"],
            "sku" => $product["sku"],
            "quantity" => $quantity,
            "price" => $unitPrice,
            "subtotal" => $lineSubtotal,
            "stock_before" => $availableStock,
            "reorder_level" =>
                (int)($product["reorder_level"] ?? 0),
            "vendor_id" =>
                (int)($product["vendor_id"] ?? 0)
        ];
    }

    if ($discountPercent > 0) {
        $discountAmount =
            $subtotalAmount *
            ($discountPercent / 100);
    } else {
        $discountAmount =
            min(
                $requestedDiscountAmount,
                $subtotalAmount
            );

        $discountPercent =
            $subtotalAmount > 0
                ? ($discountAmount / $subtotalAmount) * 100
                : 0;
    }

    $discountAmount = round(
        $discountAmount,
        2
    );

    $discountPercent = round(
        $discountPercent,
        2
    );

    $totalAmount = round(
        $subtotalAmount - $discountAmount,
        2
    );

    if ($paymentType === "Cash") {
        if ($cashAmount < $totalAmount) {
            throw new Exception(
                "Cash received is not enough for the transaction total."
            );
        }

        $amountApplied = round($totalAmount, 2);
        $paymentAmount = round($cashAmount, 2);
        $changeAmount = round(
            max(0, $cashAmount - $totalAmount),
            2
        );
    } else {
        if ($employeeName === "") {
            throw new Exception(
                "Employee name is required for a receivable transaction."
            );
        }

        if ($officeName === "") {
            throw new Exception(
                "Office or department is required for a receivable transaction."
            );
        }

        if ($cashAmount < 0) {
            throw new Exception(
                "Initial payment cannot be negative."
            );
        }

        if ($cashAmount >= $totalAmount) {
            throw new Exception(
                "A receivable transaction must have a remaining balance."
            );
        }

        $amountApplied = round($cashAmount, 2);
        $paymentAmount = $amountApplied;
        $changeAmount = 0.00;
        $paymentReference = "";
    }

    $balanceAmount = round(
        max(0, $totalAmount - $amountApplied),
        2
    );

    $transactionCode =
        generateTransactionCode($conn);

    $saleColumns = [
        "transaction_code",
        "customer_name",
        "company_address",
        "remarks",
        "prepared_by",
        "received_by",
        "cashier_id",
        "subtotal_amount",
        "total_amount",
        "discount",
        "discount_percent",
        "payment_amount",
        "change_amount",
        "transaction_status",
        "refunded_amount",
        "transaction_date",
        "updated_at"
    ];

    $saleValues = [
        ":transaction_code",
        ":customer_name",
        ":company_address",
        ":remarks",
        ":prepared_by",
        ":received_by",
        ":cashier_id",
        ":subtotal_amount",
        ":total_amount",
        ":discount",
        ":discount_percent",
        ":payment_amount",
        ":change_amount",
        "'Completed'",
        "0.00",
        "NOW()",
        "NOW()"
    ];

    $saleParams = [
        ":transaction_code" =>
            $transactionCode,
        ":customer_name" =>
            $paymentType === "Receivable"
                ? $employeeName
                : $customerName,
        ":company_address" =>
            $companyAddress !== ""
                ? $companyAddress
                : null,
        ":remarks" =>
            $remarks !== ""
                ? $remarks
                : null,
        ":prepared_by" =>
            $preparedBy !== ""
                ? $preparedBy
                : null,
        ":received_by" =>
            $receivedBy !== ""
                ? $receivedBy
                : null,
        ":cashier_id" =>
            $cashierId,
        ":subtotal_amount" =>
            $subtotalAmount,
        ":total_amount" =>
            $totalAmount,
        ":discount" =>
            $discountAmount,
        ":discount_percent" =>
            $discountPercent,
        ":payment_amount" =>
            $paymentAmount,
        ":change_amount" =>
            $changeAmount
    ];

    if (
        $requestToken !== "" &&
        columnExists(
            $conn,
            "tbl_pos",
            "request_token"
        )
    ) {
        $saleColumns[] =
            "request_token";

        $saleValues[] =
            ":request_token";

        $saleParams[
            ":request_token"
        ] = $requestToken;
    }

    if (
        columnExists(
            $conn,
            "tbl_pos",
            "employee_name"
        )
    ) {
        $saleColumns[] = "employee_name";
        $saleValues[] = ":employee_name";
        $saleParams[":employee_name"] =
            $paymentType === "Receivable"
                ? $employeeName
                : null;
    }

    if (
        columnExists(
            $conn,
            "tbl_pos",
            "office_name"
        )
    ) {
        $saleColumns[] = "office_name";
        $saleValues[] = ":office_name";
        $saleParams[":office_name"] =
            $paymentType === "Receivable"
                ? $officeName
                : null;
    }

    if (
        columnExists(
            $conn,
            "tbl_pos",
            "payment_type"
        )
    ) {
        $saleColumns[] = "payment_type";
        $saleValues[] = ":payment_type";
        $saleParams[":payment_type"] = $paymentType;
    }

    if (
        columnExists(
            $conn,
            "tbl_pos",
            "payment_method"
        )
    ) {
        $saleColumns[] =
            "payment_method";
        $saleValues[] =
            ":payment_method";
        $saleParams[
            ":payment_method"
        ] = $paymentMethod;
    }

    if (
        columnExists(
            $conn,
            "tbl_pos",
            "payment_reference"
        )
    ) {
        $saleColumns[] =
            "payment_reference";
        $saleValues[] =
            ":payment_reference";
        $saleParams[
            ":payment_reference"
        ] =
            $paymentReference !== ""
                ? $paymentReference
                : null;
    } elseif (
        columnExists(
            $conn,
            "tbl_pos",
            "reference_number"
        )
    ) {
        $saleColumns[] =
            "reference_number";
        $saleValues[] =
            ":reference_number";
        $saleParams[
            ":reference_number"
        ] =
            $paymentReference !== ""
                ? $paymentReference
                : null;
    }

    $saleStmt = $conn->prepare("
        INSERT INTO tbl_pos
        (
            " .
            implode(
                ", ",
                $saleColumns
            ) .
        ")
        VALUES
        (
            " .
            implode(
                ", ",
                $saleValues
            ) .
        ")
    ");

    $saleStmt->execute(
        $saleParams
    );

    $posId = (int)$conn->lastInsertId();

    $receivableId = null;
    $initialPaymentReference = null;

    if (
        $paymentType === "Receivable" &&
        $balanceAmount > 0
    ) {
        if (
            !tableExists($conn, "tbl_receivables") ||
            !tableExists($conn, "tbl_receivable_payments")
        ) {
            throw new Exception(
                "Receivables are not configured. Run the receivables database migration first."
            );
        }

        $receivableStatus =
            $amountApplied > 0
                ? "Partially Paid"
                : "Unpaid";

        $receivableStmt = $conn->prepare("
            INSERT INTO tbl_receivables
            (
                pos_id,
                receivable_type,
                employee_name,
                office_name,
                customer_name,
                original_amount,
                amount_paid,
                balance_amount,
                due_date,
                status,
                notes,
                created_by,
                created_at,
                updated_at
            )
            VALUES
            (
                :pos_id,
                'Employee',
                :employee_name,
                :office_name,
                :customer_name,
                :original_amount,
                :amount_paid,
                :balance_amount,
                NULL,
                :status,
                :notes,
                :created_by,
                NOW(),
                NOW()
            )
        ");

        $receivableStmt->execute([
            ":pos_id" => $posId,
            ":employee_name" => $employeeName,
            ":office_name" => $officeName,
            ":customer_name" => $employeeName,
            ":original_amount" => $totalAmount,
            ":amount_paid" => $amountApplied,
            ":balance_amount" => $balanceAmount,
            ":status" => $receivableStatus,
            ":notes" =>
                $receivableNotes !== ""
                    ? $receivableNotes
                    : null,
            ":created_by" => $cashierId
        ]);

        $receivableId = (int)$conn->lastInsertId();

        if ($amountApplied > 0) {
            $initialPaymentReference =
                generateReceivablePaymentReference($conn);

            $initialPaymentStmt = $conn->prepare("
                INSERT INTO tbl_receivable_payments
                (
                    receivable_id,
                    payment_reference,
                    amount_paid,
                    payment_method,
                    remarks,
                    received_by,
                    received_by_name,
                    payment_date,
                    created_at
                )
                VALUES
                (
                    :receivable_id,
                    :payment_reference,
                    :amount_paid,
                    :payment_method,
                    :remarks,
                    :received_by,
                    :received_by_name,
                    NOW(),
                    NOW()
                )
            ");

            $initialPaymentStmt->execute([
                ":receivable_id" => $receivableId,
                ":payment_reference" =>
                    $initialPaymentReference,
                ":amount_paid" => $amountApplied,
                ":payment_method" => $paymentMethod,
                ":remarks" =>
                    "Initial partial payment for POS transaction " .
                    $transactionCode .
                    (
                        $paymentReference !== ""
                            ? " / external reference " . $paymentReference
                            : ""
                    ),
                ":received_by" => $cashierId,
                ":received_by_name" =>
                    $preparedBy !== ""
                        ? $preparedBy
                        : "Unknown Cashier"
            ]);
        }
    }

    $itemStmt = $conn->prepare("
        INSERT INTO tbl_pos_items
        (
            pos_id,
            product_id,
            quantity,
            returned_quantity,
            price,
            subtotal,
            refunded_amount,
            item_status
        )
        VALUES
        (
            :pos_id,
            :product_id,
            :quantity,
            0,
            :price,
            :subtotal,
            0.00,
            'Sold'
        )
    ");

    $historyStmt = null;

    if (
        tableExists(
            $conn,
            "tbl_inventory_history"
        )
    ) {
        $historyStmt = $conn->prepare("
            INSERT INTO tbl_inventory_history
            (
                product_id,
                action_type,
                quantity,
                remarks,
                created_by,
                created_at
            )
            VALUES
            (
                :product_id,
                'Stock Out',
                :quantity,
                :remarks,
                :created_by,
                NOW()
            )
        ");
    }

    foreach ($validatedItems as $item) {
        $itemStmt->execute([
            ":pos_id" => $posId,
            ":product_id" => $item["product_id"],
            ":quantity" => $item["quantity"],
            ":price" => $item["price"],
            ":subtotal" => $item["subtotal"]
        ]);

        $batchStmt = $conn->prepare("
            SELECT
                batch_id,
                {$remainingColumn} AS available_quantity,
                expiry_date,
                created_at
            FROM tbl_inventory_batches
            WHERE product_id = :product_id
            AND {$remainingColumn} > 0
            AND (
                expiry_date IS NULL
                OR expiry_date > CURDATE()
            )
            ORDER BY
                CASE
                    WHEN expiry_date IS NULL THEN 1
                    ELSE 0
                END,
                expiry_date ASC,
                created_at ASC,
                batch_id ASC
            FOR UPDATE
        ");

        $batchStmt->execute([
            ":product_id" => $item["product_id"]
        ]);

        $batches = $batchStmt->fetchAll(PDO::FETCH_ASSOC);
        $quantityNeeded = (int)$item["quantity"];

        foreach ($batches as $batch) {
            if ($quantityNeeded <= 0) {
                break;
            }

            $available =
                (int)$batch["available_quantity"];

            $deductQuantity = min(
                $available,
                $quantityNeeded
            );

            $deductStmt = $conn->prepare("
                UPDATE tbl_inventory_batches
                SET {$remainingColumn} =
                    {$remainingColumn} - :deduct_quantity
                WHERE batch_id = :batch_id
                AND {$remainingColumn} >= :deduct_quantity_check
            ");

            $deductStmt->execute([
                ":deduct_quantity" => $deductQuantity,
                ":deduct_quantity_check" => $deductQuantity,
                ":batch_id" => $batch["batch_id"]
            ]);

            if ($deductStmt->rowCount() !== 1) {
                throw new Exception(
                    "The inventory batch changed while processing the sale. Please try again."
                );
            }

            $quantityNeeded -= $deductQuantity;
        }

        if ($quantityNeeded > 0) {
            throw new Exception(
                $item["product_name"] .
                " does not have enough batch stock to complete the sale."
            );
        }

        $summaryStmt = $conn->prepare("
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN {$remainingColumn} > 0
                            AND (
                                expiry_date IS NULL
                                OR expiry_date > CURDATE()
                            )
                            THEN {$remainingColumn}
                            ELSE 0
                        END
                    ),
                    0
                ) AS total_stock,

                MIN(
                    CASE
                        WHEN {$remainingColumn} > 0
                        AND expiry_date > CURDATE()
                        THEN expiry_date
                        ELSE NULL
                    END
                ) AS nearest_expiry

            FROM tbl_inventory_batches
            WHERE product_id = :product_id
        ");

        $summaryStmt->execute([
            ":product_id" => $item["product_id"]
        ]);

        $summary =
            $summaryStmt->fetch(PDO::FETCH_ASSOC);

        $newQuantity =
            (int)($summary["total_stock"] ?? 0);

        $nearestExpiry =
            $summary["nearest_expiry"] ?? null;

        $stockStmt = $conn->prepare("
            UPDATE tbl_inv
            SET
                quantity = :new_quantity,
                expiry_date = :nearest_expiry,
                status = CASE
                    WHEN :status_quantity_1 <= 0
                        THEN 'Out of Stock'
                    WHEN :status_quantity_2 <= reorder_level
                        THEN 'Low Stock'
                    ELSE 'In Stock'
                END,
                updated_at = NOW()
            WHERE product_id = :product_id
        ");

        $stockStmt->execute([
            ":new_quantity" => $newQuantity,
            ":nearest_expiry" => $nearestExpiry,
            ":status_quantity_1" => $newQuantity,
            ":status_quantity_2" => $newQuantity,
            ":product_id" => $item["product_id"]
        ]);

        $reorderLevel =
            (int)($item["reorder_level"] ?? 0);

        $stockBefore =
            (int)($item["stock_before"] ?? 0);

        if (
            $reorderLevel > 0 &&
            $stockBefore > $reorderLevel &&
            $newQuantity <= $reorderLevel
        ) {
            $reorderEvents[] = [
                "product_id" =>
                    (int)$item["product_id"],
                "product_name" =>
                    (string)$item["product_name"],
                "sku" =>
                    (string)($item["sku"] ?? ""),
                "vendor_id" =>
                    (int)($item["vendor_id"] ?? 0),
                "quantity" => $newQuantity,
                "reorder_level" =>
                    $reorderLevel
            ];
        }

        if ($historyStmt) {
            $historyStmt->execute([
                ":product_id" => $item["product_id"],
                ":quantity" => $item["quantity"],
                ":remarks" =>
                    "POS sale " .
                    $transactionCode .
                    " for " .
                    $customerName .
                    " using valid FEFO batch deduction",
                ":created_by" => $cashierId
            ]);
        }
    }

    $conn->commit();

    releaseCheckoutRequestLock(
        $conn,
        $checkoutLockName
    );

    $checkoutLockName = null;

    respond(
        true,
        "Sale completed successfully.",
        [
            "pos_id" => $posId,
            "sale_id" => $posId,
            "transaction_code" => $transactionCode,
            "sale_number" => $transactionCode,
            "subtotal_amount" => $subtotalAmount,
            "discount" => $discountAmount,
            "discount_percent" => $discountPercent,
            "total_amount" => $totalAmount,
            "cash_amount" =>
                $paymentMethod === "Cash"
                    ? $cashAmount
                    : 0,
            "payment_amount" =>
                $paymentAmount,
            "change_amount" =>
                $changeAmount,
            "payment_type" =>
                $paymentType,
            "payment_method" =>
                $paymentMethod,
            "payment_reference" =>
                $paymentReference,
            "receivable_id" =>
                $receivableId,
            "amount_paid" =>
                $amountApplied,
            "balance_amount" =>
                $balanceAmount,
            "due_date" => null,
            "employee_name" =>
                $paymentType === "Receivable"
                    ? $employeeName
                    : null,
            "office_name" =>
                $paymentType === "Receivable"
                    ? $officeName
                    : null,
            "transaction_status" =>
                "Completed",
            "duplicate_request" =>
                false,
            "request_token" =>
                $requestToken !== ""
                    ? $requestToken
                    : null,

            "post_processing_required" =>
                count($reorderEvents) > 0,
            "post_processing_action" =>
                "reorder_notifications",
            "reorder_events" =>
                $reorderEvents
        ]
    );
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    releaseCheckoutRequestLock(
        $conn,
        $checkoutLockName
    );

    $checkoutLockName = null;

    respond(
        false,
        $e->getMessage(),
        [],
        500
    );
}