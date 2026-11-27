<?php
require_once __DIR__ . '/../../includes/json_response.php';   // JSON content type (see the file)
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/session.php';


$current_user_id = $_SESSION['user_id'] ?? null;

// Auth Check
if (!$current_user_id) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {

        $db = db();
        $stmt = $db->prepare("
            SELECT 
                gi.id AS invitation_id,
                gi.can_edit,
                gi.created_at,
                g.group_name AS group_name,
                u.username AS inviter_name
            FROM group_invitations gi
            JOIN groups g ON gi.group_id = g.id
            JOIN users u ON gi.invited_by_user_id = u.id
            WHERE gi.invited_user_id = :user_id AND gi.status = 'pending'
            ORDER BY gi.created_at DESC
        ");
        $stmt->execute([':user_id' => $current_user_id]);
        $invitations = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'count' => count($invitations),
            'invitations' => $invitations
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch invitations. Error: ' . $e->getMessage()]);
    }
    exit();
}

if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);

    $invitation_id = $data['invitation_id'] ?? null;
    $action = $data['action'] ?? null;

    if (!$invitation_id || !in_array($action, ['accept', 'decline'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid request']);
        exit;
    }
    try {
        $db = db();
        $stmt = $db->prepare("
            SELECT group_id, invited_user_id, can_edit, status
            FROM group_invitations
            WHERE id = :id AND invited_user_id = :user_id AND status = 'pending'
            FOR UPDATE
            ");
        $stmt->execute([':id' => $invitation_id, ':user_id' => $_SESSION['user_id']]);
        $invitation = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$invitation) {
            http_response_code(404);
            echo json_encode(['error' => 'Invitation not found or already responded to']);
            exit;
        }

        if ($action === 'accept') {
            $stmt = $db->prepare("
                UPDATE group_invitations
                SET status = 'accepted'
                WHERE id = :id
            ");
            $stmt->execute([':id' => $invitation_id]);

            $canEdit = $invitation['can_edit'] == '1' ? 1 : 0;

            $stmt = $db->prepare("
                INSERT INTO group_members (group_id, member_id, edit_rights)
                VALUES (:group_id, :user_id, :edit_rights)
            ");
            $stmt->execute([
                ':group_id' => $invitation['group_id'],
                ':user_id' => $_SESSION['user_id'],
                ':edit_rights' => $canEdit
            ]);

            echo json_encode(['status' => 'success', 'message' => 'Invitation accepted']);
        } elseif ($action === 'decline') {
            $stmt = $db->prepare("
                UPDATE group_invitations
                SET status = 'declined'
                WHERE id = :id
            ");
            $stmt->execute([':id' => $invitation_id]);

            echo json_encode(['status' => 'success', 'message' => 'Invitation declined']);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}
?>