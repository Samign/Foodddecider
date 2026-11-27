<?php
require_once __DIR__ . '/../../includes/json_response.php';   // JSON content type (see the file)
require_once __DIR__ . '/shopping_common.php';

/** Only the fields the client actually sent, validated. A missing key means "leave unchanged". */
function readFields(array $in): array {
    $fields = [];

    if (array_key_exists('text', $in)) {
        $text = trim((string)$in['text']);
        if ($text === '' || strlen($text) > 255) respond(['error' => 'Invalid text'], 422);
        $fields['text'] = $text;
    }
    if (array_key_exists('checked', $in)) {
        $fields['checked'] = $in['checked'] ? 'true' : 'false';
    }
    if (array_key_exists('position', $in)) {
        if (!is_numeric($in['position']) || !is_finite((float)$in['position'])) respond(['error' => 'Invalid position'], 422);
        $fields['position'] = (float)$in['position'];
    }
    return $fields;
}

$userId = requireUser();
$db = db();

// GET: the whole list, in order
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $listId = (int)($_GET['list_id'] ?? 0);
    requireListAccess($db, $userId, $listId);

    // Archived (checked) items are deleted two days after they were checked
    $stmt = $db->prepare("DELETE FROM shopping_items
                          WHERE list_id = :list AND checked_at < now() - interval '2 days'");
    bindAll($stmt, ['list' => $listId]);
    $stmt->execute();

    // List items first (in order), then the archive, most recently checked first
    $stmt = $db->prepare("SELECT id, name, checked_at IS NOT NULL AS checked, position
                          FROM shopping_items WHERE list_id = :list
                          ORDER BY checked_at DESC NULLS FIRST, position, id");
    bindAll($stmt, ['list' => $listId]);
    $stmt->execute();

    respond(['items' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// POST (JSON body): create, update or delete one item
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in = json_decode(file_get_contents('php://input'), true);
    if (!is_array($in)) respond(['error' => 'Invalid JSON'], 400);

    $listId = (int)($in['list_id'] ?? 0);
    requireListAccess($db, $userId, $listId);

    $action = $in['action'] ?? '';

    if ($action === 'create') {
        $f = readFields($in);
        if (!isset($f['text'], $f['position'])) respond(['error' => 'text and position are required'], 422);

        $stmt = $db->prepare("
            INSERT INTO shopping_items (list_id, name, position)
            VALUES (:list, :name, :position)
            RETURNING id
        ");
        bindAll($stmt, ['list' => $listId, 'name' => $f['text'], 'position' => $f['position']]);
        $stmt->execute();
        respond(['id' => $stmt->fetchColumn()]);
    }

    if ($action === 'add') {
        $texts = $in['texts'] ?? null;
        if (!is_array($texts)) respond(['error' => 'texts must be an array'], 422);

        $clean = [];
        foreach ($texts as $text) {
            $text = mb_substr(trim((string)$text), 0, 255);
            if ($text !== '') $clean[] = $text;
        }
        if (!$clean || count($clean) > 100) respond(['error' => 'Invalid texts'], 422);

        $db->beginTransaction();
        try {
            // Append after the last item (checked ones included, so positions never collide)
            $stmt = $db->prepare("SELECT COALESCE(MAX(position), 0) FROM shopping_items WHERE list_id = :list");
            bindAll($stmt, ['list' => $listId]);
            $stmt->execute();
            $position = (float)$stmt->fetchColumn();

            $insert = $db->prepare("INSERT INTO shopping_items (list_id, name, position)
                                    VALUES (:list, :name, :position)");
            foreach ($clean as $text) {
                $position += 1;
                bindAll($insert, ['list' => $listId, 'name' => $text, 'position' => $position]);
                $insert->execute();
            }
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
        respond(['ok' => true, 'added' => count($clean)]);
    }

    $id = (int)($in['id'] ?? 0);
    if ($id < 1) respond(['error' => 'Invalid id'], 400);

    if ($action === 'update') {
        $fields = readFields($in);
        if (!$fields) respond(['ok' => true]);

        // Column names come from readFields(), never from the client
        $set = [];
        foreach ($fields as $col => $_) {
            $set[] = $col === 'checked'
                ? "checked_at = CASE WHEN CAST(:checked AS boolean) THEN COALESCE(checked_at, now()) ELSE NULL END"
                : "$col = :$col";
        }

        $stmt = $db->prepare("UPDATE shopping_items SET " . implode(', ', $set) . " WHERE id = :id AND list_id = :list");
        bindAll($stmt, $fields + ['id' => $id, 'list' => $listId]);
        $stmt->execute();

        // 0 rows: someone else deleted it, so the client should drop the row
        respond($stmt->rowCount() ? ['ok' => true] : ['ok' => true, 'gone' => true]);
    }

    if ($action === 'delete') {
        $stmt = $db->prepare("DELETE FROM shopping_items WHERE id = :id AND list_id = :list");
        bindAll($stmt, ['id' => $id, 'list' => $listId]);
        $stmt->execute();
        respond(['ok' => true]);
    }

    respond(['error' => 'Unknown action'], 400);
}

respond(['error' => 'Method not allowed'], 405);