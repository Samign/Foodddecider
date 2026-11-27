import { toggleHidden } from "./recipe-data.js";
import { addIngredient, addStep, addIngredientSection, addStepSection } from "./sections.js";
import { toast } from './toast.js';
import { showPhotoError } from './drag-and-drop.js';

let lastSelectedIngredientSection = null;
let lastSelectedIngredientItem = null;
let lastSelectedInstructionSection = null;
let lastSelectedInstructionBox = null;
let setTagsImpl = null;   // set in init(): replaces the form's tags (used when editing a recipe)

/** Put these tag names in the form (editing / forking). Before this, editing a recipe dropped all its tags. */
export function setFormTags(names = []) {
    setTagsImpl?.(names);
}


export async function init(targetElement) {

    const ingredientSuggestions = targetElement.querySelector('.autocomplete-list');

    initTimeToggle(targetElement);

    const add_button = document.querySelector('#add-button');
    
    if (add_button) {
        add_button.menu = "add-choice";
        add_button.addEventListener('click', toggleHidden);
        
        const manual_button = document.querySelector('#add-manually');
        manual_button.menu = "add-menu";
        manual_button.addEventListener('click', toggleHidden);

        const url_button = document.querySelector('#add-from-url');
        url_button.menu = "add-from-url-modal";
        url_button.addEventListener('click', toggleHidden);
    }

    const recipePublicButtonContainer = targetElement.querySelector("#public-checkbox-container");
    if (recipePublicButtonContainer) {
        const publicCheckbox = targetElement.querySelector('#save-as-public');
        const privateButton = targetElement.querySelector('#private');
        const publicButton = targetElement.querySelector('#public');
        
        recipePublicButtonContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('private-button')) {
                publicCheckbox.value = '0';
                e.target.classList.add("selected");
                publicButton.classList.remove("selected");
            } else if (e.target.classList.contains('public-button')) {
                publicCheckbox.value = '1';
                e.target.classList.add("selected");
                privateButton.classList.remove("selected");
            }
        });
    }

    // Move to suggestions.js
    // const tagSearchInput = targetElement.querySelector("#tag_search");
    // if (tagSearchInput) {
    //     tagSearchInput.addEventListener('input', async (e) => {
    //         const query = e.target.value.trim();
    //         if (query.length < 2) return;

    //         const res = await fetch(`/api/search_tags.php?q=${encodeURIComponent(query)}`);
    //         const data = await res.json();
    //         showTagSuggestions(e.target, data, query);
    //     });
    // }

    const tagsContainer = targetElement.querySelector(".tags");
    const tagSearchInput = targetElement.querySelector(".tag_search");
    const tagSuggestions = targetElement.querySelector(".tag-suggestions");
    const addTagButton = targetElement.querySelector("#add-tag");

    if (tagsContainer && tagSearchInput) {
        const hasTag = (name) =>
            [...tagsContainer.querySelectorAll('input[name="tags[]"]')]
                .some(input => input.value.toLowerCase() === name.toLowerCase());
    
        // Hide suggestions that are already added
        const syncSuggestions = () => {
            if (!tagSuggestions) return;
            tagSuggestions.querySelectorAll('.tag-suggestion').forEach(btn => {
                btn.hidden = hasTag(btn.dataset.tagName);
            });
        };
    
        const addTag = (rawName) => {
            const tagName = rawName.trim();
            if (!tagName || hasTag(tagName)) return false;
        
            const tagDiv = document.createElement("div");
            tagDiv.className = "tag-item";
        
            const span = document.createElement("span");
            span.textContent = tagName;
            tagDiv.appendChild(span);
        
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "tags[]";
            input.value = tagName;
            tagDiv.appendChild(input);
        
            const removeTagButton = document.createElement("button");
            removeTagButton.type = "button";
            removeTagButton.className = "remove-tag";
            removeTagButton.textContent = "x";
            removeTagButton.addEventListener('click', () => {
                tagDiv.remove();
                syncSuggestions();
            });
            tagDiv.appendChild(removeTagButton);
        
            tagsContainer.appendChild(tagDiv);
            syncSuggestions();
            return true;
        };
    
        const addFromInput = () => {
            if (addTag(tagSearchInput.value)) {
                tagSearchInput.value = "";
                tagSearchInput.dataset.tagId = "";
            }
        };
    
        if (addTagButton) {
            addTagButton.addEventListener('click', addFromInput);
        }

        setTagsImpl = (names) => {
            tagsContainer.querySelectorAll('.tag-item').forEach(el => el.remove());
            names.forEach(name => addTag(name));
            syncSuggestions();
        };
        // A reset form (after saving, or a fresh "Add recipe") starts without tags
        targetElement.addEventListener('reset', () => setTagsImpl([]));
    
        // Optional: Enter adds the tag instead of submitting the form
        tagSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addFromInput();
            }
        });
    
        if (tagSuggestions) {
            try {
                const res = await fetch('/api/get_tags.php');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const tags = await res.json();
            
                tags.forEach(tag => {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "tag-suggestion";
                    btn.textContent = tag.name;
                    btn.dataset.tagName = tag.name;
                    btn.dataset.tagId = tag.id;
                    btn.addEventListener('click', () => addTag(tag.name));
                    tagSuggestions.appendChild(btn);
                });
            
                syncSuggestions();
            } catch (err) {
                toast.error('Failed to load tag suggestions');
            }
        }
    }
    
    // const tagSuggestions = targetElement.querySelector('.tag-suggestions');
    // if (tagSuggestions) {
    //     const res = await fetch(`/api/get_tags.php`);
    //     const data = await res.json();
    // }

    // const addTagButton = targetElement.querySelector("#add-tag");
    // if (addTagButton) {
    //     addTagButton.addEventListener('click', () => {
    //         const tagSearchInput = targetElement.querySelector(".tag_search");
    //         const tagName = tagSearchInput.value.trim();
    //         if (!tagName) return;

    //         // const tagId = tagSearchInput.dataset.tagId || null;
    //         const tagsContainer = targetElement.querySelector(".tags");

    //         const tagDiv = document.createElement("div");
    //         tagDiv.className = "tag-item";
    //         const span = document.createElement("span");
    //         span.textContent = tagName;
    //         tagDiv.appendChild(span);

    //         const input = document.createElement("input");
    //         input.type = "hidden";
    //         input.name = "tags[]";
    //         // input.value = tagId ? tagId : '';
    //         input.value = tagName;
    //         tagDiv.appendChild(input);

    //         const removetagButton = document.createElement("button");
    //         removetagButton.type = "button";
    //         removetagButton.className = "remove-tag";
    //         removetagButton.textContent = "x";
    //         tagDiv.appendChild(removetagButton);

    //         tagsContainer.appendChild(tagDiv);
    //         tagSearchInput.value = "";
    //         tagSearchInput.dataset.tagId = "";

    //         const removetagsButton = tagDiv.querySelector(".remove-tag");
    //         removetagsButton.addEventListener('click', () => {
    //             tagDiv.remove();
    //         });
    //     });
    // }

    const addStepButton = targetElement.querySelector("#add-step");
    if (addStepButton) {
        addStepButton.addEventListener('click', () => addStep(lastSelectedInstructionBox || lastSelectedInstructionSection));
    }
    
    const addStepSectionButton = targetElement.querySelector("#add-step-section");
    if (addStepSectionButton) {
        addStepSectionButton.addEventListener('click', () => addStepSection());
    }

    const addIngredientSectionButton = targetElement.querySelector("#add-ingredient-section");
    if (addIngredientSectionButton) {
        addIngredientSectionButton.addEventListener('click', () => addIngredientSection());
    }

    const addIngredientButton = targetElement.querySelector("#add-ingredient");
    if (addIngredientButton) {
        addIngredientButton.addEventListener('click', () => addIngredient(lastSelectedIngredientItem || lastSelectedIngredientSection));
    }

    const ingredientsElement = targetElement.querySelector('#ingredients');
    if (ingredientsElement) {
        ingredientsElement.addEventListener('click', (e) => {
            const section = e.target.closest('.section-group');
            const item = e.target.closest('.ingredient-item');
            if (section && section.dataset.type === 'ingredients') {
                lastSelectedIngredientSection = section;
            }
            if (item) {
                lastSelectedIngredientItem = item;
            }
            // if (e.target.matches('.add-ingredient')) {
            //     addIngredient(e.target);
            // }
        });

        ingredientsElement.addEventListener('focusin', (e) => {
            const section = e.target.closest('.section-group');
            const item = e.target.closest('.ingredient-item');
            if (section && section.dataset.type === 'ingredients') {
                lastSelectedIngredientSection = section;
            }
            if (item) {
                lastSelectedIngredientItem = item;
            }

            // Move suggestion list under the focused ingredient input
            if (ingredientSuggestions && e.target.matches('.ingredient-text')) {
                const parent = e.target.parentElement;
            
                if (parent?.after) {
                    parent.after(ingredientSuggestions);
                } else {
                    parent.parentNode?.insertBefore(ingredientSuggestions, parent.nextSibling);
                }
            }
        });
    }

    const instructionsElement = targetElement.querySelector('#instructions');
    if (instructionsElement) {
        instructionsElement.addEventListener('click', (e) => {
            const section = e.target.closest('.section-group');
            if (section && section.dataset.type === 'steps') {
                lastSelectedInstructionSection = section;
            }
            const box = e.target.closest('.instruction-box');
            if (box) {
                lastSelectedInstructionBox = box;
            }
        });

        instructionsElement.addEventListener('focusin', (e) => {
            const section = e.target.closest('.section-group');
            if (section && section.dataset.type === 'steps') {
                lastSelectedInstructionSection = section;
            }
            const box = e.target.closest('.instruction-box');
            if (box) {
                lastSelectedInstructionBox = box;
            }
        });
    }
};

