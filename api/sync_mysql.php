<?php
/**
 * Cloud MySQL Synchronization API
 * Tests MySQL connection, reports granular errors, creates database/tables,
 * and synchronizes all POS data from SQLite to MySQL.
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
checkAuth();

// Only admin can configure or perform sync
if (($_SESSION['user_role'] ?? '') !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Bạn không có quyền thực hiện thao tác này! Yêu cầu quyền Quản trị viên (Admin).'], 403);
}

$sqlitePdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

/**
 * Diagnostic helper to format friendly Vietnamese error message from MySQL PDOException
 */
function formatMySqlError(PDOException $e, string $host, int $port, string $database, string $user): array {
    $code = $e->getCode();
    $rawMsg = $e->getMessage();
    $friendlyMsg = 'Lỗi kết nối MySQL: ' . $rawMsg;

    // Check specific MySQL error codes
    if ($code == 2002 || strpos($rawMsg, '2002') !== false || strpos($rawMsg, 'Connection refused') !== false || strpos($rawMsg, 'target machine actively refused') !== false) {
        $friendlyMsg = "Không thể kết nối đến máy chủ MySQL tại {$host}:{$port}. Vui lòng kiểm tra:\n1. Dịch vụ MySQL (XAMPP / MySQL Service / Docker) đã được BẬT chưa?\n2. Địa chỉ IP máy chủ và Cổng ({$port}) có chính xác không?\n3. Tường lửa (Firewall) máy chủ có cho phép cổng này không?";
    } elseif ($code == 1045 || strpos($rawMsg, '1045') !== false || strpos($rawMsg, 'Access denied') !== false) {
        $friendlyMsg = "Sai thông tin xác thực MySQL: Tên đăng nhập ('{$user}') hoặc Mật khẩu không chính xác (Mã lỗi 1045: Access Denied). Vui lòng kiểm tra lại mật khẩu.";
    } elseif ($code == 1049 || strpos($rawMsg, '1049') !== false || strpos($rawMsg, 'Unknown database') !== false) {
        $friendlyMsg = "Cơ sở dữ liệu '{$database}' không tồn tại trên máy chủ MySQL. Bạn vui lòng bật tùy chọn 'Tự động tạo Database nếu chưa có' để hệ thống tự tạo.";
    } elseif ($code == 1044 || strpos($rawMsg, '1044') !== false) {
        $friendlyMsg = "Tài khoản '{$user}' không có quyền truy cập hoặc tạo cơ sở dữ liệu '{$database}'. Vui lòng cấp quyền (GRANT ALL) cho user này.";
    }

    return [
        'code' => $code,
        'message' => $friendlyMsg,
        'technical' => $rawMsg
    ];
}

/**
 * Get current configured settings
 */
if ($method === 'GET' && ($action === 'get_config' || empty($action))) {
    jsonResponse([
        'success' => true,
        'config' => [
            'host' => defined('MYSQL_HOST') ? MYSQL_HOST : '127.0.0.1',
            'port' => defined('MYSQL_PORT') ? (int)MYSQL_PORT : 3306,
            'database' => defined('MYSQL_DATABASE') ? MYSQL_DATABASE : 'pos_sale_app',
            'user' => defined('MYSQL_USER') ? MYSQL_USER : 'root',
            'password' => defined('MYSQL_PASSWORD') ? MYSQL_PASSWORD : '',
            'current_driver' => defined('DB_DRIVER') ? DB_DRIVER : 'sqlite'
        ]
    ]);
}

/**
 * Test MySQL connection
 */
if ($action === 'test_connection') {
    $host = trim($input['host'] ?? '127.0.0.1');
    $port = (int)($input['port'] ?? 3306);
    $database = trim($input['database'] ?? 'pos_sale_app');
    $user = trim($input['user'] ?? 'root');
    $password = (string)($input['password'] ?? '');
    $autoCreateDb = !empty($input['auto_create_db']);

    if (empty($host)) {
        jsonResponse(['success' => false, 'message' => 'Vui lòng nhập địa chỉ máy chủ MySQL (Host)!'], 400);
    }
    if ($port <= 0 || $port > 65535) {
        jsonResponse(['success' => false, 'message' => 'Cổng kết nối (Port) không hợp lệ (mặc định là 3306)!'], 400);
    }

    // First try connecting to server root (without dbname) to check host and credentials
    try {
        $rootDsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $host, $port);
        $testPdo = new PDO($rootDsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 4,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
        ]);
        
        $serverVersion = $testPdo->query("SELECT VERSION()")->fetchColumn() ?: 'Unknown';

        // Check if database exists
        $dbCheck = $testPdo->prepare("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = :dbname");
        $dbCheck->execute([':dbname' => $database]);
        $dbExists = (bool)$dbCheck->fetchColumn();

        if (!$dbExists && $autoCreateDb) {
            // Attempt to create
            $testPdo->exec("CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $dbExists = true;
        }

        jsonResponse([
            'success' => true,
            'message' => 'Kết nối đến máy chủ MySQL thành công rực rỡ!',
            'server_version' => $serverVersion,
            'database_exists' => $dbExists,
            'database_name' => $database
        ]);
    } catch (PDOException $e) {
        $diag = formatMySqlError($e, $host, $port, $database, $user);
        jsonResponse([
            'success' => false,
            'message' => $diag['message'],
            'error_code' => $diag['code'],
            'technical' => $diag['technical']
        ], 400);
    }
}

