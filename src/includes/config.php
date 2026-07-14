<?php 

function env(string $key, bool $required = true): string
{
    $value = getenv($key);

    if ($required && ($value === false || $value == '')) {
        throw new RuntimeException("Missing environment varible {$key}");
    }

    return $value;
}
?>