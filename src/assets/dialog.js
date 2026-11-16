// Styled replacements for confirm() and prompt(), usable from any file:
//
//   import { confirmDialog, promptDialog } from './dialog.js';
//
//   if (await confirmDialog({ title: 'Delete list?', message: 'This can\'t be undone.', confirmText: 'Delete', danger: true })) { ... }
//
//   const name = await promptDialog({ title: 'New list', placeholder: 'List name', confirmText: 'Create' });
//   if (name) { ... }          // name is null when the user cancels
//
// Built on the native <dialog> element, which already handles Escape, the dark backdrop and
// keeping keyboard focus inside the dialog. 

function openDialog({ title, message, confirmText, cancelText, danger, input, custom }) {
    return new Promise(resolve => {
        const dialog = document.createElement('dialog');
        dialog.className = 'app-dialog';

        const form = document.createElement('form');
        form.method = 'dialog';

        const heading = document.createElement('h2');
        heading.textContent = title;
        form.append(heading);

        if (message) {
            const text = document.createElement('p');
            text.textContent = message;
            form.append(text);
        }

        let field = null;
        if (input) {
            field = document.createElement('input');
            field.type = 'text';
            field.required = true;
            field.autofocus = true;
            field.autocomplete = 'off';
            field.maxLength = input.maxLength;
            field.placeholder = input.placeholder;
            form.append(field);
        }

        const actions = document.createElement('div');
        actions.className = 'app-dialog-actions';

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = cancelText;
        cancelButton.addEventListener('click', () => dialog.close('cancel'));

        const confirmButton = document.createElement('button');
        confirmButton.type = 'submit';
        confirmButton.value = 'ok';
        confirmButton.textContent = confirmText;
        if (danger) confirmButton.classList.add('danger');

        actions.append(cancelButton, confirmButton);

        // Custom content goes above the buttons. It returns a function that reads its result.
        const getValue = custom ? custom(form, confirmButton) : null;

        form.append(actions);
        dialog.append(form);

        dialog.addEventListener('click', event => {
            if (event.target === dialog) dialog.close('cancel');
        });

        dialog.addEventListener('close', () => {
            const confirmed = dialog.returnValue === 'ok';
            let result;
            if (getValue) result = confirmed ? getValue() : null;
            else if (input) result = confirmed ? field.value.trim() || null : null;
            else result = confirmed;

            dialog.remove();
            resolve(result);
        });

        document.body.append(dialog);
        dialog.showModal();
    });
}

/** Resolves true when the user confirms, false when they cancel. */
export function confirmDialog({ title, message = '', confirmText = 'OK', cancelText = 'Cancel', danger = false }) {
    return openDialog({ title, message, confirmText, cancelText, danger });
}

/** Resolves the typed text, or null when the user cancels or leaves it empty. */
export function promptDialog({ title, message = '', placeholder = '', confirmText = 'OK', cancelText = 'Cancel', maxLength = 255 }) {
    return openDialog({ title, message, confirmText, cancelText, danger: false, input: { placeholder, maxLength } });
}

export function pickItemsDialog({ title, items, lists, selectedListId, confirmText = 'Add', cancelText = 'Cancel' }) {
    return openDialog({
        title, confirmText, cancelText, danger: false,
        custom(form, confirmButton) {
            const select = document.createElement('select');
            select.className = 'app-dialog-select';
            select.setAttribute('aria-label', 'Shopping list');
            for (const list of lists) select.add(new Option(list.label, list.id));
            select.value = String(selectedListId);

            const checklist = document.createElement('div');
            checklist.className = 'app-dialog-checklist';
            for (const text of items) {
                const label = document.createElement('label');
                const box = document.createElement('input');
                box.type = 'checkbox';
                box.checked = true;          // everything ticked by default
                box.value = text;
                label.append(box, ` ${text}`);   // a text node, so no markup injection
                checklist.append(label);
            }

            const ticked = () => [...checklist.querySelectorAll('input:checked')].map(box => box.value);
            const update = () => {
                const count = ticked().length;
                confirmButton.textContent = count ? `${confirmText} ${count}` : confirmText;
                confirmButton.disabled = count === 0;
            };
            checklist.addEventListener('change', update);
            update();

            form.append(select, checklist);
            return () => ({ listId: select.value, items: ticked() });
        }
    });
}