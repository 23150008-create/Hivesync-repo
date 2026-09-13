<?php

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../auth/auth_guard.php");

requireModulePermission("users");

function allModulePermissions(): array {
    return [
        "landing",
        "dashboard",
        "users",
        "vendors",
        "deliveries",
        "inventory",
        "pos",
        "receivables",
        "reports",
        "settings"
    ];
}

function defaultPermissionsForRole(string $role): array {
    $defaults = [
        "Admin" => allModulePermissions(),
        "Staff" => [
            "landing",
            "dashboard",
            "vendors",
            "deliveries",
            "inventory",
            "pos",
            "receivables",
            "reports"
        ],
        "Supplier" => [
            "vendors",
            "deliveries",
            "inventory"
        ],
        "Audit" => [
            "dashboard",
            "vendors",
            "deliveries",
            "inventory",
            "receivables",
            "reports",
            "settings"
        ]
    ];

    return $defaults[$role] ?? [];
}

function decodePermissions(
    mixed $value,
    string $role,
    string $accessMode
): array {
    if ($role === "Admin") {
        return allModulePermissions();
    }

    if ($accessMode !== "Custom") {
        return defaultPermissionsForRole($role);
    }

    $decoded = is_string($value)
        ? json_decode($value, true)
        : $value;

    if (!is_array($decoded)) {
        return [];
    }

    $allowed = allModulePermissions();
    $result = [];

    foreach ($decoded as $permission) {
        $permission = trim((string)$permission);

        if (
            in_array($permission, $allowed, true) &&
            !in_array($permission, $result, true)
        ) {
            $result[] = $permission;
        }
    }

    return $result;
}

function respond(
    bool $success,
    string $message,
    array $extra = [],
    int $statusCode = 200
): void {
    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            ["success" => $success, "message" => $message],
            $extra
        )
    );

    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(false, "Invalid request method.", [], 405);
}

requireCsrfToken();

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
    respond(false, "No user data was received.", [], 400);
}

$userId = filter_var(
    $data["user_id"] ?? null,
    FILTER_VALIDATE_INT
);
$firstName = trim((string)($data["first_name"] ?? ""));
$middleName = trim((string)($data["middle_name"] ?? ""));
$lastName = trim((string)($data["last_name"] ?? ""));
$position = trim((string)($data["position"] ?? ""));
$email = strtolower(trim((string)($data["email"] ?? "")));
$role = trim((string)($data["role"] ?? ""));
$accessMode = trim(
    (string)($data["access_mode"] ?? "Default")
);
$vendorId = filter_var(
    $data["vendor_id"] ?? null,
    FILTER_VALIDATE_INT
);

if ($role === "Vendor") {
    $role = "Supplier";
}

$allowedRoles = ["Admin", "Staff", "Supplier", "Audit"];

if (!$userId) {
    respond(false, "A valid user ID is required.", [], 422);
}

if (
    $firstName === "" ||
    $lastName === "" ||
    $position === "" ||
    $email === ""
) {
    respond(false, "Complete all required fields.", [], 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, "Enter a valid email address.", [], 422);
}

if (!in_array($role, $allowedRoles, true)) {
    respond(false, "Invalid role selected.", [], 422);
}

if ($role === "Admin") {
    $accessMode = "Default";
}

if (!in_array($accessMode, ["Default", "Custom"], true)) {
    $accessMode = "Default";
}

$modulePermissions =
    $accessMode === "Custom"
        ? decodePermissions(
            $data["module_permissions"] ?? [],
            $role,
            "Custom"
        )
        : defaultPermissionsForRole($role);

if (
    $role !== "Admin" &&
    $accessMode === "Custom" &&
    count($modulePermissions) === 0
) {
    respond(
        false,
        "Select at least one module for this user.",
        [],
        422
    );
}

if ($role === "Supplier" && !$vendorId) {
    respond(
        false,
        "Select the supplier record connected to this account.",
        [],
        422
    );
}

$fullName = trim(
    preg_replace(
        "/\s+/",
        " ",
        implode(
            " ",
            array_filter([
                $firstName,
                $middleName,
                $lastName
            ])
        )
    )
);

