#include "license.hpp"
#include "db.hpp"
#include "auth.hpp"
#include "httplib.h"
#include "ConfigManager.hpp"
#include <iostream>
#include <sstream>
#include <algorithm>
#include <ctime>
#include <chrono>

#ifdef _WIN32
#include <windows.h>
#endif

namespace SaleApp::Backend {

LicenseService& LicenseService::instance() {
    static LicenseService s_instance;
    return s_instance;
}

LicenseService::LicenseService() {
    initCatalog();
    ensureTableExists();
}

void LicenseService::ensureTableExists() {
    try {
        auto& db = Database::instance();
        db.execute(R"(
            CREATE TABLE IF NOT EXISTS local_license_cache (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                license_key TEXT DEFAULT 'GP-ENTERPRISE-2026-NEXUS',
                store_name TEXT DEFAULT 'Góc Phố Coffee & Tea',
                owner_name TEXT DEFAULT 'Chủ Hộ Kinh Doanh',
                plan_name TEXT DEFAULT 'Gói Chuỗi Đỉnh Cao (Enterprise)',
                subscription_status TEXT DEFAULT 'active',
                expire_date TEXT DEFAULT '2028-12-31',
                days_left INTEGER DEFAULT 730,
                machine_id TEXT,
                bound_machine_id TEXT,
                enabled_modules TEXT DEFAULT '["pos_core","vietqr_payment","qr_customer_order","qr_table_order","advertising_promotions","kitchen_kds","inventory_recipes","advanced_reports","staff_shifts"]',
                last_sync_at TEXT,
                last_sync_status TEXT DEFAULT 'ready'
            )
        )");

        // Insert initial license record if empty
        auto row = db.queryRow("SELECT id, enabled_modules, blocked_modules FROM local_license_cache WHERE id = 1");
        if (row.is_null()) {
            std::string mid = getMachineId();
            db.execute(R"(
                INSERT INTO local_license_cache 
                (id, license_key, store_name, owner_name, plan_name, subscription_status, expire_date, days_left, machine_id, bound_machine_id, enabled_modules, last_sync_at, last_sync_status)
                VALUES (1, 'GP-ENTERPRISE-2026-NEXUS', 'Góc Phố Coffee & Tea', 'Chủ Quán', 'Gói Chuỗi Đỉnh Cao (Enterprise)', 'active', '2028-12-31', 730, :mid, :mid, '["pos_core","vietqr_payment","qr_customer_order","qr_table_order","advertising_promotions","kitchen_kds","inventory_recipes","advanced_reports","staff_shifts","mod_media_stream","mod_network_qos","mod_card_payment"]', datetime('now'), 'ok')
            )", {{":mid", mid}});
        }
        try { db.execute("ALTER TABLE local_license_cache ADD COLUMN blocked_modules TEXT DEFAULT '[]'"); } catch (...) {}
        try { db.execute("ALTER TABLE local_license_cache ADD COLUMN card_fee_percent REAL DEFAULT 0.0"); } catch (...) {}
        try {
            auto r2 = db.queryRow("SELECT enabled_modules, blocked_modules FROM local_license_cache WHERE id = 1");
            if (!r2.is_null()) {
                std::string em = r2.value("enabled_modules", "[]");
                std::string bm = r2.value("blocked_modules", "[]");
                if (em.find("mod_card_payment") == std::string::npos && bm.find("mod_card_payment") == std::string::npos) {
                    json arr = json::parse(em, nullptr, false);
                    if (arr.is_array()) {
                        arr.push_back("mod_card_payment");
                        db.execute("UPDATE local_license_cache SET enabled_modules = :em WHERE id = 1", {{":em", arr.dump()}});
                    }
                }
            }
        } catch (...) {}
    } catch (const std::exception& e) {
        std::cerr << "[Slave License Warning] ensureTableExists: " << e.what() << std::endl;
    }
}

void LicenseService::initCatalog() {
    m_catalog = {
        {
            "pos_core", "POS Bán Hàng & In Nhiệt",
            "Tạo đơn tại quầy, chia bàn Mang Về/Tại Quán, In hóa đơn nhiệt K80/K58, tách và gộp bàn nhanh.",
            "fa-cash-register", "Cốt Lõi", "sky", "Bán Hàng", true, false, 0.0, {}
        },
        {
            "vietqr_payment", "Thanh Toán VietQR Tự Động",
            "Tự động sinh mã VietQR động theo từng hóa đơn, khách quét chuyển khoản ngân hàng chuẩn xác.",
            "fa-qrcode", "Thanh Toán", "emerald", "Thanh Toán", false, false, 0.0, {}
        },
        {
            "qr_customer_order", "Thực Đơn QR Khách Hàng",
            "Khách xem thực đơn điện tử, thông tin thanh toán và đặt món mang về qua smartphone (customer.php).",
            "fa-mobile-screen-button", "Tự Động", "purple", "Khách Hàng", false, false, 0.0, {}
        },
        {
            "qr_table_order", "Đặt Món QR Theo Bàn",
            "Khách quét mã riêng tại bàn để thêm món vào hóa đơn đang mở; yêu cầu module Thực Đơn QR Khách Hàng.",
            "fa-qrcode", "Add-on", "amber", "Khách Hàng", false, true, 0.0, {"qr_customer_order"}
        },
        {
            "advertising_promotions", "Quảng Cáo & Khuyến Mãi",
            "Mở rộng Thực Đơn QR Khách Hàng với trình chiếu ảnh/video giới thiệu quán, chương trình KM và quảng cáo.",
            "fa-photo-film", "Marketing", "fuchsia", "Khách Hàng", false, false, 0.0, {}
        },
        {
            "kitchen_kds", "Màn Hình Bếp & Pha Chế (KDS)",
            "Giao diện hiển thị đơn thời gian thực cho Bếp & Quầy Bar (kitchen.php) kèm âm báo và trạng thái món.",
            "fa-utensils", "Vận Hành", "amber", "Chế Biến", false, false, 0.0, {}
        },
        {
            "inventory_recipes", "Quản Lý Kho & Định Lượng Vật Tư",
            "Kiểm soát tồn kho nguyên vật liệu, trừ kho tự động theo công thức món ăn, cảnh báo sắp hết nguyên liệu.",
            "fa-boxes-stacked", "Kho Vận", "indigo", "Kho Bãi", false, false, 0.0, {}
        },
        {
            "ai_invoice_ocr", "AI OCR Hóa Đơn & Giấy Viết Tay",
            "Trí tuệ nhân tạo Google Gemini Vision AI bóc tách hóa đơn in nhiệt và phiếu viết tay nhập kho tự động.",
            "fa-brain", "AI Thông Minh", "rose", "Trí Tuệ Nhân Tạo", false, false, 0.0, {}
        },
        {
            "ai_dish_studio", "AI Tạo Ảnh Món Ăn Tự Động",
            "Studio AI tạo ảnh đồ uống, món ăn chuyên nghiệp chuẩn tỷ lệ 4:3 cho menu bán hàng tự động.",
            "fa-wand-magic-sparkles", "AI Studio", "fuchsia", "Trí Tuệ Nhân Tạo", false, false, 0.0, {}
        },
        {
            "advanced_reports", "Báo Cáo Doanh Thu Chuyên Sâu",
            "Phân tích tài chính chi tiết với biểu đồ Chart.js, thống kê giờ vàng đông khách, xếp hạng món bán chạy nhất.",
            "fa-chart-pie", "Phân Tích", "cyan", "Báo Cáo", false, false, 0.0, {}
        },
        {
            "staff_shifts", "Nhân Viên, Phân Ca & Chấm Công",
            "Chấm công tự động khi nhân viên đăng nhập, thiết lập ca sáng/chiều/tối, tính lương giờ và xuất bảng lương.",
            "fa-user-clock", "Nhân Sự", "teal", "Nhân Sự", false, false, 0.0, {}
        },
        {
            "staff_kpi", "KPI, Thưởng & Phụ Cấp Nhân Viên",
            "Chấm điểm KPI tự động từ chấm công và đơn hàng, thưởng/phạt, phụ cấp và thực nhận từng nhân viên; yêu cầu module Nhân Viên, Phân Ca & Chấm Công.",
            "fa-bullseye", "Add-on", "fuchsia", "Nhân Sự", false, true, 99000.0, {"staff_shifts"}
        },
        {
            "finance_reports", "Báo Cáo Tài Chính: Doanh Thu, Lãi Lỗ, Chi Phí & Thuế",
            "Báo cáo lãi/lỗ theo tháng: doanh thu, giá vốn, các loại chi phí, lương nhân sự, thuế GTGT/TNDN, điểm hòa vốn và xuất CSV cho kế toán; yêu cầu module Báo Cáo Nâng Cao.",
            "fa-file-invoice-dollar", "Add-on", "teal", "Tài Chính", false, true, 199000.0, {"advanced_reports"}
        },
        {
            "cloud_sync_backup", "Sao Lưu & Đồng Bộ Đa Chi Nhánh",
            "Tự động sao lưu dữ liệu SQLite/MySQL, hỗ trợ đồng bộ dữ liệu đám mây đa chi nhánh và khôi phục khi cần.",
            "fa-cloud-arrow-up", "Đám Mây", "sky", "Hệ Thống", false, false, 0.0, {}
        },
        {
            "mod_media_stream", "Máy Chủ Media Streaming & Smart Jukebox",
            "Stream nhạc Lossless Offline 100%, 10-Band DSP Equalizer Studio, QR Jukebox khách chọn bài và cơ chế Auto Audio Ducking.",
            "fa-compact-disc", "Add-on", "fuchsia", "Giải Trí", false, true, 149000.0, {}
        },
        {
            "mod_network_qos", "Quản Trị Băng Thông & Tường Lửa Router (SNM)",
            "Điều khiển Router Ubiquiti / MikroTik: Cấp băng thông VIP cho khách có hóa đơn, chặn web đen, lọc DNS và bảo vệ mạng quán.",
            "fa-network-wired", "Add-on", "amber", "Hạ Tầng", false, true, 199000.0, {}
        },
        {
            "mod_card_payment", "Cổng Cà Thẻ Tín Dụng & SmartPOS (ECR)",
            "Liên kết tự động máy POS/SmartPOS ngân hàng đời mới (PAX, Sunmi, Verifone, Ingenico, VNPAY), đẩy số tiền tự động, thu phụ phí thẻ & đối soát lô.",
            "fa-credit-card", "Add-on", "indigo", "Thanh Toán", false, true, 149000.0, {}
        }
    };

    m_catalogIndex.clear();
    for (size_t i = 0; i < m_catalog.size(); ++i) {
        m_catalogIndex[m_catalog[i].code] = i;
    }
}

const std::vector<SaasModule>& LicenseService::getCatalog() const {
    return m_catalog;
}

bool LicenseService::isModuleValid(const std::string& code) const {
    return m_catalogIndex.find(code) != m_catalogIndex.end();
}

std::vector<std::string> LicenseService::getModuleRequirements(const std::string& code) const {
    auto it = m_catalogIndex.find(code);
    if (it != m_catalogIndex.end()) {
        return m_catalog[it->second].requires;
    }
    return {};
}

json LicenseService::getModuleMatrix(const std::vector<std::string>& enabledModules) const {
    json matrix = json::array();
    for (const auto& mod : m_catalog) {
        bool isEnabled = (std::find(enabledModules.begin(), enabledModules.end(), mod.code) != enabledModules.end());
        matrix.push_back({
            {"code", mod.code},
            {"name", mod.name},
            {"desc", mod.desc},
            {"icon", mod.icon},
            {"badge", mod.badge},
            {"badge_color", mod.badge_color},
            {"category", mod.category},
            {"required", mod.required},
            {"addon", mod.addon},
            {"price_month", mod.price_month},
            {"requires", mod.requires},
            {"enabled", isEnabled}
        });
    }
    return matrix;
}

std::string LicenseService::getMachineId() {
    if (!m_cachedMachineId.empty()) {
        return m_cachedMachineId;
    }

    std::string rawGuid = "";

#ifdef _WIN32
    HKEY hKey;
    if (RegOpenKeyExA(HKEY_LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Cryptography", 0, KEY_READ | KEY_WOW64_64KEY, &hKey) == ERROR_SUCCESS) {
        char val[256] = {0};
        DWORD valSize = sizeof(val);
        DWORD type = REG_SZ;
        if (RegQueryValueExA(hKey, "MachineGuid", NULL, &type, (LPBYTE)val, &valSize) == ERROR_SUCCESS) {
            rawGuid = val;
        }
        RegCloseKey(hKey);
    }
#endif

    if (rawGuid.empty()) {
#ifdef _WIN32
        char compName[MAX_COMPUTERNAME_LENGTH + 1] = {0};
        DWORD compLen = sizeof(compName);
        if (GetComputerNameA(compName, &compLen)) {
            rawGuid = compName;
        } else {
            rawGuid = "WINDOWS-GENERIC-POS";
        }
#else
        rawGuid = "GENERIC-POS-MACHINE";
#endif
    }

    std::transform(rawGuid.begin(), rawGuid.end(), rawGuid.begin(), ::tolower);
    std::string hash = AuthService::sha256("saleapp-machine|" + rawGuid);
    std::string hex = hash.substr(0, 20);
    std::transform(hex.begin(), hex.end(), hex.begin(), ::toupper);

    std::string formatted = "";
    for (size_t i = 0; i < hex.length(); i += 4) {
        if (!formatted.empty()) formatted += "-";
        formatted += hex.substr(i, 4);
    }

    m_cachedMachineId = formatted;
    return m_cachedMachineId;
}

std::vector<std::string> LicenseService::getEnabledModules(int64_t tenantId) {
    (void)tenantId;
    auto& db = Database::instance();
    auto row = db.queryRow("SELECT enabled_modules FROM local_license_cache WHERE id = 1");

    std::vector<std::string> modules;
    if (!row.is_null() && row.contains("enabled_modules") && row["enabled_modules"].is_string()) {
        try {
            json arr = json::parse(row["enabled_modules"].get<std::string>());
            if (arr.is_array()) {
                for (const auto& item : arr) {
                    if (item.is_string()) {
                        modules.push_back(item.get<std::string>());
                    }
                }
            }
        } catch (...) {}
    }

    if (std::find(modules.begin(), modules.end(), "pos_core") == modules.end()) {
        modules.insert(modules.begin(), "pos_core");
    }

    return modules;
}

bool LicenseService::isModuleEnabled(const std::string& moduleCode) {
    if (moduleCode == "pos_core" || moduleCode == "mod_pos_core") return true;
    std::string stripped = moduleCode;
    if (stripped.rfind("mod_", 0) == 0) stripped = stripped.substr(4);
    if (stripped == "pos_core") return true;

    auto& db = Database::instance();
    auto row = db.queryRow("SELECT blocked_modules FROM local_license_cache WHERE id = 1");
    if (!row.is_null() && row.contains("blocked_modules") && row["blocked_modules"].is_string()) {
        try {
            json bArr = json::parse(row["blocked_modules"].get<std::string>(), nullptr, false);
            if (bArr.is_array()) {
                for (const auto& item : bArr) {
                    if (!item.is_string()) continue;
                    std::string b = item.get<std::string>();
                    if (b == moduleCode || b == stripped || ("mod_" + b) == moduleCode) {
                        return false;
                    }
                }
            }
        } catch (...) {}
    }

    auto enabled = getEnabledModules();
    for (const auto& m : enabled) {
        if (m == moduleCode || m == stripped || ("mod_" + m) == moduleCode) return true;
    }
    return false;
}

bool LicenseService::isSuperAdminMode() const {
    return false; // Máy trạm Slave (POS Edge Node) hoàn toàn không có quyền SuperAdmin Master
}

void LicenseService::setSuperAdminMode(bool enabled) {
    (void)enabled;
    m_superAdminMode = false;
}

json LicenseService::toggleModule(int64_t tenantId, const std::string& moduleCode, bool enabled) {
    (void)tenantId; (void)moduleCode; (void)enabled;
    return {
        {"success", false},
        {"message", "Máy trạm Slave không có quyền sửa module trực tiếp. Vui lòng cấu hình trên Máy chủ Master SaaS!"}
    };
}

json LicenseService::setAllModules(int64_t tenantId, const std::string& mode) {
    (void)tenantId; (void)mode;
    return {
        {"success", false},
        {"message", "Máy trạm Slave không có quyền sửa module trực tiếp. Vui lòng cấu hình trên Máy chủ Master SaaS!"}
    };
}

// Online Heartbeat / License Verification with Master SaaS Platform
json LicenseService::verifyLicenseOnline(const std::string& licenseKey, const std::string& machineId) {
    std::string masterUrl = SaleApp::Config::AppConfig::instance().getMasterServerUrl();
    if (masterUrl.empty()) {
        masterUrl = "http://127.0.0.1:8500";
    }

    try {
        httplib::Client cli(masterUrl);
        cli.set_connection_timeout(3, 0);
        cli.set_read_timeout(5, 0);

        json reqBody = {
            {"action", "verify"},
            {"license_key", licenseKey},
            {"machine_id", machineId}
        };

        auto res = cli.Post("/api/license/verify", reqBody.dump(), "application/json");
        if (res && res->status == 200) {
            json resp = json::parse(res->body);
            if (resp.value("success", false)) {
                // Update local license cache
                auto& db = Database::instance();
                std::string storeName = resp.value("store_name", "Góc Phố Coffee & Tea");
                std::string planName = resp.value("plan_name", "Gói Tiêu Chuẩn");
                std::string subStatus = resp.value("state", "active");
                std::string expireDate = resp.value("expire_date", "2028-12-31");
                
                std::string enabledModsStr = "[\"pos_core\",\"vietqr_payment\"]";
                if (resp.contains("enabled_modules") && resp["enabled_modules"].is_array()) {
                    enabledModsStr = resp["enabled_modules"].dump();
                }
                std::string blockedModsStr = "[]";
                if (resp.contains("blocked_modules") && resp["blocked_modules"].is_array()) {
                    blockedModsStr = resp["blocked_modules"].dump();
                }
                double cardFeePct = resp.value("card_fee_percent", 0.0);

                db.execute(R"(
                    UPDATE local_license_cache 
                    SET license_key = :k, store_name = :sn, plan_name = :pn, subscription_status = :st,
                        expire_date = :exp, enabled_modules = :em, blocked_modules = :bm, card_fee_percent = :cfp,
                        last_sync_at = datetime('now'), last_sync_status = 'online_ok', bound_machine_id = :mid
                    WHERE id = 1
                )", {
                    {":k", licenseKey},
                    {":sn", storeName},
                    {":pn", planName},
                    {":st", subStatus},
                    {":exp", expireDate},
                    {":em", enabledModsStr},
                    {":bm", blockedModsStr},
                    {":cfp", cardFeePct},
                    {":mid", machineId}
                });

                return {
                    {"success", true},
                    {"message", "Xác thực bản quyền trực tuyến thành công với Máy chủ Master!"},
                    {"data", resp}
                };
            } else {
                return {
                    {"success", false},
                    {"message", resp.value("message", "Máy chủ Master từ chối mã bản quyền!")}
                };
            }
        } else if (res && res->status == 403) {
            json resp = json::parse(res->body);
            return {
                {"success", false},
                {"message", resp.value("message", "Mã bản quyền bị xung đột phần cứng (Hardware Node-Lock)!")}
            };
        } else {
            return {
                {"success", false},
                {"message", "Không thể kết nối đến Máy chủ Master SaaS tại: " + masterUrl + " (HTTP " + (res ? std::to_string(res->status) : "TIMEOUT") + ")"}
            };
        }
    } catch (const std::exception& e) {
        return {
            {"success", false},
            {"message", std::string("Lỗi kết nối Master: ") + e.what()}
        };
    }
}

