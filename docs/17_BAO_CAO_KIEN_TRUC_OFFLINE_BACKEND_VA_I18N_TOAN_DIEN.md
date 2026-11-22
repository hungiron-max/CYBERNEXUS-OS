# BÁO CÁO KIỂM TRA, PHÂN TÍCH & ĐỀ XUẤT ĐỢT 7: KIẾN TRÚC BACKEND TẬP TRUNG OFFLINE-FIRST (THIN-CLIENT JS) & HỆ THỐNG QUẢN TRỊ ĐA NGÔN NGỮ TOÀN DIỆN (BACKEND – FRONTEND – DATABASE – STYLESHEET – TEMPLATE)

**Thời gian lập báo cáo:** `22/11/2026 09:50`  
**Phạm vi rà soát:** Toàn bộ mã nguồn C++ (`master/src`, `slave/src`, `shared/`, `launcher/`), 34 file JavaScript, 13 giao diện HTML, 8 file CSS, 2 cơ sở dữ liệu SQLite (`store_local.db`, `cybernexus_master.db`), hệ thống mẫu in nhiệt ESC/POS & HTML (`printer_bridge.hpp`, `receipt_template.js`) và bộ công cụ ngôn ngữ (`16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html`, `sync_i18n_csv_to_json.py`, `SYSTEM_MESSAGES_I18N.csv`).

---

## PHẦN 1. KIỂM TRA & PHÂN TÍCH QUY TẮC VẬN HÀNH: BACKEND TẬP TRUNG TẠI MÁY CHỦ QUÁN (SLAVE), CHẠY OFFLINE 100%, KIỂM SOÁT CẤP PHÉP TỪ SUPERADMIN (MASTER) & LỚP ĐỆM THIN-CLIENT JS

### 1.1. Những điểm hệ thống đã đạt chuẩn
1. **Kiến trúc thực thi tại chỗ (On-Premise Edge Node):** Toàn bộ máy tính thu ngân, màn hình Bếp KDS, điện thoại nhân viên phục vụ, máy Kiosk chấm công và điện thoại khách quét QR đều kết nối HTTP vào tiến trình C++ `cybernexus_slave.exe` chạy trên máy chủ của quán cùng cơ sở dữ liệu SQLite cục bộ `store_local.db`.
2. **Xác thực chữ ký số bất đối xứng (ECDSA P-256 CNG):** 3 module DLL gốc (`libmod_card_payment.dll`, `libmod_media_stream.dll`, `libmod_network_qos.dll`) và gói cập nhật OTA (`X-Package-SHA256`) đã được kiểm tra chữ ký số ECDSA P-256 trước khi nạp.
3. **Kiểm tra toàn vẹn mã nguồn Web (`SEC-19`):** Khi `cybernexus_slave.exe` khởi động, hàm `verifyWebIntegrity()` trong `slave/src/main_slave.cpp:32-90` tự động băm SHA-256 toàn bộ **50 file** HTML/JS/CSS/JSON đối chiếu với `slave/web/web_integrity.json`.

---

### 1.2. Các khuyết tật & lỗ hổng kiến trúc phát hiện khi kiểm tra sâu

#### 🔴 Khuyết tật 1 (`ARCH-04` - Ưu tiên P0): Lỗ hổng kiểm soát License Offline, Chưa chặn thuê bao bị SuperAdmin khóa (`suspended`/`expired`), Thiếu chống vặn ngược đồng hồ Windows (Clock Rollback) & Thiếu `requireModule` ở các API Đợt 6
Qua rà soát trực tiếp `slave/src/slave_license.cpp` và `slave/src/slave_dot6_handlers.cpp`:
1. **`isModuleEnabled()` không kiểm tra trạng thái thuê bao (`subscription_status`) và ngày hết hạn (`expire_date`):**
   - Tại `slave/src/slave_license.cpp:345-375`:
     ```cpp
     bool LicenseService::isModuleEnabled(const std::string& moduleCode) {
         if (isMachineMismatch()) return false;
         if (moduleCode == "pos_core" || moduleCode == "mod_pos_core" ||
             moduleCode == "finance_admin" || moduleCode == "mod_finance_admin") return true;
     ```
   - Hàm này **chỉ kiểm tra `isMachineMismatch()`**, hoàn toàn **không kiểm tra `subscription_status`** (`suspended`, `expired`, `deleted`) hay `daysLeft < 0`!
   - Hơn nữa, `pos_core` và `finance_admin` **luôn trả về `true` vô điều kiện** (`L347-351`), và `svr.set_pre_routing_handler` tại `slave/src/main_slave.cpp:218-233` cũng chỉ chặn khi `isMachineMismatch() == true`.
   - **Hệ quả:** Ngay cả khi Máy chủ SuperAdmin (Master) đã bấm **Đình chỉ (`suspended`)** hoặc thuê bao đã **Hết hạn (`expired`)**, máy chủ Slave của quán vẫn tạo đơn, thanh toán, kết ca và xem báo cáo tài chính bình thường!
