<?php
/**
 * Customer Screen (Giao diện Dành Cho Khách Hàng - Mã USR)
 * Hiển thị tên quán, thông tin quảng cáo, ưu đãi & thực đơn điện tử
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/saas_helper.php';

// Kiểm tra quyền Module QR Order Khách Hàng từ Super Admin
enforceModuleAccess('qr_customer_order', 'index.php');

$pdo = Database::getConnection();
$tableOrderRequested = array_key_exists('table', $_GET);
$tableOrderToken = trim((string)($_GET['table'] ?? ''));
$tableOrderContext = null;
$tableOrderMessage = '';
if ($tableOrderRequested) {
    require_once __DIR__ . '/database/customer_experience_migration.php';
    runCustomerExperienceMigration($pdo);
    if (!preg_match('/^[a-f0-9]{64}$/', $tableOrderToken)) {
        $tableOrderMessage = 'Mã QR bàn không hợp lệ. Vui lòng quét lại mã hoặc báo nhân viên.';
    } elseif (!isModuleEnabled('qr_table_order', $pdo)) {
        $tableOrderMessage = 'Tính năng đặt món QR tại bàn chưa được kích hoạt. Vui lòng báo nhân viên.';
    } else {
        $tableStmt = $pdo->prepare("SELECT id, code, name FROM tables_areas WHERE table_order_token = :token AND area_type = 'TAI_QUAN' LIMIT 1");
        $tableStmt->execute([':token' => $tableOrderToken]);
        $tableOrderContext = $tableStmt->fetch(PDO::FETCH_ASSOC) ?: null;
        if (!$tableOrderContext) {
            $tableOrderMessage = 'Mã QR bàn không còn hoạt động. Vui lòng báo nhân viên để được hỗ trợ.';
        }
    }
}
$customerStoreSettings = [];
$settingsStmt = $pdo->query("SELECT setting_key, setting_value FROM store_settings WHERE setting_key LIKE 'customer_%' OR setting_key IN ('store_name', 'store_hotline', 'store_address', 'store_wifi', 'store_wifi_ssid', 'bank_id', 'bank_account_no', 'bank_account_name')");
foreach ($settingsStmt->fetchAll(PDO::FETCH_ASSOC) as $setting) {
    $customerStoreSettings[$setting['setting_key']] = $setting['setting_value'];
}

$storeName = $customerStoreSettings['store_name'] ?? STORE_NAME;
$storeLogoDataUri = licenseStoreLogoDataUri();
$storeHotline = $customerStoreSettings['store_hotline'] ?? STORE_HOTLINE;
$storeAddress = $customerStoreSettings['store_address'] ?? STORE_ADDRESS;
$storeWifi = $customerStoreSettings['store_wifi'] ?? (defined('STORE_WIFI') ? STORE_WIFI : '');
$storeWifiSsid = trim($customerStoreSettings['store_wifi_ssid'] ?? '');
$bankId = $customerStoreSettings['bank_id'] ?? VIETQR_BANK_ID;
$bankAccountNo = $customerStoreSettings['bank_account_no'] ?? VIETQR_ACCOUNT_NO;
$bankAccountName = $customerStoreSettings['bank_account_name'] ?? VIETQR_ACCOUNT_NAME;
$customerTagline = trim($customerStoreSettings['customer_tagline'] ?? '');
$customerDescription = trim($customerStoreSettings['customer_description'] ?? '');
$customerOpeningHours = trim($customerStoreSettings['customer_opening_hours'] ?? '');
$customerHeroImage = customerPublicUrl($customerStoreSettings['customer_hero_image'] ?? '');
$customerPromoTitle = trim($customerStoreSettings['customer_promo_title'] ?? '');
$customerPromoText = trim($customerStoreSettings['customer_promo_text'] ?? '');
$customerPromoCode = trim($customerStoreSettings['customer_promo_code'] ?? '');
$customerPromoStart = trim($customerStoreSettings['customer_promo_start'] ?? '');
$customerPromoEnd = trim($customerStoreSettings['customer_promo_end'] ?? '');
$customerPromoEnabled = ($customerStoreSettings['customer_promo_enabled'] ?? '0') === '1' && $customerPromoTitle !== '';
$today = date('Y-m-d');
if (($customerPromoStart !== '' && $today < $customerPromoStart) || ($customerPromoEnd !== '' && $today > $customerPromoEnd)) {
    $customerPromoEnabled = false;
}
$customerOrderEnabled = ($customerStoreSettings['customer_order_enabled'] ?? '1') !== '0';
$customerTableOrderEnabled = ($customerStoreSettings['customer_table_order_enabled'] ?? '1') !== '0';
if ($tableOrderContext !== null && !$customerTableOrderEnabled) {
    $tableOrderMessage = 'Đặt món QR tại bàn hiện đang tạm dừng. Vui lòng báo nhân viên.';
}
$canCustomerOrder = $tableOrderRequested
    ? ($tableOrderContext !== null && $customerTableOrderEnabled)
    : $customerOrderEnabled;
$customerAdsEnabled = isModuleEnabled('advertising_promotions', $pdo);
$customerVietQrEnabled = isModuleEnabled('vietqr_payment', $pdo);
$customerAdSlides = [];
if ($customerAdsEnabled) {
    $storedAdSlides = json_decode($customerStoreSettings['customer_ad_slides'] ?? '[]', true);
    if (is_array($storedAdSlides)) {
        foreach ($storedAdSlides as $slide) {
            if (!is_array($slide) || empty($slide['enabled'])) {
                continue;
            }
            if (!is_string($slide['media_path'] ?? null) || !is_string($slide['media_type'] ?? null)
                || !is_string($slide['title'] ?? null)) {
                continue;
            }
            $mediaPath = customerAdMediaPath($slide['media_path'], $slide['media_type']);
            if ($mediaPath === '') {
                continue;
            }
            $startsAt = is_string($slide['starts_at'] ?? null) ? trim($slide['starts_at']) : '';
            $endsAt = is_string($slide['ends_at'] ?? null) ? trim($slide['ends_at']) : '';
            if (($startsAt !== '' && $today < $startsAt) || ($endsAt !== '' && $today > $endsAt)) {
                continue;
            }
            $slide['media_path'] = $mediaPath;
            $slide['title'] = trim($slide['title']);
            if ($slide['title'] === '') {
                continue;
            }
            $slide['description'] = is_string($slide['description'] ?? null) ? trim($slide['description']) : '';
            $slide['label'] = is_string($slide['label'] ?? null) ? $slide['label'] : 'store';
            $slide['link_url'] = customerPublicUrl(is_string($slide['link_url'] ?? null) ? $slide['link_url'] : '');
            $slide['duration'] = max(4, min(20, (int)(filter_var($slide['duration'] ?? 6, FILTER_VALIDATE_INT) ?: 6)));
            $customerAdSlides[] = $slide;
        }
    }
    $customerAdSlides = array_values(array_merge(
        array_filter($customerAdSlides, static fn(array $slide): bool => $slide['media_type'] === 'image'),
        array_filter($customerAdSlides, static fn(array $slide): bool => $slide['media_type'] === 'video')
    ));
}
$customerSocialLinks = [
    'facebook' => customerPublicUrl($customerStoreSettings['customer_facebook_url'] ?? ''),
    'instagram' => customerPublicUrl($customerStoreSettings['customer_instagram_url'] ?? ''),
    'tiktok' => customerPublicUrl($customerStoreSettings['customer_tiktok_url'] ?? ''),
    'zalo' => customerPublicUrl($customerStoreSettings['customer_zalo_url'] ?? ''),
    'maps' => customerPublicUrl($customerStoreSettings['customer_google_maps_url'] ?? '')
];

function customerPublicUrl(string $url): string
{
    $url = trim($url);
    if (preg_match('~^/?assets/images/[A-Za-z0-9/_\-.]+$~', $url) && strpos($url, '..') === false) {
        return ltrim($url, '/');
    }
    if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL)) {
        return '';
    }
    $scheme = strtolower((string)parse_url($url, PHP_URL_SCHEME));
    return in_array($scheme, ['http', 'https'], true) ? $url : '';
}

function customerAdMediaPath(string $path, string $type): string
{
    if (!preg_match('~^uploads/advertisements/[a-f0-9]{32}\.(jpg|png|webp|mp4|webm)$~', $path, $matches)) {
        return '';
    }
    $isVideo = in_array($matches[1], ['mp4', 'webm'], true);
    if (($type === 'video') !== $isVideo || !is_file(__DIR__ . '/' . $path)) {
        return '';
    }
    return $path;
}

// Session status
$isLoggedIn = isset($_SESSION['user_id']);
$currentUser = $isLoggedIn ? [
    'id' => $_SESSION['user_id'],
    'user_code' => $_SESSION['user_code'] ?? 'USR001',
    'username' => $_SESSION['username'],
    'fullname' => $_SESSION['fullname'],
    'role' => $_SESSION['user_role']
] : null;

// Fetch categories & active products for digital menu
$categories = $pdo->query("SELECT * FROM categories WHERE status = 'active' ORDER BY sort_order ASC, id ASC")->fetchAll(PDO::FETCH_ASSOC);
$products = $pdo->query("SELECT * FROM products WHERE status = 'active' AND is_topping = 0 ORDER BY category_id ASC, id ASC")->fetchAll(PDO::FETCH_ASSOC);

?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title><?= htmlspecialchars($storeName) ?> - Thực đơn & ưu đãi</title>
    <meta name="description" content="<?= htmlspecialchars($customerDescription ?: $customerTagline ?: ('Thực đơn điện tử và thông tin ' . $storeName)) ?>">
    <meta property="og:title" content="<?= htmlspecialchars($storeName . ' - Thực đơn & ưu đãi') ?>">
    <meta property="og:description" content="<?= htmlspecialchars($customerPromoEnabled ? $customerPromoTitle . ': ' . $customerPromoText : ($customerDescription ?: $customerTagline)) ?>">
    <?php if ($customerHeroImage !== ''): ?><meta property="og:image" content="<?= htmlspecialchars($customerHeroImage, ENT_QUOTES, 'UTF-8') ?>"><?php endif; ?>
    <link rel="icon" href="favicon.php?v=<?= $storeLogoDataUri !== '' ? substr(hash('sha256', $storeLogoDataUri), 0, 16) : 'default' ?>">
    <link rel="manifest" href="customer.webmanifest">
    
    <!-- Local Precompiled Tailwind CSS (100% Offline, Instant Rendering) -->
    <link rel="stylesheet" href="assets/css/app-tailwind.min.css">
    <!-- Local FontAwesome 6 Icons (Offline) -->
    <link rel="stylesheet" href="assets/vendor/fontawesome/css/all.min.css">
    
    <!-- Liquid Glass Custom Styles -->
    <style>
        body {
            background: radial-gradient(circle at 50% 10%, #1e1b4b 0%, #0f172a 50%, #020617 100%);
            min-height: 100vh;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .liquid-glass {
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .liquid-card {
            background: rgba(30, 41, 59, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .liquid-card:hover {
            transform: translateY(-2px);
            border-color: rgba(56, 189, 248, 0.4);
            box-shadow: 0 10px 25px -5px rgba(14, 165, 233, 0.15);
        }
        #customer-cart-open {
            position: fixed;
            z-index: 40;
            right: 1rem;
            bottom: 1rem;
            display: flex;
            width: 3.5rem;
            height: 3.5rem;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255, 255, 255, 0.35);
            border-radius: 1rem;
            background: linear-gradient(135deg, #38bdf8, #0ea5e9 55%, #4f46e5);
            color: white;
            box-shadow: 0 14px 32px rgba(2, 6, 23, 0.55);
            transition: transform 180ms ease, box-shadow 180ms ease;
        }
        #customer-cart-open:hover {
            transform: translateY(-2px);
            box-shadow: 0 16px 36px rgba(14, 165, 233, 0.35);
        }
        #customer-cart-count {
            position: absolute;
            top: -0.375rem;
            right: -0.375rem;
            display: flex;
            min-width: 1.25rem;
            height: 1.25rem;
            align-items: center;
            justify-content: center;
            padding: 0 0.3rem;
            border: 2px solid #020617;
            border-radius: 9999px;
            background: #f43f5e;
            color: white;
            font-size: 0.65rem;
            font-weight: 900;
            line-height: 1;
        }
        #customer-cart-count.hidden {
            display: none !important;
        }
        #customer-cart-modal.flex {
            display: flex !important;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            background: rgba(2, 6, 23, 0.78);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }
        #customer-cart-modal .customer-cart-panel {
            position: relative;
            display: flex;
            width: min(440px, calc(100vw - 32px));
            max-width: 100%;
            max-height: min(84vh, 720px);
            flex-direction: column;
            overflow-x: hidden;
            overflow-y: auto;
            overscroll-behavior: contain;
            margin: auto;
            padding: 18px;
            border: 1px solid transparent;
            border-radius: 22px;
            background:
                linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(8, 15, 34, 0.98)) padding-box,
                linear-gradient(135deg, rgba(34, 211, 238, 0.9), rgba(99, 102, 241, 0.72) 55%, rgba(217, 70, 239, 0.58)) border-box;
            box-shadow:
                0 24px 70px rgba(2, 6, 23, 0.72),
                0 0 0 1px rgba(56, 189, 248, 0.1),
                0 0 32px rgba(34, 211, 238, 0.16);
            color: #f8fafc;
            scrollbar-width: thin;
            scrollbar-color: rgba(56, 189, 248, 0.38) transparent;
        }
        #customer-cart-modal .customer-cart-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.16);
        }
        #customer-cart-modal .customer-cart-title {
            display: flex;
            min-width: 0;
            align-items: center;
            gap: 10px;
        }
        #customer-cart-modal .customer-cart-title-icon {
            display: flex;
            width: 36px;
            height: 36px;
            flex: 0 0 auto;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(34, 211, 238, 0.32);
            border-radius: 12px;
            background: linear-gradient(145deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.16));
            color: #67e8f9;
            box-shadow: inset 0 0 14px rgba(34, 211, 238, 0.08), 0 0 14px rgba(34, 211, 238, 0.12);
        }
        #customer-cart-modal .customer-cart-title h3 {
            margin: 0;
            color: #f8fafc;
            font-size: 15px;
            font-weight: 850;
            line-height: 1.25;
        }
        #customer-cart-modal .customer-cart-title p {
            margin: 4px 0 0;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.4;
        }
        #customer-cart-modal .customer-cart-close {
            display: flex;
            width: 30px;
            height: 30px;
            flex: 0 0 auto;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(148, 163, 184, 0.16);
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.72);
            color: #94a3b8;
            font-size: 20px;
            line-height: 1;
            transition: all 160ms ease;
        }
        #customer-cart-modal .customer-cart-close:hover {
            border-color: rgba(34, 211, 238, 0.5);
            color: #e0f2fe;
            box-shadow: 0 0 14px rgba(34, 211, 238, 0.12);
        }
        #customer-cart-modal #customer-cart-items {
            max-height: min(28vh, 220px);
            overflow-y: auto;
            margin: 12px -2px 0;
            padding: 0 2px;
            scrollbar-width: thin;
            scrollbar-color: rgba(56, 189, 248, 0.38) transparent;
        }
        #customer-cart-modal #customer-cart-items > div {
            min-height: 58px;
            padding: 10px 11px;
            border-color: rgba(148, 163, 184, 0.13);
            border-radius: 13px;
            background: linear-gradient(110deg, rgba(30, 41, 59, 0.78), rgba(15, 23, 42, 0.8));
        }
        #customer-cart-modal #customer-cart-items > div b {
            font-size: 12px;
        }
        #customer-cart-modal #customer-cart-items > div span {
            color: #94a3b8;
            font-size: 10px;
        }
        #customer-cart-modal .customer-cart-summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 12px;
            padding: 11px 12px;
            border: 1px solid rgba(34, 211, 238, 0.16);
            border-radius: 13px;
            background: linear-gradient(100deg, rgba(8, 47, 73, 0.38), rgba(30, 41, 59, 0.55));
            font-size: 12px;
        }
        #customer-cart-modal #customer-cart-total {
            color: #6ee7b7;
            font-size: 14px;
        }
        #customer-cart-modal .customer-order-form {
            display: flex;
            flex-direction: column;
            gap: 9px;
            margin-top: 12px;
        }
        #customer-cart-modal .customer-order-form label {
            display: block;
            color: #cbd5e1;
            font-size: 11px;
            font-weight: 650;
        }
        #customer-cart-modal .customer-order-form input,
        #customer-cart-modal .customer-order-form textarea {
            display: block;
            width: 100%;
            min-height: 38px;
            margin-top: 5px;
            padding: 9px 11px;
            border: 1px solid rgba(100, 116, 139, 0.34);
            border-radius: 11px;
            outline: none;
            background: rgba(2, 6, 23, 0.62);
            color: #f8fafc;
            font: inherit;
            font-size: 12px;
            transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        #customer-cart-modal .customer-order-form textarea {
            min-height: 62px;
            resize: vertical;
        }
        #customer-cart-modal .customer-order-form input:focus,
        #customer-cart-modal .customer-order-form textarea:focus {
            border-color: rgba(34, 211, 238, 0.72);
            box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.1), 0 0 14px rgba(34, 211, 238, 0.1);
        }
        #customer-cart-modal .customer-order-hint {
            margin: 0;
            color: #64748b;
            font-size: 10px;
            line-height: 1.45;
        }
        #customer-cart-modal #customer-order-submit {
            min-height: 42px;
            margin-top: 2px;
            border: 1px solid rgba(103, 232, 249, 0.38);
            border-radius: 12px;
            background: linear-gradient(100deg, #0891b2, #2563eb 58%, #4f46e5);
            box-shadow: 0 7px 22px rgba(37, 99, 235, 0.2), inset 0 1px rgba(255, 255, 255, 0.18);
            color: white;
            font-size: 12px;
            font-weight: 800;
            transition: filter 160ms ease, transform 160ms ease, box-shadow 160ms ease;
        }
        #customer-cart-modal #customer-order-submit:hover:not(:disabled) {
            transform: translateY(-1px);
            filter: brightness(1.12);
            box-shadow: 0 9px 26px rgba(34, 211, 238, 0.22);
        }
        #customer-cart-modal #customer-order-error {
            margin: 0;
        }
        #customer-cart-modal .customer-payment-panel {
            margin-top: 14px;
            text-align: center;
        }
        #customer-cart-modal .customer-payment-qr {
            display: block;
            width: 208px;
            height: 208px;
            max-width: 100%;
            margin: 14px auto;
            padding: 8px;
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 16px;
            background: #fff;
            object-fit: contain;
        }
        #customer-cart-modal .customer-payment-details {
            padding: 11px 12px;
            border: 1px solid rgba(34, 211, 238, 0.16);
            border-radius: 13px;
            background: rgba(15, 23, 42, 0.72);
            color: #cbd5e1;
            font-size: 11px;
            line-height: 1.65;
            text-align: left;
        }
        #customer-cart-modal .customer-payment-actions {
            display: grid;
            gap: 8px;
            margin-top: 12px;
        }
        #customer-cart-modal .customer-payment-actions button {
            min-height: 38px;
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 11px;
            background: rgba(30, 41, 59, 0.72);
            color: #e2e8f0;
            font-size: 11px;
            font-weight: 750;
        }
        #customer-cart-modal .customer-payment-actions button:hover {
            border-color: rgba(34, 211, 238, 0.45);
            color: #e0f2fe;
        }
        @media (max-width: 600px) {
            #customer-cart-modal.flex {
                padding: 10px;
            }
            #customer-cart-modal .customer-cart-panel {
                width: min(100%, 440px);
                max-height: min(88vh, 760px);
                padding: 15px;
                border-radius: 20px;
            }
            #customer-cart-modal #customer-cart-items {
                max-height: 25vh;
            }
        }

        .btn-glass {
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            transition: all 0.2s;
        }
        .btn-glass:hover {
            background: rgba(255, 255, 255, 0.16);
            transform: translateY(-1px);
        }

        .liquid-blob {
            position: fixed;
            border-radius: 50%;
            filter: blur(90px);
            opacity: 0.18;
            pointer-events: none;
            z-index: 0;
        }

        .customer-ad-slide { opacity: 0; pointer-events: none; transition: opacity .8s ease, transform .8s ease; transform: scale(1.025); }
        .customer-ad-slide.is-active { opacity: 1; pointer-events: auto; transform: scale(1); }
        .customer-store-slide { isolation: isolate; background:radial-gradient(ellipse at 86% 12%,rgba(99,102,241,.24),transparent 40%),radial-gradient(ellipse at 70% 88%,rgba(14,165,233,.12),transparent 42%),linear-gradient(125deg,#111827 0%,#1e1b4b 58%,#25245b 100%); }
        .customer-store-backdrop { background:linear-gradient(100deg,rgba(8,13,31,.91) 0%,rgba(18,20,53,.79) 58%,rgba(20,23,58,.54) 100%),linear-gradient(0deg,rgba(8,12,30,.4),transparent 62%); }
        .customer-store-glow { position:absolute; width:12rem; height:12rem; border-radius:9999px; filter:blur(65px); opacity:.18; pointer-events:none; z-index:1; }
        .customer-store-glow-gold { right:9%; top:-7rem; background:#818cf8; }
        .customer-store-glow-violet { display:none; }
        .customer-store-title { color:#fff; text-shadow:0 2px 18px rgba(2,6,23,.55); }
        .customer-store-copy { color:#e2e8f0; text-shadow:0 2px 12px rgba(2,6,23,.8); }
        .customer-store-promo { border:1px solid rgba(129,140,248,.3); border-radius:.85rem; background:linear-gradient(105deg,rgba(30,41,90,.66),rgba(30,58,100,.42)); box-shadow:inset 0 1px rgba(255,255,255,.08),0 10px 24px rgba(2,6,23,.18); }
        .customer-store-actions { position:absolute; top:.75rem; right:.75rem; z-index:20; display:flex; gap:.45rem; }
        .customer-menu-toolbar { display:grid; grid-template-columns:minmax(0,1fr); align-items:center; gap:.65rem; }
        .customer-menu-heading { min-width:0; }
        .customer-menu-heading h3 { white-space:nowrap; }
        .customer-menu-search { width:100%; min-width:0; }
        .customer-menu-categories { min-width:0; max-width:100%; }
        @media (min-width:640px) { .customer-menu-toolbar { grid-template-columns:minmax(0,1.1fr) minmax(220px,.9fr); } .customer-menu-categories { grid-column:1 / -1; } }
        @media (min-width:1024px) { .customer-menu-toolbar { grid-template-columns:minmax(260px,1fr) minmax(220px,.8fr) minmax(0,1.8fr); } .customer-menu-categories { grid-column:auto; } .customer-menu-heading p { white-space:nowrap; } }
        @media (prefers-reduced-motion: reduce) { .customer-ad-slide { transition: none; transform: none; } }

        @media print {
            body { background: #fff !important; color: #0f172a !important; }
            body > .liquid-blob, header, footer, .no-print, #quick-vietqr-modal, #customer-cart-open,
            #customer-cart-modal, #customer-order-confirmation { display: none !important; }
            main { max-width: none !important; padding: 0 !important; }
            main > section { display: none !important; }
            main > section.print-promo { display: block !important; color: #0f172a !important; background: #fff !important; background-image: none !important; border: 1px solid #cbd5e1 !important; box-shadow: none !important; }
            .print-promo * { color: #0f172a !important; background-color: transparent !important; border-color: #cbd5e1 !important; box-shadow: none !important; backdrop-filter: none !important; }
            .print-promo .absolute, .print-promo button.no-print { display: none !important; }
        }
    </style>
    <link rel="stylesheet" href="assets/css/theme.css?v=4">
    <script src="assets/js/theme.js?v=3"></script>
</head>
<body class="antialiased flex flex-col min-h-screen relative overflow-x-hidden selection:bg-sky-500 selection:text-white">

    <!-- Ambient Glowing Blobs -->
    <div class="liquid-blob w-96 h-96 bg-purple-600 -top-20 -left-20"></div>
    <div class="liquid-blob w-96 h-96 bg-sky-600 top-1/3 -right-20"></div>
    <div class="liquid-blob w-96 h-96 bg-pink-600 bottom-10 left-1/4"></div>

    <!-- Header Navigation -->
    <header class="sticky top-0 z-40 liquid-glass border-b border-white/10 px-4 py-3 sm:px-8">
        <div class="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <!-- Brand -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white text-lg shadow-lg shadow-indigo-500/20 overflow-hidden">
                    <?php if ($storeLogoDataUri !== ''): ?>
                        <img src="<?= htmlspecialchars($storeLogoDataUri, ENT_QUOTES, 'UTF-8') ?>" alt="Logo quán" class="h-full w-full rounded-2xl bg-white p-0.5 object-contain" />
                    <?php else: ?>
                        <i class="fas fa-mug-hot"></i>
                    <?php endif; ?>
                </div>
                <div>
                    <h1 class="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                        <?= htmlspecialchars($storeName) ?>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider hidden sm:inline">Khách Hàng</span>
                    </h1>
                    <p class="text-[11px] text-slate-400 hidden sm:block"><?= htmlspecialchars($customerTagline ?: APP_SUBTITLE) ?></p>
                </div>
            </div>

            <!-- Wi-Fi & Contact Pill -->
            <div class="flex items-center gap-2">
                <?php if ($storeWifiSsid !== ''): ?>
                    <button type="button" onclick="showCustomerWifiQr()" class="btn-glass px-3 py-1.5 text-xs text-sky-200 hover:text-white flex items-center gap-1.5 font-bold" title="Quét mã để kết nối Wi-Fi">
                        <i class="fas fa-wifi text-sky-400"></i>
                        <span class="hidden sm:inline"><?= htmlspecialchars($storeWifiSsid) ?></span>
                        <span class="sm:hidden">Wi-Fi</span>
                        <i class="fas fa-qrcode text-[10px]"></i>
                    </button>
                <?php endif; ?>

                <a href="tel:<?= preg_replace('/[^0-9+]/', '', $storeHotline) ?>" class="btn-glass px-3 py-1.5 text-xs text-emerald-300 hover:text-white flex items-center gap-1.5 font-bold" title="Gọi Hotline">
                    <i class="fas fa-phone-alt"></i>
                    <span class="hidden sm:inline"><?= htmlspecialchars($storeHotline) ?></span>
                </a>

                <?php if ($isLoggedIn): ?>
                    <div class="flex items-center gap-1.5 pl-2 border-l border-white/10">
                        <span class="px-2.5 py-1 rounded-xl bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-bold flex items-center gap-1">
                            <i class="fas fa-user-circle"></i>
                            <span class="max-w-[120px] truncate"><?= htmlspecialchars($currentUser['fullname']) ?></span>
                        </span>
                        <?php if ($currentUser['role'] === 'admin'): ?>
                            <a href="admin.php" class="btn-glass px-2.5 py-1 text-xs text-indigo-300" title="Trang Quản Trị">
                                <i class="fas fa-chart-pie"></i>
                            </a>
                        <?php endif; ?>
                        <button type="button" onclick="handleLogout()" class="w-8 h-8 rounded-xl btn-glass bg-rose-500/20 text-rose-300 hover:text-white flex items-center justify-center p-0" title="Đăng xuất">
                            <i class="fas fa-sign-out-alt text-xs"></i>
                        </button>
                    </div>
                <?php else: ?>
                    <a href="index.php" class="btn-glass px-3 py-1.5 text-xs text-sky-300 hover:text-white font-bold flex items-center gap-1">
                        <i class="fas fa-sign-in-alt"></i>
                        <span>Đăng Nhập</span>
                    </a>
                <?php endif; ?>
            </div>
        </div>
    </header>

    <!-- Main Content Container -->
    <main class="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6 z-10">
        <?php if ($tableOrderContext !== null): ?>
            <section class="rounded-2xl border border-sky-400/25 bg-gradient-to-r from-sky-950/80 via-slate-900/85 to-indigo-950/80 px-4 py-3 shadow-lg shadow-sky-950/20">
                <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300"><i class="fas fa-chair"></i></span>
                    <div class="min-w-0">
                        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Đặt món tại bàn</p>
                        <h2 class="truncate text-sm font-black text-white"><?= htmlspecialchars($tableOrderContext['name']) ?> <span class="text-slate-400">(<?= htmlspecialchars($tableOrderContext['code']) ?>)</span></h2>
                    </div>
                    <?php if ($canCustomerOrder): ?>
                        <span class="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-slate-300"><i class="fas fa-receipt text-emerald-300"></i> Món sẽ cộng vào hóa đơn bàn</span>
                    <?php else: ?>
                        <span class="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold text-amber-200">Đang tạm dừng</span>
                    <?php endif; ?>
                </div>
                <?php if (!$canCustomerOrder): ?><p class="mt-2 text-xs text-amber-200"><?= htmlspecialchars($tableOrderMessage) ?></p><?php endif; ?>
            </section>
        <?php elseif ($tableOrderRequested): ?>
            <section role="status" class="rounded-2xl border border-amber-400/25 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
                <i class="fas fa-circle-exclamation mr-2 text-amber-300"></i><?= htmlspecialchars($tableOrderMessage) ?>
            </section>
        <?php endif; ?>
        
        <!-- Hero Promotional Banner -->
        <section class="print-promo liquid-glass rounded-3xl p-6 sm:p-8 border border-white/15 relative overflow-hidden shadow-2xl" <?= $customerHeroImage !== '' ? 'style="background-image:linear-gradient(90deg,rgba(2,6,23,.94),rgba(2,6,23,.76)),url(&quot;' . htmlspecialchars($customerHeroImage, ENT_QUOTES, 'UTF-8') . '&quot;);background-size:cover;background-position:center"' : '' ?>>
            <div class="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
            <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <?php if ($customerAdSlides): ?>
                    <div id="customer-ad-carousel" class="relative min-h-[280px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-inner sm:min-h-[320px]" aria-roledescription="carousel" aria-label="Quảng cáo và khuyến mãi">
                        <article class="customer-ad-slide customer-store-slide is-active absolute inset-0" data-ad-index="0" data-ad-duration="6" aria-hidden="false" aria-label="Thông tin quán">
                            <?php if ($customerHeroImage !== ''): ?><img class="absolute inset-0 h-full w-full object-cover" src="<?= htmlspecialchars($customerHeroImage, ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($storeName, ENT_QUOTES, 'UTF-8') ?>" /><?php endif; ?>
                            <div class="customer-store-backdrop absolute inset-0"></div>
                            <div class="customer-store-glow customer-store-glow-gold"></div>
                            <div class="relative z-10 flex h-full min-h-[280px] max-w-2xl flex-col items-start justify-center px-5 pb-16 pt-6 sm:min-h-[320px] sm:px-8 sm:pb-16 sm:pt-8">
                                <?php if ($customerPromoEnabled): ?>
                                    <span class="inline-flex items-center gap-2 rounded-full border border-amber-200/45 bg-amber-900/35 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.16em] text-amber-100 shadow-lg shadow-black/20 backdrop-blur-md"><i class="fas fa-sparkles text-amber-300"></i><?= htmlspecialchars($customerPromoTitle) ?></span>
                                <?php else: ?>
                                    <span class="inline-flex items-center gap-2 rounded-full border border-indigo-200/35 bg-indigo-950/45 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.16em] text-indigo-100 shadow-lg shadow-black/20 backdrop-blur-md"><i class="fas fa-store text-sky-300"></i>Chào mừng đến <?= htmlspecialchars($storeName) ?></span>
                                <?php endif; ?>
                                <h2 class="customer-store-title mt-4 max-w-xl text-xl font-extrabold leading-tight sm:text-3xl"><?= htmlspecialchars($customerTagline ?: ('Khám phá hương vị tại ' . $storeName)) ?></h2>
                                <div class="mt-3 h-px w-14 bg-gradient-to-r from-sky-300/90 via-indigo-300/60 to-transparent"></div>
                                <p class="customer-store-copy mt-3 max-w-lg whitespace-pre-line text-xs leading-relaxed sm:text-sm"><?= htmlspecialchars($customerDescription ?: 'Khám phá thực đơn, chọn món yêu thích và đặt mang về trực tiếp với quán.') ?></p>
                                <?php if ($customerPromoEnabled && $customerPromoText !== ''): ?>
                                    <p class="customer-store-promo mt-3 max-w-lg whitespace-pre-line px-3.5 py-2 text-xs font-semibold leading-relaxed text-amber-50"><i class="fas fa-gift mr-1 text-amber-300"></i><?= htmlspecialchars($customerPromoText) ?><?php if ($customerPromoCode !== ''): ?> <button type="button" data-promo-code="<?= htmlspecialchars($customerPromoCode, ENT_QUOTES, 'UTF-8') ?>" class="font-black text-amber-200 underline decoration-amber-300/60 underline-offset-2" onclick="copyPromoCode(this.dataset.promoCode)">Mã: <?= htmlspecialchars($customerPromoCode) ?> · Sao chép</button><?php endif; ?></p>
                                <?php endif; ?>
                                <div class="customer-store-actions no-print">
                                    <button type="button" onclick="shareStore()" aria-label="Chia sẻ quán" title="Chia sẻ quán" class="btn-glass flex h-9 w-9 items-center justify-center rounded-full border border-sky-200/25 bg-slate-950/45 text-sm text-sky-100 shadow-lg shadow-black/15 backdrop-blur-md transition hover:bg-sky-900/45"><i class="fas fa-share-nodes"></i></button>
                                    <button type="button" onclick="window.print()" aria-label="In tờ giới thiệu" title="In tờ giới thiệu" class="btn-glass flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200/25 bg-slate-950/40 text-sm text-indigo-100 shadow-lg shadow-black/10 backdrop-blur-md transition hover:bg-indigo-900/40"><i class="fas fa-print"></i></button>
                                </div>
                            </div>
                        </article>
                        <?php foreach ($customerAdSlides as $slideIndex => $slide): ?>
                            <?php $index = $slideIndex + 1; ?>
                            <?php
                                $adTitle = trim((string)($slide['title'] ?? ''));
                                $adDescription = trim((string)($slide['description'] ?? ''));
                                $adLabel = (string)($slide['label'] ?? 'store');
                                $adLabelText = ['store' => 'THÔNG TIN QUÁN', 'KM1' => 'ƯU ĐÃI KM1', 'KM2' => 'ƯU ĐÃI KM2', 'QC1' => 'QUẢNG CÁO QC1', 'QC2' => 'QUẢNG CÁO QC2'][$adLabel] ?? $adLabel;
                            ?>
                            <article class="customer-ad-slide absolute inset-0 <?= $index === 0 ? 'is-active' : '' ?>" data-ad-index="<?= $index ?>" data-ad-duration="<?= (int)$slide['duration'] ?>" aria-hidden="<?= $index === 0 ? 'false' : 'true' ?>">
                                <?php if ($slide['media_type'] === 'video'): ?>
                                    <video class="absolute inset-0 h-full w-full object-cover" src="<?= htmlspecialchars($slide['media_path'], ENT_QUOTES, 'UTF-8') ?>" muted playsinline preload="<?= $index === 0 ? 'metadata' : 'none' ?>"></video>
                                    <button type="button" class="customer-ad-sound absolute right-3 top-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-slate-950/70 text-sm text-white shadow-lg backdrop-blur-md transition hover:bg-slate-950/90" onclick="toggleCustomerAdSound()" aria-label="Bật âm thanh video" title="Bật tiếng" aria-pressed="false">
                                        <i class="fas fa-volume-xmark" aria-hidden="true"></i>
                                    </button>
                                <?php else: ?>
                                    <img class="absolute inset-0 h-full w-full object-cover" src="<?= htmlspecialchars($slide['media_path'], ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($adTitle, ENT_QUOTES, 'UTF-8') ?>" loading="<?= $index === 0 ? 'eager' : 'lazy' ?>" />
                                <?php endif; ?>
                                <div class="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/65 to-slate-950/10"></div>
                                <div class="relative z-10 flex h-full min-h-[280px] max-w-2xl flex-col items-start justify-center p-5 sm:min-h-[320px] sm:p-8">
                                    <span class="inline-flex items-center gap-2 rounded-full border border-fuchsia-200/30 bg-fuchsia-500/20 px-3 py-1 text-[9px] font-black uppercase tracking-[.18em] text-fuchsia-100 shadow-lg shadow-fuchsia-950/30">
                                        <i class="fas fa-sparkles"></i><?= htmlspecialchars($adLabelText) ?>
                                    </span>
                                    <h2 class="mt-4 max-w-xl text-2xl font-black leading-tight text-white drop-shadow-lg sm:text-4xl"><?= htmlspecialchars($adTitle) ?></h2>
                                    <?php if ($adDescription !== ''): ?><p class="mt-3 max-w-lg whitespace-pre-line text-xs leading-relaxed text-white/85 drop-shadow sm:text-sm"><?= htmlspecialchars($adDescription) ?></p><?php endif; ?>
                                    <?php if ($slide['link_url'] !== ''): ?><a href="<?= htmlspecialchars($slide['link_url'], ENT_QUOTES, 'UTF-8') ?>" target="_blank" rel="noopener noreferrer" class="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-4 py-2.5 text-xs font-black text-white shadow-xl backdrop-blur-md transition hover:bg-white/25"><i class="fas fa-arrow-up-right-from-square"></i>Khám phá ngay</a><?php endif; ?>
                                </div>
                            </article>
                        <?php endforeach; ?>
                        <?php if (count($customerAdSlides) > 0): ?>
                            <div class="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 p-3 sm:p-4">
                                <div id="customer-ad-dots" class="flex items-center gap-1.5" aria-label="Chọn slide quảng cáo">
                                    <button type="button" class="customer-ad-dot h-1.5 w-7 rounded-full bg-white transition-all" aria-label="Thông tin quán" aria-current="true" onclick="showCustomerAdSlide(0)"></button>
                                    <?php foreach ($customerAdSlides as $slideIndex => $_slide): ?><?php $index = $slideIndex + 1; ?><button type="button" class="customer-ad-dot h-1.5 w-2 rounded-full bg-white/45 transition-all" aria-label="Đến slide <?= $index + 1 ?>" aria-current="false" onclick="showCustomerAdSlide(<?= $index ?>)"></button><?php endforeach; ?>
                                </div>
                                <div class="flex gap-1.5">
                                    <button id="customer-ad-toggle" type="button" onclick="toggleCustomerAdPlayback()" aria-label="Tạm dừng trình chiếu" aria-pressed="false" class="h-8 w-8 rounded-full border border-white/20 bg-slate-950/45 text-xs text-white backdrop-blur hover:bg-white/20"><i class="fas fa-pause"></i></button>
                                    <button type="button" onclick="changeCustomerAdSlide(-1)" aria-label="Slide trước" class="h-8 w-8 rounded-full border border-white/20 bg-slate-950/45 text-xs text-white backdrop-blur hover:bg-white/20"><i class="fas fa-chevron-left"></i></button>
                                    <button type="button" onclick="changeCustomerAdSlide(1)" aria-label="Slide tiếp theo" class="h-8 w-8 rounded-full border border-white/20 bg-slate-950/45 text-xs text-white backdrop-blur hover:bg-white/20"><i class="fas fa-chevron-right"></i></button>
                                </div>
                            </div>
                        <?php endif; ?>
                    </div>
                <?php else: ?>
                <div class="space-y-3 max-w-2xl">
                    <?php if ($customerPromoEnabled): ?>
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                            <i class="fas fa-sparkles"></i> <?= htmlspecialchars($customerPromoTitle) ?>
                        </div>
                    <?php else: ?>
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-bold uppercase tracking-wider">
                            <i class="fas fa-store"></i> Chào mừng bạn đến với <?= htmlspecialchars($storeName) ?>
                        </div>
                    <?php endif; ?>
                    <h2 class="text-2xl sm:text-4xl font-black text-white leading-tight">
                        <?= htmlspecialchars($customerTagline ?: ('Khám phá hương vị tại ' . $storeName)) ?>
                    </h2>
                    <p class="text-sm sm:text-base text-slate-300 leading-relaxed">
                        <?= nl2br(htmlspecialchars($customerDescription ?: 'Khám phá thực đơn, chọn món yêu thích và đặt mang về trực tiếp với quán.')) ?>
                    </p>
                    <div class="flex flex-wrap items-center gap-2 pt-2">
                        <?php if ($customerPromoEnabled && $customerPromoText !== ''): ?>
                            <div class="text-xs font-semibold text-amber-100 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/25 max-w-xl">
                                <i class="fas fa-gift text-amber-300 mr-1"></i><?= nl2br(htmlspecialchars($customerPromoText)) ?>
                                <?php if ($customerPromoCode !== ''): ?><button type="button" data-promo-code="<?= htmlspecialchars($customerPromoCode, ENT_QUOTES, 'UTF-8') ?>" class="ml-2 underline text-amber-300" onclick="copyPromoCode(this.dataset.promoCode)">Mã: <?= htmlspecialchars($customerPromoCode) ?> · Sao chép</button><?php endif; ?>
                                <?php if ($customerPromoStart !== '' || $customerPromoEnd !== ''): ?><span class="block text-[10px] text-amber-200/70 mt-1">Hiệu lực: <?= htmlspecialchars($customerPromoStart ?: 'nay') ?> – <?= htmlspecialchars($customerPromoEnd ?: 'đến khi có thông báo') ?></span><?php endif; ?>
                            </div>
                        <?php endif; ?>
                        <button type="button" onclick="shareStore()" class="no-print btn-glass px-3 py-2 text-xs font-bold text-sky-200"><i class="fas fa-share-nodes mr-1"></i>Chia sẻ quán</button>
                        <button type="button" onclick="window.print()" class="no-print btn-glass px-3 py-2 text-xs font-bold text-amber-200"><i class="fas fa-print mr-1"></i>In tờ giới thiệu</button>
                    </div>
                </div>
                <?php endif; ?>

                <!-- Fast Contact & Info Card -->
                <div class="shrink-0 p-4 rounded-2xl bg-slate-900/80 border border-white/10 text-center space-y-2 min-w-[220px]">
                    <div class="text-xs text-slate-400 uppercase tracking-wider font-semibold">Địa chỉ quán</div>
                    <div class="text-xs font-bold text-white"><?= htmlspecialchars($storeAddress) ?></div>
                    <div class="border-t border-white/10 pt-2 text-xs text-slate-400">
                        Giờ mở cửa: <b class="text-emerald-400"><?= htmlspecialchars($customerOpeningHours ?: 'Vui lòng liên hệ quán') ?></b>
                    </div>
                    <?php if ($customerSocialLinks['maps'] !== ''): ?><a href="<?= htmlspecialchars($customerSocialLinks['maps'], ENT_QUOTES, 'UTF-8') ?>" target="_blank" rel="noopener noreferrer" class="block text-xs text-sky-300 hover:text-white"><i class="fas fa-map-location-dot mr-1"></i>Chỉ đường đến quán</a><?php endif; ?>
                    <?php if ($customerVietQrEnabled): ?>
                    <div class="pt-1">
                        <button type="button" onclick="showQuickVietQr()" class="no-print w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/20 hover:opacity-95">
                            <i class="fas fa-qrcode"></i> Mã Thanh Toán VietQR
                        </button>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
        </section>

        <section class="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/20 bg-slate-900/70 px-3 py-2 text-xs">
            <div class="flex items-center gap-2"><span id="customer-connection-dot" class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span><span id="customer-connection-text" class="text-slate-300">Đang kết nối · Thực đơn sẽ được lưu để xem offline</span></div>
            <div class="flex items-center gap-3"><button type="button" id="customer-track-order-button" class="hidden text-emerald-300 hover:text-white font-semibold" onclick="openCustomerOrderStatus()"><i class="fas fa-receipt mr-1"></i>Tra cứu đơn gần nhất</button><button type="button" id="customer-install-button" class="hidden text-sky-300 hover:text-white font-semibold" onclick="installCustomerApp()"><i class="fas fa-download mr-1"></i>Cài lên màn hình</button></div>
        </section>

        <!-- Digital Menu Section -->
        <section class="space-y-4">
            <div class="customer-menu-toolbar pb-2 border-b border-white/10">
                <div class="customer-menu-heading">
                    <h3 class="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                        <i class="fas fa-book-open text-sky-400"></i> THỰC ĐƠN ĐIỆN TỬ
                    </h3>
                    <p class="text-xs text-slate-400">Menu được cập nhật từ quán · Giá hiển thị bằng VNĐ</p>
                </div>
                <label class="customer-menu-search relative">
                    <i class="fas fa-search absolute left-3 top-2.5 text-slate-500 text-xs"></i>
                    <input id="menu-search" type="search" class="w-full rounded-xl bg-slate-900/80 border border-white/10 py-2 pl-8 pr-3 text-xs text-white outline-none focus:border-sky-400" placeholder="Tìm món trong thực đơn..." oninput="filterMenuSearch(this.value)" />
                </label>

                <!-- Category Filter Pills -->
                <div class="customer-menu-categories flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none" id="category-filter-pills">
                    <button type="button" onclick="filterMenuCategory(0)" class="cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500 text-white shadow-md transition-all shrink-0">
                        Tất Cả (<?= count($products) ?>)
                    </button>
                    <?php foreach ($categories as $cat): ?>
                        <?php 
                            $countCat = count(array_filter($products, fn($p) => $p['category_id'] == $cat['id']));
                            if ($countCat === 0) continue;
                        ?>
                        <button type="button" onclick="filterMenuCategory(<?= $cat['id'] ?>)" class="cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-all shrink-0">
                            <?= htmlspecialchars($cat['name']) ?> (<?= $countCat ?>)
                        </button>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Products Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4" id="products-grid">
                <?php foreach ($products as $productIndex => $p): ?>
                    <div class="product-item liquid-card rounded-2xl p-3 flex flex-col justify-between" data-product-id="<?= (int)$p['id'] ?>" data-product-name="<?= htmlspecialchars($p['name'], ENT_QUOTES, 'UTF-8') ?>" data-product-price="<?= (float)$p['sale_price'] ?>" data-category-id="<?= (int)$p['category_id'] ?>">
                        <div class="space-y-2">
                            <!-- Product Image: 4:3 Aspect Ratio for Full View -->
                            <div class="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-white/10 group-hover:scale-105 transition-all flex items-center justify-center">
                                <img src="<?= !empty($p['image']) ? htmlspecialchars($p['image']) : 'assets/images/dishes/default_dish.jpg' ?>" alt="<?= htmlspecialchars($p['name']) ?>" class="w-full h-full object-cover object-center" width="640" height="480" onerror="this.onerror=null;this.src='assets/images/dishes/default_dish.jpg';" loading="<?= $productIndex < 10 ? 'eager' : 'lazy' ?>" decoding="async" fetchpriority="<?= $productIndex < 5 ? 'high' : 'auto' ?>" />
                                <div class="absolute top-1.5 left-1.5">
                                    <span class="text-[10px] font-mono text-sky-400 font-bold bg-slate-950/85 backdrop-blur-md px-1.5 py-0.5 rounded border border-sky-500/30 shadow"><?= htmlspecialchars($p['code']) ?></span>
                                </div>
                            </div>
                            
                            <div>
                                <h4 class="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug"><?= htmlspecialchars($p['name']) ?></h4>
                            </div>
                        </div>

                        <div class="pt-2 mt-2 border-t border-white/10 flex items-center justify-between">
                            <span class="text-xs text-slate-400 font-medium">/ <?= htmlspecialchars($p['unit']) ?></span>
                            <span class="text-sm sm:text-base font-black font-mono text-emerald-400"><?= number_format($p['sale_price'], 0, ',', '.') ?> đ</span>
                        </div>
                        <?php if ($canCustomerOrder): ?>
                            <button type="button" onclick="addCustomerCartItem(<?= (int)$p['id'] ?>)" class="mt-2 w-full rounded-xl bg-sky-500/15 border border-sky-400/25 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/30">
                                <i class="fas fa-plus mr-1"></i>Thêm vào giỏ
                            </button>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>

        <?php if (array_filter($customerSocialLinks)): ?>
            <section class="liquid-glass rounded-2xl p-4 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div><h3 class="text-sm font-bold text-white"><i class="fas fa-heart text-rose-400 mr-1"></i>Kết nối với <?= htmlspecialchars($storeName) ?></h3><p class="text-xs text-slate-400 mt-1">Theo dõi món mới, hoạt động và ưu đãi trên các kênh chính thức.</p></div>
                <div class="flex flex-wrap gap-2">
                    <?php foreach (['facebook' => ['Facebook', 'fab fa-facebook'], 'zalo' => ['Zalo', 'fas fa-comment-dots'], 'instagram' => ['Instagram', 'fab fa-instagram'], 'tiktok' => ['TikTok', 'fab fa-tiktok']] as $social => $details): ?>
                        <?php if ($customerSocialLinks[$social] !== ''): ?><a href="<?= htmlspecialchars($customerSocialLinks[$social], ENT_QUOTES, 'UTF-8') ?>" target="_blank" rel="noopener noreferrer" class="btn-glass px-3 py-2 text-xs text-slate-200"><i class="<?= $details[1] ?> mr-1"></i><?= $details[0] ?></a><?php endif; ?>
                    <?php endforeach; ?>
                </div>
            </section>
        <?php endif; ?>
    </main>

    <!-- Footer -->
    <footer class="mt-auto border-t border-white/10 liquid-glass py-5 px-4 text-center text-xs text-slate-500 z-10">
        <div class="max-w-6xl mx-auto space-y-1">
            <div class="font-bold text-slate-400"><?= htmlspecialchars($storeName) ?> • Hotline: <?= htmlspecialchars($storeHotline) ?></div>
            <div><?= htmlspecialchars($storeAddress) ?></div>
            <div class="text-[11px] text-slate-600 pt-1">Hệ thống POS Liquid Glass • Phiên bản <?= htmlspecialchars(APP_VERSION) ?></div>
        </div>
    </footer>

    <?php if ($canCustomerOrder): ?>
        <button id="customer-cart-open" type="button" onclick="openCustomerCart()" aria-label="Mở giỏ hàng" title="Giỏ hàng">
            <i class="fas fa-cart-shopping text-xl" aria-hidden="true"></i>
            <span id="customer-cart-count" class="hidden">0</span>
        </button>
        <div id="customer-cart-modal" class="fixed inset-0 z-50 hidden items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="customer-cart-title">
            <div id="customer-cart-panel" class="customer-cart-panel">
                <div class="customer-cart-header">
                    <div class="customer-cart-title">
                        <span class="customer-cart-title-icon"><i class="<?= $tableOrderContext ? 'fas fa-cart-shopping' : 'fas fa-bag-shopping' ?>" aria-hidden="true"></i></span>
                        <div>
                            <h3 id="customer-cart-title"><?= $tableOrderContext ? 'Đặt món tại ' . htmlspecialchars($tableOrderContext['name']) : 'Đơn mang về' ?></h3>
                            <p><?= $tableOrderContext ? 'Món sẽ được cộng vào hóa đơn bàn.' : 'Quán sẽ liên hệ xác nhận đơn hàng.' ?></p>
                        </div>
                    </div>
                    <button type="button" onclick="closeCustomerCart()" aria-label="Đóng giỏ hàng" class="customer-cart-close">&times;</button>
                </div>
                <div id="customer-cart-checkout">
                    <div id="customer-cart-items" class="space-y-2"></div>
                    <div class="customer-cart-summary"><span class="text-slate-300">Tạm tính</span><b id="customer-cart-total" class="font-mono">0 đ</b></div>
                    <form id="customer-order-form" onsubmit="submitCustomerOrder(event)" class="customer-order-form">
                        <?php if (!$tableOrderContext): ?>
                            <label class="block text-xs text-slate-300">Tên người nhận<input id="customer-order-name" maxlength="100" required class="mt-1 w-full rounded-xl bg-slate-950/70 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Tên của bạn" /></label>
                            <label class="block text-xs text-slate-300">Số điện thoại liên hệ<input id="customer-order-phone" maxlength="30" type="tel" required class="mt-1 w-full rounded-xl bg-slate-950/70 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Số điện thoại" /></label>
                        <?php endif; ?>
                        <label class="block text-xs text-slate-300">Ghi chú<textarea id="customer-order-note" maxlength="500" rows="2" class="mt-1 w-full rounded-xl bg-slate-950/70 border border-white/10 px-3 py-2 text-sm text-white" placeholder="<?= $tableOrderContext ? 'Ít đường, không đá, lưu ý món...' : 'Thời gian nhận dự kiến, lưu ý đơn hàng...' ?>"></textarea></label>
                        <p class="customer-order-hint"><?= $tableOrderContext ? 'Đơn được cộng vào hóa đơn bàn; có thể thanh toán bằng QR hoặc tại quầy.' : 'Thông tin chỉ dùng xác nhận đơn; gửi đơn không đồng nghĩa đã thanh toán.' ?></p>
                        <button id="customer-order-submit" type="submit"><i class="fas fa-paper-plane mr-1"></i>Gửi đơn đến quán</button>
                        <p id="customer-order-error" class="hidden text-xs text-rose-300"></p>
                    </form>
                </div>
                <section id="customer-order-payment" class="customer-payment-panel hidden" aria-live="polite">
                    <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 text-lg text-emerald-300"><i class="fas fa-check" aria-hidden="true"></i></div>
                    <h4 class="mt-3 text-base font-black text-white"><?= $tableOrderContext ? 'Đã gửi yêu cầu tới phục vụ' : 'Quán đã nhận đơn' ?></h4>
                    <p class="mt-1 text-xs text-slate-400">Mã đơn <b id="customer-payment-order-code" class="text-sky-300"></b></p>
                    <p id="customer-payment-total" class="mt-2 text-lg font-black text-emerald-300"></p>
                    <img id="customer-payment-qr" class="customer-payment-qr hidden" alt="Mã QR thanh toán VietQR" />
                    <p id="customer-payment-paid" class="hidden mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200">Quán đã xác nhận thanh toán. Bạn không cần chuyển thêm.</p>
                    <p id="customer-payment-qr-error" class="hidden my-3 text-xs text-amber-300"></p>
                    <div class="customer-payment-details">
                        <div>Ngân hàng: <b id="customer-payment-bank" class="text-white"></b></div>
                        <div>Số tài khoản: <b id="customer-payment-account" class="text-sky-300"></b></div>
                        <div>Chủ tài khoản: <b id="customer-payment-account-name" class="text-emerald-300"></b></div>
                        <div>Nội dung chuyển khoản: <b id="customer-payment-note" class="text-white"></b></div>
                    </div>
                    <p class="mt-3 text-[10px] leading-relaxed text-slate-400">Quét mã để chuyển khoản đúng số tiền. Đơn chỉ được xác nhận thanh toán sau khi quán kiểm tra giao dịch.</p>
                    <p id="customer-payment-status" class="mt-2 rounded-xl bg-slate-900/80 p-2 text-[11px] text-slate-300">Đang chờ quán xác nhận đơn.</p>
                    <div class="customer-payment-actions">
                        <button type="button" onclick="checkCustomerOrderStatus()"><i class="fas fa-rotate mr-1"></i>Cập nhật trạng thái đơn</button>
                        <button type="button" onclick="resetCustomerPayment()"><i class="fas fa-plus mr-1"></i>Đặt đơn mới</button>
                    </div>
                </section>
            </div>
        </div>
        <div id="customer-order-confirmation" class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md hidden items-center justify-center p-4">
            <div class="liquid-glass rounded-3xl p-6 w-full max-w-md border border-emerald-500/30 text-center space-y-3">
                <div class="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center text-xl"><i class="fas fa-check"></i></div>
                <h3 class="text-lg font-black text-white">Đã gửi yêu cầu đặt món</h3>
                <p class="text-xs text-slate-300">Mã đơn <b id="customer-order-code" class="text-sky-300"></b>. <?= $tableOrderContext ? 'Phục vụ sẽ kiểm tra đơn và chuyển món vào bếp.' : 'Quán sẽ liên hệ xác nhận.' ?></p>
                <div id="customer-order-status" class="rounded-xl bg-slate-900 p-3 text-xs text-slate-300">Đang chờ quán xác nhận</div>
                <button type="button" onclick="checkCustomerOrderStatus()" class="btn-glass w-full py-2 text-xs font-bold text-sky-200">Cập nhật trạng thái</button>
                <button type="button" onclick="closeCustomerOrderConfirmation()" class="btn-glass w-full py-2 text-xs text-slate-300">Đóng</button>
            </div>
        </div>
    <?php endif; ?>

    <?php if ($storeWifiSsid !== ''): ?>
        <div id="customer-wifi-qr-modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="customer-wifi-qr-title">
            <div class="liquid-glass w-full max-w-sm rounded-3xl border border-sky-400/25 p-5 text-center shadow-2xl">
                <div class="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 id="customer-wifi-qr-title" class="font-black text-white"><i class="fas fa-wifi mr-2 text-sky-300"></i>Kết nối Wi-Fi</h3>
                    <button type="button" onclick="closeCustomerWifiQr()" aria-label="Đóng" class="text-2xl text-slate-400 hover:text-white">&times;</button>
                </div>
                <p class="mt-4 text-sm font-bold text-sky-100"><?= htmlspecialchars($storeWifiSsid) ?></p>
                <div id="customer-wifi-qr" class="mx-auto mt-4 flex min-h-56 w-56 items-center justify-center rounded-2xl bg-white p-3"></div>
                <p id="customer-wifi-qr-error" class="hidden mt-3 text-xs text-rose-300"></p>
                <p class="mt-3 text-[11px] text-slate-400">Mở camera và quét mã để kết nối. Thông tin Wi-Fi được mã hóa ngay trên thiết bị.</p>
            </div>
        </div>
    <?php endif; ?>

    <?php if ($customerVietQrEnabled): ?>
    <!-- Quick VietQR Modal -->
    <div id="quick-vietqr-modal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 opacity-0 pointer-events-none transition-all duration-300">
        <div class="liquid-glass rounded-3xl p-6 w-96 max-w-[92vw] text-center border border-sky-500/30 space-y-4 shadow-2xl">
            <div class="flex justify-between items-center pb-2 border-b border-white/10">
                <h3 class="font-bold text-sm text-sky-400 flex items-center gap-2">
                    <i class="fas fa-qrcode"></i> Thanh Toán VietQR Quán
                </h3>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="closeQuickVietQr()">&times;</button>
            </div>
            <?php endif; ?>
            
            <p class="text-xs text-slate-300">Quét mã bằng ứng dụng Ngân hàng (MB, VCB, BIDV, Techcombank, MoMo,...):</p>
            
            <?php if (trim($bankId) !== '' && trim($bankAccountNo) !== '' && trim($bankAccountName) !== ''): ?>
            <div class="bg-white p-3 rounded-2xl inline-block shadow-xl border border-slate-200">
                <?php
                    $bankQrUrl = sprintf(
                            "https://img.vietqr.io/image/%s-%s-compact2.png?amount=0&addInfo=%s&accountName=%s",
                            urlencode($bankId),
                            urlencode($bankAccountNo),
                        urlencode("THANH TOAN"),
                            urlencode($bankAccountName)
                    );
                ?>
                <img src="<?= $bankQrUrl ?>" alt="VietQR" class="w-56 h-56 mx-auto object-contain" />
            </div>

            <div class="text-xs text-left p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-1 font-mono">
                <div>Ngân hàng: <b class="text-slate-200"><?= htmlspecialchars($bankId) ?> Bank</b></div>
                <div>Số tài khoản: <b class="text-sky-400"><?= htmlspecialchars($bankAccountNo) ?></b></div>
                <div>Chủ tài khoản: <b class="text-emerald-400"><?= htmlspecialchars($bankAccountName) ?></b></div>
            </div>
            <?php else: ?>
            <p class="text-amber-300 text-sm">Quán chưa cấu hình đầy đủ thông tin nhận tiền. Vui lòng liên hệ nhân viên.</p>
            <?php endif; ?>

            <button type="button" class="btn-glass w-full py-2 text-xs font-bold text-slate-300" onclick="closeQuickVietQr()">
                Đóng
            </button>
        </div>
    </div>

    <!-- JavaScript Interactions -->
    <script>
        function filterMenuCategory(catId) {
            window.customerActiveCategory = Number(catId) || 0;
            // Update active pill styling
            document.querySelectorAll('.cat-pill').forEach((btn, idx) => {
                if ((catId === 0 && idx === 0) || btn.getAttribute('onclick').includes(`(${catId})`)) {
                    btn.className = 'cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500 text-white shadow-md transition-all shrink-0';
                } else {
                    btn.className = 'cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-all shrink-0';
                }
            });

            filterMenuSearch(document.getElementById('menu-search')?.value || '');
        }

        function filterMenuSearch(keyword) {
            const query = (keyword || '').trim().toLocaleLowerCase('vi');
            document.querySelectorAll('.product-item').forEach(el => {
                const categoryVisible = window.customerActiveCategory === 0 || Number(el.dataset.categoryId) === window.customerActiveCategory;
                const nameVisible = (el.dataset.productName || '').toLocaleLowerCase('vi').includes(query);
                el.style.display = categoryVisible && nameVisible ? 'flex' : 'none';
            });
        }

        function showQuickVietQr() {
            const modal = document.getElementById('quick-vietqr-modal');
            if (modal) {
                modal.classList.remove('opacity-0', 'pointer-events-none');
            }
        }

        function closeQuickVietQr() {
            const modal = document.getElementById('quick-vietqr-modal');
            if (modal) {
                modal.classList.add('opacity-0', 'pointer-events-none');
            }
        }

        async function handleLogout() {
            if (!confirm('Đăng xuất khỏi tài khoản khách hàng?')) return;
            await fetch('api/auth.php?action=logout');
            window.location.reload();
        }
    </script>
    <script src="assets/vendor/qrcode.min.js"></script>
    <script>
        window.customerOrderContext = <?= json_encode([
            'isTableOrder' => $tableOrderContext !== null,
            'tableToken' => $tableOrderContext !== null ? $tableOrderToken : '',
            'tableId' => $tableOrderContext !== null ? (int)$tableOrderContext['id'] : 0,
            'tableName' => $tableOrderContext !== null ? $tableOrderContext['name'] : ''
        ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.customerPaymentDetails = <?= json_encode([
            'vietqrEnabled' => $customerVietQrEnabled,
            'bankId' => $bankId,
            'accountNo' => $bankAccountNo,
            'accountName' => $bankAccountName
        ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.customerWifiCredentials = <?= json_encode([
            'ssid' => $storeWifiSsid,
            'password' => $storeWifi
        ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;

        function escapeWifiValue(value) {
            return String(value).replace(/[\\;,:"]/g, '\\$&');
        }

        function showCustomerWifiQr() {
            const modal = document.getElementById('customer-wifi-qr-modal');
            const container = document.getElementById('customer-wifi-qr');
            const error = document.getElementById('customer-wifi-qr-error');
            if (!modal || !container) return;
            container.replaceChildren();
            error?.classList.add('hidden');
            if (typeof QRCode === 'undefined') {
                if (error) {
                    error.textContent = 'Không thể tải bộ tạo mã QR. Vui lòng thử lại khi có mạng.';
                    error.classList.remove('hidden');
                }
            } else {
                const credentials = window.customerWifiCredentials;
                const password = credentials.password || '';
                const payload = `WIFI:T:${password ? 'WPA' : 'nopass'};S:${escapeWifiValue(credentials.ssid)};${password ? `P:${escapeWifiValue(password)};` : ''};`;
                try {
                    new QRCode(container, { text: payload, width: 208, height: 208, correctLevel: QRCode.CorrectLevel.M });
                } catch (qrError) {
                    console.error('Could not generate Wi-Fi QR code:', qrError);
                    if (error) {
                        error.textContent = 'Không thể tạo mã QR Wi-Fi. Vui lòng kiểm tra tên mạng và thử lại.';
                        error.classList.remove('hidden');
                    }
                }
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeCustomerWifiQr() {
            const modal = document.getElementById('customer-wifi-qr-modal');
            modal?.classList.add('hidden');
            modal?.classList.remove('flex');
        }
    </script>
    <script src="assets/js/customer.js?v=14"></script>
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('customer-sw.js').catch(error => console.warn('Offline customer page unavailable:', error)));
        }
    </script>
    <script src="assets/js/license_ping.js?v=2" data-license-rights="<?= licenseClientMode() ? licenseRightsRevision() : '' ?>"></script>
</body>
</html>
