import { toggleHidden } from "./recipe-data.js";
import { addIngredient, addStep, addIngredientSection, addStepSection } from "./sections.js";
import { toast } from './toast.js';

let lastSelectedIngredientSection = null;
let lastSelectedIngredientItem = null;
let lastSelectedInstructionSection = null;
let lastSelectedInstructionBox = null;


export async function init(targetElement) {
    console.log("init called for add-recipe.js" + (targetElement ? ` on ${targetElement.id}` : ''));

    const ingredientSuggestions = targetElement.querySelector('.autocomplete-list');

    targetElement.addEventListener('submit', (e) => {
        if (targetElement.dataset.mode === 'edit') return;
        console.log("submitting add recipe form");
        handleAddRecipe(e);
    })
    targetElement.hasListener = true;

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
                console.error('Failed to load tag suggestions:', err);
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

export async function handleAddRecipe(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    
    const response = await fetch('/api/recipes/add_recipe.php', {
        method: 'POST',
        body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
        toast.success('Recipe added successfully');
        form.reset();
    }
    else {
        toast.error('Failed to add recipe');
    }
}

export async function handleAddFromUrl(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const response = await fetch('/api/recipes/import_recipe_url.php', {
        method: 'POST',
        body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
        toast.success('Recipe added successfully');
        form.reset();
    }
    else {
        console.log('error?');
        toast.error('Failed to add recipe');
    }
}