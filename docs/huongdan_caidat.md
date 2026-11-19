# Hướng Dẫn Cài Đặt, Kích Hoạt, Bảo Trì & Xử Lý Sự Cố — CyberNexus OS v2.3

Tài liệu chuẩn hóa dành cho kỹ thuật viên triển khai mới, bảo hành, bảo trì định kỳ và xử lý nhanh các sự cố thực tế tại quán và trên máy chủ Master (phiên bản **v2.3.0** — không sử dụng cửa sổ CMD hay file `.bat`).

---

## Phần I. Quy Trình Tạo, Đóng Gói & Kích Hoạt Quán Mới (4 Bước)

### Bước 1: Tạo Quán & Cấp License Key trên Master
1. Trên máy chủ Master, mở **`CyberNexus_Control_Center.exe`** (icon dải lụa `CN Ribbon Flow`) → bấm **`Mở Web`** ở thẻ **CyberNexus Master SaaS** (hoặc truy cập `http://localhost:8500/super_admin`).
2. Vào danh sách **Cửa Hàng / Quán** → bấm **Thêm Quán Mới** *(hoặc vào **Đại Lý Phân Phối → Cấp Key** nếu cấp qua đại lý)*:
   - Điền **Mã quán** (ví dụ: `GP002`), **Tên quán**, **Chủ quán / SĐT / Email đăng ký** *(dùng để đối chiếu khi xin reset PIN)*, **Thời hạn gói**.
   - Tick chọn danh sách trong **18 Modules bản quyền** được phép sử dụng.
   - Thiết lập **Hạn mức AI Credit** (`50` mặc định, `-1` = không giới hạn, `0` = tắt AI).
3. Lưu lại → hệ thống tự sinh **License Key** riêng (dạng `CBNX-XXXX-XXXX-XXXX-XXXX`) và **sinh ngẫu nhiên 1 mã PIN mặc định 6 số** cho chủ quán (lưu dạng `SHA-256` + bản mã hóa theo `license_key` trên Master).

### Bước 2: Đóng Gói Bộ Cài Đặt 1-Click (`.EXE` hoặc `.ZIP`)
- **Cách A — 1-Click Đóng Gói riêng cho từng quán trên Super Admin (Khuyên dùng):**
  1. Tại dòng của quán vừa tạo, mở hộp thoại **Hồ Sơ & Đóng Gói Cài Đặt (SOP-09)**.
  2. Bấm **`Đóng Gói Release (.ZIP & Setup .EXE)`** — Master tự động đóng gói `CyberNexus_Control_Center.exe`, `cybernexus_slave.exe`, các module `.dll` đã ký số `.sig`, bộ giao diện web (`web_integrity.json`), DB sạch, `License Key` riêng và file **`DEFAULT_OWNER_PIN.txt`** (chứa 6 số PIN mặc định của chủ quán).
  3. Tải file **`CyberNexus_POS_Setup_<MÃ_QUÁN>.exe`** (hoặc bản `.zip` dự phòng) gửi sang máy quán.
- **Cách B — Dùng bộ cài chuẩn `v2.3`:**
  - **Máy Master:** Chạy **`release/CyberNexus_Master_Setup_v2.3.exe`** (hoặc giải nén `release/master_v2.3.zip`).
  - **Máy Quán (Store):** Chạy **`release/CyberNexus_Store_Setup_v2.3.exe`** (hoặc giải nén `release/cybernexus-store_v2.3.zip`).

