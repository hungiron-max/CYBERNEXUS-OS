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
        window.CN_SERVER_LAN_BASE_URL = live;
        return live;
    }
    const cached = window.CN_SERVER_LAN_BASE_URL || '';
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
            alert((window.cnxT?window.cnxT('js.s_adm.84723e8c','Không thể tải hình ảnh để cắt xén. Vui lòng kiểm tra lại file hoặc đường dẫn ảnh!'):'Không thể tải hình ảnh để cắt xén. Vui lòng kiểm tra lại file hoặc đường dẫn ảnh!'));
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

    togglePasswordView(inputId, btn) {
        const inp = document.getElementById(inputId);
        if (!inp) return;
        const isPwd = inp.type === 'password';
        inp.type = isPwd ? 'text' : 'password';
        if (btn) {
            const ic = btn.querySelector('i');
            if (ic) ic.className = isPwd ? 'fas fa-eye-slash' : 'fas fa-eye';
        }
    },

    toggleGeminiKeyEdit() {
        const inp = document.getElementById('set-gemini-key');
        if (!inp) return;
        inp.readOnly = !inp.readOnly;
        inp.type = inp.readOnly ? 'password' : 'text';
        if (!inp.readOnly) inp.focus();
    },

    openDeviceCamera() {
        const inp = document.getElementById('import-invoice-file') || document.querySelector('input[type="file"][accept*="image"]');
        if (inp) {
            inp.setAttribute('capture', 'environment');
            inp.click();
        }
    },

    async init() {
        this.bindNavigation();
        const rawHash = (window.location.hash || '').replace(/^#/, '').trim();
        let savedTab = '';
        try { savedTab = sessionStorage.getItem('cn_admin_active_tab') || ''; } catch (e) {}
        const initHash = rawHash || savedTab;
        if (initHash === 'payroll' || initHash === 'kpi') {
            this.openHrSubtab(initHash);
        } else if (initHash === 'inventory') {
            this.switchTab('operations');
        } else if (['dashboard', 'tables', 'orders', 'finance', 'products', 'categories', 'users', 'analytics', 'media', 'settings'].includes(initHash)) {
            this.switchTab(initHash);
        } else {
            this.switchTab('dashboard');
        }
        try {
            if (window.location.hash || window.location.pathname.endsWith('.html')) {
                history.replaceState(null, '', '/admin');
            }
        } catch (e) {}
        await this.loadCategories();
        await this.loadDashboard();
        await this.loadProducts();
        await this.loadTables();
        this.startAdminAlertPolling();
        this.initDishImageDrop();
        this.loadSystemUpdates();
        this.enforceModuleLicenses(true);
        let _licPollInFlight = false;
        setInterval(async () => {
            if (document.hidden || _licPollInFlight) return;
            _licPollInFlight = true;
            try { await this.enforceModuleLicenses(false); } finally { _licPollInFlight = false; }
        }, 60000);

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
                            window.CN_SERVER_LAN_BASE_URL = lanBase;
                        }
                    }
                })
                .catch((errIgnored) => { (window.CyberSecurity ? CyberSecurity.logSilentError('admin.js', errIgnored) : console.debug('admin.js', errIgnored)); });
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin.js', e) : console.debug('admin.js', e)); }

        // Check if query string requests cloud sync modal
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('open_sync') === '1') {
            this.openCloudSyncModal();
        }

        // Định kỳ gửi heartbeat giữ trạng thái trực tuyến cho Admin
        let _hbInFlight = false;
        const sendAdminHeartbeat = async () => {
            if (_hbInFlight) return;
            _hbInFlight = true;
            try {
                await fetch('api/auth.php?action=heartbeat');
            } catch (errIgnored) {
                (window.CyberSecurity ? CyberSecurity.logSilentError('admin.js', errIgnored) : console.debug('admin.js', errIgnored));
            } finally {
                _hbInFlight = false;
            }
        };
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
            if (artistEl) artistEl.textContent = state.currentTrack.track_artist || (window.cnxT?window.cnxT('js.s_adm.fad65698','Hệ thống'):'Hệ thống');
        } else {
            if (window.JukeboxEngine) {
                window.JukeboxEngine.updateTitleWithMarquee('admin-juke-title', (window.cnxT?window.cnxT('ui.adm_html.div_ffa49ba2','Jukebox Âm Nhạc'):'Jukebox Âm Nhạc'));
            } else if (titleEl) {
                titleEl.textContent = (window.cnxT?window.cnxT('ui.adm_html.div_ffa49ba2','Jukebox Âm Nhạc'):'Jukebox Âm Nhạc');
            }
            if (artistEl) artistEl.textContent = (window.cnxT?window.cnxT('ui.adm_html.div_5db208a0','Hệ thống sẵn sàng'):'Hệ thống sẵn sàng');
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
            if (ctrlText) ctrlText.textContent = (window.cnxT?window.cnxT('js.s_adm.32be569f','Tạm Dừng'):'Tạm Dừng');
            if (vinylIcon) vinylIcon.className = 'fas fa-pause text-[9px] text-white';
            if (vinylDisc) vinylDisc.classList.add('animate-spin');
        } else {
            if (disc) disc.classList.remove('animate-spin');
            if (playIcon) playIcon.className = 'fas fa-play text-[10px] text-white';
            if (ctrlIcon) ctrlIcon.className = 'fas fa-play text-xs text-sky-300';
            if (ctrlText) ctrlText.textContent = (window.cnxT?window.cnxT('ui.adm_html.span_5f57eb43','Phát'):'Phát');
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

        // 3. Switch to specified tab or first visible/licensed subtab of this group
        if (defaultTab) {
            this.switchTab(defaultTab);
        } else {
            const firstTabMap = {
                ops: 'dashboard',
                menu: 'products',
                hr: 'users',
                sys: 'settings'
            };
            const visibleBtn = targetSubnav
                ? Array.from(targetSubnav.querySelectorAll('.admin-sub-btn')).find(b => b.style.display !== 'none')
                : null;
            const firstTab = (visibleBtn && visibleBtn.dataset && visibleBtn.dataset.tab) ? visibleBtn.dataset.tab : firstTabMap[group];
            if (firstTab) this.switchTab(firstTab);
        }
    },

    openHrSubtab(subtab) {
        this._fromHrSubtab = true;
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
                : (window.cnxT?window.cnxT('js.s_adm.51073aa4','<i class="fas fa-money-check-dollar text-emerald-400 mr-1.5"></i>Chấm Công & Tiền Lương'):'<i class="fas fa-money-check-dollar text-emerald-400 mr-1.5"></i>Chấm Công & Tiền Lương');
        }
        if (typeof this.switchOpsSubtab === 'function') {
            this.switchOpsSubtab(subtab);
        }
    },

    switchTab(tab) {
        const tabModMap = { media: 'mod_media_stream', users: 'staff_shifts', analytics: 'advanced_reports', finance: 'finance_reports' };
        if (tabModMap[tab] && Array.isArray(this._licensedModules) && typeof this.isModuleAllowed === 'function' && !this.isModuleAllowed(tabModMap[tab])) {
            const fallbackGroup = (tab === 'finance' || tab === 'media') ? 'sys' : 'hr';
            const subnav = document.getElementById(`subnav-${fallbackGroup}`);
            const visBtn = subnav ? Array.from(subnav.querySelectorAll('.admin-sub-btn')).find(b => b.style.display !== 'none' && b.dataset.tab !== tab) : null;
            if (visBtn && visBtn.dataset.tab) {
                tab = visBtn.dataset.tab;
            } else {
                if (typeof this.toast === 'function') this.toast((window.cnxT?window.cnxT('js.s_adm.860c8427','Module này chưa được cấp phép trên Master.'):'Module này chưa được cấp phép trên Master.'), 'warning');
                return;
            }
        }
        this.currentTab = tab;

        const tabMeta = {
            tables: { title: (window.cnxT?window.cnxT('ui.admin_html.button_22d645f2','Bàn & Khu Vực (QR)'):'Bàn & Khu Vực (QR)'), group: 'ops', icon: 'fa-border-all text-emerald-400' },
            dashboard: { title: (window.cnxT?window.cnxT('ui.admin_html.button_1d1d071c','Tổng Quan Doanh Số'):'Tổng Quan Doanh Số'), group: 'ops', icon: 'fa-chart-line text-sky-400' },
            orders: { title: (window.cnxT?window.cnxT('ui.admin_html.button_a0445595','Lịch Sử Hóa Đơn'):'Lịch Sử Hóa Đơn'), group: 'ops', icon: 'fa-receipt text-amber-400' },
            products: { title: (window.cnxT?window.cnxT('ui.admin_html.button_ef181296','Mặt Hàng (F4)'):'Mặt Hàng (F4)'), group: 'menu', icon: 'fa-utensils text-amber-400' },
            categories: { title: (window.cnxT?window.cnxT('ui.admin_html.button_8ac5a885','Nhóm Hàng'):'Nhóm Hàng'), group: 'menu', icon: 'fa-layer-group text-sky-400' },
            operations: { title: (window.cnxT?window.cnxT('ui.admin_html.button_f4c93777','Kho & Chi Phí Vật Liệu'):'Kho & Chi Phí Vật Liệu'), group: 'menu', icon: 'fa-boxes-stacked text-emerald-400' },
            users: { title: (window.cnxT?window.cnxT('ui.admin_html.button_bc446524','Nhân Viên & Phân Quyền'):'Nhân Viên & Phân Quyền'), group: 'hr', icon: 'fa-users-gear text-indigo-400' },
            analytics: { title: (window.cnxT?window.cnxT('ui.admin_html.button_ee04a70c','Hiệu Suất Bếp & Phục Vụ'):'Hiệu Suất Bếp & Phục Vụ'), group: 'hr', icon: 'fa-chart-pie text-amber-400' },
            finance: { title: 'Tài Chính & Kiểm Toán Ca', group: 'ops', icon: 'fa-shield-halved text-teal-400' },
            media: { title: (window.cnxT?window.cnxT('ui.admin_html.button_44a3df46','Âm Nhạc & Jukebox'):'Âm Nhạc & Jukebox'), group: 'sys', icon: 'fa-compact-disc text-fuchsia-400' },
            settings: { title: (window.cnxT?window.cnxT('ui.admin_html.button_dc2cd84b','Cài Đặt Quán & VietQR'):'Cài Đặt Quán & VietQR'), group: 'sys', icon: 'fa-cog text-sky-400' }
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
        if (tab === 'operations') {
            if (!this._fromHrSubtab) this.currentOpsSubtab = 'inventory';
            this._fromHrSubtab = false;
            this.loadOperationsTab();
        }
        try {
            const hashKey = (tab === 'operations' && this.currentOpsSubtab) ? this.currentOpsSubtab : tab;
            sessionStorage.setItem('cn_admin_active_tab', hashKey);
            if (window.location.hash) {
                history.replaceState(null, '', '/admin');
            }
        } catch (e) {}
        if (tab === 'finance') this.loadFinance();
        if (tab === 'settings') {
            if (typeof loadStoreSettings === 'function') loadStoreSettings();
            this.loadCardTerminalAdmin();
            this.loadWanTunnelStatus();
            if (typeof this.loadRouterDevices === 'function') this.loadRouterDevices();
        }
        if (tab === 'media') {
            this.loadMediaTab();
            this.startEqWaveAnimation();
        } else {
            this.stopEqWaveAnimation();
        }

        // Keep continuous background synchronization active across all tabs
        if (!this.mediaPollingTimer) {
            this._mediaPollInFlight = false;
            this.mediaPollingTimer = setInterval(async () => {
                if (document.hidden || this._mediaPollInFlight) return;
                this._mediaPollInFlight = true;
                try {
                    if (window.JukeboxEngine) {
                        await window.JukeboxEngine.refreshStatus();
                    } else {
                        await this.loadMediaJukeboxStatus();
                    }
                } finally {
                    this._mediaPollInFlight = false;
                }
            }, 3500);
        }
    },

    startAdminAlertPolling() {
        if (this._adminAlertTimer) clearInterval(this._adminAlertTimer);
        const poll = async () => {
            try {
                const res = await fetch('/api/operations.php?action=admin_alerts', { cache: 'no-store' });
                const data = await res.json();
                if (!data || !data.success) return;
                const alerts = Array.isArray(data.alerts) ? data.alerts : [];
                if (alerts.length > 0) {
                    const top = alerts[0];
                    if (window.__lastAdminAlertId !== top.id) {
                        window.__lastAdminAlertId = top.id;
                        const div = document.createElement('div');
                        div.className = 'fixed bottom-4 right-4 z-50 max-w-sm p-3.5 rounded-2xl bg-slate-900 border border-amber-400/50 text-white shadow-2xl space-y-1.5 text-xs';
                        div.innerHTML = `<div class="flex items-center justify-between gap-2"><b class="text-amber-300">🔔 ${top.title || 'Thông báo Quản trị'}</b><button type="button" class="text-slate-400 hover:text-white text-base leading-none">&times;</button></div><p class="text-slate-200">${top.message || ''}</p>`;
                        div.querySelector('button').onclick = () => {
                            fetch('/api/operations.php?action=ack_admin_alert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notification_id: top.id }) }).catch(() => {});
                            div.remove();
                        };
                        document.body.appendChild(div);
                    }
                }
            } catch (_) {}
        };
        setTimeout(poll, 1500);
        this._adminAlertTimer = setInterval(poll, 12000);
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
                setTxt('stat-today-revenue', this.formatMoney(s.today_revenue) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ'));
                setTxt('stat-today-orders', s.today_orders);
                setTxt('stat-avg-order', this.formatMoney(s.today_avg_order) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ'));
                setTxt('stat-tables-active', `${s.occupied_tables} / ${s.total_tables}`);
                setTxt('stat-month-revenue', this.formatMoney(s.month_revenue) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ'));
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
            'today': (window.cnxT?window.cnxT('ui.adm_html.span_94c480c7','Doanh Thu Hôm Nay'):'Doanh Thu Hôm Nay'),
            '7d': (window.cnxT?window.cnxT('js.s_adm.df0ad4da','Doanh Thu 7 Ngày Gần Nhất'):'Doanh Thu 7 Ngày Gần Nhất'),
            '14d': (window.cnxT?window.cnxT('js.s_adm.45c6200b','Doanh Thu 14 Ngày Gần Nhất'):'Doanh Thu 14 Ngày Gần Nhất'),
            '30d': (window.cnxT?window.cnxT('js.s_adm.d4e27535','Doanh Thu 30 Ngày Gần Nhất'):'Doanh Thu 30 Ngày Gần Nhất'),
            'month': (window.cnxT?window.cnxT('ui.adm_html.span_f160f2cd','Doanh Thu Tháng Này'):'Doanh Thu Tháng Này'),
            'last_month': (window.cnxT?window.cnxT('js.s_adm.3f413a27','Doanh Thu Tháng Trước'):'Doanh Thu Tháng Trước')
        };
        const titleEl = document.getElementById('chart-title-text');
        if (titleEl) {
            titleEl.textContent = (window.cnxT?window.cnxT('js.s_adm.3cd2e381','Biểu Đồ '):'Biểu Đồ ') + (titles[period] || 'Doanh Thu');
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
            alert((window.cnxT?window.cnxT('js.s_adm.74c160ea','Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc!'):'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc!'));
            return;
        }

        if (fromVal > toVal) {
            alert((window.cnxT?window.cnxT('js.s_adm.e6b3da57','Ngày bắt đầu không được lớn hơn ngày kết thúc!'):'Ngày bắt đầu không được lớn hơn ngày kết thúc!'));
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
            titleEl.textContent = `${window.cnxT?window.cnxT('js.s_adm.19c8ac05','Biểu Đồ Doanh Thu ('):'Biểu Đồ Doanh Thu ('}${fStr} - ${tStr})`;
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
                summaryBadge.textContent = `${window.cnxT?window.cnxT('js.s_adm.70622f1b','Tổng:'):'Tổng:'} ${totalRev} ${window.cnxT?window.cnxT('js.s_adm.b4be420b','đ ('):'đ ('}${totalOrd} ${window.cnxT?window.cnxT('js.s_adm.a50869e7','đơn)'):'đơn)'}`;
            }

            const rangeIndicator = document.getElementById('chart-range-indicator');
            if (rangeIndicator && summary.date_from && summary.date_to) {
                const fStr = summary.date_from.split('-').reverse().join('/');
                const tStr = summary.date_to.split('-').reverse().join('/');
                rangeIndicator.textContent = `${window.cnxT?window.cnxT('js.s_adm.0f138fd0','Hiển thị'):'Hiển thị'} ${summary.days_count || json.data.length} ${window.cnxT?window.cnxT('js.s_adm.1c6205bd','ngày ('):'ngày ('}${fStr} - ${tStr})`;
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
                        label: (window.cnxT?window.cnxT('js.s_adm.0559d103','Doanh thu (VNĐ)'):'Doanh thu (VNĐ)'),
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
                                        ' 💰 Doanh thu: ' + this.formatMoney(val) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ'),
                                        (window.cnxT?window.cnxT('js.s_adm.1ccf2721',' 🧾 Đơn hàng: '):' 🧾 Đơn hàng: ') + ordCount + (window.cnxT?window.cnxT('js.s_adm.d50f3082',' đơn'):' đơn')
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
                container.innerHTML = (window.cnxT?window.cnxT('js.s_adm.835e0e5a','<div class="text-xs text-slate-500 py-4 text-center">Chưa có dữ liệu bán hàng hôm nay</div>'):'<div class="text-xs text-slate-500 py-4 text-center">Chưa có dữ liệu bán hàng hôm nay</div>');
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
                const unitLabel = it.unit || (window.cnxT?window.cnxT('js.s_adm.3a9dfd9c','phần'):'phần');
                html += `
                    <div class="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/15 transition">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <span class="w-7 h-7 shrink-0 rounded-lg ${rankClass} font-bold text-xs flex items-center justify-center font-mono">#${idx + 1}</span>
                            <div class="min-w-0">
                                <h6 class="text-xs font-bold text-slate-100 truncate">${it.product_name}</h6>
                                <span class="text-[11px] text-slate-400">${window.cnxT?window.cnxT('js.s_adm.752fb2f0','Đã bán:'):'Đã bán:'} <b class="text-amber-400 font-mono">${it.total_qty}</b> ${unitLabel}</span>
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
            tbody.innerHTML = this.renderEmptyState(5, 'fa-layer-group', (window.cnxT?window.cnxT('js.s_adm.577d3c88','Chưa có nhóm hàng nào'):'Chưa có nhóm hàng nào'), (window.cnxT?window.cnxT('js.s_adm.b6970f13','Bấm nút "Thêm Nhóm Hàng" để tạo danh mục phân loại đồ uống, đồ ăn.'):'Bấm nút "Thêm Nhóm Hàng" để tạo danh mục phân loại đồ uống, đồ ăn.'));
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
                            <span class="whitespace-nowrap">${escapeHtml(c.name)}</span>
                        </div>
                    </td>
                    <td class="col-center">
                        <span class="font-mono font-bold text-sky-400 text-xs bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 whitespace-nowrap">${Number(c.product_count || 0)} món</span>
                    </td>
                    <td class="col-center"><span class="font-mono text-xs text-slate-400 whitespace-nowrap">${Number(c.sort_order || 0)}</span></td>
                    <td class="col-right">
                        <div class="flex items-center justify-end gap-1.5">
                            <button type="button" class="saas-action-btn btn-edit" onclick="Admin.openEditCategoryModal(${Number(c.id)})" title="Sửa nhóm hàng">
                                <i class="fas fa-pen text-[10px]"></i>
                            </button>
                            <button type="button" class="saas-action-btn btn-delete" onclick="Admin.deleteCategory(${Number(c.id)})" title="Xóa nhóm hàng">
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
                options += `<option value="${Number(c.id)}">${escapeHtml(c.name)}</option>`;
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
        document.getElementById('category-modal-title').innerText = (window.cnxT?window.cnxT('js.s_adm.c8220f64','Thêm Nhóm Hàng Mới'):'Thêm Nhóm Hàng Mới');
        document.getElementById('category-modal').classList.add('open');
    },

    openEditCategoryModal(catId) {
        const cat = this.categories.find(c => c.id === catId);
        if (!cat) return;
        document.getElementById('modal-cat-id').value = cat.id;
        document.getElementById('modal-cat-name').value = cat.name;
        document.getElementById('modal-cat-icon').value = cat.icon || 'coffee';
        document.getElementById('modal-cat-order').value = cat.sort_order || 0;
        document.getElementById('category-modal-title').innerText = (window.cnxT?window.cnxT('js.s_adm.9e687d82','Chỉnh Sửa Nhóm Hàng'):'Chỉnh Sửa Nhóm Hàng');
        document.getElementById('category-modal').classList.add('open');
    },

    async saveCategory() {
        const id = document.getElementById('modal-cat-id').value;
        const name = document.getElementById('modal-cat-name').value.trim();
        const icon = document.getElementById('modal-cat-icon').value.trim();
        const order = parseInt(document.getElementById('modal-cat-order').value) || 0;

        if (!name) {
            alert((window.cnxT?window.cnxT('js.s_adm.7e7e0199','Vui lòng nhập tên nhóm hàng!'):'Vui lòng nhập tên nhóm hàng!'));
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
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.2d4e917e','Lỗi thao tác'):'Lỗi thao tác'));
            }
        } catch (e) {
            console.error('Error saving category:', e);
        }
    },

    async deleteCategory(catId) {
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_adm.d5c59bd2','Bạn có chắc chắn muốn xóa nhóm hàng này?'):'Bạn có chắc chắn muốn xóa nhóm hàng này?')))) return;
        try {
            const res = await fetch(`api/categories.php?action=delete&id=${catId}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                await this.loadCategories();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.2b5aedc5','Lỗi xóa nhóm hàng'):'Lỗi xóa nhóm hàng'));
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
            tbody.innerHTML = this.renderEmptyState(9, 'fa-utensils', (window.cnxT?window.cnxT('js.s_adm.f4dc4de2','Không tìm thấy mặt hàng nào'):'Không tìm thấy mặt hàng nào'), (window.cnxT?window.cnxT('js.s_adm.ebf782e0','Chưa có mặt hàng nào trong hệ thống hoặc không khớp với bộ lọc.'):'Chưa có mặt hàng nào trong hệ thống hoặc không khớp với bộ lọc.'));
            return;
        }

        let html = '';
        this.products.forEach(p => {
            const isLocked = p.status === 'locked';
            const imgUrl = p.image || 'assets/images/dishes/default_dish.jpg';
            const safeImgUrl = escapeHtml(CyberSecurity.safeUrl(imgUrl));
            const safeProdName = escapeHtml(p.name);
            html += `
                <tr class="hover:bg-sky-500/[0.04] transition-colors ${isLocked ? 'opacity-50' : ''}">
                    <td class="col-center">
                        <div class="w-9 h-9 rounded-lg overflow-hidden bg-slate-900 border border-white/10 mx-auto shadow-sm relative group cursor-pointer" onclick="Admin.openEditProductModal(${Number(p.id)})">
                            <img src="${safeImgUrl}" alt="${safeProdName}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" onerror="this.onerror=null;this.src='assets/images/dishes/default_dish.jpg';" />
                        </div>
                    </td>
                    <td><span class="font-mono text-[11px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 whitespace-nowrap">${escapeHtml(p.code || 'SP')}</span></td>
                    <td class="col-name">
                        <div class="font-bold text-white text-xs flex items-center gap-1.5 whitespace-nowrap">
                            <span class="whitespace-nowrap">${safeProdName}</span>
                            ${p.is_topping == 1 ? '<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 shrink-0">Topping</span>' : ''}
                        </div>
                    </td>
                    <td><span class="text-xs text-slate-300 font-medium whitespace-nowrap">${escapeHtml(p.category_name || '-')}</span></td>
                    <td class="col-center"><span class="text-xs text-slate-400 capitalize whitespace-nowrap">${escapeHtml(p.unit || 'ly')}</span></td>
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

        document.getElementById('product-modal-title').innerText = (window.cnxT?window.cnxT('ui.admin_html.h3_5800bc4e','Thêm Mặt Hàng Mới'):'Thêm Mặt Hàng Mới');
        this.loadProductRecipes(0);
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

        document.getElementById('product-modal-title').innerText = (window.cnxT?window.cnxT('js.s_adm.9e11e7e5','Chỉnh Sửa Mặt Hàng'):'Chỉnh Sửa Mặt Hàng');
        this.loadProductRecipes(prod.id);
        document.getElementById('product-modal').classList.add('open');
    },

    async analyzeMenuStyleDNA() {
        if (this._menuStyleDNA) return this._menuStyleDNA;
        const samples = (this.products || [])
            .map(p => p.image || '')
            .filter(src => src && !src.includes('default_dish'))
            .slice(0, 8);
        if (!samples.length) {
            this._menuStyleDNA = { tone: 'bright', avgLuma: 175, warmth: 4, count: 0 };
            return this._menuStyleDNA;
        }
        const measureOne = (src) => new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const w = 48, h = 36;
                    const cv = document.createElement('canvas');
                    cv.width = w; cv.height = h;
                    const ctx = cv.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    const data = ctx.getImageData(0, 0, w, h).data;
                    let sumL = 0, sumW = 0, n = 0;
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            if (x < 7 || x >= w - 7 || y < 6 || y >= h - 6) {
                                const i = (y * w + x) * 4;
                                const r = data[i], g = data[i + 1], b = data[i + 2];
                                sumL += 0.299 * r + 0.587 * g + 0.114 * b;
                                sumW += (r - b);
                                n++;
                            }
                        }
                    }
                    resolve(n ? { luma: sumL / n, warmth: sumW / n } : null);
                } catch (_) { resolve(null); }
            };
            img.onerror = () => resolve(null);
            img.src = src;
        });
        const stats = (await Promise.all(samples.map(measureOne))).filter(Boolean);
        if (!stats.length) {
            this._menuStyleDNA = { tone: 'bright', avgLuma: 175, warmth: 4, count: 0 };
            return this._menuStyleDNA;
        }
        const avgLuma = stats.reduce((s, x) => s + x.luma, 0) / stats.length;
        const warmth = stats.reduce((s, x) => s + x.warmth, 0) / stats.length;
        const tone = avgLuma >= 145 ? 'bright' : (avgLuma >= 95 ? 'warm' : 'dark');
        this._menuStyleDNA = { tone, avgLuma, warmth, count: stats.length };
        return this._menuStyleDNA;
    },

    async getEffectiveDishStyleTone() {
        const dna = await this.analyzeMenuStyleDNA();
        const sel = document.getElementById('dish-style-tone-select');
        const manual = sel ? sel.value : 'auto';
        const tone = (manual && manual !== 'auto') ? manual : dna.tone;
        return { tone, dna };
    },

    async smartSearchDishImages(page = 0, keepQuery = false) {
        const name = document.getElementById('modal-prod-name').value.trim();
        const catSelect = document.getElementById('modal-product-category');
        const category_name = catSelect.options[catSelect.selectedIndex]?.text || '';
        const queryInput = document.getElementById('dish-smart-query');
        if (!keepQuery && queryInput) {
            queryInput.value = name;
        }
        const custom_query = queryInput ? queryInput.value.trim() : '';
        if (!name && !custom_query) {
            alert((window.cnxT?window.cnxT('js.s_adm.f136a95b','Vui lòng nhập tên món ăn hoặc từ khóa trước khi tìm ảnh!'):'Vui lòng nhập tên món ăn hoặc từ khóa trước khi tìm ảnh!'));
            return;
        }
        this._smartSearchPage = Math.max(0, Number(page) || 0);
        const picker = document.getElementById('dish-smart-picker');
        const grid = document.getElementById('dish-smart-grid');
        const badge = document.getElementById('dish-style-dna-badge');
        if (!picker || !grid) return;

        picker.classList.remove('hidden');
        grid.innerHTML = (window.cnxT?window.cnxT('js.s_adm.a61b8eec','<div class="col-span-3 py-4 text-center text-xs text-slate-400 animate-pulse">Đang phân tích tông menu & tìm ảnh món thật (0 AI token)...</div>'):'<div class="col-span-3 py-4 text-center text-xs text-slate-400 animate-pulse">Đang phân tích tông menu & tìm ảnh món thật (0 AI token)...</div>');

        const { tone, dna } = await this.getEffectiveDishStyleTone();
        const toneLabel = tone === 'bright' ? 'Nền sáng' : (tone === 'warm' ? 'Gỗ ấm' : (window.cnxT?window.cnxT('js.s_adm.be718a1b','Nền tối'):'Nền tối'));
        if (badge) {
            const pageTxt = this._smartSearchPage > 0 ? ` • Trang ${this._smartSearchPage + 1}` : '';
            badge.textContent = `Menu Style DNA: ${toneLabel} (${dna.count} ${window.cnxT?window.cnxT('js.s_adm.fd256171','ảnh mẫu)'):'ảnh mẫu)'}${pageTxt}`;
        }

        try {
            const res = await fetch('api/products.php?action=search_dish_images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, category_name, style_tone: tone, page: this._smartSearchPage, custom_query })
            });
            const data = await res.json();
            if (!data.success || !Array.isArray(data.candidates) || !data.candidates.length) {
                grid.innerHTML = `<div class="col-span-3 py-3 text-center text-xs text-rose-300">${data.message || (window.cnxT?window.cnxT('js.s_adm.07a1cf7b','Không tìm thấy ảnh phù hợp.'):'Không tìm thấy ảnh phù hợp.')}</div>`;
                return;
            }
            grid.innerHTML = '';
            data.candidates.forEach((c) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'group relative aspect-[4/3] rounded-lg overflow-hidden border border-white/15 hover:border-emerald-400 bg-slate-950 transition-all';
                btn.title = (window.cnxT?window.cnxT('js.s_adm.e3577c2b','Chọn ảnh này & tự chuẩn hóa 640×480 theo tông menu'):'Chọn ảnh này & tự chuẩn hóa 640×480 theo tông menu');
                btn.onclick = () => this.applySmartDishCandidate(c.full_url, c.thumb_url);

                const img = document.createElement('img');
                img.src = c.thumb_url;
                img.alt = name;
                img.className = 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-200';

                const ov = document.createElement('span');
                ov.className = 'absolute inset-x-0 bottom-0 bg-slate-950/75 text-[10px] text-emerald-300 py-0.5 text-center opacity-0 group-hover:opacity-100 transition-opacity';
                ov.textContent = (window.cnxT?window.cnxT('js.s_adm.4a18b0fb','Chọn & Đồng bộ'):'Chọn & Đồng bộ');

                btn.appendChild(img);
                btn.appendChild(ov);
                grid.appendChild(btn);
            });
        } catch (e) {
            grid.innerHTML = `<div class="col-span-3 py-3 text-center text-xs text-rose-300">Lỗi tìm ảnh: ${e.message}</div>`;
        }
    },

    async applySmartDishCandidate(fullUrl, thumbUrl) {
        const preview = document.getElementById('modal-prod-img-preview');
        const picker = document.getElementById('dish-smart-picker');
        if (preview) preview.classList.add('animate-pulse');
        try {
            const res = await fetch('api/products.php?action=fetch_dish_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_url: fullUrl, thumb_url: thumbUrl })
            });
            const data = await res.json();
            if (!data.success || !data.data_url) {
                if (preview) preview.classList.remove('animate-pulse');
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.8c3bd0b7','Không tải được ảnh đã chọn!'):'Không tải được ảnh đã chọn!'));
                return;
            }
            const { dna } = await this.getEffectiveDishStyleTone();
            const normalizedB64 = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const outW = 640, outH = 480;
                    const cv = document.createElement('canvas');
                    cv.width = outW; cv.height = outH;
                    const ctx = cv.getContext('2d');
                    const srcRatio = img.width / img.height;
                    const dstRatio = outW / outH;
                    let sx = 0, sy = 0, sw = img.width, sh = img.height;
                    if (srcRatio > dstRatio) {
                        sw = img.height * dstRatio;
                        sx = (img.width - sw) / 2;
                    } else {
                        sh = img.width / dstRatio;
                        sy = (img.height - sh) / 2;
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
                    // Measure candidate border luminance and gently align exposure toward Menu Style DNA
                    const px = ctx.getImageData(0, 0, outW, outH).data;
                    let sumL = 0, n = 0;
                    for (let y = 0; y < outH; y += 8) {
                        for (let x = 0; x < outW; x += 8) {
                            if (x < 96 || x > outW - 96 || y < 72 || y > outH - 72) {
                                const i = (y * outW + x) * 4;
                                sumL += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
                                n++;
                            }
                        }
                    }
                    const curLuma = n ? (sumL / n) : dna.avgLuma;
                    const delta = Math.max(-28, Math.min(28, (dna.avgLuma - curLuma) * 0.45));
                    if (Math.abs(delta) > 4) {
                        const brightPct = Math.round(100 + delta * 0.65);
                        const tmp = document.createElement('canvas');
                        tmp.width = outW; tmp.height = outH;
                        const tctx = tmp.getContext('2d');
                        tctx.filter = `brightness(${brightPct}%) contrast(103%) saturate(104%)`;
                        tctx.drawImage(cv, 0, 0);
                        resolve(tmp.toDataURL('image/jpeg', 0.9));
                        return;
                    }
                    resolve(cv.toDataURL('image/jpeg', 0.9));
                };
                img.onerror = () => reject(new Error((window.cnxT?window.cnxT('js.s_adm.087f07a2','Không đọc được dữ liệu ảnh!'):'Không đọc được dữ liệu ảnh!')));
                img.src = data.data_url;
            });
            if (picker) picker.classList.add('hidden');
            await this.uploadCroppedDishImage(normalizedB64);
        } catch (e) {
            if (preview) preview.classList.remove('animate-pulse');
            alert((window.cnxT?window.cnxT('js.s_adm.c2d918ce','Lỗi xử lý ảnh: '):'Lỗi xử lý ảnh: ') + e.message);
        }
    },

    async aiGenerateDishImage() {
        const name = document.getElementById('modal-prod-name').value.trim();
        const catSelect = document.getElementById('modal-product-category');
        const category_name = catSelect.options[catSelect.selectedIndex]?.text || '';
        const id = document.getElementById('modal-prod-id').value;

        if (!name) {
            alert((window.cnxT?window.cnxT('js.s_adm.7ed5f06f','Vui lòng nhập tên món ăn trước khi nhờ AI tạo ảnh!'):'Vui lòng nhập tên món ăn trước khi nhờ AI tạo ảnh!'));
            return;
        }

        const preview = document.getElementById('modal-prod-img-preview');
        const input = document.getElementById('modal-prod-image');

        // Visual loading state
        preview.classList.add('animate-pulse');

        try {
            const { tone } = await this.getEffectiveDishStyleTone();
            const res = await fetch('api/products.php?action=ai_generate_dish_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, category_name, style_tone: tone, id: id ? parseInt(id) : 0 })
            });
            const data = await res.json();
            preview.classList.remove('animate-pulse');

            if (data.success && data.image_url) {
                preview.src = data.image_url;
                input.value = data.image_url;
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.5a61109c','AI đã tạo và gán ảnh món ăn thành công!'):'AI đã tạo và gán ảnh món ăn thành công!'));
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.a4685e24','Không thể tạo ảnh, vui lòng thử lại!'):'Không thể tạo ảnh, vui lòng thử lại!'));
            }
        } catch (e) {
            preview.classList.remove('animate-pulse');
            alert((window.cnxT?window.cnxT('js.s_adm.b09dad32','Lỗi kết nối AI: '):'Lỗi kết nối AI: ') + e.message);
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
            alert((window.cnxT?window.cnxT('js.s_adm.cc481199','Chưa có hình ảnh món ăn để cắt xén. Vui lòng bấm "Chọn File" hoặc "AI Tạo Ảnh" trước!'):'Chưa có hình ảnh món ăn để cắt xén. Vui lòng bấm "Chọn File" hoặc "AI Tạo Ảnh" trước!'));
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

                alert((window.cnxT?window.cnxT('js.s_adm.1d8725c0','Đã tự động cắt xén ảnh chuẩn 4:3 và lưu thành công!'):'Đã tự động cắt xén ảnh chuẩn 4:3 và lưu thành công!'));
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.21cd5f33','Lưu ảnh thất bại!'):'Lưu ảnh thất bại!'));
            }
        } catch (e) {
            if (preview) preview.classList.remove('animate-pulse');
            alert((window.cnxT?window.cnxT('js.s_adm.a11a3fbe','Lỗi tải ảnh: '):'Lỗi tải ảnh: ') + e.message);
        }
    },

    async batchAiAssignImages() {
        const missing = (this.products || []).filter(p => !p.image || p.image.includes('default_dish') || p.image.trim() === '');
        if (!missing.length) {
            alert((window.cnxT?window.cnxT('js.s_adm.e2cafad4','Tất cả món ăn trong thực đơn đều đã có ảnh!'):'Tất cả món ăn trong thực đơn đều đã có ảnh!'));
            return;
        }
        if (!(await window.cnxConfirm(`${window.cnxT?window.cnxT('js.s_adm.63697902','Tìm và gán ảnh tự động cho'):'Tìm và gán ảnh tự động cho'} ${missing.length} ${window.cnxT?window.cnxT('js.s_adm.c80471bb','món chưa có ảnh?\\n(Quá trình thực hiện tuần tự cho từng món)'):'món chưa có ảnh?\\n(Quá trình thực hiện tuần tự cho từng món)'}`))) {
            return;
        }
        let okCnt = 0;
        for (const prod of missing) {
            try {
                const sRes = await fetch('api/products.php?action=search_dish_images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: prod.name })
                }).then(r => r.json());
                const first = sRes && sRes.success && Array.isArray(sRes.results) && sRes.results[0];
                if (!first || !first.url) continue;
                const fRes = await fetch('api/products.php?action=fetch_dish_image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ full_url: first.url, thumb_url: first.thumb || first.url })
                }).then(r => r.json());
                if (!fRes || !fRes.success || !fRes.data_url) continue;
                const uRes = await fetch('api/products.php?action=upload_image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image_data: fRes.data_url, filename: `dish_${prod.id}.jpg` })
                }).then(r => r.json());
                if (uRes && uRes.success && uRes.image_path) {
                    await fetch('api/products.php?action=update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...prod, image: uRes.image_path, status: prod.status || 'active' })
                    });
                    okCnt++;
                }
            } catch (_) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin.js', _) : console.debug('admin.js', _)); }
        }
        alert(`${window.cnxT?window.cnxT('js.s_adm.138225c7','Đã tự động gán ảnh xong cho'):'Đã tự động gán ảnh xong cho'} ${okCnt}/${missing.length} ${window.cnxT?window.cnxT('js.s_adm.17fd7721','món!'):'món!'}`);
        await this.loadProducts();
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
            alert((window.cnxT?window.cnxT('js.s_adm.a0c70902','Vui lòng nhập tên món, chọn nhóm hàng và nhập giá bán hợp lệ!'):'Vui lòng nhập tên món, chọn nhóm hàng và nhập giá bán hợp lệ!'));
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
                const savedId = Number(id || data.id || data.product_id || 0);
                if (savedId > 0) await this.saveProductRecipes(savedId);
                document.getElementById('product-modal').classList.remove('open');
                await this.loadProducts();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.2d4e917e','Lỗi thao tác'):'Lỗi thao tác'));
            }
        } catch (e) {
            console.error('Error saving product:', e);
        }
    },

    async loadProductRecipes(prodId) {
        const box = document.getElementById('modal-prod-recipes-list');
        if (!box) return;
        box.innerHTML = (window.cnxT?window.cnxT('js.s_adm.4b564850','<div class="text-slate-400 text-[11px]">Đang tải định lượng...</div>'):'<div class="text-slate-400 text-[11px]">Đang tải định lượng...</div>');
        try {
            if (!Array.isArray(this.materialsList) || this.materialsList.length === 0) {
                const mRes = await fetch('api/operations.php?action=materials').then(r => r.json());
                if (mRes && mRes.success && Array.isArray(mRes.data)) this.materialsList = mRes.data;
            }
            let recipes = [];
            if (prodId > 0) {
                const rRes = await fetch('api/operations.php?action=get_recipes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_id: prodId })
                }).then(r => r.json());
                if (rRes && rRes.success && Array.isArray(rRes.data)) recipes = rRes.data;
            }
            box.innerHTML = '';
            if (recipes.length === 0) {
                box.innerHTML = (window.cnxT?window.cnxT('js.s_adm.cd9a2dc4','<div class="recipe-empty text-slate-500 italic text-[11px]">Chưa gắn định lượng (sẽ không tự trừ kho).</div>'):'<div class="recipe-empty text-slate-500 italic text-[11px]">Chưa gắn định lượng (sẽ không tự trừ kho).</div>');
            } else {
                recipes.forEach(r => this.addRecipeRow(r.material_id, r.quantity_per_unit));
            }
        } catch (e) {
            box.innerHTML = (window.cnxT?window.cnxT('js.s_adm.6e7ee9bb','<div class="text-rose-400 text-[11px]">Không tải được định lượng.</div>'):'<div class="text-rose-400 text-[11px]">Không tải được định lượng.</div>');
        }
    },

    addRecipeRow(selectedMatId = 0, qty = '') {
        const box = document.getElementById('modal-prod-recipes-list');
        if (!box) return;
        const emptyEl = box.querySelector('.recipe-empty');
        if (emptyEl) emptyEl.remove();
        const mats = Array.isArray(this.materialsList) ? this.materialsList : [];
        const opts = mats.map(m => `<option value="${m.id}" ${Number(m.id) === Number(selectedMatId) ? 'selected' : ''}>${m.name} (${m.unit})</option>`).join('');
        const row = document.createElement('div');
        row.className = 'recipe-row flex items-center gap-1.5';
        row.innerHTML = `
            <select class="recipe-mat-id liquid-input py-1 px-2 text-[11px] flex-1">${opts || (window.cnxT?window.cnxT('js.s_adm.afd96c68','<option value="0">Chưa có NL trong kho</option>'):'<option value="0">Chưa có NL trong kho</option>')}</select>
            <input type="number" step="0.001" min="0" value="${qty}" placeholder="SL/món" class="recipe-mat-qty liquid-input py-1 px-2 text-[11px] w-24 font-mono" />
            <button type="button" onclick="this.parentElement.remove()" class="px-2 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/35 text-[11px]"><i class="fas fa-times"></i></button>
        `;
        box.appendChild(row);
    },

    async saveProductRecipes(prodId) {
        const box = document.getElementById('modal-prod-recipes-list');
        if (!box || !prodId) return;
        const items = [];
        box.querySelectorAll('.recipe-row').forEach(r => {
            const material_id = parseInt(r.querySelector('.recipe-mat-id')?.value || '0', 10) || 0;
            const quantity_per_unit = parseFloat(r.querySelector('.recipe-mat-qty')?.value || '0') || 0;
            if (material_id > 0 && quantity_per_unit > 0) items.push({ material_id, quantity_per_unit });
        });
        await fetch('api/operations.php?action=save_recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: prodId, items })
        });
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
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_adm.cd962977','Bạn có chắc chắn muốn xóa mặt hàng này khỏi cơ sở dữ liệu?'):'Bạn có chắc chắn muốn xóa mặt hàng này khỏi cơ sở dữ liệu?')))) return;
        try {
            const res = await fetch(`api/products.php?action=delete&id=${prodId}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                await this.loadProducts();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.183fc55d','Lỗi xóa mặt hàng'):'Lỗi xóa mặt hàng'));
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
                    <p class="text-sm font-semibold">${window.cnxT?window.cnxT('js.s_adm.0823f02c','Không tìm thấy bàn nào phù hợp'):'Không tìm thấy bàn nào phù hợp'}</p>
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
            TAI_QUAN: { label: (window.cnxT?window.cnxT('js.s_adm.8c79998a','Bàn Tại Quán'):'Bàn Tại Quán'), icon: 'fa-chair', color: '#38bdf8', border: 'rgba(56,189,248,.35)' },
            MANG_VE:  { label: (window.cnxT?window.cnxT('js.s_adm.a3cceab8','Đơn Mang Về'):'Đơn Mang Về'),  icon: 'fa-bag-shopping', color: '#fbbf24', border: 'rgba(251,191,36,.35)' }
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
                                    ${isTakeaway ? 'Mang Về' : (window.cnxT?window.cnxT('ui.pos_html.div_2fa80da1','Tại Quán'):'Tại Quán')}
                                </span>
                            </div>
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase whitespace-nowrap shrink-0 ${isOccupied ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}">
                                <span class="w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}"></span>
                                ${isOccupied ? 'Có khách' : (window.cnxT?window.cnxT('js.s_adm.cd79aac0','Trống'):'Trống')}
                            </span>
                        </div>

                        <!-- Table Name & Seats -->
                        <div class="flex items-baseline justify-between gap-1 mb-2">
                            <h4 class="font-extrabold text-sm text-white truncate" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</h4>
                            <span class="text-[10px] text-slate-400 font-medium shrink-0">
                                <i class="fas fa-chair text-slate-500 text-[9px] mr-0.5"></i>${guestCount} chỗ
                            </span>
                        </div>

                        <!-- QR Code Thumbnail Box (Clean Standard White Card) -->
                        <div class="relative cursor-pointer transition-all group/qr" style="background:#fff;padding:8px;border-radius:12px;width:112px;height:112px;margin:8px auto;display:flex;align-items:center;justify-content:center;box-sizing:border-box;box-shadow:0 6px 16px rgba(0,0,0,.4);" onclick="Admin.openTableQrModal(${t.id})" title="Nhấp để phóng to & In Standee">
                            <div id="table-qr-${t.id}" style="width:96px;height:96px;display:flex;align-items:center;justify-content:center;overflow:hidden;"></div>
                            <div class="absolute inset-0 bg-slate-950/80 rounded-xl opacity-0 group-hover/qr:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 p-1 text-center">
                                <i class="fas fa-search-plus text-base text-sky-400"></i>
                                <span>${window.cnxT?window.cnxT('js.s_adm.7ff8cd48','Phóng to & In'):'Phóng to & In'}</span>
                            </div>
                        </div>

                        <!-- Live Order Info / Status Description -->
                        <div class="text-[11px] text-center my-1.5">
                            ${isOccupied ? `
                                <div class="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 font-medium flex items-center justify-between">
                                    <span class="truncate"><i class="fas fa-receipt mr-1 text-rose-400"></i>${escapeHtml(t.order_code || (window.cnxT?window.cnxT('js.s_adm.21ae8ec7','Đang mở'):'Đang mở'))}</span>
                                    <span class="font-bold text-amber-300 ml-1 font-mono">${(Number(t.total_amount) || 0).toLocaleString('vi-VN')}đ</span>
                                </div>
                            ` : `
                                <div class="text-[10px] text-slate-400 font-medium">
                                    <span class="text-emerald-400">●</span> ${window.cnxT?window.cnxT('js.s_adm.fda1a4dc','Sẵn sàng đón khách'):'Sẵn sàng đón khách'}
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Bottom Action Buttons Strip -->
                    <div class="pt-2 border-t border-white/10 flex items-center justify-between gap-1 mt-2 text-xs">
                        <button type="button" onclick="Admin.openTableQrModal(${t.id})" class="btn-glass text-[10px] py-1 px-2 text-sky-300 hover:text-white border-sky-500/30 hover:bg-sky-500/20 font-bold flex items-center gap-1 flex-1 justify-center shadow-sm" title="Mở mã QR standee">
                            <i class="fas fa-qrcode"></i> <span>Standee QR</span>
                        </button>
                        <button type="button" onclick="Admin.copyDirectOrderUrl('${escapeJsAttr(encodeURIComponent(orderUrl))}')" class="btn-glass text-[10px] py-1 px-1.5 text-slate-300 hover:text-white border-white/10" title="Sao chép link gọi món tại bàn">
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
            alert((window.cnxT?window.cnxT('js.s_adm.1442e9db','Vui lòng điền đầy đủ Mã bàn và Tên bàn!'):'Vui lòng điền đầy đủ Mã bàn và Tên bàn!'));
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
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.f010a268','Lỗi thêm bàn'):'Lỗi thêm bàn'));
            }
        } catch (err) {
            console.error('addTable error:', err);
            alert((window.cnxT?window.cnxT('js.s_adm.8ff5239a','Lỗi khi thêm bàn'):'Lỗi khi thêm bàn'));
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
        if (titleEl) titleEl.textContent = `${window.cnxT?window.cnxT('js.s_adm.b0f386a9','Standee QR Bàn:'):'Standee QR Bàn:'} ${table.name} (${table.code})`;

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
                <div style="font-size: 13px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #0284c7; margin-bottom: 4px;">${(window.getStoreBrandName ? window.getStoreBrandName() : 'CyberNexus POS').toUpperCase()}</div>
                <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 15px;">${window.cnxT?window.cnxT('js.s_adm.ee7c6b73','HỆ THỐNG GỌI MÓN & JUKEBOX THÔNG MINH TẠI BÀN'):'HỆ THỐNG GỌI MÓN & JUKEBOX THÔNG MINH TẠI BÀN'}</div>
                
                <div style="display: inline-block; padding: 8px 24px; border: 2px solid #0284c7; border-radius: 12px; background: #f0f9ff; margin-bottom: 15px;">
                    <span style="font-size: 26px; font-weight: 900; color: #0369a1; font-family: monospace;">${table.code}</span>
                    <span style="font-size: 14px; font-weight: 700; color: #334155; margin-left: 8px;">(${table.name})</span>
                </div>

                <div id="print-single-qr-img" style="margin: 10px auto; width: 220px; height: 220px; display: flex; align-items: center; justify-content: center; background: #fff;"></div>

                <div style="margin-top: 15px; font-size: 12px; font-weight: 700; color: #0f172a;">
                    ${window.cnxT?window.cnxT('js.s_adm.e20473d1','📷 Mở Camera / Zalo / App Ngân Hàng Quét Mã'):'📷 Mở Camera / Zalo / App Ngân Hàng Quét Mã'}
                </div>
                <div style="margin-top: 4px; font-size: 11px; color: #64748b;">
                    ${window.cnxT?window.cnxT('js.s_adm.7fc93b0f','Xem thực đơn điện tử • Đặt món nhanh • Quán phục vụ tận bàn'):'Xem thực đơn điện tử • Đặt món nhanh • Quán phục vụ tận bàn'}
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
            alert((window.cnxT?window.cnxT('js.s_adm.fe42b5fe','Không tìm thấy ảnh mã QR để tải!'):'Không tìm thấy ảnh mã QR để tải!'));
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

    async copyTableQrUrl() {
        const urlEl = document.getElementById('admin-table-qr-url');
        if (!urlEl || !urlEl.textContent) return;
        const url = urlEl.textContent;
        await this.copyDirectOrderUrl(url);
    },

    async copyDirectOrderUrl(url) {
        if (!url) return;
        const decoded = decodeURIComponent(url);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(decoded);
                alert((window.cnxT?window.cnxT('js.s_adm.18980c49','Đã sao chép link gọi món tại bàn:\n'):'Đã sao chép link gọi món tại bàn:\n') + decoded);
            } catch (e) {
                await window.cnxPrompt((window.cnxT?window.cnxT('js.s_adm.3a3f3dc9','Link gọi món tại bàn:'):'Link gọi món tại bàn:'), decoded);
            }
        } else {
            await window.cnxPrompt((window.cnxT?window.cnxT('js.s_adm.3a3f3dc9','Link gọi món tại bàn:'):'Link gọi món tại bàn:'), decoded);
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
            alert((window.cnxT?window.cnxT('js.s_adm.0327a905','Số kết thúc phải lớn hơn hoặc bằng số bắt đầu!'):'Số kết thúc phải lớn hơn hoặc bằng số bắt đầu!'));
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
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.b920013f','Đã tạo thành công hàng loạt bàn!'):'Đã tạo thành công hàng loạt bàn!'));
                document.getElementById('admin-batch-tables-modal')?.classList.remove('open');
                await this.loadTables();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.4b63dd65','Lỗi tạo hàng loạt bàn'):'Lỗi tạo hàng loạt bàn'));
            }
        } catch (err) {
            console.error('submitBatchTables error:', err);
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
        }
    },

    printAllTableQr() {
        const tables = this.tables || [];
        if (tables.length === 0) {
            alert((window.cnxT?window.cnxT('js.s_adm.90c02cd3','Chưa có bàn nào để in!'):'Chưa có bàn nào để in!'));
            return;
        }

        const baseUrl = getAdminBaseUrl();

        const printZone = document.getElementById('print-container-zone');
        if (!printZone) return;

        const brandNameUpper = (window.getStoreBrandName ? window.getStoreBrandName() : 'CyberNexus POS').toUpperCase();
        let html = `
            <div style="font-family: sans-serif; background: #fff; color: #020617; padding: 15px;">
                <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #0284c7; padding-bottom: 12px;">
                    <h2 style="font-size: 20px; font-weight: 900; margin: 0; color: #0284c7; text-transform: uppercase;">${brandNameUpper}</h2>
                    <p style="font-size: 13px; color: #475569; margin: 4px 0 0 0;">BỘ THẺ STANDEE QR GỌI MÓN TẠI BÀN (${tables.length} BÀN)</p>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
        `;

        tables.forEach((t, idx) => {
            const orderUrl = `${baseUrl}customer.html?table=${encodeURIComponent(t.code)}&name=${encodeURIComponent(t.name)}`;
            html += `
                <div class="print-table-card" style="border: 2px dashed #0284c7; border-radius: 14px; padding: 16px; text-align: center; page-break-inside: avoid; background: #ffffff;">
                    <div style="font-size: 11px; font-weight: 900; letter-spacing: 1.5px; color: #0284c7; text-transform: uppercase;">${brandNameUpper}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${window.cnxT?window.cnxT('js.s_adm.e22df3ab','MÃ QR GỌI MÓN & JUKEBOX'):'MÃ QR GỌI MÓN & JUKEBOX'}</div>
                    
                    <div style="display: inline-block; margin: 10px 0; padding: 4px 16px; border: 1.5px solid #0284c7; border-radius: 8px; background: #f0f9ff;">
                        <span style="font-size: 20px; font-weight: 900; color: #0369a1; font-family: monospace;">${t.code}</span>
                        <span style="font-size: 12px; font-weight: 700; color: #334155; margin-left: 6px;">(${t.name})</span>
                    </div>

                    <div id="print-batch-qr-${t.id}" style="margin: 8px auto; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center;"></div>

                    <div style="font-size: 10px; font-weight: 700; color: #0f172a; margin-top: 6px;">
                        ${window.cnxT?window.cnxT('js.s_adm.22d70618','📷 Mở Camera / Zalo quét mã'):'📷 Mở Camera / Zalo quét mã'}
                    </div>
                    <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
                        ${window.cnxT?window.cnxT('js.s_adm.8891e554','Xem menu • Đặt món • Phục vụ tận bàn'):'Xem menu • Đặt món • Phục vụ tận bàn'}
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
                this.showToast((window.cnxT?window.cnxT('js.s_adm.076269bd','🗑️ Đã xóa bàn thành công!'):'🗑️ Đã xóa bàn thành công!'), 'info');
                await this.loadTables();
            } else {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_adm.10f7e2f7','Lỗi xóa bàn'):'Lỗi xóa bàn'), 'error');
            }
        } catch (e) {
            console.error('Error deleting table:', e);
            this.showToast((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'), 'error');
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
                tbody.innerHTML = this.renderEmptyState(7, 'fa-file-invoice-dollar', (window.cnxT?window.cnxT('js.s_adm.02a3f42e','Chưa có hóa đơn nào'):'Chưa có hóa đơn nào'), (window.cnxT?window.cnxT('js.s_adm.32a3a355','Không tìm thấy hóa đơn nào trong khoảng thời gian hoặc trạng thái đã lọc.'):'Không tìm thấy hóa đơn nào trong khoảng thời gian hoặc trạng thái đã lọc.'));
                return;
            }

            let html = '';
            data.data.forEach(o => {
                const statusBadge = o.status === 'completed' 
                    ? '<span class="saas-badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Đã thanh toán</span>'
                    : (o.status === 'pending' 
                        ? '<span class="saas-badge bg-amber-500/15 text-amber-300 border border-amber-500/30"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Đang dùng</span>' 
                        : (window.cnxT?window.cnxT('js.s_adm.a9966ca4','<span class="saas-badge bg-rose-500/15 text-rose-300 border border-rose-500/30"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Đã hủy</span>'):'<span class="saas-badge bg-rose-500/15 text-rose-300 border border-rose-500/30"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Đã hủy</span>'));

                html += `
                    <tr class="hover:bg-sky-500/[0.04] transition-colors">
                        <td><span class="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">${o.order_code || ('#' + o.id)}</span></td>
                        <td><span class="font-bold text-white text-xs">${o.table_code || o.table_name || (window.cnxT?window.cnxT('ui.admin_html.option_db03f8a2','Mang về'):'Mang về')}</span></td>
                        <td><span class="text-xs text-slate-400 font-mono">${o.created_at ? window.formatDateDDMMYY(o.created_at, true) : '-'}</span></td>
                        <td><span class="text-xs text-slate-300 font-medium">${o.user_name || (window.cnxT?window.cnxT('ui.ord_html.b_6951ffd8','Thu ngân'):'Thu ngân')}</span></td>
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
                        <div>${window.cnxT?window.cnxT('ui.pos_html.div_1c36b836','Bàn:'):'Bàn:'} <b class="text-white">${o.table_code}</b> ${window.cnxT?window.cnxT('js.s_adm.2878a3f6','| Thu ngân:'):'| Thu ngân:'} <b class="text-white">${o.user_name}</b></div>
                        <div>Thời gian: ${window.formatDateDDMMYY(o.created_at, true)}</div>
                    </div>
                    <div class="max-h-60 overflow-y-auto mb-4 pr-1">
                        ${itemsHtml}
                    </div>
                    <div class="pt-3 border-t border-white/10 space-y-1 text-xs">
                        <div class="flex justify-between text-slate-400">
                            <span>${window.cnxT?window.cnxT('js.s_adm.28db4eb0','Tiền hàng:'):'Tiền hàng:'}</span>
                            <span>${this.formatMoney(o.subtotal)} đ</span>
                        </div>
                        ${o.discount_amount > 0 ? `
                        <div class="flex justify-between text-rose-400">
                            <span>${window.cnxT?window.cnxT('ui.pos_html.span_607b5d46','Giảm giá:'):'Giảm giá:'}</span>
                            <span>-${this.formatMoney(o.discount_amount)} đ</span>
                        </div>` : ''}
                        <div class="flex justify-between text-sm font-black text-emerald-400 pt-1 border-t border-white/5">
                            <span>${window.cnxT?window.cnxT('js.s_adm.45aea550','TỔNG TIỀN:'):'TỔNG TIỀN:'}</span>
                            <span>${this.formatMoney(o.total_amount)} đ</span>
                        </div>
                    </div>
                    <div class="flex justify-end gap-2 mt-5">
                        <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('history-detail-modal').classList.remove('open')">${window.cnxT?window.cnxT('ui.pos_html.button_cee55387','Đóng'):'Đóng'}</button>
                        <button type="button" class="btn-glass-primary text-xs py-2 px-4 font-bold flex items-center gap-1.5 shadow" onclick="Admin.printReceipt(${o.id})">
                            <i class="fas fa-print"></i> ${window.cnxT?window.cnxT('ui.pos_html.span_c3942868','In Hóa Đơn (80mm)'):'In Hóa Đơn (80mm)'}
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
                alert((window.cnxT?window.cnxT('js.s_adm.1d9dd155','Không thể tải chi tiết hóa đơn!'):'Không thể tải chi tiết hóa đơn!'));
                return;
            }

            const o = data.order;
            const items = data.items || [];
            const brand = window.CN_STORE_BRAND || {};
            const storeName = brand.store_name || 'CyberNexus POS';
            const hotline = brand.store_hotline || '';
            const address = brand.store_address || '';
            const wifi = brand.store_wifi || '';

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

            const receiptHtml = (window.ReceiptTemplate && typeof window.ReceiptTemplate.renderHtml === 'function')
                ? window.ReceiptTemplate.renderHtml(o, items, brand, { isReprint: true })
                : `<div>${storeName} - #${o.order_code}</div>`;

            if (window.ReceiptTemplate && typeof window.ReceiptTemplate.printHtmlInIframe === 'function') {
                const paperCfg = window.ReceiptTemplate.getConfig(brand);
                window.ReceiptTemplate.printHtmlInIframe(receiptHtml, paperCfg.paper_size);
                return;
            }

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
                    <title>${window.cnxT?window.cnxT('js.s_adm.ca5dc50d','In Hóa Đơn'):'In Hóa Đơn'}</title>
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

};

document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
    if (localStorage.getItem('cnx_must_change_pin') === '1') {
        showForceChangePinModal();
    }
});

function showForceChangePinModal() {
    if (document.getElementById('modal-force-change-pin')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-force-change-pin';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,0.82);backdrop-filter:blur(10px);';
    modal.innerHTML = `
        <div style="width:100%;max-width:410px;border-radius:18px;border:1px solid rgba(56,189,248,0.35);background:linear-gradient(160deg,rgba(15,23,42,0.98),rgba(9,14,28,0.98));box-shadow:0 24px 60px rgba(0,0,0,0.65);padding:24px;color:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <div style="width:42px;height:42px;border-radius:12px;background:rgba(245,158,11,0.15);border:1px solid rgba(251,191,36,0.35);display:flex;align-items:center;justify-content:center;color:#fbbf24;flex-shrink:0;">
                    <i class="fa-solid fa-shield-halved" style="font-size:18px;"></i>
                </div>
                <div>
                    <div style="font-size:16px;font-weight:700;color:#ffffff;line-height:1.3;">${window.cnxT?window.cnxT('js.s_adm.c0fd5493','Đổi Mã PIN Bảo Mật Lần Đầu'):'Đổi Mã PIN Bảo Mật Lần Đầu'}</div>
                    <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${window.cnxT?window.cnxT('js.s_adm.a0bc3f1a','Bạn vừa đăng nhập bằng PIN mặc định 1 lần'):'Bạn vừa đăng nhập bằng PIN mặc định 1 lần'}</div>
                </div>
            </div>
            <p style="font-size:12.5px;color:#cbd5e1;line-height:1.5;margin:0 0 16px 0;">
                ${window.cnxT?window.cnxT('js.s_adm.e3311faa','Vui lòng thiết lập mã PIN cá nhân'):'Vui lòng thiết lập mã PIN cá nhân'} <strong style="color:#38bdf8;">${window.cnxT?window.cnxT('js.s_adm.0e17c4fc','6 chữ số'):'6 chữ số'}</strong> ${window.cnxT?window.cnxT('js.s_adm.b0bad665','mới (không trùng PIN mặc định) để tiếp tục sử dụng hệ thống.'):'mới (không trùng PIN mặc định) để tiếp tục sử dụng hệ thống.'}
            </p>
            <form id="form-force-change-pin" autocomplete="off" style="display:flex;flex-direction:column;gap:14px;">
                <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:#cbd5e1;margin-bottom:6px;">${window.cnxT?window.cnxT('js.s_adm.e4265226','Mã PIN mới (6 chữ số)'):'Mã PIN mới (6 chữ số)'}</label>
                    <div style="position:relative;">
                        <input id="fcp-pin1" type="password" inputmode="numeric" maxlength="6" pattern="\\d{6}" required
                            placeholder="••••••"
                            style="width:100%;box-sizing:border-box;padding:10px 40px 10px 14px;border-radius:11px;background:rgba(2,6,23,0.85);border:1px solid rgba(71,85,105,0.85);color:#ffffff;text-align:center;letter-spacing:0.45em;font-family:monospace;font-size:17px;outline:none;" />
                        <button type="button" data-toggle-pin="fcp-pin1"
                            style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;padding:6px;font-size:13px;">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                    </div>
                </div>
                <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:#cbd5e1;margin-bottom:6px;">${window.cnxT?window.cnxT('js.s_adm.1263ec28','Nhập lại mã PIN mới'):'Nhập lại mã PIN mới'}</label>
                    <div style="position:relative;">
                        <input id="fcp-pin2" type="password" inputmode="numeric" maxlength="6" pattern="\\d{6}" required
                            placeholder="••••••"
                            style="width:100%;box-sizing:border-box;padding:10px 40px 10px 14px;border-radius:11px;background:rgba(2,6,23,0.85);border:1px solid rgba(71,85,105,0.85);color:#ffffff;text-align:center;letter-spacing:0.45em;font-family:monospace;font-size:17px;outline:none;" />
                        <button type="button" data-toggle-pin="fcp-pin2"
                            style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;padding:6px;font-size:13px;">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                    </div>
                </div>
                <div id="fcp-error" style="display:none;font-size:12px;color:#fda4af;background:rgba(244,63,94,0.14);border:1px solid rgba(244,63,94,0.4);border-radius:9px;padding:8px 12px;"></div>
                <button id="fcp-submit" type="submit"
                    style="width:100%;padding:11px 16px;border:none;border-radius:11px;background:linear-gradient(90deg,#06b6d4,#2563eb);color:#ffffff;font-weight:700;font-size:13.5px;cursor:pointer;box-shadow:0 8px 20px rgba(6,182,212,0.28);margin-top:2px;">
                    <i class="fa-solid fa-check" style="margin-right:6px;"></i>${window.cnxT?window.cnxT('js.s_adm.3ecb05c3','Xác nhận & Lưu mã PIN mới'):'Xác nhận & Lưu mã PIN mới'}
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const pin1 = document.getElementById('fcp-pin1');
    const pin2 = document.getElementById('fcp-pin2');
    const errBox = document.getElementById('fcp-error');
    const submitBtn = document.getElementById('fcp-submit');

    const showErr = (msg) => {
        errBox.textContent = msg;
        errBox.style.display = 'block';
    };

    [pin1, pin2].forEach(inp => {
        inp.addEventListener('input', () => {
            inp.value = inp.value.replace(/\D/g, '').slice(0, 6);
            errBox.style.display = 'none';
        });
    });

    modal.querySelectorAll('[data-toggle-pin]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.getAttribute('data-toggle-pin'));
            if (!target) return;
            const show = target.type === 'password';
            target.type = show ? 'text' : 'password';
            btn.innerHTML = show ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
        });
    });

    setTimeout(() => pin1.focus(), 50);

    document.getElementById('form-force-change-pin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const v1 = pin1.value.trim();
        const v2 = pin2.value.trim();
        if (!/^\d{6}$/.test(v1)) {
            showErr((window.cnxT?window.cnxT('js.s_adm.0f31f79f','Mã PIN mới phải gồm đúng 6 chữ số!'):'Mã PIN mới phải gồm đúng 6 chữ số!'));
            pin1.focus();
            return;
        }
        if (v1 !== v2) {
            showErr((window.cnxT?window.cnxT('js.s_adm.0135dd2c','Hai lần nhập mã PIN không khớp!'):'Hai lần nhập mã PIN không khớp!'));
            pin2.focus();
            return;
        }
        submitBtn.disabled = true;
        submitBtn.innerHTML = (window.cnxT?window.cnxT('js.s_adm.aa458f9c','<i class="fa-solid fa-spinner fa-spin mr-1.5"></i>Đang cập nhật...'):'<i class="fa-solid fa-spinner fa-spin mr-1.5"></i>Đang cập nhật...');
        try {
            const r = await fetch('api/auth.php?action=change_my_pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_pin: v1 })
            });
            const d = await r.json();
            if (d.success) {
                localStorage.removeItem('cnx_must_change_pin');
                modal.remove();
                if (typeof Admin !== 'undefined' && typeof Admin.showToast === 'function') {
                    Admin.showToast(window.cnxApiMsg ? cnxApiMsg(d, (window.cnxT?window.cnxT('js.s_adm.fcdb7468','Đã cập nhật mã PIN 6 số mới thành công!'):'Đã cập nhật mã PIN 6 số mới thành công!')) : (d.message || (window.cnxT?window.cnxT('js.s_adm.fcdb7468','Đã cập nhật mã PIN 6 số mới thành công!'):'Đã cập nhật mã PIN 6 số mới thành công!')), 'success');
                }
            } else {
                showErr(d.message || (window.cnxT?window.cnxT('js.s_adm.d81b713a','Không thể đổi PIN, vui lòng thử PIN khác!'):'Không thể đổi PIN, vui lòng thử PIN khác!'));
            }
        } catch (err) {
            showErr((window.cnxT?window.cnxT('js.m_sa.e5f87ad3','Lỗi kết nối: '):'Lỗi kết nối: ') + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = (window.cnxT?window.cnxT('js.s_adm.ef8a0ac0','<i class="fa-solid fa-check mr-1.5"></i>Xác nhận & Lưu mã PIN mới'):'<i class="fa-solid fa-check mr-1.5"></i>Xác nhận & Lưu mã PIN mới');
        }
    });
}

