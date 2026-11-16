import { handleAddRecipe } from './add-recipe.js';
import { toast } from './toast.js';

// Todo Create the submitFork function and implement a fork counter in recipe table

export function init() {
    const forkButtons = document.querySelectorAll('.fork-button');
    forkButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const recipeId = parseInt(e.currentTarget.dataset.recipeId);
            await forkRecipe(recipeId);
        });
    });
}

async function forkRecipe(recipeId) {
    grabAndDisplayEdit(recipeId);
    addForm.removeEventListener('submit', handleAddRecipe);
    addForm.addEventListener('submit', submitFork);
}

async function submitFork(e) {
    e.preventDefault();
    const form      = e.target;
    const recipeId  = parseInt(form.dataset.id);

    const formData = new FormData(form);
    formData.append('forked_from_recipe_id', recipeId);

    try {
        const response = await fetch(`/api/recipes/recipe_adder.php`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to fork recipe');

        recipesById.set(result.recipe.id, result.recipe);
        renderRecipes();
        document.getElementById('add-menu').classList.toggle("hidden");
        toast.success('Recipe forked successfully');
    } catch (error) {
        toast.error('Failed to fork recipe');
    }
}