export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

export function getRecipeImage(recipe) {
    return recipe.image_base
        ? `<img src="/uploads/recipe_pictures/${escapeHtml(recipe.image_base)}.webp" alt="Recipe Image">`
        : `<div class="placeholder"><span class="material-symbols-outlined">chef_hat</span></div>`;
}

export function getRecipeHtml(recipe) {
    const ownerImg = recipe.owner_image
        ? `${recipe.owner_image}.webp`
        : `${recipe.owner_username}_avatar.svg`;

    return `
        <div class="recipe-card" data-id="${recipe.id}">
            <img class="owner-image" src="/uploads/profile_pictures/${escapeHtml(ownerImg)}" alt="Owner Image">
            <div class="recipe-image-container">${getRecipeImage(recipe)}</div>
            <div class="recipe-content">
                <h3>${escapeHtml(recipe.title)}</h3>
                ${recipe.is_owner ? '' : `<div class="saves ${recipe.is_saved ? 'filled' : ''}"><span class="material-symbols-outlined bookmark-icon">bookmark</span></div>`}
                <p>${escapeHtml(recipe.description)}</p>
                <div class="time">
                    <div><span class="material-symbols-outlined timer">timer</span>${recipe.prep_time_minutes} MINS PREP</div>
                    <div><span class="material-symbols-outlined timer">timer</span>${recipe.total_time_minutes} MINS TOTAL</div>
                </div>
            </div>
        </div>`;
}

export function renderRecipeList(container, recipes, emptyMessage = 'No recipes found.') {
    container.innerHTML = recipes.length
        ? recipes.map(getRecipeHtml).join('')
        : `<p>${escapeHtml(emptyMessage)}</p>`;
}