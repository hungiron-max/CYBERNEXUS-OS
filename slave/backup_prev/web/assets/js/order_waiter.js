// State
let allTables = [];
let filteredArea = 'all';
let currentTable = null;
let existingConfirmedItems = []; // Món đã xác nhận & gửi bếp trước đó (mờ, không thể sửa)
let newCartItems = [];           // Món mới gọi thêm trong lượt này (sáng, có thể sửa)
let activeOrderId = null;
let activeOrderKitchenStatus = null;
let activeOrderStatus = null;
let categories = [];
let products = [];
let toppings = [];
let selectedCategory = 'all';
let guestCount = 1;

function formatMoney(n) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(n || 0));
}

async function init() {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('pos_user') || 'null'); } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }
    if (!user) {
        alert((window.cnxT?window.cnxT('js.s_ord.46ed5a5f','Vui lòng đăng nhập để sử dụng giao diện Order Phục Vụ!'):'Vui lòng đăng nhập để sử dụng giao diện Order Phục Vụ!'));
        window.location.replace('index.html?need_login=waiter');
        return;
    }
    window.currentUser = user;
    const staffEl = document.getElementById('order-staff-name');
    if (staffEl && user) {
        staffEl.textContent = user.full_name || user.name || user.username || (window.cnxT?window.cnxT('ui.ord_html.b_c7307f33','Phục vụ'):'Phục vụ');
    }
    await loadCategoriesData();
    await loadProductsData();
    await loadTablesData();
}