// ── Time: "Total time" by default, with a switch to split it into prep and cook ──
// Total-only sends the total as `cook` and leaves `prep` empty (stored as NULL).

function initTimeToggle(form) {
    const toggle = form.querySelector('#split-time');
    const prep = form.querySelector('#prep');
    const cook = form.querySelector('#cook');
    if (!toggle || !prep || !cook) return;

    toggle.addEventListener('change', () => {
        // Back to one field: fold prep into the total so nothing is lost
        if (!toggle.checked) {
            cook.value = minutes(prep) + minutes(cook) || '';
            prep.value = '';
        }
        renderTimeFields(form);
    });
    prep.addEventListener('input', () => renderTimeFields(form));
    cook.addEventListener('input', () => renderTimeFields(form));
    form.addEventListener('reset', () => setTimeout(() => renderTimeFields(form), 0));

    renderTimeFields(form);
}

const minutes = input => Number(input.value) || 0;

function renderTimeFields(form) {
    const split = form.querySelector('#split-time').checked;
    const prep = form.querySelector('#prep');
    const cook = form.querySelector('#cook');
    form.querySelector('#prep-wrap').hidden = !split;
    form.querySelector('#cook-label').textContent = split ? 'Cook time' : 'Total time';
    form.querySelector('#time-sum').textContent = split && (prep.value || cook.value)
        ? `= ${minutes(prep) + minutes(cook)} min in total`
        : '';
}

