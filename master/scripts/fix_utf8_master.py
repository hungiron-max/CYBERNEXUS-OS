import sqlite3

db_path = r"X:\My Drive\Code dev\cybernexus-os\master\database\cybernexus_master.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Clear and reinsert saas_staff_users
cur.execute("DELETE FROM saas_staff_users")
staff_data = [
    (1, "superadmin", "$2a$10$7R6v78aO.z75kR7w3s/h..5FsqPzW7c1R/s8x3R7w3s/h..5FsqPz", "Võ Huỳnh Duy (CEO)", "ceo@cybernexus.vn", "0901234567", "superadmin", "Ban Giám Đốc", '["*"]', "👨‍💼", "active"),
    (2, "kythuat_nam", "$2a$10$7R6v78aO.z75kR7w3s/h..5FsqPzW7c1R/s8x3R7w3s/h..5FsqPz", "Nguyễn Hoàng Nam (Tech Lead)", "techlead@cybernexus.vn", "0912345678", "kythuat", "Kỹ Thuật & Triển Khai", '["tech_build","module_toggle","hardware_unlock","download_release","debug"]', "👨‍💻", "active"),
    (3, "ketoan_lan", "$2a$10$7R6v78aO.z75kR7w3s/h..5FsqPzW7c1R/s8x3R7w3s/h..5FsqPz", "Trần Mai Lan (Kế Toán Trưởng)", "ketoan@cybernexus.vn", "0923456789", "ketoan", "Tài Chính & Kế Toán", '["invoice_manage","contract_view","payment_confirm","financial_report"]', "👩‍💼", "active"),
    (4, "kinhdoanh_duc", "$2a$10$7R6v78aO.z75kR7w3s/h..5FsqPzW7c1R/s8x3R7w3s/h..5FsqPz", "Lê Minh Đức (Sales Manager)", "sales@cybernexus.vn", "0934567890", "kinhdoanh", "Kinh Doanh & CSKH", '["tenant_create","contract_upload","license_extend","package_overview"]', "👔", "active"),
    (5, "audit_kiemtoan", "$2a$10$7R6v78aO.z75kR7w3s/h..5FsqPzW7c1R/s8x3R7w3s/h..5FsqPz", "Phạm Thanh Sơn (Auditor)", "audit@cybernexus.vn", "0945678901", "kiemtoan", "Kiểm Toán & Giám Sát", '["audit_read_only","security_inspect","export_audit_log"]', "🕵️", "active")
]

cur.executemany("""
    INSERT INTO saas_staff_users (id, username, password_hash, fullname, email, phone, role, department, permissions, avatar, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
""", staff_data)

# Clear and reinsert saas_audit_logs
cur.execute("DELETE FROM saas_audit_logs")
audit_data = [
    (1, 1, "superadmin", "superadmin", "SYSTEM_START", "SYSTEM", "Khởi tạo hệ thống máy chủ CyberNexus Master Cloud SaaS v1.0", "{}", "127.0.0.1"),
    (2, 2, "kythuat_nam", "kythuat", "HARDWARE_BIND", "GP001", "Gắn khóa phần cứng máy trạm (Machine GUID: 05C9-C8E6-B923-5B6C-A768)", "{\"hw_guid\":\"05C9-C8E6-B923-5B6C-A768\"}", "192.168.1.102"),
    (3, 3, "ketoan_lan", "ketoan", "INVOICE_CREATE", "GP001", "Phát hành Hóa đơn điện tử VAT-CBNX-2026-00124 (Trị giá 5.988.000đ)", "{\"invoice_no\":\"VAT-CBNX-2026-00124\",\"amount\":5988000}", "192.168.1.103"),
    (4, 2, "kythuat_nam", "kythuat", "PACKAGE_BUILD", "GP001", "Đóng gói 1-Click thành công bộ cài đặt CyberNexus_POS_Release_GP001.zip (15.6 MB)", "{\"file\":\"CyberNexus_POS_Release_GP001.zip\",\"size_mb\":15.6}", "192.168.1.102"),
    (5, 1, "superadmin", "superadmin", "MODULE_TOGGLE", "GP001", "Cấp phép kích hoạt Module mod_media_stream và mod_network_qos", "{\"modules\":[\"media\",\"qos\"],\"status\":1}", "127.0.0.1"),
    (6, 4, "kinhdoanh_duc", "kinhdoanh", "CONTRACT_UPLOAD", "GP001", "Tải lên Hợp đồng điện tử bản scan HD-CBNX-2026-GP001.pdf", "{\"doc_type\":\"contract\",\"file\":\"HD-CBNX-2026-GP001.pdf\"}", "192.168.1.104")
]

cur.executemany("""
    INSERT INTO saas_audit_logs (id, staff_id, username, role, action, target_tenant, description, metadata_json, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
""", audit_data)

conn.commit()
conn.close()
print("Successfully populated saas_staff_users and saas_audit_logs with clean UTF-8.")
