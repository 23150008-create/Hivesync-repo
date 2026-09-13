<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");
require_once("_helpers.php");

requireAuthentication();
requireAnyRole(["Admin", "Staff", "Supplier", "Vendor"]);

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    supplierProductRespond(
        false,
        "Invalid request method.",
        [],
        405
    );
}

requireCsrfToken();

function supplierProductWalkInColumnExists(
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

if (
    !supplierProductTableExists(
        $conn,
        "tbl_supplier_product_request"
    ) ||
    !supplierProductTableExists(
        $conn,
        "tbl_supplier_product_request_variants"
    )
) {
    supplierProductRespond(
        false,
        "The enterprise product-variant migration has not been installed.",
        [],
        500
    );
}

if (!empty($_POST["payload"])) {
    $data = json_decode(
        (string)$_POST["payload"],
        true
    );

    if (!is_array($data)) {
        supplierProductRespond(
            false,
            "The product proposal payload is invalid.",
            [],
            400
        );
    }
} else {
    $data = supplierProductReadInput();
}

$vendorId = filter_var(
    $data["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

$requestType = strtolower(
    trim(
        (string)(
            $data["request_type"] ??
            "new_product"
        )
    )
);

if (
    !in_array(
        $requestType,
        ["new_product", "add_variant"],
        true
    )
) {
    supplierProductRespond(
        false,
        "Invalid supplier product request type.",
        [],
        422
    );
}

$existingProductId = filter_var(
    $data["existing_product_id"] ?? null,
    FILTER_VALIDATE_INT
);

$familyId = filter_var(
    $data["family_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (
    $requestType === "add_variant" &&
    !$existingProductId
) {
    supplierProductRespond(
        false,
        "Select an existing approved product before adding a variant.",
        [],
        422
    );
}

$productName = trim(
    (string)($data["product_name"] ?? "")
);

$categoryId = filter_var(
    $data["category_id"] ?? null,
    FILTER_VALIDATE_INT
);

$expiryRequiredRaw =
    $data["expiry_required"] ?? 1;

$expiryRequired = filter_var(
    $expiryRequiredRaw,
    FILTER_VALIDATE_BOOLEAN,
    FILTER_NULL_ON_FAILURE
);

if ($expiryRequired === null) {
    $expiryRequired =
        (int)$expiryRequiredRaw === 1;
}

$productDescription = trim(
    (string)(
        $data["product_description"] ?? ""
    )
);

$supplierRemarks = trim(
    (string)(
        $data["supplier_remarks"] ?? ""
    )
);

$requestedBy = (int)($_SESSION["user_id"] ?? 0);
if ($requestedBy <= 0) {
    $requestedBy = null;
}

$requestedByName = trim(
    (string)(
        $data["requested_by_name"] ??
        "Supplier"
    )
);

$variantsRaw =
    $data["variants"] ?? [];

if (is_string($variantsRaw)) {
    $decodedVariants =
        json_decode($variantsRaw, true);

    $variantsRaw =
        is_array($decodedVariants)
            ? $decodedVariants
            : [];
}

if (!is_array($variantsRaw)) {
    $variantsRaw = [];
}

if (count($variantsRaw) === 0) {
    $variantsRaw[] = [
        "variant_label" =>
            trim(
                (string)(
                    $data["variant_label"] ??
                    "Standard"
                )
            ),
        "variant_value" =>
            $data["variant_value"] ?? null,
        "variant_unit" =>
            $data["variant_unit"] ?? null,
        "selling_unit" =>
            trim(
                (string)(
                    $data["unit_type"] ??
                    "pcs"
                )
            ),
        "supplier_price" =>
            (float)(
                $data["supplier_price"] ?? 0
            ),
        "reorder_level" =>
            max(
                0,
                (int)(
                    $data["reorder_level"] ?? 0
                )
            ),
        "requested_sku" =>
            strtoupper(
                trim(
                    (string)(
                        $data["requested_sku"] ??
                        ""
                    )
                )
            )
    ];
}

if (!$vendorId) {
    supplierProductRespond(
        false,
        "A valid supplier ID is required.",
        [],
        422
    );
}

$currentRole = trim(
    (string)($_SESSION["role"] ?? "")
);

$isSupplierAccount = in_array(
    $currentRole,
    ["Supplier", "Vendor"],
    true
);

if ($isSupplierAccount) {
    enforceSupplierVendorAccess((int)$vendorId);
    $transactionSource = "Supplier Portal";
} else {
    requireModulePermission("vendors");
    requireAnyRole(["Admin", "Staff"]);
    $transactionSource = "Walk-in";
}

if (
    !supplierProductWalkInColumnExists(
        $conn,
        "tbl_supplier_product_request",
        "transaction_source"
    )
) {
    supplierProductRespond(
        false,
        "The Walk-in / Assisted transaction migration has not been installed. Missing tbl_supplier_product_request.transaction_source.",
        [],
        500
    );
}

if ($productName === "") {
    supplierProductRespond(
        false,
        "Product name is required.",
        [],
        422
    );
}

if (mb_strlen($productName) > 150) {
    supplierProductRespond(
        false,
        "Product name must not exceed 150 characters.",
        [],
        422
    );
}

if (!$categoryId) {
    supplierProductRespond(
        false,
        "Select a product category.",
        [],
        422
    );
}

if (
    $productDescription !== "" &&
    mb_strlen($productDescription) > 2000
) {
    supplierProductRespond(
        false,
        "Product description must not exceed 2,000 characters.",
        [],
        422
    );
}

if (
    $supplierRemarks !== "" &&
    mb_strlen($supplierRemarks) > 2000
) {
    supplierProductRespond(
        false,
        "Supplier remarks must not exceed 2,000 characters.",
        [],
        422
    );
}

$normalizedVariants = [];
$seenVariantKeys = [];
$seenRequestedSkus = [];

foreach (
    array_values($variantsRaw)
    as $index => $variant
) {
    if (!is_array($variant)) {
        supplierProductRespond(
            false,
            "Variant " . ($index + 1) .
            " is invalid.",
            [],
            422
        );
    }

    $variantLabel = trim(
        (string)(
            $variant["variant_label"] ??
            ""
        )
    );

    $variantValueRaw =
        $variant["variant_value"] ?? null;

    $variantValue =
        $variantValueRaw === "" ||
        $variantValueRaw === null
            ? null
            : (float)$variantValueRaw;

    $variantUnit = strtolower(
        trim(
            (string)(
                $variant["variant_unit"] ??
                ""
            )
        )
    );

    $sellingUnit = strtolower(
        trim(
            (string)(
                $variant["selling_unit"] ??
                $variant["unit_type"] ??
                "pcs"
            )
        )
    );

    $supplierPrice = (float)(
        $variant["supplier_price"] ?? 0
    );

    $reorderLevel = max(
        0,
        (int)(
            $variant["reorder_level"] ?? 0
        )
    );

    $requestedSku = strtoupper(
        trim(
            (string)(
                $variant["requested_sku"] ??
                ""
            )
        )
    );

    if ($variantLabel === "") {
        supplierProductRespond(
            false,
            "Enter a size/variant for product line " .
            ($index + 1) . ".",
            [],
            422
        );
    }

    if (mb_strlen($variantLabel) > 80) {
        supplierProductRespond(
            false,
            "Variant labels must not exceed 80 characters.",
            [],
            422
        );
    }

    if (
        $variantValue !== null &&
        $variantValue <= 0
    ) {
        supplierProductRespond(
            false,
            "Variant value on line " .
            ($index + 1) .
            " must be greater than zero.",
            [],
            422
        );
    }

    if (mb_strlen($variantUnit) > 30) {
        supplierProductRespond(
            false,
            "Variant unit on line " .
            ($index + 1) .
            " is too long.",
            [],
            422
        );
    }

    if ($sellingUnit === "") {
        supplierProductRespond(
            false,
            "Select a selling unit for variant " .
            $variantLabel . ".",
            [],
            422
        );
    }

    if ($supplierPrice <= 0) {
        supplierProductRespond(
            false,
            "Supplier price for " .
            $variantLabel .
            " must be greater than zero.",
            [],
            422
        );
    }

    if (
        $requestedSku !== "" &&
        mb_strlen($requestedSku) > 100
    ) {
        supplierProductRespond(
            false,
            "Requested SKU for " .
            $variantLabel .
            " must not exceed 100 characters.",
            [],
            422
        );
    }

    $variantKey = strtolower(
        preg_replace(
            "/\s+/",
            " ",
            $variantLabel
        )
    );

    if (isset($seenVariantKeys[$variantKey])) {
        supplierProductRespond(
            false,
            "The same size/variant was entered more than once: " .
            $variantLabel . ".",
            [],
            422
        );
    }

    $seenVariantKeys[$variantKey] = true;

    if ($requestedSku !== "") {
        $skuKey = strtolower($requestedSku);

        if (isset($seenRequestedSkus[$skuKey])) {
            supplierProductRespond(
                false,
                "The same requested SKU was entered more than once.",
                [],
                422
            );
        }

        $seenRequestedSkus[$skuKey] = true;
    }

    $normalizedVariants[] = [
        "variant_label" => $variantLabel,
        "variant_value" => $variantValue,
        "variant_unit" =>
            $variantUnit !== ""
                ? $variantUnit
                : null,
        "selling_unit" => $sellingUnit,
        "supplier_price" => $supplierPrice,
        "reorder_level" => $reorderLevel,
        "requested_sku" =>
            $requestedSku !== ""
                ? $requestedSku
                : null,
        "sort_order" => $index
    ];
}

if (count($normalizedVariants) === 0) {
    supplierProductRespond(
        false,
        "Add at least one available size/variant.",
        [],
        422
    );
}

try {
    $conn->beginTransaction();

    $supplierStmt = $conn->prepare("
        SELECT
            vendor_id,
            vendor_name,
            status
        FROM tbl_vendor
        WHERE vendor_id = :vendor_id
        LIMIT 1
        FOR UPDATE
    ");

    $supplierStmt->execute([
        ":vendor_id" => $vendorId
    ]);

    $supplier = $supplierStmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$supplier) {
        throw new RuntimeException(
            "The supplier record was not found."
        );
    }

    if (
        strtolower(
            trim(
                (string)(
                    $supplier["status"] ??
                    "Active"
                )
            )
        ) === "archived"
    ) {
        throw new RuntimeException(
            "The supplier record is archived."
        );
    }

    $existingFamily = null;
    $existingProduct = null;

    if ($requestType === "add_variant") {
        $existingProductStmt = $conn->prepare("
            SELECT
                i.product_id,
                i.family_id,
                i.vendor_id,
                i.product_name,
                i.sku,
                i.category_id,
                i.category,
                i.product_image,
                i.reorder_level,
                i.status
            FROM tbl_inv i
            WHERE i.product_id = :product_id
            AND i.vendor_id = :vendor_id
            AND COALESCE(i.status, '') <> 'Archived'
            LIMIT 1
            FOR UPDATE
        ");

        $existingProductStmt->execute([
            ":product_id" => $existingProductId,
            ":vendor_id" => $vendorId
        ]);

        $existingProduct =
            $existingProductStmt->fetch(
                PDO::FETCH_ASSOC
            );

        if (!$existingProduct) {
            throw new RuntimeException(
                "The selected approved product was not found for this Supplier."
            );
        }

        $productName = trim(
            (string)$existingProduct[
                "product_name"
            ]
        );

        $categoryId =
            !empty(
                $existingProduct["category_id"]
            )
                ? (int)$existingProduct[
                    "category_id"
                ]
                : $categoryId;

        if (
            !supplierProductTableExists(
                $conn,
                "tbl_product_family"
            )
        ) {
            throw new RuntimeException(
                "The product family table is missing."
            );
        }

        if (
            !empty(
                $existingProduct["family_id"]
            )
        ) {
            $familyId =
                (int)$existingProduct[
                    "family_id"
                ];
        }

        if ($familyId) {
            $familyStmt = $conn->prepare("
                SELECT *
                FROM tbl_product_family
                WHERE family_id = :family_id
                AND vendor_id = :vendor_id
                LIMIT 1
                FOR UPDATE
            ");

            $familyStmt->execute([
                ":family_id" => $familyId,
                ":vendor_id" => $vendorId
            ]);

            $existingFamily =
                $familyStmt->fetch(
                    PDO::FETCH_ASSOC
                );
        }

        if (!$existingFamily) {
            $familyLookupStmt =
                $conn->prepare("
                    SELECT *
                    FROM tbl_product_family
                    WHERE vendor_id = :vendor_id
                    AND LOWER(TRIM(product_name)) =
                        LOWER(TRIM(:product_name))
                    AND status = 'Active'
                    ORDER BY family_id
                    LIMIT 1
                    FOR UPDATE
                ");

            $familyLookupStmt->execute([
                ":vendor_id" => $vendorId,
                ":product_name" => $productName
            ]);

            $existingFamily =
                $familyLookupStmt->fetch(
                    PDO::FETCH_ASSOC
                );

            if ($existingFamily) {
                $familyId =
                    (int)$existingFamily[
                        "family_id"
                    ];
            }
        }

        if (!$existingFamily) {
            $createFamilyStmt =
                $conn->prepare("
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
                        :legacy_product_id,
                        :vendor_id,
                        :product_name,
                        :category_id,
                        :category_name,
                        :product_description,
                        :product_image,
                        'Active',
                        NULL,
                        NOW(),
                        NOW()
                    )
                ");

            $createFamilyStmt->execute([
                ":legacy_product_id" =>
                    $existingProductId,
                ":vendor_id" =>
                    $vendorId,
                ":product_name" =>
                    $productName,
                ":category_id" =>
                    $categoryId ?: null,
                ":category_name" =>
                    !empty(
                        $existingProduct[
                            "category"
                        ]
                    )
                        ? $existingProduct[
                            "category"
                        ]
                        : null,
                ":product_description" =>
                    $productDescription !== ""
                        ? $productDescription
                        : null,
                ":product_image" =>
                    !empty(
                        $existingProduct[
                            "product_image"
                        ]
                    )
                        ? $existingProduct[
                            "product_image"
                        ]
                        : null
            ]);

            $familyId =
                (int)$conn->lastInsertId();

            $existingFamily = [
                "family_id" => $familyId,
                "vendor_id" => $vendorId,
                "product_name" => $productName,
                "category_id" => $categoryId,
                "category_name" =>
                    $existingProduct[
                        "category"
                    ] ?? null,
                "product_description" =>
                    $productDescription,
                "product_image" =>
                    $existingProduct[
                        "product_image"
                    ] ?? null,
                "status" => "Active"
            ];
        }

        $backfillFamilyStmt =
            $conn->prepare("
                UPDATE tbl_inv
                SET family_id = :family_id
                WHERE vendor_id = :vendor_id
                AND LOWER(TRIM(product_name)) =
                    LOWER(TRIM(:product_name))
                AND (
                    family_id IS NULL
                    OR family_id = 0
                )
                AND COALESCE(status, '') <> 'Archived'
            ");

        $backfillFamilyStmt->execute([
            ":family_id" => $familyId,
            ":vendor_id" => $vendorId,
            ":product_name" => $productName
        ]);

        if (
            $productDescription === "" &&
            !empty(
                $existingFamily[
                    "product_description"
                ]
            )
        ) {
            $productDescription = trim(
                (string)$existingFamily[
                    "product_description"
                ]
            );
        }
    }

    if ($requestType === "add_variant") {
        $requestedVariantLabels = [];

        foreach ($normalizedVariants as $variant) {
            $variantLabel = trim(
                (string)(
                    $variant["variant_label"] ??
                    ""
                )
            );

            if ($variantLabel === "") {
                continue;
            }

            $normalizedVariant =
                strtolower(
                    trim($variantLabel)
                );

            if (
                in_array(
                    $normalizedVariant,
                    $requestedVariantLabels,
                    true
                )
            ) {
                supplierProductRespond(
                    false,
                    "Duplicate variant in this request.",
                    [
                        "duplicate_variant" =>
                            $variantLabel
                    ],
                    422
                );
            }

            $requestedVariantLabels[] =
                $normalizedVariant;

            $existingVariantStmt =
                $conn->prepare("
                    SELECT
                        product_id,
                        product_name,
                        variant_label,
                        variant_value,
                        variant_unit,
                        unit,
                        sku,
                        status
                    FROM tbl_inv
                    WHERE vendor_id = :vendor_id
                    AND family_id = :family_id
                    AND COALESCE(status, '') <> 'Archived'
                    AND (
                        LOWER(
                            TRIM(
                                COALESCE(
                                    variant_label,
                                    ''
                                )
                            )
                        ) = LOWER(
                            TRIM(
                                :variant_label_1
                            )
                        )

                        OR LOWER(
                            TRIM(
                                COALESCE(
                                    unit,
                                    ''
                                )
                            )
                        ) = LOWER(
                            TRIM(
                                :variant_label_2
                            )
                        )

                        OR LOWER(
                            TRIM(
                                CONCAT(
                                    COALESCE(
                                        CAST(
                                            variant_value
                                            AS CHAR
                                        ),
                                        ''
                                    ),
                                    CASE
                                        WHEN variant_value IS NOT NULL
                                             AND COALESCE(
                                                 variant_unit,
                                                 ''
                                             ) <> ''
                                        THEN ' '
                                        ELSE ''
                                    END,
                                    COALESCE(
                                        variant_unit,
                                        ''
                                    )
                                )
                            )
                        ) = LOWER(
                            TRIM(
                                :variant_label_3
                            )
                        )
                    )
                    LIMIT 1
                ");

            $existingVariantStmt->execute([
                ":vendor_id" =>
                    $vendorId,
                ":family_id" =>
                    $familyId,
                ":variant_label_1" =>
                    $variantLabel,
                ":variant_label_2" =>
                    $variantLabel,
                ":variant_label_3" =>
                    $variantLabel
            ]);

            $existingVariant =
                $existingVariantStmt->fetch(
                    PDO::FETCH_ASSOC
                );

            if ($existingVariant) {
                supplierProductRespond(
                    false,
                    "Variant Already Exists",
                    [
                        "duplicate_type" =>
                            "approved",
                        "product_name" =>
                            $productName,
                        "variant_label" =>
                            $variantLabel,
                        "sku" =>
                            $existingVariant["sku"] ??
                            null,
                        "message_detail" =>
                            sprintf(
                                "%s - %s already exists as an approved product variant.",
                                $productName,
                                $variantLabel
                            )
                    ],
                    409
                );
            }

            $pendingVariantStmt =
                $conn->prepare("
                    SELECT
                        r.request_no,
                        r.status,
                        v.variant_label
                    FROM tbl_supplier_product_request r
                    INNER JOIN tbl_supplier_product_request_variants v
                        ON v.request_id = r.request_id
                    WHERE r.vendor_id = :vendor_id
                    AND r.family_id = :family_id
                    AND r.status = 'Pending'
                    AND LOWER(
                        TRIM(
                            COALESCE(
                                v.variant_label,
                                ''
                            )
                        )
                    ) = LOWER(
                        TRIM(
                            :variant_label
                        )
                    )
                    LIMIT 1
                ");

            $pendingVariantStmt->execute([
                ":vendor_id" =>
                    $vendorId,
                ":family_id" =>
                    $familyId,
                ":variant_label" =>
                    $variantLabel
            ]);

            $pendingVariant =
                $pendingVariantStmt->fetch(
                    PDO::FETCH_ASSOC
                );

            if ($pendingVariant) {
                supplierProductRespond(
                    false,
                    "Variant Already Pending",
                    [
                        "duplicate_type" =>
                            "pending",
                        "product_name" =>
                            $productName,
                        "variant_label" =>
                            $variantLabel,
                        "request_no" =>
                            $pendingVariant[
                                "request_no"
                            ] ?? null,
                        "message_detail" =>
                            sprintf(
                                "%s - %s is already under BFATC review.",
                                $productName,
                                $variantLabel
                            )
                    ],
                    409
                );
            }
        }
    }

    $categoryStmt = $conn->prepare("
        SELECT
            category_id,
            category_name
        FROM tbl_category
        WHERE category_id = :category_id
        LIMIT 1
    ");

    $categoryStmt->execute([
        ":category_id" => $categoryId
    ]);

    $category = $categoryStmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$category) {
        throw new RuntimeException(
            "The selected category was not found."
        );
    }

    $categoryName = trim(
        (string)$category["category_name"]
    );

    $pendingRequestStmt = $conn->prepare("
        SELECT
            request_id,
            request_no
        FROM tbl_supplier_product_request
        WHERE vendor_id = :vendor_id
        AND LOWER(TRIM(product_name)) =
            LOWER(TRIM(:product_name))
        AND status = 'Pending'
        LIMIT 1
        FOR UPDATE
    ");

    $pendingRequestStmt->execute([
        ":vendor_id" => $vendorId,
        ":product_name" => $productName
    ]);

    if (
        $pendingRequestStmt->fetch(
            PDO::FETCH_ASSOC
        )
    ) {
        throw new RuntimeException(
            $requestType === "add_variant"
                ? "A pending product/variant request for this family already exists. Wait for BFATC review before submitting another variant."
                : "A pending proposal for this product family already exists."
        );
    }

    foreach (
        $normalizedVariants
        as $variant
    ) {
        $duplicateVariantStmt =
            $conn->prepare("
                SELECT i.product_id
                FROM tbl_inv i
                WHERE i.vendor_id = :vendor_id
                AND LOWER(TRIM(i.product_name)) =
                    LOWER(TRIM(:product_name))
                AND LOWER(
                    TRIM(
                        COALESCE(
                            NULLIF(i.variant_label, ''),
                            'Standard'
                        )
                    )
                ) =
                    LOWER(TRIM(:variant_label))
                AND COALESCE(i.status, '') <> 'Archived'
                LIMIT 1
            ");

        $duplicateVariantStmt->execute([
            ":vendor_id" => $vendorId,
            ":product_name" => $productName,
            ":variant_label" =>
                $variant["variant_label"]
        ]);

        if ($duplicateVariantStmt->fetchColumn()) {
            throw new RuntimeException(
                $productName .
                " — " .
                $variant["variant_label"] .
                " is already an active supplier product."
            );
        }

        if (
            !empty(
                $variant["requested_sku"]
            )
        ) {
            $skuCheckStmt =
                $conn->prepare("
                    SELECT product_id
                    FROM tbl_inv
                    WHERE LOWER(TRIM(sku)) =
                        LOWER(TRIM(:sku))
                    LIMIT 1
                ");

            $skuCheckStmt->execute([
                ":sku" =>
                    $variant["requested_sku"]
            ]);

            if ($skuCheckStmt->fetchColumn()) {
                throw new RuntimeException(
                    "Requested SKU " .
                    $variant["requested_sku"] .
                    " is already used by another inventory product."
                );
            }

            $pendingSkuStmt =
                $conn->prepare("
                    SELECT
                        r.request_no
                    FROM tbl_supplier_product_request_variants rv
                    INNER JOIN tbl_supplier_product_request r
                        ON r.request_id = rv.request_id
                    WHERE LOWER(TRIM(rv.requested_sku)) =
                        LOWER(TRIM(:sku))
                    AND rv.status = 'Pending'
                    AND r.status = 'Pending'
                    LIMIT 1
                ");

            $pendingSkuStmt->execute([
                ":sku" =>
                    $variant["requested_sku"]
            ]);

            $pendingSkuRequest =
                $pendingSkuStmt->fetchColumn();

            if ($pendingSkuRequest) {
                throw new RuntimeException(
                    "Requested SKU " .
                    $variant["requested_sku"] .
                    " is already used by pending proposal " .
                    $pendingSkuRequest . "."
                );
            }
        }
    }

    $productImage = null;

    if (
        isset($_FILES["product_image"]) &&
        is_array($_FILES["product_image"])
    ) {
        $productImage =
            saveSupplierProductImage(
                $_FILES["product_image"]
            );
    } elseif (
        $requestType === "add_variant" &&
        !empty(
            $existingProduct["product_image"]
        )
    ) {
        $productImage = trim(
            (string)$existingProduct[
                "product_image"
            ]
        );
    } elseif (
        $requestType === "add_variant" &&
        !empty(
            $existingFamily["product_image"]
        )
    ) {
        $productImage = trim(
            (string)$existingFamily[
                "product_image"
            ]
        );
    }

    $requestNo =
        generateSupplierProductRequestNo(
            $conn
        );

    $firstVariant =
        $normalizedVariants[0];

    $parentStmt = $conn->prepare("
        INSERT INTO tbl_supplier_product_request
        (
            request_no,
            vendor_id,
            product_name,
            requested_sku,
            generated_sku,
            category_id,
            category_name,
            unit_type,
            reorder_level,
            supplier_price,
            suggested_selling_price,
            expiry_required,
            product_description,
            supplier_remarks,
            product_image,
            status,
            approved_product_id,
            family_id,
            has_variants,
            transaction_source,
            requested_by,
            requested_by_name,
            reviewed_by,
            reviewed_by_name,
            reviewed_at,
            rejection_reason,
            created_at,
            updated_at
        )
        VALUES
        (
            :request_no,
            :vendor_id,
            :product_name,
            :requested_sku,
            NULL,
            :category_id,
            :category_name,
            :unit_type,
            :reorder_level,
            :supplier_price,
            0.00,
            :expiry_required,
            :product_description,
            :supplier_remarks,
            :product_image,
            'Pending',
            NULL,
            :family_id,
            :has_variants,
            :transaction_source,
            :requested_by,
            :requested_by_name,
            NULL,
            NULL,
            NULL,
            NULL,
            NOW(),
            NOW()
        )
    ");

    $parentStmt->execute([
        ":request_no" => $requestNo,
        ":vendor_id" => $vendorId,
        ":product_name" => $productName,
        ":requested_sku" =>
            $firstVariant[
                "requested_sku"
            ],
        ":category_id" => $categoryId,
        ":category_name" => $categoryName,
        ":unit_type" =>
            $firstVariant[
                "selling_unit"
            ],
        ":reorder_level" =>
            $firstVariant[
                "reorder_level"
            ],
        ":supplier_price" =>
            $firstVariant[
                "supplier_price"
            ],
        ":expiry_required" =>
            $expiryRequired ? 1 : 0,
        ":product_description" =>
            $productDescription !== ""
                ? $productDescription
                : null,
        ":supplier_remarks" =>
            $supplierRemarks !== ""
                ? $supplierRemarks
                : null,
        ":product_image" =>
            $productImage,
        ":family_id" =>
            $requestType === "add_variant"
                ? $familyId
                : null,
        ":has_variants" =>
            count($normalizedVariants) > 1
                ? 1
                : 0,
        ":transaction_source" =>
            $transactionSource,
        ":requested_by" =>
            $requestedBy ?: null,
        ":requested_by_name" =>
            $requestedByName !== ""
                ? $requestedByName
                : "Supplier"
    ]);

    $requestId =
        (int)$conn->lastInsertId();

    $variantStmt = $conn->prepare("
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
            :variant_label,
            :variant_value,
            :variant_unit,
            :selling_unit,
            :supplier_price,
            :reorder_level,
            :requested_sku,
            NULL,
            'Pending',
            NULL,
            NULL,
            :sort_order,
            NOW(),
            NOW()
        )
    ");

    $createdVariants = [];

    foreach (
        $normalizedVariants
        as $variant
    ) {
        $variantStmt->execute([
            ":request_id" => $requestId,
            ":variant_label" =>
                $variant["variant_label"],
            ":variant_value" =>
                $variant["variant_value"],
            ":variant_unit" =>
                $variant["variant_unit"],
            ":selling_unit" =>
                $variant["selling_unit"],
            ":supplier_price" =>
                $variant["supplier_price"],
            ":reorder_level" =>
                $variant["reorder_level"],
            ":requested_sku" =>
                $variant["requested_sku"],
            ":sort_order" =>
                $variant["sort_order"]
        ]);

        $createdVariants[] = array_merge(
            [
                "request_variant_id" =>
                    (int)$conn->lastInsertId()
            ],
            $variant,
            [
                "status" =>
                    $currentRole === "Admin"
                        ? "Pending Auto-Approval"
                        : "Pending",
                "transaction_source" =>
                    $transactionSource,
                "auto_approve_required" =>
                    $currentRole === "Admin" &&
                    $transactionSource === "Walk-in"
            ]
        );
    }

    $sourceLabel =
        $transactionSource === "Walk-in"
            ? "Walk-in / Assisted"
            : "Supplier Portal";

    $auditDetail =
        $requestType === "add_variant"
            ? sprintf(
                "%s: %s recorded %d new variant(s) for existing product family %s for BFATC review. Source: %s. Encoded by: %s.",
                $requestNo,
                $supplier["vendor_name"],
                count($createdVariants),
                $productName,
                $sourceLabel,
                $requestedByName
            )
            : sprintf(
                "%s: %s recorded %s with %d available variant(s) for BFATC review. Source: %s. Encoded by: %s.",
                $requestNo,
                $supplier["vendor_name"],
                $productName,
                count($createdVariants),
                $sourceLabel,
                $requestedByName
            );

    logSupplierProductAudit(
        $conn,
        $requestedBy ?: null,
        $requestedByName,
        $requestType === "add_variant"
            ? "Submitted Product Variant Request"
            : "Submitted Product Request",
        $auditDetail
    );

    createSupplierProductNotification(
        $conn,
        $requestType === "add_variant"
            ? "New Supplier Product Variant Request"
            : "New Supplier Product Request",
        $requestType === "add_variant"
            ? sprintf(
                "%s has %d new size/variant option(s) recorded for existing product family %s. Source: %s.",
                $supplier["vendor_name"],
                count($createdVariants),
                $productName,
                $sourceLabel
            )
            : sprintf(
                "%s has %s with %d available size/variant option(s) recorded for product approval. Source: %s.",
                $supplier["vendor_name"],
                $productName,
                count($createdVariants),
                $sourceLabel
            ),
        $requestId
    );

    $conn->commit();

    supplierProductRespond(
        true,
        $requestType === "add_variant"
            ? "Product variant request submitted successfully."
            : "Product proposal submitted successfully.",
        [
            "request" => [
                "request_id" => $requestId,
                "request_no" => $requestNo,
                "vendor_id" => $vendorId,
                "vendor_name" =>
                    $supplier["vendor_name"],
                "request_type" =>
                    $requestType,
                "existing_product_id" =>
                    $requestType === "add_variant"
                        ? (int)$existingProductId
                        : null,
                "family_id" =>
                    $requestType === "add_variant"
                        ? (int)$familyId
                        : null,
                "product_name" => $productName,
                "category_id" => $categoryId,
                "category_name" => $categoryName,
                "expiry_required" =>
                    $expiryRequired ? 1 : 0,
                "has_variants" =>
                    count($createdVariants) > 1
                        ? 1
                        : 0,
                "variant_count" =>
                    count($createdVariants),
                "variants" =>
                    $createdVariants,
                "status" => "Pending"
            ]
        ]
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "Supplier product request create error: " .
        $error->getMessage()
    );

    supplierProductRespond(
        false,
        $error->getMessage(),
        [],
        422
    );
}