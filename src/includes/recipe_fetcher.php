<?php
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

function getRecipeById(
    $id = null, 
    $ingredients_filter = [], 
    $attributes_filter = [], 
    $action = null, 
    $course_type = null, 
    $time = null, 
    $include_cook_time = null, 
    $public = '0', 
    $sort_mode = null, 
    $category = null, 
    $order_by = null, 
    $search_query = null,
    $limit = 20,
    $offset = 0,
    $owner = null,
    ) {

    if (!$owner) {
        $owner = $_SESSION['user_id'] ?? null;
    }
    $db = db();
    
    $sql = "
        SELECT 
            r.id,
            r.owner_id,
            r.title,
            r.description,
            r.link,
            r.prep_time_minutes,
            r.total_time_minutes,
            r.course_types,
            r.view_count,
            r.created_at,
            r.image_base,
            r.servings,
        
            COALESCE(saves.saves, 0) AS saves,
            COALESCE(user_saved.is_saved, false) AS is_saved,
            (:user = r.owner_id) AS is_owner,
            u.username AS owner_username,
            u.image_base AS owner_image,
        
            COALESCE(attr.attributes, '[]'::json) AS attributes,
            COALESCE(steps.recipe_steps, '[]'::json) AS recipe_steps,
            COALESCE(ingredients.recipe_ingredients, '[]'::json) AS recipe_ingredients,
            COALESCE(macros.ingredient_macros, '[]'::json) AS ingredient_macros,

            CASE 
                WHEN COALESCE(:search_query, '') <> ''
                THEN ts_rank(r.search_vector, plainto_tsquery('english', :search_query))
                ELSE 0
            END AS rank

        FROM recipes r
        
        LEFT JOIN users u 
            ON r.owner_id = u.id
        
        LEFT JOIN saved_recipes sr 
            ON r.id = sr.recipe_id
        
        -- attributes
        LEFT JOIN LATERAL (
            SELECT json_agg(
                json_build_object(
                    'id', a.id,
                    'name', a.name
                )
                ORDER BY a.name
            ) AS attributes
            FROM recipe_attributes ra
            JOIN attributes a ON ra.attribute_id = a.id
            WHERE ra.recipe_id = r.id
        ) attr ON true
        
        -- steps
        LEFT JOIN LATERAL (
            SELECT json_agg(
                json_build_object(
                    'id', rs.id,
                    'step_number', rs.step_number,
                    'content', rs.content
                )
                ORDER BY rs.step_number
            ) AS recipe_steps
            FROM recipe_steps rs
            WHERE rs.recipe_id = r.id
        ) steps ON true
        
        -- ingredients
        LEFT JOIN LATERAL (
            SELECT json_agg(
                json_build_object(
                    'id', ri.id,
                    'name', ri.ingredient_name,
                    'amount', ri.amount,
                    'unit', ri.unit
                )
                ORDER BY ri.id
            ) AS recipe_ingredients
            FROM recipe_ingredients ri
            WHERE ri.recipe_id = r.id
        ) ingredients ON true 

        -- macros
        LEFT JOIN LATERAL (
            SELECT json_agg(
                json_build_object(
                    'ingredient_name', ri.ingredient_name,
                    'amount', ri.amount,
                    'unit', ri.unit,
                    'calories_per_100g', i.energy_kcal,
                    'protein_per_100g', i.protein_g,
                    'carbs_per_100g', i.carbs_g,
                    'fat_per_100g', i.fat_g,
                    'fiber_per_100g', i.fiber_g,
                    'grams_per_ml', iu.grams_per_ml,
                    'grams_per_piece', iu.grams_per_piece
                )
            ) AS ingredient_macros
            FROM recipe_ingredients ri
            LEFT JOIN ingredients i ON ri.ingredient_id = i.id
            LEFT JOIN ingredient_densities iu ON ri.ingredient_id = iu.id
            WHERE ri.recipe_id = r.id
        ) macros ON true

        -- saves
        LEFT JOIN LATERAL (
            SELECT COUNT(DISTINCT sr.user_id) AS saves
            FROM saved_recipes sr
            WHERE sr.recipe_id = r.id
        ) saves ON true
        
        LEFT JOIN LATERAL (
            SELECT EXISTS(
            SELECT 1 FROM saved_recipes sr
            WHERE sr.recipe_id = r.id AND sr.user_id = :user
            ) AS is_saved
        ) user_saved ON true

        WHERE 1=1 
    ";
    
    // Public or not
    if ($public == '1') {
        $sql .= " AND r.is_public = '1' ";
    }

    if ($category == 'favorites') {
        $sql .= " AND EXISTS (SELECT 1 FROM recipe_views rv WHERE rv.recipe_id = r.id AND rv.user_id = :owner_id) ";
    } elseif ($category == 'saved') {
        $sql .= " AND sr.user_id = :owner_id ";
    } elseif ($category === 'following') {
        $sql .= " AND r.owner_id IN (SELECT followed_id FROM followers WHERE follower_id = :owner_id) ";
    } elseif ($public !== '1' && !$id) {
        $sql .= " AND (r.owner_id = :owner_id) ";
    }

    // Search query
    if ($search_query) {
        $sql .= "
        AND (
            r.search_vector @@ plainto_tsquery('english', :search_query)
            OR r.title % :search_query
            OR r.description % :search_query
            OR EXISTS (
                SELECT 1 FROM recipe_ingredients ri
                WHERE ri.recipe_id = r.id AND ri.ingredient_name % :search_query
            )";
    }

    // Recipe ID
    if ($id) {
        $sql .= " AND r.id = :initial_recipe_id ";
    }

    // Ingredients
    if (!empty($ingredients_filter)) {
        $sql .= " AND r.id IN (
            SELECT ri.recipe_id FROM recipe_ingredients ri
            WHERE LOWER(ri.ingredient_name) = ANY(:ingredients)
            GROUP BY ri.recipe_id
            HAVING COUNT(DISTINCT ri.ingredient_name) >= 1
        ) ";
    }

    // Macro nutrients - join with ingredients table to filter by available nutrition data
    if (!empty($ingredients_filter)) {
        $sql .= " AND EXISTS (
            SELECT 1 FROM recipe_ingredients ri
            JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE ri.recipe_id = r.id
            AND i.energy_kcal IS NOT NULL
        ) ";
    }

    // Attributes
    if (!empty($attributes_filter)) {
        $sql .= " AND r.id IN (
            SELECT recipe_id FROM recipe_attributes
            WHERE attribute_id = ANY(:attributes)
            HAVING COUNT(DISTINCT attribute_id) >= 1
        ) ";
    }

    // Course type
    if ($course_type) {
        $sql .= " AND r.course_type = :course_type ";
    }

    // Time filter
    if ($time !== null && $time !== '') {
        if ($include_cook_time) {
            $sql .= " AND r.total_time_minutes = :recipe_time ";
        } else {
            $sql .= " AND r.prep_time_minutes  = :recipe_time ";
        }
    }


    // Grouping
    // $sql .= " GROUP BY r.id, u.username";

    // Sorting
    // Optimisation if database becomes huge is to use TABLESAMPLE SYSTEM (1) (this grabs 1% of rows randomly)
    if ($action == 'random') {
        $sql .= " ORDER BY RANDOM() LIMIT 1";
    } else {

        // Order functioanlity
            if ($order_by == 'prep_time') {
                $sql .= " ORDER BY r.prep_time_minutes";
            } elseif ($order_by == 'total_time') {
                $sql .= " ORDER BY r.total_time_minutes";
            } elseif ($order_by == 'popularity') {
                $sql .= " ORDER BY saves DESC";
            } elseif ($order_by == 'creation_date_desc') {
                $sql .= " ORDER BY r.created_at DESC";
            } elseif ($order_by == 'creation_date_asc') {
                $sql .= " ORDER BY r.created_at ASC";
            } elseif ($order_by == 'title_desc') {
                $sql .= " ORDER BY r.title DESC";
            } elseif ($order_by == 'title_asc') {
                $sql .= " ORDER BY r.title ASC";
            } elseif ($order_by == 'views') {
                $sql .= " ORDER BY r.view_count DESC";
            } elseif ($order_by === 'most_viewed_by_user') {
                $sql .= " ORDER BY (SELECT COUNT(*) FROM recipe_views rv WHERE rv.recipe_id = r.id AND rv.user_id = :owner_id) DESC";
            } else {
                $sql .= " ORDER BY rank DESC, r.title ASC";
            }
        $sql .= " LIMIT :limit OFFSET :offset";
    }

    // echo "SQL Query: " . $sql . "\n"; // Debugging line to check the final SQL query
    
    $stmt = $db->prepare($sql);

    $stmt->bindValue(':search_query', $search_query, PDO::PARAM_STR);
    
    $stmt->bindValue(':user', $_SESSION['user_id'] ?? null);

    if (($public !== '1' or $category === 'favorites' or $category === 'saved') && !$id) {
        $stmt->bindValue(':owner_id', $owner);
    }
    
    if ($id) {
        $stmt->bindValue(':initial_recipe_id', $id, PDO::PARAM_INT);
    }
    
    if (!empty($ingredients_filter)) {
        $ingredients_filter = array_map('strtolower', $ingredients_filter);
        $stmt->bindValue(':ingredients', '{' . implode(',', $ingredients_filter) . '}');
    }

    if ($course_type) {
        $stmt->bindValue(':course_type', $course_type);
    }

    if ($time !== null && $time !== '') {
        $stmt->bindValue(':recipe_time', $time);
    }
    
    if (!empty($attributes_filter)) {
        $stmt->bindValue(':attributes', '{' . implode(',', $attributes_filter) . '}');
    }

    if ($action !== 'random') {
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    }
    
    // Do I even have any post request to this api? TODO check delete
    $fetchRequest = $_SERVER['REQUEST_METHOD'] === 'POST';
    $stmt->execute();
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if ($fetchRequest) {
        echo json_encode($result);
        exit;
    } else {
        return $result;
    }
}

?>