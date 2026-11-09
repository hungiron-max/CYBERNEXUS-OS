<?php
/**
 * Database Upgrade & Migration Helper
 * Adds phone, pin_code, new roles (waiter, kitchen)
 */

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = Database::getConnection();

    // Check columns in users table
    if (DB_DRIVER === 'sqlite') {
        $cols = $pdo->query("PRAGMA table_info(users)")->fetchAll();
        $colNames = array_column($cols, 'name');

        if (!in_array('phone', $colNames)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL");
        }
        if (!in_array('pin_code', $colNames)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN pin_code VARCHAR(10) DEFAULT NULL");
        }

        // Check columns in orders table
        $ordCols = $pdo->query("PRAGMA table_info(orders)")->fetchAll();
        $ordColNames = array_column($ordCols, 'name');
        if (!in_array('kitchen_status', $ordColNames)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN kitchen_status VARCHAR(20) DEFAULT 'pending'");
        }
        if (!in_array('kitchen_ready_at', $ordColNames)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN kitchen_ready_at DATETIME DEFAULT NULL");
        }
        if (!in_array('kitchen_user_id', $ordColNames)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN kitchen_user_id INTEGER DEFAULT NULL");
        }
        if (!in_array('kitchen_user_name', $ordColNames)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN kitchen_user_name VARCHAR(100) DEFAULT NULL");
        }
        if (!in_array('served_at', $ordColNames)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN served_at DATETIME DEFAULT NULL");
        }
        if (!in_array('served_user_id', $ordColNames)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN served_user_id INTEGER DEFAULT NULL");
        }
        if (!in_array('served_user_name', $ordColNames)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN served_user_name VARCHAR(100) DEFAULT NULL");
        }
        if (!in_array('prep_time_minutes', $ordColNames)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN prep_time_minutes INTEGER DEFAULT 0");
        }
        if (!in_array('deliver_time_minutes', $ordColNames)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN deliver_time_minutes INTEGER DEFAULT 0");
        }
        if (!in_array('payment_status', $ordColNames)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20) DEFAULT 'unpaid'");
        }
        if (!in_array('paid_at', $ordColNames)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN paid_at DATETIME DEFAULT NULL");
        }

        // Create kitchen_service_logs table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS kitchen_service_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                order_code VARCHAR(30) NOT NULL,
                table_code VARCHAR(20) NOT NULL,
                action VARCHAR(50) NOT NULL,
                action_label VARCHAR(100) NOT NULL,
                user_id INTEGER DEFAULT NULL,
                user_name VARCHAR(100) DEFAULT NULL,
                user_role VARCHAR(20) DEFAULT NULL,
                duration_seconds INTEGER DEFAULT 0,
                note TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        ");
    } else {
        // MySQL
        $stmt = $pdo->query("DESCRIBE users");
        $cols = $stmt->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('phone', $cols)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL");
        }
        if (!in_array('pin_code', $cols)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN pin_code VARCHAR(10) DEFAULT NULL");
        }

        $ordStmt = $pdo->query("DESCRIBE orders");
        $ordCols = $ordStmt->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('kitchen_status', $ordCols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN kitchen_status VARCHAR(20) DEFAULT 'pending'");
        }
        if (!in_array('kitchen_ready_at', $ordCols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN kitchen_ready_at DATETIME DEFAULT NULL");
        }
        if (!in_array('kitchen_user_id', $ordCols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN kitchen_user_id INT DEFAULT NULL");
        }
        if (!in_array('kitchen_user_name', $ordCols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN kitchen_user_name VARCHAR(100) DEFAULT NULL");
        }
        if (!in_array('served_at', $ordCols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN served_at DATETIME DEFAULT NULL");
        }
        if (!in_array('served_user_id', $ordCols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN served_user_id INT DEFAULT NULL");
        }
        if (!in_array('served_user_name', $ordCols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN served_user_name VARCHAR(100) DEFAULT NULL");
        }
        if (!in_array('prep_time_minutes', $ordCols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN prep_time_minutes INT DEFAULT 0");
        }
        if (!in_array('deliver_time_minutes', $ordCols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN deliver_time_minutes INT DEFAULT 0");
        }
        if (!in_array('payment_status', $ordCols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20) DEFAULT 'unpaid'");
        }
        if (!in_array('paid_at', $ordCols)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN paid_at DATETIME DEFAULT NULL");
        }

        // Create kitchen_service_logs table for MySQL
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS kitchen_service_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                order_code VARCHAR(30) NOT NULL,
                table_code VARCHAR(20) NOT NULL,
                action VARCHAR(50) NOT NULL,
                action_label VARCHAR(100) NOT NULL,
                user_id INT DEFAULT NULL,
                user_name VARCHAR(100) DEFAULT NULL,
                user_role VARCHAR(20) DEFAULT NULL,
                duration_seconds INT DEFAULT 0,
                note TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    }

    // Seed default staff accounts if not exist
    $defaultUsers = [
        [
            'username' => 'Admin',
            'fullname' => 'Quản Trị Viên (Chủ quán)',
            'role' => 'admin',
            'phone' => '0967041111',
            'pin_code' => '9999',
            'password' => '$2y$10$0zX77o5959eG19Xh5gYyGOSL4Mh4N2nIbmv17L3v4o3Xk0v7mKqSu'
        ],
        [
            'username' => 'ThuNgan',
            'fullname' => 'Thu Ngân 01',
            'role' => 'cashier',
            'phone' => '0901234567',
            'pin_code' => '1111',
            'password' => '$2y$10$0zX77o5959eG19Xh5gYyGOSL4Mh4N2nIbmv17L3v4o3Xk0v7mKqSu'
        ],
        [
            'username' => 'PhucVu1',
            'fullname' => 'Nguyễn Văn Nam (Chạy bàn)',
            'role' => 'waiter',
            'phone' => '0912345678',
            'pin_code' => '2222',
            'password' => '$2y$10$0zX77o5959eG19Xh5gYyGOSL4Mh4N2nIbmv17L3v4o3Xk0v7mKqSu'
        ],
        [
            'username' => 'PhucVu2',
            'fullname' => 'Trần Thị Mai (Chạy bàn)',
            'role' => 'waiter',
            'phone' => '0923456789',
            'pin_code' => '3333',
            'password' => '$2y$10$0zX77o5959eG19Xh5gYyGOSL4Mh4N2nIbmv17L3v4o3Xk0v7mKqSu'
        ],
        [
            'username' => 'BepPhaChe',
            'fullname' => 'Tổ Pha Chế & Bếp',
            'role' => 'kitchen',
            'phone' => '0934567890',
            'pin_code' => '4444',
            'password' => '$2y$10$0zX77o5959eG19Xh5gYyGOSL4Mh4N2nIbmv17L3v4o3Xk0v7mKqSu'
        ]
    ];

    $checkStmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(:username)");
    $insStmt = $pdo->prepare("
        INSERT INTO users (username, fullname, role, phone, pin_code, password, status)
        VALUES (:username, :fullname, :role, :phone, :pin_code, :password, 'active')
    ");
    $upStmt = $pdo->prepare("
        UPDATE users SET phone = :phone, pin_code = :pin_code, role = :role, fullname = :fullname WHERE id = :id
    ");

    foreach ($defaultUsers as $u) {
        $checkStmt->execute([':username' => $u['username']]);
        $existingId = $checkStmt->fetchColumn();
        if ($existingId) {
            $upStmt->execute([
                ':phone' => $u['phone'],
                ':pin_code' => $u['pin_code'],
                ':role' => $u['role'],
                ':fullname' => $u['fullname'],
                ':id' => $existingId
            ]);
        } else {
            $insStmt->execute([
                ':username' => $u['username'],
                ':fullname' => $u['fullname'],
                ':role' => $u['role'],
                ':phone' => $u['phone'],
                ':pin_code' => $u['pin_code'],
                ':password' => $u['password']
            ]);
        }
    }

    // Backfill payment_status and paid_at
    $pdo->exec("UPDATE orders SET payment_status = 'paid', paid_at = completed_at WHERE completed_at IS NOT NULL AND (payment_status = 'unpaid' OR payment_status IS NULL)");

    // Fix orders that were checked out today but kitchen haven't cooked/served yet:
    // They must remain 'pending' with payment_status = 'paid' until kitchen cooks and waiter serves!
    $pdo->exec("
        UPDATE orders 
        SET status = 'pending', completed_at = NULL 
        WHERE DATE(created_at) = DATE('now', 'localtime') 
        AND status = 'completed' 
        AND (kitchen_ready_at IS NULL OR served_at IS NULL OR kitchen_status = 'pending')
    ");

    // Complete orders where all 3 factors are met (Cooked + Served + Paid)
    $pdo->exec("
        UPDATE orders 
        SET status = 'completed', 
            completed_at = COALESCE(completed_at, paid_at, served_at, CURRENT_TIMESTAMP)
        WHERE status = 'pending' 
          AND (payment_status = 'paid' OR paid_at IS NOT NULL) 
          AND (kitchen_status = 'served' OR served_at IS NOT NULL)
    ");

    // Free tables that have no pending order
    $pdo->exec("
        UPDATE tables_areas 
        SET status = 'free', active_order_id = NULL 
        WHERE id NOT IN (SELECT table_id FROM orders WHERE status = 'pending' AND table_id IS NOT NULL)
    ");

    // Re-occupy tables for orders that are pending
    $pendingOrds = $pdo->query("SELECT id, table_id, guest_count FROM orders WHERE status = 'pending' AND table_id IS NOT NULL")->fetchAll();
    foreach ($pendingOrds as $po) {
        $upTbl = $pdo->prepare("UPDATE tables_areas SET status = 'occupied', active_order_id = :ord_id, guest_count = :gc WHERE id = :tid");
        $upTbl->execute([':ord_id' => $po['id'], ':gc' => $po['guest_count'] ?: 1, ':tid' => $po['table_id']]);
    }

    echo "Upgrade completed successfully. Users and Orders 3-factor lifecycle upgraded.\n";
} catch (Exception $e) {
    echo "Upgrade error: " . $e->getMessage() . "\n";
}

