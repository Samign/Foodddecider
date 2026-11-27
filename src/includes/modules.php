<?php

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/user_fetcher.php';


/**
 * Current user, or null. Cached for the request so the several modules
 * that call it don't each hit the database.
 */
function getUser()
{
    static $user = false;

    if ($user === false) {
        $user = isset($_SESSION['user_id']) ? grabUserInfo($_SESSION['user_id']) : null;
    }
    return $user;
}

/**
 * Fonts and stylesheets, the same on every page that uses getNavBar().
 * Also sets the saved theme before first paint so dark mode doesn't flash light.
 */
function getHeadAssets()
{
    ?>
    <script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com/" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400..800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/style.css">
    <link rel="stylesheet" href="/assets/redesign.css">
    <?php
}

/**
 * Top bar: logo, search, Groups, Shopping list, Saved, Add recipe, avatar.
 * #add-button lives here now; logged-out visitors get a hidden copy so JS that binds it doesn't break.
 */
function getNavBar()
{
    $user = getUser();

    ?>
    <header class="top">
        <a href="/" class="logo">FoodDecider</a>
        <form action="/results" method="GET" class="sbox">
            <input class="search" id="q" type="search" name="q" placeholder="Search ingredients, dishes, users" aria-label="Search ingredients, dishes, users" autocomplete="off">
            <kbd>⌘K</kbd>
        </form>
        <?php if ($user): ?>
            <!-- Weekly plan: add here once the feature exists, e.g. <a class="tbtn hm" href="/plan">Weekly plan</a> -->
            <button type="button" class="tbtn hm social-tab">Groups<span class="badge hidden">0</span></button>
            <button type="button" class="tbtn shopping-list-button">Shopping list</button>
            <i class="vr hm" aria-hidden="true"></i>
            <button type="button" class="tbtn pill hm" id="nav-saved">Saved</button>
            <button type="button" class="add" id="add-button">+ Add recipe</button>
            <div class="current-user" role="button" tabindex="0" aria-label="Profile menu" title="Profile">
                <?php if ($user['image_base']): ?>
                    <img src="/uploads/profile_pictures/<?php echo htmlspecialchars($user['image_base']); ?>.webp" alt="" class="profile-picture">
                <?php else: ?>
                    <img src="/uploads/profile_pictures/<?php echo htmlspecialchars($user['username']); ?>_avatar.svg" alt="" class="profile-picture">
                <?php endif; ?>
            </div>
        <?php else: ?>
            <button type="button" class="add" id="add-button" hidden>+ Add recipe</button>
            <button type="button" id="log-in" class="add">Sign up / Log in</button>
        <?php endif; ?>
    </header>
    
    <?php if ($user): ?>
    <div class="modal hidden" id="social-modal">
        <div>
            <span class="close-button">&times;</span>
            <h2>Groups</h2>
            <div class="social-content" id="social-content">
                <div class="group-invitations" id="group-invitations"></div>
                <div class="group-list" id="group-list"></div>
                <button class="create-group">Create new group</button>
            </div>
        </div>
    </div>

    <div class="modal hidden" id="create-group-modal">
        <div>
            <span class="close-button">&times;</span>
            <h2 id="create-group-add-edit-title">Create Group</h2>
            <form id="create-group-form">
                <label for="group_name">Group Name</label>
                <input type="text" name="group_name" id="group_name" required>

                <h3>Suggested members</h3>
                <div id="suggested-members" class="suggested-members"></div>

                <h3>Members</h3>
                <div class="users-container"></div>
                <button type="button" id="add-member-btn">+ Add another user</button>

                <button type="submit" id="create-group-submit">Create Group</button>
            </form>
        </div>
    </div>

    <div class="modal hidden" id="shopping-list-modal">
        <div>
            <span class="close-button" aria-label="Close">&times;</span>
            <h2>Shopping List</h2>
            <button type="button" id="share-list-button" hidden>Share with group</button>
            <div class="share-panel" hidden></div>
            <select name="lists" id="lists" aria-label="Shopping list"></select>
            <button type="button" class="delete-list-button" hidden>Delete list</button>

            <div class="shopping-list-content" id="shopping-list-content">
                <form id="shopping-list-form">

                    <div class="shopping-rows"></div>

                    <details class="shopping-archive" hidden>
                        <summary>Archive (<span class="archive-count">0</span>), items are removed after 2 days</summary>
                        <div class="shopping-archive-rows"></div>
                    </details>

                </form>
            </div>
        </div>
    </div>

    <div class="modal hidden" id="invitation-modal">
        <div>
            <span class="close-button">&times;</span>
            <h2>Pending Invitations</h2>
            <div class="invitation-list" id="invitation-list">
            </div>
        </div>
    </div>
    
    <?php
    endif;
}