2. **Chữ ký ECDSA P-256 của License chưa bao gồm `subscription_status` và `blocked_modules`:**
   - Tại `slave/src/slave_license.cpp:310`: `buildCanonicalPayload(licKey, boundMid, expDate, normMods)` mới ký 4 trường `(license_key, bound_machine_id, expire_date, enabled_modules)`, chưa ký `subscription_status` và `blocked_modules`. Nếu người có quyền máy chủ quán mở `store_local.db` sửa cột `subscription_status = 'active'` hoặc xóa `blocked_modules = '[]'`, chữ ký ECDSA vẫn không phát hiện ra.
3. **Thiếu cơ chế chống quay ngược đồng hồ hệ thống (Anti-Clock-Rollback) & Giới hạn thời gian chạy Offline (Offline Lease TTL):**
   - Tại `slave/src/slave_license.cpp:548-550`, hạn sử dụng được tính bằng `std::difftime(expTime, std::time(nullptr))`. Nếu chủ quán rút dây mạng Internet để cắt kết nối với Master vĩnh viễn rồi **chỉnh lùi giờ Windows** về trước `expire_date`, hệ thống sẽ chạy Offline vô thời hạn mà SuperAdmin không thể thu hồi quyền.
4. **Các endpoint mới trong `slave_dot6_handlers.cpp` chưa gọi `requireModule()`:**
   - Các route `/api/attendance/hikvision/*`, `web_checkin`, `web_checkout`, `kiosk_punch`, `my_attendance_status` chưa kiểm tra `requireModule(res, "staff_shifts", ...)`; các route `/api/printer/*` chưa kiểm tra `LicenseService::instance().isSystemActive()`.

**Đề xuất khắc phục (`ARCH-04`):**
- Bổ sung hàm `LicenseService::isSystemActive(std::string* outReason)` kiểm tra đồng thời:
  1. `isMachineMismatch() == false`
  2. `subscription_status == "active" || subscription_status == "trial" || subscription_status == "expiring_soon"` (chặn ngay `403 LICENSE_SUSPENDED / LICENSE_EXPIRED` ở `set_pre_routing_handler` đối với mọi API vận hành khi thuê bao bị SuperAdmin khóa hoặc hết hạn, chỉ mở `/api/license`, `/api/auth`, `/api/wan_tunnel` và chế độ xuất dữ liệu chỉ-đọc nếu được phép).
  3. Mở rộng `buildCanonicalPayload` ký cả `subscription_status`, `blocked_modules` và `offline_lease_days`.
  4. Lưu mốc thời gian cao nhất từng quan sát được (`max_observed_epoch` từ đồng hồ hệ thống, thời gian phản hồi Master, `orders.created_at`, `attendances.check_in_time`, `audit_logs.created_at`) kèm chữ ký chống sửa vào DB: nếu đồng hồ Windows bị vặn lùi quá 10 phút (`now < max_observed_epoch - 600`) hoặc mất kết nối Master quá `offline_lease_days` (mặc định 7 ngày, SuperAdmin tùy chỉnh được), tự động khóa vận hành yêu cầu kết nối lại Master để gia hạn Lease.
  5. Gắn `requireModule("staff_shifts")` và `isSystemActive()` đầy đủ vào `slave_dot6_handlers.cpp`.

---

#### 🔴 Khuyết tật 2 (`ARCH-05` - Ưu tiên P0): Phụ thuộc dịch vụ Internet bên ngoài (`img.vietqr.io`) khi chạy Offline & Lưu dữ liệu cấu hình/khóa nhạy cảm trên `localStorage` của trình duyệt từng thiết bị thay vì tại C++ Backend
Qua quét tự động toàn bộ mã nguồn HTML/JS bằng `audit_arch_and_i18n.py`:
1. **Hiển thị mã VietQR trên máy POS và điện thoại khách đang gọi trực tiếp ra Internet (`https://img.vietqr.io`):**
   - Phát hiện tại **5 vị trí**:
     - `slave/web/customer.html:1621`
     - `slave/web/assets/js/customer_app.js:738` & `L1019`
     - `slave/web/assets/js/pos.js:1903`
     - `slave/src/slave_handlers.cpp:4139`
   - **Hệ quả:** Khi quán mất Internet (chạy mạng LAN Offline) hoặc khách hàng kết nối vào Wi-Fi nội bộ của quán nhưng chỉ mở LAN tới máy chủ Slave, trình duyệt không tải được ảnh từ `img.vietqr.io`, dẫn đến **hỏng hoàn toàn luồng hiển thị mã QR chuyển khoản**!
