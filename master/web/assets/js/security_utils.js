/**
 * CyberNexus OS — Shared Client Security Utilities (XSS Protection)
 */
(function (global) {
    'use strict';

    const HTML_ESCAPE_MAP = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '`': '&#96;'
    };

    function escapeHtml(val) {
        if (val === null || val === undefined) return '';
        return String(val).replace(/[&<>"'`]/g, function (ch) {
            return HTML_ESCAPE_MAP[ch];
        });
    }

    function safeUrl(url) {
        if (!url) return '';
        const s = String(url).trim();
        if (/^(javascript|data:text\/html|vbscript):/i.test(s)) {
            return '#';
        }
        return s;
    }

    global.CyberSecurity = {
        escapeHtml: escapeHtml,
        safeAttr: escapeHtml,
        safeUrl: safeUrl
    };
    if (typeof global.escapeHtml !== 'function') {
        global.escapeHtml = escapeHtml;
    }
})(window);
