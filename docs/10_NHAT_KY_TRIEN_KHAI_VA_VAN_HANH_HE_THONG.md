# 📓 NHẬT KÝ TRIỂN KHAI & QUY TRÌNH VẬN HÀNH THÔNG MINH — HỆ THỐNG CYBERNEXUS OS

> **Dự án:** CyberNexus OS — Hệ Điều Hành Quản Trị Điểm Bán, Giải Trí Đa Phương Tiện & Kiểm Toán Nội Bộ (Enterprise F&B POS)  
> **Mã hồ sơ:** `DOC-10-DEPLOYMENT-AND-AUDIT-LOG`  
> **Cập nhật lần cuối:** 12/11/2026 09:40 (GMT+7)  
> **Trạng thái tài liệu:** ✅ **HOÀN THÀNH & NGHIỆM THU TOÀN DIỆN (LIVE LOG)**  
> **Tài liệu liên kết:**
> - [`01_TONG_QUAN_KIEN_TRUC_HE_THONG.md`](01_TONG_QUAN_KIEN_TRUC_HE_THONG.md)
> - [`06_BAO_CAO_TIEN_DO_TRIEN_KHAI_LAN_1.md`](06_BAO_CAO_TIEN_DO_TRIEN_KHAI_LAN_1.md)
> - [`08_BAO_CAO_TIEN_DO_TRIEN_KHAI_LAN_2.md`](08_BAO_CAO_TIEN_DO_TRIEN_KHAI_LAN_2.md)
> - [`09_QUY_TRINH_DONG_GOI_BAN_GIAO_VA_VAN_HANH_KHACH_HANG.md`](09_QUY_TRINH_DONG_GOI_BAN_GIAO_VA_VAN_HANH_KHACH_HANG.md)

---

