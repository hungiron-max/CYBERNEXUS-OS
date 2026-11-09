/**
 * Admin Back-Office Engine
 * Dashboard, Products CRUD, Categories CRUD, Tables & Revenue Reports
 */

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

    async confirmCrop() {
        if (!this.imageLoaded || !this.canvas) return;

        // Render to offscreen canvas to guarantee pristine 640x480 resolution
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.targetWidth;
        exportCanvas.height = this.targetHeight;
        const expCtx = exportCanvas.getContext('2d');
        expCtx.imageSmoothingEnabled = true;
        expCtx.imageSmoothingQuality = 'high';
        expCtx.drawImage(this.canvas, 0, 0);

        try {
            const base64 = await ImageProcessor.canvasToDataUrl(exportCanvas, 0.82, 256 * 1024);
            this.close();
            if (typeof this.onSaveCallback === 'function') {
                this.onSaveCallback(base64);
            }
        } catch (e) {
            console.error('Canvas export error:', e);
            alert(e.message || 'Không thể xử lý ảnh món ăn.');
        }
    }
};

const Admin = {
    currentTab: 'dashboard',
    products: [],
    categories: [],
    tables: [],
    chartInstance: null,

    async init() {
        this.bindNavigation();
        await this.loadCategories();
        await this.loadDashboard();
        await this.loadProducts();
        await this.loadTables();
        this.initDishImageDrop();

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
    },

    formatMoney(amount) {
        return new Intl.NumberFormat('vi-VN').format(Math.round(amount || 0));
    },

    bindNavigation() {
        const navButtons = document.querySelectorAll('.admin-nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
    },

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.admin-nav-btn').forEach(b => {
            if (b.dataset.tab === tab) {
                b.classList.add('bg-sky-500/20', 'text-sky-400', 'border-sky-500/40');
                b.classList.remove('text-slate-400');
            } else {
                b.classList.remove('bg-sky-500/20', 'text-sky-400', 'border-sky-500/40');
                b.classList.add('text-slate-400');
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

            const labels = json.data.map(d => d.label);
            const revenues = json.data.map(d => d.revenue);
            const orders = json.data.map(d => d.orders);

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

            if (json.data.length === 0) {
                container.innerHTML = '<div class="text-xs text-slate-500 py-4 text-center">Chưa có dữ liệu bán hàng hôm nay</div>';
                return;
            }

            let html = '';
            json.data.forEach((it, idx) => {
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

        let html = '';
        this.categories.forEach(c => {
            html += `
                <tr class="border-b border-white/5 hover:bg-slate-800/40 transition-colors">
                    <td class="p-3 text-xs font-mono text-slate-400">#${c.id}</td>
                    <td class="p-3 text-sm font-bold text-white flex items-center gap-2">
                        <span class="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400 text-xs">
                            <i class="fas fa-${c.icon || 'tag'}"></i>
                        </span>
                        ${c.name}
                    </td>
                    <td class="p-3 text-xs text-sky-400 font-semibold font-mono">${c.product_count || 0} món</td>
                    <td class="p-3 text-xs text-slate-400 font-mono">${c.sort_order || 0}</td>
                    <td class="p-3 text-right space-x-1">
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500 hover:text-white text-xs" onclick="Admin.openEditCategoryModal(${c.id})">
                            <i class="fas fa-edit"></i> Sửa
                        </button>
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white text-xs" onclick="Admin.deleteCategory(${c.id})">
                            <i class="fas fa-trash"></i> Xóa
                        </button>
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

        if (this.products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-500 text-sm">Không tìm thấy mặt hàng nào phù hợp</td></tr>`;
            return;
        }

        let html = '';
        this.products.forEach(p => {
            const isLocked = p.status === 'locked';
            const imgUrl = p.image || 'assets/images/dishes/default_dish.jpg';
            html += `
                <tr class="border-b border-white/5 hover:bg-slate-800/40 transition-colors ${isLocked ? 'opacity-50' : ''}">
                    <td class="p-2.5 text-center">
                        <div class="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-white/10 mx-auto shadow relative group cursor-pointer" onclick="Admin.openEditProductModal(${p.id})">
                            <img src="${imgUrl}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-125 transition-transform duration-300" onerror="this.onerror=null;this.src='assets/images/dishes/default_dish.jpg';" />
                        </div>
                    </td>
                    <td class="p-3 text-xs font-mono font-bold text-sky-400">${p.code || 'SP'}</td>
                    <td class="p-3 text-sm font-bold text-white">
                        ${p.name}
                        ${p.is_topping == 1 ? '<span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-normal">Topping</span>' : ''}
                    </td>
                    <td class="p-3 text-xs text-slate-300 font-medium">${p.category_name || '-'}</td>
                    <td class="p-3 text-xs text-slate-400 capitalize">${p.unit || 'ly'}</td>
                    <td class="p-3 text-sm font-black text-amber-400 font-mono">${this.formatMoney(p.sale_price)} đ</td>
                    <td class="p-3 text-xs text-slate-400 font-mono">${this.formatMoney(p.cost_price)} đ</td>
                    <td class="p-3 text-center">
                        <input type="checkbox" class="w-4 h-4 rounded text-rose-500 cursor-pointer" ${isLocked ? 'checked' : ''} onchange="Admin.toggleProductLock(${p.id})" title="Tạm khóa mặt hàng" />
                    </td>
                    <td class="p-3 text-right space-x-1">
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500 hover:text-white text-xs" onclick="Admin.openEditProductModal(${p.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white text-xs" onclick="Admin.deleteProduct(${p.id})">
                            <i class="fas fa-trash"></i>
                        </button>
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
                this.tableQrError = data.qr_error || '';
                this.renderTablesList();
            }
        } catch (e) {
            console.error('Error loading tables:', e);
        }
    },

    renderTablesList() {
        const container = document.getElementById('admin-tables-container');
        if (!container) return;

        const tableGroups = [
            { key: 'TAI_QUAN', title: 'Bàn tại quán', icon: 'fa-chair', accent: 'text-cyan-300', badge: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200' },
            { key: 'MANG_VE', title: 'Bàn mang về', icon: 'fa-bag-shopping', accent: 'text-violet-300', badge: 'border-violet-400/20 bg-violet-400/10 text-violet-200' }
        ];
        const groupedTables = new Map(tableGroups.map(group => [group.key, []]));
        const otherTables = [];

        this.tables.forEach(table => {
            const group = groupedTables.get(table.area_type || 'TAI_QUAN');
            if (group) group.push(table);
            else otherTables.push(table);
        });

        const renderTableCard = t => {
            const isOccupied = t.status === 'occupied';
            const hasQr = t.area_type === 'TAI_QUAN' && window.SALEAPP_TABLE_QR_ENABLED && t.qr_url;
            const tableCode = this.escapeHtml(t.code);
            const tableName = this.escapeHtml(t.name);
            const tableOrderCode = this.escapeHtml(t.order_code || '');
            return `
                <article class="liquid-glass-card rounded-2xl border border-white/10 p-3 shadow-lg">
                    <div class="mb-2 flex items-center justify-between gap-2">
                        <span class="font-mono text-base font-extrabold text-white">${tableCode}</span>
                        <span class="text-xs px-2 py-0.5 rounded-full font-bold ${isOccupied ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}">
                            ${isOccupied ? 'Có khách' : 'Trống'}
                        </span>
                    </div>
                    <div class="flex min-h-[92px] items-center justify-between gap-2">
                        <div class="min-w-0 flex-1">
                            <div class="truncate text-xs font-semibold text-slate-300">${tableName}</div>
                            <div class="mt-1 text-[10px] text-slate-500">${t.area_type === 'MANG_VE' ? 'Mang về' : 'Tại quán'}</div>
                            <div class="mt-2 truncate text-[10px] text-slate-400">${isOccupied ? `HĐ: ${tableOrderCode}` : 'Chưa có đơn'}</div>
                        </div>
                        ${hasQr ? `
                            <button type="button" class="group shrink-0 rounded-xl border border-sky-300/25 bg-white p-1 shadow-[0_0_16px_rgba(56,189,248,.12)] transition hover:border-cyan-300/70 hover:shadow-[0_0_22px_rgba(34,211,238,.28)]" onclick="Admin.showTableQr(${Number(t.id)})" title="Mở hoặc tải QR đặt món ${tableCode}" aria-label="Mã QR đặt món ${tableCode}">
                                <span id="admin-table-qr-thumb-${Number(t.id)}" class="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-lg bg-white"></span>
                                <span class="mt-0.5 block text-center text-[9px] font-black uppercase tracking-wide text-sky-700">QR ĐẶT MÓN</span>
                            </button>
                        ` : ''}
                    </div>
                    <div class="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                        <span class="text-slate-500">${t.area_type === 'MANG_VE' ? 'Mang về' : 'Sơ đồ bàn'}</span>
                        <div class="flex items-center gap-3">
                            ${!isOccupied ? `
                                <button type="button" class="text-rose-400 hover:text-rose-300" onclick="Admin.deleteTable(${Number(t.id)})" title="Xóa bàn">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </article>
            `;
        };

        const renderGroup = (group, tables) => {
            if (!tables.length) return '';
            const sortedTables = [...tables].sort((a, b) => {
                const byCode = String(a.code || '').localeCompare(String(b.code || ''), 'vi', { numeric: true, sensitivity: 'base' });
                return byCode || Number(a.id) - Number(b.id);
            });
            return `
                <section class="space-y-2.5" aria-label="${group.title}">
                    <div class="flex items-center gap-2 border-b border-white/10 pb-2">
                        <span class="flex h-7 w-7 items-center justify-center rounded-lg border ${group.badge}">
                            <i class="fas ${group.icon} text-xs"></i>
                        </span>
                        <h4 class="text-sm font-bold ${group.accent}">${group.title}</h4>
                        <span class="rounded-full border ${group.badge} px-2 py-0.5 text-[10px] font-bold">${tables.length}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        ${sortedTables.map(renderTableCard).join('')}
                    </div>
                </section>
            `;
        };
        let html = tableGroups
            .map(group => renderGroup(group, groupedTables.get(group.key)))
            .join('');
        if (otherTables.length) {
            html += renderGroup({
                title: 'Khu vực khác',
                icon: 'fa-layer-group',
                accent: 'text-slate-300',
                badge: 'border-slate-400/20 bg-slate-400/10 text-slate-200'
            }, otherTables);
        }

        const qrWarning = this.tableQrError
            ? `<div class="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">${this.escapeHtml(this.tableQrError)}</div>`
            : '';
        container.innerHTML = qrWarning + html;
        if (typeof QRCode !== 'undefined') {
            this.tables.forEach(table => {
                if (table.area_type !== 'TAI_QUAN' || !table.qr_url) return;
                const qrContainer = document.getElementById(`admin-table-qr-thumb-${Number(table.id)}`);
                if (!qrContainer) return;
                qrContainer.replaceChildren();
                new QRCode(qrContainer, {
                    text: new URL(table.qr_url, window.location.href).href,
                    width: 76,
                    height: 76,
                    correctLevel: QRCode.CorrectLevel.M
                });
            });
        }
    },

    async showTableQr(tableId) {
        if (!window.SALEAPP_TABLE_QR_ENABLED) {
            alert('Module Đặt Món QR Theo Bàn chưa được cấp phép.');
            return;
        }
        if (typeof QRCode === 'undefined') {
            alert('Không tải được thư viện tạo mã QR. Hãy tải lại trang khi có mạng.');
            return;
        }
        try {
            const response = await fetch('api/tables.php?action=get_table_qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table_id: tableId })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Không thể tạo mã QR cho bàn.');

            const container = document.getElementById('admin-table-qr-code');
            const modal = document.getElementById('admin-table-qr-modal');
            container.replaceChildren();
            new QRCode(container, {
                text: new URL(data.qr_url, window.location.href).href,
                width: 224,
                height: 224,
                correctLevel: QRCode.CorrectLevel.M
            });
            document.getElementById('admin-table-qr-title').textContent = `Mã QR đặt món · ${data.table.name} (${data.table.code})`;
            document.getElementById('admin-table-qr-url').textContent = new URL(data.qr_url, window.location.href).href;
            modal.dataset.filename = `QR-${String(data.table.code).replace(/[^a-z0-9_-]/gi, '-')}.png`;
            modal.classList.add('open');
        } catch (error) {
            console.error('Could not load table QR code:', error);
            alert(error.message || 'Không thể tạo mã QR cho bàn.');
        }
    },

    downloadTableQr() {
        const container = document.getElementById('admin-table-qr-code');
        const modal = document.getElementById('admin-table-qr-modal');
        const canvas = container?.querySelector('canvas');
        const image = container?.querySelector('img');
        const dataUrl = canvas?.toDataURL('image/png') || image?.src || '';
        if (!dataUrl.startsWith('data:image/')) {
            alert('Mã QR chưa sẵn sàng để tải. Vui lòng thử lại.');
            return;
        }
        const download = document.createElement('a');
        download.href = dataUrl;
        download.download = modal?.dataset.filename || 'table-order-qr.png';
        download.click();
    },

    openAddTableModal() {
        const form = document.getElementById('admin-table-form');
        const message = document.getElementById('admin-table-form-message');
        form?.reset();
        if (message) {
            message.textContent = '';
            message.classList.add('hidden');
        }
        document.getElementById('admin-table-area').value = 'TAI_QUAN';
        document.getElementById('admin-table-code')?.focus();
        document.getElementById('admin-table-modal')?.classList.add('open');
    },

    closeAddTableModal() {
        document.getElementById('admin-table-modal')?.classList.remove('open');
    },

    async addTable(event) {
        event?.preventDefault();
        const codeInput = document.getElementById('admin-table-code');
        const nameInput = document.getElementById('admin-table-name');
        const areaInput = document.getElementById('admin-table-area');
        const message = document.getElementById('admin-table-form-message');
        const submit = document.getElementById('admin-table-submit');
        const code = codeInput?.value.trim() || '';
        const name = nameInput?.value.trim() || '';
        const area = areaInput?.value || 'TAI_QUAN';

        if (!code || !name) {
            if (message) {
                message.textContent = 'Vui lòng nhập mã bàn và tên hiển thị.';
                message.classList.remove('hidden');
            }
            return;
        }

        try {
            if (submit) {
                submit.disabled = true;
                submit.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Đang tạo bàn...';
            }
            if (message) message.classList.add('hidden');
            const res = await fetch('api/tables.php?action=add_table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, name, area_type: area })
            });
            const data = await res.json();
            if (data.success) {
                this.closeAddTableModal();
                await this.loadTables();
            } else {
                throw new Error(data.message || 'Không thể tạo bàn.');
            }
        } catch (error) {
            if (message) {
                message.textContent = error.message || 'Không thể tạo bàn.';
                message.classList.remove('hidden');
            }
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.innerHTML = '<i class="fas fa-plus mr-1"></i>Tạo bàn';
            }
        }
    },

    async deleteTable(tableId) {
        if (!confirm('Bạn có chắc muốn xóa bàn này?')) return;
        try {
            const res = await fetch('api/tables.php?action=delete_table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tableId })
            });
            const data = await res.json();
            if (data.success) {
                await this.loadTables();
            } else {
                alert(data.message || 'Lỗi xóa bàn');
            }
        } catch (e) {
            console.error('Error deleting table:', e);
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
                tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-500 text-sm">Chưa có hóa đơn nào trong khoảng thời gian này</td></tr>';
                return;
            }

            let html = '';
            data.data.forEach(o => {
                const statusBadge = o.status === 'completed' 
                    ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">Đã thanh toán</span>'
                    : (o.status === 'pending' 
                        ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">Đang dùng</span>' 
                        : '<span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold">Đã hủy</span>');

                html += `
                    <tr class="border-b border-white/5 hover:bg-slate-800/40 transition-colors">
                        <td class="p-3 text-xs font-mono font-bold text-sky-400">${o.order_code}</td>
                        <td class="p-3 text-xs font-bold text-white">${o.table_code}</td>
                        <td class="p-3 text-xs text-slate-300">${o.created_at}</td>
                        <td class="p-3 text-xs text-slate-300">${o.user_name || 'Thu ngân'}</td>
                        <td class="p-3 text-sm font-black text-emerald-400 font-mono">${this.formatMoney(o.total_amount)} đ</td>
                        <td class="p-3">${statusBadge}</td>
                        <td class="p-3 text-right">
                            <button type="button" class="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500 hover:text-white text-xs" onclick="Admin.viewOrderDetail(${o.id})">
                                <i class="fas fa-eye"></i> Chi tiết
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
            const storeName = this.escapeHtml(data.store?.name || 'CỬA HÀNG');
            const hotline = this.escapeHtml(data.store?.hotline || '');
            const address = this.escapeHtml(data.store?.address || '');
            const wifi = this.escapeHtml(data.store?.wifi || '');

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
                    <div style="font-size: 9px; color: #777; margin-top: 2px;">In lại từ Quản trị POS</div>
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
            tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500 text-sm">Chưa có nhân viên nào</td></tr>';
            return;
        }

        let html = '';
        this.users.forEach(u => {
            let roleBadge = '';
            let codeColor = 'text-sky-300 bg-sky-500/10 border-sky-500/20';

            if (u.role === 'admin') {
                roleBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">Quản Trị (ADM)</span>';
                codeColor = 'text-purple-300 bg-purple-500/10 border-purple-500/20';
            } else if (u.role === 'cashier') {
                roleBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Thu Ngân (ACC)</span>';
                codeColor = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
            } else if (u.role === 'kitchen') {
                roleBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Bếp / Bar (KIT)</span>';
                codeColor = 'text-amber-300 bg-amber-500/10 border-amber-500/20';
            } else if (u.role === 'customer') {
                roleBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">Khách Hàng (USR)</span>';
                codeColor = 'text-pink-300 bg-pink-500/10 border-pink-500/20';
            } else {
                roleBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">Phục Vụ (STF)</span>';
                codeColor = 'text-sky-300 bg-sky-500/10 border-sky-500/20';
            }

            const isLocked = u.status === 'locked';

            html += `
                <tr class="border-b border-white/5 hover:bg-slate-800/40 transition-colors ${isLocked ? 'opacity-50' : ''}">
                    <td class="p-3 text-xs font-mono font-black">
                        <span class="px-2 py-0.5 rounded-md border font-bold ${codeColor}">${u.user_code || `U${u.id}`}</span>
                    </td>
                    <td class="p-3 text-sm font-bold text-slate-200 font-mono">${u.username}</td>
                    <td class="p-3 text-sm font-bold text-white">${u.fullname}</td>
                    <td class="p-3">${roleBadge}</td>
                    <td class="p-3 text-xs text-slate-300 font-mono">${u.phone || '-'}</td>
                    <td class="p-3 text-xs text-amber-400 font-mono font-bold">${u.pin_code || '-'}</td>
                    <td class="p-3">
                        <button type="button" onclick="Admin.toggleUserStatus(${u.id})" class="px-2 py-0.5 rounded text-xs font-bold ${isLocked ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">
                            ${isLocked ? 'Đang khóa' : 'Hoạt động'}
                        </button>
                    </td>
                    <td class="p-3 text-right space-x-1">
                        <button type="button" class="px-2 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500 hover:text-white text-xs" onclick="Admin.openEditUserModal(${u.id})" title="Sửa thông tin">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-white text-xs" onclick="Admin.openResetPassModal(${u.id})" title="Đổi mật khẩu / PIN">
                            <i class="fas fa-key"></i>
                        </button>
                        <button type="button" class="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white text-xs" onclick="Admin.deleteUser(${u.id})" title="Xóa người dùng">
                            <i class="fas fa-trash"></i>
                        </button>
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
            if (!data.success) return;

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
                    staffTbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500">Chưa có dữ liệu nhân viên trong khoảng thời gian này</td></tr>`;
                } else {
                    let html = '';
                    staff.forEach((u, i) => {
                        let roleBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">Nhân viên</span>';
                        if (u.role === 'admin') roleBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">Quản Lý</span>';
                        if (u.role === 'cashier') roleBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Thu Ngân</span>';
                        if (u.role === 'waiter') roleBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">Phục Vụ</span>';
                        if (u.role === 'kitchen') roleBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Bếp / Bar</span>';

                        const rankMedal = i === 0 ? '🥇 ' : (i === 1 ? '🥈 ' : (i === 2 ? '🥉 ' : ''));

                        html += `
                            <tr class="border-b border-white/5 hover:bg-slate-800/40 transition-colors">
                                <td class="p-2.5 font-bold text-white flex items-center gap-1.5">
                                    <span>${rankMedal}</span>
                                    <span>${u.fullname}</span>
                                    <span class="text-[10px] text-slate-400 font-mono">(@${u.username})</span>
                                </td>
                                <td class="p-2.5">${roleBadge}</td>
                                <td class="p-2.5 text-center font-mono font-bold text-sky-400">${u.orders_created}</td>
                                <td class="p-2.5 text-center font-mono font-bold text-emerald-400">${u.orders_served}</td>
                                <td class="p-2.5 text-right font-mono font-bold text-amber-300">${this.formatMoney(u.total_revenue)} đ</td>
                                <td class="p-2.5 text-center font-mono text-slate-300">${u.avg_deliver_minutes > 0 ? (u.avg_deliver_minutes + 'p') : '--'}</td>
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
                    dishesTbody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-500">Chưa có món nào được chế biến</td></tr>`;
                } else {
                    let html = '';
                    dishes.forEach((d, i) => {
                        html += `
                            <tr class="border-b border-white/5 hover:bg-slate-800/40 transition-colors">
                                <td class="p-2.5 font-bold text-white">
                                    <span class="text-amber-400 font-mono mr-1">${i + 1}.</span>
                                    <span>${d.product_name}</span>
                                </td>
                                <td class="p-2.5 text-center font-mono font-bold text-amber-300">
                                    <span class="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">x${d.total_qty} ${d.unit || ''}</span>
                                </td>
                                <td class="p-2.5 text-right font-mono font-bold text-slate-200">${this.formatMoney(d.total_revenue)} đ</td>
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
                    logsTbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">Chưa có sự kiện nào trong khoảng thời gian này</td></tr>`;
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
        this.invalidateCloudSnapshots();
        this.loadBackupSchedule();

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

    async createLocalBackup() {
        const button = document.getElementById('btn-local-backup');
        if (button) button.disabled = true;
        this.showSyncAlert('info', 'Đang tạo bản sao local, vui lòng chờ.');
        try {
            const response = await fetch('api/local_backup.php?action=create', { method: 'POST' });
            const data = await response.json();
            if (!response.ok || !data.success) {
                this.showSyncAlert('error', this.escapeHtml(data.message || 'Không thể tạo bản sao local.'));
                return;
            }
            this.showSyncAlert('success', `Đã sao lưu local trong <b>${this.escapeHtml(data.backup.directory)}</b>\nTệp: <b>${this.escapeHtml(data.backup.name)}</b>\nKích thước: ${data.backup.bytes} byte.`);
        } catch (error) {
            console.error('Local backup error:', error);
            this.showSyncAlert('error', 'Không thể gửi yêu cầu sao lưu local.');
        } finally {
            if (button) button.disabled = false;
        }
    },

    async loadBackupSchedule() {
        const status = document.getElementById('backup-schedule-status');
        const button = document.getElementById('btn-backup-schedule');
        if (button) button.disabled = true;
        try {
            const response = await fetch('api/local_backup.php?action=schedule_status', { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || !data.success) {
                if (status) status.textContent = data.message || 'Không thể đọc lịch sao lưu.';
                return;
            }
            if (!data.state) {
                if (status) status.textContent = 'Chưa bật lịch sao lưu.';
                if (button) button.disabled = false;
                return;
            }
            const state = data.state;
            const due = new Date(state.next_due * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
            const workerActive = state.last_tick_at > 0 && state.last_tick_at <= data.server_time + 300
                && data.server_time - state.last_tick_at <= 90;
            const worker = workerActive ? 'Bộ lập lịch đang hoạt động.' : 'Chưa thấy bộ lập lịch hoạt động; cần khởi động lại POS bằng bộ chạy mới.';
            if (status) status.textContent = `Đã bật • Hạn kế tiếp: ${due} • ${worker}${state.last_error ? ' Lỗi: ' + state.last_error : ''}`;
            if (button) button.textContent = 'Lịch đã được kích hoạt';
        } catch (error) {
            console.error('Backup schedule status error:', error);
            if (status) status.textContent = 'Không thể kiểm tra lịch sao lưu.';
        }
    },

    async activateBackupSchedule() {
        if (!confirm('Tạo bản sao mốc đầu tiên và bật sao lưu theo quý? Với quán mới, hãy hoàn tất setup trước.')) return;
        const button = document.getElementById('btn-backup-schedule');
        if (button) button.disabled = true;
        try {
            const response = await fetch('api/local_backup.php?action=activate_schedule', { method: 'POST' });
            const data = await response.json();
            if (!response.ok || !data.success) {
                this.showSyncAlert('error', this.escapeHtml(data.message || 'Không thể bật lịch sao lưu.'));
            } else {
                this.showSyncAlert('success', `Đã tạo mốc đầu: <b>${this.escapeHtml(data.backup.name)}</b>.`);
            }
        } catch (error) {
            console.error('Backup schedule activation error:', error);
            this.showSyncAlert('error', 'Không thể gửi yêu cầu bật lịch sao lưu.');
        } finally {
            await this.loadBackupSchedule();
        }
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
        return {
            host: hostEl && hostEl.value ? hostEl.value.trim() : '127.0.0.1',
            port: parseInt(portEl && portEl.value ? portEl.value : '3306'),
            database: dbEl && dbEl.value ? dbEl.value.trim() : 'pos_sale_app',
            user: userEl && userEl.value ? userEl.value.trim() : 'root',
            password: pwdEl && pwdEl.value ? pwdEl.value : '',
            auto_create_db: autoCreateEl ? autoCreateEl.checked : true,
            save_config: false
        };
    },

    cloudSnapshotTarget(payload) {
        return JSON.stringify([payload.host, payload.port, payload.database, payload.user]);
    },

    invalidateCloudSnapshots() {
        this.cloudSnapshotGeneration = (this.cloudSnapshotGeneration || 0) + 1;
        this.cloudSnapshotPage = 1;
        this.cloudSnapshotPages = 1;
        this.cloudSnapshotTargetKey = null;
        const select = document.getElementById('cloud-snapshot-select');
        if (select) {
            select.replaceChildren(new Option('Chưa tải danh sách', ''));
            select.disabled = true;
        }
        const pageInfo = document.getElementById('cloud-snapshot-page');
        if (pageInfo) pageInfo.textContent = 'Chưa tải danh sách';
        this.updateCloudSnapshotButtons();
    },

    updateCloudSnapshotButtons() {
        const select = document.getElementById('cloud-snapshot-select');
        const prev = document.getElementById('btn-cloud-prev');
        const next = document.getElementById('btn-cloud-next');
        const download = document.getElementById('btn-cloud-download');
        if (prev) prev.disabled = !this.cloudSnapshotTargetKey || this.cloudSnapshotPage <= 1;
        if (next) next.disabled = !this.cloudSnapshotTargetKey || this.cloudSnapshotPage >= this.cloudSnapshotPages;
        if (download) download.disabled = !this.cloudSnapshotTargetKey || !select || !select.value;
    },

    async listCloudSnapshots(page) {
        const payload = this.getSyncFormData();
        payload.page = page;
        const target = this.cloudSnapshotTarget(payload);
        const generation = (this.cloudSnapshotGeneration || 0) + 1;
        this.cloudSnapshotGeneration = generation;
        this.cloudSnapshotTargetKey = null;
        const select = document.getElementById('cloud-snapshot-select');
        if (select) {
            select.replaceChildren(new Option('Đang tải danh sách', ''));
            select.disabled = true;
        }
        this.updateCloudSnapshotButtons();
        const button = document.getElementById('btn-cloud-list');
        if (button) button.disabled = true;
        this.showSyncAlert('info', 'Đang tải danh sách snapshot đầy đủ từ MySQL.');
        try {
            const response = await fetch('api/sync_mysql.php?action=list_snapshots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (generation !== this.cloudSnapshotGeneration) return;
            if (!response.ok || !data.success) {
                this.showSyncAlert('error', this.escapeHtml(data.message || 'Không thể tải danh sách snapshot.'));
                return;
            }
            select.replaceChildren(new Option(data.snapshots.length ? 'Chọn một snapshot' : 'Không có snapshot đầy đủ', ''));
            for (const snapshot of data.snapshots) {
                select.add(new Option(`${snapshot.created_at} UTC — ${snapshot.byte_size} byte — ${snapshot.snapshot_id}`, snapshot.snapshot_id));
            }
            select.disabled = !data.snapshots.length;
            this.cloudSnapshotTargetKey = target;
            this.cloudSnapshotPage = data.page;
            this.cloudSnapshotPages = data.pages;
            document.getElementById('cloud-snapshot-page').textContent = `Trang ${data.page}/${data.pages} • ${data.total} bản`;
            this.updateCloudSnapshotButtons();
            this.showSyncAlert('success', 'Đã tải danh sách snapshot đầy đủ. Hãy xác nhận đúng nguồn trước khi tải.');
        } catch (error) {
            console.error('Cloud snapshot list error:', error);
            if (generation === this.cloudSnapshotGeneration) this.showSyncAlert('error', 'Không thể tải danh sách snapshot.');
        } finally {
            if (button) button.disabled = false;
        }
    },

    async downloadCloudSnapshot() {
        const payload = this.getSyncFormData();
        const select = document.getElementById('cloud-snapshot-select');
        if (!select || !select.value || this.cloudSnapshotTargetKey !== this.cloudSnapshotTarget(payload)) {
            this.invalidateCloudSnapshots();
            this.showSyncAlert('error', 'Thông tin MySQL đã thay đổi. Hãy tải lại danh sách và chọn snapshot.');
            return;
        }
        payload.snapshot_id = select.value;
        const button = document.getElementById('btn-cloud-download');
        if (button) button.disabled = true;
        this.showSyncAlert('info', 'Đang tải và kiểm tra snapshot. CSDL hiện tại không bị thay đổi.');
        try {
            const response = await fetch('api/sync_mysql.php?action=download_snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                this.showSyncAlert('error', this.escapeHtml(data.message || 'Không thể tải snapshot.'));
                return;
            }
            this.showSyncAlert('success', `Đã tải snapshot vào <b>${this.escapeHtml(data.backup.directory)}</b>\nTệp: <b>${this.escapeHtml(data.backup.name)}</b>\nCSDL đang sử dụng không bị thay đổi.`);
        } catch (error) {
            console.error('Cloud snapshot download error:', error);
            this.showSyncAlert('error', 'Không thể tải snapshot.');
        } finally {
            this.updateCloudSnapshotButtons();
        }
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

        if (!confirm(`Đồng bộ các bảng hỗ trợ và tạo bản sao đầy đủ SQLite lên MySQL tại ${payload.host}:${payload.port} [DB: ${payload.database}]?\n\nẢnh và video không được sao lưu.`)) {
            return;
        }

        try {
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-white"></i><span>Đang đồng bộ...</span>';
            }
            this.showSyncAlert('info', 'Đang đồng bộ các bảng hỗ trợ và tạo bản sao đầy đủ SQLite... Vui lòng chờ.');

            const res = await fetch('api/sync_mysql.php?action=sync_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                this.showSyncAlert(
                    'success',
                    `🎉 <b>${this.escapeHtml(data.message)}</b>\n• Máy chủ: <b>${this.escapeHtml(data.host)} (${this.escapeHtml(data.server_version)})</b> | CSDL: <b>${this.escapeHtml(data.database)}</b>\n• Bản sao: <b>${this.escapeHtml(data.snapshot.id)}</b> (${data.snapshot.bytes} byte)\n• Số bản ghi ở các bảng đồng bộ cũ: <b>${data.total_records} dòng</b>\n• Thời gian hoàn thành: <b>${data.synced_at}</b>`
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
                this.showSyncAlert('error', this.escapeHtml(data.message || 'Đồng bộ dữ liệu thất bại!'), data.technical);
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
        const selected = document.getElementById(`ops-subtab-${this.currentOpsSubtab}`)
            ? this.currentOpsSubtab
            : ['realtime', 'inventory', 'payroll', 'kpi'].find(s => document.getElementById(`ops-subtab-${s}`));
        if (!selected) return;
        this.switchOpsSubtab(selected);
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
        if (subtab === 'inventory') this.loadMaterials();
        if (subtab === 'payroll') this.loadPayroll();
        if (subtab === 'kpi') this.loadKpi();
    },

    // 8.7 Báo cáo tài chính (module finance_reports)
    finData: null,
    finExpenses: [],
    finChart: null,

    finMonth() {
        const input = document.getElementById('fin-month-input');
        if (input && !input.value) {
            const now = new Date();
            input.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        return input?.value || '';
    },

    async loadFinance() {
        const month = this.finMonth();
        try {
            const [rep, exp] = await Promise.all([
                fetch(`api/finance.php?action=get_report&month=${encodeURIComponent(month)}`).then(r => r.json()),
                fetch(`api/finance.php?action=list_expenses&month=${encodeURIComponent(month)}`).then(r => r.json()),
            ]);
            if (!rep.success) return;
            this.finData = rep;
            this.finExpenses = exp.success ? exp.data : [];
            this.renderFinance(rep);
        } catch (e) {
            console.error('loadFinance error:', e);
        }
    },

    renderFinance(data) {
        const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const money = v => `${this.formatMoney(v)} đ`;
        const s = data.summary, prev = data.previous;
        const delta = (cur, old) => {
            if (!old) return '';
            const pct = Math.round((cur - old) / Math.abs(old) * 100);
            return `<span class="${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'} text-[10px] font-bold">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% so với kỳ trước</span>`;
        };
        const card = (label, value, cls, extra = '') => `
            <div class="liquid-glass rounded-xl border border-white/10 p-3">
                <div class="text-[11px] text-slate-400">${label}</div>
                <div class="font-mono font-black text-base ${cls}">${value}</div>
                <div>${extra}</div>
            </div>`;
        document.getElementById('fin-kpi-cards').innerHTML =
            card('Doanh thu bán hàng', money(s.gross_revenue), 'text-sky-300', delta(s.gross_revenue, prev.gross_revenue)) +
            card('Giá vốn', money(s.cogs), 'text-amber-300', `<span class="text-[10px] text-slate-400">${s.cogs_ratio}% doanh thu thuần</span>`) +
            card('Lợi nhuận gộp', money(s.gross_profit), 'text-emerald-300', `<span class="text-[10px] text-slate-400">Biên ${s.gross_margin}%</span>`) +
            card('Lợi nhuận trước thuế', money(s.profit_before_tax), s.profit_before_tax >= 0 ? 'text-emerald-300' : 'text-rose-400', delta(s.profit_before_tax, prev.profit_before_tax)) +
            card(s.net_profit >= 0 ? 'Lãi ròng sau thuế' : 'Lỗ ròng', money(s.net_profit), s.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400', `<span class="text-[10px] text-slate-400">Biên ${s.net_margin}% · ${s.orders} đơn</span>`);

        const pct = v => s.net_revenue > 0 ? `${(v / s.net_revenue * 100).toFixed(1)}%` : '';
        // sub: dòng tổng (nền nhấn); minus: dòng trừ thụt vào
        const row = (label, value, cls = 'text-slate-100', bold = false, hint = '', rawVal = null) =>
            `<tr style="${bold ? 'background:rgba(148,163,184,.10);border-top:1px solid rgba(148,163,184,.25)' : 'border-bottom:1px solid rgba(148,163,184,.08)'}">
                <td class="py-2 px-2 ${bold ? 'font-bold text-white' : 'text-slate-300'}" style="${bold ? '' : 'padding-left:1.25rem'}">${label}${hint ? `<div class="text-[10px] text-slate-500 font-normal">${hint}</div>` : ''}</td>
                <td class="py-2 px-2 text-right text-[10px] text-slate-500 font-mono whitespace-nowrap">${rawVal === null ? '' : pct(rawVal)}</td>
                <td class="py-2 px-2 text-right font-mono whitespace-nowrap ${bold ? 'font-black' : ''} ${cls}">${value}</td>
            </tr>`;
        const t = s.taxes;
        const payrollNote = s.payroll_source === 'kpi' ? 'Lương giờ + phụ cấp + thưởng - phạt (module KPI)' : (s.payroll_source === 'attendance' ? 'Theo chấm công' : (s.payroll_source === 'manual' ? 'Nhập tay (tháng chưa có chấm công)' : ''));
        const pbtCls = s.profit_before_tax >= 0 ? 'text-emerald-300' : 'text-rose-400';
        document.getElementById('fin-pnl').innerHTML =
            `<thead><tr class="text-[10px] uppercase text-slate-500"><th class="px-2 pb-1 text-left font-semibold">Chỉ tiêu</th><th class="px-2 pb-1 text-right font-semibold">% DT thuần</th><th class="px-2 pb-1 text-right font-semibold">Số tiền</th></tr></thead><tbody>` +
            row('Doanh thu bán hàng', money(s.gross_revenue), 'text-sky-300', true, `${s.orders} đơn · TB ${money(s.avg_order)}/đơn · giảm giá ${money(s.discount)}`, s.gross_revenue) +
            (s.tax_method === 'deduction' ? row('(-) VAT đầu ra', money(t.vat_output), 'text-slate-400', false, '', t.vat_output) : '') +
            row('Doanh thu thuần', money(s.net_revenue), 'text-sky-300', true, '', s.net_revenue) +
            row('(-) Giá vốn hàng bán', money(s.cogs), 'text-amber-300', false, s.cogs_estimated_orders ? `${s.cogs_estimated_orders} đơn chưa có chi tiết món, giá vốn ước tính` : '', s.cogs) +
            row('Lợi nhuận gộp', money(s.gross_profit), 'text-emerald-300', true, '', s.gross_profit) +
            row('(-) Chi phí vận hành', money(s.opex), 'text-slate-100', false, '', s.opex) +
            row('(-) Chi phí nhân sự', money(s.payroll), 'text-slate-100', false, payrollNote, s.payroll) +
            row('Lợi nhuận trước thuế', money(s.profit_before_tax), pbtCls, true, '', s.profit_before_tax) +
            (s.tax_method === 'deduction'
                ? row('(-) Thuế TNDN', money(t.cit), 'text-rose-300', false, '', t.cit)
                : row('(-) Thuế GTGT + TNCN', money(t.total), 'text-rose-300', false, '', t.total)) +
            row(s.net_profit >= 0 ? 'Lãi ròng sau thuế' : 'Lỗ ròng', money(s.net_profit), s.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400', true, '', s.net_profit) +
            '</tbody>';

        const groups = data.expense_groups;
        const gTotal = groups.reduce((a, g) => a + g.amount, 0) || 1;
        document.getElementById('fin-expense-groups').innerHTML = groups.map(g => `
            <div>
                <div class="flex justify-between"><span class="text-slate-300">${esc(g.label)}</span><span class="font-mono text-amber-300">${money(g.amount)}</span></div>
                <div class="h-1.5 rounded mt-0.5" style="background:rgba(148,163,184,.15)"><div class="h-1.5 rounded" style="background:rgba(251,191,36,.75);width:${Math.round(g.amount / gTotal * 100)}%"></div></div>
            </div>`).join('') || '<div class="text-slate-400">Chưa có khoản chi nào.</div>';

        const line = (l, v, cls = 'text-slate-100') => `<div class="flex justify-between gap-2"><span class="text-slate-300">${l}</span><span class="font-mono ${cls}">${v}</span></div>`;
        const r = s.tax_rates;
        document.getElementById('fin-tax').innerHTML = (s.tax_method === 'deduction'
            ? line(`VAT đầu ra (${r.vat}%)`, money(t.vat_output)) + line('VAT đầu vào được khấu trừ', money(t.vat_input)) +
              line(t.vat_payable >= 0 ? 'VAT phải nộp' : 'VAT được khấu trừ chuyển kỳ sau', money(Math.abs(t.vat_payable)), 'text-rose-300') +
              line(`Thuế TNDN (${r.cit}%)`, money(t.cit), 'text-rose-300')
            : line(`GTGT trên doanh thu (${r.rev_vat}%)`, money(t.vat_revenue), 'text-rose-300') +
              line(`TNCN trên doanh thu (${r.rev_pit}%)`, money(t.pit_revenue), 'text-rose-300')) +
            line('<b>Tổng thuế phải nộp</b>', `<b>${money(t.total)}</b>`, 'text-rose-300') +
            '<div class="border-t border-white/10 my-2"></div>' +
            line('Doanh thu hòa vốn', s.break_even_revenue !== null ? money(s.break_even_revenue) : 'n/a', 'text-sky-300') +
            (s.break_even_revenue !== null ? `<div class="text-[10px] text-slate-500">${s.net_revenue >= s.break_even_revenue ? 'Đã vượt' : 'Chưa đạt'} điểm hòa vốn (chi phí vận hành + nhân sự coi là cố định)</div>` : '');

        const pmLabels = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', banking: 'Chuyển khoản', card: 'Thẻ' };
        const pmTotals = {};
        data.by_method.forEach(m => {
            const label = pmLabels[m.method] || esc(m.method);
            pmTotals[label] = (pmTotals[label] || 0) + Number(m.revenue);
        });
        document.getElementById('fin-breakdown').innerHTML =
            data.by_category.map(c => line(esc(c.name) + ` <span class="text-slate-500">(${c.qty})</span>`, money(c.revenue), 'text-emerald-300')).join('') +
            '<div class="border-t border-white/10 my-2"></div>' +
            Object.entries(pmTotals).map(([label, rev]) => line(label, money(rev), 'text-sky-300')).join('');

        const days = data.daily;
        if (this.finChart) { this.finChart.destroy(); this.finChart = null; }
        const canvas = document.getElementById('fin-daily-chart');
        if (canvas && window.Chart) {
            this.finChart = new Chart(canvas, {
                type: 'bar',
                data: { labels: days.map(d => d.d.slice(8)), datasets: [{ label: 'Doanh thu', data: days.map(d => Math.round(d.revenue)), backgroundColor: 'rgba(20,184,166,0.6)', borderRadius: 3 }] },
                options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${this.formatMoney(c.parsed.y)} đ` } } },
                    scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8', callback: v => `${Math.round(v / 1000000)}tr` } } } },
            });
        }

        const cats = data.categories;
        document.getElementById('fin-expense-tbody').innerHTML = this.finExpenses.map(e => `
            <tr class="hover:bg-white/5">
                <td class="py-2 px-3 font-mono">${esc(e.expense_date)}</td>
                <td class="py-2 px-3">${esc(cats[e.category] || e.category)}</td>
                <td class="py-2 px-3 max-w-[280px] truncate" title="${esc(e.description)}">${esc(e.description)}</td>
                <td class="py-2 px-3 text-slate-400">${esc(e.supplier)}</td>
                <td class="py-2 px-3 text-right font-mono text-amber-300">${money(e.amount)}</td>
                <td class="py-2 px-3 text-right font-mono text-slate-400">${money(e.vat_amount)}</td>
                <td class="py-2 px-3 text-right">
                    <button type="button" onclick="Admin.openFinExpenseModal(${Number(e.id)})" class="text-sky-400 hover:text-sky-300 px-1" title="Sửa"><i class="fas fa-pen"></i></button>
                    <button type="button" onclick="Admin.deleteFinExpense(${Number(e.id)})" class="text-rose-400 hover:text-rose-300 px-1" title="Xóa"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('') || '<tr><td colspan="7" class="text-center py-6 text-slate-400">Chưa có khoản chi trong kỳ.</td></tr>';
    },

    openFinExpenseModal(id) {
        const e = id ? this.finExpenses.find(x => Number(x.id) === id) : null;
        const sel = document.getElementById('fin-exp-category');
        sel.innerHTML = Object.entries(this.finData?.categories || {}).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
        const month = this.finMonth();
        document.getElementById('fin-exp-id').value = e ? e.id : '';
        document.getElementById('fin-exp-date').value = e ? e.expense_date : `${month}-01`;
        sel.value = e ? e.category : 'other';
        document.getElementById('fin-exp-desc').value = e ? e.description : '';
        document.getElementById('fin-exp-supplier').value = e ? e.supplier : '';
        document.getElementById('fin-exp-amount').value = e ? e.amount : '';
        document.getElementById('fin-exp-vat').value = e ? e.vat_amount : 0;
        document.getElementById('modal-fin-expense').classList.add('open');
    },

    openFinTaxModal() {
        const t = this.finData?.tax_settings || {};
        document.getElementById('fin-tax-method').value = t.finance_tax_method || 'deduction';
        document.getElementById('fin-tax-vat').value = t.finance_vat_rate ?? 8;
        document.getElementById('fin-tax-cit').value = t.finance_cit_rate ?? 20;
        document.getElementById('fin-tax-rev-vat').value = t.finance_rev_vat_rate ?? 3;
        document.getElementById('fin-tax-rev-pit').value = t.finance_rev_pit_rate ?? 1.5;
        document.getElementById('modal-fin-tax').classList.add('open');
    },

    closeFinModals() {
        ['modal-fin-expense', 'modal-fin-tax'].forEach(id => document.getElementById(id)?.classList.remove('open'));
    },

    async finPost(action, body) {
        const res = await fetch(`api/finance.php?action=${action}`, {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) alert(data.message || 'Có lỗi xảy ra.');
        return data.success;
    },

    async saveFinExpense(ev) {
        ev.preventDefault();
        const v = id => document.getElementById(id).value;
        const ok = await this.finPost('save_expense', {
            id: v('fin-exp-id'), expense_date: v('fin-exp-date'), category: v('fin-exp-category'), description: v('fin-exp-desc'),
            supplier: v('fin-exp-supplier'), amount: v('fin-exp-amount'), vat_amount: v('fin-exp-vat'),
        });
        if (ok) { this.closeFinModals(); this.loadFinance(); }
    },

    async deleteFinExpense(id) {
        if (!confirm('Xóa khoản chi này?')) return;
        if (await this.finPost('delete_expense', { id })) this.loadFinance();
    },

    async saveFinTax(ev) {
        ev.preventDefault();
        const v = id => document.getElementById(id).value;
        const ok = await this.finPost('save_tax_settings', {
            finance_tax_method: v('fin-tax-method'), finance_vat_rate: v('fin-tax-vat'), finance_cit_rate: v('fin-tax-cit'),
            finance_rev_vat_rate: v('fin-tax-rev-vat'), finance_rev_pit_rate: v('fin-tax-rev-pit'),
        });
        if (ok) { this.closeFinModals(); this.loadFinance(); }
    },

    exportFinanceCsv() {
        window.location.href = `api/finance.php?action=export_csv&month=${encodeURIComponent(this.finMonth())}`;
    },

    // 8.6 KPI, phụ cấp, thưởng/phạt
    kpiData: null,

    async loadKpi() {
        const input = document.getElementById('kpi-month-input');
        if (input && !input.value) {
            const now = new Date();
            input.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        try {
            const res = await fetch(`api/kpi.php?action=get_kpi&month=${encodeURIComponent(input?.value || '')}`);
            const data = await res.json();
            if (!data.success) return;
            this.kpiData = data;
            this.renderKpi(data);
        } catch (e) {
            console.error('loadKpi error:', e);
        }
    },

    renderKpi(data) {
        const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const money = v => `${this.formatMoney(v)} đ`;
        const setTxt = (id, t) => { const el = document.getElementById(id); if (el) el.innerText = t; };
        const t = data.totals;
        setTxt('kpi-total-hourly', money(t.hourly_pay));
        setTxt('kpi-total-allowance', money(t.allowance));
        setTxt('kpi-total-bonus', money(t.bonus));
        setTxt('kpi-total-deduction', money(t.deduction));
        setTxt('kpi-total-net', money(t.net));
        setTxt('kpi-target-note', `Mục tiêu ${data.target_shifts} ca`);
        const w = data.weights, r = data.rules;
        setTxt('kpi-rules-note',
            `Trọng số: chuyên cần ${w.attendance}% · đúng giờ ${w.punctuality}% · kỷ luật ${w.discipline}% · năng suất ${w.performance}% · thái độ ${w.attitude}% · phối hợp ${w.teamwork}% (mục chưa chấm được bỏ qua). ` +
            `Thưởng KPI: hạng A ${r.bonus_pct.A}%, hạng B ${r.bonus_pct.B}% lương giờ; nhân viên xuất sắc mỗi vai trò +${this.formatMoney(r.top_bonus)} đ; ` +
            `đi trễ quá ${r.late_tolerance_min} phút phạt ${this.formatMoney(r.late_fine)} đ/lần.`);

        const gradeCls = { A: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', B: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
            C: 'bg-amber-500/20 text-amber-300 border-amber-500/40', D: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
        const roleLabels = { cashier: 'Thu ngân', kitchen: 'Bếp', waiter: 'Phục vụ' };
        const sc = v => v === null || v === undefined ? '<span class="text-slate-600">–</span>' : Math.round(v);
        const tbody = document.getElementById('kpi-tbody');
        if (!tbody) return;
        tbody.innerHTML = data.employees.map(e => {
            const p = e.pay, s = e.scores;
            const bonus = p.kpi_bonus + p.top_bonus + p.manual_bonus;
            const deduct = p.late_fine + p.manual_deduction;
            return `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="py-2.5 px-3">
                    <div class="font-bold text-slate-100">${esc(e.fullname)} ${e.top_performer ? '<span title="Nhân viên xuất sắc">🏆</span>' : ''}</div>
                    <div class="text-[10px] text-slate-400"><span class="font-mono text-sky-400">${esc(e.user_code)}</span> · ${roleLabels[e.role] || esc(e.role)} · ${this.formatMoney(e.hourly_rate)} đ/h</div>
                </td>
                <td class="py-2.5 px-3 text-center font-mono">${e.shifts} / <span class="${e.late_count ? 'text-amber-300' : ''}">${e.late_count}</span> / <span class="${e.incidents ? 'text-rose-300' : ''}">${e.incidents}</span></td>
                <td class="py-2.5 px-3 text-center font-mono">${e.orders}${e.avg_speed !== null ? `<div class="text-[10px] text-slate-400">${e.avg_speed} phút/đơn</div>` : ''}</td>
                <td class="py-2.5 px-3 text-center font-mono text-[11px] text-slate-300">${sc(s.attendance)} · ${sc(s.punctuality)} · ${sc(s.discipline)} · ${sc(s.performance)} · ${sc(s.attitude)} · ${sc(s.teamwork)}</td>
                <td class="py-2.5 px-3 text-center">
                    <span class="px-2 py-0.5 rounded-full border text-[11px] font-black ${gradeCls[e.grade] || 'bg-slate-800 text-slate-400 border-white/10'}" title="${esc(e.grade_label)}">${e.total_score ?? '–'} · ${esc(e.grade)}</span>
                    ${e.evaluated ? '' : '<div class="text-[9px] text-slate-500 mt-0.5">chưa chấm thái độ</div>'}
                </td>
                <td class="py-2.5 px-3 text-right font-mono text-sky-300">${money(p.hourly_pay)}</td>
                <td class="py-2.5 px-3 text-right font-mono text-amber-300" title="Ăn ${money(p.meal)} · Chức vụ ${money(p.position)} · Đi lại ${money(p.transport)} · Khác ${money(p.other)}">${money(p.allowance_total)}</td>
                <td class="py-2.5 px-3 text-right font-mono text-emerald-300" title="KPI ${money(p.kpi_bonus)} · Xuất sắc ${money(p.top_bonus)} · Thêm ${money(p.manual_bonus)}">${money(bonus)}</td>
                <td class="py-2.5 px-3 text-right font-mono text-rose-300">${money(deduct)}</td>
                <td class="py-2.5 px-3 text-right font-mono font-black text-emerald-400">${money(p.net)}</td>
                <td class="py-2.5 px-3 text-right">
                    <button type="button" onclick="Admin.openKpiModal(${e.user_id})" class="btn-glass text-[11px] py-1 px-2.5 bg-fuchsia-500/20 hover:bg-fuchsia-500/40 text-fuchsia-300 border-fuchsia-500/30 font-bold">
                        <i class="fas fa-pen-to-square mr-1"></i> Đánh giá
                    </button>
                </td>
            </tr>`;
        }).join('') || '<tr><td colspan="11" class="text-center py-6 text-slate-400">Chưa có nhân viên.</td></tr>';
    },

    openKpiModal(userId) {
        const e = (this.kpiData?.employees || []).find(x => x.user_id === userId);
        if (!e) return;
        const val = (id, v) => { document.getElementById(id).value = v ?? ''; };
        document.getElementById('kpi-user-id').value = userId;
        document.getElementById('kpi-modal-who').innerText = `${e.fullname} (${e.user_code}) · kỳ ${this.kpiData.period} · KPI tự động ${e.total_score ?? '–'} điểm`;
        val('kpi-attitude', e.attitude_score);
        val('kpi-teamwork', e.teamwork_score);
        val('kpi-manual-bonus', e.pay.manual_bonus);
        val('kpi-manual-deduction', e.pay.manual_deduction);
        val('kpi-note', e.note);
        val('kpi-hourly-rate', e.hourly_rate);
        val('kpi-meal', e.compensation.meal_allowance);
        val('kpi-position', e.compensation.position_allowance);
        val('kpi-transport', e.compensation.transport_allowance);
        val('kpi-other', e.compensation.other_allowance);
        document.getElementById('modal-kpi').classList.add('open');
    },

    closeKpiModal() {
        document.getElementById('modal-kpi').classList.remove('open');
    },

    async saveKpi(ev) {
        ev.preventDefault();
        const g = id => document.getElementById(id).value;
        const post = async (action, body) => {
            const res = await fetch(`api/kpi.php?action=${action}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            return res.json();
        };
        const userId = parseInt(g('kpi-user-id'));
        try {
            const a = await post('save_evaluation', {
                user_id: userId, period: this.kpiData.period, attitude_score: g('kpi-attitude'), teamwork_score: g('kpi-teamwork'),
                manual_bonus: g('kpi-manual-bonus'), manual_deduction: g('kpi-manual-deduction'), note: g('kpi-note')
            });
            if (!a.success) { alert(a.message || 'Không lưu được đánh giá.'); return; }
            const b = await post('save_compensation', {
                user_id: userId, hourly_rate: g('kpi-hourly-rate'), meal_allowance: g('kpi-meal'),
                position_allowance: g('kpi-position'), transport_allowance: g('kpi-transport'), other_allowance: g('kpi-other')
            });
            if (!b.success) { alert(b.message || 'Không lưu được lương/phụ cấp.'); return; }
            this.closeKpiModal();
            this.loadKpi();
        } catch (e) {
            alert('Lỗi kết nối, vui lòng thử lại.');
        }
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
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-8 text-slate-400">
                            <i class="fas fa-user-clock text-2xl mb-2 text-slate-500 block"></i>
                            Hiện chưa có nhân viên nào trong ca làm việc hôm nay.
                            <div class="text-[11px] text-slate-500 mt-1">Khi nhân viên đăng nhập trên máy POS, Order hoặc Bếp, hệ thống sẽ tự động chấm công và hiển thị tại đây.</div>
                        </td>
                    </tr>
                `;
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
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" class="text-center py-8 text-slate-400">
                            <i class="fas fa-boxes-stacked text-2xl mb-2 text-slate-500 block"></i>
                            Chưa có nguyên vật liệu nào trong kho phù hợp với tìm kiếm.
                        </td>
                    </tr>
                `;
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
        processingImages: false,
        cameraStream: null,
        invoiceImageUrl: ''
    },
    supplierFinanceState: {
        suppliers: [],
        invoices: [],
        payments: []
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
        const cameraInput = document.getElementById('invoice-camera-input');
        if (cameraInput) cameraInput.value = '';

        // Reset các trường thông tin phiếu
        const textInputs = [
            'manual-import-supplier', 'manual-import-invoice-no', 'manual-import-note',
            'review-supplier-input', 'review-invoice-no-input',
            'manual-import-paid', 'review-import-paid', 'manual-import-due-date', 'review-import-due-date'
        ];
        textInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = el.type === 'number' ? '0' : '';
        });
        ['manual-import-payment-method', 'review-import-payment-method'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = 'cash';
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
        this.updateImportPaymentSummary();
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
        this.updateImportPaymentSummary();
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
                this.handleMultipleInvoiceFiles([files[0]]);
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

    async handleMultipleInvoiceFiles(fileList) {
        if (this.importState.processingImages) return;
        // Lọc file hình ảnh
        const imageFiles = fileList.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name));
        if (imageFiles.length === 0) {
            alert('Không tìm thấy file hình ảnh (JPG, PNG, WEBP) nào!');
            return;
        }

        this.importState.processingImages = true;
        const scanButton = document.getElementById('btn-trigger-ai-scan');
        const scanLabel = document.getElementById('btn-ai-scan-label');
        if (scanButton) scanButton.disabled = true;
        if (scanLabel) scanLabel.textContent = 'ĐANG CHUẨN HÓA ẢNH...';

        try {
            for (const file of imageFiles) {
                const optimizedFile = await ImageProcessor.processFile(file, 'invoice');
                const base64 = await ImageProcessor.fileToDataUrl(optimizedFile);
                this.importState.images.push({
                    id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    name: optimizedFile.name,
                    sizeStr: (optimizedFile.size / 1024).toFixed(1) + ' KB',
                    base64
                });
            }
            this.renderImageGallery();
        } catch (error) {
            this.renderImageGallery();
            alert(error.message || 'Không thể chuẩn hóa ảnh hóa đơn.');
        } finally {
            this.importState.processingImages = false;
            if (scanButton) scanButton.disabled = false;
            if (scanLabel) {
                const count = this.importState.images.length;
                scanLabel.textContent = count > 1
                    ? `PHÂN TÍCH ${count} ẢNH BẰNG AI`
                    : count === 1 ? 'PHÂN TÍCH BẰNG AI' : 'PHÂN TÍCH TẤT CẢ BẰNG AI';
            }
        }
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

            ImageProcessor.processCanvas(canvas, 'invoice', item.name).then(async optimizedFile => {
                const base64 = await ImageProcessor.fileToDataUrl(optimizedFile);
                item.base64 = base64;
                item.name = optimizedFile.name;
                item.sizeStr = (optimizedFile.size / 1024).toFixed(1) + ' KB';
                this.renderImageGallery();
            }).catch(error => alert(error.message || 'Không thể xoay và chuẩn hóa ảnh.'));
        };
        img.src = item.base64;
    },

    async loadSampleInvoiceDemo() {
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
        ctx.fillText('NHÀ CUNG CẤP MẪU', 300, 45);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#475569';
        ctx.fillText('Địa chỉ minh họa', 300, 75);
        ctx.fillText('PHIẾU XUẤT KHO / HÓA ĐƠN MUA HÀNG', 300, 105);

        ctx.textAlign = 'left';
        ctx.fillText('Ngày: ' + new Date().toLocaleDateString('vi-VN'), 40, 140);
        ctx.fillText('Khách hàng: CỬA HÀNG MẪU', 40, 165);

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

        const base64 = await ImageProcessor.canvasToDataUrl(canvas, 0.84, 900 * 1024);
        this.importState.images.push({
            id: 'sample_' + Date.now(),
            name: 'sample_invoice_coffee_supply.webp',
            sizeStr: (base64.length * 0.75 / 1024).toFixed(1) + ' KB',
            base64: base64,
            isSampleDemo: true
        });
        this.renderImageGallery();
    },

    // Mở Camera thiết bị trực tiếp (Chuẩn W3C tương thích 100% Safari iOS, iPadOS, Android & Desktop)
    openDeviceCamera() {
        const camInput = document.getElementById('invoice-camera-input');
        if (camInput) {
            camInput.click();
        } else {
            const fileInput = document.getElementById('invoice-file-input');
            if (fileInput) fileInput.click();
        }
    },

    // --- Phương thức 3: Chụp ảnh qua Camera / Webcam ---
    async startCamera() {
        // Kiểm tra hỗ trợ WebRTC getUserMedia (Safari trên HTTP LAN không hỗ trợ getUserMedia vì lý do bảo mật của Apple)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('WebRTC getUserMedia không được hỗ trợ trong môi trường HTTP này (đặc thù Safari iOS). Tự động chuyển sang Camera thiết bị...');
            this.openDeviceCamera();
            return;
        }

        try {
            const video = document.getElementById('camera-stream-video');
            const placeholder = document.getElementById('camera-placeholder');
            const guide = document.getElementById('camera-guide-overlay');
            const btnStart = document.getElementById('btn-start-camera');
            const btnSnap = document.getElementById('btn-snap-camera');
            const btnStop = document.getElementById('btn-stop-camera');

            // Thử danh sách cấu hình camera từ độ phân giải cao đến cơ bản để tương thích mọi dòng máy
            let stream = null;
            const constraintsList = [
                { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
                { video: { facingMode: { ideal: 'environment' } } },
                { video: { facingMode: 'user' } },
                { video: true }
            ];

            for (const c of constraintsList) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia(c);
                    if (stream) break;
                } catch (ce) {
                    console.warn('Thử cấu hình camera không khả dụng:', c, ce);
                }
            }

            if (!stream) {
                throw new Error('Không thể khởi tạo luồng camera.');
            }

            this.importState.cameraStream = stream;

            if (video) {
                video.srcObject = stream;
                // Thuộc tính bắt buộc để Safari và iOS cho phép phát video inline mà không phóng to toàn màn hình
                video.setAttribute('playsinline', '');
                video.setAttribute('webkit-playsinline', '');
                video.muted = true;
                video.classList.remove('hidden');
                try {
                    await video.play();
                } catch (playErr) {
                    console.warn('Lỗi video.play (có thể do chính sách autoplay):', playErr);
                }
            }
            if (placeholder) placeholder.classList.add('hidden');
            if (guide) guide.classList.remove('hidden');

            if (btnStart) btnStart.classList.add('hidden');
            if (btnSnap) btnSnap.classList.remove('hidden');
            if (btnStop) btnStop.classList.remove('hidden');
        } catch (err) {
            console.warn('Lỗi khi mở Live Webcam:', err);
            // Fallback ngay sang mở Camera gốc của thiết bị
            this.openDeviceCamera();
        }
    },

    async takeCameraSnapshot() {
        const video = document.getElementById('camera-stream-video');
        if (!video || !this.importState.cameraStream) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            const optimizedFile = await ImageProcessor.processCanvas(canvas, 'invoice', 'camera_capture.webp');
            const base64 = await ImageProcessor.fileToDataUrl(optimizedFile);
            const fileName = 'camera_capture_' + Date.now() + '.webp';

            this.importState.images.push({
                id: 'cam_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                name: fileName,
                sizeStr: (optimizedFile.size / 1024).toFixed(1) + ' KB',
                base64: base64
            });

            this.stopCamera();
            this.renderImageGallery();
        } catch (error) {
            alert(error.message || 'Không thể chuẩn hóa ảnh chụp.');
        }
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

    // --- BẬT/TẮT ẨN HIỆN MẬT KHẨU / API KEY ---
    togglePasswordView(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const icon = btn ? btn.querySelector('i') : null;
        if (input.type === 'password') {
            input.type = 'text';
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        } else {
            input.type = 'password';
            if (icon) {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        }
    },

    // --- MỞ / ĐÓNG KHUNG CẬP NHẬT GEMINI API KEY (CHỈ HIỂN THỊ KHI ĐANG CẬP NHẬT) ---
    toggleGeminiKeyEdit(show) {
        const inputBox = document.getElementById('gemini-key-input-box');
        const btnToggle = document.getElementById('btn-toggle-gemini-edit');
        const keyInput = document.getElementById('setting-gemini-api-key');
        if (inputBox) {
            if (show) {
                inputBox.classList.remove('hidden');
                if (btnToggle) btnToggle.classList.add('hidden');
                if (keyInput) {
                    keyInput.value = '';
                    keyInput.focus();
                }
            } else {
                inputBox.classList.add('hidden');
                if (btnToggle) btnToggle.classList.remove('hidden');
                if (keyInput) keyInput.value = '';
            }
        }
    },

    // --- KÍCH HOẠT PHÂN TÍCH AI & OCR (HỖ TRỢ NHIỀU ẢNH / FOLDER) ---
    async runAiInvoiceScan() {
        if (this.importState.processingImages) {
            alert('Vui lòng đợi chuẩn hóa ảnh hoàn tất trước khi phân tích.');
            return;
        }
        const total = this.importState.images.length;
        if (total === 0) {
            alert('Vui lòng chọn hoặc kéo thả ít nhất 1 ảnh hóa đơn / giấy viết tay!');
            return;
        }

        const statusBox = document.getElementById('import-ai-scanning-status');
        const statusText = document.getElementById('ai-scan-status-text');
        const btnScan = document.getElementById('btn-trigger-ai-scan');
        
        // Bảo mật: Xóa hoàn toàn key plaintext lưu trong localStorage cũ (nếu có)
        try { localStorage.removeItem('pos_gemini_api_key'); } catch (e) {}

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

                // Máy chủ backend tự động sử dụng khóa API bảo mật nội bộ
                const res = await fetch('api/operations.php?action=ai_parse_invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_base64: imgItem.base64,
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
        this.updateImportPaymentSummary();
    },

    updateImportPaymentSummary() {
        const totalText = document.getElementById('import-footer-total-cost')?.innerText || '0';
        const total = parseFloat(totalText.replace(/[^\d]/g, '')) || 0;
        ['manual', 'review'].forEach(prefix => {
            const amountInput = document.getElementById(`${prefix}-import-paid`);
            const summary = document.getElementById(`${prefix}-import-payment-summary`);
            if (!amountInput || !summary) return;
            const paid = Math.max(0, parseFloat(amountInput.value) || 0);
            const remaining = Math.max(0, total - paid);
            const status = paid <= 0 ? 'Chưa thanh toán' : (remaining <= 0 ? 'Đã thanh toán đủ' : 'Đã tạm ứng / thanh toán một phần');
            summary.innerText = `${status} · Còn ${this.formatMoney(remaining)} đ`;
            summary.className = `mt-1 ${remaining > 0 ? 'text-amber-300' : 'text-emerald-300'}`;
        });
    },

    // --- XÁC NHẬN NHẬP KHO HÀNG LOẠT ---
    async commitSmartImport() {
        const method = this.importState.method;
        let supplier = '';
        let invoiceNo = '';
        let note = '';
        let items = [];
        let paidAmount = 0;
        let paymentMethod = 'cash';
        let dueDate = '';

        if (method === 'manual') {
            supplier = document.getElementById('manual-import-supplier')?.value.trim() || '';
            invoiceNo = document.getElementById('manual-import-invoice-no')?.value.trim() || '';
            note = document.getElementById('manual-import-note')?.value.trim() || 'Nhập kho thủ công';
            paidAmount = parseFloat(document.getElementById('manual-import-paid')?.value || 0) || 0;
            paymentMethod = document.getElementById('manual-import-payment-method')?.value || 'cash';
            dueDate = document.getElementById('manual-import-due-date')?.value || '';

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
            paidAmount = parseFloat(document.getElementById('review-import-paid')?.value || 0) || 0;
            paymentMethod = document.getElementById('review-import-payment-method')?.value || 'cash';
            dueDate = document.getElementById('review-import-due-date')?.value || '';

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
        const importTotal = items.reduce((sum, item) => sum + Math.round(Number(item.quantity) * Number(item.unit_price)), 0);
        if (paidAmount < 0 || paidAmount > importTotal) {
            alert('Số tiền đã thanh toán phải nằm trong khoảng từ 0 đến tổng tiền hóa đơn.');
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
                    paid_amount: paidAmount,
                    payment_method: paymentMethod,
                    due_date: dueDate,
                    items: items
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.resetSmartImportForm();
                this.closeSmartImportModal();
                this.loadMaterials();
                this.loadSupplierFinance();
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
        const paymentFields = document.getElementById('modal-trans-payment-fields');
        const submitBtn = document.getElementById('btn-submit-stock-trans');

        if (type === 'import') {
            if (title) title.innerHTML = '<i class="fas fa-file-invoice-dollar text-emerald-400"></i> Lập Phiếu Nhập Kho (Chi Phí Mua Hàng)';
            if (actionLabel) actionLabel.innerText = 'nhập';
            if (priceContainer) priceContainer.classList.remove('hidden');
            if (totalBox) totalBox.classList.remove('hidden');
            if (paymentFields) paymentFields.classList.remove('hidden');
            if (submitBtn) submitBtn.className = 'btn-glass-success text-xs py-2 px-5 font-bold flex items-center gap-1.5';
        } else {
            if (title) title.innerHTML = '<i class="fas fa-dolly text-rose-400"></i> Lập Phiếu Xuất Kho Sử Dụng';
            if (actionLabel) actionLabel.innerText = 'xuất';
            if (priceContainer) priceContainer.classList.add('hidden');
            if (totalBox) totalBox.classList.add('hidden');
            if (paymentFields) paymentFields.classList.add('hidden');
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
        document.getElementById('modal-trans-invoice-no').value = '';
        document.getElementById('modal-trans-paid').value = '0';
        document.getElementById('modal-trans-payment-method').value = 'cash';
        document.getElementById('modal-trans-due-date').value = '';
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
        const paidAmount = type === 'import' ? (parseFloat(document.getElementById('modal-trans-paid').value) || 0) : 0;
        const paymentMethod = document.getElementById('modal-trans-payment-method').value;
        const dueDate = document.getElementById('modal-trans-due-date').value;
        const invoiceNo = document.getElementById('modal-trans-invoice-no').value.trim();

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
                    invoice_no: invoiceNo,
                    paid_amount: paidAmount,
                    payment_method: paymentMethod,
                    due_date: dueDate,
                    note: note
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.closeStockTransactionModal();
                this.loadMaterials();
                this.loadSupplierFinance();
            } else {
                alert(data.message || 'Lỗi khi lưu phiếu kho');
            }
        } catch (err) {
            alert('Lỗi kết nối máy chủ');
        }
    },

    // 8.4 Supplier directory, purchase invoices and accounts payable
    openSupplierFinanceModal() {
        document.getElementById('modal-supplier-finance')?.classList.add('open');
        this.loadSupplierFinance();
    },

    closeSupplierFinanceModal() {
        document.getElementById('modal-supplier-finance')?.classList.remove('open');
    },

    async loadSupplierFinance() {
        try {
            const res = await fetch('api/operations.php?action=get_supplier_finance');
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Không thể tải dữ liệu nhà cung cấp.');
            this.supplierFinanceState = {
                suppliers: data.suppliers || [],
                invoices: data.invoices || [],
                payments: data.payments || []
            };
            const summary = data.summary || {};
            document.getElementById('supplier-total-purchases').innerText = this.formatMoney(summary.total_purchases || 0) + ' đ';
            document.getElementById('supplier-total-paid').innerText = this.formatMoney(summary.total_paid || 0) + ' đ';
            document.getElementById('supplier-total-outstanding').innerText = this.formatMoney(summary.total_outstanding || 0) + ' đ';

            const supplierBody = document.getElementById('supplier-list-tbody');
            supplierBody.innerHTML = this.supplierFinanceState.suppliers.length
                ? this.supplierFinanceState.suppliers.map(s => `
                    <tr class="hover:bg-white/5">
                        <td class="p-2 font-semibold text-slate-100">${this.escapeHtml(s.name)}</td>
                        <td class="p-2 text-slate-300">${this.escapeHtml(s.contact_name || '-')}</td>
                        <td class="p-2 text-slate-300">${this.escapeHtml(s.phone || '-')}<br><span class="text-slate-500">${this.escapeHtml(s.email || '')}</span></td>
                        <td class="p-2 text-right font-mono ${Number(s.outstanding_balance) > 0 ? 'text-rose-300' : 'text-emerald-300'}">${this.formatMoney(s.outstanding_balance || 0)} đ</td>
                        <td class="p-2 text-right"><button type="button" class="text-sky-300 hover:text-sky-100" onclick="Admin.editSupplier(${Number(s.id)})">Sửa</button></td>
                    </tr>`).join('')
                : '<tr><td colspan="5" class="p-4 text-center text-slate-500">Chưa có nhà cung cấp.</td></tr>';

            const invoiceBody = document.getElementById('supplier-invoices-tbody');
            const statusLabels = { unpaid: 'Chưa thanh toán', partial: 'Tạm ứng / một phần', paid: 'Đã thanh toán' };
            invoiceBody.innerHTML = this.supplierFinanceState.invoices.length
                ? this.supplierFinanceState.invoices.map(i => `
                    <tr class="hover:bg-white/5">
                        <td class="p-2 whitespace-nowrap text-slate-300">${this.escapeHtml(i.created_at || '')}<br><span class="font-mono text-sky-300">${this.escapeHtml(i.invoice_code || '')}</span></td>
                        <td class="p-2">${this.escapeHtml(i.supplier_display_name || 'Không rõ')}<br><span class="text-slate-500">${this.escapeHtml(i.invoice_no || 'Không có số HĐ')}</span></td>
                        <td class="p-2 text-right font-mono">${this.formatMoney(i.total_amount || 0)} đ</td>
                        <td class="p-2 text-right font-mono text-emerald-300">${this.formatMoney(i.paid_amount || 0)} đ</td>
                        <td class="p-2 text-right font-mono ${Number(i.remaining_amount) > 0 ? 'text-rose-300' : 'text-slate-400'}">${this.formatMoney(i.remaining_amount || 0)} đ</td>
                        <td class="p-2 text-center whitespace-nowrap">${this.escapeHtml(i.due_date || '-')}</td>
                        <td class="p-2 text-center"><span class="px-2 py-1 rounded-full ${i.payment_status === 'paid' ? 'bg-emerald-500/15 text-emerald-300' : (i.payment_status === 'partial' ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300')}">${statusLabels[i.payment_status] || i.payment_status}</span></td>
                        <td class="p-2 text-right">${Number(i.remaining_amount) > 0 ? `<button type="button" class="btn-glass-success py-1 px-2 text-[10px]" onclick="Admin.openSupplierPayment(${Number(i.id)})">Thanh toán</button>` : ''}</td>
                    </tr>`).join('')
                : '<tr><td colspan="8" class="p-4 text-center text-slate-500">Chưa có hóa đơn nhập kho.</td></tr>';

            const paymentsList = document.getElementById('supplier-payments-list');
            paymentsList.innerHTML = this.supplierFinanceState.payments.length
                ? this.supplierFinanceState.payments.map(p => `
                    <div class="flex flex-wrap justify-between gap-2 p-2 rounded-lg bg-slate-900/60 border border-white/5">
                        <span class="text-slate-300">${this.escapeHtml(p.paid_at || '')} · ${this.escapeHtml(p.supplier_name || '')} · ${this.escapeHtml(p.invoice_code || '')} · ${this.escapeHtml(p.payment_method || 'cash')}${p.reference ? ` · ${this.escapeHtml(p.reference)}` : ''}${p.paid_by_name ? ` · ${this.escapeHtml(p.paid_by_name)}` : ''}</span>
                        <b class="text-emerald-300 font-mono">${this.formatMoney(p.amount || 0)} đ</b>
                    </div>`).join('')
                : '<div class="p-3 text-center text-slate-500">Chưa có giao dịch thanh toán.</div>';
        } catch (error) {
            console.error('loadSupplierFinance error:', error);
            alert(error.message || 'Lỗi tải dữ liệu công nợ nhà cung cấp.');
        }
    },

    resetSupplierForm() {
        document.getElementById('form-supplier')?.reset();
        document.getElementById('supplier-form-id').value = '';
        document.getElementById('supplier-form-submit').innerText = 'Thêm nhà cung cấp';
    },

    editSupplier(id) {
        const supplier = this.supplierFinanceState.suppliers.find(item => Number(item.id) === Number(id));
        if (!supplier) return;
        document.getElementById('supplier-form-id').value = supplier.id;
        document.getElementById('supplier-form-name').value = supplier.name || '';
        document.getElementById('supplier-form-contact').value = supplier.contact_name || '';
        document.getElementById('supplier-form-phone').value = supplier.phone || '';
        document.getElementById('supplier-form-email').value = supplier.email || '';
        document.getElementById('supplier-form-address').value = supplier.address || '';
        document.getElementById('supplier-form-note').value = supplier.note || '';
        document.getElementById('supplier-form-submit').innerText = 'Lưu thay đổi';
        document.getElementById('supplier-form-name').focus();
    },

    async submitSupplier(event) {
        event.preventDefault();
        const payload = {
            id: Number(document.getElementById('supplier-form-id').value || 0),
            name: document.getElementById('supplier-form-name').value.trim(),
            contact_name: document.getElementById('supplier-form-contact').value.trim(),
            phone: document.getElementById('supplier-form-phone').value.trim(),
            email: document.getElementById('supplier-form-email').value.trim(),
            address: document.getElementById('supplier-form-address').value.trim(),
            note: document.getElementById('supplier-form-note').value.trim()
        };
        try {
            const res = await fetch('api/operations.php?action=save_supplier', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Không thể lưu nhà cung cấp.');
            this.resetSupplierForm();
            await this.loadSupplierFinance();
        } catch (error) {
            alert(error.message || 'Lỗi kết nối máy chủ.');
        }
    },

    openSupplierPayment(invoiceId) {
        const invoice = this.supplierFinanceState.invoices.find(item => Number(item.id) === Number(invoiceId));
        if (!invoice) return;
        const balance = Number(invoice.remaining_amount) || 0;
        document.getElementById('supplier-payment-invoice-id').value = invoice.id;
        document.getElementById('supplier-payment-amount').value = '';
        document.getElementById('supplier-payment-amount').max = balance;
        document.getElementById('supplier-payment-reference').value = '';
        document.getElementById('supplier-payment-note').value = '';
        document.getElementById('supplier-payment-invoice-label').innerText =
            `${invoice.supplier_display_name || 'Nhà cung cấp'} · ${invoice.invoice_code} · Còn nợ ${this.formatMoney(balance)} đ`;
        document.getElementById('modal-supplier-payment').classList.add('open');
    },

    closeSupplierPaymentModal() {
        document.getElementById('modal-supplier-payment')?.classList.remove('open');
    },

    async submitSupplierPayment(event) {
        event.preventDefault();
        const payload = {
            invoice_id: Number(document.getElementById('supplier-payment-invoice-id').value),
            amount: Number(document.getElementById('supplier-payment-amount').value),
            payment_method: document.getElementById('supplier-payment-method').value,
            reference: document.getElementById('supplier-payment-reference').value.trim(),
            note: document.getElementById('supplier-payment-note').value.trim()
        };
        try {
            const res = await fetch('api/operations.php?action=record_supplier_payment', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Không thể ghi nhận thanh toán.');
            this.closeSupplierPaymentModal();
            await this.loadSupplierFinance();
        } catch (error) {
            alert(error.message || 'Lỗi kết nối máy chủ.');
        }
    },

    // 8.5 Material History & Expenses
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

            // Danh sách nhân viên cho bộ lọc nhật ký (giữ lựa chọn hiện tại)
            const userSel = document.getElementById('att-filter-user');
            if (userSel) {
                const keep = userSel.value;
                userSel.innerHTML = '<option value="0">Tất cả nhân viên</option>' + (data.payroll_summary || []).map(ps =>
                    `<option value="${ps.user_id}">${String(ps.fullname).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))} (${ps.user_code || 'NV' + ps.user_id})</option>`).join('');
                userSel.value = keep && [...userSel.options].some(o => o.value === keep) ? keep : '0';
            }
            if (this.attFilterActive) this.loadAttendanceLog(this.attPage || 1);
        } catch (e) {
            console.error('loadPayroll error:', e);
        }
    },

    // Nhật ký chấm công chi tiết: chỉ tải khi có bộ lọc
    attFilterParams() {
        const v = id => (document.getElementById(id)?.value || '').trim();
        const p = new URLSearchParams({ month: document.getElementById('payroll-month-input')?.value || '' });
        if (v('att-filter-user') && v('att-filter-user') !== '0') p.set('user_id', v('att-filter-user'));
        if (v('att-filter-q')) p.set('q', v('att-filter-q'));
        if (v('att-filter-from')) p.set('from', v('att-filter-from'));
        if (v('att-filter-to')) p.set('to', v('att-filter-to'));
        if (v('att-filter-status')) p.set('status', v('att-filter-status'));
        return p;
    },

    hasAttendanceFilter() {
        const p = this.attFilterParams();
        return ['user_id', 'q', 'from', 'to', 'status'].some(k => p.has(k));
    },

    applyAttendanceFilter() {
        if (!this.hasAttendanceFilter()) {
            this.attFilterActive = false;
            this.renderAttendanceEmpty('Hãy chọn nhân viên, nhập tên/mã, chọn khoảng ngày hoặc trạng thái rồi bấm Lọc.');
            return;
        }
        this.attFilterActive = true;
        this.loadAttendanceLog(1);
    },

    resetAttendanceFilter() {
        ['att-filter-q', 'att-filter-from', 'att-filter-to'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        const u = document.getElementById('att-filter-user'); if (u) u.value = '0';
        const s = document.getElementById('att-filter-status'); if (s) s.value = '';
        this.attFilterActive = false;
        this.renderAttendanceEmpty('Chọn bộ lọc để xem nhật ký chấm công.');
    },

    renderAttendanceEmpty(msg) {
        const tbody = document.getElementById('payroll-records-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400">${msg}</td></tr>`;
        const sum = document.getElementById('att-summary'); if (sum) sum.textContent = '';
        const pager = document.getElementById('att-pager'); if (pager) pager.style.display = 'none';
        const btn = document.getElementById('att-export-btn');
        if (btn) { btn.disabled = true; btn.style.opacity = '.4'; }
    },

    attendancePage(delta) {
        const next = (this.attPage || 1) + delta;
        if (next >= 1 && next <= (this.attPages || 1)) this.loadAttendanceLog(next);
    },

    async loadAttendanceLog(page = 1) {
        const tbody = document.getElementById('payroll-records-tbody');
        if (!tbody) return;
        const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const p = this.attFilterParams();
        p.set('action', 'get_attendance_log');
        p.set('page', page);
        try {
            const data = await (await fetch(`api/operations.php?${p.toString()}`)).json();
            if (!data.success) { this.renderAttendanceEmpty('Không tải được dữ liệu.'); return; }
            this.attPage = data.page;
            this.attPages = data.pages;
            this.attTotal = data.total;
            const btn = document.getElementById('att-export-btn');
            if (btn) { btn.disabled = data.total === 0; btn.style.opacity = data.total === 0 ? '.4' : '1'; }
            const sum = document.getElementById('att-summary');
            if (sum) sum.innerHTML = `${data.total} ca · <b class="text-sky-300">${data.total_hours} h</b> · <b class="text-emerald-400">${this.formatMoney(data.total_pay)} đ</b> <span class="text-slate-500">(${data.from} → ${data.to})</span>`;
            if (!data.records.length) { this.renderAttendanceEmpty('Không có lượt chấm công nào khớp bộ lọc.'); if (sum) sum.textContent = `0 ca (${data.from} → ${data.to})`; return; }

            tbody.innerHTML = data.records.map(r => {
                const isWorking = r.status === 'working';
                const inTime = r.check_in_time ? r.check_in_time.split(' ')[1] : '';
                const outTime = r.check_out_time ? r.check_out_time.split(' ')[1] : '';
                return `
                    <tr class="hover:bg-white/5 transition-colors">
                        <td class="py-2 px-3 font-mono text-slate-300">${esc(r.work_date)}</td>
                        <td class="py-2 px-3 font-bold text-slate-200">${esc(r.user_name)}</td>
                        <td class="py-2 px-3 font-mono text-sky-400"><i class="fas fa-arrow-right-to-bracket text-[10px] mr-1"></i>${esc(inTime)}</td>
                        <td class="py-2 px-3 font-mono text-amber-300">${outTime ? `<i class="fas fa-arrow-right-from-bracket text-[10px] mr-1"></i>${esc(outTime)}` : '---'}</td>
                        <td class="py-2 px-3 font-mono font-bold text-slate-100">${r.work_hours || 0} h</td>
                        <td class="py-2 px-3 font-mono text-slate-400">${Admin.formatMoney(r.hourly_rate)} đ</td>
                        <td class="py-2 px-3 text-right font-mono font-bold text-emerald-400">${Admin.formatMoney(r.total_pay)} đ</td>
                        <td class="py-2 px-3 text-center">
                            ${isWorking
                                ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">🟢 Đang trong ca</span>'
                                : '<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5 text-[10px]">Đã tan ca</span>'}
                        </td>
                    </tr>`;
            }).join('');

            const pager = document.getElementById('att-pager');
            if (pager) {
                pager.style.display = data.pages > 1 ? 'flex' : 'none';
                document.getElementById('att-page-info').textContent = `Trang ${data.page}/${data.pages}`;
                document.getElementById('att-prev').disabled = data.page <= 1;
                document.getElementById('att-next').disabled = data.page >= data.pages;
            }
        } catch (e) {
            console.error('loadAttendanceLog error:', e);
        }
    },

    // Xuất PDF theo bộ lọc hiện tại: mở trang in gọn, chọn "Lưu dạng PDF" trong hộp thoại in
    async exportAttendancePdf() {
        if (!this.attFilterActive) return;
        const win = window.open('', '_blank');
        if (!win) { alert('Trình duyệt đang chặn cửa sổ bật lên. Hãy cho phép rồi thử lại.'); return; }
        win.document.write('<p style="font-family:sans-serif">Đang tạo báo cáo...</p>');
        const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        try {
            const p = this.attFilterParams();
            p.set('action', 'get_attendance_log');
            p.set('export', '1');
            const data = await (await fetch(`api/operations.php?${p.toString()}`)).json();
            if (!data.success) { win.close(); return; }

            const userSel = document.getElementById('att-filter-user');
            const statusSel = document.getElementById('att-filter-status');
            const q = document.getElementById('att-filter-q')?.value.trim();
            const filters = [
                userSel && userSel.value !== '0' ? `Nhân viên: ${userSel.options[userSel.selectedIndex].text}` : '',
                q ? `Từ khóa: ${q}` : '',
                statusSel?.value ? `Trạng thái: ${statusSel.options[statusSel.selectedIndex].text}` : '',
            ].filter(Boolean).join(' · ') || 'Tất cả nhân viên';
            const storeName = document.querySelector('header h1, h1')?.textContent.split('•')[0].trim() || '';
            const fmtDate = d => d.split('-').reverse().join('/');
            const rows = data.records.map((r, i) => `
                <tr><td>${i + 1}</td><td>${fmtDate(r.work_date)}</td><td>${esc(r.user_name)}</td><td>${esc(r.user_code || '')}</td>
                <td>${r.shift_no ? 'Ca ' + r.shift_no : ''}</td>
                <td>${esc((r.check_in_time || '').split(' ')[1] || '')}</td><td>${esc((r.check_out_time || '').split(' ')[1] || (r.status === 'working' ? 'Đang làm' : ''))}</td>
                <td class="n">${r.work_hours || 0}</td><td class="n">${this.formatMoney(r.hourly_rate)}</td><td class="n">${this.formatMoney(r.total_pay)}</td></tr>`).join('');

            win.document.open();
            win.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Nhật ký chấm công ${data.from} - ${data.to}</title>
                <style>
                    @page { size: A4 landscape; margin: 12mm; }
                    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; }
                    h1 { font-size: 16px; margin: 0 0 2px; } .sub { color: #444; margin-bottom: 8px; }
                    table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #999; padding: 3px 5px; }
                    th { background: #eee; text-align: left; } td.n, th.n { text-align: right; }
                    tr { page-break-inside: avoid; } thead { display: table-header-group; }
                    tfoot td { font-weight: bold; background: #f5f5f5; }
                    .warn { color: #b00; margin-top: 6px; }
                    .sign { display: flex; justify-content: space-around; margin-top: 28px; text-align: center; }
                </style></head><body>
                <h1>NHẬT KÝ CHẤM CÔNG CHI TIẾT</h1>
                <div class="sub">${esc(storeName)} · Từ ${fmtDate(data.from)} đến ${fmtDate(data.to)} · ${esc(filters)}<br>Xuất lúc ${new Date().toLocaleString('vi-VN')}</div>
                <table><thead><tr><th>#</th><th>Ngày</th><th>Nhân viên</th><th>Mã</th><th>Ca</th><th>Giờ vào</th><th>Giờ ra</th><th class="n">Số giờ</th><th class="n">Lương/giờ</th><th class="n">Tiền ca (đ)</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr><td colspan="7">Tổng cộng: ${data.total} ca</td><td class="n">${data.total_hours}</td><td></td><td class="n">${this.formatMoney(data.total_pay)}</td></tr></tfoot></table>
                ${data.truncated ? '<div class="warn">Chỉ in 5.000 dòng đầu tiên, hãy thu hẹp bộ lọc để xem đầy đủ.</div>' : ''}
                <div class="sign"><div><b>Người lập</b><br><i>(Ký, ghi rõ họ tên)</i></div><div><b>Chủ quán</b><br><i>(Ký, ghi rõ họ tên)</i></div></div>
                <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };<\/script>
                </body></html>`);
            win.document.close();
        } catch (e) {
            console.error('exportAttendancePdf error:', e);
            win.close();
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
    }
};

// Global helper for toggling password / API key visibility
window.togglePasswordVisibility = (id, btn) => Admin.togglePasswordView(id, btn);

// Bảng có hơn 10 dòng: cuộn riêng trong khung bảng (tiêu đề cố định), không cuộn cả trang
const TABLE_SCROLL_ROWS = 10;
function tableDataRows(table) {
    const body = table.tBodies && table.tBodies[0];
    return body ? Array.from(body.rows).filter(r => r.cells.length > 1) : [];
}
function runTableFilter(table, bar) {
    const q = bar.querySelector('input').value.trim().toLowerCase();
    const col = parseInt(bar.querySelector('select').value, 10);
    let shown = 0;
    const rows = tableDataRows(table);
    rows.forEach(r => {
        const text = (col >= 0 ? (r.cells[col] ? r.cells[col].innerText : '') : r.innerText).toLowerCase();
        const ok = !q || text.includes(q);
        r.style.display = ok ? '' : 'none';
        if (ok) shown++;
    });
    const label = q ? shown + '/' + rows.length + ' dòng' : rows.length + ' dòng';
    const span = bar.querySelector('span');
    if (span.textContent !== label) span.textContent = label;
}
// Bảng đã có ô lọc/tìm kiếm riêng (nằm trước bảng trong cùng khối) thì không thêm thanh chung
function tableHasOwnFilter(table) {
    let el = table.parentElement;
    for (let depth = 0; el && depth < 3; depth++, el = el.parentElement) {
        if (el.tagName === 'SECTION' || el.tagName === 'MAIN') break;
        for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
            if (sib.classList.contains('table-search-bar') || sib.tagName === 'TABLE') continue;
            if (sib.matches('input,select') || sib.querySelector('input:not([type=hidden]):not([type=checkbox]),select')) return true;
        }
    }
    return false;
}
function ensureTableSearch(table) {
    const wrap = table.parentElement;
    if (!wrap || !wrap.parentElement || table.dataset.noSearch !== undefined) return;
    if (!table._searchBar && tableHasOwnFilter(table)) return;
    const rows = tableDataRows(table);
    let bar = table._searchBar;
    if (rows.length <= TABLE_SCROLL_ROWS) {
        if (bar && !bar.querySelector('input').value) {
            bar.remove();
            table._searchBar = null;
        }
        return;
    }
    const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'table-search-bar';
        bar.style.cssText = 'display:flex;gap:8px;align-items:center;padding:6px 8px;flex-wrap:wrap';
        const fieldStyle = 'background:rgba(15,23,42,.8);color:#e2e8f0;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:5px 10px;font-size:12px';
        bar.innerHTML = '<input type="search" placeholder="Tìm trong bảng..." style="' + fieldStyle + ';min-width:200px;flex:1;max-width:320px">' +
            '<select style="' + fieldStyle + '"></select><span style="font-size:11px;color:#94a3b8"></span>';
        wrap.parentElement.insertBefore(bar, wrap);
        table._searchBar = bar;
        const run = () => { runTableFilter(table, bar); };
        bar.querySelector('input').addEventListener('input', run);
        bar.querySelector('select').addEventListener('change', run);
    }
    const sel = bar.querySelector('select');
    const sig = heads.join('|');
    if (sel.dataset.sig !== sig) {
        const cur = sel.value;
        sel.innerHTML = '<option value="-1">Tất cả cột</option>' +
            heads.map((h, i) => h ? '<option value="' + i + '">' + h.replace(/</g, '&lt;') + '</option>' : '').join('');
        sel.value = cur && sel.querySelector('option[value="' + cur + '"]') ? cur : '-1';
        sel.dataset.sig = sig;
    }
    runTableFilter(table, bar);
}
function applyTableScroll(table) {
    const wrap = table.parentElement;
    const body = table.tBodies && table.tBodies[0];
    if (!wrap || !body || table.offsetHeight === 0) return;
    ensureTableSearch(table);
    if (table._searchBar && table._searchBar.querySelector('input').value) return;
    const rows = tableDataRows(table);
    if (rows.length > TABLE_SCROLL_ROWS) {
        const limit = rows[TABLE_SCROLL_ROWS - 1].getBoundingClientRect().bottom - table.getBoundingClientRect().top + 2;
        if (limit > 60) {
            wrap.style.maxHeight = Math.ceil(limit) + 'px';
            wrap.style.overflow = 'auto';
            wrap.dataset.rowScroll = '1';
            table.classList.add('table-row-scroll');
        }
    } else if (wrap.dataset.rowScroll) {
        wrap.style.maxHeight = '';
        wrap.style.overflow = '';
        delete wrap.dataset.rowScroll;
        table.classList.remove('table-row-scroll');
    }
}
function refreshTableScroll() {
    document.querySelectorAll('table').forEach(applyTableScroll);
}
function initTableScroll() {
    const style = document.createElement('style');
    style.textContent = '.table-row-scroll thead th{position:sticky;top:0;z-index:2;background:#0f172a;box-shadow:0 1px 0 rgba(255,255,255,.12)}';
    document.head.appendChild(style);
    let timer = null;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(refreshTableScroll, 150); };
    new MutationObserver(schedule).observe(document.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden']
    });
    schedule();
}

document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
    initTableScroll();
});
