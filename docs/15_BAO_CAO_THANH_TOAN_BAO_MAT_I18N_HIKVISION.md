# Báo Cáo Kiểm Tra Chuyên Sâu & Đề Xuất Nâng Cấp: Thanh Toán, Két Tiền, Bảo Mật Chống Spam/Mã Độc, i18n AI Studio & Chấm Công Hikvision

**Ngày lập:** 22/11/2026  
**Phạm vi kiểm tra:** Toàn bộ mã nguồn `slave/`, `master/`, `shared/`, `docs/` của CyberNexus OS (`cybernexus_slave`, `cybernexus_master`, Web POS/Admin/Customer/Online Orders, `SYSTEM_MESSAGES_I18N.csv`).  
**Mã theo dõi đã nạp vào Dashboard:** 14 hạng mục (`PAY-01..05`, `SEC-16..19`, `I18N-07..08`, `HR-07..09`) tại [qa_tracker_data.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/docs/qa_tracker_data.js) và [13_BANG_THEO_DOI_KHUYET_TAT.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/docs/13_BANG_THEO_DOI_KHUYET_TAT.html).

---

## 1. Luồng Thanh Toán, Xử Lý Lỗi, Chống Gian Lận & Quy Trình Mở Két Tiền (`PAY-01` .. `PAY-05`)

### 1.1. Thực trạng kiểm chứng từ mã nguồn

