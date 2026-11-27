<?php 
require_once __DIR__ . '/../includes/json_response.php';   // JSON content type (see the file)
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/follow_check.php';
require_once __DIR__ . '/../includes/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET["user_id"])) {
        if ($_GET["type"] === "followers") {
            echo json_encode(getAllfollowers($_GET["user_id"]));
            exit;
        } elseif ($_GET["type"] === "following") {
            echo json_encode(getAllFollowing($_GET["user_id"]));
            exit;
        }
    }

    echo json_encode(['is_following' => checkIfFollowing($_SESSION['user_id'], $_GET['followed_id'])]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$follower_id = $_SESSION['user_id'] ?? null;
$input = json_decode(file_get_contents('php://input'), true);
$followed_id = $input['followed_id'] ?? null;

if (!$follower_id) {
    http_response_code(401);   // the page asks the visitor to log in
    echo json_encode(['success' => false, 'error' => 'Log in to follow people']);
    exit;
}
if (!$followed_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing who to follow']);
    exit;
}
if ((string)$followed_id === (string)$follower_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'You can’t follow yourself']);
    exit;
}

try {
    $db = db();
    $following = !checkIfFollowing($follower_id, $followed_id);
    $sql = $following
        ? "INSERT INTO followers (follower_id, followed_id) VALUES (:follower_id, :followed_id) ON CONFLICT DO NOTHING"
        : "DELETE FROM followers WHERE follower_id = :follower_id AND followed_id = :followed_id";
    $db->prepare($sql)->execute([':follower_id' => $follower_id, ':followed_id' => $followed_id]);

    // The real total, so the page can correct its instant +1/-1 if others followed meanwhile
    $count = $db->prepare("SELECT COUNT(*) FROM followers WHERE followed_id = :id");
    $count->execute([':id' => $followed_id]);

    echo json_encode([
        'success'   => true,
        'following' => $following,
        'unfollowed'=> !$following,
        'followers' => (int)$count->fetchColumn(),
    ]);
} catch (Throwable $e) {
    error_log('follow_user: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not update follow. Try again.']);
}
