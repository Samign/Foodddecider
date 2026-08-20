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
    
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(signupForm);
        const response = await fetch('/auth/signup.php', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            // window.location.href = '/';
        } else {
            alert('Signup failed');
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
    loginModal.style.display = loginModalExpanded ? 'none' : 'block';
    loginModalExpanded = !loginModalExpanded;
}