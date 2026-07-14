<?php

require_once __DIR__ . '/session.php';


function getUser()
{
    $userLoggedIn = isset($_SESSION['user_id']);
    $user = null;

    if ($userLoggedIn) {
        $user = grabUserInfo($_SESSION['user_id']);
    }
    return $user;
}

function getNavBar($navButtons = false)
{
    $user = getUser();
    ?>
    <nav>
        <a href="/" class="home-button">FoodDecider</a>

        <?php if ($navButtons): ?>
            <div class="recipe-category-buttons">
                <button class="nav-buttons active" id="personal-recipes">My Collection</button>
                <button class="nav-buttons" id="friends-recipes">Following</button>
                <button class="nav-buttons" id="public-recipes">Discover</button>
            </div>
        <?php endif; ?>
        <!-- Search bar -->
        <form action="/search.html" method="GET" class="search-bar">
            <span class="material-symbols-outlined">search</span>
            <input class="search" type="text" name="search" placeholder="Search recipes or profiles...">
            <button type="submit" class="search-button">Search</button>
        </form>
        <div class="current-user">

            <?php if ($user): ?>
                <?php if ($user['image_base']): ?>
                    <img src="/uploads/profile_pictures/<?php echo htmlspecialchars($user['image_base']); ?>.webp"
                        alt="Profile Picture" class="profile-picture">
                <?php else: ?>
                    <img src="/uploads/profile_pictures/<?php echo htmlspecialchars($user['username']); ?>_avatar.svg"
                        alt="Profile Picture" class="profile-picture">
                <?php endif; ?>
            <?php else: ?>
                <button id="log-in">Sign-up / Log-in</button>
            <?php endif; ?>
        </div>
    </nav>
    <?php
}

function getExpandedModal()
{
    $user = getUser();
    ?>

    <div class="modal flex hidden" id="expanded-modal">
        <div class="modal-content">
            <div class="left-side-expanded">
                <div class="expanded-recipe-image"></div>
                <div class="recipe-attribues"></div>
                <div class="views"></div>
                <div class="ingredients">
                    <div class="flex">
                        <h4>THE INGREDIENTS</h4>
                    </div>
                    <div class="ingredient-list"></div>
                </div>
                <div class="recipe-actions"></div>
            </div>
            <div class="right-hand-expanded">
                <span class="close-button">&times;</span>
                <div class="recipe-owner"></div>
                <h2 class="recipe-title"></h2>
                <div class="recipe-description"></div>
                <div class="recipe-meta">
                    <hr>
                    <div class="recipe-time"></div>
                    <hr>
                </div>
                <div class="macros">
                    <h5>Nutrition Information</h5>
                    <div class="macro-list"></div>
                    <hr>
                </div>

                <div class="steps"></div>
            </div>
        </div>
    </div>
    <?php
}

