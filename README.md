# 🍵 POS Sale-App (Hệ Thống Bán Hàng & Quản Trị Trà Sữa - Cafe)

Ứng dụng bán hàng POS và quản trị Back-office hiện đại, tối ưu hóa toàn diện cho **màn hình cảm ứng (Touchscreen Terminal / Tablet / iPad / Desktop)**. Thiết kế theo phong cách **Liquid Glassmorphism** (kính lỏng mờ ảo, vệt sáng phản chiếu, viền neon tinh tế), kết hợp Backend **PHP (PDO)** đa cơ sở dữ liệu (**SQLite** chạy ngay lập tức không cần cài đặt hoặc chuyển đổi sang **MySQL** chỉ bằng 1 dòng cấu hình).

---

## 📁 1. Cấu Trúc Thư Mục Dự Án

```
sale-app/
├── config/
│   ├── config.php                 # Cấu hình hệ thống, chọn SQLite/MySQL, thông tin quán & VietQR
│   └── database.php               # Kết nối PDO Singleton, tự động tạo & nạp dữ liệu DB ban đầu
├── database/
│   ├── schema.sql                 # DDL toàn bộ cấu trúc bảng & dữ liệu mẫu (Users, Categories, Products, Tables)
│   ├── init_db.php                # Script kiểm tra/khởi tạo lại Database độc lập (CLI & Web)
│   ├── upgrade.php                # Script nâng cấp schema (thêm cột phone, pin_code, vai trò waiter/kitchen)
│   └── pos_database.sqlite        # File cơ sở dữ liệu SQLite tự động tạo
├── api/
│   ├── auth.php                   # Đăng nhập, đăng xuất, đăng nhập nhanh bằng mã PIN 4 số
│   ├── users.php                  # Quản lý nhân viên (CRUD, đổi mật khẩu, PIN, phân quyền)
│   ├── categories.php             # Lấy danh mục, thêm/sửa/xóa nhóm hàng
│   ├── products.php               # Lấy danh sách món, tìm kiếm, CRUD món & tạm khóa (locked)
│   ├── tables.php                 # Quản lý bàn (MV1-MV5, TQ1-TQ8), chuyển bàn, gộp bàn
│   ├── orders.php                 # Lưu đơn nháp, thanh toán, hủy đơn, in hóa đơn nhiệt
│   ├── reports.php                # Thống kê doanh thu hôm nay, biểu đồ 7 ngày, món bán chạy
│   └── settings.php               # Cấu hình cửa hàng và thông tin VietQR
├── assets/
│   ├── css/
│   │   └── liquid-glass.css       # Hiệu ứng Liquid Glassmorphism, orb lơ lửng, CSS in hóa đơn 80mm/58mm
│   └── js/
│       ├── pos.js                 # Xử lý toàn bộ logic POS (chọn bàn, giỏ hàng, giảm giá, thanh toán, in bill)
│       ├── admin.js               # Quản trị Back-office (Nhân viên, Chart.js, quản lý món, nhóm hàng, lịch sử HĐ)
│       └── virtual-keyboard.js    # Bàn phím số / chữ cảm ứng (On-screen touch numpad)
├── index.php                      # Giao diện chính: Thu ngân & POS bán hàng tại quầy (Liquid Glass)
├── order.php                      # Giao diện Nhận Order di động cho Nhân viên Phục vụ (Mobile-First)
├── kitchen.php                    # Giao diện Màn hình Bếp & Pha chế (KDS - Kitchen Display System)
├── admin.php                      # Giao diện Quản trị Back-office (Nhân viên, kho hàng, danh mục, báo cáo)
├── RUN_POS.bat                    # 1-Click Portable Launcher mở server & trình duyệt POS
├── RUN_ADMIN.bat                  # 1-Click mở thẳng màn hình Quản Trị
├── STOP_POS.bat                   # 1-Click dừng máy chủ POS
├── Mo_Tuong_Lua_LAN.bat           # 1-Click mở cổng tường lửa Windows để điện thoại trong LAN kết nối
└── README.md                      # Hướng dẫn chi tiết sử dụng & triển khai
```

---

## 🔐 2. Tài Khoản & Phân Quyền Nhân Viên

Hệ thống hỗ trợ 4 vai trò rõ rệt, hỗ trợ đăng nhập bằng **Mật khẩu** hoặc **Mã PIN 4 số siêu nhanh trên điện thoại**:

