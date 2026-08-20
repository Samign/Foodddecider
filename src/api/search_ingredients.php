<?php 
require_once '../includes/db.php';

$q = trim($_GET['q'] ?? '');

$db = db();

$stmt = $db->prepare("
    SELECT id, name_en AS name
    FROM ingredients
    WHERE
        name_en ILIKE :prefix
        OR (length(:term) >= 3 AND similarity(name_en, :term) > 0.3)
    ORDER BY
        name_en ILIKE :prefix DESC,       -- exact prefix matches float to top
        similarity(name_en, :term) DESC   -- then sort remaining by fuzzy score
    LIMIT 10
");

$stmt->execute([
    ':prefix' => "$q%",
    ':term'   => $q,
]);

echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));