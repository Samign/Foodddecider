<?php 
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/match_ingredient.php';
require_once __DIR__ . '/session.php';

function addRecipe($recipeData) {
    
    $db = db();

    $db->beginTransaction();

    try {

        $stmt = $db->prepare("
            INSERT INTO recipes 
            (title, owner_id, description, link, is_public, course_types, prep_time_minutes, cook_time_minutes, image_base, servings) 
            values(:title, :owner_id, :description, :link, :is_public, :course_types, :prep_time, :cook_time, :image_base, :servings)
            RETURNING id
        ");

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
            ':servings' => $recipeData['servings'] ?? null
        ]);

        $recipeId = $stmt->fetchColumn();

        if (!empty($recipeData['attributes'])) {
            $stmt = $db->prepare("
                INSERT INTO recipe_attributes (recipe_id, attribute_id)
                VALUES (:recipe_id, :attribute_id)
                ON CONFLICT DO NOTHING
            ");

            foreach ($recipeData['attributes'] as $attributeId) {
                $stmt->execute([
                    ':recipe_id' => $recipeId,
                    ':attribute_id' => $attributeId
                ]);
            }
        }

        if (!empty($recipeData['step_sections'])) {
            $sectionStmt = $db->prepare("
                INSERT INTO step_sections (recipe_id, title, position)
                VALUES (:recipe_id, :title, :position)
                RETURNING id
            ");

            $stmt = $db->prepare("
                INSERT INTO recipe_steps (recipe_id, section_id, step_number, content)
                VALUES (:recipe_id, :section_id, :step_number, :content)
            ");

            $sectionPosition = 1;
            $globalStepNumber = 1;

            foreach ($recipeData['step_sections'] as $section) {

                $sectionStmt->execute([
                    ':recipe_id' => $recipeId,
                    ':title' => $section['title'] ?? null,
                    ':position' => $sectionPosition++
                ]);
                $sectionId = $sectionStmt->fetchColumn();

                if (!empty($section['steps']) && is_array($section['steps'])) {
                    foreach ($section['steps'] as $step) {
                        if (trim($step) === '') continue;

                        $stmt->execute([
                            ':recipe_id' => $recipeId,
                            ':section_id' => $sectionId,
                            ':step_number' => $globalStepNumber++,
                            ':content' => $step
                        ]);
                    }
                }
            }
        }
        
        if (!empty($recipeData['ingredient_sections'])) {

            $sectionStmt = $db->prepare("
                INSERT INTO ingredient_sections (recipe_id, title, position)
                VALUES (:recipe_id, :title, :position)
                RETURNING id
            ");

            $ingStmt = $db->prepare("
                INSERT INTO recipe_ingredients 
                (recipe_id, ingredient_name, ingredient_id, amount, unit, size, position, raw_input)
                VALUES (:recipe_id, :ingredient_name, :ingredient_id, :amount, :unit, :size, :position, :raw_input)
            ");

            $sectionPosition = 1;
            $globalIngPosition = 1;

            foreach ($recipeData['ingredient_sections'] as $section) {

                $sectionStmt->execute([
                    ':recipe_id' => $recipeId,
                    ':title' => $section['title'] ?? null,
                    ':position' => $sectionPosition++
                ]);
                $sectionId = $sectionStmt->fetchColumn();

                if (!empty($section['ingredients']) && is_array($section['ingredients'])) {
                    foreach ($section['ingredients'] as $ingredient) {
                        if (is_string($ingredient)) {
                            $raw = trim($ingredient);
                            if ($raw === '') continue;
                            $amount =null; $unit = null; $size = null; $name = $raw;
                        } else {
                            $raw = $ingredient['raw'] ?? '';
                            if (trim($raw) === '') continue;

                            preg_match('/[\d.]+/', $ingredient['amount'] ?? '', $amountMatch);
                            $amount = !empty($amountMatch[0]) ? $amountMatch[0] : null;
                            $unit = $ingredient['unit'] ?? null;
                            $size = $ingredient['size'] ?? null;
                            $name = $ingredient['ingredient'] ?? $raw;
                        }

                        $match = match_ingredient($db, $name);
                        $ingredientId = $match ? $match['id'] : null;
                        $ingredientName = $match ? $match['name'] : $name;

                        $ingStmt->execute([
                            ':recipe_id' => $recipeId,
                            ':section_id' => $sectionId,
                            ':ingredient_name' => $ingredientName,
                            ':ingredient_id' => $ingredientId,
                            ':amount' => $amount,
                            ':unit' => $unit,
                            ':size' => $size,
                            ':position' => $globalIngPosition++,
                            ':raw_input' => $raw
                        ]);
                    }
                }
            }
        }

        $db->commit();

        return $recipeId;

    } catch (throwable $e) {
        $db->rollback();
        http_response_code(500);
        echo json_encode(['error' => 'failed to create recipe' . $e]);
    }

}

?>