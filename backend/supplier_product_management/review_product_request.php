<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("_helpers.php");
require_once("../helpers/supplier_communication.php");

requireModulePermission("vendors");
requireAnyRole(["Admin", "Staff"]);

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    supplierProductRespond(false, "Invalid request method.", [], 405);
}

requireCsrfToken();

if (
    !supplierProductTableExists($conn, "tbl_supplier_product_request") ||
    !supplierProductTableExists($conn, "tbl_supplier_product_request_variants") ||
    !supplierProductTableExists($conn, "tbl_product_family")
) {
    supplierProductRespond(
        false,
        "The enterprise product-variant migration has not been installed.",
        [],
        500
    );
}

$data = supplierProductReadInput();

$requestId = filter_var(
    $data["request_id"] ?? null,
    FILTER_VALIDATE_INT
);

$reviewAction = strtolower(trim((string)($data["review_action"] ?? "")));
$rejectionReason = trim((string)($data["rejection_reason"] ?? ""));

$autoApprove = filter_var(
    $data["auto_approve"] ?? false,
    FILTER_VALIDATE_BOOLEAN
);

$currentRole = trim(
    (string)($_SESSION["role"] ?? "")
);

if ($autoApprove && $currentRole !== "Admin") {
    supplierProductRespond(
        false,
        "Only an Admin can automatically approve an assisted product entry.",
        [],
        403
    );
}

$reviewedBy = (int)($_SESSION["user_id"] ?? 0);
if ($reviewedBy <= 0) {
    $reviewedBy = null;
}
$reviewedByName = trim(
    (string)($data["reviewed_by_name"] ?? "System User")
);

$approvedVariantIdsInput =
    $data["approved_variant_ids"] ??
    $data["variant_ids"] ??
    [];

if (is_string($approvedVariantIdsInput)) {
    $decoded = json_decode($approvedVariantIdsInput, true);
    $approvedVariantIdsInput = is_array($decoded)
        ? $decoded
        : array_filter(array_map("trim", explode(",", $approvedVariantIdsInput)));
}

if (!is_array($approvedVariantIdsInput)) {
    $approvedVariantIdsInput = [];
}

$approvedVariantIds = array_values(
    array_unique(
        array_filter(
            array_map("intval", $approvedVariantIdsInput),
            fn($id) => $id > 0
        )
    )
);

if (!$requestId) {
    supplierProductRespond(false, "A valid product request ID is required.", [], 422);
}

if (!in_array($reviewAction, ["approve", "reject"], true)) {
    supplierProductRespond(false, "Select either Approve or Reject.", [], 422);
}

if ($reviewAction === "reject" && $rejectionReason === "") {
    supplierProductRespond(
        false,
        "Enter the reason for rejecting this product request.",
        [],
        422
    );
}

function normalizeVariantLabel(?string $value): string
{
    $value = trim(preg_replace("/\s+/", " ", (string)$value));
    return $value !== "" ? $value : "Standard";
}

