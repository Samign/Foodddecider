<?php

function generateIdenticon($seed, $size = 200) {
    $hash = md5($seed);

    // ── Palette ──────────────────────────────────────────────────────────────
    // Derive vivid HSL colours so we're never stuck with muddy RGB accidents
    $hue1  = (hexdec(substr($hash, 0, 2)) / 255) * 360;
    $hue2  = fmod($hue1 + 150 + (hexdec(substr($hash, 2, 2)) / 255) * 60, 360);
    $sat   = 55 + (hexdec(substr($hash, 4, 2)) % 30);   // 55–85 %
    $light = 42 + (hexdec(substr($hash, 6, 2)) % 18);   // 42–60 %

    $color1 = "hsl($hue1,$sat%,$light%)";
    $color2 = "hsl($hue2,$sat%," . ($light + 12) . "%)";

    // Accent: complementary tint used for shape fill
    $accentHue   = fmod($hue1 + 30, 360);
    $accentLight = 88 + (hexdec(substr($hash, 8, 2)) % 10); // near-white tint
    $accentColor = "hsl($accentHue,90%,$accentLight%)";

    // ── Grid ─────────────────────────────────────────────────────────────────
    $cells    = 5;                       // odd number → true centre column
    $padding  = $size * 0.08;
    $inner    = $size - $padding * 2;
    $cellSize = $inner / $cells;
    $half     = (int) ceil($cells / 2); // columns we generate (mirror rest)

    // ── Gradient angle ───────────────────────────────────────────────────────
    $angle   = hexdec(substr($hash, 10, 2)) % 4;
    $gradMap = [
        ['0%','0%','100%','100%'],
        ['0%','100%','100%','0%'],
        ['0%','50%','100%','50%'],
        ['50%','0%','50%','100%'],
    ];
    [$x1,$y1,$x2,$y2] = $gradMap[$angle];

    $cx = $size / 2;
    $cy = $size / 2;
    $r  = $size / 2;

    // ── SVG shell ────────────────────────────────────────────────────────────
    $svg  = "<svg xmlns='http://www.w3.org/2000/svg' width='$size' height='$size' viewBox='0 0 $size $size' shape-rendering='geometricPrecision'>";

    $svg .= "
    <defs>
      <linearGradient id='bg' x1='$x1' y1='$y1' x2='$x2' y2='$y2'>
        <stop offset='0%'   stop-color='$color1'/>
        <stop offset='100%' stop-color='$color2'/>
      </linearGradient>

      <!-- subtle overlay pattern for texture -->
      <pattern id='dots' x='0' y='0' width='8' height='8' patternUnits='userSpaceOnUse'>
        <circle cx='2' cy='2' r='0.8' fill='white' fill-opacity='0.07'/>
      </pattern>

      <clipPath id='circle'>
        <circle cx='$cx' cy='$cy' r='$r'/>
      </clipPath>

      <filter id='soft' x='-20%' y='-20%' width='140%' height='140%'>
        <feGaussianBlur in='SourceAlpha' stdDeviation='2.5' result='blur'/>
        <feOffset dx='0' dy='1.5' result='shadow'/>
        <feComposite in='SourceGraphic' in2='shadow' operator='over'/>
      </filter>
    </defs>";

    // Background + texture
    $svg .= "<circle cx='$cx' cy='$cy' r='$r' fill='url(#bg)'/>";
    $svg .= "<circle cx='$cx' cy='$cy' r='$r' fill='url(#dots)'/>";

    // ── Shapes ───────────────────────────────────────────────────────────────
    $svg .= "<g clip-path='url(#circle)' filter='url(#soft)'>";

    $i = 0;
    for ($row = 0; $row < $cells; $row++) {
        for ($col = 0; $col < $half; $col++) {
            $on        = hexdec($hash[$i % 32]) % 2;
            $shapeType = hexdec($hash[($i + 1) % 32]) % 4;
            $opacity   = 0.65 + (hexdec($hash[($i + 2) % 32]) % 8) * 0.04; // 0.65–0.93
            $i += 3;

            if (!$on) continue;

            // pixel centres for this cell and its mirror
            $px = $padding + $col * $cellSize + $cellSize / 2;
            $py = $padding + $row * $cellSize + $cellSize / 2;
            $mx = $padding + ($cells - $col - 1) * $cellSize + $cellSize / 2;

            $shapeSVG = fn($x, $y) => renderShape($shapeType, $x, $y, $cellSize, $accentColor, $opacity);

            $svg .= $shapeSVG($px, $py);
            if ($col !== $cells - $col - 1) {   // don't double-draw centre column
                $svg .= $shapeSVG($mx, $py);
            }
        }
    }

    $svg .= "</g></svg>";
    return $svg;
}

// ── Shape renderer ───────────────────────────────────────────────────────────
function renderShape(int $type, float $cx, float $cy, float $cellSize, string $fill, float $opacity): string {
    $r  = $cellSize * 0.36;   // radius / half-size
    $op = "fill-opacity='$opacity'";

    switch ($type) {
        case 0: // circle
            return "<circle cx='$cx' cy='$cy' r='$r' fill='$fill' $op/>";

        case 1: // rounded square
            $x  = $cx - $r;
            $y  = $cy - $r;
            $sz = $r * 2;
            $rx = $r * 0.35;
            return "<rect x='$x' y='$y' width='$sz' height='$sz' rx='$rx' ry='$rx' fill='$fill' $op/>";

        case 2: // diamond
            $pts = "$cx," . ($cy - $r) . " " .
                   ($cx + $r) . ",$cy $cx," . ($cy + $r) . " " .
                   ($cx - $r) . ",$cy";
            return "<polygon points='$pts' fill='$fill' $op/>";

        case 3: // triangle (pointing up)
        default:
            $pts = "$cx," . ($cy - $r) . " " .
                   ($cx - $r) . "," . ($cy + $r) . " " .
                   ($cx + $r) . "," . ($cy + $r);
            return "<polygon points='$pts' fill='$fill' $op/>";
    }
}