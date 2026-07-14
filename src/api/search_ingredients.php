<?php 
require_once '../includes/db.php';

$q = $_GET['q'] ?? '';

$db = db();

$stmt = $db->prepare("
    SELECT id, name_en AS name
    FROM ingredients
    WHERE name_en LIKE :search
    LIMIT 10
");

$stmt->execute([':search' => "$q%"]);

echo json_encode($stmt->fetchAll());
?>