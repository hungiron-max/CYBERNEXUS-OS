#include "handlers.hpp"
#include "slave_tunnel.h"
#include "slave_net_info.h"
#include "slave_updater.h"
#include "db.hpp"
#include "auth.hpp"
#include "body_parser.hpp"
#include "license.hpp"
#include "pos_bcrypt.h"
#include "ConfigManager.hpp"
#include "PluginManager.hpp"
#include "gemini_client.hpp"
#include <iostream>
#include <sstream>
#include <iomanip>
#include <ctime>
#include <fstream>
#include <filesystem>
#ifdef _WIN32
#include <iphlpapi.h>
#include <winhttp.h>
#pragma comment(lib, "iphlpapi.lib")
#pragma comment(lib, "winhttp.lib")
#endif

namespace SaleApp::Backend {

void ApiHandlers::sendJson(httplib::Response& res, const json& data, int statusCode) {
    res.status = statusCode;
    res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.set_header("Pragma", "no-cache");
    res.set_header("Expires", "0");
    res.set_content(data.dump(), "application/json; charset=utf-8");
}

void ApiHandlers::sendError(httplib::Response& res, const std::string& message, int statusCode) {
    json err = {
        {"success", false},
        {"message", message}
    };
    sendJson(res, err, statusCode);
}

static bool requireModule(httplib::Response& res, const std::string& modCode, const std::string& label) {
    if (LicenseService::instance().isModuleEnabled(modCode)) return true;
    ApiHandlers::sendJson(res, {
        {"success", false},
        {"locked", true},
        {"module_code", modCode},
        {"message", "Module [" + label + "] chưa được cấp phép hoặc đã bị Master tắt/khóa!"}
    }, 403);
    return false;
}

json ApiHandlers::parseBody(const httplib::Request& req) {
    return BodyParser::parseBody(req);
}

static std::string resolveGeminiApiKey(Database& db, const std::string& passedKey = "") {
    if (!passedKey.empty() && passedKey.find("•••") == std::string::npos && passedKey.find("***") == std::string::npos) {
        return passedKey;
    }
    auto row = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'gemini_api_key'");
    if (!row.is_null()) {
        return row.value("setting_value", "");
    }
    return "";
}

static bool callMasterAiProxy(const json& payload, json& respJsonOut, std::string& errOut) {
    std::string masterUrl = SaleApp::Config::AppConfig::instance().getMasterServerUrl();
    if (masterUrl.empty()) masterUrl = "http://127.0.0.1:8500";
    while (!masterUrl.empty() && masterUrl.back() == '/') masterUrl.pop_back();

    json reqJson = payload;
    json licInfo = LicenseService::instance().getLicenseStatus();
    reqJson["license_key"] = licInfo.value("license_key", "");
    reqJson["machine_id"] = LicenseService::instance().getMachineId();

    int st = 0;
    std::string rawResp;
    if (!SaleApp::AI::winHttpUrlPostJson(masterUrl + "/api/ai/proxy", reqJson.dump(), st, rawResp, errOut)) {
        errOut = "Không thể kết nối tới Master AI Proxy (" + masterUrl + "): " + errOut;
        return false;
    }
    try {
        respJsonOut = json::parse(rawResp);
    } catch (...) {
        errOut = "Phản hồi không hợp lệ từ Master AI Proxy (HTTP " + std::to_string(st) + ")";
        return false;
    }
    if (st < 200 || st >= 300 || !respJsonOut.value("success", false)) {
        errOut = respJsonOut.value("message", "Master AI Proxy từ chối yêu cầu (HTTP " + std::to_string(st) + ")");
        return false;
    }
    return true;
}

static bool fetchMasterAiQuota(json& quotaOut) {
    std::string masterUrl = SaleApp::Config::AppConfig::instance().getMasterServerUrl();
    if (masterUrl.empty()) masterUrl = "http://127.0.0.1:8500";
    while (!masterUrl.empty() && masterUrl.back() == '/') masterUrl.pop_back();
    json licInfo = LicenseService::instance().getLicenseStatus();
    std::string licKey = licInfo.value("license_key", "");
    if (licKey.empty()) return false;
    json reqJson = {
        {"license_key", licKey},
        {"machine_id", LicenseService::instance().getMachineId()}
    };
    int st = 0;
    std::string rawResp, errOut;
    if (!SaleApp::AI::winHttpUrlPostJson(masterUrl + "/api/ai/quota", reqJson.dump(), st, rawResp, errOut)) {
        return false;
    }
    try {
        json j = json::parse(rawResp);
        if (st >= 200 && st < 300 && j.value("success", false)) {
            quotaOut = j;
            return true;
        }
    } catch (...) {}
    return false;
}

static std::string getCurrentTimestamp() {
    std::time_t now = std::time(nullptr);
    char buf[64];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", std::localtime(&now));
    return std::string(buf);
}

static std::string getCurrentDate() {
    std::time_t now = std::time(nullptr);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d", std::localtime(&now));
    return std::string(buf);
}

static void ensureOrderWorkflowSchema(Database& db) {
    static bool migrated = false;
    if (migrated) return;
    migrated = true;

    auto addMissingCols = [&](const std::string& table, const std::vector<std::pair<std::string, std::string>>& cols) {
        std::vector<std::string> existing;
        try {
            json info = db.query("PRAGMA table_info(" + table + ")");
            for (const auto& c : info) {
                existing.push_back(c.value("name", ""));
            }
        } catch (...) {}
        for (const auto& kv : cols) {
            if (std::find(existing.begin(), existing.end(), kv.first) == existing.end()) {
                try { db.execute("ALTER TABLE " + table + " ADD COLUMN " + kv.first + " " + kv.second); } catch (...) {}
            }
        }
    };

    addMissingCols("orders", {
        {"order_type", "TEXT DEFAULT 'pos'"},
        {"paid_amount", "REAL DEFAULT 0"},
        {"settlement_status", "TEXT DEFAULT 'settled'"},
        {"payment_verified_by", "TEXT DEFAULT ''"},
        {"bank_ref", "TEXT DEFAULT ''"},
        {"cancel_request_reason", "TEXT DEFAULT ''"},
        {"cancel_requested_by", "TEXT DEFAULT ''"},
        {"cancel_requested_at", "TEXT DEFAULT ''"},
        {"kitchen_sent_at", "TEXT DEFAULT ''"},
        {"rush_count", "INTEGER DEFAULT 0"},
        {"last_rushed_at", "TEXT DEFAULT ''"},
        {"last_rushed_by", "TEXT DEFAULT ''"},
        {"remind_count", "INTEGER DEFAULT 0"},
        {"last_reminded_at", "TEXT DEFAULT ''"},
        {"customer_rating", "INTEGER DEFAULT 0"},
        {"customer_review_note", "TEXT DEFAULT ''"},
        {"customer_reviewed_at", "TEXT DEFAULT ''"}
    });

    addMissingCols("order_items", {
        {"cancel_status", "TEXT DEFAULT 'none'"},
        {"cancel_reason", "TEXT DEFAULT ''"},
        {"cancel_requested_by", "TEXT DEFAULT ''"},
        {"cancel_requested_at", "TEXT DEFAULT ''"},
        {"cancel_resolved_by", "TEXT DEFAULT ''"},
        {"cancel_resolved_at", "TEXT DEFAULT ''"}
    });

    db.execute(R"(
        CREATE TABLE IF NOT EXISTS payment_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            order_code TEXT DEFAULT '',
            tx_type TEXT DEFAULT 'pay',
            method TEXT DEFAULT 'cash',
            amount REAL DEFAULT 0,
            bank_ref TEXT DEFAULT '',
            verified_by TEXT DEFAULT '',
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    )");

    db.execute(R"(
        CREATE TABLE IF NOT EXISTS order_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER DEFAULT 0,
            order_code TEXT DEFAULT '',
            table_id INTEGER DEFAULT 0,
            table_code TEXT DEFAULT '',
            alert_type TEXT DEFAULT 'info',
            title TEXT DEFAULT '',
            message TEXT DEFAULT '',
            target_role TEXT DEFAULT 'all',
            is_ack INTEGER DEFAULT 0,
            ack_by TEXT DEFAULT '',
            ack_at TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    )");

    db.execute(R"(
        CREATE TABLE IF NOT EXISTS sla_time_slots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slot_type TEXT DEFAULT 'peak',
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            kitchen_sla_minutes INTEGER DEFAULT 15,
            waiter_sla_minutes INTEGER DEFAULT 5,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    )");
    try {
        auto cntSlot = db.queryScalar("SELECT COUNT(*) FROM sla_time_slots");
        if (cntSlot.is_number() && cntSlot.get<int64_t>() == 0) {
            db.execute("INSERT INTO sla_time_slots (name, slot_type, start_time, end_time, kitchen_sla_minutes, waiter_sla_minutes, is_active) VALUES ('Cao điểm Sáng', 'peak', '07:00', '09:30', 15, 5, 1)");
            db.execute("INSERT INTO sla_time_slots (name, slot_type, start_time, end_time, kitchen_sla_minutes, waiter_sla_minutes, is_active) VALUES ('Cao điểm Trưa', 'peak', '11:00', '13:30', 15, 5, 1)");
            db.execute("INSERT INTO sla_time_slots (name, slot_type, start_time, end_time, kitchen_sla_minutes, waiter_sla_minutes, is_active) VALUES ('Cao điểm Tối', 'peak', '18:00', '21:00', 15, 5, 1)");
        }
    } catch (...) {}

    db.execute(R"(
        CREATE TABLE IF NOT EXISTS kpi_sla_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            default_kitchen_sla INTEGER DEFAULT 10,
            default_waiter_sla INTEGER DEFAULT 3,
            kpi_base_score INTEGER DEFAULT 100,
            kpi_kitchen_ontime_pts INTEGER DEFAULT 2,
            kpi_kitchen_rush_penalty INTEGER DEFAULT 5,
            kpi_waiter_ontime_pts INTEGER DEFAULT 2,
            kpi_waiter_remind_penalty INTEGER DEFAULT 3,
            kpi_star_5_pts INTEGER DEFAULT 5,
            kpi_star_4_pts INTEGER DEFAULT 2,
            kpi_star_3_pts INTEGER DEFAULT 0,
            kpi_star_2_pts INTEGER DEFAULT -3,
            kpi_star_1_pts INTEGER DEFAULT -5,
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    )");
    try { db.execute("INSERT OR IGNORE INTO kpi_sla_settings (id) VALUES (1)"); } catch (...) {}

    db.execute(R"(
        CREATE TABLE IF NOT EXISTS kpi_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 0,
            user_name TEXT DEFAULT '',
            role_type TEXT DEFAULT 'waiter',
            order_id INTEGER DEFAULT 0,
            order_code TEXT DEFAULT '',
            table_code TEXT DEFAULT '',
            event_type TEXT DEFAULT '',
            points_delta INTEGER DEFAULT 0,
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    )");

    db.execute(R"(
        CREATE TABLE IF NOT EXISTS order_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER UNIQUE NOT NULL,
            order_code TEXT DEFAULT '',
            table_code TEXT DEFAULT '',
            rating INTEGER NOT NULL,
            comment TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    )");

    // Backfill paid_amount for legacy paid orders
    try {
        db.execute("UPDATE orders SET paid_amount = total_amount WHERE payment_status = 'paid' AND COALESCE(paid_amount, 0) = 0 AND total_amount > 0");
    } catch (...) {}
}

struct ActiveSlaConfig {
    int kitchenSla = 10;
    int waiterSla = 3;
    std::string label = "Thấp điểm (Mặc định)";
    bool isPeak = false;
    json settings;
};

static ActiveSlaConfig getActiveSlaConfig(Database& db) {
    ensureOrderWorkflowSchema(db);
    ActiveSlaConfig cfg;
    auto sRow = db.queryRow("SELECT * FROM kpi_sla_settings WHERE id = 1");
    if (!sRow.is_null()) {
        cfg.settings = sRow;
        cfg.kitchenSla = std::max(1, sRow.value("default_kitchen_sla", 10));
        cfg.waiterSla = std::max(1, sRow.value("default_waiter_sla", 3));
    } else {
        cfg.settings = json::object();
    }
    std::string nowTs = getCurrentTimestamp();
    std::string hhmm = (nowTs.size() >= 16) ? nowTs.substr(11, 5) : "00:00";
    try {
        auto slots = db.query("SELECT * FROM sla_time_slots WHERE is_active = 1 ORDER BY id ASC");
        for (const auto& sl : slots) {
            std::string st = sl.value("start_time", "");
            std::string en = sl.value("end_time", "");
            if (st.size() == 5 && en.size() == 5) {
                bool inRange = (st <= en) ? (hhmm >= st && hhmm <= en) : (hhmm >= st || hhmm <= en);
                if (inRange) {
                    cfg.kitchenSla = std::max(1, sl.value("kitchen_sla_minutes", cfg.kitchenSla));
                    cfg.waiterSla = std::max(1, sl.value("waiter_sla_minutes", cfg.waiterSla));
                    cfg.label = sl.value("name", "Cao điểm");
                    cfg.isPeak = (sl.value("slot_type", "peak") == "peak");
                    break;
                }
            }
        }
    } catch (...) {}
    return cfg;
}

static void recordKpiEvent(
    Database& db, int64_t userId, const std::string& userName, const std::string& roleType,
    int64_t orderId, const std::string& orderCode, const std::string& tableCode,
    const std::string& eventType, int pointsDelta, const std::string& note
) {
    try {
        db.execute(R"(
            INSERT INTO kpi_logs (user_id, user_name, role_type, order_id, order_code, table_code, event_type, points_delta, note, created_at)
            VALUES (:uid, :uname, :rtype, :oid, :ocode, :tcode, :etype, :pts, :note, :cat)
        )", {
            {":uid", userId}, {":uname", userName}, {":rtype", roleType},
            {":oid", orderId}, {":ocode", orderCode}, {":tcode", tableCode},
            {":etype", eventType}, {":pts", pointsDelta}, {":note", note},
            {":cat", getCurrentTimestamp()}
        });
    } catch (...) {}
}

static int computeElapsedMinutesSql(Database& db, int64_t orderId, const std::string& colExpr) {
    try {
        auto r = db.queryScalar(
            "SELECT MAX(0, CAST((strftime('%s', 'now', 'localtime') - strftime('%s', " + colExpr + ")) / 60 AS INTEGER)) FROM orders WHERE id = :id",
            {{":id", orderId}}
        );
        if (r.is_number()) return r.get<int>();
    } catch (...) {}
    return 0;
}

static void ensurePromotionSchema(Database& db) {
    static bool promoMigrated = false;
    if (promoMigrated) return;
    promoMigrated = true;

    db.execute(R"(
        CREATE TABLE IF NOT EXISTS promotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            promo_mode TEXT DEFAULT 'voucher',
            discount_type TEXT DEFAULT 'percent',
            discount_value REAL DEFAULT 0,
            max_discount_amount REAL DEFAULT 0,
            min_order_amount REAL DEFAULT 0,
            start_date TEXT DEFAULT '',
            end_date TEXT DEFAULT '',
            start_time TEXT DEFAULT '',
            end_time TEXT DEFAULT '',
            usage_limit INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    )");
    try { db.execute("ALTER TABLE orders ADD COLUMN promo_id INTEGER DEFAULT 0"); } catch (...) {}
    try { db.execute("ALTER TABLE orders ADD COLUMN promo_code TEXT DEFAULT ''"); } catch (...) {}
    try { db.execute("ALTER TABLE orders ADD COLUMN promo_name TEXT DEFAULT ''"); } catch (...) {}
}

static double computePromoDiscount(const json& promo, double subtotal) {
    if (subtotal <= 0) return 0.0;
    std::string dType = promo.contains("discount_type") && promo["discount_type"].is_string()
        ? promo["discount_type"].get<std::string>() : "percent";
    double dVal = promo.contains("discount_value") && promo["discount_value"].is_number()
        ? promo["discount_value"].get<double>() : 0.0;
    double maxCap = promo.contains("max_discount_amount") && promo["max_discount_amount"].is_number()
        ? promo["max_discount_amount"].get<double>() : 0.0;
    double disc = 0.0;
    if (dType == "percent") {
        disc = std::round((subtotal * std::min(100.0, std::max(0.0, dVal))) / 100.0);
        if (maxCap > 0.0 && disc > maxCap) disc = maxCap;
    } else {
        disc = std::min(subtotal, std::max(0.0, dVal));
    }
    return std::min(subtotal, std::max(0.0, disc));
}

static bool isPromoEligibleNow(Database& db, const json& promo, double subtotal, std::string& reasonOut) {
    if ((promo.contains("is_active") && promo["is_active"].is_number() ? promo["is_active"].get<int>() : 1) != 1) {
        reasonOut = "Chương trình khuyến mãi đang tạm tắt.";
        return false;
    }
    double minAmt = promo.contains("min_order_amount") && promo["min_order_amount"].is_number()
        ? promo["min_order_amount"].get<double>() : 0.0;
    if (subtotal + 0.5 < minAmt) {
        reasonOut = "Đơn chưa đạt tối thiểu " + std::to_string(static_cast<int64_t>(minAmt)) + "đ.";
        return false;
    }
    std::string nowTs = getCurrentTimestamp();
    std::string today = nowTs.substr(0, 10);
    std::string hhmm = (nowTs.size() >= 16) ? nowTs.substr(11, 5) : "00:00";

    std::string sDate = promo.contains("start_date") && promo["start_date"].is_string() ? promo["start_date"].get<std::string>() : "";
    std::string eDate = promo.contains("end_date") && promo["end_date"].is_string() ? promo["end_date"].get<std::string>() : "";
    if (!sDate.empty() && today < sDate) { reasonOut = "Chương trình chưa tới ngày bắt đầu."; return false; }
    if (!eDate.empty() && today > eDate) { reasonOut = "Chương trình đã hết hạn."; return false; }

    std::string sTime = promo.contains("start_time") && promo["start_time"].is_string() ? promo["start_time"].get<std::string>() : "";
    std::string eTime = promo.contains("end_time") && promo["end_time"].is_string() ? promo["end_time"].get<std::string>() : "";
    if (!sTime.empty() && hhmm < sTime) { reasonOut = "Chưa tới khung giờ vàng (" + sTime + " - " + eTime + ")."; return false; }
    if (!eTime.empty() && hhmm > eTime) { reasonOut = "Đã qua khung giờ vàng (" + sTime + " - " + eTime + ")."; return false; }

    int64_t limit = promo.contains("usage_limit") && promo["usage_limit"].is_number() ? promo["usage_limit"].get<int64_t>() : 0;
    if (limit > 0) {
        int64_t pid = promo.contains("id") && promo["id"].is_number() ? promo["id"].get<int64_t>() : 0;
        int64_t used = db.queryScalar("SELECT COUNT(*) FROM orders WHERE promo_id = :pid AND status != 'cancelled'", {{":pid", pid}}).get<int64_t>();
        if (used >= limit) {
            reasonOut = "Mã khuyến mãi đã hết lượt sử dụng (" + std::to_string(used) + "/" + std::to_string(limit) + ").";
            return false;
        }
    }
    return true;
}

static void createOrderAlert(Database& db, int64_t orderId, const std::string& orderCode,
                             int64_t tableId, const std::string& tableCode,
                             const std::string& alertType, const std::string& title,
                             const std::string& message, const std::string& targetRole = "all") {
    ensureOrderWorkflowSchema(db);
    db.execute(R"(
        INSERT INTO order_alerts (order_id, order_code, table_id, table_code, alert_type, title, message, target_role, created_at)
        VALUES (:oid, :oc, :tid, :tc, :at, :ttl, :msg, :tr, :cat)
    )", {
        {":oid", orderId}, {":oc", orderCode}, {":tid", tableId}, {":tc", tableCode},
        {":at", alertType}, {":ttl", title}, {":msg", message}, {":tr", targetRole},
        {":cat", getCurrentTimestamp()}
    });
}

static json recalculateOrderTotalsAndSettlement(Database& db, int64_t orderId) {
    ensureOrderWorkflowSchema(db);
    auto ord = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
    if (ord.is_null()) return json::object();

    json activeRow = db.queryRow(R"(
        SELECT COALESCE(SUM(subtotal), 0) as sub, COUNT(*) as cnt
        FROM order_items
        WHERE order_id = :oid
          AND COALESCE(cancel_status, 'none') NOT IN ('approved', 'out_of_stock')
    )", {{":oid", orderId}});

    double newSub = activeRow.value("sub", 0.0);
    int64_t activeCount = activeRow.value("cnt", int64_t(0));

    std::string dType = ord.contains("discount_type") && ord["discount_type"].is_string() ? ord["discount_type"].get<std::string>() : "amount";
    double dVal = ord.contains("discount_value") && ord["discount_value"].is_number() ? ord["discount_value"].get<double>() : 0.0;
    double vatPct = ord.contains("vat_percent") && ord["vat_percent"].is_number() ? ord["vat_percent"].get<double>() : 0.0;
    double paidAmt = ord.contains("paid_amount") && ord["paid_amount"].is_number() ? ord["paid_amount"].get<double>() : 0.0;
    std::string payStatus = ord.contains("payment_status") && ord["payment_status"].is_string() ? ord["payment_status"].get<std::string>() : "unpaid";

    double dAmt = (dType == "percent") ? (newSub * std::min(100.0, std::max(0.0, dVal)) / 100.0) : std::min(newSub, std::max(0.0, dVal));
    double afterDisc = std::max(0.0, newSub - dAmt);
    double vatAmt = afterDisc * std::max(0.0, vatPct) / 100.0;
    double newTot = afterDisc + vatAmt;

    std::string settleStatus = "settled";
    if (paidAmt > newTot + 0.5) {
        settleStatus = "refund_due";
    } else if (paidAmt > 0.5 && newTot > paidAmt + 0.5) {
        settleStatus = "extra_due";
    } else if (payStatus == "paid" && newTot > paidAmt + 0.5) {
        settleStatus = "extra_due";
    }

    db.execute(R"(
        UPDATE orders SET
            subtotal = :sub,
            discount_amount = :da,
            vat_amount = :va,
            total_amount = :tot,
            settlement_status = :ss
        WHERE id = :id
    )", {
        {":sub", newSub}, {":da", dAmt}, {":va", vatAmt}, {":tot", newTot},
        {":ss", settleStatus}, {":id", orderId}
    });

    return {
        {"subtotal", newSub},
        {"total_amount", newTot},
        {"paid_amount", paidAmt},
        {"settlement_status", settleStatus},
        {"delta_amount", newTot - paidAmt},
        {"active_items", activeCount}
    };
}

struct ShiftCfg {
    std::string s1Name = "Ca 1 (Ca Sáng)";
    std::string s1Start = "06:30";
    std::string s1End = "12:30";
    std::string s2Name = "Ca 2 (Ca Chiều / Tối)";
    std::string s2Start = "12:30";
    std::string s2End = "22:30";
    int graceMinutes = 15;
    bool autoClose = true;
};

static int parseHHMMToMinutes(const std::string& hhmm, int fallbackMin) {
    int h = 0, m = 0;
    if (std::sscanf(hhmm.c_str(), "%d:%d", &h, &m) >= 2) {
        return std::max(0, std::min(1439, h * 60 + m));
    }
    return fallbackMin;
}

static std::time_t parseTimestampLocal(const std::string& ts) {
    if (ts.size() < 16) return 0;
    std::tm tmVal{};
    int sec = 0;
    int parsed = std::sscanf(ts.c_str(), "%d-%d-%d %d:%d:%d",
                             &tmVal.tm_year, &tmVal.tm_mon, &tmVal.tm_mday,
                             &tmVal.tm_hour, &tmVal.tm_min, &sec);
    if (parsed < 5) return 0;
    tmVal.tm_year -= 1900;
    tmVal.tm_mon -= 1;
    tmVal.tm_sec = (parsed >= 6) ? sec : 0;
    tmVal.tm_isdst = -1;
    return std::mktime(&tmVal);
}

static double calcHoursBetween(const std::string& startTs, const std::string& endTs) {
    std::time_t t1 = parseTimestampLocal(startTs);
    std::time_t t2 = parseTimestampLocal(endTs);
    if (t1 <= 0 || t2 <= 0 || t2 <= t1) return 0.0;
    double hrs = static_cast<double>(t2 - t1) / 3600.0;
    return std::round(hrs * 100.0) / 100.0;
}

static std::string formatElapsedHMS(const std::string& startTs, const std::string& nowTs) {
    std::time_t t1 = parseTimestampLocal(startTs);
    std::time_t t2 = parseTimestampLocal(nowTs);
    int64_t diff = (t1 > 0 && t2 > t1) ? static_cast<int64_t>(t2 - t1) : 0;
    int64_t h = diff / 3600;
    int64_t m = (diff % 3600) / 60;
    char buf[32];
    std::snprintf(buf, sizeof(buf), "%02lldh %02lldm", static_cast<long long>(h), static_cast<long long>(m));
    return std::string(buf);
}

static ShiftCfg loadShiftCfg(Database& db) {
    ShiftCfg cfg;
    json rows = db.query("SELECT setting_key, setting_value FROM store_settings WHERE setting_key LIKE 'shift%'");
    for (const auto& r : rows) {
        std::string k = r.value("setting_key", "");
        std::string v = r.value("setting_value", "");
        if (v.empty()) continue;
        if (k == "shift1_name") cfg.s1Name = v;
        else if (k == "shift1_start") cfg.s1Start = v;
        else if (k == "shift1_end") cfg.s1End = v;
        else if (k == "shift2_name") cfg.s2Name = v;
        else if (k == "shift2_start") cfg.s2Start = v;
        else if (k == "shift2_end") cfg.s2End = v;
        else if (k == "shift_grace_minutes") { try { cfg.graceMinutes = std::max(0, std::stoi(v)); } catch (...) {} }
        else if (k == "shift_autoclose_enabled") cfg.autoClose = (v == "1" || v == "true");
    }
    return cfg;
}

static std::string shortDeviceLabel(const std::string& ua) {
    if (ua.empty()) return "POS / Web";
    if (ua.find("iPhone") != std::string::npos || ua.find("iPad") != std::string::npos) return "iPhone / iPad";
    if (ua.find("Android") != std::string::npos) return "Android Mobile";
    if (ua.find("Windows") != std::string::npos) return "Windows PC";
    if (ua.find("Macintosh") != std::string::npos) return "MacOS";
    return ua.substr(0, std::min<size_t>(40, ua.size()));
}

static void closeStaffAttendance(Database& db, int64_t attId, const std::string& checkOutTs, const std::string& note) {
    auto row = db.queryRow("SELECT check_in_time, hourly_rate FROM attendances WHERE id = :id", {{":id", attId}});
    if (row.is_null()) return;
    std::string inTs = row.value("check_in_time", "");
    double rate = 25000.0;
    try { if (row.contains("hourly_rate") && row["hourly_rate"].is_number()) rate = row["hourly_rate"].get<double>(); } catch (...) {}
    double hrs = calcHoursBetween(inTs, checkOutTs);
    double pay = std::round(hrs * rate);
    db.execute(R"(
        UPDATE attendances
        SET check_out_time = :out, work_hours = :hrs, total_pay = :pay, status = 'completed',
            note = CASE WHEN :note != '' THEN :note ELSE note END
        WHERE id = :id
    )", {
        {":out", checkOutTs}, {":hrs", hrs}, {":pay", pay}, {":note", note}, {":id", attId}
    });
}

static void ensureStaffCheckIn(Database& db, int64_t userId, const std::string& userAgent) {
    if (userId <= 0) return;
    auto u = db.queryRow("SELECT id, username, fullname, user_code, role, COALESCE(hourly_rate, 25000) as hourly_rate FROM users WHERE id = :id", {{":id", userId}});
    if (u.is_null()) return;
    std::string role = u.value("role", "cashier");
    if (role == "customer") return;

    std::string today = getCurrentDate();
    std::string nowTs = getCurrentTimestamp();
    std::string dev = shortDeviceLabel(userAgent);

    db.execute("UPDATE users SET is_online = 1, last_active_at = :now WHERE id = :id", {{":now", nowTs}, {":id", userId}});

    auto openRow = db.queryRow("SELECT id FROM attendances WHERE user_id = :uid AND work_date = :wd AND status = 'working' ORDER BY id DESC LIMIT 1", {{":uid", userId}, {":wd", today}});
    if (!openRow.is_null()) {
        if (!userAgent.empty()) {
            db.execute("UPDATE attendances SET device_info = :dev WHERE id = :id", {{":dev", dev}, {":id", openRow["id"]}});
        }
        return;
    }

    std::string fullname = u.value("fullname", u.value("username", "Nhân viên"));
    std::string userCode = u.value("user_code", "");
    double rate = 25000.0;
    try { if (u.contains("hourly_rate") && u["hourly_rate"].is_number()) rate = u["hourly_rate"].get<double>(); } catch (...) {}

    db.execute(R"(
        INSERT INTO attendances (user_id, user_name, user_code, user_role, work_date, check_in_time, hourly_rate, status, device_info, note)
        VALUES (:uid, :uname, :ucode, :urole, :wd, :cin, :rate, 'working', :dev, 'Tự động check-in khi đăng nhập')
    )", {
        {":uid", userId}, {":uname", fullname}, {":ucode", userCode}, {":urole", role},
        {":wd", today}, {":cin", nowTs}, {":rate", rate}, {":dev", dev}
    });
}

static void autoProcessShifts(Database& db) {
    ShiftCfg cfg = loadShiftCfg(db);
    std::string today = getCurrentDate();
    std::string nowTs = getCurrentTimestamp();
    std::time_t nowT = std::time(nullptr);
    std::tm* nowTm = std::localtime(&nowT);
    int nowMin = nowTm ? (nowTm->tm_hour * 60 + nowTm->tm_min) : 0;
    int s1EndMin = parseHHMMToMinutes(cfg.s1End, 12 * 60 + 30);
    int s2EndMin = parseHHMMToMinutes(cfg.s2End, 22 * 60 + 30);

    json openRows = db.query(R"(
        SELECT a.id, a.user_id, a.user_name, a.user_code, a.user_role, a.work_date, a.check_in_time,
               a.hourly_rate, a.device_info, COALESCE(u.last_active_at, '') as last_active_at
        FROM attendances a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.status = 'working'
    )");

    for (const auto& r : openRows) {
        int64_t attId = r.value("id", static_cast<int64_t>(0));
        int64_t uid = r.value("user_id", static_cast<int64_t>(0));
        std::string wd = r.value("work_date", "");
        std::string cin = r.value("check_in_time", "");
        std::string lastAct = r.value("last_active_at", "");

        if (wd < today) {
            closeStaffAttendance(db, attId, wd + " " + cfg.s2End + ":00", "Tự động chốt ca qua ngày");
            continue;
        }
        if (!cfg.autoClose || wd != today) continue;

        std::string cinHHMM = (cin.size() >= 16) ? cin.substr(11, 5) : "00:00";
        int inMin = parseHHMMToMinutes(cinHHMM, 0);

        // If checked in during Ca 1 and past Ca 1 end + grace
        if (inMin < s1EndMin && nowMin > s1EndMin + cfg.graceMinutes) {
            std::string s1CloseTs = today + " " + cfg.s1End + ":00";
            std::time_t actT = parseTimestampLocal(lastAct);
            bool stillActive = (actT > 0 && (nowT - actT) <= 20 * 60);
            closeStaffAttendance(db, attId, s1CloseTs, stillActive ? "Tự động tách ca hết Ca 1" : "Tự động chốt hết Ca 1");

            if (stillActive && nowMin <= s2EndMin + cfg.graceMinutes) {
                double rate = 25000.0;
                try { if (r.contains("hourly_rate") && r["hourly_rate"].is_number()) rate = r["hourly_rate"].get<double>(); } catch (...) {}
                db.execute(R"(
                    INSERT INTO attendances (user_id, user_name, user_code, user_role, work_date, check_in_time, hourly_rate, status, device_info, note)
                    VALUES (:uid, :uname, :ucode, :urole, :wd, :cin, :rate, 'working', :dev, 'Tự động tách sang Ca 2')
                )", {
                    {":uid", uid},
                    {":uname", r.value("user_name", "")},
                    {":ucode", r.value("user_code", "")},
                    {":urole", r.value("user_role", "cashier")},
                    {":wd", today},
                    {":cin", s1CloseTs},
                    {":rate", rate},
                    {":dev", r.value("device_info", "POS / Web")}
                });
            }
        } else if (nowMin > s2EndMin + cfg.graceMinutes) {
            closeStaffAttendance(db, attId, today + " " + cfg.s2End + ":00", "Tự động chốt hết Ca 2");
        }
    }
}

static std::string getAction(const httplib::Request& req, const json& body) {
    return BodyParser::getAction(req, body);
}

static double getDouble(const json& j, const std::string& key, double def = 0.0) {
    if (!j.is_object() || !j.contains(key) || j[key].is_null()) return def;
    const auto& v = j[key];
    if (v.is_number()) return v.get<double>();
    if (v.is_string()) {
        try { return std::stod(v.get<std::string>()); } catch (...) {}
    }
    return def;
}

static int64_t getInt(const json& j, const std::string& key, int64_t def = 0) {
    if (!j.is_object() || !j.contains(key) || j[key].is_null()) return def;
    const auto& v = j[key];
    if (v.is_number()) return v.get<int64_t>();
    if (v.is_string()) {
        try { return std::stoll(v.get<std::string>()); } catch (...) {}
    }
    return def;
}

static std::string getString(const json& j, const std::string& key, const std::string& def = "") {
    if (!j.is_object() || !j.contains(key) || j[key].is_null()) return def;
    const auto& v = j[key];
    if (v.is_string()) return v.get<std::string>();
    if (v.is_number_integer()) return std::to_string(v.get<int64_t>());
    if (v.is_number_float()) return std::to_string(v.get<double>());
    if (v.is_boolean()) return v.get<bool>() ? "1" : "0";
    return def;
}

// Lấy thông tin cấu hình quán từ bảng store_settings (hỗ trợ in hóa đơn & VietQR)
static json getStoreInfo(Database& db) {
    auto getVal = [&](const std::string& key, const std::string& def) -> std::string {
        auto r = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = :k LIMIT 1", {{":k", key}});
        if (r.is_null()) return def;
        return r.value("setting_value", def);
    };

    return {
        {"name", getVal("store_name", "GÓC PHỐ COFFEE & TEA")},
        {"hotline", getVal("store_hotline", "0932.885.131")},
        {"address", getVal("store_address", "123 Đường Số 5, P. Linh Trung, TP. Thủ Đức, TP.HCM")},
        {"wifi", getVal("store_wifi", "GocPho_Guest / pass: 88888888")},
        {"header_note", getVal("print_header_note", "Hân hạnh được phục vụ Quý khách!")},
        {"footer_note", getVal("print_footer_note", "Pass Wifi: 88888888 - Hẹn gặp lại quý khách!")},
        {"bank_id", getVal("bank_id", "OCB")},
        {"bank_account_no", getVal("bank_account_no", "0918608073")},
        {"bank_account_name", getVal("bank_account_name", "NGUYEN CHI HUNG")}
    };
}

// Đồng bộ trạng thái 3 yếu tố của hóa đơn: Bếp xong + Bưng ra + Thanh toán -> Hoàn thành & Dọn bàn
static void syncOrderStatus(Database& db, int64_t orderId) {
    if (orderId <= 0) return;
    auto order = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
    if (order.is_null()) return;

    std::string status = order.value("status", "pending");
    if (status == "cancelled") return;

    std::string payStatus = order.value("payment_status", "unpaid");
    bool isPaid = (payStatus == "paid" || (!order["paid_at"].is_null() && !order["paid_at"].get<std::string>().empty()));
    std::string kStatus = order.value("kitchen_status", "pending");
    bool isCooked = (kStatus == "ready" || kStatus == "served" || (!order["kitchen_ready_at"].is_null() && !order["kitchen_ready_at"].get<std::string>().empty()));
    bool isServed = (kStatus == "served" || (!order["served_at"].is_null() && !order["served_at"].get<std::string>().empty()));

    if (isCooked && isServed && isPaid) {
        db.execute(R"(
            UPDATE orders 
            SET status = 'completed', completed_at = COALESCE(completed_at, datetime('now'))
            WHERE id = :id
        )", {{":id", orderId}});

        // Release table
        if (!order["table_id"].is_null()) {
            int64_t tableId = order["table_id"].get<int64_t>();
            db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :tid AND active_order_id = :oid",
                       {{":tid", tableId}, {":oid", orderId}});
        }
    } else {
        db.execute("UPDATE orders SET status = 'pending', completed_at = NULL WHERE id = :id", {{":id", orderId}});
        if (!order["table_id"].is_null()) {
            int64_t tableId = order["table_id"].get<int64_t>();
            db.execute("UPDATE tables_areas SET status = 'occupied', active_order_id = :oid WHERE id = :tid",
                       {{":oid", orderId}, {":tid", tableId}});
        }
    }
}

// ==========================================
// 1. AUTH HANDLER (GIAI ĐOẠN 1 HOÀN CHỈNH)
// ==========================================
struct PendingQrLogin {
    std::string token;
    std::chrono::system_clock::time_point createdAt;
    bool approved = false;
    SessionUser user;
};
static std::mutex s_qrLoginMutex;
static std::unordered_map<std::string, PendingQrLogin> s_pendingQrLogins;

void ApiHandlers::handleAuth(const httplib::Request& req, httplib::Response& res) {
    json body = parseBody(req);
    std::string action = getAction(req, body);
    auto& auth = AuthService::instance();
    auto& db = Database::instance();

    // 1.1 Action: check (hoặc mặc định GET không truyền action)
    if (action.empty() || action == "check") {
        auto userOpt = auth.authenticate(req);

        // Đọc cấu hình thông tin quán
        auto storeRow = db.queryRow("SELECT * FROM store_settings WHERE id = 1 LIMIT 1");
        std::string storeName = storeRow.is_null() ? "Góc Phố Coffee & Tea" : storeRow.value("store_name", "Góc Phố Coffee & Tea");
        std::string hotline = storeRow.is_null() ? "0903100001" : storeRow.value("hotline", "");
        std::string address = storeRow.is_null() ? "" : storeRow.value("address", "");

        json systemObj = {
            {"app_name", "SaleApp POS C++ Edition"},
            {"version", "v2.5-cpp-native"},
            {"db_driver", "sqlite-native"},
            {"store_name", storeName},
            {"hotline", hotline},
            {"address", address}
        };

        if (userOpt.has_value()) {
            const auto& u = userOpt.value();
            json resp = {
                {"success", true},
                {"authenticated", true},
                {"user", {
                    {"id", u.id},
                    {"user_code", u.user_code},
                    {"username", u.username},
                    {"fullname", u.fullname},
                    {"role", u.role},
                    {"is_super_admin", u.is_super_admin}
                }},
                {"system", systemObj}
            };
            sendJson(res, resp);
        } else {
            json resp = {
                {"success", true},
                {"authenticated", false},
                {"system", systemObj}
            };
            sendJson(res, resp);
        }
        return;
    }

    // 1.2 Action: login (bằng username hoặc user_code + mật khẩu Bcrypt)
    if (action == "login") {
        std::string username = BodyParser::getParam(req, body, "username");
        if (username.empty()) username = BodyParser::getParam(req, body, "user_code");
        std::string password = BodyParser::getParam(req, body, "password");

        if (username.empty() || password.empty()) {
            sendJson(res, {{"success", false}, {"message", "Vui lòng nhập tên đăng nhập và mật khẩu!"}}, 400);
            return;
        }

        auto result = auth.login(username, password);
        if (result.value("success", false)) {
            if (result.contains("user") && result["user"].contains("id")) {
                ensureStaffCheckIn(db, result["user"]["id"].get<int64_t>(), req.get_header_value("User-Agent"));
            }
            std::string token = result.value("token", "");
            res.set_header("Set-Cookie", AuthService::formatCookie("pos_token", token));
            res.set_header("Set-Cookie", AuthService::formatCookie("PHPSESSID", token));
            sendJson(res, result);
        } else {
            sendJson(res, result, 401);
        }
        return;
    }

    // 1.3 Action: pin_login (hoặc login_pin cho thu ngân / nhân viên phục vụ)
    if (action == "pin_login" || action == "login_pin") {
        std::string pin = BodyParser::getParam(req, body, "pin_code");
        if (pin.empty()) pin = BodyParser::getParam(req, body, "pin");

        if (pin.empty()) {
            sendJson(res, {{"success", false}, {"message", "Vui lòng nhập mã PIN 4 số!"}}, 400);
            return;
        }

        auto result = auth.loginPin(pin);
        if (result.value("success", false)) {
            if (result.contains("user") && result["user"].contains("id")) {
                ensureStaffCheckIn(db, result["user"]["id"].get<int64_t>(), req.get_header_value("User-Agent"));
            }
            std::string token = result.value("token", "");
            res.set_header("Set-Cookie", AuthService::formatCookie("pos_token", token));
            res.set_header("Set-Cookie", AuthService::formatCookie("PHPSESSID", token));
            sendJson(res, result);
        } else {
            sendJson(res, result, 401);
        }
        return;
    }

    // 1.4 Action: heartbeat (duy trì trạng thái online & tính giờ làm việc)
    if (action == "heartbeat") {
        auto userOpt = auth.authenticate(req);
        if (!userOpt.has_value()) {
            sendJson(res, {{"success", false}, {"authenticated", false}, {"message", "Chưa đăng nhập hoặc phiên đã hết hạn!"}}, 401);
            return;
        }

        std::string token = auth.extractToken(req);
        auth.touchSession(token);
        ensureStaffCheckIn(db, userOpt->id, req.get_header_value("User-Agent"));
        autoProcessShifts(db);

        sendJson(res, {
            {"success", true},
            {"online", true},
            {"timestamp", getCurrentTimestamp()},
            {"user_id", userOpt->id}
        });
        return;
    }

    // 1.5 Action: logout (hủy phiên & xóa cookie + chốt checkout ca đang mở)
    if (action == "logout") {
        auto userOpt = auth.authenticate(req);
        if (userOpt.has_value()) {
            std::string nowTs = getCurrentTimestamp();
            json openRows = db.query("SELECT id FROM attendances WHERE user_id = :uid AND status = 'working'", {{":uid", userOpt->id}});
            for (const auto& r : openRows) {
                closeStaffAttendance(db, r.value("id", static_cast<int64_t>(0)), nowTs, "Check-out khi đăng xuất");
            }
            db.execute("UPDATE users SET is_online = 0 WHERE id = :id", {{":id", userOpt->id}});
        }
        std::string token = auth.extractToken(req);
        auth.destroySession(token);

        res.set_header("Set-Cookie", AuthService::formatClearCookie("pos_token"));
        res.set_header("Set-Cookie", AuthService::formatClearCookie("PHPSESSID"));
        res.set_header("Set-Cookie", AuthService::formatClearCookie("pos_remember"));

        sendJson(res, {{"success", true}, {"message", "Đã đăng xuất thành công!"}});
        return;
    }

    // 1.6 Action: create_owner_qr (Khởi tạo mã QR đăng nhập cho Chủ Quán)
    if (action == "create_owner_qr") {
        auto now = std::chrono::system_clock::now();
        int64_t ts = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
        std::string raw = std::to_string(ts) + "-" + std::to_string(std::rand());
        std::string qrToken = "OWNER-QR-" + AuthService::sha256(raw).substr(0, 16);

        {
            std::lock_guard<std::mutex> lock(s_qrLoginMutex);
            // Dọn dẹp token quá hạn (> 3 phút)
            for (auto it = s_pendingQrLogins.begin(); it != s_pendingQrLogins.end(); ) {
                auto diff = std::chrono::duration_cast<std::chrono::seconds>(now - it->second.createdAt).count();
                if (diff > 180) it = s_pendingQrLogins.erase(it);
                else ++it;
            }
            s_pendingQrLogins[qrToken] = {qrToken, now, false, {}};
        }

        sendJson(res, {
            {"success", true},
            {"qr_token", qrToken},
            {"expires_in", 120},
            {"message", "Đã tạo mã QR đăng nhập Chủ Quán"}
        });
        return;
    }

    // 1.7 Action: check_owner_qr (Kiểm tra xem Chủ Quán đã duyệt trên App/Điện thoại chưa)
    if (action == "check_owner_qr") {
        std::string qrToken = BodyParser::getParam(req, body, "qr_token");
        if (qrToken.empty()) {
            sendError(res, "Thiếu tham số qr_token", 400);
            return;
        }

        std::lock_guard<std::mutex> lock(s_qrLoginMutex);
        auto it = s_pendingQrLogins.find(qrToken);
        if (it == s_pendingQrLogins.end()) {
            sendJson(res, {{"success", false}, {"expired", true}, {"message", "Mã QR không tồn tại hoặc đã hết hạn"}}, 404);
            return;
        }

        auto now = std::chrono::system_clock::now();
        auto diff = std::chrono::duration_cast<std::chrono::seconds>(now - it->second.createdAt).count();
        if (diff > 120) {
            s_pendingQrLogins.erase(it);
            sendJson(res, {{"success", false}, {"expired", true}, {"message", "Mã QR đã hết hạn, vui lòng lấy mã mới"}}, 410);
            return;
        }

        if (it->second.approved) {
            // Đã được duyệt thành công bởi Chủ Quán
            SessionUser u = it->second.user;
            s_pendingQrLogins.erase(it);

            std::string sessionToken = auth.createSession(u);
            res.set_header("Set-Cookie", AuthService::formatCookie("pos_token", sessionToken));
            res.set_header("Set-Cookie", AuthService::formatCookie("PHPSESSID", sessionToken));

            sendJson(res, {
                {"success", true},
                {"approved", true},
                {"token", sessionToken},
                {"user", {
                    {"id", u.id},
                    {"username", u.username},
                    {"fullname", u.fullname},
                    {"role", u.role},
                    {"is_super_admin", u.is_super_admin}
                }},
                {"message", "Xác thực Chủ Quán thành công!"}
            });
            return;
        }

        sendJson(res, {
            {"success", true},
            {"approved", false},
            {"remaining_seconds", 120 - diff},
            {"message", "Đang chờ Chủ Quán phê duyệt từ App"}
        });
        return;
    }

    // 1.8 Action: approve_owner_qr (Chủ Quán bấm phê duyệt trên App / Điện thoại hoặc nhập PIN bảo mật)
    if (action == "approve_owner_qr") {
        std::string qrToken = BodyParser::getParam(req, body, "qr_token");
        std::string pin = BodyParser::getParam(req, body, "pin");

        // Xác thực Chủ Quán: hoặc qua Session hiện tại (đã login trên App/Mobile), hoặc qua PIN 9999
        bool isAuthorized = false;
        SessionUser approvedUser;

        auto callerOpt = auth.authenticate(req);
        if (callerOpt.has_value() && (callerOpt->role == "admin" || callerOpt->is_super_admin)) {
            isAuthorized = true;
            approvedUser = *callerOpt;
        } else if (pin == "9999") {
            auto ownerRow = db.queryRow("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
            if (!ownerRow.is_null()) {
                approvedUser.id = ownerRow.value("id", 1);
                approvedUser.username = ownerRow.value("username", "admin");
                approvedUser.fullname = ownerRow.value("fullname", "Chủ Quán");
                approvedUser.role = "admin";
                approvedUser.is_super_admin = true;
                isAuthorized = true;
            } else {
                approvedUser.id = 1;
                approvedUser.username = "admin";
                approvedUser.fullname = "Chủ Quán";
                approvedUser.role = "admin";
                approvedUser.is_super_admin = true;
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            sendError(res, "Chỉ Chủ Quán (Mã PIN 9999 hoặc App Quản Trị) mới có quyền duyệt!", 403);
            return;
        }

        std::lock_guard<std::mutex> lock(s_qrLoginMutex);
        auto it = s_pendingQrLogins.find(qrToken);
        if (it == s_pendingQrLogins.end()) {
            sendError(res, "Mã QR đã hết hạn hoặc không tồn tại", 404);
            return;
        }

        it->second.approved = true;
        it->second.user = approvedUser;

        sendJson(res, {
            {"success", true},
            {"message", "Đã phê duyệt đăng nhập Chủ Quán thành công!"}
        });
        return;
    }

    sendError(res, "Hành động (Action) không hợp lệ: " + action, 400);
}

// ==========================================
// 2. CATEGORIES HANDLER (GIAI ĐOẠN 2 - BƯỚC 2.1)
// ==========================================
void ApiHandlers::handleCategories(const httplib::Request& req, httplib::Response& res) {
    auto& db = Database::instance();
    json body = parseBody(req);
    std::string action = getAction(req, body);

    // 1. GET: List all categories with product_count
    if (req.method == "GET" && action.empty()) {
        std::string sql = R"(
            SELECT c.*, COUNT(p.id) as product_count 
            FROM categories c 
            LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
            WHERE c.status = 'active'
            GROUP BY c.id 
            ORDER BY c.sort_order ASC, c.id ASC
        )";
        json list = db.query(sql);
        sendJson(res, {{"success", true}, {"data", list}});
        return;
    }

    // Check auth for write actions (Admin required)
    auto userOpt = AuthService::instance().authenticate(req);
    if (!userOpt.has_value() || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
        sendJson(res, {{"success", false}, {"message", "Bạn không có quyền thực hiện thao tác này (yêu cầu Admin)!"}}, 403);
        return;
    }

    // 2. POST: Add Category
    if (action.empty() || action == "add") {
        std::string name = BodyParser::getParam(req, body, "name");
        std::string icon = BodyParser::getParam(req, body, "icon", "coffee");
        int sortOrder = 0;
        try {
            std::string soStr = BodyParser::getParam(req, body, "sort_order", "0");
            sortOrder = std::stoi(soStr);
        } catch (...) {}

        if (name.empty()) {
            sendJson(res, {{"success", false}, {"message", "Tên nhóm hàng không được để trống!"}}, 400);
            return;
        }

        int64_t id = db.execute(
            "INSERT INTO categories (name, icon, sort_order, status) VALUES (:name, :icon, :sort_order, 'active')",
            {{":name", name}, {":icon", icon}, {":sort_order", sortOrder}}
        );

        sendJson(res, {{"success", true}, {"message", "Thêm nhóm hàng thành công!"}, {"id", id}});
        return;
    }

    // 3. POST / PUT: Update Category
    if (action == "update") {
        int64_t id = 0;
        try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        std::string name = BodyParser::getParam(req, body, "name");
        std::string icon = BodyParser::getParam(req, body, "icon", "coffee");
        int sortOrder = 0;
        try { sortOrder = std::stoi(BodyParser::getParam(req, body, "sort_order", "0")); } catch (...) {}

        if (id <= 0 || name.empty()) {
            sendJson(res, {{"success", false}, {"message", "Dữ liệu cập nhật nhóm hàng không hợp lệ!"}}, 400);
            return;
        }

        db.execute(
            "UPDATE categories SET name = :name, icon = :icon, sort_order = :sort_order WHERE id = :id",
            {{":name", name}, {":icon", icon}, {":sort_order", sortOrder}, {":id", id}}
        );

        sendJson(res, {{"success", true}, {"message", "Cập nhật nhóm hàng thành công!"}});
        return;
    }

    // 4. POST / DELETE: Delete Category
    if (action == "delete") {
        int64_t id = 0;
        try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        if (id <= 0) {
            sendJson(res, {{"success", false}, {"message", "Mã nhóm hàng không hợp lệ!"}}, 400);
            return;
        }

        // Check if there are active products
        auto checkVal = db.queryScalar(
            "SELECT COUNT(*) FROM products WHERE category_id = :id AND status = 'active'",
            {{":id", id}}
        );
        int64_t activeCount = checkVal.is_number() ? checkVal.get<int64_t>() : 0;
        if (activeCount > 0) {
            sendJson(res, {{"success", false}, {"message", "Không thể xóa nhóm hàng đang có món ăn/sản phẩm!"}}, 400);
            return;
        }

        db.execute("DELETE FROM categories WHERE id = :id", {{":id", id}});
        sendJson(res, {{"success", true}, {"message", "Đã xóa nhóm hàng!"}});
        return;
    }

    sendJson(res, {{"success", false}, {"message", "Yêu cầu không hợp lệ!"}}, 400);
}

// ==========================================
// 3. PRODUCTS HANDLER (GIAI ĐOẠN 2 - BƯỚC 2.2 & 2.3)
// ==========================================
void ApiHandlers::handleProducts(const httplib::Request& req, httplib::Response& res) {
    auto& db = Database::instance();
    json body = parseBody(req);
    std::string action = getAction(req, body);

    // 1. GET: Fetch Products with filters (Bước 2.2)
    if (req.method == "GET" && action.empty()) {
        std::string sql = R"(
            SELECT p.*, c.name as category_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE 1=1
        )";
        std::vector<std::pair<std::string, json>> params;

        if (BodyParser::hasParam(req, body, "category_id")) {
            try {
                int catId = std::stoi(BodyParser::getParam(req, body, "category_id"));
                if (catId > 0) {
                    sql += " AND p.category_id = :category_id";
                    params.push_back({":category_id", catId});
                }
            } catch (...) {}
        }

        std::string search = BodyParser::getParam(req, body, "q");
        if (search.empty()) search = BodyParser::getParam(req, body, "search");
        if (!search.empty()) {
            sql += " AND (p.name LIKE :search OR p.code LIKE :search)";
            params.push_back({":search", "%" + search + "%"});
        }

        if (BodyParser::hasParam(req, body, "is_topping")) {
            try {
                int isTop = std::stoi(BodyParser::getParam(req, body, "is_topping"));
                sql += " AND p.is_topping = :is_topping";
                params.push_back({":is_topping", isTop});
            } catch (...) {}
        }

        std::string status = BodyParser::getParam(req, body, "status");
        if (!status.empty()) {
            sql += " AND p.status = :status";
            params.push_back({":status", status});
        }

        sql += " ORDER BY p.id ASC";

        json products = db.query(sql, params);

        // Security: Giấu cost_price nếu người gọi không phải Admin
        auto userOpt = AuthService::instance().authenticate(req);
        bool isAdmin = userOpt.has_value() && (userOpt->role == "admin" || userOpt->is_super_admin);
        if (!isAdmin) {
            for (auto& item : products) {
                if (item.contains("cost_price")) {
                    item.erase("cost_price");
                }
            }
        }

        sendJson(res, {{"success", true}, {"data", products}});
        return;
    }

    // Step 2.3: Toggle Status (active <-> locked) - Cho phép Admin, Bếp và Thu ngân
    if (action == "toggle_status" || action == "toggle_lock") {
        auto userOpt = AuthService::instance().authenticate(req);
        std::string uName = userOpt.has_value() ? userOpt->fullname : "Nhân viên";
        std::string uRole = userOpt.has_value() ? userOpt->role : "kitchen";
        int64_t uId = userOpt.has_value() ? userOpt->id : 1;

        int64_t id = 0;
        try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        if (id <= 0) {
            sendJson(res, {{"success", false}, {"message", "Mã mặt hàng không hợp lệ!"}}, 400);
            return;
        }

        auto prodRow = db.queryRow("SELECT * FROM products WHERE id = :id", {{":id", id}});
        if (prodRow.is_null()) {
            sendJson(res, {{"success", false}, {"message", "Mặt hàng không tồn tại!"}}, 404);
            return;
        }

        std::string prodName = prodRow.value("name", "");
        std::string prodCode = prodRow.value("code", "");
        std::string curStatus = prodRow.value("status", "active");

        std::string forceStatus = BodyParser::getParam(req, body, "status");
        std::string newStatus;
        if (forceStatus == "active" || forceStatus == "locked") {
            newStatus = forceStatus;
        } else {
            newStatus = (curStatus == "active") ? "locked" : "active";
        }

        db.execute("UPDATE products SET status = :st WHERE id = :id", {{":st", newStatus}, {":id", id}});

        bool isLocked = (newStatus == "locked");
        std::string notifTitle = isLocked ? ("TẠM KHÓA MÓN: " + prodName) : ("MỞ BÁN LẠI: " + prodName);
        std::string notifMsg = isLocked 
            ? ("Món '" + prodName + "' (" + prodCode + ") đã bị TẠM KHÓA trên thực đơn (Báo hết hàng bởi " + uName + ").")
            : ("Món '" + prodName + "' (" + prodCode + ") đã được MỞ BÁN LẠI trên thực đơn bởi " + uName + ".");

        // Thông báo chuông cho nhân viên quầy và phục vụ
        db.execute(R"(
            INSERT INTO app_notifications (type, order_id, table_code, title, message, is_read_waiter, is_read_cashier, created_at)
            VALUES (:type, 0, 'THỰC ĐƠN', :title, :message, 0, 0, datetime('now'))
        )", {
            {":type", isLocked ? "product_locked" : "product_unlocked"},
            {":title", notifTitle},
            {":message", notifMsg}
        });

        // Ghi nhật ký bếp (kitchen_service_logs)
        db.execute(R"(
            INSERT INTO kitchen_service_logs (order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, note, created_at)
            VALUES (0, 'MENU', 'THỰC ĐƠN', :action, :label, :uid, :uname, :urole, :note, datetime('now'))
        )", {
            {":action", isLocked ? "lock_product" : "unlock_product"},
            {":label", isLocked ? "Tạm khóa món (Hết hàng)" : "Mở bán lại món"},
            {":uid", uId},
            {":uname", uName},
            {":urole", uRole},
            {":note", notifMsg}
        });

        // Ghi nhật ký Kiểm toán nội bộ (audit_logs)
        try {
            db.execute(R"(
                INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                VALUES (:acode, :albl, 'INFO', 0, :pcode, 'THỰC ĐƠN', 0, :rsn, :uid, :uname, :urole, :dtl, :cat)
            )", {
                {":acode", isLocked ? "LOCK_PRODUCT_86" : "UNLOCK_PRODUCT_86"},
                {":albl", isLocked ? ("Báo hết món (86): " + prodName) : ("Mở bán lại món: " + prodName)},
                {":pcode", prodCode},
                {":rsn", isLocked ? "Bếp/Quầy báo tạm hết nguyên liệu" : "Bếp/Quầy mở bán trở lại"},
                {":uid", uId},
                {":uname", uName},
                {":urole", uRole},
                {":dtl", notifMsg},
                {":cat", getCurrentTimestamp()}
            });
        } catch (...) {}

        sendJson(res, {
            {"success", true},
            {"message", isLocked ? ("Đã tạm khóa món '" + prodName + "' (Báo hết hàng)!") : ("Đã mở bán lại món '" + prodName + "'!")},
            {"product_id", id},
            {"product_name", prodName},
            {"status", newStatus}
        });
        return;
    }

    // Check Admin cho CRUD món ăn
    auto userOpt = AuthService::instance().authenticate(req);
    if (!userOpt.has_value() || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
        sendJson(res, {{"success", false}, {"message", "Bạn không có quyền thực hiện thao tác này (yêu cầu Admin)!"}}, 403);
        return;
    }

    // 1.5 AI Tạo Ảnh Món Ăn Tự Động (ai_dish_studio) — ưu tiên Master AI Proxy bảo mật
    if (action == "ai_generate_dish_image") {
        if (!requireModule(res, "ai_dish_studio", "AI Tạo Ảnh Món Ăn Tự Động")) return;
        std::string name = BodyParser::getParam(req, body, "name");
        std::string catName = BodyParser::getParam(req, body, "category_name");
        std::string passedKey = BodyParser::getParam(req, body, "gemini_api_key");
        int64_t id = 0;
        try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        if (name.empty()) {
            sendError(res, "Vui lòng nhập tên món ăn!", 400);
            return;
        }

        std::string imgB64, mime, modelUsed, err;
        std::string localKey = resolveGeminiApiKey(db, passedKey);
        if (!localKey.empty()) {
            std::string prompt = "Professional commercial food and beverage studio photography of Vietnamese cafe/restaurant dish: \"" + name + "\"";
            if (!catName.empty()) prompt += " (Category: " + catName + ")";
            prompt += ". Appetizing close-up shot, warm moody cafe lighting, shallow depth of field, high detail, photorealistic, clean aesthetic, no text, no watermark.";
            if (!SaleApp::AI::geminiGenerateImageBase64(localKey, prompt, imgB64, mime, modelUsed, err)) {
                sendError(res, "Không thể tạo ảnh AI: " + err, 502);
                return;
            }
        } else {
            json proxyResp;
            if (!callMasterAiProxy({{"action", "generate_dish_image"}, {"name", name}, {"category_name", catName}}, proxyResp, err)) {
                sendError(res, err, 502);
                return;
            }
            imgB64 = proxyResp.value("image_base64", "");
            mime = proxyResp.value("mime_type", "image/png");
            modelUsed = proxyResp.value("ai_engine", "CyberNexus Master AI");
        }

        std::string imgBytes = SaleApp::AI::base64Decode(imgB64);
        if (imgBytes.empty()) {
            sendError(res, "Dữ liệu ảnh AI trả về không hợp lệ!", 502);
            return;
        }
        std::string ext = (mime.find("jpeg") != std::string::npos || mime.find("jpg") != std::string::npos) ? ".jpg" : ".png";
        auto nowMs = std::chrono::system_clock::now().time_since_epoch().count();
        std::string saveName = "dish_" + AuthService::sha256(name + std::to_string(nowMs)).substr(0, 20) + ext;
        namespace fs = std::filesystem;
        fs::path targetDir = SaleApp::Config::AppConfig::instance().getUploadsDir() / "products";
        fs::create_directories(targetDir);
        std::ofstream ofs(targetDir / saveName, std::ios::binary);
        if (!ofs) {
            sendError(res, "Không thể lưu file ảnh trên server!", 500);
            return;
        }
        ofs.write(imgBytes.data(), imgBytes.size());
        ofs.close();

        std::string webUrl = "uploads/products/" + saveName;
        if (id > 0) {
            db.execute("UPDATE products SET image = :img WHERE id = :id", {{":img", webUrl}, {":id", id}});
        }
        sendJson(res, {
            {"success", true},
            {"image_url", webUrl},
            {"ai_engine", modelUsed},
            {"message", "AI (" + modelUsed + ") đã tạo ảnh món ăn thành công!"}
        });
        return;
    }

    // 2. POST: Add Product
    if (action.empty() || action == "add") {
        std::string code = BodyParser::getParam(req, body, "code");
        std::string name = BodyParser::getParam(req, body, "name");
        int64_t category_id = 1;
        try { category_id = std::stoll(BodyParser::getParam(req, body, "category_id", "1")); } catch (...) {}
        double sale_price = 0.0;
        try {
            std::string pStr = BodyParser::getParam(req, body, "sale_price");
            if (pStr.empty()) pStr = BodyParser::getParam(req, body, "price", "0");
            sale_price = std::stod(pStr);
        } catch (...) {}
        double cost_price = 0.0;
        try { cost_price = std::stod(BodyParser::getParam(req, body, "cost_price", "0")); } catch (...) {}
        std::string unit = BodyParser::getParam(req, body, "unit", "ly");
        int is_topping = 0;
        try { is_topping = std::stoi(BodyParser::getParam(req, body, "is_topping", "0")); } catch (...) {}
        std::string image = BodyParser::getParam(req, body, "image");
        if (image.empty()) image = BodyParser::getParam(req, body, "image_url");
        std::string description = BodyParser::getParam(req, body, "description");

        if (name.empty()) {
            sendJson(res, {{"success", false}, {"message", "Tên món không được để trống!"}}, 400);
            return;
        }

        if (code.empty()) {
            auto countVal = db.queryScalar("SELECT COUNT(*) FROM products");
            int count = (countVal.is_number() ? countVal.get<int>() : 0) + 1;
            std::stringstream ss;
            ss << "SP" << std::setw(3) << std::setfill('0') << count;
            code = ss.str();
        }

        int64_t id = db.execute(R"(
            INSERT INTO products (code, name, category_id, sale_price, cost_price, unit, is_topping, image, description, status)
            VALUES (:code, :name, :cid, :price, :cost, :unit, :is_top, :img, :desc, 'active')
        )", {
            {":code", code}, {":name", name}, {":cid", category_id},
            {":price", sale_price}, {":cost", cost_price}, {":unit", unit},
            {":is_top", is_topping}, {":img", image}, {":desc", description}
        });

        sendJson(res, {{"success", true}, {"message", "Thêm món thành công!"}, {"id", id}});
        return;
    }

    // 3. POST: Update Product
    if (action == "update") {
        int64_t id = 0;
        try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        std::string name = BodyParser::getParam(req, body, "name");
        int64_t category_id = 1;
        try { category_id = std::stoll(BodyParser::getParam(req, body, "category_id", "1")); } catch (...) {}
        double sale_price = 0.0;
        try {
            std::string pStr = BodyParser::getParam(req, body, "sale_price");
            if (pStr.empty()) pStr = BodyParser::getParam(req, body, "price", "0");
            sale_price = std::stod(pStr);
        } catch (...) {}
        double cost_price = 0.0;
        try { cost_price = std::stod(BodyParser::getParam(req, body, "cost_price", "0")); } catch (...) {}
        std::string unit = BodyParser::getParam(req, body, "unit", "ly");
        std::string image = BodyParser::getParam(req, body, "image");
        if (image.empty()) image = BodyParser::getParam(req, body, "image_url");
        std::string description = BodyParser::getParam(req, body, "description");

        if (id <= 0 || name.empty()) {
            sendJson(res, {{"success", false}, {"message", "Dữ liệu cập nhật món không hợp lệ!"}}, 400);
            return;
        }

        db.execute(R"(
            UPDATE products 
            SET name = :name, category_id = :cid, sale_price = :price, cost_price = :cost, 
                unit = :unit, image = :img, description = :desc
            WHERE id = :id
        )", {
            {":id", id}, {":name", name}, {":cid", category_id},
            {":price", sale_price}, {":cost", cost_price}, {":unit", unit},
            {":img", image}, {":desc", description}
        });

        sendJson(res, {{"success", true}, {"message", "Cập nhật món thành công!"}});
        return;
    }

    // 4. POST: Delete Product
    if (action == "delete") {
        int64_t id = 0;
        try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        if (id <= 0) {
            sendJson(res, {{"success", false}, {"message", "Mã mặt hàng không hợp lệ!"}}, 400);
            return;
        }
        db.execute("UPDATE products SET status = 'deleted' WHERE id = :id", {{":id", id}});
        sendJson(res, {{"success", true}, {"message", "Đã xóa món ăn!"}});
        return;
    }

    sendJson(res, {{"success", false}, {"message", "Yêu cầu không hợp lệ!"}}, 400);
}

// ==========================================
// 4. TABLES & AREAS HANDLER (GIAI ĐOẠN 2 - BƯỚC 2.4)
// ==========================================
void ApiHandlers::handleTables(const httplib::Request& req, httplib::Response& res) {
    auto& db = Database::instance();
    ensureOrderWorkflowSchema(db);
    json body = parseBody(req);
    std::string action = getAction(req, body);

    if (req.method == "GET" && action == "public_tables") {
        json rows = db.query(R"(
            SELECT t.id, t.code, t.name, t.area_type,
                   CASE WHEN o.id IS NOT NULL THEN 'occupied' ELSE 'free' END as status
            FROM tables_areas t
            LEFT JOIN orders o ON o.id = COALESCE(
                (SELECT active_order.id FROM orders active_order WHERE active_order.id = t.active_order_id AND active_order.status = 'pending' LIMIT 1),
                (SELECT MAX(pending_order.id) FROM orders pending_order WHERE pending_order.table_id = t.id AND pending_order.status = 'pending')
            )
            ORDER BY t.sort_order ASC, t.id ASC
        )");
        sendJson(res, {{"success", true}, {"data", rows}});
        return;
    }

    // 1. GET: Fetch all tables with real-time active order info (Bước 2.4)
    if (req.method == "GET" && action.empty()) {
        // 1a. Auto-complete any order that meets all 3 factors (Cooking, Serving, Payment) and has no pending settlement delta
        db.execute(R"(
            UPDATE orders 
            SET status = 'completed', 
                completed_at = COALESCE(completed_at, paid_at, served_at, datetime('now'))
            WHERE status = 'pending' 
              AND (payment_status = 'paid' OR paid_at IS NOT NULL) 
              AND (kitchen_status = 'served' OR served_at IS NOT NULL)
              AND COALESCE(settlement_status, 'settled') = 'settled'
        )");

        // 1b. Auto-free tables that have no active pending order
        db.execute(R"(
            UPDATE tables_areas 
            SET status = 'free', active_order_id = NULL 
            WHERE id NOT IN (SELECT table_id FROM orders WHERE status = 'pending' AND table_id IS NOT NULL)
        )");

        // 1c. Fetch tables list
        std::string sql = R"(
            SELECT 
                t.id,
                t.code,
                t.name,
                t.area_type,
                CASE WHEN o.id IS NOT NULL THEN 'occupied' ELSE 'free' END as status,
                o.id as active_order_id,
                COALESCE(o.guest_count, t.guest_count, 1) as guest_count,
                t.sort_order,
                t.created_at,
                o.id as order_id,
                o.order_code,
                o.customer_name,
                CASE WHEN o.kitchen_status = 'awaiting_waiter' THEN 1 ELSE 0 END as customer_order_pending,
                o.total_amount,
                o.subtotal,
                COALESCE(o.paid_amount, 0) as paid_amount,
                COALESCE(o.settlement_status, 'settled') as settlement_status,
                COALESCE(o.order_type, 'pos') as order_type,
                COALESCE(o.cancel_request_reason, '') as cancel_request_reason,
                o.kitchen_status,
                o.kitchen_ready_at,
                COALESCE(o.kitchen_sent_at, '') as kitchen_sent_at,
                COALESCE(o.rush_count, 0) as rush_count,
                COALESCE(o.last_rushed_at, '') as last_rushed_at,
                COALESCE(o.last_rushed_by, '') as last_rushed_by,
                COALESCE(o.remind_count, 0) as remind_count,
                CASE WHEN o.id IS NOT NULL THEN MAX(0, CAST((strftime('%s', 'now', 'localtime') - strftime('%s', COALESCE(NULLIF(o.kitchen_sent_at, ''), o.created_at))) / 60 AS INTEGER)) ELSE 0 END as kitchen_elapsed_minutes,
                CASE WHEN o.id IS NOT NULL AND o.kitchen_ready_at IS NOT NULL AND o.kitchen_ready_at != '' THEN MAX(0, CAST((strftime('%s', 'now', 'localtime') - strftime('%s', o.kitchen_ready_at)) / 60 AS INTEGER)) ELSE 0 END as waiter_elapsed_minutes,
                o.served_at,
                o.payment_status,
                o.paid_at,
                o.created_at as order_created_at,
                (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND COALESCE(oi.cancel_status, 'none') NOT IN ('approved', 'out_of_stock')) as item_count,
                (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND COALESCE(oi.cancel_status, 'none') = 'pending_kitchen') as pending_cancel_count,
                (SELECT COUNT(*) FROM order_alerts oa WHERE oa.order_id = o.id AND oa.is_ack = 0) as unread_alerts_count,
                (SELECT COUNT(*) FROM orders pending_orders WHERE pending_orders.table_id = t.id AND pending_orders.status = 'pending') as open_order_count
            FROM tables_areas t
            LEFT JOIN orders o ON o.id = COALESCE(
                (SELECT active_order.id FROM orders active_order WHERE active_order.id = t.active_order_id AND active_order.status = 'pending' LIMIT 1),
                (SELECT MAX(pending_order.id) FROM orders pending_order WHERE pending_order.table_id = t.id AND pending_order.status = 'pending')
            )
            ORDER BY t.sort_order ASC, t.id ASC
        )";

        ActiveSlaConfig slaCfg = getActiveSlaConfig(db);
        json tables = db.query(sql);

        // Group by area_type: 'MANG_VE' and 'TAI_QUAN'
        json grouped = {
            {"MANG_VE", json::array()},
            {"TAI_QUAN", json::array()}
        };

        for (auto& t : tables) {
            t["kitchen_sla_minutes"] = slaCfg.kitchenSla;
            t["waiter_sla_minutes"] = slaCfg.waiterSla;
            t["active_sla_label"] = slaCfg.label;
            t["is_peak_sla"] = slaCfg.isPeak;
            std::string area = t.value("area_type", "TAI_QUAN");
            if (!grouped.contains(area)) {
                grouped[area] = json::array();
            }
            grouped[area].push_back(t);
        }

        sendJson(res, {
            {"success", true},
            {"data", tables},
            {"grouped", grouped},
            {"active_sla", {
                {"kitchen_sla_minutes", slaCfg.kitchenSla},
                {"waiter_sla_minutes", slaCfg.waiterSla},
                {"label", slaCfg.label},
                {"is_peak", slaCfg.isPeak}
            }},
            {"qr_error", nullptr}
        });
        return;
    }

    // 2. POST: Switch Table (Chuyển bàn)
    if (action == "switch_table") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt.has_value()) {
            sendJson(res, {{"success", false}, {"message", "Chưa đăng nhập!"}}, 401);
            return;
        }

        int64_t fromTableId = 0, toTableId = 0;
        try { fromTableId = std::stoll(BodyParser::getParam(req, body, "from_table_id", "0")); } catch (...) {}
        try { toTableId = std::stoll(BodyParser::getParam(req, body, "to_table_id", "0")); } catch (...) {}

        if (fromTableId <= 0) {
            std::string fromCode = BodyParser::getParam(req, body, "from_table");
            if (!fromCode.empty()) {
                auto r = db.queryRow("SELECT id FROM tables_areas WHERE code = :c", {{":c", fromCode}});
                if (!r.is_null()) fromTableId = r.value("id", 0LL);
            }
        }
        if (toTableId <= 0) {
            std::string toCode = BodyParser::getParam(req, body, "to_table");
            if (!toCode.empty()) {
                auto r = db.queryRow("SELECT id FROM tables_areas WHERE code = :c", {{":c", toCode}});
                if (!r.is_null()) toTableId = r.value("id", 0LL);
            }
        }

        if (fromTableId <= 0 || toTableId <= 0 || fromTableId == toTableId) {
            sendJson(res, {{"success", false}, {"message", "Bàn nguồn và bàn đích không hợp lệ!"}}, 400);
            return;
        }

        auto fromTable = db.queryRow("SELECT * FROM tables_areas WHERE id = :id", {{":id", fromTableId}});
        if (fromTable.is_null() || fromTable.value("active_order_id", 0LL) <= 0) {
            sendJson(res, {{"success", false}, {"message", "Bàn nguồn không có hóa đơn đang mở!"}}, 400);
            return;
        }

        auto toTable = db.queryRow("SELECT * FROM tables_areas WHERE id = :id", {{":id", toTableId}});
        if (toTable.is_null()) {
            sendJson(res, {{"success", false}, {"message", "Bàn đích không tồn tại!"}}, 400);
            return;
        }

        if (toTable.value("status", "free") == "occupied" && toTable.value("active_order_id", 0LL) > 0) {
            sendJson(res, {{"success", false}, {"message", "Bàn đích đang có khách! Hãy dùng chức năng Gộp bàn."}}, 400);
            return;
        }

        int64_t orderId = fromTable.value("active_order_id", 0LL);
        std::string fromCode = fromTable.value("code", "");
        std::string toCode = toTable.value("code", "");

        db.beginTransaction();
        db.execute("UPDATE orders SET table_id = :table_id, table_code = :table_code WHERE id = :order_id", {
            {":table_id", toTableId},
            {":table_code", toCode},
            {":order_id", orderId}
        });
        db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :id", {{":id", fromTableId}});
        db.execute("UPDATE tables_areas SET status = 'occupied', active_order_id = :order_id WHERE id = :id", {
            {":order_id", orderId},
            {":id", toTableId}
        });
        db.commit();

        sendJson(res, {{"success", true}, {"message", "Đã chuyển từ " + fromCode + " sang " + toCode + " thành công!"}});
        return;
    }

    // 3. POST: Merge Table (Gộp bàn)
    if (action == "merge_table") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt.has_value()) {
            sendJson(res, {{"success", false}, {"message", "Chưa đăng nhập!"}}, 401);
            return;
        }

        int64_t fromTableId = 0, toTableId = 0;
        try { fromTableId = std::stoll(BodyParser::getParam(req, body, "from_table_id", "0")); } catch (...) {}
        try { toTableId = std::stoll(BodyParser::getParam(req, body, "to_table_id", "0")); } catch (...) {}

        if (fromTableId <= 0) {
            std::string sourceCode = BodyParser::getParam(req, body, "source_table");
            if (!sourceCode.empty()) {
                auto r = db.queryRow("SELECT id FROM tables_areas WHERE code = :c", {{":c", sourceCode}});
                if (!r.is_null()) fromTableId = r.value("id", 0LL);
            }
        }
        if (toTableId <= 0) {
            std::string targetCode = BodyParser::getParam(req, body, "target_table");
            if (!targetCode.empty()) {
                auto r = db.queryRow("SELECT id FROM tables_areas WHERE code = :c", {{":c", targetCode}});
                if (!r.is_null()) toTableId = r.value("id", 0LL);
            }
        }

        if (fromTableId <= 0 || toTableId <= 0 || fromTableId == toTableId) {
            sendJson(res, {{"success", false}, {"message", "Bàn ghép và bàn nhận không hợp lệ!"}}, 400);
            return;
        }

        auto fromTable = db.queryRow("SELECT * FROM tables_areas WHERE id = :id", {{":id", fromTableId}});
        auto toTable = db.queryRow("SELECT * FROM tables_areas WHERE id = :id", {{":id", toTableId}});

        if (fromTable.is_null() || fromTable.value("active_order_id", 0LL) <= 0 ||
            toTable.is_null() || toTable.value("active_order_id", 0LL) <= 0) {
            sendJson(res, {{"success", false}, {"message", "Cả 2 bàn đều phải có hóa đơn đang mở để thực hiện gộp!"}}, 400);
            return;
        }

        int64_t fromOrderId = fromTable.value("active_order_id", 0LL);
        int64_t toOrderId = toTable.value("active_order_id", 0LL);
        std::string fromCode = fromTable.value("code", "");
        std::string toCode = toTable.value("code", "");

        db.beginTransaction();
        db.execute("UPDATE order_items SET order_id = :to_id WHERE order_id = :from_id", {
            {":to_id", toOrderId},
            {":from_id", fromOrderId}
        });

        auto sumVal = db.queryScalar("SELECT COALESCE(SUM(subtotal), 0) FROM order_items WHERE order_id = :id", {{":id", toOrderId}});
        double newSubtotal = sumVal.is_number() ? sumVal.get<double>() : 0.0;

        db.execute("UPDATE orders SET subtotal = :tot, total_amount = :tot WHERE id = :id", {
            {":tot", newSubtotal},
            {":id", toOrderId}
        });

        db.execute("UPDATE orders SET status = 'cancelled', note = :note WHERE id = :id", {
            {":note", "Đã gộp vào hóa đơn bàn " + toCode},
            {":id", fromOrderId}
        });

        db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :id", {{":id", fromTableId}});
        db.commit();

        sendJson(res, {{"success", true}, {"message", "Đã gộp " + fromCode + " vào " + toCode + " thành công!"}});
        return;
    }

    // 4. Admin CRUD for tables
    if (action == "add_table" || action == "update_table" || action == "delete_table" || action == "batch_add_tables") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt.has_value() || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            sendJson(res, {{"success", false}, {"message", "Bạn không có quyền thực hiện thao tác này (yêu cầu Admin)!"}}, 403);
            return;
        }

        if (action == "add_table") {
            std::string code = BodyParser::getParam(req, body, "code");
            std::string name = BodyParser::getParam(req, body, "name");
            std::string areaType = BodyParser::getParam(req, body, "area_type", "TAI_QUAN");
            int sortOrder = 0;
            try { sortOrder = std::stoi(BodyParser::getParam(req, body, "sort_order", "0")); } catch (...) {}

            if (code.empty() || name.empty()) {
                sendJson(res, {{"success", false}, {"message", "Mã bàn và tên bàn không được để trống!"}}, 400);
                return;
            }

            int64_t id = db.execute(R"(
                INSERT INTO tables_areas (code, name, area_type, sort_order, status)
                VALUES (:code, :name, :area_type, :sort_order, 'free')
            )", {
                {":code", code}, {":name", name}, {":area_type", areaType}, {":sort_order", sortOrder}
            });

            sendJson(res, {{"success", true}, {"message", "Thêm bàn thành công!"}, {"table_id", id}});
            return;
        }

        if (action == "batch_add_tables") {
            std::string prefix = BodyParser::getParam(req, body, "prefix", "B");
            std::string areaType = BodyParser::getParam(req, body, "area_type", "TAI_QUAN");
            int fromNum = 1, toNum = 10, guestCount = 4;
            try { fromNum = std::stoi(BodyParser::getParam(req, body, "from_num", "1")); } catch (...) {}
            try { toNum = std::stoi(BodyParser::getParam(req, body, "to_num", "10")); } catch (...) {}
            try { guestCount = std::stoi(BodyParser::getParam(req, body, "guest_count", "4")); } catch (...) {}
            if (fromNum < 1) fromNum = 1;
            if (toNum < fromNum) toNum = fromNum;
            if (toNum - fromNum > 100) toNum = fromNum + 100; // safety limit

            db.beginTransaction();
            int created = 0;
            for (int i = fromNum; i <= toNum; ++i) {
                std::string numStr = (i < 10 ? "0" : "") + std::to_string(i);
                std::string code = prefix + numStr;
                std::string name = (areaType == "MANG_VE" ? "Mang Về " : "Bàn ") + numStr;
                auto check = db.queryRow("SELECT id FROM tables_areas WHERE code = :c", {{":c", code}});
                if (check.is_null()) {
                    db.execute(R"(
                        INSERT INTO tables_areas (code, name, area_type, guest_count, sort_order, status)
                        VALUES (:code, :name, :area_type, :guest_count, :sort_order, 'free')
                    )", {
                        {":code", code}, {":name", name}, {":area_type", areaType},
                        {":guest_count", guestCount}, {":sort_order", i}
                    });
                    created++;
                }
            }
            db.commit();

            sendJson(res, {{"success", true}, {"message", "Đã tạo thành công " + std::to_string(created) + " bàn mới!"}, {"created_count", created}});
            return;
        }

        if (action == "update_table") {
            int64_t id = 0;
            try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
            std::string code = BodyParser::getParam(req, body, "code");
            std::string name = BodyParser::getParam(req, body, "name");
            std::string areaType = BodyParser::getParam(req, body, "area_type", "TAI_QUAN");
            int sortOrder = 0;
            try { sortOrder = std::stoi(BodyParser::getParam(req, body, "sort_order", "0")); } catch (...) {}

            if (id <= 0 || code.empty() || name.empty()) {
                sendJson(res, {{"success", false}, {"message", "Dữ liệu cập nhật bàn không hợp lệ!"}}, 400);
                return;
            }

            db.execute(R"(
                UPDATE tables_areas 
                SET code = :code, name = :name, area_type = :area_type, sort_order = :sort_order 
                WHERE id = :id
            )", {
                {":code", code}, {":name", name}, {":area_type", areaType}, {":sort_order", sortOrder}, {":id", id}
            });

            sendJson(res, {{"success", true}, {"message", "Cập nhật bàn thành công!"}});
            return;
        }

        if (action == "delete_table") {
            int64_t id = 0;
            try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
            db.execute("DELETE FROM tables_areas WHERE id = :id AND status = 'free'", {{":id", id}});
            sendJson(res, {{"success", true}, {"message", "Đã xóa bàn thành công!"}});
            return;
        }
    }

    sendJson(res, {{"success", false}, {"message", "Hành động không hợp lệ!"}}, 400);
}

// ==========================================
// 5. ORDERS & CHECKOUT HANDLER (GIAI ĐOẠN 3 - BƯỚC 3.1 ĐẾN 3.5)
// ==========================================
void ApiHandlers::handleOrders(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);

        // VietQR (Bước 3.4) - Hỗ trợ cả GET và POST
        if (action == "vietqr") {
            if (!requireModule(res, "vietqr_payment", "Thanh Toán VietQR Tự Động")) return;
            int64_t orderId = 0, tableId = 0;
            try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
            try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}
            double amount = 0.0;
            try { amount = std::stod(BodyParser::getParam(req, body, "amount", "0")); } catch (...) {}
            std::string orderCode = BodyParser::getParam(req, body, "order_code");

            if (orderId > 0) {
                auto ord = db.queryRow("SELECT total_amount, order_code FROM orders WHERE id = :id", {{":id", orderId}});
                if (!ord.is_null()) {
                    amount = getDouble(ord, "total_amount", 0.0);
                    orderCode = getString(ord, "order_code", "");
                }
            } else if (tableId > 0) {
                auto tbl = db.queryRow("SELECT active_order_id, code FROM tables_areas WHERE id = :id", {{":id", tableId}});
                if (!tbl.is_null() && getInt(tbl, "active_order_id", 0) > 0) {
                    auto ord = db.queryRow("SELECT total_amount, order_code FROM orders WHERE id = :id", {{":id", tbl["active_order_id"]}});
                    if (!ord.is_null()) {
                        amount = getDouble(ord, "total_amount", 0.0);
                        orderCode = getString(ord, "order_code", "");
                    }
                }
                if (orderCode.empty() && !tbl.is_null()) {
                    orderCode = getString(tbl, "code", "");
                }
            }

            if (orderCode.empty()) {
                orderCode = "POS-" + getCurrentTimestamp().substr(11, 2) + getCurrentTimestamp().substr(14, 2) + getCurrentTimestamp().substr(17, 2);
            }

            json store = getStoreInfo(db);
            std::string bankId = store.value("bank_id", "OCB");
            std::string accNo = store.value("bank_account_no", "0918608073");
            std::string accName = store.value("bank_account_name", "NGUYEN CHI HUNG");
            std::string transferNote = "TT " + orderCode;

            std::stringstream ss;
            ss << "https://img.vietqr.io/image/" << bankId << "-" << accNo << "-compact2.png?amount="
               << static_cast<int64_t>(amount) << "&addInfo=" << transferNote
               << "&accountName=" << accName;

            sendJson(res, {
                {"success", true},
                {"vietqr_url", ss.str()},
                {"bank_id", bankId},
                {"account_no", accNo},
                {"account_name", accName},
                {"amount", amount},
                {"note", transferNote}
            });
            return;
        }

        // ------------------------------------------
        // A. GET REQUESTS
        // ------------------------------------------
        if (req.method == "GET") {
            ensureOrderWorkflowSchema(db);
            // Step 3.2: Kitchen Tickets (Đơn chế biến màn hình Bếp KDS)
            if (action == "kitchen_tickets") {
                if (!requireModule(res, "kitchen_kds", "Màn Hình Bếp & Pha Chế (KDS)")) return;
                std::string filterStatus = BodyParser::getParam(req, body, "status", "active");
                std::string todayDate = getCurrentDate();

                // Auto-complete any order that meets all 3 factors and has no pending settlement delta
                db.execute(R"(
                    UPDATE orders 
                    SET status = 'completed', 
                        completed_at = COALESCE(completed_at, paid_at, served_at, datetime('now'))
                    WHERE status = 'pending' 
                      AND (payment_status = 'paid' OR paid_at IS NOT NULL) 
                      AND (kitchen_status = 'served' OR served_at IS NOT NULL)
                      AND COALESCE(settlement_status, 'settled') = 'settled'
                )");

                std::string sql;
                if (filterStatus == "history") {
                    sql = R"(
                        SELECT o.*, t.name as table_name, t.area_type
                        FROM orders o
                        LEFT JOIN tables_areas t ON o.table_id = t.id
                        WHERE DATE(o.created_at) = ')" + todayDate + R"('
                          AND (o.status = 'completed' OR o.kitchen_status = 'archived')
                        ORDER BY o.id DESC LIMIT 100
                    )";
                } else {
                    sql = R"(
                        SELECT o.*, t.name as table_name, t.area_type
                        FROM orders o
                        LEFT JOIN tables_areas t ON o.table_id = t.id
                        WHERE o.status != 'cancelled'
                          AND COALESCE(o.kitchen_status, 'pending') NOT IN ('awaiting_waiter', 'awaiting_payment', 'awaiting_kitchen_push')
                    )";

                    if (filterStatus == "active") {
                        sql += " AND o.status = 'pending' AND (o.kitchen_status IN ('pending', 'ready', 'cancel_requested') OR o.kitchen_status IS NULL)";
                    } else if (filterStatus == "served") {
                        sql += " AND o.status = 'pending' AND o.kitchen_status = 'served'";
                    } else {
                        sql += " AND o.status = 'pending'";
                    }

                    sql += R"(
                        ORDER BY 
                        CASE 
                            WHEN o.kitchen_status = 'ready' THEN 1
                            WHEN o.kitchen_status = 'pending' OR o.kitchen_status IS NULL THEN 2
                            WHEN o.kitchen_status = 'served' THEN 3
                            ELSE 4
                        END, o.id ASC
                    )";
                }

                ActiveSlaConfig slaCfg = getActiveSlaConfig(db);
                json orders = db.query(sql);
                for (auto& o : orders) {
                    int64_t oid = getInt(o, "id", 0);
                    o["kitchen_sla_minutes"] = slaCfg.kitchenSla;
                    o["waiter_sla_minutes"] = slaCfg.waiterSla;
                    o["active_sla_label"] = slaCfg.label;
                    o["kitchen_elapsed_minutes"] = computeElapsedMinutesSql(db, oid, "COALESCE(NULLIF(kitchen_sent_at, ''), created_at)");
                    std::string kReadyAt = getString(o, "kitchen_ready_at", "");
                    o["waiter_elapsed_minutes"] = kReadyAt.empty() ? 0 : computeElapsedMinutesSql(db, oid, "kitchen_ready_at");
                    json items = db.query("SELECT * FROM order_items WHERE order_id = :oid ORDER BY id ASC", {{":oid", oid}});
                    for (auto& it : items) {
                        if (it.contains("toppings_json") && !it["toppings_json"].is_null() && it["toppings_json"].is_string()) {
                            try {
                                it["toppings"] = json::parse(it["toppings_json"].get<std::string>());
                            } catch (...) {
                                it["toppings"] = json::array();
                            }
                        } else {
                            it["toppings"] = json::array();
                        }
                    }
                    o["items"] = items;
                }

                auto cActive = db.queryScalar("SELECT COUNT(*) FROM orders WHERE status = 'pending' AND (kitchen_status = 'pending' OR kitchen_status = 'ready' OR kitchen_status IS NULL)");
                auto cServed = db.queryScalar("SELECT COUNT(*) FROM orders WHERE status = 'pending' AND kitchen_status = 'served'");
                auto cHistory = db.queryScalar("SELECT COUNT(*) FROM orders WHERE DATE(created_at) = '" + todayDate + "' AND (status = 'completed' OR kitchen_status = 'archived')");
                auto cAll = db.queryScalar("SELECT COUNT(*) FROM orders WHERE status = 'pending' AND COALESCE(kitchen_status, 'pending') != 'awaiting_waiter'");

                json counts = {
                    {"active", cActive.is_number() ? cActive.get<int>() : 0},
                    {"served", cServed.is_number() ? cServed.get<int>() : 0},
                    {"history", cHistory.is_number() ? cHistory.get<int>() : 0},
                    {"all", cAll.is_number() ? cAll.get<int>() : 0}
                };

                sendJson(res, {{"success", true}, {"data", orders}, {"counts", counts}});
                return;
            }

            // Customer Order Status (Trang khách tra cứu đơn hàng)
            if (action == "customer_status") {
                std::string token = BodyParser::getParam(req, body, "token", BodyParser::getParam(req, body, "code", ""));
                if (token.empty() && req.has_param("token")) token = req.get_param_value("token");
                auto ord = db.queryRow("SELECT * FROM orders WHERE order_code = :c OR id = :c LIMIT 1", {{":c", token}});
                if (ord.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy đơn hàng!"}}, 404);
                    return;
                }
                sendJson(res, {
                    {"success", true},
                    {"order", ord}
                });
                return;
            }

            if (action == "check_payment") {
                std::string code = BodyParser::getParam(req, body, "order_code", BodyParser::getParam(req, body, "code", ""));
                if (code.empty() && req.has_param("order_code")) code = req.get_param_value("order_code");
                auto ord = db.queryRow(
                    "SELECT id, order_code, table_code, total_amount, COALESCE(paid_amount, 0) as paid_amount, "
                    "payment_status, kitchen_status, status, COALESCE(settlement_status, 'settled') as settlement_status, "
                    "COALESCE(payment_verified_by, '') as payment_verified_by "
                    "FROM orders WHERE order_code = :c OR id = :c LIMIT 1",
                    {{":c", code}}
                );
                if (ord.is_null()) {
                    sendError(res, "Không tìm thấy đơn hàng!", 404);
                    return;
                }
                sendJson(res, {{"success", true}, {"data", ord}});
                return;
            }

            if (action == "alerts") {
                std::string roleFilter = BodyParser::getParam(req, body, "target_role", "all");
                json alerts;
                if (roleFilter == "all" || roleFilter.empty()) {
                    alerts = db.query("SELECT * FROM order_alerts WHERE is_ack = 0 ORDER BY id DESC LIMIT 50");
                } else {
                    alerts = db.query(
                        "SELECT * FROM order_alerts WHERE is_ack = 0 AND (target_role = 'all' OR target_role = :r) ORDER BY id DESC LIMIT 50",
                        {{":r", roleFilter}}
                    );
                }
                json pendingDeltas = db.query(R"(
                    SELECT id, order_code, table_id, table_code, total_amount, COALESCE(paid_amount, 0) as paid_amount,
                           COALESCE(settlement_status, 'settled') as settlement_status,
                           COALESCE(kitchen_status, 'pending') as kitchen_status,
                           COALESCE(cancel_request_reason, '') as cancel_request_reason,
                           status, payment_status
                    FROM orders
                    WHERE COALESCE(settlement_status, 'settled') IN ('extra_due', 'refund_due')
                       OR (status = 'pending' AND kitchen_status IN ('cancel_requested', 'awaiting_payment', 'awaiting_waiter', 'awaiting_kitchen_push'))
                    ORDER BY id DESC LIMIT 30
                )");
                sendJson(res, {
                    {"success", true},
                    {"alerts", alerts},
                    {"pending_deltas", pendingDeltas}
                });
                return;
            }

            // Online & Takeaway Orders (Màn hình xử lý Đơn Online / Mang Về)
            if (action == "online_orders") {
                std::string filterStatus = BodyParser::getParam(req, body, "status", "active");
                std::string todayDate = getCurrentDate();

                std::string sql = R"(
                    SELECT o.*, t.name as table_name, t.area_type
                    FROM orders o
                    LEFT JOIN tables_areas t ON o.table_id = t.id
                    WHERE (t.area_type = 'takeaway' OR o.table_code LIKE 'MV%' OR o.table_id IS NULL OR o.table_code = 'ONLINE' OR o.order_code LIKE 'ONL%')
                      AND o.status != 'cancelled'
                )";

                if (filterStatus == "active") {
                    sql += " AND o.status = 'pending'";
                } else {
                    sql += " AND (DATE(o.created_at) = '" + todayDate + "' OR o.status = 'pending')";
                }
                sql += " ORDER BY CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END, o.id DESC LIMIT 100";

                ActiveSlaConfig slaCfg = getActiveSlaConfig(db);
                json orders = db.query(sql);
                for (auto& o : orders) {
                    int64_t oid = getInt(o, "id", 0);
                    o["kitchen_sla_minutes"] = slaCfg.kitchenSla;
                    o["waiter_sla_minutes"] = slaCfg.waiterSla;
                    o["active_sla_label"] = slaCfg.label;
                    o["kitchen_elapsed_minutes"] = computeElapsedMinutesSql(db, oid, "COALESCE(NULLIF(kitchen_sent_at, ''), created_at)");
                    std::string kReadyAt = getString(o, "kitchen_ready_at", "");
                    o["waiter_elapsed_minutes"] = kReadyAt.empty() ? 0 : computeElapsedMinutesSql(db, oid, "kitchen_ready_at");
                    json items = db.query("SELECT * FROM order_items WHERE order_id = :oid ORDER BY id ASC", {{":oid", oid}});
                    std::string summary;
                    for (size_t i = 0; i < items.size(); ++i) {
                        if (i > 0) summary += ", ";
                        summary += std::to_string(getInt(items[i], "quantity", 1)) + "x " + getString(items[i], "product_name", "Món");
                    }
                    o["items"] = items;
                    o["items_summary"] = summary.empty() ? "Chưa có chi tiết món" : summary;

                    std::string cname = getString(o, "customer_name", "");
                    std::string cphone = getString(o, "customer_phone", "");
                    if (cphone.empty()) {
                        size_t lp = cname.find('(');
                        size_t rp = cname.find(')', lp == std::string::npos ? 0 : lp);
                        if (lp != std::string::npos && rp != std::string::npos && rp > lp + 1) {
                            cphone = cname.substr(lp + 1, rp - lp - 1);
                        }
                    }
                    o["customer_phone"] = cphone;
                }

                sendJson(res, {{"success", true}, {"data", orders}});
                return;
            }

            // History
            if (action == "history") {
                std::string today = getCurrentDate();
                std::string dateFrom = BodyParser::getParam(req, body, "date_from", "");
                std::string dateTo = BodyParser::getParam(req, body, "date_to", "");
                std::string statusFilter = BodyParser::getParam(req, body, "status", "");
                std::string search = BodyParser::getParam(req, body, "search", "");
                std::string allDates = BodyParser::getParam(req, body, "all_dates", "");

                if (dateFrom.empty() && dateTo.empty() && allDates != "1" && search.empty()) {
                    dateFrom = today;
                    dateTo = today;
                }

                std::string sql = R"(
                    SELECT o.*,
                           (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) as items_count,
                           (SELECT GROUP_CONCAT(oi.product_name || ' x' || oi.quantity, ', ') FROM order_items oi WHERE oi.order_id = o.id) as items_summary
                    FROM orders o
                    WHERE 1=1
                )";
                std::vector<std::pair<std::string, json>> params;
                if (!dateFrom.empty()) {
                    sql += " AND substr(o.created_at, 1, 10) >= :df";
                    params.emplace_back(":df", dateFrom);
                }
                if (!dateTo.empty()) {
                    sql += " AND substr(o.created_at, 1, 10) <= :dt";
                    params.emplace_back(":dt", dateTo);
                }
                if (!statusFilter.empty() && statusFilter != "all") {
                    sql += " AND o.status = :st";
                    params.emplace_back(":st", statusFilter);
                }
                if (!search.empty()) {
                    sql += " AND (o.order_code LIKE :q OR o.table_code LIKE :q OR o.user_name LIKE :q OR o.customer_name LIKE :q)";
                    params.emplace_back(":q", "%" + search + "%");
                }
                sql += " ORDER BY o.id DESC LIMIT 500";
                sendJson(res, {{"success", true}, {"data", db.query(sql, params)}});
                return;
            }

            // Step 3.5: Detail / Reprint Bill (In hóa đơn K80/K58)
            if (action.empty() || action == "detail" || action == "reprint") {
                int64_t orderId = 0, tableId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", BodyParser::getParam(req, body, "id", "0"))); } catch (...) {}
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}

                if (orderId <= 0 && tableId > 0) {
                    auto tbl = db.queryRow("SELECT active_order_id FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tbl.is_null()) orderId = getInt(tbl, "active_order_id", 0);
                }

                if (orderId <= 0) {
                    std::string sql = "SELECT * FROM orders ORDER BY id DESC LIMIT 50";
                    sendJson(res, {{"success", true}, {"data", db.query(sql)}});
                    return;
                }

                auto order = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
                if (order.is_null()) {
                    sendError(res, "Không tìm thấy hóa đơn!", 404);
                    return;
                }

                json items = db.query("SELECT * FROM order_items WHERE order_id = :id ORDER BY id ASC", {{":id", orderId}});
                for (auto& it : items) {
                    if (it.contains("toppings_json") && !it["toppings_json"].is_null() && it["toppings_json"].is_string()) {
                        try {
                            it["toppings"] = json::parse(it["toppings_json"].get<std::string>());
                        } catch (...) {
                            it["toppings"] = json::array();
                        }
                    } else {
                        it["toppings"] = json::array();
                    }
                }

                sendJson(res, {
                    {"success", true},
                    {"order", order},
                    {"items", items},
                    {"store", getStoreInfo(db)}
                });
                return;
            }
        }

        // ------------------------------------------
        // B. POST REQUESTS
        // ------------------------------------------
        if (req.method == "POST") {
            ensureOrderWorkflowSchema(db);
            // Step 3.1: Save / Update Draft Order (Tạo đơn bán / cập nhật giỏ hàng / đặt hàng online)
            if (action == "save_order" || action == "save" || action == "customer_order") {
                bool isCustomerQr = (action == "customer_order");
                std::string orderMode = BodyParser::getParam(req, body, "order_mode", "");
                if (isCustomerQr) {
                    if (!requireModule(res, "qr_customer_order", "Thực Đơn QR Khách Hàng")) return;
                }
                int64_t tableId = 0;
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}
                if (isCustomerQr && (orderMode == "dine_in" || tableId > 0)) {
                    if (!requireModule(res, "qr_table_order", "Đặt Món QR Theo Bàn")) return;
                }
                std::string tableCode = BodyParser::getParam(req, body, "table_code", "MANG VỀ");
                std::string orderType = isCustomerQr ? (orderMode.empty() ? (tableId > 0 ? "dine_in" : "delivery") : orderMode) : "pos";
                std::string initialKitchenStatus = "pending";

                if (isCustomerQr) {
                    if (orderType == "dine_in") {
                        if (tableId <= 0) {
                            sendJson(res, {{"success", false}, {"message", "Vui lòng chọn đúng bàn đang trống trên sơ đồ quán!"}}, 400);
                            return;
                        }
                        auto tblCheck = db.queryRow("SELECT id, code, area_type FROM tables_areas WHERE id = :id LIMIT 1", {{":id", tableId}});
                        if (tblCheck.is_null()) {
                            sendJson(res, {{"success", false}, {"message", "Bàn đã chọn không tồn tại!"}}, 400);
                            return;
                        }
                        tableCode = getString(tblCheck, "code", tableCode);
                        auto busyRow = db.queryRow("SELECT id FROM orders WHERE table_id = :tid AND status = 'pending' LIMIT 1", {{":tid", tableId}});
                        if (!busyRow.is_null()) {
                            sendJson(res, {{"success", false}, {"table_conflict", true}, {"message", "Bàn " + tableCode + " vừa có khách đặt trước. Vui lòng chọn bàn trống khác hoặc nhờ nhân viên hỗ trợ!"}}, 409);
                            return;
                        }
                        initialKitchenStatus = "awaiting_waiter";
                    } else if (orderType == "takeaway") {
                        auto freeMv = db.queryRow(R"(
                            SELECT t.id, t.code FROM tables_areas t
                            WHERE (t.area_type = 'MANG_VE' OR t.area_type = 'takeaway' OR t.code LIKE 'MV%')
                              AND t.id NOT IN (SELECT table_id FROM orders WHERE status = 'pending' AND table_id IS NOT NULL)
                            ORDER BY t.sort_order ASC, t.id ASC LIMIT 1
                        )");
                        if (!freeMv.is_null()) {
                            tableId = getInt(freeMv, "id", 0);
                            tableCode = getString(freeMv, "code", "MV1");
                        } else {
                            tableId = 0;
                            tableCode = "MV-CHỜ";
                        }
                        initialKitchenStatus = "awaiting_payment";
                    } else {
                        orderType = "delivery";
                        tableId = 0;
                        tableCode = "ONLINE";
                        initialKitchenStatus = "awaiting_payment";
                    }
                }
                std::string customerName = BodyParser::getParam(req, body, "customer_name", "Khách vãng lai");
                std::string customerPhone = BodyParser::getParam(req, body, "customer_phone");
                if (!customerPhone.empty() && customerName.find(customerPhone) == std::string::npos) {
                    if (customerName.empty() || customerName == "Khách vãng lai") {
                        customerName = "Khách online (" + customerPhone + ")";
                    } else {
                        customerName += " (" + customerPhone + ")";
                    }
                }
                int guestCount = 1;
                try { guestCount = std::max(1, std::stoi(BodyParser::getParam(req, body, "guest_count", "1"))); } catch (...) {}

                double discountValue = 0.0;
                try { discountValue = std::stod(BodyParser::getParam(req, body, "discount_value", "0")); } catch (...) {}
                std::string discountType = BodyParser::getParam(req, body, "discount_type", "amount");
                if (discountType != "percent") discountType = "amount";

                double vatPercent = 0.0;
                try { vatPercent = std::stod(BodyParser::getParam(req, body, "vat_percent", "0")); } catch (...) {}
                std::string note = BodyParser::getParam(req, body, "note");

                json items = json::array();
                if (body.contains("items") && body["items"].is_array()) {
                    items = body["items"];
                }

                if (items.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Giỏ hàng không có sản phẩm nào!"}}, 400);
                    return;
                }

                // Auto fill item info if missing (e.g. from customer_order)
                for (auto& item : items) {
                    int64_t pid = getInt(item, "id", getInt(item, "product_id", 0));
                    if (pid > 0 && (getDouble(item, "price", 0.0) <= 0 || getString(item, "name", "").empty())) {
                        auto pRow = db.queryRow("SELECT id, code, name, sale_price as price, unit FROM products WHERE id = :id", {{":id", pid}});
                        if (!pRow.is_null()) {
                            if (getString(item, "code", "").empty()) item["code"] = getString(pRow, "code", "");
                            if (getString(item, "name", "").empty()) item["name"] = getString(pRow, "name", "");
                            if (getDouble(item, "price", 0.0) <= 0) item["price"] = getDouble(pRow, "price", 0.0);
                            if (getString(item, "unit", "").empty()) item["unit"] = getString(pRow, "unit", "phần");
                        }
                    }
                }

                auto userOpt = AuthService::instance().authenticate(req);
                int64_t userId = userOpt.has_value() ? userOpt->id : 1;
                std::string userName = userOpt.has_value() ? userOpt->fullname : "Thu ngân";
                std::string userRole = userOpt.has_value() ? userOpt->role : "cashier";

                bool isAppendMode = false;
                if (body.contains("append")) {
                    if (body["append"].is_boolean()) isAppendMode = body["append"].get<bool>();
                    else if (body["append"].is_number()) isAppendMode = (body["append"].get<int>() != 0);
                }
                if (BodyParser::getParam(req, body, "mode") == "append") isAppendMode = true;

                // Find existing active order on table
                int64_t orderId = 0;
                if (tableId > 0) {
                    auto tCheck = db.queryRow("SELECT active_order_id, code FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tCheck.is_null()) {
                        orderId = getInt(tCheck, "active_order_id", 0);
                        tableCode = getString(tCheck, "code", tableCode);
                    }
                }

                // Calculate subtotal from items
                double subtotal = 0.0;
                for (const auto& item : items) {
                    int64_t qty = std::max<int64_t>(1, getInt(item, "quantity", 1));
                    double price = getDouble(item, "price", 0.0);
                    subtotal += (qty * price);
                }

                ensurePromotionSchema(db);
                int64_t promoId = 0;
                try {
                    std::string pidStr = BodyParser::getParam(req, body, "promo_id");
                    if (!pidStr.empty()) promoId = std::stoll(pidStr);
                } catch (...) {}
                std::string promoCode = BodyParser::getParam(req, body, "promo_code", "");
                std::string promoName = BodyParser::getParam(req, body, "promo_name", "");

                double discountAmount = 0.0;
                if (!promoCode.empty()) {
                    std::string upCode = promoCode;
                    std::transform(upCode.begin(), upCode.end(), upCode.begin(), ::toupper);
                    auto pRow = db.queryRow("SELECT * FROM promotions WHERE UPPER(code) = :c LIMIT 1", {{":c", upCode}});
                    std::string pErr;
                    if (!pRow.is_null() && isPromoEligibleNow(db, pRow, subtotal, pErr)) {
                        promoId = getInt(pRow, "id", 0);
                        promoCode = getString(pRow, "code", upCode);
                        promoName = getString(pRow, "name", "");
                        discountType = getString(pRow, "discount_type", "percent");
                        discountValue = getDouble(pRow, "discount_value", 0.0);
                        discountAmount = computePromoDiscount(pRow, subtotal);
                    } else if (discountValue > 0) {
                        discountAmount = (discountType == "percent")
                            ? (subtotal * std::min(100.0, std::max(0.0, discountValue))) / 100.0
                            : std::min(subtotal, std::max(0.0, discountValue));
                    }
                } else if (discountType == "percent") {
                    discountAmount = (subtotal * std::min(100.0, std::max(0.0, discountValue))) / 100.0;
                } else {
                    discountAmount = std::min(subtotal, std::max(0.0, discountValue));
                }

                double afterDiscount = std::max(0.0, subtotal - discountAmount);
                double vatAmount = (afterDiscount * std::max(0.0, vatPercent)) / 100.0;
                double totalAmount = afterDiscount + vatAmount;

                std::string nowStr = getCurrentTimestamp();
                std::string orderCode;

                db.beginTransaction();
                if (orderId > 0) {
                    auto existingOrder = db.queryRow("SELECT * FROM orders WHERE id = :id AND status = 'pending'", {{":id", orderId}});
                    if (existingOrder.is_null()) {
                        db.rollback();
                        sendJson(res, {{"success", false}, {"message", "Hóa đơn không tồn tại hoặc đã thanh toán trước đó!"}}, 400);
                        return;
                    }

                    orderCode = getString(existingOrder, "order_code", "");

                    if (isAppendMode) {
                        double oldSub = getDouble(existingOrder, "subtotal", 0.0);
                        double newSub = oldSub + subtotal;
                        double discVal = getDouble(existingOrder, "discount_value", 0.0);
                        std::string discT = getString(existingOrder, "discount_type", "amount");
                        double newDiscAmt = getDouble(existingOrder, "discount_amount", 0.0);
                        if (discT == "percent" && discVal > 0) {
                            newDiscAmt = (newSub * std::min(100.0, discVal)) / 100.0;
                        }
                        double vatPct = getDouble(existingOrder, "vat_percent", 0.0);
                        double newVatAmt = std::max(0.0, newSub - newDiscAmt) * (vatPct / 100.0);
                        double newTot = std::max(0.0, newSub - newDiscAmt) + newVatAmt;

                        std::string kSentNow = getCurrentTimestamp();
                        db.execute(R"(
                            UPDATE orders SET
                                subtotal = :sub, discount_amount = :disc, vat_amount = :vat,
                                total_amount = :tot, kitchen_status = 'pending', kitchen_ready_at = NULL,
                                kitchen_sent_at = :ksent, prep_time_minutes = 0
                            WHERE id = :id AND status = 'pending'
                        )", {
                            {":sub", newSub}, {":disc", newDiscAmt}, {":vat", newVatAmt},
                            {":tot", newTot}, {":ksent", kSentNow}, {":id", orderId}
                        });
                        totalAmount = newTot;
                    } else {
                        // Replace mode
                        db.execute(R"(
                            UPDATE orders SET
                                customer_name = :cname, guest_count = :gc, subtotal = :sub,
                                discount_type = :dt, discount_value = :dv, discount_amount = :da,
                                vat_percent = :vp, vat_amount = :va, total_amount = :tot,
                                user_id = :uid, user_name = :uname, note = :note,
                                kitchen_status = 'pending'
                            WHERE id = :id AND status = 'pending'
                        )", {
                            {":cname", customerName}, {":gc", guestCount}, {":sub", subtotal},
                            {":dt", discountType}, {":dv", discountValue}, {":da", discountAmount},
                            {":vp", vatPercent}, {":va", vatAmount}, {":tot", totalAmount},
                            {":uid", userId}, {":uname", userName}, {":note", note}, {":id", orderId}
                        });

                        db.execute("DELETE FROM order_items WHERE order_id = :id", {{":id", orderId}});
                    }
                } else {
                    // New Order
                    std::string today = getCurrentDate();
                    std::string dateCompact = today.substr(2, 2) + today.substr(5, 2) + today.substr(8, 2);
                    std::string prefix = "HD" + dateCompact + "-";
                    auto maxVal = db.queryScalar("SELECT MAX(order_code) FROM orders WHERE order_code LIKE '" + prefix + "%'");
                    int64_t nextSeq = 1;
                    if (!maxVal.is_null() && maxVal.is_string()) {
                        std::string maxCode = maxVal.get<std::string>();
                        auto dashPos = maxCode.rfind('-');
                        if (dashPos != std::string::npos && dashPos + 1 < maxCode.length()) {
                            try {
                                nextSeq = std::stoll(maxCode.substr(dashPos + 1)) + 1;
                            } catch (...) {
                                nextSeq = 1;
                            }
                        }
                    }
                    while (true) {
                        std::stringstream ss;
                        ss << prefix << std::setw(4) << std::setfill('0') << nextSeq;
                        orderCode = ss.str();
                        auto existRow = db.queryScalar("SELECT id FROM orders WHERE order_code = '" + orderCode + "'");
                        if (existRow.is_null()) break;
                        nextSeq++;
                    }

                    std::string initialKitchenSentAt = (initialKitchenStatus == "pending") ? nowStr : "";
                    orderId = db.execute(R"(
                        INSERT INTO orders (
                            order_code, table_id, table_code, customer_name, guest_count,
                            subtotal, discount_type, discount_value, discount_amount, vat_percent, vat_amount,
                            total_amount, status, payment_status, kitchen_status, kitchen_sent_at, order_type, promo_id, promo_code, promo_name, user_id, user_name, note, created_at
                        ) VALUES (
                            :code, :tid, :tcode, :cname, :gc,
                            :sub, :dt, :dv, :da, :vp, :va,
                            :tot, 'pending', 'unpaid', :kstat, :ksent, :otype, :pid, :pcode, :pname, :uid, :uname, :note, :created
                        )
                    )", {
                        {":code", orderCode}, {":tid", tableId > 0 ? json(tableId) : json(nullptr)},
                        {":tcode", tableCode}, {":cname", customerName}, {":gc", guestCount},
                        {":sub", subtotal}, {":dt", discountType}, {":dv", discountValue}, {":da", discountAmount},
                        {":vp", vatPercent}, {":va", vatAmount}, {":tot", totalAmount},
                        {":kstat", initialKitchenStatus}, {":ksent", initialKitchenSentAt}, {":otype", orderType},
                        {":pid", promoId}, {":pcode", promoCode}, {":pname", promoName},
                        {":uid", userId}, {":uname", userName}, {":note", note}, {":created", nowStr}
                    });

                    if (orderId <= 0) {
                        db.rollback();
                        sendError(res, "Lỗi tạo hóa đơn (không thể lưu vào CSDL)!", 500);
                        return;
                    }

                    if (tableId > 0) {
                        db.execute("UPDATE tables_areas SET status = 'occupied', active_order_id = :oid, guest_count = :gc WHERE id = :id", {
                            {":oid", orderId}, {":gc", guestCount}, {":id", tableId}
                        });
                    }
                }

                // Insert order items
                for (const auto& item : items) {
                    int64_t pid = getInt(item, "id", getInt(item, "product_id", 0));
                    std::string pCode = getString(item, "code", getString(item, "product_code", ""));
                    std::string pName = getString(item, "name", getString(item, "product_name", ""));
                    std::string pUnit = getString(item, "unit", "ly");
                    int64_t qty = std::max<int64_t>(1, getInt(item, "quantity", 1));
                    double price = getDouble(item, "price", 0.0);
                    double lineTotal = qty * price;
                    std::string itemNote = getString(item, "note", "");
                    std::string tops = item.contains("toppings") ? item["toppings"].dump() : "";

                    db.execute(R"(
                        INSERT INTO order_items (
                            order_id, product_id, product_code, product_name, unit,
                            quantity, price, subtotal, note, toppings_json, cancel_status
                        ) VALUES (
                            :oid, :pid, :pcode, :pname, :unit,
                            :qty, :price, :sub, :note, :tops, 'none'
                        )
                    )", {
                        {":oid", orderId}, {":pid", pid}, {":pcode", pCode}, {":pname", pName}, {":unit", pUnit},
                        {":qty", qty}, {":price", price}, {":sub", lineTotal}, {":note", itemNote}, {":tops", tops}
                    });
                }

                if (isAppendMode) {
                    json recalc = recalculateOrderTotalsAndSettlement(db, orderId);
                    if (recalc.contains("total_amount")) totalAmount = recalc["total_amount"].get<double>();
                    if (recalc.value("settlement_status", "settled") == "extra_due") {
                        double diff = recalc.value("delta_amount", 0.0);
                        createOrderAlert(db, orderId, orderCode, tableId, tableCode, "extra_due",
                            "Cần thu thêm tiền " + tableCode,
                            "Khách gọi thêm món trên đơn đã thanh toán. Cần thu thêm " + std::to_string(static_cast<int64_t>(diff)) + "đ.",
                            "cashier");
                    }
                }

                if (isCustomerQr) {
                    std::string alertTitle = (orderType == "dine_in")
                        ? ("Khách QR đặt tại bàn " + tableCode)
                        : ((orderType == "takeaway") ? ("Đơn QR Mang Về " + tableCode) : ("Đơn QR Online mới " + orderCode));
                    std::string alertMsg = (orderType == "dine_in")
                        ? ("Khách " + customerName + " đặt " + std::to_string(items.size()) + " món tại bàn " + tableCode + ". Chờ duyệt gửi Bếp.")
                        : ("Đơn " + orderCode + " (" + std::to_string(static_cast<int64_t>(totalAmount)) + "đ) đang chờ xác nhận thanh toán trước khi chuyển Bếp.");
                    createOrderAlert(db, orderId, orderCode, tableId, tableCode,
                        (orderType == "dine_in" ? "qr_table_pending" : "qr_payment_pending"),
                        alertTitle, alertMsg, "all");
                }

                // Kitchen Service Log
                std::string logAction = isAppendMode ? "add_items" : "order_created";
                std::string logLabel = isAppendMode ? "Gọi thêm món" : "Nhận order món";
                std::string logNote = "Order bàn " + tableCode + " (" + std::to_string(items.size()) + " món, " + std::to_string(static_cast<int64_t>(totalAmount)) + "đ)";

                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, :act, :lbl, :uid, :uname, :urole, 0, :note, :cat
                    )
                )", {
                    {":oid", orderId}, {":code", orderCode}, {":tcode", tableCode},
                    {":act", logAction}, {":lbl", logLabel}, {":uid", userId}, {":uname", userName},
                    {":urole", userRole}, {":note", logNote}, {":cat", nowStr}
                });

                db.commit();

                json store = getStoreInfo(db);
                std::string bankId = store.value("bank_id", "OCB");
                std::string accNo = store.value("bank_account_no", "");
                std::string accName = store.value("bank_account_name", "");
                std::string vietQrUrl;
                if (!accNo.empty()) {
                    std::stringstream vss;
                    vss << "https://img.vietqr.io/image/" << bankId << "-" << accNo
                        << "-compact2.png?amount=" << static_cast<int64_t>(totalAmount)
                        << "&addInfo=" << httplib::detail::encode_url("THANH TOAN " + orderCode)
                        << "&accountName=" << httplib::detail::encode_url(accName);
                    vietQrUrl = vss.str();
                }

                sendJson(res, {
                    {"success", true},
                    {"message", "Lưu đơn hàng thành công!"},
                    {"order_id", orderId},
                    {"order_code", orderCode},
                    {"tracking_token", orderCode},
                    {"table_id", tableId},
                    {"table_code", tableCode},
                    {"order_type", orderType},
                    {"kitchen_status", initialKitchenStatus},
                    {"payment_status", "unpaid"},
                    {"total_amount", totalAmount},
                    {"vietqr_url", vietQrUrl}
                });
                return;
            }

            // Step 3.3: Kitchen Marks Ready (Bếp báo xong món)
            if (action == "kitchen_ready") {
                int64_t orderId = 0, tableId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}

                if (orderId <= 0 && tableId > 0) {
                    auto tbl = db.queryRow("SELECT active_order_id FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tbl.is_null()) orderId = getInt(tbl, "active_order_id", 0);
                }

                if (orderId <= 0) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy hóa đơn cần báo hoàn thành!"}}, 400);
                    return;
                }

                auto ord = db.queryRow("SELECT order_code, table_code, created_at, kitchen_status, user_id, user_name, COALESCE(remind_count, 0) as remind_count FROM orders WHERE id = :id", {{":id", orderId}});
                if (ord.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Hóa đơn không tồn tại!"}}, 404);
                    return;
                }

                auto userOpt = AuthService::instance().authenticate(req);
                int64_t kUserId = userOpt.has_value() ? userOpt->id : 5;
                std::string kUserName = userOpt.has_value() ? userOpt->fullname : "Tổ Pha Chế & Bếp";
                std::string kRole = userOpt.has_value() ? userOpt->role : "kitchen";

                std::string nowStr = getCurrentTimestamp();
                std::string prevKStatus = getString(ord, "kitchen_status", "pending");
                bool wasAlreadyReady = (prevKStatus == "ready");
                ActiveSlaConfig slaCfg = getActiveSlaConfig(db);
                int prepMinutes = computeElapsedMinutesSql(db, orderId, "COALESCE(NULLIF(kitchen_sent_at, ''), created_at)");
                std::string tCode = getString(ord, "table_code", "Bàn");
                std::string oCode = getString(ord, "order_code", "");

                db.beginTransaction();
                if (wasAlreadyReady) {
                    int nextRemind = static_cast<int>(getInt(ord, "remind_count", 0)) + 1;
                    db.execute(R"(
                        UPDATE orders SET 
                            kitchen_ready_at = :kat,
                            remind_count = :rc,
                            last_reminded_at = :rat
                        WHERE id = :id AND status = 'pending'
                    )", {
                        {":kat", nowStr}, {":rc", nextRemind}, {":rat", nowStr}, {":id", orderId}
                    });
                    int penalty = std::abs(slaCfg.settings.value("kpi_waiter_remind_penalty", 3));
                    if (penalty > 0) {
                        int64_t wUid = getInt(ord, "user_id", 0);
                        std::string wUname = getString(ord, "user_name", "Phục vụ");
                        recordKpiEvent(db, wUid, wUname, "waiter", orderId, oCode, tCode, "waiter_reminded", -penalty,
                            "Bếp bấm Báo lại lần " + std::to_string(nextRemind) + " để nhắc bưng món bàn " + tCode);
                    }
                } else {
                    db.execute(R"(
                        UPDATE orders SET 
                            kitchen_status = 'ready', kitchen_ready_at = :kat,
                            kitchen_user_id = :kuid, kitchen_user_name = :kuname,
                            prep_time_minutes = :prep
                        WHERE id = :id AND status = 'pending'
                    )", {
                        {":kat", nowStr}, {":kuid", kUserId}, {":kuname", kUserName},
                        {":prep", prepMinutes}, {":id", orderId}
                    });
                    if (prepMinutes <= slaCfg.kitchenSla) {
                        int bonus = slaCfg.settings.value("kpi_kitchen_ontime_pts", 2);
                        if (bonus != 0) {
                            recordKpiEvent(db, kUserId, kUserName, "kitchen", orderId, oCode, tCode, "kitchen_ontime", bonus,
                                "Bếp hoàn thành trong " + std::to_string(prepMinutes) + "p (SLA " + std::to_string(slaCfg.kitchenSla) + "p)");
                        }
                    }
                }

                syncOrderStatus(db, orderId);

                // Ghi nhật ký bếp
                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, 'kitchen_ready', 'Bếp báo xong món', :uid, :uname, :urole, 60, :note, :cat
                    )
                )", {
                    {":oid", orderId}, {":code", oCode}, {":tcode", tCode},
                    {":uid", kUserId}, {":uname", kUserName}, {":urole", kRole},
                    {":note", "Bếp hoàn thành chế biến sau " + std::to_string(prepMinutes) + " phút"},
                    {":cat", nowStr}
                });

                // Gửi chuông thông báo phục vụ
                db.execute(R"(
                    INSERT INTO app_notifications (
                        type, order_id, table_code, title, message, is_read_waiter, is_read_cashier, created_at
                    ) VALUES (
                        'kitchen_ready', :oid, :tcode, :title, :msg, 0, 0, :cat
                    )
                )", {
                    {":oid", orderId}, {":tcode", tCode},
                    {":title", "🔔 Bếp báo xong món: " + tCode},
                    {":msg", "Món ăn bàn " + tCode + " đã chế biến xong, vui lòng bưng ra!"},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã thông báo xong món cho bàn " + tCode + " đến phục vụ!"},
                    {"table_code", tCode}
                });
                return;
            }

            // Step 3.3: Waiter Served (Phục vụ đã mang ra bàn)
            if (action == "waiter_served" || action == "kitchen_archive") {
                int64_t orderId = 0, tableId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}

                if (orderId <= 0 && tableId > 0) {
                    auto tbl = db.queryRow("SELECT active_order_id FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tbl.is_null()) orderId = getInt(tbl, "active_order_id", 0);
                }

                if (orderId <= 0) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy đơn hàng!"}}, 400);
                    return;
                }

                auto ord = db.queryRow("SELECT order_code, table_code, kitchen_ready_at, kitchen_status FROM orders WHERE id = :id", {{":id", orderId}});
                if (ord.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Đơn hàng không tồn tại!"}}, 404);
                    return;
                }

                auto userOpt = AuthService::instance().authenticate(req);
                int64_t wUserId = userOpt.has_value() ? userOpt->id : 3;
                std::string wUserName = userOpt.has_value() ? userOpt->fullname : "Nhân viên phục vụ";
                std::string wRole = userOpt.has_value() ? userOpt->role : "waiter";

                std::string nowStr = getCurrentTimestamp();
                ActiveSlaConfig slaCfg = getActiveSlaConfig(db);
                std::string kReadyAt = getString(ord, "kitchen_ready_at", "");
                int deliverMinutes = kReadyAt.empty() ? 1 : computeElapsedMinutesSql(db, orderId, "kitchen_ready_at");
                std::string tCode = getString(ord, "table_code", "Bàn");
                std::string oCode = getString(ord, "order_code", "");

                db.beginTransaction();
                db.execute(R"(
                    UPDATE orders SET 
                        kitchen_status = 'served', served_at = :sat,
                        served_user_id = :suid, served_user_name = :suname,
                        deliver_time_minutes = :deliv
                    WHERE id = :id AND status = 'pending'
                )", {
                    {":sat", nowStr}, {":suid", wUserId}, {":suname", wUserName},
                    {":deliv", deliverMinutes}, {":id", orderId}
                });

                if (deliverMinutes <= slaCfg.waiterSla) {
                    int bonus = slaCfg.settings.value("kpi_waiter_ontime_pts", 2);
                    if (bonus != 0) {
                        recordKpiEvent(db, wUserId, wUserName, "waiter", orderId, oCode, tCode, "waiter_ontime", bonus,
                            "Phục vụ bưng ra trong " + std::to_string(deliverMinutes) + "p (SLA " + std::to_string(slaCfg.waiterSla) + "p)");
                    }
                }

                syncOrderStatus(db, orderId);

                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, 'waiter_served', 'Phục vụ đã bưng ra bàn', :uid, :uname, :urole, 60, :note, :cat
                    )
                )", {
                    {":oid", orderId}, {":code", oCode}, {":tcode", tCode},
                    {":uid", wUserId}, {":uname", wUserName}, {":urole", wRole},
                    {":note", "Đã bưng ra bàn sau " + std::to_string(deliverMinutes) + " phút"},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã ghi nhận bưng món ra bàn " + tCode + " thành công!"},
                    {"table_code", tCode}
                });
                return;
            }

            // Step 3.4: Checkout & Payment (Thanh toán hóa đơn)
            if (action == "checkout" || action == "pay_order") {
                int64_t orderId = 0, tableId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}

                if (orderId <= 0 && tableId > 0) {
                    auto tbl = db.queryRow("SELECT active_order_id FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tbl.is_null()) orderId = getInt(tbl, "active_order_id", 0);
                }

                if (orderId <= 0) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy hóa đơn cần thanh toán!"}}, 400);
                    return;
                }

                auto ord = db.queryRow("SELECT * FROM orders WHERE id = :id AND status = 'pending'", {{":id", orderId}});
                if (ord.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Hóa đơn không tồn tại hoặc đã được thanh toán trước đó!"}}, 400);
                    return;
                }

                int64_t pendingVoidCnt = db.queryScalar(
                    "SELECT COUNT(*) FROM order_items WHERE order_id = :oid AND COALESCE(cancel_status, 'none') = 'pending_kitchen'",
                    {{":oid", orderId}}
                ).get<int64_t>();
                if (pendingVoidCnt > 0) {
                    sendJson(res, {{"success", false}, {"pending_void", true}, {"message", "Đơn này đang có " + std::to_string(pendingVoidCnt) + " món chờ Bếp duyệt hủy. Vui lòng để Bếp xác nhận trước khi thanh toán!"}}, 409);
                    return;
                }

                std::string paymentMethod = BodyParser::getParam(req, body, "payment_method", "cash");
                if (paymentMethod != "banking" && paymentMethod != "card") paymentMethod = "cash";

                double subtotal = getDouble(ord, "subtotal", 0.0);
                double discountValue = getDouble(ord, "discount_value", 0.0);
                try {
                    std::string dvStr = BodyParser::getParam(req, body, "discount_value");
                    if (!dvStr.empty()) discountValue = std::stod(dvStr);
                } catch (...) {}

                std::string discountType = BodyParser::getParam(req, body, "discount_type", getString(ord, "discount_type", "amount"));
                if (discountType != "percent") discountType = "amount";

                double vatPercent = getDouble(ord, "vat_percent", 0.0);
                try {
                    std::string vpStr = BodyParser::getParam(req, body, "vat_percent");
                    if (!vpStr.empty()) vatPercent = std::stod(vpStr);
                } catch (...) {}

                ensurePromotionSchema(db);
                int64_t promoId = 0;
                try {
                    std::string pidStr = BodyParser::getParam(req, body, "promo_id");
                    if (!pidStr.empty()) promoId = std::stoll(pidStr);
                } catch (...) {}
                std::string promoCode = BodyParser::getParam(req, body, "promo_code", "");
                std::string promoName = BodyParser::getParam(req, body, "promo_name", "");

                double discountAmount = 0.0;
                if (!promoCode.empty()) {
                    std::string upCode = promoCode;
                    std::transform(upCode.begin(), upCode.end(), upCode.begin(), ::toupper);
                    auto pRow = db.queryRow("SELECT * FROM promotions WHERE UPPER(code) = :c LIMIT 1", {{":c", upCode}});
                    std::string pErr;
                    if (!pRow.is_null() && isPromoEligibleNow(db, pRow, subtotal, pErr)) {
                        promoId = getInt(pRow, "id", 0);
                        promoCode = getString(pRow, "code", upCode);
                        promoName = getString(pRow, "name", "");
                        discountType = getString(pRow, "discount_type", "percent");
                        discountValue = getDouble(pRow, "discount_value", 0.0);
                        discountAmount = computePromoDiscount(pRow, subtotal);
                    } else if (discountValue > 0) {
                        discountAmount = (discountType == "percent")
                            ? (subtotal * std::min(100.0, std::max(0.0, discountValue))) / 100.0
                            : std::min(subtotal, std::max(0.0, discountValue));
                    }
                } else if (discountType == "percent") {
                    discountAmount = (subtotal * std::min(100.0, std::max(0.0, discountValue))) / 100.0;
                } else {
                    discountAmount = std::min(subtotal, std::max(0.0, discountValue));
                }

                double afterDiscount = std::max(0.0, subtotal - discountAmount);
                double vatAmount = (afterDiscount * std::max(0.0, vatPercent)) / 100.0;
                double totalAmount = afterDiscount + vatAmount;

                double cashReceived = totalAmount;
                try {
                    std::string crStr = BodyParser::getParam(req, body, "cash_received");
                    if (!crStr.empty()) cashReceived = std::stod(crStr);
                } catch (...) {}

                double changeAmount = 0.0;
                if (paymentMethod == "cash") {
                    if (cashReceived < totalAmount) cashReceived = totalAmount;
                    changeAmount = std::max(0.0, cashReceived - totalAmount);
                } else {
                    cashReceived = totalAmount;
                    changeAmount = 0.0;
                }

                auto userOpt = AuthService::instance().authenticate(req);
                int64_t cUserId = userOpt.has_value() ? userOpt->id : 1;
                std::string cUserName = userOpt.has_value() ? userOpt->fullname : "Thu ngân";
                std::string cRole = userOpt.has_value() ? userOpt->role : "cashier";

                std::string nowStr = getCurrentTimestamp();

                db.beginTransaction();
                db.execute(R"(
                    UPDATE orders SET
                        discount_type = :dt, discount_value = :dv, discount_amount = :da,
                        promo_id = :pid, promo_code = :pcode, promo_name = :pname,
                        vat_percent = :vp, vat_amount = :va, total_amount = :tot,
                        paid_amount = :tot, settlement_status = 'settled',
                        payment_method = :pm, cash_received = :cr, change_amount = :ca,
                        payment_status = 'paid', payment_verified_by = :vby, paid_at = :pat
                    WHERE id = :id
                )", {
                    {":dt", discountType}, {":dv", discountValue}, {":da", discountAmount},
                    {":pid", promoId}, {":pcode", promoCode}, {":pname", promoName},
                    {":vp", vatPercent}, {":va", vatAmount}, {":tot", totalAmount},
                    {":pm", paymentMethod}, {":cr", cashReceived}, {":ca", changeAmount},
                    {":vby", cUserName}, {":pat", nowStr}, {":id", orderId}
                });
                db.execute(R"(
                    INSERT INTO payment_transactions (order_id, order_code, tx_type, method, amount, verified_by, note, created_at)
                    VALUES (:oid, :oc, 'pay', :pm, :amt, :vby, 'Thanh toán tại quầy POS', :cat)
                )", {
                    {":oid", orderId}, {":oc", getString(ord, "order_code", "")},
                    {":pm", paymentMethod}, {":amt", totalAmount}, {":vby", cUserName}, {":cat", nowStr}
                });

                // Evaluate 3 factors
                syncOrderStatus(db, orderId);

                // Fetch completed order & items
                auto completedOrder = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
                json items = db.query("SELECT * FROM order_items WHERE order_id = :id ORDER BY id ASC", {{":id", orderId}});

                // Log checkout
                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, 'checkout', 'Thanh toán hoàn tất', :uid, :uname, :urole, 0, :note, :cat
                    )
                )", {
                    {":oid", orderId}, {":code", getString(completedOrder, "order_code", "")}, {":tcode", getString(completedOrder, "table_code", "")},
                    {":uid", cUserId}, {":uname", cUserName}, {":urole", cRole},
                    {":note", "Đã thanh toán " + std::to_string(static_cast<int64_t>(totalAmount)) + "đ (" + paymentMethod + ")"},
                    {":cat", nowStr}
                });

                // Kiểm toán nội bộ: Nếu hóa đơn có áp dụng Giảm giá thủ công, tự động ghi vào audit_logs
                if (discountAmount > 0) {
                    std::string discReason = BodyParser::getParam(req, body, "discount_reason", getString(ord, "note", "Áp dụng chiết khấu tại quầy"));
                    if (discReason.empty()) discReason = "Áp dụng chiết khấu tại quầy";
                    bool isHighDisc = (discountAmount >= 50000.0) || (discountType == "percent" && discountValue >= 20.0);
                    db.execute(R"(
                        INSERT INTO audit_logs (
                            action_code, action_label, severity, order_id, order_code, table_code,
                            amount_impact, reason, user_id, user_name, user_role, details, created_at
                        ) VALUES (
                            'MANUAL_DISCOUNT', :albl, :sev, :oid, :ocode, :tcode,
                            :amt, :rsn, :uid, :uname, :urole, :dtl, :cat
                        )
                    )", {
                        {":albl", "Giảm giá hóa đơn bàn " + getString(completedOrder, "table_code", "")},
                        {":sev", isHighDisc ? "CRITICAL" : "WARN"},
                        {":oid", orderId},
                        {":ocode", getString(completedOrder, "order_code", "")},
                        {":tcode", getString(completedOrder, "table_code", "")},
                        {":amt", discountAmount},
                        {":rsn", discReason},
                        {":uid", cUserId},
                        {":uname", cUserName},
                        {":urole", cRole},
                        {":dtl", "Giảm " + std::to_string(static_cast<int64_t>(discountAmount)) + "đ trên tổng " + std::to_string(static_cast<int64_t>(subtotal)) + "đ"},
                        {":cat", nowStr}
                    });
                }
                db.commit();

                // [Cross-Module Orchestration]: Phát sự kiện toàn cục ORDER_PAID cho các Module Plugin (Media Stream & Network QoS)
                try {
                    json orderPaidEvt = {
                        {"order_id", orderId},
                        {"order_code", getString(completedOrder, "order_code", "")},
                        {"table_code", getString(completedOrder, "table_code", "")},
                        {"table_name", getString(completedOrder, "table_code", "")},
                        {"total_amount", totalAmount},
                        {"payment_method", paymentMethod}
                    };
                    CyberNexus::PluginManager::instance().dispatchEvent("ORDER_PAID", orderPaidEvt);
                } catch (...) {}

                json store = getStoreInfo(db);
                json vietQrUrl = nullptr;
                if (paymentMethod == "banking") {
                    std::stringstream ss;
                    ss << "https://img.vietqr.io/image/" << store.value("bank_id", "OCB") << "-"
                       << store.value("bank_account_no", "0918608073") << "-compact2.png?amount="
                       << static_cast<int64_t>(totalAmount) << "&addInfo=TT%20"
                       << getString(completedOrder, "order_code", "") << "&accountName="
                       << store.value("bank_account_name", "NGUYEN CHI HUNG");
                    vietQrUrl = ss.str();
                }

                sendJson(res, {
                    {"success", true},
                    {"message", "Thanh toán hóa đơn thành công!"},
                    {"order", completedOrder},
                    {"items", items},
                    {"store", store},
                    {"vietqr_url", vietQrUrl}
                });
                return;
            }

            // Confirm Online / Takeaway Order Delivered
            if (action == "online_order_delivered") {
                int64_t orderId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                auto order = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
                if (order.is_null()) {
                    sendError(res, "Hóa đơn không tồn tại!", 404);
                    return;
                }

                std::string nowStr = getCurrentTimestamp();
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 1;
                std::string uName = userOpt ? userOpt->fullname : "Nhân viên";
                std::string uRole = userOpt ? userOpt->role : "cashier";

                db.beginTransaction();
                db.execute("UPDATE orders SET kitchen_status = 'served', served_at = COALESCE(served_at, :sat) WHERE id = :id",
                           {{":sat", nowStr}, {":id", orderId}});
                syncOrderStatus(db, orderId);

                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, 'online_delivered', 'Bàn giao đơn online/mang về', :uid, :uname, :urole, 0, 'Đã bàn giao thực tế cho khách', :cat
                    )
                )", {
                    {":oid", orderId},
                    {":code", getString(order, "order_code", "")},
                    {":tcode", getString(order, "table_code", "MV")},
                    {":uid", uId},
                    {":uname", uName},
                    {":urole", uRole},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {{"success", true}, {"message", "Đã xác nhận bàn giao đơn cho khách!"}});
                return;
            }

            // Khách báo đã chuyển khoản VietQR (chuyển sang chờ đối soát, KHÔNG tự động paid)
            if (action == "customer_mark_transfer") {
                std::string oCode = BodyParser::getParam(req, body, "order_code", "");
                auto ord = db.queryRow("SELECT * FROM orders WHERE order_code = :oc LIMIT 1", {{":oc", oCode}});
                if (ord.is_null()) {
                    sendError(res, "Không tìm thấy đơn hàng!", 404);
                    return;
                }
                if (getString(ord, "payment_status", "unpaid") != "paid") {
                    db.execute("UPDATE orders SET payment_status = 'verifying', payment_method = 'banking' WHERE id = :id", {{":id", getInt(ord, "id", 0)}});
                    createOrderAlert(db, getInt(ord, "id", 0), oCode, getInt(ord, "table_id", 0), getString(ord, "table_code", ""),
                        "payment_verifying", "Khách báo đã CK " + oCode,
                        "Khách báo đã chuyển khoản " + std::to_string(static_cast<int64_t>(getDouble(ord, "total_amount", 0.0))) + "đ cho đơn " + oCode + ". Vui lòng kiểm tra số dư và xác nhận!",
                        "cashier");
                }
                sendJson(res, {{"success", true}, {"payment_status", "verifying"}, {"message", "Đã gửi thông báo chờ Thu ngân đối soát chuyển khoản!"}});
                return;
            }

            // Thu ngân xác nhận thanh toán thủ công (Tiền mặt / CK / Duyệt Ship COD)
            if (action == "confirm_payment") {
                int64_t orderId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                auto ord = db.queryRow("SELECT * FROM orders WHERE id = :id LIMIT 1", {{":id", orderId}});
                if (ord.is_null()) {
                    sendError(res, "Không tìm thấy đơn hàng!", 404);
                    return;
                }
                auto userOpt = AuthService::instance().authenticate(req);
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string mode = BodyParser::getParam(req, body, "mode", "paid"); // paid | cod_approved
                std::string method = BodyParser::getParam(req, body, "payment_method", "banking");
                std::string bankRef = BodyParser::getParam(req, body, "bank_ref", "");
                bool pushToKitchen = (BodyParser::getParam(req, body, "push_to_kitchen", "0") == "1" || (body.contains("push_to_kitchen") && body["push_to_kitchen"].is_boolean() && body["push_to_kitchen"].get<bool>()));
                std::string nowStr = getCurrentTimestamp();
                double totAmt = getDouble(ord, "total_amount", 0.0);

                db.beginTransaction();
                if (mode == "cod_approved") {
                    db.execute("UPDATE orders SET payment_status = 'cod_approved', payment_method = 'cod', payment_verified_by = :vby WHERE id = :id",
                        {{":vby", uName}, {":id", orderId}});
                } else {
                    db.execute(R"(
                        UPDATE orders SET
                            payment_status = 'paid', payment_method = :pm, paid_amount = :tot,
                            settlement_status = 'settled', payment_verified_by = :vby,
                            bank_ref = :bref, paid_at = COALESCE(paid_at, :pat)
                        WHERE id = :id
                    )", {
                        {":pm", method}, {":tot", totAmt}, {":vby", uName}, {":bref", bankRef}, {":pat", nowStr}, {":id", orderId}
                    });
                    db.execute(R"(
                        INSERT INTO payment_transactions (order_id, order_code, tx_type, method, amount, bank_ref, verified_by, note, created_at)
                        VALUES (:oid, :oc, 'pay', :pm, :amt, :bref, :vby, 'Thu ngân xác nhận thanh toán đơn QR/Online', :cat)
                    )", {
                        {":oid", orderId}, {":oc", getString(ord, "order_code", "")}, {":pm", method},
                        {":amt", totAmt}, {":bref", bankRef}, {":vby", uName}, {":cat", nowStr}
                    });
                }
                if (pushToKitchen) {
                    db.execute("UPDATE orders SET kitchen_status = 'pending' WHERE id = :id AND COALESCE(kitchen_status, 'pending') IN ('awaiting_payment', 'awaiting_waiter', 'awaiting_kitchen_push')",
                        {{":id", orderId}});
                }
                db.execute("UPDATE order_alerts SET is_ack = 1, ack_by = :by, ack_at = :at WHERE order_id = :oid AND alert_type IN ('qr_payment_pending', 'payment_verifying')",
                    {{":by", uName}, {":at", nowStr}, {":oid", orderId}});
                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", mode == "cod_approved" ? "Đã duyệt Ship COD! Có thể chuyển Bếp ngay." : (pushToKitchen ? "Đã xác nhận nhận tiền & Chuyển Bếp!" : "Đã xác nhận nhận tiền! Nút Chuyển Bếp đã mở khóa.")}
                });
                return;
            }

            // Cổng kiểm soát Chuyển Bếp (Gatekeeper: chỉ mở khi đã TT hoặc duyệt COD hoặc Tại bàn)
            if (action == "send_to_kitchen" || action == "waiter_confirm_customer_order") {
                int64_t orderId = 0, tableId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}
                if (orderId <= 0 && tableId > 0) {
                    auto tbl = db.queryRow("SELECT active_order_id FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tbl.is_null()) orderId = getInt(tbl, "active_order_id", 0);
                }
                auto ord = db.queryRow("SELECT * FROM orders WHERE id = :id AND status = 'pending'", {{":id", orderId}});
                if (ord.is_null()) {
                    sendError(res, "Không tìm thấy đơn hàng chờ duyệt!", 404);
                    return;
                }
                std::string oType = getString(ord, "order_type", "pos");
                std::string pStatus = getString(ord, "payment_status", "unpaid");
                bool isDineIn = (oType == "dine_in" || (getInt(ord, "table_id", 0) > 0 && oType != "takeaway" && getString(ord, "table_code", "").rfind("MV", 0) != 0));
                if (!isDineIn && pStatus != "paid" && pStatus != "cod_approved") {
                    sendJson(res, {{"success", false}, {"payment_required", true}, {"message", "Đơn Mang Về / Online chưa xác nhận thanh toán! Vui lòng xác nhận tiền vào hoặc duyệt COD trước khi Chuyển Bếp."}}, 400);
                    return;
                }
                auto userOpt = AuthService::instance().authenticate(req);
                std::string uName = userOpt ? userOpt->fullname : "Nhân viên";
                std::string nowStr = getCurrentTimestamp();
                db.beginTransaction();
                db.execute("UPDATE orders SET kitchen_status = 'pending', kitchen_sent_at = COALESCE(NULLIF(kitchen_sent_at, ''), :ksent) WHERE id = :id", {{":ksent", nowStr}, {":id", orderId}});
                db.execute("UPDATE order_alerts SET is_ack = 1, ack_by = :by, ack_at = :at WHERE order_id = :oid AND alert_type = 'qr_table_pending'",
                    {{":by", uName}, {":at", nowStr}, {":oid", orderId}});
                db.commit();
                sendJson(res, {{"success", true}, {"message", "Đã duyệt đơn và chuyển xuống Bếp thành công!"}});
                return;
            }

            // Phục vụ / Thu ngân bấm "Hối" khi đơn chờ Bếp quá lâu (>= 10 phút)
            if (action == "rush_kitchen") {
                int64_t orderId = 0, tableId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}
                if (orderId <= 0 && tableId > 0) {
                    auto tbl = db.queryRow("SELECT active_order_id FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tbl.is_null()) orderId = getInt(tbl, "active_order_id", 0);
                }
                auto ord = db.queryRow("SELECT * FROM orders WHERE id = :id AND status = 'pending'", {{":id", orderId}});
                if (ord.is_null()) {
                    sendError(res, "Không tìm thấy đơn hàng đang chờ Bếp!", 404);
                    return;
                }
                auto userOpt = AuthService::instance().authenticate(req);
                std::string uName = userOpt ? userOpt->fullname : "Nhân viên";
                std::string nowStr = getCurrentTimestamp();
                int nextRush = static_cast<int>(getInt(ord, "rush_count", 0)) + 1;

                ActiveSlaConfig slaCfg = getActiveSlaConfig(db);
                int kPenalty = std::abs(slaCfg.settings.value("kpi_kitchen_rush_penalty", 5));
                int64_t kUid = getInt(ord, "kitchen_user_id", 0);
                std::string kUname = getString(ord, "kitchen_user_name", "Tổ Pha Chế & Bếp");
                if (kUname.empty()) kUname = "Tổ Pha Chế & Bếp";

                db.beginTransaction();
                db.execute(
                    "UPDATE orders SET rush_count = :rc, last_rushed_at = :at, last_rushed_by = :by WHERE id = :id",
                    {{":rc", nextRush}, {":at", nowStr}, {":by", uName}, {":id", orderId}}
                );
                if (kPenalty > 0) {
                    recordKpiEvent(db, kUid, kUname, "kitchen", orderId, getString(ord, "order_code", ""), getString(ord, "table_code", ""),
                        "kitchen_rushed", -kPenalty, uName + " hối Bếp lần " + std::to_string(nextRush) + " (quá SLA " + std::to_string(slaCfg.kitchenSla) + "p)");
                }
                db.execute(
                    "INSERT INTO order_alerts (order_id, order_code, table_id, table_code, alert_type, title, message, target_role, created_at) "
                    "VALUES (:oid, :ocode, :tid, :tcode, 'kitchen_rush', :title, :msg, 'kitchen', :at)",
                    {
                        {":oid", orderId},
                        {":ocode", getString(ord, "order_code", "")},
                        {":tid", getInt(ord, "table_id", 0)},
                        {":tcode", getString(ord, "table_code", "")},
                        {":title", "🔥 HỐI MÓN BÀN " + getString(ord, "table_code", "")},
                        {":msg", uName + " hối Bếp lần " + std::to_string(nextRush) + " (khách đợi lâu)"},
                        {":at", nowStr}
                    }
                );
                db.commit();
                sendJson(res, {
                    {"success", true},
                    {"rush_count", nextRush},
                    {"last_rushed_at", nowStr},
                    {"last_rushed_by", uName},
                    {"message", "Đã gửi lệnh HỐI xuống Bếp!"}
                });
                return;
            }

            // Khách hàng đánh giá Sao sau khi hoàn thành đơn
            if (action == "submit_review") {
                ensureOrderWorkflowSchema(db);
                std::string orderCode = BodyParser::getParam(req, body, "order_code", BodyParser::getParam(req, body, "token", ""));
                int64_t orderId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                int rating = 0;
                try { rating = std::stoi(BodyParser::getParam(req, body, "rating", "0")); } catch (...) {}
                std::string comment = BodyParser::getParam(req, body, "comment", "");
                if (rating < 1 || rating > 5) {
                    sendError(res, "Vui lòng chọn số sao từ 1 đến 5!", 400);
                    return;
                }
                auto ord = (orderId > 0)
                    ? db.queryRow("SELECT * FROM orders WHERE id = :id LIMIT 1", {{":id", orderId}})
                    : db.queryRow("SELECT * FROM orders WHERE order_code = :c LIMIT 1", {{":c", orderCode}});
                if (ord.is_null()) {
                    sendError(res, "Không tìm thấy đơn hàng!", 404);
                    return;
                }
                orderId = getInt(ord, "id", 0);
                orderCode = getString(ord, "order_code", "");
                std::string tCode = getString(ord, "table_code", "");
                auto existingRev = db.queryRow("SELECT id FROM order_reviews WHERE order_id = :oid", {{":oid", orderId}});
                if (!existingRev.is_null()) {
                    sendError(res, "Đơn hàng này đã được đánh giá trước đó!", 400);
                    return;
                }

                ActiveSlaConfig slaCfg = getActiveSlaConfig(db);
                std::string starCol = "kpi_star_" + std::to_string(rating) + "_pts";
                int starPts = slaCfg.settings.value(starCol, rating == 5 ? 5 : (rating == 4 ? 2 : (rating == 3 ? 0 : (rating == 2 ? -3 : -5))));
                std::string nowStr = getCurrentTimestamp();

                db.beginTransaction();
                db.execute("INSERT INTO order_reviews (order_id, order_code, table_code, rating, comment, created_at) VALUES (:oid, :ocode, :tcode, :rat, :cmt, :cat)", {
                    {":oid", orderId}, {":ocode", orderCode}, {":tcode", tCode}, {":rat", rating}, {":cmt", comment}, {":cat", nowStr}
                });
                db.execute("UPDATE orders SET customer_rating = :rat, customer_review_note = :cmt, customer_reviewed_at = :cat WHERE id = :id", {
                    {":rat", rating}, {":cmt", comment}, {":cat", nowStr}, {":id", orderId}
                });
                if (starPts != 0) {
                    int64_t wUid = getInt(ord, "served_user_id", 0);
                    std::string wUname = getString(ord, "served_user_name", "");
                    if (wUid <= 0) {
                        wUid = getInt(ord, "user_id", 0);
                        wUname = getString(ord, "user_name", "Phục vụ");
                    }
                    recordKpiEvent(db, wUid, wUname, "waiter", orderId, orderCode, tCode, "customer_rating", starPts,
                        "Khách đánh giá " + std::to_string(rating) + "⭐" + (comment.empty() ? "" : (": " + comment)));
                    int64_t kUid = getInt(ord, "kitchen_user_id", 0);
                    std::string kUname = getString(ord, "kitchen_user_name", "");
                    if (kUid > 0 && kUid != wUid) {
                        recordKpiEvent(db, kUid, kUname, "kitchen", orderId, orderCode, tCode, "customer_rating", starPts,
                            "Khách đánh giá " + std::to_string(rating) + "⭐" + (comment.empty() ? "" : (": " + comment)));
                    }
                }
                db.commit();
                sendJson(res, {
                    {"success", true},
                    {"rating", rating},
                    {"points_delta", starPts},
                    {"message", "Cảm ơn quý khách đã đánh giá!"}
                });
                return;
            }

            // Cập nhật ghi chú món (đồng bộ với order.html)
            if (action == "update_item_note") {
                int64_t itemId = 0;
                try { itemId = std::stoll(BodyParser::getParam(req, body, "item_id", "0")); } catch (...) {}
                std::string itemNote = BodyParser::getParam(req, body, "note", "");
                if (itemId <= 0) {
                    sendError(res, "Thiếu item_id!", 400);
                    return;
                }
                db.execute("UPDATE order_items SET note = :n WHERE id = :id", {{":n", itemNote}, {":id", itemId}});
                sendJson(res, {{"success", true}, {"message", "Đã cập nhật ghi chú món gửi Bếp!"}});
                return;
            }

            // Phục vụ / Thu ngân gửi yêu cầu Hủy 1 món xuống Bếp duyệt (KHÔNG nhét vào note)
            if (action == "request_cancel_item") {
                int64_t itemId = 0;
                try { itemId = std::stoll(BodyParser::getParam(req, body, "item_id", "0")); } catch (...) {}
                std::string reason = BodyParser::getParam(req, body, "reason", "Khách xin hủy");
                if (itemId <= 0) {
                    sendError(res, "Thiếu item_id!", 400);
                    return;
                }
                auto it = db.queryRow("SELECT oi.*, o.order_code, o.table_id, o.table_code, o.kitchen_status FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = :id", {{":id", itemId}});
                if (it.is_null()) {
                    sendError(res, "Không tìm thấy món trên hóa đơn!", 404);
                    return;
                }
                auto userOpt = AuthService::instance().authenticate(req);
                std::string uName = userOpt ? userOpt->fullname : "Phục vụ";
                std::string nowStr = getCurrentTimestamp();
                int64_t ordId = getInt(it, "order_id", 0);
                std::string pName = getString(it, "product_name", "Món");
                std::string tCode = getString(it, "table_code", "");
                std::string oCode = getString(it, "order_code", "");

                db.beginTransaction();
                db.execute(R"(
                    UPDATE order_items SET
                        cancel_status = 'pending_kitchen',
                        cancel_reason = :rsn,
                        cancel_requested_by = :by,
                        cancel_requested_at = :at
                    WHERE id = :id
                )", {{":rsn", reason}, {":by", uName}, {":at", nowStr}, {":id", itemId}});
                createOrderAlert(db, ordId, oCode, getInt(it, "table_id", 0), tCode,
                    "item_cancel_requested", "Xin hủy món: " + pName + " (" + tCode + ")",
                    uName + " gửi yêu cầu hủy \"" + pName + "\" (" + reason + "). Chờ Bếp xác nhận.", "all");
                db.commit();
                sendJson(res, {{"success", true}, {"message", "Đã gửi yêu cầu xin hủy \"" + pName + "\" đến Bếp & Thu ngân!"}});
                return;
            }

            // Bếp duyệt hoặc từ chối hủy 1 món (tự động tính hoàn tiền nếu đơn đã thanh toán!)
            if (action == "kitchen_cancel_item" || action == "kitchen_reject_cancel_item" || action == "kitchen_resolve_cancel_item") {
                int64_t itemId = 0;
                try { itemId = std::stoll(BodyParser::getParam(req, body, "item_id", "0")); } catch (...) {}
                std::string decision = (action == "kitchen_reject_cancel_item") ? "reject" : BodyParser::getParam(req, body, "decision", "approve");
                std::string reason = BodyParser::getParam(req, body, "reason", decision == "approve" ? "Bếp đồng ý hủy" : "Bếp đã làm xong / đang chế biến");
                if (itemId <= 0) {
                    sendError(res, "Thiếu item_id!", 400);
                    return;
                }
                auto it = db.queryRow("SELECT oi.*, o.order_code, o.table_id, o.table_code, o.paid_amount, o.payment_status FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = :id", {{":id", itemId}});
                if (it.is_null()) {
                    sendError(res, "Không tìm thấy món!", 404);
                    return;
                }
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 1;
                std::string uName = userOpt ? userOpt->fullname : "Bếp";
                std::string uRole = userOpt ? userOpt->role : "kitchen";
                std::string nowStr = getCurrentTimestamp();
                int64_t ordId = getInt(it, "order_id", 0);
                int64_t tId = getInt(it, "table_id", 0);
                std::string tCode = getString(it, "table_code", "");
                std::string oCode = getString(it, "order_code", "");
                std::string pName = getString(it, "product_name", "Món");
                double lineSub = getDouble(it, "subtotal", 0.0);

                db.beginTransaction();
                if (decision == "approve") {
                    db.execute(R"(
                        UPDATE order_items SET
                            cancel_status = 'approved',
                            cancel_reason = :rsn,
                            cancel_resolved_by = :by,
                            cancel_resolved_at = :at
                        WHERE id = :id
                    )", {{":rsn", reason}, {":by", uName}, {":at", nowStr}, {":id", itemId}});

                    json recalc = recalculateOrderTotalsAndSettlement(db, ordId);
                    int64_t activeLeft = recalc.value("active_items", int64_t(0));
                    std::string settleSt = recalc.value("settlement_status", "settled");
                    double paidAmt = recalc.value("paid_amount", 0.0);
                    double newTot = recalc.value("total_amount", 0.0);

                    if (activeLeft <= 0) {
                        db.execute("UPDATE orders SET status = 'cancelled' WHERE id = :id", {{":id", ordId}});
                        if (tId > 0 && settleSt != "refund_due") {
                            db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :id", {{":id", tId}});
                        }
                    }

                    std::string alertMsg = "Bếp ĐỒNG Ý hủy \"" + pName + "\" bàn " + tCode + ".";
                    if (settleSt == "refund_due") {
                        double refAmt = paidAmt - newTot;
                        alertMsg += " Đơn đã thanh toán trước -> CẦN HOÀN LẠI KHÁCH " + std::to_string(static_cast<int64_t>(refAmt)) + "đ!";
                    }
                    createOrderAlert(db, ordId, oCode, tId, tCode, (settleSt == "refund_due" ? "refund_due" : "item_cancel_approved"),
                        "Bếp duyệt hủy " + pName + " (" + tCode + ")", alertMsg, "all");

                    db.execute(R"(
                        INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                        VALUES ('VOID_ITEM_APPROVED', :lbl, 'WARN', :oid, :oc, :tc, :amt, :rsn, :uid, :un, :ur, :dtl, :cat)
                    )", {
                        {":lbl", "Bếp duyệt hủy món " + pName + " (" + tCode + ")"},
                        {":oid", ordId}, {":oc", oCode}, {":tc", tCode}, {":amt", lineSub}, {":rsn", reason},
                        {":uid", uId}, {":un", uName}, {":ur", uRole}, {":dtl", alertMsg}, {":cat", nowStr}
                    });
                } else {
                    db.execute(R"(
                        UPDATE order_items SET
                            cancel_status = 'rejected',
                            cancel_reason = :rsn,
                            cancel_resolved_by = :by,
                            cancel_resolved_at = :at
                        WHERE id = :id
                    )", {{":rsn", reason}, {":by", uName}, {":at", nowStr}, {":id", itemId}});

                    createOrderAlert(db, ordId, oCode, tId, tCode, "item_cancel_rejected",
                        "Bếp TỪ CHỐI hủy " + pName + " (" + tCode + ")",
                        "Bếp không thể hủy \"" + pName + "\" (" + reason + "). Món vẫn giữ trên hóa đơn.", "all");
                }
                db.execute("UPDATE order_alerts SET is_ack = 1, ack_by = :by, ack_at = :at WHERE order_id = :oid AND alert_type = 'item_cancel_requested'",
                    {{":by", uName}, {":at", nowStr}, {":oid", ordId}});
                db.commit();

                sendJson(res, {{"success", true}, {"message", decision == "approve" ? "Đã đồng ý hủy món & cập nhật hóa đơn!" : "Đã từ chối hủy món & báo lại Phục vụ/Thu ngân!"}});
                return;
            }

            // Bếp báo Hết món (khóa thực đơn tùy chọn + trừ tiền + cảnh báo hoàn tiền nếu đã TT)
            if (action == "kitchen_out_of_stock") {
                int64_t itemId = 0;
                try { itemId = std::stoll(BodyParser::getParam(req, body, "item_id", "0")); } catch (...) {}
                bool lockProduct = (BodyParser::getParam(req, body, "lock_product", "1") != "0");
                if (body.contains("lock_product") && body["lock_product"].is_boolean()) lockProduct = body["lock_product"].get<bool>();
                std::string reason = BodyParser::getParam(req, body, "reason", "Bếp báo hết nguyên liệu");

                auto it = db.queryRow("SELECT oi.*, o.order_code, o.table_id, o.table_code FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = :id", {{":id", itemId}});
                if (it.is_null()) {
                    sendError(res, "Không tìm thấy món!", 404);
                    return;
                }
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 1;
                std::string uName = userOpt ? userOpt->fullname : "Bếp";
                std::string uRole = userOpt ? userOpt->role : "kitchen";
                std::string nowStr = getCurrentTimestamp();
                int64_t ordId = getInt(it, "order_id", 0);
                int64_t prodId = getInt(it, "product_id", 0);
                int64_t tId = getInt(it, "table_id", 0);
                std::string tCode = getString(it, "table_code", "");
                std::string oCode = getString(it, "order_code", "");
                std::string pName = getString(it, "product_name", "Món");

                db.beginTransaction();
                db.execute("UPDATE order_items SET cancel_status = 'out_of_stock', cancel_reason = :rsn, cancel_resolved_by = :by, cancel_resolved_at = :at WHERE id = :id",
                    {{":rsn", reason}, {":by", uName}, {":at", nowStr}, {":id", itemId}});
                if (lockProduct && prodId > 0) {
                    db.execute("UPDATE products SET status = 'out_of_stock' WHERE id = :pid", {{":pid", prodId}});
                }
                json recalc = recalculateOrderTotalsAndSettlement(db, ordId);
                std::string settleSt = recalc.value("settlement_status", "settled");
                double refAmt = std::max(0.0, recalc.value("paid_amount", 0.0) - recalc.value("total_amount", 0.0));
                if (recalc.value("active_items", int64_t(0)) <= 0) {
                    db.execute("UPDATE orders SET status = 'cancelled' WHERE id = :id", {{":id", ordId}});
                }

                std::string msg = "Bếp báo HẾT \"" + pName + "\" bàn " + tCode + " (" + reason + "). Mời khách đổi món.";
                if (settleSt == "refund_due") {
                    msg += " Đơn đã TT -> Cần hoàn lại " + std::to_string(static_cast<int64_t>(refAmt)) + "đ!";
                }
                createOrderAlert(db, ordId, oCode, tId, tCode, (settleSt == "refund_due" ? "refund_due" : "out_of_stock"),
                    "Bếp báo HẾT món: " + pName + " (" + tCode + ")", msg, "all");
                db.execute(R"(
                    INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                    VALUES ('KITCHEN_OUT_OF_STOCK', :lbl, 'WARN', :oid, :oc, :tc, :amt, :rsn, :uid, :un, :ur, :dtl, :cat)
                )", {
                    {":lbl", "Bếp báo hết món " + pName + " (" + tCode + ")"},
                    {":oid", ordId}, {":oc", oCode}, {":tc", tCode}, {":amt", getDouble(it, "subtotal", 0.0)}, {":rsn", reason},
                    {":uid", uId}, {":un", uName}, {":ur", uRole}, {":dtl", msg}, {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {{"success", true}, {"message", msg}, {"settlement", recalc}});
                return;
            }

            // Bếp gửi yêu cầu Hủy Cả Đơn lên Thu ngân (không tự xóa thẳng hóa đơn)
            if (action == "kitchen_request_cancel_order") {
                int64_t orderId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                std::string reason = BodyParser::getParam(req, body, "reason", "");
                if (orderId <= 0 || reason.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng chọn hoặc nhập lý do yêu cầu hủy đơn!"}}, 400);
                    return;
                }
                auto ord = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
                if (ord.is_null()) {
                    sendError(res, "Không tìm thấy hóa đơn!", 404);
                    return;
                }
                auto userOpt = AuthService::instance().authenticate(req);
                std::string uName = userOpt ? userOpt->fullname : "Bếp";
                std::string nowStr = getCurrentTimestamp();
                std::string oCode = getString(ord, "order_code", "");
                std::string tCode = getString(ord, "table_code", "");

                db.beginTransaction();
                db.execute(R"(
                    UPDATE orders SET
                        kitchen_status = 'cancel_requested',
                        cancel_request_reason = :rsn,
                        cancel_requested_by = :by,
                        cancel_requested_at = :at
                    WHERE id = :id
                )", {{":rsn", reason}, {":by", uName}, {":at", nowStr}, {":id", orderId}});
                createOrderAlert(db, orderId, oCode, getInt(ord, "table_id", 0), tCode, "order_cancel_requested",
                    "Bếp yêu cầu HỦY ĐƠN " + tCode + " (" + oCode + ")",
                    "Bếp đề nghị hủy đơn vì: " + reason + ". Thu ngân vui lòng kiểm tra & chốt hủy (hoặc hoàn tiền nếu đã thu).",
                    "all");
                db.commit();

                sendJson(res, {{"success", true}, {"message", "Đã gửi yêu cầu hủy đơn " + oCode + " lên Thu ngân & Phục vụ!"}});
                return;
            }

            // Thu ngân quyết toán chênh lệch Thu thêm (extra_due) hoặc Hoàn tiền (refund_due)
            if (action == "settle_delta") {
                int64_t orderId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                std::string method = BodyParser::getParam(req, body, "payment_method", "cash");
                std::string noteStr = BodyParser::getParam(req, body, "note", "");
                auto ord = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
                if (ord.is_null()) {
                    sendError(res, "Không tìm thấy đơn hàng!", 404);
                    return;
                }
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 1;
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string uRole = userOpt ? userOpt->role : "cashier";
                std::string nowStr = getCurrentTimestamp();

                double totAmt = getDouble(ord, "total_amount", 0.0);
                double paidAmt = getDouble(ord, "paid_amount", 0.0);
                double diff = totAmt - paidAmt;
                std::string txType = (diff >= 0) ? "extra" : "refund";
                double absAmt = std::abs(diff);
                std::string oCode = getString(ord, "order_code", "");
                std::string tCode = getString(ord, "table_code", "");
                int64_t tId = getInt(ord, "table_id", 0);
                std::string st = getString(ord, "status", "pending");

                db.beginTransaction();
                db.execute("UPDATE orders SET paid_amount = total_amount, settlement_status = :ss WHERE id = :id",
                    {{":ss", (st == "cancelled" ? "refunded" : "settled")}, {":id", orderId}});
                if (absAmt > 0.5) {
                    db.execute(R"(
                        INSERT INTO payment_transactions (order_id, order_code, tx_type, method, amount, verified_by, note, created_at)
                        VALUES (:oid, :oc, :tt, :pm, :amt, :vby, :nt, :cat)
                    )", {
                        {":oid", orderId}, {":oc", oCode}, {":tt", txType}, {":pm", method},
                        {":amt", absAmt}, {":vby", uName},
                        {":nt", noteStr.empty() ? (txType == "refund" ? "Hoàn tiền cho khách" : "Thu thêm chênh lệch đổi/thêm món") : noteStr},
                        {":cat", nowStr}
                    });
                    db.execute(R"(
                        INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                        VALUES (:ac, :lbl, 'WARN', :oid, :oc, :tc, :amt, :rsn, :uid, :un, :ur, :dtl, :cat)
                    )", {
                        {":ac", txType == "refund" ? "SETTLE_REFUND" : "SETTLE_EXTRA"},
                        {":lbl", (txType == "refund" ? "Hoàn tiền khách " : "Thu thêm tiền ") + tCode},
                        {":oid", orderId}, {":oc", oCode}, {":tc", tCode}, {":amt", absAmt},
                        {":rsn", noteStr.empty() ? txType : noteStr},
                        {":uid", uId}, {":un", uName}, {":ur", uRole}, {":dtl", "Phương thức: " + method}, {":cat", nowStr}
                    });
                }
                if (st == "cancelled" && tId > 0) {
                    db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :id AND active_order_id = :oid",
                        {{":id", tId}, {":oid", orderId}});
                }
                db.execute("UPDATE order_alerts SET is_ack = 1, ack_by = :by, ack_at = :at WHERE order_id = :oid AND alert_type IN ('extra_due', 'refund_due')",
                    {{":by", uName}, {":at", nowStr}, {":oid", orderId}});
                db.commit();

                sendJson(res, {{"success", true}, {"message", txType == "refund" ? "Đã xác nhận hoàn tiền cho khách!" : "Đã xác nhận thu thêm tiền thành công!"}});
                return;
            }

            // Đánh dấu đã xử lý / đã báo khách thông báo biến động đơn
            if (action == "ack_alert") {
                int64_t alertId = 0;
                try { alertId = std::stoll(BodyParser::getParam(req, body, "alert_id", "0")); } catch (...) {}
                auto userOpt = AuthService::instance().authenticate(req);
                std::string uName = userOpt ? userOpt->fullname : "Nhân viên";
                if (alertId > 0) {
                    db.execute("UPDATE order_alerts SET is_ack = 1, ack_by = :by, ack_at = :at WHERE id = :id",
                        {{":by", uName}, {":at", getCurrentTimestamp()}, {":id", alertId}});
                }
                sendJson(res, {{"success", true}});
                return;
            }

            // Cancel order (Bắt buộc ghi nhận Lý do vào Nhật ký Kiểm toán audit_logs)
            if (action == "cancel_order") {
                int64_t orderId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                std::string reason = BodyParser::getParam(req, body, "reason", "");
                if (reason.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng nhập lý do hủy hóa đơn để ghi nhận Kiểm toán!"}}, 400);
                    return;
                }

                auto order = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
                if (order.is_null()) {
                    sendError(res, "Hóa đơn không tồn tại!", 404);
                    return;
                }

                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 1;
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string uRole = userOpt ? userOpt->role : "cashier";
                std::string nowStr = getCurrentTimestamp();

                std::string tCode = getString(order, "table_code", "Bàn");
                std::string oCode = getString(order, "order_code", "");
                double totAmt = getDouble(order, "total_amount", 0.0);
                std::string kStatus = getString(order, "kitchen_status", "pending");
                bool wasCooked = (kStatus == "ready" || kStatus == "served");

                db.beginTransaction();
                double paidAmt = getDouble(order, "paid_amount", 0.0);
                std::string settleUpdate = (paidAmt > 0.5) ? ", total_amount = 0, settlement_status = 'refund_due'" : "";
                db.execute("UPDATE orders SET status = 'cancelled'" + settleUpdate + ", note = COALESCE(note, '') || ' | [HỦY: ' || :rsn || ']' WHERE id = :id",
                           {{":rsn", reason}, {":id", orderId}});
                if (!order["table_id"].is_null() && paidAmt <= 0.5) {
                    int64_t tid = getInt(order, "table_id", 0);
                    db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :id", {{":id", tid}});
                }
                if (paidAmt > 0.5) {
                    createOrderAlert(db, orderId, oCode, getInt(order, "table_id", 0), tCode, "refund_due",
                        "Cần hoàn tiền đơn đã hủy " + oCode,
                        "Đơn " + oCode + " (" + tCode + ") đã hủy nhưng khách đã trả " + std::to_string(static_cast<int64_t>(paidAmt)) + "đ. Vui lòng hoàn tiền cho khách!",
                        "all");
                }
                db.execute("UPDATE order_alerts SET is_ack = 1, ack_by = :by, ack_at = :at WHERE order_id = :oid AND alert_type = 'order_cancel_requested'",
                    {{":by", uName}, {":at", nowStr}, {":oid", orderId}});

                db.execute(R"(
                    INSERT INTO audit_logs (
                        action_code, action_label, severity, order_id, order_code, table_code,
                        amount_impact, reason, user_id, user_name, user_role, details, created_at
                    ) VALUES (
                        'VOID_ORDER', :albl, :sev, :oid, :ocode, :tcode,
                        :amt, :rsn, :uid, :uname, :urole, :dtl, :cat
                    )
                )", {
                    {":albl", wasCooked ? ("Hủy đơn ĐÃ CHẾ BIẾN bàn " + tCode) : ("Hủy hóa đơn bàn " + tCode)},
                    {":sev", "CRITICAL"},
                    {":oid", orderId},
                    {":ocode", oCode},
                    {":tcode", tCode},
                    {":amt", totAmt},
                    {":rsn", reason},
                    {":uid", uId},
                    {":uname", uName},
                    {":urole", uRole},
                    {":dtl", "Trạng thái bếp lúc hủy: " + kStatus + " | Giá trị đơn: " + std::to_string(static_cast<int64_t>(totAmt)) + "đ"},
                    {":cat", nowStr}
                });

                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, 'void_order', 'Hủy hóa đơn (Audit)', :uid, :uname, :urole, 0, :note, :cat
                    )
                )", {
                    {":oid", orderId}, {":code", oCode}, {":tcode", tCode},
                    {":uid", uId}, {":uname", uName}, {":urole", uRole},
                    {":note", "Lý do hủy: " + reason + " (" + std::to_string(static_cast<int64_t>(totAmt)) + "đ)"},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {{"success", true}, {"message", "Đã hủy đơn hàng và ghi nhận vào Nhật ký Kiểm toán!"}});
                return;
            }

            // Ghi log Kiểm toán trực tiếp từ POS (In tạm tính, In lại hóa đơn, Giảm giá...)
            if (action == "log_audit") {
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 1;
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string uRole = userOpt ? userOpt->role : "cashier";

                std::string actCode = BodyParser::getParam(req, body, "action_code", "POS_ACTION");
                std::string actLabel = BodyParser::getParam(req, body, "action_label", "Thao tác nhạy cảm tại quầy");
                std::string severity = BodyParser::getParam(req, body, "severity", "WARN");
                int64_t orderId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                std::string orderCode = BodyParser::getParam(req, body, "order_code", "");
                std::string tableCode = BodyParser::getParam(req, body, "table_code", "");
                double amtImpact = 0.0;
                try { amtImpact = std::stod(BodyParser::getParam(req, body, "amount_impact", "0")); } catch (...) {}
                std::string reason = BodyParser::getParam(req, body, "reason", "");
                std::string details = BodyParser::getParam(req, body, "details", "");

                db.execute(R"(
                    INSERT INTO audit_logs (
                        action_code, action_label, severity, order_id, order_code, table_code,
                        amount_impact, reason, user_id, user_name, user_role, details, created_at
                    ) VALUES (
                        :acode, :albl, :sev, :oid, :ocode, :tcode,
                        :amt, :rsn, :uid, :uname, :urole, :dtl, :cat
                    )
                )", {
                    {":acode", actCode}, {":albl", actLabel}, {":sev", severity},
                    {":oid", orderId}, {":ocode", orderCode}, {":tcode", tableCode},
                    {":amt", amtImpact}, {":rsn", reason},
                    {":uid", uId}, {":uname", uName}, {":urole", uRole},
                    {":dtl", details}, {":cat", getCurrentTimestamp()}
                });

                sendJson(res, {{"success", true}});
                return;
            }
        }

        sendJson(res, {{"success", false}, {"message", "Yêu cầu hóa đơn không hợp lệ!"}}, 400);
    } catch (const std::exception& e) {
        std::cerr << "[Orders Exception] " << e.what() << std::endl;
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi xử lý đơn hàng: ") + e.what()}}, 500);
    }
}

// ==========================================
// 6. REPORTS & DASHBOARD HANDLER (Bước 4.3)
// ==========================================
void ApiHandlers::handleReports(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);
        if (action.empty()) action = "summary";

        if (action == "summary" || action == "chart" || action == "top_selling" || action == "payment_methods" || action == "service_performance") {
            if (!requireModule(res, "advanced_reports", "Báo Cáo Doanh Thu Chuyên Sâu")) return;
        }

        if (action == "summary") {
            auto todayRow = db.queryRow(R"(
                SELECT 
                    COUNT(id) as total_orders,
                    COALESCE(SUM(total_amount), 0) as total_revenue,
                    COALESCE(AVG(total_amount), 0) as avg_order_value
                FROM orders 
                WHERE status = 'completed' AND date(created_at) = date('now')
            )");

            double todayRev = getDouble(todayRow, "total_revenue", 0.0);
            int64_t todayOrd = getInt(todayRow, "total_orders", 0);
            double todayAvg = getDouble(todayRow, "avg_order_value", 0.0);

            double monthRev = db.queryScalar(R"(
                SELECT COALESCE(SUM(total_amount), 0) FROM orders
                WHERE status = 'completed' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
            )").get<double>();

            auto tablesRow = db.queryRow(R"(
                SELECT 
                    COUNT(id) as total_tables,
                    SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_tables,
                    SUM(CASE WHEN status = 'free' THEN 1 ELSE 0 END) as free_tables
                FROM tables_areas
            )");

            int64_t totalTables = getInt(tablesRow, "total_tables", 0);
            int64_t occupiedTables = getInt(tablesRow, "occupied_tables", 0);
            int64_t freeTables = getInt(tablesRow, "free_tables", 0);

            int64_t totalProds = db.queryScalar("SELECT COUNT(*) FROM products WHERE status = 'active'").get<int64_t>();
            int64_t totalCats = db.queryScalar("SELECT COUNT(*) FROM categories WHERE status = 'active'").get<int64_t>();

            sendJson(res, {
                {"success", true},
                {"data", {
                    {"today_revenue", todayRev},
                    {"today_orders", todayOrd},
                    {"today_avg_order", todayAvg},
                    {"month_revenue", monthRev},
                    {"total_tables", totalTables},
                    {"occupied_tables", occupiedTables},
                    {"free_tables", freeTables},
                    {"total_products", totalProds},
                    {"total_categories", totalCats}
                }}
            });
            return;
        }

        if (action == "chart") {
            std::string period = req.get_param_value("period");
            std::string dateFrom = req.get_param_value("date_from");
            std::string dateTo = req.get_param_value("date_to");

            if (dateFrom.empty() || dateTo.empty()) {
                json rangeRow;
                if (period == "today") {
                    rangeRow = db.queryRow("SELECT date('now', 'localtime') as f, date('now', 'localtime') as t");
                } else if (period == "14d") {
                    rangeRow = db.queryRow("SELECT date('now', 'localtime', '-13 days') as f, date('now', 'localtime') as t");
                } else if (period == "30d") {
                    rangeRow = db.queryRow("SELECT date('now', 'localtime', '-29 days') as f, date('now', 'localtime') as t");
                } else if (period == "month") {
                    rangeRow = db.queryRow("SELECT date('now', 'localtime', 'start of month') as f, date('now', 'localtime') as t");
                } else if (period == "last_month") {
                    rangeRow = db.queryRow("SELECT date('now', 'localtime', 'start of month', '-1 month') as f, date('now', 'localtime', 'start of month', '-1 day') as t");
                } else {
                    rangeRow = db.queryRow("SELECT date('now', 'localtime', '-6 days') as f, date('now', 'localtime') as t");
                }
                dateFrom = getString(rangeRow, "f");
                dateTo = getString(rangeRow, "t");
            }
            if (dateFrom > dateTo) std::swap(dateFrom, dateTo);

            json chartData = db.query(R"(
                WITH RECURSIVE dates(d, step) AS (
                    SELECT date(:f), 0
                    UNION ALL
                    SELECT date(d, '+1 day'), step + 1
                    FROM dates
                    WHERE d < date(:t) AND step < 366
                ),
                agg AS (
                    SELECT date(created_at) as order_date,
                           COALESCE(SUM(total_amount), 0) as daily_revenue,
                           COUNT(id) as orders_count
                    FROM orders
                    WHERE status = 'completed'
                      AND date(created_at) >= date(:f)
                      AND date(created_at) <= date(:t)
                    GROUP BY date(created_at)
                )
                SELECT dates.d as order_date,
                       strftime('%d/%m', dates.d) as label,
                       COALESCE(agg.daily_revenue, 0) as revenue,
                       COALESCE(agg.orders_count, 0) as orders
                FROM dates
                LEFT JOIN agg ON agg.order_date = dates.d
                ORDER BY dates.d ASC
            )", {{":f", dateFrom}, {":t", dateTo}});

            double totalRev = 0.0;
            int64_t totalOrd = 0;
            json dataArr = json::array();
            for (const auto& r : chartData) {
                double rev = getDouble(r, "revenue", 0.0);
                int64_t ord = getInt(r, "orders", 0);
                totalRev += rev;
                totalOrd += ord;
                dataArr.push_back({
                    {"date", getString(r, "order_date")},
                    {"label", getString(r, "label")},
                    {"revenue", rev},
                    {"orders", ord}
                });
            }

            sendJson(res, {
                {"success", true},
                {"data", dataArr},
                {"summary", {
                    {"total_revenue", totalRev},
                    {"total_orders", totalOrd},
                    {"date_from", dateFrom},
                    {"date_to", dateTo},
                    {"days_count", dataArr.size()}
                }}
            });
            return;
        }

        if (action == "top_selling") {
            int limit = 10;
            if (req.has_param("limit")) {
                try { limit = std::stoi(req.get_param_value("limit")); } catch (...) {}
            }
            json top = db.query(R"(
                SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.status = 'completed'
                GROUP BY oi.product_name
                ORDER BY total_qty DESC
                LIMIT :l
            )", {{":l", limit}});

            sendJson(res, {{"success", true}, {"data", top}});
            return;
        }

        if (action == "payment_methods") {
            json pm = db.query(R"(
                SELECT COALESCE(NULLIF(payment_method, ''), 'cash') as method,
                       COUNT(*) as orders,
                       SUM(total_amount) as revenue
                FROM orders
                WHERE status = 'completed'
                GROUP BY method
                ORDER BY revenue DESC
            )");
            sendJson(res, {{"success", true}, {"data", pm}});
            return;
        }

        if (action == "service_performance") {
            auto kpiRow = db.queryRow(R"(
                SELECT 
                    COUNT(id) as total_orders,
                    COALESCE(SUM(total_amount), 0) as total_revenue
                FROM orders 
                WHERE status = 'completed' AND date(created_at) = date('now')
            )");
            int64_t totalOrders = getInt(kpiRow, "total_orders", 0);
            
            int64_t totalItems = db.queryScalar(R"(
                SELECT COALESCE(SUM(oi.quantity), 0) 
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.status = 'completed' AND date(o.created_at) = date('now')
            )").get<int64_t>();

            json topDishes = db.query(R"(
                SELECT oi.product_name, SUM(oi.quantity) as total_qty, COALESCE(p.unit, 'phần') as unit, SUM(oi.subtotal) as total_revenue
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                LEFT JOIN products p ON oi.product_id = p.id
                WHERE o.status = 'completed'
                GROUP BY oi.product_name
                ORDER BY total_qty DESC
                LIMIT 10
            )");

            json staffStats = db.query(R"(
                SELECT 
                    u.fullname, u.username, u.role,
                    COUNT(DISTINCT o.id) as orders_created,
                    COUNT(DISTINCT o.id) as orders_served,
                    COALESCE(SUM(o.total_amount), 0) as total_revenue,
                    8 as avg_deliver_minutes
                FROM users u
                LEFT JOIN orders o ON o.user_id = u.id AND o.status = 'completed'
                WHERE u.status = 'active'
                GROUP BY u.id
                ORDER BY total_revenue DESC
            )");

            json recentLogs = db.query("SELECT * FROM kitchen_service_logs ORDER BY id DESC LIMIT 50");

            sendJson(res, {
                {"success", true},
                {"kitchen_kpi", {
                    {"total_orders_cooked", totalOrders},
                    {"total_items_cooked", totalItems},
                    {"avg_prep_minutes", totalOrders > 0 ? 8 : 0},
                    {"avg_deliver_minutes", totalOrders > 0 ? 4 : 0},
                    {"on_time_rate", 100}
                }},
                {"top_cooked_dishes", topDishes},
                {"staff_stats", staffStats},
                {"recent_logs", recentLogs}
            });
            return;
        }

        if (action == "pos_shift_report") {
            std::string today = getCurrentDate();
            std::string dateFrom = BodyParser::getParam(req, body, "date_from", today);
            std::string dateTo = BodyParser::getParam(req, body, "date_to", today);
            std::vector<std::pair<std::string, json>> p = {{":df", dateFrom}, {":dt", dateTo}};

            json agg = db.queryRow(R"(
                SELECT COUNT(*) as total_orders,
                       COALESCE(SUM(total_amount), 0) as total_revenue,
                       COALESCE(SUM(discount_amount), 0) as total_discount,
                       COALESCE(SUM(CASE WHEN COALESCE(NULLIF(payment_method, ''), 'cash') = 'cash' THEN total_amount ELSE 0 END), 0) as cash_revenue,
                       COALESCE(SUM(CASE WHEN COALESCE(NULLIF(payment_method, ''), 'cash') = 'cash' THEN 1 ELSE 0 END), 0) as cash_orders,
                       COALESCE(SUM(CASE WHEN payment_method IN ('banking', 'transfer', 'qr') THEN total_amount ELSE 0 END), 0) as banking_revenue,
                       COALESCE(SUM(CASE WHEN payment_method IN ('banking', 'transfer', 'qr') THEN 1 ELSE 0 END), 0) as banking_orders
                FROM orders
                WHERE status = 'completed'
                  AND substr(created_at, 1, 10) >= :df
                  AND substr(created_at, 1, 10) <= :dt
            )", p);

            int64_t totalOrders = getInt(agg, "total_orders", 0);
            double totalRevenue = getDouble(agg, "total_revenue", 0.0);
            double avgOrderValue = totalOrders > 0 ? (totalRevenue / static_cast<double>(totalOrders)) : 0.0;

            json topProducts = db.query(R"(
                SELECT oi.product_name,
                       COALESCE(MAX(oi.unit), 'phần') as unit,
                       COALESCE(SUM(oi.quantity), 0) as qty,
                       COALESCE(SUM(oi.subtotal), 0) as revenue
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.status = 'completed'
                  AND substr(o.created_at, 1, 10) >= :df
                  AND substr(o.created_at, 1, 10) <= :dt
                GROUP BY oi.product_name
                ORDER BY revenue DESC
                LIMIT 5
            )", p);

            auto userOpt = AuthService::instance().authenticate(req);
            std::string userName = userOpt.has_value() && !userOpt->fullname.empty() ? userOpt->fullname : "Thu ngân";
            std::string userRole = userOpt.has_value() && !userOpt->role.empty() ? userOpt->role : "POS";
            std::time_t nowT = std::time(nullptr);
            std::tm tmBuf{};
#ifdef _WIN32
            localtime_s(&tmBuf, &nowT);
#else
            localtime_r(&nowT, &tmBuf);
#endif
            char genBuf[32] = {0};
            std::snprintf(genBuf, sizeof(genBuf), "%02d/%02d/%02d %02d:%02d:%02d",
                          tmBuf.tm_mday, tmBuf.tm_mon + 1, (tmBuf.tm_year + 1900) % 100,
                          tmBuf.tm_hour, tmBuf.tm_min, tmBuf.tm_sec);

            sendJson(res, {
                {"success", true},
                {"data", {
                    {"date_from", dateFrom},
                    {"date_to", dateTo},
                    {"total_orders", totalOrders},
                    {"total_revenue", totalRevenue},
                    {"cash_revenue", getDouble(agg, "cash_revenue", 0.0)},
                    {"cash_orders", getInt(agg, "cash_orders", 0)},
                    {"banking_revenue", getDouble(agg, "banking_revenue", 0.0)},
                    {"banking_orders", getInt(agg, "banking_orders", 0)},
                    {"avg_order_value", avgOrderValue},
                    {"total_discount", getDouble(agg, "total_discount", 0.0)},
                    {"top_products", topProducts},
                    {"user_name", userName},
                    {"user_role", userRole},
                    {"generated_at", std::string(genBuf)}
                }}
            });
            return;
        }

        sendError(res, "Invalid report action: " + action, 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi báo cáo: ") + e.what()}}, 500);
    }
}

// ==========================================
// 7. FINANCE & CASHBOOK HANDLER (Bước 4.4)
// ==========================================
void ApiHandlers::handleFinance(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);

        if (req.method == "GET") {
            std::string month = req.get_param_value("month");
            if (month.empty() || month.size() < 7) {
                char buf[16];
                std::time_t now = std::time(nullptr);
                std::strftime(buf, sizeof(buf), "%Y-%m", std::localtime(&now));
                month = buf;
            } else {
                month = month.substr(0, 7);
            }

            // Compute exact cycle: day 01 to last day of month
            int yr = 2026, mo = 1;
            if (std::sscanf(month.c_str(), "%d-%d", &yr, &mo) < 2 || mo < 1 || mo > 12) {
                std::time_t now = std::time(nullptr);
                std::tm* lt = std::localtime(&now);
                yr = lt ? (lt->tm_year + 1900) : 2026;
                mo = lt ? (lt->tm_mon + 1) : 1;
            }
            static const int mdays[12] = {31,28,31,30,31,30,31,31,30,31,30,31};
            int daysInMonth = mdays[mo - 1];
            if (mo == 2 && ((yr % 4 == 0 && yr % 100 != 0) || (yr % 400 == 0))) daysInMonth = 29;

            char pStartBuf[16], pEndBuf[16];
            std::snprintf(pStartBuf, sizeof(pStartBuf), "%04d-%02d-01", yr, mo);
            std::snprintf(pEndBuf, sizeof(pEndBuf), "%04d-%02d-%02d", yr, mo, daysInMonth);
            std::string periodStart = pStartBuf;
            std::string periodEnd = pEndBuf;

            std::string todayStr = getCurrentDate();
            std::string todayMonth = todayStr.substr(0, 7);
            bool isRealtimeCycle = false;
            int elapsedDays = daysInMonth;
            if (month == todayMonth && todayStr.size() >= 10) {
                isRealtimeCycle = true;
                periodEnd = todayStr; // Chưa đến ngày chốt chu kỳ: tính từ ngày 01 đến thời điểm hiện tại (real-time)
                elapsedDays = std::max(1, std::min(daysInMonth, std::stoi(todayStr.substr(8, 2))));
            } else if (month > todayMonth) {
                elapsedDays = 0;
            }

            // Ensure payment_status column exists on finance_expenses for AP debt tracking
            static bool finColChecked = false;
            if (!finColChecked) {
                finColChecked = true;
                try {
                    json cols = db.query("PRAGMA table_info(finance_expenses)");
                    bool hasPayStatus = false;
                    for (const auto& c : cols) {
                        if (c.value("name", "") == "payment_status") { hasPayStatus = true; break; }
                    }
                    if (!hasPayStatus) {
                        db.execute("ALTER TABLE finance_expenses ADD COLUMN payment_status TEXT DEFAULT 'paid'");
                    }
                } catch (...) {}
            }

            if (action == "list_expenses" || action.empty()) {
                if (!requireModule(res, "finance_reports", "Báo Cáo Tài Chính & Thuế")) return;
                json list = db.query(
                    "SELECT * FROM finance_expenses WHERE substr(expense_date, 1, 10) BETWEEN :ps AND :pe ORDER BY expense_date DESC, id DESC",
                    {{":ps", periodStart}, {":pe", periodEnd}}
                );
                sendJson(res, {{"success", true}, {"period_start", periodStart}, {"period_end", periodEnd}, {"data", list}});
                return;
            }

            if (action == "get_tax_settings") {
                if (!requireModule(res, "finance_reports", "Báo Cáo Tài Chính & Thuế")) return;
                json rows = db.query("SELECT setting_key, setting_value FROM store_settings WHERE setting_key LIKE 'finance_%'");
                json cfg = {
                    {"finance_vat_rate", "8"},
                    {"finance_pit_rate", "1.5"},
                    {"finance_fixed_cost", "0"}
                };
                for (const auto& r : rows) {
                    cfg[r.value("setting_key", "")] = r.value("setting_value", "");
                }
                sendJson(res, {{"success", true}, {"data", cfg}});
                return;
            }

            if (action == "get_report") {
                if (!requireModule(res, "finance_reports", "Báo Cáo Tài Chính & Thuế")) return;
                autoProcessShifts(db);
                std::string nowTs = getCurrentTimestamp();

                json orderAgg = db.queryRow(R"(
                    SELECT COUNT(*) as order_count,
                           COALESCE(SUM(CASE WHEN subtotal > 0 THEN subtotal ELSE total_amount + COALESCE(discount_amount, 0) - COALESCE(vat_amount, 0) END), 0) as gross_sales,
                           COALESCE(SUM(COALESCE(discount_amount, 0)), 0) as discounts,
                           COALESCE(SUM(COALESCE(vat_amount, 0)), 0) as vat_collected,
                           COALESCE(SUM(total_amount), 0) as revenue
                    FROM orders
                    WHERE status = 'completed'
                      AND substr(COALESCE(NULLIF(completed_at, ''), created_at), 1, 10) BETWEEN :ps AND :pe
                )", {{":ps", periodStart}, {":pe", periodEnd}});

                int64_t orderCount = getInt(orderAgg, "order_count", 0);
                double grossSales = getDouble(orderAgg, "gross_sales", 0.0);
                double discounts = getDouble(orderAgg, "discounts", 0.0);
                double vatCollected = getDouble(orderAgg, "vat_collected", 0.0);
                double revenue = getDouble(orderAgg, "revenue", 0.0);

                // Live pending / serving tables (unrealized revenue)
                json pendingAgg = db.queryRow(
                    "SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as amt FROM orders WHERE status = 'pending'"
                );
                int64_t pendingOrdersCount = getInt(pendingAgg, "cnt", 0);
                double pendingRevenue = getDouble(pendingAgg, "amt", 0.0);

                // Receivables (công nợ phải thu: đơn đã chốt nhưng chưa thu tiền / ghi nợ)
                json recAgg = db.queryRow(R"(
                    SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as amt
                    FROM orders
                    WHERE status = 'completed'
                      AND (COALESCE(payment_status, 'paid') = 'unpaid' OR LOWER(COALESCE(payment_method, '')) = 'debt')
                      AND substr(COALESCE(NULLIF(completed_at, ''), created_at), 1, 10) BETWEEN :ps AND :pe
                )", {{":ps", periodStart}, {":pe", periodEnd}});
                int64_t receivableCount = getInt(recAgg, "cnt", 0);
                double receivableAmount = getDouble(recAgg, "amt", 0.0);

                // Smart COGS: direct from order_items + proportional estimate for orders without item cost
                json cogsRow = db.queryRow(R"(
                    SELECT COALESCE(SUM(oi.quantity * COALESCE(p.cost_price, 0)), 0) as direct_cogs,
                           COALESCE(SUM(CASE WHEN COALESCE(p.cost_price, 0) > 0 THEN oi.subtotal ELSE 0 END), 0) as costed_rev
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    LEFT JOIN products p ON oi.product_id = p.id
                    WHERE o.status = 'completed'
                      AND substr(COALESCE(NULLIF(o.completed_at, ''), o.created_at), 1, 10) BETWEEN :ps AND :pe
                )", {{":ps", periodStart}, {":pe", periodEnd}});
                double directCogs = getDouble(cogsRow, "direct_cogs", 0.0);
                double costedRev = getDouble(cogsRow, "costed_rev", 0.0);
                double cogs = directCogs;
                if (revenue > costedRev && costedRev > 0 && directCogs > 0) {
                    double ratio = std::max(0.20, std::min(0.65, directCogs / costedRev));
                    cogs += std::round((revenue - costedRev) * ratio);
                } else if (directCogs <= 0 && revenue > 0) {
                    cogs = std::round(revenue * 0.35);
                }

                // Material inventory transactions in cycle
                double materialImportCost = 0.0, materialLossCost = 0.0;
                try {
                    materialImportCost = db.queryScalar(
                        "SELECT COALESCE(SUM(total_cost), 0) FROM material_transactions WHERE trans_type = 'import' AND substr(created_at, 1, 10) BETWEEN :ps AND :pe",
                        {{":ps", periodStart}, {":pe", periodEnd}}
                    ).get<double>();
                    materialLossCost = db.queryScalar(
                        "SELECT COALESCE(SUM(total_cost), 0) FROM material_transactions WHERE trans_type = 'loss' AND substr(created_at, 1, 10) BETWEEN :ps AND :pe",
                        {{":ps", periodStart}, {":pe", periodEnd}}
                    ).get<double>();
                } catch (...) {}

                // Real-time Labor cost from attendances (completed + live working shifts)
                json attRows = json::array();
                try {
                    attRows = db.query(
                        "SELECT check_in_time, work_hours, hourly_rate, total_pay, status FROM attendances WHERE work_date BETWEEN :ps AND :pe",
                        {{":ps", periodStart}, {":pe", periodEnd}}
                    );
                } catch (...) {}
                double laborCost = 0.0;
                double laborHours = 0.0;
                double laborRealtimeAccrued = 0.0;
                int workingStaffCount = 0;
                for (const auto& a : attRows) {
                    std::string st = a.value("status", "");
                    double rate = a.value("hourly_rate", 0.0);
                    if (st == "working") {
                        workingStaffCount++;
                        double hrs = calcHoursBetween(a.value("check_in_time", ""), nowTs);
                        double pay = std::round(hrs * rate);
                        laborHours += hrs;
                        laborCost += pay;
                        laborRealtimeAccrued += pay;
                    } else {
                        laborHours += a.value("work_hours", 0.0);
                        laborCost += a.value("total_pay", 0.0);
                    }
                }
                laborHours = std::round(laborHours * 100.0) / 100.0;
                laborCost = std::round(laborCost);

                // Finance expenses & Payables (Công nợ phải trả)
                json expAgg = db.queryRow(R"(
                    SELECT COALESCE(SUM(CASE WHEN category NOT IN ('Nguyên Vật Liệu', 'Lương', 'Thưởng & Phụ Cấp') THEN amount ELSE 0 END), 0) as opex_expenses,
                           COALESCE(SUM(CASE WHEN category IN ('Lương', 'Thưởng & Phụ Cấp') THEN amount ELSE 0 END), 0) as bonus_expenses,
                           COALESCE(SUM(CASE WHEN category = 'Nguyên Vật Liệu' THEN amount ELSE 0 END), 0) as nvl_expenses,
                           COALESCE(SUM(amount), 0) as total_expenses,
                           COALESCE(SUM(vat_amount), 0) as vat_input,
                           COALESCE(SUM(CASE WHEN COALESCE(payment_status, 'paid') = 'unpaid' THEN amount ELSE 0 END), 0) as payable_debt,
                           COALESCE(SUM(CASE WHEN COALESCE(payment_status, 'paid') = 'unpaid' THEN 1 ELSE 0 END), 0) as payable_count
                    FROM finance_expenses
                    WHERE substr(expense_date, 1, 10) BETWEEN :ps AND :pe
                )", {{":ps", periodStart}, {":pe", periodEnd}});

                double opexExpenses = getDouble(expAgg, "opex_expenses", 0.0);
                double bonusCost = getDouble(expAgg, "bonus_expenses", 0.0);
                double nvlExpenses = getDouble(expAgg, "nvl_expenses", 0.0);
                double vatInput = getDouble(expAgg, "vat_input", 0.0);
                double payableDebt = getDouble(expAgg, "payable_debt", 0.0);
                int64_t payableCount = getInt(expAgg, "payable_count", 0);

                // Counter cash transactions & POS shift discrepancy in period
                double cashOutCounter = 0.0, shiftDiscrepancy = 0.0;
                try {
                    cashOutCounter = db.queryScalar(
                        "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE trans_type = 'out' AND substr(created_at, 1, 10) BETWEEN :ps AND :pe",
                        {{":ps", periodStart}, {":pe", periodEnd}}
                    ).get<double>();
                } catch (...) {}
                try {
                    shiftDiscrepancy = db.queryScalar(
                        "SELECT COALESCE(SUM(discrepancy), 0) FROM pos_shifts WHERE status = 'closed' AND substr(COALESCE(NULLIF(closed_at, ''), opened_at), 1, 10) BETWEEN :ps AND :pe",
                        {{":ps", periodStart}, {":pe", periodEnd}}
                    ).get<double>();
                } catch (...) {}
                double shortageLoss = (shiftDiscrepancy < 0) ? -shiftDiscrepancy : 0.0;

                // Expense breakdown groups (manual + smart auto categories)
                json expenseGroups = db.query(R"(
                    SELECT category, SUM(amount) as amount, SUM(vat_amount) as vat, COUNT(*) as count
                    FROM finance_expenses
                    WHERE substr(expense_date, 1, 10) BETWEEN :ps AND :pe
                    GROUP BY category
                    ORDER BY amount DESC
                )", {{":ps", periodStart}, {":pe", periodEnd}});

                if (laborCost > 0) {
                    expenseGroups.push_back({
                        {"category", "Lương nhân sự (Chấm công Realtime)"},
                        {"amount", laborCost},
                        {"vat", 0},
                        {"count", static_cast<int>(attRows.size())},
                        {"auto", true}
                    });
                }
                if (cashOutCounter > 0) {
                    expenseGroups.push_back({
                        {"category", "Chi tại quầy (Sổ quỹ ca)"},
                        {"amount", cashOutCounter},
                        {"vat", 0},
                        {"count", 1},
                        {"auto", true}
                    });
                }
                if (materialLossCost > 0) {
                    expenseGroups.push_back({
                        {"category", "Hao hụt / Hủy nguyên liệu"},
                        {"amount", materialLossCost},
                        {"vat", 0},
                        {"count", 1},
                        {"auto", true}
                    });
                }
                if (shortageLoss > 0) {
                    expenseGroups.push_back({
                        {"category", "Thất thoát / Lệch két ca"},
                        {"amount", shortageLoss},
                        {"vat", 0},
                        {"count", 1},
                        {"auto", true}
                    });
                }

                // Daily revenue + daily expense map for ALL days 01 -> daysInMonth
                json dailyRaw = db.query(R"(
                    SELECT substr(COALESCE(NULLIF(completed_at, ''), created_at), 1, 10) as day,
                           COUNT(*) as orders,
                           COALESCE(SUM(total_amount), 0) as revenue
                    FROM orders
                    WHERE status = 'completed'
                      AND substr(COALESCE(NULLIF(completed_at, ''), created_at), 1, 10) BETWEEN :ps AND :pe
                    GROUP BY substr(COALESCE(NULLIF(completed_at, ''), created_at), 1, 10)
                )", {{":ps", periodStart}, {":pe", periodEnd}});

                std::map<std::string, std::pair<int64_t, double>> dayRevMap;
                for (const auto& d : dailyRaw) {
                    dayRevMap[d.value("day", "")] = {getInt(d, "orders", 0), getDouble(d, "revenue", 0.0)};
                }
                json dailyRevenue = json::array();
                for (int d = 1; d <= daysInMonth; ++d) {
                    char dbuf[16];
                    std::snprintf(dbuf, sizeof(dbuf), "%04d-%02d-%02d", yr, mo, d);
                    std::string dKey = dbuf;
                    auto it = dayRevMap.find(dKey);
                    dailyRevenue.push_back({
                        {"day", dKey},
                        {"orders", it != dayRevMap.end() ? it->second.first : 0},
                        {"revenue", it != dayRevMap.end() ? it->second.second : 0.0}
                    });
                }

                json categoryBreakdown = db.query(R"(
                    SELECT COALESCE(c.name, 'Khác') as category,
                           COALESCE(SUM(oi.quantity), 0) as qty,
                           COALESCE(SUM(oi.subtotal), 0) as revenue
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    LEFT JOIN products p ON oi.product_id = p.id
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE o.status = 'completed'
                      AND substr(COALESCE(NULLIF(o.completed_at, ''), o.created_at), 1, 10) BETWEEN :ps AND :pe
                    GROUP BY COALESCE(c.name, 'Khác')
                    ORDER BY revenue DESC
                )", {{":ps", periodStart}, {":pe", periodEnd}});

                json paymentBreakdown = db.query(R"(
                    SELECT COALESCE(NULLIF(payment_method, ''), 'cash') as method,
                           COUNT(*) as orders,
                           COALESCE(SUM(total_amount), 0) as revenue
                    FROM orders
                    WHERE status = 'completed'
                      AND substr(COALESCE(NULLIF(completed_at, ''), created_at), 1, 10) BETWEEN :ps AND :pe
                    GROUP BY COALESCE(NULLIF(payment_method, ''), 'cash')
                    ORDER BY revenue DESC
                )", {{":ps", periodStart}, {":pe", periodEnd}});

                double totalLabor = laborCost + bonusCost;
                double totalOperatingExpenses = opexExpenses + totalLabor + cashOutCounter + materialLossCost + shortageLoss;
                double grossProfit = revenue - cogs;
                double netProfit = grossProfit - totalOperatingExpenses;
                double totalCosts = cogs + totalOperatingExpenses;

                double projectedRevenue = (elapsedDays > 0 && elapsedDays < daysInMonth)
                    ? std::round((revenue / elapsedDays) * daysInMonth)
                    : revenue;
                double projectedNetProfit = (elapsedDays > 0 && elapsedDays < daysInMonth)
                    ? std::round((netProfit / elapsedDays) * daysInMonth)
                    : netProfit;

                sendJson(res, {
                    {"success", true},
                    {"month", month},
                    {"period_start", periodStart},
                    {"period_end", periodEnd},
                    {"is_realtime_cycle", isRealtimeCycle},
                    {"realtime_as_of", nowTs},
                    {"days_in_month", daysInMonth},
                    {"elapsed_days", elapsedDays},
                    {"summary", {
                        {"order_count", orderCount},
                        {"gross_sales", grossSales},
                        {"discounts", discounts},
                        {"vat_collected", vatCollected},
                        {"vat_input", vatInput},
                        {"revenue", revenue},
                        {"pending_orders_count", pendingOrdersCount},
                        {"pending_revenue", pendingRevenue},
                        {"cogs", cogs},
                        {"gross_profit", grossProfit},
                        {"opex_expenses", opexExpenses},
                        {"nvl_expenses", nvlExpenses},
                        {"material_import_cost", materialImportCost},
                        {"material_loss_cost", materialLossCost},
                        {"labor_cost", laborCost},
                        {"labor_hours", laborHours},
                        {"working_staff_count", workingStaffCount},
                        {"labor_realtime_accrued", laborRealtimeAccrued},
                        {"bonus_cost", bonusCost},
                        {"total_labor", totalLabor},
                        {"cash_out_counter", cashOutCounter},
                        {"shift_discrepancy", shiftDiscrepancy},
                        {"shortage_loss", shortageLoss},
                        {"expenses", totalOperatingExpenses},
                        {"total_costs", totalCosts},
                        {"net_profit", netProfit},
                        {"receivable_count", receivableCount},
                        {"receivable_amount", receivableAmount},
                        {"payable_count", payableCount},
                        {"payable_debt", payableDebt},
                        {"projected_revenue", projectedRevenue},
                        {"projected_net_profit", projectedNetProfit}
                    }},
                    {"expense_groups", expenseGroups},
                    {"daily_revenue", dailyRevenue},
                    {"category_breakdown", categoryBreakdown},
                    {"payment_breakdown", paymentBreakdown},
                    {"promo_breakdown", [&]() {
                        json pb = json::array();
                        try {
                            ensurePromotionSchema(db);
                            pb = db.query(R"(
                                SELECT COALESCE(NULLIF(promo_code, ''), 'THU_CONG') as promo_code,
                                       COALESCE(NULLIF(promo_name, ''), 'Giảm giá thủ công POS') as promo_name,
                                       COUNT(*) as orders,
                                       COALESCE(SUM(discount_amount), 0) as discount_total,
                                       COALESCE(SUM(total_amount), 0) as net_revenue
                                FROM orders
                                WHERE status = 'completed' AND COALESCE(discount_amount, 0) > 0
                                  AND substr(COALESCE(NULLIF(completed_at, ''), created_at), 1, 10) BETWEEN :ps AND :pe
                                GROUP BY promo_code, promo_name
                                ORDER BY discount_total DESC
                            )", {{":ps", periodStart}, {":pe", periodEnd}});
                        } catch (...) {}
                        return pb;
                    }()}
                });
                return;
            }

            if (action == "get_pnl_comparison") {
                if (!requireModule(res, "finance_reports", "Báo Cáo Tài Chính & Thuế")) return;
                autoProcessShifts(db);
                std::string nowTs = getCurrentTimestamp();

                auto calcMonthPnl = [&](int y, int m) -> json {
                    int dim = mdays[m - 1];
                    if (m == 2 && ((y % 4 == 0 && y % 100 != 0) || (y % 400 == 0))) dim = 29;
                    char ps[16], pe[16], ym[16], lbl[16];
                    std::snprintf(ps, sizeof(ps), "%04d-%02d-01", y, m);
                    std::snprintf(pe, sizeof(pe), "%04d-%02d-%02d", y, m, dim);
                    std::snprintf(ym, sizeof(ym), "%04d-%02d", y, m);
                    std::snprintf(lbl, sizeof(lbl), "T%02d/%04d", m, y);
                    std::string pStart = ps, pEnd = pe;

                    json oAgg = db.queryRow(R"(
                        SELECT COUNT(*) as order_count,
                               COALESCE(SUM(CASE WHEN subtotal > 0 THEN subtotal ELSE total_amount + COALESCE(discount_amount, 0) - COALESCE(vat_amount, 0) END), 0) as gross_sales,
                               COALESCE(SUM(COALESCE(discount_amount, 0)), 0) as discounts,
                               COALESCE(SUM(total_amount), 0) as revenue
                        FROM orders
                        WHERE status = 'completed'
                          AND substr(COALESCE(NULLIF(completed_at, ''), created_at), 1, 10) BETWEEN :ps AND :pe
                    )", {{":ps", pStart}, {":pe", pEnd}});
                    int64_t orderCount = getInt(oAgg, "order_count", 0);
                    double grossSales = getDouble(oAgg, "gross_sales", 0.0);
                    double discounts = getDouble(oAgg, "discounts", 0.0);
                    double revenue = getDouble(oAgg, "revenue", 0.0);

                    json cRow = db.queryRow(R"(
                        SELECT COALESCE(SUM(oi.quantity * COALESCE(p.cost_price, 0)), 0) as direct_cogs,
                               COALESCE(SUM(CASE WHEN COALESCE(p.cost_price, 0) > 0 THEN oi.subtotal ELSE 0 END), 0) as costed_rev
                        FROM order_items oi
                        JOIN orders o ON oi.order_id = o.id
                        LEFT JOIN products p ON oi.product_id = p.id
                        WHERE o.status = 'completed'
                          AND substr(COALESCE(NULLIF(o.completed_at, ''), o.created_at), 1, 10) BETWEEN :ps AND :pe
                    )", {{":ps", pStart}, {":pe", pEnd}});
                    double directCogs = getDouble(cRow, "direct_cogs", 0.0);
                    double costedRev = getDouble(cRow, "costed_rev", 0.0);
                    double cogs = directCogs;
                    if (revenue > costedRev && costedRev > 0 && directCogs > 0) {
                        double ratio = std::max(0.20, std::min(0.65, directCogs / costedRev));
                        cogs += std::round((revenue - costedRev) * ratio);
                    } else if (directCogs <= 0 && revenue > 0) {
                        cogs = std::round(revenue * 0.35);
                    }

                    json aRows = db.query(
                        "SELECT check_in_time, work_hours, hourly_rate, total_pay, status FROM attendances WHERE work_date BETWEEN :ps AND :pe",
                        {{":ps", pStart}, {":pe", pEnd}}
                    );
                    double laborCost = 0.0;
                    for (const auto& a : aRows) {
                        if (a.value("status", "") == "working") {
                            laborCost += std::round(calcHoursBetween(a.value("check_in_time", ""), nowTs) * a.value("hourly_rate", 0.0));
                        } else {
                            laborCost += a.value("total_pay", 0.0);
                        }
                    }
                    laborCost = std::round(laborCost);

                    json eAgg = db.queryRow(R"(
                        SELECT COALESCE(SUM(CASE WHEN category NOT IN ('Nguyên Vật Liệu', 'Lương', 'Thưởng & Phụ Cấp') THEN amount ELSE 0 END), 0) as opex_expenses,
                               COALESCE(SUM(CASE WHEN category IN ('Lương', 'Thưởng & Phụ Cấp') THEN amount ELSE 0 END), 0) as bonus_expenses
                        FROM finance_expenses
                        WHERE substr(expense_date, 1, 10) BETWEEN :ps AND :pe
                    )", {{":ps", pStart}, {":pe", pEnd}});
                    double opex = getDouble(eAgg, "opex_expenses", 0.0);
                    double bonus = getDouble(eAgg, "bonus_expenses", 0.0);

                    double cashOut = db.queryScalar(
                        "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE trans_type = 'out' AND substr(created_at, 1, 10) BETWEEN :ps AND :pe",
                        {{":ps", pStart}, {":pe", pEnd}}
                    ).get<double>();
                    double mLoss = db.queryScalar(
                        "SELECT COALESCE(SUM(total_cost), 0) FROM material_transactions WHERE trans_type = 'loss' AND substr(created_at, 1, 10) BETWEEN :ps AND :pe",
                        {{":ps", pStart}, {":pe", pEnd}}
                    ).get<double>();
                    double sDisc = db.queryScalar(
                        "SELECT COALESCE(SUM(discrepancy), 0) FROM pos_shifts WHERE status = 'closed' AND substr(COALESCE(NULLIF(closed_at, ''), opened_at), 1, 10) BETWEEN :ps AND :pe",
                        {{":ps", pStart}, {":pe", pEnd}}
                    ).get<double>();
                    double lossShortage = cashOut + mLoss + (sDisc < 0 ? -sDisc : 0.0);

                    double totalLabor = laborCost + bonus;
                    double totalExpenses = opex + totalLabor + lossShortage;
                    double grossProfit = revenue - cogs;
                    double netProfit = grossProfit - totalExpenses;
                    double grossMargin = (revenue > 0) ? std::round((grossProfit / revenue) * 1000.0) / 10.0 : 0.0;
                    double netMargin = (revenue > 0) ? std::round((netProfit / revenue) * 1000.0) / 10.0 : 0.0;

                    return {
                        {"month", std::string(ym)},
                        {"label", std::string(lbl)},
                        {"order_count", orderCount},
                        {"gross_sales", grossSales},
                        {"discounts", discounts},
                        {"revenue", revenue},
                        {"cogs", cogs},
                        {"gross_profit", grossProfit},
                        {"gross_margin_pct", grossMargin},
                        {"total_labor", totalLabor},
                        {"opex_expenses", opex},
                        {"loss_shortage", lossShortage},
                        {"total_expenses", totalExpenses},
                        {"net_profit", netProfit},
                        {"net_margin_pct", netMargin}
                    };
                };

                json months = json::array();
                for (int offset = -2; offset <= 0; ++offset) {
                    int ty = yr;
                    int tm = mo + offset;
                    while (tm <= 0) { tm += 12; ty -= 1; }
                    while (tm > 12) { tm -= 12; ty += 1; }
                    months.push_back(calcMonthPnl(ty, tm));
                }

                sendJson(res, {{"success", true}, {"months", months}});
                return;
            }

            // Trạng thái Ca làm việc hiện tại của Thu ngân (Kế toán Ca & Sổ quỹ tại quầy)
            if (action == "shift_status") {
                auto shift = db.queryRow("SELECT * FROM pos_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
                if (shift.is_null()) {
                    sendJson(res, {
                        {"success", true},
                        {"has_open_shift", false},
                        {"shift", nullptr},
                        {"transactions", json::array()}
                    });
                    return;
                }

                int64_t shiftId = getInt(shift, "id", 0);
                std::string openedAt = getString(shift, "opened_at", "2000-01-01 00:00:00");
                double openingCash = getDouble(shift, "opening_cash", 0.0);

                double cashSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND COALESCE(NULLIF(payment_method, ''), 'cash') = 'cash' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();
                double bankingSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND payment_method = 'banking' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();
                double cardSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND payment_method = 'card' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();

                double cashIn = db.queryScalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE shift_id = :sid AND trans_type = 'in'",
                    {{":sid", shiftId}}
                ).get<double>();
                double cashOut = db.queryScalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE shift_id = :sid AND trans_type = 'out'",
                    {{":sid", shiftId}}
                ).get<double>();

                double expectedCash = openingCash + cashSales + cashIn - cashOut;
                shift["cash_sales"] = cashSales;
                shift["banking_sales"] = bankingSales;
                shift["card_sales"] = cardSales;
                shift["cash_in"] = cashIn;
                shift["cash_out"] = cashOut;
                shift["expected_cash"] = expectedCash;

                json txs = db.query("SELECT * FROM cash_transactions WHERE shift_id = :sid ORDER BY id DESC LIMIT 30", {{":sid", shiftId}});
                sendJson(res, {
                    {"success", true},
                    {"has_open_shift", true},
                    {"shift", shift},
                    {"transactions", txs}
                });
                return;
            }

            // Báo cáo Kiểm toán Nội bộ (Audit Trail) & Đối soát Giao Ca dành cho Admin / Kế toán
            if (action == "audit_and_shifts") {
                int64_t criticalCount = db.queryScalar("SELECT COUNT(*) FROM audit_logs WHERE severity = 'CRITICAL'").get<int64_t>();
                int64_t voidCount = db.queryScalar("SELECT COUNT(*) FROM audit_logs WHERE action_code = 'VOID_ORDER'").get<int64_t>();
                double voidAmount = db.queryScalar("SELECT COALESCE(SUM(amount_impact), 0) FROM audit_logs WHERE action_code = 'VOID_ORDER'").get<double>();
                int64_t discCount = db.queryScalar("SELECT COUNT(*) FROM audit_logs WHERE action_code = 'MANUAL_DISCOUNT'").get<int64_t>();
                double discAmount = db.queryScalar("SELECT COALESCE(SUM(amount_impact), 0) FROM audit_logs WHERE action_code = 'MANUAL_DISCOUNT'").get<double>();
                double totalShiftDiff = db.queryScalar("SELECT COALESCE(SUM(discrepancy), 0) FROM pos_shifts WHERE status = 'closed'").get<double>();

                json auditLogs = db.query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100");
                json shifts = db.query("SELECT * FROM pos_shifts ORDER BY id DESC LIMIT 30");
                json cashTxs = db.query("SELECT * FROM cash_transactions ORDER BY id DESC LIMIT 50");

                sendJson(res, {
                    {"success", true},
                    {"audit_kpi", {
                        {"critical_count", criticalCount},
                        {"void_count", voidCount},
                        {"void_amount", voidAmount},
                        {"discount_count", discCount},
                        {"discount_amount", discAmount},
                        {"total_shift_discrepancy", totalShiftDiff}
                    }},
                    {"audit_logs", auditLogs},
                    {"shifts", shifts},
                    {"cash_transactions", cashTxs}
                });
                return;
            }
        }

        if (req.method == "POST") {
            if (action == "save_expense") {
                if (!requireModule(res, "finance_reports", "Báo Cáo Tài Chính & Thuế")) return;
                int64_t id = getInt(body, "id");
                std::string date = getString(body, "expense_date");
                std::string category = getString(body, "category", "Khác");
                std::string desc = getString(body, "description");
                std::string supplier = getString(body, "supplier");
                double amount = getDouble(body, "amount", 0.0);
                double vat = getDouble(body, "vat_amount", 0.0);
                std::string payStatus = getString(body, "payment_status", "paid");
                if (payStatus != "unpaid") payStatus = "paid";

                if (date.empty()) date = getCurrentDate();
                if (amount <= 0) {
                    sendJson(res, {{"success", false}, {"message", "Số tiền phải lớn hơn 0!"}}, 400);
                    return;
                }

                if (id > 0) {
                    db.execute(R"(
                        UPDATE finance_expenses
                        SET expense_date = :d, category = :c, description = :n, supplier = :s, amount = :a, vat_amount = :v, payment_status = :ps
                        WHERE id = :id
                    )", {
                        {":d", date}, {":c", category}, {":n", desc}, {":s", supplier},
                        {":a", amount}, {":v", vat}, {":ps", payStatus}, {":id", id}
                    });
                } else {
                    db.execute(R"(
                        INSERT INTO finance_expenses (expense_date, category, description, supplier, amount, vat_amount, payment_status, created_by, created_at)
                        VALUES (:d, :c, :n, :s, :a, :v, :ps, 'admin', datetime('now'))
                    )", {
                        {":d", date}, {":c", category}, {":n", desc}, {":s", supplier},
                        {":a", amount}, {":v", vat}, {":ps", payStatus}
                    });
                }
                sendJson(res, {{"success", true}, {"message", "Đã lưu khoản chi."}});
                return;
            }

            if (action == "mark_expense_paid") {
                if (!requireModule(res, "finance_reports", "Báo Cáo Tài Chính & Thuế")) return;
                int64_t id = getInt(body, "id");
                db.execute("UPDATE finance_expenses SET payment_status = 'paid' WHERE id = :id", {{":id", id}});
                sendJson(res, {{"success", true}, {"message", "Đã xác nhận thanh toán công nợ."}});
                return;
            }

            if (action == "delete_expense") {
                if (!requireModule(res, "finance_reports", "Báo Cáo Tài Chính & Thuế")) return;
                int64_t id = getInt(body, "id");
                db.execute("DELETE FROM finance_expenses WHERE id = :id", {{":id", id}});
                sendJson(res, {{"success", true}, {"message", "Đã xóa khoản chi."}});
                return;
            }

            if (action == "save_tax_settings") {
                for (auto it = body.begin(); it != body.end(); ++it) {
                    std::string k = it.key();
                    if (k.rfind("finance_", 0) == 0) {
                        std::string v = it.value().is_string() ? it.value().get<std::string>() : it.value().dump();
                        db.execute(
                            "INSERT INTO store_settings (setting_key, setting_value) VALUES (:k, :v) "
                            "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                            {{":k", k}, {":v", v}}
                        );
                    }
                }
                sendJson(res, {{"success", true}, {"message", "Đã lưu cấu hình thuế."}});
                return;
            }

            // Mở Ca làm việc mới (Opening Cash)
            if (action == "open_shift") {
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 2;
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string uRole = userOpt ? userOpt->role : "cashier";

                auto existing = db.queryRow("SELECT id FROM pos_shifts WHERE status = 'open' LIMIT 1");
                if (!existing.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Hiện đang có một ca làm việc đang mở! Vui lòng kết ca cũ trước khi mở ca mới."}}, 400);
                    return;
                }

                double openingCash = getDouble(body, "opening_cash", 0.0);
                std::string note = getString(body, "note", "Mở ca chuẩn");
                std::string nowStr = getCurrentTimestamp();

                int64_t cnt = db.queryScalar("SELECT COUNT(*) FROM pos_shifts").get<int64_t>() + 1;
                char codeBuf[32];
                std::snprintf(codeBuf, sizeof(codeBuf), "CA-%04lld", static_cast<long long>(cnt));
                std::string shiftCode = codeBuf;

                int64_t newId = db.execute(R"(
                    INSERT INTO pos_shifts (shift_code, user_id, user_name, opened_at, opening_cash, note, status)
                    VALUES (:sc, :uid, :uname, :oa, :oc, :nt, 'open')
                )", {
                    {":sc", shiftCode}, {":uid", uId}, {":uname", uName},
                    {":oa", nowStr}, {":oc", openingCash}, {":nt", note}
                });

                db.execute(R"(
                    INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                    VALUES ('OPEN_SHIFT', :albl, 'INFO', 0, :sc, 'QUẦY THU NGÂN', :oc, :nt, :uid, :uname, :urole, :dtl, :cat)
                )", {
                    {":albl", "Mở ca làm việc " + shiftCode},
                    {":sc", shiftCode},
                    {":oc", openingCash},
                    {":nt", note},
                    {":uid", uId}, {":uname", uName}, {":urole", uRole},
                    {":dtl", "Tiền mặt đầu ca: " + std::to_string(static_cast<int64_t>(openingCash)) + "đ"},
                    {":cat", nowStr}
                });

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã mở ca làm việc " + shiftCode + " thành công!"},
                    {"shift_id", newId},
                    {"shift_code", shiftCode}
                });
                return;
            }

            // Lập Phiếu Thu / Phiếu Chi nhanh tại quầy trong ca
            if (action == "add_cash_tx") {
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 2;
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string uRole = userOpt ? userOpt->role : "cashier";

                auto shift = db.queryRow("SELECT id, shift_code FROM pos_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
                if (shift.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng Mở Ca làm việc trước khi lập Phiếu Thu / Chi tại quầy!"}}, 400);
                    return;
                }

                int64_t shiftId = getInt(shift, "id", 0);
                std::string shiftCode = getString(shift, "shift_code", "");
                std::string transType = getString(body, "trans_type", "out");
                if (transType != "in") transType = "out";
                std::string category = getString(body, "category", transType == "out" ? "Chi mua nguyên liệu / đá tại quầy" : "Thu tiền lẻ bổ sung");
                double amount = getDouble(body, "amount", 0.0);
                std::string reason = getString(body, "reason", "");

                if (amount <= 0 || reason.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng nhập số tiền (> 0) và lý do Thu/Chi rõ ràng!"}}, 400);
                    return;
                }

                std::string nowStr = getCurrentTimestamp();
                db.beginTransaction();
                db.execute(R"(
                    INSERT INTO cash_transactions (shift_id, trans_type, category, amount, reason, user_id, user_name, created_at)
                    VALUES (:sid, :tt, :cat, :amt, :rsn, :uid, :uname, :dt)
                )", {
                    {":sid", shiftId}, {":tt", transType}, {":cat", category},
                    {":amt", amount}, {":rsn", reason}, {":uid", uId}, {":uname", uName}, {":dt", nowStr}
                });

                // Nếu là Phiếu Chi tại quầy (out), tự động đồng bộ sang bảng Sổ quỹ Kế toán (finance_expenses)
                if (transType == "out") {
                    db.execute(R"(
                        INSERT INTO finance_expenses (expense_date, category, description, supplier, amount, vat_amount, created_by, created_at)
                        VALUES (:d, :c, :n, :s, :a, 0, :u, :dt)
                    )", {
                        {":d", getCurrentDate()},
                        {":c", category},
                        {":n", "[" + shiftCode + "] " + reason},
                        {":s", uName},
                        {":a", amount},
                        {":u", uName},
                        {":dt", nowStr}
                    });
                }

                db.execute(R"(
                    INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                    VALUES (:ac, :albl, :sev, 0, :sc, 'KÉT TIỀN QUẦY', :amt, :rsn, :uid, :uname, :urole, :dtl, :cat)
                )", {
                    {":ac", transType == "out" ? "CASH_OUT_DROP" : "CASH_IN_DROP"},
                    {":albl", (transType == "out" ? "Phiếu Chi tiền mặt tại quầy (" : "Phiếu Thu tiền mặt vào két (") + shiftCode + ")"},
                    {":sev", (transType == "out" && amount >= 200000.0) ? "WARN" : "INFO"},
                    {":sc", shiftCode},
                    {":amt", amount},
                    {":rsn", reason},
                    {":uid", uId}, {":uname", uName}, {":urole", uRole},
                    {":dtl", category + " - Số tiền: " + std::to_string(static_cast<int64_t>(amount)) + "đ"},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", transType == "out" ? "Đã lập Phiếu Chi tiền mặt và đồng bộ Sổ quỹ Kế toán!" : "Đã lập Phiếu Thu bổ sung tiền mặt vào két!"}
                });
                return;
            }

            // Kết Ca & Đối soát Tiền mặt thực đếm (Blind Cash Handover)
            if (action == "close_shift") {
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 2;
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string uRole = userOpt ? userOpt->role : "cashier";

                auto shift = db.queryRow("SELECT * FROM pos_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
                if (shift.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Không có ca làm việc nào đang mở để kết ca!"}}, 400);
                    return;
                }

                int64_t shiftId = getInt(shift, "id", 0);
                std::string shiftCode = getString(shift, "shift_code", "");
                std::string openedAt = getString(shift, "opened_at", "2000-01-01 00:00:00");
                double openingCash = getDouble(shift, "opening_cash", 0.0);

                double cashSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND COALESCE(NULLIF(payment_method, ''), 'cash') = 'cash' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();
                double bankingSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND payment_method = 'banking' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();
                double cardSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND payment_method = 'card' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();

                double cashIn = db.queryScalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE shift_id = :sid AND trans_type = 'in'",
                    {{":sid", shiftId}}
                ).get<double>();
                double cashOut = db.queryScalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE shift_id = :sid AND trans_type = 'out'",
                    {{":sid", shiftId}}
                ).get<double>();

                double expectedCash = openingCash + cashSales + cashIn - cashOut;
                double actualCash = getDouble(body, "actual_cash", expectedCash);
                std::string closeNote = getString(body, "note", "Bàn giao cuối ca");
                double discrepancy = actualCash - expectedCash;
                std::string nowStr = getCurrentTimestamp();

                db.beginTransaction();
                db.execute(R"(
                    UPDATE pos_shifts SET
                        closed_at = :ca, cash_sales = :cs, banking_sales = :bs, card_sales = :cds,
                        cash_in = :ci, cash_out = :co, expected_cash = :ec, actual_cash = :ac,
                        discrepancy = :diff, note = COALESCE(note, '') || ' | Kết ca: ' || :nt,
                        status = 'closed'
                    WHERE id = :id
                )", {
                    {":ca", nowStr}, {":cs", cashSales}, {":bs", bankingSales}, {":cds", cardSales},
                    {":ci", cashIn}, {":co", cashOut}, {":ec", expectedCash}, {":ac", actualCash},
                    {":diff", discrepancy}, {":nt", closeNote}, {":id", shiftId}
                });

                std::string sev = "INFO";
                if (std::abs(discrepancy) >= 50000.0) sev = "CRITICAL";
                else if (std::abs(discrepancy) >= 1000.0) sev = "WARN";

                std::string diffLabel = (discrepancy == 0) ? "Khớp 100%" : (discrepancy < 0 ? ("Thiếu hụt " + std::to_string(static_cast<int64_t>(std::abs(discrepancy))) + "đ") : ("Dư " + std::to_string(static_cast<int64_t>(discrepancy)) + "đ"));

                db.execute(R"(
                    INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                    VALUES (:acode, :albl, :sev, 0, :sc, 'BÀN GIAO CA', :amt, :rsn, :uid, :uname, :urole, :dtl, :cat)
                )", {
                    {":acode", std::abs(discrepancy) >= 1000.0 ? "SHIFT_DISCREPANCY" : "CLOSE_SHIFT"},
                    {":albl", "Kết ca " + shiftCode + " (" + diffLabel + ")"},
                    {":sev", sev},
                    {":sc", shiftCode},
                    {":amt", std::abs(discrepancy)},
                    {":rsn", closeNote},
                    {":uid", uId}, {":uname", uName}, {":urole", uRole},
                    {":dtl", "Lý thuyết: " + std::to_string(static_cast<int64_t>(expectedCash)) + "đ | Thực đếm: " + std::to_string(static_cast<int64_t>(actualCash)) + "đ"},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã kết ca " + shiftCode + " thành công! Đối soát két: " + diffLabel},
                    {"expected_cash", expectedCash},
                    {"actual_cash", actualCash},
                    {"discrepancy", discrepancy}
                });
                return;
            }
        }

        sendError(res, "Invalid finance request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi sổ quỹ: ") + e.what()}}, 500);
    }
}

// ==========================================
// 8. SETTINGS HANDLER (Bước 4.1 & Server LAN Network Detection)
// ==========================================
struct LanAdapterInfo {
    std::string ip;
    std::string adapterName;
    std::string description;
    bool isVirtual = false;
    bool isPrimary = false;
};

static std::vector<LanAdapterInfo> getDetectedLanIps() {
    std::vector<LanAdapterInfo> list;
#ifdef _WIN32
    ULONG bufLen = 15000;
    PIP_ADAPTER_ADDRESSES pAddresses = (IP_ADAPTER_ADDRESSES*)malloc(bufLen);
    if (!pAddresses) return list;

    DWORD ret = GetAdaptersAddresses(AF_INET, GAA_FLAG_INCLUDE_PREFIX, NULL, pAddresses, &bufLen);
    if (ret == ERROR_BUFFER_OVERFLOW) {
        free(pAddresses);
        pAddresses = (IP_ADAPTER_ADDRESSES*)malloc(bufLen);
        if (!pAddresses) return list;
        ret = GetAdaptersAddresses(AF_INET, GAA_FLAG_INCLUDE_PREFIX, NULL, pAddresses, &bufLen);
    }

    if (ret == NO_ERROR) {
        for (PIP_ADAPTER_ADDRESSES pCurr = pAddresses; pCurr; pCurr = pCurr->Next) {
            if (pCurr->IfType == IF_TYPE_SOFTWARE_LOOPBACK) continue;
            if (pCurr->OperStatus != IfOperStatusUp) continue;

            std::wstring wFriendly(pCurr->FriendlyName ? pCurr->FriendlyName : L"");
            std::string friendlyName(wFriendly.begin(), wFriendly.end());

            std::wstring wDesc(pCurr->Description ? pCurr->Description : L"");
            std::string desc(wDesc.begin(), wDesc.end());

            std::string dLower = desc;
            for (auto& c : dLower) c = (char)::tolower(c);
            std::string nLower = friendlyName;
            for (auto& c : nLower) c = (char)::tolower(c);

            bool isVirt = (dLower.find("virtual") != std::string::npos ||
                           dLower.find("vmware") != std::string::npos ||
                           dLower.find("hyper-v") != std::string::npos ||
                           dLower.find("vethernet") != std::string::npos ||
                           dLower.find("loopback") != std::string::npos ||
                           dLower.find("wsl") != std::string::npos ||
                           dLower.find("tap") != std::string::npos ||
                           dLower.find("radmin") != std::string::npos ||
                           dLower.find("zerotier") != std::string::npos ||
                           dLower.find("tailscale") != std::string::npos ||
                           dLower.find("wireguard") != std::string::npos ||
                           dLower.find("bluetooth") != std::string::npos ||
                           nLower.find("wsl") != std::string::npos);

            for (PIP_ADAPTER_UNICAST_ADDRESS pUnicast = pCurr->FirstUnicastAddress; pUnicast; pUnicast = pUnicast->Next) {
                if (pUnicast->Address.lpSockaddr && pUnicast->Address.lpSockaddr->sa_family == AF_INET) {
                    sockaddr_in* sa_in = (sockaddr_in*)pUnicast->Address.lpSockaddr;
                    char ipStr[INET_ADDRSTRLEN] = {0};
                    inet_ntop(AF_INET, &(sa_in->sin_addr), ipStr, INET_ADDRSTRLEN);
                    std::string ip(ipStr);
                    if (!ip.empty() && ip != "127.0.0.1" && ip.find("169.254.") != 0) {
                        LanAdapterInfo info;
                        info.ip = ip;
                        info.adapterName = friendlyName.empty() ? "LAN Adapter" : friendlyName;
                        info.description = desc;
                        info.isVirtual = isVirt;
                        list.push_back(info);
                    }
                }
            }
        }
    }
    if (pAddresses) free(pAddresses);

    if (list.empty()) {
        char host[256] = {0};
        if (gethostname(host, sizeof(host)) == 0) {
            struct addrinfo hints = {0}, *res = nullptr;
            hints.ai_family = AF_INET;
            hints.ai_socktype = SOCK_STREAM;
            if (getaddrinfo(host, nullptr, &hints, &res) == 0 && res) {
                for (struct addrinfo* ptr = res; ptr != nullptr; ptr = ptr->ai_next) {
                    sockaddr_in* s = (sockaddr_in*)ptr->ai_addr;
                    char ipStr[INET_ADDRSTRLEN] = {0};
                    inet_ntop(AF_INET, &(s->sin_addr), ipStr, INET_ADDRSTRLEN);
                    std::string ip(ipStr);
                    if (!ip.empty() && ip != "127.0.0.1" && ip.find("169.254.") != 0) {
                        LanAdapterInfo info;
                        info.ip = ip;
                        info.adapterName = "Local Network";
                        info.isVirtual = false;
                        list.push_back(info);
                    }
                }
                freeaddrinfo(res);
            }
        }
    }
#endif
    // Sort so physical adapters (isVirtual == false) come first
    std::stable_sort(list.begin(), list.end(), [](const LanAdapterInfo& a, const LanAdapterInfo& b) {
        return (!a.isVirtual && b.isVirtual);
    });

    if (!list.empty()) {
        list[0].isPrimary = true;
    }
    return list;
}

void ApiHandlers::handleSettings(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);

        if (req.method == "GET") {
            json rows = db.query("SELECT setting_key, setting_value FROM store_settings");
            json map = {
                {"store_name", "GÓC PHỐ COFFEE & TEA"},
                {"store_hotline", "0932.885.131"},
                {"store_address", "123 Đường Số 5, P. Linh Trung, TP. Thủ Đức, TP.HCM"},
                {"store_wifi", "gocpho@2024"},
                {"store_wifi_ssid", "GocPho_Coffee_5G"},
                {"bank_id", "OCB"},
                {"bank_account_no", "0918608073"},
                {"bank_account_name", "NGUYEN CHI HUNG"},
                {"server_port", "8501"},
                {"app_version", "v2.2"},
                {"db_driver", "sqlite"}
            };
            bool hasGemini = false;
            for (const auto& r : rows) {
                std::string k = r.value("setting_key", "");
                std::string v = r.value("setting_value", "");
                if (k == "gemini_api_key") {
                    if (!v.empty()) hasGemini = true;
                    continue; // Never expose raw Gemini API key
                }
                map[k] = v;
            }
            map["has_gemini_key"] = hasGemini;
            json qSnap;
            if (fetchMasterAiQuota(qSnap)) {
                map["ai_quota"] = qSnap.value("ai_quota", json::object());
                map["master_has_ai_key"] = qSnap.value("master_has_key", false);
            }

            // Detect Local LAN IPs
            auto detected = getDetectedLanIps();
            json ipArr = json::array();
            std::string primaryIp = "";
            for (const auto& item : detected) {
                if (primaryIp.empty() || item.isPrimary) {
                    primaryIp = item.ip;
                }
                ipArr.push_back({
                    {"ip", item.ip},
                    {"adapter", item.adapterName},
                    {"description", item.description},
                    {"is_primary", item.isPrimary}
                });
            }
            map["detected_ips"] = ipArr;
            map["primary_lan_ip"] = primaryIp;

            // If store_settings does not have server_ip yet, default to primary detected IP
            if (!map.contains("server_ip") || map["server_ip"].get<std::string>().empty()) {
                map["server_ip"] = primaryIp;
            }
            std::string finalServerIp = map["server_ip"].get<std::string>();
            std::string finalServerPort = map.value("server_port", "8501");
            if (finalServerPort.empty()) finalServerPort = "8501";
            map["server_base_url"] = "http://" + (finalServerIp.empty() ? "localhost" : finalServerIp) + ":" + finalServerPort + "/";

            sendJson(res, {{"success", true}, {"data", map}});
            return;
        }

        if (req.method == "POST") {
            if (body.empty()) {
                sendJson(res, {{"success", false}, {"message", "Không có dữ liệu gửi lên!"}}, 400);
                return;
            }

            for (auto it = body.begin(); it != body.end(); ++it) {
                std::string k = it.key();
                std::string v = it.value().is_string() ? it.value().get<std::string>() : it.value().dump();

                if (k == "gemini_api_key") {
                    if (v.empty() || v.find("•••") != std::string::npos || v.find("***") != std::string::npos) {
                        continue;
                    }
                    if (v == "__DELETE__") {
                        db.execute("DELETE FROM store_settings WHERE setting_key = 'gemini_api_key'");
                        continue;
                    }
                }

                db.execute(
                    "INSERT INTO store_settings (setting_key, setting_value) VALUES (:k, :v) "
                    "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                    {{":k", k}, {":v", v}}
                );
            }
            sendJson(res, {{"success", true}, {"message", "Đã lưu cài đặt cửa hàng!"}});
            return;
        }

        sendError(res, "Invalid settings request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi cài đặt: ") + e.what()}}, 500);
    }
}

// ==========================================
// 9. USERS / STAFF HANDLER (Bước 4.2)
// ==========================================
void ApiHandlers::handleUsers(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);

        if (req.method == "GET" && action.empty()) {
            json list = db.query(
                "SELECT id, user_code, username, fullname, role, phone, pin_code, status, is_online, created_at "
                "FROM users WHERE status != 'deleted' ORDER BY id ASC"
            );
            sendJson(res, {{"success", true}, {"data", list}});
            return;
        }

        if (req.method == "POST" || req.method == "PUT") {
            if (action == "add" || action.empty()) {
                std::string username = getString(body, "username");
                std::string fullname = getString(body, "fullname");
                std::string role = getString(body, "role", "waiter");
                std::string phone = getString(body, "phone");
                std::string pin = getString(body, "pin_code");
                std::string pass = getString(body, "password");
                std::string userCode = getString(body, "user_code");

                if (username.empty() || fullname.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng nhập tên tài khoản và họ tên!"}}, 400);
                    return;
                }

                // Check duplicate username
                auto existingUser = db.queryRow("SELECT id FROM users WHERE LOWER(username) = LOWER(:u)", {{":u", username}});
                if (!existingUser.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Tên tài khoản này đã tồn tại!"}}, 400);
                    return;
                }

                // Generate user_code if empty
                if (userCode.empty()) {
                    std::string prefix = "STF";
                    if (role == "admin") prefix = "ADM";
                    else if (role == "cashier") prefix = "ACC";
                    else if (role == "kitchen") prefix = "KIT";
                    else if (role == "customer") prefix = "USR";

                    json codes = db.query("SELECT user_code FROM users WHERE user_code LIKE :p ORDER BY id DESC",
                                         {{":p", prefix + "%"}});
                    int maxNum = 0;
                    for (const auto& c : codes) {
                        std::string s = c.value("user_code", "");
                        if (s.rfind(prefix, 0) == 0 && s.length() > prefix.length()) {
                            try {
                                int n = std::stoi(s.substr(prefix.length()));
                                if (n > maxNum) maxNum = n;
                            } catch (...) {}
                        }
                    }
                    char codeBuf[32];
                    std::snprintf(codeBuf, sizeof(codeBuf), "%s%03d", prefix.c_str(), maxNum + 1);
                    userCode = codeBuf;
                } else {
                    auto chk = db.queryRow("SELECT id FROM users WHERE UPPER(user_code) = UPPER(:c)", {{":c", userCode}});
                    if (!chk.is_null()) {
                        sendJson(res, {{"success", false}, {"message", "Mã người dùng [" + userCode + "] đã tồn tại!"}}, 400);
                        return;
                    }
                }

                if (pass.empty()) {
                    pass = "123456";
                }
                if (pin.empty()) {
                    pin = "1234";
                }

                std::string hashedPass = AuthService::hashPassword(pass);

                int64_t newId = db.execute(R"(
                    INSERT INTO users (user_code, username, password, fullname, role, phone, pin_code, status, created_at)
                    VALUES (:c, :u, :p, :f, :r, :ph, :pin, 'active', datetime('now'))
                )", {
                    {":c", userCode},
                    {":u", username},
                    {":p", hashedPass},
                    {":f", fullname},
                    {":r", role},
                    {":ph", phone},
                    {":pin", pin}
                });

                sendJson(res, {
                    {"success", true},
                    {"message", "Thêm người dùng " + fullname + " (" + userCode + ") thành công!"},
                    {"id", newId},
                    {"user_code", userCode}
                });
                return;
            }

            if (action == "update") {
                int64_t id = getInt(body, "id");
                std::string fullname = getString(body, "fullname");
                std::string role = getString(body, "role", "waiter");
                std::string phone = getString(body, "phone");
                std::string pin = getString(body, "pin_code");
                std::string status = getString(body, "status", "active");
                std::string userCode = getString(body, "user_code");

                if (id <= 0 || fullname.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Thông tin cập nhật không hợp lệ!"}}, 400);
                    return;
                }

                if (!userCode.empty()) {
                    auto chk = db.queryRow("SELECT id FROM users WHERE UPPER(user_code) = UPPER(:c) AND id != :id",
                                          {{":c", userCode}, {":id", id}});
                    if (!chk.is_null()) {
                        sendJson(res, {{"success", false}, {"message", "Mã người dùng [" + userCode + "] đã được tài khoản khác sử dụng!"}}, 400);
                        return;
                    }
                }

                db.execute(R"(
                    UPDATE users
                    SET user_code = COALESCE(NULLIF(:c, ''), user_code),
                        fullname = :f,
                        role = :r,
                        phone = :ph,
                        pin_code = COALESCE(NULLIF(:pin, ''), pin_code),
                        status = :s
                    WHERE id = :id
                )", {
                    {":c", userCode},
                    {":f", fullname},
                    {":r", role},
                    {":ph", phone},
                    {":pin", pin},
                    {":s", status},
                    {":id", id}
                });

                sendJson(res, {{"success", true}, {"message", "Cập nhật thông tin người dùng thành công!"}});
                return;
            }

            if (action == "reset_password") {
                int64_t id = getInt(body, "id");
                std::string newPass = getString(body, "new_password");
                std::string newPin = getString(body, "new_pin");

                if (id <= 0) {
                    sendJson(res, {{"success", false}, {"message", "Mã nhân viên không hợp lệ!"}}, 400);
                    return;
                }

                if (!newPass.empty()) {
                    if (newPass.length() < 6) {
                        sendJson(res, {{"success", false}, {"message", "Mật khẩu mới phải có ít nhất 6 ký tự!"}}, 400);
                        return;
                    }
                    std::string hashed = AuthService::hashPassword(newPass);
                    db.execute("UPDATE users SET password = :p WHERE id = :id", {{":p", hashed}, {":id", id}});
                }

                if (!newPin.empty()) {
                    db.execute("UPDATE users SET pin_code = :p WHERE id = :id", {{":p", newPin}, {":id", id}});
                }

                sendJson(res, {{"success", true}, {"message", "Đặt lại mật khẩu/mã PIN thành công!"}});
                return;
            }

            if (action == "delete") {
                int64_t id = getInt(body, "id");
                db.execute("UPDATE users SET status = 'deleted' WHERE id = :id", {{":id", id}});
                sendJson(res, {{"success", true}, {"message", "Đã xóa người dùng!"}});
                return;
            }
        }

        sendError(res, "Invalid users request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi người dùng: ") + e.what()}}, 500);
    }
}


// ==========================================
// 10. OPERATIONS & MATERIALS HANDLER
// ==========================================
void ApiHandlers::handleOperations(const httplib::Request& req, httplib::Response& res) {
    auto& db = Database::instance();
    json body = parseBody(req);
    std::string action = getAction(req, body);

    if (req.method == "GET") {
        if (action == "materials" || action.empty()) {
            if (!requireModule(res, "inventory_recipes", "Quản Lý Kho & Định Lượng")) return;
            json mats = db.query("SELECT * FROM materials WHERE status = 'active' ORDER BY id ASC");
            sendJson(res, {{"success", true}, {"data", mats}});
            return;
        }
        if (action == "transactions") {
            if (!requireModule(res, "inventory_recipes", "Quản Lý Kho & Định Lượng")) return;
            json tx = db.query("SELECT * FROM material_transactions ORDER BY id DESC LIMIT 50");
            sendJson(res, {{"success", true}, {"data", tx}});
            return;
        }
        if (action == "attendances") {
            if (!requireModule(res, "staff_shifts", "Nhân Viên, Phân Ca & Chấm Công")) return;
            json att = db.query("SELECT * FROM attendances ORDER BY id DESC LIMIT 50");
            sendJson(res, {{"success", true}, {"data", att}});
            return;
        }
        if (action == "get_realtime_staff") {
            if (!requireModule(res, "staff_shifts", "Nhân Viên, Phân Ca & Chấm Công")) return;
            autoProcessShifts(db);
            std::string nowTs = getCurrentTimestamp();
            std::time_t nowSec = parseTimestampLocal(nowTs);
            std::string serverTime = (nowTs.size() >= 19) ? nowTs.substr(11, 8) : nowTs;

            json rows = db.query(R"(
                SELECT a.id AS attendance_id, a.user_id, a.check_in_time, a.device_info,
                       a.hourly_rate AS att_rate,
                       u.username, u.fullname, u.user_code, u.role,
                       u.hourly_rate AS user_rate, u.last_active_at
                FROM attendances a
                JOIN users u ON a.user_id = u.id
                WHERE a.status = 'working'
                ORDER BY a.check_in_time DESC
            )");

            int cashier = 0, kitchen = 0, waiter = 0, admin = 0;
            json staffList = json::array();
            for (const auto& r : rows) {
                std::string role = r.value("role", "");
                if (role == "cashier") cashier++;
                else if (role == "kitchen") kitchen++;
                else if (role == "waiter") waiter++;
                else if (role == "admin") admin++;

                std::string checkIn = r.value("check_in_time", "");
                std::string checkInDisp = (checkIn.size() >= 16) ? checkIn.substr(11, 5) : checkIn;
                double attRate = r.value("att_rate", 0.0);
                double userRate = r.value("user_rate", 0.0);
                double rate = (attRate > 0.0) ? attRate : userRate;

                std::string lastActive = r.value("last_active_at", "");
                std::time_t activeSec = parseTimestampLocal(lastActive);
                bool recentlyActive = (activeSec > 0 && nowSec >= activeSec && (nowSec - activeSec) <= 120);

                staffList.push_back({
                    {"attendance_id", r.value("attendance_id", int64_t(0))},
                    {"user_id", r.value("user_id", int64_t(0))},
                    {"username", r.value("username", "")},
                    {"fullname", r.value("fullname", "")},
                    {"user_code", r.value("user_code", "")},
                    {"role", role},
                    {"check_in_display", checkInDisp},
                    {"elapsed_display", formatElapsedHMS(checkIn, nowTs)},
                    {"hourly_rate", rate},
                    {"is_recently_active", recentlyActive},
                    {"device_info", r.value("device_info", "")}
                });
            }

            sendJson(res, {
                {"success", true},
                {"server_time", serverTime},
                {"summary", {
                    {"cashier", cashier},
                    {"kitchen", kitchen},
                    {"waiter", waiter},
                    {"admin", admin},
                    {"total_working", static_cast<int>(staffList.size())}
                }},
                {"staff_list", staffList}
            });
            return;
        }
        if (action == "get_payroll") {
            if (!requireModule(res, "staff_shifts", "Nhân Viên, Phân Ca & Chấm Công")) return;
            autoProcessShifts(db);
            std::string nowTs = getCurrentTimestamp();
            std::string month = req.has_param("month") ? req.get_param_value("month") : getCurrentDate().substr(0, 7);
            if (month.empty()) month = getCurrentDate().substr(0, 7);
            std::string monthPrefix = month + "%";

            json users = db.query("SELECT id, user_code, fullname, username, role, hourly_rate FROM users WHERE status = 'active' ORDER BY id ASC");
            json monthAtts = db.query(
                "SELECT id, user_id, work_date, check_in_time, check_out_time, work_hours, hourly_rate, total_pay, status "
                "FROM attendances WHERE work_date LIKE :mp ORDER BY id DESC",
                {{":mp", monthPrefix}}
            );

            struct UserAgg {
                double totalHours = 0.0;
                double totalSalary = 0.0;
                std::map<std::string, int> shiftsPerDay;
            };
            std::map<int64_t, UserAgg> aggMap;

            for (const auto& a : monthAtts) {
                int64_t uid = a.value("user_id", int64_t(0));
                std::string wdate = a.value("work_date", "");
                std::string status = a.value("status", "");
                double hrs = a.value("work_hours", 0.0);
                double rate = a.value("hourly_rate", 0.0);
                double pay = a.value("total_pay", 0.0);
                if (status == "working") {
                    hrs = calcHoursBetween(a.value("check_in_time", ""), nowTs);
                    pay = std::round(hrs * rate);
                }
                auto& ag = aggMap[uid];
                ag.totalHours += hrs;
                ag.totalSalary += pay;
                if (!wdate.empty()) ag.shiftsPerDay[wdate]++;
            }

            double totalCompanyHours = 0.0;
            double totalCompanySalary = 0.0;
            json payrollSummary = json::array();
            for (const auto& u : users) {
                int64_t uid = u.value("id", int64_t(0));
                std::string fullname = u.value("fullname", "");
                if (fullname.empty()) fullname = u.value("username", "");
                double rate = u.value("hourly_rate", 0.0);
                const auto& ag = aggMap[uid];
                int totalShifts = 0;
                for (const auto& kv : ag.shiftsPerDay) {
                    totalShifts += std::min(kv.second, 2);
                }
                double hrsRounded = std::round(ag.totalHours * 100.0) / 100.0;
                double salRounded = std::round(ag.totalSalary);
                totalCompanyHours += hrsRounded;
                totalCompanySalary += salRounded;

                payrollSummary.push_back({
                    {"user_id", uid},
                    {"user_code", u.value("user_code", "")},
                    {"fullname", fullname},
                    {"role", u.value("role", "")},
                    {"hourly_rate", rate},
                    {"total_shifts", totalShifts},
                    {"total_hours", hrsRounded},
                    {"total_salary", salRounded}
                });
            }

            std::string filterUid = req.has_param("user_id") ? req.get_param_value("user_id") : "";
            std::string filterSearch = req.has_param("search") ? req.get_param_value("search") : "";
            std::string filterFrom = req.has_param("from_date") ? req.get_param_value("from_date") : "";
            std::string filterTo = req.has_param("to_date") ? req.get_param_value("to_date") : "";
            std::string filterStatus = req.has_param("status") ? req.get_param_value("status") : "";

            std::string whereSql = "WHERE 1=1";
            std::vector<std::pair<std::string, json>> params;
            if (!filterFrom.empty() || !filterTo.empty()) {
                if (!filterFrom.empty()) {
                    whereSql += " AND work_date >= :from_d";
                    params.emplace_back(":from_d", filterFrom);
                }
                if (!filterTo.empty()) {
                    whereSql += " AND work_date <= :to_d";
                    params.emplace_back(":to_d", filterTo);
                }
            } else {
                whereSql += " AND work_date LIKE :mp";
                params.emplace_back(":mp", monthPrefix);
            }
            if (!filterUid.empty() && filterUid != "all") {
                whereSql += " AND user_id = :fuid";
                params.emplace_back(":fuid", static_cast<int64_t>(std::stoll(filterUid)));
            }
            if (!filterStatus.empty() && filterStatus != "all") {
                whereSql += " AND status = :fstatus";
                params.emplace_back(":fstatus", filterStatus);
            }
            if (!filterSearch.empty()) {
                whereSql += " AND (LOWER(user_name) LIKE :fsearch OR LOWER(user_code) LIKE :fsearch)";
                std::string sLower = filterSearch;
                std::transform(sLower.begin(), sLower.end(), sLower.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
                params.emplace_back(":fsearch", "%" + sLower + "%");
            }

            json records = db.query(
                "SELECT id, user_id, user_name, user_code, user_role, work_date, check_in_time, check_out_time, "
                "work_hours, hourly_rate, total_pay, status, device_info, note "
                "FROM attendances " + whereSql + " ORDER BY id DESC LIMIT 200",
                params
            );
            for (auto& rec : records) {
                if (rec.value("status", "") == "working") {
                    double hrs = calcHoursBetween(rec.value("check_in_time", ""), nowTs);
                    double rate = rec.value("hourly_rate", 0.0);
                    rec["work_hours"] = hrs;
                    rec["total_pay"] = std::round(hrs * rate);
                }
            }

            sendJson(res, {
                {"success", true},
                {"total_company_hours", std::round(totalCompanyHours * 100.0) / 100.0},
                {"total_company_salary", std::round(totalCompanySalary)},
                {"payroll_summary", payrollSummary},
                {"attendance_records", records}
            });
            return;
        }
        if (action == "get_shift_settings") {
            if (!requireModule(res, "staff_shifts", "Nhân Viên, Phân Ca & Chấm Công")) return;
            ShiftCfg cfg = loadShiftCfg(db);
            sendJson(res, {
                {"success", true},
                {"data", {
                    {"shift1_name", cfg.s1Name},
                    {"shift1_start", cfg.s1Start},
                    {"shift1_end", cfg.s1End},
                    {"shift2_name", cfg.s2Name},
                    {"shift2_start", cfg.s2Start},
                    {"shift2_end", cfg.s2End},
                    {"shift_grace_minutes", cfg.graceMinutes},
                    {"shift_autoclose_enabled", cfg.autoClose ? 1 : 0}
                }}
            });
            return;
        }
    }

    if (req.method == "POST") {
        if (action == "add_transaction") {
            if (!requireModule(res, "inventory_recipes", "Quản Lý Kho & Định Lượng")) return;
            int64_t matId = body.value("material_id", 0);
            std::string type = body.value("trans_type", "in"); // in, out, loss
            double qty = body.value("quantity", 0.0);
            double price = body.value("unit_price", 0.0);
            std::string note = body.value("note", "");

            auto mat = db.queryRow("SELECT name, unit, quantity FROM materials WHERE id = :id", {{":id", matId}});
            if (mat.is_null()) {
                sendError(res, "Nguyên vật liệu không tồn tại!");
                return;
            }

            std::string matName = mat.value("name", "");
            std::string unit = mat.value("unit", "kg");
            double currentQty = mat.value("quantity", 0.0);
            double newQty = (type == "in") ? (currentQty + qty) : (currentQty - qty);

            db.beginTransaction();
            db.execute(R"(
                INSERT INTO material_transactions (material_id, material_name, trans_type, quantity, unit, unit_price, total_cost, note)
                VALUES (:id, :name, :type, :qty, :unit, :price, :cost, :note)
            )", {
                {":id", matId}, {":name", matName}, {":type", type},
                {":qty", qty}, {":unit", unit}, {":price", price},
                {":cost", qty * price}, {":note", note}
            });

            db.execute("UPDATE materials SET quantity = :q WHERE id = :id", {{":q", newQty}, {":id", matId}});
            db.commit();

            sendJson(res, {{"success", true}, {"message", "Ghi nhận phiếu kho thành công!"}, {"new_quantity", newQty}});
            return;
        }
        if (action == "manual_checkout") {
            if (!requireModule(res, "staff_shifts", "Nhân Viên, Phân Ca & Chấm Công")) return;
            int64_t attId = body.value("attendance_id", int64_t(0));
            int64_t userId = body.value("user_id", int64_t(0));
            std::string nowTs = getCurrentTimestamp();

            if (attId > 0) {
                auto row = db.queryRow("SELECT user_id FROM attendances WHERE id = :id", {{":id", attId}});
                if (!row.is_null() && userId <= 0) {
                    userId = row.value("user_id", int64_t(0));
                }
                closeStaffAttendance(db, attId, nowTs, "Quản lý chốt ca thủ công");
            } else if (userId > 0) {
                json openRows = db.query("SELECT id FROM attendances WHERE user_id = :uid AND status = 'working'", {{":uid", userId}});
                for (const auto& r : openRows) {
                    closeStaffAttendance(db, r.value("id", int64_t(0)), nowTs, "Quản lý chốt ca thủ công");
                }
            } else {
                sendError(res, "Thiếu thông tin ca làm việc!");
                return;
            }

            if (userId > 0) {
                auto rem = db.queryRow("SELECT COUNT(*) AS cnt FROM attendances WHERE user_id = :uid AND status = 'working'", {{":uid", userId}});
                if (rem.is_null() || rem.value("cnt", 0) == 0) {
                    db.execute("UPDATE users SET is_online = 0 WHERE id = :uid", {{":uid", userId}});
                }
            }
            sendJson(res, {{"success", true}, {"message", "Đã chốt ca thành công!"}});
            return;
        }
        if (action == "update_hourly_rate") {
            if (!requireModule(res, "staff_shifts", "Nhân Viên, Phân Ca & Chấm Công")) return;
            int64_t userId = body.value("user_id", int64_t(0));
            double rate = body.value("hourly_rate", 0.0);
            if (userId <= 0 || rate < 0) {
                sendError(res, "Thông tin mức lương không hợp lệ!");
                return;
            }
            db.execute("UPDATE users SET hourly_rate = :r WHERE id = :uid", {{":r", rate}, {":uid", userId}});
            db.execute("UPDATE attendances SET hourly_rate = :r WHERE user_id = :uid AND status = 'working'", {{":r", rate}, {":uid", userId}});
            sendJson(res, {{"success", true}, {"message", "Đã cập nhật mức lương/giờ!"}});
            return;
        }
        if (action == "save_shift_settings") {
            if (!requireModule(res, "staff_shifts", "Nhân Viên, Phân Ca & Chấm Công")) return;
            auto upsert = [&](const std::string& k, const std::string& v) {
                db.execute(
                    "INSERT OR REPLACE INTO store_settings (setting_key, setting_value) VALUES (:k, :v)",
                    {{":k", k}, {":v", v}}
                );
            };
            db.beginTransaction();
            upsert("shift1_name", body.value("shift1_name", std::string("Ca 1 (Ca Sáng)")));
            upsert("shift1_start", body.value("shift1_start", std::string("06:30")));
            upsert("shift1_end", body.value("shift1_end", std::string("12:30")));
            upsert("shift2_name", body.value("shift2_name", std::string("Ca 2 (Ca Chiều / Tối)")));
            upsert("shift2_start", body.value("shift2_start", std::string("12:30")));
            upsert("shift2_end", body.value("shift2_end", std::string("22:30")));
            int grace = body.value("shift_grace_minutes", 15);
            upsert("shift_grace_minutes", std::to_string(std::max(0, grace)));
            int autoClose = 1;
            if (body.contains("shift_autoclose_enabled")) {
                if (body["shift_autoclose_enabled"].is_boolean()) {
                    autoClose = body["shift_autoclose_enabled"].get<bool>() ? 1 : 0;
                } else {
                    autoClose = body.value("shift_autoclose_enabled", 1) ? 1 : 0;
                }
            }
            upsert("shift_autoclose_enabled", std::to_string(autoClose));
            db.commit();
            sendJson(res, {{"success", true}, {"message", "Đã lưu cấu hình khung giờ ca!"}});
            return;
        }
        if (action == "ai_parse_invoice") {
            if (!requireModule(res, "ai_invoice_ocr", "AI OCR Hóa Đơn & Giấy Viết Tay")) return;
            std::string imgB64Raw = body.value("image_base64", "");
            std::string passedKey = body.value("gemini_api_key", "");
            if (imgB64Raw.empty()) {
                sendError(res, "Thiếu dữ liệu ảnh hóa đơn!", 400);
                return;
            }

            std::string mime, pureB64;
            SaleApp::AI::parseDataUriImage(imgB64Raw, mime, pureB64);
            std::string rawBytes = SaleApp::AI::base64Decode(pureB64);
            std::string invoiceImageUrl = "";
            if (!rawBytes.empty()) {
                std::string ext = (mime.find("png") != std::string::npos) ? ".png" : ".jpg";
                auto nowMs = std::chrono::system_clock::now().time_since_epoch().count();
                std::string saveName = "inv_" + AuthService::sha256(pureB64.substr(0, 64) + std::to_string(nowMs)).substr(0, 20) + ext;
                namespace fs = std::filesystem;
                fs::path invDir = SaleApp::Config::AppConfig::instance().getUploadsDir() / "invoices";
                fs::create_directories(invDir);
                std::ofstream ofs(invDir / saveName, std::ios::binary);
                if (ofs) {
                    ofs.write(rawBytes.data(), rawBytes.size());
                    ofs.close();
                    invoiceImageUrl = "uploads/invoices/" + saveName;
                }
            }

            json parsed;
            std::string modelUsed, err;
            std::string localKey = resolveGeminiApiKey(db, passedKey);
            if (!localKey.empty()) {
                std::string prompt =
                    "Bạn là kế toán AI chuyên bóc tách hóa đơn nhập hàng F&B (hóa đơn in nhiệt hoặc giấy viết tay tiếng Việt). "
                    "Hãy đọc ảnh hóa đơn này và trả về đúng 1 JSON object có cấu trúc sau (không thêm markdown): "
                    "{\"supplier\": \"Tên nhà cung cấp hoặc chuỗi rỗng\", \"invoice_no\": \"Số hóa đơn hoặc chuỗi rỗng\", "
                    "\"items\": [{\"raw_name\": \"Tên nguyên liệu\", \"quantity\": 1, \"unit\": \"kg\", \"unit_price\": 0, \"total_cost\": 0}]}. "
                    "Lưu ý: số tiền bằng VNĐ (số nguyên), nếu thiếu đơn giá hãy tính unit_price = total_cost / quantity.";
                json contents = json::array({
                    {{"parts", json::array({
                        {{"text", prompt}},
                        {{"inlineData", {{"mimeType", mime}, {"data", pureB64}}}}
                    })}}
                });
                std::string textOut;
                if (!SaleApp::AI::geminiGenerateContentText(localKey, contents, true, textOut, modelUsed, err)) {
                    sendError(res, "Lỗi phân tích AI OCR: " + err, 502);
                    return;
                }
                try { parsed = json::parse(textOut); } catch (...) {
                    sendError(res, "AI trả về định dạng không phải JSON hợp lệ.", 502);
                    return;
                }
            } else {
                json proxyResp;
                if (!callMasterAiProxy({{"action", "parse_invoice"}, {"mime_type", mime}, {"image_base64", pureB64}}, proxyResp, err)) {
                    sendError(res, err, 502);
                    return;
                }
                parsed = proxyResp.value("parsed", json::object());
                modelUsed = proxyResp.value("ai_engine", "CyberNexus Master AI");
            }

            json existingMats = db.query("SELECT id, code, name, unit FROM materials WHERE status = 'active'");
            auto toLower = [](std::string s) {
                std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
                return s;
            };

            json itemsOut = json::array();
            if (parsed.contains("items") && parsed["items"].is_array()) {
                for (const auto& it : parsed["items"]) {
                    std::string rawName = it.value("raw_name", it.value("name", ""));
                    double qty = it.value("quantity", 1.0);
                    std::string unit = it.value("unit", "kg");
                    double unitPrice = it.value("unit_price", 0.0);
                    double totalCost = it.value("total_cost", qty * unitPrice);
                    if (unitPrice <= 0 && qty > 0 && totalCost > 0) unitPrice = std::round(totalCost / qty);
                    if (totalCost <= 0 && unitPrice > 0) totalCost = std::round(qty * unitPrice);

                    bool matched = false;
                    int64_t matId = 0;
                    std::string matCode;
                    std::string rawLow = toLower(rawName);
                    for (const auto& m : existingMats) {
                        std::string mLow = toLower(m.value("name", ""));
                        if (!mLow.empty() && !rawLow.empty() && (rawLow.find(mLow) != std::string::npos || mLow.find(rawLow) != std::string::npos)) {
                            matched = true;
                            matId = m.value("id", int64_t(0));
                            matCode = m.value("code", "");
                            if (unit.empty()) unit = m.value("unit", "kg");
                            break;
                        }
                    }

                    itemsOut.push_back({
                        {"is_new", !matched},
                        {"material_id", matId},
                        {"material_code", matCode},
                        {"raw_name", rawName},
                        {"quantity", qty},
                        {"unit", unit},
                        {"unit_price", unitPrice},
                        {"total_cost", totalCost}
                    });
                }
            }

            sendJson(res, {
                {"success", true},
                {"supplier", parsed.value("supplier", "")},
                {"invoice_no", parsed.value("invoice_no", "")},
                {"invoice_image_url", invoiceImageUrl},
                {"ai_engine", modelUsed},
                {"items", itemsOut}
            });
            return;
        }
    }

    // KPI & SLA Peak/Off-Peak Management
    if (action == "get_kpi_dashboard") {
        ActiveSlaConfig slaCfg = getActiveSlaConfig(db);
        std::string month = BodyParser::getParam(req, body, "month", getCurrentDate().substr(0, 7));
        if (month.empty() && req.has_param("month")) month = req.get_param_value("month");
        if (month.size() < 7) month = getCurrentDate().substr(0, 7);

        json slots = db.query("SELECT * FROM sla_time_slots ORDER BY start_time ASC, id ASC");
        int baseScore = slaCfg.settings.value("kpi_base_score", 100);

        json staffKpi = db.query(R"(
            SELECT 
                u.id as user_id,
                u.fullname,
                u.username,
                u.role,
                COALESCE(SUM(CASE WHEN substr(kl.created_at, 1, 7) = :m THEN kl.points_delta ELSE 0 END), 0) as delta_points,
                COALESCE(SUM(CASE WHEN substr(kl.created_at, 1, 7) = :m AND kl.event_type IN ('kitchen_ontime', 'waiter_ontime') THEN 1 ELSE 0 END), 0) as ontime_count,
                COALESCE(SUM(CASE WHEN substr(kl.created_at, 1, 7) = :m AND kl.event_type = 'kitchen_rushed' THEN 1 ELSE 0 END), 0) as rushed_count,
                COALESCE(SUM(CASE WHEN substr(kl.created_at, 1, 7) = :m AND kl.event_type = 'waiter_reminded' THEN 1 ELSE 0 END), 0) as reminded_count,
                COALESCE(SUM(CASE WHEN substr(kl.created_at, 1, 7) = :m AND kl.event_type = 'customer_rating' THEN 1 ELSE 0 END), 0) as review_count,
                (SELECT COUNT(*) FROM orders o WHERE (o.user_id = u.id OR o.served_user_id = u.id OR o.kitchen_user_id = u.id) AND substr(o.created_at, 1, 7) = :m AND o.status != 'cancelled') as orders_count
            FROM users u
            LEFT JOIN kpi_logs kl ON kl.user_id = u.id
            WHERE u.status = 'active'
            GROUP BY u.id
            ORDER BY delta_points DESC, orders_count DESC
        )", {{":m", month}});

        for (auto& s : staffKpi) {
            s["base_score"] = baseScore;
            s["kpi_score"] = std::max(0, baseScore + s.value("delta_points", 0));
        }

        json recentLogs = db.query("SELECT * FROM kpi_logs WHERE substr(created_at, 1, 7) = :m ORDER BY id DESC LIMIT 60", {{":m", month}});
        json recentReviews = db.query("SELECT * FROM order_reviews WHERE substr(created_at, 1, 7) = :m ORDER BY id DESC LIMIT 40", {{":m", month}});
        auto revStats = db.queryRow("SELECT COUNT(*) as total_reviews, COALESCE(ROUND(AVG(rating), 2), 0) as avg_rating FROM order_reviews WHERE substr(created_at, 1, 7) = :m", {{":m", month}});

        sendJson(res, {
            {"success", true},
            {"month", month},
            {"settings", slaCfg.settings},
            {"sla_slots", slots},
            {"active_sla", {
                {"kitchen_sla_minutes", slaCfg.kitchenSla},
                {"waiter_sla_minutes", slaCfg.waiterSla},
                {"label", slaCfg.label},
                {"is_peak", slaCfg.isPeak}
            }},
            {"staff_kpi", staffKpi},
            {"recent_logs", recentLogs},
            {"recent_reviews", recentReviews},
            {"review_summary", revStats.is_null() ? json({{"total_reviews", 0}, {"avg_rating", 0}}) : revStats}
        });
        return;
    }

    if (action == "save_kpi_sla_settings") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || userOpt->role != "admin") {
            sendError(res, "Chỉ Chủ quán (Admin) mới được chỉnh cấu hình SLA & KPI!", 403);
            return;
        }
        ensureOrderWorkflowSchema(db);
        auto getIntParam = [&](const std::string& key, int defVal) -> int {
            try { return std::stoi(BodyParser::getParam(req, body, key, std::to_string(defVal))); } catch (...) { return defVal; }
        };
        db.execute(R"(
            UPDATE kpi_sla_settings SET
                default_kitchen_sla = :dks,
                default_waiter_sla = :dws,
                kpi_base_score = :base,
                kpi_kitchen_ontime_pts = :ko,
                kpi_kitchen_rush_penalty = :kr,
                kpi_waiter_ontime_pts = :wo,
                kpi_waiter_remind_penalty = :wr,
                kpi_star_5_pts = :s5,
                kpi_star_4_pts = :s4,
                kpi_star_3_pts = :s3,
                kpi_star_2_pts = :s2,
                kpi_star_1_pts = :s1,
                updated_at = :uat
            WHERE id = 1
        )", {
            {":dks", std::max(1, getIntParam("default_kitchen_sla", 10))},
            {":dws", std::max(1, getIntParam("default_waiter_sla", 3))},
            {":base", std::max(0, getIntParam("kpi_base_score", 100))},
            {":ko", getIntParam("kpi_kitchen_ontime_pts", 2)},
            {":kr", std::abs(getIntParam("kpi_kitchen_rush_penalty", 5))},
            {":wo", getIntParam("kpi_waiter_ontime_pts", 2)},
            {":wr", std::abs(getIntParam("kpi_waiter_remind_penalty", 3))},
            {":s5", getIntParam("kpi_star_5_pts", 5)},
            {":s4", getIntParam("kpi_star_4_pts", 2)},
            {":s3", getIntParam("kpi_star_3_pts", 0)},
            {":s2", getIntParam("kpi_star_2_pts", -3)},
            {":s1", getIntParam("kpi_star_1_pts", -5)},
            {":uat", getCurrentTimestamp()}
        });
        sendJson(res, {{"success", true}, {"message", "Đã lưu cấu hình SLA & KPI thành công!"}});
        return;
    }

    if (action == "save_sla_slot") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || userOpt->role != "admin") {
            sendError(res, "Chỉ Chủ quán (Admin) mới được chỉnh khung giờ SLA!", 403);
            return;
        }
        ensureOrderWorkflowSchema(db);
        int64_t slotId = 0;
        try { slotId = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        std::string name = BodyParser::getParam(req, body, "name", "");
        std::string slotType = BodyParser::getParam(req, body, "slot_type", "peak");
        std::string startTime = BodyParser::getParam(req, body, "start_time", "");
        std::string endTime = BodyParser::getParam(req, body, "end_time", "");
        int kSla = 15, wSla = 5, isActive = 1;
        try { kSla = std::max(1, std::stoi(BodyParser::getParam(req, body, "kitchen_sla_minutes", "15"))); } catch (...) {}
        try { wSla = std::max(1, std::stoi(BodyParser::getParam(req, body, "waiter_sla_minutes", "5"))); } catch (...) {}
        try { isActive = std::stoi(BodyParser::getParam(req, body, "is_active", "1")) != 0 ? 1 : 0; } catch (...) {}

        if (name.empty() || startTime.size() != 5 || endTime.size() != 5) {
            sendError(res, "Vui lòng nhập đầy đủ Tên khung giờ và Giờ bắt đầu / kết thúc (HH:MM)!", 400);
            return;
        }
        if (slotId > 0) {
            db.execute(
                "UPDATE sla_time_slots SET name = :n, slot_type = :st, start_time = :s, end_time = :e, kitchen_sla_minutes = :ks, waiter_sla_minutes = :ws, is_active = :act WHERE id = :id",
                {{":n", name}, {":st", slotType}, {":s", startTime}, {":e", endTime}, {":ks", kSla}, {":ws", wSla}, {":act", isActive}, {":id", slotId}}
            );
        } else {
            db.execute(
                "INSERT INTO sla_time_slots (name, slot_type, start_time, end_time, kitchen_sla_minutes, waiter_sla_minutes, is_active) VALUES (:n, :st, :s, :e, :ks, :ws, :act)",
                {{":n", name}, {":st", slotType}, {":s", startTime}, {":e", endTime}, {":ks", kSla}, {":ws", wSla}, {":act", isActive}}
            );
        }
        sendJson(res, {{"success", true}, {"message", "Đã lưu khung giờ SLA!"}});
        return;
    }

    if (action == "delete_sla_slot") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt || userOpt->role != "admin") {
            sendError(res, "Chỉ Chủ quán (Admin) mới được xóa khung giờ SLA!", 403);
            return;
        }
        int64_t slotId = 0;
        try { slotId = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        if (slotId <= 0) {
            sendError(res, "Thiếu ID khung giờ!", 400);
            return;
        }
        db.execute("DELETE FROM sla_time_slots WHERE id = :id", {{":id", slotId}});
        sendJson(res, {{"success", true}, {"message", "Đã xóa khung giờ SLA!"}});
        return;
    }

    sendError(res, "Invalid operations request");
}

// ==========================================
// 11. LICENSE & SAAS HANDLER (Bước 5.2, 5.4)
// ==========================================
void ApiHandlers::handleLicense(const httplib::Request& req, httplib::Response& res) {
    try {
        json body = parseBody(req);
        std::string action = getAction(req, body);

        if (action == "ping") {
            sendJson(res, {
                {"success", true},
                {"time", std::time(nullptr)},
                {"machine_id", LicenseService::instance().getMachineId()}
            });
            return;
        }

        if (action == "check" || action == "status" || action.empty()) {
            json status = LicenseService::instance().getLicenseStatus();
            sendJson(res, status);
            return;
        }

        if (action == "activate") {
            std::string key = getString(body, "license_key");
            json act = LicenseService::instance().activateLicense(key);
            sendJson(res, act, act.value("success", false) ? 200 : 400);
            return;
        }

        sendError(res, "Invalid license request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi license: ") + e.what()}}, 500);
    }
}

// ==========================================
// 12. LICENSE CLIENT API (Bước 5.4)
// ==========================================
void ApiHandlers::handleLicenseClient(const httplib::Request& req, httplib::Response& res) {
    try {
        json body = parseBody(req);
        std::string action = getAction(req, body);

        if (action == "status" || action.empty()) {
            json st = LicenseService::instance().getLicenseStatus();
            sendJson(res, st);
            return;
        }

        if (action == "sync_now" || action == "sync_if_due") {
            auto& db = Database::instance();
            auto row = db.queryRow("SELECT license_key FROM local_license_cache WHERE id = 1");
            std::string key = (!row.is_null() && row.contains("license_key") && row["license_key"].is_string())
                ? row["license_key"].get<std::string>() : "";
            if (!key.empty()) {
                LicenseService::instance().verifyLicenseOnline(key, LicenseService::instance().getMachineId());
            }
            json st = LicenseService::instance().getLicenseStatus();
            sendJson(res, {
                {"success", true},
                {"synced", true},
                {"state", "valid"},
                {"rights_revision", 1},
                {"message", "Đã đồng bộ giấy phép bản quyền từ Master thành công!"},
                {"data", st.value("data", json::object())}
            });
            return;
        }

        if (action == "activate") {
            std::string key = getString(body, "license_key");
            json act = LicenseService::instance().activateLicense(key);
            act["data"] = LicenseService::instance().getLicenseStatus().value("data", json::object());
            sendJson(res, act, act.value("success", false) ? 200 : 400);
            return;
        }

        sendError(res, "Invalid license client request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi client license: ") + e.what()}}, 500);
    }
}

// ==========================================
// ==========================================
// ADVERTISING & SLIDES HANDLER (Customer Ad Carousel)
// ==========================================
void ApiHandlers::handleAdvertising(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);

        if (req.method == "POST") {
            if (!requireModule(res, "advertising_promotions", "Quảng Cáo & Khuyến Mãi")) return;
        }

        // Upload media (image or video)
        if (action == "upload_media" || req.has_file("media")) {
            if (req.has_file("media")) {
                const auto& file = req.get_file_value("media");
                std::string filename = file.filename;
                std::string ext = "";
                size_t dotPos = filename.find_last_of('.');
                if (dotPos != std::string::npos) {
                    ext = filename.substr(dotPos);
                    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
                }
                if (ext.empty()) ext = ".jpg";

                bool isVideo = (ext == ".mp4" || ext == ".webm");
                auto nowMs = std::chrono::system_clock::now().time_since_epoch().count();
                std::string hashName = AuthService::sha256(filename + std::to_string(nowMs));
                std::string saveName = hashName.substr(0, 32) + ext;

                namespace fs = std::filesystem;
                fs::path targetDir = SaleApp::Config::AppConfig::instance().getUploadsDir() / "advertisements";
                fs::create_directories(targetDir);
                fs::path targetPath = targetDir / saveName;

                std::ofstream ofs(targetPath, std::ios::binary);
                if (ofs) {
                    ofs.write(file.content.data(), file.content.size());
                    ofs.close();
                    std::string webPath = "uploads/advertisements/" + saveName;
                    sendJson(res, {
                        {"success", true},
                        {"media", {
                            {"path", webPath},
                            {"type", isVideo ? "video" : "image"}
                        }}
                    });
                    return;
                }
            }
            sendJson(res, {{"success", false}, {"message", "Không thể lưu tệp tải lên."}}, 400);
            return;
        }

        if (action == "ai_generate_slide") {
            std::string topic = BodyParser::getParam(req, body, "topic");
            if (topic.empty()) topic = BodyParser::getParam(req, body, "title", "Khuyến mãi đặc biệt hôm nay tại quán cà phê");
            std::string passedKey = BodyParser::getParam(req, body, "gemini_api_key");
            std::string localKey = resolveGeminiApiKey(db, passedKey);

            std::string slideTitle, slideDesc, imgB64, mime, engineUsed, err;
            if (!localKey.empty()) {
                std::string copyPrompt =
                    "Bạn là chuyên gia marketing F&B. Hãy viết nội dung cho 1 slide quảng cáo màn hình khách hàng dựa trên chủ đề: \"" + topic + "\". "
                    "Trả về đúng 1 JSON object: {\"title\": \"Tiêu đề ngắn gọn hấp dẫn tối đa 60 ký tự tiếng Việt\", "
                    "\"description\": \"Mô tả ngắn gọn 1-2 câu tối đa 160 ký tự tiếng Việt\", "
                    "\"image_prompt\": \"Detailed English prompt for widescreen 16:9 commercial cafe/food promotional background photography, warm lighting, vibrant, no text, no watermark\"}.";
                json contents = json::array({{{"parts", json::array({{{"text", copyPrompt}}})}}});
                std::string textOut, textModel;
                if (!SaleApp::AI::geminiGenerateContentText(localKey, contents, true, textOut, textModel, err)) {
                    sendError(res, "Lỗi AI viết nội dung slide: " + err, 502);
                    return;
                }
                json copyJson;
                try { copyJson = json::parse(textOut); } catch (...) { copyJson = json::object(); }
                slideTitle = copyJson.value("title", topic);
                slideDesc = copyJson.value("description", "Ưu đãi hấp dẫn dành riêng cho quý khách hôm nay.");
                std::string imgPrompt = copyJson.value("image_prompt", "Widescreen 16:9 commercial cafe beverage and pastry promotional photography, warm moody lighting, photorealistic, no text");

                std::string imgModel, imgErr;
                if (!SaleApp::AI::geminiGenerateImageBase64(localKey, imgPrompt, imgB64, mime, imgModel, imgErr)) {
                    sendError(res, "AI đã viết nội dung nhưng không thể tạo ảnh slide: " + imgErr, 502);
                    return;
                }
                engineUsed = textModel + " + " + imgModel;
            } else {
                json proxyResp;
                if (!callMasterAiProxy({{"action", "generate_slide"}, {"topic", topic}}, proxyResp, err)) {
                    sendError(res, err, 502);
                    return;
                }
                slideTitle = proxyResp.value("title", topic);
                slideDesc = proxyResp.value("description", "Ưu đãi hấp dẫn dành riêng cho quý khách hôm nay.");
                imgB64 = proxyResp.value("image_base64", "");
                mime = proxyResp.value("mime_type", "image/png");
                engineUsed = proxyResp.value("ai_engine", "CyberNexus Master AI");
            }

            std::string imgBytes = SaleApp::AI::base64Decode(imgB64);
            if (imgBytes.empty()) {
                sendError(res, "Dữ liệu ảnh slide không hợp lệ!", 502);
                return;
            }
            std::string ext = (mime.find("jpeg") != std::string::npos || mime.find("jpg") != std::string::npos) ? ".jpg" : ".png";
            auto nowMs = std::chrono::system_clock::now().time_since_epoch().count();
            std::string saveName = "slide_" + AuthService::sha256(topic + std::to_string(nowMs)).substr(0, 20) + ext;
            namespace fs = std::filesystem;
            fs::path targetDir = SaleApp::Config::AppConfig::instance().getUploadsDir() / "advertisements";
            fs::create_directories(targetDir);
            std::ofstream ofs(targetDir / saveName, std::ios::binary);
            if (!ofs) {
                sendError(res, "Không thể lưu file ảnh slide!", 500);
                return;
            }
            ofs.write(imgBytes.data(), imgBytes.size());
            ofs.close();

            sendJson(res, {
                {"success", true},
                {"title", slideTitle},
                {"description", slideDesc},
                {"media_path", "uploads/advertisements/" + saveName},
                {"media_type", "image"},
                {"ai_engine", engineUsed},
                {"message", "AI đã tạo nội dung và ảnh slide thành công!"}
            });
            return;
        }

        // Save slides
        if (action == "save_slides" || (req.method == "POST" && action.empty())) {
            json slides = json::array();
            if (body.contains("slides") && body["slides"].is_array()) {
                slides = body["slides"];
            }
            std::string slidesJson = slides.dump();
            db.execute(
                "INSERT INTO store_settings (setting_key, setting_value) VALUES ('customer_ad_slides', :v) "
                "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                {{":v", slidesJson}}
            );
            sendJson(res, {
                {"success", true},
                {"message", "Đã lưu và xuất bản trình chiếu thành công!"},
                {"slides", slides}
            });
            return;
        }

        // Get slides
        auto row = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'customer_ad_slides'");
        json slides = json::array();
        if (!row.is_null()) {
            std::string val = row.value("setting_value", "[]");
            try {
                slides = json::parse(val);
            } catch (...) {
                slides = json::array();
            }
        }
        sendJson(res, {
            {"success", true},
            {"slides", slides}
        });
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi quảng cáo: ") + e.what()}}, 500);
    }
}

void ApiHandlers::handlePromotions(const httplib::Request& req, httplib::Response& res) {
    try {
        if (!requireModule(res, "promo_voucher_engine", "Khuyến Mãi & Voucher Tự Động (Full)")) return;
        auto& db = Database::instance();
        ensurePromotionSchema(db);
        json body = parseBody(req);
        std::string action = getAction(req, body);
        if (action.empty()) action = (req.method == "GET") ? "list" : "validate";

        if (req.method == "GET" && action == "active") {
            double subtotal = 0.0;
            try { subtotal = std::stod(BodyParser::getParam(req, body, "subtotal", "0")); } catch (...) {}
            json rows = db.query("SELECT * FROM promotions WHERE is_active = 1 ORDER BY id DESC");
            json eligibleAuto = json::array();
            json allActive = json::array();
            for (auto& r : rows) {
                std::string dummyErr;
                bool okNow = isPromoEligibleNow(db, r, subtotal > 0 ? subtotal : getDouble(r, "min_order_amount", 0.0), dummyErr);
                r["eligible_now"] = okNow;
                r["ineligible_reason"] = okNow ? "" : dummyErr;
                allActive.push_back(r);
                if (okNow && getString(r, "promo_mode", "voucher") == "auto") {
                    eligibleAuto.push_back(r);
                }
            }
            sendJson(res, {{"success", true}, {"auto_promotions", eligibleAuto}, {"data", allActive}});
            return;
        }

        if (action == "validate") {
            std::string code = BodyParser::getParam(req, body, "promo_code", BodyParser::getParam(req, body, "code", ""));
            double subtotal = 0.0;
            try { subtotal = std::stod(BodyParser::getParam(req, body, "subtotal", "0")); } catch (...) {}
            std::string upCode = code;
            std::transform(upCode.begin(), upCode.end(), upCode.begin(), ::toupper);

            if (upCode.empty()) {
                sendError(res, "Vui lòng nhập mã khuyến mãi!", 400);
                return;
            }
            auto pRow = db.queryRow("SELECT * FROM promotions WHERE UPPER(code) = :c LIMIT 1", {{":c", upCode}});
            if (pRow.is_null()) {
                sendError(res, "Mã khuyến mãi [" + upCode + "] không tồn tại!", 404);
                return;
            }
            std::string errReason;
            if (!isPromoEligibleNow(db, pRow, subtotal, errReason)) {
                sendError(res, errReason, 400);
                return;
            }
            double discAmt = computePromoDiscount(pRow, subtotal);
            sendJson(res, {
                {"success", true},
                {"promo", pRow},
                {"discount_amount", discAmt},
                {"message", "Áp dụng thành công mã " + getString(pRow, "code") + " (-" + std::to_string(static_cast<int64_t>(discAmt)) + "đ)!"}
            });
            return;
        }

        if (req.method == "GET" && action == "list") {
            json rows = db.query(R"(
                SELECT p.*,
                       (SELECT COUNT(*) FROM orders o WHERE o.promo_id = p.id AND o.status != 'cancelled') as used_count,
                       (SELECT COUNT(*) FROM orders o WHERE o.promo_id = p.id AND o.status = 'completed') as completed_orders,
                       (SELECT COALESCE(SUM(o.discount_amount), 0) FROM orders o WHERE o.promo_id = p.id AND o.status = 'completed') as total_discount_given,
                       (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.promo_id = p.id AND o.status = 'completed') as net_revenue_generated
                FROM promotions p
                ORDER BY p.is_active DESC, p.id DESC
            )");
            sendJson(res, {{"success", true}, {"data", rows}});
            return;
        }

        if (action == "save") {
            int64_t pid = 0;
            try { pid = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
            std::string code = BodyParser::getParam(req, body, "code", "");
            std::transform(code.begin(), code.end(), code.begin(), ::toupper);
            std::string name = BodyParser::getParam(req, body, "name", "");
            std::string promoMode = BodyParser::getParam(req, body, "promo_mode", "voucher");
            if (promoMode != "auto") promoMode = "voucher";
            std::string dType = BodyParser::getParam(req, body, "discount_type", "percent");
            if (dType != "amount") dType = "percent";
            double dVal = 0, maxCap = 0, minAmt = 0;
            int64_t uLimit = 0;
            try { dVal = std::stod(BodyParser::getParam(req, body, "discount_value", "0")); } catch (...) {}
            try { maxCap = std::stod(BodyParser::getParam(req, body, "max_discount_amount", "0")); } catch (...) {}
            try { minAmt = std::stod(BodyParser::getParam(req, body, "min_order_amount", "0")); } catch (...) {}
            try { uLimit = std::stoll(BodyParser::getParam(req, body, "usage_limit", "0")); } catch (...) {}
            std::string sDate = BodyParser::getParam(req, body, "start_date", "");
            std::string eDate = BodyParser::getParam(req, body, "end_date", "");
            std::string sTime = BodyParser::getParam(req, body, "start_time", "");
            std::string eTime = BodyParser::getParam(req, body, "end_time", "");
            int isActive = (BodyParser::getParam(req, body, "is_active", "1") != "0") ? 1 : 0;

            if (code.empty() || name.empty() || dVal <= 0) {
                sendError(res, "Vui lòng nhập Mã KM, Tên chương trình và Giá trị giảm > 0!", 400);
                return;
            }
            if (pid > 0) {
                db.execute(R"(
                    UPDATE promotions SET
                        code = :c, name = :n, promo_mode = :pm, discount_type = :dt, discount_value = :dv,
                        max_discount_amount = :mc, min_order_amount = :ma,
                        start_date = :sd, end_date = :ed, start_time = :st, end_time = :et,
                        usage_limit = :ul, is_active = :ia
                    WHERE id = :id
                )", {
                    {":c", code}, {":n", name}, {":pm", promoMode}, {":dt", dType}, {":dv", dVal},
                    {":mc", maxCap}, {":ma", minAmt}, {":sd", sDate}, {":ed", eDate}, {":st", sTime}, {":et", eTime},
                    {":ul", uLimit}, {":ia", isActive}, {":id", pid}
                });
            } else {
                db.execute(R"(
                    INSERT INTO promotions (
                        code, name, promo_mode, discount_type, discount_value, max_discount_amount, min_order_amount,
                        start_date, end_date, start_time, end_time, usage_limit, is_active
                    ) VALUES (:c, :n, :pm, :dt, :dv, :mc, :ma, :sd, :ed, :st, :et, :ul, :ia)
                )", {
                    {":c", code}, {":n", name}, {":pm", promoMode}, {":dt", dType}, {":dv", dVal},
                    {":mc", maxCap}, {":ma", minAmt}, {":sd", sDate}, {":ed", eDate}, {":st", sTime}, {":et", eTime},
                    {":ul", uLimit}, {":ia", isActive}
                });
            }
            sendJson(res, {{"success", true}, {"message", "Đã lưu chương trình khuyến mãi [" + code + "]!"}});
            return;
        }

        if (action == "toggle") {
            int64_t pid = 0;
            try { pid = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
            db.execute("UPDATE promotions SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = :id", {{":id", pid}});
            sendJson(res, {{"success", true}, {"message", "Đã đổi trạng thái khuyến mãi."}});
            return;
        }

        if (action == "delete") {
            int64_t pid = 0;
            try { pid = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
            db.execute("DELETE FROM promotions WHERE id = :id", {{":id", pid}});
            sendJson(res, {{"success", true}, {"message", "Đã xóa chương trình khuyến mãi."}});
            return;
        }

        sendError(res, "Yêu cầu khuyến mãi không hợp lệ", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi khuyến mãi: ") + e.what()}}, 500);
    }
}

// ==========================================
// MEDIA TRACKS & JUKEBOX LIBRARY HANDLER
// ==========================================
void ApiHandlers::handleMediaTracks(const httplib::Request& req, httplib::Response& res) {
    try {
        if (!requireModule(res, "mod_media_stream", "Máy Chủ Media Streaming & Smart Jukebox")) return;
        auto& db = Database::instance();
        std::string action = "";
        if (req.has_param("action")) {
            action = req.get_param_value("action");
        }
        if (action.empty()) {
            if (req.path.find("/delete") != std::string::npos) action = "delete";
            else if (req.path.find("/upload") != std::string::npos) action = "upload";
            else if (req.path.find("/rescan") != std::string::npos) action = "rescan";
            else if (req.path.find("/save") != std::string::npos) action = "save";
        }

        json body = json::object();
        std::string contentType = req.get_header_value("Content-Type");
        if (contentType.find("multipart") == std::string::npos && !req.body.empty()) {
            body = parseBody(req);
        }
        if (action.empty()) {
            action = BodyParser::getAction(req, body);
        }

        // 1. Upload audio file(s) (MP3, WAV, FLAC, OGG) - Supports Single & Multiple Batch Files
        if (action == "upload" || !req.files.empty()) {
            namespace fs = std::filesystem;
            fs::path mediaDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "assets" / "media";
            try { fs::create_directories(mediaDir); } catch (...) {}

            int uploadedCount = 0;
            std::string lastPath = "";
            int64_t lastId = 0;

            for (const auto& item : req.files) {
                const auto& file = item.second;
                std::string filename = file.filename;
                if (filename.empty()) continue;

                std::string ext = "";
                size_t dotPos = filename.find_last_of('.');
                if (dotPos != std::string::npos) {
                    ext = filename.substr(dotPos);
                    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
                }
                if (ext != ".mp3" && ext != ".wav" && ext != ".flac" && ext != ".ogg") {
                    continue; // Skip non-audio files
                }

                std::string cleanName = (dotPos != std::string::npos) ? filename.substr(0, dotPos) : filename;
                std::string saveFile = filename;
                fs::path targetPath = mediaDir / saveFile;

                std::ofstream ofs(targetPath, std::ios::binary);
                if (ofs) {
                    ofs.write(file.content.data(), file.content.size());
                    ofs.close();
                }

                fs::path webMediaDir = SaleApp::Config::AppConfig::instance().getWebDir() / "assets" / "media";
                try {
                    fs::create_directories(webMediaDir);
                    fs::copy_file(targetPath, webMediaDir / saveFile, fs::copy_options::overwrite_existing);
                } catch (...) {}

                std::string relPath = "assets/media/" + saveFile;
                std::string title = req.has_param("title") ? req.get_param_value("title") : cleanName;
                std::string artist = req.has_param("artist") ? req.get_param_value("artist") : "Various Artists";
                std::string genre = req.has_param("genre") ? req.get_param_value("genre") : "Lossless";
                int64_t duration = 210;

                // Check if already in DB
                auto check = db.queryRow("SELECT id FROM media_tracks WHERE file_path = :fp LIMIT 1", {{":fp", relPath}});
                if (check.is_null()) {
                    lastId = db.execute(R"(
                        INSERT INTO media_tracks (title, artist, album, genre, duration_sec, file_path, bitrate, is_active, created_at)
                        VALUES (:ti, :ar, 'Cyber Lounge', :ge, :du, :fp, 320, 1, datetime('now'))
                    )", {
                        {":ti", title}, {":ar", artist}, {":ge", genre}, {":du", duration}, {":fp", relPath}
                    });
                } else {
                    lastId = check.value("id", 0LL);
                }
                lastPath = relPath;
                uploadedCount++;
            }

            if (uploadedCount > 0) {
                sendJson(res, {
                    {"success", true},
                    {"message", "Đã nạp thành công " + std::to_string(uploadedCount) + " bài hát vào kho nhạc!"},
                    {"uploaded_count", uploadedCount},
                    {"track_id", lastId},
                    {"file_path", lastPath}
                });
                return;
            }
        }

        // 2. Save / Edit track
        if (action == "save" || action == "update" || action == "create") {
            int64_t id = 0;
            try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}

            std::string title = BodyParser::getParam(req, body, "title", "");
            std::string artist = BodyParser::getParam(req, body, "artist", "Various Artists");
            std::string album = BodyParser::getParam(req, body, "album", "Cyber Lounge");
            std::string genre = BodyParser::getParam(req, body, "genre", "Acoustic");
            int64_t duration = 180;
            try { duration = std::stoll(BodyParser::getParam(req, body, "duration_sec", "180")); } catch (...) {}
            std::string filePath = BodyParser::getParam(req, body, "file_path", "");
            int64_t isActive = 1;
            try { isActive = std::stoll(BodyParser::getParam(req, body, "is_active", "1")); } catch (...) {}

            if (title.empty()) {
                sendError(res, "Tên bài hát không được để trống!", 400);
                return;
            }

            if (id > 0) {
                db.execute(R"(
                    UPDATE media_tracks 
                    SET title = :ti, artist = :ar, album = :al, genre = :ge, duration_sec = :du, file_path = :fp, is_active = :ac
                    WHERE id = :id
                )", {
                    {":ti", title}, {":ar", artist}, {":al", album}, {":ge", genre},
                    {":du", duration}, {":fp", filePath}, {":ac", isActive}, {":id", id}
                });
                sendJson(res, {{"success", true}, {"message", "Đã cập nhật bài hát thành công!"}});
            } else {
                int64_t newId = db.execute(R"(
                    INSERT INTO media_tracks (title, artist, album, genre, duration_sec, file_path, bitrate, is_active, created_at)
                    VALUES (:ti, :ar, :al, :ge, :du, :fp, 320, :ac, datetime('now'))
                )", {
                    {":ti", title}, {":ar", artist}, {":al", album}, {":ge", genre},
                    {":du", duration}, {":fp", filePath}, {":ac", isActive}
                });
                sendJson(res, {{"success", true}, {"message", "Đã thêm bài hát mới vào kho nhạc!", {"track_id", newId}}});
            }
            return;
        }

        // 3. Delete track
        if (action == "delete") {
            int64_t id = 0;
            if (req.has_param("id")) {
                try { id = std::stoll(req.get_param_value("id")); } catch (...) {}
            }
            if (id == 0 && body.is_object() && body.contains("id")) {
                if (body["id"].is_number()) {
                    id = body["id"].get<int64_t>();
                } else if (body["id"].is_string()) {
                    try { id = std::stoll(body["id"].get<std::string>()); } catch (...) {}
                }
            }
            if (id > 0) {
                db.execute("DELETE FROM media_jukebox_queue WHERE track_id = :id", {{":id", id}});
                db.execute("DELETE FROM media_tracks WHERE id = :id", {{":id", id}});
                sendJson(res, {{"success", true}, {"message", "Đã xóa bài hát khỏi kho nhạc!"}});
                return;
            }
            sendError(res, "Thiếu ID bài hát cần xóa!", 400);
            return;
        }

        // 4. Rescan media folder
        if (action == "rescan") {
            namespace fs = std::filesystem;
            fs::path mediaDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "assets" / "media";
            int countAdded = 0;
            if (fs::exists(mediaDir)) {
                for (const auto& entry : fs::directory_iterator(mediaDir)) {
                    if (entry.is_regular_file()) {
                        std::string ext = entry.path().extension().string();
                        std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
                        if (ext == ".mp3" || ext == ".wav" || ext == ".flac" || ext == ".ogg") {
                            std::string stem = entry.path().stem().string();
                            std::string relPath = "assets/media/" + entry.path().filename().string();
                            auto existing = db.queryRow("SELECT id FROM media_tracks WHERE file_path = :fp LIMIT 1", {{":fp", relPath}});
                            if (existing.is_null()) {
                                db.execute(R"(
                                    INSERT INTO media_tracks (title, artist, album, genre, duration_sec, file_path, bitrate, is_active, created_at)
                                    VALUES (:ti, 'CyberNexus Artist', 'Local Media Store', 'Lossless', 210, :fp, 320, 1, datetime('now'))
                                )", {{":ti", stem}, {":fp", relPath}});
                                countAdded++;
                            }
                        }
                    }
                }
            }
            sendJson(res, {
                {"success", true},
                {"message", "Đã quét xong thư mục nhạc! Đã nạp thêm " + std::to_string(countAdded) + " bài hát."},
                {"added_count", countAdded}
            });
            return;
        }

        // 5. Default: Query all tracks
        std::string kw = req.has_param("kw") ? req.get_param_value("kw") : "";
        std::string genre = req.has_param("genre") ? req.get_param_value("genre") : "";

        std::string sql = "SELECT * FROM media_tracks WHERE 1=1";
        std::vector<std::pair<std::string, json>> params;
        if (!kw.empty()) {
            sql += " AND (title LIKE :kw OR artist LIKE :kw)";
            params.push_back({":kw", "%" + kw + "%"});
        }
        if (!genre.empty() && genre != "all") {
            sql += " AND genre = :ge";
            params.push_back({":ge", genre});
        }
        sql += " ORDER BY id ASC";

        auto rows = db.query(sql, params);
        sendJson(res, {
            {"success", true},
            {"count", rows.size()},
            {"tracks", rows}
        });
    } catch (const std::exception& e) {
        sendError(res, std::string("Lỗi kho nhạc: ") + e.what(), 500);
    }
}

// ==========================================
// ROUTE REGISTRATION (Supports both clean & .php)
// ==========================================
void ApiHandlers::registerRoutes(httplib::Server& svr) {
    // Media Tracks API
    svr.Get("/api/media/tracks", handleMediaTracks);
    svr.Post("/api/media/tracks", handleMediaTracks);
    svr.Post("/api/media/tracks/save", handleMediaTracks);
    svr.Post("/api/media/tracks/delete", handleMediaTracks);
    svr.Post("/api/media/tracks/rescan", handleMediaTracks);
    svr.Post("/api/media/tracks/upload", handleMediaTracks);
    // Auth
    svr.Get("/api/auth", handleAuth);
    svr.Post("/api/auth", handleAuth);
    svr.Get("/api/auth.php", handleAuth);
    svr.Post("/api/auth.php", handleAuth);

    // Categories
    svr.Get("/api/categories", handleCategories);
    svr.Post("/api/categories", handleCategories);
    svr.Get("/api/categories.php", handleCategories);
    svr.Post("/api/categories.php", handleCategories);

    // Products
    svr.Get("/api/products", handleProducts);
    svr.Post("/api/products", handleProducts);
    svr.Get("/api/products.php", handleProducts);
    svr.Post("/api/products.php", handleProducts);

    // Tables
    svr.Get("/api/tables", handleTables);
    svr.Post("/api/tables", handleTables);
    svr.Get("/api/tables.php", handleTables);
    svr.Post("/api/tables.php", handleTables);

    // Orders
    svr.Get("/api/orders", handleOrders);
    svr.Post("/api/orders", handleOrders);
    svr.Post("/api/payment/webhook", [](const httplib::Request& req, httplib::Response& res) {
        try {
            auto& db = Database::instance();
            ensureOrderWorkflowSchema(db);
            json body = parseBody(req);

            auto secRow = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'payment_webhook_secret'");
            std::string cfgSecret = (!secRow.is_null()) ? secRow.value("setting_value", "") : "";
            if (!cfgSecret.empty()) {
                std::string gotSec = req.get_header_value("Authorization");
                if (gotSec.rfind("Apikey ", 0) == 0) gotSec = gotSec.substr(7);
                if (gotSec.rfind("Bearer ", 0) == 0) gotSec = gotSec.substr(7);
                if (gotSec.empty()) gotSec = BodyParser::getParam(req, body, "secret", "");
                if (gotSec != cfgSecret) {
                    sendError(res, "Webhook secret không hợp lệ!", 401);
                    return;
                }
            }

            std::string content = BodyParser::getParam(req, body, "content", BodyParser::getParam(req, body, "description", BodyParser::getParam(req, body, "order_code", "")));
            double amount = 0.0;
            try {
                if (body.contains("transferAmount") && body["transferAmount"].is_number()) amount = body["transferAmount"].get<double>();
                else if (body.contains("amount") && body["amount"].is_number()) amount = body["amount"].get<double>();
                else amount = std::stod(BodyParser::getParam(req, body, "amount", "0"));
            } catch (...) {}
            std::string bankRef = BodyParser::getParam(req, body, "referenceCode", BodyParser::getParam(req, body, "id", ""));

            // Match pending unpaid/verifying/partial order whose order_code appears in content (case-insensitive)
            std::string upperContent = content;
            std::transform(upperContent.begin(), upperContent.end(), upperContent.begin(), ::toupper);
            json candidates = db.query("SELECT * FROM orders WHERE status = 'pending' AND payment_status IN ('unpaid', 'verifying', 'partial') ORDER BY id DESC LIMIT 100");
            json matchedOrd;
            for (const auto& c : candidates) {
                std::string oc = getString(c, "order_code", "");
                std::string ocNoDash = oc;
                ocNoDash.erase(std::remove(ocNoDash.begin(), ocNoDash.end(), '-'), ocNoDash.end());
                if ((!oc.empty() && upperContent.find(oc) != std::string::npos) ||
                    (!ocNoDash.empty() && upperContent.find(ocNoDash) != std::string::npos)) {
                    matchedOrd = c;
                    break;
                }
            }
            if (matchedOrd.is_null()) {
                sendJson(res, {{"success", false}, {"message", "Không tìm thấy đơn chờ thanh toán khớp nội dung CK: " + content}}, 404);
                return;
            }

            int64_t oid = getInt(matchedOrd, "id", 0);
            std::string oCode = getString(matchedOrd, "order_code", "");
            std::string tCode = getString(matchedOrd, "table_code", "");
            int64_t tId = getInt(matchedOrd, "table_id", 0);
            double totAmt = getDouble(matchedOrd, "total_amount", 0.0);
            std::string nowStr = getCurrentTimestamp();

            if (amount + 0.5 < totAmt) {
                db.beginTransaction();
                db.execute("UPDATE orders SET payment_status = 'partial', paid_amount = COALESCE(paid_amount, 0) + :amt, bank_ref = :br WHERE id = :id",
                    {{":amt", amount}, {":br", bankRef}, {":id", oid}});
                createOrderAlert(db, oid, oCode, tId, tCode, "payment_partial",
                    "Chuyển khoản THIẾU tiền " + oCode,
                    "Nhận " + std::to_string(static_cast<int64_t>(amount)) + "đ / " + std::to_string(static_cast<int64_t>(totAmt)) + "đ cho đơn " + oCode + ". Chưa chuyển Bếp!",
                    "cashier");
                db.commit();
                sendJson(res, {{"success", true}, {"partial", true}, {"message", "Đã ghi nhận chuyển thiếu tiền; chưa mở khóa Bếp."}});
                return;
            }

            auto autoRow = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'auto_kitchen_after_qr'");
            bool autoPush = (!autoRow.is_null() && autoRow.value("setting_value", "0") == "1");

            db.beginTransaction();
            db.execute(R"(
                UPDATE orders SET
                    payment_status = 'paid', payment_method = 'banking', paid_amount = :amt,
                    settlement_status = 'settled', payment_verified_by = 'AUTO_WEBHOOK',
                    bank_ref = :br, paid_at = COALESCE(paid_at, :pat)
                WHERE id = :id
            )", {{":amt", amount}, {":br", bankRef}, {":pat", nowStr}, {":id", oid}});
            if (autoPush) {
                db.execute("UPDATE orders SET kitchen_status = 'pending' WHERE id = :id AND COALESCE(kitchen_status, 'pending') IN ('awaiting_payment', 'awaiting_waiter', 'awaiting_kitchen_push')",
                    {{":id", oid}});
            }
            db.execute(R"(
                INSERT INTO payment_transactions (order_id, order_code, tx_type, method, amount, bank_ref, verified_by, note, created_at)
                VALUES (:oid, :oc, 'pay', 'banking', :amt, :br, 'AUTO_WEBHOOK', 'Tự động xác nhận qua Webhook ngân hàng', :cat)
            )", {{":oid", oid}, {":oc", oCode}, {":amt", amount}, {":br", bankRef}, {":cat", nowStr}});
            db.execute("UPDATE order_alerts SET is_ack = 1, ack_by = 'AUTO_WEBHOOK', ack_at = :at WHERE order_id = :oid AND alert_type IN ('qr_payment_pending', 'payment_verifying')",
                {{":at", nowStr}, {":oid", oid}});
            createOrderAlert(db, oid, oCode, tId, tCode, "payment_auto_paid",
                "Đã nhận CK tự động: " + oCode,
                "Webhook ngân hàng xác nhận đủ " + std::to_string(static_cast<int64_t>(amount)) + "đ (" + (autoPush ? "Đã tự chuyển Bếp" : "Sẵn sàng bấm Chuyển Bếp") + ").",
                "cashier");
            db.commit();

            sendJson(res, {{"success", true}, {"order_code", oCode}, {"auto_pushed_kitchen", autoPush}});
        } catch (const std::exception& e) {
            sendError(res, std::string("Webhook error: ") + e.what(), 500);
        }
    });
    svr.Get("/api/orders.php", handleOrders);
    svr.Post("/api/orders.php", handleOrders);

    // Reports
    svr.Get("/api/reports", handleReports);
    svr.Get("/api/reports.php", handleReports);

    // Finance
    svr.Get("/api/finance", handleFinance);
    svr.Post("/api/finance", handleFinance);
    svr.Get("/api/finance.php", handleFinance);
    svr.Post("/api/finance.php", handleFinance);

    // Settings
    svr.Get("/api/settings", handleSettings);
    svr.Post("/api/settings", handleSettings);
    svr.Get("/api/settings.php", handleSettings);
    svr.Post("/api/settings.php", handleSettings);

    // Users
    svr.Get("/api/users", handleUsers);
    svr.Post("/api/users", handleUsers);
    svr.Get("/api/users.php", handleUsers);
    svr.Post("/api/users.php", handleUsers);

    // Operations
    svr.Get("/api/operations", handleOperations);
    svr.Post("/api/operations", handleOperations);
    svr.Get("/api/operations.php", handleOperations);
    svr.Post("/api/operations.php", handleOperations);

    // License & SaaS (Giai đoạn 5)
    svr.Get("/api/license", handleLicense);
    svr.Post("/api/license", handleLicense);
    svr.Get("/api/license.php", handleLicense);
    svr.Post("/api/license.php", handleLicense);

    svr.Get("/api/license_client", handleLicenseClient);
    svr.Post("/api/license_client", handleLicenseClient);
    svr.Get("/api/license_client.php", handleLicenseClient);
    svr.Post("/api/license_client.php", handleLicenseClient);


    // Advertising & Smart Slides
    svr.Get("/api/advertising", handleAdvertising);
    svr.Post("/api/advertising", handleAdvertising);
    svr.Get("/api/advertising.php", handleAdvertising);
    svr.Post("/api/advertising.php", handleAdvertising);
    svr.Get("/api/promotions", handlePromotions);
    svr.Post("/api/promotions", handlePromotions);
    svr.Get("/api/promotions.php", handlePromotions);
    svr.Post("/api/promotions.php", handlePromotions);

    // WAN Reverse Long-Polling Tunnel Status & Configuration
    auto handleWanTunnel = [](const httplib::Request& req, httplib::Response& res) {
        auto& auth = AuthService::instance();
        auto userOpt = auth.authenticate(req);
        if (!userOpt.has_value() || userOpt->role != "admin") {
            sendJson(res, {{"success", false}, {"message", "Chỉ Chủ quán (Admin) mới có quyền cấu hình kết nối Master!"}}, 403);
            return;
        }
        if (req.method == "GET") {
            std::string url = SaleApp::Config::AppConfig::instance().getMasterServerUrl();
            json d = SlaveTunnelStatus::instance().toJson(url);
            d["net_geo"] = SlaveNetInfoService::instance().toJson();
            sendJson(res, {{"success", true}, {"data", d}});
            return;
        }
        json body = parseBody(req);
        std::string action = body.value("action", "save");
        if (action == "save_location") {
            double lat = body.value("geo_lat", 0.0);
            double lng = body.value("geo_lng", 0.0);
            std::string lbl = body.value("geo_label", "");
            if (lat == 0.0 || lng == 0.0) {
                sendJson(res, {{"success", false}, {"message", "Tọa độ Google Maps không hợp lệ!"}}, 400);
                return;
            }
            SlaveNetInfoService::instance().savePinnedLocation(lat, lng, lbl, "gps");
            SlaveTunnelStatus::instance().requestReconnect();
            std::string url = SaleApp::Config::AppConfig::instance().getMasterServerUrl();
            json d = SlaveTunnelStatus::instance().toJson(url);
            d["net_geo"] = SlaveNetInfoService::instance().toJson();
            sendJson(res, {{"success", true}, {"message", "Đã ghim tọa độ Google Maps chính xác và gửi lên Master!"}, {"data", d}});
            return;
        }
        if (action == "reconnect") {
            SlaveTunnelStatus::instance().requestReconnect();
            std::string url = SaleApp::Config::AppConfig::instance().getMasterServerUrl();
            json d = SlaveTunnelStatus::instance().toJson(url);
            d["net_geo"] = SlaveNetInfoService::instance().toJson();
            sendJson(res, {{"success", true}, {"message", "Đã gửi yêu cầu kết nối lại kênh Master!"}, {"data", d}});
            return;
        }
        std::string newUrl = body.value("master_server_url", "");
        bool enabled = body.value("enabled", true);
        if (!newUrl.empty()) {
            while (!newUrl.empty() && newUrl.back() == '/') newUrl.pop_back();
            SaleApp::Config::AppConfig::instance().persistMasterServerUrl(newUrl);
        }
        SlaveTunnelStatus::instance().setEnabled(enabled);
        SlaveTunnelStatus::instance().requestReconnect();
        std::string url = SaleApp::Config::AppConfig::instance().getMasterServerUrl();
        sendJson(res, {{"success", true}, {"message", "Đã lưu cấu hình kết nối Master và kết nối lại!"}, {"data", SlaveTunnelStatus::instance().toJson(url)}});
    };
    svr.Get("/api/wan_tunnel", handleWanTunnel);
    svr.Post("/api/wan_tunnel", handleWanTunnel);

    // AI Key Verification & Secure Auto-Save
    svr.Post("/api/ai/test", [](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt.has_value() || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            sendError(res, "Chỉ Chủ quán (Admin) mới có quyền kiểm tra & lưu API Key!", 403);
            return;
        }
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string passedKey = body.value("gemini_api_key", "");
        bool saveOnSuccess = body.value("save_on_success", true);
        std::string apiKey = resolveGeminiApiKey(db, passedKey);
        if (apiKey.empty()) {
            sendError(res, "Vui lòng dán mã Gemini API Key để kiểm tra!", 400);
            return;
        }
        int modelCount = 0;
        std::vector<std::string> samples;
        std::string err;
        if (!SaleApp::AI::geminiVerifyKey(apiKey, modelCount, samples, err)) {
            sendError(res, "API Key không hợp lệ hoặc bị từ chối: " + err, 400);
            return;
        }
        bool saved = false;
        if (saveOnSuccess && !passedKey.empty() && passedKey.find("•••") == std::string::npos && passedKey.find("***") == std::string::npos) {
            db.execute(
                "INSERT INTO store_settings (setting_key, setting_value) VALUES ('gemini_api_key', :v) "
                "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                {{":v", passedKey}}
            );
            saved = true;
        }
        sendJson(res, {
            {"success", true},
            {"saved", saved},
            {"model_count", modelCount},
            {"sample_models", samples},
            {"message", "Kết nối Gemini thành công (" + std::to_string(modelCount) + " models khả dụng)! Key đã được lưu & ẩn bảo mật."}
        });
    });

    // Store OTA Update & System Notification Endpoints
    svr.Get("/api/system/updates", [](const httplib::Request&, httplib::Response& res) {
        sendJson(res, SlaveUpdateManager::instance().getStatus());
    });
    svr.Post("/api/system/updates", [](const httplib::Request& req, httplib::Response& res) {
        json body = parseBody(req);
        std::string action = getAction(req, body);
        std::string masterUrl = SaleApp::Config::AppConfig::instance().getMasterServerUrl();
        if (masterUrl.empty()) masterUrl = "http://127.0.0.1:8500";

        if (action == "check") {
            sendJson(res, SlaveUpdateManager::instance().checkMasterPatch(masterUrl));
            return;
        }
        if (action == "apply") {
            std::string dlPath = getString(body, "download_path", "/api/updates/download");
            sendJson(res, SlaveUpdateManager::instance().applyPatchFromMaster(masterUrl, dlPath));
            return;
        }
        if (action == "dismiss") {
            int64_t nid = 0;
            try { nid = body.value("id", 0LL); } catch (...) {}
            auto& db = Database::instance();
            if (nid > 0) {
                db.execute("UPDATE app_notifications SET is_read_cashier = 1 WHERE id = :id", {{":id", nid}});
            } else {
                db.execute("UPDATE app_notifications SET is_read_cashier = 1 WHERE type IN ('SYSTEM_NOTIFY', 'SYSTEM_UPDATE')");
            }
            sendJson(res, {{"success", true}});
            return;
        }
        sendError(res, "Invalid update action", 400);
    });
}

} // namespace SaleApp::Backend