## 📌 MỤC LỤC
1. [Tổng hợp toàn bộ lịch sử triển khai (Từ Giai đoạn 1 đến Hiện tại)](#1-tổng-hợp-toàn-bộ-lịch-sử-triển-khai-từ-giai-đoạn-1-đến-hiện-tại)
2. [Chi tiết Đợt 3 (11/11 – 12/11/2026): Bảo mật Zero-Trust, Phân quyền RBAC & Chuẩn hóa UTF-8](#2-chi-tiết-đợt-3-1111--12112026-bảo-mật-zero-trust-phân-quyền-rbac--chuẩn-hóa-utf-8)
3. [Ma trận Phân quyền & Luồng Điều hướng Chuẩn giữa các Bộ phận](#3-ma-trận-phân-quyền--luồng-điều-hướng-chuẩn-giữa-các-bộ-phận)
4. [Thiết kế Quy trình Vận hành Thông minh, Kế toán Ca & Kiểm toán Nội bộ (Audit)](#4-thiết-kế-quy-trình-vận-hành-thông-minh-kế-toán-ca--kiểm-toán-nội-bộ-audit)
5. [Bảng theo dõi Tiến độ Triển khai tiếp theo (Live Roadmap Checklist)](#5-bảng-theo-dõi-tiến-độ-triển-khai-tiếp-theo-live-roadmap-checklist)

---

## 1. TỔNG HỢP TOÀN BỘ LỊCH SỬ TRIỂN KHAI (TỪ GIAI ĐOẠN 1 ĐẾN HIỆN TẠI)

| Giai đoạn | Thời gian | Hạng mục Trọng tâm | Trạng thái | Tập tin / Phân hệ chính |
| :--- | :---: | :--- | :---: | :--- |
| **Giai đoạn 1** | 09/11 – 10/11/2026 | • Kiến trúc Microkernel C++17 (`Master` Port 8500 & `Slave` Port 8501).<br>• Hệ thống cấp phép bản quyền RSA-4096 Offline/Online (`LicenseService`).<br>• CSDL SQLite WAL Mode hiệu năng cao, độc lập 100% Offline.<br>• Hệ thống Dynamic DLL Plugin (`mod_pos_core`, `mod_network_qos`, `mod_ai_upsell`). | ✅ Hoàn thành | `master/`, `slave/`, `shared/`, `plugins/` |
| **Giai đoạn 2** | 10/11 – 11/11/2026 | • Hoàn thiện cổng SuperAdmin (`super_admin.html`): Gỡ khóa phần cứng (`reset_machine`) & Cấp lại License (`regenerate_key`).<br>• Phân hệ Giải trí Đa phương tiện (`mod_media_stream.dll`): Kho nhạc Offline, Smart Jukebox tại bàn (`customer.html`), 10-Band DSP Equalizer Studio (`admin.html`).<br>• Cross-Module Event Bus (`ORDER_PAID` $\ge 200.000\text{đ} \rightarrow$ VIP Priority Queue + Auto Audio Ducking).<br>• Chữ ký số `.sig` chống sao chép lậu DLL & Đóng gói bản phát hành `GP001`. | ✅ Hoàn thành | `plugins/mod_media_stream/`, `master/packages/GP001/` |
| **Giai đoạn 2.5** | 11/11/2026 | • Tái cấu trúc giao diện Responsive & Liquid Glass cho `customer.html`, `admin.html` (Tab Âm nhạc & Jukebox).<br>• Tích hợp **Mini-Player Jukebox & Trình quản lý Nhạc/EQ nổi** ngay trên màn hình Thu ngân (`index.html`).<br>• Đồng bộ toàn bộ mã nguồn lên GitHub (`cybernexus-os`). | ✅ Hoàn thành | `slave/web/index.html`, `slave/web/customer.html`, `slave/web/admin.html` |
| **Giai đoạn 3** | 12/11/2026 | • **Bảo mật Phiên đăng nhập Zero-Trust**: Chặn tuyệt đối truy cập không đăng nhập trên mọi URL (`/`, `/index.html`, `/admin.html`, `/kitchen.html`, `/order.html`, `/online_orders.html`, `/customer.html`).<br>• **Reset phiên khi khởi động**: `RUN_SLAVE.bat` tự động đóng tiến trình cũ, xóa sạch RAM sessions và chuyển Cookie thành Session Cookie.<br>• **Định tuyến PIN chính xác**: `9999` $\rightarrow$ `admin.html`, `1111` $\rightarrow$ `index.html`, `2222`/`3333` $\rightarrow$ `order.html`, `4444` $\rightarrow$ `kitchen.html`.<br>• **Huy hiệu Admin thông minh**: Tự động kiểm tra phiên và gắn huy hiệu `👑 Quản Trị Viên [ADMIN]` kế nút `Thoát` trên mọi trang chỉ khi đăng nhập bằng tài khoản `admin`.<br>• **Khóa phân quyền RBAC 2 lớp** cho 4 bộ phận + Sửa lỗi UTF-8 Mojibake & bổ sung API Đơn Online. | ✅ Hoàn thành | `shared/src/auth.cpp`, `slave/src/main_slave.cpp`, `slave/src/slave_handlers.cpp`, `slave/web/*.html` |

---

## 2. CHI TIẾT ĐỢT 3 (11/11 – 12/11/2026): BẢO MẬT ZERO-TRUST, PHÂN QUYỀN RBAC & CHUẨN HÓA UTF-8

### 2.1. Nhật ký xử lý sự cố & Nâng cấp Bảo mật Phiên (Session Security)

#### 🔹 Vấn đề 1: Chạy `RUN_SLAVE.bat` và gõ `localhost:8501` hoặc `localhost:8501/index.html` vào thẳng trang POS không qua đăng nhập
- **Nguyên nhân gốc rễ:**
  1. Tiến trình `cybernexus_slave.exe` cũ vẫn chạy ngầm giữ các phiên trong RAM (`m_sessions`).
  2. Cookie `pos_token` có `maxAgeSecs = 30 ngày`, trình duyệt tự động gửi lại kèm HTML cũ lưu trong Disk Cache.
  3. Trang `/customer.html` trước đó mở tự do không qua kiểm tra phiên.
- **Giải pháp đã triển khai:**
  - Cập nhật `slave/RUN_SLAVE.bat` và `release/RUN_SLAVE.bat`: Thực thi `taskkill /F /IM cybernexus_slave.exe >nul 2>&1` trước khi khởi chạy máy chủ mới.
  - Cập nhật `shared/include/auth.hpp` & `shared/src/auth.cpp`: Bổ sung `AuthService::clearAllSessions()`, đổi mặc định `maxAgeSecs = 0` (Session Cookie — tự hủy khi đóng trình duyệt).
  - Cập nhật `slave/src/main_slave.cpp`:
    - Xóa toàn bộ phiên và reset `UPDATE users SET is_online = 0` ngay khi khởi động.
    - Bổ sung HTTP Header chống bộ nhớ đệm (`Cache-Control: no-store, no-cache, must-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`) trên tất cả các view.
    - Khi chưa đăng nhập, mọi truy cập đều trả về `HTTP 302 Location: /login.html`, xóa sạch Cookie (`pos_token`, `PHPSESSID`, `pos_remember`) và `localStorage`.

#### 🔹 Vấn đề 2: Đăng nhập mã PIN `9999` (Chủ quán) nhưng lại nhảy vào `index.html` (Thu ngân)
- **Nguyên nhân gốc rễ:** Khi truy cập `/index.html` lúc chưa đăng nhập, hệ thống chuyển hướng sang `/login.html?redirect=index.html`. Hàm `getRedirectTarget(user)` trong `login.html` ưu tiên tham số `?redirect=index.html` hơn vai trò thực tế của tài khoản.
- **Giải pháp đã triển khai:**
  - Sửa hàm `getRedirectTarget(user)` trong `slave/web/login.html`: Luôn định tuyến theo đúng vai trò (`role`) của người dùng vừa đăng nhập:
    - `admin` (`9999`) $\rightarrow$ `admin.html`
    - `cashier` (`1111`) $\rightarrow$ `index.html`
    - `waiter` (`2222`, `3333`) $\rightarrow$ `order.html`
    - `kitchen` (`4444`) $\rightarrow$ `kitchen.html`
    - `customer` (`0000`) $\rightarrow$ `customer.html`

#### 🔹 Vấn đề 3: Huy hiệu điều hướng nhanh về Quản trị dành riêng cho Admin
- **Yêu cầu:** Tất cả các trang khi load đều kiểm tra user trong phiên login; nếu là `admin` thì gắn huy hiệu `👑 Quản Trị Viên [ADMIN]` kế bên nút `Thoát` (`Logout`) để quay về `admin.html` ngay lập tức mà không lộ nút Quản trị cho nhân viên thường.
- **Giải pháp đã triển khai:**
  - Đồng bộ trên cả 5 trang (`index.html`, `kitchen.html`, `order.html`, `online_orders.html`, `customer.html`): Kiểm tra `u.role === 'admin' || u.is_super_admin === true`.
  - Khi đúng là Admin, thẻ huy hiệu biến thành liên kết `<a href="admin.html" title="Quay về Bảng Điều Khiển Quản Trị Hệ Thống">` với hiệu ứng viền vàng Hoàng gia. Nhân viên các bộ phận khác hoàn toàn không thấy liên kết này.

#### 🔹 Vấn đề 4: Khóa phân quyền điều hướng giữa các bộ phận & Sửa lỗi trang "Đơn Online"
- **Nguyên nhân gốc rễ:**
  1. `main_slave.cpp` trước đó cấu hình `serveProtectedView("index", "any")`, cho phép cả `waiter` và `kitchen` gõ `/index.html` để vào trang Thu ngân.
  2. Trang `online_orders.html` gọi `GET api/orders.php?action=online_orders&status=active`, nhưng action `online_orders` chưa được định nghĩa trong `ApiHandlers::handleOrders` (`slave_handlers.cpp`), dẫn đến rơi vào nhánh báo lỗi mặc định bị lỗi mã hóa kép UTF-8 (`"YÃªu cáº§u hÃ³a Ä‘Æ¡n khÃ´ng há»£p lá»‡!"`).
- **Giải pháp đã triển khai:**
  1. **Chuẩn hóa 100% chuỗi UTF-8 trong C++ Backend**: Quét và khôi phục toàn bộ 1.048 chuỗi tiếng Việt bị lỗi double-encoding trong `slave/src/slave_handlers.cpp`, `master/src/master_handlers.cpp`, `shared/src/PluginManager.cpp`.
  2. **Bổ sung API Đơn Online trong `slave/src/slave_handlers.cpp`**:
     - `GET api/orders.php?action=online_orders`: Truy vấn danh sách đơn mang về/online (`active` hoặc `today`) kèm tóm tắt món (`items_summary`) và số điện thoại khách.
     - `POST api/orders.php` (`action = "online_order_delivered"`): Xác nhận bàn giao đơn, cập nhật `kitchen_status = 'served'`, `served_at` và ghi log kiểm toán vào bảng `kitchen_service_logs`.
  3. **Gỡ bỏ các nút điều hướng thừa trên giao diện**:
     - Trang `online_orders.html`: Gỡ bỏ nút `Quản Trị` và nút `Thu Ngân`.
     - Trang `kitchen.html`: Gỡ bỏ nút `Phục Vụ` (`order.html`) và nút QR, chỉ giữ thuần túy chức năng Bếp / Pha chế.
     - Trang `order.html`: Gỡ bỏ nút `Bếp` (`kitchen.html`) và `Đơn Online` (`online_orders.html`), chỉ giữ thuần túy chức năng Order phục vụ.

---

## 3. MA TRẬN PHÂN QUYỀN & LUỒNG ĐIỀU HƯỚNG CHUẨN GIỮA CÁC BỘ PHẬN

Hệ thống áp dụng cơ chế bảo vệ **2 lớp đồng thời** (Server-side C++ HTTP 302 Redirect trong `main_slave.cpp` + Client-side `<head>` Auth-Cloak Redirect):

| Bộ phận | Vai trò (`role`) | Mã PIN | Trang chủ mặc định | `admin.html` (Quản trị) | `index.html` (Thu ngân POS) | `online_orders.html` (Đơn Online) | `kitchen.html` (Bếp / Bar) | `order.html` (Phục vụ) | `customer.html` (Menu QR) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Chủ quán / Quản trị** | `admin` | `9999` | `admin.html` | ✅ Toàn quyền | ✅ Toàn quyền (+ Huy hiệu `ADMIN`) | ✅ Toàn quyền (+ Huy hiệu `ADMIN`) | ✅ Toàn quyền (+ Huy hiệu `ADMIN`) | ✅ Toàn quyền (+ Huy hiệu `ADMIN`) | ✅ Toàn quyền (+ Huy hiệu `ADMIN`) |
| **2. Thu ngân** | `cashier` | `1111` | `index.html` | ⛔ Chặn ($\rightarrow$ `index.html`) | ✅ Trang chính (POS, Jukebox, Lịch sử, Thống kê) | ✅ Được phép | ✅ Được phép | ✅ Được phép | ✅ Được phép |
| **3. Tổ Bếp & Pha chế** | `kitchen` | `4444` | `kitchen.html` | ⛔ Chặn ($\rightarrow$ `kitchen.html`) | ⛔ Chặn ($\rightarrow$ `kitchen.html`) | ⛔ Chặn ($\rightarrow$ `kitchen.html`) | ✅ Trang duy nhất | ⛔ Chặn ($\rightarrow$ `kitchen.html`) | ✅ Được phép |
| **4. Phục vụ chạy bàn** | `waiter` | `2222`, `3333` | `order.html` | ⛔ Chặn ($\rightarrow$ `order.html`) | ⛔ Chặn ($\rightarrow$ `order.html`) | ⛔ Chặn ($\rightarrow$ `order.html`) | ⛔ Chặn ($\rightarrow$ `order.html`) | ✅ Trang duy nhất | ✅ Được phép |

---

## 4. THIẾT KẾ QUY TRÌNH VẬN HÀNH THÔNG MINH, KẾ TOÁN CA & KIỂM TOÁN NỘI BỘ (AUDIT)

### 4.1. Sơ đồ Luồng Vận hành & Đối soát Chống thất thoát Khép kín

```mermaid
flowchart TD
    subgraph FOH["TUYẾN PHỤC VỤ & BẾP (THỜI GIAN THỰC)"]
        P1["Phục vụ (order.html): Chọn bàn & Gọi món"]
        P2["Bếp/Bar (kitchen.html): Nhận đơn -> Làm món -> Báo Xong"]
        P3["Bếp gạt nút 'Hết món (86)' -> Tự động khóa món trên mọi màn hình"]
        P4["Phục vụ nhận cảnh báo món xong -> Bưng ra bàn"]
    end

    subgraph CASH["TUYẾN THU NGÂN & KẾ TOÁN CA (SHIFT ACCOUNTING)"]
        T1["Mở Ca: Nhập tiền mặt đầu ca (Tiền lẻ)"]
        T2["Trong Ca: Thu tiền (Tiền mặt / QR) + Lập Phiếu Thu/Chi nhanh"]
        T3["Kết Ca Mù (Blind Handover): Nhập tiền mặt thực đếm trong két"]
        T4["Hệ thống tự động tính Chênh lệch = Thực đếm - Lý thuyết"]
    end

    subgraph AUDIT["TUYẾN KIỂM TOÁN NỘI BỘ TỰ ĐỘNG (ANTI-FRAUD AUDIT)"]
        A1["Chốt chặn 1: Hủy HĐ / Giảm giá / Xóa món đã làm -> Bắt buộc nhập Lý do"]
        A2["Chốt chặn 2: Theo dõi số lần In tạm tính & In lại hóa đơn"]
        A3["Chấm điểm Rủi ro (Risk Score) & Cảnh báo Đỏ trên trang Admin"]
    end

    P1 --> P2 --> P4 --> T2
    P3 -.-> P1 & T2
    T1 --> T2 --> T3 --> T4
    T2 -.-> A1 & A2 --> A3
```

### 4.2. Chi tiết 3 Phân hệ Nâng cấp Thông minh

#### A. Phân hệ Kiểm toán Nội bộ (`Audit Trail & Anti-Fraud`)
- **Bảng CSDL `audit_logs` (Bất biến - Append-only)**:
  - Lưu trữ: `id`, `created_at`, `user_id`, `user_fullname`, `user_role`, `action_code`, `severity` (`INFO`, `WARN`, `CRITICAL`), `order_id`, `table_name`, `amount_impact`, `reason`, `details_json`.
- **Các sự kiện tự động bắt lỗi & gắn cờ (`severity = CRITICAL / WARN`)**:
  1. `VOID_ORDER`: Hủy hóa đơn (Đặc biệt nghiêm trọng nếu bàn đã từng bấm *In tạm tính*).
  2. `REMOVE_COOKED_ITEM`: Xóa hoặc giảm số lượng món khi Bếp đã chuyển trạng thái sang *Đang làm* hoặc *Đã xong*.
  3. `MANUAL_DISCOUNT`: Áp dụng giảm giá thủ công.
  4. `REPRINT_RECEIPT`: In lại hóa đơn đã thanh toán hoặc in tạm tính nhiều lần.
  5. `SHIFT_DISCREPANCY`: Chênh lệch tiền mặt khi kết ca vượt ngưỡng cho phép.

#### B. Phân hệ Kế toán Ca & Sổ quỹ (`Shift Accounting & Cashflow`)
- **Bảng CSDL `pos_shifts` (Quản lý Ca làm việc)** & **`cash_transactions` (Phiếu Thu / Chi tại quầy)**:
  - Quản lý trọn vẹn vòng đời ca làm việc của Thu ngân: **Mở ca (Opening Cash)** $\rightarrow$ **Thu bán hàng (Cash / Transfer / Card)** $\rightarrow$ **Chi nội bộ trong ca (Mua đá, nguyên liệu phụ, ứng tiền...)** $\rightarrow$ **Kết ca đối soát (Closing Actual Cash vs Expected Cash)**.
- **Báo cáo Kế toán trong `admin.html`**:
  - Bảng đối soát lịch sử giao ca (Ca nào thừa/thiếu bao nhiêu tiền, ai trực ca).
  - Sổ quỹ Thu - Chi tiền mặt & Chuyển khoản.

#### C. Tự động hóa Phối hợp Bếp – Phục vụ – Thu ngân
- **Báo hết món tức thời (`86 / Out-of-Stock Toggle`) ngay tại Bếp (`kitchen.html`)**:
  - Nhân viên Bếp/Pha chế chỉ cần bấm 1 nút để đánh dấu món *Tạm hết* (hoặc *Còn hàng trở lại*) mà không cần nhờ Admin vào trang quản trị sửa menu.
  - Màn hình Phục vụ (`order.html`), Thu ngân (`index.html`) và Khách hàng (`customer.html`) tự động làm mờ và khóa nút gọi món đó ngay lập tức.
- **Thông báo Món đã xong trên sơ đồ bàn (`order.html` & `index.html`)**:
  - Hiển thị huy hiệu số món Bếp vừa hoàn tất ngay trên ô bàn để Phục vụ bưng ra ngay, không để đồ uống tan đá.

---

## 5. KẾT QUẢ TRIỂN KHAI & NGHIỆM THU PHÂN HỆ KẾ TOÁN CA, SỔ QUỸ & KIỂM TOÁN NỘI BỘ (12/11/2026)

- [x] **Bước 0 (12/11/2026 09:20):** Tổng hợp toàn bộ lịch sử hệ thống và khởi tạo hồ sơ Nhật ký triển khai [`docs/10_NHAT_KY_TRIEN_KHAI_VA_VAN_HANH_HE_THONG.md`](10_NHAT_KY_TRIEN_KHAI_VA_VAN_HANH_HE_THONG.md).
- [x] **Bước 1 (12/11/2026 09:31):** Thiết lập CSDL & C++ API cho **Kiểm toán Nội bộ (`audit_logs`)** và **Kế toán Ca / Sổ quỹ (`pos_shifts`, `cash_transactions`)** trong [`slave/src/main_slave.cpp`](../slave/src/main_slave.cpp) và [`slave/src/slave_handlers.cpp`](../slave/src/slave_handlers.cpp):
  - Tự động khởi tạo 3 bảng `audit_logs`, `pos_shifts`, `cash_transactions` ngay khi mở CSDL.
  - Bổ sung các API trong `ApiHandlers::handleFinance` (`shift_status`, `open_shift`, `add_cash_tx`, `close_shift`, `audit_and_shifts`) và `ApiHandlers::handleOrders` (`cancel_order` bắt buộc `reason`, `checkout` tự động ghi Audit khi giảm giá, `log_audit` ghi nhận In tạm tính & In lại hóa đơn).
- [x] **Bước 2 (12/11/2026 09:35):** Nâng cấp màn hình **Thu ngân ([`index.html`](../slave/web/index.html) & [`pos.js`](../slave/web/assets/js/pos.js))**:
  - Nâng cấp `POS.cancelOrder()` thành **Modal Xác Nhận Hủy Hóa Đơn (Audit)** bắt buộc chọn/nhập lý do giải trình trước khi hủy đơn.
  - Nâng cấp `POS.openDiscountModal()` & `POS.applyDiscount()` bắt buộc nhập **Lý do giảm giá / Chương trình KM** khi chiết khấu $>0$.
  - Tự động ghi log Kiểm toán khi Thu ngân bấm **In tạm tính (`PRINT_TEMP_BILL`)** hoặc **In lại hóa đơn (`REPRINT_RECEIPT`)**.
  - Bổ sung nút **`Giao Ca / Quỹ`** trên thanh Header của `index.html` cùng **Modal Quản Lý Ca & Sổ Quỹ Tiền Mặt** (Mở ca, Lập Phiếu Thu/Chi nhanh tự động đồng bộ sang Sổ chi phí Kế toán, Kết ca kiểm đếm tiền mặt thực tế & tính chênh lệch két).
- [x] **Bước 3 (12/11/2026 09:36):** Đồng bộ tức thời **"Báo hết món nhanh (86)"** từ màn hình **Bếp ([`kitchen.html`](../slave/web/kitchen.html))** sang toàn bộ các màn hình:
  - Ghi log Kiểm toán `LOCK_PRODUCT_86` / `UNLOCK_PRODUCT_86` trong `handleProducts`.
  - Bổ sung hàm `syncMenuLocks()` trong [`customer.js`](../slave/web/assets/js/customer.js) để tự động làm mờ và khóa nút chọn món trên màn hình QR Khách hàng ngay khi Bếp báo hết hàng (bên cạnh màn hình Phục vụ `order.html` và Thu ngân `index.html`).
- [x] **Bước 4 (12/11/2026 09:38):** Nâng cấp **Tab "Kế Toán Ca & Kiểm Toán (Audit)"** trong trang **Quản trị ([`admin.html`](../slave/web/admin.html) & [`admin.js`](../slave/web/assets/js/admin.js))**:
  - Bổ sung **4 Thẻ KPI Kiểm Toán Chống Thất Thoát**: Cảnh báo rủi ro cao (`CRITICAL`), Tổng hủy đơn (`VOID`), Tổng giảm giá thủ công, và Lệch két giao ca lũy kế.
  - Bổ sung **Bảng Nhật Ký Kiểm Toán Bất Biến (`audit_logs`)** theo dõi thời gian thực từng thao tác nhạy cảm kèm lý do giải trình và nhân viên thực hiện.
  - Bổ sung **Bảng Đối Soát Bàn Giao Ca & Két Tiền (`pos_shifts`)** đối chiếu Tiền đầu ca, Thu tiền mặt, Thu/Chi tại quầy, Tiền lý thuyết, Tiền thực đếm và Chênh lệch thừa/thiếu.
- [x] **Bước 5 (12/11/2026 09:40):** Biên dịch [`cybernexus_slave.exe`](../slave/cybernexus_slave.exe), đồng bộ đầy đủ sang `master/web/` và gói phát hành `GP001`, chạy kiểm thử tự động Playwright (`ALL SHIFT, CASHBOOK & AUDIT TESTS PASSED!`) và khởi động lại máy chủ ở trạng thái sạch.

---

## 6. KẾT QUẢ TRIỂN KHAI PHÂN HỆ ĐẠI LÝ PHÂN PHỐI & CẤP PHÉP BẢN QUYỀN (SUPERADMIN MASTER) (12/11/2026)

- [x] **Bước 1 (12/11/2026 10:05):** Khởi tạo cấu trúc CSDL và Schema Master trong [`master/src/main_master.cpp`](../master/src/main_master.cpp):
  - Bảng `saas_resellers`: Quản lý thông tin đối tác đại lý, cấp bậc phân hạng (Bronze 15%, Silver 25%, Gold 40%, Diamond 55%), mức chiết khấu thỏa thuận, số dư ví ký quỹ trả trước `wallet_balance`, trạng thái hoạt động.
  - Bảng `saas_reseller_wallet_logs`: Sổ cái tài chính bất biến ghi nhận mọi biến động nạp tiền ký quỹ (`deposit`) và trừ tiền khi cấp phép (`license_deduct`) kèm snapshot số dư trước/sau, mã license, tên quán và ghi chú.
  - Mở rộng bảng `saas_tenants`: Bổ sung 2 trường `reseller_id` (liên kết đại lý phụ trách) và `price_charged` (giá đại lý thực trả sau chiết khấu).
- [x] **Bước 2 (12/11/2026 10:15):** Xây dựng bộ API xử lý nghiệp vụ Kênh Đại lý trong [`master/src/master_handlers.cpp`](../master/src/master_handlers.cpp):
  - `get_resellers`: Trả về danh sách đại lý cùng subquery tính số lượng điểm quán đã cấp và tổng doanh thu thu được từ kênh đại lý.
  - `save_reseller`: Thêm mới hoặc cập nhật hồ sơ đại lý, phân hạng tier và phần trăm chiết khấu tự động, hỗ trợ cập nhật linh hoạt theo mã đại lý `DL-XXX`.
  - `deposit_reseller_wallet`: Nạp tiền vào ví ký quỹ đại lý (bằng chuyển khoản VietQR, tiền mặt hoặc bảo lãnh hợp đồng), tự động cộng số dư và ghi nhật ký sổ cái ví `saas_reseller_wallet_logs`.
  - `get_reseller_wallet_logs`: Tra cứu toàn bộ lịch sử biến động số dư theo từng đại lý hoặc toàn hệ thống.
  - `reseller_issue_license`: Nghiệp vụ cấp bản quyền cho điểm bán mới thông qua đại lý:
    - Kiểm tra số dư ví ký quỹ của đại lý theo công thức: $\text{Giá thực trừ} = \text{MSRP} \times (100 - \text{Discount}) / 100$.
    - Tự động trừ tiền ví đại lý và ghi nhận nhật ký biến động ví.
    - Sinh mã bản quyền chuẩn quốc tế `CBNX-XXXX-XXXX-XXXX-XXXX`.
    - Tạo hồ sơ cửa hàng `saas_tenants` với thời hạn hợp đồng tương ứng (1 tháng, 1 năm hoặc trọn đời) và kích hoạt trọn gói toàn bộ 10 module F&B.
    - Ghi nhận Audit Trail hệ thống.
- [x] **Bước 3 (12/11/2026 10:20):** Thiết kế giao diện Quản trị Đại lý Chuẩn Liquid Glass trong [`master/web/super_admin.html`](../master/web/super_admin.html) và [`master/web/assets/js/super_admin.js`](../master/web/assets/js/super_admin.js):
  - Bổ sung nút điều hướng sidebar **`Đại Lý Phân Phối`** với huy hiệu đếm số đại lý hoạt động theo thời gian thực.
  - Tab **`Quản Lý Đại Lý & Kênh Phân Phối`**:
    - 4 Thẻ KPI: Tổng Đại Lý, Tổng Số Dư Ký Quỹ Trong Ví (VNĐ), Tổng Điểm Quán Đã Cấp, Doanh Thu Thu Được.
    - Banner chính sách 4 cấp bậc đối tác (🥉 Đồng 15%, 🥈 Bạc 25%, 🥇 Vàng 40%, 💎 Kim Cương 55%).
    - Bảng danh sách đại lý tương tác: hiển thị mã ĐL, tên công ty, cấp bậc & chiết khấu, số dư ví khả dụng, số cửa hàng đã kéo, tổng tiền, trạng thái và cụm nút thao tác nhanh (Nạp Ví, Cấp Key, Lịch Sử Ví, Sửa).
  - 4 Modal nghiệp vụ chuyên sâu:
    - `modal-reseller-form`: Đăng ký / chỉnh sửa thông tin đại lý, tự động đổi chiết khấu khi chọn cấp bậc.
    - `modal-deposit-reseller-wallet`: Nạp tiền ví ký quỹ nhanh với các mốc tiền 5M, 15M, 30M, 60M hoặc tự nhập.
    - `modal-reseller-issue-license`: Cấp bản quyền cho quán mới: chọn đại lý $\rightarrow$ tự động tính chiết khấu và số tiền thực trừ ví theo thời gian thực $\rightarrow$ sinh mã License Key tức thì kèm nút sao chép 1 chạm.
    - `modal-reseller-wallet-logs`: Bảng tra cứu lịch sử nạp / trừ tiền chi tiết của đại lý.
- [x] **Bước 4 (12/11/2026 10:25):** Biên dịch [`master/cybernexus_master.exe`](../master/cybernexus_master.exe) qua CMake UCRT64, chạy daemon Master Server port 8500.
- [x] **Bước 5 (12/11/2026 10:30):** Kiểm thử tự động E2E:
  - Kiểm thử toàn diện API: Tạo đại lý `DL-001` (Gold 40%), nạp ví ký quỹ 20,000,000đ, cấp license 1 năm cho quán "The Coffee Garden - Quận 7" (MSRP 3.990.000đ, chiết khấu 40% $\rightarrow$ trừ ví 2.394.000đ, số dư ví còn lại 17.606.000đ), kích hoạt thành công license `CBNX-RXZF-0JTT-TGLG-75AE` qua `/api/license/verify` với đủ 10 modules.
  - Chụp ảnh màn hình nghiệm thu giao diện Playwright: Bảng đại lý, Modal cấp bản quyền, Modal biến động số dư ví.

---

## 7. KHẮC PHỤC LỖI TÍNH TOÁN SỐ TIỀN THANH TOÁN VIETQR TRÊN TRANG KHÁCH HÀNG (CUSTOMER.HTML) (12/11/2026)

- **Hiện tượng lỗi:** Khi khách hàng bấm nút nhanh `[VietQR]` trên thanh giỏ món (`customer.html`), modal QR hiển thị mặc định `Số tiền: 0đ` và không cập nhật theo tổng giá trị các món đang chọn (VD: 45.000 đ) do thẻ `<img>` của `quick-vietqr-modal` bị gán tĩnh URL `amount=0` và hàm `showQuickVietQr()` chưa tính toán giỏ món.
- **Biện pháp xử lý & Nâng cấp:**
  - Bổ sung hàm `CustomerOrdering.getCartTotal()` trong [`slave/web/customer.html`](../slave/web/customer.html) để tính chính xác tổng tiền giỏ món đang chọn theo thời gian thực (kèm hỗ trợ fallback sang đơn hàng đã gửi `currentOrder.total_amount`).
  - Nâng cấp hàm `showQuickVietQr()`:
    - Kiểm tra giỏ hàng: nếu giỏ trống ($0$ đ), thông báo nhắc khách chọn món trước khi quét mã.
    - Lấy thông tin mã bàn / mã đơn từ URL hoặc phiên hiện tại (VD: `TT BAN MV1`).
    - Gọi API `/api/orders?action=vietqr&amount=...` để lấy cấu hình ngân hàng chuẩn từ hệ thống quán, tự động sinh chuỗi mã VietQR động theo chuẩn Napas247 với đúng số tiền và nội dung chuyển khoản.
    - Bổ sung khung hiển thị số tiền thanh toán rõ ràng (`#quick-vietqr-amount-display`) và thông tin tài khoản, nội dung CK trực tiếp trong modal.
  - Đồng bộ file sửa sang [`master/web/customer.html`](../master/web/customer.html) và gói phát hành [`CyberNexus_POS_Release_GP001/web/customer.html`](../master/packages/GP001/release/CyberNexus_POS_Release_GP001/web/customer.html).
  - Chạy kiểm thử tự động Playwright xác nhận mã VietQR sinh ra khớp hoàn toàn với số tiền giỏ món và nội dung bàn (`customer_vietqr_verified.png`).

---

## 8. TỐI ƯU GIAO DIỆN DI ĐỘNG (MOBILE RESPONSIVE) & THIẾT LẬP MÁY CHỦ STATIC IP / QR MẠNG LAN CHO QUÁN (12/11/2026)

### 8.1. Khắc phục lỗi hiển thị mất cân đối & cắt xén lề trái trên điện thoại di động
- **Hiện tượng lỗi:** Khi khách hàng mở modal chi tiết giỏ món tại bàn trên điện thoại (đặc biệt là Safari iOS), toàn bộ modal bị lệch sang mép trái, dẫn đến cắt xén chữ ở lề trái (mất chữ "Tên c", "Địa c", "Ghi c", "TỔNG C", và cụm nút chân trang "SL: 1" bị đẩy ra ngoài màn hình).
- **Nguyên nhân kỹ thuật gốc rễ:**
  1. Hàng nút bấm chân trang `#customer-sheet-action-grid` gồm 4 thành phần cố định (`[SL: 0]`, `[Thêm món]`, `[VietQR]`, `[Xác Nhận]`) kèm `whitespace-nowrap` có tổng min-width vượt quá chiều rộng khả dụng của màn hình mobile (< 360px).
  2. Modal container dùng flexbox centering (`display: flex; justify-content: center;`). Trong CSS Flexbox, khi một phần tử con có kích thước lớn hơn viewport, căn giữa sẽ đẩy phần tràn đều sang 2 bên, khiến tọa độ lề trái rơi vào giá trị âm ($x < 0$), gây ra hiện tượng cắt cụt chữ không thể cuộn xem được trên mobile.
- **Giải pháp triển khai trong [`slave/web/customer.html`](../slave/web/customer.html):**
  - **Tái cấu trúc chân trang modal thành 2 tầng khoa học:**
    - **Tầng 1 (Tóm tắt hóa đơn):** Căn lề 2 bên đối xứng: bên trái là nhãn `TỔNG HÓA ĐƠN` kèm huy hiệu `SL: X`, bên phải là tổng tiền cỡ lớn màu xanh ngọc font mono.
    - **Tầng 2 (Bộ 3 nút bấm tác vụ):** Chuyển sang bố cục lưới co giãn `grid grid-cols-3 gap-1.5 sm:gap-2` cho 3 nút: `[+ Thêm món]` (phụ), `[VietQR]` (tím), và `[✓ Xác Nhận]` (xanh lá chính). Tự động dàn đều 33.3% chiều rộng, không bị gãy dòng hay đẩy mép.
  - **Chuẩn hóa khung Modal Dialog:** Giới hạn `max-width: 480px; width: 100%; box-sizing: border-box; overflow-x: hidden;` với lề đệm an toàn `padding: 8px` trên mobile và bo góc 20px bo tròn hiện đại.
  - **Tối ưu danh sách món ăn:** Bổ sung `min-w-0`, `flex-1 truncate` cho tên món, thu gọn cụm tăng giảm số lượng stepper và nút ghi chú/xóa để đảm bảo vừa vặn trên mọi màn hình điện thoại từ 320px đến 430px.
  - **Cho phép khách hàng mở Menu tự do:** Điều chỉnh cơ chế xác thực đầu trang để khách hàng quét mã QR tại bàn mở ngay được menu món ăn mà không bị chuyển hướng sang trang đăng nhập nội bộ của nhân viên.

### 8.2. Hệ thống Tự Động Nhận Diện IP Mạng LAN Máy Chủ & Cấu Hình Static IP Cố Định Cho Quán
- **Hiện tượng lỗi:** Khi nhân viên hoặc chủ quán mở trang POS trên chính máy chủ qua `http://localhost:8501/`, toàn bộ mã QR Bàn và QR Khách Hàng sinh ra đều bị gán cứng đường dẫn `http://localhost:8501/customer.html`. Do đó, điện thoại của khách và nhân viên quét mã không thể truy cập được vì `localhost` chỉ trỏ về chính chiếc điện thoại đó.
- **Giải pháp triển khai trong C++ Native Backend ([`slave/src/slave_handlers.cpp`](../slave/src/slave_handlers.cpp)):**
  - Tích hợp thư viện mạng Windows Native `iphlpapi` (`GetAdaptersAddresses`) để tự động quét toàn bộ danh sách card mạng IPv4 đang kết nối (Up/Active) trên máy chủ.
  - **Thuật toán phân loại card mạng thông minh:** Tự động lọc và gắn cờ nhận diện card mạng ảo (VirtualBox, VMware, Hyper-V, vEthernet, WSL, Radmin, VPN...) để ưu tiên tuyệt đối card mạng vật lý của quán (Ethernet, Wi-Fi Realtek/Intel) lên vị trí ưu tiên số 1 làm `primary_lan_ip` (Ví dụ: `10.0.126.159`).
  - Nâng cấp endpoint `GET /api/settings`: Trả về danh sách `detected_ips`, `primary_lan_ip`, `server_ip`, `server_port`, và `server_base_url` (Ví dụ: `http://10.0.126.159:8501/`).
  - Hỗ trợ lưu trữ cấu hình `server_ip` và `server_port` vào cơ sở dữ liệu `store_settings` qua `POST /api/settings`.

### 8.3. Bổ sung Phân Hệ Thiết Lập Máy Chủ & Static IP trong Trang Quản Trị ([`admin.html`](../slave/web/admin.html))
- **Giao diện Cài Đặt Mạng Chuyên Nghiệp:**
  - Bổ sung Card chuyên dụng: **"Thiết Lập Máy Chủ & Địa Chỉ IP LAN (Static IP Quán)"** đặt nổi bật trong tab Cài Đặt Cửa Hàng.
  - **Danh sách card mạng trực quan:** Liệt kê các card mạng LAN tìm thấy trên máy chủ, phân biệt rõ card mạng vật lý ("Khuyên Dùng Cho Quán") và card ảo ("Card mạng ảo"), kèm nút bấm 1 chạm `[ Dùng IP Này ]` để điền nhanh IP vào cấu hình.
  - **Ô nhập Server Static IP & Cổng Port (8501):** Cho phép chủ quán thiết lập IP tĩnh cố định theo sơ đồ mạng quán hoặc router DHCP reservation. Đặt icon minh họa trực tiếp trên thẻ nhãn (`<label>`) thay vì lồng bên trong ô nhập liệu để chống hiện tượng đè icon lên chữ số trên một số trình duyệt.
  - **Banner Base URL Thời Gian Thực:** Hiển thị trực tiếp URL dịch vụ nội bộ (Ví dụ: `http://10.0.126.159:8501/`), nút `[ Sao chép ]` 1 chạm và link mở thử `[ Mở thử trang khách ]`.
  - Nút `[ Quét Lại IP ]` hỗ trợ cập nhật lại danh sách card mạng tức thì khi quán đổi mạng hoặc cắm lại dây LAN.

### 8.4. Chuẩn hóa Sinh Mã QR Bàn & Link Menu Khách Hàng Đồng Bộ Toàn Hệ Thống
- Nâng cấp toàn diện các hàm sinh mã QR trên toàn bộ hệ thống:
  - [`admin.js`](../slave/web/assets/js/admin.js): Cụm standee QR từng bàn, Standee Modal và Bản in hàng loạt toàn bộ bàn (`renderBatchQrPrint`) đều lấy chuẩn `getAdminBaseUrl()` theo IP LAN cấu hình (Ví dụ: `http://10.0.126.159:8501/customer.html?table=B01&name=...`), tuyệt đối không dùng `localhost`.
  - [`index.html`](../slave/web/index.html) (Màn hình Thu Ngân POS), [`kitchen.html`](../slave/web/kitchen.html) (Bếp KDS), và [`order.html`](../slave/web/order.html) (Phục Vụ): Nâng cấp modal `Mã QR Khách Hàng Gọi Món` để tự động đối chiếu IP máy chủ LAN cấu hình từ API và cache trình duyệt, hiển thị chuẩn `http://10.0.126.159:8501/customer.html`.

### 8.5. Đồng bộ Gói Phát Hành & Kiểm Thử Tự Động Toàn Diện
- Biên dịch thành công binary `cybernexus_slave.exe` (liên kết `ws2_32`, `crypt32`, `wsock32`, `iphlpapi`).
- Đồng bộ toàn bộ mã nguồn web sang [`master/web/`](../master/web/) và gói phát hành chuẩn [`master/packages/GP001/release/CyberNexus_POS_Release_GP001/`](../master/packages/GP001/release/CyberNexus_POS_Release_GP001/).
- Chạy kịch bản kiểm thử tự động Playwright ([`verify_lan_and_mobile.js`](../verify_lan_and_mobile.js)) đạt kết quả **100% Pass**:
  1. `TEST 1 (Mobile iPhone 390x844)`: Modal giỏ món mở trên di động có tọa độ `left: 8px, right: 382px`, các nút tác vụ `left: 21px, right: 369px`, không còn bị cắt xén lề trái.
  2. `TEST 2 (Admin Settings)`: Card mạng LAN tự động nhận dạng chính xác `10.0.126.159` (Realtek Gaming 2.5GbE), Static IP lưu và nạp tự động, Base URL `http://10.0.126.159:8501/`.
  3. `TEST 3 (POS LAN QR)`: Modal QR trên POS sinh đúng link mạng LAN `http://10.0.126.159:8501/customer.html`, sẵn sàng cho mọi điện thoại di động quét mã gọi món.

---

## 9. Khắc Phục Lỗi Hiển Thị Tên Preset Equalizer (DSP Studio Console trong Jukebox POS)

### 9.1. Hiện Tượng & Nguyên Nhân
- **Hiện tượng lỗi:**
  - Trong modal Jukebox trên màn hình POS thu ngân ([`index.html`](../slave/web/index.html)), tại hộp chọn Preset Âm Thanh của bàn trộn `10-BAND DSP STUDIO CONSOLE` (`#pos-eq-preset-select`), danh sách các preset bị hiển thị toàn bộ thành chuỗi `undefined` (ảnh phản hồi của người dùng).
- **Nguyên nhân kỹ thuật gốc rễ:**
  - C++ Native Backend endpoint `/api/media/eq/presets` trả về danh sách đối tượng preset với trường tên là `preset_name` (ví dụ: `"Morning Acoustic (Êm Dịu)"`, `"Lunch Lounge (Cân Bằng)"`, `"Cyber Night Club (EDM/Gaming)"`, `"Vocal Focus (Rõ Lời Ca Sĩ)"`, `"Rock & Bass Boost"`, `"Bypass Flat (Mặc Định 0dB)"`).
  - Trong file điều khiển giao diện [`slave/web/assets/js/pos-jukebox.js`](../slave/web/assets/js/pos-jukebox.js), hàm `loadEqPresets()` đọc thuộc tính `p.name` thay vì `p.preset_name`, dẫn đến thuộc tính này trả về `undefined` và sinh ra các thẻ `<option value="...">undefined</option>`. Tương tự, hàm thông báo Toast khi người dùng chọn preset cũng dùng `p.name`.

### 9.2. Giải Pháp Triển Khai
- **Chuẩn hóa nạp danh sách Preset Equalizer ([`pos-jukebox.js`](../slave/web/assets/js/pos-jukebox.js)):**
  - Cập nhật hàm `loadEqPresets()` ánh xạ dữ liệu thông minh với cơ chế fallback:
    ```javascript
    this.eqPresets = data.presets.map(p => ({
        ...p,
        name: p.preset_name || p.name || ('Preset #' + p.id)
    }));
    ```
  - Sinh thẻ `<option>` với tên hiển thị chuẩn xác và tự động đánh dấu `selected` đối với preset đang được kích hoạt (`p.is_active`).
- **Tái cấu trúc hàm nạp thông số `applyPresetValues(p, notify)`:**
  - Đồng bộ tự động cả 10 thanh gạt tần số âm thanh từ 31Hz đến 16kHz (`band_31hz` đến `band_16khz`).
  - Bổ sung cập nhật thanh trượt độ lợi đầu vào Preamp (`#pos-eq-preamp-slider`) và nhãn dB (`#pos-eq-preamp-val`) tương ứng với trường `preamp_gain` của từng preset.
  - Kết nối và truyền trực tiếp thông số tới các bộ lọc DSP thời gian thực của WebAudio (`window.JukeboxEngine.eqFilters` và `preampNode`).
  - Tự động nạp cấu hình của preset đang active ngay khi người dùng mở modal Jukebox trên POS.
- **Nâng cấp nút đưa về Flat 0dB (`applyFlatEq`):**
  - Đưa toàn bộ 10 band tần số về `0.0 dB`, Preamp về `0.0 dB`, cập nhật huy hiệu và tự động chuyển dropdown về preset Bypass Flat.

### 9.3. Đồng Bộ Gói Phát Hành & Kiểm Thử Tự Động
- Đồng bộ file `pos-jukebox.js` sang thư mục master [`master/web/assets/js/pos-jukebox.js`](../master/web/assets/js/pos-jukebox.js) và gói phát hành chuẩn [`master/packages/GP001/release/CyberNexus_POS_Release_GP001/web/assets/js/pos-jukebox.js`](../master/packages/GP001/release/CyberNexus_POS_Release_GP001/web/assets/js/pos-jukebox.js).
- **Kiểm thử tự động bằng Playwright:**
  - Chạy kiểm thử tự động đăng nhập POS thu ngân bằng mã PIN, mở modal Jukebox Studio Console.
  - Kết quả kiểm tra dropdown `#pos-eq-preset-select`: 100% các preset hiển thị chính xác tên tiếng Việt chuyên nghiệp:
    1. `Morning Acoustic (Êm Dịu)`
    2. `Lunch Lounge (Cân Bằng)`
    3. `Cyber Night Club (EDM/Gaming)`
    4. `Vocal Focus (Rõ Lời Ca Sĩ)`
    5. `Rock & Bass Boost`
    6. `Bypass Flat (Mặc Định 0dB)`
  - Khi chọn từng preset, đồ thị đường cong đáp tuyến tần số (Frequency Response Curve) và 10 fader slider nhảy mượt mà về đúng các giá trị dB tương ứng.

---

## 10. Nâng Cấp Bộ 15 Preset Âm Thanh Studio Chuẩn & Giao Diện Timbre Mastering Equalizer (POS & Admin)

### 10.1. Yêu Cầu & Định Hướng Triển Khai
- Đồng bộ hóa toàn bộ danh sách các band/preset âm thanh lưu sẵn cho cả **Màn hình Thu Ngân POS** ([`index.html`](../slave/web/index.html) qua [`pos-jukebox.js`](../slave/web/assets/js/pos-jukebox.js)) và **Màn hình Quản Trị Admin** ([`admin.html`](../slave/web/admin.html) Tab Media qua [`admin.js`](../slave/web/assets/js/admin.js)).
- Tái thiết kế giao diện bàn trộn âm thanh phòng thu chuyên nghiệp theo chuẩn **TIMBRE MASTERING EQUALIZER (PRO 10-BAND 64-BIT DSP AUDIO ENGINE)** với huy hiệu trạng thái `● EQ ON`, nút `Flat` đặt lại nhanh và nhãn vai trò tần số in hoa trực quan.

### 10.2. Danh Sách 15 Preset Âm Thanh Tiêu Chuẩn Phòng Thu
Hệ thống đã được nạp và tính toán cấu hình âm học chi tiết (dB gain cho 10 band tần số từ 31Hz đến 16kHz kèm Preamp Gain) cho trọn bộ 15 preset:
1. **🎵 Flat (Gốc):** Dải tần phẳng 0.0dB nguyên bản không can thiệp, trung thực với bản thu gốc.
2. **💥 Bass Boost:** Nâng mạnh dải Sub & Bass (+6.5dB ở 31Hz, +6.0dB ở 62Hz) với Preamp -1.0dB chống méo tiếng clipping.
3. **🔈 Bass Reducer:** Cắt giảm dải trầm (-6.0dB) giúp chống ù rền âm học khi quán dùng loa công suất nhỏ hoặc phòng hẹp.
4. **🎤 Vocal Clarity:** Tôn nổi bật giọng hát và độ rõ lời ca sĩ (+4.5dB ở 1kHz, +3.5dB ở 2kHz, +2.5dB ở 4kHz), lọc bớt tạp âm trầm.
5. **🎙️ Podcast / Voice:** Tối ưu đàm thoại và phát thanh, cắt dải siêu trầm chống rung mic và tăng dải trung ấm (+4.0dB).
6. **🎶 Pop:** Cân bằng V-curve nhẹ nhàng, tôn giọng ca sĩ và tiếng kick/snare giai điệu bắt tai.
7. **🎸 Rock / Metal:** Dải bass chắc gọn, mid sắc sảo, dải cao sáng giòn (+4.5dB ở 8kHz).
8. **🎤 Hip-Hop / R&B:** Tối ưu dải sub-bass 808 cực sâu (+6.0dB / +6.5dB) cùng treble sắc nét.
9. **🎧 EDM / Dance:** Không gian âm thanh sôi động câu lạc bộ bar/club, bùng nổ năng lượng dải trầm và dải cao lung linh.
10. **🎷 Jazz & Acoustic:** Không gian phòng trà mộc mạc, ấm áp, cân bằng tự nhiên dải trung và dải trầm.
11. **🎻 Classical:** Tái hiện dải động rộng của dàn nhạc giao hưởng, trung thực và chi tiết nhạc cụ bộ dây.
12. **🔊 Loudness:** Bù âm cân bằng sinh học tai người (Fletcher-Munson) giúp nghe đầy đủ chi tiết khi mở âm lượng vừa và nhỏ.
13. **🎬 Cinema 3D:** Hiệu ứng rạp chiếu phim vòm không gian với dải trầm rung động và treble không gian mở rộng.
14. **✨ Treble Sparkle:** Sáng lung linh ở các dải tần cao (Air 8kHz +6.5dB, Shine 16kHz +7.0dB), làm rõ chi tiết hi-hat, cymbal và guitar acoustic.
15. **🎛️ Tùy Chỉnh (Custom):** Tự động kích hoạt khi người dùng gạt tay bất kỳ fader nào để lưu lại sở thích âm thanh riêng của quán.

### 10.3. Nâng Cấp Giao Diện Bàn Trộn Âm Thanh Cả 2 Phân Hệ (POS & Admin)
- **Header chuẩn Studio:**
  - Tiêu đề: **TIMBRE MASTERING EQUALIZER**
  - Phụ đề: **PRO 10-BAND 64-BIT DSP AUDIO ENGINE**
  - Huy hiệu xanh: `● EQ ON`
  - Nút đặt lại nhanh: `[🔄 Flat]`
- **Chuẩn hóa nhãn vai trò dải tần (Band Roles):**
  - `31Hz`: **SUB** (Sub-Bass)
  - `62Hz`: **BASS** (Bass)
  - `125Hz`: **PUNCH** (Low-Mid)
  - `250Hz`: **WARM** (Warmth)
  - `500Hz`: **MID** (Body)
  - `1kHz`: **MID-H** (Vocal Presence)
  - `2kHz`: **EDGE** (Clarity)
  - `4kHz`: **BITE** (Attack / Presence)
  - `8kHz`: **AIR** (Brilliance)
  - `16kHz`: **SHINE** (Ultra-High Sparkle)
- **Cơ chế tương tác thông minh:**
  - Bất kỳ thao tác kéo cần gạt tần số hoặc Preamp Gain nào đều tự động đồng bộ menu dropdown về preset `🎛️ Tùy Chỉnh (Custom)`.
  - Nút `[🔄 Flat]` lập tức trả toàn bộ 10 band về 0.0dB và đồng bộ lại dropdown về `🎵 Flat (Gốc)`.

### 10.4. Đồng Bộ Cơ Sở Dữ Liệu & Kiểm Thử Tự Động
- Cập nhật cơ sở dữ liệu SQLite `media_eq_presets` trong cả [`slave/database/store_local.db`](../slave/database/store_local.db) và gói phát hành chuẩn [`master/packages/GP001/release/CyberNexus_POS_Release_GP001/database/store_local.db`](../master/packages/GP001/release/CyberNexus_POS_Release_GP001/database/store_local.db).
- Cập nhật logic tự động nâng cấp seed presets trong mã nguồn C++ module [`modules/mod_media_stream/mod_media_stream.cpp`](../modules/mod_media_stream/mod_media_stream.cpp).
- Đồng bộ toàn bộ các file giao diện sang [`master/web/`](../master/web/) và gói phát hành release.
- **Kiểm thử tự động Playwright:**
  - Đăng nhập kiểm tra màn hình Thu Ngân POS: Menu Jukebox hiển thị đúng chuẩn 15 preset, các vai trò band SUB/BASS/PUNCH/WARM/MID/MID-H/EDGE/BITE/AIR/SHINE hiển thị chuẩn 100%.
  - Đăng nhập kiểm tra màn hình Quản Trị Admin Tab Media: Menu DSP Console hiển thị đủ 15 preset, chuyển đổi mượt mà giữa các cấu hình âm thanh.



---

## 11. Rút Gọn Đường Dẫn Trình Duyệt Khách Hàng (Chỉ Hiển Thị IP:Port)

- **Yêu cầu:** Thanh địa chỉ khi khách mở menu chỉ hiển thị gọn IP:Port (ví dụ 10.0.126.159:8501), không lộ /customer.html.
- **Backend C++ ([`slave/src/main_slave.cpp`](../slave/src/main_slave.cpp)):** Route `GET /` — nếu **chưa có phiên đăng nhập nhân viên** thì phục vụ trực tiếp Menu Khách Hàng (không redirect, URL giữ nguyên `IP:Port`); nếu đã đăng nhập thì vẫn tự chuyển về màn hình theo vai trò (Admin/POS/Bếp/Phục vụ) như cũ.
- **Frontend ([`customer.html`](../slave/web/customer.html)):** Với khách vãng lai, script đầu trang dùng `history.replaceState` đổi `/customer.html` thành `/` (giữ nguyên `?table=...&name=...` của QR từng bàn); link/QR hero và nút Sao chép link sinh dạng `http://IP:Port/`. Link cũ `/customer.html` vẫn hoạt động.
- **Lưu ý vận hành:** Nhân viên truy cập `IP:Port` trên máy chưa đăng nhập sẽ thấy menu khách; nhân viên vào `IP:Port/login.html` (hoặc nút đăng nhập trên menu) để đăng nhập.
- **Kiểm thử Playwright:** `/` , `/customer.html`, `/customer.html?table=B01` đều hiển thị URL `http://10.0.126.159:8501/` (kèm `?table=` nếu có) và reload vẫn đúng menu khách. Đã build lại `cybernexus_slave.exe` và đồng bộ master/release.
