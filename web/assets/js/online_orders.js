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
        return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0)) + ' đ';
    },

    async load() {
        const message = document.getElementById('online-order-message');
        message.classList.add('hidden');
        try {
            const response = await fetch(`api/orders.php?action=online_orders&status=${this.filter}`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Không thể tải đơn online.');
            this.orders = data.data || [];
            this.render();
        } catch (error) {
            message.textContent = error.message || 'Không thể tải đơn online.';
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

    status(order) {
        if (order.status === 'cancelled') return ['Đã hủy', 'border-rose-400/30 bg-rose-500/10 text-rose-200'];
        if (order.status === 'completed') return ['Hoàn tất', 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'];
        if (order.kitchen_status === 'served' || order.served_at) return ['Đã giao', 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200'];
        if (order.kitchen_status === 'ready') return ['Bếp đã xong', 'border-amber-400/30 bg-amber-500/10 text-amber-200'];
        return ['Đang chế biến', 'border-sky-400/30 bg-sky-500/10 text-sky-200'];
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
                    .map(order => `${order.order_code} · ${order.customer_name || 'Khách online'}`)
                    .join('  |  ');
                readyBanner.classList.remove('hidden');
            } else {
                readyBanner.classList.add('hidden');
            }
        }

        const list = document.getElementById('online-order-list');
        if (this.orders.length === 0) {
            list.innerHTML = '<div class="col-span-full py-14 text-center text-sm text-slate-500"><i class="fas fa-inbox mb-3 block text-3xl opacity-50"></i>Không có đơn online trong danh sách này.</div>';
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
            const paymentLabel = isPaid
                ? `Đã thanh toán · ${({ banking: 'Chuyển khoản', cash: 'Tiền mặt', card: 'Thẻ / POS' })[order.payment_method] || 'Đã thu'}`
                : 'Chưa thanh toán';
            const note = order.note ? `<div class="mt-2 rounded-lg bg-slate-950/50 p-2 text-[11px] text-slate-300"><b>Ghi chú:</b> ${this.escape(order.note)}</div>` : '';
            const payControl = canPay ? `
                <div class="online-order-action online-order-action-payment mt-2.5">
                    <div class="online-order-action-main">
                        <div class="min-w-0">
                            <span class="block text-[9px] font-bold uppercase tracking-wide text-emerald-100/70">Thu ngân · Cần thu</span>
                            <b class="mt-0.5 block text-sm font-black text-emerald-200">${this.money(order.total_amount)}</b>
                        </div>
                        <button type="button" onclick="OnlineOrders.openPayment(${Number(order.id)})" class="online-order-action-button">
                            <i class="fas fa-shield-check"></i><span>Đối soát & thu tiền</span>
                        </button>
                    </div>
                    <p class="online-order-action-hint">Chỉ xác nhận sau khi đã kiểm tra tiền thực nhận.</p>
                </div>` : '';
            const deliveryControl = canDeliver ? `
                <div class="online-order-action online-order-action-delivery mt-2.5">
                    <div class="online-order-action-main">
                        <div class="min-w-0">
                            <span class="block text-[9px] font-bold uppercase tracking-wide text-sky-100/70">Phục vụ · Bếp đã xong</span>
                            <b class="mt-0.5 block text-[11px] font-bold text-slate-100">${isPaid ? 'Sẵn sàng bàn giao' : 'Có thể giao · Chưa thu tiền'}</b>
                        </div>
                        <button type="button" onclick="OnlineOrders.confirmDelivery(${Number(order.id)})" class="online-order-action-button">
                            <i class="fas fa-box-open"></i><span>Đã giao khách</span>
                        </button>
                    </div>
                    <p class="online-order-action-hint">Chỉ xác nhận sau khi đã bàn giao thực tế.</p>
                </div>` : '';
            const preparationStep = !isReady && isActive ? `
                <div class="mt-2 flex items-center gap-2 rounded-lg border border-sky-400/15 bg-sky-950/20 px-2.5 py-2 text-[10px] text-sky-100">
                    <i class="fas fa-hourglass-half text-sky-300"></i>
                    <span>${window.onlineOrderPermissions.delivery ? 'Đang chờ bếp hoàn thành món; nút bàn giao sẽ xuất hiện khi bếp báo xong.' : 'Đang chờ bếp hoàn thành món.'}</span>
                </div>` : '';
            const deliveredNotice = isDelivered ? `
                <div class="online-order-action online-order-action-delivery mt-2.5 flex items-center justify-between gap-2 text-[10px] text-indigo-100">
                    <span><i class="fas fa-circle-check mr-1 text-sky-300"></i>Đã giao${order.served_at ? ` · ${this.escape(order.served_at)}` : ''}</span>
                    ${!isPaid ? '<b class="text-amber-200">Còn chờ thu</b>' : '<b class="text-emerald-200">Đã thanh toán</b>'}
                </div>` : '';

            return `
                <article class="rounded-2xl border border-white/10 bg-slate-900/65 p-4 shadow-lg">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <h3 class="font-mono text-sm font-black text-sky-300">${this.escape(order.order_code)}</h3>
                            <p class="mt-1 text-xs font-semibold text-white">${this.escape(order.customer_name || 'Khách hàng')}</p>
                            <p class="text-[11px] text-slate-400">${this.escape(order.customer_phone || 'Không có số điện thoại')}</p>
                        </div>
                        <span class="rounded-full border px-2 py-1 text-[10px] font-bold ${statusClass}">${status}</span>
                    </div>
                    <div class="mt-3 rounded-xl border border-white/5 bg-slate-950/55 p-3">
                        <div class="text-[11px] leading-relaxed text-slate-300">${this.escape(order.items_summary || 'Chưa có chi tiết món')}</div>
                        <div class="mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-2">
                            <span class="text-[10px] text-slate-500">${this.escape(order.created_at || '')}</span>
                            <b class="font-mono text-sm text-emerald-300">${this.money(order.total_amount)}</b>
                        </div>
                    </div>
                    <div class="online-order-state ${isPaid ? 'online-order-state-paid' : 'online-order-state-unpaid'} mt-2.5">
                        <span class="text-[9px] font-bold uppercase tracking-wide text-slate-500">Thanh toán</span>
                        <span class="text-[10px] font-bold ${isPaid ? 'text-emerald-300' : 'text-amber-200'}">${paymentLabel}</span>
                    </div>
                    ${note}
                    ${preparationStep}${deliveredNotice}${payControl}${deliveryControl}
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

    async confirmPayment() {
        const order = this.orders.find(item => Number(item.id) === this.paymentOrderId);
        if (!order || !document.getElementById('online-payment-verified').checked || this.paymentBusy) return;
        this.paymentBusy = true;
        const confirmButton = document.getElementById('online-payment-confirm');
        confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Đang cập nhật...';
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
            if (!response.ok || !data.success) throw new Error(data.message || 'Không thể xác nhận thanh toán.');
            this.paymentBusy = false;
            this.closePayment();
            await this.load();
        } catch (error) {
            alert(error.message || 'Không thể xác nhận thanh toán.');
        } finally {
            this.paymentBusy = false;
            confirmButton.innerHTML = '<i class="fas fa-lock mr-1"></i>Xác nhận đã thu';
            this.updatePaymentConfirmState();
        }
    },

    async confirmDelivery(orderId) {
        const order = this.orders.find(item => Number(item.id) === Number(orderId));
        if (!order) return;
        const unpaidWarning = order.payment_status === 'paid'
            ? ''
            : '\n\nLưu ý: đơn chưa thanh toán. Trạng thái công nợ vẫn được giữ để thu ngân xử lý sau.';
        if (!confirm(`Xác nhận đơn ${order.order_code} đã được bàn giao thực tế cho khách?${unpaidWarning}`)) return;
        try {
            const response = await fetch('api/orders.php?action=online_order_delivered', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Không thể xác nhận giao đơn.');
            await this.load();
        } catch (error) {
            alert(error.message || 'Không thể xác nhận giao đơn.');
        }
    }
};

OnlineOrders.load();
window.setInterval(() => OnlineOrders.load(), 10000);
