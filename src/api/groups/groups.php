<?php
require_once __DIR__ . '/../../includes/json_response.php';   // JSON content type (see the file)
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/session.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $db = db();
        $stmt = $db->prepare("SELECT g.id, g.group_name FROM groups g INNER JOIN group_members gm ON g.id = gm.group_id WHERE gm.member_id = :member_id");
        $stmt->execute([':member_id' => $_SESSION['user_id']]);
        $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'groups' => $groups, 'count' => count($groups)]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch groups. Error: ']);
    }
    exit;
}

if ($method === 'POST' && ($_POST['action'] ?? '') === 'leave') {
    $groupId = filter_var($_POST['group_id'] ?? null, FILTER_VALIDATE_INT);
    $userId  = $_SESSION['user_id'];

    if (!$groupId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid group_id is required.']);
        exit;
    }

    try {
        $db = db();
        $db->beginTransaction();

        // Lock the group row so two members leaving at the same time
        // can't both think they aren't the last one.
        $stmt = $db->prepare("SELECT owner_id FROM groups WHERE id = :group_id FOR UPDATE");
        $stmt->execute([':group_id' => $groupId]);
        $group = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$group) {
            $db->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Group not found.']);
            exit;
        }

        // Make sure the user is actually a member
        $stmt = $db->prepare("SELECT 1 FROM group_members WHERE group_id = :group_id AND member_id = :user_id");
        $stmt->execute([':group_id' => $groupId, ':user_id' => $userId]);
        if (!$stmt->fetchColumn()) {
            $db->rollBack();
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'You are not a member of this group.']);
            exit;
        }

        // Remove the user from the group
        $stmt = $db->prepare("DELETE FROM group_members WHERE group_id = :group_id AND member_id = :user_id");
        $stmt->execute([':group_id' => $groupId, ':user_id' => $userId]);

        // How many members are left?
        $stmt = $db->prepare("SELECT COUNT(*) FROM group_members WHERE group_id = :group_id");
        $stmt->execute([':group_id' => $groupId]);
        $remaining = (int)$stmt->fetchColumn();

        $groupDeleted = false;

        if ($remaining === 0) {
            // Last member left: remove pending invitations and the group itself
            $stmt = $db->prepare("DELETE FROM group_invitations WHERE group_id = :group_id");
            $stmt->execute([':group_id' => $groupId]);

            $stmt = $db->prepare("DELETE FROM groups WHERE id = :group_id");
            $stmt->execute([':group_id' => $groupId]);

            $groupDeleted = true;
        } elseif ((string)$group['owner_id'] === (string)$userId) {
            // Owner left but others remain: hand ownership to another member,
            // preferring someone who already has edit rights.
            $stmt = $db->prepare("
                SELECT member_id FROM group_members
                WHERE group_id = :group_id
                ORDER BY edit_rights DESC, member_id ASC
                LIMIT 1");
            $stmt->execute([':group_id' => $groupId]);
            $newOwnerId = $stmt->fetchColumn();

            $stmt = $db->prepare("UPDATE groups SET owner_id = :owner_id WHERE id = :group_id");
            $stmt->execute([':owner_id' => $newOwnerId, ':group_id' => $groupId]);

            $stmt = $db->prepare("UPDATE group_members SET edit_rights = TRUE WHERE group_id = :group_id AND member_id = :owner_id");
            $stmt->execute([':group_id' => $groupId, ':owner_id' => $newOwnerId]);
        }

        $db->commit();
        echo json_encode([
            'success' => true,
            'message' => $groupDeleted ? 'You left the group and it was deleted.' : 'You left the group.',
            'group_deleted' => $groupDeleted
        ]);
    } catch (Exception $e) {
        if (isset($db) && $db->inTransaction()) {
            $db->rollBack();
        }
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error leaving group.']);
    }
    exit;
} else if ($method === 'POST') {
    $members = $_POST['members'] ?? [];
    $group_name = trim($_POST['group_name'] ?? '');

    if (empty($group_name)) {
        echo json_encode(['success' => false, 'message' => 'Group name is required.']);
        exit;
    }

    $skipped = [];
    
    try {
        $db = db();
        $db->beginTransaction();
    
        // Insert the new group
        $stmt = $db->prepare("INSERT INTO groups (group_name, owner_id) VALUES (:name, :owner_id) RETURNING id");
        $stmt->execute([':name' => $group_name, ':owner_id' => $_SESSION['user_id']]);
        $groupId = $stmt->fetchColumn();
    
        // Insert owner as a member with edit rights
        $stmt = $db->prepare("INSERT INTO group_members (group_id, member_id, edit_rights) VALUES (:group_id, :user_id, :edit_rights)");
        $stmt->execute([':group_id' => $groupId, ':user_id' => $_SESSION['user_id'], ':edit_rights' => true]);
    
        if (is_array($members) && $members) {
            $stmtFindUser = $db->prepare("SELECT id FROM users WHERE username = :username");
            $stmtInvite = $db->prepare("
            INSERT INTO group_invitations (group_id, invited_by_user_id, invited_user_id, can_edit, status)
            VALUES (:group_id, :invited_by_user_id, :invited_user_id, :can_edit, :status)");
            
            $seen = [];
            foreach ($members as $member) {
                if(!is_array($member)) {
                    continue;
                }

                // Check if the user exists
                $username = mb_strtolower(trim($member['username'] ?? ''));
                if (empty($username) || isset($seen[$username])) {
                    continue; // Skip empty or duplicate usernames
                }
                $seen[$username] = true;

                $canEdit = !empty($member['can_edit']) ? 1 : 0;
                
                $stmtFindUser->execute([':username' => $username]);
                $invitedId = $stmtFindUser->fetchColumn();

                if (!$invitedId || (string)$invitedId === (string)$_SESSION['user_id']) {
                    $skipped[] = $username;
                    continue;
                }

                $stmtInvite->execute([
                    ':group_id' => $groupId,
                    ':invited_by_user_id' => $_SESSION['user_id'],
                    ':invited_user_id' => $invitedId ,
                    ':can_edit' => $canEdit,
                    ':status' => 'pending'
                ]);
            }
        }
    
    
        $db->commit();
        echo json_encode([
            'success'  => true,
            'message'  => 'Group created successfully.',
            'group_id' => $groupId,
            'skipped'  => $skipped
        ]);
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        echo json_encode(['success' => false, 'message' => 'Error creating group: ' . $e->getMessage()]);
    }
    exit;
}

?>