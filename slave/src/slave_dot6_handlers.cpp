#include "slave_dot6_handlers.hpp"
#include "handlers.hpp"
#include "auth.hpp"
#include "body_parser.hpp"
#include "ConfigManager.hpp"
#include "gemini_client.hpp"
#include "rate_limiter.hpp"
#include "upload_guard.hpp"
#include "license.hpp"
#include "PluginManager.hpp"
#include "printer_bridge.hpp"
#include "hikvision_isapi.hpp"
#include "vietqr_emvco.hpp"
#include <fstream>
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <ctime>
#include <filesystem>
#include <mutex>
#include <random>
#include <sstream>

namespace fs = std::filesystem;

namespace SaleApp::Backend {

namespace {

static std::string jStr(const json& j, const std::string& k, const std::string& def = "") {
    if (!j.is_object() || !j.contains(k) || j[k].is_null()) return def;
    const auto& v = j[k];
    if (v.is_string()) return v.get<std::string>();
    if (v.is_number_integer()) return std::to_string(v.get<int64_t>());
    if (v.is_number_float()) return std::to_string(v.get<double>());
    if (v.is_boolean()) return v.get<bool>() ? "1" : "0";
    return def;
}

static int64_t jInt(const json& j, const std::string& k, int64_t def = 0) {
    if (!j.is_object() || !j.contains(k) || j[k].is_null()) return def;
    const auto& v = j[k];
    if (v.is_number()) return v.get<int64_t>();
    if (v.is_string()) {
        try { return std::stoll(v.get<std::string>()); } catch (...) {}
    }
    return def;
}

static double jDbl(const json& j, const std::string& k, double def = 0.0) {
    if (!j.is_object() || !j.contains(k) || j[k].is_null()) return def;
    const auto& v = j[k];
    if (v.is_number()) return v.get<double>();
    if (v.is_string()) {
        try { return std::stod(v.get<std::string>()); } catch (...) {}
    }
    return def;
}

static bool jBool(const json& j, const std::string& k, bool def = false) {
    if (!j.is_object() || !j.contains(k) || j[k].is_null()) return def;
    const auto& v = j[k];
    if (v.is_boolean()) return v.get<bool>();
    if (v.is_number()) return v.get<int64_t>() != 0;
    if (v.is_string()) {
        std::string s = v.get<std::string>();
        return s == "1" || s == "true";
    }
    return def;
}

static int safeStoi(const std::string& s, int def) {
    if (s.empty()) return def;
    try { return std::stoi(s); } catch (...) { return def; }
}

static std::string nowTsLocal() {
    std::time_t now = std::time(nullptr);
    std::tm tmBuf{};
#ifdef _WIN32
    localtime_s(&tmBuf, &now);
#else
    localtime_r(&now, &tmBuf);
#endif
    char buf[32];
    std::snprintf(buf, sizeof(buf), "%04d-%02d-%02d %02d:%02d:%02d",
                  tmBuf.tm_year + 1900, tmBuf.tm_mon + 1, tmBuf.tm_mday,
                  tmBuf.tm_hour, tmBuf.tm_min, tmBuf.tm_sec);
    return std::string(buf);
}

static std::time_t parseLocalTsDot6(const std::string& ts) {
    if (ts.size() < 16) return 0;
    std::tm t{};
    int sec = 0;
    int parsed = std::sscanf(ts.c_str(), "%d-%d-%d %d:%d:%d",
                             &t.tm_year, &t.tm_mon, &t.tm_mday,
                             &t.tm_hour, &t.tm_min, &sec);
    if (parsed < 5) return 0;
    t.tm_year -= 1900;
    t.tm_mon -= 1;
    t.tm_sec = (parsed >= 6) ? sec : 0;
    t.tm_isdst = -1;
    return std::mktime(&t);
}

static std::string getClientIpDot6(const httplib::Request& req) {
    std::string ip = req.get_header_value("X-Forwarded-For");
    if (!ip.empty()) {
        size_t comma = ip.find(',');
        if (comma != std::string::npos) ip = ip.substr(0, comma);
        while (!ip.empty() && ip.front() == ' ') ip.erase(ip.begin());
        while (!ip.empty() && ip.back() == ' ') ip.pop_back();
    }
    if (ip.empty()) ip = req.remote_addr;
    if (ip == "::1" || ip == "::ffff:127.0.0.1") ip = "127.0.0.1";
    else if (ip.rfind("::ffff:", 0) == 0) ip = ip.substr(7);
    if (ip.empty()) ip = "127.0.0.1";
    return ip;
}

static std::string hexToRawBytes(const std::string& hex) {
    std::string out;
    out.reserve(hex.size() / 2);
    auto nib = [](char c) -> int {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        return 0;
    };
    for (size_t i = 0; i + 1 < hex.size(); i += 2) {
        out.push_back(static_cast<char>((nib(hex[i]) << 4) | nib(hex[i + 1])));
    }
    return out;
}

static std::string maskSecret(const std::string& s) {
    if (s.empty()) return "";
    return "••••••••";
}

static std::string resolveLocalGeminiKeyDot6(Database& db, const std::string& passedKey = "") {
    if (!passedKey.empty() && passedKey.find("•••") == std::string::npos && passedKey.find("***") == std::string::npos) {
        return passedKey;
    }
    auto row = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'gemini_api_key' LIMIT 1");
    if (!row.is_null()) return jStr(row, "setting_value", "");
    return "";
}

static std::string resolveLicenseKeyDot6(Database& db) {
    auto row = db.queryRow("SELECT license_key FROM local_license_cache WHERE id = 1 LIMIT 1");
    if (!row.is_null()) return jStr(row, "license_key", "");
    return "";
}

static std::string normalizeHikEventTs(const std::string& isoOrRaw) {
    if (isoOrRaw.size() >= 19 && isoOrRaw[10] == 'T') {
        return isoOrRaw.substr(0, 10) + " " + isoOrRaw.substr(11, 8);
    }
    if (isoOrRaw.size() >= 19 && isoOrRaw[10] == ' ') {
        return isoOrRaw.substr(0, 19);
    }
    return nowTsLocal();
}

} // namespace

void Dot6Handlers::ensureDot6Schema(Database& db) {
    static std::mutex s_mtx;
    static bool s_done = false;
    std::lock_guard<std::mutex> lk(s_mtx);
    if (s_done) return;
    s_done = true;

    const char* orderCols[] = {
        "ALTER TABLE orders ADD COLUMN access_token TEXT DEFAULT ''",
        "ALTER TABLE orders ADD COLUMN idempotency_key TEXT DEFAULT ''",
        "ALTER TABLE orders ADD COLUMN card_tx_ref TEXT DEFAULT ''",
        "ALTER TABLE orders ADD COLUMN payment_breakdown_json TEXT DEFAULT ''",
        "ALTER TABLE orders ADD COLUMN pending_void INTEGER DEFAULT 0",
        "ALTER TABLE orders ADD COLUMN client_ip TEXT DEFAULT ''"
    };
    for (const char* s : orderCols) { try { db.execute(s); } catch (...) {} }
    try { db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key) WHERE COALESCE(idempotency_key, '') != ''"); } catch (...) {}

    const char* attCols[] = {
        "ALTER TABLE attendances ADD COLUMN source TEXT DEFAULT 'auto_login'",
        "ALTER TABLE attendances ADD COLUMN device_id INTEGER DEFAULT 0",
        "ALTER TABLE attendances ADD COLUMN device_name TEXT DEFAULT ''",
        "ALTER TABLE attendances ADD COLUMN verify_mode TEXT DEFAULT 'password'",
        "ALTER TABLE attendances ADD COLUMN photo_path TEXT DEFAULT ''",
        "ALTER TABLE attendances ADD COLUMN external_event_id TEXT DEFAULT ''",
        "ALTER TABLE attendances ADD COLUMN confidence REAL DEFAULT 1.0",
        "ALTER TABLE attendances ADD COLUMN live_status TEXT DEFAULT 'working'",
        "ALTER TABLE attendances ADD COLUMN break_minutes INTEGER DEFAULT 0",
        "ALTER TABLE attendances ADD COLUMN break_started_at TEXT DEFAULT ''",
        "ALTER TABLE attendances ADD COLUMN delivery_order_code TEXT DEFAULT ''",
        "ALTER TABLE attendances ADD COLUMN delivery_started_at TEXT DEFAULT ''",
        "ALTER TABLE attendances ADD COLUMN early_leave_reason TEXT DEFAULT ''",
        "ALTER TABLE attendances ADD COLUMN late_minutes INTEGER DEFAULT 0",
        "ALTER TABLE attendances ADD COLUMN pending_manager_review INTEGER DEFAULT 0"
    };
    for (const char* s : attCols) { try { db.execute(s); } catch (...) {} }
    try {
        db.execute(R"(
            CREATE TABLE IF NOT EXISTS shift_state_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attendance_id INTEGER DEFAULT 0,
                user_id INTEGER NOT NULL,
                from_status TEXT DEFAULT '',
                to_status TEXT NOT NULL,
                note TEXT DEFAULT '',
                order_code TEXT DEFAULT '',
                actor_name TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        )");
    } catch (...) {}

    const char* alertCols[] = {
        "ALTER TABLE order_alerts ADD COLUMN title_key TEXT DEFAULT ''",
        "ALTER TABLE order_alerts ADD COLUMN msg_key TEXT DEFAULT ''",
        "ALTER TABLE order_alerts ADD COLUMN msg_params_json TEXT DEFAULT '{}'"
    };
    for (const char* s : alertCols) { try { db.execute(s); } catch (...) {} }

    try {
        db.execute(R"(
            CREATE TABLE IF NOT EXISTS qr_blacklist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_ip TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                reason TEXT DEFAULT '',
                blocked_by TEXT DEFAULT '',
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        )");
        db.execute(R"(
            CREATE TABLE IF NOT EXISTS attendance_devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                device_type TEXT DEFAULT 'hikvision_isapi',
                ip_address TEXT NOT NULL,
                port INTEGER DEFAULT 80,
                username TEXT DEFAULT 'admin',
                password TEXT DEFAULT '',
                model TEXT DEFAULT 'DS-K1T343MX',
                serial_number TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1,
                poll_interval_sec INTEGER DEFAULT 300,
                last_poll_at TEXT DEFAULT '',
                last_sync_at TEXT DEFAULT '',
                last_error TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        )");
        db.execute(R"(
            CREATE TABLE IF NOT EXISTS attendance_raw_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id INTEGER DEFAULT 0,
                device_name TEXT DEFAULT '',
                user_id INTEGER DEFAULT 0,
                employee_no TEXT DEFAULT '',
                user_name TEXT DEFAULT '',
                event_time TEXT NOT NULL,
                verify_mode TEXT DEFAULT '',
                source TEXT DEFAULT 'hikvision_device',
                photo_path TEXT DEFAULT '',
                external_event_id TEXT DEFAULT '',
                status TEXT DEFAULT 'applied',
                note TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        )");
        db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_att_raw_ext ON attendance_raw_logs(external_event_id) WHERE COALESCE(external_event_id, '') != ''");
    } catch (...) {}

    // [I18N-11 / I18N-12] Multi-language Database Columns & i18n_catalog Table
    const char* i18nDbCols[] = {
        "ALTER TABLE categories ADD COLUMN i18n_json TEXT DEFAULT '{}'",
        "ALTER TABLE products ADD COLUMN i18n_json TEXT DEFAULT '{}'",
        "ALTER TABLE tables_areas ADD COLUMN i18n_json TEXT DEFAULT '{}'",
        "ALTER TABLE promotions ADD COLUMN i18n_json TEXT DEFAULT '{}'"
    };
    for (const char* s : i18nDbCols) { try { db.execute(s); } catch (...) {} }

    try {
        db.execute(R"(
            CREATE TABLE IF NOT EXISTS i18n_catalog (
                key TEXT PRIMARY KEY,
                group_code TEXT DEFAULT 'custom',
                layer TEXT DEFAULT 'frontend',
                screen TEXT DEFAULT '',
                comp_type TEXT DEFAULT 'api_msg',
                field_name TEXT DEFAULT '',
                source_file TEXT DEFAULT '',
                max_chars INTEGER DEFAULT 120,
                origin_vi TEXT DEFAULT '',
                translations_json TEXT DEFAULT '{}',
                status TEXT DEFAULT 'approved',
                source_modified INTEGER DEFAULT 0,
                updated_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        )");
    } catch (...) {}

    // Seed default English translations for categories, products, and tables_areas if empty
    try {
        static const std::unordered_map<std::string, std::string> kCatEn = {
            {"Bánh Mì & Món Nóng", "Banh Mi & Hot Dishes"},
            {"Cà Phê", "Vietnamese Coffee"},
            {"Trà Trái Cây", "Fruit Tea"},
            {"Trà Sữa", "Milk Tea"},
            {"Đá Xay & Sinh Tố", "Smoothies & Ice Blended"},
            {"Nước Ngọt & Giải Khát", "Soft Drinks & Beverages"},
            {"Bánh Ngọt & Ăn Vặt", "Pastries & Snacks"},
            {"Topping Thêm", "Extra Toppings"}
        };
        static const std::unordered_map<std::string, std::string> kUnitEn = {
            {"cái", "pc"}, {"ổ", "loaf"}, {"chảo", "pan"}, {"tô", "bowl"}, {"dĩa", "plate"},
            {"ly", "cup"}, {"chai", "bottle"}, {"lon", "can"}, {"phần", "portion"}
        };
        auto cats = db.query("SELECT id, name, COALESCE(i18n_json, '{}') as i18n_json FROM categories");
        for (const auto& c : cats) {
            std::string cur = jStr(c, "i18n_json", "{}");
            if (cur.empty() || cur == "{}") {
                std::string vn = jStr(c, "name", "");
                auto it = kCatEn.find(vn);
                std::string en = (it != kCatEn.end()) ? it->second : vn;
                json j = {{"en", {{"name", en}}}};
                db.execute("UPDATE categories SET i18n_json = :j WHERE id = :id", {{":j", j.dump()}, {":id", jInt(c, "id", 0)}});
            }
        }
        auto prods = db.query("SELECT id, code, name, unit, description, COALESCE(i18n_json, '{}') as i18n_json FROM products");
        for (const auto& p : prods) {
            std::string cur = jStr(p, "i18n_json", "{}");
            if (cur.empty() || cur == "{}") {
                std::string vn = jStr(p, "name", "");
                std::string un = jStr(p, "unit", "phần");
                std::string enName = vn;
                if (vn == "Bánh Mì") enName = "Crispy Vietnamese Baguette";
                else if (vn == "Bánh Mì Chảo Đặc Biệt") enName = "Special Pan Banh Mi";
                else if (vn == "Bánh Mì Ốp La 2 Trứng") enName = "2-Egg Sunny-Side-Up Banh Mi";
                else if (vn.find("Cà Phê Sữa") != std::string::npos) enName = "Vietnamese Iced Milk Coffee";
                else if (vn.find("Cà Phê Đen") != std::string::npos) enName = "Vietnamese Black Coffee";
                else if (vn.find("Bạc Xỉu") != std::string::npos) enName = "Saigon White Coffee (Bac Xiu)";
                else if (vn.find("Trà Đào") != std::string::npos) enName = "Peach Lemongrass Tea";
                else if (vn.find("Trà Vải") != std::string::npos) enName = "Lychee Rose Tea";
                else if (vn.find("Trà Ổi") != std::string::npos) enName = "Pink Guava Tea";
                else if (vn.find("Trà Sữa") != std::string::npos) enName = "Signature Milk Tea (" + jStr(p, "code", "") + ")";
                auto uit = kUnitEn.find(un);
                std::string enUnit = (uit != kUnitEn.end()) ? uit->second : "item";
                json j = {{"en", {{"name", enName}, {"unit", enUnit}, {"description", jStr(p, "description", "")}}}};
                db.execute("UPDATE products SET i18n_json = :j WHERE id = :id", {{":j", j.dump()}, {":id", jInt(p, "id", 0)}});
            }
        }
        auto tbls = db.query("SELECT id, code, name, COALESCE(i18n_json, '{}') as i18n_json FROM tables_areas");
        for (const auto& t : tbls) {
            std::string cur = jStr(t, "i18n_json", "{}");
            if (cur.empty() || cur == "{}") {
                std::string vn = jStr(t, "name", "");
                std::string cd = jStr(t, "code", "");
                std::string en = (cd.rfind("MV", 0) == 0) ? ("Takeaway " + cd.substr(2)) : ("Table " + cd);
                json j = {{"en", {{"name", en}}}};
                db.execute("UPDATE tables_areas SET i18n_json = :j WHERE id = :id", {{":j", j.dump()}, {":id", jInt(t, "id", 0)}});
            }
        }
    } catch (...) {}
}

std::string Dot6Handlers::hmacSha256Hex(const std::string& key, const std::string& msg) {
    constexpr size_t B = 64;
    std::string k = key;
    if (k.size() > B) {
        k = hexToRawBytes(AuthService::sha256(k));
    }
    k.resize(B, '\0');
    std::string ipad(B, '\0'), opad(B, '\0');
    for (size_t i = 0; i < B; ++i) {
        ipad[i] = static_cast<char>(static_cast<unsigned char>(k[i]) ^ 0x36);
        opad[i] = static_cast<char>(static_cast<unsigned char>(k[i]) ^ 0x5c);
    }
    std::string innerRaw = hexToRawBytes(AuthService::sha256(ipad + msg));
    return AuthService::sha256(opad + innerRaw);
}

std::string Dot6Handlers::getOrCreateStoreSecret(Database& db, const std::string& settingKey) {
    auto r = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = :k LIMIT 1", {{":k", settingKey}});
    if (!r.is_null()) {
        std::string val = jStr(r, "setting_value", "");
        if (!val.empty()) return val;
    }
    std::string rnd = AuthService::sha256("cbnx_" + settingKey + "_" + nowTsLocal() + "_" + std::to_string(std::chrono::system_clock::now().time_since_epoch().count()));
    db.execute(
        "INSERT INTO store_settings (setting_key, setting_value) VALUES (:k, :v) "
        "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
        {{":k", settingKey}, {":v", rnd}}
    );
    return rnd;
}

bool Dot6Handlers::verifyManagerPin(Database& db, const std::string& rawPin, json& mgrOut) {
    mgrOut = nullptr;
    if (rawPin.empty()) return false;
    std::string pinHash = AuthService::sha256(rawPin);
    json admins = db.query("SELECT id, username, fullname, role, pin_code FROM users WHERE role = 'admin' AND status = 'active'");
    for (const auto& u : admins) {
        std::string storedPin = jStr(u, "pin_code", "");
        if (!storedPin.empty() && (storedPin == rawPin || storedPin == pinHash)) {
            mgrOut = u;
            return true;
        }
    }
    return false;
}

bool Dot6Handlers::isQrClientBlacklisted(Database& db, const std::string& clientIp, const std::string& phone, std::string& reasonOut) {
    ensureDot6Schema(db);
    auto r = db.queryRow(R"(
        SELECT reason, expires_at FROM qr_blacklist
        WHERE datetime(expires_at) > datetime('now', 'localtime')
          AND ((client_ip != '' AND client_ip = :ip) OR (:ph != '' AND phone = :ph))
        ORDER BY id DESC LIMIT 1
    )", {{":ip", clientIp}, {":ph", phone}});
    if (!r.is_null()) {
        reasonOut = jStr(r, "reason", "Thiết bị/SĐT bị tạm khóa đặt món QR");
        return true;
    }
    return false;
}

json Dot6Handlers::loadReceiptTemplateCfg(Database& db) {
    json cfg = {
        {"paper_size", "80mm"},
        {"line_height", 1.35},
        {"item_gap_px", 6},
        {"section_gap_px", 8},
        {"pad_x_px", 8},
        {"pad_y_px", 10},
        {"font_header_px", 15},
        {"font_body_px", 12},
        {"font_total_px", 14},
        {"show_logo", true},
        {"show_store_address", true},
        {"show_store_phone", true},
        {"show_table_cashier", true},
        {"show_item_note", true},
        {"show_toppings", true},
        {"show_discount_vat", true},
        {"show_wifi", true},
        {"show_qr_payment", false},
        {"show_footer_note", true},
        {"feed_lines", 4},
        {"custom_header", ""},
        {"custom_footer", ""}
    };
    auto r = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'receipt_tpl_json' LIMIT 1");
    if (!r.is_null()) {
        std::string raw = jStr(r, "setting_value", "");
        if (!raw.empty()) {
            json saved = json::parse(raw, nullptr, false);
            if (saved.is_object()) {
                for (auto it = saved.begin(); it != saved.end(); ++it) {
                    if (!it.value().is_null()) cfg[it.key()] = it.value();
                }
            }
        }
    }
    return cfg;
}

bool Dot6Handlers::processUnifiedAttendancePunch(
    Database& db,
    int64_t userId,
    const std::string& mode,
    const std::string& source,
    const std::string& verifyMode,
    int64_t deviceId,
    const std::string& deviceName,
    const std::string& photoPath,
    const std::string& externalEventId,
    const std::string& tsIn,
    const std::string& noteIn,
    int cooldownSeconds,
    json& resultOut,
    std::string& errOut,
    int& httpCodeOut) {

    ensureDot6Schema(db);
    httpCodeOut = 200;
    resultOut = json::object();

    if (!externalEventId.empty()) {
        auto dup = db.queryRow("SELECT id FROM attendance_raw_logs WHERE external_event_id = :eid LIMIT 1", {{":eid", externalEventId}});
        if (!dup.is_null()) {
            resultOut = {{"success", true}, {"duplicate", true}, {"message", "Sự kiện chấm công đã được ghi nhận trước đó"}};
            return true;
        }
    }

    auto uRow = db.queryRow("SELECT id, username, fullname, user_code, role, COALESCE(hourly_rate, 25000) AS hourly_rate, status FROM users WHERE id = :uid LIMIT 1", {{":uid", userId}});
    if (uRow.is_null()) {
        errOut = "Không tìm thấy nhân viên trong hệ thống!";
        httpCodeOut = 404;
        return false;
    }

    std::string ts = tsIn.empty() ? nowTsLocal() : tsIn;
    std::string workDate = (ts.size() >= 10) ? ts.substr(0, 10) : nowTsLocal().substr(0, 10);
    std::string uCode = jStr(uRow, "user_code", "");
    std::string uName = jStr(uRow, "fullname", "");
    if (uName.empty()) uName = jStr(uRow, "username", "Nhân viên");
    std::string uRole = jStr(uRow, "role", "staff");
    double rate = jDbl(uRow, "hourly_rate", 25000.0);
    if (rate <= 0.0) rate = 25000.0;

    std::time_t punchT = parseLocalTsDot6(ts);

    auto openRow = db.queryRow("SELECT * FROM attendances WHERE user_id = :uid AND status = 'working' ORDER BY id DESC LIMIT 1", {{":uid", userId}});
    auto lastClosed = db.queryRow("SELECT check_out_time FROM attendances WHERE user_id = :uid AND status = 'completed' ORDER BY id DESC LIMIT 1", {{":uid", userId}});

    auto insertRaw = [&](const std::string& st, const std::string& n) {
        try {
            db.execute(R"(
                INSERT INTO attendance_raw_logs (device_id, device_name, user_id, employee_no, user_name, event_time, verify_mode, source, photo_path, external_event_id, status, note)
                VALUES (:did, :dname, :uid, :eno, :un, :et, :vm, :src, :pp, :eid, :st, :nt)
            )", {
                {":did", deviceId}, {":dname", deviceName}, {":uid", userId},
                {":eno", uCode}, {":un", uName}, {":et", ts}, {":vm", verifyMode},
                {":src", source}, {":pp", photoPath}, {":eid", externalEventId},
                {":st", st}, {":nt", n}
            });
        } catch (...) {}
    };

