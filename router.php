<?php
/**
 * Portable Router for PHP Built-in Server
 * Handles all requests, static assets, and APIs reliably
 */

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
$cleanUri = ltrim($uri, '/');

// Handle root path -> index.php
if ($uri === '/' || $uri === '') {
    require_once __DIR__ . '/index.php';
    exit;
}

$targetFile = __DIR__ . '/' . $cleanUri;

// If it's a physical file (CSS, JS, images, font, etc.)
if (is_file($targetFile)) {
    // If it's a PHP file, execute it
    if (pathinfo($targetFile, PATHINFO_EXTENSION) === 'php') {
        require_once $targetFile;
        exit;
    }
    // Let PHP serve static files directly
    return false;
}

// If directory request contains index.php
if (is_dir($targetFile) && is_file($targetFile . '/index.php')) {
    require_once $targetFile . '/index.php';
    exit;
}

// 404 Not Found fallback
http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
echo '<div style="font-family:sans-serif;padding:30px;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;border-radius:10px;margin:30px auto;max-width:600px;">';
echo '<h2 style="margin-top:0;">404 - Không tìm thấy trang</h2>';
echo '<p>Đường dẫn yêu cầu: <code>' . htmlspecialchars($uri) . '</code></p>';
echo '<p><a href="index.php" style="color:#0284c7;font-weight:bold;">Về trang bán hàng POS (index.php)</a> | <a href="admin.php" style="color:#0284c7;font-weight:bold;">Về trang quản trị (admin.php)</a></p>';
echo '</div>';
exit;

