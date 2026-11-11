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
        } else if (tabId === 'staff') {
            this.loadStaffUsers();
        } else if (tabId === 'audit') {
            this.loadAuditLogs();
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
                                <div class="mt-1 flex items-center gap-1.5 flex-wrap">
                                    ${t.machine_id 
                                        ? `<span class="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono" title="Đã khóa phần cứng: ${t.machine_name || t.machine_id}"><i class="fas fa-desktop text-[8px]"></i> Đã Khóa Máy</span>` 
                                        : `<span class="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono" title="Chưa kích hoạt trên máy nào"><i class="fas fa-unlock text-[8px]"></i> Chưa Gắn Máy</span>`
                                    }
                                </div>
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
                            <button type="button" onclick="SuperAdmin.openPackagesModal(${t.id})" class="btn-glass text-[11px] py-1 px-2.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1" title="Quản lý Hồ sơ, Hợp đồng & Đóng gói cài đặt (SOP-09)">
                                <i class="fas fa-box-archive text-amber-400"></i> <span>Hồ Sơ & Gói</span>
                            </button>
                            <button type="button" onclick="SuperAdmin.openLicense(${t.id})" class="btn-glass text-[11px] py-1 px-2.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1" title="Quản lý License & Khóa Máy">
                                <i class="fas fa-key text-amber-400"></i> <span>License</span>
                            </button>
                            <button type="button" onclick="SuperAdmin.resetHardwareLock(${t.id}, '${t.tenant_code}')" class="btn-glass text-[11px] py-1 px-2 bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-500/30 font-bold flex items-center gap-1" title="Mở khóa máy trạm (khi quán thay máy mới)">
                                <i class="fas fa-microchip text-sky-400"></i> <span>Reset Máy</span>
                            </button>
                            <button type="button" onclick="SuperAdmin.openQuickExtend(${t.id}, '${t.store_name}', '${t.plan_name}', '${t.expire_date}')" class="btn-glass text-[11px] py-1 px-2.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1" title="Gia hạn gói">
                                <i class="fas fa-calendar-plus"></i> <span>Gia Hạn</span>
                            </button>
                            <button type="button" onclick="SuperAdmin.toggleTenantStatus(${t.id}, '${isSuspended ? 'active' : 'suspended'}')" class="btn-glass text-[11px] py-1 px-2 text-${isSuspended ? 'emerald' : 'rose'}-400 hover:text-white" title="${isSuspended ? 'Mở khóa cửa hàng' : 'Tạm khóa cửa hàng'}">
                                <i class="fas fa-${isSuspended ? 'unlock' : 'lock'}"></i>
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

    // --- GIẤY PHÉP SỐ & KHÓA PHẦN CỨNG (License Key, Node-Lock) ---
    currentLicenseTenantId: null,

    async licApi(action, body) {
        const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
        const url = 'api/super_admin?action=' + action;
        const res = await fetch(url, opt);
        return res.json();
    },

    async openLicense(tenantId) {
        this.currentLicenseTenantId = tenantId;
        const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        try {
            const [ov, tl] = await Promise.all([
                this.licApi('license_overview'),
                this.licApi('get_tenant_license&tenant_id=' + tenantId)
            ]);
            if (!tl.success) { 
                alert(tl.message || 'Lỗi tải thông tin giấy phép'); 
                return; 
            }
            const o = ov.data || {}, d = tl.data || {};

            // Cập nhật thông tin lên Modal
            const elStore = document.getElementById('lic-store-name');
            if (elStore) elStore.textContent = `Cửa hàng: ${d.store_name || '--'}`;

            const elKey = document.getElementById('lic-key-display');
            if (elKey) elKey.textContent = d.license_key || 'LIC-CHƯA-CẤP-MÃ';

            // Trạng thái Node-Lock
            const elNodeStatus = document.getElementById('lic-node-status');
            const elMachineId = document.getElementById('lic-machine-id');
            const elMachineName = document.getElementById('lic-machine-name');
            const elMachineBound = document.getElementById('lic-machine-bound');
            const elLastCheck = document.getElementById('lic-last-check');
            const btnReset = document.getElementById('btn-lic-reset-machine');

            if (d.machine_id && d.machine_id.trim() !== '') {
                if (elNodeStatus) {
                    elNodeStatus.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5';
                    elNodeStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>ĐÃ KHÓA PHẦN CỨNG';
                }
                if (elMachineId) {
                    elMachineId.textContent = d.machine_id;
                    elMachineId.className = 'font-mono font-bold text-emerald-300 truncate max-w-[280px]';
                }
                if (elMachineName) elMachineName.textContent = d.machine_name || 'PC Quán POS';
                if (elMachineBound) elMachineBound.textContent = d.machine_bound_at || '—';
                if (btnReset) {
                    btnReset.disabled = false;
                    btnReset.classList.remove('opacity-40', 'cursor-not-allowed');
                }
            } else {
                if (elNodeStatus) {
                    elNodeStatus.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5';
                    elNodeStatus.innerHTML = '<i class="fas fa-unlock text-[9px]"></i>CHƯA GẮN MÁY (Sẵn sàng kích hoạt)';
                }
                if (elMachineId) {
                    elMachineId.textContent = '(Chưa kích hoạt trên máy nào)';
                    elMachineId.className = 'font-mono text-amber-300/80 truncate max-w-[280px] italic';
                }
                if (elMachineName) elMachineName.textContent = '—';
                if (elMachineBound) elMachineBound.textContent = '—';
                if (btnReset) {
                    btnReset.disabled = true;
                    btnReset.classList.add('opacity-40', 'cursor-not-allowed');
                }
            }

            if (elLastCheck) {
                if (d.last_check_at) {
                    elLastCheck.textContent = `${d.last_check_at} (IP: ${d.last_check_ip || 'LAN/WAN'})`;
                } else {
                    elLastCheck.textContent = 'Chưa lần nào';
                }
            }

            const elGrace = document.getElementById('lic-grace-input');
            if (elGrace) elGrace.value = o.grace_days ?? 7;

            this.openModal('modal-tenant-license');
        } catch (err) {
            console.error('openLicense error:', err);
            alert('Lỗi kết nối máy chủ');
        }
    },

    copyLicenseKey() {
        const elKey = document.getElementById('lic-key-display');
        const text = elKey ? elKey.textContent.trim() : '';
        if (!text) return;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
        const btnText = document.getElementById('btn-lic-copy-text');
        if (btnText) {
            const original = btnText.textContent;
            btnText.innerHTML = '<i class="fas fa-check text-emerald-400"></i> Đã chép!';
            setTimeout(() => { btnText.textContent = original; }, 2000);
        }
    },

    async doResetMachine() {
        if (!this.currentLicenseTenantId) return;
        if (!confirm('Bạn có chắc chắn muốn GỠ KHÓA PHẦN CỨNG cho cửa hàng này?\n\nSau khi gỡ, mã máy cũ sẽ bị hủy liên kết và quán có thể mở ứng dụng trên máy tính mới để kích hoạt lại.')) return;
        try {
            const r = await this.licApi('reset_machine', { tenant_id: this.currentLicenseTenantId });
            alert(r.message || 'Đã gỡ liên kết phần cứng thành công!');
            this.openLicense(this.currentLicenseTenantId);
            this.loadTenants();
        } catch (e) {
            alert('Lỗi gỡ khóa phần cứng: ' + e.message);
        }
    },

    async doRegenerateKey() {
        if (!this.currentLicenseTenantId) return;
        if (!confirm('CẢNH BÁO NGUY HIỂM:\nCấp mã License Key MỚI sẽ THU HỒI key cũ ngay lập tức!\n\nQuán sẽ không thể đồng bộ cho đến khi nhập mã key mới này. Bạn có muốn tiếp tục?')) return;
        try {
            const r = await this.licApi('regenerate_license_key', { tenant_id: this.currentLicenseTenantId });
            alert(r.message + (r.license_key ? '\n\nMã mới: ' + r.license_key : ''));
            this.openLicense(this.currentLicenseTenantId);
            this.loadTenants();
        } catch (e) {
            alert('Lỗi cấp lại mã license: ' + e.message);
        }
    },

    async saveGraceDays() {
        const input = document.getElementById('lic-grace-input');
        const val = parseInt(input?.value || '7', 10);
        try {
            const r = await this.licApi('license_save_grace', { grace_days: val });
            alert(r.message || 'Đã lưu cấu hình thời gian ân hạn offline!');
        } catch (e) {
            alert('Lỗi lưu ân hạn: ' + e.message);
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

    // ========================================================
    // SOP-09: QUẢN LÝ HỒ SƠ KHÁCH HÀNG & GÓI CÀI ĐẶT RELEASE
    // ========================================================
    currentPackageTenantId: null,
    currentPackageTenantCode: '',

    async openPackagesModal(tenantId) {
        this.currentPackageTenantId = tenantId;
        this.openModal('modal-tenant-packages');

        const tbody = document.getElementById('pkg-documents-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải dữ liệu hồ sơ và tài liệu...</td></tr>`;
        }

        await this.loadTenantPackages(tenantId);
    },

    async loadTenantPackages(tenantId) {
        try {
            const res = await fetch(`api/super_admin.php?action=get_tenant_packages&tenant_id=${tenantId}`);
            const data = await res.json();
            if (data.success) {
                this.renderPackagesModal(data);
            } else {
                alert(data.message || 'Không thể tải thông tin hồ sơ.');
            }
        } catch (err) {
            console.error('loadTenantPackages error:', err);
            alert('Lỗi kết nối máy chủ');
        }
    },

    renderPackagesModal(data) {
        const tenant = data.tenant || {};
        const summary = data.summary || {};
        const docs = data.documents || [];

        this.currentPackageTenantCode = tenant.tenant_code || '';

        // Header info
        const badgeEl = document.getElementById('pkg-modal-badge');
        const nameEl = document.getElementById('pkg-modal-store-name');
        const dirEl = document.getElementById('pkg-storage-dir');
        const countEl = document.getElementById('pkg-doc-count');

        if (badgeEl) badgeEl.textContent = tenant.tenant_code;
        if (nameEl) nameEl.textContent = `${tenant.store_name} • Gói: ${tenant.plan_name} (Hạn: ${new Date(tenant.expire_date).toLocaleDateString('vi-VN')})`;
        if (dirEl) dirEl.textContent = `master/packages/${tenant.tenant_code}/`;
        if (countEl) countEl.textContent = docs.length;

        // KPI Status Cards
        const kpiContract = document.getElementById('pkg-kpi-contract');
        const kpiInvoice = document.getElementById('pkg-kpi-invoice');
        const kpiHandover = document.getElementById('pkg-kpi-handover');
        const kpiRelease = document.getElementById('pkg-kpi-release');
        const btnDownloadZip = document.getElementById('btn-pkg-download-zip');

        if (kpiContract) {
            kpiContract.innerHTML = summary.has_contract ? 
                `<i class="fas fa-circle-check text-emerald-400"></i> <span class="text-emerald-400">Đã Ký Kết</span>` : 
                `<i class="fas fa-circle-exclamation text-amber-400"></i> <span class="text-amber-400">Chưa Có Hợp Đồng</span>`;
        }
        if (kpiInvoice) {
            kpiInvoice.innerHTML = summary.has_invoice ? 
                `<i class="fas fa-circle-check text-emerald-400"></i> <span class="text-emerald-400">Đã Xuất VAT</span>` : 
                `<i class="fas fa-circle-exclamation text-amber-400"></i> <span class="text-amber-400">Chưa Xuất VAT</span>`;
        }
        if (kpiHandover) {
            kpiHandover.innerHTML = summary.has_handover ? 
                `<i class="fas fa-circle-check text-emerald-400"></i> <span class="text-emerald-400">Đã Nghiệm Thu</span>` : 
                `<i class="fas fa-clock text-amber-400"></i> <span class="text-amber-400">Chờ Nghiệm Thu</span>`;
        }
        if (kpiRelease) {
            kpiRelease.innerHTML = summary.has_release ? 
                `<i class="fas fa-box-open text-amber-400"></i> <span class="text-amber-300">Đã Đóng Gói (.ZIP)</span>` : 
                `<i class="fas fa-circle-question text-slate-400"></i> <span class="text-slate-400">Chưa Tạo Gói</span>`;
        }

        if (btnDownloadZip) {
            if (summary.has_release && summary.release_zip_path) {
                btnDownloadZip.href = summary.release_zip_path;
                btnDownloadZip.classList.remove('hidden');
            } else {
                btnDownloadZip.classList.add('hidden');
            }
        }

        // Render documents table
        const tbody = document.getElementById('pkg-documents-tbody');
        if (!tbody) return;

        if (docs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400">Thư mục chưa có tài liệu nào. Sử dụng form bên trên để tải lên Hợp đồng, Hóa đơn hoặc bấm Đóng Gói Release.</td></tr>`;
            return;
        }

        const catNames = {
            'contracts': '<span class="px-2 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30">Hợp Đồng</span>',
            'invoices': '<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Hóa Đơn VAT</span>',
            'handover': '<span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">Biên Bản Bàn Giao</span>',
            'release': '<span class="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">Bộ Cài Đặt Release</span>',
            'other': '<span class="px-2 py-0.5 rounded text-[10px] bg-slate-500/20 text-slate-300 border border-slate-500/30">Tài Liệu Khác</span>'
        };

        tbody.innerHTML = docs.map(doc => {
            const kb = (doc.file_size / 1024).toFixed(1);
            const sizeStr = doc.file_size >= 1048576 ? `${(doc.file_size / 1048576).toFixed(1)} MB` : `${kb} KB`;
            const dateStr = doc.created_at ? new Date(doc.created_at).toLocaleString('vi-VN') : '--';
            const catBadge = catNames[doc.category] || `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">${doc.category}</span>`;

            return `
                <tr class="hover:bg-white/5 transition-all">
                    <td class="py-2.5 px-3">
                        <div class="font-bold text-white text-xs flex items-center gap-1.5">
                            <i class="fas fa-file text-slate-400 text-xs"></i>
                            <span class="text-sky-300">${doc.title || doc.file_name}</span>
                        </div>
                        <div class="text-[10px] text-slate-400 font-mono mt-0.5">${doc.file_name} ${doc.notes ? `• <i>${doc.notes}</i>` : ''}</div>
                    </td>
                    <td class="py-2.5 px-3 whitespace-nowrap">${catBadge}</td>
                    <td class="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-300">${sizeStr}</td>
                    <td class="py-2.5 px-3 whitespace-nowrap text-[10px] text-slate-400">${dateStr}</td>
                    <td class="py-2.5 px-3 text-right whitespace-nowrap">
                        <div class="inline-flex items-center gap-1">
                            <a href="${doc.file_path}" target="_blank" download class="btn-glass text-[10px] py-1 px-2.5 bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-500/30 font-bold flex items-center gap-1" title="Tải xuống tài liệu">
                                <i class="fas fa-download"></i> <span>Tải</span>
                            </a>
                            <button type="button" onclick="SuperAdmin.deleteTenantDocument(${doc.id})" class="btn-glass text-[10px] py-1 px-2 text-rose-400 hover:text-white border border-rose-500/30" title="Xóa tài liệu">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async uploadTenantDocument(event) {
        event.preventDefault();
        const tid = this.currentPackageTenantId;
        const tcode = this.currentPackageTenantCode;
        if (!tid) return;

        const category = document.getElementById('pkg-upload-category')?.value || 'contracts';
        const title = document.getElementById('pkg-upload-title')?.value.trim() || 'Tài liệu đính kèm';
        const fileInput = document.getElementById('pkg-upload-file');

        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            alert('Vui lòng chọn một tệp tin hợp lệ!');
            return;
        }

        const formData = new FormData();
        formData.append('tenant_id', tid);
        formData.append('tenant_code', tcode);
        formData.append('category', category);
        formData.append('title', title);
        formData.append('document_file', fileInput.files[0]);

        const btn = document.getElementById('btn-pkg-upload');
        if (btn) btn.disabled = true;

        try {
            const res = await fetch('api/super_admin.php?action=upload_tenant_document', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || 'Đã tải lên tài liệu thành công!');
                document.getElementById('pkg-upload-title').value = '';
                fileInput.value = '';
                await this.loadTenantPackages(tid);
            } else {
                alert(data.message || 'Lỗi khi tải lên tài liệu');
            }
        } catch (err) {
            console.error('uploadTenantDocument error:', err);
            alert('Lỗi kết nối máy chủ');
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    async generateTenantRelease() {
        const tid = this.currentPackageTenantId;
        const tcode = this.currentPackageTenantCode;
        if (!tid) return;

        const btn = document.getElementById('btn-pkg-generate-release');
        if (btn) btn.disabled = true;

        try {
            const res = await fetch('api/super_admin.php?action=generate_tenant_release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tid, tenant_code: tcode })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || 'Đã đóng gói thành công bộ cài đặt!');
                await this.loadTenantPackages(tid);
            } else {
                alert(data.message || 'Lỗi khi đóng gói release');
            }
        } catch (err) {
            console.error('generateTenantRelease error:', err);
            alert('Lỗi kết nối máy chủ');
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    async deleteTenantDocument(docId) {
        if (!confirm('Bạn có chắc chắn muốn xóa tài liệu này khỏi kho hồ sơ?')) return;
        try {
            const res = await fetch('api/super_admin.php?action=delete_tenant_document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ document_id: docId })
            });
            const data = await res.json();
            if (data.success) {
                await this.loadTenantPackages(this.currentPackageTenantId);
            } else {
                alert(data.message || 'Lỗi khi xóa tài liệu');
            }
        } catch (err) {
            console.error('deleteTenantDocument error:', err);
            alert('Lỗi kết nối máy chủ');
        }
    },

    // ========================================================
    // RBAC: PHÂN QUYỀN BỘ PHẬN & NHÂN SỰ
    // ========================================================
    currentRoleView: 'super_admin',
    staffUsersList: [],
    rawAuditLogsList: [],

    switchRoleView(role) {
        this.currentRoleView = role;
        const selector = document.getElementById('saas-role-selector');
        if (selector) selector.value = role;

        const roleNames = {
            'super_admin': 'Ban Giám Đốc (SuperAdmin - Toàn Quyền)',
            'technical': 'Phòng Kỹ Thuật & Triển Khai (Tech Lead)',
            'finance': 'Phòng Kế Toán - Tài Chính (Finance)',
            'sales': 'Phòng Kinh Doanh & CSKH (Sales)',
            'auditor': 'Ban Kiểm Toán & Tuân Thủ (Audit Read-only)'
        };
        console.log(`[RBAC] Chuyển đổi góc nhìn phân quyền sang: ${roleNames[role] || role}`);
        this.applyRoleViewEnforcement(role);
    },

    applyRoleViewEnforcement(role) {
        const billingNav = document.getElementById('nav-tab-billing');
        const plansNav = document.getElementById('nav-tab-plans');
        const settingsNav = document.getElementById('nav-tab-settings');

        if (billingNav) billingNav.style.display = '';
        if (plansNav) plansNav.style.display = '';
        if (settingsNav) settingsNav.style.display = '';

        if (role === 'technical') {
            if (billingNav) billingNav.style.display = 'none';
        } else if (role === 'finance') {
            if (settingsNav) settingsNav.style.display = 'none';
        } else if (role === 'auditor') {
            document.querySelectorAll('button[type="submit"]:not(#btn-login-submit)').forEach(b => {
                b.disabled = true;
            });
        } else {
            document.querySelectorAll('button[type="submit"]').forEach(b => {
                b.disabled = false;
            });
        }
    },

    async resetHardwareLock(tenantId, tenantCode) {
        if (!confirm(`Bạn có chắc chắn muốn MỞ KHÓA MÁY TRẠM cho cửa hàng [${tenantCode}]?\n\nHành động này sẽ giải phóng Hardware GUID cũ, cho phép chủ quán hoặc kỹ thuật viên kích hoạt máy POS mới.`)) return;
        try {
            const res = await fetch('api/super_admin.php?action=reset_hardware_lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenantId, tenant_code: tenantCode })
            });
            const data = await res.json();
            alert(data.message || (data.success ? 'Đã mở khóa phần cứng thành công!' : 'Lỗi mở khóa'));
            if (data.success) {
                this.loadTenants();
            }
        } catch (e) {
            console.error('resetHardwareLock error:', e);
            alert('Lỗi kết nối máy chủ');
        }
    },

    // --- 7. QUẢN LÝ NHÂN SỰ BỘ PHẬN (STAFF RBAC) ---
    async loadStaffUsers() {
        const tbody = document.getElementById('staff-table-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải dữ liệu nhân viên...</td></tr>`;
        }

        try {
            const res = await fetch('api/super_admin.php?action=get_staff_users');
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                this.staffUsersList = data.data;
                this.renderStaffTable(this.staffUsersList);
            }
        } catch (e) {
            console.error('loadStaffUsers error:', e);
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400">Lỗi khi tải danh sách nhân viên</td></tr>`;
        }
    },

    renderStaffTable(list) {
        const tbody = document.getElementById('staff-table-tbody');
        const countEl = document.getElementById('staff-total-count');
        if (!tbody) return;

        if (countEl) countEl.innerText = list.length;

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">Chưa có nhân viên bộ phận nào</td></tr>`;
            return;
        }

        const roleBadges = {
            'super_admin': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">👑 Ban Giám Đốc</span>',
            'technical': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">🛠️ Kỹ Thuật (Tech Lead)</span>',
            'finance': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">💼 Kế Toán (Finance)</span>',
            'sales': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">📈 Kinh Doanh (Sales)</span>',
            'auditor': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">🛡️ Kiểm Toán (Auditor)</span>'
        };

        tbody.innerHTML = list.map(u => {
            const isSuper = (u.role === 'super_admin' || u.id === 1);
            return `
                <tr class="hover:bg-white/5 transition-all">
                    <td class="py-3 px-4 font-bold text-white flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 border border-indigo-500/30 flex items-center justify-center text-xs text-indigo-300 font-bold">
                            ${(u.fullname || u.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div>${u.fullname || u.username}</div>
                            <div class="text-[10px] text-slate-400">${u.department || 'Bộ Phận'}</div>
                        </div>
                    </td>
                    <td class="py-3 px-4 font-mono font-bold text-indigo-300">${u.username}</td>
                    <td class="py-3 px-4">${roleBadges[u.role] || u.role}</td>
                    <td class="py-3 px-4 text-[11px] text-slate-400">
                        <div><i class="fas fa-phone text-xs mr-1 text-slate-500"></i>${u.phone || 'Chưa cập nhật'}</div>
                        <div><i class="fas fa-envelope text-xs mr-1 text-slate-500"></i>${u.email || '-'}</div>
                    </td>
                    <td class="py-3 px-4 font-mono text-[11px] text-slate-400">${u.last_login_at || 'Chưa đăng nhập'}</td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Hoạt Động</span>
                    </td>
                    <td class="py-3 px-4 text-center">
                        <div class="inline-flex items-center gap-1.5">
                            <button type="button" onclick="SuperAdmin.editStaffMember(${u.id})" class="btn-glass text-[11px] py-1 px-2.5 text-slate-300 hover:text-white" title="Sửa thông tin & phân quyền">
                                <i class="fas fa-pen"></i>
                            </button>
                            ${!isSuper ? `
                            <button type="button" onclick="SuperAdmin.deleteStaffMember(${u.id}, '${u.username}')" class="btn-glass text-[11px] py-1 px-2.5 text-rose-400 hover:text-rose-200" title="Xóa nhân viên">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    openStaffModal() {
        document.getElementById('staff-input-id').value = '0';
        document.getElementById('staff-input-username').value = '';
        document.getElementById('staff-input-username').disabled = false;
        document.getElementById('staff-input-password').value = '';
        document.getElementById('staff-input-fullname').value = '';
        document.getElementById('staff-input-role').value = 'technical';
        document.getElementById('staff-input-dept').value = 'Phòng Kỹ Thuật & Triển Khai';
        document.getElementById('staff-input-phone').value = '';
        document.getElementById('staff-input-email').value = '';
        document.getElementById('staff-modal-title').innerText = 'Thêm Nhân Viên Bộ Phận Mới';
        this.openModal('modal-staff-member');
    },

    editStaffMember(id) {
        const u = this.staffUsersList.find(x => x.id === id);
        if (!u) return;

        document.getElementById('staff-input-id').value = u.id;
        document.getElementById('staff-input-username').value = u.username;
        document.getElementById('staff-input-username').disabled = (u.id === 1);
        document.getElementById('staff-input-password').value = '';
        document.getElementById('staff-input-fullname').value = u.fullname || '';
        document.getElementById('staff-input-role').value = u.role || 'technical';
        document.getElementById('staff-input-dept').value = u.department || '';
        document.getElementById('staff-input-phone').value = u.phone || '';
        document.getElementById('staff-input-email').value = u.email || '';
        document.getElementById('staff-modal-title').innerText = 'Chỉnh Sửa Phân Quyền: ' + u.username;
        this.openModal('modal-staff-member');
    },

    onStaffRoleChange(role) {
        const deptInput = document.getElementById('staff-input-dept');
        const depts = {
            'super_admin': 'Ban Giám Đốc',
            'technical': 'Phòng Kỹ Thuật & Triển Khai',
            'finance': 'Phòng Kế Toán - Tài Chính',
            'sales': 'Phòng Kinh Doanh & CSKH',
            'auditor': 'Ban Kiểm Toán & Tuân Thủ'
        };
        if (deptInput && depts[role]) {
            deptInput.value = depts[role];
        }
    },

    async saveStaffMember(e) {
        if (e && e.preventDefault) e.preventDefault();
        const id = document.getElementById('staff-input-id').value;
        const username = document.getElementById('staff-input-username').value.trim();
        const password = document.getElementById('staff-input-password').value;
        const fullname = document.getElementById('staff-input-fullname').value.trim();
        const role = document.getElementById('staff-input-role').value;
        const department = document.getElementById('staff-input-dept').value.trim();
        const phone = document.getElementById('staff-input-phone').value.trim();
        const email = document.getElementById('staff-input-email').value.trim();

        const perms = [];
        document.querySelectorAll('#staff-permissions-checkboxes input:checked').forEach(cb => {
            perms.push(cb.value);
        });

        try {
            const res = await fetch('api/super_admin.php?action=save_staff_user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: parseInt(id) || 0,
                    username, password, fullname, role, department, phone, email,
                    permissions: JSON.stringify(perms)
                })
            });
            const data = await res.json();
            alert(data.message || (data.success ? 'Đã lưu tài khoản nhân viên!' : 'Lỗi'));
            if (data.success) {
                this.closeModal('modal-staff-member');
                this.loadStaffUsers();
            }
        } catch (err) {
            console.error('saveStaffMember error:', err);
            alert('Lỗi kết nối máy chủ');
        }
    },

    async deleteStaffMember(id, username) {
        if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản nhân viên [${username}]?`)) return;
        try {
            const res = await fetch('api/super_admin.php?action=delete_staff_user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            alert(data.message || (data.success ? 'Đã xóa tài khoản!' : 'Lỗi'));
            if (data.success) {
                this.loadStaffUsers();
            }
        } catch (err) {
            console.error('deleteStaffMember error:', err);
            alert('Lỗi kết nối máy chủ');
        }
    },

    // --- 8. NHẬT KÝ KIỂM TOÁN (AUDIT TRAIL) ---
    async loadAuditLogs() {
        const tbody = document.getElementById('audit-table-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải dữ liệu kiểm toán...</td></tr>`;
        }

        const role = document.getElementById('audit-filter-role') ? document.getElementById('audit-filter-role').value : 'all';
        const actionType = document.getElementById('audit-filter-action') ? document.getElementById('audit-filter-action').value : 'all';
        const tenantCode = document.getElementById('audit-filter-tenant') ? document.getElementById('audit-filter-tenant').value.trim() : '';

        try {
            let url = `api/super_admin.php?action=get_audit_logs&role=${encodeURIComponent(role)}&action_type=${encodeURIComponent(actionType)}`;
            if (tenantCode) url += `&tenant_code=${encodeURIComponent(tenantCode)}`;

            const res = await fetch(url);
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                this.rawAuditLogsList = data.data;
                this.renderAuditTable(this.rawAuditLogsList);
            }
        } catch (err) {
            console.error('loadAuditLogs error:', err);
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400">Lỗi khi tải nhật ký kiểm toán</td></tr>`;
        }
    },

    filterAuditLogsLocal() {
        const kw = document.getElementById('audit-filter-tenant').value.trim().toUpperCase();
        if (!kw) {
            this.renderAuditTable(this.rawAuditLogsList);
            return;
        }
        const filtered = this.rawAuditLogsList.filter(l => 
            (l.target_tenant && l.target_tenant.toUpperCase().includes(kw)) ||
            (l.description && l.description.toUpperCase().includes(kw)) ||
            (l.username && l.username.toUpperCase().includes(kw))
        );
        this.renderAuditTable(filtered);
    },

    renderAuditTable(list) {
        const tbody = document.getElementById('audit-table-tbody');
        if (!tbody) return;

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">Không có nhật ký kiểm toán nào phù hợp với bộ lọc</td></tr>`;
            return;
        }

        const roleBadges = {
            'super_admin': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">Admin</span>',
            'technical': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">Kỹ Thuật</span>',
            'finance': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Kế Toán</span>',
            'accounting': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Kế Toán</span>',
            'sales': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Sales</span>',
            'auditor': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Kiểm Toán</span>'
        };

        const actionIcons = {
            'AUTH_LOGIN': '<i class="fas fa-right-to-bracket text-emerald-400 mr-1"></i>',
            'AUTH_FAILED': '<i class="fas fa-triangle-exclamation text-rose-400 mr-1"></i>',
            'TOGGLE_MODULE': '<i class="fas fa-sliders text-purple-400 mr-1"></i>',
            'GENERATE_RELEASE_ZIP': '<i class="fas fa-box-archive text-amber-400 mr-1"></i>',
            'UPLOAD_DOCUMENT': '<i class="fas fa-file-arrow-up text-sky-400 mr-1"></i>',
            'DELETE_DOCUMENT': '<i class="fas fa-trash text-rose-400 mr-1"></i>',
            'RESET_HARDWARE_LOCK': '<i class="fas fa-microchip text-indigo-400 mr-1"></i>',
            'SAVE_TENANT': '<i class="fas fa-store text-emerald-400 mr-1"></i>'
        };

        tbody.innerHTML = list.map(l => {
            const badge = roleBadges[l.role] || `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">${l.role}</span>`;
            const icon = actionIcons[l.action] || '<i class="fas fa-circle-dot text-slate-400 mr-1"></i>';
            return `
                <tr class="hover:bg-white/5 transition-all">
                    <td class="py-2.5 px-4 text-[11px] text-slate-400">${l.created_at || '-'}</td>
                    <td class="py-2.5 px-4 font-bold text-white">${l.username || 'system'}</td>
                    <td class="py-2.5 px-4">${badge}</td>
                    <td class="py-2.5 px-4 font-bold text-amber-300">${icon}${l.action}</td>
                    <td class="py-2.5 px-4 font-bold text-sky-300 font-mono">${l.target_tenant || 'SYSTEM'}</td>
                    <td class="py-2.5 px-4 text-slate-200">${l.description || '-'}</td>
                    <td class="py-2.5 px-4 text-[11px] text-slate-400 font-mono">${l.ip_address || '127.0.0.1'}</td>
                </tr>
            `;
        }).join('');
    },

    exportAuditCsv() {
        if (!this.rawAuditLogsList || this.rawAuditLogsList.length === 0) {
            alert('Không có dữ liệu kiểm toán để xuất!');
            return;
        }

        const headers = ["ID", "Thoi_Gian", "Nguoi_Thuc_Hien", "Vai_Tro", "Ma_Tac_Vu", "Ma_Quan", "Dien_Giai", "IP_May_Tram"];
        const rows = this.rawAuditLogsList.map(l => [
            l.id,
            `"${l.created_at}"`,
            `"${l.username}"`,
            `"${l.role}"`,
            `"${l.action}"`,
            `"${l.target_tenant}"`,
            `"${(l.description || '').replace(/"/g, '""')}"`,
            `"${l.ip_address}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `CyberNexus_Audit_Logs_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
