<?php 
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/user_fetcher.php';
require_once __DIR__ . '/includes/follow_check.php';
require_once __DIR__ . '/includes/modules.php';

$user = null;
$requestUri = $_SERVER['REQUEST_URI'];
$requestUri = trim($requestUri, '/');

if (preg_match('/\/?user\/([^\/]+)/', $requestUri, $matches)) {
    $username = htmlspecialchars($matches[1]);
    if ($username) {
        $user = grabUserInfo(null, $username);
    }
}

$currentUser = null;
$isSelf = false;
$isFollower = false;
$loggedIn = isset($_SESSION['user_id']);

if ($loggedIn) {
    $currentUser = grabUserInfo($_SESSION['user_id']); 
    $isSelf = $user['id'] === $_SESSION['user_id'];
    $isFollower = checkIfFollowing($_SESSION['user_id'], $user['id']);
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com/" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Epilogue:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/style.css">

    <!-- Migth implement crawler friendly properties -->

</head>
<body>

    <div class="modal-overlay hidden" id="modal-overlay"></div>
    <?php echo getNavBar(); ?>
    <?php echo getExpandedModal(); ?>
    <?php echo getFilterMenu(); ?>

    <div class="modal hidden" id="follower-modal">
        <div class="modal-content">
            <span class="close-button">&times;</span>
            <h2 id="follower-modal-title"></h2>
            <div id="follower-list"></div>
         </div>
    </div>

    <div class="user-profile">
        <?php if ($user['image_base']): ?>
                <img class="user-profile-img" src="/uploads/profile_pictures/<?php echo htmlspecialchars($user['image_base']); ?>_200.webp" alt="profile picture"></img>
            <?php else: ?>
                <img class="user-profile-img" src="/uploads/profile_pictures/<?php echo htmlspecialchars($user['username']); ?>_avatar.svg" alt="profile picture"></img>
            <?php endif; ?>
        <h2 class="user-profile-name"> <?php echo htmlspecialchars($user['username']) ?> </h2>
        <div class="follower-count-container flex">
            <p id="follower-count" data-id="<?php echo $user['id']?>"> followers:  <?php echo htmlspecialchars($user['followers_count']); ?></p>
            <p id="following-count" data-id="<?php echo $user['id']?>"> follows: <?php echo htmlspecialchars($user['following_count']); ?></p>
        </div>
        <?php echo isset($user['bio']) ? '<p class="user-profile-bio">' . htmlspecialchars($user['bio']) . '</p>' : ''; ?>
        <?php if (!$isSelf && $loggedIn): ?>
            <button class="follow-button" id="follow-button" data-id="<?php echo $user['id']?>"> <?php echo $isFollower ? 'Unfollow' : 'Follow'; ?></button>
        <?php endif; ?>
        <h3>User's recipes</h3>
        <div class="recipe-card-container" id="recipe-list"></div>
        
        <div class="modal hidden" id="expanded-modal">
            <span class="close-button">&times;</span>
            <div class="modal-content" id="expanded-content">
            </div>
        </div>

        <?php 
        echo getFilterMenu(); 
        echo getExpandedModal();    
        ?>

    </div>
    <?php if(!$loggedIn) {
        echo getLoginModal();
    }; ?>

    <script type="module" src="/assets/main.js"></script>
    <script type="module" src="/assets/users.js"></script>
</body>
</html>