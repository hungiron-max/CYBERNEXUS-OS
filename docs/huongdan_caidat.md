# Hướng Dẫn Cài Đặt, Kích Hoạt, Bảo Trì & Xử Lý Sự Cố — CyberNexus OS v2.1

Tài liệu chuẩn hóa dành cho kỹ thuật viên triển khai mới, bảo hành, bảo trì định kỳ và xử lý nhanh các sự cố thực tế tại quán và trên máy chủ Master.

---

## Phần I. Quy Trình Tạo, Đóng Gói & Kích Hoạt Quán Mới (4 Bước)

### Bước 1: Tạo Quán & Cấp License Key trên Master
1. Trên máy chủ Master, chạy `CyberNexus_Control_Center.exe` → bấm **`Mở Web`** ở thẻ **CyberNexus Master SaaS** (hoặc truy cập `http://localhost:8500/super_admin`).
2. Vào danh sách **Cửa Hàng / Quán** → bấm **Thêm Quán Mới** *(hoặc vào **Đại Lý Phân Phối → Cấp Key** nếu cấp qua đại lý)*:
   - Điền **Mã quán** (ví dụ: `GP002`), **Tên quán**, **Chủ quán / SĐT**, **Thời hạn gói**.
   - Tick chọn danh sách trong **18 Modules bản quyền** được phép sử dụng.
   - Thiết lập **Hạn mức AI Credit** (`50` mặc định, `-1` = không giới hạn, `0` = tắt AI).
3. Lưu lại → hệ thống tự sinh **License Key** riêng (dạng `CBNX-XXXX-XXXX-XXXX-XXXX`).

