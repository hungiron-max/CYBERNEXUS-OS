/**
 * Admin Back-Office Engine
 * Dashboard, Products CRUD, Categories CRUD, Tables & Revenue Reports
 */

// Helper: Lấy Base URL mạng LAN chính xác cho toàn bộ Standee QR và liên kết chia sẻ
function getAdminBaseUrl() {
    const hostname = window.location.hostname;
    const isLocalhost = (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1');
    if (!isLocalhost && hostname) {
        const origin = window.location.origin && window.location.origin !== 'null' 
            ? window.location.origin 
            : (window.location.protocol + '//' + window.location.host);
        const path = window.location.pathname;
        const dir = path.substring(0, path.lastIndexOf('/'));
        const live = origin + (dir ? dir + '/' : '/');
        localStorage.setItem('server_lan_base_url', live);
        return live;
    }
    const cached = localStorage.getItem('server_lan_base_url');
    if (cached) {
        return cached.endsWith('/') ? cached : (cached + '/');
    }
    const origin = window.location.origin && window.location.origin !== 'null' 
        ? window.location.origin 
        : (window.location.protocol + '//' + window.location.host);
    const path = window.location.pathname;
    const dir = path.substring(0, path.lastIndexOf('/'));
    return origin + (dir ? dir + '/' : '/');
}

/**
 * Smart 4:3 Image Cropper Engine for Dishes
 * High performance HTML5 Canvas 4:3 cropper with interactive pan, zoom, rotate, auto-fit, and instant crop
 */
const DishCropper = {
    modal: null,
    canvas: null,
    ctx: null,
    container: null,
    image: null,
    imageLoaded: false,

    // Transform State
    scale: 1,         // User zoom multiplier (1.0 = base cover scale)
    baseScale: 1,     // Minimal scale required to completely cover the 640x480 frame
    rotation: 0,      // Degrees: 0, 90, 180, 270
    posX: 0,          // Top-left offset in 640x480 canvas coordinates
    posY: 0,

    // Target POS Dish Card Ratio (Strict Standard 4:3)
    targetWidth: 640,
    targetHeight: 480,

    // Interaction dragging
    isDragging: false,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,

    // Callback when crop is confirmed
    onSaveCallback: null,
    _initialized: false,

    init() {
        if (this._initialized) return;
        this.modal = document.getElementById('dish-cropper-modal');
        this.canvas = document.getElementById('dish-cropper-canvas');
        this.container = document.getElementById('cropper-frame-container');
        if (!this.canvas || !this.container) return;
        this.ctx = this.canvas.getContext('2d');

        // Mouse Dragging
        this.container.addEventListener('mousedown', (e) => this.onDragStart(e));
        window.addEventListener('mousemove', (e) => this.onDragMove(e));
        window.addEventListener('mouseup', () => this.onDragEnd());

        // Touch Dragging (for touch POS screens & tablets)
        this.container.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        window.addEventListener('touchend', () => this.onDragEnd());

        // Mouse Wheel Zoom
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.08 : -0.08;
            this.adjustZoom(delta);
        }, { passive: false });

        this._initialized = true;
    },

    openWithFile(file, callback) {
        this.init();
        this.onSaveCallback = callback;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.loadImage(e.target.result);
        };
        reader.readAsDataURL(file);
    },

    openWithUrl(url, callback) {
        this.init();
        this.onSaveCallback = callback;
        this.loadImage(url);
    },

    loadImage(src) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.image = img;
            this.imageLoaded = true;
            this.rotation = 0;
            this.scale = 1;
            const zoomInput = document.getElementById('dish-cropper-zoom');
            const zoomVal = document.getElementById('dish-cropper-zoom-val');
            if (zoomInput) zoomInput.value = 1;
            if (zoomVal) zoomVal.textContent = '100%';

            if (this.modal) this.modal.classList.add('open');
            this.autoCenterFit();
        };
        img.onerror = () => {
            alert('Không thể tải hình ảnh để cắt xén. Vui lòng kiểm tra lại file hoặc đường dẫn ảnh!');
        };
        img.src = src;
    },

    close() {
        if (this.modal) {
            this.modal.classList.remove('open');
        }
        this.isDragging = false;
    },

    /**
     * Smart Auto-fit 4:3: Centers the food subject and covers the full 4:3 frame without black bars
     */
    autoCenterFit() {
        if (!this.imageLoaded || !this.image) return;
        this.rotation = 0;
        this.scale = 1;
        const zoomInput = document.getElementById('dish-cropper-zoom');
        const zoomVal = document.getElementById('dish-cropper-zoom-val');
        if (zoomInput) zoomInput.value = 1;
        if (zoomVal) zoomVal.textContent = '100%';

        const imgW = this.image.naturalWidth || 640;
        const imgH = this.image.naturalHeight || 480;

        // Scale needed to completely fill the 640x480 box
        this.baseScale = Math.max(this.targetWidth / imgW, this.targetHeight / imgH);

        const scaledW = imgW * this.baseScale;
        const scaledH = imgH * this.baseScale;

        // Auto-center in both axes
        this.posX = (this.targetWidth - scaledW) / 2;
        this.posY = (this.targetHeight - scaledH) / 2;

        this.render();
    },

    adjustZoom(delta) {
        const zoomInput = document.getElementById('dish-cropper-zoom');
        if (!zoomInput) return;
        let zoom = parseFloat(zoomInput.value) || 1;
        zoom = Math.min(3.0, Math.max(0.5, zoom + delta));
        zoomInput.value = zoom.toFixed(2);
        this.onZoomChange(zoom);
    },

    onZoomChange(val) {
        if (!this.imageLoaded || !this.image) return;
        const newZoom = parseFloat(val);
        const oldZoom = this.scale;
        if (oldZoom === 0) return;

        // Zoom relative to the center of the 640x480 canvas viewport
        const centerX = this.targetWidth / 2;
        const centerY = this.targetHeight / 2;
        const ratio = newZoom / oldZoom;

        this.posX = centerX - (centerX - this.posX) * ratio;
        this.posY = centerY - (centerY - this.posY) * ratio;
        this.scale = newZoom;

        const zoomVal = document.getElementById('dish-cropper-zoom-val');
        if (zoomVal) zoomVal.textContent = Math.round(newZoom * 100) + '%';

        this.render();
    },

    rotate() {
        if (!this.imageLoaded || !this.image) return;
        this.rotation = (this.rotation + 90) % 360;

        const isRotated90 = (this.rotation === 90 || this.rotation === 270);
        const naturalW = this.image.naturalWidth;
        const naturalH = this.image.naturalHeight;
        const effectiveW = isRotated90 ? naturalH : naturalW;
        const effectiveH = isRotated90 ? naturalW : naturalH;

        this.baseScale = Math.max(this.targetWidth / effectiveW, this.targetHeight / effectiveH);

        const scaledW = effectiveW * this.baseScale * this.scale;
        const scaledH = effectiveH * this.baseScale * this.scale;
        this.posX = (this.targetWidth - scaledW) / 2;
        this.posY = (this.targetHeight - scaledH) / 2;

        this.render();
    },

    reset() {
        this.autoCenterFit();
    },

    onDragStart(e) {
        if (!this.imageLoaded) return;
        this.isDragging = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.startPosX = this.posX;
        this.startPosY = this.posY;
        if (this.container) this.container.style.cursor = 'grabbing';
    },

    onTouchStart(e) {
        if (!this.imageLoaded || e.touches.length !== 1) return;
        this.isDragging = true;
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.startPosX = this.posX;
        this.startPosY = this.posY;
    },

    onDragMove(e) {
        if (!this.isDragging || !this.imageLoaded) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.targetWidth / (rect.width || this.targetWidth);
        const scaleY = this.targetHeight / (rect.height || this.targetHeight);

        const dx = (e.clientX - this.startX) * scaleX;
        const dy = (e.clientY - this.startY) * scaleY;

        this.posX = this.startPosX + dx;
        this.posY = this.startPosY + dy;
        this.render();
    },

    onTouchMove(e) {
        if (!this.isDragging || !this.imageLoaded || e.touches.length !== 1) return;
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.targetWidth / (rect.width || this.targetWidth);
        const scaleY = this.targetHeight / (rect.height || this.targetHeight);

        const dx = (e.touches[0].clientX - this.startX) * scaleX;
        const dy = (e.touches[0].clientY - this.startY) * scaleY;

        this.posX = this.startPosX + dx;
        this.posY = this.startPosY + dy;
        this.render();
    },

    onDragEnd() {
        this.isDragging = false;
        if (this.container) this.container.style.cursor = 'grab';
    },

    render() {
        if (!this.ctx || !this.imageLoaded || !this.image) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.targetWidth, this.targetHeight);
        ctx.save();

        // High quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const naturalW = this.image.naturalWidth;
        const naturalH = this.image.naturalHeight;
        const totalScale = this.baseScale * this.scale;

        if (this.rotation === 0) {
            ctx.drawImage(this.image, this.posX, this.posY, naturalW * totalScale, naturalH * totalScale);
        } else {
            const isRotated90 = (this.rotation === 90 || this.rotation === 270);
            const effectiveW = isRotated90 ? naturalH : naturalW;
            const effectiveH = isRotated90 ? naturalW : naturalH;
            const drawW = effectiveW * totalScale;
            const drawH = effectiveH * totalScale;

            const centerX = this.posX + drawW / 2;
            const centerY = this.posY + drawH / 2;

            ctx.translate(centerX, centerY);
            ctx.rotate((this.rotation * Math.PI) / 180);
            ctx.drawImage(this.image, -(naturalW * totalScale) / 2, -(naturalH * totalScale) / 2, naturalW * totalScale, naturalH * totalScale);
        }

        ctx.restore();
    },

    autoCropAndSaveNow() {
        this.autoCenterFit();
        this.confirmCrop();
    },

    confirmCrop() {
        if (!this.imageLoaded || !this.canvas) return;

        // Render to offscreen canvas to guarantee pristine 640x480 resolution
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.targetWidth;
        exportCanvas.height = this.targetHeight;
        const expCtx = exportCanvas.getContext('2d');
        expCtx.imageSmoothingEnabled = true;
        expCtx.imageSmoothingQuality = 'high';
        expCtx.drawImage(this.canvas, 0, 0);

        let base64;
        try {
            base64 = exportCanvas.toDataURL('image/jpeg', 0.90);
        } catch (e) {
            console.error('Canvas export error:', e);
            base64 = this.canvas.toDataURL('image/jpeg', 0.90);
        }

        this.close();
        if (typeof this.onSaveCallback === 'function') {
            this.onSaveCallback(base64);
        }
    }
};

