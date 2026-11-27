// assets/recipe-modal.js
// The recipe view: opening a recipe (from a card, the pick card, a link or the back button),
// and everything you can do in it: save, share, fork, edit, delete, tick off ingredients.

import { handleEdit } from './edit-recipe.js';
import { escapeHtml, getRecipeImage, avatarUrl, getCourseName, formatMinutes } from './recipe-cards.js';
import { fetchRecipeById, parseJson, groupBySection } from './recipe-data.js';
import { toast } from './toast.js';
import { confirmDialog } from './dialog.js';
import { forkRecipe } from './fork-recipe.js';
import { api, requireLogin, copyText, bumpCount, plural } from './ui.js';

// Only real web links become clickable: a saved "javascript:..." link would run on click
function safeHttpUrl(value) {
    try {
        const url = new URL(String(value), location.origin);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
}

let overlay, expandedModal, expanded = false;
let current = null;          // the recipe on screen
let openToken = 0;           // ignore slow answers for a recipe the user already left

const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));

export function init() {
    overlay = document.getElementById('modal-overlay');
    expandedModal = document.getElementById('expanded-modal');
    if (!expandedModal) return; // page has no modal

    document.addEventListener('click', (e) => {
        // Outside the recipe = on the dark backdrop. Clicks in dialogs, toasts or menus opened
        // from the recipe (like "Add to list") are not "outside" and must not close it.
        if (expanded) {
            if (e.target === overlay && !dialogOpen()) history.back();
            return;
        }
        const saveButton = e.target.closest('.recipe-card .saves');
        const card = e.target.closest('.recipe-card');
        if (saveButton) {
            handleSave(parseInt(card.dataset.id));
        } else if (card) {
            openRecipe(parseInt(card.dataset.id));
        }
    });

    // Cards can be opened with the keyboard too
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && expanded && !dialogOpen()) history.back();
        const card = e.target.closest?.('.recipe-card');
        if (card && !expanded && (e.key === 'Enter' || e.key === ' ') && e.target === card) {
            e.preventDefault();
            openRecipe(parseInt(card.dataset.id));
        }
    });

    expandedModal.addEventListener('click', async (e) => {
        const target = e.target.closest('button, a, .ingredient-item');
        if (!target || !current) return;
        const id = current.id;

        if (target.classList.contains('close-button'))   return history.back();
        if (target.id === 'edit-recipe-button')         return handleEdit(id);
        if (target.id === 'delete-recipe-button')       return handleDelete(id);
        if (target.classList.contains('rv-save'))       return handleSave(id);
        if (target.classList.contains('rv-share'))      return shareRecipe(current);
        if (target.id === 'fork-recipe-button') {
            if (await requireLogin('fork recipes and make your own version')) forkRecipe(id);
            return;
        }
        if (target.classList.contains('forked-from-link')) {
            e.preventDefault();
            return openRecipe(parseInt(target.dataset.id));
        }
        // Tap an ingredient to tick it off (the + button adds it to the shopping list instead)
        if (target.classList.contains('ingredient-item')) toggleIngredient(target);
    });

    expandedModal.addEventListener('keydown', (e) => {
        const item = e.target.closest('.ingredient-item');
        if (item && (e.key === 'Enter' || e.key === ' ') && e.target === item) {
            e.preventDefault();
            toggleIngredient(item);
        }
    });

    // After adding, editing or forking: show the result
    document.addEventListener('recipe:saved', (e) => {
        if (e.detail?.open && e.detail.id) openRecipe(e.detail.id);
    });

    // Direct link: /recipe/42
    const match = location.pathname.match(/\/recipe\/(\d+)/);
    if (match) {
        history.replaceState({ type: 'home' }, '', '/');
        openRecipe(parseInt(match[1]));
    }
}

/** Open a recipe and add it to the browser history, so Back closes it. */
export function openRecipe(id) {
    if (!id) return;
    if (expanded) history.replaceState({ type: 'recipe', slug: id }, '', `/recipe/${id}`);   // recipe -> recipe: one Back
    else pushRecipeState(id);
    expandRecipe(id);
}