/**
 * Execute Cloud Sync (SQLite -> MySQL)
 */
if ($action === 'sync_data') {
    $host = trim($input['host'] ?? '127.0.0.1');
    $port = (int)($input['port'] ?? 3306);
    $database = trim($input['database'] ?? 'pos_sale_app');
    $user = trim($input['user'] ?? 'root');
    $password = (string)($input['password'] ?? '');
    $saveConfig = !empty($input['save_config']);
    $autoCreateDb = !empty($input['auto_create_db']);

    if (empty($host) || empty($database)) {
        jsonResponse(['success' => false, 'message' => 'Vui lòng điền đầy đủ Host và Tên Database!'], 400);
    }

    try {
        // 1. Connect to MySQL server
        $rootDsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $host, $port);
        $mysqlRoot = new PDO($rootDsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5
        ]);

        // 2. Ensure database exists
        $mysqlRoot->exec("CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

        // 3. Connect to target database
        $targetDsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $database);
        $mysqlPdo = new PDO($targetDsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
        ]);

        $serverVersion = $mysqlPdo->query("SELECT VERSION()")->fetchColumn() ?: 'MySQL';

        // 4. Create Tables Schema on MySQL
        $tableSchemas = [
            'users' => "
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    fullname VARCHAR(100) NOT NULL,
                    role VARCHAR(20) NOT NULL DEFAULT 'cashier',
                    user_code VARCHAR(20) DEFAULT NULL,
                    phone VARCHAR(20) DEFAULT NULL,
                    pin_code VARCHAR(10) DEFAULT NULL,
                    avatar VARCHAR(255) DEFAULT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ",
            'categories' => "
                CREATE TABLE IF NOT EXISTS categories (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    icon VARCHAR(50) DEFAULT 'coffee',
                    sort_order INT DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ",
            'products' => "
                CREATE TABLE IF NOT EXISTS products (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    category_id INT NOT NULL,
                    code VARCHAR(20) NOT NULL UNIQUE,
                    name VARCHAR(150) NOT NULL,
                    unit VARCHAR(20) NOT NULL DEFAULT 'ly',
                    cost_price DECIMAL(12, 2) DEFAULT 0,
                    sale_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
                    image VARCHAR(255) DEFAULT NULL,
                    is_topping INT DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'active',
                    description TEXT DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ",
            'tables_areas' => "
                CREATE TABLE IF NOT EXISTS tables_areas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    code VARCHAR(20) NOT NULL UNIQUE,
                    name VARCHAR(100) NOT NULL,
                    area_type VARCHAR(20) NOT NULL DEFAULT 'TAI_QUAN',
                    status VARCHAR(20) DEFAULT 'free',
                    active_order_id INT DEFAULT NULL,
                    guest_count INT DEFAULT 1,
                    sort_order INT DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ",
            'orders' => "
                CREATE TABLE IF NOT EXISTS orders (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    order_code VARCHAR(30) NOT NULL UNIQUE,
                    table_id INT DEFAULT NULL,
                    table_code VARCHAR(20) DEFAULT 'MANG VỀ',
                    customer_name VARCHAR(100) DEFAULT 'Khách vãng lai',
                    guest_count INT DEFAULT 1,
                    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
                    discount_type VARCHAR(10) DEFAULT 'amount',
                    discount_value DECIMAL(12, 2) DEFAULT 0,
                    discount_amount DECIMAL(12, 2) DEFAULT 0,
                    vat_percent DECIMAL(5, 2) DEFAULT 0,
                    vat_amount DECIMAL(12, 2) DEFAULT 0,
                    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
                    payment_method VARCHAR(20) DEFAULT 'cash',
                    cash_received DECIMAL(12, 2) DEFAULT 0,
                    change_amount DECIMAL(12, 2) DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'pending',
                    user_id INT DEFAULT NULL,
                    user_name VARCHAR(100) DEFAULT 'Administrator',
                    note TEXT DEFAULT NULL,
                    kitchen_status VARCHAR(20) DEFAULT 'pending',
                    kitchen_ready_at DATETIME DEFAULT NULL,
                    kitchen_user_id INT DEFAULT NULL,
                    kitchen_user_name VARCHAR(100) DEFAULT NULL,
                    served_at DATETIME DEFAULT NULL,
                    served_user_id INT DEFAULT NULL,
                    served_user_name VARCHAR(100) DEFAULT NULL,
                    prep_time_minutes INT DEFAULT 0,
                    deliver_time_minutes INT DEFAULT 0,
                    payment_status VARCHAR(20) DEFAULT 'unpaid',
                    paid_at DATETIME DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME DEFAULT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ",
            'order_items' => "
                CREATE TABLE IF NOT EXISTS order_items (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    order_id INT NOT NULL,
                    product_id INT NOT NULL,
                    product_code VARCHAR(20) DEFAULT '',
                    product_name VARCHAR(150) NOT NULL,
                    unit VARCHAR(20) DEFAULT 'ly',
                    quantity INT NOT NULL DEFAULT 1,
                    price DECIMAL(12, 2) NOT NULL DEFAULT 0,
                    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
                    note VARCHAR(255) DEFAULT '',
                    toppings_json TEXT DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ",
            'store_settings' => "
                CREATE TABLE IF NOT EXISTS store_settings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    setting_key VARCHAR(50) NOT NULL UNIQUE,
                    setting_value TEXT DEFAULT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ",
            'kitchen_service_logs' => "
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ",
            'app_notifications' => "
                CREATE TABLE IF NOT EXISTS app_notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    type VARCHAR(30) NOT NULL,
                    order_id INT DEFAULT NULL,
                    table_code VARCHAR(30) DEFAULT NULL,
                    title VARCHAR(150) NOT NULL,
                    message TEXT DEFAULT NULL,
                    is_read_waiter INT DEFAULT 0,
                    is_read_cashier INT DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            "
        ];

        foreach ($tableSchemas as $tblName => $ddl) {
            $mysqlPdo->exec($ddl);
        }

        $tablesOrder = [
            'users',
            'categories',
            'products',
            'tables_areas',
            'orders',
            'order_items',
            'store_settings',
            'kitchen_service_logs',
            'app_notifications'
        ];

        // Dynamic Schema Auto-Migration: Ensure all columns from SQLite exist in MySQL
        foreach ($tablesOrder as $tbl) {
            $checkTbl = $sqlitePdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='{$tbl}'")->fetchColumn();
            if (!$checkTbl) continue;

            $sqliteCols = $sqlitePdo->query("PRAGMA table_info(`{$tbl}`)")->fetchAll(PDO::FETCH_ASSOC);
            if (empty($sqliteCols)) continue;

            try {
                $myCols = $mysqlPdo->query("SHOW COLUMNS FROM `{$tbl}`")->fetchAll(PDO::FETCH_COLUMN);
            } catch (Exception $e) {
                continue;
            }

            foreach ($sqliteCols as $sc) {
                $cName = $sc['name'];
                if (!in_array($cName, $myCols)) {
                    $uType = strtoupper($sc['type']);
                    $colDef = "VARCHAR(255) DEFAULT NULL";
                    if (strpos($uType, 'INT') !== false) {
                        $colDef = "INT DEFAULT 0";
                    } elseif (strpos($uType, 'DECIMAL') !== false || strpos($uType, 'NUMERIC') !== false) {
                        $colDef = "DECIMAL(12, 2) DEFAULT 0";
                    } elseif (strpos($uType, 'DATE') !== false || strpos($uType, 'TIME') !== false) {
                        $colDef = "DATETIME DEFAULT NULL";
                    } elseif (strpos($uType, 'TEXT') !== false) {
                        $colDef = "TEXT DEFAULT NULL";
                    } elseif (strpos($uType, 'VARCHAR') !== false) {
                        $colDef = $sc['type'] . " DEFAULT NULL";
                    }
                    try {
                        $mysqlPdo->exec("ALTER TABLE `{$tbl}` ADD COLUMN `{$cName}` {$colDef}");
                    } catch (Exception $alterEx) {
                        // Ignore if column was concurrently added
                    }
                }
            }
        }

        // 5. Transfer Data Table by Table
        $syncedCounts = [];
        $totalRecords = 0;

        $mysqlPdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
        $mysqlPdo->beginTransaction();

        foreach ($tablesOrder as $tbl) {
            // Check if SQLite table exists
            $checkTbl = $sqlitePdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='{$tbl}'")->fetchColumn();
            if (!$checkTbl) {
                $syncedCounts[$tbl] = 0;
                continue;
            }

            $rows = $sqlitePdo->query("SELECT * FROM `{$tbl}`")->fetchAll(PDO::FETCH_ASSOC);
            $syncedCounts[$tbl] = count($rows);
            $totalRecords += count($rows);

            if (empty($rows)) {
                continue;
            }

            // Get columns that exist in BOTH SQLite and MySQL
            $myCols = $mysqlPdo->query("SHOW COLUMNS FROM `{$tbl}`")->fetchAll(PDO::FETCH_COLUMN);
            $rowCols = array_keys($rows[0]);
            $cols = array_values(array_intersect($rowCols, $myCols));

            if (empty($cols)) {
                continue;
            }

            $colList = '`' . implode('`, `', $cols) . '`';
            $placeholders = ':' . implode(', :', $cols);

            $updatePairs = [];
            foreach ($cols as $c) {
                if ($c === 'id') continue;
                $updatePairs[] = "`{$c}` = VALUES(`{$c}`)";
            }
            $updateClause = !empty($updatePairs) ? (' ON DUPLICATE KEY UPDATE ' . implode(', ', $updatePairs)) : '';

            $sql = "INSERT INTO `{$tbl}` ({$colList}) VALUES ({$placeholders}) {$updateClause}";
            $stmt = $mysqlPdo->prepare($sql);

            foreach ($rows as $row) {
                $params = [];
                foreach ($cols as $c) {
                    $params[':' . $c] = $row[$c];
                }
                $stmt->execute($params);
            }
        }

        $mysqlPdo->commit();
        $mysqlPdo->exec("SET FOREIGN_KEY_CHECKS = 1;");

        // 6. Save Config if requested
        if ($saveConfig) {
            $configFile = dirname(__DIR__) . '/config/config.php';
            if (file_exists($configFile) && is_writable($configFile)) {
                $content = file_get_contents($configFile);
                $content = preg_replace("/define\('MYSQL_HOST',\s*'[^']*'\);/", "define('MYSQL_HOST', '" . addslashes($host) . "');", $content);
                $content = preg_replace("/define\('MYSQL_PORT',\s*\d+\);/", "define('MYSQL_PORT', " . (int)$port . ");", $content);
                $content = preg_replace("/define\('MYSQL_DATABASE',\s*'[^']*'\);/", "define('MYSQL_DATABASE', '" . addslashes($database) . "');", $content);
                $content = preg_replace("/define\('MYSQL_USER',\s*'[^']*'\);/", "define('MYSQL_USER', '" . addslashes($user) . "');", $content);
                $content = preg_replace("/define\('MYSQL_PASSWORD',\s*'[^']*'\);/", "define('MYSQL_PASSWORD', '" . addslashes($password) . "');", $content);
                @file_put_contents($configFile, $content);
            }
        }

        jsonResponse([
            'success' => true,
            'message' => 'Đồng bộ toàn bộ cơ sở dữ liệu lên Cloud MySQL thành công!',
            'synced_counts' => $syncedCounts,
            'total_records' => $totalRecords,
            'server_version' => $serverVersion,
            'database' => $database,
            'host' => $host,
            'synced_at' => date('d/m/Y H:i:s')
        ]);
    } catch (PDOException $e) {
        if (isset($mysqlPdo)) {
            if ($mysqlPdo->inTransaction()) {
                $mysqlPdo->rollBack();
            }
            @$mysqlPdo->exec("SET FOREIGN_KEY_CHECKS = 1;");
        }
        $diag = formatMySqlError($e, $host, $port, $database, $user);
        jsonResponse([
            'success' => false,
            'message' => $diag['message'],
            'error_code' => $diag['code'],
            'technical' => $diag['technical']
        ], 400);
    } catch (Exception $e) {
        if (isset($mysqlPdo)) {
            if ($mysqlPdo->inTransaction()) {
                $mysqlPdo->rollBack();
            }
            @$mysqlPdo->exec("SET FOREIGN_KEY_CHECKS = 1;");
        }
        jsonResponse([
            'success' => false,
            'message' => 'Lỗi đồng bộ: ' . $e->getMessage()
        ], 500);
    }
}

jsonResponse(['success' => false, 'message' => 'Yêu cầu không hợp lệ!'], 400);

