<?php

function is_valid_uuid($uuid) {
    if (!is_string($uuid)) {
        return false;
    }

    $pattern = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';

    return (bool) preg_match($pattern, $uuid);
}

function validate_uuid($uuid) {
    if (!is_valid_uuid($uuid)) {
        return null;
    }

    return strtolower($uuid);
}