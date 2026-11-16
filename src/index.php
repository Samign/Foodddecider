<?php

require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/recipe_fetcher.php';
require_once __DIR__ . '/includes/user_fetcher.php';
require_once __DIR__ . '/includes/modules.php';

$recipe = null;
$requestUri = $_SERVER['REQUEST_URI'];
$requestUri = trim($requestUri, '/');

$userLoggedIn = isset($_SESSION['user_id']);

if (preg_match('/\/recipe\/(\d+)/', $requestUri, $matches)) {
    $recipeId = filter_var($matches[1], FILTER_VALIDATE_INT);
    if ($recipeId) {
        $recipe = getRecipe($recipeId);
    }
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com/" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Epilogue:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/style.css">
    <?php if ($recipe): ?>
        <title><?php echo htmlspecialchars($recipe['title']); ?></title>
        <meta property="og:title" content="<?php echo htmlspecialchars($recipe['title']); ?>">
        <meta property="og:image" content="<?php echo htmlspecialchars($recipe['image_url']); ?>">
    <?php else: ?>
        <title>Decide your next meal</title>
    <?php endif; ?>

</head>
<body>
    <div class="modal-overlay hidden" id="modal-overlay"></div>
    <?php echo getNavBar(true); ?>
    <?php echo getExpandedModal(); ?>
    <?php echo getFilterMenu(); ?>

    <?php if ($recipe): ?>
        <noscript>
            <div class="recipe-static">
                <h2><?php echo htmlspecialchars($recipe['title']); ?></h2>
                <img src="<?php echo htmlspecialchars($recipe['image_url']); ?>" alt="Recipe image">
                <p><?php echo htmlspecialchars($recipe['description']); ?></p>
            </div>
        </noscript>
    <?php endif; ?>
        
    <div class="recipes-container" id="recipes">
        <div class="sub-category-buttons"></div>
        <div class="button-container">
            <div>
                <label class="sort-control" for="sort-select">
                    <span class="material-symbols-outlined">sort</span>
                    <select id="sort-select">
                        <option value="">Best match</option>
                        <optgroup label="Alphabetical">
                            <option value="title_asc">A → Z</option>
                            <option value="title_desc">Z → A</option>
                        </optgroup>
                        <optgroup label="Time">
                            <option value="prep_time">Quickest to prep</option>
                            <option value="total_time">Quickest overall</option>
                        </optgroup>
                        <optgroup label="Popularity">
                            <option value="popular">Most popular</option>
                            <?php if (!empty($_SESSION['user_id'])): ?>
                                <option value="go_to">My go-to recipes</option>
                            <?php endif; ?>
                        </optgroup>
                        <optgroup label="Nutrition (per serving)">
                            <option value="calories_asc">Fewest calories</option>
                            <option value="calories_desc">Most calories</option>
                            <option value="protein_desc">Most protein</option>
                            <option value="protein_asc">Least protein</option>
                        </optgroup>
                        <optgroup label="Date">
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                        </optgroup>
                    </select>
                </label>
                <button id="filter-button"><span class="material-symbols-outlined">filter_list</span>Filters</button>
                <button class="random-button" id="random-button"><span class="material-symbols-outlined">shuffle</span>Surprise Me</button>
            </div>
            <button class="add-button" id="add-button"><span class="material-symbols-outlined">add</span>Add new recipe</button>
        </div>
        <div class="recipe-card-container" id="recipe-list"></div>
    </div>

    <?php if(!$userLoggedIn) {
        echo getLoginModal();
    } else {
        echo addEditModal();
    } ?>
    
    <script type="module" src="/assets/main.js"></script>
</body>
</html>