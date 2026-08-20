<?php
require '../includes/db.php';
require '../includes/session.php';

header('Content-type: application/json');

$userId = $_SESSION['user_id'] ?? null;

$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("
    SELECT json_build_object(
        'courseTypes',
         (SELECT json_agg(ct order by ct.display_order)
          FROM course_types ct)
    ) AS form_metadata
    ");

    // SELECT json_build_object(
    //     'courseTypes',
    //      (SELECT json_agg(ct order by ct.display_order)
    //       FROM course_types ct),
    //     'attributes',
    //      (SELECT json_agg(a order by a.display_order)
    //       FROM attributes a)
    // ) AS form_metadata
    // ");

    $stmt->execute();

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode(json_decode($row['form_metadata']));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Tag name required']);
        exit;
    }

    $stmt = $pdo->prepare("
    INSERT INTO tags (name)
    VALUES (:name)
    ON CONFLICT (name) DO UPDATE SET name = tags.name
    RETURNING id
    ");
    $stmt->execute([
        trim($data['name'])
    ]);

    echo json_encode([
        'id' => $tagID,
        'name' => trim($data['name'])
    ]);
}