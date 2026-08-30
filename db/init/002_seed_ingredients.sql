-- ============================================================
-- 002_seed_ingredients.sql
-- Lookup seed data + ingredients + aliases
-- ============================================================

-- ── Course types ──────────────────────────────────────────────
INSERT INTO course_types (name, display_order) VALUES
    ('breakfast', 1),
    ('brunch',    2),
    ('lunch',     3),
    ('dinner',    4),
    ('dessert',   5),
    ('snack',     6),
    ('sauce',     7),
    ('drink',     8)
ON CONFLICT (name) DO NOTHING;

-- ── Attributes ────────────────────────────────────────────────
INSERT INTO tags (name, slug, is_featured, display_order) VALUES
    ('Vegan',        'vegan',        true,  1),
    ('Quick',        'quick',        true,  2),
    ('Vegetarian',   'vegetarian',   true,  3),
    ('Gluten-Free',  'gluten-free',  true,  4),
    ('High Protein', 'high-protein', true,  5),
    ('Dairy-Free',   'dairy-free',   true,  6),
    ('Low-Carb',     'low-carb',     true,  7)
ON CONFLICT DO NOTHING;

-- ── Ingredients ───────────────────────────────────────────────
-- INSERT INTO ingredients (name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g) VALUES

-- -- MEAT
-- ('chicken breast', 165,   31,    0,    3.6),
-- ('chicken thigh',  165,   31,    0,    3.6),
-- ('ground beef',    250,   26,    0,   15.0),
-- ('pork',           242,   27,    0,   14.0),
-- ('bacon',          541,   37,    1.4, 42.0),
-- ('ham',            145,   20,    1.5,  6.0),
-- ('turkey',         189,   29,    0,    7.0),
-- ('lamb',           294,   25,    0,   21.0),
-- ('sausage',        301,   14,    2.4, 26.0),

-- -- FISH & SEAFOOD
-- ('salmon',         208,   20,    0,   13.0),
-- ('tuna',           132,   28,    0,    1.0),
-- ('cod',             82,   18,    0,    0.7),
-- ('shrimp',          99,   24,    0.2,  0.3),
-- ('tilapia',        128,   26,    0,    2.7),
-- ('sardines',       208,   25,    0,   11.0),

-- -- DAIRY & EGGS
-- ('egg',            155,   13,    1.1, 11.0),
-- ('milk',            42,    3.4,  5.0,  1.0),
-- ('whole milk',      60,    3.2,  5.0,  3.3),
-- ('butter',         717,    0.9,  0.1, 81.0),
-- ('cheddar cheese', 403,   25,    1.3, 33.0),
-- ('mozzarella',     280,   28,    3.0, 17.0),
-- ('parmesan',       431,   38,    4.1, 29.0),
-- ('yogurt',          59,   10,    3.6,  0.4),
-- ('greek yogurt',    97,   10,    3.6,  5.0),
-- ('cream',          340,    2,    3.0, 36.0),
-- ('heavy cream',    345,    2.1,  2.8, 37.0),
-- ('sour cream',     198,    2.4,  4.6, 19.0),
-- ('cream cheese',   342,    6,    4.1, 34.0),
-- ('cottage cheese',  98,   11,    3.4,  4.3),

-- -- GRAINS & BREAD
-- ('rice',           130,    2.7, 28.0,  0.3),
-- ('white rice',     130,    2.7, 28.0,  0.3),
-- ('brown rice',     111,    2.6, 23.0,  0.9),
-- ('pasta',          131,    5,   25.0,  1.1),
-- ('bread',          265,    9,   49.0,  3.2),
-- ('white bread',    267,    9,   51.0,  3.3),
-- ('sourdough',      269,   10,   51.0,  1.2),
-- ('flour',          364,   10,   76.0,  1.0),
-- ('oats',           389,   17,   66.0,  7.0),
-- ('quinoa',         120,    4.4, 21.0,  1.9),
-- ('cornstarch',     381,    0.3, 91.0,  0.1),
-- ('breadcrumbs',    395,   13,   72.0,  5.3),

