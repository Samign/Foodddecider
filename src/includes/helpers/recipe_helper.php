<?php

function extractSourceKey(string $url): ?string {
    $host = parse_url(trim($url), PHP_URL_HOST);
    if (!$host) {
        return '';
    }

    $host = strtolower($host);
    $host = preg_replace('/^www\./', '', $host);

    return filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)
        ? $host
        : '';
}

function fetchRecipeInput() {
    return [
        'name' => $_POST['name'] ?? '',
        'description' => $_POST['description'] ?? '',
        'link' => $_POST['link'] ?? '',
        'public' => $_POST['public'] ?? '0',
        'course' => $_POST['course'] ?? '4',
        'prep' => $_POST['prep'] ?? '10',
        'cook' => $_POST['cook'] ?? '30',
        'picture' => $_FILES['picture'] ?? null,
        'servings' => $_POST['servings'] ?? null,
        'steps' => $_POST['step_sections'] ?? [],
        'ingredients' => $_POST['ingredient_sections'] ?? [],
        'tags' => $_POST['tags'] ?? [],
        'forked_from_recipe_id' => $_POST['forked_from_recipe_id'] ?? null
    ];
}

function normalizeName($name) {
    $name = strtolower($name);
    // Replace non-alphanumeric characters with spaces (NOT hyphens)
    $name = preg_replace('/[^a-z0-9\s]+/', ' ', $name);
    // Remove common culinary modifiers
    $name = preg_replace('/\b(of|fresh|chopped|diced|sliced|minced|grated|large|small|medium|extra large|extra small)\b/', '', $name);
    // Collapse multiple spaces into a single space and trim edges
    $name = preg_replace('/\s+/', ' ', $name);
    return trim($name);
}

function slugify(string $string): string {
    $text = strtolower(trim($string));
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    return trim($text, '-');
}

