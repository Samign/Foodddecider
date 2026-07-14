<?php

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/require_login.php';
require_once __DIR__ . '/../../includes/upload_image.php';
require_once __DIR__ . '/../../includes/recipe_adder.php';


$name = $_POST['name'] ?? '';
$description = $_POST['description'] ?? '';
$link = $_POST['link'] ?? '';
$ingredients = $_POST['ingredients'] ?? [];
$public = $_POST['public'] ?? '0';
$course = $_POST['course'] ?? '4';
$prep = $_POST['prep'] ?? '10';
$cook = $_POST['cook'] ?? '30';
$picture = $_FILES['picture'] ?? null;
$servings = $_POST['servings'] ?? null;
$steps = $_POST['step_sections'] ?? [];
$ingredients = $_POST['ingredient_sections'] ?? [];

$recipePicture = null;
if ($picture && !empty($picture['name']) && $picture['error'] === UPLOAD_ERR_OK) {
    $recipePicture = processRecipeImage(null, $_FILES['picture'], null, "recipe");
}

$attributes = json_decode($_POST['attributes'] ?? '[]', true);

addRecipe([
    'name' => $name,
    'description' => $description,
    'link' => $link,
    'public' => $public,
    'course' => $course,
    'prep' => $prep,
    'cook' => $cook,
    'picture' => $recipePicture,
    'servings' => $servings,
    'attributes' => $attributes,
    'steps' => $steps,
    'ingredients' => $ingredients
]);

?>