// assets/hero-filters.js
//
// The quick filters on the home page (From / How long / What kind / I have / Tags).
// They don't fetch anything themselves: each chip writes into #filter-form, the same
// form the "Ingredients and nutrition" modal uses, and then submits it. recipes.js
// stays the one place that loads recipes, and both UIs always agree.

import { toggleTag, isTagSelected } from './tags.js';
import { escapeHtml } from './recipe-cards.js';

const SCOPES = {                       // active category button -> wording key in the PHP data- attributes
    'all-recipes': 'any',
    'personal-recipes': 'mine',
    'friends-recipes': 'follow',
    'public-recipes': 'all',
};
const DEBOUNCE_MS = 150;

let hero, form;

export function init(element) {
    hero = element;
    form = document.getElementById('filter-form');
    if (!form || hero.dataset.bound) return;
    hero.dataset.bound = '1';

    bindTime();
    bindCourses();
    bindIngredients();
    bindTags();
    bindScope();

    form.addEventListener('reset', () => setTimeout(syncAll, 0));   // the modal's "Clear filters"
    document.addEventListener('recipesLoaded', e => {
        showCount(e.detail.count);
        syncScope();      // the tabs may have been built after init ran
    });

    // Cmd/Ctrl+K jumps to the header search
    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            document.getElementById('q')?.focus();
        }
    });

    // "Clear filters" in the empty state
    document.getElementById('recipe-list')?.addEventListener('click', e => {
        if (e.target.closest('.empty-clear')) form.reset();
    });

    syncScope();
    const list = document.getElementById('recipe-list');
    if (list?.dataset.count) showCount(Number(list.dataset.count));   // first load may have finished already
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const apply = () => form.requestSubmit();

function press(chip, on) {
    chip.setAttribute('aria-pressed', String(on));
}

function chip(label, data = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = label;
    Object.assign(b.dataset, data);
    press(b, false);
    return b;
}

// ── How long: one at a time, always total time ────────────────────────────────

function bindTime() {
    const row = hero.querySelector('#r-time');
    row?.addEventListener('click', e => {
        const c = e.target.closest('[data-time]');
        if (!c) return;
        const on = c.getAttribute('aria-pressed') !== 'true';
        row.querySelectorAll('[data-time]').forEach(x => press(x, false));
        press(c, on);

        form.querySelector('#time').value = on ? c.dataset.time : '';
        form.querySelector('#include_cook_time').checked = on;
        apply();
    });
}

// ── What kind: clicks the matching pill in the filter modal so recipes.js keeps one selection ──

function bindCourses() {
    hero.querySelector('#r-course')?.addEventListener('click', e => {
        const c = e.target.closest('[data-course]');
        if (!c) return;
        const pill = form.querySelector(`.course-types-container [data-id="${c.dataset.course}"]`);
        if (!pill) return;                                   // metadata not loaded yet
        pill.click();
        syncCourses();
        apply();
    });
}

function syncCourses() {
    const selected = new Set((form.querySelector('#selected-course').value || '').split(',').filter(Boolean));
    hero.querySelectorAll('[data-course]').forEach(c => press(c, selected.has(c.dataset.course)));
}

// ── I have: fills the modal's ingredient rows, "any" unless the user asks for all ──

function bindIngredients() {
    const row = hero.querySelector('#r-ing');
    const allChip = hero.querySelector('#ing-all');
    const input = hero.querySelector('#iq');
    const list = hero.querySelector('.ing-search .autocomplete-list');
    if (!row) return;

    row.addEventListener('click', e => {
        const c = e.target.closest('[data-ing]');
        if (!c) return;
        press(c, c.getAttribute('aria-pressed') !== 'true');
        writeIngredients();
    });

    allChip?.addEventListener('click', () => {
        press(allChip, allChip.getAttribute('aria-pressed') !== 'true');
        writeIngredients();
    });

    const add = name => {
        name = name.trim();
        if (!name) return;
        let c = [...row.querySelectorAll('[data-ing]')]
            .find(x => x.dataset.ing.toLowerCase() === name.toLowerCase());
        if (!c) {
            c = chip(name[0].toUpperCase() + name.slice(1), { ing: name });
            row.appendChild(c);
        }
        press(c, true);
        input.value = '';
        list.replaceChildren();
        writeIngredients();
    };

    // Autocomplete from the ingredients table
    let timer = 0, req = 0, active = -1;
    const items = () => [...list.querySelectorAll('.autocomplete-item')];
    const highlight = i => {
        active = i;
        items().forEach((el, n) => el.classList.toggle('active', n === i));
    };

    input?.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (q.length < 2) { list.replaceChildren(); return; }
        timer = setTimeout(async () => {
            const mine = ++req;
            try {
                const res = await fetch(`/api/search_ingredients.php?q=${encodeURIComponent(q)}`);
                const rows = await res.json();
                if (mine !== req) return;
                list.innerHTML = rows.map(r =>
                    `<div class="autocomplete-item" data-name="${escapeHtml(r.name)}"><span class="autocomplete-name">${escapeHtml(r.name)}</span></div>`
                ).join('');
                active = -1;
            } catch { list.replaceChildren(); }
        }, DEBOUNCE_MS);
    });

    input?.addEventListener('keydown', e => {
        const all = items();
        if (e.key === 'ArrowDown' && all.length) { e.preventDefault(); highlight((active + 1) % all.length); }
        else if (e.key === 'ArrowUp' && all.length) { e.preventDefault(); highlight((active - 1 + all.length) % all.length); }
        else if (e.key === 'Enter') { e.preventDefault(); add(all[active]?.dataset.name ?? input.value); }
        else if (e.key === 'Escape') list.replaceChildren();
    });

    list?.addEventListener('mousedown', e => {          // mousedown so it fires before the input blurs
        const item = e.target.closest('.autocomplete-item');
        if (item) { e.preventDefault(); add(item.dataset.name); }
    });
    input?.addEventListener('blur', () => setTimeout(() => list.replaceChildren(), 100));
}

