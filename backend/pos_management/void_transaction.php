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

function generateVoidNumber(
    PDO $conn
): string {
    $prefix =
        "VOID-" . date("Ymd") . "-";

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

$voidReason = trim(
    $data["void_reason"] ??
    $data["reason"] ??
    ""
);

$voidedBy = (int)($_SESSION["user_id"] ?? 0);
$voidedByName = trim((string)($_SESSION["full_name"] ?? $_SESSION["email"] ?? ""));
if (!$posId) {
    respond(
        false,
        "A valid transaction ID is required.",
        [],
        422
    );
}

if ($voidReason === "") {
    respond(
        false,
        "A void reason is required.",
        [],
        422
    );
}

if (!$voidedBy) {
    respond(
        false,
        "The user voiding the transaction is required.",
        [],
        422
    );
}

try {
    $conn->beginTransaction();

    $voidUserStmt = $conn->prepare("
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

    $voidUserStmt->execute([
        ":user_id" => $voidedBy
    ]);

    $voidUser =
        $voidUserStmt->fetch(PDO::FETCH_ASSOC);

    if (!$voidUser) {
        throw new Exception(
            "The user voiding the transaction was not found."
        );
    }

    if (
        !in_array(
            strtolower(trim((string)$voidUser["role"])),
            ["admin", "staff"],
            true
        )
    ) {
        throw new Exception(
            "Only Admin or Staff users can void POS transactions."
        );
    }

    if (
        strtolower(trim((string)$voidUser["status"])) !==
        "active"
    ) {
        throw new Exception(
            "The user voiding the transaction is not active."
        );
    }

    $voidedByName =
        trim((string)$voidUser["full_name"]);

    $transactionStmt = $conn->prepare("
        SELECT
            pos_id,
            transaction_code,
            total_amount,
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
            "This transaction has already been voided."
        );
    }

    if (
        $transaction["transaction_status"] ===
        "Returned"
    ) {
        throw new Exception(
            "A fully returned transaction cannot be voided."
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
            "Voids are allowed only within five calendar days from the transaction date."
        );
    }

    $itemsStmt = $conn->prepare("
        SELECT
            pi.item_id,
            pi.product_id,
            pi.quantity,
            pi.returned_quantity,
            pi.price,
            pi.item_status,
            i.product_name
        FROM tbl_pos_items pi
        INNER JOIN tbl_inv i
            ON i.product_id = pi.product_id
        WHERE pi.pos_id = :pos_id
        FOR UPDATE
    ");

    $itemsStmt->execute([
        ":pos_id" => $posId
    ]);

    $items =
        $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($items) === 0) {
        throw new Exception(
            "The transaction does not contain any products."
        );
    }

    $remainingRefund = round(
        max(
            0,
            (float)$transaction["total_amount"] -
            (float)$transaction["refunded_amount"]
        ),
        2
    );

    if ($remainingRefund <= 0) {
        throw new Exception(
            "This transaction has no remaining amount to void."
        );
    }

    $hasRemainingQuantity = false;

    foreach ($items as $item) {
        if (
            max(
                0,
                (int)$item["quantity"] -
                (int)$item["returned_quantity"]
            ) > 0
        ) {
            $hasRemainingQuantity = true;
            break;
        }
    }

    if (!$hasRemainingQuantity) {
        throw new Exception(
            "This transaction has no remaining products to void."
        );
    }

    $voidNumber =
        generateVoidNumber($conn);

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
            'Void',
            :return_reason,
            :refund_amount,
            :processed_by,
            :processed_by_name,
            NOW()
        )
    ");

    $returnHeaderStmt->execute([
        ":return_number" => $voidNumber,
        ":pos_id" => $posId,
        ":transaction_code" =>
            $transaction["transaction_code"],
        ":return_reason" => $voidReason,
        ":refund_amount" => $remainingRefund,
        ":processed_by" => $voidedBy,
        ":processed_by_name" =>
            $voidedByName !== ""
                ? $voidedByName
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

    $itemStatusUpdate = $conn->prepare("
        UPDATE tbl_pos_items
        SET
            item_status = 'Voided',
            refunded_amount =
                subtotal,
            returned_quantity =
                quantity
        WHERE item_id = :item_id
    ");

    $totalRemainingGross = 0;

    foreach ($items as $item) {
        $remainingQuantity =
            max(
                0,
                (int)$item["quantity"] -
                (int)$item["returned_quantity"]
            );

        if ($remainingQuantity <= 0) {
            continue;
        }

        $totalRemainingGross +=
            $remainingQuantity *
            (float)$item["price"];
    }

    foreach ($items as $item) {
        $remainingQuantity =
            max(
                0,
                (int)$item["quantity"] -
                (int)$item["returned_quantity"]
            );

        if ($remainingQuantity <= 0) {
            continue;
        }

        $itemGross =
            $remainingQuantity *
            (float)$item["price"];

        $itemRefund =
            $totalRemainingGross > 0
                ? round(
                    $remainingRefund *
                    ($itemGross /
                     $totalRemainingGross),
                    2
                )
                : 0;

        $returnItemInsert->execute([
            ":return_id" => $returnId,
            ":pos_item_id" =>
                $item["item_id"],
            ":product_id" =>
                $item["product_id"],
            ":product_name" =>
                $item["product_name"],
            ":quantity_returned" =>
                $remainingQuantity,
            ":unit_price" =>
                $item["price"],
            ":refund_amount" =>
                $itemRefund
        ]);

        $inventoryUpdate->execute([
            ":quantity" =>
                $remainingQuantity,
            ":status_quantity_out" =>
                $remainingQuantity,
            ":status_quantity_low" =>
                $remainingQuantity,
            ":product_id" =>
                $item["product_id"]
        ]);

        $historyInsert->execute([
            ":product_id" =>
                $item["product_id"],
            ":quantity" =>
                $remainingQuantity,
            ":remarks" =>
                "Voided POS transaction " .
                $transaction["transaction_code"] .
                ". Reason: " .
                $voidReason,
            ":created_by" =>
                $voidedBy
        ]);

        $itemStatusUpdate->execute([
            ":item_id" => $item["item_id"]
        ]);
    }

    $transactionUpdate = $conn->prepare("
        UPDATE tbl_pos
        SET
            transaction_status = 'Voided',
            void_reason = :void_reason,
            voided_by = :voided_by,
            voided_at = NOW(),
            refunded_amount = total_amount,
            updated_at = NOW()
        WHERE pos_id = :pos_id
    ");

    $transactionUpdate->execute([
        ":void_reason" => $voidReason,
        ":voided_by" => $voidedBy,
        ":pos_id" => $posId
    ]);

    $conn->commit();

    respond(
        true,
        "Transaction voided successfully. Remaining products were restored to inventory.",
        [
            "return_id" => $returnId,
            "void_number" => $voidNumber,
            "refund_amount" => $remainingRefund,
            "transaction_status" => "Voided"
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