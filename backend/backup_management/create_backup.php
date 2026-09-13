<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

try {

    $database = "hivesync_db";
    $host = "localhost";
    $username = "root";
    $password = "";

    $backupDir = __DIR__ . "/backups/";

    if (!file_exists($backupDir)) {
        mkdir($backupDir, 0777, true);
    }

    $filename =
        "hivesync_backup_" .
        date("Y-m-d_H-i-s") .
        ".sql";

    $filepath = $backupDir . $filename;

    $command =
        "C:\\xampp\\mysql\\bin\\mysqldump.exe " .
        "--host={$host} " .
        "--user={$username} ";

    if ($password !== "") {
        $command .= "--password={$password} ";
    }

    $command .= "{$database} > \"{$filepath}\"";

    exec($command, $output, $result);

    if ($result === 0) {
        echo json_encode([
            "success" => true,
            "message" => "Database backup created successfully.",
            "file" => $filename
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Backup failed."
        ]);
    }

} catch (Exception $e) {

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);

}
?>