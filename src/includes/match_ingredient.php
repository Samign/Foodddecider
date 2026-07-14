<?php

function normalizeName($name) {
    $name = strtolower($name);
    // Replace non-alphanumeric characters with spaces (NOT hyphens)
    $name = preg_replace('/[^a-z0-9\s]+/', ' ', $name);
    // Remove common culinary modifiers
    $name = preg_replace('/\b(of|fresh|chopped|diced|sliced|minced|grated|large|small|medium|extra large|extra small)\b/', '', $name);
    // Collapse multiple spaces into a single space and trim edges
    $name = preg_replace('/\s+/', ' ', $name);
    return trim($name);
}

function match_ingredient($db, $ingredient) {
    $normalized = normalizeName($ingredient);
    
    if (empty($normalized)) {
        return null;
    }
    
    // Exact match (using LOWER to ensure it matches regardless of DB casing)
    $stmt = $db->prepare("
        SELECT id, name_en
        FROM ingredients 
        WHERE LOWER(name_sv) = :name OR LOWER(name_en) = :name
        LIMIT 1
    ");

    $stmt->execute([':name' => $normalized]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC); 

    if ($result) {
        return [
            'id' => $result['id'],
            'name' => $result['name_en'] // Standardizing return to always use English base name if preferred
        ];
    }

    // Fuzzy match (Using GREATEST to score against both languages accurately)
    $stmt = $db->prepare("
        SELECT 
            id, 
            name_en, 
            name_sv, 
            name_de, 
            GREATEST(similarity(name_en, :name), similarity(name_sv, :name)) AS score 
        FROM ingredients 
        WHERE name_sv % :name OR name_en % :name
        ORDER BY score DESC
        LIMIT 1
    ");

    $stmt->execute([':name' => $normalized]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC); 

    if ($result && $result['score'] > 0.4) {
        return [
            'id' => $result['id'],
            'name' => $result['name_en']
        ];
    }
    
    return null;
}

?>