    if (mode == "checkin" && !openRow.is_null()) {
        std::string inTs = jStr(openRow, "check_in_time", "");
        std::time_t inT = parseLocalTsDot6(inTs);
        int64_t diff = (punchT > 0 && inT > 0) ? static_cast<int64_t>(punchT - inT) : 0;
        if (cooldownSeconds > 0 && diff >= 0 && diff < cooldownSeconds) {
            insertRaw("ignored_cooldown", "Chống quẹt trùng Check-in (" + std::to_string(diff) + "s)");
            httpCodeOut = 429;
            errOut = "Bạn vừa Check-in lúc " + inTs + ". Vui lòng đợi " + std::to_string(cooldownSeconds - diff) + " giây!";
            return false;
        }
        errOut = "Bạn đang có ca làm việc mở từ " + inTs + ". Vui lòng Check-out trước!";
        httpCodeOut = 400;
        return false;
    }

    if (mode == "checkout") {
        if (openRow.is_null()) {
            errOut = "Không có ca làm việc đang mở để Check-out!";
            httpCodeOut = 400;
            return false;
        }
        std::string inTs = jStr(openRow, "check_in_time", "");
        std::time_t inT = parseLocalTsDot6(inTs);
        int64_t diff = (punchT > 0 && inT > 0) ? static_cast<int64_t>(punchT - inT) : 0;
        if (cooldownSeconds > 0 && diff >= 0 && diff < cooldownSeconds) {
            insertRaw("ignored_cooldown", "Chống quẹt nhầm Check-out ngay sau Check-in (" + std::to_string(diff) + "s)");
            httpCodeOut = 429;
            errOut = "Vừa Check-in cách đây " + std::to_string(diff) + " giây. Vui lòng đợi đủ " + std::to_string(cooldownSeconds) + " giây mới được Check-out!";
            return false;
        }
    }

    if (!openRow.is_null()) {
        std::string inTs = jStr(openRow, "check_in_time", "");
        std::time_t inT = parseLocalTsDot6(inTs);
        int64_t diff = (punchT > 0 && inT > 0) ? static_cast<int64_t>(punchT - inT) : 9999;
        if (mode == "auto" && cooldownSeconds > 0 && diff >= 0 && diff < cooldownSeconds) {
            insertRaw("ignored_cooldown", "Cooldown " + std::to_string(diff) + "s < " + std::to_string(cooldownSeconds) + "s");
            resultOut = {{"success", true}, {"action", "ignored_cooldown"}, {"message", "Bỏ qua lượt quẹt trùng trong thời gian chờ"}};
            return true;
        }
        int64_t attId = jInt(openRow, "id", 0);
        double hrs = (diff > 0) ? (std::round((static_cast<double>(diff) / 3600.0) * 100.0) / 100.0) : 0.0;
        double attRate = jDbl(openRow, "hourly_rate", rate);
        if (attRate <= 0.0) attRate = rate;
        double pay = std::round(hrs * attRate);
        std::string closeNote = noteIn.empty() ? ("Check-out qua " + source + (verifyMode.empty() ? "" : (" (" + verifyMode + ")"))) : noteIn;

        db.beginTransaction();
        db.execute(R"(
            UPDATE attendances
            SET check_out_time = :out, work_hours = :hrs, regular_hours = :hrs, total_pay = :pay,
                status = 'completed',
                photo_path = CASE WHEN :pp != '' THEN :pp ELSE photo_path END,
                note = CASE WHEN COALESCE(note, '') = '' THEN :nt ELSE note || ' | ' || :nt END
            WHERE id = :id
        )", {
            {":out", ts}, {":hrs", hrs}, {":pay", pay}, {":pp", photoPath}, {":nt", closeNote}, {":id", attId}
        });
        db.execute("UPDATE users SET is_online = 0 WHERE id = :uid", {{":uid", userId}});
        insertRaw("applied_checkout", closeNote);
        db.commit();

        resultOut = {
            {"success", true},
            {"action", "checkout"},
            {"attendance_id", attId},
            {"user_id", userId},
            {"user_name", uName},
            {"work_hours", hrs},
            {"total_pay", pay},
            {"check_out_time", ts},
            {"source", source},
            {"verify_mode", verifyMode},
            {"message", "Check-out thành công cho " + uName + " (" + std::to_string(hrs) + "h)!"}
        };
        return true;
    }

    if (!lastClosed.is_null() && cooldownSeconds > 0) {
        std::time_t outT = parseLocalTsDot6(jStr(lastClosed, "check_out_time", ""));
        int64_t diffOut = (punchT > 0 && outT > 0) ? static_cast<int64_t>(punchT - outT) : 9999;
        if (diffOut >= 0 && diffOut < cooldownSeconds) {
            insertRaw("ignored_cooldown", "Cooldown sau Check-out (" + std::to_string(diffOut) + "s)");
            if (mode == "auto") {
                resultOut = {{"success", true}, {"action", "ignored_cooldown"}, {"message", "Bỏ qua lượt quẹt trùng ngay sau khi tan ca"}};
                return true;
            }
            httpCodeOut = 429;
            errOut = "Bạn vừa Check-out cách đây " + std::to_string(diffOut) + " giây. Vui lòng đợi " + std::to_string(cooldownSeconds - diffOut) + " giây!";
            return false;
        }
    }

    std::string inNote = noteIn.empty() ? ("Check-in qua " + source) : noteIn;
    db.beginTransaction();
    int64_t newAttId = db.execute(R"(
        INSERT INTO attendances (user_id, user_name, user_code, user_role, work_date, check_in_time, status, hourly_rate, device_info, note, last_heartbeat_at, source, device_id, device_name, verify_mode, photo_path, external_event_id)
        VALUES (:uid, :un, :uc, :ur, :wd, :in_t, 'working', :hr, :di, :nt, :hb, :src, :did, :dname, :vm, :pp, :eid)
    )", {
        {":uid", userId}, {":un", uName}, {":uc", uCode}, {":ur", uRole}, {":wd", workDate},
        {":in_t", ts}, {":hr", rate}, {":di", deviceName.empty() ? source : deviceName}, {":nt", inNote},
        {":hb", ts}, {":src", source}, {":did", deviceId}, {":dname", deviceName},
        {":vm", verifyMode}, {":pp", photoPath}, {":eid", externalEventId}
    });
    db.execute("UPDATE users SET is_online = 1, last_active_at = :la WHERE id = :uid", {{":la", ts}, {":uid", userId}});
    insertRaw("applied_checkin", inNote);
    db.commit();

    resultOut = {
        {"success", true},
        {"action", "checkin"},
        {"attendance_id", newAttId},
        {"user_id", userId},
        {"user_name", uName},
        {"check_in_time", ts},
        {"source", source},
        {"verify_mode", verifyMode},
        {"photo_path", photoPath},
        {"message", "Check-in thành công cho " + uName + " lúc " + ts + "!"}
    };
    return true;
}

