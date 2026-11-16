// Small toast notifications in the bottom-right corner, usable from any file:
//
//   import { toast } from './toast.js';
//   toast.success('List deleted');
//   toast.error('Could not save your change');
//   toast.info('Copied', { duration: 2000 });
//
// Click a toast to dismiss it. The styles are in notify.css.

const DURATIONS = { info: 4000, success: 3000, error: 6000 };   // how long each kind stays, in ms
const FADE_MS = 200;                                            // matches the CSS transition

let container = null;

function getContainer() {
    if (!container?.isConnected) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');   // screen readers announce new toasts
        document.body.append(container);
    }
    return container;
}

function show(type, message, { duration = DURATIONS[type] } = {}) {
    const element = document.createElement('div');
    element.className = `toast toast-${type}`;
    element.textContent = message;   // plain text, so names typed by users can't inject markup
    getContainer().append(element);

    // Add the class on the next frame so the fade-in runs
    requestAnimationFrame(() => element.classList.add('toast-visible'));

    let dismissed = false;
    const timer = setTimeout(dismiss, duration);

    function dismiss() {
        if (dismissed) return;
        dismissed = true;
        clearTimeout(timer);
        element.classList.remove('toast-visible');
        setTimeout(() => element.remove(), FADE_MS);
    }

    element.addEventListener('click', dismiss);
}

export const toast = {
    info:    (message, options) => show('info', message, options),
    success: (message, options) => show('success', message, options),
    error:   (message, options) => show('error', message, options)
};