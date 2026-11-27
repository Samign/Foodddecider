<?php
session_start([
    'cookie_httponly' => true,
    'cookie_secure' => false, // IMPORTANT CHANGE TO TRUE WHEN IN PRODUCTION!!!
    'use_strict_mode' => true,
    'cookie_samesite' => 'Lax',   // the cookie isn't sent on cross-site POSTs (basic CSRF protection)
]);