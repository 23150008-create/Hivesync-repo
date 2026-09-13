<?php

declare(strict_types=1);

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("_helpers.php");

requireAuthentication();
requireAnyRole(["Admin", "Staff", "Supplier", "Vendor"]);

requireCsrfToken();

function createActionColumnExists(
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

$data = productActionReadJson();

$vendorId = filter_var(
    $data["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);
$productId = filter_var(
    $data["product_id"] ?? null,
    FILTER_VALIDATE_INT
);
$batchId = filter_var(
    $data["batch_id"] ?? null,
    FILTER_VALIDATE_INT
);
$actionType = normalizeProductActionType(
    $data["action_type"] ?? ""
);
$requestedQuantity =
    (float)($data["requested_quantity"] ?? 0);
$reason = trim((string)($data["reason"] ?? ""));
$preferredActionDate = trim(
    (string)($data["preferred_action_date"] ?? "")
);
$disposalMethod = trim(
    (string)($data["disposal_method"] ?? "")
);
$supplierRemarks = trim(
    (string)($data["supplier_remarks"] ?? "")
);
$requestedBy = (int)($_SESSION["user_id"] ?? 0);
if ($requestedBy <= 0) {
    $requestedBy = null;
}
$requestedByName = trim(
    (string)($data["requested_by_name"] ?? "Supplier")
);

$currentRole = trim(
    (string)($_SESSION["role"] ?? "")
);

$isSupplierAccount = in_array(
    $currentRole,
    ["Supplier", "Vendor"],
    true
);

$transactionSource =
    $isSupplierAccount
        ? "Supplier Portal"
        : "Walk-in";

if (!$vendorId) {
    productActionRespond(false, "A valid supplier ID is required.", [], 422);
}

if ($isSupplierAccount) {
    enforceSupplierVendorAccess((int)$vendorId);
} else {
    requireModulePermission("vendors");
    requireAnyRole(["Admin", "Staff"]);
}

if (
    !createActionColumnExists(
        $conn,
        "tbl_product_action_request",
        "transaction_source"
    )
) {
    productActionRespond(
        false,
        "The Walk-in / Assisted transaction migration has not been installed. Missing tbl_product_action_request.transaction_source.",
        [],
        500
    );
}

if (!$productId) {
    productActionRespond(false, "Select a valid product.", [], 422);
}
if (!$batchId) {
    productActionRespond(false, "Select a valid inventory batch.", [], 422);
}
if ($actionType === "") {
    productActionRespond(false, "Select Pull-out or Disposal.", [], 422);
}
if ($requestedQuantity <= 0) {
    productActionRespond(false, "Requested quantity must be greater than zero.", [], 422);
}
if ($reason === "") {
    productActionRespond(false, "A reason is required.", [], 422);
}

if ($preferredActionDate === "") {
    productActionRespond(
        false,
        "Select the preferred pull-out or disposal date.",
        [],
        422
    );
}

if ($preferredActionDate < date("Y-m-d")) {
    productActionRespond(
        false,
        "Preferred action date cannot be in the past.",
        [],
        422
    );
}

if (
    $actionType === "Disposal" &&
    $disposalMethod === ""
) {
    productActionRespond(
        false,
        "Enter the intended disposal method.",
        [],
        422
    );
}

try {
    $conn->beginTransaction();

    $productStmt = $conn->prepare("
        SELECT
            i.product_id,
            i.product_name,
            i.vendor_id,
            i.quantity,
            i.status,
            i.expiry_date,
            " .
            (
                createActionColumnExists($conn, "tbl_inv", "is_consignment")
                    ? "i.is_consignment,"
                    : "0 AS is_consignment,"
            ) .
            (
                createActionColumnExists($conn, "tbl_inv", "consignment_pullout_date")
                    ? "i.consignment_pullout_date,"
                    : "NULL AS consignment_pullout_date,"
            ) . "
            v.vendor_name
        FROM tbl_inv i
        INNER JOIN tbl_vendor v
            ON v.vendor_id = i.vendor_id
        WHERE i.product_id = :product_id
        AND i.vendor_id = :vendor_id
        AND COALESCE(i.status, '') <> 'Archived'
        LIMIT 1
        FOR UPDATE
    ");

    $productStmt->execute([
        ":product_id" => $productId,
        ":vendor_id" => $vendorId
    ]);

    $product = $productStmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        throw new RuntimeException(
            "The selected product does not belong to this supplier or is archived."
        );
    }

    $batchQuantityColumn =
        createActionColumnExists(
            $conn,
            "tbl_inventory_batches",
            "remaining_quantity"
        )
            ? "remaining_quantity"
            : "quantity";

    $batchStmt = $conn->prepare("
        SELECT
            batch_id,
            product_id,
            quantity AS original_quantity,
            `{$batchQuantityColumn}` AS available_stock,
            expiry_date,
            supplier_price,
            delivery_id
        FROM tbl_inventory_batches
        WHERE batch_id = :batch_id
        AND product_id = :product_id
        LIMIT 1
        FOR UPDATE
    ");

    $batchStmt->execute([
        ":batch_id" => $batchId,
        ":product_id" => $productId
    ]);

    $batch = $batchStmt->fetch(PDO::FETCH_ASSOC);

    if (!$batch) {
        throw new RuntimeException(
            "The selected inventory batch was not found."
        );
    }

    
    $latestAllowedDate = null;

    if (!empty($batch["expiry_date"])) {
        $latestAllowedDate = $batch["expiry_date"];
    }

    if (
        (int)($product["is_consignment"] ?? 0) === 1 &&
        !empty($product["consignment_pullout_date"])
    ) {
        if (
            !$latestAllowedDate ||
            $product["consignment_pullout_date"] < $latestAllowedDate
        ) {
            $latestAllowedDate =
                $product["consignment_pullout_date"];
        }
    }

    if (
        $latestAllowedDate &&
        $preferredActionDate > $latestAllowedDate
    ) {
        throw new RuntimeException(
            "Preferred action date must be on or before {$latestAllowedDate} based on the product expiry/consignment pull-out date."
        );
    }

    $reservedStmt = $conn->prepare("
        SELECT COALESCE(
            SUM(
                CASE
                    WHEN status IN (
                        'Pending',
                        'Approved'
                    )
                    THEN COALESCE(
                        approved_quantity,
                        requested_quantity
                    )
                    ELSE 0
                END
            ),
            0
        )
        FROM tbl_product_action_request
        WHERE batch_id = :batch_id
    ");

    $reservedStmt->execute([
        ":batch_id" => $batchId
    ]);

    $reservedQuantity =
        (float)$reservedStmt->fetchColumn();

    $availableQuantity = max(
        0,
        (float)$batch["available_stock"] -
        $reservedQuantity
    );

    if ($requestedQuantity > $availableQuantity) {
        throw new RuntimeException(
            "Requested quantity exceeds the available batch quantity of {$availableQuantity}."
        );
    }

    $requestNo = generateProductActionNo($conn);

    $stmt = $conn->prepare("
        INSERT INTO tbl_product_action_request
        (
            request_no,
            vendor_id,
            product_id,
            batch_id,
            action_type,
            requested_quantity,
            approved_quantity,
            reason,
            preferred_action_date,
            disposal_method,
            supplier_remarks,
            status,
            transaction_source,
            requested_by,
            requested_by_name,
            created_at,
            updated_at
        )
        VALUES
        (
            :request_no,
            :vendor_id,
            :product_id,
            :batch_id,
            :action_type,
            :requested_quantity,
            NULL,
            :reason,
            :preferred_action_date,
            :disposal_method,
            :supplier_remarks,
            'Pending',
            :transaction_source,
            :requested_by,
            :requested_by_name,
            NOW(),
            NOW()
        )
    ");

    $stmt->execute([
        ":request_no" => $requestNo,
        ":vendor_id" => $vendorId,
        ":product_id" => $productId,
        ":batch_id" => $batchId,
        ":action_type" => $actionType,
        ":requested_quantity" => $requestedQuantity,
        ":reason" => $reason,
        ":preferred_action_date" => $preferredActionDate,
        ":disposal_method" =>
            $actionType === "Disposal"
                ? $disposalMethod
                : null,
        ":supplier_remarks" =>
            $supplierRemarks !== ""
                ? $supplierRemarks
                : null,
        ":transaction_source" =>
            $transactionSource,
        ":requested_by" => $requestedBy ?: null,
        ":requested_by_name" =>
            $requestedByName !== ""
                ? $requestedByName
                : "Supplier"
    ]);

    $requestId = (int)$conn->lastInsertId();

    $conn->commit();

    $sourceLabel =
        $transactionSource === "Walk-in"
            ? "Walk-in / Assisted"
            : "Supplier Portal";

    logProductActionAudit(
        $conn,
        $requestedBy ?: null,
        $requestedByName,
        $currentRole === "Admin"
            ? "Record Assisted {$actionType}"
            : "Submit {$actionType} Request",
        "{$requestedByName} recorded {$requestNo} for {$product['product_name']}, batch {$batchId}, quantity {$requestedQuantity}, preferred date {$preferredActionDate}. Source: {$sourceLabel}."
    );

    if ($currentRole !== "Admin") {
        createProductActionNotification(
            $conn,
            "New Supplier {$actionType} Request",
            "{$product['vendor_name']} has {$requestNo} for {$product['product_name']} with quantity {$requestedQuantity}. Preferred action date: {$preferredActionDate}. Source: {$sourceLabel}.",
            $requestId
        );
    }

    productActionRespond(
        true,
        $currentRole === "Admin"
            ? "{$actionType} recorded and ready for immediate Admin processing."
            : "{$actionType} request submitted successfully.",
        [
            "request_id" => $requestId,
            "request_no" => $requestNo,
            "status" => "Pending",
            "transaction_source" => $transactionSource,
            "auto_complete_required" =>
                $currentRole === "Admin" &&
                $transactionSource === "Walk-in",
            "preferred_action_date" => $preferredActionDate,
            "latest_allowed_date" => $latestAllowedDate,
            "receipt_available_after_completion" => true
        ],
        201
    );

} catch (Throwable $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "Create product action error: " .
        $e->getMessage()
    );

    productActionRespond(
        false,
        $e->getMessage(),
        [],
        422
    );
}