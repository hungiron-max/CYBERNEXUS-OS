<?php
/**
 * Products API
 * CRUD & Search Products
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// 1. GET: Fetch Products with filters
if ($method === 'GET' && empty($action)) {
    $categoryId = isset($_GET['category_id']) && is_numeric($_GET['category_id']) ? (int)$_GET['category_id'] : null;
    $search = trim($_GET['q'] ?? '');
    $isTopping = isset($_GET['is_topping']) ? (int)$_GET['is_topping'] : null;
    $status = trim($_GET['status'] ?? ''); // 'active', 'locked', or empty for all in admin

    $sql = "
        SELECT p.*, c.name as category_name 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1
    ";
    $params = [];

    if ($categoryId !== null && $categoryId > 0) {
        $sql .= " AND p.category_id = :category_id";
        $params[':category_id'] = $categoryId;
    }

    if (!empty($search)) {
        $sql .= " AND (p.name LIKE :search OR p.code LIKE :search)";
        $params[':search'] = '%' . $search . '%';
    }

    if ($isTopping !== null) {
        $sql .= " AND p.is_topping = :is_topping";
        $params[':is_topping'] = $isTopping;
    }

    if (!empty($status)) {
        $sql .= " AND p.status = :status";
        $params[':status'] = $status;
    }

    $sql .= " ORDER BY p.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll();

    jsonResponse(['success' => true, 'data' => $products]);
}

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

// 4. POST: Toggle Status (active <-> locked - Cho phép cả Admin, Bếp và Thu ngân thao tác để báo hết món)
if ($action === 'toggle_status') {
    checkAuth(['admin', 'kitchen', 'cashier']);

    $id = (int)($input['id'] ?? ($_GET['id'] ?? 0));
    $forceStatus = trim($input['status'] ?? ($_GET['status'] ?? ''));

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Mã mặt hàng không hợp lệ!'], 400);
    }

    $current = $pdo->prepare("SELECT * FROM products WHERE id = :id");
    $current->execute([':id' => $id]);
    $prod = $current->fetch();

    if (!$prod) {
        jsonResponse(['success' => false, 'message' => 'Mặt hàng không tồn tại!'], 404);
    }

    if (!empty($forceStatus) && in_array($forceStatus, ['active', 'locked'])) {
        $newStatus = $forceStatus;
    } else {
        $newStatus = ($prod['status'] === 'active') ? 'locked' : 'active';
    }

    $up = $pdo->prepare("UPDATE products SET status = :status WHERE id = :id");
    $up->execute([':status' => $newStatus, ':id' => $id]);

    $uName = $_SESSION['fullname'] ?? ($_SESSION['username'] ?? 'Nhân viên');
    $uRole = $_SESSION['user_role'] ?? 'kitchen';

    $isLocked = ($newStatus === 'locked');
    $notifTitle = $isLocked ? "TẠM KHÓA MÓN: {$prod['name']}" : "MỞ BÁN LẠI: {$prod['name']}";
    $notifMsg = $isLocked 
        ? "Món '{$prod['name']}' ({$prod['code']}) đã bị TẠM KHÓA trên thực đơn (Báo hết hàng bởi {$uName})."
        : "Món '{$prod['name']}' ({$prod['code']}) đã được MỞ BÁN LẠI trên thực đơn bởi {$uName}.";

    // Notify all staff (waiter, cashier, kitchen)
    $notifStmt = $pdo->prepare("
        INSERT INTO app_notifications (
            type, order_id, table_code, title, message, is_read_waiter, is_read_cashier, created_at
        ) VALUES (
            :type, 0, 'THỰC ĐƠN', :title, :message, 0, 0, :created_at
        )
    ");
    $notifStmt->execute([
        ':type' => $isLocked ? 'product_locked' : 'product_unlocked',
        ':title' => $notifTitle,
        ':message' => $notifMsg,
        ':created_at' => date('Y-m-d H:i:s')
    ]);

    // Log to kitchen_service_logs
    $logStmt = $pdo->prepare("
        INSERT INTO kitchen_service_logs (
            order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, note, created_at
        ) VALUES (
            0, 'MENU', 'THỰC ĐƠN', :action, :action_label, :user_id, :user_name, :user_role, :note, :created_at
        )
    ");
    $logStmt->execute([
        ':action' => $isLocked ? 'lock_product' : 'unlock_product',
        ':action_label' => $isLocked ? 'Tạm khóa món (Hết hàng)' : 'Mở bán lại món',
        ':user_id' => $_SESSION['user_id'] ?? 1,
        ':user_name' => $uName,
        ':user_role' => $uRole,
        ':note' => $notifMsg,
        ':created_at' => date('Y-m-d H:i:s')
    ]);

    jsonResponse([
        'success' => true,
        'message' => $isLocked ? "Đã tạm khóa món '{$prod['name']}' (Báo hết hàng)!" : "Đã mở bán lại món '{$prod['name']}'!",
        'product_id' => $id,
        'product_name' => $prod['name'],
        'status' => $newStatus
    ]);
}

// Full admin write actions (Add, Update, Delete) require Admin
checkAuth('admin');

// 2. POST: Add Product
if ($method === 'POST' && (empty($action) || $action === 'add')) {
    $code = trim($input['code'] ?? '');
    $name = trim($input['name'] ?? '');
    $categoryId = (int)($input['category_id'] ?? 0);
    $unit = trim($input['unit'] ?? 'ly');
    $costPrice = (float)($input['cost_price'] ?? 0);
    $salePrice = (float)($input['sale_price'] ?? 0);
    $isTopping = !empty($input['is_topping']) ? 1 : 0;
    $status = (!empty($input['status']) && in_array($input['status'], ['active', 'locked'])) ? $input['status'] : 'active';
    $description = trim($input['description'] ?? '');
    $image = trim($input['image'] ?? 'assets/images/dishes/default_dish.jpg');

    if (empty($name) || $categoryId <= 0 || $salePrice <= 0) {
        jsonResponse(['success' => false, 'message' => 'Vui lòng nhập đầy đủ tên món, nhóm hàng và giá bán hợp lệ!'], 400);
    }

    // Auto generate code if empty
    if (empty($code)) {
        $prefix = $isTopping ? 'TP' : 'SP';
        $maxId = (int)$pdo->query("SELECT MAX(id) FROM products")->fetchColumn();
        $code = $prefix . str_pad($maxId + 1, 3, '0', STR_PAD_LEFT);
    } else {
        // Check uniqueness
        $check = $pdo->prepare("SELECT id FROM products WHERE code = :code");
        $check->execute([':code' => $code]);
        if ($check->fetch()) {
            jsonResponse(['success' => false, 'message' => 'Mã mặt hàng đã tồn tại trên hệ thống!'], 400);
        }
    }

    $stmt = $pdo->prepare("
        INSERT INTO products (category_id, code, name, unit, cost_price, sale_price, image, is_topping, status, description)
        VALUES (:category_id, :code, :name, :unit, :cost_price, :sale_price, :image, :is_topping, :status, :description)
    ");
    $stmt->execute([
        ':category_id' => $categoryId,
        ':code' => $code,
        ':name' => $name,
        ':unit' => $unit,
        ':cost_price' => $costPrice,
        ':sale_price' => $salePrice,
        ':image' => $image,
        ':is_topping' => $isTopping,
        ':status' => $status,
        ':description' => $description
    ]);

    jsonResponse(['success' => true, 'message' => 'Thêm món ăn/hàng hóa thành công!', 'id' => $pdo->lastInsertId()]);
}

// 3. POST: Update Product
if (($method === 'POST' || $method === 'PUT') && $action === 'update') {
    $id = (int)($input['id'] ?? 0);
    $code = trim($input['code'] ?? '');
    $name = trim($input['name'] ?? '');
    $categoryId = (int)($input['category_id'] ?? 0);
    $unit = trim($input['unit'] ?? 'ly');
    $costPrice = (float)($input['cost_price'] ?? 0);
    $salePrice = (float)($input['sale_price'] ?? 0);
    $isTopping = !empty($input['is_topping']) ? 1 : 0;
    $status = (!empty($input['status']) && in_array($input['status'], ['active', 'locked'])) ? $input['status'] : 'active';
    $description = trim($input['description'] ?? '');
    $image = isset($input['image']) ? trim($input['image']) : null;

    if ($id <= 0 || empty($name) || $categoryId <= 0 || $salePrice <= 0) {
        jsonResponse(['success' => false, 'message' => 'Dữ liệu cập nhật không hợp lệ!'], 400);
    }

    // Check code collision
    if (!empty($code)) {
        $check = $pdo->prepare("SELECT id FROM products WHERE code = :code AND id != :id");
        $check->execute([':code' => $code, ':id' => $id]);
        if ($check->fetch()) {
            jsonResponse(['success' => false, 'message' => 'Mã hàng trùng với mặt hàng khác!'], 400);
        }
    }

    $sql = "
        UPDATE products 
        SET category_id = :category_id, code = :code, name = :name, unit = :unit,
            cost_price = :cost_price, sale_price = :sale_price, is_topping = :is_topping,
            status = :status, description = :description
    ";
    $params = [
        ':category_id' => $categoryId,
        ':code' => $code,
        ':name' => $name,
        ':unit' => $unit,
        ':cost_price' => $costPrice,
        ':sale_price' => $salePrice,
        ':is_topping' => $isTopping,
        ':status' => $status,
        ':description' => $description,
        ':id' => $id
    ];

    if ($image !== null) {
        $sql .= ", image = :image";
        $params[':image'] = $image;
    }

    $sql .= " WHERE id = :id";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    jsonResponse(['success' => true, 'message' => 'Cập nhật mặt hàng thành công!']);
}

// 5. POST: Delete Product
if (($method === 'POST' || $method === 'DELETE') && $action === 'delete') {
    $id = (int)($input['id'] ?? ($_GET['id'] ?? 0));
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Mã mặt hàng không hợp lệ!'], 400);
    }

    $stmt = $pdo->prepare("DELETE FROM products WHERE id = :id");
    $stmt->execute([':id' => $id]);

    jsonResponse(['success' => true, 'message' => 'Đã xóa mặt hàng thành công!']);
}

// 6. POST: Upload Dish Image
if ($action === 'upload_image') {
    $uploadDir = __DIR__ . '/../assets/images/dishes';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0777, true);
    }

    $savedPath = '';

    // Handle file upload
    if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
            $ext = 'jpg';
        }
        $filename = 'dish_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $dest = $uploadDir . '/' . $filename;
        if (move_uploaded_file($_FILES['image']['tmp_name'], $dest)) {
            $savedPath = 'assets/images/dishes/' . $filename;
        }
    } 
    // Handle base64 upload
    elseif (!empty($input['image_base64'])) {
        $data = $input['image_base64'];
        if (preg_match('/^data:image\/(\w+);base64,/', $data, $type)) {
            $data = substr($data, strpos($data, ',') + 1);
            $ext = strtolower($type[1]);
            if ($ext === 'jpeg') $ext = 'jpg';
            if (!in_array($ext, ['jpg', 'png', 'webp'])) $ext = 'jpg';
            $data = base64_decode($data);
            if ($data !== false) {
                $filename = 'dish_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                file_put_contents($uploadDir . '/' . $filename, $data);
                $savedPath = 'assets/images/dishes/' . $filename;
            }
        }
    }

    if (!empty($savedPath)) {
        $productId = (int)($input['product_id'] ?? $_POST['product_id'] ?? 0);
        if ($productId > 0) {
            $up = $pdo->prepare("UPDATE products SET image = :img WHERE id = :id");
            $up->execute([':img' => $savedPath, ':id' => $productId]);
        }
        jsonResponse(['success' => true, 'image_url' => $savedPath, 'message' => 'Tải ảnh món ăn thành công!']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Không thể lưu hình ảnh, vui lòng kiểm tra lại file!'], 400);
    }
}

// 7. POST: AI Auto Generate / Match Dish Image
if ($action === 'ai_generate_dish_image') {
    $dishName = trim($input['name'] ?? '');
    $dishId = (int)($input['id'] ?? 0);
    $categoryName = trim($input['category_name'] ?? '');

    if (empty($dishName) && $dishId > 0) {
        $st = $pdo->prepare("SELECT p.name, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = :id");
        $st->execute([':id' => $dishId]);
        $row = $st->fetch();
        if ($row) {
            $dishName = $row['name'];
            $categoryName = $row['category_name'] ?? '';
        }
    }

    if (empty($dishName)) {
        jsonResponse(['success' => false, 'message' => 'Vui lòng cung cấp tên món ăn để AI xử lý hình ảnh!'], 400);
    }

    // Smart culinary pattern matching with curated high-res food library
    $nameLower = mb_strtolower($dishName, 'UTF-8');
    $catLower = mb_strtolower($categoryName, 'UTF-8');

    // Default image if nothing matched
    $matchedUrl = 'assets/images/dishes/bm001_banh_mi.jpg';

    if (strpos($nameLower, 'bánh mì chảo') !== false || strpos($nameLower, 'chảo') !== false) {
        $matchedUrl = 'assets/images/dishes/bm002_banh_mi_chao.jpg';
    } elseif (strpos($nameLower, 'bánh mì') !== false) {
        $matchedUrl = 'assets/images/dishes/bm001_banh_mi.jpg';
    } elseif (strpos($nameLower, 'mì gói bò') !== false || (strpos($nameLower, 'mì gói') !== false && strpos($nameLower, 'bò') !== false)) {
        $matchedUrl = 'assets/images/dishes/bm005_mi_goi_bo.jpg';
    } elseif (strpos($nameLower, 'mì xào') !== false) {
        $matchedUrl = 'assets/images/dishes/bm007.jpg';
    } elseif (strpos($nameLower, 'mì gói') !== false) {
        $matchedUrl = 'assets/images/dishes/bm006.jpg';
    } elseif (strpos($nameLower, 'bít tết') !== false || strpos($nameLower, 'bò') !== false && strpos($catLower, 'bít tết') !== false) {
        $matchedUrl = 'assets/images/dishes/bt001.jpg';
    } elseif (strpos($nameLower, 'flan') !== false) {
        $matchedUrl = 'assets/images/dishes/fl001.jpg';
    } elseif (strpos($nameLower, 'đen đá') !== false || strpos($nameLower, 'cafe đen') !== false) {
        $matchedUrl = 'assets/images/dishes/cf001.jpg';
    } elseif (strpos($nameLower, 'sữa đá') !== false || strpos($nameLower, 'cafe sữa') !== false) {
        $matchedUrl = 'assets/images/dishes/cf002.jpg';
    } elseif (strpos($nameLower, 'bạc xỉu') !== false) {
        $matchedUrl = 'assets/images/dishes/cf003.jpg';
    } elseif (strpos($nameLower, 'trà nóng') !== false || strpos($nameLower, 'ấm trà') !== false) {
        $matchedUrl = 'assets/images/dishes/cf004.jpg';
    } elseif (strpos($nameLower, 'thái xanh') !== false) {
        $matchedUrl = 'assets/images/dishes/ts002.jpg';
    } elseif (strpos($nameLower, 'khoai môn') !== false) {
        $matchedUrl = 'assets/images/dishes/ts003.jpg';
    } elseif (strpos($nameLower, 'oolong') !== false || strpos($nameLower, 'ô long') !== false) {
        $matchedUrl = 'assets/images/dishes/ts004.jpg';
    } elseif (strpos($nameLower, 'trà sữa') !== false) {
        $matchedUrl = 'assets/images/dishes/ts001.jpg';
    } elseif (strpos($nameLower, 'đào') !== false) {
        $matchedUrl = 'assets/images/dishes/tc001.jpg';
    } elseif (strpos($nameLower, 'vải') !== false) {
        $matchedUrl = 'assets/images/dishes/tc002.jpg';
    } elseif (strpos($nameLower, 'ổi') !== false) {
        $matchedUrl = 'assets/images/dishes/tc003.jpg';
    } elseif (strpos($nameLower, 'coca') !== false) {
        $matchedUrl = 'assets/images/dishes/nn001.jpg';
    } elseif (strpos($nameLower, '7up') !== false || strpos($nameLower, 'sprite') !== false) {
        $matchedUrl = 'assets/images/dishes/nn002.jpg';
    } elseif (strpos($nameLower, 'bò cụng') !== false || strpos($nameLower, 'redbull') !== false) {
        $matchedUrl = 'assets/images/dishes/nn003.jpg';
    } elseif (strpos($nameLower, 'không độ') !== false || strpos($nameLower, 'c2') !== false) {
        $matchedUrl = 'assets/images/dishes/nn004.jpg';
    } elseif (strpos($nameLower, 'bơ') !== false) {
        $matchedUrl = 'assets/images/dishes/st001.jpg';
    } elseif (strpos($nameLower, 'mãng cầu') !== false) {
        $matchedUrl = 'assets/images/dishes/st002.jpg';
    } elseif (strpos($nameLower, 'matcha') !== false) {
        $matchedUrl = 'assets/images/dishes/dx001.jpg';
    } elseif (strpos($nameLower, 'cookie') !== false || strpos($nameLower, 'socola') !== false) {
        $matchedUrl = 'assets/images/dishes/dx002.jpg';
    } elseif (strpos($nameLower, 'trân châu') !== false) {
        $matchedUrl = 'assets/images/dishes/tp001.jpg';
    } elseif (strpos($nameLower, 'khúc bạch') !== false) {
        $matchedUrl = 'assets/images/dishes/tp003.jpg';
    } elseif (strpos($nameLower, 'kem cheese') !== false || strpos($nameLower, 'macchiato') !== false) {
        $matchedUrl = 'assets/images/dishes/tp004.jpg';
    } elseif (strpos($nameLower, 'củ năng') !== false) {
        $matchedUrl = 'assets/images/dishes/tp005.jpg';
    } elseif (strpos($nameLower, 'trứng') !== false) {
        $matchedUrl = 'assets/images/dishes/bm011.jpg';
    } elseif (strpos($nameLower, 'xúc xích') !== false) {
        $matchedUrl = 'assets/images/dishes/bm012.jpg';
    } elseif (strpos($nameLower, 'pate') !== false) {
        $matchedUrl = 'assets/images/dishes/bm009.jpg';
    } elseif (strpos($nameLower, 'rau') !== false) {
        $matchedUrl = 'assets/images/dishes/bm010.jpg';
    }

    if ($dishId > 0) {
        $up = $pdo->prepare("UPDATE products SET image = :img WHERE id = :id");
        $up->execute([':img' => $matchedUrl, ':id' => $dishId]);
    }

    jsonResponse([
        'success' => true,
        'image_url' => $matchedUrl,
        'message' => "AI đã xử lý và chọn ảnh món '{$dishName}' thành công!"
    ]);
}

// 8. POST: Batch AI Auto Assign Images for All Menu Dishes
if ($action === 'ai_batch_assign_images') {
    $st = $pdo->query("SELECT p.id, p.code, p.name, p.image, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id");
    $all = $st->fetchAll();

    $updated = 0;
    foreach ($all as $dish) {
        $nameLower = mb_strtolower($dish['name'], 'UTF-8');
        $catLower = mb_strtolower($dish['category_name'] ?? '', 'UTF-8');
        $img = 'assets/images/dishes/default_dish.jpg';

        if (strpos($nameLower, 'bánh mì chảo') !== false) $img = 'assets/images/dishes/bm002_banh_mi_chao.jpg';
        elseif (strpos($nameLower, 'bánh mì') !== false) $img = 'assets/images/dishes/bm001_banh_mi.jpg';
        elseif (strpos($nameLower, 'mì gói bò') !== false) $img = 'assets/images/dishes/bm005_mi_goi_bo.jpg';
        elseif (strpos($nameLower, 'mì xào') !== false) $img = 'assets/images/dishes/bm007.jpg';
        elseif (strpos($nameLower, 'mì gói') !== false) $img = 'assets/images/dishes/bm006.jpg';
        elseif (strpos($nameLower, 'bít tết') !== false || strpos($catLower, 'bít tết') !== false) $img = 'assets/images/dishes/bt001.jpg';
        elseif (strpos($nameLower, 'flan') !== false) $img = 'assets/images/dishes/fl001.jpg';
        elseif (strpos($nameLower, 'đen đá') !== false) $img = 'assets/images/dishes/cf001.jpg';
        elseif (strpos($nameLower, 'sữa đá') !== false) $img = 'assets/images/dishes/cf002.jpg';
        elseif (strpos($nameLower, 'bạc xỉu') !== false) $img = 'assets/images/dishes/cf003.jpg';
        elseif (strpos($nameLower, 'trà nóng') !== false) $img = 'assets/images/dishes/cf004.jpg';
        elseif (strpos($nameLower, 'thái xanh') !== false) $img = 'assets/images/dishes/ts002.jpg';
        elseif (strpos($nameLower, 'khoai môn') !== false) $img = 'assets/images/dishes/ts003.jpg';
        elseif (strpos($nameLower, 'oolong') !== false) $img = 'assets/images/dishes/ts004.jpg';
        elseif (strpos($nameLower, 'trà sữa') !== false) $img = 'assets/images/dishes/ts001.jpg';
        elseif (strpos($nameLower, 'đào') !== false) $img = 'assets/images/dishes/tc001.jpg';
        elseif (strpos($nameLower, 'vải') !== false) $img = 'assets/images/dishes/tc002.jpg';
        elseif (strpos($nameLower, 'ổi') !== false) $img = 'assets/images/dishes/tc003.jpg';
        elseif (strpos($nameLower, 'coca') !== false) $img = 'assets/images/dishes/nn001.jpg';
        elseif (strpos($nameLower, '7up') !== false) $img = 'assets/images/dishes/nn002.jpg';
        elseif (strpos($nameLower, 'bò cụng') !== false) $img = 'assets/images/dishes/nn003.jpg';
        elseif (strpos($nameLower, 'không độ') !== false || strpos($nameLower, 'c2') !== false) $img = 'assets/images/dishes/nn004.jpg';
        elseif (strpos($nameLower, 'bơ') !== false) $img = 'assets/images/dishes/st001.jpg';
        elseif (strpos($nameLower, 'mãng cầu') !== false) $img = 'assets/images/dishes/st002.jpg';
        elseif (strpos($nameLower, 'matcha') !== false) $img = 'assets/images/dishes/dx001.jpg';
        elseif (strpos($nameLower, 'cookie') !== false) $img = 'assets/images/dishes/dx002.jpg';
        elseif (strpos($nameLower, 'trân châu') !== false) $img = 'assets/images/dishes/tp001.jpg';
        elseif (strpos($nameLower, 'khúc bạch') !== false) $img = 'assets/images/dishes/tp003.jpg';
        elseif (strpos($nameLower, 'kem cheese') !== false) $img = 'assets/images/dishes/tp004.jpg';
        elseif (strpos($nameLower, 'củ năng') !== false) $img = 'assets/images/dishes/tp005.jpg';
        elseif (strpos($nameLower, 'trứng') !== false) $img = 'assets/images/dishes/bm011.jpg';
        elseif (strpos($nameLower, 'xúc xích') !== false) $img = 'assets/images/dishes/bm012.jpg';
        elseif (strpos($nameLower, 'pate') !== false) $img = 'assets/images/dishes/bm009.jpg';
        elseif (strpos($nameLower, 'rau') !== false) $img = 'assets/images/dishes/bm010.jpg';
        elseif (!empty($dish['code']) && file_exists(__DIR__ . '/../assets/images/dishes/' . strtolower($dish['code']) . '.jpg')) {
            $img = 'assets/images/dishes/' . strtolower($dish['code']) . '.jpg';
        }

        $up = $pdo->prepare("UPDATE products SET image = :img WHERE id = :id");
        $up->execute([':img' => $img, ':id' => $dish['id']]);
        $updated++;
    }

    jsonResponse([
        'success' => true,
        'message' => "AI đã tự động xử lý và cập nhật hình ảnh thành công cho toàn bộ {$updated} món ăn!"
    ]);
}

jsonResponse(['success' => false, 'message' => 'Yêu cầu không hợp lệ!'], 400);