/** Used by edit-recipe.js: a saved prep time opens the form already split. */
export function setRecipeTimes(form, prepMinutes, cookMinutes) {
    const hasPrep = Number(prepMinutes) > 0;
    form.querySelector('#split-time').checked = hasPrep;
    form.querySelector('#prep').value = hasPrep ? prepMinutes : '';
    form.querySelector('#cook').value = cookMinutes ?? '';
    renderTimeFields(form);
}

/**
 * Shared by add, edit and fork: turns the server's answer into messages.
 * A photo problem (field: "picture") is shown under the photo box, and the form keeps
 * everything that was typed so the person can choose another photo and save again.
 * Returns true when the recipe was saved.
 */
export async function readSaveResponse(response, failText) {
    const result = await response.json().catch(() => ({}));

    // nginx refuses very large uploads itself (client_max_body_size) before PHP sees them
    if (response.status === 413) {
        result.field = 'picture';
        result.error = 'The photo is too big. Choose a smaller one.';
    }

    if (result.field === 'picture') {
        showPhotoError(result.error);
        toast.error(result.error);
        return false;
    }
    if (!response.ok || !result.success) {
        toast.error(result.error || failText);
        return false;
    }
    if (result.warning) toast.info(result.warning, { duration: 8000 });
    return result;   // truthy: saved (has recipe_id for new recipes)
}

export async function handleAddRecipe(e) {
    e.preventDefault();

    const form = e.target;
    try {
        const response = await fetch('/api/recipes/add_recipe.php', {
            method: 'POST',
            body: new FormData(form)
        });
        const result = await readSaveResponse(response, 'Failed to add recipe');
        if (result) {
            toast.success('Recipe added to your kitchen');
            form.reset();
            document.getElementById('add-menu')?.classList.add('hidden');
            // recipes.js reloads the list, recipe-modal.js opens the new recipe
            document.dispatchEvent(new CustomEvent('recipe:saved', { detail: { id: Number(result.recipe_id), open: true } }));
        }
    } catch {
        toast.error('Could not reach the server. Your recipe is still in the form, try again.');
    }
}

export async function handleAddFromUrl(e) {
    e.preventDefault();

    const form = e.target;
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;                       // already importing

    // Reading a page with the local model can take a minute or two
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Reading the recipe…';

    try {
        const response = await fetch('/api/recipes/import_recipe_url.php', {
            method: 'POST',
            body: new FormData(form)
        });
        const result = await response.json().catch(() => ({}));   // 401/500 can come back without JSON

        if (result.success) {
            toast.success('Recipe imported. Check it over in My kitchen.');
            form.reset();
            document.getElementById('add-from-url-modal')?.classList.add('hidden');
            document.getElementById('personal-recipes')?.click();
        } else if (response.status === 401) {
            toast.error('Log in to import recipes');
        } else {
            toast.error(result.error || 'Could not import that recipe');
        }
    } catch {
        toast.error('Could not reach the server. Try again.');
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}