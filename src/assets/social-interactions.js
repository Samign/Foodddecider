import { toast } from './toast.js';
import { escapeHtml } from './recipe-cards.js';
import { confirmDialog } from './dialog.js';
import { api, plural } from './ui.js';

let inviteModal = null;
let badgeCount;
let memberIndex = 0;

export function init(modal) {
    let socialtab = document.querySelector('.social-tab')
    if (socialtab) {
        inviteModal = document.querySelector('#group-invitations');
        badgeCount = document.querySelector('.badge');
        socialtab.addEventListener('click', () => {
            const socialContent = document.querySelector('#social-modal');
            if (socialContent) {
                socialContent.classList.toggle('hidden');
                loadInvitations();
                loadGroups();
            }
        });
    }
    
    let createGroupButton = modal.querySelector('.create-group');
    if (createGroupButton) {
        createGroupButton.addEventListener('click', () => {
            createGroup();
        });
        let createGroupForm = document.querySelector('#create-group-form');
        if (createGroupForm) {
            document.querySelector('#add-member-btn')?.addEventListener('click', () => addMemberRow());
            // The form is only cleared after the group was created, so a failure keeps what was typed
            createGroupForm.addEventListener('submit', submitGroupForm);
        }
    }
    updateBadgeCount();
}

function addMemberRow(username = '') {
    const container = document.querySelector('#create-group-form .users-container');
    const i = memberIndex++;

    const row = document.createElement('div');
    row.classList.add('user-item');
    row.innerHTML = `
        <label for="group-user-${i}">User</label>
        <input type="text" name="members[${i}][username]" id="group-user-${i}" autocomplete="off">
        <label for="can-edit-${i}">Can Edit</label>
        <input type="checkbox" name="members[${i}][can_edit]" id="can-edit-${i}" value="1">
        <button type="button" class="remove-member">&times;</button>
    `;
    
    row.querySelector('input[type="text"]').value = username;
    row.querySelector('.remove-member').addEventListener('click', () => {
        row.remove();
        refreshSuggestionStates();
    });

    container.appendChild(row);
    return row;
}

function getSelectedUsernames() {
    return [...document.querySelectorAll('#create-group-form input[name$="[username]"]')]
        .map(input => input.value.trim().toLowerCase())
        .filter(Boolean);
}

function addSuggestedMember(username) {
    if (getSelectedUsernames().includes(username.toLowerCase())) return;

    // reuse an empty row if there is one, otherwise make a new one
    const emptyInput = [...document.querySelectorAll('#create-group-form input[name$="[username]"]')]
        .find(input => !input.value.trim());

    if (emptyInput) {
        emptyInput.value = username;
    } else {
        addMemberRow(username);
    }
    refreshSuggestionStates();
}

function refreshSuggestionStates() {
    const selected = getSelectedUsernames();
    document.querySelectorAll('#suggested-members .suggestion').forEach(btn => {
        btn.disabled = selected.includes(btn.dataset.username.toLowerCase());
    });
}

async function loadSuggestions() {
    const box = document.querySelector('#suggested-members');
    box.innerHTML = '<p>Loading suggestions...</p>';

    try {
        const res = await fetch('/api/mutual_follows.php');
        const data = await res.json();

        if (!data.success || data.users.length === 0) {
            box.innerHTML = '<p>No suggestions yet. Follow people who follow you back</p>';
            return;
        }

        box.innerHTML = '';
        data.users.forEach(user => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.classList.add('suggestion');
            btn.dataset.username = user.username;
            btn.textContent = `+ ${user.username}`;
            btn.addEventListener('click', () => addSuggestedMember(user.username));
            box.appendChild(btn);
        });
        refreshSuggestionStates();
    } catch (error) {
        box.innerHTML = '<p>Could not load suggestions.</p>';
    }
}

function resetMemberForm() {
    document.querySelector('#create-group-form .users-container').innerHTML = '';
    memberIndex = 0;
    addMemberRow();
}

function createGroup() {
    const modal = document.querySelector('#create-group-modal');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) loadSuggestions();
}

async function submitGroupForm(e) {
    e.preventDefault();
    const form = e.target;
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;

    try {
        const data = await api('/api/groups/groups.php', { method: 'POST', form: new FormData(form) });
        toast.success(`Created ${form.querySelector('#group_name')?.value.trim() || 'the group'}`);
        if (data.skipped?.length > 0) {
            toast.info(`Couldn’t invite: ${data.skipped.join(', ')}. Check the usernames.`, { duration: 8000 });
        }
        document.querySelector('#create-group-modal').classList.add('hidden');
        form.reset();
        resetMemberForm();
        loadGroups();
    } catch (error) {
        toast.error(error.message || 'Could not create the group');
    } finally {
        button.disabled = false;
    }
}

