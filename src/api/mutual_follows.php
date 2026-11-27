<?php
require_once __DIR__ . '/../includes/json_response.php';   // JSON content type (see the file)
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json');

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in.']);
    exit;
}

try {
    $db = db();
    $stmt = $db->prepare("
        SELECT u.username
        FROM followers f1
        JOIN followers f2
          ON f2.follower_id  = f1.followed_id
         AND f2.followed_id = f1.follower_id
        JOIN users u ON u.id = f1.followed_id
        WHERE f1.follower_id = :me
        ORDER BY u.username
    ");
    $stmt->execute([':me' => $_SESSION['user_id']]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'count' => count($users), 'users' => $users]);
} catch (Exception $e) {
    error_log($e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to load suggestions. Error: ' . $e->getMessage()]);
}