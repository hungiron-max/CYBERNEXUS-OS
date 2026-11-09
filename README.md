# 🚀 CYBERNEXUS OS — SMART VENUE OPERATING SYSTEM

<div align="center">

[![Build Status](https://github.com/hungiron-max/CYBERNEXUS-OS/actions/workflows/build-test.yml/badge.svg)](https://github.com/hungiron-max/CYBERNEXUS-OS/actions/workflows/build-test.yml)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](docs/03_CO_CHE_CAP_PHEP_VA_BAO_MAT_RSA.md)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20EdgeRouter-blue.svg)](docs/01_TONG_QUAN_KIEN_TRUC_HE_THONG.md)
[![Architecture](https://img.shields.io/badge/Architecture-C%2B%2B17%20Microkernel-success.svg)](docs/02_CHUAN_GIAO_TIEP_PLUGIN_DLL.md)

**Hệ Điều Hành Không Gian Số Hợp Nhất: POS Bán Hàng F&B + Quản Lý Băng Thông Router (SNM) + Media Server & Jukebox + Trí Tuệ Nhân Tạo AI**

[Tài Liệu Kỹ Thuật](docs/) • [Kiến Trúc Hệ Thống](docs/01_TONG_QUAN_KIEN_TRUC_HE_THONG.md) • [Chuẩn Plugin DLL](docs/02_CHUAN_GIAO_TIEP_PLUGIN_DLL.md) • [Bảo Mật RSA](docs/03_CO_CHE_CAP_PHEP_VA_BAO_MAT_RSA.md) • [Mô Hình Tính Phí](docs/04_MO_HINH_KINH_DOANH_VA_TINH_PHI.md) • [Tính Năng AI](docs/05_TICH_HOP_TRI_TUE_NHAN_TAO_AI.md)

</div>

---

## 📌 1. TỔNG QUAN DỰ ÁN

**CYBERNEXUS OS** là giải pháp phần mềm thế hệ mới dành cho các tổ hợp dịch vụ:
* 🎮 **Cyber Gaming Lounge & Esports Arena** (Phòng máy cao cấp kết hợp Cafe ẩm thực).
* 🎱 **Billiards Club & Sports Bar** (Câu lạc bộ Bida + Màn hình điểm số + Âm nhạc).
* ☕ **Smart Cafe & Co-Working Space** (Cafe làm việc cần WiFi chất lượng cao, gọi món tại bàn).

### 3 Trụ Cột Hợp Nhất:
1. **POS Bán Hàng & back-office (`sale-app`):** Chạm cảm ứng quầy thu ngân, gọi món di động cho nhân viên phục vụ, màn hình bếp KDS thời gian thực, sinh mã thanh toán VietQR động 24/7.
2. **Quản Lý Băng Thông & Tường Lửa Router (`snm`):** Tương tác trực tiếp Router phần cứng (Ubiquiti EdgeRouter ER-X / MikroTik / Linux Gateway), tự động cấp băng thông VIP tốc độ cao cho khách có hóa đơn, lọc tên miền và chống nghẽn mạng.
3. **Trung Tâm Đa Phương Tiện & Jukebox (`media-server`):** Phát nhạc/video phân đoạn nội bộ (HTTP Range Requests), Trình chỉnh âm sắc Equalizer & Quang phổ âm thanh (Visualizer), chế độ Jukebox cho khách dùng smartphone vote bài hát cho quán.

---

## 🏗️ 2. KIẾN TRÚC VI HẠT NHÂN (MICROKERNEL & PLUGINS)

Toàn bộ hệ thống không đóng gói nguyên khối (Monolithic), mà hoạt động theo mô hình **Microkernel**:
* **Host Core (`cybernexus_host.exe`):** Siêu nhẹ (<10MB RAM), khởi động tức thì, tích hợp máy chủ nhúng C++17 và SQLite 3.
* **Module Tính Năng Độc Lập (`.dll` trên Windows / `.so` trên Linux):**
  * Từng tính năng được biên dịch độc lập.
  * Có thể cập nhật nóng (Hot-reload), nâng cấp (OTA update) mà không cần cài lại hệ thống.
  * **SuperAdmin (Chủ dự án)** có quyền tối cao: Bật/Tắt từ xa, cấp phép (License), tính phí thuê bao theo từng module và chống bẻ khóa bằng **Chữ ký số RSA-4096**.

```
CYBERNEXUS-OS/
├── .github/workflows/       # CI/CD Tự động Build, Test và Đóng gói Release
├── docs/                    # Toàn bộ tài liệu thiết kế và lộ trình dự án
├── core/
│   ├── include/             # IModulePlugin.hpp, PluginManager.hpp, httplib.h
│   └── src/                 # main.cpp, PluginManager.cpp
├── modules/                 # Các module tính năng độc lập
│   ├── mod_pos_core/        # Module Bán hàng POS & In hóa đơn
│   ├── mod_network_qos/     # Module Quản trị Router mạng & WiFi QoS
│   └── mod_media_stream/    # Module Media Streaming & Jukebox
├── CMakeLists.txt           # Cấu hình biên dịch tổng thể
└── README.md
```

---

## 🛠️ 3. HƯỚNG DẪN BIÊN DỊCH & VẬN HÀNH

### Yêu Cầu Môi Trường:
* Trình biên dịch hỗ trợ **C++17** (MSVC 2019+ trên Windows, GCC 9+ / Clang 10+ trên Linux).
* **CMake 3.15** trở lên.

### Lệnh Biên Dịch:
```bash
# 1. Tạo thư mục build và cấu hình CMake
cmake -B build -DCMAKE_BUILD_TYPE=Release

# 2. Biên dịch Host Core và toàn bộ Modules (.dll)
cmake --build build --config Release
```

### Chạy Thử Nghiệm:
```bash
# Khởi động máy chủ Host Core tại cổng 8500
./build/Release/cybernexus_host --port 8500
```

---

## 📜 4. DANH MỤC HỒ SƠ DỰ ÁN (DOCS)

* 📄 [01. Kiến Trúc Hệ Thống Tổng Quan](docs/01_TONG_QUAN_KIEN_TRUC_HE_THONG.md)
* 🔌 [02. Chuẩn Giao Tiếp Plugin Độc Lập (.DLL / .SO)](docs/02_CHUAN_GIAO_TIEP_PLUGIN_DLL.md)
* 🔐 [03. Cơ Chế Cấp Phép Bản Quyền & Bảo Mật RSA-4096](docs/03_CO_CHE_CAP_PHEP_VA_BAO_MAT_RSA.md)
* 💰 [04. Mô Hình Kinh Doanh & Bảng Giá Tính Phí](docs/04_MO_HINH_KINH_DOANH_VA_TINH_PHI.md)
* 🧠 [05. Tích Hợp Trí Tuệ Nhân Tạo (AI Features)](docs/05_TICH_HOP_TRI_TUE_NHAN_TAO_AI.md)

---

<div align="center">
Copyright © 2026 SuperAdmin (hungiron-max). All rights reserved.
</div>
