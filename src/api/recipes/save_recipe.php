<?php
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/session.php';

$data = json_decode(file_get_contents('php://input'), true);
$recipe_id = $data['recipe_id'] ?? null;

$db = db();

// Check if already saved
$stmt = $db->prepare("SELECT 1 FROM saved_recipes WHERE user_id = :user_id AND recipe_id = :recipe_id");
$stmt->bindValue(':user_id', $_SESSION['user_id']);
$stmt->bindValue(':recipe_id', $recipe_id);
$stmt->execute();
if ($stmt->fetch()) {
    $stmt = $db->prepare("DELETE FROM saved_recipes WHERE user_id = :user_id AND recipe_id = :recipe_id");
    $stmt->bindValue(':user_id', $_SESSION['user_id']);
    $stmt->bindValue(':recipe_id', $recipe_id);
    $stmt->execute();
    echo json_encode(['status' => 'unsaved']);
    exit;
}

$stmt = $db->prepare("INSERT INTO saved_recipes (user_id, recipe_id) VALUES (:user_id, :recipe_id) ON CONFLICT DO NOTHING");
$stmt->bindValue(':user_id', $_SESSION['user_id']);
$stmt->bindValue(':recipe_id', $recipe_id);
$stmt->execute();

echo json_encode(['status' => 'saved']);
?>