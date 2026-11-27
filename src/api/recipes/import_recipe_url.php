<?php
require_once __DIR__ . '/../../includes/json_response.php';   // JSON content type (see the file)
require_once __DIR__ . '/../../includes/require_login.php';     // imports run the LLM: logged-in users only
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/recipe_adder.php';
require_once __DIR__ . '/../../includes/upload_image.php';
require_once __DIR__ . '/../../includes/helpers/recipe_helper.php';

header('Content-Type: application/json; charset=utf-8');

/**
 * Ask the parser service (src/api/LLM_Parser) to read a recipe page.
 * Returns ['ok' => true, 'data' => [...]] or ['ok' => false, 'error' => '...'].
 */
function parseRecipeFromPythonAPI(string $targetUrl): array {
    $ch = curl_init('http://api:8001/parse');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['url' => $targetUrl]),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 150,       // the service gives the model up to 110 s, plus fetching the page
    ]);

    $response = curl_exec($ch);
    $status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_errno($ch) ? curl_error($ch) : null;
    unset($ch);

    if ($curlErr) {
        error_log('Recipe import, cURL error: ' . $curlErr);
        return ['ok' => false, 'error' => 'The recipe reader is not responding. Try again in a minute.'];
    }

    $data = json_decode((string)$response, true);
    if (!is_array($data)) {
        error_log('Recipe import, bad JSON from parser: ' . json_last_error_msg());
        return ['ok' => false, 'error' => 'The recipe reader returned something unreadable.'];
    }

    // FastAPI errors come back as {"detail": "..."} with a 4xx/5xx status
    if ($status >= 400 || empty($data['recipe'])) {
        error_log('Recipe import, parser said: ' . ($data['detail'] ?? $response));
        return ['ok' => false, 'error' => $status === 400
            ? 'Could not open that page. Check the link.'
            : 'Could not find a recipe on that page.'];
    }

    return ['ok' => true, 'data' => $data];
}

/** The parser's sections -> the shape saveIngredientSections() reads (needs a 'raw' line per ingredient). */
function importIngredientSections(array $sections): array {
    $out = [];
    foreach ($sections as $section) {
        $items = [];
        foreach ($section['ingredients'] ?? [] as $ing) {
            $name = trim((string)($ing['ingredient'] ?? ''));
            if ($name === '') continue;

            $raw = trim((string)($ing['raw'] ?? ''));
            if ($raw === '') {
                $raw = trim(implode(' ', array_filter([$ing['amount'] ?? null, $ing['unit'] ?? null, $name])));
                if (!empty($ing['notes'])) $raw .= ', ' . $ing['notes'];
            }

            $items[] = [
                'raw'        => $raw,
                'amount'     => $ing['amount'] ?? null,
                'unit'       => $ing['unit'] ?? null,
                'size'       => null,
                'ingredient' => $name,
                'soft'       => false,
            ];
        }
        if ($items) $out[] = ['title' => $section['title'] ?? null, 'ingredients' => $items];
    }
    return $out;
}

$targetUrl = trim((string)($_POST['url'] ?? ''));
if (!filter_var($targetUrl, FILTER_VALIDATE_URL) || !preg_match('~^https?://~i', $targetUrl)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'That doesn’t look like a web link.']);
    exit;
}

$result = parseRecipeFromPythonAPI($targetUrl);
if (!$result['ok']) {
    http_response_code(502);
    echo json_encode(['success' => false, 'error' => $result['error']]);
    exit;
}

$recipe = $result['data']['recipe'];

$recipeId = addRecipe([
    'name'                => $recipe['title'] ?? 'Untitled Recipe',
    'description'         => $recipe['description'] ?? null,
    'link'                => $targetUrl,
    'public'              => '1',
    'course'              => $recipe['course_type'] ?? 4,
    'prep'                => wholeNumberOrNull($recipe['prep_time'] ?? null),   // null when the page only gives a total
    'cook'                => wholeNumberOrNull($recipe['cook_time'] ?? null),
    'picture'             => null,
    'servings'            => wholeNumberOrNull($recipe['servings'] ?? null),
    'tags'                => array_slice((array)($recipe['tags'] ?? []), 0, 6),    // names: saveTags reuses existing ones by slug
    'step_sections'       => $recipe['step_sections'] ?? [],                       // the keys addRecipe() reads
    'ingredient_sections' => importIngredientSections($recipe['ingredient_sections'] ?? []),
]);

if (!$recipeId) {
    exit;   // addRecipe() already sent a 500 with the error
}

if (!empty($recipe['image_url'])) {
    try {
        $recipePicture = processRecipeImage($recipe['image_url'], null, $recipeId, "recipe");
        if ($recipePicture) {
            db()->prepare("UPDATE recipes SET image_base = :image_base WHERE id = :id")
                ->execute([':image_base' => $recipePicture, ':id' => $recipeId]);
        }
    } catch (Throwable $e) {
        error_log('Recipe import, image failed: ' . $e->getMessage());   // keep the recipe, just without a photo
    }
}

echo json_encode(['success' => true, 'recipe_id' => $recipeId]);
