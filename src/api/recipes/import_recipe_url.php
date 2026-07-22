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

// function downloadRecipeImage($imageUrl, $recipeId) {
//     if (!$imageUrl) {
//         return null;
//     }

//     $ch = curl_init($imageUrl);
//     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//     curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
//     curl_setopt($ch, CURLOPT_TIMEOUT, 60);

//     $imageData = curl_exec($ch);
//     if (curl_errno($ch)) {
//         error_log('cURL error while downloading image: ' . curl_error($ch));
//         curl_close($ch);
//         return null;
//     }
    
//     $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
//     curl_close($ch);

//     $extension = match($contentType) {
//         'image/jpeg' => 'jpg',
//         'image/png' => 'png',
//         'image/gif' => 'gif',
//         'image/webp' => 'webp',
//         default => 'jpg',
//     };

//     $imagePath = __DIR__ . '/../../uploads/recipe_pictures/recipe_' . $recipeId . '.' . $extension;
//     file_put_contents($imagePath, $imageData);

//     processRecipe


//     return '/images/recipes/' . $recipeId . '.' . $extension;
// }

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

// TODO Fork recipe function here

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

//     $db->beginTransaction();

//     $stmt = $db->prepare("
//         INSERT INTO recipes (title, description, link, prep_time_minutes, cook_time_minutes, servings, image_base)
//         VALUES (:title, :description, :link, :prep_time, :cook_time, :servings, :image_base)
//         RETURNING id
//     ");

//     $stmt->execute([
//         ':title' => $llmData['title'] ?? 'Untitled Recipe',
//         ':description' => $llmData['description'] ?? null,
//         ':link' => $targetUrl,
//         ':prep_time' => $llmData['prep_time'] ?? null,
//         ':cook_time' => $llmData['cook_time'] ?? null,
//         ':servings' => $llmData['servings'] ?? null,
//         ':image_base' => null,
//     ]);

//     $recipeId = $stmt->fetchColumn();

//     if (!empty($llmData['instructions'])) {
//         $stmt = $db->prepare("
//             INSERT INTO recipe_steps (recipe_id, step_number, content)
//             VALUES (:recipe_id, :step_number, :content)
//         ");

//         foreach ($llmData['instructions'] as $index => $instruction) {
//             $stmt->execute([
//                 ':recipe_id' => $recipeId,
//                 ':step_number' => $index + 1,
//                 ':content' => $instruction['content'] ?? 'No instruction provided.',
//             ]);
//         }
//     }

    
//     if (!empty($llmData['ingredients'])) {
//         $stmt = $db->prepare("
//             INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, notes)
//             VALUES (:recipe_id, :name, :quantity, :unit, :notes)
//         ");

//         foreach ($llmData['ingredients'] as $ingredient) {
//             $stmt->execute([
//                 ':recipe_id' => $recipeId,
//                 ':name' => $ingredient['name'] ?? 'Unknown Ingredient',
//                 ':quantity' => $ingredient['quantity'] ?? null,
//                 ':unit' => $ingredient['unit'] ?? null,
//                 ':notes' => $ingredient['notes'] ?? null,
//             ]);
//         }
//     }

//     $db->commit();
//     echo json_encode(['success' => true, 'recipe_id' => $recipeId]);
// }
// catch (Exception $e) {
//     $db->rollBack();
//     error_log('Error importing recipe: ' . $e->getMessage());
//     echo json_encode(['success' => false, 'error' => 'Failed to import recipe.']);
// }

?>