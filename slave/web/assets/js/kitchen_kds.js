let user = null;
try { user = JSON.parse(localStorage.getItem('pos_user') || 'null'); } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('kitchen_kds.js', e) : console.debug('kitchen_kds.js', e)); }
if (!user) {
    alert((window.cnxT?window.cnxT('js.s_kds.93327b4a','Vui lòng đăng nhập để sử dụng màn hình Bếp & Pha Chế!'):'Vui lòng đăng nhập để sử dụng màn hình Bếp & Pha Chế!'));
    window.location.replace('index.html?need_login=kitchen');
}
let currentFilter = 'active'; // 'active', 'served', 'all'
let soundEnabled = localStorage.getItem('kds_sound') !== '0';
let knownOrderIds = new Set();
let isFirstLoad = true;

function updateSoundUI() {
    const icon = document.getElementById('sound-icon');
    const btn = document.getElementById('btn-sound-toggle');
    if (soundEnabled) {
        icon.className = 'fas fa-volume-up text-amber-300';
        btn.title = (window.cnxT?window.cnxT('js.s_kds.b5677377','Chuông báo: BẬT (Bấm để tắt)'):'Chuông báo: BẬT (Bấm để tắt)');
    } else {
        icon.className = 'fas fa-volume-mute text-slate-400';
        btn.title = (window.cnxT?window.cnxT('js.s_kds.6b9f35c7','Chuông báo: TẮT (Bấm để bật)'):'Chuông báo: TẮT (Bấm để bật)');
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('kds_sound', soundEnabled ? '1' : '0');
    updateSoundUI();
    if (soundEnabled) {
        playChime(587.33, 880); // Quick test chime
    }
}

function playChime(freq1 = 523.25, freq2 = 659.25) {
    if (!soundEnabled) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq1, now);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq2, now + 0.15);
        gain2.gain.setValueAtTime(0.25, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.6);
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('kitchen_kds.js', e) : console.debug('kitchen_kds.js', e)); }
}

function switchFilter(filter) {
    currentFilter = filter;
    const btnActive = document.getElementById('tab-filter-active');
    const btnServed = document.getElementById('tab-filter-served');
    const btnHistory = document.getElementById('tab-filter-history');
    const btnAll = document.getElementById('tab-filter-all');

    const baseClass = 'flex-1 min-w-[120px] py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ';
    const activeClass = baseClass + 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
    const inactiveClass = baseClass + 'bg-slate-800/40 text-slate-300 border border-white/5 hover:bg-slate-800/70 hover:text-white';

    if (btnActive) btnActive.className = filter === 'active' ? activeClass : inactiveClass;
    if (btnServed) btnServed.className = filter === 'served' ? activeClass.replace('amber', 'emerald') : inactiveClass;
    if (btnHistory) btnHistory.className = filter === 'history' ? activeClass.replace('amber', 'purple') : inactiveClass;
    if (btnAll) btnAll.className = filter === 'all' ? activeClass.replace('amber', 'sky') : inactiveClass;

    loadKitchenOrders();
}

