<?php

date_default_timezone_set("Asia/Manila");

$host = "localhost";
$dbname = "hivesync_db";
$username = "hivesync_app";
$password = "HiveSync_DB@2026!";

try {
    $conn = new PDO(
        "mysql:host={$host};dbname={$dbname};charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE =>
                PDO::ERRMODE_EXCEPTION,

            PDO::ATTR_DEFAULT_FETCH_MODE =>
                PDO::FETCH_ASSOC,

            PDO::ATTR_EMULATE_PREPARES =>
                false,
        ]
    );

    $conn->exec(
        "SET time_zone = '+08:00'"
    );

} catch (PDOException $e) {
    error_log(
        "HiveSync database connection error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Database connection failed. Make sure MySQL is running and database hivesync_db exists."
    ]);

    exit;
}

class Database
{
    private string $host =
        "localhost";

    private string $dbname =
        "hivesync_db";

    private string $username =
        "hivesync_app";

    private string $password =
        "HiveSync_DB@2026!";

    public function getConnection(): PDO
    {
        date_default_timezone_set(
            "Asia/Manila"
        );

        $connection = new PDO(
            "mysql:host={$this->host};dbname={$this->dbname};charset=utf8mb4",
            $this->username,
            $this->password,
            [
                PDO::ATTR_ERRMODE =>
                    PDO::ERRMODE_EXCEPTION,

                PDO::ATTR_DEFAULT_FETCH_MODE =>
                    PDO::FETCH_ASSOC,

                PDO::ATTR_EMULATE_PREPARES =>
                    false,
            ]
        );

        $connection->exec(
            "SET time_zone = '+08:00'"
        );

        return $connection;
    }
}