bool Dot6Handlers::handleDot6Tables(const std::string& action, const httplib::Request& req, httplib::Response& res, Database& db, const json& body) {
    if (action == "qr_token") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt) {
            ApiHandlers::sendError(res, "Chưa đăng nhập!", 401);
            return true;
        }
        std::string tableCode = BodyParser::getParam(req, body, "table_code", "");
        if (tableCode.empty()) {
            ApiHandlers::sendError(res, "Thiếu table_code!", 400);
            return true;
        }
        std::string secret = getOrCreateStoreSecret(db, "qr_hmac_secret");
        std::string sig = hmacSha256Hex(secret, tableCode).substr(0, 24);
        ApiHandlers::sendJson(res, {
            {"success", true},
            {"table_code", tableCode},
            {"table_sig", sig}
        });
        return true;
    }
    return false;
}

bool Dot6Handlers::handleDot6Operations(const std::string& action, const httplib::Request& req, httplib::Response& res, Database& db, const json& body) {
    ensureDot6Schema(db);
    std::string clientIp = getClientIpDot6(req);

    auto saveSelfieIfPresent = [&]() -> std::string {
        std::string b64 = jStr(body, "photo_base64", "");
        if (b64.empty()) return "";
        std::string mime, pureB64;
        SaleApp::AI::parseDataUriImage(b64, mime, pureB64);
        std::string raw = SaleApp::AI::base64Decode(pureB64);
        if (raw.empty()) return "";
        std::string extHint = (mime.find("png") != std::string::npos) ? "selfie.png" : "selfie.jpg";
        auto v = SaleApp::Security::UploadGuard::validate(raw, extHint, SaleApp::Security::UploadKind::Image);
        if (!v.ok) return "";
        std::string fname = SaleApp::Security::UploadGuard::makeRandomUuidName("att_selfie", v.ext);
        fs::path outPath;
        std::string wErr;
        if (!SaleApp::Security::UploadGuard::writeSafeFile(SaleApp::Config::AppConfig::instance().getUploadsDir() / "attendance", fname, raw, outPath, wErr)) {
            return "";
        }
        return "uploads/attendance/" + fname;
    };

    if (action == "my_attendance_status" || action == "web_checkin" || action == "web_checkout" ||
        action == "kiosk_punch" || action == "attendance_raw_logs") {
        if (!LicenseService::instance().isModuleEnabled("staff_shifts")) {
            ApiHandlers::sendErrorCode(res, "MODULE_NOT_LICENSED", "Module Nhân Viên, Phân Ca & Chấm Công (staff_shifts) chưa được cấp phép hoặc đang bị SuperAdmin tạm khóa!", json::object(), 403);
            return true;
        }
    }

    if (action == "my_attendance_status") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt) {
            ApiHandlers::sendError(res, "Vui lòng đăng nhập để xem trạng thái chấm công!", 401);
            return true;
        }
        auto active = db.queryRow("SELECT * FROM attendances WHERE user_id = :uid AND status = 'working' ORDER BY id DESC LIMIT 1", {{":uid", userOpt->id}});
        std::string today = nowTsLocal().substr(0, 10);
        json history = db.query(R"(
            SELECT id, work_date, check_in_time, check_out_time, work_hours, total_pay, status,
                   COALESCE(source, 'auto_login') as source, COALESCE(verify_mode, '') as verify_mode,
                   COALESCE(device_name, device_info, '') as device_name, COALESCE(photo_path, '') as photo_path
            FROM attendances
            WHERE user_id = :uid AND work_date >= date('now', 'localtime', '-14 days')
            ORDER BY id DESC LIMIT 20
        )", {{":uid", userOpt->id}});

        ApiHandlers::sendJson(res, {
            {"success", true},
            {"user", {{"id", userOpt->id}, {"username", userOpt->username}, {"fullname", userOpt->fullname}, {"role", userOpt->role}}},
            {"today", today},
            {"active_shift", active.is_null() ? json(nullptr) : active},
            {"recent_records", history}
        });
        return true;
    }

    if (action == "web_checkin" || action == "web_checkout") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt) {
            ApiHandlers::sendError(res, "Vui lòng đăng nhập để chấm công!", 401);
            return true;
        }
        std::string photoPath = saveSelfieIfPresent();
        std::string ua = req.get_header_value("User-Agent");
        std::string dname = jStr(body, "device_label", ua.substr(0, std::min<size_t>(48, ua.size())));
        if (dname.empty()) dname = "Web App Browser";
        std::string mode = (action == "web_checkin") ? "checkin" : "checkout";

        json out;
        std::string err;
        int code = 200;
        if (!processUnifiedAttendancePunch(db, userOpt->id, mode, "web_personal", "web_selfie", 0, dname, photoPath, "", "", jStr(body, "note", ""), 180, out, err, code)) {
            ApiHandlers::sendError(res, err, code);
            return true;
        }
        ApiHandlers::sendJson(res, out, code);
        return true;
    }

    if (action == "kiosk_punch") {
        int retryAfter = 0;
        if (SaleApp::Security::RateLimiter::instance().isLocked("kiosk_pin", clientIp, retryAfter)) {
            ApiHandlers::sendJson(res, {
                {"success", false},
                {"code", "AUTH_RATE_LIMITED"},
                {"retry_after", retryAfter},
                {"message", "Nhập sai PIN Kiosk quá 5 lần. Thử lại sau " + std::to_string(retryAfter) + " giây."}
            }, 429);
            return true;
        }
        std::string pin = jStr(body, "pin_code", BodyParser::getParam(req, body, "pin", ""));
        if (pin.empty()) {
            ApiHandlers::sendError(res, "Vui lòng nhập mã PIN 6 số!", 400);
            return true;
        }
        std::string pinHash = AuthService::sha256(pin);
        json uRow = db.queryRow("SELECT id, username, fullname FROM users WHERE status = 'active' AND (pin_code = :p OR pin_code = :ph) LIMIT 1",
                                {{":p", pin}, {":ph", pinHash}});
        if (uRow.is_null()) {
            SaleApp::Security::RateLimiter::instance().recordFailure("kiosk_pin", clientIp, 5, 300, 300);
            ApiHandlers::sendErrorCode(res, "AUTH_INVALID_CREDENTIALS", "Mã PIN chấm công không đúng hoặc tài khoản đã ngưng hoạt động!", json::object(), 401);
            return true;
        }
        SaleApp::Security::RateLimiter::instance().clearFailures("kiosk_pin", clientIp);

        int64_t uid = jInt(uRow, "id", 0);
        std::string photoPath = saveSelfieIfPresent();
        std::string mode = jStr(body, "mode", "auto");
        if (mode != "checkin" && mode != "checkout") mode = "auto";
        std::string dname = jStr(body, "device_label", "Kiosk PIN Quầy POS");

        json out;
        std::string err;
        int code = 200;
        if (!processUnifiedAttendancePunch(db, uid, mode, "kiosk_pin", "pin_6", 0, dname, photoPath, "", "", jStr(body, "note", ""), 180, out, err, code)) {
            ApiHandlers::sendError(res, err, code);
            return true;
        }
        ApiHandlers::sendJson(res, out, code);
        return true;
    }

    if (action == "attendance_raw_logs") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            ApiHandlers::sendError(res, "Chỉ Chủ quán (Admin) mới được xem Raw Punch Logs!", 403);
            return true;
        }
        json logs = db.query("SELECT * FROM attendance_raw_logs ORDER BY id DESC LIMIT 100");
        ApiHandlers::sendJson(res, {{"success", true}, {"data", logs}});
        return true;
    }

    return false;
}

bool Dot6Handlers::handleDot6Orders(const std::string& action, const httplib::Request& req, httplib::Response& res, Database& db, const json& body) {
    ensureDot6Schema(db);

    // [ARCH-06] Thin-Client Server-Authoritative Order Quote Preview
    if (action == "preview_quote") {
        json itemsIn = json::array();
        if (body.contains("items") && body["items"].is_array()) {
            itemsIn = body["items"];
        } else {
            std::string itemsRaw = BodyParser::getParam(req, body, "items", "[]");
            auto parsed = json::parse(itemsRaw, nullptr, false);
            if (parsed.is_array()) itemsIn = parsed;
        }
        double subtotal = 0.0;
        json lineItems = json::array();
        for (const auto& it : itemsIn) {
            int64_t pid = jInt(it, "product_id", jInt(it, "id", 0));
            int64_t qty = std::max<int64_t>(1, jInt(it, "quantity", 1));
            auto pRow = (pid > 0)
                ? db.queryRow("SELECT id, code, name, unit, sale_price, COALESCE(i18n_json, '{}') as i18n_json FROM products WHERE id = :id LIMIT 1", {{":id", pid}})
                : json(nullptr);
            double basePrice = pRow.is_null() ? 0.0 : jDbl(pRow, "sale_price", 0.0);
            double topTotal = 0.0;
            if (it.contains("toppings") && it["toppings"].is_array()) {
                for (const auto& tp : it["toppings"]) {
                    int64_t tpid = jInt(tp, "id", jInt(tp, "product_id", 0));
                    if (tpid > 0) {
                        auto tRow = db.queryRow("SELECT sale_price FROM products WHERE id = :id LIMIT 1", {{":id", tpid}});
                        if (!tRow.is_null()) topTotal += jDbl(tRow, "sale_price", 0.0);
                    }
                }
            }
            double unitPrice = basePrice + topTotal;
            double lineSub = unitPrice * static_cast<double>(qty);
            subtotal += lineSub;
            lineItems.push_back({
                {"product_id", pid},
                {"name", pRow.is_null() ? jStr(it, "name", "") : jStr(pRow, "name", "")},
                {"unit_price", unitPrice},
                {"quantity", qty},
                {"subtotal", lineSub}
            });
        }

        std::string discountType = BodyParser::getParam(req, body, "discount_type", "percent");
        double discountValue = jDbl(body, "discount_value", 0.0);
        std::string promoCode = BodyParser::getParam(req, body, "promo_code", "");
        double vatPercent = std::max(0.0, std::min(100.0, jDbl(body, "vat_percent", 0.0)));
        double discountAmount = 0.0;
        bool promoValid = true;
        std::string promoMessage;

        if (!promoCode.empty()) {
            std::string upCode = promoCode;
            std::transform(upCode.begin(), upCode.end(), upCode.begin(), ::toupper);
            auto pRow = db.queryRow("SELECT * FROM promotions WHERE UPPER(code) = :c AND COALESCE(is_active, 1) = 1 LIMIT 1", {{":c", upCode}});
            if (pRow.is_null()) {
                promoValid = false;
                promoMessage = "Mã khuyến mãi [" + upCode + "] không tồn tại hoặc đã ngưng!";
            } else {
                double minOrd = jDbl(pRow, "min_order_amount", 0.0);
                if (subtotal < minOrd) {
                    promoValid = false;
                    promoMessage = "Chưa đạt giá trị đơn tối thiểu của mã [" + upCode + "]!";
                } else {
                    discountType = jStr(pRow, "discount_type", "percent");
                    discountValue = jDbl(pRow, "discount_value", 0.0);
                    discountAmount = (discountType == "percent")
                        ? (subtotal * std::min(100.0, std::max(0.0, discountValue))) / 100.0
                        : std::min(subtotal, std::max(0.0, discountValue));
                    double maxDisc = jDbl(pRow, "max_discount_amount", 0.0);
                    if (maxDisc > 0.0 && discountAmount > maxDisc) discountAmount = maxDisc;
                    promoMessage = "Đã áp dụng mã khuyến mãi [" + upCode + "]";
                }
            }
        } else if (discountValue > 0.0) {
            discountAmount = (discountType == "percent")
                ? (subtotal * std::min(100.0, std::max(0.0, discountValue))) / 100.0
                : std::min(subtotal, std::max(0.0, discountValue));
        }

        double afterDiscount = std::max(0.0, subtotal - discountAmount);
        double vatAmount = (afterDiscount * vatPercent) / 100.0;
        double totalAmount = afterDiscount + vatAmount;
        bool requiresPin = (discountAmount >= 50000.0) || (discountType == "percent" && discountValue >= 20.0 && promoCode.empty());

        ApiHandlers::sendJson(res, {
            {"success", true},
            {"subtotal", subtotal},
            {"discount_type", discountType},
            {"discount_value", discountValue},
            {"discount_amount", discountAmount},
            {"after_discount", afterDiscount},
            {"vat_percent", vatPercent},
            {"vat_amount", vatAmount},
            {"total_amount", totalAmount},
            {"promo_code", promoCode},
            {"promo_valid", promoValid},
            {"promo_message", promoMessage},
            {"requires_manager_pin", requiresPin},
            {"line_items", lineItems}
        });
        return true;
    }
    if (action == "block_spammer") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || userOpt->role == "customer") {
            ApiHandlers::sendError(res, "Không có quyền chặn spammer QR!", userOpt ? 403 : 401);
            return true;
        }
        std::string clientIp = BodyParser::getParam(req, body, "client_ip", "");
        std::string phone = BodyParser::getParam(req, body, "phone", "");
        int64_t orderId = 0;
        try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
        if (orderId > 0) {
            auto o = db.queryRow("SELECT client_ip, customer_name, table_id, order_code FROM orders WHERE id = :id", {{":id", orderId}});
            if (!o.is_null()) {
                if (clientIp.empty()) clientIp = jStr(o, "client_ip", "");
            }
        }
        if (clientIp.empty() && phone.empty()) {
            ApiHandlers::sendError(res, "Thiếu IP hoặc SĐT để đưa vào danh sách chặn QR!", 400);
            return true;
        }
        std::string reason = BodyParser::getParam(req, body, "reason", "Chặn đơn rác QR 24 giờ");
        db.beginTransaction();
        db.execute(R"(
            INSERT INTO qr_blacklist (client_ip, phone, reason, blocked_by, expires_at)
            VALUES (:ip, :ph, :rsn, :by, datetime('now', 'localtime', '+24 hours'))
        )", {{":ip", clientIp}, {":ph", phone}, {":rsn", reason}, {":by", userOpt->fullname}});
        if (orderId > 0) {
            db.execute("UPDATE orders SET status = 'cancelled', note = COALESCE(note, '') || ' [SPAM BLOCKED]' WHERE id = :id AND status = 'pending'", {{":id", orderId}});
            db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE active_order_id = :oid", {{":oid", orderId}});
        }
        db.commit();
        // ANTISPAM-07: Liên thông chặn Spammer QR sang mod_network_qos để đá rớt phiên WiFi tức thì
        if (!clientIp.empty()) {
            CyberNexus::PluginManager::instance().dispatchEvent("IPS_ABNORMAL_TRAFFIC", {
                {"ip", clientIp},
                {"tier", 2},
                {"action", "kick"},
                {"reason", "POS Block Spammer: " + reason}
            });
        }
        ApiHandlers::sendJson(res, {{"success", true}, {"message", "Đã chặn thiết bị/SĐT QR trong 24 giờ, hủy đơn rác & đá rớt phiên WiFi!"}});
        return true;
    }

    if (action == "change_payment_method") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || (userOpt->role != "admin" && userOpt->role != "cashier" && !userOpt->is_super_admin)) {
            ApiHandlers::sendError(res, "Chỉ Thu ngân hoặc Admin mới được đổi phương thức thanh toán!", userOpt ? 403 : 401);
            return true;
        }
        int64_t orderId = 0;
        try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
        std::string newMethod = BodyParser::getParam(req, body, "new_method", "");
        std::string reason = BodyParser::getParam(req, body, "reason", "");
        std::string mgrPin = BodyParser::getParam(req, body, "manager_pin", "");
        if (orderId <= 0 || (newMethod != "cash" && newMethod != "banking" && newMethod != "card") || reason.empty()) {
            ApiHandlers::sendError(res, "Thiếu order_id, new_method (cash/banking/card) hoặc lý do đổi phương thức!", 400);
            return true;
        }
        auto ord = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
        if (ord.is_null() || jStr(ord, "payment_status", "") != "paid") {
            ApiHandlers::sendError(res, "Chỉ được đổi phương thức thanh toán cho đơn ĐÃ thanh toán!", 400);
            return true;
        }
        std::string oldMethod = jStr(ord, "payment_method", "cash");
        if (oldMethod == newMethod) {
            ApiHandlers::sendError(res, "Phương thức mới trùng với phương thức hiện tại!", 400);
            return true;
        }
        if ((oldMethod == "card" || newMethod == "card") && userOpt->role != "admin" && !userOpt->is_super_admin) {
            json mgr;
            if (!verifyManagerPin(db, mgrPin, mgr)) {
                ApiHandlers::sendErrorCode(res, "MANAGER_PIN_REQUIRED", "Đổi sang/từ Thẻ POS yêu cầu mã PIN Chủ quán (Admin)!", json::object(), 403);
                return true;
            }
        }
        double tot = jDbl(ord, "total_amount", 0.0);
        std::string oCode = jStr(ord, "order_code", "");
        std::string nowStr = nowTsLocal();
        db.beginTransaction();
        db.execute("UPDATE orders SET payment_method = :nm WHERE id = :id", {{":nm", newMethod}, {":id", orderId}});
        db.execute(R"(
            INSERT INTO payment_transactions (order_id, order_code, tx_type, method, amount, verified_by, note, created_at)
            VALUES (:oid, :oc, 'adjust_out', :om, :neg, :vb, :nt, :cat)
        )", {{":oid", orderId}, {":oc", oCode}, {":om", oldMethod}, {":neg", -tot}, {":vb", userOpt->fullname}, {":nt", "Đổi phương thức: " + reason}, {":cat", nowStr}});
        db.execute(R"(
            INSERT INTO payment_transactions (order_id, order_code, tx_type, method, amount, verified_by, note, created_at)
            VALUES (:oid, :oc, 'adjust_in', :nm, :pos, :vb, :nt, :cat)
        )", {{":oid", orderId}, {":oc", oCode}, {":nm", newMethod}, {":pos", tot}, {":vb", userOpt->fullname}, {":nt", "Đổi từ " + oldMethod + ": " + reason}, {":cat", nowStr}});
        db.execute(R"(
            INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
            VALUES ('PAYMENT_METHOD_CHANGED', :lbl, 'WARN', :oid, :oc, :tc, :amt, :rsn, :uid, :un, :ur, :dtl, :cat)
        )", {
            {":lbl", "Đổi phương thức TT " + oldMethod + " -> " + newMethod},
            {":oid", orderId}, {":oc", oCode}, {":tc", jStr(ord, "table_code", "")},
            {":amt", tot}, {":rsn", reason}, {":uid", userOpt->id}, {":un", userOpt->fullname}, {":ur", userOpt->role},
            {":dtl", "Hóa đơn " + oCode + ": " + oldMethod + " -> " + newMethod}, {":cat", nowStr}
        });
        db.commit();
        ApiHandlers::sendJson(res, {{"success", true}, {"message", "Đã đổi phương thức thanh toán từ " + oldMethod + " sang " + newMethod + "!"}, {"new_method", newMethod}});
        return true;
    }

    return false;
}

