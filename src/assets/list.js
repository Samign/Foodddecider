// Shopping list modal. main.js calls init(modal) once the page has loaded.
//
//   Enter / leaving a field    -> save that one item (created the first time, updated after that)
//   Backspace in an empty row  -> delete that item
//   Check an item              -> it is struck through, then moves to the archive
//   Uncheck it in the archive  -> it goes back to its place in the list
//   Picking another list       -> shows that list ("Create new list" makes one)
//   every few seconds          -> (while the modal is open) fetch the list and show other people's changes
//
// The server deletes archived items two days after they were checked.

import { request, ITEMS_API, LISTS_API, listLabel, getLastListId, setLastListId } from './shopping-api.js';
import { toast } from './toast.js';
import { confirmDialog, promptDialog } from './dialog.js';

const POLL_EVERY_MS = 4000;
const ARCHIVE_DELAY_MS = 600;   // how long a checked item stays struck through in the list before it moves

// Elements inside the modal
const ROWS = '.shopping-rows';                  // rows that are still on the list
const ARCHIVE_ROWS = '.shopping-archive-rows';  // checked rows
const PICKER = '#lists';                        // the <select> of lists; its options are built here
const CREATE_LIST = 'create-new-list';          // value of the picker's last option
const DELETE_BUTTON = '.delete-list-button';
const SHARE_BUTTON = '#share-list-button';      // optional: opens the share panel (owners only)
const SHARE_PANEL = '.share-panel';             // optional: one checkbox per group, built here

// The row markup your sections.js code builds
const ROW = '.shopping-item';
const TEXT = '.shopping-text';
const CHECKBOX = '.shopping-check';

// A position that sorts between two neighbours (null = no neighbour on that side)
function positionBetween(above, below) {
    if (above === null && below === null) return 1;
    if (above === null) return below - 1;
    if (below === null) return above + 1;
    return (above + below) / 2;
}

// Position of the closest saved row in one direction ('previousElementSibling' or 'nextElementSibling')
function nearestPosition(row, direction) {
    for (let other = row[direction]; other; other = other[direction]) {
        if (other.dataset.pos) return Number(other.dataset.pos);
    }
    return null;
}

function positionFor(row) {
    return positionBetween(
        nearestPosition(row, 'previousElementSibling'),
        nearestPosition(row, 'nextElementSibling')
    );
}

function addBlankRow(afterRow = null) {
    const row = document.createElement('div');
    row.className = 'shopping-item';
    row.innerHTML = `
        <label>
            <input type="checkbox" class="shopping-check">
            <span class="material-symbols-outlined icon-unchecked">circle</span>
            <span class="material-symbols-outlined icon-checked">check_circle</span>
        </label>
        <input type="text" class="shopping-text" placeholder="Add an item..." autocomplete="off">
    `;

    if (afterRow) afterRow.after(row);
    else document.querySelector('#shopping-list-modal .shopping-rows').append(row);
    return row;
}

/**
 * Each row remembers its state in data attributes:
 *   data-id    the database id (missing until the item has been created)
 *   data-pos   the sort position
 *   data-text  the text as last saved
 *
 * Returns { moved(row), switchList(newListId) }.
 */
