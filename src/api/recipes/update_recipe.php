<?php
require_once __DIR__ . '/../../includes/json_response.php';   // JSON content type (see the file)
require_once __DIR__ . '/../../includes/require_login.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/upload_image.php';
require_once __DIR__ . '/../../includes/helpers/recipe_helper.php';

$recipe_id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);

if (!$recipe_id) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid recipe ID']);
    exit;
}

$db = db();
$user_id = $_SESSION['user_id'];

// Verify recipe exists and belongs to the current user
$stmt = $db->prepare("SELECT owner_id, image_base FROM recipes WHERE id = :recipe_id");
$stmt->bindValue(':recipe_id', $recipe_id, PDO::PARAM_INT);
$stmt->execute();
$recipe = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$recipe) {
    http_response_code(404);
    echo json_encode(['error' => 'Recipe not found']);
    exit;
}

if ($recipe['owner_id'] != $user_id) {
    http_response_code(403);
    echo json_encode(['error' => 'You do not have permission to update this recipe']);
    exit;
}

$input = fetchRecipeInput();

if ($tooLarge = requestTooLargeMessage()) {   // every field arrived empty: nothing to save
    http_response_code(413);
    echo json_encode(['success' => false, 'field' => 'picture', 'error' => $tooLarge]);
    exit;
}

// A photo that can't be used never blocks the save: keep the old photo and say why
$photoError = checkImageUpload($input['picture']);
if ($photoError) {
    $input['picture'] = null;
}

// Was saved as "recipe_.webp" (no id), so every edited recipe shared, and overwrote, one picture
$recipePicture = processRecipeImage(null, $input['picture'], $recipe_id, "recipe");

$db->beginTransaction();

try {
    $imageClause = $recipePicture !== null ? ', image_base = :image_base' : '';

    $stmt = $db->prepare("
        UPDATE recipes SET
            title                = :title,
            description          = :description,
            link                 = :link,
            is_public            = :is_public,
            course_types         = :course_types,
            prep_time_minutes    = :prep_time,
            cook_time_minutes    = :cook_time,
            servings             = :servings,
            source_id            = :source_id
            $imageClause
        WHERE id = :recipe_id
    ");

    $params = [
        ':title'        => $input['name'],
        ':description'  => $input['description'],
        ':link'         => $input['link'],
        ':is_public'    => $input['public'],
        ':course_types' => $input['course'],
        ':prep_time'    => $input['prep'],
        ':cook_time'    => $input['cook'],
        ':servings'     => $input['servings'],
        ':source_id'    => $input['source_id'] ?? null,
        ':recipe_id'    => $recipe_id,
    ];
    if ($recipePicture !== null) {
        $params[':image_base'] = $recipePicture;
    }

    $stmt->execute($params);

    if (isset($input['tags'])) {
        saveTags($db, $recipe_id, $input['tags']);
    }

    // fetchRecipeInput() names these 'steps' / 'ingredients' (the form's step_sections / ingredient_sections)
    if (isset($input['steps'])) {
        saveStepSections($db, $recipe_id, $input['steps']);
    }

    if (isset($input['ingredients'])) {
        saveIngredientSections($db, $recipe_id, $input['ingredients']);
    }

    $db->commit();

    if ($recipePicture !== null) {
        deleteImageFiles('recipe', $recipe['image_base']);   // the old picture is no longer used
    }

    $warning = null;
    if ($photoError) {
        $warning = "Changes saved, but not the new photo. $photoError";
    } elseif (photoWasSent($input['picture']) && $recipePicture === null) {
        $warning = 'Changes saved, but the new photo could not be processed. The old photo is still used.';
    }
    echo json_encode(['success' => true, 'warning' => $warning]);

} catch (Throwable $e) {
    $db->rollback();
    deleteImageFiles('recipe', $recipePicture);              // the new picture never got saved
    error_log('Update recipe failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update recipe']);
}