### Bước 2: Đóng Gói Bộ Cài Đặt Cho Quán (chọn 1 trong 2 cách)
- **Cách A — 1-Click Đóng Gói theo từng quán trên Super Admin (Khuyên dùng):**
  1. Tại dòng của quán vừa tạo, mở hộp thoại **Hồ Sơ & Đóng Gói Cài Đặt (SOP-09)**.
  2. Bấm **`Đóng Gói Release (.ZIP)`** — Master tự động đóng gói `cybernexus_slave.exe`, 5 module `.dll` đã ký số `.sig`, bộ giao diện web, cấu hình và gắn sẵn **License Key** vào thư mục `master/packages/<MÃ_QUÁN>/`.
  3. Chép file ZIP này sang máy quán và giải nén (ví dụ: `D:\CyberNexus_POS\`).
- **Cách B — Dùng bộ cài chuẩn `v2.1`:**
  1. Giải nén `release/cybernexus-store_v2.1.zip` vào máy quán (ví dụ: `D:\CyberNexus_POS\`).
  2. Đảm bảo trong thư mục quán có `CyberNexus_Control_Center.exe` (nằm cạnh `cybernexus_slave.exe`) và `web/web_integrity.json` để kiểm tra toàn vẹn.

### Bước 3: Khởi Chạy & Kích Hoạt Bản Quyền Tại Máy Quán
1. Tại máy quán, chạy thẳng **`CyberNexus_Control_Center.exe`** *(không dùng cửa sổ CMD `.bat` để tránh thu ngân tắt nhầm hoặc QuickEdit làm treo server)*:
   - Control Center tự chạy ngầm `cybernexus_slave.exe` trên cổng `8501` và thu gọn xuống khay hệ thống (System Tray) khi đóng cửa sổ.
   - Bấm **`Mở Web`** (hoặc vào `http://localhost:8501/admin.html`) và đăng nhập tài khoản Quản trị.
2. **Kết nối về Master:**
   - Vào **Cài Đặt Hệ Thống → `Master WAN`**: nhập URL Master (ví dụ: `http://hungtien.net:8500` hoặc IP LAN của Master), tick **Bật kênh WAN** → bấm **`Lưu & Kết Nối Lại Master`** cho đến khi hiện badge xanh `Đang Online (Master OK)`.
3. **Kích hoạt License Key:**
   - Vào mục **Bản Quyền (License)** → dán **License Key** đã tạo ở Bước 1 → bấm **Kích Hoạt**.
   - Master tự động khóa phần cứng (**Hardware Node-Lock**) theo `Machine ID` của máy quán đó và đồng bộ đủ các module + AI Quota xuống máy trạm.

### Bước 4: Thiết Lập Vận Hành Ban Đầu & Nghiệm Thu
1. **IP LAN & Mã QR Bàn (`Cài Đặt → Quán & Slide`):** Chọn đúng card mạng LAN/Wi-Fi vật lý của máy quán → Lưu để toàn bộ mã QR Bàn dùng đúng IP LAN (tránh lỗi `localhost`).
2. **Thanh toán VietQR (`Cài Đặt → VietQR & Bank`):** Nhập Ngân hàng, Số tài khoản, Chủ tài khoản để khách quét mã thanh toán tự động.
3. **Cập nhật OTA & Kiểm tra Toàn vẹn 1 chạm:**
   - Nếu máy quán chưa ở bản mới nhất, bấm **Kiểm tra & Cập nhật OTA** trong **Quản trị Quán**.
   - Trên **`CyberNexus_Control_Center.exe`**, bấm **`🛡 Kiểm tra Port & Code`** để xác nhận: Port `8501` thông suốt, `5/5` DLL `.sig` hợp lệ, bộ Web SHA-256 chuẩn và SQLite `ok`.

---

## Phần II. Hướng Dẫn Bảo Hành & Bảo Trì Định Kỳ

### 1. Kiểm Tra Sức Khỏe Nhanh Hằng Tuần / Tháng (qua Control Center)
1. Mở **`CyberNexus_Control_Center.exe`** từ khay hệ thống (System Tray).
2. Bấm **`🛡 Kiểm tra Port & Code`**:
   - **Port:** Đảm bảo `8500` (Master) và `8501` (Slave) do tiến trình `cybernexus_*.exe` nắm giữ.
   - **DLL `.sig`:** Phải đạt **`5/5 Hợp lệ`** (`libmod_pos_core`, `libmod_finance_admin`, `libmod_media_stream`, `libmod_network_qos`, `libmod_card_payment`).
   - **Web Code SHA-256:** Phải báo **`chuẩn` (`0` file sửa, `0` file thiếu)**.
   - **SQLite:** Phải báo **`ok`**.
3. Kiểm tra **Live Smart Console** (chọn bộ lọc **`Chỉ xem Lỗi`**) để phát hiện sớm lỗi mạng, lỗi kết nối Router/UniFi hoặc lỗi ổ cứng.

### 2. Sao Lưu & Phục Hồi Dữ Liệu (Backup & Restore)
- **Dữ liệu cần sao lưu định kỳ (hằng ngày/tuần):**
  - **Máy Quán:** `database/store_local.db` và thư mục `uploads/` (ảnh món ăn, slide, chứng từ).
  - **Máy Master:** `database/cybernexus_master.db`, thư mục `updates/` và `packages/`.
- **Lưu ý quan trọng trước khi copy file `.db`:** Nên bấm **`■ Dừng`** dịch vụ trên `CyberNexus_Control_Center.exe` trước khi sao lưu/khôi phục file `.db` để tránh kẹt file WAL (`-wal` / `-shm`).
- **Mốc khôi phục mã nguồn chuẩn:** Đã gắn Git tag **`v2.1.0`** trên kho lưu trữ; các gói cài đặt hoàn chỉnh lưu tại `release/` (`master_v2.1.zip`, `cybernexus-store_v2.1.zip`, `store_patch_update_v2.1.zip`).

### 3. Quy Trình Bảo Hành Khi Nâng Cấp Bản Vá OTA
1. Trên Master, vào **Super Admin → Kho Lưu Trữ & Quản Lý Bản Vá OTA** để kiểm tra phiên bản mới nhất (`master/updates/manifest.json`).
2. Có thể đẩy OTA đồng loạt hoặc từng quán; sau khi quán cập nhật xong, đối chiếu lại badge phiên bản trên header **Quản trị Quán**.

---

## Phần III. Sổ Tay Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| STT | Hiện tượng lỗi | Nguyên nhân gốc rễ | Cách xử lý chuẩn |
| :---: | :--- | :--- | :--- |
| **1** | **`Machine ID không khớp với bản quyền đã kích hoạt!`** | Quán đổi sang máy tính khác, thay ổ cứng/mainboard hoặc chép bộ cài từ máy dev sang máy quán. | Vào **Super Admin Master** → tìm đúng quán → bấm **`Mở Khóa Phần Cứng`** (`reset_hardware_lock`) để xóa `machine_id` cũ → quay lại máy quán kích hoạt/ping lại. |
| **2** | **Không khởi chạy được Master/Slave, báo đụng Port `8500`/`8501`** | Tiến trình cũ bị treo hoặc phần mềm khác chiếm cổng `8500`/`8501`. | Trên **`CyberNexus_Control_Center.exe`**, bấm **`🛡 Kiểm tra Port & Code`** → xem PID/tên `.exe` đang chiếm port → bấm **`Giải phóng Port`** → bấm **`▶ Khởi chạy`**. |
| **3** | **Điện thoại khách quét QR bàn không truy cập được / ra `localhost`** | Cấu hình QR đang lấy `localhost` hoặc Windows Firewall chặn cổng `8501` trong mạng LAN. | 1) Vào **Quản trị Quán → Cài Đặt → Quán & Slide** → chọn đúng card **IP LAN thật** của máy quán và Lưu.<br>2) Chạy `Mo_Tuong_Lua_LAN.bat` (quyền Administrator) để mở cổng TCP `8501`.<br>3) Đảm bảo điện thoại và máy thu ngân cùng kết nối một mạng LAN/Wi-Fi. |
| **4** | **Báo lỗi sai chữ ký `.sig` hoặc Web Code bị sửa/thiếu file** | Có người chỉnh sửa nhầm file HTML/JS/DLL hoặc copy thiếu file khi nâng cấp. | Chạy lại cập nhật OTA bản chuẩn từ Master (hoặc chép đè lại bộ `modules/` + `web/` từ file ZIP `v2.1` sạch) rồi kiểm tra lại bằng **`🛡 Kiểm tra Port & Code`**. |
| **5** | **AI Tạo Ảnh báo hết quota (`limit: 0`) hoặc sai món Việt** | Key Gemini Free bị Google khóa tạo ảnh (`limit: 0`), hoặc AI sinh ảnh không khớp món Việt đặc thù. | - Dùng nút **`Tìm & Đồng Bộ Ảnh`** ngay trong hộp thoại chỉnh sửa món (**0 AI Token**, cho phép chọn từ 6 ảnh thật, đổi từ khóa hoặc bấm **`Ảnh khác`**, tự cân sáng và cắt `640×480` theo Menu Style DNA).<br>- Kiểm tra **Master AI Vault** trên Super Admin xem key pool & hạn mức AI Credit của quán (`-1` = không giới hạn). |
| **6** | **Kênh `Master WAN` báo Offline / Không cập nhật được OTA** | Sai URL Master, máy Master chưa mở port `8500` / chưa bật Cloudflare Tunnel, hoặc mất kết nối Internet. | Kiểm tra trên máy Master xem cổng `8500` đã chạy chưa; kiểm tra lại URL tại **Cài Đặt → `Master WAN`** trên máy quán rồi bấm **`Lưu & Kết Nối Lại Master`**. |
| **7** | **Nhân viên lỡ tay tắt phần mềm khi đang bán hàng** | Nếu chạy bằng cửa sổ CMD đen cũ, nhân viên dễ bấm nhầm `×` tắt server hoặc click chuột vào CMD làm treo tiến trình. | Chuyển sang dùng **`CyberNexus_Control_Center.exe`** — bấm nút `×` cửa sổ chỉ thu gọn xuống khay hệ thống, server vẫn chạy ngầm an toàn 24/7. |
| **8** | **Lỗi CSDL SQLite (`database disk image is malformed` hoặc `database is locked`)** | Cúp điện đột ngột khi đang ghi DB hoặc có 2 tiến trình `cybernexus_slave.exe` chạy song song. | 1) Vào **`CyberNexus_Control_Center.exe`** bấm **`■ Dừng`** toàn bộ tiến trình đang giữ DB.<br>2) Chạy **`🛡 Kiểm tra Port & Code`** kiểm tra `PRAGMA quick_check`.<br>3) Nếu file `.db` hỏng nặng, khôi phục từ bản backup gần nhất trong mục Bảo trì. |
