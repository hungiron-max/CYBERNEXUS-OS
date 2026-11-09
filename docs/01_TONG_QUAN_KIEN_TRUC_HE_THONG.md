# 🚀 CYBERNEXUS OS — KIẾN TRÚC HỆ THỐNG TỔNG QUAN

> **Hệ sinh thái Quản trị Không gian Số Đa Năng: F&B POS + Hạ tầng Mạng & QoS + Trung tâm Giải trí Đa phương tiện**  
> **Kiến trúc:** C++17 Microkernel + Hệ sinh thái Dynamic Library (.dll / .so) + SuperAdmin Central SaaS

---

## 1. BỐI CẢNH VÀ MỤC TIÊU DỰ ÁN

Hiện nay, các địa điểm dịch vụ giải trí và ẩm thực (Cyber Cafe, Gaming Lounge, Billiards Club, Smart Cafe, Co-Working Space) đang phải đối mặt với tình trạng phân mảnh phần mềm nghiêm trọng:
* **Phần mềm bán hàng (POS):** Độc lập, không kết nối hạ tầng mạng, không nhận diện được thiết bị khách.
* **Hạ tầng mạng WiFi:** Quá tải giờ cao điểm, khách vãng lai dùng chùa làm nghẽn băng thông của khách trả tiền.
* **Âm thanh / Hình ảnh (Media):** Chạy thủ công, không có cơ chế tương tác (Jukebox) cho khách hàng tại bàn.

**CYBERNEXUS OS** ra đời nhằm hợp nhất 3 bài toán trên thành **1 Hệ điều hành Không gian Số duy nhất**:
1. **POS Bán Hàng & Quản Trị:** Quản lý bàn, menu, topping, in nhiệt, KDS nhà bếp, thanh toán VietQR động.
2. **Quản Lý Băng Thông & Tường Lửa (SNM):** Tương tác trực tiếp Router phần cứng (Ubiquiti EdgeRouter ER-X / MikroTik / Linux Gateway) qua SSH; tự động cấp tốc độ VIP cho khách có hóa đơn.
3. **Giải Trí Đa Phương Tiện (Media Server):** Máy chủ stream nhạc/phim nội bộ, Equalizer âm thanh chuyên nghiệp, Jukebox thông minh cho khách quét QR chọn bài.

---

## 2. KIẾN TRÚC VI HẠT NHÂN (MICROKERNEL ARCHITECTURE)

Khác với các ứng dụng nguyên khối (Monolithic EXE), **CYBERNEXUS OS** áp dụng triệt để kiến trúc **Microkernel**:

```
+--------------------------------------------------------------------------+
|                        SUPERADMIN COMMAND CENTER                         |
|  - Cấp phép & Ký số License Token (RSA-4096)                             |
|  - Phân phối cập nhật OTA (Over-The-Air) từng file .dll                  |
|  - Công tắc bật/tắt tính năng từ xa (Remote Feature Toggle)              |
|  - Cổng AI Token Gateway & Giám sát vận hành toàn cầu                   |
+--------------------------------------------------------------------------+
                                     ^
                                     | HTTPS (TLS 1.3 / WebSocket)
                                     v
+--------------------------------------------------------------------------+
|                     CYBERNEXUS HOST CORE (File .EXE)                     |
|  - Embedded Web/API Server (C++17 cpp-httplib)                           |
|  - CSDL Nhúng Hiệu Năng Cao (SQLite 3 WAL Mode)                          |
|  - Dynamic Plugin Loader (LoadLibrary / dlopen)                          |
|  - Crypto Guard (Xác thực chữ ký số RSA & Hardware Binding)              |
|  - Internal Event Bus & Local IPC                                        |
+--------------------------------------------------------------------------+
          |                  |                  |                  |
          v                  v                  v                  v
    +-----------+      +-----------+      +-----------+      +-----------+
    |  mod_pos  |      |  mod_net  |      | mod_media |      |  mod_ai   |
    |   .dll    |      |   .dll    |      |   .dll    |      |   .dll    |
    +-----------+      +-----------+      +-----------+      +-----------+
```

### Đặc tính kỹ thuật:
* **Dung lượng Host Core:** < 10MB RAM, khởi động trong < 0.5 giây.
* **Tính độc lập:** Mỗi tính năng là 1 file thư viện liên kết động độc lập (`.dll` trên Windows, `.so` trên Linux).
* **Nạp/Gỡ nóng (Hot-reload):** Bật/tắt module ngay lập tức mà không cần khởi động lại máy chủ.
* **Cơ sở dữ liệu:** SQLite 3 cục bộ đảm bảo hoạt động 100% offline khi mất mạng cáp quang.
