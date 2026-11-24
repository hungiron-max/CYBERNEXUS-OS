/**
 * Super Admin SaaS Management Controller JavaScript
 * Real-time Module Licensing, Subscription Matrix, Billing & Multi-Tenant Analytics
 */

const SuperAdmin = {
    currentTab: 'dashboard',
    plans: [],
    tenants: [],
    resellers: [],
    currentTenantInModal: null,
    revenueChartInstance: null,
    pendingTenantLogo: null,
    logoProcessing: null,
    logoProcessingGeneration: 0,
    tenantSaveInProgress: false,

    async init() {
        if (!document.getElementById('tab-content-dashboard')) return;
        let user = null;
        try {
            const auth = await fetch('api/super_admin.php?action=check_auth').then(r => r.json());
            if (auth && auth.authenticated === false) {
                sessionStorage.removeItem('sa_logged_in');
                sessionStorage.removeItem('sa_user');
                const wrap = document.querySelector('.sa-login-wrap');
                if (wrap) wrap.style.display = 'flex';
                return;
            }
            if (auth && auth.user) user = auth.user;
        } catch (_) {}
        if (!user) {
            try { user = JSON.parse(sessionStorage.getItem('sa_user') || 'null'); } catch (_) {}
        }
        this.currentUser = user || { role: 'super_admin', username: 'superadmin', fullname: 'Super Admin', department: (window.cnxT?window.cnxT('js.m_sa.d34f4767','Ban Giám Đốc'):'Ban Giám Đốc') };
        const role = this.currentUser.role || 'super_admin';
        const nameEl = document.getElementById('sa-header-user-name');
        const deptEl = document.getElementById('sa-header-user-dept');
        if (nameEl) nameEl.textContent = this.currentUser.fullname || this.currentUser.username || 'Super Admin';
        if (deptEl) deptEl.textContent = this.currentUser.department || role;
        const selector = document.getElementById('saas-role-selector');
        if (selector) {
            selector.value = role;
            selector.disabled = (role !== 'super_admin');
            selector.title = (role !== 'super_admin') ? 'Tài khoản bị khóa đúng theo vai trò bộ phận' : (window.cnxT?window.cnxT('js.m_sa.36eaf9fe','Chuyển góc nhìn kiểm tra phân quyền'):'Chuyển góc nhìn kiểm tra phân quyền');
        }
        this.switchRoleView(role);
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
        } else if (tabId === 'ai-vault') {
            this.loadMasterAiVault();
        } else if (tabId === 'settings') {
            this.loadSaasSettings();
            this.loadOtaPatchArchive();
        } else if (tabId === 'templates') {
            this.loadLegalTemplates();
        } else if (tabId === 'resellers') {
            this.loadResellers();
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
            document.getElementById('stat-revenue-month').innerText = (s.revenue_month || 0).toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
            document.getElementById('stat-revenue-year').innerText = (window.cnxT?window.cnxT('js.m_sa.271cea6c','Năm: '):'Năm: ') + (s.revenue_year || 0).toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');

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
                    <span>${window.cnxT?window.cnxT('js.m_sa.889698bc','Tất cả các cửa hàng đều có hạn bản quyền an toàn (không có quán nào sắp hết hạn trong 7 ngày tới).'):'Tất cả các cửa hàng đều có hạn bản quyền an toàn (không có quán nào sắp hết hạn trong 7 ngày tới).'}</span>
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(t => {
            const isExpired = t.days_left < 0;
            const daysText = isExpired ? `${window.cnxT?window.cnxT('js.m_sa.35db2e7e','Đã quá hạn'):'Đã quá hạn'} ${Math.abs(t.days_left)} ${window.cnxT?window.cnxT('ui.sa_html.span_0a0e7b6e','ngày'):'ngày'}` : `${window.cnxT?window.cnxT('js.m_sa.fe85fb32','Còn'):'Còn'} ${t.days_left} ${window.cnxT?window.cnxT('ui.sa_html.span_0a0e7b6e','ngày'):'ngày'}`;
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
                                <span>${window.cnxT?window.cnxT('js.m_sa.e08538aa','Chủ quán:'):'Chủ quán:'} <b>${t.owner_name}</b></span>
                                <span>&bull;</span>
                                <span>${window.cnxT?window.cnxT('js.m_sa.c151c0ab','SĐT:'):'SĐT:'} <a href="tel:${t.phone}" class="text-sky-400 hover:underline">${t.phone}</a></span>
                                <span>&bull;</span>
                                <span>${window.cnxT?window.cnxT('ui.sa_html.span_28dcc65f','Gói:'):'Gói:'} <b class="text-purple-300">${t.plan_name}</b></span>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        <a href="tel:${t.phone}" class="btn-glass text-[11px] py-1 px-2.5 text-slate-300 hover:text-white flex items-center gap-1" title="Gọi điện nhắc gia hạn">
                            <i class="fas fa-phone text-emerald-400"></i> ${window.cnxT?window.cnxT('js.m_sa.2e3e5c83','Gọi'):'Gọi'}
                        </a>
                        <button type="button" onclick="SuperAdmin.openQuickExtend(${t.id}, '${t.store_name}', '${t.plan_name}', '${t.expire_date}')" class="btn-glass-success text-[11px] py-1 px-3 font-bold flex items-center gap-1 shadow-md shadow-emerald-500/20">
                            <i class="fas fa-calendar-plus"></i> ${window.cnxT?window.cnxT('js.m_sa.c3455fd1','Gia Hạn 1-Click'):'Gia Hạn 1-Click'}
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
                    label: (window.cnxT?window.cnxT('js.m_sa.a444ef7e','Doanh Thu Thu Phí (VNĐ)'):'Doanh Thu Thu Phí (VNĐ)'),
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
                            label: (item) => ' Doanh thu: ' + (item.raw || 0).toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ')
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
            container.innerHTML = (window.cnxT?window.cnxT('js.m_sa.d294897f','<div class="text-xs text-slate-400 text-center py-4">Chưa có dữ liệu phân bố</div>'):'<div class="text-xs text-slate-400 text-center py-4">Chưa có dữ liệu phân bố</div>');
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
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>${window.cnxT?window.cnxT('js.m_sa.e611aa0c','Đang tải dữ liệu...'):'Đang tải dữ liệu...'}</td></tr>`;
        }

        const kw = document.getElementById('tenant-search-input')?.value || '';
        const status = document.getElementById('tenant-filter-status')?.value || '';

        try {
            const url = `api/super_admin.php?action=get_tenants&kw=${encodeURIComponent(kw)}&status=${encodeURIComponent(status)}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                this.tenants = data.data || [];
                const trashBadge = document.getElementById('badge-trash-tenants');
                if (trashBadge && typeof data.deleted_count !== 'undefined') trashBadge.innerText = data.deleted_count;
                const btnTrash = document.getElementById('btn-toggle-trash');
                if (btnTrash) {
                    const inTrash = (status === 'deleted');
                    btnTrash.classList.toggle('bg-rose-500/35', inTrash);
                    btnTrash.classList.toggle('text-white', inTrash);
                }
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
            tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400">${window.cnxT?window.cnxT('js.m_sa.35af741c','Không tìm thấy cửa hàng nào phù hợp!'):'Không tìm thấy cửa hàng nào phù hợp!'}</td></tr>`;
            return;
        }

        tbody.innerHTML = tenants.map(t => {
            const isSuspended = t.subscription_status === 'suspended';
            const expireDateFormatted = new Date(t.expire_date).toLocaleDateString('vi-VN');
            const logoPath = this.tenantLogoPath(t.logo_path);
            const lanIp = t.lan_ip || '—';
            const wanIp = t.wan_ip || t.last_check_ip || '—';
            const latNum = parseFloat(t.geo_lat);
            const lngNum = parseFloat(t.geo_lng);
            const hasGeo = Number.isFinite(latNum) && Number.isFinite(lngNum) && latNum !== 0 && lngNum !== 0;
            const geoLat = hasGeo ? latNum.toFixed(5) : '';
            const geoLng = hasGeo ? lngNum.toFixed(5) : '';
            const mapUrl = hasGeo ? `https://www.google.com/maps?q=${latNum},${lngNum}` : '';
            const isGps = (t.geo_source || 'ip') === 'gps';
            const geoText = hasGeo
                ? (t.geo_label ? t.geo_label : `${geoLat}, ${geoLng}`)
                : (window.cnxT?window.cnxT('js.m_sa.8da791db','Chưa định vị'):'Chưa định vị');

            return `
                <tr class="hover:bg-white/5 transition-all">
                    <td class="py-2 px-2.5 font-mono font-bold text-sky-400 text-xs">${t.tenant_code}</td>
                    <td class="py-2 px-2.5">
                        <div class="flex items-center gap-2">
                            <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/95 p-0.5">
                                ${logoPath ? `<img src="${logoPath}" alt="" class="h-full w-full object-contain">` : '<i class="fas fa-store text-xs text-slate-400"></i>'}
                            </span>
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <span id="tenant-dot-${t.id}" class="inline-block w-2.5 h-2.5 rounded-full shrink-0 ${t.is_tunnel_online ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)] animate-pulse' : 'bg-slate-500'}" title="${t.is_tunnel_online ? 'Đang Online qua kênh WAN' : (window.cnxT?window.cnxT('js.m_sa.bba36dd0','Offline / Chưa kết nối'):'Offline / Chưa kết nối')}"></span>
                                    <span class="font-bold text-white text-xs truncate max-w-[155px]" title="${t.store_name}">${t.store_name}</span>
                                </div>
                                <div id="tenant-presence-${t.id}" class="text-[10px] ${t.is_tunnel_online ? 'text-emerald-300' : 'text-slate-400'} truncate max-w-[165px]" title="IP: ${t.last_check_ip || 'N/A'} ${window.cnxT?window.cnxT('js.m_sa.ee8d8a22','| Lần cuối:'):'| Lần cuối:'} ${t.last_check_at || (window.cnxT?window.cnxT('js.m_sa.febea634','Chưa có'):'Chưa có')}">
                                    ${t.is_tunnel_online
                                        ? `Online${t.last_ping_latency_ms > 0 ? ` • ${t.last_ping_latency_ms}ms` : ''}`
                                        : (t.last_check_at ? `Offline • ${t.last_check_at}` : (window.cnxT?window.cnxT('js.m_sa.cd9aa117','Offline • Chưa kết nối'):'Offline • Chưa kết nối'))}
                                </div>
                                <div class="mt-0.5 flex items-center gap-1 flex-wrap">
                                    ${t.machine_id 
                                        ? `<span class="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono" title="Đã khóa phần cứng: ${t.machine_name || t.machine_id}"><i class="fas fa-desktop text-[8px]"></i> ${window.cnxT?window.cnxT('js.m_sa.acd4f700','Đã Khóa Máy'):'Đã Khóa Máy'}</span>` 
                                        : `<span class="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono" title="Chưa kích hoạt trên máy nào"><i class="fas fa-unlock text-[8px]"></i> ${window.cnxT?window.cnxT('js.m_sa.bff22c5f','Chưa Gắn Máy'):'Chưa Gắn Máy'}</span>`
                                    }
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="py-2 px-2.5">
                        <div class="text-slate-200 font-semibold text-xs">${t.owner_name}</div>
                        <div class="text-[10px] text-sky-400 font-mono">${t.phone}</div>
                    </td>
                    <td class="py-2 px-2.5">
                        <div class="space-y-1 text-[10px]">
                            <div class="flex items-center gap-1.5 font-mono">
                                <span class="px-1 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25 font-bold text-[9px] shrink-0">LAN</span>
                                <span id="tenant-lan-${t.id}" class="text-slate-200 truncate max-w-[120px]" title="IP Nội bộ LAN: ${lanIp}">${lanIp}</span>
                                ${lanIp !== '—' ? `<button type="button" onclick="SuperAdmin.copyIpText('${lanIp}', this)" class="text-slate-400 hover:text-sky-300 transition" title="Sao chép IP LAN"><i class="far fa-copy text-[9px]"></i></button>` : ''}
                            </div>
                            <div class="flex items-center gap-1.5 font-mono">
                                <span class="px-1 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25 font-bold text-[9px] shrink-0">WAN</span>
                                <span id="tenant-wan-${t.id}" class="text-slate-300 truncate max-w-[120px]" title="IP Public WAN: ${wanIp}">${wanIp}</span>
                                ${wanIp !== '—' ? `<button type="button" onclick="SuperAdmin.copyIpText('${wanIp}', this)" class="text-slate-400 hover:text-purple-300 transition" title="Sao chép IP WAN"><i class="far fa-copy text-[9px]"></i></button>` : ''}
                            </div>
                            <div class="flex items-center gap-1">
                                ${hasGeo
                                    ? `<a href="${mapUrl}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 hover:underline truncate max-w-[155px]" title="Mở Google Maps (${geoLat}, ${geoLng}${window.cnxT?window.cnxT('js.m_sa.983cdebe',') • Nguồn:'):') • Nguồn:'} ${isGps ? 'GPS Chính Xác' : (window.cnxT?window.cnxT('js.m_sa.afb7f4e5','Ước lượng IP'):'Ước lượng IP')}">
                                        <i class="fas fa-location-dot text-rose-400 text-[10px] shrink-0"></i>
                                        <span class="truncate">${geoText}</span>
                                       </a>
                                       <span class="px-1 py-0.2 rounded text-[8px] font-bold ${isGps ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'} shrink-0">${isGps ? 'GPS' : 'IP'}</span>`
                                    : `<span class="text-slate-500 inline-flex items-center gap-1"><i class="fas fa-location-dot text-[9px]"></i> ${window.cnxT?window.cnxT('js.m_sa.662a766d','Chưa có vị trí'):'Chưa có vị trí'}</span>`
                                }
                                <button type="button" onclick="SuperAdmin.promptStoreLocation(${t.id}, '${t.store_name.replace(/'/g, "\\'")}', '${geoLat}', '${geoLng}')" class="text-slate-400 hover:text-amber-300 ml-0.5 transition shrink-0" title="Ghim tọa độ Google Maps chính xác">
                                    <i class="fas fa-map-pin text-[9px]"></i>
                                </button>
                            </div>
                        </div>
                    </td>
                    <td class="py-2 px-2.5">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 truncate inline-block max-w-[110px]" title="${t.plan_name}">
                            ${t.plan_name}
                        </span>
                    </td>
                    <td class="py-2 px-2.5">
                        <div class="font-mono text-xs ${t.days_left <= 7 ? 'text-amber-400 font-bold' : 'text-slate-300'}">${expireDateFormatted}</div>
                        <div class="text-[9px] ${t.days_left < 0 ? 'text-rose-400 font-bold' : (t.days_left <= 7 ? 'text-amber-400' : 'text-slate-500')}">
                            ${t.days_left < 0 ? `${window.cnxT?window.cnxT('js.m_sa.138cf3ad','Quá hạn'):'Quá hạn'} ${Math.abs(t.days_left)} ${window.cnxT?window.cnxT('ui.sa_html.span_0a0e7b6e','ngày'):'ngày'}` : `${window.cnxT?window.cnxT('js.m_sa.fe85fb32','Còn'):'Còn'} ${t.days_left} ${window.cnxT?window.cnxT('ui.sa_html.span_0a0e7b6e','ngày'):'ngày'}`}
                        </div>
                    </td>
                    <td class="py-2 px-2.5 text-center">
                        <button type="button" onclick="SuperAdmin.openModulePermissions(${t.id})" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gradient-to-r from-purple-600/30 to-sky-600/30 hover:from-purple-600/50 hover:to-sky-600/50 text-purple-200 border border-purple-500/30 text-[10px] font-bold transition-all shadow-sm" title="Bấm để Cấp quyền Bật/Tắt module">
                            <i class="fas fa-sliders text-amber-400 text-[10px]"></i>
                            <span>${t.active_module_count}/${t.total_catalog_count}</span>
                        </button>
                    </td>
                    <td class="py-2 px-2.5 text-center">
                        <span class="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border bg-${t.badge_color}-500/20 text-${t.badge_color}-300 border-${t.badge_color}-500/30">
                            ${t.badge_status}
                        </span>
                        <div class="text-[9px] mt-1 font-semibold ${t.subscription_status === 'deleted' ? 'text-rose-300' : (t.workflow_stage === 'active' ? 'text-emerald-400' : (t.workflow_stage === 'trial' ? 'text-sky-300' : 'text-amber-300'))}">
                            ${t.subscription_status === 'deleted' ? ((window.cnxT?window.cnxT('js.m_sa.5fe077e8','Đã xóa: '):'Đã xóa: ') + (t.deleted_at || '')) : this.getWorkflowLabel(t)}
                        </div>
                    </td>
                    <td class="py-2 px-2.5 text-right whitespace-nowrap">
                        <div class="inline-flex items-center gap-1 justify-end">
                            ${t.subscription_status === 'deleted' ? `
                                <button type="button" onclick="SuperAdmin.openPackagesModal(${t.id})" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition" title="Xem lại hồ sơ đã lưu">
                                    <i class="fas fa-folder-open text-[10px]"></i> <span>${window.cnxT?window.cnxT('js.m_sa.cf0d0280','Hồ Sơ'):'Hồ Sơ'}</span>
                                </button>
                                <button type="button" onclick="SuperAdmin.editTenant(${t.id})" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-[11px] font-bold transition" title="Xem lại thông tin quán">
                                    <i class="fas fa-eye text-[10px]"></i> <span>Xem</span>
                                </button>
                                <button type="button" onclick="SuperAdmin.restoreTenant(${t.id}, '${t.tenant_code}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition" title="Khôi phục quán từ Thùng rác">
                                    <i class="fas fa-rotate-left text-[10px]"></i> <span>${window.cnxT?window.cnxT('js.m_sa.54dd8de7','Khôi Phục'):'Khôi Phục'}</span>
                                </button>
                            ` : `
                            <button type="button" onclick="SuperAdmin.checkStoreOnline(${t.id}, this)" class="w-7 h-7 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-[11px] transition" title="Gọi kiểm tra Store Online ngay">
                                <i class="fas fa-satellite-dish text-[10px]"></i>
                            </button>
                            <button type="button" onclick="SuperAdmin.openPackagesModal(${t.id})" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition shadow-sm" title="Quản lý Hồ sơ, Hợp đồng & Đóng gói">
                                <i class="fas fa-box-archive text-[10px]"></i>
                                <span>${window.cnxT?window.cnxT('js.m_sa_ext.ddba9df6','Gói'):'Gói'}</span>
                            </button>
                            <button type="button" onclick="SuperAdmin.openLicense(${t.id})" class="w-7 h-7 rounded-lg bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 flex items-center justify-center text-[11px] transition" title="License & Khóa Máy">
                                <i class="fas fa-key text-[10px]"></i>
                            </button>
                            <button type="button" onclick="SuperAdmin.resetHardwareLock(${t.id}, '${t.tenant_code}')" class="w-7 h-7 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 flex items-center justify-center text-[11px] transition" title="Reset Machine ID">
                                <i class="fas fa-microchip text-[10px]"></i>
                            </button>
                            <button type="button" onclick="SuperAdmin.resetOwnerPin(${t.id}, '${t.tenant_code}')" class="w-7 h-7 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 flex items-center justify-center text-[11px] transition" title="Reset PIN 6 số mặc định & gửi file về Control Center quán">
                                <i class="fas fa-shield-halved text-[10px]"></i>
                            </button>
                            <button type="button" onclick="SuperAdmin.openQuickExtend(${t.id}, '${t.store_name}', '${t.plan_name}', '${t.expire_date}')" class="w-7 h-7 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-[11px] transition" title="Gia hạn gói">
                                <i class="fas fa-calendar-plus text-[10px]"></i>
                            </button>
                            <button type="button" onclick="SuperAdmin.toggleTenantStatus(${t.id}, '${isSuspended ? 'active' : 'suspended'}')" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-${isSuspended ? 'emerald' : 'rose'}-400 border border-white/10 flex items-center justify-center text-[11px] transition" title="${isSuspended ? 'Mở khóa' : (window.cnxT?window.cnxT('js.m_sa_ext.0d6c7f3c','Tạm khóa'):'Tạm khóa')}">
                                <i class="fas fa-${isSuspended ? 'unlock' : 'lock'} text-[10px]"></i>
                            </button>
                            <button type="button" onclick="SuperAdmin.editTenant(${t.id})" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center justify-center text-[11px] transition" title="Chỉnh sửa">
                                <i class="fas fa-pen text-[10px]"></i>
                            </button>
                            <button type="button" onclick="SuperAdmin.softDeleteTenant(${t.id}, '${t.tenant_code}')" class="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/35 text-rose-400 border border-rose-500/30 flex items-center justify-center text-[11px] transition" title="Chuyển quán vào Thùng rác (Trash)">
                                <i class="fas fa-trash text-[10px]"></i>
                            </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    copyIpText(text, btn) {
        navigator.clipboard?.writeText(text).then(() => {
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check text-emerald-400 text-[9px]"></i>';
                setTimeout(() => { btn.innerHTML = orig; }, 1200);
            }
        });
    },

    async promptStoreLocation(tenantId, storeName, curLat, curLng) {
        const defVal = (curLat && curLng) ? `${curLat}, ${curLng}` : '';
        const input = prompt(
            `Ghim vị trí Google Maps chính xác cho "${storeName}":\n` +
            `${window.cnxT?window.cnxT('js.m_sa.f0f7d46f','- Nhập tọa độ dạng: 10.85063, 106.77191\\n'):'- Nhập tọa độ dạng: 10.85063, 106.77191\\n'}` +
            `${window.cnxT?window.cnxT('js.m_sa.49c97c42','- Hoặc dán trực tiếp link Google Maps (có chứa @lat,lng):'):'- Hoặc dán trực tiếp link Google Maps (có chứa @lat,lng):'}`,
            defVal
        );
        if (!input || !input.trim()) return;
        let lat = 0, lng = 0;
        const atMatch = input.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
        const qMatch = input.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
        if (atMatch) {
            lat = parseFloat(atMatch[1]);
            lng = parseFloat(atMatch[2]);
        } else if (qMatch) {
            lat = parseFloat(qMatch[1]);
            lng = parseFloat(qMatch[2]);
        }
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            alert((window.cnxT?window.cnxT('js.m_sa.27fe5c8d','Không nhận diện được tọa độ (lat, lng). Ví dụ đúng: 10.85063, 106.77191'):'Không nhận diện được tọa độ (lat, lng). Ví dụ đúng: 10.85063, 106.77191'));
            return;
        }
        const label = prompt((window.cnxT?window.cnxT('js.m_sa.e5a14547','Tên địa điểm hiển thị ngắn gọn (VD: Thủ Đức, TP.HCM):'):'Tên địa điểm hiển thị ngắn gọn (VD: Thủ Đức, TP.HCM):'), '') || '';
        try {
            const res = await fetch('api/super_admin.php?action=update_store_location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenantId, geo_lat: lat, geo_lng: lng, geo_label: label.trim() })
            });
            const data = await res.json();
            alert(data.message || (window.cnxT?window.cnxT('js.m_sa.df8624a2','Đã cập nhật vị trí!'):'Đã cập nhật vị trí!'));
            await this.loadTenants();
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.99e92054','Lỗi cập nhật vị trí: '):'Lỗi cập nhật vị trí: ') + e.message);
        }
    },

    async checkStoreOnline(tenantId, btnEl) {
        const origHtml = btnEl ? btnEl.innerHTML : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<i class="fas fa-spinner fa-spin text-[10px]"></i>';
        }
        try {
            const res = await fetch(`api/super_admin.php?action=check_store_online&tenant_id=${tenantId}`);
            const data = await res.json();
            const dot = document.getElementById(`tenant-dot-${tenantId}`);
            const info = document.getElementById(`tenant-presence-${tenantId}`);
            if (dot && info) {
                if (data.online) {
                    dot.className = 'inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)] animate-pulse';
                    const rt = data.runtime || {};
                    const extra = rt.active_orders !== undefined ? ` • ${rt.active_orders} ${window.cnxT?window.cnxT('js.m_sa.61abc818','đơn'):'đơn'}` : '';
                    info.className = 'text-[10px] text-emerald-300 truncate max-w-[165px]';
                    info.textContent = `Online • ${data.latency_ms}ms${extra}`;
                    info.title = `IP: ${data.last_check_ip || 'N/A'} ${window.cnxT?window.cnxT('js.m_sa.e3be84e7','| Phản hồi:'):'| Phản hồi:'} ${data.latency_ms}ms | Check: ${data.last_check_at || (window.cnxT?window.cnxT('js.m_sa.300f9719','vừa xong'):'vừa xong')}`;
                } else {
                    dot.className = 'inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-slate-500';
                    info.className = 'text-[10px] text-slate-400 truncate max-w-[165px]';
                    info.textContent = data.last_check_at ? `Offline • ${data.last_check_at}` : (window.cnxT?window.cnxT('js.m_sa.43e1ebb0','Offline • Không phản hồi'):'Offline • Không phản hồi');
                    info.title = data.reason || (window.cnxT?window.cnxT('js.m_sa.5ee92596','Store đang tắt hoặc mất mạng'):'Store đang tắt hoặc mất mạng');
                }
            }
            const t = this.tenants.find(x => x.id === tenantId);
            const needRowRefresh = !!(data.online && t && (!t.machine_id || !t.lan_ip || !t.wan_ip));
            if (t) {
                t.is_tunnel_online = !!data.online;
                t.last_ping_latency_ms = data.latency_ms || -1;
                if (data.last_check_at) t.last_check_at = data.last_check_at;
            }
            if (needRowRefresh) {
                this.loadTenants();
            }
        } catch (err) {
            alert((window.cnxT?window.cnxT('js.m_sa.905e39da','Lỗi kiểm tra Store: '):'Lỗi kiểm tra Store: ') + err.message);
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = origHtml;
            }
        }
    },

    async checkAllStoresOnline(btnEl) {
        const origHtml = btnEl ? btnEl.innerHTML : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = (window.cnxT?window.cnxT('js.m_sa.2021f2f6','<i class="fas fa-spinner fa-spin"></i> <span>Đang kiểm tra...</span>'):'<i class="fas fa-spinner fa-spin"></i> <span>Đang kiểm tra...</span>');
        }
        try {
            const res = await fetch('api/super_admin.php?action=check_store_online');
            const data = await res.json();
            if (data.success && Array.isArray(data.results)) {
                let onCount = 0;
                data.results.forEach(r => {
                    if (r.online) onCount++;
                    const dot = document.getElementById(`tenant-dot-${r.tenant_id}`);
                    const info = document.getElementById(`tenant-presence-${r.tenant_id}`);
                    if (dot && info) {
                        if (r.online) {
                            dot.className = 'inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)] animate-pulse';
                            info.className = 'text-[10px] text-emerald-300 truncate max-w-[165px]';
                            info.textContent = `Online • ${r.latency_ms}ms`;
                        } else {
                            dot.className = 'inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-slate-500';
                            info.className = 'text-[10px] text-slate-400 truncate max-w-[165px]';
                            info.textContent = r.last_check_at ? `Offline • ${r.last_check_at}` : 'Offline';
                        }
                    }
                });
                this.showToast(`${window.cnxT?window.cnxT('js.m_sa.24959ae8','Hoàn tất kiểm tra'):'Hoàn tất kiểm tra'} ${data.results.length} ${window.cnxT?window.cnxT('js.m_sa.9ca85ba1','cửa hàng:'):'cửa hàng:'} ${onCount} Online • ${data.results.length - onCount} Offline`, onCount > 0 ? 'success' : 'info');
            }
        } catch (err) {
            this.showToast((window.cnxT?window.cnxT('js.m_sa.e2bdf558','Lỗi kiểm tra toàn bộ Store: '):'Lỗi kiểm tra toàn bộ Store: ') + err.message, 'error');
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = origHtml;
            }
        }
    },

    async retryStorePackage(tenantId) {
        if (!confirm((window.cnxT?window.cnxT('js.m_sa.4f581775','Chỉ thử lại sau khi kiểm tra thư mục gói và nhật ký trên máy chủ. Tiếp tục?'):'Chỉ thử lại sau khi kiểm tra thư mục gói và nhật ký trên máy chủ. Tiếp tục?'))) return;
        try {
            const res = await fetch('api/super_admin.php?action=retry_store_package', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenantId })
            });
            const data = await res.json();
            alert(data.message || (window.cnxT?window.cnxT('js.m_sa.69eff4d7','Không thể tạo gói quán.'):'Không thể tạo gói quán.'));
            await this.loadTenants();
        } catch (err) {
            alert((window.cnxT?window.cnxT('js.m_sa.a0fdb15b','Lỗi kết nối máy chủ; kiểm tra trạng thái trước khi thử lại.'):'Lỗi kết nối máy chủ; kiểm tra trạng thái trước khi thử lại.'));
        }
    },

    // --- 3. MODULE PERMISSIONS MATRIX (ON / OFF SWITCHES) ---
    async openModulePermissions(tenantId) {
        try {
            const res = await fetch(`api/super_admin.php?action=get_tenant_detail&id=${tenantId}`);
            const data = await res.json();
            if (!data.success) {
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.cb0821f4','Lỗi tải dữ liệu'):'Lỗi tải dữ liệu'));
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

        container.innerHTML = modules.map(m => {
            const isBlocked = Boolean(m.is_blocked || m.state === 'BLOCKED');
            const isEnabled = Boolean(m.is_enabled) && !isBlocked;
            const stateStr = isBlocked ? 'BLOCKED' : (isEnabled ? 'ON' : 'OFF');
            const stateColor = isBlocked ? 'text-rose-400' : (isEnabled ? 'text-emerald-400' : 'text-slate-500');
            const cardFeeHtml = m.code === 'mod_card_payment' ? `
                <div class="mt-2 pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-2 text-[11px]">
                    <span class="text-indigo-300 font-semibold"><i class="fas fa-percent mr-1"></i>${window.cnxT?window.cnxT('js.m_sa.5282b2bd','Phí nền tảng Master / giao dịch:'):'Phí nền tảng Master / giao dịch:'}</span>
                    <input id="input-card-fee-${tenantId}" type="number" step="0.1" min="0" max="20" value="${Number(m.card_fee_percent ?? 0)}" class="w-16 px-2 py-0.5 rounded bg-slate-900 border border-indigo-500/40 text-white font-mono text-xs text-right" />
                    <span class="text-slate-400">%</span>
                    <button type="button" onclick="SuperAdmin.saveMasterCardFee(${tenantId})" class="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold text-[10px] transition">
                        <i class="fas fa-floppy-disk mr-1"></i>${window.cnxT?window.cnxT('js.m_sa.190af610','Lưu Phí'):'Lưu Phí'}
                    </button>
                    <span class="text-[10px] text-slate-400">${window.cnxT?window.cnxT('js.m_sa.2b145986','(10 dòng máy POS/SmartPOS đời mới PCI PTS 5.x/6.x)'):'(10 dòng máy POS/SmartPOS đời mới PCI PTS 5.x/6.x)'}</span>
                </div>
            ` : '';

            return `
            <div id="module-row-${m.code}" class="sa-module-row ${isEnabled ? 'is-enabled' : 'is-disabled'} ${isBlocked ? 'border-rose-500/40 bg-rose-950/15' : ''} flex items-center justify-between p-3.5 rounded-2xl">
                <div class="flex items-center gap-3.5 pr-3">
                    <div class="w-10 h-10 rounded-xl bg-${m.badge_color}-500/20 border border-${m.badge_color}-500/30 flex items-center justify-center text-${m.badge_color}-400 text-base shrink-0">
                        <i class="fas ${m.icon}"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-xs text-white">${m.name}</span>
                            <span class="px-2 py-0.2 rounded-full text-[9px] font-bold uppercase bg-${m.badge_color}-500/20 text-${m.badge_color}-300 border border-${m.badge_color}-500/30">
                                ${m.badge}
                            </span>
                            ${m.addon ? `<span class="text-[9px] font-mono font-bold text-amber-300">+${(m.price_month || 0).toLocaleString('vi-VN')} đ/tháng</span>` : ''}
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5 leading-snug">${m.desc}</div>
                        ${cardFeeHtml}
                    </div>
                </div>

                <div class="shrink-0 flex items-center gap-2">
                    <span id="badge-toggle-label-${m.code}" class="text-[11px] font-mono font-bold ${stateColor}">
                        ${stateStr}
                    </span>
                    ${!m.required ? `
                    <button id="btn-block-mod-${m.code}" type="button" onclick="SuperAdmin.toggleBlockModule(${tenantId}, '${m.code}')" title="${isBlocked ? 'Bỏ khóa (Unblock) module này' : (window.cnxT?window.cnxT('js.m_sa.a6befab6','Khóa cưỡng chế (BLOCK) module này từ Master'):'Khóa cưỡng chế (BLOCK) module này từ Master')}" class="px-2 py-1 rounded-lg text-[10px] font-bold border transition ${isBlocked ? 'bg-rose-600 text-white border-rose-400 shadow-sm shadow-rose-500/30' : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-rose-300 hover:border-rose-500/40'}">
                        <i class="fas fa-ban mr-0.5"></i>${isBlocked ? 'ĐÃ BLOCK' : 'BLOCK'}
                    </button>
                    ` : ''}
                    <label class="sa-module-switch" title="${m.required ? 'Module bắt buộc' : (isEnabled ? 'Tắt module' : (window.cnxT?window.cnxT('js.m_sa.7476d7c0','Bật module'):'Bật module'))}">
                        <input id="module-switch-${m.code}" type="checkbox" role="switch" aria-label="Bật hoặc tắt ${m.name}" onchange="SuperAdmin.toggleSingleModule(${tenantId}, '${m.code}', this.checked, this)" class="sa-module-switch__input" ${isEnabled ? 'checked' : ''} ${m.required ? 'disabled' : ''} />
                        <span class="sa-module-switch__track" aria-hidden="true"><span class="sa-module-switch__thumb"></span></span>
                    </label>
                </div>
            </div>
        `}).join('');
    },

    setModuleToggleState(moduleCode, isEnabled, isBlocked = false) {
        const label = document.getElementById(`badge-toggle-label-${moduleCode}`);
        if (label) {
            label.textContent = isBlocked ? 'BLOCKED' : (isEnabled ? 'ON' : 'OFF');
            label.className = `text-[11px] font-mono font-bold ${isBlocked ? 'text-rose-400' : (isEnabled ? 'text-emerald-400' : 'text-slate-500')}`;
        }

        const switchInput = document.getElementById(`module-switch-${moduleCode}`);
        if (switchInput) {
            switchInput.checked = Boolean(isEnabled && !isBlocked);
            if (switchInput.parentElement) {
                switchInput.parentElement.title = isEnabled ? 'Tắt module' : (window.cnxT?window.cnxT('js.m_sa.7476d7c0','Bật module'):'Bật module');
            }
        }

        const blockBtn = document.getElementById(`btn-block-mod-${moduleCode}`);
        if (blockBtn) {
            blockBtn.className = `px-2 py-1 rounded-lg text-[10px] font-bold border transition ${isBlocked ? 'bg-rose-600 text-white border-rose-400 shadow-sm shadow-rose-500/30' : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-rose-300 hover:border-rose-500/40'}`;
            blockBtn.innerHTML = `<i class="fas fa-ban mr-0.5"></i>${isBlocked ? 'ĐÃ BLOCK' : 'BLOCK'}`;
        }

        const row = document.getElementById(`module-row-${moduleCode}`);
        if (row) {
            row.classList.toggle('is-enabled', Boolean(isEnabled && !isBlocked));
            row.classList.toggle('is-disabled', !isEnabled || isBlocked);
            row.classList.toggle('border-rose-500/40', isBlocked);
            row.classList.toggle('bg-rose-950/15', isBlocked);
        }
    },

    async toggleBlockModule(tenantId, moduleCode) {
        const label = document.getElementById(`badge-toggle-label-${moduleCode}`);
        const currentlyBlocked = label && label.textContent.trim() === 'BLOCKED';
        const nextState = currentlyBlocked ? 'OFF' : 'BLOCKED';

        try {
            const res = await fetch('api/super_admin.php?action=toggle_module', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    module_code: moduleCode,
                    state: nextState,
                    blocked: nextState === 'BLOCKED' ? 1 : 0,
                    enabled: 0
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || (window.cnxT?window.cnxT('js.m_sa.ccc6a321','Không thể cập nhật trạng thái BLOCK module.'):'Không thể cập nhật trạng thái BLOCK module.'));
            }
            this.setModuleToggleState(moduleCode, false, nextState === 'BLOCKED');
            this.loadTenants();
        } catch (err) {
            alert(err.message || (window.cnxT?window.cnxT('js.m_sa.39909e42','Lỗi kết nối máy chủ khi khóa module.'):'Lỗi kết nối máy chủ khi khóa module.'));
        }
    },

    async saveMasterCardFee(tenantId) {
        const input = document.getElementById(`input-card-fee-${tenantId}`);
        const feeVal = parseFloat(input?.value || '0') || 0;
        try {
            const res = await fetch('api/super_admin.php?action=save_card_fee', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    card_fee_percent: feeVal
                })
            });
            const data = await res.json();
            alert(data.message || (window.cnxT?window.cnxT('js.m_sa.e9da3926','Đã lưu cấu hình phí giao dịch thẻ!'):'Đã lưu cấu hình phí giao dịch thẻ!'));
        } catch (err) {
            alert((window.cnxT?window.cnxT('js.m_sa.b64584c0','Lỗi kết nối khi lưu phí giao dịch thẻ.'):'Lỗi kết nối khi lưu phí giao dịch thẻ.'));
        }
    },

    async toggleSingleModule(tenantId, moduleCode, isChecked, input) {
        const switchInput = input || document.getElementById(`module-switch-${moduleCode}`);
        if (switchInput) switchInput.disabled = true;
        this.setModuleToggleState(moduleCode, isChecked, false);

        try {
            const res = await fetch('api/super_admin.php?action=toggle_module', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    module_code: moduleCode,
                    state: isChecked ? 'ON' : 'OFF',
                    blocked: 0,
                    enabled: isChecked ? 1 : 0
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || (window.cnxT?window.cnxT('js.m_sa.fac177a9','Không thể cập nhật quyền module.'):'Không thể cập nhật quyền module.'));
            }
            this.loadTenants();
        } catch (err) {
            console.error('toggleSingleModule error:', err);
            if (switchInput) switchInput.checked = !isChecked;
            this.setModuleToggleState(moduleCode, !isChecked);
            alert(err.message || (window.cnxT?window.cnxT('js.m_sa.f9d0f6f4','Không thể kết nối để cập nhật quyền module.'):'Không thể kết nối để cập nhật quyền module.'));
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
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.df927415','Lỗi gia hạn'):'Lỗi gia hạn'));
            }
        } catch (err) {
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
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
                alert(tl.message || (window.cnxT?window.cnxT('js.m_sa.b768c673','Lỗi tải thông tin giấy phép'):'Lỗi tải thông tin giấy phép')); 
                return; 
            }
            const o = ov.data || {}, d = tl.data || {};

            // Cập nhật thông tin lên Modal
            const elStore = document.getElementById('lic-store-name');
            if (elStore) elStore.textContent = `${window.cnxT?window.cnxT('ui.sa_html.span_10d06664','Cửa hàng:'):'Cửa hàng:'} ${d.store_name || '--'}`;

            const elKey = document.getElementById('lic-key-display');
            if (elKey) elKey.textContent = d.license_key || (window.cnxT?window.cnxT('js.m_sa.80fc267a','LIC-CHƯA-CẤP-MÃ'):'LIC-CHƯA-CẤP-MÃ');

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
                    elNodeStatus.innerHTML = (window.cnxT?window.cnxT('js.m_sa.e764f2b4','<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>ĐÃ KHÓA PHẦN CỨNG'):'<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>ĐÃ KHÓA PHẦN CỨNG');
                }
                if (elMachineId) {
                    elMachineId.textContent = d.machine_id;
                    elMachineId.className = 'font-mono font-bold text-emerald-300 truncate max-w-[280px]';
                }
                if (elMachineName) elMachineName.textContent = d.machine_name || (window.cnxT?window.cnxT('js.m_sa.341733e8','PC Quán POS'):'PC Quán POS');
                if (elMachineBound) elMachineBound.textContent = d.machine_bound_at || '—';
                if (btnReset) {
                    btnReset.disabled = false;
                    btnReset.classList.remove('opacity-40', 'cursor-not-allowed');
                }
            } else {
                if (elNodeStatus) {
                    elNodeStatus.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5';
                    elNodeStatus.innerHTML = (window.cnxT?window.cnxT('js.m_sa.0b7b8ad7','<i class="fas fa-unlock text-[9px]"></i>CHƯA GẮN MÁY (Sẵn sàng kích hoạt)'):'<i class="fas fa-unlock text-[9px]"></i>CHƯA GẮN MÁY (Sẵn sàng kích hoạt)');
                }
                if (elMachineId) {
                    elMachineId.textContent = (window.cnxT?window.cnxT('js.m_sa.04837457','(Chưa kích hoạt trên máy nào)'):'(Chưa kích hoạt trên máy nào)');
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
                    elLastCheck.textContent = (window.cnxT?window.cnxT('ui.sa_html.span_d36f5dad','Chưa lần nào'):'Chưa lần nào');
                }
            }

            const elGrace = document.getElementById('lic-grace-input');
            if (elGrace) elGrace.value = o.grace_days ?? 7;

            this.openModal('modal-tenant-license');
        } catch (err) {
            console.error('openLicense error:', err);
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
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
            btnText.innerHTML = (window.cnxT?window.cnxT('js.m_sa.59567cfa','<i class="fas fa-check text-emerald-400"></i> Đã chép!'):'<i class="fas fa-check text-emerald-400"></i> Đã chép!');
            setTimeout(() => { btnText.textContent = original; }, 2000);
        }
    },

    async doResetMachine() {
        if (!this.currentLicenseTenantId) return;
        if (!confirm((window.cnxT?window.cnxT('js.m_sa.b29869a8','Bạn có chắc chắn muốn GỠ KHÓA PHẦN CỨNG cho cửa hàng này?\n\nSau khi gỡ, mã máy cũ sẽ bị hủy liên kết và quán có thể mở ứng dụng trên máy tính mới để kích hoạt lại.'):'Bạn có chắc chắn muốn GỠ KHÓA PHẦN CỨNG cho cửa hàng này?\n\nSau khi gỡ, mã máy cũ sẽ bị hủy liên kết và quán có thể mở ứng dụng trên máy tính mới để kích hoạt lại.'))) return;
        try {
            const r = await this.licApi('reset_machine', { tenant_id: this.currentLicenseTenantId });
            alert(r.message || (window.cnxT?window.cnxT('js.m_sa.06d919ff','Đã gỡ liên kết phần cứng thành công!'):'Đã gỡ liên kết phần cứng thành công!'));
            this.openLicense(this.currentLicenseTenantId);
            this.loadTenants();
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.656450bb','Lỗi gỡ khóa phần cứng: '):'Lỗi gỡ khóa phần cứng: ') + e.message);
        }
    },

    async doRegenerateKey() {
        if (!this.currentLicenseTenantId) return;
        if (!confirm((window.cnxT?window.cnxT('js.m_sa.480299cc','CẢNH BÁO NGUY HIỂM:\nCấp mã License Key MỚI sẽ THU HỒI key cũ ngay lập tức!\n\nQuán sẽ không thể đồng bộ cho đến khi nhập mã key mới này. Bạn có muốn tiếp tục?'):'CẢNH BÁO NGUY HIỂM:\nCấp mã License Key MỚI sẽ THU HỒI key cũ ngay lập tức!\n\nQuán sẽ không thể đồng bộ cho đến khi nhập mã key mới này. Bạn có muốn tiếp tục?'))) return;
        try {
            const r = await this.licApi('regenerate_license_key', { tenant_id: this.currentLicenseTenantId });
            alert(r.message + (r.license_key ? (window.cnxT?window.cnxT('js.m_sa.579f5578','\n\nMã mới: '):'\n\nMã mới: ') + r.license_key : ''));
            this.openLicense(this.currentLicenseTenantId);
            this.loadTenants();
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.8f5793a7','Lỗi cấp lại mã license: '):'Lỗi cấp lại mã license: ') + e.message);
        }
    },

    async saveGraceDays() {
        const input = document.getElementById('lic-grace-input');
        const val = parseInt(input?.value || '7', 10);
        try {
            const r = await this.licApi('license_save_grace', { grace_days: val });
            alert(r.message || (window.cnxT?window.cnxT('js.m_sa.4f22b05d','Đã lưu cấu hình thời gian ân hạn offline!'):'Đã lưu cấu hình thời gian ân hạn offline!'));
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.0e06219d','Lỗi lưu ân hạn: '):'Lỗi lưu ân hạn: ') + e.message);
        }
    },
    async toggleTenantStatus(tenantId, newStatus) {
        const confirmMsg = newStatus === 'suspended' 
            ? 'Bạn có chắc chắn muốn TẠM KHÓA cửa hàng này? Khi bị khóa, khách hàng sẽ không thể truy cập các module bán hàng!' 
            : (window.cnxT?window.cnxT('js.m_sa.0d4d30a8','Mở khóa và cho phép cửa hàng hoạt động bình thường?'):'Mở khóa và cho phép cửa hàng hoạt động bình thường?');

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
            alert((window.cnxT?window.cnxT('js.m_sa.b30e5784','Lỗi máy chủ'):'Lỗi máy chủ'));
        }
    },

    // --- 5. ADD / EDIT TENANT FORM ---
    openNewTenantModal() {
        this.logoProcessingGeneration++;
        this.logoProcessing = null;
        this.pendingTenantLogo = null;
        document.getElementById('form-tenant-logo').disabled = false;
        document.getElementById('tenant-modal-title').innerText = (window.cnxT?window.cnxT('ui.sa_html.h3_e26e2990','Thêm Cửa Hàng / Khách Hàng Mới'):'Thêm Cửa Hàng / Khách Hàng Mới');
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
        document.getElementById('form-tenant-rep-role').value = (window.cnxT?window.cnxT('js.m_sa.524269de','Chủ hộ kinh doanh'):'Chủ hộ kinh doanh');
        document.getElementById('form-tenant-legal-entity').value = '';
        document.getElementById('form-tenant-tax-id').value = '';
        document.getElementById('form-tenant-phone').value = '';
        document.getElementById('form-tenant-email').value = '';
        document.getElementById('form-tenant-address').value = '';
        document.getElementById('form-tenant-billing-address').value = '';
        document.getElementById('form-tenant-note').value = '';
        const smWrap = document.getElementById('form-tenant-start-mode-wrap');
        const smEl = document.getElementById('form-tenant-start-mode');
        if (smWrap) smWrap.style.display = '';
        if (smEl) smEl.value = 'standard';
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
        document.getElementById('tenant-modal-title').innerText = `${window.cnxT?window.cnxT('js.m_sa.7a187d55','Chỉnh Sửa Thông Tin:'):'Chỉnh Sửa Thông Tin:'} ${t.store_name}`;
        document.getElementById('form-tenant-id').value = t.id;
        const code = document.getElementById('form-tenant-code');
        code.value = t.tenant_code;
        code.readOnly = true;
        code.required = false;
        code.removeAttribute('pattern');
        document.getElementById('form-tenant-store-name').value = t.store_name;
        document.getElementById('form-tenant-owner-name').value = t.owner_name;
        document.getElementById('form-tenant-rep-role').value = t.representative_role || (window.cnxT?window.cnxT('js.m_sa.524269de','Chủ hộ kinh doanh'):'Chủ hộ kinh doanh');
        document.getElementById('form-tenant-legal-entity').value = t.legal_entity_name || '';
        document.getElementById('form-tenant-tax-id').value = t.tax_id_or_cccd || '';
        document.getElementById('form-tenant-phone').value = t.phone;
        document.getElementById('form-tenant-email').value = t.email || '';
        document.getElementById('form-tenant-address').value = t.address || '';
        document.getElementById('form-tenant-billing-address').value = t.billing_address || t.address || '';
        const smWrap = document.getElementById('form-tenant-start-mode-wrap');
        if (smWrap) smWrap.style.display = 'none';
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
            alert(error.message || (window.cnxT?window.cnxT('js.m_sa.4d13157b','Không thể chuẩn hóa logo cửa hàng.'):'Không thể chuẩn hóa logo cửa hàng.'));
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
        submitLabel.textContent = (window.cnxT?window.cnxT('js.m_sa.ad22d992','Đang lưu, vui lòng chờ...'):'Đang lưu, vui lòng chờ...');
        const payload = {
            id: parseInt(document.getElementById('form-tenant-id').value),
            tenant_code: document.getElementById('form-tenant-code').value.trim(),
            store_name: document.getElementById('form-tenant-store-name').value.trim(),
            owner_name: document.getElementById('form-tenant-owner-name').value.trim(),
            representative_role: document.getElementById('form-tenant-rep-role').value.trim(),
            legal_entity_name: document.getElementById('form-tenant-legal-entity').value.trim(),
            tax_id_or_cccd: document.getElementById('form-tenant-tax-id').value.trim(),
            phone: document.getElementById('form-tenant-phone').value.trim(),
            email: document.getElementById('form-tenant-email').value.trim(),
            address: document.getElementById('form-tenant-address').value.trim(),
            billing_address: document.getElementById('form-tenant-billing-address').value.trim(),
            plan_id: parseInt(document.getElementById('form-tenant-plan').value),
            expire_date: document.getElementById('form-tenant-expire-date').value,
            note: document.getElementById('form-tenant-note').value.trim(),
            start_mode: document.getElementById('form-tenant-start-mode')?.value || 'standard'
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
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.d8f4ffd5','Lỗi lưu thông tin'):'Lỗi lưu thông tin'));
                if (data.tenant_saved) {
                    this.closeModal('modal-tenant-form');
                    this.loadTenants();
                    this.loadDashboard();
                }
            }
        } catch (err) {
            alert((window.cnxT?window.cnxT('js.m_sa.885939e8','Không nhận được kết quả từ máy chủ. Hãy kiểm tra danh sách cửa hàng và trạng thái cấp phát trước khi thử lại.'):'Không nhận được kết quả từ máy chủ. Hãy kiểm tra danh sách cửa hàng và trạng thái cấp phát trước khi thử lại.'));
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
                            <span class="text-xs text-slate-400">${window.cnxT?window.cnxT('js.m_sa.5b7f82a9','/ tháng'):'/ tháng'}</span>
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono">
                            ${window.cnxT?window.cnxT('js.m_sa.5b886227','Hoặc'):'Hoặc'} <b>${(p.price_year || 0).toLocaleString('vi-VN')} đ</b> ${window.cnxT?window.cnxT('js.m_sa.e4022154','/ năm (Tiết kiệm 20%)'):'/ năm (Tiết kiệm 20%)'}
                        </div>
                    </div>
                </div>

                <div class="pt-3 border-t border-white/10">
                    <div class="text-[11px] text-slate-400 mb-2 font-semibold">${window.cnxT?window.cnxT('js.m_sa.4370d292','Bao gồm các module:'):'Bao gồm các module:'}</div>
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
        const selfTbody = document.getElementById('self-billing-orders-tbody');
        if (selfTbody) {
            try {
                const bRes = await fetch('/api/billing/orders');
                const bData = await bRes.json();
                if (bData.success) {
                    const rows = bData.data || [];
                    selfTbody.innerHTML = rows.length === 0
                        ? `<tr><td colspan="7" class="text-center py-5 text-slate-500">${window.cnxT?window.cnxT('js.m_sa.941f56c3','Chưa có đơn tự gia hạn / mua AI Credit nào.'):'Chưa có đơn tự gia hạn / mua AI Credit nào.'}</td></tr>`
                        : rows.map(r => {
                            const isPaid = r.status === 'paid';
                            const svc = r.billing_type === 'buy_ai_credits' ? `+${r.quantity} AI Credits` : `${window.cnxT?window.cnxT('js.m_sa.ed9085d8','Gia hạn'):'Gia hạn'} ${r.quantity} ${window.cnxT?window.cnxT('js.m_sa.dc4a0e29','tháng'):'tháng'}`;
                            return `
                                <tr class="hover:bg-white/5">
                                    <td class="py-2.5 px-4 font-mono font-bold text-amber-300">${r.order_code}</td>
                                    <td class="py-2.5 px-4 font-bold text-white">${r.store_name || r.tenant_code} <span class="text-[10px] font-mono text-slate-400">(${r.tenant_code})</span></td>
                                    <td class="py-2.5 px-4 text-sky-300 font-semibold">${svc}</td>
                                    <td class="py-2.5 px-4 font-mono font-bold text-emerald-400">${(Number(r.amount_vnd) || 0).toLocaleString('vi-VN')} đ</td>
                                    <td class="py-2.5 px-4 font-mono text-[11px] text-slate-400">${r.created_at || ''}</td>
                                    <td class="py-2.5 px-4 text-center">
                                        ${isPaid
                                            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">${window.cnxT?window.cnxT('js.m_sa.724ace49','Đã Duyệt'):'Đã Duyệt'}</span>`
                                            : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">${window.cnxT?window.cnxT('js.m_sa.ea4a4017','Chờ CK'):'Chờ CK'}</span>`}
                                    </td>
                                    <td class="py-2.5 px-4 text-right">
                                        ${isPaid
                                            ? `<span class="text-[11px] text-slate-500 font-mono">${r.paid_at || ''}</span>`
                                            : `<button type="button" onclick="SuperAdmin.confirmSelfBillingOrder('${r.order_code}')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">${window.cnxT?window.cnxT('js.m_sa.67f94d07','Duyệt Đã Nhận Tiền'):'Duyệt Đã Nhận Tiền'}</button>`}
                                    </td>
                                </tr>
                            `;
                        }).join('');
                }
            } catch (e) {}
        }

        const tbody = document.getElementById('invoices-table-body');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>${window.cnxT?window.cnxT('js.m_sa.4bfcdb3f','Đang tải hóa đơn...'):'Đang tải hóa đơn...'}</td></tr>`;

        try {
            const res = await fetch('api/super_admin.php?action=get_invoices');
            const data = await res.json();
            if (data.success) {
                const invoices = data.data || [];
                if (invoices.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-400">${window.cnxT?window.cnxT('js.m_sa.f15a4543','Chưa có giao dịch thu phí nào.'):'Chưa có giao dịch thu phí nào.'}</td></tr>`;
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
                                ${window.cnxT?window.cnxT('js.m_sa.c82d1288','Đã Thu'):'Đã Thu'}
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

    async confirmSelfBillingOrder(orderCode) {
        if (!confirm(`${window.cnxT?window.cnxT('js.m_sa.a73dbda2','Xác nhận đã nhận tiền đơn'):'Xác nhận đã nhận tiền đơn'} ${orderCode} ${window.cnxT?window.cnxT('js.m_sa.e61c028e','và tự động gia hạn / cộng AI Credit cho quán?'):'và tự động gia hạn / cộng AI Credit cho quán?'}`)) return;
        try {
            const res = await fetch('/api/billing/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_code: orderCode })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.m_sa.058d69f0','Lỗi duyệt đơn'):'Lỗi duyệt đơn'));
            this.showToast(data.message || (window.cnxT?window.cnxT('js.m_sa.7ae402b3','Đã duyệt thành công!'):'Đã duyệt thành công!'), 'success');
            this.loadBilling();
            if (typeof this.loadDashboard === 'function') this.loadDashboard();
        } catch (e) {
            alert(e.message || (window.cnxT?window.cnxT('js.m_sa.058d69f0','Lỗi duyệt đơn'):'Lỗi duyệt đơn'));
        }
    },

    printInvoiceModal(iv) {
        const content = document.getElementById('printable-receipt-content');
        if (!content) return;

        content.innerHTML = `
            <div class="text-center pb-3 border-b border-dashed border-slate-300">
                <div class="font-black text-sm uppercase">${window.cnxT?window.cnxT('js.m_sa.cc3cc7ad','PHIẾU XÁC NHẬN BẢN QUYỀN SALEAPP'):'PHIẾU XÁC NHẬN BẢN QUYỀN SALEAPP'}</div>
                <div class="text-[10px] text-slate-500 font-mono">Mã: ${iv.invoice_code}</div>
            </div>
            <div class="space-y-1.5 pt-2 text-xs">
                <div class="flex justify-between">
                    <span class="text-slate-500">${window.cnxT?window.cnxT('js.m_sa.de50ac3c','Khách Hàng:'):'Khách Hàng:'}</span>
                    <span class="font-bold">${iv.store_name}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500">${window.cnxT?window.cnxT('js.m_sa.bf76ac9b','Gói Dịch Vụ:'):'Gói Dịch Vụ:'}</span>
                    <span class="font-bold text-purple-700">${iv.plan_name}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500">${window.cnxT?window.cnxT('js.m_sa.963711fa','Thời Gian Sử Dụng:'):'Thời Gian Sử Dụng:'}</span>
                    <span class="font-mono">${iv.duration_months} tháng</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500">${window.cnxT?window.cnxT('js.m_sa.4fb3a8c3','Hiệu Lực:'):'Hiệu Lực:'}</span>
                    <span class="font-mono">${iv.start_date} &rarr; ${iv.expire_date}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500">${window.cnxT?window.cnxT('js.m_sa.78c12c0d','Phương Thức:'):'Phương Thức:'}</span>
                    <span class="uppercase font-mono">${iv.payment_method}</span>
                </div>
                <div class="flex justify-between pt-2 border-t border-slate-300 text-sm font-black">
                    <span>${window.cnxT?window.cnxT('js.m_sa.45f76967','TỔNG TIỀN THU:'):'TỔNG TIỀN THU:'}</span>
                    <span class="text-emerald-700 font-mono">${(parseFloat(iv.amount) || 0).toLocaleString('vi-VN')} VNĐ</span>
                </div>
            </div>
            <div class="text-center text-[10px] text-slate-500 pt-3 border-t border-dashed border-slate-300 italic">
                ${window.cnxT?window.cnxT('js.m_sa.66e21329','Cảm ơn Quý khách đã tin dùng phần mềm quản lý bán hàng SaleApp!'):'Cảm ơn Quý khách đã tin dùng phần mềm quản lý bán hàng SaleApp!'}
            </div>
        `;

        this.openModal('modal-print-invoice');
    },

    // --- 8. SAAS SETTINGS & VIETQR ---
    async syncMasterUrlToAllStores() {
        const pub = document.getElementById('cfg-master-public-url')?.value.trim() || '';
        const fb = document.getElementById('cfg-master-fallback-url')?.value.trim() || '';
        if (!pub) { alert((window.cnxT?window.cnxT('js.m_sa.598a4063','Vui lòng nhập Tên miền / URL Master chính!'):'Vui lòng nhập Tên miền / URL Master chính!')); return; }
        if (!confirm(`${window.cnxT?window.cnxT('js.m_sa.a4d19881','Lưu URL Master:\\n- Chính:'):'Lưu URL Master:\\n- Chính:'} ${pub}${window.cnxT?window.cnxT('js.m_sa.34fbe03d','\\n- Dự phòng:'):'\\n- Dự phòng:'} ${fb || (window.cnxT?window.cnxT('js.m_sa.7bde15b3','(Không)'):'(Không)')}${window.cnxT?window.cnxT('js.m_sa.3c5a8753','\\n\\nvà đẩy đồng bộ xuống TẤT CẢ các quán đang hoạt động?'):'\\n\\nvà đẩy đồng bộ xuống TẤT CẢ các quán đang hoạt động?'}`)) return;
        const btn = document.getElementById('btn-sync-master-url');
        if (btn) btn.disabled = true;
        try {
            const res = await fetch('api/super_admin.php?action=sync_master_url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ master_public_url: pub, master_fallback_url: fb })
            }).then(r => r.json());
            alert(res.message || (window.cnxT?window.cnxT('js.m_sa.ea86de15','Đã đồng bộ!'):'Đã đồng bộ!'));
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.e5f87ad3','Lỗi kết nối: '):'Lỗi kết nối: ') + e.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    },

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
                if (document.getElementById('cfg-master-public-url')) {
                    document.getElementById('cfg-master-public-url').value = s.master_public_url || '';
                }
                if (document.getElementById('cfg-master-fallback-url')) {
                    document.getElementById('cfg-master-fallback-url').value = s.master_fallback_url || '';
                }
                if (document.getElementById('cfg-wan-tunnel-enabled')) {
                    document.getElementById('cfg-wan-tunnel-enabled').checked = String(s.wan_tunnel_enabled ?? '1') !== '0';
                }
                if (s.wan_poll_timeout_sec && document.getElementById('cfg-wan-poll-timeout')) {
                    document.getElementById('cfg-wan-poll-timeout').value = s.wan_poll_timeout_sec;
                }
                if (s.wan_check_timeout_ms && document.getElementById('cfg-wan-check-timeout')) {
                    document.getElementById('cfg-wan-check-timeout').value = s.wan_check_timeout_ms;
                }
                if (s.wan_heartbeat_interval_sec && document.getElementById('cfg-wan-heartbeat-sec')) {
                    document.getElementById('cfg-wan-heartbeat-sec').value = s.wan_heartbeat_interval_sec;
                }
                if (s.wan_retry_base_sec && document.getElementById('cfg-wan-retry-base')) {
                    document.getElementById('cfg-wan-retry-base').value = s.wan_retry_base_sec;
                }
                if (s.wan_retry_max_sec && document.getElementById('cfg-wan-retry-max')) {
                    document.getElementById('cfg-wan-retry-max').value = s.wan_retry_max_sec;
                }
                this.updateSaasQrPreview();
            } else {
                this.showSaasSettingsMessage(data.message || (window.cnxT?window.cnxT('js.m_sa.300dd586','Không tải được cấu hình SaaS.'):'Không tải được cấu hình SaaS.'), false);
            }
        } catch (err) {
            console.error('loadSaasSettings error:', err);
            this.showSaasSettingsMessage((window.cnxT?window.cnxT('js.m_sa.07ed1534','Không thể kết nối để tải cấu hình SaaS.'):'Không thể kết nối để tải cấu hình SaaS.'), false);
        }
    },

    async loadPackageStorage() {
        const field = document.getElementById('cfg-package-storage');
        const button = document.getElementById('cfg-package-storage-save');
        if (!field || !button) return;
        try {
            const response = await fetch('api/super_admin.php?action=get_package_storage');
            const data = await response.json();
            if (!data.success || typeof data.path !== 'string') throw new Error(data.message || (window.cnxT?window.cnxT('js.m_sa.525552d9','Không tải được thư mục gói.'):'Không tải được thư mục gói.'));
            field.value = data.path;
            field.disabled = false;
            button.disabled = false;
        } catch (error) {
            console.error('loadPackageStorage error:', error);
            this.showSaasSettingsMessage((window.cnxT?window.cnxT('js.m_sa.0cb3fd2b','Không thể tải thư mục gói. Kiểm tra cấu hình và nhật ký máy chủ.'):'Không thể tải thư mục gói. Kiểm tra cấu hình và nhật ký máy chủ.'), false);
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
            this.showSaasSettingsMessage(data.message || (window.cnxT?window.cnxT('js.m_sa.a2e8ccb2','Không thể lưu thư mục gói.'):'Không thể lưu thư mục gói.'), !!data.success);
        } catch (error) {
            console.error('savePackageStorage error:', error);
            this.showSaasSettingsMessage((window.cnxT?window.cnxT('js.m_sa.dcd9bd40','Lỗi kết nối khi lưu thư mục gói; kiểm tra lại trước khi thử.'):'Lỗi kết nối khi lưu thư mục gói; kiểm tra lại trước khi thử.'), false);
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

        if (namePreview) namePreview.textContent = accountName || (window.cnxT?window.cnxT('js.m_sa.e2dac778','Chưa nhập tên chủ tài khoản'):'Chưa nhập tên chủ tài khoản');
        if (detailsPreview) detailsPreview.textContent = [bankId || (window.cnxT?window.cnxT('js.m_sa.0dd7151e','Chưa chọn ngân hàng'):'Chưa chọn ngân hàng'), accountNo || (window.cnxT?window.cnxT('js.m_sa.6fcfbbd9','Chưa nhập số tài khoản'):'Chưa nhập số tài khoản')].join(' · ');
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
            this.showSaasSettingsMessage((window.cnxT?window.cnxT('js.m_sa.07d11adf','Vui lòng nhập số tài khoản trước khi sao chép.'):'Vui lòng nhập số tài khoản trước khi sao chép.'), false);
            return;
        }

        try {
            await navigator.clipboard.writeText(accountNo);
            this.showSaasSettingsMessage((window.cnxT?window.cnxT('js.m_sa.613e6577','Đã sao chép số tài khoản.'):'Đã sao chép số tài khoản.'), true);
        } catch (err) {
            console.error('copySaasBankAccount error:', err);
            this.showSaasSettingsMessage((window.cnxT?window.cnxT('js.m_sa.8e0d4813','Không thể sao chép tự động. Vui lòng chọn và sao chép số tài khoản.'):'Không thể sao chép tự động. Vui lòng chọn và sao chép số tài khoản.'), false);
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
            saas_grace_period_days: parseInt(document.getElementById('cfg-saas-grace-days').value || 3),
            wan_tunnel_enabled: document.getElementById('cfg-wan-tunnel-enabled')?.checked ? 1 : 0,
            wan_poll_timeout_sec: parseInt(document.getElementById('cfg-wan-poll-timeout')?.value || 25),
            wan_check_timeout_ms: parseInt(document.getElementById('cfg-wan-check-timeout')?.value || 4000),
            wan_heartbeat_interval_sec: parseInt(document.getElementById('cfg-wan-heartbeat-sec')?.value || 1800),
            wan_retry_base_sec: parseInt(document.getElementById('cfg-wan-retry-base')?.value || 5),
            wan_retry_max_sec: parseInt(document.getElementById('cfg-wan-retry-max')?.value || 60)
        };

        try {
            const res = await fetch('api/super_admin.php?action=save_saas_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            this.showSaasSettingsMessage(data.message || (data.success ? 'Đã lưu cài đặt.' : (window.cnxT?window.cnxT('js.m_sa.052561ed','Không thể lưu cài đặt.'):'Không thể lưu cài đặt.')), !!data.success);
        } catch (err) {
            console.error('saveSaasSettings error:', err);
            this.showSaasSettingsMessage((window.cnxT?window.cnxT('js.m_sa.d92d09ac','Lỗi kết nối máy chủ khi lưu cài đặt.'):'Lỗi kết nối máy chủ khi lưu cài đặt.'), false);
        }
    },

    async changePassword(e) {
        e.preventDefault();
        const newPass = document.getElementById('cfg-new-password').value.trim();
        if (newPass.length < 6) {
            alert((window.cnxT?window.cnxT('js.m_sa.987a5b7e','Mật khẩu mới phải có ít nhất 6 ký tự!'):'Mật khẩu mới phải có ít nhất 6 ký tự!'));
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
            alert((window.cnxT?window.cnxT('js.m_sa.b30e5784','Lỗi máy chủ'):'Lỗi máy chủ'));
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
                    errMsg.innerText = data.message || (window.cnxT?window.cnxT('js.m_sa.313d776d','Đăng nhập thất bại'):'Đăng nhập thất bại');
                    errBox.classList.remove('hidden');
                }
            }
        } catch (err) {
            if (errBox && errMsg) {
                errMsg.innerText = (window.cnxT?window.cnxT('js.m_sa.4b4344ff','Lỗi kết nối đến máy chủ'):'Lỗi kết nối đến máy chủ');
                errBox.classList.remove('hidden');
            }
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    },

    async handleLogout() {
        if (!confirm((window.cnxT?window.cnxT('js.m_sa.7366d6de','Bạn có muốn đăng xuất khỏi Super Admin?'):'Bạn có muốn đăng xuất khỏi Super Admin?'))) return;
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
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>${window.cnxT?window.cnxT('js.m_sa.7993d9dd','Đang tải dữ liệu hồ sơ và tài liệu...'):'Đang tải dữ liệu hồ sơ và tài liệu...'}</td></tr>`;
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
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.a5d59e49','Không thể tải thông tin hồ sơ.'):'Không thể tải thông tin hồ sơ.'));
            }
        } catch (err) {
            console.error('loadTenantPackages error:', err);
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
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
        if (nameEl) nameEl.textContent = `${tenant.store_name} ${window.cnxT?window.cnxT('js.m_sa.25562f26','• Gói:'):'• Gói:'} ${tenant.plan_name} ${window.cnxT?window.cnxT('js.m_sa.5a249c8c','(Hạn:'):'(Hạn:'} ${new Date(tenant.expire_date).toLocaleDateString('vi-VN')})`;
        if (dirEl) dirEl.textContent = `master/packages/${tenant.tenant_code}/`;
        if (countEl) countEl.textContent = docs.length;

        // KPI Status Cards
        const kpiContract = document.getElementById('pkg-kpi-contract');
        const kpiInvoice = document.getElementById('pkg-kpi-invoice');
        const kpiHandover = document.getElementById('pkg-kpi-handover');
        const kpiRelease = document.getElementById('pkg-kpi-release');
        const btnDownloadZip = document.getElementById('btn-pkg-download-zip');
        const btnGenRel = document.getElementById('btn-pkg-generate-release');
        const wfBar = document.getElementById('pkg-workflow-bar');
        const wfHint = document.getElementById('pkg-workflow-hint');
        const btnTrial = document.getElementById('btn-pkg-trial-7d');
        const btnPay = document.getElementById('btn-pkg-confirm-pay');
        const btnOverride = document.getElementById('btn-pkg-override');

        const stage = summary.workflow_stage || 'pending_contract';
        const isTrial = summary.release_mode === 'trial';
        const isPaid = !!summary.payment_confirmed || !!summary.has_invoice;
        const canGen = !!summary.can_generate_release;

        if (wfBar) {
            const steps = [
                { label: (window.cnxT?window.cnxT('js.m_sa.6f55715f','1. Khởi Tạo'):'1. Khởi Tạo'), dept: 'Sales', done: true, active: false },
                { label: (window.cnxT?window.cnxT('js.m_sa.49b662c8','2. Hợp Đồng'):'2. Hợp Đồng'), dept: 'Sales', done: !!summary.has_contract, active: stage === 'pending_contract' },
                { label: (window.cnxT?window.cnxT('js.m_sa.0ac42e97','3. Thanh Toán'):'3. Thanh Toán'), dept: (window.cnxT?window.cnxT('js.m_sa.5612e814','Kế toán'):'Kế toán'), done: isPaid, active: stage === 'pending_payment' },
                { label: (window.cnxT?window.cnxT('js.m_sa.e0b9655c','4. Đóng Gói & Cài'):'4. Đóng Gói & Cài'), dept: (window.cnxT?window.cnxT('js.m_sa.6076bd4f','Kỹ thuật'):'Kỹ thuật'), done: !!summary.has_release && canGen, active: stage === 'ready_to_install' || isTrial },
                { label: (window.cnxT?window.cnxT('js.m_sa.543db43a','5. Nghiệm Thu'):'5. Nghiệm Thu'), dept: (window.cnxT?window.cnxT('js.m_sa.6076bd4f','Kỹ thuật'):'Kỹ thuật'), done: !!summary.has_handover, active: stage === 'pending_handover' }
            ];
            wfBar.innerHTML = steps.map(s => {
                const cls = s.done ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : (s.active ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900/80 text-slate-400 border-white/10');
                return `<div class="p-1.5 rounded-lg border ${cls}">
                    <div>${s.done ? '✓ ' : ''}${s.label}</div>
                    <div class="text-[9px] opacity-80">${s.dept}</div>
                </div>`;
            }).join('');
        }
        if (wfHint) {
            if (isTrial) {
                wfHint.innerHTML = (window.cnxT?window.cnxT('js.m_sa.0ca4e14e','<span class="text-sky-300 font-bold">Chế độ Dùng Thử 07 Ngày:</span> Đã mở khóa đóng gói bản Trial. Chờ Sales/Kế toán chốt Hợp đồng &amp; Thanh toán để nâng lên chính thức.'):'<span class="text-sky-300 font-bold">Chế độ Dùng Thử 07 Ngày:</span> Đã mở khóa đóng gói bản Trial. Chờ Sales/Kế toán chốt Hợp đồng &amp; Thanh toán để nâng lên chính thức.');
            } else if (!canGen) {
                wfHint.innerHTML = (window.cnxT?window.cnxT('js.m_sa.31247a76','<span class="text-amber-300 font-bold">Đang khóa đóng gói chính thức:</span> Cần upload Hợp đồng + Xác nhận thanh toán/VAT (hoặc Cấp Dùng Thử 07 Ngày).'):'<span class="text-amber-300 font-bold">Đang khóa đóng gói chính thức:</span> Cần upload Hợp đồng + Xác nhận thanh toán/VAT (hoặc Cấp Dùng Thử 07 Ngày).');
            } else if (!summary.has_handover) {
                wfHint.innerHTML = (window.cnxT?window.cnxT('js.m_sa.931088e2','<span class="text-emerald-300 font-bold">Đã mở khóa đóng gói:</span> Kỹ thuật đóng gói, cài đặt tại quán và upload Biên bản nghiệm thu để kích hoạt bảo hành.'):'<span class="text-emerald-300 font-bold">Đã mở khóa đóng gói:</span> Kỹ thuật đóng gói, cài đặt tại quán và upload Biên bản nghiệm thu để kích hoạt bảo hành.');
            } else {
                wfHint.innerHTML = `<span class="text-emerald-400 font-bold">${window.cnxT?window.cnxT('js.m_sa.fc96096d','Đã nghiệm thu &amp; bảo hành:'):'Đã nghiệm thu &amp; bảo hành:'}</span> Đến ${summary.warranty_until || (window.cnxT?window.cnxT('js.m_sa.046c4f15','theo hợp đồng'):'theo hợp đồng')}.`;
            }
        }
        if (btnTrial) btnTrial.style.display = (isTrial || isPaid || stage === 'active') ? 'none' : 'inline-flex';
        if (btnPay) btnPay.style.display = isPaid ? 'none' : 'inline-flex';
        if (btnOverride) btnOverride.style.display = (canGen || this.currentRoleView !== 'super_admin') ? 'none' : 'inline-flex';
        if (btnGenRel) {
            btnGenRel.disabled = !canGen;
            btnGenRel.classList.toggle('opacity-50', !canGen);
            btnGenRel.classList.toggle('cursor-not-allowed', !canGen);
            const lbl = btnGenRel.querySelector('span');
            if (lbl) lbl.textContent = isTrial ? 'Đóng Gói Bản Trial (7 Ngày)' : (window.cnxT?window.cnxT('ui.sa_html.button_d3e2aaee','Đóng Gói Bộ Cài'):'Đóng Gói Bộ Cài');
        }

        if (kpiContract) {
            kpiContract.innerHTML = summary.has_contract ? 
                `<i class="fas fa-circle-check text-emerald-400"></i> <span class="text-emerald-400">${window.cnxT?window.cnxT('ui.sa_html.span_8f19e552','Đã Ký Kết'):'Đã Ký Kết'}</span>` : 
                `<i class="fas fa-circle-exclamation text-amber-400"></i> <span class="text-amber-400">${window.cnxT?window.cnxT('js.m_sa.7dc4b66a','Chưa Có Hợp Đồng'):'Chưa Có Hợp Đồng'}</span>`;
        }
        if (kpiInvoice) {
            kpiInvoice.innerHTML = summary.has_invoice ? 
                `<i class="fas fa-circle-check text-emerald-400"></i> <span class="text-emerald-400">${window.cnxT?window.cnxT('ui.sa_html.span_c0989c27','Đã Xuất VAT'):'Đã Xuất VAT'}</span>` : 
                `<i class="fas fa-circle-exclamation text-amber-400"></i> <span class="text-amber-400">${window.cnxT?window.cnxT('js.m_sa.b1aa90f2','Chưa Xuất VAT'):'Chưa Xuất VAT'}</span>`;
        }
        if (kpiHandover) {
            kpiHandover.innerHTML = summary.has_handover ? 
                `<i class="fas fa-circle-check text-emerald-400"></i> <span class="text-emerald-400">${window.cnxT?window.cnxT('ui.sa_html.span_3bceef14','Đã Nghiệm Thu'):'Đã Nghiệm Thu'}</span>` : 
                `<i class="fas fa-clock text-amber-400"></i> <span class="text-amber-400">${window.cnxT?window.cnxT('js.m_sa.97a2e04f','Chờ Nghiệm Thu'):'Chờ Nghiệm Thu'}</span>`;
        }
        if (kpiRelease) {
            kpiRelease.innerHTML = summary.has_release ? 
                `<i class="fas fa-box-open text-amber-400"></i> <span class="text-amber-300">${window.cnxT?window.cnxT('js.m_sa.770d2223','Đã Đóng Gói'):'Đã Đóng Gói'}</span>` : 
                `<i class="fas fa-circle-question text-slate-400"></i> <span class="text-slate-400">${window.cnxT?window.cnxT('js.m_sa.a6622242','Chưa Tạo Gói'):'Chưa Tạo Gói'}</span>`;
        }

        if (btnDownloadZip) {
            const dlPath = summary.release_exe_path || summary.release_zip_path;
            if (summary.has_release && dlPath) {
                btnDownloadZip.href = `/api/download_package?file=${encodeURIComponent(dlPath)}`;
                btnDownloadZip.setAttribute('download', dlPath.split('/').pop() || 'CyberNexus_Setup.exe');
                const dlLbl = btnDownloadZip.querySelector('span');
                if (dlLbl) dlLbl.textContent = isTrial ? 'Tải Bộ Cài [TRIAL 07 NGÀY]' : (window.cnxT?window.cnxT('js.m_sa.c746bd3e','Tải Bộ Cài [CHÍNH THỨC]'):'Tải Bộ Cài [CHÍNH THỨC]');
                btnDownloadZip.classList.remove('hidden');
                btnDownloadZip.style.display = 'inline-flex';
            } else {
                btnDownloadZip.href = '#';
                btnDownloadZip.classList.add('hidden');
                btnDownloadZip.style.display = 'none';
            }
        }

        // Render documents table
        const tbody = document.getElementById('pkg-documents-tbody');
        if (!tbody) return;

        if (docs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400">${window.cnxT?window.cnxT('js.m_sa.96d742b7','Thư mục chưa có tài liệu nào. Sử dụng form bên trên để tải lên Hợp đồng, Hóa đơn hoặc bấm Đóng Gói Release.'):'Thư mục chưa có tài liệu nào. Sử dụng form bên trên để tải lên Hợp đồng, Hóa đơn hoặc bấm Đóng Gói Release.'}</td></tr>`;
            return;
        }

        const catNames = {
            'contracts': (window.cnxT?window.cnxT('js.m_sa.6e0985c8','<span class="px-2 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30">Hợp Đồng</span>'):'<span class="px-2 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30">Hợp Đồng</span>'),
            'invoices': (window.cnxT?window.cnxT('js.m_sa.26ace821','<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Hóa Đơn VAT</span>'):'<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Hóa Đơn VAT</span>'),
            'handover': (window.cnxT?window.cnxT('js.m_sa.c0d05aa8','<span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">Biên Bản Bàn Giao</span>'):'<span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">Biên Bản Bàn Giao</span>'),
            'quotes': (window.cnxT?window.cnxT('js.m_sa.8835d9c0','<span class="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Báo Giá</span>'):'<span class="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Báo Giá</span>'),
            'terms': (window.cnxT?window.cnxT('js.m_sa.00f03984','<span class="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">Điều Khoản</span>'):'<span class="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">Điều Khoản</span>'),
            'warranty': (window.cnxT?window.cnxT('js.m_sa.c3fe1bbc','<span class="px-2 py-0.5 rounded text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30">Bảo Hành</span>'):'<span class="px-2 py-0.5 rounded text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30">Bảo Hành</span>'),
            'release': (window.cnxT?window.cnxT('js.m_sa.2b725620','<span class="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">Gói Cài Đặt</span>'):'<span class="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">Gói Cài Đặt</span>'),
            'setup_exe': (window.cnxT?window.cnxT('js.m_sa.5b1fd8ea','<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">Bộ Cài 1-Click</span>'):'<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">Bộ Cài 1-Click</span>'),
            'credentials': (window.cnxT?window.cnxT('js.m_sa.8979d5fc','<span class="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Tài Khoản Khởi Tạo</span>'):'<span class="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Tài Khoản Khởi Tạo</span>'),
            'other': (window.cnxT?window.cnxT('js.m_sa.ca7f9b0c','<span class="px-2 py-0.5 rounded text-[10px] bg-slate-500/20 text-slate-300 border border-slate-500/30">Hồ Sơ Mẫu</span>'):'<span class="px-2 py-0.5 rounded text-[10px] bg-slate-500/20 text-slate-300 border border-slate-500/30">Hồ Sơ Mẫu</span>')
        };

        const tplToSignedCat = {
            'hop_dong_dich_vu.html': 'contracts',
            'bien_ban_ban_giao_nghiem_thu.html': 'handover',
            'bao_gia_dich_vu.html': 'quotes',
            'dieu_khoan_su_dung_ban_quyen.html': 'terms',
            'phieu_bao_hanh_ky_thuat.html': 'warranty'
        };
        const signedByCat = {};
        docs.forEach(d => {
            const isSignedDoc = (d.status === 'signed') || String(d.file_name || '').toLowerCase().includes('_signed') || ['contracts', 'invoices', 'handover', 'quotes', 'terms', 'warranty'].includes(d.category);
            if (isSignedDoc && !signedByCat[d.category] && d.file_name !== 'THONG_TIN_DANG_NHAP_BAN_DAU.txt') {
                signedByCat[d.category] = d;
            }
        });

        tbody.innerHTML = docs.map(doc => {
            const kb = (doc.file_size / 1024).toFixed(1);
            const sizeStr = doc.file_size >= 1048576 ? `${(doc.file_size / 1048576).toFixed(1)} MB` : `${kb} KB`;
            const dateStr = doc.created_at ? new Date(doc.created_at).toLocaleString('vi-VN') : '--';
            const catBadge = catNames[doc.category] || `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">${doc.category}</span>`;
            const isHtmlTpl = (doc.file_ext === 'html' || (doc.file_name || '').endsWith('.html'));
            const mappedSigned = isHtmlTpl ? signedByCat[tplToSignedCat[doc.file_name]] : null;
            const isSignedFile = (doc.status === 'signed') || String(doc.file_name || '').toLowerCase().includes('_signed');
            const viewTargetPath = mappedSigned ? mappedSigned.file_path : doc.file_path;
            const signedBadge = isSignedFile
                ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold whitespace-nowrap"><i class="fas fa-circle-check mr-0.5"></i>${window.cnxT?window.cnxT('js.m_sa.a124f4d5','Đã Ký'):'Đã Ký'}</span>`
                : (mappedSigned ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold whitespace-nowrap" title="Đã upload bản ký: ${mappedSigned.file_name}"><i class="fas fa-circle-check mr-0.5"></i>${window.cnxT?window.cnxT('js.m_sa.7021931f','Đã có bản Signed'):'Đã có bản Signed'}</span>` : '');

            return `
                <tr class="hover:bg-white/5 transition-all">
                    <td class="py-2.5 px-3">
                        <div class="font-bold text-white text-xs flex items-center gap-1.5 flex-wrap">
                            <i class="fas ${isSignedFile || mappedSigned ? 'fa-circle-check text-emerald-400' : 'fa-file text-slate-400'} text-xs"></i>
                            <span class="text-sky-300">${doc.title || doc.file_name}</span>
                            ${signedBadge}
                        </div>
                        <div class="text-[10px] text-slate-400 font-mono mt-0.5">${doc.file_name} ${doc.notes ? `• <i>${doc.notes}</i>` : ''}</div>
                    </td>
                    <td class="py-2.5 px-3 whitespace-nowrap">${catBadge}</td>
                    <td class="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-300">${sizeStr}</td>
                    <td class="py-2.5 px-3 whitespace-nowrap text-[10px] text-slate-400">${dateStr}</td>
                    <td class="py-2.5 px-3 text-right whitespace-nowrap">
                        <div class="inline-flex items-center gap-1">
                            ${(isHtmlTpl || isSignedFile) ? `
                                <button type="button" onclick="SuperAdmin.previewStoreDocument('${viewTargetPath}')" class="btn-glass text-[10px] py-1 px-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1" title="${mappedSigned ? 'Mở bản đã ký (_signed)' : (window.cnxT?window.cnxT('js.m_sa.301f8849','Xem trước & In PDF'):'Xem trước & In PDF')}">
                                    <i class="fas fa-eye"></i> <span>${mappedSigned ? 'Xem Bản Ký' : 'Xem / In PDF'}</span>
                                </button>
                            ` : ''}
                            ${isHtmlTpl ? `
                                <button type="button" onclick="SuperAdmin.editStoreTemplate('${doc.file_name}')" class="btn-glass text-[10px] py-1 px-2 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1" title="Chỉnh sửa mẫu">
                                    <i class="fas fa-pen"></i> <span>${window.cnxT?window.cnxT('js.m_sa.320e4ff8','Sửa mẫu'):'Sửa mẫu'}</span>
                                </button>
                            ` : ''}
                            <a href="/api/download_package?file=${encodeURIComponent(doc.file_path)}" download="${doc.file_name || ''}" class="btn-glass text-[10px] py-1 px-2.5 bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-500/30 font-bold flex items-center gap-1" title="Tải xuống tài liệu">
                                <i class="fas fa-download"></i> <span>${window.cnxT?window.cnxT('js.m_sa.c54bbd50','Tải'):'Tải'}</span>
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
        const title = document.getElementById('pkg-upload-title')?.value.trim() || (window.cnxT?window.cnxT('js.m_sa.f817eb26','Tài liệu đính kèm'):'Tài liệu đính kèm');
        const fileInput = document.getElementById('pkg-upload-file');

        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            alert((window.cnxT?window.cnxT('js.m_sa.72b27292','Vui lòng chọn một tệp tin hợp lệ!'):'Vui lòng chọn một tệp tin hợp lệ!'));
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
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.013a15b8','Đã tải lên tài liệu thành công!'):'Đã tải lên tài liệu thành công!'));
                document.getElementById('pkg-upload-title').value = '';
                fileInput.value = '';
                await this.loadTenantPackages(tid);
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.d69c0b13','Lỗi khi tải lên tài liệu'):'Lỗi khi tải lên tài liệu'));
            }
        } catch (err) {
            console.error('uploadTenantDocument error:', err);
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    getWorkflowLabel(t) {
        const s = t.workflow_stage || 'pending_contract';
        if (t.subscription_status === 'trial' || s === 'trial') return (window.cnxT?window.cnxT('js.m_sa_ext.2e4eae5e','Trial 07 ngày'):'Trial 07 ngày');
        const map = {
            'pending_contract': (window.cnxT?window.cnxT('js.m_sa_ext.16daaf5b','Sales: Chờ Hợp Đồng'):'Sales: Chờ Hợp Đồng'),
            'pending_payment': (window.cnxT?window.cnxT('js.m_sa_ext.299d92a2','Kế toán: Chờ Tiền/VAT'):'Kế toán: Chờ Tiền/VAT'),
            'ready_to_install': (window.cnxT?window.cnxT('js.m_sa_ext.b9162597','Kỹ thuật: Chờ Đóng Gói'):'Kỹ thuật: Chờ Đóng Gói'),
            'pending_handover': (window.cnxT?window.cnxT('js.m_sa_ext.0cae1380','Kỹ thuật: Chờ Nghiệm Thu'):'Kỹ thuật: Chờ Nghiệm Thu'),
            'active': (window.cnxT?window.cnxT('js.m_sa_ext.485c0d0e','Hoàn Tất & Bảo Hành'):'Hoàn Tất & Bảo Hành')
        };
        return map[s] || (window.cnxT?window.cnxT('js.m_sa_ext.30f0d774','Đang xử lý'):'Đang xử lý');
    },

    async activateTrial7d() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.17b3b2c6','Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.'):'Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.'))) return;
        const res = await fetch('api/super_admin.php?action=activate_trial_7d', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async confirmTenantPayment() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.4d39e8af','Xác nhận đã thu đủ phí bản quyền cho quán này?'):'Xác nhận đã thu đủ phí bản quyền cho quán này?'))) return;
        const res = await fetch('api/super_admin.php?action=confirm_payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async grantWorkflowOverride() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.39573ee8','Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?'):'Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?'))) return;
        const res = await fetch('api/super_admin.php?action=grant_workflow_override', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    toggleTrashView() {
        const sel = document.getElementById('tenant-filter-status');
        if (!sel) return;
        sel.value = (sel.value === 'deleted') ? '' : 'deleted';
        this.loadTenants();
    },

    async softDeleteTenant(tid, tcode) {
        const reason = prompt(`${window.cnxT?window.cnxT('js.m_sa.ede9c89c','Chuyển quán ['):'Chuyển quán ['}${tcode}${window.cnxT?window.cnxT('js.m_sa.3a0e3f16','] vào Thùng rác (Trash)?\\n(Không xóa vĩnh viễn — có thể xem lại & khôi phục bất cứ lúc nào)\\n\\nNhập lý do chuyển vào Thùng rác:'):'] vào Thùng rác (Trash)?\\n(Không xóa vĩnh viễn — có thể xem lại & khôi phục bất cứ lúc nào)\\n\\nNhập lý do chuyển vào Thùng rác:'}`, (window.cnxT?window.cnxT('js.m_sa.147eec7b','Ngưng hợp tác / Tạo nhầm'):'Ngưng hợp tác / Tạo nhầm'));
        if (reason === null) return;
        const res = await fetch('api/super_admin.php?action=soft_delete_tenant', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid, reason })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa.745b8310','Đã chuyển vào Thùng rác'):'Đã chuyển vào Thùng rác'));
        if (res.success) { this.loadTenants(); this.loadDashboard(); }
    },

    async restoreTenant(tid, tcode) {
        if (!confirm(`${window.cnxT?window.cnxT('js.m_sa.899e2eac','Khôi phục quán ['):'Khôi phục quán ['}${tcode}${window.cnxT?window.cnxT('js.m_sa.e2a18835','] từ Thùng rác về danh sách hoạt động?'):'] từ Thùng rác về danh sách hoạt động?'}`)) return;
        const res = await fetch('api/super_admin.php?action=restore_tenant', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa.85217ecd','Đã khôi phục'):'Đã khôi phục'));
        if (res.success) { this.loadTenants(); this.loadDashboard(); }
    },

    previewStoreDocument(filePath) {
        window.open('/' + String(filePath || '').replace(/^\/+/, ''), '_blank');
    },

    async editStoreTemplate(fileName) {
        const tid = this.currentPackageTenantId;
        this.closeModal('modal-tenant-packages');
        this.activeLegalTemplateFile = fileName;
        this.switchTab('templates');
        setTimeout(() => {
            const sel = document.getElementById('tpl-preview-tenant');
            if (sel && tid) sel.value = String(tid);
        }, 250);
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
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.9e72278c','Đã đóng gói thành công bộ cài đặt!'):'Đã đóng gói thành công bộ cài đặt!'));
                await this.loadTenantPackages(tid);
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.6c8e0a00','Lỗi khi đóng gói release'):'Lỗi khi đóng gói release'));
            }
        } catch (err) {
            console.error('generateTenantRelease error:', err);
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
        } finally {
            if (btn) btn.disabled = false;
        }
    },


    getWorkflowLabel(t) {
        const s = t.workflow_stage || 'pending_contract';
        if (t.subscription_status === 'trial' || s === 'trial') return (window.cnxT?window.cnxT('js.m_sa_ext.2e4eae5e','Trial 07 ngày'):'Trial 07 ngày');
        const map = {
            'pending_contract': (window.cnxT?window.cnxT('js.m_sa_ext.16daaf5b','Sales: Chờ Hợp Đồng'):'Sales: Chờ Hợp Đồng'),
            'pending_payment': (window.cnxT?window.cnxT('js.m_sa_ext.299d92a2','Kế toán: Chờ Tiền/VAT'):'Kế toán: Chờ Tiền/VAT'),
            'ready_to_install': (window.cnxT?window.cnxT('js.m_sa_ext.b9162597','Kỹ thuật: Chờ Đóng Gói'):'Kỹ thuật: Chờ Đóng Gói'),
            'pending_handover': (window.cnxT?window.cnxT('js.m_sa_ext.0cae1380','Kỹ thuật: Chờ Nghiệm Thu'):'Kỹ thuật: Chờ Nghiệm Thu'),
            'active': (window.cnxT?window.cnxT('js.m_sa_ext.485c0d0e','Hoàn Tất & Bảo Hành'):'Hoàn Tất & Bảo Hành')
        };
        return map[s] || (window.cnxT?window.cnxT('js.m_sa_ext.30f0d774','Đang xử lý'):'Đang xử lý');
    },

    async activateTrial7d() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.17b3b2c6','Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.'):'Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.'))) return;
        const res = await fetch('api/super_admin.php?action=activate_trial_7d', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async confirmTenantPayment() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.4d39e8af','Xác nhận đã thu đủ phí bản quyền cho quán này?'):'Xác nhận đã thu đủ phí bản quyền cho quán này?'))) return;
        const res = await fetch('api/super_admin.php?action=confirm_payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async grantWorkflowOverride() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.39573ee8','Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?'):'Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?'))) return;
        const res = await fetch('api/super_admin.php?action=grant_workflow_override', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async deleteTenantDocument(docId) {
        if (!confirm((window.cnxT?window.cnxT('js.m_sa.cbe1a000','Bạn có chắc chắn muốn xóa tài liệu này khỏi kho hồ sơ?'):'Bạn có chắc chắn muốn xóa tài liệu này khỏi kho hồ sơ?'))) return;
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
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.c8f3e130','Lỗi khi xóa tài liệu'):'Lỗi khi xóa tài liệu'));
            }
        } catch (err) {
            console.error('deleteTenantDocument error:', err);
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
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
            'super_admin': (window.cnxT?window.cnxT('js.m_sa.76057883','Ban Giám Đốc (SuperAdmin - Toàn Quyền)'):'Ban Giám Đốc (SuperAdmin - Toàn Quyền)'),
            'technical': (window.cnxT?window.cnxT('js.m_sa.f225ee9c','Phòng Kỹ Thuật & Triển Khai (Tech Lead)'):'Phòng Kỹ Thuật & Triển Khai (Tech Lead)'),
            'finance': (window.cnxT?window.cnxT('js.m_sa.856384c7','Phòng Kế Toán - Tài Chính (Finance)'):'Phòng Kế Toán - Tài Chính (Finance)'),
            'sales': (window.cnxT?window.cnxT('js.m_sa.420bbef8','Phòng Kinh Doanh & CSKH (Sales)'):'Phòng Kinh Doanh & CSKH (Sales)'),
            'auditor': (window.cnxT?window.cnxT('js.m_sa.b2395899','Ban Kiểm Toán & Tuân Thủ (Audit Read-only)'):'Ban Kiểm Toán & Tuân Thủ (Audit Read-only)')
        };
        console.log(`${window.cnxT?window.cnxT('js.m_sa.5ace5015','[RBAC] Chuyển đổi góc nhìn phân quyền sang:'):'[RBAC] Chuyển đổi góc nhìn phân quyền sang:'} ${roleNames[role] || role}`);
        this.applyRoleViewEnforcement(role);
    },

    applyRoleViewEnforcement(role) {
        const navIds = ['billing', 'resellers', 'plans', 'staff', 'ai-vault', 'settings', 'templates', 'audit'];
        navIds.forEach(id => {
            const el = document.getElementById('nav-tab-' + id);
            if (el) el.style.display = '';
        });

        const hideNavs = (ids) => ids.forEach(id => {
            const el = document.getElementById('nav-tab-' + id);
            if (el) el.style.display = 'none';
        });

        document.querySelectorAll('button[type="submit"]').forEach(b => { b.disabled = false; });

        if (role === 'technical') {
            hideNavs(['billing', 'resellers', 'plans', 'staff', 'ai-vault', 'settings']);
        } else if (role === 'finance') {
            hideNavs(['staff', 'ai-vault', 'settings', 'templates']);
        } else if (role === 'sales') {
            hideNavs(['staff', 'ai-vault', 'settings', 'audit']);
        } else if (role === 'auditor') {
            hideNavs(['staff', 'ai-vault', 'settings']);
            document.querySelectorAll('button[type="submit"]:not(#btn-login-submit)').forEach(b => {
                b.disabled = true;
            });
        }
    },

    async resetHardwareLock(tenantId, tenantCode) {
        if (!confirm(`${window.cnxT?window.cnxT('js.m_sa.4c260611','Bạn có chắc chắn muốn MỞ KHÓA MÁY TRẠM cho cửa hàng ['):'Bạn có chắc chắn muốn MỞ KHÓA MÁY TRẠM cho cửa hàng ['}${tenantCode}${window.cnxT?window.cnxT('js.m_sa.be14a4e8',']?\\n\\nHành động này sẽ giải phóng Hardware GUID cũ, cho phép chủ quán hoặc kỹ thuật viên kích hoạt máy POS mới.'):']?\\n\\nHành động này sẽ giải phóng Hardware GUID cũ, cho phép chủ quán hoặc kỹ thuật viên kích hoạt máy POS mới.'}`)) return;
        try {
            const res = await fetch('api/super_admin.php?action=reset_hardware_lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenantId, tenant_code: tenantCode })
            });
            const data = await res.json();
            alert(data.message || (data.success ? 'Đã mở khóa phần cứng thành công!' : (window.cnxT?window.cnxT('js.m_sa.f05de904','Lỗi mở khóa'):'Lỗi mở khóa')));
            if (data.success) {
                this.loadTenants();
            }
        } catch (e) {
            console.error('resetHardwareLock error:', e);
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
        }
    },

    async resetOwnerPin(tenantId, tenantCode) {
        if (!confirm(`${window.cnxT?window.cnxT('js.m_sa.2e44a0db','Xác nhận RESET PIN 6 SỐ MẶC ĐỊNH cho quán ['):'Xác nhận RESET PIN 6 SỐ MẶC ĐỊNH cho quán ['}${tenantCode}${window.cnxT?window.cnxT('js.m_sa.18d682bf',']?\\n\\n• Hệ thống sẽ đặt lại PIN chủ quán về 6 số mặc định (dùng 1 lần, bắt buộc đổi).\\n• Tự động gửi lại file DEFAULT_OWNER_PIN.txt và bật chấm xanh thông báo trên Control Center của quán.'):']?\\n\\n• Hệ thống sẽ đặt lại PIN chủ quán về 6 số mặc định (dùng 1 lần, bắt buộc đổi).\\n• Tự động gửi lại file DEFAULT_OWNER_PIN.txt và bật chấm xanh thông báo trên Control Center của quán.'}`)) return;
        try {
            const res = await fetch('api/super_admin.php?action=reset_store_owner_pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenantId, tenant_code: tenantCode })
            });
            const data = await res.json();
            alert(data.message || (data.success ? 'Đã gửi lệnh Reset PIN mặc định!' : (window.cnxT?window.cnxT('js.m_sa.97d3b30d','Lỗi reset PIN'):'Lỗi reset PIN')));
        } catch (e) {
            console.error('resetOwnerPin error:', e);
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
        }
    },

    // --- 7. QUẢN LÝ NHÂN SỰ BỘ PHẬN (STAFF RBAC) ---
    async loadStaffUsers() {
        const tbody = document.getElementById('staff-table-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>${window.cnxT?window.cnxT('js.m_sa.667fab03','Đang tải dữ liệu nhân viên...'):'Đang tải dữ liệu nhân viên...'}</td></tr>`;
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
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400">${window.cnxT?window.cnxT('js.m_sa.445c062a','Lỗi khi tải danh sách nhân viên'):'Lỗi khi tải danh sách nhân viên'}</td></tr>`;
        }
    },

    renderStaffTable(list) {
        const tbody = document.getElementById('staff-table-tbody');
        const countEl = document.getElementById('staff-total-count');
        if (!tbody) return;

        if (countEl) countEl.innerText = list.length;

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">${window.cnxT?window.cnxT('js.m_sa.21a59cc1','Chưa có nhân viên bộ phận nào'):'Chưa có nhân viên bộ phận nào'}</td></tr>`;
            return;
        }

        const roleBadges = {
            'super_admin': (window.cnxT?window.cnxT('js.m_sa.e2f57b3e','<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">👑 Ban Giám Đốc</span>'):'<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">👑 Ban Giám Đốc</span>'),
            'technical': (window.cnxT?window.cnxT('js.m_sa.bb39e41d','<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">🛠️ Kỹ Thuật (Tech Lead)</span>'):'<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">🛠️ Kỹ Thuật (Tech Lead)</span>'),
            'finance': (window.cnxT?window.cnxT('js.m_sa.55ac7d63','<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">💼 Kế Toán (Finance)</span>'):'<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">💼 Kế Toán (Finance)</span>'),
            'sales': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">📈 Kinh Doanh (Sales)</span>',
            'auditor': (window.cnxT?window.cnxT('js.m_sa.a370bfe1','<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">🛡️ Kiểm Toán (Auditor)</span>'):'<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">🛡️ Kiểm Toán (Auditor)</span>')
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
                            <div class="text-[10px] text-slate-400">${u.department || (window.cnxT?window.cnxT('js.m_sa.7c4267fc','Bộ Phận'):'Bộ Phận')}</div>
                        </div>
                    </td>
                    <td class="py-3 px-4 font-mono font-bold text-indigo-300">${u.username}</td>
                    <td class="py-3 px-4">${roleBadges[u.role] || u.role}</td>
                    <td class="py-3 px-4 text-[11px] text-slate-400">
                        <div><i class="fas fa-phone text-xs mr-1 text-slate-500"></i>${u.phone || (window.cnxT?window.cnxT('js.m_sa.a0301c23','Chưa cập nhật'):'Chưa cập nhật')}</div>
                        <div><i class="fas fa-envelope text-xs mr-1 text-slate-500"></i>${u.email || '-'}</div>
                    </td>
                    <td class="py-3 px-4 font-mono text-[11px] text-slate-400">${u.last_login_at || (window.cnxT?window.cnxT('js.m_sa.cd575ab6','Chưa đăng nhập'):'Chưa đăng nhập')}</td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">${window.cnxT?window.cnxT('js.m_sa.d1642b61','Hoạt Động'):'Hoạt Động'}</span>
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
        document.getElementById('staff-input-dept').value = (window.cnxT?window.cnxT('ui.sa_html.ph_b6ff2d75','Phòng Kỹ Thuật & Triển Khai'):'Phòng Kỹ Thuật & Triển Khai');
        document.getElementById('staff-input-phone').value = '';
        document.getElementById('staff-input-email').value = '';
        document.getElementById('staff-modal-title').innerText = (window.cnxT?window.cnxT('ui.sa_html.h3_8d263e32','Thêm Nhân Viên Bộ Phận Mới'):'Thêm Nhân Viên Bộ Phận Mới');
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
        document.getElementById('staff-modal-title').innerText = (window.cnxT?window.cnxT('js.m_sa.c11098ba','Chỉnh Sửa Phân Quyền: '):'Chỉnh Sửa Phân Quyền: ') + u.username;
        this.openModal('modal-staff-member');
    },

    onStaffRoleChange(role) {
        const deptInput = document.getElementById('staff-input-dept');
        const depts = {
            'super_admin': (window.cnxT?window.cnxT('js.m_sa.d34f4767','Ban Giám Đốc'):'Ban Giám Đốc'),
            'technical': (window.cnxT?window.cnxT('ui.sa_html.ph_b6ff2d75','Phòng Kỹ Thuật & Triển Khai'):'Phòng Kỹ Thuật & Triển Khai'),
            'finance': (window.cnxT?window.cnxT('js.m_sa.73fad08e','Phòng Kế Toán - Tài Chính'):'Phòng Kế Toán - Tài Chính'),
            'sales': (window.cnxT?window.cnxT('js.m_sa.d3821830','Phòng Kinh Doanh & CSKH'):'Phòng Kinh Doanh & CSKH'),
            'auditor': (window.cnxT?window.cnxT('js.m_sa.92ac980c','Ban Kiểm Toán & Tuân Thủ'):'Ban Kiểm Toán & Tuân Thủ')
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
            alert(data.message || (data.success ? 'Đã lưu tài khoản nhân viên!' : (window.cnxT?window.cnxT('js.m_sa.c0c66ef8','Lỗi'):'Lỗi')));
            if (data.success) {
                this.closeModal('modal-staff-member');
                this.loadStaffUsers();
            }
        } catch (err) {
            console.error('saveStaffMember error:', err);
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
        }
    },

    async deleteStaffMember(id, username) {
        if (!confirm(`${window.cnxT?window.cnxT('js.m_sa.99b58399','Bạn có chắc chắn muốn xóa tài khoản nhân viên ['):'Bạn có chắc chắn muốn xóa tài khoản nhân viên ['}${username}]?`)) return;
        try {
            const res = await fetch('api/super_admin.php?action=delete_staff_user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            alert(data.message || (data.success ? 'Đã xóa tài khoản!' : (window.cnxT?window.cnxT('js.m_sa.c0c66ef8','Lỗi'):'Lỗi')));
            if (data.success) {
                this.loadStaffUsers();
            }
        } catch (err) {
            console.error('deleteStaffMember error:', err);
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
        }
    },

    // --- 8. NHẬT KÝ KIỂM TOÁN (AUDIT TRAIL) ---
    async loadAuditLogs() {
        const tbody = document.getElementById('audit-table-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>${window.cnxT?window.cnxT('js.m_sa_ext.bfa032ea','Đang tải dữ liệu kiểm toán...'):'Đang tải dữ liệu kiểm toán...'}</td></tr>`;
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
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400">${window.cnxT?window.cnxT('js.m_sa_ext.97536ae6','Lỗi khi tải nhật ký kiểm toán'):'Lỗi khi tải nhật ký kiểm toán'}</td></tr>`;
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
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">${window.cnxT?window.cnxT('js.m_sa_ext.5214e754','Không có nhật ký kiểm toán nào phù hợp với bộ lọc'):'Không có nhật ký kiểm toán nào phù hợp với bộ lọc'}</td></tr>`;
            return;
        }

        const roleBadges = {
            'super_admin': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">Admin</span>',
            'technical': (window.cnxT?window.cnxT('js.m_sa_ext.b031ec1f','<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">Kỹ Thuật</span>'):'<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">Kỹ Thuật</span>'),
            'finance': (window.cnxT?window.cnxT('js.m_sa_ext.f51a791f','<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Kế Toán</span>'):'<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Kế Toán</span>'),
            'accounting': (window.cnxT?window.cnxT('js.m_sa_ext.f51a791f','<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Kế Toán</span>'):'<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Kế Toán</span>'),
            'sales': '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Sales</span>',
            'auditor': (window.cnxT?window.cnxT('js.m_sa_ext.889ff0f9','<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Kiểm Toán</span>'):'<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Kiểm Toán</span>')
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
            alert((window.cnxT?window.cnxT('js.m_sa_ext.9809346c','Không có dữ liệu kiểm toán để xuất!'):'Không có dữ liệu kiểm toán để xuất!'));
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

    // ==========================================
    // RESELLER / DISTRIBUTOR CHANNEL MANAGEMENT
    // ==========================================
    async loadResellers() {
        try {
            const res = await fetch('api/super_admin?action=get_resellers');
            const data = await res.json();
            if (!data.success) return;

            this.resellers = data.resellers || data.data || [];
            this.renderResellersTable(this.resellers);

            // Metrics
            let totalWallet = 0;
            let totalStores = 0;
            let totalRevenue = 0;

            this.resellers.forEach(r => {
                totalWallet += Number(r.wallet_balance || 0);
                totalStores += Number(r.tenants_count || 0);
                totalRevenue += Number(r.total_revenue || 0);
            });

            const statCount = document.getElementById('stat-reseller-count');
            if (statCount) statCount.innerText = this.resellers.length;

            const statWallet = document.getElementById('stat-reseller-wallet-total');
            if (statWallet) statWallet.innerText = totalWallet.toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');

            const statStores = document.getElementById('stat-reseller-stores-count');
            if (statStores) statStores.innerText = totalStores;

            const statRev = document.getElementById('stat-reseller-revenue-total');
            if (statRev) statRev.innerText = totalRevenue.toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');

            const badgeTotal = document.getElementById('reseller-badge-total');
            if (badgeTotal) badgeTotal.innerText = `${this.resellers.length} ${window.cnxT?window.cnxT('js.m_sa.6464a268','ĐẠI LÝ'):'ĐẠI LÝ'}`;

            const navBadge = document.getElementById('badge-total-resellers');
            if (navBadge) navBadge.innerText = this.resellers.length;

        } catch (err) {
            console.error('loadResellers error:', err);
        }
    },

    renderResellersTable(list) {
        const tbody = document.getElementById('reseller-table-tbody');
        if (!tbody) return;

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">Chưa có đại lý nào trong hệ thống. Bấm "Thêm Đại Lý Mới" để bắt đầu!</td></tr>`;
            return;
        }

        const tierMeta = {
            bronze: { label: (window.cnxT?window.cnxT('js.m_sa.7a120612','Đồng (Bronze)'):'Đồng (Bronze)'), badge: 'bg-amber-600/20 text-amber-300 border-amber-600/30', icon: '🥉' },
            silver: { label: (window.cnxT?window.cnxT('js.m_sa.90d20803','Bạc (Silver)'):'Bạc (Silver)'), badge: 'bg-slate-400/20 text-slate-200 border-slate-400/30', icon: '🥈' },
            gold: { label: (window.cnxT?window.cnxT('js.m_sa.f139afcb','Vàng (Gold)'):'Vàng (Gold)'), badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: '🥇' },
            diamond: { label: (window.cnxT?window.cnxT('js.m_sa.b6c13bd5','Kim Cương'):'Kim Cương'), badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', icon: '💎' }
        };

        tbody.innerHTML = list.map(r => {
            const tm = tierMeta[r.tier] || tierMeta.gold;
            const bal = Number(r.wallet_balance || 0);
            const stores = Number(r.tenants_count || 0);
            const rev = Number(r.total_revenue || 0);
            const disc = Number(r.discount_percent || 0);
            const isActive = r.status === 'active';

            return `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5">
                    <td class="py-3 px-4 font-mono font-bold text-teal-300">${r.reseller_code}</td>
                    <td class="py-3 px-4">
                        <div class="font-bold text-white">${r.company_name}</div>
                        <div class="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span><i class="fas fa-user text-slate-500 mr-1"></i>${r.contact_name || '—'}</span>
                            <span>&bull;</span>
                            <span class="font-mono"><i class="fas fa-phone text-slate-500 mr-1"></i>${r.phone || '—'}</span>
                            ${r.city ? `<span>&bull;</span><span>${r.city}</span>` : ''}
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-1.5">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${tm.badge}">
                                ${tm.icon} ${tm.label}
                            </span>
                            <span class="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                -${disc}%
                            </span>
                        </div>
                    </td>
                    <td class="py-3 px-4 text-right">
                        <div class="font-mono font-black text-sm ${bal > 0 ? 'text-emerald-400' : 'text-slate-400'}">
                            ${bal.toLocaleString('vi-VN')} đ
                        </div>
                        <div class="text-[10px] text-slate-500">${window.cnxT?window.cnxT('js.m_sa.e4ed93b7','Ví ký quỹ khả dụng'):'Ví ký quỹ khả dụng'}</div>
                    </td>
                    <td class="py-3 px-4 text-center">
                        <span class="px-2.5 py-1 rounded-xl text-xs font-mono font-bold ${stores > 0 ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'text-slate-500 bg-white/5'}">
                            ${stores}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-right font-mono text-slate-300">
                        ${rev.toLocaleString('vi-VN')} đ
                    </td>
                    <td class="py-3 px-4 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}">
                            ${isActive ? 'Hoạt động' : (window.cnxT?window.cnxT('js.m_sa_ext.0d6c7f3c','Tạm khóa'):'Tạm khóa')}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button type="button" onclick="SuperAdmin.openDepositModal(${r.id}, '${r.company_name.replace(/'/g, "\\'")}', ${bal})" class="btn-glass text-[11px] py-1 px-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30 font-bold" title="Nạp tiền ví ký quỹ">
                                <i class="fas fa-plus mr-1"></i>${window.cnxT?window.cnxT('js.m_sa.56b90884','Nạp Ví'):'Nạp Ví'}
                            </button>
                            <button type="button" onclick="SuperAdmin.openResellerIssueLicenseModal(${r.id})" class="btn-glass text-[11px] py-1 px-2.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border-teal-500/30 font-bold" title="Cấp bản quyền cho quán mới">
                                <i class="fas fa-key mr-1"></i>${window.cnxT?window.cnxT('js.m_sa.89af1565','Cấp Key'):'Cấp Key'}
                            </button>
                            <button type="button" onclick="SuperAdmin.openWalletLogsModal(${r.id}, '${r.company_name.replace(/'/g, "\\'")}')" class="btn-glass text-[11px] py-1 px-2 text-slate-300 hover:text-white" title="Lịch sử biến động số dư">
                                <i class="fas fa-history"></i>
                            </button>
                            <button type="button" onclick="SuperAdmin.editReseller(${JSON.stringify(r).replace(/"/g, '&quot;')})" class="btn-glass text-[11px] py-1 px-2 text-sky-300 hover:text-white" title="Chỉnh sửa đại lý">
                                <i class="fas fa-pen"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    filterResellersLocal() {
        const query = (document.getElementById('reseller-search-input')?.value || '').toLowerCase().trim();
        if (!query) {
            this.renderResellersTable(this.resellers);
            return;
        }
        const filtered = this.resellers.filter(r => 
            (r.reseller_code || '').toLowerCase().includes(query) ||
            (r.company_name || '').toLowerCase().includes(query) ||
            (r.contact_name || '').toLowerCase().includes(query) ||
            (r.phone || '').includes(query) ||
            (r.city || '').toLowerCase().includes(query)
        );
        this.renderResellersTable(filtered);
    },

    openAddResellerModal() {
        document.getElementById('reseller-modal-title').innerText = (window.cnxT?window.cnxT('ui.sa_html.h3_1507ec4b','Thêm Đại Lý Phân Phối Mới'):'Thêm Đại Lý Phân Phối Mới');
        document.getElementById('reseller-input-id').value = '0';
        
        // Sinh mã gợi ý DL-XXX
        const nextId = this.resellers.length + 1;
        document.getElementById('reseller-input-code').value = 'DL-' + String(nextId).padStart(3, '0');
        document.getElementById('reseller-input-company').value = '';
        document.getElementById('reseller-input-tier').value = 'gold';
        document.getElementById('reseller-input-discount').value = '40';
        document.getElementById('reseller-input-contact').value = '';
        document.getElementById('reseller-input-phone').value = '';
        document.getElementById('reseller-input-email').value = '';
        document.getElementById('reseller-input-city').value = '';
        document.getElementById('reseller-input-status').value = 'active';
        document.getElementById('reseller-input-note').value = '';

        this.openModal('modal-reseller-form');
    },

    onResellerTierChange(tier) {
        const tierDiscounts = { bronze: 15, silver: 25, gold: 40, diamond: 55 };
        const discInput = document.getElementById('reseller-input-discount');
        if (discInput && tierDiscounts[tier] !== undefined) {
            discInput.value = tierDiscounts[tier];
        }
    },

    editReseller(r) {
        document.getElementById('reseller-modal-title').innerText = (window.cnxT?window.cnxT('js.m_sa.54296524','Chỉnh Sửa Đại Lý: '):'Chỉnh Sửa Đại Lý: ') + r.company_name;
        document.getElementById('reseller-input-id').value = r.id;
        document.getElementById('reseller-input-code').value = r.reseller_code || '';
        document.getElementById('reseller-input-company').value = r.company_name || '';
        document.getElementById('reseller-input-tier').value = r.tier || 'gold';
        document.getElementById('reseller-input-discount').value = r.discount_percent || 40;
        document.getElementById('reseller-input-contact').value = r.contact_name || '';
        document.getElementById('reseller-input-phone').value = r.phone || '';
        document.getElementById('reseller-input-email').value = r.email || '';
        document.getElementById('reseller-input-city').value = r.city || '';
        document.getElementById('reseller-input-status').value = r.status || 'active';
        document.getElementById('reseller-input-note').value = r.note || '';

        this.openModal('modal-reseller-form');
    },

    async saveReseller(event) {
        if (event && event.preventDefault) event.preventDefault();

        const payload = {
            id: Number(document.getElementById('reseller-input-id').value || 0),
            reseller_code: document.getElementById('reseller-input-code').value.trim(),
            company_name: document.getElementById('reseller-input-company').value.trim(),
            tier: document.getElementById('reseller-input-tier').value,
            discount_percent: parseFloat(document.getElementById('reseller-input-discount').value) || 0,
            contact_name: document.getElementById('reseller-input-contact').value.trim(),
            phone: document.getElementById('reseller-input-phone').value.trim(),
            email: document.getElementById('reseller-input-email').value.trim(),
            city: document.getElementById('reseller-input-city').value.trim(),
            status: document.getElementById('reseller-input-status').value,
            note: document.getElementById('reseller-input-note').value.trim()
        };

        try {
            const res = await fetch('api/super_admin?action=save_reseller', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.8563c507','Lưu đại lý thành công!'):'Lưu đại lý thành công!'));
                this.closeModal('modal-reseller-form');
                this.loadResellers();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.2e6d55d2','Lỗi khi lưu đại lý!'):'Lỗi khi lưu đại lý!'));
            }
        } catch (err) {
            console.error('saveReseller error:', err);
            alert((window.cnxT?window.cnxT('js.m_sa.929b5455','Lỗi kết nối máy chủ khi lưu đại lý.'):'Lỗi kết nối máy chủ khi lưu đại lý.'));
        }
    },

    openDepositModal(resellerId, resellerName, curBalance) {
        document.getElementById('deposit-reseller-id').value = resellerId;
        document.getElementById('deposit-reseller-subtitle').innerText = (window.cnxT?window.cnxT('js.m_sa.5519c886','Đại lý: '):'Đại lý: ') + resellerName;
        document.getElementById('deposit-reseller-name').innerText = resellerName;
        document.getElementById('deposit-reseller-cur-bal').innerText = Number(curBalance || 0).toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
        document.getElementById('deposit-wallet-amount').value = 15000000;
        document.getElementById('deposit-wallet-note').value = '';

        this.openModal('modal-deposit-reseller-wallet');
    },

    setDepositAmount(amount) {
        const input = document.getElementById('deposit-wallet-amount');
        if (input) input.value = amount;
    },

    async submitDepositWallet(event) {
        if (event && event.preventDefault) event.preventDefault();

        const payload = {
            reseller_id: Number(document.getElementById('deposit-reseller-id').value),
            amount: parseFloat(document.getElementById('deposit-wallet-amount').value) || 0,
            payment_method: document.getElementById('deposit-wallet-method').value,
            note: document.getElementById('deposit-wallet-note').value.trim()
        };

        if (payload.amount <= 0) {
            alert((window.cnxT?window.cnxT('js.m_sa.0318d218','Vui lòng nhập số tiền nạp hợp lệ (> 0 VNĐ)!'):'Vui lòng nhập số tiền nạp hợp lệ (> 0 VNĐ)!'));
            return;
        }

        try {
            const res = await fetch('api/super_admin?action=deposit_reseller_wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(`${window.cnxT?window.cnxT('js.m_sa.53d666fa','Nạp tiền thành công! Số dư mới:'):'Nạp tiền thành công! Số dư mới:'} ${(data.new_balance || 0).toLocaleString('vi-VN')} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`);
                this.closeModal('modal-deposit-reseller-wallet');
                this.loadResellers();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa.052f19d5','Lỗi khi nạp tiền ví đại lý!'):'Lỗi khi nạp tiền ví đại lý!'));
            }
        } catch (err) {
            console.error('submitDepositWallet error:', err);
            alert((window.cnxT?window.cnxT('js.m_sa.f6f22d3c','Lỗi máy chủ khi nạp tiền ví đại lý.'):'Lỗi máy chủ khi nạp tiền ví đại lý.'));
        }
    },

    openResellerIssueLicenseModal(preferredResellerId) {
        const select = document.getElementById('issue-lic-reseller-select');
        if (!select) return;

        select.innerHTML = (window.cnxT?window.cnxT('js.m_sa.7a467435','<option value="">-- Chọn đại lý phân phối --</option>'):'<option value="">-- Chọn đại lý phân phối --</option>') +
            this.resellers.map(r => `
                <option value="${r.id}" ${r.id === preferredResellerId ? 'selected' : ''}>
                    ${r.reseller_code} - ${r.company_name} ${window.cnxT?window.cnxT('js.m_sa.47c51f00','(Ví:'):'(Ví:'} ${Number(r.wallet_balance || 0).toLocaleString('vi-VN')}${window.cnxT?window.cnxT('js.m_sa.6de9ae7f','đ, Giảm:'):'đ, Giảm:'} ${r.discount_percent}%)
                </option>
            `).join('');

        document.getElementById('issue-lic-store-name').value = '';
        document.getElementById('issue-lic-owner-phone').value = '';
        document.getElementById('issue-lic-period').value = '1y';

        const resBox = document.getElementById('issue-lic-result-box');
        if (resBox) resBox.classList.add('hidden');

        const submitBtn = document.getElementById('btn-submit-issue-lic');
        if (submitBtn) submitBtn.disabled = false;

        this.onIssueLicResellerChange();
        this.openModal('modal-reseller-issue-license');
    },

    onIssueLicResellerChange() {
        const select = document.getElementById('issue-lic-reseller-select');
        const rId = Number(select?.value || 0);
        const r = this.resellers.find(x => x.id === rId);

        const discountText = document.getElementById('issue-lic-discount-text');
        const walletText = document.getElementById('issue-lic-wallet-text');

        if (r) {
            const tm = { bronze: (window.cnxT?window.cnxT('js.m_sa.934f6c87','🥉 Đồng'):'🥉 Đồng'), silver: (window.cnxT?window.cnxT('js.m_sa.7d4eefcf','🥈 Bạc'):'🥈 Bạc'), gold: (window.cnxT?window.cnxT('js.m_sa.32741230','🥇 Vàng'):'🥇 Vàng'), diamond: (window.cnxT?window.cnxT('js.m_sa.6064522d','💎 Kim Cương'):'💎 Kim Cương') }[r.tier] || (window.cnxT?window.cnxT('js.m_sa.32741230','🥇 Vàng'):'🥇 Vàng');
            if (discountText) discountText.innerHTML = `${tm} &bull; <b class="text-teal-300 font-mono">Chiết khấu ${r.discount_percent}%</b>`;
            if (walletText) walletText.innerText = Number(r.wallet_balance || 0).toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
        } else {
            if (discountText) discountText.innerText = (window.cnxT?window.cnxT('js.m_sa_ext.c41d7f02','Vui lòng chọn đại lý'):'Vui lòng chọn đại lý');
            if (walletText) walletText.innerText = (window.cnxT?window.cnxT('ui.sa_html.div_e995e897','0 đ'):'0 đ');
        }

        this.updateIssueLicPriceCalc();
    },

    updateIssueLicPriceCalc() {
        const period = document.getElementById('issue-lic-period')?.value || '1y';
        const msrpMap = { '1m': 399000, '1y': 3990000, 'lifetime': 4990000 };
        const msrp = msrpMap[period] || 3990000;

        const select = document.getElementById('issue-lic-reseller-select');
        const rId = Number(select?.value || 0);
        const r = this.resellers.find(x => x.id === rId);
        const discPercent = r ? Number(r.discount_percent || 0) : 40;

        const discAmount = msrp * discPercent / 100;
        const finalPrice = msrp - discAmount;

        const elMsrp = document.getElementById('issue-lic-calc-msrp');
        const elDiscLabel = document.getElementById('issue-lic-calc-discount-label');
        const elDiscAmount = document.getElementById('issue-lic-calc-discount-amount');
        const elFinal = document.getElementById('issue-lic-calc-final-price');

        if (elMsrp) elMsrp.innerText = msrp.toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
        if (elDiscLabel) elDiscLabel.innerText = `${window.cnxT?window.cnxT('js.m_sa_ext.b0bf31ee','Chiết khấu đại lý ('):'Chiết khấu đại lý ('}${discPercent}%):`;
        if (elDiscAmount) elDiscAmount.innerText = '-' + discAmount.toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
        if (elFinal) elFinal.innerText = finalPrice.toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
    },

    async submitResellerIssueLicense(event) {
        if (event && event.preventDefault) event.preventDefault();

        const rId = Number(document.getElementById('issue-lic-reseller-select')?.value || 0);
        if (!rId) {
            alert((window.cnxT?window.cnxT('js.m_sa_ext.70f4496d','Vui lòng chọn đại lý!'):'Vui lòng chọn đại lý!'));
            return;
        }

        const storeName = document.getElementById('issue-lic-store-name').value.trim();
        const ownerPhone = document.getElementById('issue-lic-owner-phone').value.trim();
        const period = document.getElementById('issue-lic-period').value;

        if (!storeName || !ownerPhone) {
            alert((window.cnxT?window.cnxT('js.m_sa_ext.dcae3401','Vui lòng nhập tên quán và số điện thoại chủ quán!'):'Vui lòng nhập tên quán và số điện thoại chủ quán!'));
            return;
        }

        const submitBtn = document.getElementById('btn-submit-issue-lic');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const res = await fetch('api/super_admin?action=reseller_issue_license', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reseller_id: rId,
                    store_name: storeName,
                    owner_phone: ownerPhone,
                    period: period
                })
            });
            const data = await res.json();
            if (data.success) {
                // Show result box
                const resBox = document.getElementById('issue-lic-result-box');
                const keyEl = document.getElementById('issue-lic-result-key');
                const detailEl = document.getElementById('issue-lic-result-detail');

                if (resBox && keyEl && detailEl) {
                    keyEl.innerText = data.license_key || '';
                    detailEl.innerHTML = `Mã quán: <b class="text-sky-300 font-mono">${data.tenant_code}</b> ${window.cnxT?window.cnxT('js.m_sa_ext.dd12bb06','&bull; Quán:'):'&bull; Quán:'} <b class="text-white">${storeName}</b> ${window.cnxT?window.cnxT('js.m_sa_ext.5253c5df','&bull; Hạn:'):'&bull; Hạn:'} <b class="text-amber-300 font-mono">${data.expire_date}</b> ${window.cnxT?window.cnxT('js.m_sa_ext.8ca307bc','&bull; Thực trừ:'):'&bull; Thực trừ:'} <b class="text-emerald-400 font-mono">${(data.price_charged || 0).toLocaleString('vi-VN')} đ</b>`;
                    resBox.classList.remove('hidden');
                }

                // Update wallet text in modal
                const walletText = document.getElementById('issue-lic-wallet-text');
                if (walletText && data.wallet_balance !== undefined) {
                    walletText.innerText = Number(data.wallet_balance).toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
                }

                // Background reload
                this.loadResellers();
                this.loadTenants();

            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.m_sa_ext.40a8ef08','Lỗi khi cấp bản quyền!'):'Lỗi khi cấp bản quyền!'));
                if (submitBtn) submitBtn.disabled = false;
            }
        } catch (err) {
            console.error('submitResellerIssueLicense error:', err);
            alert((window.cnxT?window.cnxT('js.m_sa_ext.7469e70e','Lỗi kết nối máy chủ khi cấp bản quyền.'):'Lỗi kết nối máy chủ khi cấp bản quyền.'));
            if (submitBtn) submitBtn.disabled = false;
        }
    },

    copyResultKey() {
        const key = document.getElementById('issue-lic-result-key')?.innerText.trim();
        if (key && navigator.clipboard) {
            navigator.clipboard.writeText(key).then(() => {
                alert((window.cnxT?window.cnxT('js.m_sa.8d146298','Đã sao chép mã License Key: '):'Đã sao chép mã License Key: ') + key);
            });
        }
    },

    async openWalletLogsModal(resellerId, resellerName) {
        document.getElementById('wallet-logs-title-reseller').innerText = (window.cnxT?window.cnxT('js.m_sa.5519c886','Đại lý: '):'Đại lý: ') + resellerName;
        const tbody = document.getElementById('wallet-logs-tbody');
        if (tbody) {
            tbody.innerHTML = (window.cnxT?window.cnxT('js.m_sa_ext.d553035e','<tr><td colspan="6" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải dữ liệu biến động ví...</td></tr>'):'<tr><td colspan="6" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải dữ liệu biến động ví...</td></tr>');
        }
        this.openModal('modal-reseller-wallet-logs');

        try {
            const res = await fetch(`api/super_admin?action=get_reseller_wallet_logs&reseller_id=${resellerId}`);
            const data = await res.json();
            if (!data.success || !data.logs || data.logs.length === 0) {
                if (tbody) tbody.innerHTML = (window.cnxT?window.cnxT('js.m_sa_ext.07d522e3','<tr><td colspan="6" class="text-center py-6 text-slate-400">Chưa có giao dịch biến động ví nào.</td></tr>'):'<tr><td colspan="6" class="text-center py-6 text-slate-400">Chưa có giao dịch biến động ví nào.</td></tr>');
                return;
            }

            const typeMeta = {
                deposit: { label: (window.cnxT?window.cnxT('js.m_sa_ext.315afd6f','Nạp Tiền Ví'):'Nạp Tiền Ví'), badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', sign: '+' },
                license_deduct: { label: (window.cnxT?window.cnxT('js.m_sa_ext.97054606','Cấp Bản Quyền'):'Cấp Bản Quyền'), badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30', sign: '-' }
            };

            const logList = data.logs || data.data || [];
            if (tbody) {
                tbody.innerHTML = logList.map(l => {
                    const tm = typeMeta[l.trans_type] || { label: l.trans_type, badge: 'bg-slate-700 text-slate-200', sign: '' };
                    const amount = Number(l.amount || 0);
                    const balAfter = Number(l.balance_after || 0);

                    return `
                        <tr class="hover:bg-white/5 border-b border-white/5">
                            <td class="py-2.5 px-3 text-slate-400">${l.created_at || '—'}</td>
                            <td class="py-2.5 px-3">
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${tm.badge}">
                                    ${tm.label}
                                </span>
                            </td>
                            <td class="py-2.5 px-3 text-right font-bold ${tm.sign === '+' ? 'text-emerald-400' : 'text-rose-400'}">
                                ${tm.sign}${amount.toLocaleString('vi-VN')} đ
                            </td>
                            <td class="py-2.5 px-3 text-right text-slate-200">
                                ${balAfter.toLocaleString('vi-VN')} đ
                            </td>
                            <td class="py-2.5 px-3">
                                ${l.license_key ? `<span class="text-teal-300 select-all">${l.license_key}</span>` : '—'}
                                ${l.store_name ? `<div class="text-[11px] text-slate-400">${l.store_name}</div>` : ''}
                            </td>
                            <td class="py-2.5 px-3 text-slate-300 text-[11px]">
                                ${l.note || '—'}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (err) {
            console.error('openWalletLogsModal error:', err);
            if (tbody) tbody.innerHTML = (window.cnxT?window.cnxT('js.m_sa_ext.9c6fa570','<tr><td colspan="6" class="text-center py-6 text-rose-400">Lỗi khi tải lịch sử biến động ví.</td></tr>'):'<tr><td colspan="6" class="text-center py-6 text-rose-400">Lỗi khi tải lịch sử biến động ví.</td></tr>');
        }
    },

    openModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.classList.add('open');
    },

    closeModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.classList.remove('open');
    },

    async openPushUpdateModal(targetCode = 'ALL', preselectVersion = '') {
        const modal = document.getElementById('modal-push-update');
        if (!modal) return;
        const targetSelect = document.getElementById('push-target-code');
        const modeSelect = document.getElementById('push-mode');
        const infoEl = document.getElementById('push-patch-info');
        if (targetSelect) {
            const activeTenants = (this.tenants || []).filter(t => t.subscription_status !== 'deleted');
            targetSelect.innerHTML = [
                (window.cnxT?window.cnxT('js.m_sa_ext.3bfd90a8','<option value="ALL">ALL — Tất cả cửa hàng (Chỉ hiện bản đại trà)</option>'):'<option value="ALL">ALL — Tất cả cửa hàng (Chỉ hiện bản đại trà)</option>'),
                ...activeTenants.map(t => `<option value="${t.tenant_code}">${t.tenant_code} — ${this._escHtml(t.store_name || '')}</option>`)
            ].join('');
            targetSelect.value = targetCode || 'ALL';
        }
        if (modeSelect) modeSelect.value = 'ota_update';
        this.onPushModeChange();
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (infoEl) infoEl.textContent = (window.cnxT?window.cnxT('js.m_sa_ext.5a26d264','Đang tải danh sách các bản vá trên Master...'):'Đang tải danh sách các bản vá trên Master...');
        try {
            const res = await fetch('/api/super_admin?action=list_patches');
            const data = await res.json();
            const patches = (data.success && Array.isArray(data.patches)) ? data.patches : [];
            patches.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
            this._pushPatchesCache = patches;
            this.onPushTargetChange(preselectVersion);
        } catch (e) {
            if (infoEl) infoEl.textContent = (window.cnxT?window.cnxT('js.m_sa.dc57373f','Không kiểm tra được kho bản vá: '):'Không kiểm tra được kho bản vá: ') + e.message;
        }
    },

    onPushModeChange() {
        const mode = document.getElementById('push-mode')?.value || 'ota_update';
        const isOta = (mode === 'ota_update');
        document.getElementById('push-patch-version-wrap')?.classList.toggle('hidden', !isOta);
        document.getElementById('push-auto-apply-wrap')?.classList.toggle('hidden', !isOta);
        const infoEl = document.getElementById('push-patch-info');
        if (infoEl) infoEl.classList.toggle('hidden', !isOta);
    },

    onPushTargetChange(preselectVersion = '') {
        const targetCode = (document.getElementById('push-target-code')?.value || 'ALL').trim();
        const verSelect = document.getElementById('push-patch-version');
        const infoEl = document.getElementById('push-patch-info');
        const lblEl = document.getElementById('push-patch-label');
        const allPatches = this._pushPatchesCache || [];

        const filtered = allPatches.filter(p => {
            const pt = String(p.target_tenant || '').trim();
            if (targetCode === 'ALL') return !pt;
            return !pt || pt === targetCode;
        });

        if (lblEl) {
            lblEl.textContent = targetCode === 'ALL'
                ? 'Chọn phiên bản bản vá Đại trà (Không chứa bản riêng từng quán)'
                : `${window.cnxT?window.cnxT('js.m_sa_ext.ad9c13b4','Chọn phiên bản bản vá áp dụng cho ['):'Chọn phiên bản bản vá áp dụng cho ['}${targetCode}]`;
        }

        if (!verSelect) return;
        if (filtered.length === 0) {
            verSelect.innerHTML = targetCode === 'ALL'
                ? '<option value="">-- Chưa có bản vá đại trà nào --</option>'
                : `<option value="">-- Chưa có bản vá riêng (-${targetCode}) cho quán này --</option>`;
            if (infoEl) {
                infoEl.textContent = targetCode === 'ALL'
                    ? 'Chưa có bản vá đại trà nào trên Master.'
                    : `${window.cnxT?window.cnxT('ui.sa_html.th_3c764753','Quán'):'Quán'} ${targetCode} ${window.cnxT?window.cnxT('js.m_sa_ext.46bb0870','chưa có bản vá riêng (đuôi -'):'chưa có bản vá riêng (đuôi -'}${targetCode}).`;
            }
            return;
        }

        verSelect.innerHTML = filtered.map((p, idx) => {
            const mb = (Number(p.size_bytes || 0) / (1024 * 1024)).toFixed(2);
            const pushedList = Array.isArray(p.pushed_stores) ? p.pushed_stores : [];
            const storeOnlyList = pushedList.filter(s => s && s !== 'ALL');
            const relStatus = String(p.release_status || '').toLowerCase();
            const isRevoked = relStatus === 'revoked';
            const isPublished = !isRevoked && (relStatus === 'published' || Boolean(p.auto_publish));
            const isPilot = !isRevoked && !isPublished && (relStatus === 'pilot' || storeOnlyList.length > 0);
            const tags = [];
            if (p.target_tenant) {
                tags.push(`${window.cnxT?window.cnxT('js.m_sa_ext.c8abb6ff','RIÊNG:'):'RIÊNG:'} ${p.target_tenant}`);
                tags.push(pushedList.includes(p.target_tenant) ? 'ĐÃ ĐẨY' : 'CHƯA ĐẨY');
            } else if (isRevoked) {
                tags.push('ĐÃ THU HỒI');
            } else if (isPublished) {
                tags.push('ĐẠI TRÀ • ĐÃ PHÁT HÀNH');
            } else if (isPilot) {
                tags.push(`THỬ NGHIỆM (${storeOnlyList.length || 1} quán)`);
            } else {
                tags.push('BẢN NHÁP • CHƯA ĐẨY');
            }
            if (idx === 0 && !isRevoked) tags.push((window.cnxT?window.cnxT('js.m_sa_ext.40d8a349','Mới nhất'):'Mới nhất'));
            const tagStr = ` [${tags.join(' • ')}]`;
            return `<option value="${p.version}">v${p.version}${tagStr} — ${mb} MB (${p.title || ''})</option>`;
        }).join('');
        verSelect.value = preselectVersion && filtered.some(p => p.version === preselectVersion)
            ? preselectVersion
            : filtered[0].version;
        this.onPushPatchVersionChange();
    },

    onPushPatchVersionChange() {
        const verSelect = document.getElementById('push-patch-version');
        const infoEl = document.getElementById('push-patch-info');
        const titleEl = document.getElementById('push-title');
        const msgEl = document.getElementById('push-message');
        const ver = verSelect ? verSelect.value : '';
        const p = (this._pushPatchesCache || []).find(x => x.version === ver);
        if (!p) return;
        const mb = (Number(p.size_bytes || 0) / (1024 * 1024)).toFixed(2);
        if (infoEl) {
            infoEl.textContent = `${window.cnxT?window.cnxT('js.m_sa_ext.b1eede78','Đã chọn: v'):'Đã chọn: v'}${p.version} (${mb} MB • ${p.files_count || 0} files • ${p.created_at || ''}) — ${p.title || ''}`;
        }
        if (titleEl) titleEl.value = p.title ? `${window.cnxT?window.cnxT('js.m_sa_ext.6eaacaa0','Cập nhật CyberNexus POS v'):'Cập nhật CyberNexus POS v'}${p.version}: ${p.title}` : `${window.cnxT?window.cnxT('js.m_sa_ext.e473a3e9','Cập nhật hệ thống CyberNexus POS v'):'Cập nhật hệ thống CyberNexus POS v'}${p.version}`;
        if (msgEl && p.notes) msgEl.value = p.notes;
    },

    async submitPushUpdate(btn) {
        const targetCode = (document.getElementById('push-target-code')?.value || 'ALL').trim();
        const mode = document.getElementById('push-mode')?.value || 'notify';
        const version = document.getElementById('push-patch-version')?.value || '';
        const title = (document.getElementById('push-title')?.value || '').trim();
        const message = (document.getElementById('push-message')?.value || '').trim();
        const autoApply = Boolean(document.getElementById('push-auto-apply')?.checked);

        if (!title) {
            alert((window.cnxT?window.cnxT('js.m_sa_ext.e39216f3','Vui lòng nhập tiêu đề thông báo!'):'Vui lòng nhập tiêu đề thông báo!'));
            return;
        }
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = (window.cnxT?window.cnxT('js.m_sa_ext.08f9262a','<i class="fas fa-spinner fa-spin"></i> Đang gửi...'):'<i class="fas fa-spinner fa-spin"></i> Đang gửi...'); }
        try {
            const res = await fetch('/api/super_admin?action=push_store_update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_code: targetCode, mode, version, title, message, auto_apply: autoApply })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.m_sa_ext.d6ecb2b7','Đã gửi thành công!'):'Đã gửi thành công!'), 'success');
                const modal = document.getElementById('modal-push-update');
                if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
            } else {
                this.showToast((window.cnxT?window.cnxT('js.m_sa.5b983751','Lỗi: '):'Lỗi: ') + (data.message || (window.cnxT?window.cnxT('js.m_sa_ext.408a03a4','Không thể gửi'):'Không thể gửi')), 'error');
            }
        } catch (e) {
            this.showToast((window.cnxT?window.cnxT('js.m_sa.e5f87ad3','Lỗi kết nối: '):'Lỗi kết nối: ') + e.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
        }
    },

    _escHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    switchAiVaultSubTab(tab) {
        const tabs = ['keys', 'history', 'quotas'];
        tabs.forEach(t => {
            const btn = document.getElementById(`ai-subtab-btn-${t}`);
            const panel = document.getElementById(`ai-subpanel-${t}`);
            const active = (t === tab);
            if (panel) panel.classList.toggle('hidden', !active);
            if (btn) {
                btn.classList.toggle('bg-purple-600/30', active);
                btn.classList.toggle('text-white', active);
                btn.classList.toggle('border-purple-400/40', active);
                btn.classList.toggle('font-bold', active);
                btn.classList.toggle('text-slate-300', !active);
                btn.classList.toggle('border-transparent', !active);
            }
        });
    },

    toggleAddGeminiKeyModal(forceState) {
        const box = document.getElementById('master-ai-input-box');
        if (!box) return;
        if (typeof forceState === 'boolean') box.classList.toggle('hidden', !forceState);
        else box.classList.toggle('hidden');
    },

    async loadMasterAiVault() {
        try {
            const res = await fetch('api/super_admin.php?action=get_ai_vault').then(r => r.json());
            if (!res || !res.success) return;

            const keys = Array.isArray(res.keys) ? res.keys : [];
            const history = Array.isArray(res.key_history) ? res.key_history : [];
            const rows = Array.isArray(res.store_quotas)
                ? res.store_quotas
                : (Array.isArray(res.usage_by_store) ? res.usage_by_store : []);

            this._aiKeys = keys;
            this._aiKeyHistory = history;
            this._aiStoreRows = rows;

            const cKeys = document.getElementById('ai-subtab-count-keys');
            if (cKeys) cKeys.textContent = String(keys.length);
            const cHist = document.getElementById('ai-subtab-count-history');
            if (cHist) cHist.textContent = String(history.length);
            const cQuotas = document.getElementById('ai-subtab-count-quotas');
            if (cQuotas) cQuotas.textContent = String(rows.length);

            const activeKey = res.active_key || keys.find(k => k.status === 'active') || null;
            const navBadge = document.getElementById('nav-badge-ai-key');
            if (navBadge) {
                navBadge.textContent = activeKey ? 'ON' : 'OFF';
                navBadge.className = activeKey
                    ? 'px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-bold'
                    : 'px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[9px] font-bold';
            }

            const kpiActLabel = document.getElementById('ai-kpi-active-label');
            const kpiActMeta = document.getElementById('ai-kpi-active-meta');
            if (kpiActLabel && kpiActMeta) {
                if (activeKey) {
                    kpiActLabel.textContent = activeKey.label || 'Gemini Key';
                    kpiActMeta.textContent = `${activeKey.key_masked || '••••'} • ${activeKey.model_count || 0} models`;
                    kpiActMeta.className = 'text-[11px] font-mono text-emerald-300';
                } else {
                    kpiActLabel.textContent = (window.cnxT?window.cnxT('js.m_sa_ext.20d091a9','Chưa có Key hoạt động'):'Chưa có Key hoạt động');
                    kpiActMeta.textContent = (window.cnxT?window.cnxT('js.m_sa_ext.5b8dd513','Hãy nạp Key mới để bật AI'):'Hãy nạp Key mới để bật AI');
                    kpiActMeta.className = 'text-[11px] font-mono text-rose-300';
                }
            }

            const standbyCount = keys.filter(k => k.status === 'standby').length;
            const kpiPoolCount = document.getElementById('ai-kpi-pool-count');
            const kpiPoolMeta = document.getElementById('ai-kpi-pool-meta');
            if (kpiPoolCount) kpiPoolCount.textContent = `${standbyCount} ${window.cnxT?window.cnxT('js.m_sa_ext.d8703a4d','dự phòng /'):'dự phòng /'} ${keys.length} Key`;
            if (kpiPoolMeta) {
                kpiPoolMeta.textContent = standbyCount > 0 ? 'Auto-Failover đã sẵn sàng' : (window.cnxT?window.cnxT('js.m_sa_ext.6ab7b3c5','Nên thêm ít nhất 1 Key dự phòng'):'Nên thêm ít nhất 1 Key dự phòng');
            }

            const totEl = document.getElementById('master-ai-total-calls');
            if (totEl) totEl.textContent = `${res.total_calls_month || 0} ${window.cnxT?window.cnxT('js.m_sa_ext.03a74142','lượt •'):'lượt •'} ${res.total_credits_month || 0} credit`;

            const warnKeys = keys.filter(k => {
                if (k.status === 'rate_limited' || k.status === 'revoked' || k.status === 'expired') return true;
                if (k.days_until_expiry !== null && k.days_until_expiry !== undefined && Number(k.days_until_expiry) <= 7) return true;
                const mcl = Number(k.monthly_credit_limit || 0);
                const cm = Number(k.credits_month || 0);
                return mcl > 0 && (cm / mcl) >= 0.8;
            });
            const kpiHealth = document.getElementById('ai-kpi-health-status');
            const kpiHealthMeta = document.getElementById('ai-kpi-health-meta');
            if (kpiHealth && kpiHealthMeta) {
                if (!activeKey) {
                    kpiHealth.textContent = (window.cnxT?window.cnxT('ui.sa_html.span_8618facd','Chưa kích hoạt'):'Chưa kích hoạt');
                    kpiHealth.className = 'text-sm font-bold text-rose-300';
                    kpiHealthMeta.textContent = (window.cnxT?window.cnxT('js.m_sa_ext.8e82abda','Cần nạp ít nhất 1 Gemini Key'):'Cần nạp ít nhất 1 Gemini Key');
                } else if (warnKeys.length > 0) {
                    kpiHealth.textContent = `${warnKeys.length} ${window.cnxT?window.cnxT('js.m_sa_ext.90dc5359','cảnh báo'):'cảnh báo'}`;
                    kpiHealth.className = 'text-sm font-bold text-amber-300';
                    kpiHealthMeta.textContent = (window.cnxT?window.cnxT('js.m_sa_ext.e537205d','Có key lỗi, chạm ngưỡng hoặc sắp hết hạn'):'Có key lỗi, chạm ngưỡng hoặc sắp hết hạn');
                } else {
                    kpiHealth.textContent = (window.cnxT?window.cnxT('ui.sa_html.div_cc45682d','Ổn định'):'Ổn định');
                    kpiHealth.className = 'text-sm font-bold text-emerald-300';
                    kpiHealthMeta.textContent = (window.cnxT?window.cnxT('js.m_sa_ext.95a87238','Tất cả key đều trong ngưỡng an toàn'):'Tất cả key đều trong ngưỡng an toàn');
                }
            }

            this.renderMasterAiKeys();
            this.filterMasterAiHistory();
            this.filterMasterAiStores();
        } catch (e) {}
    },

    renderMasterAiKeys() {
        const listEl = document.getElementById('master-ai-keys-list');
        if (!listEl) return;
        const keys = Array.isArray(this._aiKeys) ? this._aiKeys : [];
        if (keys.length === 0) {
            listEl.innerHTML = (window.cnxT?window.cnxT('js.m_sa_ext.08617cfc','<div class="p-6 text-center text-slate-400">Chưa có Gemini API Key nào trong Master Vault. Hãy bấm <b class="text-purple-300">+ Nạp Key Mới</b> ở góc trên.</div>'):'<div class="p-6 text-center text-slate-400">Chưa có Gemini API Key nào trong Master Vault. Hãy bấm <b class="text-purple-300">+ Nạp Key Mới</b> ở góc trên.</div>');
            return;
        }

        const statusBadge = (st) => {
            switch (st) {
                case 'active': return (window.cnxT?window.cnxT('js.m_sa_ext.7a7592f6','<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 text-[10px] font-bold">ĐANG CHẠY</span>'):'<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 text-[10px] font-bold">ĐANG CHẠY</span>');
                case 'standby': return (window.cnxT?window.cnxT('js.m_sa_ext.c66bcbb2','<span class="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-semibold">DỰ PHÒNG</span>'):'<span class="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-semibold">DỰ PHÒNG</span>');
                case 'rate_limited': return (window.cnxT?window.cnxT('js.m_sa_ext.2f9bb3a3','<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold">CHẠM 429</span>'):'<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold">CHẠM 429</span>');
                case 'expired': return (window.cnxT?window.cnxT('js.m_sa_ext.6da2e29c','<span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-bold">HẾT HẠN</span>'):'<span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-bold">HẾT HẠN</span>');
                case 'revoked': return (window.cnxT?window.cnxT('js.m_sa_ext.e6ec5719','<span class="px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-300 border border-rose-400/40 text-[10px] font-bold">BỊ KHÓA</span>'):'<span class="px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-300 border border-rose-400/40 text-[10px] font-bold">BỊ KHÓA</span>');
                default: return (window.cnxT?window.cnxT('js.m_sa_ext.5c7414d1','<span class="px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-white/10 text-[10px]">TẠM TẮT</span>'):'<span class="px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-white/10 text-[10px]">TẠM TẮT</span>');
            }
        };

        listEl.innerHTML = keys.map(k => {
            const id = Number(k.id || 0);
            const isActive = k.status === 'active';
            const isDisabled = k.status === 'disabled';
            const mcl = Number(k.monthly_credit_limit || 0);
            const drl = Number(k.daily_request_limit || 0);
            const creditsMonth = Number(k.credits_month || 0);
            const callsToday = Number(k.calls_today || 0);
            const pctMonth = mcl > 0 ? Math.min(100, Math.round((creditsMonth / mcl) * 100)) : 0;
            const daysExp = k.days_until_expiry;
            let expBadge = (window.cnxT?window.cnxT('js.m_sa_ext.b8a032fe','<span class="text-slate-400">Không thời hạn</span>'):'<span class="text-slate-400">Không thời hạn</span>');
            if (k.expires_at) {
                const d = Number(daysExp);
                if (d < 0) expBadge = `<span class="text-rose-300 font-semibold">Quá hạn (${this._escHtml(k.expires_at)})</span>`;
                else if (d <= 7) expBadge = `<span class="text-amber-300 font-semibold">HSD: ${this._escHtml(k.expires_at)} ${window.cnxT?window.cnxT('js.m_sa_ext.85b5404e','(còn'):'(còn'} ${d} ngày)</span>`;
                else expBadge = `<span class="text-slate-300">HSD: ${this._escHtml(k.expires_at)} ${window.cnxT?window.cnxT('js.m_sa_ext.85b5404e','(còn'):'(còn'} ${d} ngày)</span>`;
            }

            return `
            <div class="p-3.5 ${isActive ? 'bg-emerald-950/20' : 'hover:bg-white/[0.03]'} transition-colors space-y-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-2 min-w-0">
                        ${statusBadge(k.status)}
                        <span class="font-bold text-white text-xs truncate">${this._escHtml(k.label || 'AI Key')}</span>
                        <span class="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/25 text-[10px] uppercase font-mono text-sky-300">${this._escHtml(k.provider || 'gemini')}</span>
                        <span class="font-mono text-[11px] text-purple-300 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-400/20">${this._escHtml(k.key_masked || '••••')}</span>
                        <span class="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] uppercase font-mono text-slate-300">${this._escHtml(k.tier || 'free')}</span>
                        <span class="text-[10px] font-mono text-slate-400">Ưu tiên #${Number(k.priority || 100)}</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5">
                        <button type="button" onclick="SuperAdmin.testGeminiKey(${id}, this)" class="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 border border-sky-400/30 text-[10px] font-semibold" title="Kiểm tra kết nối trực tiếp Google Gemini">
                            <i class="fas fa-stethoscope mr-1"></i>Test
                        </button>
                        ${!isActive ? `<button type="button" onclick="SuperAdmin.activateGeminiKey(${id})" class="px-2 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-bold"><i class="fas fa-bolt mr-1"></i>${window.cnxT?window.cnxT('js.m_sa.64b54099','Đặt chính'):'Đặt chính'}</button>` : ''}
                        <button type="button" onclick="SuperAdmin.toggleKeyMetaEditor(${id})" class="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 border border-purple-400/30 text-[10px] font-semibold" title="Sửa nhãn, hạn mức, thời hạn">
                            <i class="fas fa-sliders"></i>
                        </button>
                        ${!isActive ? `<button type="button" onclick="SuperAdmin.toggleGeminiKey(${id})" class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 text-[10px]" title="${isDisabled ? 'Bật lại Dự phòng' : (window.cnxT?window.cnxT('js.m_sa.7062a889','Tạm tắt'):'Tạm tắt')}"><i class="fas ${isDisabled ? 'fa-play' : 'fa-pause'}"></i></button>` : ''}
                        <button type="button" onclick="SuperAdmin.deleteMasterGeminiKey(${id})" class="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[10px]" title="Xóa Key"><i class="fas fa-trash"></i></button>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-slate-400">
                    <div>
                        ${window.cnxT?window.cnxT('js.m_sa_ext.94630a52','Hạn mức tháng:'):'Hạn mức tháng:'} <b class="font-mono text-sky-300">${creditsMonth}${mcl > 0 ? '/' + mcl : ''} cr</b>
                        ${mcl > 0 ? `<div class="w-full h-1 rounded-full bg-slate-800 mt-1 overflow-hidden"><div class="h-full ${pctMonth >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}" style="width:${pctMonth}%"></div></div>` : ''}
                    </div>
                    <div>
                        ${window.cnxT?window.cnxT('js.m_sa_ext.6b52241b','Hôm nay:'):'Hôm nay:'} <b class="font-mono text-slate-200">${callsToday}${drl > 0 ? '/' + drl : ''} lượt</b> ${window.cnxT?window.cnxT('js.m_sa_ext.4218fdcc','• Tháng:'):'• Tháng:'} <b class="font-mono text-slate-200">${k.calls_month || 0}</b> ${window.cnxT?window.cnxT('js.m_sa_ext.03a74142','lượt •'):'lượt •'} <span class="${Number(k.errors_month || 0) > 0 ? 'text-rose-300 font-semibold' : ''}">${k.errors_month || 0} lỗi</span>
                    </div>
                    <div class="sm:text-right">
                        ${expBadge} • <span class="font-mono">${k.model_count || 0} models</span>
                    </div>
                </div>

                ${k.last_error ? `<div class="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg px-2.5 py-1.5 font-mono truncate" title="${this._escHtml(k.last_error)}"><i class="fas fa-circle-exclamation mr-1"></i>${this._escHtml(k.last_error)}</div>` : ''}

                <div id="key-meta-editor-${id}" class="hidden pt-2.5 mt-2 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2 bg-slate-900/50 p-2.5 rounded-xl items-end">
                    <div class="sm:col-span-2">
                        <label class="block text-[10px] text-slate-400 mb-0.5">${window.cnxT?window.cnxT('js.m_sa_ext.d26d804e','Nhãn gợi nhớ'):'Nhãn gợi nhớ'}</label>
                        <input type="text" id="key-edit-label-${id}" value="${this._escHtml(k.label || '')}" class="liquid-input w-full py-1 px-2 text-xs" />
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 mb-0.5">${window.cnxT?window.cnxT('js.m_sa_ext.ddba9df6','Gói'):'Gói'}</label>
                        <select id="key-edit-tier-${id}" class="liquid-input w-full py-1 px-2 text-xs">
                            <option value="free" ${k.tier === 'free' ? 'selected' : ''}>Free</option>
                            <option value="payg" ${k.tier === 'payg' ? 'selected' : ''}>PayG</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 mb-0.5">${window.cnxT?window.cnxT('js.m_sa_ext.522e60c9','Limit cr/tháng'):'Limit cr/tháng'}</label>
                        <input type="number" id="key-edit-mcl-${id}" value="${mcl}" min="0" class="liquid-input w-full py-1 px-2 text-xs font-mono" />
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 mb-0.5">${window.cnxT?window.cnxT('js.m_sa_ext.15576aed','Ngày hết hạn'):'Ngày hết hạn'}</label>
                        <input type="date" id="key-edit-exp-${id}" value="${this._escHtml(k.expires_at || '')}" class="liquid-input w-full py-1 px-2 text-xs font-mono" />
                    </div>
                    <div class="flex items-center gap-1.5">
                        <div class="flex-1">
                            <label class="block text-[10px] text-slate-400 mb-0.5">${window.cnxT?window.cnxT('js.m_sa_ext.5bfd5008','Ưu tiên'):'Ưu tiên'}</label>
                            <input type="number" id="key-edit-pri-${id}" value="${Number(k.priority || 100)}" min="1" class="liquid-input w-full py-1 px-2 text-xs font-mono" />
                        </div>
                        <button type="button" onclick="SuperAdmin.saveGeminiKeyMeta(${id}, this)" class="px-3 py-1.5 rounded-lg bg-emerald-600/85 hover:bg-emerald-500 text-white text-[11px] font-bold">${window.cnxT?window.cnxT('ui.admin_html.button_737d070e','Lưu'):'Lưu'}</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    filterMasterAiHistory() {
        const listEl = document.getElementById('master-ai-history-list');
        if (!listEl) return;
        const rows = Array.isArray(this._aiKeyHistory) ? this._aiKeyHistory : [];
        const q = (document.getElementById('master-ai-history-search')?.value || '').trim().toLowerCase();
        const mode = document.getElementById('master-ai-history-filter')?.value || 'all';

        const filtered = rows.filter(r => {
            const evt = String(r.event_type || '');
            if (mode === 'lifecycle' && !['ADDED', 'ACTIVATED', 'UPDATED', 'DISABLED', 'ENABLED', 'DELETED'].includes(evt)) return false;
            if (mode === 'failover' && evt !== 'AUTO_FAILOVER') return false;
            if (mode === 'error' && !['RATE_LIMITED', 'REVOKED', 'EXPIRED'].includes(evt)) return false;
            if (mode === 'test' && !['TEST_OK', 'TEST_FAIL'].includes(evt)) return false;
            if (q) {
                const hay = `${r.key_label || ''} ${r.key_masked || ''} ${r.event_type || ''} ${r.detail || ''} ${r.actor || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        const countEl = document.getElementById('master-ai-history-count');
        if (countEl) countEl.textContent = `${filtered.length} ${window.cnxT?window.cnxT('js.m_sa_ext.2179d660','bản ghi'):'bản ghi'}`;

        if (filtered.length === 0) {
            listEl.innerHTML = (window.cnxT?window.cnxT('js.m_sa_ext.a71f5161','<div class="p-5 text-center italic text-slate-500">Chưa có nhật ký sự kiện Key phù hợp.</div>'):'<div class="p-5 text-center italic text-slate-500">Chưa có nhật ký sự kiện Key phù hợp.</div>');
            return;
        }

        const evtBadge = (evt) => {
            if (['ADDED', 'ACTIVATED', 'TEST_OK', 'ENABLED'].includes(evt)) return `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold">${evt}</span>`;
            if (evt === 'AUTO_FAILOVER') return `<span class="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-mono font-bold">${evt}</span>`;
            if (['RATE_LIMITED', 'REVOKED', 'EXPIRED', 'TEST_FAIL', 'DELETED'].includes(evt)) return `<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-mono font-bold">${evt}</span>`;
            return `<span class="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 border border-white/10 text-[10px] font-mono font-bold">${this._escHtml(evt)}</span>`;
        };

        listEl.innerHTML = filtered.map(r => `
            <div class="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-white/[0.03]">
                <div class="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                    ${evtBadge(r.event_type)}
                    <span class="font-semibold text-white">${this._escHtml(r.key_label || 'Key')}</span>
                    <span class="font-mono text-[10px] text-purple-300">${this._escHtml(r.key_masked || '')}</span>
                    <span class="text-[11px] text-slate-300 truncate" title="${this._escHtml(r.detail || '')}">${this._escHtml(r.detail || '')}</span>
                </div>
                <div class="text-[10px] font-mono text-slate-400 shrink-0">
                    <span class="text-slate-500">${this._escHtml(r.actor || 'System')}</span> • ${this._escHtml(r.created_at || '--')}
                </div>
            </div>
        `).join('');
    },

    toggleKeyMetaEditor(id) {
        const el = document.getElementById(`key-meta-editor-${id}`);
        if (el) el.classList.toggle('hidden');
    },

    async saveGeminiKeyMeta(id, btn) {
        if (btn) btn.disabled = true;
        try {
            const payload = {
                key_id: id,
                label: document.getElementById(`key-edit-label-${id}`)?.value.trim() || 'Gemini Key',
                tier: document.getElementById(`key-edit-tier-${id}`)?.value || 'free',
                monthly_credit_limit: Number(document.getElementById(`key-edit-mcl-${id}`)?.value || 0),
                expires_at: document.getElementById(`key-edit-exp-${id}`)?.value || '',
                priority: Number(document.getElementById(`key-edit-pri-${id}`)?.value || 100)
            };
            const res = await fetch('api/super_admin.php?action=update_gemini_key_meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json());
            if (res.success) await this.loadMasterAiVault();
            else alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.8d23c71c','Không thể cập nhật thông tin Key!'):'Không thể cập nhật thông tin Key!'));
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.e5f87ad3','Lỗi kết nối: '):'Lỗi kết nối: ') + e.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    },


    getWorkflowLabel(t) {
        const s = t.workflow_stage || 'pending_contract';
        if (t.subscription_status === 'trial' || s === 'trial') return (window.cnxT?window.cnxT('js.m_sa_ext.2e4eae5e','Trial 07 ngày'):'Trial 07 ngày');
        const map = {
            'pending_contract': (window.cnxT?window.cnxT('js.m_sa_ext.16daaf5b','Sales: Chờ Hợp Đồng'):'Sales: Chờ Hợp Đồng'),
            'pending_payment': (window.cnxT?window.cnxT('js.m_sa_ext.299d92a2','Kế toán: Chờ Tiền/VAT'):'Kế toán: Chờ Tiền/VAT'),
            'ready_to_install': (window.cnxT?window.cnxT('js.m_sa_ext.b9162597','Kỹ thuật: Chờ Đóng Gói'):'Kỹ thuật: Chờ Đóng Gói'),
            'pending_handover': (window.cnxT?window.cnxT('js.m_sa_ext.0cae1380','Kỹ thuật: Chờ Nghiệm Thu'):'Kỹ thuật: Chờ Nghiệm Thu'),
            'active': (window.cnxT?window.cnxT('js.m_sa_ext.485c0d0e','Hoàn Tất & Bảo Hành'):'Hoàn Tất & Bảo Hành')
        };
        return map[s] || (window.cnxT?window.cnxT('js.m_sa_ext.30f0d774','Đang xử lý'):'Đang xử lý');
    },

    async activateTrial7d() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.17b3b2c6','Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.'):'Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.'))) return;
        const res = await fetch('api/super_admin.php?action=activate_trial_7d', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async confirmTenantPayment() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.4d39e8af','Xác nhận đã thu đủ phí bản quyền cho quán này?'):'Xác nhận đã thu đủ phí bản quyền cho quán này?'))) return;
        const res = await fetch('api/super_admin.php?action=confirm_payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async grantWorkflowOverride() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.39573ee8','Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?'):'Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?'))) return;
        const res = await fetch('api/super_admin.php?action=grant_workflow_override', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async testGeminiKey(id, btn) {
        const orig = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
        try {
            const res = await fetch('api/super_admin.php?action=test_gemini_key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key_id: id })
            }).then(r => r.json());
            await this.loadMasterAiVault();
            alert(res.message || (res.success ? 'Key hoạt động tốt!' : (window.cnxT?window.cnxT('js.m_sa_ext.97acaef7','Key gặp lỗi!'):'Key gặp lỗi!')));
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.5b983751','Lỗi: '):'Lỗi: ') + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = orig; }
        }
    },

    async activateGeminiKey(id) {
        try {
            const res = await fetch('api/super_admin.php?action=activate_gemini_key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key_id: id })
            }).then(r => r.json());
            if (res.success) await this.loadMasterAiVault();
            else alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.1bf64cfc','Không thể kích hoạt Key!'):'Không thể kích hoạt Key!'));
        } catch (e) { alert((window.cnxT?window.cnxT('js.m_sa.5b983751','Lỗi: '):'Lỗi: ') + e.message); }
    },

    async toggleGeminiKey(id) {
        try {
            const res = await fetch('api/super_admin.php?action=toggle_gemini_key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key_id: id })
            }).then(r => r.json());
            if (res.success) await this.loadMasterAiVault();
            else alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.a4ab70cd','Không thể đổi trạng thái Key!'):'Không thể đổi trạng thái Key!'));
        } catch (e) { alert((window.cnxT?window.cnxT('js.m_sa.5b983751','Lỗi: '):'Lỗi: ') + e.message); }
    },

    filterMasterAiStores() {
        const listEl = document.getElementById('master-ai-usage-list');
        if (!listEl) return;
        const rows = Array.isArray(this._aiStoreRows) ? this._aiStoreRows : [];
        const query = (document.getElementById('master-ai-store-search')?.value || '').trim().toLowerCase();
        const mode = document.getElementById('master-ai-store-filter')?.value || 'all';

        const filtered = rows.filter(r => {
            const name = String(r.store_name || '').toLowerCase();
            const code = String(r.tenant_code || '').toLowerCase();
            if (query && !name.includes(query) && !code.includes(query)) return false;

            const mq = Number(r.ai_monthly_quota ?? 50);
            const bonus = Number(r.ai_bonus_credits ?? 0);
            const mUsed = Number(r.monthly_used ?? 0);
            const calls = Number(r.calls_month ?? r.calls ?? 0);
            const isUnlim = mq < 0;
            const remTotal = isUnlim ? Infinity : (Math.max(0, mq - mUsed) + bonus);

            if (mode === 'used') return calls > 0 || mUsed > 0;
            if (mode === 'low') return !isUnlim && (remTotal <= 5 || (mq > 0 && (mUsed / mq) >= 0.8));
            if (mode === 'unlimited') return isUnlim;
            return true;
        });

        const countEl = document.getElementById('master-ai-visible-count');
        if (countEl) {
            countEl.textContent = filtered.length === rows.length
                ? `${rows.length} ${window.cnxT?window.cnxT('js.m_sa_ext.2b3ba6d2','quán'):'quán'}`
                : `${filtered.length}/${rows.length} ${window.cnxT?window.cnxT('js.m_sa_ext.2b3ba6d2','quán'):'quán'}`;
        }

        if (filtered.length === 0) {
            listEl.innerHTML = `<div class="p-4 text-center italic text-slate-500">${rows.length === 0 ? 'Chưa có quán nào trên hệ thống.' : (window.cnxT?window.cnxT('js.m_sa.0a523330','Không tìm thấy quán phù hợp bộ lọc.'):'Không tìm thấy quán phù hợp bộ lọc.')}</div>`;
            return;
        }

        listEl.innerHTML = filtered.map(r => {
            const mq = Number(r.ai_monthly_quota ?? 50);
            const bonus = Number(r.ai_bonus_credits ?? 0);
            const mUsed = Number(r.monthly_used ?? 0);
            const totCr = Number(r.total_credits_month ?? 0);
            const calls = Number(r.calls_month ?? r.calls ?? 0);
            const isUnlim = mq < 0;
            const isBlocked = mq === 0 && bonus === 0;
            const remMonthly = isUnlim ? Infinity : Math.max(0, mq - mUsed);
            const remTotal = isUnlim ? Infinity : (remMonthly + bonus);
            const pct = isUnlim ? 18 : (mq > 0 ? Math.min(100, Math.round((mUsed / mq) * 100)) : 100);
            const barColor = isUnlim ? 'bg-purple-400' : (remTotal <= 0 ? 'bg-rose-500' : (pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'));
            const badgeHtml = isUnlim
                ? '<span class="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[10px] font-semibold whitespace-nowrap">∞ Không giới hạn</span>'
                : (isBlocked
                    ? '<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-semibold whitespace-nowrap">Đã tắt AI</span>'
                    : `<span class="px-1.5 py-0.5 rounded ${remTotal <= 0 ? 'bg-rose-500/20 text-rose-300 border-rose-400/30' : (pct >= 80 ? 'bg-amber-500/20 text-amber-300 border-amber-400/30' : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25')} border text-[10px] font-semibold whitespace-nowrap">Còn ${remTotal} cr</span>`);
            const quotaLabel = isUnlim ? `${totCr} cr (∞)` : `${mUsed}/${mq}${bonus > 0 ? `+${bonus}` : ''} cr`;
            const tid = Number(r.tenant_id || 0);
            const usageSummary = calls > 0
                ? `${calls} ${window.cnxT?window.cnxT('js.m_sa_ext.c83a16c4','lượt (OCR'):'lượt (OCR'} ${r.ocr_calls || 0} ${window.cnxT?window.cnxT('js.m_sa_ext.45968a97','• Món'):'• Món'} ${r.dish_calls || 0} • Slide ${r.slide_calls || 0})`
                : (window.cnxT?window.cnxT('js.m_sa_ext.426fbd56','Chưa dùng tháng này'):'Chưa dùng tháng này');
            const storeName = this._escHtml(r.store_name || r.tenant_code || '');
            const tenantCode = this._escHtml(r.tenant_code || '');
            return `
            <div class="px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0 flex-1">
                        <span class="text-slate-100 font-semibold truncate">${storeName}</span>
                        <span class="text-[10px] font-mono text-slate-400 shrink-0">${tenantCode}</span>
                        ${badgeHtml}
                    </div>
                    <div class="flex items-center gap-2.5 shrink-0">
                        <div class="hidden sm:flex flex-col items-end w-24" title="${this._escHtml(usageSummary)}">
                            <span class="font-mono text-[10px] text-sky-300 leading-none mb-1">${quotaLabel}</span>
                            <div class="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div class="h-full ${barColor} transition-all" style="width:${pct}%"></div>
                            </div>
                        </div>
                        <span class="sm:hidden font-mono text-[10px] text-sky-300">${quotaLabel}</span>
                        ${tid > 0 ? `<button type="button" onclick="SuperAdmin.toggleStoreQuotaRow(${tid})" class="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 border border-purple-400/30 text-[10px] font-semibold whitespace-nowrap"><i class="fas fa-sliders mr-1"></i>Quota</button>` : ''}
                    </div>
                </div>
                <div class="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span>${this._escHtml(usageSummary)}</span>
                    <span>${r.last_used_at ? (window.cnxT?window.cnxT('js.m_sa.73011a35','Gần nhất: '):'Gần nhất: ') + this._escHtml(r.last_used_at) : ''}</span>
                </div>
                ${tid > 0 ? `
                <div id="quota-editor-${tid}" class="hidden pt-2 mt-2 border-t border-white/10 flex flex-wrap items-end gap-2 bg-slate-900/50 p-2 rounded-xl">
                    <div>
                        <label class="block text-[10px] text-slate-400 mb-0.5">${window.cnxT?window.cnxT('js.m_sa.166afe90','Quota tháng (-1 = ∞, 0 = Tắt)'):'Quota tháng (-1 = ∞, 0 = Tắt)'}</label>
                        <input type="number" id="inp-mq-${tid}" value="${mq}" min="-1" class="liquid-input w-28 py-1 px-2 text-xs font-mono text-white" />
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 mb-0.5">${window.cnxT?window.cnxT('js.m_sa.06f27259','Credit nạp thêm (Bonus)'):'Credit nạp thêm (Bonus)'}</label>
                        <input type="number" id="inp-bc-${tid}" value="${bonus}" min="0" class="liquid-input w-28 py-1 px-2 text-xs font-mono text-emerald-300" />
                    </div>
                    <button type="button" onclick="SuperAdmin.saveStoreAiQuota(${tid}, this)" class="px-2.5 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[11px] font-bold">${window.cnxT?window.cnxT('ui.admin_html.button_737d070e','Lưu'):'Lưu'}</button>
                    <button type="button" onclick="SuperAdmin.quickPresetQuota(${tid}, -1)" class="px-2 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 text-[10px]">${window.cnxT?window.cnxT('js.m_sa.b62edb02','∞ Không giới hạn'):'∞ Không giới hạn'}</button>
                    <button type="button" onclick="SuperAdmin.quickAddBonus(${tid}, 50)" class="px-2 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 text-[10px]">+50 Bonus</button>
                    <button type="button" onclick="SuperAdmin.quickPresetQuota(${tid}, 0)" class="px-2 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 text-[10px]">${window.cnxT?window.cnxT('js.m_sa.922e680e','Tắt (0)'):'Tắt (0)'}</button>
                </div>` : ''}
            </div>`;
        }).join('');
    },

    toggleStoreQuotaRow(tid) {
        const el = document.getElementById(`quota-editor-${tid}`);
        if (el) el.classList.toggle('hidden');
    },

    quickPresetQuota(tid, val) {
        const inp = document.getElementById(`inp-mq-${tid}`);
        if (inp) inp.value = String(val);
        this.saveStoreAiQuota(tid);
    },

    quickAddBonus(tid, delta) {
        const inp = document.getElementById(`inp-bc-${tid}`);
        if (inp) inp.value = String(Math.max(0, Number(inp.value || 0) + delta));
        this.saveStoreAiQuota(tid);
    },

    async saveStoreAiQuota(tid, btn) {
        const mq = Number(document.getElementById(`inp-mq-${tid}`)?.value ?? 50);
        const bc = Math.max(0, Number(document.getElementById(`inp-bc-${tid}`)?.value ?? 0));
        if (btn) btn.disabled = true;
        try {
            const res = await fetch('api/super_admin.php?action=update_store_ai_quota', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tid, ai_monthly_quota: mq, ai_bonus_credits: bc })
            }).then(r => r.json());
            if (res.success) {
                await this.loadMasterAiVault();
            } else {
                alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.4a88bfc9','Không thể cập nhật quota!'):'Không thể cập nhật quota!'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.e5f87ad3','Lỗi kết nối: '):'Lỗi kết nối: ') + e.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    },


    getWorkflowLabel(t) {
        const s = t.workflow_stage || 'pending_contract';
        if (t.subscription_status === 'trial' || s === 'trial') return (window.cnxT?window.cnxT('js.m_sa_ext.2e4eae5e','Trial 07 ngày'):'Trial 07 ngày');
        const map = {
            'pending_contract': (window.cnxT?window.cnxT('js.m_sa_ext.16daaf5b','Sales: Chờ Hợp Đồng'):'Sales: Chờ Hợp Đồng'),
            'pending_payment': (window.cnxT?window.cnxT('js.m_sa_ext.299d92a2','Kế toán: Chờ Tiền/VAT'):'Kế toán: Chờ Tiền/VAT'),
            'ready_to_install': (window.cnxT?window.cnxT('js.m_sa_ext.b9162597','Kỹ thuật: Chờ Đóng Gói'):'Kỹ thuật: Chờ Đóng Gói'),
            'pending_handover': (window.cnxT?window.cnxT('js.m_sa_ext.0cae1380','Kỹ thuật: Chờ Nghiệm Thu'):'Kỹ thuật: Chờ Nghiệm Thu'),
            'active': (window.cnxT?window.cnxT('js.m_sa_ext.485c0d0e','Hoàn Tất & Bảo Hành'):'Hoàn Tất & Bảo Hành')
        };
        return map[s] || (window.cnxT?window.cnxT('js.m_sa_ext.30f0d774','Đang xử lý'):'Đang xử lý');
    },

    async activateTrial7d() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.17b3b2c6','Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.'):'Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.'))) return;
        const res = await fetch('api/super_admin.php?action=activate_trial_7d', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async confirmTenantPayment() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.4d39e8af','Xác nhận đã thu đủ phí bản quyền cho quán này?'):'Xác nhận đã thu đủ phí bản quyền cho quán này?'))) return;
        const res = await fetch('api/super_admin.php?action=confirm_payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async grantWorkflowOverride() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.39573ee8','Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?'):'Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?'))) return;
        const res = await fetch('api/super_admin.php?action=grant_workflow_override', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async verifyAndSaveMasterGeminiKey(btn) {
        const inp = document.getElementById('cfg-master-gemini-key');
        const keyVal = inp ? inp.value.trim() : '';
        if (!keyVal) {
            alert((window.cnxT?window.cnxT('js.m_sa_ext.6d23c4a6','Vui lòng dán mã Gemini API Key trước khi kiểm tra!'):'Vui lòng dán mã Gemini API Key trước khi kiểm tra!'));
            return;
        }
        const payload = {
            provider: document.getElementById('cfg-master-gemini-provider')?.value || 'gemini',
            gemini_api_key: keyVal,
            label: document.getElementById('cfg-master-gemini-label')?.value.trim() || 'AI Key',
            tier: document.getElementById('cfg-master-gemini-tier')?.value || 'payg',
            monthly_credit_limit: Number(document.getElementById('cfg-master-gemini-mcl')?.value || 0),
            daily_request_limit: Number(document.getElementById('cfg-master-gemini-drl')?.value || 0),
            expires_at: document.getElementById('cfg-master-gemini-exp')?.value || '',
            priority: Number(document.getElementById('cfg-master-gemini-pri')?.value || 10),
            set_active: Boolean(document.getElementById('cfg-master-gemini-active')?.checked ?? true)
        };
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = (window.cnxT?window.cnxT('js.m_sa_ext.4ea607b8','<i class="fas fa-spinner fa-spin mr-1"></i> Đang kiểm tra...'):'<i class="fas fa-spinner fa-spin mr-1"></i> Đang kiểm tra...'); }
        try {
            const res = await fetch('api/super_admin.php?action=verify_save_gemini_key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json());
            if (res.success) {
                if (inp) inp.value = '';
                const lblInp = document.getElementById('cfg-master-gemini-label');
                if (lblInp) lblInp.value = '';
                this.toggleAddGeminiKeyModal(false);
                await this.loadMasterAiVault();
                alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.9fa869e3','Xác thực & khóa Key thành công!'):'Xác thực & khóa Key thành công!'));
            } else {
                alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.55b29499','Key không hợp lệ!'):'Key không hợp lệ!'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.e5f87ad3','Lỗi kết nối: '):'Lỗi kết nối: ') + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
        }
    },

    async deleteMasterGeminiKey(keyId) {
        if (!confirm((window.cnxT?window.cnxT('js.m_sa_ext.c09c6e59','Xóa Gemini API Key này khỏi Master Vault? Nếu đây là Key chính, hệ thống sẽ tự chuyển sang Key dự phòng (nếu có).'):'Xóa Gemini API Key này khỏi Master Vault? Nếu đây là Key chính, hệ thống sẽ tự chuyển sang Key dự phòng (nếu có).'))) return;
        try {
            const res = await fetch('api/super_admin.php?action=delete_gemini_key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key_id: Number(keyId || 0) })
            }).then(r => r.json());
            if (res.success) await this.loadMasterAiVault();
            else alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.876eee0c','Không thể xóa Key'):'Không thể xóa Key'));
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.5b983751','Lỗi: '):'Lỗi: ') + e.message);
        }
    },

    async loadOtaPatchArchive() {
        const listEl = document.getElementById('ota-patch-archive-list');
        const activeEl = document.getElementById('ota-active-release-card');
        const badgeEl = document.getElementById('ota-active-version-badge');
        if (!listEl) return;
        try {
            const res = await fetch('api/super_admin.php?action=list_patches').then(r => r.json());
            if (!res || !res.success) return;
            if (badgeEl) {
                badgeEl.textContent = res.active_version ? `${window.cnxT?window.cnxT('js.m_sa_ext.36e79517','Đang phát hành: v'):'Đang phát hành: v'}${res.active_version}` : (window.cnxT?window.cnxT('js.m_sa_ext.d7f552f9','Chưa có bản vá phát hành'):'Chưa có bản vá phát hành');
            }
            const patches = Array.isArray(res.patches) ? res.patches : [];
            this._otaPatches = patches;

            if (activeEl) {
                const activePatch = patches.find(p => Boolean(p.is_active));
                if (activePatch) {
                    const mb = (Number(activePatch.size_bytes || 0) / (1024 * 1024)).toFixed(2);
                    const ver = this._escHtml(activePatch.version);
                    activeEl.innerHTML = `
                        <div class="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-1.5">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 text-[10px] font-bold tracking-wide">${window.cnxT?window.cnxT('js.m_sa_ext.2dddc610','ĐANG PHÁT HÀNH'):'ĐANG PHÁT HÀNH'}</span>
                                    <span class="font-mono font-black text-sky-300 text-xs">v${ver}</span>
                                    <span class="text-[10px] font-mono text-slate-400">${mb} MB • ${activePatch.files_count || 0} files</span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <button type="button" onclick="SuperAdmin.pushArchivedPatch('${ver}')" class="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 border border-sky-400/30 text-[10px] font-bold"><i class="fas fa-paper-plane mr-1"></i>${window.cnxT?window.cnxT('js.m_sa_ext.8bc65dac','Đẩy xuống quán'):'Đẩy xuống quán'}</button>
                                    <a href="/api/updates/download?version=${encodeURIComponent(activePatch.version || '')}" class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 text-[10px]" title="Tải gói OTA"><i class="fas fa-download"></i></a>
                                </div>
                            </div>
                            <div class="text-xs font-semibold text-white">${this._escHtml(activePatch.title || (window.cnxT?window.cnxT('js.m_sa.2cdf85dd','Bản phát hành hiện tại'):'Bản phát hành hiện tại'))}</div>
                            ${activePatch.notes ? `<div class="text-[11px] text-slate-300/90 leading-snug">${this._escHtml(activePatch.notes)}</div>` : ''}
                            <div class="text-[10px] text-slate-400 font-mono">Tạo lúc: ${this._escHtml(activePatch.created_at || '--')}</div>
                        </div>
                    `;
                } else {
                    activeEl.innerHTML = '';
                }
            }

            this.filterOtaPatches();
        } catch (e) {}
    },

    filterOtaPatches() {
        const listEl = document.getElementById('ota-patch-archive-list');
        if (!listEl) return;
        const patches = Array.isArray(this._otaPatches) ? this._otaPatches : [];
        const archived = patches.filter(p => !p.is_active);
        const query = (document.getElementById('ota-patch-search')?.value || '').trim().toLowerCase();

        const filtered = archived.filter(p => {
            if (!query) return true;
            const hay = `${p.version || ''} ${p.title || ''} ${p.notes || ''}`.toLowerCase();
            return hay.includes(query);
        });

        const countEl = document.getElementById('ota-archive-count');
        if (countEl) {
            countEl.textContent = filtered.length === archived.length
                ? `${archived.length} ${window.cnxT?window.cnxT('js.m_sa_ext.d3024d6b','bản'):'bản'}`
                : `${filtered.length}/${archived.length} ${window.cnxT?window.cnxT('js.m_sa_ext.d3024d6b','bản'):'bản'}`;
        }

        if (filtered.length === 0) {
            listEl.innerHTML = `<div class="p-4 text-center italic text-slate-500">${archived.length === 0 ? 'Chưa có bản vá lưu trữ nào khác.' : (window.cnxT?window.cnxT('js.m_sa.4542f182','Không tìm thấy bản vá phù hợp.'):'Không tìm thấy bản vá phù hợp.')}</div>`;
            return;
        }

        listEl.innerHTML = filtered.map((p, idx) => {
            const mb = (Number(p.size_bytes || 0) / (1024 * 1024)).toFixed(2);
            const ver = this._escHtml(p.version);
            const safeId = `ota-detail-${idx}-${String(p.version || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            return `
                <div class="hover:bg-white/[0.03] transition-colors">
                    <div onclick="SuperAdmin.toggleOtaPatchDetail('${safeId}')" class="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none">
                        <div class="flex items-center gap-2 min-w-0 flex-1">
                            <i id="${safeId}-icon" class="fas fa-chevron-right text-[10px] text-slate-500 transition-transform w-3 text-center shrink-0"></i>
                            <span class="font-mono font-bold text-sky-300 text-[11px] shrink-0">v${ver}</span>
                            <span class="text-[11px] text-slate-200 truncate" title="${this._escHtml(p.title || '')}">${this._escHtml(p.title || (window.cnxT?window.cnxT('js.m_sa.ac9b225a','Bản vá OTA'):'Bản vá OTA'))}</span>
                            <span class="hidden sm:inline text-[10px] font-mono text-slate-500 shrink-0">• ${mb} MB</span>
                        </div>
                        <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
                            <button type="button" onclick="SuperAdmin.activateOtaPatch('${ver}')" class="px-2 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-bold whitespace-nowrap" title="Kích hoạt / Rollback về bản này"><i class="fas fa-check mr-1"></i>Rollback</button>
                            <button type="button" onclick="SuperAdmin.pushArchivedPatch('${ver}')" class="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 border border-sky-400/30 text-[10px] font-bold" title="Đẩy xuống quán"><i class="fas fa-paper-plane"></i></button>
                            <a href="/api/updates/download?version=${encodeURIComponent(p.version || '')}" class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 text-[10px]" title="Tải gói OTA"><i class="fas fa-download"></i></a>
                            <button type="button" onclick="SuperAdmin.deleteOtaPatch('${ver}')" class="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[10px]" title="Xóa bản vá"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div id="${safeId}" class="hidden px-3 pb-2.5 pt-1 pl-8 text-[11px] text-slate-400 space-y-1 bg-slate-900/40 border-t border-white/5">
                        ${p.notes ? `<div class="text-slate-300 leading-snug">${this._escHtml(p.notes)}</div>` : ''}
                        <div class="text-[10px] font-mono text-slate-500">${mb} MB • ${p.files_count || 0} ${window.cnxT?window.cnxT('js.m_sa_ext.b7c28b2a','files • Tạo lúc:'):'files • Tạo lúc:'} ${this._escHtml(p.created_at || '--')}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    toggleOtaPatchDetail(id) {
        const el = document.getElementById(id);
        const icon = document.getElementById(`${id}-icon`);
        if (!el) return;
        const isHidden = el.classList.toggle('hidden');
        if (icon) {
            icon.classList.toggle('fa-chevron-right', isHidden);
            icon.classList.toggle('fa-chevron-down', !isHidden);
        }
    },

    async activateOtaPatch(version) {
        if (!confirm(`${window.cnxT?window.cnxT('js.m_sa_ext.3c770fd7','Kích hoạt bản vá v'):'Kích hoạt bản vá v'}${version} ${window.cnxT?window.cnxT('js.m_sa_ext.25eea0a6','làm bản OTA phát hành hiện tại?'):'làm bản OTA phát hành hiện tại?'}`)) return;
        try {
            const res = await fetch('api/super_admin.php?action=activate_patch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version })
            }).then(r => r.json());
            if (res.success) {
                await this.loadOtaPatchArchive();
                alert(res.message || `${window.cnxT?window.cnxT('js.m_sa_ext.8939d153','Đã kích hoạt v'):'Đã kích hoạt v'}${version}!`);
            } else {
                alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.30728507','Không thể kích hoạt bản vá'):'Không thể kích hoạt bản vá'));
            }
        } catch (e) { alert((window.cnxT?window.cnxT('js.m_sa.5b983751','Lỗi: '):'Lỗi: ') + e.message); }
    },

    async deleteOtaPatch(version) {
        if (!confirm(`${window.cnxT?window.cnxT('js.m_sa_ext.b6c764fd','Xóa vĩnh viễn bản vá v'):'Xóa vĩnh viễn bản vá v'}${version} ${window.cnxT?window.cnxT('js.m_sa_ext.c660eece','khỏi kho lưu trữ?'):'khỏi kho lưu trữ?'}`)) return;
        try {
            const res = await fetch('api/super_admin.php?action=delete_patch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version })
            }).then(r => r.json());
            if (res.success) await this.loadOtaPatchArchive();
            else alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.bd6b4a9b','Không thể xóa bản vá'):'Không thể xóa bản vá'));
        } catch (e) { alert((window.cnxT?window.cnxT('js.m_sa.5b983751','Lỗi: '):'Lỗi: ') + e.message); }
    },

    async pushArchivedPatch(version) {
        this.openPushUpdateModal('ALL', version);
    },

    // --- LEGAL TEMPLATES MANAGER (SOP-09) ---
    async loadLegalTemplates() {
        try {
            if (!this.tenants || this.tenants.length === 0) {
                const tRes = await fetch('api/super_admin.php?action=get_tenants').then(r => r.json());
                if (tRes.success) this.tenants = tRes.tenants || [];
            }
            const sel = document.getElementById('tpl-preview-tenant');
            if (sel) {
                const prev = sel.value;
                sel.innerHTML = (window.cnxT?window.cnxT('js.m_sa_ext.4d301764','<option value="0">Xem thử theo dữ liệu mẫu</option>'):'<option value="0">Xem thử theo dữ liệu mẫu</option>') +
                    (this.tenants || []).map(t => `<option value="${t.id}">${t.tenant_code} — ${t.store_name}</option>`).join('');
                if (prev && prev !== '0' && (this.tenants || []).some(t => String(t.id) === prev)) {
                    sel.value = prev;
                } else if (this.tenants && this.tenants.length > 0) {
                    sel.value = String(this.tenants[this.tenants.length - 1].id);
                }
            }
            const res = await fetch('api/super_admin.php?action=get_legal_templates').then(r => r.json());
            if (!res.success) return;
            this.legalTemplates = res.templates || [];
            this.moduleNameMap = res.module_names || {};
            const bar = document.getElementById('tpl-selector-bar');
            if (bar) {
                bar.innerHTML = this.legalTemplates.map((tpl, idx) => `
                    <button type="button" onclick="SuperAdmin.selectLegalTemplate('${tpl.file}')"
                        data-tpl-file="${tpl.file}"
                        class="tpl-pill-btn px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${idx === 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900/70 text-slate-300 border-white/10 hover:border-amber-500/30'}">
                        <i class="fas fa-file-lines"></i>
                        <span>${tpl.title}</span>
                    </button>
                `).join('');
            }
            if (this.legalTemplates.length > 0) {
                const target = (this.activeLegalTemplateFile && this.legalTemplates.some(x => x.file === this.activeLegalTemplateFile))
                    ? this.activeLegalTemplateFile
                    : this.legalTemplates[0].file;
                this.selectLegalTemplate(target);
            }
        } catch (e) {
            console.error('loadLegalTemplates error:', e);
        }
    },

    selectLegalTemplate(file) {
        const tpl = (this.legalTemplates || []).find(t => t.file === file);
        if (!tpl) return;
        this.activeLegalTemplateFile = file;
        this.legalTemplateMode = this.legalTemplateMode || 'edit';
        document.querySelectorAll('.tpl-pill-btn').forEach(b => {
            const active = b.dataset.tplFile === file;
            b.className = `tpl-pill-btn px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${active ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900/70 text-slate-300 border-white/10 hover:border-amber-500/30'}`;
        });
        const desc = document.getElementById('tpl-active-desc');
        if (desc) desc.textContent = tpl.desc || '';
        this.renderLegalTemplateFrame();
    },

    setLegalTemplateMode(mode) {
        if (this.legalTemplateMode === 'edit') this.syncLegalTemplateFromFrame();
        this.legalTemplateMode = mode;
        const bEdit = document.getElementById('btn-tpl-mode-edit');
        const bPrev = document.getElementById('btn-tpl-mode-preview');
        const toolbar = document.getElementById('tpl-editor-toolbar');
        if (bEdit && bPrev) {
            bEdit.className = mode === 'edit' ? 'px-3 py-1 rounded-lg font-bold bg-purple-600/40 text-white' : 'px-3 py-1 rounded-lg font-bold text-slate-300 hover:text-white';
            bPrev.className = mode === 'preview' ? 'px-3 py-1 rounded-lg font-bold bg-emerald-600/40 text-white' : 'px-3 py-1 rounded-lg font-bold text-slate-300 hover:text-white';
        }
        if (toolbar) toolbar.style.display = mode === 'edit' ? 'flex' : 'none';
        this.renderLegalTemplateFrame();
    },

    onTemplateTenantChange() {
        if (this.legalTemplateMode === 'edit') {
            this.setLegalTemplateMode('preview');
        } else {
            this.renderLegalTemplateFrame();
        }
    },

    syncLegalTemplateFromFrame() {
        const tpl = (this.legalTemplates || []).find(t => t.file === this.activeLegalTemplateFile);
        const frame = document.getElementById('tpl-a4-frame');
        if (!tpl || !frame || !frame.contentDocument || !frame.contentDocument.body) return;
        const bodyHtml = frame.contentDocument.body.innerHTML;
        if (/<body[^>]*>[\s\S]*<\/body>/i.test(tpl.content)) {
            tpl.content = tpl.content.replace(/(<body[^>]*>)[\s\S]*(<\/body>)/i, `$1\n${bodyHtml}\n$2`);
        } else {
            tpl.content = bodyHtml;
        }
    },

    renderLegalTemplateFrame() {
        const tpl = (this.legalTemplates || []).find(t => t.file === this.activeLegalTemplateFile);
        const frame = document.getElementById('tpl-a4-frame');
        if (!tpl || !frame) return;
        let html = tpl.content || '';
        const mode = this.legalTemplateMode || 'edit';
        if (mode === 'preview') {
            const tid = parseInt(document.getElementById('tpl-preview-tenant')?.value || '0', 10);
            const t = (this.tenants || []).find(x => x.id === tid);
            const plan = t ? (this.plans || []).find(p => p.id === t.plan_id) : null;
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = String(now.getFullYear());
            const formatModNames = (raw) => {
                try {
                    const arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : []);
                    if (!Array.isArray(arr) || arr.length === 0) return (window.cnxT?window.cnxT('js.m_sa_ext.9f378dc4','POS Bán Hàng & In Nhiệt'):'POS Bán Hàng & In Nhiệt');
                    return arr.map(c => (this.moduleNameMap && this.moduleNameMap[c]) ? this.moduleNameMap[c] : c).join(', ');
                } catch (_) {
                    return raw || (window.cnxT?window.cnxT('js.m_sa_ext.9f378dc4','POS Bán Hàng & In Nhiệt'):'POS Bán Hàng & In Nhiệt');
                }
            };
            const fmtVnDate = (iso) => {
                if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso)) {
                    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
                }
                return iso || `${dd}/${mm}/${yyyy}`;
            };
            const pYear = plan?.price_year || 0;
            const map = t ? {
                '{{TENANT_CODE}}': t.tenant_code || '',
                '{{STORE_NAME}}': t.store_name || '',
                '{{OWNER_NAME}}': t.owner_name || (window.cnxT?window.cnxT('js.m_sa_ext.b02253a2','(Chưa cập nhật)'):'(Chưa cập nhật)'),
                '{{REPRESENTATIVE_ROLE}}': t.representative_role || (window.cnxT?window.cnxT('js.m_sa.524269de','Chủ hộ kinh doanh'):'Chủ hộ kinh doanh'),
                '{{LEGAL_ENTITY_NAME}}': t.legal_entity_name || t.store_name || '',
                '{{TAX_ID_OR_CCCD}}': t.tax_id_or_cccd || (window.cnxT?window.cnxT('js.m_sa_ext.f7cce0c1','(Chưa cập nhật MST/CCCD)'):'(Chưa cập nhật MST/CCCD)'),
                '{{PHONE}}': t.phone || (window.cnxT?window.cnxT('js.m_sa_ext.b02253a2','(Chưa cập nhật)'):'(Chưa cập nhật)'),
                '{{EMAIL}}': t.email || (window.cnxT?window.cnxT('js.m_sa_ext.b02253a2','(Chưa cập nhật)'):'(Chưa cập nhật)'),
                '{{STORE_ADDRESS}}': t.address || (window.cnxT?window.cnxT('js.m_sa_ext.e5099f07','(Chưa cập nhật địa chỉ)'):'(Chưa cập nhật địa chỉ)'),
                '{{BILLING_ADDRESS}}': t.billing_address || t.address || (window.cnxT?window.cnxT('js.m_sa_ext.e5099f07','(Chưa cập nhật địa chỉ)'):'(Chưa cập nhật địa chỉ)'),
                '{{PLAN_NAME}}': t.plan_name || (window.cnxT?window.cnxT('js.m_sa_ext.49738ae9','Gói Tiêu Chuẩn'):'Gói Tiêu Chuẩn'),
                '{{PLAN_PRICE_VND}}': pYear > 0 ? (pYear.toLocaleString('vi-VN') + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ')) : (window.cnxT?window.cnxT('js.m_sa_ext.b9e7c95f','Miễn phí (Gói Trải Nghiệm)'):'Miễn phí (Gói Trải Nghiệm)'),
                '{{START_DATE}}': fmtVnDate(t.start_date),
                '{{EXPIRE_DATE}}': fmtVnDate(t.expire_date),
                '{{LICENSE_KEY}}': t.license_key || '',
                '{{ENABLED_MODULES}}': formatModNames(t.enabled_modules),
                '{{CREATED_DATE}}': `${dd}/${mm}/${yyyy}`,
                '{{DATE_COMPACT}}': `${yyyy}${mm}${dd}`
            } : {
                '{{TENANT_CODE}}': 'SDL001',
                '{{STORE_NAME}}': (window.cnxT?window.cnxT('js.m_sa_ext.20fefb6a','Si Đô La Coffee & Tea'):'Si Đô La Coffee & Tea'),
                '{{OWNER_NAME}}': (window.cnxT?window.cnxT('js.m_sa_ext.18eb155d','Trần Văn Đô'):'Trần Văn Đô'),
                '{{REPRESENTATIVE_ROLE}}': (window.cnxT?window.cnxT('js.m_sa.524269de','Chủ hộ kinh doanh'):'Chủ hộ kinh doanh'),
                '{{LEGAL_ENTITY_NAME}}': (window.cnxT?window.cnxT('js.m_sa_ext.42cb9af4','Hộ Kinh Doanh Si Đô La'):'Hộ Kinh Doanh Si Đô La'),
                '{{TAX_ID_OR_CCCD}}': '079092001234',
                '{{PHONE}}': '0989123456',
                '{{EMAIL}}': 'sidola@gmail.com',
                '{{STORE_ADDRESS}}': (window.cnxT?window.cnxT('js.m_sa_ext.c7f60d1d','123 Nguyễn Huệ, Q.1, TP.HCM'):'123 Nguyễn Huệ, Q.1, TP.HCM'),
                '{{BILLING_ADDRESS}}': (window.cnxT?window.cnxT('js.m_sa_ext.c7f60d1d','123 Nguyễn Huệ, Q.1, TP.HCM'):'123 Nguyễn Huệ, Q.1, TP.HCM'),
                '{{PLAN_NAME}}': (window.cnxT?window.cnxT('js.m_sa_ext.fc401c67','Gói Chuỗi Đỉnh Cao (Enterprise)'):'Gói Chuỗi Đỉnh Cao (Enterprise)'),
                '{{PLAN_PRICE_VND}}': (window.cnxT?window.cnxT('js.m_sa_ext.96a88294','6.000.000 đ'):'6.000.000 đ'),
                '{{START_DATE}}': `${yyyy}-${mm}-${dd}`,
                '{{EXPIRE_DATE}}': `${Number(yyyy) + 1}-${mm}-${dd}`,
                '{{LICENSE_KEY}}': 'LIC-ABCD-1234-EFGH-5678',
                '{{ENABLED_MODULES}}': (window.cnxT?window.cnxT('js.m_sa_ext.aa67be12','POS Bán Hàng & In Nhiệt, Thanh Toán VietQR Tự Động, Truyền Thông & Quảng Cáo (Slide/Video)'):'POS Bán Hàng & In Nhiệt, Thanh Toán VietQR Tự Động, Truyền Thông & Quảng Cáo (Slide/Video)'),
                '{{CREATED_DATE}}': `${dd}/${mm}/${yyyy}`,
                '{{DATE_COMPACT}}': `${yyyy}${mm}${dd}`
            };
            Object.entries(map).forEach(([k, v]) => {
                html = html.split(k).join(v);
            });
        }
        frame.onload = () => {
            if (frame.contentDocument && frame.contentDocument.body) {
                frame.contentDocument.body.contentEditable = (mode === 'edit') ? 'true' : 'false';
                frame.contentDocument.body.style.outline = 'none';
            }
        };
        frame.srcdoc = html;
    },

    execTplCmd(cmd) {
        const frame = document.getElementById('tpl-a4-frame');
        if (!frame || !frame.contentDocument) return;
        frame.contentWindow.focus();
        frame.contentDocument.execCommand(cmd, false, null);
    },

    insertTemplatePlaceholder(token) {
        if (this.legalTemplateMode !== 'edit') this.setLegalTemplateMode('edit');
        const frame = document.getElementById('tpl-a4-frame');
        if (!frame || !frame.contentDocument) return;
        frame.contentWindow.focus();
        frame.contentDocument.execCommand('insertText', false, token);
    },

    async saveLegalTemplate() {
        if (this.legalTemplateMode === 'edit') this.syncLegalTemplateFromFrame();
        const file = this.activeLegalTemplateFile;
        const tpl = (this.legalTemplates || []).find(t => t.file === file);
        if (!file || !tpl) return;
        const btn = document.getElementById('btn-save-legal-tpl');
        if (btn) btn.disabled = true;
        try {
            const res = await fetch('api/super_admin.php?action=save_legal_template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file, content: tpl.content })
            }).then(r => r.json());
            alert(res.message || (res.success ? 'Đã lưu biểu mẫu!' : (window.cnxT?window.cnxT('js.m_sa_ext.6aa432ff','Không thể lưu biểu mẫu!'):'Không thể lưu biểu mẫu!')));
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.e5f87ad3','Lỗi kết nối: '):'Lỗi kết nối: ') + e.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    },


    getWorkflowLabel(t) {
        const s = t.workflow_stage || 'pending_contract';
        if (t.subscription_status === 'trial' || s === 'trial') return (window.cnxT?window.cnxT('js.m_sa_ext.2e4eae5e','Trial 07 ngày'):'Trial 07 ngày');
        const map = {
            'pending_contract': (window.cnxT?window.cnxT('js.m_sa_ext.16daaf5b','Sales: Chờ Hợp Đồng'):'Sales: Chờ Hợp Đồng'),
            'pending_payment': (window.cnxT?window.cnxT('js.m_sa_ext.299d92a2','Kế toán: Chờ Tiền/VAT'):'Kế toán: Chờ Tiền/VAT'),
            'ready_to_install': (window.cnxT?window.cnxT('js.m_sa_ext.b9162597','Kỹ thuật: Chờ Đóng Gói'):'Kỹ thuật: Chờ Đóng Gói'),
            'pending_handover': (window.cnxT?window.cnxT('js.m_sa_ext.0cae1380','Kỹ thuật: Chờ Nghiệm Thu'):'Kỹ thuật: Chờ Nghiệm Thu'),
            'active': (window.cnxT?window.cnxT('js.m_sa_ext.485c0d0e','Hoàn Tất & Bảo Hành'):'Hoàn Tất & Bảo Hành')
        };
        return map[s] || (window.cnxT?window.cnxT('js.m_sa_ext.30f0d774','Đang xử lý'):'Đang xử lý');
    },

    async activateTrial7d() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.17b3b2c6','Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.'):'Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.'))) return;
        const res = await fetch('api/super_admin.php?action=activate_trial_7d', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async confirmTenantPayment() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.4d39e8af','Xác nhận đã thu đủ phí bản quyền cho quán này?'):'Xác nhận đã thu đủ phí bản quyền cho quán này?'))) return;
        const res = await fetch('api/super_admin.php?action=confirm_payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async grantWorkflowOverride() {
        const tid = this.currentPackageTenantId;
        if (!tid || !confirm((window.cnxT?window.cnxT('js.m_sa_ext.39573ee8','Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?'):'Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?'))) return;
        const res = await fetch('api/super_admin.php?action=grant_workflow_override', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    printLegalTemplatePreview() {
        const frame = document.getElementById('tpl-a4-frame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.focus();
            frame.contentWindow.print();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    SuperAdmin.init();
});
