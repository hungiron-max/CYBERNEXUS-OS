#include "license.hpp"
#include "db.hpp"
#include "auth.hpp"
#include <iostream>
#include <sstream>
#include <algorithm>
#include <ctime>

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
    // Master database tables are managed in cybernexus_master.db
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
            {"is_enabled", isEnabled}
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

    // Lowercase raw string
    std::transform(rawGuid.begin(), rawGuid.end(), rawGuid.begin(), ::tolower);

    // Compute sha256("saleapp-machine|" + rawGuid)
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
    auto& db = Database::instance();
    json row;
    if (tenantId > 0) {
        row = db.queryRow("SELECT enabled_modules FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tenantId}});
    } else {
        row = db.queryRow("SELECT enabled_modules FROM saas_tenants WHERE subscription_status != 'deleted' ORDER BY id ASC LIMIT 1");
    }

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

    // Ensure core module is always included
    if (std::find(modules.begin(), modules.end(), "pos_core") == modules.end()) {
        modules.insert(modules.begin(), "pos_core");
    }

    return modules;
}

bool LicenseService::isModuleEnabled(const std::string& moduleCode) {
    if (m_superAdminMode) return true;
    if (moduleCode == "pos_core" || moduleCode == "mod_pos_core") return true;
    std::string stripped = moduleCode;
    if (stripped.rfind("mod_", 0) == 0) stripped = stripped.substr(4);
    if (stripped == "pos_core") return true;

    auto enabled = getEnabledModules();
    for (const auto& m : enabled) {
        if (m == moduleCode || m == stripped || ("mod_" + m) == moduleCode) return true;
    }
    return false;
}

bool LicenseService::isSuperAdminMode() const {
    return true; // Kênh quản trị Super Admin Master Platform độc lập luôn kích hoạt sẵn sàng
}

void LicenseService::setSuperAdminMode(bool enabled) {
    m_superAdminMode = enabled;
}

