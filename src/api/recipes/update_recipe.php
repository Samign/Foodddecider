<?php
require_once __DIR__ . '/../../includes/require_login.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/upload_image.php';

function normalizeName($name) {
    $name = strtolower($name);
    $name = preg_replace('/[^a-z0-9]+/', '-', $name);
    $name = preg_replace('/\b(of|fresh|chopped|diced|sliced|minced|grated|large|small|medium|extra large|extra small)\b/', '', $name);
    $name = preg_replace('/\s+/', ' ', $name);
    return trim($name);
}

function match_ingredient($db, $ingredient) {
    $normalized = normalizeName($ingredient);

    // Exact match
    $stmt = $db->prepare("
        SELECT id 
        FROM ingredients 
        WHERE name = :name
        LIMIT 1
    ");
    $stmt->execute([':name' => $normalized]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($result) {
        return ['id' => $result['id'], 'name' => $normalized];
    }

    // Alias exact match
    $stmt = $db->prepare("
        SELECT ingredient_id
        FROM ingredient_aliases
        WHERE alias = :name
        LIMIT 1
    ");
    $stmt->execute([':name' => $normalized]);
    $aliasResult = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($aliasResult) {
        return ['id' => $aliasResult['ingredient_id'], 'name' => $normalized];
    }

    // Fuzzy match on ingredients
    $stmt = $db->prepare("
        SELECT id, name, similarity(name, :name) AS score 
        FROM ingredients 
        WHERE name % :name
        ORDER BY score DESC
        LIMIT 1
    ");
    $stmt->execute([':name' => $normalized]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($result && $result['score'] > 0.4) {
        return ['id' => $result['id'], 'name' => $result['name']];
    }

    // Fuzzy match on aliases
    $stmt = $db->prepare("
        SELECT ingredient_id, similarity(alias, :name) AS score
        FROM ingredient_aliases
        WHERE alias % :name
        ORDER BY score DESC
        LIMIT 1
    ");
    $stmt->execute([':name' => $normalized]);
    $aliasResult = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($aliasResult && $aliasResult['score'] > 0.4) {
        return ['id' => $aliasResult['ingredient_id'], 'name' => $aliasResult['name']];
    }

    return null;
}

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

$title       = $_POST['name'] ?? '';
$description = $_POST['description'] ?? '';
$link        = $_POST['link'] ?? '';
$ingredientsRaw = $_POST['ingredients'] ?? '[]';
$ingredients = is_string($ingredientsRaw) ? json_decode($ingredientsRaw, true) : $ingredientsRaw;
$steps       = $_POST['steps'] ?? [];
$public      = $_POST['public'] ?? '0';
$course      = $_POST['course'] ?? '4';
$prep        = $_POST['prep'] ?? '10';
$cook        = $_POST['cook'] ?? '30';
$picture     = $_FILES['picture'] ?? null;
$servings    = $_POST['servings'] ?? null;

$recipePicture = null;
if ($picture && !empty($picture['name']) && $picture['error'] === UPLOAD_ERR_OK) {
    $recipePicture = uploadImage($_FILES['picture'], __DIR__ . '/../../uploads/recipe_pictures/', [300, 600], "recipe");
}

$attributes = json_decode($_POST['attributes'] ?? '[]', true);

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
        ':title'        => $title,
        ':description'  => $description,
        ':link'         => $link,
        ':is_public'    => $public,
        ':course_types' => $course,
        ':prep_time'    => $prep,
        ':cook_time'    => $cook,
        ':servings'     => $servings,
        ':recipe_id'    => $recipe_id,
    ];
    if ($recipePicture !== null) {
        $params[':image_base'] = $recipePicture;
    }

    $stmt->execute($params);

    // Replace attributes — only if attributes were actually submitted
    if (isset($_POST['attributes'])) {
        $db->prepare("DELETE FROM recipe_attributes WHERE recipe_id = :recipe_id")
           ->execute([':recipe_id' => $recipe_id]);
        $stmt = $db->prepare("
            INSERT INTO recipe_attributes (recipe_id, attribute_id)
            VALUES (:recipe_id, :attribute_id)
            ON CONFLICT DO NOTHING
        ");
        foreach ($attributes as $attributeId) {
            $stmt->execute([':recipe_id' => $recipe_id, ':attribute_id' => $attributeId]);
        }
    }

    // Replace steps — only if steps were actually submitted
    if (!empty($steps)) {
        $db->prepare("DELETE FROM recipe_steps WHERE recipe_id = :recipe_id")
           ->execute([':recipe_id' => $recipe_id]);
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

    // Replace ingredients — only if ingredients were actually submitted
    if (!empty($ingredients)) {
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