function toggleIngredient(item) {
    const on = item.getAttribute('aria-pressed') !== 'true';
    item.setAttribute('aria-pressed', String(on));
    const icon = item.querySelector('.ingredient-checkbox');
    icon.classList.toggle('checked', on);
    icon.textContent = on ? 'check_circle' : 'circle';
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

    // Nothing matched the nutrition database: say so instead of drawing a ring of zeros
    const section = macrosContainer.closest('.macros');
    if (!included.length) {
        macrosContainer.innerHTML = '<p class="rv-muted">No nutrition data for these ingredients yet.</p>';
        return null;   // no "?" on every ingredient either: the note above already says it
    }
    section?.removeAttribute('hidden');

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
        ingredientsEl.innerHTML = '<p class="rv-muted">No ingredients listed.</p>';
        return;
    }

    const groups = groupBySection(ingredients, parseJson(recipeSections));

    ingredientsEl.innerHTML = renderGrouped(groups, ingredient => {
        const amount = ingredient.amount != null ? formatAmount(ingredient.amount) + ' ' : '';
        const unit   = ingredient.unit ? ingredient.unit + ' ' : '';
        const size   = ingredient.size ? ingredient.size + ' ' : '';
        const name   = ingredient.name;   // raw name for the coverage lookup

        let badge = '';
        if (coverage?.skipped.has(name)) {
            badge = `<span class="ingredient-macro-badge skipped" title="Not counted in the nutrition (no data)">
                        <span class="material-symbols-outlined">question_mark</span>
                     </span>`;
        }

        return `<div class="ingredient-item" role="button" tabindex="0" aria-pressed="false">
            <span class="material-symbols-outlined ingredient-checkbox" aria-hidden="true">circle</span>
            <p>${escapeHtml(amount)}${escapeHtml(unit)}${escapeHtml(size)}${escapeHtml(name)}</p>
            ${badge}
            <button type="button" class="ingredient-add-button" title="Add to shopping list" aria-label="Add ${escapeHtml(name)} to shopping list">
                <span class="material-symbols-outlined">add</span>
            </button>
        </div>`;
    });
}

// 0.5 -> "0.5", 2 -> "2", 0.333333 -> "0.33"
function formatAmount(value) {
    const n = Number(value);
    return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : String(value);
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
        stepsEl.innerHTML = '<p class="rv-muted">No steps listed.</p>';
        return;
    }

    const groups = groupBySection(steps, parseJson(recipe.recipe_step_sections));

    stepsEl.innerHTML = renderGrouped(groups, step => {
        const n = String(step.step_number).padStart(2, '0');
        return `<div class="flex rv-step">
            <div class="instruction-number-expanded">${escapeHtml(n)}</div>
            <p class="instruction-text">${escapeHtml(step.content)}</p>
        </div>`;
    });
}

// ── Header: who made it, numbers, buttons ────────────────────────────────────

