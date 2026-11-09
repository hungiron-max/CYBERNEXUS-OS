<?php
/**
 * Tables & Areas API
 * Table Management, Switch Table, Merge Table
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// 1. GET: Fetch all tables with real-time active order info
if ($method === 'GET' && empty($action)) {
    // 1a. Auto-complete any order that meets all 3 factors (Cooking, Serving, Payment)
    $nowStr = date('Y-m-d H:i:s');
    $pdo->exec("
        UPDATE orders 
        SET status = 'completed', 
            completed_at = COALESCE(completed_at, paid_at, served_at, '{$nowStr}')
        WHERE status = 'pending' 
          AND (payment_status = 'paid' OR paid_at IS NOT NULL) 
          AND (kitchen_status = 'served' OR served_at IS NOT NULL)
    ");

    // 1b. Auto-free tables that have no active pending order
    $pdo->exec("
        UPDATE tables_areas 
        SET status = 'free', active_order_id = NULL 
        WHERE id NOT IN (SELECT table_id FROM orders WHERE status = 'pending' AND table_id IS NOT NULL)
    ");

    $stmt = $pdo->query("
        SELECT 
            t.id,
            t.code,
            t.name,
            t.area_type,
            CASE WHEN o.id IS NOT NULL THEN 'occupied' ELSE 'free' END as status,
            o.id as active_order_id,
            COALESCE(o.guest_count, t.guest_count, 1) as guest_count,
            t.sort_order,
            t.created_at,
            o.id as order_id,
            o.order_code,
            o.customer_name,
            o.total_amount,
            o.subtotal,
            o.kitchen_status,
            o.kitchen_ready_at,
            o.served_at,
            o.payment_status,
            o.paid_at,
            o.created_at as order_created_at,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
        FROM tables_areas t
        LEFT JOIN orders o ON (o.id = t.active_order_id OR (t.active_order_id IS NULL AND o.table_id = t.id)) AND o.status = 'pending'
        ORDER BY t.sort_order ASC, t.id ASC
    ");
    $tables = $stmt->fetchAll();

    // Group by area_type
    $grouped = [
        'MANG_VE' => [],
        'TAI_QUAN' => []
    ];

    foreach ($tables as $t) {
        $area = $t['area_type'] ?? 'TAI_QUAN';
        $grouped[$area][] = $t;
    }

    jsonResponse([
        'success' => true,
        'data' => $tables,
        'grouped' => $grouped
    ]);
}

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

// 2. POST: Switch Table (Chuyển bàn)
if ($action === 'switch_table') {
    checkAuth();

    $fromTableId = (int)($input['from_table_id'] ?? 0);
    $toTableId = (int)($input['to_table_id'] ?? 0);

    if ($fromTableId <= 0 || $toTableId <= 0 || $fromTableId === $toTableId) {
        jsonResponse(['success' => false, 'message' => 'Bàn nguồn và bàn đích không hợp lệ!'], 400);
    }

    // Get source table
    $stmtFrom = $pdo->prepare("SELECT * FROM tables_areas WHERE id = :id");
    $stmtFrom->execute([':id' => $fromTableId]);
    $fromTable = $stmtFrom->fetch();

    if (!$fromTable || empty($fromTable['active_order_id'])) {
        jsonResponse(['success' => false, 'message' => 'Bàn nguồn không có hóa đơn đang mở!'], 400);
    }

    // Get destination table
    $stmtTo = $pdo->prepare("SELECT * FROM tables_areas WHERE id = :id");
    $stmtTo->execute([':id' => $toTableId]);
    $toTable = $stmtTo->fetch();

    if (!$toTable) {
        jsonResponse(['success' => false, 'message' => 'Bàn đích không tồn tại!'], 400);
    }

    if ($toTable['status'] === 'occupied' && !empty($toTable['active_order_id'])) {
        jsonResponse(['success' => false, 'message' => 'Bàn đích đang có khách! Hãy dùng chức năng Gộp bàn.'], 400);
    }

    $pdo->beginTransaction();
    try {
        $orderId = $fromTable['active_order_id'];

        // Update Order record
        $stmtOrd = $pdo->prepare("UPDATE orders SET table_id = :table_id, table_code = :table_code WHERE id = :order_id");
        $stmtOrd->execute([
            ':table_id' => $toTableId,
            ':table_code' => $toTable['code'],
            ':order_id' => $orderId
        ]);

        // Clear source table
        $stmtClear = $pdo->prepare("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :id");
        $stmtClear->execute([':id' => $fromTableId]);

        // Occupy destination table
        $stmtOccupy = $pdo->prepare("UPDATE tables_areas SET status = 'occupied', active_order_id = :order_id WHERE id = :id");
        $stmtOccupy->execute([
            ':order_id' => $orderId,
            ':id' => $toTableId
        ]);

        $pdo->commit();
        jsonResponse(['success' => true, 'message' => "Đã chuyển từ {$fromTable['code']} sang {$toTable['code']} thành công!"]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Lỗi khi chuyển bàn: ' . $e->getMessage()], 500);
    }
}

// 3. POST: Merge Table (Gộp bàn)
if ($action === 'merge_table') {
    checkAuth();

    $fromTableId = (int)($input['from_table_id'] ?? 0);
    $toTableId = (int)($input['to_table_id'] ?? 0);

    if ($fromTableId <= 0 || $toTableId <= 0 || $fromTableId === $toTableId) {
        jsonResponse(['success' => false, 'message' => 'Bàn ghép và bàn nhận không hợp lệ!'], 400);
    }

    $stmtFrom = $pdo->prepare("SELECT * FROM tables_areas WHERE id = :id");
    $stmtFrom->execute([':id' => $fromTableId]);
    $fromTable = $stmtFrom->fetch();

    $stmtTo = $pdo->prepare("SELECT * FROM tables_areas WHERE id = :id");
    $stmtTo->execute([':id' => $toTableId]);
    $toTable = $stmtTo->fetch();

    if (!$fromTable || empty($fromTable['active_order_id']) || !$toTable || empty($toTable['active_order_id'])) {
        jsonResponse(['success' => false, 'message' => 'Cả 2 bàn đều phải có hóa đơn đang mở để thực hiện gộp!'], 400);
    }

    $pdo->beginTransaction();
    try {
        $fromOrderId = $fromTable['active_order_id'];
        $toOrderId = $toTable['active_order_id'];

        // Move all items from from_order to to_order
        $stmtMove = $pdo->prepare("UPDATE order_items SET order_id = :to_order_id WHERE order_id = :from_order_id");
        $stmtMove->execute([
            ':to_order_id' => $toOrderId,
            ':from_order_id' => $fromOrderId
        ]);

        // Recalculate to_order subtotal and total
        $stmtRecalc = $pdo->prepare("SELECT SUM(subtotal) FROM order_items WHERE order_id = :order_id");
        $stmtRecalc->execute([':order_id' => $toOrderId]);
        $newSubtotal = (float)$stmtRecalc->fetchColumn();

        $stmtUpTo = $pdo->prepare("UPDATE orders SET subtotal = :subtotal, total_amount = :total_amount WHERE id = :order_id");
        $stmtUpTo->execute([
            ':subtotal' => $newSubtotal,
            ':total_amount' => $newSubtotal,
            ':order_id' => $toOrderId
        ]);

        // Mark old order as cancelled/merged
        $stmtCancel = $pdo->prepare("UPDATE orders SET status = 'cancelled', note = :note WHERE id = :order_id");
        $stmtCancel->execute([
            ':note' => "Đã gộp vào hóa đơn bàn {$toTable['code']}",
            ':order_id' => $fromOrderId
        ]);

        // Free source table
        $stmtFree = $pdo->prepare("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :id");
        $stmtFree->execute([':id' => $fromTableId]);

        $pdo->commit();
        jsonResponse(['success' => true, 'message' => "Đã gộp {$fromTable['code']} vào {$toTable['code']} thành công!"]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Lỗi khi gộp bàn: ' . $e->getMessage()], 500);
    }
}

// 4. Admin CRUD for tables
if ($action === 'add_table' || $action === 'update_table' || $action === 'delete_table') {
    checkAuth('admin');

    if ($action === 'add_table') {
        $code = trim($input['code'] ?? '');
        $name = trim($input['name'] ?? '');
        $areaType = trim($input['area_type'] ?? 'TAI_QUAN');
        $sortOrder = (int)($input['sort_order'] ?? 0);

        if (empty($code) || empty($name)) {
            jsonResponse(['success' => false, 'message' => 'Mã bàn và tên bàn không được để trống!'], 400);
        }

        $stmt = $pdo->prepare("INSERT INTO tables_areas (code, name, area_type, sort_order, status) VALUES (:code, :name, :area_type, :sort_order, 'free')");
        $stmt->execute([
            ':code' => $code,
            ':name' => $name,
            ':area_type' => $areaType,
            ':sort_order' => $sortOrder
        ]);
        jsonResponse(['success' => true, 'message' => 'Thêm bàn thành công!']);
    }

    if ($action === 'delete_table') {
        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare("DELETE FROM tables_areas WHERE id = :id AND status = 'free'");
        $stmt->execute([':id' => $id]);
        jsonResponse(['success' => true, 'message' => 'Đã xóa bàn thành công!']);
    }
}

jsonResponse(['success' => false, 'message' => 'Hành động không hợp lệ!'], 400);
