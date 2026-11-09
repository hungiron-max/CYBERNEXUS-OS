-- ====================================================
-- SALE APP POS & ADMIN MANAGEMENT SYSTEM
-- Compatible with SQLite and MySQL
-- ====================================================

-- 1. Table: users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_code VARCHAR(20) UNIQUE DEFAULT NULL, -- ADM001, ACC001, STF001, KIT001, USR001
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    fullname VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'cashier', -- 'admin' (ADM), 'cashier' (ACC), 'waiter' (STF), 'kitchen' (KIT), 'customer' (USR)
    phone VARCHAR(20) DEFAULT NULL,
    pin_code VARCHAR(10) DEFAULT NULL,
    avatar VARCHAR(255) DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table: categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT 'coffee',
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table: products
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'ly', -- ly, dĩa, phần, lon, chai, cái
    cost_price DECIMAL(12, 2) DEFAULT 0,
    sale_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    image VARCHAR(255) DEFAULT NULL,
    is_topping INTEGER DEFAULT 0, -- 1: topping, 0: standard product
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'locked'
    description TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table: tables_areas
CREATE TABLE IF NOT EXISTS tables_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(20) NOT NULL UNIQUE, -- MV1, MV2, TQ1, TQ2...
    name VARCHAR(100) NOT NULL,
    area_type VARCHAR(20) NOT NULL DEFAULT 'TAI_QUAN', -- 'MANG_VE', 'TAI_QUAN'
    status VARCHAR(20) DEFAULT 'free', -- 'free', 'occupied', 'reserved'
    active_order_id INTEGER DEFAULT NULL,
    guest_count INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table: orders
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code VARCHAR(30) NOT NULL UNIQUE,
    table_id INTEGER DEFAULT NULL,
    table_code VARCHAR(20) DEFAULT 'MANG VỀ',
    customer_name VARCHAR(100) DEFAULT 'Khách vãng lai',
    guest_count INTEGER DEFAULT 1,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_type VARCHAR(10) DEFAULT 'amount', -- 'percent', 'amount'
    discount_value DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    vat_percent DECIMAL(5, 2) DEFAULT 0,
    vat_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(20) DEFAULT 'cash', -- 'cash', 'banking', 'card'
    cash_received DECIMAL(12, 2) DEFAULT 0,
    change_amount DECIMAL(12, 2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid', 'paid'
    paid_at DATETIME DEFAULT NULL,
    kitchen_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'ready', 'served', 'archived'
    kitchen_ready_at DATETIME DEFAULT NULL,
    served_at DATETIME DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' (đang chế biến/chờ bưng/chưa hoàn thành), 'completed' (đủ 3 yếu tố: xong món, bưng ra, thanh toán), 'cancelled' (đã hủy)
    user_id INTEGER DEFAULT NULL,
    user_name VARCHAR(100) DEFAULT 'Administrator',
    note TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME DEFAULT NULL
);

-- 6. Table: order_items
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_code VARCHAR(20) DEFAULT '',
    product_name VARCHAR(150) NOT NULL,
    unit VARCHAR(20) DEFAULT 'ly',
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    note VARCHAR(255) DEFAULT '',
    toppings_json TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Table: store_settings
CREATE TABLE IF NOT EXISTS store_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key VARCHAR(50) NOT NULL UNIQUE,
    setting_value TEXT DEFAULT NULL
);

-- 8. Table: app_notifications
CREATE TABLE IF NOT EXISTS app_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type VARCHAR(30) NOT NULL, -- 'kitchen_cancel_item', 'kitchen_ready', 'note_updated'
    order_id INTEGER NOT NULL,
    table_code VARCHAR(30) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read_waiter INTEGER DEFAULT 0,
    is_read_cashier INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- INITIAL SEED DATA
-- ====================================================

-- Users
-- Password 'admin123': $2y$10$wN1rFj6xRkFmG5t17B27xOWZ0B79NqO3uO1lF3vUq1n3x7bUqH8sK or legacy plain support
INSERT OR IGNORE INTO users (id, username, password, fullname, role, status) VALUES 
(1, 'Admin', '$2y$10$0zX77o5959eG19Xh5gYyGOSL4Mh4N2nIbmv17L3v4o3Xk0v7mKqSu', 'Quản trị viên', 'admin', 'active'),
(2, 'ThuNgan', '$2y$10$0zX77o5959eG19Xh5gYyGOSL4Mh4N2nIbmv17L3v4o3Xk0v7mKqSu', 'Thu Ngân 01', 'cashier', 'active');

