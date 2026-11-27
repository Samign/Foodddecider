<?php
require_once __DIR__ . '/../includes/json_response.php';   // JSON content type (see the file)
require_once '../includes/db.php';
require_once '../includes/helpers/recipe_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start(['read_and_close' => true]);   // read-only, so autocomplete doesn't lock the session
}
header('Content-Type: application/json; charset=utf-8');

$q = mb_substr(trim($_GET['q'] ?? ''), 0, 40);
if ($q === '') { echo '[]'; exit; }

$viewer = $_SESSION['user_id'] ?? null;
$like   = addcslashes($q, '%_\\');               // typed % and _ are literal

$conds  = ["t.name ILIKE :prefix", "t.name ILIKE :word_prefix"];
$params = [
    ':viewer'      => $viewer,
    ':prefix'      => "$like%",                  // "veg" -> "Vegan"
    ':word_prefix' => "% $like%",                // "free" -> "Gluten free"
];

$slugQ = slugify($q);
if ($slugQ !== '') {                             // "gluten free" -> slug gluten-free
    $conds[] = "t.slug LIKE :slug_prefix";
    $params[':slug_prefix'] = "$slugQ%";
}
if (mb_strlen($q) >= 3) {                        // typo tolerance
    $conds[] = "similarity(t.name, :term) > 0.4";
    $params[':term'] = $q;
}

$sql = "
    SELECT t.slug, MIN(t.name) AS name, COUNT(DISTINCT r.id) AS recipe_count
    FROM tags t
    JOIN recipe_tags rt ON rt.tag_id = t.id
    JOIN recipes r      ON r.id = rt.recipe_id
    WHERE (r.is_public = '1' OR r.owner_id = :viewer)
      AND (" . implode(' OR ', $conds) . ")
    GROUP BY t.slug
    ORDER BY BOOL_OR(t.name ILIKE :prefix) DESC, COUNT(DISTINCT r.id) DESC, MIN(t.name)
    LIMIT 8
";

$stmt = db()->prepare($sql);
$stmt->execute($params);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));