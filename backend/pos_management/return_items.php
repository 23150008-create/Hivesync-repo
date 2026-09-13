<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("pos");
requireAnyRole(["Admin", "Staff"]);

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Only POST requests are allowed."
    ]);

    exit;
}

requireCsrfToken();


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

function generateReturnNumber(
    PDO $conn
): string {
    $prefix =
        "RET-" . date("Ymd") . "-";

    $stmt = $conn->prepare("
        SELECT return_number
        FROM tbl_pos_returns
        WHERE return_number LIKE :pattern
        ORDER BY return_id DESC
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":pattern" => $prefix . "%"
    ]);

    $lastNumber = $stmt->fetchColumn();
    $nextNumber = 1;

    if (
        $lastNumber &&
        preg_match(
            "/^" .
            preg_quote($prefix, "/") .
            "(\d{3})$/",
            $lastNumber,
            $matches
        )
    ) {
        $nextNumber =
            ((int)$matches[1]) + 1;
    }

    return $prefix .
        str_pad(
            (string)$nextNumber,
            3,
            "0",
            STR_PAD_LEFT
        );
}

$data = json_decode(
    file_get_contents("php://input"),
    true
);

$posId = filter_var(
    $data["pos_id"] ?? null,
    FILTER_VALIDATE_INT
);

$returnItems = $data["items"] ?? [];

$returnReason = trim(
    $data["return_reason"] ??
    $data["reason"] ??
    ""
);

$processedBy = (int)($_SESSION["user_id"] ?? 0);
$processedByName = trim((string)($_SESSION["full_name"] ?? $_SESSION["email"] ?? ""));
if (!$posId) {
    respond(
        false,
        "A valid transaction ID is required.",
        [],
        422
    );
}

if (
    !is_array($returnItems) ||
    count($returnItems) === 0
) {
    respond(
        false,
        "Select at least one item to return.",
        [],
        422
    );
}

if ($returnReason === "") {
    respond(
        false,
        "A return reason is required.",
        [],
        422
    );
}

if (!$processedBy) {
    respond(
        false,
        "The user processing the return is required.",
        [],
        422
    );
}