/**
 * Hero: headline, filters (From / How long / What kind / Tags), the plate, and the answer container.
 * assets/hero-filters.js drives the chips by writing into #filter-form, so recipes.js
 * stays the only place that fetches recipes. The plate is #random-button (recipes.js).
 */
function getDecider()
{
    $user = getUser();
    $courses = [1 => 'Breakfast', 2 => 'Brunch', 3 => 'Lunch', 4 => 'Dinner', 5 => 'Dessert', 6 => 'Snack', 7 => 'Sauce', 8 => 'Drink'];
    $times = [15 => 'Under 15 min', 30 => 'Under 30 min', 60 => 'Under 1 hour'];
    $scope = $user ? 'mine' : 'all';
    ?>
    <section class="hero">
        <div>
            <h1>What are we eating today?</h1>
            <p>Narrow it down, or let us choose for you.</p>
        </div>
        <div class="decide">
            <div>
                <b>Feeling indecisive?</b>
                <p>We’ll pick from your matches</p>
            </div>
            <button type="button" class="plate" id="random-button"><span>Decide for me</span></button>
        </div>

        <section class="panel" aria-label="Filters">
            <div class="row"><b>From</b>
                <div class="chips" id="r-from">
                    <div class="seg recipe-category-buttons" role="group" aria-label="Whose recipes">
                        <?php if ($user): ?>
                            <button type="button" class="nav-buttons" id="all-recipes">All</button>
                            <button type="button" class="nav-buttons active" id="personal-recipes">My kitchen</button>
                            <button type="button" class="nav-buttons" id="friends-recipes">Following</button>
                        <?php endif; ?>
                        <button type="button" class="nav-buttons <?= $user ? '' : 'active' ?>" id="public-recipes">Discover</button>
                    </div>
                    <?php if ($user): ?>
                        <button type="button" class="chip" id="go-to-chip" aria-pressed="false">Only my go-tos</button>
                    <?php endif; ?>
                    <p class="hint<?= $scope === 'all' ? ' d' : '' ?>" id="scope-hint"
                       data-any="Everything: your recipes, people you follow and the community."
                       data-mine="Recipes you’ve saved or written."
                       data-follow="Recipes from people you follow."
                       data-all="Browsing public recipes shared by other people on FoodDecider."><?= $scope === 'all'
                        ? 'Browsing public recipes shared by other people on FoodDecider.'
                        : 'Recipes you’ve saved or written.' ?></p>
                </div>
            </div>
            <div class="row"><b>How long</b>
                <div class="chips" id="r-time">
                    <?php foreach ($times as $min => $label): ?>
                        <button type="button" class="chip" data-time="<?= $min ?>" aria-pressed="false"><?= $label ?></button>
                    <?php endforeach; ?>
                </div>
            </div>
            <div class="row"><b>What kind</b>
                <div class="chips" id="r-course">
                    <?php foreach ($courses as $id => $label): ?>
                        <button type="button" class="chip" data-course="<?= $id ?>" aria-pressed="false"><?= $label ?></button>
                    <?php endforeach; ?>
                </div>
            </div>
            <div class="row"><b>I have</b>
                <div>
                    <div class="chips" id="r-ing">
                        <?php foreach (['Chicken', 'Tofu', 'Eggs', 'Chickpeas', 'Mushrooms', 'Noodles', 'Potatoes'] as $ing): ?>
                            <button type="button" class="chip" data-ing="<?= $ing ?>" aria-pressed="false"><?= $ing ?></button>
                        <?php endforeach; ?>
                    </div>
                    <button type="button" class="chip" id="ing-all" aria-pressed="false" hidden>Must use all of them</button>
                    <div class="ing-search">
                        <input class="in-t" id="iq" type="text" autocomplete="off" placeholder="Add what’s in your kitchen, like tofu" aria-label="Add an ingredient you have">
                        <div class="autocomplete-list"></div>
                    </div>
                    <p class="hint">Pick what you have and we’ll show what you can make. Closest matches come first.</p>
                </div>
            </div>
            <div class="row"><b>Tags</b>
                <div class="chips">
                    <span class="chips" id="r-tags" style="display:contents"></span>
                    <button type="button" class="chip more" id="more-tags">More tags</button>
                    <button type="button" class="chip more" id="filter-button">Ingredients and nutrition</button>
                </div>
                <div class="pop" id="pop" hidden>
                    <input id="tq" type="search" placeholder="Find a tag, like spicy or one-pot" aria-label="Find a tag">
                    <div class="chips" id="tl"></div>
                </div>
            </div>
        </section>
    </section>

    <div id="pick" hidden></div>
    <?php
}

