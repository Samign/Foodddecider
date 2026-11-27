// assets/main.js

/**
 * Helper to conditionally import a module if its target selector exists in the DOM.
 * @param {string} selector - The CSS selector to check (e.g., '#add-recipe-modal')
 * @param {Function} importFn - A function returning dynamic import()
 */
async function loadModuleIfPresent(selector, importFn) {
  const element = document.querySelector(selector);
  if (element) {
    try {
      const module = await importFn(element);

      if (module && typeof module.init === 'function') {
        module.init(element);
      }
    } catch (error) {
      console.error(`Failed to load module for selector "${selector}":`, error);
    }
  }
}

// Global modules that should always run regardless of state
import './meta-data-loader.js';
import './popstate.js';

// Feature-specific dynamic loaders
document.addEventListener('DOMContentLoaded', () => {

  // 1. Auth / Guest Features (Only runs if login modal exists)
  loadModuleIfPresent('#login-modal', () => import('./landing-page.js'));

  // 2. Recipe Management (Only runs if add/edit recipe modal exists)
  loadModuleIfPresent('#add-recipe-form', async (element) => {
    // Load multiple related scripts in parallel when the form is present
    const [dragDrop, addRecipe, sections, forkRecipe] = await Promise.all([
      import('./drag-and-drop.js'),
      import('./add-recipe.js'),
      import('./sections.js'),
      import('./fork-recipe.js')
    ]);

    if (dragDrop.init) dragDrop.init(element);
    if (addRecipe.init) addRecipe.init(element);
    if (sections.init) sections.init(element);   // Enter adds a row, Backspace removes it, arrows move between rows
  });

  // 3. Recipe Search & Suggestions
  loadModuleIfPresent('.ingredient-text', () => import('./suggestions.js'));

  // 4. Feed & Grid Features
  loadModuleIfPresent('#recipe-list', () => import('./recipes.js'));
  loadModuleIfPresent('#recipe-list', () => import('./form-router.js'));
  loadModuleIfPresent('.hero', () => import('./hero-filters.js'));   // quick filters on the home page

  loadModuleIfPresent('#expanded-modal', () => import('./recipe-modal.js'));
  loadModuleIfPresent('#expanded-modal', () => import('./add_to_list.js'));

  loadModuleIfPresent('#filter-menu', () => import('./tags.js'));

  // 5. Social Interactions & Lists
  loadModuleIfPresent('#social-modal', () => import('./social-interactions.js'));

  loadModuleIfPresent('#shopping-list-modal', () => import('./list.js'));

  const profileModal = document.getElementById('profile-modal');
  const avatar = document.querySelector('.current-user');
  if (profileModal && avatar) {
      const toggleProfile = () => profileModal.classList.toggle('hidden');
      avatar.addEventListener('click', toggleProfile);
      avatar.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleProfile(); } });
      // Click anywhere else closes the little profile menu
      document.addEventListener('click', e => {
          if (!profileModal.contains(e.target) && !avatar.contains(e.target)) profileModal.classList.add('hidden');
      });
  }
  
});

const root = document.documentElement;
const media = matchMedia('(prefers-color-scheme: dark)');
const toggle = document.getElementById('theme-toggle');
const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : media.matches);

function syncToggle() {
    if (!toggle) return;
    toggle.querySelector('.material-symbols-outlined').textContent = isDark() ? 'light_mode' : 'dark_mode';
    toggle.querySelector('.theme-label').textContent = isDark() ? 'Light mode' : 'Dark mode';
}

toggle?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    syncToggle();
});

media.addEventListener('change', syncToggle);
syncToggle();

// The dark backdrop belongs to the recipe view; the login dialog borrows it
function hideOverlayIfUnused() {
  const recipeOpen = !document.getElementById('expanded-modal')?.classList.contains('hidden');
  const loginOpen = document.getElementById('login-modal') && !document.getElementById('login-modal').classList.contains('hidden');
  if (!recipeOpen && !loginOpen) document.getElementById('modal-overlay')?.classList.add('hidden');
}

function closeModal(modal) {
  if (!modal || modal.id === 'expanded-modal') return;   // the recipe view closes through history (recipe-modal.js)
  modal.classList.add('hidden');
  hideOverlayIfUnused();
}

document.addEventListener('click', (e) => {
  const close = e.target.closest('.close-button');
  if (close) closeModal(close.closest('.modal'));
  if (e.target.id === 'modal-overlay') closeModal(document.getElementById('login-modal'));
});

// Escape closes the top small window (shopping list, groups, filters...). Native dialogs handle their own.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  const open = [...document.querySelectorAll('.modal:not(.hidden)')].filter(m => m.id !== 'expanded-modal');
  if (open.length) closeModal(open[open.length - 1]);
});