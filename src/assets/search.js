let activeTab = 'all-tab';

async function search(query) {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    renderRecipes(data.recipes);
    renderProfiles(data.users);
}

function renderProfiles(profiles) {
    const profileContainer = document.getElementById('profile-results');
    profileContainer.innerHTML = '';
    
    if (profiles.length === 0) {
        profileContainer.innerHTML = '<p>No profiles found.</p>';
        return;
    }
    
    profiles.forEach(profile => {
        const profileCard = document.createElement('div');
        profileCard.className = 'profile-card';
        profileCard.innerHTML = `
            <h3>${profile.username}</h3>
            <p>${profile.bio || ''}</p>
        `;
        profileContainer.appendChild(profileCard);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('search');
    
    if (query) {
        search(query);
    }

    window.history.replaceState(
        { type: 'search', slug: query },
        '',
        `/results?search=${encodeURIComponent(query)}`
    );

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