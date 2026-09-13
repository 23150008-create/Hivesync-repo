<?php

declare(strict_types=1);

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");


if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Only POST requests are allowed."
    ]);
    exit;
}

requireModulePermission("deliveries");
requireAnyRole(["Admin", "Staff"]);
requireCsrfToken();

function publishRespond(
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

function publishColumnExists(
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

function publishAudit(
    PDO $conn,
    ?int $userId,
    string $userName,
    string $details
): void {
    try {
        $stmt = $conn->prepare("
            INSERT INTO tbl_audit_trail
            (
                user_id,
                user_name,
                module,
                action,
                details,
                created_at
            )
            VALUES
            (
                :user_id,
                :user_name,
                'Delivery Management',
                'Products Published',
                :details,
                NOW()
            )
        ");

        $stmt->execute([
            ":user_id" => $userId,
            ":user_name" =>
                trim($userName) !== ""
                    ? trim($userName)
                    : "System User",
            ":details" => $details
        ]);
    } catch (Throwable $error) {
        error_log(
            "publish_delivery_products audit: " .
            $error->getMessage()
        );
    }
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    publishRespond(
        false,
        "POST request required.",
        [],
        405
    );
}

$payload = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($payload)) {
    publishRespond(
        false,
        "Invalid request payload.",
        [],
        400
    );
}

$deliveryId = (int)(
    $payload["delivery_id"] ?? 0
);

$publishedByUserId =
    !empty($payload["published_by_user_id"])
        ? (int)$payload["published_by_user_id"]
        : null;

$publishedByName = trim(
    (string)(
        $payload["published_by_name"] ??
        "System User"
    )
);

$items = $payload["items"] ?? [];

if ($deliveryId <= 0) {
    publishRespond(
        false,
        "A valid delivery is required.",
        [],
        422
    );
}

if (!is_array($items) || !$items) {
    publishRespond(
        false,
        "At least one delivered product is required.",
        [],
        422
    );
}

try {
    $conn->beginTransaction();

    $deliveryStmt = $conn->prepare("
        SELECT
            delivery_id,
            delivery_order_no,
            status
        FROM tbl_delivery
        WHERE delivery_id = :delivery_id
        LIMIT 1
        FOR UPDATE
    ");

    $deliveryStmt->execute([
        ":delivery_id" => $deliveryId
    ]);

    $delivery = $deliveryStmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$delivery) {
        throw new RuntimeException(
            "Delivery record was not found."
        );
    }

    if (
        strcasecmp(
            (string)$delivery["status"],
            "Delivered"
        ) !== 0
    ) {
        throw new RuntimeException(
            "Products can only be published after physical receiving."
        );
    }

    $updated = [];

    foreach ($items as $index => $requestItem) {
        $lineNumber = $index + 1;

        $deliveryItemId = (int)(
            $requestItem[
                "delivery_item_id"
            ] ?? 0
        );

        $productId = (int)(
            $requestItem[
                "product_id"
            ] ?? 0
        );

        $finalPrice = (float)(
            $requestItem[
                "final_selling_price"
            ] ?? 0
        );

        if (
            $deliveryItemId <= 0 ||
            $productId <= 0
        ) {
            throw new RuntimeException(
                "Product line {$lineNumber} is invalid."
            );
        }

        if ($finalPrice <= 0) {
            throw new RuntimeException(
                "Final selling price on product line {$lineNumber} must be greater than zero."
            );
        }

        $itemStmt = $conn->prepare("
            SELECT
                di.delivery_item_id,
                di.product_id,
                i.product_name,
                i.sku,
                i.quantity AS inventory_quantity,
                i.status
            FROM tbl_delivery_items di
            INNER JOIN tbl_inv i
                ON i.product_id = di.product_id
            WHERE di.delivery_item_id =
                :delivery_item_id
            AND di.delivery_id =
                :delivery_id
            AND di.product_id =
                :product_id
            LIMIT 1
            FOR UPDATE
        ");

        $itemStmt->execute([
            ":delivery_item_id" =>
                $deliveryItemId,
            ":delivery_id" =>
                $deliveryId,
            ":product_id" =>
                $productId
        ]);

        $item = $itemStmt->fetch(
            PDO::FETCH_ASSOC
        );

        if (!$item) {
            throw new RuntimeException(
                "Product line {$lineNumber} does not belong to this delivery."
            );
        }

        if (
            strcasecmp(
                trim(
                    (string)(
                        $item["status"] ?? ""
                    )
                ),
                "Archived"
            ) === 0
        ) {
            throw new RuntimeException(
                "{$item['product_name']} is archived and cannot be published."
            );
        }

        if (
            (int)(
                $item[
                    "inventory_quantity"
                ] ?? 0
            ) <= 0
        ) {
            throw new RuntimeException(
                "{$item['product_name']} has no available stock."
            );
        }

        $updateInv = $conn->prepare("
            UPDATE tbl_inv
            SET
                selling_price =
                    :selling_price,
                updated_at = NOW()
            WHERE product_id =
                :product_id
        ");

        $updateInv->execute([
            ":selling_price" =>
                $finalPrice,
            ":product_id" =>
                $productId
        ]);

        $set = [];
        $params = [
            ":delivery_item_id" =>
                $deliveryItemId
        ];

        if (
            publishColumnExists(
                $conn,
                "tbl_delivery_items",
                "retail_price"
            )
        ) {
            $set[] =
                "retail_price = :retail_price";
            $params[
                ":retail_price"
            ] = $finalPrice;
        }

        if (
            publishColumnExists(
                $conn,
                "tbl_delivery_items",
                "selling_price"
            )
        ) {
            $set[] =
                "selling_price = :selling_price";
            $params[
                ":selling_price"
            ] = $finalPrice;
        }

        if ($set) {
            $updateItem = $conn->prepare("
                UPDATE tbl_delivery_items
                SET " .
                implode(", ", $set) .
                "
                WHERE delivery_item_id =
                    :delivery_item_id
            ");

            $updateItem->execute(
                $params
            );
        }

        $updated[] = [
            "product_id" =>
                $productId,
            "product_name" =>
                (string)(
                    $item[
                        "product_name"
                    ] ?? "Product"
                ),
            "selling_price" =>
                round($finalPrice, 2)
        ];
    }

    publishAudit(
        $conn,
        $publishedByUserId,
        $publishedByName,
        "Published " .
        count($updated) .
        " product(s) from delivery " .
        (
            $delivery[
                "delivery_order_no"
            ] ??
            $deliveryId
        ) .
        " after final BFATC pricing."
    );

    $conn->commit();

    publishRespond(
        true,
        count($updated) .
        " product(s) published successfully. Eligible products are now available to the Landing Page and POS.",
        [
            "delivery_id" =>
                $deliveryId,
            "published_count" =>
                count($updated),
            "published_products" =>
                $updated
        ]
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "publish_delivery_products.php: " .
        $error->getMessage()
    );

    publishRespond(
        false,
        $error->getMessage(),
        [],
        422
    );
}