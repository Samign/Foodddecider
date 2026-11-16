<?php
require_once __DIR__ . '/shopping_common.php';

/** Only the owner may share or unshare a list. */
function requireListOwner(PDO $db, $userId, int $listId): void {
    $stmt = $db->prepare("SELECT 1 FROM shopping_lists WHERE id = :list AND user_id = :user");
    bindAll($stmt, ['list' => $listId, 'user' => $userId]);
    $stmt->execute();
    if (!$stmt->fetchColumn()) respond(['error' => 'Only the owner can do that'], 403);
}

/** You can only share a list with a group you are in. */
function requireGroupMember(PDO $db, $userId, int $groupId): void {
    $stmt = $db->prepare("SELECT 1 FROM group_members WHERE group_id = :group AND member_id = :user");
    bindAll($stmt, ['group' => $groupId, 'user' => $userId]);
    $stmt->execute();
    if (!$stmt->fetchColumn()) respond(['error' => 'You are not in that group'], 403);
}

$userId = requireUser();
$db = db();

// GET: every list the user can use, their own first
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    
    if (isset($_GET['list_id'])) {
        $listId = (int)$_GET['list_id'];
        requireListOwner($db, $userId, $listId);

        $stmt = $db->prepare("
            SELECT g.id, g.group_name, (sg.list_id IS NOT NULL) AS shared
            FROM groups g
            JOIN group_members gm ON gm.group_id = g.id AND gm.member_id = :user
            LEFT JOIN shopping_list_groups sg ON sg.group_id = g.id AND sg.list_id = :list
            ORDER BY g.group_name
        ");
        bindAll($stmt, ['user' => $userId, 'list' => $listId]);
        $stmt->execute();
        respond(['groups' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    // Everyone always has a personal list
    $stmt = $db->prepare("
        INSERT INTO shopping_lists (user_id, list_name)
        SELECT CAST(:user AS uuid), 'My shopping list'
        WHERE NOT EXISTS (SELECT 1 FROM shopping_lists WHERE user_id = CAST(:user AS uuid))
    ");
    bindAll($stmt, ['user' => $userId]);
    $stmt->execute();

    $stmt = $db->prepare("
        SELECT l.id, l.list_name AS name, (l.user_id = :user) AS is_owner, u.username AS owner_username
        FROM shopping_lists l
        JOIN users u ON u.id = l.user_id
        WHERE l.user_id = :user
           OR EXISTS (SELECT 1
                      FROM shopping_list_groups sg
                      JOIN group_members gm ON gm.group_id = sg.group_id
                      WHERE sg.list_id = l.id AND gm.member_id = :user)
        ORDER BY (l.user_id = :user) DESC, l.created_at, l.id
    ");
    bindAll($stmt, ['user' => $userId]);
    $stmt->execute();

    respond(['lists' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// POST (JSON body): create a list, or share / unshare one with a group
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in = json_decode(file_get_contents('php://input'), true);
    if (!is_array($in)) respond(['error' => 'Invalid JSON'], 400);

    $action = $in['action'] ?? '';

    if ($action === 'create') {
        $name = trim((string)($in['list_name'] ?? ''));
        if ($name === '' || strlen($name) > 255) respond(['error' => 'Invalid list name'], 422);

        $stmt = $db->prepare("INSERT INTO shopping_lists (user_id, list_name) VALUES (:user, :name) RETURNING id");
        bindAll($stmt, ['user' => $userId, 'name' => $name]);
        $stmt->execute();
        respond(['id' => $stmt->fetchColumn()]);
    }

    if ($action === 'share' || $action === 'unshare') {
        $listId = (int)($in['list_id'] ?? 0);
        $groupId = (int)($in['group_id'] ?? 0);
        requireListOwner($db, $userId, $listId);

        if ($action === 'share') {
            requireGroupMember($db, $userId, $groupId);
            $stmt = $db->prepare("INSERT INTO shopping_list_groups (list_id, group_id)
                                  VALUES (:list, :group) ON CONFLICT DO NOTHING");
        } else {
            $stmt = $db->prepare("DELETE FROM shopping_list_groups WHERE list_id = :list AND group_id = :group");
        }
        bindAll($stmt, ['list' => $listId, 'group' => $groupId]);
        $stmt->execute();
        respond(['ok' => true]);
    }

    if ($action === 'delete') {
        $listId = (int)($in['list_id'] ?? 0);
        requireListOwner($db, $userId, $listId);

        // Its items and shares are deleted with it (ON DELETE CASCADE)
        $stmt = $db->prepare("DELETE FROM shopping_lists WHERE id = :list AND user_id = :user");
        bindAll($stmt, ['list' => $listId, 'user' => $userId]);
        $stmt->execute();
        respond(['ok' => true]);
    }

    respond(['error' => 'Unknown action'], 400);
}

respond(['error' => 'Method not allowed'], 405);