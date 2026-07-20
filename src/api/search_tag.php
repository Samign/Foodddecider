<?php

require_once __DIR__ . '/../includes/recipe_adder.php';

$q = trim($_GET["q"] ?? '');

if ($q ==='') {echo json_encode([]); exit;}

$stmt = $pdo->prepare('
    SELECT id, name, is_featured
    FROM tags
    WHERE slug LIKE :prefix || '%'
    ORDER BY is_featured DESC, display_order ASC, name ASC
    LIMIT 10
');

$stmt->execute([':prefix' => slugify($q)]);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
?>