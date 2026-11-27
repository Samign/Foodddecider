<?php
require_once __DIR__ . '/../../includes/json_response.php';   // JSON content type (see the file)
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/session.php';

$data = json_decode(file_get_contents('php://input'), true);
$recipe_id = $data['recipe_id'] ?? null;

if (!$recipe_id) {
    http_response_code(400);
    echo json_encode(['error' => 'Recipe ID is required']);
    exit;
}

$db = db();

$user_id = $_SESSION['user_id'] ?? null;
$session_id = session_id();

$db->beginTransaction();

try {

    $stmt = $db->prepare("
        INSERT INTO recipe_views (recipe_id, user_id, session_id)
        VALUES (:recipe_id, :user_id, :session_id)
        ON CONFLICT DO NOTHING
        RETURNING 1
    ");

    $stmt->execute([
        ':recipe_id' => $recipe_id,
        ':user_id' => $user_id,
        ':session_id' => $session_id
    ]);

    $counted = (bool)$stmt->fetch();
    if ($counted) {
        $update_stmt = $db->prepare("
            UPDATE recipes 
            SET view_count = view_count + 1 
            WHERE id = :recipe_id
        ");
        $update_stmt->execute([':recipe_id' => $recipe_id]);
    }

    $db->commit();
    echo json_encode(['success' => true, 'counted' => $counted]);   // the page adds 1 to the views it shows

} catch (Exception $e) {
    $db->rollBack();
    error_log('register_view: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not count the view']);
}