function skuExists(PDO $conn, string $sku): bool
{
    $stmt = $conn->prepare("
        SELECT product_id
        FROM tbl_inv
        WHERE LOWER(TRIM(sku)) = LOWER(TRIM(:sku))
        LIMIT 1
    ");
    $stmt->execute([":sku" => $sku]);
    return (bool)$stmt->fetchColumn();
}

function resolveVariantSku(PDO $conn, array $request, array $variant): string
{
    $requestedSku = strtoupper(trim((string)($variant["requested_sku"] ?? "")));

    if ($requestedSku !== "" && !skuExists($conn, $requestedSku)) {
        return $requestedSku;
    }

    $seedName = trim((string)$request["product_name"]) . " " .
        normalizeVariantLabel($variant["variant_label"] ?? "Standard");

    $generatedSku = generateApprovedProductSku(
        $conn,
        (string)($request["category_name"] ?? "Product"),
        $seedName
    );

    $attempt = 0;
    while (skuExists($conn, $generatedSku)) {
        $attempt++;
        $generatedSku = generateApprovedProductSku(
            $conn,
            (string)($request["category_name"] ?? "Product"),
            $seedName . " " . $attempt
        );

        if ($attempt > 20) {
            throw new RuntimeException(
                "Unable to generate a unique SKU for {$seedName}."
            );
        }
    }

    return strtoupper(trim($generatedSku));
}

function getOrCreateProductFamily(PDO $conn, array $request): int
{
    if (!empty($request["family_id"])) {
        $familyStmt = $conn->prepare("
            SELECT family_id
            FROM tbl_product_family
            WHERE family_id = :family_id
            LIMIT 1
            FOR UPDATE
        ");
        $familyStmt->execute([":family_id" => (int)$request["family_id"]]);
        $existingFamilyId = $familyStmt->fetchColumn();
        if ($existingFamilyId) {
            return (int)$existingFamilyId;
        }
    }

    $categoryId = !empty($request["category_id"])
        ? (int)$request["category_id"]
        : null;

    $familyStmt = $conn->prepare("
        SELECT family_id
        FROM tbl_product_family
        WHERE vendor_id = :vendor_id
        AND LOWER(TRIM(product_name)) = LOWER(TRIM(:product_name))
        AND (
            category_id = :category_id
            OR (category_id IS NULL AND :category_id_null IS NULL)
        )
        AND status = 'Active'
        ORDER BY family_id
        LIMIT 1
        FOR UPDATE
    ");

    $familyStmt->execute([
        ":vendor_id" => (int)$request["vendor_id"],
        ":product_name" => $request["product_name"],
        ":category_id" => $categoryId,
        ":category_id_null" => $categoryId
    ]);

    $familyId = $familyStmt->fetchColumn();

    if ($familyId) {
        $updateFamilyStmt = $conn->prepare("
            UPDATE tbl_product_family
            SET
                category_id = :category_id,
                category_name = :category_name,
                product_description = COALESCE(NULLIF(:product_description, ''), product_description),
                product_image = COALESCE(NULLIF(:product_image, ''), product_image),
                updated_at = NOW()
            WHERE family_id = :family_id
        ");

        $updateFamilyStmt->execute([
            ":category_id" => $categoryId,
            ":category_name" => $request["category_name"] ?? null,
            ":product_description" => $request["product_description"] ?? "",
            ":product_image" => $request["product_image"] ?? "",
            ":family_id" => (int)$familyId
        ]);

        return (int)$familyId;
    }

    $insertFamilyStmt = $conn->prepare("
        INSERT INTO tbl_product_family
        (
            legacy_product_id,
            vendor_id,
            product_name,
            category_id,
            category_name,
            product_description,
            product_image,
            status,
            created_by_request_id,
            created_at,
            updated_at
        )
        VALUES
        (
            NULL,
            :vendor_id,
            :product_name,
            :category_id,
            :category_name,
            :product_description,
            :product_image,
            'Active',
            :created_by_request_id,
            NOW(),
            NOW()
        )
    ");

    $insertFamilyStmt->execute([
        ":vendor_id" => (int)$request["vendor_id"],
        ":product_name" => $request["product_name"],
        ":category_id" => $categoryId,
        ":category_name" => $request["category_name"] ?? null,
        ":product_description" => !empty($request["product_description"])
            ? $request["product_description"]
            : null,
        ":product_image" => !empty($request["product_image"])
            ? $request["product_image"]
            : null,
        ":created_by_request_id" => (int)$request["request_id"]
    ]);

    return (int)$conn->lastInsertId();
}

function variantAlreadyExists(
    PDO $conn,
    int $vendorId,
    int $familyId,
    string $variantLabel
): bool {
    $stmt = $conn->prepare("
        SELECT product_id
        FROM tbl_inv
        WHERE vendor_id = :vendor_id
        AND family_id = :family_id
        AND LOWER(
            TRIM(
                COALESCE(NULLIF(variant_label, ''), 'Standard')
            )
        ) = LOWER(TRIM(:variant_label))
        AND COALESCE(status, '') <> 'Archived'
        LIMIT 1
    ");

    $stmt->execute([
        ":vendor_id" => $vendorId,
        ":family_id" => $familyId,
        ":variant_label" => $variantLabel
    ]);

    return (bool)$stmt->fetchColumn();
}

try {
    $conn->beginTransaction();

    $requestStmt = $conn->prepare("
        SELECT
            r.*,
            v.vendor_name,
            v.status AS vendor_status
        FROM tbl_supplier_product_request r
        INNER JOIN tbl_vendor v
            ON v.vendor_id = r.vendor_id
        WHERE r.request_id = :request_id
        LIMIT 1
        FOR UPDATE
    ");

    $requestStmt->execute([":request_id" => $requestId]);
    $request = $requestStmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        throw new RuntimeException("The supplier product request was not found.");
    }

    if ($request["status"] !== "Pending") {
        throw new RuntimeException("Only pending product requests can be reviewed.");
    }

    if ($autoApprove) {
        $transactionSource = trim(
            (string)($request["transaction_source"] ?? "")
        );

        if ($transactionSource !== "Walk-in") {
            throw new RuntimeException(
                "Automatic approval is only allowed for Admin-created Walk-in / Assisted product entries."
            );
        }

        if ($reviewAction !== "approve") {
            throw new RuntimeException(
                "Automatic product processing only supports approval."
            );
        }
    }

    if (strtolower(trim((string)($request["vendor_status"] ?? "Active"))) === "archived") {
        throw new RuntimeException("The supplier account is archived.");
    }

    $variantStmt = $conn->prepare("
        SELECT *
        FROM tbl_supplier_product_request_variants
        WHERE request_id = :request_id
        ORDER BY sort_order, request_variant_id
        FOR UPDATE
    ");

    $variantStmt->execute([":request_id" => $requestId]);
    $variants = $variantStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($variants) === 0) {
        $legacyVariantStmt = $conn->prepare("
            INSERT INTO tbl_supplier_product_request_variants
            (
                request_id,
                variant_label,
                variant_value,
                variant_unit,
                selling_unit,
                supplier_price,
                reorder_level,
                requested_sku,
                generated_sku,
                status,
                approved_product_id,
                rejection_reason,
                sort_order,
                created_at,
                updated_at
            )
            VALUES
            (
                :request_id,
                'Standard',
                NULL,
                NULL,
                :selling_unit,
                :supplier_price,
                :reorder_level,
                :requested_sku,
                NULL,
                'Pending',
                NULL,
                NULL,
                0,
                NOW(),
                NOW()
            )
        ");

        $legacyVariantStmt->execute([
            ":request_id" => $requestId,
            ":selling_unit" => !empty($request["unit_type"])
                ? $request["unit_type"]
                : "pcs",
            ":supplier_price" => (float)($request["supplier_price"] ?? 0),
            ":reorder_level" => max(0, (int)($request["reorder_level"] ?? 0)),
            ":requested_sku" => !empty($request["requested_sku"])
                ? $request["requested_sku"]
                : null
        ]);

        $variantStmt->execute([":request_id" => $requestId]);
        $variants = $variantStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    if (count($variants) === 0) {
        throw new RuntimeException("This product proposal does not contain any variants.");
    }

    if ($reviewAction === "reject") {
        $rejectVariantsStmt = $conn->prepare("
            UPDATE tbl_supplier_product_request_variants
            SET
                status = 'Rejected',
                rejection_reason = :rejection_reason,
                updated_at = NOW()
            WHERE request_id = :request_id
            AND status = 'Pending'
        ");

        $rejectVariantsStmt->execute([
            ":rejection_reason" => $rejectionReason,
            ":request_id" => $requestId
        ]);

        $rejectStmt = $conn->prepare("
            UPDATE tbl_supplier_product_request
            SET
                status = 'Rejected',
                reviewed_by = :reviewed_by,
                reviewed_by_name = :reviewed_by_name,
                reviewed_at = NOW(),
                rejection_reason = :rejection_reason,
                updated_at = NOW()
            WHERE request_id = :request_id
        ");

        $rejectStmt->execute([
            ":reviewed_by" => $reviewedBy ?: null,
            ":reviewed_by_name" => $reviewedByName !== ""
                ? $reviewedByName
                : "System User",
            ":rejection_reason" => $rejectionReason,
            ":request_id" => $requestId
        ]);

        logSupplierProductAudit(
            $conn,
            $reviewedBy ?: null,
            $reviewedByName,
            "Rejected Product Request",
            sprintf(
                "%s: Rejected %s from supplier %s. Reason: %s",
                $request["request_no"],
                $request["product_name"],
                $request["vendor_name"],
                $rejectionReason
            )
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

        try {
            $supplierCommunication = notifySupplier(
                $conn,
                (int)$request["vendor_id"],
                "Product Request Rejected",
                $request["request_no"] . " for " . $request["product_name"] .
                    " was rejected by BFATC. Reason: " . $rejectionReason,
                "Supplier",
                $requestId,
                $request["request_no"],
                "supplier_product_requests",
                "Product: " . $request["product_name"] .
                    "\nReason: " . $rejectionReason .
                    "\nReviewed by: " . ($reviewedByName !== "" ? $reviewedByName : "System User") .
                    "\nStatus: Rejected"
            );
        } catch (Throwable $communicationException) {
            $communicationError = $communicationException->getMessage();
            error_log(
                "review_product_request.php rejection communication: " .
                $communicationError
            );
        }

        supplierProductRespond(
            true,
            "Product request rejected successfully.",
            [
                "request" => [
                    "request_id" => $requestId,
                    "request_no" => $request["request_no"],
                    "product_name" => $request["product_name"],
                    "status" => "Rejected",
                    "rejection_reason" => $rejectionReason
                ],
                "supplier_recipients" => (int)($supplierCommunication["recipients"] ?? 0),
                "notification_sent" => (bool)($supplierCommunication["notification_sent"] ?? false),
                "notifications_sent" => (int)($supplierCommunication["notifications_sent"] ?? 0),
                "email_sent" => (bool)($supplierCommunication["email_sent"] ?? false),
                "emails_sent" => (int)($supplierCommunication["emails_sent"] ?? 0),
                "communication_error" => $communicationError
            ]
        );
    }

    $pendingVariants = array_values(
        array_filter(
            $variants,
            fn($variant) => ($variant["status"] ?? "") === "Pending"
        )
    );

    if (count($pendingVariants) === 0) {
        throw new RuntimeException("There are no pending variants to approve.");
    }

    if (count($approvedVariantIds) === 0) {
        $approvedVariantIds = array_map(
            fn($variant) => (int)$variant["request_variant_id"],
            $pendingVariants
        );
    }

    $pendingVariantIds = array_map(
        fn($variant) => (int)$variant["request_variant_id"],
        $pendingVariants
    );

    foreach ($approvedVariantIds as $variantId) {
        if (!in_array($variantId, $pendingVariantIds, true)) {
            throw new RuntimeException(
                "One of the selected variants does not belong to this pending product request."
            );
        }
    }

    $familyId = getOrCreateProductFamily($conn, $request);
    $approvedItems = [];
    $rejectedItems = [];

    foreach ($pendingVariants as $variant) {
        $variantId = (int)$variant["request_variant_id"];
        $variantLabel = normalizeVariantLabel(
            $variant["variant_label"] ?? "Standard"
        );

        if (!in_array($variantId, $approvedVariantIds, true)) {
            $variantRejectReason =
                "Variant not approved by BFATC during product review.";

            $rejectVariantStmt = $conn->prepare("
                UPDATE tbl_supplier_product_request_variants
                SET
                    status = 'Rejected',
                    rejection_reason = :rejection_reason,
                    updated_at = NOW()
                WHERE request_variant_id = :request_variant_id
            ");

            $rejectVariantStmt->execute([
                ":rejection_reason" => $variantRejectReason,
                ":request_variant_id" => $variantId
            ]);

            $rejectedItems[] = [
                "request_variant_id" => $variantId,
                "variant_label" => $variantLabel,
                "status" => "Rejected",
                "rejection_reason" => $variantRejectReason
            ];
            continue;
        }

        $supplierPrice = (float)($variant["supplier_price"] ?? 0);
        if ($supplierPrice <= 0) {
            throw new RuntimeException(
                "Supplier price for {$variantLabel} must be greater than zero."
            );
        }

        if (
            variantAlreadyExists(
                $conn,
                (int)$request["vendor_id"],
                $familyId,
                $variantLabel
            )
        ) {
            throw new RuntimeException(
                $request["product_name"] . " — " . $variantLabel .
                " already exists in the active inventory catalog."
            );
        }

        $finalSku = resolveVariantSku($conn, $request, $variant);

        if (mb_strlen($finalSku) > 100) {
            throw new RuntimeException(
                "The generated SKU for {$variantLabel} is too long."
            );
        }

        $sellingUnit = strtolower(trim((string)(
            $variant["selling_unit"] ??
            $request["unit_type"] ??
            "pcs"
        )));
        if ($sellingUnit === "") {
            $sellingUnit = "pcs";
        }

        $reorderLevel = max(0, (int)($variant["reorder_level"] ?? 0));

        $insertProductStmt = $conn->prepare("
            INSERT INTO tbl_inv
            (
                family_id,
                request_variant_id,
                product_name,
                variant_label,
                variant_value,
                variant_unit,
                variant_sort,
                sku,
                category_id,
                category,
                quantity,
                unit_type,
                reorder_level,
                unit,
                supplier_price,
                selling_price,
                publication_status,
                expiry_date,
                product_image,
                vendor_id,
                status,
                created_at,
                updated_at
            )
            VALUES
            (
                :family_id,
                :request_variant_id,
                :product_name,
                :variant_label,
                :variant_value,
                :variant_unit,
                :variant_sort,
                :sku,
                :category_id,
                :category,
                0,
                :unit_type,
                :reorder_level,
                :unit,
                :supplier_price,
                0.00,
                'Unpublished',
                NULL,
                :product_image,
                :vendor_id,
                'Out of Stock',
                NOW(),
                NOW()
            )
        ");

        $insertProductStmt->execute([
            ":family_id" => $familyId,
            ":request_variant_id" => $variantId,
            ":product_name" => $request["product_name"],
            ":variant_label" => $variantLabel,
            ":variant_value" =>
                $variant["variant_value"] !== null && $variant["variant_value"] !== ""
                    ? (float)$variant["variant_value"]
                    : null,
            ":variant_unit" => !empty($variant["variant_unit"])
                ? strtolower(trim((string)$variant["variant_unit"]))
                : null,
            ":variant_sort" => (int)($variant["sort_order"] ?? 0),
            ":sku" => $finalSku,
            ":category_id" => !empty($request["category_id"])
                ? (int)$request["category_id"]
                : null,
            ":category" => $request["category_name"] ?? null,
            ":unit_type" => $sellingUnit,
            ":reorder_level" => $reorderLevel,
            ":unit" => $sellingUnit,
            ":supplier_price" => $supplierPrice,
            ":product_image" => !empty($request["product_image"])
                ? $request["product_image"]
                : null,
            ":vendor_id" => (int)$request["vendor_id"]
        ]);

        $approvedProductId = (int)$conn->lastInsertId();

        $updateVariantStmt = $conn->prepare("
            UPDATE tbl_supplier_product_request_variants
            SET
                generated_sku = :generated_sku,
                status = 'Approved',
                approved_product_id = :approved_product_id,
                rejection_reason = NULL,
                updated_at = NOW()
            WHERE request_variant_id = :request_variant_id
        ");

        $updateVariantStmt->execute([
            ":generated_sku" => $finalSku,
            ":approved_product_id" => $approvedProductId,
            ":request_variant_id" => $variantId
        ]);

        $approvedItems[] = [
            "request_variant_id" => $variantId,
            "approved_product_id" => $approvedProductId,
            "family_id" => $familyId,
            "product_name" => $request["product_name"],
            "variant_label" => $variantLabel,
            "sku" => $finalSku,
            "supplier_price" => $supplierPrice,
            "selling_price" => 0,
            "quantity" => 0,
            "inventory_status" => "Out of Stock",
            "publication_status" => "Unpublished",
            "status" => "Approved"
        ];
    }

    if (count($approvedItems) === 0) {
        throw new RuntimeException("Select at least one size/variant to approve.");
    }

    $firstApproved = $approvedItems[0];

    $approveStmt = $conn->prepare("
        UPDATE tbl_supplier_product_request
        SET
            status = 'Approved',
            generated_sku = :generated_sku,
            approved_product_id = :approved_product_id,
            family_id = :family_id,
            has_variants = :has_variants,
            reviewed_by = :reviewed_by,
            reviewed_by_name = :reviewed_by_name,
            reviewed_at = NOW(),
            rejection_reason = NULL,
            suggested_selling_price = 0.00,
            updated_at = NOW()
        WHERE request_id = :request_id
    ");

    $approveStmt->execute([
        ":generated_sku" => $firstApproved["sku"],
        ":approved_product_id" => $firstApproved["approved_product_id"],
        ":family_id" => $familyId,
        ":has_variants" => count($variants) > 1 ? 1 : 0,
        ":reviewed_by" => $reviewedBy ?: null,
        ":reviewed_by_name" => $reviewedByName !== ""
            ? $reviewedByName
            : "System User",
        ":request_id" => $requestId
    ]);

    $familyRequestStmt = $conn->prepare("
        UPDATE tbl_product_family
        SET
            created_by_request_id = COALESCE(created_by_request_id, :request_id),
            updated_at = NOW()
        WHERE family_id = :family_id
    ");

    $familyRequestStmt->execute([
        ":request_id" => $requestId,
        ":family_id" => $familyId
    ]);

    $approvedVariantLabels = implode(
        ", ",
        array_map(fn($item) => $item["variant_label"], $approvedItems)
    );

    logSupplierProductAudit(
        $conn,
        $reviewedBy ?: null,
        $reviewedByName,
        "Approved Product Request",
        sprintf(
            "%s: Approved %s from supplier %s. Approved variants: %s. %d zero-stock SKU(s) created. Final BFATC selling price remains unset until Inventory publication.",
            $request["request_no"],
            $request["product_name"],
            $request["vendor_name"],
            $approvedVariantLabels,
            count($approvedItems)
        )
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

    try {
        $supplierCommunication = notifySupplier(
            $conn,
            (int)$request["vendor_id"],
            "Product Request Approved",
            $request["request_no"] . " for " . $request["product_name"] .
                " was approved by BFATC. Approved size/variant(s): " .
                $approvedVariantLabels .
                ". Stock remains zero until physical delivery is received.",
            "Supplier",
            $requestId,
            $request["request_no"],
            "supplier_product_requests",
            "Product: " . $request["product_name"] .
                "\nApproved variants: " . $approvedVariantLabels .
                "\nCatalog SKUs created: " . count($approvedItems) .
                "\nCurrent stock: 0" .
                "\nPublication: Unpublished" .
                "\nBFATC selling price: Pending" .
                "\nReviewed by: " . ($reviewedByName !== "" ? $reviewedByName : "System User") .
                "\nStatus: Approved"
        );
    } catch (Throwable $communicationException) {
        $communicationError = $communicationException->getMessage();
        error_log(
            "review_product_request.php approval communication: " .
            $communicationError
        );
    }

    supplierProductRespond(
        true,
        "Product request approved successfully.",
        [
            "request" => [
                "request_id" => $requestId,
                "request_no" => $request["request_no"],
                "vendor_id" => (int)$request["vendor_id"],
                "vendor_name" => $request["vendor_name"],
                "product_name" => $request["product_name"],
                "family_id" => $familyId,
                "status" => "Approved",
                "approved_variant_count" => count($approvedItems),
                "rejected_variant_count" => count($rejectedItems),
                "approved_variants" => $approvedItems,
                "rejected_variants" => $rejectedItems,
                "quantity" => 0,
                "inventory_status" => "Out of Stock",
                "publication_status" => "Unpublished",
                "selling_price" => 0
            ],
            "supplier_recipients" => (int)($supplierCommunication["recipients"] ?? 0),
            "notification_sent" => (bool)($supplierCommunication["notification_sent"] ?? false),
            "notifications_sent" => (int)($supplierCommunication["notifications_sent"] ?? 0),
            "email_sent" => (bool)($supplierCommunication["email_sent"] ?? false),
            "emails_sent" => (int)($supplierCommunication["emails_sent"] ?? 0),
            "communication_error" => $communicationError
        ]
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "Supplier product review error: " .
        $error->getMessage()
    );

    supplierProductRespond(
        false,
        $error->getMessage(),
        [],
        422
    );
}