/**
 * Results heading: "4 recipes in your kitchen" on the left, a quiet note on the right.
 * JS fills both; the data- attributes hold the wording per scope.
 */
function getLibraryBar()
{
    ?>
    <div class="bar">
        <h2 id="count"
            data-any="to choose from" data-mine="in your kitchen"
            data-follow="from people you follow" data-all="from the community">Recipes</h2>
        <span class="sub" id="csub"
            data-any="Showing every recipe" data-mine="Showing all saved recipes"
            data-follow="Showing recipes from people you follow" data-all="Showing public recipes"></span>
    </div>
    <?php
}

/** Inert template for JS to clone into #recipe-list when nothing matches. */
function getEmptyStateTemplate()
{
    ?>
    <template id="empty-state-template">
        <div class="empty">
            <h3 class="empty-title">Nothing fits all of that yet</h3>
            <p class="empty-text">Try loosening a filter, or look in Discover.</p>
            <button type="button" class="btn empty-clear">Clear filters</button>
        </div>
    </template>
    <?php
}

function getExpandedModal()
{
    ?>
    <!-- Same class hooks as before so existing JS still fills it; new layout: ingredients stay on the left while you scroll the steps -->
    <div class="modal hidden" id="expanded-modal">
        <span class="close-button">&times;</span>
        <div class="dlg rv">
            <div class="rvh">
                <div class="expanded-recipe-image"></div>
                <div>
                    <div class="recipe-owner"></div>
                    <h2 class="recipe-title"></h2>
                    <div class="recipe-description"></div>
                    <div class="recipe-meta"><div class="recipe-time"></div></div>
                    <div class="views"></div>
                    <div class="course"><span class="course-type">Dinner</span></div>
                    <div class="recipe-tags"></div>
                    <div class="macros"><h5>Nutrition Information</h5><div class="macro-list"></div></div>
                    <div class="recipe-actions"></div>
                </div>
            </div>
            <div class="rvb">
                <aside class="ingredients">
                    <div class="flex">
                        <h3>Ingredients</h3>
                        <button class="add-all-button">Add all to list</button>
                    </div>
                    <div class="ingredient-list"></div>
                </aside>
                <div>
                    <h3>Steps</h3>
                    <div class="steps"></div>
                </div>
            </div>
        </div>
    </div>
    
    <?php
        $user = getUser();
        if (!$user) return;
    ?>

    <div class="modal hidden" id="profile-modal">
        <div class="user-info"><?php echo htmlspecialchars($user['username']); ?></div>
        <div class="flex">
            <a href="/user/<?php echo htmlspecialchars($user['username']); ?>">View profile</a>
            <a href="/auth/logout.php"> <span class="material-symbols-outlined">logout</span> Log out</a>
        </div>
        <button type="button" id="theme-toggle">
            <span class="material-symbols-outlined">dark_mode</span>
            <span class="theme-label">Dark mode</span>
        </button>
    </div>
    <?php
}

function getLoginModal()
{
    ?>
    <div id="login-modal" class="modal hidden">
        <div class="modal-content">
            <span class="close-button">x</span>
            <!-- TODO add a option to display signup under login content -->
            <h2>Login or Sign Up</h2>
            <a href="/auth/google.php">Sign in with Google</a>
            <form id="signup-form">
                <label for="email">email</label>
                <input autocomplete="email" id="email" type="text" name="email">
                <label for="username">username</label>
                <input autocomplete="username" id="username" type="text" name="username">
                <label for="password">password</label>
                <input id="password" type="password" name="password">
                <label for="picture">Profile Picture</label>
                <input id="picture" type="file" name="picture">
                <button type="submit">Create account</button>
            </form>
            <form method="POST" action="/auth/login.php">
                <label for="user">email or username</label>
                <input type="text" name="user">
                <label for="password">password</label>
                <input type="password" name="password">
                <button type="submit">log in</button>
            </form>
        </div>
    </div>
    <?php
}

