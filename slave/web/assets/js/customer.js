const CustomerOrdering = {
    cart: {},
    pendingInstallPrompt: null,
    currentOrderToken: '',
    paymentOrder: null,
    orderContext: window.customerOrderContext || {},

    cartStorageKey() {
        return this.orderContext.isTableOrder
            ? `saleapp_customer_cart_table_${this.orderContext.tableId}`
            : 'saleapp_customer_cart';
    },

    orderTokenStorageKey() {
        return this.orderContext.isTableOrder
            ? `saleapp_customer_order_token_table_${this.orderContext.tableId}`
            : 'saleapp_customer_order_token';
    },

    pendingOrderKey() {
        return this.orderContext.isTableOrder
            ? `saleapp_customer_pending_order_key_table_${this.orderContext.tableId}`
            : 'saleapp_customer_pending_order_key';
    },

    paymentStorageKey() {
        return this.orderContext.isTableOrder
            ? `saleapp_customer_payment_table_${this.orderContext.tableId}`
            : 'saleapp_customer_payment';
    },

    init() {
        try {
            this.cart = JSON.parse(localStorage.getItem(this.cartStorageKey()) || '{}') || {};
            const savedPayment = JSON.parse(localStorage.getItem(this.paymentStorageKey()) || 'null');
            if (savedPayment && typeof savedPayment.order_code === 'string' && Number(savedPayment.total_amount) > 0) {
                this.paymentOrder = savedPayment;
            }
        } catch (error) {
            console.warn('Could not restore customer cart or payment details:', error);
            this.cart = {};
        }
        this.updateConnection();
        window.addEventListener('online', () => this.updateConnection());
        window.addEventListener('offline', () => this.updateConnection());
        window.addEventListener('beforeinstallprompt', event => {
            event.preventDefault();
            this.pendingInstallPrompt = event;
            document.getElementById('customer-install-button')?.classList.remove('hidden');
        });
        this.renderCart();
        try {
            this.currentOrderToken = localStorage.getItem(this.orderTokenStorageKey()) || '';
        } catch (error) {
            console.warn('Could not restore customer order tracking:', error);
        }
        if (this.currentOrderToken) {
            document.getElementById('customer-track-order-button')?.classList.remove('hidden');
            this.checkOrderStatus();
        }
        this.syncMenuLocks();
        window.setInterval(() => this.syncMenuLocks(), 10000);
    },

    async syncMenuLocks() {
        if (!navigator.onLine) return;
        try {
            const res = await fetch('api/products.php', { cache: 'no-store' });
            const data = await res.json();
            if (!data.success || !Array.isArray(data.data)) return;
            data.data.forEach(p => {
                const card = document.querySelector(`.product-item[data-product-id="${Number(p.id)}"]`);
                if (!card) return;
                const isLocked = (p.status === 'locked');
                card.dataset.locked = isLocked ? '1' : '0';
                card.classList.toggle('opacity-50', isLocked);
                card.classList.toggle('grayscale', isLocked);
                const btn = card.querySelector('button[onclick*="addCustomerCartItem"]');
                if (btn) {
                    if (isLocked) {
                        btn.innerHTML = '<i class="fas fa-ban mr-1"></i>Tạm hết';
                        btn.classList.add('bg-rose-500/20', 'text-rose-300');
                    } else {
                        btn.innerHTML = '<i class="fas fa-plus"></i><span>Chọn</span>';
                        btn.classList.remove('bg-rose-500/20', 'text-rose-300');
                    }
                }
            });
        } catch (e) {}
    },

    updateConnection() {
        const online = navigator.onLine;
        const dot = document.getElementById('customer-connection-dot');
        const text = document.getElementById('customer-connection-text');
        if (dot) dot.className = `w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-400'}`;
        if (text) text.textContent = online
            ? 'Đang kết nối · Thực đơn được lưu để xem offline'
            : 'Đang offline · Có thể xem menu đã lưu, gửi đơn cần kết nối mạng';
        const submit = document.getElementById('customer-order-submit');
        if (submit) {
            submit.disabled = !online;
            submit.title = online ? '' : 'Kết nối mạng để gửi đơn';
        }
    },

    productInfo(productId) {
        const card = document.querySelector(`.product-item[data-product-id="${Number(productId)}"]`);
        if (!card) return null;
        return {
            id: Number(card.dataset.productId),
            name: card.dataset.productName || '',
            price: Number(card.dataset.productPrice) || 0
        };
    },

    addItem(productId) {
        const card = document.querySelector(`.product-item[data-product-id="${Number(productId)}"]`);
        if (card && card.dataset.locked === '1') {
            alert('Món này hiện Bếp vừa báo tạm hết hàng, Quý khách vui lòng chọn món khác nhé!');
            return;
        }
        const product = this.productInfo(productId);
        if (!product) return;
        const current = Number(this.cart[product.id]) || 0;
        if (current >= 30) {
            alert('Mỗi món chỉ được thêm tối đa 30 phần.');
            return;
        }
        this.cart[product.id] = current + 1;
        this.saveCart();
        this.renderCart();
    },

    changeItem(productId, delta) {
        const next = (Number(this.cart[productId]) || 0) + delta;
        if (next <= 0) delete this.cart[productId];
        else if (next <= 30) this.cart[productId] = next;
        this.saveCart();
        this.renderCart();
    },

    saveCart() {
        try {
            localStorage.setItem(this.cartStorageKey(), JSON.stringify(this.cart));
        } catch (error) {
            console.warn('Could not save customer cart:', error);
        }
    },

    renderCart() {
        const count = Object.values(this.cart).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
        const countEl = document.getElementById('customer-cart-count');
        if (countEl) {
            countEl.textContent = String(count);
            countEl.classList.toggle('hidden', count === 0);
        }
        const list = document.getElementById('customer-cart-items');
        const totalEl = document.getElementById('customer-cart-total');
        if (!list || !totalEl) return;

        list.replaceChildren();
        let total = 0;
        const productIds = Object.keys(this.cart);
        if (productIds.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'py-6 text-center text-xs text-slate-400';
            empty.textContent = 'Giỏ hàng đang trống. Chọn món trong thực đơn để bắt đầu.';
            list.appendChild(empty);
        }
        productIds.forEach(id => {
            const product = this.productInfo(id);
            const quantity = Number(this.cart[id]) || 0;
            if (!product || quantity <= 0) return;
            total += product.price * quantity;

            const row = document.createElement('div');
            row.className = 'flex items-center justify-between gap-3 rounded-xl bg-slate-900/70 border border-white/5 p-3';
            const info = document.createElement('div');
            info.className = 'min-w-0';
            const title = document.createElement('b');
            title.className = 'block truncate text-xs text-white';
            title.textContent = product.name;
            const price = document.createElement('span');
            price.className = 'text-[11px] text-slate-400';
            price.textContent = `${this.formatMoney(product.price)} đ / món`;
            info.append(title, price);

            const controls = document.createElement('div');
            controls.className = 'flex items-center gap-2 shrink-0';
            const minus = this.quantityButton('−', 'Giảm số lượng', () => this.changeItem(id, -1));
            const qty = document.createElement('b');
            qty.className = 'min-w-4 text-center text-xs';
            qty.textContent = String(quantity);
            const plus = this.quantityButton('+', 'Tăng số lượng', () => this.changeItem(id, 1));
            controls.append(minus, qty, plus);
            row.append(info, controls);
            list.appendChild(row);
        });
        totalEl.textContent = `${this.formatMoney(total)} đ`;
    },

    quantityButton(label, title, action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'w-7 h-7 rounded-lg bg-white/10 hover:bg-sky-500/30 text-white';
        button.title = title;
        button.textContent = label;
        button.addEventListener('click', action);
        return button;
    },

    formatMoney(value) {
        return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0));
    },

    async submitOrder(event) {
        event.preventDefault();
        if (!navigator.onLine) {
            alert('Bạn đang offline. Đơn hàng sẽ chưa được gửi; vui lòng kết nối mạng rồi thử lại.');
            return;
        }
        const items = Object.entries(this.cart).map(([id, quantity]) => ({ id: Number(id), quantity: Number(quantity) }));
        if (!items.length) {
            alert('Giỏ hàng đang trống.');
            return;
        }
        const submit = document.getElementById('customer-order-submit');
        const errorEl = document.getElementById('customer-order-error');
        if (errorEl) errorEl.classList.add('hidden');
        submit.disabled = true;
        submit.textContent = 'Đang gửi đơn...';

        let idempotencyKey;
        try {
            idempotencyKey = sessionStorage.getItem(this.pendingOrderKey());
            if (!idempotencyKey) {
                idempotencyKey = this.randomKey();
                sessionStorage.setItem(this.pendingOrderKey(), idempotencyKey);
            }
            const nameInput = document.getElementById('customer-order-name');
            const phoneInput = document.getElementById('customer-order-phone');
            const orderPayload = {
                customer_name: nameInput?.value.trim() || '',
                customer_phone: phoneInput?.value.trim() || '',
                note: document.getElementById('customer-order-note').value.trim(),
                idempotency_key: idempotencyKey,
                items
            };
            if (this.orderContext.isTableOrder) orderPayload.table_order_token = this.orderContext.tableToken;
            const response = await fetch('api/orders.php?action=customer_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Không thể gửi đơn hàng.');

            this.currentOrderToken = data.tracking_token;
            try {
                localStorage.setItem(this.orderTokenStorageKey(), this.currentOrderToken);
                localStorage.removeItem(this.cartStorageKey());
                sessionStorage.removeItem(this.pendingOrderKey());
                localStorage.setItem(this.paymentStorageKey(), JSON.stringify(data));
            } catch (storageError) {
                console.warn('Order was accepted, but local order details could not be saved:', storageError);
            }
            document.getElementById('customer-track-order-button')?.classList.remove('hidden');
            this.cart = {};
            this.renderCart();
            this.paymentOrder = data;
            this.showPayment(this.paymentOrder);
            this.showOrderStatus({
                status: 'pending',
                kitchen_status: 'pending'
            });
            await this.checkOrderStatus();
        } catch (error) {
            if (error instanceof TypeError && !navigator.onLine) {
                error.message = 'Mất kết nối mạng. Giỏ hàng được giữ lại; hãy kết nối mạng để gửi lại.';
            }
            if (errorEl) {
                errorEl.textContent = error.message || 'Không thể gửi đơn.';
                errorEl.classList.remove('hidden');
            } else {
                alert(error.message || 'Không thể gửi đơn.');
            }
        } finally {
            submit.disabled = !navigator.onLine;
            submit.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>Gửi đơn đến quán';
        }
    },

    randomKey() {
        if (window.crypto?.getRandomValues) {
            return Array.from(window.crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
        }
        return `${Date.now().toString(16)}${Math.random().toString(16).slice(2).padEnd(24, '0')}`.slice(0, 32);
    },

    async checkOrderStatus() {
        if (!this.currentOrderToken || !navigator.onLine) return;
        try {
            const response = await fetch(`api/orders.php?action=customer_status&token=${encodeURIComponent(this.currentOrderToken)}`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Không thể tải trạng thái đơn.');
            document.getElementById('customer-order-code').textContent = data.order.order_code;
            this.showOrderStatus(data.order);
        } catch (error) {
            console.warn('Customer order status unavailable:', error);
        }
    },

    showOrderStatus(order) {
        let label;
        if (order.status === 'cancelled') {
            label = 'Đơn đã bị hủy. Vui lòng liên hệ quán để được hỗ trợ.';
        } else if (order.status === 'completed') {
            label = 'Đơn hàng đã hoàn tất, đã giao cho khách.';
        } else if (order.kitchen_status === 'served' || order.served_at) {
            label = 'Đơn đã được giao cho khách.';
        } else if (order.kitchen_status === 'ready') {
            label = 'Món đã chuẩn bị xong, đang chờ giao cho khách.';
        } else if (order.kitchen_status === 'awaiting_waiter') {
            label = 'Đã gửi yêu cầu đặt món, đang chờ phục vụ xác nhận.';
        } else {
            label = 'Quán đã nhận đơn, bếp đang chuẩn bị món.';
        }
        const paymentLabel = order.payment_status === 'paid' ? 'Đã xác nhận thanh toán' : 'Đang chờ xác nhận thanh toán';
        const status = document.getElementById('customer-order-status');
        if (status) status.textContent = `${label} · ${paymentLabel}${order.total_amount ? ` · Tổng ${this.formatMoney(order.total_amount)} đ` : ''}`;
        const paymentStatus = document.getElementById('customer-payment-status');
        if (paymentStatus) paymentStatus.textContent = `${label} ${paymentLabel === 'Đã xác nhận thanh toán' ? '· Đã thanh toán.' : '· Chờ quán xác nhận thanh toán.'}`;
        const paymentConfirmed = order.payment_status === 'paid';
        const paymentQr = document.getElementById('customer-payment-qr');
        const paymentDetails = document.querySelector('#customer-order-payment .customer-payment-details');
        document.getElementById('customer-payment-paid')?.classList.toggle('hidden', !paymentConfirmed);
        paymentQr?.classList.toggle('hidden', paymentConfirmed);
        paymentDetails?.classList.toggle('hidden', paymentConfirmed);
        if (paymentConfirmed) paymentQr?.removeAttribute('src');
    },

    showPayment(order) {
        const checkout = document.getElementById('customer-cart-checkout');
        const payment = document.getElementById('customer-order-payment');
        const title = document.getElementById('customer-cart-title');
        const subtitle = document.querySelector('#customer-cart-modal .customer-cart-title p');
        const qr = document.getElementById('customer-payment-qr');
        const qrError = document.getElementById('customer-payment-qr-error');
        if (!checkout || !payment || !title || !qr || !qrError) return;

        checkout.classList.add('hidden');
        payment.classList.remove('hidden');
        title.textContent = 'Thanh toán đơn hàng';
        if (subtitle) subtitle.textContent = window.customerPaymentDetails?.vietqrEnabled
            ? 'Quét mã VietQR để chuyển khoản cho quán.' : 'Liên hệ quán để thanh toán.';
        document.getElementById('customer-payment-order-code').textContent = order.order_code;
        document.getElementById('customer-payment-total').textContent = `${this.formatMoney(order.total_amount)} đ`;

        const bank = window.customerPaymentDetails || {};
        const note = `THANH TOAN ${order.order_code}`;
        document.getElementById('customer-payment-bank').textContent = bank.bankId || 'Chưa cấu hình';
        document.getElementById('customer-payment-account').textContent = bank.accountNo || 'Chưa cấu hình';
        document.getElementById('customer-payment-account-name').textContent = bank.accountName || 'Chưa cấu hình';
        document.getElementById('customer-payment-note').textContent = note;
        const paymentConfirmed = order.payment_status === 'paid';
        document.getElementById('customer-payment-paid')?.classList.toggle('hidden', !paymentConfirmed);
        const paymentDetails = document.querySelector('#customer-order-payment .customer-payment-details');
        paymentDetails?.classList.toggle('hidden', paymentConfirmed);
        if (paymentConfirmed) {
            qr.removeAttribute('src');
            qr.classList.add('hidden');
            qrError.classList.add('hidden');
            return;
        }
        if (!bank.vietqrEnabled) {
            qr.removeAttribute('src');
            qr.classList.add('hidden');
            qrError.textContent = 'Tính năng VietQR chưa được cấp phép. Vui lòng liên hệ quán để thanh toán.';
            qrError.classList.remove('hidden');
            return;
        }
        qrError.classList.add('hidden');
        qr.onerror = () => {
            qr.classList.add('hidden');
            qrError.textContent = 'Không tải được mã VietQR. Vui lòng kiểm tra kết nối hoặc chuyển khoản theo thông tin tài khoản bên dưới.';
            qrError.classList.remove('hidden');
        };

        const amount = Math.round(Number(order.total_amount));
        if (!bank.bankId || !bank.accountNo || !bank.accountName || !Number.isFinite(amount) || amount <= 0) {
            qr.removeAttribute('src');
            qr.classList.add('hidden');
            qrError.textContent = 'Quán chưa cấu hình đủ thông tin nhận thanh toán VietQR. Vui lòng liên hệ quán để được hỗ trợ.';
            qrError.classList.remove('hidden');
            return;
        }

        const params = new URLSearchParams({
            amount: String(amount),
            addInfo: note,
            accountName: bank.accountName
        });
        qr.src = `https://img.vietqr.io/image/${encodeURIComponent(bank.bankId)}-${encodeURIComponent(bank.accountNo)}-compact2.png?${params}`;
        qr.classList.remove('hidden');
    },

    resetPayment() {
        this.paymentOrder = null;
        localStorage.removeItem(this.paymentStorageKey());
        document.getElementById('customer-order-payment')?.classList.add('hidden');
        document.getElementById('customer-cart-checkout')?.classList.remove('hidden');
        const title = document.getElementById('customer-cart-title');
        const subtitle = document.querySelector('#customer-cart-modal .customer-cart-title p');
        if (title) title.textContent = this.orderContext.isTableOrder
            ? `Đặt món tại ${this.orderContext.tableName || ''}`.trim()
            : 'Đơn mang về';
        if (subtitle) subtitle.textContent = this.orderContext.isTableOrder
            ? 'Món sẽ được cộng vào hóa đơn bàn.'
            : 'Quán sẽ liên hệ xác nhận đơn hàng.';
    },

    async installApp() {
        if (!this.pendingInstallPrompt) return;
        this.pendingInstallPrompt.prompt();
        await this.pendingInstallPrompt.userChoice;
        this.pendingInstallPrompt = null;
        document.getElementById('customer-install-button')?.classList.add('hidden');
    }
};

const CustomerAdCarousel = {
    slides: [],
    index: 0,
    timer: null,
    paused: false,
    soundEnabled: false,

    init() {
        const carousel = document.getElementById('customer-ad-carousel');
        if (!carousel) return;
        this.slides = Array.from(carousel.querySelectorAll('.customer-ad-slide'));
        this.index = Math.max(0, this.slides.findIndex(slide => slide.classList.contains('is-active')));
        this.slides.forEach(slide => {
            const video = slide.querySelector('video');
            if (!video) return;
            video.loop = false;
            video.addEventListener('ended', () => {
                if (!this.paused && this.slides[this.index]?.querySelector('video') === video) {
                    this.show((this.index + 1) % this.slides.length);
                }
            });
            video.addEventListener('error', () => {
                this.advanceAfterVideoFailure(video, new Error('Video quảng cáo không thể tải hoặc giải mã.'));
            });
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stop();
                this.pauseActiveVideo();
            } else {
                this.playActiveVideo();
                this.schedule();
            }
        });
        this.updatePlaybackControl();
        this.playActiveVideo();
        this.schedule();
    },

    show(index) {
        if (!this.slides.length) {
            this.slides = Array.from(document.querySelectorAll('#customer-ad-carousel .customer-ad-slide'));
        }
        if (!this.slides.length) return;
        this.index = (index + this.slides.length) % this.slides.length;
        this.slides.forEach((slide, slideIndex) => {
            const active = slideIndex === this.index;
            slide.classList.toggle('is-active', active);
            slide.setAttribute('aria-hidden', active ? 'false' : 'true');
            if (!active) {
                slide.querySelector('video')?.pause();
            }
        });
        document.querySelectorAll('.customer-ad-dot').forEach((dot, dotIndex) => {
            const active = dotIndex === this.index;
            dot.className = `customer-ad-dot h-1.5 rounded-full transition-all ${active ? 'w-7 bg-white' : 'w-2 bg-white/45'}`;
            dot.setAttribute('aria-current', active ? 'true' : 'false');
        });
        this.playActiveVideo(true);
        this.schedule();
    },

    playActiveVideo(restart = false) {
        const video = this.slides[this.index]?.querySelector('video');
        if (!video || this.paused || document.hidden) return;
        if (restart && video.readyState > 0) video.currentTime = 0;
        video.muted = !this.soundEnabled;
        video.play().catch(error => {
            if (error.name === 'NotAllowedError') {
                video.muted = true;
                this.soundEnabled = false;
                this.updateSoundControls();
                console.warn('Video autoplay with sound was blocked; continuing muted until sound is enabled by the viewer.');
                return;
            }
            this.advanceAfterVideoFailure(video, error);
        });
    },

    toggleSound() {
        const video = this.slides[this.index]?.querySelector('video');
        if (!video) return;
        this.soundEnabled = !this.soundEnabled;
        video.muted = !this.soundEnabled;
        this.updateSoundControls();
        if (this.soundEnabled) {
            video.play().catch(error => {
                this.soundEnabled = false;
                video.muted = true;
                this.updateSoundControls();
                console.warn('Could not enable promotional video sound:', error);
            });
        }
    },

    updateSoundControls() {
        document.querySelectorAll('.customer-ad-sound').forEach(button => {
            button.setAttribute('aria-pressed', String(this.soundEnabled));
            button.setAttribute('aria-label', this.soundEnabled ? 'Tắt âm thanh video' : 'Bật âm thanh video');
            button.title = this.soundEnabled ? 'Tắt tiếng' : 'Bật tiếng';
            const icon = button.querySelector('i');
            if (icon) icon.className = this.soundEnabled ? 'fas fa-volume-high' : 'fas fa-volume-xmark';
        });
    },

    advanceAfterVideoFailure(video, error) {
        console.warn('Promotional video could not be played:', error);
        if (this.paused || document.hidden || this.slides[this.index]?.querySelector('video') !== video) return;
        this.show((this.index + 1) % this.slides.length);
    },

    pauseActiveVideo() {
        this.slides[this.index]?.querySelector('video')?.pause();
    },

    schedule() {
        this.stop();
        if (this.slides.length < 2 || this.paused || document.hidden) return;
        if (this.slides[this.index]?.querySelector('video')) return;
        const duration = Number(this.slides[this.index]?.dataset.adDuration) || 6;
        this.timer = window.setTimeout(() => this.show((this.index + 1) % this.slides.length), duration * 1000);
    },

    togglePlayback() {
        this.paused = !this.paused;
        this.updatePlaybackControl();
        if (this.paused) {
            this.stop();
            this.pauseActiveVideo();
            return;
        }
        this.playActiveVideo();
        this.schedule();
    },

    updatePlaybackControl() {
        const button = document.getElementById('customer-ad-toggle');
        if (!button) return;
        button.setAttribute('aria-label', this.paused ? 'Tiếp tục trình chiếu' : 'Tạm dừng trình chiếu');
        button.setAttribute('aria-pressed', String(this.paused));
        const icon = button.querySelector('i');
        if (icon) icon.className = this.paused ? 'fas fa-play' : 'fas fa-pause';
    },

    stop() {
        if (this.timer) window.clearTimeout(this.timer);
        this.timer = null;
    }
};