-- -- VEGETABLES
-- ('potato',          77,    2,   17.0,  0.1),
-- ('sweet potato',    86,    1.6, 20.0,  0.1),
-- ('carrot',          41,    0.9, 10.0,  0.2),
-- ('onion',           40,    1.1,  9.0,  0.1),
-- ('red onion',       40,    1.1,  9.4,  0.1),
-- ('garlic',         149,    6.4, 33.0,  0.5),
-- ('tomato',          18,    0.9,  3.9,  0.2),
-- ('cherry tomato',   18,    0.9,  3.9,  0.2),
-- ('broccoli',        34,    2.8,  7.0,  0.4),
-- ('spinach',         23,    2.9,  3.6,  0.4),
-- ('pepper',          31,    1,    6.0,  0.3),
-- ('red pepper',      31,    1,    6.0,  0.3),
-- ('green pepper',    20,    0.9,  4.6,  0.2),
-- ('cucumber',        16,    0.7,  3.6,  0.1),
-- ('zucchini',        17,    1.2,  3.1,  0.3),
-- ('mushroom',        22,    3.1,  3.3,  0.3),
-- ('celery',          16,    0.7,  3.0,  0.2),
-- ('lettuce',         15,    1.4,  2.9,  0.2),
-- ('kale',            49,    4.3,  9.0,  0.9),
-- ('cauliflower',     25,    1.9,  5.0,  0.3),
-- ('corn',            86,    3.2, 19.0,  1.2),
-- ('peas',            81,    5.4, 14.0,  0.4),
-- ('green beans',     31,    1.8,  7.0,  0.1),
-- ('asparagus',       20,    2.2,  3.9,  0.1),
-- ('eggplant',        25,    1,    6.0,  0.2),

-- -- FRUITS
-- ('apple',           52,    0.3, 14.0,  0.2),
-- ('banana',          89,    1.1, 23.0,  0.3),
-- ('orange',          47,    0.9, 12.0,  0.1),
-- ('strawberry',      32,    0.7,  8.0,  0.3),
-- ('blueberry',       57,    0.7, 14.0,  0.3),
-- ('raspberry',       52,    1.2, 12.0,  0.7),
-- ('lemon',           29,    1.1,  9.0,  0.3),
-- ('lime',            30,    0.7, 11.0,  0.2),
-- ('avocado',        160,    2,    9.0, 15.0),
-- ('mango',           60,    0.8, 15.0,  0.4),
-- ('pineapple',       50,    0.5, 13.0,  0.1),
-- ('grape',           69,    0.7, 18.0,  0.2),
-- ('peach',           39,    0.9, 10.0,  0.3),
-- ('pear',            57,    0.4, 15.0,  0.1),

-- -- NUTS & SEEDS
-- ('almonds',        579,   21,   22.0, 50.0),
-- ('peanuts',        567,   26,   16.0, 49.0),
-- ('walnuts',        654,   15,   14.0, 65.0),
-- ('cashews',        553,   18,   30.0, 44.0),
-- ('chia seeds',     486,   17,   42.0, 31.0),
-- ('flax seeds',     534,   18,   29.0, 42.0),
-- ('sesame seeds',   573,   18,   23.0, 50.0),
-- ('sunflower seeds',584,   21,   20.0, 51.0),
-- ('peanut butter',  588,   25,   20.0, 50.0),
-- ('almond butter',  614,   21,   19.0, 56.0),

-- -- LEGUMES
-- ('chickpeas',      164,    8.9, 27.0,  2.6),
-- ('lentils',        116,    9,   20.0,  0.4),
-- ('black beans',    132,    8.9, 24.0,  0.5),
-- ('kidney beans',   127,    8.7, 23.0,  0.5),

-- -- BASIC INGREDIENTS
-- ('salt',             0,    0,    0,    0),
-- ('sugar',          387,    0,  100.0,  0),
-- ('brown sugar',    380,    0,   98.0,  0),
-- ('powdered sugar', 389,    0,  100.0,  0),
-- ('honey',          304,    0.3, 82.0,  0),
-- ('maple syrup',    260,    0,   67.0,  0.1),
-- ('olive oil',      884,    0,    0,  100.0),
-- ('vegetable oil',  884,    0,    0,  100.0),
-- ('coconut oil',    862,    0,    0,  100.0),
-- ('vinegar',         21,    0,    0.9,  0),
-- ('apple cider vinegar', 21, 0,   0.9,  0),
-- ('soy sauce',       53,    8,    5.0,  0),
-- ('fish sauce',      35,    5,    3.6,  0),
-- ('worcestershire',  78,    0,   18.0,  0),
-- ('hot sauce',       31,    1.4,  5.5,  0.5),
-- ('tomato paste',    82,    4.3, 18.9,  0.5),
-- ('tomato sauce',    29,    1.5,  6.3,  0.2),
-- ('coconut milk',   197,    2,    6.0, 21.0),
-- ('vegetable broth', 12,    0.2,  2.5,  0.2),
-- ('chicken broth',   15,    1.5,  1.4,  0.5),
-- ('beef broth',      17,    2.7,  0.1,  0.6),
-- ('baking powder',  255,    0,   67.0,  0),
-- ('baking soda',      0,    0,    0,    0),