### Bước 3: Cài Đặt Tự Động, Khởi Chạy & Kích Hoạt Bản Quyền Tại Máy Quán
1. Tại máy quán, chạy thẳng file **`CyberNexus_POS_Setup_<MÃ_QUÁN>.exe`** (hoặc `CyberNexus_Store_Setup_v2.3.exe`):
   - Bấm **YES** để cài vào thư mục mặc định (`D:\CyberNexus_POS` hoặc `C:\CyberNexus_POS`), hoặc **NO** để chọn thư mục khác.
   - Theo dõi thanh tiến trình `0% → 100%`: bộ cài tự động dừng tiến trình cũ (nếu có), giải nén toàn bộ hệ thống, **tự mở Windows Firewall cổng `8501`**, **tạo Shortcut `CyberNexus Control Center` ngoài Desktop** và tự mở **`CyberNexus_Control_Center.exe`**.
   - Control Center chạy ngầm `cybernexus_slave.exe` (không hiện CMD đen), thu gọn xuống khay hệ thống (System Tray) khi đóng cửa sổ.
2. **Đăng nhập lần đầu bằng PIN 6 số mặc định:**
   - Bấm **`Mở Web`** (hoặc vào `http://localhost:8501/login.html`).
   - Mở file **`DEFAULT_OWNER_PIN.txt`** trong thư mục cài đặt quán, nhập **6 số PIN mặc định** để đăng nhập **1 lần duy nhất**.
   - Ngay khi vào trang Quản trị (`admin.html`), hệ thống bắt buộc đổi sang **PIN 6 số mới** *(không được phép trùng với PIN mặc định ban đầu)*.
3. **Kết nối Master & Kích hoạt License Key:**
   - Vào **Cài Đặt Hệ Thống → `Master WAN`**: nhập URL Master (ví dụ: `http://hungtien.net:8500` hoặc IP LAN của Master), tick **Bật kênh WAN** → bấm **`Lưu & Kết Nối Lại Master`** (hiện badge xanh `Đang Online (Master OK)`).
   - Vào mục **Bản Quyền (License)** → dán **License Key** → bấm **Kích Hoạt**. Master tự động khóa phần cứng (**Hardware Node-Lock**) theo `Machine ID` của máy quán và đồng bộ đủ module + AI Quota.

### Bước 4: Thiết Lập Vận Hành Ban Đầu & Nghiệm Thu
1. **IP LAN & Mã QR Bàn (`Cài Đặt → Quán & Slide`):** Chọn đúng card mạng LAN/Wi-Fi vật lý của máy quán → Lưu để toàn bộ mã QR Bàn dùng đúng IP LAN (tránh `localhost`).
2. **Thanh toán VietQR (`Cài Đặt → VietQR & Bank`):** Nhập Ngân hàng, Số tài khoản, Chủ tài khoản để khách quét mã thanh toán tự động.
3. **Kiểm tra Toàn vẹn & OTA 1 chạm trên `CyberNexus_Control_Center.exe`:**
   - Bấm **`🛡 Kiểm tra Port & Code`** để xác nhận: Port `8501` thông suốt, `5/5` DLL `.sig` hợp lệ, Web Code SHA-256 chuẩn (`0` file sửa/thiếu) và SQLite `ok`.
   - Bấm **`☁ Kiểm tra Update`** để kiểm tra & cập nhật thẳng lên bản OTA mới nhất từ Master mà không cần mở trình duyệt.

---

## Phần II. Bảo Hành, Bảo Trì Định Kỳ & Công Cụ Quản Trị Mật Khẩu

### 1. Kiểm Tra Sức Khỏe Nhanh Hằng Tuần / Tháng (qua Control Center)
1. Mở **`CyberNexus_Control_Center.exe`** từ khay hệ thống (System Tray).
2. Bấm **`🛡 Kiểm tra Port & Code`**:
   - **Port:** Đảm bảo `8500` (Master) và `8501` (Slave) do `cybernexus_*.exe` nắm giữ.
   - **DLL `.sig`:** Phải đạt **`5/5 Hợp lệ`** (`libmod_pos_core`, `libmod_finance_admin`, `libmod_media_stream`, `libmod_network_qos`, `libmod_card_payment`).
   - **Web Code SHA-256:** Phải báo **`chuẩn` (`0` file sửa, `0` file thiếu)**.
   - **SQLite:** Phải báo **`ok`**.