try {
    $conn->beginTransaction();

    $processorStmt = $conn->prepare("
        SELECT
            user_id,
            full_name,
            role,
            status
        FROM tbl_user
        WHERE user_id = :user_id
        LIMIT 1
        FOR UPDATE
    ");

    $processorStmt->execute([
        ":user_id" => $processedBy
    ]);

    $processor =
        $processorStmt->fetch(PDO::FETCH_ASSOC);

    if (!$processor) {
        throw new Exception(
            "The user processing the return was not found."
        );
    }

    if (
        !in_array(
            strtolower(trim((string)$processor["role"])),
            ["admin", "staff"],
            true
        )
    ) {
        throw new Exception(
            "Only Admin or Staff users can process POS returns."
        );
    }

    if (
        strtolower(trim((string)$processor["status"])) !==
        "active"
    ) {
        throw new Exception(
            "The user processing the return is not active."
        );
    }

    $processedByName =
        trim((string)$processor["full_name"]);

    $transactionStmt = $conn->prepare("
        SELECT
            pos_id,
            transaction_code,
            subtotal_amount,
            total_amount,
            discount,
            refunded_amount,
            transaction_status,
            transaction_date
        FROM tbl_pos
        WHERE pos_id = :pos_id
        LIMIT 1
        FOR UPDATE
    ");

    $transactionStmt->execute([
        ":pos_id" => $posId
    ]);

    $transaction =
        $transactionStmt->fetch(PDO::FETCH_ASSOC);

    if (!$transaction) {
        throw new Exception(
            "Transaction record was not found."
        );
    }

    if (
        $transaction["transaction_status"] ===
        "Voided"
    ) {
        throw new Exception(
            "A voided transaction cannot be returned."
        );
    }

    if (
        $transaction["transaction_status"] ===
        "Returned"
    ) {
        throw new Exception(
            "All items in this transaction have already been returned."
        );
    }

    $transactionDate = new DateTime(
        $transaction["transaction_date"]
    );

    $today = new DateTime();
    $ageDays = (int)$transactionDate->diff(
        $today
    )->format("%a");

    if ($ageDays > 5) {
        throw new Exception(
            "Returns are allowed only within five calendar days from the transaction date."
        );
    }

    $subtotalAmount =
        (float)$transaction["subtotal_amount"];

    $totalAmount =
        (float)$transaction["total_amount"];

    $netRatio =
        $subtotalAmount > 0
            ? $totalAmount / $subtotalAmount
            : 1;

    $validatedReturns = [];
    $validatedItemIds = [];
    $totalRefund = 0;
    $totalReturnQuantity = 0;

    foreach ($returnItems as $requestedItem) {
        $posItemId = filter_var(
            $requestedItem["item_id"] ??
            $requestedItem["pos_item_id"] ??
            null,
            FILTER_VALIDATE_INT
        );

        $quantityToReturn = filter_var(
            $requestedItem["quantity"] ??
            $requestedItem["quantity_returned"] ??
            null,
            FILTER_VALIDATE_INT
        );

        if (
            !$posItemId ||
            !$quantityToReturn ||
            $quantityToReturn <= 0
        ) {
            throw new Exception(
                "A returned item contains an invalid quantity."
            );
        }

        if (isset($validatedItemIds[$posItemId])) {
            throw new Exception(
                "The same transaction item cannot be submitted more than once in a single return."
            );
        }

        $validatedItemIds[$posItemId] = true;

        $itemStmt = $conn->prepare("
            SELECT
                pi.item_id,
                pi.pos_id,
                pi.product_id,
                pi.quantity,
                pi.returned_quantity,
                pi.price,
                pi.subtotal,
                pi.refunded_amount,
                pi.item_status,
                i.product_name,
                i.reorder_level
            FROM tbl_pos_items pi
            INNER JOIN tbl_inv i
                ON i.product_id = pi.product_id
            WHERE pi.item_id = :item_id
            AND pi.pos_id = :pos_id
            LIMIT 1
            FOR UPDATE
        ");

        $itemStmt->execute([
            ":item_id" => $posItemId,
            ":pos_id" => $posId
        ]);

        $item =
            $itemStmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            throw new Exception(
                "A selected return item does not belong to this transaction."
            );
        }

        $returnableQuantity =
            (int)$item["quantity"] -
            (int)$item["returned_quantity"];

        if (
            $quantityToReturn >
            $returnableQuantity
        ) {
            throw new Exception(
                $item["product_name"] .
                " has only " .
                $returnableQuantity .
                " item(s) available for return."
            );
        }

        $grossRefund =
            $quantityToReturn *
            (float)$item["price"];

        $netRefund = round(
            $grossRefund * $netRatio,
            2
        );

        $validatedReturns[] = [
            "item_id" => (int)$item["item_id"],
            "product_id" =>
                (int)$item["product_id"],
            "product_name" =>
                $item["product_name"],
            "quantity" => $quantityToReturn,
            "original_quantity" =>
                (int)$item["quantity"],
            "old_returned_quantity" =>
                (int)$item["returned_quantity"],
            "unit_price" =>
                (float)$item["price"],
            "refund_amount" => $netRefund
        ];

        $totalRefund += $netRefund;
        $totalReturnQuantity +=
            $quantityToReturn;
    }

    $totalRefund = round(
        min(
            $totalRefund,
            max(
                0,
                $totalAmount -
                (float)$transaction["refunded_amount"]
            )
        ),
        2
    );

    if ($totalRefund <= 0) {
        throw new Exception(
            "This return does not have a refundable amount."
        );
    }

    $returnNumber =
        generateReturnNumber($conn);

    $returnHeaderStmt = $conn->prepare("
        INSERT INTO tbl_pos_returns
        (
            return_number,
            pos_id,
            transaction_code,
            return_type,
            return_reason,
            refund_amount,
            processed_by,
            processed_by_name,
            return_date
        )
        VALUES
        (
            :return_number,
            :pos_id,
            :transaction_code,
            'Partial Return',
            :return_reason,
            :refund_amount,
            :processed_by,
            :processed_by_name,
            NOW()
        )
    ");

    $returnHeaderStmt->execute([
        ":return_number" => $returnNumber,
        ":pos_id" => $posId,
        ":transaction_code" =>
            $transaction["transaction_code"],
        ":return_reason" => $returnReason,
        ":refund_amount" => $totalRefund,
        ":processed_by" => $processedBy,
        ":processed_by_name" =>
            $processedByName !== ""
                ? $processedByName
                : null
    ]);

    $returnId =
        (int)$conn->lastInsertId();

    $returnItemInsert = $conn->prepare("
        INSERT INTO tbl_pos_return_items
        (
            return_id,
            pos_item_id,
            product_id,
            product_name,
            quantity_returned,
            unit_price,
            refund_amount,
            created_at
        )
        VALUES
        (
            :return_id,
            :pos_item_id,
            :product_id,
            :product_name,
            :quantity_returned,
            :unit_price,
            :refund_amount,
            NOW()
        )
    ");

    $posItemUpdate = $conn->prepare("
        UPDATE tbl_pos_items
        SET
            returned_quantity =
                returned_quantity +
                :returned_quantity,

            refunded_amount =
                refunded_amount +
                :refund_amount,

            item_status = CASE
                WHEN returned_quantity +
                     :status_quantity >= quantity
                    THEN 'Returned'
                ELSE 'Partially Returned'
            END

        WHERE item_id = :item_id
    ");

    $inventoryUpdate = $conn->prepare("
        UPDATE tbl_inv
        SET
            quantity =
                quantity + :quantity,

            status = CASE
                WHEN quantity + :status_quantity_out <= 0
                    THEN 'Out of Stock'
                WHEN quantity + :status_quantity_low <= reorder_level
                    THEN 'Low Stock'
                ELSE 'In Stock'
            END,

            updated_at = NOW()

        WHERE product_id = :product_id
    ");

    $historyInsert = $conn->prepare("
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
            'Stock In',
            :quantity,
            :remarks,
            :created_by,
            NOW()
        )
    ");

    foreach ($validatedReturns as $returnItem) {
        $returnItemInsert->execute([
            ":return_id" => $returnId,
            ":pos_item_id" =>
                $returnItem["item_id"],
            ":product_id" =>
                $returnItem["product_id"],
            ":product_name" =>
                $returnItem["product_name"],
            ":quantity_returned" =>
                $returnItem["quantity"],
            ":unit_price" =>
                $returnItem["unit_price"],
            ":refund_amount" =>
                $returnItem["refund_amount"]
        ]);

        $posItemUpdate->execute([
            ":returned_quantity" =>
                $returnItem["quantity"],
            ":refund_amount" =>
                $returnItem["refund_amount"],
            ":status_quantity" =>
                $returnItem["quantity"],
            ":item_id" =>
                $returnItem["item_id"]
        ]);

        $inventoryUpdate->execute([
            ":quantity" =>
                $returnItem["quantity"],
            ":status_quantity_out" =>
                $returnItem["quantity"],
            ":status_quantity_low" =>
                $returnItem["quantity"],
            ":product_id" =>
                $returnItem["product_id"]
        ]);

        $historyInsert->execute([
            ":product_id" =>
                $returnItem["product_id"],
            ":quantity" =>
                $returnItem["quantity"],
            ":remarks" =>
                "POS return " .
                $returnNumber .
                " from transaction " .
                $transaction["transaction_code"] .
                ". Reason: " .
                $returnReason,
            ":created_by" =>
                $processedBy
        ]);
    }

    $remainingStmt = $conn->prepare("
        SELECT
            COALESCE(
                SUM(
                    quantity -
                    returned_quantity
                ),
                0
            )
        FROM tbl_pos_items
        WHERE pos_id = :pos_id
    ");

    $remainingStmt->execute([
        ":pos_id" => $posId
    ]);

    $remainingQuantity =
        (int)$remainingStmt->fetchColumn();

    $newStatus =
        $remainingQuantity <= 0
            ? "Returned"
            : "Partially Returned";

    if ($newStatus === "Returned") {
        $returnTypeStmt = $conn->prepare("
            UPDATE tbl_pos_returns
            SET return_type = 'Full Return'
            WHERE return_id = :return_id
        ");

        $returnTypeStmt->execute([
            ":return_id" => $returnId
        ]);
    }

    $transactionUpdate = $conn->prepare("
        UPDATE tbl_pos
        SET
            refunded_amount =
                LEAST(
                    total_amount,
                    refunded_amount +
                    :refund_amount
                ),

            transaction_status =
                :transaction_status,

            updated_at = NOW()

        WHERE pos_id = :pos_id
    ");

    $transactionUpdate->execute([
        ":refund_amount" => $totalRefund,
        ":transaction_status" => $newStatus,
        ":pos_id" => $posId
    ]);

    $conn->commit();

    respond(
        true,
        $newStatus === "Returned"
            ? "The transaction was fully returned successfully."
            : "Selected products were returned successfully.",
        [
            "return_id" => $returnId,
            "return_number" => $returnNumber,
            "refund_amount" => $totalRefund,
            "returned_quantity" =>
                $totalReturnQuantity,
            "transaction_status" =>
                $newStatus
        ]
    );
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    respond(
        false,
        $e->getMessage(),
        [],
        500
    );
}