<?php
/**
 * Back-office Admin Management Screen
 * Liquid Glass Dashboard, Catalog, Products, Categories, Tables, Reports
 */

// Chống lưu bộ nhớ đệm (Cache) trên Safari iPad / Điện thoại
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/config/database.php';

// Authentication check: user must be logged in and have admin privileges
enforceRoleAccess(['admin']);

$settingsPdo = Database::getConnection();
$dbSettings = [];
try {
    $sStmt = $settingsPdo->query("SELECT setting_key, setting_value FROM store_settings");
    if ($sStmt) {
        while ($row = $sStmt->fetch(PDO::FETCH_ASSOC)) {
            $dbSettings[$row['setting_key']] = $row['setting_value'];
        }
    }
} catch (Exception $e) {}

$storeName = $dbSettings['store_name'] ?? STORE_NAME;
$storeHotline = $dbSettings['store_hotline'] ?? STORE_HOTLINE;
$storeAddress = $dbSettings['store_address'] ?? STORE_ADDRESS;
$storeWifi = $dbSettings['store_wifi'] ?? (defined('STORE_WIFI') ? STORE_WIFI : '');
$bankId = $dbSettings['bank_id'] ?? (defined('VIETQR_BANK_ID') ? VIETQR_BANK_ID : 'MB');
$bankAccountNo = $dbSettings['bank_account_no'] ?? (defined('VIETQR_ACCOUNT_NO') ? VIETQR_ACCOUNT_NO : '');
$bankAccountName = $dbSettings['bank_account_name'] ?? (defined('VIETQR_ACCOUNT_NAME') ? VIETQR_ACCOUNT_NAME : '');
$geminiApiKey = $dbSettings['gemini_api_key'] ?? (defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '');

$currentUser = [
    'id' => $_SESSION['user_id'],
    'username' => $_SESSION['username'],
    'fullname' => $_SESSION['fullname'],
    'role' => $_SESSION['user_role']
];
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars(STORE_NAME) ?> - Quản Trị Hệ Thống</title>
    
    <!-- Local Precompiled Tailwind CSS (100% Offline, Instant Rendering) -->
    <link rel="stylesheet" href="assets/css/app-tailwind.min.css">
    <!-- Local FontAwesome 6 Icons (Offline) -->
    <link rel="stylesheet" href="assets/vendor/fontawesome/css/all.min.css">
    <!-- Chart.js Local -->
    <script src="assets/js/chart.min.js"></script>
    <!-- Liquid Glass Custom Styles -->
    <link rel="stylesheet" href="assets/css/liquid-glass.css">
