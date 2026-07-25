import { addIngredient, addStep, updateStepNumbers, prepareIngredients, handleAddRecipe, handleAddFromUrl } from "./add-recipe.js";
import { setCurrentExpanded } from "./popstate.js";
import { showLoadedpreview } from "./drag-and-drop.js";

// ── State ─────────────────────────────────────────────────────────────────────

let recipesById    = new Map();
let expandedModal  = null;
let expanded       = false;
let path           = null;
let overlay        = null;
let activeCategory    = null;
let activeSubCategory = null;

const GRAM_UNITS = ['g', 'gram', 'grams'];
const ML_UNITS   = ['ml', 'milliliter', 'milliliters'];

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

    path    = window.location.pathname;
    overlay = document.getElementById('modal-overlay');
    expandedModal = document.getElementById('expanded-modal');

    const personalRecipesButton = document.getElementById("personal-recipes");
    if (personalRecipesButton) {
        const subCategoriesContainer = document.querySelector('.sub-category-buttons');
        if (subCategoriesContainer) {
            subCategoriesContainer.innerHTML = personalRecipesButton.classList.contains("active")
                ? `<button class="nav-buttons" id="favorite-recipes">My go-tos</button>
                   <button class="nav-buttons active" id="new-recipes">Recent</button>
                   <button class="nav-buttons" id="saved-recipes">Saved</button>`
                : `<button class="nav-buttons" id="popular-recipes">Popular</button>
                   <button class="nav-buttons active" id="new-recipes">Recent</button>
                   <button class="nav-buttons" id="saved-recipes">Saved</button>`;
        }
    }

    initEventListeners();

    // Handle direct recipe link e.g. /recipe/42
    const recipeMatch = path.match(/\/recipe\/(\d+)/);
    if (recipeMatch) {
        window.history.replaceState({ type: 'home' }, '', '/');
        const recipeId = recipeMatch[1];
        const response = await fetch('/../api/recipes/fetch_recipes.php', {
            method: 'POST',
            body: new URLSearchParams({ id: recipeId })
        });
        const result = await response.json();
        recipesById.set(recipeId, result[0]);
        pushRecipeState(recipeId);
        expandRecipe(recipeId);
    }
});

document.addEventListener('tagsLoaded', loadRecipes);

// ── Event listeners ───────────────────────────────────────────────────────────

