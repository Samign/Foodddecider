<?php 
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/helpers/recipe_helper.php';

function addRecipe($recipeData) {
    
    $db = db();

    $db->beginTransaction();

    try {

        $stmt = $db->prepare("
            INSERT INTO recipes 
            (title, owner_id, description, link, is_public, course_types, prep_time_minutes, cook_time_minutes, image_base, servings, source_id, forked_from_recipe_id) 
            values(:title, :owner_id, :description, :link, :is_public, :course_types, :prep_time, :cook_time, :image_base, :servings, :source_id, :forked_from_recipe_id)
            RETURNING id
        ");

        $source_key = extractSourceKey($recipeData['link'] ?? '');

        $source_stmt = $db->prepare("SELECT id FROM sources WHERE slug = :slug");
        $source_stmt->execute([':slug' => $source_key]);
        $source_id = $source_stmt->fetchColumn();

        if ($source_id === false || $source_id === null) {
            $insert_source_stmt = $db->prepare("INSERT INTO sources (slug, display_name) VALUES (:slug, :display_name) RETURNING id");
            $insert_source_stmt->execute([':slug' => $source_key, ':display_name' => ucfirst($source_key)]);
            $source_id = $insert_source_stmt->fetchColumn();
        }

        $stmt->execute([
            ':title' => $recipeData['name'] ?? 'Untitled Recipe',
            ':owner_id' => $_SESSION['user_id'],
            ':description' => $recipeData['description'] ?? null,
            ':link' => $recipeData['link'] ?? null,
            ':is_public' => $recipeData['public'] ?? '0',
            ':course_types' => $recipeData['course'] ?? '4',
            ':prep_time' => $recipeData['prep'] ?? '10',
            ':cook_time' => $recipeData['cook'] ?? '30',
            ':image_base' => $recipeData['picture'] ?? null,
            ':source_id' => $source_id,
            ':servings' => $recipeData['servings'] ?? null,
            ':forked_from_recipe_id' => $recipeData['forked_from_recipe_id'] ?? null
        ]);

        $recipeId = $stmt->fetchColumn();

        if (!empty($recipeData['tags'])) {
            saveTags($db, $recipeId, $recipeData['tags']);
        }

        if (!empty($recipeData['step_sections'])) {
            saveStepSections($db, $recipeId, $recipeData['step_sections']);
        }
        
        if (!empty($recipeData['ingredient_sections'])) {
            saveIngredientSections($db, $recipeId, $recipeData['ingredient_sections']);
        }

        $db->commit();

        return $recipeId;

    } catch (throwable $e) {
        $db->rollback();
        http_response_code(500);
        echo json_encode(['error' => 'failed to create recipe' . $e]);
    }

}