<?php
/**
 * Operations API: Inventory, Material Costs, Payroll & Realtime Attendance
 * Restricted strictly to Administrator
 */
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

// Auto recover session from persistent cookie if needed
if (empty($_SESSION['user_id']) && !empty($_COOKIE['pos_auth_user_id'])) {
    $savedId = intval($_COOKIE['pos_auth_user_id']);
    if ($savedId > 0) {
        $stmt = Database::getConnection()->prepare("SELECT * FROM users WHERE id = :id AND status = 'active' LIMIT 1");
        $stmt->execute([':id' => $savedId]);
        $u = $stmt->fetch();
        if ($u) {
            $_SESSION['user_id'] = $u['id'];
            $_SESSION['user_code'] = $u['user_code'] ?? '';
            $_SESSION['username'] = $u['username'];
            $_SESSION['fullname'] = $u['fullname'];
            $_SESSION['user_role'] = $u['role'];
        }
    }
}

// Strict role check: Only admin
checkAuth('admin');

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? 'summary');

// ========================================================
// 1. KHO & NGUYÊN VẬT LIỆU
// ========================================================

// 1.1 Danh sách nguyên vật liệu & tổng quan kho
if ($action === 'get_materials') {
    $search = trim($_GET['search'] ?? '');
    $category = trim($_GET['category'] ?? '');

    $sql = "SELECT * FROM materials WHERE status = 'active'";
    $params = [];

    if ($search !== '') {
        $sql .= " AND (name LIKE :search OR code LIKE :search OR supplier LIKE :search)";
        $params[':search'] = "%$search%";
    }
    if ($category !== '' && $category !== 'all') {
        $sql .= " AND category = :cat";
        $params[':cat'] = $category;
    }
    $sql .= " ORDER BY (quantity <= min_quantity) DESC, category ASC, name ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $materials = $stmt->fetchAll();

    // Thống kê nhanh
    $totalStockValue = 0;
    $lowStockCount = 0;
    $totalItems = count($materials);

    foreach ($materials as &$m) {
        $m['quantity'] = floatval($m['quantity']);
        $m['min_quantity'] = floatval($m['min_quantity']);
        $m['cost_price'] = floatval($m['cost_price']);
        $m['stock_value'] = $m['quantity'] * $m['cost_price'];
        $m['is_low'] = $m['quantity'] <= $m['min_quantity'];
        
        $totalStockValue += $m['stock_value'];
        if ($m['is_low']) {
            $lowStockCount++;
        }
    }

    // Danh sách categories
    $cats = $pdo->query("SELECT DISTINCT category FROM materials WHERE category IS NOT NULL AND category != '' ORDER BY category ASC")->fetchAll(PDO::FETCH_COLUMN);

    jsonResponse([
        'success' => true,
        'materials' => $materials,
        'summary' => [
            'total_items' => $totalItems,
            'total_stock_value' => $totalStockValue,
            'low_stock_count' => $lowStockCount
        ],
        'categories' => $cats
    ]);
}

// 1.2 Thêm / Sửa nguyên vật liệu
if ($action === 'save_material' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $id = intval($input['id'] ?? 0);
    $code = trim($input['code'] ?? '');
    $name = trim($input['name'] ?? '');
    $category = trim($input['category'] ?? 'Nguyên liệu');
    $unit = trim($input['unit'] ?? 'kg');
    $quantity = floatval($input['quantity'] ?? 0);
    $minQuantity = floatval($input['min_quantity'] ?? 5);
    $costPrice = floatval($input['cost_price'] ?? 0);
    $supplier = trim($input['supplier'] ?? '');
    $note = trim($input['note'] ?? '');

    if (empty($name)) {
        jsonResponse(['success' => false, 'message' => 'Vui lòng nhập tên nguyên vật liệu!'], 400);
    }

    if (empty($code)) {
        // Tự sinh mã
        $maxId = $pdo->query("SELECT MAX(id) FROM materials")->fetchColumn() ?: 0;
        $code = 'NVL' . str_pad($maxId + 1, 3, '0', STR_PAD_LEFT);
    }

    if ($id > 0) {
        $stmt = $pdo->prepare("UPDATE materials SET code = :code, name = :name, category = :cat, unit = :unit, min_quantity = :min_q, cost_price = :cost, supplier = :sup, note = :note, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
        $stmt->execute([
            ':code' => $code,
            ':name' => $name,
            ':cat' => $category,
            ':unit' => $unit,
            ':min_q' => $minQuantity,
            ':cost' => $costPrice,
            ':sup' => $supplier,
            ':note' => $note,
            ':id' => $id
        ]);
        jsonResponse(['success' => true, 'message' => 'Cập nhật nguyên vật liệu thành công!']);
    } else {
        $stmt = $pdo->prepare("INSERT INTO materials (code, name, category, unit, quantity, min_quantity, cost_price, supplier, note) VALUES (:code, :name, :cat, :unit, :qty, :min_q, :cost, :sup, :note)");
        $stmt->execute([
            ':code' => $code,
            ':name' => $name,
            ':cat' => $category,
            ':unit' => $unit,
            ':qty' => $quantity,
            ':min_q' => $minQuantity,
            ':cost' => $costPrice,
            ':sup' => $supplier,
            ':note' => $note
        ]);
        jsonResponse(['success' => true, 'message' => 'Thêm nguyên vật liệu mới thành công!']);
    }
}

// 1.3 Xóa nguyên vật liệu
if ($action === 'delete_material' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $id = intval($input['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID không hợp lệ!'], 400);
    }
    $stmt = $pdo->prepare("UPDATE materials SET status = 'inactive' WHERE id = :id");
    $stmt->execute([':id' => $id]);
    jsonResponse(['success' => true, 'message' => 'Đã xóa nguyên vật liệu khỏi danh sách hoạt động!']);
}

