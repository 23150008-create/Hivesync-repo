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

try {
    $stmt = $conn->prepare("
        SELECT
            u.user_id,
            u.first_name,
            u.middle_name,
            u.last_name,
            u.position,
            u.full_name,
            u.email,
            CASE
                WHEN u.role = 'Vendor' THEN 'Supplier'
                ELSE u.role
            END AS role,
            u.status,
            u.vendor_id,
            v.vendor_name,
            COALESCE(u.access_mode, 'Default') AS access_mode,
            u.module_permissions,
            u.must_change_password,
            u.last_login,
            u.created_at
        FROM tbl_user u
        LEFT JOIN tbl_vendor v
            ON v.vendor_id = u.vendor_id
        WHERE u.status <> 'Archived'
        ORDER BY
            u.full_name ASC,
            u.user_id ASC
    ");

    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($users as &$user) {
        $role = (string)$user["role"];
        $accessMode = $role === "Admin"
            ? "Default"
            : (string)($user["access_mode"] ?? "Default");

        $user["access_mode"] = $accessMode;
        $user["module_permissions"] = decodePermissions(
            $user["module_permissions"] ?? null,
            $role,
            $accessMode
        );
    }
    unset($user);

    echo json_encode([
        "success" => true,
        "users" => $users
    ]);
} catch (Throwable $error) {
    error_log(
        "HiveSync get users error: " .
        $error->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Failed to load users.",
        "users" => []
    ]);
}