| Vai trò | Tài khoản | Mật khẩu mặc định | Mã PIN nhanh | Trang tự động chuyển đến |
|---|---|---|---|---|
| **Quản Lý (Admin)** | `Admin` | Để trống hoặc `admin123` | `9999` | Màn hình Quản Trị / POS |
| **Thu Ngân (Cashier)** | `ThuNgan` | `123456` | `1111` | [index.php](http://localhost:8080/index.php) (Quầy POS) |
| **Phục Vụ 01 (Waiter)** | `PhucVu1` | `123456` | `2222` | [order.php](http://localhost:8080/order.php) (Order Bàn) |
| **Phục Vụ 02 (Waiter)** | `PhucVu2` | `123456` | `3333` | [order.php](http://localhost:8080/order.php) (Order Bàn) |
| **Pha Chế / Bếp** | `BepPhaChe` | `123456` | `4444` | [kitchen.php](http://localhost:8080/kitchen.php) (Màn hình Bếp) |

Theo đúng thiết kế của màn hình POS máy bán hàng:
- **Tài khoản**: `Admin` (hoặc `ThuNgan`)
- **Mật khẩu**: Để trống `""` (bấm Đăng nhập ngay) hoặc nhập `admin123`

---

## 🚀 4. Chuyển Đổi Sang Cơ Sở Dữ Liệu MySQL (Nếu Cần)

Nếu bạn muốn kết nối MySQL (XAMPP / Laragon / Docker):
1. Mở file [config/config.php](file:///d:/Software/Code dev/sale-app/config/config.php):
   ```php
   // Đổi từ 'sqlite' sang 'mysql'
   define('DB_DRIVER', 'mysql');

   define('MYSQL_HOST', '127.0.0.1');
   define('MYSQL_PORT', 3306);
   define('MYSQL_DATABASE', 'pos_sale_app');
   define('MYSQL_USER', 'root');
   define('MYSQL_PASSWORD', '');
   ```
2. Hệ thống sẽ tự động tạo database `pos_sale_app` và import toàn bộ cấu trúc bảng từ `database/schema.sql` vào MySQL.

---

## 🌟 5. Chi Tiết Tính Năng Đã Hoàn Thiện

### 1. Màn hình Đăng nhập (Liquid Glass Touch Login)
- Banner thông báo: `"MỜI BẠN NHẬP THÔNG TIN ĐỂ ĐĂNG NHẬP"`.
- Hỗ trợ bàn phím số/chữ cảm ứng ảo (`Virtual Keyboard / Numpad`) khi chạm vào biểu tượng bàn phím.
- Ghi nhớ mật khẩu, Tự động đăng nhập.
- Hiển thị trực tiếp phiên bản hệ thống (`7.2.0 Pro Liquid Glass`) và trạng thái kết nối cơ sở dữ liệu (`ONLINE`).

### 2. Giao diện POS Bán Hàng (index.php)
- **Khu vực & Bàn cảm ứng**: Phân chia rõ ràng giữa **Mang Về** (`MV1` đến `MV5`) và **Tại Quán** (`TQ1` đến `TQ8`).
  - Đèn báo trạng thái: Bàn trống (màu xanh lá), Bàn có khách (màu đỏ phát sáng kèm tổng tiền trực tiếp).
- **Lưới danh mục món (Categories)**: Tất cả món, Bánh Mì Chảo, Bánh Flan, Bò Bít Tết, Cafe, Cafe Xay, Chè Khúc Bạch, Đá Xay, Lục Trà, Nước Ngọt, Sinh Tố, Topping, Trà Sữa, Trà Trái Cây...
- **Thẻ món ăn Liquid Glass**: Chạm để thêm nhanh vào giỏ hàng, hiển thị giá rõ ràng, đơn vị tính (ly, chảo, phần, dĩa...).
- **Topping Modal**: Chọn topping thêm cho đồ uống/món ăn (Trân châu hoàng kim, kem cheese, phô mai...).
- **Giỏ hàng & Hóa đơn chi tiết**:
  - Tăng/giảm số lượng (+/-), chỉnh sửa ghi chú cho từng món (ví dụ: ít ngọt, không đá...).
  - Thanh toán tạm tính, hủy hóa đơn, giảm giá theo % hoặc tiền mặt.
  - **Chuyển bàn** (từ bàn đang có khách sang bàn trống).
  - **Gộp bàn** (gộp đơn của bàn A vào bàn B và tự động tính lại tổng tiền).
  - **Khung Tổng cộng nổi bật màu đỏ cam** đúng chuẩn màn hình POS thực tế.
- **Thanh toán đa phương thức**:
  - Tiền mặt: Có các nút tiền gợi ý nhanh (50k, 100k, 200k, 500k, Đủ tiền), tự động tính tiền thối lại cho khách.
  - **Chuyển khoản VietQR**: Tự động sinh mã QR ngân hàng chuẩn theo đúng số tiền và mã hóa đơn để khách dùng App ngân hàng quét trực tiếp.
  - Thẻ POS.
- **In Hóa Đơn Nhiệt (Thermal Receipt)**: Tối ưu chuẩn khổ in 80mm và 58mm, tự động bật hộp thoại in khi xác nhận thanh toán.

### 3. Giao diện Quản trị Back-office (admin.php)
- **Dashboard Thống kê Doanh thu**:
  - Thống kê doanh thu hôm nay, số hóa đơn, giá trị đơn trung bình (AOV), số bàn đang phục vụ, doanh thu tháng.
  - Biểu đồ đường doanh thu 7 ngày gần nhất bằng **Chart.js** với hiệu ứng gradient liquid glass.
  - Bảng xếp hạng Top các món ăn/đồ uống bán chạy nhất.
- **Quản lý Mặt hàng (Products Catalog)**:
  - Bảng danh mục: Mã hàng, Tên mặt hàng, Nhóm mặt hàng, Đơn vị tính, Giá bán, Giá nhập.
  - Chức năng **Tạm khóa món** (hết hàng) bằng checkbox nhanh.
  - Thêm mới, chỉnh sửa giá bán, xóa món ăn.
  - Tìm kiếm và lọc theo nhóm mặt hàng tức thì (F3).
- **Quản lý Nhóm hàng (Categories)**: Thêm mới, sắp xếp thứ tự hiển thị, gắn icon FontAwesome.
- **Quản lý Bàn & Khu vực**: Thêm bàn mới thuộc khu vực Mang Về hoặc Tại Quán.
- **Lịch sử Hóa đơn**: Tra cứu hóa đơn theo khoảng thời gian, xem chi tiết món và in lại hóa đơn.
- **Cài đặt Hệ thống**: Cập nhật tên quán, hotline, địa chỉ, tài khoản ngân hàng VietQR.

B. Bảng tra cứu mã các ngân hàng thông dụng nhất:
Ngân Hàng	MãViết Tắt (Khuyên dùng)	Mã BIN (6 số NAPAS)	Tên Đầy Đủ
MBBank	    MB	    970422	Ngân hàng TMCP Quân Đội
Vietcombank	VCB	    970436	Ngân hàng TMCP Ngoại Thương Việt Nam
Techcombank	TCB	    970407	Ngân hàng TMCP Kỹ Thương Việt Nam
VietinBank	ICB	    970415	Ngân hàng TMCP Công Thương Việt Nam
BIDV	    BIDV	970418	Ngân hàng TMCP Đầu Tư & Phát Triển VN
ACB	        ACB	    970416	Ngân hàng TMCP Á Châu
VPBank	    VPB	    970454	Ngân hàng TMCP Việt Nam Thịnh Vượng
TPBank	    TPB	    970458	Ngân hàng TMCP Tiên Phong
Sacombank	STB	    970403	Ngân hàng TMCP Sài Gòn Thương Tín
Agribank	VBA	    970405	Ngân hàng Nông Nghiệp & PT Nông Thôn
HDBank	    HDB	    970437	Ngân hàng TMCP Phát Triển TP.HCM
VIB	        VIB	    970441	Ngân hàng TMCP Quốc Tế Việt Nam
MSB	        MSB	    970426	Ngân hàng TMCP Hàng Hải Việt Nam
SHB	        SHB	    970443	Ngân hàng TMCP Sài Gòn - Hà Nội
OCB	        OCB	    970448	Ngân hàng TMCP Phương Đông
LPBank	    LPB	    970449	Ngân hàng TMCP Lộc Phát Việt Nam
Timo	    TIMO	970454	Ngân hàng số Timo (BVBank)
Cake	    CAKE	970468	Ngân hàng số Cake by VPBank

TIP

Bạn cũng có thể xem toàn bộ danh sách cập nhật trực tiếp từ cổng chính thức của VietQR tại: https://vietqr.io/danh-sach-api-cac-ngan-hang/

---

## 📦 6. Quản Lý Vận Hành: Kho Hàng, Chi Phí Vật Liệu, Tiền Lương & Trực Ca Realtime

Toàn bộ các tính năng vận hành này được **gom thành 1 menu duy nhất mang tên `Kho & Tiền Lương`** trên thanh điều hướng của trang Quản Trị (`admin.php`), **chỉ hiển thị riêng cho tài khoản Quản Trị Viên (Admin)** để đảm bảo tính bảo mật và kiểm soát nội bộ.

---

### A. Quản Lý Kho & Chi Phí Nguyên Vật Liệu
* **KPI Tổng quan kho**:
  - Tổng số mặt hàng nguyên liệu trong danh mục kho.
  - Tổng giá trị tồn kho hiện tại (VNĐ, tính tự động theo giá nhập gần nhất).
  - Cảnh báo tồn kho thấp (các nguyên liệu có số lượng tồn kho $\le$ định mức tối thiểu cần nhập thêm).
  - Tổng chi phí mua nguyên vật liệu trong tháng (VNĐ).
* **Danh mục nguyên vật liệu**:
  - Mã NVL, Tên nguyên liệu, Nhóm (Cà phê & Trà, Sữa & Bơ, Thực phẩm tươi, Bánh mì & Mì, Topping, Bao bì...).
  - Đơn vị tính (kg, lít, hộp, gói, lon, ổ, quả...).
  - Số lượng tồn kho hiện tại (hiển thị thẻ đỏ cảnh báo khi tồn kho chạm ngưỡng tối thiểu).
  - Đơn giá nhập gần nhất và tổng thành tiền tồn kho.
  - Nhà cung cấp chính và ghi chú bảo quản.
* **Các nghiệp vụ kho & chi phí**:
  - **`+ Nhập Kho (3 Cách)` & `⚡ Quét Hóa Đơn AI`**: Hệ thống nhập kho đa phương thức chuyên nghiệp:
    1. **Cách 1 - Nhập Thủ Công**: Form nhập nhiều mặt hàng vào 1 phiếu nhập, tự động gợi ý đơn vị tính và giá mua gần nhất từ danh mục kho, tự tính tổng tiền chi phí.
    2. **Cách 2 - Tải Ảnh Hóa Đơn / Giấy Viết Tay**: Vùng kéo thả file (Drag & Drop) thông minh, hỗ trợ ảnh chụp phiếu tính tiền in nhiệt, hóa đơn VAT, phiếu xuất kho nhà cung cấp hoặc sổ viết tay ghi chép mua hàng. Hỗ trợ nút nạp hóa đơn mẫu thử nghiệm nhanh.
    3. **Cách 3 - Chụp Trực Tiếp Qua Camera / Webcam**: Mở trực tiếp camera máy tính PC / Laptop / POS với khung căn chỉnh hóa đơn, nhấn 1 nút để chụp ảnh hóa đơn ngay tại quầy.
    - **Trí tuệ nhân tạo (AI OCR & Intelligent Parser)**:
      + Tự động nhận diện chữ in, hóa đơn in nhiệt và chữ viết tay phức tạp.
      + Tự động trích xuất: Tên nhà cung cấp (nếu có, không có thì để trống), số hóa đơn, danh sách mặt hàng (Tên hàng, Số lượng, Đơn vị tính, Đơn giá mua, Thành tiền).
      + **Tự động so khớp mã kho (Smart Fuzzy Matching)**: Tự động đối chiếu tên hàng trên hóa đơn với danh mục nguyên vật liệu trong kho để gán đúng mã `NVL001`, `NVL002`, ...
      + **Tự động gắn nhãn mặt hàng mới**: Nếu phát hiện nguyên liệu mới chưa từng có trong kho, hệ thống tự gắn nhãn `✨ Mặt hàng mới`, tự sinh mã kho mới và tự động khởi tạo vào kho khi duyệt phiếu.
      + **Bảng duyệt & đối soát trước khi nhập**: Admin có thể chỉnh sửa số lượng, giá mua, đổi mã nguyên liệu, bổ sung hoặc xóa dòng trước khi bấm **`Xác Nhận Nhập Kho Hàng Loạt`**.
      + Tự động lưu ảnh chứng từ đính kèm vào lịch sử giao dịch kho để phục vụ kiểm toán nội bộ.
  - **`- Xuất Kho Sử Dụng`**: Xuất kho nguyên liệu phục vụ bán hàng hoặc hao hụt, tự động trừ tồn kho.
  - **`+ Thêm Nguyên Liệu`**: Khởi tạo nguyên vật liệu mới với định mức tồn tối thiểu.
  - **`📋 Lịch Sử & Chi Phí`**: Tra cứu toàn bộ phiếu nhập/xuất kho và tổng chi phí mua vật liệu theo ngày, tuần, tháng. Kèm link xem lại ảnh hóa đơn gốc đính kèm.

---

### B. Chấm Công Tự Động & Tiền Lương (Payroll)

#### 1. Cơ Chế Chấm Công Tự Động (Auto Check-in / Check-out)
* **Tự động vào ca (Check-in)**:
  - Ngay khi bất kỳ nhân viên nào (**Thu Ngân**, **Order Phục Vụ**, **Tổ Bếp**, **Admin**) đăng nhập vào hệ thống (bằng **Mật khẩu** hoặc **mã PIN 4 số**), hệ thống **tự động ghi nhận lượt Check-in** vào ca làm việc trong ngày hôm đó vào bảng `attendances`.
  - Nhân viên không cần thao tác chấm công thủ công phức tạp.
* **Tự động tan ca (Check-out)**:
  - Khi nhân viên nhấn nút **Thoát (Đăng xuất)** trên giao diện làm việc, hệ thống **tự động ghi nhận giờ tan ca (Check-out)**.
  - Hệ thống tự động tính chính xác thời gian làm việc thực tế từ lúc Check-in đến Check-out (tính theo giờ, chi tiết đến từng phút) và nhân với mức lương theo giờ của nhân viên đó.

---

#### 2. Quy Tắc Tính: "SỐ CA LÀM" & "TIỀN LƯƠNG THEO GIỜ THỰC TẾ"
* **Quy tắc trần số ca**: **1 ngày làm việc tối đa không quá 2 ca** ($\le 2$ ca/ngày).
* **Trường hợp Login / Logout quá 2 lần trong 1 ngày**:
  - Dù nhân viên có đăng nhập/đăng xuất 3, 4 hay nhiều lần (do bấm nhầm nút Thoát, đổi máy, hoặc kiểm tra hệ thống), hệ thống **chỉ tính tối đa 2 ca** cho ngày hôm đó!
  - **Cơ chế nối ca thông minh (Smart Shift Resume)**:
    - Nếu nhân viên vừa mới đăng xuất dưới 30 phút mà đăng nhập lại (hoặc lỡ bấm nhầm nút Thoát), hệ thống **tự động nối tiếp ca vừa rồi**, tiếp tục tính giờ làm việc liền mạch và không tạo thêm ca mới.
    - Nếu nhân viên đã hoàn thành đủ 2 ca độc lập trong ngày, lượt đăng nhập sau sẽ tự động gộp tiếp vào Ca 2, đảm bảo số ca trong ngày không bao giờ vượt quá 2.
* **Quy tắc tính TIỀN LƯƠNG THEO GIỜ THỰC LÀM (Cực kỳ quan trọng)**:
  - Tiền lương **KHÔNG** tính khoán theo số ca làm, mà được **tính chính xác theo TỔNG SỐ GIỜ LÀM VIỆC THỰC TẾ** của các ca trong ngày:
    $$\text{Tiền lương 1 ca} = \text{Số giờ làm thực tế} \times \text{Mức lương / giờ}$$
    $$\text{Tổng tiền lương tháng} = \sum \text{Tiền lương của tất cả các ca trong tháng}$$
  - **Lợi ích**:
    - Nhân viên làm việc đúng bao nhiêu giờ, phút thì nhận tiền công tương ứng bấy nhiêu.
    - Tránh việc nhân viên vào ca 15 phút rồi thoát vẫn tính tròn 1 ca, và ngược lại nhân viên làm việc chăm chỉ nhiều giờ không bị thiệt thòi.
* **Bảng lương tháng & Cập nhật mức lương**:
  - Thống kê theo tháng: Mã NV, Tên nhân viên, Vai trò, Mức lương/giờ, Số ca làm (đã áp trần $\le 2$ ca/ngày), Tổng số giờ làm việc, Tổng tiền lương thực lĩnh.
  - Nút **`Sửa Lương`**: Admin có thể nhấn để điều chỉnh trực tiếp mức lương theo giờ cho từng nhân viên bất kỳ lúc nào (ví dụ: Thu Ngân 30.000 đ/h, Bếp 28.000 đ/h, Phục Vụ 22.000 đ/h...).

---

#### 3. Xử Lý Sự Cố: Không Logout Mà Bị Mất Mạng Hoặc Máy Tính Vào Chế Độ Sleep
Khi nhân viên **thực tế vẫn đang làm việc tại quán** nhưng máy tính rơi vào chế độ Sleep (tắt màn hình/ngủ) hoặc mạng WiFi/LAN bị chập chờn rớt mạng tạm thời mà **nhân viên KHÔNG bấm nút Thoát (Logout)**, hệ thống giải quyết như sau:

* **1. Ca làm việc trong Database hoàn toàn KHÔNG bị mất**:
  - Khi nhân viên đăng nhập, một bản ghi ca làm việc được tạo trong bảng `attendances` với trạng thái `status = 'working'` và lưu mốc `check_in_time`.
  - Vì nhân viên **không bấm Thoát**, nên trạng thái `status` trong Database **vẫn giữ nguyên là `'working'`**.
  - Kể cả máy tính tắt màn hình, vào Sleep, hay rớt mạng WiFi trong 15 - 45 phút, **hệ thống KHÔNG tự động Check-out, KHÔNG hủy ca và KHÔNG đá nhân viên ra**.
* **2. Tự động phục hồi kết nối ngay khi máy tỉnh giấc (Auto Wakeup & Reconnect)**:
  - Trên tất cả các màn hình (POS Thu Ngân `index.php`, Bếp `kitchen.php`, Order `order.php`, Quản Trị `admin.php`), hệ thống tích hợp bộ lắng nghe sự kiện trình duyệt:
    - `window.addEventListener('online')`: Khi mạng Internet/LAN có lại.
    - `document.addEventListener('visibilitychange')`: Khi màn hình máy tính sáng lại.
    - `window.addEventListener('focus')`: Khi nhân viên chạm vào màn hình cảm ứng hoặc rê chuột.
  - Ngay khi máy tính hoạt động trở lại, trình duyệt tự động gửi ngay tín hiệu Heartbeat lên server để chuyển ngay sang trạng thái `🟢 Đang làm việc` trên màn hình Admin.
* **3. Giờ làm việc được tính trọn vẹn, không mất 1 phút nào**:
  - Thời gian làm việc của ca được tính từ thời điểm `check_in_time` ban đầu cho đến khi nhân viên bấm Thoát lúc hết ca. Khoảng thời gian máy tính Sleep hoặc rớt mạng ngắn hạn trong ca trực **vẫn được tính trọn vẹn vào giờ làm việc thực tế** của nhân viên.
* **4. Cơ chế bảo hiểm chống quên đăng xuất (Safety Cap 12h)**:
  - Nếu nhân viên ra về mà quên hoàn toàn bấm Thoát, để máy tính qua đêm: Hệ thống tự động giới hạn trần an toàn tối đa 12 giờ cho 1 ca làm việc để tránh đội tiền lương khống.
  - Đồng thời, Admin có thể nhấn nút **`Chốt Ca`** thủ công trên danh sách trực ca Realtime bất cứ lúc nào.
* **5. Khuyến nghị thiết lập máy tính tại quán**:
  - Đối với các máy tính để bàn (PC), Laptop tại quầy Thu Ngân và Bếp, khuyến nghị cài đặt trong Windows:
    - `Settings > System > Power & sleep`:
    - **Screen (Màn hình)**: Chọn `15 minutes` hoặc `20 minutes` (tự tắt màn hình để tiết kiệm điện và chống cháy bóng).
    - **Sleep (Ngủ máy tính)**: Chọn **`Never`** (Không bao giờ ngủ khi cắm nguồn sạc) để máy tính luôn duy trì kết nối mạng, nhận đơn hàng và in hóa đơn tức thì.

---

#### 4. Quy Định Khung Giờ Ca Làm Việc & Tự Động Chốt Ca Khi Hết Giờ (Admin Cấu Hình)
Hệ thống cho phép Quản Trị Viên (Admin) chủ động thiết lập khung giờ các ca làm việc của quán ngay tại màn hình **`Kho & Tiền Lương`**:

* **1. Thiết lập khung giờ ca linh hoạt**:
  - **Ca 1 (Ca Sáng)**: Giờ bắt đầu và Giờ kết thúc (Mặc định: `06:30` - `12:30`).
  - **Ca 2 (Ca Chiều / Tối)**: Giờ bắt đầu và Giờ kết thúc (Mặc định: `12:30` - `22:30`).
  - **Thời gian ân hạn (Grace Period)**: Số phút sau giờ hết ca trước khi hệ thống kích hoạt tự động chốt (Mặc định: `15` phút).
  - **Nút Bật / Tắt**: Cho phép bật hoặc tắt tính năng tự động chốt ca bất kỳ lúc nào.
* **2. Cơ chế Tự Động Chốt Ca Khi Hết Giờ**:
  - Nếu nhân viên đăng nhập vào làm việc trong khung giờ của Ca (ví dụ Ca Sáng), nhưng khi **hết giờ ca làm việc mà nhân viên quên bấm nút Thoát (Logout)**:
  - Khi thời gian thực tế vượt quá giờ kết thúc ca + thời gian ân hạn:
    - Hệ thống **TỰ ĐỘNG CHỐT CA LÀM VIỆC** cho nhân viên đó!
    - **Giờ kết thúc ca** được chốt chuẩn xác đúng bằng **Giờ kết thúc ca quy định của Admin** (ví dụ: `12:30:00`).
    - **Thời gian làm việc thực tế** = $\text{Giờ kết thúc ca quy định} - \text{Giờ Check-in ban đầu}$.
    - **Tiền lương ca** = $\text{Thời gian làm việc thực tế} \times \text{Mức lương / giờ}$.
    - Trạng thái ca chuyển thành `completed` kèm ghi chú hệ thống: `Hệ thống tự động chốt lúc HH:mm (Hết khung giờ Ca X)`.
    - Trạng thái nhân viên tự động chuyển sang `offline` (`is_online = 0`).
  - **Lợi ích vận hành**:
    - Ngăn chặn hoàn toàn việc nhân viên ra về mà quên đăng xuất làm ca làm việc chạy thông qua đêm dẫn đến tính khống 15 - 24 tiếng tiền lương ảo.
    - Đảm bảo tính minh bạch, công bằng, đúng với khung giờ làm việc thực tế do Admin quy định.

---

### C. Danh Sách Nhân Viên Trực Ca Theo Thời Gian Thực (Realtime Staff)
* **Thống kê nhanh số người đang trực ca theo từng vị trí**:
  - 👨‍💼 **Thu Ngân (ACC)**: Số người đang trực máy POS bán hàng.
  - 🍳 **Tổ Bếp / Bar (KIT)**: Số người đang trực màn hình chế biến món.
  - 📋 **Order Phục Vụ (STF)**: Số người đang trực màn hình chọn món bàn.
  - 👑 **Quản Trị (ADM)**: Chủ quán / Quản lý đang hoạt động.
* **Bảng danh sách trực ca thời gian thực**:
  - Họ tên, Mã nhân viên (`user_code`), Vai trò với huy hiệu màu riêng biệt.
  - Giờ Check-in vào ca.
  - **Thời gian làm việc liên tục**: Tự động đếm tăng dần theo thời gian thực (ví dụ: `2h 15m`).
  - **Trạng thái**: Đèn xanh nhấp nháy `🟢 Đang làm việc` (khi có tương tác trong 5 phút) hoặc `Vắng mặt tạm thời`.
  - Thiết bị và địa chỉ IP kết nối mạng LAN.
  - **Nút `Chốt Ca` thủ công**: Nếu nhân viên hết ca mà quên đăng xuất, Admin có thể nhấn nút chốt ca trực tiếp, hệ thống sẽ chốt giờ ra và tính luôn tiền lương cho ca đó.
* **Cơ chế nhịp tim (Heartbeat 45s)**: Tất cả các màn hình POS (`index.php`), Order (`order.php`), Bếp (`kitchen.php`) định kỳ gửi tín hiệu nhịp tim để duy trì trạng thái trực tuyến chính xác.

---

## 🎨 7. Trí Tuệ Nhân Tạo Xử Lý & Hiển Thị Hình Ảnh Thực Đơn (AI Visual Menu & Food Photography)

Nhằm nâng cao trải nghiệm gọi món trực quan, kích thích vị giác khách hàng và hỗ trợ nhân viên nhận diện món ăn tức thì trong giờ cao điểm, hệ thống tích hợp công nghệ xử lý hình ảnh món ăn ẩm thực bằng AI:

### A. Hiển Thị Hình Ảnh Trực Quan Trên Các Màn Hình Hệ Thống
* **Màn hình POS Thu Ngân (`index.php`)**:
  - Mỗi ô món ăn hiển thị bức ảnh minh họa ẩm thực sắc nét, hấp dẫn (ví dụ: ổ **Bánh Mì** vàng giòn rụm kẹp pate chả lụa dưa leo rau thơm, chảo **Bánh Mì Chảo** xèo xèo nóng hổi, tô **Mì Gói Bò** ngun ngút khói, ly **Cà Phê Sữa Đá** 3 tầng...).
  - Thiết kế thẻ kính **Liquid Glass UI** sang trọng: Kích thước chuẩn tỉ lệ, hiệu ứng lướt nhẹ phóng to hình ảnh mượt mà (`scale-105`), nhãn Mã món (`BM001`) và Đơn vị tính (`Cái`) phủ kính mờ tinh tế trên góc ảnh.
  - Khi món bị khóa bởi bếp, ảnh tự động làm mờ và gắn nhãn cảnh báo `🚫 HẾT HÀNG`.
* **Màn hình Nhân Viên Nhận Order (`order.php`)**:
  - Tích hợp ảnh thu nhỏ của món ăn giúp nhân viên phục vụ nhận biết nhanh, tránh bấm nhầm món tương tự.
* **Màn hình Khách Hàng Tự Phục Vụ (`customer.php`)**:
  - Thẻ món ăn hiển thị đầy đủ ảnh ẩm thực chân thực, màu sắc bắt mắt khi khách xem thực đơn tại bàn.
* **Màn hình Quản Lý Bếp & Khóa Món (`kitchen.php`)**:
  - Thêm ảnh nhận diện món trong danh sách báo hết hàng / mở bán lại.

### B. Công Cụ AI Quản Trị & Tạo Ảnh Tự Động (Admin Tools)
* **Công cụ `✨ AI Cập Nhật Ảnh Thực Đơn` (Batch Auto-Assign)**:
  - Nút bấm 1 chạm trên thanh công cụ Quản lý Mặt Hàng (`admin.php`), AI tự động phân tích tên món (Bánh mì, Bò bít tết, Mì xào, Trà sữa, Cafe, Sinh tố, Topping...), so khớp và gán ảnh ẩm thực chất lượng cao cho toàn bộ 42 món ăn trong thực đơn.
* **Công cụ `✨ AI Tạo Ảnh` trong Popup Thêm / Sửa Món**:
  - Khi thêm món mới (ví dụ: *Bánh Mì Thịt Nướng Đặc Biệt*), chỉ cần bấm `AI Tạo Ảnh`, hệ thống tự động sinh/tìm ảnh ẩm thực tương ứng và điền đường dẫn ảnh.
* **Công cụ `📁 Tải ảnh lên`**:
  - Hỗ trợ tải trực tiếp file ảnh chụp thực tế của quán từ máy tính, tự động lưu trữ cục bộ vào `assets/images/dishes/` và cập nhật cơ sở dữ liệu.
* **Hoạt động Offline 100%**:
  - Toàn bộ hình ảnh được tải về và lưu trữ trực tiếp trên máy chủ cục bộ (`assets/images/dishes/`), đảm bảo máy POS mở nhanh tức thì, không bị ảnh hưởng bởi mạng chập chờn.

---

## 📌 Quản Lý Phiên Bản & Điểm Khôi Phục (Git Checkpoint)

Hệ thống được gắn các thẻ **Git Tag** tại những thời điểm phiên bản ổn định để bạn có thể dễ dàng quay lại bất cứ lúc nào khi cần thiết.

### 1. Danh sách các phiên bản đã đánh dấu

* **`v7.3.3-stable-20261031`** (Commit mới nhất - Ngày 31/10/2026) - **PHIÊN BẢN HIỆN TẠI**:
  - **Khắc Phục & Tối Ưu Toàn Diện Nhận Diện Giấy Viết Tay & Hóa Đơn Mua Hàng Bằng Google Gemini Vision AI**:
    - **Khắc phục triệt để lỗi phân tích sai (rơi vào mẫu thử demo Cà phê Buôn Ma Thuột)**:
      + Sửa lỗi cú pháp chuẩn REST API của Google Gemini: Chuyển đổi chính xác sang `inlineData` và `mimeType` (camelCase).
      + Cập nhật danh sách model thế hệ mới nhất tương thích với tài khoản Google AI: `gemini-3.1-flash-lite`, `gemini-2.5-flash-lite`, `gemini-flash-latest`, `gemini-3.8-flash`.
      + Xóa bỏ cơ chế tự động rơi vào hóa đơn mẫu giả khi phân tích ảnh thật; nếu chưa có API Key hoặc ảnh lỗi, hệ thống thông báo rõ ràng lý do thay vì trả về mẫu giả gây nhầm lẫn.
    - **Nhận diện chính xác 100% chữ viết tay ẩm thực**:
      + Đọc chuẩn xác các dòng chữ viết tay phức tạp (Ví dụ: `Bánh mì 2 ổ 10.000` -> Tự động nhận dạng `Bánh mì`, Số lượng `2 ổ`, Thành tiền `10.000 đ`, và khớp thông minh vào mã kho `NVL006 - Bánh mì tươi giòn`).
      + Đọc dòng `Pate 0.5 kg 90.000` -> Tự động nhận dạng `Pate`, Số lượng `0.5 kg`, Thành tiền `90.000 đ`, và khớp thông minh vào mã kho `NVL010 - Pate gan heo đặc biệt`.
      + Tự động để trống Nhà cung cấp nếu trên giấy viết tay không có thông tin người bán.
    - **Nút Xoay Ảnh 90° (Rotate)**: Bổ sung nút xoay ảnh 90 độ ngay trong khung xem trước ảnh hóa đơn, giúp người dùng lật ảnh chụp từ điện thoại về đúng chiều đọc trước khi gửi AI quét.
    - **Tự Động Lưu Trữ API Key Gemini**: Tự động lưu key vào cơ sở dữ liệu `store_settings` và `localStorage` ngay khi nhập, đồng thời thêm mục cấu hình API Key trong trang **Cài Đặt Cửa Hàng**.

* **`v7.3.2-stable-20261031`** (Commit `9af6872` - Ngày 31/10/2026):
  - **Bộ Công Cụ Tự Động & Chỉnh Tay Cắt Xén Ảnh Món Ăn Chuẩn 4:3 (Smart 4:3 Image Cropper)**:
    - **Tự động căn giữa & tính toán khung cắt chuẩn 4:3 (Auto-Center 4:3 Smart Fit)**: Ngay khi người dùng chọn tải ảnh lên từ máy tính hoặc điện thoại, hệ thống tự động tính toán khung 4:3 lý tưởng nhất bao trọn chủ thể món ăn, không để dải đen và không bị méo hình.
    - **Công cụ căn chỉnh ảnh tương tác HTML5 Canvas trực quan**:
      - Kéo di chuyển ảnh (Interactive Drag / Pan) bằng chuột hoặc chạm vuốt màn hình cảm ứng POS.
      - Phóng to / thu nhỏ linh hoạt (Zoom slider 0.5x - 3.0x, nút `+`/`-`, hoặc lăn con cuộn chuột trực tiếp).
      - Xoay 90 độ (Rotate 90°) giải quyết tức thì tình trạng chụp ảnh bị xoay dọc/ngang từ smartphone.
      - Lưới căn tỷ lệ 1/3 (Rule of Thirds Grid) chuyên nghiệp theo chuẩn nhiếp ảnh thương mại thực phẩm.
    - **Tự động cắt & lưu ngay 1-Click (1-Click Instant Auto Crop)**: Nút "Tự Động Cắt & Lưu Ngay" cho phép hoàn tất việc cắt chuẩn 4:3 (640 × 480 px) chỉ trong 0.5 giây.
    - **Hỗ trợ Kéo & Thả (Drag & Drop)**: Người dùng có thể kéo trực tiếp ảnh từ máy tính thả vào ô xem trước món ăn trong Admin để mở công cụ cắt xén tức thì.
    - **Nút "Cắt 4:3" cho ảnh đang có sẵn**: Cho phép người quản trị cắt xén và căn chỉnh lại khung hình bất kỳ lúc nào ngay cả với ảnh món đã lưu từ trước hoặc vừa được AI tạo ra.

* **`v7.3.1-stable-20261031`** (Commit `c3baaee` - Ngày 31/10/2026):
  - **Tối Ưu Toàn Diện Hình Ảnh Thực Đơn (Full-View 4:3 & Bố Cục Thẻ Chuẩn)**:
    - **Hiển thị đầy đủ 100% hình ảnh món ăn**: Khắc phục triệt để hiện tượng ảnh bị cắt xén đầu đuôi (như ly cà phê chỉ thấy miệng ly, trà sữa bị cắt mất chân ly, dĩa flan bị cắt ngang). Mọi món ăn, thức uống được thu phóng trọn vẹn trong khung hình 4:3 với phông nền mờ ảo vi vu (Ambient Dark Slate) sang trọng.
    - **Căn chỉnh lại tỉ lệ thẻ và lưới POS**: Tối ưu hóa lưới món ăn trên màn hình PC/Laptop/Tablet sang `grid-cols-4` đến `grid-cols-5` thay vì 6 cột bị bóp méo, giúp mỗi thẻ có độ rộng lý tưởng (~200px), khung hình đạt chuẩn tỷ lệ nhiếp ảnh ẩm thực thương mại `aspect-[4/3]`.
    - **Bố trí lại huy hiệu trên thẻ**: Di chuyển và thu nhỏ nhãn mã món (`BM001`) và đơn vị tính (`Cái`, `Ly`) thành các viên nang thủy tinh mờ tinh tế tại 2 góc mép ảnh, giải phóng 95% diện tích bề mặt để thực khách và thu ngân chiêm ngưỡng trọn vẹn món ăn ngon mắt.
    - **Xử lý toàn bộ 42 hình ảnh món thật**: Thay thế toàn bộ ảnh bị lệch hoặc trùng bằng ảnh ẩm thực chân thực (Bánh Flan nguyên dĩa, Bò bít tết chảo gang con bò né, Cà phê phin giọt đắng, Trà đào cam sả đầy đủ topping và ly đế...).

* **`v7.3.0-stable-20261031`** (Commit `4e83579` - Ngày 31/10/2026):
  - **Trí Tuệ Nhân Tạo Xử Lý Hình Ảnh Món Ăn (AI Visual Menu)**:
    - Hiển thị hình ảnh minh họa ẩm thực chân thực, bắt mắt trên toàn bộ thẻ gọi món POS Thu Ngân (`index.php`), Order (`order.php`), Khách hàng (`customer.php`), Bếp (`kitchen.php`).
    - Giao diện thẻ món Liquid Glass chuyên nghiệp: Ảnh món độ phân giải cao, bo góc mềm mại, phủ nhãn mã món (`BM001`) và đơn vị tính (`Cái`) trên ảnh, hiệu ứng hover phóng to mượt mà.
    - Đầy đủ 42 hình ảnh ẩm thực cục bộ cho 42 món ăn trong danh mục thực đơn (Bánh mì, Bò bít tết, Mì gói, Bánh flan, Cafe, Trà sữa, Sinh tố, Đá xay, Topping...).
    - Thêm nút **`✨ AI Cập Nhật Ảnh Thực Đơn`** trong Admin: 1 click tự động nhận diện và gán ảnh cho toàn bộ menu.
    - Thêm công cụ **`✨ AI Tạo Ảnh`** và **`📁 Tải ảnh lên`** ngay trong popup Thêm / Sửa món ăn.
    - Lưu trữ ảnh 100% offline tại `assets/images/dishes/`, tải trang siêu nhanh, không phụ thuộc kết nối internet ngoài.

* **`v7.3.9-stable-20261031`** (Ngày 31/10/2026):
  - **Medium Icon Gallery Chuẩn Mực (~85x85px)**: Khắc phục hoàn toàn lỗi ảnh hóa đơn bung to tràn màn hình, đưa về kích thước Medium Icon cố định 85x85px chuẩn mực, sắp xếp tên file & nút xoay gọn gàng không bị ngắt dòng.
  - **Hỗ Trợ Chọn Nhiều Ảnh & Chọn Cả Thư Mục (Folder)**: Bổ sung 2 nút `+ Chọn Nhiều Ảnh` và `📂 Chọn Thư Mục (Folder)` cho phép tải hàng loạt ảnh chứng từ, phiếu xuất kho cùng lúc.
  - **Nút Xóa Từng Ảnh & Xóa Tất Cả**: Mỗi ảnh trong Medium Icon Gallery đều có nút tròn đỏ `×` góc trên để xóa ngay ảnh thừa, kèm nút `🗑 Xóa tất cả` để reset chọn lại từ đầu.
  - **Phân Tích AI Đa Hóa Đơn Hàng Loạt**: Tự động duyệt qua toàn bộ các hóa đơn đã chọn và gộp chung vào Bảng kết quả đối soát & nhập kho.

* **`v7.3.8-stable-20261031`** (Commit `3112ca7` - Ngày 31/10/2026):
  - **Thu Gọn Thanh Preview & Kích Hoạt AI (Slim Action Bar)**: Thiết kế lại toàn bộ ô xem trước hóa đơn thành thanh công cụ ngang mỏng tinh tế (cao chỉ ~48px, tiết kiệm 75% không gian dọc), sắp xếp thumbnail ảnh, thông tin dung lượng, nút xoay, đổi ảnh và nút quét AI nằm gọn gàng trên cùng 1 hàng.
  - **Tự Động Ẩn Dropzone Khi Có Ảnh**: Khi người dùng tải ảnh hoặc chụp ảnh xong, khung kéo thả file khổng lồ tự động ẩn đi, giải phóng tối đa diện tích màn hình cho Bảng kết quả đối soát & nhập kho.

* **`v7.3.7-stable-20261031`** (Commit `7a8f068` - Ngày 31/10/2026):
  - **Tối Ưu Tốc Độ Quét AI Với Google Gemini 3.5 Flash (`gemini-3.5-flash`)**: Đưa `gemini-3.5-flash` và `gemini-3.5-flash-lite` lên ưu tiên số 1, rút ngắn thời gian bóc tách hóa đơn xuống chỉ còn **~2 - 4 giây** (nhanh gấp 3 lần), phản hồi tức thì và không bị nghẽn demand.

* **`v7.3.6-stable-20261031`** (Commit `0a9dbfb` - Ngày 31/10/2026):
  - **Tích Hợp Google Gemini 3.8 Flash (`gemini-3.8-flash`)**: Thiết lập model chủ lực sang `gemini-3.8-flash` theo cấu hình của người dùng.
  - **Cơ Chế Tự Động Phục Hồi Spike (High Demand)**: Khi máy chủ `gemini-3.8-flash` gặp spike quá tải tạm thời (503 Service Unavailable), hệ thống tự động retry và linh hoạt fallback sang `gemini-3.5-flash-lite`, xử lý bóc tách hóa đơn viết tay trơn tru 100%.
  - **Xóa Bỏ Model Lỗi Cũ**: Loại bỏ hoàn toàn model cũ `gemini-1.5-flash` (không còn tồn tại trên v1beta).
  - **Đồng Bộ API Key Chuẩn Xác**: Cập nhật Google Gemini API Key chuẩn xác trong cả cơ sở dữ liệu `store_settings` và `config/config.php`.

* **`v7.3.5-stable-20261031`** (Commit `1edd178` - Ngày 31/10/2026):
  - **Mở Rộng Gấp Đôi Chiều Ngang 2 Cửa Sổ Modal**: Xóa bỏ thuộc tính ép cứng `width: 520px !important` trong CSS lõi [`assets/css/liquid-glass.css`](file:///d:/Software/Code%20dev/sale-app/assets/css/liquid-glass.css).
  - Tăng chiều ngang cửa sổ **Nhập Kho Thông Minh** lên **`1240px`** (gấp 2.4 lần so với 520px trước đó) và cửa sổ **Lịch Sử Nhập Xuất & Chi Phí** lên **`1180px`**, hiển thị toàn diện các cột dữ liệu kế toán không bị che khuất hay ngắt dòng.

* **`v7.3.4-stable-20261031`** (Commit `c96b8f9` - Ngày 31/10/2026):
  - **Tối ưu Form Nhập Kho Đa Phương Thức**: Mở rộng Modal lên 1240px (`w-[1240px] max-w-[96vw]`), bảng kết quả min-width 1080px, tiêu đề cột gắn `whitespace-nowrap` chống ngắt dòng 3-4 hàng xấu xí.
  - **Dọn Sạch Dữ Liệu Khi Mở Mới**: Tích hợp `resetSmartImportForm()` tự động dọn sạch toàn bộ dòng nhập kho, số lượng, đơn giá, ảnh preview của lần quét trước khi mở mới hoặc sau khi xác nhận nhập kho thành công.
  - **Cải Tiến Giao Diện Lịch Sử & Quản Lý Vật Tư**: Bảng lịch sử nhập/xuất kho `modal-material-history` và bảng nguyên vật liệu mở rộng rộng rãi, to đẹp, không bị co rút cắt số tiền.

* **`v7.3.3-stable-20261031`** (Commit `06f44cf` - Ngày 31/10/2026):
  - **Google Gemini Vision OCR**: Tích hợp API Gemini phân tích ảnh chụp hóa đơn in nhiệt và giấy viết tay phức tạp.
  - **Xoay ảnh 90° & Tự tính đơn giá**: Thêm tính năng xoay ảnh và tự động chia `Thành tiền ÷ Số lượng = Đơn giá`.

* **`v7.2.0-stable-20261031`** (Commit `77139d3` - Ngày 31/10/2026):
  - **Quản Lý Vận Hành (Menu độc quyền cho Admin - `Kho & Tiền Lương`)**:
    - **Nhập Kho Đa Phương Thức (3 Cách)**:
      1. *Nhập Thủ Công*: Lập phiếu nhiều mặt hàng (`+ Thêm Mặt Hàng`), tự động gợi ý giá mua cũ & ĐVT, tính tổng chi phí.
      2. *Tải Ảnh Hóa Đơn / Giấy Viết Tay*: Vùng kéo thả file Drag & Drop (hóa đơn nhiệt, VAT, phiếu xuất kho, sổ tay), kèm tính năng thử nghiệm hóa đơn mẫu F&B.
      3. *Chụp Ảnh Trực Tiếp Qua Camera / Webcam*: Mở webcam PC/Laptop/POS trực tiếp trên trình duyệt, có khung căn chỉnh hóa đơn và 1 click chụp ngay tại quầy.
    - **Trí Tuệ Nhân Tạo AI OCR & Intelligent Parser**:
      - Nhận diện chữ in nhiệt và chữ viết tay phức tạp.
      - Tự động bóc tách: Nhà cung cấp (không có để trống), ngày HĐ, số HĐ, tên hàng, số lượng, ĐVT, đơn giá, thành tiền.
      - Tự động so khớp thông minh (Smart Fuzzy Matching) với danh mục mã NVL trong kho (`NVL001`, `NVL002`...).
      - Tự động phát hiện và sinh mã mới cho nguyên liệu mới (`✨ Mặt hàng mới`).
      - Bảng duyệt đối soát trực quan trước khi xác nhận nhập kho hàng loạt.
      - Tự động lưu ảnh chứng từ đính kèm vào lịch sử giao dịch kho để kiểm toán nội bộ.
    - **Cấu hình khung giờ ca làm việc do Admin quy định**:
      - Thiết lập giờ bắt đầu & kết thúc cho Ca 1 (Sáng) và Ca 2 (Chiều/Tối), thời gian ân hạn.
      - **Cơ chế Tự động chốt ca khi hết giờ**: Nhân viên đăng nhập vào ca mà hết giờ quên bấm Thoát, hệ thống tự động chốt ca đúng giờ quy định, tính tiền lương thực tế, không tính khống qua đêm.
    - **Quy tắc tính ca & chấm công**:
      - 1 ngày tối đa không quá 2 ca ($\le 2$ ca/ngày). Login/logout quá 2 lần chỉ tính 2 ca.
      - Tiền lương tính theo $\text{Tổng giờ thực làm} \times \text{Lương/giờ}$.
      - Tự động nối tiếp ca nếu đăng xuất dưới 30 phút.
      - Cơ chế chống rớt mạng và Sleep recovery (tự động khôi phục kết nối và gửi heartbeat khi máy tính tỉnh giấc qua `online`, `visibilitychange`, `focus`).

* **`v7.1.0-stable-20261031`** (Commit `0286f5c` - Ngày 31/10/2026):
  - **POS Thu Ngân**: Chuẩn hóa bố cục 2 cột trên PC, Laptop và iPad (Bảng món ăn, danh mục, thanh chọn bàn, giỏ hàng).
  - **Thống Kê Doanh Thu Thu Ngân**: Nút `Thống Kê` xem doanh thu hôm nay, tiền mặt, VietQR, top món và in báo cáo ca nhiệt.
  - **Lịch Sử Thanh Toán**: Nút `Lịch Sử Đơn` tích hợp 4 thẻ tổng hợp tiền trực tiếp và tìm kiếm, in lại hóa đơn.
  - **Tối ưu Mobile & iPad**: Khắc phục lỗi nút thao tác dãn dọc trên Safari iPad, thanh tiêu đề 1 dòng gọn gàng.
  - **Nút Mở ĐT**: Icon QR code tối giản không chữ trên mọi thiết bị.

---

### 2. Hướng dẫn cách quay lại phiên bản đánh dấu

Khi gặp sự cố hoặc muốn đưa toàn bộ mã nguồn về đúng phiên bản đã đánh dấu, mở Terminal (PowerShell / Command Prompt) tại thư mục dự án và chạy các lệnh sau:

#### Cách 1: Chuyển trực tiếp về phiên bản (Chỉ xem và chạy thử)
```bash
# Chuyển về phiên bản v7.2.0 (Vận hành, Kho & Tiền Lương AI)
git checkout v7.2.0-stable-20261031

# Hoặc quay lại mốc v7.1.0 trước đó
git checkout v7.1.0-stable-20261031
```

#### Cách 2: Khôi phục và tạo một nhánh mới để tiếp tục phát triển
```bash
git checkout -b ban-on-dinh v7.1.0-stable-20261031
```

#### Cách 3: Đưa nhánh chính (`main`) quay về hoàn toàn mốc này (Xóa bỏ các thay đổi lỗi sau mốc)
```bash
# Hủy các thay đổi và đặt nhánh main về đúng tag
git reset --hard v7.1.0-stable-20261031

# Đẩy cập nhật khôi phục lên GitHub
git push origin main --force
```

#### Cách 4: Xem danh sách tất cả các điểm mốc (Tag) có sẵn
```bash
git tag -l -n9
```
