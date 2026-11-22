window.SLAVE_MANUAL = {
 "meta": {
  "title": "Sổ tay Vận hành & Thuyết minh Hệ thống SLAVE",
  "version": "v2.5.0",
  "ota": "2026.11.22.04",
  "generated": "22/11/2026 17:27",
  "counts": {
   "funcs": 82,
   "flows": 11,
   "cases": 17,
   "tables": 42,
   "endpoints": 78
  },
  "undocumented_tables": []
 },
 "modules": [
  {
   "id": "LOGIN",
   "name": "Đăng nhập",
   "file": "login.html",
   "url": "/login.html",
   "icon": "🔐",
   "roles": [
    "all"
   ],
   "desc": "Cổng vào duy nhất của nhân viên. Xác thực rồi tự chuyển hướng theo vai trò."
  },
  {
   "id": "POS",
   "name": "POS Thu ngân",
   "file": "index.html",
   "url": "/index.html",
   "icon": "💳",
   "roles": [
    "cashier",
    "admin"
   ],
   "desc": "Bán hàng, thanh toán, giao ca, sổ quỹ. Chỉ Thu ngân và Chủ quán được vào."
  },
  {
   "id": "KDS",
   "name": "Bếp & Pha chế (KDS)",
   "file": "kitchen.html",
   "url": "/kitchen.html",
   "icon": "🍳",
   "roles": [
    "kitchen",
    "cashier",
    "admin"
   ],
   "desc": "Màn hình phiếu chế biến thời gian thực, báo xong, báo hết món."
  },
  {
   "id": "ORDER",
   "name": "Order Phục vụ",
   "file": "order.html",
   "url": "/order.html",
   "icon": "🛎️",
   "roles": [
    "waiter",
    "cashier",
    "admin"
   ],
   "desc": "Điện thoại phục vụ: gọi món tại bàn, duyệt đơn QR, bưng món."
  },
  {
   "id": "CUSTOMER",
   "name": "Khách quét QR",
   "file": "customer.html",
   "url": "/customer.html",
   "icon": "📱",
   "roles": [
    "customer",
    "guest"
   ],
   "desc": "Thực đơn điện tử, đặt món, thanh toán VietQR, đánh giá, Jukebox."
  },
  {
   "id": "ONLINE",
   "name": "Đơn Online / Mang về",
   "file": "online_orders.html",
   "url": "/online_orders.html",
   "icon": "🛍️",
   "roles": [
    "cashier",
    "admin"
   ],
   "desc": "Xác nhận thanh toán đơn mang về/giao đi trước khi chuyển Bếp."
  },
  {
   "id": "ATTEND",
   "name": "Chấm công & Theo dõi ca",
   "file": "attendance.html",
   "url": "/attendance.html",
   "icon": "⏱️",
   "roles": [
    "admin",
    "cashier",
    "kitchen",
    "waiter"
   ],
   "desc": "Bảng ca real-time toàn quán, chấm công cá nhân, Kiosk PIN."
  },
  {
   "id": "ADMIN",
   "name": "Quản trị Chủ quán",
   "file": "admin.html",
   "url": "/admin.html",
   "icon": "👑",
   "roles": [
    "admin"
   ],
   "desc": "11 tab chia 4 nhóm: Vận Hành, Thực Đơn & Kho, Nhân Sự & Bếp, Hệ Thống & Quán."
  },
  {
   "id": "JUKEBOX",
   "name": "Media Server & Jukebox",
   "file": "admin.html#media · pos-jukebox.js · customer.html",
   "url": "/admin.html#media",
   "icon": "🎵",
   "roles": [
    "admin",
    "cashier",
    "customer"
   ],
   "desc": "Kho nhạc offline Lossless/MP3, nhập YouTube tải offline, 10-Band DSP Equalizer, Audio Ducking, lịch phát theo khung giờ, Jukebox Mini trên POS và QR chọn/vote bài tại bàn."
  },
  {
   "id": "WIFI",
   "name": "WiFi Marketing",
   "file": "wifi.html",
   "url": "/wifi.html",
   "icon": "📶",
   "roles": [
    "guest"
   ],
   "desc": "Trang chào Captive Portal sau khi khách nối WiFi: banner ưu đãi, dùng thử miễn phí (giới hạn thời lượng phiên) hoặc mở khóa WiFi VIP dài hạn bằng mã hóa đơn."
  },
  {
   "id": "STUDIO",
   "name": "I18N Studio",
   "file": "i18n_studio.html",
   "url": "/i18n_studio.html",
   "icon": "🌐",
   "roles": [
    "admin"
   ],
   "desc": "Quản trị ngôn ngữ cấp trường/cột, dịch AI, xuất bản locales."
  },
  {
   "id": "SYSTEM",
   "name": "Hệ thống nền",
   "file": "cybernexus_slave.exe",
   "url": "",
   "icon": "⚙️",
   "roles": [
    "admin"
   ],
   "desc": "Bản quyền ECDSA, OTA, toàn vẹn web, sao lưu, health."
  }
 ],
 "funcs": [
  {
   "id": "LOGIN-01",
   "mod": "LOGIN",
   "sec": "Xác thực",
   "title": "Đăng nhập bằng tài khoản & mật khẩu",
   "roles": [
    "all"
   ],
   "summary": "Nhân viên nhập tài khoản + mật khẩu. Hệ thống xác thực trên C++ Backend rồi chuyển đúng màn hình theo vai trò.",
   "steps": [
    "Mở /login.html (hoặc quét QR/URL của quán).",
    "Nhập Tài khoản + Mật khẩu → bấm Đăng nhập.",
    "Hệ thống tự chuyển: Chủ quán/Thu ngân → POS (index.html); Phục vụ → order.html; Bếp → kitchen.html; Khách → customer.html.",
    "Lần đăng nhập thành công đồng thời tự Check-in ca làm việc (nguồn auto_login)."
   ],
   "data": [
    "users",
    "attendances",
    "audit_logs"
   ],
   "api": [
    "POST /api/auth.php?action=login"
   ],
   "notes": [
    "Sai mật khẩu liên tiếp bị khóa tạm (HTTP 429) để chống dò mật khẩu.",
    "Trang chủ từng màn hình có cổng chặn: sai vai trò sẽ bị đẩy về màn hình đúng."
   ],
   "cases": [
    "Quên mật khẩu → Chủ quán đặt lại trong Admin › Nhân Viên & Phân Quyền.",
    "Bị 429 → chờ hết thời gian khóa rồi thử lại (không cần can thiệp máy chủ)."
   ],
   "lic": "",
   "src": "slave/web/login.html · slave/src/slave_handlers.cpp (ensureStaffCheckIn)",
   "test": "smoke_test_dot6: SEC-16 (khóa brute-force 429)"
  },
  {
   "id": "LOGIN-02",
   "mod": "LOGIN",
   "sec": "Xác thực",
   "title": "Đăng nhập nhanh bằng mã PIN (bàn phím số)",
   "roles": [
    "cashier",
    "kitchen",
    "waiter"
   ],
   "summary": "Dành cho thiết bị cảm ứng: nhập PIN thay cho gõ mật khẩu. PIN do Chủ quán cấp trong hồ sơ nhân viên.",
   "steps": [
    "Tại màn hình đăng nhập chọn tab PIN.",
    "Bấm các số trên bàn phím (có nút Xóa / Lùi).",
    "Đủ số PIN hệ thống tự xác thực."
   ],
   "data": [
    "users.pin_code"
   ],
   "api": [
    "POST /api/auth.php?action=login"
   ],
   "notes": [
    "PIN cũng dùng cho thao tác nhạy cảm (duyệt giảm giá lớn, hủy đơn đã thanh toán, mở két)."
   ],
   "cases": [
    "Nhập sai PIN nhiều lần bị khóa (SEC-16)."
   ],
   "lic": "",
   "src": "slave/web/login.html (switchLoginTab, pressPin)",
   "test": ""
  },
  {
   "id": "LOGIN-03",
   "mod": "LOGIN",
   "sec": "Điều khiển máy chủ",
   "title": "Điều khiển máy chủ từ màn hình đăng nhập",
   "roles": [
    "admin"
   ],
   "summary": "Cửa sổ Host Control cho phép dừng/khởi động lại dịch vụ Slave tại máy chủ khi không vào được Admin.",
   "steps": [
    "Mở cửa sổ điều khiển máy chủ ở màn hình đăng nhập.",
    "Chọn hành động → xác nhận."
   ],
   "data": [],
   "api": [
    "POST /api/system/control"
   ],
   "notes": [
    "Chỉ hữu ích khi truy cập từ chính máy chủ hoặc LAN tin cậy."
   ],
   "cases": [
    "Máy treo: dùng chức năng này thay vì tắt nguồn đột ngột để tránh hỏng CSDL SQLite."
   ],
   "lic": "",
   "src": "slave/web/login.html (openHostControlModal, executeHostAction)",
   "test": ""
  },
  {
   "id": "LOGIN-05",
   "mod": "LOGIN",
   "sec": "Xác thực",
   "title": "Đăng nhập / Phê duyệt Chủ quán từ xa bằng mã QR (Owner QR)",
   "roles": [
    "admin"
   ],
   "summary": "Cho phép Chủ quán quét mã QR trên màn hình máy tính bằng điện thoại đã đăng nhập quyền Admin để vào trang Quản trị mà không cần gõ mật khẩu trước mặt nhân viên.",
   "steps": [
    "Trên màn hình đăng nhập máy quầy, tạo phiên QR Chủ quán (create_owner_qr).",
    "Chủ quán dùng điện thoại đang đăng nhập Admin quét mã và bấm Phê duyệt (approve_owner_qr).",
    "Máy quầy tự kiểm tra trạng thái (check_owner_qr) và đăng nhập thẳng vào Admin."
   ],
   "data": [
    "users",
    "audit_logs"
   ],
   "api": [
    "POST /api/auth.php?action=create_owner_qr",
    "POST /api/auth.php?action=approve_owner_qr",
    "GET /api/auth.php?action=check_owner_qr"
   ],
   "notes": [
    "Mã QR có thời hạn ngắn và chỉ dùng 1 lần để chống chụp lại tái sử dụng."
   ],
   "cases": [
    "Mã QR hết hạn → bấm tạo mã mới rồi quét lại."
   ],
   "lic": "",
   "src": "slave/src/slave_handlers.cpp (create_owner_qr, approve_owner_qr, check_owner_qr)",
   "test": ""
  },
  {
   "id": "LOGIN-04",
   "mod": "LOGIN",
   "sec": "Xác thực",
   "title": "Đăng xuất & tự chốt ca",
   "roles": [
    "all"
   ],
   "summary": "Nút Đăng xuất (thống nhất nhãn “Đăng xuất / Sign Out”) kết thúc phiên, xóa token/cookie và ghi nhận Check-out.",
   "steps": [
    "Bấm Đăng xuất ở góc phải thanh điều hướng.",
    "Xác nhận hộp thoại.",
    "Hệ thống gọi logout, xóa pos_token/cookie, quay về login.html."
   ],
   "data": [
    "attendances"
   ],
   "api": [
    "GET /api/auth.php?action=logout"
   ],
   "notes": [
    "Có ở mọi màn hình nhân viên, cùng vị trí ngoài cùng bên phải."
   ],
   "cases": [],
   "lic": "",
   "src": "slave/web/*.html (handleLogout)",
   "test": ""
  },
  {
   "id": "POS-01",
   "mod": "POS",
   "sec": "Bàn",
   "title": "Lưới bàn, chọn bàn & trạng thái chế biến",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Hiển thị toàn bộ bàn Tại quán (TQ…) và Mang về (MV…). Bàn đang có đơn đổi màu; bàn đang chế biến có chấm vàng nhấp nháy.",
   "steps": [
    "Chọn bàn trên lưới (hoặc để hệ thống tự chọn bàn mặc định).",
    "Đơn của bàn tải vào giỏ bên trái.",
    "Bấm Làm mới nếu cần đồng bộ ngay (tự làm mới định kỳ)."
   ],
   "data": [
    "tables_areas",
    "orders"
   ],
   "api": [
    "GET /api/tables.php",
    "GET /api/orders.php"
   ],
   "notes": [
    "Bàn vừa Đã TT nhưng bếp còn làm vẫn giữ chấm vàng.",
    "Quá SLA bếp: thẻ bàn tự hiện số phút chờ và nút Hối."
   ],
   "cases": [
    "Bàn kẹt trạng thái → mở bàn, kiểm tra đơn còn mở; nếu đơn đã hủy/chốt thì Làm mới."
   ],
   "lic": "",
   "src": "slave/web/assets/js/pos.js (loadTables, renderTables, selectTable)",
   "test": ""
  },
  {
   "id": "POS-02",
   "mod": "POS",
   "sec": "Gọi món",
   "title": "Chọn món, topping, ghi chú & số lượng",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Lọc theo nhóm hàng, thêm món vào giỏ, chọn topping, ghi chú từng món, tăng/giảm số lượng.",
   "steps": [
    "Chọn nhóm hàng ở thanh trên (hoặc tìm tên/mã món).",
    "Chạm món để thêm; món có topping sẽ mở hộp chọn topping.",
    "Sửa số lượng bằng +/−; thêm ghi chú món (ít đá, không hành…)."
   ],
   "data": [
    "categories",
    "products",
    "order_items"
   ],
   "api": [
    "GET /api/categories.php",
    "GET /api/products.php"
   ],
   "notes": [
    "Món Tạm khóa/Hết (do Bếp báo) hiển thị mờ và không thể thêm."
   ],
   "cases": [
    "Món không có ảnh: dùng AI cập nhật ảnh trong Admin › Mặt Hàng."
   ],
   "lic": "",
   "src": "slave/web/assets/js/pos.js (addToCart, openToppingModal, editItemNote)",
   "test": ""
  },
  {
   "id": "POS-03",
   "mod": "POS",
   "sec": "Gọi món",
   "title": "Giỏ hàng & báo giá do máy chủ tính (Thin-Client)",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Mọi con số tiền (tạm tính, giảm giá, VAT, tổng) do C++ Backend tính qua preview_quote; trình duyệt chỉ hiển thị.",
   "steps": [
    "Mỗi thay đổi giỏ → gửi yêu cầu báo giá (debounce).",
    "Màn hình hiển thị Tạm tính / Giảm giá / VAT / Tổng cộng từ phản hồi máy chủ.",
    "Đơn tự lưu nháp liên tục."
   ],
   "data": [
    "orders",
    "order_items",
    "promotions"
   ],
   "api": [
    "GET /api/orders.php?action=preview_quote"
   ],
   "notes": [
    "Không còn dữ liệu nhạy cảm trong localStorage; giá bị sửa phía trình duyệt không có hiệu lực."
   ],
   "cases": [],
   "lic": "",
   "src": "pos.js (requestBackendPreviewQuote, saveOrderDebounced)",
   "test": "smoke_test_dot7: ARCH-06 preview_quote"
  },
  {
   "id": "POS-04",
   "mod": "POS",
   "sec": "Gọi món",
   "title": "Gửi bếp",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Chuyển các món chưa gửi xuống màn hình Bếp. Phiếu bếp xuất hiện kèm chuông.",
   "steps": [
    "Hoàn tất giỏ → bấm Gửi Bếp.",
    "Thẻ bàn hiện chấm vàng nhấp nháy khi Bếp đang làm.",
    "Món gọi thêm sau chỉ gửi phần phát sinh."
   ],
   "data": [
    "orders.kitchen_status",
    "orders.kitchen_sent_at"
   ],
   "api": [
    "POST /api/orders.php?action=send_to_kitchen"
   ],
   "notes": [
    "Đơn Mang về/Online phải được xác nhận thanh toán trước khi cho chuyển Bếp (xem ONLINE-02)."
   ],
   "cases": [],
   "lic": "",
   "src": "pos.js (sendOrderToKitchen)",
   "test": ""
  },
  {
   "id": "POS-05",
   "mod": "POS",
   "sec": "Giảm giá",
   "title": "Giảm giá, voucher & khuyến mãi tự động",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Giảm theo % hoặc số tiền, nhập mã voucher, hoặc áp khuyến mãi tự động theo khung giờ / đơn tối thiểu.",
   "steps": [
    "Bấm Giảm giá → chọn % hoặc số tiền, hoặc chọn/nhập mã khuyến mãi.",
    "Giảm từ 20% trở lên: hệ thống yêu cầu PIN Quản lý.",
    "Áp dụng → tổng tiền cập nhật từ máy chủ."
   ],
   "data": [
    "promotions",
    "orders.promo_*",
    "audit_logs"
   ],
   "api": [
    "GET /api/promotions.php",
    "POST /api/orders.php"
   ],
   "notes": [
    "Mức giảm lớn và mọi lần dùng PIN đều ghi Audit Log."
   ],
   "cases": [
    "Mã đã hết lượt/hết hạn → báo lỗi nêu rõ lý do."
   ],
   "lic": "promo_voucher_engine",
   "src": "pos.js (openDiscountModal, applyPromoCodeInModal)",
   "test": "smoke_test_dot6: PAY-02 (PIN ≥20%, khuyến mãi chặt)"
  },
  {
   "id": "POS-06",
   "mod": "POS",
   "sec": "Bàn",
   "title": "Chuyển bàn & Gộp bàn",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Chuyển toàn bộ đơn sang bàn trống hoặc gộp hai đơn thành một.",
   "steps": [
    "Chọn bàn nguồn → Chuyển bàn / Gộp bàn.",
    "Chọn bàn đích → xác nhận.",
    "Bếp & Phục vụ thấy mã bàn mới."
   ],
   "data": [
    "tables_areas",
    "orders"
   ],
   "api": [
    "POST /api/orders.php?action=switch_table|merge_table"
   ],
   "notes": [],
   "cases": [
    "Gộp bàn có món đang chế biến: Bếp vẫn nhận đúng phiếu, chỉ đổi nhãn bàn."
   ],
   "lic": "",
   "src": "pos.js (doSwitchTable, doMergeTable)",
   "test": ""
  },
  {
   "id": "POS-07",
   "mod": "POS",
   "sec": "Hủy",
   "title": "Hủy đơn & xử lý yêu cầu hủy",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Hủy đơn chưa thanh toán nhanh; đơn đã thanh toán phải qua PIN và hoàn tiền; xử lý yêu cầu hủy từ Bếp/Phục vụ.",
   "steps": [
    "Bấm Hủy → nhập lý do bắt buộc.",
    "Đơn đã thanh toán: nhập PIN Quản lý, hệ thống tính tiền hoàn.",
    "Yêu cầu hủy từ Bếp hiện trên thanh cảnh báo → Duyệt/Từ chối."
   ],
   "data": [
    "orders.status",
    "orders.cancel_*",
    "order_alerts",
    "audit_logs"
   ],
   "api": [
    "POST /api/orders.php?action=cancel_order"
   ],
   "notes": [
    "Có trạng thái pending_void khi đang chờ hoàn tiền (HTTP 409 nếu thao tác chồng)."
   ],
   "cases": [],
   "lic": "",
   "src": "pos.js (cancelOrder, confirmCancelOrderWithReason, quickCancelPendingOrder)",
   "test": "smoke_test_dot6: PAY-03"
  },
  {
   "id": "POS-08",
   "mod": "POS",
   "sec": "In ấn",
   "title": "In tạm tính & In lại hóa đơn",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "In phiếu tạm tính trước khi khách thanh toán; tra cứu lịch sử thanh toán & in lại hóa đơn bất kỳ.",
   "steps": [
    "In tạm tính: bấm In tạm trên giỏ.",
    "In lại: Lịch Sử Đơn → lọc theo ngày/mã → chọn đơn → In lại."
   ],
   "data": [
    "orders",
    "store_settings.print_*"
   ],
   "api": [
    "POST /api/printer/print-receipt",
    "GET /api/printer/list"
   ],
   "notes": [
    "Mẫu in song ngữ Việt-Anh/Việt-Trung cấu hình ở Admin › Cài Đặt › In Hóa Đơn."
   ],
   "cases": [
    "Máy in không in → Admin › Cài Đặt › Test In Thử, kiểm IP:port máy in."
   ],
   "lic": "",
   "src": "pos.js (printTemporaryReceipt, reprintActiveOrder) · slave_dot6_handlers.cpp",
   "test": "smoke_test_dot6: PAY-05 + TCP ESC/POS"
  },
  {
   "id": "POS-09",
   "mod": "POS",
   "sec": "Thanh toán",
   "title": "Thanh toán: Tiền mặt, VietQR, Thẻ & Chia nhiều phương thức",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Hỗ trợ tiền mặt (tính tiền thối), chuyển khoản VietQR động offline, quẹt thẻ SmartPOS (ECR) và chia một hóa đơn nhiều phương thức.",
   "steps": [
    "Bấm Thanh toán (F9) → chọn phương thức.",
    "Tiền mặt: nhập tiền khách đưa → hiện tiền thối.",
    "VietQR: hiện mã đúng số tiền → xác nhận khi nhận được tiền (hoặc Webhook ngân hàng tự xác nhận).",
    "Thẻ: gửi lệnh tới máy POS thẻ, chờ phản hồi.",
    "Chia nhiều phương thức: nhập từng phần, hệ thống kiểm tổng khớp.",
    "Xác nhận → in hóa đơn, mở két nếu có tiền mặt."
   ],
   "data": [
    "orders.payment_*",
    "payment_transactions",
    "card_transactions",
    "cash_transactions"
   ],
   "api": [
    "GET /api/payment/vietqr_payload",
    "GET /api/payment/vietqr_svg",
    "POST /api/orders.php?action=checkout",
    "POST /api/payment/webhook"
   ],
   "notes": [
    "Mã VietQR (EMVCo + CRC16) tạo 100% offline, không gọi dịch vụ ngoài.",
    "Idempotency-Key chống bấm thanh toán 2 lần.",
    "Két chỉ bật xung khi có tiền mặt."
   ],
   "cases": [
    "Khách chuyển khoản nhưng chưa thấy tiền → chọn “chờ xác nhận”, không bấm hoàn tất.",
    "Đổi phương thức sau khi đã thanh toán cần PIN Quản lý."
   ],
   "lic": "vietqr_payment",
   "src": "pos.js (openPaymentModal, confirmCheckout, calcSplitSummary)",
   "test": "smoke_test_dot6/7: PAY-01..04, ARCH-05"
  },
  {
   "id": "POS-10",
   "mod": "POS",
   "sec": "Thanh toán",
   "title": "Quyết toán chênh lệch (Thu thêm / Hoàn tiền)",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Khi đơn đã thanh toán lại phát sinh thêm món hoặc hủy món, hệ thống tính phần Thu thêm hoặc Hoàn tiền thay vì mở lại đơn.",
   "steps": [
    "Đơn đã TT có thay đổi → thẻ báo chênh lệch.",
    "Mở quyết toán → chọn thu thêm/hoàn → xác nhận."
   ],
   "data": [
    "orders.settlement_status",
    "orders.paid_amount",
    "payment_transactions"
   ],
   "api": [
    "POST /api/orders.php?action=settle_delta"
   ],
   "notes": [
    "Mọi khoản hoàn đều có bản ghi payment_transactions để đối soát ca."
   ],
   "cases": [],
   "lic": "",
   "src": "pos.js (settleOrderDelta)",
   "test": ""
  },
  {
   "id": "POS-11",
   "mod": "POS",
   "sec": "Ca & Quỹ",
   "title": "Giao ca / Sổ quỹ tiền mặt",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Mở ca với tiền đầu ca, lập phiếu thu/chi tại quầy, kết ca đối chiếu tiền lý thuyết và tiền thực đếm.",
   "steps": [
    "Đầu ngày: Giao Ca / Quỹ → Mở ca, nhập tiền đầu ca.",
    "Trong ngày: lập Phiếu thu/Phiếu chi (có lý do).",
    "Cuối ngày: Kết ca → nhập tiền thực đếm → hệ thống tính chênh lệch."
   ],
   "data": [
    "pos_shifts",
    "cash_transactions",
    "audit_logs"
   ],
   "api": [
    "POST /api/finance.php?action=open_shift|close_shift|add_cash_tx"
   ],
   "notes": [
    "Không kết ca được nếu còn đơn chưa thanh toán (chặn có kiểm thử).",
    "Chênh lệch ca hiện ở Admin › Kế Toán Ca & Kiểm Toán."
   ],
   "cases": [
    "Lệch tiền cuối ca → xem Nhật ký quỹ, phiếu chi trong ca và các lần Mở két không bán."
   ],
   "lic": "",
   "src": "pos.js (Giao Ca) · slave_handlers.cpp",
   "test": "smoke_test_dot6: PAY-04 (chặn kết ca chưa thanh toán)"
  },
  {
   "id": "POS-12",
   "mod": "POS",
   "sec": "Ca & Quỹ",
   "title": "Mở két không bán (No-Sale)",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Mở két ngoài giao dịch (đổi tiền lẻ…). Bắt buộc PIN Quản lý và ghi Audit Log mức CRITICAL.",
   "steps": [
    "Bấm Mở Két → nhập lý do + PIN Quản lý.",
    "Hệ thống gửi xung ESC/POS mở két và ghi nhật ký."
   ],
   "data": [
    "audit_logs"
   ],
   "api": [
    "POST /api/printer/open-drawer"
   ],
   "notes": [
    "Mỗi lần mở đều truy vết được người/giờ/lý do."
   ],
   "cases": [],
   "lic": "",
   "src": "slave_dot6_handlers.cpp · receipt_template.js",
   "test": "smoke_test_dot6: PAY-01"
  },
  {
   "id": "POS-13",
   "mod": "POS",
   "sec": "Báo cáo",
   "title": "Thống kê doanh thu thu ngân & In báo cáo kết ca",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Xem doanh thu ca/ngày của chính thu ngân theo phương thức thanh toán; in phiếu báo cáo kết ca.",
   "steps": [
    "Bấm Thống Kê → chọn Hôm nay/Ca.",
    "In báo cáo kết ca khi cần."
   ],
   "data": [
    "orders",
    "pos_shifts"
   ],
   "api": [
    "GET /api/reports.php"
   ],
   "notes": [],
   "cases": [],
   "lic": "",
   "src": "pos.js · pos_shift_reports.js",
   "test": ""
  },
  {
   "id": "POS-14",
   "mod": "POS",
   "sec": "Thông báo",
   "title": "Thông báo đơn QR/Online, chuông & cảnh báo",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Thanh cảnh báo đầu trang phát chuông khi có đơn QR/Online/mang về mới hoặc yêu cầu hủy.",
   "steps": [
    "Nghe chuông → xem thẻ cảnh báo.",
    "Chọn Mở bàn / Chuyển Bếp / Sang Đơn Online.",
    "Bấm Đã xử lý (ack) để tắt cảnh báo."
   ],
   "data": [
    "app_notifications",
    "order_alerts"
   ],
   "api": [
    "GET /api/orders.php?action=check_notifications",
    "POST /api/orders.php?action=ack_notification"
   ],
   "notes": [
    "Trình duyệt chỉ phát âm thanh sau khi người dùng chạm màn hình lần đầu."
   ],
   "cases": [],
   "lic": "",
   "src": "pos.js (loadPosAlerts, startNotificationPolling)",
   "test": ""
  },
  {
   "id": "POS-15",
   "mod": "POS",
   "sec": "Tiện ích",
   "title": "Mã QR LAN, Jukebox mini & bàn phím số ảo",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Hiện QR dẫn khách tới trang đặt món; điều khiển nhạc nền ngay trên thanh POS; bàn phím số ảo cho màn hình cảm ứng.",
   "steps": [
    "Bấm biểu tượng QR → hiển thị/sao chép URL customer.html.",
    "Jukebox mini: Phát/Tạm dừng/Chuyển bài; bấm vào để mở cửa sổ quản lý."
   ],
   "data": [
    "media_tracks",
    "media_jukebox_queue"
   ],
   "api": [
    "GET /api/media/tracks"
   ],
   "notes": [],
   "cases": [],
   "lic": "mod_media_stream",
   "src": "pos-jukebox.js · virtual-keyboard.js",
   "test": ""
  },
  {
   "id": "KDS-01",
   "mod": "KDS",
   "sec": "Phiếu",
   "title": "Hàng đợi phiếu chế biến & bộ lọc",
   "roles": [
    "kitchen",
    "cashier",
    "admin"
   ],
   "summary": "Bốn tab: Chờ Làm, Đã Bưng, Lịch Sử, Tất Cả Đang Mở; tự làm mới 3,5 giây.",
   "steps": [
    "Mở kitchen.html → xem phiếu mới nhất ở Chờ Làm.",
    "Đọc danh sách món, số lượng, topping, ghi chú.",
    "Chuyển tab để xem món đã bưng hoặc lịch sử."
   ],
   "data": [
    "orders",
    "order_items",
    "kitchen_service_logs"
   ],
   "api": [
    "GET /api/orders.php?action=kitchen_orders"
   ],
   "notes": [
    "Tạm dừng làm mới khi tab trình duyệt bị ẩn để tiết kiệm tài nguyên."
   ],
   "cases": [
    "Không thấy phiếu mới → kiểm tra mạng Wi-Fi và bật chuông (KDS-07)."
   ],
   "lic": "",
   "src": "kitchen_kds.js (switchFilter, loadKitchenOrders)",
   "test": ""
  },
  {
   "id": "KDS-02",
   "mod": "KDS",
   "sec": "Phiếu",
   "title": "Báo xong món (báo Phục vụ)",
   "roles": [
    "kitchen"
   ],
   "summary": "Chế biến xong bấm Xong Món: Phục vụ nhận chuông và thẻ bàn đổi màu.",
   "steps": [
    "Bấm Xong Món (Báo Phục Vụ) trên phiếu.",
    "Hệ thống ghi giờ xong và thời gian chế biến."
   ],
   "data": [
    "orders.kitchen_ready_at",
    "orders.prep_time_minutes",
    "kitchen_service_logs",
    "kpi_logs"
   ],
   "api": [
    "POST /api/orders.php?action=kitchen_ready"
   ],
   "notes": [
    "Xong đúng hạn SLA được cộng điểm KPI cho Bếp."
   ],
   "cases": [],
   "lic": "",
   "src": "kitchen_kds.js (markKitchenReady)",
   "test": ""
  },
  {
   "id": "KDS-03",
   "mod": "KDS",
   "sec": "Phiếu",
   "title": "Nhận Hối món",
   "roles": [
    "kitchen"
   ],
   "summary": "Khi Phục vụ/Thu ngân hối, phiếu viền đỏ, gắn nhãn HỐI MÓN (xN) và phát chuông đôi.",
   "steps": [
    "Nghe chuông đôi → ưu tiên phiếu bị hối.",
    "Xong món như bình thường."
   ],
   "data": [
    "orders.rush_count",
    "kpi_logs"
   ],
   "api": [
    "POST /api/orders.php?action=rush_order"
   ],
   "notes": [
    "Mỗi lần bị hối trừ điểm KPI Bếp (mặc định −5)."
   ],
   "cases": [],
   "lic": "",
   "src": "kitchen_kds.js",
   "test": ""
  },
  {
   "id": "KDS-04",
   "mod": "KDS",
   "sec": "Phiếu",
   "title": "Báo lại nhắc Phục vụ",
   "roles": [
    "kitchen"
   ],
   "summary": "Nếu món đã xong quá SLA mà Phục vụ chưa bưng, nút Báo Lại phát chuông nhắc.",
   "steps": [
    "Bấm Báo Lại (Nhắc PV)."
   ],
   "data": [
    "orders.remind_count",
    "kpi_logs"
   ],
   "api": [
    "POST /api/orders.php?action=remind_waiter"
   ],
   "notes": [
    "Mỗi lần nhắc trừ điểm KPI Phục vụ (mặc định −3)."
   ],
   "cases": [],
   "lic": "",
   "src": "kitchen_kds.js",
   "test": ""
  },
  {
   "id": "KDS-05",
   "mod": "KDS",
   "sec": "Món",
   "title": "Báo hết món / Khóa món (86)",
   "roles": [
    "kitchen",
    "admin"
   ],
   "summary": "Khóa tức thời một món trên mọi màn hình (Phục vụ, Thu ngân, Khách QR).",
   "steps": [
    "Bấm Món Khóa → danh sách món → bật/tắt khóa từng món.",
    "Số món đang khóa hiện trên nút."
   ],
   "data": [
    "products.status"
   ],
   "api": [
    "POST /api/products.php?action=toggle_status"
   ],
   "notes": [
    "Mở lại món khi có hàng trở lại."
   ],
   "cases": [],
   "lic": "",
   "src": "kitchen_kds.js (toggleDishStatus)",
   "test": ""
  },
  {
   "id": "KDS-06",
   "mod": "KDS",
   "sec": "Phiếu",
   "title": "Xin hủy, lưu trữ & mở lại phiếu",
   "roles": [
    "kitchen"
   ],
   "summary": "Bếp không tự hủy được đơn; gửi yêu cầu hủy lên Thu ngân duyệt. Phiếu xong có thể lưu trữ hoặc mở lại.",
   "steps": [
    "Bấm Thùng rác → nhập lý do → gửi yêu cầu.",
    "Chờ Thu ngân duyệt/từ chối (thông báo hiện lại ở Bếp)."
   ],
   "data": [
    "orders.cancel_request_*",
    "order_alerts"
   ],
   "api": [
    "POST /api/orders.php?action=kitchen_cancel"
   ],
   "notes": [],
   "cases": [],
   "lic": "",
   "src": "kitchen_kds.js (kitchenCancelOrder)",
   "test": ""
  },
  {
   "id": "KDS-07",
   "mod": "KDS",
   "sec": "Âm thanh",
   "title": "Bật/Tắt chuông đơn mới",
   "roles": [
    "kitchen"
   ],
   "summary": "Nút loa trên header bật/tắt chuông báo đơn mới và hối món.",
   "steps": [
    "Kiểm tra biểu tượng loa ở trạng thái bật khi vào ca."
   ],
   "data": [],
   "api": [],
   "notes": [
    "Trình duyệt chặn âm thanh đến khi chạm màn hình một lần."
   ],
   "cases": [
    "Không nghe chuông → bấm nút loa một lần rồi thử lại."
   ],
   "lic": "",
   "src": "kitchen_kds.js (toggleSound)",
   "test": ""
  },
  {
   "id": "ORDER-01",
   "mod": "ORDER",
   "sec": "Khởi động",
   "title": "Kích hoạt chuông & rung điện thoại",
   "roles": [
    "waiter"
   ],
   "summary": "Thanh vàng ở đầu trang cần chạm một lần để Safari/Chrome cho phép chuông và rung.",
   "steps": [
    "Đầu ca mở order.html.",
    "Chạm thanh “Chạm để BẬT chuông & rung”.",
    "Có thể bấm biểu tượng loa để thử chuông."
   ],
   "data": [],
   "api": [],
   "notes": [
    "Bắt buộc với iOS Safari và Chrome Android."
   ],
   "cases": [
    "Không có chuông khi có món xong → kích hoạt lại âm thanh."
   ],
   "lic": "",
   "src": "order_waiter.js (activateMobileAudio, playDingDong)",
   "test": ""
  },
  {
   "id": "ORDER-02",
   "mod": "ORDER",
   "sec": "Bàn",
   "title": "Sơ đồ bàn & lọc khu vực",
   "roles": [
    "waiter",
    "cashier",
    "admin"
   ],
   "summary": "Danh sách bàn Tại quán/Mang về; mỗi thẻ hiện trạng thái, chấm vàng chế biến, nút Hối khi quá SLA.",
   "steps": [
    "Lọc Tất cả/Tại quán/Mang về.",
    "Chạm bàn để mở chi tiết và thêm món."
   ],
   "data": [
    "tables_areas",
    "orders"
   ],
   "api": [
    "GET /api/tables.php"
   ],
   "notes": [],
   "cases": [],
   "lic": "",
   "src": "order_waiter.js (renderTables, filterTablesArea)",
   "test": ""
  },
  {
   "id": "ORDER-03",
   "mod": "ORDER",
   "sec": "Gọi món",
   "title": "Gọi món tại bàn & gửi Bếp",
   "roles": [
    "waiter"
   ],
   "summary": "Chọn nhóm/món, chỉnh số khách, xem giỏ ở bottom sheet, gửi Bếp.",
   "steps": [
    "Chọn bàn → chỉnh số khách.",
    "Thêm món, ghi chú món.",
    "Mở giỏ → kiểm tra → Gửi Bếp."
   ],
   "data": [
    "orders",
    "order_items"
   ],
   "api": [
    "POST /api/orders.php"
   ],
   "notes": [],
   "cases": [],
   "lic": "",
   "src": "order_waiter.js (addItemToCart, sendOrderToKitchen)",
   "test": ""
  },
  {
   "id": "ORDER-04",
   "mod": "ORDER",
   "sec": "Gọi món",
   "title": "Duyệt đơn do khách quét QR",
   "roles": [
    "waiter"
   ],
   "summary": "Đơn khách đặt qua QR làm ô bàn nhấp nháy đỏ kèm nút CHUYỂN BẾP; Phục vụ đối chiếu với khách rồi chuyển.",
   "steps": [
    "Nghe chuông → mở bàn đang nhấp nháy.",
    "Kiểm lại món với khách → CHUYỂN BẾP (hoặc thêm món rồi Gửi Bếp)."
   ],
   "data": [
    "orders",
    "app_notifications"
   ],
   "api": [
    "POST /api/orders.php?action=confirm_customer_order"
   ],
   "notes": [],
   "cases": [],
   "lic": "",
   "src": "order_waiter.js (confirmCustomerQrOrder)",
   "test": ""
  },
  {
   "id": "ORDER-05",
   "mod": "ORDER",
   "sec": "Theo dõi",
   "title": "Hối bếp & xác nhận Đã bưng ra",
   "roles": [
    "waiter"
   ],
   "summary": "Quá SLA bếp: nút Hối. Khi món xong: nút ĐÃ BƯNG RA ghi nhận thời gian giao cho KPI.",
   "steps": [
    "Quá SLA → bấm Hối.",
    "Món xong (chuông + thẻ vàng) → mang ra bàn → bấm ĐÃ BƯNG RA."
   ],
   "data": [
    "orders.served_at",
    "orders.deliver_time_minutes",
    "kpi_logs"
   ],
   "api": [
    "POST /api/orders.php?action=rush_order|confirm_delivered"
   ],
   "notes": [
    "Đúng hạn +2 KPI; bị Bếp nhắc −3 KPI (mặc định)."
   ],
   "cases": [],
   "lic": "",
   "src": "order_waiter.js (rushKitchenOrder, confirmDelivered)",
   "test": ""
  },
  {
   "id": "ORDER-06",
   "mod": "ORDER",
   "sec": "Hủy",
   "title": "Xin hủy món đã gửi Bếp",
   "roles": [
    "waiter"
   ],
   "summary": "Món đã gửi Bếp muốn hủy phải xin lý do; phản hồi hiện ở đầu trang để Phục vụ báo khách.",
   "steps": [
    "Chọn món đã xác nhận → Xin hủy → nhập lý do.",
    "Khi có phản hồi: bấm Đã báo khách."
   ],
   "data": [
    "order_items.cancel_*",
    "order_alerts"
   ],
   "api": [
    "POST /api/orders.php?action=request_cancel_item"
   ],
   "notes": [],
   "cases": [],
   "lic": "",
   "src": "order_waiter.js (requestCancelConfirmedItem)",
   "test": ""
  },
  {
   "id": "ORDER-07",
   "mod": "ORDER",
   "sec": "Thanh toán",
   "title": "VietQR thanh toán tại bàn",
   "roles": [
    "waiter"
   ],
   "summary": "Hiện mã VietQR của đơn để khách quét ngay tại bàn.",
   "steps": [
    "Mở đơn → bấm VietQR → đưa điện thoại cho khách quét."
   ],
   "data": [
    "orders"
   ],
   "api": [
    "GET /api/payment/vietqr_payload"
   ],
   "notes": [],
   "cases": [],
   "lic": "vietqr_payment",
   "src": "order_waiter.js (showWaiterVietQr)",
   "test": ""
  },
  {
   "id": "CUS-01",
   "mod": "CUSTOMER",
   "sec": "Vào trang",
   "title": "Quét QR & chọn hình thức đặt món",
   "roles": [
    "customer",
    "guest"
   ],
   "summary": "QR gắn sẵn bàn (?table=TQ1) hoặc truy cập chung. Ba hình thức: Ngồi tại bàn, Mang về, Giao hàng online.",
   "steps": [
    "Quét QR trên bàn.",
    "Chọn hình thức; mang về tự gán MV1–MV5; online nhập tên, SĐT, địa chỉ."
   ],
   "data": [
    "tables_areas"
   ],
   "api": [
    "GET /api/tables.php?action=public"
   ],
   "notes": [
    "QR bàn ký chữ ký (table_sig) để chống giả mạo bàn."
   ],
   "cases": [],
   "lic": "",
   "src": "customer_app.js · CustomerOrdering.setOrderMode",
   "test": "smoke_test_dot6: SEC-18"
  },
  {
   "id": "CUS-02",
   "mod": "CUSTOMER",
   "sec": "Gọi món",
   "title": "Thực đơn điện tử, giỏ hàng & khuyến mãi",
   "roles": [
    "customer",
    "guest"
   ],
   "summary": "Duyệt theo nhóm, thêm món, nhập mã khuyến mãi; món hết hiển thị khóa.",
   "steps": [
    "Chọn nhóm → thêm món → mở giỏ.",
    "Nhập mã khuyến mãi (nếu có) → Áp dụng."
   ],
   "data": [
    "products",
    "categories",
    "promotions"
   ],
   "api": [
    "GET /api/products.php",
    "GET /api/promotions.php"
   ],
   "notes": [],
   "cases": [],
   "lic": "qr_customer_order",
   "src": "CustomerOrdering.addItem/applyCustomerPromo",
   "test": ""
  },
  {
   "id": "CUS-03",
   "mod": "CUSTOMER",
   "sec": "Gọi món",
   "title": "Gửi đơn & cơ chế chống spam",
   "roles": [
    "customer",
    "guest"
   ],
   "summary": "Gửi đơn kèm access_token riêng. Hệ thống giới hạn số lượng, chống gửi trùng và chặn kẻ phá.",
   "steps": [
    "Bấm Gửi đơn → nhận mã đơn.",
    "Chờ Phục vụ/Thu ngân duyệt."
   ],
   "data": [
    "orders",
    "qr_blacklist"
   ],
   "api": [
    "POST /api/orders.php?action=submit_customer_order"
   ],
   "notes": [
    "Số lượng 1 món tối đa 20; chống gửi lặp trong 60 giây; vượt giới hạn tần suất trả 429; IP/SĐT spam bị đưa vào blacklist."
   ],
   "cases": [
    "Khách bị chặn nhầm → Admin xóa dòng trong qr_blacklist hoặc chờ hết hạn."
   ],
   "lic": "",
   "src": "customer_app.js (submitOrderDirect) · slave_dot6_handlers.cpp",
   "test": "smoke_test_dot6: SEC-18"
  },
  {
   "id": "CUS-04",
   "mod": "CUSTOMER",
   "sec": "Thanh toán",
   "title": "Thanh toán VietQR & báo đã chuyển khoản",
   "roles": [
    "customer",
    "guest"
   ],
   "summary": "Tạo mã VietQR đúng số tiền; khách bấm “Tôi đã chuyển khoản xong”; ngân hàng gọi Webhook hoặc Thu ngân xác nhận.",
   "steps": [
    "Chọn Thanh toán VietQR → quét mã.",
    "Chuyển khoản → bấm Tôi đã chuyển khoản xong."
   ],
   "data": [
    "orders",
    "payment_transactions"
   ],
   "api": [
    "GET /api/payment/vietqr_payload",
    "POST /api/payment/webhook"
   ],
   "notes": [
    "Webhook ngân hàng xác thực chữ ký HMAC (X-Signature)."
   ],
   "cases": [],
   "lic": "vietqr_payment",
   "src": "CustomerOrdering.markTransferSent",
   "test": "smoke_test_dot6: PAY-03 (Webhook HMAC)"
  },
  {
   "id": "CUS-05",
   "mod": "CUSTOMER",
   "sec": "Theo dõi",
   "title": "Theo dõi tiến độ & Đánh giá sao",
   "roles": [
    "customer",
    "guest"
   ],
   "summary": "Xem tiến độ Đang chế biến → Đã xong → Đã bưng ra; sau đó chấm 1–5 sao và góp ý.",
   "steps": [
    "Mở mục theo dõi đơn.",
    "Hoàn tất → chọn số sao → Gửi đánh giá."
   ],
   "data": [
    "orders",
    "order_reviews",
    "kpi_logs"
   ],
   "api": [
    "GET /api/orders.php?action=customer_status",
    "POST /api/orders.php?action=submit_review"
   ],
   "notes": [
    "Điểm sao tự quy ra KPI cho phục vụ/bếp theo bảng điểm (5★ +5 … 1★ −5)."
   ],
   "cases": [],
   "lic": "",
   "src": "CustomerOrdering.checkOrderStatus/submitReview",
   "test": ""
  },
  {
   "id": "CUS-06",
   "mod": "CUSTOMER",
   "sec": "Giải trí",
   "title": "Jukebox cho khách & Quảng cáo carousel",
   "roles": [
    "customer",
    "guest"
   ],
   "summary": "Khách chọn bài, bỏ phiếu bài đang chờ; trang đầu có slide quảng cáo/khuyến mãi.",
   "steps": [
    "Mở Jukebox → chọn bài hát → xếp hàng đợi.",
    "Bỏ phiếu để đẩy bài lên trước."
   ],
   "data": [
    "media_jukebox_queue",
    "media_jukebox_votes",
    "store_settings.customer_ad_slides"
   ],
   "api": [
    "POST /api/media/moderate_song",
    "GET /api/media/tracks"
   ],
   "notes": [
    "Bài vi phạm có thể bị kiểm duyệt bởi Admin."
   ],
   "cases": [],
   "lic": "mod_media_stream",
   "src": "CustomerJukebox · CustomerAdCarousel",
   "test": ""
  },
  {
   "id": "ONLINE-01",
   "mod": "ONLINE",
   "sec": "Danh sách",
   "title": "Danh sách đơn mang về / giao đi & KPI nhanh",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Ba thẻ KPI: Đang xử lý, Chờ thanh toán, Chờ giao; lọc theo trạng thái.",
   "steps": [
    "Mở online_orders.html.",
    "Lọc theo trạng thái cần xử lý."
   ],
   "data": [
    "orders"
   ],
   "api": [
    "GET /api/orders.php?action=online_list"
   ],
   "notes": [],
   "cases": [],
   "lic": "",
   "src": "online_orders.js (OnlineOrders.load/setFilter)",
   "test": ""
  },
  {
   "id": "ONLINE-02",
   "mod": "ONLINE",
   "sec": "Thanh toán",
   "title": "Xác nhận thanh toán trước khi chuyển Bếp",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Đơn mang về/online chỉ được chuyển Bếp khi đã có xác nhận tiền (Webhook, Thu ngân xác nhận, hoặc duyệt COD).",
   "steps": [
    "Chọn đơn → Xác nhận thanh toán.",
    "Chọn phương thức (tiền mặt/chuyển khoản/COD) → xác nhận.",
    "Đơn tự chuyển xuống Bếp."
   ],
   "data": [
    "orders.payment_status",
    "orders.payment_verified_by",
    "payment_transactions"
   ],
   "api": [
    "POST /api/orders.php?action=confirm_payment"
   ],
   "notes": [
    "Có phân quyền riêng cho thao tác thanh toán/giao hàng."
   ],
   "cases": [],
   "lic": "",
   "src": "online_orders.js (confirmPayment)",
   "test": ""
  },
  {
   "id": "ATT-01",
   "mod": "ATTEND",
   "sec": "Theo dõi ca",
   "title": "Bảng ca làm việc real-time toàn quán",
   "roles": [
    "admin",
    "cashier",
    "kitchen",
    "waiter"
   ],
   "summary": "Admin thấy tất cả nhân viên với 8 trạng thái, tự cập nhật 5 giây; nhân viên chỉ thấy ca của mình và các nút chuyển trạng thái.",
   "steps": [
    "Admin mở nút Theo Dõi Ca (Admin) hoặc /attendance.html.",
    "Xem thẻ KPI: Đang trực, Mất kết nối, Giao hàng, Nghỉ giữa ca, Chốt ca sớm, Tăng ca OT, Đã tan ca, Chưa vào ca.",
    "Lọc theo bộ phận; bấm Điểm danh / Chốt ca hộ khi cần."
   ],
   "data": [
    "attendances",
    "shift_state_logs",
    "attendance_devices"
   ],
   "api": [
    "GET /api/hr/live-board"
   ],
   "notes": [
    "Mất kết nối = quá 90 giây không có heartbeat; quá 4 giờ chuyển “chờ Quản lý duyệt”.",
    "Nhân viên chỉ quẹt máy Hikvision/Kiosk không bị báo mất kết nối giả."
   ],
   "cases": [
    "Quên Check-out → hiện cờ chờ duyệt, Admin chốt giờ thực tế, không cộng khống 24h."
   ],
   "lic": "",
   "src": "slave_dot6_handlers.cpp (/api/hr/live-board) · attendance_kiosk.js",
   "test": "Đã build + smoke_test_dot6/7; cần thử thực tế"
  },
  {
   "id": "ATT-02",
   "mod": "ATTEND",
   "sec": "Theo dõi ca",
   "title": "Chuyển trạng thái ca: Giao hàng, Nghỉ giữa buổi, Chốt ca sớm",
   "roles": [
    "cashier",
    "kitchen",
    "waiter",
    "admin"
   ],
   "summary": "Nhân viên tự báo trạng thái; mọi chuyển đổi ghi vào nhật ký shift_state_logs.",
   "steps": [
    "Đi giao hàng: nhập mã đơn → hệ thống đếm phút.",
    "Nghỉ giữa buổi → khi quay lại phút nghỉ được tách khỏi giờ công.",
    "Chốt ca sớm: nhập lý do; nhân viên cần PIN Quản lý."
   ],
   "data": [
    "attendances.live_status",
    "attendances.break_minutes",
    "shift_state_logs"
   ],
   "api": [
    "POST /api/hr/shift-status"
   ],
   "notes": [
    "Admin có thể điểm danh hộ và chốt ca hộ (ghi tên người thao tác)."
   ],
   "cases": [],
   "lic": "",
   "src": "slave_dot6_handlers.cpp (/api/hr/shift-status)",
   "test": ""
  },
  {
   "id": "ATT-03",
   "mod": "ATTEND",
   "sec": "Chấm công",
   "title": "Chấm công tài khoản cá nhân (Web)",
   "roles": [
    "cashier",
    "kitchen",
    "waiter"
   ],
   "summary": "Check-in/Check-out thủ công bằng tài khoản; mặc định hệ thống đã tự Check-in khi đăng nhập (auto_login).",
   "steps": [
    "Tab Tài Khoản Cá Nhân → CHECK-IN/CHECK-OUT.",
    "Xem lịch sử 14 ngày."
   ],
   "data": [
    "attendances"
   ],
   "api": [
    "POST /api/operations.php?action=web_checkin|web_checkout"
   ],
   "notes": [
    "Cooldown 3 phút chống thao tác nhầm."
   ],
   "cases": [],
   "lic": "",
   "src": "attendance_kiosk.js",
   "test": "smoke_test_dot6: HR-07"
  },
  {
   "id": "ATT-04",
   "mod": "ATTEND",
   "sec": "Chấm công",
   "title": "Kiosk PIN 6 số + Selfie",
   "roles": [
    "cashier",
    "kitchen",
    "waiter"
   ],
   "summary": "Dành cho tablet chung ở quầy: nhập PIN, chụp ảnh xác thực (tùy chọn).",
   "steps": [
    "Tab Kiosk Quầy → nhập PIN → QUẸT CÔNG.",
    "Chế độ Tự động nhận diện: chưa vào ca → Check-in, đang ca → Check-out."
   ],
   "data": [
    "attendances",
    "attendance_raw_logs"
   ],
   "api": [
    "POST /api/operations.php?action=kiosk_punch"
   ],
   "notes": [
    "Khóa tạm khi nhập sai PIN nhiều lần."
   ],
   "cases": [],
   "lic": "",
   "src": "attendance_kiosk.js",
   "test": "smoke_test_dot6: HR-08/09"
  },
  {
   "id": "WIFI-01",
   "mod": "WIFI",
   "sec": "Portal",
   "title": "Mở khóa WiFi Dùng thử (giới hạn phiên) & WiFi VIP dài hạn theo Mã Hóa Đơn",
   "roles": [
    "guest"
   ],
   "summary": "Trang chào Captive Portal tốc độ tối đa kèm banner quảng cáo của quán: khách có thể chọn Dùng thử miễn phí (giới hạn thời lượng phiên, VD 10 phút; tùy chọn nhập tên/SĐT nhận voucher) hoặc nhập Mã Hóa Đơn để mở khóa phiên WiFi VIP dài hạn ổn định.",
   "steps": [
    "Khách nối WiFi quán → trang chào tự mở (UniFi Captive Portal) kèm banner ưu đãi, nút đổi VI/EN và Sáng/Tối.",
    "Tab Dùng thử (Miễn phí): tùy chọn nhập Tên/SĐT nhận voucher → bấm KẾT NỐI WIFI MIỄN PHÍ NGAY (tốc độ tối đa theo thời lượng phiên dùng thử).",
    "Tab WiFi VIP: nhập Mã Hóa Đơn in trên bill (VD: HD261117-0001) → bấm MỞ KHÓA WIFI VIP NGAY để duyệt phiên kết nối dài hạn ổn định."
   ],
   "data": [
    "wifi leads (mod_network_qos)",
    "orders"
   ],
   "api": [
    "GET /api/wifi/portal_info",
    "POST /api/wifi/unlock",
    "GET /api/wifi/leads"
   ],
   "notes": [
    "Cả 2 chế độ đều mở tốc độ tối đa, phân biệt theo thời lượng phiên (Dùng thử ngắn hạn vs VIP dài hạn theo hóa đơn), không còn phân chia băng thông 5M/50M cũ.",
    "Cần cấu hình UniFi + Router QoS (xem tài liệu 12 mục 7)."
   ],
   "cases": [
    "Không chuyển trang chào → kiểm tra Pre-Authorization Allowances trên UniFi."
   ],
   "lic": "mod_network_qos",
   "src": "slave/web/wifi.html · mod_network_qos",
   "test": ""
  },
  {
   "id": "AD-01",
   "mod": "ADMIN",
   "sec": "Vận Hành › Tổng Quan Doanh Số",
   "title": "Dashboard, biểu đồ doanh thu & Trợ lý AI Copilot",
   "roles": [
    "admin"
   ],
   "summary": "Biểu đồ doanh thu theo Hôm nay/7/14/30 ngày/Tháng này/Tháng trước/Tùy chọn; món bán chạy; hỏi đáp AI về quán.",
   "steps": [
    "Chọn khoảng thời gian trên biểu đồ (hoặc khoảng tự chọn → Lọc).",
    "Dùng Tóm tắt hôm nay / Gợi ý nhập kho / Kiểm tra bất thường hoặc gõ câu hỏi → Hỏi AI."
   ],
   "data": [
    "orders",
    "order_items",
    "materials"
   ],
   "api": [
    "GET /api/reports.php",
    "POST /api/ai/copilot"
   ],
   "notes": [
    "AI cần Gemini API Key hợp lệ (xem AD-15d)."
   ],
   "cases": [
    "AI báo lỗi key → vào Cài Đặt › AI & Telegram kiểm tra key."
   ],
   "lic": "advanced_reports",
   "src": "admin.js · tab-dashboard",
   "test": ""
  },
  {
   "id": "AD-02",
   "mod": "ADMIN",
   "sec": "Vận Hành › Bàn & Khu Vực (QR)",
   "title": "Quản lý bàn, tạo hàng loạt & in Standee QR",
   "roles": [
    "admin"
   ],
   "summary": "Thêm/sửa bàn Tại quán và Mang về, tạo hàng loạt, in standee QR cho từng bàn hoặc toàn bộ.",
   "steps": [
    "Thêm Bàn hoặc Tạo Hàng Loạt (TQ1..TQ8, MV1..MV5).",
    "In Toàn Bộ Standee QR hoặc từng bàn.",
    "Lọc Tất cả/Tại quán/Mang về."
   ],
   "data": [
    "tables_areas"
   ],
   "api": [
    "POST /api/tables.php?action=add_table|batch_add_tables",
    "GET /api/orders.php?action=qr_token"
   ],
   "notes": [
    "QR mang chữ ký bàn; đổi IP LAN phải in lại QR."
   ],
   "cases": [
    "Đổi IP máy chủ → cập nhật ở Cài Đặt › Thiết Lập Máy Chủ rồi in lại QR."
   ],
   "lic": "qr_table_order",
   "src": "admin.js · tab-tables",
   "test": ""
  },
  {
   "id": "AD-03",
   "mod": "ADMIN",
   "sec": "Vận Hành › Lịch Sử Hóa Đơn",
   "title": "Tra cứu hóa đơn & xem chi tiết",
   "roles": [
    "admin"
   ],
   "summary": "Lọc 7/14 ngày/1 tháng hoặc theo khoảng ngày; xem chi tiết từng hóa đơn.",
   "steps": [
    "Chọn khoảng ngày → Lọc.",
    "Bấm Xem để mở chi tiết (món, thanh toán, người thao tác)."
   ],
   "data": [
    "orders",
    "order_items",
    "payment_transactions"
   ],
   "api": [
    "GET /api/orders.php?action=history"
   ],
   "notes": [],
   "cases": [],
   "lic": "",
   "src": "admin.js · tab-orders",
   "test": ""
  },
  {
   "id": "AD-04",
   "mod": "ADMIN",
   "sec": "Thực Đơn & Kho › Mặt Hàng (F4)",
   "title": "Quản lý mặt hàng, công thức, ảnh & AI",
   "roles": [
    "admin"
   ],
   "summary": "Thêm/sửa món với giá bán, giá vốn, công thức nguyên liệu, ảnh (tìm/AI tạo/cắt 4:3), tạm khóa và nội dung đa ngôn ngữ.",
   "steps": [
    "Thêm Mặt Hàng (Insert/F4) → nhập mã, tên, nhóm, ĐVT, giá.",
    "Thêm Nguyên liệu vào công thức để tự trừ kho/tính giá vốn.",
    "Ảnh: Tìm & Đồng Bộ Ảnh hoặc AI Tạo Ảnh → Cắt 4:3.",
    "Lưu Mặt Hàng; dùng AI Cập Nhật Ảnh Thực Đơn để gán ảnh hàng loạt."
   ],
   "data": [
    "products",
    "categories",
    "materials",
    "products.i18n_json"
   ],
   "api": [
    "POST /api/products.php",
    "POST /api/products.php?action=ai_generate_dish_image"
   ],
   "notes": [
    "Món có thể khóa nhanh bởi Bếp (86)."
   ],
   "cases": [],
   "lic": "ai_dish_studio",
   "src": "admin_inventory.js · tab-products",
   "test": ""
  },
  {
   "id": "AD-05",
   "mod": "ADMIN",
   "sec": "Thực Đơn & Kho › Nhóm Hàng",
   "title": "Quản lý nhóm hàng",
   "roles": [
    "admin"
   ],
   "summary": "Thêm/sửa/xóa nhóm, thứ tự hiển thị, xem số món trong nhóm.",
   "steps": [
    "Thêm Nhóm Hàng → nhập tên, icon, thứ tự → Lưu."
   ],
   "data": [
    "categories"
   ],
   "api": [
    "POST /api/categories.php"
   ],
   "notes": [],
   "cases": [],
   "lic": "",
   "src": "admin.js · tab-categories",
   "test": ""
  },
  {
   "id": "AD-06",
   "mod": "ADMIN",
   "sec": "Thực Đơn & Kho › Kho & Chi Phí Vật Liệu",
   "title": "Kho nguyên vật liệu: nhập, xuất, định mức, chi phí",
   "roles": [
    "admin"
   ],
   "summary": "Danh mục NVL với tồn kho, định mức tối thiểu, giá nhập gần nhất; nhập kho 3 cách, xuất kho sử dụng, lịch sử & chi phí.",
   "steps": [
    "Thêm Nguyên Liệu → nhập mã, nhóm, ĐVT, định mức.",
    "Nhập Kho: Thủ công / Tải ảnh hóa đơn / Camera (AI quét hóa đơn).",
    "Xuất Kho Sử Dụng khi dùng NVL.",
    "Lịch Sử & Chi Phí để xem từng phiếu."
   ],
   "data": [
    "materials",
    "material_transactions",
    "supplier_invoices",
    "supplier_invoice_items"
   ],
   "api": [
    "POST /api/operations.php?action=add_transaction|batch_import_materials|ai_parse_invoice"
   ],
   "notes": [
    "Dưới định mức tối thiểu hiển thị cảnh báo."
   ],
   "cases": [],
   "lic": "inventory_recipes",
   "src": "admin_ops_kpi.js · tab-operations › Kho",
   "test": ""
  },
  {
   "id": "AD-07",
   "mod": "ADMIN",
   "sec": "Thực Đơn & Kho › Kho › Nhà cung cấp & Công nợ",
   "title": "Nhà cung cấp, hóa đơn mua & công nợ",
   "roles": [
    "admin"
   ],
   "summary": "Quản lý nhà cung cấp, hóa đơn mua, hạn thanh toán và ghi nhận thanh toán từng đợt.",
   "steps": [
    "Mở Nhà Cung Cấp & Công Nợ.",
    "Thêm NCC; xem Hóa đơn & Công nợ; Ghi nhận thanh toán."
   ],
   "data": [
    "suppliers",
    "supplier_invoices",
    "supplier_payments",
    "finance_expenses"
   ],
   "api": [
    "POST /api/finance.php"
   ],
   "notes": [],
   "cases": [],
   "lic": "",
   "src": "admin_ops_kpi.js (openSupplierFinanceModal)",
   "test": ""
  },
  {
   "id": "AD-08",
   "mod": "ADMIN",
   "sec": "Nhân Sự & Bếp › Nhân Viên & Phân Quyền",
   "title": "Người dùng, vai trò, PIN & mã nhân viên",
   "roles": [
    "admin"
   ],
   "summary": "Tạo tài khoản với vai trò admin/cashier/kitchen/waiter/customer, mã nhân viên, SĐT, PIN, lương/giờ.",
   "steps": [
    "Thêm Người Dùng Mới → nhập tài khoản, họ tên, vai trò, mã NV, PIN.",
    "Đổi mật khẩu/PIN từ hộp thoại riêng."
   ],
   "data": [
    "users"
   ],
   "api": [
    "POST /api/users.php",
    "POST /api/users.php?action=change_my_pin"
   ],
   "notes": [
    "user_code là khóa khớp với máy chấm công Hikvision."
   ],
   "cases": [
    "Trùng user_code → máy chấm công gán nhầm; giữ mã duy nhất."
   ],
   "lic": "",
   "src": "admin.js · tab-users",
   "test": ""
  },
  {
   "id": "AD-09",
   "mod": "ADMIN",
   "sec": "Nhân Sự & Bếp › Hiệu Suất Bếp & Phục Vụ",
   "title": "Phân tích hiệu suất & nhật ký phục vụ",
   "roles": [
    "admin"
   ],
   "summary": "Bảng xếp hạng phục vụ/thu ngân, món chế biến nhiều nhất, nhật ký phục vụ & pha chế thời gian thực.",
   "steps": [
    "Chọn Hôm nay/Hôm qua/7 ngày/Tháng này hoặc khoảng ngày → Lọc."
   ],
   "data": [
    "kitchen_service_logs",
    "kpi_logs",
    "orders"
   ],
   "api": [
    "GET /api/operations.php?action=analytics"
   ],
   "notes": [],
   "cases": [],
   "lic": "",
   "src": "admin_ops_kpi.js · tab-analytics",
   "test": ""
  },
  {
   "id": "AD-10",
   "mod": "ADMIN",
   "sec": "Nhân Sự & Bếp › Vận hành › Trực Ca Realtime",
   "title": "Danh sách nhân viên đang làm việc",
   "roles": [
    "admin"
   ],
   "summary": "Bảng nhân viên đang trong ca: vị trí, giờ check-in, thời gian làm, trạng thái, thiết bị/IP; Duyệt OT và Chốt ca hộ.",
   "steps": [
    "Vào Thực Đơn & Kho › Kho & Chi Phí Vật Liệu → tab Trực Ca Realtime.",
    "Bấm Duyệt OT để nhập hệ số tăng ca (1.5/2.0/3.0), hoặc Chốt Ca khi nhân viên quên check-out."
   ],
   "data": [
    "attendances",
    "users"
   ],
   "api": [
    "GET /api/operations.php?action=get_realtime_staff",
    "POST /api/operations.php?action=approve_overtime|manual_checkout"
   ],
   "notes": [
    "Bảng này không hiện mức lương; chỉ hiện thiết bị + IP."
   ],
   "cases": [],
   "lic": "staff_shifts",
   "src": "admin_ops_kpi.js (loadRealtimeStaff)",
   "test": ""
  },
  {
   "id": "AD-11",
   "mod": "ADMIN",
   "sec": "Nhân Sự & Bếp › Vận hành › Chấm Công & Tiền Lương",
   "title": "Khung giờ ca, bảng lương & nhật ký chấm công",
   "roles": [
    "admin"
   ],
   "summary": "Cấu hình 2 ca + tự chốt ca; kỳ lương Nháp → Khóa sổ → Chi lương; nhật ký chấm công có lọc, thêm công bù, xuất PDF; khai báo máy Hikvision.",
   "steps": [
    "Lưu Khung Giờ (ca 1/ca 2, grace, tự đóng ca).",
    "Bảng lương: Chốt/Cập nhật nháp → Khóa sổ kỳ lương → Xác nhận chi lương (Mở khóa nếu cần).",
    "Nhật ký: Lọc, Thêm công bù, Xuất PDF.",
    "Hikvision: nhập IP/Port/Tài khoản → Lưu → Test / Sync NV / Kéo Log."
   ],
   "data": [
    "attendances",
    "payroll_cycles",
    "payroll_items",
    "attendance_devices",
    "attendance_raw_logs",
    "store_settings.shift*"
   ],
   "api": [
    "POST /api/operations.php?action=save_payroll_cycle|lock_payroll_cycle|mark_payroll_paid",
    "POST /api/attendance/hikvision/*"
   ],
   "notes": [
    "Chống trùng chấm công theo external_event_id + cooldown 10 phút với Hikvision.",
    "Khớp nhân viên theo user_code (không theo họ tên)."
   ],
   "cases": [
    "Không có máy Hikvision: bỏ qua phần này, hệ thống chạy thuần Web/Kiosk."
   ],
   "lic": "staff_shifts",
   "src": "admin_ops_kpi.js · slave_dot6_handlers.cpp",
   "test": "smoke_test_dot6: HR-07/08/09"
  },
  {
   "id": "AD-12",
   "mod": "ADMIN",
   "sec": "Nhân Sự & Bếp › Vận hành › KPI & Thưởng",
   "title": "SLA, điểm KPI & đánh giá sao",
   "roles": [
    "admin"
   ],
   "summary": "Thiết lập SLA mặc định và theo khung giờ cao điểm, bảng điểm KPI, nhật ký cộng/trừ, danh sách đánh giá sao.",
   "steps": [
    "KPI & Thưởng → Thiết lập SLA & Điểm KPI.",
    "Sửa SLA Bếp/Phục vụ, thêm/sửa/xóa mốc cao điểm, bảng điểm → Lưu Cấu Hình."
   ],
   "data": [
    "kpi_sla_settings",
    "sla_time_slots",
    "kpi_logs",
    "order_reviews"
   ],
   "api": [
    "POST /api/operations.php?action=save_kpi_sla"
   ],
   "notes": [
    "Mặc định: nền 100; bếp đúng hạn +2/bị hối −5; phục vụ đúng hạn +2/bị nhắc −3; sao 5/4/3/2/1 = +5/+2/0/−3/−5."
   ],
   "cases": [],
   "lic": "staff_kpi",
   "src": "admin_ops_kpi.js (loadKpi, saveKpiSlaSettings)",
   "test": ""
  },
  {
   "id": "AD-13",
   "mod": "ADMIN",
   "sec": "Hệ Thống & Quán › Kế Toán Ca & Kiểm Toán",
   "title": "Kiểm toán nội bộ, đối soát ca & P&L",
   "roles": [
    "admin"
   ],
   "summary": "Cảnh báo chống thất thoát, đối soát bàn giao ca & két, bảng P&L so sánh 3 tháng, chi phí/công nợ, cấu hình thuế, xuất CSV.",
   "steps": [
    "Làm mới Audit để xem log cảnh báo.",
    "Đối soát ca: so Tiền lý thuyết / Tiền thực đếm / Chênh lệch.",
    "Thêm chi phí/Công nợ; Cấu hình thuế (VAT); Xuất CSV."
   ],
   "data": [
    "audit_logs",
    "pos_shifts",
    "finance_expenses",
    "payment_transactions"
   ],
   "api": [
    "GET /api/finance.php?action=audit_and_shifts",
    "POST /api/finance.php"
   ],
   "notes": [
    "Mở két không bán, hủy đơn đã TT, giảm giá lớn đều xuất hiện ở Audit."
   ],
   "cases": [],
   "lic": "finance_reports",
   "src": "admin_finance_ecr.js · tab-finance",
   "test": ""
  },
  {
   "id": "AD-14",
   "mod": "ADMIN",
   "sec": "Hệ Thống & Quán › Âm Nhạc & Jukebox",
   "title": "Studio âm thanh DSP & Jukebox thông minh",
   "roles": [
    "admin"
   ],
   "summary": "EQ 10 băng, preset (Flat/Bass+/Vocal+/Air+), tải nhạc/YouTube/quét thư mục, tự phân loại, lịch phát theo khung giờ, kiểm duyệt bài hát khách.",
   "steps": [
    "Tải Nhạc / YouTube / Quét để thêm bài.",
    "Tự Phân Loại Kho Nhạc → đặt Khung giờ phát.",
    "Chỉnh EQ → Áp Dụng Cấu Hình EQ."
   ],
   "data": [
    "media_tracks",
    "media_jukebox_queue",
    "media_jukebox_votes",
    "media_eq_presets"
   ],
   "api": [
    "POST /api/media/tracks/*",
    "POST /api/media/schedules/save"
   ],
   "notes": [
    "Phát thông qua mod_media_stream (DLL có chữ ký)."
   ],
   "cases": [],
   "lic": "mod_media_stream",
   "src": "admin_media_dsp.js · tab-media",
   "test": ""
  },
  {
   "id": "AD-15a",
   "mod": "ADMIN",
   "sec": "Hệ Thống & Quán › Cài Đặt › Quán & Slide",
   "title": "Thông tin quán, IP LAN, trang khách, khuyến mãi & quảng cáo",
   "roles": [
    "admin"
   ],
   "summary": "Tên/địa chỉ/hotline quán, chọn card mạng LAN, trang khách hàng & quảng bá, khuyến mãi voucher, Studio quảng cáo/slide (AI tạo slide).",
   "steps": [
    "Thiết Lập Máy Chủ → chọn IP LAN → Lưu (Quét Lại IP nếu đổi mạng).",
    "Tạo Khuyến Mãi: mã, kiểu giảm, đơn tối thiểu, khung giờ, giới hạn dùng.",
    "Studio Quảng Cáo: thêm slide/video, Xem Trước, Lưu & Xuất Bản Ngay."
   ],
   "data": [
    "store_settings",
    "promotions",
    "store_settings.customer_ad_slides"
   ],
   "api": [
    "POST /api/settings.php",
    "POST /api/promotions.php",
    "POST /api/advertising.php"
   ],
   "notes": [],
   "cases": [],
   "lic": "advertising_promotions",
   "src": "admin.html · tab-settings",
   "test": ""
  },
  {
   "id": "AD-15b",
   "mod": "ADMIN",
   "sec": "Hệ Thống & Quán › Cài Đặt › VietQR & Bank",
   "title": "VietQR tự động & Cổng cà thẻ SmartPOS (ECR)",
   "roles": [
    "admin"
   ],
   "summary": "Khai báo ngân hàng/số tài khoản VietQR; liên kết máy POS thẻ (IP/TID/MID), test handshake, kết toán lô.",
   "steps": [
    "Nhập Ngân hàng + Số TK + Tên TK (có tra cứu danh sách ngân hàng).",
    "Thẻ: chọn model, kiểu kết nối, IP/Port, TID/MID → Test Handshake ECR → Lưu Liên Kết POS.",
    "Cuối ngày: Kết Toán Lô (Settle Batch)."
   ],
   "data": [
    "store_settings.bank_*",
    "card_terminal_catalog",
    "card_terminal_config",
    "card_transactions"
   ],
   "api": [
    "POST /api/settings.php",
    "POST /api/operations.php"
   ],
   "notes": [
    "Có chế độ mô phỏng để thử khi chưa có máy thẻ."
   ],
   "cases": [],
   "lic": "mod_card_payment",
   "src": "admin_finance_ecr.js",
   "test": ""
  },
  {
   "id": "AD-15c",
   "mod": "ADMIN",
   "sec": "Hệ Thống & Quán › Cài Đặt › In Hóa Đơn & Két",
   "title": "Mẫu in nhiệt, máy in & két tiền",
   "roles": [
    "admin"
   ],
   "summary": "Cấu hình 80mm/58mm, lời đầu/cuối, mẫu song ngữ, TCP ESC/POS; Test in thử.",
   "steps": [
    "Chọn khổ giấy, nhập IP:port máy in, nội dung đầu/cuối.",
    "Bấm Test In Thử để kiểm tra."
   ],
   "data": [
    "store_settings.print_*"
   ],
   "api": [
    "GET /api/printer/list",
    "POST /api/printer/print-receipt"
   ],
   "notes": [],
   "cases": [
    "Không in được → kiểm cáp/IP, thử ping máy in."
   ],
   "lic": "",
   "src": "receipt_template.js",
   "test": "smoke_test_dot6: PAY-05"
  },
  {
   "id": "AD-15d",
   "mod": "ADMIN",
   "sec": "Hệ Thống & Quán › Cài Đặt › AI & Telegram",
   "title": "Gemini API Key & Telegram Bot",
   "roles": [
    "admin"
   ],
   "summary": "Nhập khóa Gemini riêng hoặc dùng AI Credit do Master cấp; cấu hình bot Telegram nhận cảnh báo.",
   "steps": [
    "Kiểm tra & Lưu Gemini Key (hiển thị che).",
    "Nhập token bot + chat id → Lưu & Gửi Test Telegram."
   ],
   "data": [
    "store_settings.gemini_api_key"
   ],
   "api": [
    "POST /api/ai/test",
    "POST /api/telegram/test"
   ],
   "notes": [
    "Khóa được che khi hiển thị; có thể Xóa Key."
   ],
   "cases": [
    "AI không dịch/không tạo ảnh → kiểm key, hạn mức, mạng."
   ],
   "lic": "ai_dish_studio",
   "src": "admin_finance_ecr.js",
   "test": ""
  },
  {
   "id": "AD-15e",
   "mod": "ADMIN",
   "sec": "Hệ Thống & Quán › Cài Đặt › WiFi Marketing",
   "title": "WiFi Marketing & Router QoS",
   "roles": [
    "admin"
   ],
   "summary": "Khai báo router (EdgeRouter SSH/MikroTik), quét thiết bị LAN, đặt VIP/Cơ bản/Chặn, xuất Leads CSV.",
   "steps": [
    "Chọn loại router, IP, port, tài khoản → Lưu Router → Test Router.",
    "Quét Thiết Bị LAN → đổi hạng băng thông.",
    "Xuất Leads CSV."
   ],
   "data": [
    "wifi leads"
   ],
   "api": [
    "GET /api/wifi/leads"
   ],
   "notes": [],
   "cases": [],
   "lic": "mod_network_qos",
   "src": "mod_network_qos",
   "test": ""
  },
  {
   "id": "AD-15f",
   "mod": "ADMIN",
   "sec": "Hệ Thống & Quán › Cài Đặt › Master WAN",
   "title": "Kết nối Master, OTA & Sao lưu",
   "roles": [
    "admin"
   ],
   "summary": "Kết nối Master qua reverse long-polling, cập nhật OTA, sao lưu đám mây và đồng bộ.",
   "steps": [
    "Badge phiên bản (góc Admin) → Kiểm tra / Cập nhật.",
    "Sao lưu: Backup now / đồng bộ MySQL."
   ],
   "data": [
    "local_license_cache",
    "store_settings.ota_applied_version"
   ],
   "api": [
    "POST /api/system/updates",
    "POST /api/cloud_backup",
    "POST /api/license.php?action=sync_now"
   ],
   "notes": [
    "Bản vá có SHA-256; sai chữ ký sẽ bị hủy giải nén."
   ],
   "cases": [],
   "lic": "cloud_sync_backup",
   "src": "slave_updater.h · slave_license_handlers.cpp",
   "test": ""
  },
  {
   "id": "AD-15g",
   "mod": "ADMIN",
   "sec": "Hệ Thống & Quán › Bản Quyền & Self-Billing",
   "title": "Tự Gia Hạn Gói Bản Quyền & Nạp AI Credit qua VietQR ngay tại Quán",
   "roles": [
    "admin"
   ],
   "summary": "Cho phép Chủ quán tự chọn gói gia hạn hoặc gói nạp thêm AI Credit, sinh mã VietQR thanh toán trực tiếp về Master và tự động kích hoạt ngay sau khi chuyển khoản.",
   "steps": [
    "Trong Admin Slave, mở modal Gia hạn / Nạp AI Credit (modal-store-billing).",
    "Chọn loại giao dịch (Gia hạn gói dịch vụ hoặc Nạp thêm AI Credit) và gói/số lượng mong muốn → bấm Tạo đơn thanh toán.",
    "Quét mã VietQR hiển thị trên màn hình bằng app ngân hàng và chuyển khoản đúng nội dung.",
    "Hệ thống tự kiểm tra trạng thái đơn (check_billing_order) và cập nhật ngay hạn sử dụng / số dư AI Credit mới."
   ],
   "data": [
    "local_license_cache"
   ],
   "api": [
    "POST /api/license.php?action=create_billing_order",
    "GET /api/license.php?action=check_billing_order"
   ],
   "notes": [
    "Liên thông trực tiếp với cổng Self-Billing & Webhook trên Master (:8500)."
   ],
   "cases": [
    "Chuyển khoản xong nhưng chưa tự cộng → kiểm tra đúng nội dung chuyển khoản hoặc báo Kế toán Master bấm Xác nhận thủ công."
   ],
   "lic": "",
   "src": "slave/web/admin.html (modal-store-billing) · slave_license_handlers.cpp",
   "test": ""
  },
  {
   "id": "AD-07b",
   "mod": "ADMIN",
   "sec": "Thực Đơn & Kho › Nhập Kho Thông Minh",
   "title": "Nhập Kho Thông Minh 3 Cách & AI OCR Hóa Đơn Giấy",
   "roles": [
    "admin"
   ],
   "summary": "Nhập nguyên liệu và tự cập nhật giá vốn bằng 3 phương thức: Chụp Camera trực tiếp hóa đơn giấy, Tải ảnh hóa đơn lên để AI Gemini OCR tự đọc dòng hàng/số lượng/đơn giá, hoặc Nhập tay nhanh.",
   "steps": [
    "Vào Thực Đơn & Kho › Kho & Chi Phí Vật Liệu → mở modal Nhập Kho Thông Minh (modal-smart-import).",
    "Chọn 1 trong 3 tab: Chụp Camera (tab-btn-import-camera), Tải Ảnh Hóa Đơn (tab-btn-import-upload) để AI OCR tự bóc tách bảng nguyên liệu, hoặc Nhập Tay (tab-btn-import-manual).",
    "Rà soát lại tên nguyên liệu, số lượng, đơn giá, nhà cung cấp → bấm Xác nhận Nhập Kho để tự cộng tồn và ghi phiếu công nợ nếu có."
   ],
   "data": [
    "materials",
    "material_transactions",
    "supplier_invoices",
    "supplier_invoice_items"
   ],
   "api": [
    "POST /api/operations.php?action=create_material_transaction",
    "POST /api/ai/ocr_invoice"
   ],
   "notes": [
    "Mỗi lượt AI OCR hóa đơn thành công tiêu thụ 1 AI Credit từ hạn mức quán trên Master AI Vault."
   ],
   "cases": [
    "Ảnh hóa đơn mờ khiến AI đọc sai số → sửa trực tiếp ngay trên bảng xem trước trước khi bấm Lưu."
   ],
   "lic": "inventory_recipes",
   "src": "slave/web/admin.html (modal-smart-import)",
   "test": ""
  },
  {
   "id": "POS-16",
   "mod": "POS",
   "sec": "Bảo mật QR",
   "title": "Chặn khách spam đơn QR theo IP / SĐT (QR Blacklist)",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Ngăn chặn tình trạng khách phá rối gửi đơn QR ảo liên tục bằng cách chặn tạm thời IP hoặc SĐT vi phạm ngay trên hệ thống.",
   "steps": [
    "Khi phát hiện đơn QR ảo/spam từ 1 thiết bị hoặc SĐT, bấm nút Chặn spam (block_spammer) trên đơn tương ứng.",
    "Hệ thống ghi IP/SĐT vào bảng qr_blacklist có thời hạn; mọi yêu cầu đặt món mới từ nguồn bị chặn sẽ bị từ chối tức thì."
   ],
   "data": [
    "qr_blacklist",
    "orders",
    "audit_logs"
   ],
   "api": [
    "POST /api/orders.php?action=block_spammer"
   ],
   "notes": [
    "Chặn có thời hạn nên không ảnh hưởng vĩnh viễn tới các khách khác dùng lại IP LAN sau đó."
   ],
   "cases": [
    "Lỡ chặn nhầm khách thật → Admin kiểm tra/gỡ trong danh sách chặn hoặc chờ hết thời hạn chặn."
   ],
   "lic": "",
   "src": "slave/src/slave_dot6_handlers.cpp (block_spammer)",
   "test": ""
  },
  {
   "id": "JUK-01",
   "mod": "JUKEBOX",
   "sec": "Trình phát đa tab",
   "title": "Audio Engine đa tab & Bầu chọn Tab Chủ (Leader Election)",
   "roles": [
    "admin",
    "cashier"
   ],
   "summary": "Phát nhạc nền xuyên suốt bằng Web Audio API kết hợp BroadcastChannel đồng bộ trạng thái giữa các tab và cơ chế Leader Election chỉ cho duy nhất 1 tab xuất tiếng ra loa.",
   "steps": [
    "Mở POS Thu ngân (index.html) hoặc Admin › Âm Nhạc & Jukebox (admin.html) trên máy chủ nối loa quán.",
    "Bấm nút Play/Pause, Skip, kéo thanh tua (Seek) hoặc chỉnh âm lượng trực tiếp trên thanh điều khiển nhạc.",
    "Khi mở nhiều tab trình duyệt cùng lúc, chỉ 1 tab làm Leader phát tiếng; các tab khác hiển thị đồng bộ tên bài chạy chữ (marquee) và điều khiển từ xa.",
    "Khi bấm Đăng xuất, hệ thống tự động gọi stopAndLogout() để dừng nhạc sạch sẽ."
   ],
   "data": [
    "media_jukebox_queue",
    "media_tracks"
   ],
   "api": [
    "GET /api/media/jukebox/status"
   ],
   "notes": [
    "Chống hoàn toàn tình trạng phát chồng 2 bài cùng lúc khi mở nhiều tab trên cùng 1 trình duyệt.",
    "Trình duyệt yêu cầu tối thiểu 1 thao tác chạm/click lần đầu để mở khóa Autoplay âm thanh."
   ],
   "cases": [
    "Mở 2 trình duyệt khác nhau (VD: Chrome + Edge) trên cùng 1 máy có thể phát song song → chỉ nên bật nhạc trên 1 trình duyệt chính nối loa."
   ],
   "lic": "mod_media_stream",
   "src": "slave/web/assets/js/jukebox-engine.js (init, _setupLeaderElection, playTrack, stopAndLogout)",
   "test": ""
  },
  {
   "id": "JUK-02",
   "mod": "JUKEBOX",
   "sec": "Hàng đợi & Vote",
   "title": "Hàng đợi Jukebox Thông minh, Bình chọn (Vote), Ưu tiên & Skip bài",
   "roles": [
    "admin",
    "cashier",
    "customer"
   ],
   "summary": "Quản lý bài đang phát (Now Playing) và danh sách hàng đợi phát kế tiếp; cho phép khách/nhân viên bình chọn đẩy bài lên đầu, xóa bài không phù hợp hoặc bỏ qua bài tức thì.",
   "steps": [
    "Xem khu vực Đang Phát (Now Playing) và danh sách Hàng đợi (Queue) hiển thị tên bài, nghệ sĩ, bàn yêu cầu và số phiếu bình chọn.",
    "Bấm nút Vote (👍) để tăng phiếu đẩy bài yêu thích lên vị trí ưu tiên cao hơn.",
    "Chủ quán / Thu ngân có thể bấm Skip để chuyển ngay sang bài kế tiếp hoặc bấm Xóa (🗑️) để gỡ bài không phù hợp khỏi hàng đợi."
   ],
   "data": [
    "media_jukebox_queue",
    "media_jukebox_votes",
    "media_tracks"
   ],
   "api": [
    "GET /api/media/jukebox/status",
    "POST /api/media/jukebox/request",
    "POST /api/media/jukebox/vote",
    "POST /api/media/jukebox/skip",
    "POST /api/media/jukebox/remove"
   ],
   "notes": [
    "Áp dụng luật chống phá rối (Anti-Spam): giới hạn thời gian giãn cách giữa các lần yêu cầu theo bàn và chống chọn trùng bài vừa phát."
   ],
   "cases": [
    "Hàng đợi trống → hệ thống tự động phát ngẫu nhiên các bài thuộc thể loại đang khớp với Lịch phát nhạc theo khung giờ."
   ],
   "lic": "mod_media_stream",
   "src": "slave/web/assets/js/admin_media_dsp.js · jukebox-engine.js",
   "test": ""
  },
  {
   "id": "JUK-03",
   "mod": "JUKEBOX",
   "sec": "Âm thanh DSP",
   "title": "Bộ xử lý 10-Band DSP Equalizer, Preamp, Sóng âm động & Auto Audio Ducking",
   "roles": [
    "admin",
    "cashier"
   ],
   "summary": "Tinh chỉnh chất âm chuyên nghiệp với 10 dải tần (31Hz–16kHz), Preamp gain, 15 bộ Preset lưu sẵn, đồ thị sóng âm động thời gian thực và chế độ tự hạ nhạc nền khi gọi loa.",
   "steps": [
    "Vào Admin › Âm Nhạc & Jukebox (hoặc tab EQ trong Jukebox Mini trên POS).",
    "Chọn nhanh 1 trong 15 Preset có sẵn (Morning Chill, Acoustic, Lounge, Gaming EDM, Flat...) hoặc kéo từng thanh trượt 10 dải tần (31Hz, 62Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz) và Preamp.",
    "Bấm Reset Flat để đưa toàn bộ dải tần về 0dB, hoặc bấm Áp Dụng Cấu Hình EQ để lưu và áp dụng ngay.",
    "Bật công tắc Auto Audio Ducking để hệ thống tự động giảm âm lượng nhạc nền mỗi khi phát chuông/thông báo gọi đơn."
   ],
   "data": [
    "media_eq_presets"
   ],
   "api": [
    "GET /api/media/eq/presets",
    "POST /api/media/eq/apply"
   ],
   "notes": [
    "Tăng 31Hz–125Hz giúp dày tiếng Sub-Bass cho buổi tối sôi động; tăng 500Hz–2kHz giúp rõ giọng hát Acoustic vào buổi sáng."
   ],
   "cases": [
    "Âm thanh bị rè/vỡ tiếng → giảm Preamp gain xuống mức 0dB hoặc thấp hơn và tránh đẩy cùng lúc nhiều thanh bass lên tối đa."
   ],
   "lic": "mod_media_stream",
   "src": "slave/web/assets/js/admin_media_dsp.js (onEqSliderInput, applyEqChanges, toggleAudioDucking)",
   "test": ""
  },
  {
   "id": "JUK-04",
   "mod": "JUKEBOX",
   "sec": "Kho nhạc offline",
   "title": "Quản lý Kho nhạc nội bộ (FLAC/MP3), Tải lên, Quét thư mục & Tự phân loại",
   "roles": [
    "admin",
    "cashier"
   ],
   "summary": "Xây dựng kho nhạc Lossless/MP3 lưu trực tiếp trên ổ cứng máy quán để phát 100% Offline không phụ thuộc Internet và không quảng cáo.",
   "steps": [
    "Mở Quản lý Kho Nhạc (openMediaManagerModal) trong Admin › Âm Nhạc & Jukebox (hoặc tab Tải lên trong POS Jukebox).",
    "Bấm Tải Nhạc Lên (upload) để chọn 1 hoặc nhiều tệp MP3/FLAC/WAV từ máy tính vào thư mục kho nhạc của quán.",
    "Hoặc chép trực tiếp tệp nhạc vào thư mục media của Slave rồi bấm Quét Lại Thư Mục (rescan) để nạp hàng loạt vào CSDL.",
    "Bấm Tự Phân Loại Kho Nhạc (auto_classify) để hệ thống tự gắn thể loại cho bài hát, hoặc tìm/lọc/xóa các bài không dùng."
   ],
   "data": [
    "media_tracks"
   ],
   "api": [
    "GET /api/media/tracks",
    "POST /api/media/tracks/upload",
    "POST /api/media/tracks/rescan",
    "POST /api/media/tracks/auto_classify",
    "POST /api/media/tracks/delete"
   ],
   "notes": [
    "Nhạc nội bộ được stream bằng chuẩn HTTP Range 206 (tua tức thì không trễ) và bảo vệ bằng HMAC-SHA256 Ticket chống tải lậu."
   ],
   "cases": [
    "Chép file vào ổ cứng nhưng chưa hiện trên danh sách → bấm nút Quét Lại Thư Mục (rescan)."
   ],
   "lic": "mod_media_stream",
   "src": "slave/web/assets/js/admin_media_dsp.js (openMediaManagerModal, autoClassifyMediaTracks) · libmod_media_stream.dll",
   "test": ""
  },
  {
   "id": "JUK-05",
   "mod": "JUKEBOX",
   "sec": "YouTube Offline",
   "title": "Nhập nhạc từ YouTube, Nghe thử, Tải về Offline & Cập nhật yt-dlp",
   "roles": [
    "admin"
   ],
   "summary": "Lấy nhạc trực tiếp từ link YouTube, nghe thử trước khi thêm, nâng cấp tải thành tệp âm thanh Offline lưu trên máy quán và tự cập nhật công cụ yt-dlp ngay trên web.",
   "steps": [
    "Trong Admin › Âm Nhạc & Jukebox, bấm Nhập từ YouTube (openYoutubeImportModal).",
    "Dán URL video/nhạc YouTube → bấm Nghe thử / Lấy thông tin (previewYoutubeAudio) để kiểm tra tiêu đề, thời lượng.",
    "Bấm Thêm vào kho nhạc (submitYoutubeAudio); có thể sửa tên bài/nghệ sĩ/thể loại bằng nút Sửa (editYoutubeTrack).",
    "Bấm Nâng cấp Tải Offline (upgradeYoutubeTrackOffline) để tải file âm thanh về lưu vĩnh viễn trên ổ cứng (theo dõi tiến trình qua job-status).",
    "Nếu YouTube đổi giao thức gây lỗi tải → bấm Cập nhật yt-dlp (updateYtdlpTool) ngay trên giao diện."
   ],
   "data": [
    "media_tracks"
   ],
   "api": [
    "POST /api/media/youtube/preview",
    "POST /api/media/youtube/add",
    "POST /api/media/youtube/edit",
    "POST /api/media/youtube/download-offline",
    "GET /api/media/youtube/job-status",
    "POST /api/media/youtube/update-ytdlp"
   ],
   "notes": [
    "Sau khi tải Offline thành công, bài hát phát mượt 100% kể cả khi quán mất mạng Internet."
   ],
   "cases": [
    "Tải YouTube thất bại → kiểm tra máy chủ quán có Internet và bấm Cập nhật yt-dlp rồi thử lại."
   ],
   "lic": "mod_media_stream",
   "src": "slave/web/assets/js/admin_media_dsp.js (openYoutubeImportModal, pollYoutubeJobStatus, updateYtdlpTool)",
   "test": ""
  },
  {
   "id": "JUK-06",
   "mod": "JUKEBOX",
   "sec": "Lịch phát tự động",
   "title": "Lịch phát nhạc thông minh theo Khung giờ trong ngày (Smart Scheduler)",
   "roles": [
    "admin"
   ],
   "summary": "Tự động chuyển đổi thể loại nhạc và không khí quán theo nhịp sinh học trong ngày (Sáng Acoustic → Trưa Lounge → Chiều Focus → Tối Gaming/EDM) không cần chỉnh tay.",
   "steps": [
    "Trong Admin › Âm Nhạc & Jukebox, mở mục Lịch Phát Nhạc Theo Khung Giờ.",
    "Bấm Thêm khung giờ (addMediaSchedule): chọn Giờ bắt đầu – Giờ kết thúc, Thể loại nhạc mục tiêu và đặt tên khung giờ.",
    "Bật/tắt nhanh từng khung lịch bằng công tắc (toggleMediaSchedule) hoặc xóa khung không dùng (deleteMediaSchedule)."
   ],
   "data": [
    "media_tracks",
    "store_settings"
   ],
   "api": [
    "GET /api/media/schedules",
    "POST /api/media/schedules/save",
    "POST /api/media/schedules/delete"
   ],
   "notes": [
    "Khi hàng đợi khách yêu cầu trống, trình phát tự động chọn bài trong kho khớp với thể loại của khung giờ hiện tại."
   ],
   "cases": [
    "Đến giờ nhưng nhạc không đổi thể loại → kiểm tra kho nhạc đã có bài thuộc thể loại đó chưa (chạy Tự Phân Loại Kho Nhạc ở JUK-04)."
   ],
   "lic": "mod_media_stream",
   "src": "slave/web/assets/js/admin_media_dsp.js (loadMediaSchedules, addMediaSchedule, toggleMediaSchedule)",
   "test": ""
  },
  {
   "id": "JUK-07",
   "mod": "JUKEBOX",
   "sec": "POS Mini Jukebox",
   "title": "Jukebox Mini tích hợp ngay trên màn hình POS Thu ngân",
   "roles": [
    "cashier",
    "admin"
   ],
   "summary": "Cho phép Thu ngân xem bài đang phát, tạm dừng/chuyển bài, chỉnh âm lượng, quản lý hàng đợi, xem lịch sử phát và chỉnh 10-Band EQ ngay tại quầy mà không cần rời màn hình bán hàng.",
   "steps": [
    "Trên thanh tiêu đề màn hình POS (index.html), quan sát viên thuốc Jukebox Mini hiển thị tên bài đang phát.",
    "Bấm vào viên Jukebox Mini để mở Modal điều khiển đầy đủ với các tab: Hàng đợi (Queue), Kho nhạc (Catalog + lọc thể loại), Lịch sử phát (History), 10-Band EQ và Tải lên / Quét nhạc.",
    "Thu ngân có thể phát ngay 1 bài trong hàng đợi, vote, xóa bài, skip hoặc giảm âm lượng nhanh khi cần trao đổi với khách."
   ],
   "data": [
    "media_tracks",
    "media_jukebox_queue",
    "media_eq_presets"
   ],
   "api": [
    "GET /api/media/tracks",
    "GET /api/media/eq/presets",
    "POST /api/media/eq/apply",
    "POST /api/media/tracks/upload"
   ],
   "notes": [
    "Viên Jukebox Mini tự ẩn nếu gói bản quyền của quán chưa kích hoạt module mod_media_stream / media_jukebox."
   ],
   "cases": [
    "Không thấy nút Jukebox trên POS → kiểm tra License trên Master đã bật module Âm nhạc & Jukebox chưa."
   ],
   "lic": "mod_media_stream",
   "src": "slave/web/assets/js/pos-jukebox.js (renderHeaderPill, openModal, renderModalContent)",
   "test": ""
  },
  {
   "id": "JUK-08",
   "mod": "JUKEBOX",
   "sec": "Khách QR chọn bài",
   "title": "Khách quét QR tại bàn chọn bài hát & Bình chọn tương tác 2 chiều",
   "roles": [
    "customer"
   ],
   "summary": "Biến điện thoại của khách tại bàn thành máy chọn nhạc Jukebox: xem bài đang phát, tìm kiếm kho nhạc của quán, gửi yêu cầu bài và bình chọn đẩy bài yêu thích.",
   "steps": [
    "Khách quét mã QR tại bàn mở trang customer.html.",
    "Chuyển sang mục Jukebox / Âm nhạc trên giao diện khách hàng.",
    "Xem bài đang phát và danh sách hàng đợi; gõ tên bài hát/ca sĩ muốn nghe → bấm Yêu cầu bài hát.",
    "Hoặc bấm nút Bình chọn (Vote) cho các bài đang nằm trong hàng đợi để đẩy bài lên phát sớm hơn."
   ],
   "data": [
    "media_tracks",
    "media_jukebox_queue",
    "media_jukebox_votes"
   ],
   "api": [
    "GET /api/media/jukebox/status",
    "POST /api/media/jukebox/request",
    "POST /api/media/jukebox/vote"
   ],
   "notes": [
    "Hệ thống tự áp dụng thời gian giãn cách (cooldown) theo từng bàn để tránh 1 bàn spam yêu cầu liên tục."
   ],
   "cases": [
    "Khách bấm yêu cầu báo chờ cooldown → nhắc khách chờ hết thời gian giãn cách hoặc dùng nút Vote cho bài sẵn có trong hàng đợi."
   ],
   "lic": "mod_media_stream",
   "src": "slave/web/customer.html · libmod_media_stream.dll",
   "test": ""
  },
  {
   "id": "STU-01",
   "mod": "STUDIO",
   "sec": "Ngôn ngữ",
   "title": "I18N Studio: sửa gốc, dịch AI & xuất bản",
   "roles": [
    "admin"
   ],
   "summary": "Danh mục ~4.800 chuỗi; sửa ngôn ngữ gốc, dịch AI theo nhóm/toàn bộ, duyệt, xuất bản /locales/<lang>.json.",
   "steps": [
    "Mở /i18n_studio.html (đã đăng nhập Admin).",
    "Chọn nhóm/ngôn ngữ đích → AI Dịch → Duyệt → Xuất bản.",
    "Nút Nạp lại từ Seed để xóa bộ nhớ tạm lỗi."
   ],
   "data": [
    "i18n_catalog",
    "locales/*.json"
   ],
   "api": [
    "GET /api/i18n/catalog",
    "POST /api/i18n/save",
    "POST /api/i18n/publish",
    "POST /api/i18n/ai-translate"
   ],
   "notes": [
    "Dịch AI chỉ gọi khi có khóa Gemini; không tự ghép từ."
   ],
   "cases": [
    "Dịch không chạy → kiểm key & kết nối."
   ],
   "lic": "",
   "src": "docs/16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html",
   "test": "smoke_test_dot7: I18N-09..14"
  },
  {
   "id": "SYS-01",
   "mod": "SYSTEM",
   "sec": "Bản quyền",
   "title": "Bản quyền ECDSA P-256 & khóa phần cứng",
   "roles": [
    "admin"
   ],
   "summary": "Mọi request qua cổng bản quyền: khóa theo Hardware ID, kiểm tra chữ ký ECDSA 6 trường, chống lùi đồng hồ, chặn module chưa cấp phép.",
   "steps": [
    "Kích hoạt: POST /api/license.php?action=activate với license key.",
    "Định kỳ đồng bộ với Master."
   ],
   "data": [
    "local_license_cache",
    "store_settings.cnx_ecdsa_enrolled"
   ],
   "api": [
    "POST /api/license.php?action=activate|sync_now|ping|status"
   ],
   "notes": [
    "Lỗi LICENSE_SIGNATURE_TAMPERED: dữ liệu bản quyền cục bộ không khớp chữ ký."
   ],
   "cases": [
    "Gặp 403 LICENSE_SIGNATURE_TAMPERED → Master gỡ khóa máy cũ (Reset Hardware Lock) rồi kích hoạt lại trên máy."
   ],
   "lic": "",
   "src": "slave_license.cpp",
   "test": "smoke_test_dot7: ARCH-04"
  },
  {
   "id": "SYS-02",
   "mod": "SYSTEM",
   "sec": "Toàn vẹn",
   "title": "Toàn vẹn Web, Health & ma trận plugin",
   "roles": [
    "admin"
   ],
   "summary": "SHA-256 từng file web (web_integrity.json) chống sửa trái phép; health; danh sách plugin DLL có chữ ký.",
   "steps": [
    "GET /api/system/integrity để kiểm tra; /api/health để giám sát."
   ],
   "data": [],
   "api": [
    "GET /api/system/integrity",
    "GET /api/health",
    "GET /api/plugins/matrix"
   ],
   "notes": [
    "Sửa file web phải chạy lại script đóng gói để cập nhật hash."
   ],
   "cases": [],
   "lic": "",
   "src": "main_slave.cpp",
   "test": "smoke_test_dot6: SEC-19"
  },
  {
   "id": "SYS-03",
   "mod": "SYSTEM",
   "sec": "Điều khiển & WAN",
   "title": "Trung tâm Điều khiển Desktop (Control Center), Kênh WAN Tunnel & Định vị GPS Quán",
   "roles": [
    "admin"
   ],
   "summary": "Ứng dụng Desktop CyberNexus_Control_Center.exe giúp bật/tắt/xem log máy chủ trực quan không cần gõ lệnh; giám sát và kết nối lại kênh WAN Tunnel tới Master; cập nhật tọa độ GPS quán.",
   "steps": [
    "Mở CyberNexus_Control_Center.exe trên máy chủ quán để khởi động/dừng an toàn cybernexus_slave.exe và mở nhanh giao diện POS/Admin.",
    "Khi quán đổi mạng hoặc mất kết nối Master, vào Admin › Cài Đặt › Master WAN bấm Kết nối lại WAN Tunnel (/api/wan_tunnel?action=reconnect).",
    "Cập nhật vị trí GPS quán (save_location) để hiển thị chính xác trên bản đồ giám sát chuỗi của Master."
   ],
   "data": [
    "store_settings",
    "local_license_cache"
   ],
   "api": [
    "GET /api/wan_tunnel",
    "POST /api/wan_tunnel?action=reconnect",
    "POST /api/settings.php?action=save_location"
   ],
   "notes": [
    "Luôn dừng máy chủ qua Control Center hoặc nút Tắt Server an toàn thay vì rút điện đột ngột."
   ],
   "cases": [
    "Kênh WAN báo ngắt kết nối → kiểm tra Internet tại quán và bấm Reconnect WAN Tunnel."
   ],
   "lic": "",
   "src": "slave/CyberNexus_Control_Center.exe · slave/src/main_slave.cpp (/api/wan_tunnel)",
   "test": ""
  }
 ],
 "flows": [
  {
   "id": "FLOW-01",
   "title": "Khách đặt món QR tại bàn → thanh toán → đánh giá",
   "actors": [
    "Khách",
    "Phục vụ",
    "Bếp",
    "Thu ngân"
   ],
   "goal": "Đưa món từ lúc khách quét QR đến khi thanh toán và có đánh giá, đo được SLA và KPI.",
   "steps": [
    {
     "actor": "Khách",
     "screen": "customer.html",
     "action": "Quét QR bàn, chọn món, gửi đơn",
     "data": "orders (status mới), app_notifications",
     "api": "POST submit_customer_order"
    },
    {
     "actor": "Phục vụ",
     "screen": "order.html",
     "action": "Nghe chuông, kiểm lại món với khách, bấm CHUYỂN BẾP",
     "data": "orders.kitchen_sent_at",
     "api": "confirm_customer_order"
    },
    {
     "actor": "Bếp",
     "screen": "kitchen.html",
     "action": "Nhận phiếu, chế biến, bấm Xong Món",
     "data": "orders.kitchen_ready_at, prep_time_minutes",
     "api": "kitchen_ready"
    },
    {
     "actor": "Phục vụ",
     "screen": "order.html",
     "action": "Mang món ra, bấm ĐÃ BƯNG RA",
     "data": "orders.served_at, deliver_time_minutes, kpi_logs",
     "api": "confirm_delivered"
    },
    {
     "actor": "Khách",
     "screen": "customer.html",
     "action": "Thanh toán VietQR hoặc tại quầy",
     "data": "payment_transactions",
     "api": "vietqr_payload / webhook"
    },
    {
     "actor": "Thu ngân",
     "screen": "index.html",
     "action": "Xác nhận thanh toán, in hóa đơn",
     "data": "orders.payment_status=paid",
     "api": "checkout"
    },
    {
     "actor": "Khách",
     "screen": "customer.html",
     "action": "Đánh giá 1–5 sao",
     "data": "order_reviews, kpi_logs",
     "api": "submit_review"
    }
   ],
   "notes": [
    "Quá SLA bếp → Phục vụ có nút Hối (xem FLOW-04).",
    "Đơn đã thanh toán vẫn được gọi thêm; phần chênh lệch quyết toán riêng (POS-10)."
   ]
  },
  {
   "id": "FLOW-02",
   "title": "Đơn Mang về / Online (cổng thanh toán trước khi vào Bếp)",
   "actors": [
    "Khách",
    "Thu ngân",
    "Bếp"
   ],
   "goal": "Chỉ chế biến khi đã có xác nhận tiền, hạn chế đơn ảo.",
   "steps": [
    {
     "actor": "Khách",
     "screen": "customer.html",
     "action": "Chọn Mang về hoặc Giao online, nhập thông tin, gửi đơn",
     "data": "orders (order_type)",
     "api": "submit_customer_order"
    },
    {
     "actor": "Thu ngân",
     "screen": "index.html",
     "action": "Thấy cảnh báo + chuông, mở Đơn Online",
     "data": "order_alerts",
     "api": ""
    },
    {
     "actor": "Thu ngân",
     "screen": "online_orders.html",
     "action": "Xác nhận thanh toán (Webhook/chuyển khoản/COD)",
     "data": "orders.payment_status, payment_verified_by",
     "api": "confirm_payment"
    },
    {
     "actor": "Bếp",
     "screen": "kitchen.html",
     "action": "Nhận phiếu, chế biến, Xong Món",
     "data": "orders.kitchen_*",
     "api": "kitchen_ready"
    },
    {
     "actor": "Thu ngân",
     "screen": "online_orders.html",
     "action": "Giao/đóng gói, hoàn tất đơn",
     "data": "orders.status=completed",
     "api": ""
    }
   ],
   "notes": [
    "COD cần quyền duyệt riêng."
   ]
  },
  {
   "id": "FLOW-03",
   "title": "Mở ca → bán hàng → kết ca đối soát quỹ",
   "actors": [
    "Thu ngân",
    "Chủ quán"
   ],
   "goal": "Mỗi ca có tiền đầu ca, thu/chi rõ ràng và chênh lệch được truy vết.",
   "steps": [
    {
     "actor": "Thu ngân",
     "screen": "index.html",
     "action": "Giao Ca / Quỹ → Mở ca, nhập tiền đầu ca",
     "data": "pos_shifts (status open)",
     "api": "open_shift"
    },
    {
     "actor": "Thu ngân",
     "screen": "index.html",
     "action": "Bán hàng; lập phiếu thu/chi khi phát sinh",
     "data": "cash_transactions, orders",
     "api": "add_cash_tx"
    },
    {
     "actor": "Thu ngân",
     "screen": "index.html",
     "action": "Cuối ca: Kết ca, nhập tiền thực đếm",
     "data": "pos_shifts.actual_cash, discrepancy",
     "api": "close_shift"
    },
    {
     "actor": "Chủ quán",
     "screen": "admin.html › Kế Toán Ca",
     "action": "Đối soát: lý thuyết − thực đếm; xem Audit",
     "data": "audit_logs",
     "api": "audit_and_shifts"
    }
   ],
   "notes": [
    "Còn đơn chưa thanh toán thì hệ thống chặn kết ca."
   ]
  },
  {
   "id": "FLOW-04",
   "title": "Hối món & nhắc phục vụ (SLA → KPI)",
   "actors": [
    "Phục vụ",
    "Bếp"
   ],
   "goal": "Rút ngắn thời gian chờ, ghi điểm công bằng.",
   "steps": [
    {
     "actor": "Hệ thống",
     "screen": "order/index",
     "action": "Quá SLA bếp: hiện số phút chờ + nút Hối",
     "data": "kpi_sla_settings, sla_time_slots",
     "api": ""
    },
    {
     "actor": "Phục vụ",
     "screen": "order.html",
     "action": "Bấm Hối",
     "data": "orders.rush_count, kpi_logs (−)",
     "api": "rush_order"
    },
    {
     "actor": "Bếp",
     "screen": "kitchen.html",
     "action": "Chuông đôi, phiếu viền đỏ, ưu tiên làm",
     "data": "",
     "api": ""
    },
    {
     "actor": "Bếp",
     "screen": "kitchen.html",
     "action": "Xong Món; nếu PV chưa ra lấy quá SLA → Báo Lại",
     "data": "orders.remind_count, kpi_logs (−)",
     "api": "remind_waiter"
    },
    {
     "actor": "Phục vụ",
     "screen": "order.html",
     "action": "Bấm ĐÃ BƯNG RA",
     "data": "orders.deliver_time_minutes, kpi_logs (+)",
     "api": "confirm_delivered"
    }
   ],
   "notes": [
    "SLA khác nhau theo khung giờ cao điểm/thấp điểm."
   ]
  },
  {
   "id": "FLOW-05",
   "title": "Hủy món / Hủy đơn",
   "actors": [
    "Phục vụ",
    "Bếp",
    "Thu ngân",
    "Chủ quán"
   ],
   "goal": "Mọi lần hủy đều có lý do, người duyệt và dấu vết.",
   "steps": [
    {
     "actor": "Phục vụ/Bếp",
     "screen": "order/kitchen",
     "action": "Gửi yêu cầu hủy kèm lý do",
     "data": "orders.cancel_request_*, order_alerts",
     "api": "request_cancel_item / kitchen_cancel"
    },
    {
     "actor": "Thu ngân",
     "screen": "index.html",
     "action": "Thấy cảnh báo → Duyệt hoặc Từ chối",
     "data": "orders.status",
     "api": "cancel_order"
    },
    {
     "actor": "Thu ngân",
     "screen": "index.html",
     "action": "Đơn đã thanh toán: nhập PIN, hoàn tiền",
     "data": "payment_transactions, audit_logs",
     "api": "cancel_order (PIN)"
    },
    {
     "actor": "Phục vụ/Bếp",
     "screen": "order/kitchen",
     "action": "Nhận kết quả, báo khách (Đã báo khách)",
     "data": "order_alerts.is_ack",
     "api": "ack_alert"
    }
   ],
   "notes": [
    "Từ chối yêu cầu hủy: phiếu bếp tiếp tục."
   ]
  },
  {
   "id": "FLOW-06",
   "title": "Nhập kho → giá vốn → công nợ nhà cung cấp",
   "actors": [
    "Chủ quán"
   ],
   "goal": "Kiểm soát tồn kho và dòng tiền mua hàng.",
   "steps": [
    {
     "actor": "Chủ quán",
     "screen": "admin › Kho",
     "action": "Nhập Kho (thủ công / ảnh / camera AI OCR)",
     "data": "material_transactions, materials.quantity",
     "api": "add_transaction / ai_parse_invoice"
    },
    {
     "actor": "Hệ thống",
     "screen": "admin",
     "action": "Cập nhật tồn, đơn giá nhập gần nhất; cảnh báo dưới định mức",
     "data": "materials",
     "api": ""
    },
    {
     "actor": "Chủ quán",
     "screen": "admin › NCC & Công nợ",
     "action": "Ghi nhận hóa đơn mua và thanh toán từng đợt",
     "data": "supplier_invoices, supplier_payments, finance_expenses",
     "api": "finance"
    },
    {
     "actor": "Chủ quán",
     "screen": "admin › Kế Toán",
     "action": "Xem chi phí vào P&L",
     "data": "finance_expenses",
     "api": "finance"
    }
   ],
   "notes": []
  },
  {
   "id": "FLOW-07",
   "title": "Chấm công → ca làm việc → kỳ lương",
   "actors": [
    "Nhân viên",
    "Chủ quán"
   ],
   "goal": "Từ đăng nhập/quẹt máy đến chi lương có kiểm soát.",
   "steps": [
    {
     "actor": "Nhân viên",
     "screen": "login.html / máy Hikvision / Kiosk",
     "action": "Đăng nhập (auto_login) hoặc quẹt máy → Check-in",
     "data": "attendances",
     "api": "auth login / hikvision event"
    },
    {
     "actor": "Hệ thống",
     "screen": "attendance.html",
     "action": "Theo dõi real-time: heartbeat, mất kết nối, giao hàng, nghỉ giữa buổi",
     "data": "attendances.live_status, shift_state_logs",
     "api": "live-board"
    },
    {
     "actor": "Chủ quán",
     "screen": "admin › Trực Ca",
     "action": "Duyệt OT, chốt ca hộ khi quên Check-out",
     "data": "attendances.is_overtime_approved",
     "api": "approve_overtime"
    },
    {
     "actor": "Chủ quán",
     "screen": "admin › Chấm Công & Lương",
     "action": "Chốt nháp → Khóa sổ → Chi lương",
     "data": "payroll_cycles, payroll_items",
     "api": "save/lock/mark_paid"
    }
   ],
   "notes": [
    "Không có Hikvision vẫn đủ luồng bằng Web/Kiosk."
   ]
  },
  {
   "id": "FLOW-08",
   "title": "Cấp phép, cập nhật OTA & toàn vẹn",
   "actors": [
    "Master",
    "Chủ quán"
   ],
   "goal": "Bảo đảm chỉ chạy bản đúng chữ ký, đúng máy, đúng gói.",
   "steps": [
    {
     "actor": "Master",
     "screen": "Super Admin",
     "action": "Cấp license key, module, gói",
     "data": "saas_tenants",
     "api": ""
    },
    {
     "actor": "Chủ quán",
     "screen": "admin › Cài Đặt › Master WAN",
     "action": "Kích hoạt trên máy (khóa Hardware ID)",
     "data": "local_license_cache",
     "api": "license activate"
    },
    {
     "actor": "Slave",
     "screen": "nền",
     "action": "Cổng bản quyền kiểm ECDSA mỗi request",
     "data": "",
     "api": ""
    },
    {
     "actor": "Master",
     "screen": "OTA",
     "action": "Đẩy bản vá; Slave tải, kiểm SHA-256, cập nhật, khởi động lại",
     "data": "store_settings.ota_applied_version",
     "api": "system/updates"
    }
   ],
   "notes": [
    "Đổi phần cứng cần Master Reset Hardware Lock."
   ]
  },
  {
   "id": "FLOW-09",
   "title": "Checklist mở ca đầu ngày",
   "actors": [
    "Chủ quán",
    "Thu ngân",
    "Bếp",
    "Phục vụ"
   ],
   "goal": "Mở quán an toàn, không sót bước.",
   "steps": [
    {
     "actor": "Chủ quán",
     "screen": "máy chủ",
     "action": "Bật máy chủ Slave; kiểm LAN/IP; mở Admin kiểm phiên bản & bản quyền",
     "data": "",
     "api": "GET /api/health"
    },
    {
     "actor": "Thu ngân",
     "screen": "index.html",
     "action": "Đăng nhập; Mở ca với tiền đầu ca; kiểm máy in/két",
     "data": "pos_shifts",
     "api": "open_shift"
    },
    {
     "actor": "Bếp",
     "screen": "kitchen.html",
     "action": "Đăng nhập; bật chuông; rà món hết hàng (86)",
     "data": "products.status",
     "api": ""
    },
    {
     "actor": "Phục vụ",
     "screen": "order.html",
     "action": "Đăng nhập; chạm kích hoạt chuông & rung",
     "data": "",
     "api": ""
    },
    {
     "actor": "Chủ quán",
     "screen": "attendance.html",
     "action": "Xem bảng ca: ai Đang trực, ai Chưa vào ca",
     "data": "attendances",
     "api": "live-board"
    }
   ],
   "notes": []
  },
  {
   "id": "FLOW-10",
   "title": "Checklist đóng ca cuối ngày",
   "actors": [
    "Thu ngân",
    "Bếp",
    "Chủ quán"
   ],
   "goal": "Chốt sạch số liệu và dữ liệu trước khi tắt máy.",
   "steps": [
    {
     "actor": "Thu ngân",
     "screen": "index.html",
     "action": "Thanh toán/hủy hết đơn mở; Kết ca nhập tiền thực đếm",
     "data": "pos_shifts",
     "api": "close_shift"
    },
    {
     "actor": "Bếp",
     "screen": "kitchen.html",
     "action": "Lưu trữ phiếu; cập nhật món hết cho ngày mai",
     "data": "",
     "api": ""
    },
    {
     "actor": "Chủ quán",
     "screen": "admin",
     "action": "Đối soát ca & Audit; duyệt OT; chốt ca hộ người quên check-out",
     "data": "audit_logs, attendances",
     "api": ""
    },
    {
     "actor": "Chủ quán",
     "screen": "admin › Cài Đặt",
     "action": "Sao lưu (Backup now); dừng máy chủ an toàn (Tắt Server)",
     "data": "",
     "api": "cloud_backup"
    }
   ],
   "notes": [
    "Không tắt nguồn đột ngột để tránh hỏng SQLite."
   ]
  },
  {
   "id": "FLOW-11",
   "title": "Vận hành Media Server & Smart Jukebox (Lịch phát nhạc → Khách QR chọn/vote bài → 10-Band EQ & YouTube Offline)",
   "actors": [
    "Chủ quán",
    "Thu ngân",
    "Khách",
    "Hệ thống"
   ],
   "goal": "Phát nhạc nền 100% offline không quảng cáo, tối ưu âm học 10-Band DSP theo khung giờ và cho khách quét QR tại bàn tương tác chọn/bình chọn bài hát.",
   "steps": [
    {
     "actor": "Chủ quán",
     "screen": "admin › Âm Nhạc & Jukebox",
     "action": "Tải nhạc nội bộ (FLAC/MP3) hoặc nhập link YouTube rồi bấm Tải Offline; chạy Tự phân loại thể loại",
     "data": "media_tracks",
     "api": "POST /api/media/tracks/upload · /api/media/youtube/download-offline"
    },
    {
     "actor": "Chủ quán",
     "screen": "admin › Âm Nhạc & Jukebox",
     "action": "Thiết lập Lịch phát nhạc theo khung giờ (Sáng Acoustic → Trưa Lounge → Tối EDM) và chọn Preset 10-Band DSP EQ",
     "data": "media_eq_presets",
     "api": "POST /api/media/schedules/save · /api/media/eq/apply"
    },
    {
     "actor": "Thu ngân",
     "screen": "index.html (POS Mini Jukebox)",
     "action": "Bật nhạc nền qua Jukebox Engine (tự bầu chọn Leader Tab chống phát chồng 2 loa), điều chỉnh âm lượng/Audio Ducking",
     "data": "media_jukebox_queue",
     "api": "GET /api/media/jukebox/status"
    },
    {
     "actor": "Khách",
     "screen": "customer.html (QR bàn)",
     "action": "Quét QR bàn → mở tab Jukebox → tìm bài hát yêu thích → bấm Yêu cầu bài hoặc Vote đẩy bài lên đầu hàng đợi",
     "data": "media_jukebox_queue, media_jukebox_votes",
     "api": "POST /api/media/jukebox/request · /api/media/jukebox/vote"
    },
    {
     "actor": "Hệ thống",
     "screen": "libmod_media_stream.dll",
     "action": "Kiểm tra luật chống spam (cooldown theo bàn), cấp Ticket HMAC-SHA256 và stream HTTP Range 206 ra loa quán mượt mà",
     "data": "media_jukebox_queue",
     "api": "GET /api/media/stream"
    }
   ],
   "notes": [
    "Nhạc phát qua trình duyệt máy chủ nối loa quán; nếu mở nhiều tab POS/Admin cùng lúc, cơ chế Leader Election chỉ cho 1 tab phát tiếng.",
    "Khi thu ngân hoặc chủ quán đăng xuất, Jukebox Engine tự động dừng phát sạch sẽ (stopAndLogout)."
   ]
  }
 ],
 "cases": [
  {
   "id": "CASE-01",
   "symptom": "Thấy “Phát hiện dữ liệu bản quyền local_license_cache bị chỉnh sửa trái phép”",
   "cause": "Chữ ký ECDSA lưu ở Slave không khớp (máy chủ Master đang khóa vào Hardware ID máy cũ hoặc dữ liệu bản quyền bị sửa).",
   "fix": "Master: Reset Hardware Lock cho quán; Slave: kích hoạt lại (license activate). Không sửa tay bảng local_license_cache.",
   "mods": [
    "SYSTEM",
    "ADMIN"
   ],
   "sev": "Cao"
  },
  {
   "id": "CASE-02",
   "symptom": "Phục vụ/Bếp không nghe chuông khi có đơn",
   "cause": "Trình duyệt chặn âm thanh cho đến khi người dùng chạm; hoặc loa đang tắt.",
   "fix": "Chạm thanh “Kích hoạt chuông & rung” (Phục vụ) / bật nút loa (Bếp). Thử chuông bằng nút loa.",
   "mods": [
    "ORDER",
    "KDS"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-03",
   "symptom": "Nhân viên bị báo “Mất kết nối” dù đang làm",
   "cause": "Quá 90 giây không có heartbeat (rớt Wi-Fi, tab bị ẩn, máy ngủ).",
   "fix": "Kiểm tra Wi-Fi; mở lại tab; heartbeat hồi phục tự trạng thái. Nhân viên chỉ quẹt Hikvision/Kiosk không bị tính.",
   "mods": [
    "ATTEND"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-04",
   "symptom": "Quên Check-out cuối ngày",
   "cause": "Nhân viên không đăng xuất/chốt ca.",
   "fix": "Trạng thái chuyển “chờ Quản lý duyệt” (không cộng khống). Admin bấm Chốt ca hộ với giờ thực tế (ghi Audit).",
   "mods": [
    "ATTEND",
    "ADMIN"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-05",
   "symptom": "Một lượt quẹt Hikvision bị ghi hai lần",
   "cause": "Push và Poll cùng nhận sự kiện.",
   "fix": "Hệ thống chống trùng theo external_event_id (thống nhất tiền tố hik_) + cooldown 10 phút; không cần xử lý tay.",
   "mods": [
    "ATTEND"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-06",
   "symptom": "Quẹt Hikvision nhưng nhân viên không có trong hệ thống",
   "cause": "user_code trên máy khác user_code trong POS.",
   "fix": "Sự kiện được lưu trạng thái unmatched_employee; Admin gán nhanh vào tài khoản (hoặc sửa user_code cho khớp).",
   "mods": [
    "ATTEND",
    "ADMIN"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-07",
   "symptom": "Khách chuyển khoản nhưng đơn chưa “Đã thanh toán”",
   "cause": "Webhook ngân hàng chưa về hoặc sai chữ ký.",
   "fix": "Thu ngân kiểm tra tiền thực tế rồi Xác nhận thanh toán thủ công (Online hoặc POS). Kiểm cấu hình Webhook/HMAC.",
   "mods": [
    "POS",
    "ONLINE",
    "CUSTOMER"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-08",
   "symptom": "Máy in không in / két không mở",
   "cause": "Sai IP:port, máy in tắt, hoặc đơn không có tiền mặt (két chỉ mở khi có tiền mặt).",
   "fix": "Admin › Cài Đặt › In Hóa Đơn & Két → Test In Thử; kiểm cáp/ping. Mở két ngoài giao dịch dùng Mở Két (cần PIN).",
   "mods": [
    "POS",
    "ADMIN"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-09",
   "symptom": "Không kết ca được",
   "cause": "Còn đơn chưa thanh toán trong ca.",
   "fix": "Thanh toán hoặc hủy các đơn còn mở rồi kết ca lại.",
   "mods": [
    "POS"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-10",
   "symptom": "Khách quét QR báo bàn không hợp lệ / không đặt được",
   "cause": "QR cũ sau khi đổi IP LAN, chữ ký bàn không khớp, hoặc IP/SĐT bị đưa vào blacklist do spam.",
   "fix": "In lại QR sau khi đổi IP; kiểm bảng qr_blacklist; chờ hết hạn chặn.",
   "mods": [
    "CUSTOMER",
    "ADMIN"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-11",
   "symptom": "WiFi Portal không chuyển sang trang chào",
   "cause": "Thiếu Pre-Authorization Allowances/URL thành công trên UniFi, hoặc firewall chặn cổng.",
   "fix": "Làm theo tài liệu 12 mục 7: thêm IP Slave + sslip.io, mở cổng 8501/8880/8843.",
   "mods": [
    "WIFI"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-12",
   "symptom": "AI không dịch / không tạo ảnh / Copilot báo lỗi",
   "cause": "Gemini key sai/hết hạn mức hoặc không ra được Internet.",
   "fix": "Cài Đặt › AI & Telegram → Kiểm tra & Lưu key; hoặc nạp AI Credit (Master).",
   "mods": [
    "ADMIN",
    "STUDIO"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-13",
   "symptom": "Sửa file web xong bị chặn “WEB_INTEGRITY_TAMPERED”",
   "cause": "Hash SHA-256 trong web_integrity.json không khớp file đã sửa.",
   "fix": "Chạy lại script đóng gói (cập nhật web_integrity.json) sau khi sửa web.",
   "mods": [
    "SYSTEM"
   ],
   "sev": "Cao"
  },
  {
   "id": "CASE-14",
   "symptom": "Bàn bị kẹt trạng thái “đang có khách”",
   "cause": "Đơn cũ còn mở hoặc chưa đồng bộ.",
   "fix": "Mở bàn kiểm đơn; thanh toán/hủy đơn; bấm Làm mới.",
   "mods": [
    "POS",
    "ORDER"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-15",
   "symptom": "Mất mạng LAN giữa giờ cao điểm",
   "cause": "Switch/Router lỗi hoặc Wi-Fi quá tải.",
   "fix": "Giữ nguyên thao tác tại máy chủ; sau khi có mạng bấm Làm mới. Đơn đã lưu ở C++ Backend nên không mất; đối chiếu bằng Lịch sử hóa đơn.",
   "mods": [
    "POS",
    "ORDER",
    "KDS"
   ],
   "sev": "Cao"
  },
  {
   "id": "CASE-16",
   "symptom": "Jukebox không phát ra tiếng, bị ẩn tab hoặc phát chồng 2 bài",
   "cause": "Chưa bật module media_jukebox trên Master, trình duyệt chặn Autoplay khi chưa chạm chuột, hoặc mở 2 trình duyệt khác nhau cùng phát nhạc.",
   "fix": "Kiểm tra quyền module media_jukebox trong License; chạm nút Play để mở khóa Web Audio; chỉ mở nhạc trên 1 máy nối loa (cùng 1 trình duyệt nhiều tab sẽ tự chống trùng qua Leader Election).",
   "mods": [
    "JUKEBOX",
    "POS",
    "ADMIN"
   ],
   "sev": "Trung bình"
  },
  {
   "id": "CASE-17",
   "symptom": "Nhập link YouTube hoặc tải nhạc YouTube Offline báo lỗi",
   "cause": "Công cụ yt-dlp đã cũ do YouTube đổi thuật toán, hoặc máy quán tạm mất Internet.",
   "fix": "Vào Admin › Âm Nhạc & Jukebox → bấm nút Cập nhật yt-dlp (update-ytdlp) rồi thử nghe trước và tải lại.",
   "mods": [
    "JUKEBOX",
    "ADMIN"
   ],
   "sev": "Trung bình"
  }
 ],
 "roles": [
  {
   "id": "admin",
   "name": "Chủ quán (Admin)",
   "home": "/admin.html"
  },
  {
   "id": "cashier",
   "name": "Thu ngân",
   "home": "/index.html"
  },
  {
   "id": "kitchen",
   "name": "Bếp / Pha chế",
   "home": "/kitchen.html"
  },
  {
   "id": "waiter",
   "name": "Phục vụ",
   "home": "/order.html"
  },
  {
   "id": "customer",
   "name": "Khách (QR)",
   "home": "/customer.html"
  }
 ],
 "matrix": [
  {
   "f": "Đăng nhập / Đăng xuất",
   "v": [
    2,
    2,
    2,
    2,
    1
   ]
  },
  {
   "f": "Bán hàng POS & thanh toán",
   "v": [
    2,
    2,
    0,
    0,
    0
   ]
  },
  {
   "f": "Giảm giá lớn / Hủy đơn đã TT / Mở két (cần PIN QL)",
   "v": [
    2,
    1,
    0,
    0,
    0
   ]
  },
  {
   "f": "Giao ca & Sổ quỹ",
   "v": [
    2,
    2,
    0,
    0,
    0
   ]
  },
  {
   "f": "Xem phiếu Bếp & Báo xong / Hết món",
   "v": [
    2,
    1,
    2,
    0,
    0
   ]
  },
  {
   "f": "Gọi món tại bàn, Hối, Bưng món",
   "v": [
    2,
    2,
    0,
    2,
    0
   ]
  },
  {
   "f": "Duyệt đơn QR của khách",
   "v": [
    2,
    2,
    0,
    2,
    0
   ]
  },
  {
   "f": "Đơn Online: xác nhận thanh toán",
   "v": [
    2,
    2,
    0,
    0,
    0
   ]
  },
  {
   "f": "Đặt món / Thanh toán / Đánh giá qua QR",
   "v": [
    0,
    0,
    0,
    0,
    2
   ]
  },
  {
   "f": "Bảng ca real-time toàn quán",
   "v": [
    2,
    1,
    1,
    1,
    0
   ]
  },
  {
   "f": "Chuyển trạng thái ca của chính mình",
   "v": [
    2,
    2,
    2,
    2,
    0
   ]
  },
  {
   "f": "Điểm danh / Chốt ca hộ, Duyệt OT",
   "v": [
    2,
    0,
    0,
    0,
    0
   ]
  },
  {
   "f": "Quản lý mặt hàng, nhóm, bàn, kho, NCC",
   "v": [
    2,
    0,
    0,
    0,
    0
   ]
  },
  {
   "f": "Nhân viên, phân quyền, lương, KPI",
   "v": [
    2,
    0,
    0,
    0,
    0
   ]
  },
  {
   "f": "Kế toán, Audit, P&L",
   "v": [
    2,
    0,
    0,
    0,
    0
   ]
  },
  {
   "f": "Cài đặt quán, VietQR, thẻ, in, AI, WiFi",
   "v": [
    2,
    0,
    0,
    0,
    0
   ]
  },
  {
   "f": "Media Server, 10-Band EQ, YouTube & Jukebox",
   "v": [
    2,
    1,
    0,
    0,
    1
   ]
  },
  {
   "f": "I18N Studio / OTA / Sao lưu",
   "v": [
    2,
    0,
    0,
    0,
    0
   ]
  }
 ],
 "guides": {
  "admin": [
   "LOGIN-01",
   "AD-15a",
   "AD-15b",
   "AD-15c",
   "AD-04",
   "AD-05",
   "AD-02",
   "AD-08",
   "AD-12",
   "AD-11",
   "AD-06",
   "AD-13",
   "JUK-04",
   "JUK-05",
   "JUK-03",
   "JUK-06",
   "ATT-01",
   "AD-01",
   "AD-15f",
   "SYS-01"
  ],
  "cashier": [
   "LOGIN-01",
   "POS-11",
   "POS-01",
   "POS-02",
   "POS-03",
   "POS-04",
   "POS-05",
   "POS-09",
   "POS-10",
   "POS-07",
   "POS-14",
   "ONLINE-02",
   "POS-12",
   "POS-08",
   "POS-13",
   "JUK-07",
   "JUK-02",
   "ATT-02"
  ],
  "kitchen": [
   "LOGIN-01",
   "KDS-07",
   "KDS-01",
   "KDS-02",
   "KDS-03",
   "KDS-04",
   "KDS-05",
   "KDS-06",
   "ATT-02"
  ],
  "waiter": [
   "LOGIN-01",
   "ORDER-01",
   "ORDER-02",
   "ORDER-03",
   "ORDER-04",
   "ORDER-05",
   "ORDER-06",
   "ORDER-07",
   "ATT-02"
  ],
  "customer": [
   "CUS-01",
   "CUS-02",
   "CUS-03",
   "CUS-04",
   "CUS-05",
   "JUK-08",
   "WIFI-01"
  ]
 },
 "db": [
  {
   "name": "app_notifications",
   "group": "Thông báo",
   "desc": "Thông báo đẩy cho Phục vụ/Thu ngân; có cờ đã đọc theo từng vai trò.",
   "rows": 26,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "type",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "order_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "table_code",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "title",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "message",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "is_read_waiter",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "is_read_cashier",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "title_key",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "msg_key",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "msg_params_json",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "attendance_devices",
   "group": "Nhân sự",
   "desc": "Danh sách máy chấm công Hikvision (IP, cổng, tài khoản, lần poll/sync/lỗi gần nhất).",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "device_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "ip_address",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "port",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "username",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "password",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "model",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "serial_number",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "is_active",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "poll_interval_sec",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "last_poll_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "last_sync_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "last_error",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "attendance_raw_logs",
   "group": "Nhân sự",
   "desc": "Mọi lượt quẹt thô từ máy chấm công/Kiosk, kể cả bị bỏ qua (cooldown) hoặc chưa khớp nhân viên.",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "device_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "device_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "employee_no",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "user_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "event_time",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "verify_mode",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "source",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "photo_path",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "external_event_id",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "attendances",
   "group": "Nhân sự",
   "desc": "Mỗi ca làm việc: giờ vào/ra, nguồn, giờ công, OT, trạng thái real-time, nghỉ giữa buổi, giao hàng, chốt sớm.",
   "rows": 402,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "user_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "user_code",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "user_role",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "work_date",
     "t": "DATE",
     "pk": false
    },
    {
     "n": "check_in_time",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "check_out_time",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "work_hours",
     "t": "DECIMAL(6, 2)",
     "pk": false
    },
    {
     "n": "hourly_rate",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "total_pay",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "status",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "device_info",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "source",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "device_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "device_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "verify_mode",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "photo_path",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "external_event_id",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "confidence",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "last_heartbeat_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "shift_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "regular_hours",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "overtime_hours",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "overtime_multiplier",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "overtime_pay",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "is_overtime_approved",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "approved_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "live_status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "break_minutes",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "break_started_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "delivery_order_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "delivery_started_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "early_leave_reason",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "late_minutes",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "pending_manager_review",
     "t": "INTEGER",
     "pk": false
    }
   ]
  },
  {
   "name": "audit_logs",
   "group": "Kiểm toán",
   "desc": "Nhật ký các hành động nhạy cảm (hủy đơn, giảm giá lớn, mở két, chốt hộ…) kèm mức độ và người thực hiện.",
   "rows": 1,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "action_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "action_label",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "severity",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "order_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "order_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "table_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "amount_impact",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "reason",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "user_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "user_role",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "details",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "card_terminal_catalog",
   "group": "Thanh toán",
   "desc": "Danh mục model máy POS thẻ được hỗ trợ (giao thức, kết nối, NFC/Chip/QR).",
   "rows": 10,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "model_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "brand",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "model_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "os_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "connection_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "default_port",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "protocol_family",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "pci_standard",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "supports_nfc",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "supports_chip",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "supports_qr",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "verification_state",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "is_blocked",
     "t": "INTEGER",
     "pk": false
    }
   ]
  },
  {
   "name": "card_terminal_config",
   "group": "Thanh toán",
   "desc": "Cấu hình liên kết máy POS thẻ của quán (IP, TID, MID, mô phỏng, số lô hiện tại).",
   "rows": 1,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "model_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "acquirer_bank",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "connection_mode",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "terminal_ip",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "terminal_port",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "terminal_id_tid",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "merchant_id_mid",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "api_secret",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "timeout_seconds",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "customer_surcharge_percent",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "simulation_mode",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "sim_behavior",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "current_batch_no",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "updated_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "card_transactions",
   "group": "Thanh toán",
   "desc": "Giao dịch quẹt thẻ: số tiền, phụ phí, phí Master, mã tham chiếu, trạng thái.",
   "rows": 2,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "tx_ref",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "order_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "table_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "base_amount",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "surcharge_percent",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "surcharge_amount",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "total_charged",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "master_fee_percent",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "master_fee_amount",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "terminal_model",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "acquirer_bank",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "tid",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "mid",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "card_scheme",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "entry_mode",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "masked_pan",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "cardholder_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "approval_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "rrn",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "batch_no",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "trace_no",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "response_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "response_message",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "is_simulation",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "cashier_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "void_reason",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "settled_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "cash_transactions",
   "group": "Quỹ",
   "desc": "Phiếu thu/chi tiền mặt tại quầy theo từng ca.",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "shift_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "trans_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "category",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "amount",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "reason",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "user_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "categories",
   "group": "Thực đơn",
   "desc": "Nhóm hàng (tên, icon, thứ tự, đa ngôn ngữ i18n_json).",
   "rows": 14,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "icon",
     "t": "VARCHAR(50)",
     "pk": false
    },
    {
     "n": "sort_order",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "status",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "i18n_json",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "finance_expenses",
   "group": "Kế toán",
   "desc": "Chi phí & công nợ (ngày, loại, nhà cung cấp, số tiền, VAT đầu vào, trạng thái).",
   "rows": 51,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "expense_date",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "category",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "description",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "supplier",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "amount",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "vat_amount",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "created_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "payment_status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "source",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "i18n_catalog",
   "group": "Ngôn ngữ",
   "desc": "Danh mục chuỗi I18N Studio lưu ở CSDL (gốc, bản dịch, trạng thái).",
   "rows": 0,
   "cols": [
    {
     "n": "key",
     "t": "TEXT",
     "pk": true
    },
    {
     "n": "group_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "layer",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "screen",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "comp_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "field_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "source_file",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "max_chars",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "origin_vi",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "translations_json",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "source_modified",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "updated_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "kitchen_service_logs",
   "group": "Bếp",
   "desc": "Nhật ký phục vụ & chế biến thời gian thực (gửi bếp, xong, bưng, hối, nhắc…) kèm thời lượng.",
   "rows": 180,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "order_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "order_code",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "table_code",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "action",
     "t": "VARCHAR(50)",
     "pk": false
    },
    {
     "n": "action_label",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "user_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "user_role",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "duration_seconds",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    }
   ]
  },
  {
   "name": "kpi_logs",
   "group": "KPI",
   "desc": "Mỗi lần cộng/trừ điểm KPI của nhân viên và lý do.",
   "rows": 4,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "user_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "role_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "order_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "order_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "table_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "event_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "points_delta",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "kpi_sla_settings",
   "group": "KPI",
   "desc": "Cấu hình SLA mặc định và bảng điểm KPI/đánh giá sao.",
   "rows": 1,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "default_kitchen_sla",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "default_waiter_sla",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kpi_base_score",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kpi_kitchen_ontime_pts",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kpi_kitchen_rush_penalty",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kpi_waiter_ontime_pts",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kpi_waiter_remind_penalty",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kpi_star_5_pts",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kpi_star_4_pts",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kpi_star_3_pts",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kpi_star_2_pts",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kpi_star_1_pts",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "updated_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "local_license_cache",
   "group": "Hệ thống",
   "desc": "Bản quyền lưu cục bộ (key, hạn, module, Hardware ID, chữ ký ECDSA).",
   "rows": 1,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "license_key",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "store_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "owner_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "plan_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "subscription_status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "expire_date",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "days_left",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "machine_id",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "bound_machine_id",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "enabled_modules",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "last_sync_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "last_sync_status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "blocked_modules",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "card_fee_percent",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "license_signature",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "material_transactions",
   "group": "Kho",
   "desc": "Phiếu nhập/xuất nguyên vật liệu kèm đơn giá, chi phí, nhà cung cấp.",
   "rows": 225,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "trans_code",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "material_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "material_name",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "trans_type",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "quantity",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "unit",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "unit_price",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "total_cost",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "supplier",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "user_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "invoice_image",
     "t": "VARCHAR(255)",
     "pk": false
    }
   ]
  },
  {
   "name": "materials",
   "group": "Kho",
   "desc": "Danh mục nguyên vật liệu: tồn kho, định mức tối thiểu, giá vốn.",
   "rows": 19,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "code",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "name",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "category",
     "t": "VARCHAR(50)",
     "pk": false
    },
    {
     "n": "unit",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "quantity",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "min_quantity",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "cost_price",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "supplier",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "status",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "updated_at",
     "t": "DATETIME",
     "pk": false
    }
   ]
  },
  {
   "name": "media_eq_presets",
   "group": "Âm nhạc",
   "desc": "Các preset EQ 10 băng và preset đang kích hoạt.",
   "rows": 15,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "preset_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "preamp_gain",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "band_31hz",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "band_62hz",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "band_125hz",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "band_250hz",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "band_500hz",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "band_1khz",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "band_2khz",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "band_4khz",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "band_8khz",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "band_16khz",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "is_active",
     "t": "INTEGER",
     "pk": false
    }
   ]
  },
  {
   "name": "media_jukebox_queue",
   "group": "Âm nhạc",
   "desc": "Hàng đợi Jukebox (bài, bàn/khách yêu cầu, ưu tiên, số phiếu, trạng thái).",
   "rows": 122,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "track_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "track_title",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "track_artist",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "track_duration",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "table_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "table_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "customer_phone",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "is_priority",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "vote_count",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "requested_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "played_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "requester_ip",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "media_jukebox_votes",
   "group": "Âm nhạc",
   "desc": "Phiếu bình chọn của khách cho bài đang chờ.",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "queue_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "voter_key",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "voted_at",
     "t": "DATETIME",
     "pk": false
    }
   ]
  },
  {
   "name": "media_tracks",
   "group": "Âm nhạc",
   "desc": "Kho bài hát (tên, nghệ sĩ, thể loại, file, nguồn local/YouTube).",
   "rows": 17,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "title",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "artist",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "album",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "genre",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "duration_sec",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "file_path",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "bitrate",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "cover_image",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "play_count",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "is_active",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "source_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "source_url",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "yt_video_id",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "order_alerts",
   "group": "Thông báo",
   "desc": "Cảnh báo đơn cần xác nhận (hối, hết món, xin/hủy món) theo vai trò đích.",
   "rows": 3,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "order_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "order_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "table_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "table_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "alert_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "title",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "message",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "target_role",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "is_ack",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "ack_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "ack_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "title_key",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "msg_key",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "msg_params_json",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "order_items",
   "group": "Bán hàng",
   "desc": "Từng dòng món của đơn: số lượng, giá, topping, ghi chú, trạng thái hủy.",
   "rows": 5068,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "order_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "product_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "product_code",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "product_name",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "unit",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "quantity",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "price",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "subtotal",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "note",
     "t": "VARCHAR(255)",
     "pk": false
    },
    {
     "n": "toppings_json",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "cancel_status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "cancel_reason",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "cancel_requested_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "cancel_requested_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "cancel_resolved_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "cancel_resolved_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "order_reviews",
   "group": "Bán hàng",
   "desc": "Đánh giá sao và góp ý của khách theo đơn.",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "order_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "order_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "table_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "rating",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "comment",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "orders",
   "group": "Bán hàng",
   "desc": "Hóa đơn/đơn hàng: tiền, giảm giá, VAT, thanh toán, trạng thái bếp, SLA, hối/nhắc, đánh giá, idempotency.",
   "rows": 2431,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "order_code",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "table_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "table_code",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "customer_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "guest_count",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "subtotal",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "discount_type",
     "t": "VARCHAR(10)",
     "pk": false
    },
    {
     "n": "discount_value",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "discount_amount",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "vat_percent",
     "t": "DECIMAL(5, 2)",
     "pk": false
    },
    {
     "n": "vat_amount",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "total_amount",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "payment_method",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "cash_received",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "change_amount",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "status",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "user_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "completed_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "kitchen_status",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "kitchen_ready_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "kitchen_user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kitchen_user_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "served_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "served_user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "served_user_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "prep_time_minutes",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "deliver_time_minutes",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "payment_status",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "paid_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "promo_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "promo_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "promo_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "order_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "paid_amount",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "settlement_status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "payment_verified_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "bank_ref",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "cancel_request_reason",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "cancel_requested_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "cancel_requested_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "kitchen_sent_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "rush_count",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "last_rushed_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "last_rushed_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "remind_count",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "last_reminded_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "customer_rating",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "customer_review_note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "customer_reviewed_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "access_token",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "idempotency_key",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "card_tx_ref",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "payment_breakdown_json",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "pending_void",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "client_ip",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "payment_transactions",
   "group": "Thanh toán",
   "desc": "Giao dịch thanh toán/hoàn tiền chi tiết theo phương thức & mã ngân hàng.",
   "rows": 1,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "order_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "order_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "tx_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "method",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "amount",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "bank_ref",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "verified_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "payroll_cycles",
   "group": "Lương",
   "desc": "Kỳ lương theo tháng (nháp/khóa sổ/đã chi) và tổng hợp.",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "month_key",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "total_staff",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "total_hours",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "total_overtime_hours",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "total_gross",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "total_net",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "locked_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "locked_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "paid_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "paid_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "updated_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "payroll_items",
   "group": "Lương",
   "desc": "Dòng lương từng nhân viên trong kỳ (giờ, OT, lương cơ bản, KPI, thực lĩnh).",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "cycle_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "month_key",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "user_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "user_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "user_role",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "hourly_rate",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "total_shifts",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "regular_hours",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "overtime_hours",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "base_pay",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "overtime_pay",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "kpi_score",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "kpi_bonus",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "allowance",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "advance_deduction",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "penalty",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "net_pay",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "is_paid",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "paid_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "paid_method",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "pos_shifts",
   "group": "Quỹ",
   "desc": "Ca thu ngân: tiền đầu ca, doanh thu theo phương thức, thu/chi, lý thuyết vs thực đếm, chênh lệch.",
   "rows": 105,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "shift_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "user_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "opened_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "closed_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "opening_cash",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "cash_sales",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "banking_sales",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "card_sales",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "cash_in",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "cash_out",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "expected_cash",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "actual_cash",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "discrepancy",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "products",
   "group": "Thực đơn",
   "desc": "Mặt hàng: giá bán/vốn, topping, ảnh, trạng thái khóa, đa ngôn ngữ.",
   "rows": 42,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "category_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "code",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "name",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "unit",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "cost_price",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "sale_price",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "image",
     "t": "VARCHAR(255)",
     "pk": false
    },
    {
     "n": "is_topping",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "status",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "description",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "i18n_json",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "promotions",
   "group": "Khuyến mãi",
   "desc": "Chương trình khuyến mãi/voucher (kiểu giảm, giới hạn, khung giờ).",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "promo_mode",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "discount_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "discount_value",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "max_discount_amount",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "min_order_amount",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "start_date",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "end_date",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "start_time",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "end_time",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "usage_limit",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "is_active",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "i18n_json",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "qr_blacklist",
   "group": "Bảo mật",
   "desc": "IP/SĐT bị chặn đặt món QR do spam, có thời hạn.",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "client_ip",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "phone",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "reason",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "blocked_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "expires_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "shift_state_logs",
   "group": "Nhân sự",
   "desc": "Lịch sử chuyển trạng thái ca (giao hàng, nghỉ, chốt sớm…) của HR-11.",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "attendance_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "from_status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "to_status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "order_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "actor_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "sla_time_slots",
   "group": "KPI",
   "desc": "Khung giờ cao điểm/thấp điểm với SLA bếp & phục vụ riêng.",
   "rows": 3,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "slot_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "start_time",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "end_time",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "kitchen_sla_minutes",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "waiter_sla_minutes",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "is_active",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "store_settings",
   "group": "Hệ thống",
   "desc": "Cặp khóa–giá trị cấu hình quán (thông tin, ngân hàng, ca, in, AI, slide…).",
   "rows": 22,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "setting_key",
     "t": "VARCHAR(50)",
     "pk": false
    },
    {
     "n": "setting_value",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "supplier_invoice_items",
   "group": "Kho",
   "desc": "Dòng chi tiết hóa đơn nhà cung cấp.",
   "rows": 2,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "invoice_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "material_transaction_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "material_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "material_name",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "quantity",
     "t": "DECIMAL(12,2)",
     "pk": false
    },
    {
     "n": "unit",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "unit_price",
     "t": "DECIMAL(12,2)",
     "pk": false
    },
    {
     "n": "total_cost",
     "t": "DECIMAL(14,2)",
     "pk": false
    }
   ]
  },
  {
   "name": "supplier_invoices",
   "group": "Kho",
   "desc": "Hóa đơn mua hàng của nhà cung cấp (tổng, đã trả, hạn thanh toán).",
   "rows": 1,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "invoice_code",
     "t": "VARCHAR(50)",
     "pk": false
    },
    {
     "n": "supplier_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "supplier_name",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "invoice_no",
     "t": "VARCHAR(80)",
     "pk": false
    },
    {
     "n": "invoice_image",
     "t": "VARCHAR(255)",
     "pk": false
    },
    {
     "n": "total_amount",
     "t": "DECIMAL(14,2)",
     "pk": false
    },
    {
     "n": "paid_amount",
     "t": "DECIMAL(14,2)",
     "pk": false
    },
    {
     "n": "due_date",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_by",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "created_by_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    }
   ]
  },
  {
   "name": "supplier_payments",
   "group": "Kho",
   "desc": "Các lần thanh toán công nợ nhà cung cấp.",
   "rows": 1,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "invoice_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "amount",
     "t": "DECIMAL(14,2)",
     "pk": false
    },
    {
     "n": "payment_method",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "reference",
     "t": "VARCHAR(120)",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "paid_by",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "paid_by_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "paid_at",
     "t": "DATETIME",
     "pk": false
    }
   ]
  },
  {
   "name": "suppliers",
   "group": "Kho",
   "desc": "Danh bạ nhà cung cấp.",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "name",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "contact_name",
     "t": "VARCHAR(120)",
     "pk": false
    },
    {
     "n": "phone",
     "t": "VARCHAR(40)",
     "pk": false
    },
    {
     "n": "email",
     "t": "VARCHAR(120)",
     "pk": false
    },
    {
     "n": "address",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "status",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "updated_at",
     "t": "DATETIME",
     "pk": false
    }
   ]
  },
  {
   "name": "tables_areas",
   "group": "Bán hàng",
   "desc": "Bàn & khu vực (Tại quán/Mang về), trạng thái, đơn đang mở.",
   "rows": 13,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "code",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "area_type",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "status",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "active_order_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "guest_count",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "sort_order",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "i18n_json",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "users",
   "group": "Nhân sự",
   "desc": "Tài khoản: vai trò, PIN, mã nhân viên, lương/giờ, trạng thái online.",
   "rows": 6,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "username",
     "t": "VARCHAR(50)",
     "pk": false
    },
    {
     "n": "password",
     "t": "VARCHAR(255)",
     "pk": false
    },
    {
     "n": "fullname",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "role",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "avatar",
     "t": "VARCHAR(255)",
     "pk": false
    },
    {
     "n": "status",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "phone",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "pin_code",
     "t": "VARCHAR(10)",
     "pk": false
    },
    {
     "n": "user_code",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "hourly_rate",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "salary_type",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "is_online",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "last_active_at",
     "t": "DATETIME",
     "pk": false
    }
   ]
  }
 ],
 "api": [
  {
   "path": "/favicon.ico",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/favicon.png",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/index",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/index.html",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/admin",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/admin.html",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/kitchen",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/kitchen.html",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/order",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/order.html",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/customer",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/customer.html",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/wifi",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/wifi.html",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/attendance",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/attendance.html",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/login",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/login.html",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/online_orders",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/online_orders.html",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/api/plugins/matrix",
   "methods": [
    "GET"
   ],
   "desc": "Ma trận plugin"
  },
  {
   "path": "/api/system/control",
   "methods": [
    "POST"
   ],
   "desc": "Điều khiển, toàn vẹn, cập nhật"
  },
  {
   "path": "/api/health",
   "methods": [
    "GET"
   ],
   "desc": "Giám sát"
  },
  {
   "path": "/api/system/integrity",
   "methods": [
    "GET"
   ],
   "desc": "Điều khiển, toàn vẹn, cập nhật"
  },
  {
   "path": "/api/printer/list",
   "methods": [
    "GET"
   ],
   "desc": "Danh sách máy in, in hóa đơn, mở két"
  },
  {
   "path": "/api/printer/print-receipt",
   "methods": [
    "POST"
   ],
   "desc": "Danh sách máy in, in hóa đơn, mở két"
  },
  {
   "path": "/api/printer/open-drawer",
   "methods": [
    "POST"
   ],
   "desc": "Danh sách máy in, in hóa đơn, mở két"
  },
  {
   "path": "/api/i18n/ai-translate",
   "methods": [
    "POST"
   ],
   "desc": "I18N Studio"
  },
  {
   "path": "/api/attendance/hikvision/devices",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Máy chấm công Hikvision"
  },
  {
   "path": "/api/attendance/hikvision/test",
   "methods": [
    "POST"
   ],
   "desc": "Máy chấm công Hikvision"
  },
  {
   "path": "/api/attendance/hikvision/sync-users",
   "methods": [
    "POST"
   ],
   "desc": "Máy chấm công Hikvision"
  },
  {
   "path": "/api/attendance/hikvision/poll",
   "methods": [
    "POST"
   ],
   "desc": "Máy chấm công Hikvision"
  },
  {
   "path": "/api/attendance/hikvision/event",
   "methods": [
    "POST"
   ],
   "desc": "Máy chấm công Hikvision"
  },
  {
   "path": "/api/payment/vietqr_payload",
   "methods": [
    "GET"
   ],
   "desc": "VietQR payload/SVG, Webhook ngân hàng"
  },
  {
   "path": "/api/payment/vietqr_svg",
   "methods": [
    "GET"
   ],
   "desc": "VietQR payload/SVG, Webhook ngân hàng"
  },
  {
   "path": "/api/i18n/catalog",
   "methods": [
    "GET"
   ],
   "desc": "I18N Studio"
  },
  {
   "path": "/api/i18n/save",
   "methods": [
    "POST"
   ],
   "desc": "I18N Studio"
  },
  {
   "path": "/api/i18n/publish",
   "methods": [
    "POST"
   ],
   "desc": "I18N Studio"
  },
  {
   "path": "/api/hr/live-board",
   "methods": [
    "GET"
   ],
   "desc": "Bảng ca real-time & chuyển trạng thái"
  },
  {
   "path": "/api/hr/shift-status",
   "methods": [
    "POST"
   ],
   "desc": "Bảng ca real-time & chuyển trạng thái"
  },
  {
   "path": "/i18n_studio.html",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/i18n_studio_data.js",
   "methods": [
    "GET"
   ],
   "desc": ""
  },
  {
   "path": "/api/media/tracks",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Âm nhạc, lịch phát, kiểm duyệt"
  },
  {
   "path": "/api/media/tracks/save",
   "methods": [
    "POST"
   ],
   "desc": "Âm nhạc, lịch phát, kiểm duyệt"
  },
  {
   "path": "/api/media/tracks/delete",
   "methods": [
    "POST"
   ],
   "desc": "Âm nhạc, lịch phát, kiểm duyệt"
  },
  {
   "path": "/api/media/tracks/rescan",
   "methods": [
    "POST"
   ],
   "desc": "Âm nhạc, lịch phát, kiểm duyệt"
  },
  {
   "path": "/api/media/tracks/upload",
   "methods": [
    "POST"
   ],
   "desc": "Âm nhạc, lịch phát, kiểm duyệt"
  },
  {
   "path": "/api/media/tracks/auto_classify",
   "methods": [
    "POST"
   ],
   "desc": "Âm nhạc, lịch phát, kiểm duyệt"
  },
  {
   "path": "/api/media/schedules",
   "methods": [
    "GET"
   ],
   "desc": "Âm nhạc, lịch phát, kiểm duyệt"
  },
  {
   "path": "/api/media/schedules/save",
   "methods": [
    "POST"
   ],
   "desc": "Âm nhạc, lịch phát, kiểm duyệt"
  },
  {
   "path": "/api/media/schedules/delete",
   "methods": [
    "POST"
   ],
   "desc": "Âm nhạc, lịch phát, kiểm duyệt"
  },
  {
   "path": "/api/auth",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Đăng nhập, đăng xuất, kiểm phiên, heartbeat, đổi PIN"
  },
  {
   "path": "/api/categories",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Nhóm hàng"
  },
  {
   "path": "/api/products",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Mặt hàng, khóa/mở món, ảnh AI"
  },
  {
   "path": "/api/tables",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Bàn & khu vực, tạo hàng loạt, danh sách công khai cho khách"
  },
  {
   "path": "/api/orders",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Đơn hàng: tạo/lưu, báo giá, gửi bếp, hối, bưng, hủy, thanh toán, thông báo"
  },
  {
   "path": "/api/payment/webhook",
   "methods": [
    "POST"
   ],
   "desc": "VietQR payload/SVG, Webhook ngân hàng"
  },
  {
   "path": "/api/reports",
   "methods": [
    "GET"
   ],
   "desc": "Báo cáo doanh thu, biểu đồ"
  },
  {
   "path": "/api/finance",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Ca, quỹ, chi phí, công nợ, audit"
  },
  {
   "path": "/api/settings",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Cài đặt quán"
  },
  {
   "path": "/api/users",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Nhân viên & phân quyền"
  },
  {
   "path": "/api/operations",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Kho, chấm công, lương, KPI, phân tích, realtime"
  },
  {
   "path": "/api/license",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Bản quyền & kích hoạt"
  },
  {
   "path": "/api/license_client",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Bản quyền & kích hoạt"
  },
  {
   "path": "/api/advertising",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Quảng cáo & slide"
  },
  {
   "path": "/api/promotions",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Khuyến mãi"
  },
  {
   "path": "/api/wan_tunnel",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Kênh WAN tới Master"
  },
  {
   "path": "/api/cloud_backup",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Sao lưu đám mây"
  },
  {
   "path": "/api/ai/test",
   "methods": [
    "POST"
   ],
   "desc": "Copilot & kiểm tra AI"
  },
  {
   "path": "/api/ai/copilot",
   "methods": [
    "POST"
   ],
   "desc": "Copilot & kiểm tra AI"
  },
  {
   "path": "/api/telegram/test",
   "methods": [
    "POST"
   ],
   "desc": "Telegram bot"
  },
  {
   "path": "/api/telegram/webhook",
   "methods": [
    "POST"
   ],
   "desc": "Telegram bot"
  },
  {
   "path": "/api/media/moderate_song",
   "methods": [
    "POST"
   ],
   "desc": "Âm nhạc, lịch phát, kiểm duyệt"
  },
  {
   "path": "/api/wifi/portal_info",
   "methods": [
    "GET"
   ],
   "desc": "Portal WiFi & leads"
  },
  {
   "path": "/api/wifi/unlock",
   "methods": [
    "POST"
   ],
   "desc": "Portal WiFi & leads"
  },
  {
   "path": "/api/wifi/leads",
   "methods": [
    "GET"
   ],
   "desc": "Portal WiFi & leads"
  },
  {
   "path": "/api/system/updates",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Điều khiển, toàn vẹn, cập nhật"
  }
 ],
 "actions": {
  "slave_dot6_handlers.cpp": [
   "attendance_raw_logs",
   "block_spammer",
   "change_payment_method",
   "kiosk_punch",
   "my_attendance_status",
   "preview_quote",
   "qr_token",
   "web_checkin",
   "web_checkout"
  ],
  "slave_handlers.cpp": [
   "ack_alert",
   "ack_notification",
   "active",
   "add",
   "add_cash_tx",
   "add_table",
   "add_transaction",
   "ai_generate_dish_image",
   "ai_generate_slide",
   "ai_parse_invoice",
   "alerts",
   "apply",
   "approve_overtime",
   "approve_owner_qr",
   "attendances",
   "audit_and_shifts",
   "auto_classify",
   "backup_now",
   "batch_add_tables",
   "batch_import_materials",
   "cancel_order",
   "change_my_pin",
   "change_payment_method",
   "chart",
   "check",
   "check_notifications",
   "check_owner_qr",
   "check_payment",
   "checkout",
   "close_shift",
   "confirm_payment",
   "create",
   "create_material_transaction",
   "create_owner_qr",
   "customer_mark_transfer",
   "customer_order",
   "customer_status",
   "delete",
   "delete_attendance_record",
   "delete_expense",
   "delete_material",
   "delete_sla_slot",
   "delete_table",
   "detail",
   "dismiss",
   "fetch_dish_image",
   "get_config",
   "get_kpi_dashboard",
   "get_materials",
   "get_payroll",
   "get_pnl_comparison",
   "get_realtime_staff",
   "get_recipes",
   "get_report",
   "get_shift_settings",
   "get_supplier_finance",
   "get_tax_settings",
   "get_transactions",
   "heartbeat",
   "history",
   "kitchen_archive",
   "kitchen_cancel_item",
   "kitchen_out_of_stock",
   "kitchen_ready",
   "kitchen_reject_cancel_item",
   "kitchen_reopen",
   "kitchen_request_cancel_order",
   "kitchen_resolve_cancel_item",
   "kitchen_tickets",
   "list",
   "list_expenses",
   "lock_payroll_cycle",
   "log_audit",
   "login",
   "login_pin",
   "logout",
   "manual_checkout",
   "mark_expense_paid",
   "mark_payroll_paid",
   "materials",
   "merge_table",
   "online_order_delivered",
   "online_orders",
   "open_shift",
   "pay_order",
   "payment_methods",
   "pin_login",
   "pos_shift_report",
   "public_tables",
   "reconnect",
   "record_supplier_payment",
   "reprint",
   "request_cancel_item",
   "rescan",
   "reset_password",
   "rush_kitchen",
   "save",
   "save_attendance_record",
   "save_expense",
   "save_kpi_sla_settings",
   "save_location",
   "save_material",
   "save_order",
   "save_payroll_cycle",
   "save_recipes",
   "save_shift_settings",
   "save_sla_slot",
   "save_slides",
   "save_supplier",
   "save_tax_settings",
   "search_dish_images",
   "send_to_kitchen",
   "service_performance",
   "settle_delta",
   "shift_status",
   "submit_review",
   "summary",
   "switch_table",
   "sync_data",
   "test_connection",
   "toggle",
   "toggle_lock",
   "toggle_status",
   "top_selling",
   "transactions",
   "unlock_payroll_cycle",
   "update",
   "update_hourly_rate",
   "update_item_note",
   "update_table",
   "upload",
   "upload_image",
   "upload_media",
   "validate",
   "vietqr",
   "waiter_confirm_customer_order",
   "waiter_served"
  ],
  "slave_license_handlers.cpp": [
   "activate",
   "check",
   "check_billing_order",
   "create_billing_order",
   "ping",
   "status",
   "sync_if_due",
   "sync_now"
  ]
 }
};
