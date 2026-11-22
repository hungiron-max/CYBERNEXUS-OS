# Kế Hoạch Đợt 3 (`v2026.11.21.05`) — Chấm Công, Chốt Ca, Chốt Lương & Tăng Ca (Overtime)

**Phạm vi:** `cybernexus-os` (`slave/src/slave_handlers.cpp`, `slave/src/main_slave.cpp`, `shared/include/auth.hpp`, `shared/src/auth.cpp`, `slave/web/admin.html`, `slave/web/assets/js/admin_inventory.js`, `slave/web/assets/js/admin.js`, `slave/web/assets/js/pos.js`, `slave/web/index.html`)  
**Trạng thái:** *Chờ duyệt triển khai (Đợt 3)* • **Liên kết bảng theo dõi:** `HR-01` → `HR-06` ([qa_tracker_data.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/docs/qa_tracker_data.js))

---

## Tổng Quan 3 Giai Đoạn Triển Khai

| Giai đoạn | Hạng mục | Ưu tiên | Mục tiêu chính |
| :--- | :--- | :---: | :--- |
| **Giai đoạn A — Vá khẩn cấp P0** | `HR-01`, `HR-02` | **P0** | Chặn đứng lỗi spam bản ghi `0.0h` mỗi 45s sau `shift2_end + grace`; chấm dứt tính trùng 2 lần Phiếu Chi tại quầy & Lương trong báo cáo P&L / Dòng tiền. |
| **Giai đoạn B — Chấm công, Mất kết nối & Tăng ca** | `HR-03`, `HR-05` | **P1** | Chốt chuẩn khi rớt mạng/tắt tab/restart server; dùng đúng `shift2_start` khi nghỉ trưa; chạy timer nền `autoProcessShifts()`; xây dựng Module Tăng Ca (`Overtime`) & hỗ trợ ca đêm qua `00:00`. |
| **Giai đoạn C — Chốt Công, Chốt Lương & Chuẩn hóa Ca POS** | `HR-04`, `HR-06` | **P1 / P2** | Bổ sung sửa/thêm/xóa công có Audit Log; tạo bảng `payroll_cycles` & `payroll_items` (chốt sổ tháng, thưởng/phạt KPI, ứng lương, chi lương, Payslip); chuẩn hóa Blind Handover & đối soát ca két tiền `pos_shifts`. |

---

## Giai Đoạn A — Vá Khẩn Cấp P0 (`HR-01`, `HR-02`)

### 1. `HR-01`: Vá vòng lặp spam bản ghi chấm công `0.0h` sau giờ hết Ca 2
- **Nguyên nhân hiện tại (`slave_handlers.cpp`):**
  - Tại `action == "heartbeat"` (`L1128–1129`), `ensureStaffCheckIn()` chạy **trước** `autoProcessShifts()`.
  - Khi bật `shift_autoclose_enabled = 1` và nhân viên vẫn mở máy quá `shift2_end + graceMinutes` (VD `22:46` với mặc định `22:30 + 15p`), `ensureStaffCheckIn()` chèn 1 dòng `working` lúc `22:46:00`, ngay sau đó `autoProcessShifts()` (`L857`) chốt ngược dòng đó về `22:30:00` → `calcHoursBetween("22:46:00", "22:30:00") = 0.0h`, rồi 45 giây sau lặp lại liên tục tạo hàng trăm dòng rác.
