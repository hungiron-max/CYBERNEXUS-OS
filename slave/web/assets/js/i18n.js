/**
 * CyberNexus OS — Offline Runtime i18n Engine (100% LAN/Local, Zero CDN)
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'cnx_lang';
    const SUPPORTED = ['vi', 'en'];
    const CORE_FALLBACK = {
        vi: {
            common: {
                confirm_title: 'Xác nhận thao tác',
                prompt_title: 'Nhập thông tin',
                ok: 'Đồng ý',
                confirm: 'Xác nhận',
                cancel: 'Hủy bỏ',
                close: 'Đóng',
                save: 'Lưu lại',
                loading: 'Đang tải...',
                error: 'Đã xảy ra lỗi',
                success: 'Thành công',
                warning: 'Cảnh báo',
                info: 'Thông báo',
                sim_warning: 'CHẾ ĐỘ MÔ PHỎNG — CHƯA NỐI THIẾT BỊ THẬT',
                logout: 'Đăng xuất',
                theme_dark: '☾ Tối',
                theme_light: '☀ Sáng',
                theme_to_dark: 'Chuyển sang giao diện tối',
                theme_to_light: 'Chuyển sang giao diện sáng',
                back_pos: 'Quay lại POS',
                back_admin: 'Quản Trị'
            },
            nav: {
                pos_badge: 'POS THU NGÂN',
                order_badge: 'ORDER PHỤC VỤ',
                kds_badge: 'BẾP & PHA CHẾ (KDS)',
                admin_badge: 'CHỦ QUÁN (ADMIN)',
                jukebox: 'Jukebox Âm Nhạc',
                staff_prefix: 'NV:',
                role_admin: 'ADMIN',
                role_cashier: 'THU NGÂN',
                role_kitchen: 'BẾP',
                role_waiter: 'PHỤC VỤ',
                owner_name: 'Chủ quán'
            },
            api: {
                POS_ORDER_EMPTY: 'Giỏ hàng không có sản phẩm nào!',
                POS_TABLE_REQUIRED: 'Vui lòng chọn đúng bàn đang trống trên sơ đồ quán!',
                POS_TABLE_NOT_FOUND: 'Bàn đã chọn không tồn tại!',
                POS_TABLE_CONFLICT: 'Bàn {table} vừa có khách đặt trước.',
                POS_SHIFT_NOT_OPEN: 'Không có ca làm việc nào đang mở!',
                POS_SHIFT_ALREADY_OPEN: 'Hiện đang có một ca làm việc đang mở!',
                AUTH_REQUIRED: 'Vui lòng đăng nhập để tiếp tục!',
                AUTH_MISSING_CREDENTIALS: 'Vui lòng nhập tên đăng nhập và mật khẩu!',
                AUTH_INVALID_CREDENTIALS: 'Sai tên đăng nhập hoặc mật khẩu!',
                ADMIN_REQUIRED: 'Chỉ Chủ quán (Admin) mới có quyền thực hiện!',
                ATTENDANCE_REASON_REQUIRED: 'Vui lòng nhập lý do chỉnh sửa chấm công!',
                PAYROLL_CYCLE_LOCKED: 'Kỳ lương tháng này đã khóa sổ/chi trả!',
                MODULE_LOCKED: 'Module [{module}] chưa được cấp phép hoặc đã bị khóa!',
                OTA_SHA256_MISMATCH: 'Gói OTA sai chữ ký SHA-256! Đã hủy giải nén để bảo vệ POS.'
            },
            notif: {
                kitchen_ready_title: '🔔 Bếp báo xong món: {table}',
                kitchen_ready_msg: 'Món ăn bàn {table} đã chế biến xong, vui lòng bưng ra!',
                kitchen_rush_title: '🔥 HỐI MÓN BÀN {table}',
                kitchen_rush_msg: '{user} hối Bếp lần {rush_count} (khách đợi lâu)',
                product_locked_title: 'TẠM KHÓA MÓN: {product}',
                product_locked_msg: "Món '{product}' ({code}) đã bị TẠM KHÓA trên thực đơn bởi {user}.",
                product_unlocked_title: 'MỞ BÁN LẠI: {product}',
                product_unlocked_msg: "Món '{product}' ({code}) đã được MỞ BÁN LẠI bởi {user}.",
                ota_update_title: 'Có bản cập nhật OTA mới v{version}',
                ota_update_msg: '{message}',
                system_notify_title: '{title}',
                system_notify_msg: '{message}'
            }
        },
        en: {
            common: {
                confirm_title: 'Confirm Action',
                prompt_title: 'Enter Input',
                ok: 'OK',
                confirm: 'Confirm',
                cancel: 'Cancel',
                close: 'Close',
                save: 'Save',
                loading: 'Loading...',
                error: 'An error occurred',
                success: 'Success',
                warning: 'Warning',
                info: 'Notice',
                sim_warning: 'SIMULATION MODE — HARDWARE NOT CONNECTED',
                logout: 'Sign Out',
                theme_dark: '☾ Dark',
                theme_light: '☀ Light',
                theme_to_dark: 'Switch to Dark Mode',
                theme_to_light: 'Switch to Light Mode',
                back_pos: 'Back to POS',
                back_admin: 'Admin'
            },
            nav: {
                pos_badge: 'CASHIER POS',
                order_badge: 'WAITER ORDER',
                kds_badge: 'KITCHEN & BAR (KDS)',
                admin_badge: 'OWNER (ADMIN)',
                jukebox: 'Music Jukebox',
                staff_prefix: 'Staff:',
                role_admin: 'ADMIN',
                role_cashier: 'CASHIER',
                role_kitchen: 'KITCHEN',
                role_waiter: 'WAITER',
                owner_name: 'Store Owner'
            },
            api: {
                POS_ORDER_EMPTY: 'Your order cart is empty!',
                POS_TABLE_REQUIRED: 'Please select an available table!',
                POS_TABLE_NOT_FOUND: 'Selected table does not exist!',
                POS_TABLE_CONFLICT: 'Table {table} is already occupied.',
                POS_SHIFT_NOT_OPEN: 'No open cash shift found!',
                POS_SHIFT_ALREADY_OPEN: 'Another shift is already open!',
                AUTH_REQUIRED: 'Authentication required!',
                AUTH_MISSING_CREDENTIALS: 'Please enter username and password!',
                AUTH_INVALID_CREDENTIALS: 'Invalid username or password!',
                ADMIN_REQUIRED: 'Owner (Admin) privilege is required!',
                ATTENDANCE_REASON_REQUIRED: 'Audit reason is required for attendance edits!',
                PAYROLL_CYCLE_LOCKED: 'This payroll cycle is locked or paid!',
                MODULE_LOCKED: 'Module [{module}] is not licensed or disabled!',
                OTA_SHA256_MISMATCH: 'OTA package SHA-256 verification failed! Extraction aborted.'
            },
            notif: {
                kitchen_ready_title: '🔔 Dish Ready: Table {table}',
                kitchen_ready_msg: 'Order for table {table} is ready to serve!',
                kitchen_rush_title: '🔥 RUSH ORDER: TABLE {table}',
                kitchen_rush_msg: '{user} rushed kitchen (#{rush_count})',
                product_locked_title: 'OUT OF STOCK: {product}',
                product_locked_msg: "Item '{product}' ({code}) was marked unavailable by {user}.",
                product_unlocked_title: 'BACK IN STOCK: {product}',
                product_unlocked_msg: "Item '{product}' ({code}) is available again ({user}).",
                ota_update_title: 'New OTA Update v{version}',
                ota_update_msg: '{message}',
                system_notify_title: '{title}',
                system_notify_msg: '{message}'
            }
        }
    };

    const dicts = {
        vi: JSON.parse(JSON.stringify(CORE_FALLBACK.vi)),
        en: JSON.parse(JSON.stringify(CORE_FALLBACK.en))
    };
    const loadedLangs = {};

    function safeDebug(ctx, e) {
        if (global.console && typeof global.console.debug === 'function') {
            global.console.debug('[i18n]', ctx, e && e.message ? e.message : e);
        }
    }

    function detectInitialLang() {
        try {
            const p = new URLSearchParams(global.location ? global.location.search : '');
            const qLang = (p.get('lang') || '').toLowerCase();
            if (SUPPORTED.indexOf(qLang) >= 0) {
                try { localStorage.setItem(STORAGE_KEY, qLang); } catch (e) { safeDebug('setItem', e); }
                return qLang;
            }
        } catch (e) { safeDebug('queryLang', e); }
        try {
            const saved = (localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
            if (SUPPORTED.indexOf(saved) >= 0) return saved;
        } catch (e) { safeDebug('getItem', e); }
        return 'vi';
    }

    let currentLang = detectInitialLang();

    function deepGet(obj, path) {
        if (!obj || !path) return undefined;
        const parts = String(path).split('.');
        let cur = obj;
        for (let i = 0; i < parts.length; i++) {
            if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
            cur = cur[parts[i]];
        }
        return typeof cur === 'string' ? cur : undefined;
    }

    function formatVars(str, vars) {
        if (!vars || typeof vars !== 'object') return str;
        return str.replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, k) {
            return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`;
        });
    }

    function mergeDict(lang, incoming) {
        if (!incoming || typeof incoming !== 'object') return;
        const dst = dicts[lang] || (dicts[lang] = {});
        Object.keys(incoming).forEach(function (ns) {
            if (incoming[ns] && typeof incoming[ns] === 'object' && !Array.isArray(incoming[ns])) {
                dst[ns] = Object.assign({}, dst[ns] || {}, incoming[ns]);
            } else {
                dst[ns] = incoming[ns];
            }
        });
    }

    const loadingPromises = {};
    async function ensureLoaded(lang) {
        if (SUPPORTED.indexOf(lang) < 0) return false;
        if (loadedLangs[lang]) return true;
        if (loadingPromises[lang]) return loadingPromises[lang];
        if (!global.fetch || (global.location && global.location.protocol === 'file:')) return false;
        loadingPromises[lang] = (async function () {
            try {
                const res = await fetch('/locales/' + lang + '.json?v=20261122');
                if (res.ok) {
                    const json = await res.json();
                    mergeDict(lang, json);
                    loadedLangs[lang] = true;
                    return true;
                }
            } catch (e) { safeDebug('fetchLocale:' + lang, e); }
            return false;
        })();
        try { return await loadingPromises[lang]; } finally { delete loadingPromises[lang]; }
    }

    function t(key, varsOrFallback, fallback) {
        let vars = null;
        let fb = '';
        if (typeof varsOrFallback === 'string') {
            fb = varsOrFallback;
        } else if (varsOrFallback && typeof varsOrFallback === 'object') {
            vars = varsOrFallback;
            fb = typeof fallback === 'string' ? fallback : '';
        } else if (typeof fallback === 'string') {
            fb = fallback;
        }

        let val = deepGet(dicts[currentLang], key);
        if (val === undefined && currentLang !== 'vi') {
            val = deepGet(dicts.vi, key);
        }
        if (val === undefined) {
            val = fb || key;
        }
        return formatVars(val, vars);
    }

    function findReverseTranslation(viText) {
        if (!viText || currentLang === 'vi') return '';
        const target = String(viText).trim();
        const viDict = dicts.vi || {};
        const tgtDict = dicts[currentLang] || {};
        for (const ns of Object.keys(viDict)) {
            const vObj = viDict[ns];
            const tObj = tgtDict[ns];
            if (!vObj || !tObj || typeof vObj !== 'object' || typeof tObj !== 'object') continue;
            for (const k of Object.keys(vObj)) {
                if (typeof vObj[k] === 'string' && vObj[k].trim() === target && typeof tObj[k] === 'string' && tObj[k].trim()) {
                    return tObj[k];
                }
            }
        }
        return '';
    }

    function apiMessage(resp, fallback) {
        if (!resp || typeof resp !== 'object') return fallback || '';
        const fb = resp.message || resp.error || fallback || '';
        if (resp.code) {
            const key = 'api.' + resp.code;
            const resolved = deepGet(dicts[currentLang], key);
            if (resolved !== undefined) {
                return formatVars(resolved, resp.params || {});
            }
            if (currentLang === 'vi' && resp.message) return resp.message;
            const viResolved = deepGet(dicts.vi, key);
            if (viResolved !== undefined) {
                return formatVars(viResolved, resp.params || {});
            }
        }
        if (currentLang !== 'vi' && fb) {
            const rev = findReverseTranslation(fb);
            if (rev) return rev;
        }
        return fb;
    }

    function notifText(notif) {
        if (!notif || typeof notif !== 'object') return { title: '', message: '' };
        let params = {};
        if (notif.msg_params_json && typeof notif.msg_params_json === 'object') {
            params = notif.msg_params_json;
        } else if (typeof notif.msg_params_json === 'string' && notif.msg_params_json.trim()) {
            try { params = JSON.parse(notif.msg_params_json); } catch (e) { safeDebug('notifParams', e); }
        }
        if (!params.table && notif.table_code) params.table = notif.table_code;
        if (!params.order_code && notif.order_code) params.order_code = notif.order_code;
        if (!params.title && notif.title) params.title = notif.title;
        if (!params.message && notif.message) params.message = notif.message;

        const title = notif.title_key
            ? t(notif.title_key, params, notif.title || '')
            : (notif.title || '');
        const message = notif.msg_key
            ? t(notif.msg_key, params, notif.message || '')
            : (notif.message || '');
        return { title: title, message: message };
    }

    function updateSwitcherUi() {
        if (!global.document) return;
        global.document.documentElement.lang = currentLang;
        global.document.querySelectorAll('[data-cnx-lang-btn]').forEach(function (btn) {
            const bLang = (btn.getAttribute('data-cnx-lang-btn') || '').toLowerCase();
            const active = bLang === currentLang;
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            btn.classList.toggle('bg-sky-500', active);
            btn.classList.toggle('text-slate-950', active);
            btn.classList.toggle('shadow-sm', active);
            btn.classList.toggle('text-slate-300', !active);
            btn.classList.toggle('hover:text-white', !active);
        });
    }

    function setElementTranslatedText(el, text) {
        if (!el) return;
        if (!el.children || el.children.length === 0) {
            el.textContent = text;
            return;
        }
        const textNodes = [];
        for (let i = 0; i < el.childNodes.length; i++) {
            const n = el.childNodes[i];
            if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim().length > 0) {
                textNodes.push(n);
            }
        }
        if (textNodes.length > 0) {
            const first = textNodes[0];
            const lead = (first.nodeValue.match(/^\s*/) || [''])[0];
            const trail = (first.nodeValue.match(/\s*$/) || [''])[0];
            first.nodeValue = (lead || ' ') + text + trail;
            for (let j = 1; j < textNodes.length; j++) {
                textNodes[j].nodeValue = '';
            }
            return;
        }
        const spans = el.querySelectorAll('span');
        if (spans.length === 1 && spans[0].children.length === 0) {
            spans[0].textContent = text;
        }
    }

    function getElementDefaultText(el) {
        if (!el) return '';
        if (!el.children || el.children.length === 0) {
            return (el.textContent || '').trim();
        }
        for (let i = 0; i < el.childNodes.length; i++) {
            const n = el.childNodes[i];
            if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) {
                return n.nodeValue.trim();
            }
        }
        const spans = el.querySelectorAll('span');
        if (spans.length === 1 && spans[0].children.length === 0) {
            return (spans[0].textContent || '').trim();
        }
        return (el.textContent || '').trim();
    }

    function dbText(entity, field, fallbackVal, explicitLang) {
        const fb = fallbackVal !== undefined ? fallbackVal : (entity && entity[field] != null ? String(entity[field]) : '');
        const lang = explicitLang || currentLang || 'vi';
        if (!entity || lang === 'vi') return fb;
        let map = entity._i18n_parsed;
        if (!map && entity.i18n_json) {
            if (typeof entity.i18n_json === 'object') {
                map = entity.i18n_json;
            } else if (typeof entity.i18n_json === 'string' && entity.i18n_json.trim().startsWith('{')) {
                try { map = JSON.parse(entity.i18n_json); } catch (_) { map = {}; }
            }
            try { entity._i18n_parsed = map || {}; } catch (e) { safeDebug('dbTextCache', e); }
        }
        if (map && map[lang] && typeof map[lang] === 'object' && map[lang][field]) {
            return String(map[lang][field]);
        }
        if (map && map.en && typeof map.en === 'object' && map.en[field]) {
            return String(map.en[field]);
        }
        return fb;
    }

    function applyDom(root) {
        const scope = root || global.document;
        if (!scope || !scope.querySelectorAll) return;

        scope.querySelectorAll('[data-i18n]').forEach(function (el) {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            if (!el.hasAttribute('data-i18n-default')) {
                el.setAttribute('data-i18n-default', getElementDefaultText(el));
            }
            const defTxt = el.getAttribute('data-i18n-default') || '';
            const resolved = deepGet(dicts[currentLang], key);
            const targetTxt = resolved !== undefined ? resolved : (currentLang === 'vi' ? defTxt : (deepGet(dicts.vi, key) || defTxt));
            setElementTranslatedText(el, targetTxt);
        });

        scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            const key = el.getAttribute('data-i18n-placeholder');
            if (!key) return;
            if (!el.hasAttribute('data-i18n-ph-default')) {
                el.setAttribute('data-i18n-ph-default', el.getAttribute('placeholder') || '');
            }
            const defTxt = el.getAttribute('data-i18n-ph-default') || '';
            const resolved = deepGet(dicts[currentLang], key);
            el.setAttribute('placeholder', resolved !== undefined ? resolved : (currentLang === 'vi' ? defTxt : (deepGet(dicts.vi, key) || defTxt)));
        });

        scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
            const key = el.getAttribute('data-i18n-title');
            if (!key) return;
            if (!el.hasAttribute('data-i18n-title-default')) {
                el.setAttribute('data-i18n-title-default', el.getAttribute('title') || '');
            }
            const defTxt = el.getAttribute('data-i18n-title-default') || '';
            const resolved = deepGet(dicts[currentLang], key);
            el.setAttribute('title', resolved !== undefined ? resolved : (currentLang === 'vi' ? defTxt : (deepGet(dicts.vi, key) || defTxt)));
        });

        updateSwitcherUi();
    }

    async function setLang(lang) {
        const next = String(lang || '').toLowerCase();
        if (SUPPORTED.indexOf(next) < 0) return currentLang;
        currentLang = next;
        try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) { safeDebug('persistLang', e); }
        await ensureLoaded(currentLang);
        applyDom();
        try {
            if (typeof global.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                global.dispatchEvent(new CustomEvent('cnx:lang-changed', { detail: { lang: currentLang } }));
                global.dispatchEvent(new CustomEvent('cybernexus:langchange', { detail: { lang: currentLang } }));
            }
        } catch (e) { safeDebug('dispatchLang', e); }
        return currentLang;
    }

    const readyPromise = (currentLang === 'vi'
        ? ensureLoaded('vi')
        : Promise.all([ensureLoaded('vi'), ensureLoaded(currentLang)])
    ).then(function () {
        if (currentLang !== 'vi') applyDom();
        else updateSwitcherUi();
        try {
            if (typeof global.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                global.dispatchEvent(new CustomEvent('cnx:i18n-ready', { detail: { lang: currentLang } }));
                global.dispatchEvent(new CustomEvent('cnx:lang-changed', { detail: { lang: currentLang } }));
                global.dispatchEvent(new CustomEvent('cybernexus:langchange', { detail: { lang: currentLang } }));
            }
        } catch (e) { safeDebug('dispatchReady', e); }
        return currentLang;
    });

    if (global.document) {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', function () {
                applyDom();
            });
        } else {
            applyDom();
        }
    }

    global.CNX_I18N = {
        getLang: function () { return currentLang; },
        setLang: setLang,
        t: t,
        dbText: dbText,
        apiMessage: apiMessage,
        notifText: notifText,
        mergeDict: mergeDict,
        applyDom: applyDom,
        ready: readyPromise
    };
    global.CyberI18n = global.CNX_I18N;
    global.cnxT = t;
    global.cnxDbText = dbText;
    global.cnxApiMsg = apiMessage;
    global.cnxNotifText = notifText;
})(window);
