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

    async function loadStoreBrand() {
        try {
            const cached = sessionStorage.getItem('cn_store_brand');
            if (cached) {
                applyStoreBrand(JSON.parse(cached));
            }
        } catch (e) {}

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
                } catch (e) {}
            }
        } catch (e) {}

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
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadStoreBrand);
    } else {
        loadStoreBrand();
    }
})();
