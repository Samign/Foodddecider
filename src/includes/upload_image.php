<?php

function processRecipeImage(?string $imageUrl, ?array $uploadedFile, string|int|null $recipeId, string $imageType): ?string
{
    if (!$imageUrl && !$uploadedFile) {
        return null;
    }

    // 1. Load image binary data
    $imageData = null;

    if ($uploadedFile && isset($uploadedFile['tmp_name'])) {
        // User upload
        if ($uploadedFile['size'] > 5 * 1024 * 1024) {
            return null;
        }
        $imageData = file_get_contents($uploadedFile['tmp_name']);
    } elseif ($imageUrl) {
        // Remote download
        $ch = curl_init($imageUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $imageData = curl_exec($ch);

        if (curl_errno($ch)) {
            error_log('cURL error: ' . curl_error($ch));
            return null;
        }
    }

    if (!$imageData) {
        return null;
    }

    $outputPath = __DIR__ . '/../uploads/' . $imageType . '_pictures/' . $imageType . '_' . $recipeId . '.webp';
    $basePath = $imageType . '_' . $recipeId;

    // 2. Try Imagick first (best quality)
    if (class_exists('Imagick')) {
        try {
            $image = new Imagick();
            $image->readImageBlob($imageData);

            $image->autoOrient(); // fixes phone photos
            $image->stripImage(); // remove EXIF metadata
            $image->setImageFormat('webp');
            $image->setImageCompressionQuality(80);
            $image->resizeImage(1200, 1200, Imagick::FILTER_LANCZOS, 1, true);
            $image->thumbnailImage(400, 400, true);

            $image->writeImage($outputPath);

            $image->clear();
            $image->destroy();

            return $basePath;

        } catch (Exception $e) {
            error_log('Imagick failed: ' . $e->getMessage());
        }
    }

    // 3. Fallback to GD
    $img = imagecreatefromstring($imageData);
    if (!$img) {
        return null;
    }

    imagewebp($img, $outputPath, 80);

    return $basePath;
}