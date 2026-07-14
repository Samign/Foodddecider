<?php

class IngredientConverter
{
    // Volume units → ml
    private const VOLUME_TO_ML = [
        'ml'    => 1.0,
        'l'     => 1000.0,
        'dl'    => 100.0,
        'tsp'   => 4.92,      // US teaspoon
        'tbsp'  => 14.79,     // US tablespoon
        'cup'   => 240.0,     // US cup
        'fl_oz' => 29.57,
    ];

    // Weight units → grams
    private const WEIGHT_TO_G = [
        'g'   => 1.0,
        'kg'  => 1000.0,
        'mg'  => 0.001,
        'oz'  => 28.3495,
        'lb'  => 453.592,
    ];

    /**
     * Convert a recipe ingredient amount to grams.
     *
     * @param float       $amount      e.g. 2.0
     * @param string      $unit        e.g. 'cup'
     * @param float|null  $gPerMl      from ingredient_densities (needed for volume units)
     * @param float|null  $gPerPiece   from ingredient_densities (needed for count units)
     *
     * @throws \InvalidArgumentException if conversion is impossible (missing density)
     */
    public static function toGrams(
        float $amount,
        string $unit,
        ?float $gPerMl = null,
        ?float $gPerPiece = null,
    ): float {
        $unit = strtolower(trim($unit));

        // Weight unit — direct conversion
        if (isset(self::WEIGHT_TO_G[$unit])) {
            return $amount * self::WEIGHT_TO_G[$unit];
        }

        // Volume unit — needs density
        if (isset(self::VOLUME_TO_ML[$unit])) {
            if ($gPerMl === null) {
                throw new \InvalidArgumentException(
                    "Volume unit '$unit' requires a density (g_per_ml) for this ingredient."
                );
            }
            $ml = $amount * self::VOLUME_TO_ML[$unit];
            return $ml * $gPerMl;
        }

        // Count unit — needs per-piece weight
        if (in_array($unit, ['piece', 'pcs', 'slice', 'clove', 'pinch', 'handful'], true)) {
            if ($gPerPiece === null) {
                throw new \InvalidArgumentException(
                    "Count unit '$unit' requires a per-piece weight (g_per_piece) for this ingredient."
                );
            }
            return $amount * $gPerPiece;
        }

        throw new \InvalidArgumentException("Unknown unit: '$unit'");
    }

    /**
     * Calculate macros for a recipe ingredient.
     *
     * @param float  $grams          result of toGrams()
     * @param array  $ingredient     row from ingredients table (macros per 100g)
     *
     * @return array ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']
     */
    public static function macros(float $grams, array $ingredient): array
    {
        $ratio = $grams / 100.0;

        return [
            'energy_kcal' => round(($ingredient['energy_kcal'] ?? 0) * $ratio, 2),
            'protein_g'   => round(($ingredient['protein_g']   ?? 0) * $ratio, 2),
            'carbs_g'     => round(($ingredient['carbs_g']     ?? 0) * $ratio, 2),
            'fat_g'       => round(($ingredient['fat_g']       ?? 0) * $ratio, 2),
            'fiber_g'     => round(($ingredient['fiber_g']     ?? 0) * $ratio, 2),
        ];
    }
}