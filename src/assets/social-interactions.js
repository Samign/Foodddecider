import { toast } from './toast.js';

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
            createGroupForm.addEventListener('submit', (e) => {
                submitGroupForm(e);
                resetMemberForm();
            });
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

function submitGroupForm(e) {
    console.log('Submitting group form...');
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    fetch('/api/groups/groups.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            toast.success('Group created successfully!');
            if (data.skipped?.length > 0) {
                toast.info(`Could not invite: ${data.skipped.join(', ')}`);
            }
            document.querySelector('#create-group-modal').classList.add('hidden');
            form.reset();
            resetMemberForm();
            loadGroups();
        } else {
            toast.error('Error creating group: ' + data.message);
        }
    })
    .catch(e => {
        toast.error('An unexpected error occurred');
    });
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
    inviteModal.classList.remove('hidden');
    inviteModal.innerHTML = '<p>Loading invitations...</p>';

    try {
        const res = await fetch('/api/groups/invitations.php');
        const invitations = await res.json();

        if (!invitations.success || invitations.count === 0) {
            inviteModal.innerHTML = '<p>No invitations at this time.</p>';
            updateBadgeUI(0);
            return;
        }

        updateBadgeUI(invitations.count);
        renderInvitations(invitations.invitations);
    } catch (error) {
        inviteModal.innerHTML = '<p>Error loading invitations. Please try again later. ' + error + ' </p>';
    }
}

async function loadGroups() {
    try {
        const res = await fetch('/api/groups/groups.php');
        const groups = await res.json();

        if (!groups.success || groups.count === 0) {
            document.querySelector('#group-list').innerHTML = '<p>No groups found.</p>';
            return;
        }

        renderGroups(groups.groups);
    } catch (error) {
        document.querySelector('#group-list').innerHTML = '<p>Error loading groups. Please try again later. ' + error + ' </p>';
    }
}

function renderGroups(groups) {
    const groupList = document.querySelector('#group-list');
    groupList.innerHTML = '';
    groups.forEach(group => {
        const groupElement = document.createElement('div');
        groupElement.classList.add('group');
        groupElement.innerHTML = `
            <p>${group.group_name}</p>
            <button class="leave-group" data-id="${group.id}">Leave</button>
        `;
        groupList.appendChild(groupElement);
    });

    groupList.querySelectorAll('.leave-group').forEach(button => {
        button.addEventListener('click', () => handleLeaveGroup(button.dataset.id));
    });
}

async function handleLeaveGroup(groupId) {
    try {
        const res = await fetch('/api/groups/groups.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ action: 'leave', group_id: groupId })
        });
        const data = await res.json();

        if (data.success) {
            toast.success('Left group successfully!');
            loadGroups(); // Refresh the groups list
        } else {
            toast.error(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error leaving group:', error);
    }
}

function renderInvitations(invitations) {
    inviteModal.innerHTML = '';
    invitations.forEach(invitation => {
        const invitationElement = document.createElement('div');
        invitationElement.classList.add('invitation');
        invitationElement.innerHTML = `
            <p>${invitation.group_name} - Invited by ${invitation.inviter_name}</p>
            <button class="accept-invite" data-id="${invitation.invitation_id}">Accept</button>
            <button class="decline-invite" data-id="${invitation.invitation_id}">Decline</button>
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
    try {
        const res = await fetch('/api/groups/invitations.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ invitation_id: invitationId, action: action })
        });
        const data = await res.json();

        if (data.status === 'success') {
            toast.success(`Invitation ${action}ed successfully!`);
            updateBadgeUI(data.remaining_count);
            loadInvitations();
            loadGroups();
        } else {
            toast.error(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error handling invitation:', error);
    }
}

function updateBadgeUI(count) {
    if (count > 0) {
        badgeCount.textContent = count > 99 ? '99+' : count;
        badgeCount.classList.remove('hidden');
    } else {
        badgeCount.classList.add('hidden');
    }
}