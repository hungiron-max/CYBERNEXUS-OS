# BÁO CÁO RÀ SOÁT CHUYÊN SÂU: NGÔN NGỮ TIẾNG VIỆT CHƯA CHUYỂN ĐỔI SANG ĐA NGÔN NGỮ TRÊN TOÀN BỘ HTML, JS, BACKEND & TỪ ĐIỂN (ĐỢT 8)

- **Thời điểm kiểm tra:** `22/11/2026 12:10`
- **Công cụ kiểm tra:** Bộ parser tự động `HTMLParser` + Regex Unicode dấu Tiếng Việt (`audit_remaining_vi.py`) quét toàn bộ **11 trang HTML**, **28 file JS**, **2.103 mục từ điển CSV/JSON** và **C++ Backend / Launcher / Legal Templates**.

---

## 1. TỔNG QUAN 4 NGUYÊN NHÂN KHIẾN CHỮ TIẾNG VIỆT VẪN HIỂN THỊ KHI CHUYỂN SANG NGÔN NGỮ KHÁC (`EN`)

Qua quét tự động toàn bộ mã nguồn, có chính xác **4 điểm nghẽn** khiến một số câu chữ vẫn hiển thị Tiếng Việt khi bấm chuyển sang `EN`:

| STT | Tầng hệ thống | Số lượng còn sót | Nguyên nhân kỹ thuật gốc rễ | Mã hạng mục đề xuất |
| :-: | :--- | :-: | :--- | :---: |
| **1** | **Từ điển `SYSTEM_MESSAGES_I18N.csv` & `locales/en.json`** | **1.619 / 2.103 dòng** (`77.0%`) cột `en` vẫn còn dấu Tiếng Việt | Script auto-translate ở Đợt 7 mới chỉ dịch theo từ khóa đơn lẻ (`WORD_GLOSSARY` 55 từ), nên các câu dài chỉ được thay 1–2 từ tiếng Anh còn lại vẫn nguyên chữ Tiếng Việt (VD: `"Thêm Mặt Hàng (Insert)"` -> `"Add Product (Insert)"` nhưng `"Tự động dùng AI nhận dạng tên món..."` vẫn còn nguyên tiếng Việt trong cột `en`). | **`I18N-15` (P0)** |
| **2** | **11 Trang HTML (`slave/web/*.html`, `master/web/*.html`)** | **764 thẻ HTML** (`<span>`, `<div>`, `<p>`, `<b>`, `<td>`, `<title>`, `<a>`, `<h5>`) + **112 thuộc tính `title="..."`** + **2 trang thiếu nút `VI/EN`** | Đợt 7 (`I18N-10`) mới quét các thẻ `<th>`, `<label>`, `<button>`, `<option>`, `<h1>..<h4>`, `placeholder`. Còn **764 thẻ văn bản lá** nằm trong `<span>`, `<div>`, `<p>`, `<b>`, `<td>`, `<title>` và **112 tooltip `title="..."`** chưa gắn `data-i18n` / `data-i18n-title`. Ngoài ra `attendance.html` và `theme_studio.html` đã nạp `i18n.js` nhưng chưa gắn cụm nút bấm `VI | EN` trên thanh Header. | **`I18N-16` (P0)** |
| **3** | **26 File JavaScript Render Động (`pos.js`, `admin*.js`, `super_admin*.js`, `kitchen_kds.js`, `order_waiter.js`, `customer_app.js`...)** | **2.368 dòng code JS** chứa chuỗi Tiếng Việt viết cứng trong Template Literal / `innerHTML` / Toast / Modal | Khi JS vẽ lại bảng danh sách, thẻ bàn, modal chi tiết ca, phiếu lương, lịch sử kho, biểu đồ... các chuỗi HTML sinh động bằng JS (`innerHTML = \`...\``) đang viết cứng Tiếng Việt mà chưa bọc qua `window.cnxT(key, vars, fallback)` và chưa đăng ký `window.addEventListener('cnx:lang-changed', ...)` như trang `online_orders.js`. | **`I18N-17` (P0)** |
| **4** | **C++ Backend Dynamic Strings, Launcher Win32 & 5 Biểu mẫu Pháp lý / Báo cáo In** | **~185 chuỗi C++** + **5 mẫu HTML hợp đồng/báo giá** | Một số chuỗi trạng thái trả về trực tiếp từ C++ (`slave_handlers.cpp`, `master_handlers.cpp` như tên trạng thái ca, ghi chú tự động, tiêu đề xuất CSV/Excel) và 5 biểu mẫu pháp lý (`master/templates/*.html`), phiếu in báo cáo kết ca/phiếu lương (`pos_shift_reports.js`) chưa qua bộ dịch `cnxT` theo ngôn ngữ đang chọn. | **`I18N-18` (P1)** |

---

## 2. THỐNG KÊ CHI TIẾT TỪNG TRANG HTML & FILE JS

