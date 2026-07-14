-- ============================================================
-- 003_seed_units.sql
-- Unit conversions for ingredients
--
-- unit NULL  = "each" / whole item  (e.g. "1 tomato", "2 eggs")
-- size NULL  = unspecified / default size
-- size       = 'small' | 'medium' | 'large' | 'extra-large'
-- ============================================================

WITH ing AS (
    SELECT id, name FROM ingredients
)
INSERT INTO ingredient_units (ingredient_id, unit, size, grams_per_unit)
SELECT ing.id, u.unit, u.size, u.grams_per_unit
FROM ing
JOIN (VALUES

    -- ── EGGS ────────────────────────────────────────────────────
    -- "1 egg" / "2 eggs" with no unit → whole item
    ('egg', NULL,   'small',       38.0),
    ('egg', NULL,   'medium',      44.0),
    ('egg', NULL,   'large',       50.0),
    ('egg', NULL,   'extra-large', 56.0),
    ('egg', NULL,    NULL,         50.0),   -- default = large

    -- ── MEAT (weight units only) ─────────────────────────────────
    ('chicken breast', 'oz',  NULL, 28.35),
    ('chicken breast', 'lb',  NULL, 453.6),
    ('chicken breast', NULL,  'small',  120.0),  -- 1 small chicken breast
    ('chicken breast', NULL,  'medium', 170.0),
    ('chicken breast', NULL,  'large',  225.0),
    ('chicken breast', NULL,   NULL,    170.0),  -- default

    ('chicken thigh', 'oz',  NULL, 28.35),
    ('chicken thigh', 'lb',  NULL, 453.6),
    ('chicken thigh', NULL,  'small',  100.0),  -- 1 small chicken thigh
    ('chicken thigh', NULL,  'medium', 150.0),
    ('chicken thigh', NULL,  'large',  200.0),
    ('chicken thigh', NULL,   NULL,    150.0),  -- default

    ('ground beef', 'oz', NULL, 28.35),
    ('ground beef', 'lb', NULL, 453.6),

    ('pork', 'oz', NULL, 28.35),
    ('pork', 'lb', NULL, 453.6),

    ('bacon', 'oz',   NULL,  28.35),
    ('bacon', NULL,   NULL,   8.0),   -- 1 slice bacon

    ('ham', 'oz',   NULL,  28.35),
    ('ham', NULL,   NULL,  30.0),    -- 1 slice ham

    ('turkey', 'oz', NULL, 28.35),
    ('turkey', 'lb', NULL, 453.6),

    ('lamb', 'oz', NULL, 28.35),
    ('lamb', 'lb', NULL, 453.6),

    ('sausage', 'oz',  NULL, 28.35),
    ('sausage', NULL,  NULL, 75.0),  -- 1 sausage link

    -- ── FISH & SEAFOOD ───────────────────────────────────────────
    ('salmon',   'oz',    NULL,  28.35),
    ('salmon',   'lb',    NULL, 453.6),
    ('salmon',   NULL,    NULL, 170.0),  -- 1 fillet

    ('tuna',     'oz',    NULL,  28.35),
    ('tuna',     'can',   NULL, 142.0),  -- 1 standard can (5oz drained)
    ('tuna',     NULL,    NULL, 142.0),

    ('cod',      'oz',    NULL,  28.35),
    ('cod',      NULL,    NULL, 180.0),  -- 1 fillet

    ('shrimp',   'oz',    NULL,  28.35),
    ('shrimp',   'lb',    NULL, 453.6),
    ('shrimp',   'cup',   NULL, 145.0),

    ('tilapia',  'oz',    NULL,  28.35),
    ('tilapia',  NULL,    NULL, 170.0),  -- 1 fillet

    ('sardines', 'can',   NULL,  92.0),  -- 1 can drained
    ('sardines', 'oz',    NULL,  28.35),

    -- ── DAIRY ────────────────────────────────────────────────────
    ('milk',         'cup',  NULL, 244.0),
    ('milk',         'tbsp', NULL,  15.3),
    ('milk',         'tsp',  NULL,   5.1),
    ('milk',         'ml',   NULL,   1.03),
    ('milk',         'dl',   NULL, 103.0),
    ('milk',         'l',    NULL, 1030.0),

    ('whole milk',   'cup',  NULL, 244.0),
    ('whole milk',   'tbsp', NULL,  15.3),
    ('whole milk',   'tsp',  NULL,   5.1),
    ('whole milk',   'ml',   NULL,   1.03),
    ('whole milk',   'dl',   NULL, 103.0),
    ('whole milk',   'l',    NULL, 1030.0),

    ('butter',       'tbsp',  NULL,  14.2),
    ('butter',       'tsp',   NULL,   4.7),
    ('butter',       'cup',   NULL, 227.0),
    ('butter',       'stick', NULL, 113.0),  -- US stick of butter
    ('butter',       'oz',    NULL,  28.35),

    ('cheddar cheese', 'cup',  NULL, 113.0),
    ('cheddar cheese', 'oz',   NULL,  28.35),
    ('cheddar cheese', NULL,   'slice', 28.0),
    ('cheddar cheese', NULL,    NULL,   28.0),

    ('mozzarella',   'cup',  NULL, 112.0),
    ('mozzarella',   'oz',   NULL,  28.35),

    ('parmesan',     'cup',  NULL,  80.0),
    ('parmesan',     'tbsp', NULL,   5.0),
    ('parmesan',     'oz',   NULL,  28.35),

    ('yogurt',       'cup',  NULL, 245.0),
    ('yogurt',       'tbsp', NULL,  15.3),
    ('yogurt',       'ml',   NULL,   1.0),

    ('greek yogurt', 'cup',  NULL, 245.0),
    ('greek yogurt', 'tbsp', NULL,  15.3),

    ('cream',        'cup',  NULL, 238.0),
    ('cream',        'tbsp', NULL,  15.0),
    ('cream',        'tsp',  NULL,   5.0),
    ('cream',        'ml',   NULL,   1.0),
    ('cream',        'dl',   NULL, 100.0),

    ('heavy cream',  'cup',  NULL, 238.0),
    ('heavy cream',  'tbsp', NULL,  15.0),
    ('heavy cream',  'tsp',  NULL,   5.0),
    ('heavy cream',  'ml',   NULL,   1.0),
    ('heavy cream',  'dl',   NULL, 100.0),

    ('sour cream',   'cup',  NULL, 230.0),
    ('sour cream',   'tbsp', NULL,  14.4),

    ('cream cheese', 'cup',  NULL, 232.0),
    ('cream cheese', 'tbsp', NULL,  14.5),
    ('cream cheese', 'oz',   NULL,  28.35),

    ('cottage cheese','cup', NULL, 226.0),

    -- ── GRAINS ───────────────────────────────────────────────────
    ('rice',         'cup',  NULL, 185.0),
    ('rice',         'tbsp', NULL,  12.0),
    ('white rice',   'cup',  NULL, 185.0),
    ('brown rice',   'cup',  NULL, 190.0),

    ('pasta',        'cup',  NULL,  91.0),
    ('pasta',        'oz',   NULL,  28.35),
    ('pasta',        'lb',   NULL, 453.6),

    ('bread',        'oz',   NULL,  28.35),
    ('bread',        NULL,   'slice', 30.0),   -- "1 slice bread"
    ('bread',        NULL,    NULL,   30.0),

    ('flour',        'cup',  NULL, 120.0),
    ('flour',        'tbsp', NULL,   7.5),
    ('flour',        'tsp',  NULL,   2.6),
    ('flour',        'oz',   NULL,  28.35),

    ('oats',         'cup',  NULL,  81.0),
    ('oats',         'tbsp', NULL,   5.0),
    ('oats',         'oz',   NULL,  28.35),

    ('quinoa',       'cup',  NULL, 170.0),
    ('quinoa',       'tbsp', NULL,  10.6),

    ('cornstarch',   'tbsp', NULL,   8.0),
    ('cornstarch',   'tsp',  NULL,   2.7),
    ('cornstarch',   'cup',  NULL, 128.0),

    ('breadcrumbs',  'cup',  NULL, 108.0),
    ('breadcrumbs',  'tbsp', NULL,   6.8),

    -- ── VEGETABLES ───────────────────────────────────────────────
    -- whole items with size variants
    ('potato',       NULL,   'small',  140.0),
    ('potato',       NULL,   'medium', 213.0),
    ('potato',       NULL,   'large',  369.0),
    ('potato',       NULL,    NULL,    213.0),   -- default = medium
    ('potato',       'cup',   NULL,    150.0),
    ('potato',       'oz',    NULL,     28.35),
    ('potato',       'lb',    NULL,    453.6),

    ('sweet potato', NULL,   'small',  130.0),
    ('sweet potato', NULL,   'medium', 180.0),
    ('sweet potato', NULL,   'large',  250.0),
    ('sweet potato', NULL,    NULL,    180.0),
    ('sweet potato', 'cup',   NULL,    133.0),

    ('carrot',       NULL,   'small',   50.0),
    ('carrot',       NULL,   'medium',  61.0),
    ('carrot',       NULL,   'large',   72.0),
    ('carrot',       NULL,    NULL,     61.0),
    ('carrot',       'cup',   NULL,    128.0),

    ('onion',        NULL,   'small',   70.0),
    ('onion',        NULL,   'medium', 110.0),
    ('onion',        NULL,   'large',  150.0),
    ('onion',        NULL,    NULL,    110.0),
    ('onion',        'cup',   NULL,    160.0),

    ('red onion',    NULL,   'small',   70.0),
    ('red onion',    NULL,   'medium', 110.0),
    ('red onion',    NULL,   'large',  150.0),
    ('red onion',    NULL,    NULL,    110.0),
    ('red onion',    'cup',   NULL,    160.0),

    ('garlic',       NULL,   'clove',    3.0),   -- "1 clove garlic" → size='clove'
    ('garlic',       NULL,    NULL,       3.0),   -- "1 garlic" → 1 clove
    ('garlic',       'tbsp',  NULL,       9.0),
    ('garlic',       'tsp',   NULL,       3.0),

    ('tomato',       NULL,   'small',   91.0),
    ('tomato',       NULL,   'medium', 123.0),
    ('tomato',       NULL,   'large',  182.0),
    ('tomato',       NULL,    NULL,    123.0),
    ('tomato',       'cup',   NULL,    149.0),

    ('cherry tomato',NULL,    NULL,     17.0),   -- 1 cherry tomato
    ('cherry tomato','cup',   NULL,    149.0),

    ('broccoli',     'cup',   NULL,     91.0),
    ('broccoli',     NULL,   'head',   608.0),
    ('broccoli',     NULL,   'floret',  11.0),
    ('broccoli',     NULL,    NULL,    608.0),   -- "1 broccoli" = 1 head

    ('spinach',      'cup',   NULL,     30.0),   -- raw, loosely packed
    ('spinach',      'oz',    NULL,     28.35),
    ('spinach',      'bag',   NULL,    284.0),   -- standard bag

    ('pepper',       NULL,   'small',   74.0),
    ('pepper',       NULL,   'medium', 119.0),
    ('pepper',       NULL,   'large',  164.0),
    ('pepper',       NULL,    NULL,    119.0),
    ('pepper',       'cup',   NULL,     92.0),

    ('red pepper',   NULL,   'small',   74.0),
    ('red pepper',   NULL,   'medium', 119.0),
    ('red pepper',   NULL,   'large',  164.0),
    ('red pepper',   NULL,    NULL,    119.0),
    ('red pepper',   'cup',   NULL,     92.0),

    ('green pepper', NULL,   'medium', 119.0),
    ('green pepper', NULL,    NULL,    119.0),
    ('green pepper', 'cup',   NULL,     92.0),

    ('cucumber',     NULL,   'small',  150.0),
    ('cucumber',     NULL,   'medium', 201.0),
    ('cucumber',     NULL,   'large',  280.0),
    ('cucumber',     NULL,    NULL,    201.0),
    ('cucumber',     'cup',   NULL,    119.0),

    ('zucchini',     NULL,   'small',  150.0),
    ('zucchini',     NULL,   'medium', 196.0),
    ('zucchini',     NULL,   'large',  323.0),
    ('zucchini',     NULL,    NULL,    196.0),
    ('zucchini',     'cup',   NULL,    124.0),

    ('mushroom',     NULL,   'small',   12.0),
    ('mushroom',     NULL,   'medium',  18.0),
    ('mushroom',     NULL,   'large',   24.0),
    ('mushroom',     NULL,    NULL,     18.0),
    ('mushroom',     'cup',   NULL,     70.0),

    ('celery',       NULL,   'stalk',   40.0),
    ('celery',       NULL,    NULL,     40.0),   -- "1 celery" = 1 stalk
    ('celery',       'cup',   NULL,    120.0),

    ('lettuce',      'cup',   NULL,     36.0),
    ('lettuce',      'head',  NULL,    566.0),
    ('lettuce',      NULL,   'head',   566.0),
    ('lettuce',      NULL,    NULL,    566.0),

    ('kale',         'cup',   NULL,     67.0),
    ('kale',         'oz',    NULL,     28.35),

    ('cauliflower',  'cup',   NULL,    100.0),
    ('cauliflower',  NULL,   'head',   840.0),
    ('cauliflower',  NULL,    NULL,    840.0),

    ('corn',         NULL,   'ear',    100.0),   -- 1 ear of corn (kernels)
    ('corn',         NULL,    NULL,    100.0),
    ('corn',         'cup',   NULL,    154.0),

    ('peas',         'cup',   NULL,    145.0),
    ('peas',         'oz',    NULL,     28.35),

    ('green beans',  'cup',   NULL,    100.0),
    ('green beans',  'oz',    NULL,     28.35),

    ('asparagus',    NULL,   'spear',   20.0),
    ('asparagus',    NULL,    NULL,      20.0),
    ('asparagus',    'cup',   NULL,    134.0),

    ('eggplant',     NULL,   'small',  300.0),
    ('eggplant',     NULL,   'medium', 458.0),
    ('eggplant',     NULL,   'large',  600.0),
    ('eggplant',     NULL,    NULL,    458.0),
    ('eggplant',     'cup',   NULL,     82.0),

    -- ── FRUITS ───────────────────────────────────────────────────
    ('apple',        NULL,   'small',  149.0),
    ('apple',        NULL,   'medium', 182.0),
    ('apple',        NULL,   'large',  223.0),
    ('apple',        NULL,    NULL,    182.0),
    ('apple',        'cup',   NULL,    125.0),

    ('banana',       NULL,   'small',   81.0),
    ('banana',       NULL,   'medium', 118.0),
    ('banana',       NULL,   'large',  136.0),
    ('banana',       NULL,    NULL,    118.0),
    ('banana',       'cup',   NULL,    225.0),

    ('orange',       NULL,   'small',  96.0),
    ('orange',       NULL,   'medium', 131.0),
    ('orange',       NULL,   'large',  184.0),
    ('orange',       NULL,    NULL,    131.0),

    ('strawberry',   NULL,   'small',   8.0),
    ('strawberry',   NULL,   'medium',  12.0),
    ('strawberry',   NULL,   'large',   18.0),
    ('strawberry',   NULL,    NULL,     12.0),
    ('strawberry',   'cup',   NULL,    152.0),

    ('blueberry',    'cup',   NULL,    148.0),
    ('blueberry',    NULL,    NULL,      1.4), -- 1 blueberry

    ('raspberry',    'cup',   NULL,    123.0),
    ('raspberry',    NULL,    NULL,      4.0), -- 1 raspberry

    ('lemon',        NULL,   'small',   58.0),
    ('lemon',        NULL,   'medium',  84.0),
    ('lemon',        NULL,   'large',  108.0),
    ('lemon',        NULL,    NULL,     84.0),
    ('lemon',        'tbsp',  NULL,     15.0),  -- 1 tbsp lemon juice
    ('lemon',        'tsp',   NULL,      5.0),

    ('lime',         NULL,   'small',   44.0),
    ('lime',         NULL,   'medium',  67.0),
    ('lime',         NULL,    NULL,     67.0),
    ('lime',         'tbsp',  NULL,     15.0),

    ('avocado',      NULL,   'small',  136.0),
    ('avocado',      NULL,   'medium', 150.0),
    ('avocado',      NULL,   'large',  200.0),
    ('avocado',      NULL,    NULL,    150.0),
    ('avocado',      'cup',   NULL,    150.0),
    ('avocado',      'tbsp',  NULL,     15.0),

    ('mango',        NULL,   'small',  200.0),
    ('mango',        NULL,   'medium', 336.0),
    ('mango',        NULL,   'large',  400.0),
    ('mango',        NULL,    NULL,    336.0),
    ('mango',        'cup',   NULL,    165.0),

    ('pineapple',    'cup',   NULL,    165.0),
    ('pineapple',    NULL,   'slice',   84.0),
    ('pineapple',    NULL,    NULL,    905.0),  -- 1 whole pineapple

    ('grape',        'cup',   NULL,    151.0),
    ('grape',        NULL,    NULL,      5.0),  -- 1 grape

    ('peach',        NULL,   'small',  130.0),
    ('peach',        NULL,   'medium', 175.0),
    ('peach',        NULL,   'large',  200.0),
    ('peach',        NULL,    NULL,    175.0),

    ('pear',         NULL,   'small',  148.0),
    ('pear',         NULL,   'medium', 178.0),
    ('pear',         NULL,   'large',  230.0),
    ('pear',         NULL,    NULL,    178.0),

    -- ── NUTS & SEEDS ─────────────────────────────────────────────
    ('almonds',      'cup',   NULL,  92.0),
    ('almonds',      'oz',    NULL,  28.35),
    ('almonds',      'tbsp',  NULL,   9.0),
    ('almonds',      NULL,    NULL,   1.2),   -- 1 almond

    ('peanuts',      'cup',   NULL, 146.0),
    ('peanuts',      'oz',    NULL,  28.35),
    ('peanuts',      'tbsp',  NULL,   9.0),

    ('walnuts',      'cup',   NULL, 117.0),
    ('walnuts',      'oz',    NULL,  28.35),
    ('walnuts',      'tbsp',  NULL,   7.5),
    ('walnuts',      NULL,   'half',  2.0),   -- 1 walnut half

    ('cashews',      'cup',   NULL, 137.0),
    ('cashews',      'oz',    NULL,  28.35),
    ('cashews',      'tbsp',  NULL,   8.6),

    ('chia seeds',   'tbsp',  NULL,  12.0),
    ('chia seeds',   'tsp',   NULL,   4.0),
    ('chia seeds',   'cup',   NULL, 160.0),

    ('flax seeds',   'tbsp',  NULL,  10.0),
    ('flax seeds',   'tsp',   NULL,   3.3),

    ('sesame seeds', 'tbsp',  NULL,   9.0),
    ('sesame seeds', 'tsp',   NULL,   3.0),
    ('sesame seeds', 'cup',   NULL, 144.0),

    ('sunflower seeds','cup', NULL, 128.0),
    ('sunflower seeds','oz',  NULL,  28.35),
    ('sunflower seeds','tbsp',NULL,   9.0),

    ('peanut butter','tbsp',  NULL,  16.0),
    ('peanut butter','tsp',   NULL,   5.3),
    ('peanut butter','cup',   NULL, 258.0),
    ('peanut butter','oz',    NULL,  28.35),

    ('almond butter','tbsp',  NULL,  16.0),
    ('almond butter','tsp',   NULL,   5.3),
    ('almond butter','cup',   NULL, 258.0),

    -- ── LEGUMES ──────────────────────────────────────────────────
    ('chickpeas',    'cup',  NULL, 164.0),
    ('chickpeas',    'can',  NULL, 400.0),  -- 1 standard can (drained ~240g)
    ('chickpeas',    'oz',   NULL,  28.35),

    ('lentils',      'cup',  NULL, 192.0),

    ('black beans',  'cup',  NULL, 172.0),
    ('black beans',  'can',  NULL, 400.0),

    ('kidney beans', 'cup',  NULL, 177.0),
    ('kidney beans', 'can',  NULL, 400.0),

    -- ── BASIC INGREDIENTS ────────────────────────────────────────
    ('salt',         'tsp',  NULL,   6.0),
    ('salt',         'tbsp', NULL,  18.0),
    ('salt',         'cup',  NULL, 288.0),
    ('salt',         'pinch',NULL,   0.3),

    ('sugar',        'tsp',  NULL,   4.2),
    ('sugar',        'tbsp', NULL,  12.5),
    ('sugar',        'cup',  NULL, 200.0),

    ('brown sugar',  'tsp',  NULL,   4.6),
    ('brown sugar',  'tbsp', NULL,  13.8),
    ('brown sugar',  'cup',  NULL, 220.0),  -- packed

    ('powdered sugar','tsp', NULL,   2.5),
    ('powdered sugar','tbsp',NULL,   7.5),
    ('powdered sugar','cup', NULL, 120.0),

    ('honey',        'tsp',  NULL,   7.0),
    ('honey',        'tbsp', NULL,  21.0),
    ('honey',        'cup',  NULL, 340.0),

    ('maple syrup',  'tsp',  NULL,   6.7),
    ('maple syrup',  'tbsp', NULL,  20.0),
    ('maple syrup',  'cup',  NULL, 322.0),

    ('olive oil',    'tsp',  NULL,   4.5),
    ('olive oil',    'tbsp', NULL,  13.5),
    ('olive oil',    'cup',  NULL, 216.0),
    ('olive oil',    'ml',   NULL,   0.91),
    ('olive oil',    'dl',   NULL,  91.0),

    ('vegetable oil','tsp',  NULL,   4.5),
    ('vegetable oil','tbsp', NULL,  14.0),
    ('vegetable oil','cup',  NULL, 218.0),
    ('vegetable oil','ml',   NULL,   0.92),
    ('vegetable oil','dl',   NULL,  92.0),

    ('coconut oil',  'tsp',  NULL,   4.5),
    ('coconut oil',  'tbsp', NULL,  13.6),
    ('coconut oil',  'cup',  NULL, 218.0),

    ('vinegar',      'tsp',  NULL,   5.0),
    ('vinegar',      'tbsp', NULL,  15.0),
    ('vinegar',      'cup',  NULL, 240.0),
    ('vinegar',      'ml',   NULL,   1.0),

    ('apple cider vinegar','tsp', NULL,  5.0),
    ('apple cider vinegar','tbsp',NULL, 15.0),

    ('soy sauce',    'tsp',  NULL,   5.7),
    ('soy sauce',    'tbsp', NULL,  17.0),
    ('soy sauce',    'cup',  NULL, 272.0),

    ('fish sauce',   'tsp',  NULL,   5.3),
    ('fish sauce',   'tbsp', NULL,  16.0),

    ('worcestershire','tsp', NULL,   5.7),
    ('worcestershire','tbsp',NULL,  17.0),

    ('hot sauce',    'tsp',  NULL,   5.0),
    ('hot sauce',    'tbsp', NULL,  15.0),

    ('tomato paste', 'tbsp', NULL,  16.0),
    ('tomato paste', 'tsp',  NULL,   5.3),
    ('tomato paste', 'cup',  NULL, 262.0),
    ('tomato paste', 'can',  NULL, 170.0),  -- small can (6oz)

    ('tomato sauce', 'cup',  NULL, 245.0),
    ('tomato sauce', 'tbsp', NULL,  15.3),
    ('tomato sauce', 'can',  NULL, 411.0),  -- 14.5oz can

    ('coconut milk', 'cup',  NULL, 240.0),
    ('coconut milk', 'tbsp', NULL,  15.0),
    ('coconut milk', 'can',  NULL, 400.0),

    ('vegetable broth','cup',  NULL, 240.0),
    ('vegetable broth','tbsp', NULL,  15.0),
    ('vegetable broth','ml',   NULL,   1.0),
    ('vegetable broth','dl',   NULL, 100.0),
    ('vegetable broth','l',    NULL, 1000.0),

    ('chicken broth','cup',  NULL, 240.0),
    ('chicken broth','tbsp', NULL,  15.0),
    ('chicken broth','ml',   NULL,   1.0),
    ('chicken broth','dl',   NULL, 100.0),
    ('chicken broth','l',    NULL, 1000.0),

    ('beef broth',   'cup',  NULL, 240.0),
    ('beef broth',   'tbsp', NULL,  15.0),
    ('beef broth',   'ml',   NULL,   1.0),
    ('beef broth',   'dl',   NULL, 100.0),
    ('beef broth',   'l',    NULL, 1000.0),

    ('baking powder','tsp',  NULL,   4.0),
    ('baking powder','tbsp', NULL,  12.0),

    ('baking soda',  'tsp',  NULL,   6.0),
    ('baking soda',  'tbsp', NULL,  18.0),

    -- ── SPICES & HERBS ────────────────────────────────────────────
    -- spices are always tsp/tbsp
    ('black pepper', 'tsp',  NULL,   2.3),
    ('black pepper', 'tbsp', NULL,   6.9),
    ('black pepper', 'pinch',NULL,   0.3),

    ('paprika',      'tsp',  NULL,   2.3),
    ('paprika',      'tbsp', NULL,   6.8),

    ('cumin',        'tsp',  NULL,   2.1),
    ('cumin',        'tbsp', NULL,   6.3),

    ('basil',        'tsp',  NULL,   0.7),
    ('basil',        'tbsp', NULL,   2.1),
    ('basil',        'cup',  NULL,  24.0),   -- fresh basil
    ('basil',        NULL,   'leaf', 0.5),   -- 1 basil leaf

    ('oregano',      'tsp',  NULL,   1.0),
    ('oregano',      'tbsp', NULL,   3.0),

    ('thyme',        'tsp',  NULL,   0.8),
    ('thyme',        'tbsp', NULL,   2.4),
    ('thyme',        NULL,  'sprig', 0.5),   -- 1 sprig of thyme

    ('rosemary',     'tsp',  NULL,   1.2),
    ('rosemary',     'tbsp', NULL,   3.5),
    ('rosemary',     NULL,  'sprig', 1.5),

    ('parsley',      'tsp',  NULL,   0.5),
    ('parsley',      'tbsp', NULL,   1.5),
    ('parsley',      'cup',  NULL,  60.0),

    ('cinnamon',     'tsp',  NULL,   2.6),
    ('cinnamon',     'tbsp', NULL,   7.8),

    ('turmeric',     'tsp',  NULL,   3.0),
    ('turmeric',     'tbsp', NULL,   9.0),

    ('ginger',       'tsp',  NULL,   2.0),
    ('ginger',       'tbsp', NULL,   6.0),
    ('ginger',       NULL,  'inch',  11.0),  -- 1 inch fresh ginger knob

    ('chili powder', 'tsp',  NULL,   2.5),
    ('chili powder', 'tbsp', NULL,   7.5),

    ('garlic powder','tsp',  NULL,   3.1),
    ('garlic powder','tbsp', NULL,   9.3),

    ('onion powder', 'tsp',  NULL,   2.4),
    ('onion powder', 'tbsp', NULL,   7.2),

    ('cayenne pepper','tsp', NULL,   1.8),
    ('cayenne pepper','tbsp',NULL,   5.4),
    ('cayenne pepper','pinch',NULL,  0.2),

    ('bay leaves',   NULL,   'leaf',  0.2),
    ('bay leaves',   NULL,    NULL,   0.2),

    ('dill',         'tsp',  NULL,   1.0),
    ('dill',         'tbsp', NULL,   3.0),

    ('chives',       'tbsp', NULL,   3.0),
    ('chives',       'tsp',  NULL,   1.0),

    -- ── CONDIMENTS & OTHER ───────────────────────────────────────
    ('chocolate',    'oz',   NULL,  28.35),
    ('chocolate',    'cup',  NULL, 168.0),
    ('chocolate',    NULL,  'square', 10.0),  -- 1 square of chocolate

    ('dark chocolate','oz',  NULL,  28.35),
    ('dark chocolate','cup', NULL, 168.0),
    ('dark chocolate',NULL, 'square',10.0),

    ('cocoa powder', 'tbsp', NULL,   7.4),
    ('cocoa powder', 'tsp',  NULL,   2.5),
    ('cocoa powder', 'cup',  NULL, 118.0),

    ('vanilla extract','tsp', NULL,  4.2),
    ('vanilla extract','tbsp',NULL, 13.0),

    ('ketchup',      'tsp',  NULL,   5.7),
    ('ketchup',      'tbsp', NULL,  17.0),
    ('ketchup',      'cup',  NULL, 272.0),

    ('mayonnaise',   'tsp',  NULL,   4.6),
    ('mayonnaise',   'tbsp', NULL,  13.8),
    ('mayonnaise',   'cup',  NULL, 220.0),

    ('mustard',      'tsp',  NULL,   5.0),
    ('mustard',      'tbsp', NULL,  15.0),

    ('ranch dressing','tbsp',NULL,  15.0),
    ('ranch dressing','cup', NULL, 245.0),

    ('bbq sauce',    'tbsp', NULL,  17.0),
    ('bbq sauce',    'cup',  NULL, 272.0),

    ('salsa',        'tbsp', NULL,  16.0),
    ('salsa',        'cup',  NULL, 256.0),

    ('hummus',       'tbsp', NULL,  15.0),
    ('hummus',       'cup',  NULL, 246.0),
    ('hummus',       'oz',   NULL,  28.35)

) AS u(name, unit, size, grams_per_unit)
ON ing.name = u.name
ON CONFLICT (ingredient_id, unit, size) DO NOTHING;