function getUserProfileModal()
{
    $user = getUser();
    if (!$user)
        return;
    ?>
    <div class="modal hidden" id="profile-modal">
        <div class="user-info"><?php echo htmlspecialchars($user['username']); ?></div>
        <div class="flex">
            <a href="/user/<?php echo htmlspecialchars($user['username']); ?>">View profile</a>
            <a href="/auth/logout.php"> <span class="material-symbols-outlined">logout</span> Log out</a>
        </div>
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
        <form id="filter-form">
            <fieldset>
                <legend>Filter recipes</legend>
                <div class="meta-data-container">
                    <div class="course-types-container">
                        <p>Course types</p>
                    </div>
                    <div class="attributes-container">
                        <p>Attributes</p>
                        <div class="attributes"></div>
                    </div>
                </div>
                <input type="hidden" name="attributes" id="selected-attributes">
                <input type="hidden" name="course" id="selected-course">

                <div class="ingredients-container">
                    <label for="ingredients">Ingredients</label>
                    <div class="ingredient-item"><span>•</span><input class="ingredient-text" name="ingredients[]"
                            placeholder="Enter an ingredient"></div>
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

                <input type="submit" value="Apply filters">
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
            <input type="text" name="url" id="url" placeholder="Enter the URL of the recipe page">
            <button type="submit">Import Recipe</button>
        </form>
    </div>

    <div class="modal hidden" id="add-menu">
        <form id="add-recipe-form">
            <fieldset>
                <div class="add-header">
                    <legend>Add Recipe</legend>

                    <div class="public-checkbox" id="public-checkbox-container">
                        <button type="button" class="private-button" id="private">PRIVATE</button>
                        <button type="button" class="public-button selected" id="public" class="active">PUBLIC</button>
                        <input type="hidden" name="public" id="save-as-public" value="1">
                    </div>

                    <div class="save-button">
                        <span class="material-symbols-outlined">publish</span>
                        <input type="submit" value="Save Recipe" class="save-recipe-button">
                    </div>
                </div>
                <div class="flex">
                    <div class="upload-box" id="uploadBox">
                        <input name="picture" type="file" id="picture" accept="image/*" hidden>
                        <label for="picture" class="upload-label">
                            <div class="upload-content" id="uploadContent">
                                <span class="material-symbols-outlined icon-background">add_a_photo</span>
                                <p>Upload a recipe photo</p>
                                <p>JPG, PNG or WEBP format</p>
                            </div>
                            <img id="preview" class="preview hidden">
                        </label>
                    </div>
                    <div class="flex-grow">
                        <div class="input-field">
                            <label for="name">RECIPE TITLE</label>
                            <input type="text" name="name" id="name" value="test" autocomplete="off">
                        </div>

                        <div class="input-field">
                            <label for="description">DESCRIPTION</label>
                            <input type="text" name="description" id="description" value="test">
                        </div>

                        <div class="flex">
                            <div>
                                <label for="course">COURSE TYPE</label>
                                <select class="course-dropdown" name="course" id="course"></select>
                            </div>
                            <div class="flex-grow">
                                <div class="flex">
                                    <label for="link">REFERENCE LINK</label>
                                    <span class="material-symbols-outlined link-icon">link</span>
                                </div>
                                <input type="text" name="link" id="link" value="test">
                            </div>
                        </div>

                    </div>
                </div>
                <div class="time-and-serving-box flex">
                    <div class="flex">
                        <span class="material-symbols-outlined icon-background">timer</span>
                        <div class="compact-input-field">
                            <label for="prep">PREP TIME</label>
                            <input type="text" name="prep" id="prep" value="10">
                        </div>
                    </div>
                    <div class="flex">
                        <span class="material-symbols-outlined icon-background">cooking</span>
                        <div class="compact-input-field">
                            <label for="cook">COOK TIME</label>
                            <input type="text" name="cook" id="cook" value="30">
                        </div>
                    </div>
                    <div class="flex">
                        <span class="material-symbols-outlined icon-background">group</span>
                        <div class="compact-input-field">
                            <label for="servings">SERVINGS</label>
                            <input type="text" name="servings" id="servings" value="4">
                        </div>
                    </div>
                </div>

                <div class="flex align-start">
                    <div class="flex-grow">
                        <div class="flex">
                            <h4>INSTRUCTIONS</h4>
                            <div class="add-step" id="add-step">
                                <span class="material-symbols-outlined">add</span>
                                <span>ADD STEP</span>
                            </div>
                        </div>

                        <div id="instructions">
                            <!-- Section 0 (default, no title) -->
                            <div class="section-group" data-section="0">
                                <?php titleInput('step_sections'); ?>
                                <div class="instruction-container">
                                    <div class="instruction-box">
                                        <span class="instruction-number">01</span>
                                        <input class="instruction-text" type="text" name="step_sections[0][steps][]"
                                            value="test">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <?php addSection('add-step-section'); ?>
                    </div>

                    <div>
                        <div class="flex">
                            <h4>INGREDIENTS</h4>
                                <div class="add-step" id="add-ingredient">
                                <span class="material-symbols-outlined">add</span>
                                <span>ADD INGREDIENT</span>
                            </div>
                        </div>

                        <div id="ingredients">
                            <!-- Section 0 (default) -->
                            <div class="section-group" data-section="0">
                                <?php titleInput('ingredient_sections'); ?>
                                <div class="ingredients-container">
                                    <div class="ingredient-item">
                                        <span>•</span>
                                        <input type="text" name="ingredient_sections[0][ingredients][]"
                                            class="ingredient-text" value="test" autocomplete="off">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <?php addSection('add-ingredient-section'); ?>
                        <div class="autocomplete-list"></div>
                    </div>
                </div>

                <input type="hidden" name="attributes" id="selected-attributes">
            </fieldset>
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