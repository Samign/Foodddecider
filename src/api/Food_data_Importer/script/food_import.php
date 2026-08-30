<?php

require_once __DIR__ . '/../../../includes/db.php';

/**
 * Food Database Importer — USDA FoodData Central + Open Food Facts → PostgreSQL
 *
 * USDA downloads  : https://fdc.nal.usda.gov/download-datasets.html
 *   Foundation Foods  (raw ingredients — chicken, flour, etc.)
 *   SR Legacy         (broad standard reference)
 *
 * OFF download    : https://world.openfoodfacts.org/data
 *   openfoodfacts-jsonl.gz  (stream-read line by line, no full decompression needed)
 *
 * Usage:
 *   php food_import.php --file=foundationDownload.json        --type=foundation
 *   php food_import.php --file=sr_legacy_food.json            --type=sr_legacy
 *   php food_import.php --file=openfoodfacts-products.jsonl.gz --type=off
 *   php food_import.php --file=openfoodfacts-products.jsonl    --type=off
 * 
 *  docker compose exec php php /var/www/html/api/Food_data_Importer/script/food_import.php --file=/var/www/html/api/Food_data_Importer/raw_data/FoodData_Central_foundation_food_json_2026-04-30.json --type=foundation
 *
 *  docker compose exec php php /var/www/html/api/Food_data_Importer/script/food_import.php --file=/var/www/html/api/Food_data_Importer/raw_data/FoodData_Central_sr_legacy_food_json_2018-04.json --type=sr_legacy
 *  
 *  docker compose exec php php /var/www/html/api/Food_data_Importer/script/food_import.php \
 *    --file=/var/www/html/api/Food_data_Importer/raw_data/openfoodfacts-products.jsonl.gz \
 *    --type=off
 *
 * Add --dry-run to parse and validate without writing to the database.
 *
 * Requirements: PHP 8.1+, ext-pdo_pgsql, ext-zlib (for .gz reading)
 */

// declare(strict_types=1);

// ─── DB config ────────────────────────────────────────────────────────────────

// $env = parse_ini_file(dirname(__DIR__, 3) . '/.env');

// // Load DB config from .env
// $_DB_HOST = $env['DB_HOST'];
// $_DB_PORT = $env['DB_PORT'];
// $_DB_NAME = $env['POSTGRES_DB'];
// $_DB_USER = $env['POSTGRES_USER'];
// $_DB_PASS = $env['POSTGRES_PASSWORD'];

// // Define DB connection constants using loaded values
// define('DB_DSN', "pgsql:host={$_DB_HOST};port={$_DB_PORT};dbname={$_DB_NAME}");
// define('DB_USER', $_DB_USER);
// define('DB_PASS', $_DB_PASS);

// Rows buffered before each INSERT. Higher = faster, more memory.
const BATCH_SIZE = 500;

// ─── USDA nutrient IDs → our column names ────────────────────────────────────
// USDA always reports per 100g, so no conversion needed.

const USDA_NUTRIENT_MAP = [
    1008 => 'energy_kcal',
    1003 => 'protein_g',
    1005 => 'carbs_g',
    1004 => 'fat_g',
    1079 => 'fiber_g',
    2000 => 'sugar_g',
    1093 => 'sodium_mg',   // USDA reports sodium in mg/100g
];

// OFF nutriment keys → our column names
// OFF reports sodium in g/100g, so we multiply × 1000 → mg (see extractOFFRow).
const OFF_NUTRIENT_MAP = [
    'energy-kcal_100g'   => 'energy_kcal',
    'energy_kcal_100g'   => 'energy_kcal',   // alternate spelling in some records
    'proteins_100g'      => 'protein_g',
    'carbohydrates_100g' => 'carbs_g',
    'fat_100g'           => 'fat_g',
    'fiber_100g'         => 'fiber_g',
    'fibers_100g'        => 'fiber_g',        // alternate spelling
    'sugars_100g'        => 'sugar_g',
    'sodium_100g'        => 'sodium_mg',      // will be ×1000 below
];

