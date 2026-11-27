// assets/landing-page.js
// Only loaded for visitors who aren't logged in (main.js loads it when #login-modal exists).
// The log in / sign up dialog, and "log in to do this" for the add button.

import { guardFileInput, showPhotoMessage } from './photo-check.js';
import { requireLogin, openLogin } from './ui.js';

let loginModal = null;

export function init(targetElement) {
    loginModal = targetElement;

    // Visitors see Discover: their own kitchen needs an account
    const personal = document.getElementById('personal-recipes');
    if (personal) {
        personal.classList.remove('active');
        document.getElementById('public-recipes')?.classList.add('active');
    }

    document.getElementById('log-in')?.addEventListener('click', () => openLogin('login'));
    document.getElementById('add-button')?.addEventListener('click', () => requireLogin('add your own recipes'));

    initTabs();
    initLogin();
    initSignup();

    // Pages without the dialog send people to /?login=1 (see ui.js openLogin)
    if (new URLSearchParams(location.search).has('login')) {
        history.replaceState(history.state, '', location.pathname);
        openLogin('login');
    }
}

function initTabs() {
    const tabs = loginModal.querySelectorAll('[data-tab]');
    const show = (name) => {
        tabs.forEach(tab => {
            const on = tab.dataset.tab === name;
            tab.classList.toggle('selected', on);
            tab.setAttribute('aria-selected', String(on));
        });
        loginModal.querySelectorAll('[data-tab-panel]').forEach(panel => {
            panel.hidden = panel.dataset.tabPanel !== name;
        });
        loginModal.querySelector(`[data-tab-panel="${name}"] input`)?.focus();
    };
    tabs.forEach(tab => tab.addEventListener('click', () => show(tab.dataset.tab)));
    loginModal.addEventListener('login:tab', (e) => show(e.detail));
}

function showFormError(form, message) {
    const box = form.querySelector('.form-error');
    box.textContent = message || '';
    box.hidden = !message;
}

async function submitWithFeedback(form, send) {
    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'One moment…';
    showFormError(form, '');
    try {
        await send();
    } catch {
        showFormError(form, 'Could not reach the server. Check your connection and try again.');
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}

function initLogin() {
    const form = loginModal.querySelector('#login-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitWithFeedback(form, async () => {
            const response = await fetch(form.action, {
                method: 'POST',
                headers: { Accept: 'application/json' },
                body: new FormData(form),
            });
            const result = await response.json().catch(() => ({}));
            if (response.ok && result.success) {
                location.reload();             // the same page, now logged in
                return;
            }
            showFormError(form, result.error || 'Could not log in. Try again.');
            form.querySelector('#login-password').select();
        });
    });
}

function initSignup() {
    const form = loginModal.querySelector('#signup-form');
    const photoInput = form.querySelector('input[type="file"]');
    const photoMessage = form.querySelector('#signup-photo-message');
    // A photo that won't work is refused as soon as it's chosen; signing up without one is fine
    guardFileInput(photoInput, photoMessage, 'You can still sign up without one.');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitWithFeedback(form, async () => {
            const response = await fetch('/auth/signup.php', { method: 'POST', body: new FormData(form) });
            if (response.ok) {
                location.href = '/';
                return;
            }
            // signup.php answers with a plain sentence (taken name, short password, photo...)
            const reason = (await response.text()).trim() || 'Sign-up failed. Check the form and try again.';
            if (response.status === 413) {
                photoInput.value = '';
                showPhotoMessage(photoMessage, { error: reason });
            } else {
                showFormError(form, reason);
            }
        });
    });
}
