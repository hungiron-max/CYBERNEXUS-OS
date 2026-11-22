window.MASTER_MANUAL = {
 "meta": {
  "title": "Sổ tay Vận hành & Thuyết minh Hệ thống MASTER (Super Admin SaaS)",
  "version": "v2.5.0",
  "ota": "2026.11.22.04",
  "generated": "22/11/2026 17:27",
  "counts": {
   "funcs": 32,
   "flows": 8,
   "cases": 12,
   "tables": 38,
   "endpoints": 42
  },
  "undocumented_tables": []
 },
 "modules": [
  {
   "id": "AUTH",
   "name": "Đăng nhập & Bảo mật",
   "file": "super_admin.html",
   "url": "/super_admin.html",
   "icon": "🔐",
   "roles": [
    "all"
   ],
   "desc": "Cổng đăng nhập Super Admin, chống dò mật khẩu, chuyển góc nhìn 5 bộ phận và đổi mật khẩu bảo mật."
  },
  {
   "id": "DASH",
   "name": "Dashboard Chỉ Huy",
   "file": "super_admin.html",
   "url": "/super_admin.html#dashboard",
   "icon": "📊",
   "roles": [
    "super_admin",
    "technical",
    "finance",
    "sales",
    "auditor"
   ],
   "desc": "Toàn cảnh số lượng cửa hàng, doanh thu SaaS 6 tháng, cơ cấu gói dịch vụ và danh sách quán sắp hết hạn ≤ 7 ngày."
  },
  {
   "id": "TENANTS",
   "name": "Quản Lý Cửa Hàng",
   "file": "super_admin.html",
   "url": "/super_admin.html#tenants",
   "icon": "🏪",
   "roles": [
    "super_admin",
    "technical",
    "sales",
    "finance"
   ],
   "desc": "Tạo/sửa cửa hàng, tải logo, giám sát Online/Offline + độ trễ ms, định vị GPS, reset PIN chủ quán và thùng rác khôi phục."
  },
  {
   "id": "LICENSE",
   "name": "Bản Quyền & 18 Modules",
   "file": "super_admin.html",
   "url": "/super_admin.html#tenants",
   "icon": "🔑",
   "roles": [
    "super_admin",
    "technical",
    "finance"
   ],
   "desc": "Cấp License Key chuẩn CBNX, bật/chặn độc lập 18 modules, phí cà thẻ, gia hạn nhanh, Reset Hardware Lock và Grace Days."
  },
  {
   "id": "SOP09",
   "name": "Hồ Sơ & Đóng Gói (SOP-09)",
   "file": "super_admin.html",
   "url": "/super_admin.html#tenants",
   "icon": "📦",
   "roles": [
    "super_admin",
    "technical",
    "finance",
    "sales"
   ],
   "desc": "Quy trình bàn giao chuẩn SOP-09: xác nhận thanh toán, dùng thử 7 ngày, upload hợp đồng/GPKD và tự động đóng gói bộ cài riêng cho quán."
  },
  {
   "id": "RESELLERS",
   "name": "Đại Lý & Ví Ký Quỹ",
   "file": "super_admin.html",
   "url": "/super_admin.html#resellers",
   "icon": "🤝",
   "roles": [
    "super_admin",
    "sales",
    "finance"
   ],
   "desc": "Quản lý kênh đại lý 4 hạng (Đồng/Bạc/Vàng/Kim Cương), nạp ví ký quỹ, cấp License Key tự động trừ ví và sổ cái đối soát."
  },
  {
   "id": "PLANS",
   "name": "Gói Cước & Phí Dịch Vụ",
   "file": "super_admin.html",
   "url": "/super_admin.html#plans",
   "icon": "💎",
   "roles": [
    "super_admin",
    "sales",
    "finance"
   ],
   "desc": "Bảng gói dịch vụ SaaS (Basic/Pro/Enterprise...), giá theo tháng/năm và cấu hình tập module mặc định."
  },
  {
   "id": "BILLING",
   "name": "Thu Phí & Hóa Đơn",
   "file": "super_admin.html",
   "url": "/super_admin.html#billing",
   "icon": "🧾",
   "roles": [
    "super_admin",
    "finance",
    "auditor"
   ],
   "desc": "Lịch sử hóa đơn thu phí, in biên lai, quản lý đơn Self-Billing từ quán (VietQR + Webhook tự động hoặc xác nhận tay)."
  },
  {
   "id": "AIVAULT",
   "name": "Master AI Vault & Credit",
   "file": "super_admin.html",
   "url": "/super_admin.html#ai-vault",
   "icon": "🤖",
   "roles": [
    "super_admin",
    "technical",
    "finance"
   ],
   "desc": "Kho bảo mật Zero-Exposure Google Gemini API Key, kiểm tra kết nối, lịch sử vòng đời key và cấp/nạp hạn mức AI Credit cho từng quán."
  },
  {
   "id": "STAFF",
   "name": "Phân Quyền Bộ Phận (RBAC)",
   "file": "super_admin.html",
   "url": "/super_admin.html#staff",
   "icon": "👥",
   "roles": [
    "super_admin"
   ],
   "desc": "Quản lý tài khoản nhân sự vận hành Master theo 5 bộ phận chức năng và phạm vi quyền hạn."
  },
  {
   "id": "AUDIT",
   "name": "Nhật Ký Audit Trail",
   "file": "super_admin.html",
   "url": "/super_admin.html#audit",
   "icon": "📜",
   "roles": [
    "super_admin",
    "auditor"
   ],
   "desc": "Theo dõi toàn bộ lịch sử thao tác nhạy cảm trên Master (ai làm, làm gì, quán nào, từ IP nào) và xuất báo cáo CSV."
  },
  {
   "id": "TEMPLATES",
   "name": "Biểu Mẫu & Hợp Đồng",
   "file": "super_admin.html",
   "url": "/super_admin.html#templates",
   "icon": "📄",
   "roles": [
    "super_admin",
    "sales",
    "finance"
   ],
   "desc": "Soạn thảo hợp đồng, biên bản nghiệm thu/bàn giao với biến tự động theo quán và in trực tiếp."
  },
  {
   "id": "SETTINGS",
   "name": "Cài Đặt SaaS, WAN & OTA",
   "file": "super_admin.html",
   "url": "/super_admin.html#settings",
   "icon": "⚙️",
   "roles": [
    "super_admin",
    "technical"
   ],
   "desc": "Cấu hình URL Master & đồng bộ hàng loạt, VietQR nhận tiền, kênh WAN Tunnel, kho lưu trữ & đẩy/rollback bản vá OTA."
  },
  {
   "id": "STUDIO",
   "name": "Theme Studio & I18N Studio",
   "file": "theme_studio.html / i18n_studio.html",
   "url": "/theme_studio · /i18n_studio.html",
   "icon": "🎨",
   "roles": [
    "super_admin",
    "technical"
   ],
   "desc": "Thiết kế bộ màu thương hiệu riêng cho từng quán (Dual-Mode) và quản trị dịch thuật đa ngôn ngữ có AI hỗ trợ."
  },
  {
   "id": "SYSTEM",
   "name": "Hệ Thống, Ký DLL & Tunnel",
   "file": "cybernexus_master.exe",
   "url": "CLI & Port 8500",
   "icon": "🛡️",
   "roles": [
    "super_admin",
    "technical"
   ],
   "desc": "Vận hành lõi C++ Master (:8500), ký số ECDSA P-256 cho DLL (--sign-dll), nhận Backup từ Slave và cấu hình Router/Firewall/DNS."
  }
 ],
 "funcs": [
  {
   "id": "AUTH-01",
   "mod": "AUTH",
   "sec": "Xác thực",
   "title": "Đăng nhập Cổng Chỉ Huy Super Admin",
   "roles": [
    "all"
   ],
   "summary": "Xác thực tài khoản quản trị Master bằng mật khẩu hash, cấp phiên token bảo mật và chống tấn công dò mật khẩu.",
   "steps": [
    "Mở http://<IP_MASTER>:8500/super_admin.html (hoặc tên miền WAN).",
    "Nhập Tài khoản Quản Trị Master (VD: superadmin hoặc tài khoản bộ phận) và Mật khẩu.",
    "Bấm Đăng Nhập Trung Tâm Chỉ Huy; hệ thống tải thông tin nhân sự và hiển thị các tab theo đúng vai trò."
   ],
   "data": [
    "saas_staff_users",
    "auth_tokens",
    "login_attempts",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=login",
    "GET /api/super_admin?action=check_auth"
   ],
   "notes": [
    "Sai mật khẩu liên tiếp bị khóa tạm theo IP/tài khoản (bảng login_attempts).",
    "Mọi lần đăng nhập được lưu vào saas_audit_logs kèm IP."
   ],
   "cases": [
    "Quên mật khẩu tài khoản bộ phận → SuperAdmin vào tab Phân Quyền Bộ Phận để đặt lại.",
    "Phiên hết hạn → trình duyệt tự quay về màn hình đăng nhập."
   ],
   "lic": "",
   "src": "master/web/super_admin.html · master/src/master_handlers.cpp (login)",
   "test": "SEC-16 brute-force lock"
  },
  {
   "id": "AUTH-02",
   "mod": "AUTH",
   "sec": "Góc nhìn & Bảo mật",
   "title": "Chuyển góc nhìn 5 Bộ phận & Đổi mật khẩu Super Admin",
   "roles": [
    "super_admin",
    "technical",
    "finance",
    "sales",
    "auditor"
   ],
   "summary": "Cho phép Ban Giám Đốc xem trước giao diện theo góc nhìn của từng bộ phận và tự đổi mật khẩu định kỳ.",
   "steps": [
    "Trên thanh tiêu đề, chọn bộ lọc Phân Quyền Trực (SuperAdmin / Kỹ Thuật / Kế Toán / Kinh Doanh / Kiểm Toán) để ẩn/hiện tab tương ứng.",
    "Để đổi mật khẩu: vào Cài Đặt SaaS & VietQR → mục Bảo mật tài khoản Super Admin → nhập mật khẩu cũ + mới → Lưu.",
    "Bấm nút Đăng xuất góc phải khi rời máy để hủy phiên token hiện tại."
   ],
   "data": [
    "saas_staff_users",
    "auth_tokens",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=change_password",
    "POST /api/super_admin?action=logout"
   ],
   "notes": [
    "Chỉ SuperAdmin mới được chuyển góc nhìn mô phỏng các bộ phận khác; nhân sự bộ phận chỉ thấy đúng quyền của mình."
   ],
   "cases": [
    "Đổi mật khẩu xong cần đăng nhập lại trên các thiết bị khác."
   ],
   "lic": "",
   "src": "master/web/super_admin.html · master/web/assets/js/super_admin.js (switchRoleView, changePassword)",
   "test": "RBAC view switch"
  },
  {
   "id": "DASH-01",
   "mod": "DASH",
   "sec": "Tổng quan KPI",
   "title": "4 Thẻ chỉ số điều hành & Biểu đồ doanh thu SaaS 6 tháng",
   "roles": [
    "super_admin",
    "finance",
    "sales",
    "auditor"
   ],
   "summary": "Hiển thị tổng số cửa hàng, số quán đang hoạt động/sắp hết hạn, tổng doanh thu SaaS và biểu đồ tăng trưởng 6 tháng gần nhất.",
   "steps": [
    "Mở tab Dashboard Chỉ Huy (tab mặc định sau khi đăng nhập).",
    "Quan sát 4 thẻ KPI tổng quan và trạng thái Nodes Bản Quyền Active trên header.",
    "Xem biểu đồ cột/đường Doanh thu 6 tháng và biểu đồ tròn Cơ cấu gói dịch vụ.",
    "Bấm nút Làm mới (biểu tượng xoay) để cập nhật số liệu tức thời."
   ],
   "data": [
    "saas_tenants",
    "saas_invoices",
    "saas_plans"
   ],
   "api": [
    "GET /api/super_admin?action=dashboard_stats"
   ],
   "notes": [
    "Doanh thu tính từ các hóa đơn đã thanh toán (saas_invoices) và đơn Self-Billing đã đối soát."
   ],
   "cases": [
    "Biểu đồ trống → kiểm tra đã có hóa đơn trạng thái paid trong 6 tháng gần nhất chưa."
   ],
   "lic": "",
   "src": "master/web/super_admin.html (tab-content-dashboard) · super_admin.js (loadDashboard)",
   "test": "Chart.js offline bundle"
  },
  {
   "id": "DASH-02",
   "mod": "DASH",
   "sec": "Nhắc hạn khẩn cấp",
   "title": "Danh sách cửa hàng hết hạn hoặc sắp hết hạn ≤ 7 ngày",
   "roles": [
    "super_admin",
    "sales",
    "finance"
   ],
   "summary": "Tự động lọc nổi bật các cửa hàng cần CSKH liên hệ thu phí gia hạn ngay trước khi bị gián đoạn dịch vụ.",
   "steps": [
    "Trong Dashboard Chỉ Huy, cuộn tới bảng Danh Sách Cửa Hàng Cần Chăm Sóc & Thu Tiền Gia Hạn.",
    "Kiểm tra số ngày còn lại, tên chủ quán, SĐT và gói đang dùng.",
    "Bấm nút Gia hạn nhanh trực tiếp từ danh sách để mở modal thu phí và xuất hóa đơn."
   ],
   "data": [
    "saas_tenants",
    "saas_settings"
   ],
   "api": [
    "GET /api/super_admin?action=dashboard_stats"
   ],
   "notes": [
    "Ngưỡng số ngày cảnh báo sắp hết hạn có thể tùy chỉnh trong Cài Đặt SaaS (Chính sách nhắc hạn)."
   ],
   "cases": [
    "Quán đã thanh toán nhưng vẫn hiện sắp hết hạn → kiểm tra ngày expire_date hoặc xác nhận đơn Self-Billing trong tab Thu Phí."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin.js (renderUrgentRenewals)",
   "test": "Urgent renewal filter"
  },
  {
   "id": "TEN-01",
   "mod": "TENANTS",
   "sec": "Quản lý danh sách",
   "title": "Danh sách Cửa hàng, Tìm kiếm, Lọc & Thùng rác khôi phục",
   "roles": [
    "super_admin",
    "technical",
    "sales",
    "finance"
   ],
   "summary": "Quản lý tập trung toàn bộ các quán (Tenants) trong chuỗi với bộ lọc theo trạng thái, gói cước, từ khóa và cơ chế xóa mềm an toàn.",
   "steps": [
    "Mở tab Quản Lý Cửa Hàng.",
    "Dùng ô tìm kiếm theo mã quán (VD: GP001), tên quán, chủ quán, SĐT hoặc License Key.",
    "Bấm nút Thùng rác (toggleTrashView) để xem các quán đã xóa mềm và bấm Khôi phục nếu cần mở lại."
   ],
   "data": [
    "saas_tenants",
    "saas_plans",
    "saas_audit_logs"
   ],
   "api": [
    "GET /api/super_admin?action=get_tenants",
    "POST /api/super_admin?action=soft_delete_tenant",
    "POST /api/super_admin?action=restore_tenant"
   ],
   "notes": [
    "Xóa quán mặc định là xóa mềm (ghi deleted_at, deleted_reason) để không mất lịch sử hóa đơn và kiểm toán."
   ],
   "cases": [
    "Quán bị xóa nhầm → mở Thùng rác → bấm Khôi phục để mở lại đầy đủ dữ liệu."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin.js (loadTenants, filterTenants, toggleTrashView)",
   "test": "Soft-delete & restore"
  },
  {
   "id": "TEN-02",
   "mod": "TENANTS",
   "sec": "Tạo & Sửa quán",
   "title": "Thêm mới / Chỉnh sửa thông tin Cửa hàng, Pháp lý & Logo",
   "roles": [
    "super_admin",
    "sales",
    "technical"
   ],
   "summary": "Tạo hồ sơ quán mới (tự sinh License Key CBNX), cập nhật thông tin chủ quán, pháp nhân/MST/CCCD và tải logo thương hiệu.",
   "steps": [
    "Bấm + Tạo Cửa Hàng Mới (hoặc nút Sửa trên dòng quán).",
    "Nhập Mã quán, Tên quán, Chủ quán, SĐT, Email, Địa chỉ, Gói dịch vụ, Chu kỳ thanh toán.",
    "Điền thêm thông tin pháp lý (Tên pháp nhân, MST/CCCD, Chức vụ đại diện, Địa chỉ xuất hóa đơn) để đổ tự động vào Hợp đồng SOP-09.",
    "Chọn file Logo quán (tự động nén/resize ảnh) → bấm Lưu."
   ],
   "data": [
    "saas_tenants",
    "saas_plans",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=save_tenant",
    "GET /api/super_admin?action=get_tenant_detail"
   ],
   "notes": [
    "Mã quán (tenant_code) là duy nhất và dùng làm tên thư mục gói cài đặt trong master/packages/<CODE>."
   ],
   "cases": [
    "Trùng mã quán → đổi mã khác (VD: GP002) hoặc kiểm tra trong Thùng rác xem mã cũ còn tồn tại không."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin.js (openNewTenantModal, editTenant, submitTenantForm)",
   "test": "Tenant CRUD"
  },
  {
   "id": "TEN-03",
   "mod": "TENANTS",
   "sec": "Giám sát kết nối",
   "title": "Kiểm tra trạng thái Online/Offline, IP LAN/WAN & Định vị GPS",
   "roles": [
    "super_admin",
    "technical"
   ],
   "summary": "Theo dõi sức khỏe kết nối thời gian thực của từng quán (độ trễ ms, IP LAN/WAN, phiên bản app) và gắn tọa độ bản đồ.",
   "steps": [
    "Trên dòng quán, xem cột Mạng & Vị Trí (IP LAN, IP WAN, tọa độ GPS, phiên bản Slave đang chạy).",
    "Bấm nút Kiểm tra kết nối hàng loạt (checkAllStoresOnline) hoặc kiểm tra riêng 1 quán để đo trạng thái Online/Offline & độ trễ ms.",
    "Bấm biểu tượng Ghim bản đồ (promptStoreLocation) để cập nhật tọa độ lat/lng & nhãn vị trí Google Maps cho quán."
   ],
   "data": [
    "saas_tenants"
   ],
   "api": [
    "POST /api/super_admin?action=check_store_online",
    "POST /api/super_admin?action=update_store_location",
    "GET /api/license/ping"
   ],
   "notes": [
    "Slave tự gửi heartbeat (/api/license/ping) và duy trì kênh Long-Polling (/api/license/poll) để Master biết trạng thái thực."
   ],
   "cases": [
    "Quán đang mở nhưng báo Offline → kiểm tra cấu hình Master URL trên Slave và mở Port 8500 WAN trên Router Master."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin.js (checkStoreOnline, checkAllStoresOnline, promptStoreLocation)",
   "test": "Live node telemetry"
  },
  {
   "id": "TEN-04",
   "mod": "TENANTS",
   "sec": "Hỗ trợ từ xa",
   "title": "Reset mã PIN Chủ quán từ xa & Bật/Tạm khóa hoạt động quán",
   "roles": [
    "super_admin",
    "technical"
   ],
   "summary": "Khôi phục quyền truy cập cho chủ quán khi quên mã PIN và tạm ngưng/mở lại trạng thái thuê bao của cửa hàng.",
   "steps": [
    "Để reset PIN: mở chi tiết/bản quyền quán → bấm Reset PIN chủ quán → hệ thống đánh dấu pin_reset_pending và gửi lệnh qua Tunnel.",
    "Để tạm khóa/mở lại quán: bấm nút trạng thái (toggleTenantStatus) trên dòng cửa hàng."
   ],
   "data": [
    "saas_tenants",
    "saas_pending_commands",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=reset_store_owner_pin",
    "POST /api/super_admin?action=toggle_status"
   ],
   "notes": [
    "Khi quán đang tạm khóa (suspended), lần đồng bộ license tiếp theo Slave sẽ hiển thị thông báo tạm ngưng dịch vụ."
   ],
   "cases": [
    "Lệnh reset PIN chưa áp dụng ngay → kiểm tra quán đang Online để nhận lệnh qua /api/license/poll."
   ],
   "lic": "",
   "src": "master/src/master_handlers.cpp (reset_store_owner_pin, toggle_status)",
   "test": "Remote PIN reset"
  },
  {
   "id": "LIC-01",
   "mod": "LICENSE",
   "sec": "Phân quyền Module",
   "title": "Bật/Tắt & Chặn (Block) độc lập 18 Modules + Phí cà thẻ",
   "roles": [
    "super_admin",
    "technical",
    "finance"
   ],
   "summary": "Kiểm soát chi tiết từng tính năng được phép chạy tại mỗi cửa hàng (18 module độc lập) và cấu hình % phí cà thẻ.",
   "steps": [
    "Tại dòng quán, bấm nút Module (VD: 17/18) để mở modal Phân Quyền Module Chi Tiết.",
    "Bật/tắt từng module (pos_core, kitchen_kds, waiter_mobile, customer_qr, online_orders, advertising_promotions, promo_voucher_engine, ai_assistant, media_jukebox, card_payment...).",
    "Dùng nút Chặn (BLOCK) nếu muốn khóa cứng một module dù gói cước mặc định có bao gồm.",
    "Có thể bấm Bật tất cả / Tắt tất cả nhanh, và nhập % Phí cà thẻ (card_fee_percent) → Lưu."
   ],
   "data": [
    "saas_tenants",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=toggle_module",
    "POST /api/super_admin?action=set_all_modules",
    "POST /api/super_admin?action=save_card_fee"
   ],
   "notes": [
    "Module Truyền thông Quảng cáo (advertising_promotions) và Khuyến mãi Voucher (promo_voucher_engine) được tách bạch hoàn toàn.",
    "Quán tự đồng bộ quyền mới trong vòng tối đa 5 phút hoặc ngay lập tức khi bấm Kiểm tra bản quyền trên Slave."
   ],
   "cases": [
    "Đã bật module trên Master nhưng Slave chưa thấy → nhắc chủ quán vào Admin Slave bấm Đồng bộ bản quyền và tải lại trang."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin.js (openModulePermissions, toggleSingleModule, toggleBlockModule, saveMasterCardFee)",
   "test": "18-module matrix"
  },
  {
   "id": "LIC-02",
   "mod": "LICENSE",
   "sec": "Khóa phần cứng & Key",
   "title": "Quản lý License Key, Reset Hardware Lock, Cấp lại Key & Grace Days",
   "roles": [
    "super_admin",
    "technical"
   ],
   "summary": "Quản lý ràng buộc phần cứng (Machine ID) chống sao chép trái phép, mở khóa khi quán đổi máy tính và thiết lập số ngày ân hạn.",
   "steps": [
    "Bấm biểu tượng Chìa khóa trên dòng quán để mở modal Quản Lý Bản Quyền & Khóa Phần Cứng.",
    "Xem License Key (CBNX-XXXX-XXXX-XXXX-XXXX), Machine ID đã gắn, tên máy và lần xác thực gần nhất; bấm Sao chép Key để gửi quán.",
    "Nếu quán thay máy tính mới: bấm Reset Hardware Lock (Mở khóa máy) để Slave máy mới tự gắn lại Machine ID.",
    "Nếu nghi lộ key: bấm Sinh lại License Key mới (regenerate_license_key).",
    "Điều chỉnh số ngày ân hạn offline (Grace Days) cho phép quán vẫn bán hàng tạm khi đứt mạng WAN."
   ],
   "data": [
    "saas_tenants",
    "saas_settings",
    "saas_audit_logs"
   ],
   "api": [
    "GET /api/super_admin?action=get_tenant_license",
    "GET /api/super_admin?action=license_overview",
    "POST /api/super_admin?action=reset_hardware_lock",
    "POST /api/super_admin?action=regenerate_license_key",
    "POST /api/super_admin?action=license_save_grace",
    "POST /api/super_admin?action=license_init_keys"
   ],
   "notes": [
    "Chữ ký bản quyền dùng thuật toán ECDSA P-256 (Windows CNG), Slave kiểm tra chữ ký cục bộ nên không thể sửa tay file SQLite."
   ],
   "cases": [
    "Quán báo lỗi \"Thiết bị không khớp\" sau khi cài lại Windows/đổi ổ cứng → Master bấm Reset Hardware Lock, sau đó Slave kích hoạt lại là xong."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin.js (openLicense, doResetMachine, doRegenerateKey, saveGraceDays) · master_license.cpp",
   "test": "ECDSA P-256 HW lock"
  },
  {
   "id": "LIC-03",
   "mod": "LICENSE",
   "sec": "Gia hạn nhanh",
   "title": "Gia hạn bản quyền nhanh & Tự động tính phí theo gói",
   "roles": [
    "super_admin",
    "finance",
    "sales"
   ],
   "summary": "Gia hạn thời gian sử dụng cho cửa hàng (1/3/6/12/24 tháng hoặc tùy chỉnh), tự tính số tiền và sinh hóa đơn thu phí.",
   "steps": [
    "Bấm nút Gia hạn (biểu tượng lịch/tiền) trên dòng quán hoặc từ bảng Nhắc hạn trên Dashboard.",
    "Chọn gói cước, số tháng gia hạn, phương thức thanh toán (Chuyển khoản / Tiền mặt) và mã tham chiếu giao dịch.",
    "Kiểm tra số tiền tự tính và ngày hết hạn mới → bấm Xác nhận Gia hạn.",
    "Hệ thống tự cộng dồn expire_date và tạo bản ghi trong Lịch Sử Hóa Đơn."
   ],
   "data": [
    "saas_tenants",
    "saas_invoices",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=quick_extend"
   ],
   "notes": [
    "Nếu quán còn hạn, ngày hết hạn mới được cộng nối tiếp từ expire_date cũ; nếu đã quá hạn, cộng từ ngày hôm nay."
   ],
   "cases": [
    "Cần in biên lai gửi khách → sang tab Thu Phí & Hóa Đơn bấm In hóa đơn."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin.js (openQuickExtend, calculateExtendFee, submitQuickExtend)",
   "test": "Quick extend + invoice"
  },
  {
   "id": "SOP-01",
   "mod": "SOP09",
   "sec": "Luồng bàn giao SOP-09",
   "title": "Xác nhận Thanh toán, Kích hoạt Dùng thử 7 ngày & Workflow Override",
   "roles": [
    "super_admin",
    "finance",
    "sales"
   ],
   "summary": "Kiểm soát chặt chẽ quy trình thương mại trước khi đóng gói bàn giao: chỉ cho phép đóng gói khi đã xác nhận thanh toán, đang dùng thử 7 ngày hoặc có phê duyệt ngoại lệ.",
   "steps": [
    "Trên dòng quán, bấm nút Hồ sơ & Gói cài đặt (SOP-09) để mở modal-tenant-packages.",
    "Kế toán bấm Xác nhận đã thu tiền (confirm_payment) sau khi nhận chuyển khoản.",
    "Hoặc Sales bấm Kích hoạt dùng thử 7 ngày (activate_trial_7d) cho khách trải nghiệm.",
    "Trường hợp đặc biệt (khách VIP nợ chứng từ): SuperAdmin bấm Cấp quyền ngoại lệ (grant_workflow_override)."
   ],
   "data": [
    "saas_tenants",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=confirm_payment",
    "POST /api/super_admin?action=activate_trial_7d",
    "POST /api/super_admin?action=grant_workflow_override"
   ],
   "notes": [
    "Trạng thái workflow_stage tự động tiến triển và lưu vết người xác nhận + dấu thời gian."
   ],
   "cases": [
    "Nút Đóng gói bị khóa → kiểm tra quán đã được Xác nhận thanh toán, Dùng thử 7 ngày hay Override chưa."
   ],
   "lic": "",
   "src": "master/src/master_handlers.cpp (confirm_payment, activate_trial_7d, grant_workflow_override)",
   "test": "SOP-09 gate"
  },
  {
   "id": "SOP-02",
   "mod": "SOP09",
   "sec": "Lưu trữ hồ sơ",
   "title": "Tải lên, Quản lý & Xóa tài liệu pháp lý của Cửa hàng",
   "roles": [
    "super_admin",
    "sales",
    "finance"
   ],
   "summary": "Lưu trữ tập trung hợp đồng đã ký, GPKD, CCCD chủ quán, biên bản bàn giao và chứng từ chuyển khoản ngay trong hồ sơ quán.",
   "steps": [
    "Trong modal Hồ sơ & Gói cài đặt (SOP-09), chuyển tới phần Tài liệu đính kèm.",
    "Chọn phân loại tài liệu (Hợp đồng, GPKD/CCCD, Biên bản bàn giao, Chứng từ thanh toán), nhập tiêu đề & ghi chú.",
    "Chọn tệp (PDF/JPG/PNG/DOCX) → bấm Tải lên.",
    "Có thể mở xem/tải lại hoặc xóa tài liệu không hợp lệ."
   ],
   "data": [
    "saas_tenant_documents",
    "saas_audit_logs"
   ],
   "api": [
    "GET /api/super_admin?action=get_tenant_documents",
    "POST /api/super_admin?action=upload_tenant_document",
    "POST /api/super_admin?action=delete_tenant_document"
   ],
   "notes": [
    "Tệp được lưu tổ chức trong thư mục uploads/ của Master kèm siêu dữ liệu dung lượng, người tải và thời gian."
   ],
   "cases": [
    "Tải file lỗi → kiểm tra quyền ghi thư mục master/uploads/ và kích thước tệp."
   ],
   "lic": "",
   "src": "master/src/master_handlers.cpp (upload_tenant_document, get_tenant_documents, delete_tenant_document)",
   "test": "Tenant docs vault"
  },
  {
   "id": "SOP-03",
   "mod": "SOP09",
   "sec": "Đóng gói bộ cài",
   "title": "Tự động đóng gói & Tải bộ cài đặt riêng cho từng Quán (Release Builder)",
   "roles": [
    "super_admin",
    "technical"
   ],
   "summary": "Tạo gói cài đặt hoàn chỉnh (đã nhúng sẵn License Key, tên quán, cấu hình URL Master và DB sạch) sẵn sàng bàn giao cho khách cài đặt 1 chạm.",
   "steps": [
    "Trong modal SOP-09 của quán, bấm Tạo Gói Cài Đặt Mới (generate_tenant_release).",
    "Hệ thống biên soạn thư mục CyberNexus_POS_Release_<TENANT_CODE>, nhúng sẵn thông tin quán và đóng gói kèm trình cài đặt 1 chạm CyberNexus_Setup_Stub.exe thành tệp tải về.",
    "Nếu gói bị lỗi giữa chừng, bấm Đóng gói lại (retry_store_package).",
    "Bấm nút Tải gói cài đặt (/api/download_package) để gửi cho kỹ thuật triển khai tại quán."
   ],
   "data": [
    "saas_tenants",
    "saas_settings",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=generate_tenant_release",
    "GET /api/super_admin?action=get_tenant_packages",
    "POST /api/super_admin?action=retry_store_package",
    "GET /api/download_package"
   ],
   "notes": [
    "Thư mục lưu gói xuất ra có thể tùy chỉnh trong Cài Đặt SaaS → Thư mục lưu gói quán (save_package_storage)."
   ],
   "cases": [
    "Đóng gói thất bại → kiểm tra ổ đĩa còn dung lượng và thư mục nguồn slave/ có đủ cybernexus_slave.exe + web/."
   ],
   "lic": "",
   "src": "master/src/master_handlers.cpp (generate_tenant_release, get_tenant_packages) · main_master.cpp (/api/download_package)",
   "test": "Automated tenant packaging"
  },
  {
   "id": "RES-01",
   "mod": "RESELLERS",
   "sec": "Quản lý đối tác",
   "title": "Tạo & Quản lý Đại lý Phân phối theo 4 hạng chiết khấu",
   "roles": [
    "super_admin",
    "sales",
    "finance"
   ],
   "summary": "Quản lý mạng lưới đại lý bán hàng với 4 hạng đối tác tự động áp chiết khấu: Đồng (15%), Bạc (25%), Vàng (40%), Kim Cương (55%).",
   "steps": [
    "Mở tab Đại Lý Phân Phối.",
    "Bấm + Thêm Đại Lý Mới (hoặc Sửa trên dòng đại lý).",
    "Nhập Mã đại lý (VD: DL-001), Tên công ty, Người liên hệ, SĐT, Email và chọn Hạng đối tác (tự động điền % chiết khấu tương ứng).",
    "Bấm Lưu đại lý."
   ],
   "data": [
    "saas_resellers",
    "saas_audit_logs"
   ],
   "api": [
    "GET /api/super_admin?action=get_resellers",
    "POST /api/super_admin?action=save_reseller"
   ],
   "notes": [
    "Có thể tùy chỉnh % chiết khấu riêng cho từng đại lý nếu có thỏa thuận đặc biệt ngoài khung chuẩn."
   ],
   "cases": [
    "Tạm khóa đại lý vi phạm chính sách bằng cách chuyển trạng thái sang inactive."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin_ext.js (loadResellers, openAddResellerModal, saveReseller)",
   "test": "4-tier reseller model"
  },
  {
   "id": "RES-02",
   "mod": "RESELLERS",
   "sec": "Ví ký quỹ",
   "title": "Nạp tiền Ví ký quỹ Đại lý & Tra cứu sổ cái biến động ví",
   "roles": [
    "super_admin",
    "finance"
   ],
   "summary": "Ghi nhận tiền ký quỹ đại lý chuyển vào công ty (có nút mệnh giá nhanh 5M/15M/30M/60M) và lưu vết sổ cái minh bạch.",
   "steps": [
    "Trên dòng đại lý, bấm Nạp Ví (openDepositModal).",
    "Chọn nhanh mệnh giá (5M, 15M, 30M, 60M) hoặc nhập số tiền thực nhận + ghi chú mã giao dịch ngân hàng.",
    "Bấm Xác nhận Nạp Ví; số dư wallet_balance tăng ngay lập tức.",
    "Bấm Lịch sử ví (openWalletLogsModal) để đối soát toàn bộ giao dịch nạp/trừ kèm số dư trước và sau."
   ],
   "data": [
    "saas_resellers",
    "saas_reseller_wallet_logs",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=deposit_reseller_wallet",
    "GET /api/super_admin?action=get_reseller_wallet_logs"
   ],
   "notes": [
    "Mọi giao dịch ví đều bất biến trong saas_reseller_wallet_logs giúp đối soát cuối tháng không sai lệch."
   ],
   "cases": [
    "Nạp nhầm số tiền → tạo bút toán điều chỉnh kèm ghi chú rõ ràng để giữ vết kiểm toán."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin_ext.js (openDepositModal, submitDepositWallet, openWalletLogsModal)",
   "test": "Reseller wallet ledger"
  },
  {
   "id": "RES-03",
   "mod": "RESELLERS",
   "sec": "Cấp Key đại lý",
   "title": "Cấp License Key cho quán mới qua Đại lý (Tự động tính chiết khấu & trừ ví)",
   "roles": [
    "super_admin",
    "sales",
    "finance"
   ],
   "summary": "Cho phép cấp bản quyền cho quán mới thông qua đại lý: tự động tính giá sau chiết khấu, kiểm tra số dư ví, trừ ví và sinh License Key ngay.",
   "steps": [
    "Trên dòng đại lý, bấm Cấp Key (openResellerIssueLicenseModal).",
    "Nhập thông tin quán mới (Mã quán, Tên quán, Chủ quán, SĐT), chọn Gói dịch vụ & Chu kỳ.",
    "Hệ thống tự hiển thị Giá niêm yết, Chiết khấu đại lý (%) và Số tiền thực trừ ví.",
    "Bấm Xác nhận Cấp Key → hệ thống tạo quán, trừ ví đại lý, ghi sổ cái và hiện License Key để bấm Sao chép ngay."
   ],
   "data": [
    "saas_resellers",
    "saas_reseller_wallet_logs",
    "saas_tenants",
    "saas_invoices",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=reseller_issue_license"
   ],
   "notes": [
    "Nếu số dư ví ký quỹ không đủ số tiền sau chiết khấu, hệ thống tự từ chối giao dịch để tránh âm quỹ."
   ],
   "cases": [
    "Đại lý hết tiền ví → Kế toán thực hiện Nạp Ví (RES-02) rồi mới cấp Key."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin_ext.js (openResellerIssueLicenseModal, submitResellerIssueLicense)",
   "test": "Atomic wallet deduct + key gen"
  },
  {
   "id": "PLN-01",
   "mod": "PLANS",
   "sec": "Bảng giá SaaS",
   "title": "Quản lý Danh mục Gói cước & Tập Module mặc định",
   "roles": [
    "super_admin",
    "sales",
    "finance"
   ],
   "summary": "Hiển thị và tham chiếu toàn bộ các gói dịch vụ SaaS (Basic, Standard, Pro, Enterprise...) với đơn giá tháng/năm và danh sách module đi kèm.",
   "steps": [
    "Mở tab Gói Cước & Phí Dịch Vụ.",
    "Xem bảng so sánh các gói đang hoạt động: mã gói, giá tháng, giá năm, màu nhận diện và các module bật sẵn.",
    "Dùng làm cơ sở tính tiền tự động khi Tạo quán mới, Gia hạn nhanh hoặc Cấp Key qua Đại lý."
   ],
   "data": [
    "saas_plans"
   ],
   "api": [
    "GET /api/super_admin?action=get_plans"
   ],
   "notes": [
    "Khi gán gói cho quán mới, hệ thống tự nạp default_modules của gói đó vào enabled_modules của quán."
   ],
   "cases": [
    "Cần thêm tính năng lẻ ngoài gói → dùng tính năng Bật/Tắt 18 Modules (LIC-01) trên từng quán."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin.js (loadPlans, renderPlansGrid)",
   "test": "Plan catalog"
  },
  {
   "id": "BIL-01",
   "mod": "BILLING",
   "sec": "Hóa đơn SaaS",
   "title": "Lịch sử Thu phí, Hóa đơn Bản quyền & In biên lai",
   "roles": [
    "super_admin",
    "finance",
    "auditor"
   ],
   "summary": "Tra cứu toàn bộ hóa đơn thu phí từ các quán (mua mới, gia hạn, đại lý) và xuất mẫu in biên lai thanh toán chuyên nghiệp.",
   "steps": [
    "Mở tab Thu Phí & Hóa Đơn.",
    "Xem danh sách hóa đơn kèm mã hóa đơn, tên quán, gói dịch vụ, số tiền, ngày bắt đầu/hết hạn, người thu và trạng thái.",
    "Bấm nút In hóa đơn trên từng dòng để mở modal biên lai (modal-print-invoice) và in hoặc lưu PDF gửi khách."
   ],
   "data": [
    "saas_invoices",
    "saas_tenants"
   ],
   "api": [
    "GET /api/super_admin?action=get_invoices"
   ],
   "notes": [
    "Dữ liệu hóa đơn được đồng bộ trực tiếp lên biểu đồ Doanh thu 6 tháng tại Dashboard Chỉ Huy."
   ],
   "cases": [
    "Chưa thấy hóa đơn mới → bấm nút Làm mới trên tab Thu Phí."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin.js (loadBilling, printInvoiceModal)",
   "test": "Invoice history & print"
  },
  {
   "id": "BIL-02",
   "mod": "BILLING",
   "sec": "Tự thanh toán VietQR",
   "title": "Quản lý đơn Self-Billing từ Quán (Webhook tự động & Xác nhận tay)",
   "roles": [
    "super_admin",
    "finance"
   ],
   "summary": "Tiếp nhận đơn tự gia hạn gói hoặc mua thêm AI Credit do quán tạo qua mã VietQR, tự động kích hoạt khi có Webhook ngân hàng hoặc Kế toán duyệt tay.",
   "steps": [
    "Quán trên Slave bấm Gia hạn / Mua AI Credit → gọi POST /api/billing/create_order tạo đơn và mã VietQR SVG.",
    "Khi khách chuyển khoản đúng nội dung, Webhook ngân hàng gọi POST /api/billing/webhook tự động cộng ngày sử dụng hoặc AI Credit.",
    "Trường hợp chưa nối Webhook tự động: Kế toán vào tab Thu Phí & Hóa Đơn → mục Đơn Self-Billing → kiểm tra sao kê → bấm Xác nhận đã thu tiền (confirmSelfBillingOrder)."
   ],
   "data": [
    "saas_billing_orders",
    "saas_tenants",
    "saas_invoices",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/billing/create_order",
    "GET /api/billing/status",
    "POST /api/billing/webhook",
    "GET /api/billing/orders",
    "POST /api/billing/confirm",
    "GET /api/payment/vietqr_svg"
   ],
   "notes": [
    "Hỗ trợ cả 2 loại đơn: gia hạn gói bản quyền và nạp thêm AI Credit cho quán."
   ],
   "cases": [
    "Khách chuyển khoản sai nội dung → Webhook không tự khớp → Kế toán đối chiếu sao kê và bấm Xác nhận thủ công."
   ],
   "lic": "",
   "src": "master/src/master_handlers.cpp (/api/billing/*) · super_admin.js (confirmSelfBillingOrder)",
   "test": "Self-billing + webhook"
  },
  {
   "id": "AIV-01",
   "mod": "AIVAULT",
   "sec": "Kho khóa AI",
   "title": "Master AI Vault — Nạp, Xác thực, Kích hoạt & Xoay vòng Gemini API Key",
   "roles": [
    "super_admin",
    "technical"
   ],
   "summary": "Lưu trữ tập trung Google Gemini API Key theo kiến trúc Zero-Exposure (tuyệt đối không gửi key xuống máy quán), hỗ trợ nhiều key dự phòng và đo sức khỏe key.",
   "steps": [
    "Mở tab Master AI Vault.",
    "Bấm + Nạp Gemini API Key Mới, đặt tên nhãn (label), chọn tầng (Free/Paid), hạn mức ngày/tháng và dán API Key.",
    "Bấm Xác thực & Lưu: Master gọi thử tới Google Gemini để kiểm tra key sống + đếm số model hỗ trợ rồi mới lưu và xóa trắng ô nhập.",
    "Dùng các nút Test Key, Kích hoạt (làm key chính), Tạm dừng/Bật, Sửa metadata hoặc Xóa trên từng key.",
    "Theo dõi tab con Lịch sử Key để xem mọi sự kiện thêm/test/lỗi/xoay vòng key."
   ],
   "data": [
    "master_ai_keys",
    "master_ai_key_history",
    "master_settings",
    "saas_audit_logs"
   ],
   "api": [
    "GET /api/super_admin?action=get_ai_vault",
    "POST /api/super_admin?action=verify_save_gemini_key",
    "POST /api/super_admin?action=test_gemini_key",
    "POST /api/super_admin?action=activate_gemini_key",
    "POST /api/super_admin?action=toggle_gemini_key",
    "POST /api/super_admin?action=update_gemini_key_meta",
    "POST /api/super_admin?action=delete_gemini_key"
   ],
   "notes": [
    "Key trên giao diện chỉ hiển thị dạng che dấu (key_masked), không bao giờ trả raw API Key ra trình duyệt sau khi lưu.",
    "Hỗ trợ xoay vòng ưu tiên (priority) nếu 1 key chạm hạn mức."
   ],
   "cases": [
    "Test Key báo lỗi 403/429 → kiểm tra billing Google AI Studio hoặc chuyển kích hoạt sang key dự phòng khác."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin_ext.js (loadMasterAiVault, verifyAndSaveMasterGeminiKey, testGeminiKey, activateGeminiKey)",
   "test": "Zero-Exposure AI Vault"
  },
  {
   "id": "AIV-02",
   "mod": "AIVAULT",
   "sec": "Hạn mức AI Credit",
   "title": "Cấp Hạn mức AI Credit hàng tháng & Nạp Bonus cho từng Quán",
   "roles": [
    "super_admin",
    "technical",
    "finance"
   ],
   "summary": "Kiểm soát chi phí AI toàn hệ thống bằng cơ chế hạn mức AI Credit theo từng quán và nhật ký sử dụng chi tiết.",
   "steps": [
    "Trong tab Master AI Vault, chuyển sang sub-tab Hạn Mức Cửa Hàng.",
    "Tìm quán cần chỉnh, mở dòng cấu hình quota.",
    "Đặt Hạn mức tháng (ai_monthly_quota: số dương mặc định 50, -1 = không giới hạn, 0 = tắt AI) hoặc bấm nút nhanh +10/+50/+100 Credit thưởng (ai_bonus_credits).",
    "Bấm Lưu hạn mức; theo dõi lịch sử tiêu thụ AI của các quán trong ai_usage_logs."
   ],
   "data": [
    "saas_tenants",
    "ai_usage_logs",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=update_store_ai_quota",
    "POST /api/ai/proxy",
    "POST /api/ai/quota"
   ],
   "notes": [
    "Định mức trừ credit (chỉ trừ khi gọi AI thành công): OCR hóa đơn = 1 credit; Tạo ảnh món ăn = 2 credit; Tạo banner/slide = 3 credit."
   ],
   "cases": [
    "Quán báo lỗi HTTP 402 khi dùng AI → quán đã hết credit tháng → vào đây nạp thêm ai_bonus_credits hoặc nâng ai_monthly_quota."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin_ext.js (saveStoreAiQuota, quickPresetQuota, quickAddBonus) · master_handlers.cpp (/api/ai/proxy)",
   "test": "AI Proxy & Quota"
  },
  {
   "id": "STF-01",
   "mod": "STAFF",
   "sec": "Quản trị RBAC",
   "title": "Quản lý Nhân sự Bộ phận & Phân quyền truy cập Master",
   "roles": [
    "super_admin"
   ],
   "summary": "Tạo tài khoản riêng cho từng nhân sự nội bộ theo 5 bộ phận (SuperAdmin, Kỹ Thuật, Kế Toán, Kinh Doanh, Kiểm Toán) để tách bạch trách nhiệm và truy vết Audit.",
   "steps": [
    "Mở tab Phân Quyền Bộ Phận.",
    "Bấm + Thêm Nhân Viên Bộ Phận Mới (hoặc Sửa trên dòng nhân sự).",
    "Nhập Tài khoản, Họ tên, Email, SĐT, Phòng ban, chọn Vai trò (role) và Mật khẩu khởi tạo.",
    "Bấm Lưu; nhân sự có thể đăng nhập ngay bằng tài khoản riêng và chỉ nhìn thấy các tab được phân quyền."
   ],
   "data": [
    "saas_staff_users",
    "saas_audit_logs"
   ],
   "api": [
    "GET /api/super_admin?action=get_staff_users",
    "POST /api/super_admin?action=save_staff_user",
    "POST /api/super_admin?action=delete_staff_user"
   ],
   "notes": [
    "Không nên dùng chung 1 tài khoản superadmin cho nhiều nhân viên để đảm bảo Nhật Ký Audit Trail ghi đúng tên người thao tác."
   ],
   "cases": [
    "Nhân viên nghỉ việc → xóa hoặc chuyển trạng thái tài khoản sang inactive ngay lập tức."
   ],
   "lic": "",
   "src": "master/web/super_admin.html (tab-content-staff, modal-staff-member) · master_handlers.cpp (save_staff_user)",
   "test": "5-role RBAC"
  },
  {
   "id": "AUD-01",
   "mod": "AUDIT",
   "sec": "Truy vết kiểm toán",
   "title": "Tra cứu Nhật Ký Audit Trail & Xuất báo cáo CSV Kiểm toán",
   "roles": [
    "super_admin",
    "auditor"
   ],
   "summary": "Ghi lại đầy đủ dấu vết mọi hành động quan trọng trên Master (cấp/gia hạn/khóa key, nạp ví đại lý, đổi quota AI, đẩy OTA, sửa cấu hình) và xuất Excel CSV.",
   "steps": [
    "Mở tab Nhật Ký Audit Trail.",
    "Lọc nhanh theo tài khoản thực hiện, loại hành động, mã quán bị tác động hoặc từ khóa mô tả.",
    "Bấm Xuất CSV Kiểm Toán (exportAuditCsv) để tải bảng nhật ký mở trực tiếp trong Excel phục vụ báo cáo Ban Giám Đốc."
   ],
   "data": [
    "saas_audit_logs"
   ],
   "api": [
    "GET /api/super_admin?action=get_audit_logs"
   ],
   "notes": [
    "Nhật ký Audit Trail chỉ có quyền đọc và xuất, không có nút sửa/xóa trên giao diện để đảm bảo tính trung thực kiểm toán."
   ],
   "cases": [
    "Cần điều tra ai đã sửa module hoặc nạp ví đại lý → gõ mã quán hoặc tên hành động vào ô lọc để truy ra chính xác người + IP + thời điểm."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin_ext.js (loadAuditLogs, filterAuditLogsLocal, exportAuditCsv)",
   "test": "Immutable audit log"
  },
  {
   "id": "TPL-01",
   "mod": "TEMPLATES",
   "sec": "Biểu mẫu SOP-09",
   "title": "Soạn thảo Hợp đồng, Biên bản bàn giao & Xem trước tự động điền theo Quán",
   "roles": [
    "super_admin",
    "sales",
    "finance"
   ],
   "summary": "Trình soạn thảo biểu mẫu pháp lý tích hợp sẵn biến động (placeholders), tự động điền thông tin quán/pháp nhân/gói cước để in hoặc lưu PDF nhanh.",
   "steps": [
    "Mở tab Biểu Mẫu & Hợp Đồng.",
    "Chọn loại biểu mẫu (Hợp đồng dịch vụ, Biên bản nghiệm thu & bàn giao, Phụ lục gói cước...).",
    "Soạn thảo ở chế độ Trực quan (WYSIWYG) hoặc Mã HTML; bấm nút chèn biến tự động ({{store_name}}, {{owner_name}}, {{tax_id}}, {{plan_name}}, {{license_key}}...).",
    "Chọn 1 cửa hàng cụ thể ở ô Xem trước theo quán để hệ thống tự đổ dữ liệu thật của quán đó.",
    "Bấm Lưu biểu mẫu hoặc In / Xuất PDF gửi khách ký."
   ],
   "data": [
    "saas_settings",
    "saas_tenants"
   ],
   "api": [
    "GET /api/super_admin?action=get_legal_templates",
    "POST /api/super_admin?action=save_legal_template"
   ],
   "notes": [
    "Nhờ lưu sẵn thông tin pháp nhân trong hồ sơ quán (TEN-02), nhân viên Sales chỉ mất 10 giây để xuất hợp đồng chuẩn không sai chính tả."
   ],
   "cases": [
    "Biến hiển thị trống khi xem trước → kiểm tra đã điền đầy đủ Tên pháp nhân / MST / Địa chỉ xuất hóa đơn trong hồ sơ quán đó chưa."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin_ext.js (loadLegalTemplates, selectLegalTemplate, saveLegalTemplate, printLegalTemplatePreview)",
   "test": "SOP-09 legal editor"
  },
  {
   "id": "SET-01",
   "mod": "SETTINGS",
   "sec": "Cấu hình nền tảng",
   "title": "Cài đặt URL Master, Đồng bộ hàng loạt, VietQR nhận tiền & Chính sách nhắc hạn",
   "roles": [
    "super_admin",
    "technical",
    "finance"
   ],
   "summary": "Cấu hình các tham số cốt lõi của toàn hệ thống Master: tên miền WAN, tài khoản ngân hàng nhận phí SaaS (có QR xem trước) và thư mục lưu gói quán.",
   "steps": [
    "Mở tab Cài Đặt SaaS & VietQR.",
    "Nhập Tên miền / URL Máy Chủ Master (VD: http://hungtien.net:8500) → bấm Lưu và có thể bấm Đồng bộ URL xuống tất cả quán (syncMasterUrlToAllStores).",
    "Cấu hình Thông tin nhận diện & Hotline hỗ trợ 24/7, Chính sách số ngày nhắc hạn.",
    "Nhập Ngân hàng, Số tài khoản, Chủ tài khoản nhận phí SaaS → kiểm tra mã VietQR xem trước bên phải (quét thử bằng app ngân hàng) → Lưu.",
    "Cấu hình Thư mục lưu gói quán (save_package_storage) nếu muốn lưu bộ cài ra ổ đĩa riêng."
   ],
   "data": [
    "saas_settings",
    "saas_pending_commands",
    "saas_audit_logs"
   ],
   "api": [
    "GET /api/super_admin?action=get_saas_settings",
    "POST /api/super_admin?action=save_saas_settings",
    "POST /api/super_admin?action=sync_master_url",
    "GET /api/super_admin?action=get_package_storage",
    "POST /api/super_admin?action=save_package_storage"
   ],
   "notes": [
    "Đồng bộ URL Master qua Tunnel giúp đổi tên miền/IP Master mà không cần cài lại từng quán."
   ],
   "cases": [
    "Quét thử VietQR không hiện đúng tên tài khoản → kiểm tra lại mã BIN ngân hàng và số tài khoản không có khoảng trắng thừa."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin.js (loadSaasSettings, saveSaasSettings, syncMasterUrlToAllStores, updateSaasQrPreview)",
   "test": "SaaS & VietQR config"
  },
  {
   "id": "SET-02",
   "mod": "SETTINGS",
   "sec": "Kho bản vá OTA",
   "title": "Quản lý Kho Lưu Trữ Bản Vá OTA (Xem lịch sử, Kích hoạt/Rollback & Xóa)",
   "roles": [
    "super_admin",
    "technical"
   ],
   "summary": "Quản lý tập trung toàn bộ các phiên bản cập nhật OTA trong master/updates/archive/, hỗ trợ hạ phiên bản khẩn cấp (Rollback) chỉ bằng 1 click.",
   "steps": [
    "Vào tab Cài Đặt SaaS & VietQR → cuộn tới mục Kho Lưu Trữ & Quản Lý Tất Cả Bản Vá OTA.",
    "Xem toàn bộ lịch sử các phiên bản đã phát hành kèm dung lượng file, ngày tạo và ghi chú thay đổi (changelog).",
    "Bấm Kích hoạt (activate_patch) trên bất kỳ bản vá cũ nào để đặt làm bản mặc định (Rollback khẩn cấp).",
    "Bấm Đẩy bản này để mở nhanh modal gửi bản vá đó xuống quán, hoặc bấm Xóa để dọn các bản cũ."
   ],
   "data": [
    "saas_audit_logs"
   ],
   "api": [
    "GET /api/super_admin?action=list_patches",
    "POST /api/super_admin?action=activate_patch",
    "POST /api/super_admin?action=delete_patch",
    "GET /api/updates/latest",
    "GET /api/updates/manifest",
    "GET /api/updates/download"
   ],
   "notes": [
    "Mỗi bản vá lưu kèm manifest.json và checksum SHA-256 để Slave kiểm tra toàn vẹn trước khi giải nén cập nhật."
   ],
   "cases": [
    "Bản mới phát sinh lỗi tại quán → vào Kho Bản Vá → bấm Kích hoạt phiên bản ổn định trước đó rồi đẩy OTA lại cho quán."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin_ext.js (loadOtaPatchArchive, activateOtaPatch, deleteOtaPatch, pushArchivedPatch)",
   "test": "OTA archive & rollback"
  },
  {
   "id": "SET-03",
   "mod": "SETTINGS",
   "sec": "Đẩy OTA & Thông báo",
   "title": "Đẩy Cập Nhật OTA hoặc Gửi Thông Báo Từ Xa xuống 1 Quán / Toàn Hệ Thống",
   "roles": [
    "super_admin",
    "technical"
   ],
   "summary": "Phát hành bản cập nhật phần mềm (exe + web) hoặc gửi thông báo khẩn từ Master xuống màn hình quản trị của từng quán qua Reverse Long-Polling Tunnel.",
   "steps": [
    "Trên tab Quản Lý Cửa Hàng (hoặc từ Kho Bản Vá), bấm Đẩy Update / Thông báo (openPushUpdateModal).",
    "Chọn chế độ: Đẩy Bản Vá OTA hoặc Chỉ Gửi Thông Báo.",
    "Chọn phạm vi: Toàn bộ các quán đang hoạt động hoặc chỉ định 1 cửa hàng cụ thể.",
    "Nếu đẩy OTA: chọn phiên bản bản vá (mặc định chọn bản Mới nhất), nhập tiêu đề & ghi chú → bấm Gửi Xuống Quán.",
    "Hệ thống ghi lệnh vào saas_pending_commands; quán nhận lệnh tức thời qua /api/license/poll, tự tải ZIP, giải nén và khởi động lại sạch sẽ."
   ],
   "data": [
    "saas_pending_commands",
    "saas_tenants",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/super_admin?action=push_store_update",
    "POST /api/license/poll",
    "POST /api/license/ack"
   ],
   "notes": [
    "Quán đang Offline vẫn không bị mất lệnh: lệnh nằm trong saas_pending_commands và sẽ tự giao ngay khi quán có mạng trở lại."
   ],
   "cases": [
    "Đẩy OTA xong quán chưa thấy giao diện mới → nhắc quán bấm Ctrl+F5 để làm mới cache trình duyệt."
   ],
   "lic": "",
   "src": "master/web/assets/js/super_admin_ext.js (openPushUpdateModal, submitPushUpdate) · master_tunnel.h",
   "test": "OTA push via Tunnel"
  },
  {
   "id": "STU-01",
   "mod": "STUDIO",
   "sec": "Nhận diện thương hiệu",
   "title": "Theme & Brand Studio — Thiết kế & Đẩy bộ màu Dual-Mode cho từng Quán",
   "roles": [
    "super_admin",
    "technical"
   ],
   "summary": "Tùy biến màu sắc chủ đạo (Primary, Accent, Surface, Chế độ Sáng/Tối) riêng theo bộ nhận diện thương hiệu của từng cửa hàng và lưu trực tiếp vào hồ sơ quán.",
   "steps": [
    "Trên thanh bên trái Super Admin, bấm Theme & Brand Studio (/theme_studio).",
    "Chọn cửa hàng cần tùy biến giao diện.",
    "Chỉnh màu chủ đạo, độ bo góc, chế độ Sáng/Tối và xem trước trực tiếp (Live Preview).",
    "Bấm Lưu Theme cho quán (save_tenant_theme); cấu hình JSON được lưu vào saas_tenants.theme_json."
   ],
   "data": [
    "saas_tenants",
    "saas_audit_logs"
   ],
   "api": [
    "GET /theme_studio",
    "GET /api/super_admin?action=get_tenant_theme",
    "POST /api/super_admin?action=save_tenant_theme"
   ],
   "notes": [
    "Giúp triển khai mô hình White-Label chuyên nghiệp cho các chuỗi F&B có bộ màu nhận diện riêng."
   ],
   "cases": [
    "Đổi màu xong muốn quay về mặc định → áp lại profile chuẩn theme_profile_cybernexus_default.json."
   ],
   "lic": "",
   "src": "master/web/theme_studio.html · master/src/master_handlers.cpp (get_tenant_theme, save_tenant_theme)",
   "test": "Dual-mode theme studio"
  },
  {
   "id": "STU-02",
   "mod": "STUDIO",
   "sec": "Đa ngôn ngữ",
   "title": "I18N Studio — Quản trị từ điển đa ngôn ngữ & Dịch tự động bằng AI",
   "roles": [
    "super_admin",
    "technical"
   ],
   "summary": "Biên tập tập trung toàn bộ chuỗi văn bản giao diện (Tiếng Việt / Tiếng Anh / ngôn ngữ mở rộng), hỗ trợ dịch hàng loạt bằng Gemini AI và xuất bản ra bộ locales.",
   "steps": [
    "Truy cập http://<IP_MASTER>:8500/i18n_studio.html.",
    "Lọc các khóa ngôn ngữ theo màn hình hoặc trạng thái chưa dịch.",
    "Chỉnh sửa thủ công hoặc bấm AI Translate (/api/i18n/ai-translate) để Gemini dịch tự động giữ nguyên biến định dạng.",
    "Bấm Lưu (/api/i18n/save) rồi Xuất bản (/api/i18n/publish) để cập nhật bộ từ điển chính thức."
   ],
   "data": [
    "master_ai_keys",
    "ai_usage_logs"
   ],
   "api": [
    "GET /i18n_studio.html",
    "GET /api/i18n/catalog",
    "POST /api/i18n/ai-translate",
    "POST /api/i18n/save",
    "POST /api/i18n/publish"
   ],
   "notes": [
    "Tính năng AI Translate dùng trực tiếp API Key trong Master AI Vault."
   ],
   "cases": [
    "Sau khi Publish cần đóng gói bản vá OTA nếu muốn đồng bộ từ điển mới xuống các quán đang chạy."
   ],
   "lic": "",
   "src": "master/web/i18n_studio.html · master/src/master_handlers.cpp (/api/i18n/*)",
   "test": "Centralized I18N studio"
  },
  {
   "id": "SYS-01",
   "mod": "SYSTEM",
   "sec": "Lõi máy chủ & Mạng",
   "title": "Khởi động Master Server (:8500), Health Check & Cấu hình WAN (Port Forward / Firewall / DNS)",
   "roles": [
    "super_admin",
    "technical"
   ],
   "summary": "Vận hành tiến trình cybernexus_master.exe, mở cổng mạng WAN để các quán ở xa kết nối ổn định qua tên miền và kiểm tra sức khỏe hệ thống.",
   "steps": [
    "Chạy master/cybernexus_master.exe (hoặc qua CyberNexus_Control_Center.exe) — máy chủ mở CSDL master/database/cybernexus_master.db và lắng nghe cổng 8500.",
    "Kiểm tra nhanh trạng thái tại GET http://localhost:8500/api/health.",
    "Để quán ngoài internet kết nối: đặt IP LAN tĩnh cho máy Master, mở Port Forwarding 8500 TCP trên Router chính và chạy OPEN_FIREWALL_PORT_8500.bat.",
    "Kiểm tra bản ghi DNS: chỉ giữ bản ghi A (IPv4), xóa bản ghi AAAA (IPv6) nếu Router chỉ mở IPv4."
   ],
   "data": [
    "saas_settings",
    "saas_pending_commands"
   ],
   "api": [
    "GET /api/health",
    "GET /api/license/ping"
   ],
   "notes": [
    "Máy Slave nằm cùng mạng LAN với Master nên dùng IP LAN nếu modem chặn NAT Loopback; quán ở ngoài mạng dùng tên miền WAN."
   ],
   "cases": [
    "Quán ngoài mạng không gọi được Master → kiểm tra IP WAN trên Router có phải IP Public thật không (tránh CGNAT 100.64.x.x) và kiểm tra nslookup không bị trỏ IPv6 AAAA."
   ],
   "lic": "",
   "src": "master/src/main_master.cpp · master/OPEN_FIREWALL_PORT_8500.bat",
   "test": "WAN & Health check"
  },
  {
   "id": "SYS-02",
   "mod": "SYSTEM",
   "sec": "Bảo mật Plugin",
   "title": "Ký số ECDSA P-256 cho Plugin DLL (--sign-dll) & Nhận Backup từ Slave",
   "roles": [
    "super_admin",
    "technical"
   ],
   "summary": "Công cụ dòng lệnh ký chữ ký số bảo mật cho các module DLL trước khi phát hành và endpoint tiếp nhận bản sao lưu dữ liệu tự động từ các cửa hàng.",
   "steps": [
    "Để ký số Plugin DLL trước khi đóng gói/phát hành OTA: chạy lệnh cybernexus_master.exe --sign-dll <đường_dẫn_file.dll>.",
    "Hệ thống tính SHA-256, ký bằng khóa bí mật ECDSA P-256 (Windows CNG), tự kiểm chứng lại và xuất tệp .dll.sig.",
    "Endpoint POST /api/slave/backup tự động tiếp nhận và lưu trữ tệp sao lưu CSDL do các quán gửi định kỳ lên Master."
   ],
   "data": [
    "saas_tenants",
    "saas_audit_logs"
   ],
   "api": [
    "POST /api/slave/backup",
    "CLI: cybernexus_master.exe --sign-dll <file.dll>"
   ],
   "notes": [
    "Cơ chế SEC-10 đảm bảo Slave chỉ nạp các DLL có chữ ký .sig hợp lệ do chính Master ký, ngăn chặn giả mạo/chèn mã độc."
   ],
   "cases": [
    "Slave báo lỗi từ chối nạp DLL → chạy lại --sign-dll bằng đúng máy Master đang giữ cặp khóa ECDSA gốc và gửi kèm file .sig."
   ],
   "lic": "",
   "src": "master/src/main_master.cpp (--sign-dll) · master/src/master_handlers.cpp (/api/slave/backup)",
   "test": "SEC-10 ECDSA DLL signing"
  }
 ],
 "flows": [
  {
   "id": "MFLOW-01",
   "title": "Triển khai & Bàn giao Cửa hàng mới chuẩn SOP-09 (Từ tạo quán → cài đặt tại quán)",
   "actors": [
    "Kinh Doanh (Sales)",
    "Kế Toán (Finance)",
    "Kỹ Thuật (Tech)",
    "Chủ quán (Slave)"
   ],
   "goal": "Đưa một khách hàng mới từ lúc ký hợp đồng đến khi vận hành hoàn chỉnh trên máy POS tại quán, có đủ hồ sơ pháp lý và bản quyền RSA/ECDSA.",
   "steps": [
    {
     "actor": "Sales",
     "screen": "Quản Lý Cửa Hàng",
     "action": "Tạo hồ sơ quán mới (Mã quán, thông tin pháp nhân, gói cước, logo) → tự sinh License Key CBNX",
     "data": "saas_tenants",
     "api": "POST save_tenant"
    },
    {
     "actor": "Sales",
     "screen": "Biểu Mẫu & Hợp Đồng",
     "action": "Chọn mẫu Hợp đồng & Biên bản bàn giao, đổ tự động dữ liệu quán và in gửi khách ký",
     "data": "saas_settings, saas_tenants",
     "api": "GET get_legal_templates"
    },
    {
     "actor": "Sales",
     "screen": "Modal SOP-09",
     "action": "Upload bản scan Hợp đồng, GPKD/CCCD vào hồ sơ tài liệu của quán",
     "data": "saas_tenant_documents",
     "api": "POST upload_tenant_document"
    },
    {
     "actor": "Finance",
     "screen": "Modal SOP-09",
     "action": "Kiểm tra tiền về tài khoản VietQR và bấm Xác nhận thanh toán (hoặc Sales bật Dùng thử 7 ngày)",
     "data": "saas_tenants, saas_invoices",
     "api": "POST confirm_payment"
    },
    {
     "actor": "Tech",
     "screen": "Modal SOP-09",
     "action": "Bấm Tạo Gói Cài Đặt (nhúng sẵn Key + URL Master) và tải gói ZIP/EXE",
     "data": "master/packages/<CODE>",
     "api": "POST generate_tenant_release"
    },
    {
     "actor": "Chủ quán",
     "screen": "Slave (:8501)",
     "action": "Cài đặt và chạy Slave → Slave tự gọi /api/license/verify khóa Machine ID và mở đúng 18 modules",
     "data": "saas_tenants (machine_id)",
     "api": "POST /api/license/verify"
    }
   ],
   "notes": [
    "Không thể bấm Tạo Gói Cài Đặt nếu chưa qua bước Xác nhận thanh toán / Dùng thử 7 ngày / Override của SuperAdmin.",
    "Sau khi quán Online, kiểm tra đèn xanh Online và độ trễ ms trên danh sách Cửa hàng."
   ]
  },
  {
   "id": "MFLOW-02",
   "title": "Gia hạn Bản quyền Tự động qua VietQR (Self-Billing & Webhook)",
   "actors": [
    "Chủ quán (Slave)",
    "Ngân hàng / Webhook",
    "Kế Toán (Finance)",
    "Master"
   ],
   "goal": "Cho phép quán tự gia hạn gói hoặc mua thêm AI Credit 24/7 không cần chờ thao tác thủ công.",
   "steps": [
    {
     "actor": "Chủ quán",
     "screen": "Slave Admin",
     "action": "Chọn gói gia hạn hoặc gói nạp AI Credit → tạo mã thanh toán VietQR",
     "data": "saas_billing_orders",
     "api": "POST /api/billing/create_order"
    },
    {
     "actor": "Chủ quán",
     "screen": "App Ngân hàng",
     "action": "Quét mã VietQR SVG và chuyển khoản đúng số tiền + nội dung mã đơn",
     "data": "Ngân hàng",
     "api": "GET /api/payment/vietqr_svg"
    },
    {
     "actor": "Webhook / Finance",
     "screen": "Master / Thu Phí",
     "action": "Webhook tự đối soát (hoặc Kế toán bấm Xác nhận tay trong tab Thu Phí)",
     "data": "saas_billing_orders, saas_invoices",
     "api": "POST /api/billing/webhook hoặc /api/billing/confirm"
    },
    {
     "actor": "Master",
     "screen": "Tự động",
     "action": "Tự động cộng thêm ngày sử dụng (expire_date) hoặc cộng ai_bonus_credits cho quán",
     "data": "saas_tenants",
     "api": "Nội bộ Master"
    },
    {
     "actor": "Slave",
     "screen": "Slave Admin",
     "action": "Poll trạng thái đơn thành công → tự đồng bộ bản quyền mới ngay lập tức",
     "data": "local_license_cache",
     "api": "GET /api/billing/status"
    }
   ],
   "notes": [
    "Mọi giao dịch đều tự sinh hóa đơn vào bảng saas_invoices và ghi Audit Trail."
   ]
  },
  {
   "id": "MFLOW-03",
   "title": "Đại lý Phân phối Nạp ví ký quỹ & Cấp License Key cho Quán mới",
   "actors": [
    "Đại lý",
    "Kế Toán (Finance)",
    "Kinh Doanh (Sales)",
    "Master"
   ],
   "goal": "Mở rộng kênh phân phối qua đại lý 4 hạng chiết khấu (15%–55%) với kiểm soát chặt số dư ví ký quỹ.",
   "steps": [
    {
     "actor": "Sales",
     "screen": "Đại Lý Phân Phối",
     "action": "Tạo hồ sơ đại lý và xếp hạng đối tác (Đồng / Bạc / Vàng / Kim Cương)",
     "data": "saas_resellers",
     "api": "POST save_reseller"
    },
    {
     "actor": "Finance",
     "screen": "Modal Nạp Ví",
     "action": "Nhận tiền ký quỹ từ đại lý → nạp vào ví ký quỹ (5M/15M/30M/60M hoặc số thực)",
     "data": "saas_resellers, saas_reseller_wallet_logs",
     "api": "POST deposit_reseller_wallet"
    },
    {
     "actor": "Sales / Admin",
     "screen": "Modal Cấp Key",
     "action": "Nhập thông tin quán mới & gói cước → hệ thống tự trừ ví sau chiết khấu và sinh License Key",
     "data": "saas_tenants, saas_reseller_wallet_logs",
     "api": "POST reseller_issue_license"
    },
    {
     "actor": "Finance",
     "screen": "Lịch sử ví",
     "action": "Đối soát sổ cái ví cuối tháng giữa tổng nạp và danh sách Key đã cấp",
     "data": "saas_reseller_wallet_logs",
     "api": "GET get_reseller_wallet_logs"
    }
   ],
   "notes": [
    "Hệ thống chặn cấp Key nếu số dư ví ký quỹ nhỏ hơn giá trị đơn hàng sau chiết khấu."
   ]
  },
  {
   "id": "MFLOW-04",
   "title": "Phát hành, Đẩy cập nhật OTA & Rollback khẩn cấp xuống chuỗi Quán",
   "actors": [
    "Kỹ Thuật (Tech)",
    "Master OTA & Tunnel",
    "Quán (Slave)"
   ],
   "goal": "Cập nhật tính năng/sửa lỗi đồng loạt xuống hàng chục quán từ xa trong vài phút và có phương án quay lui tức thời.",
   "steps": [
    {
     "actor": "Tech",
     "screen": "CLI Master",
     "action": "Ký số các DLL thay đổi bằng cybernexus_master.exe --sign-dll và đóng gói patch ZIP vào updates/archive/",
     "data": "updates/archive/*.zip, manifest.json",
     "api": "CLI --sign-dll"
    },
    {
     "actor": "Tech",
     "screen": "Quản Lý Cửa Hàng / Kho OTA",
     "action": "Mở modal Đẩy Update, chọn phiên bản bản vá và chọn 1 quán thử nghiệm (hoặc toàn chuỗi)",
     "data": "saas_pending_commands",
     "api": "POST push_store_update"
    },
    {
     "actor": "Master Tunnel",
     "screen": "Reverse Long-Polling",
     "action": "Đẩy lệnh SYSTEM_UPDATE kèm đường dẫn tải đúng phiên bản xuống Slave đang giữ kết nối",
     "data": "saas_pending_commands",
     "api": "POST /api/license/poll"
    },
    {
     "actor": "Slave",
     "screen": "Tự động trên máy quán",
     "action": "Tải patch ZIP, kiểm tra checksum, giải nén cập nhật exe/web, gửi ACK và tự khởi động lại sạch",
     "data": "slave/ + web/",
     "api": "GET /api/updates/download + POST /api/license/ack"
    },
    {
     "actor": "Tech (nếu lỗi)",
     "screen": "Kho Lưu Trữ Bản Vá",
     "action": "Bấm Kích hoạt (Rollback) trên bản vá ổn định trước đó rồi bấm Đẩy bản này xuống quán",
     "data": "updates/patch_latest.zip",
     "api": "POST activate_patch"
    }
   ],
   "notes": [
    "Nên đẩy thử nghiệm cho 1 quán nội bộ trước khi bấm đẩy Toàn hệ thống."
   ]
  },
  {
   "id": "MFLOW-05",
   "title": "Vận hành AI Vault (Zero-Exposure) & Kiểm soát AI Credit toàn chuỗi",
   "actors": [
    "Kỹ Thuật (Tech)",
    "Kế Toán (Finance)",
    "Quán (Slave)",
    "Google Gemini"
   ],
   "goal": "Cung cấp tính năng AI (OCR hóa đơn, tạo ảnh món, tạo banner, dịch i18n) mà tuyệt đối không lộ API Key ra máy khách và không vượt ngân sách.",
   "steps": [
    {
     "actor": "Tech",
     "screen": "Master AI Vault",
     "action": "Nạp 1 hoặc nhiều Google Gemini API Key, bấm Xác thực & Lưu, chọn Key chính đang kích hoạt",
     "data": "master_ai_keys, master_ai_key_history",
     "api": "POST verify_save_gemini_key"
    },
    {
     "actor": "Finance / Tech",
     "screen": "AI Vault › Hạn mức quán",
     "action": "Cấp ai_monthly_quota (mặc định 50) hoặc nạp ai_bonus_credits cho từng quán",
     "data": "saas_tenants",
     "api": "POST update_store_ai_quota"
    },
    {
     "actor": "Slave",
     "screen": "Admin Slave",
     "action": "Quán gọi tác vụ AI (OCR = 1cr, Ảnh món = 2cr, Banner = 3cr) gửi yêu cầu về Master Proxy",
     "data": "Payload ảnh/prompt",
     "api": "POST /api/ai/proxy"
    },
    {
     "actor": "Master",
     "screen": "AI Proxy",
     "action": "Kiểm tra quota quán → dùng key nội bộ gọi Google Gemini → trả kết quả & trừ credit (chỉ trừ khi thành công)",
     "data": "ai_usage_logs, saas_tenants",
     "api": "Google Gemini API"
    }
   ],
   "notes": [
    "Nếu quán hết credit, Master trả HTTP 402 để Slave nhắc chủ quán liên hệ nạp thêm hoặc mua qua Self-Billing."
   ]
  },
  {
   "id": "MFLOW-06",
   "title": "Xử lý sự cố Quán thay máy tính mới / Khóa phần cứng (Hardware Lock)",
   "actors": [
    "Chủ quán",
    "Kỹ Thuật (Tech)",
    "Master License"
   ],
   "goal": "Mở khóa an toàn khi quán nâng cấp phần cứng/đổi máy tính POS mà vẫn ngăn chặn sao chép bản quyền sang 2 máy chạy song song.",
   "steps": [
    {
     "actor": "Chủ quán",
     "screen": "Slave Admin",
     "action": "Cài đặt Slave lên máy tính mới, nhập License Key cũ → nhận cảnh báo lệch Machine ID",
     "data": "local_license_cache",
     "api": "POST /api/license/verify"
    },
    {
     "actor": "Tech",
     "screen": "Quản Lý Cửa Hàng › Chìa khóa",
     "action": "Xác minh chính chủ quán, mở modal Bản Quyền & bấm Reset Hardware Lock",
     "data": "saas_tenants (machine_id cleared), saas_audit_logs",
     "api": "POST reset_hardware_lock"
    },
    {
     "actor": "Chủ quán",
     "screen": "Slave Admin",
     "action": "Bấm Kích hoạt lại bản quyền → Master tự động gắn Machine ID của máy mới và ký lại chứng thư ECDSA",
     "data": "saas_tenants, local_license_cache",
     "api": "POST /api/license/verify"
    }
   ],
   "notes": [
    "Nếu nghi ngờ License Key bị rò rỉ ra ngoài, dùng nút Sinh lại License Key mới (regenerate_license_key) thay vì chỉ Reset Hardware Lock."
   ]
  },
  {
   "id": "MFLOW-07",
   "title": "Điều chỉnh quyền sử dụng 18 Modules & Bộ nhận diện Thương hiệu riêng (White-Label)",
   "actors": [
    "Kinh Doanh (Sales)",
    "Kỹ Thuật (Tech)",
    "Chủ quán"
   ],
   "goal": "Nâng cấp/mở thêm module theo yêu cầu quán (hoặc chặn module khi vi phạm) và tùy biến màu sắc thương hiệu riêng.",
   "steps": [
    {
     "actor": "Sales / Tech",
     "screen": "Modal 18 Modules",
     "action": "Bật thêm module quán vừa mua (VD: promo_voucher_engine hoặc media_jukebox) hoặc chặn module",
     "data": "saas_tenants (enabled_modules, blocked_modules)",
     "api": "POST toggle_module"
    },
    {
     "actor": "Tech",
     "screen": "Theme & Brand Studio",
     "action": "Thiết kế bảng màu Sáng/Tối theo nhận diện logo quán và lưu vào hồ sơ quán",
     "data": "saas_tenants (theme_json)",
     "api": "POST save_tenant_theme"
    },
    {
     "actor": "Slave",
     "screen": "Tự động đồng bộ",
     "action": "Slave nhận danh sách module & theme mới trong chu kỳ đồng bộ tiếp theo (tối đa 5 phút)",
     "data": "local_license_cache",
     "api": "POST /api/license/verify"
    }
   ],
   "notes": [
    "Mọi thay đổi module đều ghi rõ người bật/tắt vào Nhật Ký Audit Trail."
   ]
  },
  {
   "id": "MFLOW-08",
   "title": "Kiểm toán định kỳ & Sao lưu an toàn hệ thống Master + Chuỗi Slave",
   "actors": [
    "Ban Kiểm Toán (Auditor)",
    "Kỹ Thuật (Tech)",
    "Ban Giám Đốc"
   ],
   "goal": "Đảm bảo minh bạch tài chính, phát hiện thao tác bất thường và luôn có bản dự phòng phục hồi thảm họa.",
   "steps": [
    {
     "actor": "Auditor",
     "screen": "Nhật Ký Audit Trail",
     "action": "Rà soát các hành động nhạy cảm (Override SOP-09, Reset HW Lock, Nạp ví đại lý, Gia hạn) và xuất CSV lưu trữ",
     "data": "saas_audit_logs",
     "api": "GET get_audit_logs"
    },
    {
     "actor": "Auditor",
     "screen": "Thu Phí & Đại Lý",
     "action": "Đối chiếu tổng doanh thu saas_invoices và sổ cái ví saas_reseller_wallet_logs với sao kê ngân hàng",
     "data": "saas_invoices, saas_reseller_wallet_logs",
     "api": "GET get_invoices"
    },
    {
     "actor": "Tech",
     "screen": "Máy chủ Master",
     "action": "Kiểm tra các bản sao lưu Slave gửi lên (/api/slave/backup) và sao lưu định kỳ tệp master/database/cybernexus_master.db + thư mục uploads/updates",
     "data": "cybernexus_master.db",
     "api": "POST /api/slave/backup"
    }
   ],
   "notes": [
    "Không chia sẻ tài khoản SuperAdmin chung; mỗi nhân sự dùng 1 tài khoản RBAC riêng để vết kiểm toán có giá trị pháp lý."
   ]
  }
 ],
 "cases": [
  {
   "id": "MCASE-01",
   "sev": "Cao",
   "mods": [
    "SYSTEM",
    "TENANTS"
   ],
   "symptom": "Các quán ngoài internet (4G/VNPT/Viettel/FPT) đều báo Offline dù Master vẫn chạy trên localhost:8500",
   "cause": "Chưa mở Port Forwarding 8500 trên Router, Windows Firewall chặn cổng 8500, nhà mạng cấp IP CGNAT (100.64.x.x), hoặc DNS còn bản ghi IPv6 (AAAA).",
   "fix": "1) Chạy OPEN_FIREWALL_PORT_8500.bat trên máy Master. 2) Kiểm tra Port Forward 8500 TCP trỏ đúng IP LAN tĩnh máy Master. 3) Kiểm tra IP WAN Router khớp ping.eu (không phải CGNAT). 4) Chạy nslookup <domain> 8.8.8.8 và xóa bản ghi AAAA nếu có."
  },
  {
   "id": "MCASE-02",
   "sev": "Cao",
   "mods": [
    "LICENSE",
    "TENANTS"
   ],
   "symptom": "Quán báo lỗi \"Thiết bị không khớp\" hoặc \"Phát hiện local_license_cache bị chỉnh sửa trái phép\"",
   "cause": "Quán thay máy tính/cài lại Windows khiến Machine ID thay đổi, hoặc chữ ký ECDSA P-256 trên máy quán không khớp với Master.",
   "fix": "Xác minh chính chủ quán → vào Quản Lý Cửa Hàng › biểu tượng Chìa khóa → bấm Reset Hardware Lock → hướng dẫn quán kích hoạt lại bản quyền trên Slave."
  },
  {
   "id": "MCASE-03",
   "sev": "Cao",
   "mods": [
    "AIVAULT"
   ],
   "symptom": "Quán gọi tính năng AI (OCR hóa đơn / Tạo ảnh món / Banner) bị lỗi HTTP 402",
   "cause": "Quán đã dùng hết hạn mức ai_monthly_quota và ai_bonus_credits trong tháng.",
   "fix": "Vào tab Master AI Vault › Hạn Mức Cửa Hàng → tăng ai_monthly_quota hoặc bấm nạp thêm ai_bonus_credits cho quán (hoặc hướng dẫn quán tự mua thêm qua Self-Billing VietQR)."
  },
  {
   "id": "MCASE-04",
   "sev": "Cao",
   "mods": [
    "AIVAULT"
   ],
   "symptom": "Toàn bộ các quán đều báo lỗi khi gọi AI (502/503/429) dù vẫn còn AI Credit",
   "cause": "Google Gemini API Key đang kích hoạt trong Master AI Vault bị hết hạn mức, bị thu hồi hoặc lỗi kết nối mạng ra Google.",
   "fix": "Vào Master AI Vault → bấm Test Key để xem lỗi chi tiết (last_error) → kích hoạt 1 API Key dự phòng khác hoặc nạp Key mới."
  },
  {
   "id": "MCASE-05",
   "sev": "Trung bình",
   "mods": [
    "SETTINGS",
    "SYSTEM"
   ],
   "symptom": "Đẩy bản cập nhật OTA xong nhưng quán phản ánh giao diện vẫn như cũ hoặc bị lỗi",
   "cause": "Trình duyệt máy quán giữ cache CSS/JS cũ, hoặc bản vá mới phát sinh lỗi ngoài dự kiến.",
   "fix": "Trước tiên nhắc quán bấm Ctrl+F5. Nếu bản vá thực sự có lỗi: vào Cài Đặt SaaS › Kho Lưu Trữ Bản Vá OTA → bấm Kích hoạt (Rollback) phiên bản ổn định trước đó → bấm Đẩy bản này xuống quán."
  },
  {
   "id": "MCASE-06",
   "sev": "Trung bình",
   "mods": [
    "SOP09"
   ],
   "symptom": "Không bấm được nút Tạo Gói Cài Đặt (Release) trong modal SOP-09 của quán mới",
   "cause": "Cơ chế kiểm soát SOP-09 đang chặn vì quán chưa được Xác nhận thanh toán, chưa bật Dùng thử 7 ngày và chưa có Workflow Override.",
   "fix": "Kế toán bấm Xác nhận đã thu tiền, hoặc Sales bật Dùng thử 7 ngày, hoặc Ban Giám Đốc bấm Cấp quyền ngoại lệ (Workflow Override)."
  },
  {
   "id": "MCASE-07",
   "sev": "Trung bình",
   "mods": [
    "BILLING"
   ],
   "symptom": "Chủ quán đã chuyển khoản VietQR mua gói/AI Credit nhưng hệ thống chưa tự động cộng hạn",
   "cause": "Khách chuyển sai nội dung mã đơn nên Webhook không tự đối soát được, hoặc chưa cấu hình Webhook ngân hàng.",
   "fix": "Kế toán kiểm tra sao kê ngân hàng, vào tab Thu Phí & Hóa Đơn › Đơn Self-Billing → bấm Xác nhận thủ công để cộng hạn/credit ngay cho quán."
  },
  {
   "id": "MCASE-08",
   "sev": "Trung bình",
   "mods": [
    "RESELLERS"
   ],
   "symptom": "Đại lý không cấp được License Key cho quán mới dù tài khoản đại lý vẫn hoạt động",
   "cause": "Số dư ví ký quỹ (wallet_balance) của đại lý nhỏ hơn giá trị gói sau chiết khấu.",
   "fix": "Kiểm tra số dư trong tab Đại Lý Phân Phối → nhận tiền ký quỹ và thực hiện Nạp Ví cho đại lý → cấp Key lại."
  },
  {
   "id": "MCASE-09",
   "sev": "Trung bình",
   "mods": [
    "SYSTEM"
   ],
   "symptom": "Máy Slave nằm cùng mạng LAN với Master không kết nối được bằng tên miền WAN (VD: http://hungtien.net:8500)",
   "cause": "Modem/Router nội bộ không hỗ trợ NAT Loopback (Hairpin NAT).",
   "fix": "Với máy Slave test cùng mạng LAN, cấu hình Master URL bằng IP LAN tĩnh của máy Master (VD: http://10.0.126.159:8500); các quán ở mạng ngoài vẫn dùng tên miền WAN bình thường."
  },
  {
   "id": "MCASE-10",
   "sev": "Thấp",
   "mods": [
    "AUTH"
   ],
   "symptom": "Đăng nhập Master bị báo khóa tạm (HTTP 429 Too Many Requests)",
   "cause": "Nhập sai mật khẩu quá số lần cho phép liên tiếp (bảo vệ chống brute-force trong login_attempts).",
   "fix": "Chờ hết thời gian khóa tạm (vài phút) rồi nhập đúng mật khẩu; nếu quên mật khẩu bộ phận, nhờ SuperAdmin đặt lại trong tab Phân Quyền Bộ Phận."
  },
  {
   "id": "MCASE-11",
   "sev": "Thấp",
   "mods": [
    "TEMPLATES"
   ],
   "symptom": "Xem trước Hợp đồng / Biên bản bàn giao thấy thiếu tên công ty hoặc mã số thuế",
   "cause": "Hồ sơ quán chưa điền đầy đủ các trường pháp lý (legal_entity_name, tax_id_or_cccd, representative_role, billing_address).",
   "fix": "Vào Quản Lý Cửa Hàng → Sửa quán → điền đủ thông tin pháp lý → quay lại tab Biểu Mẫu & Hợp Đồng chọn lại quán để xem trước."
  },
  {
   "id": "MCASE-12",
   "sev": "Cao",
   "mods": [
    "SYSTEM"
   ],
   "symptom": "Slave báo từ chối nạp Plugin DLL sau khi phát hành bản cập nhật mới",
   "cause": "File .dll chưa được ký số ECDSA P-256 hoặc thiếu file .dll.sig đi kèm trong gói OTA.",
   "fix": "Chạy cybernexus_master.exe --sign-dll <đường_dẫn_dll> trên máy Master gốc, đưa cả .dll và .dll.sig vào gói bản vá rồi đẩy OTA lại."
  }
 ],
 "roles": [
  {
   "id": "super_admin",
   "name": "Ban Giám Đốc (SuperAdmin)",
   "home": "/super_admin.html"
  },
  {
   "id": "technical",
   "name": "Kỹ Thuật & Triển Khai (Tech)",
   "home": "/super_admin.html#tenants"
  },
  {
   "id": "finance",
   "name": "Kế Toán & Thu Phí (Finance)",
   "home": "/super_admin.html#billing"
  },
  {
   "id": "sales",
   "name": "Kinh Doanh & CSKH (Sales)",
   "home": "/super_admin.html#tenants"
  },
  {
   "id": "auditor",
   "name": "Ban Kiểm Toán (Audit Trail)",
   "home": "/super_admin.html#audit"
  }
 ],
 "matrix": [
  {
   "f": "Dashboard Chỉ Huy & KPI tổng quan",
   "v": [
    2,
    1,
    2,
    2,
    1
   ]
  },
  {
   "f": "Tạo / Sửa / Xóa mềm & Khôi phục Cửa hàng",
   "v": [
    2,
    2,
    1,
    2,
    1
   ]
  },
  {
   "f": "Giám sát Online/Offline, IP & Định vị GPS",
   "v": [
    2,
    2,
    0,
    1,
    1
   ]
  },
  {
   "f": "Bật/Tắt & Chặn 18 Modules + Phí cà thẻ",
   "v": [
    2,
    2,
    1,
    0,
    1
   ]
  },
  {
   "f": "Reset Hardware Lock, Cấp lại Key & Grace Days",
   "v": [
    2,
    2,
    0,
    0,
    1
   ]
  },
  {
   "f": "Xác nhận thanh toán & Kích hoạt Dùng thử 7d",
   "v": [
    2,
    0,
    2,
    1,
    1
   ]
  },
  {
   "f": "Cấp quyền ngoại lệ Workflow Override (SOP-09)",
   "v": [
    2,
    0,
    0,
    0,
    1
   ]
  },
  {
   "f": "Tải lên tài liệu & Đóng gói bộ cài SOP-09",
   "v": [
    2,
    2,
    1,
    2,
    1
   ]
  },
  {
   "f": "Quản lý Đại lý, Nạp ví ký quỹ & Cấp Key",
   "v": [
    2,
    0,
    2,
    2,
    1
   ]
  },
  {
   "f": "Quản lý Gói cước & Phí dịch vụ",
   "v": [
    2,
    1,
    2,
    1,
    1
   ]
  },
  {
   "f": "Thu phí, In hóa đơn & Duyệt Self-Billing",
   "v": [
    2,
    0,
    2,
    1,
    1
   ]
  },
  {
   "f": "Master AI Vault (Quản lý Gemini API Key)",
   "v": [
    2,
    2,
    0,
    0,
    1
   ]
  },
  {
   "f": "Cấp & Nạp hạn mức AI Credit cho Quán",
   "v": [
    2,
    2,
    2,
    1,
    1
   ]
  },
  {
   "f": "Biểu mẫu Hợp đồng & Biên bản pháp lý",
   "v": [
    2,
    0,
    1,
    2,
    1
   ]
  },
  {
   "f": "Kho bản vá OTA, Đẩy cập nhật & Rollback",
   "v": [
    2,
    2,
    0,
    0,
    1
   ]
  },
  {
   "f": "Cài đặt SaaS, VietQR & Đồng bộ URL Master",
   "v": [
    2,
    2,
    2,
    0,
    1
   ]
  },
  {
   "f": "Theme Studio & I18N Translation Studio",
   "v": [
    2,
    2,
    0,
    0,
    0
   ]
  },
  {
   "f": "Quản lý Nhân sự Bộ phận (RBAC)",
   "v": [
    2,
    0,
    0,
    0,
    1
   ]
  },
  {
   "f": "Xem & Xuất Nhật ký Kiểm toán (Audit Trail)",
   "v": [
    2,
    0,
    1,
    0,
    2
   ]
  }
 ],
 "guides": {
  "super_admin": [
   "AUTH-01",
   "AUTH-02",
   "DASH-01",
   "TEN-02",
   "LIC-01",
   "LIC-02",
   "SOP-01",
   "SOP-03",
   "RES-01",
   "RES-02",
   "RES-03",
   "BIL-02",
   "AIV-01",
   "AIV-02",
   "STF-01",
   "AUD-01",
   "SET-01",
   "SET-02",
   "SET-03",
   "SYS-01"
  ],
  "technical": [
   "AUTH-01",
   "TEN-03",
   "TEN-04",
   "LIC-01",
   "LIC-02",
   "SOP-03",
   "AIV-01",
   "AIV-02",
   "SET-01",
   "SET-02",
   "SET-03",
   "STU-01",
   "STU-02",
   "SYS-01",
   "SYS-02"
  ],
  "finance": [
   "AUTH-01",
   "DASH-01",
   "DASH-02",
   "LIC-03",
   "SOP-01",
   "RES-02",
   "RES-03",
   "PLN-01",
   "BIL-01",
   "BIL-02",
   "AIV-02",
   "SET-01"
  ],
  "sales": [
   "AUTH-01",
   "DASH-01",
   "DASH-02",
   "TEN-01",
   "TEN-02",
   "LIC-03",
   "SOP-01",
   "SOP-02",
   "RES-01",
   "RES-03",
   "PLN-01",
   "TPL-01"
  ],
  "auditor": [
   "AUTH-01",
   "DASH-01",
   "TEN-01",
   "BIL-01",
   "RES-02",
   "AUD-01"
  ]
 },
 "db": [
  {
   "name": "ai_usage_logs",
   "group": "Master AI Vault",
   "desc": "Lịch sử sử dụng AI Proxy của từng quán: loại tác vụ (OCR hóa đơn, tạo ảnh món, tạo banner, dịch i18n), model, số credit tiêu thụ và trạng thái.",
   "rows": 7,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "tenant_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "tenant_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "store_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "action",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "model_used",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "credits_used",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "quota_bucket",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "key_id",
     "t": "INTEGER",
     "pk": false
    }
   ]
  },
  {
   "name": "app_notifications",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Thông báo đẩy nội bộ mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 0,
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
    }
   ]
  },
  {
   "name": "attendances",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Bảng chấm công mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 377,
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
     "n": "shift_no",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "break_minutes",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "close_reason",
     "t": "VARCHAR(20)",
     "pk": false
    }
   ]
  },
  {
   "name": "auth_tokens",
   "group": "Kiểm toán & Bảo mật",
   "desc": "Phiên đăng nhập (token hash, thời hạn, IP, user-agent) phục vụ xác thực an toàn trên Master.",
   "rows": 8,
   "cols": [
    {
     "n": "token_hash",
     "t": "VARCHAR(64)",
     "pk": true
    },
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "expires_at",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "last_used_at",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "ip",
     "t": "VARCHAR(45)",
     "pk": false
    },
    {
     "n": "user_agent",
     "t": "VARCHAR(160)",
     "pk": false
    }
   ]
  },
  {
   "name": "categories",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Danh mục nhóm món mẫu phục vụ khởi tạo gói cài đặt chuẩn.",
   "rows": 3,
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
    }
   ]
  },
  {
   "name": "customer_order_rate_limits",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Giới hạn tần suất đặt món QR mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 2,
   "cols": [
    {
     "n": "bucket_key",
     "t": "CHAR(64)",
     "pk": true
    },
    {
     "n": "window_started_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "request_count",
     "t": "INTEGER",
     "pk": false
    }
   ]
  },
  {
   "name": "customer_order_requests",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Chống gửi trùng đơn (Idempotency) mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 1,
   "cols": [
    {
     "n": "idempotency_key",
     "t": "CHAR(32)",
     "pk": true
    },
    {
     "n": "public_tracking_token",
     "t": "CHAR(64)",
     "pk": false
    },
    {
     "n": "order_id",
     "t": "INTEGER",
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
   "name": "finance_expenses",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Phiếu chi tài chính mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 12,
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
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "vat_amount",
     "t": "INTEGER",
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
    }
   ]
  },
  {
   "name": "kitchen_service_logs",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Nhật ký thời gian bếp/phục vụ mẫu dùng chung thư viện C++ cốt lõi.",
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
   "name": "kpi_evaluations",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Đánh giá KPI nhân sự mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 1,
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
     "n": "period",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "attitude_score",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "teamwork_score",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "manual_bonus",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "manual_deduction",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "note",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "evaluator",
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
   "name": "login_attempts",
   "group": "Kiểm toán & Bảo mật",
   "desc": "Bộ đếm chống dò mật khẩu (Brute-force rate limit), tự khóa tạm khi đăng nhập sai liên tiếp.",
   "rows": 6,
   "cols": [
    {
     "n": "bucket",
     "t": "VARCHAR(160)",
     "pk": true
    },
    {
     "n": "fail_count",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "window_start",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "locked_until",
     "t": "INTEGER",
     "pk": false
    }
   ]
  },
  {
   "name": "master_ai_key_history",
   "group": "Master AI Vault",
   "desc": "Nhật ký vòng đời API Key AI: thêm mới, kiểm tra kết nối, kích hoạt, tạm dừng, xóa và người thao tác.",
   "rows": 5,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "key_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "key_label",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "key_masked",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "event_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "detail",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "actor",
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
   "name": "master_ai_keys",
   "group": "Master AI Vault",
   "desc": "Kho lưu trữ tập trung các Google Gemini API Key (Zero-Exposure): phân tầng tier, ưu tiên, hạn mức credit/ngày, trạng thái hoạt động & lỗi gần nhất.",
   "rows": 2,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "label",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "key_masked",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "api_key",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "tier",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "priority",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "monthly_credit_limit",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "daily_request_limit",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "expires_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "model_count",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "last_checked_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "last_used_at",
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
    },
    {
     "n": "updated_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "provider",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "master_settings",
   "group": "Cài đặt SaaS",
   "desc": "Cấu hình bảo mật mức lõi của Master (khóa cấu hình hệ thống, thông số vận hành AI Vault).",
   "rows": 1,
   "cols": [
    {
     "n": "setting_key",
     "t": "TEXT",
     "pk": true
    },
    {
     "n": "setting_value",
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
   "name": "material_transactions",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Phiếu nhập/xuất kho mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 11,
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
   "group": "Schema mẫu / Nội bộ",
   "desc": "Danh mục nguyên vật liệu kho mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 15,
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
   "name": "order_items",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Chi tiết dòng món mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 966,
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
    }
   ]
  },
  {
   "name": "orders",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Cấu trúc hóa đơn mẫu dùng chung thư viện C++ cốt lõi với Slave.",
   "rows": 370,
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
     "n": "customer_phone",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "public_tracking_token",
     "t": "VARCHAR(64)",
     "pk": false
    },
    {
     "n": "idempotency_key",
     "t": "VARCHAR(64)",
     "pk": false
    }
   ]
  },
  {
   "name": "products",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Danh mục sản phẩm/món ăn mẫu phục vụ khởi tạo gói cài đặt chuẩn.",
   "rows": 10,
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
    }
   ]
  },
  {
   "name": "saas_audit_logs",
   "group": "Kiểm toán & Bảo mật",
   "desc": "Nhật ký kiểm toán (Audit Trail) ghi nhận mọi thao tác quan trọng trên Master kèm tài khoản, vai trò, quán tác động, IP và metadata JSON.",
   "rows": 153,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "staff_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "username",
     "t": "VARCHAR(50)",
     "pk": false
    },
    {
     "n": "role",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "action",
     "t": "VARCHAR(50)",
     "pk": false
    },
    {
     "n": "target_tenant",
     "t": "VARCHAR(50)",
     "pk": false
    },
    {
     "n": "description",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "metadata_json",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "ip_address",
     "t": "VARCHAR(50)",
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
   "name": "saas_billing_orders",
   "group": "Thu phí & Hóa đơn",
   "desc": "Đơn tự thanh toán (Self-Billing) do quán tạo qua VietQR để gia hạn gói hoặc mua thêm AI Credit, đối soát tự động qua webhook.",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "order_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "tenant_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "tenant_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "store_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "billing_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "quantity",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "amount_vnd",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "payment_ref",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "paid_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "saas_invoices",
   "group": "Thu phí & Hóa đơn",
   "desc": "Lịch sử hóa đơn thu phí gia hạn/mua mới bản quyền của các cửa hàng, phương thức thanh toán, người thu và thời hạn mới.",
   "rows": 4,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "invoice_code",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "tenant_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "store_name",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "plan_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "amount",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "payment_method",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "duration_months",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "start_date",
     "t": "DATE",
     "pk": false
    },
    {
     "n": "expire_date",
     "t": "DATE",
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
     "n": "collector_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "transaction_ref",
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
    }
   ]
  },
  {
   "name": "saas_pending_commands",
   "group": "Kênh WAN & OTA",
   "desc": "Hàng đợi lệnh từ xa gửi xuống quán qua Reverse Long-Polling Tunnel (đẩy OTA, thông báo, reset PIN, đồng bộ URL Master).",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "cmd_id",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "tenant_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "cmd_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "payload_json",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "created_ms",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "created_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "delivered_at",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "saas_plans",
   "group": "Gói cước & Bản quyền",
   "desc": "Danh mục các gói dịch vụ SaaS (giá tháng, giá năm, màu badge, danh sách module mặc định theo gói).",
   "rows": 5,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "plan_code",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "price_month",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "price_year",
     "t": "DECIMAL(12, 2)",
     "pk": false
    },
    {
     "n": "description",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "badge_color",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "default_modules",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "sort_order",
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
    }
   ]
  },
  {
   "name": "saas_reseller_wallet_logs",
   "group": "Đại lý & Ví ký quỹ",
   "desc": "Sổ cái biến động ví ký quỹ đại lý: nạp tiền, trừ tiền khi cấp License Key, số dư trước/sau và người thực hiện.",
   "rows": 4,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "reseller_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "reseller_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "trans_type",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "amount",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "balance_before",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "balance_after",
     "t": "REAL",
     "pk": false
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
     "n": "note",
     "t": "TEXT",
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
    }
   ]
  },
  {
   "name": "saas_resellers",
   "group": "Đại lý & Ví ký quỹ",
   "desc": "Danh sách đại lý phân phối, hạng đối tác (Bronze/Silver/Gold/Diamond), % chiết khấu và số dư ví ký quỹ.",
   "rows": 1,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "reseller_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "company_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "contact_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "phone",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "email",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "tier",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "discount_percent",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "wallet_balance",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "notes",
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
   "name": "saas_settings",
   "group": "Cài đặt SaaS",
   "desc": "Cấu hình chung của nền tảng Master: URL Master, ngân hàng VietQR, hotline hỗ trợ, chính sách nhắc hạn, thư mục gói quán.",
   "rows": 17,
   "cols": [
    {
     "n": "setting_key",
     "t": "VARCHAR(50)",
     "pk": true
    },
    {
     "n": "setting_value",
     "t": "TEXT",
     "pk": false
    }
   ]
  },
  {
   "name": "saas_staff_users",
   "group": "Nhân sự & RBAC",
   "desc": "Tài khoản nhân sự vận hành Master theo 5 bộ phận (SuperAdmin, Technical, Finance, Sales, Auditor) kèm phân quyền.",
   "rows": 5,
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
     "n": "password_hash",
     "t": "VARCHAR(255)",
     "pk": false
    },
    {
     "n": "fullname",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "email",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "phone",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "role",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "department",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "permissions",
     "t": "TEXT",
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
     "n": "last_login_at",
     "t": "DATETIME",
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
   "name": "saas_tenant_documents",
   "group": "Hồ sơ SOP-09",
   "desc": "Tài liệu pháp lý, hợp đồng, biên bản bàn giao, ảnh GPKD/CCCD lưu đính kèm theo từng cửa hàng.",
   "rows": 45,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "tenant_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "tenant_code",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "category",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "file_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "file_path",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "file_size",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "file_ext",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "title",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "notes",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "status",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "uploaded_by",
     "t": "TEXT",
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
   "name": "saas_tenants",
   "group": "Quản lý Cửa hàng",
   "desc": "Hồ sơ trung tâm của từng quán (Tenant): thông tin pháp lý, gói cước, License Key, Hardware/Machine ID, 18 modules bật/chặn, IP LAN/WAN, tọa độ GPS, AI quota, trạng thái quy trình SOP-09 và theme riêng.",
   "rows": 9,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "tenant_code",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "store_name",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "owner_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "phone",
     "t": "VARCHAR(25)",
     "pk": false
    },
    {
     "n": "email",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "address",
     "t": "VARCHAR(255)",
     "pk": false
    },
    {
     "n": "admin_username",
     "t": "VARCHAR(50)",
     "pk": false
    },
    {
     "n": "plan_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "plan_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "billing_cycle",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "subscription_status",
     "t": "VARCHAR(20)",
     "pk": false
    },
    {
     "n": "start_date",
     "t": "DATE",
     "pk": false
    },
    {
     "n": "expire_date",
     "t": "DATE",
     "pk": false
    },
    {
     "n": "enabled_modules",
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
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "updated_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "license_key",
     "t": "VARCHAR(40)",
     "pk": false
    },
    {
     "n": "machine_id",
     "t": "VARCHAR(40)",
     "pk": false
    },
    {
     "n": "machine_name",
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "machine_bound_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "last_check_at",
     "t": "DATETIME",
     "pk": false
    },
    {
     "n": "last_check_ip",
     "t": "VARCHAR(60)",
     "pk": false
    },
    {
     "n": "last_app_version",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "logo_path",
     "t": "VARCHAR(255)",
     "pk": false
    },
    {
     "n": "reseller_id",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "price_charged",
     "t": "REAL",
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
     "n": "lan_ip",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "wan_ip",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "geo_lat",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "geo_lng",
     "t": "REAL",
     "pk": false
    },
    {
     "n": "geo_label",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "geo_source",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "ai_monthly_quota",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "ai_bonus_credits",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "default_pin_sha256",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "default_pin_enc",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "pin_reset_pending",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "legal_entity_name",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "tax_id_or_cccd",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "representative_role",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "billing_address",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "workflow_stage",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "payment_confirmed",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "payment_confirmed_by",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "payment_confirmed_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "trial_started_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "handover_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "warranty_until",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "workflow_override",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "deleted_at",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "deleted_reason",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "theme_json",
     "t": "TEXT",
     "pk": false
    },
    {
     "n": "machine_reset_pending",
     "t": "INTEGER",
     "pk": false
    }
   ]
  },
  {
   "name": "staff_compensation",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Phụ cấp nhân sự mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 10,
   "cols": [
    {
     "n": "user_id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "meal_allowance",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "position_allowance",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "transport_allowance",
     "t": "INTEGER",
     "pk": false
    },
    {
     "n": "other_allowance",
     "t": "INTEGER",
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
   "name": "store_settings",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Bảng thiết lập cửa hàng mẫu dùng khi khởi tạo/đóng gói dữ liệu chuẩn.",
   "rows": 40,
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
   "group": "Schema mẫu / Nội bộ",
   "desc": "Chi tiết hóa đơn nhà cung cấp mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 0,
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
     "t": "DECIMAL(14,2)",
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
   "group": "Schema mẫu / Nội bộ",
   "desc": "Hóa đơn nhà cung cấp mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 0,
   "cols": [
    {
     "n": "id",
     "t": "INTEGER",
     "pk": true
    },
    {
     "n": "invoice_code",
     "t": "VARCHAR(40)",
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
     "t": "VARCHAR(100)",
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
     "t": "DATE",
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
   "group": "Schema mẫu / Nội bộ",
   "desc": "Thanh toán công nợ nhà cung cấp mẫu dùng chung thư viện C++ cốt lõi.",
   "rows": 0,
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
     "t": "VARCHAR(100)",
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
   "group": "Schema mẫu / Nội bộ",
   "desc": "Nhà cung cấp mẫu dùng chung thư viện C++ cốt lõi.",
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
     "t": "VARCHAR(100)",
     "pk": false
    },
    {
     "n": "phone",
     "t": "VARCHAR(30)",
     "pk": false
    },
    {
     "n": "email",
     "t": "VARCHAR(150)",
     "pk": false
    },
    {
     "n": "address",
     "t": "VARCHAR(255)",
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
   "group": "Schema mẫu / Nội bộ",
   "desc": "Danh mục khu vực/bàn mẫu phục vụ khởi tạo gói cài đặt chuẩn.",
   "rows": 10,
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
     "n": "table_order_token",
     "t": "VARCHAR(64)",
     "pk": false
    }
   ]
  },
  {
   "name": "users",
   "group": "Schema mẫu / Nội bộ",
   "desc": "Bảng người dùng cơ sở (tài khoản hệ thống / đồng bộ mẫu cấu trúc POS).",
   "rows": 5,
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
   "path": "/",
   "methods": [
    "GET"
   ],
   "desc": "Chuyển hướng vào Cổng Quản Trị Super Admin (/super_admin.html)"
  },
  {
   "path": "/api/ai/proxy",
   "methods": [
    "POST"
   ],
   "desc": "Zero-Exposure AI Proxy: nhận yêu cầu AI từ Slave, kiểm tra & trừ AI Credit rồi gọi Gemini bằng key trên Master"
  },
  {
   "path": "/api/ai/quota",
   "methods": [
    "POST"
   ],
   "desc": "Truy vấn số dư AI Credit tháng + bonus của quán"
  },
  {
   "path": "/api/billing/confirm",
   "methods": [
    "POST"
   ],
   "desc": "Kế toán / SuperAdmin xác nhận thủ công đơn Self-Billing đã nhận tiền"
  },
  {
   "path": "/api/billing/create_order",
   "methods": [
    "POST"
   ],
   "desc": "Slave tự tạo đơn thanh toán VietQR gia hạn gói hoặc mua thêm AI Credit"
  },
  {
   "path": "/api/billing/orders",
   "methods": [
    "GET"
   ],
   "desc": "Danh sách đơn Self-Billing trên màn hình Thu Phí & Hóa Đơn"
  },
  {
   "path": "/api/billing/status",
   "methods": [
    "GET"
   ],
   "desc": "Kiểm tra trạng thái thanh toán của đơn Self-Billing"
  },
  {
   "path": "/api/billing/webhook",
   "methods": [
    "POST"
   ],
   "desc": "Webhook nhận thông báo biến động số dư ngân hàng để tự động gia hạn / cộng AI Credit"
  },
  {
   "path": "/api/download_package",
   "methods": [
    "GET"
   ],
   "desc": "Tải gói cài đặt đã đóng gói riêng cho từng quán (ZIP/EXE)"
  },
  {
   "path": "/api/health",
   "methods": [
    "GET"
   ],
   "desc": "Kiểm tra sức khỏe máy chủ Master (uptime, DB, version)"
  },
  {
   "path": "/api/i18n/ai-translate",
   "methods": [
    "POST"
   ],
   "desc": "Dịch tự động chuỗi giao diện đa ngôn ngữ bằng AI Gemini trong I18N Studio"
  },
  {
   "path": "/api/i18n/catalog",
   "methods": [
    "GET"
   ],
   "desc": "Lấy toàn bộ danh mục khóa ngôn ngữ i18n (VI/EN/...)"
  },
  {
   "path": "/api/i18n/publish",
   "methods": [
    "POST"
   ],
   "desc": "Xuất bản bộ ngôn ngữ i18n ra file locales để áp dụng toàn hệ thống"
  },
  {
   "path": "/api/i18n/save",
   "methods": [
    "POST"
   ],
   "desc": "Lưu bản chỉnh sửa từ điển ngôn ngữ i18n"
  },
  {
   "path": "/api/license/ack",
   "methods": [
    "POST"
   ],
   "desc": "Slave xác nhận đã nhận và thực thi xong lệnh từ hàng đợi saas_pending_commands"
  },
  {
   "path": "/api/license/ping",
   "methods": [
    "GET"
   ],
   "desc": "Slave gửi nhịp tim (heartbeat), IP LAN/WAN, phiên bản app lên Master"
  },
  {
   "path": "/api/license/poll",
   "methods": [
    "POST"
   ],
   "desc": "Kênh Reverse Long-Polling Tunnel: Slave giữ kết nối chờ lệnh từ Master (OTA, thông báo, reset PIN)"
  },
  {
   "path": "/api/license/verify",
   "methods": [
    "POST"
   ],
   "desc": "Slave gửi Hardware ID + License Key để xác thực bản quyền & nhận chữ ký ECDSA + 18 modules"
  },
  {
   "path": "/api/master",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Alias API quản trị Master (?action=...)"
  },
  {
   "path": "/api/master.php",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Alias API quản trị Master (?action=...)"
  },
  {
   "path": "/api/payment/vietqr_svg",
   "methods": [
    "GET"
   ],
   "desc": "Sinh mã QR VietQR dạng SVG sắc nét cho thanh toán phí bản quyền / đại lý"
  },
  {
   "path": "/api/slave/backup",
   "methods": [
    "POST"
   ],
   "desc": "Tiếp nhận file sao lưu CSDL store_local.db do Slave đẩy lên lưu trữ tập trung"
  },
  {
   "path": "/api/super_admin",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "API chính xử lý toàn bộ 79 action quản trị Super Admin (?action=...)"
  },
  {
   "path": "/api/super_admin.html",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Alias API quản trị Super Admin (?action=...)"
  },
  {
   "path": "/api/super_admin.php",
   "methods": [
    "GET",
    "POST"
   ],
   "desc": "Alias API quản trị Super Admin (?action=...)"
  },
  {
   "path": "/api/updates/download",
   "methods": [
    "GET"
   ],
   "desc": "Cho phép Slave tải file patch.zip theo phiên bản cụ thể hoặc bản mới nhất"
  },
  {
   "path": "/api/updates/latest",
   "methods": [
    "GET"
   ],
   "desc": "Trả thông tin bản vá OTA mới nhất cho Slave kiểm tra cập nhật"
  },
  {
   "path": "/api/updates/manifest",
   "methods": [
    "GET"
   ],
   "desc": "Trả manifest.json chi tiết (version, checksum, changelog) của bản vá OTA"
  },
  {
   "path": "/favicon.ico",
   "methods": [
    "GET"
   ],
   "desc": "Biểu tượng trình duyệt (ICO)"
  },
  {
   "path": "/favicon.png",
   "methods": [
    "GET"
   ],
   "desc": "Biểu tượng trình duyệt (PNG)"
  },
  {
   "path": "/i18n_studio.html",
   "methods": [
    "GET"
   ],
   "desc": "Ứng dụng Quản Trị Ngôn Ngữ & AI Translation Studio"
  },
  {
   "path": "/i18n_studio_data.js",
   "methods": [
    "GET"
   ],
   "desc": "Dữ liệu danh mục i18n cho I18N Studio"
  },
  {
   "path": "/licensing",
   "methods": [
    "GET"
   ],
   "desc": "Alias truy cập nhanh quản lý bản quyền"
  },
  {
   "path": "/login",
   "methods": [
    "GET"
   ],
   "desc": "Chuyển hướng tới màn hình đăng nhập Master"
  },
  {
   "path": "/login.html",
   "methods": [
    "GET"
   ],
   "desc": "Chuyển hướng tới màn hình đăng nhập Master"
  },
  {
   "path": "/master",
   "methods": [
    "GET"
   ],
   "desc": "Alias truy cập nhanh Master Super Admin"
  },
  {
   "path": "/master.html",
   "methods": [
    "GET"
   ],
   "desc": "Alias truy cập nhanh Master Super Admin"
  },
  {
   "path": "/platform",
   "methods": [
    "GET"
   ],
   "desc": "Alias truy cập nhanh nền tảng SaaS"
  },
  {
   "path": "/super_admin",
   "methods": [
    "GET"
   ],
   "desc": "Giao diện Trung Tâm Chỉ Huy Super Admin"
  },
  {
   "path": "/super_admin.html",
   "methods": [
    "GET"
   ],
   "desc": "Giao diện Trung Tâm Chỉ Huy Super Admin"
  },
  {
   "path": "/super_admin.php",
   "methods": [
    "GET"
   ],
   "desc": "Alias tương thích tới Super Admin"
  },
  {
   "path": "/theme_studio",
   "methods": [
    "GET"
   ],
   "desc": "Ứng dụng Theme & Brand Studio thiết kế bộ nhận diện cho quán"
  }
 ],
 "actions": {
  "master_handlers.cpp": [
   "activate_gemini_key",
   "activate_patch",
   "activate_trial_7d",
   "catalog",
   "change_password",
   "check",
   "check_auth",
   "check_store_online",
   "confirm_payment",
   "dashboard_stats",
   "delete_gemini_key",
   "delete_patch",
   "delete_staff_user",
   "delete_tenant_document",
   "deposit_reseller_wallet",
   "detail",
   "generate_tenant_release",
   "get_ai_vault",
   "get_audit_logs",
   "get_invoices",
   "get_legal_templates",
   "get_package_storage",
   "get_plans",
   "get_reseller_wallet_logs",
   "get_resellers",
   "get_saas_settings",
   "get_staff_users",
   "get_tenant_detail",
   "get_tenant_documents",
   "get_tenant_license",
   "get_tenant_packages",
   "get_tenant_theme",
   "get_tenants",
   "grant_workflow_override",
   "invoices",
   "license_init_keys",
   "license_overview",
   "license_save_grace",
   "list_patches",
   "login",
   "logout",
   "ping",
   "plans",
   "push_store_update",
   "quick_extend",
   "regenerate_license_key",
   "reseller_issue_license",
   "reset_hardware_lock",
   "reset_machine",
   "reset_store_owner_pin",
   "restore_tenant",
   "retry_store_package",
   "saas_settings",
   "save_ai_vault",
   "save_card_fee",
   "save_legal_template",
   "save_package_storage",
   "save_reseller",
   "save_saas_settings",
   "save_settings",
   "save_staff_user",
   "save_tenant",
   "save_tenant_theme",
   "set_all_modules",
   "soft_delete_tenant",
   "status",
   "sync_master_url",
   "tenant_detail",
   "tenants",
   "test_gemini_key",
   "toggle_gemini_key",
   "toggle_module",
   "toggle_status",
   "update_gemini_key_meta",
   "update_store_ai_quota",
   "update_store_location",
   "upload_tenant_document",
   "verify",
   "verify_save_gemini_key"
  ]
 }
};
