<?php
require_once __DIR__ . '/../../includes/db.php';

$request_method = $_SERVER['REQUEST_METHOD'];

if ($request_method === 'GET' && isset($_GET['group_id'])) {
    $group_id = $_GET['group_id'];

    try {
        $db = db();
        $stmt = $db->prepare("SELECT u.id, u.username, gm.edit_rights FROM users u INNER JOIN group_members gm ON u.id = gm.member_id WHERE gm.group_id = :group_id");
        $stmt->execute([':group_id' => $group_id]);
        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'members' => $members]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch group members. Error: ']);
    }
    exit();
} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid request.']);
}

?>