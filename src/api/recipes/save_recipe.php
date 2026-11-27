<?php
require_once __DIR__ . '/../../includes/json_response.php';   // JSON content type (see the file)
require_once __DIR__ . '/../../includes/require_login.php';     // 401 for visitors: the page asks them to log in
require_once __DIR__ . '/../../includes/db.php';

// Toggles "saved" for the current user. Answers the new state and the new total,
// so the page can show the right number even if someone else saved it meanwhile.
$data = json_decode(file_get_contents('php://input'), true);
$recipeId = filter_var($data['recipe_id'] ?? null, FILTER_VALIDATE_INT);
$userId = $_SESSION['user_id'];

if (!$recipeId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing recipe']);
    exit;
}

$db = db();

// Only recipes this person can see, and not their own (it's already in their kitchen)
$stmt = $db->prepare("SELECT owner_id FROM recipes WHERE id = :id AND (is_public = '1' OR owner_id = :user)");
$stmt->execute([':id' => $recipeId, ':user' => $userId]);
$recipe = $stmt->fetch();
if (!$recipe) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'This recipe doesn’t exist any more.']);
    exit;
}
if ((string)$recipe['owner_id'] === (string)$userId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Your own recipes are always in your kitchen.']);
    exit;
}

$delete = $db->prepare("DELETE FROM saved_recipes WHERE user_id = :user AND recipe_id = :id");
$delete->execute([':user' => $userId, ':id' => $recipeId]);
$saved = $delete->rowCount() === 0;
if ($saved) {
    $db->prepare("INSERT INTO saved_recipes (user_id, recipe_id) VALUES (:user, :id) ON CONFLICT DO NOTHING")
       ->execute([':user' => $userId, ':id' => $recipeId]);
}

$count = $db->prepare("SELECT COUNT(*) FROM saved_recipes WHERE recipe_id = :id");
$count->execute([':id' => $recipeId]);

echo json_encode([
    'success' => true,
    'status'  => $saved ? 'saved' : 'unsaved',
    'saved'   => $saved,
    'saves'   => (int)$count->fetchColumn(),
]);