-- Categories (matching user legacy screenshot)
INSERT OR IGNORE INTO categories (id, name, icon, sort_order) VALUES
(1, 'BÁNH MÌ CHẢO', 'utensils', 1),
(2, 'BÁNH FLAN', 'cookie', 2),
(3, 'BÒ BÍT TẾT', 'drumstick-bite', 3),
(4, 'CAFE', 'coffee', 4),
(5, 'CAFE XAY', 'blender', 5),
(6, 'CHÈ KHÚC BẠCH', 'ice-cream', 6),
(7, 'ĐÁ XAY', 'glass-whiskey', 7),
(8, 'LỤC TRÀ', 'leaf', 8),
(9, 'MANG VỀ', 'shopping-bag', 9),
(10, 'NƯỚC NGỌT', 'wine-bottle', 10),
(11, 'SINH TỐ', 'apple-alt', 11),
(12, 'TOPPING', 'candy-cane', 12),
(13, 'TRÀ SỮA', 'mug-hot', 13),
(14, 'TRÀ TRÁI CÂY', 'lemon', 14);

-- Products (seeded with prices from legacy system)
INSERT OR IGNORE INTO products (id, category_id, code, name, unit, cost_price, sale_price, is_topping, status) VALUES
-- Bánh mì chảo
(1, 1, 'BM001', 'Bánh Mì', 'cái', 3000, 6000, 0, 'active'),
(2, 1, 'BM002', 'Bánh Mì Chảo Đặc Biệt', 'chảo', 25000, 45000, 0, 'active'),
(3, 1, 'BM003', 'Bánh Mì Ốp La 2 Trứng', 'chảo', 15000, 30000, 0, 'active'),
(4, 1, 'BM004', 'Bánh Mì Trứng Xúc Xích', 'chảo', 16000, 30000, 0, 'active'),
(5, 1, 'BM005', 'Mì Gói Bò', 'tô', 18000, 35000, 0, 'active'),
(6, 1, 'BM006', 'Mì Gói Trứng', 'tô', 14000, 30000, 0, 'active'),
(7, 1, 'BM007', 'Mì Xào Bò', 'dĩa', 20000, 35000, 0, 'active'),
(8, 1, 'BM008', 'Mì Xào Bò Trứng', 'dĩa', 23000, 40000, 0, 'active'),
(9, 1, 'BM009', 'Pate Thêm', 'phần', 2500, 5000, 0, 'active'),
(10, 1, 'BM010', 'Rau Thêm', 'phần', 3000, 10000, 0, 'active'),
(11, 1, 'BM011', 'Trứng Ốp La Thêm', 'trứng', 3500, 7000, 0, 'active'),
(12, 1, 'BM012', 'Xúc Xích Thêm', 'cây', 4000, 8000, 0, 'active'),

-- Bánh Flan
(13, 2, 'FL001', 'Bánh Flan Truyền Thống', 'cái', 3500, 7000, 0, 'active'),
(14, 2, 'FL002', 'Bánh Flan (3 Cái)', 'phần', 10000, 20000, 0, 'active'),
(15, 2, 'FL003', 'Bánh Flan Cốt Dừa Cafe', 'phần', 8000, 15000, 0, 'active'),

-- Bò bít tết
(16, 3, 'BT001', 'Bò Bít Tết Tiêu Đen', 'chảo', 28000, 50000, 0, 'active'),
(17, 3, 'BT002', 'Bò Full Topping (Khoai, Trứng, Pate, Phô mai)', 'chảo', 35000, 60000, 0, 'active'),
(18, 3, 'BT003', 'Bò + Trứng Ốp La', 'chảo', 30000, 50000, 0, 'active'),

-- Cafe
(19, 4, 'CF001', 'Cafe Đen Đá', 'ly', 8000, 18000, 0, 'active'),
(20, 4, 'CF002', 'Cafe Sữa Đá', 'ly', 9000, 22000, 0, 'active'),
(21, 4, 'CF003', 'Bạc Xỉu Góc Phố', 'ly', 10000, 25000, 0, 'active'),
(22, 4, 'CF004', 'Bình Trà Nóng', 'bình', 5000, 20000, 0, 'active'),

-- Trà sữa
(23, 13, 'TS001', 'Trà Sữa Truyền Thống Góc Phố', 'ly', 11000, 25000, 0, 'active'),
(24, 13, 'TS002', 'Trà Sữa Thái Xanh Thơm Béo', 'ly', 12000, 28000, 0, 'active'),
(25, 13, 'TS003', 'Trà Sữa Khoai Môn', 'ly', 13000, 30000, 0, 'active'),
(26, 13, 'TS004', 'Trà Sữa Oolong Nướng', 'ly', 14000, 32000, 0, 'active'),

-- Trà trái cây
(27, 14, 'TC001', 'Trà Đào Cam Sả', 'ly', 12000, 30000, 0, 'active'),
(28, 14, 'TC002', 'Trà Vải Hoa Hồng', 'ly', 12000, 30000, 0, 'active'),
(29, 14, 'TC003', 'Trà Ổi Hồng Nhiệt Đới', 'ly', 12000, 28000, 0, 'active'),