function createShoppingList(modal, firstListId) {
    const container = modal.querySelector(ROWS);
    const archive = modal.querySelector(ARCHIVE_ROWS);
    const isOpen = () => !modal.classList.contains('hidden');   // adjust to how your modal opens and closes

    let currentListId = firstListId;     // changes when the user switches list
    let saveChain = Promise.resolve();   // saves run one at a time, in the order they were made
    let savesInFlight = 0;
    let savesStarted = 0;
    let polling = false;

    const allRows = () => container.querySelectorAll(ROW);
    const inputOf = row => row.querySelector(TEXT);

    function findRow(id) {
        const selector = `${ROW}[data-id="${id}"]`;
        return container.querySelector(selector) || archive.querySelector(selector);
    }

    // Nothing is submitted as a whole any more, so a surrounding <form> must not submit
    document.querySelector('#shopping-list-form')?.addEventListener('submit', event => event.preventDefault());

    // ---- saving ------------------------------------------------------------

    // Saves wait for the previous one, so a new item is always created before a later edit to it is sent
    function queueSave(row, task) {
        savesInFlight++;
        savesStarted++;
        saveChain = saveChain
            .then(task)
            .then(() => row.classList.remove('save-failed'))
            .catch(error => {
                console.error(error);
                row.classList.add('save-failed');
            })
            .finally(() => { savesInFlight--; });
    }

    function send(body) {
        return request(ITEMS_API, { method: 'POST', body: { list_id: currentListId, ...body } });
    }

    async function updateItem(row, fields) {
        if (!row.dataset.id) return;   // never created on the server
        const result = await send({ action: 'update', id: row.dataset.id, ...fields });
        if (result.gone) row.remove();   // someone else deleted it
    }

    async function saveItem(row, fields) {
        if (row.dataset.id) {
            await updateItem(row, fields);
        } else {
            const result = await send({ action: 'create', position: Number(row.dataset.pos), ...fields });
            row.dataset.id = result.id;
        }
    }

    // Saves the text in a row (called on Enter and when the field changes)
    function commit(row) {
        const text = inputOf(row).value.trim();
        if (text === (row.dataset.text ?? '')) return;   // nothing changed since the last save
        row.dataset.text = text;

        if (text === '') {
            removeRow(row);
            return;
        }

        if (!row.dataset.id && !row.dataset.pos) row.dataset.pos = positionFor(row);
        queueSave(row, () => saveItem(row, { text }));
    }

    function removeRow(row) {
        queueSave(row, async () => {
            if (row.dataset.id) await send({ action: 'delete', id: row.dataset.id });
        });
        row.remove();
        ensureOneRow();
    }

    // Call when a drag ends
    function moved(row) {
        if (!row.dataset.pos) return;   // not saved yet: it gets its position when it is first saved
        row.dataset.pos = positionFor(row);
        const position = Number(row.dataset.pos);
        queueSave(row, () => updateItem(row, { position }));
    }

    // ---- checking and the archive ------------------------------------------

    function ensureOneRow() {
        if (allRows().length === 0) addBlankRow(null);
    }

    function updateArchiveCount() {
        const details = archive.closest('details');
        if (!details) return;

        const count = archive.querySelectorAll(ROW).length;
        details.hidden = count === 0;

        const label = details.querySelector('.archive-count');
        if (label) label.textContent = count;
    }

    // Greyed out and struck through (see the CSS), and no longer editable
    function showChecked(row, checked) {
        const checkbox = row.querySelector(CHECKBOX);
        if (checkbox) checkbox.checked = checked;
        row.classList.toggle('checked', checked);
        inputOf(row).readOnly = checked;
    }

    function moveToArchive(row) {
        if (!row.isConnected) return;   // deleted in the meantime
        archive.prepend(row);           // newest first
        ensureOneRow();
        updateArchiveCount();
    }

    // Put an unchecked row back where its position says
    function putBackInList(row) {
        const savedRows = [...allRows()].filter(other => other.dataset.pos);
        const nextRow = savedRows.find(other => Number(other.dataset.pos) > Number(row.dataset.pos));

        if (nextRow) nextRow.before(row);
        else if (savedRows.length > 0) savedRows[savedRows.length - 1].after(row);
        else container.prepend(row);

        updateArchiveCount();
    }

    function toggleChecked(row, checked) {
        if (!row.dataset.pos) {   // a blank row has nothing to check yet
            showChecked(row, false);
            return;
        }

        showChecked(row, checked);
        clearTimeout(Number(row.dataset.archiveTimer));

        if (checked) {
            // Stay in the list, struck through, for a moment before moving to the archive
            row.dataset.archiveTimer = setTimeout(() => moveToArchive(row), ARCHIVE_DELAY_MS);
        } else {
            putBackInList(row);
        }

        queueSave(row, () => updateItem(row, { checked }));
    }

    // ---- other people's changes --------------------------------------------

    function fillRow(row, item) {
        inputOf(row).value = item.name;
        row.dataset.text = item.name;
        row.dataset.id = item.id;
        row.dataset.pos = item.position;
        showChecked(row, item.checked);
    }

    function placeAfter(row, previousRow, target) {
        if (previousRow) previousRow.after(row);
        else target.prepend(row);
    }

    // Makes one of the two lists match the server's items (which arrive in the right order)
    function syncList(items, target) {
        let previousRow = null;

        for (const item of items) {
            let row = findRow(item.id);

            if (!row) {
                row = addBlankRow(null);
                fillRow(row, item);
                placeAfter(row, previousRow, target);
            } else if (!row.contains(document.activeElement)) {   // leave the row you are typing in alone
                const needsPlacing = row.parentElement !== target
                    || Number(row.dataset.pos) !== Number(item.position);
                fillRow(row, item);
                if (needsPlacing) placeAfter(row, previousRow, target);
            }

            if (row.parentElement === target) previousRow = row;
        }
    }

    function showItems(items) {
        // Remove rows that someone else deleted
        const idsOnServer = new Set(items.map(item => String(item.id)));
        for (const row of [...allRows(), ...archive.querySelectorAll(ROW)]) {
            const isSaved = row.dataset.id !== undefined;
            if (isSaved && !idsOnServer.has(row.dataset.id)) row.remove();
        }

        syncList(items.filter(item => !item.checked), container);
        syncList(items.filter(item => item.checked), archive);

        ensureOneRow();
        updateArchiveCount();
    }

    async function poll() {
        if (polling || document.hidden || !isOpen() || savesInFlight > 0) return;
        polling = true;
        const listAtStart = currentListId;
        const savesAtStart = savesStarted;

        try {
            const { items } = await request(ITEMS_API, { query: { list_id: listAtStart } });
            const outOfDate = listAtStart !== currentListId   // the user switched list in the meantime
                || savesInFlight > 0
                || savesStarted !== savesAtStart;
            if (!outOfDate) showItems(items);   // otherwise the next poll fixes it
        } catch (error) {
            console.error(error);
        } finally {
            polling = false;
            if (listAtStart !== currentListId) poll();   // load the list we switched to right away
        }
    }

    // ---- switching list ----------------------------------------------------

    function clearRows() {
        for (const row of [...allRows(), ...archive.querySelectorAll(ROW)]) row.remove();
    }

    // Show a different list. Saves that are already queued finish for the old list first.
    async function switchList(newListId) {
        clearRows();   // the old list can't be edited any more
        while (savesInFlight > 0) await saveChain;

        currentListId = newListId;
        ensureOneRow();
        updateArchiveCount();
        poll();
    }

    // ---- keyboard and clicks -----------------------------------------------

    // Focus the empty row below this one, adding it if it isn't there yet
    function focusBlankRowBelow(row) {
        const below = row.nextElementSibling;
        const belowIsBlank = below && below.matches(ROW) && !below.dataset.id && inputOf(below).value === '';
        inputOf(belowIsBlank ? below : addBlankRow(row)).focus();
    }

    document.addEventListener('keydown', event => {
        const input = event.target.closest(TEXT);
        if (!input) return;
        const row = input.closest(ROW);

        if (event.key === 'Enter') {
            console.log('Enter pressed in row', row.dataset.id, 'with text', input.value);
            event.preventDefault();
            if (input.value.trim() === '') return;
            commit(row);
            focusBlankRowBelow(row);
        }

        if (event.key === 'Backspace' && input.value === '') {
            event.preventDefault();
            const neighbour = row.previousElementSibling || row.nextElementSibling;
            removeRow(row);
            inputOf(neighbour || container.querySelector(ROW)).focus();
        }
    });

    function onChange(event) {
        const row = event.target.closest(ROW);
        if (!row) return;

        if (event.target.matches(TEXT)) commit(row);
        if (event.target.matches(CHECKBOX)) toggleChecked(row, event.target.checked);
    }

    document.addEventListener('change', onChange);
    // archive.addEventListener('change', onChange);

    // ---- start -------------------------------------------------------------

    setInterval(poll, POLL_EVERY_MS);   // does nothing while the modal is closed
    document.addEventListener('visibilitychange', poll);   // refresh as soon as the tab is visible again

    // Load right away when the modal is opened instead of waiting for the next tick
    new MutationObserver(poll).observe(modal, { attributes: true, attributeFilter: ['class'] });
    ensureOneRow(); 
    poll();

    return { moved, switchList };
}