// 1. Tables Data & Logic
async function loadTablesData() {
    try {
        const [resTables, resNotifs] = await Promise.all([
            fetch('api/tables.php'),
            fetch('api/orders.php?action=check_notifications&role=waiter')
        ]);
        const data = await resTables.json();
        const notifData = await resNotifs.json();

        if (data.success) {
            const firstTablesSnapshot = isTablesFirstLoad;
            const pendingQrOrderIds = new Set((data.data || [])
                .filter(table => table.customer_order_pending && table.active_order_id)
                .map(table => Number(table.active_order_id)));
            const hasNewCustomerQrOrder = Array.from(pendingQrOrderIds)
                .some(orderId => !window.knownCustomerQrOrderIds.has(orderId));
            window.knownCustomerQrOrderIds = pendingQrOrderIds;
            allTables = data.data;
            renderTables();
            if (hasNewCustomerQrOrder && !firstTablesSnapshot) {
                playDingDong();
            }
        }
        const onlineReadyOrders = ((notifData && notifData.ready_orders) || [])
            .filter(order => order.table_code === 'ONLINE');
        const onlineReadyBanner = document.getElementById('online-kitchen-ready-banner');
        if (onlineReadyBanner) {
            if (onlineReadyOrders.length > 0) {
                const latestOnlineOrder = onlineReadyOrders[0];
                document.getElementById('online-kitchen-ready-count').textContent = String(onlineReadyOrders.length);
                document.getElementById('online-kitchen-ready-text').textContent =
                    `${latestOnlineOrder.order_code} · ${latestOnlineOrder.customer_name || (window.cnxT?window.cnxT('js.s_ord.e876c322','Khách đặt online'):'Khách đặt online')} ${window.cnxT?window.cnxT('js.s_ord.ee9324f0','đã sẵn sàng bàn giao'):'đã sẵn sàng bàn giao'}`;
                onlineReadyBanner.classList.remove('hidden');
            } else {
                onlineReadyBanner.classList.add('hidden');
            }
        }

        // Check Kitchen cancellation & reject alerts (Bếp hủy món / Bếp từ chối hủy / Khóa món)
        if (notifData && notifData.cancellations && notifData.cancellations.length > 0) {
            const latest = notifData.cancellations[0];
            const cancelBanner = document.getElementById('kitchen-cancel-banner');
            const cancelTitle = document.getElementById('kitchen-cancel-title');
            const cancelText = document.getElementById('kitchen-cancel-text');
            const iconBg = document.getElementById('kitchen-cancel-icon-bg');
            const iconEl = document.getElementById('kitchen-cancel-icon');

            if (cancelBanner && cancelText) {
                cancelBanner.classList.remove('hidden');
                cancelText.innerText = latest.message;
                window.currentCancelNotifId = latest.id;

                const isReject = (latest.type === 'kitchen_reject_cancel');
                if (cancelTitle) {
                    cancelTitle.innerText = latest.title || (isReject ? '⚠️ BẾP TỪ CHỐI HỦY MÓN' : (window.cnxT?window.cnxT('ui.ord_html.div_e66f6e93','⚠️ BẾP HỦY MÓN TRÊN HÓA ĐƠN'):'⚠️ BẾP HỦY MÓN TRÊN HÓA ĐƠN'));
                }
                if (isReject) {
                    cancelBanner.className = 'shrink-0 mx-3 mt-2 p-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-xl shadow-amber-950/40 border border-amber-400 flex items-center justify-between z-40 animate-pulse';
                    if (iconBg) iconBg.className = 'w-9 h-9 rounded-xl bg-white text-amber-600 flex items-center justify-center text-lg shadow shrink-0';
                    if (iconEl) iconEl.className = 'fas fa-shield-halved';
                } else {
                    cancelBanner.className = 'shrink-0 mx-3 mt-2 p-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-xl shadow-rose-950/40 border border-rose-400 flex items-center justify-between z-40 animate-pulse';
                    if (iconBg) iconBg.className = 'w-9 h-9 rounded-xl bg-white text-rose-600 flex items-center justify-center text-lg shadow shrink-0';
                    if (iconEl) iconEl.className = 'fas fa-triangle-exclamation';
                }

                if (window.lastCancelNotifId !== latest.id) {
                    playDingDong();
                    window.lastCancelNotifId = latest.id;

                    // Always reload products to update locked/unlocked status
                    loadProductsData().then(() => {
                        renderOrderProducts();
                    });

                    // If waiter is currently viewing the order of that table, reload it immediately!
                    if (currentTable && (currentTable.code === latest.table_code || currentTable.id === latest.order_id) && activeOrderId) {
                        loadExistingTableOrder(activeOrderId);
                    }
                }
            }
        } else {
            const cancelBanner = document.getElementById('kitchen-cancel-banner');
            if (cancelBanner) cancelBanner.classList.add('hidden');
        }

        // Poll new workflow alerts (order_alerts + settlement deltas)
        try {
            const aRes = await fetch('api/orders.php?action=alerts&target_role=all');
            const aJson = await aRes.json();
            const box = document.getElementById('waiter-action-center');
            const listEl = document.getElementById('waiter-alert-list');
            const cntEl = document.getElementById('waiter-alert-count');
            if (aJson && aJson.success && box && listEl) {
                const alerts = Array.isArray(aJson.alerts) ? aJson.alerts : [];
                const qrAlerts = alerts.filter(al => al.alert_type === 'qr_table_pending' || al.alert_type === 'qr_payment_pending');
                if (!window.knownQrAlertIds) {
                    window.knownQrAlertIds = new Set(qrAlerts.map(al => Number(al.id)));
                } else {
                    const hasNewQrAlert = qrAlerts.some(al => !window.knownQrAlertIds.has(Number(al.id)));
                    if (hasNewQrAlert) playDingDong();
                    window.knownQrAlertIds = new Set(qrAlerts.map(al => Number(al.id)));
                }
                const deltas = Array.isArray(aJson.pending_deltas) ? aJson.pending_deltas.filter(d => d.settlement_status === 'extra_due' || d.settlement_status === 'refund_due') : [];
                const totalCnt = alerts.length + deltas.length;
                if (cntEl) cntEl.textContent = String(totalCnt);
                if (totalCnt === 0) {
                    box.classList.add('hidden');
                } else {
                    box.classList.remove('hidden');
                    let html = '';
                    deltas.forEach(d => {
                        const isRef = (d.settlement_status === 'refund_due');
                        const diff = Math.abs(Number(d.total_amount || 0) - Number(d.paid_amount || 0));
                        html += `
                            <div class="p-2 rounded-xl ${isRef ? 'bg-rose-950/60 border border-rose-500/40 text-rose-200' : 'bg-amber-950/60 border border-amber-500/40 text-amber-200'} flex items-center justify-between gap-2 text-xs">
                                <div class="min-w-0">
                                    <b class="block truncate">${isRef ? '💸 Cần HOÀN TIỀN' : (window.cnxT?window.cnxT('js.s_ord.ca2e8628','💰 Cần THU THÊM'):'💰 Cần THU THÊM')} ${escapeHtml(d.table_code || d.order_code)}: ${formatMoney(diff)} đ</b>
                                    <span class="text-[11px] opacity-85">Đơn ${escapeHtml(d.order_code)} ${window.cnxT?window.cnxT('js.s_ord.96f6874b','• Đã trả'):'• Đã trả'} ${formatMoney(d.paid_amount)}${window.cnxT?window.cnxT('js.s_ord.e8ade3c1','đ / Mới'):'đ / Mới'} ${formatMoney(d.total_amount)}đ</span>
                                </div>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-black/30 shrink-0">${isRef ? 'Chờ hoàn' : (window.cnxT?window.cnxT('js.s_ord.8f5f33f0','Chờ thu'):'Chờ thu')}</span>
                            </div>
                        `;
                    });
                    alerts.forEach(al => {
                        const isQr = (al.alert_type === 'qr_table_pending' || al.alert_type === 'qr_payment_pending');
                        const isUrgent = isQr || (al.alert_type === 'out_of_stock' || al.alert_type === 'refund_due' || al.alert_type === 'order_cancel_requested');
                        const nTxt = typeof window.cnxNotifText === 'function' ? window.cnxNotifText(al) : { title: al.title, message: al.message };
                        html += `
                            <div class="p-2 rounded-xl ${isQr ? 'bg-amber-950/60 border border-amber-400/50 text-amber-100' : (isUrgent ? 'bg-rose-950/50 border border-rose-500/40 text-rose-100' : 'bg-slate-800/90 border border-white/10 text-slate-200')} flex items-center justify-between gap-2 text-xs">
                                <div class="min-w-0">
                                    <b class="block truncate">${isQr ? '📱 ' : ''}${escapeHtml(nTxt.title || al.title)}</b>
                                    <span class="text-[11px] opacity-85">${escapeHtml(nTxt.message || al.message)}</span>
                                </div>
                                <div class="flex items-center gap-1.5 shrink-0">
                                    ${isQr && Number(al.table_id || 0) > 0 ? `<button type="button" onclick="selectOrderTable(${Number(al.table_id)})" class="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold">${window.cnxT?window.cnxT('js.s_ord.59bf3eff','Mở bàn'):'Mở bàn'}</button>` : ''}
                                    <button type="button" onclick="ackWaiterAlert(${Number(al.id)})" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">${isQr ? 'Đã xem' : (window.cnxT?window.cnxT('js.s_ord.37f682c8','Đã báo khách'):'Đã báo khách')}</button>
                                </div>
                            </div>
                        `;
                    });
                    listEl.innerHTML = html;
                }
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }

        // Check direct kitchen_ready alerts (Bếp báo xong món / Báo lại chuông)
        if (notifData && notifData.ready_alerts && notifData.ready_alerts.length > 0) {
            let hasNewBell = false;
            if (!window.knownReadyAlertIds) window.knownReadyAlertIds = new Set();

            notifData.ready_alerts.forEach(alertItem => {
                if (!window.knownReadyAlertIds.has(alertItem.id)) {
                    hasNewBell = true;
                    window.knownReadyAlertIds.add(alertItem.id);
                    // Mark read in background
                    fetch(`api/orders.php?action=ack_notification&notification_id=${alertItem.id}&role=waiter`, { method: 'POST' }).catch((errIgnored) => { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', errIgnored) : console.debug('order_waiter.js', errIgnored)); });
                }
            });

            if (hasNewBell && !isTablesFirstLoad) {
                playDingDong();
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function ackKitchenCancellation() {
    const banner = document.getElementById('kitchen-cancel-banner');
    if (banner) banner.classList.add('hidden');
    const notifIdToAck = window.currentCancelNotifId;
    window.currentCancelNotifId = null;
    if (notifIdToAck) {
        try {
            await fetch('api/orders.php?action=ack_notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notification_id: notifIdToAck,
                    role: 'waiter'
                })
            });
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }
    }
}

function filterTablesArea(area) {
    filteredArea = area;
    ['all', 'tq', 'mv'].forEach(t => {
        const el = document.getElementById(`btn-tab-${t}`);
        if (el) {
            el.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition-all';
        }
    });

    const activeBtn = area === 'all' ? 'btn-tab-all' : (area === 'TAI_QUAN' ? 'btn-tab-tq' : 'btn-tab-mv');
    document.getElementById(activeBtn).className = 'flex-1 py-1.5 text-xs font-bold rounded-lg text-white bg-sky-500 shadow-md transition-all';

    renderTables();
}

// ==========================================================
// DUAL-ENGINE MOBILE AUDIO & VIBRATION NOTIFICATION SYSTEM
// ==========================================================
let waiterSoundEnabled = localStorage.getItem('waiter_sound_enabled') !== '0';
let waiterAudioCtx = null;
let audioUnlocked = false;
let isTablesFirstLoad = true;
window.knownCustomerQrOrderIds = new Set();
window.knownReadyOrderIds = new Set();

// 1. Mobile Audio & Vibration Unlocker
function activateMobileAudio(isTest = false) {
    audioUnlocked = true;
    waiterSoundEnabled = true;
    localStorage.setItem('waiter_sound_enabled', '1');
    updateSoundToggleButton();

    const audioEl = document.getElementById('waiter-sound-chime');
    const banner = document.getElementById('audio-activate-banner');

    // Hide the activation banner
    if (banner) {
        banner.classList.add('hidden');
    }

    // Unlock & Play HTML5 Audio
    if (audioEl) {
        try {
            audioEl.volume = isTest ? 1.0 : 0.01;
            audioEl.currentTime = 0;
            const p = audioEl.play();
            if (p && p.then) {
                p.then(() => {
                    if (!isTest) {
                        audioEl.pause();
                        audioEl.currentTime = 0;
                        audioEl.volume = 1.0;
                    }
                }).catch(err => {
                    console.warn('Audio play failed:', err);
                });
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }
    }

    // Unlock Web Audio API (iOS WebKit requirement)
    try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
            if (!waiterAudioCtx) {
                waiterAudioCtx = new AudioCtxClass();
            }
            if (waiterAudioCtx.state === 'suspended') {
                waiterAudioCtx.resume();
            }
            // Play a silent 0.01s buffer to permanently unlock on iOS Safari
            const buffer = waiterAudioCtx.createBuffer(1, 1, 22050);
            const source = waiterAudioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(waiterAudioCtx.destination);
            source.start(0);
        }
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }

    // Trigger physical vibration
    if (isTest) {
        triggerPhoneVibration([300, 150, 300, 150, 450]);
    }

    // Visual feedback toast
    if (isTest) {
        const toast = document.getElementById('sound-toast');
        const toastText = document.getElementById('sound-toast-text');
        if (toast && toastText) {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS) {
                toastText.innerHTML = (window.cnxT?window.cnxT('js.s_ord.f0d23692','<i class="fas fa-bell text-emerald-400"></i> Đang phát thử chuông! <b>(Nếu không nghe, hãy bật gạt âm thanh bên hông iPhone)</b>'):'<i class="fas fa-bell text-emerald-400"></i> Đang phát thử chuông! <b>(Nếu không nghe, hãy bật gạt âm thanh bên hông iPhone)</b>');
            } else {
                toastText.innerHTML = (window.cnxT?window.cnxT('js.s_ord.fe81fb3e','<i class="fas fa-bell text-emerald-400"></i> Đang phát thử chuông & rung thông báo!'):'<i class="fas fa-bell text-emerald-400"></i> Đang phát thử chuông & rung thông báo!');
            }
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 4500);
        }
    }
}

// Attach global touch listener on document so any first interaction unlocks audio
document.addEventListener('touchstart', function onFirstTouch() {
    if (!audioUnlocked) {
        activateMobileAudio(false);
    }
}, { passive: true });

document.addEventListener('click', function onFirstClick() {
    if (!audioUnlocked) {
        activateMobileAudio(false);
    }
}, { passive: true });

// 2. Physical Vibration Trigger (Android & supported devices)
function triggerPhoneVibration(pattern = [300, 150, 300, 150, 450]) {
    try {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }
}

// 3. Play Notification Sound & Vibrate
function playDingDong() {
    if (!waiterSoundEnabled) return;

    // Trigger physical vibration on Android
    triggerPhoneVibration([300, 150, 300, 150, 450]);

    // Method 1: Play physical WAV audio element (assets/sounds/dingdong.wav)
    try {
        const audioEl = document.getElementById('waiter-sound-chime');
        if (audioEl) {
            audioEl.volume = 1.0;
            audioEl.currentTime = 0;
            const p = audioEl.play();
            if (p && p.catch) p.catch((errIgnored) => { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', errIgnored) : console.debug('order_waiter.js', errIgnored)); });
        }
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }

    // Method 2: Dual Engine - Also synthesize ding-dong via Web Audio API
    try {
        if (waiterAudioCtx && waiterAudioCtx.state === 'running') {
            const now = waiterAudioCtx.currentTime;
            const osc1 = waiterAudioCtx.createOscillator();
            const gain1 = waiterAudioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now);
            gain1.gain.setValueAtTime(0.6, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc1.connect(gain1);
            gain1.connect(waiterAudioCtx.destination);
            osc1.start(now);
            osc1.stop(now + 0.45);

            const osc2 = waiterAudioCtx.createOscillator();
            const gain2 = waiterAudioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.18);
            gain2.gain.setValueAtTime(0.6, now + 0.18);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
            osc2.connect(gain2);
            gain2.connect(waiterAudioCtx.destination);
            osc2.start(now + 0.18);
            osc2.stop(now + 0.75);
        }
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }
}

// 4. Sound Test & Toggle Button Handler
function testAndToggleSound() {
    // If already on, play test sound & vibration; if off, turn on and play
    activateMobileAudio(true);
}

function updateSoundToggleButton() {
    const btn = document.getElementById('btn-sound-toggle');
    const icon = document.getElementById('sound-toggle-icon');
    if (!btn || !icon) return;
    if (waiterSoundEnabled) {
        btn.className = 'w-8 h-8 rounded-lg btn-glass bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30 flex items-center justify-center p-0 shrink-0';
        icon.className = 'fas fa-volume-high text-xs';
        btn.title = (window.cnxT?window.cnxT('js.s_ord.a85d99f5','Chuông: ĐANG BẬT (Bấm để thử chuông)'):'Chuông: ĐANG BẬT (Bấm để thử chuông)');
    } else {
        btn.className = 'w-8 h-8 rounded-lg btn-glass bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 flex items-center justify-center p-0 shrink-0';
        icon.className = 'fas fa-volume-xmark text-xs';
        btn.title = (window.cnxT?window.cnxT('js.s_ord.80123c94','Chuông: ĐANG TẮT (Bấm để bật)'):'Chuông: ĐANG TẮT (Bấm để bật)');
    }
}

async function confirmDelivered(orderId, tableCode) {
    try {
        const res = await fetch(`api/orders.php?action=waiter_served&order_id=${orderId}`, {
            method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
            await loadTablesData();
        } else {
            alert(data.message || (window.cnxT?window.cnxT('js.s_adm.2d4e917e','Lỗi thao tác'):'Lỗi thao tác'));
        }
    } catch(e) {
        console.error(e);
    }
}

async function rushKitchenOrder(orderId, tableCode, btnEl) {
    if (!orderId) return;
    const origHtml = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = (window.cnxT?window.cnxT('js.s_ord.94775454','<i class="fas fa-spinner fa-spin"></i> Đang hối...'):'<i class="fas fa-spinner fa-spin"></i> Đang hối...');
    }
    try {
        const res = await fetch('api/orders.php?action=rush_kitchen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || (window.cnxT?window.cnxT('js.s_ord.1c2309c0','Không thể gửi lệnh hối xuống Bếp'):'Không thể gửi lệnh hối xuống Bếp'));
        }
        await loadTablesData();
    } catch (e) {
        alert(e.message || (window.cnxT?window.cnxT('js.s_ord.611f5e2c','Lỗi gửi lệnh hối xuống Bếp'):'Lỗi gửi lệnh hối xuống Bếp'));
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = origHtml;
        }
    }
}

async function confirmCustomerQrOrder(orderId) {
    const table = allTables.find(item => Number(item.active_order_id) === Number(orderId));
    if (!table || !table.customer_order_pending) {
        alert((window.cnxT?window.cnxT('js.s_ord.02ac3cf4','Đơn QR không còn chờ xác nhận. Danh sách bàn sẽ được cập nhật lại.'):'Đơn QR không còn chờ xác nhận. Danh sách bàn sẽ được cập nhật lại.'));
        await loadTablesData();
        return;
    }
    const tableCode = table.code || (window.cnxT?window.cnxT('js.s_ord.36731051','bàn'):'bàn');
    const itemCount = Number(table.item_count) || 0;
    if (!(await window.cnxConfirm(`${window.cnxT?window.cnxT('js.s_ord.68388408','Xác nhận đơn khách đặt QR tại'):'Xác nhận đơn khách đặt QR tại'} ${tableCode} (${itemCount} ${window.cnxT?window.cnxT('js.s_ord.edde8397','món) và chuyển vào bếp?'):'món) và chuyển vào bếp?'}`))) return;

    try {
        const response = await fetch('api/orders.php?action=waiter_confirm_customer_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || (window.cnxT?window.cnxT('js.s_ord.8080160f','Không thể chuyển đơn QR vào bếp.'):'Không thể chuyển đơn QR vào bếp.'));
        }
        await loadTablesData();
        if (Number(activeOrderId) === Number(orderId)) {
            await loadExistingTableOrder(orderId);
        }
    } catch (error) {
        alert(error.message || (window.cnxT?window.cnxT('js.s_ord.8080160f','Không thể chuyển đơn QR vào bếp.'):'Không thể chuyển đơn QR vào bếp.'));
    }
}

function renderTables() {
    const container = document.getElementById('waiter-tables-grid');
    if (!container) return;

    const countAll = allTables.length;
    const countTQ = allTables.filter(t => t.area_type === 'TAI_QUAN').length;
    const countMV = allTables.filter(t => t.area_type === 'MANG_VE').length;

    document.getElementById('count-all-tables').innerText = countAll;
    document.getElementById('count-tq-tables').innerText = countTQ;
    document.getElementById('count-mv-tables').innerText = countMV;

    // Handle Kitchen Notifications
    const readyOrders = allTables.filter(t => t.kitchen_status === 'ready' && t.active_order_id);
    const alertBanner = document.getElementById('kitchen-alert-banner');
    const alertText = document.getElementById('kitchen-alert-text');
    const btnAlertServe = document.getElementById('btn-alert-serve');
    const navBellBtn = document.getElementById('nav-bell-btn');
    const navBellCount = document.getElementById('nav-bell-count');

    if (readyOrders.length > 0) {
        const firstReady = readyOrders[0];
        alertBanner.classList.remove('hidden');
        alertText.innerText = `${window.cnxT?window.cnxT('ui.admin_html.th_839747c8','Bàn'):'Bàn'} ${firstReady.code} (${firstReady.name}${window.cnxT?window.cnxT('js.s_ord.5aefe2af',') - Bếp đã xong món!'):') - Bếp đã xong món!'}`;
        btnAlertServe.onclick = () => confirmDelivered(firstReady.active_order_id, firstReady.code);

        navBellBtn.classList.remove('hidden');
        navBellCount.innerText = readyOrders.length;

        // Check for newly ready orders OR updated kitchen_ready_at (Bếp bấm "Báo Lại Chuông")
        let shouldChime = false;
        if (!window.knownReadyOrdersMap) {
            window.knownReadyOrdersMap = new Map();
        }
        const currentReadyMap = new Map();

        readyOrders.forEach(o => {
            const oId = o.active_order_id;
            const readyTime = String(o.kitchen_ready_at || 'ready');
            currentReadyMap.set(oId, readyTime);

            // If order wasn't previously ready OR its ready timestamp changed (Bếp bấm "Báo Lại Chuông")
            if (!window.knownReadyOrdersMap.has(oId) || window.knownReadyOrdersMap.get(oId) !== readyTime) {
                shouldChime = true;
            }
        });

        if (shouldChime && !isTablesFirstLoad) {
            playDingDong();
        }
        window.knownReadyOrdersMap = currentReadyMap;
    } else {
        alertBanner.classList.add('hidden');
        navBellBtn.classList.add('hidden');
        if (window.knownReadyOrdersMap) {
            window.knownReadyOrdersMap.clear();
        }
    }
    isTablesFirstLoad = false;

    let list = allTables;
    if (filteredArea !== 'all') {
        list = list.filter(t => t.area_type === filteredArea);
    }

    let html = '';
    list.forEach(t => {
        const isOcc = t.status === 'occupied';
        const kStatus = (t.kitchen_status || '').toLowerCase();
        const isReady = kStatus === 'ready';
        const isCustomerQrPending = Boolean(t.customer_order_pending);
        const isPaid = (t.payment_status === 'paid' || Boolean(t.paid_at));
        const isServed = (kStatus === 'served' || Boolean(t.served_at));
        const isInKitchen = isOcc && !isCustomerQrPending && !isReady && !isServed && !['awaiting_waiter', 'awaiting_payment', 'awaiting_kitchen_push', 'cancel_requested'].includes(kStatus);
        const elapsedMins = Number(t.kitchen_elapsed_minutes || 0);
        const kitchenSla = Number(t.kitchen_sla_minutes || 10);
        const isOverdueKitchen = isInKitchen && elapsedMins >= kitchenSla;
        const rushCount = Number(t.rush_count || 0);
        const yellowDotHtml = `
            <span class="relative flex h-2.5 w-2.5 shrink-0" title="Bếp đang chế biến (${elapsedMins} phút)">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-85"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
            </span>
        `;

        let cardBorderClass = 'border-emerald-500/30 hover:border-sky-400';
        if (isCustomerQrPending) {
            cardBorderClass = 'border-rose-400 bg-rose-950/40 shadow-xl shadow-rose-500/25 ring-2 ring-rose-400 animate-pulse';
        } else if (isReady) {
            cardBorderClass = 'border-amber-400 bg-amber-950/40 shadow-xl shadow-amber-500/20 ring-2 ring-amber-400 animate-pulse';
        } else if (isOverdueKitchen) {
            cardBorderClass = 'border-amber-500/70 bg-amber-950/20 shadow-lg shadow-amber-500/15';
        } else if (isOcc) {
            cardBorderClass = isPaid 
                ? 'border-teal-500/50 bg-teal-950/20 shadow-teal-900/20' 
                : 'border-rose-500/50 bg-rose-950/20 shadow-rose-900/20';
        }

        let badgeHtml = '';
        if (isCustomerQrPending) {
            badgeHtml = (window.cnxT?window.cnxT('js.s_ord.f09c7da6','<span class="px-2 py-0.5 rounded-full bg-rose-500 text-white font-black text-[10px] animate-pulse whitespace-nowrap shrink-0"><i class="fas fa-qrcode mr-1"></i>KHÁCH ĐẶT MÓN</span>'):'<span class="px-2 py-0.5 rounded-full bg-rose-500 text-white font-black text-[10px] animate-pulse whitespace-nowrap shrink-0"><i class="fas fa-qrcode mr-1"></i>KHÁCH ĐẶT MÓN</span>');
        } else if (isReady) {
            badgeHtml = (window.cnxT?window.cnxT('js.s_ord.58de3540','<span class="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] animate-bounce whitespace-nowrap shrink-0">🔔 XONG MÓN</span>'):'<span class="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] animate-bounce whitespace-nowrap shrink-0">🔔 XONG MÓN</span>');
        } else if (isOcc) {
            if (isPaid) {
                if (isServed) {
                    badgeHtml = (window.cnxT?window.cnxT('js.s_ord.7add883c','<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[9px] flex items-center gap-0.5">🍽️ Đã bưng</span>'):'<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[9px] flex items-center gap-0.5">🍽️ Đã bưng</span>');
                } else if (isInKitchen) {
                    badgeHtml = `<div class="flex items-center gap-1.5">${yellowDotHtml}<span class="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold text-[9px] flex items-center gap-0.5"><i class="fas fa-money-bill-wave text-[8px]"></i> ${window.cnxT?window.cnxT('js.s_ord.da1102a6','Đã TT'):'Đã TT'}</span></div>`;
                } else {
                    badgeHtml = (window.cnxT?window.cnxT('js.s_ord.f6dba09c','<span class="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold text-[9px] flex items-center gap-0.5"><i class="fas fa-money-bill-wave text-[8px]"></i> Đã TT</span>'):'<span class="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold text-[9px] flex items-center gap-0.5"><i class="fas fa-money-bill-wave text-[8px]"></i> Đã TT</span>');
                }
            } else {
                if (isServed) {
                    badgeHtml = (window.cnxT?window.cnxT('js.s_ord.b480e38d','<span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold text-[9px] flex items-center gap-0.5">🍽️ Đã bưng</span>'):'<span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold text-[9px] flex items-center gap-0.5">🍽️ Đã bưng</span>');
                } else if (isInKitchen) {
                    badgeHtml = yellowDotHtml;
                } else {
                    badgeHtml = '<span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>';
                }
            }
        } else {
            badgeHtml = '<span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>';
        }

        html += `
            <div class="liquid-glass-card p-3 flex flex-col justify-between cursor-pointer border ${cardBorderClass} rounded-xl min-h-[96px]" onclick="selectOrderTable(${t.id})">
                <div class="flex items-center justify-between">
                    <span class="font-black text-sm text-white">${escapeHtml(t.code)}</span>
                    ${badgeHtml}
                </div>
                <div class="text-[11px] text-slate-300 font-medium truncate">${escapeHtml(t.name)}</div>
                <div class="pt-1.5 border-t border-white/5 flex items-center justify-between text-xs font-bold font-mono">
                    ${isCustomerQrPending ? `
                        <span class="text-rose-200 font-black text-[10px] truncate">${formatMoney(t.total_amount)}đ · CHỜ XÁC NHẬN</span>
                        <button type="button" class="px-2 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white font-black text-[10px] shadow active:scale-90 flex items-center gap-1 shrink-0 animate-pulse" onclick="event.stopPropagation(); confirmCustomerQrOrder(${Number(t.active_order_id)})">
                            <i class="fas fa-fire"></i> ${window.cnxT?window.cnxT('js.s_ord.bae7f3c8','CHUYỂN BẾP'):'CHUYỂN BẾP'}
                        </button>
                    ` : isReady ? `
                        <span class="text-amber-300 font-bold text-[11px] truncate">${formatMoney(t.total_amount)}đ</span>
                        <button type="button" class="px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] shadow active:scale-90 flex items-center gap-1 shrink-0" onclick="event.stopPropagation(); confirmDelivered(${Number(t.active_order_id)}, '${escapeJsAttr(t.code)}')">
                            <i class="fas fa-check"></i> ${window.cnxT?window.cnxT('ui.order_html.button_ceb3900f','ĐÃ BƯNG RA'):'ĐÃ BƯNG RA'}
                        </button>
                    ` : isOverdueKitchen ? `
                        <span class="${isPaid ? 'text-teal-300' : 'text-amber-300'} truncate font-bold text-xs">
                            ${formatMoney(t.total_amount)}đ <span class="text-[10px] text-rose-400 font-black">(${elapsedMins}p)</span>
                        </span>
                        <button type="button" class="px-2 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white font-black text-[10px] shadow shadow-rose-500/40 active:scale-90 flex items-center gap-1 shrink-0 animate-pulse" onclick="event.stopPropagation(); rushKitchenOrder(${Number(t.active_order_id)}, '${escapeJsAttr(t.code)}', this)">
                            <i class="fas fa-fire"></i> ${rushCount > 0 ? `${window.cnxT?window.cnxT('js.s_ord.77c8da63','Hối ('):'Hối ('}${rushCount})` : (window.cnxT?window.cnxT('js.s_ord.ad20afa8','Hối'):'Hối')}
                        </button>
                    ` : `
                        <span class="${isOcc ? (isPaid ? 'text-teal-300' : 'text-amber-300') : 'text-emerald-400'} truncate font-bold text-xs">
                            ${isOcc ? formatMoney(t.total_amount) + 'đ' : (window.cnxT?window.cnxT('js.s_adm.cd79aac0','Trống'):'Trống')}
                        </span>
                        <span class="text-[10px] text-slate-400 font-normal shrink-0 ml-1">
                            ${isOcc ? (t.item_count + (window.cnxT?window.cnxT('js.s_ord.26b34a98',' món'):' món')) : (window.cnxT?window.cnxT('js.s_ord.bb734037','Vào bàn'):'Vào bàn')}
                        </span>
                    `}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 2. Select Table & Switch to Order View
async function selectOrderTable(tableId) {
    const found = allTables.find(t => t.id === tableId);
    if (!found) return;

    currentTable = found;
    document.getElementById('active-table-title').innerText = `${window.cnxT?window.cnxT('js.s_ord.29781093','BÀN:'):'BÀN:'} ${found.code} (${found.name})`;

    // If table has active order, load it
    if (found.status === 'occupied' && found.active_order_id) {
        document.getElementById('active-table-status').innerText = (window.cnxT?window.cnxT('js.s_ord.73abd860','Đang phục vụ (Bấm thực đơn để thêm món)'):'Đang phục vụ (Bấm thực đơn để thêm món)');
        await loadExistingTableOrder(found.active_order_id);
    } else {
        document.getElementById('active-table-status').innerText = (window.cnxT?window.cnxT('js.s_ord.479ba664','Bàn trống (Chọn món để mở bàn)'):'Bàn trống (Chọn món để mở bàn)');
        activeOrderId = null;
        activeOrderKitchenStatus = null;
        activeOrderStatus = null;
        existingConfirmedItems = [];
        newCartItems = [];
        guestCount = 1;
        document.getElementById('order-guest-count').innerText = '1';
        updateCartUI();
    }

    document.getElementById('view-tables').classList.add('hidden');
    document.getElementById('view-order').classList.remove('hidden');
    renderOrderCategories();
    renderOrderProducts();
}

function backToTablesView() {
    document.getElementById('view-order').classList.add('hidden');
    document.getElementById('view-tables').classList.remove('hidden');
    loadTablesData();
}

async function loadExistingTableOrder(orderId) {
    try {
        const res = await fetch(`api/orders.php?order_id=${orderId}`);
        const data = await res.json();
        if (data.success && data.order) {
            activeOrderId = data.order.id;
            activeOrderKitchenStatus = data.order.kitchen_status || (currentTable ? currentTable.kitchen_status : '');
            activeOrderStatus = data.order.status || '';
            guestCount = data.order.guest_count || 1;
            document.getElementById('order-guest-count').innerText = guestCount;
            // Existing items are confirmed & locked (không thể sửa hoặc xóa bởi phục vụ)
            existingConfirmedItems = (data.items || []).map(it => ({
                id: it.product_id,
                order_item_id: it.id,
                code: it.product_code,
                name: it.product_name,
                unit: it.unit,
                price: parseFloat(it.price),
                quantity: parseInt(it.quantity),
                note: it.note || '',
                toppings: it.toppings || [],
                is_confirmed: true
            }));
            newCartItems = []; // No new items yet
            updateCartUI();
        }
    } catch (e) {
        console.error(e);
    }
}

function adjustGuestCount(delta) {
    guestCount = Math.max(1, guestCount + delta);
    document.getElementById('order-guest-count').innerText = guestCount;
}

// 3. Products & Categories
async function loadCategoriesData() {
    try {
        const res = await fetch('api/categories.php');
        const data = await res.json();
        if (data.success) {
            categories = data.data;
        }
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }
}

async function loadProductsData() {
    try {
        const res = await fetch('api/products.php');
        const data = await res.json();
        if (data.success) {
            products = data.data;
            toppings = products.filter(p => p.is_topping == 1);
        }
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }
}

function renderOrderCategories() {
    const container = document.getElementById('order-categories-list');
    if (!container) return;

    let html = `
        <button type="button" class="px-3 py-1 rounded-full whitespace-nowrap font-bold text-xs ${selectedCategory === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300'}" onclick="setOrderCategory('all')">
            ${window.cnxT?window.cnxT('js.s_ord.f97f2c8d','Tất Cả'):'Tất Cả'}
        </button>
    `;

    categories.forEach(c => {
        const isAct = selectedCategory == c.id;
        const catName = typeof window.cnxDbText === 'function' ? window.cnxDbText(c, 'name', c.name) : c.name;
        html += `
            <button type="button" class="px-3 py-1 rounded-full whitespace-nowrap font-bold text-xs ${isAct ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300'}" onclick="setOrderCategory(${c.id})">
                ${escapeHtml(catName)}
            </button>
        `;
    });

    container.innerHTML = html;
}

function setOrderCategory(catId) {
    selectedCategory = catId;
    renderOrderCategories();
    renderOrderProducts();
}

function renderOrderProducts() {
    const container = document.getElementById('order-products-grid');
    const searchEl = document.getElementById('order-search');
    const search = (searchEl && searchEl.value ? searchEl.value : '').toLowerCase().trim();
    if (!container) return;

    let list = products;
    if (selectedCategory !== 'all') {
        list = list.filter(p => p.category_id == selectedCategory);
    }
    if (search) {
        list = list.filter(p => p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search)));
    }

    let html = '';
    list.forEach(p => {
        const isLocked = (p.status === 'locked');
        const imgUrl = p.image || 'assets/images/dishes/default_dish.jpg';
        const prodName = typeof window.cnxDbText === 'function' ? window.cnxDbText(p, 'name', p.name) : p.name;
        const prodUnit = typeof window.cnxDbText === 'function' ? window.cnxDbText(p, 'unit', p.unit || 'ly') : (p.unit || 'ly');
        html += `
            <div class="liquid-glass-card p-2 sm:p-2.5 flex flex-col justify-between transition-transform ${isLocked ? 'opacity-50 grayscale border-rose-500/40 bg-rose-950/20 cursor-not-allowed' : 'cursor-pointer border border-white/10 active:scale-95 hover:border-sky-400/40'}" onclick="${isLocked ? `alert('Món [${prodName.replace(/'/g, "\\'")}] hiện đang TẠM KHÓA do hết hàng!')` : `addItemToCart(${p.id})`}">
                <div>
                    <!-- Dish Thumbnail Image: 4:3 Aspect Ratio for Full View -->
                    <div class="relative w-full aspect-[4/3] mb-1.5 rounded-xl overflow-hidden bg-slate-950 border border-white/10 flex items-center justify-center">
                        <img src="${imgUrl}" alt="${escapeHtml(prodName)}" class="w-full h-full object-cover object-center" onerror="this.onerror=null;this.src='assets/images/dishes/default_dish.jpg';" loading="lazy" />
                        <div class="absolute top-1.5 left-1.5 pointer-events-none">
                            <span class="text-[9px] font-mono font-bold text-sky-400 bg-slate-950/85 backdrop-blur-md px-1.5 py-0.5 rounded border border-sky-500/30">${p.code || 'SP'}</span>
                        </div>
                        <div class="absolute top-1.5 right-1.5 pointer-events-none">
                            ${isLocked ? '<span class="text-[8px] font-bold text-rose-300 bg-rose-950/90 px-1 rounded border border-rose-500/40">🚫 HẾT</span>' : `<span class="text-[9px] text-slate-300 bg-slate-950/85 backdrop-blur-md px-1 rounded border border-white/10 capitalize">${escapeHtml(prodUnit)}</span>`}
                        </div>
                    </div>
                    <h4 class="font-bold text-xs ${isLocked ? 'text-slate-400 line-through' : 'text-white'} line-clamp-2 leading-snug min-h-[2rem]">${escapeHtml(prodName)}</h4>
                </div>
                <div class="mt-1.5 pt-1 border-t border-white/5 flex items-center justify-between">
                    <span class="font-black text-xs text-amber-400 font-mono">${formatMoney(p.sale_price)} đ</span>
                    <span class="w-6 h-6 rounded-lg ${isLocked ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/20 text-sky-300'} flex items-center justify-center text-xs">
                        <i class="fas ${isLocked ? 'fa-ban' : 'fa-plus'}"></i>
                    </span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 4. Cart Operations
function addItemToCart(prodId) {
    const p = products.find(i => i.id === prodId);
    if (!p) return;
    if (p.status === 'locked') {
        alert(`Món "${p.name}" hiện đang TẠM KHÓA (Hết hàng) bởi bếp!`);
        return;
    }

    // Only add into newCartItems (never mutate already confirmed items)
    const existing = newCartItems.find(it => it.id === p.id && !it.note && (!it.toppings || it.toppings.length === 0));
    if (existing) {
        existing.quantity += 1;
    } else {
        newCartItems.push({
            id: p.id,
            code: p.code,
            name: p.name,
            unit: p.unit,
            price: parseFloat(p.sale_price),
            quantity: 1,
            note: '',
            toppings: []
        });
    }

    updateCartUI();
}

function updateCartUI() {
    const confirmedQty = existingConfirmedItems.reduce((sum, it) => sum + it.quantity, 0);
    const newQty = newCartItems.reduce((sum, it) => sum + it.quantity, 0);
    const totalQty = confirmedQty + newQty;

    const confirmedMoney = existingConfirmedItems.reduce((sum, it) => {
        const topSum = (it.toppings || []).reduce((a, b) => a + (parseFloat(b.price) || 0), 0);
        return sum + ((it.price + topSum) * it.quantity);
    }, 0);

    const newMoney = newCartItems.reduce((sum, it) => {
        const topSum = (it.toppings || []).reduce((a, b) => a + (parseFloat(b.price) || 0), 0);
        return sum + ((it.price + topSum) * it.quantity);
    }, 0);

    const totalMoney = confirmedMoney + newMoney;

    // Badge count & totals
    document.getElementById('cart-badge-count').innerText = totalQty;
    document.getElementById('cart-bottom-total').innerText = formatMoney(totalMoney) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
    document.getElementById('cart-sheet-total').innerText = formatMoney(totalMoney) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
    const sheetQtyEl = document.getElementById('cart-sheet-total-qty');
    if (sheetQtyEl) sheetQtyEl.innerText = totalQty;

    // Status text in bottom bar
    const statusEl = document.getElementById('cart-items-status-text');
    if (statusEl) {
        if (newQty > 0) {
            statusEl.innerText = `${window.cnxT?window.cnxT('js.s_cust.963a532e','Đang chọn thêm +'):'Đang chọn thêm +'}${newQty} ${window.cnxT?window.cnxT('js.s_cust.2600ef09','món mới'):'món mới'}`;
            statusEl.className = 'text-[10px] text-amber-300 font-bold font-mono';
        } else if (confirmedQty > 0) {
            statusEl.innerText = `${window.cnxT?window.cnxT('js.s_ord.6829e07e','Đã có'):'Đã có'} ${confirmedQty} ${window.cnxT?window.cnxT('js.s_ord.25b203ef','món (chưa thêm món)'):'món (chưa thêm món)'}`;
            statusEl.className = 'text-[10px] text-slate-400 font-mono';
        } else {
            statusEl.innerText = (window.cnxT?window.cnxT('js.s_cust.708d6946','Chưa chọn món nào'):'Chưa chọn món nào');
            statusEl.className = 'text-[10px] text-slate-500 font-mono';
        }
    }

    // Button "Gửi Bếp": KHÔNG HIỂN THỊ KHI KHÔNG "THÊM MÓN"
    const btnFloat = document.getElementById('btn-float-send-kitchen');
    const txtFloat = document.getElementById('btn-float-send-text');
    const btnSheet = document.getElementById('btn-sheet-submit');
    const txtSheet = document.getElementById('btn-sheet-submit-text');

    if (newCartItems.length === 0) {
        // Hide submit button when no new dishes are being added
        if (btnFloat) btnFloat.classList.add('hidden');
        if (btnSheet) btnSheet.classList.add('hidden');
    } else {
        // Show submit button with count of new items
        if (btnFloat) {
            btnFloat.classList.remove('hidden');
            if (txtFloat) txtFloat.innerText = `${window.cnxT?window.cnxT('js.s_ord.1cd8b373','Gửi Bếp (+'):'Gửi Bếp (+'}${newQty})`;
        }
        if (btnSheet) {
            btnSheet.classList.remove('hidden');
            if (txtSheet) txtSheet.innerText = (window.cnxT?window.cnxT('ui.sa_html.span_580fef1a','Xác Nhận'):'Xác Nhận');
        }
    }

    renderCartSheetItems();
}

function renderCartSheetItems() {
    const container = document.getElementById('cart-sheet-items');
    if (!container) return;

    if (existingConfirmedItems.length === 0 && newCartItems.length === 0) {
        container.innerHTML = (window.cnxT?window.cnxT('js.s_ord.6e375fc5','<div class="text-xs text-slate-500 py-8 text-center">Bàn chưa có món nào. Chạm món trên thực đơn để gọi món!</div>'):'<div class="text-xs text-slate-500 py-8 text-center">Bàn chưa có món nào. Chạm món trên thực đơn để gọi món!</div>');
        return;
    }

    let html = '';

    // SECTION 1: Các món đã xác nhận trước đó (MỜ, KHÔNG THỂ SỬA BỞI PHỤC VỤ)
    if (existingConfirmedItems.length > 0) {
        const confirmedTotalQty = existingConfirmedItems.reduce((sum, it) => sum + it.quantity, 0);
        const isAlreadyServed = (activeOrderKitchenStatus === 'served' || activeOrderStatus === 'completed' || (currentTable && currentTable.kitchen_status === 'served'));
        const isCustomerQrPending = activeOrderKitchenStatus === 'awaiting_waiter';

        html += `
            <div class="space-y-2">
                <div class="flex items-center justify-between pb-1 text-xs border-b border-white/5 font-bold">
                    <span class="text-slate-300 flex items-center gap-1.5">
                        <i class="fas ${isCustomerQrPending ? 'fa-qrcode text-rose-300' : (isAlreadyServed ? 'fa-check-circle text-emerald-400' : 'fa-clock-rotate-left text-sky-400')}"></i>
                        ${isCustomerQrPending ? 'Khách đặt qua QR' : (window.cnxT?window.cnxT('js.s_ord.a2db9a35','Món Đã Xác Nhận & Gửi Bếp'):'Món Đã Xác Nhận & Gửi Bếp')} (${existingConfirmedItems.length} ${window.cnxT?window.cnxT('js.s_ord.a95f98dc','món • SL:'):'món • SL:'} ${confirmedTotalQty})
                    </span>
                    <span class="text-[10px] px-2 py-0.5 rounded ${isCustomerQrPending ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40 animate-pulse' : (isAlreadyServed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25')} font-bold">
                        ${isCustomerQrPending ? 'Chờ phục vụ xác nhận' : (isAlreadyServed ? '✅ Đã bưng ra bàn' : (window.cnxT?window.cnxT('js.s_ord.1811bdb6','🔒 Đã khóa (Không sửa)'):'🔒 Đã khóa (Không sửa)'))}
                    </span>
                </div>
        `;

        existingConfirmedItems.forEach((it, idx) => {
            const topSum = (it.toppings || []).reduce((a, b) => a + (parseFloat(b.price) || 0), 0);
            const sub = (it.price + topSum) * it.quantity;
            const noteStr = (it.note || '').trim();
            const cancelSt = (it.cancel_status || 'none');
            const isCancelled = (cancelSt === 'approved' || cancelSt === 'out_of_stock');
            const isRejected = (cancelSt === 'rejected') || noteStr.includes('Đã làm') || noteStr.includes('Đã chế biến') || noteStr.includes('Giữ nguyên món');
            const isCancelNote = (cancelSt === 'pending_kitchen') || (cancelSt === 'none' && !isRejected && /hủy|huy/i.test(noteStr));
            const cancelRsn = (it.cancel_reason || noteStr || '').trim();

            html += `
                <div class="p-2.5 rounded-xl ${isCancelled ? 'bg-slate-950/70 border border-rose-500/20 opacity-60' : (isCancelNote ? 'bg-amber-950/20 border border-amber-500/40' : (isRejected ? 'bg-rose-950/15 border border-rose-500/30' : 'bg-slate-900/60 border border-white/5 opacity-80'))} flex items-center justify-between transition-all">
                    <div class="space-y-0.5 flex-1 pr-2">
                        <div class="flex items-center gap-2">
                            <span class="text-slate-400 font-mono text-[11px]">#${idx + 1}</span>
                            <h5 class="font-bold text-xs ${isCancelled ? 'line-through text-slate-400' : 'text-slate-200'}">${it.name}</h5>
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono">
                            ${formatMoney(it.price + topSum)} ${window.cnxT?window.cnxT('js.s_ord.a951693c','đ /'):'đ /'} ${it.unit || (window.cnxT?window.cnxT('js.s_adm.3a9dfd9c','phần'):'phần')}
                            ${isCancelled ? `<span class="ml-2 text-[10px] text-rose-300 font-bold bg-rose-950/70 border border-rose-500/40 px-1.5 py-0.5 rounded">${cancelSt === 'out_of_stock' ? '🚫 Bếp báo HẾT' : (window.cnxT?window.cnxT('js.s_ord.635a0f8a','✖ Đã hủy'):'✖ Đã hủy')}${cancelRsn ? ' (' + cancelRsn + ')' : ''}</span>` : (
                                isCancelNote
                                    ? `<span class="ml-2 text-[10px] text-amber-300 font-bold bg-amber-950/70 border border-amber-500/40 px-1.5 py-0.5 rounded">⏳ Chờ Bếp duyệt hủy${cancelRsn ? ' (' + cancelRsn + ')' : ''}</span>`
                                    : (isRejected
                                        ? `<span class="ml-2 text-[10px] text-rose-300 font-bold bg-rose-950/70 border border-rose-500/40 px-1.5 py-0.5 rounded">🔒 ${cancelRsn || (window.cnxT?window.cnxT('js.s_ord.944a058f','Bếp đã làm - Không hủy'):'Bếp đã làm - Không hủy')}</span>`
                                        : (it.note ? `<span class="ml-2 text-[10px] text-amber-300 italic">(${it.note})</span>` : ''))
                            )}
                        </div>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                        ${(!isAlreadyServed && !isCancelled && !isCancelNote) ? `
                            <button type="button" class="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 active:scale-90 flex items-center gap-1 cursor-pointer" onclick="event.stopPropagation(); addNoteToConfirmedItem(${it.order_item_id || it.id})" title="Bổ sung ghi chú gửi bếp">
                                <i class="fas fa-comment-dots text-[10px]"></i>
                                <span>${it.note ? 'Sửa GC' : (window.cnxT?window.cnxT('ui.admin_html.ph_ad504eea','Ghi chú'):'Ghi chú')}</span>
                            </button>
                            <button type="button" class="text-xs px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 active:scale-90 flex items-center gap-1 cursor-pointer" onclick="event.stopPropagation(); requestCancelConfirmedItem(${it.order_item_id || it.id})" title="Báo bếp xin hủy món">
                                <i class="fas fa-ban text-[10px]"></i>
                                <span>${window.cnxT?window.cnxT('js.s_ord.8d09036c','Báo Hủy'):'Báo Hủy'}</span>
                            </button>
                        ` : ''}
                        <span class="px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono font-bold text-xs">
                            x${it.quantity}
                        </span>
                        <span class="font-mono font-bold text-xs text-slate-300 min-w-[65px] text-right">
                            ${formatMoney(sub)} đ
                        </span>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    }

    if (activeOrderKitchenStatus === 'awaiting_waiter' && activeOrderId && currentTable) {
        html += `
            <div class="rounded-xl border border-rose-400/40 bg-rose-950/30 p-3 shadow-[0_0_20px_rgba(244,63,94,.12)]">
                <p class="mb-2 text-[11px] font-semibold text-rose-100">${window.cnxT?window.cnxT('js.s_ord.2aeeebf2','Kiểm tra món khách đã chọn. Chỉ chuyển bếp sau khi xác nhận lại với khách.'):'Kiểm tra món khách đã chọn. Chỉ chuyển bếp sau khi xác nhận lại với khách.'}</p>
                <button type="button" class="w-full rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-3 py-2.5 text-xs font-black text-white shadow-lg shadow-rose-900/30 active:scale-[.98]" onclick="confirmCustomerQrOrder(${Number(activeOrderId)})">
                    <i class="fas fa-check mr-1"></i> ${window.cnxT?window.cnxT('js.s_ord.05614eed','XÁC NHẬN'):'XÁC NHẬN'}
                </button>
            </div>
        `;
    }

    // SECTION 2: Các món mới gọi thêm trong lượt này (SÁNG, CÓ THỂ SỬA / XÓA)
    if (newCartItems.length > 0) {
        html += `
            <div class="space-y-2 pt-2">
                <div class="flex items-center justify-between pb-1 text-xs border-b border-amber-500/30 font-bold">
                    <span class="text-amber-300 flex items-center gap-1.5">
                        <i class="fas fa-sparkles text-amber-400"></i>
                        Món Mới Gọi Thêm (${newCartItems.length} món)
                    </span>
                    <span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold animate-pulse">
                        ${window.cnxT?window.cnxT('js.s_ord.a7973245','✨ Chờ gửi bếp'):'✨ Chờ gửi bếp'}
                    </span>
                </div>
        `;

        newCartItems.forEach((it, idx) => {
            const topSum = (it.toppings || []).reduce((a, b) => a + (parseFloat(b.price) || 0), 0);
            const sub = (it.price + topSum) * it.quantity;

            html += `
                <div class="p-2.5 rounded-xl bg-slate-900 border border-amber-500/40 space-y-1.5 shadow-lg shadow-amber-500/5">
                    <div class="flex justify-between items-start gap-2">
                        <div>
                            <h5 class="font-bold text-xs text-white">${it.name}</h5>
                            <span class="text-[11px] text-amber-400 font-mono font-bold">${formatMoney(it.price + topSum)} đ</span>
                            ${it.note ? `<div class="text-[10px] text-rose-300 italic">Ghi chú: ${it.note}</div>` : ''}
                        </div>
                        <span class="font-mono font-black text-xs text-emerald-400">${formatMoney(sub)} đ</span>
                    </div>

                    <div class="flex items-center justify-between pt-1 border-t border-white/5">
                        <div class="flex items-center gap-1.5">
                            <button type="button" class="w-6 h-6 rounded bg-slate-800 text-xs active:scale-90" onclick="changeQty(${idx}, -1)">-</button>
                            <span class="w-6 text-center font-bold text-xs font-mono text-sky-400">${it.quantity}</span>
                            <button type="button" class="w-6 h-6 rounded bg-slate-800 text-xs active:scale-90" onclick="changeQty(${idx}, 1)">+</button>
                        </div>

                        <div class="flex items-center gap-1.5">
                            <button type="button" class="text-xs px-2 py-1 rounded bg-slate-800 text-amber-300" onclick="addNoteToItem(${idx})">
                                <i class="fas fa-pen text-[10px]"></i> ${window.cnxT?window.cnxT('ui.admin_html.ph_ad504eea','Ghi chú'):'Ghi chú'}
                            </button>
                            <button type="button" class="text-xs px-2 py-1 rounded bg-rose-500/20 text-rose-300 active:scale-90" onclick="deleteCartItem(${idx})">
                                <i class="fas fa-trash text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    }

    container.innerHTML = html;
}

function changeQty(idx, delta) {
    if (!newCartItems[idx]) return;
    newCartItems[idx].quantity += delta;
    if (newCartItems[idx].quantity <= 0) {
        newCartItems.splice(idx, 1);
    }
    updateCartUI();
}

function deleteCartItem(idx) {
    newCartItems.splice(idx, 1);
    updateCartUI();
}

async function addNoteToItem(idx) {
    const it = newCartItems[idx];
    if (!it) return;
    const note = await window.cnxPrompt(`Nhập ghi chú cho "${it.name}" (ví dụ: ít ngọt, nhiều đá, không hành):`, it.note || '');
    if (note !== null) {
        it.note = note.trim();
        updateCartUI();
    }
}

async function addNoteToConfirmedItem(orderItemId) {
    const item = existingConfirmedItems.find(it => (it.order_item_id === orderItemId || it.id === orderItemId));
    if (!item) return;

    const currentNote = item.note || '';
    const newNote = await window.cnxPrompt(`Bổ sung / cập nhật ghi chú cho "${item.name}" gửi bếp:\n(Ví dụ: không cay, ít ngọt, nhiều đá, làm nhanh... hoặc ghi 'Hủy' nếu khách muốn hủy món)`, currentNote);
    if (newNote === null) return;

    try {
        const res = await fetch('api/orders.php?action=update_item_note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                item_id: item.order_item_id || item.id,
                note: newNote.trim()
            })
        });
        const data = await res.json();
        if (data.success) {
            item.note = newNote.trim();
            renderCartSheetItems();
            alert(`✅ Đã gửi ghi chú mới cho "${item.name}" đến bếp!`);
        } else {
            alert(data.message || (window.cnxT?window.cnxT('js.s_ord.e057b57b','Lỗi khi cập nhật ghi chú'):'Lỗi khi cập nhật ghi chú'));
        }
    } catch(e) {
        console.error(e);
        alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
    }
}

async function ackWaiterAlert(alertId) {
    try {
        await fetch('api/orders.php?action=ack_alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alert_id: alertId })
        });
        pollNotifications();
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }
}

let _waiterCancelTargetItemId = null;
function requestCancelConfirmedItem(orderItemId) {
    const item = existingConfirmedItems.find(it => (it.order_item_id === orderItemId || it.id === orderItemId));
    if (!item) return;
    _waiterCancelTargetItemId = item.order_item_id || item.id;
    const modal = document.getElementById('waiter-cancel-item-modal');
    const nameEl = document.getElementById('wcim-item-name');
    const inp = document.getElementById('wcim-reason');
    if (nameEl) nameEl.textContent = item.name || (window.cnxT?window.cnxT('js.s_ord.6b1beced','Món này'):'Món này');
    if (inp) inp.value = (window.cnxT?window.cnxT('ui.order_html.button_b31ed4b8','Khách đổi ý'):'Khách đổi ý');
    if (modal) modal.classList.remove('hidden');
}

function closeWaiterCancelModal() {
    document.getElementById('waiter-cancel-item-modal')?.classList.add('hidden');
    _waiterCancelTargetItemId = null;
}

async function submitWaiterCancelModal() {
    if (!_waiterCancelTargetItemId) return;
    const reason = (document.getElementById('wcim-reason')?.value || '').trim() || (window.cnxT?window.cnxT('js.s_kds.f4b768d2','Khách xin hủy'):'Khách xin hủy');
    try {
        const res = await fetch('api/orders.php?action=request_cancel_item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: _waiterCancelTargetItemId, reason })
        });
        const data = await res.json();
        if (data.success) {
            const it = existingConfirmedItems.find(x => (x.order_item_id === _waiterCancelTargetItemId || x.id === _waiterCancelTargetItemId));
            if (it) {
                it.cancel_status = 'pending_kitchen';
                it.cancel_reason = reason;
            }
            closeWaiterCancelModal();
            renderCartSheetItems();
            pollNotifications();
        } else {
            alert(data.message || (window.cnxT?window.cnxT('js.s_ord.1f85bccd','Lỗi khi gửi yêu cầu hủy'):'Lỗi khi gửi yêu cầu hủy'));
        }
    } catch (e) {
        alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
    }
}

function openCartBottomSheet() {
    document.getElementById('cart-sheet-overlay').classList.add('open');
    document.querySelector('.bottom-sheet').classList.add('open');
}

function closeCartBottomSheet() {
    document.getElementById('cart-sheet-overlay').classList.remove('open');
    document.querySelector('.bottom-sheet').classList.remove('open');
}

// 5. Send Order to Kitchen (Báo bếp / Lưu bàn)
async function sendOrderToKitchen() {
    if (!currentTable) return;
    if (newCartItems.length === 0) {
        alert((window.cnxT?window.cnxT('js.s_ord.25d82c4a','Vui lòng chọn thêm ít nhất 1 món mới trên thực đơn để gửi bếp!'):'Vui lòng chọn thêm ít nhất 1 món mới trên thực đơn để gửi bếp!'));
        return;
    }

    const isAppending = existingConfirmedItems.length > 0 && activeOrderId;

    const payload = {
        table_id: currentTable.id,
        table_code: currentTable.code,
        customer_name: (window.cnxT?window.cnxT('js.s_cust.3bfc4cc6','Khách tại bàn'):'Khách tại bàn'),
        guest_count: guestCount,
        append: isAppending,
        items: newCartItems,
        note: ''
    };

    try {
        const res = await fetch('api/orders.php?action=save_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            const msg = isAppending
                ? `${window.cnxT?window.cnxT('js.s_ord.db32cc63','✅ Đã gửi thêm'):'✅ Đã gửi thêm'} ${newCartItems.length} ${window.cnxT?window.cnxT('js.s_ord.75ed4db3','món mới cho bếp thành công!\\nHóa đơn bàn'):'món mới cho bếp thành công!\\nHóa đơn bàn'} ${currentTable.code} ${window.cnxT?window.cnxT('js.s_ord.ddc568b6','đã được cộng dồn.'):'đã được cộng dồn.'}`
                : `${window.cnxT?window.cnxT('js.s_ord.3508bca5','✅ Đã gửi order thành công cho'):'✅ Đã gửi order thành công cho'} ${currentTable.code}${window.cnxT?window.cnxT('js.s_ord.3f06656f','! Đơn hàng đã được tạo và chuyển đến bếp.'):'! Đơn hàng đã được tạo và chuyển đến bếp.'}`;
            alert(msg);
            closeCartBottomSheet();
            backToTablesView();
        } else {
            alert(data.message || (window.cnxT?window.cnxT('js.s_ord.d86c0725','Lỗi khi gửi order'):'Lỗi khi gửi order'));
        }
    } catch (e) {
        alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
    }
}

// 6. VietQR Popup Functions
async function showWaiterVietQr() {
    if (!currentTable) return;
    const confirmedMoney = existingConfirmedItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
    const newMoney = newCartItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
    const totalMoney = confirmedMoney + newMoney;

    if (totalMoney <= 0) {
        alert((window.cnxT?window.cnxT('js.s_ord.7241a7d0','Bàn này chưa có món nào để tạo mã VietQR!'):'Bàn này chưa có món nào để tạo mã VietQR!'));
        return;
    }

    try {
        let url = `api/orders.php?action=vietqr&table_id=${currentTable.id}&amount=${totalMoney}&order_code=${currentTable.code}`;
        if (activeOrderId) url += `&order_id=${activeOrderId}`;

        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
            document.getElementById('vqr-image').src = data.vietqr_url;
            document.getElementById('vqr-amount').innerText = formatMoney(data.amount) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
            document.getElementById('vqr-table-code').innerText = `${window.cnxT?window.cnxT('ui.pos_html.div_1c36b836','Bàn:'):'Bàn:'} ${currentTable.code} - ${currentTable.name}`;
            document.getElementById('vqr-note').innerText = data.note;
            if (document.getElementById('vqr-acc-no')) document.getElementById('vqr-acc-no').innerText = data.account_no;
            if (document.getElementById('vqr-acc-name')) document.getElementById('vqr-acc-name').innerText = data.account_name;
            if (document.getElementById('vqr-bank')) document.getElementById('vqr-bank').innerText = data.bank_id;

            document.getElementById('waiter-vietqr-modal').classList.add('open');
        } else {
            alert(data.message || (window.cnxT?window.cnxT('js.s_ord.524a0080','Không thể tạo mã VietQR'):'Không thể tạo mã VietQR'));
        }
    } catch(e) {
        console.error(e);
        alert((window.cnxT?window.cnxT('js.s_ord.ab4fca8b','Lỗi kết nối khi tải mã VietQR'):'Lỗi kết nối khi tải mã VietQR'));
    }
}

function closeWaiterVietQr() {
    const modal = document.getElementById('waiter-vietqr-modal');
    if (modal) modal.classList.remove('open');
}

let orderCustomerQrInstance = null;
function getCustomerMenuUrl() {
    var cached = window.CN_SERVER_LAN_BASE_URL || '';
    var hostname = window.location.hostname;
    var isLocalhost = (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1');
    if (!isLocalhost && hostname) {
        var origin = window.location.protocol + '//' + window.location.host;
        var path = window.location.pathname;
        var dir = path.substring(0, path.lastIndexOf('/'));
        return origin + (dir ? dir + '/' : '/') + 'customer.html';
    }
    if (cached) {
        return (cached.endsWith('/') ? cached : (cached + '/')) + 'customer.html';
    }
    var origin = window.location.protocol + '//' + window.location.host;
    var path = window.location.pathname;
    var dir = path.substring(0, path.lastIndexOf('/'));
    return origin + (dir ? dir + '/' : '/') + 'customer.html';
}

function renderOrderCustomerQr(url) {
    var urlEl = document.getElementById('order-customer-url-text');
    var linkEl = document.getElementById('order-customer-direct-link');
    var canvasContainer = document.getElementById('order-customer-qr-canvas');

    if (urlEl) urlEl.textContent = url;
    if (linkEl) linkEl.href = url;

    if (canvasContainer && typeof QRCode !== 'undefined') {
        canvasContainer.innerHTML = '';
        try {
            orderCustomerQrInstance = new QRCode(canvasContainer, {
                text: url,
                width: 190,
                height: 190,
                colorDark: "#0b0f19",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch(e) {
            console.error("Lỗi vẽ QR code:", e);
            canvasContainer.innerHTML = (window.cnxT?window.cnxT('js.s_kds.ef9ce55d','<span class="text-rose-400 text-xs p-4">Không thể tạo mã QR</span>'):'<span class="text-rose-400 text-xs p-4">Không thể tạo mã QR</span>');
        }
    }
}

async function showLanQrModal() {
    var modal = document.getElementById('lan-qr-modal');
    var initialUrl = getCustomerMenuUrl();
    renderOrderCustomerQr(initialUrl);
    if (modal) modal.classList.add('open');

    // Asynchronously fetch latest configured server IP/port from settings
    try {
        var res = await fetch('api/settings.php');
        var json = await res.json();
        if (json.success && json.data) {
            var ip = json.data.server_ip || json.data.primary_lan_ip;
            var port = json.data.server_port || window.location.port || '8501';
            if (ip) {
                var base = 'http://' + ip + ':' + port + '/';
                window.CN_SERVER_LAN_BASE_URL = base;
                var freshUrl = base + 'customer.html';
                if (freshUrl !== initialUrl) {
                    renderOrderCustomerQr(freshUrl);
                }
            }
        }
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }
}

function closeLanQrModal() {
    document.getElementById('lan-qr-modal').classList.remove('open');
}

function copyCustomerUrl() {
    var url = getCustomerMenuUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function() {
            alert((window.cnxT?window.cnxT('js.s_kds.361bd0c8','Đã sao chép đường link gọi món:\n'):'Đã sao chép đường link gọi món:\n') + url);
        });
    } else {
        var t = document.createElement('textarea');
        t.value = url;
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
        alert((window.cnxT?window.cnxT('js.s_kds.361bd0c8','Đã sao chép đường link gọi món:\n'):'Đã sao chép đường link gọi món:\n') + url);
    }
}

async function handleLogout() {
    if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_ord.d37f34d1','Đăng xuất khỏi tài khoản phục vụ?'):'Đăng xuất khỏi tài khoản phục vụ?')))) return;
    try {
        await fetch('api/auth.php?action=logout');
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('order_waiter.js', e) : console.debug('order_waiter.js', e)); }
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
    document.cookie = "pos_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.replace('login.html?logout=1');
}

function renderOrderAdminBadge() {
    const zone = document.getElementById('order-admin-badge-zone');
    const backZone = document.getElementById('order-nav-back-zone');
    const u = window.currentUser;
    const tr = (k, fb) => (typeof window.cnxT === 'function' ? window.cnxT(k, fb) : fb);
    if (!u) {
        if (zone) zone.innerHTML = '';
        if (backZone) backZone.innerHTML = '';
        return;
    }
    const isAdmin = (u.role === 'admin' || u.is_super_admin === true);
    const isCashier = (u.role === 'cashier');
    const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    if (backZone) {
        if (isAdmin) {
            const adminBack = `<a href="admin.html" class="btn-glass cn-nav-btn bg-amber-500/20 hover:bg-amber-500/35 border-amber-400/40 text-amber-200"><i class="fas fa-arrow-left text-[10px]"></i><span>${tr('common.back_admin', 'Quản Trị')}</span></a>`;
            const posLink = `<a href="index.html" class="btn-glass cn-nav-btn bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/40 text-sky-200"><i class="fas fa-cash-register text-xs"></i><span>POS</span></a>`;
            backZone.innerHTML = `${adminBack}${posLink}<span class="cn-nav-divider"></span>`;
        } else if (isCashier) {
            const posBack = `<a href="index.html" class="btn-glass cn-nav-btn bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/40 text-sky-200"><i class="fas fa-arrow-left text-[10px]"></i><span>${tr('common.back_pos', 'Quay lại POS')}</span></a>`;
            backZone.innerHTML = `${posBack}<span class="cn-nav-divider"></span>`;
        } else {
            backZone.innerHTML = '';
        }
    }
    if (zone) {
        const roleLabel = isAdmin ? tr('nav.role_admin', 'ADMIN') : (isCashier ? tr('nav.role_cashier', 'THU NGÂN') : tr('nav.role_waiter', 'PHỤC VỤ'));
        const badgeCls = isAdmin ? 'bg-amber-500/20 text-amber-300 border-amber-400/40' : 'bg-sky-500/20 text-sky-300 border-sky-400/40';
        const rawName = u.fullname || u.username || '';
        const prettyName = (isAdmin && /Quản Trị Viên/i.test(rawName)) ? tr('nav.owner_name', 'Chủ quán') : rawName;
        const disp = esc(prettyName);
        zone.innerHTML = `<div class="cn-user-pill ${isAdmin ? 'bg-slate-800/90 border border-amber-500/40 text-amber-200' : 'bg-slate-800/80 border border-white/10 text-slate-200'}"><i class="fas ${isAdmin ? 'fa-crown text-amber-400' : 'fa-user-tag text-sky-400'} text-xs"></i><span class="cn-user-name">${disp}</span><span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-black ${badgeCls} border">${roleLabel}</span></div>`;
    }
}
window.addEventListener('cybernexus:langchange', renderOrderAdminBadge);
window.addEventListener('cnx:lang-changed', renderOrderAdminBadge);
window.addEventListener('cnx:i18n-ready', renderOrderAdminBadge);

document.addEventListener('DOMContentLoaded', () => {
    renderOrderAdminBadge();
    try {
        init();
        // Định kỳ gửi heartbeat giữ trạng thái trực tuyến cho nhân viên phục vụ (with inFlight guard)
        let _hbInFlight = false;
        async function sendOrderHeartbeat() {
            if (_hbInFlight) return;
            _hbInFlight = true;
            try {
                await fetch('api/auth.php?action=heartbeat');
            } catch (hbErr) {
                if (window.CyberSecurity) CyberSecurity.logSilentError('orderHeartbeat', hbErr);
            } finally {
                _hbInFlight = false;
            }
        }
        setInterval(sendOrderHeartbeat, 30000);
        window.addEventListener('online', sendOrderHeartbeat);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') sendOrderHeartbeat();
        });
        window.addEventListener('focus', sendOrderHeartbeat);
    } catch (err) {
        console.error('Init error:', err);
    }

    try {
        updateSoundToggleButton();
    } catch (err) {
        console.error('Sound toggle update error:', err);
    }

    // Tự động kiểm tra trạng thái bếp & cập nhật bàn mỗi 3.5 giây liên tục (with inFlight guard)
    let _tablesPollInFlight = false;
    setInterval(async () => {
        if (document.hidden || _tablesPollInFlight) return;
        _tablesPollInFlight = true;
        try {
            await loadTablesData();
        } catch (pollErr) {
            console.error('Polling error:', pollErr);
        } finally {
            _tablesPollInFlight = false;
        }
    }, 3500);
});
