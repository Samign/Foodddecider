<?php

require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/upload_image.php';
require_once __DIR__ . '/../includes/identicon.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

// Too big for PHP: every field arrives empty, which would otherwise look like a missing email
if ($tooLarge = requestTooLargeMessage()) {
    http_response_code(413);
    exit($tooLarge);
}

$email = trim($_POST['email'] ?? '');
$username = trim($_POST['username'] ?? '');
$password = trim($_POST['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    exit('Enter a valid email address');
}

// The username ends up in file names, URLs (/user/name) and pages: letters, digits, _ . - only.
// Before this, "../../x" wrote files outside the uploads folder and "<img onerror=...>" was a valid name.
if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]{2,29}$/', $username)) {
    http_response_code(400);
    exit('Username: 3-30 letters, numbers, dots, dashes or underscores');
}

if (strlen($password) < 8) {
    http_response_code(400);
    exit('Password: at least 8 characters');
}

// A bad photo doesn't stop the sign-up: they get the generated avatar (the page already warned them)
$profilePicture = checkImageUpload($_FILES['picture'] ?? null)
    ? null
    : processRecipeImage(null, $_FILES['picture'] ?? null, $username, "profile");
if (!$profilePicture) {
    $dir = __DIR__ . '/../uploads/profile_pictures';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents("$dir/{$username}_avatar.svg", generateIdenticon($email));
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
    
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    header('Location: /index.php');
    exit;

} catch (PDOException $e) {
    $db->rollBack();

    if ($e->getCode() === '23505') {
        http_response_code(409);
        exit('That email or username is already taken');
    }

    throw $e;
}

?>