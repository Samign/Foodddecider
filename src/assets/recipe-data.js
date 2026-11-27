import { handleAddRecipe, handleAddFromUrl } from './add-recipe.js';

export function toggleHidden(evt) {
    const menu = document.getElementById(evt.currentTarget.menu);
    menu.classList.toggle("hidden");

    if (menu.id === "add-menu") {
        const form = document.getElementById("add-recipe-form");
        form.dataset.mode = 'add';
        form.querySelector('.form-title').textContent = 'Add a recipe';
        form.querySelector('.save-recipe-button').textContent = 'Save recipe';
    }
    if (menu.id === "add-from-url-modal") {
        const form = document.getElementById("import-url-form");
        if (!form.hasListener) {                 // only once, or each open adds another import per submit
            form.addEventListener('submit', handleAddFromUrl);
            form.hasListener = true;
        }
    }
}

export async function fetchRecipeById(recipeId) {
    return fetch('/api/recipes/fetch_recipes.php', {
        method: 'POST',
        body: new URLSearchParams({ id: recipeId })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(response.status === 404 ? 'Recipe not found' : 'Failed to fetch recipe');
        }
        return response.json();
    });
}

export function parseJson(value) {
    if (typeof value === 'string') return JSON.parse(value);
    return value ?? [];
}

export function groupBySection(items, sections) {
    const groups = new Map(sections.map(s => [s.id, { ...s, items: [] }]));
    const loose = [];

    for (const item of items) {
        const group = groups.get(item.section_id);
        (group ? group.items : loose).push(item);
    }

    const result = [...groups.values()].filter(g => g.items.length);
    if (loose.length) result.unshift({ id: null, name: null, items: loose });
    return result;
}