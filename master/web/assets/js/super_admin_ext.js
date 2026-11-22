/**
 * CyberNexus OS — Extracted module from super_admin.js (SuperAdmin)
 */
Object.assign(SuperAdmin, {
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
                            <button type="button" onclick="SuperAdmin.openDepositModal(${Number(r.id)}, '${escapeJsAttr(r.company_name)}', ${bal})" class="btn-glass text-[11px] py-1 px-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30 font-bold" title="Nạp tiền ví ký quỹ">
                                <i class="fas fa-plus mr-1"></i>${window.cnxT?window.cnxT('js.m_sa.56b90884','Nạp Ví'):'Nạp Ví'}
                            </button>
                            <button type="button" onclick="SuperAdmin.openResellerIssueLicenseModal(${Number(r.id)})" class="btn-glass text-[11px] py-1 px-2.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border-teal-500/30 font-bold" title="Cấp bản quyền cho quán mới">
                                <i class="fas fa-key mr-1"></i>${window.cnxT?window.cnxT('js.m_sa.89af1565','Cấp Key'):'Cấp Key'}
                            </button>
                            <button type="button" onclick="SuperAdmin.openWalletLogsModal(${Number(r.id)}, '${escapeJsAttr(r.company_name)}')" class="btn-glass text-[11px] py-1 px-2 text-slate-300 hover:text-white" title="Lịch sử biến động số dư">
                                <i class="fas fa-history"></i>
                            </button>
                            <button type="button" onclick="SuperAdmin.editReseller(${escapeHtml(JSON.stringify(r))})" class="btn-glass text-[11px] py-1 px-2 text-sky-300 hover:text-white" title="Chỉnh sửa đại lý">
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
            const isPushed = targetCode === 'ALL'
                ? (Boolean(p.auto_publish) || pushedList.includes('ALL'))
                : pushedList.includes(targetCode);
            const tags = [];
            if (p.target_tenant) tags.push(`${window.cnxT?window.cnxT('js.m_sa_ext.c8abb6ff','RIÊNG:'):'RIÊNG:'} ${p.target_tenant}`);
            else tags.push(p.auto_publish ? 'ĐẠI TRÀ • TỰ QUÉT' : (window.cnxT?window.cnxT('js.m_sa_ext.62ce31d8','ĐẠI TRÀ • CHỜ DUYỆT'):'ĐẠI TRÀ • CHỜ DUYỆT'));
            tags.push(isPushed ? 'ĐÃ ĐẨY' : (window.cnxT?window.cnxT('js.m_sa_ext.77775c99','CHƯA ĐẨY'):'CHƯA ĐẨY'));
            if (idx === 0) tags.push((window.cnxT?window.cnxT('js.m_sa_ext.40d8a349','Mới nhất'):'Mới nhất'));
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
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('super_admin.js', e) : console.debug('super_admin.js', e)); }
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
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.m_sa_ext.c09c6e59','Xóa Gemini API Key này khỏi Master Vault? Nếu đây là Key chính, hệ thống sẽ tự chuyển sang Key dự phòng (nếu có).'):'Xóa Gemini API Key này khỏi Master Vault? Nếu đây là Key chính, hệ thống sẽ tự chuyển sang Key dự phòng (nếu có).')))) return;
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
                    const ver = escapeHtml(activePatch.version);
                    const verJs = escapeJsAttr(activePatch.version);
                    activeEl.innerHTML = `
                        <div class="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-1.5">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 text-[10px] font-bold tracking-wide">${window.cnxT?window.cnxT('js.m_sa_ext.2dddc610','ĐANG PHÁT HÀNH'):'ĐANG PHÁT HÀNH'}</span>
                                    <span class="font-mono font-black text-sky-300 text-xs">v${ver}</span>
                                    <span class="text-[10px] font-mono text-slate-400">${mb} MB • ${activePatch.files_count || 0} files</span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <button type="button" onclick="SuperAdmin.pushArchivedPatch('${verJs}')" class="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 border border-sky-400/30 text-[10px] font-bold"><i class="fas fa-paper-plane mr-1"></i>${window.cnxT?window.cnxT('js.m_sa_ext.8bc65dac','Đẩy xuống quán'):'Đẩy xuống quán'}</button>
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
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('super_admin.js', e) : console.debug('super_admin.js', e)); }
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
            const ver = escapeHtml(p.version);
            const verJs = escapeJsAttr(p.version);
            const safeId = `ota-detail-${idx}-${String(p.version || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            return `
                <div class="hover:bg-white/[0.03] transition-colors">
                    <div onclick="SuperAdmin.toggleOtaPatchDetail('${escapeJsAttr(safeId)}')" class="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none">
                        <div class="flex items-center gap-2 min-w-0 flex-1">
                            <i id="${safeId}-icon" class="fas fa-chevron-right text-[10px] text-slate-500 transition-transform w-3 text-center shrink-0"></i>
                            <span class="font-mono font-bold text-sky-300 text-[11px] shrink-0">v${ver}</span>
                            <span class="text-[11px] text-slate-200 truncate" title="${this._escHtml(p.title || '')}">${this._escHtml(p.title || (window.cnxT?window.cnxT('js.m_sa.ac9b225a','Bản vá OTA'):'Bản vá OTA'))}</span>
                            <span class="hidden sm:inline text-[10px] font-mono text-slate-500 shrink-0">• ${mb} MB</span>
                        </div>
                        <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
                            <button type="button" onclick="SuperAdmin.activateOtaPatch('${verJs}')" class="px-2 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-bold whitespace-nowrap" title="Kích hoạt / Rollback về bản này"><i class="fas fa-check mr-1"></i>Rollback</button>
                            <button type="button" onclick="SuperAdmin.pushArchivedPatch('${verJs}')" class="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 border border-sky-400/30 text-[10px] font-bold" title="Đẩy xuống quán"><i class="fas fa-paper-plane"></i></button>
                            <a href="/api/updates/download?version=${encodeURIComponent(p.version || '')}" class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 text-[10px]" title="Tải gói OTA"><i class="fas fa-download"></i></a>
                            <button type="button" onclick="SuperAdmin.deleteOtaPatch('${verJs}')" class="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[10px]" title="Xóa bản vá"><i class="fas fa-trash"></i></button>
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
        if (!(await window.cnxConfirm(`${window.cnxT?window.cnxT('js.m_sa_ext.3c770fd7','Kích hoạt bản vá v'):'Kích hoạt bản vá v'}${version} ${window.cnxT?window.cnxT('js.m_sa_ext.25eea0a6','làm bản OTA phát hành hiện tại?'):'làm bản OTA phát hành hiện tại?'}`))) return;
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
        if (!(await window.cnxConfirm(`${window.cnxT?window.cnxT('js.m_sa_ext.b6c764fd','Xóa vĩnh viễn bản vá v'):'Xóa vĩnh viễn bản vá v'}${version} ${window.cnxT?window.cnxT('js.m_sa_ext.c660eece','khỏi kho lưu trữ?'):'khỏi kho lưu trữ?'}`))) return;
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
                    <button type="button" onclick="SuperAdmin.selectLegalTemplate('${escapeJsAttr(tpl.file)}')"
                        data-tpl-file="${escapeHtml(tpl.file)}"
                        class="tpl-pill-btn px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${idx === 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900/70 text-slate-300 border-white/10 hover:border-amber-500/30'}">
                        <i class="fas fa-file-lines"></i>
                        <span>${escapeHtml(tpl.title)}</span>
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
        if (!tid || !(await window.cnxConfirm((window.cnxT?window.cnxT('js.m_sa_ext.17b3b2c6','Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.'):'Kích hoạt dùng thử 07 ngày cho quán này? Kỹ thuật sẽ được mở khóa đóng gói bản Trial ngay.')))) return;
        const res = await fetch('api/super_admin.php?action=activate_trial_7d', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async confirmTenantPayment() {
        const tid = this.currentPackageTenantId;
        if (!tid || !(await window.cnxConfirm((window.cnxT?window.cnxT('js.m_sa_ext.4d39e8af','Xác nhận đã thu đủ phí bản quyền cho quán này?'):'Xác nhận đã thu đủ phí bản quyền cho quán này?')))) return;
        const res = await fetch('api/super_admin.php?action=confirm_payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tid })
        }).then(r => r.json());
        alert(res.message || (window.cnxT?window.cnxT('js.m_sa_ext.3f523216','Đã cập nhật'):'Đã cập nhật'));
        if (res.success) { await this.loadTenantPackages(tid); this.loadTenants(); }
    },

    async grantWorkflowOverride() {
        const tid = this.currentPackageTenantId;
        if (!tid || !(await window.cnxConfirm((window.cnxT?window.cnxT('js.m_sa_ext.39573ee8','Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?'):'Duyệt ngoại lệ cho phép Kỹ thuật đóng gói bộ cài trước khi hoàn tất chứng từ?')))) return;
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
});
