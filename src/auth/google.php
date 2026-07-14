<?php

$clientId = GOOGLE_CLIENT_ID;
$redirectUri = '*/auth/google_callback.php';

$params = [
    'client_id' => $clientId,
    'redirect_uri' => $redirectUri,
    'response_type' => 'code',
    'scope' => 'openid email profile',
    'prompt' => 'select_account'
];

header('Location: https://accounts.goggle.com/o/oauth2/v2/auth?' . http_build_query($params));
exit;

?>