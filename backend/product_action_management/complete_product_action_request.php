<?php

declare(strict_types=1);

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("_helpers.php");
require_once("../helpers/supplier_communication.php");

requireModulePermission("vendors");
requireAnyRole(["Admin", "Staff"]);

requireCsrfToken();

function completeActionColumnExists(
    PDO $conn,
    string $tableName,
    string $columnName
): bool {
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

    return (int)$stmt->fetchColumn() > 0;
}

function recalculateProductInventory(
    PDO $conn,
    int $productId
): array {
    $batchQuantityColumn =
        completeActionColumnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        )
            ? "remaining_quantity"
            : "quantity";

    $summaryStmt = $conn->prepare("
        SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN {$batchQuantityColumn} > 0
                        AND (
                            expiry_date IS NULL
                            OR expiry_date > CURDATE()
                        )
                        THEN {$batchQuantityColumn}
                        ELSE 0
                    END
                ),
                0
            ) AS valid_stock,

            MIN(
                CASE
                    WHEN {$batchQuantityColumn} > 0
                    AND expiry_date IS NOT NULL
                    AND expiry_date > CURDATE()
                    THEN expiry_date
                    ELSE NULL
                END
            ) AS nearest_expiry
        FROM tbl_inventory_batches
        WHERE product_id = :product_id
    ");

    $summaryStmt->execute([
        ":product_id" => $productId
    ]);

    $summary =
        $summaryStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $quantity =
        (float)($summary["valid_stock"] ?? 0);

    $nearestExpiry =
        $summary["nearest_expiry"] ?? null;

    $reorderStmt = $conn->prepare("
        SELECT reorder_level
        FROM tbl_inv
        WHERE product_id = :product_id
        LIMIT 1
    ");

    $reorderStmt->execute([
        ":product_id" => $productId
    ]);

    $reorderLevel =
        (float)($reorderStmt->fetchColumn() ?: 0);

    $status =
        $quantity <= 0
            ? "Out of Stock"
            : (
                $quantity <= $reorderLevel
                    ? "Low Stock"
                    : "In Stock"
            );

    $updateStmt = $conn->prepare("
        UPDATE tbl_inv
        SET
            quantity = :quantity,
            expiry_date = :expiry_date,
            status = :status,
            updated_at = NOW()
        WHERE product_id = :product_id
    ");

    $updateStmt->execute([
        ":quantity" => $quantity,
        ":expiry_date" => $nearestExpiry,
        ":status" => $status,
        ":product_id" => $productId
    ]);

    return [
        "quantity" => $quantity,
        "nearest_expiry" => $nearestExpiry,
        "status" => $status
    ];
}

$data = productActionReadJson();

$requestId = filter_var(
    $data["request_id"] ?? null,
    FILTER_VALIDATE_INT
);

$completedBy = (int)($_SESSION["user_id"] ?? 0);
if ($completedBy <= 0) {
    $completedBy = null;
}

$completedByName = trim(
    (string)(
        $data["completed_by_name"] ??
        "System Admin"
    )
);

if (!$requestId) {
    productActionRespond(
        false,
        "A valid request ID is required.",
        [],
        422
    );
}

if ($completedByName === "") {
    $completedByName = "System Admin";
}

try {
    $conn->beginTransaction();

    

    $batchQuantityColumn =
        completeActionColumnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        )
            ? "remaining_quantity"
            : "quantity";

    $requestStmt = $conn->prepare("
        SELECT
            r.*,
            v.vendor_name,
            i.product_name,
            i.quantity AS product_quantity,
            b.`{$batchQuantityColumn}` AS batch_quantity,
            b.delivery_id
        FROM tbl_product_action_request r

        INNER JOIN tbl_vendor v
            ON v.vendor_id =
               r.vendor_id

        INNER JOIN tbl_inv i
            ON i.product_id =
               r.product_id

        INNER JOIN tbl_inventory_batches b
            ON b.batch_id =
               r.batch_id

        WHERE r.request_id =
              :request_id
        LIMIT 1
        FOR UPDATE
    ");

    $requestStmt->execute([
        ":request_id" => $requestId
    ]);

    $request = $requestStmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$request) {
        throw new RuntimeException(
            "Product action request was not found."
        );
    }

    
    if ($request["status"] === "Completed") {
        $conn->commit();

        productActionRespond(
            true,
            "{$request['action_type']} was already completed.",
            [
                "request_id" => $requestId,
                "request_no" =>
                    $request["request_no"],
                "action_type" =>
                    $request["action_type"],
                "status" => "Completed",
                "already_processed" => true,
                "receipt_available" => true,
                "receipt_request_id" => $requestId,
                "receipt_no" => $request["request_no"],
                "notification_sent" => false,
                "email_sent" => false
            ]
        );
    }

    if ($request["status"] !== "Approved") {
        throw new RuntimeException(
            "Only approved requests can be completed."
        );
    }

    $quantityToDeduct = (float)(
        $request["approved_quantity"] ??
        $request["requested_quantity"]
    );

    if ($quantityToDeduct <= 0) {
        throw new RuntimeException(
            "Approved quantity is invalid."
        );
    }

    $previousBatchQuantity =
        (float)$request["batch_quantity"];

    $previousProductQuantity =
        (float)$request["product_quantity"];

    if (
        $quantityToDeduct >
        $previousBatchQuantity
    ) {
        throw new RuntimeException(
            "The selected batch has insufficient stock."
        );
    }

    if (
        $quantityToDeduct >
        $previousProductQuantity
    ) {
        throw new RuntimeException(
            "The product has insufficient total stock."
        );
    }

    $newBatchQuantity =
        max(
            0,
            $previousBatchQuantity -
            $quantityToDeduct
        );

    

    $batchUpdate = $conn->prepare("
        UPDATE tbl_inventory_batches
        SET
            `{$batchQuantityColumn}` =
                :new_quantity
        WHERE batch_id = :batch_id
        AND `{$batchQuantityColumn}` >=
            :quantity_to_deduct
    ");

    $batchUpdate->execute([
        ":new_quantity" =>
            $newBatchQuantity,
        ":batch_id" =>
            $request["batch_id"],
        ":quantity_to_deduct" =>
            $quantityToDeduct
    ]);

    if ($batchUpdate->rowCount() !== 1) {
        throw new RuntimeException(
            "The inventory batch changed before completion. Refresh and try again."
        );
    }

    

    $stockSummary =
        recalculateProductInventory(
            $conn,
            (int)$request["product_id"]
        );

    $newProductQuantity =
        (float)$stockSummary["quantity"];

    

    $historyAction =
        $request["action_type"] ===
        "Disposal"
            ? "Disposed"
            : "Supplier Pull-out";

    $historyRemarks =
        "{$historyAction} completed through {$request['request_no']}. " .
        "Supplier: {$request['vendor_name']}. " .
        "Batch: {$request['batch_id']}.";

    $historyStmt = $conn->prepare("
        INSERT INTO tbl_inventory_history
        (
            product_id,
            delivery_id,
            action_type,
            quantity,
            previous_quantity,
            new_quantity,
            remarks,
            created_by,
            created_at
        )
        VALUES
        (
            :product_id,
            :delivery_id,
            :action_type,
            :quantity,
            :previous_quantity,
            :new_quantity,
            :remarks,
            :created_by,
            NOW()
        )
    ");

    $historyStmt->execute([
        ":product_id" =>
            $request["product_id"],
        ":delivery_id" =>
            $request["delivery_id"] ?: null,
        ":action_type" =>
            $historyAction,
        ":quantity" =>
            $quantityToDeduct,
        ":previous_quantity" =>
            $previousProductQuantity,
        ":new_quantity" =>
            $newProductQuantity,
        ":remarks" =>
            $historyRemarks,
        ":created_by" =>
            $completedBy ?: null
    ]);

    

    $completeStmt = $conn->prepare("
        UPDATE tbl_product_action_request
        SET
            status = 'Completed',
            completed_by =
                :completed_by,
            completed_by_name =
                :completed_by_name,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE request_id =
              :request_id
        AND status = 'Approved'
    ");

    $completeStmt->execute([
        ":completed_by" =>
            $completedBy ?: null,
        ":completed_by_name" =>
            $completedByName,
        ":request_id" =>
            $requestId
    ]);

    if ($completeStmt->rowCount() !== 1) {
        throw new RuntimeException(
            "The request status changed before completion could finish."
        );
    }

    

    logProductActionAudit(
        $conn,
        $completedBy ?: null,
        $completedByName,
        "Complete {$request['action_type']}",
        "{$completedByName} completed {$request['request_no']}. " .
        "Product stock changed from {$previousProductQuantity} " .
        "to {$newProductQuantity}."
    );

    

    $conn->commit();

    

    $notificationTitle =
        "{$request['action_type']} Completed";

    $notificationMessage =
        "{$request['request_no']} for {$request['product_name']} was completed by BFATC. " .
        "Quantity processed: {$quantityToDeduct}. " .
        "Remaining product stock: {$newProductQuantity}.";

    $details =
        "PRODUCT ACTION RECEIPT\n" .
        "Receipt No.: " .
        $request["request_no"] .
        "\nSupplier: " .
        $request["vendor_name"] .
        "\nAction: " .
        $request["action_type"] .
        "\nProduct: " .
        $request["product_name"] .
        "\nBatch: #" .
        $request["batch_id"] .
        "\nQuantity processed: " .
        $quantityToDeduct .
        "\nPrevious batch stock: " .
        $previousBatchQuantity .
        "\nRemaining batch stock: " .
        $newBatchQuantity .
        "\nPrevious product stock: " .
        $previousProductQuantity .
        "\nRemaining product stock: " .
        $newProductQuantity .
        "\nCompleted by: " .
        $completedByName .
        "\nCompleted at: " .
        date("Y-m-d H:i:s") .
        "\nStatus: Completed\n\n" .
        "This receipt is also available in the Supplier account notification and Product Actions history in HiveSync.";

    $supplierCommunication = [
        "recipients" => 0,
        "notifications_sent" => 0,
        "emails_sent" => 0,
        "notification_sent" => false,
        "email_sent" => false
    ];

    $communicationError = null;

    
    $communicationOutput = "";
    $communicationBufferLevel = ob_get_level();

    ob_start();

    try {
        $supplierCommunication =
            notifySupplier(
                $conn,
                (int)$request["vendor_id"],
                $notificationTitle,
                $notificationMessage,
                "Supplier",
                $requestId,
                $request["request_no"],
                "product_actions",
                $details
            );
    } catch (Throwable $communicationException) {
        $communicationError =
            $communicationException->getMessage();

        error_log(
            "complete_product_action_request.php supplier communication: " .
            $communicationError
        );
    } finally {
        while (ob_get_level() > $communicationBufferLevel) {
            $bufferPart = ob_get_clean();

            if ($bufferPart !== false && $bufferPart !== "") {
                $communicationOutput .= $bufferPart;
            }
        }

        if ($communicationOutput !== "") {
            error_log(
                "complete_product_action_request.php suppressed communication output: " .
                $communicationOutput
            );
        }
    }

    productActionRespond(
        true,
        "{$request['action_type']} completed successfully.",
        [
            "request_id" =>
                $requestId,
            "request_no" =>
                $request["request_no"],
            "action_type" =>
                $request["action_type"],
            "processed_quantity" =>
                $quantityToDeduct,
            "previous_product_quantity" =>
                $previousProductQuantity,
            "new_product_quantity" =>
                $newProductQuantity,
            "previous_batch_quantity" =>
                $previousBatchQuantity,
            "new_batch_quantity" =>
                $newBatchQuantity,
            "inventory_status" =>
                $stockSummary["status"],
            "nearest_expiry" =>
                $stockSummary["nearest_expiry"],
            "status" =>
                "Completed",
            "already_processed" =>
                false,

            "receipt_available" =>
                true,

            "receipt_request_id" =>
                $requestId,

            "receipt_no" =>
                $request["request_no"],

            "supplier_recipients" =>
                (int)(
                    $supplierCommunication[
                        "recipients"
                    ] ?? 0
                ),

            "notification_sent" =>
                (bool)(
                    $supplierCommunication[
                        "notification_sent"
                    ] ?? false
                ),

            "notifications_sent" =>
                (int)(
                    $supplierCommunication[
                        "notifications_sent"
                    ] ?? 0
                ),

            "email_sent" =>
                (bool)(
                    $supplierCommunication[
                        "email_sent"
                    ] ?? false
                ),

            "emails_sent" =>
                (int)(
                    $supplierCommunication[
                        "emails_sent"
                    ] ?? 0
                ),

            "communication_error" =>
                $communicationError
        ]
    );
} catch (Throwable $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "Complete product action error: " .
        $e->getMessage()
    );

    productActionRespond(
        false,
        $e->getMessage(),
        [],
        422
    );
}