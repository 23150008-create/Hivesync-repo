<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");

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
     * The schema does not change during a single payment request,
     * so repeated information_schema lookups are cached in memory.
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


function generatePaymentReference(PDO $conn): string
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
            "/^" .
            preg_quote($prefix, "/") .
            "(\d{4})$/",
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

function insertAuditLog(
    PDO $conn,
    ?int $userId,
    string $userName,
    string $action,
    string $details
): void {
    if (!tableExists($conn, "tbl_audit_trail")) {
        return;
    }

    $columns = [];
    $placeholders = [];
    $params = [];

    $data = [
        "user_id" => $userId,
        "user_name" => $userName,
        "module" => "Point of Sale",
        "action" => $action,
        "details" => $details
    ];

    foreach ($data as $column => $value) {
        if (
            !columnExists(
                $conn,
                "tbl_audit_trail",
                $column
            )
        ) {
            continue;
        }

        $columns[] = "`{$column}`";
        $placeholders[] = ":{$column}";
        $params[":{$column}"] = $value;
    }

    if (
        columnExists(
            $conn,
            "tbl_audit_trail",
            "created_at"
        )
    ) {
        $columns[] = "`created_at`";
        $placeholders[] = "NOW()";
    }

    if (!$columns) {
        return;
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_audit_trail
        (" . implode(", ", $columns) . ")
        VALUES
        (" . implode(", ", $placeholders) . ")
    ");

    $stmt->execute($params);
}


function getExistingReceivablePaymentByToken(
    PDO $conn,
    string $requestToken
): ?array {
    if (
        $requestToken === "" ||
        !columnExists(
            $conn,
            "tbl_receivable_payments",
            "request_token"
        )
    ) {
        return null;
    }

    $stmt = $conn->prepare("
        SELECT
            rp.payment_id,
            rp.receivable_id,
            rp.payment_reference,
            rp.request_token,
            rp.amount_paid,
            rp.payment_method,
            rp.remarks,
            rp.received_by,
            rp.received_by_name,
            rp.payment_date,

            r.pos_id,
            r.source_type,
            r.source_reference,
            r.original_amount,
            r.amount_paid AS total_paid,
            r.balance_amount,
            r.status,

            COALESCE(
                p.transaction_code,
                r.source_reference
            ) AS transaction_code,

            COALESCE(
                NULLIF(r.employee_name, ''),
                NULLIF(r.customer_name, ''),
                p.employee_name,
                p.customer_name,
                'Unknown Employee'
            ) AS display_employee_name,

            COALESCE(
                NULLIF(r.office_name, ''),
                p.office_name,
                'Not Specified'
            ) AS display_office_name

        FROM tbl_receivable_payments rp

        INNER JOIN tbl_receivables r
            ON r.receivable_id =
               rp.receivable_id

        LEFT JOIN tbl_pos p
            ON p.pos_id = r.pos_id

        WHERE rp.request_token =
            :request_token

        LIMIT 1
    ");

    $stmt->execute([
        ":request_token" => $requestToken
    ]);

    $payment =
        $stmt->fetch(PDO::FETCH_ASSOC);

    return $payment ?: null;
}


function buildExistingReceivablePaymentResponse(
    array $payment
): array {
    $paymentAmount = round(
        (float)(
            $payment["amount_paid"] ??
            0
        ),
        2
    );

    $totalPaid = round(
        (float)(
            $payment["total_paid"] ??
            0
        ),
        2
    );

    $remainingBalance = round(
        (float)(
            $payment["balance_amount"] ??
            0
        ),
        2
    );

    $paymentDate =
        (string)(
            $payment["payment_date"] ??
            date("Y-m-d H:i:s")
        );

    return [
        "payment_id" =>
            (int)(
                $payment["payment_id"] ??
                0
            ),
        "payment_reference" =>
            (string)(
                $payment["payment_reference"] ??
                ""
            ),
        "receivable_id" =>
            (int)(
                $payment["receivable_id"] ??
                0
            ),
        "pos_id" =>
            !empty($payment["pos_id"])
                ? (int)$payment["pos_id"]
                : null,
        "source_type" =>
            $payment["source_type"] ??
            "POS",
        "source_reference" =>
            $payment["source_reference"] ??
            null,
        "transaction_code" =>
            $payment["transaction_code"] ??
            null,
        "employee_name" =>
            $payment[
                "display_employee_name"
            ] ??
            "Unknown Employee",
        "office_name" =>
            $payment[
                "display_office_name"
            ] ??
            "Not Specified",
        "amount_paid" =>
            $paymentAmount,
        "total_paid" =>
            $totalPaid,
        "remaining_balance" =>
            $remainingBalance,
        "status" =>
            (string)(
                $payment["status"] ??
                ""
            ),
        "payment_method" =>
            (string)(
                $payment["payment_method"] ??
                "Cash"
            ),
        "remarks" =>
            $payment["remarks"] ??
            null,
        "received_by_name" =>
            (string)(
                $payment["received_by_name"] ??
                "Unknown User"
            ),
        "payment_date" =>
            $paymentDate,
        "duplicate_request" =>
            true,
        "request_token" =>
            (string)(
                $payment["request_token"] ??
                ""
            ),
        "receipt" => [
            "document_title" =>
                "RECEIVABLE PAYMENT RECEIPT",
            "payment_reference" =>
                (string)(
                    $payment[
                        "payment_reference"
                    ] ??
                    ""
                ),
            "receivable_id" =>
                (int)(
                    $payment[
                        "receivable_id"
                    ] ??
                    0
                ),
            "transaction_code" =>
                $payment[
                    "transaction_code"
                ] ??
                null,
            "employee_name" =>
                $payment[
                    "display_employee_name"
                ] ??
                "Unknown Employee",
            "office_name" =>
                $payment[
                    "display_office_name"
                ] ??
                "Not Specified",
            "original_amount" =>
                (float)(
                    $payment[
                        "original_amount"
                    ] ??
                    0
                ),
            "previously_paid" =>
                max(
                    0,
                    $totalPaid -
                    $paymentAmount
                ),
            "payment_amount" =>
                $paymentAmount,
            "total_paid" =>
                $totalPaid,
            "remaining_balance" =>
                $remainingBalance,
            "status" =>
                (string)(
                    $payment["status"] ??
                    ""
                ),
            "payment_method" =>
                (string)(
                    $payment[
                        "payment_method"
                    ] ??
                    "Cash"
                ),
            "remarks" =>
                $payment["remarks"] ??
                null,
            "received_by_name" =>
                (string)(
                    $payment[
                        "received_by_name"
                    ] ??
                    "Unknown User"
                ),
            "payment_date" =>
                $paymentDate
        ]
    ];
}


function acquireReceivablePaymentRequestLock(
    PDO $conn,
    string $requestToken
): ?string {
    if ($requestToken === "") {
        return null;
    }

    $lockName =
        "hrp_" .
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

    if (
        (int)$stmt->fetchColumn() !== 1
    ) {
        throw new RuntimeException(
            "This receivable payment is still being processed. Please wait a moment and try again."
        );
    }

    return $lockName;
}


function releaseReceivablePaymentRequestLock(
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
            "Unable to release receivable payment request lock: " .
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
        "No payment data was received.",
        [],
        422
    );
}

$receivableId = filter_var(
    $data["receivable_id"] ?? null,
    FILTER_VALIDATE_INT
);

$amount = round(
    (float)($data["amount_paid"] ?? 0),
    2
);

$paymentMethod = trim(
    (string)(
        $data["payment_method"] ?? "Cash"
    )
);

$remarks = trim(
    (string)($data["remarks"] ?? "")
);

$receivedBy = filter_var(
    $data["received_by"] ?? null,
    FILTER_VALIDATE_INT
);

$receivedByName = trim(
    (string)(
        $data["received_by_name"] ??
        "Unknown User"
    )
);

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
        "The payment request token is invalid.",
        [],
        422
    );
}

