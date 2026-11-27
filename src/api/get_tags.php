<?php
require_once __DIR__ . '/../includes/json_response.php';   // JSON content type (see the file)
header('Content-Type: application/json');
require __DIR__ . '/../includes/db.php';

$pdo = db();

$stmt = $pdo->prepare('
    SELECT id, name
    FROM tags
    WHERE is_featured = true
    ORDER BY display_order ASC, name ASC
');

$stmt->execute();
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));