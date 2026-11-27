<?php

require __DIR__ . '/../includes/session.php';

$response = file_get_contents('https://oauth2.googleapis.com/token', false, stream_context_create([
'http' => [
    'method' => 'POST',
    'header' => 'content-type: application/x-www-form-urlencoded',
    'content' => http_build_query([
    'code' => $_GET['code'],
    'client_id' => GOOGLE_CLIENT_ID,
    'client_secret' => GOOGLE_CLIENT_SECRET,
    'redirect_uri' => GOOGLE_REDIRECT_URI,
    'grant_type' => 'authorization_code'
    ])
]
]));

$data = json_decode($response, true);
$idToken = $data['id_token'];

$parts = explode('.', $idToken);
$payload = json_decode(base64_decode($parts[1]), true);

$googleId = $payload['sub'];
$email = $payload['email'];

$db->beginTransaction();

$stmt = $db->prepare("SELECT user_id FROM auth_providers 
WHERE provider = 'google' AND provider_user_id = :gid
");

$stmt->execute([':gid' => $googleId]);
$row = $stmt->fetch();

if ($row) {
    $userId = $row['user_id'];
} else {
    $stmt = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if($user) {
        $userId = $user['id'];
    } else {
        $userId = uuid_create(UUID_TYPE_RANDOM);

        // Same rules as signup.php: the name is used in file names, URLs and pages
        $username = substr(preg_replace('/[^A-Za-z0-9_.-]/', '', explode('@', $email)[0]), 0, 24);
        $username = preg_replace('/^[^A-Za-z0-9]+/', '', $username);
        if (strlen($username) < 3) $username = 'cook';
        $taken = $db->prepare("SELECT 1 FROM users WHERE username = :u");
        $taken->execute([':u' => $username]);
        if ($taken->fetchColumn()) $username .= '-' . bin2hex(random_bytes(2));

        $db->prepare("
        INSERT INTO users (id, email, username)
        VALUES (:id, :email, :username)
        ")->execute([
            ':id' => $userId,
            ':email' => $email,
            ':username' => $username
        ]);

        // Google sign-ups never got the default avatar, so their picture was a broken image
        require_once __DIR__ . '/../includes/identicon.php';
        $dir = __DIR__ . '/../uploads/profile_pictures';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        file_put_contents("$dir/{$username}_avatar.svg", generateIdenticon($email));
    }

    $db->prepare("
    INSERT INTO auth_providers (id, user_id, provider, provider_user_id)
    VALUES (:id, :user_id, 'google', :gid)
    ")->execute([
        ':id' => uuid_create(UUID_TYPE_RANDOM),
        ':user_id' => $userId,
        ':gid' => $googleId
    ]);
}

$db->commit();

session_regenerate_id(true);
$_SESSION['user_id'] = $userId;
header('Location: /dashboard.php');
exit;

?>