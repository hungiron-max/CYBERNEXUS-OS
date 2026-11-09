<?php
/**
 * Migration Script: Inventory, Material Costs, Payroll & Realtime Staff Attendance
 */
require_once __DIR__ . '/../config/database.php';

try {
    $pdo = Database::getConnection();

    // 1. Alter users table to add hourly_rate, salary_type, is_online, last_active_at
    $columns = [];
    $stmt = $pdo->query("PRAGMA table_info(users)");
    while ($row = $stmt->fetch()) {
        $columns[] = $row['name'];
    }

    if (!in_array('hourly_rate', $columns)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN hourly_rate DECIMAL(12, 2) DEFAULT 25000");
    }
    if (!in_array('salary_type', $columns)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN salary_type VARCHAR(20) DEFAULT 'hourly'");
    }
    if (!in_array('is_online', $columns)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN is_online INTEGER DEFAULT 0");
    }
    if (!in_array('last_active_at', $columns)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN last_active_at DATETIME DEFAULT NULL");
    }

    // Set initial hourly rates for staff roles
    $pdo->exec("UPDATE users SET hourly_rate = 30000 WHERE role = 'cashier' AND (hourly_rate IS NULL OR hourly_rate = 25000)");
    $pdo->exec("UPDATE users SET hourly_rate = 28000 WHERE role = 'kitchen' AND (hourly_rate IS NULL OR hourly_rate = 25000)");
    $pdo->exec("UPDATE users SET hourly_rate = 22000 WHERE role = 'waiter' AND (hourly_rate IS NULL OR hourly_rate = 25000)");
    $pdo->exec("UPDATE users SET hourly_rate = 40000 WHERE role = 'admin' AND (hourly_rate IS NULL OR hourly_rate = 25000)");

    // 2. Table: materials (Kho nguyên vật liệu)
    $pdo->exec("CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(20) UNIQUE,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(50) DEFAULT 'Nguyên liệu',
        unit VARCHAR(30) NOT NULL,
        quantity DECIMAL(12, 2) DEFAULT 0,
        min_quantity DECIMAL(12, 2) DEFAULT 5,
        cost_price DECIMAL(12, 2) DEFAULT 0,
        supplier VARCHAR(150) DEFAULT '',
        note TEXT DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 3. Table: material_transactions (Nhập kho, Xuất kho, Chi phí mua vật liệu)
    $pdo->exec("CREATE TABLE IF NOT EXISTS material_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trans_code VARCHAR(30) UNIQUE,
        material_id INTEGER NOT NULL,
        material_name VARCHAR(150) NOT NULL,
        trans_type VARCHAR(20) NOT NULL, -- 'import' (nhập kho), 'export' (xuất kho), 'adjustment' (điều chỉnh)
        quantity DECIMAL(12, 2) NOT NULL,
        unit VARCHAR(30) NOT NULL,
        unit_price DECIMAL(12, 2) DEFAULT 0,
        total_cost DECIMAL(12, 2) DEFAULT 0,
        supplier VARCHAR(150) DEFAULT '',
        user_id INTEGER DEFAULT NULL,
        user_name VARCHAR(100) DEFAULT '',
        invoice_image VARCHAR(255) DEFAULT '',
        note TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 4. Table: attendances (Chấm công tự động khi nhân viên đăng nhập)
    $pdo->exec("CREATE TABLE IF NOT EXISTS attendances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        user_code VARCHAR(20) DEFAULT '',
        user_role VARCHAR(20) NOT NULL,
        work_date DATE NOT NULL,
        check_in_time DATETIME NOT NULL,
        check_out_time DATETIME DEFAULT NULL,
        work_hours DECIMAL(6, 2) DEFAULT 0,
        hourly_rate DECIMAL(12, 2) DEFAULT 25000,
        total_pay DECIMAL(12, 2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'working', -- 'working', 'completed'
        device_info VARCHAR(100) DEFAULT '',
        note TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Seed sample materials if empty
    $checkMaterials = $pdo->query("SELECT COUNT(*) FROM materials")->fetchColumn();
    if ($checkMaterials == 0) {
        $sampleMaterials = [
            ['NVL001', 'Cà phê hạt Robusta Đắk Lắk', 'Cà phê & Trà', 'kg', 25.0, 5.0, 140000, 'Đại lý Cà phê Buôn Ma Thuột'],
            ['NVL002', 'Sữa đặc Ngôi Sao Phương Nam', 'Sữa & Bơ', 'hộp', 48.0, 10.0, 22000, 'Vinamilk'],
            ['NVL003', 'Sữa tươi thanh trùng không đường', 'Sữa & Bơ', 'lít', 30.0, 8.0, 32000, 'TH True Milk'],
            ['NVL004', 'Trà Oolong nướng Đài Loan', 'Cà phê & Trà', 'gói', 15.0, 3.0, 85000, 'Trà Tân Cương'],
            ['NVL005', 'Trà Thái xanh thượng hạng', 'Cà phê & Trà', 'gói', 12.0, 4.0, 65000, 'Thực phẩm Á Châu'],
            ['NVL006', 'Bánh mì tươi giòn', 'Bánh mì & Mì', 'ổ', 50.0, 15.0, 3000, 'Lò bánh mì Hữu Nghị'],
            ['NVL007', 'Thịt bò tươi phi lê', 'Thực phẩm tươi', 'kg', 8.5, 2.0, 240000, 'Vissan'],
            ['NVL008', 'Trứng gà tươi Ba Huân', 'Thực phẩm tươi', 'quả', 120.0, 30.0, 3200, 'Ba Huân'],
            ['NVL009', 'Xúc xích Đức xông khói', 'Thực phẩm tươi', 'gói', 18.0, 5.0, 45000, 'CP Group'],
            ['NVL010', 'Pate gan heo đặc biệt', 'Thực phẩm tươi', 'kg', 6.0, 2.0, 110000, 'Nhà làm Góc Phố'],
            ['NVL011', 'Trân châu đen hoàng kim 3Q', 'Topping & Đá xay', 'gói', 20.0, 5.0, 42000, 'Gia Thịnh Phát'],
            ['NVL012', 'Bột Frappe tạo béo & chống tách', 'Topping & Đá xay', 'gói', 10.0, 2.0, 115000, 'Richs'],
            ['NVL013', 'Ly nhựa PP 500ml + Màng ép', 'Bao bì & Dụng cụ', 'lốc', 25.0, 5.0, 35000, 'Bao bì Nam Long'],
            ['NVL014', 'Mì tôm Miliket 2 tôm', 'Bánh mì & Mì', 'thùng', 8.0, 2.0, 135000, 'Miliket']
        ];

        $ins = $pdo->prepare("INSERT INTO materials (code, name, category, unit, quantity, min_quantity, cost_price, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        foreach ($sampleMaterials as $mat) {
            $ins->execute($mat);
        }

        // Seed some sample material import transactions
        $pdo->exec("INSERT INTO material_transactions (trans_code, material_id, material_name, trans_type, quantity, unit, unit_price, total_cost, supplier, user_name, note, created_at) VALUES 
            ('PNK-20261028-001', 1, 'Cà phê hạt Robusta Đắk Lắk', 'import', 30, 'kg', 140000, 4200000, 'Đại lý Cà phê Buôn Ma Thuột', 'Quản Trị Viên', 'Nhập đầu tuần', '2026-10-28 08:30:00'),
            ('PNK-20261029-002', 2, 'Sữa đặc Ngôi Sao Phương Nam', 'import', 50, 'hộp', 22000, 1100000, 'Vinamilk', 'Quản Trị Viên', 'Nhập bổ sung', '2026-10-29 09:15:00'),
            ('PNK-20261030-003', 7, 'Thịt bò tươi phi lê', 'import', 10, 'kg', 240000, 2400000, 'Vissan', 'Quản Trị Viên', 'Nhập thịt tươi cuối tuần', '2026-10-30 07:00:00')
        ");
    }

    echo "Migration completed successfully!\n";
} catch (Exception $e) {
    echo "Migration error: " . $e->getMessage() . "\n";
    exit(1);
}