-- Nước ngọt
(30, 10, 'NN001', 'Coca Cola Lon', 'lon', 9000, 15000, 0, 'active'),
(31, 10, 'NN002', '7Up Lon', 'lon', 9000, 15000, 0, 'active'),
(32, 10, 'NN003', 'Bò Cụng (Redbull)', 'lon', 12000, 20000, 0, 'active'),
(33, 10, 'NN004', 'Trà Xanh Không Độ / C2', 'chai', 8000, 15000, 0, 'active'),

-- Sinh tố & Đá xay
(34, 11, 'ST001', 'Sinh Tố Bơ Đắk Lắk', 'ly', 16000, 35000, 0, 'active'),
(35, 11, 'ST002', 'Sinh Tố Mãng Cầu', 'ly', 15000, 32000, 0, 'active'),
(36, 7, 'DX001', 'Matcha Đá Xay Kem Cheese', 'ly', 16000, 38000, 0, 'active'),
(37, 7, 'DX002', 'Cookie Đá Xay Socola', 'ly', 15000, 36000, 0, 'active'),

-- Topping
(38, 12, 'TP001', 'Trân Châu Đen Hoàng Kim', 'phần', 2000, 5000, 1, 'active'),
(39, 12, 'TP002', 'Trân Châu Trắng Giòn', 'phần', 2500, 6000, 1, 'active'),
(40, 12, 'TP003', 'Thạch Khúc Bạch Phô Mai', 'phần', 3000, 8000, 1, 'active'),
(41, 12, 'TP004', 'Kem Cheese Macchiato', 'phần', 3500, 10000, 1, 'active'),
(42, 12, 'TP005', 'Thạch Củ Năng Lá Dứa', 'phần', 2500, 6000, 1, 'active');

-- Tables & Areas (Mang Về: MV1 -> MV5, Tại Quán: TQ1 -> TQ8)
INSERT OR IGNORE INTO tables_areas (id, code, name, area_type, status, sort_order) VALUES
(1, 'MV1', 'Mang Về 01', 'MANG_VE', 'free', 1),
(2, 'MV2', 'Mang Về 02', 'MANG_VE', 'free', 2),
(3, 'MV3', 'Mang Về 03', 'MANG_VE', 'free', 3),
(4, 'MV4', 'Mang Về 04', 'MANG_VE', 'free', 4),
(5, 'MV5', 'Mang Về 05', 'MANG_VE', 'free', 5),
(6, 'TQ1', 'Bàn Tại Quán 01', 'TAI_QUAN', 'free', 6),
(7, 'TQ2', 'Bàn Tại Quán 02', 'TAI_QUAN', 'free', 7),
(8, 'TQ3', 'Bàn Tại Quán 03', 'TAI_QUAN', 'free', 8),
(9, 'TQ4', 'Bàn Tại Quán 04', 'TAI_QUAN', 'free', 9),
(10, 'TQ5', 'Bàn Tại Quán 05', 'TAI_QUAN', 'free', 10),
(11, 'TQ6', 'Bàn Tại Quán 06', 'TAI_QUAN', 'free', 11),
(12, 'TQ7', 'Bàn Tại Quán 07', 'TAI_QUAN', 'free', 12),
(13, 'TQ8', 'Bàn Tại Quán 08', 'TAI_QUAN', 'free', 13);

-- Settings
INSERT OR IGNORE INTO store_settings (setting_key, setting_value) VALUES
('store_name', 'GÓC PHỐ COFFEE & TEA'),
('store_hotline', '0967.041.111'),
('store_address', '123 Đường Số 5, Linh Trung, Thủ Đức, TP.HCM'),
('bank_id', 'MB'),
('bank_account_no', '0967041111'),
('bank_account_name', 'NGUYEN VAN PHAT'),
('print_header_note', 'Hân hạnh được phục vụ Quý khách!'),
('print_footer_note', 'Pass Wifi: 88888888 - Hẹn gặp lại quý khách!');

-- 9. Table: materials (Quản lý kho nguyên vật liệu)
CREATE TABLE IF NOT EXISTS materials (
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
);

-- 10. Table: material_transactions (Nhập kho, Xuất kho, Chi phí mua vật liệu)
CREATE TABLE IF NOT EXISTS material_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trans_code VARCHAR(30) UNIQUE,
    material_id INTEGER NOT NULL,
    material_name VARCHAR(150) NOT NULL,
    trans_type VARCHAR(20) NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    unit_price DECIMAL(12, 2) DEFAULT 0,
    total_cost DECIMAL(12, 2) DEFAULT 0,
    supplier VARCHAR(150) DEFAULT '',
    user_id INTEGER DEFAULT NULL,
    user_name VARCHAR(100) DEFAULT '',
    note TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Table: attendances (Chấm công tự động khi nhân viên đăng nhập)
CREATE TABLE IF NOT EXISTS attendances (
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
    status VARCHAR(20) DEFAULT 'working',
    device_info VARCHAR(100) DEFAULT '',
    note TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

