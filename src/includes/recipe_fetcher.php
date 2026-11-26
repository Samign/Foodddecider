<?php
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/user_fetcher.php';
require_once __DIR__ . '/helpers/recipe_helper.php';

function pgArrayLiteral(array $values): string {
    $escaped = array_map(
        fn($v) => '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], (string)$v) . '"',
        $values
    );
    return '{' . implode(',', $escaped) . '}';
}

function getRecipe($id): ?array {
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
            EXISTS (
                SELECT 1 FROM saved_recipes s
                WHERE s.recipe_id = r.id AND s.user_id = :user
            ) AS is_saved,
            COALESCE(r.owner_id = :user, false) AS is_owner,
            u.username AS owner_username,
            u.image_base AS owner_image,
 
            COALESCE(steps.recipe_steps, '[]'::json) AS recipe_steps,
            COALESCE(ingredients.recipe_ingredients, '[]'::json) AS recipe_ingredients,
            COALESCE(macros.ingredient_macros, '[]'::json) AS ingredient_macros,
            COALESCE(step_sec.sections, '[]'::json) AS recipe_step_sections,
            COALESCE(ing_sec.sections, '[]'::json) AS recipe_ingredient_sections,
            COALESCE(tags.recipe_tags, '[]'::json) AS recipe_tags
 
        FROM recipes r
 
        LEFT JOIN users u
            ON r.owner_id = u.id
 
        -- steps
        LEFT JOIN LATERAL (
            SELECT json_agg(
                json_build_object(
                    'id', rs.id,
                    'step_number', rs.step_number,
                    'content', rs.content,
                    'section_id', rs.section_id
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
                    'unit', ri.unit,
                    'section_id', ri.section_id
                )
                ORDER BY ri.id
            ) AS recipe_ingredients
            FROM recipe_ingredients ri
            WHERE ri.recipe_id = r.id
        ) ingredients ON true

        -- step sections
        LEFT JOIN LATERAL (
            SELECT json_agg(
                json_build_object('id', ss.id, 'name', ss.title)
                ORDER BY ss.position
            ) AS sections
            FROM step_sections ss
            WHERE ss.recipe_id = r.id
        ) step_sec ON true

        -- ingredient sections
        LEFT JOIN LATERAL (
            SELECT json_agg(
                json_build_object('id', isec.id, 'name', isec.title)
                ORDER BY isec.position
            ) AS sections
            FROM ingredient_sections isec
            WHERE isec.recipe_id = r.id
        ) ing_sec ON true
 
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
                ORDER BY ri.id
            ) AS ingredient_macros
            FROM recipe_ingredients ri
            LEFT JOIN ingredients i ON ri.ingredient_id = i.id
            LEFT JOIN ingredient_densities iu ON ri.ingredient_id = iu.id
            WHERE ri.recipe_id = r.id
        ) macros ON true
 
        -- saves count
        LEFT JOIN LATERAL (
            SELECT COUNT(DISTINCT s.user_id) AS saves
            FROM saved_recipes s
            WHERE s.recipe_id = r.id
        ) saves ON true

        -- tags
        LEFT JOIN LATERAL (
            SELECT json_agg(
                json_build_object(
                    'id', t.id,
                    'name', t.name,
                    'slug', t.slug
                )
                ORDER BY t.name
            ) AS recipe_tags
            FROM recipe_tags rt
            JOIN tags t ON t.id = rt.tag_id
            WHERE rt.recipe_id = r.id
        ) tags ON true
 
        WHERE r.id = :id
          AND (r.is_public = '1' OR r.owner_id = :user)
    ";
 
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':id', (int)$id, PDO::PARAM_INT);
    $stmt->bindValue(':user', $_SESSION['user_id'] ?? null);
    $stmt->execute();
 
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function getRecipeCards(array $opts = []): array {
    $opts += [
        'ingredients_filter' => [],
        'tags_filter'        => [],
        'action'             => null,   // 'random' => one random recipe
        'course_types'      => [],
        'ingredients_match' => 'all',
        'time'               => null,
        'include_cook_time'  => null,
        'public'             => '0',
        'category'           => null,   // favorites | saved | following | all
        'exclude_id'         => null,   // skip one recipe (random: "Another one")
        'order_by'           => null,
        'search_query'       => null,
        'limit'              => 20,
        'offset'             => 0,
        'owner'              => null,   // whose recipes to list (defaults to current user)
        'username'           => null,
        'min_kcal'           => null,
        'max_kcal'           => null,
        'min_protein'        => null,
        'max_protein'        => null
    ];
 
    $db       = db();
    $viewer   = $_SESSION['user_id'] ?? null;
    $owner    = $opts['owner'] ?? $viewer;
    $public   = ((string)$opts['public'] === '1');
    $category = $opts['category'];
    $search   = trim((string)($opts['search_query'] ?? ''));

    $ownerExplicit = false;

    $username = $opts['username'] ?? null;
    if ($username) {
        $ownerInfo = grabUserInfo(null, $username);
        if ($ownerInfo) {
            $owner = $ownerInfo['id'];
            $ownerExplicit = true;
        } else {
            return []; // User not found, return empty array
        }
    }
 
    // Looking at someone else's recipes: they only ever get the public ones.
    if ($owner !== null && (string)$owner !== (string)$viewer) {
        if ($category !== null) {
            return [];
        }
        $public = true;
    }
 
    // These views are scoped to a user, and there isn't one.
    if ($owner === null && ($category !== null || !$public)) {
        return [];
    }
 
    $where  = [];
    $params = [':user' => $viewer];
 
    // Visibility / category
    if ($public) {
        $where[] = "r.is_public = '1'";
    }
 
    if ($category === 'favorites') {
        $where[] = "EXISTS (SELECT 1 FROM recipe_views rv WHERE rv.recipe_id = r.id AND rv.user_id = :owner_id)";
    } elseif ($category === 'saved') {
        $where[] = "EXISTS (SELECT 1 FROM saved_recipes sv WHERE sv.recipe_id = r.id AND sv.user_id = :owner_id)";
    } elseif ($category === 'following') {
        $where[] = "r.owner_id IN (SELECT followed_id FROM followers WHERE follower_id = :owner_id)";
    } elseif ($category === 'all') {
        // "All": your own recipes plus everything public
        $where[] = "(r.owner_id = :owner_id OR r.is_public = '1')";
    } elseif (!$public || $ownerExplicit) {
        $where[] = "r.owner_id = :owner_id";
    }
 
    // Category lists can include other people's recipes: never show private ones.
    if ($category !== null && !$public) {
        $where[] = "(r.is_public = '1' OR r.owner_id = :user)";
    }
 
    // Search
    $rankSql = "0";
    if ($search !== '') {
        $where[] = "(
            r.search_vector @@ plainto_tsquery('english', :search_query)
            OR r.title % :search_query
            OR r.description % :search_query
            OR EXISTS (
                SELECT 1 FROM recipe_ingredients ri
                WHERE ri.recipe_id = r.id AND ri.ingredient_name % :search_query
            )
        )";
        $rankSql = "GREATEST(ts_rank(r.search_vector, plainto_tsquery('english', :search_query)), similarity(r.title, :search_query), similarity(r.description, :search_query))";
        $params[':search_query'] = $search;
    }
 
    // Course type
    $courseIds = array_values(array_unique(array_filter(array_map('intval', (array)$opts['course_types']))));
    if ($courseIds) {
        $where[] = "r.course_types = ANY(CAST(:course_ids AS int[]))";
        $params[':course_ids'] = '{' . implode(',', $courseIds) . '}';
    }
 
    // Time
    if ($opts['time'] !== null && $opts['time'] !== '') {
        $col = $opts['include_cook_time'] ? 'r.total_time_minutes' : 'r.prep_time_minutes';
        $where[] = "$col <= :recipe_time";
        $params[':recipe_time'] = (int)$opts['time'];
    }
 
    // Ingredients
    // Ingredients: partial, case-insensitive match; all or any
    $ingredients = [];
    foreach ((array)$opts['ingredients_filter'] as $ing) {
        $ing = trim((string)$ing);
        if ($ing !== '') $ingredients[mb_strtolower($ing)] = true;
    }
    $ingredients = array_slice(array_map('strval', array_keys($ingredients)), 0, 10);

    if ($ingredients) {
        $parts = [];
        foreach ($ingredients as $i => $ing) {
            $parts[] = "EXISTS (
                SELECT 1 FROM recipe_ingredients ri
                WHERE ri.recipe_id = r.id
                  AND ri.ingredient_name ILIKE '%' || :ing_$i || '%'
            )";
            $params[":ing_$i"] = addcslashes($ing, '%_\\');   // user input is literal, not a wildcard
        }
        $where[] = '(' . implode($opts['ingredients_match'] === 'any' ? ' OR ' : ' AND ', $parts) . ')';

        // "I have": how many of the chosen ingredients each recipe uses, and how many it needs in total
        $matchSql = implode(' + ', array_map(fn($p) => "($p)::int", $parts));
        $totalSql = "(SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id)";
    }

    if (is_numeric($opts['exclude_id'] ?? null)) {
        $where[] = "r.id <> :exclude_id";
        $params[':exclude_id'] = (int)$opts['exclude_id'];
    }

    // Tags: matched by slug, recipe must have every selected tag
    $tagSlugs = [];
    foreach ((array)$opts['tags_filter'] as $t) {
        $slug = slugify((string)$t);
        if ($slug !== '') $tagSlugs[$slug] = true;
    }
    $tagSlugs = array_keys($tagSlugs);

    if ($tagSlugs) {
        $where[] = "r.id IN (
            SELECT rt.recipe_id
            FROM recipe_tags rt
            JOIN tags t ON t.id = rt.tag_id
            WHERE t.slug = ANY(:tag_slugs)
            GROUP BY rt.recipe_id
            HAVING COUNT(DISTINCT t.slug) = :tag_count
        )";
        $params[':tag_slugs'] = pgArrayLiteral($tagSlugs);
        $params[':tag_count'] = count($tagSlugs);
    }

    // Macro ranges (per serving)
    $usesMacroFilter = false;
    $macroRanges = [
        'min_kcal'    => ['macros.kcal',    '>='],
        'max_kcal'    => ['macros.kcal',    '<='],
        'min_protein' => ['macros.protein', '>='],
        'max_protein' => ['macros.protein', '<='],
    ];
    
    foreach ([['min_kcal', 'max_kcal'], ['min_protein', 'max_protein']] as [$lo, $hi]) {
        if (is_numeric($opts[$lo] ?? null) && is_numeric($opts[$hi] ?? null)
            && (float)$opts[$lo] > (float)$opts[$hi]) {
            [$opts[$lo], $opts[$hi]] = [$opts[$hi], $opts[$lo]];
        }
    }

    foreach ($macroRanges as $key => [$col, $op]) {
        $v = $opts[$key] ?? null;
        if ($v === null || $v === '' || !is_numeric($v)) continue;
        $where[] = "$col $op CAST(:$key AS numeric)";
        $params[":$key"] = (string)max(0, min((float)$v, 100000));
        $usesMacroFilter = true;
    }
 
    // Sorting (whitelist)
    $orderBy = (string)($opts['order_by'] ?? '');
    if ($orderBy === 'most_viewed_by_user') $orderBy = 'go_to';      // legacy alias remove
    if ($orderBy === 'go_to' && $viewer === null) $orderBy = '';     // nothing to personalise

    // Sorting (whitelist)
    $orderMap = [
        'title_asc'     => 'r.title ASC',
        'title_desc'    => 'r.title DESC',
        'prep_time'     => 'r.prep_time_minutes ASC NULLS LAST',
        'total_time'    => 'r.total_time_minutes ASC NULLS LAST',
        'popular'       => 'saves DESC, r.view_count DESC',
        'views'         => 'r.view_count DESC',
        'go_to'         => 'mv.my_views DESC, mv.last_viewed DESC NULLS LAST',
        'calories_asc'  => 'macros.kcal ASC NULLS LAST',
        'calories_desc' => 'macros.kcal DESC NULLS LAST',
        'protein_desc'  => 'macros.protein DESC NULLS LAST',
        'protein_asc'   => 'macros.protein ASC NULLS LAST',
        'newest'        => 'r.created_at DESC',
        'oldest'        => 'r.created_at ASC',
    ];

    // With "I have" ingredients and no explicit sort: most matched first, then the recipes you're closest to completing
    $defaultOrder = isset($matchSql)
        ? "($matchSql) DESC, ($matchSql)::float / NULLIF($totalSql, 0) DESC, r.title ASC"
        : 'search_rank DESC, r.title ASC';

    $isRandom = ($opts['action'] === 'random');
    $orderSql = $isRandom
        ? 'RANDOM()'
        : ($orderMap[$orderBy] ?? $defaultOrder) . ', r.id';
    
    // Optional joins: only pay for them when the sort needs them
    $joins       = '';
    $macroSelect = '';

    if ($orderBy === 'go_to') {
        $joins .= "
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS my_views, MAX(rv.viewed_at) AS last_viewed
            FROM recipe_views rv
            WHERE rv.recipe_id = r.id AND rv.user_id = :user
        ) mv ON true";
    }

    $needMacros = str_starts_with($orderBy, 'calories')
               || str_starts_with($orderBy, 'protein')
               || $usesMacroFilter
               || !empty($opts['with_macros']);

    if ($needMacros) {
        $macroSelect = "ROUND(macros.kcal) AS kcal_per_serving,
            ROUND(macros.protein, 1) AS protein_per_serving,";
        $joins .= "
        LEFT JOIN LATERAL (
            SELECT
                SUM(g.grams * i.energy_kcal / 100.0)::numeric
                    / GREATEST(COALESCE(r.servings, 1), 1) AS kcal,
                SUM(g.grams * i.protein_g / 100.0)::numeric
                    / GREATEST(COALESCE(r.servings, 1), 1) AS protein
            FROM recipe_ingredients ri
            JOIN ingredients i ON i.id = ri.ingredient_id
            LEFT JOIN ingredient_densities iu ON iu.id = ri.ingredient_id
            CROSS JOIN LATERAL (
                SELECT ri.amount * CASE LOWER(ri.unit)
                    WHEN 'g'    THEN 1
                    WHEN 'kg'   THEN 1000
                    WHEN 'oz'   THEN 28.35
                    WHEN 'lb'   THEN 453.6
                    WHEN 'ml'   THEN COALESCE(iu.grams_per_ml, 1)
                    WHEN 'l'    THEN 1000 * COALESCE(iu.grams_per_ml, 1)
                    WHEN 'tsp'  THEN 5   * COALESCE(iu.grams_per_ml, 1)
                    WHEN 'tbsp' THEN 15  * COALESCE(iu.grams_per_ml, 1)
                    WHEN 'cup'  THEN 240 * COALESCE(iu.grams_per_ml, 1)
                    ELSE iu.grams_per_piece      -- pieces / no unit
                END AS grams
            ) g
            WHERE ri.recipe_id = r.id
        ) macros ON true";
    }

    $sql = "
        SELECT
            r.id,
            r.owner_id,
            r.title,
            r.description,
            r.prep_time_minutes,
            r.total_time_minutes,
            r.course_types,
            r.view_count,
            r.image_base,

            (SELECT COUNT(DISTINCT s.user_id) FROM saved_recipes s WHERE s.recipe_id = r.id) AS saves,
            EXISTS (
                SELECT 1 FROM saved_recipes s
                WHERE s.recipe_id = r.id AND s.user_id = :user
            ) AS is_saved,
            COALESCE(r.owner_id = :user, false) AS is_owner,
            u.username AS owner_username,
            u.image_base AS owner_image,
            COALESCE(tags.recipe_tags, '[]'::json) AS recipe_tags,
            $macroSelect
            " . (isset($matchSql) ? "($matchSql) AS ingredient_matches, $totalSql AS ingredient_total," : '') . "
            $rankSql AS search_rank

        FROM recipes r
        LEFT JOIN users u ON u.id = r.owner_id
        LEFT JOIN LATERAL (
            SELECT json_agg(
                json_build_object('id', t.id, 'name', t.name, 'slug', t.slug)
                ORDER BY t.name
            ) AS recipe_tags
            FROM recipe_tags rt
            JOIN tags t ON t.id = rt.tag_id
            WHERE rt.recipe_id = r.id
        ) tags ON true
        $joins
        WHERE " . ($where ? implode(' AND ', $where) : 'TRUE') . "
        ORDER BY $orderSql
    ";

 
    if ($isRandom) {
        $sql .= " LIMIT 1";
    } else {
        $sql .= " LIMIT :limit OFFSET :offset";
    }
 
    // :owner_id is bound only if the final SQL actually uses it
    if (strpos($sql, ':owner_id') !== false) {
        $params[':owner_id'] = $owner;
    }
 
    $stmt = $db->prepare($sql);
    foreach ($params as $name => $value) {
        $stmt->bindValue($name, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    if (!$isRandom) {
        $stmt->bindValue(':limit', max(1, min((int)$opts['limit'], 100)), PDO::PARAM_INT);
        $stmt->bindValue(':offset', max(0, (int)$opts['offset']), PDO::PARAM_INT);
    }
 
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$row) {
        $row['recipe_tags'] = json_decode($row['recipe_tags'] ?? '[]', true);
    }
    unset($row);
    return $rows;
}