const DATASET_KEYS = [
    'foundation' => 'FoundationFoods',
    'sr_legacy'  => 'SRLegacyFoods',
];

// ─── CLI ─────────────────────────────────────────────────────────────────────

$opts   = getopt('', ['file:', 'type:', 'dry-run']);
$file   = $opts['file']  ?? null;
$type   = $opts['type']  ?? null;
$dryRun = isset($opts['dry-run']);

$validTypes = array_merge(array_keys(DATASET_KEYS), ['off']);

if (!$file || !$type || !in_array($type, $validTypes, true)) {
    fwrite(STDERR, implode("\n", [
        'Usage: php food_import.php --file=<path> --type=<type> [--dry-run]',
        '',
        'Types:',
        '  foundation  — USDA Foundation Foods JSON',
        '  sr_legacy   — USDA SR Legacy JSON',
        '  off         — Open Food Facts JSONL (plain or .gz)',
        '',
    ]));
    exit(1);
}

if (!file_exists($file)) {
    fwrite(STDERR, "File not found: $file\n");
    exit(1);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

$pdo = db();

createTablesIfNeeded($pdo);

if ($type === 'off') {
    importOFF($pdo, $file, $dryRun);
} else {
    importUSDA($pdo, $file, $type, $dryRun);
}

// ─── USDA import ─────────────────────────────────────────────────────────────

function importUSDA(PDO $pdo, string $file, string $type, bool $dryRun): void
{
    ini_set('memory_limit', '2G');

    echo "USDA — Reading $file ...\n";

    $raw  = file_get_contents($file);
    $data = json_decode($raw, associative: true, flags: JSON_THROW_ON_ERROR);
    unset($raw);

    $datasetKey = DATASET_KEYS[$type];
    $foods      = $data[$datasetKey] ?? [];

    if (empty($foods)) {
        fwrite(STDERR, "No foods found under key '$datasetKey' — check --type.\n");
        exit(1);
    }

    $total = count($foods);

    $batch = $inserted = $skipped = 0;
    $rows  = [];
    $densityRows = [];

    foreach ($foods as $food) {

        if (!is_array($food)) {
            $skipped++;
            continue;
        }

        $row = extractUSDARow($food);
        
        if (empty($row['source']) || empty($row['source_id']) || empty($row['name_en'])) {
            $skipped++;
            continue;
        }

        if ($row['protein_g'] === null && $row['carbs_g'] === null && $row['fat_g'] === null) {
            $skipped++;
            continue;
        }

        if ($row['_density'] !== null) {
            $densityRows[] = ['source_id' => $row['source_id']] + $row['_density'];
        }
        unset($row['_density']);

        $rows[] = $row;
        $batch++;
        
        if ($batch >= BATCH_SIZE) {
            if (!$dryRun) {
                batchInsert($pdo, $rows);
                batchInsertDensities($pdo, $densityRows);
            }
            $inserted += $batch;
            $rows  = [];
            $densityRows = [];
            $batch = 0;
        }
    }

    if (!empty($rows)) {
        if (!$dryRun) {
            batchInsert($pdo, $rows);
            batchInsertDensities($pdo, $densityRows);
        }
        $inserted += count($rows);
    }

}

function extractUSDARow(array $food): array
{
    $nutrients = [];
    foreach ($food['foodNutrients'] ?? [] as $fn) {
        $id = $fn['nutrient']['id'] ?? null;
        if ($id !== null && isset(USDA_NUTRIENT_MAP[$id])) {
            $col            = USDA_NUTRIENT_MAP[$id];
            $nutrients[$col] = isset($fn['amount']) ? (float)$fn['amount'] : null;
        }
    }

    $category = $food['foodCategory']['description']
        ?? $food['foodGroup']['description']
        ?? null;

    return [
        'source'      => 'usda',
        'source_id'   => (string)($food['fdcId'] ?? ''),
        'name_en'     => trim($food['description'] ?? ''),
        // USDA has no multilingual names — fill in later with a translation pass if needed.
        'name_sv'     => null,
        'name_de'     => null,
        'energy_kcal' => $nutrients['energy_kcal'] ?? null,
        'protein_g'   => $nutrients['protein_g']   ?? null,
        'carbs_g'     => $nutrients['carbs_g']     ?? null,
        'fat_g'       => $nutrients['fat_g']       ?? null,
        'fiber_g'     => $nutrients['fiber_g']     ?? null,
        'sugar_g'     => $nutrients['sugar_g']     ?? null,
        'sodium_mg'   => $nutrients['sodium_mg']   ?? null,  // already in mg from USDA
        'per_grams'   => 100,
        'category'    => $category,
        '_density' => extractUSDADensity($food),
    ];
}

function extractUSDADensity(array $food): ?array
{
    $volumeToMl = [
        'cup'         => 240.0,
        'tablespoon'  => 14.79,
        'teaspoon'    => 4.92,
        'fl oz'       => 29.57,
        'fluid ounce' => 29.57,
        'milliliter'  => 1.0,
        'liter'       => 1000.0,
    ];

    $countModifiers = ['medium', 'large', 'small', 'extra large', 'whole', 'piece'];

    $gPerMl    = null;
    $gPerPiece = null;

    foreach ($food['foodPortions'] ?? [] as $portion) {
        $amount     = (float)($portion['amount']     ?? 0);
        $gramWeight = (float)($portion['gramWeight'] ?? 0);

        if ($amount <= 0 || $gramWeight <= 0) continue;

        $unitName = strtolower($portion['measureUnit']['name'] ?? '');
        $modifier = strtolower($portion['modifier']            ?? '');

        // Volume → g/ml density (prefer cup measurements, larger = more accurate)
        if ($gPerMl === null && isset($volumeToMl[$unitName])) {
            $gPerMl = round($gramWeight / ($amount * $volumeToMl[$unitName]), 4);
        }

        // Count → g/piece (prefer 'medium' as the canonical size)
        if ($modifier === 'medium') {
            $gPerPiece = round($gramWeight / $amount, 2);
        } elseif ($gPerPiece === null && in_array($modifier, $countModifiers, true)) {
            $gPerPiece = round($gramWeight / $amount, 2);
        }
    }

    if ($gPerMl === null && $gPerPiece === null) return null;

    return ['g_per_ml' => $gPerMl, 'g_per_piece' => $gPerPiece];
}

// ─── Open Food Facts import ───────────────────────────────────────────────────

function importOFF(PDO $pdo, string $file, bool $dryRun): void
{
    $isGzip = str_ends_with($file, '.gz');

    if ($isGzip && !extension_loaded('zlib')) {
        fwrite(STDERR, "ext-zlib is required to read .gz files. Install it or decompress the file first.\n");
        exit(1);
    }

    echo "OFF — Streaming $file" . ($isGzip ? ' (gzip)' : '') . " ...\n";
    echo ($dryRun ? "(dry-run — nothing will be written)\n" : '');

    $batch = $inserted = $skipped = 0;
    $rows  = [];

    foreach (streamJsonLines($file, $isGzip) as $lineNum => $line) {
        try {
            $product = json_decode($line, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            // Malformed line — skip silently (rare in the OFF dump)
            continue;
        }

        $row = extractOFFRow($product);

        // Skip products with no useful name or no macro data whatsoever
        if (
            empty($row['name_en']) && empty($row['name_sv']) && empty($row['name_de'])
            || empty($row['source']) || empty($row['source_id']) || ($row['protein_g'] === null && $row['carbs_g'] === null && $row['fat_g'] === null)
        ) {
            $skipped++;
            continue;
        }

        $rows[] = $row;
        $batch++;

        if ($batch >= BATCH_SIZE) {
            if (!$dryRun) batchInsert($pdo, $rows);
            $inserted += $batch;
            $rows  = [];
            $batch = 0;

            if ($inserted % 10000 === 0) {
                echo sprintf("\r  %s products processed ...", number_format($inserted));
            }
        }
    }

    if (!empty($rows)) {
        if (!$dryRun) batchInsert($pdo, $rows);
        $inserted += count($rows);
    }

    echo "\n\nDone. Inserted/updated: " . number_format($inserted)
        . " | Skipped (no name or macros): " . number_format($skipped) . "\n";
}

function extractOFFRow(array $p): array
{
    $nutriments = $p['nutriments'] ?? [];

    // Resolve multilingual product names.
    // OFF stores them as flat top-level keys: product_name_en, product_name_sv, etc.
    $nameEn = $p['product_name_en'] ?? null;
    $nameSv = $p['product_name_sv'] ?? null;
    $nameDe = $p['product_name_de'] ?? null;

    // If there's no explicit English name, fall back to the default product_name
    // (which is whatever language the product was first entered in).
    if (empty($nameEn)) {
        $nameEn = $p['product_name'] ?? null;
    }

    // Extract nutrients, handling both alternate spellings via OFF_NUTRIENT_MAP.
    $nutrients = [];
    foreach (OFF_NUTRIENT_MAP as $offKey => $ourCol) {
        if (!isset($nutrients[$ourCol]) && isset($nutriments[$offKey])) {
            $nutrients[$ourCol] = (float)$nutriments[$offKey];
        }
    }

    // OFF reports sodium in g/100g → convert to mg to match USDA & our schema.
    if (isset($nutrients['sodium_mg'])) {
        $nutrients['sodium_mg'] = round($nutrients['sodium_mg'] * 1000, 4);
    }

    return [
        'source'      => 'off',
        'source_id'   => (string)($p['code'] ?? ''),
        'name_en'     => trim((string)($nameEn ?? '')),
        'name_sv'     => $nameSv !== null ? trim((string)$nameSv) : null,
        'name_de'     => $nameDe !== null ? trim((string)$nameDe) : null,
        'energy_kcal' => $nutrients['energy_kcal'] ?? null,
        'protein_g'   => $nutrients['protein_g']   ?? null,
        'carbs_g'     => $nutrients['carbs_g']      ?? null,
        'fat_g'       => $nutrients['fat_g']        ?? null,
        'fiber_g'     => $nutrients['fiber_g']      ?? null,
        'sugar_g'     => $nutrients['sugar_g']      ?? null,
        'sodium_mg'   => $nutrients['sodium_mg']    ?? null,
        'per_grams'   => 100,
        'category'    => offCategory($p),
    ];
}

/**
 * Extract a human-readable category string from an OFF product.
 * Tries main_category first, then the first English tag in categories_tags.
 */
function offCategory(array $p): ?string
{
    if (!empty($p['main_category'])) {
        // e.g. "en:biscuits-and-cakes" → "biscuits and cakes"
        return ucfirst(str_replace(['-', 'en:', 'fr:', 'de:', 'sv:'], [' ', '', '', '', ''], $p['main_category']));
    }

    foreach ($p['categories_tags'] ?? [] as $tag) {
        if (str_starts_with($tag, 'en:')) {
            return ucfirst(str_replace(['-', 'en:'], [' ', ''], $tag));
        }
    }

    return null;
}

/**
 * Generator — yields one raw JSON line at a time from a plain or gzipped JSONL file.
 * Keeps memory flat regardless of file size (critical for the 43GB OFF dump).
 */
function streamJsonLines(string $file, bool $isGzip): Generator
{
    $handle = $isGzip ? gzopen($file, 'rb') : fopen($file, 'r');

    if ($handle === false) {
        throw new RuntimeException("Cannot open file: $file");
    }

    $lineNum = 0;

    try {
        while (true) {
            $line = $isGzip ? gzgets($handle, 1_048_576) : fgets($handle, 1_048_576);

            if ($line === false) break;  // EOF

            $line = trim($line);
            if ($line === '') continue;

            yield $lineNum++ => $line;
        }
    } finally {
        $isGzip ? gzclose($handle) : fclose($handle);
    }
}

function batchInsert(PDO $pdo, array $rows): void
{
    if (empty($rows)) return;

    $deduped = [];
    foreach ($rows as $row) {
        $sourceId = $row['source_id'] ?? null;
        
        // Skip invalid IDs immediately
        if ($sourceId === null || trim((string)$sourceId) === '') {
            continue; 
        }
        
        // Using the ID as the key naturally overwrites any duplicates in this batch
        $deduped[$sourceId] = $row;
    }
    
    // Re-index the array back to standard numbers
    $rows = array_values($deduped);

    if (empty($rows)) return;

    $cols = [
        'source', 'source_id', 'name_en', 'name_sv', 'name_de',
        'energy_kcal', 'protein_g', 'carbs_g', 'fat_g',
        'fiber_g', 'sugar_g', 'sodium_mg', 'per_grams', 'category',
    ];

    $placeholders = [];
    $values       = [];

    $cols = [
        'source', 'source_id', 'name_en', 'name_sv', 'name_de',
        'energy_kcal', 'protein_g', 'carbs_g', 'fat_g',
        'fiber_g', 'sugar_g', 'sodium_mg', 'per_grams', 'category',
    ];

    $placeholders = [];
    $values       = [];
    $validCount   = 0;

    foreach ($rows as $row) {
        $sourceId = $row['source_id'] ?? null;
        
        // If it's missing, null, or an empty string, abort this specific row entirely.
        if ($sourceId === null || trim((string)$sourceId) === '') {
            continue; 
        }

        $slots = [];
        
        $nutrientCols = ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'];

        foreach ($cols as $col) {
            $slots[] = '?';
            
            $val = $row[$col] ?? null;
            
            if (in_array($col, $nutrientCols, true) && is_numeric($val) && $val > 999999) {
                $val = null;
            }
            
            $values[] = $val;
        }
        
        $placeholders[] = '(' . implode(', ', $slots) . ')';
        $validCount++;
    }

    // If every single row in this batch was junk, exit early!
    if ($validCount === 0) return;

    $updateCols = array_filter($cols, fn($c) => !in_array($c, ['source', 'source_id'], true));
    $updateSet  = implode(",\n      ", array_map(fn($c) => "$c = EXCLUDED.$c", $updateCols));

    $sql = sprintf(
        "INSERT INTO ingredients (%s)\nVALUES\n  %s\nON CONFLICT (source, source_id) DO UPDATE SET\n      %s",
        implode(', ', $cols),
        implode(",\n  ", $placeholders),
        $updateSet
    );

    $pdo->prepare($sql)->execute($values);
}

function batchInsertDensities(PDO $pdo, array $densityRows): void
{
    $densityRows = array_values(array_filter(
        $densityRows,
        fn($r) => !empty($r['source_id']) && ($r['g_per_ml'] !== null || $r['g_per_piece'] !== null)
    ));

    if (empty($densityRows)) return;

    // Resolve source_id → ingredient id in one query
    $sourceIds   = array_column($densityRows, 'source_id');
    $holders     = implode(',', array_fill(0, count($sourceIds), '?'));
    $stmt        = $pdo->prepare(
        "SELECT id, source_id FROM ingredients WHERE source = 'usda' AND source_id IN ($holders)"
    );
    $stmt->execute($sourceIds);
    $idMap = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'id', 'source_id');

    $placeholders = [];
    $values       = [];
    $i            = 1;

    foreach ($densityRows as $row) {
        $ingredientId = $idMap[$row['source_id']] ?? null;
        if ($ingredientId === null) continue;

        $placeholders[] = '(?, ?, ?)';
        $values[]       = $ingredientId;
        $values[]       = $row['g_per_ml'];
        $values[]       = $row['g_per_piece'];
        $i += 3;
    }

    if (empty($placeholders)) return;

    $sql = "
        INSERT INTO ingredient_densities (id, grams_per_ml, grams_per_piece)
        VALUES " . implode(', ', $placeholders) . "
        ON CONFLICT (id) DO UPDATE SET
            grams_per_ml    = COALESCE(EXCLUDED.grams_per_ml,    ingredient_densities.grams_per_ml),
            grams_per_piece = COALESCE(EXCLUDED.grams_per_piece, ingredient_densities.grams_per_piece)
    ";

    $pdo->prepare($sql)->execute($values);
}

function createTablesIfNeeded(PDO $pdo): void
{
    // Enable pg_trgm for fuzzy/autocomplete searches (requires superuser once per DB).
    try {
        $pdo->exec('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    } catch (PDOException) {
        fwrite(STDERR, "Warning: pg_trgm extension could not be created (needs superuser). "
            . "Run: CREATE EXTENSION pg_trgm; as a superuser, then re-run this script.\n");
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS ingredients (
            id           SERIAL        PRIMARY KEY,
            source       VARCHAR(10)   NOT NULL,           -- 'usda' | 'off'
            source_id    VARCHAR(100)  NOT NULL,           -- fdcId or OFF barcode
            name_en      TEXT,
            name_sv      TEXT,
            name_de      TEXT,
            energy_kcal  NUMERIC(10,4),
            protein_g    NUMERIC(10,4),
            carbs_g      NUMERIC(10,4),
            fat_g        NUMERIC(10,4),
            fiber_g      NUMERIC(10,4),
            sugar_g      NUMERIC(10,4),
            sodium_mg    NUMERIC(10,4),
            per_grams    INTEGER       NOT NULL DEFAULT 100,
            category     TEXT,
            created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

            CONSTRAINT uq_ingredients_source UNIQUE (source, source_id)
        );

        CREATE TABLE IF NOT EXISTS ingredient_densities (
            id INTEGER PRIMARY KEY REFERENCES ingredients(id) ON DELETE CASCADE,
            grams_per_ml FLOAT,
            grams_per_piece FLOAT
        );

        CREATE TABLE IF NOT EXISTS ingredient_units (
            id             INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            ingredient_id  INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
            unit           VARCHAR(50),                          -- NULL = whole/each
            size           VARCHAR(50),                          -- NULL = any size
            grams_per_unit FLOAT NOT NULL,
            UNIQUE (ingredient_id, unit, size)
        );

        CREATE TABLE IF NOT EXISTS recipe_ingredients (
            id              INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            recipe_id       INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
            section_id      INT NULL REFERENCES ingredient_sections(id) ON DELETE SET NULL,
            ingredient_id   INT NULL     REFERENCES ingredients(id) ON DELETE SET NULL,
            ingredient_name VARCHAR(255) NOT NULL,
            amount          FLOAT,
            unit            VARCHAR(50),
            size            VARCHAR(50),   -- 'small' | 'medium' | 'large' | NULL
            position        INT,
            raw_input       TEXT,
            is_soft         BOOLEAN DEFAULT FALSE
        );

        CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_name_trgm
         ON recipe_ingredients USING GIN (ingredient_name gin_trgm_ops);

        CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
            ON recipe_ingredients(recipe_id, position);

        CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient
            ON recipe_ingredients(ingredient_id);

        CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_combo
            ON recipe_ingredients(ingredient_id, recipe_id);

        -- Full-text search (word matching — used for longer search queries)
        CREATE INDEX IF NOT EXISTS idx_ingredients_fts_en
            ON ingredients USING GIN (to_tsvector('english', coalesce(name_en, '')));

        -- Trigram index (fuzzy / autocomplete — handles typos like 'chiken')
        CREATE INDEX IF NOT EXISTS idx_ingredients_trgm_en
            ON ingredients USING GIN (name_en gin_trgm_ops);

        -- Same trigram index for Swedish names
        CREATE INDEX IF NOT EXISTS idx_ingredients_trgm_sv
            ON ingredients USING GIN (name_sv gin_trgm_ops);

        -- Keep updated_at current automatically
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER LANGUAGE plpgsql AS \$\$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
        \$\$;

        DROP TRIGGER IF EXISTS trg_ingredients_updated_at ON ingredients;
        CREATE TRIGGER trg_ingredients_updated_at
            BEFORE UPDATE ON ingredients
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ");
}
