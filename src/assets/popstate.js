import { closeRecipe, expandRecipe } from "./recipe-modal.js";

// Helper to open recipe and push browser state
export function openRecipeModal(slug) {
    history.pushState({ type: 'recipe', slug }, '', `/recipe/${slug}`);
    expandRecipe(slug);
}

// 1. Popstate listener (Handles Back/Forward navigation)
window.addEventListener('popstate', (event) => {
    // Check history state directly instead of relying on a global variable
    if (event.state && event.state.type === 'recipe') {
        expandRecipe(event.state.slug);
    } else {
        // If state is empty or not a recipe, we've navigated back to the base page
        closeRecipe();
    }
});

// 2. Initial Page Load (Handles direct URLs & Page Refreshes)
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const recipeMatch = path.match(/^\/recipe\/([^\/]+)/);

    if (recipeMatch) {
        const slug = recipeMatch[1];
        expandRecipe(slug);
    }
});