function writeIngredients() {
    const chosen = [...hero.querySelectorAll('#r-ing [data-ing][aria-pressed="true"]')].map(c => c.dataset.ing);
    const allChip = hero.querySelector('#ing-all');
    if (allChip) {
        allChip.hidden = chosen.length < 2;
        if (allChip.hidden) press(allChip, false);
    }

    // Rebuild the modal's ingredient rows from the chips (keep at least one empty row)
    const rows = form.querySelector('#ingredient-list');
    const template = rows.querySelector('.ingredient-item');
    const values = chosen.length ? chosen : [''];
    rows.replaceChildren(...values.map(v => {
        const r = template.cloneNode(true);
        r.querySelector('input').value = v;
        r.querySelector('.autocomplete-list')?.replaceChildren();
        return r;
    }));

    form.querySelector('[name="ingredients_match"]').value =
        allChip?.getAttribute('aria-pressed') === 'true' ? 'all' : 'any';
    apply();
}

function syncIngredients() {
    const inForm = new Set([...form.querySelectorAll('#ingredient-list input')]
        .map(i => i.value.trim().toLowerCase()).filter(Boolean));
    hero.querySelectorAll('#r-ing [data-ing]').forEach(c => press(c, inForm.has(c.dataset.ing.toLowerCase())));
    const allChip = hero.querySelector('#ing-all');
    if (allChip) {
        allChip.hidden = inForm.size < 2;
        press(allChip, !allChip.hidden && form.querySelector('[name="ingredients_match"]').value === 'all');
    }
}

// ── Tags: featured tags as chips, "More tags" opens a searchable list ────────

function bindTags() {
    const row = hero.querySelector('#r-tags');
    const pop = hero.querySelector('#pop');
    const search = hero.querySelector('#tq');
    const results = hero.querySelector('#tl');
    let featured = [];

    fetch('/api/get_tags.php')
        .then(r => r.json())
        .then(tags => {
            featured = tags.map(t => ({ name: t.name }));
            row.replaceChildren(...featured.slice(0, 5).map(t => chip(t.name, { tag: t.name })));
            syncTags();
        })
        .catch(() => {});

    hero.addEventListener('click', e => {
        const c = e.target.closest('[data-tag]');
        if (!c) return;
        toggleTag(c.dataset.tag);
        syncTags();
        apply();
    });

    hero.querySelector('#more-tags')?.addEventListener('click', () => {
        pop.hidden = !pop.hidden;
        if (!pop.hidden) { renderTagResults(featured); search.focus(); }
    });

    let timer = 0, req = 0;
    search?.addEventListener('input', () => {
        clearTimeout(timer);
        const q = search.value.trim();
        if (!q) { renderTagResults(featured); return; }
        timer = setTimeout(async () => {
            const mine = ++req;
            try {
                const res = await fetch(`/api/search_tags.php?q=${encodeURIComponent(q)}`);
                const rows = await res.json();
                if (mine === req) renderTagResults(rows.map(r => ({ name: r.name, count: r.recipe_count })));
            } catch {}
        }, DEBOUNCE_MS);
    });

    function renderTagResults(tags) {
        results.replaceChildren(...tags.map(t => {
            const c = chip(t.name, { tag: t.name });
            if (t.count != null) {
                const n = document.createElement('small');
                n.textContent = ` ${t.count}`;
                c.appendChild(n);
            }
            return c;
        }));
        if (!tags.length) results.textContent = 'No tag like that yet.';
        syncTags();
    }
}

function syncTags() {
    hero.querySelectorAll('[data-tag]').forEach(c => press(c, isTagSelected(c.dataset.tag)));
}

// ── From: hint text, go-tos chip, and the results heading ────────────────────

function scopeKey() {
    const active = document.querySelector('.recipe-category-buttons .nav-buttons.active');
    return SCOPES[active?.id] ?? 'mine';
}

function bindScope() {
    // recipes.js switches the active button; read the result once it has
    document.querySelector('.recipe-category-buttons')?.addEventListener('click', () => setTimeout(syncScope, 0));
    document.querySelector('.sub-category-buttons')?.addEventListener('click', () => setTimeout(syncGoTo, 0));

    hero.querySelector('#go-to-chip')?.addEventListener('click', e => {
        const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
        document.getElementById(on ? 'favorite-recipes' : 'new-recipes')?.click();
    });
}

function syncScope() {
    const key = scopeKey();
    const hint = hero.querySelector('#scope-hint');
    if (hint) {
        hint.textContent = hint.dataset[key] ?? '';
        hint.classList.toggle('d', key === 'all');
    }
    const goTo = hero.querySelector('#go-to-chip');
    if (goTo) goTo.hidden = !document.getElementById('favorite-recipes');   // only in My kitchen
    syncGoTo();
}

function syncGoTo() {
    const goTo = hero.querySelector('#go-to-chip');
    if (goTo) press(goTo, !!document.querySelector('#favorite-recipes.active'));
}

function showCount(n) {
    const key = scopeKey();
    const count = document.getElementById('count');
    const sub = document.getElementById('csub');
    if (count) count.textContent = `${n}${n >= 20 ? '+' : ''} ${n === 1 ? 'recipe' : 'recipes'} ${count.dataset[key] ?? ''}`;
    if (sub) sub.textContent = sub.dataset[key] ?? '';
}

function syncAll() {
    hero.querySelectorAll('#r-time [data-time]').forEach(c =>
        press(c, form.querySelector('#time').value === c.dataset.time));
    syncCourses();
    syncIngredients();
    syncTags();
}
