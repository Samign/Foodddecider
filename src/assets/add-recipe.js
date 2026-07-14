import { toggleHidden } from "./recipes.js";

const units = [
    "g", "kg", "mg",
    "ml", "l", "cl", "dl",
    "tsp", "tbsp", "cup", "oz", "lb"
];

const unitMap = {
    gram: "g",
    grams: "g",
    kilogram: "kg",
    kilograms: "kg",
    milligram: "mg",
    milligrams: "mg",
    milliliter: "ml",
    milliliters: "ml",
    liter: "l",
    liters: "l",
    centiliter: "cl",
    centiliters: "cl",
    deciliter: "dl",
    deciliters: "dl",
    teaspoon: "tsp",
    teaspoons: "tsp",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    cup: "cup",
    cups: "cup",
    ounce: "oz",
    ounces: "oz",
    pound: "lb",
    pounds: "lb"
};

const softWords = ["pinch", "dash", "handful", "splash", "to taste"];

let stepSectionCount = 1;
let ingredientSectionCount = 1;
let lastSelectedIngredientSection = null;
let lastSelectedIngredientItem = null;
let lastSelectedInstructionSection = null;
let lastSelectedInstructionBox = null;

function normalize(input) {
    return input.toLowerCase().replace(",",".").replace(/\s+/g, ' ').trim();
}

function parseFraction(str) {
    if (str.includes('/')) {
        const [numerator, denominator] = str.split('/').map(Number);
        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
            return numerator / denominator;
        }
    }
    return null;
}

function normalizeUnit(unit) {
    return unitMap[unit] || unit;
}

const sizeWords = ['extra-large', 'extra large', 'large', 'medium', 'small'];

function parseIngredient(input) {
    const raw = input;
    input = normalize(input);

    let amount     = null;
    let unit       = null;
    let size       = null;
    let ingredient = input;
    let soft       = false;

    // Soft ingredients (e.g. "pinch of salt")
    for (let softWord of softWords) {
        if (input.includes(softWord)) {
            return {
                raw,
                amount: null,
                unit: softWord,
                size: null,
                ingredient: input.replace(softWord, "").replace("of", "").trim(),
                soft: true
            };
        }
    }

    let words = input.split(' ');

    // Amount
    let first    = words[0];
    let fraction = parseFraction(first);
    if (fraction !== null) {
        amount = fraction;
        words.shift();
    } else if (!isNaN(first)) {
        amount = parseFloat(first);
        words.shift();
    }

    // Unit
    if (words.length && units.includes(words[0])) {
        unit = normalizeUnit(words[0]);
        words.shift();
    }

    // Size — only if no unit was found (e.g. "1 large tomato" not "1 cup large oats")
    if (!unit && words.length) {
        const maybeSizeWord = words.join(' ');
        for (let s of sizeWords) {
            if (maybeSizeWord.startsWith(s + ' ') || maybeSizeWord === s) {
                size  = s;
                words = words.slice(s.split(' ').length); // handles "extra large" (2 words)
                break;
            }
        }
    }

    ingredient = words.join(' ');

    return { raw, amount, unit, size, ingredient, soft };
}

export function prepareIngredients() { 

    const inputs = document.querySelectorAll(".ingredient-text");

    let parsed = [];
    
    inputs.forEach(input => {
        const value = input.value.trim();
        if (value !== "") {
            parsed.push(parseIngredient(value));
        }
    });
    return parsed;
}

function getLastSection(selector) {
    const sections = document.querySelectorAll(selector);
    return sections.length ? sections[sections.length - 1] : null;
}