- **Thiết kế sửa lỗi:**
  1. Đảo thứ tự tại `heartbeat`: gọi `autoProcessShifts(db)` **trước** `ensureStaffCheckIn(db, ...)`.
  2. Trong `ensureStaffCheckIn()` (`L764–797`): tải `ShiftCfg cfg = loadShiftCfg(db)`; nếu `cfg.autoClose == true` và `nowMin > s2EndMin + cfg.graceMinutes`, kiểm tra xem nhân viên có đang được duyệt tăng ca (`is_overtime_approved = 1`) hay đã qua giờ làm chưa. Nếu **không** được duyệt OT thì **chỉ cập nhật `users.is_online = 1, last_active_at`**, tuyệt đối **không** tạo bản ghi `attendances` mới.
  3. Bảo vệ tại `closeStaffAttendance()` (`L746–762`) và `autoProcessShifts()`: kiểm tra nếu `parseTimestampLocal(checkOutTs) < parseTimestampLocal(inTs)` thì không chốt ngược về quá khứ tạo âm/0 giờ bất thường (dùng `std::max(inT, outT)` hoặc ghi chú cảnh báo bất thường), tránh chèn bản ghi `0.0h` rác.

### 2. `HR-02`: Vá tính trùng 2 lần Phiếu Chi tại quầy & Lương trong P&L / Cashflow
- **Nguyên nhân hiện tại:**
  - `add_cash_tx` (`out`, `L5306–5327`) ghi đồng thời vào **cả `cash_transactions` lẫn `finance_expenses`**. Ngoài ra [pos.js](file:///X:/My%20Drive/Code%20dev/cybernexus-os/slave/web/assets/js/pos.js#L2473) gửi `category = "Nguyên vật liệu"` (khác hoa/thường với `'Nguyên Vật Liệu'` trong `NOT IN` tại `L4686`).
  - Tại `handleFinance()` (`L4685–4850`), `totalOperatingExpenses` và `cashOutflow` cộng **cả `opexExpenses`/`paidFinanceExpenses` (từ `finance_expenses`) lẫn `cashOutCounter` (từ `cash_transactions`)** → chi phí quầy bị trừ **2 lần**.
  - Tương tự, `totalLabor = laborCost (từ attendances) + bonusCost (finance_expenses WHERE category IN ('Lương', 'Thưởng & Phụ Cấp'))` (`L4841`): nếu kế toán chi lương tháng tạo phiếu `'Lương'` thì P&L cộng trùng quỹ lương.
- **Thiết kế sửa lỗi:**
  1. Bổ sung schema an toàn cho `finance_expenses`: thêm cột `source TEXT DEFAULT 'manual'` (`'manual' | 'pos_cash_tx' | 'payroll_payout'`).
  2. Khi `add_cash_tx` (`trans_type == 'out'`) đồng bộ sang `finance_expenses`, ghi rõ `source = 'pos_cash_tx'`. Chuẩn hóa `<option value="Nguyên Vật Liệu">` trong `pos.js` (`L2472`).
  3. Trong `handleFinance()` (`L4685–4705` và `L4999–5025`): `opexExpenses` / `paidFinanceExpenses` / `bonusCost` chỉ tổng hợp các dòng `COALESCE(source, 'manual') = 'manual'` (hoặc loại bỏ `cashOutCounter` vì đã có trong `finance_expenses`), đảm bảo mỗi đồng chi tại quầy chỉ xuất hiện **đúng 1 nguồn duy nhất** ở cả P&L và Dòng tiền.
  4. Tương tự, khi chốt & chi trả lương từ `HR-04`, sinh phiếu chi tự động với `source = 'payroll_payout'`, loại trừ khỏi `bonusCost` tự động trong `totalLabor` để không bao giờ cộng đúp với `laborCost`.

---

## Giai Đoạn B — Ổn Định Chấm Công, Mất Kết Nối & Tăng Ca (`HR-03`, `HR-05`)

### 3. `HR-03`: Xử lý Mất kết nối / Tắt tab / Restart server & Tách ca thông minh
- **Schema bổ sung trên `attendances`:**
  - `last_heartbeat_at TEXT DEFAULT ''`
  - `disconnect_note TEXT DEFAULT ''`
- **Thay đổi logic cốt lõi:**
  1. **Gắn nhịp tim vào từng lượt ca:** Mỗi lần `ensureStaffCheckIn` hoặc `heartbeat` chạy, cập nhật `last_heartbeat_at = nowTs` trực tiếp trên bản ghi `attendances` đang `'working'`.
  2. **Chống mất/dư công khi mất kết nối & ranh giới Ca 1 → Ca 2 (`L833–856`):**
     - Chỉ dùng `stillActive = true` để tự mở Ca 2 nếu nhân viên thực sự có `last_heartbeat_at` trong cửa sổ gần nhất (và phân biệt rõ: nếu bỏ về sớm không logout và quá `heartbeat_timeout_minutes` — VD `30` phút — khi chạy `autoProcessShifts`, chốt ở `min(shift_end, last_heartbeat_at + grace)` với ghi chú `"Tự động chốt (mất tín hiệu cuối)"`, thay vì tự tách mở nguyên Ca 2 10 tiếng!).
     - Nếu `cfg.s2Start > cfg.s1End` (quán có khung giờ nghỉ trưa, VD Ca 1 `07:00–12:00`, Ca 2 `14:00–22:00`), ca mới tách sang Ca 2 phải lấy `check_in_time = today + " " + cfg.s2Start + ":00"` thay vì lấy `cfg.s1End` như hiện nay (`L852`).
     - Hỗ trợ cấu hình ngưỡng cho phép tự nối công khi rớt Wi-Fi ngắn hạn trong cùng ca vs cảnh báo vắng mặt dài.
  3. **Background Timer định kỳ trên Server (`main_slave.cpp`):**
     - Bổ sung timer mỗi `120 giây` gọi `SaleApp::Backend::runPeriodicShiftMaintenance()` (`autoProcessShifts`), không còn phụ thuộc việc phải có trình duyệt mở gửi request mới chốt ca cuối ngày.
  4. **Xử lý khi Restart Server / Mất điện:**
     - Nếu `main_slave.cpp` khởi động lại trong giờ làm việc, hiển thị cảnh báo trên tab **Nhân sự trực tuyến** đối với các dòng `attendances` vẫn ở trạng thái `'working'` từ trước thời điểm khởi động máy chủ (nhận diện phiên vừa reset) để nhân viên/Quản lý kiểm tra; cân nhắc lưu session token ngắn hạn có kiểm soát hoặc giữ cơ chế đăng nhập lại là tự nối tiếp dòng `'working'` trong ngày.

### 4. `HR-05`: Xây Dựng Module Tăng Ca (`Overtime` / OT) & Ca Đêm Qua `00:00`
- **Cấu hình mới trong `store_settings`:**
  - `overtime_enabled` (`0 | 1`), `ot_weekday_rate` (`1.5`), `ot_weekend_rate` (`2.0`), `ot_holiday_rate` (`3.0`), `night_shift_bonus_pct` (`0.3` sau `22:00`), `standard_daily_hours` (`8.0`), `allow_overnight_shift` (`0 | 1`).
- **Cột mới trên `attendances`:**
  - `shift_type TEXT DEFAULT 'regular'` (`'regular' | 'overtime' | 'overnight'`)
  - `regular_hours REAL DEFAULT 0`, `overtime_hours REAL DEFAULT 0`, `overtime_multiplier REAL DEFAULT 1.0`, `overtime_pay REAL DEFAULT 0`
  - `is_overtime_approved INTEGER DEFAULT 0`, `approved_by TEXT DEFAULT ''`
- **Luồng nghiệp vụ & API/UI:**
  1. Thêm API `POST api/operations.php?action=approve_overtime`: Quản lý bật duyệt tăng ca (hoặc nhân viên gửi yêu cầu OT cuối ca → Quản lý duyệt với hệ số `1.5x`/`2.0x`/`3.0x`).
  2. Khi bản ghi có `is_overtime_approved = 1`, `autoProcessShifts()` **không** cưỡng chế đóng tại `shift2_end`, mà tiếp tục đếm giờ OT (và dừng ở ngưỡng trần an toàn hoặc khi checkout).
  3. **Ca đêm qua 00:00:** Khi `allow_overnight_shift = 1` (hoặc `cfg.s2End < cfg.s2Start`, VD `18:00–02:00`), `autoProcessShifts()` tính deadline theo `std::time_t` thực tế (`work_date` + `s2End` + `+1 day` nếu `s2End < s2Start`) thay vì so sánh `wd < today` rồi gán `wd + " 22:30:00"` (`L824–825`).
  4. Hiển thị tách rõ **Giờ chuẩn**, **Giờ OT**, **Hệ số**, **Tiền OT** trên `get_payroll` và `admin.html`.

---

## Giai Đoạn C — Chốt Công, Chốt Lương & Chuẩn Hóa Ca POS (`HR-04`, `HR-06`)

### 5. `HR-04`: Hoàn Thiện Chốt Công & Quy Trình Chốt Kỳ Lương Thực Sự
- **Sửa/Thêm/Xóa Công (Audit Trail):**
  - Thêm `POST api/operations.php?action=save_attendance_record` và `delete_attendance_record` (yêu cầu Admin, bắt buộc nhập `edit_reason`, lưu `audit_logs` trước/sau, **chặn chỉnh sửa nếu tháng đó đã khóa sổ `payroll_cycles.status != 'draft'`**).
  - Thêm nút **Sửa công** trên từng dòng Nhật ký chấm công (`admin_inventory.js`) để xử lý trường hợp quên check-in/out thực tế.
- **Sửa dữ liệu Bảng lương tháng (`get_payroll`):**
  - Bỏ lọc `WHERE status = 'active'` (`L5973`) → lấy `users` đang active **HOẶC** có ít nhất 1 dòng `attendances` trong tháng đó (đảm bảo nhân viên nghỉ giữa tháng vẫn được tính đủ lương).
  - Bỏ `LIMIT 200` cứng (`L6073`) → trả phân trang server (`page`, `page_size`, `total_records`) và xuất đầy đủ cho PDF/CSV.
- **Quy trình Chốt Kỳ Lương Tháng (`payroll_cycles` & `payroll_items`):**
  - Tạo bảng `payroll_cycles` (`id`, `month_key` UNIQUE, `status`: `'draft' | 'locked' | 'paid'`, `total_staff`, `total_hours`, `total_overtime_hours`, `total_gross`, `total_net`, `locked_by`, `locked_at`, `paid_at`, `note`).
  - Tạo bảng `payroll_items` (`id`, `cycle_id`, `user_id`, `user_code`, `user_name`, `user_role`, `hourly_rate`, `total_shifts`, `regular_hours`, `overtime_hours`, `base_pay`, `overtime_pay`, `kpi_score`, `kpi_bonus`, `allowance`, `advance_deduction`, `penalty`, `net_pay`, `note`, `is_paid`, `paid_at`).
  - **API mới (`api/operations.php`):** `create_or_refresh_payroll_cycle`, `update_payroll_item` (nhập thưởng/phụ cấp/ứng lương/khấu trừ và tự kéo gợi ý thưởng/phạt từ `kpi_logs` theo cấu hình đơn giá điểm KPI), `lock_payroll_cycle` (khóa bảng công + bảng lương tháng), `mark_payroll_paid` (xác nhận chi lương & tạo 1 phiếu chi chuẩn vào `finance_expenses` với `source = 'payroll_payout'`).
  - Tích hợp mẫu in **Phiếu lương cá nhân (Payslip)** cho từng nhân viên và **Bảng tổng hợp chi lương tháng**.

### 6. `HR-06`: Chuẩn Hóa Chốt Ca Két Tiền POS (`pos_shifts`)
- **Kiểm đếm mù thực sự (Blind Handover):**
  - Thêm cấu hình `pos_blind_handover` (`store_settings`). Khi bật, modal Kết ca (`pos.js`) **ẩn** `expected_cash` và để trống `#shift-actual-cash` (buộc thu ngân đếm két nhập tay); chỉ hiển thị bảng chênh lệch (`Lệch thừa/thiếu`) sau khi bấm **Chốt Kết Ca** và lưu xong.
- **Cảnh báo bàn / đơn đang mở & Đồng bộ báo cáo:**
  - `close_shift`: kiểm tra số đơn `status NOT IN ('completed', 'cancelled')`; nếu có truyền cảnh báo về UI (hoặc yêu cầu xác nhận từ Quản lý tùy cấu hình).
  - Đồng bộ bộ lọc giữa `close_shift` (`L5375`) và `pos_shift_report` (`L4420`): đều dùng thống nhất `payment_method IN ('banking', 'transfer', 'qr')` cho chuyển khoản, bổ sung đầy đủ `card_sales`/`card_orders` cho `pos_shift_report` và lọc nhất quán theo `paid_at`.
- **Liên kết nhẹ nhàng POS ↔ Chấm công:**
  - Tuỳ chọn trong `pos.js`: hiển thị badge trạng thái ca két đang mở ngay trên header POS; khi bấm **Chốt Kết Ca**, cho phép tick chọn *"Đồng thời Check-out ca làm việc của tôi"*.

---

## Kịch Bản Kiểm Thử Nghiệm Thu (Acceptance Checklist)

| Mã | Kịch bản kiểm thử thực tế | Kết quả kỳ vọng |
| :--- | :--- | :--- |
| **`HR-01`** | Mở POS quá `22:45` khi bật auto-close (chưa duyệt OT) trong 3 phút (4 nhịp heartbeat). | Bảng `attendances` đóng ca cũ ở `22:30` và **không** sinh thêm dòng `0.0h` nào mới. |
| **`HR-02`** | Lập Phiếu Chi quầy `100.000đ` ở ca POS; xem Báo cáo P&L & Dòng tiền. | Chi phí tại quầy chỉ trừ đúng **100.000đ** (không cộng thành `200.000đ`); tổng hợp chi lương không cộng đúp giữa `attendances` và phiếu chi `'Lương'`. |
| **`HR-03`** | (1) Nhân viên đóng trình duyệt bỏ về lúc `11:00`, chờ qua `12:45`. (2) Cài Ca 1 `07:00–12:00`, Ca 2 `14:00–22:00` cho nhân viên vẫn làm tới `14:10`. | (1) Ca 1 tự chốt theo tín hiệu cuối + grace, **không** mở thêm Ca 2 10 tiếng. (2) Nếu làm tiếp Ca 2, giờ vào Ca 2 ghi nhận từ `14:00`. |
| **`HR-04`** | (1) Sửa giờ vào 1 lượt công kèm lý do. (2) Khóa tài khoản 1 nhân viên nghỉ ngày 10 vẫn có công. (3) Khóa sổ kỳ lương tháng & xác nhận chi lương. | (1) Có Audit log & không sửa được sau khi khóa sổ. (2) Nhân viên nghỉ giữa tháng vẫn có đủ dòng lương. (3) Trạng thái kỳ lương `locked -> paid`, sinh Payslip & 1 phiếu chi `payroll_payout`. |
| **`HR-05`** | Duyệt OT (`1.5x`) cho nhân viên làm `22:00–01:00` hôm sau (ca vắt qua `00:00`). | `autoProcessShifts` không cắt giờ tại `22:30`; giờ chuẩn + giờ OT & phụ cấp đêm tính đủ sang `01:00` sáng hôm sau. |
| **`HR-06`** | Bật `pos_blind_handover = 1` → mở Kết ca POS, kiểm tra bảng `pos_shift_report` cho đơn VietQR + Thẻ. | Ô thực đếm trống, ẩn `expected_cash` trước khi chốt; sau chốt hiện đúng chênh lệch và khớp doanh số Cash/Banking/Card với `close_shift`. |
