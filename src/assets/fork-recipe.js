import { handleAddRecipe, readSaveResponse } from './add-recipe.js';
import { toast } from './toast.js';
import { grabAndDisplayEdit } from './edit-recipe.js';

export async function forkRecipe(recipeId) {
    grabAndDisplayEdit(recipeId);
    const addform = document.getElementById('add-recipe-form');
    addform.dataset.mode = 'fork';
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
        if (!await readSaveResponse(response, 'Failed to fork recipe')) return;   // form stays open to fix

        document.getElementById('add-menu').classList.toggle("hidden");
        toast.success('Recipe forked successfully');
    } catch (error) {
        toast.error('Could not reach the server. Your recipe is still in the form, try again.');
    }
}