/**
 * POS Liquid Glass Front-end Engine
 */

const POS = {
    // State
    currentTable: { id: 1, code: 'MV1', area_type: 'MANG_VE', name: (window.cnxT?window.cnxT('js.s_pos.e442bf55','Mang Về 01'):'Mang Về 01') },
    activeOrderId: null,
    cart: [],
    categories: [],
    products: [],
    toppings: [],
    tables: [],
    selectedCategoryId: 'all',
    discount: { type: 'amount', value: 0 },
    vatPercent: 0,
    customerName: (window.cnxT?window.cnxT('js.s_pos.53fa7723','Khách vãng lai'):'Khách vãng lai'),
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
                <span>${window.cnxT?window.cnxT('js.s_pos.8b863b9d','TẤT CẢ'):'TẤT CẢ'}</span>
            </button>
        `;

        this.categories.forEach(cat => {
            const isActive = this.selectedCategoryId == cat.id ? 'active' : '';
            const catName = typeof window.cnxDbText === 'function' ? window.cnxDbText(cat, 'name', cat.name) : cat.name;
            html += `
                <button type="button" class="category-pill shrink-0 ${isActive}" onclick="POS.filterCategory(${Number(cat.id)})">
                    <i class="fas fa-${escapeHtml(cat.icon || 'utensils')} text-amber-400"></i>
                    <span>${escapeHtml(catName)}</span>
                    <span class="text-[10px] sm:text-xs bg-slate-800/80 px-1.5 py-0.2 rounded-full ml-auto text-slate-400">${Number(cat.product_count || 0)}</span>
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
                    <p class="text-base font-semibold">${window.cnxT?window.cnxT('js.s_pos.a0fd31d5','Không tìm thấy món ăn phù hợp'):'Không tìm thấy món ăn phù hợp'}</p>
                    <p class="text-xs text-slate-500 mt-1">${window.cnxT?window.cnxT('js.s_pos.64b35912','Vui lòng chọn danh mục khác hoặc xóa từ khóa tìm kiếm'):'Vui lòng chọn danh mục khác hoặc xóa từ khóa tìm kiếm'}</p>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(p => {
            const isTopping = p.is_topping == 1;
            const isLocked = (p.status === 'locked');
            const imgUrl = CyberSecurity.safeUrl(p.image || 'assets/images/dishes/default_dish.jpg');
            const dishDisplayName = typeof window.cnxDbText === 'function' ? window.cnxDbText(p, 'name', p.name) : p.name;
            const dishDisplayUnit = typeof window.cnxDbText === 'function' ? window.cnxDbText(p, 'unit', p.unit || 'ly') : (p.unit || 'ly');
            const safeDishHtml = escapeHtml(dishDisplayName);
            html += `
                <div class="liquid-glass-card p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-200 select-none ${isLocked ? 'opacity-50 grayscale border-rose-500/40 bg-rose-950/20 cursor-not-allowed' : 'cursor-pointer border border-white/10 hover:border-sky-400/50 hover:shadow-xl hover:shadow-sky-500/10 group'}" onclick="${isLocked ? `alert('Món [${escapeJsAttr(dishDisplayName)}] hiện đang TẠM KHÓA (Hết hàng) bởi bếp!')` : `POS.addToCart(${Number(p.id)})`}">
                    <div>
                        <!-- Dish Image: 4:3 Aspect Ratio for Full, Un-cropped View -->
                        <div class="relative w-full aspect-[4/3] mb-2 rounded-xl overflow-hidden bg-slate-950/80 border border-white/10 group-hover:border-sky-400/40 transition-all shadow-inner flex items-center justify-center">
                            <img src="${escapeHtml(imgUrl)}" alt="${safeDishHtml}" class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" onerror="this.onerror=null;this.src='assets/images/dishes/default_dish.jpg';" loading="lazy" />
                            
                            <!-- Badges Overlay (Non-obstructive) -->
                            <div class="absolute top-2 left-2 pointer-events-none">
                                <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-md text-sky-400 border border-sky-500/30 shadow">${escapeHtml(p.code || 'SP')}</span>
                            </div>
                            <div class="absolute top-2 right-2 pointer-events-none">
                                ${isLocked 
                                    ? '<span class="text-[9px] font-black text-rose-300 bg-rose-950/90 px-2 py-0.5 rounded-md border border-rose-500/50 shadow">🚫 HẾT HÀNG</span>' 
                                    : `<span class="text-[10px] font-semibold text-slate-200 bg-slate-950/85 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10 capitalize shadow">${escapeHtml(dishDisplayUnit)}</span>`}
                            </div>
                            ${isTopping ? '<span class="absolute bottom-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/90 text-slate-950 shadow">Topping</span>' : ''}
                        </div>

                        <!-- Product Name -->
                        <h4 class="font-bold text-xs sm:text-sm ${isLocked ? 'text-slate-400 line-through' : 'text-slate-100 group-hover:text-sky-300'} leading-snug line-clamp-2 min-h-[2.2rem]" title="${safeDishHtml}">${safeDishHtml}</h4>
                    </div>

                    <!-- Price & Add Button -->
                    <div class="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                        <span class="text-xs sm:text-sm font-black text-amber-400 tracking-tight font-mono">${this.formatMoney(p.sale_price)} <span class="text-[10px] font-normal text-slate-400">${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}</span></span>
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
                this.loadPosAlerts();

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
            const kStatus = (tbl.kitchen_status || '').toLowerCase();
            const isReady = kStatus === 'ready';
            const isServed = kStatus === 'served' || Boolean(tbl.served_at);
            const isInKitchen = isOccupied && !isReady && !isServed && !['awaiting_waiter', 'awaiting_payment', 'awaiting_kitchen_push', 'cancel_requested'].includes(kStatus);
            const elapsedMins = Number(tbl.kitchen_elapsed_minutes || 0);
            const kitchenSla = Number(tbl.kitchen_sla_minutes || 10);
            const isOverdueKitchen = isInKitchen && elapsedMins >= kitchenSla;
            const rushCount = Number(tbl.rush_count || 0);
            const orderId = Number(tbl.active_order_id || tbl.order_id || 0);

            let kitchenBadge = '';
            if (isOccupied) {
                if (isPaid) {
                    kitchenBadge = (window.cnxT?window.cnxT('js.s_pos.fb0337e7','<span class="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/30 text-teal-300 font-bold ml-1 border border-teal-500/40">💰 Đã TT</span>'):'<span class="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/30 text-teal-300 font-bold ml-1 border border-teal-500/40">💰 Đã TT</span>');
                }
                if (isReady) {
                    kitchenBadge += (window.cnxT?window.cnxT('js.s_pos.72ba4642','<span class="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black animate-pulse ml-1">Bếp xong</span>'):'<span class="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black animate-pulse ml-1">Bếp xong</span>');
                } else if (isServed) {
                    kitchenBadge += (window.cnxT?window.cnxT('js.s_pos.7158d332','<span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-bold ml-1">Đã bưng</span>'):'<span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-bold ml-1">Đã bưng</span>');
                }
            }

            const amountText = tbl.total_amount ? (this.formatMoney(tbl.total_amount) + (window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ')) : '';
            const countText = tbl.item_count ? ` (${tbl.item_count} ${window.cnxT?window.cnxT('js.s_cust.6ab5ce4d','món)'):'món)'}` : '';

            let subtitle = (window.cnxT?window.cnxT('ui.ord_html.span_52f415fe','Bàn trống'):'Bàn trống');
            if (isOccupied) {
                if (tbl.kitchen_status === 'cancel_requested') {
                    subtitle = `${window.cnxT?window.cnxT('js.s_pos.af10a31a','⚠️ Bếp xin hủy đơn'):'⚠️ Bếp xin hủy đơn'}`;
                } else if (tbl.settlement_status === 'refund_due') {
                    subtitle = `${window.cnxT?window.cnxT('js.s_pos.2cf7f25d','💸 Cần hoàn tiền'):'💸 Cần hoàn tiền'}`;
                } else if (tbl.settlement_status === 'extra_due') {
                    subtitle = `${window.cnxT?window.cnxT('js.s_pos.66c04dc6','💰 Cần thu thêm'):'💰 Cần thu thêm'}`;
                } else if (tbl.kitchen_status === 'awaiting_payment') {
                    subtitle = tbl.payment_status === 'verifying' ? `${window.cnxT?window.cnxT('js.s_pos.b0e89790','🔎 Chờ đối soát CK'):'🔎 Chờ đối soát CK'}` : `${window.cnxT?window.cnxT('js.s_pos.919cd275','⏳ Chờ TT QR'):'⏳ Chờ TT QR'}`;
                } else if (tbl.kitchen_status === 'awaiting_waiter') {
                    subtitle = `${window.cnxT?window.cnxT('js.s_pos.5986a685','🪑 Khách QR chờ duyệt'):'🪑 Khách QR chờ duyệt'}`;
                } else if (isPaid) {
                    if (isReady) {
                        subtitle = `${amountText} ${window.cnxT?window.cnxT('js.s_pos.629f25c4','• Chờ bưng'):'• Chờ bưng'}`;
                    } else if (isServed) {
                        subtitle = `${amountText} ${window.cnxT?window.cnxT('js.s_pos.f363b545','• Đã bưng'):'• Đã bưng'}`;
                    } else {
                        subtitle = `${amountText} ${window.cnxT?window.cnxT('js.s_pos.a4788ce2','• Đang nấu'):'• Đang nấu'}`;
                    }
                } else {
                    subtitle = `${amountText}${countText}`;
                }
                if (Number(tbl.pending_cancel_count || 0) > 0) {
                    subtitle += (window.cnxT?window.cnxT('js.s_pos.3f3b4b5b',' • Chờ hủy món'):' • Chờ hủy món');
                }
            }

            const statusDotHtml = isOccupied
                ? (isInKitchen
                    ? `<span class="relative flex h-2.5 w-2.5 shrink-0" title="Bếp đang chế biến (${elapsedMins} phút)"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-85"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span></span>`
                    : `<span class="w-2 h-2 rounded-full ${isPaid ? 'bg-teal-400' : 'bg-rose-500 animate-ping'}"></span>`)
                : '<span class="w-2 h-2 rounded-full bg-emerald-400"></span>';

            const rushBtnHtml = (isOverdueKitchen && orderId > 0)
                ? `<button type="button" onclick="event.stopPropagation(); POS.rushKitchenOrder(${orderId}, '${escapeJsAttr(tbl.code)}', this)" class="px-1.5 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-white font-black text-[10px] shadow shadow-rose-500/40 active:scale-90 flex items-center gap-1 shrink-0 animate-pulse" title="Quá ${elapsedMins} phút chưa xong món - Bấm để hối Bếp"><i class="fas fa-fire"></i> ${rushCount > 0 ? `${window.cnxT?window.cnxT('js.s_ord.77c8da63','Hối ('):'Hối ('}${rushCount})` : (window.cnxT?window.cnxT('js.s_ord.ad20afa8','Hối'):'Hối')}</button>`
                : '';

            const cardHtml = `
                <div class="table-card ${statusClass} ${isActive}" onclick="POS.selectTable(${Number(tbl.id)})">
                    <div class="flex items-center justify-between gap-1">
                        <div class="flex items-center flex-wrap gap-0.5">
                            <span class="font-extrabold text-xs md:text-sm tracking-wide text-white">${escapeHtml(tbl.code)}</span>
                            ${kitchenBadge}
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            ${rushBtnHtml}
                            ${statusDotHtml}
                        </div>
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
            summaryText.innerText = `${occupiedList.length} ${window.cnxT?window.cnxT('js.s_pos.71584163','bàn có khách •'):'bàn có khách •'} ${unpaidList.length} ${window.cnxT?window.cnxT('js.s_pos.18ec66b7','chờ TT'):'chờ TT'}`;
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
                    <p class="text-xs font-semibold">${window.cnxT?window.cnxT('js.s_pos.7c95e564','Không tìm thấy bàn / hóa đơn phù hợp'):'Không tìm thấy bàn / hóa đơn phù hợp'}</p>
                </div>
            `;
            return;
        }

        let html = '';
        list.forEach(tbl => {
            const isOccupied = tbl.status === 'occupied' || Boolean(tbl.active_order_id || tbl.order_id);
            const isPaid = (tbl.payment_status === 'paid' || Boolean(tbl.paid_at));
            const kStatus = (tbl.kitchen_status || '').toLowerCase();
            const isReady = kStatus === 'ready';
            const isServed = kStatus === 'served' || Boolean(tbl.served_at);
            const isInKitchen = isOccupied && !isReady && !isServed && !['awaiting_waiter', 'awaiting_payment', 'awaiting_kitchen_push', 'cancel_requested'].includes(kStatus);
            const elapsedMins = Number(tbl.kitchen_elapsed_minutes || 0);
            const kitchenSla = Number(tbl.kitchen_sla_minutes || 10);
            const isOverdueKitchen = isInKitchen && elapsedMins >= kitchenSla;
            const rushCount = Number(tbl.rush_count || 0);
            const orderId = Number(tbl.active_order_id || tbl.order_id || 0);
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
                                <span class="text-sm font-black text-white px-2.5 py-0.5 rounded-lg bg-slate-800 border border-white/15">${escapeHtml(tbl.code)}</span>
                                <span class="text-xs font-semibold text-slate-300 truncate max-w-[110px]">${escapeHtml(tbl.name)}</span>
                                ${isPaid ? `
                                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-bold border border-teal-500/40 whitespace-nowrap shrink-0">${window.cnxT?window.cnxT('js.s_pos.e4b5ca98','💰 Đã TT'):'💰 Đã TT'}</span>
                                ` : `
                                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 animate-pulse whitespace-nowrap shrink-0">${window.cnxT?window.cnxT('js.s_pos.0a7dea40','🔥 Chờ TT'):'🔥 Chờ TT'}</span>
                                `}
                                ${isReady ? `
                                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black animate-pulse shadow-sm whitespace-nowrap shrink-0">${window.cnxT?window.cnxT('js.s_pos.3d9462f2','⚡ Bếp Xong'):'⚡ Bếp Xong'}</span>
                                ` : (isServed ? `
                                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 whitespace-nowrap shrink-0">${window.cnxT?window.cnxT('ui.admin_html.th_ca449b27','Đã bưng'):'Đã bưng'}</span>
                                ` : `
                                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5">
                                        <span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-85"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span></span>
                                        Đang làm${elapsedMins > 0 ? ` (${elapsedMins}p)` : ''}
                                    </span>
                                `)}
                                ${isOverdueKitchen && orderId > 0 ? `
                                    <button type="button" onclick="event.stopPropagation(); POS.rushKitchenOrder(${orderId}, '${escapeJsAttr(tbl.code)}', this)" class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-black shadow shadow-rose-500/40 animate-pulse whitespace-nowrap shrink-0 flex items-center gap-1 active:scale-90">
                                        <i class="fas fa-fire"></i> ${rushCount > 0 ? `${window.cnxT?window.cnxT('js.s_ord.77c8da63','Hối ('):'Hối ('}${rushCount})` : (window.cnxT?window.cnxT('js.s_ord.ad20afa8','Hối'):'Hối')}
                                    </button>
                                ` : ''}
                            </div>
                            <div class="text-right">
                                <span class="font-mono font-black text-base md:text-lg ${isPaid ? 'text-teal-400' : 'text-amber-300'}">${this.formatMoney(tbl.total_amount)}đ</span>
                            </div>
                        </div>

                        <div class="flex items-center justify-between text-xs text-slate-400 bg-slate-950/40 px-2.5 py-1.5 rounded-xl border border-white/5">
                            <div class="truncate">
                                <span class="font-mono text-sky-400 font-semibold">${escapeHtml(tbl.order_code || (window.cnxT?window.cnxT('js.s_pos.cf0821e0','Chưa có mã'):'Chưa có mã'))}</span>
                                ${tbl.customer_name ? ` • <span class="text-slate-300 font-medium">${escapeHtml(tbl.customer_name)}</span>` : ''}
                            </div>
                            <span class="font-bold text-slate-300 shrink-0 ml-2">${tbl.item_count || 0} món</span>
                        </div>

                        <div class="grid grid-cols-2 gap-2 pt-0.5">
                            <button type="button" onclick="POS.selectAndOpenCart(${tbl.id})" class="py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 ${isPaid ? 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40' : 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-700/30'} active:scale-95 transition-all">
                                <i class="fas ${isPaid ? 'fa-receipt' : 'fa-hand-holding-dollar'}"></i>
                                <span>${isPaid ? 'Xem Hóa Đơn' : (window.cnxT?window.cnxT('js.s_pos.05a0ecfa','Thanh Toán (F9)'):'Thanh Toán (F9)')}</span>
                            </button>
                            <button type="button" onclick="POS.selectAndOpenMenu(${tbl.id})" class="py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 active:scale-95 transition-all">
                                <i class="fas fa-plus"></i>
                                <span>${window.cnxT?window.cnxT('ui.pos_html.button_45673e12','Thêm Món'):'Thêm Món'}</span>
                            </button>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="p-2.5 rounded-xl bg-slate-900/40 border border-white/5 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-slate-300 px-2 py-0.5 rounded bg-slate-800 border border-white/10">${escapeHtml(tbl.code)}</span>
                            <span class="text-xs text-slate-400">${escapeHtml(tbl.name)}</span>
                            <span class="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-semibold">${window.cnxT?window.cnxT('ui.ord_html.span_52f415fe','Bàn trống'):'Bàn trống'}</span>
                        </div>
                        <button type="button" onclick="POS.selectAndOpenMenu(${tbl.id})" class="py-1 px-3 rounded-lg text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 active:scale-95">
                            ${window.cnxT?window.cnxT('js.s_pos.d4450804','+ Tạo Đơn'):'+ Tạo Đơn'}
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

    async rushKitchenOrder(orderId, tableCode, btnEl) {
        if (!orderId) return;
        const origHtml = btnEl ? btnEl.innerHTML : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        try {
            const res = await fetch('api/orders.php?action=rush_kitchen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || (window.cnxT?window.cnxT('js.s_ord.1c2309c0','Không thể gửi lệnh hối xuống Bếp'):'Không thể gửi lệnh hối xuống Bếp'));
            }
            if (typeof this.showToast === 'function') {
                this.showToast(`${window.cnxT?window.cnxT('js.s_pos.7029468d','🔥 Đã hối Bếp bàn'):'🔥 Đã hối Bếp bàn'} ${tableCode} ${window.cnxT?window.cnxT('js.s_pos.a10da08f','(lần'):'(lần'} ${data.rush_count || 1})!`, 'success');
            }
            await this.loadTables();
        } catch (err) {
            alert(err.message || (window.cnxT?window.cnxT('js.s_ord.611f5e2c','Lỗi gửi lệnh hối xuống Bếp'):'Lỗi gửi lệnh hối xuống Bếp'));
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = origHtml;
            }
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
            this.customerName = (window.cnxT?window.cnxT('js.s_pos.53fa7723','Khách vãng lai'):'Khách vãng lai');
            this.guestCount = 1;
            this.note = '';
            const codeDisplay = document.getElementById('order-code-display');
            if (codeDisplay) codeDisplay.innerText = (window.cnxT?window.cnxT('ui.pos_html.b_ff1b681e','Đang tạo...'):'Đang tạo...');
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
                this.customerName = data.order.customer_name || (window.cnxT?window.cnxT('js.s_pos.53fa7723','Khách vãng lai'):'Khách vãng lai');
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
            alert((window.cnxT?window.cnxT('js.s_pos.9e12976a','Hóa đơn bàn này đã thanh toán xong! Không thể thêm món mới vào đơn đã thanh toán.'):'Hóa đơn bàn này đã thanh toán xong! Không thể thêm món mới vào đơn đã thanh toán.'));
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
            alert((window.cnxT?window.cnxT('js.s_pos.97c74897','Hóa đơn đã thanh toán, không thể thay đổi số lượng!'):'Hóa đơn đã thanh toán, không thể thay đổi số lượng!'));
            return;
        }

        // Thu ngân không được giảm số lượng về 0 (xóa món)
        if (this.isCashierRole() && delta < 0 && this.cart[index].quantity <= 1) {
            alert((window.cnxT?window.cnxT('js.s_pos.9f958769','Thu ngân không có quyền xóa món khỏi hóa đơn! (Số lượng tối thiểu là 1)'):'Thu ngân không có quyền xóa món khỏi hóa đơn! (Số lượng tối thiểu là 1)'));
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
            alert((window.cnxT?window.cnxT('js.s_pos.b4eace33','Hóa đơn đã thanh toán, không thể xóa món!'):'Hóa đơn đã thanh toán, không thể xóa món!'));
            return;
        }

        // Thu ngân không có quyền xóa món
        if (this.isCashierRole()) {
            alert((window.cnxT?window.cnxT('js.s_pos.4c9e51cb','Thu ngân không có quyền xóa món khỏi hóa đơn!'):'Thu ngân không có quyền xóa món khỏi hóa đơn!'));
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

    async editItemNote(index) {
        const item = this.cart[index];
        if (!item) return;
        const newNote = await window.cnxPrompt(`Nhập ghi chú cho "${item.name}":`, item.note || '');
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
            alert((window.cnxT?window.cnxT('js.s_pos.bb8e01f9','Hóa đơn đã thanh toán, không thể thêm topping!'):'Hóa đơn đã thanh toán, không thể thêm topping!'));
            return;
        }

        // Thu ngân không có quyền thêm topping
        if (this.isCashierRole()) {
            alert((window.cnxT?window.cnxT('js.s_pos.dd5dc627','Thu ngân không có quyền thêm topping cho món!'):'Thu ngân không có quyền thêm topping cho món!'));
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
                    ${toppingListHtml || (window.cnxT?window.cnxT('js.s_pos.346187a6','<p class="text-slate-400 text-sm">Chưa có topping nào trong danh mục</p>'):'<p class="text-slate-400 text-sm">Chưa có topping nào trong danh mục</p>')}
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('topping-modal').classList.remove('open')">${window.cnxT?window.cnxT('ui.pos_html.button_cee55387','Đóng'):'Đóng'}</button>
                    <button type="button" class="btn-glass-primary text-xs py-2 px-4 font-bold" onclick="POS.applyToppings(${index})">${window.cnxT?window.cnxT('js.s_pos.e25e9794','Áp dụng'):'Áp dụng'}</button>
                </div>
            </div>
        `;

        modal.classList.add('open');
    },

    applyToppings(index) {
        if (this.isCashierRole()) {
            alert((window.cnxT?window.cnxT('js.s_pos.dd5dc627','Thu ngân không có quyền thêm topping cho món!'):'Thu ngân không có quyền thêm topping cho món!'));
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
                    <p class="text-sm font-semibold">${window.cnxT?window.cnxT('js.s_pos.ef7b0abf','Chưa có món ăn nào'):'Chưa có món ăn nào'}</p>
                    <p class="text-xs text-slate-600 mt-1">${window.cnxT?window.cnxT('js.s_pos.838419b2','Chạm vào món bên phải để thêm vào hóa đơn'):'Chạm vào món bên phải để thêm vào hóa đơn'}</p>
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

        if (this.currentTable && this.currentTable.order_id) {
            const tbl = this.currentTable;
            const ks = tbl.kitchen_status || 'pending';
            const ps = tbl.payment_status || 'unpaid';
            const ss = tbl.settlement_status || 'settled';
            const oType = tbl.order_type || 'pos';
            const paidAmt = Number(tbl.paid_amount || 0);
            const totAmt = Number(tbl.total_amount || 0);

            if (ks === 'awaiting_payment' || ks === 'awaiting_waiter' || ks === 'awaiting_kitchen_push') {
                const canPush = (oType === 'dine_in' || ps === 'paid' || ps === 'cod_approved');
                html += `
                    <div class="mb-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 space-y-2 text-xs">
                        <div class="font-bold text-amber-300 flex items-center justify-between">
                            <span><i class="fas fa-shield-halved mr-1"></i> ${ks === 'awaiting_waiter' ? 'Đơn QR Tại Bàn chờ duyệt' : (ps === 'verifying' ? 'Khách báo đã CK - Chờ đối soát' : (ps === 'paid' ? 'Đã TT QR - Sẵn sàng Chuyển Bếp' : (window.cnxT?window.cnxT('js.s_pos.eb06b9fe','Đơn QR chờ xác nhận thanh toán'):'Đơn QR chờ xác nhận thanh toán')))}</span>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            ${ps !== 'paid' ? `<button type="button" onclick="POS.confirmOrderPayment(${tbl.order_id}, 'paid')" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"><i class="fas fa-check mr-1"></i>${window.cnxT?window.cnxT('js.s_pos.3423e79a','Xác nhận Đã Nhận Tiền'):'Xác nhận Đã Nhận Tiền'}</button>` : ''}
                            <button type="button" onclick="POS.sendOrderToKitchen(${tbl.order_id})" ${canPush ? '' : 'disabled'} class="px-2.5 py-1.5 rounded-lg ${canPush ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'} font-bold text-[11px]"><i class="fas fa-fire-burner mr-1"></i>${window.cnxT?window.cnxT('js.s_cust.9a34bc5b','Chuyển Bếp'):'Chuyển Bếp'}</button>
                        </div>
                    </div>
                `;
            }
            if (ks === 'cancel_requested') {
                html += `
                    <div class="mb-2 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 space-y-1.5 text-xs">
                        <div class="font-bold text-rose-300"><i class="fas fa-triangle-exclamation mr-1"></i> Bếp yêu cầu HỦY ĐƠN: ${escapeHtml(tbl.cancel_request_reason || '')}</div>
                        <button type="button" onclick="POS.cancelOrder()" class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]">${window.cnxT?window.cnxT('js.s_pos.8f32f02c','Duyệt Hủy Đơn &amp; Giải phóng bàn'):'Duyệt Hủy Đơn &amp; Giải phóng bàn'}</button>
                    </div>
                `;
            }
            if (ss === 'extra_due' || ss === 'refund_due') {
                const diff = Math.abs(totAmt - paidAmt);
                const isRef = (ss === 'refund_due');
                html += `
                    <div class="mb-2 p-2.5 rounded-xl ${isRef ? 'bg-rose-500/20 border-rose-500/40 text-rose-200' : 'bg-amber-500/20 border-amber-500/40 text-amber-200'} border space-y-1.5 text-xs">
                        <div class="font-bold">${isRef ? '💸 Cần HOÀN LẠI khách:' : (window.cnxT?window.cnxT('js.s_pos.5dffbc04','💰 Cần THU THÊM khách:'):'💰 Cần THU THÊM khách:')} <span class="font-mono">${this.formatMoney(diff)} đ</span></div>
                        <div class="text-[11px] opacity-80">Đã thu: ${this.formatMoney(paidAmt)}${window.cnxT?window.cnxT('js.s_pos.f0be0121','đ • Tổng mới:'):'đ • Tổng mới:'} ${this.formatMoney(totAmt)}đ</div>
                        <div class="flex gap-1.5">
                            <button type="button" onclick="POS.settleOrderDelta(${tbl.order_id}, 'cash')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]">${isRef ? 'Đã hoàn Tiền Mặt' : (window.cnxT?window.cnxT('js.s_pos.08472b28','Đã thu Tiền Mặt'):'Đã thu Tiền Mặt')}</button>
                            <button type="button" onclick="POS.settleOrderDelta(${tbl.order_id}, 'banking')" class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px]">${isRef ? 'Đã hoàn CK' : (window.cnxT?window.cnxT('js.s_pos.d4a34955','Đã thu CK'):'Đã thu CK')}</button>
                        </div>
                    </div>
                `;
            }
        }

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
                            <h5 class="text-sm font-bold text-slate-100 truncate">${escapeHtml(item.name)}</h5>
                            <div class="text-xs text-amber-400 font-semibold mt-0.5">
                                ${this.formatMoney(unitPrice)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}
                                ${toppingPrice > 0 ? `<span class="text-[10px] text-sky-400 font-normal"> ${window.cnxT?window.cnxT('js.s_pos.8b412bee','(Gồm topping)'):'(Gồm topping)'}</span>` : ''}
                            </div>
                            ${item.toppings && item.toppings.length > 0 ? `
                                <div class="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-1">
                                    ${item.toppings.map(t => `<span class="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-sky-300">+${escapeHtml(t.name)}</span>`).join('')}
                                </div>
                            ` : ''}
                            ${item.note ? `
                                <div class="text-[11px] text-rose-300/90 italic mt-0.5">
                                    <i class="fas fa-pen-alt text-[9px] mr-1"></i>${escapeHtml(item.note)}
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
                                    ${isCashier && item.quantity <= 1 ? 'title="Thu ngân không thể xóa món (SL tối thiểu 1)"' : (window.cnxT?window.cnxT('js.s_pos.8d572b09','title="Giảm số lượng"'):'title="Giảm số lượng"')}>
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
                                    <span>${window.cnxT?window.cnxT('ui.admin_html.ph_ad504eea','Ghi chú'):'Ghi chú'}</span>
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
            const kText = kStatus === 'ready' ? 'Bếp đã xong • Chờ bưng' : (kStatus === 'served' ? 'Đã bưng ra bàn' : (window.cnxT?window.cnxT('js.s_pos.72477981','Bếp đang chế biến'):'Bếp đang chế biến'));
            cartItemsContainer.innerHTML = `
                <div class="p-2.5 rounded-xl bg-teal-950/70 border border-teal-500/40 text-teal-300 flex items-center justify-between text-xs font-bold mb-2 shadow-md">
                    <div class="flex items-center gap-1.5">
                        <i class="fas fa-check-circle text-teal-400 text-sm"></i>
                        <span>${window.cnxT?window.cnxT('js.s_pos.311076b6','ĐÃ THANH TOÁN'):'ĐÃ THANH TOÁN'}</span>
                    </div>
                    <span class="text-[11px] font-semibold text-teal-200 bg-teal-900/60 px-2 py-0.5 rounded border border-teal-500/30">${kText}</span>
                </div>
            ` + cartItemsContainer.innerHTML;
        }

        const btnCheckout = document.getElementById('btn-pos-checkout');
        if (btnCheckout) {
            if (isPaid) {
                btnCheckout.className = 'col-span-2 py-3 px-2 sm:px-4 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-1.5 sm:gap-2 shadow-xl bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/50 active:scale-95 transition-transform truncate';
                btnCheckout.innerHTML = (window.cnxT?window.cnxT('js.s_pos.c668a4d8','<i class="fas fa-print text-base sm:text-lg"></i> <span>IN LẠI HÓA ĐƠN</span>'):'<i class="fas fa-print text-base sm:text-lg"></i> <span>IN LẠI HÓA ĐƠN</span>');
            } else {
                btnCheckout.className = 'col-span-2 btn-glass-success py-3 px-2 sm:px-4 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-1.5 sm:gap-2 shadow-xl shadow-emerald-600/30 active:scale-95 transition-transform truncate';
                btnCheckout.innerHTML = (window.cnxT?window.cnxT('js.s_pos.e771dfea','<i class="fas fa-hand-holding-dollar text-base sm:text-lg"></i> <span>THANH TOÁN (F9)</span>'):'<i class="fas fa-hand-holding-dollar text-base sm:text-lg"></i> <span>THANH TOÁN (F9)</span>');
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
        this.requestBackendPreviewQuote();
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

    async requestBackendPreviewQuote() {
        if (!this.cart || this.cart.length === 0) return;
        try {
            const res = await fetch('/api/orders?action=preview_quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: this.cart.map(it => ({
                        id: it.id,
                        price: it.price,
                        quantity: it.quantity,
                        toppings: it.toppings || []
                    })),
                    discount_type: this.discount?.type || 'amount',
                    discount_value: this.discount?.value || 0,
                    vat_percent: this.vatPercent || 0,
                    promo_code: this.discount?.promo_code || ''
                })
            });
            const q = await res.json();
            if (q && q.success) {
                this._lastServerQuote = q;
                const subtotalEl = document.getElementById('cart-subtotal');
                const discountEl = document.getElementById('cart-discount');
                const totalEl = document.getElementById('cart-total');
                if (subtotalEl) subtotalEl.innerText = this.formatMoney(q.subtotal);
                if (discountEl) discountEl.innerText = this.formatMoney(q.discount_amount ?? q.total_discount ?? 0);
                if (totalEl) totalEl.innerText = this.formatMoney(q.total_amount);
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('pos.preview_quote', e) : null); }
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
            promo_id: this.discount.promo_id || 0,
            promo_code: this.discount.promo_code || '',
            promo_name: this.discount.promo_name || '',
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
                            <p class="text-[11px] text-slate-400">${window.cnxT?window.cnxT('js.s_pos.6c8ab857','Thao tác này được ghi nhận vào Nhật ký Kiểm toán (Audit)'):'Thao tác này được ghi nhận vào Nhật ký Kiểm toán (Audit)'}</p>
                        </div>
                    </div>
                    <button type="button" class="text-slate-400 hover:text-white text-xl" onclick="document.getElementById('audit-cancel-order-modal').classList.remove('open')">&times;</button>
                </div>

                <div class="mb-3">
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">${window.cnxT?window.cnxT('js.s_pos.07563c69','Chọn nhanh lý do hủy:'):'Chọn nhanh lý do hủy:'}</label>
                    <div class="flex flex-wrap gap-1.5">
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-xs text-slate-300 hover:text-rose-300 border border-white/10" onclick="document.getElementById('cancel-order-reason-input').value='Khách đổi ý không dùng nữa'">${window.cnxT?window.cnxT('ui.order_html.button_b31ed4b8','Khách đổi ý'):'Khách đổi ý'}</button>
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-xs text-slate-300 hover:text-rose-300 border border-white/10" onclick="document.getElementById('cancel-order-reason-input').value='Thu ngân / Phục vụ nhập nhầm bàn'">${window.cnxT?window.cnxT('js.s_pos.4630cc7d','Nhập nhầm bàn'):'Nhập nhầm bàn'}</button>
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-xs text-slate-300 hover:text-rose-300 border border-white/10" onclick="document.getElementById('cancel-order-reason-input').value='Bếp báo hết nguyên liệu đột xuất'">${window.cnxT?window.cnxT('js.s_pos.67f256cf','Hết nguyên liệu'):'Hết nguyên liệu'}</button>
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-xs text-slate-300 hover:text-rose-300 border border-white/10" onclick="document.getElementById('cancel-order-reason-input').value='Khách chờ lâu rời quán'">${window.cnxT?window.cnxT('js.s_pos.2a5ccf35','Khách chờ lâu'):'Khách chờ lâu'}</button>
                    </div>
                </div>

                <div class="mb-4">
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">${window.cnxT?window.cnxT('js.s_pos.c2682add','Chi tiết lý do hủy đơn'):'Chi tiết lý do hủy đơn'} <span class="text-rose-400">*</span>:</label>
                    <input type="text" id="cancel-order-reason-input" placeholder="Nhập lý do hủy hóa đơn..." class="liquid-input w-full text-xs py-2 px-3" />
                </div>

                <div class="flex justify-end gap-2">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('audit-cancel-order-modal').classList.remove('open')">${window.cnxT?window.cnxT('ui.pos_html.button_cee55387','Đóng'):'Đóng'}</button>
                    <button type="button" class="btn-glass text-xs py-2 px-4 bg-rose-600/80 hover:bg-rose-600 text-white border-rose-500 font-bold" onclick="POS.confirmCancelOrderWithReason()">
                        <i class="fas fa-trash-can mr-1"></i> ${window.cnxT?window.cnxT('js.s_pos.2b92dbde','Xác nhận Hủy & Ghi Audit'):'Xác nhận Hủy & Ghi Audit'}
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
            alert((window.cnxT?window.cnxT('js.s_pos.06bb4427','Bắt buộc nhập lý do hủy hóa đơn để ghi nhận Kiểm toán nội bộ!'):'Bắt buộc nhập lý do hủy hóa đơn để ghi nhận Kiểm toán nội bộ!'));
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
                    alert(data.message || (window.cnxT?window.cnxT('js.s_pos.31c00618','Lỗi khi hủy hóa đơn'):'Lỗi khi hủy hóa đơn'));
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
                        <h3 class="font-bold text-base text-sky-400">${window.cnxT?window.cnxT('js.s_pos.49273e7e','Giảm Giá Hóa Đơn'):'Giảm Giá Hóa Đơn'}</h3>
                        <p class="text-[11px] text-slate-400">${window.cnxT?window.cnxT('js.s_pos.f3fbb053','Ghi nhận tự động vào Nhật ký Kiểm toán'):'Ghi nhận tự động vào Nhật ký Kiểm toán'}</p>
                    </div>
                    <button type="button" class="text-slate-400 hover:text-white text-xl" onclick="document.getElementById('discount-modal').classList.remove('open')">&times;</button>
                </div>
                <div class="mb-3 p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2">
                    <label class="block text-[11px] font-bold text-amber-300"><i class="fas fa-ticket mr-1"></i> ${window.cnxT?window.cnxT('js.s_pos.36e97e33','Áp dụng Mã Voucher / Chương trình KM:'):'Áp dụng Mã Voucher / Chương trình KM:'}</label>
                    <div class="flex gap-1.5">
                        <input type="text" id="discount-promo-code" value="${this.discount.promo_code || ''}" placeholder="Nhập mã (VD: KHAITRUONG)..." class="liquid-input flex-1 text-xs font-mono uppercase py-1.5 px-2.5" />
                        <button type="button" onclick="POS.applyPromoCodeInModal()" class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold">${window.cnxT?window.cnxT('js.s_pos.33a0b559','Áp mã'):'Áp mã'}</button>
                    </div>
                    <div id="pos-active-promos-chips" class="flex flex-wrap gap-1 text-[10px]"></div>
                </div>
                <div class="mb-3">
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">${window.cnxT?window.cnxT('js.s_pos.b5805c22','Loại giảm giá:'):'Loại giảm giá:'}</label>
                    <div class="grid grid-cols-2 gap-2">
                        <button type="button" id="discount-type-amount" class="btn-glass ${this.discount.type === 'amount' ? 'btn-glass-primary' : ''} text-xs py-2" onclick="POS.setDiscountType('amount')">${window.cnxT?window.cnxT('ui.admin_html.option_89dfad29','Số tiền (VNĐ)'):'Số tiền (VNĐ)'}</button>
                        <button type="button" id="discount-type-percent" class="btn-glass ${this.discount.type === 'percent' ? 'btn-glass-primary' : ''} text-xs py-2" onclick="POS.setDiscountType('percent')">${window.cnxT?window.cnxT('ui.admin_html.option_ee40be38','Phần trăm (%)'):'Phần trăm (%)'}</button>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">${window.cnxT?window.cnxT('js.s_pos.c02f6e79','Giá trị giảm:'):'Giá trị giảm:'}</label>
                    <div class="relative">
                        <input type="number" id="discount-val-input" value="${this.discount.value}" class="liquid-input w-full font-mono text-lg font-bold pr-10" />
                        <button type="button" class="absolute right-2 top-2 text-slate-400 hover:text-sky-400" onclick="VirtualNumpad.open(document.getElementById('discount-val-input'), 'Nhập giá trị giảm giá')">
                            <i class="fas fa-keyboard"></i>
                        </button>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">${window.cnxT?window.cnxT('js.s_pos.1079d16d','Lý do giảm giá / Chương trình KM'):'Lý do giảm giá / Chương trình KM'} <span class="text-amber-400">*</span>:</label>
                    <div class="flex flex-wrap gap-1 mb-1.5">
                        <button type="button" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-500/20 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('discount-reason-input').value='Khách VIP / Thân thiết'">${window.cnxT?window.cnxT('js.s_pos.e0588e75','Khách VIP'):'Khách VIP'}</button>
                        <button type="button" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-500/20 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('discount-reason-input').value='Voucher / Khuyến mãi quán'">Voucher KM</button>
                        <button type="button" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-500/20 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('discount-reason-input').value='Ưu đãi đền bù phục vụ trễ'">${window.cnxT?window.cnxT('js.s_pos.58e038cc','Đền bù món trễ'):'Đền bù món trễ'}</button>
                    </div>
                    <input type="text" id="discount-reason-input" value="${this.discount.reason || ''}" placeholder="Nhập lý do giảm giá..." class="liquid-input w-full text-xs py-2 px-3" />
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('discount-modal').classList.remove('open')">${window.cnxT?window.cnxT('ui.admin_html.button_d7d5c86c','Hủy'):'Hủy'}</button>
                    <button type="button" class="btn-glass-success text-xs py-2 px-4 font-bold" onclick="POS.applyDiscount()">${window.cnxT?window.cnxT('ui.kitchen_html.h3_7b9f3a63','Xác nhận'):'Xác nhận'}</button>
                </div>
            </div>
        `;

        modal.classList.add('open');
        this.loadPosPromotionsIntoModal();
    },

    async loadPosPromotionsIntoModal() {
        const box = document.getElementById('pos-active-promos-chips');
        if (!box) return;
        const subtotal = this.cart.reduce((s, it) => s + (it.price + (it.toppings || []).reduce((a, t) => a + (parseFloat(t.price) || 0), 0)) * it.quantity, 0);
        try {
            const res = await fetch(`api/promotions.php?action=active&subtotal=${subtotal}`).then(r => r.json());
            if (!res || !res.success || !Array.isArray(res.data) || res.data.length === 0) {
                box.innerHTML = (window.cnxT?window.cnxT('js.s_pos.d4867400','<span class="text-slate-500 italic">Chưa có chương trình KM nào đang bật.</span>'):'<span class="text-slate-500 italic">Chưa có chương trình KM nào đang bật.</span>');
                return;
            }
            box.innerHTML = res.data.map(p => `
                <button type="button" onclick="document.getElementById('discount-promo-code').value='${escapeJsAttr(p.code)}'; POS.applyPromoCodeInModal();" class="px-2 py-0.5 rounded-md ${p.eligible_now ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-white/10'} border font-mono">
                    ${escapeHtml(p.code)}${p.promo_mode === 'auto' ? ' ⚡Tự áp' : ''} (${p.discount_type === 'percent' ? Number(p.discount_value) + '%' : this.formatMoney(p.discount_value) + (window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ')})
                </button>
            `).join('');
            if (!this.discount.promo_id && Array.isArray(res.auto_promotions) && res.auto_promotions.length > 0 && subtotal > 0) {
                const bestAuto = res.auto_promotions[0];
                const codeInp = document.getElementById('discount-promo-code');
                if (codeInp && !codeInp.value) {
                    codeInp.value = bestAuto.code;
                    await this.applyPromoCodeInModal();
                }
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('pos.js', e) : console.debug('pos.js', e)); }
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
            alert((window.cnxT?window.cnxT('js.s_pos.43a9ea2e','Vui lòng chọn hoặc nhập Lý do giảm giá để ghi nhận Kiểm toán!'):'Vui lòng chọn hoặc nhập Lý do giảm giá để ghi nhận Kiểm toán!'));
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
            alert((window.cnxT?window.cnxT('js.s_pos.1399e991','Bàn hiện tại không có hóa đơn để chuyển!'):'Bàn hiện tại không có hóa đơn để chuyển!'));
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
                <p class="text-xs text-slate-400 mb-3">${window.cnxT?window.cnxT('js.s_pos.350bb2cf','Chọn bàn trống để chuyển toàn bộ đơn hàng sang:'):'Chọn bàn trống để chuyển toàn bộ đơn hàng sang:'}</p>
                <div class="grid grid-cols-3 gap-2.5 max-h-72 overflow-y-auto mb-4 p-1">
                    ${tablesHtml || (window.cnxT?window.cnxT('js.s_pos.b0623fcd','<p class="col-span-3 text-slate-400 text-sm text-center py-6">Không có bàn trống nào!</p>'):'<p class="col-span-3 text-slate-400 text-sm text-center py-6">Không có bàn trống nào!</p>')}
                </div>
                <div class="flex justify-end">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('switch-table-modal').classList.remove('open')">${window.cnxT?window.cnxT('ui.pos_html.button_cee55387','Đóng'):'Đóng'}</button>
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
                alert(data.message || (window.cnxT?window.cnxT('js.s_pos.80b36d5f','Lỗi chuyển bàn'):'Lỗi chuyển bàn'));
            }
        } catch (e) {
            console.error('Error switching table:', e);
        }
    },

    // Merge Table (Gộp bàn)
    openMergeTableModal() {
        if (!this.currentTable || this.cart.length === 0) {
            alert((window.cnxT?window.cnxT('js.s_pos.8b8e1fc8','Bàn hiện tại không có hóa đơn để gộp!'):'Bàn hiện tại không có hóa đơn để gộp!'));
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
                <p class="text-xs text-slate-400 mb-3">${window.cnxT?window.cnxT('js.s_pos.ac7a4c1b','Chọn bàn đang có khách để gộp đơn hàng vào:'):'Chọn bàn đang có khách để gộp đơn hàng vào:'}</p>
                <div class="grid grid-cols-3 gap-2.5 max-h-72 overflow-y-auto mb-4 p-1">
                    ${tablesHtml || (window.cnxT?window.cnxT('js.s_pos.f42a1d8c','<p class="col-span-3 text-slate-400 text-sm text-center py-6">Không có bàn nào khác đang có khách!</p>'):'<p class="col-span-3 text-slate-400 text-sm text-center py-6">Không có bàn nào khác đang có khách!</p>')}
                </div>
                <div class="flex justify-end">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('merge-table-modal').classList.remove('open')">${window.cnxT?window.cnxT('ui.pos_html.button_cee55387','Đóng'):'Đóng'}</button>
                </div>
            </div>
        `;

        modal.classList.add('open');
    },

    async applyPromoCodeInModal() {
        const code = (document.getElementById('discount-promo-code')?.value || '').trim().toUpperCase();
        if (!code) return;
        const subtotal = this.cart.reduce((s, it) => s + (it.price + (it.toppings || []).reduce((a, t) => a + (parseFloat(t.price) || 0), 0)) * it.quantity, 0);
        try {
            const res = await fetch('api/promotions.php?action=validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promo_code: code, subtotal })
            }).then(r => r.json());
            if (res.success && res.promo) {
                this.setDiscountType('amount');
                const valInp = document.getElementById('discount-val-input');
                const rsnInp = document.getElementById('discount-reason-input');
                if (valInp) valInp.value = Math.round(Number(res.discount_amount || 0));
                if (rsnInp) rsnInp.value = `KM ${res.promo.code}: ${res.promo.name}`;
                this.discount.promo_id = res.promo.id;
                this.discount.promo_code = res.promo.code;
                this.discount.promo_name = res.promo.name;
            } else {
                alert(res.message || (window.cnxT?window.cnxT('js.s_pos.bbfcc8b7','Mã khuyến mãi không hợp lệ'):'Mã khuyến mãi không hợp lệ'));
            }
        } catch (e) { alert((window.cnxT?window.cnxT('js.s_pos.742db00e','Lỗi kiểm tra mã KM'):'Lỗi kiểm tra mã KM')); }
    },

    async doMergeTable(targetTableId) {
        if (!(await window.cnxConfirm(`${window.cnxT?window.cnxT('js.s_pos.8a713649','Bạn có chắc muốn gộp bàn'):'Bạn có chắc muốn gộp bàn'} ${this.currentTable.code} ${window.cnxT?window.cnxT('js.s_pos.c48f8334','vào bàn được chọn?'):'vào bàn được chọn?'}`))) {
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
                alert(data.message || (window.cnxT?window.cnxT('js.s_pos.b9529487','Lỗi gộp bàn'):'Lỗi gộp bàn'));
            }
        } catch (e) {
            console.error('Error merging table:', e);
        }
    },

    // Pop VietQR Dynamic Modal
    async showCurrentVietQr() {
        if (this.cart.length === 0) {
            alert((window.cnxT?window.cnxT('js.s_pos.07665c01','Hóa đơn hiện tại chưa có món ăn nào để tạo mã VietQR!'):'Hóa đơn hiện tại chưa có món ăn nào để tạo mã VietQR!'));
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
            alert((window.cnxT?window.cnxT('js.s_pos.55a621a9','Tổng tiền hóa đơn bằng 0, không cần quét mã QR!'):'Tổng tiền hóa đơn bằng 0, không cần quét mã QR!'));
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
                if (tbl) tbl.innerText = this.currentTable ? `${this.currentTable.code} (${this.currentTable.name})` : (window.cnxT?window.cnxT('ui.customer_html.button_78e6716b','Mang Về'):'Mang Về');
                if (code) code.innerText = data.order_code;
                if (note) note.innerText = data.note;

                const modal = document.getElementById('pos-vietqr-modal');
                if (modal) modal.classList.add('open');
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_ord.524a0080','Không thể tạo mã VietQR'):'Không thể tạo mã VietQR'));
            }
        } catch (e) {
            console.error('Error fetching VietQR:', e);
            alert((window.cnxT?window.cnxT('js.s_ord.ab4fca8b','Lỗi kết nối khi tải mã VietQR'):'Lỗi kết nối khi tải mã VietQR'));
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
                        action_label: (window.cnxT?window.cnxT('js.s_pos.960013f6','In lại hóa đơn đã thanh toán ('):'In lại hóa đơn đã thanh toán (') + (data.order.table_code || 'MV') + ')',
                        severity: 'WARN',
                        order_id: data.order.id,
                        order_code: data.order.order_code,
                        table_code: data.order.table_code,
                        amount_impact: data.order.total_amount || 0,
                        reason: (window.cnxT?window.cnxT('js.s_pos.e96ec605','Thu ngân bấm In lại hóa đơn'):'Thu ngân bấm In lại hóa đơn'),
                        details: (window.cnxT?window.cnxT('js.s_pos.615db0f4','Mã đơn: '):'Mã đơn: ') + data.order.order_code
                    })
                }).catch((errIgnored) => { (window.CyberSecurity ? CyberSecurity.logSilentError('pos.js', errIgnored) : console.debug('pos.js', errIgnored)); });
                this.showReceiptModal(data.order, data.items, data.store, (window.cnxT?window.cnxT('js.s_pos.45dd3378','IN LẠI HÓA ĐƠN'):'IN LẠI HÓA ĐƠN'), (window.cnxT?window.cnxT('js.s_pos.f23ba7df','Xem trước & In hóa đơn nhiệt 80mm'):'Xem trước & In hóa đơn nhiệt 80mm'));
            }
        } catch(e) {
            console.error('Error reprinting order:', e);
        }
    },

    // Payment Modal (Thanh toán)
    async loadPosAlerts() {
        const bar = document.getElementById('pos-pending-alerts-bar');
        if (!bar) return;
        try {
            const res = await fetch('api/orders.php?action=alerts&target_role=cashier').then(r => r.json());
            if (!res || !res.success) return;
            const alerts = Array.isArray(res.alerts) ? res.alerts : [];
            const qrAlerts = alerts.filter(a => a.alert_type === 'qr_table_pending' || a.alert_type === 'qr_payment_pending');

            // Phát chuông + thông báo nổi khi có đơn QR mới
            if (!this._knownQrAlertIds) {
                this._knownQrAlertIds = new Set(qrAlerts.map(a => Number(a.id)));
            } else {
                const newQr = qrAlerts.filter(a => !this._knownQrAlertIds.has(Number(a.id)));
                if (newQr.length > 0) {
                    if (typeof this.playNotificationChime === 'function') this.playNotificationChime();
                    if (typeof this.showToast === 'function') {
                        this.showToast(`📱 ${newQr[0].title || (window.cnxT?window.cnxT('js.s_pos.c592f794','Có đơn QR mới từ khách hàng!'):'Có đơn QR mới từ khách hàng!')}`, 'info');
                    }
                }
                this._knownQrAlertIds = new Set(qrAlerts.map(a => Number(a.id)));
            }

            const deltas = Array.isArray(res.pending_deltas) ? res.pending_deltas : [];
            const orphanPending = deltas.filter(d => !d.table_id || Number(d.table_id) === 0);
            const urgentDeltas = deltas.filter(d => d.settlement_status === 'refund_due' || d.settlement_status === 'extra_due' || d.kitchen_status === 'cancel_requested');
            if (qrAlerts.length === 0 && orphanPending.length === 0 && urgentDeltas.length === 0) {
                bar.classList.add('hidden');
                bar.innerHTML = '';
                return;
            }
            bar.classList.remove('hidden');
            const chips = [];
            qrAlerts.forEach(a => {
                const isTableQr = a.alert_type === 'qr_table_pending';
                const nt = window.cnxNotifText ? cnxNotifText(a) : { title: a.title, message: a.message };
                chips.push(`<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${isTableQr ? 'bg-rose-500/20 border border-rose-400/50 text-rose-200' : 'bg-amber-500/20 border border-amber-400/50 text-amber-200'} text-xs animate-pulse">
                    <b>📱 ${escapeHtml(nt.title || a.title || (window.cnxT?window.cnxT('js.s_pos.03c0e990','Đơn QR mới'):'Đơn QR mới'))}</b>
                    <span class="opacity-85 hidden md:inline">${escapeHtml(nt.message || a.message || '')}</span>
                    ${Number(a.table_id || 0) > 0 ? `<button type="button" onclick="POS.selectTable(${Number(a.table_id)})" class="px-1.5 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px]">${window.cnxT?window.cnxT('js.s_ord.59bf3eff','Mở bàn'):'Mở bàn'}</button>` : ''}
                    ${isTableQr && Number(a.order_id || 0) > 0 ? `<button type="button" onclick="POS.sendOrderToKitchen(${Number(a.order_id)})" class="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px]">${window.cnxT?window.cnxT('js.s_cust.9a34bc5b','Chuyển Bếp'):'Chuyển Bếp'}</button>` : ''}
                    <button type="button" onclick="POS.ackPosAlert(${Number(a.id)})" class="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-[10px]" title="Đã xem">✕</button>
                </span>`);
            });
            urgentDeltas.forEach(d => {
                if (d.kitchen_status === 'cancel_requested') {
                    chips.push(`<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-200"><b>⚠️ Bếp xin hủy ${escapeHtml(d.table_code || d.order_code)}</b> (${escapeHtml(d.cancel_request_reason || '')}) <button type="button" onclick="POS.quickCancelPendingOrder(${Number(d.id)}, '${escapeJsAttr(d.order_code)}', '${escapeJsAttr(d.cancel_request_reason || (window.cnxT?window.cnxT('js.s_pos.c70e6cd7','Bếp yêu cầu hủy'):'Bếp yêu cầu hủy'))}')" class="px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px]">${window.cnxT?window.cnxT('js.s_pos.f5b5176c','Chốt Hủy'):'Chốt Hủy'}</button></span>`);
                } else if (d.settlement_status === 'refund_due' || d.settlement_status === 'extra_due') {
                    const isRef = d.settlement_status === 'refund_due';
                    const diff = Math.abs(Number(d.total_amount || 0) - Number(d.paid_amount || 0));
                    chips.push(`<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200"><b>${isRef ? '💸 Hoàn' : (window.cnxT?window.cnxT('js.s_pos.28381e28','💰 Thu thêm'):'💰 Thu thêm')} ${escapeHtml(d.table_code || d.order_code)}: ${this.formatMoney(diff)}đ</b> <button type="button" onclick="POS.settleOrderDelta(${Number(d.id)}, 'cash')" class="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]">${window.cnxT?window.cnxT('js.s_pos.596c5d80','Đã xử lý'):'Đã xử lý'}</button></span>`);
                }
            });
            if (orphanPending.length > 0) {
                chips.push(`<a href="online_orders.html" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-sky-500/25 border border-sky-400/40 text-sky-200 font-bold hover:bg-sky-500/40"><i class="fas fa-motorcycle"></i> ${orphanPending.length} đơn Online / chưa gắn bàn đang chờ → Mở xử lý</a>`);
            }
            bar.innerHTML = chips.join('');
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('pos.js', e) : console.debug('pos.js', e)); }
    },

    async ackPosAlert(alertId) {
        try {
            await fetch('api/orders.php?action=ack_alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: alertId })
            });
            await this.loadPosAlerts();
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('pos.js', e) : console.debug('pos.js', e)); }
    },

    async quickCancelPendingOrder(orderId, orderCode, presetReason) {
        if (!(await window.cnxConfirm(`${window.cnxT?window.cnxT('js.s_pos.06e72a7c','Xác nhận CHỐT HỦY đơn'):'Xác nhận CHỐT HỦY đơn'} ${orderCode} ${window.cnxT?window.cnxT('js.s_pos.1332f4fd','theo yêu cầu từ Bếp?\\nLý do:'):'theo yêu cầu từ Bếp?\\nLý do:'} ${presetReason}`))) return;
        try {
            const res = await fetch('api/orders.php?action=cancel_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, reason: presetReason })
            }).then(r => r.json());
            if (res.success) {
                await this.loadTables();
            } else {
                alert(res.message || (window.cnxT?window.cnxT('js.s_onl.83faf5e3','Không thể hủy đơn'):'Không thể hủy đơn'));
            }
        } catch (e) { alert((window.cnxT?window.cnxT('js.s_ops.b69ae662','Lỗi kết nối'):'Lỗi kết nối')); }
    },

    async confirmOrderPayment(orderId, mode = 'paid') {
        try {
            const res = await fetch('api/orders.php?action=confirm_payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, mode, payment_method: 'banking' })
            }).then(r => r.json());
            if (res.success) {
                await this.loadTables();
                if (this.currentTable) await this.selectTable(this.currentTable.id);
            } else {
                alert(res.message || (window.cnxT?window.cnxT('js.s_pos.84e9d15a','Lỗi xác nhận thanh toán'):'Lỗi xác nhận thanh toán'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.e5f87ad3','Lỗi kết nối: '):'Lỗi kết nối: ') + e.message);
        }
    },

    async sendOrderToKitchen(orderId) {
        try {
            const res = await fetch('api/orders.php?action=send_to_kitchen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId })
            }).then(r => r.json());
            if (res.success) {
                await this.loadTables();
                if (this.currentTable) await this.selectTable(this.currentTable.id);
            } else {
                alert(res.message || (window.cnxT?window.cnxT('js.s_onl.ca8f4a75','Chưa thể chuyển Bếp'):'Chưa thể chuyển Bếp'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.e5f87ad3','Lỗi kết nối: '):'Lỗi kết nối: ') + e.message);
        }
    },

    async settleOrderDelta(orderId, method = 'cash') {
        try {
            const res = await fetch('api/orders.php?action=settle_delta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, payment_method: method })
            }).then(r => r.json());
            if (res.success) {
                await this.loadTables();
                if (this.currentTable) await this.selectTable(this.currentTable.id);
            } else {
                alert(res.message || (window.cnxT?window.cnxT('js.s_onl.1813bbe9','Lỗi quyết toán chênh lệch'):'Lỗi quyết toán chênh lệch'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.e5f87ad3','Lỗi kết nối: '):'Lỗi kết nối: ') + e.message);
        }
    },

    openPaymentModal() {
        if (this.cart.length === 0) {
            alert((window.cnxT?window.cnxT('js.s_pos.42cb5859','Hóa đơn chưa có món ăn nào!'):'Hóa đơn chưa có món ăn nào!'));
            return;
        }
        if (this.currentTable && Number(this.currentTable.pending_cancel_count || 0) > 0) {
            alert((window.cnxT?window.cnxT('js.s_pos.c3fe05dd','Bàn này đang có món chờ Bếp duyệt hủy. Vui lòng chờ Bếp xác nhận trước khi thanh toán!'):'Bàn này đang có món chờ Bếp duyệt hủy. Vui lòng chờ Bếp xác nhận trước khi thanh toán!'));
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

        this._checkoutIdempKey = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : ('idem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10));

        const bankId = this.storeSettings.bank_id || 'MB';
        const accountNo = this.storeSettings.bank_account_no || '0967041111';
        const accountName = this.storeSettings.bank_account_name || 'GOC PHO POS';
        const addInfoStr = `TT ${this.currentTable ? this.currentTable.code : 'DON'}`;
        const vietQrUrl = `/api/payment/vietqr_svg?bank_id=${encodeURIComponent(bankId)}&account_no=${encodeURIComponent(accountNo)}&amount=${Math.round(total)}&add_info=${encodeURIComponent(addInfoStr)}&account_name=${encodeURIComponent(accountName)}`;

        modal.innerHTML = `
            <div class="liquid-glass liquid-modal-content p-6 w-[540px] max-w-full text-white shadow-2xl border border-sky-500/30">
                <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                    <div>
                        <h3 class="font-bold text-lg text-emerald-400">${window.cnxT?window.cnxT('js.s_pos.cc076d5a','Thanh Toán Hóa Đơn'):'Thanh Toán Hóa Đơn'}</h3>
                        <p class="text-xs text-slate-400 mt-0.5">Bàn: ${this.currentTable ? this.currentTable.code : 'MV'} ${window.cnxT?window.cnxT('js.s_pos.0d9804b0','| Số món:'):'| Số món:'} ${this.cart.reduce((a, b) => a + b.quantity, 0)}</p>
                    </div>
                    <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="document.getElementById('payment-modal').classList.remove('open')">&times;</button>
                </div>

                <!-- Total Amount Banner -->
                <div class="bg-gradient-to-r from-emerald-900/60 to-slate-900/90 border border-emerald-500/40 rounded-xl p-4 text-center mb-5 shadow-lg">
                    <span class="text-xs uppercase tracking-wider text-emerald-300 font-semibold">${window.cnxT?window.cnxT('js.s_pos.00c998e5','Tổng Tiền Cần Thanh Toán'):'Tổng Tiền Cần Thanh Toán'}</span>
                    <div class="text-3xl font-black text-emerald-400 font-mono mt-1">${this.formatMoney(total)} <span class="text-sm font-normal text-slate-300">${window.cnxT?window.cnxT('ui.pos_html.span_a0cb4ccf','VNĐ'):'VNĐ'}</span></div>
                </div>

                <!-- Payment Methods -->
                <div class="mb-4">
                    <label class="block text-xs font-semibold text-slate-300 mb-2">${window.cnxT?window.cnxT('js.s_pos.6b619788','Phương thức thanh toán:'):'Phương thức thanh toán:'}</label>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button type="button" id="paymethod-cash" class="btn-glass btn-glass-primary text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap" onclick="POS.selectPaymentMethod('cash', ${total})">
                            <i class="fas fa-money-bill-wave"></i> ${window.cnxT?window.cnxT('ui.admin_html.option_7d2970d9','Tiền mặt'):'Tiền mặt'}
                        </button>
                        <button type="button" id="paymethod-banking" class="btn-glass text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap" onclick="POS.selectPaymentMethod('banking', ${total})">
                            <i class="fas fa-qrcode"></i> ${window.cnxT?window.cnxT('js.s_pos.0452370e','Chuyển khoản QR'):'Chuyển khoản QR'}
                        </button>
                        <button type="button" id="paymethod-card" class="btn-glass text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap" onclick="POS.selectPaymentMethod('card', ${total})">
                            <i class="fas fa-credit-card"></i> ${window.cnxT?window.cnxT('js.s_fin.2879c570','Thẻ POS'):'Thẻ POS'}
                        </button>
                        <button type="button" id="paymethod-split" class="btn-glass text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap" onclick="POS.selectPaymentMethod('split', ${total})">
                            <i class="fas fa-code-branch"></i> ${window.cnxT?window.cnxT('js.s_pos.30c15a90','Kết hợp'):'Kết hợp'}
                        </button>
                    </div>
                </div>

                <!-- Method Content: Cash -->
                <div id="payment-cash-section">
                    <div class="mb-3">
                        <label class="block text-xs font-semibold text-slate-300 mb-1">${window.cnxT?window.cnxT('js.s_pos.62407340','Tiền khách đưa (VNĐ):'):'Tiền khách đưa (VNĐ):'}</label>
                        <div class="relative">
                            <input type="number" id="cash-received-input" value="${total}" class="liquid-input w-full font-mono text-xl font-bold pr-10 text-emerald-400" oninput="POS.calcChange(${total})" />
                            <button type="button" class="absolute right-2 top-2 text-slate-400 hover:text-sky-400" onclick="VirtualNumpad.open(document.getElementById('cash-received-input'), 'Nhập tiền khách đưa')">
                                <i class="fas fa-keyboard"></i>
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-4 gap-1.5 mb-4">
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(${total}, ${total})">${window.cnxT?window.cnxT('js.s_pos.4b8d0d5c','Đủ tiền'):'Đủ tiền'}</button>
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(50000, ${total})">50.000</button>
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(100000, ${total})">100.000</button>
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(200000, ${total})">200.000</button>
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(500000, ${total})">500.000</button>
                        <button type="button" class="btn-glass text-xs py-1.5 bg-slate-800/80" onclick="POS.setCashReceived(1000000, ${total})">1.000.000</button>
                    </div>

                    <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-white/10 mb-4">
                        <span class="text-sm font-semibold text-slate-300">${window.cnxT?window.cnxT('js.s_pos.2b2f0ea2','Tiền thừa trả khách:'):'Tiền thừa trả khách:'}</span>
                        <span id="cash-change-display" class="text-lg font-black font-mono text-amber-400">${window.cnxT?window.cnxT('ui.sa_html.div_e995e897','0 đ'):'0 đ'}</span>
                    </div>
                </div>

                <!-- Method Content: VietQR Banking -->
                <div id="payment-banking-section" class="hidden text-center mb-4 p-4 rounded-xl bg-slate-900/80 border border-sky-500/20">
                    <p class="text-xs text-sky-300 font-semibold mb-2">${window.cnxT?window.cnxT('js.s_pos.fe6be9a1','Quét mã QR bằng App Ngân Hàng để thanh toán tự động'):'Quét mã QR bằng App Ngân Hàng để thanh toán tự động'}</p>
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
                        <i class="fas fa-spinner fa-spin text-indigo-400 mr-1.5"></i>${window.cnxT?window.cnxT('js.s_pos.ae351f9f','Đang kiểm tra kết nối Cổng Cà Thẻ SmartPOS (ECR)...'):'Đang kiểm tra kết nối Cổng Cà Thẻ SmartPOS (ECR)...'}
                    </div>
                </div>

                <!-- Method Content: Split Payment (PAY-04) -->
                <div id="payment-split-section" class="hidden mb-4 p-4 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2.5 text-xs">
                    <div class="font-bold text-amber-300 flex items-center justify-between">
                        <span><i class="fas fa-code-branch mr-1"></i> ${window.cnxT?window.cnxT('js.s_pos.debafcb4','Tách đa phương thức (Tiền mặt + CK + Thẻ)'):'Tách đa phương thức (Tiền mặt + CK + Thẻ)'}</span>
                        <span class="text-[11px] font-mono text-slate-300">Mục tiêu: ${this.formatMoney(total)} đ</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">${window.cnxT?window.cnxT('js.s_pos.4a9bede3','Tiền mặt (Mở két nếu &gt; 0)'):'Tiền mặt (Mở két nếu &gt; 0)'}</label>
                            <input type="number" id="split-cash-input" value="${Math.round(total)}" min="0" oninput="POS.calcSplitSummary(${total})" class="liquid-input w-full py-1.5 px-2 font-mono font-bold text-emerald-400" />
                        </div>
                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">${window.cnxT?window.cnxT('js.s_pos.0452370e','Chuyển khoản QR'):'Chuyển khoản QR'}</label>
                            <input type="number" id="split-banking-input" value="0" min="0" oninput="POS.calcSplitSummary(${total})" class="liquid-input w-full py-1.5 px-2 font-mono font-bold text-sky-400" />
                        </div>
                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">${window.cnxT?window.cnxT('js.s_fin.2879c570','Thẻ POS'):'Thẻ POS'}</label>
                            <input type="number" id="split-card-input" value="0" min="0" oninput="POS.calcSplitSummary(${total})" class="liquid-input w-full py-1.5 px-2 font-mono font-bold text-indigo-400" />
                        </div>
                    </div>
                    <div id="split-summary-status" class="text-[11px] font-mono text-emerald-300">Đã phân bổ đủ: ${this.formatMoney(total)} đ</div>
                </div>

                <!-- Footer buttons -->
                <div class="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                    <button type="button" class="btn-glass text-sm py-2.5" onclick="document.getElementById('payment-modal').classList.remove('open')">${window.cnxT?window.cnxT('js.m_sa.8a4917d2','Hủy bỏ'):'Hủy bỏ'}</button>
                    <button type="button" id="btn-confirm-checkout" class="btn-glass-success text-sm py-2.5 font-bold flex items-center justify-center gap-2" onclick="POS.confirmCheckout(${total})">
                        <i class="fas fa-check-circle"></i> <span id="btn-confirm-checkout-text">${window.cnxT?window.cnxT('js.s_pos.eae5eea8','Xác Nhận & In HĐ'):'Xác Nhận & In HĐ'}</span>
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
                    btnBank.innerHTML = `<i class="fas fa-lock text-rose-400"></i> ${window.cnxT?window.cnxT('js.s_pos.0452370e','Chuyển khoản QR'):'Chuyển khoản QR'} <span class="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300">LOCK</span>`;
                }
                if (secBank) {
                    secBank.innerHTML = `
                        <div class="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs space-y-2 text-left">
                            <div class="flex items-center gap-2 font-bold text-sm text-rose-400">
                                <i class="fas fa-lock"></i>
                                <span>${window.cnxT?window.cnxT('js.s_pos.715fb71e','MODULE VIETQR TỰ ĐỘNG ĐÃ BỊ KHÓA / CHƯA CẤP PHÉP'):'MODULE VIETQR TỰ ĐỘNG ĐÃ BỊ KHÓA / CHƯA CẤP PHÉP'}</span>
                            </div>
                            <p class="leading-relaxed text-[11px]">${window.cnxT?window.cnxT('js.s_fin.ab007c49','Mã module:'):'Mã module:'} <span class="font-mono text-rose-300">vietqr_payment</span> ${window.cnxT?window.cnxT('js.s_fin.d79360a9','• Vui lòng bật lại trên Máy chủ Master SaaS.'):'• Vui lòng bật lại trên Máy chủ Master SaaS.'}</p>
                        </div>
                    `;
                }
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('pos.js', e) : console.debug('pos.js', e)); }
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
                const isSim = Number(data.config?.simulation_mode ?? 1) !== 0;
                if (data.module_state === 'BLOCKED') {
                    btnCard.innerHTML = `<i class="fas fa-ban text-rose-400"></i> ${window.cnxT?window.cnxT('js.s_fin.2879c570','Thẻ POS'):'Thẻ POS'} <span class="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300">BLOCK</span>`;
                } else if (data.module_state === 'OFF') {
                    btnCard.innerHTML = `<i class="fas fa-lock text-amber-400"></i> ${window.cnxT?window.cnxT('js.s_fin.2879c570','Thẻ POS'):'Thẻ POS'} <span class="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">OFF</span>`;
                } else if (isSim) {
                    btnCard.innerHTML = `<i class="fas fa-credit-card text-amber-400"></i> ${window.cnxT?window.cnxT('js.s_fin.2879c570','Thẻ POS'):'Thẻ POS'} <span class="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">${window.cnxT?window.cnxT('js.s_pos.d89fff69','MÔ PHỎNG'):'MÔ PHỎNG'}</span>`;
                } else {
                    btnCard.innerHTML = `<i class="fas fa-credit-card text-emerald-400"></i> ${window.cnxT?window.cnxT('js.s_fin.2879c570','Thẻ POS'):'Thẻ POS'} <span class="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">ECR LIVE</span>`;
                }
            }
            this.renderCardPaymentSection(total);
        } catch (e) {
            this.cardModuleStatus = { module_state: 'OFF', message: (window.cnxT?window.cnxT('js.s_pos.c42e190d','Không thể kết nối module cà thẻ.'):'Không thể kết nối module cà thẻ.') };
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
                        <span>${isBlocked ? 'MODULE CÀ THẺ BỊ KHÓA (BLOCKED BỞI MASTER)' : (window.cnxT?window.cnxT('js.s_pos.38b8cbe9','MODULE CÀ THẺ TÍN DỤNG ĐANG TẮT (OFF)'):'MODULE CÀ THẺ TÍN DỤNG ĐANG TẮT (OFF)')}</span>
                    </div>
                    <p class="leading-relaxed text-[11px]">${st.message || (window.cnxT?window.cnxT('js.s_pos.d12160f9','Module thanh toán thẻ tín dụng hiện không khả dụng trên giấy phép cửa hàng.'):'Module thanh toán thẻ tín dụng hiện không khả dụng trên giấy phép cửa hàng.')}</p>
                    <div class="text-[10px] text-slate-400 pt-1 border-t border-white/10">
                        <i class="fas fa-shield-halved mr-1"></i>${window.cnxT?window.cnxT('js.s_pos.554adeb4','Kiểm soát bởi'):'Kiểm soát bởi'} <b>CyberNexus Master SaaS</b> ${window.cnxT?window.cnxT('js.s_pos.895603d8','• Vui lòng chọn Tiền mặt hoặc Chuyển khoản QR.'):'• Vui lòng chọn Tiền mặt hoặc Chuyển khoản QR.'}
                    </div>
                </div>
            `;
            return;
        }

        const cfg = st.config || {};
        const isSim = Number(cfg.simulation_mode ?? 1) !== 0;
        const surchargePct = parseFloat(cfg.customer_surcharge_percent) || 0;
        const surchargeAmt = Math.round(total * (surchargePct / 100.0));
        const totalCharged = Math.round(total) + surchargeAmt;
        const terminalName = (st.compatible_terminals || st.catalog || []).find(t => t.model_code === cfg.model_code)?.model_name || cfg.model_code || 'PAX A920 Pro';
        const connLabel = cfg.connection_type || cfg.connection_mode || 'LAN_TCP';
        const tidLabel = cfg.tid || cfg.terminal_id_tid || 'TID88901';

        secCard.innerHTML = `
            <div class="space-y-3 text-xs">
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40">
                    <div class="flex items-center gap-2.5">
                        <span class="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                            <i class="fas fa-microchip"></i>
                        </span>
                        <div>
                            <div class="font-bold text-white flex items-center gap-1.5">
                                <span>${escapeHtml(terminalName)}</span>
                                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">AUTO ECR</span>
                            </div>
                            <div class="text-[10px] text-slate-300 font-mono">
                                ${escapeHtml(cfg.acquirer_bank || 'Vietcombank')} • ${escapeHtml(connLabel)} ${escapeHtml(cfg.terminal_ip || '10.0.126.250')}:${Number(cfg.terminal_port || 10009)} • TID: ${escapeHtml(tidLabel)}
                            </div>
                        </div>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${isSim ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}">${isSim ? '⚠️ MÔ PHỎNG' : '● LIVE ECR'}</span>
                </div>

                <!-- Surcharge & Total Charged Summary -->
                <div class="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-1">
                    <div class="flex justify-between text-[11px] text-slate-400">
                        <span>${window.cnxT?window.cnxT('js.s_pos.86ff25e4','Tiền hóa đơn gốc:'):'Tiền hóa đơn gốc:'}</span>
                        <span class="font-mono text-slate-200">${this.formatMoney(total)} đ</span>
                    </div>
                    <div class="flex justify-between text-[11px] text-slate-400">
                        <span>Phụ phí cà thẻ (${surchargePct}%):</span>
                        <span class="font-mono text-amber-300">+${this.formatMoney(surchargeAmt)} đ</span>
                    </div>
                    <div class="flex justify-between text-xs font-bold text-indigo-300 pt-1 border-t border-white/10">
                        <span>${window.cnxT?window.cnxT('js.s_pos.87f12349','Tổng tiền đẩy tự động sang máy POS:'):'Tổng tiền đẩy tự động sang máy POS:'}</span>
                        <span class="font-mono text-sm text-emerald-400">${this.formatMoney(totalCharged)} đ</span>
                    </div>
                </div>

                <!-- Card Scheme & Entry Mode Selector -->
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-[10px] text-slate-400 mb-1">${window.cnxT?window.cnxT('js.s_pos.4d6f504d','Tổ chức thẻ (Mô phỏng):'):'Tổ chức thẻ (Mô phỏng):'}</label>
                        <select id="ecr-card-scheme" onchange="POS.selectedCardScheme=this.value" class="w-full bg-slate-950 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white font-semibold">
                            <option value="VISA" ${this.selectedCardScheme === 'VISA' ? 'selected' : ''}>💳 VISA Credit/Debit</option>
                            <option value="MASTERCARD" ${this.selectedCardScheme === 'MASTERCARD' ? 'selected' : ''}>💳 MasterCard</option>
                            <option value="JCB" ${this.selectedCardScheme === 'JCB' ? 'selected' : ''}>${window.cnxT?window.cnxT('js.s_pos.819cb78d','💳 JCB Quốc Tế'):'💳 JCB Quốc Tế'}</option>
                            <option value="NAPAS" ${this.selectedCardScheme === 'NAPAS' ? 'selected' : ''}>${window.cnxT?window.cnxT('js.s_pos.6e6fae7e','💳 NAPAS Nội Địa'):'💳 NAPAS Nội Địa'}</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 mb-1">${window.cnxT?window.cnxT('js.s_pos.847d0217','Phương thức đọc thẻ:'):'Phương thức đọc thẻ:'}</label>
                        <select id="ecr-entry-mode" onchange="POS.selectedCardEntryMode=this.value" class="w-full bg-slate-950 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white font-semibold">
                            <option value="NFC Contactless" ${this.selectedCardEntryMode === 'NFC Contactless' ? 'selected' : ''}>${window.cnxT?window.cnxT('js.s_pos.bd9b9afa','📡 Chạm NFC / Apple Pay'):'📡 Chạm NFC / Apple Pay'}</option>
                            <option value="EMV Chip" ${this.selectedCardEntryMode === 'EMV Chip' ? 'selected' : ''}>${window.cnxT?window.cnxT('js.s_pos.e189b34b','🔌 Cắm Chip EMV'):'🔌 Cắm Chip EMV'}</option>
                            <option value="QR POS" ${this.selectedCardEntryMode === 'QR POS' ? 'selected' : ''}>${window.cnxT?window.cnxT('js.s_pos.2b113e7a','📱 Quét QR trên POS'):'📱 Quét QR trên POS'}</option>
                        </select>
                    </div>
                </div>

                <!-- Live ECR Terminal Response Box -->
                <div id="ecr-live-status-box" class="p-2.5 rounded-xl bg-slate-950/90 border border-indigo-500/30 text-[11px] text-slate-300 flex items-center gap-2">
                    <i class="fas fa-satellite-dish text-indigo-400 text-sm animate-pulse"></i>
                    <span>${window.cnxT?window.cnxT('js.s_pos.75977137','Sẵn sàng đẩy lệnh'):'Sẵn sàng đẩy lệnh'} <b>SALE ${this.formatMoney(totalCharged)}đ</b> ${window.cnxT?window.cnxT('js.s_pos.6533be48','sang máy'):'sang máy'} <b>${escapeHtml(terminalName)}</b> ${window.cnxT?window.cnxT('js.s_pos.075a7afc','khi bấm xác nhận.'):'khi bấm xác nhận.'}</span>
                </div>
            </div>
        `;
    },

    selectPaymentMethod(method, total) {
        this.selectedPaymentMethod = method;
        const btnCash = document.getElementById('paymethod-cash');
        const btnBank = document.getElementById('paymethod-banking');
        const btnCard = document.getElementById('paymethod-card');
        const btnSplit = document.getElementById('paymethod-split');
        const secCash = document.getElementById('payment-cash-section');
        const secBank = document.getElementById('payment-banking-section');
        const secCard = document.getElementById('payment-card-section');
        const secSplit = document.getElementById('payment-split-section');
        const btnConfirm = document.getElementById('btn-confirm-checkout');
        const btnConfirmText = document.getElementById('btn-confirm-checkout-text');

        [btnCash, btnBank, btnCard, btnSplit].forEach(btn => {
            if (btn) btn.className = 'btn-glass text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap';
        });
        [secCash, secBank, secCard, secSplit].forEach(sec => {
            if (sec) sec.classList.add('hidden');
        });

        if (method === 'cash') {
            if (btnCash) btnCash.className = 'btn-glass btn-glass-primary text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap';
            if (secCash) secCash.classList.remove('hidden');
            if (btnConfirm) btnConfirm.disabled = false;
            if (btnConfirmText) btnConfirmText.textContent = (window.cnxT?window.cnxT('js.s_pos.eae5eea8','Xác Nhận & In HĐ'):'Xác Nhận & In HĐ');
        } else if (method === 'banking') {
            if (btnBank) btnBank.className = 'btn-glass btn-glass-primary text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap';
            if (secBank) secBank.classList.remove('hidden');
            if (btnConfirm) btnConfirm.disabled = false;
            if (btnConfirmText) btnConfirmText.textContent = (window.cnxT?window.cnxT('js.s_pos.eae5eea8','Xác Nhận & In HĐ'):'Xác Nhận & In HĐ');
        } else if (method === 'split') {
            if (btnSplit) btnSplit.className = 'btn-glass btn-glass-primary text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap';
            if (secSplit) secSplit.classList.remove('hidden');
            if (btnConfirm) btnConfirm.disabled = false;
            if (btnConfirmText) btnConfirmText.textContent = (window.cnxT?window.cnxT('js.s_pos.101c9319','Xác Nhận Tách TT'):'Xác Nhận Tách TT');
            this.calcSplitSummary(total);
        } else {
            if (btnCard) btnCard.className = 'btn-glass btn-glass-primary text-xs py-2.5 flex items-center justify-center gap-1.5 whitespace-nowrap';
            if (secCard) secCard.classList.remove('hidden');
            this.renderCardPaymentSection(total);

            const st = this.cardModuleStatus || { module_state: 'OFF' };
            if (st.module_state !== 'ON') {
                if (btnConfirm) btnConfirm.disabled = true;
                if (btnConfirmText) btnConfirmText.textContent = st.module_state === 'BLOCKED' ? 'Đã Khóa Bởi Master' : (window.cnxT?window.cnxT('js.s_pos.4f61ee17','Module Đang Tắt'):'Module Đang Tắt');
            } else {
                if (btnConfirm) btnConfirm.disabled = false;
                if (btnConfirmText) btnConfirmText.textContent = (window.cnxT?window.cnxT('js.s_pos.f0f9f3f2','Đẩy Lệnh POS & In HĐ'):'Đẩy Lệnh POS & In HĐ');
            }
        }
    },

    calcSplitSummary(total) {
        const c = parseFloat(document.getElementById('split-cash-input')?.value) || 0;
        const b = parseFloat(document.getElementById('split-banking-input')?.value) || 0;
        const k = parseFloat(document.getElementById('split-card-input')?.value) || 0;
        const sum = c + b + k;
        const diff = sum - total;
        const el = document.getElementById('split-summary-status');
        if (!el) return;
        if (Math.abs(diff) < 1) {
            el.className = 'text-[11px] font-mono text-emerald-300';
            el.textContent = `${window.cnxT?window.cnxT('js.s_pos.71015ed7','Đã phân bổ đủ:'):'Đã phân bổ đủ:'} ${this.formatMoney(sum)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;
        } else if (diff < 0) {
            el.className = 'text-[11px] font-mono text-rose-400 font-bold';
            el.textContent = `${window.cnxT?window.cnxT('js.s_pos.1195a227','Còn thiếu:'):'Còn thiếu:'} ${this.formatMoney(-diff)} ${window.cnxT?window.cnxT('js.s_pos.8c520442','đ (Tổng mới:'):'đ (Tổng mới:'} ${this.formatMoney(sum)} ${window.cnxT?window.cnxT('js.s_cust.72b7fe2d','đ)'):'đ)'}`;
        } else {
            el.className = 'text-[11px] font-mono text-amber-300 font-bold';
            el.textContent = `${window.cnxT?window.cnxT('js.s_pos.4980f2a5','Thừa:'):'Thừa:'} ${this.formatMoney(diff)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;
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
        display.innerText = this.formatMoney(change) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
    },

    async confirmCheckout(total) {
        if (this._checkoutInFlight) return;
        this._checkoutInFlight = true;
        const btnConfirm = document.getElementById('btn-confirm-checkout');
        if (btnConfirm) btnConfirm.disabled = true;
        const notify = (m, t = 'info') => (typeof this.showToast === 'function' ? this.showToast(m, t) : console.log(m));

        try {
            const method = this.selectedPaymentMethod || 'cash';
            let cashReceived = total;
            let splitCash = 0, splitBank = 0, splitCard = 0;

            if (method === 'cash') {
                const cashInput = document.getElementById('cash-received-input');
                cashReceived = cashInput ? (parseFloat(cashInput.value) || 0) : total;
                if (cashReceived < total) {
                    notify((window.cnxT?window.cnxT('js.s_pos.b734e252','Số tiền khách đưa chưa đủ thanh toán!'):'Số tiền khách đưa chưa đủ thanh toán!'), 'error');
                    return;
                }
            } else if (method === 'split') {
                splitCash = Math.max(0, parseFloat(document.getElementById('split-cash-input')?.value) || 0);
                splitBank = Math.max(0, parseFloat(document.getElementById('split-banking-input')?.value) || 0);
                splitCard = Math.max(0, parseFloat(document.getElementById('split-card-input')?.value) || 0);
                if (splitCash + splitBank + splitCard < total - 1) {
                    notify((window.cnxT?window.cnxT('js.s_pos.af0990ad','Tổng tiền tách thanh toán chưa đủ tổng hóa đơn!'):'Tổng tiền tách thanh toán chưa đủ tổng hóa đơn!'), 'error');
                    return;
                }
                cashReceived = splitCash;
            }

            let cardTxRef = this._recoveredCardTxRef || '';
            if (method === 'card' && !cardTxRef) {
                const st = this.cardModuleStatus || { module_state: 'OFF' };
                if (st.module_state !== 'ON') {
                    notify(st.message || (window.cnxT?window.cnxT('js.s_pos.7f32ad94','Module Cổng Cà Thẻ Tín Dụng hiện đang TẮT hoặc BỊ KHÓA bởi Master!'):'Module Cổng Cà Thẻ Tín Dụng hiện đang TẮT hoặc BỊ KHÓA bởi Master!'), 'error');
                    return;
                }
                const statusBox = document.getElementById('ecr-live-status-box');
                const schemeEl = document.getElementById('ecr-card-scheme');
                const entryEl = document.getElementById('ecr-entry-mode');
                const cardScheme = schemeEl ? schemeEl.value : (this.selectedCardScheme || 'VISA');
                const entryMode = entryEl ? entryEl.value : (this.selectedCardEntryMode || 'NFC Contactless');

                if (statusBox) {
                    statusBox.className = 'p-3 rounded-xl bg-indigo-950/90 border border-indigo-400/60 text-xs text-indigo-200 flex items-center gap-2.5';
                    statusBox.innerHTML = `
                        <i class="fas fa-circle-notch fa-spin text-indigo-400 text-base"></i>
                        <div>
                            <div class="font-bold text-white">${window.cnxT?window.cnxT('js.s_pos.071c38c3','Đang đẩy lệnh SALE tự động sang máy POS...'):'Đang đẩy lệnh SALE tự động sang máy POS...'}</div>
                            <div class="text-[10px] text-indigo-300">Giao thức Semi-Integrated ECR • Chờ khách chạm/cắm thẻ (${cardScheme} - ${entryMode})</div>
                        </div>
                    `;
                }

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
                        cashier_name: (window.CURRENT_USER && window.CURRENT_USER.fullname) ? window.CURRENT_USER.fullname : (window.cnxT?window.cnxT('js.s_pos.5e33d527','Thu ngân POS'):'Thu ngân POS')
                    })
                });
                const chargeData = await chargeRes.json();

                if (!chargeRes.ok || !chargeData.success || chargeData.status !== 'APPROVED') {
                    if (statusBox) {
                        statusBox.className = 'p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-xs text-rose-200 flex items-center gap-2.5';
                        statusBox.innerHTML = `
                            <i class="fas fa-triangle-exclamation text-rose-400 text-base"></i>
                            <div>
                                <div class="font-bold text-rose-300">GIAO DỊCH THẺ TỪ CHỐI (${chargeData.status || 'ERROR'})</div>
                                <div class="text-[11px]">${chargeData.message || (window.cnxT?window.cnxT('js.s_pos.db1eb0c0','Ngân hàng từ chối giao dịch hoặc hết thời gian chờ.'):'Ngân hàng từ chối giao dịch hoặc hết thời gian chờ.')}</div>
                            </div>
                        `;
                    }
                    return;
                }

                const tx = chargeData.transaction || {};
                cardTxRef = tx.approval_code || tx.rrn || ('ECR-' + Date.now());
                this._recoveredCardTxRef = cardTxRef;
                if (statusBox) {
                    statusBox.className = 'p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-xs text-emerald-200 flex items-center gap-2.5';
                    statusBox.innerHTML = `
                        <i class="fas fa-circle-check text-emerald-400 text-base"></i>
                        <div>
                            <div class="font-bold text-emerald-300">CHUẨN CHI THÀNH CÔNG (APPROVED: ${tx.approval_code || 'OK'})</div>
                            <div class="text-[10px] font-mono text-slate-200">${tx.card_scheme} ${tx.masked_pan} • RRN: ${tx.rrn} ${window.cnxT?window.cnxT('js.s_pos.792f966c','• Tổng thu:'):'• Tổng thu:'} ${this.formatMoney(tx.total_charged || total)}đ</div>
                        </div>
                    `;
                }
            }

            const idempKey = this._checkoutIdempKey || ('idem_' + Date.now());
            const payload = {
                order_id: this.activeOrderId,
                table_id: this.currentTable ? this.currentTable.id : null,
                payment_method: method,
                cash_received: cashReceived,
                split_cash: splitCash,
                split_banking: splitBank,
                split_card: splitCard,
                idempotency_key: idempKey,
                card_tx_ref: cardTxRef,
                discount_type: this.discount.type,
                discount_value: this.discount.value,
                discount_reason: this.discount.reason || '',
                promo_id: this.discount.promo_id || 0,
                promo_code: this.discount.promo_code || '',
                promo_name: this.discount.promo_name || '',
                vat_percent: this.vatPercent
            };

            const token = localStorage.getItem('pos_token') || '';
            const res = await fetch('api/orders.php?action=checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': idempKey,
                    ...(token ? { 'Authorization': 'Bearer ' + token } : {})
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                this._recoveredCardTxRef = '';
                this._checkoutIdempKey = '';
                document.getElementById('payment-modal').classList.remove('open');
                this.showReceiptModal(data.order, data.items, data.store);

                this.cart = [];
                this.activeOrderId = null;
                this.discount = { type: 'amount', value: 0, reason: '' };
                this.renderCart();
                await this.loadTables();
            } else if (cardTxRef) {
                notify(`${window.cnxT?window.cnxT('js.s_pos.1964548b','⚠️ Thẻ đã trừ tiền (Ref:'):'⚠️ Thẻ đã trừ tiền (Ref:'} ${cardTxRef}${window.cnxT?window.cnxT('js.s_pos.633c4fe5',') nhưng ghi sổ POS lỗi ('):') nhưng ghi sổ POS lỗi ('}${data.message}${window.cnxT?window.cnxT('js.s_pos.165063b2','). Bấm lại nút xác nhận để đồng bộ không trừ thẻ lần 2!'):'). Bấm lại nút xác nhận để đồng bộ không trừ thẻ lần 2!'}`, 'error');
            } else {
                notify(data.message || (window.cnxT?window.cnxT('js.s_pos.319a37b7','Lỗi xử lý thanh toán'):'Lỗi xử lý thanh toán'), 'error');
            }
        } catch (e) {
            console.error('Error during checkout:', e);
            notify((window.cnxT?window.cnxT('js.s_pos.436f68ec','Lỗi kết nối khi thanh toán: '):'Lỗi kết nối khi thanh toán: ') + (e.message || e), 'error');
        } finally {
            this._checkoutInFlight = false;
            if (btnConfirm) btnConfirm.disabled = false;
        }
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
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('pos.js', e) : console.debug('pos.js', e)); }
    },

    // Check cancellation & kitchen notifications periodically
    startNotificationPolling() {
        let _notifInFlight = false;
        const _rawCheck = async () => {
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
                        msgEl.innerText = window.cnxNotifText ? (cnxNotifText(latest).message || latest.message || '') : (latest.message || '');
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
            } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('pos.js', e) : console.debug('pos.js', e)); }
        };

        const check = async () => {
            if (_notifInFlight) return;
            _notifInFlight = true;
            try {
                await _rawCheck();
            } finally {
                _notifInFlight = false;
            }
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
            } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('pos.js', e) : console.debug('pos.js', e)); }
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
                this.customerName = e.target.value.trim() || (window.cnxT?window.cnxT('js.s_pos.53fa7723','Khách vãng lai'):'Khách vãng lai');
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

