<?php 

require_once __DIR__ . '/db.php';


function grabUserInfo($requested_user_UUID = null, $requested_user_username = null) {
    try {

        $db = db();
        $stmt = $db->prepare("
            SELECT u.id, u.username, u.email, u.bio, u.image_base, 
                   -- DISTINCT: the two joins multiply rows (2 followers x 3 following counted as 6 each)
                   COUNT(DISTINCT fs.follower_id) AS followers_count,
                   COUNT(DISTINCT fd.followed_id) AS following_count
            FROM users u
            LEFT JOIN followers fs ON u.id = fs.followed_id
            LEFT JOIN followers fd ON u.id = fd.follower_id
            WHERE u.id = :user_id OR u.username = :username
            GROUP BY u.id, u.username, u.email, u.bio, u.image_base
            LIMIT 1");
        $stmt->bindValue(':user_id', $requested_user_UUID, PDO::PARAM_STR);
        $stmt->bindValue(':username', $requested_user_username, PDO::PARAM_STR);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);

    } catch (Throwable $e) {
        error_log('grabUserInfo: ' . $e->getMessage());
        return null;
    }
}