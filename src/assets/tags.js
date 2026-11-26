// tags.js: tag filtering in one place: selection state, chips and autocomplete.
//
// Expected DOM (every piece is optional; missing ones are skipped):
//   #filter-menu .tags      featured chips, each with data-tag-slug
//   #custom-tag-input       text input
//   #tag-suggestions        autocomplete dropdown
//   #add-tag-button         "add" button
//   #selected-tags          hidden input submitted with the filter form (JSON array of slugs)
//   #selected-tags-list     where non-featured selected tags are shown as removable chips

const DEBOUNCE_MS = 150;

// slug -> label. The single source of truth for selected tags.
const selectedTags = new Map();

let input = null;           // #custom-tag-input
let suggestList = null;     // #tag-suggestions
let currentItems = [];      // items currently rendered in the dropdown
let timer = 0;              // debounce timer
let reqId = 0;              // latest request number (stale-reply guard)

// ── Public API ────────────────────────────────────────────────────────────────

/** Safe to call more than once, e.g. with an injected modal as root. */
export function init() {
    bindInput(document);
    bindAddButton(document);
    bindFeaturedChips(document);
    renderTagSelection();
}

export function getSelectedTags() {
    return [...selectedTags.keys()];
}

export function clearTags() {
    selectedTags.clear();
    cancelSuggestions();
    renderTagSelection();
}

/** Turn one tag on or off by its label (used by the quick filters on the home page). */
export function toggleTag(label) {
    const slug = slugifyTag(label);
    if (!slug) return false;
    if (selectedTags.has(slug)) selectedTags.delete(slug);
    else selectedTags.set(slug, label.trim());
    renderTagSelection();
    return selectedTags.has(slug);
}

export function isTagSelected(label) {
    return selectedTags.has(slugifyTag(label));
}

export function addCustomTags(raw) {
    raw.split(',').forEach(part => {                    // "vegan, quick" adds two tags
        const label = part.trim().replace(/\s+/g, ' ');
        const slug = slugifyTag(label);
        if (slug && !selectedTags.has(slug)) selectedTags.set(slug, label);
    });
    renderTagSelection();
}

export function renderTagSelection() {
    // What actually gets submitted
    const hidden = document.getElementById('selected-tags');
    if (hidden) hidden.value = JSON.stringify([...selectedTags.keys()]);

    // Highlight featured chips
    const featured = document.querySelectorAll('#filter-menu .tags [data-tag-slug]');
    const featuredSlugs = new Set();
    featured.forEach(chip => {
        featuredSlugs.add(chip.dataset.tagSlug);
        chip.classList.toggle('selected', selectedTags.has(chip.dataset.tagSlug));
    });

    // Show custom (non-featured) tags as removable chips
    const list = document.getElementById('selected-tags-list');
    if (!list) return;
    list.replaceChildren();
    for (const [slug, label] of selectedTags) {
        if (featuredSlugs.has(slug)) continue;

        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'tag-chip selected';
        chip.textContent = label + ' ×';                // textContent: user-typed, never innerHTML
        chip.addEventListener('click', () => {
            selectedTags.delete(slug);
            renderTagSelection();
        });
        list.appendChild(chip);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugifyTag(s) {
    return s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
}

function suggestionEls() {
    return suggestList ? [...suggestList.querySelectorAll('.autocomplete-item')] : [];
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

function clearSuggestions() {
    suggestList?.replaceChildren();
    currentItems = [];
}

// Close the list AND invalidate anything still pending, so a late reply can't reopen it.
function cancelSuggestions() {
    clearTimeout(timer);
    reqId++;
    clearSuggestions();
}

function pickTag(item) {
    if (!selectedTags.has(item.slug)) selectedTags.set(item.slug, item.name);   // server slug, not a guess
    if (input) {
        input.value = '';
        input.focus();
    }
    cancelSuggestions();
    renderTagSelection();
}

// Enter / comma / Add button: an exact match picks the existing tag, otherwise the typed text stands.
function commitTyped() {
    if (!input) return;
    const typed = input.value.trim().toLowerCase();
    const exact = currentItems.find(t => t.name.toLowerCase() === typed);
    if (exact) return pickTag(exact);

    addCustomTags(input.value);
    input.value = '';
    cancelSuggestions();
}

function renderSuggestions(items) {
    clearSuggestions();
    currentItems = items;
    items.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.dataset.index = i;

        const name = document.createElement('span');
        name.className = 'autocomplete-name';
        name.textContent = item.name;

        const count = document.createElement('small');
        count.className = 'autocomplete-count';
        count.textContent = item.recipe_count;

        div.append(name, count);
        div.addEventListener('mousedown', e => { e.preventDefault(); pickTag(item); });
        suggestList.appendChild(div);
    });
}

async function fetchSuggestions(q) {
    const id = ++reqId;
    try {
        const res = await fetch(`/api/search_tags.php?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const items = await res.json();
        if (id !== reqId) return;                       // stale reply (or list was cancelled)
        renderSuggestions(items.filter(t => !selectedTags.has(t.slug)));
    } catch (err) {
        console.error('Tag suggestions failed:', err);
    }
}

function moveActive(step) {
    const items = suggestionEls();
    if (!items.length) return false;

    const active = suggestList.querySelector('.autocomplete-item.active');
    const i = items.indexOf(active);
    active?.classList.remove('active');

    const next = i === -1
        ? (step === 1 ? items[0] : items[items.length - 1])
        : items[(i + step + items.length) % items.length];
    next.classList.add('active');
    next.scrollIntoView({ block: 'nearest' });
    return true;
}

// ── Binding ───────────────────────────────────────────────────────────────────

function bindInput(root) {
    const el = root.querySelector('#custom-tag-input');
    if (!el || el.dataset.tagsBound) return;
    el.dataset.tagsBound = '1';

    input = el;
    suggestList = root.querySelector('#tag-suggestions');

    input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (!q || q.includes(',')) return cancelSuggestions();
        timer = setTimeout(() => fetchSuggestions(q), DEBOUNCE_MS);
    });

    input.addEventListener('keydown', e => {
        if (e.isComposing) return;                      // IME: Enter confirms composition, not the tag

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (moveActive(e.key === 'ArrowDown' ? 1 : -1)) e.preventDefault();
        } else if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();                         // never submit the form
            const active = suggestList?.querySelector('.autocomplete-item.active');
            if (active && e.key === 'Enter') {
                pickTag(currentItems[Number(active.dataset.index)]);
            } else {
                commitTyped();
            }
        } else if (e.key === 'Escape' && suggestionEls().length) {
            e.stopPropagation();                        // close the list, not the modal
            cancelSuggestions();
        }
    });

    input.addEventListener('blur', cancelSuggestions);
}

function bindAddButton(root) {
    const btn = root.querySelector('#add-tag-button');
    if (!btn || btn.dataset.tagsBound) return;
    btn.dataset.tagsBound = '1';

    btn.addEventListener('click', () => {
        commitTyped();
        input?.focus();
    });
}

// Featured chips: event delegation, so it works even if the chips are rendered later
function bindFeaturedChips(root) {
    const container = root.querySelector('#filter-menu .tags');
    if (!container || container.dataset.tagsBound) return;
    container.dataset.tagsBound = '1';

    container.addEventListener('click', e => {
        const chip = e.target.closest('[data-tag-slug]');
        if (!chip) return;
        const slug = chip.dataset.tagSlug;
        if (selectedTags.has(slug)) selectedTags.delete(slug);
        else selectedTags.set(slug, chip.textContent.trim());
        renderTagSelection();
    });
}