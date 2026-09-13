<?php

$isHttps =
    (!empty($_SERVER["HTTPS"]) &&
     strtolower((string)$_SERVER["HTTPS"]) !== "off")
    ||
    (
        isset($_SERVER["SERVER_PORT"]) &&
        (int)$_SERVER["SERVER_PORT"] === 443
    );

if (session_status() !== PHP_SESSION_ACTIVE) {
    ini_set("session.use_strict_mode", "1");
    ini_set("session.use_only_cookies", "1");
    ini_set("session.cookie_httponly", "1");
    ini_set("session.cookie_samesite", "Lax");

    session_name("HIVESYNCSESSID");

    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "domain" => "",
        "secure" => $isHttps,
        "httponly" => true,
        "samesite" => "Lax",
    ]);

    session_start();
}

if (
    empty($_SESSION["csrf_token"]) ||
    !is_string($_SESSION["csrf_token"])
) {
    $_SESSION["csrf_token"] = bin2hex(random_bytes(32));
}