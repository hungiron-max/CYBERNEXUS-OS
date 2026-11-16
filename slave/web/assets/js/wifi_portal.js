let _slides = [];
let _slideIdx = 0;

function switchWifiTab(mode) {
    const isFree = mode === 'free';
    document.getElementById('panel-wifi-free').classList.toggle('hidden', !isFree);
    document.getElementById('panel-wifi-vip').classList.toggle('hidden', isFree);
    document.getElementById('tab-wifi-free').className = isFree
        ? 'py-2 rounded-lg bg-sky-500 text-white shadow'
        : 'py-2 rounded-lg text-slate-400 hover:text-white';
    document.getElementById('tab-wifi-vip').className = !isFree
        ? 'py-2 rounded-lg bg-amber-500 text-slate-950 shadow font-black'
        : 'py-2 rounded-lg text-slate-400 hover:text-white';
}

function renderSlide() {
    if (!_slides.length) return;
    const s = _slides[_slideIdx % _slides.length];
    if (s.title) document.getElementById('wifi-ad-title').textContent = s.title;
    if (s.subtitle) document.getElementById('wifi-ad-sub').textContent = s.subtitle;
    if (s.badge_text) document.getElementById('wifi-ad-badge').textContent = s.badge_text;
    const img = document.getElementById('wifi-ad-img');
    if (s.image_url) {
        img.src = s.image_url;
        img.classList.remove('hidden');
    } else {
        img.classList.add('hidden');
    }
    _slideIdx++;
}

async function loadPortalInfo() {
    try {
        const res = await fetch('/api/wifi/portal_info');
        const data = await res.json();
        if (data.success) {
            if (data.store_name) document.getElementById('wifi-store-name').textContent = data.store_name;
            if (data.client_ip) document.getElementById('wifi-client-ip').textContent = data.client_ip;
            if (Array.isArray(data.slides) && data.slides.length > 0) {
                _slides = data.slides;
                renderSlide();
                if (_slides.length > 1) setInterval(renderSlide, 4500);
            }
        }
    } catch (e) {}
}

async function unlockWifi(mode) {
    const out = document.getElementById('wifi-unlock-result');
    out.classList.remove('hidden');
    out.className = 'p-3 rounded-xl text-xs font-bold text-center bg-sky-500/15 border border-sky-400/30 text-sky-200';
    out.textContent = '⏳ Đang kích hoạt kết nối WiFi...';

    const payload = mode === 'vip'
        ? { mode: 'vip', order_code: (document.getElementById('wifi-vip-order').value || '').trim() }
        : {
            mode: 'free',
            customer_name: (document.getElementById('wifi-free-name').value || '').trim(),
            phone: (document.getElementById('wifi-free-phone').value || '').trim()
        };

    try {
        const res = await fetch('/api/wifi/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Không thể kích hoạt WiFi');
        out.className = 'p-3 rounded-xl text-xs font-bold text-center bg-emerald-500/20 border border-emerald-400/40 text-emerald-300';
        out.textContent = `✅ ${data.message}`;
    } catch (e) {
        out.className = 'p-3 rounded-xl text-xs font-bold text-center bg-rose-500/20 border border-rose-400/40 text-rose-300';
        out.textContent = `❌ ${e.message}`;
    }
}

loadPortalInfo();
