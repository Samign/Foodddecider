<?php
require_once __DIR__ . '/../../includes/json_response.php';   // JSON content type (see the file)
// Shared by shopping_lists.php and shopping_items.php
require_once __DIR__ . '/../../includes/session.php';
require_once __DIR__ . '/../../includes/db.php';

header('Content-Type: application/json');

function respond(array $data, int $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function bindAll(PDOStatement $stmt, array $values): void {
    foreach ($values as $name => $value) {
        $stmt->bindValue(":$name", $value, $value === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
    }
}

/** The logged-in user's id (a UUID), or a 401. */
function requireUser() {
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) respond(['error' => 'Not logged in'], 401);
    return $userId;
}

/**
 * A user can use a list if they own it, or if it is shared with a group they are in.
 * Every list and item call goes through this, including polling.
 * ADJUST group_members to your real membership table (group_id, member_id).
 */
function requireListAccess(PDO $db, $userId, int $listId): void {
    $stmt = $db->prepare("
        SELECT 1 FROM shopping_lists l
        WHERE l.id = :list
          AND (l.user_id = :user
               OR EXISTS (SELECT 1
                          FROM shopping_list_groups sg
                          JOIN group_members gm ON gm.group_id = sg.group_id
                          WHERE sg.list_id = l.id AND gm.member_id = :user))
    ");
    bindAll($stmt, ['list' => $listId, 'user' => $userId]);
    $stmt->execute();
    if (!$stmt->fetchColumn()) respond(['error' => 'Forbidden'], 403);
}