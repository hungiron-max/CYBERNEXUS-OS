<?php
/**
 * Authentication API
 * Login, Logout, Session Verification
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? 'check');

$pdo = Database::getConnection();

// Session check
if ($action === 'check') {
    if (isset($_SESSION['user_id'])) {
        jsonResponse([
            'success' => true,
            'authenticated' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'fullname' => $_SESSION['fullname'],
                'role' => $_SESSION['user_role']
            ],
            'system' => [
                'app_name' => APP_NAME,
                'version' => APP_VERSION,
                'db_driver' => DB_DRIVER,
                'store_name' => STORE_NAME
            ]
        ]);
    } else {
        jsonResponse([
            'success' => true,
            'authenticated' => false,
            'system' => [
                'app_name' => APP_NAME,
                'version' => APP_VERSION,
                'db_driver' => DB_DRIVER,
                'store_name' => STORE_NAME
            ]
        ]);
    }
}

// Login
if ($action === 'login' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    
    $username = trim($input['username'] ?? '');
    $password = trim($input['password'] ?? '');

    if (empty($username)) {
        jsonResponse(['success' => false, 'message' => 'Vui lòng nhập tên tài khoản!'], 400);
    }

    // Support login by Username OR User Code (e.g. ADM001, ACC001, STF001, KIT001, USR001)
    $stmt = $pdo->prepare("
        SELECT * FROM users 
        WHERE (LOWER(username) = LOWER(:username) OR LOWER(user_code) = LOWER(:username)) 
          AND status = 'active' 
        LIMIT 1
    ");
    $stmt->execute([':username' => $username]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(['success' => false, 'message' => 'Tài khoản hoặc mã người dùng không tồn tại hoặc đã bị khóa!'], 401);
    }

    // Password verification logic:
    // 1. If password in DB is bcrypt hash
    // 2. Legacy fallback: empty password allowed if default, or 'admin123', '123456', or raw match
    $isValidPassword = false;

    if (empty($password) && (empty($user['password']) || $user['username'] === 'Admin')) {
        // Support legacy empty password login as indicated in the POS machine screen!
        $isValidPassword = true;
    } elseif (password_verify($password, $user['password'])) {
        $isValidPassword = true;
    } elseif ($password === 'admin123' || $password === '123456' || $password === $user['password']) {
        $isValidPassword = true;
    }

    if (!$isValidPassword) {
        jsonResponse(['success' => false, 'message' => 'Mật khẩu không chính xác! (Mặc định: để trống hoặc admin123)'], 401);
    }

    // Set Session
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_code'] = $user['user_code'] ?? '';
    $_SESSION['username'] = $user['username'];
    $_SESSION['fullname'] = $user['fullname'];
    $_SESSION['user_role'] = $user['role'];

    // Persistent auth cookie for iPad / LAN resilience
    setcookie('pos_auth_user_id', (string)$user['id'], time() + (86400 * 30), "/");

    // Remember me cookie if requested
    if (!empty($input['remember'])) {
        setcookie('pos_saved_user', $user['username'], time() + (86400 * 30), "/");
    }

    $isMobile = !empty($input['is_mobile']) || isMobileDevice();
    $redirectUrl = 'index.php';
    if ($user['role'] === 'waiter') {
        $redirectUrl = 'order.php';
    } elseif ($user['role'] === 'kitchen') {
        $redirectUrl = 'kitchen.php';
    } elseif ($user['role'] === 'customer') {
        $redirectUrl = 'customer.php';
    } elseif ($user['role'] === 'admin') {
        // Tài khoản admin đăng nhập thì mặc định hiển thị là Quản Trị (admin.php) trên cả PC và Mobile
        $redirectUrl = 'admin.php';
    }

    // Tự động chấm công vào ca (Check-in) khi nhân viên đăng nhập
    autoCheckInStaff($pdo, $user);

    jsonResponse([
        'success' => true,
        'message' => 'Đăng nhập thành công!',
        'user' => [
            'id' => $user['id'],
            'user_code' => $user['user_code'] ?? '',
            'username' => $user['username'],
            'fullname' => $user['fullname'],
            'role' => $user['role']
        ],
        'redirect' => $redirectUrl
    ]);
}

// Quick PIN Login (Cho nhân viên phục vụ / order bằng mã PIN 4 số)
if ($action === 'pin_login' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $pin = trim($input['pin_code'] ?? '');

    if (empty($pin)) {
        jsonResponse(['success' => false, 'message' => 'Vui lòng nhập mã PIN!'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE pin_code = :pin AND status = 'active' LIMIT 1");
    $stmt->execute([':pin' => $pin]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(['success' => false, 'message' => 'Mã PIN không đúng hoặc nhân viên đã bị khóa!'], 401);
    }

    // Set Session
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_code'] = $user['user_code'] ?? '';
    $_SESSION['username'] = $user['username'];
    $_SESSION['fullname'] = $user['fullname'];
    $_SESSION['user_role'] = $user['role'];

    // Persistent auth cookie for iPad / LAN resilience
    setcookie('pos_auth_user_id', (string)$user['id'], time() + (86400 * 30), "/");

    $isMobile = !empty($input['is_mobile']) || isMobileDevice();
    $redirectUrl = 'index.php';
    if ($user['role'] === 'waiter') {
        $redirectUrl = 'order.php';
    } elseif ($user['role'] === 'kitchen') {
        $redirectUrl = 'kitchen.php';
    } elseif ($user['role'] === 'customer') {
        $redirectUrl = 'customer.php';
    } elseif ($user['role'] === 'admin') {
        // Tài khoản admin đăng nhập thì mặc định hiển thị là Quản Trị (admin.php) trên cả PC và Mobile
        $redirectUrl = 'admin.php';
    }

    // Tự động chấm công vào ca (Check-in) khi nhân viên đăng nhập bằng PIN
    autoCheckInStaff($pdo, $user);

    jsonResponse([
        'success' => true,
        'message' => "Xin chào {$user['fullname']}!",
        'user' => [
            'id' => $user['id'],
            'user_code' => $user['user_code'] ?? '',
            'username' => $user['username'],
            'fullname' => $user['fullname'],
            'role' => $user['role']
        ],
        'redirect' => $redirectUrl
    ]);
}

// Heartbeat ping from clients to keep online status active
if ($action === 'heartbeat') {
    if (!empty($_SESSION['user_id'])) {
        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("UPDATE users SET is_online = 1, last_active_at = :now WHERE id = :id");
        $stmt->execute([':now' => $now, ':id' => $_SESSION['user_id']]);
        autoCloseExpiredShifts($pdo);
        jsonResponse(['success' => true, 'timestamp' => time()]);
    }
    jsonResponse(['success' => false, 'message' => 'Chưa đăng nhập'], 401);
}

// Logout (Tự động chấm công kết thúc ca Check-out)
if ($action === 'logout') {
    $currentUserId = intval($_SESSION['user_id'] ?? 0);
    if ($currentUserId > 0) {
        autoCheckOutStaff($pdo, $currentUserId);
    }

    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    setcookie('pos_auth_user_id', '', time() - 42000, "/");
    setcookie('pos_saved_user', '', time() - 42000, "/");
    session_destroy();
    jsonResponse(['success' => true, 'message' => 'Đã đăng xuất thành công!']);
}

/**
 * Chấm công tự động khi nhân viên đăng nhập (Check-in)
 * Quy tắc:
 * 1. Nếu ca đang mở (status = 'working') -> Tiếp tục ca làm việc, không tạo mới.
 * 2. Nếu vừa mới đăng xuất <= 30 phút -> Nối tiếp ca vừa rồi (tiếp tục làm việc sau giải lao ngắn hoặc sự cố).
 * 3. 1 ngày làm việc tối đa không quá 2 ca. Nếu login/logout quá 2 lần trong ngày -> Gộp vào ca 2, không tạo ca thứ 3.
 */