3. Kiểm tra **Live Smart Console** (chọn bộ lọc **`Chỉ xem Lỗi`**) để phát hiện sớm lỗi mạng, kết nối Router/UniFi hoặc ổ cứng.

### 2. Quản Lý & Khôi Phục Mật Khẩu / PIN 6 Số
- **Chủ quán quên mật khẩu / PIN:**
  1. Chủ quán gửi email **từ đúng địa chỉ email đã đăng ký** cho SuperAdmin.
  2. SuperAdmin đối chiếu đúng email → bấm nút **`🛡 Reset PIN 6 số`** trên dòng của quán tại Super Admin.
  3. Master gửi lệnh `RESET_OWNER_PIN` xuống máy quán → máy quán tự tạo lại file `DEFAULT_OWNER_PIN.txt` và bật **chấm xanh (`●`) + nút `● Mở File PIN 6 Số`** trên **`CyberNexus_Control_Center.exe`** *(tuyệt đối không hiển thị trên `login.html`)*. Chủ quán bấm mở file để lấy lại 6 số đăng nhập 1 lần và đổi PIN mới.
- **Chủ quán reset cho nhân viên:** Sau khi có PIN 6 số hợp lệ, chủ quán vào **Quản trị Quán → Nhân sự** để đổi mật khẩu và PIN 6 số cho toàn bộ nhân viên (`bep`, `thungan`, `phucvu`).
- **Nhà phát triển / Master quản trị hoặc quên mật khẩu SuperAdmin (`CyberNexus_Vault_Admin.exe`):**
  - Sử dụng tool riêng **`CyberNexus_Vault_Admin.exe`** *(chỉ lưu nội bộ trên máy Master/USB kỹ thuật, tuyệt đối không gửi cho quán)*, bảo vệ bằng **Master Recovery Key** (`vault_admin.key`).
  - Hỗ trợ 3 chức năng: đọc/tạo/đổi mật khẩu `SuperAdmin` & nhân viên Master; xem/sinh lại PIN 6 số mặc định của từng quán; và cứu hộ trực tiếp file `store_local.db` khi máy quán mất mạng.

### 3. Sao Lưu, Cập Nhật OTA & Mốc Khôi Phục
- **Sao lưu định kỳ:** Bấm **`■ Dừng`** trên `CyberNexus_Control_Center.exe` trước khi copy `database/store_local.db` + `uploads/` (máy Quán) hoặc `database/cybernexus_master.db` + `updates/` + `packages/` (máy Master).
- **Cập nhật OTA:** Quán có thể cập nhật trực tiếp qua nút **`☁ Kiểm tra Update`** trên `CyberNexus_Control_Center.exe` hoặc từ **Quản trị Quán**; hệ thống tự gắn header `no-cache` cho JS/CSS nên máy khách/POS không cần nhấn `Ctrl + F5`.
- **Mốc khôi phục chuẩn:** Git tag **`v2.3.0`**; bộ cài đặt đầy đủ lưu tại `release/` (`CyberNexus_Master_Setup_v2.3.exe`, `CyberNexus_Store_Setup_v2.3.exe`, `master_v2.3.zip`, `cybernexus-store_v2.3.zip`, `store_patch_update_v2.3.zip`).

---

