<?php
/**
 * Application Configuration
 * Sale-App POS & Admin Management System
 */

// Prevent multiple definitions
if (!defined('APP_INIT')) {
    define('APP_INIT', true);
}

// Start session if not started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Google Gemini AI Key (Dùng cho OCR hóa đơn, bóc tách giấy viết tay & tạo ảnh món AI)
define('GEMINI_API_KEY', getenv('GEMINI_API_KEY') ?: '');

// Timezone
date_default_timezone_set('Asia/Ho_Chi_Minh');

// Application Details
define('APP_NAME', 'POS GÓC PHỐ');
define('APP_SUBTITLE', 'Hệ Thống Bán Hàng & Quản Trị Trà Sữa - Cafe');
define('APP_VERSION', '7.3.10 In Tạm Đơn Đang Tạo');

// Database Driver Selection: 'sqlite' or 'mysql'
define('DB_DRIVER', 'sqlite'); 

// SQLite Configuration
define('SQLITE_FILE', dirname(__DIR__) . '/database/pos_database.sqlite');

// MySQL Configuration (Use when DB_DRIVER is set to 'mysql')
define('MYSQL_HOST', '127.0.0.1');
define('MYSQL_PORT', 3306);
define('MYSQL_DATABASE', 'saleapp');
define('MYSQL_USER', 'saleapp');
define('MYSQL_PASSWORD', '123456Ht@');
define('MYSQL_CHARSET', 'utf8mb4');

// Store & Receipt Information
define('STORE_NAME', 'GÓC PHỐ COFFEE & TEA');
define('STORE_HOTLINE', '0932.885.131');
define('STORE_ADDRESS', '123 Đường Số 5, P. Linh Trung, TP. Thủ Đức, TP.HCM');
define('STORE_WIFI', 'GocPho_Guest / pass: 88888888');

// VietQR Payment Integration Settings
define('VIETQR_BANK_ID', 'OCB'); // MB, VCB, ACB, TPB, VPB, TECHCOMBANK...
define('VIETQR_ACCOUNT_NO', '0918608073');
define('VIETQR_ACCOUNT_NAME', 'NGUYEN CHI HUNG');

// Helper JSON Response function for APIs
function jsonResponse($data, $statusCode = 200) {
    if (!headers_sent()) {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Authentication Helper
function checkAuth($roleRequired = null) {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $isApiOrCli = (php_sapi_name() === 'cli') || (strpos($uri, '/api/') !== false);
    
    if (!isset($_SESSION['user_id'])) {
        if ($isApiOrCli) {
            jsonResponse(['success' => false, 'message' => 'Vui lòng đăng nhập để tiếp tục!'], 401);
        } else {
            header('Location: index.php?auth=required');
            exit;
        }
    }
    
    if ($roleRequired) {
        $allowed = is_array($roleRequired) ? $roleRequired : [$roleRequired];
        if (!in_array($_SESSION['user_role'], $allowed) && $_SESSION['user_role'] !== 'admin') {
            if ($isApiOrCli) {
                jsonResponse(['success' => false, 'message' => 'Bạn không có quyền thực hiện chức năng này!'], 403);
            } else {
                header('Location: index.php?error=forbidden');
                exit;
            }
        }
    }
    return true;
}

/**
 * Role-Based Access Control (RBAC) redirector for web views
 * Automatically redirects users to their designated screen based on their role:
 * - admin: access to all screens
 * - cashier: index.php, order.php (blocked from admin.php)
 * - kitchen: kitchen.php only (blocked from index.php, admin.php, order.php)
 * - waiter: order.php only (blocked from index.php, admin.php, kitchen.php)
 */
function enforceRoleAccess(array $allowedRoles) {
    if (!isset($_SESSION['user_id'])) {
        header('Location: index.php?auth=required');
        exit;
    }
    
    $userRole = $_SESSION['user_role'] ?? 'waiter';
    if ($userRole === 'admin') {
        return; // Administrator has full system access
    }
    
    if (!in_array($userRole, $allowedRoles)) {
        // Redirect to designated screen based on user role
        if ($userRole === 'kitchen') {
            header('Location: kitchen.php');
        } elseif ($userRole === 'waiter') {
            header('Location: order.php');
        } elseif ($userRole === 'cashier') {
            header('Location: index.php');
        } elseif ($userRole === 'customer') {
            header('Location: customer.php');
        } else {
            header('Location: index.php?error=forbidden');
        }
        exit;
    }
}

/**
 * Detect if request is from a mobile phone or tablet
 */
function isMobileDevice(): bool {
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    return (bool) preg_match('/(android|iphone|ipad|ipod|blackberry|windows phone|mobile)/i', $ua);
}

/**
 * Generate VietQR Quick Payment Link
 */
function generateVietQrUrl(float $amount, string $note = ''): string {
    $bankId = defined('VIETQR_BANK_ID') ? VIETQR_BANK_ID : 'MB';
    $accNo = defined('VIETQR_ACCOUNT_NO') ? VIETQR_ACCOUNT_NO : '0967041111';
    $accName = defined('VIETQR_ACCOUNT_NAME') ? VIETQR_ACCOUNT_NAME : 'NGUYEN VAN PHAT';

    return sprintf(
        "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%d&addInfo=%s&accountName=%s",
        urlencode($bankId),
        urlencode($accNo),
        (int)$amount,
        urlencode($note),
        urlencode($accName)
    );
}
