const OnlineOrders = {
    filter: 'active',
    orders: [],
    paymentOrderId: null,
    paymentMethod: 'banking',
    paymentBusy: false,

    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);
    },

    money(value) {
        return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0)) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
    },

    async load() {
        const message = document.getElementById('online-order-message');
        message.classList.add('hidden');
        try {
            const response = await fetch(`api/orders.php?action=online_orders&status=${this.filter}`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_onl.4220bedf','Không thể tải đơn online.'):'Không thể tải đơn online.'));
            this.orders = data.data || [];
            this.render();
        } catch (error) {
            message.textContent = error.message || (window.cnxT?window.cnxT('js.s_onl.4220bedf','Không thể tải đơn online.'):'Không thể tải đơn online.');
            message.classList.remove('hidden');
        }
    },

    setFilter(filter) {
        this.filter = filter === 'all' ? 'all' : 'active';
        document.getElementById('online-filter-active').className = this.filter === 'active'
            ? 'rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-bold text-sky-200'
            : 'rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400';
        document.getElementById('online-filter-all').className = this.filter === 'all'
            ? 'rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-bold text-sky-200'
            : 'rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400';
        this.load();
    },

    tx(key, fallback, vars) {
        return typeof window.cnxT === 'function' ? window.cnxT(key, vars || null, fallback) : (fallback || key);
    },

    status(order) {
        if (order.status === 'cancelled') return [this.tx('online.st_cancelled', (window.cnxT?window.cnxT('ui.admin_html.option_9ae657c4','Đã hủy'):'Đã hủy')), 'border-rose-400/30 bg-rose-500/10 text-rose-200'];
        if (order.status === 'completed') return [this.tx('online.st_completed', (window.cnxT?window.cnxT('js.s_ops.e3eceb0c','Hoàn tất'):'Hoàn tất')), 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'];
        if (order.kitchen_status === 'served' || order.served_at) return [this.tx('online.st_delivered', (window.cnxT?window.cnxT('js.s_onl.161a6ec8','Đã giao'):'Đã giao')), 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200'];
        if (order.kitchen_status === 'ready') return [this.tx('online.st_ready', (window.cnxT?window.cnxT('js.s_onl.31afc75f','Bếp đã xong'):'Bếp đã xong')), 'border-amber-400/30 bg-amber-500/10 text-amber-200'];
        return [this.tx('online.st_cooking', (window.cnxT?window.cnxT('js.s_onl.40982f50','Đang chế biến'):'Đang chế biến')), 'border-sky-400/30 bg-sky-500/10 text-sky-200'];
    },

    render() {
        const active = this.orders.filter(order => order.status === 'pending');
        document.getElementById('online-count-active').textContent = String(active.length);
        document.getElementById('online-count-unpaid').textContent = String(active.filter(order => order.payment_status !== 'paid').length);
        document.getElementById('online-count-ready').textContent = String(active.filter(order =>
            order.kitchen_status === 'ready' && !order.served_at
        ).length);
        const readyOrders = active.filter(order =>
            order.kitchen_status === 'ready' && !order.served_at
        );
        const readyBanner = document.getElementById('online-orders-ready-banner');
        if (readyBanner) {
            if (readyOrders.length > 0) {
                document.getElementById('online-orders-ready-count').textContent = String(readyOrders.length);
                document.getElementById('online-orders-ready-text').textContent = readyOrders
                    .slice(0, 3)
                    .map(order => `${order.order_code} · ${order.customer_name || this.tx('online.guest_online', (window.cnxT?window.cnxT('js.s_onl.074d7058','Khách online'):'Khách online'))}`)
                    .join('  |  ');
                readyBanner.classList.remove('hidden');
            } else {
                readyBanner.classList.add('hidden');
            }
        }

        const list = document.getElementById('online-order-list');
        if (this.orders.length === 0) {
            list.innerHTML = `<div class="col-span-full py-14 text-center text-sm text-slate-500"><i class="fas fa-inbox mb-3 block text-3xl opacity-50"></i>${this.escape(this.tx('online.empty_list', (window.cnxT?window.cnxT('js.s_onl.13acbb00','Không có đơn online trong danh sách này.'):'Không có đơn online trong danh sách này.')))}</div>`;
            return;
        }

        list.innerHTML = this.orders.map(order => {
            const [status, statusClass] = this.status(order);
            const isActive = order.status === 'pending';
            const isPaid = order.payment_status === 'paid';
            const isReady = order.kitchen_status === 'ready' || order.kitchen_status === 'served' || Boolean(order.kitchen_ready_at);
            const isDelivered = order.kitchen_status === 'served' || Boolean(order.served_at);
            const canDeliver = window.onlineOrderPermissions.delivery && isActive && isReady && !isDelivered;
            const canPay = window.onlineOrderPermissions.payment && isActive && !isPaid;
            const pmMap = {
                banking: this.tx('online.pm_banking_short', (window.cnxT?window.cnxT('ui.admin_html.option_88bdf22c','Chuyển khoản'):'Chuyển khoản')),
                cash: this.tx('online.pm_cash_title', (window.cnxT?window.cnxT('ui.admin_html.option_7d2970d9','Tiền mặt'):'Tiền mặt')),
                card: this.tx('online.pm_card_title', (window.cnxT?window.cnxT('js.s_onl.0c4c966b','Thẻ / POS'):'Thẻ / POS'))
            };
            const paymentLabel = isPaid
                ? `${this.tx('online.st_paid', (window.cnxT?window.cnxT('ui.pos_html.option_405bdd67','Đã thanh toán'):'Đã thanh toán'))} · ${pmMap[order.payment_method] || this.tx('online.st_collected', (window.cnxT?window.cnxT('js.s_onl.d9f4de7b','Đã thu'):'Đã thu'))}`
                : this.tx('online.st_unpaid', (window.cnxT?window.cnxT('js.s_inv.9d5347dd','Chưa thanh toán'):'Chưa thanh toán'));
            const note = order.note ? `<div class="mt-2 rounded-lg bg-slate-950/50 p-2 text-[11px] text-slate-300"><b>${this.escape(this.tx('online.lbl_note', (window.cnxT?window.cnxT('ui.admin_html.label_1b4e6aad','Ghi chú:'):'Ghi chú:')))}</b> ${this.escape(order.note)}</div>` : '';
            const payControl = canPay ? `
                <div class="online-order-action online-order-action-payment mt-2.5">
                    <div class="online-order-action-main">
                        <div class="min-w-0">
                            <span class="block text-[9px] font-bold uppercase tracking-wide text-emerald-100/70">${this.escape(this.tx('online.cashier_due_tag', (window.cnxT?window.cnxT('js.s_onl.75de8619','Thu ngân · Cần thu'):'Thu ngân · Cần thu')))}</span>
                            <b class="mt-0.5 block text-sm font-black text-emerald-200">${this.money(order.total_amount)}</b>
                        </div>
                        <button type="button" onclick="OnlineOrders.openPayment(${Number(order.id)})" class="online-order-action-button">
                            <i class="fas fa-shield-check"></i><span>${this.escape(this.tx('online.btn_reconcile_collect', (window.cnxT?window.cnxT('js.s_onl.5612521c','Đối soát & thu tiền'):'Đối soát & thu tiền')))}</span>
                        </button>
                    </div>
                    <p class="online-order-action-hint">${this.escape(this.tx('online.hint_verify_payment', (window.cnxT?window.cnxT('js.s_onl.b780bd70','Chỉ xác nhận sau khi đã kiểm tra tiền thực nhận.'):'Chỉ xác nhận sau khi đã kiểm tra tiền thực nhận.')))}</p>
                </div>` : '';
            const deliveryControl = canDeliver ? `
                <div class="online-order-action online-order-action-delivery mt-2.5">
                    <div class="online-order-action-main">
                        <div class="min-w-0">
                            <span class="block text-[9px] font-bold uppercase tracking-wide text-sky-100/70">${this.escape(this.tx('online.waiter_ready_tag', (window.cnxT?window.cnxT('js.s_onl.cca007a6','Phục vụ · Bếp đã xong'):'Phục vụ · Bếp đã xong')))}</span>
                            <b class="mt-0.5 block text-[11px] font-bold text-slate-100">${isPaid ? this.escape(this.tx('online.ready_to_handover', (window.cnxT?window.cnxT('js.s_onl.26686781','Sẵn sàng bàn giao'):'Sẵn sàng bàn giao'))) : this.escape(this.tx('online.can_handover_unpaid', (window.cnxT?window.cnxT('js.s_onl.9bbc14ee','Có thể giao · Chưa thu tiền'):'Có thể giao · Chưa thu tiền')))}</b>
                        </div>
                        <button type="button" onclick="OnlineOrders.confirmDelivery(${Number(order.id)})" class="online-order-action-button">
                            <i class="fas fa-box-open"></i><span>${this.escape(this.tx('online.btn_handed_over', (window.cnxT?window.cnxT('js.s_onl.ce679c79','Đã giao khách'):'Đã giao khách')))}</span>
                        </button>
                    </div>
                    <p class="online-order-action-hint">${this.escape(this.tx('online.hint_verify_handover', (window.cnxT?window.cnxT('js.s_onl.86e4d826','Chỉ xác nhận sau khi đã bàn giao thực tế.'):'Chỉ xác nhận sau khi đã bàn giao thực tế.')))}</p>
                </div>` : '';
            const isWaitingKitchenGate = isActive && ['awaiting_payment', 'awaiting_waiter', 'awaiting_kitchen_push'].includes(order.kitchen_status || '');
            const canPushKitchen = isPaid || order.payment_status === 'cod_approved';
            const kitchenGateControl = isWaitingKitchenGate ? `
                <div class="mt-2.5 rounded-xl border border-amber-500/35 bg-amber-950/25 p-2.5 space-y-2 text-xs">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-bold text-amber-200"><i class="fas fa-fire-burner mr-1"></i> ${canPushKitchen ? this.escape(this.tx('online.gate_ready_kitchen', (window.cnxT?window.cnxT('js.s_onl.0d9bd33e','Đã xác nhận TT/COD — Sẵn sàng chuyển Bếp'):'Đã xác nhận TT/COD — Sẵn sàng chuyển Bếp'))) : (order.payment_status === 'verifying' ? this.escape(this.tx('online.gate_verifying_transfer', (window.cnxT?window.cnxT('js.s_onl.eb7742a1','Khách báo đã CK — Chờ đối soát'):'Khách báo đã CK — Chờ đối soát'))) : this.escape(this.tx('online.gate_awaiting_payment', (window.cnxT?window.cnxT('js.s_onl.84397707','Chưa xác nhận thanh toán'):'Chưa xác nhận thanh toán'))))}</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                        ${(!canPushKitchen && order.order_type === 'delivery') ? `<button type="button" onclick="OnlineOrders.approveCod(${Number(order.id)})" class="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px]">${this.escape(this.tx('online.btn_approve_cod', (window.cnxT?window.cnxT('js.s_onl.cecea21c','Duyệt Ship COD'):'Duyệt Ship COD')))}</button>` : ''}
                        <button type="button" onclick="OnlineOrders.sendToKitchen(${Number(order.id)})" ${canPushKitchen ? '' : 'disabled'} class="px-3 py-1.5 rounded-lg ${canPushKitchen ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'} font-bold text-[11px]"><i class="fas fa-paper-plane mr-1"></i>${this.escape(this.tx('online.btn_send_kitchen', (window.cnxT?window.cnxT('js.s_cust.9a34bc5b','Chuyển Bếp'):'Chuyển Bếp')))}</button>
                    </div>
                </div>` : '';
            const preparationStep = !isReady && isActive && !isWaitingKitchenGate ? `
                <div class="mt-2 flex items-center gap-2 rounded-lg border border-sky-400/15 bg-sky-950/20 px-2.5 py-2 text-[10px] text-sky-100">
                    <i class="fas fa-hourglass-half text-sky-300"></i>
                    <span>${window.onlineOrderPermissions.delivery ? this.escape(this.tx('online.wait_kitchen_handover', (window.cnxT?window.cnxT('js.s_onl.3a06c172','Đang chờ bếp hoàn thành món; nút bàn giao sẽ xuất hiện khi bếp báo xong.'):'Đang chờ bếp hoàn thành món; nút bàn giao sẽ xuất hiện khi bếp báo xong.'))) : this.escape(this.tx('online.wait_kitchen', (window.cnxT?window.cnxT('js.s_onl.09f0b329','Đang chờ bếp hoàn thành món.'):'Đang chờ bếp hoàn thành món.')))}</span>
                </div>` : '';
            const deliveredNotice = isDelivered ? `
                <div class="online-order-action online-order-action-delivery mt-2.5 flex items-center justify-between gap-2 text-[10px] text-indigo-100">
                    <span><i class="fas fa-circle-check mr-1 text-sky-300"></i>${this.escape(this.tx('online.st_delivered', (window.cnxT?window.cnxT('js.s_onl.161a6ec8','Đã giao'):'Đã giao')))}${order.served_at ? ` · ${this.escape(order.served_at)}` : ''}</span>
                    ${!isPaid ? `<b class="text-amber-200">${this.escape(this.tx('online.still_awaiting_pay', (window.cnxT?window.cnxT('js.s_onl.ea7134e2','Còn chờ thu'):'Còn chờ thu')))}</b>` : `<b class="text-emerald-200">${this.escape(this.tx('online.st_paid', (window.cnxT?window.cnxT('ui.pos_html.option_405bdd67','Đã thanh toán'):'Đã thanh toán')))}</b>`}
                </div>` : '';

            return `
                <article class="rounded-2xl border border-white/10 bg-slate-900/65 p-4 shadow-lg">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <h3 class="font-mono text-sm font-black text-sky-300">${this.escape(order.order_code)}</h3>
                            <p class="mt-1 text-xs font-semibold text-white">${this.escape(order.customer_name || this.tx('online.default_customer', (window.cnxT?window.cnxT('js.s_onl.40ea9d17','Khách hàng'):'Khách hàng')))}</p>
                            <p class="text-[11px] text-slate-400">${this.escape(order.customer_phone || this.tx('online.no_phone', (window.cnxT?window.cnxT('js.s_onl.f8e6fd7f','Không có số điện thoại'):'Không có số điện thoại')))}</p>
                        </div>
                        <span class="rounded-full border px-2 py-1 text-[10px] font-bold ${statusClass}">${status}</span>
                    </div>
                    <div class="mt-3 rounded-xl border border-white/5 bg-slate-950/55 p-3">
                        <div class="text-[11px] leading-relaxed text-slate-300">${this.escape(order.items_summary || this.tx('online.no_items_summary', (window.cnxT?window.cnxT('js.s_onl.181da1c1','Chưa có chi tiết món'):'Chưa có chi tiết món')))}</div>
                        <div class="mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-2">
                            <span class="text-[10px] text-slate-500">${this.escape(order.created_at || '')}</span>
                            <b class="font-mono text-sm text-emerald-300">${this.money(order.total_amount)}</b>
                        </div>
                    </div>
                    <div class="online-order-state ${isPaid ? 'online-order-state-paid' : 'online-order-state-unpaid'} mt-2.5">
                        <span class="text-[9px] font-bold uppercase tracking-wide text-slate-500">${this.escape(this.tx('online.lbl_payment_state', (window.cnxT?window.cnxT('js.s_inv.654855f6','Thanh toán'):'Thanh toán')))}</span>
                        <span class="text-[10px] font-bold ${isPaid ? 'text-emerald-300' : 'text-amber-200'}">${paymentLabel}</span>
                    </div>
                    ${note}
                    ${order.kitchen_status === 'cancel_requested' ? `<div class="mt-2 rounded-lg border border-rose-500/40 bg-rose-950/35 px-2.5 py-2 text-[11px] text-rose-200"><b>⚠️ ${this.escape(this.tx('online.kitchen_cancel_req', (window.cnxT?window.cnxT('js.s_onl.b27e07de','Bếp yêu cầu hủy đơn:'):'Bếp yêu cầu hủy đơn:')))}</b> ${this.escape(order.cancel_request_reason || this.tx('online.no_reason', (window.cnxT?window.cnxT('js.s_onl.2679406e','Không rõ lý do'):'Không rõ lý do')))}</div>` : ''}
                    ${(order.settlement_status === 'refund_due' || order.settlement_status === 'extra_due') ? `
                        <div class="mt-2 rounded-xl border border-amber-500/40 bg-amber-950/30 p-2.5 text-[11px] text-amber-100 space-y-1.5">
                            <div><b>${order.settlement_status === 'refund_due' ? this.escape(this.tx('online.refund_due', (window.cnxT?window.cnxT('js.s_onl.bc086990','💸 Cần hoàn lại khách:'):'💸 Cần hoàn lại khách:'))) : this.escape(this.tx('online.extra_due', (window.cnxT?window.cnxT('js.s_onl.4968d084','💰 Cần thu thêm:'):'💰 Cần thu thêm:')))}</b> <span class="font-mono font-bold">${this.money(Math.abs(Number(order.total_amount || 0) - Number(order.paid_amount || 0)))}</span></div>
                            <div class="flex gap-1.5">
                                <button type="button" onclick="OnlineOrders.settleDelta(${Number(order.id)}, 'cash')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px]">${this.escape(this.tx('online.btn_settled_cash', (window.cnxT?window.cnxT('js.s_onl.d68df89b','Đã xử lý Tiền Mặt'):'Đã xử lý Tiền Mặt')))}</button>
                                <button type="button" onclick="OnlineOrders.settleDelta(${Number(order.id)}, 'banking')" class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px]">${this.escape(this.tx('online.btn_settled_bank', (window.cnxT?window.cnxT('js.s_onl.466f2a58','Đã xử lý CK'):'Đã xử lý CK')))}</button>
                            </div>
                        </div>` : ''}
                    ${preparationStep}${deliveredNotice}${payControl}${kitchenGateControl}${deliveryControl}
                    ${isActive ? `<div class="mt-2.5 pt-2 border-t border-white/10 flex justify-end"><button type="button" onclick="OnlineOrders.cancelOrder(${Number(order.id)}, '${escapeJsAttr(order.order_code)}')" class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-[11px] font-bold transition"><i class="fas fa-trash-alt mr-1"></i>${this.escape(this.tx('online.btn_cancel_order', (window.cnxT?window.cnxT('js.s_onl.0c3d3ca8','Hủy đơn'):'Hủy đơn')))}</button></div>` : ''}
                </article>`;
        }).join('');
    },

    openPayment(orderId) {
        const order = this.orders.find(item => Number(item.id) === Number(orderId));
        if (!order) return;
        this.paymentOrderId = Number(order.id);
        this.paymentMethod = 'banking';
        this.paymentBusy = false;
        document.getElementById('online-payment-order-code').textContent = order.order_code;
        document.getElementById('online-payment-amount').textContent = this.money(order.total_amount);
        document.getElementById('online-payment-verified').checked = false;
        this.selectPaymentMethod('banking');
        this.updatePaymentConfirmState();
        document.getElementById('online-payment-modal').classList.add('is-open');
        document.body.style.overflow = 'hidden';
    },

    closePayment() {
        if (this.paymentBusy) return;
        document.getElementById('online-payment-modal').classList.remove('is-open');
        document.body.style.overflow = '';
        this.paymentOrderId = null;
    },

    selectPaymentMethod(method) {
        if (!['banking', 'cash', 'card'].includes(method)) return;
        this.paymentMethod = method;
        document.querySelectorAll('.online-payment-method').forEach(button => {
            const selected = button.dataset.paymentMethod === method;
            button.classList.toggle('is-selected', selected);
            button.querySelector('.payment-method-check').classList.toggle('hidden', !selected);
        });
    },

    updatePaymentConfirmState() {
        const confirmButton = document.getElementById('online-payment-confirm');
        if (confirmButton) confirmButton.disabled = this.paymentBusy || !document.getElementById('online-payment-verified').checked;
    },

    async approveCod(orderId) {
        try {
            const res = await fetch('api/orders.php?action=confirm_payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, mode: 'cod_approved' })
            }).then(r => r.json());
            if (res.success) await this.load();
            else alert(res.message || (window.cnxT?window.cnxT('js.s_onl.56b5b9b2','Lỗi duyệt COD'):'Lỗi duyệt COD'));
        } catch (e) { alert((window.cnxT?window.cnxT('js.s_ops.b69ae662','Lỗi kết nối'):'Lỗi kết nối')); }
    },

    async sendToKitchen(orderId) {
        try {
            const res = await fetch('api/orders.php?action=send_to_kitchen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId })
            }).then(r => r.json());
            if (res.success) await this.load();
            else alert(res.message || (window.cnxT?window.cnxT('js.s_onl.ca8f4a75','Chưa thể chuyển Bếp'):'Chưa thể chuyển Bếp'));
        } catch (e) { alert((window.cnxT?window.cnxT('js.s_ops.b69ae662','Lỗi kết nối'):'Lỗi kết nối')); }
    },

    async cancelOrder(orderId, orderCode) {
        const reason = await window.cnxPrompt(`${window.cnxT?window.cnxT('js.s_onl.4dc20e3c','Nhập lý do hủy đơn'):'Nhập lý do hủy đơn'} ${orderCode} ${window.cnxT?window.cnxT('js.s_onl.d868ad65','(ghi nhận Kiểm toán):'):'(ghi nhận Kiểm toán):'}`, (window.cnxT?window.cnxT('js.s_onl.7174b6ce','Khách hủy / Đơn treo cần đóng'):'Khách hủy / Đơn treo cần đóng'));
        if (reason === null) return;
        const finalReason = reason.trim() || (window.cnxT?window.cnxT('js.s_onl.1b28f7c5','Thu ngân hủy đơn'):'Thu ngân hủy đơn');
        try {
            const res = await fetch('api/orders.php?action=cancel_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, reason: finalReason })
            }).then(r => r.json());
            if (res.success) await this.load();
            else alert(res.message || (window.cnxT?window.cnxT('js.s_onl.83faf5e3','Không thể hủy đơn'):'Không thể hủy đơn'));
        } catch (e) { alert((window.cnxT?window.cnxT('js.s_ops.b69ae662','Lỗi kết nối'):'Lỗi kết nối')); }
    },

    async settleDelta(orderId, method = 'cash') {
        try {
            const res = await fetch('api/orders.php?action=settle_delta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, payment_method: method })
            }).then(r => r.json());
            if (res.success) await this.load();
            else alert(res.message || (window.cnxT?window.cnxT('js.s_onl.1813bbe9','Lỗi quyết toán chênh lệch'):'Lỗi quyết toán chênh lệch'));
        } catch (e) { alert((window.cnxT?window.cnxT('js.s_ops.b69ae662','Lỗi kết nối'):'Lỗi kết nối')); }
    },

    async confirmPayment() {
        const order = this.orders.find(item => Number(item.id) === this.paymentOrderId);
        if (!order || !document.getElementById('online-payment-verified').checked || this.paymentBusy) return;
        this.paymentBusy = true;
        const confirmButton = document.getElementById('online-payment-confirm');
        confirmButton.innerHTML = (window.cnxT?window.cnxT('js.s_onl.e7797464','<i class="fas fa-spinner fa-spin mr-1"></i>Đang cập nhật...'):'<i class="fas fa-spinner fa-spin mr-1"></i>Đang cập nhật...');
        confirmButton.disabled = true;
        try {
            const response = await fetch('api/orders.php?action=checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: order.id,
                    payment_method: this.paymentMethod,
                    cash_received: Number(order.total_amount),
                    discount_type: 'amount',
                    discount_value: 0,
                    vat_percent: 0
                })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_onl.4d1357a7','Không thể xác nhận thanh toán.'):'Không thể xác nhận thanh toán.'));
            this.paymentBusy = false;
            this.closePayment();
            await this.load();
        } catch (error) {
            alert(error.message || (window.cnxT?window.cnxT('js.s_onl.4d1357a7','Không thể xác nhận thanh toán.'):'Không thể xác nhận thanh toán.'));
        } finally {
            this.paymentBusy = false;
            confirmButton.innerHTML = (window.cnxT?window.cnxT('js.s_onl.724386a2','<i class="fas fa-lock mr-1"></i>Xác nhận đã thu'):'<i class="fas fa-lock mr-1"></i>Xác nhận đã thu');
            this.updatePaymentConfirmState();
        }
    },

    async confirmDelivery(orderId) {
        const order = this.orders.find(item => Number(item.id) === Number(orderId));
        if (!order) return;
        const unpaidWarning = order.payment_status === 'paid'
            ? ''
            : (window.cnxT?window.cnxT('js.s_onl.7895ffec','\n\nLưu ý: đơn chưa thanh toán. Trạng thái công nợ vẫn được giữ để thu ngân xử lý sau.'):'\n\nLưu ý: đơn chưa thanh toán. Trạng thái công nợ vẫn được giữ để thu ngân xử lý sau.');
        if (!(await window.cnxConfirm(`${window.cnxT?window.cnxT('js.s_onl.8237889c','Xác nhận đơn'):'Xác nhận đơn'} ${order.order_code} ${window.cnxT?window.cnxT('js.s_onl.f0d1e8e9','đã được bàn giao thực tế cho khách?'):'đã được bàn giao thực tế cho khách?'}${unpaidWarning}`))) return;
        try {
            const response = await fetch('api/orders.php?action=online_order_delivered', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_onl.6ffdcd1b','Không thể xác nhận giao đơn.'):'Không thể xác nhận giao đơn.'));
            await this.load();
        } catch (error) {
            alert(error.message || (window.cnxT?window.cnxT('js.s_onl.6ffdcd1b','Không thể xác nhận giao đơn.'):'Không thể xác nhận giao đơn.'));
        }
    }
};

OnlineOrders.load();
window.addEventListener('cnx:lang-changed', () => OnlineOrders.render());
let _onlinePollInFlight = false;
window.setInterval(async () => {
    if (document.hidden || _onlinePollInFlight) return;
    _onlinePollInFlight = true;
    try { await OnlineOrders.load(); } finally { _onlinePollInFlight = false; }
}, 10000);
