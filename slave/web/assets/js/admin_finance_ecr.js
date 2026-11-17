/**
 * Admin Module: Finance Reports, Cashbook, SmartPOS ECR & Promotions
 * Extracted from admin.js for modular maintainability
 */
Object.assign(Admin, {
    // ==========================================
    // 8. TÀI CHÍNH & SỔ QUỸ (FINANCE REPORTS)
    // ==========================================
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
            const [repRes, expRes, auditRes, pnlCmpRes] = await Promise.all([
                fetch(`api/finance.php?action=get_report&month=${month}`).then(r => r.json()).catch(() => ({})),
                fetch(`api/finance.php?action=list_expenses&month=${month}`).then(r => r.json()).catch(() => ({})),
                fetch(`api/finance.php?action=audit_and_shifts`).then(r => r.json()).catch(() => ({})),
                fetch(`api/finance.php?action=get_pnl_comparison&month=${month}`).then(r => r.json()).catch(() => ({}))
            ]);

            // Render Audit KPI Cards & Audit Logs Table & Shifts Table
            const auditKpi = (auditRes && auditRes.audit_kpi) || { critical_count: 0, void_count: 0, void_amount: 0, discount_count: 0, discount_amount: 0, total_shift_discrepancy: 0 };
            const auditKpiEl = document.getElementById('fin-audit-kpi-cards');
            if (auditKpiEl) {
                const diffVal = Number(auditKpi.total_shift_discrepancy) || 0;
                auditKpiEl.innerHTML = `
                    <div class="liquid-glass-card p-3 border-l-4 border-rose-500">
                        <span class="text-[10px] font-bold text-rose-300 uppercase block">CẢNH BÁO RỦI RO CAO (CRITICAL)</span>
                        <div class="text-xl font-black text-rose-400 font-mono mt-1">${auditKpi.critical_count} <span class="text-xs font-normal text-slate-400">sự kiện</span></div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Hủy đơn / Giảm giá lớn / Lệch ca</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-orange-400">
                        <span class="text-[10px] font-bold text-orange-300 uppercase block">TỔNG HỦY ĐƠN (VOID)</span>
                        <div class="text-xl font-black text-orange-400 font-mono mt-1">${this.formatMoney(auditKpi.void_amount)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">${auditKpi.void_count} hóa đơn bị hủy</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-amber-400">
                        <span class="text-[10px] font-bold text-amber-300 uppercase block">TỔNG GIẢM GIÁ THỦ CÔNG</span>
                        <div class="text-xl font-black text-amber-400 font-mono mt-1">${this.formatMoney(auditKpi.discount_amount)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">${auditKpi.discount_count} lượt áp chiết khấu</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 ${diffVal < 0 ? 'border-rose-500' : 'border-emerald-400'}">
                        <span class="text-[10px] font-bold text-slate-300 uppercase block">LỆCH KÉT GIAO CA LŨY KẾ</span>
                        <div class="text-xl font-black ${diffVal < 0 ? 'text-rose-400' : 'text-emerald-400'} font-mono mt-1">${diffVal > 0 ? '+' : ''}${this.formatMoney(diffVal)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">${diffVal === 0 ? 'Khớp 100% két lý thuyết' : (diffVal < 0 ? 'Thiếu hụt tiền mặt' : 'Dư tiền mặt')}</span>
                    </div>
                `;
            }

            const auditTbody = document.getElementById('fin-audit-logs-tbody');
            if (auditTbody) {
                const logs = (auditRes && auditRes.audit_logs) || [];
                if (logs.length === 0) {
                    auditTbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-xs text-slate-500">Chưa ghi nhận thao tác nhạy cảm nào trong Nhật ký Kiểm toán.</td></tr>';
                } else {
                    auditTbody.innerHTML = logs.map(l => {
                        const sevBadge = l.severity === 'CRITICAL'
                            ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">🚩 CRITICAL</span>'
                            : (l.severity === 'WARN'
                                ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">⚠️ WARN</span>'
                                : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">ℹ️ INFO</span>');
                        return `
                            <tr class="hover:bg-white/[0.03] transition-colors">
                                <td><span class="font-mono text-[11px] text-slate-400 whitespace-nowrap">${l.created_at ? window.formatDateDDMMYY(l.created_at, true) : '-'}</span></td>
                                <td>${sevBadge}</td>
                                <td><span class="text-xs font-bold text-white">${l.action_label || l.action_code}</span></td>
                                <td><span class="font-mono text-xs text-sky-300">${l.table_code || '-'} ${l.order_code ? '(' + l.order_code + ')' : ''}</span></td>
                                <td class="col-right"><span class="font-mono font-bold text-xs ${Number(l.amount_impact) > 0 ? 'text-rose-400' : 'text-slate-400'}">${Number(l.amount_impact) > 0 ? this.formatMoney(l.amount_impact) + ' đ' : '-'}</span></td>
                                <td>
                                    <div class="text-xs text-amber-200 font-semibold">${l.reason || '-'}</div>
                                    ${l.details ? `<div class="text-[10px] text-slate-400">${l.details}</div>` : ''}
                                </td>
                                <td><span class="text-xs text-slate-300 font-medium">${l.user_name || '-'} <span class="text-[10px] text-slate-500">[${l.user_role || ''}]</span></span></td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            const shiftsTbody = document.getElementById('fin-shifts-tbody');
            if (shiftsTbody) {
                const shifts = (auditRes && auditRes.shifts) || [];
                if (shifts.length === 0) {
                    shiftsTbody.innerHTML = '<tr><td colspan="10" class="py-6 text-center text-xs text-slate-500">Chưa có lịch sử ca làm việc nào. Thu ngân có thể bấm "Giao Ca / Quỹ" trên màn hình POS để mở ca.</td></tr>';
                } else {
                    shiftsTbody.innerHTML = shifts.map(s => {
                        const diff = Number(s.discrepancy) || 0;
                        const isOpen = s.status === 'open';
                        const diffClass = diff < 0 ? 'text-rose-400 font-black' : (diff > 0 ? 'text-amber-300 font-bold' : 'text-emerald-400 font-bold');
                        return `
                            <tr class="hover:bg-white/[0.03] transition-colors">
                                <td><span class="font-mono font-bold text-xs text-amber-300">${s.shift_code}</span></td>
                                <td><span class="text-xs text-white font-semibold">${s.user_name || 'Thu ngân'}</span></td>
                                <td>
                                    <div class="font-mono text-[10px] text-slate-300">Mở: ${s.opened_at ? window.formatDateDDMMYY(s.opened_at, true) : '-'}</div>
                                    <div class="font-mono text-[10px] text-slate-400">Kết: ${s.closed_at ? window.formatDateDDMMYY(s.closed_at, true) : 'Đang trực ca'}</div>
                                </td>
                                <td class="col-right font-mono text-xs text-slate-300">${this.formatMoney(s.opening_cash)} đ</td>
                                <td class="col-right font-mono text-xs text-emerald-400">+${this.formatMoney(s.cash_sales)} đ</td>
                                <td class="col-right font-mono text-[11px]">
                                    <span class="text-emerald-300">+${this.formatMoney(s.cash_in)}</span> / <span class="text-rose-400">-${this.formatMoney(s.cash_out)}</span>
                                </td>
                                <td class="col-right font-mono text-xs font-bold text-sky-300">${isOpen ? 'Đang tính' : this.formatMoney(s.expected_cash) + ' đ'}</td>
                                <td class="col-right font-mono text-xs font-bold text-white">${isOpen ? '-' : this.formatMoney(s.actual_cash) + ' đ'}</td>
                                <td class="col-right font-mono text-xs ${diffClass}">${isOpen ? '-' : (diff > 0 ? '+' : '') + this.formatMoney(diff) + ' đ'}</td>
                                <td>
                                    ${isOpen
                                        ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">ĐANG MỞ</span>'
                                        : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-white/10">ĐÃ CHỐT</span>'}
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
                    : 'Đã chốt chu kỳ • ';
                cycleBadge.textContent = `Chu kỳ: ${ps} – ${pe} (${rtTag}${elDays}/${repRes.days_in_month || 30} ngày)`;
            }

            if (repRes && repRes.success === false) {
                const kpiContainer = document.getElementById('fin-kpi-cards');
                if (kpiContainer) {
                    kpiContainer.innerHTML = `<div class="col-span-full p-4 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs font-semibold"><i class="fas fa-exclamation-triangle mr-2"></i>${repRes.message || repRes.error || 'Không thể tải dữ liệu Báo Cáo Tài Chính'}</div>`;
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
                kpiContainer.innerHTML = `
                    <div class="liquid-glass-card p-3 border-l-4 border-emerald-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DOANH THU THỰC (${summary.order_count || 0} ĐƠN)</span>
                        <div class="text-xl font-black text-emerald-400 font-mono mt-1">${this.formatMoney(summary.revenue)} đ</div>
                        <span class="text-[10px] text-sky-300 mt-0.5 block">Bàn đang mở: +${this.formatMoney(summary.pending_revenue || 0)} đ (${summary.pending_orders_count || 0} bàn)</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-amber-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TỔNG CHI PHÍ KỲ (REALTIME)</span>
                        <div class="text-xl font-black text-amber-400 font-mono mt-1">${this.formatMoney(totalAllCosts)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">COGS ${this.formatMoney(summary.cogs || 0)} + Vận hành ${this.formatMoney(summary.expenses || 0)}</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 ${summary.net_profit >= 0 ? 'border-sky-400' : 'border-rose-400'}">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">LỢI NHUẬN RÒNG (${netMarginPct}%)</span>
                        <div class="text-xl font-black ${summary.net_profit >= 0 ? 'text-sky-400' : 'text-rose-400'} font-mono mt-1">${this.formatMoney(summary.net_profit)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Dự phóng tháng: ${this.formatMoney(summary.projected_net_profit || 0)} đ</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-purple-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">LƯƠNG &amp; THƯỞNG (REALTIME)</span>
                        <div class="text-xl font-black text-purple-400 font-mono mt-1">${this.formatMoney(totalLabor)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">${Number(summary.labor_hours || 0).toFixed(1)}h công • ${summary.working_staff_count || 0} NV đang trực</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-teal-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CÔNG NỢ &amp; NHẬP KHO</span>
                        <div class="text-sm font-black text-teal-300 font-mono mt-1">Thu: ${this.formatMoney(totalReceivable)} đ</div>
                        <span class="text-[10px] text-amber-300 mt-0.5 block">Trả NCC: ${this.formatMoney(totalPayable)} đ • Nhập kho: ${this.formatMoney(summary.material_import_cost || 0)} đ</span>
                    </div>
                `;
            }

            const expTbody = document.getElementById('fin-expense-tbody');
            if (expTbody) {
                const list = (expRes && expRes.data) ? expRes.data : [];
                if (list.length === 0) {
                    expTbody.innerHTML = this.renderEmptyState(7, 'fa-file-invoice-dollar', 'Chưa có khoản chi nào trong kỳ', 'Bấm nút "Thêm chi phí / Công nợ" ở trên để ghi nhận các khoản chi phát sinh trong tháng.');
                } else {
                    let html = '';
                    list.forEach(item => {
                        const isUnpaid = item.payment_status === 'unpaid';
                        html += `
                            <tr class="hover:bg-sky-500/[0.04] transition-colors">
                                <td><span class="font-mono text-xs text-slate-300 whitespace-nowrap">${item.expense_date ? window.formatDateDDMMYY(item.expense_date, false) : '-'}</span></td>
                                <td>
                                    <span class="saas-badge bg-teal-500/15 text-teal-300 border border-teal-500/30 whitespace-nowrap">${item.category || 'Khác'}</span>
                                    ${isUnpaid ? '<span class="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">NỢ NCC</span>' : ''}
                                </td>
                                <td class="col-name"><span class="text-xs font-medium text-white whitespace-nowrap">${item.description || '-'}</span></td>
                                <td><span class="text-xs text-slate-400 whitespace-nowrap">${item.supplier || '-'}</span></td>
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
                    expGroups.innerHTML = '<div class="text-xs text-slate-400 py-4 text-center italic">Chưa có chi phí phát sinh trong tháng này</div>';
                } else {
                    let gHtml = '';
                    groups.forEach(g => {
                        const amt = Number(g.amount) || 0;
                        const pct = sumExpGrp > 0 ? Math.round((amt / sumExpGrp) * 100) : 0;
                        const autoBadge = g.auto ? '<span class="ml-1 px-1 py-0.2 rounded text-[9px] bg-sky-500/15 text-sky-300 border border-sky-500/25">Auto</span>' : '';
                        gHtml += `
                            <div class="py-1.5 border-b border-white/5">
                                <div class="flex items-center justify-between text-xs mb-1">
                                    <span class="text-slate-200 font-medium">${g.category || 'Khác'}${autoBadge} <span class="text-slate-500 text-[10px]">(${g.count || 0})</span></span>
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
                        labels: labels.length ? labels : ['Chưa có dữ liệu'],
                        datasets: [{
                            label: 'Doanh thu (đ)',
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
                                        return `${this.formatMoney(ctx.parsed.y)} đ (${ord} đơn)`;
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
                        <tr><td class="py-1.5 text-slate-400">Giảm giá / Chiết khấu</td><td class="py-1.5 text-right font-mono text-rose-400">-${this.formatMoney(discounts)} đ</td></tr>
                        <tr class="font-semibold"><td class="py-1.5 text-emerald-300">Doanh thu thuần</td><td class="py-1.5 text-right font-mono text-emerald-400">${this.formatMoney(revenue)} đ</td></tr>
                        <tr><td class="py-1.5 text-slate-400">Giá vốn hàng bán (COGS)</td><td class="py-1.5 text-right font-mono text-amber-300">-${this.formatMoney(cogs)} đ</td></tr>
                        <tr class="font-semibold"><td class="py-1.5 text-sky-300">Lợi nhuận gộp (${grossMargin}%)</td><td class="py-1.5 text-right font-mono text-sky-400">${this.formatMoney(grossProfit)} đ</td></tr>
                        <tr><td class="py-1.5 text-slate-400">Lương chấm công (${Number(summary.labor_hours || 0).toFixed(1)}h)</td><td class="py-1.5 text-right font-mono text-purple-300">-${this.formatMoney(laborCost)} đ</td></tr>
                        ${bonusCost > 0 ? `<tr><td class="py-1.5 text-slate-400">Thưởng &amp; Phụ cấp</td><td class="py-1.5 text-right font-mono text-purple-300">-${this.formatMoney(bonusCost)} đ</td></tr>` : ''}
                        <tr><td class="py-1.5 text-slate-400">Chi phí vận hành (Mặt bằng, MKT...)</td><td class="py-1.5 text-right font-mono text-amber-400">-${this.formatMoney(opexOnly)} đ</td></tr>
                        ${(cashOutCounter > 0 || lossAndShortage > 0) ? `<tr><td class="py-1.5 text-slate-400">Chi quầy &amp; Hao hụt / Lệch két</td><td class="py-1.5 text-right font-mono text-rose-300">-${this.formatMoney(cashOutCounter + lossAndShortage)} đ</td></tr>` : ''}
                        <tr class="border-t border-white/15 font-bold text-sm">
                            <td class="pt-2 text-white">Lợi nhuận ròng (${netMargin}%)</td>
                            <td class="pt-2 text-right font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(netProfit)} đ</td>
                        </tr>
                        <tr class="text-[11px] text-slate-400">
                            <td class="pt-1.5">Dự phóng doanh thu tháng</td>
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
                const vatOut = Number(summary.vat_collected) || 0;
                const vatIn = Number(summary.vat_input) || 0;
                const vatPayable = Math.max(0, vatOut - vatIn);
                const grossRatio = revenue > 0 ? Math.max(0.05, (revenue - cogs) / revenue) : 0.65;
                const breakeven = expenses > 0 ? Math.round(expenses / grossRatio) : 0;
                const progress = breakeven > 0 ? Math.min(100, Math.round((revenue / breakeven) * 100)) : (revenue > 0 ? 100 : 0);
                const passed = revenue >= breakeven;

                taxEl.innerHTML = `
                    <div class="flex items-center justify-between py-1 border-b border-white/5">
                        <span class="text-slate-300">VAT đầu ra (hóa đơn)</span>
                        <span class="font-mono text-sky-300">${this.formatMoney(vatOut)} đ</span>
                    </div>
                    <div class="flex items-center justify-between py-1 border-b border-white/5">
                        <span class="text-slate-300">VAT đầu vào (phiếu chi)</span>
                        <span class="font-mono text-emerald-300">${this.formatMoney(vatIn)} đ</span>
                    </div>
                    <div class="flex items-center justify-between py-1 border-b border-white/5">
                        <span class="text-slate-300 font-semibold">VAT dự kiến phải nộp</span>
                        <span class="font-mono font-bold text-amber-300">${this.formatMoney(vatPayable)} đ</span>
                    </div>
                    <div class="flex items-center justify-between py-1 border-b border-white/5">
                        <span class="text-slate-300">Công nợ phải thu / Bàn mở</span>
                        <span class="font-mono text-teal-300">${this.formatMoney(totalReceivable)} đ</span>
                    </div>
                    <div class="pt-2">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-slate-300">Điểm hòa vốn tháng (gồm lương &amp; OPEX)</span>
                            <span class="font-mono font-bold text-white">${this.formatMoney(breakeven)} đ</span>
                        </div>
                        <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div class="h-full ${passed ? 'bg-emerald-400' : 'bg-sky-400'}" style="width:${progress}%"></div>
                        </div>
                        <div class="flex items-center justify-between mt-1 text-[11px]">
                            <span class="${passed ? 'text-emerald-400 font-semibold' : 'text-amber-300'}">${passed ? 'Đã vượt điểm hòa vốn' : 'Chưa đạt điểm hòa vốn'}</span>
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
                const payLabels = { cash: 'Tiền mặt', banking: 'Chuyển khoản / VietQR', transfer: 'Chuyển khoản / QR', qr: 'VietQR', card: 'Thẻ POS', momo: 'Ví MoMo', debt: 'Ghi nợ' };

                let html = '';
                if (cats.length === 0 && pays.length === 0) {
                    html = '<div class="text-xs text-slate-400 py-4 text-center italic">Chưa có doanh thu phát sinh trong tháng này</div>';
                } else {
                    if (cats.length > 0) {
                        html += '<div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Theo nhóm hàng</div>';
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
                        html += '<div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2.5 mb-1">Theo thanh toán</div>';
                        pays.forEach(p => {
                            const mName = payLabels[(p.method || '').toLowerCase()] || p.method || 'Khác';
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
                        <th>Chỉ tiêu P&amp;L</th>
                        <th class="col-right">${m2.label}</th>
                        <th class="col-right">${m1.label}</th>
                        <th class="col-right text-teal-300">${m0.label} (Kỳ chọn)</th>
                        <th class="col-right">Biến động vs ${m1.label}</th>
                    </tr>
                `;
                const rowsDef = [
                    { label: 'Số đơn hoàn tất', key: 'order_count', isCount: true, goodUp: true },
                    { label: 'Doanh thu thuần', key: 'revenue', bold: true, cls: 'text-emerald-300', goodUp: true },
                    { label: '(-) Giá vốn hàng bán (COGS)', key: 'cogs', cls: 'text-amber-300', goodUp: false },
                    { label: '(=) Lợi nhuận gộp', key: 'gross_profit', bold: true, cls: 'text-sky-300', goodUp: true },
                    { label: 'Biên lợi nhuận gộp (%)', key: 'gross_margin_pct', isPct: true, goodUp: true },
                    { label: '(-) Lương &amp; Thưởng nhân sự', key: 'total_labor', cls: 'text-purple-300', goodUp: false },
                    { label: '(-) Chi phí vận hành (OPEX)', key: 'opex_expenses', cls: 'text-amber-400', goodUp: false },
                    { label: '(-) Chi quầy &amp; Hao hụt / Lệch két', key: 'loss_shortage', cls: 'text-rose-300', goodUp: false },
                    { label: '(=) Lợi nhuận ròng (Net Profit)', key: 'net_profit', bold: true, isNet: true, goodUp: true },
                    { label: 'Biên lợi nhuận ròng (%)', key: 'net_margin_pct', isPct: true, goodUp: true }
                ];
                cmpBody.innerHTML = rowsDef.map(r => {
                    const fmt = (val) => {
                        if (r.isCount) return `${Number(val || 0)} đơn`;
                        if (r.isPct) return `${Number(val || 0).toFixed(1)}%`;
                        return `${this.formatMoney(val || 0)} đ`;
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
                            momHtml = `<span class="text-sky-300 font-mono text-[11px]">Mới phát sinh</span>`;
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
            const nowMs = Date.now();
            if (nowMs - this._lastMasterCheckAt > 55000) {
                this._lastMasterCheckAt = nowMs;
                await fetch('/api/system/updates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'check' })
                }).catch(() => {});
            }
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

            const unread = Array.isArray(data.notifications)
                ? data.notifications.find(n => Number(n.is_read) === 0)
                : null;
            const hasAlert = Boolean(data.has_update || unread);
            const isOta = Boolean(data.has_update || (unread && unread.type === 'SYSTEM_UPDATE'));
            this._pendingSystemUpdate = hasAlert ? {
                isOta,
                version: (unread && unread.version) || data.latest_version || '',
                title: (unread && unread.title) || data.update_title || 'Có bản cập nhật mới từ Master',
                message: (unread && unread.message) || data.update_message || ''
            } : null;

            if (dotEl) dotEl.classList.toggle('hidden', !hasAlert);
            if (badgeEl) {
                badgeEl.title = hasAlert
                    ? `Có cập nhật mới${this._pendingSystemUpdate.version ? ' (v' + this._pendingSystemUpdate.version + ')' : ''} — Bấm vào đây để cập nhật ngay!`
                    : 'Chủ Quán (Admin) • Bấm để kiểm tra cập nhật hệ thống';
            }
            if (!banner) return;

            if (hasAlert) {
                banner.classList.remove('hidden');
                if (titleEl) titleEl.textContent = this._pendingSystemUpdate.title;
                if (msgEl) {
                    const ver = this._pendingSystemUpdate.version;
                    msgEl.textContent = (ver ? `[v${ver}] ` : '') + this._pendingSystemUpdate.message;
                }
                if (applyBtn) applyBtn.classList.toggle('hidden', !isOta);
            } else {
                banner.classList.add('hidden');
            }
        } catch (e) {}
    },

    async handleAdminBadgeUpdateClick(btn) {
        try {
            await fetch('/api/system/updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check' })
            });
        } catch (e) {}
        await this.loadSystemUpdates();
        if (this._pendingSystemUpdate && this._pendingSystemUpdate.isOta) {
            await this.applySystemUpdate(null);
            return;
        }
        if (this._pendingSystemUpdate) {
            const banner = document.getElementById('system-update-banner');
            if (banner) banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
            alert(`${this._pendingSystemUpdate.title}\n${this._pendingSystemUpdate.message}`);
            return;
        }
        alert('Hệ thống Store đang ở phiên bản mới nhất, chưa có bản cập nhật mới từ Master.');
    },

    async applySystemUpdate(btn) {
        if (!confirm('Tải bản vá mới từ Master và chép đè lên hệ thống Store hiện tại?')) return;
        const orig = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...'; }
        try {
            const res = await fetch('/api/system/updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'apply' })
            });
            const data = await res.json();
            alert(data.message || (data.success ? 'Cập nhật thành công!' : 'Cập nhật thất bại!'));
            if (data.success) {
                await this.dismissSystemUpdate();
                if (data.restarting) {
                    setTimeout(() => window.location.reload(), 4500);
                } else {
                    window.location.reload();
                }
            }
        } catch (e) {
            alert('Lỗi cập nhật: ' + e.message);
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
        } catch (e) {}
    },

    _licensedModules: null,
    _blockedModules: [],

    isModuleAllowed(modCode) {
        if (!this._licensedModules) return true;
        if (this._blockedModules.includes(modCode)) return false;
        const stripped = modCode.startsWith('mod_') ? modCode.slice(4) : modCode;
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
                    <div class="text-base font-bold text-white">Module chưa được cấp phép hoặc đã bị Master tắt/khóa</div>
                    <div class="text-xs text-slate-400 mt-1">Mã module: <span class="font-mono text-rose-300">${modCode}</span> • Vui lòng bật lại trên Máy chủ Master SaaS.</div>
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
                await fetch('/api/license_client.php?action=sync_now').catch(() => {});
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
                { sel: '#promo-engine-card', code: 'promo_voucher_engine', allowClickForLockScreen: false }
            ];
            subTabMap.forEach(({ sel, code, allowClickForLockScreen }) => {
                const allowed = this.isModuleAllowed(code);
                document.querySelectorAll(sel).forEach(el => {
                    el.classList.toggle('opacity-40', !allowed);
                    if (!allowClickForLockScreen) {
                        el.classList.toggle('pointer-events-none', !allowed);
                    } else {
                        el.classList.remove('pointer-events-none');
                    }
                    el.title = allowed ? '' : `Module [${code}] chưa được cấp phép hoặc đã bị Master tắt/khóa`;
                    let lockIcon = el.querySelector('.cn-mod-lock');
                    if (!allowed && !lockIcon) {
                        lockIcon = document.createElement('i');
                        lockIcon.className = 'fas fa-lock text-rose-400 text-[10px] cn-mod-lock ml-1';
                        el.appendChild(lockIcon);
                    } else if (allowed && lockIcon) {
                        lockIcon.remove();
                    }
                });
            });

            this.applySubviewLicenseLock('inventory', 'inventory_recipes', this.isModuleAllowed('inventory_recipes'));
            this.applySubviewLicenseLock('payroll', 'staff_shifts', this.isModuleAllowed('staff_shifts'));
            this.applySubviewLicenseLock('kpi', 'staff_kpi', this.isModuleAllowed('staff_kpi'));

            Object.entries(tabModuleMap).forEach(([tab, modCode]) => {
                const allowed = this.isModuleAllowed(modCode);
                const btn = document.querySelector(`.admin-sub-btn[data-tab="${tab}"]`);
                if (btn) {
                    btn.classList.toggle('opacity-40', !allowed);
                    let lockIcon = btn.querySelector('.cn-mod-lock');
                    if (!allowed && !lockIcon) {
                        lockIcon = document.createElement('i');
                        lockIcon.className = 'fas fa-lock text-rose-400 text-[10px] cn-mod-lock ml-1';
                        btn.appendChild(lockIcon);
                    } else if (allowed && lockIcon) {
                        lockIcon.remove();
                    }
                }
                const section = document.getElementById(`tab-${tab}`);
                if (section) {
                    let lockOverlay = section.querySelector('.cn-module-lock-screen');
                    if (!allowed) {
                        if (!lockOverlay) {
                            lockOverlay = document.createElement('div');
                            lockOverlay.className = 'cn-module-lock-screen p-10 text-center rounded-2xl border border-rose-500/30 bg-rose-950/20 my-4';
                            lockOverlay.innerHTML = `
                                <i class="fas fa-lock text-4xl text-rose-400 mb-3"></i>
                                <div class="text-base font-bold text-white">Module chưa được cấp phép hoặc đã bị Master tắt/khóa</div>
                                <div class="text-xs text-slate-400 mt-1">Mã module: <span class="font-mono text-rose-300">${modCode}</span> • Vui lòng bật lại trên Máy chủ Master SaaS.</div>
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
            if (jukePill) jukePill.classList.toggle('hidden', !mediaAllowed);
            if (!mediaAllowed && typeof JukeboxPlayer !== 'undefined' && JukeboxPlayer.audio && !JukeboxPlayer.audio.paused) {
                JukeboxPlayer.audio.pause();
            }
        } catch (e) {}
    },

    async deleteFinanceExpense(id) {
        if (!confirm('Bạn có chắc muốn xóa khoản chi này không?')) return;
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
                alert(data.message || 'Lỗi xóa khoản chi');
            }
        } catch (e) {
            alert('Lỗi: ' + e.message);
        }
    },

    async verifyAndSaveGeminiKey(btn) {
        const keyInput = document.getElementById('setting-gemini-api-key');
        const keyVal = keyInput ? keyInput.value.trim() : '';
        if (!keyVal) {
            alert('Vui lòng dán mã Gemini API Key trước khi kiểm tra!');
            return;
        }
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang kiểm tra...';
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
                alert(data.message || 'Kiểm tra thành công! Key đã được lưu và ẩn bảo mật.');
            } else {
                alert(data.message || 'API Key không hợp lệ!');
            }
        } catch (e) {
            alert('Lỗi kiểm tra API Key: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
        }
    },

    async deleteLocalGeminiKey() {
        if (!confirm('Xóa Gemini API Key dự phòng tại quán để chuyển sang dùng CyberNexus Master AI Proxy?')) return;
        try {
            const res = await fetch('/api/admin?action=save_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                alert('Đã xóa Key dự phòng tại quán! Hệ thống đã chuyển sang dùng CyberNexus Master AI Proxy.');
            } else {
                alert(data.message || 'Không thể xóa Key!');
            }
        } catch (e) {
            alert('Lỗi kết nối: ' + e.message);
        }
    },

    async markExpensePaid(id) {
        if (!confirm('Xác nhận đã thanh toán khoản công nợ nhà cung cấp này?')) return;
        try {
            const res = await fetch('api/finance.php?action=mark_expense_paid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) this.loadFinance();
            else alert(data.message || 'Không thể cập nhật');
        } catch (e) {
            alert('Lỗi: ' + e.message);
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
                    <h4 class="font-bold text-sm text-teal-300"><i class="fas fa-file-invoice-dollar mr-1.5"></i>Ghi nhận Chi Phí / Công Nợ NCC</h4>
                    <button type="button" onclick="document.getElementById('fin-dynamic-modal').remove()" class="text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                </div>
                <div class="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                        <label class="text-slate-400 block mb-1">Ngày phát sinh</label>
                        <input id="fin-exp-date" type="date" value="${today}" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white" />
                    </div>
                    <div>
                        <label class="text-slate-400 block mb-1">Phân loại chi phí</label>
                        <select id="fin-exp-cat" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white">
                            <option value="Mặt Bằng">Mặt Bằng</option>
                            <option value="Điện Nước & Internet">Điện Nước & Internet</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Vận Hành & Vật Tư">Vận Hành & Vật Tư</option>
                            <option value="Thưởng & Phụ Cấp">Thưởng & Phụ Cấp</option>
                            <option value="Nguyên Vật Liệu">Nguyên Vật Liệu</option>
                            <option value="Khác">Khác</option>
                        </select>
                    </div>
                </div>
                <div class="text-xs">
                    <label class="text-slate-400 block mb-1">Nội dung chi / Hạng mục</label>
                    <input id="fin-exp-desc" type="text" placeholder="VD: Tiền thuê mặt bằng T11, Thưởng KPI..." class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white" />
                </div>
                <div class="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                        <label class="text-slate-400 block mb-1">Nhà cung cấp / Người nhận</label>
                        <input id="fin-exp-sup" type="text" placeholder="VD: Điện lực EVN, NCC A..." class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white" />
                    </div>
                    <div>
                        <label class="text-slate-400 block mb-1">Trạng thái thanh toán</label>
                        <select id="fin-exp-status" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white">
                            <option value="paid">Đã thanh toán ngay</option>
                            <option value="unpaid">Ghi nhận Công nợ phải trả</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                        <label class="text-slate-400 block mb-1">Số tiền (VNĐ)</label>
                        <input id="fin-exp-amt" type="number" min="0" placeholder="0" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-amber-300 font-mono font-bold" />
                    </div>
                    <div>
                        <label class="text-slate-400 block mb-1">VAT đầu vào (VNĐ)</label>
                        <input id="fin-exp-vat" type="number" min="0" value="0" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-emerald-300 font-mono" />
                    </div>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-white/10">
                    <button type="button" onclick="document.getElementById('fin-dynamic-modal').remove()" class="btn-glass text-xs py-1.5 px-3 bg-slate-800 text-slate-300">Hủy</button>
                    <button type="button" onclick="Admin.submitFinExpense()" class="btn-glass text-xs py-1.5 px-4 bg-teal-500/30 text-teal-200 border-teal-400/40 font-bold">Lưu khoản chi</button>
                </div>
            </div>
        `;
    },

    async submitFinExpense() {
        const payload = {
            expense_date: document.getElementById('fin-exp-date')?.value || '',
            category: document.getElementById('fin-exp-cat')?.value || 'Khác',
            description: document.getElementById('fin-exp-desc')?.value?.trim() || '',
            supplier: document.getElementById('fin-exp-sup')?.value?.trim() || '',
            payment_status: document.getElementById('fin-exp-status')?.value || 'paid',
            amount: Number(document.getElementById('fin-exp-amt')?.value || 0),
            vat_amount: Number(document.getElementById('fin-exp-vat')?.value || 0)
        };
        if (!payload.amount || payload.amount <= 0) {
            alert('Vui lòng nhập số tiền lớn hơn 0!');
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
                alert(data.message || 'Lỗi lưu khoản chi');
            }
        } catch (e) {
            alert('Lỗi: ' + e.message);
        }
    },

    async openFinTaxModal() {
        let cfg = { finance_vat_rate: '8', finance_pit_rate: '1.5', finance_fixed_cost: '0' };
        try {
            const res = await fetch('api/finance.php?action=get_tax_settings').then(r => r.json());
            if (res && res.success && res.data) cfg = { ...cfg, ...res.data };
        } catch (e) {}

        let modal = document.getElementById('fin-dynamic-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'fin-dynamic-modal';
            modal.className = 'fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="liquid-glass rounded-2xl border border-amber-500/30 w-full max-w-sm p-5 space-y-3 bg-slate-900/95">
                <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <h4 class="font-bold text-sm text-amber-300"><i class="fas fa-percent mr-1.5"></i>Cấu hình Thuế &amp; Định phí</h4>
                    <button type="button" onclick="document.getElementById('fin-dynamic-modal').remove()" class="text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                </div>
                <div class="space-y-2.5 text-xs">
                    <div>
                        <label class="text-slate-400 block mb-1">Thuế suất VAT mặc định (%)</label>
                        <input id="fin-tax-vat" type="number" step="0.1" value="${cfg.finance_vat_rate}" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white font-mono" />
                    </div>
                    <div>
                        <label class="text-slate-400 block mb-1">Thuế TNCN / Hộ KD (%)</label>
                        <input id="fin-tax-pit" type="number" step="0.1" value="${cfg.finance_pit_rate}" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white font-mono" />
                    </div>
                    <div>
                        <label class="text-slate-400 block mb-1">Định phí dự phòng tháng (VNĐ)</label>
                        <input id="fin-tax-fixed" type="number" step="10000" value="${cfg.finance_fixed_cost}" class="liquid-input w-full py-1.5 px-2.5 bg-slate-950 text-white font-mono" />
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
        const payload = {
            finance_vat_rate: document.getElementById('fin-tax-vat')?.value || '8',
            finance_pit_rate: document.getElementById('fin-tax-pit')?.value || '1.5',
            finance_fixed_cost: document.getElementById('fin-tax-fixed')?.value || '0'
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
            alert('Chưa có dữ liệu báo cáo để xuất CSV!');
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
                    lockText.innerHTML = `<b>LƯU Ý:</b> ${data.message || 'Module Cà thẻ tín dụng đang bị KHÓA CƯỠNG CHẾ bởi Quản trị viên CyberNexus Master.'}`;
                } else if (data.module_state === 'OFF') {
                    lockBanner.classList.remove('hidden');
                    lockBanner.className = 'p-3 rounded-xl bg-amber-950/70 border border-amber-500/50 text-xs text-amber-200 flex items-center gap-2.5';
                    lockText.innerHTML = `<b>LƯU Ý:</b> ${data.message || 'Module Cà thẻ tín dụng đang ở trạng thái TẮT trên gói bản quyền.'}`;
                } else {
                    lockBanner.classList.add('hidden');
                }
            }

            // Fill Config Inputs
            const cfg = data.config || {};
            const elModel = document.getElementById('ecr-cfg-model-code');
            const elBank = document.getElementById('ecr-cfg-acquirer-bank');
            const elConn = document.getElementById('ecr-cfg-conn-type');
            const elIp = document.getElementById('ecr-cfg-ip');
            const elPort = document.getElementById('ecr-cfg-port');
            const elTid = document.getElementById('ecr-cfg-tid');
            const elMid = document.getElementById('ecr-cfg-mid');
            const elSecret = document.getElementById('ecr-cfg-secret');
            const elSurcharge = document.getElementById('ecr-cfg-surcharge');
            const elSim = document.getElementById('ecr-cfg-sim-behavior');
            const elMasterFee = document.getElementById('ecr-cfg-master-fee-display');

            if (elModel && cfg.model_code) elModel.value = cfg.model_code;
            if (elBank && cfg.acquirer_bank) elBank.value = cfg.acquirer_bank;
            if (elConn && cfg.connection_type) elConn.value = cfg.connection_type;
            if (elIp && cfg.terminal_ip) elIp.value = cfg.terminal_ip;
            if (elPort && cfg.terminal_port) elPort.value = cfg.terminal_port;
            if (elTid && cfg.tid) elTid.value = cfg.tid;
            if (elMid && cfg.mid) elMid.value = cfg.mid;
            if (elSecret && cfg.secret_key) elSecret.value = cfg.secret_key;
            if (elSurcharge) elSurcharge.value = cfg.customer_surcharge_percent ?? 0;
            if (elSim && cfg.simulation_behavior) elSim.value = cfg.simulation_behavior;

            if (elMasterFee) {
                elMasterFee.innerHTML = `<span>${Number(data.master_fee_percent ?? 0)}%</span><span class="text-[9px] text-slate-500">Do Master quy định</span>`;
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
            specsEl.textContent = `Chuẩn bảo mật: ${found.security_standard} • Giao thức: ${found.protocol} • Hỗ trợ: ${found.supported_interfaces}`;
        }
    },

    async saveCardTerminalConfig() {
        const payload = {
            model_code: document.getElementById('ecr-cfg-model-code')?.value || 'PAX_A920_PRO',
            acquirer_bank: document.getElementById('ecr-cfg-acquirer-bank')?.value || 'Vietcombank',
            connection_type: document.getElementById('ecr-cfg-conn-type')?.value || 'LAN_TCP',
            terminal_ip: document.getElementById('ecr-cfg-ip')?.value.trim() || '10.0.126.250',
            terminal_port: parseInt(document.getElementById('ecr-cfg-port')?.value || '10009', 10),
            tid: document.getElementById('ecr-cfg-tid')?.value.trim() || '88001234',
            mid: document.getElementById('ecr-cfg-mid')?.value.trim() || '000001088001234',
            secret_key: document.getElementById('ecr-cfg-secret')?.value.trim() || 'NEXUS-ECR-2026-KEY',
            customer_surcharge_percent: parseFloat(document.getElementById('ecr-cfg-surcharge')?.value || '0') || 0,
            simulation_behavior: document.getElementById('ecr-cfg-sim-behavior')?.value || 'AUTO_APPROVE'
        };

        try {
            const res = await fetch('/api/card/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert('Đã lưu cấu hình liên kết máy SmartPOS ECR thành công!');
                this.loadCardTerminalAdmin();
            } else {
                alert(data.message || 'Lỗi lưu cấu hình máy POS');
            }
        } catch (e) {
            alert('Lỗi kết nối máy chủ: ' + e.message);
        }
    },

    async testCardTerminalConnection() {
        const resultEl = document.getElementById('ecr-handshake-result');
        if (resultEl) {
            resultEl.classList.remove('hidden');
            resultEl.className = 'p-2.5 rounded-xl bg-slate-950/90 border border-sky-500/30 text-xs font-mono text-sky-300';
            resultEl.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i>Đang gửi gói tin ECHO TEST / HANDSHAKE sang SmartPOS...';
        }

        try {
            const res = await fetch('/api/card/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (resultEl) {
                if (data.success && data.status === 'CONNECTED') {
                    resultEl.className = 'p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-xs font-mono text-emerald-300';
                    resultEl.innerHTML = `<i class="fas fa-circle-check mr-1.5"></i><b>${data.message}</b> • Máy: ${data.terminal_name} • Firmware: ${data.firmware || 'v3.2'} • Độ trễ: ${data.latency_ms || 12}ms`;
                } else {
                    resultEl.className = 'p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs font-mono text-rose-300';
                    resultEl.innerHTML = `<i class="fas fa-triangle-exclamation mr-1.5"></i>${data.message || 'Không thể bắt tay với SmartPOS'}`;
                }
            }
        } catch (e) {
            if (resultEl) {
                resultEl.className = 'p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs font-mono text-rose-300';
                resultEl.innerHTML = `<i class="fas fa-triangle-exclamation mr-1.5"></i>Lỗi kết nối: ${e.message}`;
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
                badge.textContent = `Lô hiện tại: ${countApproved} GD • ${this.formatMoney(sumApproved)} đ`;
            }

            if (!tbody) return;
            if (txs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-slate-500">Chưa có giao dịch cà thẻ nào.</td></tr>';
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
                    ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30">ĐÃ KẾT TOÁN</span>`
                    : `<span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-400">CHỜ KẾT TOÁN</span>`;

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
                                <button type="button" onclick="Admin.voidCardTransaction(${t.id}, '${t.trace_no}', ${t.total_charged})" class="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition">
                                    <i class="fas fa-ban mr-0.5"></i> HỦY (VOID)
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
        const reason = prompt(`Xác nhận HỦY (VOID) giao dịch thẻ Trace #${traceNo} (${this.formatMoney(amount)} đ)?\nNhập lý do hủy (Audit Trail):`, 'Khách yêu cầu hủy / Thu ngân thanh toán nhầm');
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
                alert(data.message || 'Đã hủy giao dịch thẻ thành công!');
                this.loadCardTransactions();
            } else {
                alert(data.message || 'Không thể hủy giao dịch');
            }
        } catch (e) {
            alert('Lỗi kết nối hủy giao dịch: ' + e.message);
        }
    },

    async settleCardBatch() {
        if (!confirm('Xác nhận KẾT TOÁN LÔ (BATCH SETTLEMENT) cho toàn bộ giao dịch thẻ SmartPOS hiện tại?\n\nToàn bộ tiền sẽ được ngân hàng chốt phiên và đối soát vào tài khoản quán.')) {
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
                alert(`${data.message}\n\n• Số giao dịch: ${s.settled_count || 0}\n• Tổng tiền: ${this.formatMoney(s.total_amount)} đ\n• Số lô mới: ${data.batch_number}`);
                this.loadCardTransactions();
            } else {
                alert(data.message || 'Lỗi kết toán lô');
            }
        } catch (e) {
            alert('Lỗi kết nối kết toán lô: ' + e.message);
        }
    },

    async loadPromotions() {
        const listEl = document.getElementById('promo-list-container');
        if (!listEl) return;
        try {
            const res = await fetch('api/promotions.php?action=list').then(r => r.json());
            if (!res || !res.success) {
                listEl.innerHTML = `<div class="text-[11px] text-slate-500 italic">${(res && res.message) || 'Chưa tải được danh sách khuyến mãi.'}</div>`;
                return;
            }
            const rows = Array.isArray(res.data) ? res.data : [];
            this._promotionsCache = rows;
            if (rows.length === 0) {
                listEl.innerHTML = '<div class="text-[11px] text-slate-500 italic p-3 rounded-xl bg-slate-950/50 border border-white/5 text-center">Chưa có chương trình khuyến mãi nào. Bấm "Tạo Khuyến Mãi" để bắt đầu.</div>';
                return;
            }
            listEl.innerHTML = rows.map(p => {
                const isActive = Number(p.is_active) === 1;
                const valTxt = p.discount_type === 'percent'
                    ? `${p.discount_value}%${Number(p.max_discount_amount) > 0 ? ` (tối đa ${this.formatMoney(p.max_discount_amount)}đ)` : ''}`
                    : `${this.formatMoney(p.discount_value)}đ`;
                const limitTxt = Number(p.usage_limit) > 0 ? `${p.used_count || 0}/${p.usage_limit} lượt` : `${p.used_count || 0} lượt (∞)`;
                const timeTxt = (p.start_time || p.end_time) ? ` • Giờ vàng ${p.start_time || '00:00'}–${p.end_time || '23:59'}` : '';
                const dateTxt = (p.start_date || p.end_date) ? ` • ${p.start_date || '...'} → ${p.end_date || '...'}` : '';
                return `
                    <div class="p-3 rounded-xl ${isActive ? 'bg-slate-950/75 border border-emerald-500/30' : 'bg-slate-950/40 border border-white/5 opacity-60'} flex flex-wrap items-center justify-between gap-2">
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-1.5">
                                <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 font-mono font-black text-[11px]">${p.code}</span>
                                <b class="text-white text-xs">${p.name}</b>
                                <span class="px-1.5 py-0.5 rounded text-[10px] ${p.promo_mode === 'auto' ? 'bg-sky-500/20 text-sky-300' : 'bg-purple-500/20 text-purple-300'}">${p.promo_mode === 'auto' ? 'Tự động áp' : 'Mã Voucher'}</span>
                            </div>
                            <div class="text-[11px] text-slate-400">
                                Giảm <b class="text-emerald-300">${valTxt}</b>${Number(p.min_order_amount) > 0 ? ` • Đơn từ ${this.formatMoney(p.min_order_amount)}đ` : ''}${dateTxt}${timeTxt}
                            </div>
                            <div class="text-[10px] font-mono text-slate-400">
                                Đã dùng: <b class="text-sky-300">${limitTxt}</b> • Tổng giảm: <b class="text-rose-300">${this.formatMoney(p.total_discount_given || 0)}đ</b> • Doanh thu: <b class="text-emerald-300">${this.formatMoney(p.net_revenue_generated || 0)}đ</b>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button type="button" onclick="Admin.togglePromotion(${p.id})" class="px-2.5 py-1 rounded-lg ${isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-white/10'} border text-[10px] font-bold">${isActive ? 'Đang bật' : 'Đã tắt'}</button>
                            <button type="button" onclick="Admin.openPromoFormModal(${p.id})" class="px-2 py-1 rounded-lg bg-sky-500/20 text-sky-300 text-[10px]" title="Sửa"><i class="fas fa-pen"></i></button>
                            <button type="button" onclick="Admin.deletePromotion(${p.id})" class="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[10px]" title="Xóa"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {}
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
            alert(res.message || 'Không thể lưu khuyến mãi');
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
        if (!confirm('Xóa chương trình khuyến mãi này?')) return;
        await fetch('api/promotions.php?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        await this.loadPromotions();
    }
});