2. **Nhiều cấu hình vận hành và khóa API nhạy cảm đang lưu trên `localStorage` của trình duyệt từng máy thay vì tập trung tại SQLite C++ Backend:**
   - `slave/web/assets/js/admin_inventory.js`: Lưu `localStorage.getItem('pos_gemini_api_key')` / `setItem('pos_gemini_api_key')` ngay trên trình duyệt! Lộ khóa API nếu ai đó mở F12 trên máy trạm và không đồng bộ giữa các thiết bị trong quán.
   - `slave/web/assets/js/receipt_template.js`: Đọc `localStorage.getItem('cnx_receipt_tpl_json')` trên trình duyệt từng máy — nếu Admin sửa mẫu in hóa đơn trên máy khác, máy thu ngân vẫn dùng mẫu cũ trong `localStorage`.
   - `slave/web/assets/js/admin.js`, `admin_inline_ext.js`, `kitchen_kds.js`, `order_waiter.js`, `index.html`: Đang lưu `localStorage.getItem('server_lan_base_url')` rời rạc ở từng máy trạm.
   - `docs/16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html:137,158,188,292`: Lưu toàn bộ bản dịch & trạng thái duyệt vào `localStorage` (`cbnx_i18n_studio_v1`) của trình duyệt cá nhân và cho phép nhập Gemini API Key trực tiếp ở ô input HTML thay vì xử lý qua C++ Backend.

**Đề xuất khắc phục (`ARCH-05`):**
- **Bộ sinh VietQR EMVCo Napas247 Offline 100% trong C++ Backend:** Viết hàm sinh chuỗi chuẩn **EMVCo VietQR (`00020101021238...6304<CRC16-CCITT>`)** theo BIN ngân hàng (`9704xx`) + Số tài khoản + Số tiền + Nội dung `TT <order_code>` ngay trong C++ Backend (`slave_handlers.cpp` / `GET /api/payment/vietqr_payload`), trả chuỗi EMVCo về để Frontend vẽ trực tiếp bằng thư viện nội bộ `/assets/vendor/qrcode.min.js` (hoạt động 100% Offline không cần Internet!).
- **Thu hồi toàn bộ cấu hình & trạng thái về C++ Backend:** Xóa `pos_gemini_api_key`, `cnx_receipt_tpl_json`, `server_lan_base_url` khỏi `localStorage`; mọi thiết bị khi mở trang đều nạp cấu hình trực tiếp từ API C++ Backend của máy chủ quán.

---

#### 🟠 Khuyết tật 3 (`ARCH-06` - Ưu tiên P1): Chuẩn hóa 100% các file JS thành Lớp Đệm (Thin-Client Adapter) — Rút toàn bộ công thức tính tiền/thuế/khuyến mãi và kiểm tra quyền về C++ Backend
Qua phân tích 34 file JS (`audit_arch_and_i18n.py` Mục 3):
1. **JS vẫn tự tính nhẩm tiền hàng, giảm giá voucher và thuế VAT ở phía Client:**
   - Tại `slave/web/assets/js/pos.js` (`6` vị trí) và `slave/web/assets/js/customer_app.js` (`2` vị trí): JS tự tính `subtotal`, `discount_amount` (kể cả điều kiện voucher giờ vàng/đơn tối thiểu), `vat_amount`, `total_amount` để hiển thị trước khi gửi lên Server. Nếu quy tắc tính ở C++ thay đổi hoặc làm tròn khác, số tiền hiển thị trên màn hình trước khi bấm thanh toán sẽ lệch với số tiền C++ Backend chốt trong DB.
2. **Giao diện tin vào `localStorage.getItem('pos_user')` để kiểm tra `role` và ẩn/hiện chức năng:**
   - Tại `admin.html`, `index.html`, `kitchen.html`, `order.html`, `online_orders.html` và `admin_ops_kpi.js` (`7` vị trí check `role`): giao diện đọc JSON `pos_user` lưu trong `localStorage`. Nếu nhân viên mở F12 sửa `localStorage.setItem('pos_user', '{"role":"admin"}')` rồi F5, giao diện sẽ hiển thị các tab/nút của Admin (dù gọi API vẫn bị C++ chặn 403).
3. **Xử lý khi phát hiện file JS/HTML bị can thiệp (`web_integrity.json`):**
   - Hiện `verifyWebIntegrity()` mới ghi log khi khởi động và trả qua `GET /api/system/integrity`, chưa tự động đẩy cảnh báo `WEB_INTEGRITY_TAMPERED` về Máy chủ SuperAdmin (Master) hoặc khóa giao diện khi phát hiện file `.js` bị chèn mã lạ.

**Đề xuất khắc phục (`ARCH-06`):**
- Bổ sung action `POST /api/orders?action=preview_quote` trên C++ Backend: mỗi khi giỏ hàng, mã khuyến mãi hoặc chiết khấu trên POS / QR Khách thay đổi, JS gửi danh sách `{product_id, quantity, toppings}` + `promo_code` lên C++ Backend để nhận bảng tính chuẩn (`subtotal`, `discount_amount`, `vat_amount`, `total_amount`, `promo_message`, `requires_manager_pin`). JS chỉ đóng vai trò render DOM.
- Bỏ việc đọc `role` từ `localStorage.getItem('pos_user')`; mọi trang khi khởi tạo gọi `GET /api/auth?action=check` lấy trực tiếp `user` + `role` + `enabled_modules` + `license_state` từ phiên C++ Backend và đóng băng đối tượng trong bộ nhớ (`Object.freeze`).
- Định kỳ kiểm tra lại `verifyWebIntegrity()` và đẩy cảnh báo tức thời về Master qua kết nối heartbeat/poll nếu bất kỳ file JS/HTML nào trên Slave bị chỉnh sửa.

