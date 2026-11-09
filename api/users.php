<?php
/**
 * Users & Staff Management API
 * CRUD users, assign roles (Admin, Cashier, Waiter, Kitchen), reset passwords/PIN
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// Write actions require Admin
checkAuth('admin');

// Helper to generate next user_code by role
function generateNextUserCode(PDO $pdo, string $role): string {
    $prefixMap = [
        'admin' => 'ADM',
        'cashier' => 'ACC',
        'waiter' => 'STF',
        'kitchen' => 'KIT',
        'customer' => 'USR'
    ];
    $prefix = $prefixMap[$role] ?? 'STF';

    $stmt = $pdo->prepare("SELECT user_code FROM users WHERE user_code LIKE :prefix ORDER BY id DESC");
    $stmt->execute([':prefix' => $prefix . '%']);
    $codes = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $maxNum = 0;
    foreach ($codes as $c) {
        if (preg_match('/^' . $prefix . '(\d+)$/i', $c, $m)) {
            $num = (int)$m[1];
            if ($num > $maxNum) $maxNum = $num;
        }
    }
    return sprintf("%s%03d", $prefix, $maxNum + 1);
}

// 1. GET: List all staff & users
if ($method === 'GET' && empty($action)) {
    $stmt = $pdo->query("
        SELECT id, user_code, username, fullname, role, phone, pin_code, status, created_at 
        FROM users 
        ORDER BY id ASC
    ");
    $users = $stmt->fetchAll();
    jsonResponse(['success' => true, 'data' => $users]);
}

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

// 2. POST: Add User / Employee
if ($method === 'POST' && (empty($action) || $action === 'add')) {
    $userCode = strtoupper(trim($input['user_code'] ?? ''));
    $username = trim($input['username'] ?? '');
    $fullname = trim($input['fullname'] ?? '');
    $role = trim($input['role'] ?? 'waiter');
    $phone = trim($input['phone'] ?? '');
    $pinCode = trim($input['pin_code'] ?? '');
    $password = trim($input['password'] ?? '');

    $allowedRoles = ['admin', 'cashier', 'waiter', 'kitchen', 'customer'];
    if (!in_array($role, $allowedRoles)) {
        $role = 'waiter';
    }

    if (empty($username) || empty($fullname)) {
        jsonResponse(['success' => false, 'message' => 'Vui lòng nhập tên tài khoản và họ tên!'], 400);
    }

    // Auto generate user code if empty
    if (empty($userCode)) {
        $userCode = generateNextUserCode($pdo, $role);
    } else {
        // Check user_code duplicate
        $chkCode = $pdo->prepare("SELECT id FROM users WHERE UPPER(user_code) = UPPER(:user_code)");
        $chkCode->execute([':user_code' => $userCode]);
        if ($chkCode->fetch()) {
            jsonResponse(['success' => false, 'message' => "Mã người dùng [{$userCode}] đã tồn tại!"], 400);
        }
    }

    // Check username duplicate
    $check = $pdo->prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(:username)");
    $check->execute([':username' => $username]);
    if ($check->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Tên tài khoản này đã tồn tại!'], 400);
    }

    // Default password '123456' if empty
    $hashedPassword = password_hash(!empty($password) ? $password : '123456', PASSWORD_BCRYPT);
    
    // Default PIN if empty
    if (empty($pinCode)) {
        $pinCode = str_pad(rand(1000, 9999), 4, '0', STR_PAD_LEFT);
    }

    $stmt = $pdo->prepare("
        INSERT INTO users (user_code, username, fullname, role, phone, pin_code, password, status)
        VALUES (:user_code, :username, :fullname, :role, :phone, :pin_code, :password, 'active')
    ");
    $stmt->execute([
        ':user_code' => $userCode,
        ':username' => $username,
        ':fullname' => $fullname,
        ':role' => $role,
        ':phone' => $phone,
        ':pin_code' => $pinCode,
        ':password' => $hashedPassword
    ]);

    jsonResponse([
        'success' => true,
        'message' => "Thêm người dùng {$fullname} ({$userCode}) thành công!",
        'id' => $pdo->lastInsertId(),
        'user_code' => $userCode
    ]);
}

// 3. POST: Update User Info
if (($method === 'POST' || $method === 'PUT') && $action === 'update') {
    $id = (int)($input['id'] ?? 0);
    $userCode = strtoupper(trim($input['user_code'] ?? ''));
    $fullname = trim($input['fullname'] ?? '');
    $role = trim($input['role'] ?? 'waiter');
    $phone = trim($input['phone'] ?? '');
    $pinCode = trim($input['pin_code'] ?? '');
    $status = trim($input['status'] ?? 'active');

    if ($id <= 0 || empty($fullname)) {
        jsonResponse(['success' => false, 'message' => 'Thông tin cập nhật không hợp lệ!'], 400);
    }

    $allowedRoles = ['admin', 'cashier', 'waiter', 'kitchen', 'customer'];
    if (!in_array($role, $allowedRoles)) {
        $role = 'waiter';
    }

    // Check user_code uniqueness if changed
    if (!empty($userCode)) {
        $chkCode = $pdo->prepare("SELECT id FROM users WHERE UPPER(user_code) = UPPER(:user_code) AND id != :id");
        $chkCode->execute([':user_code' => $userCode, ':id' => $id]);
        if ($chkCode->fetch()) {
            jsonResponse(['success' => false, 'message' => "Mã người dùng [{$userCode}] đã được tài khoản khác sử dụng!"], 400);
        }
    } else {
        $userCode = generateNextUserCode($pdo, $role);
    }

    $stmt = $pdo->prepare("
        UPDATE users 
        SET user_code = :user_code, fullname = :fullname, role = :role, phone = :phone, pin_code = :pin_code, status = :status
        WHERE id = :id
    ");
    $stmt->execute([
        ':user_code' => $userCode,
        ':fullname' => $fullname,
        ':role' => $role,
        ':phone' => $phone,
        ':pin_code' => $pinCode,
        ':status' => $status,
        ':id' => $id
    ]);

    jsonResponse(['success' => true, 'message' => 'Cập nhật thông tin người dùng thành công!']);
}

// 4. POST: Reset Password or PIN
if ($action === 'reset_password') {
    $id = (int)($input['id'] ?? 0);
    $newPassword = trim($input['new_password'] ?? '');
    $newPin = trim($input['new_pin'] ?? '');

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Mã nhân viên không hợp lệ!'], 400);
    }

    $params = [':id' => $id];
    $sqlSets = [];

    if (!empty($newPassword)) {
        $sqlSets[] = "password = :password";
        $params[':password'] = password_hash($newPassword, PASSWORD_BCRYPT);
    }

    if (!empty($newPin)) {
        $sqlSets[] = "pin_code = :pin_code";
        $params[':pin_code'] = $newPin;
    }

    if (empty($sqlSets)) {
        jsonResponse(['success' => false, 'message' => 'Vui lòng nhập mật khẩu mới hoặc mã PIN mới!'], 400);
    }

    $sql = "UPDATE users SET " . implode(', ', $sqlSets) . " WHERE id = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    jsonResponse(['success' => true, 'message' => 'Đổi mật khẩu / mã PIN thành công!']);
}

// 5. POST: Toggle Status
if ($action === 'toggle_status') {
    $id = (int)($input['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Mã nhân viên không hợp lệ!'], 400);
    }

    if ($id === (int)$_SESSION['user_id']) {
        jsonResponse(['success' => false, 'message' => 'Bạn không thể khóa tài khoản của chính mình!'], 400);
    }

    $current = $pdo->prepare("SELECT status FROM users WHERE id = :id");
    $current->execute([':id' => $id]);
    $currStatus = $current->fetchColumn();

    $newStatus = ($currStatus === 'active') ? 'locked' : 'active';
    $stmt = $pdo->prepare("UPDATE users SET status = :status WHERE id = :id");
    $stmt->execute([':status' => $newStatus, ':id' => $id]);

    jsonResponse(['success' => true, 'message' => 'Đã thay đổi trạng thái nhân viên!', 'status' => $newStatus]);
}

// 6. POST: Delete User
if (($method === 'POST' || $method === 'DELETE') && $action === 'delete') {
    $id = (int)($input['id'] ?? ($_GET['id'] ?? 0));
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Mã nhân viên không hợp lệ!'], 400);
    }

    if ($id === (int)$_SESSION['user_id']) {
        jsonResponse(['success' => false, 'message' => 'Không thể tự xóa tài khoản đang đăng nhập!'], 400);
    }

    // Check if last admin
    $userStmt = $pdo->prepare("SELECT role FROM users WHERE id = :id");
    $userStmt->execute([':id' => $id]);
    $role = $userStmt->fetchColumn();

    if ($role === 'admin') {
        $adminCount = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'")->fetchColumn();
        if ($adminCount <= 1) {
            jsonResponse(['success' => false, 'message' => 'Hệ thống phải có ít nhất 1 tài khoản Quản trị (Admin)!'], 400);
        }
    }

    $del = $pdo->prepare("DELETE FROM users WHERE id = :id");
    $del->execute([':id' => $id]);

    jsonResponse(['success' => true, 'message' => 'Đã xóa nhân viên thành công!']);
}

jsonResponse(['success' => false, 'message' => 'Hành động không hợp lệ!'], 400);

