<?php
/**
 * Orders & Checkout API
 * Cart saving, order management, payment processing, thermal receipt data
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

/**
 * Compute the 3-factor order status:
 * 1. Xong món (kitchen_ready_at / kitchen_status in 'ready','served')
 * 2. Bưng ra (served_at / kitchen_status == 'served')
 * 3. Thanh toán (payment_status == 'paid' / paid_at)
 */
function computeOrderState($o) {
    if (!$o) return null;
    $isPaid = (($o['payment_status'] ?? '') === 'paid' || (!empty($o['paid_at']) && ($o['status'] ?? '') !== 'cancelled'));
    $kStatus = $o['kitchen_status'] ?? 'pending';
    $isCooked = ($kStatus === 'ready' || $kStatus === 'served' || !empty($o['kitchen_ready_at']));
    $isServed = ($kStatus === 'served' || !empty($o['served_at']));
    $isCancelled = (($o['status'] ?? '') === 'cancelled' || $kStatus === 'cancelled');

    if ($isCancelled) {
        return [
            'code' => 'cancelled',
            'label' => 'Đã Hủy',
            'badge_class' => 'bg-rose-500/20 text-rose-300 border-rose-500/40',
            'is_completed' => false,
            'is_paid' => $isPaid,
            'is_cooked' => $isCooked,
            'is_served' => $isServed
        ];
    }

    if ($isCooked && $isServed && $isPaid) {
        return [
            'code' => 'completed',
            'label' => 'Hoàn Thành (Đã Xong & TT)',
            'badge_class' => 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            'is_completed' => true,
            'is_paid' => true,
            'is_cooked' => true,
            'is_served' => true
        ];
    }

    if ($isPaid && !$isCooked && !$isServed) {
        return [
            'code' => 'paid_cooking',
            'label' => 'Đã TT (Đang nấu)',
            'badge_class' => 'bg-teal-500/20 text-teal-300 border-teal-500/40',
            'is_completed' => false,
            'is_paid' => true,
            'is_cooked' => false,
            'is_served' => false
        ];
    }

    if ($isPaid && $isCooked && !$isServed) {
        return [
            'code' => 'paid_ready',
            'label' => 'Xong món (Đã TT - Chờ bưng)',
            'badge_class' => 'bg-sky-500/20 text-sky-300 border-sky-500/40 animate-pulse',
            'is_completed' => false,
            'is_paid' => true,
            'is_cooked' => true,
            'is_served' => false
        ];
    }

    if (!$isPaid && $isCooked && !$isServed) {
        return [
            'code' => 'unpaid_ready',
            'label' => 'Xong món (Chờ bưng & Chưa TT)',
            'badge_class' => 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
            'is_completed' => false,
            'is_paid' => false,
            'is_cooked' => true,
            'is_served' => false
        ];
    }

    if (!$isPaid && $isCooked && $isServed) {
        return [
            'code' => 'unpaid_served',
            'label' => 'Đã bưng ra (Chưa TT)',
            'badge_class' => 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
            'is_completed' => false,
            'is_paid' => false,
            'is_cooked' => true,
            'is_served' => true
        ];
    }

    return [
        'code' => 'unpaid_cooking',
        'label' => 'Đang chế biến (Chưa TT)',
        'badge_class' => 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        'is_completed' => false,
        'is_paid' => false,
        'is_cooked' => false,
        'is_served' => false
    ];
}

/**
 * Synchronize order status based on all 3 factors:
 * ONLY when cooked + served + paid does status become 'completed' and table freed!
 */
function syncOrderStatus($pdo, $orderId) {
    if (!$orderId) return;
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = :id");
    $stmt->execute([':id' => $orderId]);
    $order = $stmt->fetch();
    if (!$order || $order['status'] === 'cancelled') return;

    $isPaid = (($order['payment_status'] ?? '') === 'paid' || (!empty($order['paid_at']) && $order['status'] !== 'cancelled'));
    $kStatus = $order['kitchen_status'] ?? 'pending';
    $isCooked = ($kStatus === 'ready' || $kStatus === 'served' || !empty($order['kitchen_ready_at']));
    $isServed = ($kStatus === 'served' || !empty($order['served_at']));

    if ($isCooked && $isServed && $isPaid) {
        $nowStr = date('Y-m-d H:i:s');
        $up = $pdo->prepare("UPDATE orders SET status = 'completed', completed_at = COALESCE(completed_at, :now) WHERE id = :id");
        $up->execute([':now' => $nowStr, ':id' => $orderId]);

        // Release table
        if (!empty($order['table_id'])) {
            $tb = $pdo->prepare("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :table_id AND active_order_id = :order_id");
            $tb->execute([':table_id' => $order['table_id'], ':order_id' => $orderId]);
        }
    } else {
        // Order remains active/pending
        $up = $pdo->prepare("UPDATE orders SET status = 'pending', completed_at = NULL WHERE id = :id");
        $up->execute([':id' => $orderId]);

        // Table remains occupied
        if (!empty($order['table_id'])) {
            $tb = $pdo->prepare("UPDATE tables_areas SET status = 'occupied', active_order_id = :order_id WHERE id = :table_id");
            $tb->execute([':table_id' => $order['table_id'], ':order_id' => $orderId]);
        }
    }
}

// 1. GET: Fetch Order Details by order_id or table_id
if ($method === 'GET' && (empty($action) || $action === 'detail')) {
    $orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;
    $tableId = isset($_GET['table_id']) ? (int)$_GET['table_id'] : null;

    if (!$orderId && $tableId) {
        $tblStmt = $pdo->prepare("SELECT active_order_id FROM tables_areas WHERE id = :id");
        $tblStmt->execute([':id' => $tableId]);
        $orderId = (int)$tblStmt->fetchColumn();
    }

    if (!$orderId) {
        jsonResponse(['success' => true, 'order' => null, 'items' => []]);
    }

    $ordStmt = $pdo->prepare("SELECT * FROM orders WHERE id = :id");
    $ordStmt->execute([':id' => $orderId]);
    $order = $ordStmt->fetch();

    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Không tìm thấy hóa đơn!'], 404);
    }

    $itemStmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = :order_id ORDER BY id ASC");
    $itemStmt->execute([':order_id' => $orderId]);
    $items = $itemStmt->fetchAll();

    foreach ($items as &$it) {
        if (!empty($it['toppings_json'])) {
            $it['toppings'] = json_decode($it['toppings_json'], true) ?: [];
        } else {
            $it['toppings'] = [];
        }
    }

    $order['computed_state'] = computeOrderState($order);

    jsonResponse([
        'success' => true,
        'order' => $order,
        'items' => $items,
        'store' => [
            'name' => STORE_NAME,
            'hotline' => STORE_HOTLINE,
            'address' => STORE_ADDRESS,
            'wifi' => STORE_WIFI
        ]
    ]);
}

