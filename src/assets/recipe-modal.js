import { handleEdit } from './edit-recipe.js';
import { escapeHtml, getRecipeImage } from './recipe-cards.js';
import { fetchRecipeById, parseJson, groupBySection } from './recipe-data.js';
import { toast } from './toast.js';

let overlay, expandedModal, expanded = false;

export function init() {
    overlay = document.getElementById('modal-overlay');
    expandedModal = document.getElementById('expanded-modal');
    if (!expandedModal) return; // page has no modal

    document.addEventListener('click', (e) => {
        const saveButton = e.target.closest('.saves');
        const card = e.target.closest('.recipe-card');
        const modal = e.target.closest('#expanded-modal');

        if (expanded && !modal) {
            history.back();
        } else if (saveButton) {
            handleSave(parseInt(saveButton.closest('.recipe-card').dataset.id), saveButton);
        } else if (card) {
            const id = parseInt(card.dataset.id);
            if (id) { 
                pushRecipeState(id); 
                expandRecipe(id);
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && expanded) history.back();
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

    // direct link: /recipe/42
    const match = location.pathname.match(/\/recipe\/(\d+)/);
    if (match) {
        history.replaceState({ type: 'home' }, '', '/');
        const id = parseInt(match[1]);
        pushRecipeState(id);
        expandRecipe(id);
    }
}

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

export function pushRecipeState(id) {
    history.pushState({ type: 'recipe', slug: id }, '', `/recipe/${id}`);
}

function renderIngredients(ingredientsEl, recipeIngredients, recipeSections, coverage = null) {
    const ingredients = parseJson(recipeIngredients);

    if (!ingredients.length) {
        ingredientsEl.innerHTML = '<p>No ingredients listed.</p>';
        return;
    }

    const groups = groupBySection(ingredients, parseJson(recipeSections));

    ingredientsEl.innerHTML = renderGrouped(groups, ingredient => {
        const amount = ingredient.amount ?? '';
        const unit   = ingredient.unit ? ingredient.unit + ' ' : '';
        const size   = ingredient.size ? ingredient.size + ' ' : '';
        const name   = ingredient.name;   // raw name for the coverage lookup

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
            <p>${amount} ${unit}${size}${escapeHtml(name)}</p>
            ${badge}
            <button class="ingredient-add-button" title="Add to shopping list" aria-label="Add to shopping list">
                <span class="material-symbols-outlined">add</span>
            </button>
        </div>`;
    });
}

function renderGrouped(groups, renderItem) {
    return groups.map(group => {
        const heading = group.name
            ? `<h4 class="section-heading">${escapeHtml(group.name)}</h4>`
            : '';
        return heading + group.items.map(renderItem).join('');
    }).join('');
}

function renderSteps(stepsEl, recipe) {
    const steps = parseJson(recipe.recipe_steps);

    if (!steps.length) {
        stepsEl.innerHTML = '<p>No instructions listed.</p>';
        return;
    }

    const groups = groupBySection(steps, parseJson(recipe.recipe_step_sections));

    stepsEl.innerHTML = renderGrouped(groups, step => {
        const n = String(step.step_number).padStart(2, '0');
        return `<div class="flex">
            <div class="instruction-number-expanded">${n}</div>
            <p class="instruction-text">${escapeHtml(step.content)}</p>
        </div>`;
    });
}

export async function expandRecipe(recipeId) {
    expanded = true;

    const id = recipeId;
    let recipe = await fetchRecipeById(recipeId);
    
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
    const tags           = expandedModal.querySelector('.recipe-tags');
    const recipeOwner    = expandedModal.querySelector('.recipe-owner');
    // const servings       = expandedModal.querySelector('.ingredient-servings');

    // Render macro wheel first so we get coverage back
    const coverage = renderMacroWheel(macrosContainer, recipe.ingredient_macros, recipe.servings);

    // Render ingredients with coverage badges
    renderIngredients(ingredientsEl, recipe.recipe_ingredients, recipe.recipe_ingredient_sections, coverage);

    // servings.textContent = recipe.servings ? `${recipe.servings} servings` : '';

    recipeOwner.innerHTML = `
        <a class="recipe-userinfo" href="/user/${escapeHtml(recipe.owner_username)}">
            <img class="owner-profile-pic"
                src="/uploads/profile_pictures/${recipe.owner_image ? recipe.owner_image + '.webp' : recipe.owner_username + '_avatar.svg'}"
                alt="Owner Image">
            <div>
                <h4>Archived by</h4>
                <h4 class="recipe-owner-username">${escapeHtml(recipe.owner_username)}</h4>
            </div>
    </a>`;

    tags.innerHTML = recipe.recipe_tags ? JSON.parse(recipe.recipe_tags).map(t => `<a href="/results?q=${encodeURIComponent(t.name)}" class="pill">${t.name}</a>`).join('') : '';

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

    renderSteps(steps, recipe);

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

    expandedModal.classList.remove("hidden");
    overlay.classList.remove('hidden');

    fetch('/api/recipes/register_view.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: id })
    });
}

export function closeRecipe() {
    expanded = false;
    expandedModal.classList.add("hidden");
    overlay.classList.add('hidden');
    document.title = 'Recipes - food decider';
}

async function handleDelete(recipeId) {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    const response = await fetch(`/api/recipes/delete_recipe.php?recipe_id=${recipeId}`);
    const result   = await response.json();

    if (result.success) {
        document.querySelector(`.recipe-card[data-id="${recipeId}"]`)?.remove();
        history.back();
        closeRecipe();
    } else {
        toast.error('Failed to delete recipe');
    }
}

export async function handleSave(recipeId, element) {
    element?.classList.toggle('filled');
    const response = await fetch('/api/recipes/save_recipe.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipeId })
    });
    const data = await response.json();
    toast.success(data.status === 'saved' ? 'Recipe saved!' : 'Recipe removed from favorites.');
}