json LicenseService::activateLicense(const std::string& licenseKey) {
    if (licenseKey.empty()) {
        return {{"success", false}, {"message", "Vui lòng nhập License Key!"}};
    }

    std::string mid = getMachineId();
    json verifyRes = verifyLicenseOnline(licenseKey, mid);
    if (verifyRes.value("success", false)) {
        return {
            {"success", true},
            {"message", "Kích hoạt bản quyền thành công cho máy " + mid + "!"},
            {"machine_id", mid}
        };
    }

    return verifyRes;
}

json LicenseService::getLicenseStatus(int64_t tenantId) {
    (void)tenantId;
    auto& db = Database::instance();
    auto t = db.queryRow("SELECT * FROM local_license_cache WHERE id = 1");

    if (t.is_null()) {
        ensureTableExists();
        t = db.queryRow("SELECT * FROM local_license_cache WHERE id = 1");
    }

    std::string machineId = getMachineId();
    std::string boundMid = t.value("bound_machine_id", machineId);
    std::string expireDate = t.value("expire_date", "2028-12-31");
    std::string subStatus = t.value("subscription_status", "active");
    std::string key = t.value("license_key", "");

    // Calculate days remaining
    int daysLeft = 365;
    std::tm expTm = {};
    if (std::sscanf(expireDate.c_str(), "%d-%d-%d", &expTm.tm_year, &expTm.tm_mon, &expTm.tm_mday) == 3) {
        expTm.tm_year -= 1900;
        expTm.tm_mon -= 1;
        std::time_t expTime = std::mktime(&expTm);
        std::time_t now = std::time(nullptr);
        double diffSecs = std::difftime(expTime, now);
        daysLeft = static_cast<int>(diffSecs / 86400.0);
    }

    std::string state = "valid";
    std::string msg = "Bản quyền hợp lệ (Chế độ Edge Node Offline-First).";
    if (daysLeft < 0 || subStatus == "expired") {
        state = "expired";
        msg = "Bản quyền đã hết hạn. Vui lòng liên hệ nhà phát triển để gia hạn.";
    } else if (daysLeft <= 14) {
        subStatus = "expiring_soon";
        msg = "Bản quyền sắp hết hạn trong " + std::to_string(daysLeft) + " ngày.";
    }

    auto enabledRaw = getEnabledModules();
    json blockedArr = json::array();
    if (t.contains("blocked_modules") && t["blocked_modules"].is_string()) {
        try {
            json parsedB = json::parse(t["blocked_modules"].get<std::string>(), nullptr, false);
            if (parsedB.is_array()) blockedArr = parsedB;
        } catch (...) {}
    }
    std::vector<std::string> enabled;
    for (const auto& m : enabledRaw) {
        bool isBlk = false;
        for (const auto& b : blockedArr) {
            if (b.is_string() && b.get<std::string>() == m) { isBlk = true; break; }
        }
        if (!isBlk) enabled.push_back(m);
    }

    std::string maskedKey = "";
    if (key.length() >= 9) {
        maskedKey = key.substr(0, 9) + "****-****-" + key.substr(key.length() - 4);
    } else {
        maskedKey = key;
    }

    return {
        {"success", true},
        {"data", {
            {"client_mode", true},
            {"state", state},
            {"message", msg},
            {"store_name", t.value("store_name", "Góc Phố Coffee & Tea")},
            {"owner_name", t.value("owner_name", "Chủ Quán")},
            {"plan_name", t.value("plan_name", "Gói Chuỗi Đỉnh Cao (Enterprise)")},
            {"subscription_status", subStatus},
            {"start_date", "2026-01-01"},
            {"expire_date", expireDate},
            {"days_left", daysLeft},
            {"machine_id", machineId},
            {"bound_machine_id", boundMid},
            {"machine_matched", (boundMid.empty() || boundMid == machineId)},
            {"license_key_masked", maskedKey},
            {"modules", enabled},
            {"blocked_modules", blockedArr},
            {"active_module_count", enabled.size()},
            {"total_catalog_count", m_catalog.size()},
            {"last_sync_at", t.value("last_sync_at", "")},
            {"master_server_url", SaleApp::Config::AppConfig::instance().getMasterServerUrl()},
            {"app_version", "v2.5.0 C++ Native Zero-Trust"}
        }}
    };
}

} // namespace SaleApp::Backend
