<?php 
require_once __DIR__ . '/../../includes/json_response.php';   // JSON content type (see the file)

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/recipe_fetcher.php';

$db = db();

$request_method = $_SERVER['REQUEST_METHOD'];

// if ($request_method === 'GET') {

//     $stmt = $db->prepare("SELECT id, title, description, prep_time_minutes, total_time_minutes, course_types, view_count, image_base FROM recipes");
//     $stmt->execute();
//     $recipes = $stmt->fetchAll(PDO::FETCH_ASSOC);
//     echo json_encode($recipes);
// }

if ($request_method === 'POST') {
    $id = $_POST['id'] ?? null;

    if ($id) {
        $recipe = getRecipe($id);
        echo json_encode($recipe);
        exit;
    }
    
    $ingredients = array_values(array_filter(
        array_map(fn($v) => trim((string)$v), (array)($_POST['ingredients'] ?? [])),
        fn($v) => $v !== ''
    ));
    $tags = json_decode($_POST['tags'] ?? '[]', true);
    $tags = is_array($tags) ? array_slice($tags, 0, 10) : [];
    $courses = array_filter(array_map('intval', explode(',', (string)($_POST['course'] ?? ''))));

    $opts = [
        'ingredients_filter' => $ingredients,
        'tags_filter'        => $tags,
        'min_kcal'           => $_POST['min_kcal'] ?? null,
        'max_kcal'           => $_POST['max_kcal'] ?? null,
        'min_protein'        => $_POST['min_protein'] ?? null,
        'max_protein'        => $_POST['max_protein'] ?? null,
        'action'             => $_POST['action'] ?? null,
        'course_types'       => $courses,
        'ingredients_match'  => (($_POST['ingredients_match'] ?? 'all') === 'any') ? 'any' : 'all',
        'time'               => $_POST['time'] ?? null,
        'include_cook_time'  => $_POST['include_cook_time'] ?? null,
        'public'             => $_POST['public'] ?? '0',
        'order_by'           => $_POST['order_by'] ?? null,
        'category'           => $_POST['category'] ?? null,
        'username'           => $_POST['user'] ?? null,
        'exclude_id'         => $_POST['exclude_id'] ?? null,
        'with_macros'        => ($_POST['action'] ?? null) === 'random',   // the pick card shows kcal/protein
    ];
    
    echo json_encode(getRecipeCards($opts));
}

//$stmt = $db->prepare("SELECT id, title, description, prep_time_minutes, total_time_minutes, course_types, view_count, image_base FROM recipes");


// require_once __DIR__ . '/../../includes/user_fetcher.php';

// $params = [
//     'id' => $_POST['id'] ?? null,
//     'ingredients_filter' => isset($_POST['attributes']) ? json_decode($_POST['attributes'], true) : [],
//     'attributes_filter' => isset($_POST['attributes']) ? json_decode($_POST['attributes'], true) : [],
//     'action' => $_POST['action'] ?? null,
//     'course_type' => $_POST['course'] ?? null,
//     'time' => $_POST['time'] ?? null,
//     'include_cook_time' => $_POST['include_cook_time'] ?? null,
//     'public' => $_POST['public'] ?? '0',
//     'order_by' => $_POST['order_by'] ?? null,
//     'category' => $_POST['category'] ?? null,
//     'user' => $_POST['user'] ?? null
// ];

// if ($params['user']) {
//     $owner_id = grabUserInfo(null, $params['user'])['id'];
//     getRecipeById(
//         owner: $owner_id,
//         ingredients_filter: $params['ingredients_filter'],
//         course_type: $params['course_type'],
//         attributes_filter: $params['attributes_filter']
//     );
// } elseif ($params['id']) {
//     getRecipeById(id: $params['id']);
// } else {
//     getRecipeById(
//         ingredients_filter: $params['ingredients_filter'],
//         attributes_filter: $params['attributes_filter'],
//         action: $params['action'],
//         course_type: $params['course_type'],
//         time: $params['time'],
//         include_cook_time: $params['include_cook_time'],
//         order_by: $params['order_by'],
//         public: $params['public'],
//         category: $params['category']
//     );
// }

//TODO remove everything above and do a simple grab on only the recipe table 