json LicenseService::toggleModule(int64_t tenantId, const std::string& moduleCode, bool enabled) {
    if (tenantId <= 0 || moduleCode.empty()) {
        return {{"success", false}, {"message", "Thiếu ID cửa hàng hoặc mã module!"}};
    }

    if (!isModuleValid(moduleCode)) {
        return {{"success", false}, {"message", "Mã module không tồn tại!"}};
    }

    if (!enabled && moduleCode == "pos_core") {
        return {{"success", false}, {"message", "Không thể tắt module bắt buộc (POS Cốt Lõi)!"}};
    }

    auto& db = Database::instance();
    auto tenantRow = db.queryRow("SELECT id, enabled_modules FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tenantId}});
    if (tenantRow.is_null()) {
        return {{"success", false}, {"message", "Không tìm thấy cửa hàng!"}};
    }

    auto modules = getEnabledModules(tenantId);

    if (enabled) {
        // Check requirements
        auto reqs = getModuleRequirements(moduleCode);
        for (const auto& req : reqs) {
            if (std::find(modules.begin(), modules.end(), req) == modules.end()) {
                auto it = m_catalogIndex.find(req);
                std::string reqName = (it != m_catalogIndex.end()) ? m_catalog[it->second].name : req;
                return {{"success", false}, {"message", "Cần bật module \"" + reqName + "\" trước khi cấp module này."}};
            }
        }
        if (std::find(modules.begin(), modules.end(), moduleCode) == modules.end()) {
            modules.push_back(moduleCode);
        }
    } else {
        // Check if any active module depends on this
        for (const auto& activeCode : modules) {
            auto reqs = getModuleRequirements(activeCode);
            if (std::find(reqs.begin(), reqs.end(), moduleCode) != reqs.end()) {
                auto it = m_catalogIndex.find(activeCode);
                std::string depName = (it != m_catalogIndex.end()) ? m_catalog[it->second].name : activeCode;
                return {{"success", false}, {"message", "Hãy tắt add-on \"" + depName + "\" trước khi tắt module này."}};
            }
        }
        modules.erase(std::remove(modules.begin(), modules.end(), moduleCode), modules.end());
    }

    json modsJson = modules;
    std::string modsStr = modsJson.dump();

    db.execute("UPDATE saas_tenants SET enabled_modules = :m, updated_at = datetime('now') WHERE id = :id",
               {{":m", modsStr}, {":id", tenantId}});

    return {
        {"success", true},
        {"message", "Đã cập nhật trạng thái module thành công!"},
        {"module_code", moduleCode},
        {"enabled", enabled},
        {"enabled_modules", modules}
    };
}

json LicenseService::setAllModules(int64_t tenantId, const std::string& mode) {
    if (tenantId <= 0) {
        return {{"success", false}, {"message", "Thiếu ID cửa hàng!"}};
    }

    auto& db = Database::instance();
    auto tenantRow = db.queryRow("SELECT t.id, t.plan_id, p.default_modules FROM saas_tenants t LEFT JOIN saas_plans p ON t.plan_id = p.id WHERE t.id = :id LIMIT 1",
                                {{":id", tenantId}});
    if (tenantRow.is_null()) {
        return {{"success", false}, {"message", "Không tìm thấy cửa hàng!"}};
    }

    std::vector<std::string> newModules;
    if (mode == "all") {
        for (const auto& mod : m_catalog) {
            newModules.push_back(mod.code);
        }
    } else if (mode == "plan_default") {
        std::string defRaw = tenantRow.value("default_modules", "");
        if (!defRaw.empty()) {
            try {
                json arr = json::parse(defRaw);
                for (const auto& item : arr) {
                    if (item.is_string()) newModules.push_back(item.get<std::string>());
                }
            } catch (...) {}
        }
    }

    // Always include pos_core
    if (std::find(newModules.begin(), newModules.end(), "pos_core") == newModules.end()) {
        newModules.insert(newModules.begin(), "pos_core");
    }

    json modsJson = newModules;
    std::string modsStr = modsJson.dump();

    db.execute("UPDATE saas_tenants SET enabled_modules = :m, updated_at = datetime('now') WHERE id = :id",
               {{":m", modsStr}, {":id", tenantId}});

    return {
        {"success", true},
        {"message", "Đã cập nhật toàn bộ quyền module thành công!"},
        {"enabled_modules", newModules}
    };
}

json LicenseService::getLicenseStatus(int64_t tenantId) {
    auto& db = Database::instance();
    json t;
    if (tenantId > 0) {
        t = db.queryRow("SELECT * FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tenantId}});
    } else {
        t = db.queryRow("SELECT * FROM saas_tenants WHERE subscription_status != 'deleted' ORDER BY id ASC LIMIT 1");
    }

    if (t.is_null()) {
        return {
            {"success", true},
            {"client_mode", false},
            {"state", "valid"},
            {"message", "Máy chủ nội bộ - không cần kích hoạt."}
        };
    }

    std::string machineId = getMachineId();
    std::string boundMid = t.value("machine_id", "");
    std::string expireDate = t.value("expire_date", "2030-12-31");
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
    std::string msg = "Bản quyền hợp lệ.";
    if (daysLeft < 0 || subStatus == "expired") {
        state = "expired";
        msg = "Bản quyền đã hết hạn.";
    } else if (daysLeft <= 14) {
        subStatus = "expiring_soon";
    }

    auto enabled = getEnabledModules(t.value("id", (int64_t)1));

    std::string maskedKey = "";
    if (key.length() >= 9) {
        maskedKey = key.substr(0, 9) + "****-****-" + key.substr(key.length() - 4);
    }

    return {
        {"success", true},
        {"data", {
            {"client_mode", true},
            {"state", state},
            {"message", msg},
            {"store_name", t.value("store_name", "")},
            {"owner_name", t.value("owner_name", "")},
            {"plan_name", t.value("plan_name", "Gói Chuỗi Đỉnh Cao (Enterprise)")},
            {"subscription_status", subStatus},
            {"start_date", t.value("start_date", "")},
            {"expire_date", expireDate},
            {"days_left", daysLeft},
            {"machine_id", machineId},
            {"bound_machine_id", boundMid},
            {"machine_matched", (boundMid.empty() || boundMid == machineId)},
            {"license_key_masked", maskedKey},
            {"modules", enabled},
            {"active_module_count", enabled.size()},
            {"total_catalog_count", m_catalog.size()},
            {"app_version", "v2.5 C++ Native"}
        }}
    };
}

json LicenseService::activateLicense(const std::string& licenseKey) {
    if (licenseKey.empty()) {
        return {{"success", false}, {"message", "Vui lòng nhập License Key!"}};
    }

    auto& db = Database::instance();
    auto tenantRow = db.queryRow("SELECT * FROM saas_tenants WHERE license_key = :k AND subscription_status != 'deleted' LIMIT 1",
                                {{":k", licenseKey}});
    if (tenantRow.is_null()) {
        return {{"success", false}, {"message", "License Key không tồn tại hoặc đã bị thu hồi!"}};
    }

    int64_t tid = tenantRow.value("id", (int64_t)0);
    std::string curMid = getMachineId();
    std::string boundMid = tenantRow.value("machine_id", "");

    if (boundMid.empty()) {
        db.execute("UPDATE saas_tenants SET machine_id = :m, machine_bound_at = datetime('now') WHERE id = :id",
                   {{":m", curMid}, {":id", tid}});
    } else if (boundMid != curMid) {
        return {
            {"success", false},
            {"message", "License Key này đã được gắn với máy khác (" + boundMid + "). Vui lòng liên hệ hỗ trợ để chuyển máy!"}
        };
    }

    return {
        {"success", true},
        {"message", "Kích hoạt bản quyền thành công trên máy " + curMid + "!"},
        {"machine_id", curMid}
    };
}

} // namespace SaleApp::Backend

