<?php 

function checkIfFollowing($follower_id, $followed_id) {
    $db = db();
    $stmt = $db->prepare("SELECT 1 FROM followers WHERE follower_id = :follower_id AND followed_id = :followed_id");
    $stmt->execute([
        ':follower_id' => $follower_id,
        ':followed_id' => $followed_id
    ]);
    return (bool)$stmt->fetch();
}

function getAllfollowers($user_id) {
    $db = db();
    $stmt = $db->prepare("SELECT u.id, u.username, u.image_base FROM followers f JOIN users u ON f.follower_id = u.id WHERE f.followed_id = :user_id");
    $stmt->execute([':user_id' => $user_id]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getAllFollowing($user_id) {
    $db = db();
    $stmt = $db->prepare("SELECT u.id, u.username, u.image_base FROM followers f JOIN users u ON f.followed_id = u.id WHERE f.follower_id = :user_id");
    $stmt->execute([':user_id' => $user_id]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
?>