</head>
<body class="antialiased flex flex-col h-screen overflow-hidden text-slate-100">

    <!-- Ambient Floating Orbs -->
    <div class="liquid-blob-1"></div>
    <div class="liquid-blob-2"></div>

    <!-- Top Admin Header -->
    <header class="liquid-header px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between z-30 shrink-0 gap-2">
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
                <i class="fas fa-cubes text-white text-sm sm:text-lg"></i>
            </div>
            <div class="min-w-0">
                <h1 class="font-black text-xs sm:text-base tracking-wide bg-gradient-to-r from-white via-indigo-200 to-sky-400 bg-clip-text text-transparent uppercase truncate">
                    <span class="hidden sm:inline"><?= htmlspecialchars(STORE_NAME) ?> • BACK-OFFICE</span>
                    <span class="sm:hidden">QUẢN TRỊ POS</span>
                </h1>
                <div class="hidden sm:flex text-[11px] text-slate-400 items-center gap-2">
                    <span>Phiên bản: <b class="text-sky-400 font-mono"><?= APP_VERSION ?></b></span>
                    <span>•</span>
                    <span>Cơ sở dữ liệu: <b class="text-emerald-400 font-mono"><?= strtoupper(DB_DRIVER) ?></b></span>
                </div>
            </div>
        </div>

        <!-- Navigation Tabs (Desktop) -->
        <nav class="hidden lg:flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/60 border border-white/10 text-xs">
            <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all bg-sky-500/20 text-sky-400 border border-sky-500/40" data-tab="dashboard">
                <i class="fas fa-chart-line mr-1"></i> Tổng Quan
            </button>
            <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white" data-tab="products">
                <i class="fas fa-utensils mr-1"></i> Mặt Hàng (F4)
            </button>
            <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white" data-tab="categories">
                <i class="fas fa-layer-group mr-1"></i> Nhóm Hàng
            </button>
            <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white" data-tab="tables">
                <i class="fas fa-border-all mr-1"></i> Bàn & Khu Vực
            </button>
            <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white" data-tab="users">
                <i class="fas fa-users-cog mr-1"></i> Nhân Viên
            </button>
            <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white" data-tab="orders">
                <i class="fas fa-receipt mr-1"></i> Lịch Sử Hóa Đơn
            </button>
            <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white" data-tab="analytics">
                <i class="fas fa-chart-pie mr-1"></i> Hiệu Suất Bếp & Phục Vụ
            </button>
            <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white" data-tab="operations">
                <i class="fas fa-boxes-stacked mr-1 text-amber-400"></i> Kho & Tiền Lương
            </button>
            <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white" data-tab="settings">
                <i class="fas fa-cog mr-1"></i> Cài Đặt
            </button>
        </nav>

        <!-- Right User Actions -->
        <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <a href="index.php?pos=1" class="btn-glass text-xs py-1.5 px-2.5 sm:px-3 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border-emerald-500/30 flex items-center gap-1.5 font-bold shadow-md shadow-emerald-500/10 shrink-0" title="Màn hình bán hàng POS Thu Ngân">
                <i class="fas fa-cash-register text-xs sm:text-sm"></i>
                <span class="hidden md:inline">POS Thu Ngân</span>
            </a>

            <a href="kitchen.php" class="btn-glass text-xs py-1.5 px-2.5 sm:px-3 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border-amber-500/30 flex items-center gap-1 font-bold shrink-0" title="Màn hình Bếp & Pha Chế">
                <i class="fas fa-fire-burner text-xs sm:text-sm"></i>
                <span class="hidden md:inline">Bếp</span>
            </a>

            <a href="order.php" class="btn-glass text-xs py-1.5 px-2.5 sm:px-3 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/30 flex items-center gap-1 font-bold shrink-0" title="Màn hình Order phục vụ">
                <i class="fas fa-clipboard-list text-xs sm:text-sm"></i>
                <span class="hidden md:inline">Phục Vụ</span>
            </a>

            <button type="button" onclick="Admin.openCloudSyncModal()" class="btn-glass text-xs py-1.5 px-2.5 sm:px-3 bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 border-cyan-500/40 flex items-center gap-1 font-bold shadow-lg shadow-cyan-500/10 shrink-0" title="Đồng bộ cơ sở dữ liệu sang MySQL Cloud">
                <i class="fas fa-cloud-arrow-up text-cyan-400 animate-pulse text-xs sm:text-sm"></i>
                <span class="hidden md:inline">Cloud Sync</span>
            </button>

            <a href="index.php?logout=1" onclick="fetch('api/auth.php?action=logout').then(() => window.location='index.php'); return false;" class="btn-glass text-xs py-1.5 px-2.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border-rose-500/30 flex items-center gap-1 font-bold shrink-0" title="Đăng xuất">
                <i class="fas fa-sign-out-alt text-xs sm:text-sm"></i>
                <span class="hidden md:inline">Thoát</span>
            </a>
        </div>
    </header>

    <!-- Mobile Navigation Slider (< lg: Hiển thị đầy đủ tất cả chức năng quản lý trên điện thoại) -->
    <nav class="lg:hidden flex items-center gap-1.5 px-2 py-1.5 bg-slate-900/95 border-b border-white/10 overflow-x-auto scrollbar-none shrink-0 z-20 text-xs">
        <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center gap-1.5 shrink-0" data-tab="dashboard">
            <i class="fas fa-chart-line text-xs"></i>
            <span>Tổng Quan</span>
        </button>
        <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5 shrink-0" data-tab="products">
            <i class="fas fa-utensils text-xs"></i>
            <span>Mặt Hàng</span>
        </button>
        <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5 shrink-0" data-tab="categories">
            <i class="fas fa-layer-group text-xs"></i>
            <span>Nhóm Hàng</span>
        </button>
        <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5 shrink-0" data-tab="tables">
            <i class="fas fa-border-all text-xs"></i>
            <span>Sơ Đồ Bàn</span>
        </button>
        <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5 shrink-0" data-tab="users">
            <i class="fas fa-users-cog text-xs"></i>
            <span>Nhân Viên</span>
        </button>
        <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5 shrink-0" data-tab="orders">
            <i class="fas fa-receipt text-xs"></i>
            <span>Lịch Sử Đơn</span>
        </button>
        <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5 shrink-0" data-tab="analytics">
            <i class="fas fa-chart-pie text-xs"></i>
            <span>Hiệu Suất</span>
        </button>
        <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5 shrink-0" data-tab="operations">
            <i class="fas fa-boxes-stacked text-xs text-amber-400"></i>
            <span>Kho & Lương</span>
        </button>
        <button type="button" class="admin-nav-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5 shrink-0" data-tab="settings">
            <i class="fas fa-cog text-xs"></i>
            <span>Cài Đặt</span>
        </button>
    </nav>

    <!-- Admin Main Body Container -->
    <main class="flex-1 overflow-y-auto p-2 sm:p-3 z-10 flex flex-col min-h-0 pb-16 sm:pb-3">

        <!-- ========================================== -->
        <!-- TAB 1: DASHBOARD & REVENUE REPORTS -->
        <!-- ========================================== -->
        <section id="tab-dashboard" class="admin-section flex-1 overflow-y-auto space-y-4">
            
            <!-- KPI Cards Grid -->
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div class="liquid-glass-card p-3.5 border-l-4 border-emerald-400">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Doanh Thu Hôm Nay</span>
                    <div id="stat-today-revenue" class="text-xl font-black text-emerald-400 font-mono mt-1">0 đ</div>
                    <span class="text-[10px] text-emerald-300/80 mt-1 block"><i class="fas fa-arrow-trend-up mr-1"></i>Hóa đơn đã xong</span>
                </div>

                <div class="liquid-glass-card p-3.5 border-l-4 border-sky-400">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Hóa Đơn Hôm Nay</span>
                    <div id="stat-today-orders" class="text-xl font-black text-sky-400 font-mono mt-1">0</div>
                    <span class="text-[10px] text-slate-400 mt-1 block">Đơn hàng hoàn tất</span>
                </div>

                <div class="liquid-glass-card p-3.5 border-l-4 border-amber-400">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Giá Trị Trung Bình</span>
                    <div id="stat-avg-order" class="text-xl font-black text-amber-400 font-mono mt-1">0 đ</div>
                    <span class="text-[10px] text-slate-400 mt-1 block">AOV / Hóa đơn</span>
                </div>

                <div class="liquid-glass-card p-3.5 border-l-4 border-indigo-400">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Bàn Đang Có Khách</span>
                    <div id="stat-tables-active" class="text-xl font-black text-indigo-400 font-mono mt-1">0 / 0</div>
                    <span class="text-[10px] text-slate-400 mt-1 block">Đang phục vụ</span>
                </div>

                <div class="liquid-glass-card p-3.5 border-l-4 border-purple-400">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Doanh Thu Tháng Này</span>
                    <div id="stat-month-revenue" class="text-xl font-black text-purple-400 font-mono mt-1">0 đ</div>
                    <span class="text-[10px] text-slate-400 mt-1 block">Tháng hiện tại</span>
                </div>

                <div class="liquid-glass-card p-3.5 border-l-4 border-rose-400">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tổng Mặt Hàng</span>
                    <div id="stat-total-products" class="text-xl font-black text-rose-400 font-mono mt-1">0</div>
                    <span class="text-[10px] text-slate-400 mt-1 block">Món đang kích hoạt</span>
                </div>
            </div>

            <!-- Chart & Top Selling Layout -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <!-- Revenue Chart with Selectable Ranges -->
                <div class="lg:col-span-2 liquid-glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div>
                            <div class="flex items-center gap-2">
                                <i class="fas fa-chart-area text-sky-400 text-base"></i>
                                <h3 id="chart-title-text" class="font-bold text-sm text-slate-100 uppercase tracking-wide">Biểu Đồ Doanh Thu 7 Ngày Gần Nhất</h3>
                            </div>
                            <div class="flex items-center gap-2 mt-1">
                                <span id="chart-summary-badge" class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">Tổng: 0 đ (0 đơn)</span>
                                <span class="text-[11px] text-slate-400">Đơn vị: VNĐ</span>
                            </div>
                        </div>

                        <!-- Quick Presets -->
                        <div class="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-900/70 border border-white/10 text-xs">
                            <button type="button" onclick="Admin.setChartPeriod('today', this)" class="chart-period-btn px-2.5 py-1 rounded-lg text-slate-300 hover:text-white transition">Hôm Nay</button>
                            <button type="button" onclick="Admin.setChartPeriod('7d', this)" class="chart-period-btn active px-2.5 py-1 rounded-lg bg-sky-500 text-white font-bold transition shadow-md shadow-sky-500/30">7 Ngày</button>
                            <button type="button" onclick="Admin.setChartPeriod('14d', this)" class="chart-period-btn px-2.5 py-1 rounded-lg text-slate-300 hover:text-white transition">14 Ngày</button>
                            <button type="button" onclick="Admin.setChartPeriod('30d', this)" class="chart-period-btn px-2.5 py-1 rounded-lg text-slate-300 hover:text-white transition">30 Ngày</button>
                            <button type="button" onclick="Admin.setChartPeriod('month', this)" class="chart-period-btn px-2.5 py-1 rounded-lg text-slate-300 hover:text-white transition">Tháng Này</button>
                            <button type="button" onclick="Admin.setChartPeriod('last_month', this)" class="chart-period-btn px-2.5 py-1 rounded-lg text-slate-300 hover:text-white transition">Tháng Trước</button>
                        </div>
                    </div>

                    <!-- Custom Range Date Picker -->
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-white/5 text-xs">
                        <div class="flex flex-wrap items-center gap-2 text-slate-300">
                            <span class="text-slate-400 font-medium"><i class="far fa-calendar-alt mr-1 text-sky-400"></i>Khoảng ngày:</span>
                            <div class="flex items-center gap-1">
                                <label for="chart-date-from" class="text-[11px] text-slate-400">Từ:</label>
                                <input type="date" id="chart-date-from" value="<?= date('Y-m-d', strtotime('-6 days')) ?>" class="liquid-input py-1 px-2 text-xs text-slate-200">
                            </div>
                            <div class="flex items-center gap-1">
                                <label for="chart-date-to" class="text-[11px] text-slate-400">Đến:</label>
                                <input type="date" id="chart-date-to" value="<?= date('Y-m-d') ?>" class="liquid-input py-1 px-2 text-xs text-slate-200">
                            </div>
                            <button type="button" onclick="Admin.filterCustomChartRange()" class="btn-glass text-xs py-1 px-3 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/30 flex items-center gap-1 font-bold">
                                <i class="fas fa-filter text-sky-400"></i> Lọc
                            </button>
                        </div>
                        <div id="chart-range-indicator" class="text-[11px] text-sky-300/80 font-mono">
                            <!-- Dynamic timeframe text -->
                        </div>
                    </div>

                    <div class="h-72 w-full">
                        <canvas id="revenueChart"></canvas>
                    </div>
                </div>

                <!-- Top Selling Products -->
                <div class="liquid-glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-crown text-amber-400"></i>
                            <h3 class="font-bold text-sm text-slate-100 uppercase tracking-wide">Món Bán Chạy Nhất</h3>
                        </div>
                        <span class="text-xs text-slate-400 font-mono">Top Món</span>
                    </div>
                    <div id="top-selling-list" class="space-y-2 overflow-y-auto max-h-72 pr-1">
                        <!-- Loaded dynamically -->
                    </div>
                </div>
            </div>
        </section>

        <!-- ========================================== -->
        <!-- TAB 2: PRODUCTS MANAGEMENT (QUẢN LÝ MẶT HÀNG) -->
        <!-- ========================================== -->
        <section id="tab-products" class="admin-section hidden flex-1 flex flex-col liquid-glass rounded-2xl overflow-hidden border border-white/10">
            <!-- Header Toolbar -->
            <div class="p-3 border-b border-white/10 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <button type="button" onclick="Admin.openAddProductModal()" class="btn-glass-primary text-xs py-2 px-3 font-bold flex items-center gap-1.5">
                        <i class="fas fa-plus"></i> Thêm Mặt Hàng (Insert)
                    </button>
                    <button type="button" onclick="Admin.batchAiAssignImages()" class="btn-glass text-xs py-2 px-3 bg-purple-500/20 text-purple-300 hover:bg-purple-500 hover:text-white border border-purple-500/30 flex items-center gap-1.5 shadow" title="Tự động dùng AI nhận dạng tên món và gán hình ảnh đẹp mắt cho toàn bộ menu">
                        <i class="fas fa-wand-magic-sparkles text-amber-400"></i> AI Cập Nhật Ảnh Thực Đơn
                    </button>
                    <button type="button" onclick="Admin.loadProducts()" class="btn-glass text-xs py-2 px-3 bg-slate-800/60 hover:bg-slate-700/80">
                        <i class="fas fa-sync-alt mr-1"></i> Tải lại
                    </button>
                </div>

                <!-- Filters -->
                <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <select id="product-filter-category" onchange="Admin.loadProducts()" class="liquid-input text-xs py-1.5 px-3 bg-slate-900 flex-1 sm:flex-none">
                        <option value="">-- Tất cả nhóm hàng --</option>
                    </select>

                    <div class="relative flex-1 sm:w-60 min-w-[140px]">
                        <i class="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                        <input type="text" id="product-filter-search" oninput="Admin.loadProducts()" placeholder="Lọc theo tên, mã (F3)..." class="liquid-input w-full pl-8 text-xs py-1.5" />
                    </div>
                </div>
            </div>

            <!-- Products Table View (matching user legacy screenshot) -->
            <div class="flex-1 overflow-x-auto overflow-y-auto">
                <table class="w-full min-w-[650px] text-left border-collapse">
                    <thead class="sticky top-0 bg-slate-950/90 backdrop-blur-md text-slate-400 text-xs uppercase tracking-wider border-b border-white/10 z-10">
                        <tr>
                            <th class="p-3 w-16 text-center">Hình Ảnh</th>
                            <th class="p-3">Mã Hàng</th>
                            <th class="p-3">Tên Mặt Hàng</th>
                            <th class="p-3">Nhóm Mặt Hàng</th>
                            <th class="p-3">Đơn Vị Tính</th>
                            <th class="p-3">Giá Bán</th>
                            <th class="p-3">Giá Nhập</th>
                            <th class="p-3 text-center">Tạm Khóa</th>
                            <th class="p-3 text-right">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody id="products-table-body">
                        <!-- Loaded dynamically -->
                    </tbody>
                </table>
            </div>
        </section>

        <!-- ========================================== -->
        <!-- TAB 3: CATEGORIES MANAGEMENT (NHÓM HÀNG) -->
        <!-- ========================================== -->
        <section id="tab-categories" class="admin-section hidden flex-1 flex flex-col liquid-glass rounded-2xl overflow-hidden border border-white/10">
            <div class="p-3 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
                <button type="button" onclick="Admin.openAddCategoryModal()" class="btn-glass-primary text-xs py-2 px-3 font-bold flex items-center gap-1.5">
                    <i class="fas fa-plus"></i> Thêm Nhóm Hàng
                </button>
                <span class="text-xs text-slate-400">Quản lý các danh mục đồ uống, đồ ăn, topping</span>
            </div>
            <div class="flex-1 overflow-y-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-slate-950/90 backdrop-blur-md text-slate-400 text-xs uppercase tracking-wider border-b border-white/10 z-10">
                        <tr>
                            <th class="p-3">ID</th>
                            <th class="p-3">Tên Nhóm Hàng</th>
                            <th class="p-3">Số Lượng Món</th>
                            <th class="p-3">Thứ Tự</th>
                            <th class="p-3 text-right">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody id="category-table-body">
                        <!-- Loaded dynamically -->
                    </tbody>
                </table>
            </div>
        </section>

        <!-- ========================================== -->
        <!-- TAB 4: TABLES & AREAS (QUẢN LÝ BÀN) -->
        <!-- ========================================== -->
        <section id="tab-tables" class="admin-section hidden flex-1 flex flex-col liquid-glass rounded-2xl overflow-hidden border border-white/10 p-4">
            <div class="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div>
                    <h3 class="font-bold text-base text-slate-100">Danh Sách Bàn & Khu Vực</h3>
                    <p class="text-xs text-slate-400">Khu vực Mang Về (MV) và Bàn Tại Quán (TQ)</p>
                </div>
                <button type="button" onclick="Admin.addTable()" class="btn-glass-primary text-xs py-2 px-3.5 font-bold flex items-center gap-1.5">
                    <i class="fas fa-plus"></i> Thêm Bàn Mới
                </button>
            </div>
            <div id="admin-tables-container" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 overflow-y-auto flex-1">
                <!-- Loaded dynamically -->
            </div>
        </section>

        <!-- ========================================== -->
        <!-- TAB: USERS & EMPLOYEES (QUẢN LÝ NHÂN VIÊN) -->
        <!-- ========================================== -->
        <section id="tab-users" class="admin-section hidden flex-1 flex flex-col liquid-glass rounded-2xl overflow-hidden border border-white/10">
            <div class="p-3 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
                <div>
                    <h3 class="font-bold text-base text-white">Quản Lý Người Dùng & Phân Quyền</h3>
                    <p class="text-xs text-slate-400">Thiết lập tài khoản và quyền truy cập: Quản trị (ADM), Thu ngân (ACC), Phục vụ (STF), Bếp/Bar (KIT), Khách hàng (USR)</p>
                </div>
                <button type="button" onclick="Admin.openAddUserModal()" class="btn-glass-primary text-xs py-2 px-3.5 font-bold flex items-center gap-1.5 shadow-lg shadow-sky-500/20">
                    <i class="fas fa-user-plus"></i> Thêm Người Dùng Mới
                </button>
            </div>
            <div class="flex-1 overflow-y-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-slate-950/90 backdrop-blur-md text-slate-400 text-xs uppercase tracking-wider border-b border-white/10 z-10">
                        <tr>
                            <th class="p-3">Mã User</th>
                            <th class="p-3">Tài Khoản</th>
                            <th class="p-3">Họ Và Tên</th>
                            <th class="p-3">Vai Trò & Quyền Hạn</th>
                            <th class="p-3">Số Điện Thoại</th>
                            <th class="p-3">Mã PIN</th>
                            <th class="p-3">Trạng Thái</th>
                            <th class="p-3 text-right">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody id="users-table-body">
                        <!-- Loaded dynamically -->
                    </tbody>
                </table>
            </div>
        </section>

        <!-- ========================================== -->
        <!-- TAB 5: ORDER HISTORY & RECEIPTS -->
        <!-- ========================================== -->
        <section id="tab-orders" class="admin-section hidden flex-1 flex flex-col liquid-glass rounded-2xl overflow-hidden border border-white/10">
            <div class="p-2 sm:p-3 border-b border-white/10 bg-slate-900/60">
                <div class="order-filter-bar text-xs">
                    <div class="order-filter-item">
                        <span class="text-xs text-slate-400 shrink-0">Từ ngày:</span>
                        <input type="date" id="history-date-from" value="<?= date('Y-m-d') ?>" class="liquid-input text-xs py-1.5 px-2" />
                    </div>
                    <div class="order-filter-item">
                        <span class="text-xs text-slate-400 shrink-0">Đến:</span>
                        <input type="date" id="history-date-to" value="<?= date('Y-m-d') ?>" class="liquid-input text-xs py-1.5 px-2" />
                    </div>
                    <div class="order-filter-actions">
                        <select id="history-status" class="liquid-input text-xs py-1.5 px-2 bg-slate-900">
                            <option value="">Tất cả trạng thái</option>
                            <option value="completed" selected>Đã thanh toán</option>
                            <option value="pending">Đang dùng</option>
                            <option value="cancelled">Đã hủy</option>
                        </select>
                        <button type="button" onclick="Admin.loadOrderHistory()" class="btn-glass-primary text-xs py-1.5 px-4 font-bold flex items-center justify-center gap-1.5 shrink-0 shadow-sm active:scale-95">
                            <i class="fas fa-filter text-sky-300"></i>
                            <span>Lọc</span>
                        </button>
                    </div>
                </div>
            </div>
            <div class="flex-1 overflow-x-auto overflow-y-auto">
                <table class="w-full min-w-[640px] text-left border-collapse">
                    <thead class="sticky top-0 bg-slate-950/90 backdrop-blur-md text-slate-400 text-xs uppercase tracking-wider border-b border-white/10 z-10">
                        <tr>
                            <th class="p-3">Mã Hóa Đơn</th>
                            <th class="p-3">Bàn</th>
                            <th class="p-3">Thời Gian</th>
                            <th class="p-3">Thu Ngân</th>
                            <th class="p-3">Tổng Tiền</th>
                            <th class="p-3">Trạng Thái</th>
                            <th class="p-3 text-right">Xem</th>
                        </tr>
                    </thead>
                    <tbody id="order-history-tbody">
                        <!-- Loaded dynamically -->
                    </tbody>
                </table>
            </div>
        </section>

        <!-- ========================================== -->
        <!-- TAB: SERVICE & KITCHEN PERFORMANCE ANALYTICS -->
        <!-- ========================================== -->
        <section id="tab-analytics" class="admin-section hidden flex-1 flex flex-col liquid-glass rounded-2xl overflow-hidden border border-white/10">
            <!-- Filter Bar -->
            <div class="p-3 border-b border-white/10 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm border border-amber-500/30">
                        <i class="fas fa-chart-pie"></i>
                    </span>
                    <div>
                        <h3 class="font-extrabold text-sm text-amber-300 uppercase tracking-wide">PHÂN TÍCH HIỆU SUẤT BẾP & PHỤC VỤ</h3>
                        <p class="text-[11px] text-slate-400">Thống kê tốc độ chế biến, số lượt phục vụ của nhân viên và nhật ký dịch vụ</p>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-wrap text-xs">
                    <div class="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-white/10">
                        <button type="button" onclick="Admin.setAnalyticsPreset('today')" class="px-2.5 py-1 rounded-lg text-amber-300 bg-amber-500/20 font-bold" id="btn-ana-today">Hôm Nay</button>
                        <button type="button" onclick="Admin.setAnalyticsPreset('yesterday')" class="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white" id="btn-ana-yesterday">Hôm Qua</button>
                        <button type="button" onclick="Admin.setAnalyticsPreset('7days')" class="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white" id="btn-ana-7days">7 Ngày</button>
                        <button type="button" onclick="Admin.setAnalyticsPreset('month')" class="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white" id="btn-ana-month">Tháng Này</button>
                    </div>

                    <div class="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                        <div class="flex items-center gap-1 flex-1 sm:flex-none">
                            <input type="date" id="ana-date-from" class="liquid-input py-1 px-2 text-xs flex-1 sm:w-32" />
                            <span class="text-slate-400">-</span>
                            <input type="date" id="ana-date-to" class="liquid-input py-1 px-2 text-xs flex-1 sm:w-32" />
                        </div>
                        <button type="button" onclick="Admin.loadAnalyticsData()" class="btn-glass-primary text-xs py-1.5 px-3.5 font-bold flex items-center justify-center gap-1 shrink-0">
                            <i class="fas fa-filter text-sky-300"></i> Lọc
                        </button>
                    </div>
                </div>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-4 space-y-4">
                <!-- 4 KPI Cards -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div class="liquid-glass-card p-3.5 border-l-4 border-amber-400">
                        <div class="text-xs text-slate-400 font-semibold flex items-center justify-between">
                            <span>ĐƠN ĐÃ CHẾ BIẾN</span>
                            <i class="fas fa-fire-burner text-amber-400"></i>
                        </div>
                        <div id="ana-stat-orders" class="text-xl font-black text-amber-300 font-mono mt-1">0</div>
                        <div id="ana-stat-items" class="text-[11px] text-slate-400 mt-0.5">0 món / ly đã làm</div>
                    </div>

                    <div class="liquid-glass-card p-3.5 border-l-4 border-sky-400">
                        <div class="text-xs text-slate-400 font-semibold flex items-center justify-between">
                            <span>TG CHẾ BIẾN TRUNG BÌNH</span>
                            <i class="fas fa-stopwatch text-sky-400"></i>
                        </div>
                        <div id="ana-stat-prep-time" class="text-xl font-black text-sky-400 font-mono mt-1">0 <span class="text-xs font-normal">phút/đơn</span></div>
                        <div class="text-[11px] text-slate-400 mt-0.5">Thời gian hoàn thành món ăn</div>
                    </div>

                    <div class="liquid-glass-card p-3.5 border-l-4 border-emerald-400">
                        <div class="text-xs text-slate-400 font-semibold flex items-center justify-between">
                            <span>TG CHỜ BƯNG RA BÀN</span>
                            <i class="fas fa-running text-emerald-400"></i>
                        </div>
                        <div id="ana-stat-deliver-time" class="text-xl font-black text-emerald-400 font-mono mt-1">0 <span class="text-xs font-normal">phút</span></div>
                        <div class="text-[11px] text-slate-400 mt-0.5">Từ lúc bếp xong đến khi ra bàn</div>
                    </div>

                    <div class="liquid-glass-card p-3.5 border-l-4 border-purple-400">
                        <div class="text-xs text-slate-400 font-semibold flex items-center justify-between">
                            <span>TỶ LỆ ĐÚNG HẠN (&lt;10 PHÚT)</span>
                            <i class="fas fa-check-double text-purple-400"></i>
                        </div>
                        <div id="ana-stat-ontime-rate" class="text-xl font-black text-purple-400 font-mono mt-1">100%</div>
                        <div class="text-[11px] text-slate-400 mt-0.5">Chất lượng phục vụ khách</div>
                    </div>
                </div>

                <!-- 2 Split Tables: Staff Ranking & Top Dishes -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <!-- Staff Table (7 cols) -->
                    <div class="lg:col-span-7 liquid-glass rounded-xl border border-white/10 overflow-hidden flex flex-col">
                        <div class="p-3 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
                            <h4 class="font-bold text-xs uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                                <i class="fas fa-medal"></i> BẢNG XẾP HẠNG PHỤC VỤ & THU NGÂN
                            </h4>
                            <span class="text-[11px] text-slate-400">Đơn nhận & bưng món</span>
                        </div>
                        <div class="flex-1 overflow-x-auto">
                            <table class="w-full text-left border-collapse">
                                <thead class="bg-slate-950/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-white/10">
                                    <tr>
                                        <th class="p-2.5">Nhân viên</th>
                                        <th class="p-2.5">Vai trò</th>
                                        <th class="p-2.5 text-center">Đơn nhận</th>
                                        <th class="p-2.5 text-center">Đã bưng</th>
                                        <th class="p-2.5 text-right">Doanh số</th>
                                        <th class="p-2.5 text-center">TG Bưng</th>
                                    </tr>
                                </thead>
                                <tbody id="ana-staff-tbody" class="divide-y divide-white/5 text-xs">
                                    <!-- Rendered dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Top Dishes (5 cols) -->
                    <div class="lg:col-span-5 liquid-glass rounded-xl border border-white/10 overflow-hidden flex flex-col">
                        <div class="p-3 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
                            <h4 class="font-bold text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                <i class="fas fa-mug-hot"></i> MÓN CHẾ BIẾN NHIỀU NHẤT
                            </h4>
                            <span class="text-[11px] text-slate-400">Top 10</span>
                        </div>
                        <div class="flex-1 overflow-x-auto">
                            <table class="w-full text-left border-collapse">
                                <thead class="bg-slate-950/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-white/10">
                                    <tr>
                                        <th class="p-2.5">Món ăn / Đồ uống</th>
                                        <th class="p-2.5 text-center">Số lượng</th>
                                        <th class="p-2.5 text-right">Doanh thu</th>
                                    </tr>
                                </thead>
                                <tbody id="ana-dishes-tbody" class="divide-y divide-white/5 text-xs">
                                    <!-- Rendered dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Audit Service Logs Table -->
                <div class="liquid-glass rounded-xl border border-white/10 overflow-hidden flex flex-col">
                    <div class="p-3 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <h4 class="font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                <i class="fas fa-clipboard-check"></i> NHẬT KÝ PHỤC VỤ & PHA CHẾ THỜI GIAN THỰC (AUDIT TRAIL)
                            </h4>
                            <span class="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">Chi tiết từng thao tác</span>
                        </div>
                        <button type="button" onclick="Admin.loadAnalyticsData()" class="btn-glass text-[11px] py-1 px-2.5 text-slate-300">
                            <i class="fas fa-sync-alt mr-1"></i> Làm mới
                        </button>
                    </div>
                    <div class="flex-1 overflow-x-auto max-h-80">
                        <table class="w-full text-left border-collapse">
                            <thead class="sticky top-0 bg-slate-950/95 backdrop-blur-md text-slate-400 text-[11px] uppercase tracking-wider border-b border-white/10 z-10">
                                <tr>
                                    <th class="p-2.5">Thời gian</th>
                                    <th class="p-2.5">Mã HĐ</th>
                                    <th class="p-2.5">Bàn</th>
                                    <th class="p-2.5">Hành động</th>
                                    <th class="p-2.5">Người thực hiện</th>
                                    <th class="p-2.5">Vai trò</th>
                                    <th class="p-2.5">Chi tiết / Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody id="ana-logs-tbody" class="divide-y divide-white/5 text-xs">
                                <!-- Rendered dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>

        <!-- ========================================== -->
        <!-- TAB: KHO, CHI PHÍ VẬT LIỆU, TIỀN LƯƠNG & CHẤM CÔNG REALTIME -->
        <!-- ========================================== -->
        <section id="tab-operations" class="admin-section hidden flex-1 flex flex-col liquid-glass rounded-2xl overflow-hidden border border-white/10">
            <!-- Operations Sub-Navigation Header -->
            <div class="p-3 border-b border-white/10 bg-slate-900/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                        <i class="fas fa-boxes-stacked text-sm"></i>
                    </div>
                    <div>
                        <h2 class="font-extrabold text-sm sm:text-base text-white">VẬN HÀNH, KHO & TIỀN LƯƠNG</h2>
                        <p class="text-[11px] text-slate-400">Quản lý kho hàng, chi phí vật liệu, chấm công tự động & theo dõi nhân sự realtime</p>
                    </div>
                </div>

                <!-- Sub-tab Switchers (Realtime, Inventory, Payroll) -->
                <div class="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-white/10 text-xs">
                    <button type="button" id="ops-subtab-realtime" onclick="Admin.switchOpsSubtab('realtime')" class="ops-subtab-btn px-3 py-1.5 rounded-lg font-bold transition-all bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>Trực Ca Realtime</span>
                        <span id="badge-online-count" class="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300 text-[10px]">0</span>
                    </button>
                    <button type="button" id="ops-subtab-inventory" onclick="Admin.switchOpsSubtab('inventory')" class="ops-subtab-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5">
                        <i class="fas fa-warehouse text-xs text-amber-400"></i>
                        <span>Kho & Chi Phí Vật Liệu</span>
                    </button>
                    <button type="button" id="ops-subtab-payroll" onclick="Admin.switchOpsSubtab('payroll')" class="ops-subtab-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5">
                        <i class="fas fa-money-check-dollar text-xs text-emerald-400"></i>
                        <span>Chấm Công & Tiền Lương</span>
                    </button>
                </div>
            </div>

            <!-- Content Container -->
            <div class="flex-1 overflow-y-auto p-3 space-y-4">

                <!-- ============================================ -->
                <!-- SUB-VIEW 1: NHÂN VIÊN TRỰC CA THEO THỜI GIAN THỰC -->
                <!-- ============================================ -->
                <div id="ops-subview-realtime" class="space-y-4">
                    <!-- KPI Summary Cards -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div class="liquid-glass-card p-3 border-l-4 border-emerald-400">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Thu Ngân Đang Trực</span>
                            <div class="flex items-center justify-between mt-1">
                                <span id="realtime-stat-cashier" class="text-2xl font-black text-emerald-400 font-mono">0</span>
                                <i class="fas fa-cash-register text-emerald-500/40 text-xl"></i>
                            </div>
                            <span class="text-[10px] text-slate-400 mt-1 block">Màn hình POS thu ngân</span>
                        </div>
                        <div class="liquid-glass-card p-3 border-l-4 border-amber-400">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bếp & Pha Chế</span>
                            <div class="flex items-center justify-between mt-1">
                                <span id="realtime-stat-kitchen" class="text-2xl font-black text-amber-400 font-mono">0</span>
                                <i class="fas fa-fire-burner text-amber-500/40 text-xl"></i>
                            </div>
                            <span class="text-[10px] text-slate-400 mt-1 block">Màn hình bếp chế biến</span>
                        </div>
                        <div class="liquid-glass-card p-3 border-l-4 border-sky-400">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phục Vụ Chạy Bàn</span>
                            <div class="flex items-center justify-between mt-1">
                                <span id="realtime-stat-waiter" class="text-2xl font-black text-sky-400 font-mono">0</span>
                                <i class="fas fa-clipboard-list text-sky-500/40 text-xl"></i>
                            </div>
                            <span class="text-[10px] text-slate-400 mt-1 block">Màn hình Order bàn</span>
                        </div>
                        <div class="liquid-glass-card p-3 border-l-4 border-indigo-400">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quản Trị Hệ Thống</span>
                            <div class="flex items-center justify-between mt-1">
                                <span id="realtime-stat-admin" class="text-2xl font-black text-indigo-400 font-mono">0</span>
                                <i class="fas fa-shield-halved text-indigo-500/40 text-xl"></i>
                            </div>
                            <span class="text-[10px] text-slate-400 mt-1 block">Chủ quán / Quản lý</span>
                        </div>
                    </div>

                    <!-- Live Active Staff Table -->
                    <div class="liquid-glass rounded-xl border border-white/10 overflow-hidden">
                        <div class="p-3 bg-slate-900/60 border-b border-white/10 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                                <h3 class="font-bold text-xs uppercase tracking-wide text-slate-200">Danh Sách Nhân Viên Đang Đăng Nhập & Làm Việc</h3>
                                <span class="text-[11px] text-slate-400">(Tự động chấm công ngay khi đăng nhập)</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span id="realtime-server-clock" class="text-[11px] font-mono text-slate-400">--:--:--</span>
                                <button type="button" onclick="Admin.loadRealtimeStaff()" class="btn-glass text-xs py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold flex items-center gap-1">
                                    <i class="fas fa-sync-alt"></i> Làm mới
                                </button>
                            </div>
                        </div>

                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="border-b border-white/10 text-[11px] text-slate-400 bg-slate-900/40 uppercase">
                                        <th class="py-2.5 px-3">Nhân Viên</th>
                                        <th class="py-2.5 px-3">Vị Trí / Vai Trò</th>
                                        <th class="py-2.5 px-3">Giờ Check-in</th>
                                        <th class="py-2.5 px-3">Thời Gian Làm Việc</th>
                                        <th class="py-2.5 px-3">Mức Lương / Giờ</th>
                                        <th class="py-2.5 px-3">Trạng Thái</th>
                                        <th class="py-2.5 px-3">Thiết Bị / IP</th>
                                        <th class="py-2.5 px-3 text-right">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody id="realtime-staff-tbody" class="divide-y divide-white/5 text-xs">
                                    <!-- Rendered dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- ============================================ -->
                <!-- SUB-VIEW 2: QUẢN LÝ KHO & CHI PHÍ VẬT LIỆU -->
                <!-- ============================================ -->
                <div id="ops-subview-inventory" class="hidden space-y-4">
                    <!-- Inventory KPI Cards -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div class="liquid-glass-card p-3 border-l-4 border-sky-400">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mặt Hàng Nguyên Liệu</span>
                            <div id="inv-stat-total-items" class="text-2xl font-black text-sky-400 font-mono mt-1">0</div>
                            <span class="text-[10px] text-slate-400 mt-1 block">Trong danh mục kho</span>
                        </div>
                        <div class="liquid-glass-card p-3 border-l-4 border-emerald-400">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng Giá Trị Tồn Kho</span>
                            <div id="inv-stat-total-value" class="text-2xl font-black text-emerald-400 font-mono mt-1">0 đ</div>
                            <span class="text-[10px] text-slate-400 mt-1 block">Tính theo giá nhập gần nhất</span>
                        </div>
                        <div class="liquid-glass-card p-3 border-l-4 border-rose-400">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cảnh Báo Tồn Kho Thấp</span>
                            <div id="inv-stat-low-stock" class="text-2xl font-black text-rose-400 font-mono mt-1">0</div>
                            <span class="text-[10px] text-rose-300 mt-1 block">Cần nhập thêm hàng ngay</span>
                        </div>
                        <div class="liquid-glass-card p-3 border-l-4 border-amber-400">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chi Phí Mua Vật Liệu Tháng Này</span>
                            <div id="inv-stat-month-expense" class="text-2xl font-black text-amber-400 font-mono mt-1">0 đ</div>
                            <span class="text-[10px] text-slate-400 mt-1 block">Tổng tiền phiếu nhập kho</span>
                        </div>
                    </div>

                    <!-- Inventory Action Bar -->
                    <div class="p-3 bg-slate-900/60 rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                        <div class="flex items-center gap-2 flex-1 min-w-[240px]">
                            <div class="relative flex-1">
                                <i class="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                                <input type="text" id="inv-search-input" oninput="Admin.loadMaterials()" placeholder="Tìm theo tên nguyên liệu, mã NVL, nhà cung cấp..." class="liquid-input w-full pl-8 py-1.5 text-xs text-slate-200" />
                            </div>
                            <select id="inv-category-filter" onchange="Admin.loadMaterials()" class="liquid-input py-1.5 text-xs bg-slate-900 text-slate-300 w-44">
                                <option value="all">Tất cả nhóm</option>
                            </select>
                        </div>

                        <div class="flex items-center gap-2 shrink-0">
                            <button type="button" onclick="Admin.openSmartImportModal('manual')" class="btn-glass text-xs py-1.5 px-3 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border-emerald-500/40 font-bold flex items-center gap-1.5 shadow-sm" title="Hệ thống nhập kho đa phương thức (3 cách)">
                                <i class="fas fa-boxes-packing text-xs text-emerald-400"></i>
                                <span>+ Nhập Kho (3 Cách)</span>
                            </button>
                            <button type="button" onclick="Admin.openSmartImportModal('upload')" class="btn-glass text-xs py-1.5 px-3 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border-purple-500/40 font-bold flex items-center gap-1.5 shadow-sm" title="Quét & bóc tách hóa đơn mua hàng / viết tay bằng AI">
                                <i class="fas fa-bolt text-amber-300 text-xs"></i>
                                <span>⚡ Quét Hóa Đơn AI</span>
                            </button>
                            <button type="button" onclick="Admin.openStockTransactionModal('export')" class="btn-glass text-xs py-1.5 px-3 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border-rose-500/40 font-bold flex items-center gap-1.5 shadow-sm">
                                <i class="fas fa-minus-circle text-xs"></i>
                                <span>- Xuất Kho Sử Dụng</span>
                            </button>
                            <button type="button" onclick="Admin.openMaterialModal()" class="btn-glass text-xs py-1.5 px-3 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/40 font-bold flex items-center gap-1.5 shadow-sm">
                                <i class="fas fa-tag text-xs"></i>
                                <span>+ Thêm Nguyên Liệu</span>
                            </button>
                            <button type="button" onclick="Admin.openMaterialHistoryModal()" class="btn-glass text-xs py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10 font-bold flex items-center gap-1.5 shadow-sm">
                                <i class="fas fa-receipt text-xs"></i>
                                <span>Lịch Sử & Chi Phí</span>
                            </button>
                        </div>
                    </div>

                    <!-- Materials Table -->
                    <div class="liquid-glass rounded-xl border border-white/10 overflow-hidden">
                        <div class="overflow-x-auto custom-scrollbar">
                            <table class="w-full min-w-[1080px] text-left border-collapse">
                                <thead>
                                    <tr class="border-b border-white/10 text-[11px] text-slate-300 bg-slate-900/80 uppercase tracking-wider font-bold">
                                        <th class="py-3 px-3 whitespace-nowrap">Mã NVL</th>
                                        <th class="py-3 px-3 whitespace-nowrap">Tên Nguyên Vật Liệu</th>
                                        <th class="py-3 px-3 whitespace-nowrap">Nhóm</th>
                                        <th class="py-3 px-3 whitespace-nowrap text-center">Đơn Vị</th>
                                        <th class="py-3 px-3 whitespace-nowrap text-center">Tồn Kho Hiện Tại</th>
                                        <th class="py-3 px-3 whitespace-nowrap text-center">Định Mức Tối Thiểu</th>
                                        <th class="py-3 px-3 whitespace-nowrap text-right">Đơn Giá Nhập Gần Nhất</th>
                                        <th class="py-3 px-3 whitespace-nowrap text-right">Giá Trị Tồn</th>
                                        <th class="py-3 px-3 whitespace-nowrap">Nhà Cung Cấp</th>
                                        <th class="py-3 px-3 whitespace-nowrap text-right">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody id="inv-materials-tbody" class="divide-y divide-white/5 text-xs">
                                    <!-- Rendered dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- ============================================ -->
                <!-- SUB-VIEW 3: CHẤM CÔNG & TIỀN LƯƠNG (PAYROLL) -->
                <!-- ============================================ -->
                <div id="ops-subview-payroll" class="hidden space-y-4">
                    <!-- Payroll Month Selector & KPI -->
                    <div class="p-3 bg-slate-900/60 rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-calendar-alt text-sky-400 text-sm"></i>
                            <span class="text-xs font-bold text-slate-300">Chọn Tháng Bảng Lương:</span>
                            <input type="month" id="payroll-month-input" onchange="Admin.loadPayroll()" class="liquid-input py-1 px-2.5 text-xs font-mono font-bold text-sky-300 bg-slate-900" />
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-white/10 text-xs">
                                <span class="text-slate-400">Tổng Giờ Làm:</span>
                                <b id="payroll-total-hours" class="text-sky-400 font-mono ml-1">0 h</b>
                            </div>
                            <div class="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs">
                                <span class="text-emerald-300 font-semibold">Tổng Tiền Lương:</span>
                                <b id="payroll-total-salary" class="text-emerald-400 font-mono text-sm ml-1">0 đ</b>
                            </div>
                        </div>
                    </div>

                    <!-- Card: Cấu Hình Khung Giờ Ca Làm Việc Do Admin Quy Định -->
                    <div class="liquid-glass rounded-xl border border-amber-500/30 overflow-hidden">
                        <div class="p-3 bg-slate-900/80 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <div class="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-xs">
                                    <i class="fas fa-business-time"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-xs uppercase tracking-wide text-amber-300 flex items-center gap-1.5">
                                        CẤU HÌNH KHUNG GIỜ CA LÀM VIỆC & TỰ ĐỘNG CHỐT CA
                                    </h3>
                                    <p class="text-[11px] text-slate-400">Nếu nhân viên đăng nhập vào khung giờ ca làm việc mà hết giờ không bấm Đăng xuất, hệ thống sẽ tự động chốt ca</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <label class="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-300">
                                    <input type="checkbox" id="cfg-shift-autoclose-toggle" class="w-4 h-4 text-emerald-500 rounded border-slate-700 focus:ring-0 cursor-pointer" checked />
                                    <span>Tự Động Chốt Ca Khi Hết Giờ</span>
                                </label>
                                <button type="button" onclick="Admin.saveShiftSettings()" class="btn-glass text-xs py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border-amber-500/40 font-bold flex items-center gap-1.5 shadow-sm">
                                    <i class="fas fa-floppy-disk text-xs"></i>
                                    <span>Lưu Khung Giờ</span>
                                </button>
                            </div>
                        </div>

                        <div class="p-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-900/40">
                            <!-- Ca 1 -->
                            <div class="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="font-bold text-sky-300 flex items-center gap-1.5">
                                        <i class="fas fa-sun text-amber-400"></i> Ca 1 (Ca Sáng)
                                    </span>
                                    <input type="text" id="cfg-shift1-name" value="Ca 1 (Ca Sáng)" class="liquid-input py-0.5 px-1.5 text-[11px] w-32 text-right bg-slate-950 font-semibold text-slate-300" />
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-[10px] text-slate-400 mb-0.5">Giờ Bắt Đầu:</label>
                                        <input type="time" id="cfg-shift1-start" value="06:30" class="liquid-input py-1 px-2 text-xs w-full font-mono font-bold text-sky-400 bg-slate-950" />
                                    </div>
                                    <div>
                                        <label class="block text-[10px] text-slate-400 mb-0.5">Giờ Kết Thúc:</label>
                                        <input type="time" id="cfg-shift1-end" value="12:30" class="liquid-input py-1 px-2 text-xs w-full font-mono font-bold text-sky-400 bg-slate-950" />
                                    </div>
                                </div>
                            </div>

                            <!-- Ca 2 -->
                            <div class="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="font-bold text-purple-300 flex items-center gap-1.5">
                                        <i class="fas fa-moon text-indigo-400"></i> Ca 2 (Ca Chiều / Tối)
                                    </span>
                                    <input type="text" id="cfg-shift2-name" value="Ca 2 (Ca Chiều / Tối)" class="liquid-input py-0.5 px-1.5 text-[11px] w-36 text-right bg-slate-950 font-semibold text-slate-300" />
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-[10px] text-slate-400 mb-0.5">Giờ Bắt Đầu:</label>
                                        <input type="time" id="cfg-shift2-start" value="12:30" class="liquid-input py-1 px-2 text-xs w-full font-mono font-bold text-purple-400 bg-slate-950" />
                                    </div>
                                    <div>
                                        <label class="block text-[10px] text-slate-400 mb-0.5">Giờ Kết Thúc:</label>
                                        <input type="time" id="cfg-shift2-end" value="22:30" class="liquid-input py-1 px-2 text-xs w-full font-mono font-bold text-purple-400 bg-slate-950" />
                                    </div>
                                </div>
                            </div>

                            <!-- Grace Period -->
                            <div class="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col justify-between space-y-2">
                                <div>
                                    <span class="font-bold text-emerald-300 flex items-center gap-1.5">
                                        <i class="fas fa-stopwatch text-emerald-400"></i> Thời Gian Ân Hạn Tự Động Chốt
                                    </span>
                                    <p class="text-[10px] text-slate-400 mt-1">Sau khi hết giờ ca bao nhiêu phút mà nhân viên không bấm Thoát thì hệ thống sẽ tự động chốt</p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="number" id="cfg-shift-grace" value="15" min="0" max="60" class="liquid-input py-1 px-2 text-xs w-20 font-mono font-bold text-emerald-400 bg-slate-950" />
                                    <span class="text-slate-300 font-semibold text-xs">phút sau giờ hết ca</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Payroll Summary Table (Bảng lương nhân viên) -->
                    <div class="liquid-glass rounded-xl border border-white/10 overflow-hidden">
                        <div class="p-3 bg-slate-900/60 border-b border-white/10 flex items-center justify-between">
                            <h3 class="font-bold text-xs uppercase tracking-wide text-slate-200 flex items-center gap-1.5">
                                <i class="fas fa-calculator text-emerald-400"></i>
                                BẢNG TỔNG HỢP TIỀN LƯƠNG NHÂN VIÊN
                            </h3>
                            <span class="text-[11px] text-amber-300">💡 Lương = Tổng giờ làm thực tế × Lương/giờ (Tối đa 2 ca/ngày; Login/Logout quá 2 lần chỉ tính 2 ca)</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="border-b border-white/10 text-[11px] text-slate-400 bg-slate-900/40 uppercase">
                                        <th class="py-2.5 px-3">Mã NV</th>
                                        <th class="py-2.5 px-3">Họ Và Tên</th>
                                        <th class="py-2.5 px-3">Vị Trí / Vai Trò</th>
                                        <th class="py-2.5 px-3">Mức Lương / Giờ</th>
                                        <th class="py-2.5 px-3" title="Tối đa 2 ca/ngày theo giờ thực làm (Trường hợp login/logout nhiều lần vẫn chỉ tính tối đa 2 ca)">Số Ca Làm <i class="fas fa-circle-info text-amber-400 text-[10px]"></i></th>
                                        <th class="py-2.5 px-3">Tổng Số Giờ</th>
                                        <th class="py-2.5 px-3 text-right">Tổng Tiền Lương (VNĐ)</th>
                                        <th class="py-2.5 px-3 text-right">Cập Nhật</th>
                                    </tr>
                                </thead>
                                <tbody id="payroll-summary-tbody" class="divide-y divide-white/5 text-xs">
                                    <!-- Rendered dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Attendance Records Detail (Lịch sử chấm công chi tiết tự động khi login) -->
                    <div class="liquid-glass rounded-xl border border-white/10 overflow-hidden">
                        <div class="p-3 bg-slate-900/60 border-b border-white/10 flex items-center justify-between">
                            <h3 class="font-bold text-xs uppercase tracking-wide text-slate-200 flex items-center gap-1.5">
                                <i class="fas fa-fingerprint text-sky-400"></i>
                                NHẬT KÝ CHẤM CÔNG CHI TIẾT TỪNG CA
                            </h3>
                            <span class="text-[11px] text-slate-400">Ghi nhận tự động giờ vào ca khi nhân viên đăng nhập & giờ ra khi đăng xuất</span>
                        </div>
                        <div class="overflow-x-auto max-h-96">
                            <table class="w-full text-left border-collapse">
                                <thead class="sticky top-0 bg-slate-900 z-10">
                                    <tr class="border-b border-white/10 text-[11px] text-slate-400 uppercase">
                                        <th class="py-2.5 px-3">Ngày Làm</th>
                                        <th class="py-2.5 px-3">Nhân Viên</th>
                                        <th class="py-2.5 px-3">Giờ Vào (Check-in)</th>
                                        <th class="py-2.5 px-3">Giờ Ra (Check-out)</th>
                                        <th class="py-2.5 px-3">Số Giờ Làm</th>
                                        <th class="py-2.5 px-3">Lương / Giờ</th>
                                        <th class="py-2.5 px-3 text-right">Tiền Ca (VNĐ)</th>
                                        <th class="py-2.5 px-3 text-center">Trạng Thái</th>
                                    </tr>
                                </thead>
                                <tbody id="payroll-records-tbody" class="divide-y divide-white/5 text-xs">
                                    <!-- Rendered dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </section>

        <!-- ========================================== -->
        <!-- TAB 6: STORE SETTINGS & VIETQR -->
        <!-- ========================================== -->
        <section id="tab-settings" class="admin-section hidden flex-1 overflow-y-auto">
            <div class="max-w-2xl mx-auto liquid-glass p-6 rounded-2xl border border-white/10 space-y-5">
                <div class="border-b border-white/10 pb-3">
                    <h3 class="font-bold text-base text-sky-400">Cài Đặt Hệ Thống & Thanh Toán VietQR</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Thông tin in trên hóa đơn nhiệt và mã QR thanh toán ngân hàng</p>
                </div>

                <!-- Alert Notification Box -->
                <div id="settings-alert" class="hidden p-3 rounded-xl text-xs font-semibold flex items-center justify-between"></div>

                <form id="settings-form" onsubmit="saveStoreSettings(event)" class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Tên Quán / Cửa hàng:</label>
                        <input type="text" name="store_name" value="<?= htmlspecialchars($storeName) ?>" class="liquid-input w-full text-sm" required />
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold text-slate-300 mb-1">Số điện thoại / Hotline:</label>
                            <input type="text" name="store_hotline" value="<?= htmlspecialchars($storeHotline) ?>" class="liquid-input w-full text-sm" required />
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-300 mb-1">Mật khẩu Wifi in hóa đơn:</label>
                            <input type="text" name="store_wifi" value="<?= htmlspecialchars($storeWifi) ?>" class="liquid-input w-full text-sm" />
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Địa chỉ cửa hàng:</label>
                        <input type="text" name="store_address" value="<?= htmlspecialchars($storeAddress) ?>" class="liquid-input w-full text-sm" required />
                    </div>

                    <div class="p-4 rounded-xl bg-slate-900/80 border border-sky-500/20 space-y-3">
                        <div class="flex items-center justify-between">
                            <h4 class="font-bold text-xs uppercase tracking-wider text-sky-400"><i class="fas fa-qrcode mr-1"></i> Tích Hợp VietQR Tự Động</h4>
                            <button type="button" onclick="openBankPickerModal()" class="text-xs text-sky-400 hover:text-sky-300 font-semibold underline flex items-center gap-1 cursor-pointer">
                                <i class="fas fa-building-columns"></i> Tra cứu danh sách ngân hàng
                            </button>
                        </div>
                        
                        <div class="grid grid-cols-3 gap-3">
                            <div>
                                <div class="flex items-center justify-between mb-1">
                                    <label class="block text-[11px] text-slate-300">Mã Ngân Hàng (BIN):</label>
                                </div>
                                <input type="text" name="bank_id" id="setting-bank-id" list="bank-list" value="<?= htmlspecialchars($bankId) ?>" placeholder="MB, VCB, ACB..." class="liquid-input w-full text-xs font-mono font-bold" required />
                                <datalist id="bank-list">
                                    <option value="MB">MBBank - Ngân Hàng Quân Đội (970422)</option>
                                    <option value="VCB">Vietcombank - Ngoại Thương VN (970436)</option>
                                    <option value="TCB">Techcombank - Kỹ Thương VN (970407)</option>
                                    <option value="ICB">VietinBank - Công Thương VN (970415)</option>
                                    <option value="BIDV">BIDV - Đầu Tư & Phát Triển (970418)</option>
                                    <option value="ACB">ACB - Á Châu (970416)</option>
                                    <option value="VPB">VPBank - VN Thịnh Vượng (970454)</option>
                                    <option value="TPB">TPBank - Tiên Phong (970458)</option>
                                    <option value="STB">Sacombank - Sài Gòn Thương Tín (970403)</option>
                                    <option value="HDB">HDBank - Phát Triển TP.HCM (970437)</option>
                                    <option value="VIB">VIB - Quốc Tế VN (970441)</option>
                                    <option value="MSB">MSB - Hàng Hải VN (970426)</option>
                                    <option value="SHB">SHB - Sài Gòn - Hà Nội (970443)</option>
                                    <option value="VBA">Agribank - Nông Nghiệp & PTNT (970405)</option>
                                    <option value="OCB">OCB - Phương Đông (970448)</option>
                                    <option value="LPB">LPBank - Lộc Phát VN (970449)</option>
                                    <option value="SEAB">SeABank - Đông Nam Á (970440)</option>
                                    <option value="NAB">Nam A Bank - Nam Á (970428)</option>
                                    <option value="BVB">BVBank - Bản Việt (970455)</option>
                                    <option value="TIMO">Timo by BVBank (970454)</option>
                                    <option value="CAKE">Cake by VPBank (970468)</option>
                                </datalist>
                            </div>
                            <div>
                                <label class="block text-[11px] text-slate-300 mb-1">Số Tài Khoản:</label>
                                <input type="text" name="bank_account_no" value="<?= htmlspecialchars($bankAccountNo) ?>" placeholder="Nhập số tài khoản..." class="liquid-input w-full text-xs font-mono font-bold" required />
                            </div>
                            <div>
                                <label class="block text-[11px] text-slate-300 mb-1">Chủ Tài Khoản:</label>
                                <input type="text" name="bank_account_name" value="<?= htmlspecialchars($bankAccountName) ?>" placeholder="Tên in hoa không dấu..." class="liquid-input w-full text-xs uppercase font-bold" required />
                            </div>
                        </div>
                    </div>

                    <!-- Tích hợp Trí Tuệ Nhân Tạo (Google Gemini AI) -->
                    <div class="p-4 rounded-xl bg-slate-900/80 border border-purple-500/30 space-y-3">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <h4 class="font-bold text-xs uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                                <i class="fas fa-wand-magic-sparkles text-amber-400"></i> Trí Tuệ Nhân Tạo (Google Gemini Vision AI)
                            </h4>
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" class="text-xs text-purple-300 hover:text-white underline flex items-center gap-1">
                                <i class="fas fa-key text-amber-400"></i> Lấy API Key miễn phí (Google AI Studio)
                            </a>
                        </div>
                        <div>
                            <label class="block text-[11px] text-slate-300 mb-1">Google Gemini API Key:</label>
                            <input type="password" name="gemini_api_key" id="setting-gemini-api-key" value="<?= htmlspecialchars($geminiApiKey) ?>" placeholder="Dán mã API Key (AIzaSy...) tại đây để tự động nhận diện chữ viết tay" class="liquid-input w-full text-xs font-mono text-purple-300" />
                            <p class="text-[11px] text-slate-400 mt-1.5">
                                <i class="fas fa-circle-info text-sky-400 mr-1"></i>
                                Hỗ trợ phân tích ảnh chụp hóa đơn in nhiệt, phiếu mua hàng và <b>giấy viết tay</b> phức tạp thành mặt hàng nhập kho tự động.
                            </p>
                        </div>
                    </div>

                    <div class="flex justify-end pt-2">
                        <button type="submit" id="btn-save-settings" class="btn-glass-success text-sm py-2 px-5 font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20">
                            <i class="fas fa-save"></i> <span>Lưu Cấu Hình</span>
                        </button>
                    </div>
                </form>
            </div>
        </section>
    </main>

    <!-- Modal: Add / Edit Product -->
    <div id="product-modal" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content p-6 w-[500px] max-w-full text-white shadow-2xl border border-sky-500/30">
            <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                <h3 id="product-modal-title" class="font-bold text-base text-sky-400">Thêm Mặt Hàng Mới</h3>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="document.getElementById('product-modal').classList.remove('open')">&times;</button>
            </div>
            <input type="hidden" id="modal-prod-id" />
            <div class="space-y-3 text-xs">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Mã hàng (Code):</label>
                        <input type="text" id="modal-prod-code" placeholder="Để trống tự sinh" class="liquid-input w-full font-mono uppercase" />
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Nhóm hàng (*):</label>
                        <select id="modal-product-category" class="liquid-input w-full bg-slate-900"></select>
                    </div>
                </div>

                <div>
                    <label class="block font-semibold text-slate-300 mb-1">Tên món ăn / Đồ uống (*):</label>
                    <input type="text" id="modal-prod-name" placeholder="Ví dụ: Trà Sữa Oolong Nướng" class="liquid-input w-full font-bold text-sm" required />
                </div>

                <!-- Hình Ảnh & AI Image Assistant & 4:3 Cropper -->
                <div class="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
                    <div class="flex items-center justify-between">
                        <label class="block font-semibold text-slate-300">Hình ảnh minh họa món ăn:</label>
                        <span class="text-[10px] text-sky-300 flex items-center gap-1">
                            <i class="fas fa-crop-simple text-amber-400"></i> Chuẩn thẻ 4:3 (640×480)
                        </span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div id="modal-prod-img-box" class="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-950 border border-white/20 shrink-0 shadow-inner group cursor-pointer" onclick="Admin.openCropForCurrentDish()" title="Nhấn để cắt xén lại ảnh món ăn chuẩn 4:3">
                            <img id="modal-prod-img-preview" src="assets/images/dishes/default_dish.jpg" alt="Preview" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" onerror="this.src='assets/images/dishes/default_dish.jpg';" />
                            <div class="absolute inset-0 bg-slate-950/65 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[10px] font-semibold backdrop-blur-[2px]">
                                <i class="fas fa-crop-simple text-amber-400 text-sm mb-0.5"></i> Cắt 4:3
                            </div>
                        </div>
                        <div class="flex-1 space-y-2">
                            <input type="text" id="modal-prod-image" placeholder="assets/images/dishes/..." class="liquid-input w-full text-xs font-mono" oninput="document.getElementById('modal-prod-img-preview').src = this.value || 'assets/images/dishes/default_dish.jpg'" />
                            <div class="flex flex-wrap items-center gap-1.5">
                                <button type="button" onclick="Admin.aiGenerateDishImage()" class="btn-glass text-xs py-1.5 px-2.5 bg-purple-500/20 text-purple-300 hover:bg-purple-500 hover:text-white border border-purple-500/30 flex items-center gap-1 shadow">
                                    <i class="fas fa-wand-magic-sparkles text-amber-400"></i> AI Tạo Ảnh
                                </button>
                                <label class="btn-glass text-xs py-1.5 px-2.5 cursor-pointer flex items-center gap-1 hover:bg-slate-700 bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow">
                                    <i class="fas fa-upload"></i> Tải & Cắt Chuẩn
                                    <input type="file" id="modal-prod-image-file" accept="image/*" class="hidden" onchange="Admin.handleProductImageUpload(this)" />
                                </label>
                                <button type="button" onclick="Admin.openCropForCurrentDish()" class="btn-glass text-xs py-1.5 px-2.5 hover:bg-slate-700 flex items-center gap-1 text-amber-300 border border-amber-500/30 shadow" title="Cắt xén lại ảnh đang chọn theo chuẩn 4:3">
                                    <i class="fas fa-crop-simple"></i> Cắt 4:3
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Đơn vị tính:</label>
                        <input type="text" id="modal-prod-unit" value="ly" placeholder="ly, lon, cái..." class="liquid-input w-full" />
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Giá bán (*):</label>
                        <input type="number" id="modal-prod-saleprice" placeholder="30000" class="liquid-input w-full font-mono font-bold text-amber-400" required />
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Giá nhập:</label>
                        <input type="number" id="modal-prod-costprice" value="0" class="liquid-input w-full font-mono" />
                    </div>
                </div>

                <div class="pt-2">
                    <label class="flex items-center gap-2 cursor-pointer bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                        <input type="checkbox" id="modal-prod-topping" class="w-4 h-4 rounded text-sky-500" />
                        <span class="font-medium text-slate-200">Đây là món Topping thêm (Trân châu, phô mai, pudding...)</span>
                    </label>
                </div>
            </div>

            <div class="flex justify-end gap-2 mt-5 pt-3 border-t border-white/10">
                <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('product-modal').classList.remove('open')">Hủy</button>
                <button type="button" class="btn-glass-success text-xs py-2 px-5 font-bold" onclick="Admin.saveProduct()">Lưu Mặt Hàng</button>
            </div>
        </div>
    </div>

    <!-- Modal: Smart 4:3 Image Cropper (Tự Động & Chỉnh Tay Cắt Chuẩn 4:3) -->
    <div id="dish-cropper-modal" class="liquid-modal-overlay !z-[80]">
        <div class="liquid-glass liquid-modal-content p-5 w-[620px] max-w-[95vw] text-white shadow-2xl border border-sky-500/40 rounded-2xl relative flex flex-col">
            <!-- Modal Header -->
            <div class="flex justify-between items-center pb-3 border-b border-white/10 shrink-0">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 text-amber-300 border border-amber-500/40 flex items-center justify-center text-lg shadow-lg">
                        <i class="fas fa-crop-simple"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-base text-amber-400 flex items-center gap-2">
                            Cắt Xén Ảnh Món Ăn Chuẩn 4:3
                        </h3>
                        <p class="text-[11px] text-slate-400">Tự động căn chỉnh & phóng to/thu nhỏ đúng tỉ lệ thẻ món POS (640 × 480 px)</p>
                    </div>
                </div>
                <button type="button" class="text-slate-400 hover:text-white text-2xl transition-colors" onclick="DishCropper.close()">&times;</button>
            </div>

            <!-- Cropper Canvas Viewport -->
            <div class="my-3 flex flex-col items-center">
                <!-- 4:3 Frame Container -->
                <div class="relative w-full max-w-[480px] aspect-[4/3] bg-slate-950 rounded-xl overflow-hidden border-2 border-dashed border-sky-400/60 shadow-2xl flex items-center justify-center select-none group" id="cropper-frame-container" style="cursor: grab;">
                    <!-- Canvas for interactive crop -->
                    <canvas id="dish-cropper-canvas" class="w-full h-full block" width="640" height="480"></canvas>
                    
                    <!-- 3x3 Grid Overlay (Rule of Thirds) -->
                    <div class="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-sky-400/30">
                        <div class="border-r border-b border-white/15"></div>
                        <div class="border-r border-b border-white/15"></div>
                        <div class="border-b border-white/15"></div>
                        <div class="border-r border-b border-white/15"></div>
                        <div class="border-r border-b border-white/15"></div>
                        <div class="border-b border-white/15"></div>
                        <div class="border-r border-b border-white/15"></div>
                        <div class="border-r border-b border-white/15"></div>
                        <div></div>
                    </div>

                    <!-- Watermark Badges -->
                    <div class="absolute top-2 left-2 pointer-events-none bg-slate-900/85 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-sky-300 border border-sky-500/30 flex items-center gap-1 shadow">
                        <i class="fas fa-expand text-[9px]"></i> 4:3 POS Standard
                    </div>

                    <div class="absolute bottom-2 right-2 pointer-events-none bg-slate-900/85 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-amber-300 border border-amber-500/30 shadow">
                        <span id="cropper-res-indicator">640 × 480 px</span>
                    </div>
                </div>

                <!-- Guidance notes -->
                <div class="flex items-center justify-between w-full max-w-[480px] mt-2 text-[11px] text-slate-400 px-1">
                    <span><i class="fas fa-hand-pointer text-sky-400 mr-1"></i>Kéo chuột / vuốt để dịch chuyển</span>
                    <span><i class="fas fa-arrows-up-down text-sky-400 mr-1"></i>Cuộn chuột để zoom</span>
                </div>
            </div>

            <!-- Controls Toolbar -->
            <div class="bg-slate-900/80 rounded-xl p-3 border border-white/10 space-y-2.5">
                <div class="flex items-center gap-3">
                    <span class="text-xs text-slate-300 shrink-0 font-medium flex items-center gap-1.5">
                        <i class="fas fa-magnifying-glass text-sky-400"></i> Thu phóng:
                    </span>
                    <button type="button" class="btn-glass w-7 h-7 flex items-center justify-center text-xs text-slate-200" onclick="DishCropper.adjustZoom(-0.1)">-</button>
                    <input type="range" id="dish-cropper-zoom" min="0.5" max="3" step="0.05" value="1" class="flex-1 accent-sky-400 cursor-pointer" oninput="DishCropper.onZoomChange(this.value)" />
                    <button type="button" class="btn-glass w-7 h-7 flex items-center justify-center text-xs text-slate-200" onclick="DishCropper.adjustZoom(0.1)">+</button>
                    <span id="dish-cropper-zoom-val" class="text-xs font-mono text-sky-300 w-12 text-right">100%</span>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <div class="flex items-center gap-2">
                        <button type="button" class="btn-glass text-xs py-1.5 px-2.5 hover:bg-slate-700 text-slate-200 flex items-center gap-1" onclick="DishCropper.rotate()" title="Xoay 90 độ">
                            <i class="fas fa-rotate-right text-sky-400"></i> Xoay 90°
                        </button>
                        <button type="button" class="btn-glass text-xs py-1.5 px-2.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/30 flex items-center gap-1 font-semibold" onclick="DishCropper.autoCenterFit()" title="Tự động căn giữa theo tỉ lệ chuẩn 4:3">
                            <i class="fas fa-wand-magic-sparkles"></i> ✨ Căn Giữa Chuẩn 4:3
                        </button>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" class="btn-glass text-xs py-1.5 px-2.5 text-slate-400 hover:text-white" onclick="DishCropper.reset()">
                            <i class="fas fa-arrow-rotate-left mr-1"></i>Đặt Lại
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="flex items-center justify-between mt-4 pt-3 border-t border-white/10 shrink-0">
                <button type="button" class="btn-glass text-xs py-2 px-4 text-slate-300 hover:text-white" onclick="DishCropper.close()">
                    Hủy Bỏ
                </button>
                <div class="flex items-center gap-2">
                    <button type="button" class="btn-glass text-xs py-2 px-3 bg-purple-500/20 text-purple-300 hover:bg-purple-500 hover:text-white border border-purple-500/30 flex items-center gap-1 font-medium shadow" onclick="DishCropper.autoCropAndSaveNow()" title="Áp dụng căn chuẩn 4:3 tự động và lưu ngay">
                        <i class="fas fa-bolt text-amber-300"></i> Tự Động Cắt & Lưu Ngay
                    </button>
                    <button type="button" class="btn-glass-success text-xs py-2 px-5 font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20" onclick="DishCropper.confirmCrop()">
                        <i class="fas fa-check"></i> Áp Dụng & Lưu Ảnh
                    </button>
                </div>
            </div>
        </div>
    </div>


    <!-- Modal: Add / Edit Category -->
    <div id="category-modal" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content p-6 w-96 max-w-full text-white shadow-2xl border border-sky-500/30">
            <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                <h3 id="category-modal-title" class="font-bold text-base text-sky-400">Thêm Nhóm Hàng</h3>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="document.getElementById('category-modal').classList.remove('open')">&times;</button>
            </div>
            <input type="hidden" id="modal-cat-id" />
            <div class="space-y-3 text-xs">
                <div>
                    <label class="block font-semibold text-slate-300 mb-1">Tên nhóm hàng (*):</label>
                    <input type="text" id="modal-cat-name" placeholder="Ví dụ: TRÀ HOA QUẢ" class="liquid-input w-full font-bold uppercase" required />
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Icon FontAwesome:</label>
                        <input type="text" id="modal-cat-icon" value="coffee" placeholder="coffee, leaf..." class="liquid-input w-full" />
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Thứ tự hiển thị:</label>
                        <input type="number" id="modal-cat-order" value="0" class="liquid-input w-full" />
                    </div>
                </div>
            </div>

            <div class="flex justify-end gap-2 mt-5 pt-3 border-t border-white/10">
                <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('category-modal').classList.remove('open')">Hủy</button>
                <button type="button" class="btn-glass-success text-xs py-2 px-5 font-bold" onclick="Admin.saveCategory()">Lưu Nhóm</button>
            </div>
        </div>
    </div>

    <!-- Modal: Add / Edit User & Staff -->
    <div id="user-modal" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content p-6 w-[520px] max-w-full text-white shadow-2xl border border-sky-500/30">
            <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                <h3 id="user-modal-title" class="font-bold text-base text-sky-400">Thêm Người Dùng Mới</h3>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="document.getElementById('user-modal').classList.remove('open')">&times;</button>
            </div>
            <input type="hidden" id="modal-user-id" />
            <div class="space-y-3 text-xs">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Mã Định Danh (Mã User):</label>
                        <input type="text" id="modal-user-code" placeholder="Tự động: STF001, ACC001..." class="liquid-input w-full font-mono font-bold text-sky-300 uppercase" />
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Tài khoản đăng nhập (*):</label>
                        <input type="text" id="modal-user-username" placeholder="Ví dụ: phucvu3" class="liquid-input w-full font-bold" required />
                    </div>
                </div>

                <div>
                    <label class="block font-semibold text-slate-300 mb-1">Vai trò & Phân quyền (*):</label>
                    <select id="modal-user-role" onchange="Admin.onUserRoleChange()" class="liquid-input w-full bg-slate-900 font-bold text-sky-300">
                        <option value="waiter">1. Phục Vụ (Mã STF) - Chỉ thấy Order, Mở điện thoại</option>
                        <option value="cashier">2. Thu Ngân (Mã ACC) - Chỉ thấy Thu ngân, Mở điện thoại</option>
                        <option value="kitchen">3. Bếp / Bar (Mã KIT) - Chỉ thấy Bếp/Bar, Khóa món, Mở điện thoại</option>
                        <option value="admin">4. Quản Trị (Mã ADM) - Thấy toàn bộ hệ thống</option>
                        <option value="customer">5. Khách Hàng (Mã USR) - Xem tên quán & Quảng cáo</option>
                    </select>
                </div>

                <div>
                    <label class="block font-semibold text-slate-300 mb-1">Họ và tên người dùng (*):</label>
                    <input type="text" id="modal-user-fullname" placeholder="Ví dụ: Lê Hoàng Long" class="liquid-input w-full font-bold text-sm" required />
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Số điện thoại:</label>
                        <input type="text" id="modal-user-phone" placeholder="09xxxxxxxx" class="liquid-input w-full font-mono" />
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Mã PIN đăng nhập nhanh (4 số):</label>
                        <input type="text" id="modal-user-pincode" placeholder="1234" maxlength="6" class="liquid-input w-full font-mono font-bold text-amber-400" />
                    </div>
                </div>

                <div id="modal-user-pass-container">
                    <label class="block font-semibold text-slate-300 mb-1">Mật khẩu đăng nhập:</label>
                    <input type="password" id="modal-user-password" placeholder="Mặc định: 123456" class="liquid-input w-full" />
                </div>

                <div class="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-400 space-y-1">
                    <div><b class="text-sky-300">💡 Ghi chú phân quyền:</b></div>
                    <div>• <b>STF</b>: Chỉ được truy cập Order phục vụ & quét mã mở điện thoại.</div>
                    <div>• <b>ACC</b>: Chỉ được truy cập POS thu ngân & in lại hóa đơn.</div>
                    <div>• <b>KIT</b>: Chỉ được xem vé chế biến & mở danh sách món tạm khóa.</div>
                    <div>• <b>ADM</b>: Toàn quyền truy cập mọi tính năng và cấu hình hệ thống.</div>
                    <div>• <b>USR</b>: Trang khách hàng xem tên quán, menu & thông tin quảng cáo.</div>
                </div>
            </div>

            <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-white/10">
                <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('user-modal').classList.remove('open')">Hủy</button>
                <button type="button" class="btn-glass-success text-xs py-2 px-5 font-bold shadow-lg shadow-emerald-500/20" onclick="Admin.saveUser()">Lưu Người Dùng</button>
            </div>
        </div>
    </div>

    <!-- Modal: Reset Password / PIN -->
    <div id="reset-pass-modal" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content p-6 w-96 max-w-full text-white shadow-2xl border border-sky-500/30">
            <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                <h3 class="font-bold text-base text-sky-400">Đổi Mật Khẩu / Mã PIN</h3>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="document.getElementById('reset-pass-modal').classList.remove('open')">&times;</button>
            </div>
            <input type="hidden" id="reset-user-id" />
            <div class="space-y-3 text-xs">
                <div>
                    <label class="block font-semibold text-slate-300 mb-1">Mật khẩu mới (để trống nếu không đổi):</label>
                    <input type="password" id="reset-new-password" placeholder="Nhập mật khẩu mới" class="liquid-input w-full" />
                </div>
                <div>
                    <label class="block font-semibold text-slate-300 mb-1">Mã PIN mới (4 số đăng nhập nhanh):</label>
                    <input type="text" id="reset-new-pin" placeholder="Ví dụ: 8888" maxlength="6" class="liquid-input w-full font-mono font-bold text-amber-400" />
                </div>
            </div>
            <div class="flex justify-end gap-2 mt-5 pt-3 border-t border-white/10">
                <button type="button" class="btn-glass text-xs py-2 px-4" onclick="document.getElementById('reset-pass-modal').classList.remove('open')">Hủy</button>
                <button type="button" class="btn-glass-success text-xs py-2 px-5 font-bold" onclick="Admin.submitResetPassword()">Cập Nhật</button>
            </div>
        </div>
    </div>

    <!-- Modal: Cloud Sync to MySQL -->
    <div id="cloud-sync-modal" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content p-6 w-[560px] max-w-full text-white shadow-2xl border border-cyan-500/40 rounded-2xl relative max-h-[92vh] overflow-y-auto">
            <!-- Header -->
            <div class="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-lg">
                        <i class="fas fa-cloud-arrow-up"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-base text-cyan-300">ĐỒNG BỘ CƠ SỞ DỮ LIỆU LÊN CLOUD (MySQL)</h3>
                        <p class="text-[11px] text-slate-400">Chuyển toàn bộ dữ liệu POS từ SQLite cục bộ lên máy chủ MySQL</p>
                    </div>
                </div>
                <button type="button" class="text-slate-400 hover:text-white text-2xl transition" onclick="Admin.closeCloudSyncModal()">&times;</button>
            </div>

            <!-- Diagnostic Alert Box (Real-time feedback) -->
            <div id="cloud-sync-alert" class="hidden mb-4 p-3.5 rounded-xl border text-xs leading-relaxed transition-all duration-300">
                <!-- Injected via JS -->
            </div>

            <!-- Parameters Form -->
            <form id="cloud-sync-form" onsubmit="event.preventDefault();" class="space-y-3 text-xs">
                <div class="grid grid-cols-3 gap-2.5">
                    <div class="col-span-2">
                        <label class="block font-semibold text-slate-300 mb-1">Máy chủ MySQL (Host / IP) (*):</label>
                        <input type="text" id="sync-host" value="127.0.0.1" placeholder="Ví dụ: 127.0.0.1 hoặc db.example.com" class="liquid-input w-full font-mono text-slate-100 font-bold" required />
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Cổng (Port) (*):</label>
                        <input type="number" id="sync-port" value="3306" placeholder="3306" class="liquid-input w-full font-mono text-slate-100" required />
                    </div>
                </div>

                <div>
                    <label class="block font-semibold text-slate-300 mb-1">Tên Cơ Sở Dữ Liệu (Database Name) (*):</label>
                    <input type="text" id="sync-database" value="pos_sale_app" placeholder="pos_sale_app" class="liquid-input w-full font-mono text-cyan-300 font-bold" required />
                </div>

                <div class="grid grid-cols-2 gap-2.5">
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Tên Người Dùng (Username) (*):</label>
                        <input type="text" id="sync-user" value="root" placeholder="root" class="liquid-input w-full font-mono text-slate-100" required />
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Mật Khẩu (Password):</label>
                        <div class="relative">
                            <input type="password" id="sync-password" placeholder="Nhập mật khẩu (nếu có)" class="liquid-input w-full font-mono pr-8 text-slate-100" />
                            <button type="button" onclick="Admin.toggleSyncPasswordVisibility()" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white" tabindex="-1">
                                <i id="sync-pass-eye" class="far fa-eye"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Checkbox Options -->
                <div class="pt-2 space-y-2 border-t border-white/5">
                    <label class="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                        <input type="checkbox" id="sync-auto-create-db" checked class="rounded border-slate-600 text-cyan-500 focus:ring-0 bg-slate-800" />
                        <span>Tự động tạo Database trên MySQL nếu chưa tồn tại</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                        <input type="checkbox" id="sync-save-config" checked class="rounded border-slate-600 text-cyan-500 focus:ring-0 bg-slate-800" />
                        <span>Lưu thông số này làm cấu hình mặc định (trong <code>config.php</code>)</span>
                    </label>
                </div>

                <!-- Sync Statistics Summary (after sync) -->
                <div id="sync-result-box" class="hidden mt-3 p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30">
                    <div class="font-bold text-cyan-300 mb-2 flex items-center gap-1.5">
                        <i class="fas fa-circle-check text-emerald-400"></i>
                        <span>Chi tiết các bảng đã đồng bộ:</span>
                    </div>
                    <div id="sync-result-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                        <!-- table counts -->
                    </div>
                </div>
            </form>

            <!-- Actions Footer -->
            <div class="flex flex-wrap items-center justify-between gap-2 mt-5 pt-3 border-t border-white/10">
                <button type="button" onclick="Admin.testCloudConnection()" id="btn-sync-test" class="btn-glass text-xs py-2 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10 flex items-center gap-1.5 font-bold">
                    <i class="fas fa-plug text-sky-400"></i>
                    <span>Kiểm Tra Kết Nối</span>
                </button>

                <div class="flex items-center gap-2">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="Admin.closeCloudSyncModal()">Đóng</button>
                    <button type="button" onclick="Admin.startCloudSync()" id="btn-sync-start" class="btn-glass text-xs py-2 px-5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/30">
                        <i class="fas fa-cloud-arrow-up"></i>
                        <span>Bắt Đầu Đồng Bộ</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal: VietQR Bank Picker -->
    <div id="bank-picker-modal" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content p-6 w-[700px] max-w-full text-white shadow-2xl border border-sky-500/30 flex flex-col max-h-[85vh]">
            <div class="flex justify-between items-center pb-3 border-b border-white/10">
                <div>
                    <h3 class="font-bold text-base text-sky-400 flex items-center gap-2">
                        <i class="fas fa-building-columns"></i>
                        <span>Danh Sách Mã Ngân Hàng VietQR / NAPAS</span>
                    </h3>
                    <p class="text-xs text-slate-400 mt-0.5">Nhấp vào một ngân hàng bên dưới để tự động điền mã vào ô cấu hình</p>
                </div>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="closeBankPickerModal()">&times;</button>
            </div>

            <!-- Search Bank Input -->
            <div class="my-3">
                <div class="relative">
                    <i class="fas fa-search absolute left-3.5 top-3 text-slate-400 text-xs"></i>
                    <input type="text" id="bank-search-input" oninput="filterBankList(this.value)" placeholder="Tìm kiếm theo tên ngân hàng, mã viết tắt (MB, VCB...) hoặc mã BIN (970422...)" class="liquid-input w-full pl-9 text-xs" />
                </div>
            </div>

            <!-- Bank List Container (Scrollable) -->
            <div id="bank-list-container" class="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                <!-- Banks will be dynamically rendered or filtered here -->
            </div>

            <!-- Footer with External Documentation Link -->
            <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                <a href="https://vietqr.io/danh-sach-api-cac-ngan-hang/" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:text-sky-300 flex items-center gap-1.5 underline">
                    <i class="fas fa-arrow-up-right-from-square"></i>
                    <span>Xem cổng tra cứu chính thức tại VietQR.io</span>
                </a>
                <button type="button" class="btn-glass text-xs py-1.5 px-4" onclick="closeBankPickerModal()">Đóng</button>
            </div>
        </div>
    </div>

    <!-- Modal: Thêm / Sửa Nguyên Vật Liệu (modal-material) -->
    <div id="modal-material" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content p-6 w-[520px] max-w-full text-white shadow-2xl border border-sky-500/40 rounded-2xl relative">
            <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                <h3 id="modal-material-title" class="font-bold text-base text-sky-400 flex items-center gap-2">
                    <i class="fas fa-boxes-stacked"></i> Thêm Nguyên Vật Liệu Mới
                </h3>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="Admin.closeMaterialModal()">&times;</button>
            </div>
            <form id="form-material" onsubmit="Admin.submitMaterial(event)">
                <input type="hidden" id="modal-mat-id" />
                <div class="space-y-3 text-xs">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block font-semibold text-slate-300 mb-1">Mã NVL (Để trống tự tạo):</label>
                            <input type="text" id="modal-mat-code" placeholder="Ví dụ: NVL015..." class="liquid-input w-full font-mono font-bold text-amber-400 uppercase" />
                        </div>
                        <div>
                            <label class="block font-semibold text-slate-300 mb-1">Nhóm nguyên liệu:</label>
                            <input type="text" id="modal-mat-category" list="mat-categories-datalist" placeholder="Cà phê & Trà, Sữa & Bơ..." class="liquid-input w-full" required />
                            <datalist id="mat-categories-datalist">
                                <option value="Cà phê & Trà">
                                <option value="Sữa & Bơ">
                                <option value="Thực phẩm tươi">
                                <option value="Bánh mì & Mì">
                                <option value="Topping & Đá xay">
                                <option value="Bao bì & Dụng cụ">
                            </datalist>
                        </div>
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Tên nguyên vật liệu <span class="text-rose-400">*</span>:</label>
                        <input type="text" id="modal-mat-name" placeholder="Ví dụ: Hạt Cà Phê Robusta..." class="liquid-input w-full font-bold text-sm text-slate-100" required />
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div>
                            <label class="block font-semibold text-slate-300 mb-1">Đơn vị tính:</label>
                            <input type="text" id="modal-mat-unit" placeholder="kg, lít, hộp, gói..." value="kg" class="liquid-input w-full" required />
                        </div>
                        <div>
                            <label class="block font-semibold text-slate-300 mb-1">Số lượng ban đầu:</label>
                            <input type="number" step="0.1" id="modal-mat-qty" value="0" class="liquid-input w-full font-mono" />
                        </div>
                        <div>
                            <label class="block font-semibold text-slate-300 mb-1">Định mức tối thiểu:</label>
                            <input type="number" step="0.1" id="modal-mat-minqty" value="5" class="liquid-input w-full font-mono text-rose-300" />
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block font-semibold text-slate-300 mb-1">Đơn giá nhập gần nhất (VNĐ):</label>
                            <input type="number" id="modal-mat-cost" value="0" placeholder="140000" class="liquid-input w-full font-mono font-bold text-emerald-400" />
                        </div>
                        <div>
                            <label class="block font-semibold text-slate-300 mb-1">Nhà cung cấp:</label>
                            <input type="text" id="modal-mat-supplier" placeholder="Tên đại lý / nhà phân phối..." class="liquid-input w-full" />
                        </div>
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Ghi chú:</label>
                        <textarea id="modal-mat-note" rows="2" placeholder="Ghi chú thêm về bảo quản, thương hiệu..." class="liquid-input w-full"></textarea>
                    </div>
                </div>
                <div class="flex justify-end gap-2 mt-5 pt-3 border-t border-white/10">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="Admin.closeMaterialModal()">Hủy</button>
                    <button type="submit" class="btn-glass-primary text-xs py-2 px-5 font-bold">Lưu Thông Tin</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal: Nhập Kho Thông Minh Đa Phương Thức (3 Cách & AI OCR) -->
    <div id="modal-smart-import" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content modal-2xl p-6 w-[1240px] max-w-[96vw] max-h-[92vh] text-white shadow-2xl border border-emerald-500/40 rounded-2xl relative flex flex-col" style="width: 1240px !important; max-width: 96vw !important;">
            <!-- Modal Header -->
            <div class="flex justify-between items-center pb-3 border-b border-white/10 shrink-0">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/30 to-sky-500/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center text-lg">
                        <i class="fas fa-boxes-packing"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-base text-white flex items-center gap-2">
                            NHẬP KHO NGUYÊN VẬT LIỆU & CHI PHÍ
                            <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider font-semibold">Trí Tuệ Nhân Tạo AI</span>
                        </h3>
                        <p class="text-[11px] text-slate-400">Hỗ trợ 3 phương thức: 1. Thủ Công • 2. Tải Ảnh Hóa Đơn • 3. Chụp Ảnh Camera (Tự động nhận diện & gán mã kho)</p>
                    </div>
                </div>
                <button type="button" class="text-slate-400 hover:text-white text-2xl transition-colors" onclick="Admin.closeSmartImportModal()">&times;</button>
            </div>

            <!-- Tab Selector Bar: 3 Phương thức nhập kho -->
            <div class="flex items-center gap-2 p-1.5 bg-slate-900/80 rounded-xl border border-white/10 my-3 shrink-0">
                <button type="button" id="tab-btn-import-manual" onclick="Admin.switchImportMethod('manual')" class="import-tab-btn flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
                    <i class="fas fa-keyboard text-emerald-400"></i>
                    <span>1. Nhập Thủ Công</span>
                </button>
                <button type="button" id="tab-btn-import-upload" onclick="Admin.switchImportMethod('upload')" class="import-tab-btn flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all text-slate-400 hover:text-white border border-transparent">
                    <i class="fas fa-cloud-arrow-up text-sky-400"></i>
                    <span>2. Tải Ảnh Hóa Đơn / Giấy Viết Tay</span>
                </button>
                <button type="button" id="tab-btn-import-camera" onclick="Admin.switchImportMethod('camera')" class="import-tab-btn flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all text-slate-400 hover:text-white border border-transparent">
                    <i class="fas fa-camera text-purple-400"></i>
                    <span>3. Chụp Trực Tiếp Qua Camera</span>
                </button>
            </div>

            <!-- Scrollable Body Container -->
            <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">
                
                <!-- ================= TAB 1: NHẬP THỦ CÔNG ================= -->
                <div id="import-pane-manual" class="space-y-3">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/10 text-xs">
                        <div>
                            <label class="block font-semibold text-slate-300 mb-1">Nhà cung cấp (người bán):</label>
                            <input type="text" id="manual-import-supplier" placeholder="Ví dụ: Đại lý Cà phê Buôn Ma Thuột (để trống nếu không có)" class="liquid-input w-full" />
                        </div>
                        <div>
                            <label class="block font-semibold text-slate-300 mb-1">Số phiếu / Hóa đơn tham chiếu:</label>
                            <input type="text" id="manual-import-invoice-no" placeholder="Ví dụ: HD-10294" class="liquid-input w-full" />
                        </div>
                        <div>
                            <label class="block font-semibold text-slate-300 mb-1">Ghi chú phiếu nhập:</label>
                            <input type="text" id="manual-import-note" placeholder="Nhập kho định kỳ..." class="liquid-input w-full" />
                        </div>
                    </div>

                    <!-- Manual Items Table -->
                    <div class="liquid-glass rounded-xl border border-white/10 overflow-hidden">
                        <div class="p-2.5 bg-slate-900/60 border-b border-white/10 flex items-center justify-between text-xs">
                            <span class="font-bold text-slate-300 flex items-center gap-1.5">
                                <i class="fas fa-list-check text-emerald-400"></i>
                                DANH SÁCH MẶT HÀNG NHẬP KHO
                            </span>
                            <button type="button" onclick="Admin.addManualImportRow()" class="btn-glass text-[11px] py-1 px-2.5 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/40 font-bold flex items-center gap-1">
                                <i class="fas fa-plus"></i> + Thêm Mặt Hàng
                            </button>
                        </div>
                        <div class="overflow-x-auto custom-scrollbar">
                            <table class="w-full min-w-[960px] text-left border-collapse text-xs">
                                <thead>
                                    <tr class="border-b border-white/10 text-[11px] text-slate-300 bg-slate-900/80 uppercase tracking-wider font-bold">
                                        <th class="py-3 px-3 w-[360px] whitespace-nowrap">Nguyên Vật Liệu</th>
                                        <th class="py-3 px-3 w-[120px] whitespace-nowrap text-center">Số Lượng</th>
                                        <th class="py-3 px-3 w-[90px] whitespace-nowrap text-center">ĐVT</th>
                                        <th class="py-3 px-3 w-[170px] whitespace-nowrap text-right">Đơn Giá Mua (VNĐ)</th>
                                        <th class="py-3 px-3 w-[180px] whitespace-nowrap text-right">Thành Tiền (VNĐ)</th>
                                        <th class="py-3 px-2 text-center w-[48px] whitespace-nowrap">Xóa</th>
                                    </tr>
                                </thead>
                                <tbody id="manual-import-tbody" class="divide-y divide-white/5">
                                    <!-- Dynamic rows -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- ================= TAB 2: TẢI ẢNH HÓA ĐƠN & FOLDER ================= -->
                <div id="import-pane-upload" class="hidden space-y-3">
                    <!-- Ẩn các file input cho phép chọn nhiều ảnh hoặc chọn folder -->
                    <input type="file" id="invoice-file-input" accept="image/*" multiple class="hidden" onchange="Admin.onInvoiceFilesSelected(event)" />
                    <input type="file" id="invoice-folder-input" webkitdirectory directory multiple class="hidden" onchange="Admin.onInvoiceFilesSelected(event)" />

                    <!-- Khung Dropzone kéo thả file / folder (chỉ hiện khi chưa có ảnh) -->
                    <div id="invoice-dropzone" class="border-2 border-dashed border-sky-500/40 hover:border-sky-400 bg-sky-500/5 hover:bg-sky-500/10 rounded-2xl p-5 text-center transition-all flex flex-col items-center justify-center gap-2 group">
                        <div class="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                            <i class="fas fa-cloud-arrow-up"></i>
                        </div>
                        <div class="text-sm font-bold text-slate-200">Kéo thả ảnh hóa đơn / giấy viết tay hoặc cả thư mục (folder) vào đây</div>
                        <p class="text-xs text-slate-400">Hỗ trợ chọn cùng lúc <b class="text-sky-300">nhiều hình ảnh</b> hoặc <b class="text-purple-300">toàn bộ thư mục (Folder)</b></p>
                        <div class="flex items-center flex-wrap justify-center gap-2 mt-2">
                            <button type="button" onclick="document.getElementById('invoice-file-input').click();" class="btn-glass text-xs py-1.5 px-3.5 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/40 font-bold flex items-center gap-1.5 shadow-sm active:scale-95">
                                <i class="fas fa-images"></i>
                                <span>+ Chọn Nhiều Ảnh</span>
                            </button>
                            <button type="button" onclick="document.getElementById('invoice-folder-input').click();" class="btn-glass text-xs py-1.5 px-3.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border-indigo-500/40 font-bold flex items-center gap-1.5 shadow-sm active:scale-95">
                                <i class="fas fa-folder-open"></i>
                                <span>📂 Chọn Thư Mục (Folder)</span>
                            </button>
                            <button type="button" onclick="Admin.loadSampleInvoiceDemo();" class="btn-glass text-xs py-1.5 px-3 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border-purple-500/40 font-bold flex items-center gap-1.5 active:scale-95">
                                <i class="fas fa-wand-magic-sparkles"></i>
                                <span>Hóa đơn mẫu</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- ================= TAB 3: CHỤP ẢNH QUA CAMERA ================= -->
                <div id="import-pane-camera" class="hidden space-y-3">
                    <div class="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/40 text-center flex flex-col items-center justify-center relative overflow-hidden">
                        <div id="camera-viewport-container" class="w-full max-w-lg aspect-video rounded-xl bg-black/60 border border-white/10 relative overflow-hidden flex items-center justify-center mb-3">
                            <video id="camera-stream-video" autoplay playsinline class="w-full h-full object-cover hidden"></video>
                            <div id="camera-placeholder" class="flex flex-col items-center gap-2 text-slate-400 py-8">
                                <i class="fas fa-video-slash text-3xl text-slate-500"></i>
                                <span class="text-xs">Camera chưa được bật</span>
                                <span class="text-[11px] text-slate-500">Nhấn nút bên dưới để cấp quyền mở Webcam / Camera máy tính</span>
                            </div>
                            <!-- Camera Alignment Guide Overlay -->
                            <div id="camera-guide-overlay" class="absolute inset-4 border-2 border-dashed border-emerald-400/50 rounded-lg pointer-events-none hidden flex items-center justify-center">
                                <span class="text-[10px] bg-black/70 text-emerald-300 px-2 py-0.5 rounded font-mono">Đặt hóa đơn vừa khung này</span>
                            </div>
                        </div>

                        <!-- Camera Controls -->
                        <div class="flex items-center gap-3">
                            <button type="button" id="btn-start-camera" onclick="Admin.startCamera()" class="btn-glass text-xs py-2 px-4 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border-purple-500/40 font-bold flex items-center gap-1.5 shadow-md">
                                <i class="fas fa-power-off"></i> Bật Camera
                            </button>
                            <button type="button" id="btn-snap-camera" onclick="Admin.takeCameraSnapshot()" class="btn-glass-success text-xs py-2 px-5 font-bold flex items-center gap-1.5 shadow-lg hidden">
                                <i class="fas fa-circle-dot text-rose-400 animate-pulse"></i> Chụp Ảnh Hóa Đơn
                            </button>
                            <button type="button" id="btn-stop-camera" onclick="Admin.stopCamera()" class="btn-glass text-xs py-2 px-3 text-slate-400 hover:text-white hidden">
                                <i class="fas fa-stop"></i> Tắt
                            </button>
                        </div>
                    </div>
                </div>

                <!-- ================= KHU VỰC MEDIUM ICON GALLERY (DANH SÁCH ẢNH SIÊU GỌN GÀNG, CÓ NÚT XÓA TỪNG ẢNH & XÓA HẾT) ================= -->
                <div id="import-image-gallery-panel" class="hidden p-3 rounded-2xl bg-slate-900/90 border border-purple-500/40 space-y-2.5 shadow-xl">
                    <!-- Gallery Top Toolbar: Đếm số lượng, Thêm ảnh, Xóa hết & Nút AI -->
                    <div class="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/10">
                        <div class="flex items-center gap-2.5 flex-wrap">
                            <div class="flex items-center gap-1.5 text-xs font-bold text-white">
                                <i class="fas fa-photo-film text-purple-400"></i>
                                <span>ĐÃ CHỌN:</span>
                                <span id="gallery-count-badge" class="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 font-mono text-xs border border-purple-500/40">0 ảnh</span>
                            </div>
                            <button type="button" onclick="document.getElementById('invoice-file-input').click()" class="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded-lg border border-sky-500/20 font-medium">
                                <i class="fas fa-plus"></i> Thêm ảnh
                            </button>
                            <button type="button" onclick="document.getElementById('invoice-folder-input').click()" class="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/20 font-medium">
                                <i class="fas fa-folder-plus"></i> Thêm folder
                            </button>
                            <button type="button" onclick="Admin.removeAllInvoiceImages()" class="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-500/20 font-medium" title="Xóa bỏ tất cả ảnh này để chọn lại từ đầu">
                                <i class="fas fa-trash-can"></i> <span>Xóa tất cả</span>
                            </button>
                        </div>

                        <!-- Bên phải: API Key & Nút Phân Tích Tất Cả Bằng AI -->
                        <div class="flex items-center gap-2.5 shrink-0">
                            <div class="relative flex items-center gap-1">
                                <input type="password" id="import-gemini-api-key" value="<?= htmlspecialchars($geminiApiKey) ?>" placeholder="API Key" title="Gemini API Key (Tự động lưu)" class="liquid-input py-1.5 px-2.5 text-xs bg-slate-950 w-28 sm:w-36 text-purple-300 placeholder-slate-500 border-purple-500/30 font-mono" />
                                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" class="text-xs text-amber-400 hover:text-amber-300 p-0.5" title="Lấy API Key Google Gemini miễn phí">
                                    <i class="fas fa-key"></i>
                                </a>
                            </div>
                            <button type="button" id="btn-trigger-ai-scan" onclick="Admin.runAiInvoiceScan()" class="btn-glass text-xs py-2 px-5 bg-gradient-to-r from-purple-600 via-sky-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-black border border-purple-400/50 flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all active:scale-95">
                                <i class="fas fa-bolt text-amber-300"></i>
                                <span id="btn-ai-scan-label">PHÂN TÍCH TẤT CẢ BẰNG AI</span>
                            </button>
                        </div>
                    </div>

                    <!-- Medium Icon Gallery List (Dãy các Medium Icon ~85x85px cuộn ngang mượt mà) -->
                    <div id="gallery-items-container" class="flex items-center gap-3 overflow-x-auto custom-scrollbar p-1 min-h-[110px]">
                        <!-- Render dynamic medium icon cards here -->
                    </div>
                </div>

                <!-- AI Scanning Radar Animation (Thanh mỏng tinh tế) -->
                <div id="import-ai-scanning-status" class="hidden p-2.5 px-4 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-between gap-3 text-xs shadow-md">
                    <div class="flex items-center gap-2 text-purple-300 font-bold">
                        <span class="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping shrink-0"></span>
                        <span id="ai-scan-status-text">Đang phân tích hình ảnh và bóc tách dữ liệu bằng Google Gemini 3.5 Flash...</span>
                    </div>
                    <div class="w-40 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
                        <div class="h-full bg-gradient-to-r from-purple-500 via-sky-400 to-emerald-400 animate-pulse w-full"></div>
                    </div>
                </div>

                <!-- ================= BẢNG KẾT QUẢ DUYỆT NHẬP KHO ================= -->
                <div id="import-review-section" class="space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-xs">
                        <div class="flex items-center gap-2 flex-1 min-w-[280px]">
                            <span class="font-bold text-slate-300 shrink-0">Nhà cung cấp:</span>
                            <input type="text" id="review-supplier-input" placeholder="Tên nhà cung cấp (để trống nếu không có)" class="liquid-input flex-1 py-1 text-xs text-sky-300 font-semibold" />
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-slate-400">Số HĐ:</span>
                            <input type="text" id="review-invoice-no-input" placeholder="HD-..." class="liquid-input w-32 py-1 text-xs" />
                        </div>
                    </div>

                    <div class="liquid-glass rounded-xl border border-white/10 overflow-hidden">
                        <div class="p-2.5 bg-slate-900/80 border-b border-white/10 flex items-center justify-between text-xs">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-white flex items-center gap-1.5">
                                    <i class="fas fa-clipboard-check text-emerald-400"></i>
                                    KẾT QUẢ ĐỐI SOÁT & NHẬP KHO
                                </span>
                                <span id="review-ai-badge" class="hidden text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Google Gemini AI</span>
                            </div>
                            <button type="button" onclick="Admin.addReviewRow()" class="btn-glass text-[11px] py-1 px-2.5 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/30 font-bold flex items-center gap-1">
                                <i class="fas fa-plus"></i> + Bổ sung dòng
                            </button>
                        </div>

                        <div class="overflow-x-auto custom-scrollbar rounded-xl border border-white/10 bg-slate-950/40">
                            <table class="w-full min-w-[1080px] text-left border-collapse text-xs">
                                <thead>
                                    <tr class="border-b border-white/10 text-[11px] text-slate-300 bg-slate-900/90 uppercase tracking-wider font-bold">
                                        <th class="py-3 px-3 w-[320px] whitespace-nowrap">Tên Hàng Hóa Trong Kho</th>
                                        <th class="py-3 px-3 w-[200px] whitespace-nowrap">Tên Ghi Trên Hóa Đơn</th>
                                        <th class="py-3 px-3 w-[110px] whitespace-nowrap text-center">Số Lượng</th>
                                        <th class="py-3 px-3 w-[80px] whitespace-nowrap text-center">ĐVT</th>
                                        <th class="py-3 px-3 w-[150px] whitespace-nowrap text-right" title="Tự động = Thành tiền ÷ Số lượng">Đơn Giá Mua</th>
                                        <th class="py-3 px-3 w-[170px] whitespace-nowrap text-right" title="Nhập thành tiền để tự tính đơn giá">Thành Tiền (VNĐ)</th>
                                        <th class="py-3 px-2 text-center w-[48px] whitespace-nowrap">Xóa</th>
                                    </tr>
                                </thead>
                                <tbody id="review-items-tbody" class="divide-y divide-white/5">
                                    <!-- Dynamic review rows rendered here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Modal Footer: Summary & Action Buttons -->
            <div class="pt-3 mt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div class="flex items-center gap-3">
                    <div class="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 flex items-center gap-2">
                        <span class="text-xs text-slate-400">Số mặt hàng:</span>
                        <b id="import-footer-item-count" class="text-sm font-mono text-sky-400">0</b>
                    </div>
                    <div class="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center gap-2">
                        <span class="text-xs text-emerald-300 font-semibold">TỔNG CHI PHÍ NHẬP KHO:</span>
                        <b id="import-footer-total-cost" class="text-base font-mono text-emerald-300 font-bold">0 đ</b>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" class="btn-glass text-xs py-2 px-4 text-slate-400 hover:text-white" onclick="Admin.closeSmartImportModal()">Hủy Bỏ</button>
                    <button type="button" id="btn-submit-smart-import" onclick="Admin.commitSmartImport()" class="btn-glass-success text-xs py-2 px-6 font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
                        <i class="fas fa-check-double"></i>
                        <span>XÁC NHẬN NHẬP KHO & LƯU CHI PHÍ</span>
                    </button>
                </div>
            </div>

        </div>
    </div>

    <!-- Modal: Phiếu Nhập / Xuất Kho & Chi Phí Vật Liệu (modal-stock-trans) -->
    <div id="modal-stock-trans" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content p-6 w-[540px] max-w-full text-white shadow-2xl border border-emerald-500/40 rounded-2xl relative">
            <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                <h3 id="modal-stock-trans-title" class="font-bold text-base text-emerald-400 flex items-center gap-2">
                    <i class="fas fa-file-invoice-dollar"></i> Lập Phiếu Nhập Kho (Chi Phí Mua Hàng)
                </h3>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="Admin.closeStockTransactionModal()">&times;</button>
            </div>
            <form id="form-stock-trans" onsubmit="Admin.submitStockTransaction(event)">
                <input type="hidden" id="modal-trans-type" value="import" />
                <div class="space-y-3.5 text-xs">
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Chọn nguyên vật liệu <span class="text-rose-400">*</span>:</label>
                        <select id="modal-trans-mat-id" onchange="Admin.onStockMatSelected()" class="liquid-input w-full bg-slate-900 font-bold text-sky-300" required>
                            <!-- Material options injected here -->
                        </select>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-900/60 border border-white/10 flex items-center justify-between">
                        <span class="text-slate-400">Tồn kho hiện tại:</span>
                        <b id="modal-trans-current-stock" class="text-sky-300 font-mono text-sm">0 kg</b>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block font-semibold text-slate-300 mb-1">Số lượng <span id="modal-trans-action-label">nhập</span> <span class="text-rose-400">*</span>:</label>
                            <div class="flex items-center gap-2">
                                <input type="number" step="0.1" id="modal-trans-qty" oninput="Admin.calcTransTotal()" placeholder="Ví dụ: 10" class="liquid-input flex-1 font-mono font-bold text-sm text-sky-400" required />
                                <span id="modal-trans-unit-label" class="text-slate-400 font-bold">kg</span>
                            </div>
                        </div>
                        <div id="modal-trans-price-container">
                            <label class="block font-semibold text-slate-300 mb-1">Đơn giá mua / đơn vị (VNĐ):</label>
                            <input type="number" id="modal-trans-price" oninput="Admin.calcTransTotal()" placeholder="140000" class="liquid-input w-full font-mono text-emerald-400 font-bold" />
                        </div>
                    </div>
                    <div id="modal-trans-total-box" class="p-3 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 flex items-center justify-between">
                        <span class="text-xs font-bold text-emerald-300">TỔNG CHI PHÍ VẬT LIỆU:</span>
                        <span class="text-lg font-black text-emerald-400 font-mono"><span id="modal-trans-total-cost">0</span> đ</span>
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Nhà cung cấp / Cửa hàng:</label>
                        <input type="text" id="modal-trans-supplier" placeholder="Nhập tên nhà cung cấp hoặc siêu thị..." class="liquid-input w-full" />
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Ghi chú phiếu:</label>
                        <input type="text" id="modal-trans-note" placeholder="Lý do nhập, số hóa đơn chứng từ..." class="liquid-input w-full" />
                    </div>
                </div>
                <div class="flex justify-end gap-2 mt-5 pt-3 border-t border-white/10">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="Admin.closeStockTransactionModal()">Hủy</button>
                    <button type="submit" id="btn-submit-stock-trans" class="btn-glass-success text-xs py-2 px-5 font-bold flex items-center gap-1.5">
                        <i class="fas fa-check"></i>
                        <span>Xác Nhận Lưu Phiếu</span>
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal: Lịch Sử Nhập Xuất & Báo Cáo Chi Phí Vật Liệu (modal-material-history) -->
    <div id="modal-material-history" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content modal-xl p-6 w-[1180px] max-w-[96vw] text-white shadow-2xl border border-purple-500/40 rounded-2xl relative flex flex-col max-h-[90vh]" style="width: 1180px !important; max-width: 96vw !important;">
            <div class="flex justify-between items-center mb-3 pb-3 border-b border-white/10 shrink-0">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                        <i class="fas fa-receipt text-sm"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-base text-purple-300">LỊCH SỬ NHẬP XUẤT & CHI PHÍ NGUYÊN VẬT LIỆU</h3>
                        <p class="text-[11px] text-slate-400">Theo dõi toàn bộ phiếu nhập/xuất kho và tổng chi phí mua hàng</p>
                    </div>
                </div>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="Admin.closeMaterialHistoryModal()">&times;</button>
            </div>

            <!-- Filter Controls & Summary -->
            <div class="flex flex-wrap items-center justify-between gap-3 mb-3 p-2.5 rounded-xl bg-slate-900/60 border border-white/10 shrink-0 text-xs">
                <div class="flex items-center gap-2">
                    <select id="hist-period-select" onchange="Admin.loadMaterialHistory()" class="liquid-input py-1 text-xs bg-slate-900 text-slate-300">
                        <option value="month">Tháng Này</option>
                        <option value="today">Hôm Nay</option>
                        <option value="7d">7 Ngày Gần Nhất</option>
                        <option value="all">Tất Cả Lịch Sử</option>
                    </select>
                    <select id="hist-type-select" onchange="Admin.loadMaterialHistory()" class="liquid-input py-1 text-xs bg-slate-900 text-slate-300">
                        <option value="all">Tất cả giao dịch</option>
                        <option value="import">Chỉ phiếu Nhập kho (Chi phí)</option>
                        <option value="export">Chỉ phiếu Xuất kho (Sử dụng)</option>
                    </select>
                </div>
                <div class="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                    <span class="text-emerald-300 font-semibold">Tổng Chi Phí Mua Vật Liệu:</span>
                    <b id="hist-total-cost-display" class="text-emerald-400 font-mono text-sm ml-1">0 đ</b>
                </div>
            </div>

            <!-- Transactions Table -->
            <div class="flex-1 overflow-x-auto overflow-y-auto pr-1 custom-scrollbar rounded-xl border border-white/10 bg-slate-950/40">
                <table class="w-full min-w-[1020px] text-left border-collapse text-xs">
                    <thead class="sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
                        <tr class="border-b border-white/10 text-[11px] text-slate-300 uppercase tracking-wider font-bold whitespace-nowrap">
                            <th class="py-3 px-3 whitespace-nowrap">Thời Gian</th>
                            <th class="py-3 px-3 whitespace-nowrap">Mã Phiếu</th>
                            <th class="py-3 px-3 whitespace-nowrap text-center">Loại</th>
                            <th class="py-3 px-3 whitespace-nowrap">Tên Nguyên Vật Liệu</th>
                            <th class="py-3 px-3 whitespace-nowrap text-center">Số Lượng</th>
                            <th class="py-3 px-3 whitespace-nowrap text-right">Đơn Giá</th>
                            <th class="py-3 px-3 whitespace-nowrap text-right">Chi Phí (VNĐ)</th>
                            <th class="py-3 px-3 whitespace-nowrap">Nhà Cung Cấp</th>
                            <th class="py-3 px-3 whitespace-nowrap">Người Lập</th>
                        </tr>
                    </thead>
                    <tbody id="hist-transactions-tbody" class="divide-y divide-white/5">
                        <!-- Rendered dynamically -->
                    </tbody>
                </table>
            </div>

            <div class="mt-3 pt-3 border-t border-white/10 flex justify-end shrink-0">
                <button type="button" class="btn-glass text-xs py-1.5 px-4" onclick="Admin.closeMaterialHistoryModal()">Đóng</button>
            </div>
        </div>
    </div>

    <!-- Modal: Sửa Mức Lương Theo Giờ (modal-edit-salary) -->
    <div id="modal-edit-salary" class="liquid-modal-overlay">
        <div class="liquid-glass liquid-modal-content p-6 w-[420px] max-w-full text-white shadow-2xl border border-sky-500/40 rounded-2xl relative">
            <div class="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                <h3 class="font-bold text-base text-sky-400 flex items-center gap-2">
                    <i class="fas fa-coins"></i> Cập Nhật Mức Lương Nhân Viên
                </h3>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="Admin.closeSalaryModal()">&times;</button>
            </div>
            <form onsubmit="Admin.submitSalaryUpdate(event)">
                <input type="hidden" id="salary-user-id" />
                <div class="space-y-3 text-xs">
                    <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                        <div class="text-slate-400 mb-0.5">Nhân viên:</div>
                        <div id="salary-user-fullname" class="font-bold text-sm text-sky-300">Nguyễn Văn Nam</div>
                        <div id="salary-user-role" class="text-[11px] text-slate-400 mt-0.5">Vai trò: Phục vụ</div>
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-300 mb-1">Mức Lương Theo Giờ (VNĐ / giờ) <span class="text-rose-400">*</span>:</label>
                        <input type="number" id="salary-hourly-rate" placeholder="Ví dụ: 30000" step="1000" class="liquid-input w-full font-mono font-bold text-emerald-400 text-base" required />
                        <span class="text-[10px] text-slate-400 mt-1 block">Hệ thống sẽ dùng mức lương này để tự động tính tiền công cho nhân viên khi hoàn thành ca làm</span>
                    </div>
                </div>
                <div class="flex justify-end gap-2 mt-5 pt-3 border-t border-white/10">
                    <button type="button" class="btn-glass text-xs py-2 px-4" onclick="Admin.closeSalaryModal()">Hủy</button>
                    <button type="submit" class="btn-glass-success text-xs py-2 px-5 font-bold">Lưu Mức Lương</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Scripts -->
    <script src="assets/js/admin.js"></script>
    <script>
        // Master list of Vietnamese banks supported by VietQR / NAPAS 247
        const VIETQR_BANKS = [
            { code: 'MB', bin: '970422', name: 'MBBank', full: 'Ngân hàng TMCP Quân Đội', popular: true },
            { code: 'VCB', bin: '970436', name: 'Vietcombank', full: 'Ngân hàng TMCP Ngoại Thương Việt Nam', popular: true },
            { code: 'TCB', bin: '970407', name: 'Techcombank', full: 'Ngân hàng TMCP Kỹ Thương Việt Nam', popular: true },
            { code: 'ICB', bin: '970415', name: 'VietinBank', full: 'Ngân hàng TMCP Công Thương Việt Nam', popular: true },
            { code: 'BIDV', bin: '970418', name: 'BIDV', full: 'Ngân hàng TMCP Đầu Tư và Phát Triển Việt Nam', popular: true },
            { code: 'ACB', bin: '970416', name: 'ACB', full: 'Ngân hàng TMCP Á Châu', popular: true },
            { code: 'VPB', bin: '970454', name: 'VPBank', full: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', popular: true },
            { code: 'TPB', bin: '970458', name: 'TPBank', full: 'Ngân hàng TMCP Tiên Phong', popular: true },
            { code: 'STB', bin: '970403', name: 'Sacombank', full: 'Ngân hàng TMCP Sài Gòn Thương Tín', popular: true },
            { code: 'VBA', bin: '970405', name: 'Agribank', full: 'Ngân hàng Nông Nghiệp và PTNT Việt Nam', popular: true },
            { code: 'HDB', bin: '970437', name: 'HDBank', full: 'Ngân hàng TMCP Phát Triển TP.HCM' },
            { code: 'VIB', bin: '970441', name: 'VIB', full: 'Ngân hàng TMCP Quốc Tế Việt Nam' },
            { code: 'MSB', bin: '970426', name: 'MSB', full: 'Ngân hàng TMCP Hàng Hải Việt Nam' },
            { code: 'SHB', bin: '970443', name: 'SHB', full: 'Ngân hàng TMCP Sài Gòn - Hà Nội' },
            { code: 'OCB', bin: '970448', name: 'OCB', full: 'Ngân hàng TMCP Phương Đông' },
            { code: 'LPB', bin: '970449', name: 'LPBank', full: 'Ngân hàng TMCP Lộc Phát Việt Nam' },
            { code: 'SEAB', bin: '970440', name: 'SeABank', full: 'Ngân hàng TMCP Đông Nam Á' },
            { code: 'NAB', bin: '970428', name: 'Nam A Bank', full: 'Ngân hàng TMCP Nam Á' },
            { code: 'BVB', bin: '970455', name: 'BVBank', full: 'Ngân hàng TMCP Bản Việt' },
            { code: 'TIMO', bin: '970454', name: 'Timo', full: 'Ngân hàng số Timo (BVBank)' },
            { code: 'CAKE', bin: '970468', name: 'Cake', full: 'Ngân hàng số Cake by VPBank' },
            { code: 'EIB', bin: '970431', name: 'Eximbank', full: 'Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam' },
            { code: 'PVCB', bin: '970412', name: 'PVcomBank', full: 'Ngân hàng TMCP Đại Chúng Việt Nam' },
            { code: 'SHBVN', bin: '970424', name: 'Shinhan Bank', full: 'Ngân hàng TNHH MTV Shinhan Việt Nam' },
            { code: 'WOO', bin: '970457', name: 'Woori Bank', full: 'Ngân hàng TNHH MTV Woori Việt Nam' },
            { code: 'KLB', bin: '970452', name: 'Kienlongbank', full: 'Ngân hàng TMCP Kiên Long' },
            { code: 'BAB', bin: '970409', name: 'Bac A Bank', full: 'Ngân hàng TMCP Bắc Á' },
            { code: 'SGB', bin: '970400', name: 'Saigonbank', full: 'Ngân hàng TMCP Sài Gòn Công Thương' },
            { code: 'BVBANK', bin: '970438', name: 'BaoVietBank', full: 'Ngân hàng TMCP Bảo Việt' },
            { code: 'NCB', bin: '970419', name: 'NCB', full: 'Ngân hàng TMCP Quốc Dân' },
            { code: 'VRB', bin: '970421', name: 'VRB', full: 'Ngân hàng Liên Doanh Việt - Nga' },
            { code: 'VAB', bin: '970427', name: 'VietABank', full: 'Ngân hàng TMCP Việt Á' },
            { code: 'VCCB', bin: '970455', name: 'Viet Capital Bank', full: 'Ngân hàng TMCP Bản Việt' }
        ];

        function renderBanks(list) {
            const container = document.getElementById('bank-list-container');
            if (!container) return;
            if (!list || list.length === 0) {
                container.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs">Không tìm thấy ngân hàng nào khớp với từ khóa tìm kiếm.</div>';
                return;
            }

            container.innerHTML = list.map(b => `
                <div class="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-white/5 hover:border-sky-500/30 transition-all cursor-pointer group" onclick="selectBank('${b.code}')">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-9 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center font-bold text-sky-400 text-xs font-mono group-hover:border-sky-400">
                            ${b.code}
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-xs text-white group-hover:text-sky-300">${b.name}</span>
                                <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-300 font-mono">BIN: ${b.bin}</span>
                                ${b.popular ? '<span class="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-semibold">Phổ biến</span>' : ''}
                            </div>
                            <div class="text-[11px] text-slate-400 mt-0.5">${b.full}</div>
                        </div>
                    </div>
                    <button type="button" class="btn-glass text-[11px] py-1 px-3 bg-sky-600/30 hover:bg-sky-500 text-sky-200 group-hover:text-white border-sky-400/30 font-semibold flex items-center gap-1">
                        <i class="fas fa-check"></i>
                        <span>Chọn</span>
                    </button>
                </div>
            `).join('');
        }

        function openBankPickerModal() {
            renderBanks(VIETQR_BANKS);
            const input = document.getElementById('bank-search-input');
            if (input) input.value = '';
            const modal = document.getElementById('bank-picker-modal');
            if (modal) modal.classList.add('open');
        }

        function closeBankPickerModal() {
            const modal = document.getElementById('bank-picker-modal');
            if (modal) modal.classList.remove('open');
        }

        function filterBankList(keyword) {
            const kw = (keyword || '').toLowerCase().trim();
            if (!kw) {
                renderBanks(VIETQR_BANKS);
                return;
            }
            const filtered = VIETQR_BANKS.filter(b => 
                b.code.toLowerCase().includes(kw) ||
                b.name.toLowerCase().includes(kw) ||
                b.full.toLowerCase().includes(kw) ||
                b.bin.includes(kw)
            );
            renderBanks(filtered);
        }

        function selectBank(bankCode) {
            const input = document.getElementById('setting-bank-id');
            if (input) {
                input.value = bankCode;
                input.focus();
                // Add quick visual pulse
                input.classList.add('ring-2', 'ring-emerald-400');
                setTimeout(() => input.classList.remove('ring-2', 'ring-emerald-400'), 1000);
            }
            closeBankPickerModal();
        }

        async function saveStoreSettings(e) {
            e.preventDefault();
            const form = e.target;
            const submitBtn = document.getElementById('btn-save-settings') || form.querySelector('button[type="submit"]');
            const alertBox = document.getElementById('settings-alert');
            
            const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i><span>Đang lưu cấu hình...</span>';
            }

            if (alertBox) {
                alertBox.className = 'hidden';
                alertBox.innerHTML = '';
            }

            const formData = new FormData(form);
            const payload = {};
            formData.forEach((value, key) => { payload[key] = value; });

            try {
                const res = await fetch('api/settings.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    if (alertBox) {
                        alertBox.className = 'p-3 rounded-xl text-xs font-semibold flex items-center justify-between bg-emerald-950/80 border border-emerald-500/40 text-emerald-200';
                        alertBox.innerHTML = `
                            <div class="flex items-center gap-2">
                                <i class="fas fa-circle-check text-emerald-400 text-sm"></i>
                                <span>${data.message || 'Lưu cài đặt hệ thống & VietQR thành công!'}</span>
                            </div>
                            <span class="text-[10px] text-emerald-300 opacity-80">Đã cập nhật cơ sở dữ liệu & file config.php</span>
                        `;
                    }
                    if (submitBtn) {
                        submitBtn.innerHTML = '<i class="fas fa-check mr-1.5"></i><span>Đã Lưu!</span>';
                        setTimeout(() => {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalBtnHtml;
                        }, 2000);
                    }
                } else {
                    if (alertBox) {
                        alertBox.className = 'p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-950/80 border border-rose-500/40 text-rose-200';
                        alertBox.innerHTML = `<i class="fas fa-circle-xmark text-rose-400 text-sm"></i><span>${data.message || 'Lỗi lưu cấu hình'}</span>`;
                    }
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnHtml;
                    }
                }
            } catch (err) {
                console.error('Settings error:', err);
                if (alertBox) {
                    alertBox.className = 'p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-950/80 border border-rose-500/40 text-rose-200';
                    alertBox.innerHTML = `<i class="fas fa-circle-xmark text-rose-400 text-sm"></i><span>Lỗi kết nối máy chủ: ${err.message}</span>`;
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                }
            }
        }
    </script>
</body>
</html>

