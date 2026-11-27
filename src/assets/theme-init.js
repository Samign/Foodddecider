// assets/theme-init.js
// Loaded as a plain (blocking) script in <head> by getHeadAssets(), before anything is drawn,
// so a saved dark theme doesn't flash light first. A file instead of an inline <script>
// so the Content-Security-Policy can forbid inline scripts (the main defence if XSS ever slips in).
try {
    var theme = localStorage.getItem('theme');
    if (theme) document.documentElement.dataset.theme = theme;
} catch (e) { /* storage blocked: follow the system setting */ }
