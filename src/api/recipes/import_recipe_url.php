<?php 
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/recipe_adder.php';
require_once __DIR__ . '/../../includes/upload_image.php';

function parseRecipeFromPythonAPI($targetUrl) {
    $apiUrl = 'http://api:8001/parse';
    $payload = json_encode(['url' => $targetUrl]);

    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 120);

    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('cURL error: ' . curl_error($ch));
        // curl_close is deprecated in PHP 8.5; use curl_reset and unset
        if (function_exists('curl_reset')) {
            curl_reset($ch);
        }
        unset($ch);
        return null;
    }
    // curl_close is deprecated in PHP 8.5; use curl_reset and unset
    if (function_exists('curl_reset')) {
        curl_reset($ch);
    }
    unset($ch);

    $data = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('JSON decode error: ' . json_last_error_msg());
        return null;
    }

    return $data;
}

$targetUrl = $_POST['url'] ?? null;

echo "Received URL: " . $targetUrl;

$llmData = parseRecipeFromPythonAPI($targetUrl);

if (!$llmData) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to parse recipe from URL']);
    exit;
}

echo "addRecipe data: " . json_encode($llmData);

$recipeId = addRecipe([
    'name' => $llmData['recipe']['title'] ?? 'Untitled Recipe',
    'description' => $llmData['recipe']['description'] ?? null,
    'link' => $targetUrl,
    'public' => '1',
    'course' => $llmData['recipe']['course_type'] ?? '4',
    'prep' => $llmData['recipe']['prep_time'] ?? null,
    'cook' => $llmData['recipe']['cook_time'] ?? null,
    'picture' => null,
    'servings' => $llmData['recipe']['servings'] ?? null,
    'tags' => $llmData['recipe']['tags'] ?? [],
    'steps' => $llmData['recipe']['instructions'] ?? [],
    'ingredients' => $llmData['recipe']['ingredients'] ?? []
]);


$recipePicture = null;
if (!empty($llmData['recipe']['image_url'])) {
    $recipePicture = processRecipeImage($llmData['recipe']['image_url'], null, $recipeId, "recipe");
}
   
$db = db();
$stmt = $db->prepare("UPDATE recipes SET image_base = :image_base WHERE id = :id");
$stmt->execute([
    ':image_base' => $recipePicture,
    ':id' => $recipeId,
]);

echo json_encode(['success' => true, 'recipe_id' => $recipeId]);