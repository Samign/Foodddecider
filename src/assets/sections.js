import { groupBySection } from './recipe-data.js';

let stepSectionCount = 0;
let ingredientSectionCount = 0;

export function init() {
    let form = document.querySelector('#add-recipe-form');
    form.addEventListener('keydown', (e) => {
        const target = e.target;
        const type = target.classList.contains('instruction-text') ? 'steps'
                   : target.classList.contains('ingredient-text')   ? 'ingredients'
                   : null;
        if (!type) return;
 
        if (e.key === 'Enter') {
            e.preventDefault();
            addRow(type, target);
        } else if (e.key === 'Backspace' && target.value === '') {
            e.preventDefault();
            removeRow(type, target);
        }
    });
}

const SECTION_TYPES = {
    steps: {
        containerId: 'instructions',
        rowsClass:   'instruction-container',
        rowClass:    'instruction-box',
        rowInput:    '.instruction-text',
        field:       'step_sections',
        rowField:    'steps',
        next:        () => stepSectionCount++,
        reset:       () => { stepSectionCount = 0; },
        renumber:    () => updateStepNumbers(),
        rowHtml:     (name, count) => `
            <span class="instruction-number">${String(count).padStart(2, '0')}</span>
            <input class="instruction-text" type="text" name="${name}" placeholder="Step ${count}">`
    },
    ingredients: {
        containerId: 'ingredients',
        rowsClass:   'ingredients-container',
        rowClass:    'ingredient-item',
        rowInput:    '.ingredient-text',
        field:       'ingredient_sections',
        rowField:    'ingredients',
        next:        () => ingredientSectionCount++,
        reset:       () => { ingredientSectionCount = 0; },
        rowHtml:     name => `
            <span>•</span>
            <input class="ingredient-text" type="text" name="${name}" autocomplete="off">`
    }
};

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

export function addRow(type, currentInput = null, { focus = true } = {}) {
    const cfg = SECTION_TYPES[type];
 
    const section = currentInput
        ? currentInput.closest('.section-group')
        : document.querySelector(`#${cfg.containerId} .section-group:last-of-type`);
    if (!section) return null;
 
    const container = section.querySelector(`.${cfg.rowsClass}`);
    if (!container) return null;
 
    const sectionIndex = section.dataset.section || 0;
    const count = container.children.length + 1;
 
    const row = document.createElement('div');
    row.classList.add(cfg.rowClass);
    row.innerHTML = cfg.rowHtml(`${cfg.field}[${sectionIndex}][${cfg.rowField}][]`, count);
 
    const currentRow = currentInput?.closest(`.${cfg.rowClass}`);
    if (currentRow) {
        currentRow.after(row);
    } else {
        container.appendChild(row);
    }
 
    cfg.renumber?.();
 
    const input = row.querySelector(cfg.rowInput);
    if (focus) input.focus();
    return input;
}

export function addSection(type, title = '', { addFirstRow = true } = {}) {
    const cfg = SECTION_TYPES[type];
    const existing = document.querySelectorAll(`#${cfg.containerId} .section-group`).length;
    const i = Math.max(cfg.next(), existing);
 
    const section = document.createElement('div');
    section.className = 'section-group';
    section.dataset.section = i;
    section.dataset.type = type;
    section.innerHTML = `
        <div class="flex">
            <span>•</span>
            <input class="section-title-input" type="text" name="${cfg.field}[${i}][title]"
                   placeholder="Section title (optional)">
        </div>
        <div class="${cfg.rowsClass}"></div>
    `;
    // Set via .value so quotes or HTML in a title can't break the markup
    section.querySelector('.section-title-input').value = title;
 
    const container = document.getElementById(cfg.containerId);
    container.insertBefore(section, container.lastChild);
 
    cfg.renumber?.();
    if (addFirstRow) addRow(type);
    return section;
}

export const addStep = (currentInput = null) => addRow('steps', currentInput);
export const addIngredient = (currentInput = null) => addRow('ingredients', currentInput);
export const addStepSection = () => addSection('steps');
export const addIngredientSection = () => addSection('ingredients');

export function fillEditList(type, items, sections, toText) {
    const cfg = SECTION_TYPES[type];
    const container = document.getElementById(cfg.containerId);
 
    container.querySelectorAll('.section-group').forEach(el => el.remove());
    cfg.reset();
 
    const groups = groupBySection(items, sections);
 
    // Nothing saved yet: start with one empty section so the "add row" buttons work
    if (!groups.length) {
        addSection(type);
        return;
    }
 
    for (const group of groups) {
        // The add form keeps every row inside a section, so "no section" becomes an untitled one
        addSection(type, group.name ?? '', { addFirstRow: false });
 
        for (const item of group.items) {
            const input = addRow(type, null, { focus: false });
            if (input) input.value = toText(item);
        }
    }
    cfg.renumber?.();
}

function removeRow(type, input) {
    const cfg = SECTION_TYPES[type];
    const row = input.closest(`.${cfg.rowClass}`);
    const container = row?.parentElement;                     // this section's rows container
    if (!row || !container || container.children.length === 1) return;
 
    // Move focus to the row before it, or the row after it if this was the first one
    (row.previousElementSibling ?? row.nextElementSibling)?.querySelector('input')?.focus();
    row.remove();
    cfg.renumber?.();
}

