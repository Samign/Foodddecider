<?php
/**
 * Recipe and profile pictures.
 *
 * Every image is saved as WebP in a few sizes, named  {type}_{owner}_{random}{suffix}.webp
 *   recipe:  ""     (max 1600 px, recipe view)   "_600" (cards, pick card)
 *   profile: ""     (max 512 px, profile page)   "_200" (avatars in lists)
 * The random part changes whenever the picture changes, so browsers and nginx can cache
 * images forever and an edited recipe never shows its old photo.
 *
 * Only `image_base` (the name without suffix and extension) is stored in the database.
 */

const IMAGE_MAX_BYTES  = 8 * 1024 * 1024;   // uploads and downloads
const IMAGE_MAX_PIXELS = 40_000_000;        // refuse decompression bombs before decoding
const IMAGE_TYPES      = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF, IMAGETYPE_WEBP];
const IMAGE_SIZES      = [
    'recipe'  => ['' => 1600, '_600' => 600],
    'profile' => ['' => 512,  '_200' => 200],
];

const IMAGE_MIN_SIDE   = 300;               // smaller still works, but the browser warns it will look blurry

/** The same limits for assets/photo-check.js, printed into the page by modules.php. */
function imageRulesAttributes(): string {
    return sprintf('data-max-bytes="%d" data-max-pixels="%d" data-min-side="%d"',
        IMAGE_MAX_BYTES, IMAGE_MAX_PIXELS, IMAGE_MIN_SIDE);
}

/**
 * When a request is bigger than PHP's post_max_size, PHP throws away ALL fields and files,
 * so the recipe would arrive empty. Detect that and explain instead of saving nothing.
 */
function requestTooLargeMessage(): ?string {
    $toBytes = function (string $v): int {
        $n = (int)$v;
        return match (strtolower(substr(trim($v), -1))) { 'g' => $n << 30, 'm' => $n << 20, 'k' => $n << 10, default => $n };
    };
    $limit = $toBytes((string)ini_get('post_max_size'));
    $sent  = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($limit > 0 && $sent > $limit && empty($_POST) && empty($_FILES)) {
        return sprintf('The photo is too big. Choose one under %d MB.', IMAGE_MAX_BYTES / 1024 / 1024);
    }
    return null;
}

/** true when the request actually carries a file in this field (not just an empty file input). */
function photoWasSent(?array $file): bool {
    return $file !== null && ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
}

/**
 * Why an uploaded photo can't be used, in words for the person who chose it. null = it's fine
 * (or no photo was sent). Call before saving anything, so the form can be fixed and sent again.
 * assets/photo-check.js runs the same checks in the browser; this is the backstop.
 */
function checkImageUpload(?array $file): ?string {
    if (!photoWasSent($file)) return null;

    $maxMb = (int)(IMAGE_MAX_BYTES / 1024 / 1024);
    switch ($file['error']) {
        case UPLOAD_ERR_OK:
            break;
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return "The photo is too big. Choose one under $maxMb MB.";
        case UPLOAD_ERR_PARTIAL:
            return 'The photo only partly uploaded. Try again.';
        default:
            error_log('Photo upload failed on the server, PHP upload error ' . $file['error']);
            return 'The server could not receive the photo. Try again in a moment.';
    }

    if (!is_uploaded_file($file['tmp_name'])) return 'The photo could not be read. Try choosing it again.';
    if ($file['size'] > IMAGE_MAX_BYTES) return "The photo is too big. Choose one under $maxMb MB.";

    $head = (string)file_get_contents($file['tmp_name'], false, null, 0, 32);
    if (preg_match('/^.{4}ftyp(heic|heix|hevc|mif1|msf1)/s', $head)) {
        return 'iPhone HEIC photos can’t be used yet. Save it as JPG (or set the camera to “Most Compatible”) and try again.';
    }

    $info = @getimagesize($file['tmp_name']);
    if (!$info) return 'That file isn’t a picture we can open. Use a JPG, PNG, WEBP or GIF.';
    if (!in_array($info[2], IMAGE_TYPES, true)) return 'That picture type isn’t supported. Use a JPG, PNG, WEBP or GIF.';
    if ($info[0] * $info[1] > IMAGE_MAX_PIXELS) {
        return sprintf('The photo is %d × %d pixels, too large to process. Use one under %d megapixels.',
            $info[0], $info[1], IMAGE_MAX_PIXELS / 1_000_000);
    }
    return null;
}

