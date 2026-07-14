<?php

require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/upload_image.php';
require_once __DIR__ . '/../includes/identicon.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$email = trim($_POST['email'] ?? '');
$username = trim($_POST['username'] ?? '');
$password = trim($_POST['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    exit;
}

$profilePicture = null;

if ($_FILES['picture']['error'] === UPLOAD_ERR_OK) {
    $profilePicture = processRecipeImage(null, $_FILES['picture'], $username, "profile");
} else {
    $avatar = generateIdenticon($email);
    file_put_contents("/var/www/html/uploads/profile_pictures/" . $username . "_avatar.svg", $avatar);
}

$hash = password_hash($password, PASSWORD_DEFAULT);

try {

    $db = db();
    $db->beginTransaction();
    
    $stmt = $db->prepare("
    INSERT INTO users (email, username, image_base)
    VALUES (:email, :username, :image_base)
    RETURNING id
    ");
    
    $stmt->execute([
        ':email' => $email,
        ':username' => $username,
        ':image_base' => $profilePicture
    ]);

    $userId = $stmt->fetchColumn();
    
    $db->prepare("
    INSERT INTO auth_providers (user_id, provider, password_hash)
    VALUES (:user_id, 'local', :passwordhash)"
    )->execute([
        ':user_id' => $userId,
        ':passwordhash' => $hash
    ]);
    
    $db->commit();
    
    $_SESSION['user_id'] = $userId;
    header('Location: /index.php');
    exit;

} catch (PDOException $e) {
    $db->rollBack();

    if ($e->getCode() === '23505') {
        http_response_code(409);
        exit('Email or username already exists');
    }

    throw $e;
}

?>