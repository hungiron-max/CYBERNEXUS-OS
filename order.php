<?php
/**
 * Waiter Mobile Order Screen (Giao diện Nhận Order Cho Nhân Viên Phục Vụ)
 * Touchscreen & Mobile-First Optimized
 */

// Chống lưu bộ nhớ đệm (Cache) trên Safari iPad / Điện thoại
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/config/database.php';

// Authentication & Role check: only waiter (STF) and admin (ADM) allowed
enforceRoleAccess(['admin', 'waiter']);

$currentUser = [
    'id' => $_SESSION['user_id'],
    'user_code' => $_SESSION['user_code'] ?? 'STF001',
    'username' => $_SESSION['username'],
    'fullname' => $_SESSION['fullname'],
    'role' => $_SESSION['user_role']
];

// Determine Server LAN IP for Mobile/Tablet connection
$serverIp = $_SERVER['SERVER_ADDR'] ?? '';
if (empty($serverIp) || $serverIp === '127.0.0.1' || $serverIp === '::1') {
    $serverIp = '10.0.126.159'; // Detected Ethernet IP
}
$serverPort = $_SERVER['SERVER_PORT'] ?? '8080';
$lanUrl = "http://{$serverIp}:{$serverPort}/order.php";
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Nhận Order Bàn - <?= htmlspecialchars(STORE_NAME) ?></title>
    
    <!-- Local Precompiled Tailwind CSS (100% Offline, Instant Rendering) -->
    <link rel="stylesheet" href="assets/css/app-tailwind.min.css">
    <!-- Local FontAwesome 6 Icons (Offline) -->
    <link rel="stylesheet" href="assets/vendor/fontawesome/css/all.min.css">
    <!-- Liquid Glass Custom Styles -->
    <link rel="stylesheet" href="assets/css/liquid-glass.css">
    <style>
        .bottom-sheet {
            transform: translateY(100%);
            transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bottom-sheet.open {
            transform: translateY(0);
        }
    </style>
</head>
<body class="antialiased flex flex-col h-screen overflow-hidden text-slate-100 bg-slate-950">

    <!-- Ambient Floating Orbs -->
    <div class="liquid-blob-1"></div>
    <div class="liquid-blob-2"></div>

    <!-- Top Mobile Header -->
    <header class="liquid-header px-4 py-2.5 flex items-center justify-between z-30 shrink-0 border-b border-white/10">
        <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
                <i class="fas fa-clipboard-list text-sm"></i>
            </div>
            <div>
                <h1 class="font-extrabold text-sm text-white">ORDER PHỤC VỤ</h1>
                <div class="text-[10px] text-slate-400 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>NV: <b class="text-sky-300"><?= htmlspecialchars($currentUser['fullname']) ?></b></span>
                </div>
            </div>
        </div>

        <div class="flex items-center gap-1.5">
            <!-- Sound & Vibration Toggle / Test Button -->
            <button type="button" id="btn-sound-toggle" onclick="testAndToggleSound()" class="w-8 h-8 rounded-lg btn-glass bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/30 flex items-center justify-center p-0 shrink-0" title="Bật/Tắt chuông và rung (Nhấp để thử chuông)">
                <i id="sound-toggle-icon" class="fas fa-volume-high text-xs"></i>
            </button>

            <!-- Kitchen Alert Badge / Bell -->
            <button type="button" id="nav-bell-btn" class="hidden relative w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center" onclick="scrollToReadyTable()">
                <i class="fas fa-bell animate-bounce text-sm"></i>
                <span id="nav-bell-count" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">1</span>
            </button>

            <!-- Nút Mở ĐT (Giữ nút QR, bỏ chữ) -->
            <button type="button" onclick="showLanQrModal()" class="btn-glass text-xs py-1.5 px-2 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border border-purple-500/30 flex items-center justify-center shrink-0" title="Mở Order trên điện thoại / iPad qua Wi-Fi">
                <i class="fas fa-qrcode text-xs"></i>
            </button>

            <!-- Links for Admin Only (Icon gọn gàng trên màn hình hẹp, đầy đủ chữ trên PC lg:) -->
            <?php if ($currentUser['role'] === 'admin'): ?>
                <a href="admin.php" class="btn-glass text-xs py-1.5 px-2 lg:px-2.5 bg-indigo-500/20 text-indigo-300 flex items-center gap-1 font-bold shrink-0 whitespace-nowrap" title="Quản Trị">
                    <i class="fas fa-chart-pie text-xs"></i>
                    <span class="hidden lg:inline">Quản Trị</span>
                </a>
                <a href="index.php?pos=1" class="btn-glass text-xs py-1.5 px-2 lg:px-2.5 bg-emerald-500/20 text-emerald-300 flex items-center gap-1 font-bold shrink-0 whitespace-nowrap" title="POS Thu Ngân">
                    <i class="fas fa-cash-register text-xs"></i>
                    <span class="hidden lg:inline">Thu Ngân</span>
                </a>
                <a href="kitchen.php" class="btn-glass text-xs py-1.5 px-2 lg:px-2.5 bg-amber-500/20 text-amber-300 flex items-center gap-1 font-bold shrink-0 whitespace-nowrap" title="Bếp / Bar">
                    <i class="fas fa-fire-burner text-xs"></i>
                    <span class="hidden lg:inline">Bếp</span>
                </a>
            <?php endif; ?>
            <button type="button" onclick="handleLogout()" class="btn-glass text-xs py-1.5 px-2 lg:px-2.5 bg-rose-500/20 text-rose-300 flex items-center justify-center gap-1 shrink-0 whitespace-nowrap" title="Đăng xuất">
                <i class="fas fa-sign-out-alt text-xs"></i>
                <span class="hidden lg:inline">Thoát</span>
            </button>
        </div>
    </header>

    <!-- Audio element for mobile sound chime with static source -->
    <audio id="waiter-sound-chime" src="assets/sounds/dingdong.wav" preload="auto" playsinline></audio>

    <!-- Banner kích hoạt chuông trên điện thoại (đặc biệt cho Safari iOS & Chrome Android) -->
    <div id="audio-activate-banner" onclick="activateMobileAudio(true)" class="mx-3 mt-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold text-xs flex items-center justify-between cursor-pointer shadow-lg active:scale-98 transition-all z-40">
        <div class="flex items-center gap-2">
            <i class="fas fa-volume-high text-base text-slate-900 animate-pulse"></i>
            <span>Chạm để BẬT chuông & rung thông báo</span>
        </div>
        <span class="px-2.5 py-1 rounded-lg bg-slate-950 text-amber-300 text-[10px] uppercase font-black tracking-wider">Kích hoạt</span>
    </div>

    <!-- Sound Enabled Toast Notification -->
    <div id="sound-toast" class="hidden shrink-0 mx-3 mt-2 p-2.5 rounded-xl bg-slate-900/95 text-amber-300 border border-amber-500/40 text-xs flex items-center justify-between z-40 shadow-xl transition-all">
        <span id="sound-toast-text" class="flex items-center gap-2"><i class="fas fa-bell"></i> Chuông & rung đã sẵn sàng!</span>
    </div>

    <!-- Real-time Kitchen Notification Toast Banner -->
    <div id="kitchen-alert-banner" class="hidden shrink-0 mx-3 mt-2 p-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-xl border border-amber-300 flex items-center justify-between z-40">
        <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-white text-amber-600 flex items-center justify-center text-lg shadow shrink-0">
                <i class="fas fa-bell animate-bounce"></i>
            </div>
            <div>
                <div class="text-[11px] uppercase tracking-wider font-black text-slate-900">🔔 BẾP BÁO XONG MÓN!</div>
                <div id="kitchen-alert-text" class="text-xs font-extrabold text-slate-950">Bàn MV1 đã sẵn sàng</div>
            </div>
        </div>
        <button type="button" id="btn-alert-serve" class="px-3 py-1.5 rounded-xl bg-slate-950 text-amber-300 text-xs font-black shadow-md active:scale-95 shrink-0">
            ĐÃ BƯNG RA
        </button>
    </div>

    <!-- Real-time Kitchen Cancel/Reject Item Toast Banner -->
    <div id="kitchen-cancel-banner" class="hidden shrink-0 mx-3 mt-2 p-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-xl shadow-rose-950/40 border border-rose-400 flex items-center justify-between z-40 animate-pulse">
        <div class="flex items-center gap-2.5 min-w-0 pr-2">
            <div id="kitchen-cancel-icon-bg" class="w-9 h-9 rounded-xl bg-white text-rose-600 flex items-center justify-center text-lg shadow shrink-0">
                <i id="kitchen-cancel-icon" class="fas fa-triangle-exclamation"></i>
            </div>
            <div class="min-w-0">
                <div id="kitchen-cancel-title" class="text-[11px] uppercase tracking-wider font-black text-rose-100 flex items-center gap-1">
                    ⚠️ BẾP HỦY MÓN TRÊN HÓA ĐƠN
                </div>
                <div id="kitchen-cancel-text" class="text-xs font-bold text-white leading-snug line-clamp-2">Bàn MV1: Mì Gói Bò đã hủy</div>
            </div>
        </div>
        <button type="button" id="btn-cancel-ack" onclick="ackKitchenCancellation()" class="px-3 py-1.5 rounded-xl bg-slate-950 text-amber-300 text-xs font-black shadow-md active:scale-95 shrink-0">
            ĐÃ HIỂU
        </button>
    </div>

    <!-- STEP 1: Sơ Đồ Bàn (Table Selector View) -->
    <section id="view-tables" class="flex-1 flex flex-col p-3 overflow-y-auto space-y-3 z-10">
        <!-- Area Filter Tabs -->
        <div class="flex rounded-xl bg-slate-900/80 p-1 border border-white/10 shrink-0">
            <button type="button" class="flex-1 py-1.5 text-xs font-bold rounded-lg text-white bg-sky-500 shadow-md transition-all" id="btn-tab-all" onclick="filterTablesArea('all')">
                Tất Cả (<span id="count-all-tables">0</span>)
            </button>
            <button type="button" class="flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition-all" id="btn-tab-tq" onclick="filterTablesArea('TAI_QUAN')">
                Tại Quán (<span id="count-tq-tables">0</span>)
            </button>
            <button type="button" class="flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition-all" id="btn-tab-mv" onclick="filterTablesArea('MANG_VE')">
                Mang Về (<span id="count-mv-tables">0</span>)
            </button>
        </div>

        <!-- Legend / Notes -->
        <div class="flex items-center justify-between text-[11px] px-1 text-slate-400">
            <div class="flex items-center gap-3">
                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Bàn trống</span>
                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Có khách</span>
            </div>
            <button type="button" onclick="loadTablesData()" class="text-sky-400 hover:underline">
                <i class="fas fa-sync-alt mr-1"></i> Làm mới
            </button>
        </div>

        <!-- Tables Grid -->
        <div id="waiter-tables-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pb-6">
            <!-- Loaded dynamically -->
        </div>
    </section>

    <!-- STEP 2: Màn Hình Chọn Món Cho Bàn Đã Chọn (Order Taking View) -->
    <section id="view-order" class="hidden flex-1 flex flex-col overflow-hidden z-10">
        
        <!-- Active Table Info Subheader -->
        <div class="p-2.5 bg-slate-900/90 border-b border-white/10 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
                <button type="button" onclick="backToTablesView()" class="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-xs">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div>
                    <h2 id="active-table-title" class="font-extrabold text-sm text-sky-400">BÀN: TQ1</h2>
                    <span id="active-table-status" class="text-[11px] text-slate-400">Khách mới</span>
                </div>
            </div>

            <div class="flex items-center gap-2">
                <div class="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-white/10 text-xs">
                    <span class="text-slate-400">Số khách:</span>
                    <button type="button" class="w-5 h-5 bg-slate-700 rounded text-xs" onclick="adjustGuestCount(-1)">-</button>
                    <span id="order-guest-count" class="font-bold text-sky-400 w-5 text-center">1</span>
                    <button type="button" class="w-5 h-5 bg-slate-700 rounded text-xs" onclick="adjustGuestCount(1)">+</button>
                </div>
            </div>
        </div>

        <!-- Search & Categories Pills Carousel -->
        <div class="p-2 bg-slate-950/70 border-b border-white/10 space-y-2 shrink-0">
            <div class="relative">
                <i class="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                <input type="text" id="order-search" oninput="renderOrderProducts()" placeholder="Tìm món nhanh (trà sữa, cafe, bánh mì...)" class="liquid-input w-full pl-8 text-xs py-1.5" />
            </div>
            <div id="order-categories-list" class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <!-- Categories rendered dynamically -->
            </div>
        </div>

        <!-- Products Grid (Tap to Add) -->
        <div class="flex-1 overflow-y-auto p-2 pb-24">
            <div id="order-products-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                <!-- Products rendered dynamically -->
            </div>
        </div>

        <!-- Floating Cart Bar (Bottom sticky) -->
        <div class="fixed bottom-0 left-0 right-0 p-3 bg-slate-950/95 backdrop-blur-md border-t border-white/10 z-40">
            <div class="max-w-2xl mx-auto flex items-center justify-between gap-2">
                <button type="button" onclick="openCartBottomSheet()" class="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900 border border-sky-500/30 hover:border-sky-400">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold font-mono">
                            <span id="cart-badge-count">0</span>
                        </div>
                        <div class="text-left">
                            <div class="text-xs font-bold text-slate-200">Chi tiết giỏ món</div>
                            <div id="cart-items-status-text" class="text-[10px] text-slate-400 font-mono">Chưa chọn món mới</div>
                        </div>
                    </div>
                    <span id="cart-bottom-total" class="font-black text-sm text-emerald-400 font-mono">0 đ</span>
                </button>

                <!-- VietQR Quick Button -->
                <button type="button" onclick="showWaiterVietQr()" id="btn-float-vietqr" class="btn-glass py-2.5 px-3 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border-purple-500/40 font-bold text-xs flex items-center gap-1 shadow-md shadow-purple-600/10" title="Mã VietQR thanh toán cho bàn này">
                    <i class="fas fa-qrcode text-sm"></i>
                    <span>VietQR</span>
                </button>

                <!-- Send to kitchen button (Only visible when there are new items!) -->
                <button type="button" id="btn-float-send-kitchen" onclick="sendOrderToKitchen()" class="hidden btn-glass-success py-2.5 px-4 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/30">
                    <i class="fas fa-paper-plane"></i>
                    <span id="btn-float-send-text">Gửi Bếp</span>
                </button>
            </div>
        </div>
    </section>

    <!-- Bottom Sheet: Cart Details & Notes Modal -->
    <div id="cart-sheet-overlay" class="liquid-modal-overlay">
        <div class="liquid-glass bottom-sheet w-full max-w-2xl mx-auto rounded-t-3xl max-h-[88vh] flex flex-col p-4 border-t border-sky-500/40 shadow-2xl">
            <div class="flex justify-between items-center pb-2 border-b border-white/10">
                <div class="flex items-center gap-2">
                    <span class="w-8 h-1 rounded-full bg-slate-600 block"></span>
                    <h3 class="font-bold text-sm text-sky-400">Danh Sách Món Tại Bàn</h3>
                </div>
                <button type="button" class="text-slate-400 hover:text-white text-2xl p-1" onclick="closeCartBottomSheet()">&times;</button>
            </div>

            <!-- Items list -->
            <div id="cart-sheet-items" class="flex-1 overflow-y-auto py-3 space-y-3">
                <!-- Cart items divided into Confirmed (locked/faded) and New (editable) -->
            </div>

            <!-- Cart Footer -->
            <div class="pt-3 border-t border-white/10 space-y-3">
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-400 font-medium">TỔNG CỘNG HÓA ĐƠN:</span>
                    <span id="cart-sheet-total" class="font-black text-lg text-emerald-400 font-mono">0 đ</span>
                </div>
                <div class="flex items-center gap-2" id="cart-sheet-action-grid">
                    <!-- Ô "SL: " kế bên ô "Thêm món" -->
                    <div class="px-3 py-2.5 rounded-xl bg-slate-900 border border-sky-500/40 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-md">
                        <span class="text-slate-400 font-normal mr-1">SL:</span>
                        <span id="cart-sheet-total-qty" class="text-sky-400 font-black text-sm">0</span>
                    </div>
                    <button type="button" class="flex-1 btn-glass text-xs py-2.5 text-slate-300 font-bold" onclick="closeCartBottomSheet()">Thêm món</button>
                    <button type="button" onclick="showWaiterVietQr()" class="btn-glass text-xs py-2.5 px-3 bg-purple-600/20 text-purple-300 border-purple-500/40 font-bold flex items-center justify-center gap-1 shrink-0">
                        <i class="fas fa-qrcode"></i> VietQR
                    </button>
                    <!-- Confirm button: hidden if no new items added -->
                    <button type="button" id="btn-sheet-submit" class="hidden flex-1 btn-glass-success text-xs py-2.5 font-bold flex items-center justify-center gap-1.5" onclick="sendOrderToKitchen()">
                        <i class="fas fa-check-circle"></i> <span id="btn-sheet-submit-text">Gửi Bếp</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal: VietQR Popup -->
    <div id="waiter-vietqr-modal" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content p-5 w-96 max-w-full text-white shadow-2xl border border-purple-500/40 rounded-2xl relative">
            <div class="flex justify-between items-center pb-2 border-b border-white/10 mb-3">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                        <i class="fas fa-qrcode text-base"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-sm text-purple-300">VIETQR THANH TOÁN</h3>
                        <p id="vqr-table-code" class="text-[10px] text-slate-400 font-mono">Bàn MV1</p>
                    </div>
                </div>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="closeWaiterVietQr()">&times;</button>
            </div>

            <!-- QR Image & Bank details -->
            <div class="flex flex-col items-center">
                <div class="bg-white p-2.5 rounded-xl shadow-lg border border-purple-500/30 flex items-center justify-center mb-3">
                    <img id="vqr-image" src="" alt="VietQR" class="w-56 h-56 object-contain" />
                </div>

                <div class="w-full space-y-1.5 text-xs bg-slate-900/80 p-3 rounded-xl border border-white/10 font-mono">
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 font-sans">Số tiền:</span>
                        <span id="vqr-amount" class="text-emerald-400 font-black text-base font-mono">0 đ</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 font-sans">Chủ TK:</span>
                        <span id="vqr-acc-name" class="text-slate-200 font-bold"><?= defined('VIETQR_ACCOUNT_NAME') ? VIETQR_ACCOUNT_NAME : 'NGUYEN VAN PHAT' ?></span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 font-sans">STK (<?= defined('VIETQR_BANK_ID') ? VIETQR_BANK_ID : 'MB' ?>):</span>
                        <span id="vqr-acc-no" class="text-amber-300 font-bold"><?= defined('VIETQR_ACCOUNT_NO') ? VIETQR_ACCOUNT_NO : '0967041111' ?></span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 font-sans">Nội dung CK:</span>
                        <span id="vqr-note" class="text-sky-300 font-bold">TT Bàn</span>
                    </div>
                </div>
            </div>

            <div class="flex justify-end gap-2 mt-4 pt-2 border-t border-white/10">
                <button type="button" class="btn-glass text-xs py-2 px-4 w-full" onclick="closeWaiterVietQr()">Đóng</button>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script>
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
                    allTables = data.data;
                    renderTables();
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
                            cancelTitle.innerText = latest.title || (isReject ? '⚠️ BẾP TỪ CHỐI HỦY MÓN' : '⚠️ BẾP HỦY MÓN TRÊN HÓA ĐƠN');
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

                // Check direct kitchen_ready alerts (Bếp báo xong món / Báo lại chuông)
                if (notifData && notifData.ready_alerts && notifData.ready_alerts.length > 0) {
                    let hasNewBell = false;
                    if (!window.knownReadyAlertIds) window.knownReadyAlertIds = new Set();

                    notifData.ready_alerts.forEach(alertItem => {
                        if (!window.knownReadyAlertIds.has(alertItem.id)) {
                            hasNewBell = true;
                            window.knownReadyAlertIds.add(alertItem.id);
                            // Mark read in background
                            fetch(`api/orders.php?action=ack_notification&notification_id=${alertItem.id}&role=waiter`, { method: 'POST' }).catch(() => {});
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
                } catch(e) {}
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
                } catch(e) {}
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
            } catch(e) {}

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
                        toastText.innerHTML = '<i class="fas fa-bell text-emerald-400"></i> Đang phát thử chuông! <b>(Nếu không nghe, hãy bật gạt âm thanh bên hông iPhone)</b>';
                    } else {
                        toastText.innerHTML = '<i class="fas fa-bell text-emerald-400"></i> Đang phát thử chuông & rung thông báo!';
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
            } catch(e) {}
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
                    if (p && p.catch) p.catch(() => {});
                }
            } catch(e) {}

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
            } catch(e) {}
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
                btn.title = 'Chuông: ĐANG BẬT (Bấm để thử chuông)';
            } else {
                btn.className = 'w-8 h-8 rounded-lg btn-glass bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 flex items-center justify-center p-0 shrink-0';
                icon.className = 'fas fa-volume-xmark text-xs';
                btn.title = 'Chuông: ĐANG TẮT (Bấm để bật)';
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
                    alert(data.message || 'Lỗi thao tác');
                }
            } catch(e) {
                console.error(e);
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
                alertText.innerText = `Bàn ${firstReady.code} (${firstReady.name}) - Bếp đã xong món!`;
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
                const isReady = t.kitchen_status === 'ready';
                const isPaid = (t.payment_status === 'paid' || Boolean(t.paid_at));
                const isServed = (t.kitchen_status === 'served' || Boolean(t.served_at));

                let cardBorderClass = 'border-emerald-500/30 hover:border-sky-400';
                if (isReady) {
                    cardBorderClass = 'border-amber-400 bg-amber-950/40 shadow-xl shadow-amber-500/20 ring-2 ring-amber-400 animate-pulse';
                } else if (isOcc) {
                    cardBorderClass = isPaid 
                        ? 'border-teal-500/50 bg-teal-950/20 shadow-teal-900/20' 
                        : 'border-rose-500/50 bg-rose-950/20 shadow-rose-900/20';
                }

                let badgeHtml = '';
                if (isReady) {
                    badgeHtml = '<span class="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] animate-bounce">🔔 XONG MÓN</span>';
                } else if (isOcc) {
                    if (isPaid) {
                        if (isServed) {
                            badgeHtml = '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[9px] flex items-center gap-0.5">🍽️ Đã bưng</span>';
                        } else {
                            badgeHtml = '<span class="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold text-[9px] flex items-center gap-0.5"><i class="fas fa-money-bill-wave text-[8px]"></i> Đã TT</span>';
                        }
                    } else {
                        if (isServed) {
                            badgeHtml = '<span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold text-[9px] flex items-center gap-0.5">🍽️ Đã bưng</span>';
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
                            <span class="font-black text-sm text-white">${t.code}</span>
                            ${badgeHtml}
                        </div>
                        <div class="text-[11px] text-slate-300 font-medium truncate">${t.name}</div>
                        <div class="pt-1.5 border-t border-white/5 flex items-center justify-between text-xs font-bold font-mono">
                            ${isReady ? `
                                <span class="text-amber-300 font-bold text-[11px] truncate">${formatMoney(t.total_amount)}đ</span>
                                <button type="button" class="px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] shadow active:scale-90 flex items-center gap-1 shrink-0" onclick="event.stopPropagation(); confirmDelivered(${t.active_order_id}, '${t.code}')">
                                    <i class="fas fa-check"></i> ĐÃ BƯNG RA
                                </button>
                            ` : `
                                <span class="${isOcc ? (isPaid ? 'text-teal-300' : 'text-amber-300') : 'text-emerald-400'} truncate font-bold text-xs">
                                    ${isOcc ? formatMoney(t.total_amount) + 'đ' : 'Trống'}
                                </span>
                                <span class="text-[10px] text-slate-400 font-normal shrink-0 ml-1">
                                    ${isOcc ? (t.item_count + ' món') : 'Vào bàn'}
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
            document.getElementById('active-table-title').innerText = `BÀN: ${found.code} (${found.name})`;

            // If table has active order, load it
            if (found.status === 'occupied' && found.active_order_id) {
                document.getElementById('active-table-status').innerText = 'Đang phục vụ (Bấm thực đơn để thêm món)';
                await loadExistingTableOrder(found.active_order_id);
            } else {
                document.getElementById('active-table-status').innerText = 'Bàn trống (Chọn món để mở bàn)';
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
            } catch (e) {}
        }

        async function loadProductsData() {
            try {
                const res = await fetch('api/products.php');
                const data = await res.json();
                if (data.success) {
                    products = data.data;
                    toppings = products.filter(p => p.is_topping == 1);
                }
            } catch (e) {}
        }

        function renderOrderCategories() {
            const container = document.getElementById('order-categories-list');
            if (!container) return;

            let html = `
                <button type="button" class="px-3 py-1 rounded-full whitespace-nowrap font-bold text-xs ${selectedCategory === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300'}" onclick="setOrderCategory('all')">
                    Tất Cả
                </button>
            `;

            categories.forEach(c => {
                const isAct = selectedCategory == c.id;
                html += `
                    <button type="button" class="px-3 py-1 rounded-full whitespace-nowrap font-bold text-xs ${isAct ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300'}" onclick="setOrderCategory(${c.id})">
                        ${c.name}
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
                html += `
                    <div class="liquid-glass-card p-2 sm:p-2.5 flex flex-col justify-between transition-transform ${isLocked ? 'opacity-50 grayscale border-rose-500/40 bg-rose-950/20 cursor-not-allowed' : 'cursor-pointer border border-white/10 active:scale-95 hover:border-sky-400/40'}" onclick="${isLocked ? `alert('Món [${p.name.replace(/'/g, "\\'")}] hiện đang TẠM KHÓA do hết hàng!')` : `addItemToCart(${p.id})`}">
                        <div>
                            <!-- Dish Thumbnail Image: 4:3 Aspect Ratio for Full View -->
                            <div class="relative w-full aspect-[4/3] mb-1.5 rounded-xl overflow-hidden bg-slate-950 border border-white/10 flex items-center justify-center">
                                <img src="${imgUrl}" alt="${p.name}" class="w-full h-full object-cover object-center" onerror="this.onerror=null;this.src='assets/images/dishes/default_dish.jpg';" loading="lazy" />
                                <div class="absolute top-1.5 left-1.5 pointer-events-none">
                                    <span class="text-[9px] font-mono font-bold text-sky-400 bg-slate-950/85 backdrop-blur-md px-1.5 py-0.5 rounded border border-sky-500/30">${p.code || 'SP'}</span>
                                </div>
                                <div class="absolute top-1.5 right-1.5 pointer-events-none">
                                    ${isLocked ? '<span class="text-[8px] font-bold text-rose-300 bg-rose-950/90 px-1 rounded border border-rose-500/40">🚫 HẾT</span>' : `<span class="text-[9px] text-slate-300 bg-slate-950/85 backdrop-blur-md px-1 rounded border border-white/10 capitalize">${p.unit || 'ly'}</span>`}
                                </div>
                            </div>
                            <h4 class="font-bold text-xs ${isLocked ? 'text-slate-400 line-through' : 'text-white'} line-clamp-2 leading-snug min-h-[2rem]">${p.name}</h4>
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
            document.getElementById('cart-bottom-total').innerText = formatMoney(totalMoney) + ' đ';
            document.getElementById('cart-sheet-total').innerText = formatMoney(totalMoney) + ' đ';
            const sheetQtyEl = document.getElementById('cart-sheet-total-qty');
            if (sheetQtyEl) sheetQtyEl.innerText = totalQty;

            // Status text in bottom bar
            const statusEl = document.getElementById('cart-items-status-text');
            if (statusEl) {
                if (newQty > 0) {
                    statusEl.innerText = `Đang chọn thêm +${newQty} món mới`;
                    statusEl.className = 'text-[10px] text-amber-300 font-bold font-mono';
                } else if (confirmedQty > 0) {
                    statusEl.innerText = `Đã có ${confirmedQty} món (chưa thêm món)`;
                    statusEl.className = 'text-[10px] text-slate-400 font-mono';
                } else {
                    statusEl.innerText = 'Chưa chọn món nào';
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
                    if (txtFloat) txtFloat.innerText = `Gửi Bếp (+${newQty})`;
                }
                if (btnSheet) {
                    btnSheet.classList.remove('hidden');
                    if (txtSheet) txtSheet.innerText = `Xác Nhận & Gửi Bếp (+${newQty} món)`;
                }
            }

            renderCartSheetItems();
        }

        function renderCartSheetItems() {
            const container = document.getElementById('cart-sheet-items');
            if (!container) return;

            if (existingConfirmedItems.length === 0 && newCartItems.length === 0) {
                container.innerHTML = '<div class="text-xs text-slate-500 py-8 text-center">Bàn chưa có món nào. Chạm món trên thực đơn để gọi món!</div>';
                return;
            }

            let html = '';

            // SECTION 1: Các món đã xác nhận trước đó (MỜ, KHÔNG THỂ SỬA BỞI PHỤC VỤ)
            if (existingConfirmedItems.length > 0) {
                const confirmedTotalQty = existingConfirmedItems.reduce((sum, it) => sum + it.quantity, 0);
                const isAlreadyServed = (activeOrderKitchenStatus === 'served' || activeOrderStatus === 'completed' || (currentTable && currentTable.kitchen_status === 'served'));

                html += `
                    <div class="space-y-2">
                        <div class="flex items-center justify-between pb-1 text-xs border-b border-white/5 font-bold">
                            <span class="text-slate-300 flex items-center gap-1.5">
                                <i class="fas ${isAlreadyServed ? 'fa-check-circle text-emerald-400' : 'fa-clock-rotate-left text-sky-400'}"></i>
                                Món Đã Xác Nhận & Gửi Bếp (${existingConfirmedItems.length} món • SL: ${confirmedTotalQty})
                            </span>
                            <span class="text-[10px] px-2 py-0.5 rounded ${isAlreadyServed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'} font-bold">
                                ${isAlreadyServed ? '✅ Đã bưng ra bàn' : '🔒 Đã khóa (Không sửa)'}
                            </span>
                        </div>
                `;

                existingConfirmedItems.forEach((it, idx) => {
                    const topSum = (it.toppings || []).reduce((a, b) => a + (parseFloat(b.price) || 0), 0);
                    const sub = (it.price + topSum) * it.quantity;
                    const noteStr = (it.note || '').trim();
                    const isRejected = noteStr.includes('Đã làm') || noteStr.includes('Đã chế biến') || noteStr.includes('Giữ nguyên món');
                    const isCancelNote = !isRejected && /hủy|huy/i.test(noteStr);

                    html += `
                        <div class="p-2.5 rounded-xl ${isCancelNote ? 'bg-amber-950/20 border border-amber-500/40' : (isRejected ? 'bg-rose-950/15 border border-rose-500/30' : 'bg-slate-900/60 border border-white/5 opacity-80')} flex items-center justify-between transition-all">
                            <div class="space-y-0.5 flex-1 pr-2">
                                <div class="flex items-center gap-2">
                                    <span class="text-slate-400 font-mono text-[11px]">#${idx + 1}</span>
                                    <h5 class="font-bold text-xs text-slate-200">${it.name}</h5>
                                </div>
                                <div class="text-[11px] text-slate-400 font-mono">
                                    ${formatMoney(it.price + topSum)} đ / ${it.unit || 'phần'}
                                    ${it.note ? (
                                        isCancelNote
                                            ? `<span class="ml-2 text-[10px] text-amber-300 font-bold bg-amber-950/70 border border-amber-500/40 px-1.5 py-0.5 rounded">⚠️ Đang chờ bếp duyệt (${it.note})</span>`
                                            : (isRejected
                                                ? `<span class="ml-2 text-[10px] text-rose-300 font-bold bg-rose-950/70 border border-rose-500/40 px-1.5 py-0.5 rounded">🔒 ${it.note}</span>`
                                                : `<span class="ml-2 text-[10px] text-amber-300 italic">(${it.note})</span>`)
                                    ) : ''}
                                </div>
                            </div>

                            <div class="flex items-center gap-1.5 shrink-0">
                                ${!isAlreadyServed ? `
                                    <button type="button" class="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 active:scale-90 flex items-center gap-1 cursor-pointer" onclick="event.stopPropagation(); addNoteToConfirmedItem(${it.order_item_id || it.id})" title="Bổ sung ghi chú gửi bếp">
                                        <i class="fas fa-comment-dots text-[10px]"></i>
                                        <span>${it.note ? 'Sửa GC' : 'Ghi chú'}</span>
                                    </button>
                                    <button type="button" class="text-xs px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 active:scale-90 flex items-center gap-1 cursor-pointer" onclick="event.stopPropagation(); requestCancelConfirmedItem(${it.order_item_id || it.id})" title="Báo bếp xin hủy món">
                                        <i class="fas fa-ban text-[10px]"></i>
                                        <span>Báo Hủy</span>
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
                                ✨ Chờ gửi bếp
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
                                        <i class="fas fa-pen text-[10px]"></i> Ghi chú
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

        function addNoteToItem(idx) {
            const it = newCartItems[idx];
            if (!it) return;
            const note = prompt(`Nhập ghi chú cho "${it.name}" (ví dụ: ít ngọt, nhiều đá, không hành):`, it.note || '');
            if (note !== null) {
                it.note = note.trim();
                updateCartUI();
            }
        }

        async function addNoteToConfirmedItem(orderItemId) {
            const item = existingConfirmedItems.find(it => (it.order_item_id === orderItemId || it.id === orderItemId));
            if (!item) return;

            const currentNote = item.note || '';
            const newNote = prompt(`Bổ sung / cập nhật ghi chú cho "${item.name}" gửi bếp:\n(Ví dụ: không cay, ít ngọt, nhiều đá, làm nhanh... hoặc ghi 'Hủy' nếu khách muốn hủy món)`, currentNote);
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
                    alert(data.message || 'Lỗi khi cập nhật ghi chú');
                }
            } catch(e) {
                console.error(e);
                alert('Lỗi kết nối máy chủ');
            }
        }

        async function requestCancelConfirmedItem(orderItemId) {
            const item = existingConfirmedItems.find(it => (it.order_item_id === orderItemId || it.id === orderItemId));
            if (!item) return;

            const reason = prompt(`Nhập lý do xin hủy món "${item.name}" gửi bếp duyệt:\n(Bếp sẽ thấy nút [Đồng ý] để duyệt hủy món khỏi hóa đơn)`, 'Khách xin hủy');
            if (reason === null) return;
            const finalReason = reason.trim() || 'Khách xin hủy';
            const noteToSend = /hủy|huy/i.test(finalReason) ? finalReason : `Hủy: ${finalReason}`;

            try {
                const res = await fetch('api/orders.php?action=update_item_note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        item_id: item.order_item_id || item.id,
                        note: noteToSend
                    })
                });
                const data = await res.json();
                if (data.success) {
                    item.note = noteToSend;
                    renderCartSheetItems();
                    alert(`✅ Đã gửi ghi chú xin hủy món "${item.name}" đến bếp!\nMàn hình Bếp đã hiển thị nút [Đồng ý] để duyệt hủy.`);
                } else {
                    alert(data.message || 'Lỗi khi gửi yêu cầu hủy');
                }
            } catch(e) {
                console.error(e);
                alert('Lỗi kết nối máy chủ');
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
                alert('Vui lòng chọn thêm ít nhất 1 món mới trên thực đơn để gửi bếp!');
                return;
            }

            const isAppending = existingConfirmedItems.length > 0 && activeOrderId;

            const payload = {
                table_id: currentTable.id,
                table_code: currentTable.code,
                customer_name: 'Khách tại bàn',
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
                        ? `✅ Đã gửi thêm ${newCartItems.length} món mới cho bếp thành công!\nHóa đơn bàn ${currentTable.code} đã được cộng dồn.`
                        : `✅ Đã gửi order thành công cho ${currentTable.code}! Đơn hàng đã được tạo và chuyển đến bếp.`;
                    alert(msg);
                    closeCartBottomSheet();
                    backToTablesView();
                } else {
                    alert(data.message || 'Lỗi khi gửi order');
                }
            } catch (e) {
                alert('Lỗi kết nối máy chủ');
            }
        }

        // 6. VietQR Popup Functions
        async function showWaiterVietQr() {
            if (!currentTable) return;
            const confirmedMoney = existingConfirmedItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
            const newMoney = newCartItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
            const totalMoney = confirmedMoney + newMoney;

            if (totalMoney <= 0) {
                alert('Bàn này chưa có món nào để tạo mã VietQR!');
                return;
            }

            try {
                let url = `api/orders.php?action=vietqr&table_id=${currentTable.id}&amount=${totalMoney}&order_code=${currentTable.code}`;
                if (activeOrderId) url += `&order_id=${activeOrderId}`;

                const res = await fetch(url);
                const data = await res.json();
                if (data.success) {
                    document.getElementById('vqr-image').src = data.vietqr_url;
                    document.getElementById('vqr-amount').innerText = formatMoney(data.amount) + ' đ';
                    document.getElementById('vqr-table-code').innerText = `Bàn: ${currentTable.code} - ${currentTable.name}`;
                    document.getElementById('vqr-note').innerText = data.note;
                    if (document.getElementById('vqr-acc-no')) document.getElementById('vqr-acc-no').innerText = data.account_no;
                    if (document.getElementById('vqr-acc-name')) document.getElementById('vqr-acc-name').innerText = data.account_name;

                    document.getElementById('waiter-vietqr-modal').classList.add('open');
                } else {
                    alert(data.message || 'Không thể tạo mã VietQR');
                }
            } catch(e) {
                console.error(e);
                alert('Lỗi kết nối khi tải mã VietQR');
            }
        }

        function closeWaiterVietQr() {
            const modal = document.getElementById('waiter-vietqr-modal');
            if (modal) modal.classList.remove('open');
        }

        function showLanQrModal() {
            document.getElementById('lan-qr-modal').classList.add('open');
        }

        function closeLanQrModal() {
            document.getElementById('lan-qr-modal').classList.remove('open');
        }

        async function handleLogout() {
            if (!confirm('Đăng xuất khỏi tài khoản phục vụ?')) return;
            await fetch('api/auth.php?action=logout');
            window.location = 'index.php';
        }

        document.addEventListener('DOMContentLoaded', () => {
            try {
                init();
                // Định kỳ gửi heartbeat giữ trạng thái trực tuyến cho nhân viên phục vụ
                function sendOrderHeartbeat() {
                    fetch('api/auth.php?action=heartbeat').catch(() => {});
                }
                setInterval(sendOrderHeartbeat, 45000);
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

            // Tự động kiểm tra trạng thái bếp & cập nhật bàn mỗi 3.5 giây liên tục
            // Chạy xuyên suốt cả khi đang xem danh sách bàn lẫn khi đang chọn món order
            setInterval(async () => {
                try {
                    await loadTablesData();
                } catch (pollErr) {
                    console.error('Polling error:', pollErr);
                }
            }, 3500);
        });
    </script>

    <!-- LAN / Mobile QR Code Modal -->
    <div id="lan-qr-modal" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content p-6 w-96 max-w-[90vw] text-white shadow-2xl border border-sky-500/40 text-center">
            <div class="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                <h3 class="font-bold text-base text-sky-400 flex items-center gap-2">
                    <i class="fas fa-qrcode"></i> Mở Order Trên Điện Thoại
                </h3>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="closeLanQrModal()">&times;</button>
            </div>
            
            <p class="text-xs text-slate-300 mb-3">Kết nối điện thoại cùng mạng Wi-Fi và quét mã bên dưới để mở giao diện Order:</p>
            
            <div class="bg-white p-3 rounded-xl inline-block shadow-lg mb-3">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=<?= urlencode($lanUrl) ?>" alt="QR Order LAN" class="w-44 h-44 mx-auto" />
            </div>

            <div class="bg-slate-900/80 p-2.5 rounded-xl border border-sky-500/20 text-xs mb-3 text-left">
                <div class="text-slate-400 mb-1">Hoặc gõ URL trên trình duyệt điện thoại:</div>
                <div class="font-mono font-bold text-emerald-400 text-sm select-all break-all"><?= htmlspecialchars($lanUrl) ?></div>
            </div>

            <div class="mt-4 flex justify-end">
                <button type="button" class="btn-glass text-xs py-2 px-4" onclick="closeLanQrModal()">Đóng</button>
            </div>
        </div>
    </div>
</body>
</html>

