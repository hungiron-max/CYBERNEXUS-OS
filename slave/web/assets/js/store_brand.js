(function () {
    const FALLBACK_BRAND = {
        store_name: 'CyberNexus POS',
        store_wifi: '',
        store_wifi_ssid: '',
        store_hotline: '',
        store_address: ''
    };

    window.CN_STORE_BRAND = Object.assign({}, FALLBACK_BRAND);

    function applyStoreBrand(brand) {
        const name = (brand && brand.store_name) ? String(brand.store_name).trim() : FALLBACK_BRAND.store_name;
        const wifiSsid = (brand && (brand.store_wifi_ssid || brand.store_wifi)) ? String(brand.store_wifi_ssid || brand.store_wifi).trim() : '';
        window.CN_STORE_BRAND = Object.assign({}, FALLBACK_BRAND, brand, { store_name: name });

        document.querySelectorAll('[data-store-name]').forEach(el => {
            el.textContent = name;
        });
        document.querySelectorAll('[data-store-wifi]').forEach(el => {
            if (wifiSsid) el.textContent = wifiSsid;
        });

        const titleEl = document.querySelector('title');
        if (titleEl) {
            const suffix = titleEl.getAttribute('data-title-suffix');
            if (suffix) {
                document.title = `${name} - ${suffix}`;
            } else if (/CyberNexus POS|GÓC PHỐ|Góc Phố/i.test(document.title)) {
                document.title = document.title.replace(/GÓC PHỐ COFFEE & TEA|Góc Phố Coffee & Tea|CyberNexus POS/gi, name);
            }
        }

        const standeeTitle = document.getElementById('standee-store-title');
        if (standeeTitle) standeeTitle.textContent = name.toUpperCase();
    }

    window.getStoreBrandName = function () {
        return (window.CN_STORE_BRAND && window.CN_STORE_BRAND.store_name) || FALLBACK_BRAND.store_name;
    };

    window.applyStoreBrand = applyStoreBrand;

    function applyStoreTheme(theme) {
        if (!theme || typeof theme !== 'object' || (!theme.dark && !theme.light && !theme.primary)) {
            document.documentElement.removeAttribute('data-custom-theme');
            return;
        }
        const r = document.documentElement;
        const d = theme.dark || theme;
        const l = theme.light || {};
        r.setAttribute('data-custom-theme', '1');
        r.style.setProperty('--cn-primary', d.primary || '#38bdf8');
        r.style.setProperty('--cn-accent', d.accent || '#8b5cf6');
        r.style.setProperty('--cn-bg-start', d.bg_start || '#070d1b');
        r.style.setProperty('--cn-bg-end', d.bg_end || '#0f172a');
        r.style.setProperty('--cn-card-bg', d.card_bg || 'rgba(15, 23, 42, 0.78)');
        r.style.setProperty('--cn-card-border', d.card_border || 'rgba(56, 189, 248, 0.25)');
        r.style.setProperty('--cn-text', d.text || '#f1f5f9');
        if (l.primary) r.style.setProperty('--cn-light-primary', l.primary);
        if (l.accent) r.style.setProperty('--cn-light-accent', l.accent);
        if (l.bg_start) r.style.setProperty('--cn-light-bg-start', l.bg_start);
        if (l.bg_end) r.style.setProperty('--cn-light-bg-end', l.bg_end);
        if (l.card_bg) r.style.setProperty('--cn-light-card-bg', l.card_bg);
        if (l.card_border) r.style.setProperty('--cn-light-card-border', l.card_border);
        if (l.text) r.style.setProperty('--cn-light-text', l.text);
        r.style.setProperty('--cn-radius', (Number(theme.radius) || 16) + 'px');
        r.style.setProperty('--cn-blur', (Number(theme.blur) || 16) + 'px');
        if (theme.font) r.style.setProperty('--cn-font', theme.font);
        if (theme.slogan) {
            document.querySelectorAll('[data-store-slogan]').forEach(el => { el.textContent = theme.slogan; });
        }
    }
    window.applyStoreTheme = applyStoreTheme;

    window.addEventListener('message', (ev) => {
        if (ev && ev.data && ev.data.type === 'CN_THEME_PREVIEW') {
            applyStoreTheme(ev.data.theme);
            if (ev.data.store_name) applyStoreBrand({ store_name: ev.data.store_name });
        }
    });

    async function loadStoreBrand() {
        try {
            const cached = sessionStorage.getItem('cn_store_brand');
            if (cached) {
                applyStoreBrand(JSON.parse(cached));
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('store_brand.js', e) : console.debug('store_brand.js', e)); }

        try {
            const res = await fetch('/api/settings.php', { cache: 'no-store' });
            const json = await res.json();
            const d = (json && json.data) ? json.data : json;
            if (d && d.ota_applied_version) {
                const page = (window.location.pathname || '').toLowerCase();
                const isPublicPage = page.endsWith('/login.html') || page.endsWith('/customer.html') || page.endsWith('/wifi.html');
                const prevOta = localStorage.getItem('cnx_session_ota_ver');
                if (!isPublicPage && localStorage.getItem('pos_token')) {
                    if (prevOta && prevOta !== d.ota_applied_version) {
                        localStorage.removeItem('pos_token');
                        localStorage.removeItem('pos_user');
                        localStorage.setItem('cnx_session_ota_ver', d.ota_applied_version);
                        window.location.href = 'login.html?reason=updated';
                        return;
                    }
                    if (!prevOta) localStorage.setItem('cnx_session_ota_ver', d.ota_applied_version);
                } else if (isPublicPage) {
                    localStorage.setItem('cnx_session_ota_ver', d.ota_applied_version);
                }
            }
            if (d && d.theme_json) {
                try {
                    const tObj = typeof d.theme_json === 'string' ? JSON.parse(d.theme_json) : d.theme_json;
                    applyStoreTheme(tObj);
                    sessionStorage.setItem('cn_store_theme', JSON.stringify(tObj));
                } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('store_brand.js', e) : console.debug('store_brand.js', e)); }
            } else {
                try {
                    const cachedTheme = sessionStorage.getItem('cn_store_theme');
                    if (cachedTheme) applyStoreTheme(JSON.parse(cachedTheme));
                } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('store_brand.js', e) : console.debug('store_brand.js', e)); }
            }
            if (d && d.store_name) {
                applyStoreBrand(d);
                try {
                    sessionStorage.setItem('cn_store_brand', JSON.stringify({
                        store_name: d.store_name,
                        store_wifi: d.store_wifi || '',
                        store_wifi_ssid: d.store_wifi_ssid || '',
                        store_hotline: d.store_hotline || '',
                        store_address: d.store_address || ''
                    }));
                } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('store_brand.js', e) : console.debug('store_brand.js', e)); }
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('store_brand.js', e) : console.debug('store_brand.js', e)); }

        try {
            const lRes = await fetch('/api/license.php?action=status', { cache: 'no-store' });
            const lJson = await lRes.json();
            if (lJson && lJson.success && lJson.data) {
                const mods = Array.isArray(lJson.data.modules) ? lJson.data.modules : [];
                const blocked = Array.isArray(lJson.data.blocked_modules) ? lJson.data.blocked_modules : [];
                const mediaAllowed = (mods.includes('mod_media_stream') || mods.includes('media_stream'))
                    && !blocked.includes('mod_media_stream') && !blocked.includes('media_stream');
                if (!mediaAllowed) {
                    ['pos-jukebox-pill', 'admin-jukebox-pill', 'customer-jukebox-bar'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = 'none';
                    });
                }
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('store_brand.js', e) : console.debug('store_brand.js', e)); }
    }

    function showInPageNotice(msg, type) {
        const resolved = (typeof window.cnxT === 'function')
            ? window.cnxT(String(msg || ''), null, String(msg || ''))
            : String(msg || '');
        const text = String(resolved || '').trim();
        if (!text) return;
        const lower = text.toLowerCase();
        const normType = type === 'warning' ? 'warn' : type;
        const kind = normType || (
            /(lỗi|thất bại|không thể|sai|chưa có|vui lòng|thiếu|hết|cấm|từ chối|invalid|error)/i.test(lower)
                ? (/vui lòng|chưa|thiếu|cảnh báo/i.test(lower) ? 'warn' : 'error')
                : (/thành công|đã |hoàn tất|ok/i.test(lower) ? 'success' : 'info')
        );
        const palette = {
            success: { border: 'rgba(16,185,129,0.55)', icon: '✓', color: '#34d399' },
            warn:    { border: 'rgba(245,158,11,0.55)', icon: '!', color: '#fbbf24' },
            error:   { border: 'rgba(244,63,94,0.55)',  icon: '✕', color: '#fb7185' },
            info:    { border: 'rgba(56,189,248,0.55)', icon: 'i', color: '#38bdf8' }
        }[kind] || { border: 'rgba(56,189,248,0.55)', icon: 'i', color: '#38bdf8' };

        let stack = document.getElementById('cn-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'cn-toast-stack';
            stack.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;display:flex;flex-direction:column;gap:8px;max-width:400px;pointer-events:none;';
            document.body.appendChild(stack);
        }
        const item = document.createElement('div');
        item.style.cssText = `pointer-events:auto;display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border-radius:12px;border:1px solid ${palette.border};background:rgba(15,23,42,0.96);color:#f8fafc;font:600 13px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 14px 34px rgba(0,0,0,0.5);backdrop-filter:blur(12px);white-space:pre-line;transition:opacity .2s ease;`;
        item.innerHTML = `<span style="width:20px;height:20px;border-radius:999px;background:${palette.color}22;border:1px solid ${palette.border};color:${palette.color};display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex-shrink:0;margin-top:1px;">${palette.icon}</span><span style="flex:1;"></span><button type="button" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;line-height:1;padding:0 2px;">&times;</button>`;
        item.children[1].textContent = text;
        item.children[2].onclick = () => item.remove();
        stack.appendChild(item);
        setTimeout(() => { item.style.opacity = '0'; setTimeout(() => item.remove(), 220); }, 3800);
    }

    function openCnxDialog(opts) {
        const tx = (k, fb) => (typeof window.cnxT === 'function' ? window.cnxT(k, null, fb) : fb);
        return new Promise((resolve) => {
            const old = document.getElementById('cnx-dialog-overlay');
            if (old) old.remove();
            const isPrompt = !!opts.isPrompt;
            const overlay = document.createElement('div');
            overlay.id = 'cnx-dialog-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,0.78);backdrop-filter:blur(10px);';

            const card = document.createElement('div');
            card.style.cssText = 'width:100%;max-width:440px;background:linear-gradient(145deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95));border:1px solid rgba(56,189,248,0.35);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,0.65);padding:20px;color:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;';

            const titleEl = document.createElement('div');
            titleEl.style.cssText = 'font-size:15px;font-weight:800;color:#38bdf8;margin-bottom:10px;';
            titleEl.textContent = opts.title || tx(isPrompt ? 'common.prompt_title' : 'common.confirm_title', isPrompt ? 'Nhập thông tin' : (window.cnxT?window.cnxT('js.m_sa.d174852a','Xác nhận thao tác'):'Xác nhận thao tác'));

            const msgEl = document.createElement('div');
            msgEl.style.cssText = 'font-size:13px;line-height:1.55;color:#cbd5e1;white-space:pre-line;margin-bottom:14px;';
            msgEl.textContent = String(tx(opts.message, opts.message) || '');

            card.appendChild(titleEl);
            card.appendChild(msgEl);

            let inputEl = null;
            if (isPrompt) {
                inputEl = document.createElement('input');
                inputEl.type = opts.inputType || 'text';
                inputEl.value = opts.defaultValue != null ? String(opts.defaultValue) : '';
                inputEl.style.cssText = 'width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;background:#020617;border:1px solid rgba(56,189,248,0.4);color:#f8fafc;font-size:13px;margin-bottom:14px;outline:none;';
                card.appendChild(inputEl);
            }

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.textContent = opts.cancelText || tx('common.cancel', (window.cnxT?window.cnxT('js.m_sa.8a4917d2','Hủy bỏ'):'Hủy bỏ'));
            cancelBtn.style.cssText = 'padding:8px 14px;border-radius:10px;border:1px solid rgba(148,163,184,0.35);background:rgba(15,23,42,0.85);color:#cbd5e1;font-size:12px;font-weight:700;cursor:pointer;';

            const okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.textContent = opts.okText || tx('common.confirm', (window.cnxT?window.cnxT('ui.kitchen_html.h3_7b9f3a63','Xác nhận'):'Xác nhận'));
            okBtn.style.cssText = 'padding:8px 16px;border-radius:10px;border:1px solid rgba(56,189,248,0.5);background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;font-size:12px;font-weight:800;cursor:pointer;';

            const cleanup = (val) => {
                document.removeEventListener('keydown', onKey);
                overlay.remove();
                resolve(val);
            };
            const onKey = (ev) => {
                if (ev.key === 'Escape') cleanup(isPrompt ? null : false);
                else if (ev.key === 'Enter' && isPrompt) cleanup(inputEl.value);
            };
            document.addEventListener('keydown', onKey);
            overlay.addEventListener('click', (ev) => {
                if (ev.target === overlay) cleanup(isPrompt ? null : false);
            });
            cancelBtn.onclick = () => cleanup(isPrompt ? null : false);
            okBtn.onclick = () => cleanup(isPrompt ? inputEl.value : true);

            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(okBtn);
            card.appendChild(btnRow);
            overlay.appendChild(card);
            document.body.appendChild(overlay);
            setTimeout(() => (inputEl || okBtn).focus(), 10);
        });
    }

    window.cnxConfirm = function (message, opts) {
        return openCnxDialog(Object.assign({}, opts || {}, { message, isPrompt: false }));
    };
    window.cnxPrompt = function (message, defaultValue, opts) {
        return openCnxDialog(Object.assign({}, opts || {}, { message, defaultValue, isPrompt: true }));
    };
    window.cnNotify = showInPageNotice;
    window.alert = function (msg, type) {
        showInPageNotice(msg, type);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadStoreBrand);
    } else {
        loadStoreBrand();
    }
})();
