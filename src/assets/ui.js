// assets/ui.js
// Small helpers the feature modules share:
//   api()          fetch + JSON + one error format (so every caller can show a useful toast)
//   isLoggedIn()   / requireLogin()  the "log in to do this" prompt
//   copyText()     clipboard with a fallback
//   onLongPress()  press-and-hold on touch screens (and mouse), e.g. to rename a list
//   bumpCount()    change a number on screen right away, with a small pop

import { confirmDialog } from './dialog.js';

// ── Requests ──────────────────────────────────────────────────────────────────

export class ApiError extends Error {
    constructor(message, status, data = {}) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

/**
 * api('/api/x.php', { method: 'POST', json: {...} })   JSON body
 * api('/api/x.php', { method: 'POST', form: formData }) form body
 * api('/api/x.php', { query: { id: 4 } })                 GET with a query string
 * Resolves the parsed JSON. Rejects with ApiError (message is safe to show in a toast).
 */
export async function api(url, { method = 'GET', json, form, query } = {}) {
    const full = query ? `${url}?${new URLSearchParams(query)}` : url;
    let response;
    try {
        response = await fetch(full, {
            method,
            headers: json ? { 'Content-Type': 'application/json' } : undefined,
            body: json ? JSON.stringify(json) : form,
        });
    } catch {
        throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
    }

    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
        throw new ApiError('You need to log in to do that.', 401, data);
    }
    if (!response.ok || data?.success === false || data?.status === 'error') {
        const message = data?.error || data?.message || data?.detail || 'Something went wrong. Try again.';
        throw new ApiError(message, response.status, data);
    }
    return data;
}

// ── Logged in or not ──────────────────────────────────────────────────────────

/** The header shows the avatar only for logged-in people (includes/modules.php getNavBar). */
export function isLoggedIn() {
    return Boolean(document.querySelector('.top .current-user'));
}

/**
 * Call before anything that needs an account. Returns true when logged in; otherwise asks
 * the person to log in or sign up (with what they were trying to do) and returns false.
 *   if (!await requireLogin('save recipes')) return;
 */
export async function requireLogin(whatFor) {
    if (isLoggedIn()) return true;
    const go = await confirmDialog({
        title: 'Log in to continue',
        message: `You need an account to ${whatFor}. It's free and takes a minute.`,
        confirmText: 'Log in or sign up',
        cancelText: 'Not now',
    });
    if (go) openLogin();
    return false;
}

export function openLogin(tab = 'login') {
    const modal = document.getElementById('login-modal');
    if (!modal) {                       // pages without the dialog: the home page opens it
        location.href = '/?login=1';
        return;
    }
    modal.classList.remove('hidden');
    document.getElementById('modal-overlay')?.classList.remove('hidden');
    modal.dispatchEvent(new CustomEvent('login:tab', { detail: tab }));
    modal.querySelector(tab === 'signup' ? '#signup-form input' : '#login-form input')?.focus();
}

// ── Clipboard ─────────────────────────────────────────────────────────────────

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Older browsers, or a page without clipboard permission
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
    }
}

// ── Press and hold ────────────────────────────────────────────────────────────

/**
 * onLongPress(container, '.selector', (element) => {...})
 * Fires after holding ~0.5 s without moving. Works with touch, pen and mouse, and stops the
 * phone's own long-press menu on those elements. Delegated, so rows added later work too.
 */
export function onLongPress(container, selector, callback, { ms = 500 } = {}) {
    let timer = 0, startX = 0, startY = 0, target = null;

    const cancel = () => {
        clearTimeout(timer);
        target?.classList.remove('is-pressing');
        target = null;
    };

    container.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const el = e.target.closest(selector);
        if (!el || !container.contains(el)) return;
        target = el;
        startX = e.clientX;
        startY = e.clientY;
        el.classList.add('is-pressing');
        timer = setTimeout(() => {
            el.classList.remove('is-pressing');
            el.dataset.longPressed = '1';           // lets a click handler ignore the click that follows
            setTimeout(() => delete el.dataset.longPressed, 400);
            navigator.vibrate?.(15);
            callback(el, e);
            target = null;
        }, ms);
    });
    container.addEventListener('pointermove', (e) => {
        if (target && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancel();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => container.addEventListener(type, cancel));
    container.addEventListener('contextmenu', (e) => {
        if (e.target.closest(selector) && e.pointerType !== 'mouse') e.preventDefault();
    });
}

// ── Numbers that change right away ───────────────────────────────────────────

/** Add delta to the first number in el's text ("3 saves" -> "4 saves") with a small pop. */
export function bumpCount(el, delta, { format } = {}) {
    if (!el) return;
    const current = Number((el.dataset.count ?? el.textContent.match(/-?\d+/)?.[0]) || 0);
    const next = Math.max(0, current + delta);
    el.dataset.count = next;
    el.textContent = format ? format(next) : el.textContent.replace(/-?\d+/, next);
    el.classList.remove('bump');
    void el.offsetWidth;            // restart the animation
    el.classList.add('bump');
}

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