async function loadKitchenOrders() {
    try {
        const res = await fetch(`api/orders.php?action=kitchen_tickets&status=${currentFilter}`);
        const data = await res.json();
        if (!data.success) return;

        const orders = data.data || [];
        const counts = data.counts || { active: 0, served: 0, history: 0, all: 0 };

        // Update counts on tabs
        if (document.getElementById('count-tab-active')) document.getElementById('count-tab-active').innerText = counts.active;
        if (document.getElementById('count-tab-served')) document.getElementById('count-tab-served').innerText = counts.served;
        if (document.getElementById('count-tab-history')) document.getElementById('count-tab-history').innerText = counts.history || 0;
        if (document.getElementById('count-tab-all')) document.getElementById('count-tab-all').innerText = counts.all;
        if (document.getElementById('active-tickets-count')) document.getElementById('active-tickets-count').innerText = `${counts.active} ${window.cnxT?window.cnxT('js.s_kds.fa318788','đơn cần làm'):'đơn cần làm'}`;

        // Sound notification when a new order arrives or a waiter/cashier rushes an order
        if (!window.knownRushMap) window.knownRushMap = new Map();
        const nextRushMap = new Map();
        let hasNewOrder = false;
        let hasNewRush = false;
        orders.forEach(o => {
            const rCount = Number(o.rush_count || 0);
            nextRushMap.set(o.id, rCount);
            if (!isFirstLoad) {
                if (!knownOrderIds.has(o.id) && (o.kitchen_status === 'pending' || o.kitchen_status === 'preparing' || !o.kitchen_status)) {
                    hasNewOrder = true;
                }
                if (rCount > Number(window.knownRushMap.get(o.id) || 0) && (o.kitchen_status === 'pending' || o.kitchen_status === 'preparing' || !o.kitchen_status)) {
                    hasNewRush = true;
                }
            }
        });
        if (!isFirstLoad && hasNewRush) {
            playChime(880, 1046.5);
            setTimeout(() => playChime(880, 1046.5), 250);
        } else if (!isFirstLoad && hasNewOrder) {
            playChime(659.25, 880);
        }
        window.knownRushMap = nextRushMap;
        knownOrderIds = new Set(orders.map(o => o.id));
        isFirstLoad = false;

        const container = document.getElementById('kitchen-tickets-grid');
        if (orders.length === 0) {
            let emptyMsg = (window.cnxT?window.cnxT('js.s_kds.b3b70cb9','Hiện tại không có món nào đang chờ chế biến!'):'Hiện tại không có món nào đang chờ chế biến!');
            let emptySub = (window.cnxT?window.cnxT('js.s_kds.e77b1429','Khi nhân viên hoặc thu ngân nhận order, phiếu sẽ xuất hiện tại đây.'):'Khi nhân viên hoặc thu ngân nhận order, phiếu sẽ xuất hiện tại đây.');
            if (currentFilter === 'served') {
                emptyMsg = (window.cnxT?window.cnxT('js.s_kds.64ad031a','Chưa có món nào đang chờ phục vụ bưng ra bàn!'):'Chưa có món nào đang chờ phục vụ bưng ra bàn!');
                emptySub = (window.cnxT?window.cnxT('js.s_kds.5e26f5ea','Sau khi bếp báo xong và phục vụ bưng ra, đơn sẽ xuất hiện tại đây.'):'Sau khi bếp báo xong và phục vụ bưng ra, đơn sẽ xuất hiện tại đây.');
            } else if (currentFilter === 'history') {
                emptyMsg = (window.cnxT?window.cnxT('js.s_kds.d51f948f','Chưa có lịch sử chế biến trong hôm nay!'):'Chưa có lịch sử chế biến trong hôm nay!');
                emptySub = (window.cnxT?window.cnxT('js.s_kds.fa13a0fa','Tất cả các món đã pha chế trong ca sẽ được lưu lại đầy đủ tại đây.'):'Tất cả các món đã pha chế trong ca sẽ được lưu lại đầy đủ tại đây.');
            }
            container.innerHTML = `
                <div class="col-span-full py-24 text-center text-slate-500">
                    <i class="fas fa-mug-hot text-5xl mb-3 text-slate-600 opacity-40 block"></i>
                    <h3 class="font-bold text-base text-slate-400">${emptyMsg}</h3>
                    <p class="text-xs text-slate-500 mt-1">${emptySub}</p>
                </div>
            `;
            return;
        }

        let html = '';
        orders.forEach(o => {
            const status = o.kitchen_status || 'pending';
            const isPaid = (o.payment_status === 'paid' || Boolean(o.paid_at));
            const isServed = status === 'served' || Boolean(o.served_at);
            const isReady = status === 'ready' || Boolean(o.kitchen_ready_at);
            const isPending = !isReady && !isServed && (status === 'pending' || status === 'preparing' || !status);

            // Đơn HOÀN THÀNH khi đủ cả 3 yếu tố: Xong món + Bưng ra + Thanh toán (hoặc status == 'completed')
            const isFullyCompleted = (o.status === 'completed' && isServed) || (isPaid && isServed && isReady);

            // Sau khi hoàn thành bưng ra hoặc trong tab lịch sử -> LỊCH SỬ THUẦN TÚY (KHÔNG TỒN TẠI BẤT KỲ NÚT BẤM NÀO)
            const isHistorical = isFullyCompleted || isServed || currentFilter === 'served' || currentFilter === 'history';

            const items = o.items || [];
            let itemsHtml = '';
            items.forEach((it, idx) => {
                const toppings = it.toppings || [];
                let toppingText = '';
                if (toppings.length > 0) {
                    toppingText = `<div class="text-[11px] text-sky-400 font-semibold pl-2">+ ${toppings.map(x => escapeHtml(x.name)).join(', ')}</div>`;
                }

                const noteText = (it.note || '').trim();
                const cancelSt = (it.cancel_status || 'none');
                const isCancelledItem = (cancelSt === 'approved' || cancelSt === 'out_of_stock');
                const isRejected = (cancelSt === 'rejected') || noteText.includes('Đã làm') || noteText.includes('Đã chế biến') || noteText.includes('Giữ nguyên món');
                const hasCancelNote = (cancelSt === 'pending_kitchen') || (cancelSt === 'none' && !isRejected && /hủy|huy|cancel/i.test(noteText));
                const cancelRsn = (it.cancel_reason || noteText || (window.cnxT?window.cnxT('js.s_kds.f4b768d2','Khách xin hủy'):'Khách xin hủy')).trim();
                const safeName = escapeJsAttr(it.product_name || '');
                const safeRsn = escapeJsAttr(cancelRsn);
                const safeTbl = escapeJsAttr(o.table_code || '');
                const safeOcode = escapeJsAttr(o.order_code || '');

                itemsHtml += `
                    <div class="p-2.5 rounded-lg ${isCancelledItem ? 'bg-slate-950/60 border border-rose-500/20 opacity-60' : (hasCancelNote ? 'bg-amber-950/25 border border-amber-500/50' : (isRejected ? 'bg-amber-950/10 border border-amber-500/20' : 'bg-slate-900/90 border border-white/5'))} space-y-1.5 transition-all">
                        <div class="flex items-center justify-between gap-1.5">
                            <span class="font-black text-sm ${isCancelledItem ? 'line-through text-slate-400' : 'text-white'} flex-1 truncate">${idx + 1}. ${escapeHtml(typeof window.cnxDbText === 'function' ? window.cnxDbText(it, 'name', it.product_name) : it.product_name)}</span>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <span class="w-6 h-6 rounded bg-amber-500/20 text-amber-300 font-mono font-black text-xs flex items-center justify-center">x${it.quantity}</span>
                                ${(!isHistorical && !isCancelledItem) ? `
                                    ${(() => {
                                        const itSt = it.item_status || o.kitchen_status || 'pending';
                                        if (itSt === 'served') return '<span class="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">✓ Đã bưng</span>';
                                        if (itSt === 'ready') return '<span class="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-400/40 text-[10px] font-bold">✓ Đã xong</span>';
                                        return `<button type="button" onclick="updateKitchenItemStatus(${it.id}, 'ready')" class="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/40 text-[10px] font-black flex items-center gap-1 active:scale-90 transition-all" title="Đánh dấu đã xong món này"><i class="fas fa-check text-[9px]"></i><span>Xong</span></button>`;
                                    })()}
                                    ${hasCancelNote ? `
                                        <button type="button" onclick="openKitchenActionModal('approve_cancel', ${o.id}, ${it.id}, '${safeName}', '${safeTbl}', '${safeOcode}', '${safeRsn}')" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center gap-1 shadow-md shadow-emerald-500/30 active:scale-90 transition-all animate-pulse" title="Đồng ý hủy món theo yêu cầu của phục vụ">
                                            <i class="fas fa-check"></i>
                                            <span>${window.cnxT?window.cnxT('js.s_kds.530f291a','Đồng ý'):'Đồng ý'}</span>
                                        </button>
                                        <button type="button" onclick="openKitchenActionModal('reject_cancel', ${o.id}, ${it.id}, '${safeName}', '${safeTbl}', '${safeOcode}', '${safeRsn}')" class="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold flex items-center gap-1 active:scale-90 transition-all" title="Từ chối hủy do bếp đã làm">
                                            <i class="fas fa-times"></i>
                                            <span>${window.cnxT?window.cnxT('js.s_kds.10af9351','Từ chối'):'Từ chối'}</span>
                                        </button>
                                    ` : ''}
                                    <button type="button" onclick="openKitchenActionModal('out_of_stock', ${o.id}, ${it.id}, '${safeName}', '${safeTbl}', '${safeOcode}', '')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-black flex items-center gap-1 active:scale-90 transition-all" title="Báo hết món này">
                                        <i class="fas fa-ban text-[10px]"></i>
                                        <span>${window.cnxT?window.cnxT('js.s_kds.20847175','Hết'):'Hết'}</span>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        ${toppingText}
                        ${isCancelledItem ? `
                            <div class="text-[11px] text-rose-300 font-semibold pl-2"><i class="fas fa-ban mr-1"></i>${cancelSt === 'out_of_stock' ? 'Đã báo HẾT' : (window.cnxT?window.cnxT('js.s_kds.a72dedb6','Đã đồng ý HỦY'):'Đã đồng ý HỦY')}: ${escapeHtml(cancelRsn)}</div>
                        ` : (hasCancelNote ? `
                            <div class="text-xs text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-1 rounded font-bold flex items-center gap-1.5">
                                <i class="fas fa-triangle-exclamation text-amber-400 animate-bounce text-xs"></i><span>${window.cnxT?window.cnxT('js.s_kds.cf744e1f','Xin hủy:'):'Xin hủy:'} <b class="text-white">${escapeHtml(cancelRsn)}</b></span>
                            </div>
                        ` : (it.note ? `
                            <div class="text-xs ${isRejected ? 'text-amber-300 bg-amber-950/30 border border-amber-500/30 px-2 py-1 rounded font-semibold pl-2' : 'text-rose-300 italic font-semibold pl-2'}">
                                ${isRejected ? '<i class="fas fa-fire-burner text-amber-400 mr-1"></i>' + escapeHtml(it.note) : '<i class="fas fa-comment-dots mr-1"></i>' + escapeHtml(it.note)}
                            </div>
                        ` : ''))}
                    </div>
                `;
            });

            // Styling based on states
            let cardBorderClass = 'border-amber-500/40 bg-slate-900/85 shadow-lg shadow-amber-500/5';
            let tableColorClass = 'text-amber-400';
            let statusBadgeHtml = '';
            let actionButtonHtml = '';

            if (isFullyCompleted) {
                cardBorderClass = 'border-purple-500/40 bg-purple-950/20 shadow-lg shadow-purple-950/20';
                tableColorClass = 'text-purple-300';
                statusBadgeHtml = `
                    <span class="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-black border border-purple-500/40 flex items-center gap-1">
                        <i class="fas fa-check-double"></i> ${window.cnxT?window.cnxT('js.s_kds.672a51ab','Đã Xong & TT'):'Đã Xong & TT'}
                    </span>
                `;
                actionButtonHtml = `
                    <div class="flex items-center gap-1 text-[11px] text-purple-300 font-semibold">
                        <i class="fas fa-receipt mr-1"></i> ${window.cnxT?window.cnxT('js.s_kds.79708fc8','Đã hoàn tất thanh toán'):'Đã hoàn tất thanh toán'}
                    </div>
                `;
            } else if (isServed) {
                cardBorderClass = 'border-emerald-500/50 bg-emerald-950/20 shadow-lg shadow-emerald-900/10';
                tableColorClass = 'text-emerald-400';
                const payBadge = isPaid 
                    ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">💰 Đã TT</span>'
                    : (window.cnxT?window.cnxT('js.s_kds.970e01a7','<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">Chờ TT</span>'):'<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">Chờ TT</span>');
                statusBadgeHtml = `
                    ${payBadge}
                    <span class="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/40 flex items-center gap-1">
                        <i class="fas fa-check-circle"></i> ${window.cnxT?window.cnxT('js.s_kds.0bb9d86c','Đã Bưng Ra Bàn'):'Đã Bưng Ra Bàn'}
                    </span>
                `;
                actionButtonHtml = `
                    <div class="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                        <i class="fas fa-check-circle"></i> ${window.cnxT?window.cnxT('js.s_kds.34a84efa','Đã bưng ra bàn (Lịch sử)'):'Đã bưng ra bàn (Lịch sử)'}
                    </div>
                `;
            } else if (o.kitchen_status === 'cancel_requested') {
                cardBorderClass = 'border-rose-500/60 bg-rose-950/25 shadow-xl shadow-rose-500/15';
                tableColorClass = 'text-rose-300';
                statusBadgeHtml = `
                    <span class="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 font-black border border-rose-500/40 flex items-center gap-1 animate-pulse">
                        <i class="fas fa-hourglass-half"></i> ${window.cnxT?window.cnxT('js.s_kds.f1675cff','Chờ Thu ngân duyệt hủy'):'Chờ Thu ngân duyệt hủy'}
                    </span>
                `;
                actionButtonHtml = `<div class="text-[11px] text-rose-300 font-semibold italic">Đã gửi lý do: ${o.cancel_request_reason || (window.cnxT?window.cnxT('js.s_kds.95706ab3','Yêu cầu hủy đơn'):'Yêu cầu hủy đơn')}</div>`;
            } else if (isReady) {
                const waiterElapsed = Number(o.waiter_elapsed_minutes || 0);
                const waiterSla = Number(o.waiter_sla_minutes || 3);
                const isWaiterOverdue = waiterElapsed >= waiterSla;
                const remindCount = Number(o.remind_count || 0);
                cardBorderClass = isWaiterOverdue
                    ? 'border-amber-400 bg-amber-950/30 shadow-xl shadow-amber-500/25 ring-2 ring-amber-400/70'
                    : 'border-sky-500/70 bg-sky-950/25 shadow-xl shadow-sky-500/20 ring-1 ring-sky-500/30';
                tableColorClass = isWaiterOverdue ? 'text-amber-300' : 'text-sky-300';
                const payBadge = isPaid 
                    ? '<span class="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-black border border-teal-500/40 flex items-center gap-1"><i class="fas fa-money-bill-wave"></i> Đã TT</span>'
                    : (window.cnxT?window.cnxT('js.s_kds.c1b4fc76','<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 font-bold border border-slate-600">Chưa TT</span>'):'<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 font-bold border border-slate-600">Chưa TT</span>');
                statusBadgeHtml = `
                    ${payBadge}
                    <span class="text-[10px] px-2.5 py-0.5 rounded-full ${isWaiterOverdue ? 'bg-amber-500/30 text-amber-200 border-amber-400' : 'bg-sky-500/20 text-sky-300 border-sky-500/40'} font-black border animate-pulse flex items-center gap-1">
                        <i class="fas fa-bell"></i> ${isWaiterOverdue ? `${window.cnxT?window.cnxT('js.s_kds.8292a97f','Quá'):'Quá'} ${waiterElapsed}${window.cnxT?window.cnxT('js.s_kds.9d762f2a','p chờ bưng'):'p chờ bưng'}` : (window.cnxT?window.cnxT('js.s_kds.2bb346e3','Chờ Phục Vụ Lấy'):'Chờ Phục Vụ Lấy')}${remindCount > 0 ? ` ${window.cnxT?window.cnxT('js.s_kds.f3a5091a','(Nhắc x'):'(Nhắc x'}${remindCount})` : ''}
                    </span>
                `;
                actionButtonHtml = `
                    <div class="flex items-center gap-1.5">
                        <button type="button" class="btn-glass bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border-rose-500/40 text-xs py-2 px-2.5 font-bold flex items-center gap-1 shadow active:scale-95 transition-all" title="Yêu cầu hủy đơn (Gửi Thu ngân duyệt)" onclick="openKitchenActionModal('cancel_order', ${Number(o.id)}, 0, '', '${escapeJsAttr(o.table_code)}', '${escapeJsAttr(o.order_code)}', '')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <button type="button" class="btn-glass bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border-emerald-500/50 text-xs py-2 px-2.5 font-bold flex items-center gap-1 shadow active:scale-95 transition-all" title="Đã giao xong / Lưu trữ" onclick="archiveKitchenTicket(${Number(o.id)})">
                            <i class="fas fa-check"></i> <span>${window.cnxT?window.cnxT('js.s_kds.d5cb0ef3','Đã Giao'):'Đã Giao'}</span>
                        </button>
                        <button type="button" class="btn-glass ${isWaiterOverdue ? 'bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 border-amber-400 animate-pulse' : 'bg-sky-600/30 text-sky-300 border-sky-500/50'} text-xs py-2 px-3 font-bold flex items-center gap-1.5 shadow active:scale-95 transition-all" onclick="markKitchenReady(${Number(o.id)}, '${escapeJsAttr(o.table_code)}', this)">
                            <i class="fas fa-redo"></i>
                            <span>${isWaiterOverdue ? 'Báo Lại (Nhắc PV)' : (window.cnxT?window.cnxT('js.s_kds.3ee5de7b','Báo Lại'):'Báo Lại')}</span>
                        </button>
                    </div>
                `;
            } else { // isPending
                const rushCount = Number(o.rush_count || 0);
                const isRushed = rushCount > 0;
                cardBorderClass = isRushed
                    ? 'border-rose-500 bg-rose-950/30 shadow-xl shadow-rose-500/25 ring-2 ring-rose-500/70'
                    : (isPaid
                        ? 'border-teal-500/60 bg-teal-950/20 shadow-xl shadow-teal-500/10'
                        : 'border-amber-500/50 bg-slate-900/90 shadow-xl shadow-amber-500/10');
                tableColorClass = isRushed ? 'text-rose-300' : (isPaid ? 'text-teal-300' : 'text-amber-400');
                const rushBadge = isRushed
                    ? `<span class="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-black animate-pulse flex items-center gap-1 shadow shadow-rose-500/40" title="${o.last_rushed_by ? `${escapeHtml(o.last_rushed_by)} ${window.cnxT?window.cnxT('js.s_kds.14fd92eb','hối lúc'):'hối lúc'} ${escapeHtml((o.last_rushed_at || '').substring(11, 16))}` : ''}"><i class="fas fa-fire"></i> HỐI MÓN (x${rushCount})</span>`
                    : '';
                const payBadge = isPaid 
                    ? '<span class="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-black border border-teal-500/40 flex items-center gap-1"><i class="fas fa-money-bill-wave"></i> Đã TT</span>'
                    : (window.cnxT?window.cnxT('js.s_kds.c1b4fc76','<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 font-bold border border-slate-600">Chưa TT</span>'):'<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 font-bold border border-slate-600">Chưa TT</span>');
                const isCancelReq = (o.kitchen_status === 'cancel_requested');
                statusBadgeHtml = isCancelReq ? `
                    ${payBadge}
                    <span class="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 font-black border border-rose-500/40 flex items-center gap-1 animate-pulse">
                        <i class="fas fa-hourglass-half"></i> ${window.cnxT?window.cnxT('js.s_kds.f1675cff','Chờ Thu ngân duyệt hủy'):'Chờ Thu ngân duyệt hủy'}
                    </span>
                ` : `
                    ${rushBadge}
                    ${payBadge}
                    <span class="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40 flex items-center gap-1">
                        <i class="fas fa-fire-burner animate-pulse"></i> ${window.cnxT?window.cnxT('js.s_kds.739ade54','Đang Chế Biến'):'Đang Chế Biến'}
                    </span>
                `;
                actionButtonHtml = isCancelReq ? `
                    <div class="text-[11px] text-rose-300 font-semibold italic">Đã gửi lý do: ${escapeHtml(o.cancel_request_reason || (window.cnxT?window.cnxT('js.s_kds.95706ab3','Yêu cầu hủy đơn'):'Yêu cầu hủy đơn'))}</div>
                ` : `
                    <div class="flex items-center gap-1.5">
                        <button type="button" class="btn-glass bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border-rose-500/40 text-xs py-2 px-2.5 font-bold flex items-center gap-1 shadow active:scale-95 transition-all" title="Yêu cầu hủy đơn (Gửi Thu ngân duyệt)" onclick="openKitchenActionModal('cancel_order', ${Number(o.id)}, 0, '', '${escapeJsAttr(o.table_code)}', '${escapeJsAttr(o.order_code)}', '')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <button type="button" class="btn-glass-success text-xs py-2 px-3.5 font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform" onclick="markKitchenReady(${Number(o.id)}, '${escapeJsAttr(o.table_code)}')">
                            <i class="fas fa-bell"></i>
                            <span>${window.cnxT?window.cnxT('js.s_kds.c5fe7e69','Xong Món (Báo Phục Vụ)'):'Xong Món (Báo Phục Vụ)'}</span>
                        </button>
                    </div>
                `;
            }

            const tableNameDisplay = o.table_name ? `(${o.table_name})` : '';

            let timingHtml = `<span>${window.cnxT?window.cnxT('js.s_kds.a70647c7','Tạo:'):'Tạo:'} <b class="text-slate-200 font-mono">${(o.created_at || '').substring(11, 16)}</b></span>`;
            if (o.kitchen_ready_at) {
                timingHtml += `<span> • Xong: <b class="text-sky-300 font-mono">${o.kitchen_ready_at.substring(11, 16)}</b></span>`;
            }
            if (o.prep_time_minutes > 0) {
                timingHtml += `<span class="text-amber-400"> (${o.prep_time_minutes}p)</span>`;
            }

            html += `
                <div class="liquid-glass p-4 rounded-2xl flex flex-col justify-between border ${cardBorderClass} transition-all">
                    <div>
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-white/10 mb-3">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span class="font-black text-lg ${tableColorClass} whitespace-nowrap">${o.table_code}</span>
                                <span class="text-xs text-slate-400 font-medium truncate">${tableNameDisplay}</span>
                            </div>
                            <div class="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
                                ${statusBadgeHtml}
                                <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10 whitespace-nowrap">
                                    ${o.order_code}
                                </span>
                            </div>
                        </div>
                        <div class="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
                            <div>${timingHtml}</div>
                            <span>${window.cnxT?window.cnxT('ui.pos_html.span_126cb08b','Khách:'):'Khách:'} <b class="text-slate-200">${o.guest_count} người</b></span>
                        </div>
                        <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                            ${itemsHtml}
                        </div>
                    </div>

                    <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        <div class="text-xs text-slate-400 truncate">
                            ${isFullyCompleted 
                                ? '<span class="text-purple-300 font-medium"><i class="fas fa-check-circle mr-1"></i> Khách đã dùng xong</span>' 
                                : (isServed 
                                    ? '<span class="text-emerald-400 font-semibold"><i class="fas fa-user-check mr-1"></i> Khách đã nhận món</span>'
                                    : `<span>Order: <b class="text-slate-200">${o.user_name || (window.cnxT?window.cnxT('ui.ord_html.b_c7307f33','Phục vụ'):'Phục vụ')}</b></span>`)}
                        </div>
                        <div>
                            ${actionButtonHtml}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (e) {
        console.error('KDS load error:', e);
    }
}

async function markKitchenReady(orderId, tableCode, btnEl = null) {
    const originalHtml = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = (window.cnxT?window.cnxT('js.s_kds.4a5ea11a','<i class="fas fa-spinner fa-spin"></i> <span>Đang báo chuông...</span>'):'<i class="fas fa-spinner fa-spin"></i> <span>Đang báo chuông...</span>');
    }

    try {
        const res = await fetch(`api/orders.php?action=kitchen_ready&order_id=${orderId}`, {
            method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
            playChime(783.99, 1046.50);
            if (btnEl) {
                btnEl.innerHTML = (window.cnxT?window.cnxT('js.s_kds.dc21c8c9','<i class="fas fa-check text-emerald-400"></i> <span class="text-emerald-300">Đã Báo Lại Chuông!</span>'):'<i class="fas fa-check text-emerald-400"></i> <span class="text-emerald-300">Đã Báo Lại Chuông!</span>');
                btnEl.classList.remove('bg-sky-600/30');
                btnEl.classList.add('bg-emerald-600/30', 'border-emerald-500/50');
                setTimeout(() => {
                    btnEl.disabled = false;
                    btnEl.innerHTML = originalHtml;
                    btnEl.classList.add('bg-sky-600/30');
                    btnEl.classList.remove('bg-emerald-600/30', 'border-emerald-500/50');
                }, 2500);
            }
            loadKitchenOrders();
        } else {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = originalHtml;
            }
            alert(data.message || (window.cnxT?window.cnxT('js.s_adm.2d4e917e','Lỗi thao tác'):'Lỗi thao tác'));
        }
    } catch(e) {
        console.error(e);
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = originalHtml;
        }
    }
}

let allDishesCache = [];
let _kitchenActionState = null;

function openKitchenActionModal(mode, orderId, itemId, productName, tableCode, orderCode, presetReason) {
    _kitchenActionState = { mode, orderId, itemId, productName, tableCode, orderCode };
    const modal = document.getElementById('kitchen-action-modal');
    const titleEl = document.getElementById('kam-title');
    const descEl = document.getElementById('kam-desc');
    const chipsEl = document.getElementById('kam-chips');
    const reasonEl = document.getElementById('kam-reason');
    const lockWrap = document.getElementById('kam-lock-wrap');
    const lockChk = document.getElementById('kam-lock-product');
    const submitBtn = document.getElementById('kam-submit-btn');

    if (!modal) return;
    if (lockWrap) lockWrap.classList.add('hidden');
    if (lockChk) lockChk.checked = true;

    let chips = [];
    if (mode === 'approve_cancel') {
        titleEl.innerHTML = `<i class="fas fa-check-circle text-emerald-400 mr-1.5"></i> Đồng ý hủy món (${tableCode})`;
        descEl.innerHTML = `Xác nhận <b>${window.cnxT?window.cnxT('js.s_kds.f2d80993','ĐỒNG Ý HỦY'):'ĐỒNG Ý HỦY'}</b> ${window.cnxT?window.cnxT('js.s_ops.5e8511dc','món'):'món'} <b>"${productName}"</b>? Hóa đơn sẽ tự động trừ tiền (nếu đã thanh toán sẽ báo Thu ngân hoàn lại cho khách).`;
        reasonEl.value = presetReason || (window.cnxT?window.cnxT('js.s_kds.bcc2ca32','Bếp đồng ý hủy theo yêu cầu phục vụ'):'Bếp đồng ý hủy theo yêu cầu phục vụ');
        chips = [(window.cnxT?window.cnxT('js.s_kds.272b52fd','Chưa chế biến - Đồng ý hủy'):'Chưa chế biến - Đồng ý hủy'), (window.cnxT?window.cnxT('js.s_kds.88906522','Khách đổi ý kịp thời'):'Khách đổi ý kịp thời'), (window.cnxT?window.cnxT('js.s_kds.3744a653','Nhân viên bấm nhầm'):'Nhân viên bấm nhầm')];
        submitBtn.className = 'px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black';
        submitBtn.textContent = (window.cnxT?window.cnxT('js.s_kds.319791fc','Xác nhận Đồng Ý Hủy'):'Xác nhận Đồng Ý Hủy');
    } else if (mode === 'reject_cancel') {
        titleEl.innerHTML = `<i class="fas fa-fire-burner text-amber-400 mr-1.5"></i> Từ chối hủy món (${tableCode})`;
        descEl.innerHTML = `Bếp <b>${window.cnxT?window.cnxT('js.s_kds.8b575de7','KHÔNG ĐỒNG Ý HỦY'):'KHÔNG ĐỒNG Ý HỦY'}</b> ${window.cnxT?window.cnxT('js.s_ops.5e8511dc','món'):'món'} <b>"${productName}"</b>? Món vẫn giữ trên hóa đơn và báo lại Phục vụ.`;
        reasonEl.value = (window.cnxT?window.cnxT('js.s_kds.daddb531','Bếp đã chế biến / đã làm xong'):'Bếp đã chế biến / đã làm xong');
        chips = [(window.cnxT?window.cnxT('js.s_kds.4eaa347d','Bếp đã làm xong'):'Bếp đã làm xong'), (window.cnxT?window.cnxT('js.s_kds.6f42e777','Đang nấu không thể dừng'):'Đang nấu không thể dừng'), (window.cnxT?window.cnxT('js.s_kds.577a633b','Đã ra món'):'Đã ra món')];
        submitBtn.className = 'px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black';
        submitBtn.textContent = (window.cnxT?window.cnxT('js.s_kds.f836e405','Xác nhận Từ Chối Hủy'):'Xác nhận Từ Chối Hủy');
    } else if (mode === 'out_of_stock') {
        titleEl.innerHTML = `<i class="fas fa-ban text-rose-400 mr-1.5"></i> Báo HẾT món (${escapeHtml(tableCode)})`;
        descEl.innerHTML = `Báo hết món <b>"${escapeHtml(productName)}"</b>. Hệ thống sẽ tự trừ tiền trên hóa đơn ${escapeHtml(orderCode)} ${window.cnxT?window.cnxT('js.s_kds.756db9ee','và thông báo ngay cho Phục vụ & Thu ngân.'):'và thông báo ngay cho Phục vụ & Thu ngân.'}`;
        reasonEl.value = (window.cnxT?window.cnxT('js.s_kds.58dd01bb','Hết nguyên liệu tại bếp'):'Hết nguyên liệu tại bếp');
        chips = [(window.cnxT?window.cnxT('js.s_kds.58dd01bb','Hết nguyên liệu tại bếp'):'Hết nguyên liệu tại bếp'), (window.cnxT?window.cnxT('js.s_kds.d69424a0','Bếp tạm ngưng món này hôm nay'):'Bếp tạm ngưng món này hôm nay'), (window.cnxT?window.cnxT('js.s_kds.ecd1dc18','Hết hàng đột xuất'):'Hết hàng đột xuất')];
        if (lockWrap) lockWrap.classList.remove('hidden');
        submitBtn.className = 'px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black';
        submitBtn.textContent = (window.cnxT?window.cnxT('js.s_kds.2a0031a5','Xác nhận Báo Hết'):'Xác nhận Báo Hết');
    } else if (mode === 'cancel_order') {
        titleEl.innerHTML = `<i class="fas fa-triangle-exclamation text-rose-400 mr-1.5"></i> Yêu cầu Hủy Đơn ${escapeHtml(orderCode)} (${escapeHtml(tableCode)})`;
        descEl.innerHTML = `Bếp gửi yêu cầu hủy đơn <b>${escapeHtml(orderCode)}</b> ${window.cnxT?window.cnxT('js.s_kds.f0e804a6','lên'):'lên'} <b>${window.cnxT?window.cnxT('js.s_kds.346693af','Thu ngân & Phục vụ'):'Thu ngân & Phục vụ'}</b> xác nhận chốt hủy (tránh xóa nhầm đơn đang tính tiền).`;
        reasonEl.value = '';
        chips = [(window.cnxT?window.cnxT('js.s_kds.94406ee0','Hết toàn bộ nguyên liệu'):'Hết toàn bộ nguyên liệu'), (window.cnxT?window.cnxT('js.s_kds.28cc0d1a','Khách báo hủy trước khi làm'):'Khách báo hủy trước khi làm'), (window.cnxT?window.cnxT('js.s_kds.854a9d86','Đơn đặt trùng / đơn test'):'Đơn đặt trùng / đơn test')];
        submitBtn.className = 'px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black';
        submitBtn.textContent = (window.cnxT?window.cnxT('js.s_kds.c2b01ee5','Gửi Yêu Cầu Hủy Đơn'):'Gửi Yêu Cầu Hủy Đơn');
    }

    chipsEl.innerHTML = chips.map(c => `<button type="button" onclick="document.getElementById('kam-reason').value='${escapeJsAttr(c)}'" class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] text-slate-300">${escapeHtml(c)}</button>`).join('');
    modal.classList.add('open');
}

function closeKitchenActionModal() {
    document.getElementById('kitchen-action-modal')?.classList.remove('open');
    _kitchenActionState = null;
}

async function submitKitchenActionModal() {
    if (!_kitchenActionState) return;
    const { mode, orderId, itemId } = _kitchenActionState;
    const reason = (document.getElementById('kam-reason')?.value || '').trim();
    if (!reason) {
        alert((window.cnxT?window.cnxT('js.s_kds.042d1aed','Vui lòng chọn hoặc nhập lý do rõ ràng!'):'Vui lòng chọn hoặc nhập lý do rõ ràng!'));
        document.getElementById('kam-reason')?.focus();
        return;
    }
    const btn = document.getElementById('kam-submit-btn');
    if (btn) btn.disabled = true;

    try {
        let url = '';
        let payload = {};
        if (mode === 'approve_cancel') {
            url = 'api/orders.php?action=kitchen_resolve_cancel_item';
            payload = { order_id: orderId, item_id: itemId, decision: 'approve', reason };
        } else if (mode === 'reject_cancel') {
            url = 'api/orders.php?action=kitchen_resolve_cancel_item';
            payload = { order_id: orderId, item_id: itemId, decision: 'reject', reason };
        } else if (mode === 'out_of_stock') {
            const lockProduct = Boolean(document.getElementById('kam-lock-product')?.checked);
            url = 'api/orders.php?action=kitchen_out_of_stock';
            payload = { order_id: orderId, item_id: itemId, lock_product: lockProduct, reason };
        } else if (mode === 'cancel_order') {
            url = 'api/orders.php?action=kitchen_request_cancel_order';
            payload = { order_id: orderId, reason };
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            playChime(mode === 'reject_cancel' ? 523.25 : 659.25, mode === 'reject_cancel' ? 659.25 : 523.25);
            closeKitchenActionModal();
            loadKitchenOrders();
            if (mode === 'out_of_stock') loadAllDishesForModal();
        } else {
            alert(data.message || (window.cnxT?window.cnxT('js.s_adm.2d4e917e','Lỗi thao tác'):'Lỗi thao tác'));
        }
    } catch (e) {
        alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Manage Locked Dishes Modal
async function openLockedDishesModal() {
    document.getElementById('modal-manage-locked-dishes').classList.add('open');
    await loadAllDishesForModal();
}

function closeLockedDishesModal() {
    document.getElementById('modal-manage-locked-dishes').classList.remove('open');
}

async function loadAllDishesForModal() {
    try {
        const res = await fetch('api/products.php');
        const data = await res.json();
        if (data.success) {
            allDishesCache = data.data || [];
            renderLockedDishesList();
            updateLockedCount();
        }
    } catch(e) {
        console.error(e);
    }
}

function updateLockedCount() {
    const count = allDishesCache.filter(p => p.status === 'locked').length;
    const badge = document.getElementById('count-locked-dishes');
    if (badge) badge.innerText = count;
}

function renderLockedDishesList() {
    const container = document.getElementById('locked-dishes-list');
    const searchEl = document.getElementById('locked-dishes-search');
    const search = (searchEl && searchEl.value ? searchEl.value : '').toLowerCase().trim();
    if (!container) return;

    let list = allDishesCache;
    if (search) {
        list = list.filter(p => p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search)));
    }

    if (list.length === 0) {
        container.innerHTML = (window.cnxT?window.cnxT('js.s_kds.cc2c833b','<div class="text-xs text-slate-500 py-8 text-center">Không tìm thấy món ăn nào</div>'):'<div class="text-xs text-slate-500 py-8 text-center">Không tìm thấy món ăn nào</div>');
        return;
    }

    let html = '';
    list.forEach(p => {
        const isLocked = (p.status === 'locked');
        html += `
            <div class="p-3 rounded-xl ${isLocked ? 'bg-rose-950/30 border border-rose-500/40' : 'bg-slate-900/80 border border-white/5'} flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-white/10 shrink-0 relative">
                        <img src="${escapeHtml(p.image || 'assets/images/dishes/default_dish.jpg')}" alt="${escapeHtml(p.name)}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='assets/images/dishes/default_dish.jpg';" />
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                            <span class="font-mono font-bold text-[10px] text-sky-400 bg-slate-950 px-1 rounded">${escapeHtml(p.code || 'SP')}</span>
                            <h4 class="font-bold text-xs text-white truncate">${escapeHtml(p.name)}</h4>
                        </div>
                        <div class="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span class="font-mono text-amber-400 font-bold">${new Intl.NumberFormat('vi-VN').format(p.sale_price)} đ</span>
                            <span>•</span>
                            <span>${escapeHtml(p.category_name || (window.cnxT?window.cnxT('js.s_kds.de6359a6','Món'):'Món'))}</span>
                        </div>
                    </div>
                </div>

                <div class="shrink-0 flex items-center gap-2">
                    ${isLocked ? `
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-black border border-rose-500/40 animate-pulse">
                            ${window.cnxT?window.cnxT('js.s_kds.39eb30de','🚫 ĐANG HẾT HÀNG'):'🚫 ĐANG HẾT HÀNG'}
                        </span>
                        <button type="button" onclick="toggleDishStatus(${p.id}, 'active')" class="btn-glass text-xs py-1.5 px-3 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border-emerald-500/40 font-bold flex items-center gap-1 active:scale-95 shadow">
                            <i class="fas fa-check"></i>
                            <span>${window.cnxT?window.cnxT('js.s_kds.f9cec75b','Mở Bán Lại'):'Mở Bán Lại'}</span>
                        </button>
                    ` : `
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                            ${window.cnxT?window.cnxT('js.s_kds.86edefc2','🟢 Đang Bán'):'🟢 Đang Bán'}
                        </span>
                        <button type="button" onclick="toggleDishStatus(${p.id}, 'locked')" class="btn-glass text-xs py-1.5 px-3 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border-rose-500/40 font-bold flex items-center gap-1 active:scale-95">
                            <i class="fas fa-ban"></i>
                            <span>${window.cnxT?window.cnxT('js.s_kds.224ac649','Tạm Khóa (Hết)'):'Tạm Khóa (Hết)'}</span>
                        </button>
                    `}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function filterLockedDishesModal() {
    renderLockedDishesList();
}

async function toggleDishStatus(productId, targetStatus) {
    try {
        const res = await fetch('api/products.php?action=toggle_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: productId, status: targetStatus })
        });
        const data = await res.json();
        if (data.success) {
            const prod = allDishesCache.find(p => p.id === productId);
            if (prod) prod.status = targetStatus;
            renderLockedDishesList();
            updateLockedCount();
            playChime(targetStatus === 'locked' ? 440 : 659, targetStatus === 'locked' ? 330 : 880);
        } else {
            alert(data.message || (window.cnxT?window.cnxT('js.s_kds.8ae47801','Lỗi khi cập nhật trạng thái món'):'Lỗi khi cập nhật trạng thái món'));
        }
    } catch(e) {
        console.error(e);
    }
}

async function archiveKitchenTicket(orderId) {
    try {
        const res = await fetch(`api/orders.php?action=kitchen_archive&order_id=${orderId}`, {
            method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
            loadKitchenOrders();
        } else {
            alert(data.message || (window.cnxT?window.cnxT('js.s_adm.2d4e917e','Lỗi thao tác'):'Lỗi thao tác'));
        }
    } catch(e) {
        console.error(e);
    }
}

async function kitchenCancelOrder(orderId, orderCode, tableCode) {
    if (!(await window.cnxConfirm(`Xác nhận HỦY / XÓA đơn rác "${orderCode}" (${tableCode}${window.cnxT?window.cnxT('js.s_kds.07ed6e4e',') khỏi màn hình bếp?'):') khỏi màn hình bếp?'}`))) return;
    try {
        const res = await fetch(`api/orders.php?action=cancel_order&order_id=${orderId}`, {
            method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
            playChime(523.25, 392.00);
            loadKitchenOrders();
        } else {
            alert(data.message || (window.cnxT?window.cnxT('js.s_kds.a5b5e2e8','Lỗi khi hủy đơn'):'Lỗi khi hủy đơn'));
        }
    } catch(e) {
        console.error(e);
        alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
    }
}

async function reopenKitchenTicket(orderId) {
    if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_kds.aac88084','Chuyển đơn hàng này về trạng thái Đang Chế Biến?'):'Chuyển đơn hàng này về trạng thái Đang Chế Biến?')))) return;
    try {
        const res = await fetch(`api/orders.php?action=kitchen_reopen&order_id=${orderId}`, {
            method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
            loadKitchenOrders();
        } else {
            alert(data.message || (window.cnxT?window.cnxT('js.s_adm.2d4e917e','Lỗi thao tác'):'Lỗi thao tác'));
        }
    } catch(e) {
        console.error(e);
    }
}

async function handleLogout() {
    if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_kds.0f434d42','Bạn có chắc muốn đăng xuất khỏi tài khoản Bếp?'):'Bạn có chắc muốn đăng xuất khỏi tài khoản Bếp?')))) return;
    try {
        await fetch('api/auth.php?action=logout');
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('kitchen_kds.js', e) : console.debug('kitchen_kds.js', e)); }
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
    document.cookie = "pos_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.replace('login.html?logout=1');
}

let kitchenCustomerQrInstance = null;
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

function renderKitchenCustomerQr(url) {
    var urlEl = document.getElementById('kitchen-customer-url-text');
    var linkEl = document.getElementById('kitchen-customer-direct-link');
    var canvasContainer = document.getElementById('kitchen-customer-qr-canvas');

    if (urlEl) urlEl.textContent = url;
    if (linkEl) linkEl.href = url;

    if (canvasContainer && typeof QRCode !== 'undefined') {
        canvasContainer.innerHTML = '';
        try {
            kitchenCustomerQrInstance = new QRCode(canvasContainer, {
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
    renderKitchenCustomerQr(initialUrl);
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
                    renderKitchenCustomerQr(freshUrl);
                }
            }
        }
    } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('kitchen_kds.js', e) : console.debug('kitchen_kds.js', e)); }
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

function renderKitchenAdminBadge() {
    const zone = document.getElementById('kitchen-admin-badge-zone');
    const backZone = document.getElementById('kitchen-nav-back-zone');
    const u = window.currentUser;
    const tr = (k, fb) => (typeof window.cnxT === 'function' ? window.cnxT(k, fb) : fb);
    if (!u) {
        if (zone) zone.innerHTML = '';
        if (backZone) backZone.innerHTML = '';
        return;
    }
    const isAdmin = (u.role === 'admin' || u.is_super_admin === true);
    const isCashier = (u.role === 'cashier');
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
        const roleLabel = isAdmin ? tr('nav.role_admin', 'ADMIN') : (isCashier ? tr('nav.role_cashier', 'THU NGÂN') : tr('nav.role_kitchen', 'BẾP'));
        const badgeCls = isAdmin ? 'bg-amber-500/20 text-amber-300 border-amber-400/40' : 'bg-sky-500/20 text-sky-300 border-sky-400/40';
        const rawName = u.fullname || u.username || '';
        const prettyName = (isAdmin && /Quản Trị Viên/i.test(rawName)) ? tr('nav.owner_name', 'Chủ quán') : rawName;
        const disp = escapeHtml(prettyName);
        zone.innerHTML = `<div class="cn-user-pill ${isAdmin ? 'bg-slate-800/90 border border-amber-500/40 text-amber-200' : 'bg-slate-800/80 border border-white/10 text-slate-200'}"><i class="fas ${isAdmin ? 'fa-crown text-amber-400' : 'fa-user-tag text-sky-400'} text-xs"></i><span class="cn-user-name">${disp}</span><span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-black ${badgeCls} border">${roleLabel}</span></div>`;
    }
}
window.addEventListener('cybernexus:langchange', renderKitchenAdminBadge);
window.addEventListener('cnx:lang-changed', renderKitchenAdminBadge);
window.addEventListener('cnx:i18n-ready', renderKitchenAdminBadge);

// Initialize & auto reload every 3.5 seconds with inFlight guard
document.addEventListener('DOMContentLoaded', () => {
    renderKitchenAdminBadge();
    updateSoundUI();
    loadKitchenOrders();
    loadAllDishesForModal();
    let _kdsPollInFlight = false;
    setInterval(async () => {
        if (document.hidden || _kdsPollInFlight) return;
        _kdsPollInFlight = true;
        try { await loadKitchenOrders(); } finally { _kdsPollInFlight = false; }
    }, 3500);
    // Định kỳ gửi heartbeat giữ trạng thái trực tuyến cho tổ bếp
    let _kdsHbInFlight = false;
    async function sendKitchenHeartbeat() {
        if (_kdsHbInFlight) return;
        _kdsHbInFlight = true;
        try {
            await fetch('api/auth.php?action=heartbeat');
        } catch (err) {
            if (window.CyberSecurity) CyberSecurity.logSilentError('kdsHeartbeat', err);
        } finally {
            _kdsHbInFlight = false;
        }
    }
    setInterval(sendKitchenHeartbeat, 45000);
    window.addEventListener('online', sendKitchenHeartbeat);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            sendKitchenHeartbeat();
            loadKitchenOrders();
        }
    });
    window.addEventListener('focus', sendKitchenHeartbeat);
});

window.updateKitchenItemStatus = async function(itemId, nextSt) {
    try {
        const res = await fetch('api/orders.php?action=update_item_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: itemId, item_status: nextSt || 'ready' })
        });
        const d = await res.json();
        if (d && d.success) {
            await loadKitchenOrders();
        } else {
            alert((d && d.message) || 'Không thể cập nhật trạng thái món!');
        }
    } catch (e) {
        console.error('updateKitchenItemStatus error:', e);
    }
};
