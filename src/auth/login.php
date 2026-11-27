<?php

require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/db.php';

// The login form posts with fetch() and wants JSON back; without JavaScript it's a normal form post.
$wantsJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');

function loginFailed(bool $json, string $message, int $status): never {
    http_response_code($status);
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => $message]);
    } else {
        echo htmlspecialchars($message);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    loginFailed($wantsJson, 'Use the login form.', 405);
}

$identifier = trim($_POST['user'] ?? '');
$password = (string)($_POST['password'] ?? '');

if ($identifier === '' || $password === '') {
    loginFailed($wantsJson, 'Fill in your email or username and your password.', 400);
}

$stmt = db()->prepare("
    SELECT u.id, ap.password_hash
    FROM users u
    JOIN auth_providers ap ON ap.user_id = u.id
    WHERE (u.email = :user OR u.username = :user) AND ap.provider = 'local'
");
$stmt->execute([':user' => $identifier]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    loginFailed($wantsJson, 'That email/username and password don’t match.', 401);
}

session_regenerate_id(true);   // a new session id on login, so an old (possibly planted) one is worthless
$_SESSION['user_id'] = $user['id'];

if ($wantsJson) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true]);
    exit;
}
header('Location: /index.php');
exit;