function getFilterMenu()
{
    ?>
    <div class="modal hidden" id="filter-menu">
        <span class="close-button">&times;</span>
        <form id="filter-form">
            <fieldset>
                <legend>Filter recipes</legend>
                <div class="meta-data-container">
                    <div class="course-types-container">
                        <p>Course types</p>
                    </div>
                    <div class="tags-container">
                        <p>Tags</p>
                        <div class="tags"></div>
                        <div class="tag-input-row">
                            <input type="text" id="custom-tag-input" maxlength="30" placeholder="Add your own tag" autocomplete="off">
                            <button type="button" id="add-tag-button">Add</button>
                            <div id="tag-suggestions" class="autocomplete-list"></div>
                        </div>
                        <div id="selected-tags-list" class="selected-tags-list"></div>
                    </div>
                    <input type="hidden" name="tags" id="selected-tags" value="[]">
                </div>
                <!-- <input type="hidden" name="tags" id="selected-tags"> -->
                <input type="hidden" name="course" id="selected-course">

                <div class="ingredients-container" data-plain-ingredients>
                    <p>Ingredients</p>
                    <div id="ingredient-list">
                        <div class="ingredient-item">
                            <span>•</span>
                            <input class="ingredient-text" name="ingredients[]" placeholder="Enter an ingredient" autocomplete="off">
                            <button type="button" class="remove-ingredient" aria-label="Remove ingredient">×</button>
                            <div class="autocomplete-list"></div>
                        </div>
                    </div>
                    <button type="button" id="add-ingredient">+ Add ingredient</button>
                    <label>Recipe must contain
                        <select name="ingredients_match">
                            <option value="all">all of them</option>
                            <option value="any">any of them</option>
                        </select>
                    </label>
                </div>

                <div class="time-filter-container flex">
                    <div>
                        <label for="time">Time</label>
                        <input type="text" name="time" id="time">
                    </div>
                    <div>
                        <label for="include_cook_time">Include cook time?</label>
                        <input type="checkbox" name="include_cook_time" id="include_cook_time">
                    </div>
                </div>
                
                <div class="range-filter">
                    <div class="range-header">
                        <span>Calories <small>per serving</small></span>
                        <div class="range-numbers">
                            <input type="number" class="num-min" name="min_kcal" min="0" step="1" placeholder="0" aria-label="Minimum calories">
                            <span>–</span>
                            <input type="number" class="num-max" name="max_kcal" min="0" step="1" placeholder="1500+" aria-label="Maximum calories">
                            <span>kcal</span>
                        </div>
                    </div>
                    <div class="range-slider">
                        <input type="range" class="range-min" min="0" max="1500" step="10" value="0" aria-label="Minimum calories slider">
                        <input type="range" class="range-max" min="0" max="1500" step="10" value="1500" aria-label="Maximum calories slider">
                    </div>
                </div>
                            
                <div class="range-filter">
                    <div class="range-header">
                        <span>Protein <small>per serving</small></span>
                        <div class="range-numbers">
                            <input type="number" class="num-min" name="min_protein" min="0" step="1" placeholder="0" aria-label="Minimum protein">
                            <span>–</span>
                            <input type="number" class="num-max" name="max_protein" min="0" step="1" placeholder="100+" aria-label="Maximum protein">
                            <span>g</span>
                        </div>
                    </div>
                    <div class="range-slider">
                        <input type="range" class="range-min" min="0" max="100" step="1" value="0" aria-label="Minimum protein slider">
                        <input type="range" class="range-max" min="0" max="100" step="1" value="100" aria-label="Maximum protein slider">
                    </div>
                </div>
                
                <input type="submit" value="Apply filters">
                <button type="reset">Clear Filters</button>
            </fieldset>
        </form>
    </div>
    <?php
}

