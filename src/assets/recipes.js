import { renderRecipeList } from './recipe-cards.js';
import { expandRecipe, pushRecipeState } from './recipe-modal.js';
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
    console.log("init called for recipes.js")
    path = window.location.pathname;

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

    // const recipeMatch = path.match(/\/recipe\/(\d+)/);
    // if (recipeMatch) {
    //     window.history.replaceState({ type: 'home' }, '', '/');
    //     const recipeId = parseInt(recipeMatch[1]);
    //     pushRecipeState(recipeId);
    //     expandRecipe(recipeId);
    // }
}

document.addEventListener('tagsLoaded', loadRecipes);

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
    console.log("Selected courses:", [...selectedCourses]);
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadRecipes() {

    const token = ++loadToken;

    const recipeList = document.getElementById('recipe-list');
    recipeList.innerHTML = '<p>Loading recipes...</p>';

    const filterForm = document.getElementById('filter-form');
    const formData   = new FormData(filterForm);

    if (activeCategory?.id === "public-recipes") {
        formData.append('public', '1');
    } else if (activeCategory?.id === "friends-recipes") {
        formData.append('category', 'following');
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

    const response = await fetch('/api/recipes/fetch_recipes.php', {
        method: 'POST',
        body: formData
    });

    const recipes = await response.json();

    if (token !== loadToken) return; // Ignore if a newer request has been made
    renderRecipeList(recipeList, recipes);
}

async function randomRecipe() {
    const formData = new FormData(document.getElementById("filter-form"));
    formData.append('action', 'random');

    const response = await fetch('/api/recipes/fetch_recipes.php', {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    const recipe  = result[0];
    pushRecipeState(recipe.id);
    expandRecipe(recipe.id);
}