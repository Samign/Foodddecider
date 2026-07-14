<?php
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

    if ($stmt->fetch()) {
        $update_stmt = $db->prepare("
            UPDATE recipes 
            SET view_count = view_count + 1 
            WHERE id = :recipe_id
        ");
        $update_stmt->execute([':recipe_id' => $recipe_id]);
    }

    $db->commit();

} catch (Exception $e) {
    $db->rollBack();
    throw $e;
}
?>