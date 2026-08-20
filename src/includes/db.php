<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';

function db(): PDO 
{
    static $pdo = null;

    if ($pdo instanceof PDO) 
    {
        return $pdo;
    }

    $host = env('DB_HOST');
    $port = env('DB_PORT');
    $name = env('POSTGRES_DB');
    $user = env('POSTGRES_USER');
    $password = env('POSTGRES_PASSWORD');

    $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        $host,
        $port,
        $name
    );
    
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}