// 1.4 Nhập kho / Xuất kho / Ghi nhận chi phí vật liệu
if ($action === 'create_material_transaction' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $materialId = intval($input['material_id'] ?? 0);
    $transType = trim($input['trans_type'] ?? 'import'); // 'import', 'export', 'adjustment'
    $quantity = floatval($input['quantity'] ?? 0);
    $unitPrice = floatval($input['unit_price'] ?? 0);
    $supplier = trim($input['supplier'] ?? '');
    $note = trim($input['note'] ?? '');

    if ($materialId <= 0 || $quantity <= 0) {
        jsonResponse(['success' => false, 'message' => 'Vui lòng chọn vật liệu và số lượng hợp lệ (> 0)!'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM materials WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $materialId]);
    $material = $stmt->fetch();
    if (!$material) {
        jsonResponse(['success' => false, 'message' => 'Không tìm thấy nguyên vật liệu!'], 404);
    }

    $totalCost = ($transType === 'import') ? round($quantity * $unitPrice) : 0;
    $transPrefix = ($transType === 'import') ? 'PNK' : (($transType === 'export') ? 'PXK' : 'PDC');
    $transCode = $transPrefix . '-' . date('Ymd-His') . '-' . rand(10, 99);

    $currentStock = floatval($material['quantity']);
    $newStock = $currentStock;

    if ($transType === 'import') {
        $newStock = $currentStock + $quantity;
    } elseif ($transType === 'export') {
        if ($currentStock < $quantity) {
            jsonResponse(['success' => false, 'message' => "Số lượng xuất ($quantity {$material['unit']}) vượt quá tồn kho hiện tại ($currentStock {$material['unit']})!"], 400);
        }
        $newStock = $currentStock - $quantity;
    } elseif ($transType === 'adjustment') {
        $newStock = $quantity; // Cân chỉnh lại chính xác số lượng thực tế
    }

    $pdo->beginTransaction();
    try {
        // 1. Ghi nhật ký giao dịch
        $ins = $pdo->prepare("INSERT INTO material_transactions (trans_code, material_id, material_name, trans_type, quantity, unit, unit_price, total_cost, supplier, user_id, user_name, note) VALUES (:tcode, :mid, :mname, :ttype, :qty, :unit, :price, :cost, :sup, :uid, :uname, :note)");
        $ins->execute([
            ':tcode' => $transCode,
            ':mid' => $materialId,
            ':mname' => $material['name'],
            ':ttype' => $transType,
            ':qty' => $quantity,
            ':unit' => $material['unit'],
            ':price' => $unitPrice,
            ':cost' => $totalCost,
            ':sup' => $supplier ?: ($material['supplier'] ?? ''),
            ':uid' => $_SESSION['user_id'] ?? 1,
            ':uname' => $_SESSION['fullname'] ?? 'Admin',
            ':note' => $note
        ]);

        // 2. Cập nhật tồn kho & giá vốn mới nếu là nhập kho
        if ($transType === 'import' && $unitPrice > 0) {
            $upd = $pdo->prepare("UPDATE materials SET quantity = :nstock, cost_price = :cprice, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
            $upd->execute([':nstock' => $newStock, ':cprice' => $unitPrice, ':id' => $materialId]);
        } else {
            $upd = $pdo->prepare("UPDATE materials SET quantity = :nstock, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
            $upd->execute([':nstock' => $newStock, ':id' => $materialId]);
        }

        $pdo->commit();

        $actionText = ($transType === 'import') ? 'Nhập kho & ghi nhận chi phí' : (($transType === 'export') ? 'Xuất kho sử dụng' : 'Điều chỉnh tồn kho');
        jsonResponse([
            'success' => true,
            'message' => "Đã thực hiện $actionText thành công! Tồn kho mới: $newStock {$material['unit']}.",
            'trans_code' => $transCode,
            'new_stock' => $newStock
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Lỗi lưu phiếu kho: ' . $e->getMessage()], 500);
    }
}

// 1.4.1 Phân tích hóa đơn mua hàng / Giấy viết tay bằng Trí Tuệ Nhân Tạo (AI OCR & Intelligent Parser)
if ($action === 'ai_parse_invoice' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $rawBase64 = $input['image_base64'] ?? '';
    $userApiKey = trim($input['gemini_api_key'] ?? '');
    $clientOcrText = trim($input['ocr_text'] ?? '');
    $savedRelativePath = '';
    $imageBytes = '';
    $mimeType = 'image/jpeg';

    // 1. Xử lý nhận hình ảnh (Base64 hoặc multipart upload)
    if (!empty($_FILES['invoice_image']['tmp_name'])) {
        $tmp = $_FILES['invoice_image']['tmp_name'];
        $ext = strtolower(pathinfo($_FILES['invoice_image']['name'], PATHINFO_EXTENSION)) ?: 'jpg';
        $filename = 'inv_' . date('Ymd_His') . '_' . rand(100, 999) . '.' . $ext;
        $uploadDir = dirname(__DIR__) . '/uploads/invoices';
        if (!is_dir($uploadDir)) {
            @mkdir($uploadDir, 0777, true);
        }
        $dest = $uploadDir . '/' . $filename;
        if (move_uploaded_file($tmp, $dest)) {
            $savedRelativePath = 'uploads/invoices/' . $filename;
            $imageBytes = file_get_contents($dest);
            $mimeType = mime_content_type($dest) ?: 'image/jpeg';
        }
    } elseif (!empty($rawBase64)) {
        if (preg_match('/^data:(image\/[a-zA-Z0-9\-\.]+);base64,(.+)$/', $rawBase64, $bm)) {
            $mimeType = $bm[1];
            $imageBytes = base64_decode($bm[2]);
        } else {
            $imageBytes = base64_decode($rawBase64);
        }
        if ($imageBytes) {
            $ext = ($mimeType === 'image/png') ? 'png' : (($mimeType === 'image/webp') ? 'webp' : 'jpg');
            $filename = 'inv_' . date('Ymd_His') . '_' . rand(100, 999) . '.' . $ext;
            $uploadDir = dirname(__DIR__) . '/uploads/invoices';
            if (!is_dir($uploadDir)) {
                @mkdir($uploadDir, 0777, true);
            }
            $dest = $uploadDir . '/' . $filename;
            file_put_contents($dest, $imageBytes);
            $savedRelativePath = 'uploads/invoices/' . $filename;
        }
    }

    // 2. Tìm API Key Gemini (ưu tiên: người dùng truyền lên > store_settings > getenv)
    $geminiKey = $userApiKey;
    if (!empty($userApiKey)) {
        try {
            // Tự động lưu API Key vào store_settings để các lần sau không cần nhập lại
            $stKey = $pdo->prepare("INSERT INTO store_settings (setting_key, setting_value) VALUES ('gemini_api_key', :k) ON CONFLICT(setting_key) DO UPDATE SET setting_value = :k");
            $stKey->execute([':k' => $userApiKey]);
        } catch (Exception $e) {}
    } else {
        try {
            $stmt = $pdo->query("SELECT setting_value FROM store_settings WHERE setting_key = 'gemini_api_key' LIMIT 1");
            $geminiKey = $stmt ? trim($stmt->fetchColumn() ?: '') : '';
        } catch (Exception $e) {
            $geminiKey = '';
        }
    }
    if (empty($geminiKey)) {
        $geminiKey = getenv('GEMINI_API_KEY') ?: (defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '');
    }

    $parsedData = null;
    $aiEngine = 'Google Gemini AI (Vision)';
    $geminiError = '';
    $isSampleDemo = !empty($input['is_sample_demo']);

    // 3. Nếu người dùng chọn thử nghiệm bằng hóa đơn mẫu
    if ($isSampleDemo) {
        $parsedData = getSampleDemoInvoice();
        $aiEngine = 'Dữ liệu Hóa đơn Mẫu F&B';
    } 
    // 4. Nếu là ảnh thật -> Ưu tiên gọi Google Gemini Vision AI
    elseif (!empty($geminiKey) && !empty($imageBytes)) {
        $usedModelName = 'gemini-3.5-flash';
        $geminiResult = callGeminiVisionAPI($geminiKey, $mimeType, base64_encode($imageBytes), $geminiError, $usedModelName);
        if ($geminiResult && !empty($geminiResult['items'])) {
            $parsedData = $geminiResult;
            $aiEngine = 'Google ' . ucwords(str_replace('-', ' ', $usedModelName)) . ' (AI)';
        }
    }

    // 5. Nếu không có Gemini hoặc Gemini lỗi nhưng có text OCR
    if (!$parsedData && !empty($clientOcrText)) {
        $parsedData = fallbackHeuristicInvoiceParse($clientOcrText);
        $aiEngine = 'Smart Text Parser';
    }

    // 6. Nếu vẫn không có dữ liệu -> Báo lỗi rõ ràng, KHÔNG trả về hóa đơn mẫu giả gây nhầm lẫn
    if (!$parsedData) {
        $reason = '';
        if (empty($geminiKey)) {
            $reason = 'Chưa có Google Gemini API Key. Vui lòng nhập API Key (lấy miễn phí tại aistudio.google.com) để AI nhận diện chữ viết tay trên ảnh, hoặc bấm "+ Bổ sung dòng" bên dưới để nhập thủ công.';
        } else {
            $reason = 'Không thể phân tích ảnh bằng Google Gemini: ' . ($geminiError ?: 'Ảnh mờ hoặc không nhận diện được chữ') . '. Vui lòng kiểm tra lại API Key hoặc nhập thủ công.';
        }

        jsonResponse([
            'success' => false,
            'message' => $reason,
            'need_api_key' => empty($geminiKey)
        ], 400);
    }

    // 5. So khớp thông minh (Smart Fuzzy Matching) với danh mục nguyên vật liệu trong kho
    $stmt = $pdo->query("SELECT id, code, name, category, unit, cost_price, supplier FROM materials WHERE status = 'active'");
    $allMaterials = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

    $enrichedItems = [];
    $totalAmount = 0;

    foreach ($parsedData['items'] as $item) {
        $rawName = trim($item['raw_name'] ?? '');
        $qty = floatval($item['quantity'] ?? 1);
        if ($qty <= 0) $qty = 1;
        $unit = trim($item['unit'] ?? 'kg');
        $price = floatval($item['unit_price'] ?? 0);
        $writtenTotal = floatval($item['total_price'] ?? 0);
        // Nếu hóa đơn có ghi Thành tiền → Đơn giá = Thành tiền ÷ Số lượng (chính xác theo chứng từ)
        if ($writtenTotal > 0) {
            $price = round($writtenTotal / $qty);
            $lineTotal = round($writtenTotal);
        } else {
            $lineTotal = round($qty * $price);
        }
        $totalAmount += $lineTotal;

        // So khớp với nguyên liệu hiện có
        $matched = matchMaterial($rawName, $allMaterials);

        if ($matched) {
            $enrichedItems[] = [
                'raw_name' => $rawName,
                'matched' => true,
                'is_new' => false,
                'material_id' => intval($matched['id']),
                'material_code' => $matched['code'],
                'material_name' => $matched['name'],
                'category' => $matched['category'],
                'unit' => $matched['unit'] ?: $unit,
                'quantity' => $qty,
                'unit_price' => ($price > 0) ? $price : floatval($matched['cost_price']),
                'total_cost' => ($price > 0) ? $lineTotal : round($qty * floatval($matched['cost_price']))
            ];
        } else {
            // Nguyên liệu mới chưa có trong kho
            $proposedCode = generateNextMaterialCode($pdo);
            $enrichedItems[] = [
                'raw_name' => $rawName,
                'matched' => false,
                'is_new' => true,
                'material_id' => null,
                'material_code' => $proposedCode,
                'material_name' => $rawName,
                'category' => 'Nguyên liệu',
                'unit' => $unit ?: 'kg',
                'quantity' => $qty,
                'unit_price' => $price,
                'total_cost' => $lineTotal
            ];
        }
    }

    jsonResponse([
        'success' => true,
        'ai_engine' => $aiEngine,
        'invoice_image_url' => $savedRelativePath,
        'supplier' => trim($parsedData['supplier'] ?? ''),
        'invoice_date' => $parsedData['invoice_date'] ?? date('Y-m-d'),
        'invoice_no' => $parsedData['invoice_no'] ?? '',
        'items' => $enrichedItems,
        'total_amount' => $totalAmount
    ]);
}

// 1.4.2 Xác nhận Nhập Kho Hàng Loạt (Batch Goods Receipt)
if ($action === 'batch_import_materials' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $items = $input['items'] ?? [];
    $supplier = trim($input['supplier'] ?? '');
    $invoiceNo = trim($input['invoice_no'] ?? '');
    $invoiceImage = trim($input['invoice_image'] ?? '');
    $note = trim($input['note'] ?? '');

    if (empty($items) || !is_array($items)) {
        jsonResponse(['success' => false, 'message' => 'Không có danh sách mặt hàng để nhập kho!'], 400);
    }

    $pdo->beginTransaction();
    try {
        $transCodes = [];
        $totalBatchCost = 0;
        $importedCount = 0;
        $idx = 1;

        foreach ($items as $item) {
            $isNew = !empty($item['is_new']);
            $name = trim($item['name'] ?? '');
            $unit = trim($item['unit'] ?? 'kg');
            $category = trim($item['category'] ?? 'Nguyên liệu');
            $quantity = floatval($item['quantity'] ?? 0);
            $unitPrice = floatval($item['unit_price'] ?? 0);
            $materialId = intval($item['material_id'] ?? 0);
            $lineCost = round($quantity * $unitPrice);

            if ($quantity <= 0 || empty($name)) {
                continue; // Bỏ qua dòng rỗng hoặc số lượng <= 0
            }

            // 1. Nếu là nguyên liệu mới -> Tạo mới vào danh mục kho
            if ($isNew || $materialId <= 0) {
                $code = trim($item['code'] ?? '') ?: generateNextMaterialCode($pdo);
                $insMat = $pdo->prepare("INSERT INTO materials (code, name, category, unit, quantity, min_quantity, cost_price, supplier, note) VALUES (:code, :name, :cat, :unit, :qty, 5, :price, :sup, :note)");
                $insMat->execute([
                    ':code' => $code,
                    ':name' => $name,
                    ':cat' => $category,
                    ':unit' => $unit,
                    ':qty' => $quantity,
                    ':price' => $unitPrice,
                    ':sup' => $supplier,
                    ':note' => 'Khởi tạo tự động từ phiếu nhập kho thông minh'
                ]);
                $materialId = intval($pdo->lastInsertId());
            } else {
                // 2. Nếu đã có -> Cộng dồn tồn kho và cập nhật giá mua mới nhất
                $updMat = $pdo->prepare("UPDATE materials SET quantity = quantity + :qty, cost_price = CASE WHEN :price > 0 THEN :price ELSE cost_price END, supplier = CASE WHEN :sup != '' THEN :sup ELSE supplier END, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
                $updMat->execute([
                    ':qty' => $quantity,
                    ':price' => $unitPrice,
                    ':sup' => $supplier,
                    ':id' => $materialId
                ]);
            }

            // 3. Ghi vào nhật ký giao dịch kho & chi phí
            $transCode = 'PNK-' . date('Ymd-His') . '-' . sprintf('%02d', $idx);
            $transNote = $note ?: ('Nhập kho theo chứng từ: ' . ($invoiceNo ?: 'Hóa đơn mua hàng'));

            $insTrans = $pdo->prepare("INSERT INTO material_transactions (trans_code, material_id, material_name, trans_type, quantity, unit, unit_price, total_cost, supplier, user_id, user_name, invoice_image, note) VALUES (:tcode, :mid, :mname, 'import', :qty, :unit, :price, :cost, :sup, :uid, :uname, :img, :note)");
            $insTrans->execute([
                ':tcode' => $transCode,
                ':mid' => $materialId,
                ':mname' => $name,
                ':qty' => $quantity,
                ':unit' => $unit,
                ':price' => $unitPrice,
                ':cost' => $lineCost,
                ':sup' => $supplier,
                ':uid' => $_SESSION['user_id'] ?? 1,
                ':uname' => $_SESSION['fullname'] ?? 'Admin',
                ':img' => $invoiceImage,
                ':note' => $transNote
            ]);

            $transCodes[] = $transCode;
            $totalBatchCost += $lineCost;
            $importedCount++;
            $idx++;
        }

        $pdo->commit();

        jsonResponse([
            'success' => true,
            'message' => "Đã nhập thành công {$importedCount} mặt hàng vào kho! Tổng chi phí: " . number_format($totalBatchCost) . " VNĐ.",
            'imported_count' => $importedCount,
            'total_cost' => $totalBatchCost,
            'trans_codes' => $transCodes
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Lỗi xử lý nhập kho hàng loạt: ' . $e->getMessage()], 500);
    }
}

// 1.5 Lịch sử nhập xuất & Báo cáo chi phí vật liệu
if ($action === 'get_transactions') {
    $period = trim($_GET['period'] ?? 'month'); // 'today', '7d', 'month', 'all'
    $type = trim($_GET['type'] ?? 'all'); // 'import', 'export', 'all'
    $materialId = intval($_GET['material_id'] ?? 0);

    $sql = "SELECT * FROM material_transactions WHERE 1=1";
    $params = [];

    if ($type !== 'all' && in_array($type, ['import', 'export', 'adjustment'])) {
        $sql .= " AND trans_type = :ttype";
        $params[':ttype'] = $type;
    }
    if ($materialId > 0) {
        $sql .= " AND material_id = :mid";
        $params[':mid'] = $materialId;
    }

    if ($period === 'today') {
        $sql .= " AND DATE(created_at) = DATE('now', 'localtime')";
    } elseif ($period === '7d') {
        $sql .= " AND DATE(created_at) >= DATE('now', 'localtime', '-7 days')";
    } elseif ($period === 'month') {
        $sql .= " AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')";
    }

    $sql .= " ORDER BY id DESC LIMIT 200";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $transactions = $stmt->fetchAll();

    // Tính tổng chi phí mua vật liệu (chỉ tính phiếu nhập)
    $totalExpense = 0;
    foreach ($transactions as $t) {
        if ($t['trans_type'] === 'import') {
            $totalExpense += floatval($t['total_cost']);
        }
    }

    jsonResponse([
        'success' => true,
        'transactions' => $transactions,
        'total_expense' => $totalExpense,
        'count' => count($transactions)
    ]);
}


// ========================================================
// 2. NHÂN VIÊN ĐANG ĐĂNG NHẬP, LÀM VIỆC THEO THỜI GIAN THỰC
// ========================================================

if ($action === 'get_realtime_staff') {
    // Tự động kiểm tra và chốt các ca làm việc đã hết giờ quy định
    autoCloseExpiredShifts($pdo);

    $now = date('Y-m-d H:i:s');
    $today = date('Y-m-d');

    // 1. Lấy tất cả nhân viên có ca làm 'working' trong ngày hôm nay
    $stmt = $pdo->prepare("SELECT a.*, u.fullname, u.username, u.role, u.user_code as u_code, u.hourly_rate as u_rate, u.last_active_at, u.is_online 
        FROM attendances a
        JOIN users u ON a.user_id = u.id
        WHERE a.status = 'working' AND a.work_date = :today
        ORDER BY a.check_in_time ASC");
    $stmt->execute([':today' => $today]);
    $activeAttendances = $stmt->fetchAll();

    $staffList = [];
    $totalOnline = 0;
    $cashierCount = 0;
    $kitchenCount = 0;
    $waiterCount = 0;
    $adminCount = 0;

    $activeUserIds = [];

    foreach ($activeAttendances as $att) {
        $activeUserIds[] = $att['user_id'];
        $inTime = strtotime($att['check_in_time']);
        $elapsedSec = max(0, time() - $inTime);
        $hours = floor($elapsedSec / 3600);
        $mins = floor(($elapsedSec % 3600) / 60);

        // Kiểm tra xem vừa hoạt động trong vòng 5 phút không
        $lastActiveSec = $att['last_active_at'] ? (time() - strtotime($att['last_active_at'])) : 9999;
        $isActiveRecently = $lastActiveSec <= 300; // trong 5 phút

        $totalOnline++;
        if ($att['role'] === 'cashier') $cashierCount++;
        elseif ($att['role'] === 'kitchen') $kitchenCount++;
        elseif ($att['role'] === 'waiter') $waiterCount++;
        elseif ($att['role'] === 'admin') $adminCount++;

        $staffList[] = [
            'attendance_id' => $att['id'],
            'user_id' => $att['user_id'],
            'user_code' => $att['u_code'] ?: $att['user_code'],
            'fullname' => $att['fullname'],
            'username' => $att['username'],
            'role' => $att['role'],
            'hourly_rate' => floatval($att['hourly_rate']),
            'check_in_time' => $att['check_in_time'],
            'check_in_display' => date('H:i:s', $inTime),
            'elapsed_seconds' => $elapsedSec,
            'elapsed_display' => ($hours > 0 ? "{$hours}h " : "") . "{$mins}m",
            'last_active_at' => $att['last_active_at'],
            'is_recently_active' => $isActiveRecently,
            'device_info' => $att['device_info'] ?: 'Trình duyệt Web',
            'status' => 'working'
        ];
    }

    // 2. Tìm thêm nhân viên có is_online = 1 trong users nhưng chưa có record attendances (phòng hờ)
    $onlineStmt = $pdo->query("SELECT id, user_code, username, fullname, role, hourly_rate, last_active_at, is_online FROM users WHERE is_online = 1 AND status = 'active'");
    while ($u = $onlineStmt->fetch()) {
        if (!in_array($u['id'], $activeUserIds)) {
            $lastActiveSec = $u['last_active_at'] ? (time() - strtotime($u['last_active_at'])) : 9999;
            if ($lastActiveSec <= 600) { // trong 10 phút
                $totalOnline++;
                if ($u['role'] === 'cashier') $cashierCount++;
                elseif ($u['role'] === 'kitchen') $kitchenCount++;
                elseif ($u['role'] === 'waiter') $waiterCount++;
                elseif ($u['role'] === 'admin') $adminCount++;

                $staffList[] = [
                    'attendance_id' => null,
                    'user_id' => $u['id'],
                    'user_code' => $u['user_code'],
                    'fullname' => $u['fullname'],
                    'username' => $u['username'],
                    'role' => $u['role'],
                    'hourly_rate' => floatval($u['hourly_rate'] ?? 25000),
                    'check_in_time' => $u['last_active_at'] ?: $now,
                    'check_in_display' => date('H:i:s', strtotime($u['last_active_at'] ?: $now)),
                    'elapsed_seconds' => 0,
                    'elapsed_display' => "Vừa vào",
                    'last_active_at' => $u['last_active_at'],
                    'is_recently_active' => true,
                    'device_info' => 'Đang kết nối',
                    'status' => 'working'
                ];
            }
        }
    }

    jsonResponse([
        'success' => true,
        'server_time' => date('H:i:s d/m/Y'),
        'staff_list' => $staffList,
        'summary' => [
            'total_working' => $totalOnline,
            'cashier' => $cashierCount,
            'kitchen' => $kitchenCount,
            'waiter' => $waiterCount,
            'admin' => $adminCount
        ]
    ]);
}

// 2.2 Chốt ca thủ công cho nhân viên (Admin Manual Checkout)
if ($action === 'manual_checkout' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $attendanceId = intval($input['attendance_id'] ?? 0);
    $userId = intval($input['user_id'] ?? 0);

    if ($attendanceId <= 0 && $userId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Thiếu thông tin ca làm cần chốt!'], 400);
    }

    $now = date('Y-m-d H:i:s');
    if ($attendanceId > 0) {
        $stmt = $pdo->prepare("SELECT * FROM attendances WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $attendanceId]);
    } else {
        $stmt = $pdo->prepare("SELECT * FROM attendances WHERE user_id = :uid AND status = 'working' ORDER BY id DESC LIMIT 1");
        $stmt->execute([':uid' => $userId]);
    }
    $att = $stmt->fetch();

    if ($att) {
        $inTime = strtotime($att['check_in_time']);
        $outTime = time();
        $seconds = max(0, $outTime - $inTime);
        $workHours = round($seconds / 3600, 2);
        $hourlyRate = floatval($att['hourly_rate']);
        $totalPay = round($workHours * $hourlyRate);

        $upd = $pdo->prepare("UPDATE attendances SET check_out_time = :out_time, work_hours = :hours, total_pay = :pay, status = 'completed', note = :note WHERE id = :id");
        $upd->execute([
            ':out_time' => $now,
            ':hours' => $workHours,
            ':pay' => $totalPay,
            ':note' => 'Quản trị viên chốt ca thủ công lúc ' . date('H:i d/m/Y'),
            ':id' => $att['id']
        ]);

        $pdo->prepare("UPDATE users SET is_online = 0 WHERE id = :uid")->execute([':uid' => $att['user_id']]);

        jsonResponse([
            'success' => true,
            'message' => "Đã chốt ca thành công cho nhân viên {$att['user_name']}! Tổng giờ: {$workHours}h, lương ca: " . number_format($totalPay, 0, ',', '.') . " đ."
        ]);
    } else {
        if ($userId > 0) {
            $pdo->prepare("UPDATE users SET is_online = 0 WHERE id = :uid")->execute([':uid' => $userId]);
            jsonResponse(['success' => true, 'message' => 'Đã cập nhật trạng thái ngoại tuyến cho nhân viên!']);
        }
        jsonResponse(['success' => false, 'message' => 'Không tìm thấy ca làm việc đang mở!'], 404);
    }
}


// ========================================================
// 3. CHẤM CÔNG & TIỀN LƯƠNG (PAYROLL)
// ========================================================

// 3.1 Bảng lương & Thống kê chấm công theo tháng
if ($action === 'get_payroll') {
    $month = trim($_GET['month'] ?? date('Y-m')); // YYYY-MM
    $userId = intval($_GET['user_id'] ?? 0);

    // Lấy danh sách nhân viên
    $users = $pdo->query("SELECT id, user_code, username, fullname, role, hourly_rate, salary_type FROM users WHERE status = 'active' ORDER BY role ASC, id ASC")->fetchAll();

    // Lấy tất cả lượt chấm công trong tháng
    $sql = "SELECT a.*, u.fullname as full_name, u.role as u_role 
            FROM attendances a 
            LEFT JOIN users u ON a.user_id = u.id 
            WHERE strftime('%Y-%m', a.work_date) = :m";
    $params = [':m' => $month];

    if ($userId > 0) {
        $sql .= " AND a.user_id = :uid";
        $params[':uid'] = $userId;
    }
    $sql .= " ORDER BY a.work_date DESC, a.id DESC";

    // Tự động kiểm tra và chốt các ca làm việc đã hết giờ quy định trước khi tính lương
    autoCloseExpiredShifts($pdo);

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $records = $stmt->fetchAll();

    // Tổng hợp bảng lương cho từng nhân viên
    $payrollSummary = [];
    $totalCompanySalary = 0;
    $totalCompanyHours = 0;

    foreach ($users as $u) {
        $uid = $u['id'];
        $payrollSummary[$uid] = [
            'user_id' => $uid,
            'user_code' => $u['user_code'],
            'fullname' => $u['fullname'],
            'role' => $u['role'],
            'hourly_rate' => floatval($u['hourly_rate'] ?: 25000),
            'total_shifts' => 0,
            'total_hours' => 0,
            'total_salary' => 0
        ];
    }

    // Theo dõi số ca làm theo từng ngày của mỗi nhân viên để áp dụng trần tối đa 2 ca / ngày
    $shiftsPerDayByUser = [];

    foreach ($records as &$r) {
        $uid = $r['user_id'];
        $wDate = $r['work_date'];
        $isWorking = ($r['status'] === 'working');
        
        // Nếu ca đang làm việc, tính tạm thời gian và tiền công tích lũy đến hiện tại (tối đa 12h)
        if ($isWorking) {
            $seconds = max(0, time() - strtotime($r['check_in_time']));
            $hrs = min(12.0, round($seconds / 3600, 2));
            $pay = round($hrs * floatval($r['hourly_rate']));
            $r['work_hours'] = $hrs;
            $r['total_pay'] = $pay;
        } else {
            $hrs = floatval($r['work_hours']);
            $pay = floatval($r['total_pay']);
        }

        if (!isset($shiftsPerDayByUser[$uid])) {
            $shiftsPerDayByUser[$uid] = [];
        }
        $shiftsPerDayByUser[$uid][$wDate] = ($shiftsPerDayByUser[$uid][$wDate] ?? 0) + 1;

        if (isset($payrollSummary[$uid])) {
            $payrollSummary[$uid]['total_hours'] += $hrs;
            $payrollSummary[$uid]['total_salary'] += $pay;
        }

        $totalCompanyHours += $hrs;
        $totalCompanySalary += $pay;
    }

    // Tính tổng số ca làm trong tháng theo quy tắc chuẩn:
    // 1 ngày làm việc tối đa không quá 2 ca. Trường hợp login/logout quá 2 lần trong 1 ngày thì chỉ tính 2 ca.
    foreach ($payrollSummary as $uid => &$ps) {
        $userDailyShifts = $shiftsPerDayByUser[$uid] ?? [];
        $totalCappedShifts = 0;
        foreach ($userDailyShifts as $wDate => $shiftCount) {
            $totalCappedShifts += min(2, $shiftCount);
        }
        $ps['total_shifts'] = $totalCappedShifts;
        $ps['total_hours'] = round($ps['total_hours'], 2);
        $ps['total_salary'] = round($ps['total_salary']);
    }

    jsonResponse([
        'success' => true,
        'month' => $month,
        'payroll_summary' => array_values($payrollSummary),
        'attendance_records' => $records,
        'total_company_salary' => $totalCompanySalary,
        'total_company_hours' => round($totalCompanyHours, 2)
    ]);
}

// 3.2 Cập nhật mức lương cho nhân viên
if ($action === 'update_hourly_rate' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $userId = intval($input['user_id'] ?? 0);
    $hourlyRate = floatval($input['hourly_rate'] ?? 0);

    if ($userId <= 0 || $hourlyRate < 0) {
        jsonResponse(['success' => false, 'message' => 'Thông tin mức lương không hợp lệ!'], 400);
    }

    $stmt = $pdo->prepare("UPDATE users SET hourly_rate = :rate WHERE id = :id");
    $stmt->execute([':rate' => $hourlyRate, ':id' => $userId]);

    jsonResponse([
        'success' => true,
        'message' => 'Đã cập nhật mức lương thành công: ' . number_format($hourlyRate, 0, ',', '.') . ' đ/giờ!'
    ]);
}

// 3.3 Lấy cấu hình khung giờ ca làm việc do Admin quy định
if ($action === 'get_shift_settings') {
    $cfg = getShiftConfig($pdo);
    jsonResponse(['success' => true, 'data' => $cfg]);
}

// 3.4 Lưu cấu hình khung giờ ca làm việc & Tự động chốt ca
if ($action === 'save_shift_settings' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    
    $allowedKeys = [
        'shift1_name', 'shift1_start', 'shift1_end',
        'shift2_name', 'shift2_start', 'shift2_end',
        'shift_grace_minutes', 'shift_autoclose_enabled'
    ];

    $stmt = $pdo->prepare("INSERT INTO store_settings (setting_key, setting_value) VALUES (:k, :v) ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v");

    foreach ($allowedKeys as $k) {
        if (isset($input[$k])) {
            $stmt->execute([':k' => $k, ':v' => trim((string)$input[$k])]);
        }
    }

    // Tự động kiểm tra và chốt các ca đã hết giờ ngay sau khi đổi khung giờ
    $closedCount = autoCloseExpiredShifts($pdo);

    jsonResponse([
        'success' => true,
        'message' => 'Đã lưu cấu hình khung giờ ca làm việc thành công!' . ($closedCount > 0 ? " Đã tự động chốt {$closedCount} ca hết giờ." : ''),
        'closed_shifts_count' => $closedCount
    ]);
}

// ========================================================
// CÁC HÀM TIỆN ÍCH CHO AI & NHẬP KHO THÔNG MINH
// ========================================================

/**
 * Sinh mã nguyên vật liệu tiếp theo (ví dụ: NVL001 -> NVL002 -> NVL006)
 */
function generateNextMaterialCode(PDO $pdo): string {
    try {
        $stmt = $pdo->query("SELECT code FROM materials WHERE code LIKE 'NVL%' ORDER BY id DESC LIMIT 1");
        $lastCode = $stmt ? $stmt->fetchColumn() : null;
        if ($lastCode && preg_match('/NVL(\d+)/i', $lastCode, $m)) {
            $nextNum = intval($m[1]) + 1;
            return sprintf('NVL%03d', $nextNum);
        }
    } catch (Exception $e) {}
    return 'NVL' . rand(100, 999);
}

/**
 * Chuyển đổi chuỗi tiếng Việt có dấu thành không dấu và chuẩn hóa chữ thường
 */
function removeVietnameseAccents(string $str): string {
    $str = mb_strtolower($str, 'UTF-8');
    $accents = [
        'a' => ['à','á','ạ','ả','ã','â','ầ','ấ','ậ','ẩ','ẫ','ă','ằ','ắ','ặ','ẳ','ẵ'],
        'e' => ['è','é','ẹ','ẻ','ẽ','ê','ề','ế','ệ','ể','ễ'],
        'i' => ['ì','í','ị','ỉ','ĩ'],
        'o' => ['ò','ó','ọ','ỏ','õ','ô','ồ','ố','ộ','ổ','ỗ','ơ','ờ','ớ','ợ','ở','ỡ'],
        'u' => ['ù','ú','ụ','ủ','ũ','ư','ừ','ứ','ự','ử','ữ'],
        'y' => ['ỳ','ý','ỵ','ỷ','ỹ'],
        'd' => ['đ']
    ];
    foreach ($accents as $nonAccent => $accentChars) {
        $str = str_replace($accentChars, $nonAccent, $str);
    }
    return preg_replace('/[^a-z0-9\s]/', '', $str);
}

/**
 * So khớp thông minh tên hàng hóa trích xuất từ hóa đơn với danh mục nguyên vật liệu
 */
function matchMaterial(string $rawName, array $materials): ?array {
    $cleanRaw = trim(removeVietnameseAccents($rawName));
    if (empty($cleanRaw)) return null;

    $bestMatch = null;
    $bestScore = 0;

    foreach ($materials as $mat) {
        $cleanMat = trim(removeVietnameseAccents($mat['name']));
        $cleanCode = strtolower($mat['code']);

        // 1. Trùng khớp trực tiếp mã hoặc chứa trọn tên
        if ($cleanRaw === $cleanMat || $cleanRaw === $cleanCode) {
            return $mat;
        }
        if (strpos($cleanMat, $cleanRaw) !== false || strpos($cleanRaw, $cleanMat) !== false) {
            return $mat;
        }

        // 2. So khớp từ khóa (Token overlap similarity)
        $tokensRaw = array_filter(explode(' ', $cleanRaw));
        $tokensMat = array_filter(explode(' ', $cleanMat));
        if (!empty($tokensRaw) && !empty($tokensMat)) {
            $intersection = array_intersect($tokensRaw, $tokensMat);
            $score = count($intersection) / max(count($tokensRaw), count($tokensMat));
            if ($score > $bestScore && $score >= 0.4) {
                $bestScore = $score;
                $bestMatch = $mat;
            }
        }
    }

    return $bestMatch;
}

/**
 * Gọi Google Gemini 1.5 Flash Vision API để nhận dạng & phân tích hóa đơn / giấy viết tay
 */
function getSampleDemoInvoice(): array {
    return [
        'supplier' => 'Đại lý Cà phê Buôn Ma Thuột',
        'invoice_date' => date('Y-m-d'),
        'invoice_no' => 'PNK-' . date('Ymd-Hi'),
        'items' => [
            [
                'raw_name' => 'Cà phê hạt Robusta Đắk Lắk',
                'quantity' => 20.0,
                'unit' => 'kg',
                'unit_price' => 140000,
                'total_price' => 2800000
            ],
            [
                'raw_name' => 'Sữa đặc Ngôi Sao Phương Nam',
                'quantity' => 24.0,
                'unit' => 'hộp',
                'unit_price' => 22000,
                'total_price' => 528000
            ],
            [
                'raw_name' => 'Sữa tươi thanh trùng không đường',
                'quantity' => 12.0,
                'unit' => 'lít',
                'unit_price' => 32000,
                'total_price' => 384000
            ],
            [
                'raw_name' => 'Trà Oolong nướng Đài Loan',
                'quantity' => 5.0,
                'unit' => 'gói',
                'unit_price' => 85000,
                'total_price' => 425000
            ]
        ]
    ];
}

/**
 * Gọi Google Gemini Vision API để nhận dạng & phân tích hóa đơn / giấy viết tay
 */
function callGeminiVisionAPI(string $apiKey, string $mimeType, string $base64Data, ?string &$errorMessage = null, ?string &$usedModel = null): ?array {
    // Ưu tiên trực tiếp Google Gemini 3.8 Flash theo yêu cầu, fallback sang 3.5 Flash
    $models = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    $lastError = '';

    // Chuẩn hóa mimeType theo chuẩn Google API (Google chấp nhận image/jpeg, image/png, image/webp)
    if ($mimeType === 'image/jpg') $mimeType = 'image/jpeg';
    if (!in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'])) {
        $mimeType = 'image/jpeg';
    }

    $promptText = "Bạn là chuyên gia kế toán kho F&B cho nhà hàng/quán cafe. Hãy đọc kỹ hình ảnh chứng từ mua hàng này (hóa đơn in nhiệt, phiếu mua hàng, phiếu xuất kho, hoặc giấy viết tay mua hàng) và bóc tách dữ liệu theo định dạng JSON.

HƯỚNG DẪN ĐẶC BIỆT KHI ĐỌC CHỮ VIẾT TAY:
1. Đọc kỹ từng dòng chữ viết tay tiếng Việt và các con số (tên mặt hàng, số lượng, đơn vị tính, số tiền).
2. Tự động nhận diện hướng ảnh: Nếu ảnh bị chụp xoay ngang, xoay dọc hoặc xoay ngược, hãy tự động nhận diện đúng chiều đọc chữ để bóc tách chính xác.
3. Nhận dạng mẫu điển hình trên giấy viết tay F&B:
   - Dòng: 'Bánh mì 2 ổ 10.000' -> raw_name: 'Bánh mì', quantity: 2, unit: 'ổ', total_price: 10000, unit_price: 5000
   - Dòng: 'Pate 0.5 kg 90.000' -> raw_name: 'Pate', quantity: 0.5, unit: 'kg', total_price: 90000, unit_price: 180000
   - Dòng: 'Xúc xích 1 gói 45.000' -> raw_name: 'Xúc xích', quantity: 1, unit: 'gói', total_price: 45000, unit_price: 45000
4. Nhà cung cấp (supplier): Nếu trên giấy KHÔNG có ghi tên người bán hoặc cửa hàng, BẮT BUỘC để chuỗi rỗng \"\". Không được tự bịa ra nhà cung cấp.
5. Số hóa đơn (invoice_no): Nếu không có thì để chuỗi rỗng \"\".
6. Ngày hóa đơn (invoice_date): YYYY-MM-DD. Nếu không có ghi ngày, dùng ngày \"" . date('Y-m-d') . "\".

Định dạng JSON bắt buộc:
{
  \"supplier\": \"\",
  \"invoice_date\": \"" . date('Y-m-d') . "\",
  \"invoice_no\": \"\",
  \"items\": [
    {
      \"raw_name\": \"Bánh mì\",
      \"quantity\": 2,
      \"unit\": \"ổ\",
      \"unit_price\": 5000,
      \"total_price\": 10000
    }
  ]
}

QUAN TRỌNG: Chỉ trả về chuỗi JSON thuần túy hợp lệ, KHÔNG dùng markdown ```json.";

    // Cực kỳ quan trọng: Google Gemini REST API yêu cầu camelCase (inlineData và mimeType)
    $body = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $promptText],
                    [
                        'inlineData' => [
                            'mimeType' => $mimeType,
                            'data' => $base64Data
                        ]
                    ]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.1,
            'responseMimeType' => 'application/json'
        ]
    ];

    $payload = json_encode($body);

    foreach ($models as $model) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);

        for ($attempt = 1; $attempt <= 2; $attempt++) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => $payload,
                CURLOPT_TIMEOUT => 25,
                CURLOPT_SSL_VERIFYPEER => false
            ]);

            $res = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if ($httpCode === 200 && $res) {
                $data = json_decode($res, true);
                $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
                if ($text) {
                    $cleanText = preg_replace('/^```(?:json)?\s*/i', '', trim($text));
                    $cleanText = preg_replace('/\s*```$/', '', $cleanText);
                    $parsed = json_decode($cleanText, true);
                    if (is_array($parsed) && isset($parsed['items']) && is_array($parsed['items'])) {
                        $usedModel = $model;
                        return $parsed;
                    }
                }
            } else {
                $errData = json_decode($res, true);
                $msg = $errData['error']['message'] ?? ($curlErr ?: ("Mã lỗi HTTP: " . $httpCode));
                $lastError = "Gemini ($model): " . $msg;
                // Nếu bị 503 tạm thời, chờ 1s rồi thử lại
                if ($httpCode === 503 && $attempt < 2) {
                    sleep(1);
                    continue;
                }
            }
            break;
        }
    }

    $errorMessage = $lastError;
    return null;
}

/**
 * Parser dự phòng bóc tách văn bản thô
 */
function fallbackHeuristicInvoiceParse(string $rawOcrText, string $imageName = ''): array {
    $result = [
        'supplier' => '',
        'invoice_date' => date('Y-m-d'),
        'invoice_no' => '',
        'items' => []
    ];

    if (!empty($rawOcrText)) {
        $lines = preg_split('/\r\n|\r|\n/', $rawOcrText);
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            if (empty($result['supplier']) && preg_match('/(công ty|cty|đại lý|cửa hàng|nhà cung cấp|tiệm|shop|chợ)\s+([^,\n]+)/i', $line, $sm)) {
                $result['supplier'] = trim($sm[0]);
                continue;
            }

            if (preg_match('/([a-zA-Zà-ỹÀ-Ỹ\s]+?)\s+(\d+(?:[\.,]\d+)?)\s*(kg|lít|lit|hộp|hop|gói|goi|lon|chai|ổ|o|túi|tui|bịch|thùng|thung)?\s*(?:x|\*|\s)?\s*(\d{1,3}(?:[\.,]\d{3})*|\d+)/iu', $line, $m)) {
                $name = trim($m[1]);
                $qty = floatval(str_replace(',', '.', $m[2]));
                $unit = trim($m[3] ?? 'kg') ?: 'kg';
                $priceStr = preg_replace('/[^\d]/', '', $m[4]);
                $price = floatval($priceStr);
                if ($qty > 0 && strlen($name) >= 2) {
                    $result['items'][] = [
                        'raw_name' => $name,
                        'quantity' => $qty,
                        'unit' => $unit,
                        'unit_price' => $price,
                        'total_price' => round($qty * $price)
                    ];
                }
            }
        }
    }

    return $result;
}

jsonResponse(['success' => false, 'message' => 'Hành động không hợp lệ!'], 400);
