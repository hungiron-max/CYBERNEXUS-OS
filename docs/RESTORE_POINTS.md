# Điểm Khôi Phục Hệ Thống (Restore Points) — CyberNexus OS

Tài liệu này đánh dấu các mốc khôi phục chính thức trên GitHub (`tag` + `branch`), thư mục OTA (`master/updates/archive/`) và bộ cài đặt (`release/`) để có thể rollback nhanh khi cần.

---

## 1. Mốc khôi phục `v1.2` (OTA `2026.11.16.19`)
- **Git Tag:** `v1.2.0`
- **Restore Branch:** `restore/v1.2`
- **Đặc điểm:** Tách toàn bộ CSS/JS ra file riêng, WiFi Marketing cơ bản (`wifi.html`), Router QoS MikroTik/EdgeRouter, AI Copilot, Lịch phát nhạc theo giờ, SLA/KPI và đánh giá Sao.
- **Lệnh khôi phục mã nguồn Git:**
  ```bash
  git checkout v1.2.0
  # hoặc tạo nhánh làm việc từ mốc khôi phục:
  git checkout -b fix-from-v1.2 restore/v1.2
  ```
- **Gói khôi phục Offline (`release/`):**
  - `release/master_v1.2.zip`
  - `release/cybernexus-store_v1.2.zip`
  - `release/store_patch_update_v1.2.zip`
- **OTA Rollback (`master/updates/archive/`):** `2026.11.16.19`

---

## 2. Mốc khôi phục `v1.3` (OTA `2026.11.16.20`)
- **Git Tag:** `v1.3.0`
- **Restore Branch:** `restore/v1.3`
- **Đặc điểm:** Bổ sung bảo mật Auth cho `POST /api/settings(.php)`, xóa PIN hardcode `'9999'`, bật `Content-Security-Policy` & Security Headers trên C++ Server, thêm `security_utils.js` (`escapeHtml`), và tách `admin.js` thành `admin_inventory.js`, `admin_media_dsp.js`, `admin_finance_ecr.js`.
- **Lệnh khôi phục mã nguồn Git:**
  ```bash
  git checkout v1.3.0
  # hoặc:
  git checkout -b fix-from-v1.3 restore/v1.3
  ```
- **Gói khôi phục Offline (`release/`):**
  - `release/master_v1.3.zip`
  - `release/cybernexus-store_v1.3.zip`
  - `release/store_patch_update_v1.3.zip`
- **OTA Rollback (`master/updates/archive/`):** `2026.11.16.20`

---

## 3. Mốc khôi phục `v2.0` (OTA `2026.11.16.21` — Hiện tại)
- **Git Tag:** `v2.0.0`
- **Restore Branch:** `restore/v2.0`
- **Đặc điểm:** Hoàn thiện kiến trúc **5 lõi Native C++ DLL + `.sig`** (thêm `libmod_finance_admin.dll` và `/api/pos/calculate-cart` trong `libmod_pos_core.dll`), giao diện WiFi Marketing Mobile-First (`wifi_portal.css`), và Jukebox giới hạn tối đa 5 bài chờ + 1 lượt vote/bài mỗi IP/thiết bị.
- **Lệnh khôi phục mã nguồn Git:**
  ```bash
  git checkout v2.0.0
  # hoặc:
  git checkout -b fix-from-v2.0 restore/v2.0
  ```
- **Gói khôi phục Offline (`release/`):**
  - `release/master_v2.0.zip`
  - `release/cybernexus-store_v2.0.zip`
  - `release/store_patch_update_v2.0.zip`
- **OTA Rollback (`master/updates/archive/`):** `2026.11.16.21`
