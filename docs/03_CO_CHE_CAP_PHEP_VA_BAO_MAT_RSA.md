# 🔐 CƠ CHẾ CẤP PHÉP & BẢO MẬT MẬT MÃ HỌC RSA-4096

> **Giải pháp bảo vệ tài sản trí tuệ và kiểm soát phân quyền cho SuperAdmin**

---

## 1. MÃ HÓA CHỮ KÝ SỐ ĐỘC QUYỀN (RSA-4096 DIGITAL SIGNATURE)

Để ngăn chặn việc khách hàng tự ý sửa đổi code, nhúng DLL lạ hoặc dùng bản crack:
1. Mỗi file `mod_xyz.dll` khi xuất xưởng sẽ được công cụ `ModuleSigner` của SuperAdmin băm (SHA-256) và mã hóa bằng **Khóa Riêng (Private Key)** chỉ một mình SuperAdmin sở hữu.
2. File chữ ký đi kèm có đuôi `.sig` (ví dụ: `mod_network_qos.dll.sig`).
3. Host Core chứa **Khóa Công Khai (Public Key)**:
   * Khi nạp DLL, Core tính toán mã băm SHA-256 thực tế của file DLL trên ổ cứng.
   * Giải mã file `.sig` bằng Public Key.
   * Nếu 2 mã băm trùng khớp: Cho phép nạp vào RAM.
   * Nếu sai lệch dù chỉ 1 byte: Từ chối nạp và kích hoạt cờ cảnh báo an ninh.

---

## 2. KHÓA BẢN QUYỀN THEO PHẦN CỨNG (HARDWARE NODE-LOCKING)

Hệ thống tính toán **Hardware Fingerprint** của máy khách hàng dựa trên 3 thông số phần cứng độc lập:
* **CPU ID:** Processor Serial & Architecture.
* **Motherboard UUID:** Thông tin bo mạch chủ Windows WMI / Linux DMI.
* **Ổ cứng hệ thống:** Volume Serial Number.

```
Hardware Hash = SHA256(CPU_ID + MB_UUID + DISK_SERIAL)
Ví dụ: "A8F9-2B01-9C3E-F4D2"
```

---

## 3. CẤU TRÚC LICENSE TOKEN CỦA KHÁCH HÀNG

Khi quán mua bản quyền, SuperAdmin cấp 1 file License dạng JSON được ký số RSA:

```json
{
  "client_id": "CYBER_ARENA_QUAN_1",
  "client_name": "Cyber Gaming Arena Quận 1",
  "hardware_hash": "A8F9-2B01-9C3E-F4D2",
  "issued_date": "2026-11-01T00:00:00",
  "expires_date": "2027-11-01T23:59:59",
  "max_tables_or_pcs": 60,
  "licensed_modules": [
    {"code": "mod_pos_core", "tier": "lifetime"},
    {"code": "mod_vietqr_pay", "tier": "subscription"},
    {"code": "mod_kds_kitchen", "tier": "subscription"},
    {"code": "mod_network_qos", "tier": "subscription"},
    {"code": "mod_media_stream", "tier": "subscription"},
    {"code": "mod_ai_copilot", "tier": "subscription", "monthly_token_quota": 500000}
  ],
  "superadmin_signature": "MEQCIB...RSA_BASE64_SIGNATURE..."
}
```

---

## 4. CÔNG TẮC BẬT/TẮT TỪ XA (REMOTE KILL-SWITCH)

* Định kỳ mỗi 24 giờ (hoặc khi có kết nối Internet), Host Core gửi gói tin Heartbeat về máy chủ Cloud của SuperAdmin.
* Nếu SuperAdmin đánh dấu khách hàng đang nợ phí hoặc hủy hợp đồng:
  * Máy chủ gửi lệnh `REVOKE_LICENSE` hoặc `DISABLE_MODULE:[code]`.
  * Host Core lập tức gọi `PluginManager::unloadPlugin()` để giải phóng DLL tương ứng khỏi bộ nhớ RAM ngay lập tức mà không cần nhân viên đến tận nơi.