## Phần III. Sổ Tay Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| STT | Hiện tượng lỗi | Nguyên nhân gốc rễ | Cách xử lý chuẩn |
| :---: | :--- | :--- | :--- |
| **1** | **`Machine ID không khớp với bản quyền đã kích hoạt!`** | Quán đổi sang máy tính khác, thay phần cứng hoặc chép bộ cài từ máy khác sang. | Vào **Super Admin Master** → tìm đúng quán → bấm **`Reset Machine ID`** (`reset_hardware_lock`) → quay lại máy quán kích hoạt/ping lại. |
| **2** | **Không khởi chạy được Master/Slave, báo đụng Port `8500`/`8501`** | Tiến trình cũ bị treo hoặc phần mềm khác chiếm cổng `8500`/`8501`. | Trên **`CyberNexus_Control_Center.exe`**, bấm **`🛡 Kiểm tra Port & Code`** → xem PID/tên `.exe` đang chiếm port → bấm **`Giải phóng Port`** → bấm **`▶ Khởi chạy`**. |
| **3** | **Điện thoại khách quét QR bàn không truy cập được / ra `localhost`** | Cấu hình QR đang lấy `localhost` hoặc Windows Firewall chặn cổng `8501`. | 1) Vào **Quản trị Quán → Cài Đặt → Quán & Slide** → chọn đúng card **IP LAN thật** và Lưu.<br>2) Đảm bảo rule Windows Firewall cổng `8501` đã mở (bộ cài `.EXE` tự mở sẵn; nếu bị tắt, chạy lại Setup hoặc mở Inbound TCP `8501` trong Windows Defender Firewall).<br>3) Điện thoại và máy thu ngân phải chung mạng LAN/Wi-Fi. |
| **4** | **Báo lỗi sai chữ ký `.sig` hoặc Web Code bị sửa/thiếu file** | Có người chỉnh sửa nhầm file HTML/JS/DLL hoặc copy thiếu file. | Bấm **`☁ Kiểm tra Update`** trên **`CyberNexus_Control_Center.exe`** (hoặc chạy lại bộ cài `.EXE` chuẩn) rồi kiểm tra lại bằng **`🛡 Kiểm tra Port & Code`**. |
| **5** | **AI Tạo Ảnh báo hết quota (`limit: 0`) hoặc sai món Việt** | Key Gemini Free bị khóa tạo ảnh (`limit: 0`), hoặc AI sinh sai món Việt. | - Dùng nút **`Tìm & Đồng Bộ Ảnh`** ngay trong hộp thoại món (**0 AI Token**, chọn từ 6 ảnh thật, đổi từ khóa hoặc bấm **`Ảnh khác`**, tự cân sáng & cắt `640×480` theo Menu Style DNA).<br>- Kiểm tra **Master AI Vault** trên Super Admin xem key pool & hạn mức AI Credit của quán. |
| **6** | **Kênh `Master WAN` báo Offline / Không kiểm tra được OTA** | Sai URL Master, máy Master chưa mở port `8500`/Cloudflare Tunnel, hoặc mất mạng. | Kiểm tra máy Master cổng `8500` đang chạy trên Control Center; kiểm tra lại URL tại **Cài Đặt → `Master WAN`** trên máy quán rồi bấm **`Lưu & Kết Nối Lại Master`**. |
| **7** | **Không đăng nhập được bằng PIN trên `login.html` (báo sai PIN 6 số)** | Chưa nhập đủ 6 số, hoặc đã dùng PIN mặc định 1 lần hết hiệu lực, hoặc đang dùng bản web 4 chấm cũ. | - Dùng **`☁ Kiểm tra Update`** ngay trên `CyberNexus_Control_Center.exe` để cập nhật bản mới (không cần đăng nhập web).<br>- Nếu quên PIN chủ quán: gửi email đã đăng ký cho SuperAdmin bấm **`Reset PIN 6 số`**, rồi bấm **`● Mở File PIN 6 Số`** trên Control Center. |
| **8** | **Lỗi CSDL SQLite (`database disk image is malformed` / `database is locked`)** | Cúp điện đột ngột khi đang ghi DB hoặc có 2 tiến trình chạy song song giữ file DB. | 1) Vào **`CyberNexus_Control_Center.exe`** bấm **`■ Dừng`** dịch vụ.<br>2) Bấm **`🛡 Kiểm tra Port & Code`** kiểm tra `PRAGMA quick_check`.<br>3) Nếu file `.db` hỏng nặng, khôi phục từ bản backup gần nhất hoặc cứu hộ bằng `CyberNexus_Vault_Admin.exe`. |