window.addCustomerCartItem = productId => CustomerOrdering.addItem(productId);
window.showCustomerAdSlide = index => CustomerAdCarousel.show(Number(index));
window.changeCustomerAdSlide = direction => CustomerAdCarousel.show(CustomerAdCarousel.index + Number(direction));
window.toggleCustomerAdPlayback = () => CustomerAdCarousel.togglePlayback();
window.toggleCustomerAdSound = () => CustomerAdCarousel.toggleSound();
window.openCustomerCart = () => {
    CustomerOrdering.renderCart();
    const modal = document.getElementById('customer-cart-modal');
    if (modal) {
        if (CustomerOrdering.paymentOrder) {
            CustomerOrdering.showPayment(CustomerOrdering.paymentOrder);
            CustomerOrdering.checkOrderStatus();
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};
window.closeCustomerCart = () => {
    const modal = document.getElementById('customer-cart-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};
window.submitCustomerOrder = event => CustomerOrdering.submitOrder(event);
window.resetCustomerPayment = () => CustomerOrdering.resetPayment();
window.checkCustomerOrderStatus = () => CustomerOrdering.checkOrderStatus();
window.openCustomerOrderStatus = () => {
    if (!CustomerOrdering.currentOrderToken) return;
    const modal = document.getElementById('customer-order-confirmation');
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
    CustomerOrdering.checkOrderStatus();
};
window.closeCustomerOrderConfirmation = () => {
    const modal = document.getElementById('customer-order-confirmation');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
};
window.installCustomerApp = () => CustomerOrdering.installApp();
window.copyPromoCode = async code => {
    try {
        await navigator.clipboard.writeText(code);
        alert('Đã sao chép mã ưu đãi: ' + code);
    } catch (error) {
        window.prompt('Sao chép mã ưu đãi:', code);
    }
};
window.shareStore = async () => {
    const shareData = { title: document.title, text: document.querySelector('meta[name="description"]')?.content || '', url: window.location.href };
    try {
        if (navigator.share) await navigator.share(shareData);
        else if (navigator.clipboard) {
            await navigator.clipboard.writeText(window.location.href);
            alert('Đã sao chép liên kết trang quán.');
        } else window.prompt('Liên kết trang quán:', window.location.href);
    } catch (error) {
        if (error.name !== 'AbortError') console.warn('Store sharing was not completed:', error);
    }
};

const CustomerJukebox = {
    tracks: [],
    queue: [],
    nowPlaying: null,
    activeTab: 'tracks',
    timer: null,

    async init() {
        await this.loadStatus();
        this.timer = setInterval(() => this.loadStatus(), 12000);
    },

    async loadStatus() {
        try {
            const res = await fetch('api/media/jukebox/status');
            const data = await res.json();
            if (data.success) {
                this.nowPlaying = data.now_playing;
                this.queue = data.queue || [];
                this.updateNowPlayingUI();
                this.renderQueueUI();
            }
        } catch (e) {
            console.log('Jukebox status error:', e);
        }
    },

    updateNowPlayingUI() {
        if (!this.nowPlaying) return;
        const title = this.nowPlaying.track_title || 'Chưa có bài hát';
        const artist = this.nowPlaying.track_artist || 'Quán Tự Động';
        const table = this.nowPlaying.table_name || 'Hệ Thống';

        const barTitle = document.getElementById('jukebox-now-title');
        const barArtist = document.getElementById('jukebox-now-artist');
        const barTable = document.getElementById('jukebox-now-table');
        if (barTitle) barTitle.textContent = title;
        if (barArtist) barArtist.textContent = artist;
        if (barTable) barTable.textContent = table;

        const modalTitle = document.getElementById('juke-modal-now-title');
        const modalArtist = document.getElementById('juke-modal-now-artist');
        const modalTable = document.getElementById('juke-modal-now-table');
        if (modalTitle) modalTitle.textContent = title;
        if (modalArtist) modalArtist.textContent = artist;
        if (modalTable) modalTable.textContent = table;
    },

    async loadTracks() {
        try {
            const res = await fetch('api/media/tracks');
            const data = await res.json();
            if (data.success && Array.isArray(data.tracks)) {
                this.tracks = data.tracks;
                this.renderTracksUI(this.tracks);
            }
        } catch (e) {
            console.log('Jukebox load tracks error:', e);
        }
    },

    renderTracksUI(list) {
        const container = document.getElementById('juke-tracks-list');
        if (!container) return;
        if (!list || list.length === 0) {
            container.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs">Không tìm thấy bài hát nào phù hợp.</div>';
            return;
        }

        container.innerHTML = list.map(t => {
            const durMin = Math.floor(t.duration_sec / 60);
            const durSec = String(t.duration_sec % 60).padStart(2, '0');
            return `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/5 hover:border-purple-500/30 transition-all gap-3">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center justify-center text-xs shrink-0 font-mono">
                            <i class="fas fa-music"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="font-bold text-xs text-white truncate">${t.title}</div>
                            <div class="text-[11px] text-slate-400 flex items-center gap-2 truncate mt-0.5">
                                <span>${t.artist}</span>
                                <span class="px-1.5 py-0.2 rounded bg-slate-800 text-purple-300 text-[9px] border border-white/5">${t.genre || 'Acoustic'}</span>
                                <span class="text-slate-500 font-mono text-[10px]">${durMin}:${durSec}</span>
                            </div>
                        </div>
                    </div>
                    <button type="button" onclick="CustomerJukebox.requestSong(${t.id}, '${t.title.replace(/'/g, "\\'")}')" class="btn-glass text-[11px] py-1 px-2.5 bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border-purple-500/30 font-bold flex items-center gap-1 shrink-0 transition-all">
                        <i class="fas fa-plus text-[10px]"></i>
                        <span>Yêu Cầu</span>
                    </button>
                </div>
            `;
        }).join('');
    },

    renderQueueUI() {
        const countBadge = document.getElementById('juke-queue-count');
        if (countBadge) countBadge.textContent = this.queue.length;

        const container = document.getElementById('juke-queue-list');
        if (!container) return;
        if (!this.queue || this.queue.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs rounded-xl border border-dashed border-white/10 bg-slate-950/40">Chưa có bài nào trong hàng đợi. Hãy là người đầu tiên chọn bài!</div>';
            return;
        }

        container.innerHTML = this.queue.map((q, idx) => `
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-white/5 gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-6 text-center font-mono font-bold text-xs ${idx === 0 ? 'text-amber-400' : 'text-slate-400'}">#${idx + 1}</span>
                    <div class="min-w-0">
                        <div class="font-bold text-xs text-white truncate flex items-center gap-1.5">
                            <span>${q.track_title}</span>
                            ${q.is_priority ? '<span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[8px] font-black border border-amber-500/30 uppercase">VIP</span>' : ''}
                        </div>
                        <div class="text-[10px] text-slate-400 flex items-center gap-2 truncate mt-0.5">
                            <span>${q.track_artist}</span>
                            <span class="text-sky-300"><i class="fas fa-chair text-[9px] mr-1"></i>${q.table_name || 'Tại Bàn'}</span>
                        </div>
                    </div>
                </div>
                <button type="button" onclick="CustomerJukebox.voteSong(${q.id})" class="btn-glass text-[11px] py-1 px-2 text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/30 border border-rose-500/20 flex items-center gap-1 shrink-0 font-mono transition-all" title="Bấm thích / Vote bài này">
                    <i class="fas fa-heart text-[10px]"></i>
                    <span>${q.vote_count || 1}</span>
                </button>
            </div>
        `).join('');
    },

    filterTracks() {
        const kw = (document.getElementById('juke-search-input')?.value || '').toLowerCase().trim();
        const genre = document.getElementById('juke-genre-filter')?.value || 'all';

        let filtered = this.tracks;
        if (genre !== 'all') {
            filtered = filtered.filter(t => t.genre === genre);
        }
        if (kw) {
            filtered = filtered.filter(t => 
                (t.title || '').toLowerCase().includes(kw) || 
                (t.artist || '').toLowerCase().includes(kw)
            );
        }
        this.renderTracksUI(filtered);
    },

    async requestSong(trackId, title) {
        let tableName = 'Khách tại bàn';
        let tableId = 0;
        try {
            const ctx = CustomerOrdering.orderContext;
            if (ctx && ctx.tableName) {
                tableName = ctx.tableName;
                tableId = Number(ctx.tableId) || 0;
            }
        } catch (_) {}

        try {
            const res = await fetch('api/media/jukebox/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    track_id: trackId,
                    table_name: tableName,
                    table_id: tableId,
                    is_priority: 0
                })
            });
            const data = await res.json();
            alert(data.message || (data.success ? 'Yêu cầu thành công!' : 'Lỗi yêu cầu bài'));
            if (data.success) {
                await this.loadStatus();
                this.switchTab('queue');
            }
        } catch (e) {
            alert('Lỗi kết nối máy chủ: ' + e.message);
        }
    },

    async voteSong(queueId) {
        try {
            const res = await fetch('api/media/jukebox/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queue_id: queueId })
            });
            const data = await res.json();
            if (data.success) {
                this.loadStatus();
            }
        } catch (e) {
            console.log('Vote song error:', e);
        }
    },

    switchTab(tab) {
        this.activeTab = tab;
        const btnTracks = document.getElementById('tab-btn-juke-tracks');
        const btnQueue = document.getElementById('tab-btn-juke-queue');
        const viewTracks = document.getElementById('juke-tab-tracks');
        const viewQueue = document.getElementById('juke-tab-queue');

        if (tab === 'tracks') {
            btnTracks?.classList.add('bg-purple-600', 'text-white', 'shadow-sm');
            btnTracks?.classList.remove('text-slate-400');
            btnQueue?.classList.remove('bg-purple-600', 'text-white', 'shadow-sm');
            btnQueue?.classList.add('text-slate-400');
            viewTracks?.classList.remove('hidden');
            viewQueue?.classList.add('hidden');
            if (this.tracks.length === 0) this.loadTracks();
        } else {
            btnQueue?.classList.add('bg-purple-600', 'text-white', 'shadow-sm');
            btnQueue?.classList.remove('text-slate-400');
            btnTracks?.classList.remove('bg-purple-600', 'text-white', 'shadow-sm');
            btnTracks?.classList.add('text-slate-400');
            viewQueue?.classList.remove('hidden');
            viewTracks?.classList.add('hidden');
            this.loadStatus();
        }
    },

    open() {
        const modal = document.getElementById('customer-jukebox-modal');
        if (modal) {
            modal.classList.remove('opacity-0', 'pointer-events-none');
            this.switchTab(this.activeTab);
            this.loadStatus();
        }
    },

    close() {
        const modal = document.getElementById('customer-jukebox-modal');
        if (modal) {
            modal.classList.add('opacity-0', 'pointer-events-none');
        }
    }
};

window.CustomerJukebox = CustomerJukebox;
window.openJukeboxModal = () => CustomerJukebox.open();
window.closeJukeboxModal = () => CustomerJukebox.close();

const initializeCustomerExperience = () => {
    CustomerAdCarousel.init();
    CustomerOrdering.init();
    CustomerJukebox.init();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCustomerExperience, { once: true });
} else {
    initializeCustomerExperience();
}