void Dot6Handlers::runDot6PeriodicMaintenance() {
    static std::chrono::steady_clock::time_point s_lastRun{};
    auto nowTp = std::chrono::steady_clock::now();
    if (s_lastRun.time_since_epoch().count() != 0 &&
        std::chrono::duration_cast<std::chrono::seconds>(nowTp - s_lastRun).count() < 120) {
        return;
    }
    s_lastRun = nowTp;

    auto& db = Database::instance();
    ensureDot6Schema(db);

    try {
        json stale = db.query(R"(
            SELECT id, order_code, table_id, table_code FROM orders
            WHERE status = 'pending' AND payment_status = 'unpaid'
              AND order_type IN ('qr', 'online', 'delivery', 'takeaway')
              AND datetime(created_at) <= datetime('now', 'localtime', '-30 minutes')
        )");
        for (const auto& o : stale) {
            int64_t oid = jInt(o, "id", 0);
            if (oid <= 0) continue;
            db.beginTransaction();
            db.execute("UPDATE orders SET status = 'cancelled', note = COALESCE(note, '') || ' [AUTO EXPIRED 30M]' WHERE id = :id", {{":id", oid}});
            int64_t tid = jInt(o, "table_id", 0);
            if (tid > 0) {
                db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :tid AND active_order_id = :oid", {{":tid", tid}, {":oid", oid}});
            }
            db.commit();
        }
    } catch (...) {}

    try {
        json devs = db.query("SELECT * FROM attendance_devices WHERE is_active = 1");
        std::string nowStr = nowTsLocal();
        std::time_t nowSec = std::time(nullptr);
        for (const auto& d : devs) {
            int64_t devId = jInt(d, "id", 0);
            int interval = std::max<int>(60, static_cast<int>(jInt(d, "poll_interval_sec", 300)));
            std::time_t lastPollT = parseLocalTsDot6(jStr(d, "last_poll_at", ""));
            if (lastPollT > 0 && (nowSec - lastPollT) < interval) continue;

            std::string host = jStr(d, "ip_address", "");
            int port = static_cast<int>(jInt(d, "port", 80));
            std::string dUser = jStr(d, "username", "admin");
            std::string dPass = jStr(d, "password", "");
            std::string dName = jStr(d, "name", "Hikvision");

            std::string endIso = nowStr.substr(0, 10) + "T23:59:59+07:00";
            std::string startIso = nowStr.substr(0, 10) + "T00:00:00+07:00";
            json evts;
            std::string pErr;
            if (SaleApp::Hikvision::IsapiClient::pullAcsEvents(host, port, dUser, dPass, startIso, endIso, evts, pErr)) {
                for (const auto& ev : evts) {
                    std::string empNo = jStr(ev, "employeeNoString", jStr(ev, "employeeNo", ""));
                    if (empNo.empty()) continue;
                    auto uRow = db.queryRow("SELECT id FROM users WHERE user_code = :uc OR CAST(id AS TEXT) = :uc LIMIT 1", {{":uc", empNo}});
                    if (uRow.is_null()) continue;
                    int64_t uid = jInt(uRow, "id", 0);
                    std::string evTs = normalizeHikEventTs(jStr(ev, "time", jStr(ev, "dateTime", "")));
                    std::string serial = std::to_string(jInt(ev, "serialNo", 0));
                    std::string extId = "hik_" + std::to_string(devId) + "_" + empNo + "_" + (serial != "0" ? serial : evTs);
                    std::string vMode = jStr(ev, "currentVerifyMode", "face");
                    json out; std::string pE; int pCode = 200;
                    processUnifiedAttendancePunch(db, uid, "auto", "hikvision_device", vMode, devId, dName, "", extId, evTs, "", 600, out, pE, pCode);
                }
                db.execute("UPDATE attendance_devices SET last_poll_at = :lp, last_error = '' WHERE id = :id", {{":lp", nowStr}, {":id", devId}});
            } else {
                db.execute("UPDATE attendance_devices SET last_poll_at = :lp, last_error = :le WHERE id = :id", {{":lp", nowStr}, {":le", pErr}, {":id", devId}});
            }
        }
    } catch (...) {}
}