---

## PHẦN 2. PHÂN TÍCH KỸ CÔNG CỤ QUẢN TRỊ NGÔN NGỮ (`I18N STUDIO`) TỪ BACKEND, FRONTEND, DATABASE, STYLESHEET ĐẾN TEMPLATE

### 2.1. Tổng quan thực trạng Độ phủ Đa ngôn ngữ hiện tại

| Tầng hệ thống | Tổng số mục chữ / phần tử hiển thị | Đã nạp vào I18N Studio / `data-i18n` | Tỷ lệ bao phủ | Đánh giá thực trạng |
| :--- | :---: | :---: | :---: | :--- |
| **1. Công cụ I18N Studio (`16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html`)** | 548 dòng CSV (`alert`/`toast`/`sendError`) | 548 dòng | **Thiếu cột định danh** | **Chưa có cột "Tên Trường / Cột / Loại UI / Màn hình / Bảng-Cột DB"**; đang chạy tĩnh trên `localStorage`, chưa gắn vào DB & API C++ Backend. |
| **2. Frontend HTML (`13` file HTML: `<th>`, `<label>`, `<button>`, `<option>`, `<h1>..<h4>`, `placeholder`)** | **1.994 phần tử** | **40 phần tử** | **2.0%** | **98.0% tiêu đề cột bảng (`<th>`), nhãn trường (`<label>`), nút bấm, placeholder chưa có `data-i18n`** (`admin.html`: 0/1.039; `super_admin.html`: 0/430; `attendance.html`: 0/35; `index.html`: 0/56; `order.html`: 0/41). |
| **3. Backend C++ (`slave_handlers.cpp`, `slave_dot6_handlers.cpp`, `master_handlers.cpp`, `upload_guard.hpp`)** | ~620 thông báo API | ~548 câu cũ | **~85%** | Khoảng **70+ thông báo mới ở Đợt 5–6** (`UploadGuard`, `PrinterBridge`, `Hikvision ISAPI`, `kiosk_punch`, `change_payment_method`, `close_shift`) chưa có mã `code` i18n chuẩn. |
| **4. Database (`categories`, `products`, `tables_areas`, `promotions`, `store_settings`, `m_catalog`)** | 14 nhóm món + 42 món ăn + 13 bàn + 18 module + cài đặt quán | **0 cột đa ngôn ngữ** | **0.0%** | **Chưa có cột `i18n_json` hoặc bảng dịch DB** $\rightarrow$ khách chọn tiếng Anh/Trung trên Menu QR vẫn thấy 100% tên món ăn, nhóm món, đơn vị tính bằng tiếng Việt. |
| **5. Template In Ấn & Báo Cáo (`receipt_template.js`, `printer_bridge.hpp`, Phiếu lương, Báo cáo ca)** | ~65 nhãn mẫu in & báo cáo | **0 nhãn** | **0.0%** | Toàn bộ nhãn trên hóa đơn nhiệt K80/K58 (`HÓA ĐƠN THANH TOÁN`, `TỔNG CỘNG`, `Tiền khách đưa`...) và xung in ESC/POS đang gắn cứng tiếng Việt / `stripVn()` mất chữ CJK. |
| **6. Stylesheet CSS (`8` file CSS)** | Font-stack, cột bảng `nowrap`, nút hẹp | Chưa tối ưu CJK / từ dài | **Một phần** | Thiếu font-stack Offline cho chữ Trung/Nhật/Hàn/Thái; nhiều cột bảng & nút bị tràn khi dịch sang tiếng Anh/Pháp dài hơn tiếng Việt. |

---

### 2.2. Phân tích chi tiết từng tầng & Đề xuất giải pháp (`I18N-09` .. `I18N-14`)

#### 🔴 Hạng mục `I18N-09` (P0): Nâng cấp I18N Studio — Bổ sung đầy đủ cột "Tên Trường / Cột / Thành phần UI / Màn hình / Vị trí DOM-DB" & Lưu trữ trực tiếp tại C++ Backend
- **Nguyên nhân người dùng thấy chưa đầy đủ:**
  - Trong `docs/16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html` (`L106-112`), bảng chỉ hiển thị cột `Nhóm / Key` với các mã tự sinh như `05_slave_web_admin` / `slave_admin.k018`. Người quản trị không thể biết câu đó là **Tên cột bảng (`<th>`)**, **Nhãn ô nhập (`<label>`)**, **Placeholder**, **Nút bấm (`<button>`)**, **Thông báo API**, hay **Cột dữ liệu trong Database**, nằm ở màn hình nào và bảng nào.
  - Ngoài ra, công cụ đang chạy như một trang tĩnh trong `docs/` lưu vào `localStorage.getItem('cbnx_i18n_studio_v1')`, chưa được phục vụ và lưu trữ tập trung bởi C++ Backend của quán / SuperAdmin.