function autoCheckInStaff(PDO $pdo, array $user): void {
    if (empty($user['id'])) return;
    try {
        // Tự động kiểm tra và chốt các ca đã hết giờ làm việc quy định
        autoCloseExpiredShifts($pdo);

        $today = date('Y-m-d');
        $now = date('Y-m-d H:i:s');
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';

        // 1. Cập nhật trạng thái trực tuyến
        $stmt = $pdo->prepare("UPDATE users SET is_online = 1, last_active_at = :now WHERE id = :id");
        $stmt->execute([':now' => $now, ':id' => $user['id']]);

        // 2. Kiểm tra xem ca làm hôm nay đã được mở chưa
        $stmt = $pdo->prepare("SELECT id FROM attendances WHERE user_id = :uid AND status = 'working' AND work_date = :today LIMIT 1");
        $stmt->execute([':uid' => $user['id'], ':today' => $today]);
        $existing = $stmt->fetch();

        if ($existing) {
            // Ca làm việc đang mở, nhân viên vẫn đang làm việc
            return;
        }

        // 3. Tìm ca hoàn thành gần nhất trong ngày hôm nay
        $stmt = $pdo->prepare("SELECT id, check_out_time FROM attendances WHERE user_id = :uid AND work_date = :today AND status = 'completed' ORDER BY id DESC LIMIT 1");
        $stmt->execute([':uid' => $user['id'], ':today' => $today]);
        $lastCompleted = $stmt->fetch();

        if ($lastCompleted && !empty($lastCompleted['check_out_time'])) {
            $diffMins = (time() - strtotime($lastCompleted['check_out_time'])) / 60;
            // Nếu vừa mới đăng xuất dưới 30 phút (thoát nhầm, mạng chập chờn, hoặc giải lao ngắn) -> Tự động nối tiếp ca vừa rồi
            if ($diffMins <= 30) {
                $reopen = $pdo->prepare("UPDATE attendances SET status = 'working', check_out_time = NULL WHERE id = :id");
                $reopen->execute([':id' => $lastCompleted['id']]);
                return;
            }
        }

        // 4. Kiểm tra số ca đã ghi nhận trong ngày:
        // Quy tắc: 1 ngày làm việc không quá 2 ca. Trường hợp login/logout quá 2 lần thì chỉ được tính 2 ca.
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM attendances WHERE user_id = :uid AND work_date = :today");
        $stmt->execute([':uid' => $user['id'], ':today' => $today]);
        $shiftCountToday = intval($stmt->fetchColumn());

        if ($shiftCountToday >= 2) {
            // Đã đủ 2 ca trong ngày hôm nay -> Nối tiếp vào ca 2 gần nhất, không tạo thêm ca thứ 3
            if ($lastCompleted) {
                $reopen = $pdo->prepare("UPDATE attendances SET status = 'working', check_out_time = NULL, note = COALESCE(note || ' ', '') || '[Nối tiếp ca 2]' WHERE id = :id");
                $reopen->execute([':id' => $lastCompleted['id']]);
                return;
            }
        }

        // 5. Khởi tạo ca làm việc mới hợp lệ (Ca 1 hoặc Ca 2 trong ngày)
        $hourlyRate = floatval($user['hourly_rate'] ?? 0);
        if ($hourlyRate <= 0) {
            if ($user['role'] === 'cashier') $hourlyRate = 30000;
            elseif ($user['role'] === 'kitchen') $hourlyRate = 28000;
            elseif ($user['role'] === 'waiter') $hourlyRate = 22000;
            elseif ($user['role'] === 'admin') $hourlyRate = 40000;
            else $hourlyRate = 25000;
        }

        $ins = $pdo->prepare("INSERT INTO attendances (user_id, user_name, user_code, user_role, work_date, check_in_time, hourly_rate, status, device_info) VALUES (:uid, :name, :code, :role, :today, :check_in, :rate, 'working', :ip)");
        $ins->execute([
            ':uid' => $user['id'],
            ':name' => $user['fullname'],
            ':code' => $user['user_code'] ?? '',
            ':role' => $user['role'],
            ':today' => $today,
            ':check_in' => $now,
            ':rate' => $hourlyRate,
            ':ip' => $ip
        ]);
    } catch (Exception $e) {
        error_log('Auto check-in error: ' . $e->getMessage());
    }
}

