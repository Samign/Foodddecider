<?php
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/require_login.php';

$recipe_id = $_GET['recipe_id'] ?? null; 

$validated_recipe_id = filter_var($recipe_id, FILTER_VALIDATE_INT);

if (!$validated_recipe_id) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid recipe ID', 'id' => $recipe_id]);
    exit;
}

$db = db();
$user_id = $_SESSION['user_id'];

try {
    $stmt = $db->prepare("SELECT owner_id FROM recipes WHERE id = :recipe_id");
    $stmt->bindValue(':recipe_id', $validated_recipe_id, PDO::PARAM_INT);
    $stmt->execute();
    $recipe = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$recipe) {
        http_response_code(404);
        echo json_encode(['error' => 'Recipe not found']);
        exit;
    }
    if ($recipe['owner_id'] != $user_id) {
        http_response_code(403);
        echo json_encode(['error' => 'You do not have permission to delete this recipe']);
        exit;
    }
    $stmt = $db->prepare("DELETE FROM recipes WHERE id = :recipe_id");
    $stmt->bindValue(':recipe_id', $validated_recipe_id, PDO::PARAM_INT);
    $stmt->execute();
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to delete recipe', 'message' => $e->getMessage()]);
}