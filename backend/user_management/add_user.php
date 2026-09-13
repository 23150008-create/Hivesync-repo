<?php

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("../config/mailer.php");
require_once("../auth/auth_guard.php");

requireModulePermission("users");

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

function tableColumnExists(
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

function normalizeModulePermissions(
    mixed $permissions,
    string $role
): array {
    if ($role === "Admin") {
        return allModulePermissions();
    }

    if (is_string($permissions)) {
        $decoded = json_decode($permissions, true);

        if (is_array($decoded)) {
            $permissions = $decoded;
        } else {
            $permissions = array_filter(
                array_map("trim", explode(",", $permissions))
            );
        }
    }

    if (!is_array($permissions)) {
        return defaultPermissionsForRole($role);
    }

    $allowed = allModulePermissions();
    $normalized = [];

    foreach ($permissions as $permission) {
        $permission = trim((string)$permission);

        if (
            in_array($permission, $allowed, true) &&
            !in_array($permission, $normalized, true)
        ) {
            $normalized[] = $permission;
        }
    }

    return $normalized;
}


if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(false, "Invalid request method.", [], 405);
}

requireCsrfToken();

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    respond(false, "No user information was received.", [], 400);
}

$firstName = trim((string)($data["first_name"] ?? ""));
$middleName = trim((string)($data["middle_name"] ?? ""));
$lastName = trim((string)($data["last_name"] ?? ""));
$position = trim((string)($data["position"] ?? ""));
$email = strtolower(trim((string)($data["email"] ?? "")));
$role = trim((string)($data["role"] ?? "Staff"));
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

if (!in_array($role, $allowedRoles, true)) {
    respond(false, "Invalid role selected.", [], 422);
}

if ($role === "Admin") {
    $accessMode = "Default";
}

if (!in_array(
    $accessMode,
    ["Default", "Custom"],
    true
)) {
    $accessMode = "Default";
}

