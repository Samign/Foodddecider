import { renderRecipeList, escapeHtml, avatarUrl } from './recipe-cards.js';
let activeTab = 'all-tab';

async function search(q) {

    let recipeList = document.getElementById('recipe-search-list');
    try {
        const res = await fetch(`/api/search.php?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderRecipeList(recipeList, data.recipes);
        renderProfiles(data.users);
    } catch (err) {
        recipeList.textContent = 'Something went wrong. Please try again.';
    }
}

function renderProfiles(profiles) {
    const profileContainer = document.getElementById('profile-results');
    profileContainer.innerHTML = '';
    
    if (profiles.length === 0) {
        profileContainer.innerHTML = '<p>No profiles found.</p>';
        return;
    }
    
    profiles.forEach(profile => {
        const profileCard = document.createElement('a');
        profileCard.href = `/user/${encodeURIComponent(profile.username)}`;
        profileCard.className = 'profile-card';
        // Username and bio are typed by users: escape everything that goes into the markup
        profileCard.innerHTML = `
            <img src="${avatarUrl(profile.username, profile.image_base)}"
                 data-fallback="${avatarUrl(profile.username, profile.image_base, '')}"
                 alt="" class="profile-avatar" loading="lazy">
            <h3>${escapeHtml(profile.username)}</h3>
            <p>${escapeHtml(profile.bio || '')}</p>
        `;
        profileContainer.appendChild(profileCard);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    
    if (query) {
        search(query);
    }
    
    const allTab = document.getElementById('all-tab');
    const recipesTab = document.getElementById('recipes-tab');
    const profilesTab = document.getElementById('profiles-tab');

    allTab.addEventListener('click', setTab);
    recipesTab.addEventListener('click', setTab);
    profilesTab.addEventListener('click', setTab);

});

function setTab(e) {
    const selectedTab = e.target.id;
    allTab.classList.remove('active');
    recipesTab.classList.remove('active');
    profilesTab.classList.remove('active');

    e.target.classList.add('active');

    activeTab = selectedTab;

}