/**
 * Master Admin Module: Finance Reports, Cashbook & SmartPOS ECR
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
            const [repRes, expRes, auditRes] = await Promise.all([
                fetch(`api/finance.php?action=get_report&month=${month}`).then(r => r.json()).catch(() => ({})),
                fetch(`api/finance.php?action=list_expenses&month=${month}`).then(r => r.json()).catch(() => ({})),
                fetch(`api/finance.php?action=audit_and_shifts`).then(r => r.json()).catch(() => ({}))
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
                                <td><span class="font-mono text-[11px] text-slate-400 whitespace-nowrap">${l.created_at || '-'}</span></td>
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
                                    <div class="font-mono text-[10px] text-slate-300">Mở: ${s.opened_at || '-'}</div>
                                    <div class="font-mono text-[10px] text-slate-400">Kết: ${s.closed_at || 'Đang trực ca'}</div>
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

            const summary = (repRes && repRes.summary) || { revenue: 0, expenses: 0, net_profit: 0 };
            const kpiContainer = document.getElementById('fin-kpi-cards');
            if (kpiContainer) {
                kpiContainer.innerHTML = `
                    <div class="liquid-glass-card p-3 border-l-4 border-emerald-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DOANH THU THỰC</span>
                        <div class="text-xl font-black text-emerald-400 font-mono mt-1">${this.formatMoney(summary.revenue)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Tổng thu hóa đơn hoàn tất</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-amber-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TỔNG CHI PHÍ</span>
                        <div class="text-xl font-black text-amber-400 font-mono mt-1">${this.formatMoney(summary.expenses)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Các khoản chi ghi nhận</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 ${summary.net_profit >= 0 ? 'border-sky-400' : 'border-rose-400'}">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">LỢI NHUẬN RÒNG</span>
                        <div class="text-xl font-black ${summary.net_profit >= 0 ? 'text-sky-400' : 'text-rose-400'} font-mono mt-1">${this.formatMoney(summary.net_profit)} đ</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Doanh thu trừ chi phí</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-purple-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TỶ SUẤT LỢI NHUẬN</span>
                        <div class="text-xl font-black text-purple-400 font-mono mt-1">${summary.revenue > 0 ? ((summary.net_profit / summary.revenue) * 100).toFixed(1) : '0'}%</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Hiệu quả dòng tiền</span>
                    </div>
                    <div class="liquid-glass-card p-3 border-l-4 border-teal-400">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SỐ KHOẢN CHI</span>
                        <div class="text-xl font-black text-teal-400 font-mono mt-1">${(expRes && expRes.data) ? expRes.data.length : 0}</div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">Phiếu chi tháng ${month}</span>
                    </div>
                `;
            }

            const expTbody = document.getElementById('fin-expense-tbody');
            if (expTbody) {
                const list = (expRes && expRes.data) ? expRes.data : [];
                if (list.length === 0) {
                    expTbody.innerHTML = this.renderEmptyState(7, 'fa-file-invoice-dollar', 'Chưa có khoản chi nào trong kỳ', 'Bấm nút "Thêm chi phí" ở trên để ghi nhận các khoản chi phát sinh trong tháng.');
                } else {
                    let html = '';
                    list.forEach(item => {
                        html += `
                            <tr class="hover:bg-sky-500/[0.04] transition-colors">
                                <td><span class="font-mono text-xs text-slate-300 whitespace-nowrap">${item.expense_date || '-'}</span></td>
                                <td><span class="saas-badge bg-teal-500/15 text-teal-300 border border-teal-500/30 whitespace-nowrap">${item.category || 'Khác'}</span></td>
                                <td class="col-name"><span class="text-xs font-medium text-white whitespace-nowrap">${item.description || '-'}</span></td>
                                <td><span class="text-xs text-slate-400 whitespace-nowrap">${item.supplier || '-'}</span></td>
                                <td class="col-money"><span class="font-mono font-bold text-amber-300 text-xs whitespace-nowrap">${this.formatMoney(item.amount)} đ</span></td>
                                <td class="col-money"><span class="font-mono text-slate-400 text-xs whitespace-nowrap">${this.formatMoney(item.vat_amount || 0)} đ</span></td>
                                <td class="col-right">
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
                const groups = (repRes && repRes.expense_groups) ? repRes.expense_groups : [];
                if (groups.length === 0) {
                    expGroups.innerHTML = '<div class="text-xs text-slate-400 py-4 text-center italic">Chưa có phân loại chi phí trong tháng này</div>';
                } else {
                    let gHtml = '';
                    groups.forEach(g => {
                        gHtml += `
                            <div class="flex items-center justify-between text-xs py-1 border-b border-white/5">
                                <span class="text-slate-300">${g.category || 'Khác'} (${g.count} phiếu)</span>
                                <span class="font-mono font-bold text-amber-400">${this.formatMoney(g.amount)} đ</span>
                            </div>
                        `;
                    });
                    expGroups.innerHTML = gHtml;
                }
            }
        } catch (e) {
            console.error('Error loading finance:', e);
        }
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
    }
});