document.addEventListener('DOMContentLoaded', () => {

    const ingredientSuggestions = document.querySelector('.autocomplete-list');

    const add_button = document.getElementById('add-button');
    
    if (add_button) {
        add_button.menu = "add-choice";
        add_button.addEventListener('click', toggleHidden);
        
        const manual_button = document.getElementById('add-manually');
        manual_button.menu = "add-menu";
        manual_button.addEventListener('click', toggleHidden);

        const url_button = document.getElementById('add-from-url');
        url_button.menu = "add-from-url-modal";
        url_button.addEventListener('click', toggleHidden);
    }

    const recipePublicButtonContainer = document.getElementById("public-checkbox-container");
    if (recipePublicButtonContainer) {
        const publicCheckbox = document.getElementById('save-as-public');
        const privateButton = document.getElementById('private');
        const publicButton = document.getElementById('public');
        
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

    const addStepButton = document.getElementById("add-step");
    if (addStepButton) {
        addStepButton.addEventListener('click', () => addStep(lastSelectedInstructionBox || lastSelectedInstructionSection));
    }
    
    const addStepSectionButton = document.getElementById("add-step-section");
    if (addStepSectionButton) {
        addStepSectionButton.addEventListener('click', () => addStepSection());
    }

    const addIngredientSectionButton = document.getElementById("add-ingredient-section");
    if (addIngredientSectionButton) {
        addIngredientSectionButton.addEventListener('click', () => addIngredientSection());
    }

    const addIngredientButton = document.getElementById("add-ingredient");
    if (addIngredientButton) {
        addIngredientButton.addEventListener('click', () => addIngredient(lastSelectedIngredientItem || lastSelectedIngredientSection));
    }

    const ingredientsElement = document.getElementById('ingredients');
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

    const instructionsElement = document.getElementById('instructions');
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
            // if (e.target.matches('.add-step')) {
            //     addStep(e.target);
            // }
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

});

function addStepSection() {
    const i = stepSectionCount++;
    const section = document.createElement("div");
    Object.assign(section, {
        className: 'section-group',
        innerHTML: `
    <div class="flex">
        <span>•</span>
        <input class="section-title-input" type="text" name="step_sections[${i}][title]"
        placeholder="Section title (optional)" value="">
    </div>
    <div class="instruction-container">
    </div>
    `
    });
    section.dataset.section = i;
    section.dataset.type = 'steps';
    const container = document.getElementById('instructions');
    container.insertBefore(section, container.lastChild);
    updateStepNumbers();
    addStep();
}

function addIngredientSection() {
    const i = ingredientSectionCount++;
    const section = document.createElement("div");
    Object.assign(section, {
        className: 'section-group',
        innerHTML: `
    <div class="flex">
        <span>•</span>
        <input class="section-title-input" type="text" name="ingredient_sections[${i}][title]"
        placeholder="Section title (optional)" value="">
    </div>
    <div class="ingredients-container">
    </div>
    `
    });
    section.dataset.section = i;
    section.dataset.type = 'ingredients';
    const container = document.getElementById('ingredients');
    container.insertBefore(section, container.lastChild);
    addIngredient();
}

export function addStep(currentInput = null) {
    const section = currentInput ? currentInput.closest(".section-group") : document.querySelector('#instructions .section-group:last-of-type');
    if (!section) return;

    const instructionsContainer = section.querySelector(".instruction-container");
    if (!instructionsContainer) return;

    const stepCount = instructionsContainer.children.length + 1;
    const number = String(stepCount).padStart(2, '0');
    const sectionIndex = section.dataset.section || 0;

    const box = document.createElement("div");
    box.classList.add("instruction-box");
    box.innerHTML = `
    <span class="instruction-number">${number}</span>
    <input class="instruction-text" type="text" name="step_sections[${sectionIndex}][steps][]" placeholder="Step ${stepCount}">
    `;

    if (currentInput) {
        const currentBox = currentInput.closest(".instruction-box");
        if (currentBox) {
            currentBox.after(box);
        } else {
            instructionsContainer.appendChild(box);
        }
    } else {
        instructionsContainer.appendChild(box);
    }

    updateStepNumbers();
    box.querySelector(".instruction-text").focus();
}

export function addIngredient(currentInput = null) {
    console.log("currentInput", currentInput);
    const section = currentInput ? currentInput.closest('.section-group') : document.querySelector('#ingredients .section-group:last-of-type');
    console.log("section found", section);
    if (!section) return;

    const container = section.querySelector('.ingredients-container');
    if (!container) return;

    const sectionIndex = section.dataset.section || 0;
    const item = currentInput ? currentInput.closest('.ingredient-item') : null;

    const newItem = document.createElement('div');
    newItem.classList.add('ingredient-item');
    newItem.innerHTML = `<span>•</span><input class="ingredient-text" type="text" name="ingredient_sections[${sectionIndex}][ingredients][]" autocomplete="off">`;

    if (item) {
        item.after(newItem);
    } else {
        const lastItem = container.querySelector('.ingredient-item:last-child');
        if (lastItem) {
            lastItem.after(newItem);
        } else {
            container.appendChild(newItem);
        }
    }

    newItem.querySelector('input').focus();
}

export function updateStepNumbers() {
    const sections = document.querySelectorAll('#instructions .section-group');
    sections.forEach((section) => {
        const numbers = section.querySelectorAll('.instruction-number');
        numbers.forEach((num, index) => {
            const count = index + 1;
            num.textContent = String(count).padStart(2, '0');
        });
    });
}

export async function handleAddRecipe(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

    const ingredients = prepareIngredients();

    const steps = formData.getAll('steps[]').filter(step => step.trim() !== '');
    formData.delete('steps[]');
    formData.append('steps', JSON.stringify(steps));

    formData.delete('ingredients[]');
    formData.append('ingredients', JSON.stringify(ingredients));
    
    const response = await fetch('/../api/recipes/add_recipe.php', {
        method: 'POST',
        body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
        // TODO REPLACE WITH TOAST
        alert('RECIPE ADDED');
        form.reset();
    }
    else {
        console.log('error?');
        alert(result.error);
    }
}

export async function handleAddFromUrl(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const response = await fetch('/../api/recipes/import_recipe_url.php', {
        method: 'POST',
        body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
        alert('RECIPE ADDED');
        form.reset();
    }
    else {
        console.log('error?');
        alert(result.error);
    }
}