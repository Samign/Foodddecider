<?php
require_once '../includes/db.php';
require_once '../includes/recipe_fetcher.php';

$query = trim($_GET['q'] ?? '');

$db = db();

$courseType = null;
$search_terms = [];

if ($query !== '') {

    // Split search into lowercase tokens
    $tokens = preg_split('/\s+/', strtolower($query));

    // Fetch course types (id => name)
    $courseTypeMap = $db->query("SELECT id, LOWER(name) as name FROM course_types")
                        ->fetchAll(PDO::FETCH_KEY_PAIR);

    foreach ($tokens as $word) {
        // Check if word matches a course type (e.g., "dinner", "dessert")
        if (in_array($word, $courseTypeMap, true)) {
            $courseType = array_search($word, $courseTypeMap, true);
            continue;
        }

        // Keep all other words for general text search (title, description, tags, ingredients)
        $search_terms[] = $word;
    }

    // Combine remaining words into a general search string
    $general_search_query = !empty($search_terms) ? implode(' ', $search_terms) : $query;

    $opts = [
        'search_query'       => $general_search_query, // Passes free-text query for titles/descriptions
        'course_type'        => $courseType,
        'ingredients_filter' => null,                  // Don't restrict strictly to ingredient tables unless explicitly needed
        'public'             => '1',
        'limit'              => 20,
        'offset'             => 0
    ];
    
    $results = getRecipeCards($opts);

    // Fetch matching user profiles
    $user_stmt = $db->prepare("SELECT id, username, bio, image_base FROM users WHERE username ILIKE ?");
    $user_stmt->execute(["%$query%"]);
    $user_results = $user_stmt->fetchAll();

} else {
    $results = [];
    $user_results = [];
}

header('Content-Type: application/json');
echo json_encode([
    'recipes' => $results,
    'users'   => $user_results
]);