<?php

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/require_login.php';
require_once __DIR__ . '/../../includes/upload_image.php';
require_once __DIR__ . '/../../includes/recipe_adder.php';
require_once __DIR__ . '/../../includes/helpers/recipe_helper.php';

$input = fetchRecipeInput();


// echo "Input data received: " . json_encode($input) . "\n"; // Debugging line

$recipeId = addRecipe([
    'name' => $input['name'],
    'description' => $input['description'],
    'link' => $input['link'],
    'public' => $input['public'],
    'course' => $input['course'],
    'prep' => $input['prep'],
    'cook' => $input['cook'],
    'servings' => $input['servings'],
    'step_sections' => $input['steps'] ?? [],
    'ingredient_sections' => $input['ingredients'] ?? [],
    'forked_from_recipe_id' => $input['forked_from_recipe_id'] ?? null,
    'tags' => $input['tags'] ?? []
]);

$recipePicture = null;
if ($input['picture'] && !empty($input['picture']['name']) && $input['picture']['error'] === UPLOAD_ERR_OK) {
    $recipePicture = processRecipeImage(null, $input['picture'], $recipeId, "recipe");
}

$db = db();
$updateStmt = $db->prepare("UPDATE recipes SET image_base = :image_base WHERE id = :id");
$updateStmt->execute([
    ':image_base' => $recipePicture,
    ':id' => $recipeId
]);