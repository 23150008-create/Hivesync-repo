<?php

require_once("../config/cors.php");
require_once("../config/database.php");
require_once("session.php");

function allModulePermissions(): array
{
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

function defaultPermissionsForRole(string $role): array
{
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

    if (is_string($value)) {
        $decoded = json_decode($value, true);

        if (is_array($decoded)) {
            $value = $decoded;
        } else {
            $value = array_filter(
                array_map(
                    "trim",
                    explode(",", $value)
                )
            );
        }
    }

    if (!is_array($value)) {
        return [];
    }

    $allowed = allModulePermissions();
    $result = [];

    foreach ($value as $permission) {
        $permission = trim(
            (string)$permission
        );

        if (
            in_array(
                $permission,
                $allowed,
                true
            ) &&
            !in_array(
                $permission,
                $result,
                true
            )
        ) {
            $result[] = $permission;
        }
    }

    if (
        $role === "Supplier" ||
        $role === "Vendor"
    ) {
        $supplierAllowed = [
            "vendors",
            "deliveries",
            "inventory"
        ];

        $result = array_values(
            array_filter(
                $result,
                fn($permission) =>
                    in_array(
                        $permission,
                        $supplierAllowed,
                        true
                    )
            )
        );
    }

    if ($role === "Audit") {
        $result = array_values(
            array_filter(
                $result,
                fn($permission) =>
                    $permission !== "settings"
            )
        );
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

function getLoginClientIp(): string
{
    $ip = trim((string)($_SERVER["REMOTE_ADDR"] ?? ""));

    if ($ip === "") {
        return "unknown";
    }

    return substr($ip, 0, 45);
}

function getLoginRateLimit(PDO $conn, string $email, string $ipAddress): array
{
    $stmt = $conn->prepare("
        SELECT
            attempt_id,
            failed_attempts,
            blocked_until
        FROM tbl_login_attempts
        WHERE email = :email
        AND ip_address = :ip_address
        LIMIT 1
    ");

    $stmt->execute([
        ":email" => $email,
        ":ip_address" => $ipAddress
    ]);

    $attempt = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$attempt) {
        return [
            "blocked" => false,
            "remaining_seconds" => 0
        ];
    }

    $blockedUntil = $attempt["blocked_until"] ?? null;

    if ($blockedUntil !== null) {
        $blockedTimestamp = strtotime((string)$blockedUntil);

        if ($blockedTimestamp !== false && $blockedTimestamp > time()) {
            return [
                "blocked" => true,
                "remaining_seconds" => $blockedTimestamp - time()
            ];
        }
    }

    return [
        "blocked" => false,
        "remaining_seconds" => 0
    ];
}

function recordFailedLoginAttempt(PDO $conn, string $email, string $ipAddress): void
{
    $stmt = $conn->prepare("
        INSERT INTO tbl_login_attempts (
            email,
            ip_address,
            failed_attempts,
            first_failed_at,
            last_failed_at,
            blocked_until
        )
        VALUES (
            :email,
            :ip_address,
            1,
            NOW(),
            NOW(),
            NULL
        )
        ON DUPLICATE KEY UPDATE
            blocked_until = CASE
                WHEN blocked_until IS NOT NULL
                     AND blocked_until > NOW()
                    THEN blocked_until
                WHEN first_failed_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
                    THEN NULL
                WHEN failed_attempts + 1 >= 5
                    THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE)
                ELSE NULL
            END,
            first_failed_at = CASE
                WHEN blocked_until IS NOT NULL
                     AND blocked_until <= NOW()
                    THEN NOW()
                WHEN first_failed_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
                    THEN NOW()
                ELSE first_failed_at
            END,
            failed_attempts = CASE
                WHEN blocked_until IS NOT NULL
                     AND blocked_until <= NOW()
                    THEN 1
                WHEN first_failed_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
                    THEN 1
                ELSE failed_attempts + 1
            END,
            last_failed_at = NOW()
    ");

    $stmt->execute([
        ":email" => $email,
        ":ip_address" => $ipAddress
    ]);
}

function clearLoginAttempts(PDO $conn, string $email, string $ipAddress): void
{
    $stmt = $conn->prepare("
        DELETE FROM tbl_login_attempts
        WHERE email = :email
        AND ip_address = :ip_address
    ");

    $stmt->execute([
        ":email" => $email,
        ":ip_address" => $ipAddress
    ]);
}

function recordLoginSecurityAudit(
    PDO $conn,
    ?int $userId,
    ?string $userName,
    string $action,
    string $details
): void {
    $stmt = $conn->prepare("
        INSERT INTO tbl_audit_trail (
            user_id,
            user_name,
            module,
            action,
            details
        )
        VALUES (
            :user_id,
            :user_name,
            'Authentication',
            :action,
            :details
        )
    ");

    $stmt->execute([
        ":user_id" => $userId,
        ":user_name" => $userName,
        ":action" => $action,
        ":details" => $details
    ]);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(
        false,
        "Invalid request method.",
        [],
        405
    );
}

$data = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($data)) {
    respond(
        false,
        "No login information was received.",
        [],
        400
    );
}

$email = strtolower(
    trim(
        (string)(
            $data["email"] ?? ""
        )
    )
);

$password = (string)(
    $data["password"] ?? ""
);

$ipAddress = getLoginClientIp();

if (
    $email === "" ||
    $password === ""
) {
    respond(
        false,
        "Email and password are required.",
        [],
        422
    );
}

if (
    !filter_var(
        $email,
        FILTER_VALIDATE_EMAIL
    )
) {
    respond(
        false,
        "Enter a valid email address.",
        [],
        422
    );
}

try {
    $rateLimit = getLoginRateLimit(
        $conn,
        $email,
        $ipAddress
    );

    if ($rateLimit["blocked"]) {
        $remainingMinutes = max(
            1,
            (int)ceil(
                $rateLimit["remaining_seconds"] / 60
            )
        );

        respond(
            false,
            "Too many failed login attempts. Please try again in {$remainingMinutes} minute(s).",
            [],
            429
        );
    }

    $stmt = $conn->prepare("
        SELECT
            u.user_id,
            u.first_name,
            u.middle_name,
            u.last_name,
            u.position,
            u.full_name,
            u.email,
            u.password,

            CASE
                WHEN u.role = 'Vendor'
                    THEN 'Supplier'
                ELSE u.role
            END AS role,

            u.status,
            u.vendor_id,

            COALESCE(
                u.access_mode,
                'Default'
            ) AS access_mode,

            u.module_permissions,
            u.must_change_password,
            u.last_login,
            u.created_at,

            v.vendor_name,
            v.contact_person
                AS supplier_contact_person,
            v.phone
                AS supplier_phone,
            v.address
                AS supplier_address,
            v.status
                AS supplier_status

        FROM tbl_user u

        LEFT JOIN tbl_vendor v
            ON v.vendor_id =
               u.vendor_id

        WHERE LOWER(u.email) =
              LOWER(:email)

        LIMIT 1
    ");

    $stmt->execute([
        ":email" => $email
    ]);

    $user = $stmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$user) {
        recordFailedLoginAttempt(
            $conn,
            $email,
            $ipAddress
        );

        respond(
            false,
            "Invalid email or password.",
            [],
            401
        );
    }

    if (
        strtolower(
            trim(
                (string)$user["status"]
            )
        ) !== "active"
    ) {
        respond(
            false,
            "This account is inactive.",
            [],
            403
        );
    }

    $allowedRoles = [
        "Admin",
        "Staff",
        "Supplier",
        "Audit"
    ];

    if (
        !in_array(
            $user["role"],
            $allowedRoles,
            true
        )
    ) {
        respond(
            false,
            "This role is not allowed to access the system.",
            [],
            403
        );
    }

    $storedPassword =
        (string)$user["password"];

    $verifiedWithHash = password_verify(
        $password,
        $storedPassword
    );

    $verifiedWithLegacyPlaintext =
        !$verifiedWithHash &&
        hash_equals(
            $storedPassword,
            $password
        );

    if (
        !$verifiedWithHash &&
        !$verifiedWithLegacyPlaintext
    ) {
        recordFailedLoginAttempt(
            $conn,
            $email,
            $ipAddress
        );

        $updatedRateLimit = getLoginRateLimit(
            $conn,
            $email,
            $ipAddress
        );

        if ($updatedRateLimit["blocked"]) {
            try {
                recordLoginSecurityAudit(
                    $conn,
                    (int)$user["user_id"],
                    (string)($user["full_name"] ?? $user["email"]),
                    "Login temporarily blocked",
                    "Too many failed login attempts from IP " . $ipAddress . "."
                );
            } catch (Throwable $auditError) {
                error_log(
                    "HiveSync login security audit error: " .
                    $auditError->getMessage()
                );
            }

            respond(
                false,
                "Too many failed login attempts. Please try again in 15 minutes.",
                [],
                429
            );
        }

        respond(
            false,
            "Invalid email or password.",
            [],
            401
        );
    }

    clearLoginAttempts(
        $conn,
        $email,
        $ipAddress
    );

    if (
        $user["role"] === "Supplier"
    ) {
        if (
            empty(
                $user["vendor_id"]
            )
        ) {
            respond(
                false,
                "This Supplier account is not connected to a supplier record. Ask the administrator to assign a supplier in User Management.",
                [],
                403
            );
        }

        if (
            $user["supplier_status"] !== null &&
            strtolower(
                trim(
                    (string)$user[
                        "supplier_status"
                    ]
                )
            ) === "archived"
        ) {
            respond(
                false,
                "The supplier record connected to this account is archived.",
                [],
                403
            );
        }
    }

    $accessMode =
        $user["role"] === "Admin"
            ? "Default"
            : (
                in_array(
                    (string)$user[
                        "access_mode"
                    ],
                    [
                        "Default",
                        "Custom"
                    ],
                    true
                )
                    ? (string)$user[
                        "access_mode"
                    ]
                    : "Default"
            );

    $modulePermissions =
        decodePermissions(
            $user[
                "module_permissions"
            ] ?? null,
            (string)$user["role"],
            $accessMode
        );

    if (
        count(
            $modulePermissions
        ) === 0
    ) {
        respond(
            false,
            "This account does not have an assigned module. Ask the administrator to update the account.",
            [],
            403
        );
    }

    if (
        $verifiedWithLegacyPlaintext ||
        (
            $verifiedWithHash &&
            password_needs_rehash(
                $storedPassword,
                PASSWORD_DEFAULT
            )
        )
    ) {
        $newPasswordHash = password_hash(
            $password,
            PASSWORD_DEFAULT
        );

        $updatePassword = $conn->prepare("
            UPDATE tbl_user
            SET password = :password
            WHERE user_id = :user_id
        ");

        $updatePassword->execute([
            ":password" => $newPasswordHash,
            ":user_id" => $user["user_id"]
        ]);
    }

    if (
        $user["role"] === "Admin" &&
        empty($user["last_login"])
    ) {
        $conn->beginTransaction();

        try {
            $deactivatePreviousAdmins = $conn->prepare("
                UPDATE tbl_user
                SET status = 'Inactive'
                WHERE role = 'Admin'
                AND status = 'Active'
                AND user_id <> :user_id
            ");

            $deactivatePreviousAdmins->execute([
                ":user_id" => $user["user_id"]
            ]);

            $updateLogin = $conn->prepare("
                UPDATE tbl_user
                SET last_login = NOW()
                WHERE user_id = :user_id
                AND role = 'Admin'
                AND status = 'Active'
            ");

            $updateLogin->execute([
                ":user_id" => $user["user_id"]
            ]);

            if ($updateLogin->rowCount() !== 1) {
                throw new RuntimeException(
                    "Unable to complete the Admin account transfer."
                );
            }

            $conn->commit();
        } catch (Throwable $transferError) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }

            throw $transferError;
        }
    } else {
        $updateLogin =
            $conn->prepare("
                UPDATE tbl_user
                SET last_login = NOW()
                WHERE user_id = :user_id
            ");

        $updateLogin->execute([
            ":user_id" =>
                $user["user_id"]
        ]);
    }

    $safeUser = [
        "user_id" =>
            (int)$user["user_id"],

        "first_name" =>
            $user["first_name"],

        "middle_name" =>
            $user["middle_name"],

        "last_name" =>
            $user["last_name"],

        "full_name" =>
            $user["full_name"],

        "position" =>
            $user["position"],

        "email" =>
            $user["email"],

        "role" =>
            $user["role"],

        "status" =>
            $user["status"],

        "vendor_id" =>
            $user["vendor_id"] !== null
                ? (int)$user[
                    "vendor_id"
                ]
                : null,

        "vendor_name" =>
            $user["vendor_name"],

        "supplier_contact_person" =>
            $user[
                "supplier_contact_person"
            ],

        "supplier_phone" =>
            $user[
                "supplier_phone"
            ],

        "supplier_address" =>
            $user[
                "supplier_address"
            ],

        "access_mode" =>
            $accessMode,

        "module_permissions" =>
            $modulePermissions,

        "must_change_password" =>
            (int)$user[
                "must_change_password"
            ],

        "last_login" =>
            date("Y-m-d H:i:s")
    ];

    session_regenerate_id(true);

    $_SESSION["authenticated"] = true;
    $_SESSION["user_id"] = $safeUser["user_id"];
    $_SESSION["email"] = $safeUser["email"];
    $_SESSION["role"] = $safeUser["role"];
    $_SESSION["vendor_id"] = $safeUser["vendor_id"];
    $_SESSION["module_permissions"] =
        $safeUser["module_permissions"];
    $_SESSION["must_change_password"] =
        $safeUser["must_change_password"];
    $_SESSION["last_activity"] = time();

    respond(
        true,
        "Login successful.",
        [
            "must_change_password" =>
                $safeUser[
                    "must_change_password"
                ],

            "user" =>
                $safeUser
        ]
    );

} catch (Throwable $error) {
    error_log(
        "HiveSync login error: " .
        $error->getMessage()
    );

    respond(
        false,
        "Unable to sign in at this time.",
        [],
        500
    );
}
