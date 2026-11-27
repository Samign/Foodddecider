<?php
require_once __DIR__ . '/../../includes/json_response.php';   // JSON content type (see the file)
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/require_login.php';
require_once __DIR__ . '/../../includes/upload_image.php';

$recipe_id = $_GET['recipe_id'] ?? null; 

$validated_recipe_id = filter_var($recipe_id, FILTER_VALIDATE_INT);

if (!$validated_recipe_id) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid recipe ID']);   // don't echo the raw input back
    exit;
}

$db = db();
$user_id = $_SESSION['user_id'];

try {
    $stmt = $db->prepare("SELECT owner_id, image_base FROM recipes WHERE id = :recipe_id");
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
    deleteImageFiles('recipe', $recipe['image_base']);
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    error_log('Delete recipe failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Failed to delete recipe']);
}