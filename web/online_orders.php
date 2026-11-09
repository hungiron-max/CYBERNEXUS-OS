<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/saas_helper.php';

enforceModuleAccess('qr_customer_order', 'admin.php');
enforceRoleAccess(['admin', 'cashier', 'waiter']);
$storeLogoDataUri = licenseStoreLogoDataUri();

$currentUser = [
    'fullname' => $_SESSION['fullname'] ?? $_SESSION['username'] ?? 'Nhân viên',
    'role' => $_SESSION['user_role'] ?? ''
];
$canConfirmPayment = in_array($currentUser['role'], ['admin', 'cashier'], true);
$canConfirmDelivery = in_array($currentUser['role'], ['admin', 'waiter'], true);
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Đơn Online - <?= htmlspecialchars(STORE_NAME) ?></title>
    <link rel="icon" href="favicon.php?v=<?= $storeLogoDataUri !== '' ? substr(hash('sha256', $storeLogoDataUri), 0, 16) : 'default' ?>">
    <link rel="stylesheet" href="assets/css/app-tailwind.min.css">
    <link rel="stylesheet" href="assets/vendor/fontawesome/css/all.min.css">
    <link rel="stylesheet" href="assets/css/liquid-glass.css">
    <style>
        .online-payment-modal {
            position: fixed;
            inset: 0;
            z-index: 50;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(2, 6, 23, .82);
            backdrop-filter: blur(10px);
        }
        .online-payment-modal.is-open { display: flex; }
        .online-payment-dialog {
            width: min(100%, 460px);
            max-height: min(90vh, 760px);
            overflow-y: auto;
            padding: 20px;
            border: 1px solid rgba(56, 189, 248, .3);
            border-radius: 22px;
            background: linear-gradient(145deg, rgba(15, 23, 42, .99), rgba(8, 15, 34, .99));
            box-shadow: 0 24px 70px rgba(2, 6, 23, .72), 0 0 30px rgba(34, 211, 238, .1);
        }
        .online-payment-method {
            display: flex;
            min-height: 64px;
            width: 100%;
            align-items: center;
            gap: 12px;
            padding: 11px 13px;
            border: 1px solid rgba(148, 163, 184, .17);
            border-radius: 13px;
            background: rgba(15, 23, 42, .7);
            color: #cbd5e1;
            text-align: left;
            transition: border-color .16s ease, background .16s ease, box-shadow .16s ease;
        }
        .online-payment-method:hover { border-color: rgba(56, 189, 248, .42); }
        .online-payment-method.is-selected {
            border-color: rgba(34, 211, 238, .72);
            background: linear-gradient(105deg, rgba(8, 145, 178, .2), rgba(37, 99, 235, .16));
            box-shadow: 0 0 0 2px rgba(34, 211, 238, .08);
            color: #f8fafc;
        }
        .online-payment-confirm:disabled {
            cursor: not-allowed;
            opacity: .42;
            filter: grayscale(.3);
        }
        .online-order-action {
            position: relative;
            overflow: hidden;
            padding: 9px 10px;
            border: 1px solid transparent;
            border-radius: 13px;
            background:
                linear-gradient(145deg, rgba(15, 23, 42, .97), rgba(8, 15, 34, .94)) padding-box,
                linear-gradient(120deg, var(--action-color), rgba(99, 102, 241, .24)) border-box;
            box-shadow: 0 0 15px var(--action-glow), inset 0 0 12px rgba(255, 255, 255, .015);
        }
        .online-order-action-payment {
            --action-color: rgba(52, 211, 153, .58);
            --action-glow: rgba(16, 185, 129, .08);
        }
        .online-order-action-delivery {
            --action-color: rgba(56, 189, 248, .58);
            --action-glow: rgba(56, 189, 248, .09);
        }
        .online-order-action-main {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }
        .online-order-action-button {
            display: inline-flex;
            min-height: 32px;
            flex: 0 0 auto;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0 10px;
            border: 1px solid var(--action-color);
            border-radius: 9px;
            background: linear-gradient(110deg, rgba(15, 23, 42, .72), rgba(15, 23, 42, .94));
            box-shadow: 0 0 11px var(--action-glow), inset 0 0 8px rgba(255, 255, 255, .025);
            color: #ecfeff;
            font-size: 10px;
            font-weight: 850;
            transition: box-shadow .16s ease, transform .16s ease, filter .16s ease;
        }
        .online-order-action-button:hover {
            transform: translateY(-1px);
            filter: brightness(1.12);
            box-shadow: 0 0 16px var(--action-glow);
        }
        .online-order-action-hint {
            margin-top: 5px;
            color: #94a3b8;
            font-size: 9px;
            line-height: 1.35;
        }
        .online-order-state {
            display: flex;
            min-height: 30px;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 5px 9px;
            border: 1px solid rgba(148, 163, 184, .12);
            border-radius: 9px;
            background: rgba(2, 6, 23, .42);
        }
        .online-order-state-paid { border-color: rgba(52, 211, 153, .22); box-shadow: 0 0 10px rgba(16, 185, 129, .06); }
        .online-order-state-unpaid { border-color: rgba(251, 191, 36, .2); box-shadow: 0 0 10px rgba(245, 158, 11, .05); }
        @media (max-width: 420px) {
            .online-order-action { padding: 8px; }
            .online-order-action-button { padding: 0 8px; font-size: 9px; }
        }
    </style>
    <link rel="stylesheet" href="assets/css/theme.css?v=4">
    <script src="assets/js/theme.js?v=3"></script>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100">
    <div class="liquid-blob-1"></div>
    <div class="liquid-blob-2"></div>
    <header class="liquid-header sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/15 text-sky-300"><i class="fas fa-bag-shopping"></i></span>
            <div class="min-w-0">
                <h1 class="truncate text-sm font-black text-white sm:text-base">ĐƠN ĐẶT ONLINE</h1>
                <p class="truncate text-[11px] text-slate-400"><?= htmlspecialchars($currentUser['fullname']) ?> · Quy trình bếp, thanh toán và giao đơn</p>
            </div>
        </div>
        <nav class="flex shrink-0 items-center gap-2">
            <a href="<?= $currentUser['role'] === 'waiter' ? 'order.php' : 'index.php?pos=1' ?>" class="btn-glass px-3 py-2 text-xs font-bold text-slate-200"><i class="fas fa-arrow-left mr-1"></i><span class="hidden sm:inline">Quay lại</span></a>
            <button type="button" onclick="OnlineOrders.load()" class="btn-glass px-3 py-2 text-xs font-bold text-sky-200" title="Làm mới"><i class="fas fa-rotate"></i><span class="hidden sm:inline"> Làm mới</span></button>
        </nav>
    </header>

    <main class="relative z-10 mx-auto w-full max-w-7xl space-y-4 p-3 sm:p-5">
        <section class="grid gap-3 sm:grid-cols-3">
            <div class="liquid-glass rounded-2xl border border-sky-400/20 p-4">
                <div class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Đang xử lý</div>
                <div id="online-count-active" class="mt-1 text-2xl font-black text-sky-300">—</div>
            </div>
            <div class="liquid-glass rounded-2xl border border-amber-400/20 p-4">
                <div class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Chờ thanh toán</div>
                <div id="online-count-unpaid" class="mt-1 text-2xl font-black text-amber-300">—</div>
            </div>
            <div class="liquid-glass rounded-2xl border border-emerald-400/20 p-4">
                <div class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Chờ giao</div>
                <div id="online-count-ready" class="mt-1 text-2xl font-black text-emerald-300">—</div>
            </div>
        </section>

        <section class="liquid-glass min-h-[50vh] rounded-2xl border border-white/10">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
                <div>
                    <h2 class="text-sm font-black text-white">Danh sách đơn mang về</h2>
                    <p class="mt-1 text-[11px] text-slate-400">Bếp báo xong → phục vụ xác nhận bàn giao thực tế → thu ngân đối soát và xác nhận thanh toán. Hai mốc giao hàng và thanh toán được theo dõi riêng.</p>
                </div>
                <div class="flex gap-1 rounded-xl bg-slate-950/60 p-1">
                    <button id="online-filter-active" type="button" onclick="OnlineOrders.setFilter('active')" class="rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-bold text-sky-200">Đang xử lý</button>
                    <button id="online-filter-all" type="button" onclick="OnlineOrders.setFilter('all')" class="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400">Đơn hôm nay</button>
                </div>
            </div>
            <div id="online-order-message" class="hidden mx-4 mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200"></div>
            <div id="online-orders-ready-banner" class="mx-4 mt-4 hidden rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-indigo-500/10 p-3 shadow-[0_0_24px_rgba(34,211,238,.08)]">
                <div class="flex items-center gap-2 text-xs font-black text-cyan-100">
                    <i class="fas fa-bell animate-pulse text-cyan-300"></i>
                    <span>BẾP ĐÃ BÁO XONG — CẦN BÀN GIAO</span>
                    <span id="online-orders-ready-count" class="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-2 py-0.5 font-mono text-cyan-200">0</span>
                </div>
                <p id="online-orders-ready-text" class="mt-1 pl-5 text-[11px] text-slate-200"></p>
            </div>
            <div id="online-order-list" class="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                <div class="col-span-full py-12 text-center text-sm text-slate-500">Đang tải đơn hàng...</div>
            </div>
        </section>
    </main>
    <div id="online-payment-modal" class="online-payment-modal" role="dialog" aria-modal="true" aria-labelledby="online-payment-title" onclick="if(event.target===this) OnlineOrders.closePayment()">
        <section class="online-payment-dialog">
            <div class="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-300"><i class="fas fa-cash-register"></i></span>
                    <div>
                        <h2 id="online-payment-title" class="text-sm font-black text-white">Xác nhận thanh toán</h2>
                        <p class="mt-1 text-[11px] text-slate-400">Đối soát đơn online trước khi ghi nhận thu tiền</p>
                    </div>
                </div>
                <button type="button" onclick="OnlineOrders.closePayment()" aria-label="Đóng" class="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-lg text-slate-400 hover:text-white">&times;</button>
            </div>
            <div class="mt-4 rounded-xl border border-sky-400/15 bg-slate-950/60 p-3">
                <div class="flex items-center justify-between gap-3 text-xs">
                    <span class="text-slate-400">Mã đơn</span><b id="online-payment-order-code" class="font-mono text-sky-300"></b>
                </div>
                <div class="mt-2 flex items-end justify-between gap-3 border-t border-white/5 pt-2">
                    <span class="text-xs text-slate-400">Số tiền phải nhận</span><b id="online-payment-amount" class="text-xl font-black text-emerald-300"></b>
                </div>
            </div>
            <p class="mt-4 text-xs font-bold text-slate-200">Khách đã thanh toán bằng</p>
            <div class="mt-2 grid gap-2">
                <button type="button" class="online-payment-method is-selected" data-payment-method="banking" onclick="OnlineOrders.selectPaymentMethod('banking')">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300"><i class="fas fa-building-columns"></i></span>
                    <span><b class="block text-xs">Chuyển khoản / VietQR</b><span class="mt-1 block text-[10px] text-slate-400">Chỉ chọn sau khi đã thấy tiền vào tài khoản</span></span>
                    <i class="payment-method-check fas fa-circle-check ml-auto text-sky-300"></i>
                </button>
                <button type="button" class="online-payment-method" data-payment-method="cash" onclick="OnlineOrders.selectPaymentMethod('cash')">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300"><i class="fas fa-money-bill-wave"></i></span>
                    <span><b class="block text-xs">Tiền mặt</b><span class="mt-1 block text-[10px] text-slate-400">Đã nhận đủ tiền mặt từ khách</span></span>
                    <i class="payment-method-check fas fa-circle-check ml-auto hidden text-sky-300"></i>
                </button>
                <button type="button" class="online-payment-method" data-payment-method="card" onclick="OnlineOrders.selectPaymentMethod('card')">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300"><i class="fas fa-credit-card"></i></span>
                    <span><b class="block text-xs">Thẻ / POS</b><span class="mt-1 block text-[10px] text-slate-400">Giao dịch thẻ đã được chấp thuận</span></span>
                    <i class="payment-method-check fas fa-circle-check ml-auto hidden text-sky-300"></i>
                </button>
            </div>
            <label class="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-100">
                <input id="online-payment-verified" type="checkbox" class="mt-0.5 accent-emerald-400" onchange="OnlineOrders.updatePaymentConfirmState()">
                <span>Tôi đã kiểm tra và xác nhận quán thực sự nhận đủ số tiền trên.</span>
            </label>
            <div class="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onclick="OnlineOrders.closePayment()" class="min-h-10 rounded-xl border border-white/10 bg-slate-800/80 text-xs font-bold text-slate-300 hover:bg-slate-700">Hủy</button>
                <button id="online-payment-confirm" type="button" disabled onclick="OnlineOrders.confirmPayment()" class="online-payment-confirm min-h-10 rounded-xl border border-emerald-300/25 bg-gradient-to-r from-emerald-600 to-teal-500 text-xs font-black text-white shadow-lg shadow-emerald-950/30"><i class="fas fa-lock mr-1"></i>Xác nhận đã thu</button>
            </div>
        </section>
    </div>
    <script>
        window.onlineOrderPermissions = <?= json_encode([
            'payment' => $canConfirmPayment,
            'delivery' => $canConfirmDelivery
        ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
    </script>
    <script src="assets/js/online_orders.js?v=4"></script>
    <script src="assets/js/license_ping.js?v=2" data-license-rights="<?= licenseClientMode() ? licenseRightsRevision() : '' ?>"></script>
</body>
</html>
