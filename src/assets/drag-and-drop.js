// assets/drag-and-drop.js
// The photo box in the add/edit recipe form: click or drop a photo, see a preview.
// Every photo is checked first (photo-check.js). One that won't work is refused with a
// message right under the box, and the photo that was there before stays.

import { checkPhoto, rulesFrom, showPhotoMessage } from './photo-check.js';

let fileInput = null;
let uploadBox = null;
let preview = null;
let uploadContent = null;
let uploadLabel = null;
let message = null;
let acceptedFiles = null;   // the last photo that passed, to put back if a new one is refused

export function init(targetElement) {
    fileInput = targetElement.querySelector('#picture');
    uploadBox = targetElement.querySelector('#uploadBox');
    preview = targetElement.querySelector('#preview');
    uploadContent = targetElement.querySelector('#uploadContent');
    uploadLabel = targetElement.querySelector('.upload-label');
    message = targetElement.querySelector('#photo-message');
    if (!fileInput || !uploadBox || uploadBox.dataset.bound) return;
    uploadBox.dataset.bound = '1';

    fileInput.addEventListener('change', () => usePhoto(fileInput.files));

    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadLabel.classList.add('dragover');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadLabel.classList.remove('dragover');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadLabel.classList.remove('dragover');
        if (e.dataTransfer.files.length > 1) {
            showPhotoMessage(message, { error: 'Drop one photo at a time.' });
            return;
        }
        usePhoto(e.dataTransfer.files);
    });

    // A fresh form (after saving, or opened again for a new recipe) starts without a photo or message
    fileInput.form?.addEventListener('reset', () => clearPhoto());
}

async function usePhoto(files) {
    const file = files?.[0];
    if (!file) return;

    uploadBox.classList.add('is-checking');
    const result = await checkPhoto(file, rulesFrom(uploadBox));
    uploadBox.classList.remove('is-checking');
    if (result.error) {
        // A photo already in the box (chosen earlier, or the saved one when editing) stays
        result.error += preview.classList.contains('hidden')
            ? ' You can still save the recipe without a photo.'
            : ' The current photo is kept.';
    }

    showPhotoMessage(message, result);
    uploadBox.classList.toggle('is-invalid', !result.ok);

    if (!result.ok) {
        // Put back what was there before, so a refused photo never gets sent with the form
        restoreFiles(acceptedFiles);
        return;
    }

    restoreFiles(files);          // needed for drops: the input doesn't hold dropped files by itself
    acceptedFiles = files;
    showPreview(file);
}

function restoreFiles(files) {
    try {
        if (files) {
            const transfer = new DataTransfer();
            transfer.items.add(files[0]);
            fileInput.files = transfer.files;
        } else {
            fileInput.value = '';
        }
    } catch {
        fileInput.value = '';     // very old browsers can't set files: send no photo rather than a bad one
    }
}

function showPreview(file) {
    const url = URL.createObjectURL(file);
    preview.onload = () => URL.revokeObjectURL(url);
    preview.src = url;
    preview.classList.remove('hidden');
    uploadContent.classList.add('hidden');
}

function clearPhoto() {
    acceptedFiles = null;
    preview.removeAttribute('src');
    preview.classList.add('hidden');
    uploadContent.classList.remove('hidden');
    uploadBox.classList.remove('is-invalid');
    showPhotoMessage(message, null);
}

/** Server said the photo can't be used (a check the browser can't do, or an old browser). */
export function showPhotoError(text) {
    if (!uploadBox) return;
    restoreFiles(null);
    acceptedFiles = null;
    preview.removeAttribute('src');                 // don't keep showing the photo that was refused
    preview.classList.add('hidden');
    uploadContent.classList.remove('hidden');
    uploadBox.classList.add('is-invalid');
    showPhotoMessage(message, { error: text });
    uploadBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function showLoadedpreview(imageUrl) {
    if (!preview) return;
    showPhotoMessage(message, null);
    uploadBox?.classList.remove('is-invalid');
    if (!imageUrl) {
        preview.classList.add('hidden');
        uploadContent.classList.remove('hidden');
        return;
    }
    preview.src = imageUrl;
    preview.classList.remove('hidden');
    uploadContent.classList.add('hidden');
}
