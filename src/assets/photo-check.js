// assets/photo-check.js
//
// Checks a photo the moment it's chosen or dropped, so the person hears straight away
// that it won't work (and why) instead of finding the recipe saved without it.
// The limits come from the page (data- attributes printed by modules.php from
// includes/upload_image.php), so browser and server always agree. The server checks again.

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const NAMES = /\.(jpe?g|png|webp|gif)$/i;
const HEIC  = /\.(heic|heif)$/i;

const DEFAULTS = { maxBytes: 8 * 1024 * 1024, maxPixels: 40_000_000, minSide: 300 };

/** Read the limits from an element's data- attributes (falls back to the defaults). */
export function rulesFrom(element) {
    const d = element?.dataset ?? {};
    return {
        maxBytes:  Number(d.maxBytes)  || DEFAULTS.maxBytes,
        maxPixels: Number(d.maxPixels) || DEFAULTS.maxPixels,
        minSide:   Number(d.minSide)   || DEFAULTS.minSide,
    };
}

const mb = bytes => (bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '');

/**
 * @returns {Promise<{ok: boolean, error?: string, warning?: string, width?: number, height?: number}>}
 */
export async function checkPhoto(file, rules = DEFAULTS) {
    if (!file) return { ok: false, error: 'No photo was chosen.' };

    if (HEIC.test(file.name) || /hei[cf]/i.test(file.type)) {
        return { ok: false, error: 'iPhone HEIC photos can’t be used yet. Save it as JPG (or set the camera to “Most Compatible”) and try again.' };
    }
    // Some systems leave file.type empty, so the file name counts too
    if (!TYPES.includes(file.type) && !NAMES.test(file.name)) {
        return { ok: false, error: 'That isn’t a supported picture. Use a JPG, PNG, WEBP or GIF.' };
    }
    if (file.size > rules.maxBytes) {
        return { ok: false, error: `The photo is ${mb(file.size)} MB. Choose one under ${mb(rules.maxBytes)} MB.` };
    }
    if (file.size === 0) {
        return { ok: false, error: 'That file is empty. Choose the photo again.' };
    }

    // Actually open it: catches renamed files and damaged downloads
    let size;
    try {
        size = await imageSize(file);
    } catch {
        return { ok: false, error: 'That file can’t be opened as a picture. It may be damaged. Try another photo.' };
    }

    const { width, height } = size;
    if (width * height > rules.maxPixels) {
        return { ok: false, width, height,
            error: `The photo is ${width} × ${height} pixels, too large to process. Use one under ${Math.round(rules.maxPixels / 1e6)} megapixels.` };
    }
    if (Math.min(width, height) < rules.minSide) {
        return { ok: true, width, height,
            warning: `This photo is small (${width} × ${height}) and may look blurry. A larger one will look better.` };
    }
    return { ok: true, width, height };
}

async function imageSize(file) {
    if ('createImageBitmap' in window) {
        const bitmap = await createImageBitmap(file);
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close?.();
        return size;
    }
    const url = URL.createObjectURL(file);
    try {
        return await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = reject;
            img.src = url;
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Show a check result next to the photo field.
 * messageEl: an element with role="alert" (hidden when there is nothing to say).
 */
export function showPhotoMessage(messageEl, result) {
    if (!messageEl) return;
    const text = result?.error || result?.warning || '';
    messageEl.textContent = text;
    messageEl.hidden = !text;
    messageEl.classList.toggle('is-error', !!result?.error);
    messageEl.classList.toggle('is-warning', !result?.error && !!result?.warning);
}

/**
 * For a plain <input type="file"> (e.g. the sign-up form): check on change, clear it if it
 * won't work. Returns nothing; the input stays empty until a usable photo is chosen.
 */
export function guardFileInput(input, messageEl, afterError = '') {
    if (!input || input.dataset.photoChecked) return;
    input.dataset.photoChecked = '1';
    input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) { showPhotoMessage(messageEl, null); return; }
        const result = await checkPhoto(file, rulesFrom(input));
        if (result.error && afterError) result.error += ' ' + afterError;
        showPhotoMessage(messageEl, result);
        if (!result.ok) input.value = '';
    });
}