$modulePermissions =
    $accessMode === "Custom"
        ? normalizeModulePermissions(
            $data["module_permissions"] ?? [],
            $role
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

if ($firstName === "") {
    respond(false, "First name is required.", [], 422);
}

if ($lastName === "") {
    respond(false, "Last name is required.", [], 422);
}

if ($position === "") {
    respond(false, "Position is required.", [], 422);
}

if (
    $email === "" ||
    !filter_var($email, FILTER_VALIDATE_EMAIL)
) {
    respond(false, "Enter a valid email address.", [], 422);
}

if ($role === "Supplier" && !$vendorId) {
    respond(
        false,
        "Select the supplier record connected to this account.",
        [],
        422
    );
}

$defaultPassword = "HiveSync@123";
$status = "Active";
$hasVendorColumn = tableColumnExists($conn, "tbl_user", "vendor_id");
$hasPermissionColumn = tableColumnExists(
    $conn,
    "tbl_user",
    "module_permissions"
);
$hasAccessModeColumn = tableColumnExists(
    $conn,
    "tbl_user",
    "access_mode"
);

if (!$hasPermissionColumn || !$hasAccessModeColumn) {
    respond(
        false,
        "The tbl_user table must contain module_permissions and access_mode. Run the provided access-control SQL first.",
        [],
        500
    );
}

if ($role === "Supplier" && !$hasVendorColumn) {
    respond(
        false,
        "The tbl_user table does not yet contain vendor_id.",
        [],
        500
    );
}

try {
    $conn->beginTransaction();

    $emailCheck = $conn->prepare("
        SELECT user_id
        FROM tbl_user
        WHERE LOWER(email) = LOWER(:email)
        LIMIT 1
        FOR UPDATE
    ");

    $emailCheck->execute([":email" => $email]);

    if ($emailCheck->fetchColumn()) {
        $conn->rollBack();
        respond(false, "Email already exists.", [], 409);
    }

    $existingAdminId = null;

    if ($role === "Admin") {
        requireAnyRole(["Admin"]);

        $adminCheck = $conn->query("
            SELECT user_id
            FROM tbl_user
            WHERE role = 'Admin'
            AND status = 'Active'
            ORDER BY user_id ASC
            LIMIT 1
            FOR UPDATE
        ");

        $existingAdminId = $adminCheck->fetchColumn();

        if ($existingAdminId !== false) {
            $existingAdminId = (int)$existingAdminId;
        } else {
            $existingAdminId = null;
        }
    }

    if ($role === "Supplier") {
        $supplierCheck = $conn->prepare("
            SELECT vendor_id, vendor_name
            FROM tbl_vendor
            WHERE vendor_id = :vendor_id
            AND COALESCE(status, 'Active') <> 'Archived'
            LIMIT 1
            FOR UPDATE
        ");

        $supplierCheck->execute([":vendor_id" => $vendorId]);
        $supplier = $supplierCheck->fetch(PDO::FETCH_ASSOC);

        if (!$supplier) {
            $conn->rollBack();
            respond(
                false,
                "The selected supplier record was not found or is archived.",
                [],
                422
            );
        }

        $linkedSupplierCheck = $conn->prepare("
            SELECT user_id
            FROM tbl_user
            WHERE vendor_id = :vendor_id
            AND status IN ('Active', 'Inactive')
            LIMIT 1
            FOR UPDATE
        ");

        $linkedSupplierCheck->execute([":vendor_id" => $vendorId]);

        if ($linkedSupplierCheck->fetchColumn()) {
            $conn->rollBack();
            respond(
                false,
                "This supplier already has a login account.",
                [],
                409
            );
        }
    }

    $hashedPassword = password_hash(
        $defaultPassword,
        PASSWORD_DEFAULT
    );

    $sql = "
        INSERT INTO tbl_user
        (
            first_name,
            middle_name,
            last_name,
            position,
            full_name,
            email,
            password,
            role,
            status,
            must_change_password,
            module_permissions,
            access_mode
    ";

    if ($hasVendorColumn) {
        $sql .= ", vendor_id";
    }

    $sql .= "
        )
        VALUES
        (
            :first_name,
            :middle_name,
            :last_name,
            :position,
            :full_name,
            :email,
            :password,
            :role,
            :status,
            1,
            :module_permissions,
            :access_mode
    ";

    if ($hasVendorColumn) {
        $sql .= ", :vendor_id";
    }

    $sql .= ")";

    $stmt = $conn->prepare($sql);

    $params = [
        ":first_name" => $firstName,
        ":middle_name" => $middleName !== "" ? $middleName : null,
        ":last_name" => $lastName,
        ":position" => $position,
        ":full_name" => $fullName,
        ":email" => $email,
        ":password" => $hashedPassword,
        ":role" => $role,
        ":status" => $status,
        ":module_permissions" => json_encode(
            $modulePermissions,
            JSON_UNESCAPED_UNICODE |
            JSON_UNESCAPED_SLASHES
        ),
        ":access_mode" => $accessMode
    ];

    if ($hasVendorColumn) {
        $params[":vendor_id"] =
            $role === "Supplier" ? $vendorId : null;
    }

    $stmt->execute($params);
    $userId = (int)$conn->lastInsertId();

    $conn->commit();

    $emailSent = false;
    $emailMessage = "Credentials were not sent.";

    try {
        $emailResult = sendAccountCredentials(
            $email,
            $fullName,
            $role,
            $position,
            $defaultPassword
        );

        $emailSent = (bool)($emailResult["success"] ?? false);
        $emailMessage = (string)(
            $emailResult["message"] ??
            "No email status was returned."
        );
    } catch (Throwable $mailError) {
        $emailSent = false;
        $emailMessage = "Credentials email was not sent.";

        error_log(
            "HiveSync account email error for user {$userId}: " .
            $mailError->getMessage()
        );
    }

    respond(
        true,
        $emailSent
            ? "User added successfully. Credentials were sent by email."
            : "User added successfully. The account is ready, but the credentials email was not sent.",
        [
            "user_id" => $userId,
            "full_name" => $fullName,
            "position" => $position,
            "email" => $email,
            "role" => $role,
            "vendor_id" =>
                $role === "Supplier" ? $vendorId : null,
            "access_mode" => $accessMode,
            "module_permissions" => $modulePermissions,
            "default_password" => $defaultPassword,
            "must_change_password" => 1,
            "email_sent" => $emailSent,
            "email_result" => $emailMessage
        ],
        201
    );
} catch (Throwable $error) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    error_log(
        "HiveSync add user error: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to add the user account.",
        [],
        500
    );
}