export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

// ── Images ────────────────────────────────────────────────────────────────────
// includes/upload_image.php saves each picture in a few sizes: recipe "" (1600 px) and "_600",
// profile "" (512 px) and "_200". Pictures uploaded before that only have the full size, so
// smaller ones fall back to it (see the error listener below).

export function imageUrl(type, base, size = '') {
    return `/uploads/${type}_pictures/${encodeURIComponent(base)}${size}.webp`;
}

/** <img> for a recipe; size "_600" for cards, "" for the full recipe view. */
export function getRecipeImage(recipe, size = '') {
    if (!recipe.image_base) {
        return `<div class="placeholder"><span class="material-symbols-outlined">chef_hat</span></div>`;
    }
    const full = imageUrl('recipe', recipe.image_base);
    return `<img src="${size ? imageUrl('recipe', recipe.image_base, size) : full}"
                 ${size ? `data-fallback="${full}"` : ''} alt="" loading="lazy" decoding="async">`;
}

/** Profile picture url (or the generated avatar for people without one). */
export function avatarUrl(username, imageBase, size = '_200') {
    return imageBase
        ? imageUrl('profile', imageBase, size)
        : `/uploads/profile_pictures/${encodeURIComponent(username)}_avatar.svg`;
}

// One listener for every image: a missing small size falls back to the full picture
document.addEventListener('error', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.dataset.fallback && !img.dataset.fellBack) {
        img.dataset.fellBack = '1';
        img.src = img.dataset.fallback;
    }
}, true);

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
    const course = getCourseName(recipe);
    const ownerAvatar = avatarUrl(recipe.owner_username, recipe.owner_image);
    const ownerFull = avatarUrl(recipe.owner_username, recipe.owner_image, '');

    return `
        <div class="recipe-card" data-id="${Number(recipe.id)}" data-course="${escapeHtml(course)}" tabindex="0" aria-label="${escapeHtml(recipe.title)}">
            ${recipe.is_owner ? '' : `<img class="owner-image" src="${ownerAvatar}" data-fallback="${ownerFull}" alt="${escapeHtml(recipe.owner_username)}" title="by ${escapeHtml(recipe.owner_username)}" loading="lazy">`}
            <div class="recipe-image-container">${getRecipeImage(recipe, '_600')}</div>
            <div class="recipe-content">
                <div class="card-meta">
                    <span>${formatMinutes(recipe.total_time_minutes)}</span>
                    <span>${escapeHtml(capitalize(course))}</span>
                </div>
                <h3>${escapeHtml(recipe.title)}</h3>
                ${recipe.is_owner ? '' : `<button type="button" class="saves ${recipe.is_saved ? 'filled' : ''}" aria-pressed="${Boolean(recipe.is_saved)}" aria-label="Save ${escapeHtml(recipe.title)}" title="Save"><span class="material-symbols-outlined bookmark-icon">bookmark</span></button>`}
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
            <div class="pick-image">${getRecipeImage(recipe, '_600')}</div>
            <div class="in">
                <span class="pk">Picked for you</span>
                <h2>${escapeHtml(recipe.title)}</h2>
                <p class="meta">${facts.map(f => `<span>${escapeHtml(f)}</span>`).join('')}</p>
                ${recipe.description ? `<p class="pick-desc">${escapeHtml(recipe.description)}</p>` : ''}
                <div class="act">
                    <button type="button" class="btn p pick-cook" data-id="${Number(recipe.id)}">Cook this</button>
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
