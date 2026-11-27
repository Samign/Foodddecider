import { toast } from './toast.js';
import { requireLogin } from './ui.js';
import { pickItemsDialog } from './dialog.js';
import { fetchLists, pickList, listLabel, addItems, setLastListId } from './shopping-api.js';

const INGREDIENT = '.ingredient-item';

// "2  tbsp  olive oil" -> "2 tbsp olive oil" (empty amount/unit leave stray spaces)
const textOf = row => row.querySelector(':scope > p')?.textContent.replace(/\s+/g, ' ').trim() ?? '';

// ---- single ingredient: straight to the last used list -----------------------

async function addOne(button) {
    const text = textOf(button.closest(INGREDIENT));
    if (!text) return;
    if (!await requireLogin('keep a shopping list')) return;

    button.disabled = true;
    try {
        const list = pickList(await fetchLists());
        await addItems(list.id, [text]);
        toast.success(`Added to ${list.name}`);

        const icon = button.querySelector('.material-symbols-outlined');
        if (icon) {
            icon.textContent = 'check';
            setTimeout(() => { icon.textContent = 'add'; }, 1200);
        }
    } catch (error) {
        toast.error('Could not add to the shopping list');
    } finally {
        button.disabled = false;
    }
}

// ---- add all: choose ingredients and list ------------------------------------

async function addAll() {
    const texts = [...document.querySelectorAll(`#expanded-modal ${INGREDIENT}`)].map(textOf).filter(Boolean);
    if (!texts.length) {
        toast.info('This recipe has no ingredients to add');
        return;
    }
    if (!await requireLogin('keep a shopping list')) return;

    let lists;
    try {
        lists = await fetchLists();
    } catch (error) {
        toast.error('Could not load your lists');
        return;
    }

    const choice = await pickItemsDialog({
        title: 'Add to shopping list',
        items: texts,
        lists: lists.map(list => ({ id: list.id, label: listLabel(list) })),
        selectedListId: pickList(lists).id
    });
    if (!choice) return;   // cancelled

    try {
        await addItems(choice.listId, choice.items);
        setLastListId(choice.listId);
        const list = lists.find(item => String(item.id) === String(choice.listId));
        const n = choice.items.length;
        toast.success(`Added ${n} item${n === 1 ? '' : 's'} to ${list.name}`);
    } catch (error) {
        toast.error('Could not add the items');
    }
}

// ---- wiring --------------------------------------------------------------------

export function init() {
    // Delegated, so it also works for ingredients your JS renders later
    document.addEventListener('click', event => {
        const addButton = event.target.closest('.ingredient-add-button');
        if (addButton) {
            event.stopPropagation();   // don't also tick the ingredient off
            return addOne(addButton);
        }

        if (event.target.closest('.add-all-button')) addAll();
    });
}