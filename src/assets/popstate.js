import { closeRecipe, expandRecipe } from "./recipe-modal.js";

// Back / Forward: open the recipe in that history entry, or close the recipe view.
// (Opening /recipe/42 directly is handled once, in recipe-modal.js init().)
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.type === 'recipe') {
        expandRecipe(event.state.slug);
    } else {
        closeRecipe();
    }
});
