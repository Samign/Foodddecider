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

export function init(targetElement) {
    console.log("suggestions.js loaded");
    document.addEventListener("input", async function(e) {
        if (!e.target.classList.contains("ingredient-text")) return;
        const raw = e.target.value.trim();

        const { query } = parseIngredientInput(raw);
        if (query.length < 2) return clearSuggestions(e.target);

        const res = await fetch(`/api/search_ingredients.php?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        showSuggestions(e.target, data, raw, query);
    });

    document.addEventListener("keydown", function(e) {
        if (!e.target.classList.contains("ingredient-text")) return;
        const list = getList(e.target);
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
            const target = active ?? items[0];
            if (target) {
                e.preventDefault();
                target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            }
        } else if (e.key === "Escape") {
            clearSuggestions(e.target);
        }
    });

    document.addEventListener("click", function(e) {
        if (!e.target.classList.contains("ingredient-text")) {
            document.querySelectorAll(".autocomplete-list").forEach(l => l.innerHTML = "");
        }
    });
};

function showSuggestions(input, items, raw, ingredientQuery) {
    const list = getList(input);
    list.innerHTML = "";
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
    return input.parentElement.parentElement.querySelector(".autocomplete-list");
}

function clearSuggestions(input) {
    getList(input).innerHTML = "";
}