void Dot6Handlers::registerDot6Routes(httplib::Server& svr) {
    // 1. Printer Bridge & Cash Drawer (PAY-01)
    svr.Get("/api/printer/list", [](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt) {
            ApiHandlers::sendError(res, "Chưa đăng nhập!", 401);
            return;
        }
        auto& db = Database::instance();
        auto printers = SaleApp::Hardware::PrinterBridge::listWindowsPrinters();
        auto getSet = [&](const std::string& k, const std::string& def) -> std::string {
            auto r = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = :k LIMIT 1", {{":k", k}});
            return r.is_null() ? def : jStr(r, "setting_value", def);
        };
        ApiHandlers::sendJson(res, {
            {"success", true},
            {"printers", printers},
            {"config", {
                {"printer_type", getSet("printer_type", "windows")},
                {"printer_name", getSet("printer_name", printers.empty() ? "" : printers[0])},
                {"printer_ip", getSet("printer_ip", "")},
                {"printer_port", safeStoi(getSet("printer_port", "9100"), 9100)},
                {"paper_width", getSet("printer_paper_width", "80mm")}
            }},
            {"receipt_template", loadReceiptTemplateCfg(db)}
        });
    });

    svr.Post("/api/printer/print-receipt", [](const httplib::Request& req, httplib::Response& res) {
        if (!LicenseService::instance().isModuleEnabled("pos_core")) {
            ApiHandlers::sendErrorCode(res, "MODULE_NOT_LICENSED", "Module POS Bán Hàng & In Nhiệt không khả dụng hoặc thuê bao bị tạm khóa!", json::object(), 403);
            return;
        }
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || userOpt->role == "customer") {
            ApiHandlers::sendError(res, "Không có quyền in hóa đơn ESC/POS!", userOpt ? 403 : 401);
            return;
        }
        auto& db = Database::instance();
        json body = BodyParser::parseBody(req);
        int64_t orderId = jInt(body, "order_id", 0);
        bool isTemp = jBool(body, "is_temp", false);
        bool isReprint = jBool(body, "is_reprint", false);
        bool dryRun = jBool(body, "dry_run", false);

        auto ord = (orderId > 0) ? db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}}) : json(nullptr);
        if (ord.is_null() && body.contains("order") && body["order"].is_object()) {
            ord = body["order"];
        }
        if (ord.is_null()) {
            ApiHandlers::sendError(res, "Không tìm thấy hóa đơn để in!", 404);
            return;
        }
        json items = (orderId > 0)
            ? db.query("SELECT * FROM order_items WHERE order_id = :oid AND COALESCE(cancel_status, 'none') NOT IN ('approved', 'out_of_stock') ORDER BY id ASC", {{":oid", orderId}})
            : (body.contains("items") && body["items"].is_array() ? body["items"] : json::array());

        std::string payMethod = jStr(body, "payment_method", jStr(ord, "payment_method", "cash"));
        if (orderId > 0 && jStr(ord, "payment_status", "unpaid") != "paid" && !jBool(body, "force_paid_cash", false)) {
            isTemp = true;
        }
        double splitCash = jDbl(body, "split_cash", 0.0);
        if (splitCash <= 0.0 && payMethod == "split") {
            std::string bJson = jStr(ord, "payment_breakdown_json", "");
            json bj = json::parse(bJson, nullptr, false);
            if (bj.is_object()) splitCash = jDbl(bj, "cash", 0.0);
        }
        bool openDrawer = SaleApp::Hardware::PrinterBridge::shouldOpenCashDrawer(payMethod, isTemp, isReprint, splitCash);

        auto getSet = [&](const std::string& k, const std::string& def) -> std::string {
            auto r = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = :k LIMIT 1", {{":k", k}});
            return r.is_null() ? def : jStr(r, "setting_value", def);
        };
        json store = {
            {"name", getSet("store_name", "CyberNexus POS")},
            {"address", getSet("store_address", "")},
            {"hotline", getSet("store_hotline", "")},
            {"wifi", getSet("store_wifi", "")},
            {"header_note", getSet("print_header_note", "")},
            {"footer_note", getSet("print_footer_note", "Cam on quy khach!")}
        };
        json tplCfg = loadReceiptTemplateCfg(db);
        std::string wm = isTemp ? "PHIEU TAM TINH" : (isReprint ? "BAN IN LAI" : "");
        std::string escBytes = SaleApp::Hardware::PrinterBridge::buildReceiptEscPos(ord, items, store, tplCfg, openDrawer, wm);

        std::string pType = jStr(body, "printer_type", getSet("printer_type", "windows"));
        std::string pName = jStr(body, "printer_name", getSet("printer_name", ""));
        std::string pIp = jStr(body, "printer_ip", getSet("printer_ip", ""));
        int pPort = static_cast<int>(jInt(body, "printer_port", safeStoi(getSet("printer_port", "9100"), 9100)));

        bool sentOk = dryRun;
        std::string err;
        if (!dryRun) {
            if (pType == "lan" && !pIp.empty()) {
                sentOk = SaleApp::Hardware::PrinterBridge::sendRawLanTcp(pIp, pPort, escBytes, err);
            } else if (!pName.empty()) {
                sentOk = SaleApp::Hardware::PrinterBridge::sendRawWindowsSpooler(pName, escBytes, err);
            } else {
                err = "Chưa chọn máy in ESC/POS (cần cấu hình Printer IP hoặc tên máy in Windows)!";
            }
        }
        if (openDrawer && sentOk) {
            try {
                db.execute(R"(
                    INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                    VALUES ('CASH_DRAWER_OPEN', 'Mở két tiền khi in bill tiền mặt', 'INFO', :oid, :oc, :tc, :amt, 'cash_payment', :uid, :un, :ur, :dtl, :cat)
                )", {
                    {":oid", orderId}, {":oc", jStr(ord, "order_code", "")}, {":tc", jStr(ord, "table_code", "")},
                    {":amt", jDbl(ord, "total_amount", 0.0)}, {":uid", userOpt->id}, {":un", userOpt->fullname}, {":ur", userOpt->role},
                    {":dtl", "ESC/POS kick pulse executed via " + pType}, {":cat", nowTsLocal()}
                });
            } catch (...) {}
        }
        if (!sentOk) {
            ApiHandlers::sendJson(res, {
                {"success", false},
                {"drawer_opened", false},
                {"printer_type", pType},
                {"message", err},
                {"bytes_prepared", escBytes.size()}
            }, 400);
            return;
        }
        ApiHandlers::sendJson(res, {
            {"success", true},
            {"drawer_opened", openDrawer},
            {"printer_type", pType},
            {"bytes_sent", escBytes.size()},
            {"message", openDrawer ? "Đã in hóa đơn & bật két tiền!" : "Đã in hóa đơn ESC/POS (Két giữ đóng)!"}
        });
    });

    svr.Post("/api/printer/open-drawer", [](const httplib::Request& req, httplib::Response& res) {
        if (!LicenseService::instance().isModuleEnabled("pos_core")) {
            ApiHandlers::sendErrorCode(res, "MODULE_NOT_LICENSED", "Module POS Bán Hàng & In Nhiệt không khả dụng hoặc thuê bao bị tạm khóa!", json::object(), 403);
            return;
        }
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || (userOpt->role != "admin" && userOpt->role != "cashier" && !userOpt->is_super_admin)) {
            ApiHandlers::sendError(res, "Chỉ Thu ngân hoặc Chủ quán mới được mở két tiền!", userOpt ? 403 : 401);
            return;
        }
        auto& db = Database::instance();
        json body = BodyParser::parseBody(req);
        std::string reason = BodyParser::getParam(req, body, "reason", "");
        std::string mgrPin = BodyParser::getParam(req, body, "manager_pin", "");
        if (reason.empty()) {
            ApiHandlers::sendError(res, "Bắt buộc nhập lý do mở két tiền ngoài giao dịch (No-Sale)!", 400);
            return;
        }
        json mgr;
        if (userOpt->role != "admin" && !userOpt->is_super_admin && !verifyManagerPin(db, mgrPin, mgr)) {
            ApiHandlers::sendErrorCode(res, "MANAGER_PIN_REQUIRED", "Mở két tiền không gắn bill yêu cầu mã PIN Chủ quán (Admin)!", json::object(), 403);
            return;
        }

        auto getSet = [&](const std::string& k, const std::string& def) -> std::string {
            auto r = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = :k LIMIT 1", {{":k", k}});
            return r.is_null() ? def : jStr(r, "setting_value", def);
        };
        std::string pType = jStr(body, "printer_type", getSet("printer_type", "windows"));
        std::string pName = jStr(body, "printer_name", getSet("printer_name", ""));
        std::string pIp = jStr(body, "printer_ip", getSet("printer_ip", ""));
        int pPort = static_cast<int>(jInt(body, "printer_port", safeStoi(getSet("printer_port", "9100"), 9100)));
        std::string pulse = SaleApp::Hardware::PrinterBridge::buildCashDrawerPulse();

        bool ok = jBool(body, "dry_run", false);
        std::string err;
        if (!ok) {
            if (pType == "lan" && !pIp.empty()) ok = SaleApp::Hardware::PrinterBridge::sendRawLanTcp(pIp, pPort, pulse, err);
            else if (!pName.empty()) ok = SaleApp::Hardware::PrinterBridge::sendRawWindowsSpooler(pName, pulse, err);
            else err = "Chưa cấu hình máy in gắn két tiền!";
        }
        try {
            db.execute(R"(
                INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                VALUES ('CASH_DRAWER_NO_SALE', 'Mở két tiền không in hóa đơn (No-Sale)', 'CRITICAL', 0, 'NO-SALE', 'QUẦY THU NGÂN', 0, :rsn, :uid, :un, :ur, :dtl, :cat)
            )", {
                {":rsn", reason}, {":uid", userOpt->id}, {":un", userOpt->fullname}, {":ur", userOpt->role},
                {":dtl", ok ? "Pulse sent" : ("Failed: " + err)}, {":cat", nowTsLocal()}
            });
        } catch (...) {}

        if (!ok) {
            ApiHandlers::sendError(res, err, 400);
            return;
        }
        ApiHandlers::sendJson(res, {{"success", true}, {"drawer_opened", true}, {"message", "Đã gửi xung mở két tiền & ghi Audit Log CRITICAL!"}});
    });

    auto offlineDictionaryTranslate = [](const std::string& text, const std::string& srcLang, const std::string& tgtLang) -> std::string {
        if (text.empty() || srcLang == tgtLang) return text;
        static const std::vector<std::pair<std::string, std::string>> kExactMap = {
            {"Dữ liệu gói cài đặt không hợp lệ hoặc bị hỏng!", "Invalid or corrupted installation package data!"},
            {"Không thể tạo file tạm để giải nén!", "Cannot create temporary file for extraction!"},
            {"Không thể giải nén bộ cài đặt!", "Failed to extract installation package!"},
            {"Cài đặt thành công!", "Installation completed successfully!"},
            {"Đang xử lý", "In Progress"},
            {"Chờ thanh toán", "Awaiting Payment"},
            {"Chờ giao", "Ready for Handover"},
            {"Làm mới", "Refresh"},
            {"Thoát", "Exit"},
            {"Hủy", "Cancel"},
            {"Lưu", "Save"},
            {"Đóng", "Close"},
            {"Xóa", "Delete"},
            {"Thêm", "Add"},
            {"Xác nhận", "Confirm"},
            {"Đăng nhập", "Sign In"},
            {"Đăng xuất", "Sign Out"}
        };
        for (const auto& kv : kExactMap) {
            if (text == kv.first) return kv.second;
        }
        static const std::vector<std::pair<std::string, std::string>> kPhraseMap = {
            {"Dữ liệu gói cài đặt", "Installation package data"},
            {"gói cài đặt", "installation package"},
            {"bộ cài đặt", "installer package"},
            {"không hợp lệ hoặc bị hỏng", "is invalid or corrupted"},
            {"không hợp lệ", "invalid"},
            {"bị hỏng", "corrupted"},
            {"Không thể tạo file tạm", "Cannot create temporary file"},
            {"để giải nén", "for extraction"},
            {"Không thể mở", "Cannot open"},
            {"Không thể kết nối", "Cannot connect to"},
            {"Không thể lưu", "Cannot save"},
            {"Không thể tải", "Cannot load"},
            {"Không thể xóa", "Cannot delete"},
            {"Không tìm thấy", "Not found"},
            {"Vui lòng đăng nhập", "Please sign in"},
            {"Vui lòng nhập", "Please enter"},
            {"Vui lòng chọn", "Please select"},
            {"Vui lòng kiểm tra", "Please check"},
            {"thành công", "successfully"},
            {"thất bại", "failed"},
            {"Lỗi kết nối", "Connection error"},
            {"máy chủ", "server"},
            {"nhân viên", "staff"},
            {"khách hàng", "customer"},
            {"hóa đơn", "invoice"},
            {"thanh toán", "payment"},
            {"mật khẩu", "password"},
            {"tài khoản", "account"},
            {"bản quyền", "license"},
            {"cửa hàng", "store"},
            {"món ăn", "dish"},
            {"nhóm hàng", "category"},
            {"nguyên vật liệu", "ingredient"},
            {"ca làm việc", "work shift"},
            {"chấm công", "attendance"},
            {"bảng lương", "payroll"}
        };
        std::string out = text;
        for (const auto& kv : kPhraseMap) {
            size_t pos = 0;
            while ((pos = out.find(kv.first, pos)) != std::string::npos) {
                out.replace(pos, kv.first.size(), kv.second);
                pos += kv.second.size();
            }
        }
        return out;
    };

    svr.Post("/api/i18n/ai-translate", [offlineDictionaryTranslate](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        json body = BodyParser::parseBody(req);
        const std::string clientProvidedKey = jStr(body, "gemini_api_key", "");
        const bool isLoopback = (req.remote_addr == "127.0.0.1" || req.remote_addr == "::1" || req.remote_addr == "::ffff:127.0.0.1");
        if (userOpt) {
            if (userOpt->role != "admin" && !userOpt->is_super_admin) {
                ApiHandlers::sendError(res, "Chỉ Chủ quán (Admin) mới được sử dụng AI dịch ngôn ngữ!", 403);
                return;
            }
        } else if (!(isLoopback && !clientProvidedKey.empty())) {
            ApiHandlers::sendError(res, "Chỉ Chủ quán (Admin) mới được sử dụng AI dịch ngôn ngữ!", 401);
            return;
        }
        auto& db = Database::instance();
        std::string srcLang = jStr(body, "source_lang", "vi");
        std::string tgtLang = jStr(body, "target_lang", "en");
        std::string tgtName = jStr(body, "target_lang_name", tgtLang);
        json itemsIn = (body.contains("items") && body["items"].is_array()) ? body["items"] : json::array();
        if (itemsIn.empty() && !jStr(body, "text", "").empty()) {
            itemsIn.push_back({{"key", jStr(body, "key", "single")}, {"text", jStr(body, "text", "")}});
        }
        if (itemsIn.empty() || itemsIn.size() > 50) {
            ApiHandlers::sendError(res, "Danh sách chuỗi cần dịch phải từ 1 đến 50 mục mỗi lượt!", 400);
            return;
        }
        std::string apiKey = resolveLocalGeminiKeyDot6(db, jStr(body, "gemini_api_key", ""));
        if (!apiKey.empty()) {
            std::string prompt = "You are a professional software localization translator for an F&B POS & Restaurant OS (CyberNexus POS).\n"
                "Translate each UI string from '" + srcLang + "' to '" + tgtLang + "' (" + tgtName + ").\n"
                "Preserve all placeholders like {name}, {count}, %s, %d and HTML tags verbatim.\n"
                "Return strictly JSON object: {\"translations\": [{\"key\": \"...\", \"translated\": \"...\"}]}.\n\nInput:\n" + itemsIn.dump();
            json contents = json::array({{{"parts", json::array({{{"text", prompt}}})}}});
            std::string textOut, modelUsed, err;
            if (!SaleApp::AI::geminiGenerateContentText(apiKey, contents, true, textOut, modelUsed, err)) {
                ApiHandlers::sendError(res, "Lỗi Gemini AI Translate: " + err, 502);
                return;
            }
            json parsed = json::parse(textOut, nullptr, false);
            if (!parsed.is_object() || !parsed.contains("translations")) {
                ApiHandlers::sendError(res, "AI trả về dữ liệu dịch không hợp lệ!", 502);
                return;
            }
            ApiHandlers::sendJson(res, {{"success", true}, {"translations", parsed["translations"]}, {"model", modelUsed}});
            return;
        }
        std::string masterUrl = SaleApp::Config::AppConfig::instance().getMasterServerUrl();
        if (masterUrl.empty()) masterUrl = "http://127.0.0.1:8500";
        while (!masterUrl.empty() && masterUrl.back() == '/') masterUrl.pop_back();
        json fwd = body;
        fwd["license_key"] = resolveLicenseKeyDot6(db);
        int st = 0; std::string rawResp, errOut;
        if (SaleApp::AI::winHttpUrlPostJson(masterUrl + "/api/i18n/ai-translate", fwd.dump(), st, rawResp, errOut)) {
            res.status = st;
            res.set_content(rawResp, "application/json; charset=utf-8");
            return;
        }
        ApiHandlers::sendError(res, "Chưa cấu hình Gemini Key nội bộ và không kết nối được Master AI: " + errOut, 502);
        return;
    });

    // 3. Hikvision DS-K1T343MX ISAPI Integration (HR-08)
    svr.Get("/api/attendance/hikvision/devices", [](const httplib::Request& req, httplib::Response& res) {
        if (!LicenseService::instance().isModuleEnabled("staff_shifts")) {
            ApiHandlers::sendErrorCode(res, "MODULE_NOT_LICENSED", "Module Nhân Viên, Phân Ca & Chấm Công chưa được cấp phép!", json::object(), 403);
            return;
        }
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            ApiHandlers::sendError(res, "Chỉ Admin mới được quản lý máy chấm công!", userOpt ? 403 : 401);
            return;
        }
        auto& db = Database::instance();
        ensureDot6Schema(db);
        json rows = db.query("SELECT id, name, device_type, ip_address, port, username, model, serial_number, is_active, poll_interval_sec, last_poll_at, last_sync_at, last_error, created_at FROM attendance_devices ORDER BY id DESC");
        for (auto& r : rows) r["password_masked"] = "••••••••";
        ApiHandlers::sendJson(res, {{"success", true}, {"data", rows}});
    });

    svr.Post("/api/attendance/hikvision/devices", [](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            ApiHandlers::sendError(res, "Chỉ Admin mới được cấu hình máy chấm công!", userOpt ? 403 : 401);
            return;
        }
        auto& db = Database::instance();
        ensureDot6Schema(db);
        json body = BodyParser::parseBody(req);
        std::string op = jStr(body, "op", "save");
        int64_t id = jInt(body, "id", 0);
        if (op == "delete" && id > 0) {
            db.execute("DELETE FROM attendance_devices WHERE id = :id", {{":id", id}});
            ApiHandlers::sendJson(res, {{"success", true}, {"message", "Đã xóa thiết bị Hikvision!"}});
            return;
        }
        std::string name = jStr(body, "name", "Máy chấm công Cửa chính");
        std::string ip = jStr(body, "ip_address", "");
        int port = std::max<int>(1, std::min<int>(65535, static_cast<int>(jInt(body, "port", 80))));
        std::string u = jStr(body, "username", "admin");
        std::string p = jStr(body, "password", "");
        std::string model = jStr(body, "model", "DS-K1T343MX");
        int isActive = static_cast<int>(jInt(body, "is_active", 1));
        int pollSec = std::max<int>(60, static_cast<int>(jInt(body, "poll_interval_sec", 300)));
        if (ip.empty()) {
            ApiHandlers::sendError(res, "Vui lòng nhập IP thiết bị Hikvision!", 400);
            return;
        }
        if (id > 0) {
            if (p.empty() || p == maskSecret("x")) {
                auto old = db.queryRow("SELECT password FROM attendance_devices WHERE id = :id", {{":id", id}});
                if (!old.is_null()) p = jStr(old, "password", "");
            }
            db.execute(R"(
                UPDATE attendance_devices SET name = :n, ip_address = :ip, port = :pt, username = :u, password = :p, model = :md, is_active = :ia, poll_interval_sec = :ps WHERE id = :id
            )", {{":n", name}, {":ip", ip}, {":pt", port}, {":u", u}, {":p", p}, {":md", model}, {":ia", isActive}, {":ps", pollSec}, {":id", id}});
        } else {
            id = db.execute(R"(
                INSERT INTO attendance_devices (name, ip_address, port, username, password, model, is_active, poll_interval_sec)
                VALUES (:n, :ip, :pt, :u, :p, :md, :ia, :ps)
            )", {{":n", name}, {":ip", ip}, {":pt", port}, {":u", u}, {":p", p}, {":md", model}, {":ia", isActive}, {":ps", pollSec}});
        }
        ApiHandlers::sendJson(res, {{"success", true}, {"id", id}, {"message", "Đã lưu thiết bị Hikvision DS-K1T343MX!"}});
    });

    svr.Post("/api/attendance/hikvision/test", [](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            ApiHandlers::sendError(res, "Chỉ Admin mới được test thiết bị Hikvision!", userOpt ? 403 : 401);
            return;
        }
        auto& db = Database::instance();
        ensureDot6Schema(db);
        json body = BodyParser::parseBody(req);
        int64_t devId = jInt(body, "device_id", 0);
        std::string ip = jStr(body, "ip_address", "");
        int port = static_cast<int>(jInt(body, "port", 80));
        std::string u = jStr(body, "username", "admin");
        std::string p = jStr(body, "password", "");
        if (devId > 0) {
            auto d = db.queryRow("SELECT * FROM attendance_devices WHERE id = :id", {{":id", devId}});
            if (!d.is_null()) {
                if (ip.empty()) ip = jStr(d, "ip_address", "");
                if (!body.contains("port")) port = static_cast<int>(jInt(d, "port", 80));
                if (!body.contains("username")) u = jStr(d, "username", "admin");
                if (p.empty() || p == "••••••••") p = jStr(d, "password", "");
            }
        }
        json info;
        std::string err;
        if (!SaleApp::Hikvision::IsapiClient::testDeviceInfo(ip, port, u, p, info, err)) {
            if (devId > 0) db.execute("UPDATE attendance_devices SET last_error = :le WHERE id = :id", {{":le", err}, {":id", devId}});
            ApiHandlers::sendError(res, err, 502);
            return;
        }
        if (devId > 0) {
            db.execute("UPDATE attendance_devices SET serial_number = :sn, last_error = '' WHERE id = :id",
                       {{":sn", jStr(info, "serialNumber", "")}, {":id", devId}});
        }
        ApiHandlers::sendJson(res, {{"success", true}, {"device_info", info}, {"message", "Kết nối ISAPI Hikvision (" + jStr(info, "model", "DS-K1T343MX") + ") thành công!"}});
    });

    svr.Post("/api/attendance/hikvision/sync-users", [](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            ApiHandlers::sendError(res, "Chỉ Admin mới được đồng bộ nhân viên lên Hikvision!", userOpt ? 403 : 401);
            return;
        }
        auto& db = Database::instance();
        ensureDot6Schema(db);
        json body = BodyParser::parseBody(req);
        int64_t devId = jInt(body, "device_id", 0);
        auto d = (devId > 0) ? db.queryRow("SELECT * FROM attendance_devices WHERE id = :id", {{":id", devId}})
                             : db.queryRow("SELECT * FROM attendance_devices WHERE is_active = 1 ORDER BY id ASC LIMIT 1");
        if (d.is_null()) {
            ApiHandlers::sendError(res, "Chưa có thiết bị Hikvision nào được cấu hình!", 404);
            return;
        }
        devId = jInt(d, "id", 0);
        json users = db.query("SELECT id, user_code, fullname, username FROM users WHERE status = 'active' AND role != 'customer'");
        int okCnt = 0, failCnt = 0;
        std::string lastErr;
        for (const auto& u : users) {
            std::string empNo = jStr(u, "user_code", "");
            if (empNo.empty()) empNo = std::to_string(jInt(u, "id", 0));
            std::string fname = jStr(u, "fullname", jStr(u, "username", ""));
            std::string err;
            if (SaleApp::Hikvision::IsapiClient::syncUserToDevice(jStr(d, "ip_address", ""), static_cast<int>(jInt(d, "port", 80)), jStr(d, "username", "admin"), jStr(d, "password", ""), empNo, fname, err)) {
                okCnt++;
            } else {
                failCnt++;
                lastErr = err;
            }
        }
        db.execute("UPDATE attendance_devices SET last_sync_at = :ls, last_error = :le WHERE id = :id",
                   {{":ls", nowTsLocal()}, {":le", failCnt > 0 ? lastErr : ""}, {":id", devId}});
        ApiHandlers::sendJson(res, {{"success", okCnt > 0 || users.empty()}, {"synced_count", okCnt}, {"failed_count", failCnt}, {"last_error", lastErr}, {"message", "Đã đồng bộ " + std::to_string(okCnt) + "/" + std::to_string(users.size()) + " nhân viên lên Hikvision!"}});
    });

    svr.Post("/api/attendance/hikvision/poll", [](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            ApiHandlers::sendError(res, "Chỉ Admin mới được kéo log Hikvision!", userOpt ? 403 : 401);
            return;
        }
        auto& db = Database::instance();
        ensureDot6Schema(db);
        json body = BodyParser::parseBody(req);
        int64_t devId = jInt(body, "device_id", 0);
        auto d = (devId > 0) ? db.queryRow("SELECT * FROM attendance_devices WHERE id = :id", {{":id", devId}})
                             : db.queryRow("SELECT * FROM attendance_devices WHERE is_active = 1 ORDER BY id ASC LIMIT 1");
        if (d.is_null()) {
            ApiHandlers::sendError(res, "Chưa cấu hình thiết bị Hikvision!", 404);
            return;
        }
        devId = jInt(d, "id", 0);
        std::string today = nowTsLocal().substr(0, 10);
        std::string startIso = jStr(body, "start_time", today + "T00:00:00+07:00");
        std::string endIso = jStr(body, "end_time", today + "T23:59:59+07:00");
        json evts;
        std::string err;
        if (!SaleApp::Hikvision::IsapiClient::pullAcsEvents(jStr(d, "ip_address", ""), static_cast<int>(jInt(d, "port", 80)), jStr(d, "username", "admin"), jStr(d, "password", ""), startIso, endIso, evts, err)) {
            db.execute("UPDATE attendance_devices SET last_poll_at = :lp, last_error = :le WHERE id = :id", {{":lp", nowTsLocal()}, {":le", err}, {":id", devId}});
            ApiHandlers::sendError(res, err, 502);
            return;
        }
        int processed = 0, applied = 0;
        for (const auto& ev : evts) {
            std::string empNo = jStr(ev, "employeeNoString", jStr(ev, "employeeNo", ""));
            if (empNo.empty()) continue;
            std::string evTs = normalizeHikEventTs(jStr(ev, "time", jStr(ev, "dateTime", "")));
            std::string serial = std::to_string(jInt(ev, "serialNo", 0));
            std::string extId = "hik_" + std::to_string(devId) + "_" + empNo + "_" + (serial != "0" ? serial : evTs);
            std::string vMode = jStr(ev, "currentVerifyMode", "face");
            auto uRow = db.queryRow("SELECT id FROM users WHERE user_code = :uc OR CAST(id AS TEXT) = :uc LIMIT 1", {{":uc", empNo}});
            if (uRow.is_null()) {
                auto dupU = db.queryRow("SELECT id FROM attendance_raw_logs WHERE external_event_id = :eid LIMIT 1", {{":eid", extId}});
                if (dupU.is_null()) {
                    try {
                        db.execute("INSERT INTO attendance_raw_logs (device_id, device_name, user_id, employee_no, user_name, event_time, verify_mode, source, external_event_id, status, note) VALUES (:did, :dn, 0, :eno, :un, :et, :vm, 'hikvision_device', :eid, 'unmatched_employee', 'Chưa khớp user_code trên POS')",
                            {{":did", devId}, {":dn", jStr(d, "name", "Hikvision")}, {":eno", empNo}, {":un", jStr(ev, "name", empNo)}, {":et", evTs}, {":vm", vMode}, {":eid", extId}});
                    } catch (...) {}
                }
                continue;
            }
            processed++;
            json out; std::string pE; int pCode = 200;
            if (processUnifiedAttendancePunch(db, jInt(uRow, "id", 0), "auto", "hikvision_device", vMode, devId, jStr(d, "name", "Hikvision"), "", extId, evTs, "", 600, out, pE, pCode) && !jBool(out, "duplicate", false)) {
                applied++;
            }
        }
        db.execute("UPDATE attendance_devices SET last_poll_at = :lp, last_error = '' WHERE id = :id", {{":lp", nowTsLocal()}, {":id", devId}});
        ApiHandlers::sendJson(res, {{"success", true}, {"total_events", evts.size()}, {"matched_users", processed}, {"applied", applied}, {"message", "Đã đồng bộ " + std::to_string(applied) + " lượt chấm công mới từ Hikvision!"}});
    });

    svr.Post("/api/attendance/hikvision/event", [](const httplib::Request& req, httplib::Response& res) {
        auto& db = Database::instance();
        ensureDot6Schema(db);
        std::string clientIp = getClientIpDot6(req);
        auto dev = db.queryRow("SELECT * FROM attendance_devices WHERE is_active = 1 AND ip_address = :ip LIMIT 1", {{":ip", clientIp}});
        if (dev.is_null()) {
            std::string hdrTok = req.get_header_value("X-Hikvision-Token");
            std::string expectedTok = getOrCreateStoreSecret(db, "hikvision_webhook_token");
            if (!hdrTok.empty() && hdrTok == expectedTok) {
                dev = db.queryRow("SELECT * FROM attendance_devices WHERE is_active = 1 ORDER BY id ASC LIMIT 1");
            }
        }
        if (dev.is_null()) {
            ApiHandlers::sendError(res, "Thiết bị IP " + clientIp + " chưa đăng ký trong hệ thống Hikvision!", 403);
            return;
        }
        json evt;
        std::string picBytes;
        if (!SaleApp::Hikvision::IsapiClient::parseIncomingEvent(req, evt, picBytes)) {
            ApiHandlers::sendError(res, "Payload sự kiện Hikvision không hợp lệ!", 400);
            return;
        }
        std::string empNo = jStr(evt, "employeeNoString", jStr(evt, "employeeNo", ""));
        if (empNo.empty()) {
            ApiHandlers::sendJson(res, {{"success", true}, {"ignored", true}, {"message", "Sự kiện không chứa employeeNo"}});
            return;
        }
        auto uRow = db.queryRow("SELECT id FROM users WHERE user_code = :uc OR CAST(id AS TEXT) = :uc LIMIT 1", {{":uc", empNo}});
        if (uRow.is_null()) {
            ApiHandlers::sendJson(res, {{"success", false}, {"message", "Không tìm thấy mã nhân viên " + empNo}}, 404);
            return;
        }
        std::string photoPath;
        if (!picBytes.empty()) {
            auto v = SaleApp::Security::UploadGuard::validate(picBytes, "hik.jpg", SaleApp::Security::UploadKind::Image);
            if (v.ok) {
                std::string fname = SaleApp::Security::UploadGuard::makeRandomUuidName("hik_face", v.ext);
                fs::path outP; std::string wErr;
                if (SaleApp::Security::UploadGuard::writeSafeFile(SaleApp::Config::AppConfig::instance().getUploadsDir() / "attendance", fname, picBytes, outP, wErr)) {
                    photoPath = "uploads/attendance/" + fname;
                }
            }
        }
        int64_t devId = jInt(dev, "id", 0);
        std::string dName = jStr(dev, "name", "DS-K1T343MX");
        std::string evTs = normalizeHikEventTs(jStr(evt, "dateTime", jStr(evt, "time", "")));
        std::string serial = std::to_string(jInt(evt, "serialNo", 0));
        std::string extId = "hik_" + std::to_string(devId) + "_" + empNo + "_" + (serial != "0" ? serial : evTs);
        std::string vMode = jStr(evt, "currentVerifyMode", "face");

        json out; std::string err; int code = 200;
        if (!processUnifiedAttendancePunch(db, jInt(uRow, "id", 0), "auto", "hikvision_device", vMode, devId, dName, photoPath, extId, evTs, "", 600, out, err, code)) {
            ApiHandlers::sendError(res, err, code);
            return;
        }
        ApiHandlers::sendJson(res, out, code);
    });

    // 4. Offline EMVCo VietQR Napas247 Endpoints (ARCH-05)
    svr.Get("/api/payment/vietqr_payload", [](const httplib::Request& req, httplib::Response& res) {
        if (!LicenseService::instance().isModuleEnabled("vietqr_payment")) {
            ApiHandlers::sendErrorCode(res, "MODULE_NOT_LICENSED", "Module Thanh Toán VietQR Tự Động chưa được cấp phép!", json::object(), 403);
            return;
        }
        auto& db = Database::instance();
        auto getSet = [&](const std::string& k, const std::string& def) -> std::string {
            auto r = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = :k LIMIT 1", {{":k", k}});
            return r.is_null() ? def : jStr(r, "setting_value", def);
        };
        std::string bankId = req.has_param("bank_id") ? req.get_param_value("bank_id") : getSet("bank_id", "OCB");
        std::string accNo = req.has_param("account_no") ? req.get_param_value("account_no") : getSet("bank_account_no", "0918608073");
        std::string accName = req.has_param("account_name") ? req.get_param_value("account_name") : getSet("bank_account_name", "NGUYEN CHI HUNG");
        std::string orderCode = req.has_param("order_code") ? req.get_param_value("order_code") : "POS";
        int64_t amount = 0;
        if (req.has_param("amount")) {
            try { amount = std::stoll(req.get_param_value("amount")); } catch (...) {}
        }
        std::string note = "TT " + orderCode;
        std::string emv = SaleApp::VietQr::buildEmvCoPayload(bankId, accNo, amount, note, accName);
        ApiHandlers::sendJson(res, {
            {"success", true},
            {"bank_id", bankId},
            {"bank_bin", SaleApp::VietQr::bankIdToBin(bankId)},
            {"account_no", accNo},
            {"account_name", accName},
            {"amount", amount},
            {"note", note},
            {"vietqr_payload", emv},
            {"vietqr_url", "/api/payment/vietqr_svg?bank_id=" + bankId + "&account_no=" + accNo + "&amount=" + std::to_string(amount) + "&order_code=" + orderCode}
        });
    });

    svr.Get("/api/payment/vietqr_svg", [](const httplib::Request& req, httplib::Response& res) {
        auto& db = Database::instance();
        auto getSet = [&](const std::string& k, const std::string& def) -> std::string {
            auto r = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = :k LIMIT 1", {{":k", k}});
            return r.is_null() ? def : jStr(r, "setting_value", def);
        };
        std::string bankId = req.has_param("bank_id") ? req.get_param_value("bank_id") : getSet("bank_id", "OCB");
        std::string accNo = req.has_param("account_no") ? req.get_param_value("account_no") : getSet("bank_account_no", "0918608073");
        std::string accName = req.has_param("account_name") ? req.get_param_value("account_name") : getSet("bank_account_name", "NGUYEN CHI HUNG");
        std::string orderCode = req.has_param("order_code") ? req.get_param_value("order_code") : "POS";
        int64_t amount = 0;
        if (req.has_param("amount")) {
            try { amount = std::stoll(req.get_param_value("amount")); } catch (...) {}
        }
        std::string note = "TT " + orderCode;
        std::string emv = SaleApp::VietQr::buildEmvCoPayload(bankId, accNo, amount, note, accName);
        std::string svg = SaleApp::VietQr::buildOfflineVietQrSvg(bankId, accNo, accName, amount, note, emv);
        res.status = 200;
        res.set_header("Cache-Control", "no-store");
        res.set_content(svg, "image/svg+xml; charset=utf-8");
    });

    // 5. I18N Studio Backend Catalog, DB Entity Sync & Live Publisher (I18N-09 / I18N-11 / I18N-12)
    auto applyDbEntityI18n = [](Database& db, const std::string& key, const json& translationsObj) {
        if (key.rfind("db.", 0) != 0 || !translationsObj.is_object()) return;
        // Format: db.<table>.<id>.<field>
        size_t p1 = 3;
        size_t p2 = key.find('.', p1);
        if (p2 == std::string::npos) return;
        size_t p3 = key.find('.', p2 + 1);
        if (p3 == std::string::npos) return;
        std::string tbl = key.substr(p1, p2 - p1);
        std::string idStr = key.substr(p2 + 1, p3 - p2 - 1);
        std::string fld = key.substr(p3 + 1);
        if (tbl != "categories" && tbl != "products" && tbl != "tables_areas" && tbl != "promotions") return;
        if (fld != "name" && fld != "unit" && fld != "description") return;
        int64_t rowId = 0;
        try { rowId = std::stoll(idStr); } catch (...) { return; }
        if (rowId <= 0) return;
        auto curRow = db.queryRow("SELECT COALESCE(i18n_json, '{}') as i18n_json FROM " + tbl + " WHERE id = :id", {{":id", rowId}});
        if (curRow.is_null()) return;
        json curJ = json::parse(jStr(curRow, "i18n_json", "{}"), nullptr, false);
        if (!curJ.is_object()) curJ = json::object();
        for (auto it = translationsObj.begin(); it != translationsObj.end(); ++it) {
            if (!it.value().is_string()) continue;
            std::string lg = it.key();
            std::string val = it.value().get<std::string>();
            if (val.empty()) continue;
            if (!curJ.contains(lg) || !curJ[lg].is_object()) curJ[lg] = json::object();
            curJ[lg][fld] = val;
        }
        db.execute("UPDATE " + tbl + " SET i18n_json = :j WHERE id = :id", {{":j", curJ.dump()}, {":id", rowId}});
        if (translationsObj.contains("vi") && translationsObj["vi"].is_string() && !translationsObj["vi"].get<std::string>().empty()) {
            db.execute("UPDATE " + tbl + " SET " + fld + " = :v WHERE id = :id", {{":v", translationsObj["vi"].get<std::string>()}, {":id", rowId}});
        }
    };

    svr.Get("/api/i18n/catalog", [](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            ApiHandlers::sendError(res, "Chỉ Admin mới được truy cập danh mục quản trị ngôn ngữ!", userOpt ? 403 : 401);
            return;
        }
        auto& db = Database::instance();
        ensureDot6Schema(db);
        json savedRows = db.query("SELECT * FROM i18n_catalog ORDER BY key ASC");
        json dbEntities = json::array();

        auto pushEntity = [&](const std::string& tbl, int64_t id, const std::string& fld, const std::string& viVal, const std::string& i18nRaw, const std::string& labelPrefix) {
            json tr = {{"vi", viVal}};
            json parsed = json::parse(i18nRaw, nullptr, false);
            if (parsed.is_object()) {
                for (auto it = parsed.begin(); it != parsed.end(); ++it) {
                    if (it.value().is_object() && it.value().contains(fld) && it.value()[fld].is_string()) {
                        tr[it.key()] = it.value()[fld];
                    }
                }
            }
            dbEntities.push_back({
                {"group", "13_database_" + tbl},
                {"key", "db." + tbl + "." + std::to_string(id) + "." + fld},
                {"layer", "database"},
                {"screen", "Database Danh mục (" + tbl + ")"},
                {"comp_type", "db_entity"},
                {"field_name", labelPrefix + " -> " + tbl + "." + fld + " (#" + std::to_string(id) + ")"},
                {"source_file", "store_local.db:" + tbl + "." + fld},
                {"max_chars", fld == "unit" ? 20 : 80},
                {"origin", viVal},
                {"raw", tr},
                {"status", "approved"}
            });
        };

        for (const auto& c : db.query("SELECT id, name, COALESCE(i18n_json, '{}') as i18n_json FROM categories ORDER BY id ASC")) {
            pushEntity("categories", jInt(c, "id", 0), "name", jStr(c, "name", ""), jStr(c, "i18n_json", "{}"), "Nhóm món");
        }
        for (const auto& p : db.query("SELECT id, name, unit, COALESCE(i18n_json, '{}') as i18n_json FROM products ORDER BY id ASC")) {
            int64_t pid = jInt(p, "id", 0);
            pushEntity("products", pid, "name", jStr(p, "name", ""), jStr(p, "i18n_json", "{}"), "Món ăn");
            pushEntity("products", pid, "unit", jStr(p, "unit", ""), jStr(p, "i18n_json", "{}"), "Đơn vị tính");
        }
        for (const auto& t : db.query("SELECT id, name, COALESCE(i18n_json, '{}') as i18n_json FROM tables_areas ORDER BY id ASC")) {
            pushEntity("tables_areas", jInt(t, "id", 0), "name", jStr(t, "name", ""), jStr(t, "i18n_json", "{}"), "Bàn / Khu vực");
        }

        ApiHandlers::sendJson(res, {
            {"success", true},
            {"saved_rows", savedRows},
            {"db_entities", dbEntities}
        });
    });

    svr.Post("/api/i18n/save", [applyDbEntityI18n](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            ApiHandlers::sendError(res, "Chỉ Admin mới được lưu cấu hình ngôn ngữ!", userOpt ? 403 : 401);
            return;
        }
        auto& db = Database::instance();
        ensureDot6Schema(db);
        json body = BodyParser::parseBody(req);
        json items = (body.contains("rows") && body["rows"].is_array()) ? body["rows"] : json::array();
        if (items.empty() && !jStr(body, "key", "").empty()) items.push_back(body);
        if (items.empty()) {
            ApiHandlers::sendError(res, "Thiếu dữ liệu câu ngôn ngữ cần lưu!", 400);
            return;
        }
        std::string nowStr = nowTsLocal();
        int savedCnt = 0;
        db.beginTransaction();
        for (const auto& r : items) {
            std::string k = jStr(r, "key", "");
            if (k.empty()) continue;
            json rawTr = (r.contains("raw") && r["raw"].is_object()) ? r["raw"] : ((r.contains("translations") && r["translations"].is_object()) ? r["translations"] : json::object());
            std::string ori = jStr(r, "origin", jStr(rawTr, "vi", ""));
            db.execute(R"(
                INSERT INTO i18n_catalog (key, group_code, layer, screen, comp_type, field_name, source_file, max_chars, origin_vi, translations_json, status, source_modified, updated_at)
                VALUES (:k, :g, :ly, :sc, :ct, :fn, :sf, :mc, :ori, :tj, :st, :sm, :ua)
                ON CONFLICT(key) DO UPDATE SET
                    group_code = :g, layer = :ly, screen = :sc, comp_type = :ct, field_name = :fn,
                    source_file = :sf, max_chars = :mc, origin_vi = :ori, translations_json = :tj,
                    status = :st, source_modified = :sm, updated_at = :ua
            )", {
                {":k", k}, {":g", jStr(r, "group", "custom")}, {":ly", jStr(r, "layer", "frontend")},
                {":sc", jStr(r, "screen", "")}, {":ct", jStr(r, "comp_type", "api_msg")},
                {":fn", jStr(r, "field_name", k)}, {":sf", jStr(r, "source_file", "")},
                {":mc", jInt(r, "max_chars", 120)}, {":ori", ori}, {":tj", rawTr.dump()},
                {":st", jStr(r, "status", "approved")}, {":sm", jBool(r, "source_modified", false) ? 1 : 0},
                {":ua", nowStr}
            });
            applyDbEntityI18n(db, k, rawTr);
            savedCnt++;
        }
        db.commit();
        ApiHandlers::sendJson(res, {{"success", true}, {"saved_count", savedCnt}, {"message", "Đã lưu " + std::to_string(savedCnt) + " mục ngôn ngữ vào SQLite Backend!"}});
    });

    svr.Post("/api/i18n/publish", [applyDbEntityI18n](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            ApiHandlers::sendError(res, "Chỉ Admin mới được xuất bản ngôn ngữ!", userOpt ? 403 : 401);
            return;
        }
        auto& db = Database::instance();
        ensureDot6Schema(db);
        json body = BodyParser::parseBody(req);
        std::string lang = jStr(body, "lang", "en");
        if (lang.empty()) lang = "en";

        if (body.contains("rows") && body["rows"].is_array()) {
            std::string nowStr = nowTsLocal();
            db.beginTransaction();
            for (const auto& r : body["rows"]) {
                std::string k = jStr(r, "key", "");
                if (k.empty()) continue;
                json rawTr = (r.contains("raw") && r["raw"].is_object()) ? r["raw"] : json::object();
                db.execute(R"(
                    INSERT INTO i18n_catalog (key, group_code, layer, screen, comp_type, field_name, source_file, max_chars, origin_vi, translations_json, status, source_modified, updated_at)
                    VALUES (:k, :g, :ly, :sc, :ct, :fn, :sf, :mc, :ori, :tj, :st, 0, :ua)
                    ON CONFLICT(key) DO UPDATE SET translations_json = :tj, status = :st, source_modified = 0, updated_at = :ua
                )", {
                    {":k", k}, {":g", jStr(r, "group", "custom")}, {":ly", jStr(r, "layer", "frontend")},
                    {":sc", jStr(r, "screen", "")}, {":ct", jStr(r, "comp_type", "api_msg")},
                    {":fn", jStr(r, "field_name", k)}, {":sf", jStr(r, "source_file", "")},
                    {":mc", jInt(r, "max_chars", 120)}, {":ori", jStr(r, "origin", jStr(rawTr, "vi", ""))},
                    {":tj", rawTr.dump()}, {":st", jStr(r, "status", "approved")}, {":ua", nowStr}
                });
                applyDbEntityI18n(db, k, rawTr);
            }
            db.commit();
        }

        // Merge all approved i18n_catalog rows into web/locales/<lang>.json and locales/<lang>.json
        fs::path webDir = SaleApp::Config::AppConfig::instance().getWebDir();
        fs::path baseDir = SaleApp::Config::AppConfig::instance().getBaseDir();
        fs::path webLocPath = webDir / "locales" / (lang + ".json");
        fs::path rootLocPath = baseDir / "locales" / (lang + ".json");
        bool writeRootLoc = (fs::weakly_canonical(webDir.parent_path()) == fs::weakly_canonical(baseDir));

        json locObj = json::object();
        if (fs::exists(webLocPath)) {
            try {
                std::ifstream ifs(webLocPath, std::ios::binary);
                ifs >> locObj;
            } catch (...) { locObj = json::object(); }
        }
        if (!locObj.is_object()) locObj = json::object();
        if (!locObj.contains("csv_messages") || !locObj["csv_messages"].is_object()) {
            locObj["csv_messages"] = json::object();
        }

        json catRows = db.query("SELECT key, translations_json, origin_vi FROM i18n_catalog WHERE status = 'approved'");
        int appliedCnt = 0;
        for (const auto& cr : catRows) {
            std::string k = jStr(cr, "key", "");
            if (k.empty()) continue;
            json tr = json::parse(jStr(cr, "translations_json", "{}"), nullptr, false);
            std::string val = (tr.is_object() && tr.contains(lang) && tr[lang].is_string()) ? tr[lang].get<std::string>() : "";
            if (val.empty() && lang == "vi") val = jStr(cr, "origin_vi", "");
            if (val.empty()) continue;
            locObj["csv_messages"][k] = val;
            // Also nest dotted key
            json* cur = &locObj;
            size_t start = 0;
            while (true) {
                size_t dot = k.find('.', start);
                if (dot == std::string::npos) {
                    (*cur)[k.substr(start)] = val;
                    break;
                }
                std::string part = k.substr(start, dot - start);
                if (!part.empty()) {
                    if (!cur->contains(part) || !(*cur)[part].is_object()) (*cur)[part] = json::object();
                    cur = &((*cur)[part]);
                }
                start = dot + 1;
            }
            appliedCnt++;
        }

        std::string outBytes = locObj.dump(2) + "\n";
        try {
            fs::create_directories(webLocPath.parent_path());
            std::ofstream ofs1(webLocPath, std::ios::binary);
            ofs1.write(outBytes.data(), static_cast<std::streamsize>(outBytes.size()));
            ofs1.close();
        } catch (...) {}
        if (writeRootLoc) {
            try {
                fs::create_directories(rootLocPath.parent_path());
                std::ofstream ofs2(rootLocPath, std::ios::binary);
                ofs2.write(outBytes.data(), static_cast<std::streamsize>(outBytes.size()));
                ofs2.close();
            } catch (...) {}
        }

        // Update web_integrity.json SHA-256 for locales/<lang>.json so SEC-19 integrity check stays green
        fs::path intPath = webDir / "web_integrity.json";
        if (fs::exists(intPath)) {
            try {
                json intJson;
                {
                    std::ifstream mf(intPath, std::ios::binary);
                    mf >> intJson;
                }
                std::string relKey = "locales/" + lang + ".json";
                std::string newSha = AuthService::sha256(outBytes);
                if (intJson.is_object() && intJson.contains("files") && intJson["files"].is_object()) {
                    intJson["files"][relKey] = newSha;
                    intJson["count"] = intJson["files"].size();
                    intJson["generated_at"] = nowTsLocal();
                }
                std::string intOut = intJson.dump(2);
                std::ofstream mof(intPath, std::ios::binary);
                mof.write(intOut.data(), static_cast<std::streamsize>(intOut.size()));
            } catch (...) {}
        }

        ApiHandlers::sendJson(res, {
            {"success", true},
            {"lang", lang},
            {"published_keys", appliedCnt},
            {"web_integrity_updated", true},
            {"message", "Đã xuất bản trực tiếp /locales/" + lang + ".json & cập nhật SHA-256 web_integrity.json!"}
        });
    });

    // 6. HR-11 Real-Time Store Shift & Staff Live Board
    svr.Get("/api/hr/live-board", [](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt) {
            ApiHandlers::sendError(res, "Vui lòng đăng nhập để xem bảng theo dõi ca!", 401);
            return;
        }
        auto& db = Database::instance();
        ensureDot6Schema(db);
        const bool isAdmin = (userOpt->role == "admin" || userOpt->is_super_admin);
        std::string today = nowTsLocal().substr(0, 10);
        std::time_t nowT = std::time(nullptr);

        json users = isAdmin
            ? db.query("SELECT id, username, COALESCE(fullname, username) AS fullname, COALESCE(user_code, '') AS user_code, role, COALESCE(hourly_rate, 25000) AS hourly_rate FROM users WHERE status = 'active' AND role != 'customer' ORDER BY role ASC, id ASC")
            : db.query("SELECT id, username, COALESCE(fullname, username) AS fullname, COALESCE(user_code, '') AS user_code, role, COALESCE(hourly_rate, 25000) AS hourly_rate FROM users WHERE id = :uid LIMIT 1", {{":uid", userOpt->id}});

        json staffOut = json::array();
        json counts = {
            {"total", 0}, {"working", 0}, {"lost_connect", 0}, {"delivering", 0},
            {"break_temp", 0}, {"early_leave", 0}, {"overtime", 0}, {"checked_out", 0},
            {"absent_or_late", 0}, {"pending_manager_review", 0}
        };

        for (const auto& u : users) {
            int64_t uid = jInt(u, "id", 0);
            auto att = db.queryRow(
                "SELECT * FROM attendances WHERE user_id = :uid AND work_date = :wd ORDER BY id DESC LIMIT 1",
                {{":uid", uid}, {":wd", today}}
            );
            std::string liveStatus = "absent_or_late";
            std::string source = "";
            std::string checkIn = "";
            std::string checkOut = "";
            std::string lastHb = "";
            std::string delivOrder = "";
            std::string delivAt = "";
            std::string earlyReason = "";
            std::string devName = "";
            int breakMins = 0;
            int64_t attId = 0;
            double workHours = 0.0;
            int deltaMins = 0;
            bool hasWebHb = false;

            if (!att.is_null()) {
                attId = jInt(att, "id", 0);
                source = jStr(att, "source", "auto_login");
                checkIn = jStr(att, "check_in_time", "");
                checkOut = jStr(att, "check_out_time", "");
                lastHb = jStr(att, "last_heartbeat_at", "");
                delivOrder = jStr(att, "delivery_order_code", "");
                delivAt = jStr(att, "delivery_started_at", "");
                earlyReason = jStr(att, "early_leave_reason", "");
                devName = jStr(att, "device_name", "");
                breakMins = static_cast<int>(jInt(att, "break_minutes", 0));
                workHours = jDbl(att, "work_hours", 0.0);
                std::string st = jStr(att, "status", "working");
                std::string storedLive = jStr(att, "live_status", "working");

                if (st == "completed" || !checkOut.empty()) {
                    liveStatus = !earlyReason.empty() ? "early_leave" : "checked_out";
                } else {
                    liveStatus = storedLive.empty() ? "working" : storedLive;
                    bool isDeviceOrKiosk = (source == "hikvision_device" || source == "kiosk_pin");
                    std::time_t hbT = parseLocalTsDot6(lastHb);
                    std::time_t inT = parseLocalTsDot6(checkIn);
                    hasWebHb = (hbT > 0 && (!isDeviceOrKiosk || (inT > 0 && hbT > inT + 5)));
                    if (liveStatus == "working" && (!isDeviceOrKiosk || hasWebHb) && hbT > 0) {
                        int64_t ageSec = static_cast<int64_t>(nowT - hbT);
                        if (ageSec > 14400) liveStatus = "pending_manager_review";
                        else if (ageSec > 90) liveStatus = "lost_connect";
                    } else if (liveStatus == "working" && !isDeviceOrKiosk && lastHb.empty() && inT > 0) {
                        int64_t ageSec = static_cast<int64_t>(nowT - inT);
                        if (ageSec > 14400) liveStatus = "pending_manager_review";
                        else if (ageSec > 90) liveStatus = "lost_connect";
                    }
                    if (liveStatus == "working" && inT > 0 && (nowT - inT) > 8 * 3600) {
                        liveStatus = "overtime";
                    }
                }
            }

            counts["total"] = counts["total"].get<int>() + 1;
            if (counts.contains(liveStatus)) counts[liveStatus] = counts[liveStatus].get<int>() + 1;

            json timeline = db.query(
                "SELECT id, from_status, to_status, note, order_code, actor_name, created_at FROM shift_state_logs WHERE user_id = :uid AND created_at >= :wd ORDER BY id DESC LIMIT 12",
                {{":uid", uid}, {":wd", today + " 00:00:00"}}
            );

            staffOut.push_back({
                {"user_id", uid},
                {"attendance_id", attId},
                {"username", jStr(u, "username", "")},
                {"fullname", jStr(u, "fullname", "")},
                {"user_code", jStr(u, "user_code", "")},
                {"role", jStr(u, "role", "staff")},
                {"live_status", liveStatus},
                {"source", source},
                {"device_name", devName},
                {"check_in_time", checkIn},
                {"check_out_time", checkOut},
                {"last_heartbeat_at", lastHb},
                {"break_minutes", breakMins},
                {"delivery_order_code", delivOrder},
                {"delivery_started_at", delivAt},
                {"early_leave_reason", earlyReason},
                {"work_hours", workHours},
                {"delta_minutes", deltaMins},
                {"timeline", timeline}
            });
        }

        json devices = isAdmin
            ? db.query("SELECT id, name, ip_address, port, model, is_active, last_sync_at, last_poll_at, last_error FROM attendance_devices ORDER BY id ASC")
            : json::array();
        json unmatched = isAdmin
            ? db.query("SELECT id, device_id, device_name, employee_no, user_name, event_time, verify_mode, photo_path FROM attendance_raw_logs WHERE status = 'unmatched_employee' ORDER BY id DESC LIMIT 10")
            : json::array();

        ApiHandlers::sendJson(res, {
            {"success", true},
            {"today", today},
            {"is_admin", isAdmin},
            {"counts", counts},
            {"staff", staffOut},
            {"devices", devices},
            {"unmatched_logs", unmatched}
        });
    });

    svr.Post("/api/hr/shift-status", [](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt) {
            ApiHandlers::sendError(res, "Vui lòng đăng nhập để cập nhật trạng thái ca!", 401);
            return;
        }
        auto& db = Database::instance();
        ensureDot6Schema(db);
        json body = BodyParser::parseBody(req);
        const bool isAdmin = (userOpt->role == "admin" || userOpt->is_super_admin);
        int64_t targetUid = jInt(body, "user_id", userOpt->id);
        if (targetUid != userOpt->id && !isAdmin) {
            ApiHandlers::sendError(res, "Chỉ Quản lý mới được cập nhật trạng thái ca của nhân viên khác!", 403);
            return;
        }
        std::string nextStatus = jStr(body, "status", "");
        std::string note = jStr(body, "note", "");
        std::string orderCode = jStr(body, "order_code", "");
        std::string tsNow = nowTsLocal();
        std::string today = tsNow.substr(0, 10);

        if (nextStatus == "assign_unmatched") {
            if (!isAdmin) { ApiHandlers::sendError(res, "Chỉ Admin mới được gán nhân viên Hikvision!", 403); return; }
            int64_t rawId = jInt(body, "raw_log_id", 0);
            std::string empNo = jStr(body, "employee_no", "");
            if (rawId <= 0 || targetUid <= 0) { ApiHandlers::sendError(res, "Thiếu thông tin gán tài khoản!", 400); return; }
            if (!empNo.empty()) {
                db.execute("UPDATE users SET user_code = :uc WHERE id = :uid AND COALESCE(user_code, '') = ''", {{":uc", empNo}, {":uid", targetUid}});
            }
            db.execute("UPDATE attendance_raw_logs SET user_id = :uid, status = 'matched_manual' WHERE id = :rid", {{":uid", targetUid}, {":rid", rawId}});
            ApiHandlers::sendJson(res, {{"success", true}, {"message", "Đã gán lượt quẹt Hikvision vào tài khoản nhân viên!"}});
            return;
        }

        if (nextStatus == "force_checkin") {
            if (!isAdmin) { ApiHandlers::sendError(res, "Chỉ Admin mới được điểm danh hộ!", 403); return; }
            json out; std::string err; int code = 200;
            if (!processUnifiedAttendancePunch(db, targetUid, "checkin", "manager_manual", "manual", 0, "Admin Board", "", "", tsNow, note, 0, out, err, code)) {
                ApiHandlers::sendError(res, err, code);
                return;
            }
            ApiHandlers::sendJson(res, out);
            return;
        }

        auto att = db.queryRow("SELECT * FROM attendances WHERE user_id = :uid AND status = 'working' ORDER BY id DESC LIMIT 1", {{":uid", targetUid}});
        if (att.is_null()) {
            ApiHandlers::sendError(res, "Nhân viên chưa có ca làm việc đang mở!", 400);
            return;
        }
        int64_t attId = jInt(att, "id", 0);
        std::string prevLive = jStr(att, "live_status", "working");

        if (nextStatus == "early_leave" || nextStatus == "force_checkout") {
            if (nextStatus == "early_leave") {
                if (note.empty()) { ApiHandlers::sendError(res, "Vui lòng nhập lý do xin chốt ca sớm!", 400); return; }
                if (!isAdmin) {
                    std::string pin = jStr(body, "manager_pin", "");
                    json mgrOut;
                    if (pin.empty() || !verifyManagerPin(db, pin, mgrOut)) {
                        ApiHandlers::sendError(res, "Chốt ca sớm yêu cầu mã PIN Quản lý hợp lệ!", 403);
                        return;
                    }
                }
            }
            std::string inTs = jStr(att, "check_in_time", tsNow);
            std::time_t inT = parseLocalTsDot6(inTs);
            std::time_t outT = parseLocalTsDot6(tsNow);
            int brk = static_cast<int>(jInt(att, "break_minutes", 0));
            double hrs = (inT > 0 && outT > inT) ? std::max(0.0, (static_cast<double>(outT - inT) / 3600.0) - (brk / 60.0)) : 0.0;
            db.execute(
                "UPDATE attendances SET check_out_time = :co, status = 'completed', live_status = :ls, early_leave_reason = :elr, work_hours = :wh, last_heartbeat_at = :hb WHERE id = :id",
                {{":co", tsNow}, {":ls", nextStatus == "early_leave" ? "early_leave" : "checked_out"}, {":elr", nextStatus == "early_leave" ? note : ""}, {":wh", hrs}, {":hb", tsNow}, {":id", attId}}
            );
        } else if (nextStatus == "delivering") {
            db.execute(
                "UPDATE attendances SET live_status = 'delivering', delivery_order_code = :oc, delivery_started_at = :ds, last_heartbeat_at = :hb WHERE id = :id",
                {{":oc", orderCode}, {":ds", tsNow}, {":hb", tsNow}, {":id", attId}}
            );
        } else if (nextStatus == "break_temp") {
            db.execute(
                "UPDATE attendances SET live_status = 'break_temp', break_started_at = :bs, last_heartbeat_at = :hb WHERE id = :id",
                {{":bs", tsNow}, {":hb", tsNow}, {":id", attId}}
            );
        } else if (nextStatus == "working") {
            int addBrk = 0;
            std::string bs = jStr(att, "break_started_at", "");
            if (!bs.empty()) {
                std::time_t bsT = parseLocalTsDot6(bs);
                std::time_t nowT = parseLocalTsDot6(tsNow);
                if (bsT > 0 && nowT > bsT) addBrk = static_cast<int>((nowT - bsT) / 60);
            }
            db.execute(
                "UPDATE attendances SET live_status = 'working', break_minutes = COALESCE(break_minutes, 0) + :ab, break_started_at = '', delivery_started_at = '', delivery_order_code = '', last_heartbeat_at = :hb WHERE id = :id",
                {{":ab", addBrk}, {":hb", tsNow}, {":id", attId}}
            );
        } else {
            ApiHandlers::sendError(res, "Trạng thái chuyển đổi không hợp lệ!", 400);
            return;
        }

        try {
            db.execute(
                "INSERT INTO shift_state_logs (attendance_id, user_id, from_status, to_status, note, order_code, actor_name, created_at) VALUES (:aid, :uid, :fs, :ts, :nt, :oc, :an, :ca)",
                {{":aid", attId}, {":uid", targetUid}, {":fs", prevLive}, {":ts", nextStatus}, {":nt", note}, {":oc", orderCode}, {":an", userOpt->username}, {":ca", tsNow}}
            );
        } catch (...) {}

        ApiHandlers::sendJson(res, {{"success", true}, {"status", nextStatus}, {"message", "Đã cập nhật trạng thái ca làm việc!"}});
    });

    // Background Hikvision Auto-Poll every 60s (only when active devices exist)
    static std::atomic<bool> s_hikAutoPollStarted{false};
    if (!s_hikAutoPollStarted.exchange(true) && !std::getenv("CYBERNEXUS_DISABLE_BG_POLL")) {
        std::thread([]() {
            std::this_thread::sleep_for(std::chrono::seconds(20));
            while (true) {
                try {
                    auto& db = Database::instance();
                    json devs = db.query("SELECT * FROM attendance_devices WHERE is_active = 1");
                    if (!devs.empty()) {
                        std::string today = nowTsLocal().substr(0, 10);
                        std::string startIso = today + "T00:00:00+07:00";
                        std::string endIso = today + "T23:59:59+07:00";
                        for (const auto& d : devs) {
                            int64_t devId = jInt(d, "id", 0);
                            std::string ip = jStr(d, "ip_address", "");
                            if (ip.empty()) continue;
                            json evts; std::string err;
                            if (SaleApp::Hikvision::IsapiClient::pullAcsEvents(ip, static_cast<int>(jInt(d, "port", 80)), jStr(d, "username", "admin"), jStr(d, "password", ""), startIso, endIso, evts, err)) {
                                for (const auto& ev : evts) {
                                    std::string empNo = jStr(ev, "employeeNoString", jStr(ev, "employeeNo", ""));
                                    if (empNo.empty()) continue;
                                    std::string evTs = normalizeHikEventTs(jStr(ev, "time", jStr(ev, "dateTime", "")));
                                    std::string serial = std::to_string(jInt(ev, "serialNo", 0));
                                    std::string extId = "hik_" + std::to_string(devId) + "_" + empNo + "_" + (serial != "0" ? serial : evTs);
                                    std::string vMode = jStr(ev, "currentVerifyMode", "face");
                                    auto uRow = db.queryRow("SELECT id FROM users WHERE user_code = :uc OR CAST(id AS TEXT) = :uc LIMIT 1", {{":uc", empNo}});
                                    if (!uRow.is_null()) {
                                        json out; std::string pE; int pC = 200;
                                        processUnifiedAttendancePunch(db, jInt(uRow, "id", 0), "auto", "hikvision_device", vMode, devId, jStr(d, "name", "Hikvision"), "", extId, evTs, "", 600, out, pE, pC);
                                    }
                                }
                                db.execute("UPDATE attendance_devices SET last_poll_at = :lp, last_error = '' WHERE id = :id", {{":lp", nowTsLocal()}, {":id", devId}});
                            } else {
                                db.execute("UPDATE attendance_devices SET last_poll_at = :lp, last_error = :le WHERE id = :id", {{":lp", nowTsLocal()}, {":le", err}, {":id", devId}});
                            }
                        }
                    }
                } catch (...) {}
                std::this_thread::sleep_for(std::chrono::seconds(60));
            }
        }).detach();
    }

    svr.Get("/i18n_studio.html", [](const httplib::Request&, httplib::Response& res) {
        fs::path p = SaleApp::Config::AppConfig::instance().getBaseDir().parent_path() / "docs" / "16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html";
        if (!fs::exists(p)) p = SaleApp::Config::AppConfig::instance().getWebDir() / "i18n_studio.html";
        std::ifstream ifs(p, std::ios::binary);
        if (!ifs) { res.status = 404; return; }
        std::string content((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
        res.set_content(content, "text/html; charset=utf-8");
    });

    svr.Get("/i18n_studio_data.js", [](const httplib::Request&, httplib::Response& res) {
        fs::path p = SaleApp::Config::AppConfig::instance().getBaseDir().parent_path() / "docs" / "i18n_studio_data.js";
        if (!fs::exists(p)) p = SaleApp::Config::AppConfig::instance().getWebDir() / "i18n_studio_data.js";
        std::ifstream ifs(p, std::ios::binary);
        if (!ifs) { res.status = 404; return; }
        std::string content((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
        res.set_content(content, "application/javascript; charset=utf-8");
    });
}

} // namespace SaleApp::Backend
