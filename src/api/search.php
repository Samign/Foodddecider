<?php
require_once '../includes/db.php';
require_once '../includes/recipe_fetcher.php';

$query = $_GET['search'] ?? '';

$db = db();
$pdo = $db->getPdo();

$attributes_filter = [];
$courseType = null;
$ingredients_filter = null;
$search_query = null;

if ($query) {

    // split into search into tokens
    $tokens = preg_split('/\s+/', strtolower($query));

    $attributeMap = $pdo->query("SELECT id, LOWER(name) as name FROM attributes")
                        ->fetchAll(PDO::FETCH_KEY_PAIR);

    $courseTypeMap = $pdo->query("SELECT id, LOWER(name) as name FROM course_types")
                        ->fetchAll(PDO::FETCH_KEY_PAIR);

    $ingredient_terms = [];

    foreach ($tokens as $word) {
        
        // Check attribute match
        if (in_array($word, $attributeMap)) {
            $attributes_filter[] = array_search($word, $attributeMap);
            continue;
        }

        // Check course type match
        if (in_array($word, $courseTypeMap)) {
            $courseType = array_search($word, $courseTypeMap);
            continue;
        }

        // treat as ingredient
        $ingredient_terms[] = $word;
    }

    // combine remainder into search terms for text search
    if (!empty($ingredient_terms)) {
        $ingredients_filter = implode(' ', $ingredient_terms);
        $search_query = $ingredients_filter;
    }

    $results = getRecipeById(
        search_query: $search_query, 
        attributes_filter: $attributes_filter, 
        course_type: $courseType, 
        ingredients_filter: $ingredients_filter,
        public: '1',
        limit: 20,
        offset: 0
    );

    // grab users aswell
    $user_stmt = $pdo->prepare("SELECT * FROM users WHERE username ILIKE ?");
    $user_stmt->execute(["%$query%"]);
    $user_results = $user_stmt->fetchAll();
} else {
    $results = [];
    $user_results = [];
}

echo json_encode([
    'recipes' => $results,
    'users' => $user_results
]);


?>