$allowedMethods = [
    "Cash",
    "Bank Transfer",
    "GCash",
    "Maya",
    "Cheque",
    "Other"
];

if (!$receivableId) {
    respond(
        false,
        "A valid receivable ID is required.",
        [],
        422
    );
}

if ($amount <= 0) {
    respond(
        false,
        "Payment amount must be greater than zero.",
        [],
        422
    );
}

if (
    !in_array(
        $paymentMethod,
        $allowedMethods,
        true
    )
) {
    respond(
        false,
        "The selected payment method is invalid.",
        [],
        422
    );
}

if (
    !tableExists($conn, "tbl_receivables") ||
    !tableExists(
        $conn,
        "tbl_receivable_payments"
    )
) {
    respond(
        false,
        "Receivables tables are not installed.",
        [],
        500
    );
}

$paymentRequestLockName = null;

try {
    /*
     * Backward compatible:
     * requests without request_token continue to work.
     */
    if ($requestToken !== "") {
        $paymentRequestLockName =
            acquireReceivablePaymentRequestLock(
                $conn,
                $requestToken
            );

        $existingPayment =
            getExistingReceivablePaymentByToken(
                $conn,
                $requestToken
            );

        if ($existingPayment) {
            if (
                (int)(
                    $existingPayment[
                        "receivable_id"
                    ] ??
                    0
                ) !==
                (int)$receivableId
            ) {
                releaseReceivablePaymentRequestLock(
                    $conn,
                    $paymentRequestLockName
                );

                $paymentRequestLockName = null;

                respond(
                    false,
                    "This payment request token has already been used.",
                    [],
                    409
                );
            }

            $existingResponse =
                buildExistingReceivablePaymentResponse(
                    $existingPayment
                );

            releaseReceivablePaymentRequestLock(
                $conn,
                $paymentRequestLockName
            );

            $paymentRequestLockName = null;

            respond(
                true,
                "Payment already recorded. Existing payment returned.",
                $existingResponse
            );
        }
    }

    $conn->beginTransaction();

    $stmt = $conn->prepare("
        SELECT
            r.receivable_id,
            r.pos_id,
            r.source_type,
            r.source_reference,
            r.receivable_type,
            r.employee_name,
            r.office_name,
            r.customer_name,
            r.original_amount,
            r.amount_paid,
            r.balance_amount,
            r.status,
            r.notes,

            COALESCE(
                p.transaction_code,
                r.source_reference
            ) AS transaction_code,
            p.transaction_date,

            COALESCE(
                NULLIF(r.employee_name, ''),
                NULLIF(r.customer_name, ''),
                p.employee_name,
                p.customer_name,
                'Unknown Employee'
            ) AS display_employee_name,

            COALESCE(
                NULLIF(r.office_name, ''),
                p.office_name,
                'Not Specified'
            ) AS display_office_name

        FROM tbl_receivables r

        LEFT JOIN tbl_pos p
            ON p.pos_id = r.pos_id

        WHERE r.receivable_id =
            :receivable_id

        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":receivable_id" => $receivableId
    ]);

    $receivable =
        $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$receivable) {
        throw new RuntimeException(
            "Receivable record not found."
        );
    }

    if (
        in_array(
            $receivable["status"],
            ["Paid", "Cancelled"],
            true
        )
    ) {
        throw new RuntimeException(
            "This receivable is already closed."
        );
    }

    $currentBalance = round(
        (float)$receivable["balance_amount"],
        2
    );

    if ($amount > $currentBalance) {
        throw new RuntimeException(
            "Payment cannot be greater than the remaining balance of ₱" .
            number_format(
                $currentBalance,
                2
            )
        );
    }

    $paymentReference =
        generatePaymentReference($conn);

    $paymentColumns = [
        "receivable_id",
        "payment_reference",
        "amount_paid",
        "payment_method",
        "remarks",
        "received_by",
        "received_by_name",
        "payment_date",
        "created_at"
    ];

    $paymentValues = [
        ":receivable_id",
        ":payment_reference",
        ":amount_paid",
        ":payment_method",
        ":remarks",
        ":received_by",
        ":received_by_name",
        "NOW()",
        "NOW()"
    ];

    $paymentParams = [
        ":receivable_id" =>
            $receivableId,
        ":payment_reference" =>
            $paymentReference,
        ":amount_paid" =>
            $amount,
        ":payment_method" =>
            $paymentMethod,
        ":remarks" =>
            $remarks !== ""
                ? $remarks
                : null,
        ":received_by" =>
            $receivedBy ?: null,
        ":received_by_name" =>
            $receivedByName !== ""
                ? $receivedByName
                : "Unknown User"
    ];

    if (
        $requestToken !== "" &&
        columnExists(
            $conn,
            "tbl_receivable_payments",
            "request_token"
        )
    ) {
        $paymentColumns[] =
            "request_token";

        $paymentValues[] =
            ":request_token";

        $paymentParams[
            ":request_token"
        ] = $requestToken;
    }

    $paymentStmt = $conn->prepare("
        INSERT INTO tbl_receivable_payments
        (
            " .
            implode(
                ", ",
                $paymentColumns
            ) .
        ")
        VALUES
        (
            " .
            implode(
                ", ",
                $paymentValues
            ) .
        ")
    ");

    $paymentStmt->execute(
        $paymentParams
    );

    $paymentId =
        (int)$conn->lastInsertId();

    $newPaid = round(
        (float)$receivable["amount_paid"] +
        $amount,
        2
    );

    $newBalance = round(
        max(
            0,
            (float)$receivable[
                "original_amount"
            ] -
            $newPaid
        ),
        2
    );

    /*
     * Employee receivables have no due date / term,
     * so the only open states are Unpaid and Partially Paid.
     */
    if ($newBalance <= 0) {
        $newStatus = "Paid";
    } elseif ($newPaid > 0) {
        $newStatus = "Partially Paid";
    } else {
        $newStatus = "Unpaid";
    }

    $updateStmt = $conn->prepare("
        UPDATE tbl_receivables
        SET
            amount_paid = :amount_paid,
            balance_amount = :balance_amount,
            status = :status,
            updated_at = NOW()
        WHERE receivable_id =
            :receivable_id
    ");

    $updateStmt->execute([
        ":amount_paid" =>
            $newPaid,
        ":balance_amount" =>
            $newBalance,
        ":status" =>
            $newStatus,
        ":receivable_id" =>
            $receivableId
    ]);

    if (
        !empty($receivable["pos_id"]) &&
        columnExists(
            $conn,
            "tbl_pos",
            "payment_amount"
        )
    ) {
        $posUpdate = $conn->prepare("
            UPDATE tbl_pos
            SET
                payment_amount =
                    :payment_amount,
                updated_at = NOW()
            WHERE pos_id = :pos_id
        ");

        $posUpdate->execute([
            ":payment_amount" =>
                $newPaid,
            ":pos_id" =>
                $receivable["pos_id"]
        ]);
    }

    insertAuditLog(
        $conn,
        $receivedBy ?: null,
        $receivedByName !== ""
            ? $receivedByName
            : "Unknown User",
        "Record Receivable Payment",
        "Recorded {$paymentReference} worth ₱" .
        number_format(
            $amount,
            2
        ) .
        " for employee " .
        $receivable[
            "display_employee_name"
        ] .
        " / transaction " .
        $receivable[
            "transaction_code"
        ] .
        "."
    );

    $conn->commit();

    releaseReceivablePaymentRequestLock(
        $conn,
        $paymentRequestLockName
    );

    $paymentRequestLockName = null;

    respond(
        true,
        "Payment recorded successfully.",
        [
            "payment_id" =>
                $paymentId,
            "payment_reference" =>
                $paymentReference,
            "receivable_id" =>
                $receivableId,
            "pos_id" =>
                !empty($receivable["pos_id"])
                    ? (int)$receivable["pos_id"]
                    : null,
            "source_type" =>
                $receivable["source_type"] ??
                "POS",
            "source_reference" =>
                $receivable["source_reference"] ??
                null,
            "transaction_code" =>
                $receivable[
                    "transaction_code"
                ],
            "employee_name" =>
                $receivable[
                    "display_employee_name"
                ],
            "office_name" =>
                $receivable[
                    "display_office_name"
                ],
            "amount_paid" =>
                $amount,
            "total_paid" =>
                $newPaid,
            "remaining_balance" =>
                $newBalance,
            "status" =>
                $newStatus,
            "payment_method" =>
                $paymentMethod,
            "remarks" =>
                $remarks !== ""
                    ? $remarks
                    : null,
            "received_by_name" =>
                $receivedByName !== ""
                    ? $receivedByName
                    : "Unknown User",
            "payment_date" =>
                date("Y-m-d H:i:s"),
            "duplicate_request" =>
                false,
            "request_token" =>
                $requestToken !== ""
                    ? $requestToken
                    : null,
            "receipt" => [
                "document_title" =>
                    "RECEIVABLE PAYMENT RECEIPT",
                "payment_reference" =>
                    $paymentReference,
                "receivable_id" =>
                    $receivableId,
                "transaction_code" =>
                    $receivable[
                        "transaction_code"
                    ],
                "employee_name" =>
                    $receivable[
                        "display_employee_name"
                    ],
                "office_name" =>
                    $receivable[
                        "display_office_name"
                    ],
                "original_amount" =>
                    (float)$receivable[
                        "original_amount"
                    ],
                "previously_paid" =>
                    (float)$receivable[
                        "amount_paid"
                    ],
                "payment_amount" =>
                    $amount,
                "total_paid" =>
                    $newPaid,
                "remaining_balance" =>
                    $newBalance,
                "status" =>
                    $newStatus,
                "payment_method" =>
                    $paymentMethod,
                "remarks" =>
                    $remarks !== ""
                        ? $remarks
                        : null,
                "received_by_name" =>
                    $receivedByName !== ""
                        ? $receivedByName
                        : "Unknown User",
                "payment_date" =>
                    date("Y-m-d H:i:s")
            ]
        ]
    );

} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    releaseReceivablePaymentRequestLock(
        $conn,
        $paymentRequestLockName
    );

    $paymentRequestLockName = null;

    respond(
        false,
        $error->getMessage(),
        [],
        422
    );
}