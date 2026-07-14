<?php 
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

if (!$follower_id || !$followed_id) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing follower_id or followed_id, follower id: '
    . $follower_id . ' followed id ' . $followed_id . 'input: ' . file_get_contents('php://input')]);
    exit;
}

$followCheck = checkIfFollowing($follower_id, $followed_id);
if ($followCheck) {
    $db = db();
    $stmt = $db->prepare("DELETE FROM followers WHERE follower_id = :follower_id AND followed_id = :followed_id");
    $stmt->execute([
        ':follower_id' => $follower_id,
        ':followed_id' => $followed_id
    ]);
    echo json_encode(['success' => true, 'unfollowed' => true]);
    exit;
} else {
    try {
        $db = db();
        $stmt = $db->prepare("INSERT INTO followers (follower_id, followed_id) VALUES (:follower_id, :followed_id)");
        $stmt->execute([
            ':follower_id' => $follower_id,
            ':followed_id' => $followed_id
        ]);
        echo json_encode(['success' => true]);
    } catch (throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to follow user']);
    }
}


?>