- **Đề xuất triển khai (`I18N-09`):**
  1. **Mở rộng cấu trúc bảng hiển thị trong I18N Studio gồm các cột tường minh & Hỗ trợ Sửa Ngôn Ngữ Gốc + Dịch Tự Động Hàng Loạt Từng Nhóm / Toàn Bộ:**
     - **Chỉnh sửa trực tiếp Ngôn ngữ Gốc (`updateSourceText` + `restoreOrigin`):** Cho phép sửa trực tiếp câu ở cột Ngôn ngữ gốc/nguồn (ví dụ sửa câu Tiếng Việt gốc bị sai chính tả hoặc đổi thuật ngữ), tự động đánh dấu badge `✎ Đã sửa câu gốc`, hỗ trợ nút `↺ Khôi phục gốc ban đầu` và tự động đưa câu vừa sửa gốc vào danh sách ưu tiên khi chạy AI dịch lại sang ngôn ngữ đích.
     - **AI Dịch Tự Động Hàng Loạt theo Từng Nhóm (`✨ AI Dịch Nhóm Đang Chọn`) hoặc Toàn Bộ Danh Mục (`🚀 AI Dịch Toàn Bộ Danh Mục`):** Hỗ trợ 3 chế độ (`Chỉ câu chưa dịch + câu vừa sửa gốc`, `Chỉ câu đang trống`, `Dịch đè lại toàn bộ 100% theo ngôn ngữ gốc`), tự động chia lô 20 câu/lượt kèm thanh tiến trình `%` thời gian thực và nút `⏹ Dừng Dịch` an toàn.
     - **Cột 1 — `Phân Hệ / Màn Hình (Screen & Layer)`:** Badge phân biệt rõ `Backend C++`, `POS Thu Ngân`, `Admin Quản Trị`, `Menu QR Khách`, `Bếp KDS`, `Phục Vụ`, `Chấm Công Kiosk`, `Cổng Wi-Fi`, `Master SuperAdmin`, `Mẫu In Hóa Đơn`, `Database Menu/Danh Mục`, `Stylesheet CSS`.
     - **Cột 2 — `Loại Thành Phần & Tên Trường / Cột (Component & Field/Column Name)`:**
       - Loại thành phần có icon & màu riêng: `📊 Cột bảng (<th>)`, `🏷️ Nhãn trường (<label>)`, `⌨️ Gợi ý ô nhập (Placeholder)`, `🔘 Nút bấm (<button>)`, `📑 Tab / Menu`, `🪟 Tiêu đề Modal / Khối`, `📋 Tùy chọn (<option>)`, `⚡ Thông báo API Backend`, `🧾 Nhãn Mẫu In Hóa Đơn`, `🗄️ Bản ghi Database`.
       - Ghi rõ tên trường/cột cụ thể, ví dụ: `Bảng Nhật Ký Chấm Công -> Cột #5: "Nguồn / Thiết bị"` hoặc `Form Máy Chấm Công Hikvision -> Trường #2: "Địa chỉ IP" (#hik-dev-ip)` hoặc `DB: products.name (ID=2: Bánh Mì Chảo Đặc Biệt)`.
       - Hiển thị giới hạn độ dài khuyến nghị (`max_chars`) để cảnh báo nếu bản dịch quá dài làm vỡ cột bảng hoặc tràn khổ giấy in nhiệt 58mm/80mm.
     - **Cột 3 — `Mã Khóa (i18n Key) / File Nguồn`**
     - **Cột 4 — `Ngôn Ngữ Nguồn (thanh xổ chọn vi / en / ...)`**
     - **Cột 5 — `Bản Dịch Đích (thanh xổ chọn en / zh / ja / ko / th / fr...)` + Cảnh báo `{placeholder}` & Độ dài**
     - **Cột 6 — `Duyệt / Chờ / Hủy & AI Dịch`**
  2. **Thêm thanh xổ lọc nhanh theo:** `Tầng hệ thống (Backend / Frontend / Database / Template / CSS)`, `Màn hình`, `Loại thành phần (Chỉ xem Cột bảng / Chỉ xem Nhãn trường Form / Chỉ xem Nút / Chỉ xem Món ăn DB / Chỉ xem Mẫu in bill)` và `Trạng thái (Đã duyệt / Chờ duyệt / Đã hủy / Chưa dịch / Lỗi biến)`.

---

