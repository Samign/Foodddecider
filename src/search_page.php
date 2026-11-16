<?php
require_once __DIR__ . '/includes/modules.php';
?>

<html>
<head>
    <title>FoodDecider - Search Results</title>
    <link rel="stylesheet" href="./assets/style.css">
</head>
<body>
    <?php echo getExpandedModal(); ?>
    <?php echo getNavBar(); ?>
    <!-- Search bar -->

    <div class="tabs">
        <button id="all-tab" class="active">All</button>
        <button id="recipes-tab">Recipes</button>
        <button id="profiles-tab">Profiles</button>
    </div>

    <h1>Search Results</h1>
    <div id="recipe-search-list"></div>
    <div id="profile-results"></div>
    <script type="module" src="./assets/search.js"></script>
    <script type="module" src="./assets/main.js"></script>
</body>
</html>