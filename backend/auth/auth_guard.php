<?php

require_once(__DIR__ . "/session.php");
require_once(__DIR__ . "/../config/database.php");

function authRespond(bool $success, string $message, int $statusCode): void
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message
    ]);
    exit;
}

function authDestroySession(): void
{
    $_SESSION = [];

    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();

        setcookie(
            session_name(),
            "",
            time() - 42000,
            $params["path"],
            $params["domain"],
            (bool)$params["secure"],
            (bool)$params["httponly"]
        );
    }

    session_destroy();
}

function requireAuthentication(bool $allowPasswordChangeRequired = false): void
{
    global $conn;

    if (empty($_SESSION["authenticated"]) || empty($_SESSION["user_id"])) {
        authRespond(false, "Authentication required.", 401);
    }

    $sessionTimeout = 7200;
    $lastActivity = (int)($_SESSION["last_activity"] ?? 0);
    $currentTime = time();

    if (
        $lastActivity > 0 &&
        ($currentTime - $lastActivity) >= $sessionTimeout
    ) {
        authDestroySession();
        authRespond(
            false,
            "Your session has expired due to inactivity. Please sign in again.",
            401
        );
    }

    $userId = (int)$_SESSION["user_id"];

    try {
        $stmt = $conn->prepare("
            SELECT user_id, role, status, must_change_password
            FROM tbl_user
            WHERE user_id = :user_id
            LIMIT 1
        ");

        $stmt->execute([
            ":user_id" => $userId
        ]);

        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (
            !$user ||
            strcasecmp(
                trim((string)($user["status"] ?? "")),
                "Active"
            ) !== 0
        ) {
            authDestroySession();
            authRespond(
                false,
                "Your account is no longer active. Please sign in again.",
                401
            );
        }

        $databaseRole = trim((string)($user["role"] ?? ""));
        $sessionRole = trim((string)($_SESSION["role"] ?? ""));

        if ($databaseRole === "" || $databaseRole !== $sessionRole) {
            authDestroySession();
            authRespond(
                false,
                "Your account access has changed. Please sign in again.",
                401
            );
        }

        $mustChangePassword = (int)($user["must_change_password"] ?? 0);
        $_SESSION["must_change_password"] = $mustChangePassword;

        if ($mustChangePassword === 1 && !$allowPasswordChangeRequired) {
            authRespond(
                false,
                "You must change your password before accessing this resource.",
                403
            );
        }

        $_SESSION["last_activity"] = $currentTime;
    } catch (Throwable $error) {
        error_log(
            "HiveSync authentication status check error: " .
            $error->getMessage()
        );

        authRespond(
            false,
            "Unable to verify your account access.",
            500
        );
    }
}

function requireCsrfToken(): void
{
    $sessionToken = $_SESSION["csrf_token"] ?? "";
    $requestToken = trim((string)($_SERVER["HTTP_X_CSRF_TOKEN"] ?? ""));

    if (
        !is_string($sessionToken) ||
        $sessionToken === "" ||
        $requestToken === "" ||
        !hash_equals($sessionToken, $requestToken)
    ) {
        authRespond(
            false,
            "Invalid or missing CSRF token.",
            403
        );
    }
}

function requireModulePermission(string $module): void
{
    requireAuthentication();

    $permissions = $_SESSION["module_permissions"] ?? [];

    if (!is_array($permissions)) {
        $permissions = [];
    }

    if (!in_array($module, $permissions, true)) {
        authRespond(false, "You do not have permission to access this resource.", 403);
    }
}

function requireAnyRole(array $roles): void
{
    requireAuthentication();

    $role = (string)($_SESSION["role"] ?? "");

    if (!in_array($role, $roles, true)) {
        authRespond(false, "You do not have permission to perform this action.", 403);
    }
}

function enforceSupplierVendorAccess(int $vendorId): void
{
    requireAuthentication();

    $role = (string)($_SESSION["role"] ?? "");

    if (!in_array($role, ["Supplier", "Vendor"], true)) {
        return;
    }

    $sessionVendorId = (int)($_SESSION["vendor_id"] ?? 0);

    if ($sessionVendorId <= 0 || $sessionVendorId !== $vendorId) {
        authRespond(false, "You do not have permission to access this supplier record.", 403);
    }
}
