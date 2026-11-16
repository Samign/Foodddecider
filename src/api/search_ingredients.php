<?php
require_once '../includes/db.php';

header('Content-Type: application/json; charset=utf-8');

$q    = mb_substr(trim($_GET['q'] ?? ''), 0, 60);
$like = addcslashes($q, '%_\\');

$db = db();
$stmt = $db->prepare("
    SELECT id, name_en AS name
    FROM ingredients
    WHERE
        name_en ILIKE :prefix
        OR (length(:term) >= 3 AND similarity(name_en, :term) > 0.3)
    ORDER BY
        name_en ILIKE :prefix DESC,
        similarity(name_en, :term) DESC
    LIMIT 10
");
$stmt->execute([':prefix' => "$like%", ':term' => $q]);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));