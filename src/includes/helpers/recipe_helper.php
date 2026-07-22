<?php

function fetchRecipeInput() {
    return [
        'name' => $_POST['name'] ?? '',
        'description' => $_POST['description'] ?? '',
        'link' => $_POST['link'] ?? '',
        'public' => $_POST['public'] ?? '0',
        'course' => $_POST['course'] ?? '4',
        'prep' => $_POST['prep'] ?? '10',
        'cook' => $_POST['cook'] ?? '30',
        'picture' => $_FILES['picture'] ?? null,
        'servings' => $_POST['servings'] ?? null,
        'steps' => $_POST['step_sections'] ?? [],
        'ingredients' => $_POST['ingredient_sections'] ?? [],
        'tags' => $_POST['tags'] ?? []
    ];
}

?>