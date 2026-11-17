let _slides = [];
let _slideIdx = 0;
let _freeMinutes = 10;
let _vipMinutes = 180;
let _countdownTimer = null;

function formatVipDuration(mins) {
    if (mins >= 60 && mins % 60 === 0) return `${mins / 60} giờ`;
    if (mins > 60) return `${Math.floor(mins / 60)}g ${mins % 60}p`;
    return `${mins} phút`;
}

function switchWifiTab(mode) {
    const isFree = mode === 'free';
    const panelFree = document.getElementById('panel-wifi-free');
    const panelVip = document.getElementById('panel-wifi-vip');
    const tabFree = document.getElementById('tab-wifi-free');
    const tabVip = document.getElementById('tab-wifi-vip');
    const portalCard = document.getElementById('wifi-portal-card');
    const gaugeArc = document.getElementById('wifi-gauge-arc');
    const gaugeNeedle = document.getElementById('wifi-gauge-needle');
    const speedLabel = document.getElementById('wifi-speed-label');
    const tierPill = document.getElementById('wifi-tier-pill');

    if (panelFree) panelFree.classList.toggle('hidden', !isFree);
    if (panelVip) panelVip.classList.toggle('hidden', isFree);

    if (tabFree) {
        tabFree.className = isFree ? 'wifi-tab-btn wifi-tab-active-free' : 'wifi-tab-btn';
    }
    if (tabVip) {
        tabVip.className = !isFree ? 'wifi-tab-btn wifi-tab-active-vip' : 'wifi-tab-btn';
    }

    if (portalCard) {
        portalCard.classList.toggle('wifi-card-vip', !isFree);
    }

    if (gaugeArc && gaugeNeedle) {
        if (isFree) {
            gaugeArc.style.stroke = '#38bdf8';
            gaugeArc.style.strokeDashoffset = '82';
            gaugeNeedle.style.transform = 'rotate(-10deg)';
        } else {
            gaugeArc.style.stroke = '#fbbf24';
            gaugeArc.style.strokeDashoffset = '12';
            gaugeNeedle.style.transform = 'rotate(66deg)';
        }
    }

    if (speedLabel) {
        speedLabel.innerHTML = isFree
            ? `Tốc độ tối đa <span class="text-[11px] font-semibold text-slate-400">• ${_freeMinutes} phút</span>`
            : `<span class="text-amber-300">Phiên VIP</span> <span class="text-[11px] font-semibold text-amber-200/80">• ${formatVipDuration(_vipMinutes)}</span>`;
    }

    if (tierPill) {
        tierPill.className = isFree
            ? 'px-2.5 py-1 rounded-xl text-[10px] font-black bg-sky-500/20 text-sky-300 border border-sky-400/30'
            : 'px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/25 text-amber-300 border border-amber-400/40';
        tierPill.textContent = isFree ? 'FREE' : 'VIP';
    }
}

function renderSlideDots(activeIdx) {
    const dotsEl = document.getElementById('wifi-ad-dots');
    if (!dotsEl || _slides.length <= 1) {
        if (dotsEl) dotsEl.innerHTML = '';
        return;
    }
    dotsEl.innerHTML = _slides.map((_, idx) => {
        const active = idx === activeIdx;
        return `<span class="h-1.5 rounded-full transition-all duration-300 ${active ? 'w-4 bg-amber-300' : 'w-1.5 bg-white/35'}"></span>`;
    }).join('');
}

function renderSlide() {
    if (!_slides.length) return;
    const currentIdx = _slideIdx % _slides.length;
    const s = _slides[currentIdx];
    if (s.title) document.getElementById('wifi-ad-title').textContent = s.title;
    if (s.subtitle) document.getElementById('wifi-ad-sub').textContent = s.subtitle;
    if (s.badge_text) {
        const badgeEl = document.getElementById('wifi-ad-badge');
        badgeEl.innerHTML = `<i class="fas fa-sparkles text-amber-300"></i> ${escapeHtml(s.badge_text)}`;
    }
    const img = document.getElementById('wifi-ad-img');
    const vec = document.getElementById('wifi-ad-vector');
    if (s.image_url) {
        img.src = s.image_url;
        img.classList.remove('hidden');
        if (vec) vec.classList.add('opacity-20');
    } else {
        img.classList.add('hidden');
        if (vec) vec.classList.remove('opacity-20');
    }
    renderSlideDots(currentIdx);
    _slideIdx++;
}

function launchCelebrationConfetti() {
    const colors = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa'];
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.45;
    for (let i = 0; i < 24; i++) {
        const el = document.createElement('span');
        el.className = 'wifi-confetti-piece';
        const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.4;
        const dist = 70 + Math.random() * 120;
        el.style.left = `${cx}px`;
        el.style.top = `${cy}px`;
        el.style.background = colors[i % colors.length];
        el.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
        el.style.setProperty('--ty', `${Math.sin(angle) * dist + 40}px`);
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1600);
    }
}

async function loadPortalInfo() {
    try {
        const res = await fetch('/api/wifi/portal_info');
        const data = await res.json();
        if (data.success) {
            if (data.store_name) document.getElementById('wifi-store-name').textContent = data.store_name;
            if (data.client_ip) document.getElementById('wifi-client-ip').textContent = data.client_ip;
            if (Number(data.free_minutes) > 0) _freeMinutes = Number(data.free_minutes);
            if (Number(data.vip_minutes) > 0) _vipMinutes = Number(data.vip_minutes);
            const tabFreeMin = document.getElementById('tab-free-min');
            if (tabFreeMin) tabFreeMin.textContent = `${_freeMinutes}p`;
            switchWifiTab('free');
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
    out.className = 'p-3.5 rounded-2xl text-xs font-bold text-center bg-sky-500/15 border border-sky-400/30 text-sky-200';
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
        out.className = 'p-3.5 rounded-2xl text-xs font-bold text-center bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 shadow-lg shadow-emerald-500/15';
        const mins = Number(data.minutes || (mode === 'vip' ? _vipMinutes : _freeMinutes));
        out.innerHTML = `<div class="flex items-center justify-center gap-1.5 text-emerald-300 text-sm mb-1"><i class="fas fa-check-circle"></i> Kết nối thành công!</div><div>${escapeHtml(data.message)}</div><div id="wifi-session-countdown" class="mt-1.5 text-[11px] font-mono text-sky-300"></div>`;
        if (_countdownTimer) clearInterval(_countdownTimer);
        let remSec = mins * 60;
        const updateCd = () => {
            const cdEl = document.getElementById('wifi-session-countdown');
            if (!cdEl) return;
            const h = Math.floor(remSec / 3600);
            const m = Math.floor((remSec % 3600) / 60);
            const s = remSec % 60;
            const fmt = (h > 0 ? `${String(h).padStart(2, '0')}:` : '') + `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            cdEl.textContent = `Thời gian phiên còn lại: ${fmt}`;
            if (remSec > 0) remSec--;
        };
        updateCd();
        _countdownTimer = setInterval(updateCd, 1000);
        launchCelebrationConfetti();
    } catch (e) {
        out.className = 'p-3.5 rounded-2xl text-xs font-bold text-center bg-rose-500/20 border border-rose-400/40 text-rose-200';
        out.textContent = `❌ ${e.message}`;
    }
}

loadPortalInfo();