#### 🔴 Hạng mục `I18N-10` (P0): Bóc tách & Gắn `data-i18n` cho toàn bộ 1.994 Trường, Cột bảng (`<th>`), Nhãn (`<label>`), Nút bấm (`<button>`), `<option>` và `placeholder` trên 13 trang HTML Frontend
- **Phân tích chi tiết số lượng phần tử chưa gắn `data-i18n` trên từng trang HTML:**
  - `slave/web/admin.html`: **184 cột bảng `<th>`** (bảng Hóa đơn, Thực đơn, Kho, Nhà cung cấp, Nhân viên, Chấm công, Bảng lương, Khuyến mãi, Quảng cáo, Jukebox, Hikvision, Kiểm toán...), **243 nhãn trường `<label>`**, **280 nút `<button>`**, **162 `<option>`**, **64 tiêu đề**, **106 `placeholder`** (Tổng **1.039 phần tử**, hiện `0` `data-i18n`).
  - `master/web/super_admin.html`: **59 cột bảng `<th>`**, **90 `<label>`**, **114 `<button>`**, **82 `<option>`**, **41 tiêu đề**, **44 `placeholder`** (Tổng **430 phần tử**, hiện `0` `data-i18n`).
  - `slave/web/customer.html`: **165 phần tử** (mới gắn 24, còn thiếu 141 phần tử trong modal giỏ hàng, lịch sử đơn, đánh giá sao, chọn bàn).
  - `slave/web/index.html` (POS): **56 phần tử** (hiện `0` `data-i18n`, đang phụ thuộc mảng tìm-thay-thế chuỗi tĩnh `DOM_TEXT_PAIRS`).
  - `slave/web/order.html` (Phục vụ): **41 phần tử** (hiện `0` `data-i18n`).
  - `slave/web/attendance.html` (Cổng chấm công Web/Kiosk): **5 cột bảng `<th>`**, **1 `<label>`**, **19 `<button>`**, **3 `<option>`**, **3 tiêu đề**, **4 `placeholder`** (Tổng **35 phần tử**, hiện `0` `data-i18n` và chưa nhúng `i18n.js`).
  - `slave/web/login.html` (**32 phần tử**), `slave/web/kitchen.html` (**26 phần tử**), `master/web/theme_studio.html` (**27 phần tử**), `slave/web/online_orders.html` (**16 phần tử**), `slave/web/wifi.html` (**15 phần tử**).
- **Đề xuất triển khai (`I18N-10`):**
  - Viết công cụ chuẩn hóa `scripts/extract_and_bind_html_i18n.py` quét toàn bộ 13 trang HTML và các hàm render bảng động trong JS (`render*`, `innerHTML`), tự động gắn `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` có quy ước đặt tên theo đúng `screen.component_type.field_name` (ví dụ: `admin.tbl_attendance.col_source`, `admin.form_hikvision.lbl_ip_address`, `pos.modal_payment.btn_split`), đồng thời xuất đầy đủ tên trường/cột vào kho dữ liệu của I18N Studio.
  - Nhúng `i18n.js` và bộ chọn ngôn ngữ vào `slave/web/attendance.html` và `master/web/theme_studio.html`.

---

#### 🟠 Hạng mục `I18N-11` (P1): Kết nối I18N Studio trực tiếp vào C++ Backend (`i18n_catalog` SQLite + API `/api/i18n/*`) & Chuẩn hóa 100% mã `code` thông báo C++ Đợt 5–6
- **Thực trạng:**
  - Khi sửa/duyệt câu ngôn ngữ trên `16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html`, dữ liệu chỉ nằm trên `localStorage` của máy đang mở; muốn áp dụng vào quán phải tải file JSON về rồi chép đè thủ công vào `slave/web/locales/` và chạy lại script băm `web_integrity.json`.
  - Khoảng 70+ thông báo C++ mới trong `slave_dot6_handlers.cpp`, `upload_guard.hpp`, `rate_limiter.hpp`, `hikvision_isapi.hpp` chưa có mã `code` i18n chuẩn.
- **Đề xuất triển khai (`I18N-11`):**
  - Tạo bảng SQLite `i18n_catalog` trên C++ Backend (Slave & Master) lưu `(key, layer, screen, component_type, field_label, dom_or_db_target, max_chars, origin_vi, translations_json, status, updated_by, updated_at)`.
  - Bổ sung các API C++ Backend:
    - `GET /api/i18n/catalog`: Trả toàn bộ danh mục câu ngôn ngữ + metadata trường/cột từ SQLite Backend.
    - `POST /api/i18n/save`: Lưu tạo mới/chỉnh sửa câu dịch hoặc trạng thái `Duyệt (approved) / Chờ (pending) / Hủy (rejected)` xuống SQLite Backend.
    - `POST /api/i18n/publish`: Khi Admin/SuperAdmin bấm **"Xuất Bản Ngôn Ngữ (Publish Live)"**, C++ Backend tự động biên dịch các câu đã `approved` ra `web/locales/<lang>.json` & `locales/<lang>.json`, đồng thời **tự động tính lại SHA-256 trong `web_integrity.json`** ngay trên Server để mọi thiết bị nhân viên/khách hàng trong quán nhận bản dịch mới tức thì mà không cần chép file thủ công!
  - Chuẩn hóa mã `code` + `params` cho toàn bộ thông báo C++ mới ở Đợt 5–6.

---

