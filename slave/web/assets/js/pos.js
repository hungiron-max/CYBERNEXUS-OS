/**
 * POS Liquid Glass Front-end Engine
 */

const POS = {
    // State
    currentTable: { id: 1, code: 'MV1', area_type: 'MANG_VE', name: 'Mang Về 01' },
    activeOrderId: null,
    cart: [],
    categories: [],
    products: [],
    toppings: [],
    tables: [],
    selectedCategoryId: 'all',
    discount: { type: 'amount', value: 0 },
    vatPercent: 0,
    customerName: 'Khách vãng lai',
    guestCount: 1,
    note: '',
    storeSettings: {},

    // Initialize POS
    async init() {
        const searchInput = document.getElementById('search-product');
        if (searchInput) {
            searchInput.value = '';
            searchInput.setAttribute('autocomplete', 'off');
        }
        this.bindEvents();
        await this.loadSettings();
        await this.loadCategories();
        await this.loadProducts();
        await this.loadTables();
        if (searchInput) searchInput.value = '';
        this.selectDefaultTable();
        this.startClock();
        this.startNotificationPolling();
    },

    // Format currency (e.g. 120,000 đ)
    formatMoney(amount) {
        try {
            return new Intl.NumberFormat('vi-VN').format(Math.round(amount || 0));
        } catch (e) {
            return (Math.round(amount || 0) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        }
    },

    // Check if current session has Cashier restrictions (Thu ngân không xóa món, không thêm topping)
    isCashierRole() {
        const u = window.currentUser || null;
        if (u && u.role === 'admin') {
            return false;
        }
        return true;
    },

    // Clock
    startClock() {
        const timeEl = document.getElementById('current-time-display');
        const update = () => {
            const now = new Date();
            if (timeEl) {
                timeEl.innerText = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN');
            }
        };
        update();
        setInterval(update, 1000);
    },

    // Load store settings
    async loadSettings() {
        try {
            const res = await fetch('api/settings.php');
            const data = await res.json();
            if (data.success) {
                this.storeSettings = data.data;
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    },

    // Load categories
    async loadCategories() {
        try {
            const res = await fetch('api/categories.php');
            const data = await res.json();
            if (data.success) {
                this.categories = data.data;
                this.renderCategories();
            }
        } catch (e) {
            console.error('Error loading categories:', e);
        }
    },

    renderCategories() {
        const container = document.getElementById('category-list');
        if (!container) return;

        let html = `
            <button type="button" class="category-pill shrink-0 ${this.selectedCategoryId === 'all' ? 'active' : ''}" onclick="POS.filterCategory('all')">
                <i class="fas fa-th-large text-sky-400"></i>
                <span>TẤT CẢ</span>
            </button>
        `;

        this.categories.forEach(cat => {
            const isActive = this.selectedCategoryId == cat.id ? 'active' : '';
            html += `
                <button type="button" class="category-pill shrink-0 ${isActive}" onclick="POS.filterCategory(${cat.id})">
                    <i class="fas fa-${cat.icon || 'utensils'} text-amber-400"></i>
                    <span>${cat.name}</span>
                    <span class="text-[10px] sm:text-xs bg-slate-800/80 px-1.5 py-0.2 rounded-full ml-auto text-slate-400">${cat.product_count || 0}</span>
                </button>
            `;
        });

        container.innerHTML = html;
    },

    filterCategory(categoryId) {
        this.selectedCategoryId = categoryId;
        this.renderCategories();
        this.renderProducts();
    },

    // Load products
    async loadProducts() {
        try {
            const res = await fetch('api/products.php');
            const data = await res.json();
            if (data.success) {
                this.products = data.data;
                this.toppings = this.products.filter(p => p.is_topping == 1);
                this.renderProducts();
            }
        } catch (e) {
            console.error('Error loading products:', e);
        }
    },

    renderProducts() {
        const container = document.getElementById('product-grid');
        const searchInput = document.getElementById('search-product');
        let keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';

        // Tự động triệt tiêu autofill tài khoản từ trình duyệt Chrome/Edge (như "superadmin" / "admin")
        if (keyword === 'superadmin' || keyword === 'admin') {
            if (searchInput) searchInput.value = '';
            keyword = '';
        }

        if (!container) return;

        let filtered = this.products;

        // Filter by category
        if (this.selectedCategoryId !== 'all') {
            filtered = filtered.filter(p => p.category_id == this.selectedCategoryId);
        }

        // Filter by search keyword
        if (keyword) {
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(keyword) || 
                (p.code && p.code.toLowerCase().includes(keyword))
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-16 text-center text-slate-400">
                    <i class="fas fa-mug-hot text-4xl mb-3 text-slate-600 block"></i>
                    <p class="text-base font-semibold">Không tìm thấy món ăn phù hợp</p>
                    <p class="text-xs text-slate-500 mt-1">Vui lòng chọn danh mục khác hoặc xóa từ khóa tìm kiếm</p>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(p => {
            const isTopping = p.is_topping == 1;
            const isLocked = (p.status === 'locked');
            const imgUrl = p.image || 'assets/images/dishes/default_dish.jpg';
            html += `
                <div class="liquid-glass-card p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-200 select-none ${isLocked ? 'opacity-50 grayscale border-rose-500/40 bg-rose-950/20 cursor-not-allowed' : 'cursor-pointer border border-white/10 hover:border-sky-400/50 hover:shadow-xl hover:shadow-sky-500/10 group'}" onclick="${isLocked ? `alert('Món [${p.name.replace(/'/g, "\\'")}] hiện đang TẠM KHÓA (Hết hàng) bởi bếp!')` : `POS.addToCart(${p.id})`}">
                    <div>
                        <!-- Dish Image: 4:3 Aspect Ratio for Full, Un-cropped View -->
                        <div class="relative w-full aspect-[4/3] mb-2 rounded-xl overflow-hidden bg-slate-950/80 border border-white/10 group-hover:border-sky-400/40 transition-all shadow-inner flex items-center justify-center">
                            <img src="${imgUrl}" alt="${p.name}" class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" onerror="this.onerror=null;this.src='assets/images/dishes/default_dish.jpg';" loading="lazy" />
                            
                            <!-- Badges Overlay (Non-obstructive) -->
                            <div class="absolute top-2 left-2 pointer-events-none">
                                <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-md text-sky-400 border border-sky-500/30 shadow">${p.code || 'SP'}</span>
                            </div>
                            <div class="absolute top-2 right-2 pointer-events-none">
                                ${isLocked 
                                    ? '<span class="text-[9px] font-black text-rose-300 bg-rose-950/90 px-2 py-0.5 rounded-md border border-rose-500/50 shadow">🚫 HẾT HÀNG</span>' 
                                    : `<span class="text-[10px] font-semibold text-slate-200 bg-slate-950/85 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10 capitalize shadow">${p.unit || 'ly'}</span>`}
                            </div>
                            ${isTopping ? '<span class="absolute bottom-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/90 text-slate-950 shadow">Topping</span>' : ''}
                        </div>

                        <!-- Product Name -->
                        <h4 class="font-bold text-xs sm:text-sm ${isLocked ? 'text-slate-400 line-through' : 'text-slate-100 group-hover:text-sky-300'} leading-snug line-clamp-2 min-h-[2.2rem]" title="${p.name}">${p.name}</h4>
                    </div>

                    <!-- Price & Add Button -->
                    <div class="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                        <span class="text-xs sm:text-sm font-black text-amber-400 tracking-tight font-mono">${this.formatMoney(p.sale_price)} <span class="text-[10px] font-normal text-slate-400">đ</span></span>
                        <button type="button" class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${isLocked ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/20 text-sky-400 group-hover:bg-sky-500 group-hover:text-white'} flex items-center justify-center transition-colors shadow">
                            <i class="fas ${isLocked ? 'fa-ban' : 'fa-plus'} text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    // Load tables
    async loadTables() {
        try {
            const res = await fetch('api/tables.php');
            const data = await res.json();
            if (data.success) {
                const oldTables = this.tables || [];
                this.tables = data.data;
                this.renderTables();

                // Check if any new order arrived on occupied tables
                const newlyOccupied = this.tables.find(t => {
                    const isNowOcc = t.status === 'occupied' || Boolean(t.active_order_id || t.order_id);
                    const oldT = oldTables.find(ot => ot.id === t.id);
                    const wasOcc = oldT ? (oldT.status === 'occupied' || Boolean(oldT.active_order_id || oldT.order_id)) : false;
                    return isNowOcc && !wasOcc;
                });

                if (newlyOccupied && oldTables.length > 0) {
                    this.playNotificationChime();
                }

                // If currently viewing a table, synchronize its cart state if updated remotely
                if (this.currentTable) {
                    const latestCurrent = this.tables.find(t => t.id === this.currentTable.id);
                    if (latestCurrent) {
                        const targetOrdId = latestCurrent.active_order_id || latestCurrent.order_id;
                        // If table got a new order created (e.g. by waiter) and current cart is empty or not on this order
                        if (targetOrdId && (!this.activeOrderId || this.activeOrderId !== targetOrdId)) {
                            if (this.cart.length === 0 || !this.activeOrderId) {
                                await this.loadOrder(targetOrdId);
                            }
                        } else if (targetOrdId && this.activeOrderId === targetOrdId) {
                            // If items count changed remotely (e.g. waiter added or kitchen cancelled item)
                            if (latestCurrent.item_count !== undefined && this.cart.length !== latestCurrent.item_count) {
                                await this.loadOrder(targetOrdId);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error loading tables:', e);
        }
    },

    renderTables() {
        const mvContainer = document.getElementById('tables-mangve');
        const tqContainer = document.getElementById('tables-taiquan');

        let mvHtml = '';
        let tqHtml = '';

        this.tables.forEach(tbl => {
            const isOccupied = tbl.status === 'occupied' || Boolean(tbl.active_order_id || tbl.order_id);
            const isPaid = (tbl.payment_status === 'paid' || Boolean(tbl.paid_at));
            const isActive = this.currentTable && this.currentTable.id === tbl.id ? 'active-table' : '';
            const statusClass = isOccupied ? (isPaid ? 'occupied-paid' : 'occupied') : 'free';

            let kitchenBadge = '';
            if (isOccupied) {
                if (isPaid) {
                    kitchenBadge = '<span class="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/30 text-teal-300 font-bold ml-1 border border-teal-500/40">💰 Đã TT</span>';
                }
                if (tbl.kitchen_status === 'ready') {
                    kitchenBadge += '<span class="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black animate-pulse ml-1">Bếp xong</span>';
                } else if (tbl.kitchen_status === 'served') {
                    kitchenBadge += '<span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-bold ml-1">Đã bưng</span>';
                }
            }

            const amountText = tbl.total_amount ? (this.formatMoney(tbl.total_amount) + 'đ') : '';
            const countText = tbl.item_count ? ` (${tbl.item_count} món)` : '';

            let subtitle = 'Bàn trống';
            if (isOccupied) {
                if (isPaid) {
                    if (tbl.kitchen_status === 'ready') {
                        subtitle = `${amountText} • Chờ bưng`;
                    } else if (tbl.kitchen_status === 'served') {
                        subtitle = `${amountText} • Đã bưng`;
                    } else {
                        subtitle = `${amountText} • Đang nấu`;
                    }
                } else {
                    subtitle = `${amountText}${countText}`;
                }
            }

            const cardHtml = `
                <div class="table-card ${statusClass} ${isActive}" onclick="POS.selectTable(${tbl.id})">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center flex-wrap gap-0.5">
                            <span class="font-extrabold text-xs md:text-sm tracking-wide text-white">${tbl.code}</span>
                            ${kitchenBadge}
                        </div>
                        <span class="w-2 h-2 rounded-full ${isOccupied ? (isPaid ? 'bg-teal-400' : 'bg-rose-500 animate-ping') : 'bg-emerald-400'}"></span>
                    </div>
                    <div class="text-[11px] truncate font-medium mt-1 ${isOccupied ? (isPaid ? 'text-teal-300 font-bold' : 'text-rose-200 font-bold') : 'text-slate-300'}">
                        ${subtitle}
                    </div>
                </div>
            `;

            if (tbl.area_type === 'MANG_VE') {
                mvHtml += cardHtml;
            } else {
                tqHtml += cardHtml;
            }
        });

        if (mvContainer) mvContainer.innerHTML = mvHtml;
        if (tqContainer) tqContainer.innerHTML = tqHtml;

        // Compute counts for mobile badges & overview
        const occupiedList = (this.tables || []).filter(t => t.status === 'occupied' || Boolean(t.active_order_id || t.order_id));
        const unpaidList = occupiedList.filter(t => t.payment_status !== 'paid' && !Boolean(t.paid_at));
        
        const mobileTablesBadge = document.getElementById('pos-mobile-tables-badge');
        if (mobileTablesBadge) {
            mobileTablesBadge.innerText = unpaidList.length > 0 ? unpaidList.length : occupiedList.length;
            if (unpaidList.length > 0) {
                mobileTablesBadge.className = 'px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black min-w-[18px] text-center animate-pulse';
            } else if (occupiedList.length > 0) {
                mobileTablesBadge.className = 'px-1.5 py-0.2 rounded-full bg-teal-500 text-white text-[10px] font-black min-w-[18px] text-center';
            } else {
                mobileTablesBadge.className = 'px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold min-w-[18px] text-center';
                mobileTablesBadge.innerText = '0';
            }
        }

        const summaryText = document.getElementById('pos-tables-summary-text');
        if (summaryText) {
            summaryText.innerText = `${occupiedList.length} bàn có khách • ${unpaidList.length} chờ TT`;
        }

        // Render dedicated mobile orders panel if present
        this.renderMobileOrdersPanel();
    },

    mobileOrdersFilter: 'all',

    filterMobileOrders(type) {
        this.mobileOrdersFilter = type;
        
        const filterTypes = ['all', 'unpaid', 'ready', 'paid', 'mangve', 'taiquan', 'empty'];
        filterTypes.forEach(ft => {
            const btn = document.getElementById(`filter-btn-${ft}`);
            if (btn) {
                if (ft === type) {
                    btn.className = 'px-2.5 py-1 rounded-lg font-bold bg-amber-500/30 text-amber-300 border border-amber-400 shadow-sm shrink-0';
                } else {
                    btn.className = 'px-2.5 py-1 rounded-lg font-bold bg-slate-800/80 text-slate-300 border border-white/10 shrink-0';
                }
            }
        });

        this.renderMobileOrdersPanel();
    },

    renderMobileOrdersPanel() {
        const container = document.getElementById('mobile-orders-container');
        if (!container) return;

        const searchInput = document.getElementById('search-mobile-orders');
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

        let list = this.tables || [];

        // Apply search query
        if (query) {
            list = list.filter(t => 
                (t.code && t.code.toLowerCase().includes(query)) ||
                (t.name && t.name.toLowerCase().includes(query)) ||
                (t.order_code && t.order_code.toLowerCase().includes(query)) ||
                (t.customer_name && t.customer_name.toLowerCase().includes(query))
            );
        }

        // Apply filter tab
        if (this.mobileOrdersFilter === 'unpaid') {
            list = list.filter(t => (t.status === 'occupied' || Boolean(t.active_order_id || t.order_id)) && t.payment_status !== 'paid' && !Boolean(t.paid_at));
        } else if (this.mobileOrdersFilter === 'ready') {
            list = list.filter(t => (t.status === 'occupied' || Boolean(t.active_order_id || t.order_id)) && t.kitchen_status === 'ready');
        } else if (this.mobileOrdersFilter === 'paid') {
            list = list.filter(t => (t.status === 'occupied' || Boolean(t.active_order_id || t.order_id)) && (t.payment_status === 'paid' || Boolean(t.paid_at)));
        } else if (this.mobileOrdersFilter === 'mangve') {
            list = list.filter(t => t.area_type === 'MANG_VE');
        } else if (this.mobileOrdersFilter === 'taiquan') {
            list = list.filter(t => t.area_type !== 'MANG_VE');
        } else if (this.mobileOrdersFilter === 'empty') {
            list = list.filter(t => t.status !== 'occupied' && !Boolean(t.active_order_id || t.order_id));
        }

        // Sort: Unpaid first, then ready, then others, empty tables last
        list = [...list].sort((a, b) => {
            const aOcc = a.status === 'occupied' || Boolean(a.active_order_id || a.order_id);
            const bOcc = b.status === 'occupied' || Boolean(b.active_order_id || b.order_id);
            if (aOcc && !bOcc) return -1;
            if (!aOcc && bOcc) return 1;

            const aUnpaid = aOcc && a.payment_status !== 'paid' && !Boolean(a.paid_at);
            const bUnpaid = bOcc && b.payment_status !== 'paid' && !Boolean(b.paid_at);
            if (aUnpaid && !bUnpaid) return -1;
            if (!aUnpaid && bUnpaid) return 1;

            const aReady = aOcc && a.kitchen_status === 'ready';
            const bReady = bOcc && b.kitchen_status === 'ready';
            if (aReady && !bReady) return -1;
            if (!aReady && bReady) return 1;

            return (a.sort_order || 0) - (b.sort_order || 0);
        });

        if (list.length === 0) {
            container.innerHTML = `
                <div class="py-12 text-center text-slate-500">
                    <i class="fas fa-search text-3xl mb-2 opacity-40"></i>
                    <p class="text-xs font-semibold">Không tìm thấy bàn / hóa đơn phù hợp</p>
                </div>
            `;
            return;
        }

        let html = '';
        list.forEach(tbl => {
            const isOccupied = tbl.status === 'occupied' || Boolean(tbl.active_order_id || tbl.order_id);
            const isPaid = (tbl.payment_status === 'paid' || Boolean(tbl.paid_at));
            const isReady = tbl.kitchen_status === 'ready';
            const isServed = tbl.kitchen_status === 'served';
            const isCurrent = this.currentTable && this.currentTable.id === tbl.id;

            if (isOccupied) {
                let borderGlow = 'border-white/10';
                if (!isPaid) {
                    borderGlow = 'border-amber-500/50 shadow-amber-500/10 shadow-lg';
                } else if (isReady) {
                    borderGlow = 'border-yellow-400 shadow-yellow-400/20 shadow-lg';
                } else {
                    borderGlow = 'border-teal-500/40';
                }

                if (isCurrent) {
                    borderGlow += ' ring-2 ring-sky-400/80';
                }

                html += `
                    <div class="p-3 rounded-2xl bg-slate-900/85 border ${borderGlow} space-y-2.5 transition-all">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="text-sm font-black text-white px-2.5 py-0.5 rounded-lg bg-slate-800 border border-white/15">${tbl.code}</span>
                                <span class="text-xs font-semibold text-slate-300 truncate max-w-[110px]">${tbl.name}</span>
                                ${isPaid ? `
                                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-bold border border-teal-500/40 whitespace-nowrap shrink-0">💰 Đã TT</span>
                                ` : `
                                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 animate-pulse whitespace-nowrap shrink-0">🔥 Chờ TT</span>
                                `}
                                ${isReady ? `
                                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black animate-pulse shadow-sm whitespace-nowrap shrink-0">⚡ Bếp Xong</span>
                                ` : (isServed ? `
                                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 whitespace-nowrap shrink-0">Đã bưng</span>
                                ` : `
                                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 whitespace-nowrap shrink-0">Đang làm</span>
                                `)}
                            </div>
                            <div class="text-right">
                                <span class="font-mono font-black text-base md:text-lg ${isPaid ? 'text-teal-400' : 'text-amber-300'}">${this.formatMoney(tbl.total_amount)}đ</span>
                            </div>
                        </div>

                        <div class="flex items-center justify-between text-xs text-slate-400 bg-slate-950/40 px-2.5 py-1.5 rounded-xl border border-white/5">
                            <div class="truncate">
                                <span class="font-mono text-sky-400 font-semibold">${tbl.order_code || 'Chưa có mã'}</span>
                                ${tbl.customer_name ? ` • <span class="text-slate-300 font-medium">${tbl.customer_name}</span>` : ''}
                            </div>
                            <span class="font-bold text-slate-300 shrink-0 ml-2">${tbl.item_count || 0} món</span>
                        </div>

                        <div class="grid grid-cols-2 gap-2 pt-0.5">
                            <button type="button" onclick="POS.selectAndOpenCart(${tbl.id})" class="py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 ${isPaid ? 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40' : 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-700/30'} active:scale-95 transition-all">
                                <i class="fas ${isPaid ? 'fa-receipt' : 'fa-hand-holding-dollar'}"></i>
                                <span>${isPaid ? 'Xem Hóa Đơn' : 'Thanh Toán (F9)'}</span>
                            </button>
                            <button type="button" onclick="POS.selectAndOpenMenu(${tbl.id})" class="py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 active:scale-95 transition-all">
                                <i class="fas fa-plus"></i>
                                <span>Thêm Món</span>
                            </button>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="p-2.5 rounded-xl bg-slate-900/40 border border-white/5 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-slate-300 px-2 py-0.5 rounded bg-slate-800 border border-white/10">${tbl.code}</span>
                            <span class="text-xs text-slate-400">${tbl.name}</span>
                            <span class="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-semibold">Bàn trống</span>
                        </div>
                        <button type="button" onclick="POS.selectAndOpenMenu(${tbl.id})" class="py-1 px-3 rounded-lg text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 active:scale-95">
                            + Tạo Đơn
                        </button>
                    </div>
                `;
            }
        });

        container.innerHTML = html;
    },

    async selectAndOpenCart(tableId) {
        await this.selectTable(tableId);
        if (typeof switchPosMobileView === 'function') {
            switchPosMobileView('cart');
        }
    },

    async selectAndOpenMenu(tableId) {
        await this.selectTable(tableId);
        if (typeof switchPosMobileView === 'function') {
            switchPosMobileView('menu');
        }
    },

    selectDefaultTable() {
        if (this.tables.length > 0) {
            this.selectTable(this.tables[0].id);
        }
    },

    async selectTable(tableId) {
        const found = this.tables.find(t => t.id === tableId);
        if (!found) return;

        this.currentTable = found;
        this.renderTables();

        // Update header table label
        const tblLabel = document.getElementById('current-table-label');
        if (tblLabel) {
            tblLabel.innerText = `${found.code} (${found.name})`;
        }

        const activeOrdId = found.active_order_id || found.order_id;
        const isOccupied = found.status === 'occupied' || Boolean(activeOrdId);

        // If table is occupied or has active order, load existing order
        if (isOccupied && activeOrdId) {
            await this.loadOrder(activeOrdId);
        } else {
            // Fresh table cart
            this.activeOrderId = null;
            this.activeOrder = null;
            this.activeOrderPaymentStatus = '';
            this.activeOrderKitchenStatus = '';
            this.activeOrderStatus = '';
            this.cart = [];
            this.discount = { type: 'amount', value: 0 };
            this.vatPercent = 0;
            this.customerName = 'Khách vãng lai';
            this.guestCount = 1;
            this.note = '';
            const codeDisplay = document.getElementById('order-code-display');
            if (codeDisplay) codeDisplay.innerText = 'Đang tạo...';
            this.renderCart();
        }
    },

    async loadOrder(orderId) {
        try {
            const res = await fetch(`api/orders.php?order_id=${orderId}`);
            const data = await res.json();
            if (data.success) {
                if (!data.order || data.order.status === 'cancelled') {
                    this.activeOrderId = null;
                    this.activeOrder = null;
                    this.activeOrderPaymentStatus = '';
                    this.activeOrderKitchenStatus = '';
                    this.activeOrderStatus = '';
                    this.cart = [];
                    this.renderCart();
                    return;
                }

                this.activeOrderId = data.order.id;
                this.activeOrder = data.order;
                this.activeOrderPaymentStatus = data.order.payment_status || '';
                this.activeOrderKitchenStatus = data.order.kitchen_status || '';
                this.activeOrderStatus = data.order.status || '';
                this.customerName = data.order.customer_name || 'Khách vãng lai';
                this.guestCount = data.order.guest_count || 1;
                this.discount = {
                    type: data.order.discount_type || 'amount',
                    value: parseFloat(data.order.discount_value || 0)
                };
                this.vatPercent = parseFloat(data.order.vat_percent || 0);
                this.note = data.order.note || '';

                this.cart = (data.items || []).map(it => ({
                    id: it.product_id,
                    order_item_id: it.id,
                    code: it.product_code,
                    name: it.product_name,
                    unit: it.unit,
                    price: parseFloat(it.price),
                    quantity: parseInt(it.quantity),
                    note: it.note || '',
                    toppings: it.toppings || []
                }));

                // Update UI inputs
                const custInput = document.getElementById('cart-customer-name');
                const guestInput = document.getElementById('cart-guest-count');
                const codeDisplay = document.getElementById('order-code-display');

                if (custInput) custInput.value = this.customerName;
                if (guestInput) guestInput.value = this.guestCount;
                if (codeDisplay) codeDisplay.innerText = data.order.order_code;

                this.renderCart();
            }
        } catch (e) {
            console.error('Error loading order:', e);
        }
    },

    // Cart Operations
    addToCart(productId) {
        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;
        if (prod.status === 'locked') {
            alert(`Món "${prod.name}" hiện đang TẠM KHÓA (Hết hàng) bởi bếp!`);
            return;
        }

        const isOrderPaid = this.activeOrderPaymentStatus === 'paid' || (this.currentTable && this.currentTable.payment_status === 'paid');
        if (isOrderPaid) {
            alert('Hóa đơn bàn này đã thanh toán xong! Không thể thêm món mới vào đơn đã thanh toán.');
            return;
        }

        // Check if item already in cart
        const existingIndex = this.cart.findIndex(it => it.id === prod.id && (!it.toppings || it.toppings.length === 0) && !it.note);
        if (existingIndex > -1) {
            this.cart[existingIndex].quantity += 1;
        } else {
            this.cart.push({
                id: prod.id,
                code: prod.code,
                name: prod.name,
                unit: prod.unit,
                price: parseFloat(prod.sale_price),
                quantity: 1,
                note: '',
                toppings: []
            });
        }

        this.renderCart();
        this.saveOrderDebounced();

        // Mobile feedback on cart tab
        const cartTab = document.getElementById('pos-tab-cart-btn');
        if (cartTab) {
            cartTab.classList.add('scale-105', 'bg-sky-500/30');
            setTimeout(() => {
                cartTab.classList.remove('scale-105', 'bg-sky-500/30');
            }, 250);
        }
    },

    updateQuantity(index, delta) {
        if (!this.cart[index]) return;

        const isOrderPaid = this.activeOrderPaymentStatus === 'paid' || (this.currentTable && this.currentTable.payment_status === 'paid');
        if (isOrderPaid) {
            alert('Hóa đơn đã thanh toán, không thể thay đổi số lượng!');
            return;
        }

        // Thu ngân không được giảm số lượng về 0 (xóa món)
        if (this.isCashierRole() && delta < 0 && this.cart[index].quantity <= 1) {
            alert('Thu ngân không có quyền xóa món khỏi hóa đơn! (Số lượng tối thiểu là 1)');
            return;
        }

        this.cart[index].quantity += delta;
        if (this.cart[index].quantity <= 0) {
            this.cart.splice(index, 1);
        }
        this.renderCart();
        this.saveOrderDebounced();

        // Mobile feedback on cart tab
        const cartTab = document.getElementById('pos-tab-cart-btn');
        if (cartTab) {
            cartTab.classList.add('scale-105', 'bg-sky-500/30');
            setTimeout(() => {
                cartTab.classList.remove('scale-105', 'bg-sky-500/30');
            }, 250);
        }
    },

    removeItem(index) {
        if (!this.cart[index]) return;

        const isOrderPaid = this.activeOrderPaymentStatus === 'paid' || (this.currentTable && this.currentTable.payment_status === 'paid');
        if (isOrderPaid) {
            alert('Hóa đơn đã thanh toán, không thể xóa món!');
            return;
        }

        // Thu ngân không có quyền xóa món
        if (this.isCashierRole()) {
            alert('Thu ngân không có quyền xóa món khỏi hóa đơn!');
            return;
        }

        this.cart.splice(index, 1);
        this.renderCart();
        this.saveOrderDebounced();

        // Mobile feedback on cart tab
        const cartTab = document.getElementById('pos-tab-cart-btn');
        if (cartTab) {
            cartTab.classList.add('scale-105', 'bg-sky-500/30');
            setTimeout(() => {
                cartTab.classList.remove('scale-105', 'bg-sky-500/30');
            }, 250);
        }
    },

    editItemNote(index) {
        const item = this.cart[index];
        if (!item) return;
        const newNote = prompt(`Nhập ghi chú cho "${item.name}":`, item.note || '');
        if (newNote !== null) {
            item.note = newNote.trim();
            this.renderCart();
            this.saveOrderDebounced();
        }
    },

    // Open topping selection modal for an item
    openToppingModal(index) {
        const isOrderPaid = this.activeOrderPaymentStatus === 'paid' || (this.currentTable && this.currentTable.payment_status === 'paid');
        if (isOrderPaid) {
            alert('Hóa đơn đã thanh toán, không thể thêm topping!');
            return;
        }

        // Thu ngân không có quyền thêm topping
        if (this.isCashierRole()) {
            alert('Thu ngân không có quyền thêm topping cho món!');
            return;
        }

        const item = this.cart[index];
        if (!item) return;

        let modal = document.getElementById('topping-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'topping-modal';
            modal.className = 'liquid-modal-overlay';
            document.body.appendChild(modal);
        }

        let toppingListHtml = '';
        this.toppings.forEach(tp => {
            const isChecked = item.toppings && item.toppings.some(t => t.id === tp.id);
            toppingListHtml += `
                <label class="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-white/5 hover:border-sky-400/30 cursor-pointer">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" value="${tp.id}" class="topping-checkbox w-4 h-4 rounded text-sky-500" ${isChecked ? 'checked' : ''}>
                        <span class="font-medium text-sm text-slate-200">${tp.name}</span>
                    </div>
                    <span class="text-xs font-bold text-amber-400">+${this.formatMoney(tp.sale_price)}đ</span>
                </label>
            `;
        });

        modal.innerHTML = `
            <div class="liquid-glass liquid-modal-content p-6 w-96 max-w-full text-white shadow-2xl border border-sky-500/30">
                <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                    <h3 class="font-bold text-base text-sky-400">Chọn Topping: ${item.name}</h3>
                    <button type="button" class="text-slate-400 hover:text-white text-xl" onclick="document.getElementById('topping-modal').classList.remove('open')">&times;</button>
                </div>
                <div class="space-y-2 max-h-60 overflow-y-auto pr-1 mb-5">
                    ${toppingListHtml || '<p class="text-slate-400 text-sm">Chưa có topping nào trong danh mục</p>'}
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('topping-modal').classList.remove('open')">Đóng</button>
                    <button type="button" class="btn-glass-primary text-xs py-2 px-4 font-bold" onclick="POS.applyToppings(${index})">Áp dụng</button>
                </div>
            </div>
        `;

        modal.classList.add('open');
    },

    applyToppings(index) {
        if (this.isCashierRole()) {
            alert('Thu ngân không có quyền thêm topping cho món!');
            return;
        }

        const item = this.cart[index];
        if (!item) return;

        const checkboxes = document.querySelectorAll('.topping-checkbox:checked');
        const selectedToppings = [];
        checkboxes.forEach(cb => {
            const tpId = parseInt(cb.value);
            const found = this.toppings.find(t => t.id === tpId);
            if (found) {
                selectedToppings.push({
                    id: found.id,
                    name: found.name,
                    price: parseFloat(found.sale_price)
                });
            }
        });

        item.toppings = selectedToppings;
        document.getElementById('topping-modal').classList.remove('open');
        this.renderCart();
        this.saveOrderDebounced();

        // Mobile feedback on cart tab
        const cartTab = document.getElementById('pos-tab-cart-btn');
        if (cartTab) {
            cartTab.classList.add('scale-105', 'bg-sky-500/30');
            setTimeout(() => {
                cartTab.classList.remove('scale-105', 'bg-sky-500/30');
            }, 250);
        }
    },

    // Cart calculations & rendering
    renderCart() {
        const cartItemsContainer = document.getElementById('cart-items-container');
        const subtotalEl = document.getElementById('cart-subtotal');
        const discountEl = document.getElementById('cart-discount');
        const totalEl = document.getElementById('cart-total');
        const countBadge = document.getElementById('cart-items-count');

        if (!cartItemsContainer) return;

        const isCashier = this.isCashierRole();
        const isPaid = this.activeOrderPaymentStatus === 'paid' || (this.currentTable && this.currentTable.payment_status === 'paid');
        const btnPrintTemp = document.getElementById('btn-print-temp');

        if (this.cart.length === 0) {
            if (btnPrintTemp) {
                btnPrintTemp.classList.add('hidden');
            }
            cartItemsContainer.innerHTML = `
                <div class="h-64 flex flex-col items-center justify-center text-slate-500">
                    <i class="fas fa-shopping-basket text-4xl mb-3 opacity-30"></i>
                    <p class="text-sm font-semibold">Chưa có món ăn nào</p>
                    <p class="text-xs text-slate-600 mt-1">Chạm vào món bên phải để thêm vào hóa đơn</p>
                </div>
            `;
            if (subtotalEl) subtotalEl.innerText = '0';
            if (discountEl) discountEl.innerText = '0';
            if (totalEl) totalEl.innerText = '0';
            if (countBadge) countBadge.innerText = '0';
            const mobileBadge = document.getElementById('pos-mobile-cart-badge');
            if (mobileBadge) {
                mobileBadge.innerText = '0';
                mobileBadge.classList.add('hidden');
            }
            return;
        }

        if (btnPrintTemp) {
            btnPrintTemp.classList.remove('hidden');
        }

        let subtotal = 0;
        let html = '';

        this.cart.forEach((item, idx) => {
            // Price including toppings
            let toppingPrice = 0;
            if (item.toppings && item.toppings.length > 0) {
                toppingPrice = item.toppings.reduce((acc, t) => acc + (parseFloat(t.price) || 0), 0);
            }
            const unitPrice = item.price + toppingPrice;
            const itemSubtotal = unitPrice * item.quantity;
            subtotal += itemSubtotal;

            html += `
                <div class="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/10 transition-colors">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                            <h5 class="text-sm font-bold text-slate-100 truncate">${item.name}</h5>
                            <div class="text-xs text-amber-400 font-semibold mt-0.5">
                                ${this.formatMoney(unitPrice)} đ
                                ${toppingPrice > 0 ? `<span class="text-[10px] text-sky-400 font-normal"> (Gồm topping)</span>` : ''}
                            </div>
                            ${item.toppings && item.toppings.length > 0 ? `
                                <div class="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-1">
                                    ${item.toppings.map(t => `<span class="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-sky-300">+${t.name}</span>`).join('')}
                                </div>
                            ` : ''}
                            ${item.note ? `
                                <div class="text-[11px] text-rose-300/90 italic mt-0.5">
                                    <i class="fas fa-pen-alt text-[9px] mr-1"></i>${item.note}
                                </div>
                            ` : ''}
                        </div>
                        <div class="text-right">
                            <span class="text-sm font-black text-emerald-400 font-mono">${this.formatMoney(itemSubtotal)}</span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between mt-2.5 pt-2 border-t border-white/5">
                        <div class="flex items-center gap-1">
                            ${isPaid ? `
                                <span class="text-xs text-teal-300 font-bold font-mono px-2 py-0.5 rounded bg-teal-500/20 border border-teal-500/40">x${item.quantity} phần</span>
                            ` : `
                                <button type="button" 
                                    class="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs transition-colors ${isCashier && item.quantity <= 1 ? 'opacity-30 cursor-not-allowed text-slate-500' : 'text-slate-300 hover:text-white'}" 
                                    onclick="POS.updateQuantity(${idx}, -1)" 
                                    ${isCashier && item.quantity <= 1 ? 'title="Thu ngân không thể xóa món (SL tối thiểu 1)"' : 'title="Giảm số lượng"'}>
                                    <i class="fas fa-minus"></i>
                                </button>
                                <span class="w-8 text-center font-bold text-sm text-sky-400 font-mono">${item.quantity}</span>
                                <button type="button" 
                                    class="w-6 h-6 rounded bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-xs transition-colors" 
                                    onclick="POS.updateQuantity(${idx}, 1)" 
                                    title="Tăng số lượng">
                                    <i class="fas fa-plus"></i>
                                </button>
                            `}
                        </div>

                        <div class="flex items-center gap-1.5 text-xs">
                            ${(isPaid || isCashier) ? `
                                <button type="button" 
                                    class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 text-xs font-semibold transition-all shadow-sm active:scale-95" 
                                    onclick="POS.editItemNote(${idx})" 
                                    title="Ghi chú món ăn">
                                    <i class="fas fa-comment-dots text-amber-400"></i>
                                    <span>Ghi chú</span>
                                </button>
                            ` : `
                                <button type="button" class="px-2 py-1 rounded bg-slate-800/80 text-sky-400 hover:bg-sky-500/20" onclick="POS.openToppingModal(${idx})" title="Thêm Topping">
                                    <i class="fas fa-candy-cane"></i> Topping
                                </button>
                                <button type="button" class="px-2 py-1 rounded bg-slate-800/80 text-amber-400 hover:bg-amber-500/20" onclick="POS.editItemNote(${idx})" title="Ghi chú món">
                                    <i class="fas fa-comment-dots"></i>
                                </button>
                                <button type="button" class="w-6 h-6 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center" onclick="POS.removeItem(${idx})" title="Xóa món">
                                    <i class="fas fa-trash-alt text-[10px]"></i>
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        });

        cartItemsContainer.innerHTML = html;

        // Paid status banner & checkout button handling
        if (isPaid) {
            const kStatus = this.activeOrderKitchenStatus || (this.currentTable ? this.currentTable.kitchen_status : 'pending');
            const kText = kStatus === 'ready' ? 'Bếp đã xong • Chờ bưng' : (kStatus === 'served' ? 'Đã bưng ra bàn' : 'Bếp đang chế biến');
            cartItemsContainer.innerHTML = `
                <div class="p-2.5 rounded-xl bg-teal-950/70 border border-teal-500/40 text-teal-300 flex items-center justify-between text-xs font-bold mb-2 shadow-md">
                    <div class="flex items-center gap-1.5">
                        <i class="fas fa-check-circle text-teal-400 text-sm"></i>
                        <span>ĐÃ THANH TOÁN</span>
                    </div>
                    <span class="text-[11px] font-semibold text-teal-200 bg-teal-900/60 px-2 py-0.5 rounded border border-teal-500/30">${kText}</span>
                </div>
            ` + cartItemsContainer.innerHTML;
        }

        const btnCheckout = document.getElementById('btn-pos-checkout');
        if (btnCheckout) {
            if (isPaid) {
                btnCheckout.className = 'col-span-2 py-3 px-2 sm:px-4 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-1.5 sm:gap-2 shadow-xl bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/50 active:scale-95 transition-transform truncate';
                btnCheckout.innerHTML = '<i class="fas fa-print text-base sm:text-lg"></i> <span>IN LẠI HÓA ĐƠN</span>';
            } else {
                btnCheckout.className = 'col-span-2 btn-glass-success py-3 px-2 sm:px-4 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-1.5 sm:gap-2 shadow-xl shadow-emerald-600/30 active:scale-95 transition-transform truncate';
                btnCheckout.innerHTML = '<i class="fas fa-hand-holding-dollar text-base sm:text-lg"></i> <span>THANH TOÁN (F9)</span>';
            }
        }

        // Calculate discount
        let discountAmount = 0;
        if (this.discount.type === 'percent') {
            discountAmount = (subtotal * Math.min(100, Math.max(0, this.discount.value))) / 100;
        } else {
            discountAmount = Math.min(subtotal, Math.max(0, this.discount.value));
        }

        const afterDiscount = Math.max(0, subtotal - discountAmount);
        const vatAmount = (afterDiscount * Math.max(0, this.vatPercent)) / 100;
        const total = afterDiscount + vatAmount;

        if (subtotalEl) subtotalEl.innerText = this.formatMoney(subtotal);
        if (discountEl) discountEl.innerText = this.formatMoney(discountAmount);
        if (totalEl) totalEl.innerText = this.formatMoney(total);
        const totalItems = this.cart.reduce((a, b) => a + b.quantity, 0);
        if (countBadge) countBadge.innerText = totalItems;
        const mobileBadge = document.getElementById('pos-mobile-cart-badge');
        if (mobileBadge) {
            mobileBadge.innerText = totalItems;
            if (totalItems > 0) {
                mobileBadge.classList.remove('hidden');
            } else {
                mobileBadge.classList.add('hidden');
            }
        }
    },

    // Save order with debounce to avoid excessive requests
    saveTimeout: null,
    saveOrderDebounced() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveOrder();
        }, 600);
    },

    async saveOrder() {
        if (!this.currentTable || this.cart.length === 0) return;

        const payload = {
            table_id: this.currentTable.id,
            table_code: this.currentTable.code,
            customer_name: this.customerName,
            guest_count: this.guestCount,
            items: this.cart,
            discount_type: this.discount.type,
            discount_value: this.discount.value,
            vat_percent: this.vatPercent,
            note: this.note
        };

        try {
            const res = await fetch('api/orders.php?action=save_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                this.activeOrderId = data.order_id;
                this.loadTables();
            }
        } catch (e) {
            console.error('Error saving order:', e);
        }
    },

    // Cancel / Clear Order (Kiểm toán bắt buộc nhập lý do hủy đơn)
    cancelOrder() {
        if (this.cart.length === 0) return;

        let modal = document.getElementById('audit-cancel-order-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'audit-cancel-order-modal';
            modal.className = 'liquid-modal-overlay';
            document.body.appendChild(modal);
        }

        const tblCode = this.currentTable ? this.currentTable.code : 'MV';
        modal.innerHTML = `
            <div class="liquid-glass liquid-modal-content p-6 w-[430px] max-w-full text-white shadow-2xl border border-rose-500/40">
                <div class="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                    <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                            <i class="fas fa-shield-halved"></i>
                        </span>
                        <div>
                            <h3 class="font-bold text-sm text-rose-400 uppercase">Xác Nhận Hủy Hóa Đơn (${tblCode})</h3>
                            <p class="text-[11px] text-slate-400">Thao tác này được ghi nhận vào Nhật ký Kiểm toán (Audit)</p>
                        </div>
                    </div>
                    <button type="button" class="text-slate-400 hover:text-white text-xl" onclick="document.getElementById('audit-cancel-order-modal').classList.remove('open')">&times;</button>
                </div>

                <div class="mb-3">
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">Chọn nhanh lý do hủy:</label>
                    <div class="flex flex-wrap gap-1.5">
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-xs text-slate-300 hover:text-rose-300 border border-white/10" onclick="document.getElementById('cancel-order-reason-input').value='Khách đổi ý không dùng nữa'">Khách đổi ý</button>
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-xs text-slate-300 hover:text-rose-300 border border-white/10" onclick="document.getElementById('cancel-order-reason-input').value='Thu ngân / Phục vụ nhập nhầm bàn'">Nhập nhầm bàn</button>
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-xs text-slate-300 hover:text-rose-300 border border-white/10" onclick="document.getElementById('cancel-order-reason-input').value='Bếp báo hết nguyên liệu đột xuất'">Hết nguyên liệu</button>
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-xs text-slate-300 hover:text-rose-300 border border-white/10" onclick="document.getElementById('cancel-order-reason-input').value='Khách chờ lâu rời quán'">Khách chờ lâu</button>
                    </div>
                </div>

                <div class="mb-4">
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">Chi tiết lý do hủy đơn <span class="text-rose-400">*</span>:</label>
                    <input type="text" id="cancel-order-reason-input" placeholder="Nhập lý do hủy hóa đơn..." class="liquid-input w-full text-xs py-2 px-3" />
                </div>

                <div class="flex justify-end gap-2">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('audit-cancel-order-modal').classList.remove('open')">Đóng</button>
                    <button type="button" class="btn-glass text-xs py-2 px-4 bg-rose-600/80 hover:bg-rose-600 text-white border-rose-500 font-bold" onclick="POS.confirmCancelOrderWithReason()">
                        <i class="fas fa-trash-can mr-1"></i> Xác nhận Hủy & Ghi Audit
                    </button>
                </div>
            </div>
        `;
        modal.classList.add('open');
    },

    async confirmCancelOrderWithReason() {
        const reasonInput = document.getElementById('cancel-order-reason-input');
        const reason = reasonInput ? reasonInput.value.trim() : '';
        if (!reason) {
            alert('Bắt buộc nhập lý do hủy hóa đơn để ghi nhận Kiểm toán nội bộ!');
            if (reasonInput) reasonInput.focus();
            return;
        }

        try {
            if (this.activeOrderId) {
                const res = await fetch('api/orders.php?action=cancel_order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order_id: this.activeOrderId,
                        table_id: this.currentTable ? this.currentTable.id : null,
                        reason: reason
                    })
                });
                const data = await res.json();
                if (!data.success) {
                    alert(data.message || 'Lỗi khi hủy hóa đơn');
                    return;
                }
            }

            const modal = document.getElementById('audit-cancel-order-modal');
            if (modal) modal.classList.remove('open');

            this.cart = [];
            this.activeOrderId = null;
            this.discount = { type: 'amount', value: 0, reason: '' };
            this.renderCart();
            await this.loadTables();
        } catch (e) {
            console.error('Error cancelling order:', e);
        }
    },

    // Open Discount Modal
    openDiscountModal() {
        let modal = document.getElementById('discount-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'discount-modal';
            modal.className = 'liquid-modal-overlay';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="liquid-glass liquid-modal-content p-6 w-96 max-w-full text-white shadow-2xl border border-sky-500/30">
                <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                    <div>
                        <h3 class="font-bold text-base text-sky-400">Giảm Giá Hóa Đơn</h3>
                        <p class="text-[11px] text-slate-400">Ghi nhận tự động vào Nhật ký Kiểm toán</p>
                    </div>
                    <button type="button" class="text-slate-400 hover:text-white text-xl" onclick="document.getElementById('discount-modal').classList.remove('open')">&times;</button>
                </div>
                <div class="mb-3">
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">Loại giảm giá:</label>
                    <div class="grid grid-cols-2 gap-2">
                        <button type="button" id="discount-type-amount" class="btn-glass ${this.discount.type === 'amount' ? 'btn-glass-primary' : ''} text-xs py-2" onclick="POS.setDiscountType('amount')">Số tiền (VNĐ)</button>
                        <button type="button" id="discount-type-percent" class="btn-glass ${this.discount.type === 'percent' ? 'btn-glass-primary' : ''} text-xs py-2" onclick="POS.setDiscountType('percent')">Phần trăm (%)</button>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">Giá trị giảm:</label>
                    <div class="relative">
                        <input type="number" id="discount-val-input" value="${this.discount.value}" class="liquid-input w-full font-mono text-lg font-bold pr-10" />
                        <button type="button" class="absolute right-2 top-2 text-slate-400 hover:text-sky-400" onclick="VirtualNumpad.open(document.getElementById('discount-val-input'), 'Nhập giá trị giảm giá')">
                            <i class="fas fa-keyboard"></i>
                        </button>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">Lý do giảm giá / Chương trình KM <span class="text-amber-400">*</span>:</label>
                    <div class="flex flex-wrap gap-1 mb-1.5">
                        <button type="button" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-500/20 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('discount-reason-input').value='Khách VIP / Thân thiết'">Khách VIP</button>
                        <button type="button" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-500/20 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('discount-reason-input').value='Voucher / Khuyến mãi quán'">Voucher KM</button>
                        <button type="button" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-500/20 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('discount-reason-input').value='Ưu đãi đền bù phục vụ trễ'">Đền bù món trễ</button>
                    </div>
                    <input type="text" id="discount-reason-input" value="${this.discount.reason || ''}" placeholder="Nhập lý do giảm giá..." class="liquid-input w-full text-xs py-2 px-3" />
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('discount-modal').classList.remove('open')">Hủy</button>
                    <button type="button" class="btn-glass-success text-xs py-2 px-4 font-bold" onclick="POS.applyDiscount()">Xác nhận</button>
                </div>
            </div>
        `;

        modal.classList.add('open');
    },

    setDiscountType(type) {
        this.discount.type = type;
        const btnAmt = document.getElementById('discount-type-amount');
        const btnPct = document.getElementById('discount-type-percent');
        if (type === 'amount') {
            btnAmt.className = 'btn-glass btn-glass-primary text-xs py-2';
            btnPct.className = 'btn-glass text-xs py-2';
        } else {
            btnPct.className = 'btn-glass btn-glass-primary text-xs py-2';
            btnAmt.className = 'btn-glass text-xs py-2';
        }
    },

    applyDiscount() {
        const valInput = document.getElementById('discount-val-input');
        const reasonInput = document.getElementById('discount-reason-input');
        const newVal = valInput ? (parseFloat(valInput.value) || 0) : 0;
        const reason = reasonInput ? reasonInput.value.trim() : '';

        if (newVal > 0 && !reason) {
            alert('Vui lòng chọn hoặc nhập Lý do giảm giá để ghi nhận Kiểm toán!');
            if (reasonInput) reasonInput.focus();
            return;
        }

        this.discount.value = newVal;
        this.discount.reason = reason;
        document.getElementById('discount-modal').classList.remove('open');
        this.renderCart();
        this.saveOrderDebounced();

        // Mobile feedback on cart tab
        const cartTab = document.getElementById('pos-tab-cart-btn');
        if (cartTab) {
            cartTab.classList.add('scale-105', 'bg-sky-500/30');
            setTimeout(() => {
                cartTab.classList.remove('scale-105', 'bg-sky-500/30');
            }, 250);
        }
    },

    // Switch Table (Chuyển bàn)
    openSwitchTableModal() {
        if (!this.currentTable || this.cart.length === 0) {
            alert('Bàn hiện tại không có hóa đơn để chuyển!');
            return;
        }

        let modal = document.getElementById('switch-table-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'switch-table-modal';
            modal.className = 'liquid-modal-overlay';
            document.body.appendChild(modal);
        }

        const freeTables = this.tables.filter(t => t.id !== this.currentTable.id && t.status === 'free');

        let tablesHtml = '';
        freeTables.forEach(t => {
            tablesHtml += `
                <button type="button" class="table-card free" onclick="POS.doSwitchTable(${t.id})">
                    <span class="font-bold text-sm text-white">${t.code}</span>
                    <span class="text-xs text-slate-400 mt-1">${t.name}</span>
                </button>
            `;
        });

        modal.innerHTML = `
            <div class="liquid-glass liquid-modal-content p-6 w-[450px] max-w-full text-white shadow-2xl border border-sky-500/30">
                <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                    <h3 class="font-bold text-base text-sky-400">Chuyển Bàn: từ ${this.currentTable.code} sang bàn khác</h3>
                    <button type="button" class="text-slate-400 hover:text-white text-xl" onclick="document.getElementById('switch-table-modal').classList.remove('open')">&times;</button>
                </div>
                <p class="text-xs text-slate-400 mb-3">Chọn bàn trống để chuyển toàn bộ đơn hàng sang:</p>
                <div class="grid grid-cols-3 gap-2.5 max-h-72 overflow-y-auto mb-4 p-1">
                    ${tablesHtml || '<p class="col-span-3 text-slate-400 text-sm text-center py-6">Không có bàn trống nào!</p>'}
                </div>
                <div class="flex justify-end">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('switch-table-modal').classList.remove('open')">Đóng</button>
                </div>
            </div>
        `;

        modal.classList.add('open');
    },

    async doSwitchTable(targetTableId) {
        try {
            const res = await fetch('api/tables.php?action=switch_table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_table_id: this.currentTable.id,
                    to_table_id: targetTableId
                })
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('switch-table-modal').classList.remove('open');
                await this.loadTables();
                this.selectTable(targetTableId);
            } else {
                alert(data.message || 'Lỗi chuyển bàn');
            }
        } catch (e) {
            console.error('Error switching table:', e);
        }
    },

    // Merge Table (Gộp bàn)
    openMergeTableModal() {
        if (!this.currentTable || this.cart.length === 0) {
            alert('Bàn hiện tại không có hóa đơn để gộp!');
            return;
        }

        let modal = document.getElementById('merge-table-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'merge-table-modal';
            modal.className = 'liquid-modal-overlay';
            document.body.appendChild(modal);
        }

        const occupiedTables = this.tables.filter(t => t.id !== this.currentTable.id && t.status === 'occupied');

        let tablesHtml = '';
        occupiedTables.forEach(t => {
            tablesHtml += `
                <button type="button" class="table-card occupied" onclick="POS.doMergeTable(${t.id})">
                    <span class="font-bold text-sm text-white">${t.code}</span>
                    <span class="text-xs text-amber-300 mt-1">${this.formatMoney(t.total_amount)}đ</span>
                </button>
            `;
        });

        modal.innerHTML = `
            <div class="liquid-glass liquid-modal-content p-6 w-[450px] max-w-full text-white shadow-2xl border border-sky-500/30">
                <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                    <h3 class="font-bold text-base text-sky-400">Gộp Bàn: ${this.currentTable.code} vào bàn khác</h3>
                    <button type="button" class="text-slate-400 hover:text-white text-xl" onclick="document.getElementById('merge-table-modal').classList.remove('open')">&times;</button>
                </div>
                <p class="text-xs text-slate-400 mb-3">Chọn bàn đang có khách để gộp đơn hàng vào:</p>
                <div class="grid grid-cols-3 gap-2.5 max-h-72 overflow-y-auto mb-4 p-1">
                    ${tablesHtml || '<p class="col-span-3 text-slate-400 text-sm text-center py-6">Không có bàn nào khác đang có khách!</p>'}
                </div>
                <div class="flex justify-end">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('merge-table-modal').classList.remove('open')">Đóng</button>
                </div>
            </div>
        `;

        modal.classList.add('open');
    },

    async doMergeTable(targetTableId) {
        if (!confirm(`Bạn có chắc muốn gộp bàn ${this.currentTable.code} vào bàn được chọn?`)) {
            return;
        }

        try {
            const res = await fetch('api/tables.php?action=merge_table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_table_id: this.currentTable.id,
                    to_table_id: targetTableId
                })
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('merge-table-modal').classList.remove('open');
                await this.loadTables();
                this.selectTable(targetTableId);
            } else {
                alert(data.message || 'Lỗi gộp bàn');
            }
        } catch (e) {
            console.error('Error merging table:', e);
        }
    },

    // Pop VietQR Dynamic Modal
    async showCurrentVietQr() {
        if (this.cart.length === 0) {
            alert('Hóa đơn hiện tại chưa có món ăn nào để tạo mã VietQR!');
            return;
        }

        const subtotal = this.cart.reduce((sum, it) => {
            const toppingP = (it.toppings || []).reduce((tSum, t) => tSum + (parseFloat(t.price) || 0), 0);
            return sum + ((it.price + toppingP) * it.quantity);
        }, 0);

        let discountAmount = 0;
        if (this.discount.type === 'percent') {
            discountAmount = (subtotal * Math.min(100, Math.max(0, this.discount.value))) / 100;
        } else {
            discountAmount = Math.min(subtotal, Math.max(0, this.discount.value));
        }

        const afterDiscount = Math.max(0, subtotal - discountAmount);
        const vatAmount = (afterDiscount * Math.max(0, this.vatPercent)) / 100;
        const total = Math.round(afterDiscount + vatAmount);

        if (total <= 0) {
            alert('Tổng tiền hóa đơn bằng 0, không cần quét mã QR!');
            return;
        }

        try {
            let url = `api/orders.php?action=vietqr&amount=${total}`;
            if (this.currentTable) {
                url += `&table_id=${this.currentTable.id}&order_code=${this.currentTable.code}`;
            }
            if (this.activeOrderId) {
                url += `&order_id=${this.activeOrderId}`;
            }

            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                const img = document.getElementById('pos-vietqr-image');
                const amt = document.getElementById('pos-vietqr-amount');
                const tbl = document.getElementById('pos-vietqr-table');
                const code = document.getElementById('pos-vietqr-code');
                const note = document.getElementById('pos-vietqr-note');

                if (img) img.src = data.vietqr_url;
                if (amt) amt.innerText = this.formatMoney(data.amount);
                if (tbl) tbl.innerText = this.currentTable ? `${this.currentTable.code} (${this.currentTable.name})` : 'Mang Về';
                if (code) code.innerText = data.order_code;
                if (note) note.innerText = data.note;

                const modal = document.getElementById('pos-vietqr-modal');
                if (modal) modal.classList.add('open');
            } else {
                alert(data.message || 'Không thể tạo mã VietQR');
            }
        } catch (e) {
            console.error('Error fetching VietQR:', e);
            alert('Lỗi kết nối khi tải mã VietQR');
        }
    },

    closeVietQrModal() {
        const modal = document.getElementById('pos-vietqr-modal');
        if (modal) modal.classList.remove('open');
    },

    handleCheckoutClick() {
        const isPaid = this.activeOrderPaymentStatus === 'paid' || (this.currentTable && this.currentTable.payment_status === 'paid');
        if (isPaid) {
            this.reprintActiveOrder();
        } else {
            this.openPaymentModal();
        }
    },

    async reprintActiveOrder() {
        if (!this.activeOrderId) return;
        try {
            const res = await fetch(`api/orders.php?order_id=${this.activeOrderId}`);
            const data = await res.json();
            if (data.success && data.order) {
                fetch('api/orders.php?action=log_audit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action_code: 'REPRINT_RECEIPT',
                        action_label: 'In lại hóa đơn đã thanh toán (' + (data.order.table_code || 'MV') + ')',
                        severity: 'WARN',
                        order_id: data.order.id,
                        order_code: data.order.order_code,
                        table_code: data.order.table_code,
                        amount_impact: data.order.total_amount || 0,
                        reason: 'Thu ngân bấm In lại hóa đơn',
                        details: 'Mã đơn: ' + data.order.order_code
                    })
                }).catch(() => {});
                this.showReceiptModal(data.order, data.items, data.store, 'IN LẠI HÓA ĐƠN', 'Xem trước & In hóa đơn nhiệt 80mm');
            }
        } catch(e) {
            console.error('Error reprinting order:', e);
        }
    },

    // Payment Modal (Thanh toán)
    openPaymentModal() {
        if (this.cart.length === 0) {
            alert('Hóa đơn chưa có món ăn nào!');
            return;
        }

        const isPaid = this.activeOrderPaymentStatus === 'paid' || (this.currentTable && this.currentTable.payment_status === 'paid');
        if (isPaid) {
            this.reprintActiveOrder();
            return;
        }

        let modal = document.getElementById('payment-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'payment-modal';
            modal.className = 'liquid-modal-overlay';
            document.body.appendChild(modal);
        }

        // Calculate final total
        const subtotal = this.cart.reduce((sum, it) => {
            const toppingP = (it.toppings || []).reduce((tSum, t) => tSum + (parseFloat(t.price) || 0), 0);
            return sum + ((it.price + toppingP) * it.quantity);
        }, 0);

        let discountAmount = 0;
        if (this.discount.type === 'percent') {
            discountAmount = (subtotal * Math.min(100, Math.max(0, this.discount.value))) / 100;
        } else {
            discountAmount = Math.min(subtotal, Math.max(0, this.discount.value));
        }

        const afterDiscount = Math.max(0, subtotal - discountAmount);
        const vatAmount = (afterDiscount * Math.max(0, this.vatPercent)) / 100;
        const total = afterDiscount + vatAmount;

        const bankId = this.storeSettings.bank_id || 'MB';
        const accountNo = this.storeSettings.bank_account_no || '0967041111';
        const accountName = this.storeSettings.bank_account_name || 'GOC PHO POS';
        const vietQrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${Math.round(total)}&addInfo=TT%20${this.currentTable ? this.currentTable.code : 'DON'}&accountName=${encodeURIComponent(accountName)}`;

        modal.innerHTML = `
            <div class="liquid-glass liquid-modal-content p-6 w-[520px] max-w-full text-white shadow-2xl border border-sky-500/30">
                <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                    <div>
                        <h3 class="font-bold text-lg text-emerald-400">Thanh Toán Hóa Đơn</h3>
                        <p class="text-xs text-slate-400 mt-0.5">Bàn: ${this.currentTable ? this.currentTable.code : 'MV'} | Số món: ${this.cart.reduce((a, b) => a + b.quantity, 0)}</p>
                    </div>
                    <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="document.getElementById('payment-modal').classList.remove('open')">&times;</button>
                </div>

                <!-- Total Amount Banner -->
                <div class="bg-gradient-to-r from-emerald-900/60 to-slate-900/90 border border-emerald-500/40 rounded-xl p-4 text-center mb-5 shadow-lg">
                    <span class="text-xs uppercase tracking-wider text-emerald-300 font-semibold">Tổng Tiền Cần Thanh Toán</span>
                    <div class="text-3xl font-black text-emerald-400 font-mono mt-1">${this.formatMoney(total)} <span class="text-sm font-normal text-slate-300">VNĐ</span></div>
                </div>

                <!-- Payment Methods -->
                <div class="mb-4">
                    <label class="block text-xs font-semibold text-slate-300 mb-2">Phương thức thanh toán:</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button type="button" id="paymethod-cash" class="btn-glass btn-glass-primary text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap" onclick="POS.selectPaymentMethod('cash', ${total})">
                            <i class="fas fa-money-bill-wave"></i> Tiền mặt
                        </button>
                        <button type="button" id="paymethod-banking" class="btn-glass text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap" onclick="POS.selectPaymentMethod('banking', ${total})">
                            <i class="fas fa-qrcode"></i> Chuyển khoản QR
                        </button>
                        <button type="button" id="paymethod-card" class="btn-glass text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap" onclick="POS.selectPaymentMethod('card', ${total})">
                            <i class="fas fa-credit-card"></i> Thẻ POS
                        </button>
                    </div>
                </div>

                <!-- Method Content: Cash -->
                <div id="payment-cash-section">
                    <div class="mb-3">
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Tiền khách đưa (VNĐ):</label>
                        <div class="relative">
                            <input type="number" id="cash-received-input" value="${total}" class="liquid-input w-full font-mono text-xl font-bold pr-10 text-emerald-400" oninput="POS.calcChange(${total})" />
                            <button type="button" class="absolute right-2 top-2 text-slate-400 hover:text-sky-400" onclick="VirtualNumpad.open(document.getElementById('cash-received-input'), 'Nhập tiền khách đưa')">
                                <i class="fas fa-keyboard"></i>
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-4 gap-1.5 mb-4">
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(${total}, ${total})">Đủ tiền</button>
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(50000, ${total})">50.000</button>
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(100000, ${total})">100.000</button>
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(200000, ${total})">200.000</button>
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(500000, ${total})">500.000</button>
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(1000000, ${total})">1.000.000</button>
                    </div>

                    <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-white/10 mb-4">
                        <span class="text-sm font-semibold text-slate-300">Tiền thừa trả khách:</span>
                        <span id="cash-change-display" class="text-lg font-black font-mono text-amber-400">0 đ</span>
                    </div>
                </div>

                <!-- Method Content: VietQR Banking -->
                <div id="payment-banking-section" class="hidden text-center mb-4 p-4 rounded-xl bg-slate-900/80 border border-sky-500/20">
                    <p class="text-xs text-sky-300 font-semibold mb-2">Quét mã QR bằng App Ngân Hàng để thanh toán tự động</p>
                    <div class="flex justify-center mb-2">
                        <img src="${vietQrUrl}" alt="VietQR" class="w-48 h-48 rounded-lg bg-white p-2 shadow-lg object-contain" />
                    </div>
                    <div class="text-xs text-slate-400">
                        <span class="text-slate-300 font-bold">${bankId}</span> - STK: <span class="font-mono text-sky-400 font-bold">${accountNo}</span> (${accountName})
                    </div>
                </div>

                <!-- Method Content: SmartPOS / Credit Card ECR (mod_card_payment) -->
                <div id="payment-card-section" class="hidden mb-4 p-4 rounded-xl bg-slate-900/90 border border-indigo-500/30">
                    <div class="text-center py-4 text-xs text-slate-400">
                        <i class="fas fa-spinner fa-spin text-indigo-400 mr-1.5"></i>Đang kiểm tra kết nối Cổng Cà Thẻ SmartPOS (ECR)...
                    </div>
                </div>

                <!-- Footer buttons -->
                <div class="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                    <button type="button" class="btn-glass text-sm py-2.5" onclick="document.getElementById('payment-modal').classList.remove('open')">Hủy bỏ</button>
                    <button type="button" id="btn-confirm-checkout" class="btn-glass-success text-sm py-2.5 font-bold flex items-center justify-center gap-2" onclick="POS.confirmCheckout(${total})">
                        <i class="fas fa-check-circle"></i> <span id="btn-confirm-checkout-text">Xác Nhận & In HĐ</span>
                    </button>
                </div>
            </div>
        `;

        modal.classList.add('open');
        this.selectedPaymentMethod = 'cash';
        this.loadCardModuleStatus(total);
        this.checkVietQrLicense(total);
    },

    async checkVietQrLicense(total) {
        try {
            const res = await fetch('/api/license.php?action=status');
            const json = await res.json();
            const d = json && json.data ? json.data : {};
            const mods = Array.isArray(d.modules) ? d.modules : [];
            const blocked = Array.isArray(d.blocked_modules) ? d.blocked_modules : [];
            const allowed = !blocked.includes('vietqr_payment') && (mods.includes('vietqr_payment') || mods.includes('mod_vietqr_payment'));
            const btnBank = document.getElementById('paymethod-banking');
            const secBank = document.getElementById('payment-banking-section');
            if (!allowed) {
                if (btnBank) {
                    btnBank.innerHTML = `<i class="fas fa-lock text-rose-400"></i> Chuyển khoản QR <span class="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300">LOCK</span>`;
                }
                if (secBank) {
                    secBank.innerHTML = `
                        <div class="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs space-y-2 text-left">
                            <div class="flex items-center gap-2 font-bold text-sm text-rose-400">
                                <i class="fas fa-lock"></i>
                                <span>MODULE VIETQR TỰ ĐỘNG ĐÃ BỊ KHÓA / CHƯA CẤP PHÉP</span>
                            </div>
                            <p class="leading-relaxed text-[11px]">Mã module: <span class="font-mono text-rose-300">vietqr_payment</span> • Vui lòng bật lại trên Máy chủ Master SaaS.</p>
                        </div>
                    `;
                }
            }
        } catch (e) {}
    },

    cardModuleStatus: null,
    selectedCardScheme: 'VISA',
    selectedCardEntryMode: 'NFC Contactless',

    async loadCardModuleStatus(total) {
        try {
            const res = await fetch('/api/card/status');
            const data = await res.json();
            this.cardModuleStatus = data;

            const btnCard = document.getElementById('paymethod-card');
            if (btnCard) {
                if (data.module_state === 'BLOCKED') {
                    btnCard.innerHTML = `<i class="fas fa-ban text-rose-400"></i> Thẻ POS <span class="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300">BLOCK</span>`;
                } else if (data.module_state === 'OFF') {
                    btnCard.innerHTML = `<i class="fas fa-lock text-amber-400"></i> Thẻ POS <span class="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">OFF</span>`;
                } else {
                    btnCard.innerHTML = `<i class="fas fa-credit-card text-indigo-400"></i> Thẻ POS <span class="text-[9px] px-1 rounded bg-indigo-500/20 text-indigo-300">ECR</span>`;
                }
            }
            this.renderCardPaymentSection(total);
        } catch (e) {
            this.cardModuleStatus = { module_state: 'OFF', message: 'Không thể kết nối module cà thẻ.' };
            this.renderCardPaymentSection(total);
        }
    },

    renderCardPaymentSection(total) {
        const secCard = document.getElementById('payment-card-section');
        if (!secCard) return;

        const st = this.cardModuleStatus || { module_state: 'OFF' };
        if (st.module_state === 'BLOCKED' || st.module_state === 'OFF') {
            const isBlocked = st.module_state === 'BLOCKED';
            secCard.innerHTML = `
                <div class="p-3.5 rounded-xl ${isBlocked ? 'bg-rose-950/60 border border-rose-500/50 text-rose-200' : 'bg-amber-950/50 border border-amber-500/40 text-amber-200'} text-xs space-y-2">
                    <div class="flex items-center gap-2 font-bold text-sm ${isBlocked ? 'text-rose-400' : 'text-amber-400'}">
                        <i class="fas ${isBlocked ? 'fa-ban' : 'fa-lock'}"></i>
                        <span>${isBlocked ? 'MODULE CÀ THẺ BỊ KHÓA (BLOCKED BỞI MASTER)' : 'MODULE CÀ THẺ TÍN DỤNG ĐANG TẮT (OFF)'}</span>
                    </div>
                    <p class="leading-relaxed text-[11px]">${st.message || 'Module thanh toán thẻ tín dụng hiện không khả dụng trên giấy phép cửa hàng.'}</p>
                    <div class="text-[10px] text-slate-400 pt-1 border-t border-white/10">
                        <i class="fas fa-shield-halved mr-1"></i>Kiểm soát bởi <b>CyberNexus Master SaaS</b> • Vui lòng chọn Tiền mặt hoặc Chuyển khoản QR.
                    </div>
                </div>
            `;
            return;
        }

        const cfg = st.config || {};
        const surchargePct = parseFloat(cfg.customer_surcharge_percent) || 0;
        const surchargeAmt = Math.round(total * (surchargePct / 100.0));
        const totalCharged = Math.round(total) + surchargeAmt;
        const terminalName = (st.compatible_terminals || []).find(t => t.model_code === cfg.model_code)?.model_name || cfg.model_code || 'PAX A920 Pro';

        secCard.innerHTML = `
            <div class="space-y-3 text-xs">
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40">
                    <div class="flex items-center gap-2.5">
                        <span class="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                            <i class="fas fa-microchip"></i>
                        </span>
                        <div>
                            <div class="font-bold text-white flex items-center gap-1.5">
                                <span>${terminalName}</span>
                                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">AUTO ECR</span>
                            </div>
                            <div class="text-[10px] text-slate-300 font-mono">
                                ${cfg.acquirer_bank || 'Vietcombank'} • ${cfg.connection_type || 'LAN_TCP'} ${cfg.terminal_ip || '10.0.126.250'}:${cfg.terminal_port || 10009} • TID: ${cfg.tid || '88001234'}
                            </div>
                        </div>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">SIMULATION</span>
                </div>

                <!-- Surcharge & Total Charged Summary -->
                <div class="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-1">
                    <div class="flex justify-between text-[11px] text-slate-400">
                        <span>Tiền hóa đơn gốc:</span>
                        <span class="font-mono text-slate-200">${this.formatMoney(total)} đ</span>
                    </div>
                    <div class="flex justify-between text-[11px] text-slate-400">
                        <span>Phụ phí cà thẻ (${surchargePct}%):</span>
                        <span class="font-mono text-amber-300">+${this.formatMoney(surchargeAmt)} đ</span>
                    </div>
                    <div class="flex justify-between text-xs font-bold text-indigo-300 pt-1 border-t border-white/10">
                        <span>Tổng tiền đẩy tự động sang máy POS:</span>
                        <span class="font-mono text-sm text-emerald-400">${this.formatMoney(totalCharged)} đ</span>
                    </div>
                </div>

                <!-- Card Scheme & Entry Mode Selector -->
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-[10px] text-slate-400 mb-1">Tổ chức thẻ (Mô phỏng):</label>
                        <select id="ecr-card-scheme" onchange="POS.selectedCardScheme=this.value" class="w-full bg-slate-950 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white font-semibold">
                            <option value="VISA" ${this.selectedCardScheme === 'VISA' ? 'selected' : ''}>💳 VISA Credit/Debit</option>
                            <option value="MASTERCARD" ${this.selectedCardScheme === 'MASTERCARD' ? 'selected' : ''}>💳 MasterCard</option>
                            <option value="JCB" ${this.selectedCardScheme === 'JCB' ? 'selected' : ''}>💳 JCB Quốc Tế</option>
                            <option value="NAPAS" ${this.selectedCardScheme === 'NAPAS' ? 'selected' : ''}>💳 NAPAS Nội Địa</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 mb-1">Phương thức đọc thẻ:</label>
                        <select id="ecr-entry-mode" onchange="POS.selectedCardEntryMode=this.value" class="w-full bg-slate-950 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white font-semibold">
                            <option value="NFC Contactless" ${this.selectedCardEntryMode === 'NFC Contactless' ? 'selected' : ''}>📡 Chạm NFC / Apple Pay</option>
                            <option value="EMV Chip" ${this.selectedCardEntryMode === 'EMV Chip' ? 'selected' : ''}>🔌 Cắm Chip EMV</option>
                            <option value="QR POS" ${this.selectedCardEntryMode === 'QR POS' ? 'selected' : ''}>📱 Quét QR trên POS</option>
                        </select>
                    </div>
                </div>

                <!-- Live ECR Terminal Response Box -->
                <div id="ecr-live-status-box" class="p-2.5 rounded-xl bg-slate-950/90 border border-indigo-500/30 text-[11px] text-slate-300 flex items-center gap-2">
                    <i class="fas fa-satellite-dish text-indigo-400 text-sm animate-pulse"></i>
                    <span>Sẵn sàng đẩy lệnh <b>SALE ${this.formatMoney(totalCharged)}đ</b> sang máy <b>${terminalName}</b> khi bấm xác nhận.</span>
                </div>
            </div>
        `;
    },

    selectPaymentMethod(method, total) {
        this.selectedPaymentMethod = method;
        const btnCash = document.getElementById('paymethod-cash');
        const btnBank = document.getElementById('paymethod-banking');
        const btnCard = document.getElementById('paymethod-card');
        const secCash = document.getElementById('payment-cash-section');
        const secBank = document.getElementById('payment-banking-section');
        const secCard = document.getElementById('payment-card-section');
        const btnConfirm = document.getElementById('btn-confirm-checkout');
        const btnConfirmText = document.getElementById('btn-confirm-checkout-text');

        [btnCash, btnBank, btnCard].forEach(btn => {
            if (btn) btn.className = 'btn-glass text-xs py-2.5 flex items-center justify-center gap-1.5';
        });

        if (method === 'cash') {
            if (btnCash) btnCash.className = 'btn-glass btn-glass-primary text-xs py-2.5 flex items-center justify-center gap-1.5';
            if (secCash) secCash.classList.remove('hidden');
            if (secBank) secBank.classList.add('hidden');
            if (secCard) secCard.classList.add('hidden');
            if (btnConfirm) btnConfirm.disabled = false;
            if (btnConfirmText) btnConfirmText.textContent = 'Xác Nhận & In HĐ';
        } else if (method === 'banking') {
            if (btnBank) btnBank.className = 'btn-glass btn-glass-primary text-xs py-2.5 flex items-center justify-center gap-1.5';
            if (secCash) secCash.classList.add('hidden');
            if (secBank) secBank.classList.remove('hidden');
            if (secCard) secCard.classList.add('hidden');
            if (btnConfirm) btnConfirm.disabled = false;
            if (btnConfirmText) btnConfirmText.textContent = 'Xác Nhận & In HĐ';
        } else {
            if (btnCard) btnCard.className = 'btn-glass btn-glass-primary text-xs py-2.5 flex items-center justify-center gap-1.5';
            if (secCash) secCash.classList.add('hidden');
            if (secBank) secBank.classList.add('hidden');
            if (secCard) secCard.classList.remove('hidden');
            this.renderCardPaymentSection(total);

            const st = this.cardModuleStatus || { module_state: 'OFF' };
            if (st.module_state !== 'ON') {
                if (btnConfirm) btnConfirm.disabled = true;
                if (btnConfirmText) btnConfirmText.textContent = st.module_state === 'BLOCKED' ? 'Đã Khóa Bởi Master' : 'Module Đang Tắt';
            } else {
                if (btnConfirm) btnConfirm.disabled = false;
                if (btnConfirmText) btnConfirmText.textContent = 'Đẩy Lệnh POS & In HĐ';
            }
        }
    },

    setCashReceived(val, total) {
        const input = document.getElementById('cash-received-input');
        if (input) {
            input.value = val;
            this.calcChange(total);
        }
    },

    calcChange(total) {
        const input = document.getElementById('cash-received-input');
        const display = document.getElementById('cash-change-display');
        if (!input || !display) return;

        const received = parseFloat(input.value) || 0;
        const change = Math.max(0, received - total);
        display.innerText = this.formatMoney(change) + ' đ';
    },

    async confirmCheckout(total) {
        const btnConfirm = document.getElementById('btn-confirm-checkout');

        // Nếu chọn thanh toán bằng Thẻ POS (ECR), gọi tự động sang Cổng Cà Thẻ /api/card/charge trước
        if (this.selectedPaymentMethod === 'card') {
            const st = this.cardModuleStatus || { module_state: 'OFF' };
            if (st.module_state !== 'ON') {
                alert(st.message || 'Module Cổng Cà Thẻ Tín Dụng hiện đang TẮT hoặc BỊ KHÓA bởi Master!');
                return;
            }

            const statusBox = document.getElementById('ecr-live-status-box');
            const schemeEl = document.getElementById('ecr-card-scheme');
            const entryEl = document.getElementById('ecr-entry-mode');
            const cardScheme = schemeEl ? schemeEl.value : (this.selectedCardScheme || 'VISA');
            const entryMode = entryEl ? entryEl.value : (this.selectedCardEntryMode || 'NFC Contactless');

            if (btnConfirm) btnConfirm.disabled = true;
            if (statusBox) {
                statusBox.className = 'p-3 rounded-xl bg-indigo-950/90 border border-indigo-400/60 text-xs text-indigo-200 flex items-center gap-2.5';
                statusBox.innerHTML = `
                    <i class="fas fa-circle-notch fa-spin text-indigo-400 text-base"></i>
                    <div>
                        <div class="font-bold text-white">Đang đẩy lệnh SALE tự động sang máy POS...</div>
                        <div class="text-[10px] text-indigo-300">Giao thức Semi-Integrated ECR • Chờ khách chạm/cắm thẻ (${cardScheme} - ${entryMode})</div>
                    </div>
                `;
            }

            try {
                const chargeRes = await fetch('/api/card/charge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order_id: this.activeOrderId || 0,
                        order_code: this.currentTable ? `HD-${this.currentTable.code}` : 'HD-POS',
                        table_code: this.currentTable ? this.currentTable.code : 'MV',
                        amount: Math.round(total),
                        card_scheme: cardScheme,
                        entry_mode: entryMode,
                        cashier_name: (window.CURRENT_USER && window.CURRENT_USER.fullname) ? window.CURRENT_USER.fullname : 'Thu ngân POS'
                    })
                });
                const chargeData = await chargeRes.json();

                if (!chargeRes.ok || !chargeData.success || chargeData.status !== 'APPROVED') {
                    if (btnConfirm) btnConfirm.disabled = false;
                    if (statusBox) {
                        statusBox.className = 'p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-xs text-rose-200 flex items-center gap-2.5';
                        statusBox.innerHTML = `
                            <i class="fas fa-triangle-exclamation text-rose-400 text-base"></i>
                            <div>
                                <div class="font-bold text-rose-300">GIAO DỊCH THẺ TỪ CHỐI (${chargeData.status || 'ERROR'})</div>
                                <div class="text-[11px]">${chargeData.message || 'Ngân hàng từ chối giao dịch hoặc hết thời gian chờ.'}</div>
                            </div>
                        `;
                    }
                    return;
                }

                const tx = chargeData.transaction || {};
                if (statusBox) {
                    statusBox.className = 'p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-xs text-emerald-200 flex items-center gap-2.5';
                    statusBox.innerHTML = `
                        <i class="fas fa-circle-check text-emerald-400 text-base"></i>
                        <div>
                            <div class="font-bold text-emerald-300">CHUẨN CHI THÀNH CÔNG (APPROVED: ${tx.approval_code || 'OK'})</div>
                            <div class="text-[10px] font-mono text-slate-200">${tx.card_scheme} ${tx.masked_pan} • RRN: ${tx.rrn} • Tổng thu: ${this.formatMoney(tx.total_charged || total)}đ</div>
                        </div>
                    `;
                }
            } catch (err) {
                if (btnConfirm) btnConfirm.disabled = false;
                alert('Lỗi kết nối Cổng Cà Thẻ ECR: ' + err.message);
                return;
            }
        }

        const cashInput = document.getElementById('cash-received-input');
        const cashReceived = cashInput ? (parseFloat(cashInput.value) || total) : total;

        const payload = {
            order_id: this.activeOrderId,
            table_id: this.currentTable ? this.currentTable.id : null,
            payment_method: this.selectedPaymentMethod || 'cash',
            cash_received: cashReceived,
            discount_type: this.discount.type,
            discount_value: this.discount.value,
            discount_reason: this.discount.reason || '',
            vat_percent: this.vatPercent
        };

        try {
            const res = await fetch('api/orders.php?action=checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                document.getElementById('payment-modal').classList.remove('open');
                
                // Show on-screen receipt preview modal & trigger clean thermal print
                this.showReceiptModal(data.order, data.items, data.store);

                // Reset cart & reload tables
                this.cart = [];
                this.activeOrderId = null;
                this.discount = { type: 'amount', value: 0, reason: '' };
                this.renderCart();
                await this.loadTables();
            } else {
                alert(data.message || 'Lỗi xử lý thanh toán');
            }
        } catch (e) {
            console.error('Error during checkout:', e);
        }
    },

    // =========================================================
    // QUẢN LÝ CA LÀM VIỆC & SỔ QUỸ TIỀN MẶT TẠI QUẦY (SHIFT ACCOUNTING)
    // =========================================================
    async openShiftModal() {
        let modal = document.getElementById('pos-shift-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'pos-shift-modal';
            modal.className = 'liquid-modal-overlay';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="liquid-glass liquid-modal-content p-5 w-[680px] max-w-[95vw] text-white shadow-2xl border border-amber-500/40 max-h-[90vh] overflow-y-auto">
                <div class="text-center py-8 text-slate-400 text-xs">
                    <i class="fas fa-spinner fa-spin text-xl text-amber-400 mb-2"></i>
                    <p>Đang tải dữ liệu Ca làm việc & Sổ quỹ...</p>
                </div>
            </div>
        `;
        modal.classList.add('open');

        try {
            const res = await fetch('api/finance.php?action=shift_status');
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Lỗi tải trạng thái ca');

            if (!data.has_open_shift || !data.shift) {
                modal.innerHTML = `
                    <div class="liquid-glass liquid-modal-content p-6 w-[460px] max-w-[95vw] text-white shadow-2xl border border-amber-500/40">
                        <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                            <div class="flex items-center gap-2">
                                <span class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                                    <i class="fas fa-cash-register"></i>
                                </span>
                                <div>
                                    <h3 class="font-bold text-base text-amber-300">MỞ CA LÀM VIỆC MỚI</h3>
                                    <p class="text-[11px] text-slate-400">Khai báo tiền mặt đầu ca (tiền lẻ trong két)</p>
                                </div>
                            </div>
                            <button type="button" class="text-slate-400 hover:text-white text-xl" onclick="document.getElementById('pos-shift-modal').classList.remove('open')">&times;</button>
                        </div>

                        <div class="mb-3">
                            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Tiền mặt đầu ca trong két (VNĐ):</label>
                            <input type="number" id="shift-opening-cash-input" value="500000" class="liquid-input w-full font-mono text-lg font-bold text-amber-300 py-2 px-3" />
                            <div class="flex gap-1.5 mt-1.5">
                                <button type="button" class="px-2 py-1 rounded bg-slate-800 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('shift-opening-cash-input').value=500000">500.000đ</button>
                                <button type="button" class="px-2 py-1 rounded bg-slate-800 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('shift-opening-cash-input').value=1000000">1.000.000đ</button>
                                <button type="button" class="px-2 py-1 rounded bg-slate-800 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('shift-opening-cash-input').value=2000000">2.000.000đ</button>
                            </div>
                        </div>

                        <div class="mb-4">
                            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Ghi chú nhận ca:</label>
                            <input type="text" id="shift-opening-note-input" value="Nhận ca tiêu chuẩn" class="liquid-input w-full text-xs py-2 px-3" />
                        </div>

                        <div class="flex justify-end gap-2">
                            <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('pos-shift-modal').classList.remove('open')">Đóng</button>
                            <button type="button" class="btn-glass-success text-xs py-2 px-4 font-bold" onclick="POS.submitOpenShift()">
                                <i class="fas fa-play mr-1"></i> Bắt Đầu Mở Ca
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            const s = data.shift;
            const txs = data.transactions || [];
            const txRows = txs.map(t => `
                <tr class="border-b border-white/5 text-xs">
                    <td class="py-1.5 px-2 font-mono text-[11px] text-slate-400">${(t.created_at || '').slice(11, 16)}</td>
                    <td class="py-1.5 px-2">
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${t.trans_type === 'in' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">
                            ${t.trans_type === 'in' ? '+ THU' : '- CHI'}
                        </span>
                    </td>
                    <td class="py-1.5 px-2 text-slate-200">${t.reason} <span class="text-[10px] text-slate-400">(${t.category})</span></td>
                    <td class="py-1.5 px-2 text-right font-mono font-bold ${t.trans_type === 'in' ? 'text-emerald-400' : 'text-rose-400'}">
                        ${t.trans_type === 'in' ? '+' : '-'}${this.formatMoney(t.amount)}đ
                    </td>
                </tr>
            `).join('');

            const openedAtFmt = (typeof window.formatDateTimeDDMMYY === 'function')
                ? window.formatDateTimeDDMMYY(s.opened_at || '')
                : String(s.opened_at || '').replace(/^(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) => `${d}/${m}/${y.slice(-2)}`);

            modal.innerHTML = `
                <div class="liquid-glass liquid-modal-content p-5 w-[820px] max-w-[96vw] text-white shadow-2xl border border-amber-500/40 max-h-[92vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-3 pb-2 border-b border-white/10 gap-3">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <span class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                                <i class="fas fa-cash-register"></i>
                            </span>
                            <div class="min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h3 class="font-extrabold text-sm sm:text-base text-amber-300 uppercase whitespace-nowrap">Quản Lý Ca &amp; Sổ Quỹ (${s.shift_code})</h3>
                                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap shrink-0">ĐANG MỞ CA</span>
                                </div>
                                <p class="text-[11px] text-slate-400">Trực ca: <b>${s.user_name}</b> • Mở lúc: <span class="font-mono whitespace-nowrap">${openedAtFmt}</span></p>
                            </div>
                        </div>
                        <button type="button" class="text-slate-400 hover:text-white text-2xl shrink-0" onclick="document.getElementById('pos-shift-modal').classList.remove('open')">&times;</button>
                    </div>

                    <!-- KPI Dòng Tiền Trong Ca -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                        <div class="p-2.5 rounded-xl bg-slate-900/80 border border-white/10">
                            <span class="text-[10px] text-slate-400 uppercase block">Tiền mặt đầu ca</span>
                            <span class="text-sm font-black font-mono text-slate-200">${this.formatMoney(s.opening_cash)}đ</span>
                        </div>
                        <div class="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/30">
                            <span class="text-[10px] text-emerald-300 uppercase block">+ Bán hàng Tiền mặt</span>
                            <span class="text-sm font-black font-mono text-emerald-400">+${this.formatMoney(s.cash_sales)}đ</span>
                            <span class="text-[10px] text-sky-300 block mt-0.5">CK/QR: ${this.formatMoney(s.banking_sales)}đ</span>
                        </div>
                        <div class="p-2.5 rounded-xl bg-slate-900/80 border border-rose-500/30">
                            <span class="text-[10px] text-rose-300 uppercase block">Thu / Chi ngoài tại quầy</span>
                            <span class="text-xs font-bold font-mono text-emerald-400">+${this.formatMoney(s.cash_in)}đ</span>
                            <span class="text-xs font-bold font-mono text-rose-400 ml-1.5">-${this.formatMoney(s.cash_out)}đ</span>
                        </div>
                        <div class="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/50">
                            <span class="text-[10px] text-amber-300 uppercase font-bold block">= Tiền mặt lý thuyết</span>
                            <span class="text-base font-black font-mono text-amber-400">${this.formatMoney(s.expected_cash)}đ</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <!-- Lập Phiếu Thu / Chi Nhanh tại quầy -->
                        <div class="p-3.5 rounded-xl bg-slate-900/70 border border-white/10">
                            <h4 class="font-bold text-xs text-sky-300 uppercase mb-2.5 flex items-center gap-1.5">
                                <i class="fas fa-file-invoice-dollar"></i> Lập Phiếu Thu / Chi Nhanh Tại Quầy
                            </h4>
                            <div class="space-y-2">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <select id="shift-tx-type" class="liquid-input w-full text-xs py-1.5 px-2">
                                        <option value="out">🔻 Phiếu Chi (Lấy tiền két)</option>
                                        <option value="in">🔺 Phiếu Thu (Nộp thêm tiền lẻ)</option>
                                    </select>
                                    <select id="shift-tx-cat" class="liquid-input w-full text-xs py-1.5 px-2">
                                        <option value="Nguyên vật liệu">Mua đá / Nguyên liệu gấp</option>
                                        <option value="Vận hành">Chi phí vận hành / Ship</option>
                                        <option value="Tiền lẻ">Bổ sung tiền lẻ đầu ngày</option>
                                        <option value="Khác">Khoản thu/chi khác</option>
                                    </select>
                                </div>
                                <input type="number" id="shift-tx-amount" placeholder="Số tiền (VNĐ)..." class="liquid-input w-full text-xs font-mono font-bold py-1.5 px-2.5" />
                                <input type="text" id="shift-tx-reason" placeholder="Lý do chi tiết (VD: Mua 2 bao đá bi, mua sữa tươi)..." class="liquid-input w-full text-xs py-1.5 px-2.5" />
                                <button type="button" onclick="POS.submitCashTx()" class="w-full btn-glass-primary text-xs py-2 font-bold">
                                    <i class="fas fa-plus-circle mr-1"></i> Lưu Phiếu & Đồng Bộ Kế Toán
                                </button>
                            </div>
                        </div>

                        <!-- Kết Ca & Bàn Giao Tiền Mặt -->
                        <div class="p-3.5 rounded-xl bg-slate-900/70 border border-amber-500/30">
                            <h4 class="font-bold text-xs text-amber-300 uppercase mb-2.5 flex items-center gap-1.5">
                                <i class="fas fa-lock"></i> Kết Ca & Kiểm Đếm Tiền Mặt Thực Tế
                            </h4>
                            <div class="space-y-2">
                                <div>
                                    <label class="block text-[11px] text-slate-300 mb-1">Tiền mặt thực đếm trong ngăn kéo (VNĐ):</label>
                                    <input type="number" id="shift-actual-cash" value="${Math.round(s.expected_cash)}" class="liquid-input w-full text-sm font-mono font-black text-emerald-400 py-1.5 px-2.5" />
                                </div>
                                <div>
                                    <label class="block text-[11px] text-slate-300 mb-1">Ghi chú bàn giao ca:</label>
                                    <input type="text" id="shift-close-note" value="Đã kiểm đếm đủ bàn giao cuối ca" class="liquid-input w-full text-xs py-1.5 px-2.5" />
                                </div>
                                <button type="button" onclick="POS.submitCloseShift()" class="w-full btn-glass text-xs py-2 bg-rose-600/80 hover:bg-rose-600 text-white border-rose-500 font-bold">
                                    <i class="fas fa-check-double mr-1"></i> Chốt Kết Ca & Gửi Báo Cáo Audit
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Danh sách Phiếu Thu/Chi trong ca -->
                    <div class="rounded-xl bg-slate-900/60 border border-white/10 p-3">
                        <h5 class="text-xs font-bold text-slate-300 mb-2">Phiếu Thu / Chi phát sinh trong ca (${txs.length})</h5>
                        <div class="max-h-36 overflow-y-auto">
                            <table class="w-full text-left border-collapse">
                                <tbody>
                                    ${txRows || '<tr><td colspan="4" class="py-3 text-center text-xs text-slate-500">Chưa có phiếu thu/chi ngoài nào trong ca này</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            modal.innerHTML = `<div class="liquid-glass p-6 text-rose-400 text-xs">${e.message}</div>`;
        }
    },

    async submitOpenShift() {
        const openingCash = parseFloat(document.getElementById('shift-opening-cash-input')?.value) || 0;
        const note = document.getElementById('shift-opening-note-input')?.value.trim() || 'Mở ca chuẩn';
        try {
            const res = await fetch('api/finance.php?action=open_shift', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ opening_cash: openingCash, note })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.message || 'Lỗi mở ca');
                return;
            }
            await this.openShiftModal();
        } catch (e) {
            alert('Lỗi kết nối khi mở ca');
        }
    },

    async submitCashTx() {
        const transType = document.getElementById('shift-tx-type')?.value || 'out';
        const category = document.getElementById('shift-tx-cat')?.value || 'Khác';
        const amount = parseFloat(document.getElementById('shift-tx-amount')?.value) || 0;
        const reason = document.getElementById('shift-tx-reason')?.value.trim() || '';

        if (amount <= 0 || !reason) {
            alert('Vui lòng nhập Số tiền (> 0) và Lý do Thu/Chi cụ thể!');
            return;
        }

        try {
            const res = await fetch('api/finance.php?action=add_cash_tx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trans_type: transType, category, amount, reason })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.message || 'Lỗi lưu phiếu');
                return;
            }
            await this.openShiftModal();
        } catch (e) {
            alert('Lỗi kết nối khi lưu phiếu thu/chi');
        }
    },

    async submitCloseShift() {
        const actualCash = parseFloat(document.getElementById('shift-actual-cash')?.value) || 0;
        const note = document.getElementById('shift-close-note')?.value.trim() || 'Bàn giao cuối ca';
        if (!confirm('Xác nhận chốt kết ca và gửi biên bản đối soát két tiền lên Quản trị / Kế toán?')) return;

        try {
            const res = await fetch('api/finance.php?action=close_shift', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actual_cash: actualCash, note })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.message || 'Lỗi kết ca');
                return;
            }
            alert(data.message);
            await this.openShiftModal();
        } catch (e) {
            alert('Lỗi kết nối khi kết ca');
        }
    },

    // Thermal Receipt Printer Preview & Print Engine
    lastReceiptHtml: '',

    // In tạm tính cho đơn hàng đang tạo (chỉ in nội dung đơn đang tạo)
    printTemporaryReceipt() {
        if (!this.cart || this.cart.length === 0) {
            alert('Đơn hàng đang tạo chưa có món ăn nào để in tạm tính!');
            return;
        }

        // Ghi nhận Kiểm toán nội bộ hành vi In tạm tính
        fetch('api/orders.php?action=log_audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action_code: 'PRINT_TEMP_BILL',
                action_label: 'In phiếu tạm tính bàn ' + (this.currentTable ? this.currentTable.code : 'MV'),
                severity: 'INFO',
                order_id: this.activeOrderId || 0,
                order_code: (this.activeOrder && this.activeOrder.order_code) ? this.activeOrder.order_code : 'TEMP',
                table_code: this.currentTable ? this.currentTable.code : 'MV',
                amount_impact: 0,
                reason: 'Thu ngân in phiếu tạm tính kiểm tra đơn',
                details: 'Số món: ' + this.cart.length
            })
        }).catch(() => {});

        let subtotal = 0;
        const formattedItems = this.cart.map(item => {
            let toppingPrice = 0;
            if (item.toppings && item.toppings.length > 0) {
                toppingPrice = item.toppings.reduce((acc, t) => acc + (parseFloat(t.price) || 0), 0);
            }
            const unitPrice = (parseFloat(item.price) || 0) + toppingPrice;
            const itemSubtotal = unitPrice * (parseInt(item.quantity) || 1);
            subtotal += itemSubtotal;
            return {
                ...item,
                product_name: item.name || item.product_name,
                price: unitPrice,
                subtotal: itemSubtotal
            };
        });

        let discountAmount = 0;
        if (this.discount.type === 'percent') {
            discountAmount = (subtotal * Math.min(100, Math.max(0, this.discount.value))) / 100;
        } else {
            discountAmount = Math.min(subtotal, Math.max(0, this.discount.value));
        }

        const afterDiscount = Math.max(0, subtotal - discountAmount);
        const vatAmount = (afterDiscount * Math.max(0, this.vatPercent)) / 100;
        const total = afterDiscount + vatAmount;

        const tableName = this.currentTable ? (this.currentTable.name || this.currentTable.code) : 'Khách mang về';
        const tempOrderCode = (this.activeOrder && this.activeOrder.order_code) ? this.activeOrder.order_code : 'ĐANG TẠO';

        const tempOrder = {
            order_code: tempOrderCode,
            table_code: tableName,
            customer_name: this.customerName || 'Khách vãng lai',
            guest_count: this.guestCount || 1,
            user_name: (window.currentUser && window.currentUser.fullname) ? window.currentUser.fullname : 'Thu ngân',
            created_at: new Date().toLocaleString('vi-VN'),
            subtotal: subtotal,
            discount_amount: discountAmount,
            vat_percent: this.vatPercent,
            vat_amount: vatAmount,
            total_amount: total,
            is_temporary: true
        };

        this.showReceiptModal(tempOrder, formattedItems, null, 'PHIẾU TẠM TÍNH', 'Phiếu tạm tính - Đơn đang tạo');
    },

    generateReceiptHtml(order, items, store) {
        const storeName = store ? store.name : (this.storeSettings['store_name'] || 'GÓC PHỐ COFFEE & TEA');
        const hotline = store ? store.hotline : (this.storeSettings['store_hotline'] || '0967.041.111');
        const address = store ? store.address : (this.storeSettings['store_address'] || '123 Đường Số 5, P. Linh Trung, TP. Thủ Đức, TP.HCM');
        const wifi = store ? store.wifi : (this.storeSettings['store_wifi'] || 'GocPho_Guest / pass: 88888888');

        let itemsHtml = '';
        (items || []).forEach((it, i) => {
            const toppings = it.toppings_json ? (typeof it.toppings_json === 'string' ? JSON.parse(it.toppings_json) : it.toppings_json) : (it.toppings || []);
            let toppingNames = '';
            if (toppings.length > 0) {
                toppingNames = `<div style="font-size: 11px; padding-left: 12px; color: #444;">+ ${toppings.map(t => t.name).join(', ')}</div>`;
            }

            const itemName = it.product_name || it.name || 'Món';
            const itemPrice = parseFloat(it.price) || 0;
            const itemQty = it.quantity || 1;
            const itemSubtotal = it.subtotal || (itemPrice * itemQty);

            itemsHtml += `
                <div style="margin-bottom: 5px;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold;">
                        <span>${i + 1}. ${itemName}</span>
                        <span>${this.formatMoney(itemSubtotal)} đ</span>
                    </div>
                    <div style="font-size: 11px; color: #555; display: flex; justify-content: space-between; padding-left: 12px;">
                        <span>${itemQty} ${it.unit || 'ly'} x ${this.formatMoney(itemPrice)} đ</span>
                    </div>
                    ${toppingNames}
                    ${it.note ? `<div style="font-size: 11px; font-style: italic; color: #b91c1c; padding-left: 12px;">* ${it.note}</div>` : ''}
                </div>
            `;
        });

        const isTemp = !!(order && order.is_temporary);
        const receiptTitle = isTemp ? '*** PHIẾU TẠM TÍNH ***' : 'PHIẾU THANH TOÁN';
        const orderCodeText = isTemp ? '(ĐƠN ĐANG TẠO - CHƯA THANH TOÁN)' : `Số HĐ: ${order.order_code}`;
        const payMethodName = order.payment_method === 'banking' ? 'Chuyển khoản (VietQR)' : (order.payment_method === 'card' ? 'Thẻ POS' : 'Tiền mặt');

        return `
            <div style="text-align: center; margin-bottom: 8px;">
                <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${storeName}</div>
                <div style="font-size: 11px; color: #444; margin-top: 2px;">${address}</div>
                <div style="font-size: 11px; color: #444;">Hotline: <b>${hotline}</b></div>
                <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
                <div style="font-size: 15px; font-weight: bold; letter-spacing: 1px;">${receiptTitle}</div>
                <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">${orderCodeText}</div>
                <div style="font-size: 11px; color: #444;">Bàn: <b>${order.table_code}</b> | Thu ngân: <b>${order.user_name || 'Thu ngân'}</b></div>
                <div style="font-size: 11px; color: #444;">Thời gian: ${order.completed_at || order.created_at || new Date().toLocaleString('vi-VN')}</div>
            </div>
            
            <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
            
            <div style="margin: 8px 0;">
                ${itemsHtml}
            </div>
            
            <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
            
            <div style="font-size: 12px; line-height: 1.6;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Tiền hàng:</span>
                    <span style="font-weight: bold;">${this.formatMoney(order.subtotal)} đ</span>
                </div>
                ${order.discount_amount > 0 ? `
                <div style="display: flex; justify-content: space-between; color: #b91c1c;">
                    <span>Giảm giá:</span>
                    <span>-${this.formatMoney(order.discount_amount)} đ</span>
                </div>` : ''}
                ${order.vat_amount > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>VAT (${order.vat_percent}%):</span>
                    <span>+${this.formatMoney(order.vat_amount)} đ</span>
                </div>` : ''}
                <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
                <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900;">
                    <span>TỔNG CỘNG:</span>
                    <span>${this.formatMoney(order.total_amount)} đ</span>
                </div>
                ${isTemp ? `
                <div style="text-align: center; margin-top: 8px; padding: 4px; border: 1px dashed #555; font-size: 11px; font-weight: bold; color: #111;">
                    *** VUI LÒNG KIỂM TRA LẠI MÓN ĂN ***<br>
                    <span style="font-size: 10px; font-weight: normal; color: #555;">(Phiếu tạm tính - Chưa có giá trị thanh toán)</span>
                </div>
                ` : `
                <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px;">
                    <span>Hình thức thanh toán:</span>
                    <span style="font-weight: bold;">${payMethodName}</span>
                </div>
                ${order.payment_method === 'cash' ? `
                <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span>Tiền khách đưa:</span>
                    <span>${this.formatMoney(order.cash_received)} đ</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span>Tiền thối lại:</span>
                    <span style="font-weight: bold;">${this.formatMoney(order.change_amount)} đ</span>
                </div>` : ''}
                `}
            </div>
            
            <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
            
            <div style="text-align: center; font-size: 11px; color: #333; margin-top: 6px;">
                <div>Wifi: <b>${wifi}</b></div>
                <div style="font-weight: bold; margin-top: 4px; font-size: 12px;">CẢM ƠN VÀ HẸN GẶP LẠI QUÝ KHÁCH!</div>
                <div style="font-size: 9px; color: #777; margin-top: 2px;">Hệ thống POS Góc Phố</div>
            </div>
        `;
    },

    showReceiptModal(order, items, store, title = 'THANH TOÁN THÀNH CÔNG', subtitle = 'Xem trước & In hóa đơn nhiệt') {
        const html = this.generateReceiptHtml(order, items, store);
        this.lastReceiptHtml = html;
        this.lastReceiptOrder = order;
        this.lastReceiptItems = items;
        this.lastReceiptStore = store;

        // Populate titles & close button text
        const titleEl = document.getElementById('receipt-modal-title');
        if (titleEl) titleEl.innerText = title;
        const subTitleEl = document.getElementById('receipt-modal-subtitle');
        if (subTitleEl) subTitleEl.innerText = subtitle;
        const closeTextEl = document.getElementById('receipt-modal-close-text');
        if (closeTextEl) closeTextEl.innerText = (title === 'THANH TOÁN THÀNH CÔNG') ? 'Đóng (Tạo đơn mới)' : 'Đóng';

        const iconEl = document.getElementById('receipt-modal-icon');
        if (iconEl) {
            if (order && order.is_temporary) {
                iconEl.className = 'w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-sm border border-sky-500/30';
                iconEl.innerHTML = '<i class="fas fa-print"></i>';
            } else {
                iconEl.className = 'w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm border border-emerald-500/30';
                iconEl.innerHTML = '<i class="fas fa-check-circle"></i>';
            }
        }

        const printBtnTextEl = document.getElementById('receipt-modal-print-btn-text');
        if (printBtnTextEl) {
            printBtnTextEl.innerText = (order && order.is_temporary) ? 'In Phiếu Tạm (80mm)' : 'In Hóa Đơn (80mm)';
        }

        // Populate on-screen paper slip preview
        const paperEl = document.getElementById('receipt-preview-paper');
        if (paperEl) {
            paperEl.innerHTML = html;
        }

        // Populate printable-receipt element
        const printEl = document.getElementById('printable-receipt');
        if (printEl) {
            printEl.innerHTML = html;
        }

        // Open modal
        const modal = document.getElementById('receipt-modal');
        if (modal) {
            modal.classList.add('open');
        }

        // NOTE: Auto-print on checkout is intentionally disabled per user requirement:
        // Cashier will preview receipt on screen and explicitly click [In Hóa Đơn (80mm)] to print.
    },

    closeReceiptModal() {
        const modal = document.getElementById('receipt-modal');
        if (modal) {
            modal.classList.remove('open');
        }
    },

    triggerThermalPrint() {
        if (!this.lastReceiptHtml) {
            const printEl = document.getElementById('printable-receipt');
            if (printEl && printEl.innerHTML) {
                this.lastReceiptHtml = printEl.innerHTML;
            }
        }
        if (!this.lastReceiptHtml) return;

        let iframe = document.getElementById('thermal-print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'thermal-print-iframe';
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
                <title>Phiếu Thanh Toán</title>
                <style>
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    * {
                        box-sizing: border-box;
                    }
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
                ${this.lastReceiptHtml}
            </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.warn('Iframe print error, falling back to window.print():', err);
                window.print();
            }
        }, 200);
    },

    // Legacy alias
    printReceipt(order, items, store) {
        this.showReceiptModal(order, items, store);
    },

    // ==========================================
    // TRA CỨU & IN LẠI HÓA ĐƠN BẤT KỲ
    // ==========================================
    reprintSearchTimeout: null,

    openReprintModal() {
        const modal = document.getElementById('reprint-search-modal');
        if (!modal) return;

        // Default to today
        const todayStr = new Date().toISOString().split('T')[0];
        const dateFromEl = document.getElementById('reprint-date-from');
        const dateToEl = document.getElementById('reprint-date-to');
        const statusEl = document.getElementById('reprint-status-filter');
        const searchInput = document.getElementById('reprint-search-input');

        if (dateFromEl && !dateFromEl.value) dateFromEl.value = todayStr;
        if (dateToEl && !dateToEl.value) dateToEl.value = todayStr;
        if (statusEl) statusEl.value = 'completed';
        if (searchInput) {
            searchInput.value = '';
            const clearBtn = document.getElementById('reprint-search-clear');
            if (clearBtn) clearBtn.classList.add('hidden');
        }

        modal.classList.add('open');
        this.loadReprintOrders();
        setTimeout(() => {
            if (searchInput) searchInput.focus();
        }, 150);
    },

    closeReprintModal() {
        const modal = document.getElementById('reprint-search-modal');
        if (modal) modal.classList.remove('open');
    },

    setReprintDatePreset(preset) {
        const dateFromEl = document.getElementById('reprint-date-from');
        const dateToEl = document.getElementById('reprint-date-to');
        if (!dateFromEl || !dateToEl) return;

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Reset preset button styling
        document.querySelectorAll('.reprint-preset-btn').forEach(btn => {
            btn.className = 'reprint-preset-btn px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700';
        });

        const activeBtn = document.getElementById(`preset-${preset}`);
        if (activeBtn) {
            activeBtn.className = 'reprint-preset-btn px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold hover:bg-sky-500/30';
        }

        if (preset === 'today') {
            dateFromEl.value = todayStr;
            dateToEl.value = todayStr;
        } else if (preset === 'yesterday') {
            const yesterday = new Date(now.getTime() - 86400000);
            const yestStr = yesterday.toISOString().split('T')[0];
            dateFromEl.value = yestStr;
            dateToEl.value = yestStr;
        } else if (preset === '7days') {
            const past7 = new Date(now.getTime() - 7 * 86400000);
            dateFromEl.value = past7.toISOString().split('T')[0];
            dateToEl.value = todayStr;
        } else if (preset === 'all') {
            dateFromEl.value = '';
            dateToEl.value = '';
        }

        this.loadReprintOrders();
    },

    handleReprintSearchKeyup(event) {
        const clearBtn = document.getElementById('reprint-search-clear');
        const val = (event.target.value || '').trim();
        if (clearBtn) {
            if (val.length > 0) clearBtn.classList.remove('hidden');
            else clearBtn.classList.add('hidden');
        }

        if (event.key === 'Enter') {
            clearTimeout(this.reprintSearchTimeout);
            this.loadReprintOrders();
            return;
        }

        clearTimeout(this.reprintSearchTimeout);
        this.reprintSearchTimeout = setTimeout(() => {
            this.loadReprintOrders();
        }, 350);
    },

    clearReprintSearch() {
        const searchInput = document.getElementById('reprint-search-input');
        const clearBtn = document.getElementById('reprint-search-clear');
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');
        this.loadReprintOrders();
    },

    async loadReprintOrders() {
        const container = document.getElementById('reprint-orders-container');
        const countEl = document.getElementById('reprint-orders-count');
        if (!container) return;

        const searchInput = document.getElementById('reprint-search-input');
        const search = (searchInput && searchInput.value ? searchInput.value : '').trim();
        const dateFromEl = document.getElementById('reprint-date-from');
        const dateFrom = dateFromEl && dateFromEl.value ? dateFromEl.value : '';
        const dateToEl = document.getElementById('reprint-date-to');
        const dateTo = dateToEl && dateToEl.value ? dateToEl.value : '';
        const statusEl = document.getElementById('reprint-status-filter');
        const status = statusEl && statusEl.value ? statusEl.value : 'completed';

        container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-12 text-slate-400">
                <i class="fas fa-spinner fa-spin text-2xl text-sky-400 mb-2"></i>
                <span class="text-xs">Đang tìm kiếm hóa đơn...</span>
            </div>
        `;

        try {
            let url = `api/orders.php?action=history&limit=150`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (dateFrom) url += `&date_from=${encodeURIComponent(dateFrom)}`;
            if (dateTo) url += `&date_to=${encodeURIComponent(dateTo)}`;
            if (status) url += `&status=${encodeURIComponent(status)}`;
            if (!dateFrom && !dateTo && !search) url += `&all_dates=1`;

            const res = await fetch(url);
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                        <i class="fas fa-receipt text-4xl mb-3 opacity-40"></i>
                        <p class="text-sm font-semibold text-slate-300">Không tìm thấy hóa đơn nào phù hợp!</p>
                        <p class="text-xs text-slate-500 mt-1">Hãy thử xóa từ khóa tìm kiếm hoặc chọn khoảng thời gian "Tất cả thời gian".</p>
                    </div>
                `;
                if (countEl) countEl.innerText = 'Tìm thấy 0 hóa đơn';
                const sTotal = document.getElementById('reprint-stat-total');
                const sCash = document.getElementById('reprint-stat-cash');
                const sBank = document.getElementById('reprint-stat-banking');
                const sCount = document.getElementById('reprint-stat-count');
                if (sTotal) sTotal.innerText = '0 đ';
                if (sCash) sCash.innerText = '0 đ';
                if (sBank) sBank.innerText = '0 đ';
                if (sCount) sCount.innerText = '0 đơn';
                return;
            }

            const orders = data.data;
            if (countEl) countEl.innerText = `Tìm thấy ${orders.length} hóa đơn`;

            // Calculate live revenue & payment breakdown for filtered orders
            let totalRev = 0;
            let totalCash = 0;
            let totalBanking = 0;
            let completedOrders = 0;

            orders.forEach(o => {
                if (o.status === 'completed') {
                    const amt = parseFloat(o.total_amount) || 0;
                    totalRev += amt;
                    if (o.payment_method === 'banking' || o.payment_method === 'card') {
                        totalBanking += amt;
                    } else {
                        totalCash += amt;
                    }
                    completedOrders++;
                }
            });

            const sTotal = document.getElementById('reprint-stat-total');
            const sCash = document.getElementById('reprint-stat-cash');
            const sBank = document.getElementById('reprint-stat-banking');
            const sCount = document.getElementById('reprint-stat-count');
            if (sTotal) sTotal.innerText = this.formatMoney(totalRev) + ' đ';
            if (sCash) sCash.innerText = this.formatMoney(totalCash) + ' đ';
            if (sBank) sBank.innerText = this.formatMoney(totalBanking) + ' đ';
            if (sCount) sCount.innerText = `${completedOrders} / ${orders.length} đơn`;

            let html = '';
            orders.forEach(o => {
                const isPaid = (o.status === 'completed');
                const payMethodLabel = (o.payment_method === 'banking') ? 'VietQR / CK' : ((o.payment_method === 'card') ? 'Thẻ' : 'Tiền mặt');
                const rawTime = o.completed_at || o.created_at || '';
                const timeStr = (typeof window.formatDateTimeDDMMYY === 'function')
                    ? window.formatDateTimeDDMMYY(rawTime)
                    : rawTime.replace(/^(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) => `${d}/${m}/${y.slice(-2)}`);
                const itemsCount = o.items_count || 0;
                const itemsSummary = o.items_summary || 'Chưa có thông tin món';

                html += `
                    <div class="p-3 mb-2 rounded-xl bg-slate-900/60 border border-white/10 hover:border-sky-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-start gap-3 min-w-0 flex-1">
                            <div class="w-10 h-10 rounded-xl ${isPaid ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'} flex items-center justify-center shrink-0">
                                <i class="fas ${isPaid ? 'fa-file-invoice-dollar' : 'fa-clock'} text-base"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-mono font-bold text-sky-400 text-sm whitespace-nowrap">${o.order_code}</span>
                                    <span class="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-xs whitespace-nowrap">${o.table_code || 'MANG VỀ'}</span>
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase whitespace-nowrap ${isPaid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
                                        ${isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                                    </span>
                                    <span class="text-[11px] text-slate-400 font-mono whitespace-nowrap"><i class="far fa-clock mr-1"></i>${timeStr}</span>
                                </div>
                                <div class="text-xs text-slate-300 mt-1 truncate" title="${itemsSummary}">
                                    <i class="fas fa-utensils text-slate-500 mr-1"></i>
                                    <span class="text-slate-400 font-medium">${itemsCount} món:</span> ${itemsSummary}
                                </div>
                                <div class="text-[11px] text-slate-400 mt-0.5 truncate">
                                    Thu ngân: <span class="text-slate-300 font-medium">${o.user_name || 'Hệ thống'}</span>
                                    ${o.customer_name ? ` • Khách: <span class="text-slate-300">${o.customer_name}</span>` : ''}
                                    • HTTT: <span class="text-slate-300 font-medium">${payMethodLabel}</span>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 whitespace-nowrap">
                            <div class="text-left sm:text-right">
                                <div class="text-[10px] text-slate-400">Tổng tiền</div>
                                <div class="text-base font-extrabold font-mono text-emerald-400">${this.formatMoney(o.total_amount)} đ</div>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <button type="button" onclick="POS.previewOrderReceipt(${o.id})" class="btn-glass text-xs py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border-white/10 flex items-center gap-1 font-semibold whitespace-nowrap" title="Xem trước hóa đơn nhiệt">
                                    <i class="fas fa-eye text-xs"></i> <span>Xem</span>
                                </button>
                                <button type="button" onclick="POS.reprintOrderReceipt(${o.id})" class="btn-glass-primary text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold shadow-md shadow-sky-500/20 whitespace-nowrap" title="In lại hóa đơn ngay">
                                    <i class="fas fa-print"></i> <span>In Lại</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
        } catch (e) {
            console.error('Lỗi tải danh sách hóa đơn:', e);
            container.innerHTML = `
                <div class="p-8 text-center text-rose-400 text-xs">
                    <i class="fas fa-exclamation-triangle text-xl mb-1"></i>
                    <div>Không thể tải danh sách hóa đơn. Vui lòng thử lại!</div>
                </div>
            `;
        }
    },

    async previewOrderReceipt(orderId) {
        try {
            const res = await fetch(`api/orders.php?action=detail&order_id=${orderId}`);
            const data = await res.json();
            if (!data.success || !data.order) {
                alert(data.message || 'Không tìm thấy thông tin hóa đơn!');
                return;
            }

            this.showReceiptModal(data.order, data.items, data.store, `PHIẾU THANH TOÁN (HĐ: ${data.order.order_code})`, `In lại hóa đơn đã thanh toán`);
        } catch (e) {
            console.error('Lỗi xem hóa đơn:', e);
            alert('Lỗi khi tải thông tin hóa đơn!');
        }
    },

    async reprintOrderReceipt(orderId) {
        try {
            const res = await fetch(`api/orders.php?action=detail&order_id=${orderId}`);
            const data = await res.json();
            if (!data.success || !data.order) {
                alert(data.message || 'Không tìm thấy thông tin hóa đơn!');
                return;
            }

            const html = this.generateReceiptHtml(data.order, data.items, data.store);
            this.lastReceiptHtml = html;
            this.lastReceiptOrder = data.order;
            this.lastReceiptItems = data.items;
            this.lastReceiptStore = data.store;

            // Trigger thermal print
            this.triggerThermalPrint();

            // Notify user
            this.showToast(`Đang gửi lệnh in hóa đơn ${data.order.order_code}...`, 'success');
        } catch (e) {
            console.error('Lỗi in lại hóa đơn:', e);
            alert('Lỗi khi tải và in hóa đơn!');
        }
    },

    reprintLastReceipt() {
        if (this.lastReceiptHtml) {
            const modal = document.getElementById('receipt-modal');
            if (modal) modal.classList.add('open');
        } else {
            this.openReprintModal();
        }
    },

    // ==========================================
    // REVENUE STATS & SHIFT REPORT MODAL
    // ==========================================
    currentShiftReportData: null,

    async openRevenueStatsModal(preset = 'today') {
        const modal = document.getElementById('pos-revenue-modal');
        if (!modal) return;
        modal.classList.add('open');
        await this.loadRevenueStats(preset);
    },

    closeRevenueStatsModal() {
        const modal = document.getElementById('pos-revenue-modal');
        if (modal) modal.classList.remove('open');
    },

    async loadRevenueStats(preset = 'today') {
        const contentEl = document.getElementById('pos-revenue-content');
        if (!contentEl) return;

        contentEl.innerHTML = `
            <div class="flex flex-col items-center justify-center p-12 text-slate-400">
                <i class="fas fa-spinner fa-spin text-2xl text-emerald-400 mb-2"></i>
                <span class="text-xs">Đang tổng hợp số liệu doanh thu...</span>
            </div>
        `;

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        let dateFrom = todayStr;
        let dateTo = todayStr;

        if (preset === 'yesterday') {
            const yest = new Date(now.getTime() - 86400000);
            dateFrom = yest.toISOString().split('T')[0];
            dateTo = dateFrom;
        } else if (preset === '7days') {
            const p7 = new Date(now.getTime() - 7 * 86400000);
            dateFrom = p7.toISOString().split('T')[0];
            dateTo = todayStr;
        } else if (preset === 'month') {
            dateFrom = todayStr.substring(0, 7) + '-01';
            dateTo = todayStr;
        }

        try {
            const res = await fetch(`api/reports.php?action=pos_shift_report&date_from=${dateFrom}&date_to=${dateTo}`);
            const json = await res.json();
            if (!json.success || !json.data) {
                contentEl.innerHTML = `<div class="p-8 text-center text-rose-400">Không thể tải báo cáo doanh thu</div>`;
                return;
            }

            const d = json.data;
            this.currentShiftReportData = d;

            let topItemsHtml = '';
            if (Array.isArray(d.top_products) && d.top_products.length > 0) {
                topItemsHtml = d.top_products.map((p, idx) => `
                    <div class="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                        <span class="text-slate-300 font-medium">#${idx+1}. ${p.product_name}</span>
                        <span class="font-mono text-sky-400 font-bold">${p.qty} ${p.unit || 'phần'} • ${this.formatMoney(p.revenue)} đ</span>
                    </div>
                `).join('');
            } else {
                topItemsHtml = `<div class="text-slate-500 text-xs py-2 italic text-center">Chưa có món nào bán ra trong khoảng thời gian này</div>`;
            }

            contentEl.innerHTML = `
                <!-- Preset buttons -->
                <div class="flex items-center gap-1.5 pb-2 border-b border-white/10 text-xs flex-wrap">
                    <span class="text-slate-400 text-[11px] mr-1">Khoảng thời gian:</span>
                    <button type="button" onclick="POS.loadRevenueStats('today')" class="px-2.5 py-1 rounded-lg ${preset === 'today' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">Hôm Nay</button>
                    <button type="button" onclick="POS.loadRevenueStats('yesterday')" class="px-2.5 py-1 rounded-lg ${preset === 'yesterday' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">Hôm Qua</button>
                    <button type="button" onclick="POS.loadRevenueStats('7days')" class="px-2.5 py-1 rounded-lg ${preset === '7days' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">7 Ngày</button>
                    <button type="button" onclick="POS.loadRevenueStats('month')" class="px-2.5 py-1 rounded-lg ${preset === 'month' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">Tháng Này</button>
                </div>

                <!-- Big Highlight Revenue Box -->
                <div class="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600/30 to-teal-700/30 border border-emerald-500/40 flex items-center justify-between">
                    <div>
                        <div class="text-[11px] font-black uppercase tracking-wider text-emerald-300">TỔNG DOANH THU THU VỀ</div>
                        <div class="text-xs text-slate-300 mt-0.5">${d.total_orders} hóa đơn đã hoàn tất thanh toán</div>
                    </div>
                    <div class="text-2xl font-black font-mono text-emerald-300">
                        ${this.formatMoney(d.total_revenue)} <span class="text-xs font-normal">VNĐ</span>
                    </div>
                </div>

                <!-- Payment Methods Breakdown Cards -->
                <div class="grid grid-cols-3 gap-2">
                    <div class="p-3 rounded-xl bg-slate-900/80 border border-white/10 min-w-0">
                        <div class="flex items-center gap-1.5 text-xs text-slate-400 mb-1 whitespace-nowrap">
                            <i class="fas fa-money-bill-wave text-emerald-400"></i>
                            <span>Tiền Mặt</span>
                        </div>
                        <div class="font-mono font-bold text-sm sm:text-base text-white whitespace-nowrap">${this.formatMoney(d.cash_revenue)} đ</div>
                        <div class="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">${d.cash_orders} đơn</div>
                    </div>

                    <div class="p-3 rounded-xl bg-slate-900/80 border border-white/10 min-w-0">
                        <div class="flex items-center gap-1.5 text-xs text-slate-400 mb-1 whitespace-nowrap">
                            <i class="fas fa-qrcode text-sky-400"></i>
                            <span>VietQR / CK</span>
                        </div>
                        <div class="font-mono font-bold text-sm sm:text-base text-white whitespace-nowrap">${this.formatMoney(d.banking_revenue)} đ</div>
                        <div class="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">${d.banking_orders} đơn</div>
                    </div>

                    <div class="p-3 rounded-xl bg-slate-900/80 border border-white/10 min-w-0">
                        <div class="flex items-center gap-1.5 text-xs text-slate-400 mb-1 whitespace-nowrap">
                            <i class="fas fa-calculator text-amber-400"></i>
                            <span>Trung Bình / Đơn</span>
                        </div>
                        <div class="font-mono font-bold text-sm sm:text-base text-white whitespace-nowrap">${this.formatMoney(d.avg_order_value)} đ</div>
                        <div class="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">Giảm giá: ${this.formatMoney(d.total_discount)} đ</div>
                    </div>
                </div>

                <!-- Top 5 Best Sellers -->
                <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                    <div class="font-bold text-xs text-slate-300 mb-2 flex items-center gap-1.5">
                        <i class="fas fa-fire text-amber-400"></i>
                        <span>Top món bán chạy nhất (${preset === 'today' ? 'Hôm nay' : 'Kỳ báo cáo'})</span>
                    </div>
                    <div class="space-y-1">
                        ${topItemsHtml}
                    </div>
                </div>

                <div class="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                    <span>Nhân viên kết ca: <b class="text-slate-200">${d.user_name || this.currentUser?.fullname || 'Thu ngân'}</b> (${d.user_role || this.currentUser?.role || 'POS'})</span>
                    <span>Tạo lúc: ${d.generated_at || new Date().toLocaleString('vi-VN')}</span>
                </div>
            `;
        } catch (e) {
            console.error('Error loading revenue stats:', e);
            contentEl.innerHTML = `<div class="p-8 text-center text-rose-400">Lỗi kết nối khi tải số liệu</div>`;
        }
    },

    printShiftReport() {
        const d = this.currentShiftReportData;
        if (!d) {
            alert('Chưa có số liệu báo cáo để in!');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=380,height=600');
        if (!printWindow) {
            alert('Vui lòng cho phép popup trình duyệt để in phiếu báo cáo ca!');
            return;
        }

        let topItemsRows = '';
        if (Array.isArray(d.top_products)) {
            topItemsRows = d.top_products.map((p, i) => `
                <tr>
                    <td style="padding: 2px 0;">${i+1}. ${p.product_name}</td>
                    <td style="text-align: right; padding: 2px 0;">${p.qty} ${p.unit || ''}</td>
                    <td style="text-align: right; padding: 2px 0;">${this.formatMoney(p.revenue)}</td>
                </tr>
            `).join('');
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>BÁO CÁO DOANH THU CA</title>
                <style>
                    body { font-family: monospace, sans-serif; font-size: 12px; margin: 0; padding: 10px; width: 80mm; box-sizing: border-box; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    .total-box { font-size: 14px; margin: 8px 0; padding: 6px; border: 1px solid #000; text-align: center; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="center bold" style="font-size: 14px;">GÓC PHỐ COFFEE & TEA</div>
                <div class="center bold border-bottom">BÁO CÁO DOANH THU BÀN GIAO CA</div>
                <div style="font-size: 11px;">
                    <div>Ngày: ${d.date_from} ${d.date_from !== d.date_to ? 'đến ' + d.date_to : ''}</div>
                    <div>Thu ngân: ${d.user_name} (${d.user_role})</div>
                    <div>Thời gian in: ${d.generated_at}</div>
                </div>
                <div class="total-box">
                    TỔNG THU: ${this.formatMoney(d.total_revenue)} VNĐ
                </div>
                <div class="border-bottom" style="font-size: 11px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Tiền mặt (${d.cash_orders} đơn):</span>
                        <span class="bold">${this.formatMoney(d.cash_revenue)} đ</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>VietQR / CK (${d.banking_orders} đơn):</span>
                        <span class="bold">${this.formatMoney(d.banking_revenue)} đ</span>
                    </div>
                    ${d.card_revenue > 0 ? `
                    <div style="display: flex; justify-content: space-between;">
                        <span>Thẻ (${d.card_orders} đơn):</span>
                        <span class="bold">${this.formatMoney(d.card_revenue)} đ</span>
                    </div>` : ''}
                    <div style="display: flex; justify-content: space-between;">
                        <span>Tổng số hóa đơn:</span>
                        <span class="bold">${d.total_orders} HĐ</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Giảm giá:</span>
                        <span>${this.formatMoney(d.total_discount)} đ</span>
                    </div>
                </div>
                ${topItemsRows ? `
                <div style="font-weight: bold; margin: 4px 0 2px 0;">TOP MÓN BÁN CHẠY:</div>
                <table>
                    <thead>
                        <tr style="border-bottom: 1px solid #ccc;">
                            <th style="text-align: left;">Món</th>
                            <th style="text-align: right;">SL</th>
                            <th style="text-align: right;">Tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topItemsRows}
                    </tbody>
                </table>
                <div class="border-bottom" style="margin-top: 6px;"></div>
                ` : ''}
                <div class="center" style="margin-top: 15px;">
                    <div>Người lập phiếu</div>
                    <div style="margin-top: 35px;">(Ký & ghi rõ họ tên)</div>
                </div>
                <script>
                    window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    showToast(message, type = 'info') {
        let toast = document.getElementById('pos-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'pos-toast';
            document.body.appendChild(toast);
        }
        const colors = type === 'success' 
            ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
            : (type === 'error' ? 'bg-rose-600 text-white shadow-rose-500/20' : 'bg-slate-800 text-sky-300 border border-sky-500/30');
        toast.className = `fixed bottom-5 right-5 z-[9999] px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl transition-all duration-300 flex items-center gap-2 ${colors}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle')}"></i> <span>${message}</span>`;
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.style.transform = 'translateY(10px)';
            toast.style.opacity = '0';
        }, 3000);
    },

    // Audio chime for POS notifications
    playNotificationChime() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.45);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.15);
            gain2.gain.setValueAtTime(0.3, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.15);
            osc2.stop(now + 0.7);
        } catch(e) {}
    },

    // Check cancellation & kitchen notifications periodically
    startNotificationPolling() {
        const check = async () => {
            try {
                // Real-time table updates: so Cashier immediately sees orders created by Waiter
                await this.loadTables();

                const res = await fetch('api/orders.php?action=check_notifications&role=cashier');
                const data = await res.json();
                if (data.success && data.cancellations && data.cancellations.length > 0) {
                    const latest = data.cancellations[0];
                    const alertEl = document.getElementById('pos-kitchen-cancel-alert');
                    const msgEl = document.getElementById('pos-kitchen-cancel-msg');
                    if (alertEl && msgEl) {
                        alertEl.classList.remove('hidden');
                        msgEl.innerText = latest.message;
                        window.currentPosCancelNotifId = latest.id;

                        if (window.lastPosCancelNotifId !== latest.id) {
                            this.playNotificationChime();
                            window.lastPosCancelNotifId = latest.id;

                            // Always reload products to refresh locked/unlocked dishes
                            await this.loadProducts();

                            // Refresh tables
                            await this.loadTables();

                            // If this table is currently open in POS, reload it to reflect item deletion
                            if (this.currentTable && (this.currentTable.code === latest.table_code || this.activeOrderId == latest.order_id)) {
                                if (this.activeOrderId) {
                                    await this.loadOrder(this.activeOrderId);
                                }
                            }
                        }
                    }
                } else {
                    const alertEl = document.getElementById('pos-kitchen-cancel-alert');
                    if (alertEl) alertEl.classList.add('hidden');
                }
            } catch(e) {}
        };

        setInterval(check, 3500);
    },

    async ackCancelAlert() {
        const alertEl = document.getElementById('pos-kitchen-cancel-alert');
        if (alertEl) alertEl.classList.add('hidden');
        const notifId = window.currentPosCancelNotifId;
        window.currentPosCancelNotifId = null;
        if (notifId) {
            try {
                await fetch('api/orders.php?action=ack_notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        notification_id: notifId,
                        role: 'cashier'
                    })
                });
            } catch(e) {}
        }
    },

    bindEvents() {
        // Search product typing
        const searchInput = document.getElementById('search-product');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.renderProducts();
            });
        }

        // Customer name change
        const custInput = document.getElementById('cart-customer-name');
        if (custInput) {
            custInput.addEventListener('change', (e) => {
                this.customerName = e.target.value.trim() || 'Khách vãng lai';
                this.saveOrderDebounced();
            });
        }

        // Guest count change
        const guestInput = document.getElementById('cart-guest-count');
        if (guestInput) {
            guestInput.addEventListener('change', (e) => {
                this.guestCount = Math.max(1, parseInt(e.target.value) || 1);
                this.saveOrderDebounced();
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    POS.init();
});

