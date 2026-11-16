const COMMON_UNITS = ["g", "kg", "ml", "dl", "l", "oz", "lb", "cup", "tbsp", "tsp",
                      "pinch", "slice", "can", "clove", "sprig", "fillet", "stick",
                      "gram", "grams", "kilogram", "kilograms", "liter", "liters"];

function parseIngredientInput(raw) {
    const match = raw.match(/^(\d+[\d.,/]*\s*)?\s*([a-zA-Z]+\s*)?\s*(.+)?$/);
    if (!match) return { amount: null, unit: null, query: raw.trim() };

    const maybeUnit = match[2]?.trim().toLowerCase();
    const isUnit = COMMON_UNITS.includes(maybeUnit);

    return {
        amount: match[1]?.trim() ?? null,
        unit:   isUnit ? maybeUnit : null,
        query:  isUnit
            ? (match[3]?.trim() ?? '')
            : ((match[2] ?? '') + (match[3] ?? '')).trim()
    };
}

let initialized = false;
const DEBOUNCE_MS = 150;
const timers     = new WeakMap();   // input -> debounce timer
const requestIds = new WeakMap();   // input -> latest request number

// Filter inputs hold only a name: no amount/unit parsing, no hidden ids
const isPlain = input => !!input.closest('[data-plain-ingredients]');

export function init() {
    if (initialized) return;        // safe to call from more than one page script
    initialized = true;

    document.addEventListener("input", function (e) {
        const input = e.target;
        if (!input.classList?.contains("ingredient-text")) return;

        const raw = input.value.trim();
        const query = isPlain(input) ? raw : parseIngredientInput(raw).query;

        clearTimeout(timers.get(input));
        if (query.length < 2) {
            requestIds.set(input, (requestIds.get(input) ?? 0) + 1);   // drop in-flight replies
            return clearSuggestions(input);
        }
        timers.set(input, setTimeout(() => fetchSuggestions(input, raw, query), DEBOUNCE_MS));
    });

    document.addEventListener("keydown", function (e) {
        if (!e.target.classList?.contains("ingredient-text")) return;
        const list = getList(e.target);
        if (!list) return;

        const items = list.querySelectorAll(".autocomplete-item");
        const active = list.querySelector(".autocomplete-item.active");

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!active) {
                items[0]?.classList.add("active");
            } else {
                active.classList.remove("active");
                (active.nextElementSibling ?? items[0]).classList.add("active");
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!active) {
                items[items.length - 1]?.classList.add("active");
            } else {
                active.classList.remove("active");
                (active.previousElementSibling ?? items[items.length - 1]).classList.add("active");
            }
        } else if (e.key === "Tab" || e.key === "Enter") {
            // Add menu: unchanged (falls back to the first item).
            // Filter: only a highlighted item is accepted; otherwise typed text stands.
            const target = active ?? (isPlain(e.target) ? null : items[0]);
            if (target) {
                e.preventDefault();
                target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            }
        } else if (e.key === "Escape") {
            clearSuggestions(e.target);
        }
    });

    document.addEventListener("click", function (e) {
        if (!e.target.classList?.contains("ingredient-text")) {
            document.querySelectorAll(".autocomplete-list").forEach(l => l.replaceChildren());
        }
    });
}

async function fetchSuggestions(input, raw, query) {
    const id = (requestIds.get(input) ?? 0) + 1;
    requestIds.set(input, id);
    try {
        const res = await fetch(`/api/search_ingredients.php?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (requestIds.get(input) !== id) return;      // a newer keystroke superseded this reply
        showSuggestions(input, data, raw, query);
    } catch (err) {
        console.error("Ingredient suggestions failed:", err);
    }
}

function showSuggestions(input, items, raw, ingredientQuery) {
    const list = getList(input);
    if (!list) return;
    list.replaceChildren();
    if (!items.length) return;

    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "autocomplete-item";

        const name = document.createElement("span");
        name.className = "autocomplete-name";
        name.textContent = item.name;
        div.appendChild(name);

        div.addEventListener("mousedown", (e) => {
            e.preventDefault();
            selectIngredient(input, item, raw, ingredientQuery);
        });

        list.appendChild(div);
    });
}

function selectIngredient(input, item, raw, ingredientQuery) {
    if (isPlain(input)) {              // filter: just the name
        input.value = item.name;
        clearSuggestions(input);
        return;
    }

    const lowerRaw = raw.toLowerCase();
    const lowerQuery = ingredientQuery.toLowerCase();
    const idx = lowerRaw.lastIndexOf(lowerQuery);
    const prefix = idx >= 0 ? raw.slice(0, idx) : '';
    input.value = prefix + item.name;
    input.dataset.ingredientId = item.id;

    const prev = input.parentElement.querySelector('input[name="ingredient_ids[]"]');
    if (prev) prev.remove();

    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "ingredient_ids[]";
    hidden.value = item.id;
    input.parentElement.appendChild(hidden);

    clearSuggestions(input);
}

function getList(input) {
    // the row's own list first (filter), then the old grandparent lookup (add menu)
    return input.parentElement.querySelector(".autocomplete-list")
        ?? input.parentElement.parentElement.querySelector(".autocomplete-list");
}

function clearSuggestions(input) {
    getList(input)?.replaceChildren();
}