| Vấn đề | Vị trí mã nguồn thực tế | Tác động / Rủi ro |
|---|---|---|
| **Chưa có điều khiển mở két tiền theo hình thức thanh toán (`PAY-01`)** | [pos_shift_reports.js:580-625](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/pos_shift_reports.js#L580-L625) | Hiện tại POS chỉ in qua HTML ẩn (`iframe.contentWindow.print()` / fallback `window.print()`). Hoàn toàn **không có** lệnh ESC/POS kick két (`ESC p m t1 t2`, tức `0x1B 0x70 0x00 0x19 0xFA`) hay API máy in nhiệt phía C++. Nếu quán bật tùy chọn *"Auto Open Cash Drawer after Print"* trong driver máy in Windows, két tiền sẽ bị bật mở **mỗi lần in**, kể cả khi khách chuyển khoản, cà thẻ POS, **in tạm tính (`printTemporaryReceipt` tại L311)** hoặc **in lại hóa đơn (`reprintActiveOrder` tại `pos.js:1685`)**. |
| **Thiếu kiểm tra bắt buộc phiên đăng nhập & phân quyền trên `handleOrders` (`PAY-02`)** | [slave_handlers.cpp:2587-4575](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L2587-L4575) (`L3101`, `L3714`, `L3907`, `L4193`, `L4375`, `L4461`) | Các action nhạy cảm như `checkout`, `confirm_payment`, `settle_delta`, `cancel_order`, `kitchen_cancel_item`, `save_order` gọi `AuthService::instance().authenticate(req)` chỉ để lấy `userOpt->fullname` (nếu không đăng nhập sẽ fallback về `"Thu ngân"`, `cUserId = 1`), **không trả HTTP 401/403**. |
| **Client có thể thao túng đơn giá khi tạo/sửa đơn (`PAY-02`)** | [slave_handlers.cpp:3088-3099](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L3088-L3099), [L3304](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L3304) | Server chỉ tra giá trong bảng `products` khi client gửi `price <= 0` hoặc thiếu tên món; nếu payload gửi `price > 0` (VD: sửa qua DevTools thành `1000đ` cho ly cà phê `55000đ`), server tin luôn giá client gửi. |
| **Xóa trắng món đơn đang mở không ghi Audit & giảm giá 100% không PIN (`PAY-02`)** | [slave_handlers.cpp:3218-3235](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L3218-L3235), [L3661-L3693](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L3661-L3693) | Chế độ Replace của `save_order` (`DELETE FROM order_items`) không ghi log `audit_logs` nếu tổng đơn giảm mạnh sau khi đã in tạm tính cho khách. Mục giảm giá cho phép giảm tới `100%` hoặc toàn bộ `subtotal` mà không bắt xác thực PIN Quản lý khi vượt ngưỡng (VD: `>= 20%` hoặc `>= 50.000đ`); nếu `promo_code` không hợp lệ vẫn fallback sang `discountValue`. |
| **Tách rời bước cà thẻ `/api/card/charge` và `checkout` (`PAY-03`)** | [pos.js:2215-2336](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/pos.js#L2215-L2336) | Với `selectedPaymentMethod === 'card'`, POS gọi `/api/card/charge` trước rồi mới gọi `api/orders.php?action=checkout`. Nếu máy SmartPOS đã chuẩn chi `APPROVED` (khách đã bị trừ tiền thẻ) nhưng bước `checkout` gặp lỗi mạng, timeout hoặc HTTP `409` (`pending_void`), đơn vẫn `unpaid`, nhánh `catch(e)` tại `pos.js:2333` chỉ `console.error` (không báo lỗi cho thu ngân, không mở lại nút, không lưu `card_tx_ref` để retry checkout hay tự động gọi `/api/card/void` hoàn tác). |
| **Thiếu Idempotency Key, thiếu Void thẻ khi hủy đơn & bắn `ORDER_PAID` 2 lần (`PAY-03`)** | [slave_handlers.cpp:3748-3812](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L3748-L3812), [L4446-L4530](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L4446-L4530) | Nút `btn-confirm-checkout` không bị khóa ngay đầu hàm cho tiền mặt/chuyển khoản; `payment_transactions` không có `idempotency_key`; trong `checkout` bắn `PluginManager::instance().dispatchEvent("ORDER_PAID", ...)` **2 lần liên tiếp** (`L3748` và `L3811`); bảng `orders` chưa lưu `card_tx_ref` nên `cancel_order` không kiểm tra để hoàn/hủy giao dịch thẻ; chưa hỗ trợ Split Payment (trả kết hợp Tiền mặt + CK/Thẻ) và đối soát biến động số dư VietQR Webhook. |
| **Thiếu kiểm soát đổi phương thức thanh toán & chốt ca khi còn lệch công nợ (`PAY-04`)** | [slave_handlers.cpp:5824-5843](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L5824-L5843) | `close_shift` chỉ đếm `openOrdersCnt` nhưng chưa kiểm tra đơn đang có `settlement_status IN ('refund_due', 'extra_due')`; chưa có API đổi phương thức thanh toán (`cash` ↔ `banking` ↔ `card`) sau khi checkout kèm PIN Quản lý & Audit Log; chưa tổng hợp chỉ số gian lận (số lần mở két No-Sale, số lần in tạm tính/in lại, tổng giảm giá/hủy món) trong báo cáo kết ca. |

### 1.2. Quy trình chuẩn đề xuất: Mở két tiền khi in bill theo từng phương thức thanh toán (`PAY-01`)

Nguyên tắc vàng: **Tắt "Auto Open Drawer after Print" trong driver máy in Windows**, chuyển quyền phát xung mở két về **Native ESC/POS Print Bridge trên Slave (`POST /api/printer/print-receipt` & `POST /api/printer/open-drawer`)** sử dụng Win32 Raw Printer Spooler (`OpenPrinter` / `StartDocPrinter` / `WritePrinter`) hoặc kết nối thẳng TCP/9100 tới máy in LAN.

| Tình huống thanh toán / in ấn | Hành động in bill | Mở két tiền? | Điều kiện & Nhật ký kiểm toán (`audit_logs`) |
|---|---|---|---|
| **1. Thanh toán Tiền mặt (`cash`)** | In hóa đơn chính thức (`TIỀN MẶT`, tiền khách đưa, tiền thối) | **CÓ (Mở 1 lần duy nhất)** | Chỉ phát lệnh ESC/POS kick pin `0x1B 0x70 0x00 0x19 0xFA` khi `checkout` trả `success: true` & cờ `open_drawer: true` (kết thúc 1 giao dịch). Ghi log `CASH_DRAWER_OPEN`. |
| **2. Chuyển khoản (`banking` / VietQR)** | In hóa đơn chính thức (`CHUYỂN KHOẢN` + mã tham chiếu `bank_ref` / trạng thái Webhook) | **KHÔNG** | `open_drawer: false`. Thu ngân không có lý do mở két tiền mặt khi khách không đưa tiền mặt. |
| **3. Thẻ POS (`card` / SmartPOS)** | In hóa đơn chính thức (`THẺ POS`, 4 số cuối thẻ, mã `approval_code`, `RRN`) | **KHÔNG** | `open_drawer: false`. Ngoại lệ duy nhất: **Split Payment** (khách trả 1 phần Tiền mặt > 0 + 1 phần Thẻ/CK) → chỉ mở khi `cash_part > 0`. |
| **4. In tạm tính (`PRINT_TEMP_BILL`)** | In phiếu có watermark **`PHIẾU TẠM TÍNH — KHÔNG CÓ GIÁ TRỊ THANH TOÁN`** | **KHÔNG** | `open_drawer: false`. Ghi log `PRINT_TEMP_BILL` kèm giá trị tạm tính để phát hiện hành vi thu tiền xong mới xóa món. |
| **5. In lại hóa đơn (`REPRINT_RECEIPT`)** | In bản sao có watermark **`BẢN SAO IN LẠI LẦN THỨ N`** | **KHÔNG** | `open_drawer: false`. Ghi `reprint_count` và log `REPRINT_RECEIPT` kèm lý do. |
| **6. Thu / Chi quầy, Hoàn tiền mặt, Mở két lẻ (No-Sale)** | Không in bill bán hàng (hoặc in phiếu chi) | **CÓ (theo quyền)** | Phiếu thu/chi (`add_cash_tx`) và hoàn tiền mặt (`settle_delta` method=`cash`): mở két có lý do. Nút **Mở két thủ công (No-Sale)** bắt buộc **nhập lý do + xác thực PIN Quản lý** (hoặc đếm cảnh báo nếu vượt ngưỡng/ca) → ghi `NO_SALE_DRAWER_OPEN` và cộng `drawer_open_count` vào biên bản giao ca. |

> **Fallback khi trình duyệt chưa kết nối Native Print Bridge:** Vẫn in iframe HTML bình thường và hiện cảnh báo rõ thu ngân mở két bằng chìa/công tắc chỉ khi phương thức là Tiền mặt (khuyến nghị cài chế độ Native RAW ESC/POS mặc định cho quầy POS Windows).

### 1.3. Đề xuất xử lý thanh toán lỗi & chống gian lận (`PAY-02`, `PAY-03`, `PAY-04`)

1. **Siết Auth & Giá Server-Authoritative (`PAY-02`):**
   - Bắt buộc `AuthService::instance().authenticate(req)` và kiểm tra vai trò (`cashier`/`admin`/`waiter`) cho mọi action thay đổi đơn/tiền trong `handleOrders`; riêng `customer_order`, `customer_mark_transfer`, `submit_review`, `customer_status` tách riêng có chữ ký/phiên chống giả mạo.
   - Khi tạo/cập nhật đơn (`save_order`), **bắt buộc tra `sale_price` từ bảng `products`** (và bảng topping nếu có) trên server, không bao giờ tin `price` do client gửi.
   - Mọi thao tác **xóa/giảm số lượng món trên đơn đã in tạm tính hoặc đã báo Bếp** bắt buộc lưu `temp_bill_printed_at` / ghi `audit_logs (WARN/CRITICAL)`. Giảm giá thủ công vượt ngưỡng (`>= 20%` hoặc `>= 50.000đ`, cấu hình được ở Admin) bắt buộc xác thực **PIN Quản lý/Admin**; mã `promo_code` không hợp lệ phải trả HTTP `400` thay vì lặng lẽ chuyển sang giảm giá thủ công.
2. **Giao dịch nguyên tử 2 pha & Idempotency (`PAY-03`):**
   - Client sinh `idempotency_key` (UUID) mỗi lần mở modal thanh toán & khóa `btn-confirm-checkout` ngay khi bấm cho cả `cash`, `banking`, `card`. Server kiểm tra `UNIQUE(idempotency_key)` trên `payment_transactions` → trùng lặp thì trả về đúng hóa đơn đã chốt trước đó, tuyệt đối không trừ 2 lần.
   - Với **Thẻ POS (`card`)**: lưu ngay biên lai `card_transactions (tx_ref, order_id, status='APPROVED')` vào bảng trung gian trước khi gọi `checkout`. Nếu `checkout` lỗi hoặc bị `409 pending_void`:
     - Với `409 pending_void`: khóa nút cà thẻ ngay từ đầu ở frontend nếu đơn đang có món chờ Bếp duyệt hủy!
     - Nếu `checkout` thất bại sau khi thẻ đã `APPROVED`: hiện **Modal Khôi phục Giao dịch** với 2 lựa chọn: **(a) Thử hoàn tất đơn lại với `card_tx_ref` đã chuẩn chi** (không quẹt thẻ lại!) hoặc **(b) Hủy giao dịch thẻ (`/api/card/void`) ngay lập tức** và ghi cảnh báo `CRITICAL` lên Admin.
   - Lưu `card_tx_ref` vào bảng `orders`; khi `cancel_order` trên đơn đã trả thẻ thì bắt buộc yêu cầu xử lý/gọi Void hoặc ghi nhận `refund_due` chờ hoàn thẻ. Xóa lời gọi `dispatchEvent("ORDER_PAID")` bị trùng ở `slave_handlers.cpp:3748` (chỉ giữ 1 lần sau `db.commit()` tại L3811).
   - Bổ sung **Split Payment** (bảng `payment_transactions` nhận mảng `{method, amount, bank_ref, card_tx_ref}`) và cơ chế **đối soát VietQR** (nhập bắt buộc `bank_ref` thủ công có cảnh báo hoặc tích hợp Webhook ngân hàng/SePay/Casso xác thực chữ ký HMAC-SHA256 để tự động chuyển `paid`).
3. **Đổi phương thức & Bảng chỉ số rủi ro giao ca (`PAY-04`):**
   - Thêm API đổi phương thức thanh toán (`POST /api/orders.php?action=change_payment_method`) yêu cầu **PIN Admin + lý do**, cập nhật `payment_transactions` & ghi Audit `CRITICAL`.
   - Tại `close_shift`: cảnh báo rõ / yêu cầu xác nhận Quản lý nếu còn đơn `refund_due`/`extra_due`, đồng thời hiển thị thêm **Chỉ số kiểm soát gian lận cuối ca** (`no_sale_drawer_opens`, `temp_bill_prints`, `reprints`, `voids_count`, `manual_discounts_total`).

### 1.4. Setup Form In Hóa Đơn Tùy Chỉnh (`PAY-05` — P1)

- **Thực trạng mã nguồn:** Phần tạo HTML và CSS phiếu in nhiệt hiện đang **gắn cứng (hardcode) và trùng lặp tại 2 nơi** — [pos_shift_reports.js:383-625](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/pos_shift_reports.js#L383-L625) (POS) và [admin.js:2462-2620](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/admin.js#L2462-L2620) (Admin): cố định `@page { size: 80mm auto }`, `width: 76mm`, `padding: 8px 10px`, `font-size: 12px`, `line-height: 1.35`, khoảng cách món `margin-bottom: 5px`, đường kẻ phân cách `margin: 8px 0`, đồng thời ghi cứng dòng footer `"Hệ thống POS Góc Phố"` trong khi C++ [slave_handlers.cpp:1297-1298](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L1297-L1298) đã có `print_header_note` và `print_footer_note` trong `store_settings` nhưng chưa có giao diện chỉnh bố cục.
- **Đề xuất tính năng "Setup Form In Hóa Đơn" (Admin UI + Renderer dùng chung POS/Admin):**
  1. Lưu JSON mẫu in tại `store_settings` (`receipt_template_json`), áp dụng đồng bộ cho cả in bill thanh toán POS, in tạm tính và in lại trong Admin.
  2. **Khổ giấy & Vùng in:** chọn nhanh **80mm** / **58mm** / nhập `width_mm` tùy chỉnh, `padding_x_px`, `padding_top_px`, `padding_bottom_px`.
  3. **Khoảng cách dòng & Typography (chỉnh trực tiếp bằng thanh trượt / số):**
     - **Khoảng cách dòng (`line_height`):** `1.0` → `2.2` (áp cho toàn bộ thân hóa đơn).
     - **Khoảng cách giữa các món (`item_gap_px`):** `0px` → `16px`.
     - **Khoảng cách giữa các khối / đường kẻ (`section_gap_px`):** `2px` → `16px`.
     - Cỡ chữ tên quán, tiêu đề phiếu, danh sách món (`font_size_px`), dòng tổng cộng; chọn Font (`Courier New` monospace / `Segoe UI` sans-serif) và bật/tắt **Chữ đậm dễ đọc trên máy nhiệt cũ**.
  4. **Bật / tắt & Tùy biến nội dung thành phần:** Logo quán, Địa chỉ, Hotline, Tiêu đề đầu phiếu (`print_header_note`), Bàn / Thu ngân / Giờ in, Topping & ghi chú món, WiFi quán, QR thanh toán VietQR trên phiếu tạm tính/chờ CK, Lời chào chân trang (`print_footer_note`), số liên in (`copies`: 1–3) và số dòng giấy đẩy cuối bill (`feed_lines`).
  5. **Xem trước trực tiếp (Live Preview)** đúng tỉ lệ giấy ngay bên cạnh bảng chỉnh thông số + nút **In thử mẫu (80mm/58mm)** + nút **Khôi phục mặc định**.

---

## 2. Chống Tấn Công Mã Độc, Spam Đơn Rác & An Toàn Xác Thực (`SEC-16` .. `SEC-19`)

### 2.1. Các lỗ hổng nghiêm trọng đã phát hiện khi kiểm tra mã nguồn

1. **Cửa hậu mật khẩu mặc định & thiếu chống dò mật khẩu/PIN (`SEC-16` — P0):**
   - Tại [shared/src/auth.cpp:241](file:///X:/My%20Drive/Code%20dev/cybernexus-os/shared/src/auth.cpp#L241): Tài khoản `superadmin` chấp nhận luôn `password == "admin123" || password == "123456" || password == "admin" || password.empty()` **ngay cả khi trong DB đã có Bcrypt hash** (`superHash`).
   - Tại [shared/src/auth.cpp:289](file:///X:/My%20Drive/Code%20dev/cybernexus-os/shared/src/auth.cpp#L289): Mọi user cửa hàng (kể cả Admin quán!) luôn đăng nhập được bằng `password == "123456" || password.empty() || password == "admin"` **bất chấp mật khẩu thật đã đổi sang Bcrypt**!
   - Không có giới hạn số lần nhập sai (`failed_attempts`) cho `login` và `loginPin` (PIN 6 số hoặc ngắn hơn hoàn toàn có thể bị brute-force qua LAN).
2. **Lỗ hổng Upload tệp tin tùy ý & Path Traversal (`SEC-17` — P0):**
   - [slave_handlers.cpp:8195-8233](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L8195-L8233) (`upload_media` quảng cáo): lấy trực tiếp phần mở rộng `ext` từ `file.filename` của client **không có whitelist** → kẻ tấn công hoặc người dùng upload được `.svg` chứa `<script>` (Stored XSS trên màn hình `/customer.html`), `.html`, `.exe`, `.bat`, `.ps1`; không kiểm tra Magic Bytes; không giới hạn kích thước file.
   - [master_handlers.cpp:2038-2065](file:///X:/My%20Drive/Code%20dev/cybernexus-os/master/src/master_handlers.cpp#L2038-L2065) (`upload_tenant_document`): ghép thẳng `file.filename` vào `targetDir / saveName` **không lọc `../` hay `\` (Path Traversal)**, không kiểm tra đuôi file hay Magic Bytes.
   - [slave_handlers.cpp:8589-8628](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L8589-L8628) (`POST /api/media/tracks/upload`): đã kiểm tra đuôi `.mp3/.wav/.flac/.ogg` nhưng **vẫn giữ nguyên `file.filename` làm tên file lưu trên ổ cứng** (`targetPath = mediaDir / saveFile` → dễ bị ghi đè/Path Traversal `../../`), không kiểm tra Magic Bytes của audio, chưa kiểm tra RBAC Admin ở nhánh handler này.
   - [slave_handlers.cpp:1969-2000](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L1969-L2000) (`saveDishImageToUploads`): tin MIME từ chuỗi `data:` URI, không xác thực Magic Bytes (PNG/JPEG/WebP), không giới hạn kích thước payload Base64; cả `main_slave.cpp` và `main_master.cpp` chưa cấu hình `svr.set_payload_max_length(...)` để chặn tấn công tràn RAM (OOM) bằng body khổng lồ.
3. **Bỏ ngỏ Spam đơn rác tại Menu QR Khách Hàng (`SEC-18` — P0):**
   - Các endpoint công khai không cần đăng nhập như `customer_order` ([slave_handlers.cpp:3001-3350](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L3001-L3350)), `customer_mark_transfer` (`L3880-3896`) và `submit_review` (`L4059`) **không có Rate Limiter**. Kẻ xấu trên cùng WiFi quán (hoặc nếu mở port) chỉ cần vòng lặp `curl`/`fetch` gửi 1.000 request `action=customer_order` với `quantity: 99999` → ngập hàng trăm đơn giả vào màn hình Phục vụ/Thu ngân, đầy DB và đóng băng bàn trống (`tableId` bị khóa bởi đơn rác)!
   - `order_code` sinh tuần tự (`HDYYMMDD-0001`, `L3255`) nên ai cũng đoán được mã đơn người khác để gọi `customer_mark_transfer` tạo thông báo CK giả.
   - Không có chữ ký HMAC trên QR Code theo bàn (`/customer?table=5&sig=...`) và không giới hạn số đơn `pending` tối đa từ cùng 1 IP / cùng 1 SĐT.
4. **Kiểm tra toàn vẹn Runtime, RBAC API thống nhất & Chống SSRF (`SEC-19` — P1):**
   - `slave/web/web_integrity.json` mới chỉ kiểm tra khi người dùng bấm chẩn đoán trong Control Center, Slave HTTP server khi khởi động chưa tự kiểm tra băm SHA-256 của file HTML/JS để phát hiện web shell hoặc JS bị sửa trái phép; `fetch_dish_image` (`slave_handlers.cpp:2090`) chuyển URL sang Master AI proxy nhưng cần chặn tuyệt đối các IP nội bộ/localhost/link-local (`127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.169.254`) chống SSRF.

### 2.2. Giải pháp đề xuất

- **`SEC-16`**: Xóa bỏ 2 nhánh backdoor `password == "123456" || password == "admin" || password.empty()` trong [auth.cpp:241](file:///X:/My%20Drive/Code%20dev/cybernexus-os/shared/src/auth.cpp#L241) và [L289](file:///X:/My%20Drive/Code%20dev/cybernexus-os/shared/src/auth.cpp#L289) (chỉ giữ kiểm tra hash Bcrypt/SHA-256 hoặc cơ chế bootstrap lần đầu khi DB hoàn toàn chưa có admin); thêm bộ đếm khóa tạm thời 5 phút sau 5 lần đăng nhập/PIN sai theo IP + username.
- **`SEC-17`**: Xây dựng `shared/include/upload_guard.hpp` bắt buộc cho mọi điểm upload:
  1. Chuẩn hóa tên file bằng UUID ngẫu nhiên (không dùng tên file gốc làm path), kiểm tra `fs::weakly_canonical` nằm trọn trong thư mục upload/packages.
  2. Whitelist cứng đuôi file + **kiểm tra Magic Bytes thực tế** (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF..WEBP`, MP4 `ftyp`, MP3 `ID3`/`FF FB`, FLAC `fLaC`, OGG `OggS`, WAV `RIFF..WAVE`, PDF `%PDF-`; cấm tuyệt đối `.svg`, `.html`, `.js`, `.exe`, `.bat`, `.ps1`, `.dll`).
  3. Giới hạn dung lượng theo loại file (ảnh `<= 10MB`, PDF `<= 15MB`, nhạc `<= 30MB`, video QC `<= 100MB`) và đặt `svr.set_payload_max_length(...)`.
- **`SEC-18`**: Xây dựng `shared/include/rate_limiter.hpp` (Token Bucket theo IP + hành động, trả HTTP `429`) kết hợp bảo vệ nghiệp vụ QR/Online:
  1. Chữ ký QR theo bàn: `HMAC-SHA256(table_id, secret_key)` nhúng trong link QR để không thể tự thay `&table_id=...` từ xa.
  2. Giới hạn đơn rác: tối đa `30` dòng món / đơn, `quantity <= 20` / món, tối đa `2` đơn `pending` đồng thời trên 1 IP trong `15` phút, lọc trùng đơn hệt nhau trong `60` giây, thêm `order_access_token` ngẫu nhiên cho `customer_mark_transfer`.
  3. Tùy chọn chỉ nhận QR Tại Bàn từ dải IP LAN / WiFi quán + nút **Chặn IP/SĐT spam 24h** & tự hủy đơn `awaiting_payment`/`awaiting_waiter` quá hạn (VD: sau 30 phút không thanh toán/xác nhận).
- **`SEC-19`**: Slave tự kiểm tra `web_integrity.json` lúc khởi động (cảnh báo về Master qua Tunnel nếu sai hash), áp dụng bảng phân quyền RBAC whitelist tập trung cho `/api/*`, và chặn private/loopback CIDR ở URL fetcher chống SSRF.

---

## 3. Công Cụ HTML Quản Trị / Tạo / Sửa / Duyệt Ngôn Ngữ + AI Tự Dịch (`I18N-07`, `I18N-08`)

### 3.1. Thực trạng
- Hiện hệ thống đã đồng bộ 548 khóa từ [SYSTEM_MESSAGES_I18N.csv](file:///X:/My%20Drive/Code%20dev/cybernexus-os/docs/SYSTEM_MESSAGES_I18N.csv) sang 8 file JSON `vi`/`en` thông qua [sync_i18n_csv_to_json.py](file:///X:/My%20Drive/Code%20dev/cybernexus-os/scripts/sync_i18n_csv_to_json.py).
- Tuy nhiên qua kiểm tra thực tế `SYSTEM_MESSAGES_I18N.csv` (VD: các dòng `03_master_web_ui.0001..0011` ở L20-L45), vẫn còn nhiều khóa cột `en` đang để nguyên tiếng Việt hoặc placeholder `Error (03_master_web_ui.0002): {error}`, chưa có màn hình HTML trực quan cho Quản lý/Biên tập viên tạo mới, sửa từng câu, duyệt chất lượng bản dịch và chưa hỗ trợ thêm ngôn ngữ mới (Trung, Nhật, Hàn, Thái...) bằng AI.

### 3.2. Thiết kế đề xuất
- **Tạo trang studio HTML trực quan:** `docs/16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html` (cùng giao diện Dark-Glass bảng cuộn, KPI, bộ lọc giống [13_BANG_THEO_DOI_KHUYET_TAT.html](file:///X:/My%20Drive/Code%20dev/cybernexus-os/docs/13_BANG_THEO_DOI_KHUYET_TAT.html)) + đồng bộ API backend `/api/i18n/*` trên Master/Slave:
  1. **Thanh xổ chọn cặp ngôn ngữ Nguồn → Đích:** Mặc định hỗ trợ `vi` (Tiếng Việt), `en` (English), `zh-CN` (中文), `ja` (日本語), `ko` (한국어), `th` (ภาษาไทย), `fr` (Français) + nút **"+ Thêm ngôn ngữ mới"** theo mã ISO.
  2. **CRUD & Duyệt từng câu (`I18N-07`):**
     - Lọc theo Nhóm (`01_Control_Center`, `03_Master_Web_UI`, `api`, `notif`, `pos`, `kds`, `waiter`, `admin`, `super_admin`...), trạng thái (`chưa dịch`, `chờ duyệt`, `đã duyệt`, `cảnh báo thiếu placeholder`), hoặc tìm kiếm nhanh theo khóa/nội dung.
     - Tạo khóa mới, sửa inline từng ô bản dịch, gắn trạng thái **`Duyệt` / `Hủy / Sửa lại`** cho từng câu, và **tự động kiểm tra bảo toàn tham số biến động** như `{version}`, `{table}`, `{error}`, `{amount}` (cảnh báo đỏ nếu AI hoặc người sửa làm mất `{...}`).
  3. **Công cụ AI tự dịch đa ngôn ngữ (`I18N-08`):**
     - Backend endpoint `POST /api/i18n/ai-translate` tái sử dụng `SaleApp::AI::geminiGenerateContentText` trong [gemini_client.hpp](file:///X:/My%20Drive/Code%20dev/cybernexus-os/shared/include/gemini_client.hpp) (và cho phép nhập trực tiếp Gemini API key ngay trên HTML nếu mở file cục bộ không cần chạy server) với prompt chuyên ngành F&B / POS yêu cầu giữ nguyên tuyệt đối mọi placeholder `{...}`.
     - Hỗ trợ nút **"AI Dịch câu này"** trên từng dòng và **"AI Dịch hàng loạt (Batch 20 câu)"** cho các câu chưa dịch sang ngôn ngữ mới.
  4. **Xuất & Áp dụng đồng bộ:** Xuất trực tiếp file `SYSTEM_MESSAGES_I18N.csv` mở rộng và `<lang>.json` cho `master/locales/`, `master/web/locales/`, `slave/locales/`, `slave/web/locales/` để đóng gói OTA không cần sửa tay từng file JSON.

---

## 4. Form Chấm Công Web App & Tích Hợp Máy Chấm Công Hikvision DS-K1T343MX (`HR-07` .. `HR-09`)

### 4.1. Thực trạng
- **Web App:** Hiện chỉ có chấm công ngầm tự động khi nhân viên đăng nhập (`login` / `pin_login` → `ensureStaffCheckIn` tại [slave_handlers.cpp:1422](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L1422), [L1471](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/src/slave_handlers.cpp#L1471)), duy trì qua `heartbeat` (`L1517`), chốt khi `logout` (`L1535`), khi đóng ca `close_shift` kèm `also_checkout_attendance` (`L5881`) hoặc Quản lý bấm `manual_checkout` trên tab Realtime Staff ([admin_ops_kpi.js:1557](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/admin_ops_kpi.js#L1557)). **Chưa có form Check-in / Check-out độc lập** dành cho nhân viên không dùng máy POS cả ca (pha chế, tạp vụ, bảo vệ) và chưa chạy kiểm thử nghiệm thu giao diện thực tế tại quán.
- **Thiết bị Hikvision:** Qua rà soát toàn bộ mã nguồn, hệ thống **chưa có 0% code** kết nối thiết bị chấm công Hikvision (ISAPI / AccessControllerEvent).

### 4.2. Thiết kế & Lộ trình triển khai (`HR-07`, `HR-08`, `HR-09`)

1. **Form Chấm Công Web App & Kiosk Quầy (`HR-07`):**
   - Xây dựng trang độc lập `slave/web/attendance.html` (và nút nhanh trên POS / Staff) với 2 chế độ:
     - *Chế độ Cá nhân:* Nhân viên đã đăng nhập xem trạng thái ca hôm nay (Giờ vào, thời lượng đang làm, giờ ra gần nhất, lịch sử 7 ngày) và bấm nút lớn **CHECK-IN VÀO CA** / **CHECK-OUT RA CA** + ghi chú nhanh.
     - *Chế độ Kiosk Quầy:* Đặt 1 máy tính bảng/PC cố định ở quầy; nhân viên chọn tên hoặc nhập Mã NV + **PIN 6 số**, tùy chọn chụp ảnh **Selfie đối chiếu** từ webcam + kiểm tra kết nối đúng dải LAN/WiFi quán + khóa bấm đúp trong 3 phút (`debounce`).
2. **Tích hợp Thiết bị Hikvision DS-K1T343MX (`HR-08`):**
   - Giao thức chuẩn của dòng máy chấm công khuôn mặt/vân tay/thẻ **Hikvision DS-K1T343MX** là **ISAPI qua HTTP/HTTPS (Digest Auth)**:
     - **Quản lý thiết bị (`attendance_devices`):** Lưu `name`, `ip`, `port` (80/443), `username`, `password_enc`, `serial_no`, `push_secret` + nút **"Test Kết Nối"** gọi `GET /ISAPI/System/deviceInfo` để xác nhận model, serial và đồng bộ đồng hồ NTP `PUT /ISAPI/System/time`.
     - **Đồng bộ Nhân viên → Máy Hikvision:** Đẩy danh sách nhân viên (`user_code` → `employeeNo`, `fullname` → `name`) qua `POST /ISAPI/AccessControl/UserInfo/Record?format=json` và đẩy ảnh đại diện khuôn mặt qua `POST /ISAPI/Intelligent/FDLib/FaceDataRecord?format=json`.
     - **Nhận dữ liệu chấm công 2 chiều (chống mất dữ liệu khi rớt mạng):**
       1. *Real-time Event Listening Server (Push):* Thiết bị Hikvision cấu hình HTTP Listening Host đẩy `AccessControllerEvent` + ảnh chụp khuôn mặt về endpoint `POST /api/attendance/hikvision/event` trên Slave ngay khi nhân viên quẹt mặt/thẻ (< 1 giây).
       2. *Background Scheduled Poll (Pull bù đắp):* Cứ mỗi 5 phút (hoặc khi bấm "Đồng bộ ngay"), Slave gọi `POST /ISAPI/AccessControl/AcsEvent?format=json` với khoảng thời gian từ lần đồng bộ cuối đến hiện tại để kéo bù mọi lượt quẹt khi máy bị mất điện/đứt mạng LAN.
     - Lưu mọi bản ghi gốc vào bảng `attendance_raw_logs (device_id, employee_no, event_time, major_type=5, sub_type, device_serial_no, picture_path, processed)` với khóa duy nhất `UNIQUE(device_id, device_serial_no)` chống trùng tuyệt đối.
3. **Hợp nhất đa nguồn Web + Hikvision & Chống ghi đè sai (`HR-09`):**
   - Quy trình chuyển đổi từ `attendance_raw_logs` sang `attendances`:
     - Lần quẹt hợp lệ đầu tiên khi chưa có dòng `status = 'working'` → tạo Check-in (`source = 'hikvision_face'`, kèm `checkin_photo`).
     - Lần quẹt hợp lệ sau tối thiểu 10 phút (tránh quẹt nhầm 2 lần liên tiếp trước camera khi đi qua cửa) → chốt Check-out (`source_out = 'hikvision_face'`) và chạy `computeAttendancePay(...)` tính giờ chuẩn + tăng ca (OT).
   - Bảo vệ nguồn sinh trắc học: Khi nhân viên đã có Check-in từ `hikvision_face`, các tiến trình `ensureStaffCheckIn`/`heartbeat`/`autoProcessShifts` của Web POS **tuyệt đối không tự ý tạo dòng trùng hay tự động đóng ca trái với dữ liệu máy chấm công** (chỉ bổ sung nếu hết thời gian ân hạn theo cấu hình).
   - Bảng chấm công & Quản lý nhân sự (`admin.html`) hiển thị cột **Nguồn chấm công** (`Hikvision Face`, `Web Kiosk`, `POS Login`, `Admin Sửa`) và cho phép bấm xem ảnh chụp khuôn mặt đối chiếu khi cần kiểm toán.

---

## 5. Tổng Hợp 14 Hạng Mục Đã Nạp Vào Bảng Theo Dõi Để Chờ Duyệt

| Mã | Nhóm | Ưu tiên | Trạng thái kỹ thuật | Nội dung chính |
|---|---|---|---|---|
| **PAY-01** | Thanh toán & Két tiền | P0 | Chưa xử lý (`todo`) | Điều khiển mở két tiền ESC/POS chuẩn theo phương thức thanh toán (Mở khi Tiền mặt; KHÓA với CK, Thẻ POS, Tạm tính, In lại; No-Sale cần lý do + PIN) |
| **PAY-02** | Thanh toán & Két tiền | P0 | Chưa xử lý (`todo`) | Khóa xác thực RBAC trên `handleOrders`, bắt buộc giá sản phẩm từ Server DB, Audit xóa món `save_order`, PIN Quản lý khi giảm giá vượt ngưỡng |
| **PAY-03** | Thanh toán & Két tiền | P0 | Chưa xử lý (`todo`) | Xử lý thanh toán lỗi & Idempotency: phục hồi/hủy tự động nếu thẻ `APPROVED` mà `checkout` lỗi, lưu `card_tx_ref`, xóa `ORDER_PAID` kép, Split Payment & đối soát VietQR |
| **PAY-04** | Thanh toán & Két tiền | P1 | Chưa xử lý (`todo`) | Chặn kết ca khi còn `refund_due`/`extra_due`, API đổi phương thức thanh toán có PIN Admin, chỉ số gian lận kết ca |
| **PAY-05** | Thanh toán & Két tiền | P1 | Chưa xử lý (`todo`) | Setup Form In Hóa Đơn tùy chỉnh (khổ 80mm/58mm, khoảng cách dòng/món/khối, cỡ chữ, lề, ẩn/hiện trường, Live Preview & In thử đồng bộ POS/Admin) |
| **SEC-16** | Chống Mã độc & Spam | P0 | Chưa xử lý (`todo`) | Xóa ngay backdoor mật khẩu `123456`/`admin`/`""` trong `auth.cpp` & thêm Brute-Force Rate Limit Login/PIN |
| **SEC-17** | Chống Mã độc & Spam | P0 | Chưa xử lý (`todo`) | Upload Guard whitelist đuôi + Magic Bytes + UUID + chặn Path Traversal & giới hạn dung lượng payload cho Slave & Master |
| **SEC-18** | Chống Mã độc & Spam | P0 | Chưa xử lý (`todo`) | Chống spam đơn rác QR/Online: Token Bucket Rate Limit 429, HMAC QR bàn, giới hạn `qty`/số đơn/IP & tự hủy đơn ảo |
| **SEC-19** | Chống Mã độc & Spam | P1 | Chưa xử lý (`todo`) | Tự xác minh `web_integrity.json` lúc khởi động, siết RBAC `/api/*` đồng nhất & chống SSRF dải IP nội bộ |
| **I18N-07** | Đa ngôn ngữ (i18n) | P1 | Chưa xử lý (`todo`) | Form HTML quản trị/tạo/sửa/duyệt từng câu i18n (`16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html`), chọn ngôn ngữ bằng thanh xổ & kiểm tra `{placeholder}` |
| **I18N-08** | Đa ngôn ngữ (i18n) | P1 | Chưa xử lý (`todo`) | Tích hợp AI tự dịch (`POST /api/i18n/ai-translate` qua Gemini) sang ngôn ngữ mới hàng loạt & xuất CSV/JSON đồng bộ Master/Slave |
| **HR-07** | Chấm công & Hikvision | P1 | Chưa xử lý (`todo`) | Form Web Check-in / Check-out độc lập (`attendance.html` chế độ Cá nhân + Kiosk PIN 6 số + Selfie + LAN check) & kiểm thử nghiệm thu |
| **HR-08** | Chấm công & Hikvision | P1 | Chưa xử lý (`todo`) | Tích hợp máy chấm công Hikvision DS-K1T343MX (ISAPI Digest Auth, Push Event + Pull bù 5 phút, đồng bộ NV/Khuôn mặt, `attendance_raw_logs`) |
| **HR-09** | Chấm công & Hikvision | P1 | Chưa xử lý (`todo`) | Hợp nhất đa nguồn Web + Hikvision vào `attendances` chống ghi đè sai ca, lọc quẹt trùng 10 phút & hiển thị nguồn/ảnh trên Admin |