### 2.1. Bảng thống kê 11 trang HTML (`slave/web/*.html` & `master/web/*.html`)

| Trang HTML | Đã gắn `data-i18n` | Đã có nút `VI/EN` | Thẻ chữ Tiếng Việt chưa gắn (`<span>`, `<div>`, `<p>`, `<b>`, `<td>`, `<title>`) | Tooltip `title="..."` chưa gắn `data-i18n-title` | Chi tiết các loại thẻ còn sót |
| :--- | :-: | :-: | :-: | :-: | :--- |
| [slave/web/admin.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/admin.html) | 956 | ✅ Có | **315** | **54** | `span`: 163, `div`: 70, `p`: 54, `b`: 17, `td`: 4, `a`: 2, `textarea`: 2, `title`: 1, `button`: 1, `label`: 1 |
| [master/web/super_admin.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/master/web/super_admin.html) | 389 | ✅ Có | **198** | **18** | `span`: 87, `div`: 55, `p`: 45, `td`: 6, `button`: 3, `b`: 1, `title`: 1 |
| [slave/web/customer.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/customer.html) | 157 | ✅ Có | **107** | **5** | `span`: 82, `p`: 12, `div`: 10, `button`: 1, `h5`: 1, `title`: 1 |
| [slave/web/index.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/index.html) | 42 | ✅ Có | **48** | **22** | `span`: 26, `div`: 15, `p`: 4, `b`: 1, `a`: 1, `title`: 1 |
| [slave/web/order.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/order.html) | 24 | ✅ Có | **44** | **5** | `span`: 23, `div`: 7, `p`: 5, `b`: 3, `button`: 3, `a`: 1, `h3`: 1, `title`: 1 |
| [master/web/theme_studio.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/master/web/theme_studio.html) | 23 | ❌ **Chưa có** | **14** | **0** | `span`: 9, `div`: 4, `a`: 1 |
| [slave/web/kitchen.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/kitchen.html) | 16 | ✅ Có | **13** | **5** | `span`: 9, `p`: 2, `a`: 1, `title`: 1 |
| [slave/web/login.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/login.html) | 19 | ✅ Có | **11** | **2** | `span`: 6, `p`: 2, `div`: 2, `title`: 1 |
| [slave/web/wifi.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/wifi.html) | 13 | ✅ Có | **9** | **0** | `span`: 4, `p`: 2, `h2`: 1, `div`: 1, `title`: 1 |
| [slave/web/attendance.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/attendance.html) | 24 | ❌ **Chưa có** | **4** | **0** | `title`: 1, `p`: 1, `span`: 1, `div`: 1 |
| [slave/web/online_orders.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/online_orders.html) | 35 | ✅ Có | **1** | **1** | `title`: 1 |
| **TỔNG CỘNG (11 trang)** | **1.698** | **9/11** | **764** | **112** | `placeholder` còn sót: **0** |

### 2.2. Bảng thống kê 26 file JavaScript chứa chuỗi Tiếng Việt động (`hardcoded_vn_lines`)

| Phân hệ | File JavaScript | Số dòng chứa chữ Tiếng Việt tĩnh | Số lệnh gọi `cnxT()` hiện tại |
| :--- | :--- | :-: | :-: |
| **Master SuperAdmin** | [master/web/assets/js/super_admin.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/master/web/assets/js/super_admin.js) | 264 | 6 |
| **Master SuperAdmin Ext** | [master/web/assets/js/super_admin_ext.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/master/web/assets/js/super_admin_ext.js) | 211 | 0 |
| **Slave POS Thu ngân** | [slave/web/assets/js/pos.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/pos.js) | 236 | 0 |
| **Slave POS Báo cáo Ca** | [slave/web/assets/js/pos_shift_reports.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/pos_shift_reports.js) | 166 | 0 |
| **Slave POS Jukebox** | [slave/web/assets/js/pos-jukebox.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/pos-jukebox.js) | 79 | 0 |
| **Slave Admin Core** | [slave/web/assets/js/admin.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/admin.js) | 169 | 0 |
| **Slave Admin Tài chính & Lương** | [slave/web/assets/js/admin_finance_ecr.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/admin_finance_ecr.js) | 217 | 1 |
| **Slave Admin Kho & AI OCR** | [slave/web/assets/js/admin_inventory.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/admin_inventory.js) | 210 | 0 |
| **Slave Admin Nhân sự & KPI** | [slave/web/assets/js/admin_ops_kpi.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/admin_ops_kpi.js) | 201 | 0 |
| **Slave Admin Media & DSP EQ** | [slave/web/assets/js/admin_media_dsp.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/admin_media_dsp.js) | 127 | 1 |
| **Slave Admin Mở rộng** | [slave/web/assets/js/admin_inline_ext.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/admin_inline_ext.js) | 126 | 0 |
| **Slave Phục vụ Order** | [slave/web/assets/js/order_waiter.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/order_waiter.js) | 103 | 0 |
| **Slave Bếp & Bar KDS** | [slave/web/assets/js/kitchen_kds.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/kitchen_kds.js) | 93 | 0 |
| **Slave Khách hàng QR** | [slave/web/assets/js/customer_app.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/customer_app.js) | 87 | 6 |
| **Slave Kiosk Chấm công** | [slave/web/assets/js/attendance_kiosk.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/attendance_kds.js) | 17 | 0 |
| **Các file JS phụ trợ khác** | `online_orders.js`, `image_processor.js`, `store_brand.js`, `theme.js`, `virtual-keyboard.js`... | 62 | 55 |
| **TỔNG CỘNG** | **26 files** | **2.368 dòng** | **69 lệnh** |

