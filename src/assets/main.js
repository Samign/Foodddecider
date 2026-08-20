// assets/main.js

/**
 * Helper to conditionally import a module if its target selector exists in the DOM.
 * @param {string} selector - The CSS selector to check (e.g., '#add-recipe-modal')
 * @param {Function} importFn - A function returning dynamic import()
 */
async function loadModuleIfPresent(selector, importFn) {
  const element = document.querySelector(selector);
  if (element) {
    try {
      const module = await importFn(element);

      if (module && typeof module.init === 'function') {
        module.init(element);
      }
    } catch (error) {
      console.error(`Failed to load module for selector "${selector}":`, error);
    }
  }
}

// Global modules that should always run regardless of state
import './meta-data-loader.js';
import './popstate.js';

// Feature-specific dynamic loaders
document.addEventListener('DOMContentLoaded', () => {

  // 1. Auth / Guest Features (Only runs if login modal exists)
  loadModuleIfPresent('#login-modal', () => import('./landing-page.js'));

  // 2. Recipe Management (Only runs if add/edit recipe modal exists)
  loadModuleIfPresent('#add-recipe-form', async (element) => {
    // Load multiple related scripts in parallel when the form is present
    const [dragDrop, addRecipe] = await Promise.all([
      import('./drag-and-drop.js'),
      import('./add-recipe.js')
    ]);

    if (dragDrop.init) dragDrop.init(element);
    if (addRecipe.init) addRecipe.init(element);
  });

  // 3. Recipe Search & Suggestions
  loadModuleIfPresent('.ingredient-text', () => import('./suggestions.js'));

  // 4. Feed & Grid Features
  loadModuleIfPresent('#recipe-grid', () => import('./recipes.js'));

});