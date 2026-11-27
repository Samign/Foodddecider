<?php 
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/user_fetcher.php';
require_once __DIR__ . '/includes/follow_check.php';
require_once __DIR__ . '/includes/modules.php';

$user = null;
$path = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '', '/');

if (preg_match('~^user/([^/]+)$~', $path, $matches)) {
    $user = grabUserInfo(null, rawurldecode($matches[1]));
}

$loggedIn = isset($_SESSION['user_id']);
$isSelf = $user && $loggedIn && (string)$user['id'] === (string)$_SESSION['user_id'];
$isFollower = $user && $loggedIn && !$isSelf && checkIfFollowing($_SESSION['user_id'], $user['id']);

if (!$user) {
    http_response_code(404);
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php getHeadAssets(); ?>

    <title><?= $user ? htmlspecialchars($user['username']) . ' on FoodDecider' : 'Profile not found - FoodDecider' ?></title>

</head>
<body>

    <div class="modal-overlay hidden" id="modal-overlay"></div>
    <?php echo getNavBar(); ?>
    <?php echo getExpandedModal(); ?>
    <?php echo getFilterMenu(); ?>

    <div class="modal hidden" id="follower-modal" role="dialog" aria-modal="true" aria-labelledby="follower-modal-title">
        <button type="button" class="close-button" aria-label="Close">&times;</button>
        <div class="dlg">
            <h2 id="follower-modal-title"></h2>
            <div id="follower-list" class="follower-list"></div>
        </div>
    </div>

    <?php if (!$user): ?>
    <main class="user-page">
        <div class="empty">
            <h3>No one by that name</h3>
            <p>The profile may have been renamed or removed.</p>
            <a class="btn" href="/">Back to recipes</a>
        </div>
    </main>
    <?php else: ?>
    <main class="user-page">
    <div class="user-profile">
        <img class="user-profile-img"
             src="<?= $user['image_base']
                ? '/uploads/profile_pictures/' . htmlspecialchars($user['image_base']) . '.webp'
                : '/uploads/profile_pictures/' . htmlspecialchars($user['username']) . '_avatar.svg' ?>"
             alt="">
        <div class="user-profile-text">
            <h1 class="user-profile-name"><?= htmlspecialchars($user['username']) ?></h1>
            <?php if (!empty($user['bio'])): ?>
                <p class="user-profile-bio"><?= htmlspecialchars($user['bio']) ?></p>
            <?php endif; ?>
            <div class="follower-count-container">
                <button type="button" class="stat" id="follower-count" data-id="<?= htmlspecialchars($user['id']) ?>">
                    <strong data-count="<?= (int)$user['followers_count'] ?>"><?= (int)$user['followers_count'] ?></strong>
                    <?= (int)$user['followers_count'] === 1 ? 'follower' : 'followers' ?>
                </button>
                <button type="button" class="stat" id="following-count" data-id="<?= htmlspecialchars($user['id']) ?>">
                    <strong><?= (int)$user['following_count'] ?></strong> following
                </button>
            </div>
            <?php if (!$isSelf): ?>
                <button class="btn <?= $isFollower ? '' : 'p' ?> follow-button" id="follow-button"
                        data-id="<?= htmlspecialchars($user['id']) ?>" aria-pressed="<?= $isFollower ? 'true' : 'false' ?>">
                    <?= $isFollower ? 'Following' : 'Follow' ?>
                </button>
            <?php endif; ?>
        </div>
    </div>
        <h2 class="user-recipes-title"><?= $isSelf ? 'Your recipes' : htmlspecialchars($user['username']) . '’s recipes' ?></h2>
        <div class="recipe-card-container" id="recipe-list"></div>
    </main>
    <?php endif; ?>
    <?php if(!$loggedIn) {
        echo getLoginModal();
    }; ?>

    <script type="module" src="/assets/main.js"></script>
    <script type="module" src="/assets/users.js"></script>
</body>
</html>