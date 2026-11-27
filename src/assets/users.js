// assets/users.js: the profile page (/user/name)
//   Follow / Following  changes and counts at once; goes back if the server says no
//   followers / following  opens the list of people

import { toast } from './toast.js';
import { avatarUrl } from './recipe-cards.js';
import { api, requireLogin, bumpCount } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const followButton = document.getElementById('follow-button');
    followButton?.addEventListener('click', () => toggleFollow(followButton));

    document.getElementById('follower-count')?.addEventListener('click', (e) => showPeople(e.currentTarget, 'followers'));
    document.getElementById('following-count')?.addEventListener('click', (e) => showPeople(e.currentTarget, 'following'));
});

function showFollowState(button, following) {
    button.setAttribute('aria-pressed', String(following));
    button.textContent = following ? 'Following' : 'Follow';
    button.classList.toggle('p', !following);   // "Follow" is the main action; "Following" is quiet
}

function setFollowerCount(n) {
    const stat = document.getElementById('follower-count');
    if (!stat) return;
    stat.innerHTML = `<strong>${n}</strong> ${n === 1 ? 'follower' : 'followers'}`;
}

async function toggleFollow(button) {
    if (!await requireLogin('follow people')) return;
    if (button.disabled) return;

    const wasFollowing = button.getAttribute('aria-pressed') === 'true';
    const countEl = document.querySelector('#follower-count strong');
    const before = Number(countEl?.textContent) || 0;

    // Show the result right away…
    showFollowState(button, !wasFollowing);
    setFollowerCount(before + (wasFollowing ? -1 : 1));
    bumpCount(document.querySelector('#follower-count strong'), 0);
    button.disabled = true;

    try {
        const result = await api('/api/follow_user.php', { method: 'POST', json: { followed_id: button.dataset.id } });
        showFollowState(button, result.following);
        setFollowerCount(result.followers);         // …and correct it with the real total
        if (result.following) toast.success(`You’re following ${document.querySelector('.user-profile-name')?.textContent.trim()}`);
    } catch (error) {
        showFollowState(button, wasFollowing);      // …or put it back
        setFollowerCount(before);
        toast.error(error.message || 'Could not update follow');
    } finally {
        button.disabled = false;
    }
}

async function showPeople(stat, type) {
    const modal = document.getElementById('follower-modal');
    const title = document.getElementById('follower-modal-title');
    const list = document.getElementById('follower-list');

    title.textContent = type === 'followers' ? 'Followers' : 'Following';
    list.replaceChildren(Object.assign(document.createElement('p'), { className: 'rv-muted', textContent: 'Loading…' }));
    modal.classList.remove('hidden');

    let people;
    try {
        people = await api('/api/follow_user.php', { query: { user_id: stat.dataset.id, type } });
    } catch (error) {
        list.replaceChildren(Object.assign(document.createElement('p'), { className: 'rv-muted', textContent: 'Could not load the list. Try again.' }));
        return;
    }

    if (!people.length) {
        list.replaceChildren(Object.assign(document.createElement('p'), {
            className: 'rv-muted',
            textContent: type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.',
        }));
        return;
    }

    list.replaceChildren(...people.map(user => {
        const link = document.createElement('a');
        link.className = 'follower-item';
        link.href = `/user/${encodeURIComponent(user.username)}`;

        const img = document.createElement('img');
        img.className = 'follower-profile-pic';
        img.src = avatarUrl(user.username, user.image_base);
        img.dataset.fallback = avatarUrl(user.username, user.image_base, '');   // pictures from before the _200 size existed
        img.loading = 'lazy';
        img.alt = '';

        const name = document.createElement('span');
        name.textContent = user.username;

        link.append(img, name);
        return link;
    }));
}
