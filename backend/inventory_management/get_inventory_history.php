<?php

date_default_timezone_set("Asia/Manila");

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("inventory");

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

function firstColumn(
    PDO $conn,
    string $tableName,
    array $candidates
): ?string {
    foreach ($candidates as $candidate) {
        if (
            columnExists(
                $conn,
                $tableName,
                $candidate
            )
        ) {
            return $candidate;
        }
    }

    return null;
}

$productId = filter_var(
    $_GET["product_id"] ?? null,
    FILTER_VALIDATE_INT
);

if (!$productId) {
    respond(
        false,
        "A valid product ID is required.",
        [],
        422
    );
}

try {
    if (!tableExists($conn, "tbl_inv")) {
        respond(
            false,
            "Inventory table is unavailable.",
            [],
            500
        );
    }

    $ownershipStmt = $conn->prepare("
        SELECT vendor_id
        FROM tbl_inv
        WHERE product_id = :product_id
        LIMIT 1
    ");

    $ownershipStmt->execute([
        ":product_id" => $productId
    ]);

    $ownershipVendorId = $ownershipStmt->fetchColumn();

    if ($ownershipVendorId === false) {
        respond(
            false,
            "Product was not found.",
            [],
            404
        );
    }

    if (in_array(
        trim((string)($_SESSION["role"] ?? "")),
        ["Supplier", "Vendor"],
        true
    )) {
        enforceSupplierVendorAccess(
            (int)$ownershipVendorId
        );
    }

    $productStmt = $conn->prepare("
        SELECT
            product_id,
            product_name,
            sku,
            quantity,
            unit_type,
            unit
        FROM tbl_inv
        WHERE product_id = :product_id
        LIMIT 1
    ");

    $productStmt->execute([
        ":product_id" => $productId
    ]);

    $product =
        $productStmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        respond(
            false,
            "Product was not found.",
            [],
            404
        );
    }

    if (
        !tableExists(
            $conn,
            "tbl_inventory_history"
        )
    ) {
        respond(
            true,
            "No inventory movement table is available.",
            [
                "product" => $product,
                "history" => [],
                "summary" => [
                    "total_movements" => 0,
                    "total_stock_in" => 0,
                    "total_stock_out" => 0
                ]
            ]
        );
    }

    $historyIdColumn = firstColumn(
        $conn,
        "tbl_inventory_history",
        [
            "history_id",
            "movement_id",
            "id"
        ]
    );

    $actionColumn = firstColumn(
        $conn,
        "tbl_inventory_history",
        [
            "action_type",
            "movement_type",
            "action"
        ]
    );

    $quantityColumn = firstColumn(
        $conn,
        "tbl_inventory_history",
        [
            "quantity",
            "movement_quantity"
        ]
    );

    $previousColumn = firstColumn(
        $conn,
        "tbl_inventory_history",
        [
            "previous_quantity",
            "stock_before"
        ]
    );

    $newColumn = firstColumn(
        $conn,
        "tbl_inventory_history",
        [
            "new_quantity",
            "stock_after"
        ]
    );

    $remarksColumn = firstColumn(
        $conn,
        "tbl_inventory_history",
        [
            "remarks",
            "details",
            "description"
        ]
    );

    $createdByColumn = firstColumn(
        $conn,
        "tbl_inventory_history",
        [
            "created_by",
            "user_id"
        ]
    );

    $createdAtColumn = firstColumn(
        $conn,
        "tbl_inventory_history",
        [
            "created_at",
            "movement_date",
            "date_created"
        ]
    );

    $deliveryIdColumn = firstColumn(
        $conn,
        "tbl_inventory_history",
        [
            "delivery_id"
        ]
    );

    $referenceColumn = firstColumn(
        $conn,
        "tbl_inventory_history",
        [
            "reference_no",
            "reference_code",
            "transaction_code"
        ]
    );

    $idExpression = $historyIdColumn
        ? "h.`{$historyIdColumn}`"
        : "NULL";

    $actionExpression = $actionColumn
        ? "h.`{$actionColumn}`"
        : "'Inventory Update'";

    $quantityExpression = $quantityColumn
        ? "COALESCE(h.`{$quantityColumn}`, 0)"
        : "0";

    $previousExpression = $previousColumn
        ? "h.`{$previousColumn}`"
        : "NULL";

    $newExpression = $newColumn
        ? "h.`{$newColumn}`"
        : "NULL";

    $remarksExpression = $remarksColumn
        ? "h.`{$remarksColumn}`"
        : "NULL";

    $createdAtExpression = $createdAtColumn
        ? "h.`{$createdAtColumn}`"
        : "NULL";

    $createdByExpression = $createdByColumn
        ? "h.`{$createdByColumn}`"
        : "NULL";

    $userJoin =
        $createdByColumn &&
        tableExists($conn, "tbl_user")
            ? "
                LEFT JOIN tbl_user u
                    ON u.user_id =
                       h.`{$createdByColumn}`
              "
            : "";

    $userNameExpression =
        $userJoin !== ""
            ? "COALESCE(u.full_name, 'System User')"
            : "'System User'";

    $deliveryJoin =
        $deliveryIdColumn &&
        tableExists($conn, "tbl_delivery")
            ? "
                LEFT JOIN tbl_delivery d
                    ON d.delivery_id =
                       h.`{$deliveryIdColumn}`
              "
            : "";

    if ($referenceColumn) {
        $referenceExpression =
            "h.`{$referenceColumn}`";
    } elseif ($deliveryJoin !== "") {
        $referenceExpression =
            "COALESCE(
                d.delivery_order_no,
                CONCAT(
                    'DEL-',
                    LPAD(
                        h.`{$deliveryIdColumn}`,
                        5,
                        '0'
                    )
                )
            )";
    } else {
        $referenceExpression = "NULL";
    }

    $orderExpression = $createdAtColumn
        ? "h.`{$createdAtColumn}` DESC"
        : (
            $historyIdColumn
                ? "h.`{$historyIdColumn}` DESC"
                : "h.product_id DESC"
        );

    $stmt = $conn->prepare("
        SELECT
            {$idExpression}
                AS history_id,

            h.product_id,

            {$actionExpression}
                AS action_type,

            {$quantityExpression}
                AS quantity,

            {$previousExpression}
                AS previous_quantity,

            {$newExpression}
                AS new_quantity,

            {$remarksExpression}
                AS remarks,

            {$createdByExpression}
                AS created_by,

            {$userNameExpression}
                AS created_by_name,

            {$createdAtExpression}
                AS created_at,

            {$referenceExpression}
                AS reference_no,

            CASE
                WHEN LOWER({$actionExpression}) REGEXP
                    'delivery|restock|return|stock in|receive|received|add'
                    THEN 'in'

                WHEN LOWER({$actionExpression}) REGEXP
                    'sale|stock out|pull|disposal|deduct|remove|archive'
                    THEN 'out'

                WHEN {$previousExpression} IS NOT NULL
                AND {$newExpression} IS NOT NULL
                AND {$newExpression} >
                    {$previousExpression}
                    THEN 'in'

                WHEN {$previousExpression} IS NOT NULL
                AND {$newExpression} IS NOT NULL
                AND {$newExpression} <
                    {$previousExpression}
                    THEN 'out'

                ELSE 'neutral'
            END AS direction

        FROM tbl_inventory_history h

        {$userJoin}
        {$deliveryJoin}

        WHERE h.product_id = :product_id

        ORDER BY {$orderExpression}

        LIMIT 200
    ");

    $stmt->execute([
        ":product_id" => $productId
    ]);

    $history =
        $stmt->fetchAll(PDO::FETCH_ASSOC);

    $summary = [
        "total_movements" => count($history),
        "total_stock_in" => 0,
        "total_stock_out" => 0
    ];

    foreach ($history as &$movement) {
        $movement["history_id"] =
            $movement["history_id"] !== null
                ? (int)$movement["history_id"]
                : null;

        $movement["product_id"] =
            (int)$movement["product_id"];

        $movement["quantity"] =
            (int)$movement["quantity"];

        $movement["previous_quantity"] =
            $movement["previous_quantity"] !== null
                ? (int)$movement["previous_quantity"]
                : null;

        $movement["new_quantity"] =
            $movement["new_quantity"] !== null
                ? (int)$movement["new_quantity"]
                : null;

        if ($movement["direction"] === "in") {
            $summary["total_stock_in"] +=
                $movement["quantity"];
        }

        if ($movement["direction"] === "out") {
            $summary["total_stock_out"] +=
                $movement["quantity"];
        }
    }

    unset($movement);

    respond(
        true,
        "Inventory movement history retrieved successfully.",
        [
            "product" => $product,
            "history" => $history,
            "summary" => $summary
        ]
    );
} catch (Throwable $error) {
    error_log(
        "inventory_management/get_inventory_history.php: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to retrieve inventory movement history.",
        [
            "history" => [],
            "summary" => [
                "total_movements" => 0,
                "total_stock_in" => 0,
                "total_stock_out" => 0
            ],
        ],
        500
    );
}