// ---- the list picker ------------------------------------------------------

function renderPicker(picker, lists, selectedId) {
    const options = lists.map(list => new Option(listLabel(list), list.id));
    options.push(new Option('+ Create new list', CREATE_LIST));
    picker.replaceChildren(...options);
    picker.value = selectedId;
}

// One checkbox per group: checked = the list is shared with that group
function renderSharePanel(panel, groups) {
    if (groups.length === 0) {
        panel.textContent = "You aren't in any groups yet.";
        return;
    }

    panel.replaceChildren(...groups.map(group => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = group.id;
        checkbox.checked = group.shared;
        label.append(checkbox, ` ${group.group_name}`);
        return label;
    }));
}

// Called by main.js with the #shopping-list-modal element
export async function init(modal) {
    try {

        
        const shoppingButton = document.querySelector('.shopping-list-button');
        shoppingButton.addEventListener('click', () => modal.classList.toggle('hidden'));

        const picker = modal.querySelector(PICKER);
        const { lists } = await request(LISTS_API);   // the user's own lists first, then lists shared with them

       const remembered = lists.find(item => String(item.id) === getLastListId());
        let currentId = String(remembered?.id ?? lists[0].id);

        renderPicker(picker, lists, currentId);
        const list = createShoppingList(modal, currentId);
        
        const deleteButton = modal.querySelector(DELETE_BUTTON);
        const shareButton = modal.querySelector(SHARE_BUTTON);
        const sharePanel = modal.querySelector(SHARE_PANEL);
        function showOwnerControls() {
            const current = lists.find(item => String(item.id) === currentId);
            const isOwner = Boolean(current?.is_owner);
            if (deleteButton) deleteButton.hidden = !isOwner;
            if (shareButton) shareButton.hidden = !isOwner;
            if (sharePanel) sharePanel.hidden = true;   // closed whenever the list changes
        }
        showOwnerControls();

        picker.addEventListener('change', async () => {
            if (picker.value !== CREATE_LIST) {
                currentId = picker.value;
                setLastListId(currentId);
                showOwnerControls();
                list.switchList(currentId);
                return;
            }

            const name = await promptDialog({ title: 'New shopping list', placeholder: 'List name', confirmText: 'Create' });
            if (!name) {   // cancelled
                picker.value = currentId;
                return;
            }

            try {
                const { id } = await request(LISTS_API, { method: 'POST', body: { action: 'create', list_name: name } });
                lists.push({ id, name, is_owner: true });
                currentId = String(id);
                setLastListId(currentId);
                renderPicker(picker, lists, currentId);
                showOwnerControls();
                list.switchList(currentId);
            } catch (error) {
                console.error(error);
                picker.value = currentId;
                toast.error('Could not create the list');
            }
        });

        deleteButton?.addEventListener('click', async () => {
            const current = lists.find(item => String(item.id) === currentId);
            if (!current?.is_owner) return;
            if (!await confirmDialog({ title: 'Delete list', message: `Delete "${current.name}" and everything on it? This can't be undone.` })) return;

            try {
                await request(LISTS_API, { method: 'POST', body: { action: 'delete', list_id: current.id } });

                // Reload the lists: the server makes a new personal list if that was the user's last one
                const fresh = await request(LISTS_API);
                lists.splice(0, lists.length, ...fresh.lists);

                currentId = String(lists[0].id);
                setLastListId(currentId);
                renderPicker(picker, lists, currentId);
                showOwnerControls();
                list.switchList(currentId);
            } catch (error) {
                console.error(error);
                toast.error('Could not delete the list');
            }
        });

        shareButton?.addEventListener('click', async () => {
            if (!sharePanel) return;
            if (!sharePanel.hidden) {   // already open: close it
                sharePanel.hidden = true;
                return;
            }

            const forList = currentId;
            sharePanel.textContent = 'Loading…';
            sharePanel.hidden = false;

            try {
                const { groups } = await request(LISTS_API, { query: { list_id: forList } });
                if (forList === currentId) renderSharePanel(sharePanel, groups);   // ignore it if the user switched list meanwhile
            } catch (error) {
                console.error(error);
                sharePanel.textContent = 'Could not load your groups.';
            }
        });

        // Ticking a group shares the list with it, unticking stops sharing
        sharePanel?.addEventListener('change', async event => {
            const checkbox = event.target;
            if (!checkbox.matches('input[type="checkbox"]')) return;

            try {
                await request(LISTS_API, {
                    method: 'POST',
                    body: { action: checkbox.checked ? 'share' : 'unshare', list_id: currentId, group_id: checkbox.value }
                });
            } catch (error) {
                console.error(error);
                checkbox.checked = !checkbox.checked;   // put it back
                toast.error('Could not change sharing');
            }
        });

        // Dragging to reorder, e.g. with SortableJS:
        // Sortable.create(modal.querySelector(ROWS), { onEnd: event => list.moved(event.item) });
    } catch (error) {
        console.error('Could not start the shopping list', error);
    }
}