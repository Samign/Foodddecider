<?php

require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/db.php';

$db = db();

$user = trim($_POST['user'] ?? '');
$password = trim($_POST['password'] ?? '');

$stmt = $db->prepare("
SELECT u.id, ap.password_hash
FROM users u
JOIN auth_providers ap ON ap.user_id = u.id
WHERE (u.email = :user or u.username = :user) AND ap.provider = 'local'
");

$stmt->execute([
    ':user' => $user
]);

$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    exit('invalid credentials');
}

$_SESSION['user_id'] = $user['id'];


header('Location: /index.php');
exit;
?>