try {
    $conn->beginTransaction();

    $userCheck = $conn->prepare("
        SELECT
            user_id,
            role,
            status
        FROM tbl_user
        WHERE user_id = :user_id
        LIMIT 1
        FOR UPDATE
    ");
    $userCheck->execute([
        ":user_id" => $userId
    ]);

    $existingUser = $userCheck->fetch(PDO::FETCH_ASSOC);

    if (!$existingUser) {
        $conn->rollBack();
        respond(false, "User record was not found.", [], 404);
    }

    $existingRole = (string)($existingUser["role"] ?? "");
    $existingStatus = (string)($existingUser["status"] ?? "");
    $sessionUserId = (int)($_SESSION["user_id"] ?? 0);
    $sessionRole = (string)($_SESSION["role"] ?? "");

    if ($role === "Admin" && $sessionRole !== "Admin") {
        $conn->rollBack();
        respond(
            false,
            "Only the current Admin can assign the Admin role.",
            [],
            403
        );
    }

    if (
        $userId === $sessionUserId &&
        $existingRole === "Admin" &&
        $role !== "Admin"
    ) {
        $conn->rollBack();
        respond(
            false,
            "The active Admin cannot change their own role. Transfer Admin access to another active user instead.",
            [],
            409
        );
    }

    $emailCheck = $conn->prepare("
        SELECT user_id
        FROM tbl_user
        WHERE LOWER(email) = LOWER(:email)
        AND user_id <> :user_id
        LIMIT 1
        FOR UPDATE
    ");
    $emailCheck->execute([
        ":email" => $email,
        ":user_id" => $userId
    ]);

    if ($emailCheck->fetchColumn()) {
        $conn->rollBack();
        respond(false, "Email already exists.", [], 409);
    }

    $activeAdminId = null;

    if ($role === "Admin" && $existingStatus === "Active") {
        $adminCheck = $conn->prepare("
            SELECT user_id
            FROM tbl_user
            WHERE role = 'Admin'
            AND status = 'Active'
            AND user_id <> :user_id
            ORDER BY user_id ASC
            LIMIT 1
            FOR UPDATE
        ");
        $adminCheck->execute([
            ":user_id" => $userId
        ]);

        $activeAdminId = $adminCheck->fetchColumn();

        if ($activeAdminId !== false) {
            $activeAdminId = (int)$activeAdminId;
        } else {
            $activeAdminId = null;
        }
    }

    if (
        $role === "Admin" &&
        $existingStatus !== "Active" &&
        $existingRole !== "Admin"
    ) {
        $conn->rollBack();
        respond(
            false,
            "An inactive account cannot be promoted to Admin.",
            [],
            409
        );
    }

    if ($role === "Supplier") {
        $supplierCheck = $conn->prepare("
            SELECT vendor_id
            FROM tbl_vendor
            WHERE vendor_id = :vendor_id
            AND COALESCE(status, 'Active') <> 'Archived'
            LIMIT 1
            FOR UPDATE
        ");
        $supplierCheck->execute([
            ":vendor_id" => $vendorId
        ]);

        if (!$supplierCheck->fetchColumn()) {
            $conn->rollBack();
            respond(
                false,
                "The selected supplier record was not found or is archived.",
                [],
                422
            );
        }

        $linkedCheck = $conn->prepare("
            SELECT user_id
            FROM tbl_user
            WHERE vendor_id = :vendor_id
            AND user_id <> :user_id
            AND status <> 'Archived'
            LIMIT 1
            FOR UPDATE
        ");
        $linkedCheck->execute([
            ":vendor_id" => $vendorId,
            ":user_id" => $userId
        ]);

        if ($linkedCheck->fetchColumn()) {
            $conn->rollBack();
            respond(
                false,
                "This supplier already has another login account.",
                [],
                409
            );
        }
    }

    $stmt = $conn->prepare("
        UPDATE tbl_user
        SET
            first_name = :first_name,
            middle_name = :middle_name,
            last_name = :last_name,
            position = :position,
            full_name = :full_name,
            email = :email,
            role = :role,
            vendor_id = :vendor_id,
            access_mode = :access_mode,
            module_permissions = :module_permissions
        WHERE user_id = :user_id
    ");

    $stmt->execute([
        ":first_name" => $firstName,
        ":middle_name" =>
            $middleName !== "" ? $middleName : null,
        ":last_name" => $lastName,
        ":position" => $position,
        ":full_name" => $fullName,
        ":email" => $email,
        ":role" => $role,
        ":vendor_id" =>
            $role === "Supplier" ? $vendorId : null,
        ":access_mode" => $accessMode,
        ":module_permissions" => json_encode(
            $modulePermissions,
            JSON_UNESCAPED_UNICODE |
            JSON_UNESCAPED_SLASHES
        ),
        ":user_id" => $userId
    ]);

    if (
        $role === "Admin" &&
        $existingStatus === "Active" &&
        $activeAdminId !== null &&
        $activeAdminId > 0
    ) {
        $deactivateAdmin = $conn->prepare("
            UPDATE tbl_user
            SET status = 'Inactive'
            WHERE user_id = :user_id
            AND role = 'Admin'
            AND status = 'Active'
        ");

        $deactivateAdmin->execute([
            ":user_id" => $activeAdminId
        ]);

        if ($deactivateAdmin->rowCount() !== 1) {
            throw new RuntimeException(
                "Unable to complete the Admin account transfer."
            );
        }
    }

    $conn->commit();

    respond(
        true,
        "User updated successfully.",
        [
            "user_id" => $userId,
            "vendor_id" =>
                $role === "Supplier" ? $vendorId : null,
            "access_mode" => $accessMode,
            "module_permissions" => $modulePermissions
        ]
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "HiveSync update user error: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to update the user account.",
        [],
        500
    );
}
