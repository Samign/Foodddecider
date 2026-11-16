// import { setCurrentExpanded } from "./popstate.js";
import { toast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {

    const followButton = document.getElementById('follow-button');
    
    if (followButton) {

        followButton.addEventListener('click', async () => {

        let response = fetch('/api/follow_user.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ followed_id: followButton.dataset.id })
        }).then(res => res.json())
          .then(data => {
              if (data.success) {
                  followButton.textContent = followButton.textContent === 'Follow' ? 'Unfollow' : 'Follow';
              } else {
                  toast.error(data.error || 'Failed to update follow status.');
              }
          })
          .catch((error) => {
              toast.error('An error occurred while trying to update follow status.' + 'error: '+ error);
          });
        });
    }

    const followerCount = document.getElementById('follower-count');
    followerCount.addEventListener('click', showFollowerList);
    const followingCount = document.getElementById('following-count');
    followingCount.addEventListener('click', showFollowerList);

});

function showFollowerList(event) {
    const modal = document.getElementById('follower-modal');
    const title = document.getElementById('follower-modal-title');
    const list = document.getElementById('follower-list');
    const isFollower = event.target.id === 'follower-count';
    const userId = event.target.dataset.id;

    title.textContent = isFollower ? 'Followers' : 'Following';
    list.innerHTML = '';

    fetch(`/api/follow_user.php?user_id=${userId}&type=${isFollower ? 'followers' : 'following'}`)
        .then(res => res.json())
        .then(users => {
            users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'follower-item';
                userElement.addEventListener('click', () => {
                    window.location.href = `/user/${user.username}`;
                });
                list.appendChild(userElement);
                const userimg = document.createElement('img');
                userimg.src = user.image_base ? `/uploads/profile_pictures/${user.image_base}_200.webp` : `/uploads/profile_pictures/${user.username}_avatar.svg`;
                userimg.alt = `${user.username}'s profile picture`;
                userimg.className = 'follower-profile-pic';
                userElement.appendChild(userimg);
                const usernameElement = document.createElement('span');
                usernameElement.textContent = user.username;
                userElement.appendChild(usernameElement);
            });
        })
        .catch(error => {
            toast.error('Failed to load followers');
        });

    // modal.classList.remove('hidden');
}

// export async function loadUser(username) {
//     setCurrentExpanded('user');

//     const response = await fetch(`/api/fetch_user.php?username=${encodeURIComponent(username)}`, {
//         method: 'GET'
//     });

//     const user = await response.json();
    
//     if (response.ok) {
//         userID = user.id;

//         const userProfileModal = document.getElementById('user-profile');
//         const imgElement = userProfileModal.querySelector('.profile-picture');
//         const nameElement = userProfileModal.querySelector('.user-profile-name');
//         const bioElement = userProfileModal.querySelector('.user-profile-bio');

//         nameElement.textContent = user.username;
//         bioElement.textContent = user.bio || '';

//         if (user.image_base) {
//             imgElement.src = `/uploads/profile_pictures/${user.image_base}_200.webp`;
//             imgElement.alt = `${user.username}'s profile picture`;
//         } else {
//             imgElement.src = `/uploads/profile_pictures/${user.username}_avatar.svg`;
//             imgElement.alt = `${user.username}'s default avatar`;
//         }

//         userProfileModal.classList.remove('hidden');

//         const followButton = document.getElementById('follow-button');

//         if (!user.isSelf) {
//             followButton.classList.remove('hidden');
//                         let response = await fetch(`/api/follow_user.php?followed_id=${encodeURIComponent(userID)}`, {
//                 method: 'GET'
//             });
//             const data = await response.json();

//             if (data.is_following) {
//                 followButton.textContent = 'Unfollow';
//             } else {
//                 followButton.textContent = 'Follow';
//             }
//         } else {
//             // TODO show edit buttons for bio and image
//             followButton.classList.add('hidden');
//         }

//     } else {
//         alert(user.error || 'Failed to load user information.');
//     }

//     window.history.pushState(
//         {type: 'user', slug: username},
//         '',
//         `/user/${username}`
//     );
// }

