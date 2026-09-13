<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("inventory");
requireAnyRole(["Admin", "Staff"]);



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


function normalizeName(string $value): string
{
    return trim(
        preg_replace("/\s+/", " ", $value)
    );
}


function normalizeNullableInt(mixed $value): ?int
{
    if ($value === null || $value === "") {
        return null;
    }

    $filtered = filter_var(
        $value,
        FILTER_VALIDATE_INT
    );

    if (
        $filtered === false ||
        (int)$filtered <= 0
    ) {
        return null;
    }

    return (int)$filtered;
}


function normalizeVariantUnit(string $value): string
{
    $value = strtolower(trim($value));

    $map = [
        "milliliter" => "ml",
        "milliliters" => "ml",
        "ml" => "ml",

        "liter" => "l",
        "liters" => "l",
        "litre" => "l",
        "litres" => "l",
        "l" => "l",

        "gram" => "g",
        "grams" => "g",
        "g" => "g",

        "kilogram" => "kg",
        "kilograms" => "kg",
        "kg" => "kg",

        "piece" => "pcs",
        "pieces" => "pcs",
        "pc" => "pcs",
        "pcs" => "pcs",

        "pack" => "pack",
        "packs" => "pack",

        "set" => "set",
        "sets" => "set"
    ];

    return $map[$value] ?? $value;
}


function formatVariantValue(float $value): string
{
    if (
        abs(
            $value - round($value)
        ) < 0.000001
    ) {
        return (string)(int)round($value);
    }

    return rtrim(
        rtrim(
            number_format(
                $value,
                3,
                ".",
                ""
            ),
            "0"
        ),
        "."
    );
}


function buildVariantLabel(
    ?float $variantValue,
    string $variantUnit,
    string $customLabel = ""
): string {
    $customLabel = normalizeName($customLabel);

    if ($customLabel !== "") {
        return $customLabel;
    }

    if (
        $variantValue !== null &&
        $variantValue > 0
    ) {
        $formatted =
            formatVariantValue($variantValue);

        return $variantUnit !== ""
            ? $formatted . " " . $variantUnit
            : $formatted;
    }

    return "Standard";
}


function categoryAllowsExpiry(string $categoryName): bool
{
    $normalized =
        strtolower(trim($categoryName));

    return !in_array(
        $normalized,
        [
            "handicrafts",
            "souvenirs",
            "novelty",
            "novelty products"
        ],
        true
    );
}


function categoryRequiresExpiry(string $categoryName): bool
{
    $normalized =
        strtolower(trim($categoryName));

    return in_array(
        $normalized,
        [
            "organic produce",
            "fresh harvest",
            "local delicacies"
        ],
        true
    );
}


function getAllowedUnits(string $categoryName): array
{
    $normalized =
        strtolower(trim($categoryName));

    switch ($normalized) {
        case "organic produce":
        case "fresh harvest":
            return [
                "pcs",
                "kg",
                "g",
                "bag",
                "bundle",
                "crate",
                "tray"
            ];

        case "beverages":
            return [
                "bottle",
                "can",
                "ml",
                "liter",
                "pack",
                "case"
            ];

        case "honey products":
            return [
                "jar",
                "bottle",
                "ml",
                "liter",
                "g",
                "kg",
                "pack",
                "box"
            ];

        case "processed goods":
            return [
                "pcs",
                "pack",
                "box",
                "bottle",
                "jar",
                "can",
                "bag",
                "g",
                "kg",
                "ml"
            ];

        case "local delicacies":
            return [
                "pcs",
                "pack",
                "box",
                "tray",
                "bag",
                "g",
                "kg"
            ];

        case "handicrafts":
        case "souvenirs":
        case "novelty":
        case "novelty products":
            return [
                "pcs",
                "set",
                "box",
                "pack"
            ];

        default:
            return [
                "pcs",
                "pack",
                "box",
                "set"
            ];
    }
}


