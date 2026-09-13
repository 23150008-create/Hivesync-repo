<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("_helpers.php");
require_once("../helpers/supplier_communication.php");

requireModulePermission("vendors");
requireAnyRole(["Admin"]);

function reviewActionColumnExists(
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

function reviewRecalculateProductInventory(
    PDO $conn,
    int $productId
): array {
    $batchQuantityColumn =
        reviewActionColumnExists(
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

$reviewAction = strtolower(
    trim(
        (string)(
            $data["review_action"] ?? ""
        )
    )
);

$autoProcess = filter_var(
    $data["auto_process"] ?? false,
    FILTER_VALIDATE_BOOLEAN
);

$approvedQuantity = (float)(
    $data["approved_quantity"] ?? 0
);

$rejectionReason = trim(
    (string)(
        $data["rejection_reason"] ?? ""
    )
);

$reviewedBy = (int)($_SESSION["user_id"] ?? 0);
if ($reviewedBy <= 0) {
    $reviewedBy = null;
}

$reviewedByName = trim(
    (string)(
        $data["reviewed_by_name"] ??
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

if (
    !in_array(
        $reviewAction,
        ["approve", "reject"],
        true
    )
) {
    productActionRespond(
        false,
        "Select Approve or Reject.",
        [],
        422
    );
}

if (
    $reviewAction === "reject" &&
    $rejectionReason === ""
) {
    productActionRespond(
        false,
        "Enter a rejection reason.",
        [],
        422
    );
}

if ($reviewedByName === "") {
    $reviewedByName = "System Admin";
}

try {
    $conn->beginTransaction();

    $batchQuantityColumn =
        reviewActionColumnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        )
            ? "remaining_quantity"
            : "quantity";

    

    $stmt = $conn->prepare("
        SELECT
            r.*,
            v.vendor_name,

            i.product_name,
            i.sku,
            i.variant_label,
            i.variant_value,
            i.variant_unit,
            i.quantity AS product_quantity,

            b.`{$batchQuantityColumn}` AS batch_quantity,
            b.expiry_date AS batch_expiry_date,
            b.delivery_id

        FROM tbl_product_action_request r

        INNER JOIN tbl_vendor v
            ON v.vendor_id = r.vendor_id

        INNER JOIN tbl_inv i
            ON i.product_id = r.product_id

        LEFT JOIN tbl_inventory_batches b
            ON b.batch_id = r.batch_id

        WHERE r.request_id = :request_id
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":request_id" => $requestId
    ]);

    $request =
        $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        throw new RuntimeException(
            "Product action request was not found."
        );
    }

    
    if ($request["status"] !== "Pending") {
        throw new RuntimeException(
            "Only pending requests can be reviewed."
        );
    }

    if ($autoProcess) {
        if ($reviewAction !== "approve") {
            throw new RuntimeException(
                "Automatic product action processing only supports approval."
            );
        }

        if (
            trim(
                (string)(
                    $request["transaction_source"] ??
                    ""
                )
            ) !== "Walk-in"
        ) {
            throw new RuntimeException(
                "Automatic processing is only allowed for Admin-recorded Walk-in / Assisted product actions."
            );
        }
    }

    $previousBatchQuantity =
        (float)($request["batch_quantity"] ?? 0);

    $previousProductQuantity =
        (float)($request["product_quantity"] ?? 0);

    $processedQuantity = null;
    $newBatchQuantity = null;
    $newProductQuantity = null;
    $stockSummary = null;

    if ($reviewAction === "approve") {
        

        if (
            !empty($request["batch_expiry_date"]) &&
            !empty($request["preferred_action_date"]) &&
            $request["preferred_action_date"] >
                $request["batch_expiry_date"]
        ) {
            throw new RuntimeException(
                "The preferred action date is later than the batch expiry date. Ask the supplier to submit a valid action date."
            );
        }

        if ($approvedQuantity <= 0) {
            $approvedQuantity =
                (float)$request["requested_quantity"];
        }

        if (
            $approvedQuantity >
            (float)$request["requested_quantity"]
        ) {
            throw new RuntimeException(
                "Approved quantity cannot exceed the requested quantity."
            );
        }

        
        $otherReservedStmt =
            $conn->prepare("
                SELECT COALESCE(
                    SUM(
                        COALESCE(
                            approved_quantity,
                            requested_quantity
                        )
                    ),
                    0
                )
                FROM tbl_product_action_request
                WHERE batch_id = :batch_id
                AND request_id <> :request_id
                AND status IN (
                    'Pending',
                    'Approved'
                )
            ");

        $otherReservedStmt->execute([
            ":batch_id" =>
                $request["batch_id"],
            ":request_id" =>
                $requestId
        ]);

        $otherReserved =
            (float)$otherReservedStmt
                ->fetchColumn();

        $availableForApproval = max(
            0,
            $previousBatchQuantity -
            $otherReserved
        );

        if (
            $approvedQuantity >
            $availableForApproval
        ) {
            throw new RuntimeException(
                "Only {$availableForApproval} unit(s) remain available in this batch."
            );
        }

        if (
            $approvedQuantity >
            $previousBatchQuantity
        ) {
            throw new RuntimeException(
                "The selected batch has insufficient stock."
            );
        }

        if (
            $approvedQuantity >
            $previousProductQuantity
        ) {
            throw new RuntimeException(
                "The product has insufficient total stock."
            );
        }

        

        $processedQuantity =
            $approvedQuantity;

        $newBatchQuantity = max(
            0,
            $previousBatchQuantity -
            $processedQuantity
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
                $processedQuantity
        ]);

        if ($batchUpdate->rowCount() !== 1) {
            throw new RuntimeException(
                "The inventory batch changed before confirmation. Refresh and try again."
            );
        }

        
        $stockSummary =
            reviewRecalculateProductInventory(
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
            $autoProcess
                ? "{$historyAction} completed as an Admin-assisted Walk-in transaction through {$request['request_no']}. " .
                  "Supplier: {$request['vendor_name']}. " .
                  "Batch: {$request['batch_id']}."
                : "{$historyAction} approved and completed through {$request['request_no']}. " .
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
                $processedQuantity,
            ":previous_quantity" =>
                $previousProductQuantity,
            ":new_quantity" =>
                $newProductQuantity,
            ":remarks" =>
                $historyRemarks,
            ":created_by" =>
                $reviewedBy ?: null
        ]);

        

        $updateStmt = $conn->prepare("
            UPDATE tbl_product_action_request
            SET
                approved_quantity =
                    :approved_quantity,

                status = 'Completed',

                reviewed_by =
                    :reviewed_by,
                reviewed_by_name =
                    :reviewed_by_name,
                reviewed_at = NOW(),

                completed_by =
                    :completed_by,
                completed_by_name =
                    :completed_by_name,
                completed_at = NOW(),

                rejection_reason = NULL,
                updated_at = NOW()

            WHERE request_id =
                  :request_id
            AND status = 'Pending'
        ");

        $updateStmt->execute([
            ":approved_quantity" =>
                $approvedQuantity,
            ":reviewed_by" =>
                $reviewedBy ?: null,
            ":reviewed_by_name" =>
                $reviewedByName,
            ":completed_by" =>
                $reviewedBy ?: null,
            ":completed_by_name" =>
                $reviewedByName,
            ":request_id" =>
                $requestId
        ]);

        if ($updateStmt->rowCount() !== 1) {
            throw new RuntimeException(
                "The request status changed before confirmation could finish."
            );
        }

        $newStatus = "Completed";

        $notificationTitle =
            "{$request['action_type']} Completed";

        $notificationMessage =
            "{$request['request_no']} for {$request['product_name']} was approved and completed by BFATC. " .
            "Quantity processed: {$processedQuantity}. " .
            "Remaining product stock: {$newProductQuantity}.";

        $communicationDetails =
            "PRODUCT ACTION RECEIPT" .
            "\n--------------------------------" .
            "\nReceipt No.: " .
            $request["request_no"] .
            "\nSupplier: " .
            $request["vendor_name"] .
            "\nAction: " .
            $request["action_type"] .
            "\nProduct: " .
            $request["product_name"] .
            "\nSKU: " .
            ($request["sku"] ?: "N/A") .
            "\nBatch: #" .
            ($request["batch_id"] ?: "N/A") .
            "\nRequested Quantity: " .
            $request["requested_quantity"] .
            "\nQuantity Processed: " .
            $processedQuantity .
            "\nPrevious Batch Stock: " .
            $previousBatchQuantity .
            "\nRemaining Batch Stock: " .
            $newBatchQuantity .
            "\nPrevious Product Stock: " .
            $previousProductQuantity .
            "\nRemaining Product Stock: " .
            $newProductQuantity .
            "\nPreferred Action Date: " .
            ($request["preferred_action_date"] ?: "N/A") .
            "\nConfirmed By: " .
            $reviewedByName .
            "\nCompleted At: " .
            date("Y-m-d H:i:s") .
            "\nStatus: Completed";

        $auditAction =
            $autoProcess
                ? "Complete Assisted {$request['action_type']}"
                : "Approve & Complete {$request['action_type']} Request";

        $auditDetails =
            $autoProcess
                ? "{$reviewedByName} recorded and completed assisted {$request['request_no']}. " .
                  "Product stock changed from {$previousProductQuantity} to {$newProductQuantity}."
                : "{$reviewedByName} approved and completed {$request['request_no']}. " .
                  "Product stock changed from {$previousProductQuantity} to {$newProductQuantity}.";
    } else {
        

        $updateStmt = $conn->prepare("
            UPDATE tbl_product_action_request
            SET
                approved_quantity = NULL,
                status = 'Rejected',
                reviewed_by =
                    :reviewed_by,
                reviewed_by_name =
                    :reviewed_by_name,
                reviewed_at = NOW(),
                rejection_reason =
                    :rejection_reason,
                updated_at = NOW()
            WHERE request_id =
                  :request_id
            AND status = 'Pending'
        ");

        $updateStmt->execute([
            ":reviewed_by" =>
                $reviewedBy ?: null,
            ":reviewed_by_name" =>
                $reviewedByName,
            ":rejection_reason" =>
                $rejectionReason,
            ":request_id" =>
                $requestId
        ]);

        if ($updateStmt->rowCount() !== 1) {
            throw new RuntimeException(
                "The request status changed before rejection could finish."
            );
        }

        $newStatus = "Rejected";

        $notificationTitle =
            "{$request['action_type']} Request Rejected";

        $notificationMessage =
            "{$request['request_no']} for {$request['product_name']} was rejected. Reason: {$rejectionReason}";

        $communicationDetails =
            "Request: " .
            $request["request_no"] .
            "\nAction: " .
            $request["action_type"] .
            "\nProduct: " .
            $request["product_name"] .
            "\nRequested quantity: " .
            $request["requested_quantity"] .
            "\nReason: " .
            $rejectionReason .
            "\nReviewed by: " .
            $reviewedByName .
            "\nStatus: Rejected";

        $auditAction =
            "Reject {$request['action_type']} Request";

        $auditDetails =
            "{$reviewedByName} rejected {$request['request_no']}.";
    }

    

    logProductActionAudit(
        $conn,
        $reviewedBy ?: null,
        $reviewedByName,
        $auditAction,
        $auditDetails
    );

    

    $conn->commit();

    

    $supplierCommunication = [
        "recipients" => 0,
        "notifications_sent" => 0,
        "emails_sent" => 0,
        "notification_sent" => false,
        "email_sent" => false
    ];

    $communicationError = null;
    $communicationOutput = "";
    $communicationBufferLevel =
        ob_get_level();

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
                $communicationDetails
            );
    } catch (Throwable $communicationException) {
        $communicationError =
            $communicationException->getMessage();

        error_log(
            "review_product_action_request.php supplier communication: " .
            $communicationError
        );
    } finally {
        while (
            ob_get_level() >
            $communicationBufferLevel
        ) {
            $bufferPart =
                ob_get_clean();

            if (
                $bufferPart !== false &&
                $bufferPart !== ""
            ) {
                $communicationOutput .=
                    $bufferPart;
            }
        }

        if (
            trim($communicationOutput) !== ""
        ) {
            error_log(
                "review_product_action_request.php suppressed supplier communication output: " .
                $communicationOutput
            );
        }
    }

    productActionRespond(
        true,
        $newStatus === "Completed"
            ? "{$request['action_type']} confirmed and completed successfully."
            : "Product action request rejected.",
        [
            "request_id" =>
                $requestId,

            "request_no" =>
                $request["request_no"],

            "action_type" =>
                $request["action_type"],

            "status" =>
                $newStatus,

            "approved_quantity" =>
                $newStatus === "Completed"
                    ? $approvedQuantity
                    : null,

            "processed_quantity" =>
                $newStatus === "Completed"
                    ? $processedQuantity
                    : null,

            "previous_product_quantity" =>
                $newStatus === "Completed"
                    ? $previousProductQuantity
                    : null,

            "new_product_quantity" =>
                $newStatus === "Completed"
                    ? $newProductQuantity
                    : null,

            "previous_batch_quantity" =>
                $newStatus === "Completed"
                    ? $previousBatchQuantity
                    : null,

            "new_batch_quantity" =>
                $newStatus === "Completed"
                    ? $newBatchQuantity
                    : null,

            "inventory_status" =>
                $newStatus === "Completed"
                    ? ($stockSummary["status"] ?? null)
                    : null,

            "nearest_expiry" =>
                $newStatus === "Completed"
                    ? ($stockSummary["nearest_expiry"] ?? null)
                    : null,

            "rejection_reason" =>
                $newStatus === "Rejected"
                    ? $rejectionReason
                    : null,

            
            "receipt_available" =>
                $newStatus === "Completed",

            "receipt_request_id" =>
                $newStatus === "Completed"
                    ? $requestId
                    : null,

            "receipt_no" =>
                $newStatus === "Completed"
                    ? $request["request_no"]
                    : null,

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
        "Review product action error: " .
        $e->getMessage()
    );

    productActionRespond(
        false,
        $e->getMessage(),
        [],
        422
    );
}