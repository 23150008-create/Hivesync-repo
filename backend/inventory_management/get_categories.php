<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("inventory");



function getCategoryConfiguration(
    string $categoryName
): array {
    $normalized =
        strtolower(
            trim($categoryName)
        );


    $defaultStockUnits = [
        [
            "value" => "pcs",
            "label" => "Piece / pcs"
        ],
        [
            "value" => "pack",
            "label" => "Pack"
        ],
        [
            "value" => "box",
            "label" => "Box"
        ],
        [
            "value" => "set",
            "label" => "Set"
        ]
    ];


    $defaultVariantUnits = [
        [
            "value" => "pcs",
            "label" => "Piece / pcs"
        ],
        [
            "value" => "pack",
            "label" => "Pack"
        ],
        [
            "value" => "set",
            "label" => "Set"
        ]
    ];


    $configuration = [
        "allows_expiry" => true,
        "requires_expiry" => false,
        "default_expiry_days" => null,

        "units" => $defaultStockUnits,
        "stock_units" => $defaultStockUnits,
        "variant_units" => $defaultVariantUnits
    ];


    switch ($normalized) {

        case "organic produce":
            $stockUnits = [
                [
                    "value" => "pcs",
                    "label" => "Piece / pcs"
                ],
                [
                    "value" => "kg",
                    "label" => "Kilogram / kg"
                ],
                [
                    "value" => "g",
                    "label" => "Gram / g"
                ],
                [
                    "value" => "bag",
                    "label" => "Bag"
                ],
                [
                    "value" => "bundle",
                    "label" => "Bundle"
                ],
                [
                    "value" => "crate",
                    "label" => "Crate"
                ],
                [
                    "value" => "tray",
                    "label" => "Tray"
                ]
            ];

            return [
                "allows_expiry" => true,
                "requires_expiry" => true,
                "default_expiry_days" => 14,

                "units" => $stockUnits,
                "stock_units" => $stockUnits,

                "variant_units" => [
                    [
                        "value" => "g",
                        "label" => "Gram / g"
                    ],
                    [
                        "value" => "kg",
                        "label" => "Kilogram / kg"
                    ],
                    [
                        "value" => "pcs",
                        "label" => "Piece / pcs"
                    ],
                    [
                        "value" => "pack",
                        "label" => "Pack"
                    ]
                ]
            ];


        case "fresh harvest":
            $stockUnits = [
                [
                    "value" => "pcs",
                    "label" => "Piece / pcs"
                ],
                [
                    "value" => "kg",
                    "label" => "Kilogram / kg"
                ],
                [
                    "value" => "g",
                    "label" => "Gram / g"
                ],
                [
                    "value" => "bag",
                    "label" => "Bag"
                ],
                [
                    "value" => "bundle",
                    "label" => "Bundle"
                ],
                [
                    "value" => "crate",
                    "label" => "Crate"
                ],
                [
                    "value" => "tray",
                    "label" => "Tray"
                ]
            ];

            return [
                "allows_expiry" => true,
                "requires_expiry" => true,
                "default_expiry_days" => 7,

                "units" => $stockUnits,
                "stock_units" => $stockUnits,

                "variant_units" => [
                    [
                        "value" => "g",
                        "label" => "Gram / g"
                    ],
                    [
                        "value" => "kg",
                        "label" => "Kilogram / kg"
                    ],
                    [
                        "value" => "pcs",
                        "label" => "Piece / pcs"
                    ],
                    [
                        "value" => "pack",
                        "label" => "Pack"
                    ]
                ]
            ];


        case "beverages":
            $stockUnits = [
                [
                    "value" => "bottle",
                    "label" => "Bottle"
                ],
                [
                    "value" => "can",
                    "label" => "Can"
                ],
                [
                    "value" => "ml",
                    "label" => "Milliliter / ml"
                ],
                [
                    "value" => "liter",
                    "label" => "Liter"
                ],
                [
                    "value" => "pack",
                    "label" => "Pack"
                ],
                [
                    "value" => "case",
                    "label" => "Case"
                ]
            ];

            return [
                "allows_expiry" => true,
                "requires_expiry" => false,
                "default_expiry_days" => 365,

                "units" => $stockUnits,
                "stock_units" => $stockUnits,

                "variant_units" => [
                    [
                        "value" => "ml",
                        "label" => "Milliliter / ml"
                    ],
                    [
                        "value" => "l",
                        "label" => "Liter / L"
                    ],
                    [
                        "value" => "pack",
                        "label" => "Pack"
                    ]
                ]
            ];


        case "honey products":
            $stockUnits = [
                [
                    "value" => "jar",
                    "label" => "Jar"
                ],
                [
                    "value" => "bottle",
                    "label" => "Bottle"
                ],
                [
                    "value" => "ml",
                    "label" => "Milliliter / ml"
                ],
                [
                    "value" => "liter",
                    "label" => "Liter"
                ],
                [
                    "value" => "g",
                    "label" => "Gram / g"
                ],
                [
                    "value" => "kg",
                    "label" => "Kilogram / kg"
                ],
                [
                    "value" => "pack",
                    "label" => "Pack"
                ],
                [
                    "value" => "box",
                    "label" => "Box"
                ]
            ];

            return [
                "allows_expiry" => true,
                "requires_expiry" => false,
                "default_expiry_days" => 730,

                "units" => $stockUnits,
                "stock_units" => $stockUnits,

                "variant_units" => [
                    [
                        "value" => "ml",
                        "label" => "Milliliter / ml"
                    ],
                    [
                        "value" => "l",
                        "label" => "Liter / L"
                    ],
                    [
                        "value" => "g",
                        "label" => "Gram / g"
                    ],
                    [
                        "value" => "kg",
                        "label" => "Kilogram / kg"
                    ]
                ]
            ];


        case "processed goods":
            $stockUnits = [
                [
                    "value" => "pcs",
                    "label" => "Piece / pcs"
                ],
                [
                    "value" => "pack",
                    "label" => "Pack"
                ],
                [
                    "value" => "box",
                    "label" => "Box"
                ],
                [
                    "value" => "bottle",
                    "label" => "Bottle"
                ],
                [
                    "value" => "jar",
                    "label" => "Jar"
                ],
                [
                    "value" => "can",
                    "label" => "Can"
                ],
                [
                    "value" => "bag",
                    "label" => "Bag"
                ],
                [
                    "value" => "g",
                    "label" => "Gram / g"
                ],
                [
                    "value" => "kg",
                    "label" => "Kilogram / kg"
                ],
                [
                    "value" => "ml",
                    "label" => "Milliliter / ml"
                ]
            ];

            return [
                "allows_expiry" => true,
                "requires_expiry" => false,
                "default_expiry_days" => 365,

                "units" => $stockUnits,
                "stock_units" => $stockUnits,

                "variant_units" => [
                    [
                        "value" => "ml",
                        "label" => "Milliliter / ml"
                    ],
                    [
                        "value" => "l",
                        "label" => "Liter / L"
                    ],
                    [
                        "value" => "g",
                        "label" => "Gram / g"
                    ],
                    [
                        "value" => "kg",
                        "label" => "Kilogram / kg"
                    ],
                    [
                        "value" => "pcs",
                        "label" => "Piece / pcs"
                    ],
                    [
                        "value" => "pack",
                        "label" => "Pack"
                    ]
                ]
            ];


        case "local delicacies":
            $stockUnits = [
                [
                    "value" => "pcs",
                    "label" => "Piece / pcs"
                ],
                [
                    "value" => "pack",
                    "label" => "Pack"
                ],
                [
                    "value" => "box",
                    "label" => "Box"
                ],
                [
                    "value" => "tray",
                    "label" => "Tray"
                ],
                [
                    "value" => "bag",
                    "label" => "Bag"
                ],
                [
                    "value" => "g",
                    "label" => "Gram / g"
                ],
                [
                    "value" => "kg",
                    "label" => "Kilogram / kg"
                ]
            ];

            return [
                "allows_expiry" => true,
                "requires_expiry" => true,
                "default_expiry_days" => 30,

                "units" => $stockUnits,
                "stock_units" => $stockUnits,

                "variant_units" => [
                    [
                        "value" => "g",
                        "label" => "Gram / g"
                    ],
                    [
                        "value" => "kg",
                        "label" => "Kilogram / kg"
                    ],
                    [
                        "value" => "pcs",
                        "label" => "Piece / pcs"
                    ],
                    [
                        "value" => "pack",
                        "label" => "Pack"
                    ]
                ]
            ];


        case "handicrafts":
        case "souvenirs":
        case "novelty":
        case "novelty products":
            $stockUnits = [
                [
                    "value" => "pcs",
                    "label" => "Piece / pcs"
                ],
                [
                    "value" => "set",
                    "label" => "Set"
                ],
                [
                    "value" => "box",
                    "label" => "Box"
                ],
                [
                    "value" => "pack",
                    "label" => "Pack"
                ]
            ];

            return [
                "allows_expiry" => false,
                "requires_expiry" => false,
                "default_expiry_days" => null,

                "units" => $stockUnits,
                "stock_units" => $stockUnits,

                "variant_units" => [
                    [
                        "value" => "pcs",
                        "label" => "Piece / pcs"
                    ],
                    [
                        "value" => "set",
                        "label" => "Set"
                    ],
                    [
                        "value" => "pack",
                        "label" => "Pack"
                    ]
                ]
            ];


        default:
            return $configuration;
    }
}


