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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadStoreBrand);
    } else {
        loadStoreBrand();
    }
})();
