import { fillEditList } from './sections.js';
import { parseJson, fetchRecipeById } from './recipe-data.js'
import { showLoadedpreview } from './drag-and-drop.js';
import { toast } from './toast.js';

let addForm = null;

export async function handleEdit(recipeId) {
    addForm.dataset.mode = 'edit';
    addForm.dataset.recipeId = recipeId;
    await grabAndDisplayEdit(recipeId);
}

const ingredientText = i =>
    [i.amount, i.unit, i.size, i.name]
        .filter(part => part !== null && part !== undefined && part !== '')
        .join(' ');

export async function grabAndDisplayEdit(recipeId) {
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
 
    addForm.dataset.id = recipeId;
    addForm.id = "edit-recipe-form";
    addForm.querySelector('legend').textContent        = 'Edit Recipe';
    addForm.querySelector('.save-recipe-button').value = 'Update Recipe';
    addForm.querySelector('#name').value               = recipe.title ?? '';
    addForm.querySelector('#description').value        = recipe.description ?? '';
    addForm.querySelector('#prep').value               = recipe.prep_time_minutes ?? '';
    addForm.querySelector('#cook').value               = Math.max(0, total - prep);
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
 
    document.getElementById('expanded-modal').classList.toggle("hidden");
    document.getElementById('add-menu').classList.toggle("hidden");
}

export async function submitEdit(e) {
    e.preventDefault();
    const form      = e.target;
    const recipeId  = parseInt(form.dataset.id);

    try {
        const response = await fetch(`/api/recipes/update_recipe.php?id=${recipeId}`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update recipe');

        document.getElementById('add-menu').classList.toggle("hidden");
        toast.success('Recipe updated successfully');
    } catch (error) {
        toast.error('Failed to update recipe');
    }
}