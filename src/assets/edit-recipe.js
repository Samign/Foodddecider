import { fillEditList } from './sections.js';
import { parseJson, fetchRecipeById } from './recipe-data.js'
import { showLoadedpreview } from './drag-and-drop.js';
import { toast } from './toast.js';
import { setRecipeTimes, readSaveResponse, setFormTags } from './add-recipe.js';

let addForm = null;

export async function handleEdit(recipeId) {
    addForm = document.getElementById('add-recipe-form');   // was still null on the first edit
    addForm.dataset.mode = 'edit';
    addForm.dataset.recipeId = recipeId;
    await grabAndDisplayEdit(recipeId);
}

const ingredientText = i =>
    [i.amount, i.unit, i.size, i.name]
        .filter(part => part !== null && part !== undefined && part !== '')
        .join(' ');

/** Fill the form with a recipe. mode "edit" changes it, "fork" saves a copy as your own. */
export async function grabAndDisplayEdit(recipeId, mode = 'edit') {
    let recipe;
    try {
        recipe = await fetchRecipeById(recipeId);
    } catch (err) {
        toast.error('Could not load the recipe, please try again');
        return;
    }
    if (!recipe) { toast.error('Recipe not found'); return; }
 
    const prep  = Number(recipe.prep_time_minutes) || 0;
    const total = Number(recipe.total_time_minutes) || 0;

    addForm = document.getElementById('add-recipe-form');
 
    // Keep the form's id: recipe-data.js, form-router.js and add-recipe.js all look it up by #add-recipe-form
    addForm.dataset.id = recipeId;
    addForm.querySelector('.form-title').textContent         = mode === 'fork' ? 'Fork recipe' : 'Edit recipe';
    addForm.querySelector('.save-recipe-button').textContent = mode === 'fork' ? 'Save my version' : 'Save changes';
    addForm.querySelector('#name').value               = recipe.title ?? '';
    setFormTags(parseJson(recipe.recipe_tags).map(t => t.name));
    addForm.querySelector('#description').value        = recipe.description ?? '';
    setRecipeTimes(addForm, recipe.prep_time_minutes, Math.max(0, total - prep));
    addForm.querySelector('#servings').value           = recipe.servings ?? '';
    addForm.querySelector('#link').value               = recipe.link ?? '';
 
    // Course type (single id)
    const courseTypeSelect = addForm.querySelector('#course');
    if (recipe.course_types != null) {
        courseTypeSelect.value = String(recipe.course_types);
    } else {
        courseTypeSelect.selectedIndex = 0;
    }
 
    // Tags: set every tag explicitly so selections from a previously edited recipe are cleared
    const recipeTagIds = parseJson(recipe.tags).map(t => Number(t.id));
    for (const tag of addForm.querySelector('.tags').children) {
        tag.classList.toggle('selected', recipeTagIds.includes(Number(tag.dataset.id)));
    }
 
    showLoadedpreview(recipe.image_base ? `/uploads/recipe_pictures/${recipe.image_base}.webp` : '');
 
    fillEditList('ingredients',
        parseJson(recipe.recipe_ingredients),
        parseJson(recipe.recipe_ingredient_sections),
        ingredientText);
 
    fillEditList('steps',
        parseJson(recipe.recipe_steps),
        parseJson(recipe.recipe_step_sections),
        step => step.content ?? '');
 
    // Close the recipe view properly (so Back and the cards keep working), then show the form
    if (history.state?.type === 'recipe') history.back();
    document.getElementById('add-menu').classList.remove("hidden");
}

export async function submitEdit(e) {
    e.preventDefault();
    const form      = e.target;
    const recipeId  = parseInt(form.dataset.id);
    const formData  = new FormData(form);

    try {
        const response = await fetch(`/api/recipes/update_recipe.php?id=${recipeId}`, {
            method: 'POST',
            body: formData
        });
        if (!await readSaveResponse(response, 'Failed to update recipe')) return;   // form stays open to fix

        document.getElementById('add-menu').classList.add("hidden");
        toast.success('Changes saved');
        document.dispatchEvent(new CustomEvent('recipe:saved', { detail: { id: recipeId, open: true } }));
    } catch (error) {
        toast.error('Could not reach the server. Your changes are still in the form, try again.');
    }
}