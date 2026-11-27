<?php
require_once __DIR__ . '/../../includes/json_response.php';   // JSON content type (see the file)

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/require_login.php';
require_once __DIR__ . '/../../includes/upload_image.php';
require_once __DIR__ . '/../../includes/recipe_adder.php';
require_once __DIR__ . '/../../includes/helpers/recipe_helper.php';

$input = fetchRecipeInput();

/** The recipe being forked, if it exists and this user may see it (otherwise no link is stored). */
function forkableRecipeId($id): ?int {
    $id = filter_var($id, FILTER_VALIDATE_INT);
    if (!$id) return null;
    $stmt = db()->prepare("SELECT id FROM recipes WHERE id = :id AND (is_public = '1' OR owner_id = :user)");
    $stmt->execute([':id' => $id, ':user' => $_SESSION['user_id']]);
    return $stmt->fetchColumn() ? $id : null;
}

// Too big for PHP: every field arrived empty, so there is nothing to save. Say why.
if ($tooLarge = requestTooLargeMessage()) {
    http_response_code(413);
    echo json_encode(['success' => false, 'field' => 'picture', 'error' => $tooLarge]);
    exit;
}

// A photo that can't be used never blocks the recipe: save without it and say why.
// (The browser normally refuses it when it's chosen, see assets/photo-check.js.)
$photoError = checkImageUpload($input['picture']);
if ($photoError) {
    $input['picture'] = null;
}


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
    'forked_from_recipe_id' => forkableRecipeId($input['forked_from_recipe_id'] ?? null),
    'tags' => $input['tags'] ?? []
]);

if (!$recipeId) {
    exit;   // addRecipe() already sent a 500 with the error
}

// processRecipeImage() checks the upload itself (error code, size, real image type)
$recipePicture = processRecipeImage(null, $input['picture'], $recipeId, "recipe");
if ($recipePicture) {
    db()->prepare("UPDATE recipes SET image_base = :image_base WHERE id = :id")
        ->execute([':image_base' => $recipePicture, ':id' => $recipeId]);
}

// Tell the person when their photo wasn't used, instead of quietly saving without it
$warning = null;
if ($photoError) {
    $warning = "Recipe saved without a photo. $photoError";
} elseif (photoWasSent($input['picture']) && !$recipePicture) {
    $warning = 'Recipe saved without a photo: it could not be processed. Edit the recipe to try another one.';
}

echo json_encode(['success' => true, 'recipe_id' => $recipeId, 'warning' => $warning]);