const Admin = {
    currentTab: 'dashboard',
    products: [],
    categories: [],
    tables: [],
    chartInstance: null,

    renderEmptyState(colspan, icon, title, desc) {
        return `
            <tr>
                <td colspan="${colspan}" class="py-12 px-4 text-center">
                    <div class="inline-flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div class="w-12 h-12 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-400 text-lg shadow-inner mb-3">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="text-sm font-bold text-slate-200 mb-1">${title}</div>
                        <div class="text-xs text-slate-400 leading-relaxed">${desc}</div>
                    </div>
                </td>
            </tr>
        `;
    },

    async init() {
        this.bindNavigation();
        this.switchTab('dashboard');
        await this.loadCategories();
        await this.loadDashboard();
        await this.loadProducts();
        await this.loadTables();
        this.initDishImageDrop();

        // Warm up and cache server LAN base URL from backend settings
        try {
            fetch('api/settings.php')
                .then(r => r.json())
                .then(json => {
                    if (json.success && json.data) {
                        const ip = json.data.server_ip || json.data.primary_lan_ip;
                        const port = json.data.server_port || window.location.port || '8501';
                        if (ip) {
                            const lanBase = `http://${ip}:${port}/`;
                            localStorage.setItem('server_lan_base_url', lanBase);
                        }
                    }
                })
                .catch(() => {});
        } catch (e) {}

        // Check if query string requests cloud sync modal
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('open_sync') === '1') {
            this.openCloudSyncModal();
        }

        // Định kỳ gửi heartbeat giữ trạng thái trực tuyến cho Admin
        const sendAdminHeartbeat = () => { fetch('api/auth.php?action=heartbeat').catch(() => {}); };
        setInterval(sendAdminHeartbeat, 45000);
        window.addEventListener('online', sendAdminHeartbeat);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') sendAdminHeartbeat();
        });
        window.addEventListener('focus', sendAdminHeartbeat);

        // Continuous background synchronization with Jukebox Engine
        if (window.JukeboxEngine) {
            window.JukeboxEngine.addListener(state => this.onJukeboxStateUpdate(state));
        }
    },

    onJukeboxStateUpdate(state) {
        if (!state) return;
        // 1. Update Header Mini Pill
        const disc = document.getElementById('admin-juke-disc');
        const titleEl = document.getElementById('admin-juke-title');
        const artistEl = document.getElementById('admin-juke-artist');
        const playIcon = document.getElementById('admin-juke-play-icon');

        if (state.currentTrack && state.currentTrack.track_title) {
            if (window.JukeboxEngine) {
                window.JukeboxEngine.updateTitleWithMarquee('admin-juke-title', state.currentTrack.track_title);
            } else if (titleEl) {
                titleEl.textContent = state.currentTrack.track_title;
            }
            if (artistEl) artistEl.textContent = state.currentTrack.track_artist || 'Hệ thống';
        } else {
            if (window.JukeboxEngine) {
                window.JukeboxEngine.updateTitleWithMarquee('admin-juke-title', 'Jukebox Âm Nhạc');
            } else if (titleEl) {
                titleEl.textContent = 'Jukebox Âm Nhạc';
            }
            if (artistEl) artistEl.textContent = 'Hệ thống sẵn sàng';
        }

        // 2. Update Media Player Controls & Vinyl in Media Tab
        const ctrlIcon = document.getElementById('jukebox-ctrl-play-icon');
        const ctrlText = document.getElementById('jukebox-ctrl-play-text');
        const vinylIcon = document.getElementById('now-playing-play-icon');
        const vinylDisc = document.getElementById('now-playing-vinyl');

        if (state.isPlaying) {
            if (disc) disc.classList.add('animate-spin');
            if (playIcon) playIcon.className = 'fas fa-pause text-[10px] text-fuchsia-300';
            if (ctrlIcon) ctrlIcon.className = 'fas fa-pause text-xs text-amber-300';
            if (ctrlText) ctrlText.textContent = 'Tạm Dừng';
            if (vinylIcon) vinylIcon.className = 'fas fa-pause text-[9px] text-white';
            if (vinylDisc) vinylDisc.classList.add('animate-spin');
        } else {
            if (disc) disc.classList.remove('animate-spin');
            if (playIcon) playIcon.className = 'fas fa-play text-[10px] text-white';
            if (ctrlIcon) ctrlIcon.className = 'fas fa-play text-xs text-sky-300';
            if (ctrlText) ctrlText.textContent = 'Phát';
            if (vinylIcon) vinylIcon.className = 'fas fa-play text-[9px] text-white';
            if (vinylDisc) vinylDisc.classList.remove('animate-spin');
        }

        // Time and Progress Bar in Media Tab
        const cur = state.currentTime || 0;
        const dur = state.duration || (state.currentTrack ? Number(state.currentTrack.track_duration || state.currentTrack.duration_sec || 180) : 180);
        const curTimeEl = document.getElementById('now-playing-current-time');
        const durTimeEl = document.getElementById('now-playing-duration');
        const progressBar = document.getElementById('now-playing-progress');

        if (curTimeEl) {
            const m = Math.floor(cur / 60);
            const s = Math.floor(cur % 60);
            curTimeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        if (durTimeEl && dur > 0) {
            const m = Math.floor(dur / 60);
            const s = Math.floor(dur % 60);
            durTimeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        if (progressBar && dur > 0) {
            const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
            progressBar.style.width = `${pct}%`;
        }

        // 3. If Media tab is currently open, keep queue and current track display in sync (only when changed)
        if (this.currentTab === 'media') {
            const trackKey = state.currentTrack ? `${state.currentTrack.id || ''}_${state.currentTrack.track_id || ''}_${state.currentTrack.track_title || ''}_${state.currentTrack.vote_count || 0}` : 'none';
            if (this._lastRenderedTrackKey !== trackKey) {
                this._lastRenderedTrackKey = trackKey;
                this.renderNowPlaying(state.currentTrack);
            }
            const queueArr = state.queue || [];
            const queueKey = queueArr.map(q => `${q.id}_${q.vote_count}_${q.is_priority}`).join('|');
            if (this._lastRenderedQueueKey !== queueKey) {
                this._lastRenderedQueueKey = queueKey;
                this.renderMediaQueue(queueArr);
            }
        }
    },

    formatMoney(amount) {
        return new Intl.NumberFormat('vi-VN').format(Math.round(amount || 0));
    },

    bindNavigation() {
        // Direct event delegation for fast navigation
    },

    currentGroup: 'ops',

    switchGroup(group, defaultTab) {
        this.currentGroup = group;

        // 1. Show only target subnav-group
        document.querySelectorAll('.subnav-group').forEach(el => el.classList.add('hidden'));
        const targetSubnav = document.getElementById(`subnav-${group}`);
        if (targetSubnav) targetSubnav.classList.remove('hidden');

        // 2. Highlight Tier 1 group buttons
        const groupStyles = {
            ops: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10',
            menu: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10',
            hr: 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sky-500/10',
            sys: 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-500/10'
        };

        ['ops', 'menu', 'hr', 'sys'].forEach(g => {
            const btn = document.getElementById(`grp-btn-${g}`);
            if (!btn) return;
            if (g === group) {
                btn.className = `group-tab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 border ${groupStyles[g]}`;
            } else {
                btn.className = 'group-tab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 text-slate-400 hover:text-white hover:bg-white/5 border border-transparent';
            }
        });

        // 3. Switch to specified tab or first subtab of this group
        if (defaultTab) {
            this.switchTab(defaultTab);
        } else {
            const firstTabMap = {
                ops: 'dashboard',
                menu: 'products',
                hr: 'users',
                sys: 'finance'
            };
            const firstTab = firstTabMap[group];
            if (firstTab) this.switchTab(firstTab);
        }
    },

    switchTab(tab) {
        this.currentTab = tab;

        const tabMeta = {
            tables: { title: 'Bàn & Khu Vực (QR)', group: 'ops', icon: 'fa-border-all text-emerald-400' },
            dashboard: { title: 'Tổng Quan Doanh Số', group: 'ops', icon: 'fa-chart-line text-sky-400' },
            orders: { title: 'Lịch Sử Hóa Đơn', group: 'ops', icon: 'fa-receipt text-amber-400' },
            products: { title: 'Mặt Hàng (F4)', group: 'menu', icon: 'fa-utensils text-amber-400' },
            categories: { title: 'Nhóm Hàng', group: 'menu', icon: 'fa-layer-group text-sky-400' },
            operations: { title: 'Kho & Chi Phí Vật Liệu', group: 'menu', icon: 'fa-boxes-stacked text-emerald-400' },
            users: { title: 'Nhân Viên & Phân Quyền', group: 'hr', icon: 'fa-users-gear text-indigo-400' },
            analytics: { title: 'Hiệu Suất Bếp & Phục Vụ', group: 'hr', icon: 'fa-chart-pie text-amber-400' },
            finance: { title: 'Báo Cáo Tài Chính', group: 'sys', icon: 'fa-file-invoice-dollar text-teal-400' },
            media: { title: 'Âm Nhạc & Jukebox', group: 'sys', icon: 'fa-compact-disc text-fuchsia-400' },
            settings: { title: 'Cài Đặt Quán & VietQR', group: 'sys', icon: 'fa-cog text-sky-400' }
        };

        const info = tabMeta[tab] || { title: tab, group: 'ops', icon: 'fa-circle-dot text-sky-400' };

        // Ensure parent group is active and visible
        if (this.currentGroup !== info.group) {
            this.switchGroup(info.group, tab);
            return;
        }

        // 1. Update breadcrumb
        const breadcrumb = document.getElementById('active-tab-title');
        if (breadcrumb) {
            breadcrumb.innerHTML = `<i class="fas ${info.icon} mr-1.5"></i>${info.title}`;
        }

        // 2. Highlight Tier 2 sub-buttons
        document.querySelectorAll('.admin-sub-btn').forEach(b => {
            if (b.dataset.tab === tab) {
                b.classList.add('bg-sky-500/25', 'text-sky-300', 'border-sky-500/40', 'shadow-sm');
                b.classList.remove('text-slate-300', 'border-white/5');
            } else {
                b.classList.remove('bg-sky-500/25', 'text-sky-300', 'border-sky-500/40', 'shadow-sm');
                b.classList.add('text-slate-300', 'border-white/5');
            }
        });

        // 3. Highlight mobile bottom nav buttons
        document.querySelectorAll('[data-mobile-tab]').forEach(btn => {
            if (btn.dataset.mobileTab === tab) {
                btn.classList.add('bg-sky-500/20', 'text-sky-400');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('bg-sky-500/20', 'text-sky-400');
                btn.classList.add('text-slate-400');
            }
        });

        document.querySelectorAll('.admin-section').forEach(sec => {
            sec.classList.add('hidden');
        });

        const target = document.getElementById(`tab-${tab}`);
        if (target) target.classList.remove('hidden');

        if (tab === 'dashboard') this.loadDashboard();
        if (tab === 'products') this.loadProducts();
        if (tab === 'categories') this.loadCategories();
        if (tab === 'tables') this.loadTables();
        if (tab === 'users') this.loadUsers();
        if (tab === 'orders') this.loadOrderHistory();
        if (tab === 'analytics') this.loadAnalyticsData();
        if (tab === 'operations') this.loadOperationsTab();
        if (tab === 'finance') this.loadFinance();
        if (tab === 'settings') {
            if (typeof loadStoreSettings === 'function') loadStoreSettings();
        }
        if (tab === 'media') {
            this.loadMediaTab();
            this.startEqWaveAnimation();
        } else {
            this.stopEqWaveAnimation();
        }

        // Keep continuous background synchronization active across all tabs
        if (!this.mediaPollingTimer) {
            this.mediaPollingTimer = setInterval(() => {
                if (window.JukeboxEngine) {
                    window.JukeboxEngine.refreshStatus();
                } else {
                    this.loadMediaJukeboxStatus();
                }
            }, 3500);
        }
    },

    // 1. Dashboard & Reports
    async loadDashboard() {
        try {
            // Metrics summary
            const res = await fetch('api/reports.php?action=summary');
            const data = await res.json();
            if (data.success) {
                const s = data.data;
                const setTxt = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = val;
                };
                setTxt('stat-today-revenue', this.formatMoney(s.today_revenue) + ' đ');
                setTxt('stat-today-orders', s.today_orders);
                setTxt('stat-avg-order', this.formatMoney(s.today_avg_order) + ' đ');
                setTxt('stat-tables-active', `${s.occupied_tables} / ${s.total_tables}`);
                setTxt('stat-month-revenue', this.formatMoney(s.month_revenue) + ' đ');
                setTxt('stat-total-products', s.total_products);
            }

            // Load Revenue Chart
            await this.loadRevenueChart();
            // Load Top Selling
            await this.loadTopSelling();
        } catch (e) {
            console.error('Error loading dashboard:', e);
        }
    },

    currentChartPeriod: '7d',
    chartCustomFrom: '',
    chartCustomTo: '',

    setChartPeriod(period, btn) {
        this.currentChartPeriod = period;
        this.chartCustomFrom = '';
        this.chartCustomTo = '';

        document.querySelectorAll('.chart-period-btn').forEach(b => {
            b.classList.remove('active', 'bg-sky-500', 'text-white', 'font-bold', 'shadow-md', 'shadow-sky-500/30');
            b.classList.add('text-slate-300');
        });
        if (btn) {
            btn.classList.add('active', 'bg-sky-500', 'text-white', 'font-bold', 'shadow-md', 'shadow-sky-500/30');
            btn.classList.remove('text-slate-300');
        }

        const titles = {
            'today': 'Doanh Thu Hôm Nay',
            '7d': 'Doanh Thu 7 Ngày Gần Nhất',
            '14d': 'Doanh Thu 14 Ngày Gần Nhất',
            '30d': 'Doanh Thu 30 Ngày Gần Nhất',
            'month': 'Doanh Thu Tháng Này',
            'last_month': 'Doanh Thu Tháng Trước'
        };
        const titleEl = document.getElementById('chart-title-text');
        if (titleEl) {
            titleEl.textContent = 'Biểu Đồ ' + (titles[period] || 'Doanh Thu');
        }

        this.loadRevenueChart({ period });
    },

    filterCustomChartRange() {
        const fromInput = document.getElementById('chart-date-from');
        const toInput = document.getElementById('chart-date-to');
        if (!fromInput || !toInput) return;

        const fromVal = fromInput.value;
        const toVal = toInput.value;

        if (!fromVal || !toVal) {
            alert('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc!');
            return;
        }

        if (fromVal > toVal) {
            alert('Ngày bắt đầu không được lớn hơn ngày kết thúc!');
            return;
        }

        // Deselect preset pills
        document.querySelectorAll('.chart-period-btn').forEach(b => {
            b.classList.remove('active', 'bg-sky-500', 'text-white', 'font-bold', 'shadow-md', 'shadow-sky-500/30');
            b.classList.add('text-slate-300');
        });

        this.currentChartPeriod = 'custom';
        this.chartCustomFrom = fromVal;
        this.chartCustomTo = toVal;

        const titleEl = document.getElementById('chart-title-text');
        if (titleEl) {
            const fStr = fromVal.split('-').reverse().join('/');
            const tStr = toVal.split('-').reverse().join('/');
            titleEl.textContent = `Biểu Đồ Doanh Thu (${fStr} - ${tStr})`;
        }

        this.loadRevenueChart({ date_from: fromVal, date_to: toVal });
    },

    async loadRevenueChart(params = {}) {
        try {
            let url = 'api/reports.php?action=chart';
            if (params.date_from && params.date_to) {
                url += `&date_from=${encodeURIComponent(params.date_from)}&date_to=${encodeURIComponent(params.date_to)}`;
            } else {
                const period = params.period || this.currentChartPeriod || '7d';
                url += `&period=${encodeURIComponent(period)}`;
            }

            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) return;

            const summary = json.summary || {};
            const summaryBadge = document.getElementById('chart-summary-badge');
            if (summaryBadge) {
                const totalRev = this.formatMoney(summary.total_revenue || 0);
                const totalOrd = summary.total_orders || 0;
                summaryBadge.textContent = `Tổng: ${totalRev} đ (${totalOrd} đơn)`;
            }

            const rangeIndicator = document.getElementById('chart-range-indicator');
            if (rangeIndicator && summary.date_from && summary.date_to) {
                const fStr = summary.date_from.split('-').reverse().join('/');
                const tStr = summary.date_to.split('-').reverse().join('/');
                rangeIndicator.textContent = `Hiển thị ${summary.days_count || json.data.length} ngày (${fStr} - ${tStr})`;
            }

            // Sync date pickers if not custom filtered
            if (!params.date_from && summary.date_from) {
                const fromInput = document.getElementById('chart-date-from');
                const toInput = document.getElementById('chart-date-to');
                if (fromInput) fromInput.value = summary.date_from;
                if (toInput) toInput.value = summary.date_to;
            }

            const ctx = document.getElementById('revenueChart');
            if (!ctx) return;

            const dataList = Array.isArray(json.data) ? json.data : [];
            const labels = dataList.map(d => d.label);
            const revenues = dataList.map(d => d.revenue);
            const orders = dataList.map(d => d.orders);

            if (this.chartInstance) {
                this.chartInstance.destroy();
            }

            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Doanh thu (VNĐ)',
                        data: revenues,
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.15)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.35,
                        pointBackgroundColor: '#38bdf8',
                        pointBorderColor: '#fff',
                        pointHoverRadius: 7,
                        pointRadius: labels.length > 20 ? 3 : 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#38bdf8',
                            bodyColor: '#fff',
                            borderColor: 'rgba(56, 189, 248, 0.3)',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: false,
                            callbacks: {
                                label: (context) => {
                                    const val = context.raw || 0;
                                    const ordCount = orders[context.dataIndex] || 0;
                                    return [
                                        ' 💰 Doanh thu: ' + this.formatMoney(val) + ' đ',
                                        ' 🧾 Đơn hàng: ' + ordCount + ' đơn'
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: {
                                color: '#94a3b8',
                                maxRotation: 45,
                                autoSkip: true,
                                maxTicksLimit: 15
                            }
                        },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: {
                                color: '#94a3b8',
                                callback: (value) => this.formatMoney(value)
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Error loading revenue chart:', e);
        }
    },

    async loadTopSelling() {
        try {
            const res = await fetch('api/reports.php?action=top_selling&limit=6');
            const json = await res.json();
            if (!json.success) return;

            const container = document.getElementById('top-selling-list');
            if (!container) return;

            const items = Array.isArray(json.data) ? json.data : [];
            if (items.length === 0) {
                container.innerHTML = '<div class="text-xs text-slate-500 py-4 text-center">Chưa có dữ liệu bán hàng hôm nay</div>';
                return;
            }

            let html = '';
            items.forEach((it, idx) => {
                html += `
                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                        <div class="flex items-center gap-2.5">
                            <span class="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 font-bold text-xs flex items-center justify-center font-mono">#${idx + 1}</span>
                            <div>
                                <h6 class="text-xs font-bold text-slate-100">${it.product_name}</h6>
                                <span class="text-[11px] text-slate-400">Đã bán: <b class="text-amber-400 font-mono">${it.total_qty}</b> ${it.unit}</span>
                            </div>
                        </div>
                        <span class="text-xs font-black text-emerald-400 font-mono">${this.formatMoney(it.total_revenue)} đ</span>
                    </div>
                `;
            });

            container.innerHTML = html;
        } catch (e) {
            console.error('Error loading top selling:', e);
        }
    },

    // 2. Categories Management
    async loadCategories() {
        try {
            const res = await fetch('api/categories.php');
            const data = await res.json();
            if (data.success) {
                this.categories = data.data;
                this.renderCategoriesTable();
                this.updateCategorySelectOptions();
            }
        } catch (e) {
            console.error('Error loading categories:', e);
        }
    },

    renderCategoriesTable() {
        const tbody = document.getElementById('category-table-body');
        if (!tbody) return;

        if (!this.categories || this.categories.length === 0) {
            tbody.innerHTML = this.renderEmptyState(5, 'fa-layer-group', 'Chưa có nhóm hàng nào', 'Bấm nút "Thêm Nhóm Hàng" để tạo danh mục phân loại đồ uống, đồ ăn.');
            return;
        }

        let html = '';
        this.categories.forEach(c => {
            html += `
                <tr class="hover:bg-sky-500/[0.04] transition-colors">
                    <td class="col-center"><span class="font-mono text-xs text-slate-400 whitespace-nowrap">#${c.id}</span></td>
                    <td class="col-name">
                        <div class="font-bold text-white text-xs flex items-center gap-2 whitespace-nowrap">
                            <span class="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/25 flex items-center justify-center text-xs shrink-0 shadow-sm">
                                <i class="fas fa-${c.icon || 'tag'}"></i>
                            </span>
                            <span class="whitespace-nowrap">${c.name}</span>
                        </div>
                    </td>
                    <td class="col-center">
                        <span class="font-mono font-bold text-sky-400 text-xs bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 whitespace-nowrap">${c.product_count || 0} món</span>
                    </td>
                    <td class="col-center"><span class="font-mono text-xs text-slate-400 whitespace-nowrap">${c.sort_order || 0}</span></td>
                    <td class="col-right">
                        <div class="flex items-center justify-end gap-1.5">
                            <button type="button" class="saas-action-btn btn-edit" onclick="Admin.openEditCategoryModal(${c.id})" title="Sửa nhóm hàng">
                                <i class="fas fa-pen text-[10px]"></i>
                            </button>
                            <button type="button" class="saas-action-btn btn-delete" onclick="Admin.deleteCategory(${c.id})" title="Xóa nhóm hàng">
                                <i class="fas fa-trash-can text-[10px]"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    updateCategorySelectOptions() {
        const selects = ['product-filter-category', 'modal-product-category'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const currentVal = el.value;
            let options = id === 'product-filter-category' ? '<option value="">-- Tất cả nhóm hàng --</option>' : '';
            this.categories.forEach(c => {
                options += `<option value="${c.id}">${c.name}</option>`;
            });
            el.innerHTML = options;
            if (currentVal) el.value = currentVal;
        });
    },

    openAddCategoryModal() {
        document.getElementById('modal-cat-id').value = '';
        document.getElementById('modal-cat-name').value = '';
        document.getElementById('modal-cat-icon').value = 'coffee';
        document.getElementById('modal-cat-order').value = '0';
        document.getElementById('category-modal-title').innerText = 'Thêm Nhóm Hàng Mới';
        document.getElementById('category-modal').classList.add('open');
    },

    openEditCategoryModal(catId) {
        const cat = this.categories.find(c => c.id === catId);
        if (!cat) return;
        document.getElementById('modal-cat-id').value = cat.id;
        document.getElementById('modal-cat-name').value = cat.name;
        document.getElementById('modal-cat-icon').value = cat.icon || 'coffee';
        document.getElementById('modal-cat-order').value = cat.sort_order || 0;
        document.getElementById('category-modal-title').innerText = 'Chỉnh Sửa Nhóm Hàng';
        document.getElementById('category-modal').classList.add('open');
    },

    async saveCategory() {
        const id = document.getElementById('modal-cat-id').value;
        const name = document.getElementById('modal-cat-name').value.trim();
        const icon = document.getElementById('modal-cat-icon').value.trim();
        const order = parseInt(document.getElementById('modal-cat-order').value) || 0;

        if (!name) {
            alert('Vui lòng nhập tên nhóm hàng!');
            return;
        }

        const isEdit = !!id;
        const url = isEdit ? 'api/categories.php?action=update' : 'api/categories.php?action=add';
        const payload = { id, name, icon, sort_order: order };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('category-modal').classList.remove('open');
                await this.loadCategories();
            } else {
                alert(data.message || 'Lỗi thao tác');
            }
        } catch (e) {
            console.error('Error saving category:', e);
        }
    },

    async deleteCategory(catId) {
        if (!confirm('Bạn có chắc chắn muốn xóa nhóm hàng này?')) return;
        try {
            const res = await fetch(`api/categories.php?action=delete&id=${catId}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                await this.loadCategories();
            } else {
                alert(data.message || 'Lỗi xóa nhóm hàng');
            }
        } catch (e) {
            console.error('Error deleting category:', e);
        }
    },

    // 3. Products Management (Back-office catalog)
    async loadProducts() {
        try {
            const catFilterEl = document.getElementById('product-filter-category');
            const catFilter = catFilterEl && catFilterEl.value ? catFilterEl.value : '';
            const searchEl = document.getElementById('product-filter-search');
            const search = searchEl && searchEl.value ? searchEl.value : '';

            let url = 'api/products.php?1=1';
            if (catFilter) url += `&category_id=${catFilter}`;
            if (search) url += `&q=${encodeURIComponent(search)}`;

            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                this.products = data.data;
                this.renderProductsTable();
            }
        } catch (e) {
            console.error('Error loading products:', e);
        }
    },

    renderProductsTable() {
        const tbody = document.getElementById('products-table-body');
        if (!tbody) return;

        if (!this.products || this.products.length === 0) {
            tbody.innerHTML = this.renderEmptyState(9, 'fa-utensils', 'Không tìm thấy mặt hàng nào', 'Chưa có mặt hàng nào trong hệ thống hoặc không khớp với bộ lọc.');
            return;
        }

        let html = '';
        this.products.forEach(p => {
            const isLocked = p.status === 'locked';
            const imgUrl = p.image || 'assets/images/dishes/default_dish.jpg';
            html += `
                <tr class="hover:bg-sky-500/[0.04] transition-colors ${isLocked ? 'opacity-50' : ''}">
                    <td class="col-center">
                        <div class="w-9 h-9 rounded-lg overflow-hidden bg-slate-900 border border-white/10 mx-auto shadow-sm relative group cursor-pointer" onclick="Admin.openEditProductModal(${p.id})">
                            <img src="${imgUrl}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" onerror="this.onerror=null;this.src='assets/images/dishes/default_dish.jpg';" />
                        </div>
                    </td>
                    <td><span class="font-mono text-[11px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 whitespace-nowrap">${p.code || 'SP'}</span></td>
                    <td class="col-name">
                        <div class="font-bold text-white text-xs flex items-center gap-1.5 whitespace-nowrap">
                            <span class="whitespace-nowrap">${p.name}</span>
                            ${p.is_topping == 1 ? '<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 shrink-0">Topping</span>' : ''}
                        </div>
                    </td>
                    <td><span class="text-xs text-slate-300 font-medium whitespace-nowrap">${p.category_name || '-'}</span></td>
                    <td class="col-center"><span class="text-xs text-slate-400 capitalize whitespace-nowrap">${p.unit || 'ly'}</span></td>
                    <td class="col-money"><span class="font-mono font-bold text-amber-300 text-xs whitespace-nowrap">${this.formatMoney(p.sale_price)} đ</span></td>
                    <td class="col-money"><span class="font-mono text-slate-400 text-xs whitespace-nowrap">${this.formatMoney(p.cost_price)} đ</span></td>
                    <td class="col-center">
                        <input type="checkbox" class="w-4 h-4 rounded text-rose-500 cursor-pointer accent-sky-500" ${isLocked ? 'checked' : ''} onchange="Admin.toggleProductLock(${p.id})" title="Tạm khóa mặt hàng" />
                    </td>
                    <td class="col-right">
                        <div class="flex items-center justify-end gap-1.5">
                            <button type="button" class="saas-action-btn btn-edit" onclick="Admin.openEditProductModal(${p.id})" title="Sửa mặt hàng">
                                <i class="fas fa-pen text-[10px]"></i>
                            </button>
                            <button type="button" class="saas-action-btn btn-delete" onclick="Admin.deleteProduct(${p.id})" title="Xóa mặt hàng">
                                <i class="fas fa-trash-can text-[10px]"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    openAddProductModal() {
        document.getElementById('modal-prod-id').value = '';
        document.getElementById('modal-prod-code').value = '';
        document.getElementById('modal-prod-name').value = '';
        document.getElementById('modal-prod-unit').value = 'ly';
        document.getElementById('modal-prod-saleprice').value = '';
        document.getElementById('modal-prod-costprice').value = '0';
        document.getElementById('modal-prod-topping').checked = false;
        
        const imgInput = document.getElementById('modal-prod-image');
        const imgPreview = document.getElementById('modal-prod-img-preview');
        if (imgInput) imgInput.value = '';
        if (imgPreview) imgPreview.src = 'assets/images/dishes/default_dish.jpg';

        document.getElementById('product-modal-title').innerText = 'Thêm Mặt Hàng Mới';
        document.getElementById('product-modal').classList.add('open');
    },

    openEditProductModal(prodId) {
        const prod = this.products.find(p => p.id === prodId);
        if (!prod) return;

        document.getElementById('modal-prod-id').value = prod.id;
        document.getElementById('modal-prod-code').value = prod.code;
        document.getElementById('modal-prod-name').value = prod.name;
        document.getElementById('modal-product-category').value = prod.category_id;
        document.getElementById('modal-prod-unit').value = prod.unit || 'ly';
        document.getElementById('modal-prod-saleprice').value = prod.sale_price;
        document.getElementById('modal-prod-costprice').value = prod.cost_price || 0;
        document.getElementById('modal-prod-topping').checked = prod.is_topping == 1;

        const imgInput = document.getElementById('modal-prod-image');
        const imgPreview = document.getElementById('modal-prod-img-preview');
        const dishImg = prod.image || 'assets/images/dishes/default_dish.jpg';
        if (imgInput) imgInput.value = prod.image || '';
        if (imgPreview) imgPreview.src = dishImg;

        document.getElementById('product-modal-title').innerText = 'Chỉnh Sửa Mặt Hàng';
        document.getElementById('product-modal').classList.add('open');
    },

    async aiGenerateDishImage() {
        const name = document.getElementById('modal-prod-name').value.trim();
        const catSelect = document.getElementById('modal-product-category');
        const category_name = catSelect.options[catSelect.selectedIndex]?.text || '';
        const id = document.getElementById('modal-prod-id').value;

        if (!name) {
            alert('Vui lòng nhập tên món ăn trước khi nhờ AI tạo ảnh!');
            return;
        }

        const preview = document.getElementById('modal-prod-img-preview');
        const input = document.getElementById('modal-prod-image');
        const originalSrc = preview.src;

        // Visual loading state
        preview.classList.add('animate-pulse');

        try {
            const res = await fetch('api/products.php?action=ai_generate_dish_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, category_name, id: id ? parseInt(id) : 0 })
            });
            const data = await res.json();
            preview.classList.remove('animate-pulse');

            if (data.success && data.image_url) {
                preview.src = data.image_url;
                input.value = data.image_url;
                alert(data.message || 'AI đã tạo và gán ảnh món ăn thành công!');
            } else {
                alert(data.message || 'Không thể tạo ảnh, vui lòng thử lại!');
            }
        } catch (e) {
            preview.classList.remove('animate-pulse');
            alert('Lỗi kết nối AI: ' + e.message);
        }
    },

        initDishImageDrop() {
        const box = document.getElementById('modal-prod-img-box');
        if (!box) return;
        ['dragenter', 'dragover'].forEach(name => {
            box.addEventListener(name, (e) => {
                e.preventDefault();
                box.classList.add('ring-2', 'ring-amber-400', 'scale-105');
            });
        });
        ['dragleave', 'drop'].forEach(name => {
            box.addEventListener(name, (e) => {
                e.preventDefault();
                box.classList.remove('ring-2', 'ring-amber-400', 'scale-105');
            });
        });
        box.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                DishCropper.openWithFile(file, (croppedBase64) => {
                    Admin.uploadCroppedDishImage(croppedBase64);
                });
            }
        });
    },

    handleProductImageUpload(fileInput) {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];

        // Launch Smart 4:3 Cropper
        DishCropper.openWithFile(file, (croppedBase64) => {
            this.uploadCroppedDishImage(croppedBase64);
        });

        // Clear input value so same file can be selected again
        fileInput.value = '';
    },

    openCropForCurrentDish() {
        const preview = document.getElementById('modal-prod-img-preview');
        const input = document.getElementById('modal-prod-image');
        const src = (input ? input.value : '') || (preview ? preview.src : '');

        if (!src || src.includes('default_dish.jpg')) {
            alert('Chưa có hình ảnh món ăn để cắt xén. Vui lòng bấm "Chọn File" hoặc "AI Tạo Ảnh" trước!');
            return;
        }

        DishCropper.openWithUrl(src, (croppedBase64) => {
            this.uploadCroppedDishImage(croppedBase64);
        });
    },

    async uploadCroppedDishImage(base64Data) {
        const preview = document.getElementById('modal-prod-img-preview');
        const input = document.getElementById('modal-prod-image');
        const id = document.getElementById('modal-prod-id') ? document.getElementById('modal-prod-id').value : '';

        if (preview) preview.classList.add('animate-pulse');

        try {
            const res = await fetch('api/products.php?action=upload_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_base64: base64Data,
                    product_id: id || 0
                })
            });
            const data = await res.json();
            if (preview) preview.classList.remove('animate-pulse');

            if (data.success && data.image_url) {
                const buster = data.image_url + (data.image_url.includes('?') ? '&' : '?') + 't=' + Date.now();
                if (preview) preview.src = buster;
                if (input) input.value = data.image_url;

                // Also update live product in Admin.products list if editing
                if (id) {
                    const existing = this.products.find(p => p.id == id);
                    if (existing) {
                        existing.image = data.image_url;
                        this.renderProductsTable();
                    }
                }

                alert('Đã tự động cắt xén ảnh chuẩn 4:3 và lưu thành công!');
            } else {
                alert(data.message || 'Lưu ảnh thất bại!');
            }
        } catch (e) {
            if (preview) preview.classList.remove('animate-pulse');
            alert('Lỗi tải ảnh: ' + e.message);
        }
    },

    async batchAiAssignImages() {
        if (!confirm('Bạn có chắc muốn AI tự động phân tích toàn bộ menu và gán hình ảnh minh họa chất lượng cao cho tất cả món ăn không?')) {
            return;
        }

        try {
            const res = await fetch('api/products.php?action=ai_batch_assign_images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || 'Đã cập nhật hình ảnh menu thành công!');
                this.loadProducts();
            } else {
                alert(data.message || 'Có lỗi xảy ra!');
            }
        } catch (e) {
            alert('Lỗi: ' + e.message);
        }
    },

    async saveProduct() {
        const id = document.getElementById('modal-prod-id').value;
        const code = document.getElementById('modal-prod-code').value.trim();
        const name = document.getElementById('modal-prod-name').value.trim();
        const category_id = parseInt(document.getElementById('modal-product-category').value) || 0;
        const unit = document.getElementById('modal-prod-unit').value.trim() || 'ly';
        const sale_price = parseFloat(document.getElementById('modal-prod-saleprice').value) || 0;
        const cost_price = parseFloat(document.getElementById('modal-prod-costprice').value) || 0;
        const is_topping = document.getElementById('modal-prod-topping').checked ? 1 : 0;
        const image = document.getElementById('modal-prod-image') ? document.getElementById('modal-prod-image').value.trim() : '';

        if (!name || category_id <= 0 || sale_price <= 0) {
            alert('Vui lòng nhập tên món, chọn nhóm hàng và nhập giá bán hợp lệ!');
            return;
        }

        const isEdit = !!id;
        const url = isEdit ? 'api/products.php?action=update' : 'api/products.php?action=add';
        const payload = { id, code, name, category_id, unit, sale_price, cost_price, is_topping, image, status: 'active' };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('product-modal').classList.remove('open');
                await this.loadProducts();
            } else {
                alert(data.message || 'Lỗi thao tác');
            }
        } catch (e) {
            console.error('Error saving product:', e);
        }
    },

    async toggleProductLock(prodId) {
        try {
            const res = await fetch('api/products.php?action=toggle_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: prodId })
            });
            const data = await res.json();
            if (data.success) {
                await this.loadProducts();
            }
        } catch (e) {
            console.error('Error toggling lock:', e);
        }
    },

    async deleteProduct(prodId) {
        if (!confirm('Bạn có chắc chắn muốn xóa mặt hàng này khỏi cơ sở dữ liệu?')) return;
        try {
            const res = await fetch(`api/products.php?action=delete&id=${prodId}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                await this.loadProducts();
            } else {
                alert(data.message || 'Lỗi xóa mặt hàng');
            }
        } catch (e) {
            console.error('Error deleting product:', e);
        }
    },

    // 4. Tables Management
    async loadTables() {
        try {
            const res = await fetch('api/tables.php');
            const data = await res.json();
            if (data.success) {
                this.tables = data.data;
                this.renderTablesList();
            }
        } catch (e) {
            console.error('Error loading tables:', e);
        }
    },

    currentTableArea: 'all',
    tableSearchKw: '',
    activeTableForQr: null,

    renderTablesList() {
        const container = document.getElementById('admin-tables-container');
        if (!container) return;

        const tables = this.tables || [];
        const total = tables.length;
        const occupied = tables.filter(t => t.status === 'occupied').length;
        const free = total - occupied;
        const taiQuanCount = tables.filter(t => t.area_type === 'TAI_QUAN').length;
        const mangVeCount = tables.filter(t => t.area_type === 'MANG_VE').length;

        // Update Stats Counters
        const totalEl = document.getElementById('stat-table-total');
        if (totalEl) totalEl.textContent = total;
        const freeEl = document.getElementById('stat-table-free');
        if (freeEl) freeEl.textContent = free;
        const occEl = document.getElementById('stat-table-occupied');
        if (occEl) occEl.textContent = occupied;

        const allPill = document.getElementById('count-area-all');
        if (allPill) allPill.textContent = total;
        const tqPill = document.getElementById('count-area-tai-quan');
        if (tqPill) tqPill.textContent = taiQuanCount;
        const mvPill = document.getElementById('count-area-mang-ve');
        if (mvPill) mvPill.textContent = mangVeCount;

        // Filter list
        let filtered = tables;
        if (this.currentTableArea && this.currentTableArea !== 'all') {
            filtered = filtered.filter(t => t.area_type === this.currentTableArea);
        }
        if (this.tableSearchKw) {
            const kw = this.tableSearchKw.toLowerCase().trim();
            filtered = filtered.filter(t => 
                (t.code && t.code.toLowerCase().includes(kw)) ||
                (t.name && t.name.toLowerCase().includes(kw))
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-500" style="grid-column:1/-1;">
                    <i class="fas fa-chair text-4xl mb-3 text-slate-600 block"></i>
                    <p class="text-sm font-semibold">Không tìm thấy bàn nào phù hợp</p>
                    <p class="text-xs text-slate-600 mt-1">Bấm "Thêm Bàn" hoặc "Tạo Hàng Loạt" để tạo mới</p>
                </div>
            `;
            return;
        }

        const baseUrl = getAdminBaseUrl();

        // Nhóm: Mang Về nằm trên, Tại Quán nằm dưới — mỗi nhóm xuống hàng riêng có tiêu đề
        const groupOf = t => (t.area_type === 'MANG_VE' ? 'MANG_VE' : 'TAI_QUAN');
        filtered = [
            ...filtered.filter(t => groupOf(t) === 'MANG_VE'),
            ...filtered.filter(t => groupOf(t) === 'TAI_QUAN')
        ];
        const groupMeta = {
            TAI_QUAN: { label: 'Bàn Tại Quán', icon: 'fa-chair', color: '#38bdf8', border: 'rgba(56,189,248,.35)' },
            MANG_VE:  { label: 'Đơn Mang Về',  icon: 'fa-bag-shopping', color: '#fbbf24', border: 'rgba(251,191,36,.35)' }
        };
        const groupCounts = {
            TAI_QUAN: filtered.filter(t => groupOf(t) === 'TAI_QUAN').length,
            MANG_VE: filtered.filter(t => groupOf(t) === 'MANG_VE').length
        };

        let html = '';
        let currentGroup = null;
        filtered.forEach(t => {
            const g = groupOf(t);
            if (g !== currentGroup) {
                const m = groupMeta[g];
                html += `
                <div style="grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:6px 2px 8px;margin-top:${currentGroup ? '14px' : '0'};border-bottom:1px solid ${m.border};">
                    <i class="fas ${m.icon}" style="color:${m.color};font-size:14px;"></i>
                    <span style="color:${m.color};font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:.05em;">${m.label}</span>
                    <span style="font-size:11px;font-weight:700;color:#94a3b8;background:rgba(15,23,42,.8);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:1px 8px;">${groupCounts[g]}</span>
                </div>`;
                currentGroup = g;
            }
            const isOccupied = t.status === 'occupied';
            const isTakeaway = t.area_type === 'MANG_VE';
            const guestCount = t.guest_count || (isTakeaway ? 1 : 4);
            const orderUrl = `${baseUrl}customer.html?table=${encodeURIComponent(t.code)}&name=${encodeURIComponent(t.name)}`;

            html += `
                <div class="liquid-glass-card p-3.5 rounded-2xl border ${isOccupied ? 'border-rose-500/40 bg-rose-950/10' : 'border-white/10 hover:border-sky-500/40'} flex flex-col justify-between transition-all duration-200 group relative" style="width:220px;height:300px;box-sizing:border-box;overflow:hidden;">
                    <!-- Top Bar: Code + Area + Status Pill -->
                    <div>
                        <div class="flex items-center justify-between gap-1.5 mb-2.5">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span class="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 font-mono font-black text-xs border border-sky-500/30 truncate shadow-sm">
                                    ${t.code}
                                </span>
                                <span class="px-1.5 py-0.5 rounded-md text-[9px] font-bold ${isTakeaway ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25' : 'bg-slate-800 text-slate-300 border border-white/10'} truncate">
                                    ${isTakeaway ? 'Mang Về' : 'Tại Quán'}
                                </span>
                            </div>
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase shrink-0 ${isOccupied ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}">
                                <span class="w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}"></span>
                                ${isOccupied ? 'Có khách' : 'Trống'}
                            </span>
                        </div>

                        <!-- Table Name & Seats -->
                        <div class="flex items-baseline justify-between gap-1 mb-2">
                            <h4 class="font-extrabold text-sm text-white truncate" title="${t.name}">${t.name}</h4>
                            <span class="text-[10px] text-slate-400 font-medium shrink-0">
                                <i class="fas fa-chair text-slate-500 text-[9px] mr-0.5"></i>${guestCount} chỗ
                            </span>
                        </div>

                        <!-- QR Code Thumbnail Box (Clean Standard White Card) -->
                        <div class="relative cursor-pointer transition-all group/qr" style="background:#fff;padding:8px;border-radius:12px;width:112px;height:112px;margin:8px auto;display:flex;align-items:center;justify-content:center;box-sizing:border-box;box-shadow:0 6px 16px rgba(0,0,0,.4);" onclick="Admin.openTableQrModal(${t.id})" title="Nhấp để phóng to & In Standee">
                            <div id="table-qr-${t.id}" style="width:96px;height:96px;display:flex;align-items:center;justify-content:center;overflow:hidden;"></div>
                            <div class="absolute inset-0 bg-slate-950/80 rounded-xl opacity-0 group-hover/qr:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 p-1 text-center">
                                <i class="fas fa-search-plus text-base text-sky-400"></i>
                                <span>Phóng to & In</span>
                            </div>
                        </div>

                        <!-- Live Order Info / Status Description -->
                        <div class="text-[11px] text-center my-1.5">
                            ${isOccupied ? `
                                <div class="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 font-medium flex items-center justify-between">
                                    <span class="truncate"><i class="fas fa-receipt mr-1 text-rose-400"></i>${t.order_code || 'Đang mở'}</span>
                                    <span class="font-bold text-amber-300 ml-1 font-mono">${(Number(t.total_amount) || 0).toLocaleString('vi-VN')}đ</span>
                                </div>
                            ` : `
                                <div class="text-[10px] text-slate-400 font-medium">
                                    <span class="text-emerald-400">●</span> Sẵn sàng đón khách
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Bottom Action Buttons Strip -->
                    <div class="pt-2 border-t border-white/10 flex items-center justify-between gap-1 mt-2 text-xs">
                        <button type="button" onclick="Admin.openTableQrModal(${t.id})" class="btn-glass text-[10px] py-1 px-2 text-sky-300 hover:text-white border-sky-500/30 hover:bg-sky-500/20 font-bold flex items-center gap-1 flex-1 justify-center shadow-sm" title="Mở mã QR standee">
                            <i class="fas fa-qrcode"></i> <span>Standee QR</span>
                        </button>
                        <button type="button" onclick="Admin.copyDirectOrderUrl('${encodeURIComponent(orderUrl)}')" class="btn-glass text-[10px] py-1 px-1.5 text-slate-300 hover:text-white border-white/10" title="Sao chép link gọi món tại bàn">
                            <i class="fas fa-link"></i>
                        </button>
                        ${!isOccupied ? `
                            <button type="button" class="btn-glass text-[10px] py-1 px-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 border-rose-500/20" onclick="Admin.deleteTable(${t.id})" title="Xóa bàn này">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Render QR Code inside each card
        setTimeout(() => {
            filtered.forEach(t => {
                const qrContainer = document.getElementById(`table-qr-${t.id}`);
                if (qrContainer && typeof QRCode !== 'undefined') {
                    qrContainer.innerHTML = '';
                    const orderUrl = `${baseUrl}customer.html?table=${encodeURIComponent(t.code)}&name=${encodeURIComponent(t.name)}`;
                    try {
                        new QRCode(qrContainer, {
                            text: orderUrl,
                            width: 96,
                            height: 96,
                            colorDark: "#0b0f19",
                            colorLight: "#ffffff",
                            correctLevel: QRCode.CorrectLevel.M
                        });
                    } catch (e) {
                        console.error('Error drawing mini table QR:', e);
                    }
                }
            });
        }, 50);
    },

    filterTableArea(area) {
        this.currentTableArea = area;
        document.querySelectorAll('.table-area-pill').forEach(btn => {
            const btnArea = btn.getAttribute('data-area');
            if (btnArea === area) {
                btn.className = 'table-area-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-sky-600 text-white shadow-sm flex items-center gap-1.5 shrink-0';
            } else {
                btn.className = 'table-area-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent flex items-center gap-1.5 shrink-0';
            }
        });
        this.renderTablesList();
    },

    filterTablesSearch(kw) {
        this.tableSearchKw = kw;
        this.renderTablesList();
    },

    openAddTableModal() {
        const modal = document.getElementById('admin-table-modal');
        if (modal) modal.classList.add('open');
        const codeInput = document.getElementById('admin-table-code');
        if (codeInput) {
            codeInput.value = '';
            codeInput.focus();
        }
        const nameInput = document.getElementById('admin-table-name');
        if (nameInput) nameInput.value = '';
    },

    closeAddTableModal() {
        const modal = document.getElementById('admin-table-modal');
        if (modal) modal.classList.remove('open');
    },

    async addTable(e) {
        if (e && e.preventDefault) e.preventDefault();
        const codeInput = document.getElementById('admin-table-code');
        const nameInput = document.getElementById('admin-table-name');
        const areaInput = document.getElementById('admin-table-area');
        const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
        const name = nameInput ? nameInput.value.trim() : '';
        const area = areaInput ? areaInput.value : 'TAI_QUAN';

        if (!code || !name) {
            alert('Vui lòng điền đầy đủ Mã bàn và Tên bàn!');
            return;
        }

        try {
            const res = await fetch('api/tables.php?action=add_table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code, name: name, area_type: area })
            });
            const data = await res.json();
            if (data.success) {
                this.closeAddTableModal();
                await this.loadTables();
            } else {
                alert(data.message || 'Lỗi thêm bàn');
            }
        } catch (err) {
            console.error('addTable error:', err);
            alert('Lỗi khi thêm bàn');
        }
    },

    openTableQrModal(tableId) {
        const table = (this.tables || []).find(t => t.id === tableId);
        if (!table) return;
        this.activeTableForQr = table;

        const modal = document.getElementById('admin-table-qr-modal');
        if (!modal) return;

        const codeEl = document.getElementById('standee-display-code');
        if (codeEl) codeEl.textContent = table.code;
        const nameEl = document.getElementById('standee-display-name');
        if (nameEl) nameEl.textContent = table.name;
        const titleEl = document.getElementById('admin-table-qr-title');
        if (titleEl) titleEl.textContent = `Standee QR Bàn: ${table.name} (${table.code})`;

        const orderUrl = `${getAdminBaseUrl()}customer.html?table=${encodeURIComponent(table.code)}&name=${encodeURIComponent(table.name)}`;

        const urlEl = document.getElementById('admin-table-qr-url');
        if (urlEl) urlEl.textContent = orderUrl;

        const qrContainer = document.getElementById('admin-table-qr-code');
        if (qrContainer && typeof QRCode !== 'undefined') {
            qrContainer.innerHTML = '';
            try {
                new QRCode(qrContainer, {
                    text: orderUrl,
                    width: 190,
                    height: 190,
                    colorDark: "#0b0f19",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (e) {
                console.error('Error drawing modal QR:', e);
            }
        }

        modal.classList.add('open');
    },

    closeTableQrModal() {
        const modal = document.getElementById('admin-table-qr-modal');
        if (modal) modal.classList.remove('open');
        this.activeTableForQr = null;
    },

    printTableQrStandee() {
        if (!this.activeTableForQr) return;
        const table = this.activeTableForQr;
        const orderUrl = `${getAdminBaseUrl()}customer.html?table=${encodeURIComponent(table.code)}&name=${encodeURIComponent(table.name)}`;

        const printZone = document.getElementById('print-container-zone');
        if (!printZone) return;

        printZone.innerHTML = `
            <div style="max-width: 400px; margin: 0 auto; padding: 25px; border: 3px dashed #0284c7; border-radius: 16px; text-align: center; font-family: sans-serif; background: #ffffff; color: #020617;">
                <div style="font-size: 13px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #0284c7; margin-bottom: 4px;">GÓC PHỐ COFFEE & TEA</div>
                <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 15px;">HỆ THỐNG GỌI MÓN & JUKEBOX THÔNG MINH TẠI BÀN</div>
                
                <div style="display: inline-block; padding: 8px 24px; border: 2px solid #0284c7; border-radius: 12px; background: #f0f9ff; margin-bottom: 15px;">
                    <span style="font-size: 26px; font-weight: 900; color: #0369a1; font-family: monospace;">${table.code}</span>
                    <span style="font-size: 14px; font-weight: 700; color: #334155; margin-left: 8px;">(${table.name})</span>
                </div>

                <div id="print-single-qr-img" style="margin: 10px auto; width: 220px; height: 220px; display: flex; align-items: center; justify-content: center; background: #fff;"></div>

                <div style="margin-top: 15px; font-size: 12px; font-weight: 700; color: #0f172a;">
                    📷 Mở Camera / Zalo / App Ngân Hàng Quét Mã
                </div>
                <div style="margin-top: 4px; font-size: 11px; color: #64748b;">
                    Xem thực đơn điện tử • Đặt món nhanh • Quán phục vụ tận bàn
                </div>
                <div style="margin-top: 15px; font-size: 9px; font-family: monospace; color: #94a3b8; word-break: break-all;">
                    ${orderUrl}
                </div>
            </div>
        `;

        if (typeof QRCode !== 'undefined') {
            const singleImgZone = document.getElementById('print-single-qr-img');
            new QRCode(singleImgZone, {
                text: orderUrl,
                width: 210,
                height: 210,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }

        setTimeout(() => {
            window.print();
        }, 200);
    },

    downloadTableQr() {
        const qrContainer = document.getElementById('admin-table-qr-code');
        if (!qrContainer) return;
        const img = qrContainer.querySelector('img');
        const canvas = qrContainer.querySelector('canvas');
        let dataUrl = '';
        if (img && img.src) {
            dataUrl = img.src;
        } else if (canvas) {
            dataUrl = canvas.toDataURL('image/png');
        }
        if (!dataUrl) {
            alert('Không tìm thấy ảnh mã QR để tải!');
            return;
        }
        const a = document.createElement('a');
        const code = this.activeTableForQr ? this.activeTableForQr.code : 'table';
        a.href = dataUrl;
        a.download = `QR_Standee_${code}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    copyTableQrUrl() {
        const urlEl = document.getElementById('admin-table-qr-url');
        if (!urlEl || !urlEl.textContent) return;
        const url = urlEl.textContent;
        this.copyDirectOrderUrl(url);
    },

    copyDirectOrderUrl(url) {
        if (!url) return;
        const decoded = decodeURIComponent(url);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(decoded).then(() => {
                alert('Đã sao chép link gọi món tại bàn:\n' + decoded);
            }).catch(() => {
                prompt('Link gọi món tại bàn:', decoded);
            });
        } else {
            prompt('Link gọi món tại bàn:', decoded);
        }
    },

    openBatchTablesModal() {
        const modal = document.getElementById('admin-batch-tables-modal');
        if (modal) modal.classList.add('open');
    },

    async submitBatchTables(e) {
        if (e && e.preventDefault) e.preventDefault();
        const prefix = (document.getElementById('batch-prefix')?.value || 'TQ').trim().toUpperCase();
        const fromNum = parseInt(document.getElementById('batch-from-num')?.value || '1', 10);
        const toNum = parseInt(document.getElementById('batch-to-num')?.value || '10', 10);
        const areaType = document.getElementById('batch-area-type')?.value || 'TAI_QUAN';
        const guestCount = parseInt(document.getElementById('batch-guest-count')?.value || '4', 10);

        if (toNum < fromNum) {
            alert('Số kết thúc phải lớn hơn hoặc bằng số bắt đầu!');
            return;
        }

        try {
            const res = await fetch('api/tables.php?action=batch_add_tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prefix: prefix,
                    from_num: fromNum,
                    to_num: toNum,
                    area_type: areaType,
                    guest_count: guestCount
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || 'Đã tạo thành công hàng loạt bàn!');
                document.getElementById('admin-batch-tables-modal')?.classList.remove('open');
                await this.loadTables();
            } else {
                alert(data.message || 'Lỗi tạo hàng loạt bàn');
            }
        } catch (err) {
            console.error('submitBatchTables error:', err);
            alert('Lỗi kết nối máy chủ');
        }
    },

    printAllTableQr() {
        const tables = this.tables || [];
        if (tables.length === 0) {
            alert('Chưa có bàn nào để in!');
            return;
        }

        const baseUrl = getAdminBaseUrl();

        const printZone = document.getElementById('print-container-zone');
        if (!printZone) return;

        let html = `
            <div style="font-family: sans-serif; background: #fff; color: #020617; padding: 15px;">
                <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #0284c7; padding-bottom: 12px;">
                    <h2 style="font-size: 20px; font-weight: 900; margin: 0; color: #0284c7; text-transform: uppercase;">GÓC PHỐ COFFEE & TEA</h2>
                    <p style="font-size: 13px; color: #475569; margin: 4px 0 0 0;">BỘ THẺ STANDEE QR GỌI MÓN TẠI BÀN (${tables.length} BÀN)</p>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
        `;

        tables.forEach((t, idx) => {
            const orderUrl = `${baseUrl}customer.html?table=${encodeURIComponent(t.code)}&name=${encodeURIComponent(t.name)}`;
            html += `
                <div class="print-table-card" style="border: 2px dashed #0284c7; border-radius: 14px; padding: 16px; text-align: center; page-break-inside: avoid; background: #ffffff;">
                    <div style="font-size: 11px; font-weight: 900; letter-spacing: 1.5px; color: #0284c7; text-transform: uppercase;">GÓC PHỐ COFFEE & TEA</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">MÃ QR GỌI MÓN & JUKEBOX</div>
                    
                    <div style="display: inline-block; margin: 10px 0; padding: 4px 16px; border: 1.5px solid #0284c7; border-radius: 8px; background: #f0f9ff;">
                        <span style="font-size: 20px; font-weight: 900; color: #0369a1; font-family: monospace;">${t.code}</span>
                        <span style="font-size: 12px; font-weight: 700; color: #334155; margin-left: 6px;">(${t.name})</span>
                    </div>

                    <div id="print-batch-qr-${t.id}" style="margin: 8px auto; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center;"></div>

                    <div style="font-size: 10px; font-weight: 700; color: #0f172a; margin-top: 6px;">
                        📷 Mở Camera / Zalo quét mã
                    </div>
                    <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
                        Xem menu • Đặt món • Phục vụ tận bàn
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        printZone.innerHTML = html;

        // Render QR codes
        if (typeof QRCode !== 'undefined') {
            tables.forEach(t => {
                const zone = document.getElementById(`print-batch-qr-${t.id}`);
                if (zone) {
                    const orderUrl = `${baseUrl}customer.html?table=${encodeURIComponent(t.code)}&name=${encodeURIComponent(t.name)}`;
                    new QRCode(zone, {
                        text: orderUrl,
                        width: 135,
                        height: 135,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                }
            });
        }

        setTimeout(() => {
            window.print();
        }, 300);
    },

    async deleteTable(tableId) {
        try {
            const res = await fetch('api/tables.php?action=delete_table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tableId })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast('🗑️ Đã xóa bàn thành công!', 'info');
                await this.loadTables();
            } else {
                this.showToast(data.message || 'Lỗi xóa bàn', 'error');
            }
        } catch (e) {
            console.error('Error deleting table:', e);
            this.showToast('Lỗi kết nối máy chủ', 'error');
        }
    },

    // 5. Order History
    async loadOrderHistory() {
        try {
            const dateFromEl = document.getElementById('history-date-from');
            const dateFrom = dateFromEl && dateFromEl.value ? dateFromEl.value : '';
            const dateToEl = document.getElementById('history-date-to');
            const dateTo = dateToEl && dateToEl.value ? dateToEl.value : '';
            const statusEl = document.getElementById('history-status');
            const status = statusEl && statusEl.value ? statusEl.value : '';

            let url = 'api/orders.php?action=history';
            if (dateFrom) url += `&date_from=${dateFrom}`;
            if (dateTo) url += `&date_to=${dateTo}`;
            if (status) url += `&status=${status}`;

            const res = await fetch(url);
            const data = await res.json();
            if (!data.success) return;

            const tbody = document.getElementById('order-history-tbody');
            if (!tbody) return;

            if (data.data.length === 0) {
                tbody.innerHTML = this.renderEmptyState(7, 'fa-file-invoice-dollar', 'Chưa có hóa đơn nào', 'Không tìm thấy hóa đơn nào trong khoảng thời gian hoặc trạng thái đã lọc.');
                return;
            }

            let html = '';
            data.data.forEach(o => {
                const statusBadge = o.status === 'completed' 
                    ? '<span class="saas-badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Đã thanh toán</span>'
                    : (o.status === 'pending' 
                        ? '<span class="saas-badge bg-amber-500/15 text-amber-300 border border-amber-500/30"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Đang dùng</span>' 
                        : '<span class="saas-badge bg-rose-500/15 text-rose-300 border border-rose-500/30"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Đã hủy</span>');

                html += `
                    <tr class="hover:bg-sky-500/[0.04] transition-colors">
                        <td><span class="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">${o.order_code || ('#' + o.id)}</span></td>
                        <td><span class="font-bold text-white text-xs">${o.table_code || o.table_name || 'Mang về'}</span></td>
                        <td><span class="text-xs text-slate-400 font-mono">${o.created_at || '-'}</span></td>
                        <td><span class="text-xs text-slate-300 font-medium">${o.user_name || 'Thu ngân'}</span></td>
                        <td class="col-money"><span class="font-mono font-bold text-emerald-400 text-xs">${this.formatMoney(o.total_amount)} đ</span></td>
                        <td class="col-center">${statusBadge}</td>
                        <td class="col-right">
                            <button type="button" class="saas-action-btn btn-view" onclick="Admin.viewOrderDetail(${o.id})" title="Xem chi tiết hóa đơn">
                                <i class="fas fa-eye text-[11px]"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
        } catch (e) {
            console.error('Error loading order history:', e);
        }
    },

    async viewOrderDetail(orderId) {
        try {
            const res = await fetch(`api/orders.php?order_id=${orderId}`);
            const data = await res.json();
            if (!data.success || !data.order) return;

            const o = data.order;
            let itemsHtml = '';
            data.items.forEach(it => {
                itemsHtml += `
                    <div class="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                        <div>
                            <span class="font-bold text-white">${it.product_name}</span>
                            <div class="text-[11px] text-slate-400">${it.quantity} x ${this.formatMoney(it.price)} đ</div>
                        </div>
                        <span class="font-mono font-bold text-emerald-400">${this.formatMoney(it.subtotal)} đ</span>
                    </div>
                `;
            });

            let modal = document.getElementById('history-detail-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'history-detail-modal';
                modal.className = 'liquid-modal-overlay';
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div class="liquid-glass liquid-modal-content p-6 w-[450px] max-w-full text-white shadow-2xl border border-sky-500/30">
                    <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                        <h3 class="font-bold text-base text-sky-400">Chi Tiết Hóa Đơn: ${o.order_code}</h3>
                        <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="document.getElementById('history-detail-modal').classList.remove('open')">&times;</button>
                    </div>
                    <div class="text-xs text-slate-300 space-y-1 mb-4">
                        <div>Bàn: <b class="text-white">${o.table_code}</b> | Thu ngân: <b class="text-white">${o.user_name}</b></div>
                        <div>Thời gian: ${o.created_at}</div>
                    </div>
                    <div class="max-h-60 overflow-y-auto mb-4 pr-1">
                        ${itemsHtml}
                    </div>
                    <div class="pt-3 border-t border-white/10 space-y-1 text-xs">
                        <div class="flex justify-between text-slate-400">
                            <span>Tiền hàng:</span>
                            <span>${this.formatMoney(o.subtotal)} đ</span>
                        </div>
                        ${o.discount_amount > 0 ? `
                        <div class="flex justify-between text-rose-400">
                            <span>Giảm giá:</span>
                            <span>-${this.formatMoney(o.discount_amount)} đ</span>
                        </div>` : ''}
                        <div class="flex justify-between text-sm font-black text-emerald-400 pt-1 border-t border-white/5">
                            <span>TỔNG TIỀN:</span>
                            <span>${this.formatMoney(o.total_amount)} đ</span>
                        </div>
                    </div>
                    <div class="flex justify-end gap-2 mt-5">
                        <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('history-detail-modal').classList.remove('open')">Đóng</button>
                        <button type="button" class="btn-glass-primary text-xs py-2 px-4 font-bold flex items-center gap-1.5 shadow" onclick="Admin.printReceipt(${o.id})">
                            <i class="fas fa-print"></i> In Hóa Đơn (80mm)
                        </button>
                    </div>
                </div>
            `;

            modal.classList.add('open');
        } catch (e) {
            console.error('Error fetching order detail:', e);
        }
    },

    async printReceipt(orderId) {
        try {
            const res = await fetch(`api/orders.php?order_id=${orderId}`);
            const data = await res.json();
            if (!data.success || !data.order) {
                alert('Không thể tải chi tiết hóa đơn!');
                return;
            }

            const o = data.order;
            const items = data.items || [];
            const storeName = 'GÓC PHỐ COFFEE & TEA';
            const hotline = '0967.041.111';
            const address = '123 Đường Số 5, P. Linh Trung, TP. Thủ Đức, TP.HCM';
            const wifi = 'GocPho_Guest / pass: 88888888';

            let itemsHtml = '';
            items.forEach((it, i) => {
                const toppings = it.toppings_json ? (typeof it.toppings_json === 'string' ? JSON.parse(it.toppings_json) : it.toppings_json) : (it.toppings || []);
                let toppingNames = '';
                if (toppings.length > 0) {
                    toppingNames = `<div style="font-size: 11px; padding-left: 12px; color: #444;">+ ${toppings.map(t => t.name).join(', ')}</div>`;
                }

                itemsHtml += `
                    <div style="margin-bottom: 5px;">
                        <div style="display: flex; justify-content: space-between; font-weight: bold;">
                            <span>${i + 1}. ${it.product_name}</span>
                            <span>${this.formatMoney(it.subtotal)} đ</span>
                        </div>
                        <div style="font-size: 11px; color: #555; display: flex; justify-content: space-between; padding-left: 12px;">
                            <span>${it.quantity} ${it.unit || 'ly'} x ${this.formatMoney(it.price)} đ</span>
                        </div>
                        ${toppingNames}
                        ${it.note ? `<div style="font-size: 11px; font-style: italic; color: #b91c1c; padding-left: 12px;">* ${it.note}</div>` : ''}
                    </div>
                `;
            });

            const payMethodName = o.payment_method === 'banking' ? 'Chuyển khoản (VietQR)' : (o.payment_method === 'card' ? 'Thẻ POS' : 'Tiền mặt');

            const receiptHtml = `
                <div style="text-align: center; margin-bottom: 8px;">
                    <div style="font-size: 16px; font-weight: 900; text-transform: uppercase;">${storeName}</div>
                    <div style="font-size: 11px; color: #444; margin-top: 2px;">${address}</div>
                    <div style="font-size: 11px; color: #444;">Hotline: <b>${hotline}</b></div>
                    <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
                    <div style="font-size: 15px; font-weight: bold;">PHIẾU THANH TOÁN</div>
                    <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">Số HĐ: ${o.order_code}</div>
                    <div style="font-size: 11px; color: #444;">Bàn: <b>${o.table_code}</b> | Thu ngân: <b>${o.user_name || 'Thu ngân'}</b></div>
                    <div style="font-size: 11px; color: #444;">Thời gian: ${o.completed_at || o.created_at || ''}</div>
                </div>
                
                <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
                
                <div style="margin: 8px 0;">
                    ${itemsHtml}
                </div>
                
                <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
                
                <div style="font-size: 12px; line-height: 1.6;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Tiền hàng:</span>
                        <span style="font-weight: bold;">${this.formatMoney(o.subtotal)} đ</span>
                    </div>
                    ${o.discount_amount > 0 ? `
                    <div style="display: flex; justify-content: space-between; color: #b91c1c;">
                        <span>Giảm giá:</span>
                        <span>-${this.formatMoney(o.discount_amount)} đ</span>
                    </div>` : ''}
                    ${o.vat_amount > 0 ? `
                    <div style="display: flex; justify-content: space-between;">
                        <span>VAT (${o.vat_percent}%):</span>
                        <span>+${this.formatMoney(o.vat_amount)} đ</span>
                    </div>` : ''}
                    <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
                    <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900;">
                        <span>TỔNG CỘNG:</span>
                        <span>${this.formatMoney(o.total_amount)} đ</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px;">
                        <span>Hình thức thanh toán:</span>
                        <span style="font-weight: bold;">${payMethodName}</span>
                    </div>
                    ${o.payment_method === 'cash' ? `
                    <div style="display: flex; justify-content: space-between; font-size: 11px;">
                        <span>Tiền khách đưa:</span>
                        <span>${this.formatMoney(o.cash_received)} đ</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px;">
                        <span>Tiền thối lại:</span>
                        <span style="font-weight: bold;">${this.formatMoney(o.change_amount)} đ</span>
                    </div>` : ''}
                </div>
                
                <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
                
                <div style="text-align: center; font-size: 11px; color: #333; margin-top: 6px;">
                    <div>Wifi: <b>${wifi}</b></div>
                    <div style="font-weight: bold; margin-top: 4px; font-size: 12px;">CẢM ƠN VÀ HẸN GẶP LẠI QUÝ KHÁCH!</div>
                    <div style="font-size: 9px; color: #777; margin-top: 2px;">In lại từ Quản trị POS Góc Phố</div>
                </div>
            `;

            let iframe = document.getElementById('admin-print-iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'admin-print-iframe';
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = '0';
                iframe.style.visibility = 'hidden';
                document.body.appendChild(iframe);
            }

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>In Hóa Đơn</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        * { box-sizing: border-box; }
                        body {
                            margin: 0;
                            padding: 8px 10px;
                            width: 76mm;
                            font-family: 'Courier New', Courier, monospace, 'Segoe UI', sans-serif;
                            font-size: 12px;
                            line-height: 1.35;
                            color: #000;
                            background: #fff;
                        }
                        @media print {
                            body { width: 76mm; padding: 4px 6px; }
                        }
                    </style>
                </head>
                <body>
                    ${receiptHtml}
                </body>
                </html>
            `);
            doc.close();

            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 200);
        } catch (e) {
            console.error('Error printing receipt:', e);
        }
    },

    // 6. Users & Employees Management
    async loadUsers() {
        try {
            const res = await fetch('api/users.php');
            const data = await res.json();
            if (data.success) {
                this.users = data.data;
                this.renderUsersTable();
            }
        } catch (e) {
            console.error('Error loading users:', e);
        }
    },

    renderUsersTable() {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;

        if (!this.users || this.users.length === 0) {
            tbody.innerHTML = this.renderEmptyState(8, 'fa-users-gear', 'Chưa có người dùng nào', 'Bấm nút "Thêm Người Dùng Mới" để tạo tài khoản nhân viên hoặc thu ngân.');
            return;
        }

        let html = '';
        this.users.forEach(u => {
            let roleBadge = '';
            let codeColor = 'text-sky-300 bg-sky-500/10 border-sky-500/20';

            if (u.role === 'admin') {
                roleBadge = '<span class="saas-badge bg-purple-500/15 text-purple-300 border border-purple-500/30"><i class="fas fa-crown text-[9px]"></i> Quản Trị (ADM)</span>';
                codeColor = 'text-purple-300 bg-purple-500/10 border-purple-500/20';
            } else if (u.role === 'cashier') {
                roleBadge = '<span class="saas-badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><i class="fas fa-cash-register text-[9px]"></i> Thu Ngân (ACC)</span>';
                codeColor = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
            } else if (u.role === 'kitchen') {
                roleBadge = '<span class="saas-badge bg-amber-500/15 text-amber-300 border border-amber-500/30"><i class="fas fa-fire text-[9px]"></i> Bếp / Bar (KIT)</span>';
                codeColor = 'text-amber-300 bg-amber-500/10 border-amber-500/20';
            } else if (u.role === 'customer') {
                roleBadge = '<span class="saas-badge bg-pink-500/15 text-pink-300 border border-pink-500/30"><i class="fas fa-user text-[9px]"></i> Khách Hàng (USR)</span>';
                codeColor = 'text-pink-300 bg-pink-500/10 border-pink-500/20';
            } else {
                roleBadge = '<span class="saas-badge bg-sky-500/15 text-sky-300 border border-sky-500/30"><i class="fas fa-person-walking text-[9px]"></i> Phục Vụ (STF)</span>';
                codeColor = 'text-sky-300 bg-sky-500/10 border-sky-500/20';
            }

            const isLocked = u.status === 'locked';

            html += `
                <tr class="hover:bg-sky-500/[0.04] transition-colors ${isLocked ? 'opacity-50' : ''}">
                    <td><span class="font-mono text-xs font-bold px-2 py-0.5 rounded border ${codeColor} whitespace-nowrap">${u.user_code || `U${u.id}`}</span></td>
                    <td><span class="text-xs text-slate-300 font-mono font-medium whitespace-nowrap">${u.username}</span></td>
                    <td class="col-name"><span class="text-xs font-bold text-white whitespace-nowrap">${u.fullname}</span></td>
                    <td class="col-center whitespace-nowrap">${roleBadge}</td>
                    <td><span class="text-xs text-slate-400 font-mono whitespace-nowrap">${u.phone || '-'}</span></td>
                    <td class="col-center"><span class="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-xs whitespace-nowrap">${u.pin_code || '-'}</span></td>
                    <td class="col-center">
                        <button type="button" onclick="Admin.toggleUserStatus(${u.id})" class="saas-badge ${isLocked ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'} cursor-pointer hover:opacity-80 transition whitespace-nowrap">
                            <span class="w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-rose-400' : 'bg-emerald-400'}"></span>
                            ${isLocked ? 'Đang khóa' : 'Hoạt động'}
                        </button>
                    </td>
                    <td class="col-right">
                        <div class="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <button type="button" class="saas-action-btn btn-edit" onclick="Admin.openEditUserModal(${u.id})" title="Sửa thông tin">
                                <i class="fas fa-pen text-[10px]"></i>
                            </button>
                            <button type="button" class="saas-action-btn btn-key" onclick="Admin.openResetPassModal(${u.id})" title="Đổi mật khẩu / PIN">
                                <i class="fas fa-key text-[10px]"></i>
                            </button>
                            <button type="button" class="saas-action-btn btn-delete" onclick="Admin.deleteUser(${u.id})" title="Xóa người dùng">
                                <i class="fas fa-trash-can text-[10px]"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    suggestNextUserCode(role) {
        const prefixMap = {
            admin: 'ADM',
            cashier: 'ACC',
            waiter: 'STF',
            kitchen: 'KIT',
            customer: 'USR'
        };
        const prefix = prefixMap[role] || 'STF';
        let maxNum = 0;
        if (Array.isArray(this.users)) {
            this.users.forEach(u => {
                if (u.user_code && u.user_code.toUpperCase().startsWith(prefix)) {
                    const match = u.user_code.match(/\d+$/);
                    if (match) {
                        const num = parseInt(match[0], 10);
                        if (num > maxNum) maxNum = num;
                    }
                }
            });
        }
        return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    },

    onUserRoleChange() {
        const role = document.getElementById('modal-user-role').value;
        const codeInput = document.getElementById('modal-user-code');
        const isEdit = !!document.getElementById('modal-user-id').value;
        if (!isEdit || !codeInput.value) {
            codeInput.value = this.suggestNextUserCode(role);
        }
    },

    openAddUserModal() {
        document.getElementById('modal-user-id').value = '';
        document.getElementById('modal-user-role').value = 'waiter';
        document.getElementById('modal-user-code').value = this.suggestNextUserCode('waiter');
        document.getElementById('modal-user-username').value = '';
        document.getElementById('modal-user-username').disabled = false;
        document.getElementById('modal-user-fullname').value = '';
        document.getElementById('modal-user-phone').value = '';
        document.getElementById('modal-user-pincode').value = Math.floor(1000 + Math.random() * 9000);
        document.getElementById('modal-user-password').value = '123456';
        document.getElementById('modal-user-pass-container').classList.remove('hidden');
        document.getElementById('user-modal-title').innerText = 'Thêm Người Dùng Mới';
        document.getElementById('user-modal').classList.add('open');
    },

    openEditUserModal(userId) {
        const u = this.users.find(x => x.id === userId);
        if (!u) return;

        document.getElementById('modal-user-id').value = u.id;
        document.getElementById('modal-user-code').value = u.user_code || this.suggestNextUserCode(u.role);
        document.getElementById('modal-user-username').value = u.username;
        document.getElementById('modal-user-username').disabled = true; // Cannot edit username
        document.getElementById('modal-user-fullname').value = u.fullname;
        document.getElementById('modal-user-role').value = u.role;
        document.getElementById('modal-user-phone').value = u.phone || '';
        document.getElementById('modal-user-pincode').value = u.pin_code || '';
        document.getElementById('modal-user-pass-container').classList.add('hidden'); // Password changed via reset modal
        document.getElementById('user-modal-title').innerText = `Chỉnh Sửa: ${u.fullname} (${u.user_code || ''})`;
        document.getElementById('user-modal').classList.add('open');
    },

    async saveUser() {
        const id = document.getElementById('modal-user-id').value;
        const user_code = document.getElementById('modal-user-code').value.trim().toUpperCase();
        const username = document.getElementById('modal-user-username').value.trim();
        const fullname = document.getElementById('modal-user-fullname').value.trim();
        const role = document.getElementById('modal-user-role').value;
        const phone = document.getElementById('modal-user-phone').value.trim();
        const pin_code = document.getElementById('modal-user-pincode').value.trim();
        const password = document.getElementById('modal-user-password').value.trim();

        if (!fullname) {
            alert('Vui lòng nhập họ và tên người dùng!');
            return;
        }

        const isEdit = !!id;
        const url = isEdit ? 'api/users.php?action=update' : 'api/users.php?action=add';
        const payload = isEdit 
            ? { id, user_code, fullname, role, phone, pin_code, status: 'active' }
            : { user_code, username, fullname, role, phone, pin_code, password };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('user-modal').classList.remove('open');
                await this.loadUsers();
            } else {
                alert(data.message || 'Lỗi lưu thông tin người dùng');
            }
        } catch (e) {
            console.error('Error saving user:', e);
        }
    },

    openResetPassModal(userId) {
        const u = this.users.find(x => x.id === userId);
        if (!u) return;

        document.getElementById('reset-user-id').value = u.id;
        document.getElementById('reset-new-password').value = '';
        document.getElementById('reset-new-pin').value = u.pin_code || '';
        document.getElementById('reset-pass-modal').classList.add('open');
    },

    async submitResetPassword() {
        const id = document.getElementById('reset-user-id').value;
        const newPassword = document.getElementById('reset-new-password').value.trim();
        const newPin = document.getElementById('reset-new-pin').value.trim();

        if (!newPassword && !newPin) {
            alert('Vui lòng nhập mật khẩu mới hoặc mã PIN mới!');
            return;
        }

        try {
            const res = await fetch('api/users.php?action=reset_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, new_password: newPassword, new_pin: newPin })
            });
            const data = await res.json();
            if (data.success) {
                alert('Đổi mật khẩu / mã PIN thành công!');
                document.getElementById('reset-pass-modal').classList.remove('open');
                await this.loadUsers();
            } else {
                alert(data.message || 'Lỗi đổi mật khẩu');
            }
        } catch (e) {
            console.error('Error resetting password:', e);
        }
    },

    async toggleUserStatus(userId) {
        try {
            const res = await fetch('api/users.php?action=toggle_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId })
            });
            const data = await res.json();
            if (data.success) {
                await this.loadUsers();
            } else {
                alert(data.message || 'Lỗi thao tác');
            }
        } catch (e) {
            console.error('Error toggling user status:', e);
        }
    },

    async deleteUser(userId) {
        if (!confirm('Bạn có chắc chắn muốn xóa nhân viên này khỏi hệ thống?')) return;
        try {
            const res = await fetch(`api/users.php?action=delete&id=${userId}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                await this.loadUsers();
            } else {
                alert(data.message || 'Lỗi xóa nhân viên');
            }
        } catch (e) {
            console.error('Error deleting user:', e);
        }
    },

    // 7. Kitchen & Staff Performance Analytics
    setAnalyticsPreset(preset) {
        const today = new Date();
        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        let fromDate = new Date();
        let toDate = new Date();

        if (preset === 'today') {
            fromDate = today;
            toDate = today;
        } else if (preset === 'yesterday') {
            fromDate.setDate(today.getDate() - 1);
            toDate.setDate(today.getDate() - 1);
        } else if (preset === '7days') {
            fromDate.setDate(today.getDate() - 6);
            toDate = today;
        } else if (preset === 'month') {
            fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
            toDate = today;
        }

        const fromInput = document.getElementById('ana-date-from');
        const toInput = document.getElementById('ana-date-to');
        if (fromInput) fromInput.value = formatDate(fromDate);
        if (toInput) toInput.value = formatDate(toDate);

        ['today', 'yesterday', '7days', 'month'].forEach(p => {
            const btn = document.getElementById(`btn-ana-${p}`);
            if (btn) {
                if (p === preset) {
                    btn.className = 'px-2.5 py-1 rounded-lg text-amber-300 bg-amber-500/20 font-bold';
                } else {
                    btn.className = 'px-2.5 py-1 rounded-lg text-slate-300 hover:text-white';
                }
            }
        });

        this.loadAnalyticsData();
    },

    async loadAnalyticsData() {
        const fromInput = document.getElementById('ana-date-from');
        const toInput = document.getElementById('ana-date-to');

        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const todayStr = formatDate(new Date());

        if (fromInput && !fromInput.value) fromInput.value = todayStr;
        if (toInput && !toInput.value) toInput.value = todayStr;

        const dateFrom = fromInput ? fromInput.value : todayStr;
        const dateTo = toInput ? toInput.value : todayStr;

        try {
            const res = await fetch(`api/reports.php?action=service_performance&date_from=${dateFrom}&date_to=${dateTo}`);
            const data = await res.json();
            if (!data.success) {
                const staffTbody = document.getElementById('ana-staff-tbody');
                if (staffTbody) staffTbody.innerHTML = this.renderEmptyState(6, 'fa-user-clock', 'Chưa có dữ liệu nhân viên', 'Dữ liệu xếp hạng phục vụ & thu ngân sẽ hiển thị khi phát sinh ca làm việc.');
                const dishesTbody = document.getElementById('ana-dishes-tbody');
                if (dishesTbody) dishesTbody.innerHTML = this.renderEmptyState(3, 'fa-mug-hot', 'Chưa có món chế biến', 'Top món sẽ cập nhật ngay khi bộ phận bếp hoàn thành món ăn.');
                const logsTbody = document.getElementById('ana-logs-tbody');
                if (logsTbody) logsTbody.innerHTML = this.renderEmptyState(7, 'fa-clipboard-check', 'Chưa có sự kiện nào', 'Nhật ký audit trail thời gian thực của bếp & phục vụ sẽ ghi nhận tại đây.');
                return;
            }

            // 1. KPI Cards
            const kpi = data.kitchen_kpi || {};
            const setTxt = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = val;
            };

            setTxt('ana-stat-orders', kpi.total_orders_cooked || 0);
            setTxt('ana-stat-items', `${kpi.total_items_cooked || 0} món / ly đã làm`);
            setTxt('ana-stat-prep-time', `${kpi.avg_prep_minutes || 0} <span class="text-xs font-normal">phút/đơn</span>`);
            setTxt('ana-stat-deliver-time', `${kpi.avg_deliver_minutes || 0} <span class="text-xs font-normal">phút</span>`);
            setTxt('ana-stat-ontime-rate', `${kpi.on_time_rate || 100}%`);

            // 2. Staff Ranking Table
            const staffTbody = document.getElementById('ana-staff-tbody');
            if (staffTbody) {
                const staff = data.staff_stats || [];
                if (staff.length === 0) {
                    staffTbody.innerHTML = this.renderEmptyState(6, 'fa-user-clock', 'Chưa có dữ liệu nhân viên', 'Dữ liệu xếp hạng phục vụ & thu ngân sẽ hiển thị khi phát sinh ca làm việc.');
                } else {
                    let html = '';
                    staff.forEach((u, i) => {
                        let roleBadge = '<span class="saas-badge bg-slate-800 text-slate-300">Nhân viên</span>';
                        if (u.role === 'admin') roleBadge = '<span class="saas-badge bg-purple-500/15 text-purple-300 border border-purple-500/30">Quản Lý</span>';
                        if (u.role === 'cashier') roleBadge = '<span class="saas-badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Thu Ngân</span>';
                        if (u.role === 'waiter') roleBadge = '<span class="saas-badge bg-sky-500/15 text-sky-300 border border-sky-500/30">Phục Vụ</span>';
                        if (u.role === 'kitchen') roleBadge = '<span class="saas-badge bg-amber-500/15 text-amber-300 border border-amber-500/30">Bếp / Bar</span>';

                        const rankMedal = i === 0 ? '🥇 ' : (i === 1 ? '🥈 ' : (i === 2 ? '🥉 ' : ''));

                        html += `
                            <tr class="hover:bg-sky-500/[0.04] transition-colors">
                                <td>
                                    <div class="font-bold text-white text-xs flex items-center gap-1.5">
                                        <span>${rankMedal}</span>
                                        <span>${u.fullname}</span>
                                        <span class="text-[10px] text-slate-400 font-mono">(@${u.username})</span>
                                    </div>
                                </td>
                                <td>${roleBadge}</td>
                                <td class="col-center font-mono font-bold text-sky-400 text-xs">${u.orders_created}</td>
                                <td class="col-center font-mono font-bold text-emerald-400 text-xs">${u.orders_served}</td>
                                <td class="col-money"><span class="font-mono font-bold text-amber-300 text-xs">${this.formatMoney(u.total_revenue)} đ</span></td>
                                <td class="col-center font-mono text-slate-300 text-xs">${u.avg_deliver_minutes > 0 ? (u.avg_deliver_minutes + 'p') : '--'}</td>
                            </tr>
                        `;
                    });
                    staffTbody.innerHTML = html;
                }
            }

            // 3. Top Cooked Dishes Table
            const dishesTbody = document.getElementById('ana-dishes-tbody');
            if (dishesTbody) {
                const dishes = data.top_cooked_dishes || [];
                if (dishes.length === 0) {
                    dishesTbody.innerHTML = this.renderEmptyState(3, 'fa-fire-burner', 'Chưa có món chế biến', 'Top món sẽ cập nhật ngay khi bộ phận bếp hoàn thành món ăn.');
                } else {
                    let html = '';
                    dishes.forEach((d, i) => {
                        html += `
                            <tr class="hover:bg-sky-500/[0.04] transition-colors">
                                <td>
                                    <div class="font-bold text-white text-xs flex items-center gap-1">
                                        <span class="text-amber-400 font-mono font-bold text-xs">${i + 1}.</span>
                                        <span class="truncate">${d.product_name}</span>
                                    </div>
                                </td>
                                <td class="col-center font-mono font-bold text-amber-300 text-xs">
                                    <span class="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">x${d.total_qty} ${d.unit || ''}</span>
                                </td>
                                <td class="col-money"><span class="font-mono font-bold text-slate-200 text-xs">${this.formatMoney(d.total_revenue)} đ</span></td>
                            </tr>
                        `;
                    });
                    dishesTbody.innerHTML = html;
                }
            }

            // 4. Audit Service Logs Table
            const logsTbody = document.getElementById('ana-logs-tbody');
            if (logsTbody) {
                const logs = data.recent_logs || [];
                if (logs.length === 0) {
                    logsTbody.innerHTML = this.renderEmptyState(7, 'fa-clock-rotate-left', 'Chưa có sự kiện nào', 'Nhật ký audit trail thời gian thực của bếp & phục vụ sẽ ghi nhận tại đây.');
                } else {
                    let html = '';
                    logs.forEach(l => {
                        let actionBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">${l.action_label}</span>`;
                        if (l.action === 'order_created') actionBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30"><i class="fas fa-clipboard-list mr-1"></i>Nhận Order</span>';
                        if (l.action === 'kitchen_ready') actionBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"><i class="fas fa-fire mr-1"></i>Bếp Xong</span>';
                        if (l.action === 'waiter_served') actionBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"><i class="fas fa-check-circle mr-1"></i>Đã Bưng Ra</span>';
                        if (l.action === 'checkout') actionBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30"><i class="fas fa-cash-register mr-1"></i>Thanh Toán</span>';
                        if (l.action === 'kitchen_reopen') actionBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30"><i class="fas fa-rotate-left mr-1"></i>Nấu Lại</span>';
                        if (l.action === 'cancel_order') actionBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/30 text-rose-400 border border-rose-500/40"><i class="fas fa-times-circle mr-1"></i>Hủy Đơn</span>';

                        const timeFormatted = l.created_at ? l.created_at.substring(11, 19) + ' ' + l.created_at.substring(8, 10) + '/' + l.created_at.substring(5, 7) : '--';

                        html += `
                            <tr class="border-b border-white/5 hover:bg-slate-800/40 transition-colors">
                                <td class="p-2 text-slate-400 font-mono text-[11px]">${timeFormatted}</td>
                                <td class="p-2 font-mono font-bold text-sky-400">${l.order_code}</td>
                                <td class="p-2 font-bold text-amber-300">${l.table_code}</td>
                                <td class="p-2">${actionBadge}</td>
                                <td class="p-2 text-white font-semibold">${l.user_name || 'Hệ thống'}</td>
                                <td class="p-2 text-slate-400 uppercase text-[10px]">${l.user_role || '--'}</td>
                                <td class="p-2 text-slate-300 text-[11px] font-sans">${l.note || ''}</td>
                            </tr>
                        `;
                    });
                    logsTbody.innerHTML = html;
                }
            }
        } catch (e) {
            console.error('Error loading analytics:', e);
        }
    },

    // ==========================================
    // CLOUD SYNC (MYSQL) MANAGEMENT
    // ==========================================
    async openCloudSyncModal() {
        const modal = document.getElementById('cloud-sync-modal');
        if (!modal) return;

        // Reset alert and result
        this.hideSyncAlert();
        const resBox = document.getElementById('sync-result-box');
        if (resBox) resBox.classList.add('hidden');

        // Fetch current config
        try {
            const res = await fetch('api/sync_mysql.php?action=get_config');
            const data = await res.json();
            if (data.success && data.config) {
                const c = data.config;
                if (document.getElementById('sync-host')) document.getElementById('sync-host').value = c.host || '127.0.0.1';
                if (document.getElementById('sync-port')) document.getElementById('sync-port').value = c.port || 3306;
                if (document.getElementById('sync-database')) document.getElementById('sync-database').value = c.database || 'pos_sale_app';
                if (document.getElementById('sync-user')) document.getElementById('sync-user').value = c.user || 'root';
                if (document.getElementById('sync-password')) document.getElementById('sync-password').value = c.password || '';
            }
        } catch (err) {
            console.error('Error fetching MySQL config:', err);
        }

        modal.classList.add('open');
    },

    closeCloudSyncModal() {
        const modal = document.getElementById('cloud-sync-modal');
        if (modal) modal.classList.remove('open');
    },

    toggleSyncPasswordVisibility() {
        const passInput = document.getElementById('sync-password');
        const eyeIcon = document.getElementById('sync-pass-eye');
        if (!passInput || !eyeIcon) return;

        if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
        } else {
            passInput.type = 'password';
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }
    },

    showSyncAlert(type, message, technical = null) {
        const alertBox = document.getElementById('cloud-sync-alert');
        if (!alertBox) return;

        alertBox.className = 'mb-4 p-3.5 rounded-xl border text-xs leading-relaxed transition-all duration-300';

        let icon = 'fa-info-circle';
        let bgBorder = 'bg-sky-500/10 border-sky-500/30 text-sky-200';

        if (type === 'success') {
            icon = 'fa-circle-check';
            bgBorder = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200';
        } else if (type === 'error') {
            icon = 'fa-triangle-exclamation';
            bgBorder = 'bg-rose-500/15 border-rose-500/40 text-rose-200';
        }

        alertBox.className += ' ' + bgBorder;

        let techHtml = '';
        if (technical) {
            techHtml = `
                <div class="mt-2 pt-2 border-t border-white/10 text-[11px] font-mono text-slate-300">
                    <span class="text-slate-400 font-bold block mb-0.5">Chi tiết lỗi kỹ thuật (Technical Log):</span>
                    <pre class="whitespace-pre-wrap break-all bg-black/40 p-2 rounded text-rose-300">${this.escapeHtml(technical)}</pre>
                </div>
            `;
        }

        alertBox.innerHTML = `
            <div class="flex items-start gap-2.5">
                <i class="fas ${icon} text-base mt-0.5 shrink-0"></i>
                <div class="flex-1">
                    <div class="whitespace-pre-line">${message}</div>
                    ${techHtml}
                </div>
            </div>
        `;
        alertBox.classList.remove('hidden');
    },

    hideSyncAlert() {
        const alertBox = document.getElementById('cloud-sync-alert');
        if (alertBox) {
            alertBox.classList.add('hidden');
            alertBox.innerHTML = '';
        }
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    getSyncFormData() {
        const hostEl = document.getElementById('sync-host');
        const portEl = document.getElementById('sync-port');
        const dbEl = document.getElementById('sync-database');
        const userEl = document.getElementById('sync-user');
        const pwdEl = document.getElementById('sync-password');
        const autoCreateEl = document.getElementById('sync-auto-create-db');
        const saveCfgEl = document.getElementById('sync-save-config');
        return {
            host: hostEl && hostEl.value ? hostEl.value.trim() : '127.0.0.1',
            port: parseInt(portEl && portEl.value ? portEl.value : '3306'),
            database: dbEl && dbEl.value ? dbEl.value.trim() : 'pos_sale_app',
            user: userEl && userEl.value ? userEl.value.trim() : 'root',
            password: pwdEl && pwdEl.value ? pwdEl.value : '',
            auto_create_db: autoCreateEl ? autoCreateEl.checked : true,
            save_config: saveCfgEl ? saveCfgEl.checked : true
        };
    },

    async testCloudConnection() {
        const payload = this.getSyncFormData();
        const testBtn = document.getElementById('btn-sync-test');
        const origBtnText = testBtn ? testBtn.innerHTML : '';

        if (!payload.host) {
            this.showSyncAlert('error', 'Vui lòng điền địa chỉ máy chủ MySQL (Host)!');
            return;
        }

        try {
            if (testBtn) {
                testBtn.disabled = true;
                testBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-sky-400"></i><span>Đang kiểm tra...</span>';
            }
            this.showSyncAlert('info', `Đang thử kết nối đến ${payload.host}:${payload.port}...`);

            const res = await fetch('api/sync_mysql.php?action=test_connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                const dbStatus = data.database_exists 
                    ? `<span class="text-emerald-400 font-bold">Đã tồn tại</span>`
                    : `<span class="text-amber-400 font-bold">Chưa có (hệ thống sẽ tự tạo khi đồng bộ)</span>`;

                this.showSyncAlert(
                    'success',
                    `✅ <b>${data.message}</b>\n• Phiên bản máy chủ: <b>${data.server_version}</b>\n• Trạng thái cơ sở dữ liệu <code>${data.database_name}</code>: ${dbStatus}`
                );
            } else {
                this.showSyncAlert('error', data.message || 'Kết nối MySQL thất bại!', data.technical);
            }
        } catch (err) {
            console.error('Test connection error:', err);
            this.showSyncAlert('error', 'Không thể gửi yêu cầu kiểm tra kết nối đến backend!', err.message);
        } finally {
            if (testBtn) {
                testBtn.disabled = false;
                testBtn.innerHTML = origBtnText;
            }
        }
    },

    async startCloudSync() {
        const payload = this.getSyncFormData();
        const startBtn = document.getElementById('btn-sync-start');
        const origBtnText = startBtn ? startBtn.innerHTML : '';

        if (!confirm(`Bạn có chắc chắn muốn đồng bộ toàn bộ cơ sở dữ liệu lên MySQL tại ${payload.host}:${payload.port} [DB: ${payload.database}] không?`)) {
            return;
        }

        try {
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-white"></i><span>Đang đồng bộ...</span>';
            }
            this.showSyncAlert('info', `Đang sao lưu và đồng bộ toàn bộ bảng dữ liệu lên MySQL... Vui lòng chờ vài giây...`);

            const res = await fetch('api/sync_mysql.php?action=sync_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                this.showSyncAlert(
                    'success',
                    `🎉 <b>${data.message}</b>\n• Máy chủ: <b>${data.host} (${data.server_version})</b> | CSDL: <b>${data.database}</b>\n• Tổng số bản ghi đã đồng bộ: <b>${data.total_records} dòng</b>\n• Thời gian hoàn thành: <b>${data.synced_at}</b>`
                );

                // Render itemized tables breakdown
                const resBox = document.getElementById('sync-result-box');
                const resGrid = document.getElementById('sync-result-grid');
                if (resBox && resGrid && data.synced_counts) {
                    const tableNamesMap = {
                        'users': 'Tài khoản',
                        'categories': 'Danh mục',
                        'products': 'Thực đơn/Món',
                        'tables_areas': 'Bàn / Khu',
                        'orders': 'Hóa đơn',
                        'order_items': 'Chi tiết món',
                        'store_settings': 'Cài đặt quán',
                        'kitchen_service_logs': 'Nhật ký bếp'
                    };

                    let gridHtml = '';
                    for (const [tbl, count] of Object.entries(data.synced_counts)) {
                        const label = tableNamesMap[tbl] || tbl;
                        gridHtml += `
                            <div class="p-2 rounded bg-slate-800/80 border border-white/5 flex flex-col justify-between">
                                <span class="text-slate-400 text-[10px]">${label}</span>
                                <span class="text-cyan-300 font-bold text-sm font-mono">${count} <span class="text-[10px] text-slate-500 font-normal">dòng</span></span>
                            </div>
                        `;
                    }
                    resGrid.innerHTML = gridHtml;
                    resBox.classList.remove('hidden');
                }
            } else {
                this.showSyncAlert('error', data.message || 'Đồng bộ dữ liệu thất bại!', data.technical);
            }
        } catch (err) {
            console.error('Start sync error:', err);
            this.showSyncAlert('error', 'Lỗi kết nối khi gửi dữ liệu đồng bộ!', err.message);
        } finally {
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = origBtnText;
            }
        }
    },

    // ========================================================
    // 8. OPERATIONS: KHO, CHI PHÍ VẬT LIỆU, TIỀN LƯƠNG & REALTIME STAFF
    // ========================================================
    currentOpsSubtab: 'realtime',
    materialsList: [],
    realtimeTimer: null,

    loadOperationsTab() {
        this.switchOpsSubtab(this.currentOpsSubtab || 'realtime');
        // Setup realtime poll if not already running
        if (!this.realtimeTimer) {
            this.realtimeTimer = setInterval(() => {
                if (this.currentTab === 'operations' && this.currentOpsSubtab === 'realtime') {
                    this.loadRealtimeStaff();
                }
            }, 8000);
        }
    },

    switchOpsSubtab(subtab) {
        this.currentOpsSubtab = subtab;

        // Update sub-tab buttons
        ['realtime', 'inventory', 'payroll'].forEach(s => {
            const btn = document.getElementById(`ops-subtab-${s}`);
            const view = document.getElementById(`ops-subview-${s}`);
            if (btn) {
                if (s === subtab) {
                    btn.className = 'ops-subtab-btn px-3 py-1.5 rounded-lg font-bold transition-all bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1.5';
                } else {
                    btn.className = 'ops-subtab-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5';
                }
            }
            if (view) {
                if (s === subtab) {
                    view.classList.remove('hidden');
                } else {
                    view.classList.add('hidden');
                }
            }
        });

        if (subtab === 'realtime') this.loadRealtimeStaff();
        if (subtab === 'inventory') this.loadMaterials();
        if (subtab === 'payroll') this.loadPayroll();
    },

    // 8.1 Realtime Staff
    async loadRealtimeStaff() {
        try {
            const res = await fetch('api/operations.php?action=get_realtime_staff');
            const data = await res.json();
            if (!data.success) return;

            // Server time
            const clockEl = document.getElementById('realtime-server-clock');
            if (clockEl) clockEl.innerText = data.server_time || '';

            // Summary counts
            const summary = data.summary || {};
            const cashierEl = document.getElementById('realtime-stat-cashier');
            const kitchenEl = document.getElementById('realtime-stat-kitchen');
            const waiterEl = document.getElementById('realtime-stat-waiter');
            const adminEl = document.getElementById('realtime-stat-admin');
            const badgeCountEl = document.getElementById('badge-online-count');

            if (cashierEl) cashierEl.innerText = summary.cashier || 0;
            if (kitchenEl) kitchenEl.innerText = summary.kitchen || 0;
            if (waiterEl) waiterEl.innerText = summary.waiter || 0;
            if (adminEl) adminEl.innerText = summary.admin || 0;
            if (badgeCountEl) badgeCountEl.innerText = summary.total_working || 0;

            const tbody = document.getElementById('realtime-staff-tbody');
            if (!tbody) return;

            if (!data.staff_list || data.staff_list.length === 0) {
                tbody.innerHTML = this.renderEmptyState(8, 'fa-id-badge', 'Chưa có nhân viên trong ca làm việc', 'Khi nhân viên đăng nhập trên máy POS, Order hoặc Bếp, hệ thống sẽ tự động chấm công và hiển thị tại đây.');
                return;
            }

            const roleBadges = {
                cashier: { label: 'Thu Ngân (ACC)', class: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                kitchen: { label: 'Tổ Bếp / Bar (KIT)', class: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                waiter: { label: 'Order Phục Vụ (STF)', class: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
                admin: { label: 'Quản Trị (ADM)', class: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
                customer: { label: 'Khách VIP (USR)', class: 'bg-slate-700 text-slate-300 border-white/10' }
            };

            tbody.innerHTML = data.staff_list.map(st => {
                const rInfo = roleBadges[st.role] || { label: st.role, class: 'bg-slate-700 text-slate-300' };
                const isRecent = st.is_recently_active;
                const statusBadge = isRecent 
                    ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Đang làm việc</span>`
                    : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px]"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Vắng mặt tạm thời</span>`;

                return `
                    <tr class="hover:bg-white/5 transition-colors">
                        <td class="py-2.5 px-3">
                            <div class="flex items-center gap-2">
                                <div class="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-sky-400 text-xs">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div>
                                    <div class="font-bold text-slate-200 text-xs">${st.fullname}</div>
                                    <div class="text-[10px] font-mono text-slate-400">${st.user_code || st.username}</div>
                                </div>
                            </div>
                        </td>
                        <td class="py-2.5 px-3">
                            <span class="px-2 py-0.5 rounded-md border text-[10px] font-bold ${rInfo.class}">${rInfo.label}</span>
                        </td>
                        <td class="py-2.5 px-3 font-mono text-slate-300">
                            <i class="far fa-clock text-sky-400 mr-1 text-[10px]"></i>${st.check_in_display}
                        </td>
                        <td class="py-2.5 px-3">
                            <span class="px-2 py-0.5 rounded-md bg-slate-800 text-sky-300 font-bold font-mono text-xs border border-white/5">
                                ${st.elapsed_display}
                            </span>
                        </td>
                        <td class="py-2.5 px-3 font-mono text-emerald-400 font-bold">
                            ${Admin.formatMoney(st.hourly_rate)} đ/h
                        </td>
                        <td class="py-2.5 px-3">${statusBadge}</td>
                        <td class="py-2.5 px-3 text-[11px] text-slate-400">
                            <span class="truncate max-w-[120px] block" title="${st.device_info}">${st.device_info}</span>
                        </td>
                        <td class="py-2.5 px-3 text-right">
                            <button type="button" onclick="Admin.manualCheckout(${st.attendance_id || 0}, ${st.user_id}, '${st.fullname}')" class="btn-glass text-[11px] py-1 px-2.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border-rose-500/30 font-bold shadow-sm" title="Chốt ca kết thúc cho nhân viên nếu quên checkout">
                                <i class="fas fa-right-from-bracket mr-1"></i> Chốt Ca
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.error('loadRealtimeStaff error:', e);
        }
    },

    async manualCheckout(attId, userId, name) {
        if (!confirm(`Xác nhận chốt kết thúc ca làm việc cho nhân viên "${name}"?\nHệ thống sẽ tự động tính tổng số giờ làm và tiền lương ca đến thời điểm này.`)) {
            return;
        }
        try {
            const res = await fetch('api/operations.php?action=manual_checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attendance_id: attId, user_id: userId })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.loadRealtimeStaff();
                this.loadPayroll();
            } else {
                alert(data.message || 'Lỗi khi chốt ca');
            }
        } catch (e) {
            alert('Lỗi kết nối máy chủ');
        }
    },

    // 8.2 Inventory & Material Costs
    async loadMaterials() {
        try {
            const search = document.getElementById('inv-search-input')?.value.trim() || '';
            const cat = document.getElementById('inv-category-filter')?.value || 'all';

            const res = await fetch(`api/operations.php?action=get_materials&search=${encodeURIComponent(search)}&category=${encodeURIComponent(cat)}`);
            const data = await res.json();
            if (!data.success) return;

            this.materialsList = data.materials || [];

            // Update KPI
            const summary = data.summary || {};
            const totalItemsEl = document.getElementById('inv-stat-total-items');
            const totalValueEl = document.getElementById('inv-stat-total-value');
            const lowStockEl = document.getElementById('inv-stat-low-stock');

            if (totalItemsEl) totalItemsEl.innerText = summary.total_items || 0;
            if (totalValueEl) totalValueEl.innerText = this.formatMoney(summary.total_stock_value) + ' đ';
            if (lowStockEl) lowStockEl.innerText = summary.low_stock_count || 0;

            // Load month expense for materials
            this.loadMonthMaterialExpense();

            // Populate category filter if needed
            const catFilter = document.getElementById('inv-category-filter');
            if (catFilter && catFilter.options.length <= 1 && data.categories) {
                data.categories.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.innerText = c;
                    catFilter.appendChild(opt);
                });
            }

            // Render table
            const tbody = document.getElementById('inv-materials-tbody');
            if (!tbody) return;

            if (this.materialsList.length === 0) {
                tbody.innerHTML = this.renderEmptyState(10, 'fa-boxes-stacked', 'Kho nguyên vật liệu trống', 'Chưa có nguyên vật liệu nào trong kho phù hợp với bộ lọc tìm kiếm.');
                return;
            }

            tbody.innerHTML = this.materialsList.map(m => {
                const isLow = m.is_low;
                const stockBadge = isLow 
                    ? `<span class="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 font-mono text-xs flex items-center gap-1 w-max"><i class="fas fa-triangle-exclamation text-[10px]"></i> ${m.quantity} ${m.unit}</span>`
                    : `<span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 font-mono text-xs w-max block">${m.quantity} ${m.unit}</span>`;

                return `
                    <tr class="hover:bg-white/5 transition-colors ${isLow ? 'bg-rose-500/5' : ''}">
                        <td class="py-2.5 px-3 font-mono font-bold text-amber-400">${m.code}</td>
                        <td class="py-2.5 px-3">
                            <div class="font-bold text-slate-100 text-xs">${m.name}</div>
                            ${m.note ? `<div class="text-[10px] text-slate-400 truncate max-w-xs">${m.note}</div>` : ''}
                        </td>
                        <td class="py-2.5 px-3">
                            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold border border-white/5">${m.category}</span>
                        </td>
                        <td class="py-2.5 px-3 text-slate-300 font-medium">${m.unit}</td>
                        <td class="py-2.5 px-3">${stockBadge}</td>
                        <td class="py-2.5 px-3 font-mono text-slate-400 text-xs">${m.min_quantity} ${m.unit}</td>
                        <td class="py-2.5 px-3 font-mono text-slate-300">${Admin.formatMoney(m.cost_price)} đ</td>
                        <td class="py-2.5 px-3 font-mono font-bold text-emerald-400">${Admin.formatMoney(m.stock_value)} đ</td>
                        <td class="py-2.5 px-3 text-[11px] text-slate-400">${m.supplier || 'Chưa có'}</td>
                        <td class="py-2.5 px-3 text-right">
                            <div class="flex items-center justify-end gap-1">
                                <button type="button" onclick="Admin.openStockTransactionModal('import', ${m.id})" class="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30 text-xs" title="Nhập kho nhanh cho món này">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button type="button" onclick="Admin.editMaterial(${m.id})" class="p-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border border-sky-500/30 text-xs" title="Sửa thông tin">
                                    <i class="fas fa-pen"></i>
                                </button>
                                <button type="button" onclick="Admin.deleteMaterial(${m.id}, '${m.name}')" class="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 text-xs" title="Xóa">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.error('loadMaterials error:', e);
        }
    },

    async loadMonthMaterialExpense() {
        try {
            const res = await fetch('api/operations.php?action=get_transactions&period=month&type=import');
            const data = await res.json();
            if (data.success) {
                const el = document.getElementById('inv-stat-month-expense');
                if (el) el.innerText = this.formatMoney(data.total_expense) + ' đ';
            }
        } catch (e) {}
    },

    openMaterialModal(mat = null) {
        document.getElementById('modal-mat-id').value = mat ? mat.id : '';
        document.getElementById('modal-mat-code').value = mat ? mat.code : '';
        document.getElementById('modal-mat-name').value = mat ? mat.name : '';
        document.getElementById('modal-mat-category').value = mat ? mat.category : 'Cà phê & Trà';
        document.getElementById('modal-mat-unit').value = mat ? mat.unit : 'kg';
        document.getElementById('modal-mat-qty').value = mat ? mat.quantity : 0;
        document.getElementById('modal-mat-qty').disabled = mat ? true : false;
        document.getElementById('modal-mat-minqty').value = mat ? mat.min_quantity : 5;
        document.getElementById('modal-mat-cost').value = mat ? mat.cost_price : 0;
        document.getElementById('modal-mat-supplier').value = mat ? (mat.supplier || '') : '';
        document.getElementById('modal-mat-note').value = mat ? (mat.note || '') : '';

        const title = document.getElementById('modal-material-title');
        if (title) title.innerHTML = mat ? '<i class="fas fa-pen"></i> Sửa Nguyên Vật Liệu' : '<i class="fas fa-boxes-stacked"></i> Thêm Nguyên Vật Liệu Mới';

        document.getElementById('modal-material').classList.add('open');
    },

    editMaterial(id) {
        const mat = this.materialsList.find(m => m.id == id);
        if (mat) this.openMaterialModal(mat);
    },

    closeMaterialModal() {
        document.getElementById('modal-material').classList.remove('open');
    },

    async submitMaterial(e) {
        e.preventDefault();
        const id = document.getElementById('modal-mat-id').value;
        const payload = {
            id: id ? parseInt(id) : 0,
            code: document.getElementById('modal-mat-code').value.trim(),
            name: document.getElementById('modal-mat-name').value.trim(),
            category: document.getElementById('modal-mat-category').value.trim(),
            unit: document.getElementById('modal-mat-unit').value.trim(),
            quantity: parseFloat(document.getElementById('modal-mat-qty').value) || 0,
            min_quantity: parseFloat(document.getElementById('modal-mat-minqty').value) || 0,
            cost_price: parseFloat(document.getElementById('modal-mat-cost').value) || 0,
            supplier: document.getElementById('modal-mat-supplier').value.trim(),
            note: document.getElementById('modal-mat-note').value.trim()
        };

        try {
            const res = await fetch('api/operations.php?action=save_material', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.closeMaterialModal();
                this.loadMaterials();
            } else {
                alert(data.message || 'Lỗi khi lưu nguyên vật liệu');
            }
        } catch (err) {
            alert('Lỗi kết nối máy chủ');
        }
    },

    async deleteMaterial(id, name) {
        if (!confirm(`Bạn có chắc muốn xóa nguyên vật liệu "${name}" khỏi danh mục quản lý?`)) return;
        try {
            const res = await fetch('api/operations.php?action=delete_material', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                this.loadMaterials();
            } else {
                alert(data.message || 'Lỗi khi xóa');
            }
        } catch (e) {
            alert('Lỗi kết nối máy chủ');
        }
    },

    // ========================================================
    // 8.3.1 SMART INVENTORY GOODS RECEIPT (3 METHODS & AI OCR)
    // ========================================================
    importState: {
        method: 'manual',
        images: [], // Danh sách ảnh hóa đơn: [{ id, name, sizeStr, base64 }]
        cameraStream: null,
        invoiceImageUrl: ''
    },

    resetSmartImportForm() {
        // Reset state
        this.importState.images = [];
        this.importState.invoiceImageUrl = '';

        // Reset ảnh preview & file input
        this.removeAllInvoiceImages();
        const fileInput = document.getElementById('invoice-file-input');
        if (fileInput) fileInput.value = '';
        const folderInput = document.getElementById('invoice-folder-input');
        if (folderInput) folderInput.value = '';

        // Reset các trường thông tin phiếu
        const textInputs = [
            'manual-import-supplier', 'manual-import-invoice-no', 'manual-import-note',
            'review-supplier-input', 'review-invoice-no-input'
        ];
        textInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Xóa hoàn toàn các hàng dữ liệu cũ trong bảng kết quả review
        const reviewTbody = document.getElementById('review-items-tbody');
        if (reviewTbody) {
            reviewTbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-400 text-xs"><div class="flex flex-col items-center justify-center gap-2"><i class="fas fa-file-invoice text-3xl text-slate-600"></i><span>Chưa có dữ liệu. Vui lòng tải ảnh hóa đơn / viết tay hoặc bấm <b>"+ Bổ sung dòng"</b> để nhập.</span></div></td></tr>`;
        }

        // Ẩn badge AI
        const badge = document.getElementById('review-ai-badge');
        if (badge) badge.classList.add('hidden');

        // Reset bảng nhập thủ công về 1 dòng trống
        const manualTbody = document.getElementById('manual-import-tbody');
        if (manualTbody) {
            manualTbody.innerHTML = '';
            this.addManualImportRow();
        }

        // Reset bộ đếm số lượng & tổng chi phí
        const countEl = document.getElementById('import-footer-item-count');
        const costEl = document.getElementById('import-footer-total-cost');
        if (countEl) countEl.innerText = '0';
        if (costEl) costEl.innerText = '0 đ';
    },

    openSmartImportModal(initialMethod = 'manual') {
        const modal = document.getElementById('modal-smart-import');
        if (!modal) return;
        modal.classList.add('open');

        // Reset toàn bộ form và dữ liệu nhập kho cũ
        this.resetSmartImportForm();

        // Initialize drag & drop once
        this.initInvoiceDropzone();

        const keyInput = document.getElementById('import-gemini-api-key');
        if (keyInput && !keyInput.value) {
            keyInput.value = localStorage.getItem('pos_gemini_api_key') || '';
        }

        // Switch to chosen method
        this.switchImportMethod(initialMethod);
    },

    closeSmartImportModal() {
        this.stopCamera();
        const modal = document.getElementById('modal-smart-import');
        if (modal) modal.classList.remove('open');
    },

    switchImportMethod(method) {
        this.importState.method = method;

        // Stop camera if leaving camera tab
        if (method !== 'camera') {
            this.stopCamera();
        }

        // Update tab buttons
        const tabs = ['manual', 'upload', 'camera'];
        tabs.forEach(t => {
            const btn = document.getElementById(`tab-btn-import-${t}`);
            const pane = document.getElementById(`import-pane-${t}`);
            if (t === method) {
                if (btn) {
                    btn.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/40', 'shadow-sm');
                    btn.classList.remove('text-slate-400', 'border-transparent');
                }
                if (pane) pane.classList.remove('hidden');
            } else {
                if (btn) {
                    btn.classList.remove('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/40', 'shadow-sm');
                    btn.classList.add('text-slate-400', 'border-transparent');
                }
                if (pane) pane.classList.add('hidden');
            }
        });

        // If manual tab: ensure at least 1 row exists
        if (method === 'manual') {
            const tbody = document.getElementById('manual-import-tbody');
            if (tbody && tbody.children.length === 0) {
                this.addManualImportRow();
            }
            this.calcManualImportTotal();
        } else {
            this.calcReviewTotals();
        }
    },

    // --- Phương thức 1: Nhập thủ công ---
    addManualImportRow() {
        const tbody = document.getElementById('manual-import-tbody');
        if (!tbody) return;

        const optionsHtml = this.materialsList.map(m => 
            `<option value="${m.id}" data-name="${m.name}" data-code="${m.code}" data-unit="${m.unit}" data-price="${m.cost_price}" data-sup="${m.supplier || ''}">${m.code} - ${m.name}</option>`
        ).join('');

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition-colors border-b border-white/5';
        tr.innerHTML = `
            <td class="py-2 px-3">
                <select class="liquid-input py-1 text-xs w-full manual-row-mat" onchange="Admin.onManualRowMatChange(this)">
                    ${optionsHtml}
                </select>
            </td>
            <td class="py-2 px-3">
                <input type="number" step="0.1" value="1" placeholder="Số lượng" class="liquid-input py-1 text-xs w-full font-mono font-bold text-sky-400 manual-row-qty" oninput="Admin.calcManualImportTotal()" />
            </td>
            <td class="py-2 px-3">
                <span class="manual-row-unit text-slate-300 font-bold text-xs">${this.materialsList[0]?.unit || 'kg'}</span>
            </td>
            <td class="py-2 px-3">
                <input type="number" step="1000" value="${this.materialsList[0]?.cost_price || 0}" placeholder="Đơn giá" class="liquid-input py-1 text-xs w-full font-mono text-emerald-400 manual-row-price" oninput="Admin.calcManualImportTotal()" />
            </td>
            <td class="py-2 px-3 text-right">
                <span class="manual-row-total text-emerald-300 font-mono font-bold text-xs">0 đ</span>
            </td>
            <td class="py-2 px-2 text-center">
                <button type="button" onclick="Admin.removeManualImportRow(this)" class="p-1 text-rose-400 hover:text-rose-300 text-xs" title="Xóa dòng">
                    <i class="fas fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);

        const sel = tr.querySelector('.manual-row-mat');
        if (sel) this.onManualRowMatChange(sel);
    },

    onManualRowMatChange(selectElem) {
        const opt = selectElem.selectedOptions[0];
        if (!opt) return;
        const tr = selectElem.closest('tr');
        if (!tr) return;

        const unit = opt.dataset.unit || 'kg';
        const price = parseFloat(opt.dataset.price || 0);

        const unitElem = tr.querySelector('.manual-row-unit');
        if (unitElem) unitElem.innerText = unit;

        const priceInput = tr.querySelector('.manual-row-price');
        if (priceInput && (!priceInput.value || parseFloat(priceInput.value) <= 0)) {
            priceInput.value = price;
        }

        this.calcManualImportTotal();
    },

    removeManualImportRow(btn) {
        const tr = btn.closest('tr');
        if (tr) tr.remove();
        this.calcManualImportTotal();
    },

    calcManualImportTotal() {
        if (this.importState.method !== 'manual') return;

        const tbody = document.getElementById('manual-import-tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        let totalCost = 0;
        let count = 0;

        rows.forEach(tr => {
            const qty = parseFloat(tr.querySelector('.manual-row-qty')?.value || 0);
            const price = parseFloat(tr.querySelector('.manual-row-price')?.value || 0);
            const lineTotal = Math.round(qty * price);
            totalCost += lineTotal;
            if (qty > 0) count++;

            const totalSpan = tr.querySelector('.manual-row-total');
            if (totalSpan) totalSpan.innerText = this.formatMoney(lineTotal) + ' đ';
        });

        const countElem = document.getElementById('import-footer-item-count');
        const costElem = document.getElementById('import-footer-total-cost');
        if (countElem) countElem.innerText = count;
        if (costElem) costElem.innerText = this.formatMoney(totalCost) + ' đ';
    },

    // --- Phương thức 2: Tải lên hóa đơn & Drag and Drop ---
    initInvoiceDropzone() {
        const dropzone = document.getElementById('invoice-dropzone');
        if (!dropzone || dropzone.dataset.initialized) return;
        dropzone.dataset.initialized = 'true';

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('border-emerald-400', 'bg-emerald-500/10');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('border-emerald-400', 'bg-emerald-500/10');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                this.handleSelectedInvoiceFile(files[0]);
            }
        });
    },

    // Chọn một hoặc nhiều ảnh hóa đơn
    onInvoiceFilesSelected(e) {
        const files = e.target.files;
        if (files && files.length > 0) {
            this.handleMultipleInvoiceFiles(Array.from(files));
        }
        e.target.value = '';
    },

    handleMultipleInvoiceFiles(fileList) {
        // Lọc file hình ảnh
        const imageFiles = fileList.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name));
        if (imageFiles.length === 0) {
            alert('Không tìm thấy file hình ảnh (JPG, PNG, WEBP) nào!');
            return;
        }

        let loadedCount = 0;
        imageFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const base64 = ev.target.result;
                this.importState.images.push({
                    id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    name: file.name,
                    sizeStr: (file.size / 1024).toFixed(1) + ' KB',
                    base64: base64
                });
                loadedCount++;
                if (loadedCount === imageFiles.length) {
                    this.renderImageGallery();
                }
            };
            reader.readAsDataURL(file);
        });
    },

    // Hiển thị danh sách Medium Icon Gallery (Cố định 85x85px, có nút Xóa từng ảnh & Xóa hết)
    renderImageGallery() {
        const galleryPanel = document.getElementById('import-image-gallery-panel');
        const dropzone = document.getElementById('invoice-dropzone');
        const container = document.getElementById('gallery-items-container');
        const countBadge = document.getElementById('gallery-count-badge');
        const scanLabel = document.getElementById('btn-ai-scan-label');

        const total = this.importState.images.length;
        if (total === 0) {
            if (galleryPanel) galleryPanel.classList.add('hidden');
            if (dropzone) dropzone.classList.remove('hidden');
            return;
        }

        if (dropzone) dropzone.classList.add('hidden');
        if (galleryPanel) galleryPanel.classList.remove('hidden');

        if (countBadge) countBadge.innerText = `${total} ảnh`;
        if (scanLabel) scanLabel.innerText = total > 1 ? `PHÂN TÍCH ${total} ẢNH BẰNG AI` : `PHÂN TÍCH BẰNG AI`;

        if (container) {
            container.innerHTML = this.importState.images.map((img, idx) => `
                <div class="relative group shrink-0 flex flex-col items-center bg-slate-950/70 p-1.5 rounded-xl border border-white/10 hover:border-purple-400/60 transition-all w-[96px] shadow-md">
                    <!-- Nút xóa ảnh góc trên [×] màu đỏ rõ ràng -->
                    <button type="button" onclick="Admin.removeInvoiceImage(${idx})" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center text-xs font-black shadow-lg z-10 transition-transform hover:scale-110" title="Xóa bỏ ảnh này">
                        &times;
                    </button>
                    <!-- Ảnh Medium Icon: 85x85px cố định chuẩn mực -->
                    <img src="${img.base64}" style="width: 85px; height: 85px; min-width: 85px; min-height: 85px; object-fit: cover;" class="rounded-lg border border-white/10 bg-slate-900 shadow-sm" alt="${img.name}" />
                    <!-- Tên file & nút xoay trên 1 dòng -->
                    <div class="w-full mt-1 flex items-center justify-between gap-1 text-[10px]">
                        <span class="truncate text-slate-300 font-medium" title="${img.name}">${img.name}</span>
                        <button type="button" onclick="Admin.rotateInvoiceImage(${idx})" class="text-sky-400 hover:text-sky-300 p-0.5" title="Xoay 90°">
                            <i class="fas fa-rotate-right text-[10px]"></i>
                        </button>
                    </div>
                    <span class="text-[9px] text-slate-500 truncate w-full">${img.sizeStr}</span>
                </div>
            `).join('');
        }
    },

    // Xóa từng ảnh khỏi danh sách
    removeInvoiceImage(idx) {
        if (idx >= 0 && idx < this.importState.images.length) {
            this.importState.images.splice(idx, 1);
            this.renderImageGallery();
        }
    },

    // Xóa tất cả ảnh
    removeAllInvoiceImages() {
        this.importState.images = [];
        this.renderImageGallery();
    },

    // Xoay 90 độ ảnh thứ idx
    rotateInvoiceImage(idx) {
        const item = this.importState.images[idx];
        if (!item) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.height;
            canvas.height = img.width;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((90 * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            item.base64 = canvas.toDataURL('image/jpeg', 0.92);
            this.renderImageGallery();
        };
        img.src = item.base64;
    },

    loadSampleInvoiceDemo() {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 700;
        const ctx = canvas.getContext('2d');

        // Vẽ mẫu hóa đơn
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, 600, 700);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ĐẠI LÝ NGUYÊN LIỆU CÀ PHÊ BUÔN MA THUỘT', 300, 45);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#475569';
        ctx.fillText('Đ/c: 45 Lê Duẩn, TP. Buôn Ma Thuột - ĐT: 0918.608.073', 300, 75);
        ctx.fillText('PHIẾU XUẤT KHO / HÓA ĐƠN MUA HÀNG', 300, 105);

        ctx.textAlign = 'left';
        ctx.fillText('Ngày: ' + new Date().toLocaleDateString('vi-VN'), 40, 140);
        ctx.fillText('Khách hàng: GÓC PHỐ COFFEE & TEA', 40, 165);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(40, 180); ctx.lineTo(560, 180); ctx.stroke();

        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = '#0f172a';
        ctx.fillText('Tên Mặt Hàng', 45, 205);
        ctx.fillText('SL', 290, 205);
        ctx.fillText('ĐVT', 345, 205);
        ctx.fillText('Đơn Giá', 415, 205);
        ctx.fillText('T.Tiền', 495, 205);

        ctx.beginPath();
        ctx.moveTo(40, 218); ctx.lineTo(560, 218); ctx.stroke();

        const items = [
            ['1. Cà phê hạt Robusta Đắk Lắk', '20', 'kg', '140.000', '2.800.000'],
            ['2. Sữa đặc Ngôi Sao Phương Nam', '24', 'hộp', '22.000', '528.000'],
            ['3. Sữa tươi thanh trùng TH', '12', 'lít', '32.000', '384.000'],
            ['4. Trà Oolong nướng Đài Loan', '5', 'gói', '85.000', '425.000'],
            ['5. Đường phèn hạt Quảng Ngãi', '10', 'kg', '28.000', '280.000']
        ];

        ctx.font = '13px Arial';
        let y = 245;
        items.forEach(it => {
            ctx.fillText(it[0], 45, y);
            ctx.fillText(it[1], 295, y);
            ctx.fillText(it[2], 345, y);
            ctx.fillText(it[3], 410, y);
            ctx.fillText(it[4], 490, y);
            y += 32;
        });

        ctx.beginPath();
        ctx.moveTo(40, y); ctx.lineTo(560, y); ctx.stroke();

        ctx.font = 'bold 15px Arial';
        ctx.fillText('TỔNG CỘNG TIỀN THANH TOÁN:', 160, y + 35);
        ctx.fillText('4.417.000 VNĐ', 430, y + 35);

        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        this.importState.images.push({
            id: 'sample_' + Date.now(),
            name: 'sample_invoice_coffee_supply.jpg',
            sizeStr: '85.4 KB',
            base64: base64,
            isSampleDemo: true
        });
        this.renderImageGallery();
    },

    // --- Phương thức 3: Chụp ảnh qua Camera / Webcam ---
    async startCamera() {
        try {
            const video = document.getElementById('camera-stream-video');
            const placeholder = document.getElementById('camera-placeholder');
            const guide = document.getElementById('camera-guide-overlay');
            const btnStart = document.getElementById('btn-start-camera');
            const btnSnap = document.getElementById('btn-snap-camera');
            const btnStop = document.getElementById('btn-stop-camera');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            this.importState.cameraStream = stream;

            if (video) {
                video.srcObject = stream;
                video.classList.remove('hidden');
            }
            if (placeholder) placeholder.classList.add('hidden');
            if (guide) guide.classList.remove('hidden');

            if (btnStart) btnStart.classList.add('hidden');
            if (btnSnap) btnSnap.classList.remove('hidden');
            if (btnStop) btnStop.classList.remove('hidden');
        } catch (err) {
            console.error('Camera error:', err);
            alert('Không thể mở camera. Vui lòng kiểm tra quyền truy cập webcam trong trình duyệt: ' + err.message);
        }
    },

    takeCameraSnapshot() {
        const video = document.getElementById('camera-stream-video');
        if (!video || !this.importState.cameraStream) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        this.importState.currentImageBase64 = base64;
        this.importState.imageFileName = 'camera_capture_' + Date.now() + '.jpg';
        this.importState.isSampleDemo = false;

        this.stopCamera();

        const previewPanel = document.getElementById('import-image-preview-panel');
        const previewImg = document.getElementById('import-preview-img');
        const previewName = document.getElementById('import-preview-name');
        const previewMeta = document.getElementById('import-preview-meta');

        if (previewImg) previewImg.src = base64;
        if (previewName) previewName.innerText = this.importState.imageFileName;
        if (previewMeta) previewMeta.innerText = 'Ảnh chụp camera • Sẵn sàng quét AI';
        if (previewPanel) previewPanel.classList.remove('hidden');
    },

    stopCamera() {
        if (this.importState.cameraStream) {
            this.importState.cameraStream.getTracks().forEach(t => t.stop());
            this.importState.cameraStream = null;
        }
        const video = document.getElementById('camera-stream-video');
        const placeholder = document.getElementById('camera-placeholder');
        const guide = document.getElementById('camera-guide-overlay');
        const btnStart = document.getElementById('btn-start-camera');
        const btnSnap = document.getElementById('btn-snap-camera');
        const btnStop = document.getElementById('btn-stop-camera');

        if (video) video.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
        if (guide) guide.classList.add('hidden');

        if (btnStart) btnStart.classList.remove('hidden');
        if (btnSnap) btnSnap.classList.add('hidden');
        if (btnStop) btnStop.classList.add('hidden');
    },

    // --- KÍCH HOẠT PHÂN TÍCH AI & OCR (HỖ TRỢ NHIỀU ẢNH / FOLDER) ---
    async runAiInvoiceScan() {
        const total = this.importState.images.length;
        if (total === 0) {
            alert('Vui lòng chọn hoặc kéo thả ít nhất 1 ảnh hóa đơn / giấy viết tay!');
            return;
        }

        const statusBox = document.getElementById('import-ai-scanning-status');
        const statusText = document.getElementById('ai-scan-status-text');
        const btnScan = document.getElementById('btn-trigger-ai-scan');
        const keyInput = document.getElementById('import-gemini-api-key');
        const apiKey = keyInput?.value.trim() || localStorage.getItem('pos_gemini_api_key') || '';
        if (apiKey) {
            localStorage.setItem('pos_gemini_api_key', apiKey);
        }

        if (statusBox) statusBox.classList.remove('hidden');
        if (btnScan) btnScan.disabled = true;

        let allExtractedItems = [];
        let detectedSupplier = '';
        let detectedInvoiceNo = '';
        let lastEngine = 'Google Gemini 3.5 Flash (AI)';
        let successCount = 0;

        try {
            for (let i = 0; i < total; i++) {
                const imgItem = this.importState.images[i];
                if (statusText) {
                    statusText.innerText = total > 1 
                        ? `AI đang phân tích hóa đơn (${i + 1}/${total}): ${imgItem.name}...` 
                        : 'Trí tuệ nhân tạo đang phân tích hình ảnh và bóc tách dữ liệu...';
                }

                const res = await fetch('api/operations.php?action=ai_parse_invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_base64: imgItem.base64,
                        gemini_api_key: apiKey,
                        is_sample_demo: !!imgItem.isSampleDemo
                    })
                });

                const data = await res.json();
                if (data.success) {
                    successCount++;
                    if (data.items && data.items.length > 0) {
                        allExtractedItems = allExtractedItems.concat(data.items);
                    }
                    if (!detectedSupplier && data.supplier) detectedSupplier = data.supplier;
                    if (!detectedInvoiceNo && data.invoice_no) detectedInvoiceNo = data.invoice_no;
                    if (data.ai_engine) lastEngine = data.ai_engine;
                    if (!this.importState.invoiceImageUrl && data.invoice_image_url) {
                        this.importState.invoiceImageUrl = data.invoice_image_url;
                    }
                } else {
                    console.warn(`Lỗi bóc tách ảnh ${imgItem.name}:`, data.message);
                }
            }

            if (successCount === 0) {
                alert('Không thể phân tích được ảnh nào bằng AI. Vui lòng kiểm tra lại ảnh hoặc nhập thủ công.');
                return;
            }

            const supInput = document.getElementById('review-supplier-input');
            const noInput = document.getElementById('review-invoice-no-input');
            if (supInput && detectedSupplier) supInput.value = detectedSupplier;
            if (noInput && detectedInvoiceNo) noInput.value = detectedInvoiceNo;

            const badge = document.getElementById('review-ai-badge');
            if (badge) {
                badge.innerText = `${lastEngine} • ${total} hóa đơn`;
                badge.classList.remove('hidden');
            }

            this.renderReviewRows(allExtractedItems);
            document.getElementById('import-review-section')?.scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            console.error('runAiInvoiceScan error:', err);
            alert('Lỗi kết nối khi quét AI: ' + err.message);
        } finally {
            if (statusBox) statusBox.classList.add('hidden');
            if (btnScan) btnScan.disabled = false;
        }
    },

    renderReviewRows(items) {
        const tbody = document.getElementById('review-items-tbody');
        if (!tbody) return;

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">Không trích xuất được mặt hàng nào. Vui lòng bấm "+ Bổ sung dòng" để nhập bổ sung.</td></tr>`;
            this.calcReviewTotals();
            return;
        }

        tbody.innerHTML = items.map((it, idx) => {
            const isNew = !!it.is_new;
            const matOptions = this.materialsList.map(m => 
                `<option value="${m.id}" data-unit="${m.unit}" ${(!isNew && it.material_id == m.id) ? 'selected' : ''}>${m.code} - ${m.name}</option>`
            ).join('');

            const selectOptions = `
                <option value="__NEW__" ${isNew ? 'selected' : ''} class="text-amber-300 font-bold">✨ [Tạo Mới Kho] ${it.raw_name}</option>
                ${matOptions}
            `;

            return `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5 review-row" data-is-new="${isNew ? '1' : '0'}" data-raw-name="${it.raw_name}">
                    <td class="py-3 px-3 min-w-[320px]">
                        <select class="liquid-input py-1.5 px-2.5 text-xs w-full review-mat-select font-semibold ${isNew ? 'text-amber-300' : 'text-sky-300'}" onchange="Admin.onReviewMatChanged(this)">
                            ${selectOptions}
                        </select>
                        <div class="mt-1.5 flex items-center gap-1.5">
                            ${isNew 
                                ? '<span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold whitespace-nowrap"><i class="fas fa-sparkles text-[9px] mr-1"></i>Mặt hàng mới</span>' 
                                : '<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold whitespace-nowrap"><i class="fas fa-check text-[9px] mr-1"></i>Đã khớp mã kho: <b>' + (it.material_code || '') + '</b></span>'}
                        </div>
                    </td>
                    <td class="py-3 px-3 min-w-[200px]">
                        <input type="text" value="${it.raw_name || ''}" placeholder="Tên trên HĐ" class="liquid-input py-1.5 px-2.5 text-xs w-full text-slate-200 font-medium review-raw-name" />
                    </td>
                    <td class="py-3 px-2 min-w-[110px]">
                        <input type="number" step="any" min="0" value="${it.quantity || 1}" class="liquid-input py-1.5 px-2 text-sm w-full font-mono font-bold text-sky-400 text-center review-qty" oninput="Admin.onReviewQtyChanged(this)" />
                    </td>
                    <td class="py-3 px-2 min-w-[80px]">
                        <input type="text" value="${it.unit || 'kg'}" class="liquid-input py-1.5 px-2 text-xs w-full font-bold text-slate-200 text-center review-unit" />
                    </td>
                    <td class="py-3 px-2 min-w-[150px]">
                        <input type="number" step="any" min="0" value="${Math.round(it.unit_price || 0)}" class="liquid-input py-1.5 px-2.5 text-xs w-full font-mono font-bold text-emerald-400 text-right review-price" oninput="Admin.onReviewPriceChanged(this)" title="Đơn giá mua" />
                    </td>
                    <td class="py-3 px-2 min-w-[170px]">
                        <input type="number" step="any" min="0" value="${Math.round(it.total_cost || 0)}" class="liquid-input py-1.5 px-2.5 text-xs w-full font-mono font-black text-emerald-300 text-right review-line-total-input" oninput="Admin.onReviewTotalChanged(this)" title="Nhập thành tiền → Tự động tính đơn giá = Thành tiền ÷ Số lượng" />
                    </td>
                    <td class="py-3 px-2 text-center w-[48px]">
                        <button type="button" onclick="Admin.removeReviewRow(this)" class="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg text-xs transition-colors" title="Xóa dòng này">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        this.calcReviewTotals();
    },

    addReviewRow() {
        const tbody = document.getElementById('review-items-tbody');
        if (!tbody) return;

        // Xóa placeholder nếu bảng đang rỗng
        if (tbody.querySelector('td[colspan]')) {
            tbody.innerHTML = '';
        }

        const optionsHtml = this.materialsList.map(m => 
            `<option value="${m.id}" data-unit="${m.unit}">${m.code} - ${m.name}</option>`
        ).join('');

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition-colors border-b border-white/5 review-row';
        tr.dataset.isNew = '0';
        tr.innerHTML = `
            <td class="py-3 px-3 min-w-[320px]">
                <select class="liquid-input py-1.5 px-2.5 text-xs w-full review-mat-select font-semibold text-sky-300" onchange="Admin.onReviewMatChanged(this)">
                    <option value="__NEW__" class="text-amber-300 font-bold">✨ [Tạo Mới Kho]</option>
                    ${optionsHtml}
                </select>
                <div class="mt-1.5 flex items-center gap-1.5">
                    <span class="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold whitespace-nowrap"><i class="fas fa-hand-pointer text-[9px] mr-1"></i>Thủ công</span>
                </div>
            </td>
            <td class="py-3 px-3 min-w-[200px]">
                <input type="text" placeholder="Tên hàng ghi trên HĐ" class="liquid-input py-1.5 px-2.5 text-xs w-full text-slate-200 font-medium review-raw-name" />
            </td>
            <td class="py-3 px-2 min-w-[110px]">
                <input type="number" step="any" min="0" value="1" class="liquid-input py-1.5 px-2 text-sm w-full font-mono font-bold text-sky-400 text-center review-qty" oninput="Admin.onReviewQtyChanged(this)" />
            </td>
            <td class="py-3 px-2 min-w-[80px]">
                <input type="text" value="${this.materialsList[0]?.unit || 'kg'}" class="liquid-input py-1.5 px-2 text-xs w-full font-bold text-slate-200 text-center review-unit" />
            </td>
            <td class="py-3 px-2 min-w-[150px]">
                <input type="number" step="any" min="0" value="${Math.round(this.materialsList[0]?.cost_price || 0)}" class="liquid-input py-1.5 px-2.5 text-xs w-full font-mono font-bold text-emerald-400 text-right review-price" oninput="Admin.onReviewPriceChanged(this)" title="Đơn giá mua" />
            </td>
            <td class="py-3 px-2 min-w-[170px]">
                <input type="number" step="any" min="0" value="${Math.round(this.materialsList[0]?.cost_price || 0)}" class="liquid-input py-1.5 px-2.5 text-xs w-full font-mono font-black text-emerald-300 text-right review-line-total-input" oninput="Admin.onReviewTotalChanged(this)" title="Nhập thành tiền → Tự tính đơn giá = Thành tiền ÷ Số lượng" />
            </td>
            <td class="py-3 px-2 text-center w-[48px]">
                <button type="button" onclick="Admin.removeReviewRow(this)" class="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg text-xs transition-colors" title="Xóa dòng này">
                    <i class="fas fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
        this.calcReviewTotals();
    },

    onReviewMatChanged(selectElem) {
        const tr = selectElem.closest('tr');
        if (!tr) return;
        const val = selectElem.value;
        const isNew = (val === '__NEW__');
        tr.dataset.isNew = isNew ? '1' : '0';

        if (isNew) {
            selectElem.className = 'liquid-input py-1 text-xs w-full review-mat-select font-semibold text-amber-300';
        } else {
            selectElem.className = 'liquid-input py-1 text-xs w-full review-mat-select font-semibold text-sky-300';
            const opt = selectElem.selectedOptions[0];
            const unit = opt?.dataset.unit;
            if (unit) {
                const unitInput = tr.querySelector('.review-unit');
                if (unitInput) unitInput.value = unit;
            }
        }
        this.calcReviewTotals();
    },

    // Đổi số lượng: nếu đã có Thành tiền → Đơn giá = Thành tiền ÷ Số lượng; ngược lại Thành tiền = SL × Đơn giá
    onReviewQtyChanged(input) {
        const tr = input.closest('tr');
        if (!tr) return;
        const qty = parseFloat(input.value || 0);
        const priceInput = tr.querySelector('.review-price');
        const totalInput = tr.querySelector('.review-line-total-input');
        const total = parseFloat(totalInput?.value || 0);
        if (qty > 0 && total > 0) {
            if (priceInput) priceInput.value = Math.round(total / qty);
        } else if (totalInput) {
            totalInput.value = Math.round(qty * parseFloat(priceInput?.value || 0));
        }
        this.calcReviewTotals();
    },

    // Đổi đơn giá: Thành tiền = SL × Đơn giá
    onReviewPriceChanged(input) {
        const tr = input.closest('tr');
        if (!tr) return;
        const qty = parseFloat(tr.querySelector('.review-qty')?.value || 0);
        const totalInput = tr.querySelector('.review-line-total-input');
        if (totalInput) totalInput.value = Math.round(qty * parseFloat(input.value || 0));
        this.calcReviewTotals();
    },

    // Đổi thành tiền: Đơn giá = Thành tiền ÷ Số lượng
    onReviewTotalChanged(input) {
        const tr = input.closest('tr');
        if (!tr) return;
        const qty = parseFloat(tr.querySelector('.review-qty')?.value || 0);
        const priceInput = tr.querySelector('.review-price');
        const total = parseFloat(input.value || 0);
        if (qty > 0 && priceInput) priceInput.value = Math.round(total / qty);
        this.calcReviewTotals();
    },

    removeReviewRow(btn) {
        const tr = btn.closest('tr');
        if (tr) tr.remove();
        this.calcReviewTotals();
    },

    calcReviewTotals() {
        if (this.importState.method === 'manual') return;

        const rows = document.querySelectorAll('#review-items-tbody tr.review-row');
        let totalCost = 0;
        let count = 0;

        rows.forEach(tr => {
            const qty = parseFloat(tr.querySelector('.review-qty')?.value || 0);
            const price = parseFloat(tr.querySelector('.review-price')?.value || 0);
            const totalInput = tr.querySelector('.review-line-total-input');
            // Ưu tiên thành tiền ghi trên hóa đơn (nếu có), nếu không thì = SL × Đơn giá
            let lineTotal = totalInput ? parseFloat(totalInput.value || 0) : Math.round(qty * price);
            if (!(lineTotal > 0)) lineTotal = Math.round(qty * price);
            totalCost += lineTotal;
            if (qty > 0) count++;

            const totalSpan = tr.querySelector('.review-line-total');
            if (totalSpan) totalSpan.innerText = this.formatMoney(lineTotal) + ' đ';
        });

        const countElem = document.getElementById('import-footer-item-count');
        const costElem = document.getElementById('import-footer-total-cost');
        if (countElem) countElem.innerText = count;
        if (costElem) costElem.innerText = this.formatMoney(totalCost) + ' đ';
    },

    // --- XÁC NHẬN NHẬP KHO HÀNG LOẠT ---
    async commitSmartImport() {
        const method = this.importState.method;
        let supplier = '';
        let invoiceNo = '';
        let note = '';
        let items = [];

        if (method === 'manual') {
            supplier = document.getElementById('manual-import-supplier')?.value.trim() || '';
            invoiceNo = document.getElementById('manual-import-invoice-no')?.value.trim() || '';
            note = document.getElementById('manual-import-note')?.value.trim() || 'Nhập kho thủ công';

            const rows = document.querySelectorAll('#manual-import-tbody tr');
            rows.forEach(tr => {
                const sel = tr.querySelector('.manual-row-mat');
                const matId = parseInt(sel?.value || 0);
                const opt = sel?.selectedOptions[0];
                const name = opt?.dataset.name || '';
                const code = opt?.dataset.code || '';
                const qty = parseFloat(tr.querySelector('.manual-row-qty')?.value || 0);
                const unit = tr.querySelector('.manual-row-unit')?.innerText || 'kg';
                const price = parseFloat(tr.querySelector('.manual-row-price')?.value || 0);

                if (matId > 0 && qty > 0) {
                    items.push({
                        material_id: matId,
                        is_new: false,
                        name: name,
                        code: code,
                        unit: unit,
                        quantity: qty,
                        unit_price: price
                    });
                }
            });
        } else {
            supplier = document.getElementById('review-supplier-input')?.value.trim() || '';
            invoiceNo = document.getElementById('review-invoice-no-input')?.value.trim() || '';
            note = 'Nhập kho bằng AI OCR chứng từ';

            const rows = document.querySelectorAll('#review-items-tbody tr.review-row');
            rows.forEach(tr => {
                const sel = tr.querySelector('.review-mat-select');
                const val = sel?.value;
                const isNew = (val === '__NEW__');
                const rawName = tr.querySelector('.review-raw-name')?.value.trim() || '';
                const qty = parseFloat(tr.querySelector('.review-qty')?.value || 0);
                const unit = tr.querySelector('.review-unit')?.value.trim() || 'kg';
                const lineTotalVal = parseFloat(tr.querySelector('.review-line-total-input')?.value || 0);
                // Đơn giá chính xác (không làm tròn) = Thành tiền ÷ Số lượng để tổng tiền khớp 100% hóa đơn
                const price = (qty > 0 && lineTotalVal > 0) ? (lineTotalVal / qty) : parseFloat(tr.querySelector('.review-price')?.value || 0);

                if (qty > 0 && (rawName || !isNew)) {
                    if (isNew) {
                        items.push({
                            material_id: null,
                            is_new: true,
                            name: rawName,
                            category: 'Nguyên liệu',
                            unit: unit,
                            quantity: qty,
                            unit_price: price
                        });
                    } else {
                        const matId = parseInt(val);
                        const mat = this.materialsList.find(m => m.id == matId);
                        items.push({
                            material_id: matId,
                            is_new: false,
                            name: mat ? mat.name : rawName,
                            code: mat ? mat.code : '',
                            unit: unit,
                            quantity: qty,
                            unit_price: price
                        });
                    }
                }
            });
        }

        if (items.length === 0) {
            alert('Không có mặt hàng hợp lệ để nhập kho! Vui lòng kiểm tra lại số lượng (> 0).');
            return;
        }

        const confirmMsg = `Xác nhận nhập ${items.length} mặt hàng vào kho với tổng chi phí ${document.getElementById('import-footer-total-cost')?.innerText || ''}?`;
        if (!confirm(confirmMsg)) return;

        const btnSubmit = document.getElementById('btn-submit-smart-import');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
        }

        try {
            const res = await fetch('api/operations.php?action=batch_import_materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supplier: supplier,
                    invoice_no: invoiceNo,
                    invoice_image: this.importState.invoiceImageUrl,
                    note: note,
                    items: items
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.resetSmartImportForm();
                this.closeSmartImportModal();
                this.loadMaterials();
            } else {
                alert(data.message || 'Lỗi khi nhập kho!');
            }
        } catch (err) {
            console.error('commitSmartImport error:', err);
            alert('Lỗi kết nối khi nhập kho: ' + err.message);
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="fas fa-check-double"></i> <span>XÁC NHẬN NHẬP KHO & LƯU CHI PHÍ</span>';
            }
        }
    },

    // 8.3 Stock Transactions (Nhập kho / Xuất kho / Chi phí)
    openStockTransactionModal(type = 'import', matId = null) {
        const transTypeInput = document.getElementById('modal-trans-type');
        if (transTypeInput) transTypeInput.value = type;

        const title = document.getElementById('modal-stock-trans-title');
        const actionLabel = document.getElementById('modal-trans-action-label');
        const priceContainer = document.getElementById('modal-trans-price-container');
        const totalBox = document.getElementById('modal-trans-total-box');
        const submitBtn = document.getElementById('btn-submit-stock-trans');

        if (type === 'import') {
            if (title) title.innerHTML = '<i class="fas fa-file-invoice-dollar text-emerald-400"></i> Lập Phiếu Nhập Kho (Chi Phí Mua Hàng)';
            if (actionLabel) actionLabel.innerText = 'nhập';
            if (priceContainer) priceContainer.classList.remove('hidden');
            if (totalBox) totalBox.classList.remove('hidden');
            if (submitBtn) submitBtn.className = 'btn-glass-success text-xs py-2 px-5 font-bold flex items-center gap-1.5';
        } else {
            if (title) title.innerHTML = '<i class="fas fa-dolly text-rose-400"></i> Lập Phiếu Xuất Kho Sử Dụng';
            if (actionLabel) actionLabel.innerText = 'xuất';
            if (priceContainer) priceContainer.classList.add('hidden');
            if (totalBox) totalBox.classList.add('hidden');
            if (submitBtn) submitBtn.className = 'btn-glass-danger text-xs py-2 px-5 font-bold flex items-center gap-1.5';
        }

        // Populate materials select
        const sel = document.getElementById('modal-trans-mat-id');
        if (sel) {
            sel.innerHTML = this.materialsList.map(m => 
                `<option value="${m.id}" data-unit="${m.unit}" data-stock="${m.quantity}" data-price="${m.cost_price}" data-sup="${m.supplier || ''}" ${matId == m.id ? 'selected' : ''}>${m.code} - ${m.name} (Tồn: ${m.quantity} ${m.unit})</option>`
            ).join('');
        }

        document.getElementById('modal-trans-qty').value = '';
        document.getElementById('modal-trans-note').value = '';
        this.onStockMatSelected();

        document.getElementById('modal-stock-trans').classList.add('open');
    },

    onStockMatSelected() {
        const sel = document.getElementById('modal-trans-mat-id');
        const opt = sel?.selectedOptions[0];
        if (!opt) return;

        const unit = opt.dataset.unit || 'kg';
        const stock = opt.dataset.stock || '0';
        const price = opt.dataset.price || '0';
        const sup = opt.dataset.sup || '';

        const stockEl = document.getElementById('modal-trans-current-stock');
        const unitEl = document.getElementById('modal-trans-unit-label');
        const priceEl = document.getElementById('modal-trans-price');
        const supEl = document.getElementById('modal-trans-supplier');

        if (stockEl) stockEl.innerText = `${stock} ${unit}`;
        if (unitEl) unitEl.innerText = unit;
        if (priceEl && !priceEl.value) priceEl.value = price;
        if (supEl && !supEl.value) supEl.value = sup;

        this.calcTransTotal();
    },

    calcTransTotal() {
        const qty = parseFloat(document.getElementById('modal-trans-qty')?.value) || 0;
        const price = parseFloat(document.getElementById('modal-trans-price')?.value) || 0;
        const total = Math.round(qty * price);
        const totalEl = document.getElementById('modal-trans-total-cost');
        if (totalEl) totalEl.innerText = this.formatMoney(total);
    },

    closeStockTransactionModal() {
        document.getElementById('modal-stock-trans').classList.remove('open');
    },

    async submitStockTransaction(e) {
        e.preventDefault();
        const matId = parseInt(document.getElementById('modal-trans-mat-id').value);
        const type = document.getElementById('modal-trans-type').value;
        const qty = parseFloat(document.getElementById('modal-trans-qty').value);
        const price = parseFloat(document.getElementById('modal-trans-price').value) || 0;
        const sup = document.getElementById('modal-trans-supplier').value.trim();
        const note = document.getElementById('modal-trans-note').value.trim();

        if (isNaN(qty) || qty <= 0) {
            alert('Vui lòng nhập số lượng hợp lệ (> 0)!');
            return;
        }

        try {
            const res = await fetch('api/operations.php?action=create_material_transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    material_id: matId,
                    trans_type: type,
                    quantity: qty,
                    unit_price: price,
                    supplier: sup,
                    note: note
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.closeStockTransactionModal();
                this.loadMaterials();
            } else {
                alert(data.message || 'Lỗi khi lưu phiếu kho');
            }
        } catch (err) {
            alert('Lỗi kết nối máy chủ');
        }
    },

    // 8.4 Material History & Expenses
    openMaterialHistoryModal() {
        document.getElementById('modal-material-history').classList.add('open');
        this.loadMaterialHistory();
    },

    closeMaterialHistoryModal() {
        document.getElementById('modal-material-history').classList.remove('open');
    },

    async loadMaterialHistory() {
        const period = document.getElementById('hist-period-select')?.value || 'month';
        const type = document.getElementById('hist-type-select')?.value || 'all';

        try {
            const res = await fetch(`api/operations.php?action=get_transactions&period=${period}&type=${type}`);
            const data = await res.json();
            if (!data.success) return;

            const totalDisplay = document.getElementById('hist-total-cost-display');
            if (totalDisplay) totalDisplay.innerText = this.formatMoney(data.total_expense) + ' đ';

            const tbody = document.getElementById('hist-transactions-tbody');
            if (!tbody) return;

            if (!data.transactions || data.transactions.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-400">Không có phiếu nhập/xuất kho nào trong kỳ này.</td></tr>`;
                return;
            }

            const typeBadges = {
                import: '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">Nhập kho</span>',
                export: '<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">Xuất kho</span>',
                adjustment: '<span class="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold text-[10px]">Cân chỉnh</span>'
            };

            tbody.innerHTML = data.transactions.map(t => `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">${t.created_at}</td>
                    <td class="py-3 px-3 font-mono text-sky-300 font-bold whitespace-nowrap">${t.trans_code}</td>
                    <td class="py-3 px-3 whitespace-nowrap text-center">${typeBadges[t.trans_type] || t.trans_type}</td>
                    <td class="py-3 px-3 font-bold text-slate-200 min-w-[200px]">${t.material_name}</td>
                    <td class="py-3 px-3 font-mono font-bold text-slate-100 whitespace-nowrap text-center">${t.quantity} ${t.unit}</td>
                    <td class="py-3 px-3 font-mono text-slate-300 whitespace-nowrap text-right">${t.trans_type === 'import' ? Admin.formatMoney(t.unit_price) + ' đ' : '-'}</td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">${t.trans_type === 'import' ? Admin.formatMoney(t.total_cost) + ' đ' : '-'}</td>
                    <td class="py-3 px-3 text-slate-300 text-xs min-w-[150px]">${t.supplier || '-'}</td>
                    <td class="py-3 px-3 text-slate-400 text-xs whitespace-nowrap">${t.user_name || 'Admin'}</td>
                </tr>
            `).join('');
        } catch (e) {
            console.error('loadMaterialHistory error:', e);
        }
    },

    // 8.5 Payroll & Timekeeping
    async loadPayroll() {
        const monthInput = document.getElementById('payroll-month-input');
        if (monthInput && !monthInput.value) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${y}-${m}`;
        }
        const month = monthInput?.value || '';

        try {
            this.loadShiftSettings();
            const res = await fetch(`api/operations.php?action=get_payroll&month=${month}`);
            const data = await res.json();
            if (!data.success) return;

            // KPI
            const totalHoursEl = document.getElementById('payroll-total-hours');
            const totalSalaryEl = document.getElementById('payroll-total-salary');
            if (totalHoursEl) totalHoursEl.innerText = `${data.total_company_hours || 0} h`;
            if (totalSalaryEl) totalSalaryEl.innerText = `${this.formatMoney(data.total_company_salary)} đ`;

            // Render Payroll Summary
            const sumTbody = document.getElementById('payroll-summary-tbody');
            if (sumTbody) {
                const list = data.payroll_summary || [];
                if (list.length === 0) {
                    sumTbody.innerHTML = this.renderEmptyState(8, 'fa-money-bill-wave', 'Chưa có bảng lương', 'Không có dữ liệu tổng hợp lương trong tháng đã chọn.');
                } else {
                    const roleLabels = {
                        admin: 'Quản Trị (ADM)',
                        cashier: 'Thu Ngân (ACC)',
                        waiter: 'Phục Vụ (STF)',
                        kitchen: 'Tổ Bếp (KIT)',
                        customer: 'Khách Hàng'
                    };

                    sumTbody.innerHTML = list.map(ps => `
                        <tr class="hover:bg-white/5 transition-colors">
                            <td class="py-2.5 px-3 font-mono font-bold text-sky-400">${ps.user_code || `NV${ps.user_id}`}</td>
                            <td class="py-2.5 px-3 font-bold text-slate-100">${ps.fullname}</td>
                            <td class="py-2.5 px-3 text-slate-300 text-xs">${roleLabels[ps.role] || ps.role}</td>
                            <td class="py-2.5 px-3 font-mono font-bold text-amber-400">${Admin.formatMoney(ps.hourly_rate)} đ/h</td>
                            <td class="py-2.5 px-3 font-mono text-slate-300">${ps.total_shifts} ca</td>
                            <td class="py-2.5 px-3 font-mono font-bold text-sky-300">${ps.total_hours} h</td>
                            <td class="py-2.5 px-3 text-right font-mono font-black text-emerald-400 text-sm">${Admin.formatMoney(ps.total_salary)} đ</td>
                            <td class="py-2.5 px-3 text-right">
                                <button type="button" onclick="Admin.openSalaryModal(${ps.user_id}, '${ps.fullname}', '${ps.role}', ${ps.hourly_rate})" class="btn-glass text-[11px] py-1 px-2.5 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/30 font-bold" title="Cập nhật mức lương / giờ">
                                    <i class="fas fa-coins mr-1"></i> Sửa Lương
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            }

            // Render Detailed Attendance Log
            const recTbody = document.getElementById('payroll-records-tbody');
            if (recTbody) {
                const records = data.attendance_records || [];
                if (records.length === 0) {
                    recTbody.innerHTML = this.renderEmptyState(8, 'fa-calendar-check', 'Không có lượt chấm công', `Không có lượt chấm công nào trong tháng ${month}.`);
                    return;
                }

                recTbody.innerHTML = records.map(r => {
                    const isWorking = r.status === 'working';
                    const inTime = r.check_in_time ? r.check_in_time.split(' ')[1] : '';
                    const outTime = r.check_out_time ? r.check_out_time.split(' ')[1] : (isWorking ? '---' : '');

                    return `
                        <tr class="hover:bg-white/5 transition-colors">
                            <td class="py-2 px-3 font-mono text-slate-300">${r.work_date}</td>
                            <td class="py-2 px-3 font-bold text-slate-200">${r.user_name}</td>
                            <td class="py-2 px-3 font-mono text-sky-400"><i class="fas fa-arrow-right-to-bracket text-[10px] mr-1"></i>${inTime}</td>
                            <td class="py-2 px-3 font-mono text-amber-300">${outTime ? `<i class="fas fa-arrow-right-from-bracket text-[10px] mr-1"></i>${outTime}` : '---'}</td>
                            <td class="py-2 px-3 font-mono font-bold text-slate-100">${r.work_hours || 0} h</td>
                            <td class="py-2 px-3 font-mono text-slate-400">${Admin.formatMoney(r.hourly_rate)} đ</td>
                            <td class="py-2 px-3 text-right font-mono font-bold text-emerald-400">${Admin.formatMoney(r.total_pay)} đ</td>
                            <td class="py-2 px-3 text-center">
                                ${isWorking 
                                    ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">🟢 Đang trong ca</span>'
                                    : '<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5 text-[10px]">Đã tan ca</span>'}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (e) {
            console.error('loadPayroll error:', e);
        }
    },

    openSalaryModal(userId, fullname, role, currentRate) {
        document.getElementById('salary-user-id').value = userId;
        document.getElementById('salary-user-fullname').innerText = fullname;
        document.getElementById('salary-user-role').innerText = `Vai trò: ${role}`;
        document.getElementById('salary-hourly-rate').value = currentRate || 25000;
        document.getElementById('modal-edit-salary').classList.add('open');
    },

    closeSalaryModal() {
        document.getElementById('modal-edit-salary').classList.remove('open');
    },

    async submitSalaryUpdate(e) {
        e.preventDefault();
        const userId = parseInt(document.getElementById('salary-user-id').value);
        const rate = parseFloat(document.getElementById('salary-hourly-rate').value);

        if (isNaN(rate) || rate < 0) {
            alert('Vui lòng nhập mức lương hợp lệ!');
            return;
        }

        try {
            const res = await fetch('api/operations.php?action=update_hourly_rate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, hourly_rate: rate })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.closeSalaryModal();
                this.loadPayroll();
                this.loadRealtimeStaff();
            } else {
                alert(data.message || 'Lỗi khi cập nhật lương');
            }
        } catch (err) {
            alert('Lỗi kết nối máy chủ');
        }
    },

    // 8.6 Shift Configuration & Auto-closing
    async loadShiftSettings() {
        try {
            const res = await fetch('api/operations.php?action=get_shift_settings');
            const data = await res.json();
            if (!data.success || !data.data) return;

            const cfg = data.data;
            const s1Name = document.getElementById('cfg-shift1-name');
            const s1Start = document.getElementById('cfg-shift1-start');
            const s1End = document.getElementById('cfg-shift1-end');
            const s2Name = document.getElementById('cfg-shift2-name');
            const s2Start = document.getElementById('cfg-shift2-start');
            const s2End = document.getElementById('cfg-shift2-end');
            const grace = document.getElementById('cfg-shift-grace');
            const toggle = document.getElementById('cfg-shift-autoclose-toggle');

            if (s1Name && cfg.shift1_name) s1Name.value = cfg.shift1_name;
            if (s1Start && cfg.shift1_start) s1Start.value = cfg.shift1_start;
            if (s1End && cfg.shift1_end) s1End.value = cfg.shift1_end;
            if (s2Name && cfg.shift2_name) s2Name.value = cfg.shift2_name;
            if (s2Start && cfg.shift2_start) s2Start.value = cfg.shift2_start;
            if (s2End && cfg.shift2_end) s2End.value = cfg.shift2_end;
            if (grace && cfg.shift_grace_minutes !== undefined) grace.value = cfg.shift_grace_minutes;
            if (toggle) toggle.checked = !!cfg.shift_autoclose_enabled;
        } catch (e) {
            console.error('loadShiftSettings error:', e);
        }
    },

    async saveShiftSettings() {
        const payload = {
            shift1_name: document.getElementById('cfg-shift1-name')?.value.trim() || 'Ca 1 (Ca Sáng)',
            shift1_start: document.getElementById('cfg-shift1-start')?.value || '06:30',
            shift1_end: document.getElementById('cfg-shift1-end')?.value || '12:30',
            shift2_name: document.getElementById('cfg-shift2-name')?.value.trim() || 'Ca 2 (Ca Chiều / Tối)',
            shift2_start: document.getElementById('cfg-shift2-start')?.value || '12:30',
            shift2_end: document.getElementById('cfg-shift2-end')?.value || '22:30',
            shift_grace_minutes: parseInt(document.getElementById('cfg-shift-grace')?.value || 15),
            shift_autoclose_enabled: document.getElementById('cfg-shift-autoclose-toggle')?.checked ? 1 : 0
        };

        try {
            const res = await fetch('api/operations.php?action=save_shift_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.loadRealtimeStaff();
                this.loadPayroll();
            } else {
                alert(data.message || 'Lỗi khi lưu khung giờ');
            }
        } catch (err) {
            alert('Lỗi kết nối máy chủ');
        }
    },

    // ==========================================
    // 9. MEDIA SERVER & 10-BAND DSP EQUALIZER STUDIO
    // ==========================================
    eqBands: {
        band_31hz: 0.0,
        band_62hz: 0.0,
        band_125hz: 0.0,
        band_250hz: 0.0,
        band_500hz: 0.0,
        band_1khz: 0.0,
        band_2khz: 0.0,
        band_4khz: 0.0,
        band_8khz: 0.0,
        band_16khz: 0.0
    },
    eqPreamp: 0.0,
    eqPresets: [],
    mediaCatalog: [],
    mediaPollingTimer: null,
    eqAnimFrameId: null,
    eqBandsEnvelopes: new Float32Array(10),

    async loadMediaTab() {
        this._lastRenderedTrackKey = null;
        this._lastRenderedQueueKey = null;
        this.mediaPlayer.init();
        this.startEqWaveAnimation();
        await Promise.all([
            this.loadMediaEqPresets(),
            this.loadMediaJukeboxStatus(),
            this.loadMediaTracksCatalog()
        ]);

        if (this.mediaPollingTimer) clearInterval(this.mediaPollingTimer);
        this.mediaPollingTimer = setInterval(() => {
            this.loadMediaJukeboxStatus();
        }, 8000);
    },

    async loadMediaEqPresets() {
        try {
            const res = await fetch('/api/media/eq/presets');
            const data = await res.json();
            if (data.success && Array.isArray(data.presets)) {
                this.eqPresets = data.presets;
                const select = document.getElementById('eq-preset-select');
                if (select) {
                    select.innerHTML = data.presets.map(p => 
                        `<option value="${p.id}" ${p.is_active ? 'selected' : ''}>${p.preset_name}</option>`
                    ).join('');
                }

                const active = data.active || data.presets[0];
                if (active) {
                    this.setEqFromPreset(active);
                }
            }
        } catch (err) {
            console.error('loadMediaEqPresets error:', err);
        }
    },

    setEqFromPreset(preset) {
        if (!preset) return;
        const bands = ['band_31hz', 'band_62hz', 'band_125hz', 'band_250hz', 'band_500hz', 'band_1khz', 'band_2khz', 'band_4khz', 'band_8khz', 'band_16khz'];
        bands.forEach((b, idx) => {
            const raw = preset[b];
            const val = (typeof raw === 'number') ? raw : (parseFloat(raw) || 0.0);
            this.eqBands[b] = val;
            const slider = document.getElementById(`eq-slider-${b}`);
            const label = document.getElementById(`eq-val-${b}`);
            if (slider) slider.value = val;
            if (label) {
                label.textContent = (val > 0 ? '+' : '') + val.toFixed(1);
                label.className = 'eq-val-badge ' + (val > 0 ? 'eq-val-boost' : (val < 0 ? 'eq-val-cut' : 'eq-val-flat'));
            }
            const filters = (window.JukeboxEngine && window.JukeboxEngine.eqFilters && window.JukeboxEngine.eqFilters.length) ? window.JukeboxEngine.eqFilters : this.mediaPlayer.eqFilters;
            if (filters && filters[idx]) {
                filters[idx].gain.value = val;
            }
        });

        const rawPreamp = preset.preamp_gain;
        const preamp = (typeof rawPreamp === 'number') ? rawPreamp : (parseFloat(rawPreamp) || 0.0);
        this.eqPreamp = preamp;
        const preampSlider = document.getElementById('eq-slider-preamp');
        const preampLabel = document.getElementById('eq-val-preamp');
        if (preampSlider) preampSlider.value = preamp;
        if (preampLabel) preampLabel.textContent = (preamp > 0 ? '+' : '') + preamp.toFixed(1) + ' dB';
        if (this.mediaPlayer.preampNode) {
            this.mediaPlayer.preampNode.gain.value = Math.pow(10, preamp / 20);
        }

        this.renderEqCurve();
    },

    onEqSliderInput(bandName, val) {
        const num = parseFloat(val);
        this.eqBands[bandName] = num;
        const label = document.getElementById(`eq-val-${bandName}`);
        if (label) {
            label.textContent = (num > 0 ? '+' : '') + num.toFixed(1);
            label.className = 'eq-val-badge ' + (num > 0 ? 'eq-val-boost' : (num < 0 ? 'eq-val-cut' : 'eq-val-flat'));
        }
        const bands = ['band_31hz', 'band_62hz', 'band_125hz', 'band_250hz', 'band_500hz', 'band_1khz', 'band_2khz', 'band_4khz', 'band_8khz', 'band_16khz'];
        const idx = bands.indexOf(bandName);
        const filters = (window.JukeboxEngine && window.JukeboxEngine.eqFilters && window.JukeboxEngine.eqFilters.length) ? window.JukeboxEngine.eqFilters : this.mediaPlayer.eqFilters;
        if (idx >= 0 && filters && filters[idx]) {
            filters[idx].gain.value = num;
        }
        const select = document.getElementById('eq-preset-select');
        if (select) {
            const customOpt = Array.from(select.options).find(o => o.text.includes('Tùy Chỉnh') || o.text.includes('Custom'));
            if (customOpt) select.value = customOpt.value;
        }
        this.renderEqCurve();
    },

    onEqPreampInput(val) {
        const num = parseFloat(val);
        this.eqPreamp = num;
        const label = document.getElementById('eq-val-preamp');
        if (label) label.textContent = (num > 0 ? '+' : '') + num.toFixed(1) + ' dB';
        if (this.mediaPlayer.preampNode) {
            this.mediaPlayer.preampNode.gain.value = Math.pow(10, num / 20);
        }
        const select = document.getElementById('eq-preset-select');
        if (select) {
            const customOpt = Array.from(select.options).find(o => o.text.includes('Tùy Chỉnh') || o.text.includes('Custom'));
            if (customOpt) select.value = customOpt.value;
        }
    },

    async onEqPresetSelect(presetId) {
        const found = this.eqPresets.find(p => p.id == presetId);
        if (found) {
            this.setEqFromPreset(found);
            // Apply preset and notify
            try {
                await fetch('/api/media/eq/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        preset_id: Number(presetId),
                        preset_name: found.preset_name
                    })
                });
                this.showToast('🎛️ Đã áp dụng preset ' + found.preset_name, 'info');
            } catch (err) {
                console.error('onEqPresetSelect save error:', err);
            }
        }
    },

    resetEqFlat() {
        const flatPreset = {
            preset_name: '🎵 Flat (Gốc)',
            preamp_gain: 0.0,
            band_31hz: 0.0,
            band_62hz: 0.0,
            band_125hz: 0.0,
            band_250hz: 0.0,
            band_500hz: 0.0,
            band_1khz: 0.0,
            band_2khz: 0.0,
            band_4khz: 0.0,
            band_8khz: 0.0,
            band_16khz: 0.0
        };
        this.setEqFromPreset(flatPreset);
        const select = document.getElementById('eq-preset-select');
        if (select) {
            const flatOpt = Array.from(select.options).find(o => o.text.includes('Flat'));
            if (flatOpt) {
                select.value = flatOpt.value;
                this.onEqPresetSelect(flatOpt.value);
            }
        }
    },

    startEqWaveAnimation() {
        if (this.eqAnimFrameId) return;
        const loop = (timestamp) => {
            const mediaTab = document.getElementById('tab-media');
            if (mediaTab && !mediaTab.classList.contains('hidden')) {
                this.renderDynamicEqWave(timestamp);
                this.eqAnimFrameId = requestAnimationFrame(loop);
            } else {
                this.eqAnimFrameId = null;
            }
        };
        this.eqAnimFrameId = requestAnimationFrame(loop);
    },

    stopEqWaveAnimation() {
        if (this.eqAnimFrameId) {
            cancelAnimationFrame(this.eqAnimFrameId);
            this.eqAnimFrameId = null;
        }
    },

    renderDynamicEqWave(timestamp) {
        const strokeEl = document.getElementById('eq-curve-stroke');
        const waveEl = document.getElementById('eq-curve-wave');
        const fillEl = document.getElementById('eq-curve-fill');
        const nodesGroup = document.getElementById('eq-curve-nodes');
        if (!strokeEl && !waveEl && !fillEl) return;

        const bands = ['band_31hz', 'band_62hz', 'band_125hz', 'band_250hz', 'band_500hz', 'band_1khz', 'band_2khz', 'band_4khz', 'band_8khz', 'band_16khz'];
        const numPoints = bands.length;
        const startX = 30;
        const endX = 570;
        const stepX = (endX - startX) / (numPoints - 1);

        // Check if audio is actively playing and Web Audio analyser is available
        const activeAnalyser = (window.JukeboxEngine && window.JukeboxEngine.analyser) || (this.mediaPlayer && this.mediaPlayer.analyser);
        const activeAudio = (window.JukeboxEngine && window.JukeboxEngine.audio) || (this.mediaPlayer && this.mediaPlayer.audio);
        const isAudioPlaying = activeAudio && !activeAudio.paused && activeAnalyser;
        let freqData = null;
        if (isAudioPlaying) {
            if (!this._waveFreqData || this._waveFreqData.length !== activeAnalyser.frequencyBinCount) {
                this._waveFreqData = new Uint8Array(activeAnalyser.frequencyBinCount);
            }
            activeAnalyser.getByteFrequencyData(this._waveFreqData);
            freqData = this._waveFreqData;
        }

        const t = (timestamp || performance.now()) * 0.003;
        const binMap = [1, 2, 3, 5, 8, 12, 17, 22, 26, 30];

        const points = [];
        const wavePoints = [];

        for (let idx = 0; idx < numPoints; idx++) {
            const b = bands[idx];
            const x = startX + idx * stepX;
            const eqVal = this.eqBands[b] || 0.0;
            const baseY = 60 - (eqVal / 12.0) * 45;

            // Audio reaction envelope
            let targetEnergy = 0;
            if (freqData && binMap[idx] < freqData.length) {
                targetEnergy = (freqData[binMap[idx]] / 255.0);
            }
            const prevEnv = this.eqBandsEnvelopes[idx] || 0;
            const currentEnv = targetEnergy > prevEnv ? (prevEnv * 0.35 + targetEnergy * 0.65) : (prevEnv * 0.88 + targetEnergy * 0.12);
            this.eqBandsEnvelopes[idx] = currentEnv;

            // Audio bounce + organic harmonic ripple
            const musicBounce = currentEnv * 18.0;
            const ripple = Math.sin(t * 1.5 + idx * 0.75) * (1.2 + currentEnv * 4.0);
            const microPulse = Math.cos(t * 2.8 + idx * 1.2) * (0.8 + currentEnv * 2.5);

            // Primary curve Y
            const y1 = Math.max(12, Math.min(108, baseY - musicBounce + ripple));
            points.push({ x, y: y1, energy: currentEnv });

            // Secondary ghost harmonic wave Y
            const waveRipple = Math.sin(t * 1.8 + idx * 0.8 + 1.2) * (1.6 + currentEnv * 6.0);
            const y2 = Math.max(12, Math.min(108, baseY - musicBounce * 0.65 + waveRipple + microPulse));
            wavePoints.push({ x, y: y2 });
        }

        const buildPath = (pts) => {
            let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
            for (let i = 0; i < pts.length - 1; i++) {
                const p0 = (i > 0) ? pts[i - 1] : pts[0];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = (i !== pts.length - 2) ? pts[i + 2] : p2;

                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;

                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;

                d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
            }
            return d;
        };

        const mainD = buildPath(points);
        const waveD = buildPath(wavePoints);

        if (strokeEl) strokeEl.setAttribute('d', mainD);
        if (waveEl) waveEl.setAttribute('d', waveD);
        if (fillEl) fillEl.setAttribute('d', `${mainD} L ${endX} 120 L ${startX} 120 Z`);

        // Render glowing LED node dots at the 10 frequency positions
        if (nodesGroup) {
            let dotsSvg = '';
            points.forEach((p) => {
                const r = 2.0 + p.energy * 2.0;
                const glowOpacity = (0.35 + p.energy * 0.65).toFixed(2);
                dotsSvg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="#38bdf8" />`;
                if (p.energy > 0.25) {
                    dotsSvg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(r + 3).toFixed(1)}" fill="none" stroke="#a855f7" stroke-width="0.8" opacity="${glowOpacity}" />`;
                }
            });
            nodesGroup.innerHTML = dotsSvg;
        }
    },

    renderEqCurve() {
        this.renderDynamicEqWave();
        this.startEqWaveAnimation();
    },

    async applyEqChanges() {
        const select = document.getElementById('eq-preset-select');
        const presetName = select ? select.options[select.selectedIndex]?.text : 'Custom Live EQ';

        const payload = {
            preset_name: presetName,
            preamp_gain: this.eqPreamp,
            ...this.eqBands
        };

        try {
            const res = await fetch('/api/media/eq/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert('Đã áp dụng cấu hình 10-Band DSP Equalizer vào hệ thống âm thanh!');
            } else {
                alert(data.message || 'Lỗi khi áp dụng Equalizer');
            }
        } catch (err) {
            console.error('applyEqChanges error:', err);
            alert('Lỗi kết nối máy chủ Media');
        }
    },

    async loadMediaJukeboxStatus() {
        try {
            const res = await fetch('/api/media/jukebox/status');
            const data = await res.json();
            if (data.success) {
                this.renderNowPlaying(data.now_playing);
                this.renderMediaQueue(data.queue || []);
            }
        } catch (err) {
            console.error('loadMediaJukeboxStatus error:', err);
        }
    },

    renderNowPlaying(track) {
        const titleEl = document.getElementById('now-playing-title');
        const artistEl = document.getElementById('now-playing-artist');
        const genreEl = document.getElementById('now-playing-genre');
        const tableEl = document.getElementById('now-playing-table');
        const votesEl = document.getElementById('now-playing-votes');
        const durationEl = document.getElementById('now-playing-duration');

        if (!track || !track.track_title) {
            if (titleEl) titleEl.textContent = 'Chưa có bài hát nào đang phát';
            if (artistEl) artistEl.textContent = 'Hệ thống sẵn sàng';
            return;
        }

        if (titleEl) titleEl.textContent = track.track_title;
        if (artistEl) artistEl.textContent = track.track_artist || 'Nghệ sĩ chưa rõ';
        if (genreEl) genreEl.textContent = track.genre || 'Lossless';
        if (tableEl) tableEl.textContent = track.table_name || 'Hệ Thống Quán';
        if (votesEl) votesEl.innerHTML = `<i class="fas fa-thumbs-up text-sky-400 mr-0.5"></i> ${track.vote_count || 1} votes`;
        const durSeconds = Number(track.track_duration || track.duration_sec || track.duration || 198);
        if (durationEl && !isNaN(durSeconds)) {
            const m = Math.floor(durSeconds / 60);
            const s = Math.floor(durSeconds % 60);
            durationEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }

        // Real Audio Playback via HTML5 Audio + Web Audio DSP (only if standalone without JukeboxEngine)
        if (!window.JukeboxEngine) {
            this.mediaPlayer.playTrack(track);
        }
    },

    renderMediaQueue(queue) {
        const countEl = document.getElementById('media-queue-count');
        const listEl = document.getElementById('media-queue-list');
        if (!listEl) return;

        if (countEl) countEl.textContent = `${queue.length} bài trong hàng đợi`;

        if (queue.length === 0) {
            listEl.innerHTML = `
                <div class="p-4 rounded-xl bg-slate-900/40 border border-white/5 text-center text-xs text-slate-400">
                    <i class="fas fa-compact-disc text-slate-600 text-2xl mb-1 block"></i>
                    Hàng đợi trống. Khách hàng quét mã QR tại bàn để yêu cầu bài hát.
                </div>
            `;
            return;
        }

        listEl.innerHTML = queue.map((item, idx) => `
            <div class="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/15 transition flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-6 h-6 rounded-lg bg-slate-800 text-sky-400 border border-white/10 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        #${idx + 1}
                    </span>
                    <div class="min-w-0">
                        <div class="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            <span class="truncate">${item.track_title}</span>
                            ${item.is_priority ? '<span class="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-semibold">VIP</span>' : ''}
                        </div>
                        <div class="text-[10px] text-slate-400 truncate flex items-center gap-2">
                            <span>${item.track_artist}</span>
                            <span>•</span>
                            <span class="text-amber-300 font-semibold">${item.table_name || 'Khách tại bàn'}</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                    <button type="button" onclick="Admin.voteMediaItem(${item.id})" class="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[11px] font-bold flex items-center gap-1 transition" title="Bình chọn bài hát">
                        <i class="fas fa-thumbs-up text-[10px]"></i>
                        <span>${item.vote_count}</span>
                    </button>
                    <button type="button" onclick="Admin.removeMediaQueueItem(${item.id}, '${(item.track_title || '').replace(/'/g, "\\'")}')" class="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 flex items-center justify-center text-xs transition active:scale-95" title="Xóa bài hát khỏi hàng đợi">
                        <i class="fas fa-trash-alt text-[10px]"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    async loadMediaTracksCatalog() {
        try {
            const res = await fetch('/api/media/tracks');
            const data = await res.json();
            if (data.success && Array.isArray(data.tracks)) {
                this.mediaCatalog = data.tracks;
                this.renderMediaCatalog(data.tracks);
            }
        } catch (err) {
            console.error('loadMediaTracksCatalog error:', err);
        }
    },

    renderMediaCatalog(tracks) {
        const listEl = document.getElementById('media-catalog-list');
        if (!listEl) return;

        if (tracks.length === 0) {
            listEl.innerHTML = '<div class="text-center text-slate-500 py-3 text-xs">Không tìm thấy bài hát</div>';
            return;
        }

        listEl.innerHTML = tracks.map(t => {
            const durSeconds = Number(t.duration_sec || t.duration || 180);
            const m = Math.floor(durSeconds / 60);
            const s = Math.floor(durSeconds % 60);
            const dur = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

            return `
                <div class="p-2 rounded-xl bg-slate-900/50 border border-white/5 hover:border-sky-500/30 transition flex items-center justify-between gap-2">
                    <div class="min-w-0 flex items-center gap-2">
                        <i class="fas fa-music text-sky-400 text-xs shrink-0"></i>
                        <div class="min-w-0">
                            <div class="font-bold text-white truncate text-xs">${t.title}</div>
                            <div class="text-[10px] text-slate-400 truncate">${t.artist} • <span class="text-slate-500 font-mono">${dur}</span></div>
                        </div>
                    </div>
                    <button type="button" onclick="Admin.requestMediaTrack(${t.id})" class="px-2 py-1 rounded-lg bg-fuchsia-600/20 hover:bg-fuchsia-600/40 text-fuchsia-300 border border-fuchsia-500/30 text-[10px] font-bold flex items-center gap-1 shrink-0 transition" title="Đưa vào hàng đợi Jukebox với quyền Quản lý">
                        <i class="fas fa-plus"></i> Phát
                    </button>
                </div>
            `;
        }).join('');
    },

    filterMediaCatalog(keyword) {
        if (!keyword || !keyword.trim()) {
            this.renderMediaCatalog(this.mediaCatalog);
            return;
        }
        const kw = keyword.toLowerCase().trim();
        const filtered = this.mediaCatalog.filter(t => 
            t.title.toLowerCase().includes(kw) || 
            t.artist.toLowerCase().includes(kw) || 
            (t.genre && t.genre.toLowerCase().includes(kw))
        );
        this.renderMediaCatalog(filtered);
    },

    // ==========================================
    // CYBERTOAST NOTIFICATION ENGINE (NON-BLOCKING)
    // ==========================================
    showToast(message, type = 'info', duration = 3000) {
        let container = document.getElementById('cyber-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'cyber-toast-container';
            container.className = 'fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 pointer-events-none';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const colorMap = {
            success: 'border-emerald-500/40 bg-slate-900/95 text-emerald-300 shadow-emerald-500/10',
            error: 'border-rose-500/40 bg-slate-900/95 text-rose-300 shadow-rose-500/10',
            warning: 'border-amber-500/40 bg-slate-900/95 text-amber-300 shadow-amber-500/10',
            info: 'border-sky-500/40 bg-slate-900/95 text-sky-300 shadow-sky-500/10'
        };
        const iconMap = {
            success: 'fa-check-circle text-emerald-400',
            error: 'fa-times-circle text-rose-400',
            warning: 'fa-triangle-exclamation text-amber-400',
            info: 'fa-info-circle text-sky-400'
        };

        const borderClass = colorMap[type] || colorMap.info;
        const iconClass = iconMap[type] || iconMap.info;

        toast.className = `pointer-events-auto px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 transition-all duration-300 transform translate-y-2 opacity-0 text-xs font-semibold ${borderClass}`;
        toast.innerHTML = `
            <i class="fas ${iconClass} text-sm shrink-0"></i>
            <span class="text-white">${message}</span>
            <button type="button" class="ml-2 text-slate-400 hover:text-white text-xs">&times;</button>
        `;

        toast.querySelector('button').onclick = () => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 250);
        };

        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        });

        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => toast.remove(), 250);
            }
        }, duration);
    },

    // ==========================================
    // NATIVE HTML5 & WEB AUDIO API PLAYER ENGINE
    // ==========================================
    mediaPlayer: {
        audio: null,
        audioCtx: null,
        sourceNode: null,
        preampNode: null,
        eqFilters: [],
        isPlaying: false,
        currentTrack: null,
        init() {
            if (window.JukeboxEngine) {
                window.JukeboxEngine.init();
                this.audio = window.JukeboxEngine.audio;
                this.audioCtx = window.JukeboxEngine.audioCtx;
                this.analyser = window.JukeboxEngine.analyser;
                this.eqFilters = window.JukeboxEngine.eqFilters;
                this.preampNode = window.JukeboxEngine.preampNode;
                this.freqData = window.JukeboxEngine.freqData;
                this.isPlaying = window.JukeboxEngine.isPlaying;
                this.currentTrack = window.JukeboxEngine.currentTrack;
                return;
            }
            if (this.audio) return;
            this.audio = new Audio();
            this.audio.preload = 'auto';

            this.audio.addEventListener('play', () => {
                this.isPlaying = true;
                const icon = document.getElementById('now-playing-play-icon');
                if (icon) icon.className = 'fas fa-pause text-[9px] text-white';
                const ctrlIcon = document.getElementById('jukebox-ctrl-play-icon');
                if (ctrlIcon) ctrlIcon.className = 'fas fa-pause text-xs';
                const ctrlText = document.getElementById('jukebox-ctrl-play-text');
                if (ctrlText) ctrlText.textContent = 'Tạm Dừng';
            });

            this.audio.addEventListener('pause', () => {
                this.isPlaying = false;
                const icon = document.getElementById('now-playing-play-icon');
                if (icon) icon.className = 'fas fa-play text-[9px] text-white';
                const ctrlIcon = document.getElementById('jukebox-ctrl-play-icon');
                if (ctrlIcon) ctrlIcon.className = 'fas fa-play text-xs';
                const ctrlText = document.getElementById('jukebox-ctrl-play-text');
                if (ctrlText) ctrlText.textContent = 'Phát';
            });

            this.audio.addEventListener('timeupdate', () => {
                if (!this.audio.duration || isNaN(this.audio.duration)) return;
                const cur = this.audio.currentTime;
                const dur = this.audio.duration;
                const bar = document.getElementById('now-playing-progress');
                if (bar) bar.style.width = `${(cur / dur) * 100}%`;
                const curTimeEl = document.getElementById('now-playing-current-time');
                if (curTimeEl) {
                    const m = Math.floor(cur / 60);
                    const s = Math.floor(cur % 60);
                    curTimeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                }
            });

            this.audio.addEventListener('ended', () => {
                Admin.skipMediaTrack(); // Automatically advance to next queued song!
            });
        },

        setupWebAudio() {
            if (window.JukeboxEngine) {
                window.JukeboxEngine._setupWebAudio();
                this.audioCtx = window.JukeboxEngine.audioCtx;
                this.analyser = window.JukeboxEngine.analyser;
                this.eqFilters = window.JukeboxEngine.eqFilters;
                this.preampNode = window.JukeboxEngine.preampNode;
                this.freqData = window.JukeboxEngine.freqData;
                return;
            }
            if (this.audioCtx) return;
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                this.audioCtx = new AudioCtx();
                this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
                this.preampNode = this.audioCtx.createGain();
                this.preampNode.gain.value = 1.0;

                const bands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
                this.eqFilters = bands.map((freq, idx) => {
                    const f = this.audioCtx.createBiquadFilter();
                    f.type = (idx === 0) ? 'lowshelf' : (idx === bands.length - 1 ? 'highshelf' : 'peaking');
                    f.frequency.value = freq;
                    f.Q.value = 1.4;
                    f.gain.value = 0.0;
                    return f;
                });

                // Web Audio Analyser for Real-Time Oscilloscope Wave Visualization
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 64; // 32 frequency bins
                this.analyser.smoothingTimeConstant = 0.75;
                this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

                let prev = this.sourceNode;
                prev.connect(this.preampNode);
                prev = this.preampNode;
                this.eqFilters.forEach(node => {
                    prev.connect(node);
                    prev = node;
                });
                prev.connect(this.analyser);
                this.analyser.connect(this.audioCtx.destination);
            } catch (err) {
                console.warn('Web Audio DSP not supported:', err);
            }
        },

        playTrack(track) {
            if (window.JukeboxEngine) {
                if (track && track.file_path) {
                    window.JukeboxEngine.playTrack(track);
                }
                return;
            }
            this.init();
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            } else if (!this.audioCtx) {
                this.setupWebAudio();
            }
            if (!track || !track.file_path) return;
            this.currentTrack = track;
            let fullSrc = track.file_path.startsWith('/') ? track.file_path : ('/' + track.file_path);
            
            if (this.audio.getAttribute('data-current-src') !== fullSrc) {
                this.audio.setAttribute('data-current-src', fullSrc);
                this.audio.src = fullSrc;
                this.audio.load();
                this.audio.play().catch(e => {
                    console.log('Autoplay policy caught, click Play to listen:', e);
                });
            }
        },

        togglePlay() {
            if (window.JukeboxEngine) {
                window.JukeboxEngine.togglePlay();
                return;
            }
            this.init();
            if (!this.audioCtx) {
                this.setupWebAudio();
            } else if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            if (this.audio.paused) {
                this.audio.play().catch(e => console.log('Play error:', e));
            } else {
                this.audio.pause();
            }
        },

        seek(e) {
            const bar = e.currentTarget;
            const rect = bar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clickX / rect.width));
            if (window.JukeboxEngine) {
                window.JukeboxEngine.seek(ratio);
                return;
            }
            if (!this.audio || !this.audio.duration) return;
            this.audio.currentTime = ratio * this.audio.duration;
        },

        setVolume(val) {
            if (window.JukeboxEngine) {
                window.JukeboxEngine.setVolume(val);
                return;
            }
            if (!this.audio) this.init();
            this.audio.volume = Math.max(0, Math.min(1, Number(val) / 100));
        },

        setDucking(enable) {
            if (!this.audio) this.init();
            this.audio.volume = enable ? 0.3 : 1.0;
        }
    },

    async requestMediaTrack(trackId) {
        try {
            const res = await fetch('/api/media/jukebox/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    track_id: trackId,
                    table_id: 0,
                    table_name: 'Quầy Quản Trị (Admin)',
                    customer_phone: '',
                    is_priority: 1
                })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast('🎵 Đã thêm bài hát vào hàng đợi Jukebox!', 'success');
                this.loadMediaJukeboxStatus();
            } else {
                this.showToast(data.message || 'Lỗi khi yêu cầu bài hát', 'error');
            }
        } catch (err) {
            console.error('requestMediaTrack error:', err);
            this.showToast('Lỗi kết nối máy chủ Media', 'error');
        }
    },

    async voteMediaItem(queueId) {
        try {
            const res = await fetch('/api/media/jukebox/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queue_id: queueId })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast('👍 Đã bình chọn bài hát!', 'success');
                this.loadMediaJukeboxStatus();
            } else {
                this.showToast(data.message || 'Lỗi bình chọn', 'warning');
            }
        } catch (err) {
            console.error('voteMediaItem error:', err);
        }
    },

    showConfirmDialog({ title, message, subtext, icon, confirmText, confirmClass, onConfirm }) {
        let modal = document.getElementById('admin-glass-confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'admin-glass-confirm-modal';
            modal.style.cssText = 'position: fixed; inset: 0; z-index: 99999; display: none; align-items: center; justify-content: center; padding: 1rem; background: rgba(2, 6, 23, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);';
            modal.innerHTML = `
                <div style="width: 440px; max-width: 100%; border-radius: 1.25rem; padding: 1.5rem; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); color: #fff; transform: scale(0.95); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);" id="admin-glass-confirm-content">
                    <div style="display: flex; align-items: flex-start; gap: 1rem;">
                        <div style="width: 3rem; height: 3rem; border-radius: 1rem; background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.3); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
                            <i id="admin-confirm-icon" class="fas fa-trash-alt" style="color: #fb7185;"></i>
                        </div>
                        <div style="min-width: 0; flex: 1;">
                            <h3 id="admin-confirm-title" style="font-weight: 700; font-size: 1rem; color: #fff; margin: 0;">Xác nhận xóa bài</h3>
                            <p id="admin-confirm-msg" style="font-size: 0.8125rem; color: #cbd5e1; margin: 0.375rem 0 0 0; line-height: 1.5;"></p>
                            <p id="admin-confirm-sub" style="font-size: 0.6875rem; color: #64748b; margin: 0.25rem 0 0 0;"></p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.625rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.08);">
                        <button type="button" id="admin-confirm-cancel-btn" style="padding: 0.5rem 1rem; border-radius: 0.75rem; font-size: 0.75rem; font-weight: 600; color: #94a3b8; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); cursor: pointer; transition: all 0.15s;">
                            Hủy Bỏ
                        </button>
                        <button type="button" id="admin-confirm-ok-btn" style="padding: 0.5rem 1.125rem; border-radius: 0.75rem; font-size: 0.75rem; font-weight: 700; color: #fff; background: linear-gradient(135deg, #e11d48, #be123c); border: 1px solid rgba(244, 63, 94, 0.4); box-shadow: 0 4px 14px rgba(225, 29, 72, 0.35); cursor: pointer; transition: all 0.15s;">
                            Xác Nhận Xóa
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeConfirmDialog();
            });
        }

        const titleEl = document.getElementById('admin-confirm-title');
        const msgEl = document.getElementById('admin-confirm-msg');
        const subEl = document.getElementById('admin-confirm-sub');
        const iconEl = document.getElementById('admin-confirm-icon');
        const okBtn = document.getElementById('admin-confirm-ok-btn');
        const cancelBtn = document.getElementById('admin-confirm-cancel-btn');
        const content = document.getElementById('admin-glass-confirm-content');

        if (titleEl) titleEl.textContent = title || 'Xác nhận';
        if (msgEl) msgEl.textContent = message || '';
        if (subEl) subEl.textContent = subtext || '';
        if (iconEl && icon) iconEl.className = 'fas ' + icon;

        if (okBtn) {
            okBtn.textContent = confirmText || 'Đồng Ý';
            okBtn.onclick = async () => {
                this.closeConfirmDialog();
                if (typeof onConfirm === 'function') await onConfirm();
            };
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => this.closeConfirmDialog();
        }

        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            if (content) content.style.transform = 'scale(1)';
        });
    },

    closeConfirmDialog() {
        const modal = document.getElementById('admin-glass-confirm-modal');
        const content = document.getElementById('admin-glass-confirm-content');
        if (content) content.style.transform = 'scale(0.95)';
        if (modal) {
            setTimeout(() => { modal.style.display = 'none'; }, 100);
        }
    },

    removeMediaQueueItem(queueId, trackTitle = '') {
        const songName = trackTitle ? `"${trackTitle}"` : 'bài hát này';
        this.showConfirmDialog({
            title: 'Xóa Bài Hát Khỏi Hàng Đợi',
            message: `Bạn có chắc muốn xóa bài hát ${songName} khỏi danh sách phát?`,
            subtext: 'Bài hát sẽ được dọn ngay và nhường quyền phát cho bài tiếp theo.',
            icon: 'fa-trash-alt text-rose-400',
            confirmText: 'Xác Nhận Xóa',
            confirmClass: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30 active:scale-95',
            onConfirm: async () => {
                try {
                    const res = await fetch('/api/media/jukebox/remove', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ queue_id: queueId })
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.showToast('🗑️ Đã xóa bài hát khỏi hàng đợi!', 'success');
                        this.loadMediaJukeboxStatus();
                    } else {
                        this.showToast(data.message || 'Lỗi khi xóa bài hát', 'error');
                    }
                } catch (err) {
                    console.error('removeMediaQueueItem error:', err);
                    this.showToast('Lỗi kết nối khi xóa bài hát', 'error');
                }
            }
        });
    },

    async skipMediaTrack() {
        if (window.JukeboxEngine) {
            await window.JukeboxEngine.skip();
            this.showToast('⏭️ Đã chuyển sang bài hát kế tiếp!', 'info');
            return;
        }
        // Instant non-blocking skip without freezing prompt!
        try {
            const res = await fetch('/api/media/jukebox/skip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_admin: true })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast('⏭️ Đã chuyển sang bài hát tiếp theo!', 'success');
                await this.loadMediaJukeboxStatus();
            } else {
                this.showToast(data.message || 'Lỗi khi chuyển bài', 'error');
            }
        } catch (err) {
            console.error('skipMediaTrack error:', err);
            this.showToast('Lỗi kết nối máy chủ Media', 'error');
        }
    },

    toggleAudioDucking(enabled) {
        this.mediaPlayer.setDucking(enabled);
        const msg = enabled ? 
            'Đã BẬT Auto-Ducking: Âm lượng nhạc tự động hạ -10dB khi POS gọi món.' : 
            'Đã TẮT Auto-Ducking: Giữ nguyên mức âm lượng khi gọi món.';
        this.showToast(msg, 'info');
    },

    // ==========================================
    // OFFLINE MEDIA LIBRARY MANAGER METHODS
    // ==========================================
    openMediaManagerModal() {
        const modal = document.getElementById('admin-media-manager-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        this.renderMediaManagerTable();
    },

    renderMediaManagerTable() {
        const tbody = document.getElementById('modal-media-table-body');
        const countEl = document.getElementById('modal-media-total-count');
        if (!tbody) return;

        const tracks = this.mediaCatalog || [];
        if (countEl) countEl.textContent = tracks.length;

        const kw = (document.getElementById('modal-media-search')?.value || '').toLowerCase().trim();
        const filtered = kw ? tracks.filter(t => 
            t.title.toLowerCase().includes(kw) || 
            t.artist.toLowerCase().includes(kw) || 
            (t.genre && t.genre.toLowerCase().includes(kw))
        ) : tracks;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">Không tìm thấy bài hát nào</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(t => {
            const durSeconds = Number(t.duration_sec || t.duration || 180);
            const m = Math.floor(durSeconds / 60);
            const s = Math.floor(durSeconds % 60);
            const dur = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

            return `
                <tr class="hover:bg-slate-800/40 transition">
                    <td class="p-2.5 font-mono text-slate-500">#${t.id}</td>
                    <td class="p-2.5 font-bold text-white flex items-center gap-2">
                        <i class="fas fa-music text-teal-400 text-xs"></i>
                        <span class="truncate max-w-[200px]">${t.title}</span>
                    </td>
                    <td class="p-2.5 text-slate-300 truncate max-w-[150px]">${t.artist || 'Chưa rõ'}</td>
                    <td class="p-2.5">
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            ${t.genre || 'Lossless'}
                        </span>
                    </td>
                    <td class="p-2.5 text-center font-mono text-slate-400">${dur}</td>
                    <td class="p-2.5 text-right space-x-1 whitespace-nowrap">
                        <button type="button" onclick="Admin.requestMediaTrack(${t.id})" class="btn-glass text-[10px] py-1 px-2 text-sky-300 hover:text-white" title="Phát bài này">
                            <i class="fas fa-play text-[9px]"></i> Phát
                        </button>
                        <button type="button" onclick="Admin.deleteMediaTrack(${t.id})" class="btn-glass text-[10px] py-1 px-2 text-rose-400 hover:text-rose-300 border-rose-500/20" title="Xóa bài hát">
                            <i class="fas fa-trash-alt text-[9px]"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    filterMediaManagerTable(kw) {
        this.renderMediaManagerTable();
    },

    openUploadMediaModal() {
        const modal = document.getElementById('admin-media-upload-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.selectedUploadFiles = [];
            this.renderBatchFilesQueue();
            const dropzone = document.getElementById('media-dropzone');
            if (dropzone && !dropzone.dataset.bound) {
                dropzone.dataset.bound = 'true';
                dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropzone.classList.add('border-teal-300', 'bg-slate-900/90');
                });
                dropzone.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('border-teal-300', 'bg-slate-900/90');
                });
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('border-teal-300', 'bg-slate-900/90');
                    if (e.dataTransfer && e.dataTransfer.files) {
                        Admin.handleBatchAudioPicked(e.dataTransfer.files);
                    }
                });
            }
        }
    },

    closeUploadMediaModal() {
        const modal = document.getElementById('admin-media-upload-modal');
        if (modal) modal.classList.add('hidden');
    },

    selectedUploadFiles: [],

    handleBatchAudioPicked(fileList) {
        if (!fileList || fileList.length === 0) return;
        const newFiles = Array.from(fileList).filter(f => {
            const ext = (f.name.substring(f.name.lastIndexOf('.')) || '').toLowerCase();
            return ['.mp3', '.wav', '.flac', '.ogg'].includes(ext);
        });

        if (newFiles.length === 0) {
            this.showToast('Vui lòng chỉ chọn các tệp âm thanh định dạng .mp3, .wav, .flac, .ogg!', 'warning');
            return;
        }

        // Append to existing queue or set
        this.selectedUploadFiles = [...this.selectedUploadFiles, ...newFiles];
        this.renderBatchFilesQueue();
        this.showToast(`Đã nhận diện ${newFiles.length} file nhạc vào hàng đợi tải lên!`, 'info');
    },

    removeUploadQueueItem(idx) {
        if (idx >= 0 && idx < this.selectedUploadFiles.length) {
            this.selectedUploadFiles.splice(idx, 1);
            this.renderBatchFilesQueue();
        }
    },

    clearUploadQueue() {
        this.selectedUploadFiles = [];
        this.renderBatchFilesQueue();
    },

    applyBatchGenre(genre) {
        this.showToast(`Đã gán thể loại "${genre}" cho toàn bộ danh sách tải lên!`, 'info');
    },

    renderBatchFilesQueue() {
        const tbody = document.getElementById('media-upload-queue-body');
        const controlBar = document.getElementById('media-batch-control-bar');
        const countBadge = document.getElementById('media-batch-count-badge');
        const sizeBadge = document.getElementById('media-batch-size-badge');
        const startBtn = document.getElementById('media-upload-start-btn');
        const progressContainer = document.getElementById('media-upload-progress-container');
        
        if (progressContainer) progressContainer.classList.add('hidden');

        const totalFiles = this.selectedUploadFiles.length;

        if (totalFiles === 0) {
            if (controlBar) controlBar.classList.add('hidden');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="p-8 text-center text-slate-500">
                            Chưa có file nào được chọn. Hãy chọn hoặc kéo thả nhiều file nhạc vào khung bên trên.
                        </td>
                    </tr>
                `;
            }
            return;
        }

        // Has files -> Show control bar and enable submit button
        if (controlBar) controlBar.classList.remove('hidden');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        const totalBytes = this.selectedUploadFiles.reduce((acc, f) => acc + (f.size || 0), 0);
        const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);

        if (countBadge) countBadge.textContent = `${totalFiles} bài hát`;
        if (sizeBadge) sizeBadge.textContent = `${totalMb} MB`;

        if (!tbody) return;

        tbody.innerHTML = this.selectedUploadFiles.map((file, idx) => {
            let name = file.name;
            const dotIdx = name.lastIndexOf('.');
            const ext = dotIdx > 0 ? name.substring(dotIdx).toUpperCase() : '';
            if (dotIdx > 0) name = name.substring(0, dotIdx);

            let artist = 'Various Artists';
            let title = name;
            if (name.includes(' - ')) {
                const parts = name.split(' - ');
                artist = parts[0].trim();
                title = parts.slice(1).join(' - ').trim();
            }

            const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

            return `
                <tr class="hover:bg-slate-800/40 transition text-xs">
                    <td class="p-2 font-mono text-slate-500">#${idx + 1}</td>
                    <td class="p-2 font-bold text-white flex items-center gap-1.5 truncate max-w-[240px]">
                        <span class="px-1.5 py-0.5 rounded text-[9px] bg-teal-500/20 text-teal-300 font-mono font-bold">${ext}</span>
                        <span class="truncate" title="${title}">${title}</span>
                    </td>
                    <td class="p-2 text-slate-400 truncate max-w-[140px]" title="${artist}">${artist}</td>
                    <td class="p-2 text-center font-mono text-slate-300">${sizeMb} MB</td>
                    <td class="p-2 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Sẵn sàng
                        </span>
                    </td>
                    <td class="p-2 text-right">
                        <button type="button" onclick="Admin.removeUploadQueueItem(${idx})" class="w-6 h-6 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 hover:text-white transition" title="Bỏ file này">
                            <i class="fas fa-times text-[10px]"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async startBatchUpload() {
        if (!this.selectedUploadFiles || this.selectedUploadFiles.length === 0) {
            this.showToast('Vui lòng chọn ít nhất 1 file âm thanh!', 'warning');
            return;
        }

        const startBtn = document.getElementById('media-upload-start-btn');
        const progressContainer = document.getElementById('media-upload-progress-container');
        const progressBar = document.getElementById('media-upload-progress-bar');
        const percentText = document.getElementById('media-upload-percent-text');
        const statusText = document.getElementById('media-upload-status-text');
        const genre = document.getElementById('media-batch-genre-select')?.value || 'Acoustic';

        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang tải lên...';
        }
        if (progressContainer) progressContainer.classList.remove('hidden');

        const formData = new FormData();
        this.selectedUploadFiles.forEach((file) => {
            formData.append('audio_files[]', file);
        });
        formData.append('genre', genre);

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/media/tracks/upload', true);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    if (progressBar) progressBar.style.width = `${percent}%`;
                    if (percentText) percentText.textContent = `${percent}%`;
                    if (statusText) statusText.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> Đang tải lên ${this.selectedUploadFiles.length} bài hát (${percent}%)...`;
                }
            };

            xhr.onload = async () => {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data.success) {
                            this.showToast(data.message || `Đã tải lên thành công ${this.selectedUploadFiles.length} bài hát!`, 'success');
                            this.selectedUploadFiles = [];
                            this.closeUploadMediaModal();
                            await this.loadMediaTracksCatalog();
                            this.renderMediaManagerTable();
                        } else {
                            this.showToast(data.message || 'Lỗi khi tải lên file nhạc', 'error');
                        }
                    } catch (e) {
                        this.showToast('Đã tải lên bài hát thành công!', 'success');
                        this.selectedUploadFiles = [];
                        this.closeUploadMediaModal();
                        await this.loadMediaTracksCatalog();
                        this.renderMediaManagerTable();
                    }
                } else {
                    this.showToast(`Lỗi HTTP ${xhr.status} khi tải lên bài hát`, 'error');
                }
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.innerHTML = '<i class="fas fa-cloud-arrow-up mr-1"></i> Bắt Đầu Tải Lên Tất Cả';
                }
            };

            xhr.onerror = () => {
                this.showToast('Lỗi kết nối khi tải lên bài hát', 'error');
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.innerHTML = '<i class="fas fa-cloud-arrow-up mr-1"></i> Bắt Đầu Tải Lên Tất Cả';
                }
            };

            xhr.send(formData);
        } catch (err) {
            console.error('startBatchUpload error:', err);
            this.showToast('Lỗi gửi dữ liệu lên máy chủ', 'error');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-cloud-arrow-up mr-1"></i> Bắt Đầu Tải Lên Tất Cả';
            }
        }
    },

    async deleteMediaTrack(id) {
        // Direct delete with feedback toast! Zero blocking popups!
        try {
            const res = await fetch(`/api/media/tracks/delete?action=delete&id=${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id: id })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast(data.message || 'Đã xóa bài hát khỏi kho nhạc!', 'info');
                await this.loadMediaTracksCatalog();
                this.renderMediaManagerTable();
            } else {
                this.showToast(data.message || 'Lỗi xóa bài hát', 'error');
            }
        } catch (err) {
            console.error('deleteMediaTrack error:', err);
            this.showToast('Lỗi kết nối máy chủ', 'error');
        }
    },

    async rescanMediaTracks() {
        try {
            const res = await fetch('/api/media/tracks/rescan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                this.showToast(data.message || 'Đã quét xong thư mục nhạc!', 'success');
                await this.loadMediaTracksCatalog();
                this.renderMediaManagerTable();
            } else {
                this.showToast(data.message || 'Lỗi quét thư mục nhạc', 'error');
            }
        } catch (err) {
            console.error('rescanMediaTracks error:', err);
            this.showToast('Lỗi kết nối máy chủ', 'error');
        }
    },

    // ==========================================
    // 8. TÀI CHÍNH & SỔ QUỸ (FINANCE REPORTS)
    // ==========================================
    async loadFinance() {
        const monthInput = document.getElementById('fin-month-input');
        if (monthInput && !monthInput.value) {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${yyyy}-${mm}`;
        }
        const month = monthInput ? monthInput.value : '';

        try {
            const [repRes, expRes, auditRes] = await Promise.all([
                fetch(`api/finance.php?action=get_report&month=${month}`).then(r => r.json()).catch(() => ({})),
                fetch(`api/finance.php?action=list_expenses&month=${month}`).then(r => r.json()).catch(() => ({})),
                fetch(`api/finance.php?action=audit_and_shifts`).then(r => r.json()).catch(() => ({}))
            ]);

            // Render Audit KPI Cards & Audit Logs Table & Shifts Table
            const auditKpi = (auditRes && auditRes.audit_kpi) || { critical_count: 0, void_count: 0, void_amount: 0, discount_count: 0, discount_amount: 0, total_shift_discrepancy: 0 };
            const auditKpiEl = document.getElementById('fin-audit-kpi-cards');
            if (auditKpiEl) {
                const diffVal = Number(auditKpi.total_shift_discrepancy) || 0;
                auditKpiEl.innerHTML = `
                    <div class="liquid-glass-card p-3 border-l-4 border-rose-500">
                        <span class="text-[10px] font-bold text-rose-300 uppercase block">CẢNH BÁO RỦI RO CAO (CRITICAL)</span>
                        <div class="text-xl font-black text-rose-400 font-mono mt-1">${auditKpi.critical_count} <span class="text-xs font-normal text-slate-400">sự kiện</span></div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Hủy đơn / Giảm giá lớn / Lệch ca</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-orange-400">
                        <span class="text-[10px] font-bold text-orange-300 uppercase block">TỔNG HỦY ĐƠN (VOID)</span>
                        <div class="text-xl font-black text-orange-400 font-mono mt-1">${this.formatMoney(auditKpi.void_amount)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">${auditKpi.void_count} hóa đơn bị hủy</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-amber-400">
                        <span class="text-[10px] font-bold text-amber-300 uppercase block">TỔNG GIẢM GIÁ THỦ CÔNG</span>
                        <div class="text-xl font-black text-amber-400 font-mono mt-1">${this.formatMoney(auditKpi.discount_amount)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">${auditKpi.discount_count} lượt áp chiết khấu</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 ${diffVal < 0 ? 'border-rose-500' : 'border-emerald-400'}">
                        <span class="text-[10px] font-bold text-slate-300 uppercase block">LỆCH KÉT GIAO CA LŨY KẾ</span>
                        <div class="text-xl font-black ${diffVal < 0 ? 'text-rose-400' : 'text-emerald-400'} font-mono mt-1">${diffVal > 0 ? '+' : ''}${this.formatMoney(diffVal)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">${diffVal === 0 ? 'Khớp 100% két lý thuyết' : (diffVal < 0 ? 'Thiếu hụt tiền mặt' : 'Dư tiền mặt')}</span>
                    </div>
                `;
            }

            const auditTbody = document.getElementById('fin-audit-logs-tbody');
            if (auditTbody) {
                const logs = (auditRes && auditRes.audit_logs) || [];
                if (logs.length === 0) {
                    auditTbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-xs text-slate-500">Chưa ghi nhận thao tác nhạy cảm nào trong Nhật ký Kiểm toán.</td></tr>';
                } else {
                    auditTbody.innerHTML = logs.map(l => {
                        const sevBadge = l.severity === 'CRITICAL'
                            ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">🚩 CRITICAL</span>'
                            : (l.severity === 'WARN'
                                ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">⚠️ WARN</span>'
                                : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">ℹ️ INFO</span>');
                        return `
                            <tr class="hover:bg-white/[0.03] transition-colors">
                                <td><span class="font-mono text-[11px] text-slate-400 whitespace-nowrap">${l.created_at || '-'}</span></td>
                                <td>${sevBadge}</td>
                                <td><span class="text-xs font-bold text-white">${l.action_label || l.action_code}</span></td>
                                <td><span class="font-mono text-xs text-sky-300">${l.table_code || '-'} ${l.order_code ? '(' + l.order_code + ')' : ''}</span></td>
                                <td class="col-right"><span class="font-mono font-bold text-xs ${Number(l.amount_impact) > 0 ? 'text-rose-400' : 'text-slate-400'}">${Number(l.amount_impact) > 0 ? this.formatMoney(l.amount_impact) + ' đ' : '-'}</span></td>
                                <td>
                                    <div class="text-xs text-amber-200 font-semibold">${l.reason || '-'}</div>
                                    ${l.details ? `<div class="text-[10px] text-slate-400">${l.details}</div>` : ''}
                                </td>
                                <td><span class="text-xs text-slate-300 font-medium">${l.user_name || '-'} <span class="text-[10px] text-slate-500">[${l.user_role || ''}]</span></span></td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            const shiftsTbody = document.getElementById('fin-shifts-tbody');
            if (shiftsTbody) {
                const shifts = (auditRes && auditRes.shifts) || [];
                if (shifts.length === 0) {
                    shiftsTbody.innerHTML = '<tr><td colspan="10" class="py-6 text-center text-xs text-slate-500">Chưa có lịch sử ca làm việc nào. Thu ngân có thể bấm "Giao Ca / Quỹ" trên màn hình POS để mở ca.</td></tr>';
                } else {
                    shiftsTbody.innerHTML = shifts.map(s => {
                        const diff = Number(s.discrepancy) || 0;
                        const isOpen = s.status === 'open';
                        const diffClass = diff < 0 ? 'text-rose-400 font-black' : (diff > 0 ? 'text-amber-300 font-bold' : 'text-emerald-400 font-bold');
                        return `
                            <tr class="hover:bg-white/[0.03] transition-colors">
                                <td><span class="font-mono font-bold text-xs text-amber-300">${s.shift_code}</span></td>
                                <td><span class="text-xs text-white font-semibold">${s.user_name || 'Thu ngân'}</span></td>
                                <td>
                                    <div class="font-mono text-[10px] text-slate-300">Mở: ${s.opened_at || '-'}</div>
                                    <div class="font-mono text-[10px] text-slate-400">Kết: ${s.closed_at || 'Đang trực ca'}</div>
                                </td>
                                <td class="col-right font-mono text-xs text-slate-300">${this.formatMoney(s.opening_cash)} đ</td>
                                <td class="col-right font-mono text-xs text-emerald-400">+${this.formatMoney(s.cash_sales)} đ</td>
                                <td class="col-right font-mono text-[11px]">
                                    <span class="text-emerald-300">+${this.formatMoney(s.cash_in)}</span> / <span class="text-rose-400">-${this.formatMoney(s.cash_out)}</span>
                                </td>
                                <td class="col-right font-mono text-xs font-bold text-sky-300">${isOpen ? 'Đang tính' : this.formatMoney(s.expected_cash) + ' đ'}</td>
                                <td class="col-right font-mono text-xs font-bold text-white">${isOpen ? '-' : this.formatMoney(s.actual_cash) + ' đ'}</td>
                                <td class="col-right font-mono text-xs ${diffClass}">${isOpen ? '-' : (diff > 0 ? '+' : '') + this.formatMoney(diff) + ' đ'}</td>
                                <td>
                                    ${isOpen
                                        ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">ĐANG MỞ</span>'
                                        : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-white/10">ĐÃ CHỐT</span>'}
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            const summary = (repRes && repRes.summary) || { revenue: 0, expenses: 0, net_profit: 0 };
            const kpiContainer = document.getElementById('fin-kpi-cards');
            if (kpiContainer) {
                kpiContainer.innerHTML = `
                    <div class="liquid-glass-card p-3 border-l-4 border-emerald-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DOANH THU THỰC</span>
                        <div class="text-xl font-black text-emerald-400 font-mono mt-1">${this.formatMoney(summary.revenue)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Tổng thu hóa đơn hoàn tất</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-amber-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TỔNG CHI PHÍ</span>
                        <div class="text-xl font-black text-amber-400 font-mono mt-1">${this.formatMoney(summary.expenses)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Các khoản chi ghi nhận</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 ${summary.net_profit >= 0 ? 'border-sky-400' : 'border-rose-400'}">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">LỢI NHUẬN RÒNG</span>
                        <div class="text-xl font-black ${summary.net_profit >= 0 ? 'text-sky-400' : 'text-rose-400'} font-mono mt-1">${this.formatMoney(summary.net_profit)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Doanh thu trừ chi phí</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-purple-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TỶ SUẤT LỢI NHUẬN</span>
                        <div class="text-xl font-black text-purple-400 font-mono mt-1">${summary.revenue > 0 ? ((summary.net_profit / summary.revenue) * 100).toFixed(1) : '0'}%</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Hiệu quả dòng tiền</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-teal-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SỐ KHOẢN CHI</span>
                        <div class="text-xl font-black text-teal-400 font-mono mt-1">${(expRes && expRes.data) ? expRes.data.length : 0}</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Phiếu chi tháng ${month}</span>
                    </div>
                `;
            }

            const expTbody = document.getElementById('fin-expense-tbody');
            if (expTbody) {
                const list = (expRes && expRes.data) ? expRes.data : [];
                if (list.length === 0) {
                    expTbody.innerHTML = this.renderEmptyState(7, 'fa-file-invoice-dollar', 'Chưa có khoản chi nào trong kỳ', 'Bấm nút "Thêm chi phí" ở trên để ghi nhận các khoản chi phát sinh trong tháng.');
                } else {
                    let html = '';
                    list.forEach(item => {
                        html += `
                            <tr class="hover:bg-sky-500/[0.04] transition-colors">
                                <td><span class="font-mono text-xs text-slate-300 whitespace-nowrap">${item.expense_date || '-'}</span></td>
                                <td><span class="saas-badge bg-teal-500/15 text-teal-300 border border-teal-500/30 whitespace-nowrap">${item.category || 'Khác'}</span></td>
                                <td class="col-name"><span class="text-xs font-medium text-white whitespace-nowrap">${item.description || '-'}</span></td>
                                <td><span class="text-xs text-slate-400 whitespace-nowrap">${item.supplier || '-'}</span></td>
                                <td class="col-money"><span class="font-mono font-bold text-amber-300 text-xs whitespace-nowrap">${this.formatMoney(item.amount)} đ</span></td>
                                <td class="col-money"><span class="font-mono text-slate-400 text-xs whitespace-nowrap">${this.formatMoney(item.vat_amount || 0)} đ</span></td>
                                <td class="col-right">
                                    <button type="button" class="saas-action-btn btn-delete" onclick="Admin.deleteFinanceExpense(${item.id})" title="Xóa khoản chi">
                                        <i class="fas fa-trash-can text-[10px]"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                    expTbody.innerHTML = html;
                }
            }

            const expGroups = document.getElementById('fin-expense-groups');
            if (expGroups) {
                const groups = (repRes && repRes.expense_groups) ? repRes.expense_groups : [];
                if (groups.length === 0) {
                    expGroups.innerHTML = '<div class="text-xs text-slate-400 py-4 text-center italic">Chưa có phân loại chi phí trong tháng này</div>';
                } else {
                    let gHtml = '';
                    groups.forEach(g => {
                        gHtml += `
                            <div class="flex items-center justify-between text-xs py-1 border-b border-white/5">
                                <span class="text-slate-300">${g.category || 'Khác'} (${g.count} phiếu)</span>
                                <span class="font-mono font-bold text-amber-400">${this.formatMoney(g.amount)} đ</span>
                            </div>
                        `;
                    });
                    expGroups.innerHTML = gHtml;
                }
            }
        } catch (e) {
            console.error('Error loading finance:', e);
        }
    },

    async deleteFinanceExpense(id) {
        if (!confirm('Bạn có chắc muốn xóa khoản chi này không?')) return;
        try {
            const res = await fetch('api/finance.php?action=delete_expense', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                this.loadFinance();
            } else {
                alert(data.message || 'Lỗi xóa khoản chi');
            }
        } catch (e) {
            alert('Lỗi: ' + e.message);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});

