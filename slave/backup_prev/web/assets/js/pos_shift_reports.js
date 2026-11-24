/**
 * CyberNexus OS — Extracted module from pos.js (POS)
 */
Object.assign(POS, {
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
                    <p>${window.cnxT?window.cnxT('js.s_shift.877e7db3','Đang tải dữ liệu Ca làm việc & Sổ quỹ...'):'Đang tải dữ liệu Ca làm việc & Sổ quỹ...'}</p>
                </div>
            </div>
        `;
        modal.classList.add('open');

        try {
            const res = await fetch('api/finance.php?action=shift_status');
            const data = await res.json();
            if (!data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_shift.571fa29c','Lỗi tải trạng thái ca'):'Lỗi tải trạng thái ca'));

            if (!data.has_open_shift || !data.shift) {
                modal.innerHTML = `
                    <div class="liquid-glass liquid-modal-content p-6 w-[460px] max-w-[95vw] text-white shadow-2xl border border-amber-500/40">
                        <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                            <div class="flex items-center gap-2">
                                <span class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                                    <i class="fas fa-cash-register"></i>
                                </span>
                                <div>
                                    <h3 class="font-bold text-base text-amber-300">${window.cnxT?window.cnxT('js.s_shift.56c19bbd','MỞ CA LÀM VIỆC MỚI'):'MỞ CA LÀM VIỆC MỚI'}</h3>
                                    <p class="text-[11px] text-slate-400">${window.cnxT?window.cnxT('js.s_shift.9ca73ce7','Khai báo tiền mặt đầu ca (tiền lẻ trong két)'):'Khai báo tiền mặt đầu ca (tiền lẻ trong két)'}</p>
                                </div>
                            </div>
                            <button type="button" class="text-slate-400 hover:text-white text-xl" onclick="document.getElementById('pos-shift-modal').classList.remove('open')">&times;</button>
                        </div>

                        <div class="mb-3">
                            <label class="block text-xs font-semibold text-slate-300 mb-1.5">${window.cnxT?window.cnxT('js.s_shift.45751250','Tiền mặt đầu ca trong két (VNĐ):'):'Tiền mặt đầu ca trong két (VNĐ):'}</label>
                            <input type="number" id="shift-opening-cash-input" value="500000" class="liquid-input w-full font-mono text-lg font-bold text-amber-300 py-2 px-3" />
                            <div class="flex gap-1.5 mt-1.5">
                                <button type="button" class="px-2 py-1 rounded bg-slate-800 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('shift-opening-cash-input').value=500000">${window.cnxT?window.cnxT('js.s_shift.07b66ef2','500.000đ'):'500.000đ'}</button>
                                <button type="button" class="px-2 py-1 rounded bg-slate-800 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('shift-opening-cash-input').value=1000000">${window.cnxT?window.cnxT('js.s_shift.1746a415','1.000.000đ'):'1.000.000đ'}</button>
                                <button type="button" class="px-2 py-1 rounded bg-slate-800 text-[11px] text-slate-300 border border-white/10" onclick="document.getElementById('shift-opening-cash-input').value=2000000">${window.cnxT?window.cnxT('js.s_shift.99a030b0','2.000.000đ'):'2.000.000đ'}</button>
                            </div>
                        </div>

                        <div class="mb-4">
                            <label class="block text-xs font-semibold text-slate-300 mb-1.5">${window.cnxT?window.cnxT('js.s_shift.f5a55cdc','Ghi chú nhận ca:'):'Ghi chú nhận ca:'}</label>
                            <input type="text" id="shift-opening-note-input" value="Nhận ca tiêu chuẩn" class="liquid-input w-full text-xs py-2 px-3" />
                        </div>

                        <div class="flex justify-end gap-2">
                            <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('pos-shift-modal').classList.remove('open')">${window.cnxT?window.cnxT('ui.pos_html.button_cee55387','Đóng'):'Đóng'}</button>
                            <button type="button" class="btn-glass-success text-xs py-2 px-4 font-bold" onclick="POS.submitOpenShift()">
                                <i class="fas fa-play mr-1"></i> ${window.cnxT?window.cnxT('js.s_shift.7f3a67c1','Bắt Đầu Mở Ca'):'Bắt Đầu Mở Ca'}
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            const s = data.shift;
            const txs = data.transactions || [];
            const isBlind = !!data.blind_handover;
            const openOrdersCnt = Number(data.open_orders_count || 0);
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
                                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap shrink-0">${window.cnxT?window.cnxT('js.s_shift.03e52278','ĐANG MỞ CA'):'ĐANG MỞ CA'}</span>
                                    ${isBlind ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 whitespace-nowrap shrink-0"><i class="fas fa-eye-slash mr-1"></i>BLIND HANDOVER</span>' : ''}
                                </div>
                                <p class="text-[11px] text-slate-400">${window.cnxT?window.cnxT('js.s_shift.2b0c971b','Trực ca:'):'Trực ca:'} <b>${s.user_name}</b> ${window.cnxT?window.cnxT('js.s_shift.cf8f9591','• Mở lúc:'):'• Mở lúc:'} <span class="font-mono whitespace-nowrap">${openedAtFmt}</span></p>
                            </div>
                        </div>
                        <button type="button" class="text-slate-400 hover:text-white text-2xl shrink-0" onclick="document.getElementById('pos-shift-modal').classList.remove('open')">&times;</button>
                    </div>

                    ${openOrdersCnt > 0 ? `
                    <div class="mb-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
                        <i class="fas fa-triangle-exclamation text-amber-400 shrink-0"></i>
                        <span>${window.cnxT?window.cnxT('js.s_shift.67361026','Cảnh báo: Hiện còn'):'Cảnh báo: Hiện còn'} <b>${openOrdersCnt} đơn/bàn đang mở</b> ${window.cnxT?window.cnxT('js.s_shift.ba6b267e','chưa thanh toán. Nên hoàn tất hoặc bàn giao rõ trước khi kết ca!'):'chưa thanh toán. Nên hoàn tất hoặc bàn giao rõ trước khi kết ca!'}</span>
                    </div>` : ''}

                    ${(Number(s.refund_due_count || 0) > 0 || Number(s.extra_due_count || 0) > 0) ? `
                    <div class="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2">
                        <span><i class="fas fa-scale-balanced mr-1.5"></i>${window.cnxT?window.cnxT('js.s_shift.7db8844b','Có'):'Có'} <b>${Number(s.refund_due_count || 0)}</b> ${window.cnxT?window.cnxT('js.s_shift.a67c7661','đơn chờ hoàn tiền &amp;'):'đơn chờ hoàn tiền &amp;'} <b>${Number(s.extra_due_count || 0)}</b> ${window.cnxT?window.cnxT('js.s_shift.d83ea52b','đơn chờ thu thêm chưa tất toán!'):'đơn chờ thu thêm chưa tất toán!'}</span>
                        <button type="button" onclick="window.ReceiptTemplate?.openNoSaleDrawerModal()" class="btn-glass text-[10px] py-1 px-2.5 bg-amber-500/20 text-amber-200 border-amber-500/40 font-bold shrink-0">
                            <i class="fas fa-cash-register mr-1"></i> ${window.cnxT?window.cnxT('js.s_shift.b7e7125d','Mở Két (No-Sale)'):'Mở Két (No-Sale)'}
                        </button>
                    </div>` : `
                    <div class="mb-3 flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/50 px-3 py-1.5 rounded-xl border border-white/10">
                        <span>Audit trong ca: <b>${Number(s.void_count || 0)}</b> ${window.cnxT?window.cnxT('js.s_shift.3fdcb530','hủy đơn •'):'hủy đơn •'} <b>${Number(s.discount_count || 0)}</b> ${window.cnxT?window.cnxT('js.s_shift.1ab6a274','giảm giá •'):'giảm giá •'} <b>${Number(s.pending_void_count || 0)}</b> ${window.cnxT?window.cnxT('js.s_shift.ca35e68c','chờ duyệt hủy'):'chờ duyệt hủy'}</span>
                        <button type="button" onclick="window.ReceiptTemplate?.openNoSaleDrawerModal()" class="btn-glass text-[10px] py-1 px-2.5 bg-amber-500/20 text-amber-200 border-amber-500/40 font-bold">
                            <i class="fas fa-key mr-1"></i> ${window.cnxT?window.cnxT('js.s_shift.49148202','Mở Két Khẩn Cấp (No-Sale)'):'Mở Két Khẩn Cấp (No-Sale)'}
                        </button>
                    </div>`}

                    <!-- KPI Dòng Tiền Trong Ca -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                        <div class="p-2.5 rounded-xl bg-slate-900/80 border border-white/10">
                            <span class="text-[10px] text-slate-400 uppercase block">${window.cnxT?window.cnxT('js.s_shift.5cf49b73','Tiền mặt đầu ca'):'Tiền mặt đầu ca'}</span>
                            <span class="text-sm font-black font-mono text-slate-200">${this.formatMoney(s.opening_cash)}đ</span>
                        </div>
                        <div class="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/30">
                            <span class="text-[10px] text-emerald-300 uppercase block">${window.cnxT?window.cnxT('js.s_shift.a9341d66','+ Bán hàng Tiền mặt'):'+ Bán hàng Tiền mặt'}</span>
                            <span class="text-sm font-black font-mono text-emerald-400">${isBlind ? '🔒 Ẩn (Đếm két)' : `+${this.formatMoney(s.cash_sales)}${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`}</span>
                            <span class="text-[10px] text-sky-300 block mt-0.5">${isBlind ? 'CK/Thẻ tự động đối soát' : `CK/QR: ${this.formatMoney(s.banking_sales)}${window.cnxT?window.cnxT('js.s_shift.a3811d82','đ • Thẻ:'):'đ • Thẻ:'} ${this.formatMoney(s.card_sales || 0)}${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`}</span>
                        </div>
                        <div class="p-2.5 rounded-xl bg-slate-900/80 border border-rose-500/30">
                            <span class="text-[10px] text-rose-300 uppercase block">${window.cnxT?window.cnxT('js.s_shift.24cd65ff','Thu / Chi ngoài tại quầy'):'Thu / Chi ngoài tại quầy'}</span>
                            <span class="text-xs font-bold font-mono text-emerald-400">+${this.formatMoney(s.cash_in)}đ</span>
                            <span class="text-xs font-bold font-mono text-rose-400 ml-1.5">-${this.formatMoney(s.cash_out)}đ</span>
                        </div>
                        <div class="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/50">
                            <span class="text-[10px] text-amber-300 uppercase font-bold block">${window.cnxT?window.cnxT('js.s_shift.969af0be','= Tiền mặt lý thuyết'):'= Tiền mặt lý thuyết'}</span>
                            <span class="text-base font-black font-mono text-amber-400">${isBlind ? '🔒 Ẩn đến khi chốt' : `${this.formatMoney(s.expected_cash)}${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`}</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <!-- Lập Phiếu Thu / Chi Nhanh tại quầy -->
                        <div class="p-3.5 rounded-xl bg-slate-900/70 border border-white/10">
                            <h4 class="font-bold text-xs text-sky-300 uppercase mb-2.5 flex items-center gap-1.5">
                                <i class="fas fa-file-invoice-dollar"></i> ${window.cnxT?window.cnxT('js.s_shift.634a30fa','Lập Phiếu Thu / Chi Nhanh Tại Quầy'):'Lập Phiếu Thu / Chi Nhanh Tại Quầy'}
                            </h4>
                            <div class="space-y-2">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <select id="shift-tx-type" class="liquid-input w-full text-xs py-1.5 px-2">
                                        <option value="out">${window.cnxT?window.cnxT('js.s_shift.7fbdbd44','🔻 Phiếu Chi (Lấy tiền két)'):'🔻 Phiếu Chi (Lấy tiền két)'}</option>
                                        <option value="in">${window.cnxT?window.cnxT('js.s_shift.70415884','🔺 Phiếu Thu (Nộp thêm tiền lẻ)'):'🔺 Phiếu Thu (Nộp thêm tiền lẻ)'}</option>
                                    </select>
                                    <select id="shift-tx-cat" class="liquid-input w-full text-xs py-1.5 px-2">
                                        <option value="Nguyên Vật Liệu">${window.cnxT?window.cnxT('js.s_shift.b42d340c','Mua đá / Nguyên liệu gấp'):'Mua đá / Nguyên liệu gấp'}</option>
                                        <option value="Vận hành">${window.cnxT?window.cnxT('js.s_shift.f09af434','Chi phí vận hành / Ship'):'Chi phí vận hành / Ship'}</option>
                                        <option value="Tiền lẻ">${window.cnxT?window.cnxT('js.s_shift.ace1cb4a','Bổ sung tiền lẻ đầu ngày'):'Bổ sung tiền lẻ đầu ngày'}</option>
                                        <option value="Khác">${window.cnxT?window.cnxT('js.s_shift.b8112e74','Khoản thu/chi khác'):'Khoản thu/chi khác'}</option>
                                    </select>
                                </div>
                                <input type="number" id="shift-tx-amount" placeholder="Số tiền (VNĐ)..." class="liquid-input w-full text-xs font-mono font-bold py-1.5 px-2.5" />
                                <input type="text" id="shift-tx-reason" placeholder="Lý do chi tiết (VD: Mua 2 bao đá bi, mua sữa tươi)..." class="liquid-input w-full text-xs py-1.5 px-2.5" />
                                <button type="button" onclick="POS.submitCashTx()" class="w-full btn-glass-primary text-xs py-2 font-bold">
                                    <i class="fas fa-plus-circle mr-1"></i> ${window.cnxT?window.cnxT('js.s_shift.b0b12fbc','Lưu Phiếu & Đồng Bộ Kế Toán'):'Lưu Phiếu & Đồng Bộ Kế Toán'}
                                </button>
                            </div>
                        </div>

                        <!-- Kết Ca & Bàn Giao Tiền Mặt -->
                        <div class="p-3.5 rounded-xl bg-slate-900/70 border border-amber-500/30">
                            <h4 class="font-bold text-xs text-amber-300 uppercase mb-2.5 flex items-center gap-1.5">
                                <i class="fas fa-lock"></i> ${window.cnxT?window.cnxT('js.s_shift.dd735724','Kết Ca & Kiểm Đếm Tiền Mặt Thực Tế'):'Kết Ca & Kiểm Đếm Tiền Mặt Thực Tế'}
                            </h4>
                            <div class="space-y-2">
                                <div>
                                    <label class="block text-[11px] text-slate-300 mb-1">${window.cnxT?window.cnxT('js.s_shift.49e3a3ca','Tiền mặt thực đếm trong ngăn kéo (VNĐ):'):'Tiền mặt thực đếm trong ngăn kéo (VNĐ):'}</label>
                                    <input type="number" id="shift-actual-cash" value="${isBlind ? '' : Math.round(s.expected_cash)}" placeholder="${isBlind ? 'Tự đếm két rồi nhập số tiền thực tế...' : ''}" class="liquid-input w-full text-sm font-mono font-black text-emerald-400 py-1.5 px-2.5" />
                                </div>
                                <div>
                                    <label class="block text-[11px] text-slate-300 mb-1">${window.cnxT?window.cnxT('js.s_shift.f5d10872','Ghi chú bàn giao ca:'):'Ghi chú bàn giao ca:'}</label>
                                    <input type="text" id="shift-close-note" value="Đã kiểm đếm đủ bàn giao cuối ca" class="liquid-input w-full text-xs py-1.5 px-2.5" />
                                </div>
                                <label class="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer pt-0.5">
                                    <input type="checkbox" id="shift-also-checkout-att" class="w-3.5 h-3.5 text-amber-500 rounded border-slate-700 cursor-pointer" />
                                    <span>${window.cnxT?window.cnxT('js.s_shift.67b9562e','Đồng thời Check-out chấm công cá nhân khi kết ca'):'Đồng thời Check-out chấm công cá nhân khi kết ca'}</span>
                                </label>
                                <button type="button" onclick="POS.submitCloseShift()" class="w-full btn-glass text-xs py-2 bg-rose-600/80 hover:bg-rose-600 text-white border-rose-500 font-bold">
                                    <i class="fas fa-check-double mr-1"></i> ${window.cnxT?window.cnxT('js.s_shift.5b716c1e','Chốt Kết Ca & Gửi Báo Cáo Audit'):'Chốt Kết Ca & Gửi Báo Cáo Audit'}
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
                                    ${txRows || (window.cnxT?window.cnxT('js.s_shift.6f08122c','<tr><td colspan="4" class="py-3 text-center text-xs text-slate-500">Chưa có phiếu thu/chi ngoài nào trong ca này</td></tr>'):'<tr><td colspan="4" class="py-3 text-center text-xs text-slate-500">Chưa có phiếu thu/chi ngoài nào trong ca này</td></tr>')}
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
        const note = document.getElementById('shift-opening-note-input')?.value.trim() || (window.cnxT?window.cnxT('js.s_shift.4806c247','Mở ca chuẩn'):'Mở ca chuẩn');
        try {
            const res = await fetch('api/finance.php?action=open_shift', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ opening_cash: openingCash, note })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.message || (window.cnxT?window.cnxT('js.s_shift.3497b7ac','Lỗi mở ca'):'Lỗi mở ca'));
                return;
            }
            await this.openShiftModal();
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.s_shift.9b06250a','Lỗi kết nối khi mở ca'):'Lỗi kết nối khi mở ca'));
        }
    },

    async submitCashTx() {
        const transType = document.getElementById('shift-tx-type')?.value || 'out';
        const category = document.getElementById('shift-tx-cat')?.value || (window.cnxT?window.cnxT('ui.admin_html.option_cd0ec881','Khác'):'Khác');
        const amount = parseFloat(document.getElementById('shift-tx-amount')?.value) || 0;
        const reason = document.getElementById('shift-tx-reason')?.value.trim() || '';

        if (amount <= 0 || !reason) {
            alert((window.cnxT?window.cnxT('js.s_shift.f3c5f8f6','Vui lòng nhập Số tiền (> 0) và Lý do Thu/Chi cụ thể!'):'Vui lòng nhập Số tiền (> 0) và Lý do Thu/Chi cụ thể!'));
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
                alert(data.message || (window.cnxT?window.cnxT('js.s_shift.32c025ca','Lỗi lưu phiếu'):'Lỗi lưu phiếu'));
                return;
            }
            await this.openShiftModal();
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.s_shift.41d6876c','Lỗi kết nối khi lưu phiếu thu/chi'):'Lỗi kết nối khi lưu phiếu thu/chi'));
        }
    },

    async submitCloseShift() {
        const rawActual = document.getElementById('shift-actual-cash')?.value;
        const actualCash = parseFloat(rawActual);
        if (rawActual === '' || rawActual === undefined || Number.isNaN(actualCash) || actualCash < 0) {
            alert((window.cnxT?window.cnxT('js.s_shift.78c8a8a3','Vui lòng đếm két và nhập số tiền mặt thực tế hợp lệ!'):'Vui lòng đếm két và nhập số tiền mặt thực tế hợp lệ!'));
            return;
        }
        const note = document.getElementById('shift-close-note')?.value.trim() || (window.cnxT?window.cnxT('js.s_shift.5e2a1b32','Bàn giao cuối ca'):'Bàn giao cuối ca');
        const alsoCheckout = !!document.getElementById('shift-also-checkout-att')?.checked;
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_shift.55ee8b8c','Xác nhận chốt kết ca và gửi biên bản đối soát két tiền lên Quản trị / Kế toán?'):'Xác nhận chốt kết ca và gửi biên bản đối soát két tiền lên Quản trị / Kế toán?')))) return;

        try {
            const res = await fetch('api/finance.php?action=close_shift', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actual_cash: actualCash,
                    note,
                    also_checkout_attendance: alsoCheckout
                })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.message || (window.cnxT?window.cnxT('js.s_shift.2b1b02f5','Lỗi kết ca'):'Lỗi kết ca'));
                return;
            }
            const lines = [
                data.message,
                `${window.cnxT?window.cnxT('js.s_shift.76c39652','• Lý thuyết két:'):'• Lý thuyết két:'} ${this.formatMoney(data.expected_cash)}${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`,
                `${window.cnxT?window.cnxT('js.s_shift.4ab44059','• Thực đếm két:'):'• Thực đếm két:'} ${this.formatMoney(data.actual_cash)}${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`,
                `${window.cnxT?window.cnxT('js.s_shift.3b9a4d94','• Chênh lệch:'):'• Chênh lệch:'} ${this.formatMoney(data.discrepancy)}${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`
            ];
            if (Number(data.open_orders_count || 0) > 0) {
                lines.push(`${window.cnxT?window.cnxT('js.s_shift.e312aa13','⚠ Lưu ý: Còn'):'⚠ Lưu ý: Còn'} ${data.open_orders_count} ${window.cnxT?window.cnxT('js.s_shift.6786e091','đơn đang mở chưa thanh toán.'):'đơn đang mở chưa thanh toán.'}`);
            }
            if (data.checked_out_attendance) {
                lines.push((window.cnxT?window.cnxT('js.s_shift.022c7c67','✓ Đã Check-out chấm công cá nhân cùng lúc kết ca.'):'✓ Đã Check-out chấm công cá nhân cùng lúc kết ca.'));
            }
            alert(lines.join('\n'));
            await this.openShiftModal();
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.s_shift.d4ded7a4','Lỗi kết nối khi kết ca'):'Lỗi kết nối khi kết ca'));
        }
    },

    // Thermal Receipt Printer Preview & Print Engine
    lastReceiptHtml: '',

    // In tạm tính cho đơn hàng đang tạo (chỉ in nội dung đơn đang tạo)
    printTemporaryReceipt() {
        if (!this.cart || this.cart.length === 0) {
            alert((window.cnxT?window.cnxT('js.s_shift.bb785cd8','Đơn hàng đang tạo chưa có món ăn nào để in tạm tính!'):'Đơn hàng đang tạo chưa có món ăn nào để in tạm tính!'));
            return;
        }

        // Ghi nhận Kiểm toán nội bộ hành vi In tạm tính
        fetch('api/orders.php?action=log_audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action_code: 'PRINT_TEMP_BILL',
                action_label: (window.cnxT?window.cnxT('js.s_shift.23e82c43','In phiếu tạm tính bàn '):'In phiếu tạm tính bàn ') + (this.currentTable ? this.currentTable.code : 'MV'),
                severity: 'INFO',
                order_id: this.activeOrderId || 0,
                order_code: (this.activeOrder && this.activeOrder.order_code) ? this.activeOrder.order_code : 'TEMP',
                table_code: this.currentTable ? this.currentTable.code : 'MV',
                amount_impact: 0,
                reason: (window.cnxT?window.cnxT('js.s_shift.64c8c77b','Thu ngân in phiếu tạm tính kiểm tra đơn'):'Thu ngân in phiếu tạm tính kiểm tra đơn'),
                details: (window.cnxT?window.cnxT('js.s_shift.989e768f','Số món: '):'Số món: ') + this.cart.length
            })
        }).catch((errIgnored) => { (window.CyberSecurity ? CyberSecurity.logSilentError('pos.js', errIgnored) : console.debug('pos.js', errIgnored)); });

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

        const tableName = this.currentTable ? (this.currentTable.name || this.currentTable.code) : (window.cnxT?window.cnxT('js.s_shift.8b91175b','Khách mang về'):'Khách mang về');
        const tempOrderCode = (this.activeOrder && this.activeOrder.order_code) ? this.activeOrder.order_code : (window.cnxT?window.cnxT('js.s_shift.0c402d22','ĐANG TẠO'):'ĐANG TẠO');

        const tempOrder = {
            order_code: tempOrderCode,
            table_code: tableName,
            customer_name: this.customerName || (window.cnxT?window.cnxT('js.s_pos.53fa7723','Khách vãng lai'):'Khách vãng lai'),
            guest_count: this.guestCount || 1,
            user_name: (window.currentUser && window.currentUser.fullname) ? window.currentUser.fullname : (window.cnxT?window.cnxT('ui.ord_html.b_6951ffd8','Thu ngân'):'Thu ngân'),
            created_at: new Date().toLocaleString('vi-VN'),
            subtotal: subtotal,
            discount_amount: discountAmount,
            vat_percent: this.vatPercent,
            vat_amount: vatAmount,
            total_amount: total,
            is_temporary: true
        };

        this.showReceiptModal(tempOrder, formattedItems, null, (window.cnxT?window.cnxT('js.s_shift.0ed5d3c9','PHIẾU TẠM TÍNH'):'PHIẾU TẠM TÍNH'), (window.cnxT?window.cnxT('js.s_shift.5caf0552','Phiếu tạm tính - Đơn đang tạo'):'Phiếu tạm tính - Đơn đang tạo'));
    },

    generateReceiptHtml(order, items, store) {
        const brand = window.CN_STORE_BRAND || {};
        const isTemp = !!(order && order.is_temporary);
        const isReprint = !!(order && order.is_reprint);
        if (window.ReceiptTemplate && typeof window.ReceiptTemplate.renderHtml === 'function') {
            return window.ReceiptTemplate.renderHtml(order, items, store || this.storeSettings || brand, { isTemp, isReprint });
        }
        const storeName = store ? store.name : (this.storeSettings['store_name'] || brand.store_name || 'CyberNexus POS');
        return `<div style="padding:10px;font-family:monospace;"><b>${storeName}</b> - #${order ? order.order_code : ''}</div>`;
    },
    showReceiptModal(order, items, store, title = (window.cnxT?window.cnxT('ui.pos_html.h3_b9280d4b','THANH TOÁN THÀNH CÔNG'):'THANH TOÁN THÀNH CÔNG'), subtitle = (window.cnxT?window.cnxT('js.s_shift.01523312','Xem trước & In hóa đơn nhiệt'):'Xem trước & In hóa đơn nhiệt')) {
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
        if (closeTextEl) closeTextEl.innerText = (title === 'THANH TOÁN THÀNH CÔNG') ? 'Đóng (Tạo đơn mới)' : (window.cnxT?window.cnxT('ui.pos_html.button_cee55387','Đóng'):'Đóng');

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
            printBtnTextEl.innerText = (order && order.is_temporary) ? 'In Phiếu Tạm (80mm)' : (window.cnxT?window.cnxT('ui.pos_html.span_c3942868','In Hóa Đơn (80mm)'):'In Hóa Đơn (80mm)');
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

    async triggerThermalPrint() {
        if (!this.lastReceiptHtml) {
            const printEl = document.getElementById('printable-receipt');
            if (printEl && printEl.innerHTML) {
                this.lastReceiptHtml = printEl.innerHTML;
            }
        }
        if (window.ReceiptTemplate && this.lastReceiptOrder) {
            const r = await window.ReceiptTemplate.printViaBridgeOrBrowser(
                this.lastReceiptOrder,
                this.lastReceiptItems || [],
                this.lastReceiptStore || this.storeSettings || {},
                {
                    isTemp: !!this.lastReceiptOrder.is_temporary,
                    isReprint: !!this.lastReceiptOrder.is_reprint
                }
            );
            if (r && r.mode === 'escpos' && typeof this.showToast === 'function') {
                this.showToast(r.message || (window.cnxT?window.cnxT('js.s_shift.a3909046','Đã gửi lệnh in ESC/POS!'):'Đã gửi lệnh in ESC/POS!'), 'success');
            }
            return;
        }
        if (!this.lastReceiptHtml) return;
        const paperCfg = window.ReceiptTemplate ? window.ReceiptTemplate.getConfig(this.storeSettings) : { paper_size: '80mm' };
        if (window.ReceiptTemplate) {
            window.ReceiptTemplate.printHtmlInIframe(this.lastReceiptHtml, paperCfg.paper_size);
        } else {
            window.print();
        }
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
                <span class="text-xs">${window.cnxT?window.cnxT('js.s_shift.c7704840','Đang tìm kiếm hóa đơn...'):'Đang tìm kiếm hóa đơn...'}</span>
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
                        <p class="text-sm font-semibold text-slate-300">${window.cnxT?window.cnxT('js.s_shift.d2c12391','Không tìm thấy hóa đơn nào phù hợp!'):'Không tìm thấy hóa đơn nào phù hợp!'}</p>
                        <p class="text-xs text-slate-500 mt-1">Hãy thử xóa từ khóa tìm kiếm hoặc chọn khoảng thời gian "Tất cả thời gian".</p>
                    </div>
                `;
                if (countEl) countEl.innerText = (window.cnxT?window.cnxT('js.s_shift.58af7c43','Tìm thấy 0 hóa đơn'):'Tìm thấy 0 hóa đơn');
                const sTotal = document.getElementById('reprint-stat-total');
                const sCash = document.getElementById('reprint-stat-cash');
                const sBank = document.getElementById('reprint-stat-banking');
                const sCount = document.getElementById('reprint-stat-count');
                if (sTotal) sTotal.innerText = (window.cnxT?window.cnxT('ui.sa_html.div_e995e897','0 đ'):'0 đ');
                if (sCash) sCash.innerText = (window.cnxT?window.cnxT('ui.sa_html.div_e995e897','0 đ'):'0 đ');
                if (sBank) sBank.innerText = (window.cnxT?window.cnxT('ui.sa_html.div_e995e897','0 đ'):'0 đ');
                if (sCount) sCount.innerText = (window.cnxT?window.cnxT('ui.pos_html.div_1bd1d197','0 đơn'):'0 đơn');
                return;
            }

            const orders = data.data;
            if (countEl) countEl.innerText = `${window.cnxT?window.cnxT('js.s_shift.d97a3dc3','Tìm thấy'):'Tìm thấy'} ${orders.length} ${window.cnxT?window.cnxT('js.s_inv.0b1b9400','hóa đơn'):'hóa đơn'}`;

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
            if (sTotal) sTotal.innerText = this.formatMoney(totalRev) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
            if (sCash) sCash.innerText = this.formatMoney(totalCash) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
            if (sBank) sBank.innerText = this.formatMoney(totalBanking) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
            if (sCount) sCount.innerText = `${completedOrders} / ${orders.length} ${window.cnxT?window.cnxT('js.m_sa.61abc818','đơn'):'đơn'}`;

            let html = '';
            orders.forEach(o => {
                const isPaid = (o.status === 'completed');
                const payMethodLabel = (o.payment_method === 'banking') ? 'VietQR / CK' : ((o.payment_method === 'card') ? 'Thẻ' : (window.cnxT?window.cnxT('ui.admin_html.option_7d2970d9','Tiền mặt'):'Tiền mặt'));
                const rawTime = o.completed_at || o.created_at || '';
                const timeStr = (typeof window.formatDateTimeDDMMYY === 'function')
                    ? window.formatDateTimeDDMMYY(rawTime)
                    : rawTime.replace(/^(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) => `${d}/${m}/${y.slice(-2)}`);
                const itemsCount = o.items_count || 0;
                const itemsSummary = o.items_summary || (window.cnxT?window.cnxT('js.s_shift.0b0ea52a','Chưa có thông tin món'):'Chưa có thông tin món');

                html += `
                    <div class="p-3 mb-2 rounded-xl bg-slate-900/60 border border-white/10 hover:border-sky-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-start gap-3 min-w-0 flex-1">
                            <div class="w-10 h-10 rounded-xl ${isPaid ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'} flex items-center justify-center shrink-0">
                                <i class="fas ${isPaid ? 'fa-file-invoice-dollar' : 'fa-clock'} text-base"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-mono font-bold text-sky-400 text-sm whitespace-nowrap">${o.order_code}</span>
                                    <span class="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-xs whitespace-nowrap">${o.table_code || (window.cnxT?window.cnxT('js.s_shift.3083a73f','MANG VỀ'):'MANG VỀ')}</span>
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase whitespace-nowrap ${isPaid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
                                        ${isPaid ? 'Đã thanh toán' : (window.cnxT?window.cnxT('js.s_inv.9d5347dd','Chưa thanh toán'):'Chưa thanh toán')}
                                    </span>
                                    <span class="text-[11px] text-slate-400 font-mono whitespace-nowrap"><i class="far fa-clock mr-1"></i>${timeStr}</span>
                                </div>
                                <div class="text-xs text-slate-300 mt-1 truncate" title="${itemsSummary}">
                                    <i class="fas fa-utensils text-slate-500 mr-1"></i>
                                    <span class="text-slate-400 font-medium">${itemsCount} món:</span> ${itemsSummary}
                                </div>
                                <div class="text-[11px] text-slate-400 mt-0.5 truncate">
                                    ${window.cnxT?window.cnxT('js.s_shift.e8c4651f','Thu ngân:'):'Thu ngân:'} <span class="text-slate-300 font-medium">${o.user_name || (window.cnxT?window.cnxT('js.s_adm.fad65698','Hệ thống'):'Hệ thống')}</span>
                                    ${o.customer_name ? ` • Khách: <span class="text-slate-300">${o.customer_name}</span>` : ''}
                                    • HTTT: <span class="text-slate-300 font-medium">${payMethodLabel}</span>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 whitespace-nowrap">
                            <div class="text-left sm:text-right">
                                <div class="text-[10px] text-slate-400">${window.cnxT?window.cnxT('ui.admin_html.th_ef441db5','Tổng tiền'):'Tổng tiền'}</div>
                                <div class="text-base font-extrabold font-mono text-emerald-400">${this.formatMoney(o.total_amount)} đ</div>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <button type="button" onclick="POS.previewOrderReceipt(${o.id})" class="btn-glass text-xs py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border-white/10 flex items-center gap-1 font-semibold whitespace-nowrap" title="Xem trước hóa đơn nhiệt">
                                    <i class="fas fa-eye text-xs"></i> <span>Xem</span>
                                </button>
                                <button type="button" onclick="POS.reprintOrderReceipt(${o.id})" class="btn-glass-primary text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold shadow-md shadow-sky-500/20 whitespace-nowrap" title="In lại hóa đơn ngay">
                                    <i class="fas fa-print"></i> <span>${window.cnxT?window.cnxT('js.s_shift.59e9cfb1','In Lại'):'In Lại'}</span>
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
                    <div>${window.cnxT?window.cnxT('js.s_shift.ad13d8d1','Không thể tải danh sách hóa đơn. Vui lòng thử lại!'):'Không thể tải danh sách hóa đơn. Vui lòng thử lại!'}</div>
                </div>
            `;
        }
    },

    async previewOrderReceipt(orderId) {
        try {
            const res = await fetch(`api/orders.php?action=detail&order_id=${orderId}`);
            const data = await res.json();
            if (!data.success || !data.order) {
                alert(data.message || (window.cnxT?window.cnxT('js.s_shift.d1a7217c','Không tìm thấy thông tin hóa đơn!'):'Không tìm thấy thông tin hóa đơn!'));
                return;
            }

            this.showReceiptModal(data.order, data.items, data.store, `${window.cnxT?window.cnxT('js.s_shift.980955b1','PHIẾU THANH TOÁN (HĐ:'):'PHIẾU THANH TOÁN (HĐ:'} ${data.order.order_code})`, `${window.cnxT?window.cnxT('js.s_shift.0950e735','In lại hóa đơn đã thanh toán'):'In lại hóa đơn đã thanh toán'}`);
        } catch (e) {
            console.error('Lỗi xem hóa đơn:', e);
            alert((window.cnxT?window.cnxT('js.s_shift.74e949fa','Lỗi khi tải thông tin hóa đơn!'):'Lỗi khi tải thông tin hóa đơn!'));
        }
    },

    async reprintOrderReceipt(orderId) {
        try {
            const res = await fetch(`api/orders.php?action=detail&order_id=${orderId}`);
            const data = await res.json();
            if (!data.success || !data.order) {
                alert(data.message || (window.cnxT?window.cnxT('js.s_shift.d1a7217c','Không tìm thấy thông tin hóa đơn!'):'Không tìm thấy thông tin hóa đơn!'));
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
            this.showToast(`${window.cnxT?window.cnxT('js.s_shift.9e12e857','Đang gửi lệnh in hóa đơn'):'Đang gửi lệnh in hóa đơn'} ${data.order.order_code}...`, 'success');
        } catch (e) {
            console.error('Lỗi in lại hóa đơn:', e);
            alert((window.cnxT?window.cnxT('js.s_shift.6416d881','Lỗi khi tải và in hóa đơn!'):'Lỗi khi tải và in hóa đơn!'));
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
                <span class="text-xs">${window.cnxT?window.cnxT('js.s_shift.1dfb505d','Đang tổng hợp số liệu doanh thu...'):'Đang tổng hợp số liệu doanh thu...'}</span>
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
                contentEl.innerHTML = `<div class="p-8 text-center text-rose-400">${window.cnxT?window.cnxT('js.s_shift.c47188ac','Không thể tải báo cáo doanh thu'):'Không thể tải báo cáo doanh thu'}</div>`;
                return;
            }

            const d = json.data;
            this.currentShiftReportData = d;

            let topItemsHtml = '';
            if (Array.isArray(d.top_products) && d.top_products.length > 0) {
                topItemsHtml = d.top_products.map((p, idx) => `
                    <div class="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                        <span class="text-slate-300 font-medium">#${idx+1}. ${p.product_name}</span>
                        <span class="font-mono text-sky-400 font-bold">${p.qty} ${p.unit || (window.cnxT?window.cnxT('js.s_adm.3a9dfd9c','phần'):'phần')} • ${this.formatMoney(p.revenue)} đ</span>
                    </div>
                `).join('');
            } else {
                topItemsHtml = `<div class="text-slate-500 text-xs py-2 italic text-center">${window.cnxT?window.cnxT('js.s_shift.65f633a4','Chưa có món nào bán ra trong khoảng thời gian này'):'Chưa có món nào bán ra trong khoảng thời gian này'}</div>`;
            }

            contentEl.innerHTML = `
                <!-- Preset buttons -->
                <div class="flex items-center gap-1.5 pb-2 border-b border-white/10 text-xs flex-wrap">
                    <span class="text-slate-400 text-[11px] mr-1">${window.cnxT?window.cnxT('js.s_shift.78dec3fa','Khoảng thời gian:'):'Khoảng thời gian:'}</span>
                    <button type="button" onclick="POS.loadRevenueStats('today')" class="px-2.5 py-1 rounded-lg ${preset === 'today' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">${window.cnxT?window.cnxT('ui.admin_html.button_26541787','Hôm Nay'):'Hôm Nay'}</button>
                    <button type="button" onclick="POS.loadRevenueStats('yesterday')" class="px-2.5 py-1 rounded-lg ${preset === 'yesterday' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">${window.cnxT?window.cnxT('ui.admin_html.button_61be4d1b','Hôm Qua'):'Hôm Qua'}</button>
                    <button type="button" onclick="POS.loadRevenueStats('7days')" class="px-2.5 py-1 rounded-lg ${preset === '7days' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">${window.cnxT?window.cnxT('ui.admin_html.button_e2f327c7','7 Ngày'):'7 Ngày'}</button>
                    <button type="button" onclick="POS.loadRevenueStats('month')" class="px-2.5 py-1 rounded-lg ${preset === 'month' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">${window.cnxT?window.cnxT('ui.admin_html.button_1f9f41c8','Tháng Này'):'Tháng Này'}</button>
                </div>

                <!-- Big Highlight Revenue Box -->
                <div class="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600/30 to-teal-700/30 border border-emerald-500/40 flex items-center justify-between">
                    <div>
                        <div class="text-[11px] font-black uppercase tracking-wider text-emerald-300">${window.cnxT?window.cnxT('js.s_shift.8d90f345','TỔNG DOANH THU THU VỀ'):'TỔNG DOANH THU THU VỀ'}</div>
                        <div class="text-xs text-slate-300 mt-0.5">${d.total_orders} hóa đơn đã hoàn tất thanh toán</div>
                    </div>
                    <div class="text-2xl font-black font-mono text-emerald-300">
                        ${this.formatMoney(d.total_revenue)} <span class="text-xs font-normal">${window.cnxT?window.cnxT('ui.pos_html.span_a0cb4ccf','VNĐ'):'VNĐ'}</span>
                    </div>
                </div>

                <!-- Payment Methods Breakdown Cards -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div class="p-3 rounded-xl bg-slate-900/80 border border-white/10 min-w-0">
                        <div class="flex items-center gap-1.5 text-xs text-slate-400 mb-1 whitespace-nowrap">
                            <i class="fas fa-money-bill-wave text-emerald-400"></i>
                            <span>${window.cnxT?window.cnxT('js.s_shift.752f3289','Tiền Mặt'):'Tiền Mặt'}</span>
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
                            <i class="fas fa-credit-card text-purple-400"></i>
                            <span>${window.cnxT?window.cnxT('js.s_shift.964fdfb4','Cà Thẻ / POS'):'Cà Thẻ / POS'}</span>
                        </div>
                        <div class="font-mono font-bold text-sm sm:text-base text-white whitespace-nowrap">${this.formatMoney(d.card_revenue || 0)} đ</div>
                        <div class="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">${d.card_orders || 0} đơn</div>
                    </div>

                    <div class="p-3 rounded-xl bg-slate-900/80 border border-white/10 min-w-0">
                        <div class="flex items-center gap-1.5 text-xs text-slate-400 mb-1 whitespace-nowrap">
                            <i class="fas fa-calculator text-amber-400"></i>
                            <span>${window.cnxT?window.cnxT('js.s_shift.33f909e1','Trung Bình / Đơn'):'Trung Bình / Đơn'}</span>
                        </div>
                        <div class="font-mono font-bold text-sm sm:text-base text-white whitespace-nowrap">${this.formatMoney(d.avg_order_value)} đ</div>
                        <div class="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">Giảm giá: ${this.formatMoney(d.total_discount)} đ</div>
                    </div>
                </div>

                <!-- Top 5 Best Sellers -->
                <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                    <div class="font-bold text-xs text-slate-300 mb-2 flex items-center gap-1.5">
                        <i class="fas fa-fire text-amber-400"></i>
                        <span>Top món bán chạy nhất (${preset === 'today' ? 'Hôm nay' : (window.cnxT?window.cnxT('js.s_shift.f2cc81b9','Kỳ báo cáo'):'Kỳ báo cáo')})</span>
                    </div>
                    <div class="space-y-1">
                        ${topItemsHtml}
                    </div>
                </div>

                <div class="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                    <span>${window.cnxT?window.cnxT('js.s_shift.29a6cf00','Nhân viên kết ca:'):'Nhân viên kết ca:'} <b class="text-slate-200">${d.user_name || this.currentUser?.fullname || (window.cnxT?window.cnxT('ui.ord_html.b_6951ffd8','Thu ngân'):'Thu ngân')}</b> (${d.user_role || this.currentUser?.role || 'POS'})</span>
                    <span>Tạo lúc: ${d.generated_at || new Date().toLocaleString('vi-VN')}</span>
                </div>
            `;
        } catch (e) {
            console.error('Error loading revenue stats:', e);
            contentEl.innerHTML = `<div class="p-8 text-center text-rose-400">${window.cnxT?window.cnxT('js.s_shift.029df3df','Lỗi kết nối khi tải số liệu'):'Lỗi kết nối khi tải số liệu'}</div>`;
        }
    },

    printShiftReport() {
        const d = this.currentShiftReportData;
        if (!d) {
            alert((window.cnxT?window.cnxT('js.s_shift.38dd324a','Chưa có số liệu báo cáo để in!'):'Chưa có số liệu báo cáo để in!'));
            return;
        }

        const printWindow = window.open('', '_blank', 'width=380,height=600');
        if (!printWindow) {
            alert((window.cnxT?window.cnxT('js.s_shift.7a8a5f40','Vui lòng cho phép popup trình duyệt để in phiếu báo cáo ca!'):'Vui lòng cho phép popup trình duyệt để in phiếu báo cáo ca!'));
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
                <title>${window.cnxT?window.cnxT('js.s_shift.78c0fc3e','BÁO CÁO DOANH THU CA'):'BÁO CÁO DOANH THU CA'}</title>
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
                <div class="center bold" style="font-size: 14px;">${(window.getStoreBrandName ? window.getStoreBrandName() : (this.storeSettings['store_name'] || 'CyberNexus POS')).toUpperCase()}</div>
                <div class="center bold border-bottom">${window.cnxT?window.cnxT('js.s_shift.cb3691af','BÁO CÁO DOANH THU BÀN GIAO CA'):'BÁO CÁO DOANH THU BÀN GIAO CA'}</div>
                <div style="font-size: 11px;">
                    <div>Ngày: ${d.date_from} ${d.date_from !== d.date_to ? (window.cnxT?window.cnxT('js.s_shift.963857c1','đến '):'đến ') + d.date_to : ''}</div>
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
                        <span>${window.cnxT?window.cnxT('js.s_shift.fecb84e1','Tổng số hóa đơn:'):'Tổng số hóa đơn:'}</span>
                        <span class="bold">${d.total_orders} HĐ</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>${window.cnxT?window.cnxT('ui.pos_html.span_607b5d46','Giảm giá:'):'Giảm giá:'}</span>
                        <span>${this.formatMoney(d.total_discount)} đ</span>
                    </div>
                </div>
                ${topItemsRows ? `
                <div style="font-weight: bold; margin: 4px 0 2px 0;">${window.cnxT?window.cnxT('js.s_shift.cfc190d7','TOP MÓN BÁN CHẠY:'):'TOP MÓN BÁN CHẠY:'}</div>
                <table>
                    <thead>
                        <tr style="border-bottom: 1px solid #ccc;">
                            <th style="text-align: left;">${window.cnxT?window.cnxT('js.s_kds.de6359a6','Món'):'Món'}</th>
                            <th style="text-align: right;">SL</th>
                            <th style="text-align: right;">${window.cnxT?window.cnxT('js.s_shift.37528ccb','Tiền'):'Tiền'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topItemsRows}
                    </tbody>
                </table>
                <div class="border-bottom" style="margin-top: 6px;"></div>
                ` : ''}
                <div class="center" style="margin-top: 15px;">
                    <div>${window.cnxT?window.cnxT('js.s_shift.cfabd57f','Người lập phiếu'):'Người lập phiếu'}</div>
                    <div style="margin-top: 35px;">${window.cnxT?window.cnxT('js.s_shift.357c6370','(Ký & ghi rõ họ tên)'):'(Ký & ghi rõ họ tên)'}</div>
                </div>
                <script>
                    window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },
});
