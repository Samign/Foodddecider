<?php
require_once __DIR__ . '/../../includes/require_login.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/upload_image.php';
require_once __DIR__ . '/../../includes/match_ingredient.php';
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
$stmt = $db->prepare("SELECT owner_id FROM recipes WHERE id = :recipe_id");
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

$recipePicture = null;
if ($input['picture'] && !empty($input['picture']['name']) && $input['picture']['error'] === UPLOAD_ERR_OK) {
    $recipePicture = processRecipeImage(null, $input['picture'], null, "recipe");
}

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

    if (isset($input['step_sections'])) {
        saveStepSections($db, $recipe_id, $input['step_sections']);
    }

    if (isset($input['ingredient_sections'])) {
        saveIngredientSections($db, $recipe_id, $input['ingredient_sections']);
    }

    $db->commit();

    echo json_encode(['success' => true]);

} catch (Throwable $e) {
    $db->rollback();
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update recipe: ' . $e->getMessage()]);
}
?>