#### 🟠 Hạng mục `I18N-12` (P1): Đa ngôn ngữ tầng Database (`categories`, `products`, `tables_areas`, `promotions`, `store_settings`, `18 modules`)
- **Thực trạng:**
  - Các bảng `categories` (14 nhóm món), `products` (42 món ăn: `name`, `unit`, `description`), `tables_areas` (13 bàn/khu vực: `name`), `promotions` (`name`), `store_settings` (`print_header_note`, `print_footer_note`, `shift1_name`, `shift2_name`) hoàn toàn chưa có cột lưu bản dịch đa ngôn ngữ.
  - Khách nước ngoài chuyển sang tiếng Anh (`EN`) hoặc tiếng Trung (`ZH`) trên `customer.html` vẫn thấy tên món `"Bánh Mì Chảo Đặc Biệt"`, đơn vị `"chảo"`, nhóm `"Bánh Mì & Món Nóng"`.
- **Đề xuất triển khai (`I18N-12`):**
  - Thêm cột `i18n_json TEXT DEFAULT '{}'` vào các bảng `categories`, `products`, `tables_areas`, `promotions` (ví dụ: `{"en":{"name":"Special Pan Banh Mi","unit":"pan","description":"..."},"zh":{"name":"特色铁板法包","unit":"份"}}`) và nạp toàn bộ các bản ghi này vào I18N Studio dưới phân hệ **`Database (Thực đơn / Nhóm món / Bàn / Ca)`** với tên cột tường minh (`products.name`, `products.unit`, `categories.name`, `tables_areas.name`).
  - Hỗ trợ bấm **✨ AI Dịch Hàng Loạt** ngay trên I18N Studio để dịch tự động 14 nhóm món + 42 món ăn + đơn vị tính + 13 tên bàn sang Anh/Trung/Nhật/Hàn, bấm **Duyệt** để ghi thẳng vào SQLite Backend; khi API `/api/products`, `/api/categories`, `/api/tables` trả về sẽ kèm `i18n_json` để `customer.html`, `index.html`, `order.html`, `kitchen.html` và hóa đơn hiển thị đúng ngôn ngữ khách/nhân viên đang chọn.

---

#### 🟠 Hạng mục `I18N-13` (P1): Đa ngôn ngữ & Song ngữ cho Template In Hóa Đơn Nhiệt (`receipt_template.js`, `printer_bridge.hpp`), Phiếu Lương & Báo Cáo Kết Ca
- **Thực trạng:**
  - `slave/web/assets/js/receipt_template.js` và `slave/src/printer_bridge.hpp` đang fix cứng toàn bộ nhãn tiếng Việt (`"HÓA ĐƠN THANH TOÁN"`, `"PHIẾU TẠM TÍNH"`, `"BẢN IN LẠI"`, `"Bàn:"`, `"Thu ngân:"`, `"Tạm tính"`, `"Giảm giá"`, `"TỔNG CỘNG"`, `"Tiền khách đưa"`, `"Tiền thối lại"`).
  - Hàm `PrinterBridge::buildReceiptEscPos` trong `printer_bridge.hpp:29-55` dùng `stripVn()` ép mọi ký tự ngoài ASCII về không dấu, khiến khi in tiếng Trung (`zh`), Nhật (`ja`), Hàn (`ko`), Thái (`th`) qua cổng Raw TCP 9100 sẽ bị mất chữ.
- **Đề xuất triển khai (`I18N-13`):**
  - Đưa toàn bộ nhãn mẫu in hóa đơn, phiếu tạm tính, biên bản kết ca và phiếu lương vào danh mục `Template In Ấn` trong I18N Studio.
  - Trong **Setup Form In Hóa Đơn (`Receipt Template Studio`)**, bổ sung tùy chọn **`Ngôn ngữ in hóa đơn`**:
    - `Theo ngôn ngữ giao diện hiện tại`
    - `Song ngữ Việt - Anh (Bilingual VI / EN)` (ví dụ: `TỔNG CỘNG / TOTAL`, `Tiền mặt / Cash` — rất thực tế cho nhà hàng/quán cafe phục vụ khách nước ngoài)
    - `Song ngữ Việt - Trung / Nhật / Hàn`
  - Bổ sung chế độ xuất ảnh Raster ESC/POS (`GS v 0`) từ Canvas hoặc UTF-8 codepage cho máy in nhiệt LAN/Windows để in sắc nét mọi ngôn ngữ tượng hình (Trung/Nhật/Hàn/Thái) lẫn tiếng Việt có dấu.

---

#### 🟡 Hạng mục `I18N-14` (P2): Chuẩn hóa Stylesheet CSS Đa ngôn ngữ, Offline Font Stack CJK & Chống vỡ khung Cột bảng / Nút bấm khi dịch
- **Thực trạng:**
  - Khi chuyển ngôn ngữ sang tiếng Anh/Pháp (chuỗi dài hơn tiếng Việt 30–60%) hoặc chữ Trung/Nhật/Hàn, một số cột bảng `<th>`, tab menu và nút thao tác dùng `white-space: nowrap` hoặc chiều rộng cố định bị tràn chữ.
  - Header CSP trong `main_slave.cpp:207` vẫn còn liệt kê `https://fonts.googleapis.com https://cdnjs.cloudflare.com https://img.vietqr.io`.
