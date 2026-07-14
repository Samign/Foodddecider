let loginModal = null;
let loginModalExpanded = false;
let personalRecipeButton = null;

document.addEventListener('DOMContentLoaded', async () => {
    const personalRecipeButton = document.getElementById("personal-recipes");
    if (personalRecipeButton) {
        personalRecipeButton.classList.remove('active');
        const publicRecipeButton = document.getElementById("public-recipes");
        publicRecipeButton.classList.add('active');
    }
    initEventListeners();
    const signupForm = document.getElementById('signup-form');
    
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
});

function initEventListeners(personalRecipeButton) {
    loginModal = document.getElementById("login-modal");
    
    document.getElementById("log-in").addEventListener('click', toggleLogin);
    if (personalRecipeButton) {
        personalRecipeButton.addEventListener('click', toggleLogin);
    }
}

function toggleLogin() {
    loginModal.style.display = loginModalExpanded ? 'none' : 'block';
    loginModalExpanded = !loginModalExpanded;
}