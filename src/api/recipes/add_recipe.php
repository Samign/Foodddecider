<?php

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/require_login.php';
require_once __DIR__ . '/../../includes/upload_image.php';
require_once __DIR__ . '/../../includes/recipe_adder.php';
require_once __DIR__ . '/../../includes/helpers/recipe_helper.php';

$input = fetchRecipeInput();

$recipePicture = null;
if ($input['picture'] && !empty($input['picture']['name']) && $input['picture']['error'] === UPLOAD_ERR_OK) {
    $recipePicture = processRecipeImage(null, $input['picture'], null, "recipe");
}

// $tags = json_decode($input['tags'] ?? '[]', true);
//     'tags' => $tags,

addRecipe([
    'name' => $input['name'],
    'description' => $input['description'],
    'link' => $input['link'],
    'public' => $input['public'],
    'course' => $input['course'],
    'prep' => $input['prep'],
    'cook' => $input['cook'],
    'picture' => $recipePicture,
    'servings' => $input['servings'],
    'steps' => $input['steps'],
    'ingredients' => $input['ingredients'],
    'forked_from_recipe_id' => $input['forked_from_recipe_id'] ?? null
]);