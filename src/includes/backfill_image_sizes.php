<?php
/**
 * One-off: make the smaller sizes (_600 for recipes, _200 for profiles) for pictures uploaded
 * before upload_image.php started saving several sizes. Safe to run more than once.
 *
 *   docker compose exec php php /var/www/html/includes/backfill_image_sizes.php
 *
 * Until it has run, the site still works: cards fall back to the full picture.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/upload_image.php';

$jobs = [
    'recipe'  => "SELECT DISTINCT image_base FROM recipes WHERE image_base IS NOT NULL",
    'profile' => "SELECT DISTINCT image_base FROM users WHERE image_base IS NOT NULL",
];

foreach ($jobs as $type => $sql) {
    $dir = imageDir($type);
    $made = $skipped = $missing = 0;

    foreach (db()->query($sql)->fetchAll(PDO::FETCH_COLUMN) as $base) {
        $full = "$dir/$base.webp";
        if (!preg_match('/^[a-z]+_[A-Za-z0-9_-]+$/', $base) || !is_file($full)) { $missing++; continue; }

        // Only the sizes that don't exist yet; the full picture is left as it is
        $todo = array_filter(IMAGE_SIZES[$type], fn($max, $suffix) =>
            $suffix !== '' && !is_file("$dir/$base$suffix.webp"), ARRAY_FILTER_USE_BOTH);
        if (!$todo) { $skipped++; continue; }

        $data = file_get_contents($full);
        $ok = class_exists('Imagick') ? writeSizesImagick($data, $dir, $base, $todo) : null;
        $ok ??= writeSizesGd($data, $dir, $base, $todo);
        $ok ? $made++ : fwrite(STDERR, "Could not resize $full\n");
    }
    echo "$type: $made resized, $skipped already done, $missing missing files\n";
}