// 2. GET: Order History (Lịch sử hóa đơn)
if ($method === 'GET' && $action === 'history') {
    checkAuth();

    $search = trim($_GET['search'] ?? ($_GET['keyword'] ?? ($_GET['q'] ?? '')));
    $hasDateFrom = isset($_GET['date_from']) && $_GET['date_from'] !== '';
    $hasDateTo = isset($_GET['date_to']) && $_GET['date_to'] !== '';
    $allDates = isset($_GET['all_dates']) && ($_GET['all_dates'] === '1' || $_GET['all_dates'] === 'true');

    // If searching with keyword or all_dates requested, don't restrict to today
    $dateFrom = $hasDateFrom ? trim($_GET['date_from']) : ((empty($search) && !$allDates) ? date('Y-m-d') : '');
    $dateTo = $hasDateTo ? trim($_GET['date_to']) : ((empty($search) && !$allDates) ? date('Y-m-d') : '');
    $status = trim($_GET['status'] ?? '');
    if ($status === 'all') $status = '';
    $limit = isset($_GET['limit']) ? min(300, max(1, (int)$_GET['limit'])) : 100;

    $concatExpr = (DB_DRIVER === 'sqlite')
        ? "(SELECT GROUP_CONCAT(product_name || ' (x' || quantity || ')', ', ') FROM order_items WHERE order_id = o.id)"
        : "(SELECT GROUP_CONCAT(CONCAT(product_name, ' (x', quantity, ')') SEPARATOR ', ') FROM order_items WHERE order_id = o.id)";

    $sql = "
        SELECT o.*,
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS items_count,
            {$concatExpr} AS items_summary
        FROM orders o
        WHERE 1=1
    ";
    $params = [];

    if (!empty($search)) {
        $sql .= " AND (o.order_code LIKE :search OR o.table_code LIKE :search OR o.user_name LIKE :search OR o.customer_name LIKE :search)";
        $params[':search'] = '%' . $search . '%';
    }

    if (!empty($dateFrom)) {
        $sql .= " AND DATE(COALESCE(o.completed_at, o.created_at)) >= :date_from";
        $params[':date_from'] = $dateFrom;
    }
    if (!empty($dateTo)) {
        $sql .= " AND DATE(COALESCE(o.completed_at, o.created_at)) <= :date_to";
        $params[':date_to'] = $dateTo;
    }
    if (!empty($status)) {
        $sql .= " AND o.status = :status";
        $params[':status'] = $status;
    }

    $sql .= " ORDER BY o.id DESC LIMIT " . $limit;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll();

    jsonResponse(['success' => true, 'data' => $orders]);
}

// 2c. GET or POST: Generate VietQR details for current order/amount
if ($action === 'vietqr') {
    $orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : (int)($input['order_id'] ?? 0);
    $tableId = isset($_GET['table_id']) ? (int)$_GET['table_id'] : (int)($input['table_id'] ?? 0);
    $amount = (float)($_GET['amount'] ?? ($input['amount'] ?? 0));
    $orderCode = trim($_GET['order_code'] ?? ($input['order_code'] ?? ''));

    if ($orderId > 0) {
        $ord = $pdo->query("SELECT * FROM orders WHERE id = {$orderId}")->fetch();
        if ($ord) {
            $amount = (float)$ord['total_amount'];
            $orderCode = $ord['order_code'];
        }
    } elseif ($tableId > 0) {
        $tbl = $pdo->query("SELECT active_order_id, code FROM tables_areas WHERE id = {$tableId}")->fetch();
        if ($tbl && !empty($tbl['active_order_id'])) {
            $ord = $pdo->query("SELECT * FROM orders WHERE id = {$tbl['active_order_id']}")->fetch();
            if ($ord) {
                $amount = (float)$ord['total_amount'];
                $orderCode = $ord['order_code'];
            }
        }
        if (empty($orderCode) && $tbl) {
            $orderCode = $tbl['code'];
        }
    }

    if (empty($orderCode)) {
        $orderCode = 'POS-' . date('His');
    }

    $transferNote = 'TT ' . $orderCode;
    $qrUrl = generateVietQrUrl($amount, $transferNote);

    jsonResponse([
        'success' => true,
        'vietqr_url' => $qrUrl,
        'bank_id' => defined('VIETQR_BANK_ID') ? VIETQR_BANK_ID : 'MB',
        'account_no' => defined('VIETQR_ACCOUNT_NO') ? VIETQR_ACCOUNT_NO : '0967041111',
        'account_name' => defined('VIETQR_ACCOUNT_NAME') ? VIETQR_ACCOUNT_NAME : 'NGUYEN VAN PHAT',
        'amount' => $amount,
        'note' => $transferNote,
        'order_code' => $orderCode,
        'store_name' => STORE_NAME
    ]);
}

// 2b. GET: Kitchen Tickets (Đơn chế biến cho Màn hình Bếp KDS)
if ($method === 'GET' && $action === 'kitchen_tickets') {
    $filterStatus = $_GET['status'] ?? 'active'; // 'active', 'served', 'history', 'all'
    $todayDate = date('Y-m-d');
    $nowStr = date('Y-m-d H:i:s');

    // Auto-complete any order that meets all 3 factors (Cooked + Served + Paid)
    $pdo->exec("
        UPDATE orders 
        SET status = 'completed', 
            completed_at = COALESCE(completed_at, paid_at, served_at, '{$nowStr}')
        WHERE status = 'pending' 
          AND (payment_status = 'paid' OR paid_at IS NOT NULL) 
          AND (kitchen_status = 'served' OR served_at IS NOT NULL)
    ");

    if ($filterStatus === 'history') {
        // Chỉ các đơn đã hoàn thành thực sự (đủ 3 yếu tố: Xong món + Bưng ra + Thanh toán) hoặc đã lưu trữ
        $sql = "
            SELECT 
                o.*,
                t.name as table_name,
                t.area_type
            FROM orders o
            LEFT JOIN tables_areas t ON o.table_id = t.id
            WHERE DATE(o.created_at) = '{$todayDate}'
            AND (o.status = 'completed' OR o.kitchen_status = 'archived')
            ORDER BY o.id DESC
            LIMIT 100
        ";
    } else {
        $sql = "
            SELECT 
                o.*,
                t.name as table_name,
                t.area_type
            FROM orders o
            LEFT JOIN tables_areas t ON o.table_id = t.id
            WHERE o.status != 'cancelled'
        ";

        if ($filterStatus === 'active') {
            // Chờ Làm & Chờ Lấy: Đơn chưa hoàn thành nấu/bưng (kể cả đã thanh toán hay chưa)
            $sql .= " AND o.status = 'pending' AND (o.kitchen_status = 'pending' OR o.kitchen_status = 'ready' OR o.kitchen_status IS NULL)";
        } elseif ($filterStatus === 'served') {
            // Đã Bưng Ra: Đã bưng ra nhưng chưa thanh toán
            $sql .= " AND o.status = 'pending' AND o.kitchen_status = 'served'";
        } else {
            // 'all': Tất cả đơn đang mở (chưa hoàn thành)
            $sql .= " AND o.status = 'pending'";
        }

        $sql .= " ORDER BY 
            CASE 
                WHEN o.kitchen_status = 'ready' THEN 1
                WHEN o.kitchen_status = 'pending' OR o.kitchen_status IS NULL THEN 2
                WHEN o.kitchen_status = 'served' THEN 3
                ELSE 4
            END,
            o.id ASC
        ";
    }

    $stmt = $pdo->query($sql);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($orders)) {
        $orderIds = array_column($orders, 'id');
        $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
        $itemStmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id IN ($placeholders) ORDER BY id ASC");
        $itemStmt->execute($orderIds);
        $allItems = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

        $itemsByOrder = [];
        foreach ($allItems as $it) {
            if (!empty($it['toppings_json'])) {
                $it['toppings'] = json_decode($it['toppings_json'], true) ?: [];
            } else {
                $it['toppings'] = [];
            }
            $itemsByOrder[$it['order_id']][] = $it;
        }

        foreach ($orders as &$o) {
            $o['items'] = $itemsByOrder[$o['id']] ?? [];
            $o['computed_state'] = computeOrderState($o);
        }
    }

    // Tab counts
    $counts = [
        'active' => (int)$pdo->query("SELECT COUNT(*) FROM orders WHERE status = 'pending' AND (kitchen_status = 'pending' OR kitchen_status = 'ready' OR kitchen_status IS NULL)")->fetchColumn(),
        'served' => (int)$pdo->query("SELECT COUNT(*) FROM orders WHERE status = 'pending' AND kitchen_status = 'served'")->fetchColumn(),
        'history' => (int)$pdo->query("SELECT COUNT(*) FROM orders WHERE DATE(created_at) = '{$todayDate}' AND (status = 'completed' OR kitchen_status = 'archived')")->fetchColumn(),
        'all' => (int)$pdo->query("SELECT COUNT(*) FROM orders WHERE status = 'pending'")->fetchColumn()
    ];

    jsonResponse(['success' => true, 'data' => $orders, 'counts' => $counts]);
}

