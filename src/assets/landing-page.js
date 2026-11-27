import { guardFileInput, showPhotoMessage } from './photo-check.js';

let loginModal = null;
let loginModalExpanded = false;
let personalRecipeButton = null;

export function init(targetElement) {
    personalRecipeButton = targetElement.querySelector("#personal-recipes");
    if (personalRecipeButton) {
        personalRecipeButton.classList.remove('active');
        const publicRecipeButton = targetElement.querySelector("#public-recipes");
        publicRecipeButton.classList.add('active');
    }

    loginModal = targetElement;

    initEventListeners();
    const signupForm = targetElement.querySelector('#signup-form');
    const photoInput = signupForm.querySelector('input[type="file"]');
    const photoMessage = signupForm.querySelector('#signup-photo-message');
    // A photo that won't work is refused as soon as it's chosen; signing up without one is fine
    guardFileInput(photoInput, photoMessage, 'You can still sign up without one.');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const response = await fetch('/auth/signup.php', {
            method: 'POST',
            body: new FormData(signupForm)
        });

        if (response.ok) {
            window.location.href = '/';
            return;
        }
        // signup.php answers with a plain sentence (bad username, short password, photo problem...)
        const reason = (await response.text()).trim() || 'Sign-up failed. Check the form and try again.';
        if (response.status === 413 || /photo/i.test(reason)) {
            photoInput.value = '';
            showPhotoMessage(photoMessage, { error: reason });
        } else {
            showPhotoMessage(photoMessage, null);
            alert(reason);
        }
    });
};

function initEventListeners() {
    document.getElementById('log-in').addEventListener('click', toggleLogin);
    if (personalRecipeButton) {
        personalRecipeButton.addEventListener('click', toggleLogin);
    }
}

function toggleLogin() {
    loginModal.classList.toggle('hidden');
}