function saveTags(PDO $db, int $recipeId, array $tags): void {
    $db->prepare("DELETE FROM recipe_tags WHERE recipe_id = :recipe_id")
       ->execute([':recipe_id' => $recipeId]);
 
    if (empty($tags)) {
        return;
    }
 
    $stmt = $db->prepare("
        INSERT INTO recipe_tags (recipe_id, tag_id)
        VALUES (:recipe_id, :tag_id)
        ON CONFLICT DO NOTHING
    ");
 
    foreach ($tags as $tag) {
        $tagId = ctype_digit((string) $tag)
            ? (int) $tag
            : findOrCreateTag($db, (string) $tag);
 
        $stmt->execute([
            ':recipe_id' => $recipeId,
            ':tag_id'    => $tagId,
        ]);
    }
}

function findOrCreateTag(PDO $db, string $tagName): int {
    $name = trim($tagName);
    $slug = slugify($name);
 
    if ($slug === '') {
        throw new InvalidArgumentException('Invalid tag name');
    }
 
    $stmt = $db->prepare("SELECT id FROM tags WHERE slug = :slug");
    $stmt->execute([':slug' => $slug]);
    $existingTagId = $stmt->fetchColumn();
 
    if ($existingTagId) {
        return (int) $existingTagId;
    }
 
    $stmt = $db->prepare("INSERT INTO tags (name, slug, is_featured, usage_count) VALUES (:name, :slug, :is_featured, :usage_count) ON CONFLICT (slug) DO UPDATE SET name = tags.name RETURNING id");
    $stmt->execute([':name' => $name, ':slug' => $slug, ':is_featured' => false, ':usage_count' => 1]);
    return (int) $stmt->fetchColumn();
}

function match_ingredient($db, $ingredient) {
    $normalized = normalizeName($ingredient);
    
    if (empty($normalized)) {
        return null;
    }
    
    // Exact match (using LOWER to ensure it matches regardless of DB casing)
    $stmt = $db->prepare("
        SELECT id, name_en
        FROM ingredients 
        WHERE LOWER(name_sv) = :name OR LOWER(name_en) = :name
        LIMIT 1
    ");

    $stmt->execute([':name' => $normalized]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC); 

    if ($result) {
        return [
            'id' => $result['id'],
            'name' => $result['name_en'] // Standardizing return to always use English base name if preferred
        ];
    }

    // Fuzzy match (Using GREATEST to score against both languages accurately)
    $stmt = $db->prepare("
        SELECT 
            id, 
            name_en, 
            name_sv, 
            name_de, 
            GREATEST(similarity(name_en, :name), similarity(name_sv, :name)) AS score 
        FROM ingredients 
        WHERE name_sv % :name OR name_en % :name
        ORDER BY score DESC
        LIMIT 1
    ");

    $stmt->execute([':name' => $normalized]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC); 

    if ($result && $result['score'] > 0.4) {
        return [
            'id' => $result['id'],
            'name' => $result['name_en']
        ];
    }
    
    return null;
}

function saveStepSections(PDO $db, int $recipeId, array $stepSections): void {

    $db->prepare("DELETE FROM recipe_steps WHERE recipe_id = :recipe_id")
       ->execute([':recipe_id' => $recipeId]);
    $db->prepare("DELETE FROM step_sections WHERE recipe_id = :recipe_id")
       ->execute([':recipe_id' => $recipeId]);
 
    if (empty($stepSections)) {
        return;
    }
 
    $sectionStmt = $db->prepare("
        INSERT INTO step_sections (recipe_id, title, position)
        VALUES (:recipe_id, :title, :position)
        RETURNING id
    ");
 
    $stepStmt = $db->prepare("
        INSERT INTO recipe_steps (recipe_id, section_id, step_number, content)
        VALUES (:recipe_id, :section_id, :step_number, :content)
    ");
 
    $sectionPosition = 1;
    $globalStepNumber = 1;
 
    foreach ($stepSections as $section) {
        $sectionStmt->execute([
            ':recipe_id' => $recipeId,
            ':title'     => $section['title'] ?? null,
            ':position'  => $sectionPosition++,
        ]);
        $sectionId = $sectionStmt->fetchColumn();
        $sectionStmt->closeCursor();
 
        if (!empty($section['steps']) && is_array($section['steps'])) {
            foreach ($section['steps'] as $step) {
                if (!is_string($step) || trim($step) === '') continue;
 
                $stepStmt->execute([
                    ':recipe_id'   => $recipeId,
                    ':section_id'  => $sectionId,
                    ':step_number' => $globalStepNumber++,
                    ':content'     => $step,
                ]);
            }
        }
    }
}

function saveIngredientSections(PDO $db, int $recipeId, array $ingredientSections): void {
    $db->prepare("DELETE FROM recipe_ingredients WHERE recipe_id = :recipe_id")
       ->execute([':recipe_id' => $recipeId]);
    $db->prepare("DELETE FROM ingredient_sections WHERE recipe_id = :recipe_id")
       ->execute([':recipe_id' => $recipeId]);
 
    if (empty($ingredientSections)) {
        return;
    }
 
    $sectionStmt = $db->prepare("
        INSERT INTO ingredient_sections (recipe_id, title, position)
        VALUES (:recipe_id, :title, :position)
        RETURNING id
    ");
 
    $ingStmt = $db->prepare("
        INSERT INTO recipe_ingredients
        (recipe_id, section_id, ingredient_name, ingredient_id, amount, unit, size, position, raw_input, is_soft)
        VALUES (:recipe_id, :section_id, :ingredient_name, :ingredient_id, :amount, :unit, :size, :position, :raw_input, :is_soft)
    ");
 
    $sectionPosition = 1;
    $globalIngPosition = 1;
 
    foreach ($ingredientSections as $section) {
        $sectionStmt->execute([
            ':recipe_id' => $recipeId,
            ':title'     => $section['title'] ?? null,
            ':position'  => $sectionPosition++,
        ]);
        $sectionId = $sectionStmt->fetchColumn();
        $sectionStmt->closeCursor();
 
        if (!empty($section['ingredients']) && is_array($section['ingredients'])) {
            foreach ($section['ingredients'] as $ingredient) {
                if (is_string($ingredient)) {
                    $raw = trim($ingredient);
                    if ($raw === '') continue;
                    $amount = null; $unit = null; $size = null; $name = $raw; $isSoft = '0';
                } else {
                    $raw = $ingredient['raw'] ?? '';
                    if (trim($raw) === '') continue;
 
                    preg_match('/[\d.]+/', $ingredient['amount'] ?? '', $amountMatch);
                    $amount = !empty($amountMatch[0]) ? $amountMatch[0] : null;
                    $unit   = $ingredient['unit'] ?? null;
                    $size   = $ingredient['size'] ?? null;
                    $name   = $ingredient['ingredient'] ?? $raw;
                    $isSoft = !empty($ingredient['soft']) ? '1' : '0';
                }
 
                $match          = match_ingredient($db, $name);
                $ingredientId   = $match ? $match['id'] : null;
                $ingredientName = $match ? $match['name'] : $name;
 
                $ingStmt->execute([
                    ':recipe_id'       => $recipeId,
                    ':section_id'      => $sectionId,
                    ':ingredient_name' => $ingredientName,
                    ':ingredient_id'   => $ingredientId,
                    ':amount'          => $amount,
                    ':unit'            => $unit,
                    ':size'            => $size,
                    ':position'        => $globalIngPosition++,
                    ':raw_input'       => $raw,
                    ':is_soft'         => $isSoft,
                ]);
 
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
    }
}