function buildSkuPrefix(
    string $productName,
    string $categoryName
): string {
    $categoryClean =
        strtoupper(
            preg_replace(
                "/[^A-Za-z0-9]/",
                "",
                $categoryName
            )
        );

    $productClean =
        strtoupper(
            preg_replace(
                "/[^A-Za-z0-9]/",
                "",
                $productName
            )
        );

    $categoryPrefix =
        str_pad(
            substr($categoryClean, 0, 3),
            3,
            "X"
        );

    $productPrefix =
        str_pad(
            substr($productClean, 0, 3),
            3,
            "X"
        );

    return
        $categoryPrefix .
        "-" .
        $productPrefix;
}


function createSku(
    PDO $conn,
    string $productName,
    string $categoryName
): string {
    $prefix =
        buildSkuPrefix(
            $productName,
            $categoryName
        );

    $stmt = $conn->prepare("
        SELECT sku
        FROM tbl_inv
        WHERE sku LIKE :sku_pattern
        ORDER BY
            CAST(
                SUBSTRING_INDEX(sku, '-', -1)
                AS UNSIGNED
            ) DESC,
            product_id DESC
        LIMIT 1
    ");

    $stmt->execute([
        ":sku_pattern" =>
            $prefix . "-%"
    ]);

    $lastSku = $stmt->fetchColumn();
    $highestNumber = 0;

    if (
        $lastSku &&
        preg_match(
            "/-(\d+)$/",
            (string)$lastSku,
            $matches
        )
    ) {
        $highestNumber = (int)$matches[1];
    }

    $nextNumber =
        $highestNumber + 1;

    do {
        $sku =
            $prefix .
            "-" .
            str_pad(
                (string)$nextNumber,
                3,
                "0",
                STR_PAD_LEFT
            );

        $checkStmt =
            $conn->prepare("
                SELECT COUNT(*)
                FROM tbl_inv
                WHERE UPPER(TRIM(sku)) =
                      UPPER(TRIM(:sku))
            ");

        $checkStmt->execute([
            ":sku" => $sku
        ]);

        $exists =
            (int)$checkStmt
                ->fetchColumn() > 0;

        $nextNumber++;

    } while ($exists);

    return $sku;
}


function saveImage(
    array $file,
    string $uploadDirectory
): string {
    if (
        !isset($file["error"]) ||
        $file["error"] ===
            UPLOAD_ERR_NO_FILE
    ) {
        return "";
    }

    if (
        $file["error"] !==
        UPLOAD_ERR_OK
    ) {
        throw new RuntimeException(
            "The product image could not be uploaded."
        );
    }

    if (
        (int)$file["size"] >
        5 * 1024 * 1024
    ) {
        throw new RuntimeException(
            "Product image must not exceed 5 MB."
        );
    }

    $finfo =
        new finfo(
            FILEINFO_MIME_TYPE
        );

    $mimeType =
        $finfo->file(
            $file["tmp_name"]
        );

    $allowedTypes = [
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp"
    ];

    if (
        !isset(
            $allowedTypes[
                $mimeType
            ]
        )
    ) {
        throw new RuntimeException(
            "Only JPG, PNG, and WEBP images are allowed."
        );
    }

    if (
        !is_dir(
            $uploadDirectory
        )
    ) {
        if (
            !mkdir(
                $uploadDirectory,
                0777,
                true
            ) &&
            !is_dir(
                $uploadDirectory
            )
        ) {
            throw new RuntimeException(
                "Unable to create the product upload directory."
            );
        }
    }

    $filename =
        "product_" .
        date("YmdHis") .
        "_" .
        bin2hex(
            random_bytes(6)
        ) .
        "." .
        $allowedTypes[
            $mimeType
        ];

    $destination =
        $uploadDirectory .
        $filename;

    if (
        !move_uploaded_file(
            $file["tmp_name"],
            $destination
        )
    ) {
        throw new RuntimeException(
            "Unable to save the product image."
        );
    }

    return $filename;
}


if (
    $_SERVER["REQUEST_METHOD"] !==
    "POST"
) {
    respond(
        false,
        "Method not allowed.",
        [],
        405
    );
}

requireCsrfToken();


$productName =
    normalizeName(
        (string)(
            $_POST[
                "product_name"
            ] ?? ""
        )
    );


$sku =
    strtoupper(
        trim(
            (string)(
                $_POST["sku"] ?? ""
            )
        )
    );


$categoryId =
    filter_var(
        $_POST[
            "category_id"
        ] ?? null,
        FILTER_VALIDATE_INT
    );


$unitType =
    strtolower(
        trim(
            (string)(
                $_POST[
                    "unit_type"
                ] ?? "pcs"
            )
        )
    );


$unit =
    strtolower(
        trim(
            (string)(
                $_POST[
                    "unit"
                ] ?? $unitType
            )
        )
    );


$reorderLevel =
    max(
        0,
        (int)(
            $_POST[
                "reorder_level"
            ] ?? 0
        )
    );


$supplierPrice =
    max(
        0,
        (float)(
            $_POST[
                "supplier_price"
            ] ?? 0
        )
    );


$sellingPrice =
    (float)(
        $_POST[
            "selling_price"
        ] ?? 0
    );


$expiryDate =
    trim(
        (string)(
            $_POST[
                "expiry_date"
            ] ?? ""
        )
    );


$vendorId =
    filter_var(
        $_POST[
            "vendor_id"
        ] ?? null,
        FILTER_VALIDATE_INT
    );


$familyId =
    normalizeNullableInt(
        $_POST[
            "family_id"
        ] ?? null
    );


$requestVariantId =
    normalizeNullableInt(
        $_POST[
            "request_variant_id"
        ] ?? null
    );


$variantLabelInput =
    normalizeName(
        (string)(
            $_POST[
                "variant_label"
            ] ?? ""
        )
    );


$rawVariantValue =
    trim(
        (string)(
            $_POST[
                "variant_value"
            ] ?? ""
        )
    );


$variantValue = null;

if ($rawVariantValue !== "") {
    if (!is_numeric($rawVariantValue)) {
        respond(
            false,
            "Variant value must be a valid number.",
            [],
            422
        );
    }

    $variantValue =
        (float)$rawVariantValue;

    if ($variantValue <= 0) {
        respond(
            false,
            "Variant value must be greater than zero.",
            [],
            422
        );
    }
}


$variantUnit =
    normalizeVariantUnit(
        (string)(
            $_POST[
                "variant_unit"
            ] ?? ""
        )
    );


$variantSort =
    max(
        0,
        (int)(
            $_POST[
                "variant_sort"
            ] ?? 0
        )
    );


$variantLabel =
    buildVariantLabel(
        $variantValue,
        $variantUnit,
        $variantLabelInput
    );


if ($productName === "") {
    respond(
        false,
        "Product name is required.",
        [],
        422
    );
}


if (!$categoryId) {
    respond(
        false,
        "A valid category is required.",
        [],
        422
    );
}


if (!$vendorId) {
    respond(
        false,
        "A valid supplier is required.",
        [],
        422
    );
}


if ($sellingPrice <= 0) {
    respond(
        false,
        "Selling price must be greater than zero.",
        [],
        422
    );
}


$allowedVariantUnits = [
    "",
    "ml",
    "l",
    "g",
    "kg",
    "pcs",
    "pack",
    "set"
];


if (
    !in_array(
        $variantUnit,
        $allowedVariantUnits,
        true
    )
) {
    respond(
        false,
        "The selected variant unit is not supported.",
        [
            "allowed_variant_units" =>
                $allowedVariantUnits
        ],
        422
    );
}


if (
    $variantValue !== null &&
    $variantUnit === ""
) {
    respond(
        false,
        "Select a unit for the product variant.",
        [],
        422
    );
}


try {

    $categoryStmt =
        $conn->prepare("
            SELECT
                category_id,
                category_name
            FROM tbl_category
            WHERE category_id =
                  :category_id
            LIMIT 1
        ");

    $categoryStmt->execute([
        ":category_id" =>
            $categoryId
    ]);

    $categoryRecord =
        $categoryStmt->fetch(
            PDO::FETCH_ASSOC
        );

    if (!$categoryRecord) {
        respond(
            false,
            "The selected category does not exist.",
            [],
            422
        );
    }


    $categoryName =
        (string)$categoryRecord[
            "category_name"
        ];


    $vendorStmt =
        $conn->prepare("
            SELECT
                vendor_id,
                vendor_name
            FROM tbl_vendor
            WHERE vendor_id =
                  :vendor_id
            AND COALESCE(
                status,
                'Active'
            ) <> 'Archived'
            LIMIT 1
        ");

    $vendorStmt->execute([
        ":vendor_id" =>
            $vendorId
    ]);

    $vendorRecord =
        $vendorStmt->fetch(
            PDO::FETCH_ASSOC
        );

    if (!$vendorRecord) {
        respond(
            false,
            "The selected supplier is unavailable.",
            [],
            422
        );
    }


    $allowedUnits =
        getAllowedUnits(
            $categoryName
        );

    if (
        !in_array(
            $unitType,
            $allowedUnits,
            true
        )
    ) {
        respond(
            false,
            "The selected stock unit is not valid for this product category.",
            [
                "allowed_units" =>
                    $allowedUnits
            ],
            422
        );
    }

    $unit =
        $unitType;


    if (
        !categoryAllowsExpiry(
            $categoryName
        )
    ) {
        $expiryDate = "";
    }


    if (
        categoryRequiresExpiry(
            $categoryName
        ) &&
        $expiryDate === ""
    ) {
        respond(
            false,
            "Expiry date is required for this product category.",
            [],
            422
        );
    }


    if (
        $expiryDate !== "" &&
        $expiryDate <
            date("Y-m-d")
    ) {
        respond(
            false,
            "Expiry date cannot be in the past.",
            [],
            422
        );
    }


    if ($familyId !== null) {
        $familyStmt =
            $conn->prepare("
                SELECT
                    product_id,
                    family_id,
                    product_name,
                    category_id,
                    vendor_id
                FROM tbl_inv
                WHERE
                    (
                        product_id =
                            :family_id
                        OR family_id =
                            :family_id
                    )
                AND COALESCE(
                    status,
                    'In Stock'
                ) <> 'Archived'
                ORDER BY product_id ASC
                LIMIT 1
            ");

        $familyStmt->execute([
            ":family_id" =>
                $familyId
        ]);

        $familyRecord =
            $familyStmt->fetch(
                PDO::FETCH_ASSOC
            );

        if (!$familyRecord) {
            respond(
                false,
                "The selected product family does not exist.",
                [],
                422
            );
        }

        if (
            (int)$familyRecord[
                "vendor_id"
            ] !==
            (int)$vendorId
        ) {
            respond(
                false,
                "The selected product family belongs to another supplier.",
                [],
                409
            );
        }

        if (
            (int)$familyRecord[
                "category_id"
            ] !==
            (int)$categoryId
        ) {
            respond(
                false,
                "The selected product family belongs to another category.",
                [],
                409
            );
        }

        if (
            strtolower(
                trim(
                    (string)$familyRecord[
                        "product_name"
                    ]
                )
            ) !==
            strtolower(
                trim($productName)
            )
        ) {
            respond(
                false,
                "The selected product family does not match this product name.",
                [],
                409
            );
        }

        $familyId =
            (int)(
                $familyRecord[
                    "family_id"
                ] ?:
                $familyRecord[
                    "product_id"
                ]
            );
    }


    if ($familyId === null) {
        $findFamilyStmt =
            $conn->prepare("
                SELECT
                    product_id,
                    family_id
                FROM tbl_inv
                WHERE
                    LOWER(
                        TRIM(product_name)
                    ) =
                    LOWER(
                        TRIM(:product_name)
                    )
                AND vendor_id =
                    :vendor_id
                AND category_id =
                    :category_id
                AND COALESCE(
                    status,
                    'In Stock'
                ) <> 'Archived'
                ORDER BY product_id ASC
                LIMIT 1
            ");

        $findFamilyStmt->execute([
            ":product_name" =>
                $productName,
            ":vendor_id" =>
                $vendorId,
            ":category_id" =>
                $categoryId
        ]);

        $existingFamily =
            $findFamilyStmt->fetch(
                PDO::FETCH_ASSOC
            );

        if ($existingFamily) {
            $familyId =
                (int)(
                    $existingFamily[
                        "family_id"
                    ] ?:
                    $existingFamily[
                        "product_id"
                    ]
                );
        }
    }


    $duplicateSql = "
        SELECT
            product_id,
            product_name,
            sku,
            family_id,
            variant_label,
            variant_value,
            variant_unit,
            vendor_id,
            category_id
        FROM tbl_inv
        WHERE
            LOWER(
                TRIM(product_name)
            ) =
            LOWER(
                TRIM(:product_name)
            )
        AND vendor_id =
            :vendor_id
        AND category_id =
            :category_id
        AND LOWER(
            TRIM(
                COALESCE(
                    NULLIF(
                        variant_label,
                        ''
                    ),
                    'Standard'
                )
            )
        ) =
        LOWER(
            TRIM(:variant_label)
        )
        AND COALESCE(
            status,
            'In Stock'
        ) <> 'Archived'
    ";

    $duplicateParams = [
        ":product_name" =>
            $productName,
        ":vendor_id" =>
            $vendorId,
        ":category_id" =>
            $categoryId,
        ":variant_label" =>
            $variantLabel
    ];

    if ($familyId !== null) {
        $duplicateSql .= "
            AND (
                family_id =
                    :family_id
                OR product_id =
                    :family_id
            )
        ";

        $duplicateParams[
            ":family_id"
        ] = $familyId;
    }

    $duplicateSql .= "
        LIMIT 1
    ";

    $duplicateStmt =
        $conn->prepare(
            $duplicateSql
        );

    $duplicateStmt->execute(
        $duplicateParams
    );

    $existingVariant =
        $duplicateStmt->fetch(
            PDO::FETCH_ASSOC
        );


    if ($existingVariant) {
        respond(
            false,
            "This product size / variant already exists for the selected supplier.",
            [
                "duplicate_product" =>
                    true,
                "duplicate_variant" =>
                    true,
                "existing_product" => [
                    "product_id" =>
                        (int)$existingVariant[
                            "product_id"
                        ],
                    "family_id" =>
                        (int)(
                            $existingVariant[
                                "family_id"
                            ] ?:
                            $existingVariant[
                                "product_id"
                            ]
                        ),
                    "product_name" =>
                        (string)$existingVariant[
                            "product_name"
                        ],
                    "sku" =>
                        (string)(
                            $existingVariant[
                                "sku"
                            ] ?? ""
                        ),
                    "variant_label" =>
                        (string)(
                            $existingVariant[
                                "variant_label"
                            ] ??
                            "Standard"
                        ),
                    "variant_value" =>
                        $existingVariant[
                            "variant_value"
                        ],
                    "variant_unit" =>
                        $existingVariant[
                            "variant_unit"
                        ]
                ]
            ],
            409
        );
    }


    if ($sku === "") {
        $sku =
            createSku(
                $conn,
                $productName,
                $categoryName
            );
    }


    $skuCheckStmt =
        $conn->prepare("
            SELECT product_id
            FROM tbl_inv
            WHERE
                UPPER(
                    TRIM(sku)
                ) =
                UPPER(
                    TRIM(:sku)
                )
            LIMIT 1
        ");

    $skuCheckStmt->execute([
        ":sku" =>
            $sku
    ]);


    if (
        $skuCheckStmt->fetch()
    ) {
        respond(
            false,
            "SKU already exists. Leave the SKU empty to generate a unique one automatically.",
            [],
            409
        );
    }


    $productImage = "";

    if (
        isset(
            $_FILES[
                "product_image"
            ]
        )
    ) {
        $productImage =
            saveImage(
                $_FILES[
                    "product_image"
                ],
                dirname(
                    __DIR__
                ) .
                "/uploads/products/"
            );
    }


    if ($variantSort <= 0) {
        if ($familyId !== null) {
            $sortStmt =
                $conn->prepare("
                    SELECT
                        COALESCE(
                            MAX(
                                variant_sort
                            ),
                            0
                        ) + 1
                    FROM tbl_inv
                    WHERE
                        (
                            family_id =
                                :family_id
                            OR product_id =
                                :family_id
                        )
                    AND COALESCE(
                        status,
                        'In Stock'
                    ) <> 'Archived'
                ");

            $sortStmt->execute([
                ":family_id" =>
                    $familyId
            ]);

            $variantSort =
                max(
                    1,
                    (int)$sortStmt
                        ->fetchColumn()
                );
        } else {
            $variantSort = 1;
        }
    }


    $conn->beginTransaction();


    $stmt =
        $conn->prepare("
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
                :selling_price,

                'Unpublished',

                :expiry_date,

                :product_image,

                :vendor_id,

                'Out of Stock',

                NOW(),
                NOW()
            )
        ");


    $stmt->execute([
        ":family_id" =>
            $familyId,

        ":request_variant_id" =>
            $requestVariantId,

        ":product_name" =>
            $productName,

        ":variant_label" =>
            $variantLabel,

        ":variant_value" =>
            $variantValue,

        ":variant_unit" =>
            $variantUnit !== ""
                ? $variantUnit
                : null,

        ":variant_sort" =>
            $variantSort,

        ":sku" =>
            $sku,

        ":category_id" =>
            $categoryId,

        ":category" =>
            $categoryName,

        ":unit_type" =>
            $unitType,

        ":reorder_level" =>
            $reorderLevel,

        ":unit" =>
            $unit,

        ":supplier_price" =>
            $supplierPrice,

        ":selling_price" =>
            $sellingPrice,

        ":expiry_date" =>
            $expiryDate !== ""
                ? $expiryDate
                : null,

        ":product_image" =>
            $productImage,

        ":vendor_id" =>
            $vendorId
    ]);


    $productId =
        (int)$conn
            ->lastInsertId();


    if ($familyId === null) {
        $familyId =
            $productId;

        $familyUpdate =
            $conn->prepare("
                UPDATE tbl_inv
                SET family_id =
                    :family_id
                WHERE product_id =
                    :product_id
            ");

        $familyUpdate->execute([
            ":family_id" =>
                $familyId,
            ":product_id" =>
                $productId
        ]);
    }


    $conn->commit();


    respond(
        true,
        "Product variant registered successfully with zero stock. Receive stock through Delivery Management.",
        [
            "product_id" =>
                $productId,

            "formatted_product_id" =>
                "INV-" .
                str_pad(
                    (string)$productId,
                    4,
                    "0",
                    STR_PAD_LEFT
                ),

            "family_id" =>
                $familyId,

            "request_variant_id" =>
                $requestVariantId,

            "product_name" =>
                $productName,

            "variant" => [
                "label" =>
                    $variantLabel,
                "value" =>
                    $variantValue,
                "unit" =>
                    $variantUnit !== ""
                        ? $variantUnit
                        : null,
                "sort" =>
                    $variantSort
            ],

            "sku" =>
                $sku,

            "stock_unit" =>
                $unitType,

            "quantity" =>
                0,

            "publication_status" =>
                "Unpublished",

            "expiry_date" =>
                $expiryDate !== ""
                    ? $expiryDate
                    : null,

            "status" =>
                "Out of Stock"
        ],
        201
    );

} catch (Throwable $error) {

    if (
        $conn->inTransaction()
    ) {
        $conn->rollBack();
    }

    error_log(
        "HiveSync add_product.php: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to register the product.",
        [
            "error" =>
                $error->getMessage()
        ],
        500
    );
}