function initEventListeners() {

    const filter_button = document.getElementById('filter-button');
    if (filter_button) {
        filter_button.addEventListener('click', toggleHidden);
        filter_button.menu = "filter-menu";
    }

    const random_button = document.getElementById('random-button');
    if (random_button) {
        random_button.addEventListener('click', randomRecipe);

        document.getElementById("filter-form").addEventListener('submit', (e) => {
            e.preventDefault();
            loadRecipes();
        });

        activeCategory    = document.querySelector('.recipe-category-buttons .nav-buttons.active');
        activeSubCategory = document.querySelector('.sub-category-buttons .nav-buttons.active');

        document.querySelector('.recipe-category-buttons').addEventListener('click', (e) => {
            const button = e.target.closest('.nav-buttons');
            if (!button || button.classList.contains("active")) return;

            document.querySelector('.sub-category-buttons').innerHTML =
                button.id === "personal-recipes"
                    ? `<button class="nav-buttons" id="favorite-recipes">My go-tos</button>
                       <button class="nav-buttons active" id="new-recipes">Recent</button>
                       <button class="nav-buttons" id="saved-recipes">Saved</button>`
                    : `<button class="nav-buttons" id="popular-recipes">Popular</button>
                       <button class="nav-buttons active" id="new-recipes">Recent</button>
                       <button class="nav-buttons" id="saved-recipes">Saved</button>`;

            activeSubCategory = document.querySelector('.sub-category-buttons .nav-buttons.active');
            activeCategory.classList.remove("active");
            button.classList.add("active");
            activeCategory = button;
            loadRecipes();
        });

        document.querySelector('.sub-category-buttons').addEventListener('click', (e) => {
            const button = e.target.closest('.nav-buttons');
            if (!button || button.classList.contains("active")) return;
            activeSubCategory.classList.remove("active");
            button.classList.add("active");
            activeSubCategory = button;
            loadRecipes();
        });
    }

    document.addEventListener('click', (e) => {
        const saveButton = e.target.closest('.saves');
        const card       = e.target.closest('.recipe-card');
        const modal      = e.target.closest('#expanded-modal');

        if (expanded && !modal) {
            window.history.back();
        } else if (saveButton) {
            handleSave(
                parseInt(saveButton.closest('.recipe-card').dataset.id),
                saveButton
            );
        } else if (card) {
            const cardId = parseInt(card.dataset.id);
            if (cardId) {
                pushRecipeState(cardId);
                expandRecipe(cardId);
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape" && expanded) {
            window.history.back();
        }

        const target = e.target;
        if (e.key === "Enter") {
            if (target.classList.contains("instruction-text")) {
                e.preventDefault();
                addStep(target);
            } else if (target.classList.contains("ingredient-text")) {
                e.preventDefault();
                addIngredient(target);
            }
        }

        if (e.key === "Backspace" && target.value === "") {
            if (target.classList.contains("instruction-text")) {
                removeField(target, "instructions", e);
            } else if (target.classList.contains("ingredient-text")) {
                removeField(target, "ingredients", e);
            }
        }
    });

    expandedModal.addEventListener('click', async (e) => {
        if (e.target.id === 'edit-recipe-button')   await handleEdit(parseInt(e.target.dataset.id));
        if (e.target.id === 'delete-recipe-button') await handleDelete(parseInt(e.target.dataset.id));
        if (e.target.classList.contains('close-button'))       window.history.back();
        if (e.target.classList.contains('save-recipe-button')) await handleSave(parseInt(e.target.dataset.id));
        if (e.target.classList.contains('ingredient-checkbox')) {
            e.target.classList.toggle('checked');
            e.target.innerHTML = e.target.classList.contains('checked') ? 'check_circle' : 'circle';
        }
    });

    const profileModal = document.getElementById('profile-modal');
    if (profileModal) {
        document.querySelector('.current-user').addEventListener('click', () => {
            profileModal.classList.toggle('hidden');
        });
    }
}

// ── Routing ───────────────────────────────────────────────────────────────────

function pushRecipeState(id) {
    window.history.pushState({ type: 'recipe', slug: id }, '', `/recipe/${id}`);
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadRecipes() {
    const recipeList = document.getElementById('recipe-list');
    recipeList.innerHTML = '<p>Loading recipes...</p>';
    recipesById.clear();

    const filterForm = document.getElementById('filter-form');
    const formData   = new FormData(filterForm);

    if (activeCategory?.id === "public-recipes") {
        formData.append('public', '1');
    } else if (activeCategory?.id === "friends-recipes") {
        formData.append('category', 'following');
    }

    const userMatch = path.match(/\/?user\/([^\/]+)/);
    if (userMatch) formData.append('user', userMatch[1]);

    if (activeSubCategory?.id === "favorite-recipes") {
        formData.append('category', 'favorites');
        formData.append('order_by', 'most_viewed_by_user');
    } else if (activeSubCategory?.id === "saved-recipes") {
        formData.append('category', 'saved');
    } else if (activeSubCategory?.id === "popular-recipes") {
        formData.append('order_by', 'views');
    }

    const response = await fetch('/../api/recipes/fetch_recipes.php', {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    result.forEach(recipe => recipesById.set(recipe.id, recipe));
    renderRecipes();
}

async function randomRecipe() {
    const formData = new FormData(document.getElementById("filter-form"));
    formData.append('action', 'random');

    const response = await fetch('/../api/recipes/fetch_recipes.php', {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    const recipe  = result[0];
    recipesById.set(recipe.id, recipe);
    pushRecipeState(recipe.id);
    expandRecipe(recipe.id);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderRecipes() {
    const recipeList = document.getElementById('recipe-list');
    let html = '';
    recipesById.forEach(recipe => { html += getRecipeHtml(recipe); });
    recipeList.innerHTML = html || '<p>No recipes found.</p>';
}

function getRecipeImage(recipe) {
    return recipe.image_base
        ? `<img src="/uploads/recipe_pictures/${recipe.image_base}.webp" alt="Recipe Image">`
        : `<div class="placeholder"><span class="material-symbols-outlined">chef_hat</span></div>`;
}

function getRecipeHtml(recipe) {
    let courseType = window.metadata.courseTypes.get(recipe.course_types).name;
    return `
        <div class="recipe-card" data-id="${recipe.id}">
            <a href="/user/${recipe.owner_username}">
                <img class="owner-image"
                    src="/uploads/profile_pictures/${recipe.owner_image ? recipe.owner_image + '.webp' : recipe.owner_username + '_avatar.svg'}"
                    alt="Owner Image">
            </a>
            <div class="recipe-image-container">${getRecipeImage(recipe)}</div>
            <div class="recipe-content">
                <div class="course-type ${courseType}">${courseType}</div>
                <h3>${recipe.title}</h3>
                ${recipe.is_owner ? '' : `<div class="saves ${recipe.is_saved ? 'filled' : ''}"><span class="material-symbols-outlined bookmark-icon">bookmark</span></div>`}
                <p>${recipe.description}</p>
                <div class="time">
                    <div><span class="material-symbols-outlined timer">timer</span>${recipe.prep_time_minutes} MINS PREP</div>
                    <div><span class="material-symbols-outlined timer">timer</span>${recipe.total_time_minutes} MINS TOTAL</div>
                </div>
            </div>
        </div>
    `;
}

// ── Ingredient list renderer ──────────────────────────────────────────────────

function renderIngredients(ingredientsEl, recipeIngredients, coverage = null) {
    if (!recipeIngredients) {
        ingredientsEl.innerHTML = '<p>No ingredients listed.</p>';
        return;
    }

    const parsed = JSON.parse(recipeIngredients);

    ingredientsEl.innerHTML = parsed.map(ingredient => {
        const amount = ingredient.amount ?? '';
        const unit   = ingredient.unit ? ingredient.unit + ' ' : '';
        const size   = ingredient.size ? ingredient.size + ' '  : '';
        const name   = ingredient.name;

        let badge = '';
        if (coverage) {
            if (coverage.included.has(name)) {
                badge = `<span class="ingredient-macro-badge included" title="Included in calorie calculation">
                            <span class="material-symbols-outlined">fitness_center</span>
                         </span>`;
            } else if (coverage.skipped.has(name)) {
                badge = `<span class="ingredient-macro-badge skipped" title="No nutrition data available">
                            <span class="material-symbols-outlined">question_mark</span>
                         </span>`;
            }
        }

        return `<div class="ingredient-item">
            <span class="material-symbols-outlined ingredient-checkbox">circle</span>
            <p>${amount} ${unit}${size}${name}</p>
            ${badge}
        </div>`;
    }).join('');
}

// ── Macro wheel renderer ──────────────────────────────────────────────────────

function formatMacro(value) {
    if (value >= 10) return Math.round(value).toString();   
    if (value >= 1)  return value.toFixed(1);               
    return value.toFixed(1);                                
}

function renderMacroWheel(macrosContainer, ingredientMacrosJson, servings = 1) {
    macrosContainer.innerHTML = '';
    if (!ingredientMacrosJson) return null;

    const macros = typeof ingredientMacrosJson === 'string'
        ? JSON.parse(ingredientMacrosJson)
        : ingredientMacrosJson;

    if (!macros?.length) return null;

    const perServing = Math.max(1, servings || 1);

    const included = [];
    const skipped  = [];

    const VOLUME_TO_ML = { 'ml': 1, 'l': 1000, 'dl': 100, 'tsp': 4.92, 'tbsp': 14.79, 'cup': 240, 'fl_oz': 29.57 };
    const WEIGHT_TO_G = { 'g': 1, 'kg': 1000, 'mg': 0.001, 'oz': 28.3495, 'lb': 453.592 };
    const COUNT_UNITS = ['piece', 'pcs', 'slice', 'clove', 'pinch', 'handful'];

    const totals = macros.reduce((t, macro) => {
        if (macro.calories_per_100g == null) {
            skipped.push(macro.ingredient_name);
            return t;
        }

        let grams = null;
        const unit = macro.unit?.toLowerCase() ?? '';

        if (WEIGHT_TO_G[unit]) {
            grams = macro.amount * WEIGHT_TO_G[unit];
        } else if (VOLUME_TO_ML[unit]) {
            if (macro.grams_per_ml != null) {
                grams = macro.amount * VOLUME_TO_ML[unit] * macro.grams_per_ml;
            }
        } else if (COUNT_UNITS.includes(unit)) {
            if (macro.grams_per_piece != null) {
                grams = macro.amount * macro.grams_per_piece;
            }
        } else if (unit === '') {
            grams = macro.amount;
        }

        if (grams == null || isNaN(grams)) {
            skipped.push(macro.ingredient_name);
            return t;
        }

        included.push(macro.ingredient_name);
        const f = (grams / perServing) / 100;
        t.calories += macro.calories_per_100g * f;
        t.protein  += macro.protein_per_100g  * f;
        t.carbs    += macro.carbs_per_100g    * f;
        t.fat      += macro.fat_per_100g      * f;
        return t;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const protKcal  = totals.protein * 4;
    const carbKcal  = totals.carbs   * 4;
    const fatKcal   = totals.fat     * 9;
    const totalKcal = protKcal + carbKcal + fatKcal;

    const protPct = totalKcal > 0 ? Math.round((protKcal / totalKcal) * 100) : 0;
    const carbPct = totalKcal > 0 ? Math.round((carbKcal / totalKcal) * 100) : 0;
    const fatPct  = totalKcal > 0 ? Math.round((fatKcal  / totalKcal) * 100) : 0;

    const RADIUS        = 38;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    const GAP           = 3;

    const protArc = totalKcal > 0 ? Math.max(0, (protKcal / totalKcal) * CIRCUMFERENCE - GAP) : 0;
    const carbArc = totalKcal > 0 ? Math.max(0, (carbKcal / totalKcal) * CIRCUMFERENCE - GAP) : 0;
    const fatArc  = totalKcal > 0 ? Math.max(0, (fatKcal  / totalKcal) * CIRCUMFERENCE - GAP) : 0;

    const protOffset = 0;
    const carbOffset = -(protArc + GAP);
    const fatOffset  = -(protArc + GAP + carbArc + GAP);

    const cal  = Math.round(totals.calories);
    const prot = formatMacro(totals.protein);
    const carb = formatMacro(totals.carbs);
    const fat  = formatMacro(totals.fat);

    macrosContainer.innerHTML = `
        <div class="macro-ring-container">
            <svg class="macro-ring" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="${RADIUS}" class="macro-ring-background"></circle>
                <circle cx="50" cy="50" r="${RADIUS}" class="macro-ring-protein"
                    transform="rotate(-90 50 50)"
                    style="stroke-dasharray: ${protArc} ${CIRCUMFERENCE}; stroke-dashoffset: ${protOffset}"></circle>
                <circle cx="50" cy="50" r="${RADIUS}" class="macro-ring-carbs"
                    transform="rotate(-90 50 50)"
                    style="stroke-dasharray: ${carbArc} ${CIRCUMFERENCE}; stroke-dashoffset: ${carbOffset}"></circle>
                <circle cx="50" cy="50" r="${RADIUS}" class="macro-ring-fat"
                    transform="rotate(-90 50 50)"
                    style="stroke-dasharray: ${fatArc} ${CIRCUMFERENCE}; stroke-dashoffset: ${fatOffset}"></circle>
                <text x="50" y="48" text-anchor="middle" dominant-baseline="auto" class="macro-calories">${cal}</text>
                <text x="50" y="58" text-anchor="middle" dominant-baseline="auto" class="macro-calories-label">kcal / serving</text>
            </svg>
            <div class="macro-legend">
                <div class="macro-legend-item protein">
                    <span class="macro-label">Protein <span class="macro-pct">(${protPct}%)</span></span>
                    <span class="macro-value">${prot}g</span>
                </div>
                <div class="macro-legend-item carbs">
                    <span class="macro-label">Net Carbs <span class="macro-pct">(${carbPct}%)</span></span>
                    <span class="macro-value">${carb}g</span>
                </div>
                <div class="macro-legend-item fat">
                    <span class="macro-label">Fat <span class="macro-pct">(${fatPct}%)</span></span>
                    <span class="macro-value">${fat}g</span>
                </div>
            </div>
        </div>
    `;

    return {
        included: new Set(included),
        skipped:  new Set(skipped)
    };
}

// ── Expand / close recipe ─────────────────────────────────────────────────────

export function expandRecipe(recipeId) {
    setCurrentExpanded('recipe');
    expanded = true;

    const id     = recipeId;
    const recipe = recipesById.get(id);

    document.title = `${recipe.title} - food decider`;

    // Grab all the DOM targets once
    const ingredientsEl  = expandedModal.querySelector('.ingredient-list');
    const macrosContainer = expandedModal.querySelector('.macro-list');
    const image          = expandedModal.querySelector('.expanded-recipe-image');
    const views          = expandedModal.querySelector('.views');
    const recipeActions  = expandedModal.querySelector('.recipe-actions');
    const title          = expandedModal.querySelector('.recipe-title');
    const description    = expandedModal.querySelector('.recipe-description');
    const steps          = expandedModal.querySelector('.steps');
    const time           = expandedModal.querySelector('.recipe-time');
    const attributes     = expandedModal.querySelector('.recipe-attribues');
    const recipeOwner    = expandedModal.querySelector('.recipe-owner');
    // const servings       = expandedModal.querySelector('.ingredient-servings');

    // Render macro wheel first so we get coverage back
    const coverage = renderMacroWheel(macrosContainer, recipe.ingredient_macros, recipe.servings);

    // Render ingredients with coverage badges
    renderIngredients(ingredientsEl, recipe.recipe_ingredients, coverage);

    // servings.textContent = recipe.servings ? `${recipe.servings} servings` : '';

    recipeOwner.innerHTML = `
        <a class="recipe-userinfo" href="/user/${recipe.owner_username}">
            <img class="owner-profile-pic"
                src="/uploads/profile_pictures/${recipe.owner_image ? recipe.owner_image + '.webp' : recipe.owner_username + '_avatar.svg'}"
                alt="Owner Image">
            <div>
                <h4>Archived by</h4>
                <h4 class="recipe-owner-username">${recipe.owner_username}</h4>
            </div>
        </a>`;

    attributes.innerHTML = recipe.attributes
        ? JSON.parse(recipe.attributes).map(a => `<span class="pill">${a.name}</span>`).join('')
        : '';

    time.innerHTML = `
        <div class="recipe-time-section">
            <h5>PREP TIME</h5>
            <span>${recipe.prep_time_minutes} Mins</span>
        </div>
        <span class="divider"></span>
        <div class="recipe-time-section">
            <h5>TOTAL TIME</h5>
            <span>${recipe.total_time_minutes} Mins</span>
        </div>
        <span class="divider"></span>
        <div class="recipe-time-section">
            <h5>SERVINGS</h5>
            <span>${recipe.servings ? recipe.servings + ' Servings' : '1 Serving'}</span>
        </div>
        `;
        

    title.textContent       = recipe.title;
    description.textContent = recipe.description;
    image.innerHTML         = getRecipeImage(recipe);
    views.innerHTML         = `<span class="material-symbols-outlined">visibility</span><p>${recipe.view_count} views</p>`;

    if (recipe.recipe_steps) {
        steps.innerHTML = JSON.parse(recipe.recipe_steps).map(step => {
            const n = step.step_number < 10 ? `0${step.step_number}` : step.step_number;
            return `<div class="flex">
                <div class="instruction-number-expanded">${n}</div>
                <p class="instruction-text">${step.content}</p>
            </div>`;
        }).join('');
    } else {
        steps.innerHTML = '<p>No instructions listed.</p>';
    }

    recipeActions.innerHTML = recipe.is_owner
        ? `<button class="recipe-action-button" id="edit-recipe-button" data-id="${id}">Edit Recipe</button>
           <button class="recipe-action-button" id="delete-recipe-button" data-id="${id}">Delete Recipe</button>`
        : `<button class="add-button ${recipe.is_saved ? 'filled' : ''}" data-id="${id}">
               <span class="material-symbols-outlined">bookmark</span>
               ${recipe.is_saved ? 'Remove from favorites' : 'Save to Favorites'}
           </button>
           ${recipe.link ? `<a href="${recipe.link}" target="_blank" class="external-link-button">
               <span class="material-symbols-outlined">open_in_new</span>Open Recipe External Link
           </a>` : ''}`;

    expandedModal.classList.toggle("hidden");
    toggleOverlay();

    fetch('/api/recipes/register_view.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: id })
    });
}

export function closeRecipe() {
    expanded = false;
    toggleOverlay();
    expandedModal.classList.toggle("hidden");
    document.title = 'Recipes - food decider';
}

// ── Edit ──────────────────────────────────────────────────────────────────────


// Todo Create the submitFork function and implement a fork counter in recipe table

async function forkRecipe(recipeId) {
    grabAndDisplayEdit(recipeId);
    form.removeEventListener('submit', handleAddRecipe);
    form.addEventListener('submit', submitFork);

}

async function handleEdit(recipeId) {
    form.removeEventListener('submit', handleAddRecipe);
    form.addEventListener('submit', submitEdit);
    
    grabAndDisplayEdit(recipeId);
}

async function grabAndDisplayEdit(recipeId) {
    const recipe = recipesById.get(recipeId);
    if (!recipe) { alert('Recipe not found'); return; }

    const form = document.getElementById('add-recipe-form');
    form.dataset.id = recipeId;
    form.id = "edit-recipe-form";
    form.querySelector('legend').textContent              = 'Edit Recipe';
    form.querySelector('.save-recipe-button').value       = 'Update Recipe';
    form.querySelector('#name').value                     = recipe.title;
    form.querySelector('#description').value              = recipe.description;
    form.querySelector('#prep').value                     = recipe.prep_time_minutes;
    form.querySelector('#cook').value                     = recipe.total_time_minutes - recipe.prep_time_minutes;
    form.querySelector('#servings').value                 = recipe.servings;
    form.querySelector('#link').value                     = recipe.link ?? '';

    const courseTypeSelect = form.querySelector('#course');
    if (recipe.course_types) courseTypeSelect.value = recipe.course_types;

    if (recipe.attributes) {
        const recipeAttributes = JSON.parse(recipe.attributes).map(a => a.id);
        for (const attr of form.querySelector('.attributes').children) {
            if (recipeAttributes.includes(parseInt(attr.dataset.id))) {
                attr.classList.add('selected');
            }
        }
    }

    form.querySelector('#selected-attributes').value = JSON.stringify(
        [...form.querySelectorAll('.attribute.selected')].map(el => el.dataset.id)
    );

    showLoadedpreview(recipe.image_base ? `/uploads/recipe_pictures/${recipe.image_base}.webp` : '');

    const ingredientsContainer = form.querySelector('#ingredients');
    ingredientsContainer.innerHTML = '';
    if (recipe.recipe_ingredients) {
        JSON.parse(recipe.recipe_ingredients).forEach(ingredient => {
            const amount = ingredient.amount ?? '';
            const unit   = ingredient.unit ? ingredient.unit + ' ' : '';
            const size   = ingredient.size ? ingredient.size + ' ' : '';
            const item   = document.createElement('div');
            item.classList.add('ingredient-item');
            item.innerHTML = `
                <span>•</span>
                <input class="ingredient-text" name="ingredients[]" value="${amount} ${unit}${size}${ingredient.name}">
            `;
            ingredientsContainer.appendChild(item);
        });
    }

    const instructionsContainer = form.querySelector('#instructions');
    instructionsContainer.innerHTML = '';
    if (recipe.recipe_steps) {
        JSON.parse(recipe.recipe_steps).forEach(step => {
            const item = document.createElement('div');
            item.classList.add('instruction-box');
            item.innerHTML = `
                <span class="instruction-number">${step.step_number}</span>
                <input class="instruction-text" type="text" name="steps[]" value="${step.content}">
            `;
            instructionsContainer.appendChild(item);
        });
    }

    document.getElementById('expanded-modal').classList.toggle("hidden");
    document.getElementById('add-menu').classList.toggle("hidden");
}

async function submitEdit(e) {
    e.preventDefault();
    const form      = e.target;
    const recipeId  = parseInt(form.dataset.id);

    try {
        const response = await fetch(`/../api/recipes/update_recipe.php?id=${recipeId}`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update recipe');

        recipesById.set(recipeId, result.recipe);
        renderRecipes();
        document.getElementById('add-menu').classList.toggle("hidden");
        showNotification('Recipe updated successfully');
    } catch (error) {
        console.error('Error updating recipe:', error);
        alert('Failed to update recipe: ' + error.message);
    }
}

async function submitFork() {
// TODO implement, DO NOT use handle edit as a template, 
//that function is deprecated and should be updated to new html5 methods
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function handleDelete(recipeId) {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    const response = await fetch(`/../api/recipes/delete_recipe.php?recipe_id=${recipeId}`);
    const result   = await response.json();

    if (result.success) {
        document.querySelector(`.recipe-card[data-id="${recipeId}"]`)?.remove();
        closeRecipe();
    } else {
        alert('Failed to delete recipe: ' + result.error);
    }
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function handleSave(recipeId, element) {
    element?.classList.toggle('filled');
    const response = await fetch('/../api/recipes/save_recipe.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipeId })
    });
    const data = await response.json();
    showNotification(data.status === 'saved' ? 'Recipe saved!' : 'Recipe removed from favorites.');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function removeField(input, type, event) {
    event.preventDefault();
    const container = document.getElementById(type);
    if (container.children.length === 1) return;
    const parent = input.parentElement;
    parent.previousElementSibling?.querySelector('input')?.focus();
    parent.remove();
    if (type === "instructions") updateStepNumbers();
}

function showNotification(message) {
    const n = document.createElement('div');
    n.className   = 'notification';
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

function toggleOverlay() {
    overlay.classList.toggle('hidden');
}

export function toggleHidden(evt) {
    const menu = document.getElementById(evt.currentTarget.menu);
    menu.classList.toggle("hidden");

    if (menu.id === "add-menu") {
        const form = document.getElementById("add-recipe-form");
        if (!form.hasListener) {
            form.addEventListener('submit', handleAddRecipe);
            form.hasListener = true;
        }
    }
    if (menu.id === "add-from-url-modal") {
        const form = document.getElementById("import-url-form");
        if (!form.hasListener) {
            form.addEventListener('submit', handleAddFromUrl);
            form.hasListener = true;
        }
    }
}