/**
 * Chấm công tự động khi nhân viên đăng xuất (Check-out)
 */
function autoCheckOutStaff(PDO $pdo, int $userId): void {
    if ($userId <= 0) return;
    try {
        $now = date('Y-m-d H:i:s');
        // Đặt offline
        $stmt = $pdo->prepare("UPDATE users SET is_online = 0, last_active_at = :now WHERE id = :id");
        $stmt->execute([':now' => $now, ':id' => $userId]);

        // Tìm ca làm việc đang mở
        $stmt = $pdo->prepare("SELECT * FROM attendances WHERE user_id = :uid AND status = 'working' ORDER BY id DESC LIMIT 1");
        $stmt->execute([':uid' => $userId]);
        $att = $stmt->fetch();

        if ($att) {
            $inTime = strtotime($att['check_in_time']);
            $outTime = time();
            $seconds = max(0, $outTime - $inTime);
            $workHours = round($seconds / 3600, 2);
            // Giới hạn an toàn: 1 ca tối đa không quá 12 tiếng nếu quên logout qua đêm
            if ($workHours > 12) {
                $workHours = 12;
            }
            $hourlyRate = floatval($att['hourly_rate']);
            $totalPay = round($workHours * $hourlyRate);

            $upd = $pdo->prepare("UPDATE attendances SET check_out_time = :out_time, work_hours = :hours, total_pay = :pay, status = 'completed' WHERE id = :id");
            $upd->execute([
                ':out_time' => $now,
                ':hours' => $workHours,
                ':pay' => $totalPay,
                ':id' => $att['id']
            ]);
        }
    } catch (Exception $e) {
        error_log('Auto check-out error: ' . $e->getMessage());
    }
}

jsonResponse(['success' => false, 'message' => 'Hành động không hợp lệ!'], 400);
