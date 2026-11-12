/**
 * Super Admin SaaS Management Controller JavaScript
 * Real-time Module Licensing, Subscription Matrix, Billing & Multi-Tenant Analytics
 */

const SuperAdmin = {
    currentTab: 'dashboard',
    plans: [],
    tenants: [],
    currentTenantInModal: null,
    revenueChartInstance: null,
    pendingTenantLogo: null,
    logoProcessing: null,
    logoProcessingGeneration: 0,
    tenantSaveInProgress: false,

    init() {
        if (!document.getElementById('tab-content-dashboard')) return;
        this.switchTab('dashboard');
        this.loadPlans();
    },

    // --- TAB SWITCHER ---
    switchTab(tabId) {
        this.currentTab = tabId;

        // Update navigation buttons
        document.querySelectorAll('.saas-nav-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-purple-600/20', 'text-white', 'border-l-4', 'border-purple-500');
            btn.classList.add('text-slate-300');
        });

        const activeNavBtn = document.getElementById(`nav-tab-${tabId}`);
        if (activeNavBtn) {
            activeNavBtn.classList.add('active', 'bg-purple-600/20', 'text-white', 'border-l-4', 'border-purple-500');
            activeNavBtn.classList.remove('text-slate-300');
        }

        // Toggle sections
        document.querySelectorAll('.saas-tab-section').forEach(sec => sec.classList.add('hidden'));
        const activeSec = document.getElementById(`tab-content-${tabId}`);
        if (activeSec) {
            activeSec.classList.remove('hidden');
        }

        // Load data based on tab
        if (tabId === 'dashboard') {
            this.loadDashboard();
        } else if (tabId === 'tenants') {
            this.loadTenants();
        } else if (tabId === 'plans') {
            this.loadPlans();
        } else if (tabId === 'billing') {
            this.loadBilling();
        } else if (tabId === 'settings') {
            this.loadSaasSettings();
        }
    },

    // --- 1. DASHBOARD & ANALYTICS ---
    async loadDashboard() {
        try {
            const res = await fetch('api/super_admin.php?action=dashboard_stats');
            const data = await res.json();
            if (!data.success) return;

            const s = data.stats;
            document.getElementById('stat-total-tenants').innerText = s.total_tenants || 0;
            document.getElementById('stat-active-tenants').innerText = s.active_tenants || 0;
            document.getElementById('stat-expiring-tenants').innerText = s.expiring_tenants || 0;
            document.getElementById('stat-revenue-month').innerText = (s.revenue_month || 0).toLocaleString('vi-VN') + ' đ';
            document.getElementById('stat-revenue-year').innerText = 'Năm: ' + (s.revenue_year || 0).toLocaleString('vi-VN') + ' đ';

            const badgeTotal = document.getElementById('badge-total-tenants');
            if (badgeTotal) badgeTotal.innerText = s.total_tenants || 0;

            // Render Urgent Renewals List
            this.renderUrgentRenewals(s.urgent_renewals || []);

            // Render Revenue Chart
            this.renderRevenueChart(s.chart_labels || [], s.chart_data || []);

            // Render Plan Distribution
            this.renderPlanDistribution(s.plan_distribution || []);

        } catch (err) {
            console.error('loadDashboard error:', err);
        }
    },

    renderUrgentRenewals(list) {
        const container = document.getElementById('urgent-tenants-list');
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = `
                <div class="p-4 rounded-xl bg-slate-900/60 border border-white/5 text-center text-xs text-emerald-300 flex items-center justify-center gap-2">
                    <i class="fas fa-circle-check text-emerald-400"></i>
                    <span>Tất cả các cửa hàng đều có hạn bản quyền an toàn (không có quán nào sắp hết hạn trong 7 ngày tới).</span>
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(t => {
            const isExpired = t.days_left < 0;
            const daysText = isExpired ? `Đã quá hạn ${Math.abs(t.days_left)} ngày` : `Còn ${t.days_left} ngày`;
            const badgeClass = isExpired ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

            return `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/80 border border-white/10 hover:border-amber-500/30 transition-all">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono font-bold text-xs">
                            ${t.tenant_code}
                        </div>
                        <div>
                            <div class="font-bold text-white text-xs flex items-center gap-2">
                                <span>${t.store_name}</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono border ${badgeClass}">${daysText}</span>
                            </div>
                            <div class="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>Chủ quán: <b>${t.owner_name}</b></span>
                                <span>&bull;</span>
                                <span>SĐT: <a href="tel:${t.phone}" class="text-sky-400 hover:underline">${t.phone}</a></span>
                                <span>&bull;</span>
                                <span>Gói: <b class="text-purple-300">${t.plan_name}</b></span>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        <a href="tel:${t.phone}" class="btn-glass text-[11px] py-1 px-2.5 text-slate-300 hover:text-white flex items-center gap-1" title="Gọi điện nhắc gia hạn">
                            <i class="fas fa-phone text-emerald-400"></i> Gọi
                        </a>
                        <button type="button" onclick="SuperAdmin.openQuickExtend(${t.id}, '${t.store_name}', '${t.plan_name}', '${t.expire_date}')" class="btn-glass-success text-[11px] py-1 px-3 font-bold flex items-center gap-1 shadow-md shadow-emerald-500/20">
                            <i class="fas fa-calendar-plus"></i> Gia Hạn 1-Click
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderRevenueChart(labels, data) {
        const ctx = document.getElementById('saasRevenueChart');
        if (!ctx) return;

        if (this.revenueChartInstance) {
            this.revenueChartInstance.destroy();
        }

        this.revenueChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Doanh Thu Thu Phí (VNĐ)',
                    data: data,
                    backgroundColor: 'rgba(147, 51, 234, 0.4)',
                    borderColor: 'rgba(168, 85, 247, 1)',
                    borderWidth: 1.5,
                    borderRadius: 8,
                    hoverBackgroundColor: 'rgba(147, 51, 234, 0.7)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (item) => ' Doanh thu: ' + (item.raw || 0).toLocaleString('vi-VN') + ' đ'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 10 },
                            callback: (val) => (val / 1000000) + 'M'
                        }
                    }
                }
            }
        });
    },

    renderPlanDistribution(distribution) {
        const container = document.getElementById('plan-distribution-container');
        if (!container) return;

        if (distribution.length === 0) {
            container.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">Chưa có dữ liệu phân bố</div>';
            return;
        }

        container.innerHTML = distribution.map(p => `
            <div class="space-y-1">
                <div class="flex justify-between text-xs font-semibold">
                    <span class="text-slate-300">${p.plan_name}</span>
                    <span class="text-purple-300 font-mono font-bold">${p.count} quán</span>
                </div>
                <div class="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/5">
                    <div class="bg-gradient-to-r from-purple-500 to-sky-400 h-2 rounded-full" style="width: ${Math.min(100, (p.count * 25))}%"></div>
                </div>
            </div>
        `).join('');
    },

    tenantLogoPath(path) {
        return /^uploads\/tenant-logos\/[a-f0-9]{32}\.(?:png|jpg|webp)$/i.test(path || '') ? path : '';
    },

    // --- 2. TENANTS MANAGEMENT ---
    async loadTenants() {
        const tbody = document.getElementById('tenants-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải dữ liệu...</td></tr>`;
        }

        const kw = document.getElementById('tenant-search-input')?.value || '';
        const status = document.getElementById('tenant-filter-status')?.value || '';

        try {
            const url = `api/super_admin.php?action=get_tenants&kw=${encodeURIComponent(kw)}&status=${encodeURIComponent(status)}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                this.tenants = data.data || [];
                this.renderTenantsTable(this.tenants);
            }
        } catch (err) {
            console.error('loadTenants error:', err);
        }
    },

    filterTenants() {
        clearTimeout(this._filterTimer);
        this._filterTimer = setTimeout(() => this.loadTenants(), 300);
    },

    renderTenantsTable(tenants) {
        const tbody = document.getElementById('tenants-table-body');
        if (!tbody) return;

        if (tenants.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">Không tìm thấy cửa hàng nào phù hợp!</td></tr>`;
            return;
        }

        tbody.innerHTML = tenants.map(t => {
            const isSuspended = t.subscription_status === 'suspended';
            const expireDateFormatted = new Date(t.expire_date).toLocaleDateString('vi-VN');
            const logoPath = this.tenantLogoPath(t.logo_path);

            return `
                <tr class="hover:bg-white/5 transition-all">
                    <td class="py-3 px-4 font-mono font-bold text-sky-400">${t.tenant_code}</td>
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-2">
                            <span class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/95 p-0.5">
                                ${logoPath ? `<img src="${logoPath}" alt="" class="h-full w-full object-contain">` : '<i class="fas fa-store text-sm text-slate-400"></i>'}
                            </span>
                            <div class="min-w-0">
                                <div class="font-bold text-white text-xs">${t.store_name}</div>
                                <div class="text-[11px] text-slate-400 truncate max-w-xs">${t.address || 'Chưa cập nhật địa chỉ'}</div>
                                ${t.provision_state ? `<div class="text-[10px] ${t.provision_state === 'ready' ? 'text-emerald-300' : 'text-amber-300'}">MySQL: ${t.provision_state === 'ready' ? 'Đã cấp phát' : 'Chưa hoàn tất — kiểm tra máy chủ'}</div>` : ''}
                                ${t.package_state ? `<div class="text-[10px] ${t.package_state === 'ready' ? 'text-emerald-300' : 'text-amber-300'}">Gói quán: ${t.package_state === 'ready' ? 'Đã tạo' : 'Chưa hoàn tất — kiểm tra máy chủ'}</div>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="text-slate-200 font-semibold">${t.owner_name}</div>
                        <div class="text-[11px] text-sky-400 font-mono">${t.phone}</div>
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            ${t.plan_name}
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        <div class="font-mono text-xs ${t.days_left <= 7 ? 'text-amber-400 font-bold' : 'text-slate-300'}">${expireDateFormatted}</div>
                        <div class="text-[10px] ${t.days_left < 0 ? 'text-rose-400 font-bold' : (t.days_left <= 7 ? 'text-amber-400' : 'text-slate-500')}">
                            ${t.days_left < 0 ? `Quá hạn ${Math.abs(t.days_left)} ngày` : `Còn ${t.days_left} ngày`}
                        </div>
                    </td>
                    <td class="py-3 px-4 text-center">
                        <button type="button" onclick="SuperAdmin.openModulePermissions(${t.id})" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600/30 to-sky-600/30 hover:from-purple-600/50 hover:to-sky-600/50 text-purple-200 border border-purple-500/30 text-[11px] font-bold transition-all shadow-sm" title="Bấm để Cấp quyền Bật/Tắt module">
                            <i class="fas fa-sliders text-amber-400"></i>
                            <span>${t.active_module_count}/${t.total_catalog_count} ON</span>
                        </button>
                    </td>
                    <td class="py-3 px-4 text-center">
                        <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-${t.badge_color}-500/20 text-${t.badge_color}-300 border-${t.badge_color}-500/30">
                            ${t.badge_status}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-right">
                        <div class="inline-flex items-center gap-1.5">
                            ${t.package_state && t.package_state !== 'ready' && t.provision_state === 'ready' ? `<button type="button" onclick="SuperAdmin.retryStorePackage(${Number(t.id)})" class="btn-glass text-[11px] py-1 px-2 text-amber-300" title="Thử tạo lại gói sau khi kiểm tra máy chủ">Tạo lại gói</button>` : ''}
                            <button type="button" onclick="SuperAdmin.openQuickExtend(${t.id}, '${t.store_name}', '${t.plan_name}', '${t.expire_date}')" class="btn-glass text-[11px] py-1 px-2.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1" title="Gia hạn gói">
                                <i class="fas fa-calendar-plus"></i> <span>Gia Hạn</span>
                            </button>
                            <button type="button" onclick="SuperAdmin.toggleTenantStatus(${t.id}, '${isSuspended ? 'active' : 'suspended'}')" class="btn-glass text-[11px] py-1 px-2 text-${isSuspended ? 'emerald' : 'rose'}-400 hover:text-white" title="${isSuspended ? 'Mở khóa cửa hàng' : 'Tạm khóa cửa hàng'}">
                                <i class="fas fa-${isSuspended ? 'unlock' : 'lock'}"></i>
                            </button>
                            <button type="button" onclick="SuperAdmin.openLicense(${t.id})" class="btn-glass text-[11px] py-1 px-2 text-sky-300 hover:text-white" title="Giấy phép số / License Key / Mã máy">
                                <i class="fas fa-key"></i>
                            </button>
                            <button type="button" onclick="SuperAdmin.editTenant(${t.id})" class="btn-glass text-[11px] py-1 px-2 text-slate-300 hover:text-white" title="Chỉnh sửa thông tin">
                                <i class="fas fa-pen"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async retryStorePackage(tenantId) {
        if (!confirm('Chỉ thử lại sau khi kiểm tra thư mục gói và nhật ký trên máy chủ. Tiếp tục?')) return;
        try {
            const res = await fetch('api/super_admin.php?action=retry_store_package', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenantId })
            });
            const data = await res.json();
            alert(data.message || 'Không thể tạo gói quán.');
            await this.loadTenants();
        } catch (err) {
            alert('Lỗi kết nối máy chủ; kiểm tra trạng thái trước khi thử lại.');
        }
    },

    // --- 3. MODULE PERMISSIONS MATRIX (ON / OFF SWITCHES) ---
    async openModulePermissions(tenantId) {
        try {
            const res = await fetch(`api/super_admin.php?action=get_tenant_detail&id=${tenantId}`);
            const data = await res.json();
            if (!data.success) {
                alert(data.message || 'Lỗi tải dữ liệu');
                return;
            }

            this.currentTenantInModal = data.tenant;
            const t = data.tenant;

            document.getElementById('modal-perm-store-name').innerText = t.store_name;
            document.getElementById('modal-perm-code').innerText = t.tenant_code;
            document.getElementById('modal-perm-plan').innerText = t.plan_name;
            document.getElementById('modal-perm-expire').innerText = new Date(t.expire_date).toLocaleDateString('vi-VN');

            this.renderModuleMatrix(tenantId, data.modules || []);
            this.openModal('modal-module-permissions');

        } catch (err) {
            console.error('openModulePermissions error:', err);
        }
    },

    renderModuleMatrix(tenantId, modules) {
        const container = document.getElementById('modal-perm-matrix-container');
        if (!container) return;

        container.innerHTML = modules.map(m => `
            <div id="module-row-${m.code}" class="sa-module-row ${m.is_enabled ? 'is-enabled' : 'is-disabled'} flex items-center justify-between p-3.5 rounded-2xl">
                <div class="flex items-center gap-3.5 pr-3">
                    <div class="w-10 h-10 rounded-xl bg-${m.badge_color}-500/20 border border-${m.badge_color}-500/30 flex items-center justify-center text-${m.badge_color}-400 text-base shrink-0">
                        <i class="fas ${m.icon}"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-xs text-white">${m.name}</span>
                            <span class="px-2 py-0.2 rounded-full text-[9px] font-bold uppercase bg-${m.badge_color}-500/20 text-${m.badge_color}-300 border border-${m.badge_color}-500/30">
                                ${m.badge}
                            </span>
                            ${m.addon ? `<span class="text-[9px] font-mono font-bold text-amber-300">+${(m.price_month || 0).toLocaleString('vi-VN')} đ/tháng</span>` : ''}
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5 leading-snug">${m.desc}</div>
                    </div>
                </div>

                <div class="shrink-0 flex items-center gap-2">
                    <span id="badge-toggle-label-${m.code}" class="text-[11px] font-mono font-bold ${m.is_enabled ? 'text-emerald-400' : 'text-slate-500'}">
                        ${m.is_enabled ? 'ON' : 'OFF'}
                    </span>
                    <label class="sa-module-switch" title="${m.required ? 'Module bắt buộc' : (m.is_enabled ? 'Tắt module' : 'Bật module')}">
                        <input id="module-switch-${m.code}" type="checkbox" role="switch" aria-label="Bật hoặc tắt ${m.name}" onchange="SuperAdmin.toggleSingleModule(${tenantId}, '${m.code}', this.checked, this)" class="sa-module-switch__input" ${m.is_enabled ? 'checked' : ''} ${m.required ? 'disabled' : ''} />
                        <span class="sa-module-switch__track" aria-hidden="true"><span class="sa-module-switch__thumb"></span></span>
                    </label>
                </div>
            </div>
        `).join('');
    },

    setModuleToggleState(moduleCode, isEnabled) {
        const label = document.getElementById(`badge-toggle-label-${moduleCode}`);
        if (label) {
            label.textContent = isEnabled ? 'ON' : 'OFF';
            label.className = `text-[11px] font-mono font-bold ${isEnabled ? 'text-emerald-400' : 'text-slate-500'}`;
        }

        const switchInput = document.getElementById(`module-switch-${moduleCode}`);
        if (switchInput && switchInput.parentElement) {
            switchInput.parentElement.title = isEnabled ? 'Tắt module' : 'Bật module';
        }

        const row = document.getElementById(`module-row-${moduleCode}`);
        if (row) {
            row.classList.toggle('is-enabled', isEnabled);
            row.classList.toggle('is-disabled', !isEnabled);
        }
    },

    async toggleSingleModule(tenantId, moduleCode, isChecked, input) {
        const switchInput = input || document.getElementById(`module-switch-${moduleCode}`);
        if (switchInput) switchInput.disabled = true;
        this.setModuleToggleState(moduleCode, isChecked);

        try {
            const res = await fetch('api/super_admin.php?action=toggle_module', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    module_code: moduleCode,
                    enabled: isChecked ? 1 : 0
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Không thể cập nhật quyền module.');
            }
        } catch (err) {
            console.error('toggleSingleModule error:', err);
            if (switchInput) switchInput.checked = !isChecked;
            this.setModuleToggleState(moduleCode, !isChecked);
            alert(err.message || 'Không thể kết nối để cập nhật quyền module.');
        } finally {
            if (switchInput) switchInput.disabled = false;
        }
    },

    async setAllModules(mode) {
        if (!this.currentTenantInModal) return;
        const tenantId = this.currentTenantInModal.id;

        try {
            const res = await fetch('api/super_admin.php?action=set_all_modules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenantId, mode: mode })
            });
            const data = await res.json();
            if (data.success) {
                // Refresh modal
                this.openModulePermissions(tenantId);
                this.loadTenants();
            } else {
                alert(data.message);
            }
        } catch (err) {
            console.error('setAllModules error:', err);
        }
    },

    // --- 4. QUICK EXTEND MODAL & BILLING ---
    openQuickExtend(tenantId, storeName, planName, currentExpire) {
        document.getElementById('extend-tenant-id').value = tenantId;
        document.getElementById('extend-store-name').innerText = storeName;
        document.getElementById('extend-plan-name').innerText = planName;
        document.getElementById('extend-current-expire').innerText = new Date(currentExpire).toLocaleDateString('vi-VN');

        this.calculateExtendFee();
        this.openModal('modal-quick-extend');
    },

    calculateExtendFee() {
        const duration = parseInt(document.getElementById('extend-duration')?.value || 12);
        const amountInput = document.getElementById('extend-amount');
        if (!amountInput) return;

        // Bảng giá mặc định
        let fee = 3990000; // 1 năm Pro Max
        if (duration === 1) fee = 399000;
        else if (duration === 3) fee = 1100000;
        else if (duration === 6) fee = 2100000;
        else if (duration === 12) fee = 3990000;
        else if (duration >= 999) fee = 9990000;

        amountInput.value = fee;
    },

    async submitQuickExtend(e) {
        e.preventDefault();
        const payload = {
            tenant_id: parseInt(document.getElementById('extend-tenant-id').value),
            duration_months: parseInt(document.getElementById('extend-duration').value),
            amount: parseFloat(document.getElementById('extend-amount').value),
            payment_method: document.getElementById('extend-payment-method').value,
            note: document.getElementById('extend-note').value
        };

        try {
            const res = await fetch('api/super_admin.php?action=quick_extend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.closeModal('modal-quick-extend');
                this.loadTenants();
                this.loadDashboard();
            } else {
                alert(data.message || 'Lỗi gia hạn');
            }
        } catch (err) {
            alert('Lỗi kết nối máy chủ');
        }
    },

    // --- GIẤY PHÉP SỐ (License Key, mã máy, khóa ký) ---
    async licApi(action, body) {
        const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
        const res = await fetch('api/super_admin.php?action=' + action, opt);
        return res.json();
    },

    async openLicense(tenantId) {
        const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        try {
            const [ov, tl] = await Promise.all([
                this.licApi('license_overview'),
                this.licApi('get_tenant_license&tenant_id=' + tenantId)
            ]);
            if (!tl.success) { alert(tl.message || 'Lỗi tải giấy phép'); return; }
            const o = ov.data || {}, d = tl.data;
            let box = document.getElementById('license-modal');
            if (box) box.remove();
            box = document.createElement('div');
            box.id = 'license-modal';
            box.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,6,23,.8);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px)';
            const row = (k, v) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed rgba(255,255,255,.07)"><span style="color:#94a3b8">${k}</span><b style="font-family:ui-monospace,Consolas,monospace;text-align:right;word-break:break-all">${v}</b></div>`;
            const btn = (id, txt, grad) => `<button id="${id}" style="padding:9px 14px;border-radius:10px;border:0;cursor:pointer;color:#fff;font-weight:700;font-size:12px;background:${grad}">${txt}</button>`;
            box.innerHTML = `
              <div style="width:100%;max-width:520px;max-height:92vh;overflow:auto;padding:24px;border-radius:20px;background:#0f172a;border:1px solid rgba(168,85,247,.35);color:#e2e8f0;font-size:13px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                  <b style="font-size:16px"><i class="fas fa-key" style="color:#c084fc"></i> Giấy phép số - ${esc(d.store_name)}</b>
                  <button id="lic-close" style="background:none;border:0;color:#94a3b8;font-size:20px;cursor:pointer">&times;</button>
                </div>
                ${!o.has_keys ? `<div style="padding:12px;border-radius:12px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#fcd34d;margin-bottom:12px">
                    Chưa có <b>cặp khóa Ed25519</b>. Hãy tạo để ký giấy phép mới.${o.has_legacy_keys ? '<br>Khóa RSA cũ vẫn được giữ để xác minh giấy phép đã phát hành.' : ''}${!o.sodium ? '<br><b>Bật extension=sodium trong php.ini trước khi tạo khóa.</b>' : ''}<br><br>${btn('lic-init','Tạo khóa ký Ed25519','linear-gradient(90deg,#d97706,#f59e0b)')}</div>` : ''}
                ${row('License Key', `<span id="lic-key">${esc(d.license_key)}</span>`)}
                ${row('Mã máy đã gắn', esc(d.machine_id || '(chưa kích hoạt)'))}
                ${row('Tên máy', esc(d.machine_name || '—'))}
                ${row('Gắn máy lúc', esc(d.machine_bound_at || '—'))}
                ${row('Kiểm tra gần nhất', esc(d.last_check_at || 'Chưa lần nào'))}
                ${row('IP gần nhất', esc(d.last_check_ip || '—'))}
                ${row('Phiên bản app', esc(d.last_app_version || '—'))}
                ${row('Vân tay khóa công khai', esc(o.fingerprint || '—'))}
                ${row('Thuật toán ký mới', esc(o.algorithm || '—'))}
                ${!o.sodium ? '<div style="padding:10px;border-radius:10px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#fcd34d;margin-top:10px">PHP chưa bật extension sodium; không thể ký/xác minh Ed25519.</div>' : ''}
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">
                  ${btn('lic-copy','Sao chép key','linear-gradient(90deg,#2563eb,#0ea5e9)')}
                  ${btn('lic-reset','Gỡ ràng buộc máy','linear-gradient(90deg,#7c3aed,#9333ea)')}
                  ${btn('lic-regen','Cấp key mới (thu hồi key cũ)','linear-gradient(90deg,#e11d48,#f43f5e)')}
                </div>
                <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)">
                  <label style="display:block;color:#94a3b8;margin-bottom:6px">Ân hạn offline (ngày) - quán mất mạng vẫn dùng được trong thời gian này</label>
                  <div style="display:flex;gap:8px">
                    <input id="lic-grace" type="number" min="0" max="90" value="${esc(o.grace_days ?? 7)}" style="width:100px;padding:8px 10px;border-radius:10px;background:#020617;border:1px solid rgba(148,163,184,.3);color:#fff">
                    ${btn('lic-grace-save','Lưu','linear-gradient(90deg,#059669,#10b981)')}
                  </div>
                </div>
              </div>`;
            document.body.appendChild(box);
            const close = () => box.remove();
            box.addEventListener('click', e => { if (e.target === box) close(); });
            box.querySelector('#lic-close').onclick = close;
            box.querySelector('#lic-copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(d.license_key); alert('Đã sao chép: ' + d.license_key); };
            const init = box.querySelector('#lic-init');
            if (init) init.onclick = async () => { const r = await this.licApi('license_init_keys', {}); alert(r.success ? 'Đã tạo khóa. Vân tay: ' + r.fingerprint : r.message); if (r.success) { close(); this.openLicense(tenantId); } };
            box.querySelector('#lic-reset').onclick = async () => {
                if (!confirm('Gỡ ràng buộc máy? Quán sẽ kích hoạt lại được trên máy mới.')) return;
                const r = await this.licApi('reset_machine', { tenant_id: tenantId }); alert(r.message); close(); this.openLicense(tenantId);
            };
            box.querySelector('#lic-regen').onclick = async () => {
                if (!confirm('Cấp License Key MỚI? Key cũ sẽ bị thu hồi và quán phải nhập key mới.')) return;
                const r = await this.licApi('regenerate_license_key', { tenant_id: tenantId }); alert(r.message + (r.license_key ? '\n' + r.license_key : '')); close(); this.openLicense(tenantId);
            };
            box.querySelector('#lic-grace-save').onclick = async () => {
                const r = await this.licApi('license_save_grace', { grace_days: parseInt(box.querySelector('#lic-grace').value, 10) }); alert(r.message);
            };
        } catch (err) {
            alert('Lỗi kết nối máy chủ');
        }
    },
    async toggleTenantStatus(tenantId, newStatus) {
        const confirmMsg = newStatus === 'suspended' 
            ? 'Bạn có chắc chắn muốn TẠM KHÓA cửa hàng này? Khi bị khóa, khách hàng sẽ không thể truy cập các module bán hàng!' 
            : 'Mở khóa và cho phép cửa hàng hoạt động bình thường?';

        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch('api/super_admin.php?action=toggle_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenantId, status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                this.loadTenants();
                this.loadDashboard();
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert('Lỗi máy chủ');
        }
    },

    // --- 5. ADD / EDIT TENANT FORM ---
    openNewTenantModal() {
        this.logoProcessingGeneration++;
        this.logoProcessing = null;
        this.pendingTenantLogo = null;
        document.getElementById('form-tenant-logo').disabled = false;
        document.getElementById('tenant-modal-title').innerText = 'Thêm Cửa Hàng / Khách Hàng Mới';
        document.getElementById('form-tenant-id').value = '0';
        const code = document.getElementById('form-tenant-code');
        code.value = '';
        code.readOnly = false;
        if (code.dataset.central === '1') {
            code.required = true;
            code.pattern = '[a-z0-9]+(?:-[a-z0-9]+)*';
            code.maxLength = 32;
        }
        document.getElementById('form-tenant-store-name').value = '';
        document.getElementById('form-tenant-owner-name').value = '';
        document.getElementById('form-tenant-phone').value = '';
        document.getElementById('form-tenant-email').value = '';
        document.getElementById('form-tenant-address').value = '';
        document.getElementById('form-tenant-note').value = '';
        document.getElementById('form-tenant-logo').value = '';
        document.getElementById('form-tenant-remove-logo').checked = false;
        this.setTenantLogoPreview('');

        // Mặc định hết hạn 1 năm sau
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        document.getElementById('form-tenant-expire-date').value = nextYear.toISOString().split('T')[0];

        this.populatePlanSelect();
        this.openModal('modal-tenant-form');
    },

    editTenant(id) {
        const t = this.tenants.find(x => x.id === id);
        if (!t) return;

        this.logoProcessingGeneration++;
        this.logoProcessing = null;
        this.pendingTenantLogo = null;
        document.getElementById('form-tenant-logo').disabled = false;
        document.getElementById('tenant-modal-title').innerText = `Chỉnh Sửa Thông Tin: ${t.store_name}`;
        document.getElementById('form-tenant-id').value = t.id;
        const code = document.getElementById('form-tenant-code');
        code.value = t.tenant_code;
        code.readOnly = true;
        code.required = false;
        code.removeAttribute('pattern');
        document.getElementById('form-tenant-store-name').value = t.store_name;
        document.getElementById('form-tenant-owner-name').value = t.owner_name;
        document.getElementById('form-tenant-phone').value = t.phone;
        document.getElementById('form-tenant-email').value = t.email || '';
        document.getElementById('form-tenant-address').value = t.address || '';
        document.getElementById('form-tenant-expire-date').value = t.expire_date;
        document.getElementById('form-tenant-note').value = t.note || '';
        document.getElementById('form-tenant-logo').value = '';
        document.getElementById('form-tenant-remove-logo').checked = false;
        this.setTenantLogoPreview(this.tenantLogoPath(t.logo_path));

        this.populatePlanSelect(t.plan_id);
        this.openModal('modal-tenant-form');
    },

    populatePlanSelect(selectedPlanId = 1) {
        const select = document.getElementById('form-tenant-plan');
        if (!select) return;

        select.innerHTML = this.plans.map(p => `
            <option value="${p.id}" ${p.id === selectedPlanId ? 'selected' : ''}>
                ${p.name} (${(p.price_year || 0).toLocaleString('vi-VN')} đ/năm)
            </option>
        `).join('');
    },

    setTenantLogoPreview(src) {
        const image = document.getElementById('form-tenant-logo-preview');
        const placeholder = document.getElementById('form-tenant-logo-placeholder');
        if (!image || !placeholder) return;
        image.classList.toggle('hidden', !src);
        placeholder.classList.toggle('hidden', Boolean(src));
        if (src) image.src = src;
        else image.removeAttribute('src');
    },

    async previewTenantLogo(input) {
        const file = input.files?.[0];
        if (!file) return;
        const generation = ++this.logoProcessingGeneration;
        input.disabled = true;
        this.pendingTenantLogo = null;
        this.logoProcessing = ImageProcessor.processFile(file, 'logo');
        try {
            const optimizedLogo = await this.logoProcessing;
            if (generation !== this.logoProcessingGeneration) return;
            this.pendingTenantLogo = optimizedLogo;
            document.getElementById('form-tenant-remove-logo').checked = false;
            const previewUrl = URL.createObjectURL(this.pendingTenantLogo);
            const image = document.getElementById('form-tenant-logo-preview');
            image.onload = () => URL.revokeObjectURL(previewUrl);
            image.onerror = () => {
                URL.revokeObjectURL(previewUrl);
                this.setTenantLogoPreview('');
            };
            this.setTenantLogoPreview(previewUrl);
        } catch (error) {
            if (generation !== this.logoProcessingGeneration) return;
            this.pendingTenantLogo = null;
            input.value = '';
            alert(error.message || 'Không thể chuẩn hóa logo cửa hàng.');
        } finally {
            if (generation === this.logoProcessingGeneration) {
                this.logoProcessing = null;
                input.disabled = false;
            }
        }
    },

    clearTenantLogo() {
        this.logoProcessingGeneration++;
        this.logoProcessing = null;
        this.pendingTenantLogo = null;
        document.getElementById('form-tenant-logo').disabled = false;
        const removeLogo = document.getElementById('form-tenant-remove-logo').checked;
        if (removeLogo) {
            document.getElementById('form-tenant-logo').value = '';
            this.setTenantLogoPreview('');
            return;
        }

        const tenantId = parseInt(document.getElementById('form-tenant-id').value, 10);
        const tenant = this.tenants.find(item => Number(item.id) === tenantId);
        this.setTenantLogoPreview(this.tenantLogoPath(tenant?.logo_path));
    },

    async submitTenantForm(e) {
        e.preventDefault();
        if (this.tenantSaveInProgress) return;
        this.tenantSaveInProgress = true;
        const submitButton = e.currentTarget.querySelector('button[type="submit"]');
        const submitLabel = submitButton.querySelector('span');
        const originalLabel = submitLabel.textContent;
        submitButton.disabled = true;
        submitLabel.textContent = 'Đang lưu, vui lòng chờ...';
        const payload = {
            id: parseInt(document.getElementById('form-tenant-id').value),
            tenant_code: document.getElementById('form-tenant-code').value.trim(),
            store_name: document.getElementById('form-tenant-store-name').value.trim(),
            owner_name: document.getElementById('form-tenant-owner-name').value.trim(),
            phone: document.getElementById('form-tenant-phone').value.trim(),
            email: document.getElementById('form-tenant-email').value.trim(),
            address: document.getElementById('form-tenant-address').value.trim(),
            plan_id: parseInt(document.getElementById('form-tenant-plan').value),
            expire_date: document.getElementById('form-tenant-expire-date').value,
            note: document.getElementById('form-tenant-note').value.trim()
        };

        try {
            if (this.logoProcessing) await this.logoProcessing.catch(() => null);
            const formData = new FormData();
            Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
            const logoFile = this.pendingTenantLogo;
            if (logoFile) formData.append('store_logo', logoFile);
            if (document.getElementById('form-tenant-remove-logo').checked) formData.append('remove_logo', '1');

            const res = await fetch('api/super_admin.php?action=save_tenant', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                this.pendingTenantLogo = null;
                alert(data.message);
                this.closeModal('modal-tenant-form');
                this.loadTenants();
                this.loadDashboard();
            } else {
                alert(data.message || 'Lỗi lưu thông tin');
                if (data.tenant_saved) {
                    this.closeModal('modal-tenant-form');
                    this.loadTenants();
                    this.loadDashboard();
                }
            }
        } catch (err) {
            alert('Không nhận được kết quả từ máy chủ. Hãy kiểm tra danh sách cửa hàng và trạng thái cấp phát trước khi thử lại.');
        } finally {
            this.tenantSaveInProgress = false;
            submitButton.disabled = false;
            submitLabel.textContent = originalLabel;
        }
    },

    // --- 6. PLANS MANAGEMENT ---
    async loadPlans() {
        try {
            const res = await fetch('api/super_admin.php?action=get_plans');
            const data = await res.json();
            if (data.success) {
                this.plans = data.data || [];
                this.renderPlansGrid(this.plans);
            }
        } catch (err) {
            console.error('loadPlans error:', err);
        }
    },

    renderPlansGrid(plans) {
        const container = document.getElementById('plans-grid-container');
        if (!container) return;

        container.innerHTML = plans.map(p => `
            <div class="liquid-glass p-5 rounded-3xl border border-${p.badge_color}-500/30 flex flex-col justify-between space-y-4 shadow-xl hover:border-${p.badge_color}-500/60 transition-all">
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-${p.badge_color}-500/20 text-${p.badge_color}-300 border border-${p.badge_color}-500/30 uppercase">
                            ${p.plan_code}
                        </span>
                        <span class="text-xs font-semibold text-slate-400">${p.module_count} Modules ON</span>
                    </div>

                    <div>
                        <h3 class="text-base font-bold text-white">${p.name}</h3>
                        <p class="text-xs text-slate-400 mt-1 leading-relaxed">${p.description || ''}</p>
                    </div>

                    <div class="pt-2 border-t border-white/10 space-y-1">
                        <div class="flex items-baseline gap-1">
                            <span class="text-2xl font-black font-mono text-${p.badge_color}-400">
                                ${(p.price_month || 0).toLocaleString('vi-VN')} đ
                            </span>
                            <span class="text-xs text-slate-400">/ tháng</span>
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono">
                            Hoặc <b>${(p.price_year || 0).toLocaleString('vi-VN')} đ</b> / năm (Tiết kiệm 20%)
                        </div>
                    </div>
                </div>

                <div class="pt-3 border-t border-white/10">
                    <div class="text-[11px] text-slate-400 mb-2 font-semibold">Bao gồm các module:</div>
                    <div class="flex flex-wrap gap-1">
                        ${p.modules.map(m => `
                            <span class="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-white/10 text-slate-300">
                                ${m}
                            </span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    },

    // --- 7. BILLING & INVOICES ---
    async loadBilling() {
        const tbody = document.getElementById('invoices-table-body');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải hóa đơn...</td></tr>`;

        try {
            const res = await fetch('api/super_admin.php?action=get_invoices');
            const data = await res.json();
            if (data.success) {
                const invoices = data.data || [];
                if (invoices.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-400">Chưa có giao dịch thu phí nào.</td></tr>`;
                    return;
                }

                tbody.innerHTML = invoices.map(iv => `
                    <tr class="hover:bg-white/5 transition-all">
                        <td class="py-3 px-4 font-mono font-bold text-emerald-400">${iv.invoice_code}</td>
                        <td class="py-3 px-4 font-bold text-white">${iv.store_name}</td>
                        <td class="py-3 px-4 text-purple-300">${iv.plan_name}</td>
                        <td class="py-3 px-4 font-mono">${iv.duration_months} tháng</td>
                        <td class="py-3 px-4 font-mono font-bold text-emerald-400 text-sm">
                            ${(parseFloat(iv.amount) || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td class="py-3 px-4 text-slate-300 uppercase text-[11px] font-mono">${iv.payment_method}</td>
                        <td class="py-3 px-4 text-slate-400 font-mono text-[11px]">${iv.paid_at}</td>
                        <td class="py-3 px-4 text-slate-300 font-medium">${iv.collector_name}</td>
                        <td class="py-3 px-4 text-center">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Đã Thu
                            </span>
                        </td>
                        <td class="py-3 px-4 text-right">
                            <button type="button" onclick="SuperAdmin.printInvoiceModal(${JSON.stringify(iv).replace(/"/g, '&quot;')})" class="btn-glass text-[11px] py-1 px-2.5 text-slate-300 hover:text-white" title="In phiếu xác nhận">
                                <i class="fas fa-print"></i> In
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            console.error('loadBilling error:', err);
        }
    },

    printInvoiceModal(iv) {
        const content = document.getElementById('printable-receipt-content');
        if (!content) return;

        content.innerHTML = `
            <div class="text-center pb-3 border-b border-dashed border-slate-300">
                <div class="font-black text-sm uppercase">PHIẾU XÁC NHẬN BẢN QUYỀN SALEAPP</div>
                <div class="text-[10px] text-slate-500 font-mono">Mã: ${iv.invoice_code}</div>
            </div>
            <div class="space-y-1.5 pt-2 text-xs">
                <div class="flex justify-between">
                    <span class="text-slate-500">Khách Hàng:</span>
                    <span class="font-bold">${iv.store_name}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500">Gói Dịch Vụ:</span>
                    <span class="font-bold text-purple-700">${iv.plan_name}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500">Thời Gian Sử Dụng:</span>
                    <span class="font-mono">${iv.duration_months} tháng</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500">Hiệu Lực:</span>
                    <span class="font-mono">${iv.start_date} &rarr; ${iv.expire_date}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500">Phương Thức:</span>
                    <span class="uppercase font-mono">${iv.payment_method}</span>
                </div>
                <div class="flex justify-between pt-2 border-t border-slate-300 text-sm font-black">
                    <span>TỔNG TIỀN THU:</span>
                    <span class="text-emerald-700 font-mono">${(parseFloat(iv.amount) || 0).toLocaleString('vi-VN')} VNĐ</span>
                </div>
            </div>
            <div class="text-center text-[10px] text-slate-500 pt-3 border-t border-dashed border-slate-300 italic">
                Cảm ơn Quý khách đã tin dùng phần mềm quản lý bán hàng SaleApp!
            </div>
        `;

        this.openModal('modal-print-invoice');
    },

    // --- 8. SAAS SETTINGS & VIETQR ---
    async loadSaasSettings() {
        this.updateSaasQrPreview();
        if (document.getElementById('cfg-package-storage')) this.loadPackageStorage();
        try {
            const res = await fetch('api/super_admin.php?action=get_saas_settings');
            const data = await res.json();
            if (data.success && data.data) {
                const s = data.data;
                if (s.saas_app_name) document.getElementById('cfg-saas-app-name').value = s.saas_app_name;
                if ('saas_subtitle' in s) document.getElementById('cfg-saas-subtitle').value = s.saas_subtitle || '';
                if (s.saas_hotline) document.getElementById('cfg-saas-hotline').value = s.saas_hotline;
                if ('saas_email' in s) document.getElementById('cfg-saas-email').value = s.saas_email || '';
                if (s.saas_bank_id) document.getElementById('cfg-saas-bank-id').value = s.saas_bank_id;
                if (s.saas_bank_account_no) document.getElementById('cfg-saas-bank-acc').value = s.saas_bank_account_no;
                if (s.saas_bank_account_name) document.getElementById('cfg-saas-bank-name').value = s.saas_bank_account_name;
                if (s.saas_warning_days) document.getElementById('cfg-saas-warning-days').value = s.saas_warning_days;
                if (s.saas_grace_period_days) document.getElementById('cfg-saas-grace-days').value = s.saas_grace_period_days;
                this.updateSaasQrPreview();
            } else {
                this.showSaasSettingsMessage(data.message || 'Không tải được cấu hình SaaS.', false);
            }
        } catch (err) {
            console.error('loadSaasSettings error:', err);
            this.showSaasSettingsMessage('Không thể kết nối để tải cấu hình SaaS.', false);
        }
    },

    async loadPackageStorage() {
        const field = document.getElementById('cfg-package-storage');
        const button = document.getElementById('cfg-package-storage-save');
        if (!field || !button) return;
        try {
            const response = await fetch('api/super_admin.php?action=get_package_storage');
            const data = await response.json();
            if (!data.success || typeof data.path !== 'string') throw new Error(data.message || 'Không tải được thư mục gói.');
            field.value = data.path;
            field.disabled = false;
            button.disabled = false;
        } catch (error) {
            console.error('loadPackageStorage error:', error);
            this.showSaasSettingsMessage('Không thể tải thư mục gói. Kiểm tra cấu hình và nhật ký máy chủ.', false);
        }
    },

    async savePackageStorage(event) {
        event.preventDefault();
        const field = document.getElementById('cfg-package-storage');
        const button = document.getElementById('cfg-package-storage-save');
        if (!field || !button) return;
        button.disabled = true;
        try {
            const response = await fetch('api/super_admin.php?action=save_package_storage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: field.value })
            });
            const data = await response.json();
            if (data.success && typeof data.path === 'string') field.value = data.path;
            this.showSaasSettingsMessage(data.message || 'Không thể lưu thư mục gói.', !!data.success);
        } catch (error) {
            console.error('savePackageStorage error:', error);
            this.showSaasSettingsMessage('Lỗi kết nối khi lưu thư mục gói; kiểm tra lại trước khi thử.', false);
        } finally {
            button.disabled = false;
        }
    },

    updateSaasQrPreview() {
        const bankId = document.getElementById('cfg-saas-bank-id')?.value.trim().toUpperCase() || '';
        const accountNo = document.getElementById('cfg-saas-bank-acc')?.value.trim() || '';
        const accountName = document.getElementById('cfg-saas-bank-name')?.value.trim().toUpperCase() || '';
        const image = document.getElementById('cfg-saas-qr-image');
        const loading = document.getElementById('cfg-saas-qr-loading');
        const error = document.getElementById('cfg-saas-qr-error');
        const namePreview = document.getElementById('cfg-saas-qr-account-name');
        const detailsPreview = document.getElementById('cfg-saas-qr-account-details');
        if (!image || !loading || !error) return;

        if (namePreview) namePreview.textContent = accountName || 'Chưa nhập tên chủ tài khoản';
        if (detailsPreview) detailsPreview.textContent = [bankId || 'Chưa chọn ngân hàng', accountNo || 'Chưa nhập số tài khoản'].join(' · ');
        image.classList.add('hidden');

        if (!bankId || !accountNo || !accountName) {
            image.removeAttribute('src');
            loading.classList.add('hidden');
            error.classList.remove('hidden');
            return;
        }

        error.classList.add('hidden');
        loading.classList.remove('hidden');
        const params = new URLSearchParams({
            amount: '0',
            addInfo: 'GIA HAN SALEAPP',
            accountName
        });
        image.src = `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(accountNo)}-compact2.png?${params.toString()}`;
    },

    onSaasQrLoaded() {
        const image = document.getElementById('cfg-saas-qr-image');
        if (!image || !image.getAttribute('src')) return;
        image.classList.remove('hidden');
        document.getElementById('cfg-saas-qr-loading')?.classList.add('hidden');
        document.getElementById('cfg-saas-qr-error')?.classList.add('hidden');
    },

    onSaasQrError() {
        document.getElementById('cfg-saas-qr-image')?.classList.add('hidden');
        document.getElementById('cfg-saas-qr-loading')?.classList.add('hidden');
        document.getElementById('cfg-saas-qr-error')?.classList.remove('hidden');
    },

    async copySaasBankAccount() {
        const accountNo = document.getElementById('cfg-saas-bank-acc')?.value.trim() || '';
        if (!accountNo) {
            this.showSaasSettingsMessage('Vui lòng nhập số tài khoản trước khi sao chép.', false);
            return;
        }

        try {
            await navigator.clipboard.writeText(accountNo);
            this.showSaasSettingsMessage('Đã sao chép số tài khoản.', true);
        } catch (err) {
            console.error('copySaasBankAccount error:', err);
            this.showSaasSettingsMessage('Không thể sao chép tự động. Vui lòng chọn và sao chép số tài khoản.', false);
        }
    },

    showSaasSettingsMessage(message, success) {
        const alertBox = document.getElementById('saas-settings-alert');
        if (!alertBox) return;
        alertBox.className = 'p-3.5 rounded-2xl text-sm font-semibold ' +
            (success ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200' : 'bg-rose-950/80 border border-rose-500/40 text-rose-200');
        alertBox.textContent = message;
        alertBox.classList.remove('hidden');
        window.clearTimeout(this.saasSettingsAlertTimer);
        this.saasSettingsAlertTimer = window.setTimeout(() => alertBox.classList.add('hidden'), 5000);
    },

    async saveSaasSettings(e) {
        e.preventDefault();

        const payload = {
            saas_app_name: document.getElementById('cfg-saas-app-name').value.trim(),
            saas_subtitle: document.getElementById('cfg-saas-subtitle').value.trim(),
            saas_hotline: document.getElementById('cfg-saas-hotline').value.trim(),
            saas_email: document.getElementById('cfg-saas-email').value.trim(),
            saas_bank_id: document.getElementById('cfg-saas-bank-id').value.trim().toUpperCase(),
            saas_bank_account_no: document.getElementById('cfg-saas-bank-acc').value.trim(),
            saas_bank_account_name: document.getElementById('cfg-saas-bank-name').value.trim().toUpperCase(),
            saas_warning_days: parseInt(document.getElementById('cfg-saas-warning-days').value || 7),
            saas_grace_period_days: parseInt(document.getElementById('cfg-saas-grace-days').value || 3)
        };

        try {
            const res = await fetch('api/super_admin.php?action=save_saas_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            this.showSaasSettingsMessage(data.message || (data.success ? 'Đã lưu cài đặt.' : 'Không thể lưu cài đặt.'), !!data.success);
        } catch (err) {
            console.error('saveSaasSettings error:', err);
            this.showSaasSettingsMessage('Lỗi kết nối máy chủ khi lưu cài đặt.', false);
        }
    },

    async changePassword(e) {
        e.preventDefault();
        const newPass = document.getElementById('cfg-new-password').value.trim();
        if (newPass.length < 6) {
            alert('Mật khẩu mới phải có ít nhất 6 ký tự!');
            return;
        }

        try {
            const res = await fetch('api/super_admin.php?action=change_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_password: newPass })
            });
            const data = await res.json();
            alert(data.message);
            if (data.success) {
                document.getElementById('cfg-new-password').value = '';
            }
        } catch (err) {
            alert('Lỗi máy chủ');
        }
    },

    // --- 9. AUTHENTICATION & UI HELPERS ---
    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errBox = document.getElementById('login-error-alert');
        const errMsg = document.getElementById('login-error-msg');
        const submitBtn = document.getElementById('btn-login-submit');

        if (errBox) errBox.classList.add('hidden');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const res = await fetch('api/super_admin.php?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                window.location.reload();
            } else {
                if (errBox && errMsg) {
                    errMsg.innerText = data.message || 'Đăng nhập thất bại';
                    errBox.classList.remove('hidden');
                }
            }
        } catch (err) {
            if (errBox && errMsg) {
                errMsg.innerText = 'Lỗi kết nối đến máy chủ';
                errBox.classList.remove('hidden');
            }
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    },

    async handleLogout() {
        if (!confirm('Bạn có muốn đăng xuất khỏi Super Admin?')) return;
        try {
            await fetch('api/super_admin.php?action=logout');
            window.location.href = 'super_admin.php';
        } catch (e) {
            window.location.href = 'super_admin.php';
        }
    },

    togglePasswordView(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
        } else {
            input.type = 'password';
            if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
        }
    },

    openModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.classList.add('open');
    },

    closeModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.classList.remove('open');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    SuperAdmin.init();
});
