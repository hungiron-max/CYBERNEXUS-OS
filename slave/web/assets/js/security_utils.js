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

    async function syncServerSession() {
        try {
            const token = global.localStorage ? (global.localStorage.getItem('pos_token') || '') : '';
            const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
            const res = await fetch('/api/auth?action=check', { headers: headers, credentials: 'same-origin' });
            const data = await res.json().catch(function () { return null; });
            if (data && data.authenticated && data.user) {
                const frozenUser = Object.freeze(Object.assign({}, data.user));
                try {
                    Object.defineProperty(global, 'CNX_AUTH_USER', {
                        value: frozenUser,
                        writable: false,
                        configurable: false
                    });
                } catch (_) {
                    global.CNX_AUTH_USER = frozenUser;
                }
                global.currentUser = frozenUser;
                return frozenUser;
            }
        } catch (err) {
            logSilentError('syncServerSession', err);
        }
        return null;
    }

    function renderOfflineVietQr(targetImgOrBox, qrData) {
        if (!targetImgOrBox) return;
        const d = qrData || {};
        const svgUrl = d.vietqr_url || (
            '/api/payment/vietqr_svg?bank_id=' + encodeURIComponent(d.bank_id || 'OCB') +
            '&account_no=' + encodeURIComponent(d.account_no || '') +
            '&amount=' + encodeURIComponent(d.amount || 0) +
            '&add_info=' + encodeURIComponent(d.note || d.order_code || 'THANH TOAN') +
            '&account_name=' + encodeURIComponent(d.account_name || '')
        );
        if (targetImgOrBox.tagName === 'IMG') {
            if (d.vietqr_payload && typeof global.QRCode === 'function' && targetImgOrBox.parentElement) {
                try {
                    const wrap = targetImgOrBox.parentElement;
                    let holder = wrap.querySelector('.cnx-offline-qr-canvas');
                    if (!holder) {
                        holder = document.createElement('div');
                        holder.className = 'cnx-offline-qr-canvas flex items-center justify-center mx-auto';
                        wrap.insertBefore(holder, targetImgOrBox);
                    }
                    holder.innerHTML = '';
                    new global.QRCode(holder, {
                        text: d.vietqr_payload,
                        width: 196,
                        height: 196,
                        colorDark: '#0b0f19',
                        colorLight: '#ffffff',
                        correctLevel: global.QRCode.CorrectLevel.M
                    });
                    targetImgOrBox.classList.add('hidden');
                    return;
                } catch (e) {
                    logSilentError('renderOfflineVietQr', e);
                }
            }
            targetImgOrBox.classList.remove('hidden');
            targetImgOrBox.src = svgUrl;
        }
    }

    const api = {
        escapeHtml: escapeHtml,
        escapeJsAttr: escapeJsAttr,
        safeAttr: escapeHtml,
        safeUrl: safeUrl,
        logSilentError: logSilentError,
        syncServerSession: syncServerSession,
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
    if (global.document && global.location && !/login\.html/i.test(global.location.pathname || '')) {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', function () { syncServerSession(); });
        } else {
            syncServerSession();
        }
    }
})(window);
