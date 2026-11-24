import { handleAddRecipe } from './add-recipe.js';
import { submitEdit } from './edit-recipe.js';
import { submitFork } from './fork-recipe.js';

const SUBMIT_HANDLERS = {
  add: handleAddRecipe,
  edit: submitEdit,
  fork: submitFork,
};

// 2. Attach ONE listener that routes based on mode
export function init() {
  const form = document.getElementById('add-recipe-form');
  if (!form || form.dataset.initialized) return;
  form.dataset.initialized = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // Handle this once here so individual handlers don't forget

    const mode = form.dataset.mode || 'add';
    const handler = SUBMIT_HANDLERS[mode];

    if (handler) {
      await handler(e, form.dataset.recipeId);
    } else {
      console.error(`Unknown form mode: ${mode}`);
    }
  });
}