---

## 3. ĐỀ XUẤT 4 HẠNG MỤC XỬ LÝ DỨT ĐIỂM (`I18N-15` → `I18N-18`) ĐÃ NẠP VÀO BẢNG THEO DÕI QA

1. **`I18N-15` (P0): Dịch chuẩn 100% tiếng Anh (`en`) cho toàn bộ 1.619 câu còn sót dấu Tiếng Việt trong `SYSTEM_MESSAGES_I18N.csv` & 8 file `locales/en.json`**
   - Thay thế bản dịch ghép từ sơ sài bằng bản dịch tiếng Anh chuẩn ngữ cảnh F&B POS / SaaS cho toàn bộ 1.619 mục đang còn ký tự Tiếng Việt có dấu trong cột `en`.
   - Đảm bảo kiểm tra tự động: **0 dòng** nào trong cột `en` của `SYSTEM_MESSAGES_I18N.csv` và `locales/en.json` còn chứa ký tự dấu Tiếng Việt (trừ tên riêng thương hiệu/địa danh).
2. **`I18N-16` (P0): Quét & gắn `data-i18n` / `data-i18n-title` cho toàn bộ 764 thẻ văn bản (`<span>`, `<div>`, `<p>`, `<b>`, `<td>`, `<title>`, `<a>`) + 112 tooltip `title` trên 11 trang HTML & bổ sung nút `VI | EN` cho `attendance.html`, `theme_studio.html`**
   - Mở rộng bộ parser AST HTML để gắn `data-i18n` cho toàn bộ 764 thẻ văn bản lá (`span`, `div`, `p`, `b`, `td`, `a`, `h5`, `title`) và 112 thuộc tính `title="..."` (`data-i18n-title`) trên cả 11 trang HTML.
   - Bổ sung thanh chuyển đổi ngôn ngữ `VI | EN` đồng bộ trên Header của `slave/web/attendance.html` và `master/web/theme_studio.html`.
   - Hỗ trợ dịch cả thẻ `<title>` của tab trình duyệt khi đổi ngôn ngữ trong `i18n.js`.
3. **`I18N-17` (P0): Chuyển đổi 100% chuỗi Tiếng Việt render động trong 26 file JavaScript (2.368 dòng) sang `window.cnxT()` và tự động vẽ lại giao diện khi bấm chuyển ngôn ngữ (`cnx:lang-changed`)**
   - Bọc toàn bộ các chuỗi Tiếng Việt sinh động trong `pos.js`, `pos_shift_reports.js`, `pos-jukebox.js`, `admin.js`, `admin_finance_ecr.js`, `admin_inventory.js`, `admin_ops_kpi.js`, `admin_media_dsp.js`, `admin_inline_ext.js`, `order_waiter.js`, `kitchen_kds.js`, `customer_app.js`, `attendance_kiosk.js`, `super_admin.js`, `super_admin_ext.js` qua `window.cnxT(key, vars, fallback)`.
   - Đăng ký listener `window.addEventListener('cnx:lang-changed', ...)` trên tất cả các controller JS để khi bấm `VI` / `EN`, toàn bộ bảng dữ liệu, thẻ bàn, trạng thái đơn, modal đang mở đều đổi ngôn ngữ tức thì mà không cần F5.
4. **`I18N-18` (P1): Đa ngôn ngữ hóa các chuỗi báo cáo/trạng thái động từ C++ Backend, Phiếu in Kết ca / Phiếu lương (`pos_shift_reports.js`) & 5 Biểu mẫu Pháp lý (`master/templates/*.html`)**
   - Chuẩn hóa các chuỗi trạng thái/ghi chú sinh từ C++ Backend (`slave_handlers.cpp`, `master_handlers.cpp`) kèm mã key i18n để Frontend dịch tự động theo ngôn ngữ đang chọn.
   - Đa ngôn ngữ hóa mẫu in Báo cáo kết ca X-Report/Z-Report, Phiếu lương nhân viên và 5 mẫu hợp đồng/báo giá/nghiệm thu trên Master.
