export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

export function getRecipeImage(recipe) {
    return recipe.image_base
        ? `<img src="/uploads/recipe_pictures/${escapeHtml(recipe.image_base)}.webp" alt="">`
        : `<div class="placeholder"><span class="material-symbols-outlined">chef_hat</span></div>`;
}

// "dinner", from the course types meta-data-loader.js loaded
export function getCourseName(recipe) {
    const id = Number(recipe.course_types);
    for (const course of window.metadata?.courseTypes?.values() ?? []) {
        if (Number(course.id) === id) return course.name;
    }
    return '';
}

export function formatMinutes(minutes) {
    const m = Number(minutes) || 0;
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

const capitalize = s => s ? s[0].toUpperCase() + s.slice(1) : '';

function getTagsHtml(recipe) {
    const tags = Array.isArray(recipe.recipe_tags) ? recipe.recipe_tags : [];
    return tags.length
        ? `<div class="card-tags">${tags.slice(0, 3).map(t => `<span>${escapeHtml(t.name)}</span>`).join('')}</div>`
        : '';
}

// Only present when the "I have" filter is on (recipe_fetcher.php adds the columns)
function getMatchHtml(recipe) {
    if (recipe.ingredient_matches == null || !recipe.ingredient_total) return '';
    return `<p class="card-have">You have ${Number(recipe.ingredient_matches)} of ${Number(recipe.ingredient_total)} ingredients</p>`;
}

export function getRecipeHtml(recipe) {
    const ownerImg = recipe.owner_image
        ? `${recipe.owner_image}.webp`
        : `${recipe.owner_username}_avatar.svg`;
    const course = getCourseName(recipe);

    return `
        <div class="recipe-card" data-id="${recipe.id}" data-course="${escapeHtml(course)}">
            ${recipe.is_owner ? '' : `<img class="owner-image" src="/uploads/profile_pictures/${escapeHtml(ownerImg)}" alt="${escapeHtml(recipe.owner_username)}" title="by ${escapeHtml(recipe.owner_username)}">`}
            <div class="recipe-image-container">${getRecipeImage(recipe)}</div>
            <div class="recipe-content">
                <div class="card-meta">
                    <span>${formatMinutes(recipe.total_time_minutes)}</span>
                    <span>${escapeHtml(capitalize(course))}</span>
                </div>
                <h3>${escapeHtml(recipe.title)}</h3>
                ${recipe.is_owner ? '' : `<div class="saves ${recipe.is_saved ? 'filled' : ''}"><span class="material-symbols-outlined bookmark-icon">bookmark</span></div>`}
                ${getMatchHtml(recipe)}
                ${getTagsHtml(recipe)}
            </div>
        </div>`;
}

// The "Decide for me" answer
export function getPickHtml(recipe, poolSize = null) {
    const facts = [formatMinutes(recipe.total_time_minutes)];
    if (recipe.kcal_per_serving != null) facts.push(`${Math.round(recipe.kcal_per_serving)} kcal`);
    if (recipe.protein_per_serving != null) facts.push(`${Math.round(recipe.protein_per_serving)} g protein`);

    return `
        <div class="pick" data-course="${escapeHtml(getCourseName(recipe))}">
            <div class="pick-image">${getRecipeImage(recipe)}</div>
            <div class="in">
                <span class="pk">Picked for you</span>
                <h2>${escapeHtml(recipe.title)}</h2>
                <p class="meta">${facts.map(f => `<span>${escapeHtml(f)}</span>`).join('')}</p>
                ${recipe.description ? `<p class="pick-desc">${escapeHtml(recipe.description)}</p>` : ''}
                <div class="act">
                    <button type="button" class="btn p pick-cook" data-id="${recipe.id}">Cook this</button>
                    <button type="button" class="btn pick-another">Another one</button>
                </div>
            </div>
        </div>`;
}

export function getEmptyPickHtml() {
    return `
        <div class="empty">
            <h3>Nothing to pick from</h3>
            <p>No recipe fits all of those filters. Loosen one and try again.</p>
            <button type="button" class="btn empty-clear">Clear filters</button>
        </div>`;
}

export function renderRecipeList(container, recipes, emptyMessage = 'No recipes found.') {
    if (recipes.length) {
        container.innerHTML = recipes.map(getRecipeHtml).join('');
        return;
    }
    // Home page has a nicer empty state in modules.php; other pages get the plain message
    const template = document.getElementById('empty-state-template');
    if (template) container.replaceChildren(template.content.cloneNode(true));
    else container.innerHTML = `<p>${escapeHtml(emptyMessage)}</p>`;
}
