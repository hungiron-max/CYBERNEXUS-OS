/**
 * CyberNexus OS — Shared Client Security Utilities (XSS Protection & Safe Diagnostics)
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

    function escapeJsAttr(val) {
        if (val === null || val === undefined) return '';
        return String(val)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '\\x3C')
            .replace(/>/g, '\\x3E')
            .replace(/`/g, '\\x60');
    }

    function safeUrl(url) {
        if (!url) return '';
        const s = String(url).trim();
        if (/^(javascript|data:text\/html|vbscript):/i.test(s)) {
            return '#';
        }
        return s;
    }

    const _errThrottle = {};
    function logSilentError(context, err) {
        try {
            const key = String(context || 'unknown');
            const now = Date.now();
            if (!_errThrottle[key] || now - _errThrottle[key] > 30000) {
                _errThrottle[key] = now;
                if (global.console && typeof global.console.debug === 'function') {
                    global.console.debug('[CyberNexus]', key, err && err.message ? err.message : err);
                }
            }
        } catch (ignored) {
            void ignored;
        }
    }

    function renderOfflineVietQr(targetImgOrBox, qrData) {
        if (!targetImgOrBox) return;
        const d = qrData || {};
        const svgUrl = d.vietqr_url || (
            '/api/payment/vietqr_svg?bank_id=' + encodeURIComponent(d.bank_id || 'MB') +
            '&account_no=' + encodeURIComponent(d.account_no || '') +
            '&amount=' + encodeURIComponent(d.amount || 0) +
            '&add_info=' + encodeURIComponent(d.note || 'GIA HAN SALEAPP') +
            '&account_name=' + encodeURIComponent(d.account_name || '')
        );
        if (targetImgOrBox.tagName === 'IMG') {
            targetImgOrBox.src = svgUrl;
        }
    }

    const api = {
        escapeHtml: escapeHtml,
        escapeJsAttr: escapeJsAttr,
        safeAttr: escapeHtml,
        safeUrl: safeUrl,
        logSilentError: logSilentError,
        renderOfflineVietQr: renderOfflineVietQr
    };

    global.CyberSecurity = api;
    global.CyberNexusSec = api;
    global.cnxRenderVietQr = renderOfflineVietQr;
    if (typeof global.escapeHtml !== 'function') {
        global.escapeHtml = escapeHtml;
    }
    if (typeof global.escapeJsAttr !== 'function') {
        global.escapeJsAttr = escapeJsAttr;
    }
})(window);