try {
    $stmt = $conn->prepare("
        SELECT
            c.category_id,
            c.category_name,
            c.created_at,

            COUNT(
                CASE
                    WHEN COALESCE(
                        i.status,
                        'In Stock'
                    ) <> 'Archived'
                    THEN i.product_id
                    ELSE NULL
                END
            ) AS product_count

        FROM tbl_category c

        LEFT JOIN tbl_inv i
            ON i.category_id =
               c.category_id

        GROUP BY
            c.category_id,
            c.category_name,
            c.created_at

        ORDER BY
            c.category_name ASC
    ");


    $stmt->execute();


    $categories =
        $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );


    foreach (
        $categories as
        &$category
    ) {
        $configuration =
            getCategoryConfiguration(
                (string)$category[
                    "category_name"
                ]
            );


        $category["category_id"] =
            (int)$category[
                "category_id"
            ];


        $category["product_count"] =
            (int)$category[
                "product_count"
            ];


        $category["allows_expiry"] =
            (bool)$configuration[
                "allows_expiry"
            ];


        $category["requires_expiry"] =
            (bool)$configuration[
                "requires_expiry"
            ];


        $category["default_expiry_days"] =
            $configuration[
                "default_expiry_days"
            ] !== null
                ? (int)$configuration[
                    "default_expiry_days"
                ]
                : null;


        $category["units"] =
            $configuration[
                "units"
            ];


        $category["stock_units"] =
            $configuration[
                "stock_units"
            ];


        $category["variant_units"] =
            $configuration[
                "variant_units"
            ];


        $category["expiry_mode"] =
            !$configuration[
                "allows_expiry"
            ]
                ? "none"
                : (
                    $configuration[
                        "requires_expiry"
                    ]
                        ? "required"
                        : "optional"
                );
    }


    unset($category);


    echo json_encode(
        [
            "success" => true,
            "categories" => $categories,
            "generated_at" =>
                date("Y-m-d H:i:s")
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );

} catch (Throwable $error) {

    http_response_code(500);

    error_log(
        "HiveSync get_categories.php: " .
        $error->getMessage()
    );


    echo json_encode(
        [
            "success" => false,
            "message" =>
                "Failed to load product categories.",
            "error" =>
                $error->getMessage(),
            "categories" => []
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );
}