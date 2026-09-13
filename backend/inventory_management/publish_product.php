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
    int $status = 200
): never {
    http_response_code($status);

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

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(
        false,
        "Method not allowed.",
        [],
        405
    );
}

requireCsrfToken();

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    respond(
        false,
        "Invalid request payload.",
        [],
        422
    );
}

$productId = filter_var(
    $data["product_id"] ?? null,
    FILTER_VALIDATE_INT
);

$sellingPrice = (float)(
    $data["selling_price"] ?? 0
);

$publishedByUserId = filter_var(
    $data["published_by_user_id"] ??
    $data["user_id"] ??
    null,
    FILTER_VALIDATE_INT
);

$publishedByName = trim(
    (string)(
        $data["published_by_name"] ??
        $data["user_name"] ??
        "System Admin"
    )
);

if (!$productId) {
    respond(
        false,
        "A valid product ID is required.",
        [],
        422
    );
}

if ($sellingPrice <= 0) {
    respond(
        false,
        "BFATC selling price must be greater than zero.",
        [],
        422
    );
}

try {
    $conn->beginTransaction();

    $stmt = $conn->prepare("
        SELECT
            product_id,
            product_name,
            sku,
            quantity,
            selling_price,
            publication_status,
            status
        FROM tbl_inv
        WHERE product_id = :product_id
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":product_id" => $productId
    ]);

    $product = $stmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$product) {
        throw new RuntimeException(
            "Product not found."
        );
    }

    if (
        strcasecmp(
            trim(
                (string)(
                    $product["status"] ?? ""
                )
            ),
            "Archived"
        ) === 0
    ) {
        throw new RuntimeException(
            "Archived products cannot be published."
        );
    }

    if (
        (int)(
            $product["quantity"] ?? 0
        ) <= 0
    ) {
        throw new RuntimeException(
            "Receive physical stock before publishing this product."
        );
    }

    $update = $conn->prepare("
        UPDATE tbl_inv
        SET
            selling_price = :selling_price,
            publication_status = 'Published',
            updated_at = NOW()
        WHERE product_id = :product_id
    ");

    $update->execute([
        ":selling_price" =>
            $sellingPrice,
        ":product_id" =>
            $productId
    ]);

    $conn->commit();

    respond(
        true,
        "Product published successfully. The BFATC selling price was saved and the product is now eligible for Landing Page and POS.",
        [
            "product_id" =>
                $productId,
            "product_name" =>
                $product["product_name"],
            "sku" =>
                $product["sku"],
            "selling_price" =>
                round(
                    $sellingPrice,
                    2
                ),
            "published_by_user_id" =>
                $publishedByUserId ?: null,
            "published_by_name" =>
                $publishedByName,
            "publication_status" =>
                "Published"
        ]
    );
} catch (RuntimeException $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    respond(
        false,
        $error->getMessage(),
        [],
        422
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "inventory_management/publish_product.php: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to publish the product.",
        [],
        500
    );
}
