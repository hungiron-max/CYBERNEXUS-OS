<?php
/**
 * Settings API
 * Manages store branding, contact info, and VietQR banking settings.
 * Supports both SQLite and MySQL, and synchronizes with config/config.php.
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT setting_key, setting_value FROM store_settings");
        $settingsRaw = $stmt ? $stmt->fetchAll() : [];
    } catch (Exception $e) {
        $settingsRaw = [];
    }
    
    $settings = [
        'store_name' => STORE_NAME,
        'store_hotline' => STORE_HOTLINE,
        'store_address' => STORE_ADDRESS,
        'store_wifi' => defined('STORE_WIFI') ? STORE_WIFI : '',
        'bank_id' => defined('VIETQR_BANK_ID') ? VIETQR_BANK_ID : 'MB',
        'bank_account_no' => defined('VIETQR_ACCOUNT_NO') ? VIETQR_ACCOUNT_NO : '',
        'bank_account_name' => defined('VIETQR_ACCOUNT_NAME') ? VIETQR_ACCOUNT_NAME : '',
        'app_version' => defined('APP_VERSION') ? APP_VERSION : '7.3.3',
        'db_driver' => defined('DB_DRIVER') ? DB_DRIVER : 'sqlite'
    ];

    foreach ($settingsRaw as $row) {
        if (!empty($row['setting_key'])) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }

    jsonResponse(['success' => true, 'data' => $settings]);
}

checkAuth('admin');

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    
    if (empty($input)) {
        jsonResponse(['success' => false, 'message' => 'Không có dữ liệu gửi lên!'], 400);
    }

    $isMysql = (defined('DB_DRIVER') && DB_DRIVER === 'mysql');
    if (!$isMysql) {
        try {
            $driverName = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
            $isMysql = ($driverName === 'mysql');
        } catch (Exception $e) {
            $isMysql = false;
        }
    }

    try {
        if ($isMysql) {
            $stmt = $pdo->prepare("
                INSERT INTO store_settings (setting_key, setting_value) 
                VALUES (:key, :val) 
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ");
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO store_settings (setting_key, setting_value) 
                VALUES (:key, :val) 
                ON CONFLICT(setting_key) DO UPDATE SET setting_value = :val
            ");
        }

        foreach ($input as $k => $v) {
            if (is_scalar($v) && $k !== 'action') {
                $stmt->execute([':key' => $k, ':val' => (string)$v]);
            }
        }
    } catch (Exception $dbEx) {
        jsonResponse(['success' => false, 'message' => 'Lỗi lưu cơ sở dữ liệu: ' . $dbEx->getMessage()], 500);
    }

    // Synchronize to config/config.php constants
    $configFile = dirname(__DIR__) . '/config/config.php';
    if (file_exists($configFile) && is_writable($configFile)) {
        $content = file_get_contents($configFile);
        if (isset($input['store_name'])) {
            $content = preg_replace("/define\('STORE_NAME',\s*'[^']*'\);/", "define('STORE_NAME', '" . addslashes(trim($input['store_name'])) . "');", $content);
        }
        if (isset($input['store_hotline'])) {
            $content = preg_replace("/define\('STORE_HOTLINE',\s*'[^']*'\);/", "define('STORE_HOTLINE', '" . addslashes(trim($input['store_hotline'])) . "');", $content);
        }
        if (isset($input['store_address'])) {
            $content = preg_replace("/define\('STORE_ADDRESS',\s*'[^']*'\);/", "define('STORE_ADDRESS', '" . addslashes(trim($input['store_address'])) . "');", $content);
        }
        if (isset($input['store_wifi'])) {
            $content = preg_replace("/define\('STORE_WIFI',\s*'[^']*'\);/", "define('STORE_WIFI', '" . addslashes(trim($input['store_wifi'])) . "');", $content);
        }
        if (isset($input['bank_id'])) {
            $cleanBank = strtoupper(trim($input['bank_id']));
            $content = preg_replace("/define\('VIETQR_BANK_ID',\s*'[^']*'\);/", "define('VIETQR_BANK_ID', '" . addslashes($cleanBank) . "');", $content);
        }
        if (isset($input['bank_account_no'])) {
            $cleanAccNo = trim($input['bank_account_no']);
            $content = preg_replace("/define\('VIETQR_ACCOUNT_NO',\s*'[^']*'\);/", "define('VIETQR_ACCOUNT_NO', '" . addslashes($cleanAccNo) . "');", $content);
        }
        if (isset($input['bank_account_name'])) {
            $cleanAccName = strtoupper(trim($input['bank_account_name']));
            $content = preg_replace("/define\('VIETQR_ACCOUNT_NAME',\s*'[^']*'\);/", "define('VIETQR_ACCOUNT_NAME', '" . addslashes($cleanAccName) . "');", $content);
        }
        @file_put_contents($configFile, $content);
    }

    jsonResponse(['success' => true, 'message' => 'Lưu cài đặt hệ thống & VietQR thành công!']);
}

jsonResponse(['success' => false, 'message' => 'Yêu cầu không hợp lệ!'], 400);
