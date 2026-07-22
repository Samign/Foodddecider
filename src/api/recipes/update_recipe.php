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

$tags = json_decode($input['tags'] ?? '[]', true);

$db->beginTransaction();

try {
    // Build the UPDATE query dynamically so image_base is only overwritten when a new image was uploaded
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
            servings             = :servings
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
        ':recipe_id'    => $recipe_id,
    ];
    if ($recipePicture !== null) {
        $params[':image_base'] = $recipePicture;
    }

    $stmt->execute($params);

    if (isset($input['tags'])) {
        $db->prepare("DELETE FROM recipe_tags WHERE recipe_id = :recipe_id")
           ->execute([':recipe_id' => $recipe_id]);
        $stmt = $db->prepare("
            INSERT INTO recipe_tags (recipe_id, tag_id)
            VALUES (:recipe_id, :tag_id)
            ON CONFLICT DO NOTHING
        ");
        foreach ($tags as $tagId) {
            $stmt->execute([':recipe_id' => $recipe_id, ':tag_id' => $tagId]);
        }
    }

    if (isset($input['steps'])) {
        $db->prepare("DELETE FROM recipe_steps WHERE recipe_id = :recipe_id")
           ->execute([':recipe_id' => $recipe_id]);
        if (!empty($steps)) {
            $stmt = $db->prepare("
                INSERT INTO recipe_steps (recipe_id, step_number, content)
                VALUES (:recipe_id, :step_number, :content)
            ");
            foreach ($steps as $index => $step) {
                if (trim($step) === '') continue;
                $stmt->execute([
                    ':recipe_id'   => $recipe_id,
                    ':step_number' => $index + 1,
                    ':content'     => $step,
                ]);
            }
        }
    }

    if (isset($input['ingredients'])) {
        $db->prepare("DELETE FROM recipe_ingredients WHERE recipe_id = :recipe_id")
           ->execute([':recipe_id' => $recipe_id]);
        $stmt = $db->prepare("
            INSERT INTO recipe_ingredients 
            (recipe_id, ingredient_name, ingredient_id, amount, unit, position, raw_input, is_soft)
            VALUES (:recipe_id, :ingredient_name, :ingredient_id, :amount, :unit, :position, :raw_input, :is_soft)
        ");

        foreach ($ingredients as $index => $ingredient) {
            $name           = $ingredient['ingredient'] ?? '';
            $raw            = $ingredient['raw'] ?? '';
            $amount         = (isset($ingredient['amount']) && $ingredient['amount'] !== '') ? $ingredient['amount'] : null;
            $unit           = (isset($ingredient['unit']) && $ingredient['unit'] !== '') ? $ingredient['unit'] : null;
            $isSoft         = !empty($ingredient['soft']) ? '1' : '0';

            $match          = match_ingredient($db, $name);
            $ingredientId   = $match ? $match['id'] : null;
            $ingredientName = $match ? $match['name'] : $name;

            $stmt->bindValue(':recipe_id',        $recipe_id,      PDO::PARAM_INT);
            $stmt->bindValue(':ingredient_name',  $ingredientName, PDO::PARAM_STR);
            $stmt->bindValue(':ingredient_id',    $ingredientId,   $ingredientId !== null ? PDO::PARAM_INT : PDO::PARAM_NULL);
            $stmt->bindValue(':amount',           $amount,         $amount !== null ? PDO::PARAM_STR : PDO::PARAM_NULL);
            $stmt->bindValue(':unit',             $unit,           $unit !== null ? PDO::PARAM_STR : PDO::PARAM_NULL);
            $stmt->bindValue(':position',         $index + 1,      PDO::PARAM_INT);
            $stmt->bindValue(':raw_input',        $raw,            PDO::PARAM_STR);
            $stmt->bindValue(':is_soft',          $isSoft,         PDO::PARAM_STR);
            $stmt->execute();

            // Register new aliases discovered during matching
            if ($ingredientId && $ingredientName && $ingredientName !== normalizeName($name)) {
                $aliasStmt = $db->prepare("
                    INSERT INTO ingredient_aliases (ingredient_id, alias)
                    VALUES (:ingredient_id, :alias)
                    ON CONFLICT DO NOTHING
                ");
                $aliasStmt->execute([
                    ':ingredient_id' => $ingredientId,
                    ':alias'         => normalizeName($name),
                ]);
            }
        }
    }

    $db->commit();

    echo json_encode(['success' => true]);

} catch (Throwable $e) {
    $db->rollback();
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update recipe: ' . $e->getMessage()]);
}
?>