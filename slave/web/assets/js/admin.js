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
        this.loadSystemUpdates();
        setInterval(() => this.loadSystemUpdates(), 30000);
        this.enforceModuleLicenses(true);
        setInterval(() => this.enforceModuleLicenses(false), 15000);

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

    openHrSubtab(subtab) {
        this.currentOpsSubtab = subtab;
        this.switchTab('operations');
        this.currentGroup = 'hr';
        const groupStyles = {
            ops: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10',
            menu: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10',
            hr: 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sky-500/10',
            sys: 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-500/10'
        };
        ['ops', 'menu', 'hr', 'sys'].forEach(g => {
            const btn = document.getElementById(`grp-btn-${g}`);
            if (!btn) return;
            if (g === 'hr') {
                btn.className = `group-tab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 border ${groupStyles[g]}`;
            } else {
                btn.className = 'group-tab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 text-slate-400 hover:text-white hover:bg-white/5 border border-transparent';
            }
        });
        document.querySelectorAll('.subnav-group').forEach(el => {
            el.classList.toggle('hidden', el.id !== 'subnav-hr');
        });
        document.querySelectorAll('#subnav-hr .admin-sub-btn').forEach(b => {
            const match = b.dataset.hrSubtab === subtab;
            b.classList.toggle('bg-sky-500/25', match);
            b.classList.toggle('text-sky-300', match);
            b.classList.toggle('border-sky-500/40', match);
            b.classList.toggle('shadow-sm', match);
        });
        const titleEl = document.getElementById('active-tab-title');
        if (titleEl) {
            titleEl.innerHTML = subtab === 'kpi'
                ? '<i class="fas fa-bullseye text-fuchsia-400 mr-1.5"></i>KPI & Thưởng Nhân Viên'
                : '<i class="fas fa-money-check-dollar text-emerald-400 mr-1.5"></i>Chấm Công & Tiền Lương';
        }
        if (typeof this.switchOpsSubtab === 'function') {
            this.switchOpsSubtab(subtab);
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
            this.loadCardTerminalAdmin();
            this.loadWanTunnelStatus();
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
            this.loadPromotions();
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
                const rankClass = idx === 0
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40'
                    : (idx === 1
                        ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30'
                        : (idx === 2
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-400/30'
                            : 'bg-sky-500/20 text-sky-400'));
                const unitLabel = it.unit || 'phần';
                html += `
                    <div class="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/15 transition">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <span class="w-7 h-7 shrink-0 rounded-lg ${rankClass} font-bold text-xs flex items-center justify-center font-mono">#${idx + 1}</span>
                            <div class="min-w-0">
                                <h6 class="text-xs font-bold text-slate-100 truncate">${it.product_name}</h6>
                                <span class="text-[11px] text-slate-400">Đã bán: <b class="text-amber-400 font-mono">${it.total_qty}</b> ${unitLabel}</span>
                            </div>
                        </div>
                        <span class="text-xs font-black text-emerald-400 font-mono whitespace-nowrap shrink-0">${this.formatMoney(it.total_revenue)} đ</span>
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
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase whitespace-nowrap shrink-0 ${isOccupied ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}">
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
    clearOrderHistoryPreset() {
        document.querySelectorAll('.order-range-btn').forEach(b => {
            b.classList.remove('bg-sky-500/25', 'text-sky-200', 'border-sky-400/50');
            b.classList.add('bg-white/5', 'text-slate-300', 'border-white/10');
        });
    },

    setOrderHistoryRange(preset, btn) {
        const now = new Date();
        const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (preset === '7d') from.setDate(from.getDate() - 6);
        else if (preset === '14d') from.setDate(from.getDate() - 13);
        else if (preset === '1m') from.setMonth(from.getMonth() - 1);

        const fromEl = document.getElementById('history-date-from');
        const toEl = document.getElementById('history-date-to');
        if (fromEl) fromEl.value = toIso(from);
        if (toEl) toEl.value = toIso(now);

        this.clearOrderHistoryPreset();
        if (btn) {
            btn.classList.remove('bg-white/5', 'text-slate-300', 'border-white/10');
            btn.classList.add('bg-sky-500/25', 'text-sky-200', 'border-sky-400/50');
        }
        this.loadOrderHistory();
    },

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
                        <td><span class="text-xs text-slate-400 font-mono">${o.created_at ? window.formatDateDDMMYY(o.created_at, true) : '-'}</span></td>
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
                        <div>Thời gian: ${window.formatDateDDMMYY(o.created_at, true)}</div>
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
                    <div style="font-size: 11px; color: #444;">Thời gian: ${o.completed_at || o.created_at ? window.formatDateDDMMYY(o.completed_at || o.created_at, true) : ''}</div>
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
        if (!this.isModuleAllowed('cloud_sync_backup')) {
            alert('Module [cloud_sync_backup] chưa được cấp phép hoặc đã bị Master tắt/khóa!');
            return;
        }
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

    switchSettingsGroup(group) {
        const groups = document.querySelectorAll('#tab-settings .settings-group');
        groups.forEach(el => {
            const g = el.getAttribute('data-settings-group');
            el.classList.toggle('hidden', group !== 'all' && g !== group);
        });
        const btns = document.querySelectorAll('#settings-group-tabs [data-sg-btn]');
        btns.forEach(btn => {
            const active = btn.getAttribute('data-sg-btn') === group;
            if (btn.getAttribute('data-sg-btn') === 'all') {
                btn.className = active
                    ? 'px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-sky-500/25 text-sky-200 border border-sky-400/40 ml-auto transition'
                    : 'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white border border-transparent ml-auto transition';
            } else {
                btn.className = active
                    ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500/25 text-sky-200 border border-sky-400/40 transition'
                    : 'px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white border border-transparent transition';
            }
        });
        const saveRow = document.getElementById('settings-save-row');
        if (saveRow) saveRow.classList.toggle('hidden', group === 'wan');
    },

    // ========================================================
    async loadWanTunnelStatus() {
        const badge = document.getElementById('wan-tunnel-status-badge');
        const meta = document.getElementById('wan-tunnel-meta');
        const urlEl = document.getElementById('wan-master-url');
        const enEl = document.getElementById('wan-tunnel-enabled');
        if (!badge) return;
        try {
            const res = await fetch('api/wan_tunnel', { credentials: 'same-origin' });
            const json = await res.json();
            if (!json.success || !json.data) return;
            const d = json.data;
            if (urlEl && !urlEl.matches(':focus')) urlEl.value = d.master_url || '';
            if (enEl) enEl.checked = !!d.enabled;
            if (d.connected) {
                badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0';
                badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Đang Online (Master OK)';
            } else {
                badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-white/10 whitespace-nowrap shrink-0';
                badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-500"></span> Offline / Đang thử lại';
            }
            if (meta) {
                meta.textContent = `Chu kỳ Poll: ${d.poll_timeout_sec || 25}s | Heartbeat: ${d.heartbeat_interval_sec || 1800}s | PING ACK: ${d.ping_count || 0} lần (${d.last_ping_ack_at || 'chưa có'}) | Lần cuối nối: ${d.last_seen_at || 'chưa có'}${d.last_error ? ' | Lỗi: ' + d.last_error : ''}`;
            }
            const geoEl = document.getElementById('wan-net-geo-meta');
            if (geoEl && d.net_geo) {
                const ng = d.net_geo;
                const hasGeo = Number(ng.geo_lat) !== 0 && Number(ng.geo_lng) !== 0;
                const mapHref = hasGeo ? `https://www.google.com/maps?q=${ng.geo_lat},${ng.geo_lng}` : '#';
                geoEl.innerHTML = `
                    <span>LAN: <b class="text-sky-300">${ng.lan_ip || '—'}</b> &bull; WAN: <b class="text-purple-300">${ng.wan_ip || '—'}</b> &bull; Vị trí: <b class="text-emerald-300">${ng.geo_label || 'Chưa định vị'}</b> (${ng.geo_source === 'gps' ? 'GPS Chính xác' : 'Ước lượng IP'})</span>
                    ${hasGeo ? `<a href="${mapHref}" target="_blank" rel="noopener" class="text-rose-300 hover:underline font-bold"><i class="fas fa-map-location-dot mr-1"></i>Xem trên Google Maps</a>` : ''}
                `;
            }
        } catch (e) {
            if (meta) meta.textContent = 'Không lấy được trạng thái kênh WAN: ' + e.message;
        }
    },

    async pinStoreGpsLocation() {
        const saveCoords = async (lat, lng, label) => {
            const res = await fetch('api/wan_tunnel', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_location', geo_lat: lat, geo_lng: lng, geo_label: label })
            });
            const json = await res.json();
            alert(json.message || 'Đã ghim vị trí!');
            this.loadWanTunnelStatus();
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const lat = Number(pos.coords.latitude.toFixed(6));
                    const lng = Number(pos.coords.longitude.toFixed(6));
                    const label = prompt(`Đã lấy tọa độ GPS thiết bị: ${lat}, ${lng}\nNhập tên địa chỉ hiển thị ngắn (VD: Thủ Đức, TP.HCM):`, '');
                    if (label !== null) await saveCoords(lat, lng, label.trim());
                },
                async () => {
                    const input = prompt('Trình duyệt không cấp quyền GPS.\nHãy dán link Google Maps (có @lat,lng) hoặc nhập tọa độ (VD: 10.85063, 106.77191):', '');
                    if (!input) return;
                    const m = input.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
                    if (!m) { alert('Tọa độ không hợp lệ!'); return; }
                    const label = prompt('Tên địa điểm ngắn gọn:', '') || '';
                    await saveCoords(parseFloat(m[1]), parseFloat(m[2]), label.trim());
                },
                { enableHighAccuracy: true, timeout: 6000 }
            );
        }
    },

    async saveWanTunnelConfig() {
        const url = (document.getElementById('wan-master-url')?.value || '').trim();
        const enabled = !!document.getElementById('wan-tunnel-enabled')?.checked;
        if (!url) {
            alert('Vui lòng nhập địa chỉ Master Server URL!');
            return;
        }
        try {
            const res = await fetch('api/wan_tunnel', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save', master_server_url: url, enabled })
            });
            const json = await res.json();
            alert(json.message || 'Đã cập nhật cấu hình kết nối Master!');
            setTimeout(() => this.loadWanTunnelStatus(), 1200);
        } catch (e) {
            alert('Lỗi lưu cấu hình WAN: ' + e.message);
        }
    },

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
        ['realtime', 'inventory', 'payroll', 'kpi'].forEach(s => {
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
        const subviewReqMod = {
            inventory: 'inventory_recipes',
            payroll: 'staff_shifts',
            kpi: 'staff_kpi'
        }[subtab];
        if (subviewReqMod && !this.isModuleAllowed(subviewReqMod)) {
            this.applySubviewLicenseLock(subtab, subviewReqMod, false);
            return;
        }
        if (subtab === 'inventory') this.loadMaterials();
        if (subtab === 'payroll') this.loadPayroll();
        if (subtab === 'kpi' && typeof this.loadKpi === 'function') this.loadKpi();
    },

    toggleKpiConfigPanel() {
        const panel = document.getElementById('kpi-config-panel');
        if (panel) panel.classList.toggle('hidden');
    },

    async askAiCopilot(presetQuestion = '') {
        const inp = document.getElementById('ai-copilot-input');
        const out = document.getElementById('ai-copilot-answer');
        const q = (presetQuestion || inp?.value || '').trim() || 'Tóm tắt tình hình kinh doanh hôm nay';
        if (inp && presetQuestion) inp.value = presetQuestion;
        if (!out) return;
        out.classList.remove('hidden');
        out.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5 text-purple-300"></i> Đang phân tích dữ liệu quán...';
        try {
            const res = await fetch('/api/ai/copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q, use_ai: true })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi AI Copilot');
            const meta = data.credits_charged > 0
                ? `<div class="mt-2 pt-1.5 border-t border-white/10 text-[10px] text-purple-300 font-mono">⚡ ${data.engine} · Đã dùng ${data.credits_charged} AI Credit</div>`
                : `<div class="mt-2 pt-1.5 border-t border-white/10 text-[10px] text-emerald-300 font-mono">⚡ ${data.engine} · Miễn phí (Offline)</div>`;
            out.innerHTML = `<div>${(data.answer || '').replace(/</g, '&lt;')}</div>${meta}`;
        } catch (e) {
            out.innerHTML = `<span class="text-rose-300">${e.message || 'Không thể kết nối AI Copilot'}</span>`;
        }
    },

    async testAndSaveTelegramBot() {
        const telegram_bot_token = (document.getElementById('setting-tg-token')?.value || '').trim();
        const telegram_chat_id = (document.getElementById('setting-tg-chat-id')?.value || '').trim();
        try {
            const res = await fetch('/api/telegram/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegram_bot_token, telegram_chat_id })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi gửi Telegram');
            this.showToast(data.message || 'Đã gửi tin nhắn thử Telegram!', 'success');
        } catch (e) {
            alert(e.message || 'Lỗi cấu hình Telegram Bot');
        }
    },

    async loadRouterDevices() {
        try {
            const [cfgRes, devRes] = await Promise.all([
                fetch('/api/network/config').then(r => r.json()).catch(() => ({})),
                fetch('/api/network/devices').then(r => r.json()).catch(() => ({}))
            ]);
            if (cfgRes && cfgRes.config) {
                const c = cfgRes.config;
                if (document.getElementById('rq-type')) document.getElementById('rq-type').value = c.router_type || 'simulation';
                if (document.getElementById('rq-host')) document.getElementById('rq-host').value = c.host || '';
                if (document.getElementById('rq-port')) document.getElementById('rq-port').value = c.port || 22;
                if (document.getElementById('rq-user')) document.getElementById('rq-user').value = c.username || '';
                if (document.getElementById('rq-free-min')) document.getElementById('rq-free-min').value = c.free_minutes ?? 10;
                if (document.getElementById('rq-vip-min')) document.getElementById('rq-vip-min').value = c.vip_minutes ?? 180;
                if (document.getElementById('rq-max-dev')) document.getElementById('rq-max-dev').value = c.max_devices_per_order ?? 2;
                if (document.getElementById('rq-peak-windows')) document.getElementById('rq-peak-windows').value = c.peak_windows !== undefined ? c.peak_windows : '08:00-11:30, 18:30-22:00';
                if (document.getElementById('rq-throttle70')) document.getElementById('rq-throttle70').checked = c.throttle_after_70_pct !== false;
            }
            const fmtRem = (sec) => {
                if (!sec || sec <= 0) return '';
                const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
                return ' • còn ' + (h > 0 ? `${h}g ` : '') + `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            };
            const listEl = document.getElementById('router-qos-devices-list');
            if (listEl && devRes && Array.isArray(devRes.devices)) {
                if (devRes.devices.length === 0) {
                    const notice = devRes.message || 'Chưa phát hiện thiết bị LAN nào từ Router.';
                    listEl.innerHTML = `<div class="p-2.5 rounded-lg bg-slate-900/60 border border-white/10 text-[11px] text-slate-400">${escapeHtml(notice)}</div>`;
                } else {
                    listEl.innerHTML = devRes.devices.map(d => {
                        const tier = d.tier || d.qos || 'free';
                        const remTxt = fmtRem(Number(d.remaining_sec || 0));
                        const stageTxt = Number(d.stage) === 2 ? ' (Giảm >90%)' : (Number(d.stage) === 1 ? ' (Giảm >70%)' : '');
                        const qBadge = d.whitelisted || tier === 'whitelist'
                            ? '<span class="ml-1.5 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">Nội bộ ∞</span>'
                            : (tier === 'vip' || tier === 'vip_high_speed'
                                ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">VIP${escapeHtml(remTxt)}${escapeHtml(stageTxt)}</span>`
                                : (tier === 'blocked'
                                    ? '<span class="ml-1.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">Đã ngắt</span>'
                                    : `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-bold">Free${escapeHtml(remTxt)}</span>`));
                        return `
                    <div class="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/70 border border-white/10 text-[11px]">
                        <div>
                            <b class="text-white">${escapeHtml(d.name || 'Thiết bị')}</b>
                            <span class="font-mono text-sky-300 ml-1.5">${escapeHtml(d.ip)}</span>
                            <span class="font-mono text-slate-400 ml-1">(${escapeHtml(d.mac || '')})</span>
                            ${qBadge}
                        </div>
                        <div class="flex items-center gap-1.5">
                            <button type="button" onclick="Admin.toggleDeviceWhitelist('${escapeHtml(d.ip)}')" class="px-2 py-0.5 rounded ${d.whitelisted ? 'bg-sky-500 text-slate-950' : 'bg-sky-500/20 hover:bg-sky-500/35 text-sky-300'} font-bold" title="Ghim thiết bị nội bộ không giới hạn thời gian">Nội bộ ∞</button>
                            <button type="button" onclick="Admin.setDeviceQos('${escapeHtml(d.ip)}', 'vip_high_speed')" class="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 font-bold">VIP</button>
                            <button type="button" onclick="Admin.setDeviceQos('${escapeHtml(d.ip)}', 'free_basic')" class="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 font-bold">Free</button>
                            <button type="button" onclick="Admin.setDeviceQos('${escapeHtml(d.ip)}', 'blocked')" class="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 font-bold">Ngắt</button>
                        </div>
                    </div>`;
                    }).join('');
                }
            }
        } catch (e) {}
    },

    async saveRouterQosConfig() {
        try {
            const payload = {
                router_type: document.getElementById('rq-type')?.value || 'simulation',
                host: (document.getElementById('rq-host')?.value || '').trim(),
                port: Number(document.getElementById('rq-port')?.value || 22),
                username: (document.getElementById('rq-user')?.value || '').trim(),
                password: document.getElementById('rq-pass')?.value || '',
                free_minutes: Math.max(1, Number(document.getElementById('rq-free-min')?.value || 10)),
                vip_minutes: Math.max(5, Number(document.getElementById('rq-vip-min')?.value || 180)),
                max_devices_per_order: Math.max(1, Number(document.getElementById('rq-max-dev')?.value || 2)),
                peak_windows: (document.getElementById('rq-peak-windows')?.value || '').trim(),
                throttle_after_70_pct: !!document.getElementById('rq-throttle70')?.checked
            };
            const res = await fetch('/api/network/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast(data.message || 'Đã lưu cấu hình WiFi Marketing!', 'success');
                this.loadRouterDevices();
            }
        } catch (e) { alert('Lỗi lưu cấu hình Router'); }
    },

    async toggleDeviceWhitelist(ip) {
        try {
            const res = await fetch('/api/network/whitelist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip })
            });
            const data = await res.json();
            this.showToast(data.message || 'Đã cập nhật Whitelist', data.status === 'success' ? 'success' : 'error');
            this.loadRouterDevices();
        } catch (e) { alert('Lỗi cập nhật Whitelist'); }
    },

    async exportWifiLeadsCsv() {
        try {
            const token = localStorage.getItem('pos_token') || '';
            const res = await fetch('/api/wifi/leads', {
                headers: token ? { 'Authorization': 'Bearer ' + token } : {}
            });
            const json = await res.json();
            if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
                alert('Chưa có dữ liệu khách WiFi Marketing để xuất.');
                return;
            }
            const rows = [['ID', 'Ten Khach', 'SDT', 'IP', 'Loai', 'Ma Hoa Don', 'Thoi Gian']];
            json.data.forEach(r => rows.push([r.id, r.customer_name || '', r.phone || '', r.client_ip || '', r.unlock_type || '', r.order_code || '', r.created_at || '']));
            const csv = '\uFEFF' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `wifi_leads_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
        } catch (e) { alert('Không thể xuất CSV Leads'); }
    },

    async setDeviceQos(ip, qos) {
        try {
            const res = await fetch('/api/network/qos/set', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip, qos })
            });
            const data = await res.json();
            this.showToast(data.message || `Đã đặt ${qos} cho ${ip}`, data.status === 'success' ? 'success' : 'error');
        } catch (e) { alert('Lỗi cập nhật QoS'); }
    },

    openBillingModal() {
        const m = document.getElementById('modal-store-billing');
        if (m) m.classList.remove('hidden');
        document.getElementById('billing-qr-result')?.classList.add('hidden');
        this.onBillingTypeChange();
    },

    closeBillingModal() {
        if (this._billingPollTimer) {
            clearInterval(this._billingPollTimer);
            this._billingPollTimer = null;
        }
        document.getElementById('modal-store-billing')?.classList.add('hidden');
    },

    onBillingTypeChange() {
        const t = document.getElementById('billing-type-select')?.value || 'renew_plan';
        const q = document.getElementById('billing-qty-select');
        if (!q) return;
        q.innerHTML = t === 'buy_ai_credits'
            ? `<option value="100">+100 Credits (100.000đ)</option>
               <option value="300">+300 Credits (300.000đ)</option>
               <option value="500">+500 Credits (450.000đ)</option>
               <option value="1000">+1.000 Credits (800.000đ)</option>`
            : `<option value="1">1 Tháng (299.000đ)</option>
               <option value="3">3 Tháng (897.000đ)</option>
               <option value="6">6 Tháng - Giảm 10% (1.614.600đ)</option>
               <option value="12">12 Tháng - Giảm 15% (3.049.800đ)</option>`;
    },

    async createStoreBillingOrder() {
        const billing_type = document.getElementById('billing-type-select')?.value || 'renew_plan';
        const quantity = Number(document.getElementById('billing-qty-select')?.value || 1);
        try {
            const res = await fetch('api/license_client?action=create_billing_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ billing_type, quantity })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Không tạo được mã thanh toán');
            document.getElementById('billing-qr-img').src = data.vietqr_url;
            document.getElementById('billing-qr-amount').textContent = this.formatMoney(data.amount_vnd) + ' đ';
            document.getElementById('billing-qr-note').textContent = data.bank_info?.note || data.order_code;
            const stEl = document.getElementById('billing-qr-status');
            if (stEl) {
                stEl.textContent = `⏳ Đang chờ xác nhận thanh toán (${data.order_code})...`;
                stEl.className = 'text-xs font-bold text-sky-300 p-2 rounded-lg bg-sky-500/10 border border-sky-500/30';
            }
            document.getElementById('billing-qr-result')?.classList.remove('hidden');
            if (this._billingPollTimer) clearInterval(this._billingPollTimer);
            this._billingPollTimer = setInterval(() => this.pollStoreBillingOrder(data.order_code), 3500);
        } catch (e) {
            alert(e.message || 'Lỗi tạo đơn VietQR');
        }
    },

    async pollStoreBillingOrder(orderCode) {
        if (!orderCode) return;
        try {
            const res = await fetch(`api/license_client?action=check_billing_order&order_code=${encodeURIComponent(orderCode)}`);
            const data = await res.json();
            if (data.success && data.order && data.order.status === 'paid') {
                clearInterval(this._billingPollTimer);
                this._billingPollTimer = null;
                const stEl = document.getElementById('billing-qr-status');
                if (stEl) {
                    stEl.textContent = '✅ Thanh toán thành công! Đã tự động gia hạn / cộng AI Credit.';
                    stEl.className = 'text-xs font-bold text-emerald-300 p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30';
                }
                if (typeof this.loadSettings === 'function') this.loadSettings();
            }
        } catch (e) {}
    },

    async loadKpi() {
        const monthInput = document.getElementById('kpi-month-input');
        if (monthInput && !monthInput.value) {
            const d = new Date();
            monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
        const month = monthInput ? monthInput.value : '';
        try {
            const res = await fetch(`api/operations.php?action=get_kpi_dashboard&month=${encodeURIComponent(month)}`);
            const data = await res.json();
            if (!data.success) return;

            const activeSla = data.active_sla || {};
            const slaBadge = document.getElementById('kpi-active-sla-badge');
            if (slaBadge) {
                slaBadge.innerHTML = `<i class="fas fa-clock mr-1"></i> ${activeSla.label || 'Mặc định'}: Bếp <b>${activeSla.kitchen_sla_minutes || 10}p</b> · PV <b>${activeSla.waiter_sla_minutes || 3}p</b>`;
                slaBadge.className = activeSla.is_peak
                    ? 'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30';
            }

            const revSum = data.review_summary || {};
            const avgBadge = document.getElementById('kpi-avg-rating-badge');
            if (avgBadge) {
                avgBadge.innerHTML = `⭐ ${Number(revSum.avg_rating || 0).toFixed(1)} / 5 (${revSum.total_reviews || 0} đánh giá)`;
            }

            const s = data.settings || {};
            const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
            setVal('cfg-default-kitchen-sla', s.default_kitchen_sla ?? 10);
            setVal('cfg-default-waiter-sla', s.default_waiter_sla ?? 3);
            setVal('cfg-kpi-base', s.kpi_base_score ?? 100);
            setVal('cfg-kitchen-ontime', s.kpi_kitchen_ontime_pts ?? 2);
            setVal('cfg-kitchen-rush-pen', s.kpi_kitchen_rush_penalty ?? 5);
            setVal('cfg-waiter-ontime', s.kpi_waiter_ontime_pts ?? 2);
            setVal('cfg-waiter-remind-pen', s.kpi_waiter_remind_penalty ?? 3);
            setVal('cfg-star-5', s.kpi_star_5_pts ?? 5);
            setVal('cfg-star-4', s.kpi_star_4_pts ?? 2);
            setVal('cfg-star-3', s.kpi_star_3_pts ?? 0);
            setVal('cfg-star-2', s.kpi_star_2_pts ?? -3);
            setVal('cfg-star-1', s.kpi_star_1_pts ?? -5);

            const rulesNote = document.getElementById('kpi-rules-note');
            if (rulesNote) {
                rulesNote.innerHTML = `Quy tắc hiện tại: Nền <b>${s.kpi_base_score ?? 100}đ</b> · Bếp đúng hạn <b class="text-emerald-300">+${s.kpi_kitchen_ontime_pts ?? 2}</b> · Bị hối <b class="text-rose-300">-${s.kpi_kitchen_rush_penalty ?? 5}</b> · PV đúng hạn <b class="text-emerald-300">+${s.kpi_waiter_ontime_pts ?? 2}</b> · Bị Báo lại <b class="text-rose-300">-${s.kpi_waiter_remind_penalty ?? 3}</b> · Khách đánh giá 5⭐ <b class="text-amber-300">+${s.kpi_star_5_pts ?? 5}</b> / 1⭐ <b class="text-rose-300">${s.kpi_star_1_pts ?? -5}</b>.`;
            }

            // Render SLA Time Slots
            const slotsEl = document.getElementById('kpi-sla-slots-list');
            if (slotsEl) {
                const slots = data.sla_slots || [];
                slotsEl.innerHTML = slots.length === 0
                    ? '<div class="text-[11px] text-slate-500 italic">Chưa có khung giờ riêng (đang dùng mặc định thấp điểm).</div>'
                    : slots.map(sl => `
                        <div class="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/70 border border-white/10 text-xs">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${sl.slot_type === 'peak' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'}">${sl.slot_type === 'peak' ? 'Cao điểm' : 'Thấp điểm'}</span>
                                <b class="text-white">${sl.name}</b>
                                <span class="font-mono text-amber-300">${sl.start_time} - ${sl.end_time}</span>
                                <span class="text-slate-400">Bếp: <b class="text-white">${sl.kitchen_sla_minutes}p</b> · PV: <b class="text-white">${sl.waiter_sla_minutes}p</b></span>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" onclick="Admin.toggleSlaSlot(${sl.id}, '${sl.name.replace(/'/g, "\\'")}', '${sl.slot_type}', '${sl.start_time}', '${sl.end_time}', ${sl.kitchen_sla_minutes}, ${sl.waiter_sla_minutes}, ${sl.is_active ? 0 : 1})" class="px-2 py-0.5 rounded text-[10px] font-bold ${sl.is_active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'}">${sl.is_active ? 'Đang bật' : 'Đang tắt'}</button>
                                <button type="button" onclick="Admin.deleteSlaSlot(${sl.id})" class="text-rose-400 hover:text-rose-300 px-1.5 py-0.5" title="Xóa khung giờ"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('');
            }

            // Render Staff KPI Table
            const tbody = document.getElementById('kpi-tbody');
            if (tbody) {
                const staff = data.staff_kpi || [];
                const roleLabel = { admin: 'Chủ quán', cashier: 'Thu ngân', waiter: 'Phục vụ', kitchen: 'Bếp / Pha chế' };
                tbody.innerHTML = staff.map(st => {
                    const delta = Number(st.delta_points || 0);
                    const score = Number(st.kpi_score || 100);
                    const penCount = Number(st.rushed_count || 0) + Number(st.reminded_count || 0);
                    return `
                        <tr class="hover:bg-white/5">
                            <td class="py-2.5 px-3 font-bold text-white">${st.fullname} <span class="text-[10px] text-slate-400 font-normal">(@${st.username})</span></td>
                            <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">${roleLabel[st.role] || st.role}</span></td>
                            <td class="py-2.5 px-3 text-center font-mono text-sky-300">${st.orders_count || 0}</td>
                            <td class="py-2.5 px-3 text-center font-mono text-emerald-400 font-bold">${st.ontime_count || 0}</td>
                            <td class="py-2.5 px-3 text-center font-mono ${penCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}">${penCount}</td>
                            <td class="py-2.5 px-3 text-center font-mono text-amber-300">${st.review_count || 0}</td>
                            <td class="py-2.5 px-3 text-center font-mono font-bold ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${delta >= 0 ? '+' + delta : delta}</td>
                            <td class="py-2.5 px-3 text-right font-mono font-black text-sm ${score >= 100 ? 'text-emerald-400' : (score >= 80 ? 'text-amber-300' : 'text-rose-400')}">${score}</td>
                        </tr>
                    `;
                }).join('') || '<tr><td colspan="8" class="py-6 text-center text-slate-500">Chưa có dữ liệu nhân viên</td></tr>';
            }

            // Render KPI Logs
            const logsEl = document.getElementById('kpi-logs-tbody');
            if (logsEl) {
                const logs = data.recent_logs || [];
                logsEl.innerHTML = logs.length === 0
                    ? '<tr><td colspan="4" class="py-4 text-center text-slate-500">Chưa có biến động KPI trong kỳ này.</td></tr>'
                    : logs.map(l => {
                        const d = Number(l.points_delta || 0);
                        return `
                            <tr class="hover:bg-white/5">
                                <td class="py-1.5 px-2 font-semibold text-white">${l.user_name || 'Hệ thống'}</td>
                                <td class="py-1.5 px-2 text-slate-300">${l.note || l.event_type} <span class="font-mono text-[10px] text-sky-400">${l.order_code || ''}</span></td>
                                <td class="py-1.5 px-2 text-right font-mono font-bold ${d >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${d >= 0 ? '+' + d : d}</td>
                                <td class="py-1.5 px-2 text-right font-mono text-slate-400">${(l.created_at || '').substring(11, 16)}</td>
                            </tr>
                        `;
                    }).join('');
            }

            // Render Customer Reviews
            const revEl = document.getElementById('kpi-reviews-list');
            if (revEl) {
                const revs = data.recent_reviews || [];
                revEl.innerHTML = revs.length === 0
                    ? '<div class="py-4 text-center text-xs text-slate-500">Chưa có đánh giá sao từ khách hàng trong kỳ này.</div>'
                    : revs.map(r => `
                        <div class="p-2.5 rounded-lg bg-slate-900/70 border border-white/10 text-xs space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="text-amber-400 font-bold">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                                <span class="text-[10px] font-mono text-slate-400">${r.table_code || ''} • ${r.order_code || ''} • ${(r.created_at || '').substring(0, 16)}</span>
                            </div>
                            ${r.comment ? `<div class="text-slate-300 italic">"${r.comment}"</div>` : '<div class="text-[10px] text-slate-500">Không có nhận xét thêm</div>'}
                        </div>
                    `).join('');
            }
        } catch (err) {
            console.error('loadKpi error:', err);
        }
    },

    async saveKpiSlaSettings() {
        const g = (id, def) => Number(document.getElementById(id)?.value ?? def);
        try {
            const res = await fetch('api/operations.php?action=save_kpi_sla_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    default_kitchen_sla: g('cfg-default-kitchen-sla', 10),
                    default_waiter_sla: g('cfg-default-waiter-sla', 3),
                    kpi_base_score: g('cfg-kpi-base', 100),
                    kpi_kitchen_ontime_pts: g('cfg-kitchen-ontime', 2),
                    kpi_kitchen_rush_penalty: g('cfg-kitchen-rush-pen', 5),
                    kpi_waiter_ontime_pts: g('cfg-waiter-ontime', 2),
                    kpi_waiter_remind_penalty: g('cfg-waiter-remind-pen', 3),
                    kpi_star_5_pts: g('cfg-star-5', 5),
                    kpi_star_4_pts: g('cfg-star-4', 2),
                    kpi_star_3_pts: g('cfg-star-3', 0),
                    kpi_star_2_pts: g('cfg-star-2', -3),
                    kpi_star_1_pts: g('cfg-star-1', -5)
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi lưu cấu hình');
            this.showToast(data.message || 'Đã lưu cấu hình KPI & SLA!', 'success');
            this.loadKpi();
        } catch (e) {
            alert(e.message || 'Lỗi lưu cấu hình KPI');
        }
    },

    async addSlaSlot() {
        const name = (document.getElementById('sla-slot-name')?.value || '').trim();
        const slot_type = document.getElementById('sla-slot-type')?.value || 'peak';
        const start_time = document.getElementById('sla-slot-start')?.value || '';
        const end_time = document.getElementById('sla-slot-end')?.value || '';
        const kitchen_sla_minutes = Number(document.getElementById('sla-slot-kitchen')?.value || 15);
        const waiter_sla_minutes = Number(document.getElementById('sla-slot-waiter')?.value || 5);
        if (!name || !start_time || !end_time) {
            alert('Vui lòng nhập Tên khung giờ, Giờ bắt đầu và Giờ kết thúc!');
            return;
        }
        try {
            const res = await fetch('api/operations.php?action=save_sla_slot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, slot_type, start_time, end_time, kitchen_sla_minutes, waiter_sla_minutes, is_active: 1 })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi thêm khung giờ');
            document.getElementById('sla-slot-name').value = '';
            this.showToast('Đã thêm khung giờ SLA!', 'success');
            this.loadKpi();
        } catch (e) {
            alert(e.message || 'Lỗi thêm khung giờ');
        }
    },

    async toggleSlaSlot(id, name, slot_type, start_time, end_time, kitchen_sla_minutes, waiter_sla_minutes, is_active) {
        try {
            const res = await fetch('api/operations.php?action=save_sla_slot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name, slot_type, start_time, end_time, kitchen_sla_minutes, waiter_sla_minutes, is_active })
            });
            const data = await res.json();
            if (data.success) this.loadKpi();
        } catch (e) {}
    },

    async deleteSlaSlot(id) {
        if (!confirm('Xóa khung giờ SLA này?')) return;
        try {
            const res = await fetch('api/operations.php?action=delete_sla_slot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) this.loadKpi();
        } catch (e) {}
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});

