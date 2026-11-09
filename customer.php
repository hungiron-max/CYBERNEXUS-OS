<?php
/**
 * Customer Screen (Giao diện Dành Cho Khách Hàng - Mã USR)
 * Hiển thị tên quán, thông tin quảng cáo, ưu đãi & thực đơn điện tử
 */

require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();

// Session status
$isLoggedIn = isset($_SESSION['user_id']);
$currentUser = $isLoggedIn ? [
    'id' => $_SESSION['user_id'],
    'user_code' => $_SESSION['user_code'] ?? 'USR001',
    'username' => $_SESSION['username'],
    'fullname' => $_SESSION['fullname'],
    'role' => $_SESSION['user_role']
] : null;

// Fetch categories & active products for digital menu
$categories = $pdo->query("SELECT * FROM categories WHERE status = 'active' ORDER BY sort_order ASC, id ASC")->fetchAll(PDO::FETCH_ASSOC);
$products = $pdo->query("SELECT * FROM products WHERE status = 'active' AND is_topping = 0 ORDER BY category_id ASC, id ASC")->fetchAll(PDO::FETCH_ASSOC);

// Determine Server LAN IP
$serverIp = $_SERVER['SERVER_ADDR'] ?? '';
if (empty($serverIp) || $serverIp === '127.0.0.1' || $serverIp === '::1') {
    $serverIp = '10.0.126.159';
}
$serverPort = $_SERVER['SERVER_PORT'] ?? '8080';
$lanUrl = "http://{$serverIp}:{$serverPort}/customer.php";
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title><?= htmlspecialchars(STORE_NAME) ?> - Chào Mừng Quý Khách</title>
    
    <!-- Local Precompiled Tailwind CSS (100% Offline, Instant Rendering) -->
    <link rel="stylesheet" href="assets/css/app-tailwind.min.css">
    <!-- Local FontAwesome 6 Icons (Offline) -->
    <link rel="stylesheet" href="assets/vendor/fontawesome/css/all.min.css">
    
    <!-- Liquid Glass Custom Styles -->
    <style>
        body {
            background: radial-gradient(circle at 50% 10%, #1e1b4b 0%, #0f172a 50%, #020617 100%);
            min-height: 100vh;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .liquid-glass {
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .liquid-card {
            background: rgba(30, 41, 59, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .liquid-card:hover {
            transform: translateY(-2px);
            border-color: rgba(56, 189, 248, 0.4);
            box-shadow: 0 10px 25px -5px rgba(14, 165, 233, 0.15);
        }

        .btn-glass {
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            transition: all 0.2s;
        }
        .btn-glass:hover {
            background: rgba(255, 255, 255, 0.16);
            transform: translateY(-1px);
        }

        .liquid-blob {
            position: fixed;
            border-radius: 50%;
            filter: blur(90px);
            opacity: 0.18;
            pointer-events: none;
            z-index: 0;
        }
    </style>
</head>
<body class="antialiased flex flex-col min-h-screen relative overflow-x-hidden selection:bg-sky-500 selection:text-white">

    <!-- Ambient Glowing Blobs -->
    <div class="liquid-blob w-96 h-96 bg-purple-600 -top-20 -left-20"></div>
    <div class="liquid-blob w-96 h-96 bg-sky-600 top-1/3 -right-20"></div>
    <div class="liquid-blob w-96 h-96 bg-pink-600 bottom-10 left-1/4"></div>

    <!-- Header Navigation -->
    <header class="sticky top-0 z-40 liquid-glass border-b border-white/10 px-4 py-3 sm:px-8">
        <div class="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <!-- Brand -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white text-lg shadow-lg shadow-indigo-500/20">
                    <i class="fas fa-mug-hot"></i>
                </div>
                <div>
                    <h1 class="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                        <?= htmlspecialchars(STORE_NAME) ?>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider hidden sm:inline">Khách Hàng</span>
                    </h1>
                    <p class="text-[11px] text-slate-400 hidden sm:block"><?= htmlspecialchars(APP_SUBTITLE) ?></p>
                </div>
            </div>

            <!-- Wi-Fi & Contact Pill -->
            <div class="flex items-center gap-2">
                <div class="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/70 border border-white/10 text-xs text-slate-300 font-mono">
                    <i class="fas fa-wifi text-sky-400"></i>
                    <span>Wi-Fi: <b class="text-white">GocPho_Guest</b> (pass: <b class="text-amber-400">88888888</b>)</span>
                </div>

                <a href="tel:<?= preg_replace('/[^0-9]/', '', STORE_HOTLINE) ?>" class="btn-glass px-3 py-1.5 text-xs text-emerald-300 hover:text-white flex items-center gap-1.5 font-bold" title="Gọi Hotline">
                    <i class="fas fa-phone-alt"></i>
                    <span class="hidden sm:inline"><?= htmlspecialchars(STORE_HOTLINE) ?></span>
                </a>

                <?php if ($isLoggedIn): ?>
                    <div class="flex items-center gap-1.5 pl-2 border-l border-white/10">
                        <span class="px-2.5 py-1 rounded-xl bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-bold flex items-center gap-1">
                            <i class="fas fa-user-circle"></i>
                            <span class="max-w-[120px] truncate"><?= htmlspecialchars($currentUser['fullname']) ?></span>
                        </span>
                        <?php if ($currentUser['role'] === 'admin'): ?>
                            <a href="admin.php" class="btn-glass px-2.5 py-1 text-xs text-indigo-300" title="Trang Quản Trị">
                                <i class="fas fa-chart-pie"></i>
                            </a>
                        <?php endif; ?>
                        <button type="button" onclick="handleLogout()" class="w-8 h-8 rounded-xl btn-glass bg-rose-500/20 text-rose-300 hover:text-white flex items-center justify-center p-0" title="Đăng xuất">
                            <i class="fas fa-sign-out-alt text-xs"></i>
                        </button>
                    </div>
                <?php else: ?>
                    <a href="index.php" class="btn-glass px-3 py-1.5 text-xs text-sky-300 hover:text-white font-bold flex items-center gap-1">
                        <i class="fas fa-sign-in-alt"></i>
                        <span>Đăng Nhập</span>
                    </a>
                <?php endif; ?>
            </div>
        </div>
    </header>

    <!-- Main Content Container -->
    <main class="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6 z-10">
        
        <!-- Hero Promotional Banner -->
        <section class="liquid-glass rounded-3xl p-6 sm:p-8 border border-white/15 relative overflow-hidden shadow-2xl">
            <div class="absolute -right-12 -top-12 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
            <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div class="space-y-3 max-w-2xl">
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                        <i class="fas fa-sparkles"></i> Ưu Đãi Đặc Biệt Hôm Nay
                    </div>
                    <h2 class="text-2xl sm:text-4xl font-black text-white leading-tight">
                        Thưởng Thức Hương Vị Đậm Đà Tại <span class="bg-gradient-to-r from-amber-400 via-rose-400 to-sky-400 bg-clip-text text-transparent">Góc Phố</span>
                    </h2>
                    <p class="text-sm sm:text-base text-slate-300 leading-relaxed">
                        Cà phê pha phin truyền thống, trà sữa thơm béo cùng các món điểm tâm bánh mì chảo, bò bít tết hảo hạng. Không gian thoáng mát, Wi-Fi tốc độ cao phục vụ quý khách.
                    </p>
                    <div class="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold">
                        <span class="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                            <i class="fas fa-check-circle"></i> Giảm 10% khi thanh toán VietQR
                        </span>
                        <span class="px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                            <i class="fas fa-gift"></i> Tặng topping Flan cho hóa đơn từ 50k
                        </span>
                    </div>
                </div>

                <!-- Fast Contact & Info Card -->
                <div class="shrink-0 p-4 rounded-2xl bg-slate-900/80 border border-white/10 text-center space-y-2 min-w-[220px]">
                    <div class="text-xs text-slate-400 uppercase tracking-wider font-semibold">Địa chỉ quán</div>
                    <div class="text-xs font-bold text-white"><?= htmlspecialchars(STORE_ADDRESS) ?></div>
                    <div class="border-t border-white/10 pt-2 text-xs text-slate-400">
                        Giờ mở cửa: <b class="text-emerald-400">06:30 - 22:30</b>
                    </div>
                    <div class="pt-1">
                        <button type="button" onclick="showQuickVietQr()" class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/20 hover:opacity-95">
                            <i class="fas fa-qrcode"></i> Mã Thanh Toán VietQR
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- Digital Menu Section -->
        <section class="space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
                <div>
                    <h3 class="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                        <i class="fas fa-book-open text-sky-400"></i> THỰC ĐƠN ĐIỆN TỬ
                    </h3>
                    <p class="text-xs text-slate-400">Khám phá các món nước & điểm tâm hấp dẫn tại quán</p>
                </div>

                <!-- Category Filter Pills -->
                <div class="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none" id="category-filter-pills">
                    <button type="button" onclick="filterMenuCategory(0)" class="cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500 text-white shadow-md transition-all shrink-0">
                        Tất Cả (<?= count($products) ?>)
                    </button>
                    <?php foreach ($categories as $cat): ?>
                        <?php 
                            $countCat = count(array_filter($products, fn($p) => $p['category_id'] == $cat['id']));
                            if ($countCat === 0) continue;
                        ?>
                        <button type="button" onclick="filterMenuCategory(<?= $cat['id'] ?>)" class="cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-all shrink-0">
                            <?= htmlspecialchars($cat['name']) ?> (<?= $countCat ?>)
                        </button>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Products Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4" id="products-grid">
                <?php foreach ($products as $p): ?>
                    <div class="product-item liquid-card rounded-2xl p-3 flex flex-col justify-between" data-category-id="<?= $p['category_id'] ?>">
                        <div class="space-y-2">
                            <!-- Product Image: 4:3 Aspect Ratio for Full View -->
                            <div class="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-white/10 group-hover:scale-105 transition-all flex items-center justify-center">
                                <img src="<?= !empty($p['image']) ? htmlspecialchars($p['image']) : 'assets/images/dishes/default_dish.jpg' ?>" alt="<?= htmlspecialchars($p['name']) ?>" class="w-full h-full object-cover object-center" onerror="this.onerror=null;this.src='assets/images/dishes/default_dish.jpg';" loading="lazy" />
                                <div class="absolute top-1.5 left-1.5">
                                    <span class="text-[10px] font-mono text-sky-400 font-bold bg-slate-950/85 backdrop-blur-md px-1.5 py-0.5 rounded border border-sky-500/30 shadow"><?= htmlspecialchars($p['code']) ?></span>
                                </div>
                            </div>
                            
                            <div>
                                <h4 class="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug"><?= htmlspecialchars($p['name']) ?></h4>
                            </div>
                        </div>

                        <div class="pt-2 mt-2 border-t border-white/10 flex items-center justify-between">
                            <span class="text-xs text-slate-400 font-medium">/ <?= htmlspecialchars($p['unit']) ?></span>
                            <span class="text-sm sm:text-base font-black font-mono text-emerald-400"><?= number_format($p['sale_price'], 0, ',', '.') ?> đ</span>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>

        <!-- Development Notice Section -->
        <section class="liquid-glass rounded-2xl p-4 border border-sky-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div class="flex items-center gap-2.5 text-center sm:text-left">
                <span class="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                    <i class="fas fa-info-circle"></i>
                </span>
                <div>
                    <span class="font-bold text-slate-200">Kênh dành cho khách hàng (Mã USR):</span> Xem thông tin quảng cáo, thực đơn và quét mã thanh toán. Tính năng tự gọi món tại bàn đang tiếp tục được hoàn thiện trong phiên bản kế tiếp.
                </div>
            </div>
            <a href="order.php" class="btn-glass px-3 py-1.5 text-xs text-sky-300 hover:text-white shrink-0 font-bold">
                <i class="fas fa-clipboard-list mr-1"></i> Nhân Viên Nhận Order
            </a>
        </section>
    </main>

    <!-- Footer -->
    <footer class="mt-auto border-t border-white/10 liquid-glass py-5 px-4 text-center text-xs text-slate-500 z-10">
        <div class="max-w-6xl mx-auto space-y-1">
            <div class="font-bold text-slate-400"><?= htmlspecialchars(STORE_NAME) ?> • Hotline: <?= htmlspecialchars(STORE_HOTLINE) ?></div>
            <div><?= htmlspecialchars(STORE_ADDRESS) ?></div>
            <div class="text-[11px] text-slate-600 pt-1">Hệ thống POS Góc Phố Liquid Glass • Phiên bản <?= htmlspecialchars(APP_VERSION) ?></div>
        </div>
    </footer>

    <!-- Quick VietQR Modal -->
    <div id="quick-vietqr-modal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 opacity-0 pointer-events-none transition-all duration-300">
        <div class="liquid-glass rounded-3xl p-6 w-96 max-w-[92vw] text-center border border-sky-500/30 space-y-4 shadow-2xl">
            <div class="flex justify-between items-center pb-2 border-b border-white/10">
                <h3 class="font-bold text-sm text-sky-400 flex items-center gap-2">
                    <i class="fas fa-qrcode"></i> Thanh Toán VietQR Quán
                </h3>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="closeQuickVietQr()">&times;</button>
            </div>
            
            <p class="text-xs text-slate-300">Quét mã bằng ứng dụng Ngân hàng (MB, VCB, BIDV, Techcombank, MoMo,...):</p>
            
            <div class="bg-white p-3 rounded-2xl inline-block shadow-xl border border-slate-200">
                <?php
                    $bankQrUrl = sprintf(
                        "https://img.vietqr.io/image/%s-%s-compact2.png?amount=0&addInfo=%s&accountName=%s",
                        urlencode(VIETQR_BANK_ID),
                        urlencode(VIETQR_ACCOUNT_NO),
                        urlencode("THANH TOAN GOC PHO"),
                        urlencode(VIETQR_ACCOUNT_NAME)
                    );
                ?>
                <img src="<?= $bankQrUrl ?>" alt="VietQR" class="w-56 h-56 mx-auto object-contain" />
            </div>

            <div class="text-xs text-left p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-1 font-mono">
                <div>Ngân hàng: <b class="text-slate-200"><?= htmlspecialchars(VIETQR_BANK_ID) ?> Bank</b></div>
                <div>Số tài khoản: <b class="text-sky-400"><?= htmlspecialchars(VIETQR_ACCOUNT_NO) ?></b></div>
                <div>Chủ tài khoản: <b class="text-emerald-400"><?= htmlspecialchars(VIETQR_ACCOUNT_NAME) ?></b></div>
            </div>

            <button type="button" class="btn-glass w-full py-2 text-xs font-bold text-slate-300" onclick="closeQuickVietQr()">
                Đóng
            </button>
        </div>
    </div>

    <!-- JavaScript Interactions -->
    <script>
        function filterMenuCategory(catId) {
            // Update active pill styling
            document.querySelectorAll('.cat-pill').forEach((btn, idx) => {
                if ((catId === 0 && idx === 0) || btn.getAttribute('onclick').includes(`(${catId})`)) {
                    btn.className = 'cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500 text-white shadow-md transition-all shrink-0';
                } else {
                    btn.className = 'cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-all shrink-0';
                }
            });

            // Filter products
            document.querySelectorAll('.product-item').forEach(el => {
                const itemCat = parseInt(el.getAttribute('data-category-id'), 10);
                if (catId === 0 || itemCat === catId) {
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'none';
                }
            });
        }

        function showQuickVietQr() {
            const modal = document.getElementById('quick-vietqr-modal');
            if (modal) {
                modal.classList.remove('opacity-0', 'pointer-events-none');
            }
        }

        function closeQuickVietQr() {
            const modal = document.getElementById('quick-vietqr-modal');
            if (modal) {
                modal.classList.add('opacity-0', 'pointer-events-none');
            }
        }

        async function handleLogout() {
            if (!confirm('Đăng xuất khỏi tài khoản khách hàng?')) return;
            await fetch('api/auth.php?action=logout');
            window.location.reload();
        }
    </script>
</body>
</html>