function imageDir(string $imageType): string {
    return __DIR__ . '/../uploads/' . $imageType . '_pictures';
}

/**
 * Save an uploaded file or a remote image. Returns the new image_base, or null if there was
 * no usable image (wrong type, too big, could not download...). The caller stores the name.
 *
 * Kept the old name and arguments so existing callers keep working.
 */
function processRecipeImage(?string $imageUrl, ?array $uploadedFile, string|int|null $ownerId, string $imageType): ?string
{
    if (!isset(IMAGE_SIZES[$imageType])) {
        throw new InvalidArgumentException("Unknown image type $imageType");
    }

    $data = null;
    if ($uploadedFile && ($uploadedFile['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
        if (!is_uploaded_file($uploadedFile['tmp_name']) || $uploadedFile['size'] > IMAGE_MAX_BYTES) {
            return null;
        }
        $data = file_get_contents($uploadedFile['tmp_name']);
    } elseif ($imageUrl) {
        $data = fetchRemoteImage($imageUrl);
    }
    if (!$data) {
        return null;
    }

    // Check what it really is (not the file name or the browser's claim) and how big it decodes
    $info = @getimagesizefromstring($data);
    if (!$info || !in_array($info[2], IMAGE_TYPES, true) || $info[0] * $info[1] > IMAGE_MAX_PIXELS) {
        return null;
    }

    $owner = preg_replace('/[^A-Za-z0-9_-]/', '', (string)$ownerId) ?: 'x';
    $base  = $imageType . '_' . substr($owner, 0, 40) . '_' . bin2hex(random_bytes(4));
    $dir   = imageDir($imageType);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        error_log("Image folder missing and could not be created: $dir");
        return null;
    }

    $written = class_exists('Imagick')
        ? writeSizesImagick($data, $dir, $base, IMAGE_SIZES[$imageType])
        : null;
    $written ??= writeSizesGd($data, $dir, $base, IMAGE_SIZES[$imageType]);

    if (!$written) {
        deleteImageFiles($imageType, $base);   // no half-written sets
        return null;
    }
    return $base;
}

/** Remove every size of an image. Safe to call with null or with a name from the database. */
function deleteImageFiles(string $imageType, ?string $base): void {
    if (!$base || !isset(IMAGE_SIZES[$imageType]) || !preg_match('/^[a-z]+_[A-Za-z0-9_-]+$/', $base)) {
        return;
    }
    foreach (array_keys(IMAGE_SIZES[$imageType]) as $suffix) {
        $path = imageDir($imageType) . "/$base$suffix.webp";
        if (is_file($path)) @unlink($path);
    }
}

// ── Writing ──────────────────────────────────────────────────────────────────

/** @return bool|null  true = written, false = failed, null = Imagick can't read it (try GD) */
function writeSizesImagick(string $data, string $dir, string $base, array $sizes): ?bool {
    try {
        Imagick::setResourceLimit(Imagick::RESOURCETYPE_MEMORY, 256 * 1024 * 1024);
        $src = new Imagick();
        $src->readImageBlob($data);
        $src->setIteratorIndex(0);                    // first frame of a GIF
        $img = $src->getImage();
        $src->clear();

        if (method_exists($img, 'autoOrient')) {
            $img->autoOrient();                       // phone photos
        }
        $img->stripImage();                           // EXIF (location!) and colour profiles
        $img->transformImageColorspace(Imagick::COLORSPACE_SRGB);

        foreach ($sizes as $suffix => $max) {
            $copy = clone $img;
            if ($copy->getImageWidth() > $max || $copy->getImageHeight() > $max) {
                $copy->thumbnailImage($max, $max, true);   // fit inside, never upscale
            }
            $copy->setImageFormat('webp');
            $copy->setImageCompressionQuality($max <= 200 ? 72 : 80);
            $copy->setOption('webp:method', '5');
            $ok = writeAtomically("$dir/$base$suffix.webp", $copy->getImageBlob());
            $copy->clear();
            if (!$ok) return false;
        }
        $img->clear();
        return true;
    } catch (Throwable $e) {
        error_log('Imagick could not process image: ' . $e->getMessage());
        return null;
    }
}

function writeSizesGd(string $data, string $dir, string $base, array $sizes): bool {
    $img = @imagecreatefromstring($data);
    if (!$img) return false;

    $img = gdAutoOrient($img, $data);
    if (!imageistruecolor($img)) imagepalettetotruecolor($img);
    imagealphablending($img, true);
    imagesavealpha($img, true);

    foreach ($sizes as $suffix => $max) {
        [$w, $h] = [imagesx($img), imagesy($img)];
        $scale = min(1, $max / max($w, $h));
        $copy = $scale < 1
            ? imagescale($img, max(1, (int)round($w * $scale)), max(1, (int)round($h * $scale)), IMG_BICUBIC)
            : $img;

        ob_start();
        imagewebp($copy, null, $max <= 200 ? 72 : 80);
        $ok = writeAtomically("$dir/$base$suffix.webp", ob_get_clean());
        if ($copy !== $img) imagedestroy($copy);
        if (!$ok) { imagedestroy($img); return false; }
    }
    imagedestroy($img);
    return true;
}

/** GD ignores EXIF orientation, so phone photos come out sideways without this. */
function gdAutoOrient(GdImage $img, string $data): GdImage {
    if (!function_exists('exif_read_data') || !str_starts_with($data, "\xFF\xD8")) return $img;
    $exif = @exif_read_data('data://image/jpeg;base64,' . base64_encode($data));
    $rotate = [3 => 180, 6 => -90, 8 => 90][$exif['Orientation'] ?? 1] ?? 0;
    return $rotate ? (imagerotate($img, $rotate, 0) ?: $img) : $img;
}

/** Write to a temp file and rename, so a half-written image is never served. */
function writeAtomically(string $path, string $bytes): bool {
    if ($bytes === '') return false;
    $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($tmp, $bytes) === false) return false;
    if (!rename($tmp, $path)) { @unlink($tmp); return false; }
    return true;
}