// Auth required for mutating orders
checkAuth();

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

// 3. POST: Save / Update Draft Order for a table
if ($action === 'save_order') {
    $tableId = isset($input['table_id']) ? (int)$input['table_id'] : null;
    $tableCode = trim($input['table_code'] ?? 'MANG VỀ');
    $customerName = trim($input['customer_name'] ?? 'Khách vãng lai');
    $guestCount = max(1, (int)($input['guest_count'] ?? 1));
    $items = $input['items'] ?? [];
    $discountValue = (float)($input['discount_value'] ?? 0);
    $discountType = ($input['discount_type'] ?? 'amount') === 'percent' ? 'percent' : 'amount';
    $vatPercent = (float)($input['vat_percent'] ?? 0);
    $note = trim($input['note'] ?? '');

    if (empty($items)) {
        jsonResponse(['success' => false, 'message' => 'Giỏ hàng không có sản phẩm nào!'], 400);
    }

    $pdo->beginTransaction();
    try {
        // Find existing pending order if table has one
        $orderId = null;
        if ($tableId) {
            $tCheck = $pdo->prepare("SELECT active_order_id, code FROM tables_areas WHERE id = :id");
            $tCheck->execute([':id' => $tableId]);
            $tbl = $tCheck->fetch();
            if ($tbl) {
                $orderId = $tbl['active_order_id'];
                $tableCode = $tbl['code'];
            }
        }

        // Calculate subtotal from items
        $subtotal = 0;
        foreach ($items as $item) {
            $qty = max(1, (int)($item['quantity'] ?? 1));
            $price = (float)($item['price'] ?? 0);
            $subtotal += ($qty * $price);
        }

        // Calculate discount
        $discountAmount = 0;
        if ($discountType === 'percent') {
            $discountAmount = ($subtotal * min(100, max(0, $discountValue))) / 100;
        } else {
            $discountAmount = min($subtotal, max(0, $discountValue));
        }

        // Calculate VAT
        $afterDiscount = max(0, $subtotal - $discountAmount);
        $vatAmount = ($afterDiscount * max(0, $vatPercent)) / 100;
        $totalAmount = $afterDiscount + $vatAmount;

        $userId = $_SESSION['user_id'] ?? 1;
        $userName = $_SESSION['fullname'] ?? ($_SESSION['username'] ?? 'Thu ngân');
        $isAppendMode = !empty($input['append']) || ($input['mode'] ?? '') === 'append';
        $addedSubtotal = 0;

        if ($orderId) {
            $existingOrder = $pdo->query("SELECT * FROM orders WHERE id = {$orderId} AND status = 'pending'")->fetch();
            if (!$existingOrder) {
                jsonResponse(['success' => false, 'message' => 'Hóa đơn không tồn tại hoặc đã thanh toán trước đó!'], 400);
            }

            if ($isAppendMode) {
                // Waiter appending new items to existing order
                foreach ($items as $item) {
                    $qty = max(1, (int)($item['quantity'] ?? 1));
                    $price = (float)($item['price'] ?? 0);
                    $addedSubtotal += ($qty * $price);
                }

                $newSubtotal = (float)$existingOrder['subtotal'] + $addedSubtotal;
                $discVal = (float)$existingOrder['discount_value'];
                $newDiscountAmount = (float)$existingOrder['discount_amount'];
                if ($existingOrder['discount_type'] === 'percent' && $discVal > 0) {
                    $newDiscountAmount = ($newSubtotal * min(100, $discVal)) / 100;
                }
                $vatPct = (float)$existingOrder['vat_percent'];
                $newVatAmount = max(0, $newSubtotal - $newDiscountAmount) * ($vatPct / 100);
                $newTotalAmount = max(0, $newSubtotal - $newDiscountAmount) + $newVatAmount;

                // Update order amounts and reset kitchen status to pending
                $upStmt = $pdo->prepare("
                    UPDATE orders SET 
                        subtotal = :subtotal,
                        discount_amount = :discount_amount,
                        vat_amount = :vat_amount,
                        total_amount = :total_amount,
                        kitchen_status = 'pending',
                        kitchen_ready_at = NULL,
                        prep_time_minutes = 0
                    WHERE id = :id AND status = 'pending'
                ");
                $upStmt->execute([
                    ':subtotal' => $newSubtotal,
                    ':discount_amount' => $newDiscountAmount,
                    ':vat_amount' => $newVatAmount,
                    ':total_amount' => $newTotalAmount,
                    ':id' => $orderId
                ]);

                $totalAmount = $newTotalAmount;
                // DO NOT DELETE existing order_items! Only append the new items!
            } else {
                // Update existing order (cashier POS replace mode)
                $upStmt = $pdo->prepare("
                    UPDATE orders SET 
                        customer_name = :customer_name,
                        guest_count = :guest_count,
                        subtotal = :subtotal,
                        discount_type = :discount_type,
                        discount_value = :discount_value,
                        discount_amount = :discount_amount,
                        vat_percent = :vat_percent,
                        vat_amount = :vat_amount,
                        total_amount = :total_amount,
                        user_id = :user_id,
                        user_name = :user_name,
                        note = :note,
                        kitchen_status = 'pending'
                    WHERE id = :id AND status = 'pending'
                ");
                $upStmt->execute([
                    ':customer_name' => $customerName,
                    ':guest_count' => $guestCount,
                    ':subtotal' => $subtotal,
                    ':discount_type' => $discountType,
                    ':discount_value' => $discountValue,
                    ':discount_amount' => $discountAmount,
                    ':vat_percent' => $vatPercent,
                    ':vat_amount' => $vatAmount,
                    ':total_amount' => $totalAmount,
                    ':user_id' => $userId,
                    ':user_name' => $userName,
                    ':note' => $note,
                    ':id' => $orderId
                ]);

                // Clear old items to replace
                $delStmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = :order_id");
                $delStmt->execute([':order_id' => $orderId]);
            }
        } else {
            $nowStr = date('Y-m-d H:i:s');
            $today = date('ymd');
            $countToday = (int)$pdo->query("SELECT COUNT(*) FROM orders WHERE DATE(created_at) = '" . date('Y-m-d') . "'")->fetchColumn();
            $orderCode = 'HD' . $today . '-' . str_pad($countToday + 1, 4, '0', STR_PAD_LEFT);

            $inStmt = $pdo->prepare("
                INSERT INTO orders (
                    order_code, table_id, table_code, customer_name, guest_count,
                    subtotal, discount_type, discount_value, discount_amount, vat_percent, vat_amount,
                    total_amount, status, user_id, user_name, note, created_at
                ) VALUES (
                    :order_code, :table_id, :table_code, :customer_name, :guest_count,
                    :subtotal, :discount_type, :discount_value, :discount_amount, :vat_percent, :vat_amount,
                    :total_amount, 'pending', :user_id, :user_name, :note, :created_at
                )
            ");
            $inStmt->execute([
                ':order_code' => $orderCode,
                ':table_id' => $tableId,
                ':table_code' => $tableCode,
                ':customer_name' => $customerName,
                ':guest_count' => $guestCount,
                ':subtotal' => $subtotal,
                ':discount_type' => $discountType,
                ':discount_value' => $discountValue,
                ':discount_amount' => $discountAmount,
                ':vat_percent' => $vatPercent,
                ':vat_amount' => $vatAmount,
                ':total_amount' => $totalAmount,
                ':user_id' => $userId,
                ':user_name' => $userName,
                ':note' => $note,
                ':created_at' => $nowStr
            ]);
            $orderId = (int)$pdo->lastInsertId();

            // Link table to order and set status occupied
            if ($tableId) {
                $tbUp = $pdo->prepare("UPDATE tables_areas SET status = 'occupied', active_order_id = :order_id, guest_count = :guest_count WHERE id = :id");
                $tbUp->execute([
                    ':order_id' => $orderId,
                    ':guest_count' => $guestCount,
                    ':id' => $tableId
                ]);
            }
        }

        // Insert order items
        $insItem = $pdo->prepare("
            INSERT INTO order_items (
                order_id, product_id, product_code, product_name, unit,
                quantity, price, subtotal, note, toppings_json
            ) VALUES (
                :order_id, :product_id, :product_code, :product_name, :unit,
                :quantity, :price, :subtotal, :note, :toppings_json
            )
        ");

        foreach ($items as $item) {
            $qty = max(1, (int)($item['quantity'] ?? 1));
            $price = (float)($item['price'] ?? 0);
            $itemSubtotal = $qty * $price;
            $toppings = !empty($item['toppings']) ? json_encode($item['toppings'], JSON_UNESCAPED_UNICODE) : null;

            $insItem->execute([
                ':order_id' => $orderId,
                ':product_id' => (int)($item['id'] ?? 0),
                ':product_code' => trim($item['code'] ?? ''),
                ':product_name' => trim($item['name'] ?? ''),
                ':unit' => trim($item['unit'] ?? 'ly'),
                ':quantity' => $qty,
                ':price' => $price,
                ':subtotal' => $itemSubtotal,
                ':note' => trim($item['note'] ?? ''),
                ':toppings_json' => $toppings
            ]);
        }

        // Log in kitchen_service_logs
        $userRole = $_SESSION['user_role'] ?? 'waiter';
        $logCode = $orderCode ?? 'HĐ';
        if (empty($orderCode)) {
            $logCode = $pdo->query("SELECT order_code FROM orders WHERE id = {$orderId}")->fetchColumn() ?: 'HĐ';
        }

        $logAction = $isAppendMode ? 'add_items' : 'order_created';
        $logActionLabel = $isAppendMode ? 'Gọi thêm món' : 'Nhận order món';
        $logNote = $isAppendMode 
            ? "Bàn {$tableCode} gọi thêm " . count($items) . " món (+ " . number_format($addedSubtotal) . "đ)"
            : "Order bàn {$tableCode} (" . count($items) . " món, " . number_format($totalAmount) . "đ)";

        $logStmt = $pdo->prepare("
            INSERT INTO kitchen_service_logs (
                order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
            ) VALUES (
                :order_id, :order_code, :table_code, :action, :action_label, :user_id, :user_name, :user_role, 0, :note, :created_at
            )
        ");
        $logStmt->execute([
            ':order_id' => $orderId,
            ':order_code' => $logCode,
            ':table_code' => $tableCode,
            ':action' => $logAction,
            ':action_label' => $logActionLabel,
            ':user_id' => $userId,
            ':user_name' => $userName,
            ':user_role' => $userRole,
            ':note' => $logNote,
            ':created_at' => date('Y-m-d H:i:s')
        ]);

        $pdo->commit();

        jsonResponse([
            'success' => true,
            'message' => 'Lưu đơn hàng thành công!',
            'order_id' => $orderId,
            'table_code' => $tableCode,
            'total_amount' => $totalAmount
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Lỗi lưu hóa đơn: ' . $e->getMessage()], 500);
    }
}

// 4. POST: Checkout & Payment (Thanh toán)
if ($action === 'checkout') {
    $orderId = (int)($input['order_id'] ?? 0);
    $tableId = isset($input['table_id']) ? (int)$input['table_id'] : null;
    $paymentMethod = in_array($input['payment_method'] ?? '', ['cash', 'banking', 'card']) ? $input['payment_method'] : 'cash';
    $cashReceived = (float)($input['cash_received'] ?? 0);
    $discountValue = (float)($input['discount_value'] ?? 0);
    $discountType = ($input['discount_type'] ?? 'amount') === 'percent' ? 'percent' : 'amount';
    $vatPercent = (float)($input['vat_percent'] ?? 0);

    // If orderId is not sent, check table active order or save on the fly
    if ($orderId <= 0 && $tableId > 0) {
        $tStmt = $pdo->prepare("SELECT active_order_id FROM tables_areas WHERE id = :id");
        $tStmt->execute([':id' => $tableId]);
        $orderId = (int)$tStmt->fetchColumn();
    }

    if ($orderId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Không tìm thấy hóa đơn cần thanh toán!'], 400);
    }

    $ordStmt = $pdo->prepare("SELECT * FROM orders WHERE id = :id AND status = 'pending'");
    $ordStmt->execute([':id' => $orderId]);
    $order = $ordStmt->fetch();

    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Hóa đơn không tồn tại hoặc đã được thanh toán trước đó!'], 400);
    }

    $pdo->beginTransaction();
    try {
        $subtotal = (float)$order['subtotal'];
        
        // Recalculate discount
        $discountAmount = 0;
        if ($discountType === 'percent') {
            $discountAmount = ($subtotal * min(100, max(0, $discountValue))) / 100;
        } else {
            $discountAmount = min($subtotal, max(0, $discountValue));
        }

        $afterDiscount = max(0, $subtotal - $discountAmount);
        $vatAmount = ($afterDiscount * max(0, $vatPercent)) / 100;
        $totalAmount = $afterDiscount + $vatAmount;

        // Cash calculations
        if ($paymentMethod === 'cash') {
            if ($cashReceived < $totalAmount) {
                $cashReceived = $totalAmount; // Default exact amount if 0 passed
            }
            $changeAmount = max(0, $cashReceived - $totalAmount);
        } else {
            $cashReceived = $totalAmount;
            $changeAmount = 0;
        }

        // Update Order Payment Details
        $nowStr = date('Y-m-d H:i:s');
        $upStmt = $pdo->prepare("
            UPDATE orders SET
                discount_type = :discount_type,
                discount_value = :discount_value,
                discount_amount = :discount_amount,
                vat_percent = :vat_percent,
                vat_amount = :vat_amount,
                total_amount = :total_amount,
                payment_method = :payment_method,
                cash_received = :cash_received,
                change_amount = :change_amount,
                payment_status = 'paid',
                paid_at = :paid_at
            WHERE id = :id
        ");
        $upStmt->execute([
            ':discount_type' => $discountType,
            ':discount_value' => $discountValue,
            ':discount_amount' => $discountAmount,
            ':vat_percent' => $vatPercent,
            ':vat_amount' => $vatAmount,
            ':total_amount' => $totalAmount,
            ':payment_method' => $paymentMethod,
            ':cash_received' => $cashReceived,
            ':change_amount' => $changeAmount,
            ':paid_at' => $nowStr,
            ':id' => $orderId
        ]);

        // Evaluate 3 factors: Bếp xong món + Phục vụ bưng ra + Thu ngân thanh toán
        // Chỉ khi đủ cả 3 yếu tố mới đổi status = 'completed' và giải phóng bàn!
        syncOrderStatus($pdo, $orderId);

        // Fetch completed order items for print receipt
        $itemsStmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = :order_id");
        $itemsStmt->execute([':order_id' => $orderId]);
        $items = $itemsStmt->fetchAll();

        // Get full updated order
        $finalOrdStmt = $pdo->prepare("SELECT * FROM orders WHERE id = :id");
        $finalOrdStmt->execute([':id' => $orderId]);
        $completedOrder = $finalOrdStmt->fetch();

        // Log checkout in kitchen_service_logs
        $cUserId = $_SESSION['user_id'] ?? 1;
        $cUserName = $_SESSION['fullname'] ?? ($_SESSION['username'] ?? 'Thu ngân');
        $cRole = $_SESSION['user_role'] ?? 'cashier';
        $logStmt = $pdo->prepare("
            INSERT INTO kitchen_service_logs (
                order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
            ) VALUES (
                :order_id, :order_code, :table_code, 'checkout', 'Thanh toán hoàn tất', :user_id, :user_name, :user_role, 0, :note, :created_at
            )
        ");
        $logStmt->execute([
            ':order_id' => $orderId,
            ':order_code' => $completedOrder['order_code'],
            ':table_code' => $completedOrder['table_code'],
            ':user_id' => $cUserId,
            ':user_name' => $cUserName,
            ':user_role' => $cRole,
            ':note' => "Đã thanh toán " . number_format($totalAmount) . "đ ({$paymentMethod})",
            ':created_at' => $nowStr
        ]);

        $pdo->commit();

        // Generate VietQR URL if banking
        $vietQrUrl = null;
        if ($paymentMethod === 'banking') {
            $vietQrUrl = sprintf(
                "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%d&addInfo=%s&accountName=%s",
                urlencode(VIETQR_BANK_ID),
                urlencode(VIETQR_ACCOUNT_NO),
                (int)$totalAmount,
                urlencode("TT " . $completedOrder['order_code']),
                urlencode(VIETQR_ACCOUNT_NAME)
            );
        }

        jsonResponse([
            'success' => true,
            'message' => 'Thanh toán hóa đơn thành công!',
            'order' => $completedOrder,
            'items' => $items,
            'store' => [
                'name' => STORE_NAME,
                'hotline' => STORE_HOTLINE,
                'address' => STORE_ADDRESS,
                'wifi' => STORE_WIFI
            ],
            'vietqr_url' => $vietQrUrl
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Lỗi xử lý thanh toán: ' . $e->getMessage()], 500);
    }
}

// 5. POST: Cancel Order (Hủy hóa đơn)
if ($action === 'cancel_order') {
    $orderId = (int)($input['order_id'] ?? 0);
    $tableId = isset($input['table_id']) ? (int)$input['table_id'] : null;

    if ($orderId <= 0 && $tableId > 0) {
        $tStmt = $pdo->prepare("SELECT active_order_id FROM tables_areas WHERE id = :id");
        $tStmt->execute([':id' => $tableId]);
        $orderId = (int)$tStmt->fetchColumn();
    }

    if ($orderId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Không tìm thấy hóa đơn cần hủy!'], 400);
    }

    $pdo->beginTransaction();
    try {
        $ordStmt = $pdo->prepare("SELECT table_id FROM orders WHERE id = :id");
        $ordStmt->execute([':id' => $orderId]);
        $ord = $ordStmt->fetch();

        // Mark cancelled
        $cancelStmt = $pdo->prepare("UPDATE orders SET status = 'cancelled' WHERE id = :id");
        $cancelStmt->execute([':id' => $orderId]);

        // Release table
        $tblToRelease = $tableId ?: ($ord['table_id'] ?? null);
        if ($tblToRelease) {
            $relStmt = $pdo->prepare("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :id");
            $relStmt->execute([':id' => $tblToRelease]);
        }

        // Log cancellation in kitchen_service_logs
        $cUserId = $_SESSION['user_id'] ?? 1;
        $cUserName = $_SESSION['fullname'] ?? ($_SESSION['username'] ?? 'Người dùng');
        $cRole = $_SESSION['user_role'] ?? 'admin';
        $logCode = $ord['order_code'] ?? ('HĐ' . $orderId);
        $logTable = $ord['table_code'] ?? 'Bàn';
        $logStmt = $pdo->prepare("
            INSERT INTO kitchen_service_logs (
                order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
            ) VALUES (
                :order_id, :order_code, :table_code, 'cancel_order', 'Hủy hóa đơn', :user_id, :user_name, :user_role, 0, 'Đã hủy đơn hàng', :created_at
            )
        ");
        $logStmt->execute([
            ':order_id' => $orderId,
            ':order_code' => $logCode,
            ':table_code' => $logTable,
            ':user_id' => $cUserId,
            ':user_name' => $cUserName,
            ':user_role' => $cRole,
            ':created_at' => date('Y-m-d H:i:s')
        ]);

        $pdo->commit();
        jsonResponse(['success' => true, 'message' => 'Đã hủy hóa đơn thành công!']);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Lỗi hủy hóa đơn: ' . $e->getMessage()], 500);
    }
}

// 6. POST: Kitchen marks dishes ready (Bếp báo xong món)
if ($action === 'kitchen_ready') {
    $orderId = (int)($input['order_id'] ?? ($_GET['order_id'] ?? 0));
    $tableId = isset($input['table_id']) ? (int)$input['table_id'] : (int)($_GET['table_id'] ?? 0);

    if ($orderId <= 0 && $tableId > 0) {
        $tStmt = $pdo->prepare("SELECT active_order_id FROM tables_areas WHERE id = :id");
        $tStmt->execute([':id' => $tableId]);
        $orderId = (int)$tStmt->fetchColumn();
    }

    if ($orderId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Không tìm thấy hóa đơn cần báo hoàn thành!'], 400);
    }

    $kUserId = $_SESSION['user_id'] ?? 5;
    $kUserName = $_SESSION['fullname'] ?? ($_SESSION['username'] ?? 'Tổ Pha Chế & Bếp');
    $kRole = $_SESSION['user_role'] ?? 'kitchen';

    $ord = $pdo->query("SELECT order_code, table_code, created_at FROM orders WHERE id = {$orderId}")->fetch();
    $prepMinutes = 0;
    $durationSeconds = 0;
    if ($ord && !empty($ord['created_at'])) {
        $durationSeconds = max(0, time() - strtotime($ord['created_at']));
        $prepMinutes = max(1, (int)round($durationSeconds / 60));
    }

    $nowStr = date('Y-m-d H:i:s');
    $upStmt = $pdo->prepare("
        UPDATE orders SET 
            kitchen_status = 'ready', 
            kitchen_ready_at = :k_at,
            kitchen_user_id = :k_uid,
            kitchen_user_name = :k_uname,
            prep_time_minutes = :prep_min
        WHERE id = :id
    ");
    $upStmt->execute([
        ':k_at' => $nowStr,
        ':k_uid' => $kUserId,
        ':k_uname' => $kUserName,
        ':prep_min' => $prepMinutes,
        ':id' => $orderId
    ]);

    // Update overall status: evaluate 3 factors
    syncOrderStatus($pdo, $orderId);

    if ($ord) {
        $logStmt = $pdo->prepare("
            INSERT INTO kitchen_service_logs (
                order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
            ) VALUES (
                :order_id, :order_code, :table_code, 'kitchen_ready', 'Bếp báo xong món', :user_id, :user_name, :user_role, :duration, :note, :created_at
            )
        ");
        $logStmt->execute([
            ':order_id' => $orderId,
            ':order_code' => $ord['order_code'],
            ':table_code' => $ord['table_code'],
            ':user_id' => $kUserId,
            ':user_name' => $kUserName,
            ':user_role' => $kRole,
            ':duration' => $durationSeconds,
            ':note' => "Bếp hoàn thành chế biến sau {$prepMinutes} phút",
            ':created_at' => $nowStr
        ]);

        // Insert real-time notification for Waiter phones
        try {
            $notifStmt = $pdo->prepare("
                INSERT INTO app_notifications (
                    type, order_id, table_code, title, message, is_read_waiter, is_read_cashier, created_at
                ) VALUES (
                    'kitchen_ready', :order_id, :table_code, :title, :message, 0, 0, :created_at
                )
            ");
            $notifStmt->execute([
                ':order_id' => $orderId,
                ':table_code' => $ord['table_code'] ?? 'Bàn',
                ':title' => '🔔 Bếp báo xong món: ' . ($ord['table_code'] ?? ''),
                ':message' => 'Món ăn bàn ' . ($ord['table_code'] ?? '') . ' đã chế biến xong, vui lòng bưng ra!',
                ':created_at' => $nowStr
            ]);
        } catch (Exception $notifEx) {
            // Ignore if notification table has duplicate
        }
    }

    $tCode = $ord['table_code'] ?? 'Bàn';
    jsonResponse(['success' => true, 'message' => "Đã thông báo xong món cho bàn {$tCode} đến phục vụ!", 'table_code' => $tCode]);
}

// 7. POST: Waiter marks dishes served (Phục vụ đã mang ra bàn)
if ($action === 'waiter_served') {
    $orderId = (int)($input['order_id'] ?? ($_GET['order_id'] ?? 0));
    $tableId = isset($input['table_id']) ? (int)$input['table_id'] : (int)($_GET['table_id'] ?? 0);

    if ($orderId <= 0 && $tableId > 0) {
        $tStmt = $pdo->prepare("SELECT active_order_id FROM tables_areas WHERE id = :id");
        $tStmt->execute([':id' => $tableId]);
        $orderId = (int)$tStmt->fetchColumn();
    }

    if ($orderId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Không tìm thấy đơn hàng!'], 400);
    }

    $wUserId = $_SESSION['user_id'] ?? 3;
    $wUserName = $_SESSION['fullname'] ?? ($_SESSION['username'] ?? 'Nhân viên phục vụ');
    $wRole = $_SESSION['user_role'] ?? 'waiter';

    $ord = $pdo->query("SELECT order_code, table_code, kitchen_ready_at FROM orders WHERE id = {$orderId}")->fetch();
    $deliverMinutes = 0;
    $durationSeconds = 0;
    if ($ord && !empty($ord['kitchen_ready_at'])) {
        $durationSeconds = max(0, time() - strtotime($ord['kitchen_ready_at']));
        $deliverMinutes = max(1, (int)round($durationSeconds / 60));
    }

    $nowStr = date('Y-m-d H:i:s');
    $upStmt = $pdo->prepare("
        UPDATE orders SET 
            kitchen_status = 'served',
            served_at = :s_at,
            served_user_id = :s_uid,
            served_user_name = :s_uname,
            deliver_time_minutes = :deliv_min
        WHERE id = :id
    ");
    $upStmt->execute([
        ':s_at' => $nowStr,
        ':s_uid' => $wUserId,
        ':s_uname' => $wUserName,
        ':deliv_min' => $deliverMinutes,
        ':id' => $orderId
    ]);

    // Update overall status: evaluate 3 factors (Xong món + Bưng ra + Thanh toán)
    syncOrderStatus($pdo, $orderId);

    if ($ord) {
        $logStmt = $pdo->prepare("
            INSERT INTO kitchen_service_logs (
                order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
            ) VALUES (
                :order_id, :order_code, :table_code, 'waiter_served', 'Phục vụ đã bưng ra bàn', :user_id, :user_name, :user_role, :duration, :note, :created_at
            )
        ");
        $logStmt->execute([
            ':order_id' => $orderId,
            ':order_code' => $ord['order_code'],
            ':table_code' => $ord['table_code'],
            ':user_id' => $wUserId,
            ':user_name' => $wUserName,
            ':user_role' => $wRole,
            ':duration' => $durationSeconds,
            ':note' => "Đã bưng ra bàn sau {$deliverMinutes} phút từ khi bếp xong",
            ':created_at' => $nowStr
        ]);
    }

    jsonResponse(['success' => true, 'message' => 'Đã xác nhận mang món ra bàn thành công!']);
}

// 8. POST: Kitchen archives ticket (Ẩn vé đã phục vụ)
if ($action === 'kitchen_archive') {
    $orderId = (int)($input['order_id'] ?? ($_GET['order_id'] ?? 0));
    if ($orderId > 0) {
        $upStmt = $pdo->prepare("UPDATE orders SET kitchen_status = 'archived' WHERE id = :id");
        $upStmt->execute([':id' => $orderId]);
    }
    jsonResponse(['success' => true, 'message' => 'Đã ẩn vé món ăn!']);
}

// 8b. POST: Kitchen reopens ticket (Nấu lại / Chế biến thêm)
if ($action === 'kitchen_reopen') {
    $orderId = (int)($input['order_id'] ?? ($_GET['order_id'] ?? 0));
    if ($orderId > 0) {
        $upStmt = $pdo->prepare("UPDATE orders SET kitchen_status = 'pending', served_at = NULL, kitchen_ready_at = NULL WHERE id = :id");
        $upStmt->execute([':id' => $orderId]);
        syncOrderStatus($pdo, $orderId);

        $ord = $pdo->query("SELECT order_code, table_code FROM orders WHERE id = {$orderId}")->fetch();
        if ($ord) {
            $logStmt = $pdo->prepare("
                INSERT INTO kitchen_service_logs (
                    order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, note
                ) VALUES (
                    :order_id, :order_code, :table_code, 'kitchen_reopen', 'Bếp chế biến lại / nấu thêm', :user_id, :user_name, :user_role, 'Yêu cầu làm lại hoặc bổ sung món'
                )
            ");
            $logStmt->execute([
                ':order_id' => $orderId,
                ':order_code' => $ord['order_code'],
                ':table_code' => $ord['table_code'],
                ':user_id' => $_SESSION['user_id'] ?? 5,
                ':user_name' => $_SESSION['fullname'] ?? 'Bếp',
                ':user_role' => $_SESSION['user_role'] ?? 'kitchen'
            ]);
        }
    }
    jsonResponse(['success' => true, 'message' => 'Đã chuyển đơn về trạng thái Đang Chế Biến!']);
}

// 8c. POST: Update note for a specific order item (Bổ sung ghi chú món đã khóa gửi bếp)
if ($action === 'update_item_note') {
    $itemId = (int)($input['item_id'] ?? ($_GET['item_id'] ?? 0));
    $note = trim($input['note'] ?? '');

    if ($itemId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Mã món không hợp lệ!'], 400);
    }

    $itStmt = $pdo->prepare("SELECT oi.*, o.table_code, o.order_code FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.id = :id");
    $itStmt->execute([':id' => $itemId]);
    $item = $itStmt->fetch();

    if (!$item) {
        jsonResponse(['success' => false, 'message' => 'Món không tồn tại trên hóa đơn!'], 404);
    }

    $upStmt = $pdo->prepare("UPDATE order_items SET note = :note WHERE id = :id");
    $upStmt->execute([':note' => $note, ':id' => $itemId]);

    $uUserId = $_SESSION['user_id'] ?? 1;
    $uUserName = $_SESSION['fullname'] ?? ($_SESSION['username'] ?? 'Phục vụ');
    $uRole = $_SESSION['user_role'] ?? 'waiter';

    $logStmt = $pdo->prepare("
        INSERT INTO kitchen_service_logs (
            order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, note, created_at
        ) VALUES (
            :order_id, :order_code, :table_code, 'update_item_note', 'Bổ sung ghi chú món', :user_id, :user_name, :user_role, :note, :created_at
        )
    ");
    $logStmt->execute([
        ':order_id' => $item['order_id'],
        ':order_code' => $item['order_code'],
        ':table_code' => $item['table_code'],
        ':user_id' => $uUserId,
        ':user_name' => $uUserName,
        ':user_role' => $uRole,
        ':note' => "Món '{$item['product_name']}' cập nhật ghi chú: " . ($note ?: '(xóa ghi chú)'),
        ':created_at' => date('Y-m-d H:i:s')
    ]);

    jsonResponse([
        'success' => true,
        'message' => 'Đã cập nhật ghi chú món cho bếp!',
        'item_id' => $itemId,
        'note' => $note
    ]);
}

// 8d. POST: Kitchen deletes/cancels a dish (Bếp hủy món do hết hoặc theo yêu cầu)
if ($action === 'kitchen_delete_item') {
    $orderId = (int)($input['order_id'] ?? ($_GET['order_id'] ?? 0));
    $itemId = (int)($input['item_id'] ?? ($_GET['item_id'] ?? 0));
    $reason = trim($input['reason'] ?? 'Hết nguyên liệu / Món đã hết');

    if ($orderId <= 0 || $itemId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Thông tin đơn hàng hoặc món cần hủy không hợp lệ!'], 400);
    }

    $ord = $pdo->query("SELECT * FROM orders WHERE id = {$orderId}")->fetch();
    if (!$ord) {
        jsonResponse(['success' => false, 'message' => 'Hóa đơn không tồn tại!'], 404);
    }

    $itStmt = $pdo->prepare("SELECT * FROM order_items WHERE id = :id AND order_id = :order_id");
    $itStmt->execute([':id' => $itemId, ':order_id' => $orderId]);
    $item = $itStmt->fetch();

    if (!$item) {
        jsonResponse(['success' => false, 'message' => 'Món không tồn tại trên hóa đơn này hoặc đã bị xóa trước đó!'], 404);
    }

    $pdo->beginTransaction();
    try {
        // 1. Delete item from order_items
        $delStmt = $pdo->prepare("DELETE FROM order_items WHERE id = :id AND order_id = :order_id");
        $delStmt->execute([':id' => $itemId, ':order_id' => $orderId]);

        // 2. Count remaining items
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM order_items WHERE order_id = :order_id");
        $countStmt->execute([':order_id' => $orderId]);
        $remainingCount = (int)$countStmt->fetchColumn();

        $kUserId = $_SESSION['user_id'] ?? 5;
        $kUserName = $_SESSION['fullname'] ?? ($_SESSION['username'] ?? 'Bếp / Pha chế');
        $kRole = $_SESSION['user_role'] ?? 'kitchen';

        $isOrderCancelled = false;
        $newTotalAmount = 0;

        if ($remainingCount === 0) {
            // All items were deleted -> cancel entire order & free table
            $upOrd = $pdo->prepare("
                UPDATE orders SET 
                    subtotal = 0,
                    discount_amount = 0,
                    vat_amount = 0,
                    total_amount = 0,
                    status = 'cancelled',
                    kitchen_status = 'cancelled'
                WHERE id = :id
            ");
            $upOrd->execute([':id' => $orderId]);

            // Free table
            $pdo->prepare("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE active_order_id = :order_id")
                ->execute([':order_id' => $orderId]);

            $isOrderCancelled = true;
        } else {
            // Recalculate subtotal from remaining items
            $sumStmt = $pdo->prepare("SELECT COALESCE(SUM(subtotal), 0) FROM order_items WHERE order_id = :order_id");
            $sumStmt->execute([':order_id' => $orderId]);
            $newSubtotal = (float)$sumStmt->fetchColumn();

            $discVal = (float)$ord['discount_value'];
            $newDiscountAmount = 0;
            if ($ord['discount_type'] === 'percent') {
                $newDiscountAmount = ($newSubtotal * min(100, max(0, $discVal))) / 100;
            } else {
                $newDiscountAmount = min($newSubtotal, max(0, $discVal));
            }

            $vatPct = (float)$ord['vat_percent'];
            $afterDisc = max(0, $newSubtotal - $newDiscountAmount);
            $newVatAmount = ($afterDisc * max(0, $vatPct)) / 100;
            $newTotalAmount = $afterDisc + $newVatAmount;

            $upOrd = $pdo->prepare("
                UPDATE orders SET 
                    subtotal = :subtotal,
                    discount_amount = :discount_amount,
                    vat_amount = :vat_amount,
                    total_amount = :total_amount
                WHERE id = :id
            ");
            $upOrd->execute([
                ':subtotal' => $newSubtotal,
                ':discount_amount' => $newDiscountAmount,
                ':vat_amount' => $newVatAmount,
                ':total_amount' => $newTotalAmount,
                ':id' => $orderId
            ]);
        }

        // 3. Create Notification for Waitstaff & Cashier
        $lockProduct = !empty($input['lock_product']) || ($input['lock_product'] ?? '') === 'true';
        if ($lockProduct) {
            $notifTitle = "BẾP BÁO HẾT MÓN - BÀN {$ord['table_code']}";
            $notifMsg = "Bếp báo HẾT món '{$item['product_name']}' (x{$item['quantity']}) tại bàn {$ord['table_code']}. Món đã TẠM KHÓA trên thực đơn và tự động xóa khỏi hóa đơn.";
            if (!empty($item['product_id'])) {
                $pdo->prepare("UPDATE products SET status = 'locked' WHERE id = :pid")
                    ->execute([':pid' => $item['product_id']]);
            }
        } else {
            $notifTitle = "BẾP ĐỒNG Ý HỦY MÓN - BÀN {$ord['table_code']}";
            $notifMsg = "Bếp đã ĐỒNG Ý HỦY món '{$item['product_name']}' (x{$item['quantity']}) tại bàn {$ord['table_code']}. Tiền hóa đơn đã tự động giảm trừ.";
        }

        $notifStmt = $pdo->prepare("
            INSERT INTO app_notifications (
                type, order_id, table_code, title, message, is_read_waiter, is_read_cashier, created_at
            ) VALUES (
                'kitchen_cancel_item', :order_id, :table_code, :title, :message, 0, 0, :created_at
            )
        ");
        $notifStmt->execute([
            ':order_id' => $orderId,
            ':table_code' => $ord['table_code'],
            ':title' => $notifTitle,
            ':message' => $notifMsg,
            ':created_at' => date('Y-m-d H:i:s')
        ]);
        $notificationId = (int)$pdo->lastInsertId();

        // 4. Log in kitchen_service_logs
        $logStmt = $pdo->prepare("
            INSERT INTO kitchen_service_logs (
                order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, note, created_at
            ) VALUES (
                :order_id, :order_code, :table_code, 'kitchen_cancel_item', 'Bếp hủy món', :user_id, :user_name, :user_role, :note, :created_at
            )
        ");
        $logStmt->execute([
            ':order_id' => $orderId,
            ':order_code' => $ord['order_code'],
            ':table_code' => $ord['table_code'],
            ':user_id' => $kUserId,
            ':user_name' => $kUserName,
            ':user_role' => $kRole,
            ':note' => "Hủy món '{$item['product_name']}' (x{$item['quantity']}) bàn {$ord['table_code']}. Lý do: {$reason}" . ($lockProduct ? " (Đồng thời TẠM KHÓA món trên thực đơn)" : ""),
            ':created_at' => date('Y-m-d H:i:s')
        ]);

        $pdo->commit();

        jsonResponse([
            'success' => true,
            'message' => "Đã xóa món '{$item['product_name']}' khỏi hóa đơn bàn {$ord['table_code']}" . ($lockProduct ? " và TẠM KHÓA món trên thực đơn!" : "!"),
            'product_name' => $item['product_name'],
            'table_code' => $ord['table_code'],
            'remaining_count' => $remainingCount,
            'new_total' => $newTotalAmount,
            'order_cancelled' => $isOrderCancelled,
            'locked_product' => $lockProduct,
            'notification_id' => $notificationId
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Lỗi khi xóa món: ' . $e->getMessage()], 500);
    }
}

// 8e. POST: Kitchen rejects cancellation request (Bếp bấm Cancel - Từ chối hủy do đã làm)
if ($action === 'kitchen_reject_cancel') {
    $orderId = (int)($input['order_id'] ?? ($_GET['order_id'] ?? 0));
    $itemId = (int)($input['item_id'] ?? ($_GET['item_id'] ?? 0));
    $reason = trim($input['reason'] ?? 'Bếp đã chế biến, không thể hủy');

    if ($orderId <= 0 || $itemId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Thông tin đơn hàng hoặc món không hợp lệ!'], 400);
    }

    $ord = $pdo->query("SELECT * FROM orders WHERE id = {$orderId}")->fetch();
    if (!$ord) {
        jsonResponse(['success' => false, 'message' => 'Hóa đơn không tồn tại!'], 404);
    }

    $itStmt = $pdo->prepare("SELECT * FROM order_items WHERE id = :id AND order_id = :order_id");
    $itStmt->execute([':id' => $itemId, ':order_id' => $orderId]);
    $item = $itStmt->fetch();

    if (!$item) {
        jsonResponse(['success' => false, 'message' => 'Món không tồn tại trên hóa đơn!'], 404);
    }

    $pdo->beginTransaction();
    try {
        // 1. Update note on item: remove cancel request & note that kitchen rejected cancel
        $updatedNote = "(Bếp đã làm - Giữ nguyên món)";
        $upStmt = $pdo->prepare("UPDATE order_items SET note = :note WHERE id = :id");
        $upStmt->execute([':note' => $updatedNote, ':id' => $itemId]);

        // 2. Insert notification for waiter & cashier
        $notifTitle = "BẾP TỪ CHỐI HỦY MÓN - BÀN {$ord['table_code']}";
        $notifMsg = "Bếp KHÔNG ĐỒNG Ý HỦY món '{$item['product_name']}' (Bàn {$ord['table_code']}) do ĐÃ LÀM. Món vẫn tiếp tục phục vụ bình thường!";

        $notifStmt = $pdo->prepare("
            INSERT INTO app_notifications (
                type, order_id, table_code, title, message, is_read_waiter, is_read_cashier, created_at
            ) VALUES (
                'kitchen_reject_cancel', :order_id, :table_code, :title, :message, 0, 0, :created_at
            )
        ");
        $notifStmt->execute([
            ':order_id' => $orderId,
            ':table_code' => $ord['table_code'],
            ':title' => $notifTitle,
            ':message' => $notifMsg,
            ':created_at' => date('Y-m-d H:i:s')
        ]);
        $notificationId = (int)$pdo->lastInsertId();

        // 3. Log in kitchen_service_logs
        $kUserId = $_SESSION['user_id'] ?? 5;
        $kUserName = $_SESSION['fullname'] ?? ($_SESSION['username'] ?? 'Bếp / Pha chế');
        $kRole = $_SESSION['user_role'] ?? 'kitchen';

        $logStmt = $pdo->prepare("
            INSERT INTO kitchen_service_logs (
                order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, note, created_at
            ) VALUES (
                :order_id, :order_code, :table_code, 'kitchen_reject_cancel', 'Bếp từ chối hủy món', :user_id, :user_name, :user_role, :note, :created_at
            )
        ");
        $logStmt->execute([
            ':order_id' => $orderId,
            ':order_code' => $ord['order_code'],
            ':table_code' => $ord['table_code'],
            ':user_id' => $kUserId,
            ':user_name' => $kUserName,
            ':user_role' => $kRole,
            ':note' => "Từ chối hủy món '{$item['product_name']}' bàn {$ord['table_code']} do đã làm xong/đang làm",
            ':created_at' => date('Y-m-d H:i:s')
        ]);

        $pdo->commit();

        jsonResponse([
            'success' => true,
            'message' => "Đã từ chối hủy món '{$item['product_name']}'. Đơn tiếp tục theo quy trình bình thường!",
            'item_id' => $itemId,
            'updated_note' => $updatedNote,
            'notification_id' => $notificationId
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Lỗi khi từ chối hủy món: ' . $e->getMessage()], 500);
    }
}

// 9. GET: Check notifications for Waiter & Cashier (Kiểm tra bếp xong món & bếp hủy món)
if ($action === 'check_notifications') {
    $role = $_GET['role'] ?? ($_SESSION['user_role'] ?? 'waiter');

    // 1. Ready orders (bếp đã làm xong)
    $stmtReady = $pdo->query("
        SELECT 
            o.id as order_id,
            o.order_code,
            o.table_id,
            o.table_code,
            o.user_name,
            o.kitchen_status,
            o.kitchen_ready_at,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
        FROM orders o
        WHERE o.status = 'pending' 
        AND o.kitchen_status = 'ready'
        ORDER BY o.kitchen_ready_at DESC
    ");
    $readyOrders = $stmtReady->fetchAll();

    // 2. Cancellation and Product Lock notifications from kitchen (CHỈ LẤY THÔNG BÁO CHƯA ĐỌC)
    $readColumn = ($role === 'cashier' || $role === 'admin') ? 'is_read_cashier' : 'is_read_waiter';
    $notifStmt = $pdo->query("
        SELECT * FROM app_notifications 
        WHERE type IN ('kitchen_cancel_item', 'kitchen_reject_cancel', 'product_locked', 'product_unlocked') 
        AND {$readColumn} = 0
        ORDER BY id DESC LIMIT 20
    ");
    $cancellations = $notifStmt->fetchAll();

    // 3. Direct kitchen_ready alerts (Báo xong món / Báo lại chuông)
    $readyAlertsStmt = $pdo->query("
        SELECT * FROM app_notifications 
        WHERE type = 'kitchen_ready' 
        AND {$readColumn} = 0
        ORDER BY id DESC LIMIT 10
    ");
    $readyAlerts = $readyAlertsStmt->fetchAll();

    jsonResponse([
        'success' => true,
        'ready_orders' => $readyOrders,
        'cancellations' => $cancellations,
        'ready_alerts' => $readyAlerts,
        'data' => $readyOrders // backwards compatibility
    ]);
}

// 9b. POST: Acknowledge Notification (Đánh dấu đã đọc/đã nhận thông báo)
if ($action === 'ack_notification') {
    $notifId = (int)($input['notification_id'] ?? ($_GET['notification_id'] ?? 0));
    $role = trim($input['role'] ?? ($_GET['role'] ?? ($_SESSION['user_role'] ?? 'waiter')));

    if ($notifId > 0) {
        $col = ($role === 'cashier' || $role === 'admin') ? 'is_read_cashier' : 'is_read_waiter';
        $up = $pdo->prepare("UPDATE app_notifications SET {$col} = 1 WHERE id = :id");
        $up->execute([':id' => $notifId]);
    }
    jsonResponse(['success' => true]);
}

jsonResponse(['success' => false, 'message' => 'Hành động không hợp lệ!'], 400);
