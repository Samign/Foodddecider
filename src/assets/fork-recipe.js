import { handleAddRecipe, readSaveResponse } from './add-recipe.js';
import { toast } from './toast.js';
import { grabAndDisplayEdit } from './edit-recipe.js';

export async function forkRecipe(recipeId) {
    const addform = document.getElementById('add-recipe-form');
    addform.dataset.mode = 'fork';
    addform.dataset.recipeId = recipeId;
    await grabAndDisplayEdit(recipeId, 'fork');
    toast.info('Change anything you like, then save it as your own version.');
}

export async function submitFork(e) {
    e.preventDefault();
    const form      = e.target;
    const recipeId  = parseInt(form.dataset.id);

    const formData = new FormData(form);
    formData.append('forked_from_recipe_id', recipeId);

    try {
        const response = await fetch(`/api/recipes/add_recipe.php`, {
            method: 'POST',
            body: formData
        });
        const result = await readSaveResponse(response, 'Failed to fork recipe');
        if (!result) return;   // form stays open to fix

        document.getElementById('add-menu').classList.add("hidden");
        toast.success('Your version is saved in your kitchen');
        document.dispatchEvent(new CustomEvent('recipe:saved', { detail: { id: Number(result.recipe_id), open: true } }));
    } catch (error) {
        toast.error('Could not reach the server. Your recipe is still in the form, try again.');
    }
}