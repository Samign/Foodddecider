import { renderRecipeList } from './recipe-cards.js';
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
        console.error('Search failed:', err);
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
        profileCard.href = `/user/${profile.username}`;
        profileCard.className = 'profile-card';
        profileCard.innerHTML = `
            <img src="${profile.image_base ? '/uploads/profile_pictures/' + profile.image_base + '.webp' : '/uploads/profile_pictures/' + profile.username + '_avatar.svg'}" alt="${profile.username}'s avatar" class="profile-avatar">
            <h3>${profile.username}</h3>
            <p>${profile.bio || ''}</p>
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