-- -- SPICES & HERBS
-- ('black pepper',   251,   10,   64.0,  3.0),
-- ('paprika',        282,   14,   54.0, 13.0),
-- ('cumin',          375,   18,   44.0, 22.0),
-- ('basil',           23,    3.2,  2.7,  0.6),
-- ('oregano',        265,    9,   69.0,  4.0),
-- ('thyme',          101,    5.6, 24.0,  1.7),
-- ('rosemary',       131,    3.3, 21.0,  5.9),
-- ('parsley',         36,    3,    6.0,  0.8),
-- ('cinnamon',       247,    4,   81.0,  1.2),
-- ('turmeric',       354,    8,   65.0, 10.0),
-- ('ginger',          80,    1.8, 18.0,  0.8),
-- ('chili powder',   282,   13,   50.0, 14.0),
-- ('garlic powder',  331,   17,   73.0,  0.7),
-- ('onion powder',   341,   10,   79.0,  1.0),
-- ('cayenne pepper', 318,   12,   57.0, 17.0),
-- ('bay leaves',     313,    7.6, 75.0,  8.4),
-- ('dill',            43,    3.5,  7.0,  1.1),
-- ('chives',          30,    3.3,  4.4,  0.7),

-- -- CONDIMENTS & SAUCES
-- ('chocolate',      546,    4.9, 61.0, 31.0),
-- ('dark chocolate', 598,    7.8, 46.0, 43.0),
-- ('cocoa powder',   228,   20,   58.0, 14.0),
-- ('vanilla extract',288,    0,   13.0,  0),
-- ('ketchup',        112,    1.3, 27.0,  0.2),
-- ('mayonnaise',     680,    1,    1.0, 75.0),
-- ('mustard',         66,    4.4,  5.8,  4.0),
-- ('ranch dressing', 460,    1.5,  4.5, 48.0),
-- ('bbq sauce',      172,    1.7, 40.0,  0.9),
-- ('salsa',           36,    1.9,  7.3,  0.2),
-- ('hummus',         177,    8,   20.0,  8.0)

-- ON CONFLICT (name) DO NOTHING;

-- -- ── Aliases ───────────────────────────────────────────────────
-- INSERT INTO ingredient_aliases (ingredient_id, alias)
-- SELECT id, alias FROM ingredients
-- JOIN (VALUES
--     -- egg
--     ('egg', 'eggs'),
--     ('egg', 'whole egg'),
--     ('egg', 'large egg'),
--     -- milk
--     ('milk', 'milk whole'),
--     ('milk', 'skim milk'),
--     ('milk', '2% milk'),
--     -- flour
--     ('flour', 'all purpose flour'),
--     ('flour', 'all-purpose flour'),
--     ('flour', 'plain flour'),
--     ('flour', 'ap flour'),
--     -- sugar
--     ('sugar', 'white sugar'),
--     ('sugar', 'granulated sugar'),
--     ('sugar', 'caster sugar'),
--     -- brown sugar
--     ('brown sugar', 'brown sugar packed'),
--     ('brown sugar', 'packed brown sugar'),
--     -- olive oil
--     ('olive oil', 'extra virgin olive oil'),
--     ('olive oil', 'olive oil extra virgin'),
--     ('olive oil', 'evoo'),
--     -- tomato
--     ('tomato', 'tomatoes'),
--     ('tomato', 'fresh tomato'),
--     ('tomato', 'chopped tomato'),
--     ('tomato', 'diced tomato'),
--     -- onion
--     ('onion', 'yellow onion'),
--     ('onion', 'white onion'),
--     -- garlic
--     ('garlic', 'fresh garlic'),
--     ('garlic', 'minced garlic'),
--     -- chicken breast
--     ('chicken breast', 'chicken'),
--     ('chicken breast', 'chicken breasts'),
--     -- pepper
--     ('pepper', 'bell pepper'),
--     ('pepper', 'capsicum'),
--     -- butter
--     ('butter', 'unsalted butter'),
--     ('butter', 'salted butter'),
--     -- cream
--     ('heavy cream', 'whipping cream'),
--     ('heavy cream', 'double cream'),
--     -- pasta
--     ('pasta', 'spaghetti'),
--     ('pasta', 'penne'),
--     ('pasta', 'fettuccine'),
--     ('pasta', 'linguine'),
--     -- peanut butter
--     ('peanut butter', 'pb'),
--     -- lemon
--     ('lemon', 'lemon juice'),
--     -- vanilla extract
--     ('vanilla extract', 'vanilla'),
--     -- black pepper
--     ('black pepper', 'pepper'),
--     ('black pepper', 'ground pepper'),
--     -- vegetable broth
--     ('vegetable broth', 'veggie broth'),
--     ('vegetable broth', 'vegetable stock'),
--     -- chicken broth
--     ('chicken broth', 'chicken stock'),
--     -- beef broth
--     ('beef broth', 'beef stock')
-- ) AS a(ingredient_name, alias)
-- ON ingredients.name = a.ingredient_name
-- ON CONFLICT (alias) DO NOTHING;