- **Đề xuất triển khai (`I18N-14`):**
  - Cập nhật `theme.css`, `liquid-glass.css`, `admin.css`, `customer.css`:
    - Khai báo `--cn-font-i18n` tích hợp sẵn các font hệ thống Offline cho cả Latinh, Tiếng Việt và CJK/Thái (`"Segoe UI", system-ui, -apple-system, "Microsoft YaHei", "PingFang SC", "Meiryo", "Malgun Gothic", "Leelawadee UI", sans-serif`).
    - Thêm quy tắc CSS thích ứng theo `html[lang]` cho các cột bảng (`th`, `td`), badge và nút bấm để tự co giãn hợp lý không vỡ dòng trên mọi ngôn ngữ.
    - Khép kín `Content-Security-Policy` về `'self' data: blob:` (sau khi thay `img.vietqr.io` bằng bộ vẽ VietQR EMVCo Offline ở `ARCH-05`) để đảm bảo vận hành Offline 100% không rò rỉ kết nối ra ngoài.

---

## PHẦN 3. BẢNG TỔNG HỢP 9 HẠNG MỤC ĐỀ XUẤT MỚI NẠP VÀO BẢNG THEO DÕI (`docs/13_BANG_THEO_DOI_KHUYET_TAT.html`)

| Mã | Nhóm | Ưu tiên | Tiêu đề hạng mục | Trạng thái nạp |
| :---: | :---: | :---: | :--- | :---: |
| **`ARCH-04`** | Kiến trúc & Dọn dẹp | **P0** | Khóa cứng kiểm soát License Offline/Online từ SuperAdmin (Chặn `suspended`/`expired`, ký ECDSA `subscription_status`/`blocked_modules`, chống vặn ngược đồng hồ Windows & `requireModule` Đợt 6) | `todo` (Chờ **Duyệt / Chờ / Hủy**) |
| **`ARCH-05`** | Kiến trúc & Dọn dẹp | **P0** | Chạy Offline 100% không phụ thuộc Internet: Tự sinh mã EMVCo VietQR CRC16 tại C++ Backend (bỏ `img.vietqr.io`) & Xóa cấu hình/API key khỏi `localStorage` máy trạm | `todo` (Chờ **Duyệt / Chờ / Hủy**) |
| **`ARCH-06`** | Kiến trúc & Dọn dẹp | **P1** | Chuẩn hóa 34 file JS thành Thin-Client Adapter thuần túy (`preview_quote` tính tiền/thuế/voucher tại C++ Backend, bỏ đọc `role` từ `localStorage.pos_user`, cảnh báo sửa file JS về Master) | `todo` (Chờ **Duyệt / Chờ / Hủy**) |
| **`I18N-09`** | Đa ngôn ngữ (i18n) | **P0** | Nâng cấp I18N Studio: Bổ sung đầy đủ cột "Phân hệ / Màn hình", "Loại thành phần UI (`<th>`/`<label>`/Button/API/DB/Bill)" & "Tên Trường / Cột / Selector + Giới hạn ký tự" | `todo` (Chờ **Duyệt / Chờ / Hủy**) |
| **`I18N-10`** | Đa ngôn ngữ (i18n) | **P0** | Bóc tách & gắn `data-i18n` cho toàn bộ 1.994 phần tử UI tĩnh (184+59 cột bảng `<th>`, 333 nhãn trường `<label>`, nút bấm, `<option>`, `placeholder`) trên 13 trang HTML | `todo` (Chờ **Duyệt / Chờ / Hủy**) |
| **`I18N-11`** | Đa ngôn ngữ (i18n) | **P1** | Tích hợp I18N Studio vào C++ Backend (`i18n_catalog` SQLite + API `/api/i18n/catalog|save|publish` tự xuất `/locales/*.json` & cập nhật `web_integrity.json`) + Chuẩn hóa `code` C++ Đợt 5–6 | `todo` (Chờ **Duyệt / Chờ / Hủy**) |
| **`I18N-12`** | Đa ngôn ngữ (i18n) | **P1** | Đa ngôn ngữ tầng Database (`i18n_json` cho 14 nhóm món `categories`, 42 món ăn `products`, 13 bàn `tables_areas`, `promotions`, `store_settings`, 18 module) & AI dịch danh mục | `todo` (Chờ **Duyệt / Chờ / Hủy**) |
| **`I18N-13`** | Đa ngôn ngữ (i18n) | **P1** | Đa ngôn ngữ & Chế độ Song ngữ (Việt-Anh / Việt-Trung...) cho Mẫu In Hóa Đơn Nhiệt (`receipt_template.js`, `printer_bridge.hpp`), Phiếu Lương & Báo Cáo Ca | `todo` (Chờ **Duyệt / Chờ / Hủy**) |
| **`I18N-14`** | Đa ngôn ngữ (i18n) | **P2** | Chuẩn hóa Stylesheet CSS Đa ngôn ngữ (Offline Font Stack CJK/Thái, co giãn cột bảng `<th>` & nút bấm theo độ dài ngôn ngữ, khép kín CSP `'self'`) | `todo` (Chờ **Duyệt / Chờ / Hủy**) |