function addEditModal()
{
    ?>
    <div class="modal hidden" id="add-choice">
        <div class="add-option" id="add-from-url">
            <span class="material-symbols-outlined">link</span>
            <p>Import from URL</p>
        </div>
        <div class="add-option" id="add-manually">
            <span class="material-symbols-outlined">edit</span>
            <p>Add manually</p>
        </div>
    </div>

    <div class="modal hidden" id="add-from-url-modal">
        <span class="close-button">&times;</span>
        <form id="import-url-form">
            <label for="url">Recipe URL</label>
            <input type="text" name="url" id="url" placeholder="Paste the link to a recipe page">
            <button type="submit">Import recipe</button>
        </form>
    </div>

    <div class="modal hidden" id="add-menu">
        <span class="close-button">&times;</span>
        <form id="add-recipe-form" class="fm dlg">
            <h2 class="form-title">Add a recipe</h2>

            <div class="top2">
                <div class="upload-box" id="uploadBox">
                    <input name="picture" type="file" id="picture" accept="image/*" hidden>
                    <label for="picture" class="upload-label">
                        <div class="upload-content" id="uploadContent">
                            <span class="material-symbols-outlined icon-background">add_a_photo</span>
                            <p>Add a photo</p>
                            <p>JPG, PNG or WEBP, optional</p>
                        </div>
                        <img id="preview" class="preview hidden" alt="">
                    </label>
                </div>
                <div class="fm">
                    <div><label class="l" for="name">Title</label><input class="in-t" type="text" name="name" id="name" autocomplete="off" required></div>
                    <div><label class="l" for="description">One line about it</label><input class="in-t" type="text" name="description" id="description"></div>
                    <div><label class="l" for="link">Where it’s from (optional)</label><input class="in-t" type="text" name="link" id="link"></div>
                </div>
            </div>

            <div>
                <label class="l" for="course">What kind of meal</label>
                <select class="course-dropdown" name="course" id="course"></select>
            </div>

            <fieldset>
                <legend>How long does it take?</legend>
                <div class="tbox">
                    <div class="tin">
                        <div id="prep-wrap" hidden><label for="prep">Prep</label><input type="number" name="prep" id="prep" min="0"></div>
                        <div><label for="cook" id="cook-label">Total time</label><input type="number" name="cook" id="cook" min="1"></div>
                        <span class="u">min</span>
                        <span class="u" id="time-sum"></span>
                    </div>
                    <label class="sw"><input type="checkbox" id="split-time" role="switch"><span>Split into prep and cook time</span></label>
                </div>
            </fieldset>

            <div><label class="l" for="servings">Servings</label><input class="in-t" type="number" name="servings" id="servings" min="1" value="4" style="max-width:8rem"></div>

            <fieldset>
                <legend>Tags</legend>
                <div class="tags-container"><div class="tags chips"></div></div>
                <div class="tag-suggestions"><div class="suggested-tags chips"></div></div>
                <div class="tag-search">
                    <input type="text" class="in-t tag_search" placeholder="Search or add your own tag">
                    <button type="button" id="add-tag" class="btn">Add tag</button>
                    <div class="search-results"></div>
                </div>
            </fieldset>

            <div class="rvb">
                <fieldset>
                    <legend>Ingredients</legend>
                    <div id="ingredients">
                        <div class="section-group" data-section="0">
                            <?php titleInput('ingredient_sections'); ?>
                            <div class="ingredients-container">
                                <div class="ingredient-item">
                                    <span>•</span>
                                    <input type="text" name="ingredient_sections[0][ingredients][]" class="ingredient-text" autocomplete="off" placeholder="e.g. 300 g pasta">
                                </div>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn" id="add-ingredient">Add ingredient</button>
                    <?php addSection('add-ingredient-section'); ?>
                    <div class="autocomplete-list"></div>
                </fieldset>
                <fieldset>
                    <legend>Steps</legend>
                    <div id="instructions">
                        <div class="section-group" data-section="0">
                            <?php titleInput('step_sections'); ?>
                            <div class="instruction-container">
                                <div class="instruction-box">
                                    <span class="instruction-number">01</span>
                                    <input class="instruction-text" type="text" name="step_sections[0][steps][]" placeholder="Describe the step">
                                </div>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn" id="add-step">Add step</button>
                    <?php addSection('add-step-section'); ?>
                </fieldset>
            </div>

            <div class="save">
                <div class="seg" id="public-checkbox-container">
                    <button type="button" class="private-button" id="private">Private</button>
                    <button type="button" class="public-button selected" id="public">Public</button>
                    <input type="hidden" name="public" id="save-as-public" value="1">
                </div>
                <button type="submit" class="btn p save-recipe-button">Save recipe</button>
            </div>
        </form>
    </div>

    <?php
}

function addSection($id) {
    ?>
    <div class="add-section" id="<?php echo htmlspecialchars($id); ?>">
        <span class="material-symbols-outlined">add</span>
        <span>ADD SECTION</span>            
    </div>
    <?php
}

function titleInput($name){
    ?>
    <div class="flex">
        <span>•</span>
        <input class="section-title-input" type="text" name="<?php echo htmlspecialchars($name); ?>[0][title]"
        placeholder="Section title (optional)" value="">
    </div>
    <?php
}
?>
