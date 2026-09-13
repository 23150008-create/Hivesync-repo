<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

$backupDir = __DIR__ . "/backups/";

try {

    $files = [];

    if (file_exists($backupDir)) {

        foreach (glob($backupDir . "*.sql") as $file) {

            $files[] = [
                "filename" => basename($file),
                "size" => round(filesize($file) / 1024, 2),
                "date" => date(
                    "Y-m-d H:i:s",
                    filemtime($file)
                ),
                "download_url" =>
                    "http://localhost/HiveSync/backend/backup_management/backups/" .
                    basename($file)
            ];
        }
    }

    usort($files, function ($a, $b) {
        return strtotime($b["date"]) - strtotime($a["date"]);
    });

    echo json_encode([
        "success" => true,
        "backups" => $files
    ]);

} catch (Exception $e) {

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);

}