function renderHeader(recipe) {
    const q = sel => expandedModal.querySelector(sel);

    q('.recipe-owner').innerHTML = `
        <a class="recipe-userinfo" href="/user/${encodeURIComponent(recipe.owner_username)}">
            <img class="owner-profile-pic" src="${avatarUrl(recipe.owner_username, recipe.owner_image)}"
                 data-fallback="${avatarUrl(recipe.owner_username, recipe.owner_image, '')}" alt="">
            <span>by <strong class="recipe-owner-username">${escapeHtml(recipe.owner_username)}</strong></span>
        </a>`;

    q('.recipe-title').textContent = recipe.title;
    q('.recipe-description').textContent = recipe.description || '';

    // Forked from another recipe: link to it (only sent when the original still exists and is visible)
    const forked = q('.recipe-forked-from');
    forked.hidden = !recipe.forked_from_id;
    forked.innerHTML = recipe.forked_from_id
        ? `<span class="material-symbols-outlined" aria-hidden="true">call_split</span>
           Forked from <a href="/recipe/${Number(recipe.forked_from_id)}" class="forked-from-link" data-id="${Number(recipe.forked_from_id)}">${escapeHtml(recipe.forked_from_title)}</a>
           ${recipe.forked_from_username ? `by ${escapeHtml(recipe.forked_from_username)}` : ''}`
        : '';

    const course = getCourseName(recipe);
    q('.course-type').textContent = course ? course[0].toUpperCase() + course.slice(1) : '';
    q('.views').textContent = plural(Number(recipe.view_count) || 0, 'view');
    q('.views').dataset.count = Number(recipe.view_count) || 0;
    q('.rv-saves').textContent = plural(Number(recipe.saves) || 0, 'save');
    q('.rv-saves').dataset.count = Number(recipe.saves) || 0;
    const forks = Number(recipe.fork_count) || 0;
    q('.rv-forks').textContent = forks ? plural(forks, 'fork') : '';
    q('.rv-forks').hidden = !forks;

    const hasPrep = Number(recipe.prep_time_minutes) > 0;
    const servings = Number(recipe.servings) || 0;
    q('.recipe-time').innerHTML = `
        ${hasPrep ? `<div class="recipe-time-section"><h5>Prep</h5><span>${formatMinutes(recipe.prep_time_minutes)}</span></div>` : ''}
        <div class="recipe-time-section"><h5>${hasPrep ? 'Total' : 'Time'}</h5><span>${formatMinutes(recipe.total_time_minutes)}</span></div>
        ${servings ? `<div class="recipe-time-section"><h5>Serves</h5><span>${servings}</span></div>` : ''}`;

    q('.recipe-tags').innerHTML = parseJson(recipe.recipe_tags).map(t =>
        `<a href="/results?q=${encodeURIComponent(t.name)}" class="pill">${escapeHtml(t.name)}</a>`).join('');

    const link = safeHttpUrl(recipe.link);
    const share = `<button type="button" class="btn rv-share"><span class="material-symbols-outlined" aria-hidden="true">share</span>Share</button>`;
    q('.recipe-actions').innerHTML = recipe.is_owner
        ? `<button type="button" class="btn p" id="edit-recipe-button"><span class="material-symbols-outlined" aria-hidden="true">edit</span>Edit</button>
           ${share}
           <button type="button" class="btn danger-quiet" id="delete-recipe-button"><span class="material-symbols-outlined" aria-hidden="true">delete</span>Delete</button>`
        : `${saveButtonHtml(recipe.is_saved)}
           ${share}
           <button type="button" class="btn" id="fork-recipe-button"><span class="material-symbols-outlined" aria-hidden="true">call_split</span>Fork</button>
           ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer nofollow" class="btn">
               <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>Original</a>` : ''}`;
}

function saveButtonHtml(saved) {
    return `<button type="button" class="btn p rv-save" aria-pressed="${saved}">
        <span class="material-symbols-outlined" aria-hidden="true">bookmark</span>${saved ? 'Saved' : 'Save'}</button>`;
}

// ── Opening and closing ──────────────────────────────────────────────────────

export async function expandRecipe(recipeId) {
    if (!expandedModal) return;   // page without a recipe view
    const token = ++openToken;
    expanded = true;
    expandedModal.classList.add('is-loading');
    expandedModal.classList.remove('hidden');
    overlay.classList.remove('hidden');

    let recipe;
    try {
        recipe = await fetchRecipeById(recipeId);
        if (!recipe) throw new Error('This recipe doesn’t exist any more, or it’s private.');
    } catch (error) {
        if (token !== openToken) return;
        toast.error(error.message || 'Could not open the recipe');
        if (history.state?.type === 'recipe') history.back(); else closeRecipe();
        return;
    }
    if (token !== openToken) return;   // the user opened another recipe or closed this one meanwhile

    current = recipe;
    document.title = `${recipe.title} - FoodDecider`;

    expandedModal.querySelector('.macros').hidden = false;
    const coverage = renderMacroWheel(expandedModal.querySelector('.macro-list'), recipe.ingredient_macros, recipe.servings);
    renderIngredients(expandedModal.querySelector('.ingredient-list'), recipe.recipe_ingredients, recipe.recipe_ingredient_sections, coverage);
    renderSteps(expandedModal.querySelector('.steps'), recipe);
    renderHeader(recipe);
    expandedModal.querySelector('.expanded-recipe-image').innerHTML = getRecipeImage(recipe);

    expandedModal.classList.remove('is-loading');
    expandedModal.scrollTop = 0;
    expandedModal.querySelector('.close-button')?.focus({ preventScroll: true });

    // Count the view, and show it right away when it counted (once per person)
    api('/api/recipes/register_view.php', { method: 'POST', json: { recipe_id: recipe.id } })
        .then(result => {
            if (result.counted && current?.id === recipe.id) {
                bumpCount(expandedModal.querySelector('.views'), 1, { format: n => plural(n, 'view') });
            }
        })
        .catch(() => { /* a missed view count isn't worth bothering anyone about */ });
}

export function closeRecipe() {
    if (!expandedModal) return;
    openToken++;
    expanded = false;
    current = null;
    expandedModal.classList.add('hidden');
    if (document.getElementById('login-modal')?.classList.contains('hidden') !== false) overlay.classList.add('hidden');
    document.title = 'FoodDecider';
}

// ── Actions ──────────────────────────────────────────────────────────────────

async function shareRecipe(recipe) {
    const url = `${location.origin}/recipe/${recipe.id}`;
    if (await copyText(url)) toast.success('Link copied. Paste it anywhere to share the recipe.');
    else toast.error('Could not copy. The link is ' + url);
}

async function handleDelete(recipeId) {
    if (!await confirmDialog({ title: 'Delete recipe', message: 'Delete the recipe and everything on it? This can’t be undone.', confirmText: 'Delete', danger: true })) return;

    try {
        await api('/api/recipes/delete_recipe.php', { query: { recipe_id: recipeId } });
    } catch (error) {
        toast.error(error.message || 'Could not delete the recipe');
        return;
    }
    toast.success('Recipe deleted');
    document.dispatchEvent(new CustomEvent('recipe:deleted', { detail: { id: recipeId } }));
    history.back();
}

/**
 * Save / unsave, from a card's bookmark or the recipe view. Everything on screen changes at once;
 * if the server says no, it all goes back and the reason is shown.
 */
export async function handleSave(recipeId) {
    if (!await requireLogin('save recipes to your kitchen')) return;

    const cards = [...document.querySelectorAll(`.recipe-card[data-id="${recipeId}"] .saves`)];
    const viewButton = () => current?.id === recipeId ? expandedModal.querySelector('.rv-save') : null;
    const counter = current?.id === recipeId ? expandedModal.querySelector('.rv-saves') : null;
    const wasSaved = viewButton() ? viewButton().getAttribute('aria-pressed') === 'true'
                                  : cards[0]?.classList.contains('filled') ?? false;

    const show = (saved) => {
        cards.forEach(c => {
            c.classList.toggle('filled', saved);
            c.setAttribute('aria-pressed', String(saved));
        });
        viewButton()?.replaceWith(Object.assign(document.createElement('template'), { innerHTML: saveButtonHtml(saved) }).content);
    };

    show(!wasSaved);
    bumpCount(counter, wasSaved ? -1 : 1, { format: n => plural(n, 'save') });

    try {
        const result = await api('/api/recipes/save_recipe.php', { method: 'POST', json: { recipe_id: recipeId } });
        show(result.saved);                                     // the server's answer wins
        if (counter && result.saves != null) counter.textContent = plural(result.saves, 'save');
        toast.success(result.saved ? 'Saved to your kitchen' : 'Removed from your kitchen');
    } catch (error) {
        show(wasSaved);
        bumpCount(counter, wasSaved ? 1 : -1, { format: n => plural(n, 'save') });
        toast.error(error.message || 'Could not save the recipe');
    }
}
