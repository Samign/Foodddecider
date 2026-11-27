import { renderRecipeList, getPickHtml, getEmptyPickHtml } from './recipe-cards.js';
import { openRecipe } from './recipe-modal.js';
import { toast } from './toast.js';
import { toggleHidden } from './recipe-data.js';
import { clearTags, renderTagSelection } from './tags.js';

// ── State ─────────────────────────────────────────────────────────────────────

let path = null;
let activeCategory = null;
let activeSubCategory = null;
let sortSelect = null;
let loadToken = 0;
const selectedCourses = new Set();
let courseContainer = null;

// ── Boot ──────────────────────────────────────────────────────────────────────

export function init() {
    path = window.location.pathname;

    const activeButton = document.querySelector('.recipe-category-buttons .nav-buttons.active');
    const subCategoriesContainer = document.querySelector('.sub-category-buttons');
    if (activeButton && subCategoriesContainer) {
        subCategoriesContainer.innerHTML = subCategoryHtml(activeButton.id);
    }
    
    initEventListeners();

    // recipes.js is imported dynamically, so "tagsLoaded" may already have fired: load now in that case
    if (window.metadata?.loaded) loadRecipes();

    // const recipeMatch = path.match(/\/recipe\/(\d+)/);
    // if (recipeMatch) {
    //     window.history.replaceState({ type: 'home' }, '', '/');
    //     const recipeId = parseInt(recipeMatch[1]);
    //     pushRecipeState(recipeId);
    //     expandRecipe(recipeId);
    // }
}

document.addEventListener('tagsLoaded', loadRecipes);

// Added, edited or forked a recipe: refresh the grid so it shows up
document.addEventListener('recipe:saved', () => loadRecipes({ quiet: true }));

// Deleted: take the card away and count down at once, no reload needed
document.addEventListener('recipe:deleted', (e) => {
    const id = e.detail.id;
    document.querySelectorAll(`.recipe-card[data-id="${id}"]`).forEach(card => card.remove());
    const list = document.getElementById('recipe-list');
    if (!list) return;
    const count = Math.max(0, Number(list.dataset.count || 0) - 1);
    list.dataset.count = count;
    document.dispatchEvent(new CustomEvent('recipesLoaded', { detail: { count } }));
    if (!list.querySelector('.recipe-card')) renderRecipeList(list, []);
    const pick = document.getElementById('pick');
    if (pick?.querySelector(`.pick-cook[data-id="${id}"]`)) pick.hidden = true;
});

// Logged-out visitors only get Discover, and only there is "Saved" pointless
function subCategoryHtml(categoryId) {
    return categoryId === "personal-recipes"
        ? `<button class="nav-buttons" id="favorite-recipes">My go-tos</button>
           <button class="nav-buttons active" id="new-recipes">Recent</button>
           <button class="nav-buttons" id="saved-recipes">Saved</button>`
        : `<button class="nav-buttons" id="popular-recipes">Popular</button>
           <button class="nav-buttons active" id="new-recipes">Recent</button>
           ${document.getElementById('personal-recipes') ? '<button class="nav-buttons" id="saved-recipes">Saved</button>' : ''}`;
}

function initRangeFilter(root) {
    const minRange = root.querySelector('.range-min');
    const maxRange = root.querySelector('.range-max');
    const minNum   = root.querySelector('.num-min');
    const maxNum   = root.querySelector('.num-max');
    const floor = Number(minRange.min);
    const ceil  = Number(minRange.max);

    function paint() {
        const pct = v => ((v - floor) / (ceil - floor)) * 100;
        root.style.setProperty('--lo', pct(minRange.value) + '%');
        root.style.setProperty('--hi', pct(maxRange.value) + '%');
        // when both thumbs sit at one end, the one that can still move must be on top
        minRange.style.zIndex = Number(minRange.value) > (floor + ceil) / 2 ? 3 : 1;
    }

    function fromSliders(changed) {
        if (Number(minRange.value) > Number(maxRange.value)) {
            if (changed === minRange) minRange.value = maxRange.value;
            else maxRange.value = minRange.value;
        }
        minNum.value = Number(minRange.value) > floor ? minRange.value : '';
        maxNum.value = Number(maxRange.value) < ceil  ? maxRange.value : '';
        paint();
    }

    function fromNumbers() {
        const clamp = v => Math.max(floor, Math.min(Number(v), ceil));
        const lo = minNum.value === '' ? floor : clamp(minNum.value);
        const hi = maxNum.value === '' ? ceil  : clamp(maxNum.value);
        minRange.value = lo;
        maxRange.value = Math.max(lo, hi);
        paint();
    }

    minRange.addEventListener('input', () => fromSliders(minRange));
    maxRange.addEventListener('input', () => fromSliders(maxRange));
    minNum.addEventListener('input', fromNumbers);
    maxNum.addEventListener('input', fromNumbers);

    fromNumbers();
    return fromNumbers;   // so the reset handler can re-sync
}


