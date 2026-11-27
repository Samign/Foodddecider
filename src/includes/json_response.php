<?php
/**
 * Include first in every file under /api.
 *
 * PHP sends text/html by default. An API answer that repeats user input (an error with the
 * bad id, a search term...) could then be opened directly in the browser and run as HTML.
 * Declaring JSON (and forbidding the browser to guess otherwise) closes that hole.
 */
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
}
