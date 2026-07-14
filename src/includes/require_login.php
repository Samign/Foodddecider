<?php

require_once __DIR__ . '/../includes/session.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit;
}
?>