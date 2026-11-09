<?php
/**
 * Categories API
 * CRUD Categories
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// 1. GET: List all categories
if ($method === 'GET' && empty($action)) {
    $stmt = $pdo->query("
        SELECT c.*, COUNT(p.id) as product_count 
        FROM categories c 
        LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
        WHERE c.status = 'active'
        GROUP BY c.id 
        ORDER BY c.sort_order ASC, c.id ASC
    ");
    $categories = $stmt->fetchAll();
    jsonResponse(['success' => true, 'data' => $categories]);
}

// Check admin for modifications
checkAuth('admin');

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

// 2. POST: Add Category
if ($method === 'POST' && (empty($action) || $action === 'add')) {
    $name = trim($input['name'] ?? '');
    $icon = trim($input['icon'] ?? 'coffee');
    $sortOrder = (int)($input['sort_order'] ?? 0);

    if (empty($name)) {
        jsonResponse(['success' => false, 'message' => 'Tên nhóm hàng không được để trống!'], 400);
    }

    $stmt = $pdo->prepare("INSERT INTO categories (name, icon, sort_order, status) VALUES (:name, :icon, :sort_order, 'active')");
    $stmt->execute([
        ':name' => $name,
        ':icon' => $icon,
        ':sort_order' => $sortOrder
    ]);

    jsonResponse(['success' => true, 'message' => 'Thêm nhóm hàng thành công!', 'id' => $pdo->lastInsertId()]);
}

// 3. POST / PUT: Update Category
if (($method === 'POST' || $method === 'PUT') && $action === 'update') {
    $id = (int)($input['id'] ?? 0);
    $name = trim($input['name'] ?? '');
    $icon = trim($input['icon'] ?? 'coffee');
    $sortOrder = (int)($input['sort_order'] ?? 0);

    if ($id <= 0 || empty($name)) {
        jsonResponse(['success' => false, 'message' => 'Dữ liệu cập nhật nhóm hàng không hợp lệ!'], 400);
    }

    $stmt = $pdo->prepare("UPDATE categories SET name = :name, icon = :icon, sort_order = :sort_order WHERE id = :id");
    $stmt->execute([
        ':name' => $name,
        ':icon' => $icon,
        ':sort_order' => $sortOrder,
        ':id' => $id
    ]);

    jsonResponse(['success' => true, 'message' => 'Cập nhật nhóm hàng thành công!']);
}

// 4. POST / DELETE: Delete Category
if (($method === 'POST' || $method === 'DELETE') && $action === 'delete') {
    $id = (int)($input['id'] ?? ($_GET['id'] ?? 0));

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Mã nhóm hàng không hợp lệ!'], 400);
    }

    // Check if there are active products
    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM products WHERE category_id = :id AND status = 'active'");
    $checkStmt->execute([':id' => $id]);
    if ($checkStmt->fetchColumn() > 0) {
        jsonResponse(['success' => false, 'message' => 'Không thể xóa nhóm hàng đang có món ăn/sản phẩm!'], 400);
    }

    $stmt = $pdo->prepare("DELETE FROM categories WHERE id = :id");
    $stmt->execute([':id' => $id]);

    jsonResponse(['success' => true, 'message' => 'Đã xóa nhóm hàng!']);
}

jsonResponse(['success' => false, 'message' => 'Yêu cầu không hợp lệ!'], 400);
