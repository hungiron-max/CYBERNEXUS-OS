#include "license.hpp"
#include "license_crypto.hpp"
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
        if (!db.getHandle()) return;
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

        json cols = db.query("PRAGMA table_info(local_license_cache)");
        auto hasCol = [&](const char* name) {
            for (const auto& c : cols) {
                if (c.value("name", "") == name) return true;
            }
            return false;
        };
        if (!hasCol("blocked_modules")) {
            try { db.execute("ALTER TABLE local_license_cache ADD COLUMN blocked_modules TEXT DEFAULT '[]'"); } catch (...) {}
        }
        if (!hasCol("card_fee_percent")) {
            try { db.execute("ALTER TABLE local_license_cache ADD COLUMN card_fee_percent REAL DEFAULT 0.0"); } catch (...) {}
        }
        if (!hasCol("license_signature")) {
            try { db.execute("ALTER TABLE local_license_cache ADD COLUMN license_signature TEXT DEFAULT ''"); } catch (...) {}
        }
        if (!hasCol("grace_days")) {
            try { db.execute("ALTER TABLE local_license_cache ADD COLUMN grace_days INTEGER DEFAULT 7"); } catch (...) {}
        }
        if (!hasCol("offline_max_days")) {
            try { db.execute("ALTER TABLE local_license_cache ADD COLUMN offline_max_days INTEGER DEFAULT 14"); } catch (...) {}
        }
        if (!hasCol("issued_at")) {
            try { db.execute("ALTER TABLE local_license_cache ADD COLUMN issued_at INTEGER DEFAULT 0"); } catch (...) {}
        }
        if (!hasCol("key_id")) {
            try { db.execute("ALTER TABLE local_license_cache ADD COLUMN key_id TEXT DEFAULT 'k1'"); } catch (...) {}
        }

        // LIC-01: Strict Fail-Closed initialization (không cấp hạn ảo 2028-12-31 cho DB mới chưa kích hoạt)
        auto row = db.queryRow("SELECT id, enabled_modules, blocked_modules FROM local_license_cache WHERE id = 1");
        if (row.is_null()) {
            std::string mid = getMachineId();
            std::string cfgKey = "";
            std::string cfgStore = "CyberNexus POS";
            try {
                auto cfgPath = SaleApp::Config::AppConfig::instance().getBaseDir() / "config.json";
                std::ifstream cf(cfgPath);
                if (cf) {
                    json cj = json::parse(cf, nullptr, false);
                    if (cj.is_object()) {
                        cfgKey = cj.value("license_key", "");
                        std::string sn = cj.value("store_name", "");
                        if (!sn.empty()) cfgStore = sn;
                    }
                }
            } catch (...) {}
#if !defined(NDEBUG)
            const char* devBypass = std::getenv("CYBERNEXUS_DEV_UNACTIVATED_BYPASS");
            bool isDevBypass = (devBypass && std::string(devBypass) == "1");
#else
            bool isDevBypass = false;
#endif
            std::string initStatus = isDevBypass ? "active" : "unactivated";
            std::string initExpire = isDevBypass ? "2028-12-31" : "";
            db.execute(R"(
                INSERT INTO local_license_cache 
                (id, license_key, store_name, owner_name, plan_name, subscription_status, expire_date, days_left, machine_id, bound_machine_id, enabled_modules, grace_days, offline_max_days, issued_at, key_id, last_sync_at, last_sync_status)
                VALUES (1, :lk, :sn, 'Chủ Quán', 'Chưa kích hoạt', :st, :exp, 0, :mid, '', '["pos_core"]', 7, 14, 0, 'k1', datetime('now'), 'unactivated')
            )", {{":lk", cfgKey}, {":sn", cfgStore}, {":st", initStatus}, {":exp", initExpire}, {":mid", mid}});
        }
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
            "advertising_promotions", "Truyền Thông & Quảng Cáo (Slide/Video)",
            "Trình chiếu ảnh/video giới thiệu quán, banner truyền thông và AI tạo slide trên Thực Đơn QR Khách Hàng.",
            "fa-photo-film", "Marketing", "fuchsia", "Khách Hàng", false, false, 0.0, {}
        },
        {
            "promo_voucher_engine", "Khuyến Mãi & Voucher Tự Động (Full)",
            "Tạo chiến dịch giảm giá khung giờ vàng, đơn tối thiểu, mã Voucher trên QR & POS và báo cáo hiệu quả P&L.",
            "fa-tags", "Marketing", "emerald", "Khách Hàng", false, false, 0.0, {}
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

// LIC-03: Multi-Factor Hardware Fingerprint (3 yếu tố độc lập: BIOS/Mainboard + MachineGuid + Disk Volume Serial)
std::vector<std::string> LicenseService::getHardwareFactors() {
    std::string fBoard = "BOARD-GENERIC";
    std::string fGuid = "GUID-GENERIC";
    std::string fDisk = "DISK-GENERIC";
#ifdef _WIN32
    auto readRegStr = [](HKEY root, const char* subkey, const char* valName) -> std::string {
        HKEY hKey = nullptr;
        std::string out;
        if (RegOpenKeyExA(root, subkey, 0, KEY_READ | KEY_WOW64_64KEY, &hKey) == ERROR_SUCCESS) {
            char val[256] = {};
            DWORD valSize = sizeof(val);
            DWORD type = REG_SZ;
            if (RegQueryValueExA(hKey, valName, NULL, &type, (LPBYTE)val, &valSize) == ERROR_SUCCESS) {
                out = val;
            }
            RegCloseKey(hKey);
        }
        return out;
    };
    std::string bp = readRegStr(HKEY_LOCAL_MACHINE, "HARDWARE\\DESCRIPTION\\System\\BIOS", "BaseBoardProduct");
    std::string bm = readRegStr(HKEY_LOCAL_MACHINE, "HARDWARE\\DESCRIPTION\\System\\BIOS", "BaseBoardManufacturer");
    std::string sp = readRegStr(HKEY_LOCAL_MACHINE, "HARDWARE\\DESCRIPTION\\System\\BIOS", "SystemProductName");
    if (!bp.empty() || !sp.empty()) fBoard = bm + "|" + bp + "|" + sp;

    std::string mg = readRegStr(HKEY_LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Cryptography", "MachineGuid");
    if (!mg.empty()) fGuid = mg;

    DWORD volSerial = 0;
    if (GetVolumeInformationA("C:\\", nullptr, 0, &volSerial, nullptr, nullptr, nullptr, 0) && volSerial != 0) {
        std::ostringstream oss;
        oss << std::hex << volSerial;
        fDisk = oss.str();
    }
#endif
    return {
        "B-" + AuthService::sha256("cbnx-hw-board|" + fBoard).substr(0, 16),
        "G-" + AuthService::sha256("cbnx-hw-guid|" + fGuid).substr(0, 16),
        "D-" + AuthService::sha256("cbnx-hw-disk|" + fDisk).substr(0, 16)
    };
}

// LIC-06: Tính rights_revision thật từ trạng thái bản quyền + danh sách module hiện tại
std::string LicenseService::computeRightsRevision() {
    try {
        auto& db = Database::instance();
        auto row = db.queryRow("SELECT COALESCE(subscription_status,'') as st, COALESCE(expire_date,'') as exp, COALESCE(enabled_modules,'[]') as em, COALESCE(blocked_modules,'[]') as bm, COALESCE(grace_days,7) as gd, COALESCE(offline_max_days,14) as om FROM local_license_cache WHERE id = 1");
        if (!row.is_null()) {
            std::string raw = row.value("st", "") + "|" + row.value("exp", "") + "|" + row.value("em", "[]")
                + "|" + row.value("bm", "[]") + "|" + std::to_string(row.value("gd", 7)) + "|" + std::to_string(row.value("om", 14));
            return AuthService::sha256(raw).substr(0, 12);
        }
    } catch (...) {}
    return "0";
}

// LIC-05: Dual-Anchor Monotonic Clock helpers (SQLite + Windows Registry HMAC)
static int64_t readRegistryClockAnchor(const std::string& machineId) {
#ifdef _WIN32
    HKEY hKey = nullptr;
    if (RegOpenKeyExA(HKEY_CURRENT_USER, "Software\\CyberNexus", 0, KEY_READ, &hKey) != ERROR_SUCCESS) return 0;
    char buf[256] = {};
    DWORD sz = sizeof(buf);
    DWORD type = REG_SZ;
    std::string raw;
    if (RegQueryValueExA(hKey, "StateAnchor", NULL, &type, (LPBYTE)buf, &sz) == ERROR_SUCCESS) raw = buf;
    RegCloseKey(hKey);
    auto sep = raw.find('|');
    if (sep == std::string::npos) return 0;
    std::string epStr = raw.substr(0, sep);
    std::string mac = raw.substr(sep + 1);
    std::string expected = SaleApp::Backend::AuthService::sha256("cbnx-clock-anchor|" + machineId + "|" + epStr).substr(0, 24);
    if (mac != expected) return -1; // Tampered anchor!
    try { return std::stoll(epStr); } catch (...) { return 0; }
#else
    (void)machineId;
    return 0;
#endif
}

static void writeRegistryClockAnchor(const std::string& machineId, int64_t epoch) {
#ifdef _WIN32
    HKEY hKey = nullptr;
    if (RegCreateKeyExA(HKEY_CURRENT_USER, "Software\\CyberNexus", 0, NULL, 0, KEY_WRITE, NULL, &hKey, NULL) != ERROR_SUCCESS) return;
    std::string epStr = std::to_string(epoch);
    std::string mac = SaleApp::Backend::AuthService::sha256("cbnx-clock-anchor|" + machineId + "|" + epStr).substr(0, 24);
    std::string val = epStr + "|" + mac;
    RegSetValueExA(hKey, "StateAnchor", 0, REG_SZ, reinterpret_cast<const BYTE*>(val.c_str()), static_cast<DWORD>(val.size() + 1));
    RegCloseKey(hKey);
#else
    (void)machineId; (void)epoch;
#endif
}

static std::string getSystemVolumeSerialHex() {
#ifdef _WIN32
    DWORD volSerial = 0;
    if (GetVolumeInformationA("C:\\", NULL, 0, &volSerial, NULL, NULL, NULL, 0)) {
        char buf[16];
        snprintf(buf, sizeof(buf), "%08X", static_cast<unsigned int>(volSerial));
        return std::string(buf);
    }
#endif
    return "GENERIC-VOL";
}

static bool verifyAndEnrollVolumeAnchor(Database& db, const std::string& machineId, const std::string& /*sigHex*/) {
    std::string curVol = getSystemVolumeSerialHex();
    if (curVol == "GENERIC-VOL") return true;
    std::string expectedMac = SaleApp::Backend::AuthService::sha256("cbnx-vol-anchor|" + machineId + "|" + curVol).substr(0, 24);
    std::string expectedVal = curVol + "|" + expectedMac;

    std::string dbVal;
    try {
        auto vRow = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'cnx_vol_anchor' LIMIT 1");
        if (!vRow.is_null()) dbVal = vRow.value("setting_value", "");
    } catch (...) {}

    std::string regVal;
#ifdef _WIN32
    HKEY hKey = nullptr;
    if (RegOpenKeyExA(HKEY_CURRENT_USER, "Software\\CyberNexus", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
        char buf[256] = {};
        DWORD sz = sizeof(buf), type = REG_SZ;
        if (RegQueryValueExA(hKey, "VolAnchor", NULL, &type, (LPBYTE)buf, &sz) == ERROR_SUCCESS) regVal = buf;
        RegCloseKey(hKey);
    }
#endif

    auto parseVol = [](const std::string& raw, std::string& outVol) -> bool {
        auto sep = raw.find('|');
        if (sep == std::string::npos) return false;
        outVol = raw.substr(0, sep);
        return !outVol.empty();
    };

    if (!dbVal.empty()) {
        std::string storedVol;
        if (!parseVol(dbVal, storedVol) || storedVol != curVol || dbVal != expectedVal) return false;
    }
    if (!regVal.empty()) {
        std::string storedVol;
        if (!parseVol(regVal, storedVol) || storedVol != curVol || regVal != expectedVal) return false;
    }
    if (dbVal.empty() || regVal.empty()) {
        try {
            db.execute("INSERT INTO store_settings (setting_key, setting_value) VALUES ('cnx_vol_anchor', :v) ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                       {{":v", expectedVal}});
        } catch (...) {}
#ifdef _WIN32
        HKEY hW = nullptr;
        if (RegCreateKeyExA(HKEY_CURRENT_USER, "Software\\CyberNexus", 0, NULL, 0, KEY_WRITE, NULL, &hW, NULL) == ERROR_SUCCESS) {
            RegSetValueExA(hW, "VolAnchor", 0, REG_SZ, reinterpret_cast<const BYTE*>(expectedVal.c_str()), static_cast<DWORD>(expectedVal.size() + 1));
            RegCloseKey(hW);
        }
#endif
    }
    return true;
}

bool LicenseService::isMachineMismatch(std::string* outBound, std::string* outCurrent) {
    std::string currentMid = getMachineId();
    if (outCurrent) *outCurrent = currentMid;
    std::string boundMid, licKey, expDate, enMods, blkMods, subStatus, sigHex, keyId = "k1";
    int graceDays = 7, offlineMaxDays = 14;
    int64_t issuedAt = 0;
    bool sigEnrolled = false;
    try {
        auto& db = Database::instance();
        auto row = db.queryRow("SELECT license_key, bound_machine_id, expire_date, enabled_modules, COALESCE(blocked_modules, '[]') as blocked_modules, COALESCE(subscription_status, 'unactivated') as subscription_status, COALESCE(license_signature, '') as license_signature, COALESCE(grace_days, 7) as grace_days, COALESCE(offline_max_days, 14) as offline_max_days, COALESCE(issued_at, 0) as issued_at, COALESCE(key_id, 'k1') as key_id FROM local_license_cache WHERE id = 1");
        if (!row.is_null()) {
            licKey = row.value("license_key", "");
            boundMid = row.contains("bound_machine_id") && row["bound_machine_id"].is_string() ? row["bound_machine_id"].get<std::string>() : "";
            expDate = row.value("expire_date", "");
            enMods = row.value("enabled_modules", "[]");
            blkMods = row.value("blocked_modules", "[]");
            subStatus = row.value("subscription_status", "unactivated");
            sigHex = row.value("license_signature", "");
            graceDays = row.value("grace_days", 7);
            offlineMaxDays = row.value("offline_max_days", 14);
            issuedAt = row.value("issued_at", int64_t(0));
            keyId = row.value("key_id", "k1");
        }
        auto sRow = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'cnx_ecdsa_enrolled' LIMIT 1");
        sigEnrolled = (!sRow.is_null() && sRow.value("setting_value", "") == "1");
    } catch (...) {}
    if (outBound) *outBound = boundMid;
    if (!boundMid.empty() && boundMid != currentMid) return true;
    // SEC-LIC-01: Mọi trạng thái khác unactivated BẮT BUỘC phải có bound_machine_id khớp & chữ ký ECDSA P-256 hợp lệ
    bool mustVerifySig = (subStatus != "unactivated") || !sigHex.empty() || sigEnrolled;
    if (mustVerifySig) {
        if (boundMid.empty() || sigHex.empty()) {
            if (outBound) *outBound = "SIGNATURE_TAMPERED";
            return true;
        }
        std::string normMods = "[]";
        std::string normBlk = "[]";
        try {
            json arr = json::parse(enMods, nullptr, false);
            if (arr.is_array()) normMods = arr.dump();
        } catch (...) {}
        try {
            json bArr = json::parse(blkMods, nullptr, false);
            if (bArr.is_array()) normBlk = bArr.dump();
        } catch (...) {}
        // Try V2 (10-field with grace_days, offline_max_days, issued_at, key_id), then V1 6-field, then legacy 4-field
        std::string canonV2 = SaleApp::LicenseCrypto::buildCanonicalPayloadV2(licKey, boundMid, expDate, normMods, subStatus, normBlk, graceDays, offlineMaxDays, issuedAt, keyId);
        bool okSig = SaleApp::LicenseCrypto::verifyLicensePayload(canonV2, sigHex);
        if (!okSig) {
            std::string canon6 = SaleApp::LicenseCrypto::buildCanonicalPayload(licKey, boundMid, expDate, normMods, subStatus, normBlk);
            okSig = SaleApp::LicenseCrypto::verifyLicensePayload(canon6, sigHex);
        }
        if (!okSig && (subStatus == "active" || subStatus == "trial") && normBlk == "[]") {
            std::string canon4 = SaleApp::LicenseCrypto::buildCanonicalPayload(licKey, boundMid, expDate, normMods);
            okSig = SaleApp::LicenseCrypto::verifyLicensePayload(canon4, sigHex);
        }
        if (!okSig) {
            if (outBound) *outBound = "SIGNATURE_TAMPERED";
            return true;
        }
        // SEC-LIC-02: Kiểm tra ràng buộc Volume Serial ổ C: chống clone VM / copy sang ổ khác
        if (!verifyAndEnrollVolumeAnchor(Database::instance(), currentMid, sigHex)) {
            if (outBound) *outBound = "VOLUME_" + getSystemVolumeSerialHex();
            return true;
        }
    }
    return false;
}

bool LicenseService::isSystemActive(std::string* outCode, std::string* outReason) {
    std::string mismatchBound, mismatchCur;
    if (isMachineMismatch(&mismatchBound, &mismatchCur)) {
        if (mismatchBound == "SIGNATURE_TAMPERED") {
            if (outCode) *outCode = "LICENSE_SIGNATURE_TAMPERED";
            if (outReason) *outReason = "Phát hiện dữ liệu bản quyền local_license_cache bị chỉnh sửa trái phép (Chữ ký ECDSA P-256 không khớp)!";
        } else {
            if (outCode) *outCode = "HARDWARE_NODE_LOCK_MISMATCH";
            if (outReason) *outReason = "Thiết bị không khớp Hardware ID đã khóa bản quyền (" + mismatchBound + ")!";
        }
        return false;
    }

    auto& db = Database::instance();
    auto row = db.queryRow("SELECT COALESCE(subscription_status, 'unactivated') as subscription_status, COALESCE(expire_date, '') as expire_date, COALESCE(grace_days, 7) as grace_days, COALESCE(offline_max_days, 14) as offline_max_days, COALESCE(issued_at, 0) as issued_at FROM local_license_cache WHERE id = 1");
    std::string subStatus = row.is_null() ? "unactivated" : row.value("subscription_status", "unactivated");
    std::string expireDate = row.is_null() ? "" : row.value("expire_date", "");
    int graceDays = row.is_null() ? 7 : row.value("grace_days", 7);
    int offlineMaxDays = row.is_null() ? 14 : row.value("offline_max_days", 14);
    int64_t issuedAt = row.is_null() ? 0 : row.value("issued_at", int64_t(0));

    // 0. LIC-01 Fail-Closed Unactivated Guard
    if (subStatus == "unactivated" || expireDate.empty()) {
        if (outCode) *outCode = "LICENSE_UNACTIVATED";
        if (outReason) *outReason = "Máy chủ POS chưa được kích hoạt bản quyền! Vui lòng nhập License Key hoặc kết nối Master Server.";
        return false;
    }

    // 1. LIC-05 Dual-Anchor Anti-Clock-Rollback guard (SQLite + Windows Registry HMAC)
    std::time_t nowEpoch = std::time(nullptr);
    int64_t maxObsDb = 0;
    try {
        auto mRow = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'cnx_max_observed_epoch' LIMIT 1");
        if (!mRow.is_null()) {
            std::string sv = mRow.value("setting_value", "0");
            if (!sv.empty()) maxObsDb = std::stoll(sv);
        }
    } catch (...) {}
    int64_t maxObsReg = readRegistryClockAnchor(mismatchCur);
    if (maxObsReg < 0) {
        if (outCode) *outCode = "LICENSE_CLOCK_TAMPERED";
        if (outReason) *outReason = "Phát hiện mốc thời gian bảo mật Registry bị can thiệp! Vui lòng đồng bộ lại với Máy chủ Master.";
        return false;
    }
    int64_t maxObs = std::max(maxObsDb, maxObsReg);
    // SEC-LIC-02: Nếu từng có StateAnchor (cnx_clock_enrolled) mà bị xóa sạch cả DB lẫn Registry -> báo CLOCK_TAMPERED
    bool clockEnrolled = false;
    try {
        auto ce = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'cnx_clock_enrolled' LIMIT 1");
        clockEnrolled = (!ce.is_null() && ce.value("setting_value", "") == "1");
    } catch (...) {}
    if ((clockEnrolled || issuedAt > 0) && maxObsDb > 0 && maxObsReg == 0) {
        // Registry StateAnchor bị xóa trong khi DB vẫn có mốc -> đồng bộ lại hoặc cảnh báo nếu đã enroll trước đó
        writeRegistryClockAnchor(mismatchCur, maxObsDb);
    } else if (clockEnrolled && maxObs <= 0) {
        if (outCode) *outCode = "LICENSE_CLOCK_TAMPERED";
        if (outReason) *outReason = "Phát hiện mốc thời gian bảo mật bị xóa trắng! Vui lòng đồng bộ lại với Máy chủ Master.";
        return false;
    }
    if (maxObs > 0 && static_cast<int64_t>(nowEpoch) + 600 < maxObs) {
        if (outCode) *outCode = "LICENSE_CLOCK_TAMPERED";
        if (outReason) *outReason = "Phát hiện đồng hồ hệ thống Windows bị chỉnh lùi trái phép (Clock Rollback)! Vui lòng chỉnh lại giờ chuẩn hoặc kết nối Máy chủ Master.";
        return false;
    }
    if (static_cast<int64_t>(nowEpoch) > maxObs + 60) {
        try {
            db.execute("INSERT INTO store_settings (setting_key, setting_value) VALUES ('cnx_max_observed_epoch', :v) ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                       {{":v", std::to_string(static_cast<int64_t>(nowEpoch))}});
            db.execute("INSERT INTO store_settings (setting_key, setting_value) VALUES ('cnx_clock_enrolled', '1') ON CONFLICT(setting_key) DO UPDATE SET setting_value = '1'");
        } catch (...) {}
        writeRegistryClockAnchor(mismatchCur, static_cast<int64_t>(nowEpoch));
    }

    // 2. SuperAdmin Suspension / Deletion guard
    if (subStatus == "suspended" || subStatus == "locked" || subStatus == "deleted") {
        if (outCode) *outCode = "LICENSE_SUSPENDED";
        if (outReason) *outReason = "Thuê bao cửa hàng đã bị Máy chủ SuperAdmin tạm khóa (" + subStatus + ")! Vui lòng liên hệ nhà cung cấp.";
        return false;
    }

    // 3. LIC-04 Offline Lease TTL guard (chống rút mạng vĩnh viễn né lệnh khóa từ Master)
    if (issuedAt > 0 && offlineMaxDays > 0) {
        int64_t elapsedSec = static_cast<int64_t>(nowEpoch) - issuedAt;
        if (elapsedSec > static_cast<int64_t>(offlineMaxDays) * 86400LL) {
            if (outCode) *outCode = "LICENSE_OFFLINE_LEASE_EXCEEDED";
            if (outReason) *outReason = "Máy POS đã mất kết nối Master quá " + std::to_string(offlineMaxDays) + " ngày (Offline Lease hết hạn). Vui lòng kết nối Internet để đồng bộ lại bản quyền!";
            return false;
        }
    }

    // 4. LIC-04 Expiration Date + Grace Period guard (cho phép bán hàng trong thời gian ân hạn)
    std::tm expTm = {};
    int daysLeft = 365;
    if (std::sscanf(expireDate.c_str(), "%d-%d-%d", &expTm.tm_year, &expTm.tm_mon, &expTm.tm_mday) == 3) {
        expTm.tm_year -= 1900;
        expTm.tm_mon -= 1;
        expTm.tm_hour = 23;
        expTm.tm_min = 59;
        expTm.tm_sec = 59;
        std::time_t expTime = std::mktime(&expTm);
        double diffDays = std::difftime(expTime, nowEpoch) / 86400.0;
        daysLeft = static_cast<int>(diffDays);
        if (expTime < nowEpoch && daysLeft >= 0) daysLeft = -1;
    }
    if (subStatus == "expired" || daysLeft < 0) {
        int overdueDays = (daysLeft < 0) ? (-daysLeft) : (graceDays + 1);
        if (subStatus != "expired" && graceDays > 0 && overdueDays <= graceDays) {
            return true; // Đang trong thời gian Ân hạn (Grace Period): vẫn cho bán hàng bình thường
        }
        if (outCode) *outCode = "LICENSE_EXPIRED";
        if (outReason) *outReason = "Bản quyền cửa hàng đã hết hạn (" + expireDate + ", quá thời gian ân hạn " + std::to_string(graceDays) + " ngày). Vui lòng gia hạn qua VietQR hoặc liên hệ Master!";
        return false;
    }

    return true;
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
    if (!isSystemActive()) return false;
    std::string stripped = moduleCode;
    if (stripped.rfind("mod_", 0) == 0) stripped = stripped.substr(4);

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

    if (stripped == "pos_core" || stripped == "finance_admin") return true;

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
        json reqBody = {
            {"action", "verify"},
            {"license_key", licenseKey},
            {"machine_id", machineId},
            {"hardware_factors", getHardwareFactors()}
        };
        auto postVerify = [&](const std::string& targetUrl) -> httplib::Result {
            httplib::Client cli(targetUrl);
            cli.set_connection_timeout(3, 0);
            cli.set_read_timeout(5, 0);
            return cli.Post("/api/license/verify", reqBody.dump(), "application/json");
        };

        auto res = postVerify(masterUrl);
        if (!res) {
            std::string fbUrl = SaleApp::Config::AppConfig::instance().getMasterFallbackUrl();
            if (!fbUrl.empty() && fbUrl != masterUrl) {
                res = postVerify(fbUrl);
                if (res) masterUrl = fbUrl;
            }
        }
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
                std::string licSig = resp.value("license_signature", "");
                int graceDays = resp.value("grace_days", 7);
                int offlineMaxDays = resp.value("offline_max_days", 14);
                int64_t issuedAt = resp.value("issued_at", resp.value("server_time", static_cast<int64_t>(std::time(nullptr))));
                std::string keyId = resp.value("key_id", "k1");

                bool updated = db.execute(R"(
                    UPDATE local_license_cache 
                    SET license_key = :k, store_name = :sn, plan_name = :pn, subscription_status = :st,
                        expire_date = :exp, enabled_modules = :em, blocked_modules = :bm, card_fee_percent = :cfp,
                        grace_days = :gd, offline_max_days = :omd, issued_at = :iat, key_id = :kid,
                        last_sync_at = datetime('now'), last_sync_status = 'online_ok', bound_machine_id = :mid,
                        license_signature = CASE WHEN :sig != '' THEN :sig ELSE COALESCE(license_signature, '') END
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
                    {":gd", graceDays},
                    {":omd", offlineMaxDays},
                    {":iat", issuedAt},
                    {":kid", keyId},
                    {":mid", machineId},
                    {":sig", licSig}
                });
                if (updated && !licSig.empty()) {
                    try {
                        db.execute("INSERT INTO store_settings (setting_key, setting_value) VALUES ('cnx_ecdsa_enrolled', '1') ON CONFLICT(setting_key) DO UPDATE SET setting_value = '1'");
                    } catch (...) {}
                }
                if (resp.contains("server_time") && resp["server_time"].is_number_integer()) {
                    int64_t srvT = resp["server_time"].get<int64_t>();
                    int64_t nowT = static_cast<int64_t>(std::time(nullptr));
                    int64_t bestT = std::max(srvT, nowT);
                    try {
                        db.execute("INSERT INTO store_settings (setting_key, setting_value) VALUES ('cnx_max_observed_epoch', :v) ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                                   {{":v", std::to_string(bestT)}});
                    } catch (...) {}
                    writeRegistryClockAnchor(machineId, bestT);
                }

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
    int graceDays = t.value("grace_days", 7);
    int offlineMaxDays = t.value("offline_max_days", 14);
    int64_t issuedAt = t.value("issued_at", int64_t(0));
    int graceDaysLeft = 0;
    std::string mismatchBound, mismatchCur;
    if (isMachineMismatch(&mismatchBound, &mismatchCur)) {
        if (mismatchBound == "SIGNATURE_TAMPERED" || (!boundMid.empty() && boundMid == machineId)) {
            state = "signature_tampered";
            subStatus = "signature_tampered";
            msg = "Phát hiện dữ liệu bản quyền bị chỉnh sửa trái phép (Chữ ký ECDSA P-256 không khớp)! Vui lòng đồng bộ lại với Master.";
        } else {
            state = "machine_mismatch";
            subStatus = "machine_mismatch";
            msg = "Cảnh báo sao chép trái phép (Hardware Node-Lock): Bản quyền đã gắn cho máy " + boundMid + " (Máy hiện tại: " + machineId + "). Vui lòng Reset Khóa Máy trên Master!";
        }
    } else if (subStatus == "unactivated" || expireDate.empty()) {
        state = "unactivated";
        msg = "Máy POS chưa kích hoạt bản quyền. Vui lòng nhập License Key để kích hoạt với Master.";
    } else if (subStatus == "suspended" || subStatus == "locked" || subStatus == "deleted") {
        state = "suspended";
        msg = "Thuê bao cửa hàng đã bị SuperAdmin tạm khóa (" + subStatus + ").";
    } else if (issuedAt > 0 && offlineMaxDays > 0 && (static_cast<int64_t>(std::time(nullptr)) - issuedAt) > static_cast<int64_t>(offlineMaxDays) * 86400LL) {
        state = "offline_lease_exceeded";
        subStatus = "offline_lease_exceeded";
        msg = "Máy POS đã mất kết nối Master quá " + std::to_string(offlineMaxDays) + " ngày. Vui lòng kết nối Internet để đồng bộ lại!";
    } else {
        std::string activeCode, activeReason;
        if (!isSystemActive(&activeCode, &activeReason) && activeCode == "LICENSE_CLOCK_TAMPERED") {
            state = "clock_tampered";
            subStatus = "clock_tampered";
            msg = activeReason;
        } else if (daysLeft < 0 || subStatus == "expired") {
            int overdue = (daysLeft < 0) ? (-daysLeft) : (graceDays + 1);
            if (subStatus != "expired" && graceDays > 0 && overdue <= graceDays) {
                state = "grace_period";
                subStatus = "grace_period";
                graceDaysLeft = graceDays - overdue;
                msg = "Bản quyền đã quá hạn — đang trong thời gian ân hạn (còn " + std::to_string(graceDaysLeft) + " ngày). Vui lòng gia hạn VietQR!";
            } else {
                state = "expired";
                msg = "Bản quyền đã hết hạn. Vui lòng gia hạn qua VietQR để tự động mở khóa 24/7.";
            }
        } else if (daysLeft <= 7) {
            subStatus = "expiring_soon";
            msg = "Bản quyền sắp hết hạn trong " + std::to_string(daysLeft) + " ngày.";
        }
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
            {"grace_days", graceDays},
            {"grace_days_left", graceDaysLeft},
            {"offline_max_days", offlineMaxDays},
            {"rights_revision", computeRightsRevision()},
            {"hardware_factors", getHardwareFactors()},
            {"key_id", t.value("key_id", "k1")},
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
