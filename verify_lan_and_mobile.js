const { chromium } = require('playwright');
const path = require('path');

(async () => {
    console.log('🚀 Bắt đầu kiểm thử Mobile Responsive & Server LAN QR Settings...');
    const browser = await chromium.launch({ headless: true });
    
    // ----------------------------------------------------
    // TEST 1: Mobile Responsive on iPhone (390x844) customer.html
    // ----------------------------------------------------
    console.log('\n📱 [TEST 1] Kiểm tra giao diện Mobile customer.html trên iPhone...');
    const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://localhost:8501/customer.html', { waitUntil: 'networkidle' });

    // Wait for dish cards and click first dish card button
    await mobilePage.waitForSelector('button[onclick*="CustomerOrdering.addItem"]', { timeout: 10000 });
    const addBtns = await mobilePage.$$('button[onclick*="CustomerOrdering.addItem"]');
    console.log(`Found ${addBtns.length} add-to-cart buttons. Clicking first 2 items...`);
    if (addBtns.length > 0) await addBtns[0].click();
    await mobilePage.waitForTimeout(300);
    if (addBtns.length > 1) await addBtns[1].click();
    await mobilePage.waitForTimeout(500);

    // Open cart modal
    await mobilePage.click('#btn-cart-capsule');
    await mobilePage.waitForTimeout(500);

    // Evaluate modal bounding rect
    const modalBox = await mobilePage.evaluate(() => {
        const modal = document.getElementById('customer-cart-modal');
        const dialog = modal.querySelector('.liquid-glass');
        const actions = document.getElementById('customer-sheet-action-grid');
        const total = document.getElementById('customer-cart-total');
        const dRect = dialog.getBoundingClientRect();
        const aRect = actions.getBoundingClientRect();
        return {
            windowWidth: window.innerWidth,
            dialog: { left: dRect.left, right: dRect.right, width: dRect.width },
            actions: { left: aRect.left, right: aRect.right, width: aRect.width },
            totalText: total ? total.textContent : ''
        };
    });

    console.log('Mobile Modal Layout Info:', JSON.stringify(modalBox, null, 2));

    if (modalBox.dialog.left < 0) {
        console.error('❌ LỖI: Modal bị tràn mép trái!', modalBox.dialog.left);
        process.exit(1);
    }
    if (modalBox.dialog.right > modalBox.windowWidth + 1) {
        console.error('❌ LỖI: Modal bị tràn mép phải!', modalBox.dialog.right, modalBox.windowWidth);
        process.exit(1);
    }
    if (modalBox.actions.left < 0 || modalBox.actions.right > modalBox.windowWidth + 1) {
        console.error('❌ LỖI: Hàng nút bấm footer bị tràn mép!');
        process.exit(1);
    }
    console.log('✅ Giao diện modal giỏ món trên iPhone 100% cân đối, không bị cắt xén lề trái!');

    const mobileScreenshotPath = path.resolve('C:/Users/chihu/.gemini/antigravity/brain/da00d27d-e886-4980-9efd-938c2be0665e/mobile_customer_cart_verified.png');
    await mobilePage.screenshot({ path: mobileScreenshotPath });
    console.log('📸 Đã chụp ảnh xác thực Mobile:', mobileScreenshotPath);
    await mobileContext.close();

    // ----------------------------------------------------
    // TEST 2: Admin Settings & LAN Network Card
    // ----------------------------------------------------
    console.log('\n🖥️ [TEST 2] Kiểm tra Cấu hình Máy Chủ & Static IP trong admin.html...');
    const adminContext = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    await adminContext.addCookies([{
        name: 'pos_token',
        value: 'admin_test_token',
        domain: 'localhost',
        path: '/'
    }]);
    const adminPage = await adminContext.newPage();
    
    // Login as Admin using PIN 9999
    await adminPage.goto('http://localhost:8501/login.html');
    await adminPage.waitForTimeout(500);
    const loginResult = await adminPage.evaluate(async () => {
        const res = await fetch('api/auth.php?action=pin_login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin_code: '9999' })
        });
        const data = await res.json();
        if (data.success && data.user) {
            localStorage.setItem('pos_user', JSON.stringify(data.user));
            if (data.token) {
                localStorage.setItem('pos_token', data.token);
                document.cookie = `pos_token=${data.token}; path=/`;
            }
            return data;
        }
        return { success: false };
    });
    console.log('Login result:', loginResult.success);
    if (loginResult.token) {
        await adminContext.addCookies([{
            name: 'pos_token',
            value: loginResult.token,
            domain: 'localhost',
            path: '/'
        }]);
    }
    await adminPage.waitForTimeout(500);

    // Navigate to admin.html
    await adminPage.goto('http://localhost:8501/admin.html', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(1000);

    // Switch to settings tab
    await adminPage.evaluate(() => {
        Admin.switchTab('settings');
    });
    await adminPage.waitForTimeout(1500);

    // Check Network card and IP
    const settingsNetInfo = await adminPage.evaluate(() => {
        const ipInput = document.getElementById('setting-server-ip');
        const portInput = document.getElementById('setting-server-port');
        const liveUrl = document.getElementById('setting-live-server-url');
        const adaptersList = document.getElementById('detected-lan-adapters-list');
        return {
            serverIp: ipInput ? ipInput.value : '',
            serverPort: portInput ? portInput.value : '',
            liveUrl: liveUrl ? liveUrl.textContent : '',
            adaptersHtml: adaptersList ? adaptersList.innerText : ''
        };
    });

    console.log('Settings Network Info in Admin UI:', JSON.stringify(settingsNetInfo, null, 2));

    if (!settingsNetInfo.serverIp.includes('10.0.126.159')) {
        console.error('❌ LỖI: Server IP không phát hiện đúng 10.0.126.159!');
        process.exit(1);
    }
    if (!settingsNetInfo.liveUrl.includes('10.0.126.159:8501')) {
        console.error('❌ LỖI: Live URL banner không hiển thị đúng 10.0.126.159:8501!');
        process.exit(1);
    }
    console.log('✅ Cấu hình Máy Chủ & Static IP hiển thị hoàn hảo trên admin.html!');

    const adminSettingsScreenshot = path.resolve('C:/Users/chihu/.gemini/antigravity/brain/da00d27d-e886-4980-9efd-938c2be0665e/admin_server_network_verified.png');
    await adminPage.screenshot({ path: adminSettingsScreenshot });
    console.log('📸 Đã chụp ảnh xác thực Admin Settings:', adminSettingsScreenshot);

    // ----------------------------------------------------
    // TEST 3: QR Code URL in index.html (POS)
    // ----------------------------------------------------
    console.log('\n📲 [TEST 3] Kiểm tra Mã QR Khách Hàng Gọi Món trong index.html...');
    const posPage = await adminContext.newPage();
    await posPage.goto('http://localhost:8501/index.html', { waitUntil: 'networkidle' });
    await posPage.waitForTimeout(1000);

    // Open LAN QR Modal
    await posPage.evaluate(() => {
        showLanQrModal();
    });
    await posPage.waitForTimeout(1000);

    const posQrInfo = await posPage.evaluate(() => {
        const urlEl = document.getElementById('index-customer-url-text');
        const linkEl = document.getElementById('index-customer-direct-link');
        return {
            urlText: urlEl ? urlEl.textContent : '',
            href: linkEl ? linkEl.href : ''
        };
    });

    console.log('POS LAN QR Modal Info:', JSON.stringify(posQrInfo, null, 2));

    if (posQrInfo.urlText.includes('localhost')) {
        console.error('❌ LỖI: QR Modal vẫn chứa localhost thay vì IP LAN!');
        process.exit(1);
    }
    if (!posQrInfo.urlText.includes('10.0.126.159:8501/customer.html')) {
        console.error('❌ LỖI: QR Modal không đúng URL 10.0.126.159:8501/customer.html!');
        process.exit(1);
    }
    console.log('✅ Mã QR gọi món trên index.html đã chuyển sang IP LAN thực tế:', posQrInfo.urlText);

    const posQrScreenshot = path.resolve('C:/Users/chihu/.gemini/antigravity/brain/da00d27d-e886-4980-9efd-938c2be0665e/pos_lan_qr_verified.png');
    await posPage.screenshot({ path: posQrScreenshot });
    console.log('📸 Đã chụp ảnh xác thực POS LAN QR:', posQrScreenshot);

    await browser.close();
    console.log('\n🎉 TẤT CẢ 3 BỘ KIỂM THỬ ĐÃ VƯỢT QUA 100% THÀNH CÔNG!');
})();
