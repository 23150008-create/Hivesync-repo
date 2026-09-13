<?php

header("Content-Type: application/json");

echo json_encode([
    "fileinfo_loaded" =>
        extension_loaded("fileinfo"),
    "finfo_exists" =>
        class_exists("finfo")
]);