// ── Downloading (recipe import) ──────────────────────────────────────────────

/**
 * Download an image from a URL that came from a web page (so: untrusted).
 * Blocks internal addresses (the database, the parser, cloud metadata...) on every redirect,
 * and stops reading after IMAGE_MAX_BYTES.
 */
function fetchRemoteImage(string $url, int $redirectsLeft = 3): ?string {
    $parts = parse_url($url);
    $scheme = strtolower($parts['scheme'] ?? '');
    $host = $parts['host'] ?? '';
    if (!in_array($scheme, ['http', 'https'], true) || $host === '') return null;

    $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);
    $ip = resolvePublicIp($host);
    if ($ip === null) {
        error_log("Image download blocked (not a public address): $url");
        return null;
    }

    $body = '';
    $tooBig = false;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RESOLVE         => ["$host:$port:" . (str_contains($ip, ':') ? "[$ip]" : $ip)],   // connect to the address we checked, not a re-resolved one
        CURLOPT_PROTOCOLS       => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_FOLLOWLOCATION  => false,                 // redirects are checked one by one below
        CURLOPT_CONNECTTIMEOUT  => 5,
        CURLOPT_TIMEOUT         => 20,
        CURLOPT_USERAGENT       => 'Mozilla/5.0 (compatible; FoodDecider/1.0)',
        CURLOPT_HTTPHEADER      => ['Accept: image/webp,image/*;q=0.9'],
        CURLOPT_WRITEFUNCTION   => function ($ch, $chunk) use (&$body, &$tooBig) {
            $body .= $chunk;
            if (strlen($body) > IMAGE_MAX_BYTES) { $tooBig = true; return 0; }   // abort the transfer
            return strlen($chunk);
        },
    ]);
    curl_exec($ch);
    $status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $location = curl_getinfo($ch, CURLINFO_REDIRECT_URL);
    $type     = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $error    = curl_errno($ch) && !$tooBig ? curl_error($ch) : null;
    unset($ch);

    if ($error) { error_log("Image download failed: $error"); return null; }
    if ($tooBig) return null;
    if ($status >= 300 && $status < 400 && $location) {
        return $redirectsLeft > 0 ? fetchRemoteImage($location, $redirectsLeft - 1) : null;
    }
    if ($status !== 200 || ($type !== '' && !str_starts_with(strtolower($type), 'image/'))) return null;
    return $body;
}

/** First public IPv4/IPv6 address of a host, or null if it resolves to anything private/reserved. */
function resolvePublicIp(string $host): ?string {
    $host = trim($host, '[]');
    $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : array_merge(
        gethostbynamel($host) ?: [],
        array_column(@dns_get_record($host, DNS_AAAA) ?: [], 'ipv6')
    );
    if (!$ips) return null;
    foreach ($ips as $ip) {   // every address must be public, or a DNS answer could mix in an internal one
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return null;
        }
    }
    return $ips[0];
}
