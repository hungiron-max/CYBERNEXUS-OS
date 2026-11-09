<?php
/**
 * Database Reset / Seed CLI & Web Script
 */

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = Database::getConnection();
    $result = Database::initializeDatabase($pdo);
    
    // Check tables count
    if (DB_DRIVER === 'sqlite') {
        $stmt = $pdo->query("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    } else {
        $stmt = $pdo->query("SHOW TABLES");
    }
    
    $productCount = $pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
    $categoryCount = $pdo->query("SELECT COUNT(*) FROM categories")->fetchColumn();
    $tableCount = $pdo->query("SELECT COUNT(*) FROM tables_areas")->fetchColumn();

    $output = [
        'status' => 'success',
        'message' => 'Cơ sở dữ liệu khởi tạo thành công!',
        'driver' => DB_DRIVER,
        'categories_count' => (int)$categoryCount,
        'products_count' => (int)$productCount,
        'tables_count' => (int)$tableCount,
        'timestamp' => date('Y-m-d H:i:s')
    ];

    if (php_sapi_name() === 'cli') {
        echo "=============================================\n";
        echo " POS SALE-APP: DATABASE INITIALIZED\n";
        echo "=============================================\n";
        echo "Driver: " . DB_DRIVER . "\n";
        echo "Categories: " . $categoryCount . "\n";
        echo "Products: " . $productCount . "\n";
        echo "Tables: " . $tableCount . "\n";
        echo "Status: SUCCESS\n";
    } else {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
} catch (Exception $e) {
    if (php_sapi_name() === 'cli') {
        echo "ERROR: " . $e->getMessage() . "\n";
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
}