// ── Event listeners ───────────────────────────────────────────────────────────

function initEventListeners() {

    courseContainer = document.querySelector('#filter-menu .course-types-container');

    sortSelect = document.getElementById('sort-select');
    sortSelect?.addEventListener('change', loadRecipes);

    const filter_button = document.getElementById('filter-button');
    if (filter_button) {
        filter_button.addEventListener('click', toggleHidden);
        filter_button.menu = "filter-menu";
    }

    // "Saved" in the header: show the Saved tab of My kitchen
    document.getElementById('nav-saved')?.addEventListener('click', () => {
        document.getElementById('personal-recipes')?.click();
        setTimeout(() => document.getElementById('saved-recipes')?.click(), 0);
        document.getElementById('recipes')?.scrollIntoView({ behavior: 'smooth' });
    });

    // The "Decide for me" answer card
    document.getElementById('pick')?.addEventListener('click', (e) => {
        const cook = e.target.closest('.pick-cook');
        if (cook) {
            const id = parseInt(cook.dataset.id);
            openRecipe(id);
        } else if (e.target.closest('.pick-another')) {
            randomRecipe();
        } else if (e.target.closest('.empty-clear')) {
            document.getElementById('filter-form').reset();
        }
    });

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

            document.querySelector('.sub-category-buttons').innerHTML = subCategoryHtml(button.id);

            activeSubCategory = document.querySelector('.sub-category-buttons .nav-buttons.active');
            activeCategory.classList.remove("active");
            button.classList.add("active");
            activeCategory = button;
            sortSelect.value = ''
            loadRecipes();
        });

        document.querySelector('.sub-category-buttons').addEventListener('click', (e) => {
            const button = e.target.closest('.nav-buttons');
            if (!button || button.classList.contains("active")) return;
            activeSubCategory.classList.remove("active");
            button.classList.add("active");
            activeSubCategory = button;
            sortSelect.value = ''
            loadRecipes();
        });
    }

    document.getElementById('filter-form')?.addEventListener('reset', () => {
        clearTags();
        selectedCourses.clear();
        resetIngredientRows();
        setTimeout(() => {                 // the browser clears the fields after reset fires
            renderTagSelection();
            renderCourseSelection();
            rangeSyncs.forEach(sync => sync());
            loadRecipes();
        }, 0);
    });

    const ingredientList = document.getElementById('ingredient-list');
    const MAX_INGREDIENTS = 10;

    function addIngredientRow() {
        if (ingredientList.children.length >= MAX_INGREDIENTS) return;

        const row = document.createElement('div');
        row.className = 'ingredient-item';

        const bullet = document.createElement('span');
        bullet.textContent = '•';

        const input = document.createElement('input');
        input.className = 'ingredient-text';
        input.name = 'ingredients[]';
        input.placeholder = 'Enter an ingredient';
        input.autocomplete = 'off';

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove-ingredient';
        remove.setAttribute('aria-label', 'Remove ingredient');
        remove.textContent = '×';

        const list = document.createElement('div');
        list.className = 'autocomplete-list';
        row.append(bullet, input, remove, list);

        ingredientList.appendChild(row);
        input.focus();
    }

    document.getElementById('add-ingredient')?.addEventListener('click', addIngredientRow);

    ingredientList?.addEventListener('click', e => {
        const btn = e.target.closest('.remove-ingredient');
        if (!btn) return;
        const row = btn.closest('.ingredient-item');
        if (ingredientList.children.length === 1) {
            row.querySelector('input').value = '';   // keep one row so there's always an input
        } else {
            row.remove();
        }
    });

    // Enter moves to the next row (or makes one) instead of submitting the form
    ingredientList?.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || !e.target.matches('.ingredient-text')) return;
        e.preventDefault();                                          // never submit the form from here
    
        const row = e.target.closest('.ingredient-item');
        if (row.querySelector('.autocomplete-item.active')) return;  // suggestions.js accepts it
    
        row.querySelector('.autocomplete-list')?.replaceChildren();
        const next = row.nextElementSibling;
        if (next) next.querySelector('input').focus();
        else if (e.target.value.trim()) addIngredientRow();
    });

    function resetIngredientRows() {
        while (ingredientList.children.length > 1) ingredientList.lastElementChild.remove();
        ingredientList.querySelector('input').value = '';
    }

    const rangeSyncs = [...document.querySelectorAll('.range-filter')].map(initRangeFilter);

    courseContainer?.addEventListener('click', e => {
        const chip = e.target.closest('[data-id]');
        if (!chip) return;
        const id = chip.dataset.id;
        selectedCourses.has(id) ? selectedCourses.delete(id) : selectedCourses.add(id);
        renderCourseSelection();
    });

    // document.addEventListener('click', (e) => {
    //     const saveButton = e.target.closest('.saves');
    //     const card       = e.target.closest('.recipe-card');
    //     const modal      = e.target.closest('#expanded-modal');

    //     if (expanded && !modal) {
    //         window.history.back();
    //     } else if (saveButton) {
    //         handleSave(
    //             parseInt(saveButton.closest('.recipe-card').dataset.id),
    //             saveButton
    //         );
    //     } else if (card) {
    //         const cardId = parseInt(card.dataset.id);
    //         if (cardId) {
    //             pushRecipeState(cardId);
    //             expandRecipe(cardId);
    //         }
    //     }
    // });

    // document.addEventListener('keydown', (e) => {
    //     if (e.key === "Escape" && expanded) {
    //         window.history.back();
    //     }
    // });
}

