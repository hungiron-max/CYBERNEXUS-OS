/**
 * Admin Module: Finance Reports, Cashbook, SmartPOS ECR & Promotions
 * Extracted from admin.js for modular maintainability
 */
Object.assign(Admin, {
    // ==========================================
    // 8. TÀI CHÍNH & SỔ QUỸ (FINANCE REPORTS)
    // ==========================================
    setAuditFilter(mode) {
        if (!mode) mode = 'all';
        this._auditFilterMode = (this._auditFilterMode === mode && mode !== 'all') ? 'all' : mode;
        const sel = document.getElementById('fin-audit-filter');
        if (sel) sel.value = this._auditFilterMode;
        this.renderAuditKpiCards();
        this.filterAuditLogs();
    },

    scrollToShiftReconciliation() {
        const el = document.getElementById('fin-shift-reconciliation-card');
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-2', 'ring-amber-400/70');
        setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400/70'), 1600);
    },

    renderAuditKpiCards() {
        const auditKpi = this._auditKpiData || { critical_count: 0, void_count: 0, void_amount: 0, discount_count: 0, discount_amount: 0, total_shift_discrepancy: 0 };
        const auditKpiEl = document.getElementById('fin-audit-kpi-cards');
        if (!auditKpiEl) return;
        const diffVal = Number(auditKpi.total_shift_discrepancy) || 0;
        const mode = this._auditFilterMode || 'all';
        const activeCls = (m) => mode === m ? 'ring-2 ring-sky-400/70 bg-white/[0.06]' : 'hover:bg-white/[0.04]';
        auditKpiEl.innerHTML = `
            <div onclick="Admin.setAuditFilter('critical')" class="liquid-glass-card p-3 border-l-4 border-rose-500 cursor-pointer transition-all ${activeCls('critical')}" title="Bấm để lọc các sự kiện CRITICAL">
                <span class="text-[10px] font-bold text-rose-300 uppercase flex items-center justify-between"><span>${window.cnxT?window.cnxT('js.s_fin.8932c6af','CẢNH BÁO RỦI RO CAO (CRITICAL)'):'CẢNH BÁO RỦI RO CAO (CRITICAL)'}</span><i class="fas fa-filter text-[9px] opacity-70"></i></span>
                <div class="text-xl font-black text-rose-400 font-mono mt-1">${auditKpi.critical_count} <span class="text-xs font-normal text-slate-400">${window.cnxT?window.cnxT('js.s_fin.e1b14571','sự kiện'):'sự kiện'}</span></div>
                <span class="text-[10px] text-slate-400 mt-0.5 block">${window.cnxT?window.cnxT('js.s_fin.957d61bc','Hủy đơn / Giảm giá lớn / Lệch ca'):'Hủy đơn / Giảm giá lớn / Lệch ca'}</span>
            </div>
            <div onclick="Admin.setAuditFilter('void')" class="liquid-glass-card p-3 border-l-4 border-orange-400 cursor-pointer transition-all ${activeCls('void')}" title="Bấm để lọc chi tiết các đơn đã hủy (VOID)">
                <span class="text-[10px] font-bold text-orange-300 uppercase flex items-center justify-between"><span>${window.cnxT?window.cnxT('js.s_fin.e5c26f2b','TỔNG HỦY ĐƠN (VOID)'):'TỔNG HỦY ĐƠN (VOID)'}</span><i class="fas fa-filter text-[9px] opacity-70"></i></span>
                <div class="text-xl font-black text-orange-400 font-mono mt-1">${this.formatMoney(auditKpi.void_amount)} đ</div>
                <span class="text-[10px] text-slate-400 mt-0.5 block">${auditKpi.void_count} hóa đơn bị hủy</span>
            </div>
            <div onclick="Admin.setAuditFilter('discount')" class="liquid-glass-card p-3 border-l-4 border-amber-400 cursor-pointer transition-all ${activeCls('discount')}" title="Bấm để lọc chi tiết các lượt giảm giá thủ công">
                <span class="text-[10px] font-bold text-amber-300 uppercase flex items-center justify-between"><span>${window.cnxT?window.cnxT('js.s_fin.7d129367','TỔNG GIẢM GIÁ THỦ CÔNG'):'TỔNG GIẢM GIÁ THỦ CÔNG'}</span><i class="fas fa-filter text-[9px] opacity-70"></i></span>
                <div class="text-xl font-black text-amber-400 font-mono mt-1">${this.formatMoney(auditKpi.discount_amount)} đ</div>
                <span class="text-[10px] text-slate-400 mt-0.5 block">${auditKpi.discount_count} lượt áp chiết khấu</span>
            </div>
            <div onclick="Admin.scrollToShiftReconciliation()" class="liquid-glass-card p-3 border-l-4 ${diffVal < 0 ? 'border-rose-500' : 'border-emerald-400'} cursor-pointer hover:bg-white/[0.04] transition-all" title="Bấm để xem chi tiết từng ca giao nhận két bên dưới">
                <span class="text-[10px] font-bold text-slate-300 uppercase flex items-center justify-between"><span>${window.cnxT?window.cnxT('js.s_fin.a4b5bde7','LỆCH KÉT GIAO CA LŨY KẾ'):'LỆCH KÉT GIAO CA LŨY KẾ'}</span><i class="fas fa-arrow-down text-[9px] opacity-70"></i></span>
                <div class="text-xl font-black ${diffVal < 0 ? 'text-rose-400' : 'text-emerald-400'} font-mono mt-1">${diffVal > 0 ? '+' : ''}${this.formatMoney(diffVal)} đ</div>
                <span class="text-[10px] text-slate-400 mt-0.5 block">${diffVal === 0 ? 'Khớp 100% két lý thuyết' : (diffVal < 0 ? 'Thiếu hụt tiền mặt' : (window.cnxT?window.cnxT('js.s_fin.c4b9ac35','Dư tiền mặt'):'Dư tiền mặt'))} • Xem chi tiết ca</span>
            </div>
        `;
    },

    filterAuditLogs() {
        const auditTbody = document.getElementById('fin-audit-logs-tbody');
        if (!auditTbody) return;
        const logs = Array.isArray(this._auditLogsData) ? this._auditLogsData : [];
        const mode = this._auditFilterMode || 'all';
        const q = (document.getElementById('fin-audit-search')?.value || '').trim().toLowerCase();

        const filtered = logs.filter(l => {
            const code = String(l.action_code || l.action_label || '').toUpperCase();
            const isVoid = code.includes('VOID') || code.includes('CANCEL') || code.includes('HUY');
            const isDisc = code.includes('DISCOUNT') || code.includes('GIAM');
            if (mode === 'critical' && l.severity !== 'CRITICAL') return false;
            if (mode === 'void' && !isVoid) return false;
            if (mode === 'discount' && !isDisc) return false;
            if (mode === 'other' && (isVoid || isDisc)) return false;
            if (q) {
                const hay = `${l.action_label || ''} ${l.action_code || ''} ${l.table_code || ''} ${l.order_code || ''} ${l.reason || ''} ${l.details || ''} ${l.user_name || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        const cntEl = document.getElementById('fin-audit-count');
        if (cntEl) {
            cntEl.textContent = filtered.length === logs.length
                ? `${logs.length} ${window.cnxT?window.cnxT('js.m_sa_ext.2179d660','bản ghi'):'bản ghi'}`
                : `${filtered.length}/${logs.length} ${window.cnxT?window.cnxT('js.m_sa_ext.2179d660','bản ghi'):'bản ghi'}`;
        }

        if (filtered.length === 0) {
            auditTbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-xs text-slate-500">${logs.length === 0 ? 'Chưa ghi nhận thao tác nhạy cảm nào trong Nhật ký Kiểm toán.' : (window.cnxT?window.cnxT('js.s_fin.05ef7dfd','Không có sự kiện kiểm toán phù hợp bộ lọc hiện tại.'):'Không có sự kiện kiểm toán phù hợp bộ lọc hiện tại.')}</td></tr>`;
            return;
        }
        auditTbody.innerHTML = filtered.map(l => {
            const sevBadge = l.severity === 'CRITICAL'
                ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">🚩 CRITICAL</span>'
                : (l.severity === 'WARN'
                    ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">⚠️ WARN</span>'
                    : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">ℹ️ INFO</span>');
            return `
                <tr class="hover:bg-white/[0.03] transition-colors">
                    <td><span class="font-mono text-[11px] text-slate-400 whitespace-nowrap">${l.created_at ? window.formatDateDDMMYY(l.created_at, true) : '-'}</span></td>
                    <td>${sevBadge}</td>
                    <td><span class="text-xs font-bold text-white">${escapeHtml(l.action_label || l.action_code)}</span></td>
                    <td><span class="font-mono text-xs text-sky-300">${escapeHtml(l.table_code || '-')} ${l.order_code ? '(' + escapeHtml(l.order_code) + ')' : ''}</span></td>
                    <td class="col-right"><span class="font-mono font-bold text-xs ${Number(l.amount_impact) > 0 ? 'text-rose-400' : 'text-slate-400'}">${Number(l.amount_impact) > 0 ? this.formatMoney(l.amount_impact) + ' đ' : '-'}</span></td>
                    <td>
                        <div class="text-xs text-amber-200 font-semibold">${escapeHtml(l.reason || '-')}</div>
                        ${l.details ? `<div class="text-[10px] text-slate-400">${escapeHtml(l.details)}</div>` : ''}
                    </td>
                    <td><span class="text-xs text-slate-300 font-medium">${escapeHtml(l.user_name || '-')} <span class="text-[10px] text-slate-500">[${escapeHtml(l.user_role || '')}]</span></span></td>
                </tr>
            `;
        }).join('');
    },

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
            const [repRes, expRes, auditRes, pnlCmpRes, taxRes] = await Promise.all([
                fetch(`api/finance.php?action=get_report&month=${month}`).then(r => r.json()).catch(() => ({})),
                fetch(`api/finance.php?action=list_expenses&month=${month}`).then(r => r.json()).catch(() => ({})),
                fetch(`api/finance.php?action=audit_and_shifts`).then(r => r.json()).catch(() => ({})),
                fetch(`api/finance.php?action=get_pnl_comparison&month=${month}`).then(r => r.json()).catch(() => ({})),
                fetch(`api/finance.php?action=get_tax_settings`).then(r => r.json()).catch(() => ({}))
            ]);
            const tCfg = (taxRes && taxRes.success && taxRes.data) ? taxRes.data : {};
            this.taxSettings = {
                pos_vat_mode: tCfg.pos_vat_mode || 'none',
                pos_vat_rate: parseFloat(tCfg.pos_vat_rate ?? tCfg.finance_vat_rate ?? '8') || 0,
                tax_method: tCfg.finance_tax_method || 'household',
                vat_rate: parseFloat(tCfg.finance_vat_rate ?? '8') || 0,
                pit_rate: parseFloat(tCfg.finance_pit_rate ?? '1.5') || 0,
                cit_rate: parseFloat(tCfg.finance_cit_rate ?? '20') || 0,
                fixed_cost: parseFloat(tCfg.finance_fixed_cost ?? '0') || 0
            };

            // Render Audit KPI Cards & Audit Logs Table & Shifts Table
            this._auditKpiData = (auditRes && auditRes.audit_kpi) || { critical_count: 0, void_count: 0, void_amount: 0, discount_count: 0, discount_amount: 0, total_shift_discrepancy: 0 };
            this._auditLogsData = (auditRes && auditRes.audit_logs) || [];
            if (!this._auditFilterMode) this._auditFilterMode = 'all';
            this.renderAuditKpiCards();
            this.filterAuditLogs();

            const shiftsTbody = document.getElementById('fin-shifts-tbody');
            if (shiftsTbody) {
                const shifts = (auditRes && auditRes.shifts) || [];
                if (shifts.length === 0) {
                    shiftsTbody.innerHTML = (window.cnxT?window.cnxT('js.s_fin.95b46264','<tr><td colspan="10" class="py-6 text-center text-xs text-slate-500">Chưa có lịch sử ca làm việc nào. Thu ngân có thể bấm "Giao Ca / Quỹ" trên màn hình POS để mở ca.</td></tr>'):'<tr><td colspan="10" class="py-6 text-center text-xs text-slate-500">Chưa có lịch sử ca làm việc nào. Thu ngân có thể bấm "Giao Ca / Quỹ" trên màn hình POS để mở ca.</td></tr>');
                } else {
                    shiftsTbody.innerHTML = shifts.map(s => {
                        const diff = Number(s.discrepancy) || 0;
                        const isOpen = s.status === 'open';
                        const diffClass = diff < 0 ? 'text-rose-400 font-black' : (diff > 0 ? 'text-amber-300 font-bold' : 'text-emerald-400 font-bold');
                        return `
                            <tr class="hover:bg-white/[0.03] transition-colors">
                                <td><span class="font-mono font-bold text-xs text-amber-300">${escapeHtml(s.shift_code)}</span></td>
                                <td><span class="text-xs text-white font-semibold">${escapeHtml(s.user_name || (window.cnxT?window.cnxT('ui.ord_html.b_6951ffd8','Thu ngân'):'Thu ngân'))}</span></td>
                                <td>
                                    <div class="font-mono text-[10px] text-slate-300">Mở: ${s.opened_at ? window.formatDateDDMMYY(s.opened_at, true) : '-'}</div>
                                    <div class="font-mono text-[10px] text-slate-400">Kết: ${s.closed_at ? window.formatDateDDMMYY(s.closed_at, true) : (window.cnxT?window.cnxT('js.s_fin.62fedbfd','Đang trực ca'):'Đang trực ca')}</div>
                                </td>
                                <td class="col-right font-mono text-xs text-slate-300">${this.formatMoney(s.opening_cash)} đ</td>
                                <td class="col-right font-mono text-xs text-emerald-400">+${this.formatMoney(s.cash_sales)} đ</td>
                                <td class="col-right font-mono text-[11px]">
                                    <span class="text-emerald-300">+${this.formatMoney(s.cash_in)}</span> / <span class="text-rose-400">-${this.formatMoney(s.cash_out)}</span>
                                </td>
                                <td class="col-right font-mono text-xs font-bold text-sky-300">${isOpen ? 'Đang tính' : this.formatMoney(s.expected_cash) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ')}</td>
                                <td class="col-right font-mono text-xs font-bold text-white">${isOpen ? '-' : this.formatMoney(s.actual_cash) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ')}</td>
                                <td class="col-right font-mono text-xs ${diffClass}">${isOpen ? '-' : (diff > 0 ? '+' : '') + this.formatMoney(diff) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ')}</td>
                                <td>
                                    ${isOpen
                                        ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">ĐANG MỞ</span>'
                                        : (window.cnxT?window.cnxT('js.s_fin.ba4b12c9','<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-white/10">ĐÃ CHỐT</span>'):'<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-white/10">ĐÃ CHỐT</span>')}
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            const cycleBadge = document.getElementById('fin-cycle-badge');
            if (cycleBadge && repRes && repRes.period_start && repRes.period_end) {
                const ps = window.formatDateDDMMYY ? window.formatDateDDMMYY(repRes.period_start, false) : repRes.period_start;
                const pe = window.formatDateDDMMYY ? window.formatDateDDMMYY(repRes.period_end, false) : repRes.period_end;
                const elDays = repRes.elapsed_days !== undefined ? repRes.elapsed_days : repRes.days_in_month;
                const rtTag = repRes.is_realtime_cycle
                    ? `Real-time ${repRes.realtime_as_of ? repRes.realtime_as_of.substring(11, 16) : ''} • `
                    : (window.cnxT?window.cnxT('js.s_fin.5a840b24','Đã chốt chu kỳ • '):'Đã chốt chu kỳ • ');
                cycleBadge.textContent = `${window.cnxT?window.cnxT('js.s_fin.a7075f5f','Chu kỳ:'):'Chu kỳ:'} ${ps} – ${pe} (${rtTag}${elDays}/${repRes.days_in_month || 30} ${window.cnxT?window.cnxT('js.s_fin.952ca930','ngày)'):'ngày)'}`;
            }

            if (repRes && repRes.success === false) {
                const kpiContainer = document.getElementById('fin-kpi-cards');
                if (kpiContainer) {
                    kpiContainer.innerHTML = `<div class="col-span-full p-4 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs font-semibold"><i class="fas fa-exclamation-triangle mr-2"></i>${repRes.message || repRes.error || (window.cnxT?window.cnxT('js.s_fin.a8271097','Không thể tải dữ liệu Báo Cáo Tài Chính'):'Không thể tải dữ liệu Báo Cáo Tài Chính')}</div>`;
                }
                return;
            }

            this._lastFinanceReport = repRes;
            this._lastFinanceExpenses = (expRes && expRes.data) ? expRes.data : [];

            const summary = (repRes && repRes.summary) || { revenue: 0, expenses: 0, net_profit: 0 };
            const totalAllCosts = Number(summary.total_costs) || ((Number(summary.cogs) || 0) + (Number(summary.expenses) || 0));
            const totalLabor = Number(summary.total_labor) || ((Number(summary.labor_cost) || 0) + (Number(summary.bonus_cost) || 0));
            const totalReceivable = (Number(summary.receivable_amount) || 0) + (Number(summary.pending_revenue) || 0);
            const totalPayable = Number(summary.payable_debt) || 0;
            const netMarginPct = summary.revenue > 0 ? ((summary.net_profit / summary.revenue) * 100).toFixed(1) : '0.0';

            const kpiContainer = document.getElementById('fin-kpi-cards');
            if (kpiContainer) {
                const covPct = Number(summary.cogs_coverage_pct ?? 100);
                const estCogs = Number(summary.estimated_cogs || 0);
                const netCash = Number(summary.net_cashflow || 0);
                const cashIn = Number(summary.cash_inflow || 0);
                const cashOut = Number(summary.cash_outflow || 0);
                const supPaid = Number(summary.supplier_paid_in_period || 0);
                const cogsQualityBadge = covPct >= 90
                    ? `<span class="text-emerald-300">Giá vốn thực ${covPct}%</span>`
                    : `<span class="text-amber-300" title="Một số món chưa có giá vốn/định lượng nên hệ thống ước tính phần thiếu">Giá vốn thực ${covPct}${window.cnxT?window.cnxT('js.s_fin.8e2a07fb','% (Ước tính'):'% (Ước tính'} ${this.formatMoney(estCogs)} đ)</span>`;
                kpiContainer.innerHTML = `
                    <div class="liquid-glass-card p-3 border-l-4 border-emerald-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DOANH THU THỰC (${summary.order_count || 0} ĐƠN)</span>
                        <div class="text-xl font-black text-emerald-400 font-mono mt-1">${this.formatMoney(summary.revenue)} đ</div>
                        <span class="text-[10px] text-sky-300 mt-0.5 block">Thực thu: ${this.formatMoney(cashIn)} ${window.cnxT?window.cnxT('js.s_fin.2928e9b3','đ • Đang mở: +'):'đ • Đang mở: +'}${this.formatMoney(summary.pending_revenue || 0)} đ</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-amber-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">${window.cnxT?window.cnxT('js.s_fin.902c202e','TỔNG CHI PHÍ P&amp;L (REALTIME)'):'TỔNG CHI PHÍ P&amp;L (REALTIME)'}</span>
                        <div class="text-xl font-black text-amber-400 font-mono mt-1">${this.formatMoney(totalAllCosts)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">COGS ${this.formatMoney(summary.cogs || 0)} + VH ${this.formatMoney(summary.expenses || 0)} • ${cogsQualityBadge}</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 ${summary.net_profit >= 0 ? 'border-sky-400' : 'border-rose-400'}">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">LỢI NHUẬN RÒNG P&amp;L (${netMarginPct}%)</span>
                        <div class="text-xl font-black ${summary.net_profit >= 0 ? 'text-sky-400' : 'text-rose-400'} font-mono mt-1">${this.formatMoney(summary.net_profit)} đ</div>
                        <span class="text-[10px] ${netCash >= 0 ? 'text-emerald-300' : 'text-rose-300'} mt-0.5 block" title="Dòng tiền ròng = Thực thu - (Trả NCC + Chi phí đã trả + Chi tại quầy)">Dòng tiền ròng: ${this.formatMoney(netCash)} ${window.cnxT?window.cnxT('js.s_fin.efbb0de5','đ (Chi'):'đ (Chi'} ${this.formatMoney(cashOut)} đ)</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-purple-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">${window.cnxT?window.cnxT('js.s_fin.64574b76','LƯƠNG &amp; THƯỞNG (REALTIME)'):'LƯƠNG &amp; THƯỞNG (REALTIME)'}</span>
                        <div class="text-xl font-black text-purple-400 font-mono mt-1">${this.formatMoney(totalLabor)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">${Number(summary.labor_hours || 0).toFixed(1)}${window.cnxT?window.cnxT('js.s_fin.f04bf10d','h công •'):'h công •'} ${summary.working_staff_count || 0} NV đang trực</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-teal-400 cursor-pointer hover:bg-white/[0.03]" onclick="Admin.openSupplierFinanceModal()" title="Bấm để xem &amp; thanh toán chi tiết công nợ Nhà cung cấp">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">${window.cnxT?window.cnxT('js.s_fin.5a755b5c','CÔNG NỢ &amp; KHO HÀNG'):'CÔNG NỢ &amp; KHO HÀNG'} <i class="fas fa-arrow-up-right-from-square ml-1 text-teal-400"></i></span>
                        <div class="text-sm font-black text-rose-300 font-mono mt-1">Nợ phải trả: ${this.formatMoney(totalPayable)} đ</div>
                        <span class="text-[10px] text-amber-300 mt-0.5 block">Đã trả NCC: ${this.formatMoney(supPaid)} ${window.cnxT?window.cnxT('js.s_fin.bb3cbebe','đ • Nhập kho:'):'đ • Nhập kho:'} ${this.formatMoney(summary.material_import_cost || 0)} đ</span>
                    </div>
                `;
            }

            const expTbody = document.getElementById('fin-expense-tbody');
            if (expTbody) {
                const list = (expRes && expRes.data) ? expRes.data : [];
                if (list.length === 0) {
                    expTbody.innerHTML = this.renderEmptyState(7, 'fa-file-invoice-dollar', (window.cnxT?window.cnxT('js.s_fin.dd2405d8','Chưa có khoản chi nào trong kỳ'):'Chưa có khoản chi nào trong kỳ'), (window.cnxT?window.cnxT('js.s_fin.2fa5dfd4','Bấm nút "Thêm chi phí / Công nợ" ở trên để ghi nhận các khoản chi phát sinh trong tháng.'):'Bấm nút "Thêm chi phí / Công nợ" ở trên để ghi nhận các khoản chi phát sinh trong tháng.'));
                } else {
                    let html = '';
                    list.forEach(item => {
                        const isUnpaid = item.payment_status === 'unpaid';
                        html += `
                            <tr class="hover:bg-sky-500/[0.04] transition-colors">
                                <td><span class="font-mono text-xs text-slate-300 whitespace-nowrap">${item.expense_date ? window.formatDateDDMMYY(item.expense_date, false) : '-'}</span></td>
                                <td>
                                    <span class="saas-badge bg-teal-500/15 text-teal-300 border border-teal-500/30 whitespace-nowrap">${escapeHtml(item.category || (window.cnxT?window.cnxT('ui.admin_html.option_cd0ec881','Khác'):'Khác'))}</span>
                                    ${isUnpaid ? '<span class="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">NỢ NCC</span>' : ''}
                                </td>
                                <td class="col-name"><span class="text-xs font-medium text-white whitespace-nowrap">${escapeHtml(item.description || '-')}</span></td>
                                <td><span class="text-xs text-slate-400 whitespace-nowrap">${escapeHtml(item.supplier || '-')}</span></td>
                                <td class="col-money"><span class="font-mono font-bold ${isUnpaid ? 'text-rose-400' : 'text-amber-300'} text-xs whitespace-nowrap">${this.formatMoney(item.amount)} đ</span></td>
                                <td class="col-money"><span class="font-mono text-slate-400 text-xs whitespace-nowrap">${this.formatMoney(item.vat_amount || 0)} đ</span></td>
                                <td class="col-right whitespace-nowrap">
                                    ${isUnpaid ? `<button type="button" class="saas-action-btn bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mr-1" onclick="Admin.markExpensePaid(${item.id})" title="Xác nhận đã trả nợ"><i class="fas fa-check text-[10px]"></i></button>` : ''}
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
                const groups = (repRes && repRes.expense_groups) ? [...repRes.expense_groups] : [];
                groups.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
                const sumExpGrp = groups.reduce((s, g) => s + (Number(g.amount) || 0), 0);
                if (groups.length === 0) {
                    expGroups.innerHTML = (window.cnxT?window.cnxT('js.s_fin.f64e7f72','<div class="text-xs text-slate-400 py-4 text-center italic">Chưa có chi phí phát sinh trong tháng này</div>'):'<div class="text-xs text-slate-400 py-4 text-center italic">Chưa có chi phí phát sinh trong tháng này</div>');
                } else {
                    let gHtml = '';
                    groups.forEach(g => {
                        const amt = Number(g.amount) || 0;
                        const pct = sumExpGrp > 0 ? Math.round((amt / sumExpGrp) * 100) : 0;
                        const autoBadge = g.auto ? '<span class="ml-1 px-1 py-0.2 rounded text-[9px] bg-sky-500/15 text-sky-300 border border-sky-500/25">Auto</span>' : '';
                        gHtml += `
                            <div class="py-1.5 border-b border-white/5">
                                <div class="flex items-center justify-between text-xs mb-1">
                                    <span class="text-slate-200 font-medium">${escapeHtml(g.category || (window.cnxT?window.cnxT('ui.admin_html.option_cd0ec881','Khác'):'Khác'))}${autoBadge} <span class="text-slate-500 text-[10px]">(${Number(g.count || 0)})</span></span>
                                    <span class="font-mono font-bold text-amber-400">${this.formatMoney(amt)} đ <span class="text-[10px] text-slate-400">(${pct}%)</span></span>
                                </div>
                                <div class="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                                    <div class="h-full bg-amber-400/80 rounded-full" style="width:${pct}%"></div>
                                </div>
                            </div>
                        `;
                    });
                    expGroups.innerHTML = gHtml;
                }
            }

            // 1. Doanh thu theo ngày (Chart.js — đầy đủ từ ngày 01 đến cuối tháng)
            const dailyCanvas = document.getElementById('fin-daily-chart');
            if (dailyCanvas && typeof Chart !== 'undefined') {
                const dailyList = (repRes && Array.isArray(repRes.daily_revenue)) ? repRes.daily_revenue : [];
                if (this.finDailyChart) {
                    this.finDailyChart.destroy();
                    this.finDailyChart = null;
                }
                const labels = dailyList.map(d => {
                    const s = String(d.day || '');
                    return s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : s;
                });
                const values = dailyList.map(d => Number(d.revenue) || 0);
                const ordersCnt = dailyList.map(d => Number(d.orders) || 0);
                this.finDailyChart = new Chart(dailyCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: labels.length ? labels : [(window.cnxT?window.cnxT('js.s_fin.4332d86b','Chưa có dữ liệu'):'Chưa có dữ liệu')],
                        datasets: [{
                            label: (window.cnxT?window.cnxT('js.s_fin.538fc5e1','Doanh thu (đ)'):'Doanh thu (đ)'),
                            data: values.length ? values : [0],
                            backgroundColor: values.map(v => v > 0 ? 'rgba(20, 184, 166, 0.65)' : 'rgba(148, 163, 184, 0.15)'),
                            borderColor: '#2dd4bf',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const idx = ctx.dataIndex;
                                        const ord = ordersCnt[idx] || 0;
                                        return `${this.formatMoney(ctx.parsed.y)} ${window.cnxT?window.cnxT('js.s_adm.b4be420b','đ ('):'đ ('}${ord} ${window.cnxT?window.cnxT('js.s_adm.a50869e7','đơn)'):'đơn)'}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: { ticks: { color: '#94a3b8', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 }, grid: { color: 'rgba(255,255,255,0.03)' } },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: '#94a3b8',
                                    font: { size: 10 },
                                    callback: (v) => v >= 1000000 ? (v / 1000000).toFixed(1) + 'tr' : this.formatMoney(v)
                                },
                                grid: { color: 'rgba(255,255,255,0.06)' }
                            }
                        }
                    }
                });
            }

            // 2. Kết quả kinh doanh (P&L)
            const pnlEl = document.getElementById('fin-pnl');
            if (pnlEl) {
                const grossSales = Number(summary.gross_sales) || Number(summary.revenue) || 0;
                const discounts = Number(summary.discounts) || 0;
                const revenue = Number(summary.revenue) || 0;
                const cogs = Number(summary.cogs) || 0;
                const grossProfit = summary.gross_profit !== undefined ? Number(summary.gross_profit) : (revenue - cogs);
                const laborCost = Number(summary.labor_cost) || 0;
                const bonusCost = Number(summary.bonus_cost) || 0;
                const opexOnly = Number(summary.opex_expenses) !== undefined ? Number(summary.opex_expenses) : (Number(summary.expenses) || 0);
                const cashOutCounter = Number(summary.cash_out_counter) || 0;
                const lossAndShortage = (Number(summary.material_loss_cost) || 0) + (Number(summary.shortage_loss) || 0);
                const netProfit = Number(summary.net_profit) || 0;
                const orderCount = Number(summary.order_count) || 0;
                const grossMargin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '0.0';
                const netMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : '0.0';

                pnlEl.innerHTML = `
                    <tbody class="divide-y divide-white/5">
                        <tr><td class="py-1.5 text-slate-300">Doanh thu gộp (${orderCount} đơn)</td><td class="py-1.5 text-right font-mono text-slate-200">${this.formatMoney(grossSales)} đ</td></tr>
                        <tr><td class="py-1.5 text-slate-400">${window.cnxT?window.cnxT('js.s_fin.339f2687','Giảm giá / Chiết khấu'):'Giảm giá / Chiết khấu'}</td><td class="py-1.5 text-right font-mono text-rose-400">-${this.formatMoney(discounts)} đ</td></tr>
                        <tr class="font-semibold"><td class="py-1.5 text-emerald-300">${window.cnxT?window.cnxT('js.s_fin.7010a252','Doanh thu thuần'):'Doanh thu thuần'}</td><td class="py-1.5 text-right font-mono text-emerald-400">${this.formatMoney(revenue)} đ</td></tr>
                        <tr><td class="py-1.5 text-slate-400">${window.cnxT?window.cnxT('js.s_fin.e0186fb5','Giá vốn hàng bán (COGS)'):'Giá vốn hàng bán (COGS)'}</td><td class="py-1.5 text-right font-mono text-amber-300">-${this.formatMoney(cogs)} đ</td></tr>
                        <tr class="font-semibold"><td class="py-1.5 text-sky-300">Lợi nhuận gộp (${grossMargin}%)</td><td class="py-1.5 text-right font-mono text-sky-400">${this.formatMoney(grossProfit)} đ</td></tr>
                        <tr><td class="py-1.5 text-slate-400">Lương chấm công (${Number(summary.labor_hours || 0).toFixed(1)}h)</td><td class="py-1.5 text-right font-mono text-purple-300">-${this.formatMoney(laborCost)} đ</td></tr>
                        ${bonusCost > 0 ? `<tr><td class="py-1.5 text-slate-400">${window.cnxT?window.cnxT('js.s_fin.beb6f7f9','Thưởng &amp; Phụ cấp'):'Thưởng &amp; Phụ cấp'}</td><td class="py-1.5 text-right font-mono text-purple-300">-${this.formatMoney(bonusCost)} đ</td></tr>` : ''}
                        <tr><td class="py-1.5 text-slate-400">${window.cnxT?window.cnxT('js.s_fin.35ad2474','Chi phí vận hành (Mặt bằng, MKT...)'):'Chi phí vận hành (Mặt bằng, MKT...)'}</td><td class="py-1.5 text-right font-mono text-amber-400">-${this.formatMoney(opexOnly)} đ</td></tr>
                        ${(cashOutCounter > 0 || lossAndShortage > 0) ? `<tr><td class="py-1.5 text-slate-400">${window.cnxT?window.cnxT('js.s_fin.538baff7','Chi quầy &amp; Hao hụt / Lệch két'):'Chi quầy &amp; Hao hụt / Lệch két'}</td><td class="py-1.5 text-right font-mono text-rose-300">-${this.formatMoney(cashOutCounter + lossAndShortage)} đ</td></tr>` : ''}
                        <tr class="border-t border-white/15 font-bold text-sm">
                            <td class="pt-2 text-white">Lợi nhuận ròng (${netMargin}%)</td>
                            <td class="pt-2 text-right font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(netProfit)} đ</td>
                        </tr>
                        <tr class="text-[11px] text-slate-400">
                            <td class="pt-1.5">${window.cnxT?window.cnxT('js.s_fin.d3942168','Dự phóng doanh thu tháng'):'Dự phóng doanh thu tháng'}</td>
                            <td class="pt-1.5 text-right font-mono text-teal-300">${this.formatMoney(summary.projected_revenue || revenue)} đ</td>
                        </tr>
                    </tbody>
                `;
            }

            // 3. Thuế & điểm hòa vốn
            const taxEl = document.getElementById('fin-tax');
            if (taxEl) {
                const revenue = Number(summary.revenue) || 0;
                const cogs = Number(summary.cogs) || 0;
                const expenses = Number(summary.expenses) || 0;
                const vatOutRaw = Number(summary.vat_collected) || 0;
                const vatRateCfg = Number(this.taxSettings?.vat_rate) || 0;
                const pitRateCfg = Number(this.taxSettings?.pit_rate) || 0;
                const vatOut = vatOutRaw > 0 ? vatOutRaw : Math.round(revenue * vatRateCfg / 100);
                const vatIn = Number(summary.vat_input) || 0;
                const vatPayable = Math.max(0, vatOut - vatIn);
                const pitPayable = Math.round(revenue * pitRateCfg / 100);
                const grossRatio = revenue > 0 ? Math.max(0.05, (revenue - cogs) / revenue) : 0.65;
                const breakeven = expenses > 0 ? Math.round(expenses / grossRatio) : 0;
                const progress = breakeven > 0 ? Math.min(100, Math.round((revenue / breakeven) * 100)) : (revenue > 0 ? 100 : 0);
                const passed = revenue >= breakeven;

                taxEl.innerHTML = `
                    <div class="flex items-center justify-between py-1 border-b border-white/5">
                        <span class="text-slate-300">${window.cnxT?window.cnxT('js.s_fin.c2aee3bd','VAT đầu ra (hóa đơn)'):'VAT đầu ra (hóa đơn)'}</span>
                        <span class="font-mono text-sky-300">${this.formatMoney(vatOut)} đ</span>
                    </div>
                    <div class="flex items-center justify-between py-1 border-b border-white/5">
                        <span class="text-slate-300">${window.cnxT?window.cnxT('js.s_fin.e33b3824','VAT đầu vào (phiếu chi)'):'VAT đầu vào (phiếu chi)'}</span>
                        <span class="font-mono text-emerald-300">${this.formatMoney(vatIn)} đ</span>
                    </div>
                    <div class="flex items-center justify-between py-1 border-b border-white/5">
                        <span class="text-slate-300 font-semibold">VAT dự kiến phải nộp (${vatRateCfg}% cấu hình)</span>
                        <span class="font-mono font-bold text-amber-300">${this.formatMoney(vatPayable)} đ</span>
                    </div>
                    <div class="flex items-center justify-between py-1 border-b border-white/5">
                        <span class="text-slate-300">Thuế TNCN / Hộ KD (${pitRateCfg}%)</span>
                        <span class="font-mono text-rose-300">${this.formatMoney(pitPayable)} đ</span>
                    </div>
                    <div class="flex items-center justify-between py-1 border-b border-white/5">
                        <span class="text-slate-300">${window.cnxT?window.cnxT('js.s_fin.5cb9e2b9','Công nợ phải thu / Bàn mở'):'Công nợ phải thu / Bàn mở'}</span>
                        <span class="font-mono text-teal-300">${this.formatMoney(totalReceivable)} đ</span>
                    </div>
                    <div class="pt-2">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-slate-300">${window.cnxT?window.cnxT('js.s_fin.cf47f0d4','Điểm hòa vốn tháng (gồm lương &amp; OPEX)'):'Điểm hòa vốn tháng (gồm lương &amp; OPEX)'}</span>
                            <span class="font-mono font-bold text-white">${this.formatMoney(breakeven)} đ</span>
                        </div>
                        <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div class="h-full ${passed ? 'bg-emerald-400' : 'bg-sky-400'}" style="width:${progress}%"></div>
                        </div>
                        <div class="flex items-center justify-between mt-1 text-[11px]">
                            <span class="${passed ? 'text-emerald-400 font-semibold' : 'text-amber-300'}">${passed ? 'Đã vượt điểm hòa vốn' : (window.cnxT?window.cnxT('js.s_fin.4fa5a552','Chưa đạt điểm hòa vốn'):'Chưa đạt điểm hòa vốn')}</span>
                            <span class="font-mono text-slate-400">${progress}%</span>
                        </div>
                    </div>
                `;
            }

            // 4. Doanh thu theo nhóm hàng & thanh toán
            const brEl = document.getElementById('fin-breakdown');
            if (brEl) {
                const cats = (repRes && Array.isArray(repRes.category_breakdown)) ? repRes.category_breakdown : [];
                const pays = (repRes && Array.isArray(repRes.payment_breakdown)) ? repRes.payment_breakdown : [];
                const totalRev = Number(summary.revenue) || cats.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
                const payLabels = { cash: (window.cnxT?window.cnxT('ui.admin_html.option_7d2970d9','Tiền mặt'):'Tiền mặt'), banking: (window.cnxT?window.cnxT('js.s_fin.2068f044','Chuyển khoản / VietQR'):'Chuyển khoản / VietQR'), transfer: (window.cnxT?window.cnxT('js.s_fin.7ad8f661','Chuyển khoản / QR'):'Chuyển khoản / QR'), qr: 'VietQR', card: (window.cnxT?window.cnxT('js.s_fin.2879c570','Thẻ POS'):'Thẻ POS'), momo: (window.cnxT?window.cnxT('js.s_fin.19b517cd','Ví MoMo'):'Ví MoMo'), debt: (window.cnxT?window.cnxT('js.s_fin.a455c187','Ghi nợ'):'Ghi nợ') };

                let html = '';
                if (cats.length === 0 && pays.length === 0) {
                    html = (window.cnxT?window.cnxT('js.s_fin.da4ae4ef','<div class="text-xs text-slate-400 py-4 text-center italic">Chưa có doanh thu phát sinh trong tháng này</div>'):'<div class="text-xs text-slate-400 py-4 text-center italic">Chưa có doanh thu phát sinh trong tháng này</div>');
                } else {
                    if (cats.length > 0) {
                        html += (window.cnxT?window.cnxT('js.s_fin.f316b9ac','<div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Theo nhóm hàng</div>'):'<div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Theo nhóm hàng</div>');
                        cats.slice(0, 6).forEach(c => {
                            const rev = Number(c.revenue) || 0;
                            const pct = totalRev > 0 ? Math.round((rev / totalRev) * 100) : 0;
                            html += `
                                <div class="py-1 border-b border-white/5">
                                    <div class="flex items-center justify-between">
                                        <span class="text-slate-200">${c.category} <span class="text-slate-500">(${c.qty} món)</span></span>
                                        <span class="font-mono font-bold text-emerald-400">${this.formatMoney(rev)} đ <span class="text-[10px] text-slate-400">(${pct}%)</span></span>
                                    </div>
                                </div>
                            `;
                        });
                    }
                    if (pays.length > 0) {
                        html += (window.cnxT?window.cnxT('js.s_fin.6be875af','<div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2.5 mb-1">Theo thanh toán</div>'):'<div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2.5 mb-1">Theo thanh toán</div>');
                        pays.forEach(p => {
                            const mName = payLabels[(p.method || '').toLowerCase()] || p.method || (window.cnxT?window.cnxT('ui.admin_html.option_cd0ec881','Khác'):'Khác');
                            html += `
                                <div class="flex items-center justify-between py-1 border-b border-white/5">
                                    <span class="text-slate-300">${mName} (${p.orders} đơn)</span>
                                    <span class="font-mono font-bold text-sky-300">${this.formatMoney(p.revenue)} đ</span>
                                </div>
                            `;
                        });
                    }
                }
                brEl.innerHTML = html;
            }

            // 5. Bảng So Sánh P&L Nhiều Tháng (3 tháng liên tiếp)
            const cmpHead = document.getElementById('fin-pnl-compare-thead');
            const cmpBody = document.getElementById('fin-pnl-compare-tbody');
            if (cmpHead && cmpBody && pnlCmpRes && Array.isArray(pnlCmpRes.months) && pnlCmpRes.months.length === 3) {
                const [m2, m1, m0] = pnlCmpRes.months;
                cmpHead.innerHTML = `
                    <tr>
                        <th>${window.cnxT?window.cnxT('js.s_fin.0cebdea4','Chỉ tiêu P&amp;L'):'Chỉ tiêu P&amp;L'}</th>
                        <th class="col-right">${m2.label}</th>
                        <th class="col-right">${m1.label}</th>
                        <th class="col-right text-teal-300">${m0.label} (Kỳ chọn)</th>
                        <th class="col-right">Biến động vs ${m1.label}</th>
                    </tr>
                `;
                const rowsDef = [
                    { label: (window.cnxT?window.cnxT('js.s_fin.b990b94b','Số đơn hoàn tất'):'Số đơn hoàn tất'), key: 'order_count', isCount: true, goodUp: true },
                    { label: (window.cnxT?window.cnxT('js.s_fin.7010a252','Doanh thu thuần'):'Doanh thu thuần'), key: 'revenue', bold: true, cls: 'text-emerald-300', goodUp: true },
                    { label: (window.cnxT?window.cnxT('js.s_fin.861a5b80','(-) Giá vốn hàng bán (COGS)'):'(-) Giá vốn hàng bán (COGS)'), key: 'cogs', cls: 'text-amber-300', goodUp: false },
                    { label: (window.cnxT?window.cnxT('js.s_fin.82b9162a','(=) Lợi nhuận gộp'):'(=) Lợi nhuận gộp'), key: 'gross_profit', bold: true, cls: 'text-sky-300', goodUp: true },
                    { label: (window.cnxT?window.cnxT('js.s_fin.539a841a','Biên lợi nhuận gộp (%)'):'Biên lợi nhuận gộp (%)'), key: 'gross_margin_pct', isPct: true, goodUp: true },
                    { label: (window.cnxT?window.cnxT('js.s_fin.cc39985b','(-) Lương &amp; Thưởng nhân sự'):'(-) Lương &amp; Thưởng nhân sự'), key: 'total_labor', cls: 'text-purple-300', goodUp: false },
                    { label: (window.cnxT?window.cnxT('js.s_fin.6916fdac','(-) Chi phí vận hành (OPEX)'):'(-) Chi phí vận hành (OPEX)'), key: 'opex_expenses', cls: 'text-amber-400', goodUp: false },
                    { label: (window.cnxT?window.cnxT('js.s_fin.00b1e921','(-) Chi quầy &amp; Hao hụt / Lệch két'):'(-) Chi quầy &amp; Hao hụt / Lệch két'), key: 'loss_shortage', cls: 'text-rose-300', goodUp: false },
                    { label: (window.cnxT?window.cnxT('js.s_fin.f66de063','(=) Lợi nhuận ròng (Net Profit)'):'(=) Lợi nhuận ròng (Net Profit)'), key: 'net_profit', bold: true, isNet: true, goodUp: true },
                    { label: (window.cnxT?window.cnxT('js.s_fin.c83e471c','Biên lợi nhuận ròng (%)'):'Biên lợi nhuận ròng (%)'), key: 'net_margin_pct', isPct: true, goodUp: true }
                ];
                cmpBody.innerHTML = rowsDef.map(r => {
                    const fmt = (val) => {
                        if (r.isCount) return `${Number(val || 0)} ${window.cnxT?window.cnxT('js.m_sa.61abc818','đơn'):'đơn'}`;
                        if (r.isPct) return `${Number(val || 0).toFixed(1)}%`;
                        return `${this.formatMoney(val || 0)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;
                    };
                    const v2 = Number(m2[r.key] || 0);
                    const v1 = Number(m1[r.key] || 0);
                    const v0 = Number(m0[r.key] || 0);
                    let momHtml = '<span class="text-slate-500">-</span>';
                    if (v1 !== 0 || v0 !== 0) {
                        if (r.isPct) {
                            const diff = v0 - v1;
                            const good = r.goodUp ? diff >= 0 : diff <= 0;
                            momHtml = `<span class="${good ? 'text-emerald-400' : 'text-rose-400'} font-mono font-bold">${diff >= 0 ? '▲ +' : '▼ '}${diff.toFixed(1)}%</span>`;
                        } else if (v1 !== 0) {
                            const pct = ((v0 - v1) / Math.abs(v1)) * 100;
                            const good = r.goodUp ? pct >= 0 : pct <= 0;
                            momHtml = `<span class="${good ? 'text-emerald-400' : 'text-rose-400'} font-mono font-bold">${pct >= 0 ? '▲ +' : '▼ '}${pct.toFixed(1)}%</span>`;
                        } else {
                            momHtml = `<span class="text-sky-300 font-mono text-[11px]">${window.cnxT?window.cnxT('js.s_fin.6b86779e','Mới phát sinh'):'Mới phát sinh'}</span>`;
                        }
                    }
                    const c0 = r.isNet ? (v0 >= 0 ? 'text-emerald-400' : 'text-rose-400') : (r.cls || 'text-white');
                    return `
                        <tr class="${r.bold ? 'bg-white/[0.02] font-semibold' : ''} hover:bg-white/[0.03] transition-colors">
                            <td class="text-xs ${r.bold ? 'text-white font-bold' : 'text-slate-300'}">${r.label}</td>
                            <td class="col-right font-mono text-xs text-slate-400">${fmt(v2)}</td>
                            <td class="col-right font-mono text-xs text-slate-300">${fmt(v1)}</td>
                            <td class="col-right font-mono text-xs font-bold ${c0}">${fmt(v0)}</td>
                            <td class="col-right text-xs">${momHtml}</td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (e) {
            console.error('Error loading finance:', e);
        }
    },

    _pendingSystemUpdate: null,

    _lastMasterCheckAt: 0,

    async loadSystemUpdates() {
        try {
            const res = await fetch('/api/system/updates');
            const data = await res.json();
            if (!data.success) return;
            const verPill = document.getElementById('store-app-version-pill');
            if (verPill && data.applied_version) {
                verPill.textContent = `v${data.applied_version}`;
            }
            const banner = document.getElementById('system-update-banner');
            const titleEl = document.getElementById('sys-upd-title');
            const msgEl = document.getElementById('sys-upd-msg');
            const applyBtn = document.getElementById('sys-upd-apply-btn');
            const dotEl = document.getElementById('admin-update-dot');
            const badgeEl = document.getElementById('admin-update-badge');

            // Chỉ hiển thị thông báo văn bản (SYSTEM_NOTIFY) trên Web; OTA Update chỉ hiển thị & thực hiện tại Control Center
            const unread = Array.isArray(data.notifications)
                ? data.notifications.find(n => Number(n.is_read) === 0 && n.type === 'SYSTEM_NOTIFY')
                : null;
            const hasAlert = Boolean(unread);
            this._pendingSystemUpdate = hasAlert ? {
                isOta: false,
                version: unread.version || '',
                title: unread.title || (window.cnxT?window.cnxT('js.s_fin.23db4bad','Thông báo từ Master'):'Thông báo từ Master'),
                message: unread.message || ''
            } : null;

            if (dotEl) dotEl.classList.toggle('hidden', !hasAlert);
            if (badgeEl) {
                badgeEl.title = hasAlert
                    ? `${this._pendingSystemUpdate.title}`
                    : (window.cnxT?window.cnxT('js.s_fin.e7e3cfbd','Chủ Quán (Admin) • Cập nhật OTA thực hiện tại CyberNexus Control Center'):'Chủ Quán (Admin) • Cập nhật OTA thực hiện tại CyberNexus Control Center');
            }
            if (!banner) return;

            if (hasAlert) {
                banner.classList.remove('hidden');
                if (titleEl) titleEl.textContent = this._pendingSystemUpdate.title;
                if (msgEl) msgEl.textContent = this._pendingSystemUpdate.message;
                if (applyBtn) applyBtn.classList.add('hidden');
            } else {
                banner.classList.add('hidden');
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_finance_ecr.js', e) : console.debug('admin_finance_ecr.js', e)); }
    },

    async handleAdminBadgeUpdateClick(btn) {
        await this.loadSystemUpdates();
        if (this._pendingSystemUpdate) {
            const banner = document.getElementById('system-update-banner');
            if (banner) banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
            alert(`${this._pendingSystemUpdate.title}\n${this._pendingSystemUpdate.message}`);
            return;
        }
        alert((window.cnxT?window.cnxT('js.s_fin.15affead','Việc kiểm tra và cập nhật phiên bản OTA được thực hiện tại ứng dụng CyberNexus Control Center.'):'Việc kiểm tra và cập nhật phiên bản OTA được thực hiện tại ứng dụng CyberNexus Control Center.'));
    },

    async applySystemUpdate(btn) {
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_fin.c6d233ab','Tải bản vá mới từ Master và chép đè lên hệ thống Store hiện tại?'):'Tải bản vá mới từ Master và chép đè lên hệ thống Store hiện tại?')))) return;
        const orig = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = (window.cnxT?window.cnxT('js.s_fin.1d3b9b13','<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...'):'<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...'); }
        try {
            const res = await fetch('/api/system/updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'apply' })
            });
            const data = await res.json();
            alert(data.message || (data.success ? 'Cập nhật thành công!' : (window.cnxT?window.cnxT('js.s_fin.19b7b7e7','Cập nhật thất bại!'):'Cập nhật thất bại!')));
            if (data.success) {
                await this.dismissSystemUpdate();
                if (data.restarting) {
                    setTimeout(() => window.location.reload(), 4500);
                } else {
                    window.location.reload();
                }
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.s_fin.f3899db3','Lỗi cập nhật: '):'Lỗi cập nhật: ') + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = orig; }
        }
    },

    async dismissSystemUpdate() {
        try {
            await fetch('/api/system/updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'dismiss' })
            });
            const banner = document.getElementById('system-update-banner');
            if (banner) banner.classList.add('hidden');
            const dotEl = document.getElementById('admin-update-dot');
            if (dotEl) dotEl.classList.add('hidden');
            this._pendingSystemUpdate = null;
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_finance_ecr.js', e) : console.debug('admin_finance_ecr.js', e)); }
    },

    _licensedModules: null,
    _blockedModules: [],

    isModuleAllowed(modCode) {
        const stripped = modCode.startsWith('mod_') ? modCode.slice(4) : modCode;
        if (stripped === 'pos_core' || stripped === 'finance_admin') return true;
        if (!this._licensedModules) return false;
        if (this._blockedModules.includes(modCode) || this._blockedModules.includes(stripped)) return false;
        return this._licensedModules.includes(modCode) || this._licensedModules.includes(stripped) || this._licensedModules.includes('mod_' + stripped);
    },

    applySubviewLicenseLock(subtab, modCode, allowed) {
        const subview = document.getElementById(`ops-subview-${subtab}`);
        if (!subview) return;
        let lockOverlay = subview.querySelector('.cn-module-lock-screen');
        if (!allowed) {
            if (!lockOverlay) {
                lockOverlay = document.createElement('div');
                lockOverlay.className = 'cn-module-lock-screen p-10 text-center rounded-2xl border border-rose-500/30 bg-rose-950/20 my-4';
                lockOverlay.innerHTML = `
                    <i class="fas fa-lock text-4xl text-rose-400 mb-3"></i>
                    <div class="text-base font-bold text-white">${window.cnxT?window.cnxT('js.s_fin.6a28eefe','Module chưa được cấp phép hoặc đã bị Master tắt/khóa'):'Module chưa được cấp phép hoặc đã bị Master tắt/khóa'}</div>
                    <div class="text-xs text-slate-400 mt-1">${window.cnxT?window.cnxT('js.s_fin.ab007c49','Mã module:'):'Mã module:'} <span class="font-mono text-rose-300">${modCode}</span> ${window.cnxT?window.cnxT('js.s_fin.d79360a9','• Vui lòng bật lại trên Máy chủ Master SaaS.'):'• Vui lòng bật lại trên Máy chủ Master SaaS.'}</div>
                `;
                subview.prepend(lockOverlay);
            }
            Array.from(subview.children).forEach(ch => {
                if (!ch.classList.contains('cn-module-lock-screen')) ch.classList.add('hidden');
            });
        } else {
            if (lockOverlay) lockOverlay.remove();
            Array.from(subview.children).forEach(ch => ch.classList.remove('hidden'));
        }
    },

    async enforceModuleLicenses(forceSync = false) {
        try {
            if (forceSync) {
                await fetch('/api/license_client.php?action=sync_now').catch((errIgnored) => { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_finance_ecr.js', errIgnored) : console.debug('admin_finance_ecr.js', errIgnored)); });
            }
            const res = await fetch('/api/license.php?action=status');
            const json = await res.json();
            if (!json.success || !json.data) return;
            this._licensedModules = Array.isArray(json.data.modules) ? json.data.modules : [];
            this._blockedModules = Array.isArray(json.data.blocked_modules) ? json.data.blocked_modules : [];

            const tabModuleMap = {
                media: 'mod_media_stream',
                users: 'staff_shifts',
                analytics: 'advanced_reports',
                finance: 'finance_reports'
            };

            // Lock/unlock sub-tabs, HR/Menu nav buttons, subviews & header links
            const subTabMap = [
                { sel: '#ops-subtab-inventory', code: 'inventory_recipes', allowClickForLockScreen: true },
                { sel: '.admin-sub-btn[data-tab="operations"]', code: 'inventory_recipes', allowClickForLockScreen: true },
                { sel: '#ops-subtab-payroll', code: 'staff_shifts', allowClickForLockScreen: true },
                { sel: '#subnav-hr .admin-sub-btn[data-hr-subtab="payroll"]', code: 'staff_shifts', allowClickForLockScreen: true },
                { sel: '#ops-subtab-kpi', code: 'staff_kpi', allowClickForLockScreen: true },
                { sel: '#subnav-hr .admin-sub-btn[data-hr-subtab="kpi"]', code: 'staff_kpi', allowClickForLockScreen: true },
                { sel: 'a[href*="kitchen.html"]', code: 'kitchen_kds', allowClickForLockScreen: false },
                { sel: 'a[href*="customer.html"]', code: 'qr_customer_order', allowClickForLockScreen: false },
                { sel: '#btn-trigger-ai-scan', code: 'ai_invoice_ocr', allowClickForLockScreen: false },
                { sel: '[onclick*="openCloudSyncModal"]', code: 'cloud_sync_backup', allowClickForLockScreen: false },
                { sel: '#ad-save-btn, [onclick*="saveAdvertising"]', code: 'advertising_promotions', allowClickForLockScreen: false },
                { sel: '#promo-engine-card', code: 'promo_voucher_engine', allowClickForLockScreen: false },
                { sel: '[data-sg-btn="vietqr"]', code: 'vietqr_payment', allowClickForLockScreen: false },
                { sel: '#admin-card-payment-panel', code: 'mod_card_payment', allowClickForLockScreen: false }
            ];
            subTabMap.forEach(({ sel, code }) => {
                const allowed = this.isModuleAllowed(code);
                document.querySelectorAll(sel).forEach(el => {
                    if (sel === '.admin-sub-btn[data-tab="operations"]') return;
                    el.style.display = allowed ? '' : 'none';
                });
            });

            this.applySubviewLicenseLock('inventory', 'inventory_recipes', this.isModuleAllowed('inventory_recipes'));
            this.applySubviewLicenseLock('payroll', 'staff_shifts', this.isModuleAllowed('staff_shifts'));
            this.applySubviewLicenseLock('kpi', 'staff_kpi', this.isModuleAllowed('staff_kpi'));

            Object.entries(tabModuleMap).forEach(([tab, modCode]) => {
                const allowed = this.isModuleAllowed(modCode);
                document.querySelectorAll(`.admin-sub-btn[data-tab="${tab}"], [data-mobile-tab="${tab}"]`).forEach(btn => {
                    btn.style.display = allowed ? '' : 'none';
                });
                const section = document.getElementById(`tab-${tab}`);
                if (section) {
                    let lockOverlay = section.querySelector('.cn-module-lock-screen');
                    if (!allowed) {
                        if (!lockOverlay) {
                            lockOverlay = document.createElement('div');
                            lockOverlay.className = 'cn-module-lock-screen p-10 text-center rounded-2xl border border-rose-500/30 bg-rose-950/20 my-4';
                            lockOverlay.innerHTML = `
                                <i class="fas fa-lock text-4xl text-rose-400 mb-3"></i>
                                <div class="text-base font-bold text-white">${window.cnxT?window.cnxT('js.s_fin.6a28eefe','Module chưa được cấp phép hoặc đã bị Master tắt/khóa'):'Module chưa được cấp phép hoặc đã bị Master tắt/khóa'}</div>
                                <div class="text-xs text-slate-400 mt-1">${window.cnxT?window.cnxT('js.s_fin.ab007c49','Mã module:'):'Mã module:'} <span class="font-mono text-rose-300">${modCode}</span> ${window.cnxT?window.cnxT('js.s_fin.d79360a9','• Vui lòng bật lại trên Máy chủ Master SaaS.'):'• Vui lòng bật lại trên Máy chủ Master SaaS.'}</div>
                            `;
                            section.prepend(lockOverlay);
                        }
                        Array.from(section.children).forEach(ch => {
                            if (!ch.classList.contains('cn-module-lock-screen')) ch.classList.add('hidden');
                        });
                    } else {
                        if (lockOverlay) lockOverlay.remove();
                        Array.from(section.children).forEach(ch => ch.classList.remove('hidden'));
                    }
                }
            });

            const mediaAllowed = this.isModuleAllowed('mod_media_stream');
            const jukePill = document.getElementById('admin-jukebox-pill');
            if (jukePill) jukePill.style.display = mediaAllowed ? 'flex' : 'none';
            document.querySelectorAll('button[onclick*="switchTab(\'media\')"]').forEach(btn => {
                btn.style.display = mediaAllowed ? '' : 'none';
            });
            const mediaTab = document.getElementById('tab-content-media');
            if (mediaTab) mediaTab.style.display = mediaAllowed ? '' : 'none';
            if (!mediaAllowed && typeof JukeboxPlayer !== 'undefined' && JukeboxPlayer.audio && !JukeboxPlayer.audio.paused) {
                JukeboxPlayer.audio.pause();
            }
            if (typeof Admin !== 'undefined' && Admin.currentTab && tabModuleMap[Admin.currentTab] && !this.isModuleAllowed(tabModuleMap[Admin.currentTab])) {
                Admin.switchGroup(Admin.currentGroup || 'ops');
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_finance_ecr.js', e) : console.debug('admin_finance_ecr.js', e)); }
    },

    async deleteFinanceExpense(id) {
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_fin.877562a1','Bạn có chắc muốn xóa khoản chi này không?'):'Bạn có chắc muốn xóa khoản chi này không?')))) return;
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
                alert(data.message || (window.cnxT?window.cnxT('js.s_fin.5cf907ce','Lỗi xóa khoản chi'):'Lỗi xóa khoản chi'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.5b983751','Lỗi: '):'Lỗi: ') + e.message);
        }
    },

    async verifyAndSaveGeminiKey(btn) {
        const keyInput = document.getElementById('setting-gemini-api-key');
        const keyVal = keyInput ? keyInput.value.trim() : '';
        if (!keyVal) {
            alert((window.cnxT?window.cnxT('js.m_sa_ext.6d23c4a6','Vui lòng dán mã Gemini API Key trước khi kiểm tra!'):'Vui lòng dán mã Gemini API Key trước khi kiểm tra!'));
            return;
        }
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = (window.cnxT?window.cnxT('js.m_sa_ext.4ea607b8','<i class="fas fa-spinner fa-spin mr-1"></i> Đang kiểm tra...'):'<i class="fas fa-spinner fa-spin mr-1"></i> Đang kiểm tra...');
        }
        try {
            const res = await fetch('/api/ai/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gemini_api_key: keyVal, save_on_success: true })
            });
            const data = await res.json();
            if (data.success) {
                if (keyInput) {
                    keyInput.type = 'password';
                    keyInput.value = '';
                }
                const cfgBox = document.getElementById('gemini-status-configured');
                const uncfgBox = document.getElementById('gemini-status-unconfigured');
                const inputBox = document.getElementById('gemini-key-input-box');
                const btnToggle = document.getElementById('btn-toggle-gemini-edit');
                if (cfgBox) cfgBox.classList.remove('hidden');
                if (uncfgBox) uncfgBox.classList.add('hidden');
                if (inputBox) inputBox.classList.add('hidden');
                if (btnToggle) btnToggle.classList.remove('hidden');
                alert(data.message || (window.cnxT?window.cnxT('js.s_fin.30be4ee0','Kiểm tra thành công! Key đã được lưu và ẩn bảo mật.'):'Kiểm tra thành công! Key đã được lưu và ẩn bảo mật.'));
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_fin.9a6d7db4','API Key không hợp lệ!'):'API Key không hợp lệ!'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.s_fin.87b511c9','Lỗi kiểm tra API Key: '):'Lỗi kiểm tra API Key: ') + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
        }
    },

    async deleteLocalGeminiKey() {
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_fin.f348a23e','Xóa Gemini API Key dự phòng tại quán để chuyển sang dùng CyberNexus Master AI Proxy?'):'Xóa Gemini API Key dự phòng tại quán để chuyển sang dùng CyberNexus Master AI Proxy?')))) return;
        try {
            const token = localStorage.getItem('pos_token') || '';
            const res = await fetch('api/settings.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': 'Bearer ' + token } : {})
                },
                body: JSON.stringify({ gemini_api_key: '__DELETE__' })
            });
            const data = await res.json();
            if (data.success) {
                const cfgBox = document.getElementById('gemini-status-configured');
                const uncfgBox = document.getElementById('gemini-status-unconfigured');
                const inputBox = document.getElementById('gemini-key-input-box');
                if (cfgBox) cfgBox.classList.add('hidden');
                if (uncfgBox) uncfgBox.classList.remove('hidden');
                if (inputBox) inputBox.classList.add('hidden');
                alert((window.cnxT?window.cnxT('js.s_fin.cd5e7c6d','Đã xóa Key dự phòng tại quán! Hệ thống đã chuyển sang dùng CyberNexus Master AI Proxy.'):'Đã xóa Key dự phòng tại quán! Hệ thống đã chuyển sang dùng CyberNexus Master AI Proxy.'));
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_fin.bf893be2','Không thể xóa Key!'):'Không thể xóa Key!'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.e5f87ad3','Lỗi kết nối: '):'Lỗi kết nối: ') + e.message);
        }
    },

    async markExpensePaid(id) {
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_fin.305c20f6','Xác nhận đã thanh toán khoản công nợ nhà cung cấp này?'):'Xác nhận đã thanh toán khoản công nợ nhà cung cấp này?')))) return;
        try {
            const res = await fetch('api/finance.php?action=mark_expense_paid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) this.loadFinance();
            else alert(data.message || (window.cnxT?window.cnxT('js.s_fin.1919b0a0','Không thể cập nhật'):'Không thể cập nhật'));
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.5b983751','Lỗi: '):'Lỗi: ') + e.message);
        }
    },

    openFinExpenseModal() {
        let modal = document.getElementById('fin-dynamic-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'fin-dynamic-modal';
            modal.className = 'fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4';
            document.body.appendChild(modal);
        }
        const today = new Date().toISOString().slice(0, 10);
        modal.innerHTML = `
            <div class="liquid-glass rounded-2xl border border-teal-500/30 w-full max-w-md p-5 space-y-3 bg-slate-900/95">
                <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <h4 class="font-bold text-sm text-teal-300"><i class="fas fa-file-invoice-dollar mr-1.5"></i>${window.cnxT?window.cnxT('js.s_fin.2892ea60','Ghi nhận Chi Phí / Công Nợ NCC'):'Ghi nhận Chi Phí / Công Nợ NCC'}</h4>
                    <button type="button" onclick="document.getElementById('fin-dynamic-modal').remove()" class="text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                </div>
                <div class="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                        <label class="text-slate-400 block mb-1">${window.cnxT?window.cnxT('js.s_fin.987c8eda','Ngày phát sinh'):'Ngày phát sinh'}</label>
                        <input id="fin-exp-date" type="date" value="${today}" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white" />
                    </div>
                    <div>
                        <label class="text-slate-400 block mb-1">${window.cnxT?window.cnxT('js.s_fin.80efe98a','Phân loại chi phí'):'Phân loại chi phí'}</label>
                        <select id="fin-exp-cat" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white">
                            <option value="Mặt Bằng">${window.cnxT?window.cnxT('js.s_fin.a089d2c9','Mặt Bằng'):'Mặt Bằng'}</option>
                            <option value="Điện Nước & Internet">${window.cnxT?window.cnxT('js.s_fin.6fe4cf5a','Điện Nước & Internet'):'Điện Nước & Internet'}</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Vận Hành & Vật Tư">${window.cnxT?window.cnxT('js.s_fin.20cc1c35','Vận Hành & Vật Tư'):'Vận Hành & Vật Tư'}</option>
                            <option value="Thưởng & Phụ Cấp">${window.cnxT?window.cnxT('js.s_fin.ac763a40','Thưởng & Phụ Cấp'):'Thưởng & Phụ Cấp'}</option>
                            <option value="Nguyên Vật Liệu">${window.cnxT?window.cnxT('ui.admin_html.th_1c7cbcda','Nguyên Vật Liệu'):'Nguyên Vật Liệu'}</option>
                            <option value="Khác">${window.cnxT?window.cnxT('ui.admin_html.option_cd0ec881','Khác'):'Khác'}</option>
                        </select>
                    </div>
                </div>
                <div class="text-xs">
                    <label class="text-slate-400 block mb-1">${window.cnxT?window.cnxT('js.s_fin.80d76c19','Nội dung chi / Hạng mục'):'Nội dung chi / Hạng mục'}</label>
                    <input id="fin-exp-desc" type="text" placeholder="VD: Tiền thuê mặt bằng T11, Thưởng KPI..." class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white" />
                </div>
                <div class="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                        <label class="text-slate-400 block mb-1">${window.cnxT?window.cnxT('js.s_fin.bd3c049a','Nhà cung cấp / Người nhận'):'Nhà cung cấp / Người nhận'}</label>
                        <input id="fin-exp-sup" type="text" placeholder="VD: Điện lực EVN, NCC A..." class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white" />
                    </div>
                    <div>
                        <label class="text-slate-400 block mb-1">${window.cnxT?window.cnxT('js.s_fin.8c865c7d','Trạng thái thanh toán'):'Trạng thái thanh toán'}</label>
                        <select id="fin-exp-status" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white">
                            <option value="paid">${window.cnxT?window.cnxT('js.s_fin.e7a2238e','Đã thanh toán ngay'):'Đã thanh toán ngay'}</option>
                            <option value="unpaid">${window.cnxT?window.cnxT('js.s_fin.296ab0a7','Ghi nhận Công nợ phải trả'):'Ghi nhận Công nợ phải trả'}</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                        <label class="text-slate-400 block mb-1">${window.cnxT?window.cnxT('ui.admin_html.option_89dfad29','Số tiền (VNĐ)'):'Số tiền (VNĐ)'}</label>
                        <input id="fin-exp-amt" type="number" min="0" placeholder="0" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-amber-300 font-mono font-bold" />
                    </div>
                    <div>
                        <label class="text-slate-400 block mb-1">${window.cnxT?window.cnxT('js.s_fin.93977357','VAT đầu vào (VNĐ)'):'VAT đầu vào (VNĐ)'}</label>
                        <input id="fin-exp-vat" type="number" min="0" value="0" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-emerald-300 font-mono" />
                    </div>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-white/10">
                    <button type="button" onclick="document.getElementById('fin-dynamic-modal').remove()" class="btn-glass text-xs py-1.5 px-3 bg-slate-800 text-slate-300">${window.cnxT?window.cnxT('ui.admin_html.button_d7d5c86c','Hủy'):'Hủy'}</button>
                    <button type="button" onclick="Admin.submitFinExpense()" class="btn-glass text-xs py-1.5 px-4 bg-teal-500/30 text-teal-200 border-teal-400/40 font-bold">${window.cnxT?window.cnxT('js.s_fin.02dd968e','Lưu khoản chi'):'Lưu khoản chi'}</button>
                </div>
            </div>
        `;
    },

    async submitFinExpense() {
        const payload = {
            expense_date: document.getElementById('fin-exp-date')?.value || '',
            category: document.getElementById('fin-exp-cat')?.value || (window.cnxT?window.cnxT('ui.admin_html.option_cd0ec881','Khác'):'Khác'),
            description: document.getElementById('fin-exp-desc')?.value?.trim() || '',
            supplier: document.getElementById('fin-exp-sup')?.value?.trim() || '',
            payment_status: document.getElementById('fin-exp-status')?.value || 'paid',
            amount: Number(document.getElementById('fin-exp-amt')?.value || 0),
            vat_amount: Number(document.getElementById('fin-exp-vat')?.value || 0)
        };
        if (!payload.amount || payload.amount <= 0) {
            alert((window.cnxT?window.cnxT('js.s_fin.85c5909e','Vui lòng nhập số tiền lớn hơn 0!'):'Vui lòng nhập số tiền lớn hơn 0!'));
            return;
        }
        try {
            const res = await fetch('api/finance.php?action=save_expense', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('fin-dynamic-modal')?.remove();
                this.loadFinance();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_fin.0448bf3c','Lỗi lưu khoản chi'):'Lỗi lưu khoản chi'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.5b983751','Lỗi: '):'Lỗi: ') + e.message);
        }
    },

    async openFinTaxModal() {
        let cfg = {
            pos_vat_mode: 'none',
            pos_vat_rate: '8',
            finance_tax_method: 'household',
            finance_vat_rate: '8',
            finance_pit_rate: '1.5',
            finance_cit_rate: '20',
            finance_fixed_cost: '0'
        };
        try {
            const res = await fetch('api/finance.php?action=get_tax_settings').then(r => r.json());
            if (res && res.success && res.data) cfg = { ...cfg, ...res.data };
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_finance_ecr.js', e) : console.debug('admin_finance_ecr.js', e)); }

        let modal = document.getElementById('fin-dynamic-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'fin-dynamic-modal';
            modal.className = 'fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="liquid-glass rounded-2xl border border-amber-500/30 w-full max-w-md p-5 space-y-3 bg-slate-900/95">
                <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <h4 class="font-bold text-sm text-amber-300"><i class="fas fa-percent mr-1.5"></i>Cấu hình Thuế Hóa Đơn (POS) &amp; Tài Chính</h4>
                    <button type="button" onclick="document.getElementById('fin-dynamic-modal').remove()" class="text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                </div>
                <div class="space-y-2.5 text-xs">
                    <div class="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25 space-y-2">
                        <div class="font-bold text-sky-300 text-[11px] uppercase">1. Thuế VAT trên Hóa đơn bán hàng (POS)</div>
                        <div>
                            <label class="text-slate-300 block mb-1">Chế độ áp dụng trên hóa đơn</label>
                            <select id="fin-dyn-vat-mode" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white">
                                <option value="none" ${cfg.pos_vat_mode === 'none' ? 'selected' : ''}>Không thu VAT (0% — Giá niêm yết không tách thuế)</option>
                                <option value="exclusive" ${cfg.pos_vat_mode === 'exclusive' ? 'selected' : ''}>Cộng thêm VAT vào hóa đơn (Khách trả = Tiền hàng + VAT)</option>
                                <option value="inclusive" ${cfg.pos_vat_mode === 'inclusive' ? 'selected' : ''}>Giá bán đã gồm VAT (Tách hiển thị VAT trên bill)</option>
                            </select>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="text-slate-300 block mb-1">Thuế suất VAT hóa đơn (%)</label>
                                <input id="fin-dyn-pos-vat-rate" type="number" min="0" max="20" step="0.5" value="${cfg.pos_vat_rate}" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white font-mono" />
                            </div>
                            <div class="flex items-end gap-1 pb-0.5">
                                <button type="button" onclick="document.getElementById('fin-dyn-pos-vat-rate').value='0'" class="btn-glass px-2 py-1 text-[10px]">0%</button>
                                <button type="button" onclick="document.getElementById('fin-dyn-pos-vat-rate').value='5'" class="btn-glass px-2 py-1 text-[10px]">5%</button>
                                <button type="button" onclick="document.getElementById('fin-dyn-pos-vat-rate').value='8'" class="btn-glass px-2 py-1 text-[10px] text-amber-300">8%</button>
                                <button type="button" onclick="document.getElementById('fin-dyn-pos-vat-rate').value='10'" class="btn-glass px-2 py-1 text-[10px]">10%</button>
                            </div>
                        </div>
                    </div>
                    <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                        <div class="font-bold text-amber-300 text-[11px] uppercase">2. Thuế dự kiến Báo cáo Tài chính</div>
                        <div>
                            <label class="text-slate-300 block mb-1">Mô hình kinh doanh</label>
                            <select id="fin-dyn-tax-method" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white">
                                <option value="household" ${cfg.finance_tax_method !== 'enterprise' ? 'selected' : ''}>Hộ kinh doanh (GTGT + TNCN theo doanh thu)</option>
                                <option value="enterprise" ${cfg.finance_tax_method === 'enterprise' ? 'selected' : ''}>Doanh nghiệp (VAT khấu trừ + TNDN)</option>
                            </select>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <div>
                                <label class="text-slate-400 block mb-1">GTGT (%)</label>
                                <input id="fin-dyn-vat" type="number" min="0" max="20" step="0.1" value="${cfg.finance_vat_rate}" class="liquid-input w-full py-1.5 px-2 bg-slate-950 text-white font-mono" />
                            </div>
                            <div>
                                <label class="text-slate-400 block mb-1">TNCN (%)</label>
                                <input id="fin-dyn-pit" type="number" min="0" max="20" step="0.1" value="${cfg.finance_pit_rate}" class="liquid-input w-full py-1.5 px-2 bg-slate-950 text-white font-mono" />
                            </div>
                            <div>
                                <label class="text-slate-400 block mb-1">TNDN (%)</label>
                                <input id="fin-dyn-cit" type="number" min="0" max="50" step="0.5" value="${cfg.finance_cit_rate}" class="liquid-input w-full py-1.5 px-2 bg-slate-950 text-white font-mono" />
                            </div>
                        </div>
                        <div>
                            <label class="text-slate-400 block mb-1">Định phí dự phòng tháng (VNĐ)</label>
                            <input id="fin-dyn-fixed" type="number" step="10000" value="${cfg.finance_fixed_cost}" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white font-mono" />
                        </div>
                    </div>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-white/10">
                    <button type="button" onclick="document.getElementById('fin-dynamic-modal').remove()" class="btn-glass text-xs py-1.5 px-3 bg-slate-800 text-slate-300">Hủy</button>
                    <button type="button" onclick="Admin.submitFinTax()" class="btn-glass text-xs py-1.5 px-4 bg-amber-500/30 text-amber-200 border-amber-400/40 font-bold">Lưu cấu hình</button>
                </div>
            </div>
        `;
    },

    async submitFinTax() {
        const mode = document.getElementById('fin-dyn-vat-mode')?.value || 'none';
        const posRate = document.getElementById('fin-dyn-pos-vat-rate')?.value;
        const payload = {
            pos_vat_mode: mode,
            pos_vat_rate: (posRate !== undefined && posRate !== '') ? String(posRate) : '0',
            finance_tax_method: document.getElementById('fin-dyn-tax-method')?.value || 'household',
            finance_vat_rate: document.getElementById('fin-dyn-vat')?.value ?? '8',
            finance_pit_rate: document.getElementById('fin-dyn-pit')?.value ?? '1.5',
            finance_cit_rate: document.getElementById('fin-dyn-cit')?.value ?? '20',
            finance_fixed_cost: document.getElementById('fin-dyn-fixed')?.value ?? '0'
        };
        try {
            const res = await fetch('api/finance.php?action=save_tax_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('fin-dynamic-modal')?.remove();
                if (typeof this.showToast === 'function') this.showToast(data.message || 'Đã lưu cấu hình thuế!', 'success');
                this.loadFinance();
            } else {
                alert(data.message || 'Lỗi lưu cấu hình thuế');
            }
        } catch (e) {
            alert('Lỗi: ' + e.message);
        }
    },

    exportFinanceCsv() {
        const rep = this._lastFinanceReport;
        if (!rep || !rep.summary) {
            alert((window.cnxT?window.cnxT('js.s_fin.41ccadf7','Chưa có dữ liệu báo cáo để xuất CSV!'):'Chưa có dữ liệu báo cáo để xuất CSV!'));
            return;
        }
        const s = rep.summary;
        const rows = [
            ['BAO CAO TAI CHINH KY', `${rep.period_start} den ${rep.period_end}`],
            ['Chi tieu', 'Gia tri (VND)'],
            ['Doanh thu gop', s.gross_sales || 0],
            ['Giam gia / Chiet khau', s.discounts || 0],
            ['Doanh thu thuan', s.revenue || 0],
            ['Doanh thu ban dang mo (Tam tinh)', s.pending_revenue || 0],
            ['Gia von hang ban (COGS)', s.cogs || 0],
            ['Loi nhuan gop', s.gross_profit || 0],
            ['Luong cham cong Realtime', s.labor_cost || 0],
            ['Thuong & Phu cap', s.bonus_cost || 0],
            ['Chi phi van hanh (OPEX)', s.opex_expenses || 0],
            ['Chi tai quay & Hao hut / Lech ket', (s.cash_out_counter || 0) + (s.material_loss_cost || 0) + (s.shortage_loss || 0)],
            ['Loi nhuan rong', s.net_profit || 0],
            ['Cong no phai thu', (s.receivable_amount || 0) + (s.pending_revenue || 0)],
            ['Cong no phai tra NCC', s.payable_debt || 0],
            [],
            ['SO CHI PHI TRONG KY'],
            ['Ngay', 'Loai', 'Noi dung', 'Nha cung cap', 'Trang thai', 'So tien', 'VAT dau vao']
        ];
        (this._lastFinanceExpenses || []).forEach(e => {
            rows.push([
                e.expense_date || '',
                e.category || '',
                (e.description || '').replace(/,/g, ' '),
                (e.supplier || '').replace(/,/g, ' '),
                e.payment_status === 'unpaid' ? 'Cong no' : 'Da thanh toan',
                e.amount || 0,
                e.vat_amount || 0
            ]);
        });
        const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bao_Cao_Tai_Chinh_${rep.month || 'thang'}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },

    // =========================================================
    // CỔNG CÀ THẺ TÍN DỤNG & SMARTPOS (ECR ADAPTER)
    // =========================================================
    cardCompatibleModels: [],

    async loadCardTerminalAdmin() {
        try {
            const res = await fetch('/api/card/status');
            const data = await res.json();
            this.cardCompatibleModels = data.compatible_terminals || [];

            // Update License Badge & Banner
            const licBadge = document.getElementById('ecr-admin-license-badge');
            const lockBanner = document.getElementById('ecr-admin-lock-banner');
            const lockText = document.getElementById('ecr-admin-lock-text');

            if (licBadge) {
                if (data.module_state === 'BLOCKED') {
                    licBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40';
                    licBadge.textContent = 'MODULE: BLOCKED (MASTER)';
                } else if (data.module_state === 'OFF') {
                    licBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40';
                    licBadge.textContent = 'MODULE: OFF';
                } else {
                    licBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                    licBadge.textContent = 'MODULE: ON';
                }
            }

            if (lockBanner && lockText) {
                if (data.module_state === 'BLOCKED') {
                    lockBanner.classList.remove('hidden');
                    lockBanner.className = 'p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2.5';
                    lockText.innerHTML = `<b>${window.cnxT?window.cnxT('js.s_fin.a82b5f9a','LƯU Ý:'):'LƯU Ý:'}</b> ${data.message || (window.cnxT?window.cnxT('js.s_fin.5d39758b','Module Cà thẻ tín dụng đang bị KHÓA CƯỠNG CHẾ bởi Quản trị viên CyberNexus Master.'):'Module Cà thẻ tín dụng đang bị KHÓA CƯỠNG CHẾ bởi Quản trị viên CyberNexus Master.')}`;
                } else if (data.module_state === 'OFF') {
                    lockBanner.classList.remove('hidden');
                    lockBanner.className = 'p-3 rounded-xl bg-amber-950/70 border border-amber-500/50 text-xs text-amber-200 flex items-center gap-2.5';
                    lockText.innerHTML = `<b>${window.cnxT?window.cnxT('js.s_fin.a82b5f9a','LƯU Ý:'):'LƯU Ý:'}</b> ${data.message || (window.cnxT?window.cnxT('js.s_fin.9d046a0e','Module Cà thẻ tín dụng đang ở trạng thái TẮT trên gói bản quyền.'):'Module Cà thẻ tín dụng đang ở trạng thái TẮT trên gói bản quyền.')}`;
                } else {
                    lockBanner.classList.add('hidden');
                }
            }

            // Fill Config Inputs
            const cfg = data.config || {};
            const isSim = Number(cfg.simulation_mode ?? 1) !== 0;
            const simBadge = document.getElementById('ecr-sim-mode-badge');
            if (simBadge) {
                simBadge.classList.toggle('hidden', !isSim);
                simBadge.textContent = typeof window.cnxT === 'function'
                    ? '⚠️ ' + window.cnxT('common.sim_warning', 'CHẾ ĐỘ MÔ PHỎNG — CHƯA NỐI THIẾT BỊ THẬT')
                    : (window.cnxT?window.cnxT('ui.adm_html.span_3fc18a5c','⚠️ CHẾ ĐỘ MÔ PHỎNG — CHƯA NỐI THIẾT BỊ THẬT'):'⚠️ CHẾ ĐỘ MÔ PHỎNG — CHƯA NỐI THIẾT BỊ THẬT');
            }
            const elModel = document.getElementById('ecr-cfg-model-code');
            const elBank = document.getElementById('ecr-cfg-acquirer-bank');
            const elConn = document.getElementById('ecr-cfg-conn-type');
            const elIp = document.getElementById('ecr-cfg-ip');
            const elPort = document.getElementById('ecr-cfg-port');
            const elTid = document.getElementById('ecr-cfg-tid');
            const elMid = document.getElementById('ecr-cfg-mid');
            const elSecret = document.getElementById('ecr-cfg-secret');
            const elSurcharge = document.getElementById('ecr-cfg-surcharge');
            const elSimMode = document.getElementById('ecr-cfg-sim-mode');
            const elSim = document.getElementById('ecr-cfg-sim-behavior');
            const elMasterFee = document.getElementById('ecr-cfg-master-fee-display');

            if (elModel && cfg.model_code) elModel.value = cfg.model_code;
            if (elBank && cfg.acquirer_bank) elBank.value = cfg.acquirer_bank;
            if (elConn && (cfg.connection_type || cfg.connection_mode)) elConn.value = cfg.connection_type || cfg.connection_mode;
            if (elIp && cfg.terminal_ip) elIp.value = cfg.terminal_ip;
            if (elPort && cfg.terminal_port) elPort.value = cfg.terminal_port;
            if (elTid && (cfg.tid || cfg.terminal_id_tid)) elTid.value = cfg.tid || cfg.terminal_id_tid;
            if (elMid && (cfg.mid || cfg.merchant_id_mid)) elMid.value = cfg.mid || cfg.merchant_id_mid;
            if (elSecret && cfg.secret_key) elSecret.value = cfg.secret_key;
            if (elSurcharge) elSurcharge.value = cfg.customer_surcharge_percent ?? 0;
            if (elSimMode) elSimMode.value = isSim ? '1' : '0';
            if (elSim && (cfg.simulation_behavior || cfg.sim_behavior)) elSim.value = cfg.simulation_behavior || cfg.sim_behavior;

            if (elMasterFee) {
                elMasterFee.innerHTML = `<span>${Number(data.master_fee_percent ?? 0)}%</span><span class="text-[9px] text-slate-500">${window.cnxT?window.cnxT('ui.adm_html.span_2708ebb7','Do Master quy định'):'Do Master quy định'}</span>`;
            }

            this.onSelectEcrModel(elModel ? elModel.value : 'PAX_A920_PRO');
            this.loadCardTransactions();
        } catch (e) {
            console.error('loadCardTerminalAdmin error:', e);
        }
    },

    onSelectEcrModel(modelCode) {
        const specsEl = document.getElementById('ecr-cfg-model-specs');
        if (!specsEl) return;
        const found = (this.cardCompatibleModels || []).find(m => m.model_code === modelCode);
        if (found) {
            specsEl.textContent = `${window.cnxT?window.cnxT('js.s_fin.bcd44418','Chuẩn bảo mật:'):'Chuẩn bảo mật:'} ${found.security_standard} ${window.cnxT?window.cnxT('js.s_fin.4f9e03b5','• Giao thức:'):'• Giao thức:'} ${found.protocol} ${window.cnxT?window.cnxT('js.s_fin.0e212c4d','• Hỗ trợ:'):'• Hỗ trợ:'} ${found.supported_interfaces}`;
        }
    },

    async saveCardTerminalConfig() {
        const payload = {
            model_code: document.getElementById('ecr-cfg-model-code')?.value || 'PAX_A920_PRO',
            acquirer_bank: document.getElementById('ecr-cfg-acquirer-bank')?.value || 'Vietcombank',
            connection_mode: document.getElementById('ecr-cfg-conn-type')?.value || 'LAN_TCP',
            terminal_ip: document.getElementById('ecr-cfg-ip')?.value.trim() || '10.0.126.250',
            terminal_port: parseInt(document.getElementById('ecr-cfg-port')?.value || '10009', 10),
            terminal_id_tid: document.getElementById('ecr-cfg-tid')?.value.trim() || '88001234',
            merchant_id_mid: document.getElementById('ecr-cfg-mid')?.value.trim() || '000001088001234',
            api_secret: document.getElementById('ecr-cfg-secret')?.value.trim() || 'NEXUS-ECR-2026-KEY',
            customer_surcharge_percent: parseFloat(document.getElementById('ecr-cfg-surcharge')?.value || '0') || 0,
            simulation_mode: Number(document.getElementById('ecr-cfg-sim-mode')?.value ?? 1),
            sim_behavior: document.getElementById('ecr-cfg-sim-behavior')?.value || 'AUTO_APPROVE'
        };

        try {
            const res = await fetch('/api/card/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || (window.cnxT?window.cnxT('js.s_fin.d7de84cc','Đã lưu cấu hình liên kết máy SmartPOS ECR thành công!'):'Đã lưu cấu hình liên kết máy SmartPOS ECR thành công!'));
                this.loadCardTerminalAdmin();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_fin.6783abbb','Lỗi lưu cấu hình máy POS'):'Lỗi lưu cấu hình máy POS'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.s_fin.a44416a1','Lỗi kết nối máy chủ: '):'Lỗi kết nối máy chủ: ') + e.message);
        }
    },

    async testCardTerminalConnection() {
        const resultEl = document.getElementById('ecr-handshake-result');
        if (resultEl) {
            resultEl.classList.remove('hidden');
            resultEl.className = 'p-2.5 rounded-xl bg-slate-950/90 border border-sky-500/30 text-xs font-mono text-sky-300';
            resultEl.innerHTML = (window.cnxT?window.cnxT('js.s_fin.96bf4056','<i class="fas fa-spinner fa-spin mr-1.5"></i>Đang gửi gói tin ECHO TEST / HANDSHAKE sang SmartPOS...'):'<i class="fas fa-spinner fa-spin mr-1.5"></i>Đang gửi gói tin ECHO TEST / HANDSHAKE sang SmartPOS...');
        }

        const probePayload = {
            model_code: document.getElementById('ecr-cfg-model-code')?.value || 'PAX_A920_PRO',
            connection_mode: document.getElementById('ecr-cfg-conn-type')?.value || 'LAN_TCP',
            terminal_ip: document.getElementById('ecr-cfg-ip')?.value.trim() || '10.0.126.250',
            terminal_port: parseInt(document.getElementById('ecr-cfg-port')?.value || '10009', 10),
            simulation_mode: Number(document.getElementById('ecr-cfg-sim-mode')?.value ?? 1)
        };

        try {
            const res = await fetch('/api/card/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(probePayload)
            });
            const data = await res.json();
            if (resultEl) {
                if (data.success && data.status === 'CONNECTED') {
                    const isSim = data.simulation_mode !== false;
                    const modeTag = isSim
                        ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] mr-1.5">⚠️ MÔ PHỎNG</span>'
                        : (window.cnxT?window.cnxT('js.s_fin.18c0259e','<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] mr-1.5">🟢 THIẾT BỊ THẬT</span>'):'<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] mr-1.5">🟢 THIẾT BỊ THẬT</span>');
                    resultEl.className = `p-2.5 rounded-xl ${isSim ? 'bg-amber-950/70 border border-amber-500/50 text-amber-200' : 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'} text-xs font-mono`;
                    resultEl.innerHTML = `<i class="fas fa-circle-check mr-1.5"></i>${modeTag}<b>${escapeHtml(data.message)}</b> • Máy: ${escapeHtml(data.terminal_name || '')} • Firmware: ${escapeHtml(data.firmware || 'v3.2')} ${window.cnxT?window.cnxT('js.s_fin.c44b2c2c','• Độ trễ:'):'• Độ trễ:'} ${Number(data.latency_ms ?? 12)}ms`;
                } else {
                    resultEl.className = 'p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs font-mono text-rose-300';
                    resultEl.innerHTML = `<i class="fas fa-triangle-exclamation mr-1.5"></i>${escapeHtml(data.message || (window.cnxT?window.cnxT('js.s_fin.5409dfc6','Không thể bắt tay với SmartPOS'):'Không thể bắt tay với SmartPOS'))}`;
                }
            }
        } catch (e) {
            if (resultEl) {
                resultEl.className = 'p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs font-mono text-rose-300';
                resultEl.innerHTML = `<i class="fas fa-triangle-exclamation mr-1.5"></i>Lỗi kết nối: ${escapeHtml(e.message)}`;
            }
        }
    },

    async loadCardTransactions() {
        try {
            const res = await fetch('/api/card/transactions?status=ALL&limit=30');
            const data = await res.json();
            if (!data.success) return;

            const tbody = document.getElementById('ecr-transactions-tbody');
            const badge = document.getElementById('ecr-batch-summary-badge');
            const txs = data.transactions || [];

            let sumApproved = 0;
            let countApproved = 0;
            txs.forEach(t => {
                if (t.status === 'APPROVED' && t.settle_status !== 'SETTLED') {
                    sumApproved += (t.total_charged || 0);
                    countApproved++;
                }
            });

            if (badge) {
                badge.textContent = `${window.cnxT?window.cnxT('js.s_fin.23e47a92','Lô hiện tại:'):'Lô hiện tại:'} ${countApproved} GD • ${this.formatMoney(sumApproved)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;
            }

            if (!tbody) return;
            if (txs.length === 0) {
                tbody.innerHTML = (window.cnxT?window.cnxT('js.s_fin.2c2f5e68','<tr><td colspan="8" class="text-center py-4 text-slate-500">Chưa có giao dịch cà thẻ nào.</td></tr>'):'<tr><td colspan="8" class="text-center py-4 text-slate-500">Chưa có giao dịch cà thẻ nào.</td></tr>');
                return;
            }

            tbody.innerHTML = txs.map(t => {
                const isApproved = t.status === 'APPROVED';
                const isVoided = t.status === 'VOIDED';
                const isSettled = t.settle_status === 'SETTLED';

                const statusBadge = isApproved
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">APPROVED</span>`
                    : (isVoided
                        ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">VOIDED</span>`
                        : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">${t.status}</span>`);

                const settleBadge = isSettled
                    ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30">${window.cnxT?window.cnxT('js.s_fin.9f3c8c81','ĐÃ KẾT TOÁN'):'ĐÃ KẾT TOÁN'}</span>`
                    : `<span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-400">${window.cnxT?window.cnxT('js.s_fin.ae29a26f','CHỜ KẾT TOÁN'):'CHỜ KẾT TOÁN'}</span>`;

                const canVoid = isApproved && !isSettled;

                return `
                    <tr class="hover:bg-white/5 transition border-b border-white/5">
                        <td class="font-mono text-slate-300">
                            <div>${t.trace_no}</div>
                            <div class="text-[10px] text-slate-500">RRN: ${t.rrn || '-'}</div>
                        </td>
                        <td>
                            <div class="font-bold text-white">${t.order_code || 'HD'}</div>
                            <div class="text-[10px] text-slate-400">Bàn: ${t.table_code || 'MV'}</div>
                        </td>
                        <td>
                            <div class="font-bold text-indigo-300">${t.card_scheme}</div>
                            <div class="font-mono text-[10px] text-slate-400">${t.masked_pan}</div>
                        </td>
                        <td>
                            <div class="text-slate-300">${t.terminal_model}</div>
                            <div class="text-[10px] text-slate-500">${t.acquirer_bank}</div>
                        </td>
                        <td class="col-right font-mono font-bold text-emerald-400">
                            ${this.formatMoney(t.total_charged)} đ
                        </td>
                        <td class="col-center font-mono text-xs text-amber-300">
                            ${t.approval_code || '-'}
                        </td>
                        <td class="col-center">
                            <div class="flex flex-col items-center gap-0.5">
                                ${statusBadge}
                                ${settleBadge}
                            </div>
                        </td>
                        <td class="col-right">
                            ${canVoid ? `
                                <button type="button" onclick="Admin.voidCardTransaction(${Number(t.id)}, '${escapeJsAttr(t.trace_no)}', ${Number(t.total_charged) || 0})" class="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition">
                                    <i class="fas fa-ban mr-0.5"></i> ${window.cnxT?window.cnxT('js.s_fin.96000947','HỦY (VOID)'):'HỦY (VOID)'}
                                </button>
                            ` : `<span class="text-slate-600 text-[10px]">--</span>`}
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.error('loadCardTransactions error:', e);
        }
    },

    async voidCardTransaction(transId, traceNo, amount) {
        const reason = await window.cnxPrompt(`${window.cnxT?window.cnxT('js.s_fin.c0f0059e','Xác nhận HỦY (VOID) giao dịch thẻ Trace #'):'Xác nhận HỦY (VOID) giao dịch thẻ Trace #'}${traceNo} (${this.formatMoney(amount)} ${window.cnxT?window.cnxT('js.s_fin.634ba62b','đ)?\\nNhập lý do hủy (Audit Trail):'):'đ)?\\nNhập lý do hủy (Audit Trail):'}`, (window.cnxT?window.cnxT('js.s_fin.4d0bb0ca','Khách yêu cầu hủy / Thu ngân thanh toán nhầm'):'Khách yêu cầu hủy / Thu ngân thanh toán nhầm'));
        if (!reason) return;

        try {
            const res = await fetch('/api/card/void', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaction_id: transId,
                    reason: reason,
                    cashier_name: (window.CURRENT_USER && window.CURRENT_USER.fullname) ? window.CURRENT_USER.fullname : 'Admin'
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || (window.cnxT?window.cnxT('js.s_fin.a5b0cbcb','Đã hủy giao dịch thẻ thành công!'):'Đã hủy giao dịch thẻ thành công!'));
                this.loadCardTransactions();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_fin.5b3a3c52','Không thể hủy giao dịch'):'Không thể hủy giao dịch'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.s_fin.b6e7ddab','Lỗi kết nối hủy giao dịch: '):'Lỗi kết nối hủy giao dịch: ') + e.message);
        }
    },

    async settleCardBatch() {
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_fin.547b9884','Xác nhận KẾT TOÁN LÔ (BATCH SETTLEMENT) cho toàn bộ giao dịch thẻ SmartPOS hiện tại?\n\nToàn bộ tiền sẽ được ngân hàng chốt phiên và đối soát vào tài khoản quán.'):'Xác nhận KẾT TOÁN LÔ (BATCH SETTLEMENT) cho toàn bộ giao dịch thẻ SmartPOS hiện tại?\n\nToàn bộ tiền sẽ được ngân hàng chốt phiên và đối soát vào tài khoản quán.')))) {
            return;
        }

        try {
            const res = await fetch('/api/card/settle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cashier_name: (window.CURRENT_USER && window.CURRENT_USER.fullname) ? window.CURRENT_USER.fullname : 'Admin'
                })
            });
            const data = await res.json();
            if (data.success) {
                const s = data.summary || {};
                alert(`${data.message}${window.cnxT?window.cnxT('js.s_fin.100d5b79','\\n\\n• Số giao dịch:'):'\\n\\n• Số giao dịch:'} ${s.settled_count || 0}${window.cnxT?window.cnxT('js.s_fin.6f53626b','\\n• Tổng tiền:'):'\\n• Tổng tiền:'} ${this.formatMoney(s.total_amount)} ${window.cnxT?window.cnxT('js.s_fin.31f3d0b4','đ\\n• Số lô mới:'):'đ\\n• Số lô mới:'} ${data.batch_number}`);
                this.loadCardTransactions();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_fin.1c9669d7','Lỗi kết toán lô'):'Lỗi kết toán lô'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.s_fin.aa235efa','Lỗi kết nối kết toán lô: '):'Lỗi kết nối kết toán lô: ') + e.message);
        }
    },

    async loadPromotions() {
        const listEl = document.getElementById('promo-list-container');
        if (!listEl) return;
        try {
            const res = await fetch('api/promotions.php?action=list').then(r => r.json());
            if (!res || !res.success) {
                listEl.innerHTML = `<div class="text-[11px] text-slate-500 italic">${res ? escapeHtml(cnxApiMsg(res, (window.cnxT?window.cnxT('js.s_fin.d11b32c0','Chưa tải được danh sách khuyến mãi.'):'Chưa tải được danh sách khuyến mãi.'))) : (window.cnxT?window.cnxT('js.s_fin.d11b32c0','Chưa tải được danh sách khuyến mãi.'):'Chưa tải được danh sách khuyến mãi.')}</div>`;
                return;
            }
            const rows = Array.isArray(res.data) ? res.data : [];
            this._promotionsCache = rows;
            if (rows.length === 0) {
                listEl.innerHTML = (window.cnxT?window.cnxT('js.s_fin.170fa3be','<div class="text-[11px] text-slate-500 italic p-3 rounded-xl bg-slate-950/50 border border-white/5 text-center">Chưa có chương trình khuyến mãi nào. Bấm "Tạo Khuyến Mãi" để bắt đầu.</div>'):'<div class="text-[11px] text-slate-500 italic p-3 rounded-xl bg-slate-950/50 border border-white/5 text-center">Chưa có chương trình khuyến mãi nào. Bấm "Tạo Khuyến Mãi" để bắt đầu.</div>');
                return;
            }
            listEl.innerHTML = rows.map(p => {
                const isActive = Number(p.is_active) === 1;
                const valTxt = p.discount_type === 'percent'
                    ? `${Number(p.discount_value) || 0}%${Number(p.max_discount_amount) > 0 ? ` ${window.cnxT?window.cnxT('js.s_fin.82a97937','(tối đa'):'(tối đa'} ${this.formatMoney(p.max_discount_amount)}${window.cnxT?window.cnxT('js.s_cust.72b7fe2d','đ)'):'đ)'}` : ''}`
                    : `${this.formatMoney(p.discount_value)}${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;
                const limitTxt = Number(p.usage_limit) > 0 ? `${p.used_count || 0}/${p.usage_limit} ${window.cnxT?window.cnxT('js.s_fin.e34da69e','lượt'):'lượt'}` : `${p.used_count || 0} ${window.cnxT?window.cnxT('js.s_fin.d3efe5f8','lượt (∞)'):'lượt (∞)'}`;
                const timeTxt = (p.start_time || p.end_time) ? ` ${window.cnxT?window.cnxT('js.s_fin.f9148416','• Giờ vàng'):'• Giờ vàng'} ${escapeHtml(p.start_time || '00:00')}–${escapeHtml(p.end_time || '23:59')}` : '';
                const dateTxt = (p.start_date || p.end_date) ? ` • ${escapeHtml(p.start_date || '...')} → ${escapeHtml(p.end_date || '...')}` : '';
                return `
                    <div class="p-3 rounded-xl ${isActive ? 'bg-slate-950/75 border border-emerald-500/30' : 'bg-slate-950/40 border border-white/5 opacity-60'} flex flex-wrap items-center justify-between gap-2">
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-1.5">
                                <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 font-mono font-black text-[11px]">${escapeHtml(p.code)}</span>
                                <b class="text-white text-xs">${escapeHtml(p.name)}</b>
                                <span class="px-1.5 py-0.5 rounded text-[10px] ${p.promo_mode === 'auto' ? 'bg-sky-500/20 text-sky-300' : 'bg-purple-500/20 text-purple-300'}">${p.promo_mode === 'auto' ? 'Tự động áp' : (window.cnxT?window.cnxT('js.s_fin.b508a44d','Mã Voucher'):'Mã Voucher')}</span>
                            </div>
                            <div class="text-[11px] text-slate-400">
                                ${window.cnxT?window.cnxT('js.s_fin.76d8f41f','Giảm'):'Giảm'} <b class="text-emerald-300">${valTxt}</b>${Number(p.min_order_amount) > 0 ? ` ${window.cnxT?window.cnxT('js.s_fin.2840c8d3','• Đơn từ'):'• Đơn từ'} ${this.formatMoney(p.min_order_amount)}${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}` : ''}${dateTxt}${timeTxt}
                            </div>
                            <div class="text-[10px] font-mono text-slate-400">
                                ${window.cnxT?window.cnxT('js.s_fin.185bb788','Đã dùng:'):'Đã dùng:'} <b class="text-sky-300">${limitTxt}</b> ${window.cnxT?window.cnxT('js.s_fin.81783c2e','• Tổng giảm:'):'• Tổng giảm:'} <b class="text-rose-300">${this.formatMoney(p.total_discount_given || 0)}đ</b> • Doanh thu: <b class="text-emerald-300">${this.formatMoney(p.net_revenue_generated || 0)}đ</b>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button type="button" onclick="Admin.togglePromotion(${p.id})" class="px-2.5 py-1 rounded-lg ${isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-white/10'} border text-[10px] font-bold">${isActive ? 'Đang bật' : (window.cnxT?window.cnxT('js.s_fin.7b0c8a03','Đã tắt'):'Đã tắt')}</button>
                            <button type="button" onclick="Admin.openPromoFormModal(${p.id})" class="px-2 py-1 rounded-lg bg-sky-500/20 text-sky-300 text-[10px]" title="Sửa"><i class="fas fa-pen"></i></button>
                            <button type="button" onclick="Admin.deletePromotion(${p.id})" class="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[10px]" title="Xóa"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_finance_ecr.js', e) : console.debug('admin_finance_ecr.js', e)); }
    },

    openPromoFormModal(editId = 0) {
        const box = document.getElementById('promo-form-box');
        if (!box) return;
        box.classList.remove('hidden');
        const p = editId ? (this._promotionsCache || []).find(x => Number(x.id) === Number(editId)) : null;
        document.getElementById('promo-edit-id').value = p ? p.id : 0;
        document.getElementById('promo-code').value = p ? p.code : '';
        document.getElementById('promo-name').value = p ? p.name : '';
        document.getElementById('promo-mode').value = p ? p.promo_mode : 'voucher';
        document.getElementById('promo-discount-type').value = p ? p.discount_type : 'percent';
        document.getElementById('promo-discount-value').value = p ? p.discount_value : '';
        document.getElementById('promo-max-cap').value = p ? p.max_discount_amount : 0;
        document.getElementById('promo-min-order').value = p ? p.min_order_amount : 0;
        document.getElementById('promo-start-date').value = p ? (p.start_date || '') : '';
        document.getElementById('promo-end-date').value = p ? (p.end_date || '') : '';
        document.getElementById('promo-start-time').value = p ? (p.start_time || '') : '';
        document.getElementById('promo-end-time').value = p ? (p.end_time || '') : '';
        document.getElementById('promo-usage-limit').value = p ? (p.usage_limit || 0) : 0;
    },

    async savePromotion() {
        const payload = {
            id: Number(document.getElementById('promo-edit-id')?.value || 0),
            code: (document.getElementById('promo-code')?.value || '').trim().toUpperCase(),
            name: (document.getElementById('promo-name')?.value || '').trim(),
            promo_mode: document.getElementById('promo-mode')?.value || 'voucher',
            discount_type: document.getElementById('promo-discount-type')?.value || 'percent',
            discount_value: Number(document.getElementById('promo-discount-value')?.value || 0),
            max_discount_amount: Number(document.getElementById('promo-max-cap')?.value || 0),
            min_order_amount: Number(document.getElementById('promo-min-order')?.value || 0),
            start_date: document.getElementById('promo-start-date')?.value || '',
            end_date: document.getElementById('promo-end-date')?.value || '',
            start_time: document.getElementById('promo-start-time')?.value || '',
            end_time: document.getElementById('promo-end-time')?.value || '',
            usage_limit: Number(document.getElementById('promo-usage-limit')?.value || 0)
        };
        const res = await fetch('api/promotions.php?action=save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(r => r.json());
        if (res.success) {
            document.getElementById('promo-form-box')?.classList.add('hidden');
            await this.loadPromotions();
        } else {
            alert(res.message || (window.cnxT?window.cnxT('js.s_fin.1eed6289','Không thể lưu khuyến mãi'):'Không thể lưu khuyến mãi'));
        }
    },

    async togglePromotion(id) {
        await fetch('api/promotions.php?action=toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        await this.loadPromotions();
    },

    async deletePromotion(id) {
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_fin.4646cd50','Xóa chương trình khuyến mãi này?'):'Xóa chương trình khuyến mãi này?')))) return;
        await fetch('api/promotions.php?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        await this.loadPromotions();
    }
});
