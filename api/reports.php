<?php
/**
 * Reports & Dashboard Statistics API
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
checkAuth();

$pdo = Database::getConnection();
$action = $_GET['action'] ?? 'summary';

// 1. Summary Metrics
if ($action === 'summary') {
    $todayDate = date('Y-m-d');
    $currentMonth = date('Y-m');

    // Today's completed orders
    $todayStmt = $pdo->prepare("
        SELECT 
            COUNT(id) as total_orders,
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM orders 
        WHERE status = 'completed' 
        AND DATE(created_at) = :today
    ");
    $todayStmt->execute([':today' => $todayDate]);
    $today = $todayStmt->fetch();

    // Tables metrics
    $tablesStmt = $pdo->query("
        SELECT 
            COUNT(id) as total_tables,
            SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_tables,
            SUM(CASE WHEN status = 'free' THEN 1 ELSE 0 END) as free_tables
        FROM tables_areas
    ");
    $tables = $tablesStmt->fetch();

    // Products metrics
    $prodCount = $pdo->query("SELECT COUNT(*) FROM products WHERE status = 'active'")->fetchColumn();
    $catCount = $pdo->query("SELECT COUNT(*) FROM categories WHERE status = 'active'")->fetchColumn();

    // Month revenue
    $monthStmt = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount), 0) 
        FROM orders 
        WHERE status = 'completed' 
        AND strftime('%Y-%m', created_at) = :current_month
    ");
    $monthStmt->execute([':current_month' => $currentMonth]);
    $monthRevenue = $monthStmt->fetchColumn();

    jsonResponse([
        'success' => true,
        'data' => [
            'today_revenue' => (float)$today['total_revenue'],
            'today_orders' => (int)$today['total_orders'],
            'today_avg_order' => (float)$today['avg_order_value'],
            'month_revenue' => (float)$monthRevenue,
            'total_tables' => (int)$tables['total_tables'],
            'occupied_tables' => (int)($tables['occupied_tables'] ?? 0),
            'free_tables' => (int)($tables['free_tables'] ?? 0),
            'total_products' => (int)$prodCount,
            'total_categories' => (int)$catCount
        ]
    ]);
}

// 2. Revenue Chart Data with Selectable Date Ranges
if ($action === 'chart') {
    $period = $_GET['period'] ?? '';
    $dateFrom = trim($_GET['date_from'] ?? '');
    $dateTo = trim($_GET['date_to'] ?? '');

    // Determine start and end date
    if (!empty($dateFrom) && !empty($dateTo)) {
        $startDate = $dateFrom;
        $endDate = $dateTo;
    } else {
        switch ($period) {
            case 'today':
                $startDate = date('Y-m-d');
                $endDate = date('Y-m-d');
                break;
            case '14d':
                $startDate = date('Y-m-d', strtotime('-13 days'));
                $endDate = date('Y-m-d');
                break;
            case '30d':
                $startDate = date('Y-m-d', strtotime('-29 days'));
                $endDate = date('Y-m-d');
                break;
            case 'month':
                $startDate = date('Y-m-01');
                $endDate = date('Y-m-d');
                break;
            case 'last_month':
                $startDate = date('Y-m-01', strtotime('first day of last month'));
                $endDate = date('Y-m-t', strtotime('last month'));
                break;
            case '7d':
            default:
                $days = (int)($_GET['days'] ?? 7);
                $days = min(60, max(1, $days));
                $startDate = date('Y-m-d', strtotime('-' . ($days - 1) . ' days'));
                $endDate = date('Y-m-d');
                break;
        }
    }

    // Ensure valid start and end
    if (strtotime($startDate) > strtotime($endDate)) {
        $temp = $startDate;
        $startDate = $endDate;
        $endDate = $temp;
    }

    // Limit maximum days to 90
    $diffDays = (int)round((strtotime($endDate) - strtotime($startDate)) / 86400) + 1;
    if ($diffDays > 90) {
        $startDate = date('Y-m-d', strtotime("$endDate -89 days"));
        $diffDays = 90;
    }

    // Query aggregated daily revenue in this range
    $stmt = $pdo->prepare("
        SELECT 
            DATE(created_at) as order_date,
            COALESCE(SUM(total_amount), 0) as revenue,
            COUNT(id) as order_count
        FROM orders 
        WHERE status = 'completed' 
        AND DATE(created_at) >= :start_date
        AND DATE(created_at) <= :end_date
        GROUP BY DATE(created_at)
    ");
    $stmt->execute([':start_date' => $startDate, ':end_date' => $endDate]);
    $rows = $stmt->fetchAll();
    
    $dailyMap = [];
    foreach ($rows as $r) {
        $dailyMap[$r['order_date']] = [
            'revenue' => (float)$r['revenue'],
            'orders' => (int)$r['order_count']
        ];
    }

    $chartData = [];
    $totalRevenue = 0;
    $totalOrders = 0;
    $curr = strtotime($startDate);
    $end = strtotime($endDate);

    while ($curr <= $end) {
        $dStr = date('Y-m-d', $curr);
        $dLabel = date('d/m', $curr);
        $rev = $dailyMap[$dStr]['revenue'] ?? 0;
        $ord = $dailyMap[$dStr]['orders'] ?? 0;

        $totalRevenue += $rev;
        $totalOrders += $ord;

        $chartData[] = [
            'date' => $dStr,
            'label' => $dLabel,
            'revenue' => $rev,
            'orders' => $ord
        ];
        $curr = strtotime('+1 day', $curr);
    }

    jsonResponse([
        'success' => true,
        'data' => $chartData,
        'summary' => [
            'date_from' => $startDate,
            'date_to' => $endDate,
            'total_revenue' => $totalRevenue,
            'total_orders' => $totalOrders,
            'avg_revenue' => count($chartData) > 0 ? round($totalRevenue / count($chartData)) : 0,
            'days_count' => count($chartData)
        ]
    ]);
}

// 3. Top Selling Products
if ($action === 'top_selling') {
    $limit = (int)($_GET['limit'] ?? 8);
    $stmt = $pdo->prepare("
        SELECT 
            oi.product_name,
            oi.unit,
            SUM(oi.quantity) as total_qty,
            SUM(oi.subtotal) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'completed'
        GROUP BY oi.product_name, oi.unit
        ORDER BY total_qty DESC
        LIMIT :limit
    ");
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $items = $stmt->fetchAll();

    jsonResponse(['success' => true, 'data' => $items]);
}

// 4. Payment breakdown
if ($action === 'payment_methods') {
    $stmt = $pdo->query("
        SELECT 
            payment_method,
            COUNT(id) as count,
            COALESCE(SUM(total_amount), 0) as total
        FROM orders 
        WHERE status = 'completed'
        GROUP BY payment_method
    ");
    $data = $stmt->fetchAll();
    jsonResponse(['success' => true, 'data' => $data]);
}

// 5. Kitchen & Staff Service Performance Analytics
if ($action === 'service_performance') {
    $dateFrom = trim($_GET['date_from'] ?? date('Y-m-d'));
    $dateTo = trim($_GET['date_to'] ?? date('Y-m-d'));

    // Kitchen KPI
    $kpiStmt = $pdo->prepare("
        SELECT 
            COUNT(id) as total_orders_cooked,
            COALESCE(AVG(CASE WHEN prep_time_minutes > 0 THEN prep_time_minutes ELSE 1 END), 0) as avg_prep_minutes,
            COALESCE(AVG(CASE WHEN deliver_time_minutes > 0 THEN deliver_time_minutes ELSE 1 END), 0) as avg_deliver_minutes,
            COALESCE(MIN(CASE WHEN prep_time_minutes > 0 THEN prep_time_minutes ELSE NULL END), 0) as min_prep_minutes,
            COALESCE(MAX(prep_time_minutes), 0) as max_prep_minutes,
            COUNT(CASE WHEN prep_time_minutes > 0 AND prep_time_minutes <= 10 THEN 1 ELSE NULL END) as on_time_orders
        FROM orders
        WHERE DATE(created_at) >= :date_from AND DATE(created_at) <= :date_to
        AND (kitchen_ready_at IS NOT NULL OR kitchen_status IN ('ready', 'served', 'archived') OR status = 'completed')
    ");
    $kpiStmt->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
    $kitchenKpi = $kpiStmt->fetch();

    // Total individual items cooked
    $itemsStmt = $pdo->prepare("
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE DATE(o.created_at) >= :date_from AND DATE(o.created_at) <= :date_to
        AND (o.kitchen_ready_at IS NOT NULL OR o.kitchen_status IN ('ready', 'served', 'archived') OR o.status = 'completed')
    ");
    $itemsStmt->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
    $totalItemsCooked = (int)$itemsStmt->fetchColumn();

    $totalCooked = (int)$kitchenKpi['total_orders_cooked'];
    $onTimeRate = $totalCooked > 0 ? round(($kitchenKpi['on_time_orders'] / $totalCooked) * 100, 1) : 100;

    // Staff ranking (Waiters & Cashiers)
    $staffStmt = $pdo->prepare("
        SELECT 
            u.id,
            u.username,
            u.fullname,
            u.role,
            (
                SELECT COUNT(*) FROM orders o 
                WHERE o.user_id = u.id 
                AND DATE(o.created_at) >= :df1 AND DATE(o.created_at) <= :dt1
            ) as orders_created,
            (
                SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o 
                WHERE o.user_id = u.id 
                AND o.status = 'completed'
                AND DATE(o.created_at) >= :df2 AND DATE(o.created_at) <= :dt2
            ) as total_revenue,
            (
                SELECT COUNT(*) FROM orders o 
                WHERE o.served_user_id = u.id 
                AND DATE(o.created_at) >= :df3 AND DATE(o.created_at) <= :dt3
            ) as orders_served,
            (
                SELECT COALESCE(AVG(o.deliver_time_minutes), 0) FROM orders o 
                WHERE o.served_user_id = u.id 
                AND o.deliver_time_minutes > 0
                AND DATE(o.created_at) >= :df4 AND DATE(o.created_at) <= :dt4
            ) as avg_deliver_minutes
        FROM users u
        WHERE u.status = 'active'
        ORDER BY orders_created DESC, orders_served DESC
    ");
    $staffStmt->execute([
        ':df1' => $dateFrom, ':dt1' => $dateTo,
        ':df2' => $dateFrom, ':dt2' => $dateTo,
        ':df3' => $dateFrom, ':dt3' => $dateTo,
        ':df4' => $dateFrom, ':dt4' => $dateTo
    ]);
    $staffStats = $staffStmt->fetchAll();

    // Top Cooked Dishes
    $topStmt = $pdo->prepare("
        SELECT 
            oi.product_name,
            oi.unit,
            SUM(oi.quantity) as total_qty,
            SUM(oi.subtotal) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE DATE(o.created_at) >= :date_from AND DATE(o.created_at) <= :date_to
        GROUP BY oi.product_name, oi.unit
        ORDER BY total_qty DESC
        LIMIT 10
    ");
    $topStmt->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
    $topCooked = $topStmt->fetchAll();

    // Recent Service Audit Logs
    $logsStmt = $pdo->prepare("
        SELECT * FROM kitchen_service_logs
        WHERE DATE(created_at) >= :date_from AND DATE(created_at) <= :date_to
        ORDER BY id DESC
        LIMIT 100
    ");
    $logsStmt->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
    $recentLogs = $logsStmt->fetchAll();

    jsonResponse([
        'success' => true,
        'kitchen_kpi' => [
            'total_orders_cooked' => $totalCooked,
            'total_items_cooked' => $totalItemsCooked,
            'avg_prep_minutes' => round((float)$kitchenKpi['avg_prep_minutes'], 1),
            'avg_deliver_minutes' => round((float)$kitchenKpi['avg_deliver_minutes'], 1),
            'min_prep_minutes' => (int)$kitchenKpi['min_prep_minutes'],
            'max_prep_minutes' => (int)$kitchenKpi['max_prep_minutes'],
            'on_time_rate' => $onTimeRate
        ],
        'staff_stats' => $staffStats,
        'top_cooked_dishes' => $topCooked,
        'recent_logs' => $recentLogs
    ]);
}

// 6. POS Shift & Revenue Report for Cashiers & Admin
if ($action === 'pos_shift_report') {
    $dateFrom = trim($_GET['date_from'] ?? date('Y-m-d'));
    $dateTo = trim($_GET['date_to'] ?? date('Y-m-d'));

    $stmt = $pdo->prepare("
        SELECT 
            COUNT(id) as total_orders,
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(SUM(discount_amount), 0) as total_discount,
            COALESCE(AVG(total_amount), 0) as avg_order_value,
            COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_revenue,
            COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN 1 ELSE 0 END), 0) as cash_orders,
            COALESCE(SUM(CASE WHEN payment_method = 'banking' THEN total_amount ELSE 0 END), 0) as banking_revenue,
            COALESCE(SUM(CASE WHEN payment_method = 'banking' THEN 1 ELSE 0 END), 0) as banking_orders,
            COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_revenue,
            COALESCE(SUM(CASE WHEN payment_method = 'card' THEN 1 ELSE 0 END), 0) as card_orders
        FROM orders
        WHERE status = 'completed'
        AND DATE(COALESCE(completed_at, created_at)) >= :date_from
        AND DATE(COALESCE(completed_at, created_at)) <= :date_to
    ");
    $stmt->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
    $report = $stmt->fetch(PDO::FETCH_ASSOC);

    // Top 5 products sold
    $topStmt = $pdo->prepare("
        SELECT oi.product_name, oi.unit, SUM(oi.quantity) as qty, SUM(oi.subtotal) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'completed'
        AND DATE(COALESCE(o.completed_at, o.created_at)) >= :date_from
        AND DATE(COALESCE(o.completed_at, o.created_at)) <= :date_to
        GROUP BY oi.product_name, oi.unit
        ORDER BY qty DESC
        LIMIT 5
    ");
    $topStmt->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
    $topProducts = $topStmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse([
        'success' => true,
        'data' => [
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'total_revenue' => (float)($report['total_revenue'] ?? 0),
            'total_orders' => (int)($report['total_orders'] ?? 0),
            'total_discount' => (float)($report['total_discount'] ?? 0),
            'avg_order_value' => (float)($report['avg_order_value'] ?? 0),
            'cash_revenue' => (float)($report['cash_revenue'] ?? 0),
            'cash_orders' => (int)($report['cash_orders'] ?? 0),
            'banking_revenue' => (float)($report['banking_revenue'] ?? 0),
            'banking_orders' => (int)($report['banking_orders'] ?? 0),
            'card_revenue' => (float)($report['card_revenue'] ?? 0),
            'card_orders' => (int)($report['card_orders'] ?? 0),
            'top_products' => $topProducts ?: [],
            'user_name' => $_SESSION['fullname'] ?? ($_SESSION['username'] ?? 'Thu Ngân'),
            'user_role' => $_SESSION['user_role'] ?? 'cashier',
            'generated_at' => date('d/m/Y H:i:s')
        ]
    ]);
}

jsonResponse(['success' => false, 'message' => 'Hành động không hợp lệ!'], 400);