async function updateBadgeCount() {
    try {
        const response = await fetch('/api/groups/invitations.php');
        const data = await response.json();
        const badge = document.querySelector('.badge');
        if (data.count > 0) {
            badge.textContent = data.count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error fetching invitation count:', error);
    }
}

async function loadInvitations() {
    const section = document.getElementById('invitations-section');
    inviteModal.classList.remove('hidden');
    inviteModal.innerHTML = '<p class="rv-muted">Loading invitations…</p>';

    try {
        const res = await fetch('/api/groups/invitations.php');
        const invitations = await res.json();

        if (!invitations.success || invitations.count === 0) {
            inviteModal.innerHTML = '';
            if (section) section.hidden = true;   // nothing to show: no empty "Invitations" heading
            updateBadgeUI(0);
            return;
        }

        if (section) section.hidden = false;
        updateBadgeUI(invitations.count);
        renderInvitations(invitations.invitations);
    } catch (error) {
        if (section) section.hidden = false;
        inviteModal.innerHTML = '<p class="rv-muted">Could not load invitations. Try again later.</p>';
        console.error(error);
    }
}

async function loadGroups() {
    try {
        const res = await fetch('/api/groups/groups.php');
        const groups = await res.json();

        if (!groups.success || groups.count === 0) {
            document.querySelector('#group-list').innerHTML = '<p class="rv-muted">You’re not in any groups yet.</p>';
            return;
        }

        renderGroups(groups.groups);
    } catch (error) {
        document.querySelector('#group-list').innerHTML = '<p class="rv-muted">Could not load groups. Try again later.</p>';
        console.error(error);
    }
}

function renderGroups(groups) {
    const groupList = document.querySelector('#group-list');
    groupList.innerHTML = '';
    groups.forEach(group => {
        const groupElement = document.createElement('div');
        groupElement.classList.add('group');
        groupElement.innerHTML = `
            <div class="group-text">
                <p class="group-name">${escapeHtml(group.group_name)}</p>
                ${group.member_count != null ? `<small>${plural(Number(group.member_count), 'member')}</small>` : ''}
            </div>
            <button type="button" class="btn leave-group" data-id="${escapeHtml(group.id)}" data-name="${escapeHtml(group.group_name)}">Leave</button>
        `;
        groupList.appendChild(groupElement);
    });

    groupList.querySelectorAll('.leave-group').forEach(button => {
        button.addEventListener('click', () => handleLeaveGroup(button.dataset.id, button));
    });
}

async function handleLeaveGroup(groupId, button) {
    const name = button?.dataset.name || 'this group';
    if (!await confirmDialog({ title: 'Leave group', message: `Leave ${name}? Lists shared with it will no longer show up for you.`, confirmText: 'Leave', danger: true })) return;

    const row = button?.closest('.group');
    const list = row?.parentElement;
    const next = row?.nextSibling;
    row?.remove();                                   // gone right away…
    if (list && !list.querySelector('.group')) list.innerHTML = '<p class="rv-muted">You’re not in any groups yet.</p>';

    try {
        await api('/api/groups/groups.php', { method: 'POST', form: new URLSearchParams({ action: 'leave', group_id: groupId }) });
        toast.success(`You left ${name}`);
    } catch (error) {
        if (list && row) {                           // …and back if it didn't work
            list.querySelector('.rv-muted')?.remove();
            list.insertBefore(row, next?.isConnected ? next : null);
        }
        toast.error(error.message || 'Could not leave the group');
    }
}

function renderInvitations(invitations) {
    inviteModal.innerHTML = '';
    invitations.forEach(invitation => {
        const invitationElement = document.createElement('div');
        invitationElement.classList.add('invitation');
        invitationElement.innerHTML = `
            <div class="group-text">
                <p class="group-name">${escapeHtml(invitation.group_name)}</p>
                <small>Invited by ${escapeHtml(invitation.inviter_name)}</small>
            </div>
            <button type="button" class="btn p accept-invite" data-id="${escapeHtml(invitation.invitation_id)}">Join</button>
            <button type="button" class="btn decline-invite" data-id="${escapeHtml(invitation.invitation_id)}">Decline</button>
        `;
        inviteModal.appendChild(invitationElement);
    });

    inviteModal.querySelectorAll('.accept-invite').forEach(button => {
        button.addEventListener('click', () => handleInviteAction(button.dataset.id, 'accept'));
    });

    inviteModal.querySelectorAll('.decline-invite').forEach(button => {
        button.addEventListener('click', () => handleInviteAction(button.dataset.id, 'decline'));
    });
}

async function handleInviteAction(invitationId, action) {
    // The invitation disappears and the badge counts down at once; it comes back if the server says no
    const row = inviteModal.querySelector(`[data-id="${CSS.escape(String(invitationId))}"]`)?.closest('.invitation');
    const name = row?.querySelector('.group-name')?.textContent ?? 'the group';
    const before = Number(badgeCount?.textContent) || inviteModal.querySelectorAll('.invitation').length;
    row?.classList.add('is-leaving');
    row?.querySelectorAll('button').forEach(b => { b.disabled = true; });
    updateBadgeUI(Math.max(0, before - 1));

    try {
        const data = await api('/api/groups/invitations.php', { method: 'POST', json: { invitation_id: invitationId, action } });
        toast.success(action === 'accept' ? `You joined ${name}` : `Declined the invitation to ${name}`);
        updateBadgeUI(data.remaining_count ?? Math.max(0, before - 1));
        loadInvitations();
        if (action === 'accept') loadGroups();
    } catch (error) {
        row?.classList.remove('is-leaving');
        row?.querySelectorAll('button').forEach(b => { b.disabled = false; });
        updateBadgeUI(before);
        toast.error(error.message || 'Could not answer the invitation');
    }
}

function updateBadgeUI(count) {
    if (!badgeCount) return;
    if (count > 0) {
        badgeCount.textContent = count > 99 ? '99+' : count;
        badgeCount.classList.remove('hidden');
    } else {
        badgeCount.classList.add('hidden');
    }
}