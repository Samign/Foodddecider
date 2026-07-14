<?php 

require_once __DIR__ . '/../../includes/recipe_fetcher.php';
require_once __DIR__ . '/../../includes/user_fetcher.php';

$params = [
    'id' => $_POST['id'] ?? null,
    'ingredients_filter' => isset($_POST['attributes']) ? json_decode($_POST['attributes'], true) : [],
    'attributes_filter' => isset($_POST['attributes']) ? json_decode($_POST['attributes'], true) : [],
    'action' => $_POST['action'] ?? null,
    'course_type' => $_POST['course'] ?? null,
    'time' => $_POST['time'] ?? null,
    'include_cook_time' => $_POST['include_cook_time'] ?? null,
    'public' => $_POST['public'] ?? '0',
    'order_by' => $_POST['order_by'] ?? null,
    'category' => $_POST['category'] ?? null,
    'user' => $_POST['user'] ?? null
];

if ($params['user']) {
    $owner_id = grabUserInfo(null, $params['user'])['id'];
    getRecipeById(
        owner: $owner_id,
        ingredients_filter: $params['ingredients_filter'],
        course_type: $params['course_type'],
        attributes_filter: $params['attributes_filter']
    );
} elseif ($params['id']) {
    getRecipeById(id: $params['id']);
} else {
    getRecipeById(
        ingredients_filter: $params['ingredients_filter'],
        attributes_filter: $params['attributes_filter'],
        action: $params['action'],
        course_type: $params['course_type'],
        time: $params['time'],
        include_cook_time: $params['include_cook_time'],
        order_by: $params['order_by'],
        public: $params['public'],
        category: $params['category']
    );
}
?>