function renderCourseSelection() {
    document.getElementById('selected-course').value = [...selectedCourses].join(',');
    courseContainer?.querySelectorAll('[data-id]').forEach(el => {
        const on = selectedCourses.has(el.dataset.id);
        el.classList.toggle('selected', on);
        el.setAttribute('aria-pressed', String(on));
    });
}

// ── Data loading ──────────────────────────────────────────────────────────────

// Everything that decides which recipes are in play: filter form + active tab + sub-tab
function buildFormData() {
    const formData = new FormData(document.getElementById('filter-form'));

    if (activeCategory?.id === "public-recipes") {
        formData.append('public', '1');
    } else if (activeCategory?.id === "friends-recipes") {
        formData.append('category', 'following');
    } else if (activeCategory?.id === "all-recipes") {
        formData.append('category', 'all');
    }

    path = window.location.pathname;
    const userMatch = path.match(/\/?user\/([^\/]+)/);
    if (userMatch) formData.append('user', userMatch[1]);

    let defaultOrder = '';
    if (activeSubCategory?.id === "favorite-recipes") {
        formData.append('category', 'favorites');
        defaultOrder = 'go_to';
    } else if (activeSubCategory?.id === "saved-recipes") {
        formData.append('category', 'saved');
    } else if (activeSubCategory?.id === "popular-recipes") {
        defaultOrder = 'views';
    }
    formData.set('order_by', sortSelect?.value || defaultOrder);
    return formData;
}

async function loadRecipes({ quiet = false } = {}) {

    const token = ++loadToken;

    const recipeList = document.getElementById('recipe-list');
    // Keep the old cards on screen (dimmed) while the new ones load: no jumping layout
    recipeList.classList.add('is-loading');
    if (!quiet && !recipeList.querySelector('.recipe-card')) recipeList.innerHTML = '<p class="rv-muted">Loading recipes…</p>';

    let recipes;
    try {
        const response = await fetch('/api/recipes/fetch_recipes.php', {
            method: 'POST',
            body: buildFormData()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        recipes = await response.json();
        if (!Array.isArray(recipes)) throw new Error('Unexpected answer');
    } catch (error) {
        if (token !== loadToken) return;
        recipeList.classList.remove('is-loading');
        recipeList.innerHTML = `<div class="empty"><h3>Recipes didn’t load</h3>
            <p>Check your connection and try again.</p>
            <button type="button" class="btn retry-load">Try again</button></div>`;
        recipeList.querySelector('.retry-load').addEventListener('click', () => loadRecipes());
        return;
    }

    if (token !== loadToken) return; // Ignore if a newer request has been made
    recipeList.classList.remove('is-loading');
    renderRecipeList(recipeList, recipes);
    recipeList.dataset.count = recipes.length;   // for anything that loads after this first render
    document.dispatchEvent(new CustomEvent('recipesLoaded', { detail: { count: recipes.length } }));
}

let lastPickId = null;

// Picks from the same recipes the grid shows, and shows the answer as a card (not straight into the modal)
async function randomRecipe() {
    const pick = document.getElementById('pick');
    const formData = buildFormData();
    formData.append('action', 'random');
    if (lastPickId) formData.append('exclude_id', lastPickId);   // "Another one" never repeats the last pick

    let result;
    try {
        const response = await fetch('/api/recipes/fetch_recipes.php', { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        result = await response.json();
    } catch {
        toast.error('Could not pick a recipe right now. Try again.');
        return;
    }
    const recipe = Array.isArray(result) ? result[0] : null;

    // Only one recipe fits and it was the last pick: show it again rather than "nothing found"
    if (!recipe && lastPickId) {
        lastPickId = null;
        return randomRecipe();
    }

    // No pick card on this page (e.g. a profile): keep the old behaviour
    if (!pick) {
        if (recipe) openRecipe(recipe.id);
        else toast.info('No recipe fits those filters.');
        return;
    }

    pick.hidden = false;
    pick.innerHTML = recipe ? getPickHtml(recipe) : getEmptyPickHtml();
    lastPickId = recipe?.id ?? null;
    pick.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}