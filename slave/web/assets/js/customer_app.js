// ==========================================
// 1. SMART HERO CAROUSEL CONTROLLER
// (Video: phát hết thời lượng clip; Ảnh: delay 6s/hình)
// ==========================================
const CustomerAdCarousel = {
    slides: [],
    index: 0,
    timer: null,
    paused: false,
    soundEnabled: false,

    async init() {
        const container = document.getElementById('customer-ad-slides-container');
        if (!container) return;

        // Try fetching dynamic slides from API
        try {
            const res = await fetch('api/advertising');
            const data = await res.json();
            if (data.success && Array.isArray(data.slides) && data.slides.length > 0) {
                this.renderSlides(data.slides);
            }
        } catch (e) {
            console.log('Using default pre-rendered slides:', e);
        }

        this.bindSlides();
    },

    renderSlides(slidesList) {
        const container = document.getElementById('customer-ad-slides-container');
        const dotsContainer = document.getElementById('customer-ad-dots');
        if (!container || !slidesList.length) return;

        container.innerHTML = '';
        if (dotsContainer) dotsContainer.innerHTML = '';

        const formatLabel = (rawLabel, isVid) => {
            if (!rawLabel) return { text: isVid ? 'VIDEO TRẢI NGHIỆM' : (window.cnxT?window.cnxT('js.s_ext.20d5aa06','ƯU ĐÃI ĐẶC BIỆT'):'ƯU ĐÃI ĐẶC BIỆT'), icon: isVid ? 'fa-play' : 'fa-sparkles', badge: isVid ? 'border-sky-300/40 bg-gradient-to-r from-sky-500/25 to-indigo-500/25 text-sky-200' : 'border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-200' };
            const s = String(rawLabel).trim();
            if (s === 'KM1') return { text: (window.cnxT?window.cnxT('ui.cust_html.span_954e33e1','ƯU ĐÃI ĐẶC BIỆT · KM1'):'ƯU ĐÃI ĐẶC BIỆT · KM1'), icon: 'fa-sparkles', badge: 'border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-200' };
            if (s === 'KM2') return { text: (window.cnxT?window.cnxT('ui.cust_html.span_3fb7a9be','MÓN BÁN CHẠY NHẤT · KM2'):'MÓN BÁN CHẠY NHẤT · KM2'), icon: 'fa-fire', badge: 'border-rose-300/40 bg-gradient-to-r from-rose-500/25 to-orange-500/25 text-rose-200' };
            if (s === 'KM3') return { text: (window.cnxT?window.cnxT('js.s_ext.fbc136cf','MÓN MỚI TUẦN NÀY · KM3'):'MÓN MỚI TUẦN NÀY · KM3'), icon: 'fa-star', badge: 'border-emerald-300/40 bg-gradient-to-r from-emerald-500/25 to-teal-500/25 text-emerald-200' };
            if (s === 'QC1') return { text: (window.cnxT?window.cnxT('ui.cust_html.span_19b0629a','VIDEO TRẢI NGHIỆM · QC1'):'VIDEO TRẢI NGHIỆM · QC1'), icon: 'fa-play', badge: 'border-sky-300/40 bg-gradient-to-r from-sky-500/25 to-indigo-500/25 text-sky-200' };
            if (s === 'QC2') return { text: (window.cnxT?window.cnxT('js.s_ext.c9125872','KHÁM PHÁ GÓC PHỐ · QC2'):'KHÁM PHÁ GÓC PHỐ · QC2'), icon: 'fa-compass', badge: 'border-purple-300/40 bg-gradient-to-r from-purple-500/25 to-fuchsia-500/25 text-purple-200' };
            if (/^KM/i.test(s)) return { text: `${window.cnxT?window.cnxT('js.s_ext.543d3424','ƯU ĐÃI ·'):'ƯU ĐÃI ·'} ${s}`, icon: 'fa-sparkles', badge: 'border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-200' };
            if (/^QC/i.test(s)) return { text: `${window.cnxT?window.cnxT('js.s_ext.66acd33b','QUẢNG CÁO ·'):'QUẢNG CÁO ·'} ${s}`, icon: 'fa-video', badge: 'border-sky-300/40 bg-gradient-to-r from-sky-500/25 to-indigo-500/25 text-sky-200' };
            return { text: s.toUpperCase(), icon: isVid ? 'fa-play' : 'fa-sparkles', badge: 'border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-200' };
        };

        slidesList.forEach((slide, idx) => {
            const isVideo = slide.media_type === 'video';
            const duration = isVideo ? 0 : (Number(slide.duration) || 6);
            const isActive = idx === 0;
            const meta = formatLabel(slide.label, isVideo);

            const article = document.createElement('article');
            article.className = `customer-ad-slide ${isActive ? 'is-active' : ''} ${isVideo ? 'is-video' : ''}`;
            article.dataset.adIndex = String(idx);
            article.dataset.adDuration = String(duration);

            if (isVideo) {
                article.innerHTML = `
                    <video class="absolute inset-0 h-full w-full object-cover" src="${slide.media_path}" muted playsinline preload="auto"></video>
                    <div class="relative z-10 flex h-full w-full flex-col items-start justify-end px-3.5 pb-10 sm:px-6 sm:pb-12 max-w-xl">
                        <span class="inline-flex items-center gap-1.5 rounded-full border ${meta.badge} bg-slate-950/70 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-lg">
                            <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                            <i class="fas ${meta.icon} text-[9px]"></i> ${meta.text}
                        </span>
                        <h3 class="mt-1 text-sm sm:text-base font-black leading-snug slide-title-rainbow">${slide.title || (window.cnxT?window.cnxT('js.s_cust.a4766bc0','Video Trải Nghiệm Góc Phố'):'Video Trải Nghiệm Góc Phố')}</h3>
                        <p class="mt-0.5 text-[11px] sm:text-xs leading-relaxed max-w-md line-clamp-1 sm:line-clamp-2 slide-desc-crisp">${slide.description || ''}</p>
                    </div>
                    <button type="button" onclick="CustomerAdCarousel.toggleSound()" class="customer-ad-sound absolute top-3 right-3 z-30 h-7 w-7 sm:h-8 sm:w-8 rounded-full border border-white/20 bg-slate-950/70 text-xs text-white backdrop-blur flex items-center justify-center hover:bg-white/20" title="Bật/Tắt tiếng">
                        <i class="fas fa-volume-xmark"></i>
                    </button>
                `;
            } else {
                article.innerHTML = `
                    <img class="absolute inset-0 h-full w-full object-cover object-center" src="${slide.media_path}" alt="${slide.title}" />
                    <div class="relative z-10 flex h-full w-full flex-col items-start justify-end px-3.5 pb-10 sm:px-6 sm:pb-12 max-w-xl">
                        <span class="inline-flex items-center gap-1.5 rounded-full border ${meta.badge} bg-slate-950/70 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-lg">
                            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            <i class="fas ${meta.icon} text-[9px]"></i> ${meta.text}
                        </span>
                        <h2 class="mt-1 text-sm sm:text-base lg:text-lg font-black leading-snug tracking-tight slide-title-rainbow">${slide.title}</h2>
                        <p class="mt-0.5 max-w-md text-[11px] sm:text-xs leading-relaxed line-clamp-1 sm:line-clamp-2 slide-desc-crisp">${slide.description || ''}</p>
                    </div>
                `;
            }
            container.appendChild(article);

            if (dotsContainer) {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = `customer-ad-dot h-1.5 rounded-full transition-all ${isActive ? 'w-7 bg-white' : 'w-2 bg-white/45'}`;
                dot.onclick = () => CustomerAdCarousel.show(idx);
                dotsContainer.appendChild(dot);
            }
        });
    },

    bindSlides() {
        this.slides = Array.from(document.querySelectorAll('#customer-ad-slides-container .customer-ad-slide'));
        if (!this.slides.length) return;

        this.index = 0;
        this.slides.forEach((slide, sIdx) => {
            const video = slide.querySelector('video');
            if (video) {
                video.loop = false;
                // Video kết thúc -> tự động chuyển sang slide tiếp theo
                video.addEventListener('ended', () => {
                    if (!this.paused && this.index === sIdx) {
                        this.next();
                    }
                });
                video.addEventListener('error', () => {
                    console.warn('Video failed, advancing slide');
                    if (!this.paused && this.index === sIdx) {
                        this.next();
                    }
                });
            }
        });

        this.show(0);
    },

    show(idx) {
        if (!this.slides.length) return;
        this.index = (idx + this.slides.length) % this.slides.length;

        this.slides.forEach((slide, sIdx) => {
            const active = sIdx === this.index;
            slide.classList.toggle('is-active', active);
            const video = slide.querySelector('video');
            if (video) {
                if (active) {
                    video.currentTime = 0;
                    video.muted = !this.soundEnabled;
                    video.play().catch(e => console.log('Autoplay muted:', e));
                } else {
                    video.pause();
                }
            }
        });

        // Update indicators
        document.querySelectorAll('.customer-ad-dot').forEach((dot, dIdx) => {
            const active = dIdx === this.index;
            dot.className = `customer-ad-dot h-1.5 rounded-full transition-all ${active ? 'w-7 bg-white' : 'w-2 bg-white/45'}`;
        });

        this.schedule();
    },

    schedule() {
        if (this.timer) clearTimeout(this.timer);
        if (this.paused || this.slides.length < 2) return;

        const currentSlide = this.slides[this.index];
        if (!currentSlide) return;

        // Nếu là video: chờ sự kiện ended, KHÔNG hẹn giờ lặp lại
        const video = currentSlide.querySelector('video');
        if (video) {
            return;
        }

        // Nếu là hình ảnh: hẹn giờ theo duration (mặc định 6 giây)
        const duration = Number(currentSlide.dataset.adDuration) || 6;
        this.timer = setTimeout(() => {
            this.next();
        }, duration * 1000);
    },

    next() {
        this.show(this.index + 1);
    },

    prev() {
        this.show(this.index - 1);
    },

    togglePlayback() {
        this.paused = !this.paused;
        const btn = document.getElementById('customer-ad-toggle');
        if (btn) {
            btn.innerHTML = `<i class="fas fa-${this.paused ? 'play' : 'pause'}"></i>`;
        }
        if (this.paused) {
            if (this.timer) clearTimeout(this.timer);
            const video = this.slides[this.index]?.querySelector('video');
            if (video) video.pause();
        } else {
            const video = this.slides[this.index]?.querySelector('video');
            if (video) video.play().catch((errIgnored) => { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', errIgnored) : console.debug('customer_app.js', errIgnored)); });
            this.schedule();
        }
    },

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const video = this.slides[this.index]?.querySelector('video');
        if (video) {
            video.muted = !this.soundEnabled;
        }
        document.querySelectorAll('.customer-ad-sound i').forEach(icon => {
            icon.className = this.soundEnabled ? 'fas fa-volume-high' : 'fas fa-volume-xmark';
        });
    }
};

// ==========================================
// 2. CUSTOMER ORDERING & CART SYSTEM
// (Tương tự customer.php trong sale-app)
// ==========================================
const CustomerOrdering = {
    cart: {},
    activeCategory: 0,
    currentOrder: null,
    orderMode: 'takeaway',
    appliedPromoCode: '',
    _toastTimer: null,
    _payPollTimer: null,

    async applyCustomerPromo() {
        const inp = document.getElementById('customer-promo-input');
        const fb = document.getElementById('customer-promo-feedback');
        const code = (inp?.value || '').trim().toUpperCase();
        if (!code) {
            this.appliedPromoCode = '';
            if (fb) fb.classList.add('hidden');
            return;
        }
        const pids = Object.keys(this.cart);
        const subtotal = pids.reduce((s, id) => {
            const p = this.getProductInfo(id);
            return s + ((p ? p.price : 0) * (Number(this.cart[id]) || 1));
        }, 0);
        try {
            const res = await fetch('api/promotions?action=validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promo_code: code, subtotal })
            }).then(r => r.json());
            if (fb) fb.classList.remove('hidden');
            if (res.success && res.promo) {
                this.appliedPromoCode = res.promo.code;
                if (fb) {
                    fb.className = 'text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300';
                    fb.textContent = `✅ ${res.message} ${window.cnxT?window.cnxT('js.s_cust.996f24df','(Còn'):'(Còn'} ${this.formatMoney(Math.max(0, subtotal - (res.discount_amount || 0)))} ${window.cnxT?window.cnxT('js.s_cust.72b7fe2d','đ)'):'đ)'}`;
                }
            } else {
                this.appliedPromoCode = '';
                if (fb) {
                    fb.className = 'text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300';
                    fb.textContent = `⚠️ ${res.message || (window.cnxT?window.cnxT('js.s_cust.9d098341','Mã không hợp lệ'):'Mã không hợp lệ')}`;
                }
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); }
    },

    init() {
        try {
            this.cart = JSON.parse(localStorage.getItem('cybernexus_customer_cart') || '{}') || {};
        } catch (e) {
            this.cart = {};
        }
        try {
            const saved = JSON.parse(localStorage.getItem('pos_customer_order_info') || '{}');
            if (saved.name) {
                const n = document.getElementById('customer-order-name');
                if (n && !n.value) n.value = saved.name;
            }
            if (saved.phone) {
                const p = document.getElementById('customer-order-phone');
                if (p && !p.value) p.value = saved.phone;
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); }
        this.renderCart();
        this.loadCatalogI18n();
        if (!this._langBound) {
            this._langBound = true;
            window.addEventListener('cnx:lang-changed', () => {
                this.applyCatalogI18nDom();
                this.renderCart();
            });
        }
    },

    _catalogProductsMap: {},
    _catalogProductsList: [],
    _catalogCategoriesMap: {},
    _catalogCategoriesList: [],
    quickFilterMode: 'all',

    async loadCatalogI18n() {
        try {
            const [pRes, cRes] = await Promise.all([
                fetch('api/products.php', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
                fetch('api/categories.php', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
            ]);
            this._catalogProductsMap = {};
            this._catalogProductsList = [];
            this._catalogCategoriesMap = {};
            this._catalogCategoriesList = [];
            if (pRes && pRes.success && Array.isArray(pRes.data)) {
                pRes.data.forEach(p => {
                    const st = String(p.status || 'active').toLowerCase();
                    if (st === 'inactive' || st === 'hidden' || st === 'deleted') return;
                    this._catalogProductsMap[String(p.id)] = p;
                    this._catalogProductsList.push(p);
                });
            }
            if (cRes && cRes.success && Array.isArray(cRes.data)) {
                cRes.data.forEach(c => {
                    this._catalogCategoriesMap[String(c.id)] = c;
                    this._catalogCategoriesList.push(c);
                });
            }
            this.renderDynamicCategories();
            this.renderDynamicProducts();
            this.applyFilters();
            this.renderCart();
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.loadCatalogI18n', e) : null); }
    },

    renderDynamicCategories() {
        const wrap = document.getElementById('category-filter-pills');
        if (!wrap) return;
        const counts = {};
        let bestCount = 0;
        this._catalogProductsList.forEach(p => {
            const cid = String(p.category_id || 0);
            counts[cid] = (counts[cid] || 0) + 1;
            if (Number(p.is_bestseller || p.featured || 0) > 0 || Number(p.sold_count || 0) > 0) bestCount++;
        });
        const total = this._catalogProductsList.length;
        const activeCls = 'cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500 text-white shadow-md transition-all shrink-0';
        const idleCls = 'cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-all shrink-0';
        const esc = (s) => (window.escapeHtml ? escapeHtml(s) : String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
        let html = `<button type="button" onclick="CustomerOrdering.filterCategory(0, 'all')" class="${(this.activeCategory === 0 && this.quickFilterMode === 'all') ? activeCls : idleCls}">Tất Cả (${total})</button>`;
        if (bestCount > 0 || total > 0) {
            html += `<button type="button" onclick="CustomerOrdering.filterCategory(0, 'bestseller')" class="${this.quickFilterMode === 'bestseller' ? activeCls : idleCls}">🔥 Bán chạy</button>`;
        }
        this._catalogCategoriesList.forEach(c => {
            const cnt = counts[String(c.id)] || 0;
            if (cnt <= 0) return;
            const cName = (typeof window.cnxDbText === 'function') ? window.cnxDbText(c, 'name', c.name) : (c.name || '');
            const isAct = (this.quickFilterMode === 'all' && Number(this.activeCategory) === Number(c.id));
            html += `<button type="button" onclick="CustomerOrdering.filterCategory(${Number(c.id)}, 'all')" class="${isAct ? activeCls : idleCls}">${esc(cName)} (${cnt})</button>`;
        });
        wrap.innerHTML = html;
    },

    renderDynamicProducts() {
        const grid = document.getElementById('products-grid');
        if (!grid) return;
        const esc = (s) => (window.escapeHtml ? escapeHtml(s) : String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
        if (!this._catalogProductsList.length) {
            grid.innerHTML = `<div class="col-span-full py-12 text-center text-xs text-slate-400">Quán hiện chưa có món nào đang mở bán.</div>`;
            return;
        }
        grid.innerHTML = this._catalogProductsList.map(p => {
            const pid = Number(p.id);
            const cid = Number(p.category_id || 0);
            const rawName = p.name || '';
            const trName = (typeof window.cnxDbText === 'function') ? window.cnxDbText(p, 'name', rawName) : rawName;
            const trUnit = (typeof window.cnxDbText === 'function') ? window.cnxDbText(p, 'unit', p.unit || 'phần') : (p.unit || 'phần');
            const price = Number(p.sale_price ?? p.price ?? 0);
            const imgSrc = p.image_path || p.image || 'assets/images/dishes/default_dish.jpg';
            const code = p.code || '';
            const isOos = String(p.status || '').toLowerCase() === 'out_of_stock';
            const isBest = (Number(p.is_bestseller || p.featured || 0) > 0 || Number(p.sold_count || 0) > 0) ? '1' : '0';
            return `
                <div class="product-item liquid-card rounded-2xl p-3 flex flex-col justify-between group transition-all" data-product-id="${pid}" data-category-id="${cid}" data-product-name="${esc(trName)}" data-product-price="${price}" data-bestseller="${isBest}">
                    <div class="space-y-2">
                        <div class="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-white/10 flex items-center justify-center">
                            <img src="${esc(imgSrc)}" alt="${esc(trName)}" class="w-full h-full object-cover object-center" onerror="this.onerror=null;this.src='assets/images/dishes/default_dish.jpg';" loading="lazy" />
                            ${code ? `<div class="absolute top-1.5 left-1.5"><span class="text-[10px] font-mono text-sky-400 font-bold bg-slate-950/85 backdrop-blur-md px-1.5 py-0.5 rounded border border-sky-500/30 shadow">${esc(code)}</span></div>` : ''}
                            ${isOos ? `<div class="absolute inset-0 bg-slate-950/75 flex items-center justify-center"><span class="px-2 py-0.5 rounded-full bg-rose-500/30 border border-rose-400 text-rose-200 text-[10px] font-black uppercase">Hết hàng</span></div>` : ''}
                        </div>
                        <h4 class="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-2 min-h-[2.25rem]">${esc(trName)}</h4>
                    </div>
                    <div class="pt-2 mt-2 border-t border-white/10 space-y-2">
                        <div class="flex items-baseline justify-between gap-1">
                            <span class="text-xs text-slate-400">/ ${esc(trUnit)}</span>
                            <span class="text-sm sm:text-base font-black font-mono text-emerald-400">${this.formatMoney(price)} đ</span>
                        </div>
                        <button type="button" ${isOos ? 'disabled' : `onclick="CustomerOrdering.addItem(${pid})"`} class="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isOos ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-md shadow-sky-500/20 active:scale-95'}">
                            <i class="fas ${isOos ? 'fa-ban' : 'fa-plus'}"></i> <span>${isOos ? 'Tạm hết' : 'Thêm vào giỏ'}</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    applyCatalogI18nDom() {
        this.renderDynamicCategories();
        this.renderDynamicProducts();
        this.applyFilters();
    },

    setOrderMode(mode) {
        if (mode === 'table') mode = 'dine_in';
        this.orderMode = mode;
        const takeBtn = document.getElementById('cart-mode-takeaway');
        const tblBtn = document.getElementById('cart-mode-table');
        const delBtn = document.getElementById('cart-mode-delivery');
        const takeHint = document.getElementById('customer-takeaway-hint');
        const tblWrap = document.getElementById('customer-table-picker-wrap');
        const addrInput = document.getElementById('customer-order-address');

        const activeCls = 'py-1.5 px-1 rounded-md text-[11px] font-bold transition-all bg-sky-600 text-white shadow-sm flex items-center justify-center gap-1';
        const idleCls = 'py-1.5 px-1 rounded-md text-[11px] font-bold transition-all text-slate-400 hover:text-white flex items-center justify-center gap-1';
        if (takeBtn) takeBtn.className = (mode === 'takeaway') ? activeCls : idleCls;
        if (tblBtn) tblBtn.className = (mode === 'dine_in') ? activeCls : idleCls;
        if (delBtn) delBtn.className = (mode === 'delivery') ? activeCls : idleCls;

        if (takeHint) takeHint.classList.toggle('hidden', mode !== 'takeaway');
        if (tblWrap) tblWrap.classList.toggle('hidden', mode !== 'dine_in');
        if (addrInput) addrInput.classList.toggle('hidden', mode !== 'delivery');

        if (mode === 'dine_in') {
            this.loadPublicTables();
        }
    },

    async loadPublicTables() {
        const sel = document.getElementById('customer-table-select');
        if (!sel) return;
        const prevVal = sel.value;
        try {
            const res = await fetch('api/tables?action=public_tables');
            const json = await res.json();
            if (!json.success || !Array.isArray(json.data)) return;
            const dineInTables = json.data.filter(t => t.area_type !== 'MANG_VE' && t.area_type !== 'takeaway' && !String(t.code || '').startsWith('MV'));
            const freeTables = dineInTables.filter(t => t.status === 'free');
            if (freeTables.length === 0) {
                sel.innerHTML = (window.cnxT?window.cnxT('js.s_cust.f5ef3830','<option value="">-- Hiện hết bàn trống (vui lòng chọn Mang Về hoặc hỏi nhân viên) --</option>'):'<option value="">-- Hiện hết bàn trống (vui lòng chọn Mang Về hoặc hỏi nhân viên) --</option>');
            } else {
                sel.innerHTML = (window.cnxT?window.cnxT('js.s_cust.39cad72e','<option value="">-- Chọn bàn trống bạn đang ngồi --</option>'):'<option value="">-- Chọn bàn trống bạn đang ngồi --</option>') +
                    freeTables.map(t => `<option value="${t.id}" data-code="${t.code}">${t.code}${t.name && t.name !== t.code ? ' - ' + t.name : ''} (Đang trống)</option>`).join('');
                const urlParams = new URLSearchParams(window.location.search);
                const qTable = (urlParams.get('table') || urlParams.get('table_code') || '').trim().toUpperCase();
                const qTid = urlParams.get('table_id') || '';
                if (qTid && freeTables.some(t => String(t.id) === qTid)) {
                    sel.value = qTid;
                } else if (qTable) {
                    const match = freeTables.find(t => String(t.code || '').toUpperCase() === qTable);
                    if (match) sel.value = String(match.id);
                } else if (prevVal && freeTables.some(t => String(t.id) === prevVal)) {
                    sel.value = prevVal;
                }
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); }
    },

    showToast(msg) {
        const toast = document.getElementById('customer-cart-toast');
        const msgEl = document.getElementById('customer-cart-toast-msg');
        if (!toast) return;
        if (msgEl) msgEl.textContent = msg || (window.cnxT?window.cnxT('ui.cust_html.span_cf725e6b','Đã thêm món vào giỏ hàng!'):'Đã thêm món vào giỏ hàng!');
        toast.classList.remove('translate-y-4', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.classList.add('translate-y-4', 'opacity-0');
            toast.classList.remove('translate-y-0', 'opacity-100');
        }, 2200);
    },

    itemNotes: {},

    async promptItemNote(pid) {
        const cur = this.itemNotes[pid] || '';
        const p = this.getProductInfo(pid);
        const name = p ? p.name : (window.cnxT?window.cnxT('js.s_cust.1667ffa8','món này'):'món này');
        const note = await window.cnxPrompt(`Ghi chú riêng cho "${name}" (VD: ít đường, không cay, làm kỹ...):`, cur);
        if (note !== null) {
            this.itemNotes[pid] = note.trim();
            this.renderCart();
        }
    },

    saveCart() {
        try {
            localStorage.setItem('cybernexus_customer_cart', JSON.stringify(this.cart));
            localStorage.setItem('cybernexus_customer_cart_notes', JSON.stringify(this.itemNotes));
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); }
    },

    toggleQuickNote(pid, chip) {
        const cur = String(this.itemNotes[pid] || '').split(',').map(s => s.trim()).filter(Boolean);
        const idx = cur.indexOf(chip);
        if (idx >= 0) cur.splice(idx, 1);
        else cur.push(chip);
        this.itemNotes[pid] = cur.join(', ');
        this.saveCart();
        this.renderCart();
    },

    getProductInfo(pid) {
        const pObj = this._catalogProductsMap[String(pid)];
        if (pObj) {
            return {
                id: Number(pObj.id),
                name: (typeof window.cnxDbText === 'function') ? window.cnxDbText(pObj, 'name', pObj.name || '') : (pObj.name || ''),
                price: Number(pObj.sale_price ?? pObj.price ?? 0)
            };
        }
        const card = document.querySelector(`.product-item[data-product-id="${pid}"]`);
        if (!card) return null;
        return {
            id: Number(card.dataset.productId),
            name: card.dataset.productName || '',
            price: Number(card.dataset.productPrice) || 0
        };
    },

    addItem(pid) {
        const p = this.getProductInfo(pid);
        if (!p) return;
        const cur = Number(this.cart[p.id]) || 0;
        this.cart[p.id] = cur + 1;
        this.saveCart();
        this.renderCart();
        this.bounceCartButton();
        this.showToast(`✨ Đã thêm "${p.name}" vào giỏ hàng!`);
    },

    changeQty(pid, delta) {
        const cur = Number(this.cart[pid]) || 0;
        const next = cur + delta;
        if (next <= 0) {
            delete this.cart[pid];
            delete this.itemNotes[pid];
        } else {
            this.cart[pid] = next;
        }
        this.saveCart();
        this.renderCart();
    },

    removeItem(pid) {
        delete this.cart[pid];
        delete this.itemNotes[pid];
        this.saveCart();
        this.renderCart();
    },

    renderCart() {
        const count = Object.values(this.cart).reduce((sum, q) => sum + (Number(q) || 0), 0);
        const badge = document.getElementById('customer-cart-count');
        if (badge) {
            badge.textContent = String(count);
        }

        const bottomTotal = document.getElementById('customer-bottom-total');
        const statusText = document.getElementById('customer-cart-status-text');
        const subHeading = document.getElementById('cart-sheet-subheading');
        const sheetTotalQty = document.getElementById('cart-sheet-total-qty');
        const submitBtnText = document.getElementById('btn-sheet-submit-text');

        const tx = (k, vars, fb) => (typeof window.cnxT === 'function' ? window.cnxT(k, vars, fb) : (fb || k));

        if (statusText) {
            statusText.textContent = count > 0
                ? tx('customer.cart_selecting', { count }, `${window.cnxT?window.cnxT('js.s_cust.963a532e','Đang chọn thêm +'):'Đang chọn thêm +'}${count} ${window.cnxT?window.cnxT('js.s_cust.2600ef09','món mới'):'món mới'}`)
                : tx('customer.cart_empty_status', (window.cnxT?window.cnxT('js.s_cust.708d6946','Chưa chọn món nào'):'Chưa chọn món nào'));
            statusText.className = count > 0 ? 'text-[10px] text-amber-400 font-medium' : 'text-[10px] text-slate-400 font-medium';
        }
        if (subHeading) subHeading.textContent = tx('customer.cart_subheading', { count }, `${window.cnxT?window.cnxT('js.s_cust.f1ccd2ec','Món Mới Gọi Thêm ('):'Món Mới Gọi Thêm ('}${count} ${window.cnxT?window.cnxT('js.s_cust.6ab5ce4d','món)'):'món)'}`);
        if (sheetTotalQty) sheetTotalQty.textContent = String(count);
        if (submitBtnText) submitBtnText.textContent = tx('customer.btn_confirm', (window.cnxT?window.cnxT('ui.sa_html.span_580fef1a','Xác Nhận'):'Xác Nhận'));

        const emptyEl = document.getElementById('customer-cart-empty');
        const activeEl = document.getElementById('customer-cart-active');
        const list = document.getElementById('customer-cart-items');
        const totalEl = document.getElementById('customer-cart-total');
        if (!list || !totalEl) return;

        if (count === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            if (activeEl) activeEl.classList.add('hidden');
            totalEl.textContent = (window.cnxT?window.cnxT('ui.sa_html.div_e995e897','0 đ'):'0 đ');
            if (bottomTotal) bottomTotal.textContent = (window.cnxT?window.cnxT('ui.sa_html.div_e995e897','0 đ'):'0 đ');
            const autoEl = document.getElementById('customer-auto-promo-preview');
            if (autoEl) autoEl.classList.add('hidden');
            return;
        }

        if (emptyEl) emptyEl.classList.add('hidden');
        if (activeEl) activeEl.classList.remove('hidden');

        list.innerHTML = '';
        let total = 0;
        const pids = Object.keys(this.cart);

        pids.forEach(id => {
            const p = this.getProductInfo(id);
            const qty = Number(this.cart[id]) || 0;
            if (!p || qty <= 0) return;
            const lineTotal = p.price * qty;
            total += lineTotal;
            const itemNote = this.itemNotes[id] || '';

            const row = document.createElement('div');
            row.className = 'p-2 sm:p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/40 space-y-1 shadow-md box-border min-w-0';
            row.innerHTML = `
                <div class="flex items-center justify-between gap-2 min-w-0">
                    <span class="font-bold text-xs sm:text-sm text-white truncate min-w-0 flex-1">${p.name}</span>
                    <span class="text-xs sm:text-sm font-black font-mono text-emerald-400 shrink-0">${this.formatMoney(lineTotal)} đ</span>
                </div>
                <div class="flex items-center justify-between gap-1 pt-0.5 min-w-0">
                    <span class="text-xs font-mono font-bold text-amber-400 shrink-0">${this.formatMoney(p.price)} đ</span>
                    <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        <div class="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-lg border border-white/10">
                            <button type="button" onclick="CustomerOrdering.changeQty(${id}, -1)" class="w-5 h-5 sm:w-6 sm:h-6 rounded bg-slate-800 hover:bg-rose-500/30 text-slate-300 hover:text-rose-300 flex items-center justify-center font-bold text-xs transition-colors">−</button>
                            <span class="w-5 text-center text-xs font-mono font-black text-sky-400">${qty}</span>
                            <button type="button" onclick="CustomerOrdering.changeQty(${id}, 1)" class="w-5 h-5 sm:w-6 sm:h-6 rounded bg-slate-800 hover:bg-sky-500/30 text-slate-300 hover:text-sky-300 flex items-center justify-center font-bold text-xs transition-colors">+</button>
                        </div>
                        <button type="button" onclick="CustomerOrdering.promptItemNote(${id})" class="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-colors">
                            <i class="fas fa-pen text-[9px]"></i> <span>${window.cnxT?window.cnxT('ui.admin_html.ph_ad504eea','Ghi chú'):'Ghi chú'}</span>
                        </button>
                        <button type="button" onclick="CustomerOrdering.removeItem(${id})" class="text-[11px] w-6 h-6 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 flex items-center justify-center transition-colors" title="Xóa món">
                            <i class="fas fa-trash-alt text-[9px]"></i>
                        </button>
                    </div>
                </div>
                ${itemNote ? `<div class="text-[10px] text-amber-300/90 italic bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 break-words">Ghi chú: ${itemNote}</div>` : ''}
                <div class="flex flex-wrap gap-1 pt-0.5">
                    ${['Ít đá', 'Không đá', 'Ít ngọt', 'Mang về riêng'].map(chip => {
                        const active = itemNote.split(',').map(s => s.trim()).includes(chip);
                        return `<button type="button" onclick="CustomerOrdering.toggleQuickNote(${id}, '${chip}')" class="px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${active ? 'bg-amber-500/30 border-amber-400 text-amber-200' : 'bg-slate-800/70 border-white/10 text-slate-400 hover:text-white'}">${chip}</button>`;
                    }).join('')}
                </div>
            `;
            list.appendChild(row);
        });

        totalEl.textContent = `${this.formatMoney(total)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;
        if (bottomTotal) bottomTotal.textContent = `${this.formatMoney(total)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;
        this.refreshAutoPromoPreview(total);
    },

    async refreshAutoPromoPreview(subtotal) {
        const previewEl = document.getElementById('customer-auto-promo-preview');
        if (!previewEl) return;
        if (!subtotal || subtotal <= 0 || this.appliedPromoCode) {
            previewEl.classList.add('hidden');
            return;
        }
        try {
            const reqSub = Math.round(subtotal);
            if (this._lastAutoPromoSub !== reqSub || !this._lastAutoPromoRes) {
                const res = await fetch(`api/promotions?action=active&subtotal=${reqSub}`).then(r => r.json());
                this._lastAutoPromoSub = reqSub;
                this._lastAutoPromoRes = res;
            }
            const res = this._lastAutoPromoRes;
            const list = (res && res.success && Array.isArray(res.auto_promotions)) ? res.auto_promotions : [];
            if (!list.length) {
                previewEl.classList.add('hidden');
                return;
            }
            let best = null;
            let bestDisc = 0;
            list.forEach(p => {
                const dType = p.discount_type || 'percent';
                const dVal = Number(p.discount_value || 0);
                const maxCap = Number(p.max_discount_amount || 0);
                let disc = dType === 'percent'
                    ? Math.round((subtotal * Math.min(100, Math.max(0, dVal))) / 100)
                    : Math.min(subtotal, Math.max(0, dVal));
                if (dType === 'percent' && maxCap > 0 && disc > maxCap) disc = maxCap;
                if (disc > bestDisc) {
                    bestDisc = disc;
                    best = p;
                }
            });
            if (!best || bestDisc <= 0) {
                previewEl.classList.add('hidden');
                return;
            }
            const finalTotal = Math.max(0, subtotal - bestDisc);
            const fallbackMsg = `${window.cnxT?window.cnxT('js.s_cust.852de243','🎁 Tự động áp dụng CTKM:'):'🎁 Tự động áp dụng CTKM:'} ${best.name || best.code} (-${this.formatMoney(bestDisc)} ${window.cnxT?window.cnxT('js.s_cust.c62ddfb6','đ) • Tạm tính:'):'đ) • Tạm tính:'} ${this.formatMoney(finalTotal)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;
            previewEl.textContent = typeof window.cnxT === 'function'
                ? '🎁 ' + window.cnxT('customer.auto_promo_applied', {
                    name: best.name || best.code,
                    discount: this.formatMoney(bestDisc),
                    finalTotal: this.formatMoney(finalTotal)
                }, fallbackMsg)
                : fallbackMsg;
            previewEl.classList.remove('hidden');
        } catch (e) {
            previewEl.classList.add('hidden');
        }
    },

    getCartTotal() {
        let total = 0;
        const pids = Object.keys(this.cart || {});
        pids.forEach(id => {
            const p = this.getProductInfo(id);
            const qty = Number(this.cart[id]) || 0;
            if (p && qty > 0) {
                total += (Number(p.price) || 0) * qty;
            }
        });
        return total;
    },

    bounceCartButton() {
        const btn = document.getElementById('btn-cart-capsule');
        if (btn) {
            btn.classList.add('scale-105');
            setTimeout(() => btn.classList.remove('scale-105'), 200);
        }
    },

    openCart() {
        const modal = document.getElementById('customer-cart-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    },

    closeCart() {
        const modal = document.getElementById('customer-cart-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    async submitOrderDirect() {
        const pids = Object.keys(this.cart);
        if (!pids.length) {
            alert((window.cnxT?window.cnxT('js.s_cust.20360484','Giỏ hàng đang trống! Vui lòng chọn món trước.'):'Giỏ hàng đang trống! Vui lòng chọn món trước.'));
            return;
        }

        const name = document.getElementById('customer-order-name')?.value.trim();
        const phone = document.getElementById('customer-order-phone')?.value.trim();
        const address = document.getElementById('customer-order-address')?.value.trim();
        const tableSelect = document.getElementById('customer-table-select');
        const selectedTableId = Number(tableSelect?.value || 0);
        const selectedTableCode = tableSelect?.options[tableSelect.selectedIndex]?.dataset?.code || '';
        const note = document.getElementById('customer-order-note')?.value.trim();
        const submitBtn = document.getElementById('btn-sheet-submit');
        const errorBox = document.getElementById('customer-order-error');

        if (!name) {
            alert((window.cnxT?window.cnxT('js.s_cust.0590f0c6','Vui lòng nhập tên của bạn để quán phục vụ chính xác!'):'Vui lòng nhập tên của bạn để quán phục vụ chính xác!'));
            document.getElementById('customer-order-name')?.focus();
            return;
        }
        if (!phone) {
            alert((window.cnxT?window.cnxT('js.s_cust.c8380a8b','Vui lòng nhập số điện thoại để quán liên hệ giao hàng / phục vụ!'):'Vui lòng nhập số điện thoại để quán liên hệ giao hàng / phục vụ!'));
            document.getElementById('customer-order-phone')?.focus();
            return;
        }
        if (this.orderMode === 'dine_in' && selectedTableId <= 0) {
            alert((window.cnxT?window.cnxT('js.s_cust.4fabb7cd','Vui lòng chọn đúng số bàn trống bạn đang ngồi!'):'Vui lòng chọn đúng số bàn trống bạn đang ngồi!'));
            tableSelect?.focus();
            return;
        }
        if (this.orderMode === 'delivery' && !address) {
            alert((window.cnxT?window.cnxT('js.s_cust.5734b82a','Vui lòng nhập địa chỉ giao hàng chi tiết!'):'Vui lòng nhập địa chỉ giao hàng chi tiết!'));
            document.getElementById('customer-order-address')?.focus();
            return;
        }

        if (errorBox) errorBox.classList.add('hidden');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = (window.cnxT?window.cnxT('js.s_cust.1752d35e','<i class="fas fa-spinner fa-spin mr-1"></i> Đang gửi đơn...'):'<i class="fas fa-spinner fa-spin mr-1"></i> Đang gửi đơn...');
        }

        try {
            localStorage.setItem('pos_customer_order_info', JSON.stringify({ name, phone }));
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); }

        const itemNotesSummary = pids
            .filter(id => this.itemNotes[id])
            .map(id => {
                const p = this.getProductInfo(id);
                return `${p ? p.name : id}: ${this.itemNotes[id]}`;
            })
            .join('; ');

        const fullNote = [
            this.orderMode === 'dine_in' ? `${window.cnxT?window.cnxT('js.s_cust.8263542f','Ngồi tại bàn:'):'Ngồi tại bàn:'} ${selectedTableCode}` : (this.orderMode === 'takeaway' ? 'Mang về tại quán' : `${window.cnxT?window.cnxT('js.s_cust.92fbda3c','Giao hàng:'):'Giao hàng:'} ${address}`),
            note ? `${window.cnxT?window.cnxT('js.s_cust.971631de','Ghi chú chung:'):'Ghi chú chung:'} ${note}` : '',
            itemNotesSummary ? `${window.cnxT?window.cnxT('js.s_cust.341b0757','Chi tiết món:'):'Chi tiết món:'} ${itemNotesSummary}` : ''
        ].filter(Boolean).join(' | ');

        const items = pids.map(id => {
            const p = this.getProductInfo(id);
            return {
                id: Number(id),
                quantity: Number(this.cart[id]) || 1,
                price: p ? p.price : 0,
                name: p ? p.name : '',
                note: this.itemNotes[id] || ''
            };
        });

        try {
            const urlSig = new URLSearchParams(window.location.search).get('sig') || '';
            const isTableAppend = (this.orderMode === 'dine_in' && window.CustomerTableLive && window.CustomerTableLive.hasActiveOrder && Number(window.CustomerTableLive.tableId || 0) === Number(selectedTableId || 0));
            const response = await fetch('api/orders?action=customer_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_mode: this.orderMode,
                    append: isTableAppend,
                    customer_name: name,
                    customer_phone: phone,
                    note: fullNote,
                    table_id: this.orderMode === 'dine_in' ? selectedTableId : 0,
                    table_code: this.orderMode === 'dine_in' ? selectedTableCode : (this.orderMode === 'takeaway' ? 'MV' : 'ONLINE'),
                    table_sig: urlSig,
                    promo_code: this.appliedPromoCode || '',
                    items: items
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                if (data && data.table_conflict) {
                    await this.loadPublicTables();
                }
                throw new Error(data.message || (window.cnxT?window.cnxT('js.s_cust.1e21fa82','Không thể tạo đơn hàng.'):'Không thể tạo đơn hàng.'));
            }

            if (data.order_code && data.access_token) {
                try { localStorage.setItem('cbnx_qr_token_' + data.order_code, data.access_token); } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); }
            }

            // Reset cart
            this.cart = {};
            this.itemNotes = {};
            this.saveCart();
            this.renderCart();

            this.currentOrder = data;
            if (isTableAppend && window.CustomerTableLive) {
                this.closeCart();
                await window.CustomerTableLive.refresh();
                window.CustomerTableLive.openSheet();
                this.showToast?.('Đã gửi thêm món vào đơn bàn ' + selectedTableCode + '!');
            } else {
                try {
                    localStorage.setItem('cbnx_last_customer_order', JSON.stringify({ order_code: data.order_code, access_token: data.access_token || '', total_amount: data.total_amount || 0, table_code: data.table_code || '', ts: Date.now() }));
                    const lastBtn = document.getElementById('btn-my-last-order');
                    if (lastBtn && !window.CustomerTableLive?.tableCode) { lastBtn.classList.remove('hidden'); lastBtn.classList.add('flex'); }
                } catch (_) {}
                this.showPaymentScreen(data);
                if (this.orderMode === 'dine_in' && window.CustomerTableLive) {
                    window.CustomerTableLive.refresh();
                }
            }
        } catch (err) {
            if (errorBox) {
                errorBox.textContent = err.message || (window.cnxT?window.cnxT('js.s_cust.03481144','Lỗi gửi đơn.'):'Lỗi gửi đơn.');
                errorBox.classList.remove('hidden');
            } else {
                alert(err.message || (window.cnxT?window.cnxT('js.s_cust.03481144','Lỗi gửi đơn.'):'Lỗi gửi đơn.'));
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = (window.cnxT?window.cnxT('js.s_cust.bda2b25d','<i class="fas fa-check-circle mr-1"></i> <span>Xác Nhận</span>'):'<i class="fas fa-check-circle mr-1"></i> <span>Xác Nhận</span>');
            }
        }
    },

    async showPaymentScreen(order) {
        const emptyEl = document.getElementById('customer-cart-empty');
        const activeEl = document.getElementById('customer-cart-active');
        const payment = document.getElementById('customer-order-payment');
        const titleEl = document.getElementById('customer-cart-title');
        const qrSection = document.getElementById('customer-vietqr-section');
        if (emptyEl) emptyEl.classList.add('hidden');
        if (activeEl) activeEl.classList.add('hidden');
        if (payment) payment.classList.remove('hidden');
        if (qrSection) qrSection.classList.remove('hidden');
        if (titleEl && order && order.order_code) {
            titleEl.textContent = `Theo Dõi Đơn ${order.order_code}`;
        }

        document.getElementById('customer-payment-order-code').textContent = order.order_code;
        document.getElementById('customer-payment-total').textContent = `${this.formatMoney(order.total_amount)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;

        let note = `THANH TOAN ${order.order_code}`;
        document.getElementById('customer-payment-note').textContent = note;

        const amount = Math.round(Number(order.total_amount));
        let bankId = 'OCB';
        let accountNo = '0918608073';
        let accountName = 'NGUYEN CHI HUNG';
        let qrUrl = `/api/payment/vietqr_svg?bank_id=${encodeURIComponent(bankId)}&account_no=${encodeURIComponent(accountNo)}&amount=${amount}&add_info=${encodeURIComponent(note)}&account_name=${encodeURIComponent(accountName)}`;
        let qrPayload = order.vietqr_payload || '';

        try {
            const res = await fetch(`api/orders?action=vietqr&amount=${amount}&order_code=${encodeURIComponent(order.order_code)}`);
            const data = await res.json();
            if (data.success) {
                if (data.vietqr_url) qrUrl = data.vietqr_url;
                if (data.vietqr_payload) qrPayload = data.vietqr_payload;
                if (data.bank_id) bankId = data.bank_id;
                if (data.account_no) accountNo = data.account_no;
                if (data.account_name) accountName = data.account_name;
                if (data.note) {
                    note = data.note;
                    document.getElementById('customer-payment-note').textContent = note;
                }
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); }

        const bEl = document.getElementById('customer-payment-bank');
        const aEl = document.getElementById('customer-payment-account');
        const nEl = document.getElementById('customer-payment-account-name');
        if (bEl) bEl.textContent = bankId;
        if (aEl) aEl.textContent = accountNo;
        if (nEl) nEl.textContent = accountName;

        const qrImg = document.getElementById('customer-payment-qr');
        if (qrImg) {
            if (typeof window.cnxRenderVietQr === 'function') {
                window.cnxRenderVietQr(qrImg, { bank_id: bankId, account_no: accountNo, amount: amount, note: note, account_name: accountName, vietqr_url: qrUrl, vietqr_payload: qrPayload });
            } else {
                qrImg.src = qrUrl;
            }
        }

        const stEl = document.getElementById('customer-payment-status');
        const btnMark = document.getElementById('btn-customer-mark-transfer');
        if (btnMark) btnMark.classList.remove('hidden');
        if (stEl) {
            const escTbl = (window.escapeHtml ? escapeHtml(order.table_code) : String(order.table_code || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
            if (order.order_type === 'dine_in') {
                stEl.className = 'text-xs text-amber-300 font-semibold p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20';
                stEl.innerHTML = `🪑 Đơn bàn <b>${escTbl}</b> đang chờ nhân viên xác nhận bàn. Bạn có thể quét VietQR thanh toán trước hoặc thanh toán tại quầy.`;
            } else {
                stEl.className = 'text-xs text-amber-300 font-semibold p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20';
                stEl.innerHTML = `${window.cnxT?window.cnxT('js.s_cust.4c6675fb','⏳ Vui lòng thanh toán VietQR ('):'⏳ Vui lòng thanh toán VietQR ('}${order.order_type === 'takeaway' ? (window.cnxT?window.cnxT('js.s_cust.f0837251','Phiếu '):'Phiếu ') + escTbl : (window.cnxT?window.cnxT('ui.adm_html.span_61048c54','Đơn Online'):'Đơn Online')}) để Thu ngân xác nhận <b>${window.cnxT?window.cnxT('js.s_cust.9a34bc5b','Chuyển Bếp'):'Chuyển Bếp'}</b>.`;
            }
        }
        if (this._payPollTimer) clearInterval(this._payPollTimer);
        this._payPollInFlight = false;
        this.checkOrderStatus(true);
        this._payPollTimer = setInterval(async () => {
            if (this._payPollInFlight) return;
            this._payPollInFlight = true;
            try {
                await this.checkOrderStatus(true);
            } finally {
                this._payPollInFlight = false;
            }
        }, 3000);
    },

    async markTransferSent() {
        if (!this.currentOrder || !this.currentOrder.order_code) return;
        const btn = document.getElementById('btn-customer-mark-transfer');
        if (btn) btn.disabled = true;
        try {
            const res = await fetch('api/orders?action=customer_mark_transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_code: this.currentOrder.order_code,
                    access_token: this.currentOrder.access_token || ''
                })
            });
            const data = await res.json();
            if (data.success) {
                const stEl = document.getElementById('customer-payment-status');
                if (stEl) {
                    stEl.className = 'text-xs text-sky-300 font-semibold p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30';
                    stEl.innerHTML = (window.cnxT?window.cnxT('js.s_cust.8834da24','🔎 Đã báo Thu ngân! Hệ thống đang đối soát chuyển khoản để chuyển Bếp...'):'🔎 Đã báo Thu ngân! Hệ thống đang đối soát chuyển khoản để chuyển Bếp...');
                }
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); } finally {
            if (btn) btn.disabled = false;
        }
    },

    async checkOrderStatus(silent = false) {
        if (!this.currentOrder || !this.currentOrder.order_code) return;
        const code = this.currentOrder.order_code;
        const accTok = encodeURIComponent(this.currentOrder.access_token || '');
        const stEl = document.getElementById('customer-payment-status');
        const btnMark = document.getElementById('btn-customer-mark-transfer');
        try {
            const [payRes, custRes] = await Promise.all([
                fetch(`api/orders?action=check_payment&order_code=${encodeURIComponent(code)}&access_token=${accTok}`).then(r => r.json()).catch(() => null),
                fetch(`api/orders?action=customer_status&token=${encodeURIComponent(code)}&access_token=${accTok}`).then(r => r.json()).catch(() => null)
            ]);
            const d = (payRes && payRes.success && payRes.data) ? payRes.data : null;
            const o = (custRes && custRes.success && custRes.order) ? custRes.order : d;
            const items = (custRes && custRes.success && Array.isArray(custRes.items)) ? custRes.items : null;
            if (items) {
                this.renderLiveItemsTracking(items, o);
            }
            if (d && d.payment_status === 'paid') {
                if (btnMark) btnMark.classList.add('hidden');
                const qrSec = document.getElementById('customer-vietqr-section');
                if (qrSec) qrSec.classList.add('hidden');
            }
            if (o && (o.status === 'completed' || o.status === 'cancelled')) {
                try {
                    const saved = JSON.parse(localStorage.getItem('cbnx_last_customer_order') || 'null');
                    if (saved && saved.order_code === code) {
                        localStorage.removeItem('cbnx_last_customer_order');
                    }
                } catch (_) {}
                const btnLast = document.getElementById('btn-my-last-order');
                if (btnLast) {
                    btnLast.classList.add('hidden');
                    btnLast.classList.remove('flex');
                }
            }
            if (stEl) {
                if (d && d.payment_status === 'partial') {
                    stEl.className = 'text-xs text-rose-300 font-bold p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30';
                    stEl.innerHTML = `${window.cnxT?window.cnxT('js.s_cust.6b10df6f','⚠️ Số tiền chuyển ('):'⚠️ Số tiền chuyển ('}${this.formatMoney(d.paid_amount)}${window.cnxT?window.cnxT('js.s_cust.97a07c44','đ) chưa đủ'):'đ) chưa đủ'} ${this.formatMoney(d.total_amount)}${window.cnxT?window.cnxT('js.s_cust.0503407c','đ. Vui lòng liên hệ quầy!'):'đ. Vui lòng liên hệ quầy!'}`;
                } else if (d && d.payment_status === 'verifying') {
                    stEl.className = 'text-xs text-sky-300 font-semibold p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30';
                    stEl.innerHTML = (window.cnxT?window.cnxT('js.s_cust.a796980c','🔎 Thu ngân đang đối soát chuyển khoản của bạn...'):'🔎 Thu ngân đang đối soát chuyển khoản của bạn...');
                } else if (o && (o.status === 'completed' || o.kitchen_status === 'served')) {
                    stEl.className = 'text-xs text-emerald-300 font-semibold p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30';
                    stEl.textContent = o.status === 'completed'
                        ? '🎉 Đơn hàng đã hoàn tất! Cảm ơn quý khách.'
                        : (window.cnxT?window.cnxT('js.s_cust.83ee131a','🍽️ Món đã được bưng ra! Chúc quý khách ngon miệng.'):'🍽️ Món đã được bưng ra! Chúc quý khách ngon miệng.');
                } else if (o && o.kitchen_status === 'ready') {
                    stEl.className = 'text-xs text-sky-300 font-semibold p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30';
                    stEl.textContent = (window.cnxT?window.cnxT('js.s_cust.89f2366d','🍳 Món đã chuẩn bị xong, đang giao tới quý khách!'):'🍳 Món đã chuẩn bị xong, đang giao tới quý khách!');
                } else if (d && d.payment_status === 'paid') {
                    stEl.className = 'text-xs text-emerald-300 font-bold p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30';
                    stEl.textContent = (window.cnxT?window.cnxT('js.s_cust.316074a1','✅ Đã xác nhận thanh toán! Bếp đang chuẩn bị món cho bạn.'):'✅ Đã xác nhận thanh toán! Bếp đang chuẩn bị món cho bạn.');
                } else if (!silent && d) {
                    stEl.className = 'text-xs text-amber-300 font-semibold p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20';
                    stEl.textContent = `${window.cnxT?window.cnxT('js.s_cust.04f26719','⏳ Quán đã nhận đơn ('):'⏳ Quán đã nhận đơn ('}${this.formatMoney(d.total_amount)}${window.cnxT?window.cnxT('js.s_cust.91c820a8','đ), đang chờ xử lý / chế biến!'):'đ), đang chờ xử lý / chế biến!'}`;
                }
            }
            if (o) this.syncReviewBox(o);
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); }
    },

    selectedReviewStars: 0,
    setReviewRating(stars) {
        this.selectedReviewStars = Number(stars) || 0;
        document.querySelectorAll('#customer-review-stars button').forEach(btn => {
            const s = Number(btn.getAttribute('data-star'));
            btn.className = s <= this.selectedReviewStars
                ? 'text-2xl text-amber-400 hover:scale-110 transition-transform drop-shadow'
                : 'text-2xl text-slate-600 hover:scale-110 transition-transform';
        });
    },

    syncReviewBox(order) {
        const box = document.getElementById('customer-review-box');
        const formEl = document.getElementById('customer-review-form');
        const doneEl = document.getElementById('customer-review-done');
        if (!box) return;
        const canReview = order && (order.status === 'completed' || order.kitchen_status === 'served');
        if (!canReview) {
            box.classList.add('hidden');
            return;
        }
        box.classList.remove('hidden');
        const rated = Number(order.customer_rating || 0);
        if (rated > 0) {
            if (formEl) formEl.classList.add('hidden');
            if (doneEl) {
                doneEl.classList.remove('hidden');
                doneEl.innerHTML = `✅ Cảm ơn quý khách đã đánh giá <span class="text-amber-300">${'★'.repeat(rated)}${'☆'.repeat(5 - rated)}</span>!`;
            }
        } else {
            if (formEl) formEl.classList.remove('hidden');
            if (doneEl) doneEl.classList.add('hidden');
            if (!this.selectedReviewStars) this.setReviewRating(5);
        }
    },

    async submitReview() {
        if (!this.currentOrder?.order_code) return;
        const rating = this.selectedReviewStars || 5;
        const comment = (document.getElementById('customer-review-comment')?.value || '').trim();
        const btn = document.getElementById('btn-submit-customer-review');
        if (btn) btn.disabled = true;
        try {
            const res = await fetch('api/orders?action=submit_review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_code: this.currentOrder.order_code,
                    access_token: this.currentOrder.access_token || '',
                    rating,
                    comment
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || (window.cnxT?window.cnxT('js.s_cust.e52a2080','Không thể gửi đánh giá'):'Không thể gửi đánh giá'));
            }
            this.syncReviewBox({ status: 'completed', customer_rating: rating });
        } catch (e) {
            alert(e.message || (window.cnxT?window.cnxT('js.s_cust.b8577377','Lỗi gửi đánh giá'):'Lỗi gửi đánh giá'));
            if (btn) btn.disabled = false;
        }
    },

    resetOrder() {
        this.selectedReviewStars = 0;
        const revBox = document.getElementById('customer-review-box'); if (revBox) revBox.classList.add('hidden');
        const revCmt = document.getElementById('customer-review-comment'); if (revCmt) revCmt.value = '';
        this.appliedPromoCode = '';
        const pInp = document.getElementById('customer-promo-input'); if (pInp) pInp.value = '';
        const pFb = document.getElementById('customer-promo-feedback'); if (pFb) pFb.classList.add('hidden');
        if (this._payPollTimer) { clearInterval(this._payPollTimer); this._payPollTimer = null; }
        this.currentOrder = null;
        const activeEl = document.getElementById('customer-cart-active');
        const payment = document.getElementById('customer-order-payment');
        const titleEl = document.getElementById('customer-cart-title');
        const liveItemsEl = document.getElementById('customer-order-live-items');
        if (payment) payment.classList.add('hidden');
        if (activeEl) activeEl.classList.remove('hidden');
        if (titleEl) titleEl.textContent = (window.cnxT ? window.cnxT('customer.cart_title', 'Danh Sách Món Tại Bàn') : 'Danh Sách Món Tại Bàn');
        if (liveItemsEl) liveItemsEl.innerHTML = '';
        this.renderCart();
        this.closeCart();
    },

    renderLiveItemsTracking(items, orderObj) {
        const container = document.getElementById('customer-order-live-items');
        if (!container) return;
        if (!Array.isArray(items) || items.length === 0) {
            container.innerHTML = '';
            return;
        }
        const esc = (s) => (window.escapeHtml ? escapeHtml(s) : String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
        const fmt = (n) => this.formatMoney(n) + 'đ';
        const orderKStatus = (orderObj && orderObj.kitchen_status) ? String(orderObj.kitchen_status) : '';
        const statusMeta = (st) => {
            const s = st || (orderKStatus === 'awaiting_payment' ? 'awaiting_payment' : 'pending');
            if (s === 'served') return { cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40', icon: 'fa-check-circle', text: 'Đã giao' };
            if (s === 'ready') return { cls: 'bg-sky-500/20 text-sky-300 border-sky-400/40', icon: 'fa-bell-concierge', text: 'Sắp xong / Sắp ra' };
            if (s === 'preparing') return { cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40', icon: 'fa-fire-burner', text: 'Đang pha/nấu' };
            if (s === 'awaiting_payment') return { cls: 'bg-amber-500/20 text-amber-300 border-amber-400/40', icon: 'fa-clock', text: 'Chờ xác nhận TT' };
            return { cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30', icon: 'fa-hourglass-half', text: 'Đang chờ bếp' };
        };
        const totalQty = items.reduce((s, it) => s + Number(it.quantity || 1), 0);
        const doneQty = items.filter(it => it.item_status === 'served' || it.item_status === 'ready').reduce((s, it) => s + Number(it.quantity || 1), 0);
        const servedQty = items.filter(it => it.item_status === 'served').reduce((s, it) => s + Number(it.quantity || 1), 0);
        const pct = totalQty > 0 ? Math.round(((servedQty > 0 ? servedQty : doneQty * 0.5) / totalQty) * 100) : 0;
        const readyItems = items.filter(it => it.item_status === 'ready');
        const waitItems = items.filter(it => it.item_status !== 'ready' && it.item_status !== 'served');
        const servedItems = items.filter(it => it.item_status === 'served');
        const renderGroup = (title, colorCls, arr) => {
            if (!arr.length) return '';
            return `
                <div class="space-y-1.5">
                    <div class="text-[10px] font-black uppercase tracking-wider ${colorCls}">${title} (${arr.length})</div>
                    ${arr.map(it => {
                        const m = statusMeta(it.item_status);
                        return `
                            <div class="p-2.5 rounded-xl bg-slate-800/70 border border-white/10 flex items-center justify-between gap-2 text-xs">
                                <div class="min-w-0">
                                    <div class="font-bold text-white truncate">${Number(it.quantity || 1)}x ${esc(it.product_name)}</div>
                                    ${it.note ? `<div class="text-[10px] text-amber-300 truncate">${esc(it.note)}</div>` : ''}
                                    <div class="text-[10px] font-mono text-slate-400">${fmt(it.subtotal || (Number(it.price || it.unit_price || 0) * Number(it.quantity || 1)))}</div>
                                </div>
                                <span class="px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap shrink-0 flex items-center gap-1 ${m.cls}">
                                    <i class="fas ${m.icon}"></i> ${m.text}
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        };
        container.innerHTML = `
            <div class="p-3 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5">
                <div>
                    <div class="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                        <span>Tiến độ món: ${servedQty}/${totalQty} đã giao</span>
                        <span class="text-emerald-300">${pct}%</span>
                    </div>
                    <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all" style="width:${pct}%"></div>
                    </div>
                </div>
                ${renderGroup('🔔 Sắp xong / Chờ nhận', 'text-sky-300', readyItems)}
                ${renderGroup('⏳ Đang chờ / Chế biến', 'text-amber-300', waitItems)}
                ${renderGroup('✅ Đã hoàn tất', 'text-emerald-300', servedItems)}
            </div>
        `;
    },

    filterCategory(catId, mode = 'all') {
        this.activeCategory = Number(catId) || 0;
        this.quickFilterMode = mode || 'all';
        this.renderDynamicCategories();
        this.applyFilters();
    },

    filterSearch(keyword) {
        this.searchKeyword = (keyword || '').trim().toLocaleLowerCase('vi');
        this.applyFilters();
    },

    applyFilters() {
        const kw = this.searchKeyword || '';
        document.querySelectorAll('.product-item').forEach(el => {
            const itemCat = Number(el.dataset.categoryId);
            const itemName = (el.dataset.productName || '').toLocaleLowerCase('vi');
            const isBest = el.dataset.bestseller === '1';
            const matchMode = (this.quickFilterMode !== 'bestseller' || isBest);
            const matchCat = (this.activeCategory === 0 || itemCat === this.activeCategory);
            const matchSearch = (!kw || itemName.includes(kw));
            el.style.display = (matchMode && matchCat && matchSearch) ? 'flex' : 'none';
        });
    },

    reopenLastOrder() {
        try {
            const raw = JSON.parse(localStorage.getItem('cbnx_last_customer_order') || 'null');
            if (!raw || !raw.order_code || (Date.now() - Number(raw.ts || 0)) > 4 * 3600 * 1000) {
                localStorage.removeItem('cbnx_last_customer_order');
                return;
            }
            this.currentOrder = raw;
            this.openCart();
            this.showPaymentScreen(raw);
        } catch (_) {}
    },

    formatMoney(val) {
        return new Intl.NumberFormat('vi-VN').format(Math.round(Number(val) || 0));
    }
};

// Modal Controls
async function showQuickVietQr() {
    let total = 0;
    if (typeof CustomerOrdering !== 'undefined') {
        if (typeof CustomerOrdering.getCartTotal === 'function') {
            total = CustomerOrdering.getCartTotal();
        } else if (CustomerOrdering.cart) {
            for (const [id, qty] of Object.entries(CustomerOrdering.cart)) {
                const p = CustomerOrdering.getProductInfo(id);
                if (p && Number(qty) > 0) {
                    total += (Number(p.price) || 0) * Number(qty);
                }
            }
        }
        if (total <= 0 && CustomerOrdering.currentOrder?.total_amount) {
            total = Math.round(Number(CustomerOrdering.currentOrder.total_amount) || 0);
        }
    }

    if (total <= 0) {
        alert((window.cnxT?window.cnxT('js.s_cust.0da30d0d','Giỏ món hiện đang trống (0 đ). Vui lòng chọn món trước khi quét mã thanh toán VietQR!'):'Giỏ món hiện đang trống (0 đ). Vui lòng chọn món trước khi quét mã thanh toán VietQR!'));
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tableCode = urlParams.get('table') || urlParams.get('table_code') || urlParams.get('t') || '';
    const orderCode = (typeof CustomerOrdering !== 'undefined' && CustomerOrdering.currentOrder?.order_code) 
        ? CustomerOrdering.currentOrder.order_code 
        : (tableCode ? `BAN ${tableCode}` : 'ONLINE');
    let note = `TT ${orderCode}`;

    const modal = document.getElementById('quick-vietqr-modal');
    const qrImg = document.getElementById('quick-vietqr-img');
    const amtDisplay = document.getElementById('quick-vietqr-amount-display');
    const bankNameEl = document.getElementById('quick-vietqr-bank-name');
    const accNoEl = document.getElementById('quick-vietqr-acc-no');
    const accNameEl = document.getElementById('quick-vietqr-acc-name');
    const noteEl = document.getElementById('quick-vietqr-note-text');

    if (amtDisplay) amtDisplay.textContent = new Intl.NumberFormat('vi-VN').format(total) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
    if (noteEl) noteEl.textContent = note;

    let bankId = 'OCB';
    let accountNo = '0918608073';
    let accountName = 'NGUYEN CHI HUNG';
    let qrUrl = `/api/payment/vietqr_svg?bank_id=${encodeURIComponent(bankId)}&account_no=${encodeURIComponent(accountNo)}&amount=${total}&add_info=${encodeURIComponent(note)}&account_name=${encodeURIComponent(accountName)}`;
    let qrPayload = '';

    try {
        const res = await fetch(`api/orders?action=vietqr&amount=${total}&order_code=${encodeURIComponent(orderCode)}`);
        const data = await res.json();
        if (data.success) {
            if (data.vietqr_url) qrUrl = data.vietqr_url;
            if (data.vietqr_payload) qrPayload = data.vietqr_payload;
            if (data.bank_id) bankId = data.bank_id;
            if (data.account_no) accountNo = data.account_no;
            if (data.account_name) accountName = data.account_name;
            if (data.note) note = data.note;
        }
    } catch (err) {
        console.log('Using default VietQR config:', err);
    }

    if (qrImg) {
        if (typeof window.cnxRenderVietQr === 'function') {
            window.cnxRenderVietQr(qrImg, { bank_id: bankId, account_no: accountNo, amount: total, note: note, account_name: accountName, vietqr_url: qrUrl, vietqr_payload: qrPayload });
        } else {
            qrImg.src = qrUrl;
        }
    }
    if (bankNameEl) bankNameEl.textContent = bankId + ' Bank';
    if (accNoEl) accNoEl.textContent = accountNo;
    if (accNameEl) accNameEl.textContent = accountName;
    if (noteEl) noteEl.textContent = note;

    if (modal) modal.classList.remove('opacity-0', 'pointer-events-none');
}

function closeQuickVietQr() {
    const modal = document.getElementById('quick-vietqr-modal');
    if (modal) modal.classList.add('opacity-0', 'pointer-events-none');
}

async function handleLogout() {
    if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_cust.86c13e7b','Đăng xuất khỏi tài khoản?'):'Đăng xuất khỏi tài khoản?')))) return;
    try {
        await fetch('api/auth.php?action=logout');
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); }
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
    sessionStorage.clear();
    document.cookie = "pos_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "PHPSESSID=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "pos_remember=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    // Đăng xuất từ trang Khách hàng -> quay về trang Khách hàng (chưa đăng nhập), chỉ hiển thị IP:Port
    window.location.replace('/');
}

async function getCustomerMenuShareUrl() {
    var origin = window.location.origin;
    if (!origin || origin === 'null') {
        origin = window.location.protocol + '//' + window.location.host;
    }
    var host = window.location.hostname;
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        try {
            var res = await fetch('api/settings.php');
            var json = await res.json();
            var d = (json && json.data) ? json.data : {};
            var lanIp = d.server_ip || d.primary_lan_ip || '';
            if (lanIp && lanIp !== '127.0.0.1' && lanIp !== 'localhost') {
                var port = window.location.port ? (':' + window.location.port) : '';
                origin = window.location.protocol + '//' + lanIp + port;
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); }
    }
    return origin + '/customer.html' + (window.location.search || '');
}

async function initHeroCustomerQr() {
    var container = document.getElementById('hero-customer-qr-canvas');
    if (!container) return;
    container.innerHTML = '';
    var url = await getCustomerMenuShareUrl();
    window._cachedCustomerQrUrl = url;
    if (typeof QRCode !== 'undefined') {
        try {
            new QRCode(container, {
                text: url,
                width: 145,
                height: 145,
                colorDark: "#0b0f19",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch(e) {
            console.error("Hero QR render error:", e);
            container.innerHTML = (window.cnxT?window.cnxT('js.s_cust.1d20914f','<span class="text-rose-400 text-xs p-2">Lỗi mã QR</span>'):'<span class="text-rose-400 text-xs p-2">Lỗi mã QR</span>');
        }
    } else {
        container.innerHTML = (window.cnxT?window.cnxT('js.s_cust.d6d1cf5e','<span class="text-slate-400 text-xs p-2">Đang nạp mã QR...</span>'):'<span class="text-slate-400 text-xs p-2">Đang nạp mã QR...</span>');
    }
}

async function copyCustomerDirectUrl() {
    var url = window._cachedCustomerQrUrl || await getCustomerMenuShareUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function() {
            alert((window.cnxT?window.cnxT('js.s_cust.8fc45530','Đã sao chép link gọi món:\n'):'Đã sao chép link gọi món:\n') + url);
        });
    } else {
        var t = document.createElement('textarea');
        t.value = url;
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
        alert((window.cnxT?window.cnxT('js.s_cust.8fc45530','Đã sao chép link gọi món:\n'):'Đã sao chép link gọi món:\n') + url);
    }
}

// ==========================================
// 3. SMART JUKEBOX CONTROLLER (QUÁN & KHÁCH BÀN)
// ==========================================
const CustomerJukebox = {
    tracks: [],
    _tracksSig: '',
    queue: [],
    nowPlaying: null,
    activeTab: 'tracks',
    timer: null,

    async init() {
        // UPG-MED-01: Chỉ hiện Jukebox cho khách đã vào WiFi VIP (hoặc nhân viên đang đăng nhập)
        let isVipOrStaff = Boolean(window.currentUser && window.currentUser.id);
        if (!isVipOrStaff) {
            try {
                const vRes = await fetch('/api/wifi/vip_status', { cache: 'no-store' });
                const vJson = await vRes.json();
                isVipOrStaff = Boolean(vJson && vJson.vip_active);
            } catch (_) {}
        }
        const barEl = document.getElementById('customer-jukebox-bar');
        if (!isVipOrStaff) {
            if (barEl) barEl.classList.add('hidden');
            return;
        }
        if (barEl) barEl.classList.remove('hidden');
        await this.unlockAndShow();
    },

    async unlockAndShow() {
        const barEl = document.getElementById('customer-jukebox-bar');
        if (barEl) barEl.classList.remove('hidden');
        await this.loadStatus();
        await this.loadTracks(true);
        if (this.timer) clearInterval(this.timer);
        this._jukePollInFlight = false;
        this.timer = setInterval(async () => {
            if (this._jukePollInFlight) return;
            this._jukePollInFlight = true;
            try {
                await this.loadStatus();
                await this.loadTracks(true);
            } finally {
                this._jukePollInFlight = false;
            }
        }, 10000);
    },

    async loadStatus() {
        try {
            const res = await fetch('/api/media/jukebox/status');
            const data = await res.json();
            if (data.success) {
                this.nowPlaying = data.now_playing;
                this.queue = data.queue || [];
                this.updateNowPlayingUI();
                this.renderQueueUI();
            }
        } catch (e) {
            console.log('Jukebox status error:', e);
        }
    },

    updateNowPlayingUI() {
        if (!this.nowPlaying) return;
        const title = this.nowPlaying.track_title || (window.cnxT?window.cnxT('js.s_cust.c2d84656','Chưa có bài hát'):'Chưa có bài hát');
        const artist = this.nowPlaying.track_artist || (window.cnxT?window.cnxT('js.s_cust.9c3210e1','Quán Tự Động'):'Quán Tự Động');
        const table = this.nowPlaying.table_name || (window.cnxT?window.cnxT('ui.cust_html.span_a5f81a9d','Hệ Thống'):'Hệ Thống');

        const barTitle = document.getElementById('jukebox-now-title');
        const barArtist = document.getElementById('jukebox-now-artist');
        const barTable = document.getElementById('jukebox-now-table');
        if (barTitle) barTitle.textContent = title;
        if (barArtist) barArtist.textContent = artist;
        if (barTable) barTable.textContent = table;

        const modalTitle = document.getElementById('juke-modal-now-title');
        const modalArtist = document.getElementById('juke-modal-now-artist');
        const modalTable = document.getElementById('juke-modal-now-table');
        if (modalTitle) modalTitle.textContent = title;
        if (modalArtist) modalArtist.textContent = artist;
        if (modalTable) modalTable.textContent = table;
    },

    async loadTracks(silent = false) {
        try {
            const res = await fetch('/api/media/tracks?playable_only=1');
            const data = await res.json();
            if (data.success && Array.isArray(data.tracks)) {
                const sig = data.tracks.map(t => `${t.id}:${t.title}:${t.artist}:${t.genre}`).join('|');
                if (silent && sig === this._tracksSig && this.tracks.length > 0) {
                    return;
                }
                this._tracksSig = sig;
                this.tracks = data.tracks;
                this.filterTracks();
            }
        } catch (e) {
            console.log('Jukebox load tracks error:', e);
        }
    },

    renderTracksUI(list) {
        const container = document.getElementById('juke-tracks-list');
        if (!container) return;

        if (!list || list.length === 0) {
            container.innerHTML = `
                <div class="p-6 text-center text-slate-400 text-xs rounded-xl bg-slate-900/50 border border-white/5">
                    <i class="fas fa-music-slash text-2xl mb-1 text-slate-600 block"></i>
                    ${window.cnxT?window.cnxT('js.s_cust.fa7190dc','Không tìm thấy bài hát phù hợp.'):'Không tìm thấy bài hát phù hợp.'}
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(t => {
            const durSec = Number(t.duration_sec || t.duration || 180);
            const m = Math.floor(durSec / 60);
            const s = Math.floor(durSec % 60);
            const dur = `${m}:${s.toString().padStart(2, '0')}`;
            const safeTitle = (t.title || '').replace(/'/g, "\\'");

            return `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/5 hover:border-purple-500/30 transition-all gap-3">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center justify-center text-xs shrink-0 font-mono">
                            <i class="fas fa-music"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="font-bold text-xs text-white truncate">${escapeHtml(t.title)}</div>
                            <div class="text-[11px] text-slate-400 flex items-center gap-2 truncate mt-0.5">
                                <span>${escapeHtml(t.artist)}</span>
                                <span>•</span>
                                <span class="text-purple-300 font-medium">${escapeHtml(t.genre || 'Music')}</span>
                                <span>•</span>
                                <span class="font-mono text-[10px] text-slate-500">${dur}</span>
                            </div>
                        </div>
                    </div>
                    <button type="button" onclick="CustomerJukebox.requestSong(${t.id}, '${escapeJsAttr(t.title || '')}')" class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all shadow-md shadow-purple-600/20 active:scale-95">
                        <i class="fas fa-plus text-[10px]"></i>
                        <span>${window.cnxT?window.cnxT('js.s_cust.88513a3c','Chọn bài'):'Chọn bài'}</span>
                    </button>
                </div>
            `;
        }).join('');
    },

    renderQueueUI() {
        const countBadge = document.getElementById('juke-queue-count');
        const listEl = document.getElementById('juke-queue-list');
        if (countBadge) countBadge.textContent = this.queue.length;
        if (!listEl) return;

        if (!this.queue || this.queue.length === 0) {
            listEl.innerHTML = `
                <div class="p-6 text-center text-slate-400 text-xs rounded-xl bg-slate-900/50 border border-white/5">
                    <i class="fas fa-compact-disc text-2xl mb-1 text-slate-600 block animate-spin" style="animation-duration: 8s;"></i>
                    ${window.cnxT?window.cnxT('js.s_cust.f952fe30','Hàng đợi đang trống. Hãy là người đầu tiên chọn bài yêu thích!'):'Hàng đợi đang trống. Hãy là người đầu tiên chọn bài yêu thích!'}
                </div>
            `;
            return;
        }

        listEl.innerHTML = this.queue.map((q, idx) => `
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-white/5 hover:border-white/10 transition-all gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-6 h-6 rounded-lg bg-slate-800 text-purple-300 border border-purple-500/20 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        #${idx + 1}
                    </span>
                    <div class="min-w-0">
                        <div class="font-bold text-xs text-white truncate flex items-center gap-1.5">
                            <span class="truncate">${escapeHtml(q.track_title)}</span>
                            ${q.is_priority ? '<span class="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-semibold">VIP</span>' : ''}
                        </div>
                        <div class="text-[11px] text-slate-400 flex items-center gap-2 truncate mt-0.5">
                            <span>${escapeHtml(q.track_artist)}</span>
                            <span>•</span>
                            <span class="text-amber-300 font-semibold">${escapeHtml(q.table_name || (window.cnxT?window.cnxT('js.s_cust.3bfc4cc6','Khách tại bàn'):'Khách tại bàn'))}</span>
                        </div>
                    </div>
                </div>
                <button type="button" onclick="CustomerJukebox.voteSong(${q.id})" class="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/30 border border-rose-500/20 flex items-center gap-1 shrink-0 font-mono transition-all active:scale-95" title="Thả tim / Bình chọn">
                    <i class="fas fa-heart text-[10px]"></i>
                    <span>${q.vote_count || 1}</span>
                </button>
            </div>
        `).join('');
    },

    filterTracks() {
        const kw = (document.getElementById('juke-search-input')?.value || '').toLowerCase().trim();
        const genre = document.getElementById('juke-genre-filter')?.value || 'all';

        let filtered = this.tracks;
        if (genre !== 'all') {
            filtered = filtered.filter(t => (t.genre || '').toLowerCase().includes(genre.toLowerCase()));
        }
        if (kw) {
            filtered = filtered.filter(t =>
                (t.title || '').toLowerCase().includes(kw) ||
                (t.artist || '').toLowerCase().includes(kw)
            );
        }
        this.renderTracksUI(filtered);
    },

    async requestSong(trackId, title) {
        let tableName = (window.cnxT?window.cnxT('js.s_cust.3bfc4cc6','Khách tại bàn'):'Khách tại bàn');
        let tableId = 0;
        try {
            const params = new URLSearchParams(window.location.search);
            const tCode = params.get('table') || params.get('table_code') || params.get('t');
            const tName = params.get('name') || params.get('table_name');
            if (tCode) {
                tableName = tName || `${window.cnxT?window.cnxT('ui.admin_html.th_839747c8','Bàn'):'Bàn'} ${tCode}`;
            }
        } catch (_) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', _) : console.debug('customer_app.js', _)); }

        try {
            const res = await fetch('/api/media/jukebox/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    track_id: trackId,
                    table_name: tableName,
                    table_id: tableId,
                    is_priority: 0
                })
            });
            const data = await res.json();
            if (data.success) {
                this.showNotification('🎵 ' + (data.message || (window.cnxT?window.cnxT('js.s_cust.bdc65d7d','Đã thêm bài hát vào hàng đợi!'):'Đã thêm bài hát vào hàng đợi!')), 'success');
                await this.loadStatus();
                this.switchTab('queue');
            } else {
                this.showNotification('⚠️ ' + (data.message || (window.cnxT?window.cnxT('js.s_cust.cccb6c18','Lỗi yêu cầu bài'):'Lỗi yêu cầu bài')), 'warning');
            }
        } catch (e) {
            this.showNotification((window.cnxT?window.cnxT('js.s_cust.9f3fc2da','❌ Lỗi kết nối: '):'❌ Lỗi kết nối: ') + e.message, 'error');
        }
    },

    async voteSong(queueId) {
        try {
            const res = await fetch('/api/media/jukebox/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queue_id: queueId })
            });
            const data = await res.json();
            if (data.success) {
                this.showNotification((window.cnxT?window.cnxT('js.s_cust.d7778db3','❤️ Đã thả tim bình chọn bài hát!'):'❤️ Đã thả tim bình chọn bài hát!'), 'success');
                this.loadStatus();
            } else {
                this.showNotification(data.message || (window.cnxT?window.cnxT('js.s_med.3f8a253a','Lỗi bình chọn'):'Lỗi bình chọn'), 'warning');
            }
        } catch (e) {
            console.log('Vote song error:', e);
        }
    },

    switchTab(tab) {
        this.activeTab = tab;
        const btnTracks = document.getElementById('tab-btn-juke-tracks');
        const btnQueue = document.getElementById('tab-btn-juke-queue');
        const viewTracks = document.getElementById('juke-tab-tracks');
        const viewQueue = document.getElementById('juke-tab-queue');

        if (tab === 'tracks') {
            btnTracks?.classList.add('bg-purple-600', 'text-white', 'shadow-sm');
            btnTracks?.classList.remove('text-slate-400');
            btnQueue?.classList.remove('bg-purple-600', 'text-white', 'shadow-sm');
            btnQueue?.classList.add('text-slate-400');
            viewTracks?.classList.remove('hidden');
            viewQueue?.classList.add('hidden');
            this.loadTracks(this.tracks.length > 0);
        } else {
            btnQueue?.classList.add('bg-purple-600', 'text-white', 'shadow-sm');
            btnQueue?.classList.remove('text-slate-400');
            btnTracks?.classList.remove('bg-purple-600', 'text-white', 'shadow-sm');
            btnTracks?.classList.add('text-slate-400');
            viewQueue?.classList.remove('hidden');
            viewTracks?.classList.add('hidden');
            this.loadStatus();
        }
    },

    open() {
        const modal = document.getElementById('customer-jukebox-modal');
        if (modal) {
            modal.classList.remove('opacity-0', 'pointer-events-none');
            this.switchTab(this.activeTab);
            this.loadStatus();
        }
    },

    close() {
        const modal = document.getElementById('customer-jukebox-modal');
        if (modal) {
            modal.classList.add('opacity-0', 'pointer-events-none');
        }
    },

    showNotification(text, type = 'info') {
        let toast = document.getElementById('customer-jukebox-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'customer-jukebox-toast';
            toast.className = 'fixed top-4 inset-x-4 max-w-sm mx-auto z-[999] py-2 px-4 rounded-xl text-xs font-bold text-center shadow-xl backdrop-blur-md transition-all duration-300 pointer-events-none opacity-0 transform -translate-y-2';
            document.body.appendChild(toast);
        }

        if (type === 'success') {
            toast.className = 'fixed top-4 inset-x-4 max-w-sm mx-auto z-[999] py-2 px-4 rounded-xl text-xs font-bold text-center shadow-xl backdrop-blur-md transition-all duration-300 pointer-events-none opacity-100 transform translate-y-0 bg-emerald-950/90 text-emerald-200 border border-emerald-500/40';
        } else if (type === 'warning') {
            toast.className = 'fixed top-4 inset-x-4 max-w-sm mx-auto z-[999] py-2 px-4 rounded-xl text-xs font-bold text-center shadow-xl backdrop-blur-md transition-all duration-300 pointer-events-none opacity-100 transform translate-y-0 bg-amber-950/90 text-amber-200 border border-amber-500/40';
        } else if (type === 'error') {
            toast.className = 'fixed top-4 inset-x-4 max-w-sm mx-auto z-[999] py-2 px-4 rounded-xl text-xs font-bold text-center shadow-xl backdrop-blur-md transition-all duration-300 pointer-events-none opacity-100 transform translate-y-0 bg-rose-950/90 text-rose-200 border border-rose-500/40';
        } else {
            toast.className = 'fixed top-4 inset-x-4 max-w-sm mx-auto z-[999] py-2 px-4 rounded-xl text-xs font-bold text-center shadow-xl backdrop-blur-md transition-all duration-300 pointer-events-none opacity-100 transform translate-y-0 bg-purple-950/90 text-purple-200 border border-purple-500/40';
        }

        toast.textContent = text;
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.add('opacity-0', '-translate-y-2');
            toast.classList.remove('opacity-100', 'translate-y-0');
        }, 3000);
    }
};

window.CustomerJukebox = CustomerJukebox;

const CustomerTableLive = {
    tableCode: '',
    tableSig: '',
    tableId: 0,
    hasActiveOrder: false,

    async activateTableWifiVip(orderCode) {
        if (!orderCode) return;
        let devId = localStorage.getItem('cbnx_device_id');
        if (!devId) {
            devId = 'DEV-' + Math.random().toString(36).slice(2, 10);
            localStorage.setItem('cbnx_device_id', devId);
        }
        try {
            const res = await fetch('/api/wifi/unlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'vip', order_code: orderCode, device_id: devId })
            });
            const d = await res.json();
            if (d && d.success) {
                alert(`✅ ${d.message || 'Đã kích hoạt WiFi VIP thành công!'}`);
                if (typeof CustomerJukebox !== 'undefined' && typeof CustomerJukebox.unlockAndShow === 'function') {
                    await CustomerJukebox.unlockAndShow();
                }
            } else {
                alert((d && d.message) || 'Không thể kích hoạt WiFi VIP!');
            }
        } catch (e) {
            alert('Lỗi kết nối khi kích hoạt WiFi VIP!');
        }
    },
    lastData: null,
    pollTimer: null,

    init(code, sig) {
        if (!code || /^MV/i.test(code)) return;
        this.tableCode = code;
        this.tableSig = sig || '';
        const btnLive = document.getElementById('btn-table-live-tracker');
        const btnCall = document.getElementById('btn-call-staff-quick');
        if (btnLive) { btnLive.classList.remove('hidden'); btnLive.classList.add('flex'); }
        if (btnCall) { btnCall.classList.remove('hidden'); btnCall.classList.add('flex'); }
        this.refresh();
        if (this.pollTimer) clearInterval(this.pollTimer);
        this.pollTimer = setInterval(() => {
            if (document.hidden) return;
            const sheet = document.getElementById('customer-table-sheet');
            const isOpen = sheet && !sheet.classList.contains('hidden');
            if (this.hasActiveOrder || isOpen) this.refresh();
        }, 5000);
    },

    async refresh() {
        if (!this.tableCode) return;
        try {
            const url = `api/orders?action=table_live_order&table_code=${encodeURIComponent(this.tableCode)}&table_sig=${encodeURIComponent(this.tableSig)}`;
            const res = await fetch(url, { cache: 'no-store' });
            const d = await res.json();
            if (!d || !d.success) return;
            const prevItems = (this.lastData && this.lastData.items) || [];
            if (prevItems.length && d.items) {
                const prevMap = {};
                prevItems.forEach(x => { prevMap[x.id] = x.item_status; });
                const newlyReady = d.items.find(x => (x.item_status === 'ready' || x.item_status === 'served') && prevMap[x.id] && prevMap[x.id] !== 'ready' && prevMap[x.id] !== 'served');
                if (newlyReady && window.CustomerOrdering && CustomerOrdering.showToast) {
                    CustomerOrdering.showToast(newlyReady.item_status === 'served' ? `✅ ${newlyReady.product_name} đã phục vụ!` : `🍳 ${newlyReady.product_name} đã xong, sắp mang ra!`);
                }
            }
            this.tableId = Number(d.table_id || 0);
            this.hasActiveOrder = Boolean(d.has_order && d.order);
            this.lastData = d;
            this.renderBadge(d);
            this.renderSheet(d);
        } catch (_) {}
    },

    renderBadge(d) {
        const lbl = document.getElementById('btn-table-live-label');
        if (!lbl) return;
        if (!d.has_order || !d.items || !d.items.length) {
            lbl.textContent = `Bàn ${this.tableCode}`;
            return;
        }
        const totalQty = d.items.reduce((s, it) => s + Number(it.quantity || 1), 0);
        const servedQty = d.items.filter(it => it.item_status === 'served').reduce((s, it) => s + Number(it.quantity || 1), 0);
        lbl.textContent = `${this.tableCode} (${servedQty}/${totalQty})`;
    },

    renderSheet(d) {
        const titleEl = document.getElementById('cust-table-sheet-title');
        const subEl = document.getElementById('cust-table-sheet-sub');
        const bodyEl = document.getElementById('customer-table-sheet-body');
        if (!bodyEl) return;
        if (titleEl) titleEl.innerHTML = `<i class="fas fa-chair"></i> <span>Bàn ${this.tableCode} • Đơn Đang Phục Vụ</span>`;
        if (!d || !d.has_order || !d.order) {
            if (subEl) subEl.textContent = 'Bàn chưa có món nào được gửi bếp';
            bodyEl.innerHTML = `<div class="py-8 text-center text-slate-400">Chưa có hóa đơn đang mở tại bàn <b>${this.tableCode}</b>. Hãy chọn món từ thực đơn nhé!</div>`;
            return;
        }
        const ord = d.order;
        const fmt = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
        if (subEl) subEl.textContent = `Mã đơn: ${ord.order_code} • Tạm tính: ${fmt(ord.total_amount)}`;
        const statusMeta = (st) => {
            if (st === 'served') return { cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40', icon: 'fa-check-circle', text: 'Đã đem ra' };
            if (st === 'ready') return { cls: 'bg-sky-500/20 text-sky-300 border-sky-400/40', icon: 'fa-bell-concierge', text: 'Sắp mang ra' };
            if (st === 'preparing') return { cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40', icon: 'fa-fire-burner', text: 'Đang pha/nấu' };
            if (st === 'awaiting_waiter') return { cls: 'bg-amber-500/20 text-amber-300 border-amber-400/40', icon: 'fa-clock', text: 'Chờ duyệt' };
            return { cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30', icon: 'fa-hourglass-half', text: 'Đang chờ bếp' };
        };
        const totalQty = (d.items || []).reduce((s, it) => s + Number(it.quantity || 1), 0);
        const servedQty = (d.items || []).filter(it => it.item_status === 'served').reduce((s, it) => s + Number(it.quantity || 1), 0);
        const pct = totalQty > 0 ? Math.round((servedQty / totalQty) * 100) : 0;
        const readyItems = (d.items || []).filter(it => it.item_status === 'ready');
        const waitItems = (d.items || []).filter(it => it.item_status !== 'ready' && it.item_status !== 'served');
        const servedItems = (d.items || []).filter(it => it.item_status === 'served');
        const renderGroup = (title, colorCls, arr) => {
            if (!arr.length) return '';
            return `
                <div class="space-y-1.5">
                    <div class="text-[10px] font-black uppercase tracking-wider ${colorCls}">${title} (${arr.length})</div>
                    ${arr.map(it => {
                        const m = statusMeta(it.item_status);
                        return `
                            <div class="p-2.5 rounded-xl bg-slate-800/70 border border-white/10 flex items-center justify-between gap-2">
                                <div class="min-w-0">
                                    <div class="font-bold text-white truncate">${it.quantity}x ${it.product_name}</div>
                                    ${it.note ? `<div class="text-[10px] text-amber-300 truncate">${it.note}</div>` : ''}
                                    <div class="text-[10px] font-mono text-slate-400">${fmt(it.subtotal)}</div>
                                </div>
                                <span class="px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap shrink-0 flex items-center gap-1 ${m.cls}">
                                    <i class="fas ${m.icon}"></i> ${m.text}
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        };
        bodyEl.innerHTML = `
            <div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 space-y-2">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="text-[11px] text-emerald-300 font-bold uppercase">Tổng Tạm Tính Bàn ${this.tableCode}</div>
                        <div class="text-[11px] text-slate-400">${ord.payment_status === 'paid' ? 'Đã thanh toán' : 'Thanh toán tại quầy hoặc VietQR'}</div>
                    </div>
                    <div class="text-lg font-black font-mono text-emerald-300">${fmt(ord.total_amount)}</div>
                </div>
                <div>
                    <div class="flex justify-between text-[10px] font-bold text-slate-300 mb-1">
                        <span>Tiến độ phục vụ: ${servedQty}/${totalQty} món</span>
                        <span class="text-emerald-300">${pct}%</span>
                    </div>
                    <div class="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all" style="width:${pct}%"></div>
                    </div>
                </div>
                ${(ord.kitchen_status !== 'awaiting_waiter' && totalQty > 0) ? `
                    <button type="button" onclick="window.CustomerTableLive && CustomerTableLive.activateTableWifiVip('${ord.order_code}')" class="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
                        <i class="fas fa-wifi"></i> <span>Kích hoạt WiFi VIP Bàn (${totalQty} món = ${totalQty} máy)</span>
                    </button>
                ` : ''}
            </div>
            ${renderGroup('🔔 Sắp mang ra bàn', 'text-sky-300', readyItems)}
            ${renderGroup('⏳ Đang chờ / Chế biến', 'text-amber-300', waitItems)}
            ${renderGroup('✅ Đã phục vụ tại bàn', 'text-emerald-300', servedItems)}
        `;
    },

    openSheet() {
        this.refresh();
        const el = document.getElementById('customer-table-sheet');
        if (el) { el.classList.remove('hidden'); el.classList.add('flex'); }
    },
    closeSheet() {
        const el = document.getElementById('customer-table-sheet');
        if (el) { el.classList.add('hidden'); el.classList.remove('flex'); }
    },
    orderMore() {
        this.closeSheet();
        const p = document.getElementById('category-filter-pills');
        if (p) p.scrollIntoView({ behavior: 'smooth' });
    },
    openServiceModal() {
        this.closeSheet();
        const m = document.getElementById('customer-service-modal');
        if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
    },
    closeServiceModal() {
        const m = document.getElementById('customer-service-modal');
        if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    },
    async callService(serviceType) {
        try {
            const res = await fetch('api/orders?action=customer_call_service', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table_code: this.tableCode, table_sig: this.tableSig, service_type: serviceType })
            });
            const d = await res.json();
            this.closeServiceModal();
            if (window.CustomerOrdering && CustomerOrdering.showToast) {
                CustomerOrdering.showToast(d.message || 'Đã gửi yêu cầu hỗ trợ!');
            } else {
                alert(d.message || 'Đã gửi yêu cầu hỗ trợ!');
            }
        } catch (e) {
            alert('Không gửi được yêu cầu, vui lòng thử lại!');
        }
    }
};
window.CustomerTableLive = CustomerTableLive;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    CustomerAdCarousel.init();
    CustomerOrdering.init();
    CustomerJukebox.init();
    initHeroCustomerQr();

    // Auto detect Table QR Order param (?table=TQ1&name=Bàn+01)
    try {
        const params = new URLSearchParams(window.location.search);
        const tableCode = params.get('table') || params.get('table_code') || params.get('t');
        const tableName = params.get('name') || params.get('table_name') || tableCode;
        const tableSig = params.get('sig') || '';
        if (tableCode) {
            CustomerTableLive.init(tableCode, tableSig);
        } else {
            try {
                const raw = JSON.parse(localStorage.getItem('cbnx_last_customer_order') || 'null');
                if (raw && raw.order_code && (Date.now() - Number(raw.ts || 0)) <= 4 * 3600 * 1000) {
                    const lastBtn = document.getElementById('btn-my-last-order');
                    if (lastBtn) { lastBtn.classList.remove('hidden'); lastBtn.classList.add('flex'); }
                }
            } catch (_) {}
        }
        if (tableCode) {
            if (window.CustomerOrdering) {
                window.CustomerOrdering.setOrderMode('table');
                const addrInput = document.getElementById('customer-order-address');
                if (addrInput) addrInput.value = `${tableName || tableCode} (${tableCode})`;
            }
            const header = document.querySelector('header');
            if (header) {
                const banner = document.createElement('div');
                banner.className = 'w-full py-1.5 px-4 bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center justify-between shadow-md z-40';
                banner.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]"><i class="fas fa-chair"></i></span>
                        <span>${window.cnxT?window.cnxT('js.s_cust.4d12d419','Quý khách đang gọi món tại'):'Quý khách đang gọi món tại'} <strong class="underline font-mono">${tableCode} - ${tableName || (window.cnxT?window.cnxT('ui.admin_html.th_839747c8','Bàn'):'Bàn')}</strong></span>
                    </div>
                    <span class="text-[10px] bg-white/20 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">${window.cnxT?window.cnxT('js.s_cust.54255f8e','Phục vụ tại bàn'):'Phục vụ tại bàn'}</span>
                `;
                header.parentNode.insertBefore(banner, header.nextSibling);
            }
        }
    } catch(e) {
        console.error('Table QR detect error:', e);
    }

    // Check logged in user from verified session
    const u = window.currentUser || (() => { try { return JSON.parse(localStorage.getItem('pos_user') || 'null'); } catch(e) { return null; } })();
    if (u) {
        try {
            const zone = document.getElementById('user-nav-zone');
            if (zone) {
                const isAdmin = (u.role === 'admin' || u.is_super_admin === true);
                const roleHomeMap = {
                    waiter: { href: 'order.html', label: (window.cnxT?window.cnxT('ui.ord_html.b_c7307f33','Phục vụ'):'Phục vụ') },
                    cashier: { href: 'index.html', label: (window.cnxT?window.cnxT('ui.ord_html.b_6951ffd8','Thu ngân'):'Thu ngân') },
                    kitchen: { href: 'kitchen.html', label: (window.cnxT?window.cnxT('ui.adm_html.span_590a5f5b','Bếp'):'Bếp') }
                };
                const roleHome = roleHomeMap[u.role];
                const adminBadgeHtml = isAdmin
                    ? `<a href="admin.html" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-amber-500/40 hover:border-amber-400 text-xs shrink-0 whitespace-nowrap shadow-sm transition-all cursor-pointer" title="Quay về Trang Quản Trị (Chủ quán)">
                        <i class="fas fa-crown text-amber-400 text-xs"></i>
                        <span class="hidden sm:inline font-bold text-amber-200">${u.fullname || u.username}</span>
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-400/40">ADMIN</span>
                    </a>`
                    : (roleHome
                        ? `<a href="${roleHome.href}" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-xs shrink-0 whitespace-nowrap shadow-sm transition-all" title="Quay về trang ${roleHome.label}">
                            <i class="fas fa-arrow-left text-sky-300 text-[10px]"></i>
                            <span class="font-bold text-sky-200">${roleHome.label}</span>
                        </a>`
                        : `<span class="w-8 h-8 rounded-xl btn-glass flex items-center justify-center text-sky-300 border border-indigo-500/35 bg-indigo-500/15 shadow-sm shrink-0" title="${u.fullname || u.username}">
                            <i class="fas fa-user-check text-xs"></i>
                        </span>`);
                zone.innerHTML = `
                    <div class="flex items-center gap-1.5 shrink-0">
                        ${adminBadgeHtml}
                        <button type="button" onclick="handleLogout()" class="w-8 h-8 rounded-xl btn-glass bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 hover:text-white flex items-center justify-center border border-rose-500/30 transition-all shrink-0" title="Đăng xuất">
                            <i class="fas fa-sign-out-alt text-xs"></i>
                        </button>
                    </div>
                `;
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('customer_app.js', e) : console.debug('customer_app.js', e)); }
    }
});

window.CustomerOrdering = CustomerOrdering;
