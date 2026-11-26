#include "master_handlers.hpp"
#include "master_tunnel.h"
#include "license.hpp"
#include "license_crypto.hpp"
#include "pos_bcrypt.h"
#include "ConfigManager.hpp"
#include "gemini_client.hpp"
#include "pin_vault.hpp"
#include "rate_limiter.hpp"
#include "upload_guard.hpp"
#include "vietqr_emvco.hpp"
#include "sqlite3.h"
#include <iostream>
#include <fstream>
#include <filesystem>
#include <chrono>
#include <algorithm>
#include <cmath>
#include <mutex>
#include <random>
#include <unordered_map>

namespace SaleApp::Backend {

namespace fs = std::filesystem;

static std::mutex g_saSessionMtx;
static std::unordered_map<std::string, json> g_saSessions;

static std::string normalizeSaRole(std::string role) {
    std::transform(role.begin(), role.end(), role.begin(), ::tolower);
    if (role == "kythuat" || role == "technical") return "technical";
    if (role == "ketoan" || role == "finance") return "finance";
    if (role == "kinhdoanh" || role == "sales") return "sales";
    if (role == "kiemtoan" || role == "auditor") return "auditor";
    if (role == "superadmin" || role == "super_admin") return "super_admin";
    return role;
}

static std::string extractSaToken(const httplib::Request& req) {
    if (!req.has_header("Cookie")) return "";
    std::string ck = req.get_header_value("Cookie");
    size_t pos = ck.find("sa_token=");
    if (pos == std::string::npos) return "";
    pos += 9;
    size_t end = ck.find(';', pos);
    std::string tok = (end == std::string::npos) ? ck.substr(pos) : ck.substr(pos, end - pos);
    while (!tok.empty() && (tok.back() == ' ' || tok.back() == '\r' || tok.back() == '\n')) tok.pop_back();
    return tok;
}

static json getSaSessionUser(const httplib::Request& req) {
    std::string tok = extractSaToken(req);
    if (tok.empty()) return json();
    std::lock_guard<std::mutex> lk(g_saSessionMtx);
    auto it = g_saSessions.find(tok);
    if (it == g_saSessions.end()) return json();
    return it->second;
}

static std::string replaceAllStr(std::string s, const std::string& from, const std::string& to) {
    size_t pos = 0;
    while ((pos = s.find(from, pos)) != std::string::npos) {
        s.replace(pos, from.length(), to);
        pos += to.length();
    }
    return s;
}

static std::string formatDateVn(const std::string& iso) {
    if (iso.size() >= 10 && iso[4] == '-' && iso[7] == '-') {
        return iso.substr(8, 2) + "/" + iso.substr(5, 2) + "/" + iso.substr(0, 4);
    }
    return iso;
}

static std::string formatVndDots(int64_t amount) {
    if (amount <= 0) return "Miễn phí (Gói Trải Nghiệm)";
    std::string raw = std::to_string(amount);
    std::string out;
    int cnt = 0;
    for (int i = static_cast<int>(raw.size()) - 1; i >= 0; --i) {
        if (cnt > 0 && cnt % 3 == 0) out.push_back('.');
        out.push_back(raw[i]);
        ++cnt;
    }
    std::reverse(out.begin(), out.end());
    return out + " đ";
}

static std::string formatModuleNames(const std::string& enabledModsJson) {
    json arr = json::parse(enabledModsJson, nullptr, false);
    if (!arr.is_array() || arr.empty()) return "POS Bán Hàng & In Nhiệt";
    const auto& cat = LicenseService::instance().getCatalog();
    std::string out;
    for (const auto& item : arr) {
        if (!item.is_string()) continue;
        std::string code = item.get<std::string>();
        std::string label = code;
        for (const auto& m : cat) {
            if (m.code == code) { label = m.name; break; }
        }
        if (!out.empty()) out += ", ";
        out += label;
    }
    return out.empty() ? "POS Bán Hàng & In Nhiệt" : out;
}

static void generateTenantLegalForms(Database& db, const fs::path& baseDir, int64_t tenantId, const fs::path* extraCopyDir = nullptr) {
    auto tRow = db.queryRow(
        "SELECT t.*, COALESCE(p.price_year, 0) AS plan_price_year "
        "FROM saas_tenants t LEFT JOIN saas_plans p ON p.id = t.plan_id "
        "WHERE t.id = :id LIMIT 1",
        {{":id", tenantId}}
    );
    if (tRow.is_null()) return;

    std::string tCode = tRow.value("tenant_code", "");
    if (tCode.empty()) return;

    fs::path tplDir = baseDir / "templates";
    if (!fs::exists(tplDir)) return;

    fs::path formsOutDir = baseDir / "packages" / tCode / "Ho_So_Mau";
    std::error_code ec;
    fs::create_directories(formsOutDir, ec);
    if (extraCopyDir) fs::create_directories(*extraCopyDir, ec);

    std::time_t now = std::time(nullptr);
    std::tm tmNow{};
#ifdef _WIN32
    localtime_s(&tmNow, &now);
#else
    localtime_r(&now, &tmNow);
#endif
    char dateBuf[32], compactBuf[32];
    std::snprintf(dateBuf, sizeof(dateBuf), "%02d/%02d/%04d", tmNow.tm_mday, tmNow.tm_mon + 1, tmNow.tm_year + 1900);
    std::snprintf(compactBuf, sizeof(compactBuf), "%04d%02d%02d", tmNow.tm_year + 1900, tmNow.tm_mon + 1, tmNow.tm_mday);

    std::string storeName = tRow.value("store_name", "");
    std::string ownerName = tRow.value("owner_name", "");
    std::string repRole = tRow.value("representative_role", "Chủ hộ kinh doanh");
    if (repRole.empty()) repRole = "Chủ hộ kinh doanh";
    std::string legalEntity = tRow.value("legal_entity_name", "");
    if (legalEntity.empty()) legalEntity = storeName;
    std::string taxId = tRow.value("tax_id_or_cccd", "");
    std::string phone = tRow.value("phone", "");
    std::string email = tRow.value("email", "");
    std::string storeAddr = tRow.value("address", "");
    std::string billingAddr = tRow.value("billing_address", "");
    if (billingAddr.empty()) billingAddr = storeAddr;
    std::string planName = tRow.value("plan_name", "Gói Tiêu Chuẩn");
    int64_t planPrice = tRow.value("plan_price_year", int64_t(0));
    std::string startDate = tRow.value("start_date", std::string(dateBuf));
    std::string expireDate = tRow.value("expire_date", "");
    std::string licenseKey = tRow.value("license_key", "");
    std::string enabledMods = formatModuleNames(tRow.value("enabled_modules", "[]"));

    struct FormSpec { const char* file; const char* title; };
    const FormSpec forms[] = {
        {"bao_gia_dich_vu.html", "Báo Giá Dịch Vụ (Mẫu Tự Động)"},
        {"hop_dong_dich_vu.html", "Hợp Đồng Dịch Vụ Phần Mềm (Mẫu Tự Động)"},
        {"dieu_khoan_su_dung_ban_quyen.html", "Điều Khoản Sử Dụng & Bản Quyền (Mẫu Tự Động)"},
        {"bien_ban_ban_giao_nghiem_thu.html", "Biên Bản Bàn Giao & Nghiệm Thu (Mẫu Tự Động)"},
        {"phieu_bao_hanh_ky_thuat.html", "Phiếu Bảo Hành & Hỗ Trợ Kỹ Thuật (Mẫu Tự Động)"}
    };

    for (const auto& f : forms) {
        fs::path src = tplDir / f.file;
        if (!fs::exists(src)) continue;
        std::ifstream ifs(src, std::ios::binary);
        if (!ifs) continue;
        std::ostringstream ss;
        ss << ifs.rdbuf();
        std::string html = ss.str();

        html = replaceAllStr(html, "{{TENANT_CODE}}", tCode);
        html = replaceAllStr(html, "{{STORE_NAME}}", storeName);
        html = replaceAllStr(html, "{{OWNER_NAME}}", ownerName);
        html = replaceAllStr(html, "{{REPRESENTATIVE_ROLE}}", repRole);
        html = replaceAllStr(html, "{{LEGAL_ENTITY_NAME}}", legalEntity);
        html = replaceAllStr(html, "{{TAX_ID_OR_CCCD}}", taxId);
        html = replaceAllStr(html, "{{PHONE}}", phone);
        html = replaceAllStr(html, "{{EMAIL}}", email);
        html = replaceAllStr(html, "{{STORE_ADDRESS}}", storeAddr);
        html = replaceAllStr(html, "{{BILLING_ADDRESS}}", billingAddr);
        html = replaceAllStr(html, "{{PLAN_NAME}}", planName);
        html = replaceAllStr(html, "{{PLAN_PRICE_VND}}", formatVndDots(planPrice));
        html = replaceAllStr(html, "{{START_DATE}}", formatDateVn(startDate));
        html = replaceAllStr(html, "{{EXPIRE_DATE}}", formatDateVn(expireDate));
        html = replaceAllStr(html, "{{LICENSE_KEY}}", licenseKey);
        html = replaceAllStr(html, "{{ENABLED_MODULES}}", enabledMods);
        html = replaceAllStr(html, "{{CREATED_DATE}}", dateBuf);
        html = replaceAllStr(html, "{{DATE_COMPACT}}", compactBuf);

        fs::path dst = formsOutDir / f.file;
        std::ofstream ofs(dst, std::ios::binary | std::ios::trunc);
        if (ofs) {
            ofs.write(html.data(), html.size());
            ofs.close();
        }
        if (extraCopyDir) {
            fs::path edst = *extraCopyDir / f.file;
            std::ofstream eofs(edst, std::ios::binary | std::ios::trunc);
            if (eofs) {
                eofs.write(html.data(), html.size());
                eofs.close();
            }
        }

        int64_t fSize = static_cast<int64_t>(html.size());
        std::string relPath = "packages/" + tCode + "/Ho_So_Mau/" + f.file;
        auto ex = db.queryRow(
            "SELECT id FROM saas_tenant_documents WHERE tenant_code = :tc AND file_name = :fn LIMIT 1",
            {{":tc", tCode}, {":fn", f.file}}
        );
        if (ex.is_null()) {
            db.execute(
                "INSERT INTO saas_tenant_documents "
                "(tenant_id, tenant_code, category, file_name, file_path, file_size, file_ext, title, notes, status, uploaded_by) "
                "VALUES (:tid, :tc, 'other', :fn, :fp, :fs, 'html', :ti, 'Tạo tự động từ mẫu chuẩn SOP-09', 'valid', 'System')",
                {{":tid", tenantId}, {":tc", tCode}, {":fn", f.file}, {":fp", relPath}, {":fs", fSize}, {":ti", f.title}}
            );
        } else {
            db.execute(
                "UPDATE saas_tenant_documents SET file_size = :fs, updated_at = datetime('now') WHERE id = :id",
                {{":fs", fSize}, {":id", ex.value("id", int64_t(0))}}
            );
        }
    }
}

static std::string generateRandomLicenseKey(const std::string& prefix, const char* charset, size_t charsetLen) {
    thread_local std::mt19937 rng(std::random_device{}());
    std::uniform_int_distribution<size_t> dist(0, charsetLen - 1);
    auto chunk = [&](int len) {
        std::string s;
        s.reserve(len);
        for (int i = 0; i < len; ++i) s += charset[dist(rng)];
        return s;
    };
    return prefix + "-" + chunk(4) + "-" + chunk(4) + "-" + chunk(4) + "-" + chunk(4);
}

static int64_t getAiActionCreditCost(const std::string& aiAction) {
    if (aiAction == "search_dish_images" || aiAction == "fetch_dish_image") return 0;
    if (aiAction == "parse_invoice") return 1;
    if (aiAction == "copilot_chat") return 1;
    if (aiAction == "generate_dish_image") return 2;
    if (aiAction == "generate_slide") return 3;
    return 1;
}

static std::string maskGeminiKey(const std::string& key) {
    if (key.size() <= 8) return "••••";
    return key.substr(0, 4) + "••••" + key.substr(key.size() - 4);
}

static void logAiKeyEvent(Database& db, int64_t keyId, const std::string& label, const std::string& masked,
                          const std::string& eventType, const std::string& detail, const std::string& actor = "SuperAdmin") {
    try {
        db.execute(
            "INSERT INTO master_ai_key_history (key_id, key_label, key_masked, event_type, detail, actor) "
            "VALUES (:kid, :lbl, :msk, :evt, :dtl, :act)",
            {{":kid", keyId}, {":lbl", label}, {":msk", masked}, {":evt", eventType}, {":dtl", detail}, {":act", actor}}
        );
    } catch (...) {}
}

static void syncLegacyGeminiSetting(Database& db) {
    auto active = db.queryRow("SELECT api_key FROM master_ai_keys WHERE status = 'active' ORDER BY priority ASC, id ASC LIMIT 1");
    if (!active.is_null() && !active.value("api_key", "").empty()) {
        db.execute(
            "INSERT INTO master_settings (setting_key, setting_value, updated_at) VALUES ('gemini_api_key', :v, datetime('now', 'localtime')) "
            "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v, updated_at = datetime('now', 'localtime')",
            {{":v", active.value("api_key", "")}}
        );
    } else {
        db.execute("DELETE FROM master_settings WHERE setting_key = 'gemini_api_key'");
    }
}

static void ensureMasterAiTables(Database& db) {
    static bool checked = false;
    if (checked) return;
    checked = true;
    db.execute(R"(
        CREATE TABLE IF NOT EXISTS master_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT,
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    )");
    db.execute(R"(
        CREATE TABLE IF NOT EXISTS ai_usage_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER DEFAULT 0,
            tenant_code TEXT DEFAULT '',
            store_name TEXT DEFAULT '',
            action TEXT DEFAULT '',
            model_used TEXT DEFAULT '',
            status TEXT DEFAULT 'ok',
            credits_used INTEGER DEFAULT 1,
            quota_bucket TEXT DEFAULT 'monthly',
            key_id INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    )");
    db.execute(R"(
        CREATE TABLE IF NOT EXISTS master_ai_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT DEFAULT 'Gemini Key',
            key_masked TEXT DEFAULT '',
            api_key TEXT NOT NULL,
            tier TEXT DEFAULT 'free',
            status TEXT DEFAULT 'standby',
            priority INTEGER DEFAULT 100,
            monthly_credit_limit INTEGER DEFAULT 0,
            daily_request_limit INTEGER DEFAULT 0,
            expires_at TEXT DEFAULT '',
            model_count INTEGER DEFAULT 0,
            last_checked_at TEXT DEFAULT '',
            last_used_at TEXT DEFAULT '',
            last_error TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    )");
    db.execute(R"(
        CREATE TABLE IF NOT EXISTS master_ai_key_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_id INTEGER DEFAULT 0,
            key_label TEXT DEFAULT '',
            key_masked TEXT DEFAULT '',
            event_type TEXT DEFAULT '',
            detail TEXT DEFAULT '',
            actor TEXT DEFAULT 'SuperAdmin',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    )");
    auto ensureCol = [&](const char* tbl, const char* col, const char* def) {
        auto cols = db.query(std::string("PRAGMA table_info(") + tbl + ")");
        for (const auto& c : cols) {
            if (c.value("name", "") == col) return;
        }
        try { db.execute(std::string("ALTER TABLE ") + tbl + " ADD COLUMN " + col + " " + def); } catch (...) {}
    };
    ensureCol("master_ai_keys", "provider", "TEXT DEFAULT 'gemini'");
    ensureCol("ai_usage_logs", "credits_used", "INTEGER DEFAULT 1");
    ensureCol("ai_usage_logs", "quota_bucket", "TEXT DEFAULT 'monthly'");
    ensureCol("ai_usage_logs", "key_id", "INTEGER DEFAULT 0");
    ensureCol("saas_tenants", "ai_monthly_quota", "INTEGER DEFAULT 50");
    ensureCol("saas_tenants", "ai_bonus_credits", "INTEGER DEFAULT 0");
    ensureCol("saas_tenants", "theme_json", "TEXT DEFAULT ''");

    // Migrate legacy single key in master_settings into master_ai_keys if pool is empty
    try {
        int64_t keyCount = db.queryScalar("SELECT COUNT(*) FROM master_ai_keys").get<int64_t>();
        if (keyCount == 0) {
            auto legacy = db.queryRow("SELECT setting_value, updated_at FROM master_settings WHERE setting_key = 'gemini_api_key'");
            if (!legacy.is_null() && !legacy.value("setting_value", "").empty()) {
                std::string k = legacy.value("setting_value", "");
                std::string masked = maskGeminiKey(k);
                db.execute(
                    "INSERT INTO master_ai_keys (label, key_masked, api_key, tier, status, priority, last_checked_at) "
                    "VALUES ('Gemini Key Chính', :msk, :k, 'free', 'active', 10, COALESCE(:upd, datetime('now', 'localtime')))",
                    {{":msk", masked}, {":k", k}, {":upd", legacy.value("updated_at", "")}}
                );
                int64_t newId = db.queryScalar("SELECT last_insert_rowid()").get<int64_t>();
                logAiKeyEvent(db, newId, "Gemini Key Chính", masked, "ADDED", "Tự động chuyển đổi từ cấu hình Master cũ sang Key Pool.", "System");
            }
        }
    } catch (...) {}
}

static void expireOutdatedGeminiKeys(Database& db) {
    auto expiredRows = db.query(
        "SELECT id, label, key_masked, expires_at FROM master_ai_keys "
        "WHERE COALESCE(expires_at, '') != '' AND date(expires_at) < date('now', 'localtime') "
        "AND status IN ('active', 'standby')"
    );
    for (const auto& r : expiredRows) {
        int64_t kid = r.value("id", int64_t(0));
        db.execute("UPDATE master_ai_keys SET status = 'expired', last_error = 'Key đã quá hạn sử dụng', updated_at = datetime('now', 'localtime') WHERE id = :id", {{":id", kid}});
        logAiKeyEvent(db, kid, r.value("label", ""), r.value("key_masked", ""), "EXPIRED", "Quá ngày hết hạn: " + r.value("expires_at", ""), "System");
    }
}

static json selectActiveGeminiKey(Database& db) {
    expireOutdatedGeminiKeys(db);
    auto row = db.queryRow(
        "SELECT * FROM master_ai_keys WHERE status = 'active' AND COALESCE(provider, 'gemini') = 'gemini' ORDER BY priority ASC, id ASC LIMIT 1"
    );
    if (!row.is_null() && !row.value("api_key", "").empty()) return row;

    // Auto-promote highest-priority standby Gemini key if no active key exists
    auto standby = db.queryRow(
        "SELECT * FROM master_ai_keys WHERE status = 'standby' AND COALESCE(provider, 'gemini') = 'gemini' "
        "AND (COALESCE(expires_at, '') = '' OR date(expires_at) >= date('now', 'localtime')) "
        "ORDER BY priority ASC, id ASC LIMIT 1"
    );
    if (!standby.is_null()) {
        int64_t kid = standby.value("id", int64_t(0));
        db.execute("UPDATE master_ai_keys SET status = 'active', updated_at = datetime('now', 'localtime') WHERE id = :id", {{":id", kid}});
        logAiKeyEvent(db, kid, standby.value("label", ""), standby.value("key_masked", ""), "AUTO_FAILOVER", "Tự động kích hoạt key dự phòng vì chưa có key chính khả dụng.", "System");
        syncLegacyGeminiSetting(db);
        standby["status"] = "active";
        return standby;
    }
    return json();
}

static bool handleGeminiKeyRuntimeError(Database& db, const json& keyRow, const std::string& errMsg) {
    if (keyRow.is_null()) return false;
    int64_t kid = keyRow.value("id", int64_t(0));
    std::string label = keyRow.value("label", "");
    std::string masked = keyRow.value("key_masked", "");
    std::string lower = errMsg;
    std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);

    bool isRateLimit = (lower.find("429") != std::string::npos || lower.find("resource_exhausted") != std::string::npos ||
                        lower.find("quota") != std::string::npos || lower.find("rate") != std::string::npos);
    bool isAuthFail = (lower.find("401") != std::string::npos || lower.find("403") != std::string::npos ||
                       lower.find("api_key_invalid") != std::string::npos || lower.find("permission_denied") != std::string::npos ||
                       lower.find("expired") != std::string::npos);

    if (!isRateLimit && !isAuthFail) {
        db.execute("UPDATE master_ai_keys SET last_error = :e, updated_at = datetime('now', 'localtime') WHERE id = :id", {{":e", errMsg}, {":id", kid}});
        return false;
    }

    std::string newStatus = isAuthFail ? "revoked" : "rate_limited";
    std::string evtType = isAuthFail ? "REVOKED" : "RATE_LIMITED";
    db.execute(
        "UPDATE master_ai_keys SET status = :st, last_error = :e, updated_at = datetime('now', 'localtime') WHERE id = :id",
        {{":st", newStatus}, {":e", errMsg}, {":id", kid}}
    );
    logAiKeyEvent(db, kid, label, masked, evtType, errMsg, "System");

    // Promote next standby key if available
    auto nextKey = db.queryRow(
        "SELECT * FROM master_ai_keys WHERE id != :id AND status = 'standby' "
        "AND (COALESCE(expires_at, '') = '' OR date(expires_at) >= date('now', 'localtime')) "
        "ORDER BY priority ASC, id ASC LIMIT 1",
        {{":id", kid}}
    );
    if (!nextKey.is_null()) {
        int64_t nextId = nextKey.value("id", int64_t(0));
        db.execute("UPDATE master_ai_keys SET status = 'active', updated_at = datetime('now', 'localtime') WHERE id = :id", {{":id", nextId}});
        logAiKeyEvent(db, nextId, nextKey.value("label", ""), nextKey.value("key_masked", ""), "AUTO_FAILOVER",
                      "Tự động chuyển tiếp từ key [" + masked + "] do lỗi " + evtType, "System");
        syncLegacyGeminiSetting(db);
        return true;
    }
    syncLegacyGeminiSetting(db);
    return false;
}

static json buildTenantAiQuotaSnapshot(Database& db, const json& tenant) {
    int64_t tid = tenant.contains("id") && tenant["id"].is_number() ? tenant["id"].get<int64_t>() : 0;
    int64_t monthlyQuota = 50;
    if (tenant.contains("ai_monthly_quota") && tenant["ai_monthly_quota"].is_number()) {
        monthlyQuota = tenant["ai_monthly_quota"].get<int64_t>();
    }
    int64_t bonusCredits = 0;
    if (tenant.contains("ai_bonus_credits") && tenant["ai_bonus_credits"].is_number()) {
        bonusCredits = std::max<int64_t>(0, tenant["ai_bonus_credits"].get<int64_t>());
    }
    int64_t monthlyUsed = db.queryScalar(
        "SELECT COALESCE(SUM(credits_used), 0) FROM ai_usage_logs "
        "WHERE tenant_id = :tid AND status = 'ok' AND COALESCE(quota_bucket, 'monthly') = 'monthly' "
        "AND substr(created_at, 1, 7) = strftime('%Y-%m', 'now', 'localtime')",
        {{":tid", tid}}
    ).get<int64_t>();
    int64_t totalCreditsMonth = db.queryScalar(
        "SELECT COALESCE(SUM(credits_used), 0) FROM ai_usage_logs "
        "WHERE tenant_id = :tid AND status = 'ok' "
        "AND substr(created_at, 1, 7) = strftime('%Y-%m', 'now', 'localtime')",
        {{":tid", tid}}
    ).get<int64_t>();
    bool unlimited = (monthlyQuota < 0);
    int64_t remainingMonthly = unlimited ? -1 : std::max<int64_t>(0, monthlyQuota - monthlyUsed);
    int64_t remainingTotal = unlimited ? -1 : (remainingMonthly + bonusCredits);
    return {
        {"unlimited", unlimited},
        {"monthly_quota", monthlyQuota},
        {"monthly_used", monthlyUsed},
        {"bonus_credits", bonusCredits},
        {"remaining_monthly", remainingMonthly},
        {"remaining_total", remainingTotal},
        {"total_credits_month", totalCreditsMonth}
    };
}

static bool checkTenantModuleAllowed(const json& tenant, const std::string& modCode) {
    auto parseArr = [](const std::string& raw) -> std::vector<std::string> {
        std::vector<std::string> out;
        try {
            json j = json::parse(raw.empty() ? "[]" : raw);
            if (j.is_array()) {
                for (const auto& it : j) {
                    if (it.is_string()) out.push_back(it.get<std::string>());
                }
            }
        } catch (...) {}
        return out;
    };
    std::vector<std::string> blocked = parseArr(tenant.value("blocked_modules", "[]"));
    if (std::find(blocked.begin(), blocked.end(), modCode) != blocked.end()) return false;
    std::vector<std::string> enabled = parseArr(tenant.value("enabled_modules", "[]"));
    if (enabled.empty()) return true; // Enterprise/all if empty or check explicit
    return std::find(enabled.begin(), enabled.end(), modCode) != enabled.end();
}

static void syncLocalSlaveLicenseCache(const std::string& enabledModsStr, const std::string& blockedModsStr, double cardFeePct) {
    fs::path baseDir = SaleApp::Config::AppConfig::instance().getBaseDir(); // master dir
    std::vector<fs::path> slaveDbs = {
        baseDir.parent_path() / "slave" / "database" / "store_local.db",
        baseDir / "packages" / "GP001" / "release" / "CyberNexus_POS_Release_GP001" / "database" / "store_local.db"
    };
    for (const auto& dbPath : slaveDbs) {
        if (!fs::exists(dbPath)) continue;
        sqlite3* sdb = nullptr;
        if (sqlite3_open(dbPath.string().c_str(), &sdb) == SQLITE_OK && sdb) {
            sqlite3_busy_timeout(sdb, 3000);
            sqlite3_exec(sdb, "ALTER TABLE local_license_cache ADD COLUMN blocked_modules TEXT DEFAULT '[]';", nullptr, nullptr, nullptr);
            sqlite3_exec(sdb, "ALTER TABLE local_license_cache ADD COLUMN card_fee_percent REAL DEFAULT 0.0;", nullptr, nullptr, nullptr);
            sqlite3_stmt* stmt = nullptr;
            const char* sql = "UPDATE local_license_cache SET enabled_modules = ?1, blocked_modules = ?2, card_fee_percent = ?3, last_sync_at = datetime('now'), last_sync_status = 'master_push_ok' WHERE id = 1;";
            if (sqlite3_prepare_v2(sdb, sql, -1, &stmt, nullptr) == SQLITE_OK) {
                sqlite3_bind_text(stmt, 1, enabledModsStr.c_str(), -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 2, blockedModsStr.c_str(), -1, SQLITE_TRANSIENT);
                sqlite3_bind_double(stmt, 3, cardFeePct);
                sqlite3_step(stmt);
                sqlite3_finalize(stmt);
            }
            sqlite3_close(sdb);
        }
    }
}

void MasterHandlers::sendJson(httplib::Response& res, const json& data, int statusCode) {
    res.status = statusCode;
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With");
    res.set_header("Access-Control-Allow-Credentials", "true");
    res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.set_header("Pragma", "no-cache");
    res.set_header("Expires", "0");
    res.set_content(data.dump(), "application/json; charset=utf-8");
}

static std::string inferMasterErrorCode(const std::string& message) {
    if (message.find("Chưa đăng nhập") != std::string::npos || message.find("xác thực") != std::string::npos) return "AUTH_REQUIRED";
    if (message.find("Super Admin") != std::string::npos || message.find("quyền") != std::string::npos) return "SUPER_ADMIN_REQUIRED";
    if (message.find("Không tìm thấy cửa hàng") != std::string::npos || message.find("Không tìm thấy quán") != std::string::npos || message.find("hồ sơ") != std::string::npos) return "TENANT_NOT_FOUND";
    if (message.find("License") != std::string::npos || message.find("giấy phép") != std::string::npos) return "LICENSE_INVALID";
    if (message.find("bản vá") != std::string::npos || message.find("OTA") != std::string::npos) return "OTA_NOT_FOUND";
    if (message.find("Số dư ví") != std::string::npos) return "RESELLER_INSUFFICIENT_BALANCE";
    return "API_ERROR";
}

void MasterHandlers::sendError(httplib::Response& res, const std::string& message, int statusCode) {
    json err = {
        {"success", false},
        {"code", inferMasterErrorCode(message)},
        {"params", json::object()},
        {"message", message}
    };
    sendJson(res, err, statusCode);
}

json MasterHandlers::parseBody(const httplib::Request& req) {
    return BodyParser::parseBody(req);
}

std::string MasterHandlers::getAction(const httplib::Request& req, const json& body) {
    return BodyParser::getAction(req, body);
}

std::string MasterHandlers::getString(const json& j, const std::string& key, const std::string& def) {
    if (j.contains(key) && !j[key].is_null()) {
        if (j[key].is_string()) return j[key].get<std::string>();
        return j[key].dump();
    }
    return def;
}

int64_t MasterHandlers::getInt(const json& j, const std::string& key, int64_t def) {
    if (j.contains(key) && !j[key].is_null()) {
        if (j[key].is_number()) return j[key].get<int64_t>();
        if (j[key].is_string()) {
            try { return std::stoll(j[key].get<std::string>()); } catch (...) {}
        }
    }
    return def;
}

static void recordAuditLog(Database& db, int64_t staffId, const std::string& username, const std::string& role,
                           const std::string& action, const std::string& targetTenant,
                           const std::string& description, const std::string& metaJson,
                           const std::string& ipAddress) {
    try {
        db.execute(R"(
            INSERT INTO saas_audit_logs 
            (staff_id, username, role, action, target_tenant, description, metadata_json, ip_address, created_at)
            VALUES (:sid, :un, :ro, :ac, :tt, :de, :me, :ip, datetime('now'))
        )", {
            {":sid", staffId}, {":un", username.empty() ? "system" : username}, {":ro", role.empty() ? "system" : role},
            {":ac", action}, {":tt", targetTenant.empty() ? "SYSTEM" : targetTenant},
            {":de", description}, {":me", metaJson.empty() ? "{}" : metaJson},
            {":ip", ipAddress.empty() ? "127.0.0.1" : ipAddress}
        });
    } catch (...) {}
}

// ==========================================
// SUPER ADMIN MASTER HANDLER
// ==========================================
void MasterHandlers::handleSuperAdmin(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);

        auto getVal = [&](const std::string& key, const std::string& def = "") -> std::string {
            if (req.has_file(key)) return req.get_file_value(key).content;
            if (req.has_param(key)) return req.get_param_value(key);
            if (body.is_object() && body.contains(key) && !body[key].is_null()) {
                if (body[key].is_string()) return body[key].get<std::string>();
                if (body[key].is_number()) return std::to_string(body[key].get<int64_t>());
                return body[key].dump();
            }
            return def;
        };

        auto getValInt = [&](const std::string& key, int64_t def = 0) -> int64_t {
            if (req.has_file(key)) {
                try { return std::stoll(req.get_file_value(key).content); } catch (...) {}
            }
            if (req.has_param(key)) {
                try { return std::stoll(req.get_param_value(key)); } catch (...) {}
            }
            if (body.is_object() && body.contains(key) && !body[key].is_null()) {
                if (body[key].is_number()) return body[key].get<int64_t>();
                if (body[key].is_string()) {
                    try { return std::stoll(body[key].get<std::string>()); } catch (...) {}
                }
            }
            return def;
        };

        // [SEC-11] Enforce authenticated SuperAdmin session for GET & Reseller actions
        if (action != "login" && action != "logout" &&
            action != "check" && action != "check_auth" && action != "status") {
            json su = getSaSessionUser(req);
            if (su.is_null() || !su.is_object()) {
                sendJson(res, {{"success", false}, {"message", "Phiên đăng nhập SuperAdmin đã hết hạn hoặc không hợp lệ!"}}, 401);
                return;
            }
        }

        // Reseller data queries (accessible via both GET & POST)
        if (action == "get_resellers") {
            auto rows = db.query(R"(
                SELECT r.*,
                       (SELECT COUNT(*) FROM saas_tenants t WHERE t.reseller_id = r.id) as total_tenants,
                       (SELECT COALESCE(SUM(t.price_charged), 0) FROM saas_tenants t WHERE t.reseller_id = r.id) as total_revenue
                FROM saas_resellers r
                ORDER BY r.id DESC
            )");
            sendJson(res, {{"success", true}, {"data", rows}, {"resellers", rows}});
            return;
        }

        if (action == "get_reseller_wallet_logs") {
            int64_t rId = getValInt("reseller_id", 0);
            std::string sql = "SELECT * FROM saas_reseller_wallet_logs WHERE 1=1";
            std::vector<std::pair<std::string, json>> params;
            if (rId > 0) {
                sql += " AND reseller_id = :rid";
                params.push_back({":rid", rId});
            }
            sql += " ORDER BY id DESC LIMIT 100";
            auto rows = db.query(sql, params);
            sendJson(res, {{"success", true}, {"data", rows}, {"logs", rows}});
            return;
        }

        if (action == "update_store_location") {
            if (req.method == "POST") {
                json su = getSaSessionUser(req);
                if (!su.is_null() && su.value("role", "") == "auditor") {
                    sendJson(res, {{"success", false}, {"message", "Ban Kiểm Toán chỉ có quyền xem (Read-only), không được phép thay đổi dữ liệu!"}}, 403);
                    return;
                }
            }
            int64_t tid = body.value("tenant_id", int64_t(0));
            if (tid <= 0 && req.has_param("tenant_id")) {
                try { tid = std::stoll(req.get_param_value("tenant_id")); } catch (...) {}
            }
            double lat = body.value("geo_lat", 0.0);
            double lng = body.value("geo_lng", 0.0);
            std::string label = body.value("geo_label", "");
            if (tid <= 0 || lat == 0.0 || lng == 0.0) {
                sendJson(res, {{"success", false}, {"message", "Vui lòng nhập đầy đủ tọa độ Google Maps hợp lệ!"}}, 400);
                return;
            }
            db.execute(
                "UPDATE saas_tenants SET geo_lat = :lat, geo_lng = :lng, geo_label = :lbl, geo_source = 'gps' WHERE id = :id",
                {{":lat", lat}, {":lng", lng}, {":lbl", label}, {":id", tid}}
            );
            sendJson(res, {{"success", true}, {"message", "Đã cập nhật vị trí Google Maps chính xác cho cửa hàng!"}});
            return;
        }

        if (req.method == "GET") {
            if (action == "tenants" || action == "get_tenants" || action.empty()) {
                std::string kw = req.get_param_value("kw");
                std::string status = req.get_param_value("status");

                std::string sql = R"(
                    SELECT id, tenant_code, store_name, owner_name, representative_role, legal_entity_name, tax_id_or_cccd, phone, email, address, billing_address, note,
                           plan_id, plan_name, billing_cycle, subscription_status, start_date, expire_date,
                           workflow_stage, payment_confirmed, payment_confirmed_by, payment_confirmed_at,
                           trial_started_at, handover_at, warranty_until, workflow_override, deleted_at, deleted_reason,
                           enabled_modules, license_key, machine_id, machine_name, logo_path, created_at, updated_at,
                           last_check_at, last_check_ip, lan_ip, wan_ip, geo_lat, geo_lng, geo_label, geo_source,
                           CAST((julianday(expire_date) - julianday('now')) AS INTEGER) as days_left
                    FROM saas_tenants
                    WHERE 1=1
                )";
                std::vector<std::pair<std::string, json>> params;
                if (status == "deleted") {
                    sql += " AND subscription_status = 'deleted'";
                } else {
                    sql += " AND subscription_status != 'deleted'";
                }
                if (!kw.empty()) {
                    sql += " AND (store_name LIKE :kw OR tenant_code LIKE :kw OR owner_name LIKE :kw OR phone LIKE :kw)";
                    params.push_back({":kw", "%" + kw + "%"});
                }
                if (!status.empty() && status != "all" && status != "deleted") {
                    sql += " AND subscription_status = :status";
                    params.push_back({":status", status});
                }
                sql += " ORDER BY id ASC";

                json tenants = params.empty() ? db.query(sql) : db.query(sql, params);
                for (auto& t : tenants) {
                    std::string raw = t.value("enabled_modules", "[]");
                    int count = 0;
                    try {
                        json mods = json::parse(raw);
                        if (mods.is_array()) count = mods.size();
                    } catch (...) {}
                    t["active_module_count"] = count;
                    t["total_catalog_count"] = LicenseService::instance().getCatalog().size();
                    t["package_state"] = "ready";
                    t["provision_state"] = "ready";

                    int daysLeft = t.value("days_left", 0);
                    std::string subStatus = t.value("subscription_status", "active");
                    if (subStatus == "deleted") {
                        t["badge_color"] = "slate";
                        t["badge_status"] = "Đã Xóa (Trash)";
                    } else if (subStatus == "suspended") {
                        t["badge_color"] = "rose";
                        t["badge_status"] = "Tạm Khóa";
                    } else if (daysLeft < 0) {
                        t["badge_color"] = "rose";
                        t["badge_status"] = "Hết Hạn";
                    } else if (subStatus == "trial") {
                        t["badge_color"] = "sky";
                        t["badge_status"] = "Dùng Thử (" + std::to_string(daysLeft) + "d)";
                    } else if (daysLeft <= 7) {
                        t["badge_color"] = "amber";
                        t["badge_status"] = "Sắp Hết Hạn";
                    } else {
                        t["badge_color"] = "emerald";
                        t["badge_status"] = "Hoạt Động";
                    }

                    int64_t tid = 0;
                    if (t.contains("id") && t["id"].is_number()) tid = t["id"].get<int64_t>();
                    t["is_tunnel_online"] = StoreTunnelManager::instance().isStoreOnline(tid);
                    t["last_ping_latency_ms"] = StoreTunnelManager::instance().getLastLatencyMs(tid);
                    t["last_runtime"] = StoreTunnelManager::instance().getLastRuntime(tid);
                }
                auto delRow = db.queryRow("SELECT COUNT(*) as cnt FROM saas_tenants WHERE subscription_status = 'deleted'");
                int64_t deletedCount = delRow.is_null() ? 0 : delRow.value("cnt", int64_t(0));
                sendJson(res, {{"success", true}, {"data", tenants}, {"deleted_count", deletedCount}});
                return;
            }

            if (action == "check_store_online") {
                int checkTimeoutMs = 4000;
                try {
                    auto cfgRow = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = 'wan_check_timeout_ms' LIMIT 1");
                    if (!cfgRow.is_null()) {
                        checkTimeoutMs = std::max(1000, std::min(15000, std::stoi(cfgRow.value("setting_value", "4000"))));
                    }
                } catch (...) {}

                int64_t tid = 0;
                if (req.has_param("tenant_id")) {
                    try { tid = std::stoll(req.get_param_value("tenant_id")); } catch (...) {}
                } else if (body.contains("tenant_id") && body["tenant_id"].is_number()) {
                    tid = body["tenant_id"].get<int64_t>();
                }

                if (tid > 0) {
                    auto pr = StoreTunnelManager::instance().pingStore(tid, checkTimeoutMs);
                    if (pr.online) {
                        db.execute("UPDATE saas_tenants SET last_check_at = datetime('now') WHERE id = :id", {{":id", tid}});
                    }
                    auto updated = db.queryRow("SELECT last_check_at, last_check_ip FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
                    sendJson(res, {
                        {"success", true},
                        {"tenant_id", tid},
                        {"online", pr.online},
                        {"latency_ms", pr.latency_ms},
                        {"reason", pr.reason},
                        {"runtime", pr.runtime},
                        {"last_check_at", getString(updated, "last_check_at")},
                        {"last_check_ip", getString(updated, "last_check_ip")}
                    });
                    return;
                }

                // SEC-TUN-01: Master chủ động đẩy lệnh CHECK_INTEGRITY xuống Slave qua Tunnel
                if (action == "check_store_integrity") {
                    int64_t tid = 0;
                    try { tid = std::stoll(BodyParser::getParam(req, body, "tenant_id", "0")); } catch (...) {}
                    if (tid <= 0) {
                        sendError(res, "Missing tenant_id", 400);
                        return;
                    }
                    bool queued = StoreTunnelManager::instance().enqueueCommand(tid, "CHECK_INTEGRITY", json::object());
                    sendJson(res, {{"success", queued}, {"tenant_id", tid}, {"message", queued ? "Đã đẩy lệnh CHECK_INTEGRITY tới Slave qua Tunnel" : "Không thể xếp hàng lệnh CHECK_INTEGRITY"}});
                    return;
                }

                // Check all active/non-deleted tenants
                json rows = db.query("SELECT id, tenant_code, store_name, last_check_at, last_check_ip FROM saas_tenants WHERE COALESCE(subscription_status, 'active') != 'deleted' ORDER BY id ASC");
                json results = json::array();
                for (const auto& r : rows) {
                    int64_t id = r.contains("id") && r["id"].is_number() ? r["id"].get<int64_t>() : 0;
                    if (id <= 0) continue;
                    // Only wait full timeout if store currently has an active poll channel
                    auto pr = StoreTunnelManager::instance().pingStore(id, checkTimeoutMs);
                    std::string lastAt = getString(r, "last_check_at");
                    if (pr.online) {
                        db.execute("UPDATE saas_tenants SET last_check_at = datetime('now') WHERE id = :id", {{":id", id}});
                        auto u = db.queryRow("SELECT last_check_at FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", id}});
                        lastAt = getString(u, "last_check_at", lastAt);
                    }
                    results.push_back({
                        {"tenant_id", id},
                        {"tenant_code", getString(r, "tenant_code")},
                        {"online", pr.online},
                        {"latency_ms", pr.latency_ms},
                        {"reason", pr.reason},
                        {"runtime", pr.runtime},
                        {"last_check_at", lastAt},
                        {"last_check_ip", getString(r, "last_check_ip")}
                    });
                }
                sendJson(res, {{"success", true}, {"results", results}});
                return;
            }

            if (action == "tenant_detail" || action == "get_tenant_detail" || action == "detail") {
                int64_t tid = 0;
                if (req.has_param("id")) {
                    try { tid = std::stoll(req.get_param_value("id")); } catch (...) {}
                } else if (req.has_param("tenant_id")) {
                    try { tid = std::stoll(req.get_param_value("tenant_id")); } catch (...) {}
                }
                if (tid <= 0) tid = 1;

                auto tenant = db.queryRow("SELECT * FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
                if (tenant.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy cửa hàng!"}}, 404);
                    return;
                }

                auto enabledMods = LicenseService::instance().getEnabledModules(tid);
                json matrix = LicenseService::instance().getModuleMatrix(enabledMods);

                std::vector<std::string> blockedList;
                try {
                    std::string bmRaw = getString(tenant, "blocked_modules", "[]");
                    json bmArr = json::parse(bmRaw, nullptr, false);
                    if (bmArr.is_array()) {
                        for (const auto& item : bmArr) {
                            if (item.is_string()) blockedList.push_back(item.get<std::string>());
                        }
                    }
                } catch (...) {}

                double cardFeePct = 0.0;
                if (tenant.contains("card_fee_percent") && !tenant["card_fee_percent"].is_null()) {
                    try {
                        if (tenant["card_fee_percent"].is_number()) cardFeePct = tenant["card_fee_percent"].get<double>();
                        else if (tenant["card_fee_percent"].is_string()) cardFeePct = std::stod(tenant["card_fee_percent"].get<std::string>());
                    } catch (...) {}
                }

                for (auto& m : matrix) {
                    std::string mCode = m.value("code", "");
                    bool isBlk = (std::find(blockedList.begin(), blockedList.end(), mCode) != blockedList.end());
                    bool isEn = m.value("is_enabled", false) && !isBlk;
                    m["is_enabled"] = isEn;
                    m["is_blocked"] = isBlk;
                    m["state"] = isBlk ? "BLOCKED" : (isEn ? "ON" : "OFF");
                    if (mCode == "mod_card_payment") {
                        m["card_fee_percent"] = cardFeePct;
                    }
                }

                json invoices = db.query("SELECT * FROM saas_invoices WHERE tenant_id = :tid ORDER BY id DESC", {{":tid", tid}});

                sendJson(res, {
                    {"success", true},
                    {"tenant", tenant},
                    {"modules", matrix},
                    {"invoices", invoices}
                });
                return;
            }

            if (action == "dashboard_stats") {
                auto totalRow = db.queryRow("SELECT count(*) as cnt FROM saas_tenants WHERE subscription_status != 'deleted'");
                auto activeRow = db.queryRow("SELECT count(*) as cnt FROM saas_tenants WHERE subscription_status = 'active'");
                auto expiringRow = db.queryRow("SELECT count(*) as cnt FROM saas_tenants WHERE subscription_status = 'active' AND expire_date <= date('now', '+7 days')");
                
                int64_t totalTenants = totalRow.is_null() ? 0 : totalRow.value("cnt", 0LL);
                int64_t activeTenants = activeRow.is_null() ? 0 : activeRow.value("cnt", 0LL);
                int64_t expiringTenants = expiringRow.is_null() ? 0 : expiringRow.value("cnt", 0LL);

                auto revMonthRow = db.queryRow("SELECT COALESCE(SUM(amount), 0) as total FROM saas_invoices WHERE strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now') AND payment_status = 'paid'");
                auto revYearRow = db.queryRow("SELECT COALESCE(SUM(amount), 0) as total FROM saas_invoices WHERE strftime('%Y', paid_at) = strftime('%Y', 'now') AND payment_status = 'paid'");
                double revMonth = revMonthRow.is_null() ? 0.0 : revMonthRow.value("total", 0.0);
                double revYear = revYearRow.is_null() ? 0.0 : revYearRow.value("total", 0.0);

                json urgent = db.query(R"(
                    SELECT id, tenant_code, store_name, owner_name, phone, plan_name, expire_date,
                           CAST((julianday(expire_date) - julianday('now')) AS INTEGER) as days_left
                    FROM saas_tenants
                    WHERE subscription_status != 'deleted' AND expire_date <= date('now', '+7 days')
                    ORDER BY expire_date ASC
                    LIMIT 5
                )");

                json chartRows = db.query(R"(
                    SELECT strftime('%m/%Y', paid_at) as ym, COALESCE(SUM(amount), 0) as total
                    FROM saas_invoices
                    WHERE payment_status = 'paid' AND paid_at >= date('now', '-5 months', 'start of month')
                    GROUP BY strftime('%Y-%m', paid_at)
                    ORDER BY strftime('%Y-%m', paid_at) ASC
                )");
                json chartLabels = json::array();
                json chartData = json::array();
                for (const auto& cr : chartRows) {
                    chartLabels.push_back("Thg " + cr.value("ym", ""));
                    chartData.push_back(cr.value("total", 0.0));
                }

                json plansDist = db.query(R"(
                    SELECT plan_name, count(*) as count
                    FROM saas_tenants
                    WHERE subscription_status != 'deleted'
                    GROUP BY plan_name
                )");

                sendJson(res, {
                    {"success", true},
                    {"stats", {
                        {"total_tenants", totalTenants},
                        {"active_tenants", activeTenants},
                        {"expiring_tenants", expiringTenants},
                        {"revenue_month", revMonth},
                        {"revenue_year", revYear},
                        {"urgent_renewals", urgent},
                        {"chart_labels", chartLabels},
                        {"chart_data", chartData},
                        {"plan_distribution", plansDist}
                    }}
                });
                return;
            }

            if (action == "plans" || action == "get_plans") {
                json plans = db.query("SELECT * FROM saas_plans ORDER BY sort_order ASC, id ASC");
                for (auto& p : plans) {
                    std::string raw = p.value("default_modules", "[]");
                    json mods = json::array();
                    try { mods = json::parse(raw); } catch (...) {}
                    p["modules"] = mods;
                    p["module_count"] = mods.is_array() ? mods.size() : 0;
                }
                sendJson(res, {{"success", true}, {"data", plans}});
                return;
            }

            if (action == "invoices" || action == "get_invoices") {
                json invoices = db.query(R"(
                    SELECT i.*, COALESCE(t.store_name, i.store_name) as store_name, t.tenant_code
                    FROM saas_invoices i
                    LEFT JOIN saas_tenants t ON i.tenant_id = t.id
                    ORDER BY i.id DESC
                    LIMIT 100
                )");
                sendJson(res, {{"success", true}, {"data", invoices}});
                return;
            }

            if (action == "get_saas_settings" || action == "saas_settings") {
                json rows = db.query("SELECT setting_key, setting_value FROM saas_settings");
                json settings = json::object();
                for (const auto& r : rows) {
                    std::string k = r.value("setting_key", "");
                    if (!k.empty()) settings[k] = r.value("setting_value", "");
                }
                sendJson(res, {{"success", true}, {"data", settings}});
                return;
            }

            if (action == "get_package_storage") {
                sendJson(res, {{"success", true}, {"path", "./packages"}});
                return;
            }

            if (action == "get_tenant_packages" || action == "get_tenant_documents") {
                int64_t tid = getValInt("tenant_id", 0);
                std::string tcode = getVal("tenant_code", "");

                json tenant = nullptr;
                if (tid > 0) {
                    tenant = db.queryRow("SELECT * FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
                } else if (!tcode.empty()) {
                    tenant = db.queryRow("SELECT * FROM saas_tenants WHERE tenant_code = :tc LIMIT 1", {{":tc", tcode}});
                }

                if (tenant.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy thông tin cửa hàng!"}}, 404);
                    return;
                }

                int64_t realTid = getInt(tenant, "id", 0);
                std::string realTcode = getString(tenant, "tenant_code", "");

                fs::path basePackages = SaleApp::Config::AppConfig::instance().getBaseDir() / "packages" / realTcode;
                try {
                    fs::create_directories(basePackages / "contracts");
                    fs::create_directories(basePackages / "invoices");
                    fs::create_directories(basePackages / "handover");
                    fs::create_directories(basePackages / "release");
                } catch (...) {}

                json docs = db.query(
                    "SELECT * FROM saas_tenant_documents WHERE tenant_id = :tid OR tenant_code = :tc ORDER BY id DESC",
                    {{":tid", realTid}, {":tc", realTcode}}
                );

                bool hasContract = false;
                bool hasInvoice = false;
                bool hasHandover = false;
                bool hasRelease = false;
                std::string releaseZipPath = "";

                for (const auto& d : docs) {
                    std::string cat = d.value("category", "");
                    if (cat == "contracts" || cat == "contract") hasContract = true;
                    if (cat == "invoices" || cat == "invoice") hasInvoice = true;
                    if (cat == "handover" && d.value("file_name", "") != "THONG_TIN_DANG_NHAP_BAN_DAU.txt") hasHandover = true;
                    if (cat == "release") {
                        hasRelease = true;
                        releaseZipPath = d.value("file_path", "");
                    }
                }

                fs::path expectedZip = basePackages / "release" / ("CyberNexus_POS_Release_" + realTcode + ".zip");
                if (fs::exists(expectedZip)) {
                    hasRelease = true;
                    releaseZipPath = "packages/" + realTcode + "/release/" + expectedZip.filename().string();
                }
                std::string releaseExePath = "";
                fs::path expectedExe = basePackages / "release" / ("CyberNexus_POS_Setup_" + realTcode + ".exe");
                if (fs::exists(expectedExe)) {
                    hasRelease = true;
                    releaseExePath = "packages/" + realTcode + "/release/" + expectedExe.filename().string();
                }

                std::string subSt = tenant.value("subscription_status", "active");
                std::string wfStage = tenant.value("workflow_stage", "pending_contract");
                int payConf = tenant.value("payment_confirmed", 0);
                int wfOver = tenant.value("workflow_override", 0);
                bool isTrial = (subSt == "trial" || wfStage == "trial");
                bool canGen = isTrial || (payConf == 1) || (wfOver == 1) || (hasContract && hasInvoice);

                json summary = {
                    {"has_contract", hasContract},
                    {"has_invoice", hasInvoice},
                    {"has_handover", hasHandover},
                    {"has_release", hasRelease},
                    {"release_zip_path", releaseZipPath},
                    {"release_exe_path", releaseExePath},
                    {"total_documents", docs.size()},
                    {"workflow_stage", wfStage},
                    {"subscription_status", subSt},
                    {"payment_confirmed", payConf == 1},
                    {"workflow_override", wfOver == 1},
                    {"trial_started_at", tenant.value("trial_started_at", "")},
                    {"handover_at", tenant.value("handover_at", "")},
                    {"warranty_until", tenant.value("warranty_until", "")},
                    {"can_generate_release", canGen},
                    {"release_mode", isTrial ? "trial" : "official"}
                };

                sendJson(res, {
                    {"success", true},
                    {"tenant", tenant},
                    {"documents", docs},
                    {"summary", summary}
                });
                return;
            }

            if (action == "catalog") {
                const auto& catalog = LicenseService::instance().getCatalog();
                json arr = json::array();
                for (const auto& mod : catalog) {
                    arr.push_back({
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
                        {"requires", mod.requires}
                    });
                }
                sendJson(res, {{"success", true}, {"data", arr}});
                return;
            }

            if (action == "license_overview") {
                auto row = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = 'saas_grace_period_days' LIMIT 1");
                int grace = 7;
                if (!row.is_null()) {
                    try { grace = std::stoi(row.value("setting_value", "7")); } catch (...) {}
                }
                sendJson(res, {
                    {"success", true},
                    {"data", {
                        {"has_keys", true},
                        {"has_legacy_keys", true},
                        {"sodium", true},
                        {"fingerprint", SaleApp::LicenseCrypto::getPublicKeyFingerprint()},
                        {"algorithm", "ECDSA P-256 CNG Node-Locking"},
                        {"grace_days", grace}
                    }}
                });
                return;
            }

            if (action == "get_tenant_license") {
                int64_t tid = 0;
                if (req.has_param("tenant_id")) {
                    try { tid = std::stoll(req.get_param_value("tenant_id")); } catch (...) {}
                } else if (req.has_param("id")) {
                    try { tid = std::stoll(req.get_param_value("id")); } catch (...) {}
                }
                auto row = db.queryRow("SELECT * FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
                if (row.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy thông tin giấy phép của cửa hàng!"}}, 404);
                    return;
                }
                sendJson(res, {
                    {"success", true},
                    {"data", {
                        {"store_name", getString(row, "store_name")},
                        {"license_key", getString(row, "license_key")},
                        {"machine_id", getString(row, "machine_id")},
                        {"machine_name", getString(row, "machine_name")},
                        {"machine_bound_at", getString(row, "machine_bound_at")},
                        {"last_check_at", getString(row, "last_check_at")},
                        {"last_check_ip", getString(row, "last_check_ip")},
                        {"last_app_version", getString(row, "last_app_version", "2.1.8")}
                    }}
                });
                return;
            }

            if (action == "get_audit_logs") {
                std::string roleFilter = req.has_param("role") ? req.get_param_value("role") : "";
                std::string tenantFilter = req.has_param("tenant_code") ? req.get_param_value("tenant_code") : "";
                std::string actionFilter = req.has_param("action_type") ? req.get_param_value("action_type") : "";

                std::string sql = "SELECT * FROM saas_audit_logs WHERE 1=1";
                std::vector<std::pair<std::string, json>> params;
                if (!roleFilter.empty() && roleFilter != "all") {
                    sql += " AND role = :ro";
                    params.push_back({":ro", roleFilter});
                }
                if (!tenantFilter.empty() && tenantFilter != "all") {
                    sql += " AND target_tenant = :tt";
                    params.push_back({":tt", tenantFilter});
                }
                if (!actionFilter.empty() && actionFilter != "all") {
                    sql += " AND action = :ac";
                    params.push_back({":ac", actionFilter});
                }
                sql += " ORDER BY id DESC LIMIT 100";
                auto rows = db.query(sql, params);
                sendJson(res, {{"success", true}, {"data", rows}, {"logs", rows}});
                return;
            }

            if (action == "get_staff_users") {
                auto rows = db.query("SELECT id, username, fullname, email, phone, role, department, permissions, status, last_login_at, created_at FROM saas_staff_users ORDER BY id ASC");
                sendJson(res, {{"success", true}, {"data", rows}});
                return;
            }

            if (action == "check" || action == "check_auth" || action == "status") {
                json su = getSaSessionUser(req);
                if (!su.is_null() && su.is_object()) {
                    sendJson(res, {
                        {"success", true},
                        {"authenticated", true},
                        {"user", su},
                        {"role", su.value("role", "super_admin")},
                        {"username", su.value("username", "superadmin")}
                    });
                } else {
                    sendJson(res, {
                        {"success", true},
                        {"authenticated", false}
                    });
                }
                return;
            }

            if (action == "logout") {
                std::string tok = extractSaToken(req);
                if (!tok.empty()) {
                    std::lock_guard<std::mutex> lk(g_saSessionMtx);
                    g_saSessions.erase(tok);
                }
                res.set_header("Set-Cookie", "sa_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
                sendJson(res, {{"success", true}, {"message", "Đã đăng xuất Super Admin!"}});
                return;
            }

            if (action == "get_legal_templates") {
                fs::path tplDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "templates";
                struct TplMeta { const char* file; const char* title; const char* desc; };
                const TplMeta specs[] = {
                    {"bao_gia_dich_vu.html", "Báo Giá Dịch Vụ", "Bảng báo giá phần mềm & chi phí triển khai gửi khách trước khi ký hợp đồng."},
                    {"hop_dong_dich_vu.html", "Hợp Đồng Dịch Vụ", "Hợp đồng cung cấp & cấp quyền sử dụng phần mềm CyberNexus POS."},
                    {"dieu_khoan_su_dung_ban_quyen.html", "Điều Khoản Bản Quyền", "Quy định sở hữu trí tuệ, khóa Machine ID & trách nhiệm pháp lý chống crack."},
                    {"bien_ban_ban_giao_nghiem_thu.html", "Biên Bản Nghiệm Thu", "Checklist bàn giao, kiểm thử vận hành & xác nhận nghiệm thu tại quán."},
                    {"phieu_bao_hanh_ky_thuat.html", "Phiếu Bảo Hành", "Cam kết hỗ trợ kỹ thuật, cập nhật OTA & điều kiện bảo hành."}
                };
                json arr = json::array();
                for (const auto& sp : specs) {
                    fs::path fp = tplDir / sp.file;
                    std::string content;
                    if (fs::exists(fp)) {
                        std::ifstream ifs(fp, std::ios::binary);
                        if (ifs) {
                            std::ostringstream ss;
                            ss << ifs.rdbuf();
                            content = ss.str();
                        }
                    }
                    arr.push_back({{"file", sp.file}, {"title", sp.title}, {"desc", sp.desc}, {"content", content}});
                }
                json modNames = json::object();
                for (const auto& m : LicenseService::instance().getCatalog()) {
                    modNames[m.code] = m.name;
                }
                sendJson(res, {{"success", true}, {"templates", arr}, {"module_names", modNames}});
                return;
            }
        }

        if (req.method == "POST") {
            if (action != "login" && action != "logout") {
                json su = getSaSessionUser(req);
                if (su.is_null() || !su.is_object()) {
                    sendJson(res, {{"success", false}, {"message", "Phiên đăng nhập SuperAdmin đã hết hạn hoặc không hợp lệ!"}}, 401);
                    return;
                }
                {
                    std::string sRole = su.value("role", "super_admin");
                    if (sRole == "auditor") {
                        sendJson(res, {{"success", false}, {"message", "Ban Kiểm Toán chỉ có quyền xem (Read-only), không được phép thay đổi dữ liệu!"}}, 403);
                        return;
                    }
                    if (sRole != "super_admin") {
                        if (action == "save_staff_user" || action == "delete_staff_user" ||
                            action == "grant_workflow_override" || action == "save_settings" ||
                            action == "save_ai_vault" || action == "save_legal_template") {
                            sendJson(res, {{"success", false}, {"message", "Chỉ Ban Giám Đốc (SuperAdmin) mới có quyền thực hiện thao tác này!"}}, 403);
                            return;
                        }
                        if (action == "confirm_payment" && sRole != "finance") {
                            sendJson(res, {{"success", false}, {"message", "Chỉ Phòng Kế Toán hoặc SuperAdmin mới có quyền xác nhận thanh toán!"}}, 403);
                            return;
                        }
                        if (action == "activate_trial_7d" && sRole != "sales") {
                            sendJson(res, {{"success", false}, {"message", "Chỉ Phòng Kinh Doanh (Sales) hoặc SuperAdmin mới có quyền cấp Trial 07 ngày!"}}, 403);
                            return;
                        }
                        if ((action == "generate_tenant_release" || action == "reset_hardware_lock") && sRole != "technical") {
                            sendJson(res, {{"success", false}, {"message", "Chỉ Phòng Kỹ Thuật hoặc SuperAdmin mới có quyền đóng gói bộ cài / mở khóa phần cứng!"}}, 403);
                            return;
                        }
                    }
                }
            }
            if (action == "login") {
                std::string user = getString(body, "username");
                if (user.empty()) user = getString(body, "user");
                std::string pass = getString(body, "password");
                if (user.empty() || pass.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng nhập tên đăng nhập và mật khẩu!"}}, 400);
                    return;
                }

                std::string clientIp = req.get_header_value("X-Forwarded-For");
                if (clientIp.empty()) clientIp = req.remote_addr;
                if (clientIp.empty()) clientIp = "127.0.0.1";
                std::string lowerU = user;
                std::transform(lowerU.begin(), lowerU.end(), lowerU.begin(), ::tolower);
                std::string rlKey = clientIp + ":" + lowerU;
                int retryAfter = 0;
                if (SaleApp::Security::RateLimiter::instance().isLocked("master_auth", rlKey, retryAfter)) {
                    sendJson(res, {
                        {"success", false},
                        {"code", "AUTH_RATE_LIMITED"},
                        {"retry_after", retryAfter},
                        {"message", "Tài khoản tạm khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau " + std::to_string(retryAfter) + " giây."}
                    }, 429);
                    return;
                }

                // 1. Kiểm tra tài khoản nhân viên / bộ phận trong bảng saas_staff_users
                auto staffRow = db.queryRow("SELECT * FROM saas_staff_users WHERE LOWER(username) = LOWER(:u) AND status = 'active' LIMIT 1", {{":u", user}});
                if (!staffRow.is_null()) {
                    std::string storedPass = getString(staffRow, "password_hash");
                    bool valid = false;
                    if (!storedPass.empty()) {
                        valid = (pass == storedPass) || (pos_bcrypt_checkpw(pass.c_str(), storedPass.c_str()) == 0);
                    }

                    if (valid) {
                        SaleApp::Security::RateLimiter::instance().clearFailures("master_auth", rlKey);
                        int64_t sId = getInt(staffRow, "id", 0);
                        std::string sUser = getString(staffRow, "username", user);
                        std::string sRole = normalizeSaRole(getString(staffRow, "role", "staff"));
                        std::string sDept = getString(staffRow, "department", "Bộ Phận");
                        std::string sFull = getString(staffRow, "fullname", sUser);
                        std::string sPerms = getString(staffRow, "permissions", "[]");

                        db.execute("UPDATE saas_staff_users SET last_login_at = datetime('now') WHERE id = :id", {{":id", sId}});
                        recordAuditLog(db, sId, sUser, sRole, "AUTH_LOGIN", "SYSTEM", "Đăng nhập thành công vào Trung Tâm Chỉ Huy SuperAdmin (" + sDept + ")", "{}", req.remote_addr);

                        std::string token = "sa_master_session_" + std::to_string(std::chrono::system_clock::now().time_since_epoch().count());
                        res.set_header("Set-Cookie", "sa_token=" + token + "; Path=/; HttpOnly");

                        json permsJson = json::array();
                        try { permsJson = json::parse(sPerms); } catch (...) {}
                        json userObj = {
                            {"id", sId},
                            {"username", sUser},
                            {"fullname", sFull},
                            {"role", sRole},
                            {"department", sDept},
                            {"permissions", permsJson}
                        };
                        {
                            std::lock_guard<std::mutex> lk(g_saSessionMtx);
                            g_saSessions[token] = userObj;
                        }

                        sendJson(res, {
                            {"success", true},
                            {"message", "Đăng nhập thành công với vai trò " + sDept + "!"},
                            {"token", token},
                            {"user", userObj},
                            {"redirect", "super_admin.html"}
                        });
                        return;
                    }
                }

                // 2. Fallback kiểm tra bảng saas_settings cho tài khoản mặc định
                std::string storedUser = "superadmin";
                auto userRow = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = 'super_admin_username' LIMIT 1");
                if (!userRow.is_null()) {
                    storedUser = userRow.value("setting_value", "superadmin");
                }

                std::string storedHash = "";
                auto hashRow = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = 'super_admin_password_hash' LIMIT 1");
                if (!hashRow.is_null()) {
                    storedHash = hashRow.value("setting_value", "");
                }

                std::string lowerUser = user;
                std::transform(lowerUser.begin(), lowerUser.end(), lowerUser.begin(), ::tolower);
                std::string lowerStored = storedUser;
                std::transform(lowerStored.begin(), lowerStored.end(), lowerStored.begin(), ::tolower);

                bool valid = false;
                if (lowerUser == lowerStored || lowerUser == "superadmin") {
                    if (!storedHash.empty()) {
                        valid = (pos_bcrypt_checkpw(pass.c_str(), storedHash.c_str()) == 0);
                    } else if (pass == "superadmin") {
                        valid = true;
                    }
                }

                if (valid) {
                    SaleApp::Security::RateLimiter::instance().clearFailures("master_auth", rlKey);
                    recordAuditLog(db, 1, user, "super_admin", "AUTH_LOGIN", "SYSTEM", "Đăng nhập thành công SuperAdmin Quản Trị Tối Cao", "{}", req.remote_addr);
                    std::string token = "sa_master_session_" + std::to_string(std::chrono::system_clock::now().time_since_epoch().count());
                    res.set_header("Set-Cookie", "sa_token=" + token + "; Path=/; HttpOnly");
                    json userObj = {
                        {"id", 1},
                        {"username", user},
                        {"fullname", "Tổng Quản Trị Viên (Super Admin)"},
                        {"role", "super_admin"},
                        {"department", "Ban Giám Đốc"},
                        {"permissions", json::array({"all"})}
                    };
                    {
                        std::lock_guard<std::mutex> lk(g_saSessionMtx);
                        g_saSessions[token] = userObj;
                    }
                    sendJson(res, {
                        {"success", true},
                        {"message", "Đăng nhập Super Admin thành công!"},
                        {"token", token},
                        {"user", userObj},
                        {"redirect", "super_admin.html"}
                    });
                } else {
                    SaleApp::Security::RateLimiter::instance().recordFailure("master_auth", rlKey, 5, 300, 300);
                    recordAuditLog(db, 0, user, "unknown", "AUTH_FAILED", "SYSTEM", "Đăng nhập thất bại: sai tài khoản hoặc mật khẩu", "{}", req.remote_addr);
                    sendJson(res, {{"success", false}, {"message", "Tên tài khoản hoặc mật khẩu không chính xác!"}}, 401);
                }
                return;
            }

            if (action == "logout") {
                res.set_header("Set-Cookie", "sa_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
                sendJson(res, {{"success", true}, {"message", "Đã đăng xuất Super Admin!"}});
                return;
            }

            if (action == "toggle_module") {
                int64_t tid = getInt(body, "tenant_id");
                if (tid <= 0) tid = 1;
                std::string modCode = getString(body, "module_code");
                std::string state = getString(body, "state", "");
                bool blocked = false;
                if (body.contains("blocked")) {
                    if (body["blocked"].is_boolean()) blocked = body["blocked"].get<bool>();
                    else if (body["blocked"].is_number()) blocked = (body["blocked"].get<int>() != 0);
                    else if (body["blocked"].is_string()) blocked = (body["blocked"].get<std::string>() == "1" || body["blocked"].get<std::string>() == "true");
                }
                if (state == "BLOCKED") blocked = true;

                bool enabled = false;
                if (body.contains("enabled")) {
                    if (body["enabled"].is_boolean()) enabled = body["enabled"].get<bool>();
                    else if (body["enabled"].is_number()) enabled = (body["enabled"].get<int>() != 0);
                    else if (body["enabled"].is_string()) enabled = (body["enabled"].get<std::string>() == "1" || body["enabled"].get<std::string>() == "true");
                }
                if (state == "ON") { enabled = true; blocked = false; }
                else if (state == "OFF") { enabled = false; blocked = false; }
                else if (blocked) { enabled = false; }

                // Lấy danh sách blocked_modules và card_fee_percent hiện tại
                auto tRow = db.queryRow("SELECT blocked_modules, card_fee_percent FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
                std::vector<std::string> blockedList;
                double cardFeePct = 0.0;
                if (!tRow.is_null()) {
                    try {
                        json bmArr = json::parse(getString(tRow, "blocked_modules", "[]"), nullptr, false);
                        if (bmArr.is_array()) {
                            for (const auto& item : bmArr) {
                                if (item.is_string()) blockedList.push_back(item.get<std::string>());
                            }
                        }
                    } catch (...) {}
                    try {
                        if (tRow.contains("card_fee_percent") && !tRow["card_fee_percent"].is_null()) {
                            if (tRow["card_fee_percent"].is_number()) cardFeePct = tRow["card_fee_percent"].get<double>();
                            else if (tRow["card_fee_percent"].is_string()) cardFeePct = std::stod(tRow["card_fee_percent"].get<std::string>());
                        }
                    } catch (...) {}
                }

                if (body.contains("card_fee_percent") && !body["card_fee_percent"].is_null()) {
                    try {
                        if (body["card_fee_percent"].is_number()) cardFeePct = body["card_fee_percent"].get<double>();
                        else if (body["card_fee_percent"].is_string()) cardFeePct = std::stod(body["card_fee_percent"].get<std::string>());
                        if (cardFeePct < 0.0) cardFeePct = 0.0;
                        if (cardFeePct > 20.0) cardFeePct = 20.0;
                    } catch (...) {}
                }

                json result = LicenseService::instance().toggleModule(tid, modCode, enabled);
                if (result.value("success", false)) {
                    if (blocked) {
                        if (std::find(blockedList.begin(), blockedList.end(), modCode) == blockedList.end()) {
                            blockedList.push_back(modCode);
                        }
                    } else {
                        blockedList.erase(std::remove(blockedList.begin(), blockedList.end(), modCode), blockedList.end());
                    }
                    json bmJson = blockedList;
                    std::string bmStr = bmJson.dump();
                    db.execute("UPDATE saas_tenants SET blocked_modules = :bm, card_fee_percent = :cfp, updated_at = datetime('now') WHERE id = :id",
                               {{":bm", bmStr}, {":cfp", cardFeePct}, {":id", tid}});

                    std::string emStr = result.contains("enabled_modules") ? result["enabled_modules"].dump() : "[]";
                    if (tid == 1) {
                        syncLocalSlaveLicenseCache(emStr, bmStr, cardFeePct);
                    }

                    std::string finalState = blocked ? "BLOCKED" : (enabled ? "ON" : "OFF");
                    result["blocked"] = blocked;
                    result["state"] = finalState;
                    result["blocked_modules"] = blockedList;
                    result["card_fee_percent"] = cardFeePct;
                    result["message"] = blocked
                        ? ("Đã KHÓA CƯỠNG CHẾ (BLOCK) module " + modCode + " từ Master!")
                        : (enabled ? ("Đã BẬT (ON) module " + modCode + " thành công!") : ("Đã TẮT (OFF) module " + modCode + " thành công!"));

                    recordAuditLog(db, 0, "SuperAdmin", "super_admin", "TOGGLE_MODULE", std::to_string(tid),
                        std::string(blocked ? "BLOCK khóa module: " : (enabled ? "Cấp phép (ON) module: " : "Thu hồi (OFF) module: ")) + modCode + " cho cửa hàng ID " + std::to_string(tid),
                        result.dump(), req.remote_addr);
                    StoreTunnelManager::instance().enqueueCommand(tid, "SYNC_LICENSE", json::object(), true);
                }
                sendJson(res, result, result.value("success", false) ? 200 : 400);
                return;
            }

            if (action == "save_card_fee") {
                int64_t tid = getInt(body, "tenant_id", 1);
                double cardFeePct = 0.0;
                if (body.contains("card_fee_percent") && !body["card_fee_percent"].is_null()) {
                    try {
                        if (body["card_fee_percent"].is_number()) cardFeePct = body["card_fee_percent"].get<double>();
                        else if (body["card_fee_percent"].is_string()) cardFeePct = std::stod(body["card_fee_percent"].get<std::string>());
                    } catch (...) {}
                }
                if (cardFeePct < 0.0) cardFeePct = 0.0;
                if (cardFeePct > 20.0) cardFeePct = 20.0;

                db.execute("UPDATE saas_tenants SET card_fee_percent = :cfp, updated_at = datetime('now') WHERE id = :id",
                           {{":cfp", cardFeePct}, {":id", tid}});

                auto tRow = db.queryRow("SELECT enabled_modules, blocked_modules FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
                if (!tRow.is_null() && tid == 1) {
                    syncLocalSlaveLicenseCache(getString(tRow, "enabled_modules", "[]"), getString(tRow, "blocked_modules", "[]"), cardFeePct);
                }

                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "SAVE_CARD_FEE", std::to_string(tid),
                    "Cập nhật phí nền tảng Master trên mỗi giao dịch cà thẻ: " + std::to_string(cardFeePct) + "% cho cửa hàng ID " + std::to_string(tid),
                    body.dump(), req.remote_addr);

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã lưu cấu hình phí giao dịch thẻ Master (" + std::to_string(cardFeePct) + "%) và đồng bộ xuống máy trạm!"},
                    {"card_fee_percent", cardFeePct}
                });
                return;
            }

                if (action == "reset_hardware_lock") {
                std::string tcode = getVal("tenant_code", "");
                int64_t tid = getValInt("tenant_id", 0);
                try { if (db.queryRow("SELECT 1 FROM pragma_table_info('saas_tenants') WHERE name='machine_reset_pending' LIMIT 1").is_null()) db.execute("ALTER TABLE saas_tenants ADD COLUMN machine_reset_pending INTEGER DEFAULT 0"); } catch (...) {}
                db.execute(R"(
                    UPDATE saas_tenants 
                    SET machine_id = NULL, machine_name = 'Chưa gán máy', machine_bound_at = NULL, last_check_ip = NULL, machine_reset_pending = 1 
                    WHERE tenant_code = :tc OR id = :id
                )", {{":tc", tcode}, {":id", tid}});
                recordAuditLog(db, 0, "Kỹ Thuật", "technical", "RESET_HARDWARE_LOCK", tcode, "Mở khóa ràng buộc phần cứng (Hardware Node-Lock) cho quán " + tcode, "{}", req.remote_addr);
                sendJson(res, {{"success", true}, {"message", "Đã mở khóa phần cứng thành công! Quán có thể kích hoạt máy trạm mới."}});
                return;
            }

            if (action == "reset_store_owner_pin") {
                int64_t tid = getValInt("tenant_id", 0);
                std::string tcode = getVal("tenant_code", "");
                auto tRow = db.queryRow("SELECT id, tenant_code, store_name, license_key, default_pin_sha256, default_pin_enc FROM saas_tenants WHERE id = :id OR tenant_code = :tc LIMIT 1",
                                        {{":id", tid}, {":tc", tcode}});
                if (tRow.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy hồ sơ quán!"}}, 404);
                    return;
                }
                int64_t realTid = getInt(tRow, "id", 0);
                std::string realTc = getString(tRow, "tenant_code", tcode);
                std::string sName = getString(tRow, "store_name", realTc);
                std::string lk = getString(tRow, "license_key", "");
                std::string pin6 = CyberNexus::PinVault::decryptPinForLicense(getString(tRow, "default_pin_enc", ""), lk);
                if (!CyberNexus::PinVault::isValidPin6(pin6)) {
                    pin6 = CyberNexus::PinVault::generateRandomPin6();
                    db.execute("UPDATE saas_tenants SET default_pin_sha256 = :psha, default_pin_enc = :penc WHERE id = :id",
                               {{":psha", AuthService::sha256(pin6)}, {":penc", CyberNexus::PinVault::encryptPinForLicense(pin6, lk)}, {":id", realTid}});
                }
                db.execute("UPDATE saas_tenants SET pin_reset_pending = 1 WHERE id = :id", {{":id", realTid}});
                bool isOnline = StoreTunnelManager::instance().enqueueCommand(realTid, "RESET_OWNER_PIN", {
                    {"pin6", pin6},
                    {"pin_sha256", AuthService::sha256(pin6)},
                    {"store_name", sName},
                    {"store_code", realTc}
                }, true);
                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "RESET_OWNER_PIN", realTc,
                               "Reset PIN 6 số chủ quán về mặc định và gửi file PIN xuống máy quán " + sName, "{}", req.remote_addr);
                sendJson(res, {
                    {"success", true},
                    {"online_delivered", isOnline},
                    {"message", isOnline
                        ? ("Đã reset PIN mặc định 6 số & gửi file về Control Center của quán " + sName + " ngay lập tức!")
                        : ("Đã xếp hàng lệnh Reset PIN mặc định cho quán " + sName + " (sẽ tự nhận ngay khi quán kết nối Master).")}
                });
                return;
            }

            if (action == "save_staff_user") {
                int64_t id = getValInt("id", 0);
                std::string sUser = getVal("username", "");
                std::string sPass = getVal("password", "");
                std::string sFull = getVal("fullname", "");
                std::string sEmail = getVal("email", "");
                std::string sPhone = getVal("phone", "");
                std::string sRole = getVal("role", "technical");
                std::string sDept = getVal("department", "Phòng Kỹ Thuật");
                std::string sPerms = getVal("permissions", "[]");
                std::string sStatus = getVal("status", "active");

                if (sUser.empty() || sFull.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Tên đăng nhập và họ tên không được để trống!"}}, 400);
                    return;
                }

                if (id <= 0) {
                    if (sPass.empty()) sPass = "admin123";
                    db.execute(R"(
                        INSERT INTO saas_staff_users (username, password_hash, fullname, email, phone, role, department, permissions, status)
                        VALUES (:un, :pw, :fn, :em, :ph, :ro, :dp, :pm, :st)
                    )", {
                        {":un", sUser}, {":pw", sPass}, {":fn", sFull},
                        {":em", sEmail}, {":ph", sPhone}, {":ro", sRole},
                        {":dp", sDept}, {":pm", sPerms}, {":st", sStatus}
                    });
                    recordAuditLog(db, 0, "SuperAdmin", "super_admin", "CREATE_STAFF", "SYSTEM", "Thêm nhân viên bộ phận mới: " + sUser + " (" + sDept + ")", "{}", req.remote_addr);
                } else {
                    if (!sPass.empty()) {
                        db.execute(R"(
                            UPDATE saas_staff_users 
                            SET username = :un, password_hash = :pw, fullname = :fn, email = :em, phone = :ph, role = :ro, department = :dp, permissions = :pm, status = :st, updated_at = datetime('now')
                            WHERE id = :id
                        )", {
                            {":un", sUser}, {":pw", sPass}, {":fn", sFull},
                            {":em", sEmail}, {":ph", sPhone}, {":ro", sRole},
                            {":dp", sDept}, {":pm", sPerms}, {":st", sStatus}, {":id", id}
                        });
                    } else {
                        db.execute(R"(
                            UPDATE saas_staff_users 
                            SET username = :un, fullname = :fn, email = :em, phone = :ph, role = :ro, department = :dp, permissions = :pm, status = :st, updated_at = datetime('now')
                            WHERE id = :id
                        )", {
                            {":un", sUser}, {":fn", sFull},
                            {":em", sEmail}, {":ph", sPhone}, {":ro", sRole},
                            {":dp", sDept}, {":pm", sPerms}, {":st", sStatus}, {":id", id}
                        });
                    }
                    recordAuditLog(db, 0, "SuperAdmin", "super_admin", "UPDATE_STAFF", "SYSTEM", "Cập nhật hồ sơ phân quyền nhân viên: " + sUser, "{}", req.remote_addr);
                }
                sendJson(res, {{"success", true}, {"message", "Đã lưu thông tin nhân viên & phân quyền thành công!"}});
                return;
            }

            if (action == "delete_staff_user") {
                int64_t id = getValInt("id", 0);
                if (id <= 1) {
                    sendJson(res, {{"success", false}, {"message", "Không thể xóa tài khoản Quản trị viên tối cao (SuperAdmin)!"}}, 400);
                    return;
                }
                db.execute("DELETE FROM saas_staff_users WHERE id = :id", {{":id", id}});
                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "DELETE_STAFF", "SYSTEM", "Xóa tài khoản nhân viên ID: " + std::to_string(id), "{}", req.remote_addr);
                sendJson(res, {{"success", true}, {"message", "Đã xóa tài khoản nhân viên khỏi hệ thống!"}});
                return;
            }

            if (action == "set_all_modules") {
                int64_t tid = getInt(body, "tenant_id");
                std::string mode = getString(body, "mode", "all");
                json result = LicenseService::instance().setAllModules(tid, mode);
                if (result.value("success", false)) {
                    StoreTunnelManager::instance().enqueueCommand(tid, "SYNC_LICENSE", json::object(), true);
                }
                sendJson(res, result, result.value("success", false) ? 200 : 400);
                return;
            }

            if (action == "save_tenant") {
                int64_t id = getValInt("id", 0);
                std::string tenant_code = getVal("tenant_code");
                std::string store_name = getVal("store_name");
                std::string owner_name = getVal("owner_name");
                std::string representative_role = getVal("representative_role");
                std::string legal_entity_name = getVal("legal_entity_name");
                std::string tax_id_or_cccd = getVal("tax_id_or_cccd");
                std::string phone = getVal("phone");
                std::string email = getVal("email");
                std::string address = getVal("address");
                std::string billing_address = getVal("billing_address");
                int64_t plan_id = getValInt("plan_id", 1);
                std::string expire_date = getVal("expire_date");
                std::string note = getVal("note");
                std::string start_mode = getVal("start_mode", "standard");

                if (store_name.empty() || owner_name.empty() || representative_role.empty() ||
                    legal_entity_name.empty() || tax_id_or_cccd.empty() || phone.empty() ||
                    email.empty() || address.empty() || billing_address.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng nhập đầy đủ thông tin bắt buộc để lập Hợp đồng (Tên quán, Người đại diện, Chức vụ, Pháp nhân/HKD, MST/CCCD, SĐT, Email, Địa chỉ quán & Địa chỉ xuất HĐ)!"}}, 400);
                    return;
                }

                auto planRow = db.queryRow("SELECT name, default_modules FROM saas_plans WHERE id = :pid LIMIT 1", {{":pid", plan_id}});
                std::string plan_name = planRow.is_null() ? "Gói Tiêu Chuẩn" : planRow.value("name", "Gói Tiêu Chuẩn");
                std::string default_mods = planRow.is_null() ? "[\"pos_core\",\"vietqr_payment\"]" : planRow.value("default_modules", "[]");

                if (expire_date.empty()) {
                    auto expR = db.queryRow("SELECT date('now', '+1 year') as d");
                    if (!expR.is_null()) expire_date = expR.value("d", "2027-12-31");
                }

                // Handle logo upload if present (save to ConfigManager uploads dir)
                std::string savedLogoPath = "";
                if (req.has_file("store_logo")) {
                    const auto& file = req.get_file_value("store_logo");
                    if (!file.content.empty()) {
                        auto vLogo = SaleApp::Security::UploadGuard::validate(file.content, file.filename, SaleApp::Security::UploadKind::Image);
                        if (!vLogo.ok) {
                            sendJson(res, {{"success", false}, {"message", vLogo.error}}, 400);
                            return;
                        }
                        std::string saveName = SaleApp::Security::UploadGuard::makeRandomUuidName("logo", vLogo.ext);
                        fs::path targetDir = SaleApp::Config::AppConfig::instance().getUploadsDir() / "tenant-logos";
                        fs::path targetPath;
                        std::string wErr;
                        if (!SaleApp::Security::UploadGuard::writeSafeFile(targetDir, saveName, file.content, targetPath, wErr)) {
                            sendJson(res, {{"success", false}, {"message", wErr}}, 400);
                            return;
                        }
                        savedLogoPath = "uploads/tenant-logos/" + saveName;
                    }
                }

                bool removeLogo = (getVal("remove_logo") == "1");

                if (id <= 0) {
                    if (tenant_code.empty()) {
                        tenant_code = "TN" + std::to_string(std::chrono::system_clock::now().time_since_epoch().count()).substr(8, 6);
                    }
                    static constexpr char kHexChars[] = "0123456789ABCDEF";
                    std::string newKey = generateRandomLicenseKey("LIC", kHexChars, sizeof(kHexChars) - 1);
                    std::string pin6 = CyberNexus::PinVault::generateRandomPin6();
                    std::string pinSha = AuthService::sha256(pin6);
                    std::string pinEnc = CyberNexus::PinVault::encryptPinForLicense(pin6, newKey);

                    std::string initSubStatus = (start_mode == "trial") ? "trial" : "active";
                    std::string initWfStage = (start_mode == "trial") ? "trial" : "pending_contract";
                    std::string initTrialAt = "";
                    if (start_mode == "trial") {
                        auto trExp = db.queryRow("SELECT date('now', '+7 days') as d, datetime('now') as ts");
                        if (!trExp.is_null()) {
                            expire_date = trExp.value("d", expire_date);
                            initTrialAt = trExp.value("ts", "");
                        }
                    }
                    int64_t newId = db.execute(
                        "INSERT INTO saas_tenants (tenant_code, store_name, owner_name, representative_role, legal_entity_name, tax_id_or_cccd, phone, email, address, billing_address, "
                        "plan_id, plan_name, billing_cycle, subscription_status, workflow_stage, trial_started_at, start_date, expire_date, "
                        "enabled_modules, license_key, note, logo_path, default_pin_sha256, default_pin_enc) "
                        "VALUES (:tc, :sn, :on, :rep, :leg, :tax, :ph, :em, :ad, :bad, :pid, :pn, 'yearly', :sub, :wfs, :tsa, date('now'), :ed, :emods, :lk, :note, :logo, :psha, :penc)",
                        {
                            {":tc", tenant_code}, {":sn", store_name}, {":on", owner_name},
                            {":rep", representative_role}, {":leg", legal_entity_name}, {":tax", tax_id_or_cccd},
                            {":ph", phone}, {":em", email}, {":ad", address}, {":bad", billing_address},
                            {":pid", plan_id}, {":pn", plan_name},
                            {":sub", initSubStatus}, {":wfs", initWfStage}, {":tsa", initTrialAt},
                            {":ed", expire_date}, {":emods", default_mods}, {":lk", newKey}, {":note", note},
                            {":logo", savedLogoPath}, {":psha", pinSha}, {":penc", pinEnc}
                        }
                    );
                    if (newId < 0) {
                        sendJson(res, {
                            {"success", false},
                            {"message", "Không thể thêm cửa hàng mới (Mã Quán hoặc License Key bị trùng)!"}
                        }, 400);
                        return;
                    }
                    generateTenantLegalForms(db, SaleApp::Config::AppConfig::instance().getBaseDir(), newId);
                    sendJson(res, {
                        {"success", true},
                        {"message", "Thêm mới cửa hàng & khởi tạo bộ hồ sơ mẫu thành công!"},
                        {"id", newId},
                        {"tenant_saved", true}
                    });
                } else {
                    std::string sqlUpdate = "UPDATE saas_tenants SET store_name = :sn, owner_name = :on, representative_role = :rep, legal_entity_name = :leg, tax_id_or_cccd = :tax, phone = :ph, email = :em, address = :ad, billing_address = :bad, plan_id = :pid, plan_name = :pn, expire_date = :ed, note = :note, updated_at = datetime('now')";
                    std::vector<std::pair<std::string, json>> uParams = {
                        {":sn", store_name}, {":on", owner_name},
                        {":rep", representative_role}, {":leg", legal_entity_name}, {":tax", tax_id_or_cccd},
                        {":ph", phone}, {":em", email}, {":ad", address}, {":bad", billing_address},
                        {":pid", plan_id}, {":pn", plan_name},
                        {":ed", expire_date}, {":note", note}, {":id", id}
                    };
                    if (!tenant_code.empty()) {
                        sqlUpdate += ", tenant_code = :tc";
                        uParams.push_back({":tc", tenant_code});
                    }
                    if (!savedLogoPath.empty()) {
                        sqlUpdate += ", logo_path = :logo";
                        uParams.push_back({":logo", savedLogoPath});
                    } else if (removeLogo) {
                        sqlUpdate += ", logo_path = nullptr";
                    }
                    sqlUpdate += " WHERE id = :id";
                    db.execute(sqlUpdate, uParams);
                    generateTenantLegalForms(db, SaleApp::Config::AppConfig::instance().getBaseDir(), id);

                    sendJson(res, {
                        {"success", true},
                        {"message", "Cập nhật thông tin cửa hàng & đồng bộ bộ hồ sơ mẫu thành công!"},
                        {"id", id},
                        {"tenant_saved", true}
                    });
                }
                return;
            }

            if (action == "toggle_status") {
                int64_t tid = getValInt("tenant_id", 0);
                std::string status = getVal("status", "active");
                if (status != "active" && status != "trial" && status != "grace" && status != "suspended" && status != "locked" && status != "expired") {
                    sendError(res, "Trạng thái thuê bao không hợp lệ: " + status, 400);
                    return;
                }
                db.execute(
                    "UPDATE saas_tenants SET subscription_status = :st, updated_at = datetime('now') WHERE id = :id",
                    {{":st", status}, {":id", std::to_string(tid)}}
                );
                if (tid > 0) {
                    StoreTunnelManager::instance().enqueueCommand(tid, "SYNC_LICENSE", json::object(), true);
                }
                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "TOGGLE_STATUS", std::to_string(tid),
                    "Đổi trạng thái thuê bao quán ID " + std::to_string(tid) + " -> " + status,
                    json({{"tenant_id", tid}, {"status", status}}).dump(), req.remote_addr);
                sendJson(res, {{"success", true}, {"message", "Đã cập nhật trạng thái cửa hàng (" + status + "), ghi Audit và đẩy lệnh đồng bộ tức thì!"}});
                return;
            }

            if (action == "quick_extend") {
                int64_t tid = getValInt("tenant_id", 0);
                int64_t months = getValInt("duration_months", 12);
                if (months <= 0) months = 12;
                double amount = 0.0;
                try {
                    std::string amtStr = getVal("amount", "0");
                    amount = std::stod(amtStr);
                } catch (...) {}
                std::string payment_method = getVal("payment_method", "vietqr");
                std::string note = getVal("note", "Gia hạn SaaS");

                auto tRow = db.queryRow("SELECT store_name, plan_name, expire_date FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
                if (tRow.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy cửa hàng!"}}, 404);
                    return;
                }
                std::string store_name = tRow.value("store_name", "");
                std::string plan_name = tRow.value("plan_name", "");
                std::string oldExpire = tRow.value("expire_date", "");

                auto expRow = db.queryRow(
                    "SELECT CASE WHEN date(:oldExp) > date('now') THEN date(:oldExp, '+' || :m || ' month') ELSE date('now', '+' || :m || ' month') END as new_exp",
                    {{":oldExp", oldExpire}, {":m", std::to_string(months)}}
                );
                std::string newExpire = expRow.is_null() ? "" : expRow.value("new_exp", "");

                db.execute(
                    "UPDATE saas_tenants SET expire_date = :ned, subscription_status = 'active', updated_at = datetime('now') WHERE id = :id",
                    {{":ned", newExpire}, {":id", std::to_string(tid)}}
                );

                std::string invCode = "INV-" + std::to_string(std::chrono::system_clock::now().time_since_epoch().count()).substr(7);
                db.execute(
                    "INSERT INTO saas_invoices (invoice_code, tenant_id, store_name, plan_name, amount, payment_method, duration_months, start_date, expire_date, payment_status, paid_at, note) "
                    "VALUES (:ic, :tid, :sn, :pn, :amt, :pm, :dm, date('now'), :ed, 'paid', datetime('now'), :note)",
                    {
                        {":ic", invCode}, {":tid", std::to_string(tid)}, {":sn", store_name},
                        {":pn", plan_name}, {":amt", std::to_string(amount)}, {":pm", payment_method},
                        {":dm", std::to_string(months)}, {":ed", newExpire}, {":note", note}
                    }
                );
                if (tid > 0) {
                    StoreTunnelManager::instance().enqueueCommand(tid, "SYNC_LICENSE", json::object(), true);
                }
                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "QUICK_EXTEND", std::to_string(tid),
                    "Gia hạn nhanh +" + std::to_string(months) + " tháng cho " + store_name + " đến " + newExpire,
                    json({{"tenant_id", tid}, {"months", months}, {"new_expire", newExpire}, {"invoice_code", invCode}}).dump(), req.remote_addr);
                sendJson(res, {{"success", true}, {"message", "Gia hạn thành công đến ngày " + newExpire + " và đã đẩy đồng bộ tức thì xuống quán!"}});
                return;
            }

            if (action == "sync_master_url") {
                auto normUrl = [](std::string u) {
                    while (!u.empty() && (u.back() == '/' || u.back() == ' ')) u.pop_back();
                    if (!u.empty() && u.rfind("http://", 0) != 0 && u.rfind("https://", 0) != 0) u = "http://" + u;
                    return u;
                };
                std::string pubUrl = normUrl(getString(body, "master_public_url"));
                std::string fbUrl = normUrl(getString(body, "master_fallback_url"));
                if (pubUrl.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng nhập Tên miền / URL Master chính!"}}, 400);
                    return;
                }
                db.execute("INSERT INTO saas_settings (setting_key, setting_value) VALUES ('master_public_url', :v) ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v", {{":v", pubUrl}});
                db.execute("INSERT INTO saas_settings (setting_key, setting_value) VALUES ('master_fallback_url', :v) ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v", {{":v", fbUrl}});

                auto tRows = db.query("SELECT id FROM saas_tenants WHERE subscription_status IN ('active', 'trial')");
                int synced = 0;
                for (const auto& tr : tRows) {
                    int64_t tid = tr.value("id", int64_t(0));
                    if (tid > 0) {
                        StoreTunnelManager::instance().enqueueCommand(tid, "UPDATE_MASTER_URL", {
                            {"master_server_url", pubUrl},
                            {"master_fallback_url", fbUrl}
                        }, true);
                        ++synced;
                    }
                }
                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "SYNC_MASTER_URL", "ALL",
                    "Lưu và đồng bộ URL Master mới (" + pubUrl + ", dự phòng: " + fbUrl + ") xuống " + std::to_string(synced) + " quán", "{}", req.remote_addr);
                sendJson(res, {{"success", true}, {"synced_count", synced}, {"message", "Đã lưu URL Master và đẩy đồng bộ xuống " + std::to_string(synced) + " quán!"}});
                return;
            }

            if (action == "save_saas_settings") {
                for (auto it = body.begin(); it != body.end(); ++it) {
                    std::string k = it.key();
                    if (k == "action") continue;
                    std::string v = it.value().is_string() ? it.value().get<std::string>() : it.value().dump();
                    db.execute(
                        "INSERT INTO saas_settings (setting_key, setting_value) VALUES (:k, :v) "
                        "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                        {{":k", k}, {":v", v}}
                    );
                }
                sendJson(res, {{"success", true}, {"message", "Đã lưu cài đặt SaaS thành công!"}});
                return;
            }

            if (action == "save_package_storage") {
                std::string p = getString(body, "path", "./packages");
                db.execute(
                    "INSERT INTO saas_settings (setting_key, setting_value) VALUES ('package_storage_path', :v) "
                    "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                    {{":v", p}}
                );
                sendJson(res, {{"success", true}, {"message", "Đã lưu đường dẫn lưu trữ gói."}, {"path", p}});
                return;
            }

            if (action == "change_password") {
                std::string newPass = getString(body, "new_password");
                if (newPass.length() < 6) {
                    sendJson(res, {{"success", false}, {"message", "Mật khẩu phải có ít nhất 6 ký tự!"}}, 400);
                    return;
                }
                std::string hashed = AuthService::hashPassword(newPass);
                db.execute(
                    "INSERT INTO saas_settings (setting_key, setting_value) VALUES ('super_admin_password_hash', :v) "
                    "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                    {{":v", hashed}}
                );
                sendJson(res, {{"success", true}, {"message", "Đã đổi mật khẩu Super Admin thành công!"}});
                return;
            }

            if (action == "reset_machine") {
                int64_t tid = getValInt("tenant_id", 0);
                try { if (db.queryRow("SELECT 1 FROM pragma_table_info('saas_tenants') WHERE name='machine_reset_pending' LIMIT 1").is_null()) db.execute("ALTER TABLE saas_tenants ADD COLUMN machine_reset_pending INTEGER DEFAULT 0"); } catch (...) {}
                db.execute("UPDATE saas_tenants SET machine_id = NULL, machine_name = NULL, machine_bound_at = NULL, machine_reset_pending = 1 WHERE id = :id",
                    {{":id", std::to_string(tid)}});
                sendJson(res, {{"success", true}, {"message", "Đã gỡ ràng buộc máy thành công! Quán phải kích hoạt lại trên máy mới."}});
                return;
            }

            if (action == "regenerate_license_key") {
                int64_t tid = getValInt("tenant_id", 0);
                static constexpr char kHexChars[] = "0123456789ABCDEF";
                std::string newKey = generateRandomLicenseKey("LIC", kHexChars, sizeof(kHexChars) - 1);
                db.execute("UPDATE saas_tenants SET license_key = :lk, machine_id = NULL, machine_name = NULL, machine_bound_at = NULL WHERE id = :id",
                    {{":lk", newKey}, {":id", std::to_string(tid)}});
                sendJson(res, {{"success", true}, {"message", "Đã tạo mới License Key và thu hồi key cũ!"}, {"license_key", newKey}});
                return;
            }

            if (action == "license_init_keys") {
                sendJson(res, {{"success", true}, {"message", "Đã kiểm tra khóa ký số ECDSA P-256 Master thành công!"}, {"fingerprint", SaleApp::LicenseCrypto::getPublicKeyFingerprint()}});
                return;
            }

            if (action == "license_save_grace") {
                int64_t grace = std::max<int64_t>(0, std::min<int64_t>(60, getValInt("grace_days", 7)));
                int64_t offMax = std::max<int64_t>(1, std::min<int64_t>(90, getValInt("offline_max_days", 14)));
                db.execute(
                    "INSERT INTO saas_settings (setting_key, setting_value) VALUES ('saas_grace_period_days', :v) "
                    "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                    {{":v", std::to_string(grace)}}
                );
                db.execute(
                    "INSERT INTO saas_settings (setting_key, setting_value) VALUES ('saas_offline_max_days', :v) "
                    "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                    {{":v", std::to_string(offMax)}}
                );
                auto activeRows = db.query("SELECT id FROM saas_tenants WHERE subscription_status IN ('active', 'trial', 'grace')");
                for (const auto& ar : activeRows) {
                    int64_t atid = ar.value("id", int64_t(0));
                    if (atid > 0) StoreTunnelManager::instance().enqueueCommand(atid, "SYNC_LICENSE", json::object(), true);
                }
                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "SAVE_GRACE_POLICY", "GLOBAL",
                    "Cập nhật chính sách ân hạn (" + std::to_string(grace) + " ngày) & Offline Lease (" + std::to_string(offMax) + " ngày)",
                    json({{"grace_days", grace}, {"offline_max_days", offMax}}).dump(), req.remote_addr);
                sendJson(res, {{"success", true}, {"message", "Đã lưu chính sách ân hạn & đồng bộ xuống toàn chuỗi cửa hàng!"}});
                return;
            }

            if (action == "retry_store_package") {
                int64_t tid = getValInt("tenant_id", 0);
                if (tid > 0) {
                    StoreTunnelManager::instance().enqueueCommand(tid, "SYNC_LICENSE", json::object(), true);
                }
                sendJson(res, {{"success", true}, {"message", "Đã đẩy lệnh đồng bộ gói & bản quyền xuống máy quán!"}});
                return;
            }

            // ==========================================
            // SOP-09: QUẢN LÝ HỒ SƠ, HỢP ĐỒNG & RELEASE
            // ==========================================
            if (action == "upload_tenant_document") {
                int64_t tid = getValInt("tenant_id", 0);
                std::string tcode = getVal("tenant_code", "");
                std::string category = getVal("category", "contracts");
                std::string title = getVal("title", "Tài liệu");
                std::string notes = getVal("notes", "");
                std::string status = getVal("status", "valid");

                auto tenant = (tid > 0)
                    ? db.queryRow("SELECT * FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}})
                    : db.queryRow("SELECT * FROM saas_tenants WHERE tenant_code = :tc LIMIT 1", {{":tc", tcode}});

                if (tenant.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy thông tin cửa hàng!"}}, 404);
                    return;
                }

                int64_t realTid = getInt(tenant, "id", 0);
                std::string realTcode = getString(tenant, "tenant_code", "");

                fs::path targetDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "packages" / realTcode / category;
                try { fs::create_directories(targetDir); } catch (...) {}

                std::string originalFilename = "document";
                std::string ext = ".pdf";
                std::string savedRelPath = "";
                int64_t fileSize = 0;

                if (req.has_file("document_file")) {
                    const auto& file = req.get_file_value("document_file");
                    auto vDoc = SaleApp::Security::UploadGuard::validate(file.content, file.filename, SaleApp::Security::UploadKind::Document);
                    if (!vDoc.ok) {
                        sendJson(res, {{"success", false}, {"message", vDoc.error}}, 400);
                        return;
                    }
                    std::string safeBase = fs::path(file.filename).filename().string();
                    if (safeBase.empty()) safeBase = "document" + vDoc.ext;
                    auto appendSignedSuffix = [](const std::string& fname) -> std::string {
                        size_t dp = fname.find_last_of('.');
                        std::string stem = (dp != std::string::npos) ? fname.substr(0, dp) : fname;
                        std::string extension = (dp != std::string::npos) ? fname.substr(dp) : "";
                        std::string lowerStem = stem;
                        std::transform(lowerStem.begin(), lowerStem.end(), lowerStem.begin(), ::tolower);
                        if (lowerStem.size() >= 7 && lowerStem.compare(lowerStem.size() - 7, 7, "_signed") == 0) {
                            return stem + extension;
                        }
                        return stem + "_signed" + extension;
                    };
                    originalFilename = appendSignedSuffix(safeBase);
                    fileSize = file.content.size();
                    ext = vDoc.ext;

                    std::string saveName = SaleApp::Security::UploadGuard::makeRandomUuidName("doc_" + realTcode, vDoc.ext);
                    fs::path targetPath;
                    std::string wErr;
                    if (!SaleApp::Security::UploadGuard::writeSafeFile(targetDir, saveName, file.content, targetPath, wErr)) {
                        sendJson(res, {{"success", false}, {"message", wErr}}, 400);
                        return;
                    }
                    savedRelPath = "packages/" + realTcode + "/" + category + "/" + saveName;
                } else {
                    std::string docContent = getVal("document_content", "");
                    if (!docContent.empty()) {
                        originalFilename = category + "_" + realTcode + "_signed.txt";
                        ext = ".txt";
                        std::string saveName = SaleApp::Security::UploadGuard::makeRandomUuidName("doc_" + realTcode, ".txt");
                        fs::path targetPath;
                        std::string wErr;
                        if (SaleApp::Security::UploadGuard::writeSafeFile(targetDir, saveName, docContent, targetPath, wErr)) {
                            savedRelPath = "packages/" + realTcode + "/" + category + "/" + saveName;
                            fileSize = docContent.size();
                        }
                    }
                }

                if (savedRelPath.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng chọn tệp tin hợp lệ để tải lên!"}}, 400);
                    return;
                }

                std::string cleanExt = ext;
                if (!cleanExt.empty() && cleanExt[0] == '.') cleanExt = cleanExt.substr(1);
                status = "signed";

                db.execute(R"(
                    INSERT INTO saas_tenant_documents 
                    (tenant_id, tenant_code, category, file_name, file_path, file_size, file_ext, title, notes, status, uploaded_by)
                    VALUES (:tid, :tc, :cat, :fn, :fp, :fs, :fe, :ti, :no, :st, 'SuperAdmin')
                )", {
                    {":tid", realTid}, {":tc", realTcode}, {":cat", category},
                    {":fn", originalFilename}, {":fp", savedRelPath}, {":fs", fileSize},
                    {":fe", cleanExt}, {":ti", title}, {":no", notes}, {":st", status}
                });

                if (category == "contracts" || category == "contract") {
                    db.execute("UPDATE saas_tenants SET workflow_stage = CASE WHEN workflow_stage IN ('pending_contract','') THEN 'pending_payment' ELSE workflow_stage END, updated_at = datetime('now') WHERE id = :id", {{":id", realTid}});
                } else if (category == "invoices" || category == "invoice") {
                    db.execute("UPDATE saas_tenants SET payment_confirmed = 1, payment_confirmed_at = COALESCE(NULLIF(payment_confirmed_at,''), datetime('now')), subscription_status = CASE WHEN subscription_status='trial' THEN 'active' ELSE subscription_status END, workflow_stage = CASE WHEN workflow_stage IN ('pending_contract','pending_payment','trial','') THEN 'ready_to_install' ELSE workflow_stage END, updated_at = datetime('now') WHERE id = :id", {{":id", realTid}});
                } else if (category == "handover") {
                    db.execute("UPDATE saas_tenants SET handover_at = datetime('now'), warranty_until = expire_date, subscription_status = CASE WHEN subscription_status='trial' THEN 'active' ELSE subscription_status END, workflow_stage = 'active', updated_at = datetime('now') WHERE id = :id", {{":id", realTid}});
                }

                recordAuditLog(db, 0, "Kế Toán/Kỹ Thuật", "staff", "UPLOAD_DOCUMENT", realTcode,
                    "Tải lên hồ sơ " + originalFilename + " (" + title + ") vào danh mục " + category + " cho quán " + realTcode,
                    "{}", req.remote_addr);

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã lưu tài liệu vào kho hồ sơ của quán thành công!"},
                    {"file_path", savedRelPath}
                });
                return;
            }

            if (action == "generate_tenant_release") {
                int64_t tid = getValInt("tenant_id", 0);
                std::string tcode = getVal("tenant_code", "");

                auto tenant = (tid > 0)
                    ? db.queryRow("SELECT * FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}})
                    : db.queryRow("SELECT * FROM saas_tenants WHERE tenant_code = :tc LIMIT 1", {{":tc", tcode}});

                if (tenant.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy thông tin cửa hàng!"}}, 404);
                    return;
                }

                int64_t realTid = getInt(tenant, "id", 0);
                std::string realTcode = getString(tenant, "tenant_code", "");
                std::string storeName = getString(tenant, "store_name", "");
                std::string planName = getString(tenant, "plan_name", "");
                std::string licenseKey = getString(tenant, "license_key", "");
                std::string expireDate = getString(tenant, "expire_date", "");
                std::string machineId = getString(tenant, "machine_id", "Unbound");
                std::string machineName = getString(tenant, "machine_name", "Chưa gán máy");
                std::string enabledMods = getString(tenant, "enabled_modules", "[]");
                std::string subSt = getString(tenant, "subscription_status", "active");
                std::string wfStage = getString(tenant, "workflow_stage", "pending_contract");
                int payConf = getInt(tenant, "payment_confirmed", 0);
                int wfOver = getInt(tenant, "workflow_override", 0);
                bool isTrial = (subSt == "trial" || wfStage == "trial");

                auto docRows = db.query("SELECT category FROM saas_tenant_documents WHERE tenant_id = :tid OR tenant_code = :tc", {{":tid", realTid}, {":tc", realTcode}});
                bool hasContract = false, hasInvoice = false;
                for (const auto& dr : docRows) {
                    std::string dc = dr.value("category", "");
                    if (dc == "contracts" || dc == "contract") hasContract = true;
                    if (dc == "invoices" || dc == "invoice") hasInvoice = true;
                }
                if (!isTrial && payConf != 1 && wfOver != 1 && !(hasContract && hasInvoice)) {
                    sendJson(res, {
                        {"success", false},
                        {"message", "Chưa đủ điều kiện đóng gói bản chính thức! Cần có Hợp đồng + Xác nhận thanh toán/VAT (hoặc chuyển sang Dùng Thử 07 Ngày / Duyệt Ngoại Lệ)."}
                    }, 400);
                    return;
                }

                fs::path baseDir = SaleApp::Config::AppConfig::instance().getBaseDir();
                fs::path releaseDir = baseDir / "packages" / realTcode / "release";
                try { fs::create_directories(releaseDir); } catch (...) {}

                // 1. Tạo config.json (tự động lấy URL Tên miền Master từ saas_settings)
                std::string pubUrl = "http://127.0.0.1:8500";
                std::string fbUrl = "";
                auto puRow = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = 'master_public_url' LIMIT 1");
                if (!puRow.is_null() && !puRow.value("setting_value", "").empty()) pubUrl = puRow.value("setting_value", "");
                auto fbRow = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = 'master_fallback_url' LIMIT 1");
                if (!fbRow.is_null()) fbUrl = fbRow.value("setting_value", "");
                json cfg = {
                    {"tenant_code", realTcode},
                    {"store_tenant_id", realTcode},
                    {"store_name", storeName},
                    {"license_key", licenseKey},
                    {"master_server_url", pubUrl},
                    {"master_fallback_url", fbUrl},
                    {"port", 8501},
                    {"auto_heartbeat", true}
                };
                {
                    std::ofstream cfgFile((releaseDir / "config.json").string(), std::ios::binary | std::ios::trunc);
                    if (cfgFile) { cfgFile << cfg.dump(2) << "\n"; cfgFile.close(); }
                }

                // 2. Tạo license_certificate.txt
                std::stringstream cert;
                cert << "==============================================================\n"
                     << "  CYBERNEXUS OS — CHỨNG NHẬN BẢN QUYỀN PHẦN MỀM ĐIỂM BÁN\n"
                     << "==============================================================\n"
                     << "Cửa Hàng:           " << storeName << "\n"
                     << "Mã Quán (Tenant):   " << realTcode << "\n"
                     << "Loại Phát Hành:     " << (isTrial ? "TRIAL 07 NGÀY (Dùng thử)" : "CHÍNH THỨC (Official)") << "\n"
                     << "Mã Khóa Bản Quyền:  " << licenseKey << "\n"
                     << "Gói Dịch Vụ:        " << planName << "\n"
                     << "Hạn Sử Dụng:        " << expireDate << "\n"
                     << "Khóa Phần Cứng:     " << machineId << " (" << machineName << ")\n"
                     << "Module Được Duyệt:  " << enabledMods << "\n"
                     << "Phát Hành Bởi:      SuperAdmin SaaS Central Authority\n"
                     << "Quy Chuẩn Đóng Gói: SOP-CBNX-09 Enterprise Edition\n"
                     << "==============================================================\n";
                {
                    std::ofstream certFile((releaseDir / "license_certificate.txt").string(), std::ios::binary | std::ios::trunc);
                    if (certFile) { certFile << cert.str(); certFile.close(); }
                }

                std::string saasHotline = "1900 6868";
                std::string saasEmail = "support@cybernexus.vn";
                auto hlRow = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = 'saas_hotline' LIMIT 1");
                if (!hlRow.is_null() && !hlRow.value("setting_value", "").empty()) saasHotline = hlRow.value("setting_value", "");
                auto emRow = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = 'saas_email' LIMIT 1");
                if (!emRow.is_null() && !emRow.value("setting_value", "").empty()) saasEmail = emRow.value("setting_value", "");

                // 2.1 Tạo file THONG_TIN_DANG_NHAP_BAN_DAU.txt
                std::stringstream cred;
                cred << "================================================================================\n"
                     << "  CYBERNEXUS OS — PHIẾU BÀN GIAO TÀI KHOẢN VÀ MÃ PIN KHỞI TẠO ĐIỂM BÁN\n"
                     << "================================================================================\n"
                     << "Cửa Hàng:           " << storeName << "\n"
                     << "Mã Cửa Hàng:        " << realTcode << "\n"
                     << "Gói Bản Quyền:      " << planName << " (" << (isTrial ? "TRIAL 07 NGÀY" : "CHÍNH THỨC") << ")\n"
                     << "Mã Giấy Phép (Key): " << licenseKey << "\n"
                     << "Hạn Sử Dụng:        " << expireDate << "\n"
                     << "Máy Chủ Master:     " << pubUrl << "\n"
                     << "Quy Chuẩn Bàn Giao: SOP-CBNX-09 Enterprise Edition\n\n"
                     << "--------------------------------------------------------------------------------\n"
                     << "1. DANH SÁCH TÀI KHOẢN & MÃ PIN 6 SỐ KHỞI TẠO MẶC ĐỊNH\n"
                     << "--------------------------------------------------------------------------------\n"
                     << "[1] TÀI KHOẢN QUẢN TRỊ VIÊN (CHỦ QUÁN / ADMIN)\n"
                     << "    - Tên đăng nhập (Username): admin\n"
                     << "    - Mật khẩu mặc định:        Admin@2026\n"
                     << "    - Mã PIN 6 số mặc định:     Xem file DEFAULT_OWNER_PIN.txt (dùng 1 lần, bắt buộc đổi)\n"
                     << "    - Phạm vi quyền hạn:        Toàn quyền quản trị quán, menu, doanh thu, cài đặt.\n"
                     << "    - Cổng truy cập:            http://localhost:8501/admin.html\n\n"
                     << "[2] TÀI KHOẢN BẾP & PHA CHẾ (CHEF / KITCHEN)\n"
                     << "    - Tên đăng nhập (Username): bep01\n"
                     << "    - Mật khẩu mặc định:        Bep@2026\n"
                     << "    - Mã PIN 6 số:              111111\n"
                     << "    - Phạm vi quyền hạn:        Màn hình KDS, cập nhật trạng thái làm món.\n"
                     << "    - Cổng truy cập:            http://localhost:8501/kitchen.html\n\n"
                     << "[3] TÀI KHOẢN THU NGÂN (CASHIER / POS)\n"
                     << "    - Tên đăng nhập (Username): thungan01\n"
                     << "    - Mật khẩu mặc định:        ThuNgan@2026\n"
                     << "    - Mã PIN 6 số:              222222\n"
                     << "    - Phạm vi quyền hạn:        Mở ca, bán hàng, in bill hóa đơn, thanh toán.\n"
                     << "    - Cổng truy cập:            http://localhost:8501/index.html\n\n"
                     << "[4] TÀI KHOẢN NHÂN VIÊN PHỤC VỤ (WAITER)\n"
                     << "    - Tên đăng nhập (Username): phucvu01\n"
                     << "    - Mật khẩu mặc định:        PhucVu@2026\n"
                     << "    - Mã PIN 6 số:              333333\n"
                     << "    - Phạm vi quyền hạn:        Mở bàn, chọn món cho khách, chuyển bàn, gửi bếp.\n"
                     << "    - Cổng truy cập:            http://localhost:8501/order.html\n\n"
                     << "--------------------------------------------------------------------------------\n"
                     << "2. CẢNH BÁO AN NINH & YÊU CẦU ĐỔI MẬT KHẨU LẦN ĐẦU (BẮT BUỘC)\n"
                     << "--------------------------------------------------------------------------------\n"
                     << "    - Chủ quán và Nhân viên BẮT BUỘC PHẢI ĐỔI MẬT KHẨU VÀ MÃ PIN NGAY LẦN ĐẦU!\n"
                     << "    - Không chia sẻ mật khẩu quản trị cho nhân viên thời vụ.\n\n"
                     << "--------------------------------------------------------------------------------\n"
                     << "3. DỮ LIỆU KHỞI TẠO SẴN TRONG HỆ THỐNG\n"
                     << "--------------------------------------------------------------------------------\n"
                     << "    1. Cà phê sữa đá Sài Gòn      - Mã: CF001 - Đơn giá: 29.000 VNĐ\n"
                     << "    2. Bò bít tết sốt tiêu đen    - Mã: BT001 - Đơn giá: 89.000 VNĐ\n"
                     << "    3. Trà đào cam sả thanh nhiệt - Mã: TR001 - Đơn giá: 35.000 VNĐ\n\n"
                     << "--------------------------------------------------------------------------------\n"
                     << "4. HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG TRÊN MÁY QUÁN\n"
                     << "--------------------------------------------------------------------------------\n"
                     << "Bước 1: Chạy file cài đặt CyberNexus_POS_Setup_" << realTcode << ".exe (Run as Administrator).\n"
                     << "Bước 2: Mở 'CyberNexus_Control_Center.exe' (từ Desktop hoặc thư mục cài đặt).\n"
                     << "Bước 3: Đảm bảo trạng thái Slave báo Online (Port 8501) -> bấm nút 'Mở Web'.\n"
                     << "Bước 4: Đăng nhập bằng PIN 6 số trong DEFAULT_OWNER_PIN.txt (hoặc admin / Admin@2026).\n\n"
                     << "Hotline Hỗ Trợ Kỹ Thuật: " << saasHotline << " - Email: " << saasEmail << "\n"
                     << "================================================================================\n";

                fs::path handoverDir = baseDir / "packages" / realTcode / "handover";
                try { fs::create_directories(handoverDir); } catch (...) {}
                {
                    std::ofstream credRelFile((releaseDir / "THONG_TIN_DANG_NHAP_BAN_DAU.txt").string(), std::ios::binary | std::ios::trunc);
                    if (credRelFile) { credRelFile << cred.str(); credRelFile.close(); }
                    std::ofstream credHndFile((handoverDir / "THONG_TIN_DANG_NHAP_BAN_DAU.txt").string(), std::ios::binary | std::ios::trunc);
                    if (credHndFile) { credHndFile << cred.str(); credHndFile.close(); }
                }

                int64_t credSize = fs::exists(releaseDir / "THONG_TIN_DANG_NHAP_BAN_DAU.txt") ? fs::file_size(releaseDir / "THONG_TIN_DANG_NHAP_BAN_DAU.txt") : 4096;
                auto existingCred = db.queryRow(
                    "SELECT id FROM saas_tenant_documents WHERE tenant_code = :tc AND file_name = 'THONG_TIN_DANG_NHAP_BAN_DAU.txt' LIMIT 1",
                    {{":tc", realTcode}}
                );
                if (existingCred.is_null()) {
                    db.execute(R"(
                        INSERT INTO saas_tenant_documents 
                        (tenant_id, tenant_code, category, file_name, file_path, file_size, file_ext, title, notes, status, uploaded_by)
                        VALUES (:tid, :tc, 'credentials', 'THONG_TIN_DANG_NHAP_BAN_DAU.txt', :fp, :fs, 'txt', :ti, :no, 'valid', 'SuperAdmin')
                    )", {
                        {":tid", realTid}, {":tc", realTcode},
                        {":fp", "packages/" + realTcode + "/handover/THONG_TIN_DANG_NHAP_BAN_DAU.txt"},
                        {":fs", credSize},
                        {":ti", "Thông Tin Tài Khoản & Mật Khẩu Khởi Tạo (Bắt Buộc Đổi)"},
                        {":no", "Cấp 4 tài khoản (Admin, Bếp, Thu Ngân, Phục Vụ) kèm mã PIN và 3 món ăn mẫu."}
                    });
                } else {
                    db.execute("UPDATE saas_tenant_documents SET file_size = :fs, category = 'credentials', updated_at = datetime('now') WHERE id = :id",
                        {{":fs", credSize}, {":id", getInt(existingCred, "id", 0)}});
                }

                // 3. Đóng gói đầy đủ các thành phần thành file ZIP chuẩn Windows & Linux
                std::string zipFileName = "CyberNexus_POS_Release_" + realTcode + ".zip";
                fs::path zipPath = releaseDir / zipFileName;
                std::string relZipPath = "packages/" + realTcode + "/release/" + zipFileName;

                fs::path oldStaging = releaseDir / "staging_temp";
                if (fs::exists(oldStaging)) { std::error_code ec; fs::remove_all(oldStaging, ec); }
                fs::path stagingDir = fs::temp_directory_path() / ("cn_pkg_" + realTcode);
                fs::path tmpZipPath = fs::temp_directory_path() / zipFileName;
                bool zipOk = false;
                try {
                    std::error_code ec;
                    if (fs::exists(stagingDir)) fs::remove_all(stagingDir, ec);
                    if (fs::exists(tmpZipPath)) fs::remove(tmpZipPath, ec);
                    fs::create_directories(stagingDir);

                    // Copy config, certificate, credentials
                    fs::copy_file(releaseDir / "config.json", stagingDir / "config.json", fs::copy_options::overwrite_existing);
                    fs::copy_file(releaseDir / "license_certificate.txt", stagingDir / "license_certificate.txt", fs::copy_options::overwrite_existing);
                    if (fs::exists(releaseDir / "THONG_TIN_DANG_NHAP_BAN_DAU.txt")) {
                        fs::copy_file(releaseDir / "THONG_TIN_DANG_NHAP_BAN_DAU.txt", stagingDir / "THONG_TIN_DANG_NHAP_BAN_DAU.txt", fs::copy_options::overwrite_existing);
                    }

                    fs::path projectRoot = baseDir.parent_path();
                    fs::path slaveDir = projectRoot / "slave";

                    // Đảm bảo quán có PIN mặc định 6 số ngẫu nhiên & xuất file DEFAULT_OWNER_PIN.txt
                    std::string licKey = getString(tenant, "license_key", "");
                    std::string ownerPin6 = CyberNexus::PinVault::decryptPinForLicense(getString(tenant, "default_pin_enc", ""), licKey);
                    if (!CyberNexus::PinVault::isValidPin6(ownerPin6)) {
                        ownerPin6 = CyberNexus::PinVault::generateRandomPin6();
                        db.execute("UPDATE saas_tenants SET default_pin_sha256 = :psha, default_pin_enc = :penc WHERE id = :id",
                                   {{":psha", AuthService::sha256(ownerPin6)}, {":penc", CyberNexus::PinVault::encryptPinForLicense(ownerPin6, licKey)}, {":id", realTid}});
                    }
                    CyberNexus::PinVault::writeDefaultOwnerPinFile(stagingDir, storeName, realTcode, ownerPin6, false);

                    // Khởi tạo Database sạch riêng cho quán (4 users + 3 món ăn mẫu + clean orders)
                    fs::path stageDbDir = stagingDir / "database";
                    fs::create_directories(stageDbDir);
                    fs::path stageDbPath = stageDbDir / "store_local.db";
                    fs::path tmplDbPath = slaveDir / "database" / "store_local.db";
                    if (fs::exists(tmplDbPath)) {
                        fs::copy_file(tmplDbPath, stageDbPath, fs::copy_options::overwrite_existing);
                        sqlite3* sdb = nullptr;
                        if (sqlite3_open(stageDbPath.string().c_str(), &sdb) == SQLITE_OK) {
                            sqlite3_exec(sdb, "ALTER TABLE users ADD COLUMN default_pin_sha256 TEXT DEFAULT '';", nullptr, nullptr, nullptr);
                            sqlite3_exec(sdb, "ALTER TABLE users ADD COLUMN pin_must_change INTEGER DEFAULT 0;", nullptr, nullptr, nullptr);
                            sqlite3_exec(sdb, "DELETE FROM orders; DELETE FROM order_items; DELETE FROM attendances; DELETE FROM kitchen_service_logs; DELETE FROM material_transactions; DELETE FROM app_notifications; DELETE FROM media_jukebox_queue; DELETE FROM media_tracks;", nullptr, nullptr, nullptr);
                            sqlite3_exec(sdb, "DELETE FROM users;", nullptr, nullptr, nullptr);
                            std::string sqlUsers = "INSERT INTO users (id, user_code, username, password, fullname, role, pin_code, default_pin_sha256, pin_must_change, status, created_at) VALUES "
                                "(1, 'AD001', 'admin', 'Admin@2026', 'Quản Trị Viên (" + storeName + ")', 'admin', '" + ownerPin6 + "', '" + AuthService::sha256(ownerPin6) + "', 1, 'active', datetime('now')),"
                                "(2, 'BP001', 'bep01', 'Bep@2026', 'Bếp Trưởng / Pha Chế', 'kitchen', '111111', '', 0, 'active', datetime('now')),"
                                "(3, 'TN001', 'thungan01', 'ThuNgan@2026', 'Thu Ngân Điểm Bán', 'cashier', '222222', '', 0, 'active', datetime('now')),"
                                "(4, 'PV001', 'phucvu01', 'PhucVu@2026', 'Nhân Viên Phục Vụ 01', 'waiter', '333333', '', 0, 'active', datetime('now'));";
                            sqlite3_exec(sdb, sqlUsers.c_str(), nullptr, nullptr, nullptr);
                            sqlite3_exec(sdb, "DELETE FROM products;", nullptr, nullptr, nullptr);
                            std::string sqlProducts = "INSERT INTO products (id, category_id, code, name, unit, cost_price, sale_price, status, description, created_at) VALUES "
                                "(1, 4, 'CF001', 'Cà phê sữa đá Sài Gòn', 'ly', 8000, 29000, 'active', 'Cà phê hạt Robusta Buôn Ma Thuột pha phin đậm đà, sữa đặc thơm ngọt', datetime('now')),"
                                "(2, 3, 'BT001', 'Bò bít tết sốt tiêu đen', 'phần', 45000, 89000, 'active', 'Thịt thăn bò mềm mọng nước, sốt tiêu đen hảo hạng kèm khoai tây chiên và bánh mì', datetime('now')),"
                                "(3, 14, 'TR001', 'Trà đào cam sả thanh nhiệt', 'ly', 12000, 35000, 'active', 'Trà đào thanh mát quyện cùng hương vị cam tươi và tinh dầu sả tự nhiên', datetime('now'));";
                            sqlite3_exec(sdb, sqlProducts.c_str(), nullptr, nullptr, nullptr);
                            sqlite3_exec(sdb, "DELETE FROM audit_logs; DELETE FROM pos_shifts; DELETE FROM cash_transactions; DELETE FROM finance_expenses; DELETE FROM payment_transactions; DELETE FROM card_transactions; DELETE FROM order_reviews; DELETE FROM supplier_invoices; DELETE FROM supplier_payments;", nullptr, nullptr, nullptr);
                            auto upsertSetting = [&](const char* k, const std::string& v) {
                                sqlite3_stmt* ust = nullptr;
                                if (sqlite3_prepare_v2(sdb, "UPDATE store_settings SET setting_value = ? WHERE setting_key = ?", -1, &ust, nullptr) == SQLITE_OK) {
                                    sqlite3_bind_text(ust, 1, v.c_str(), -1, SQLITE_TRANSIENT);
                                    sqlite3_bind_text(ust, 2, k, -1, SQLITE_TRANSIENT);
                                    sqlite3_step(ust);
                                    sqlite3_finalize(ust);
                                }
                                if (sqlite3_changes(sdb) == 0) {
                                    sqlite3_stmt* ist = nullptr;
                                    if (sqlite3_prepare_v2(sdb, "INSERT INTO store_settings (setting_key, setting_value) VALUES (?, ?)", -1, &ist, nullptr) == SQLITE_OK) {
                                        sqlite3_bind_text(ist, 1, k, -1, SQLITE_TRANSIENT);
                                        sqlite3_bind_text(ist, 2, v.c_str(), -1, SQLITE_TRANSIENT);
                                        sqlite3_step(ist);
                                        sqlite3_finalize(ist);
                                    }
                                }
                            };
                            upsertSetting("store_name", storeName);
                            upsertSetting("tenant_code", realTcode);
                            upsertSetting("store_hotline", getString(tenant, "phone", ""));
                            upsertSetting("store_address", getString(tenant, "address", ""));
                            upsertSetting("bank_id", "");
                            upsertSetting("bank_account_no", "");
                            upsertSetting("bank_account_name", "");
                            upsertSetting("store_wifi", "");
                            upsertSetting("print_header_note", "Hân hạnh được phục vụ Quý khách!");
                            upsertSetting("print_footer_note", "Cảm ơn Quý khách - Hẹn gặp lại!");
                            {
                                std::string tj = getString(tenant, "theme_json", "");
                                if (!tj.empty()) upsertSetting("theme_json", tj);
                            }
                            {
                                // Đánh dấu bản đóng gói mới đã ở phiên bản mới nhất của Master, tránh báo "Cập nhật" ngược về bản OTA cũ
                                std::string latestOtaVer = "";
                                try {
                                    fs::path mfPath = baseDir / "updates" / "manifest.json";
                                    if (fs::exists(mfPath)) {
                                        std::ifstream mfIn(mfPath);
                                        if (mfIn) {
                                            json mfJson = json::parse(mfIn, nullptr, false);
                                            if (mfJson.is_object()) latestOtaVer = mfJson.value("version", "");
                                        }
                                    }
                                } catch (...) {}
                                if (!latestOtaVer.empty()) {
                                    upsertSetting("ota_applied_version", latestOtaVer);
                                }
                            }

                            // Cập nhật đúng License Cache của quán đang đóng gói (tránh giữ nhầm GP-ENTERPRISE-2026-NEXUS của DB mẫu)
                            sqlite3_exec(sdb, "ALTER TABLE local_license_cache ADD COLUMN blocked_modules TEXT DEFAULT '[]';", nullptr, nullptr, nullptr);
                            sqlite3_exec(sdb, "ALTER TABLE local_license_cache ADD COLUMN card_fee_percent REAL DEFAULT 0.0;", nullptr, nullptr, nullptr);
                            sqlite3_exec(sdb, "DELETE FROM local_license_cache;", nullptr, nullptr, nullptr);
                            std::string ownerNameStr = getString(tenant, "owner_name", "Chủ Quán");
                            std::string blockedModsStr = getString(tenant, "blocked_modules", "[]");
                            int daysLeftVal = getInt(tenant, "days_left", isTrial ? 7 : 365);
                            double cardFeeVal = 0.0;
                            try {
                                if (tenant.contains("card_fee_percent") && tenant["card_fee_percent"].is_number()) {
                                    cardFeeVal = tenant["card_fee_percent"].get<double>();
                                }
                            } catch (...) {}
                            sqlite3_stmt* lst = nullptr;
                            if (sqlite3_prepare_v2(sdb,
                                "INSERT INTO local_license_cache (id, license_key, store_name, owner_name, plan_name, subscription_status, expire_date, days_left, machine_id, bound_machine_id, enabled_modules, blocked_modules, card_fee_percent, last_sync_at, last_sync_status) "
                                "VALUES (1, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, datetime('now'), 'packaged')",
                                -1, &lst, nullptr) == SQLITE_OK) {
                                sqlite3_bind_text(lst, 1, licenseKey.c_str(), -1, SQLITE_TRANSIENT);
                                sqlite3_bind_text(lst, 2, storeName.c_str(), -1, SQLITE_TRANSIENT);
                                sqlite3_bind_text(lst, 3, ownerNameStr.c_str(), -1, SQLITE_TRANSIENT);
                                sqlite3_bind_text(lst, 4, planName.c_str(), -1, SQLITE_TRANSIENT);
                                sqlite3_bind_text(lst, 5, subSt.c_str(), -1, SQLITE_TRANSIENT);
                                sqlite3_bind_text(lst, 6, expireDate.c_str(), -1, SQLITE_TRANSIENT);
                                sqlite3_bind_int(lst, 7, daysLeftVal);
                                sqlite3_bind_text(lst, 8, enabledMods.c_str(), -1, SQLITE_TRANSIENT);
                                sqlite3_bind_text(lst, 9, blockedModsStr.c_str(), -1, SQLITE_TRANSIENT);
                                sqlite3_bind_double(lst, 10, cardFeeVal);
                                sqlite3_step(lst);
                                sqlite3_finalize(lst);
                            }

                            sqlite3_close(sdb);
                        }
                    }

                    // Copy binary thực thi và Control Center (không cần .bat CMD)
                    if (fs::exists(slaveDir / "CyberNexus_Control_Center.exe")) {
                        fs::copy_file(slaveDir / "CyberNexus_Control_Center.exe", stagingDir / "CyberNexus_Control_Center.exe", fs::copy_options::overwrite_existing);
                    }
                    if (fs::exists(slaveDir / "cybernexus_slave.exe")) {
                        fs::copy_file(slaveDir / "cybernexus_slave.exe", stagingDir / "cybernexus_slave.exe", fs::copy_options::overwrite_existing);
                    }

                    // Copy giao diện Web (loại bỏ dữ liệu mẫu: hình món, nhạc, video; tên quán load động từ store_brand.js)
                    if (fs::exists(slaveDir / "web")) {
                        fs::copy(slaveDir / "web", stagingDir / "web", fs::copy_options::recursive | fs::copy_options::overwrite_existing);
                        std::error_code ec;
                        for (const auto& sub : {fs::path("web/assets/media"), fs::path("web/assets/images"), fs::path("web/uploads")}) {
                            fs::path p = stagingDir / sub;
                            if (fs::exists(p, ec)) fs::remove_all(p, ec);
                            fs::create_directories(p, ec);
                        }
                    }
                    {
                        std::error_code ec;
                        fs::create_directories(stagingDir / "uploads", ec);
                    }

                    // Copy các module ĐƯỢC CẤP PHÉP (Defense-in-depth: Không cấp phép thì không copy DLL)
                    fs::path stageModDir = stagingDir / "modules";
                    fs::create_directories(stageModDir);

                    // ARCH-01: POS Core & Finance Admin chay truc tiep trong slave_handlers.cpp; khong dong goi 2 DLL thua

                    // Module Media Streaming
                    if (enabledMods.find("mod_media_stream") != std::string::npos && fs::exists(slaveDir / "modules" / "libmod_media_stream.dll")) {
                        fs::copy_file(slaveDir / "modules" / "libmod_media_stream.dll", stageModDir / "libmod_media_stream.dll", fs::copy_options::overwrite_existing);
                        if (fs::exists(slaveDir / "modules" / "libmod_media_stream.dll.sig")) {
                            fs::copy_file(slaveDir / "modules" / "libmod_media_stream.dll.sig", stageModDir / "libmod_media_stream.dll.sig", fs::copy_options::overwrite_existing);
                        }
                    }

                    // Module Network QoS
                    if (enabledMods.find("mod_network_qos") != std::string::npos && fs::exists(slaveDir / "modules" / "libmod_network_qos.dll")) {
                        fs::copy_file(slaveDir / "modules" / "libmod_network_qos.dll", stageModDir / "libmod_network_qos.dll", fs::copy_options::overwrite_existing);
                        if (fs::exists(slaveDir / "modules" / "libmod_network_qos.dll.sig")) {
                            fs::copy_file(slaveDir / "modules" / "libmod_network_qos.dll.sig", stageModDir / "libmod_network_qos.dll.sig", fs::copy_options::overwrite_existing);
                        }
                    }

                    // Module Card Payment (ECR / SmartPOS)
                    if (enabledMods.find("mod_card_payment") != std::string::npos && fs::exists(slaveDir / "modules" / "libmod_card_payment.dll")) {
                        fs::copy_file(slaveDir / "modules" / "libmod_card_payment.dll", stageModDir / "libmod_card_payment.dll", fs::copy_options::overwrite_existing);
                        if (fs::exists(slaveDir / "modules" / "libmod_card_payment.dll.sig")) {
                            fs::copy_file(slaveDir / "modules" / "libmod_card_payment.dll.sig", stageModDir / "libmod_card_payment.dll.sig", fs::copy_options::overwrite_existing);
                        }
                    }

                    // Đính kèm đầy đủ bộ hồ sơ pháp lý, điều khoản bản quyền, biên bản bàn giao & bảo hành
                    fs::path legalStageDir = stagingDir / "Ho_So_Phap_Ly_Va_Ban_Quyen";
                    generateTenantLegalForms(db, baseDir, realTid, &legalStageDir);

                    // Nén thành file .zip chuẩn qua tar.exe ở %TEMP% rồi mới chép sang releaseDir
                    std::string tarCmd = "tar.exe -a -c -f \"" + tmpZipPath.string() + "\" -C \"" + stagingDir.string() + "\" *";
                    int tarRc = system(tarCmd.c_str());
                    if (tarRc == 0 && fs::exists(tmpZipPath) && fs::file_size(tmpZipPath) > 256) {
                        if (fs::exists(zipPath)) fs::remove(zipPath);
                        fs::copy_file(tmpZipPath, zipPath, fs::copy_options::overwrite_existing);
                        zipOk = true;
                    }

                    // Dọn dẹp thư mục staging
                    fs::remove_all(stagingDir, ec);
                    fs::remove(tmpZipPath, ec);
                } catch (...) {}

                if (!zipOk) {
                    sendJson(res, {{"success", false}, {"message", "Đóng gói file ZIP thất bại (tar.exe lỗi). Vui lòng thử lại!"}}, 500);
                    return;
                }

                int64_t zipSize = fs::exists(zipPath) ? fs::file_size(zipPath) : 1024;

                // 4. Đóng gói thêm file Setup 1-Click (.EXE) nếu có CyberNexus_Setup_Stub.exe
                std::string setupFileName = "CyberNexus_POS_Setup_" + realTcode + ".exe";
                fs::path setupExePath = releaseDir / setupFileName;
                std::string relSetupPath = "packages/" + realTcode + "/release/" + setupFileName;
                fs::path stubPath = baseDir / "CyberNexus_Setup_Stub.exe";
                bool hasSetupExe = false;
                if (fs::exists(stubPath) && fs::exists(zipPath) && zipSize > 256) {
                    std::ifstream stubIn(stubPath, std::ios::binary);
                    std::ifstream zipIn(zipPath, std::ios::binary);
                    std::ofstream exeOut(setupExePath, std::ios::binary);
                    if (stubIn && zipIn && exeOut) {
                        exeOut << stubIn.rdbuf() << zipIn.rdbuf();
                        uint64_t zSz = static_cast<uint64_t>(zipSize);
                        exeOut.write(reinterpret_cast<const char*>(&zSz), sizeof(zSz));
                        exeOut.write("CNXSETUP", 8);
                        exeOut.close();
                        hasSetupExe = fs::exists(setupExePath) && fs::file_size(setupExePath) > static_cast<uint64_t>(zipSize);
                    }
                }
                if (hasSetupExe) {
                    int64_t setupSize = static_cast<int64_t>(fs::file_size(setupExePath));
                    auto exSetup = db.queryRow(
                        "SELECT id FROM saas_tenant_documents WHERE tenant_code = :tc AND category = 'setup_exe' LIMIT 1",
                        {{":tc", realTcode}}
                    );
                    if (exSetup.is_null()) {
                        db.execute(R"(
                            INSERT INTO saas_tenant_documents
                            (tenant_id, tenant_code, category, file_name, file_path, file_size, file_ext, title, notes, status, uploaded_by)
                            VALUES (:tid, :tc, 'setup_exe', :fn, :fp, :fs, 'exe', :ti, :no, 'valid', 'SuperAdmin')
                        )", {
                            {":tid", realTid}, {":tc", realTcode}, {":fn", setupFileName},
                            {":fp", relSetupPath}, {":fs", setupSize},
                            {":ti", "Bộ Cài Setup 1-Click (.EXE) " + realTcode},
                            {":no", "Bấm đúp cài đặt tự động: giải nén, mở Firewall 8501, tạo Shortcut Desktop & chạy Control Center."}
                        });
                    } else {
                        db.execute("UPDATE saas_tenant_documents SET file_size = :fs, updated_at = datetime('now') WHERE id = :id",
                            {{":fs", setupSize}, {":id", getInt(exSetup, "id", 0)}});
                    }
                }

                auto existing = db.queryRow(
                    "SELECT id FROM saas_tenant_documents WHERE tenant_code = :tc AND category = 'release' LIMIT 1",
                    {{":tc", realTcode}}
                );
                if (existing.is_null()) {
                    db.execute(R"(
                        INSERT INTO saas_tenant_documents 
                        (tenant_id, tenant_code, category, file_name, file_path, file_size, file_ext, title, notes, status, uploaded_by)
                        VALUES (:tid, :tc, 'release', :fn, :fp, :fs, 'zip', :ti, :no, 'valid', 'SuperAdmin')
                    )", {
                        {":tid", realTid}, {":tc", realTcode}, {":fn", zipFileName},
                        {":fp", relZipPath}, {":fs", zipSize},
                        {":ti", "Bộ Cài Đặt Bản Quyền " + realTcode},
                        {":no", "Gói cài đặt đóng gói tự động chuẩn SOP-09 kèm License Key và cấu hình quán."}
                    });
                } else {
                    int64_t exId = getInt(existing, "id", 0);
                    db.execute(R"(
                        UPDATE saas_tenant_documents 
                        SET file_size = :fs, updated_at = datetime('now')
                        WHERE id = :id
                    )", {{":fs", zipSize}, {":id", exId}});
                }

                if (!isTrial) {
                    db.execute("UPDATE saas_tenants SET workflow_stage = CASE WHEN workflow_stage IN ('pending_contract','pending_payment','ready_to_install','') THEN 'pending_handover' ELSE workflow_stage END, updated_at = datetime('now') WHERE id = :id", {{":id", realTid}});
                }

                recordAuditLog(db, 0, "Kỹ Thuật", "technical", "PACKAGE_BUILD", realTcode,
                    std::string(isTrial ? "Đóng gói bản TRIAL 07 NGÀY " : "Đóng gói bộ cài chính thức ") + zipFileName + " cho quán " + storeName,
                    "{}", req.remote_addr);

                sendJson(res, {
                    {"success", true},
                    {"message", std::string(isTrial ? "Đã đóng gói bản TRIAL 07 NGÀY cho " : "Đã đóng gói thành công bộ cài đặt cho ") + storeName + "!"},
                    {"download_url", relZipPath},
                    {"zip_file_name", zipFileName}
                });
                return;
            }

            if (action == "delete_tenant_document") {
                int64_t docId = getValInt("document_id", 0);
                auto doc = db.queryRow("SELECT * FROM saas_tenant_documents WHERE id = :id LIMIT 1", {{":id", docId}});
                if (!doc.is_null()) {
                    std::string fPath = getString(doc, "file_path", "");
                    std::string fName = getString(doc, "file_name", "");
                    std::string tCode = getString(doc, "tenant_code", "");
                    if (!fPath.empty()) {
                        try {
                            fs::path fullPath = SaleApp::Config::AppConfig::instance().getBaseDir() / fPath;
                            if (fs::exists(fullPath)) fs::remove(fullPath);
                        } catch (...) {}
                    }
                    db.execute("DELETE FROM saas_tenant_documents WHERE id = :id", {{":id", docId}});
                    recordAuditLog(db, 0, "SuperAdmin", "super_admin", "DELETE_DOCUMENT", tCode,
                        "Xóa tài liệu " + fName + " khỏi kho hồ sơ của quán " + tCode,
                        "{}", req.remote_addr);
                }
                sendJson(res, {{"success", true}, {"message", "Đã xóa tài liệu khỏi kho hồ sơ!"}});
                return;
            }

            if (action == "save_legal_template") {
                std::string file = getString(body, "file");
                std::string content = getString(body, "content");
                const std::vector<std::string> allowed = {
                    "bao_gia_dich_vu.html",
                    "hop_dong_dich_vu.html",
                    "dieu_khoan_su_dung_ban_quyen.html",
                    "bien_ban_ban_giao_nghiem_thu.html",
                    "phieu_bao_hanh_ky_thuat.html"
                };
                if (std::find(allowed.begin(), allowed.end(), file) == allowed.end()) {
                    sendJson(res, {{"success", false}, {"message", "Tên biểu mẫu không hợp lệ!"}}, 400);
                    return;
                }
                fs::path tplDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "templates";
                std::error_code ec;
                fs::create_directories(tplDir, ec);
                std::ofstream ofs(tplDir / file, std::ios::binary | std::ios::trunc);
                if (!ofs) {
                    sendJson(res, {{"success", false}, {"message", "Không thể ghi file biểu mẫu!"}}, 500);
                    return;
                }
                ofs.write(content.data(), content.size());
                ofs.close();
                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "UPDATE_LEGAL_TEMPLATE", file,
                    "Cập nhật nội dung biểu mẫu pháp lý: " + file, "{}", req.remote_addr);
                sendJson(res, {{"success", true}, {"message", "Đã lưu biểu mẫu thành công!"}});
                return;
            }

            if (action == "activate_trial_7d") {
                int64_t tid = getValInt("tenant_id", 0);
                if (tid <= 0) { sendJson(res, {{"success", false}, {"message", "Thiếu tenant_id"}}, 400); return; }
                db.execute("UPDATE saas_tenants SET subscription_status = 'trial', workflow_stage = 'trial', expire_date = date('now', '+7 days'), trial_started_at = datetime('now'), updated_at = datetime('now') WHERE id = :id", {{":id", tid}});
                StoreTunnelManager::instance().enqueueCommand(tid, "SYNC_LICENSE", json::object(), true);
                recordAuditLog(db, 0, "Sales/Admin", "staff", "ACTIVATE_TRIAL_7D", std::to_string(tid), "Cấp gói Dùng thử 07 ngày cho quán ID=" + std::to_string(tid), "{}", req.remote_addr);
                sendJson(res, {{"success", true}, {"message", "Đã kích hoạt chế độ Dùng Thử 07 Ngày! Kỹ thuật có thể đóng gói bộ cài Trial ngay."}});
                return;
            }

            if (action == "confirm_payment") {
                int64_t tid = getValInt("tenant_id", 0);
                if (tid <= 0) { sendJson(res, {{"success", false}, {"message", "Thiếu tenant_id"}}, 400); return; }
                db.execute(
                    "UPDATE saas_tenants SET payment_confirmed = 1, payment_confirmed_by = 'Finance/SuperAdmin', payment_confirmed_at = datetime('now'), "
                    "subscription_status = CASE WHEN subscription_status='trial' THEN 'active' ELSE subscription_status END, "
                    "expire_date = CASE WHEN subscription_status='trial' THEN date('now', '+1 year') ELSE expire_date END, "
                    "workflow_stage = CASE WHEN workflow_stage IN ('pending_contract','pending_payment','trial','') THEN 'ready_to_install' ELSE workflow_stage END, "
                    "updated_at = datetime('now') WHERE id = :id",
                    {{":id", tid}}
                );
                StoreTunnelManager::instance().enqueueCommand(tid, "SYNC_LICENSE", json::object(), true);
                recordAuditLog(db, 0, "Finance", "finance", "CONFIRM_PAYMENT", std::to_string(tid), "Xác nhận đã thu phí bản quyền cho quán ID=" + std::to_string(tid), "{}", req.remote_addr);
                sendJson(res, {{"success", true}, {"message", "Đã xác nhận thanh toán! Kỹ thuật đã được mở khóa đóng gói bộ cài chính thức."}});
                return;
            }

            if (action == "grant_workflow_override") {
                int64_t tid = getValInt("tenant_id", 0);
                if (tid <= 0) { sendJson(res, {{"success", false}, {"message", "Thiếu tenant_id"}}, 400); return; }
                db.execute("UPDATE saas_tenants SET workflow_override = 1, updated_at = datetime('now') WHERE id = :id", {{":id", tid}});
                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "WORKFLOW_OVERRIDE", std::to_string(tid), "Duyệt ngoại lệ cho phép đóng gói trước khi đủ chứng từ cho quán ID=" + std::to_string(tid), "{}", req.remote_addr);
                sendJson(res, {{"success", true}, {"message", "Đã duyệt ngoại lệ! Có thể đóng gói bộ cài ngay."}});
                return;
            }

            if (action == "soft_delete_tenant") {
                int64_t tid = getValInt("tenant_id", 0);
                std::string reason = getString(body, "reason", "Chuyển vào Thùng rác từ Quản Lý Cửa Hàng");
                if (tid <= 0) { sendJson(res, {{"success", false}, {"message", "Thiếu tenant_id"}}, 400); return; }
                auto row = db.queryRow("SELECT tenant_code, store_name FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
                if (row.is_null()) { sendJson(res, {{"success", false}, {"message", "Không tìm thấy cửa hàng!"}}, 404); return; }
                db.execute(
                    "UPDATE saas_tenants SET subscription_status = 'deleted', deleted_at = datetime('now'), deleted_reason = :rs, updated_at = datetime('now') WHERE id = :id",
                    {{":rs", reason}, {":id", tid}}
                );
                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "SOFT_DELETE_TENANT", row.value("tenant_code", ""),
                    "Chuyển quán " + row.value("store_name", "") + " (" + row.value("tenant_code", "") + ") vào Thùng rác: " + reason, "{}", req.remote_addr);
                sendJson(res, {{"success", true}, {"message", "Đã chuyển cửa hàng vào Thùng rác (Trash). Có thể xem lại hoặc khôi phục bất cứ lúc nào!"}});
                return;
            }

            if (action == "restore_tenant") {
                int64_t tid = getValInt("tenant_id", 0);
                if (tid <= 0) { sendJson(res, {{"success", false}, {"message", "Thiếu tenant_id"}}, 400); return; }
                auto row = db.queryRow("SELECT tenant_code, store_name, workflow_stage FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
                if (row.is_null()) { sendJson(res, {{"success", false}, {"message", "Không tìm thấy cửa hàng!"}}, 404); return; }
                std::string nextSub = (row.value("workflow_stage", "") == "trial") ? "trial" : "active";
                db.execute(
                    "UPDATE saas_tenants SET subscription_status = :st, deleted_at = '', deleted_reason = '', updated_at = datetime('now') WHERE id = :id",
                    {{":st", nextSub}, {":id", tid}}
                );
                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "RESTORE_TENANT", row.value("tenant_code", ""),
                    "Khôi phục quán " + row.value("store_name", "") + " (" + row.value("tenant_code", "") + ") từ Thùng rác", "{}", req.remote_addr);
                sendJson(res, {{"success", true}, {"message", "Đã khôi phục cửa hàng thành công!"}});
                return;
            }

            // ==========================================
            // PHÂN HỆ ĐẠI LÝ PHÂN PHỐI (RESELLER MANAGEMENT)
            // ==========================================
            if (action == "get_resellers") {
                auto rows = db.query(R"(
                    SELECT r.*,
                           (SELECT COUNT(*) FROM saas_tenants t WHERE t.reseller_id = r.id) as total_tenants,
                           (SELECT COALESCE(SUM(t.price_charged), 0) FROM saas_tenants t WHERE t.reseller_id = r.id) as total_revenue
                    FROM saas_resellers r
                    ORDER BY r.id DESC
                )");
                sendJson(res, {{"success", true}, {"data", rows}, {"resellers", rows}});
                return;
            }

            if (action == "save_reseller") {
                int64_t rId = getValInt("id", 0);
                std::string compName = getVal("company_name");
                std::string contact = getVal("contact_name");
                std::string phone = getVal("phone");
                std::string email = getVal("email");
                std::string tier = getVal("tier", "silver");
                double discount = 25.0;
                try { discount = std::stod(getVal("discount_percent", "25.0")); } catch (...) {}
                std::string status = getVal("status", "active");
                std::string notes = getVal("note");
                if (notes.empty()) notes = getVal("notes");

                if (compName.empty() || contact.empty() || phone.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng nhập tên công ty/đại lý, người liên hệ và số điện thoại!"}}, 400);
                    return;
                }

                if (rId <= 0) {
                    std::string checkCode = getVal("reseller_code");
                    if (!checkCode.empty()) {
                        auto exist = db.queryRow("SELECT id FROM saas_resellers WHERE reseller_code = :rc", {{":rc", checkCode}});
                        if (!exist.is_null()) {
                            try {
                                if (exist["id"].is_number()) rId = exist["id"].get<int64_t>();
                                else if (exist["id"].is_string()) rId = std::stoll(exist["id"].get<std::string>());
                            } catch (...) {}
                        }
                    }
                }

                if (rId > 0) {
                    db.execute(R"(
                        UPDATE saas_resellers
                        SET company_name = :cn, contact_name = :ct, phone = :ph, email = :em,
                            tier = :tr, discount_percent = :dc, status = :st, notes = :nt
                        WHERE id = :id
                    )", {
                        {":cn", compName}, {":ct", contact}, {":ph", phone}, {":em", email},
                        {":tr", tier}, {":dc", discount}, {":st", status}, {":nt", notes}, {":id", rId}
                    });
                    sendJson(res, {{"success", true}, {"message", "Cập nhật thông tin đại lý thành công!"}, {"id", rId}});
                } else {
                    int64_t nextNum = db.queryScalar("SELECT COUNT(*) FROM saas_resellers").get<int64_t>() + 1;
                    char codeBuf[32];
                    std::snprintf(codeBuf, sizeof(codeBuf), "DL-%03lld", static_cast<long long>(nextNum));
                    std::string rCode = getVal("reseller_code", codeBuf);
                    if (rCode.empty()) rCode = codeBuf;

                    int64_t newId = db.execute(R"(
                        INSERT INTO saas_resellers (reseller_code, company_name, contact_name, phone, email, tier, discount_percent, wallet_balance, status, notes)
                        VALUES (:rc, :cn, :ct, :ph, :em, :tr, :dc, 0.0, :st, :nt)
                    )", {
                        {":rc", rCode}, {":cn", compName}, {":ct", contact}, {":ph", phone},
                        {":em", email}, {":tr", tier}, {":dc", discount}, {":st", status}, {":nt", notes}
                    });

                    recordAuditLog(db, 0, "SuperAdmin", "super_admin", "ADD_RESELLER", rCode,
                        "Tạo đại lý phân phối mới: " + compName + " (Chiết khấu: " + std::to_string(static_cast<int>(discount)) + "%)",
                        "{}", req.remote_addr);

                    sendJson(res, {
                        {"success", true},
                        {"message", "Tạo đại lý phân phối thành công (" + rCode + ")!"},
                        {"id", newId},
                        {"reseller_code", rCode}
                    });
                }
                return;
            }

            if (action == "deposit_reseller_wallet") {
                int64_t rId = getValInt("reseller_id", 0);
                double amount = 0.0;
                try { amount = std::stod(getVal("amount", "0")); } catch (...) {}
                std::string note = getVal("note", "Nạp tiền ví đại lý");

                if (rId <= 0 || amount <= 0) {
                    sendJson(res, {{"success", false}, {"message", "Đại lý hoặc số tiền nạp không hợp lệ (phải > 0)!"}}, 400);
                    return;
                }

                auto rRow = db.queryRow("SELECT * FROM saas_resellers WHERE id = :id", {{":id", rId}});
                if (rRow.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Đại lý không tồn tại!"}}, 404);
                    return;
                }

                double curBal = getValInt("wallet_balance", 0);
                if (rRow.contains("wallet_balance") && !rRow["wallet_balance"].is_null()) {
                    if (rRow["wallet_balance"].is_number()) curBal = rRow["wallet_balance"].get<double>();
                }
                double newBal = curBal + amount;
                std::string rCode = getString(rRow, "reseller_code", "");
                std::string compName = getString(rRow, "company_name", "");

                db.beginTransaction();
                db.execute("UPDATE saas_resellers SET wallet_balance = :nb WHERE id = :id",
                    {{":nb", newBal}, {":id", rId}});

                db.execute(R"(
                    INSERT INTO saas_reseller_wallet_logs
                    (reseller_id, reseller_code, trans_type, amount, balance_before, balance_after, note, created_by)
                    VALUES (:rid, :rc, 'deposit', :am, :bb, :ba, :nt, 'superadmin')
                )", {
                    {":rid", rId}, {":rc", rCode}, {":am", amount},
                    {":bb", curBal}, {":ba", newBal}, {":nt", note}
                });

                recordAuditLog(db, 0, "SuperAdmin", "super_admin", "WALLET_DEPOSIT", rCode,
                    "Nạp " + std::to_string(static_cast<int64_t>(amount)) + "đ vào ví đại lý " + compName + " (Số dư mới: " + std::to_string(static_cast<int64_t>(newBal)) + "đ)",
                    "{}", req.remote_addr);
                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", "Nạp tiền vào ví đại lý thành công!"},
                    {"wallet_balance", newBal}
                });
                return;
            }

            if (action == "get_reseller_wallet_logs") {
                int64_t rId = getValInt("reseller_id", 0);
                std::string sql = "SELECT * FROM saas_reseller_wallet_logs WHERE 1=1";
                std::vector<std::pair<std::string, json>> params;
                if (rId > 0) {
                    sql += " AND reseller_id = :rid";
                    params.push_back({":rid", rId});
                }
                sql += " ORDER BY id DESC LIMIT 100";
                auto rows = db.query(sql, params);
                sendJson(res, {{"success", true}, {"data", rows}, {"logs", rows}});
                return;
            }

            if (action == "reseller_issue_license") {
                int64_t rId = getValInt("reseller_id", 0);
                std::string storeName = getVal("store_name");
                std::string planCode = getVal("plan_code", "full_fb");
                std::string period = getVal("period", "lifetime"); // 1m, 1y, lifetime
                std::string ownerPhone = getVal("owner_phone");

                if (rId <= 0 || storeName.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng chọn đại lý và nhập tên quán khách hàng!"}}, 400);
                    return;
                }

                auto rRow = db.queryRow("SELECT * FROM saas_resellers WHERE id = :id AND status = 'active'", {{":id", rId}});
                if (rRow.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Đại lý không tồn tại hoặc đã bị tạm ngưng hoạt động!"}}, 403);
                    return;
                }

                double curBal = 0.0;
                if (rRow.contains("wallet_balance") && !rRow["wallet_balance"].is_null()) {
                    if (rRow["wallet_balance"].is_number()) curBal = rRow["wallet_balance"].get<double>();
                }
                double discount = 25.0;
                if (rRow.contains("discount_percent") && !rRow["discount_percent"].is_null()) {
                    if (rRow["discount_percent"].is_number()) discount = rRow["discount_percent"].get<double>();
                }

                // Tính giá niêm yết theo gói & thời hạn
                double msrp = 4990000.0; // Mặc định gói Combo F&B Trọn đời
                std::string planName = "Trọn Gói F&B Full Modules";
                std::string expireDate = "2099-12-31";
                int days = 36500;

                if (period == "1m") {
                    msrp = 399000.0;
                    days = 31;
                    time_t tExp = time(nullptr) + (days * 86400);
                    char b[32]; strftime(b, sizeof(b), "%Y-%m-%d", localtime(&tExp)); expireDate = b;
                } else if (period == "1y") {
                    msrp = 3990000.0;
                    days = 365;
                    time_t tExp = time(nullptr) + (days * 86400);
                    char b[32]; strftime(b, sizeof(b), "%Y-%m-%d", localtime(&tExp)); expireDate = b;
                }

                double actualPrice = (msrp * (100.0 - discount)) / 100.0;

                if (curBal < actualPrice) {
                    sendJson(res, {
                        {"success", false},
                        {"message", "Số dư ví đại lý không đủ (" + std::to_string(static_cast<int64_t>(curBal)) + "đ < " + std::to_string(static_cast<int64_t>(actualPrice)) + "đ). Vui lòng nạp thêm tiền vào ví!"}
                    }, 400);
                    return;
                }

                // Sinh License Key mới (CBNX-XXXX-XXXX-XXXX-XXXX)
                static constexpr char kAlnumChars[] = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
                std::string newKey = generateRandomLicenseKey("CBNX", kAlnumChars, sizeof(kAlnumChars) - 1);
                int64_t nextTid = db.queryScalar("SELECT COUNT(*) FROM saas_tenants").get<int64_t>() + 1;
                char tCodeBuf[32];
                std::snprintf(tCodeBuf, sizeof(tCodeBuf), "GP%03lld", static_cast<long long>(nextTid));
                std::string tCode = tCodeBuf;

                std::string rCode = getString(rRow, "reseller_code", "");
                std::string compName = getString(rRow, "company_name", "");
                double newBal = curBal - actualPrice;

                db.beginTransaction();
                // 1. Trừ tiền ví đại lý
                db.execute("UPDATE saas_resellers SET wallet_balance = :nb WHERE id = :id",
                    {{":nb", newBal}, {":id", rId}});

                // 2. Ghi nhật ký biến động ví
                db.execute(R"(
                    INSERT INTO saas_reseller_wallet_logs
                    (reseller_id, reseller_code, trans_type, amount, balance_before, balance_after, license_key, store_name, note, created_by)
                    VALUES (:rid, :rc, 'license_deduct', :am, :bb, :ba, :lk, :sn, :nt, :cb)
                )", {
                    {":rid", rId}, {":rc", rCode}, {":am", actualPrice},
                    {":bb", curBal}, {":ba", newBal}, {":lk", newKey}, {":sn", storeName},
                    {":nt", "Cấp bản quyền " + planName + " (" + period + ") cho quán " + storeName},
                    {":cb", compName}
                });

                std::string allMods = R"(["pos_core","vietqr_payment","qr_customer_order","qr_table_order","advertising_promotions","promo_voucher_engine","kitchen_kds","inventory_recipes","ai_invoice_ocr","ai_dish_studio","advanced_reports","staff_shifts","staff_kpi","finance_reports","cloud_sync_backup","mod_media_stream","mod_network_qos","mod_card_payment"])";
                std::string cycle = (period == "1m") ? "monthly" : ((period == "lifetime") ? "lifetime" : "yearly");

                // 3. Tạo bản ghi cửa hàng saas_tenants
                int64_t newTenantId = db.execute(R"(
                    INSERT INTO saas_tenants
                    (tenant_code, store_name, owner_name, phone, email, address,
                     plan_id, plan_name, billing_cycle, subscription_status, start_date, expire_date,
                     enabled_modules, license_key, note, logo_path, reseller_id, price_charged, created_at, updated_at)
                    VALUES (:tc, :sn, 'Chủ Quán', :ph, '', '', 1, :pn, :cycle, 'active', date('now'), :ed, :emods, :lk, :nt, '', :rid, :pcost, datetime('now'), datetime('now'))
                )", {
                    {":tc", tCode}, {":sn", storeName}, {":ph", ownerPhone},
                    {":pn", planName}, {":cycle", cycle}, {":ed", expireDate},
                    {":emods", allMods}, {":lk", newKey},
                    {":nt", "Đại lý " + compName + " (" + rCode + ") cấp bản quyền"},
                    {":rid", rId}, {":pcost", actualPrice}
                });

                recordAuditLog(db, 0, compName, "reseller", "ISSUE_LICENSE", tCode,
                    "Đại lý " + compName + " (" + rCode + ") cấp bản quyền " + newKey + " cho quán " + storeName + " (Trừ ví: " + std::to_string(static_cast<int64_t>(actualPrice)) + "đ)",
                    "{}", req.remote_addr);
                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã cấp bản quyền thành công cho quán " + storeName + "!"},
                    {"tenant_id", newTenantId},
                    {"tenant_code", tCode},
                    {"license_key", newKey},
                    {"expire_date", expireDate},
                    {"price_charged", actualPrice},
                    {"wallet_balance", newBal}
                });
                return;
            }
            if (action == "push_store_update") {
                std::string targetCode = getString(body, "tenant_code", "ALL");
                std::string mode = getString(body, "mode", "notify"); // "notify" | "ota_update"
                std::string title = getString(body, "title", "Thông báo từ Hệ thống CyberNexus");
                std::string message = getString(body, "message", "");
                bool autoApply = body.value("auto_apply", false);
                std::string reqVersion = getString(body, "version", "");

                fs::path updatesDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "updates";
                fs::path manifestPath = updatesDir / "manifest.json";
                std::string downloadPath = "/api/updates/download";
                if (!reqVersion.empty() && reqVersion.find("..") == std::string::npos && reqVersion.find('/') == std::string::npos && reqVersion.find('\\') == std::string::npos) {
                    fs::path archMf = updatesDir / "archive" / reqVersion / "manifest.json";
                    fs::path archZip = updatesDir / "archive" / reqVersion / "patch.zip";
                    if (fs::exists(archMf) && fs::exists(archZip)) {
                        manifestPath = archMf;
                        downloadPath = "/api/updates/download?version=" + reqVersion;
                    }
                }

                json manifest = json::object();
                if (fs::exists(manifestPath)) {
                    try {
                        std::ifstream mf(manifestPath.string());
                        mf >> manifest;
                    } catch (...) {}
                }

                if (mode == "ota_update") {
                    std::string chosenVer = manifest.value("version", reqVersion);
                    std::string patchTenant = manifest.value("target_tenant", "");
                    if (patchTenant.empty()) {
                        auto dashPos = chosenVer.rfind('-');
                        if (dashPos != std::string::npos && dashPos + 1 < chosenVer.size()) {
                            patchTenant = chosenVer.substr(dashPos + 1);
                        }
                    }
                    if ((targetCode.empty() || targetCode == "ALL") && !patchTenant.empty()) {
                        sendError(res, "Không thể đẩy bản vá riêng [" + patchTenant + "] cho toàn bộ cửa hàng (ALL)!", 400);
                        return;
                    }
                    if (!targetCode.empty() && targetCode != "ALL" && !patchTenant.empty() && patchTenant != targetCode) {
                        sendError(res, "Bản vá v" + chosenVer + " dành riêng cho [" + patchTenant + "], không khớp với [" + targetCode + "]!", 400);
                        return;
                    }
                    if (manifest.value("release_status", "") == "revoked") {
                        sendError(res, "Bản vá v" + chosenVer + " đã bị THU HỒI (revoked), không thể đẩy xuống cửa hàng!", 400);
                        return;
                    }
                    // Ghi nhận mã quán đã được đẩy & trạng thái vòng đời (pilot / published) vào manifest + DB ota_store_rollouts
                    try {
                        db.execute("CREATE TABLE IF NOT EXISTS ota_releases (version TEXT PRIMARY KEY, release_status TEXT DEFAULT 'draft', scope TEXT DEFAULT 'global', target_tenant TEXT DEFAULT '', sha256 TEXT DEFAULT '', size_bytes INTEGER DEFAULT 0, notes TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))");
                        db.execute("CREATE TABLE IF NOT EXISTS ota_store_rollouts (id INTEGER PRIMARY KEY AUTOINCREMENT, version TEXT NOT NULL, tenant_id INTEGER NOT NULL, tenant_code TEXT NOT NULL, status TEXT DEFAULT 'queued', detail TEXT DEFAULT '', pushed_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), UNIQUE(version, tenant_id))");
                        json pushedArr = manifest.contains("pushed_stores") && manifest["pushed_stores"].is_array()
                            ? manifest["pushed_stores"] : json::array();
                        std::string markCode = (targetCode.empty() || targetCode == "ALL") ? "ALL" : targetCode;
                        bool existsMark = false;
                        for (const auto& item : pushedArr) {
                            if (item.is_string() && item.get<std::string>() == markCode) { existsMark = true; break; }
                        }
                        if (!existsMark) pushedArr.push_back(markCode);
                        manifest["pushed_stores"] = pushedArr;
                        if (markCode == "ALL") {
                            manifest["release_status"] = "published";
                            manifest["auto_publish"] = true;
                        } else if (manifest.value("release_status", "draft") == "draft") {
                            manifest["release_status"] = "pilot";
                        }
                        std::ofstream mfOut(manifestPath.string(), std::ios::binary | std::ios::trunc);
                        if (mfOut) mfOut << manifest.dump(2) << "\n";
                        db.execute(
                            "INSERT INTO ota_releases (version, release_status, scope, target_tenant, sha256, size_bytes, notes, updated_at) "
                            "VALUES (:v, :st, :sc, :tt, :sh, :sz, :nt, datetime('now')) "
                            "ON CONFLICT(version) DO UPDATE SET release_status = :st, updated_at = datetime('now')",
                            {{":v", chosenVer}, {":st", manifest.value("release_status", "pilot")}, {":sc", patchTenant.empty() ? "global" : "store"},
                             {":tt", patchTenant}, {":sh", manifest.value("sha256", "")}, {":sz", manifest.value("size_bytes", int64_t(0))}, {":nt", manifest.value("release_notes", "")}}
                        );
                        // OTA-04: Sync published global release to updates/manifest.json & updates/patch_latest.zip
                        if (manifest.value("release_status", "") == "published" && patchTenant.empty()) {
                            std::error_code ecCopy;
                            fs::path archZip = updatesDir / "archive" / chosenVer / "patch.zip";
                            if (fs::exists(archZip, ecCopy)) {
                                fs::copy_file(archZip, updatesDir / "patch_latest.zip", fs::copy_options::overwrite_existing, ecCopy);
                            }
                            std::ofstream liveMf((updatesDir / "manifest.json").string(), std::ios::trunc);
                            if (liveMf) liveMf << manifest.dump(2) << "\n";
                        }
                    } catch (...) {}
                }

                std::string cmdType = (mode == "ota_update") ? "OTA_UPDATE" : "STORE_NOTIFY";
                json payload = {
                    {"mode", mode},
                    {"title", title},
                    {"message", message},
                    {"auto_apply", autoApply},
                    {"version", manifest.value("version", reqVersion.empty() ? "2026.11.16" : reqVersion)},
                    {"download_path", downloadPath},
                    {"files", manifest.value("files", json::array())},
                    {"pushed_at", StoreTunnelManager::nowMs()}
                };

                json targets;
                if (targetCode.empty() || targetCode == "ALL") {
                    targets = db.query("SELECT id, tenant_code, store_name FROM saas_tenants WHERE subscription_status != 'deleted'");
                } else {
                    targets = db.query("SELECT id, tenant_code, store_name FROM saas_tenants WHERE tenant_code = :tc AND subscription_status != 'deleted'", {{":tc", targetCode}});
                }

                int totalTargets = 0;
                int onlineDelivered = 0;
                int queuedOffline = 0;
                for (const auto& t : targets) {
                    int64_t tid = getInt(t, "id", 0);
                    if (tid <= 0) continue;
                    totalTargets++;
                    bool isOnline = StoreTunnelManager::instance().enqueueCommand(tid, cmdType, payload, true);
                    if (isOnline) onlineDelivered++;
                    else queuedOffline++;
                    if (mode == "ota_update") {
                        try {
                            std::string tc = t.value("tenant_code", "");
                            db.execute(
                                "INSERT INTO ota_store_rollouts (version, tenant_id, tenant_code, status, detail, pushed_at, updated_at) "
                                "VALUES (:v, :tid, :tc, :st, :dt, datetime('now'), datetime('now')) "
                                "ON CONFLICT(version, tenant_id) DO UPDATE SET status = :st, detail = :dt, updated_at = datetime('now')",
                                {{":v", payload.value("version", "")}, {":tid", tid}, {":tc", tc},
                                 {":st", isOnline ? "delivered" : "queued"}, {":dt", isOnline ? "Tunnel delivered" : "Queued offline"}}
                            );
                        } catch (...) {}
                    }
                }
                if (mode == "ota_update") {
                    recordAuditLog(db, 0, "SuperAdmin", "super_admin", "OTA_PUSH", targetCode.empty() ? "ALL" : targetCode,
                        "Đẩy OTA v" + payload.value("version", "") + " tới " + std::to_string(totalTargets) + " cửa hàng (" + std::to_string(onlineDelivered) + " online)",
                        payload.dump(), req.remote_addr);
                }

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã đẩy " + std::string(mode == "ota_update" ? "bản cập nhật OTA" : "thông báo") + " tới " + std::to_string(totalTargets) + " cửa hàng (" + std::to_string(onlineDelivered) + " Online tức thì, " + std::to_string(queuedOffline) + " chờ kết nối)."},
                    {"total_targets", totalTargets},
                    {"online_delivered", onlineDelivered},
                    {"queued_offline", queuedOffline},
                    {"payload", payload}
                });
                return;
            }
        }

        if (action == "list_patches") {
            fs::path updatesDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "updates";
            fs::path archiveDir = updatesDir / "archive";
            fs::create_directories(archiveDir);

            // Auto-archive active patch_latest.zip if not yet in archive/
            std::string activeVer;
            fs::path activeManifestPath = updatesDir / "manifest.json";
            fs::path activeZipPath = updatesDir / "patch_latest.zip";
            if (fs::exists(activeManifestPath)) {
                try {
                    json mf;
                    std::ifstream in(activeManifestPath.string());
                    in >> mf;
                    activeVer = mf.value("version", "");
                    if (!activeVer.empty() && fs::exists(activeZipPath)) {
                        fs::path vDir = archiveDir / activeVer;
                        if (!fs::exists(vDir / "manifest.json") || !fs::exists(vDir / "patch.zip")) {
                            fs::create_directories(vDir);
                            fs::copy_file(activeManifestPath, vDir / "manifest.json", fs::copy_options::overwrite_existing);
                            fs::copy_file(activeZipPath, vDir / "patch.zip", fs::copy_options::overwrite_existing);
                        }
                    }
                } catch (...) {}
            }

            json patches = json::array();
            if (fs::exists(archiveDir) && fs::is_directory(archiveDir)) {
                for (const auto& entry : fs::directory_iterator(archiveDir)) {
                    if (!entry.is_directory()) continue;
                    fs::path mfPath = entry.path() / "manifest.json";
                    fs::path zipPath = entry.path() / "patch.zip";
                    if (!fs::exists(mfPath) || !fs::exists(zipPath)) continue;
                    try {
                        json mf;
                        std::ifstream in(mfPath.string());
                        in >> mf;
                        std::string ver = mf.value("version", entry.path().filename().string());
                        std::string targetTenant = mf.value("target_tenant", "");
                        if (targetTenant.empty()) {
                            auto dashPos = ver.rfind('-');
                            if (dashPos != std::string::npos && dashPos + 1 < ver.size()) {
                                targetTenant = ver.substr(dashPos + 1);
                            }
                        }
                        bool autoPub = targetTenant.empty() && mf.value("auto_publish", false);
                        json pushedArr = (mf.contains("pushed_stores") && mf["pushed_stores"].is_array()) ? mf["pushed_stores"] : json::array();
                        std::string relStatus = mf.value("release_status", "");
                        if (relStatus.empty()) {
                            if (autoPub) relStatus = "published";
                            else if (!pushedArr.empty()) {
                                bool hasNonAll = false;
                                for (const auto& s : pushedArr) { if (s.is_string() && s.get<std::string>() != "ALL") hasNonAll = true; }
                                relStatus = hasNonAll ? "pilot" : "draft";
                            } else {
                                relStatus = "draft";
                            }
                        }
                        if (relStatus == "revoked") autoPub = false;
                        patches.push_back({
                            {"version", ver},
                            {"title", mf.value("title", "Bản vá " + ver)},
                            {"notes", mf.value("release_notes", mf.value("notes", ""))},
                            {"created_at", mf.value("release_date", mf.value("created_at", ""))},
                            {"target_tenant", targetTenant},
                            {"scope", targetTenant.empty() ? "global" : "store"},
                            {"auto_publish", autoPub},
                            {"release_status", relStatus},
                            {"pushed_stores", pushedArr},
                            {"files_count", mf.contains("files") && mf["files"].is_array() ? mf["files"].size() : 0},
                            {"size_bytes", static_cast<int64_t>(fs::file_size(zipPath))},
                            {"is_active", (!activeVer.empty() && ver == activeVer && autoPub)}
                        });
                    } catch (...) {}
                }
            }
            std::sort(patches.begin(), patches.end(), [](const json& a, const json& b) {
                std::string va = a.value("version", ""), vb = b.value("version", "");
                if (va != vb) return va > vb;
                return a.value("created_at", "") > b.value("created_at", "");
            });
            sendJson(res, {
                {"success", true},
                {"active_version", activeVer},
                {"patches", patches}
            });
            return;
        }

        if (action == "activate_patch") {
            std::string ver = getString(body, "version");
            if (ver.empty() || ver.find("..") != std::string::npos || ver.find('/') != std::string::npos || ver.find('\\') != std::string::npos) {
                sendError(res, "Phiên bản bản vá không hợp lệ!", 400);
                return;
            }
            fs::path updatesDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "updates";
            fs::path vDir = updatesDir / "archive" / ver;
            fs::path mfSrc = vDir / "manifest.json";
            fs::path zipSrc = vDir / "patch.zip";
            if (!fs::exists(mfSrc) || !fs::exists(zipSrc)) {
                sendError(res, "Không tìm thấy bản vá v" + ver + " trong kho lưu trữ!", 404);
                return;
            }
            json mfJson;
            {
                std::ifstream in(mfSrc.string());
                in >> mfJson;
            }
            std::string patchTenant = mfJson.value("target_tenant", "");
            if (patchTenant.empty()) {
                auto dashPos = ver.rfind('-');
                if (dashPos != std::string::npos && dashPos + 1 < ver.size()) patchTenant = ver.substr(dashPos + 1);
            }
            if (!patchTenant.empty()) {
                sendError(res, "Không thể duyệt bản vá riêng của quán [" + patchTenant + "] thành bản đại trà toàn hệ thống!", 400);
                return;
            }
            mfJson["auto_publish"] = true;
            mfJson["release_status"] = "published";
            {
                std::ofstream outArch(mfSrc.string(), std::ios::binary | std::ios::trunc);
                outArch << mfJson.dump(2) << "\n";
                std::ofstream out((updatesDir / "manifest.json").string(), std::ios::binary | std::ios::trunc);
                out << mfJson.dump(2) << "\n";
            }
            fs::copy_file(zipSrc, updatesDir / "patch_latest.zip", fs::copy_options::overwrite_existing);
            recordAuditLog(db, 0, "SuperAdmin", "super_admin", "OTA_PUBLISH", ver,
                "Duyệt & phát hành đại trà bản vá OTA v" + ver, mfJson.dump(), req.remote_addr);
            sendJson(res, {
                {"success", true},
                {"active_version", ver},
                {"message", "Đã duyệt & phát hành bản vá v" + ver + " cho phép các quán tự quét OTA!"}
            });
            return;
        }

        if (action == "revoke_patch") {
            std::string ver = getString(body, "version");
            if (ver.empty() || ver.find("..") != std::string::npos || ver.find('/') != std::string::npos || ver.find('\\') != std::string::npos) {
                sendError(res, "Phiên bản bản vá không hợp lệ!", 400);
                return;
            }
            fs::path updatesDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "updates";
            fs::path mfSrc = updatesDir / "archive" / ver / "manifest.json";
            if (!fs::exists(mfSrc)) {
                sendError(res, "Không tìm thấy bản vá v" + ver, 404);
                return;
            }
            json mfJson;
            { std::ifstream in(mfSrc.string()); in >> mfJson; }
            mfJson["auto_publish"] = false;
            mfJson["release_status"] = "revoked";
            { std::ofstream out(mfSrc.string(), std::ios::binary | std::ios::trunc); out << mfJson.dump(2) << "\n"; }
            if (fs::exists(updatesDir / "manifest.json")) {
                try {
                    json curMf;
                    { std::ifstream in((updatesDir / "manifest.json").string()); in >> curMf; }
                    if (curMf.value("version", "") == ver) {
                        curMf["auto_publish"] = false;
                        curMf["release_status"] = "revoked";
                        std::ofstream out((updatesDir / "manifest.json").string(), std::ios::binary | std::ios::trunc);
                        out << curMf.dump(2) << "\n";
                    }
                } catch (...) {}
            }
            recordAuditLog(db, 0, "SuperAdmin", "super_admin", "OTA_REVOKE", ver,
                "Thu hồi khẩn cấp bản vá OTA v" + ver, mfJson.dump(), req.remote_addr);
            sendJson(res, {{"success", true}, {"message", "Đã THU HỒI (Revoke) bản vá v" + ver + "! Các quán sẽ không thể tải bản này."}});
            return;
        }

        if (action == "delete_patch") {
            std::string ver = getString(body, "version");
            if (ver.empty() || ver.find("..") != std::string::npos || ver.find('/') != std::string::npos || ver.find('\\') != std::string::npos) {
                sendError(res, "Phiên bản bản vá không hợp lệ!", 400);
                return;
            }
            fs::path updatesDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "updates";
            std::string activeVer;
            if (fs::exists(updatesDir / "manifest.json")) {
                try {
                    json mf;
                    std::ifstream in((updatesDir / "manifest.json").string());
                    in >> mf;
                    activeVer = mf.value("version", "");
                } catch (...) {}
            }
            if (!activeVer.empty() && ver == activeVer) {
                sendError(res, "Không thể xóa bản vá đang phát hành hiện tại!", 400);
                return;
            }
            fs::path vDir = updatesDir / "archive" / ver;
            if (fs::exists(vDir)) {
                fs::remove_all(vDir);
            }
            sendJson(res, {{"success", true}, {"message", "Đã xóa bản vá v" + ver + " khỏi kho lưu trữ."}});
            return;
        }

        if (action == "get_tenant_theme") {
            std::string tc = getString(body, "tenant_code", "");
            if (tc.empty() && req.has_param("tenant_code")) tc = req.get_param_value("tenant_code");
            auto t = db.queryRow("SELECT id, tenant_code, store_name, theme_json FROM saas_tenants WHERE tenant_code = :tc LIMIT 1", {{":tc", tc}});
            if (t.is_null()) { sendError(res, "Không tìm thấy cửa hàng!", 404); return; }
            sendJson(res, {{"success", true}, {"tenant_code", tc}, {"store_name", getString(t, "store_name", "")}, {"theme_json", getString(t, "theme_json", "")}});
            return;
        }

        if (action == "save_tenant_theme") {
            std::string tc = getString(body, "tenant_code", "");
            std::string tj = body.contains("theme_json")
                ? (body["theme_json"].is_string() ? body["theme_json"].get<std::string>() : body["theme_json"].dump())
                : "";
            if (tc.empty() || tj.empty()) { sendError(res, "Thiếu mã quán hoặc dữ liệu theme_json!", 400); return; }
            auto t = db.queryRow("SELECT id, store_name FROM saas_tenants WHERE tenant_code = :tc LIMIT 1", {{":tc", tc}});
            if (t.is_null()) { sendError(res, "Không tìm thấy cửa hàng!", 404); return; }
            int64_t tid = getInt(t, "id", 0);
            try { db.execute("ALTER TABLE saas_tenants ADD COLUMN theme_json TEXT DEFAULT ''"); } catch (...) {}
            db.execute("UPDATE saas_tenants SET theme_json = :tj WHERE id = :id", {{":tj", tj}, {":id", tid}});
            bool pushed = StoreTunnelManager::instance().enqueueCommand(tid, "SYNC_THEME", {{"theme_json", tj}}, true);
            recordAuditLog(db, 0, "SuperAdmin", "super_admin", "SYNC_THEME", tc, "Cập nhật giao diện Theme Studio cho " + getString(t, "store_name", tc), "{}", req.remote_addr);
            sendJson(res, {
                {"success", true},
                {"online_delivered", pushed},
                {"message", pushed
                    ? ("Đã lưu & đẩy giao diện mới xuống quán " + getString(t, "store_name", tc) + " ngay lập tức!")
                    : ("Đã lưu giao diện cho quán " + getString(t, "store_name", tc) + " (sẽ tự đồng bộ khi quán Online hoặc khi đóng gói lại).")}
            });
            return;
        }

        if (action == "get_ai_vault") {
            ensureMasterAiTables(db);
            expireOutdatedGeminiKeys(db);
            json keys = db.query(R"(
                SELECT k.id, k.label, k.key_masked, COALESCE(k.provider, 'gemini') as provider, k.tier, k.status, k.priority,
                       k.monthly_credit_limit, k.daily_request_limit, k.expires_at,
                       k.model_count, k.last_checked_at, k.last_used_at, k.last_error,
                       k.created_at, k.updated_at,
                       CASE WHEN COALESCE(k.expires_at, '') != ''
                            THEN CAST(julianday(date(k.expires_at)) - julianday(date('now', 'localtime')) AS INTEGER)
                            ELSE NULL END as days_until_expiry,
                       COALESCE(SUM(CASE WHEN l.status = 'ok' AND substr(l.created_at, 1, 7) = strftime('%Y-%m', 'now', 'localtime') THEN l.credits_used ELSE 0 END), 0) as credits_month,
                       COALESCE(SUM(CASE WHEN l.status = 'ok' AND substr(l.created_at, 1, 7) = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END), 0) as calls_month,
                       COALESCE(SUM(CASE WHEN l.status = 'ok' AND substr(l.created_at, 1, 10) = date('now', 'localtime') THEN 1 ELSE 0 END), 0) as calls_today,
                       COALESCE(SUM(CASE WHEN l.status != 'ok' AND substr(l.created_at, 1, 7) = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END), 0) as errors_month
                FROM master_ai_keys k
                LEFT JOIN ai_usage_logs l ON l.key_id = k.id
                GROUP BY k.id
                ORDER BY CASE k.status WHEN 'active' THEN 0 WHEN 'standby' THEN 1 WHEN 'rate_limited' THEN 2 WHEN 'disabled' THEN 3 WHEN 'expired' THEN 4 ELSE 5 END, k.priority ASC, k.id DESC
            )");
            json activeKey = json();
            for (const auto& k : keys) {
                if (k.value("status", "") == "active") { activeKey = k; break; }
            }
            bool hasKey = !activeKey.is_null();
            std::string updatedAt = hasKey ? activeKey.value("updated_at", "") : "";
            json keyHistory = db.query(R"(
                SELECT id, key_id, key_label, key_masked, event_type, detail, actor, created_at
                FROM master_ai_key_history
                ORDER BY id DESC
                LIMIT 80
            )");
            int64_t totalMonth = db.queryScalar(
                "SELECT COUNT(*) FROM ai_usage_logs WHERE status = 'ok' AND substr(created_at, 1, 7) = strftime('%Y-%m', 'now', 'localtime')"
            ).get<int64_t>();
            int64_t totalCreditsMonth = db.queryScalar(
                "SELECT COALESCE(SUM(credits_used), 0) FROM ai_usage_logs WHERE status = 'ok' AND substr(created_at, 1, 7) = strftime('%Y-%m', 'now', 'localtime')"
            ).get<int64_t>();
            json byStore = db.query(R"(
                SELECT tenant_code, store_name, COUNT(*) as calls,
                       COALESCE(SUM(credits_used), 0) as credits_used,
                       SUM(CASE WHEN action = 'parse_invoice' THEN 1 ELSE 0 END) as ocr_calls,
                       SUM(CASE WHEN action = 'generate_dish_image' THEN 1 ELSE 0 END) as dish_calls,
                       SUM(CASE WHEN action = 'generate_slide' THEN 1 ELSE 0 END) as slide_calls,
                       MAX(created_at) as last_used_at
                FROM ai_usage_logs
                WHERE status = 'ok' AND substr(created_at, 1, 7) = strftime('%Y-%m', 'now', 'localtime')
                GROUP BY tenant_code, store_name
                ORDER BY credits_used DESC, calls DESC
            )");
            json storeQuotas = db.query(R"(
                SELECT t.id as tenant_id, t.tenant_code, t.store_name, t.subscription_status,
                       COALESCE(t.ai_monthly_quota, 50) as ai_monthly_quota,
                       COALESCE(t.ai_bonus_credits, 0) as ai_bonus_credits,
                       COALESCE(SUM(CASE WHEN l.status = 'ok' AND COALESCE(l.quota_bucket, 'monthly') = 'monthly' THEN l.credits_used ELSE 0 END), 0) as monthly_used,
                       COALESCE(SUM(CASE WHEN l.status = 'ok' THEN l.credits_used ELSE 0 END), 0) as total_credits_month,
                       COALESCE(SUM(CASE WHEN l.status = 'ok' THEN 1 ELSE 0 END), 0) as calls_month,
                       COALESCE(SUM(CASE WHEN l.status = 'ok' AND l.action = 'parse_invoice' THEN 1 ELSE 0 END), 0) as ocr_calls,
                       COALESCE(SUM(CASE WHEN l.status = 'ok' AND l.action = 'generate_dish_image' THEN 1 ELSE 0 END), 0) as dish_calls,
                       COALESCE(SUM(CASE WHEN l.status = 'ok' AND l.action = 'generate_slide' THEN 1 ELSE 0 END), 0) as slide_calls,
                       MAX(CASE WHEN l.status = 'ok' THEN l.created_at ELSE NULL END) as last_used_at
                FROM saas_tenants t
                LEFT JOIN ai_usage_logs l
                  ON l.tenant_id = t.id
                 AND substr(l.created_at, 1, 7) = strftime('%Y-%m', 'now', 'localtime')
                GROUP BY t.id
                ORDER BY total_credits_month DESC, t.id ASC
            )");
            sendJson(res, {
                {"success", true},
                {"has_gemini_key", hasKey},
                {"active_key", activeKey},
                {"updated_at", updatedAt},
                {"keys", keys},
                {"key_history", keyHistory},
                {"total_calls_month", totalMonth},
                {"total_credits_month", totalCreditsMonth},
                {"credit_costs", {{"parse_invoice", 1}, {"generate_dish_image", 2}, {"generate_slide", 3}}},
                {"usage_by_store", byStore},
                {"store_quotas", storeQuotas}
            });
            return;
        }

        if (action == "update_store_ai_quota") {
            ensureMasterAiTables(db);
            int64_t tid = getInt(body, "tenant_id", 0);
            if (tid <= 0) {
                sendError(res, "Thiếu tenant_id hợp lệ!", 400);
                return;
            }
            auto tenant = db.queryRow("SELECT id, tenant_code, store_name, COALESCE(ai_monthly_quota, 50) as ai_monthly_quota, COALESCE(ai_bonus_credits, 0) as ai_bonus_credits FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
            if (tenant.is_null()) {
                sendError(res, "Không tìm thấy quán trên Master!", 404);
                return;
            }
            int64_t monthlyQuota = body.contains("ai_monthly_quota") && body["ai_monthly_quota"].is_number()
                ? body["ai_monthly_quota"].get<int64_t>()
                : getInt(tenant, "ai_monthly_quota", 50);
            if (monthlyQuota < -1) monthlyQuota = -1;

            int64_t bonusCredits = getInt(tenant, "ai_bonus_credits", 0);
            if (body.contains("ai_bonus_credits") && body["ai_bonus_credits"].is_number()) {
                bonusCredits = std::max<int64_t>(0, body["ai_bonus_credits"].get<int64_t>());
            } else if (body.contains("add_bonus_credits") && body["add_bonus_credits"].is_number()) {
                bonusCredits = std::max<int64_t>(0, bonusCredits + body["add_bonus_credits"].get<int64_t>());
            }

            db.execute(
                "UPDATE saas_tenants SET ai_monthly_quota = :mq, ai_bonus_credits = :bc WHERE id = :id",
                {{":mq", monthlyQuota}, {":bc", bonusCredits}, {":id", tid}}
            );
            auto updatedTenant = db.queryRow("SELECT * FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
            sendJson(res, {
                {"success", true},
                {"message", "Đã cập nhật hạn mức AI Credit cho quán " + getString(tenant, "store_name", getString(tenant, "tenant_code")) + "!"},
                {"ai_quota", buildTenantAiQuotaSnapshot(db, updatedTenant)}
            });
            return;
        }

        if (action == "verify_save_gemini_key") {
            ensureMasterAiTables(db);
            std::string apiKey = getString(body, "gemini_api_key");
            if (apiKey.empty() || apiKey.find("•••") != std::string::npos || apiKey.find("***") != std::string::npos) {
                sendError(res, "Vui lòng dán mã Gemini API Key hợp lệ!", 400);
                return;
            }
            std::string provider = getString(body, "provider", "gemini");
            if (provider != "gemini" && provider != "huggingface" && provider != "pollinations" && provider != "openai") {
                provider = "gemini";
            }
            int modelCount = 0;
            std::vector<std::string> samples;
            std::string err;
            if (!SaleApp::AI::verifyProviderKey(provider, apiKey, modelCount, samples, err)) {
                sendError(res, "Key không hợp lệ hoặc bị từ chối: " + err, 400);
                return;
            }
            std::string label = getString(body, "label", provider == "gemini" ? "Gemini Key" : ("Image Key (" + provider + ")"));
            if (label.empty()) label = "AI Key";
            std::string tier = getString(body, "tier", "free");
            if (tier != "payg" && tier != "free") tier = "free";
            int64_t monthlyLimit = std::max<int64_t>(0, getInt(body, "monthly_credit_limit", 0));
            int64_t dailyReqLimit = std::max<int64_t>(0, getInt(body, "daily_request_limit", 0));
            std::string expiresAt = getString(body, "expires_at", "");
            int64_t priority = getInt(body, "priority", 100);
            bool setActive = body.contains("set_active") ? body.value("set_active", true) : true;
            if (provider != "gemini") setActive = false; // Non-Gemini keys serve as standby image providers
            std::string masked = maskGeminiKey(apiKey);

            // Prevent exact duplicate key
            auto dup = db.queryRow("SELECT id, label FROM master_ai_keys WHERE api_key = :k LIMIT 1", {{":k", apiKey}});
            if (!dup.is_null()) {
                int64_t dupId = dup.value("id", int64_t(0));
                if (setActive) {
                    db.execute("UPDATE master_ai_keys SET status = 'standby' WHERE status = 'active' AND COALESCE(provider, 'gemini') = 'gemini' AND id != :id", {{":id", dupId}});
                }
                db.execute(
                    "UPDATE master_ai_keys SET label = :lbl, provider = :prv, tier = :tr, monthly_credit_limit = :mcl, daily_request_limit = :drl, "
                    "expires_at = :exp, priority = :pri, status = :st, model_count = :mc, last_checked_at = datetime('now', 'localtime'), "
                    "last_error = '', updated_at = datetime('now', 'localtime') WHERE id = :id",
                    {{":lbl", label}, {":prv", provider}, {":tr", tier}, {":mcl", monthlyLimit}, {":drl", dailyReqLimit},
                     {":exp", expiresAt}, {":pri", priority}, {":st", setActive ? "active" : "standby"},
                     {":mc", modelCount}, {":id", dupId}}
                );
                logAiKeyEvent(db, dupId, label, masked, "UPDATED", "Xác thực lại [" + provider + "] & cập nhật cấu hình key.");
                syncLegacyGeminiSetting(db);
                sendJson(res, {
                    {"success", true},
                    {"key_id", dupId},
                    {"model_count", modelCount},
                    {"sample_models", samples},
                    {"message", "Key đã tồn tại — đã xác thực lại (" + std::to_string(modelCount) + " models) & cập nhật thông tin!"}
                });
                return;
            }

            int64_t existingActive = db.queryScalar("SELECT COUNT(*) FROM master_ai_keys WHERE status = 'active' AND COALESCE(provider, 'gemini') = 'gemini'").get<int64_t>();
            bool makeActive = (provider == "gemini") && (setActive || (existingActive == 0));
            if (makeActive) {
                db.execute("UPDATE master_ai_keys SET status = 'standby' WHERE status = 'active' AND COALESCE(provider, 'gemini') = 'gemini'");
            }
            db.execute(
                "INSERT INTO master_ai_keys (label, key_masked, api_key, provider, tier, status, priority, monthly_credit_limit, daily_request_limit, expires_at, model_count, last_checked_at) "
                "VALUES (:lbl, :msk, :k, :prv, :tr, :st, :pri, :mcl, :drl, :exp, :mc, datetime('now', 'localtime'))",
                {{":lbl", label}, {":msk", masked}, {":k", apiKey}, {":prv", provider}, {":tr", tier},
                 {":st", makeActive ? "active" : "standby"}, {":pri", priority},
                 {":mcl", monthlyLimit}, {":drl", dailyReqLimit}, {":exp", expiresAt}, {":mc", modelCount}}
            );
            int64_t newId = db.queryScalar("SELECT last_insert_rowid()").get<int64_t>();
            logAiKeyEvent(db, newId, label, masked, "ADDED",
                          "Thêm key [" + tier + "]" + (makeActive ? " (Kích hoạt chính)" : " (Dự phòng)") + " • " + std::to_string(modelCount) + " models.");
            syncLegacyGeminiSetting(db);
            sendJson(res, {
                {"success", true},
                {"key_id", newId},
                {"model_count", modelCount},
                {"sample_models", samples},
                {"message", "Xác thực Gemini thành công (" + std::to_string(modelCount) + " models)! Key [" + label + "] đã được lưu bảo mật trên Master."}
            });
            return;
        }

        if (action == "test_gemini_key") {
            ensureMasterAiTables(db);
            int64_t kid = getInt(body, "key_id", 0);
            auto row = db.queryRow("SELECT * FROM master_ai_keys WHERE id = :id LIMIT 1", {{":id", kid}});
            if (row.is_null()) {
                sendError(res, "Không tìm thấy API Key!", 404);
                return;
            }
            int modelCount = 0;
            std::vector<std::string> samples;
            std::string err;
            std::string prov = row.value("provider", "gemini");
            bool ok = SaleApp::AI::verifyProviderKey(prov, row.value("api_key", ""), modelCount, samples, err);
            std::string curStatus = row.value("status", "standby");
            if (ok) {
                std::string nextStatus = (curStatus == "rate_limited" || curStatus == "revoked") ? "standby" : curStatus;
                db.execute(
                    "UPDATE master_ai_keys SET status = :st, model_count = :mc, last_checked_at = datetime('now', 'localtime'), "
                    "last_error = '', updated_at = datetime('now', 'localtime') WHERE id = :id",
                    {{":st", nextStatus}, {":mc", modelCount}, {":id", kid}}
                );
                logAiKeyEvent(db, kid, row.value("label", ""), row.value("key_masked", ""), "TEST_OK", "Kiểm tra thành công (" + std::to_string(modelCount) + " models).");
                sendJson(res, {{"success", true}, {"model_count", modelCount}, {"message", "Key hoạt động bình thường (" + std::to_string(modelCount) + " models)."}});
            } else {
                std::string lower = err;
                std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
                std::string nextStatus = (lower.find("429") != std::string::npos || lower.find("quota") != std::string::npos) ? "rate_limited" : "revoked";
                db.execute(
                    "UPDATE master_ai_keys SET status = :st, last_checked_at = datetime('now', 'localtime'), "
                    "last_error = :e, updated_at = datetime('now', 'localtime') WHERE id = :id",
                    {{":st", nextStatus}, {":e", err}, {":id", kid}}
                );
                logAiKeyEvent(db, kid, row.value("label", ""), row.value("key_masked", ""), "TEST_FAIL", err);
                syncLegacyGeminiSetting(db);
                sendError(res, "Key lỗi khi kiểm tra: " + err, 400);
            }
            return;
        }

        if (action == "activate_gemini_key") {
            ensureMasterAiTables(db);
            int64_t kid = getInt(body, "key_id", 0);
            auto row = db.queryRow("SELECT * FROM master_ai_keys WHERE id = :id LIMIT 1", {{":id", kid}});
            if (row.is_null()) {
                sendError(res, "Không tìm thấy API Key!", 404);
                return;
            }
            db.execute("UPDATE master_ai_keys SET status = 'standby', updated_at = datetime('now', 'localtime') WHERE status = 'active'");
            db.execute("UPDATE master_ai_keys SET status = 'active', last_error = '', updated_at = datetime('now', 'localtime') WHERE id = :id", {{":id", kid}});
            logAiKeyEvent(db, kid, row.value("label", ""), row.value("key_masked", ""), "ACTIVATED", "Đặt làm Key chính đang phục vụ AI Proxy.");
            syncLegacyGeminiSetting(db);
            sendJson(res, {{"success", true}, {"message", "Đã chuyển sang Key [" + row.value("label", "") + "] làm Key chính!"}});
            return;
        }

        if (action == "toggle_gemini_key") {
            ensureMasterAiTables(db);
            int64_t kid = getInt(body, "key_id", 0);
            auto row = db.queryRow("SELECT * FROM master_ai_keys WHERE id = :id LIMIT 1", {{":id", kid}});
            if (row.is_null()) {
                sendError(res, "Không tìm thấy API Key!", 404);
                return;
            }
            std::string cur = row.value("status", "standby");
            std::string next = (cur == "disabled") ? "standby" : "disabled";
            db.execute("UPDATE master_ai_keys SET status = :st, updated_at = datetime('now', 'localtime') WHERE id = :id", {{":st", next}, {":id", kid}});
            logAiKeyEvent(db, kid, row.value("label", ""), row.value("key_masked", ""), next == "disabled" ? "DISABLED" : "ENABLED",
                          next == "disabled" ? "Tạm tắt key khỏi pool" : "Bật lại key ở chế độ dự phòng (standby)");
            syncLegacyGeminiSetting(db);
            sendJson(res, {{"success", true}, {"status", next}, {"message", next == "disabled" ? "Đã tạm tắt Key." : "Đã bật lại Key (Standby)."}});
            return;
        }

        if (action == "update_gemini_key_meta") {
            ensureMasterAiTables(db);
            int64_t kid = getInt(body, "key_id", 0);
            auto row = db.queryRow("SELECT * FROM master_ai_keys WHERE id = :id LIMIT 1", {{":id", kid}});
            if (row.is_null()) {
                sendError(res, "Không tìm thấy API Key!", 404);
                return;
            }
            std::string label = getString(body, "label", row.value("label", "Gemini Key"));
            std::string tier = getString(body, "tier", row.value("tier", "free"));
            if (tier != "payg" && tier != "free") tier = "free";
            int64_t monthlyLimit = std::max<int64_t>(0, getInt(body, "monthly_credit_limit", row.value("monthly_credit_limit", int64_t(0))));
            int64_t dailyReqLimit = std::max<int64_t>(0, getInt(body, "daily_request_limit", row.value("daily_request_limit", int64_t(0))));
            std::string expiresAt = body.contains("expires_at") ? getString(body, "expires_at", "") : row.value("expires_at", "");
            int64_t priority = getInt(body, "priority", row.value("priority", int64_t(100)));
            db.execute(
                "UPDATE master_ai_keys SET label = :lbl, tier = :tr, monthly_credit_limit = :mcl, daily_request_limit = :drl, "
                "expires_at = :exp, priority = :pri, updated_at = datetime('now', 'localtime') WHERE id = :id",
                {{":lbl", label}, {":tr", tier}, {":mcl", monthlyLimit}, {":drl", dailyReqLimit},
                 {":exp", expiresAt}, {":pri", priority}, {":id", kid}}
            );
            logAiKeyEvent(db, kid, label, row.value("key_masked", ""), "UPDATED",
                          "Cập nhật metadata (Tier: " + tier + ", Limit tháng: " + std::to_string(monthlyLimit) + ", Hết hạn: " + (expiresAt.empty() ? "Không" : expiresAt) + ").");
            sendJson(res, {{"success", true}, {"message", "Đã cập nhật cấu hình Key!"}});
            return;
        }

        if (action == "delete_gemini_key") {
            ensureMasterAiTables(db);
            int64_t kid = getInt(body, "key_id", 0);
            json target = (kid > 0)
                ? db.queryRow("SELECT * FROM master_ai_keys WHERE id = :id LIMIT 1", {{":id", kid}})
                : db.queryRow("SELECT * FROM master_ai_keys WHERE status = 'active' LIMIT 1");
            if (!target.is_null()) {
                int64_t delId = target.value("id", int64_t(0));
                bool wasActive = (target.value("status", "") == "active");
                db.execute("DELETE FROM master_ai_keys WHERE id = :id", {{":id", delId}});
                logAiKeyEvent(db, delId, target.value("label", ""), target.value("key_masked", ""), "DELETED", "Đã xóa key khỏi Master Vault.");
                if (wasActive) {
                    selectActiveGeminiKey(db);
                }
            }
            syncLegacyGeminiSetting(db);
            sendJson(res, {{"success", true}, {"message", "Đã xóa Gemini API Key khỏi Master Vault."}});
            return;
        }

        sendError(res, "Invalid super_admin request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi super_admin: ") + e.what()}}, 500);
    }
}

// Master Server Remote License Verification Endpoint (for Slaves)
void MasterHandlers::handleLicenseVerification(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);
        if (action.empty()) action = "verify";

        if (action == "verify" || action == "ping") {
            std::string licKey = getString(body, "license_key");
            std::string machineId = getString(body, "machine_id");
            std::string clientIp = req.remote_addr;

            if (licKey.empty()) {
                sendJson(res, {{"success", false}, {"message", "Thiếu license_key!"}}, 400);
                return;
            }

            auto tenant = db.queryRow("SELECT * FROM saas_tenants WHERE license_key = :lk LIMIT 1", {{":lk", licKey}});
            if (tenant.is_null()) {
                sendJson(res, {{"success", false}, {"message", "Mã bản quyền không tồn tại trên hệ thống!"}}, 404);
                return;
            }

            int64_t tid = 0;
            if (tenant.contains("id") && !tenant["id"].is_null()) {
                try {
                    if (tenant["id"].is_number()) tid = tenant["id"].get<int64_t>();
                    else if (tenant["id"].is_string()) tid = std::stoll(tenant["id"].get<std::string>());
                } catch (...) {}
            }
            std::string boundMachine = getString(tenant, "machine_id", "");
            std::string subStatus = getString(tenant, "subscription_status", "active");

            // Hardware node-locking binding (LIC-03: hỗ trợ Multi-Factor 2/3 tolerance chống khóa oan khi cài lại Win/thay ổ cứng)
            try { if (db.queryRow("SELECT 1 FROM pragma_table_info('saas_tenants') WHERE name='hardware_factors_json' LIMIT 1").is_null()) db.execute("ALTER TABLE saas_tenants ADD COLUMN hardware_factors_json TEXT DEFAULT '[]'"); } catch (...) {}
            json incomingFactors = (body.contains("hardware_factors") && body["hardware_factors"].is_array()) ? body["hardware_factors"] : json::array();
            std::string storedFactorsStr = getString(tenant, "hardware_factors_json", "[]");
            json storedFactors = json::array();
            try { json pf = json::parse(storedFactorsStr, nullptr, false); if (pf.is_array()) storedFactors = pf; } catch (...) {}

            if (boundMachine.empty() && !machineId.empty()) {
                try { if (db.queryRow("SELECT 1 FROM pragma_table_info('saas_tenants') WHERE name='machine_reset_pending' LIMIT 1").is_null()) db.execute("ALTER TABLE saas_tenants ADD COLUMN machine_reset_pending INTEGER DEFAULT 0"); } catch (...) {}
                db.execute("UPDATE saas_tenants SET machine_id = :mid, hardware_factors_json = :hf, machine_reset_pending = 0, machine_bound_at = datetime('now'), last_check_at = datetime('now'), last_check_ip = :ip WHERE id = :id",
                    {{":mid", machineId}, {":hf", incomingFactors.dump()}, {":ip", clientIp}, {":id", tid}});
                boundMachine = machineId;
            } else if (!machineId.empty() && boundMachine != machineId) {
                int matchCnt = 0;
                if (incomingFactors.size() >= 3 && storedFactors.size() >= 3) {
                    for (size_t i = 0; i < 3; ++i) {
                        if (incomingFactors[i].is_string() && storedFactors[i].is_string() && incomingFactors[i] == storedFactors[i]) {
                            matchCnt++;
                        }
                    }
                }
                if (matchCnt >= 2) {
                    // Dung sai 2/3 phần cứng khớp (VD: quán cài lại Windows đổi MachineGuid nhưng giữ Mainboard + Ổ đĩa)
                    db.execute("UPDATE saas_tenants SET machine_id = :mid, hardware_factors_json = :hf, last_check_at = datetime('now'), last_check_ip = :ip WHERE id = :id",
                        {{":mid", machineId}, {":hf", incomingFactors.dump()}, {":ip", clientIp}, {":id", tid}});
                    recordAuditLog(db, 0, "System", "system", "HARDWARE_DRIFT_TOLERATED", std::to_string(tid),
                        "Quán ID " + std::to_string(tid) + " thay đổi 1/3 yếu tố phần cứng (khớp " + std::to_string(matchCnt) + "/3) -> tự động cập nhật Machine ID: " + machineId,
                        json({{"old_mid", boundMachine}, {"new_mid", machineId}}).dump(), clientIp);
                    boundMachine = machineId;
                } else {
                    sendJson(res, {
                        {"success", false},
                        {"state", "hardware_mismatch"},
                        {"message", "Mã bản quyền đã được kích hoạt trên thiết bị phần cứng khác!"}
                    }, 403);
                    return;
                }
            } else if (storedFactors.empty() && incomingFactors.size() >= 3) {
                // Auto-migrate lưu 3 yếu tố phần cứng cho các quán đã kích hoạt từ trước (SDL001/SDL002)
                db.execute("UPDATE saas_tenants SET hardware_factors_json = :hf WHERE id = :id",
                    {{":hf", incomingFactors.dump()}, {":id", tid}});
            }

            db.execute("UPDATE saas_tenants SET last_check_at = datetime('now'), last_check_ip = :ip WHERE id = :id",
                {{":ip", clientIp}, {":id", tid}});

            auto enabledMods = LicenseService::instance().getEnabledModules(tid);
            json blockedMods = json::array();
            try {
                json bmArr = json::parse(getString(tenant, "blocked_modules", "[]"), nullptr, false);
                if (bmArr.is_array()) blockedMods = bmArr;
            } catch (...) {}
            double cardFeePct = 0.0;
            try {
                if (tenant.contains("card_fee_percent") && !tenant["card_fee_percent"].is_null()) {
                    if (tenant["card_fee_percent"].is_number()) cardFeePct = tenant["card_fee_percent"].get<double>();
                    else if (tenant["card_fee_percent"].is_string()) cardFeePct = std::stod(tenant["card_fee_percent"].get<std::string>());
                }
            } catch (...) {}

            int graceDays = 7;
            int offlineMaxDays = 14;
            try {
                auto grRow = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = 'saas_grace_period_days' LIMIT 1");
                if (!grRow.is_null()) graceDays = std::max(0, std::min(60, std::stoi(grRow.value("setting_value", "7"))));
                auto omRow = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = 'saas_offline_max_days' LIMIT 1");
                if (!omRow.is_null()) offlineMaxDays = std::max(1, std::min(90, std::stoi(omRow.value("setting_value", "14"))));
            } catch (...) {}

            std::string licExpDate = getString(tenant, "expire_date", "");
            std::string licModsStr = "[]";
            std::string licBlkStr = "[]";
            try { licModsStr = json(enabledMods).dump(); } catch (...) {}
            try { licBlkStr = json(blockedMods).dump(); } catch (...) {}
            int64_t issuedAt = static_cast<int64_t>(std::time(nullptr));
            std::string keyId = SaleApp::LicenseCrypto::getActiveKeyId();
            std::string canonPayload = SaleApp::LicenseCrypto::buildCanonicalPayloadV2(
                licKey, boundMachine, licExpDate, licModsStr, subStatus, licBlkStr, graceDays, offlineMaxDays, issuedAt, keyId);
            std::string licSig = SaleApp::LicenseCrypto::signLicensePayload(canonPayload);

            sendJson(res, {
                {"success", true},
                {"state", subStatus},
                {"store_name", getString(tenant, "store_name", "")},
                {"plan_name", getString(tenant, "plan_name", "")},
                {"expire_date", licExpDate},
                {"grace_days", graceDays},
                {"offline_max_days", offlineMaxDays},
                {"issued_at", issuedAt},
                {"key_id", keyId},
                {"enabled_modules", enabledMods},
                {"blocked_modules", blockedMods},
                {"card_fee_percent", cardFeePct},
                {"license_signature", licSig},
                {"server_time", issuedAt}
            });
            return;
        }

        sendError(res, "Invalid license verification action", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi license server: ") + e.what()}}, 500);
    }
}

static json readWanConfigFromDb(Database& db) {
    auto getIntSetting = [&](const char* key, int defVal, int minVal, int maxVal) -> int {
        try {
            auto r = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = :k LIMIT 1", {{":k", key}});
            if (!r.is_null()) {
                int v = std::stoi(r.value("setting_value", std::to_string(defVal)));
                return std::max(minVal, std::min(maxVal, v));
            }
        } catch (...) {}
        return defVal;
    };
    return {
        {"tunnel_enabled", getIntSetting("wan_tunnel_enabled", 1, 0, 1) == 1},
        {"poll_timeout_sec", getIntSetting("wan_poll_timeout_sec", 25, 10, 55)},
        {"check_timeout_ms", getIntSetting("wan_check_timeout_ms", 4000, 1000, 15000)},
        {"heartbeat_interval_sec", getIntSetting("wan_heartbeat_interval_sec", 1800, 60, 86400)},
        {"retry_base_sec", getIntSetting("wan_retry_base_sec", 5, 2, 60)},
        {"retry_max_sec", getIntSetting("wan_retry_max_sec", 60, 10, 300)}
    };
}

static void replyTunnelJson(httplib::Response& res, const json& j, int status = 200) {
    res.status = status;
    res.set_content(j.dump(), "application/json; charset=utf-8");
}

static std::string extractClientWanIp(const httplib::Request& req) {
    if (req.has_header("X-Forwarded-For")) {
        std::string xff = req.get_header_value("X-Forwarded-For");
        auto comma = xff.find(',');
        std::string first = (comma == std::string::npos) ? xff : xff.substr(0, comma);
        while (!first.empty() && first.front() == ' ') first.erase(first.begin());
        while (!first.empty() && first.back() == ' ') first.pop_back();
        if (!first.empty()) return first;
    }
    if (req.has_header("X-Real-IP")) {
        std::string xr = req.get_header_value("X-Real-IP");
        if (!xr.empty()) return xr;
    }
    return req.remote_addr;
}

static void saveTenantNetGeo(Database& db, int64_t tid, const std::string& clientIp, const json& netGeo, const json& runtime) {
    std::string lanIp = netGeo.value("lan_ip", runtime.value("lan_ip", ""));
    std::string wanIp = netGeo.value("wan_ip", runtime.value("wan_ip", ""));
    if (wanIp.empty()) wanIp = clientIp;

    double lat = netGeo.value("geo_lat", runtime.value("geo_lat", 0.0));
    double lng = netGeo.value("geo_lng", runtime.value("geo_lng", 0.0));
    std::string geoLabel = netGeo.value("geo_label", runtime.value("geo_label", ""));
    std::string geoSource = netGeo.value("geo_source", runtime.value("geo_source", "ip"));

    if (!lanIp.empty()) {
        db.execute("UPDATE saas_tenants SET lan_ip = :lip WHERE id = :id", {{":lip", lanIp}, {":id", tid}});
    }
    if (!wanIp.empty()) {
        db.execute("UPDATE saas_tenants SET wan_ip = :wip WHERE id = :id", {{":wip", wanIp}, {":id", tid}});
    }
    if (lat != 0.0 && lng != 0.0) {
        auto cur = db.queryRow("SELECT geo_source, geo_lat, geo_lng FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
        std::string curSrc = (!cur.is_null() && cur.contains("geo_source") && cur["geo_source"].is_string())
            ? cur["geo_source"].get<std::string>() : "ip";
        double curLat = 0.0;
        try { if (!cur.is_null() && cur.contains("geo_lat") && cur["geo_lat"].is_number()) curLat = cur["geo_lat"].get<double>(); } catch (...) {}
        // Do not overwrite pinned GPS on Master with coarse IP geo
        if (geoSource == "gps" || curSrc != "gps" || curLat == 0.0) {
            db.execute(
                "UPDATE saas_tenants SET geo_lat = :lat, geo_lng = :lng, geo_label = :lbl, geo_source = :src WHERE id = :id",
                {{":lat", lat}, {":lng", lng}, {":lbl", geoLabel}, {":src", geoSource}, {":id", tid}}
            );
        }
    }
}

static void handleLicensePoll(const httplib::Request& req, httplib::Response& res) {
    try {
        json body = json::object();
        if (!req.body.empty()) {
            try { body = json::parse(req.body); } catch (...) {}
        }
        std::string key = body.value("license_key", "");
        if (key.empty()) {
            replyTunnelJson(res, {{"success", false}, {"message", "Missing license_key"}}, 400);
            return;
        }

        auto& db = Database::instance();
        try { if (db.queryRow("SELECT 1 FROM pragma_table_info('saas_tenants') WHERE name='machine_reset_pending' LIMIT 1").is_null()) db.execute("ALTER TABLE saas_tenants ADD COLUMN machine_reset_pending INTEGER DEFAULT 0"); } catch (...) {}
        auto tenant = db.queryRow("SELECT id, machine_id, COALESCE(machine_reset_pending, 0) as machine_reset_pending FROM saas_tenants WHERE license_key = :k LIMIT 1", {{":k", key}});
        if (tenant.is_null()) {
            replyTunnelJson(res, {{"success", false}, {"message", "Invalid license_key"}}, 404);
            return;
        }

        int64_t tid = tenant["id"].get<int64_t>();
        std::string curMid = (tenant.contains("machine_id") && tenant["machine_id"].is_string()) ? tenant["machine_id"].get<std::string>() : "";
        int resetPending = tenant.value("machine_reset_pending", 0);
        std::string reqMid = body.value("machine_id", "");
        if (curMid.empty() && !reqMid.empty() && resetPending == 0) {
            db.execute("UPDATE saas_tenants SET machine_id = :mid, last_check_at = datetime('now') WHERE id = :id",
                       {{":mid", reqMid}, {":id", tid}});
            curMid = reqMid;
        }
        // SEC-TUN-01: Xac thuc machine_id bat buoc tren kenh /api/license/poll
        if (!curMid.empty() && resetPending == 0 && (reqMid.empty() || reqMid != curMid)) {
            replyTunnelJson(res, {{"success", false}, {"code", "MACHINE_ID_MISMATCH"}, {"message", "machine_id khong khop thiet bi da dang ky"}}, 403);
            return;
        }
        std::string clientIp = extractClientWanIp(req);
        std::string appVersion = body.value("app_version", "2.1.8");
        int storePort = body.value("port", 8501);
        json runtime = body.contains("runtime") && body["runtime"].is_object() ? body["runtime"] : json::object();
        json netGeo = body.contains("net_geo") && body["net_geo"].is_object() ? body["net_geo"] : json::object();

        json wanCfg = readWanConfigFromDb(db);
        int pollSec = wanCfg.value("poll_timeout_sec", 25);

        db.execute(
            "UPDATE saas_tenants SET last_check_ip = :ip, last_app_version = :ver WHERE id = :id",
            {{":ip", clientIp}, {":ver", appVersion}, {":id", tid}}
        );
        saveTenantNetGeo(db, tid, clientIp, netGeo, runtime);

        if (!wanCfg.value("tunnel_enabled", true)) {
            replyTunnelJson(res, {{"success", true}, {"commands", json::array()}, {"config", wanCfg}});
            return;
        }

        auto cmds = StoreTunnelManager::instance().waitForCommands(tid, clientIp, appVersion, storePort, runtime, pollSec);
        json cmdArr = json::array();
        for (const auto& c : cmds) {
            cmdArr.push_back({{"cmd_id", c.cmd_id}, {"type", c.type}, {"created_ms", c.created_ms}, {"payload", c.payload}});
        }

        // Refresh config and latest license rights after wait so Slave always stays in sync
        wanCfg = readWanConfigFromDb(db);
        auto licRow = db.queryRow(
            "SELECT license_key, machine_id, enabled_modules, blocked_modules, subscription_status, expire_date, card_fee_percent FROM saas_tenants WHERE id = :id LIMIT 1",
            {{":id", tid}}
        );
        json licSnapshot = json::object();
        if (!licRow.is_null()) {
            std::string rawEn = licRow.value("enabled_modules", "[]");
            std::string normEn = "[]";
            try {
                json parsed = json::parse(rawEn, nullptr, false);
                if (parsed.is_array()) normEn = parsed.dump();
            } catch (...) {}
            std::string lKey = licRow.value("license_key", "");
            std::string lMid = (licRow.contains("machine_id") && licRow["machine_id"].is_string()) ? licRow["machine_id"].get<std::string>() : "";
            std::string lExp = licRow.value("expire_date", "2028-12-31");
            std::string lSub = licRow.value("subscription_status", "active");
            std::string lBlkRaw = licRow.value("blocked_modules", "[]");
            std::string normBlk = "[]";
            try {
                auto pb = json::parse(lBlkRaw, nullptr, false);
                if (pb.is_array()) normBlk = pb.dump();
            } catch (...) {}
            licSnapshot["enabled_modules"] = normEn;
            licSnapshot["blocked_modules"] = normBlk;
            licSnapshot["subscription_status"] = lSub;
            licSnapshot["expire_date"] = lExp;
            double cfp = 0.0;
            try {
                if (licRow.contains("card_fee_percent") && licRow["card_fee_percent"].is_number()) cfp = licRow["card_fee_percent"].get<double>();
            } catch (...) {}
            licSnapshot["card_fee_percent"] = cfp;
            std::string canon = SaleApp::LicenseCrypto::buildCanonicalPayload(lKey, lMid, lExp, normEn, lSub, normBlk);
            licSnapshot["license_signature"] = SaleApp::LicenseCrypto::signLicensePayload(canon);
        }
        replyTunnelJson(res, {{"success", true}, {"commands", cmdArr}, {"config", wanCfg}, {"license", licSnapshot}});
    } catch (const std::exception& e) {
        replyTunnelJson(res, {{"success", false}, {"message", e.what()}}, 500);
    }
}

static void handleLicenseAck(const httplib::Request& req, httplib::Response& res) {
    try {
        json body = json::object();
        if (!req.body.empty()) {
            try { body = json::parse(req.body); } catch (...) {}
        }
        std::string key = body.value("license_key", "");
        std::string reqMid = body.value("machine_id", "");
        std::string cmdId = body.value("cmd_id", "");
        std::string reqCmdType = body.value("cmd_type", "");
        bool ok = body.value("ok", true);
        json runtime = body.contains("runtime") && body["runtime"].is_object() ? body["runtime"] : json::object();

        auto& db = Database::instance();
        std::string clientIp = extractClientWanIp(req);
        int64_t tenantId = 0;
        if (!key.empty()) {
            auto tRow = db.queryRow("SELECT id, machine_id, COALESCE(machine_reset_pending, 0) as machine_reset_pending FROM saas_tenants WHERE license_key = :k LIMIT 1", {{":k", key}});
            if (!tRow.is_null() && tRow.contains("id") && tRow["id"].is_number()) {
                std::string curMid = (tRow.contains("machine_id") && tRow["machine_id"].is_string()) ? tRow["machine_id"].get<std::string>() : "";
                int resetPending = tRow.value("machine_reset_pending", 0);
                if (!curMid.empty() && resetPending == 0 && (reqMid.empty() || reqMid != curMid)) {
                    replyTunnelJson(res, {{"success", false}, {"code", "MACHINE_ID_MISMATCH"}, {"message", "machine_id khong khop thiet bi da dang ky"}}, 403);
                    return;
                }
                tenantId = tRow["id"].get<int64_t>();
                db.execute(
                    "UPDATE saas_tenants SET last_check_at = datetime('now'), last_check_ip = :ip WHERE id = :id",
                    {{":ip", clientIp}, {":id", tenantId}}
                );
                saveTenantNetGeo(db, tenantId, clientIp, json::object(), runtime);
            }
        }
        bool matched = !cmdId.empty() && StoreTunnelManager::instance().completeAck(cmdId, ok, runtime);
        std::string persistedType;
        int64_t persistedTid = 0;
        bool persistedMatched = !cmdId.empty() && StoreTunnelManager::instance().ackPersistedCommand(cmdId, persistedType, persistedTid);
        std::string effectiveType = !persistedType.empty() ? persistedType : reqCmdType;
        int64_t effectiveTid = (persistedTid > 0) ? persistedTid : tenantId;

        if (ok && effectiveType == "RESET_OWNER_PIN") {
            if (effectiveTid > 0) {
                db.execute("UPDATE saas_tenants SET pin_reset_pending = 0 WHERE id = :id", {{":id", effectiveTid}});
            } else if (!key.empty()) {
                db.execute("UPDATE saas_tenants SET pin_reset_pending = 0 WHERE license_key = :k", {{":k", key}});
            }
        }
        replyTunnelJson(res, {{"success", true}, {"matched", matched || persistedMatched}, {"cmd_type", effectiveType}});
    } catch (const std::exception& e) {
        replyTunnelJson(res, {{"success", false}, {"message", e.what()}}, 500);
    }
}

void MasterHandlers::registerRoutes(httplib::Server& svr) {
    svr.Get("/api/super_admin", handleSuperAdmin);
    svr.Post("/api/super_admin", handleSuperAdmin);
    svr.Get("/api/super_admin.php", handleSuperAdmin);
    svr.Post("/api/super_admin.php", handleSuperAdmin);
    svr.Get("/api/super_admin.html", handleSuperAdmin);
    svr.Post("/api/super_admin.html", handleSuperAdmin);

    svr.Get("/api/master", handleSuperAdmin);
    svr.Post("/api/master", handleSuperAdmin);
    svr.Get("/api/master.php", handleSuperAdmin);
    svr.Post("/api/master.php", handleSuperAdmin);
    svr.Get("/theme_studio", [](const httplib::Request&, httplib::Response& res) {
        fs::path p = SaleApp::Config::AppConfig::instance().getWebDir() / "theme_studio.html";
        if (!fs::exists(p)) { res.status = 404; res.set_content("theme_studio.html not found", "text/plain"); return; }
        std::ifstream ifs(p.string(), std::ios::binary);
        std::string c((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
        res.set_content(c, "text/html; charset=utf-8");
    });

    // Remote Verification & Reverse Long-Polling Endpoints for Slaves (WAN)
    svr.Post("/api/license/verify", handleLicenseVerification);
    svr.Get("/api/license/ping", handleLicenseVerification);
    svr.Post("/api/license/poll", handleLicensePoll);
    svr.Post("/api/license/ack", handleLicenseAck);

    // Authenticated Store AI Proxy (Master holds Gemini API Key exclusively)
    svr.Post("/api/ai/proxy", [](const httplib::Request& req, httplib::Response& res) {
        try {
            auto& db = Database::instance();
            ensureMasterAiTables(db);
            json body = parseBody(req);
            std::string licKey = getString(body, "license_key");
            std::string machineId = getString(body, "machine_id");
            std::string aiAction = getString(body, "action");

            if (licKey.empty() || aiAction.empty()) {
                replyTunnelJson(res, {{"success", false}, {"message", "Thiếu license_key hoặc action AI!"}}, 400);
                return;
            }

            auto tenant = db.queryRow("SELECT * FROM saas_tenants WHERE license_key = :lk LIMIT 1", {{":lk", licKey}});
            if (tenant.is_null()) {
                replyTunnelJson(res, {{"success", false}, {"message", "License key không hợp lệ trên Master!"}}, 403);
                return;
            }
            std::string subSt = getString(tenant, "subscription_status", "active");
            if (subSt != "active" && subSt != "trial") {
                replyTunnelJson(res, {{"success", false}, {"message", "Gói bản quyền của quán đang tạm khóa!"}}, 403);
                return;
            }
            std::string boundMid = getString(tenant, "machine_id", "");
            if (!boundMid.empty() && !machineId.empty() && boundMid != machineId) {
                replyTunnelJson(res, {{"success", false}, {"message", "Machine ID không khớp với bản quyền đã kích hoạt!"}}, 403);
                return;
            }

            std::string reqModule;
            if (aiAction == "parse_invoice") reqModule = "ai_invoice_ocr";
            else if (aiAction == "generate_dish_image") reqModule = "ai_dish_studio";
            else if (aiAction == "search_dish_images" || aiAction == "fetch_dish_image") reqModule = "pos_core";
            else if (aiAction == "generate_slide") reqModule = "advertising_promotions";
            else if (aiAction == "copilot_chat") reqModule = "pos_core";
            else {
                replyTunnelJson(res, {{"success", false}, {"message", "Action AI không hỗ trợ: " + aiAction}}, 400);
                return;
            }

            if (!checkTenantModuleAllowed(tenant, reqModule)) {
                replyTunnelJson(res, {{"success", false}, {"locked", true}, {"message", "Quán chưa được cấp phép module [" + reqModule + "] trên Master!"}}, 403);
                return;
            }

            int64_t actionCost = getAiActionCreditCost(aiAction);
            if (aiAction == "search_dish_images") {
                std::string name = getString(body, "name");
                std::string catName = getString(body, "category_name");
                std::string styleTone = getString(body, "style_tone", "bright");
                std::string customQuery = getString(body, "custom_query");
                int page = body.value("page", 0);
                if (name.empty() && customQuery.empty()) {
                    replyTunnelJson(res, {{"success", false}, {"message", "Thiếu tên món ăn!"}}, 400);
                    return;
                }
                std::vector<SaleApp::AI::FoodImageCandidate> candidates;
                std::string err;
                if (!SaleApp::AI::searchFoodImagesBing(name, catName, styleTone, candidates, err, page, customQuery)) {
                    replyTunnelJson(res, {{"success", false}, {"message", err}}, 502);
                    return;
                }
                json arr = json::array();
                for (const auto& c : candidates) {
                    arr.push_back({{"thumb_url", c.thumbUrl}, {"full_url", c.fullUrl}});
                }
                replyTunnelJson(res, {{"success", true}, {"candidates", arr}});
                return;
            }
            if (aiAction == "fetch_dish_image") {
                std::string fullUrl = getString(body, "full_url");
                std::string thumbUrl = getString(body, "thumb_url");
                std::string ssrfReason;
                if (!fullUrl.empty() && SaleApp::Security::isPrivateOrLocalUrl(fullUrl, &ssrfReason)) {
                    replyTunnelJson(res, {{"success", false}, {"message", "Từ chối URL nội bộ (SSRF): " + ssrfReason}}, 400);
                    return;
                }
                if (!thumbUrl.empty() && SaleApp::Security::isPrivateOrLocalUrl(thumbUrl, &ssrfReason)) {
                    replyTunnelJson(res, {{"success", false}, {"message", "Từ chối Thumbnail URL nội bộ (SSRF): " + ssrfReason}}, 400);
                    return;
                }
                std::string imgB64, mime, err;
                bool ok = (!fullUrl.empty() && SaleApp::AI::fetchImageAsBase64(fullUrl, imgB64, mime, err));
                if (!ok && !thumbUrl.empty() && thumbUrl != fullUrl) {
                    ok = SaleApp::AI::fetchImageAsBase64(thumbUrl, imgB64, mime, err);
                }
                if (!ok) {
                    replyTunnelJson(res, {{"success", false}, {"message", err.empty() ? "Không tải được ảnh đã chọn!" : err}}, 502);
                    return;
                }
                replyTunnelJson(res, {{"success", true}, {"image_base64", imgB64}, {"mime_type", mime}});
                return;
            }

            json activeKeyRow = selectActiveGeminiKey(db);
            std::string apiKey = (!activeKeyRow.is_null()) ? activeKeyRow.value("api_key", "") : "";
            int64_t activeKeyId = (!activeKeyRow.is_null()) ? activeKeyRow.value("id", int64_t(0)) : 0;
            if (apiKey.empty()) {
                replyTunnelJson(res, {{"success", false}, {"message", "Master Server chưa có Gemini API Key khả dụng! Vui lòng vào Super Admin -> Master AI Vault để cấu hình Key."}}, 503);
                return;
            }

            int64_t tid = getInt(tenant, "id", 0);
            std::string tCode = getString(tenant, "tenant_code", "");
            std::string sName = getString(tenant, "store_name", "");
            json quotaSnap = buildTenantAiQuotaSnapshot(db, tenant);
            bool isUnlimited = quotaSnap.value("unlimited", false);
            int64_t remMonthly = quotaSnap.value("remaining_monthly", int64_t(0));
            int64_t remTotal = quotaSnap.value("remaining_total", int64_t(0));

            if (!isUnlimited && remTotal < actionCost) {
                std::string qMsg = "Quán đã hết hạn mức AI Credit (cần " + std::to_string(actionCost) +
                    " credit, còn " + std::to_string(remTotal) + " credit). "
                    "Vui lòng liên hệ nhà cung cấp để cấp thêm quota hoặc dùng Gemini API Key dự phòng của quán.";
                replyTunnelJson(res, {
                    {"success", false},
                    {"quota_exceeded", true},
                    {"required_cost", actionCost},
                    {"ai_quota", quotaSnap},
                    {"message", qMsg}
                }, 402);
                return;
            }

            auto logUsage = [&](const std::string& modelUsed, const std::string& st) -> json {
                if (st != "ok") {
                    db.execute(
                        "INSERT INTO ai_usage_logs (tenant_id, tenant_code, store_name, action, model_used, status, credits_used, quota_bucket, key_id) "
                        "VALUES (:tid, :tc, :sn, :act, :mdl, :st, 0, 'error', :kid)",
                        {{":tid", tid}, {":tc", tCode}, {":sn", sName}, {":act", aiAction}, {":mdl", modelUsed}, {":st", st}, {":kid", activeKeyId}}
                    );
                    return quotaSnap;
                }
                if (activeKeyId > 0) {
                    db.execute("UPDATE master_ai_keys SET last_used_at = datetime('now', 'localtime'), last_error = '' WHERE id = :id", {{":id", activeKeyId}});
                }
                if (isUnlimited) {
                    db.execute(
                        "INSERT INTO ai_usage_logs (tenant_id, tenant_code, store_name, action, model_used, status, credits_used, quota_bucket, key_id) "
                        "VALUES (:tid, :tc, :sn, :act, :mdl, 'ok', :cr, 'unlimited', :kid)",
                        {{":tid", tid}, {":tc", tCode}, {":sn", sName}, {":act", aiAction}, {":mdl", modelUsed}, {":cr", actionCost}, {":kid", activeKeyId}}
                    );
                } else {
                    int64_t fromMonthly = std::min<int64_t>(remMonthly, actionCost);
                    int64_t fromBonus = actionCost - fromMonthly;
                    if (fromMonthly > 0) {
                        db.execute(
                            "INSERT INTO ai_usage_logs (tenant_id, tenant_code, store_name, action, model_used, status, credits_used, quota_bucket, key_id) "
                            "VALUES (:tid, :tc, :sn, :act, :mdl, 'ok', :cr, 'monthly', :kid)",
                            {{":tid", tid}, {":tc", tCode}, {":sn", sName}, {":act", aiAction}, {":mdl", modelUsed}, {":cr", fromMonthly}, {":kid", activeKeyId}}
                        );
                    }
                    if (fromBonus > 0) {
                        db.execute(
                            "UPDATE saas_tenants SET ai_bonus_credits = MAX(0, COALESCE(ai_bonus_credits, 0) - :fb) WHERE id = :tid",
                            {{":fb", fromBonus}, {":tid", tid}}
                        );
                        db.execute(
                            "INSERT INTO ai_usage_logs (tenant_id, tenant_code, store_name, action, model_used, status, credits_used, quota_bucket, key_id) "
                            "VALUES (:tid, :tc, :sn, :act, :mdl, 'ok', :cr, 'bonus', :kid)",
                            {{":tid", tid}, {":tc", tCode}, {":sn", sName}, {":act", aiAction}, {":mdl", modelUsed}, {":cr", fromBonus}, {":kid", activeKeyId}}
                        );
                    }
                }
                auto freshTenant = db.queryRow("SELECT * FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
                return freshTenant.is_null() ? quotaSnap : buildTenantAiQuotaSnapshot(db, freshTenant);
            };

            auto runWithFailover = [&](auto&& fn, std::string& errOut) -> bool {
                if (fn(apiKey, errOut)) return true;
                logUsage("", "error");
                if (handleGeminiKeyRuntimeError(db, activeKeyRow, errOut)) {
                    json nextRow = selectActiveGeminiKey(db);
                    if (!nextRow.is_null() && !nextRow.value("api_key", "").empty()) {
                        activeKeyRow = nextRow;
                        apiKey = nextRow.value("api_key", "");
                        activeKeyId = nextRow.value("id", int64_t(0));
                        errOut.clear();
                        return fn(apiKey, errOut);
                    }
                }
                return false;
            };

            if (aiAction == "parse_invoice") {
                std::string mime = getString(body, "mime_type", "image/jpeg");
                std::string pureB64 = getString(body, "image_base64");
                if (pureB64.rfind("data:", 0) == 0) {
                    SaleApp::AI::parseDataUriImage(pureB64, mime, pureB64);
                }
                if (pureB64.empty()) {
                    replyTunnelJson(res, {{"success", false}, {"message", "Thiếu dữ liệu ảnh hóa đơn!"}}, 400);
                    return;
                }
                std::string prompt;
                json schema;
                SaleApp::AI::buildInvoiceOcrPromptAndSchema(getString(body, "catalog_hint"), prompt, schema);
                json contents = json::array({{{"parts", json::array({
                    {{"text", prompt}},
                    {{"inlineData", {{"mimeType", mime}, {"data", pureB64}}}}
                })}}});
                std::string textOut, modelUsed, err;
                if (!runWithFailover([&](const std::string& k, std::string& e) {
                        return SaleApp::AI::geminiGenerateContentText(k, contents, true, textOut, modelUsed, e, schema, true);
                    }, err)) {
                    logUsage(modelUsed, "error");
                    replyTunnelJson(res, {{"success", false}, {"message", "Lỗi AI OCR: " + err}}, 502);
                    return;
                }
                json parsed;
                try { parsed = json::parse(textOut); } catch (...) {
                    logUsage(modelUsed, "error");
                    replyTunnelJson(res, {{"success", false}, {"message", "AI trả về định dạng không phải JSON hợp lệ."}}, 502);
                    return;
                }
                json updatedQuota = logUsage(modelUsed, "ok");
                replyTunnelJson(res, {
                    {"success", true},
                    {"ai_engine", modelUsed},
                    {"credits_charged", actionCost},
                    {"ai_quota", updatedQuota},
                    {"parsed", parsed}
                });
                return;
            }

            auto runImageWithPool = [&](const std::string& imgPrompt, std::string& outB64, std::string& outMime, std::string& outModel, std::string& outErr) -> bool {
                // 1. Try Gemini keys (active/standby), then dedicated image providers (huggingface/pollinations/openai)
                json poolKeys = db.query(R"(
                    SELECT id, label, key_masked, api_key, COALESCE(provider, 'gemini') as provider, status
                    FROM master_ai_keys
                    WHERE status IN ('active', 'standby')
                      AND (COALESCE(expires_at, '') = '' OR date(expires_at) >= date('now', 'localtime'))
                    ORDER BY CASE WHEN COALESCE(provider, 'gemini') = 'gemini' THEN 0 ELSE 1 END,
                             CASE status WHEN 'active' THEN 0 ELSE 1 END,
                             priority ASC, id ASC
                )");
                std::string firstErr;
                std::string nonGeminiErr;
                for (const auto& kr : poolKeys) {
                    std::string prov = kr.value("provider", "gemini");
                    std::string kVal = kr.value("api_key", "");
                    int64_t kId = kr.value("id", int64_t(0));
                    if (kVal.empty()) continue;
                    std::string curErr;
                    if (SaleApp::AI::generateImageViaProvider(prov, kVal, imgPrompt, outB64, outMime, outModel, curErr)) {
                        activeKeyId = kId;
                        return true;
                    }
                    if (firstErr.empty()) firstErr = curErr;
                    if (prov != "gemini" && !curErr.empty()) nonGeminiErr = curErr;
                    // Only mark non-gemini or revoked keys; do NOT disable Gemini key for OCR/Chat when Free Tier limits image=0
                    if (prov != "gemini" || curErr.find("API_KEY_INVALID") != std::string::npos || curErr.find("401") != std::string::npos) {
                        handleGeminiKeyRuntimeError(db, kr, curErr);
                    }
                }
                // Built-in zero-key fallback via image.pollinations.ai when paid/quota image keys fail
                {
                    std::string pollErr;
                    if (SaleApp::AI::generateImageViaProvider("pollinations", "", imgPrompt, outB64, outMime, outModel, pollErr)) {
                        return true;
                    }
                    if (!pollErr.empty()) nonGeminiErr = pollErr;
                }
                if (!nonGeminiErr.empty()) {
                    outErr = nonGeminiErr;
                } else if (firstErr.find("free_tier") != std::string::npos || firstErr.find("limit: 0") != std::string::npos) {
                    outErr = "Key Gemini Free bị Google khóa tạo ảnh (limit: 0). Vui lòng bật Billing PayG hoặc nạp thêm Key tạo ảnh miễn phí (Pollinations / OpenAI) vào Master AI Vault!";
                } else {
                    outErr = firstErr.empty() ? "Chưa có API Key tạo ảnh khả dụng trong Master AI Vault!" : firstErr;
                }
                return false;
            };

            if (aiAction == "generate_dish_image") {
                std::string name = getString(body, "name");
                std::string catName = getString(body, "category_name");
                std::string styleTone = getString(body, "style_tone", "bright");
                if (name.empty()) {
                    replyTunnelJson(res, {{"success", false}, {"message", "Thiếu tên món ăn!"}}, 400);
                    return;
                }
                std::string prompt = SaleApp::AI::buildDishImagePrompt(name, catName, styleTone);

                std::string imgB64, mime, modelUsed, err;
                if (!runImageWithPool(prompt, imgB64, mime, modelUsed, err)) {
                    logUsage(modelUsed, "error");
                    replyTunnelJson(res, {{"success", false}, {"message", "Không thể tạo ảnh AI: " + err}}, 502);
                    return;
                }
                json updatedQuota = logUsage(modelUsed, "ok");
                replyTunnelJson(res, {
                    {"success", true},
                    {"image_base64", imgB64},
                    {"mime_type", mime},
                    {"ai_engine", modelUsed},
                    {"credits_charged", actionCost},
                    {"ai_quota", updatedQuota}
                });
                return;
            }

            if (aiAction == "generate_slide") {
                std::string topic = getString(body, "topic", "Khuyến mãi đặc biệt hôm nay tại quán cà phê");
                std::string copyPrompt =
                    "Bạn là chuyên gia marketing F&B. Hãy viết nội dung cho 1 slide quảng cáo màn hình khách hàng dựa trên chủ đề: \"" + topic + "\". "
                    "Trả về đúng 1 JSON object: {\"title\": \"Tiêu đề ngắn gọn hấp dẫn tối đa 60 ký tự tiếng Việt\", "
                    "\"description\": \"Mô tả ngắn gọn 1-2 câu tối đa 160 ký tự tiếng Việt\", "
                    "\"image_prompt\": \"Detailed English prompt for widescreen 16:9 commercial cafe/food promotional background photography, warm lighting, vibrant, no text, no watermark\"}.";
                json contents = json::array({{{"parts", json::array({{{"text", copyPrompt}}})}}});
                std::string textOut, textModel, err;
                if (!runWithFailover([&](const std::string& k, std::string& e) {
                        return SaleApp::AI::geminiGenerateContentText(k, contents, true, textOut, textModel, e);
                    }, err)) {
                    logUsage(textModel, "error");
                    replyTunnelJson(res, {{"success", false}, {"message", "Lỗi AI viết nội dung slide: " + err}}, 502);
                    return;
                }
                json copyJson;
                try { copyJson = json::parse(textOut); } catch (...) { copyJson = json::object(); }
                std::string slideTitle = copyJson.value("title", topic);
                std::string slideDesc = copyJson.value("description", "Ưu đãi hấp dẫn dành riêng cho quý khách hôm nay.");
                std::string imgPrompt = copyJson.value("image_prompt", "Widescreen 16:9 commercial cafe beverage and pastry promotional photography, warm moody lighting, photorealistic, no text");

                std::string imgB64, mime, imgModel, imgErr;
                if (!runImageWithPool(imgPrompt, imgB64, mime, imgModel, imgErr)) {
                    logUsage(textModel, "error");
                    replyTunnelJson(res, {{"success", false}, {"message", "Không thể tạo ảnh slide: " + imgErr}}, 502);
                    return;
                }
                json updatedQuota = logUsage(textModel + "+" + imgModel, "ok");
                replyTunnelJson(res, {
                    {"success", true},
                    {"title", slideTitle},
                    {"description", slideDesc},
                    {"image_base64", imgB64},
                    {"mime_type", mime},
                    {"ai_engine", textModel + " + " + imgModel},
                    {"credits_charged", actionCost},
                    {"ai_quota", updatedQuota}
                });
                return;
            }

            if (aiAction == "copilot_chat") {
                std::string prompt = getString(body, "prompt");
                if (prompt.empty()) {
                    replyTunnelJson(res, {{"success", false}, {"message", "Thiếu nội dung câu hỏi!"}}, 400);
                    return;
                }
                json contents = json::array({{{"parts", json::array({{{"text", prompt}}})}}});
                std::string textOut, modelUsed, err;
                if (!runWithFailover([&](const std::string& k, std::string& e) {
                        return SaleApp::AI::geminiGenerateContentText(k, contents, false, textOut, modelUsed, e);
                    }, err)) {
                    logUsage(modelUsed, "error");
                    replyTunnelJson(res, {{"success", false}, {"message", "Lỗi AI Copilot: " + err}}, 502);
                    return;
                }
                json updatedQuota = logUsage(modelUsed, "ok");
                replyTunnelJson(res, {
                    {"success", true},
                    {"answer", textOut},
                    {"ai_engine", modelUsed},
                    {"credits_charged", actionCost},
                    {"ai_quota", updatedQuota}
                });
                return;
            }
        } catch (const std::exception& e) {
            replyTunnelJson(res, {{"success", false}, {"message", std::string("Master AI Proxy error: ") + e.what()}}, 500);
        }
    });

    svr.Post("/api/ai/quota", [](const httplib::Request& req, httplib::Response& res) {
        try {
            auto& db = Database::instance();
            ensureMasterAiTables(db);
            json body = parseBody(req);
            std::string licKey = getString(body, "license_key");
            std::string machineId = getString(body, "machine_id");
            if (licKey.empty()) {
                replyTunnelJson(res, {{"success", false}, {"message", "Thiếu license_key!"}}, 400);
                return;
            }
            auto tenant = db.queryRow("SELECT * FROM saas_tenants WHERE license_key = :lk LIMIT 1", {{":lk", licKey}});
            if (tenant.is_null()) {
                replyTunnelJson(res, {{"success", false}, {"message", "License key không hợp lệ!"}}, 403);
                return;
            }
            std::string boundMid = getString(tenant, "machine_id", "");
            if (!boundMid.empty() && !machineId.empty() && boundMid != machineId) {
                replyTunnelJson(res, {{"success", false}, {"message", "Machine ID không khớp!"}}, 403);
                return;
            }
            json activeKeyRow = selectActiveGeminiKey(db);
            bool masterHasKey = (!activeKeyRow.is_null() && !activeKeyRow.value("api_key", "").empty());
            replyTunnelJson(res, {
                {"success", true},
                {"master_has_key", masterHasKey},
                {"credit_costs", {{"parse_invoice", 1}, {"generate_dish_image", 2}, {"generate_slide", 3}}},
                {"ai_quota", buildTenantAiQuotaSnapshot(db, tenant)}
            });
        } catch (const std::exception& e) {
            replyTunnelJson(res, {{"success", false}, {"message", std::string("Master AI Quota error: ") + e.what()}}, 500);
        }
    });

    svr.Post("/api/i18n/ai-translate", [](const httplib::Request& req, httplib::Response& res) {
        try {
            json su = getSaSessionUser(req);
            json body = parseBody(req);
            auto& db = Database::instance();
            const std::string passedKeyEarly = getString(body, "gemini_api_key");
            const bool isLoopback = (req.remote_addr == "127.0.0.1" || req.remote_addr == "::1" || req.remote_addr == "::ffff:127.0.0.1");
            if (su.is_null() && !(isLoopback && !passedKeyEarly.empty() && passedKeyEarly.find("•••") == std::string::npos)) {
                std::string licKey = getString(body, "license_key");
                if (licKey.empty()) {
                    replyTunnelJson(res, {{"success", false}, {"message", "Yêu cầu đăng nhập SuperAdmin để dịch thuật AI trên Master!"}}, 401);
                    return;
                }
                auto tenant = db.queryRow("SELECT id FROM saas_tenants WHERE license_key = :lk AND subscription_status = 'active' LIMIT 1", {{":lk", licKey}});
                if (tenant.is_null()) {
                    replyTunnelJson(res, {{"success", false}, {"message", "License key không hợp lệ!"}}, 403);
                    return;
                }
            }
            ensureMasterAiTables(db);
            std::string passedKey = getString(body, "gemini_api_key");
            std::string apiKey = (!passedKey.empty() && passedKey.find("•••") == std::string::npos) ? passedKey : "";
            if (apiKey.empty()) {
                json activeKeyRow = selectActiveGeminiKey(db);
                if (!activeKeyRow.is_null()) apiKey = activeKeyRow.value("api_key", "");
            }
            if (apiKey.empty()) {
                replyTunnelJson(res, {{"success", false}, {"message", "Master chưa có Gemini API Key khả dụng!"}}, 503);
                return;
            }
            std::string srcLang = getString(body, "source_lang", "vi");
            std::string tgtLang = getString(body, "target_lang", "en");
            std::string tgtName = getString(body, "target_lang_name", tgtLang);
            json itemsIn = (body.contains("items") && body["items"].is_array()) ? body["items"] : json::array();
            if (itemsIn.empty() && !getString(body, "text").empty()) {
                itemsIn.push_back({{"key", getString(body, "key", "single")}, {"text", getString(body, "text")}});
            }
            if (itemsIn.empty()) {
                replyTunnelJson(res, {{"success", false}, {"message", "Danh sách chuỗi cần dịch đang trống!"}}, 400);
                return;
            }
            if (itemsIn.size() > 50) {
                replyTunnelJson(res, {{"success", false}, {"message", "Mỗi lượt AI Translate tối đa 50 chuỗi!"}}, 400);
                return;
            }
            std::string prompt = "You are a professional software localization translator for an F&B POS & Restaurant OS (CyberNexus POS).\n"
                "Translate each UI string accurately and naturally from source language '" + srcLang + "' to target language '" + tgtLang + "' (" + tgtName + ").\n"
                "STRICT RULES:\n"
                "1. Preserve ALL placeholders like {name}, {count}, {0}, %s, %d, and HTML tags verbatim without translating inside braces.\n"
                "2. Keep terminology concise for POS buttons, kitchen displays, and receipts.\n"
                "3. Return strictly JSON object: {\"translations\": [{\"key\": \"...\", \"translated\": \"...\"}]}.\n\n"
                "Input JSON:\n" + itemsIn.dump();
            json contents = json::array({{{"parts", json::array({{{"text", prompt}}})}}});
            std::string textOut, modelUsed, err;
            if (!SaleApp::AI::geminiGenerateContentText(apiKey, contents, true, textOut, modelUsed, err)) {
                replyTunnelJson(res, {{"success", false}, {"message", "Lỗi Gemini AI Translate: " + err}}, 502);
                return;
            }
            json parsed = json::parse(textOut, nullptr, false);
            if (!parsed.is_object() || !parsed.contains("translations")) {
                replyTunnelJson(res, {{"success", false}, {"message", "AI trả về JSON không hợp lệ cho i18n!"}}, 502);
                return;
            }
            replyTunnelJson(res, {{"success", true}, {"translations", parsed["translations"]}, {"model", modelUsed}});
        } catch (const std::exception& e) {
            replyTunnelJson(res, {{"success", false}, {"message", std::string("AI Translate error: ") + e.what()}}, 500);
        }
    });

    auto ensureMasterI18nSchema = [](Database& db) {
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
    };

    svr.Get("/api/i18n/catalog", [ensureMasterI18nSchema](const httplib::Request& req, httplib::Response& res) {
        json su = getSaSessionUser(req);
        if (su.is_null()) {
            replyTunnelJson(res, {{"success", false}, {"message", "Yêu cầu đăng nhập SuperAdmin!"}}, 401);
            return;
        }
        auto& db = Database::instance();
        ensureMasterI18nSchema(db);
        json rows = db.query("SELECT * FROM i18n_catalog ORDER BY key ASC");
        replyTunnelJson(res, {{"success", true}, {"saved_rows", rows}, {"db_entities", json::array()}});
    });

    svr.Post("/api/i18n/save", [ensureMasterI18nSchema](const httplib::Request& req, httplib::Response& res) {
        json su = getSaSessionUser(req);
        if (su.is_null()) {
            replyTunnelJson(res, {{"success", false}, {"message", "Yêu cầu đăng nhập SuperAdmin!"}}, 401);
            return;
        }
        auto& db = Database::instance();
        ensureMasterI18nSchema(db);
        json body = parseBody(req);
        json items = (body.contains("rows") && body["rows"].is_array()) ? body["rows"] : json::array();
        if (items.empty() && !getString(body, "key").empty()) items.push_back(body);
        if (items.empty()) {
            replyTunnelJson(res, {{"success", false}, {"message", "Thiếu dữ liệu câu ngôn ngữ!"}}, 400);
            return;
        }
        int savedCnt = 0;
        db.beginTransaction();
        for (const auto& r : items) {
            std::string k = getString(r, "key");
            if (k.empty()) continue;
            json rawTr = (r.contains("raw") && r["raw"].is_object()) ? r["raw"] : json::object();
            db.execute(R"(
                INSERT INTO i18n_catalog (key, group_code, layer, screen, comp_type, field_name, source_file, max_chars, origin_vi, translations_json, status, source_modified, updated_at)
                VALUES (:k, :g, :ly, :sc, :ct, :fn, :sf, :mc, :ori, :tj, :st, 0, datetime('now','localtime'))
                ON CONFLICT(key) DO UPDATE SET
                    group_code = :g, layer = :ly, screen = :sc, comp_type = :ct, field_name = :fn,
                    source_file = :sf, max_chars = :mc, origin_vi = :ori, translations_json = :tj,
                    status = :st, updated_at = datetime('now','localtime')
            )", {
                {":k", k}, {":g", getString(r, "group", "custom")}, {":ly", getString(r, "layer", "frontend")},
                {":sc", getString(r, "screen", "")}, {":ct", getString(r, "comp_type", "api_msg")},
                {":fn", getString(r, "field_name", k)}, {":sf", getString(r, "source_file", "")},
                {":mc", getInt(r, "max_chars", 120)}, {":ori", getString(r, "origin", getString(rawTr, "vi", ""))},
                {":tj", rawTr.dump()}, {":st", getString(r, "status", "approved")}
            });
            savedCnt++;
        }
        db.commit();
        replyTunnelJson(res, {{"success", true}, {"saved_count", savedCnt}, {"message", "Đã lưu " + std::to_string(savedCnt) + " mục ngôn ngữ trên Master!"}});
    });

    svr.Post("/api/i18n/publish", [ensureMasterI18nSchema](const httplib::Request& req, httplib::Response& res) {
        json su = getSaSessionUser(req);
        if (su.is_null()) {
            replyTunnelJson(res, {{"success", false}, {"message", "Yêu cầu đăng nhập SuperAdmin!"}}, 401);
            return;
        }
        auto& db = Database::instance();
        ensureMasterI18nSchema(db);
        json body = parseBody(req);
        std::string lang = getString(body, "lang", "en");
        if (lang.empty()) lang = "en";
        fs::path webDir = SaleApp::Config::AppConfig::instance().getWebDir();
        fs::path baseDir = SaleApp::Config::AppConfig::instance().getBaseDir();
        fs::path webLoc = webDir / "locales" / (lang + ".json");
        fs::path rootLoc = baseDir / "locales" / (lang + ".json");
        bool writeRootLoc = (fs::weakly_canonical(webDir.parent_path()) == fs::weakly_canonical(baseDir));
        json locObj = json::object();
        if (fs::exists(webLoc)) {
            try { std::ifstream ifs(webLoc, std::ios::binary); ifs >> locObj; } catch (...) { locObj = json::object(); }
        }
        if (!locObj.is_object()) locObj = json::object();
        if (!locObj.contains("csv_messages") || !locObj["csv_messages"].is_object()) locObj["csv_messages"] = json::object();
        json catRows = db.query("SELECT key, translations_json, origin_vi FROM i18n_catalog WHERE status = 'approved'");
        int applied = 0;
        for (const auto& cr : catRows) {
            std::string k = getString(cr, "key");
            if (k.empty()) continue;
            json tr = json::parse(getString(cr, "translations_json", "{}"), nullptr, false);
            std::string val = (tr.is_object() && tr.contains(lang) && tr[lang].is_string()) ? tr[lang].get<std::string>() : "";
            if (val.empty()) continue;
            locObj["csv_messages"][k] = val;
            applied++;
        }
        std::string outBytes = locObj.dump(2) + "\n";
        try { fs::create_directories(webLoc.parent_path()); std::ofstream f1(webLoc, std::ios::binary); f1.write(outBytes.data(), static_cast<std::streamsize>(outBytes.size())); } catch (...) {}
        if (writeRootLoc) {
            try { fs::create_directories(rootLoc.parent_path()); std::ofstream f2(rootLoc, std::ios::binary); f2.write(outBytes.data(), static_cast<std::streamsize>(outBytes.size())); } catch (...) {}
        }
        replyTunnelJson(res, {{"success", true}, {"lang", lang}, {"published_keys", applied}, {"message", "Đã xuất bản /locales/" + lang + ".json trên Master!"}});
    });

    svr.Get("/i18n_studio.html", [](const httplib::Request&, httplib::Response& res) {
        fs::path p = SaleApp::Config::AppConfig::instance().getBaseDir().parent_path() / "docs" / "16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html";
        std::ifstream ifs(p, std::ios::binary);
        if (!ifs) { res.status = 404; return; }
        std::string content((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
        res.set_content(content, "text/html; charset=utf-8");
    });

    svr.Get("/i18n_studio_data.js", [](const httplib::Request&, httplib::Response& res) {
        fs::path p = SaleApp::Config::AppConfig::instance().getBaseDir().parent_path() / "docs" / "i18n_studio_data.js";
        std::ifstream ifs(p, std::ios::binary);
        if (!ifs) { res.status = 404; return; }
        std::string content((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
        res.set_content(content, "application/javascript; charset=utf-8");
    });

    svr.Get("/api/payment/vietqr_svg", [](const httplib::Request& req, httplib::Response& res) {
        std::string bankId = req.has_param("bank_id") ? req.get_param_value("bank_id") : "MB";
        std::string accNo = req.has_param("account_no") ? req.get_param_value("account_no") : "0918608073";
        std::string accName = req.has_param("account_name") ? req.get_param_value("account_name") : "CYBERNEXUS SAAS";
        std::string addInfo = req.has_param("add_info") ? req.get_param_value("add_info") : "GIA HAN SALEAPP";
        long long amount = 0;
        if (req.has_param("amount")) {
            try { amount = std::stoll(req.get_param_value("amount")); } catch (...) { amount = 0; }
        }
        std::string emv = SaleApp::VietQr::buildEmvCoPayload(bankId, accNo, amount, addInfo, accName);
        std::string svg = SaleApp::VietQr::buildOfflineVietQrSvg(emv, bankId, accNo, amount, addInfo, accName);
        res.set_header("Cache-Control", "no-store");
        res.set_content(svg, "image/svg+xml; charset=utf-8");
    });

    // Store OTA Patch & Manifest Endpoints
    svr.Get("/api/updates/latest", [](const httplib::Request&, httplib::Response& res) {
        fs::path updatesDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "updates";
        fs::path manifestPath = updatesDir / "manifest.json";
        fs::path zipPath = updatesDir / "patch_latest.zip";
        if (!fs::exists(manifestPath) || !fs::exists(zipPath)) {
            replyTunnelJson(res, {{"success", true}, {"has_patch", false}, {"manifest", json::object()}});
            return;
        }
        try {
            json manifest;
            std::ifstream mf(manifestPath.string());
            mf >> manifest;
            std::string mVer = manifest.value("version", "");
            std::string mTenant = manifest.value("target_tenant", "");
            if (!manifest.value("auto_publish", false) || !mTenant.empty() || mVer.find('-') != std::string::npos) {
                replyTunnelJson(res, {{"success", true}, {"has_patch", false}, {"manifest", json::object()}});
                return;
            }
            std::string zipSha256;
            try {
                std::ifstream zf(zipPath.string(), std::ios::binary);
                if (zf) {
                    std::ostringstream zss;
                    zss << zf.rdbuf();
                    zipSha256 = AuthService::sha256(zss.str());
                }
            } catch (...) {}
            replyTunnelJson(res, {
                {"success", true},
                {"has_patch", true},
                {"download_path", "/api/updates/download"},
                {"zip_size_bytes", fs::file_size(zipPath)},
                {"sha256", zipSha256},
                {"manifest", manifest}
            });
        } catch (const std::exception& e) {
            replyTunnelJson(res, {{"success", false}, {"message", e.what()}}, 500);
        }
    });

    // Backward-compatible alias for older Control Center builds (OTA-04: fallback to latest published archive if updates/manifest.json is stale)
    svr.Get("/api/updates/manifest", [](const httplib::Request&, httplib::Response& res) {
        fs::path updatesDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "updates";
        fs::path manifestPath = updatesDir / "manifest.json";
        try {
            json bestManifest = nullptr;
            if (fs::exists(manifestPath)) {
                std::ifstream mf(manifestPath.string());
                json m;
                mf >> m;
                std::string mVer = m.value("version", "");
                std::string mTenant = m.value("target_tenant", "");
                if (m.value("auto_publish", false) && mTenant.empty() && mVer.find('-') == std::string::npos) {
                    bestManifest = m;
                }
            }
            auto pubRow = Database::instance().queryRow("SELECT version FROM ota_releases WHERE release_status = 'published' AND COALESCE(target_tenant, '') = '' ORDER BY updated_at DESC, version DESC LIMIT 1");
            if (pubRow.is_object()) {
                std::string dbVer = pubRow.value("version", "");
                if (!dbVer.empty() && (bestManifest.is_null() || bestManifest.value("version", "") != dbVer)) {
                    fs::path archMf = updatesDir / "archive" / dbVer / "manifest.json";
                    if (fs::exists(archMf)) {
                        std::ifstream af(archMf.string());
                        af >> bestManifest;
                    }
                }
            }
            if (bestManifest.is_null()) {
                replyTunnelJson(res, {{"version", ""}, {"has_patch", false}, {"auto_publish", false}});
                return;
            }
            replyTunnelJson(res, bestManifest);
        } catch (const std::exception& e) {
            replyTunnelJson(res, {{"success", false}, {"message", e.what()}}, 500);
        }
    });

    svr.Get("/api/updates/download", [](const httplib::Request& req, httplib::Response& res) {
        fs::path updatesDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "updates";
        fs::path zipPath = updatesDir / "patch_latest.zip";
        std::string filename = "patch_latest.zip";
        if (req.has_param("version")) {
            std::string ver = req.get_param_value("version");
            if (!ver.empty() && ver.find("..") == std::string::npos && ver.find('/') == std::string::npos && ver.find('\\') == std::string::npos) {
                fs::path archZip = updatesDir / "archive" / ver / "patch.zip";
                if (fs::exists(archZip)) {
                    zipPath = archZip;
                    filename = "patch_v" + ver + ".zip";
                }
            }
        }
        if (!fs::exists(zipPath)) {
            res.status = 404;
            res.set_content("No patch_latest.zip available", "text/plain");
            return;
        }
        std::ifstream ifs(zipPath.string(), std::ios::binary);
        std::string content((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
        res.set_header("X-Package-SHA256", AuthService::sha256(content));
        res.set_header("Content-Disposition", "attachment; filename=\"" + filename + "\"");
        res.set_content(content, "application/zip");
    });

    // Self-Service Store Billing (Gia hạn gói & Mua thêm AI Credit qua VietQR)
    auto ensureBillingSchema = [](Database& db) {
        db.execute(R"(
            CREATE TABLE IF NOT EXISTS saas_billing_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_code TEXT UNIQUE NOT NULL,
                tenant_id INTEGER NOT NULL,
                tenant_code TEXT DEFAULT '',
                store_name TEXT DEFAULT '',
                billing_type TEXT DEFAULT 'renew_plan',
                quantity INTEGER DEFAULT 1,
                amount_vnd REAL DEFAULT 0,
                status TEXT DEFAULT 'pending',
                payment_ref TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                paid_at TEXT DEFAULT ''
            )
        )");
    };

    auto applyBillingPaid = [](Database& db, const json& ord, const std::string& payRef) {
        int64_t ordId = ord.value("id", int64_t(0));
        int64_t tid = ord.value("tenant_id", int64_t(0));
        std::string bType = ord.value("billing_type", "renew_plan");
        int qty = std::max(1, ord.value("quantity", 1));

        db.beginTransaction();
        db.execute("UPDATE saas_billing_orders SET status = 'paid', payment_ref = :pref, paid_at = datetime('now', 'localtime') WHERE id = :id",
            {{":pref", payRef}, {":id", ordId}});
        if (bType == "buy_ai_credits") {
            db.execute("UPDATE saas_tenants SET ai_bonus_credits = COALESCE(ai_bonus_credits, 0) + :q WHERE id = :tid",
                {{":q", qty}, {":tid", tid}});
        } else {
            db.execute(
                "UPDATE saas_tenants SET "
                "expire_date = date(CASE WHEN expire_date IS NOT NULL AND expire_date > date('now', 'localtime') THEN expire_date ELSE date('now', 'localtime') END, '+' || :m || ' months'), "
                "subscription_status = 'active' "
                "WHERE id = :tid",
                {{":m", qty}, {":tid", tid}}
            );
        }
        double amtVnd = ord.value("amount_vnd", 0.0);
        if (amtVnd > 0.0) {
            try {
                db.execute(
                    "INSERT INTO saas_invoices (tenant_id, invoice_code, amount, payment_method, payment_status, paid_at, note) "
                    "VALUES (:tid, :ic, :amt, 'vietqr_auto', 'paid', datetime('now', 'localtime'), :nt)",
                    {{":tid", tid}, {":ic", ord.value("order_code", "")}, {":amt", amtVnd}, {":nt", "Self-service billing (" + bType + ")"}}
                );
            } catch (...) {}
        }
        db.commit();
    };

    svr.Post("/api/billing/create_order", [ensureBillingSchema](const httplib::Request& req, httplib::Response& res) {
        try {
            json body = json::parse(req.body);
            std::string licKey = body.value("license_key", "");
            std::string bType = body.value("billing_type", "renew_plan");
            int qty = std::max(1, body.value("quantity", 1));
            if (licKey.empty()) {
                replyTunnelJson(res, {{"success", false}, {"message", "Thiếu license_key!"}}, 400);
                return;
            }
            auto& db = Database::instance();
            ensureBillingSchema(db);
            auto tenant = db.queryRow("SELECT * FROM saas_tenants WHERE license_key = :lk LIMIT 1", {{":lk", licKey}});
            if (tenant.is_null()) {
                replyTunnelJson(res, {{"success", false}, {"message", "Không tìm thấy hồ sơ cửa hàng!"}}, 404);
                return;
            }
            int64_t tid = tenant.value("id", int64_t(0));
            std::string tCode = tenant.value("tenant_code", "");
            std::string sName = tenant.value("store_name", "");

            double amount = 0.0;
            if (bType == "buy_ai_credits") {
                if (qty >= 1000) amount = qty * 800.0;
                else if (qty >= 500) amount = qty * 900.0;
                else amount = qty * 1000.0;
            } else {
                bType = "renew_plan";
                double monthly = 299000.0;
                if (qty >= 12) amount = std::round(monthly * qty * 0.85);
                else if (qty >= 6) amount = std::round(monthly * qty * 0.90);
                else amount = monthly * qty;
            }

            std::time_t tNow = std::time(nullptr);
            std::tm tmBuf{};
#ifdef _WIN32
            localtime_s(&tmBuf, &tNow);
#else
            localtime_r(&tNow, &tmBuf);
#endif
            char compact[16]{};
            std::strftime(compact, sizeof(compact), "%y%m%d", &tmBuf);
            std::string compactStr(compact);
            auto seqVal = db.queryScalar("SELECT COUNT(*) FROM saas_billing_orders WHERE order_code LIKE 'SAAS" + compactStr + "%'");
            int64_t seq = (seqVal.is_number() ? seqVal.get<int64_t>() : 0) + 1;
            std::ostringstream oss;
            oss << "SAAS" << compactStr << std::setw(4) << std::setfill('0') << seq;
            std::string orderCode = oss.str();

            db.execute(
                "INSERT INTO saas_billing_orders (order_code, tenant_id, tenant_code, store_name, billing_type, quantity, amount_vnd, status, created_at) "
                "VALUES (:oc, :tid, :tc, :sn, :bt, :q, :amt, 'pending', datetime('now', 'localtime'))",
                {{":oc", orderCode}, {":tid", tid}, {":tc", tCode}, {":sn", sName}, {":bt", bType}, {":q", qty}, {":amt", amount}}
            );

            auto getSetting = [&](const std::string& k, const std::string& def) -> std::string {
                auto r = db.queryRow("SELECT setting_value FROM master_settings WHERE setting_key = :k", {{":k", k}});
                if (!r.is_null() && !r.value("setting_value", "").empty()) return r.value("setting_value", "");
                return def;
            };
            std::string bankId = getSetting("saas_bank_id", "OCB");
            std::string bankAcc = getSetting("saas_bank_account", "0918608073");
            std::string bankName = getSetting("saas_bank_name", "NGUYEN CHI HUNG");
            std::string note = orderCode + " " + tCode;
            std::string vietqrUrl = "https://img.vietqr.io/image/" + bankId + "-" + bankAcc + "-compact2.png?amount="
                + std::to_string(static_cast<int64_t>(amount)) + "&addInfo=" + httplib::detail::encode_url(note)
                + "&accountName=" + httplib::detail::encode_url(bankName);

            replyTunnelJson(res, {
                {"success", true},
                {"order_code", orderCode},
                {"billing_type", bType},
                {"quantity", qty},
                {"amount_vnd", amount},
                {"vietqr_url", vietqrUrl},
                {"bank_info", {{"bank_id", bankId}, {"account_no", bankAcc}, {"account_name", bankName}, {"note", note}}}
            });
        } catch (const std::exception& e) {
            replyTunnelJson(res, {{"success", false}, {"message", e.what()}}, 500);
        }
    });

    svr.Get("/api/billing/status", [ensureBillingSchema](const httplib::Request& req, httplib::Response& res) {
        std::string orderCode = req.has_param("order_code") ? req.get_param_value("order_code") : "";
        if (orderCode.empty()) {
            replyTunnelJson(res, {{"success", false}, {"message", "Thiếu order_code"}}, 400);
            return;
        }
        auto& db = Database::instance();
        ensureBillingSchema(db);
        auto ord = db.queryRow("SELECT * FROM saas_billing_orders WHERE order_code = :oc LIMIT 1", {{":oc", orderCode}});
        if (ord.is_null()) {
            replyTunnelJson(res, {{"success", false}, {"message", "Không tìm thấy đơn thanh toán"}}, 404);
            return;
        }
        replyTunnelJson(res, {{"success", true}, {"order", ord}});
    });

    svr.Post("/api/billing/webhook", [ensureBillingSchema, applyBillingPaid](const httplib::Request& req, httplib::Response& res) {
        try {
            auto& db = Database::instance();
            auto secRow = db.queryRow("SELECT setting_value FROM saas_settings WHERE setting_key = 'billing_webhook_secret' LIMIT 1");
            std::string expectedSec = secRow.is_null() ? "" : secRow.value("setting_value", "");
            std::string gotSec = req.has_header("X-Billing-Secret") ? req.get_header_value("X-Billing-Secret") : "";
            if (!expectedSec.empty() && gotSec != expectedSec) {
                replyTunnelJson(res, {{"success", false}, {"message", "Invalid webhook secret"}}, 401);
                return;
            }
            json body = json::parse(req.body);
            std::string orderCode = body.value("order_code", "");
            std::string payRef = body.value("payment_ref", "AUTO_WEBHOOK");
            double amt = body.value("amount", 0.0);
            ensureBillingSchema(db);
            auto ord = db.queryRow("SELECT * FROM saas_billing_orders WHERE order_code = :oc LIMIT 1", {{":oc", orderCode}});
            if (ord.is_null()) {
                replyTunnelJson(res, {{"success", false}, {"message", "Không tìm thấy order_code"}}, 404);
                return;
            }
            if (ord.value("status", "") == "paid") {
                replyTunnelJson(res, {{"success", true}, {"message", "Đơn đã được thanh toán trước đó."}});
                return;
            }
            if (amt > 0 && amt + 1.0 < ord.value("amount_vnd", 0.0)) {
                replyTunnelJson(res, {{"success", false}, {"message", "Số tiền thanh toán chưa đủ!"}}, 400);
                return;
            }
            applyBillingPaid(db, ord, payRef);
            replyTunnelJson(res, {{"success", true}, {"message", "Đã kích hoạt gia hạn / nạp AI Credit thành công!"}});
        } catch (const std::exception& e) {
            replyTunnelJson(res, {{"success", false}, {"message", e.what()}}, 500);
        }
    });

    svr.Get("/api/billing/orders", [ensureBillingSchema](const httplib::Request& req, httplib::Response& res) {
        json su = getSaSessionUser(req);
        auto userOpt = AuthService::instance().authenticate(req);
        bool isSa = (!su.is_null() && su.is_object()) || (userOpt && userOpt->is_super_admin);
        if (!isSa) {
            replyTunnelJson(res, {{"success", false}, {"message", "Unauthorized"}}, 403);
            return;
        }
        auto& db = Database::instance();
        ensureBillingSchema(db);
        json rows = db.query("SELECT * FROM saas_billing_orders ORDER BY id DESC LIMIT 50");
        replyTunnelJson(res, {{"success", true}, {"data", rows}});
    });

    svr.Post("/api/billing/confirm", [ensureBillingSchema, applyBillingPaid](const httplib::Request& req, httplib::Response& res) {
        json su = getSaSessionUser(req);
        auto userOpt = AuthService::instance().authenticate(req);
        bool isSa = (!su.is_null() && su.is_object()) || (userOpt && userOpt->is_super_admin);
        if (!isSa) {
            replyTunnelJson(res, {{"success", false}, {"message", "Unauthorized"}}, 403);
            return;
        }
        try {
            json body = json::parse(req.body);
            std::string orderCode = body.value("order_code", "");
            auto& db = Database::instance();
            ensureBillingSchema(db);
            auto ord = db.queryRow("SELECT * FROM saas_billing_orders WHERE order_code = :oc LIMIT 1", {{":oc", orderCode}});
            if (ord.is_null()) {
                replyTunnelJson(res, {{"success", false}, {"message", "Không tìm thấy đơn"}}, 404);
                return;
            }
            if (ord.value("status", "") != "paid") {
                applyBillingPaid(db, ord, "SUPERADMIN_MANUAL");
            }
            replyTunnelJson(res, {{"success", true}, {"message", "Đã duyệt thanh toán & cộng hạn/credit cho quán!"}});
        } catch (const std::exception& e) {
            replyTunnelJson(res, {{"success", false}, {"message", e.what()}}, 500);
        }
    });

    // ==========================================
    // SYNC-01: ON-DEMAND MYSQL BACKUP & PER-STORE SCHEMA PROVISIONING
    // ==========================================
    auto loadMysqlCfg = [](Database& db, std::string& host, std::string& port, std::string& user, std::string& pass) {
        host = "127.0.0.1";
        port = "3306";
        user = "root";
        pass = "";
        auto rows = db.query("SELECT setting_key, setting_value FROM saas_settings WHERE setting_key LIKE 'mysql_backup_%'");
        for (const auto& r : rows) {
            std::string k = r.value("setting_key", "");
            std::string v = r.value("setting_value", "");
            if (k == "mysql_backup_host" && !v.empty()) host = v;
            else if (k == "mysql_backup_port" && !v.empty()) port = v;
            else if (k == "mysql_backup_user" && !v.empty()) user = v;
            else if (k == "mysql_backup_pass_enc" && !v.empty()) {
                pass = CyberNexus::PinVault::decryptPinForLicense(v, "CYBERNEXUS_MYSQL_MASTER_KEY");
            }
        }
    };

    auto runMysqlWorker = [](const std::vector<std::string>& args) -> json {
        fs::path baseDir = SaleApp::Config::AppConfig::instance().getBaseDir();
        std::vector<fs::path> candidates = {
            baseDir / "tools" / "mysql_backup_sync.py",
            baseDir.parent_path() / "tools" / "mysql_backup_sync.py",
            baseDir.parent_path().parent_path() / "tools" / "mysql_backup_sync.py",
            fs::current_path() / "tools" / "mysql_backup_sync.py"
        };
        fs::path scriptPath;
        std::error_code ec;
        for (const auto& c : candidates) {
            if (fs::exists(c, ec)) { scriptPath = c; break; }
        }
        if (scriptPath.empty()) {
            return {{"success", false}, {"message", "Không tìm thấy worker tools/mysql_backup_sync.py trên Master!"}};
        }
        auto qArg = [](const std::string& s) {
            std::string out = "\"";
            for (char c : s) {
                if (c == '"') out += "\\\"";
                else if (c != '\r' && c != '\n') out += c;
            }
            out += "\"";
            return out;
        };
        std::string cmd = "python " + qArg(scriptPath.string());
        for (const auto& a : args) cmd += " " + qArg(a);
        cmd += " 2>&1";
#ifdef _WIN32
        FILE* pipe = _popen(cmd.c_str(), "r");
#else
        FILE* pipe = popen(cmd.c_str(), "r");
#endif
        if (!pipe) return {{"success", false}, {"message", "Không thể khởi chạy Python worker MySQL!"}};
        std::string out;
        char buf[1024];
        while (fgets(buf, sizeof(buf), pipe)) out += buf;
#ifdef _WIN32
        _pclose(pipe);
#else
        pclose(pipe);
#endif
        size_t jpos = out.rfind('{');
        if (jpos != std::string::npos) {
            try { return json::parse(out.substr(jpos)); } catch (...) {}
        }
        return {{"success", false}, {"message", out.empty() ? "Worker không trả dữ liệu" : out.substr(0, 300)}};
    };

    svr.Get("/api/admin/mysql_backup_config", [loadMysqlCfg](const httplib::Request& req, httplib::Response& res) {
        json su = getSaSessionUser(req);
        if (su.is_null() || !su.is_object()) { sendJson(res, {{"success", false}, {"message", "Chưa đăng nhập SuperAdmin!"}}, 401); return; }
        auto& db = Database::instance();
        std::string host, port, user, pass;
        loadMysqlCfg(db, host, port, user, pass);
        sendJson(res, {{"success", true}, {"data", {{"host", host}, {"port", port}, {"user", user}, {"has_password", !pass.empty()}}}});
    });

    svr.Post("/api/admin/mysql_backup_config", [loadMysqlCfg, runMysqlWorker](const httplib::Request& req, httplib::Response& res) {
        json su = getSaSessionUser(req);
        if (su.is_null() || !su.is_object()) { sendJson(res, {{"success", false}, {"message", "Chưa đăng nhập SuperAdmin!"}}, 401); return; }
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = body.value("action", "save");
        std::string host = body.value("host", "127.0.0.1");
        std::string port = body.value("port", "3306");
        std::string user = body.value("user", "root");
        std::string pass = body.value("password", "");
        if (pass.empty()) {
            std::string oh, op, ou, opass;
            loadMysqlCfg(db, oh, op, ou, opass);
            pass = opass;
        }
        if (action == "test") {
            json r = runMysqlWorker({"test", "--host", host, "--port", port, "--user", user, "--password", pass});
            sendJson(res, r, r.value("success", false) ? 200 : 400);
            return;
        }
        auto upsert = [&](const std::string& k, const std::string& v) {
            db.execute(
                "INSERT INTO saas_settings (setting_key, setting_value) VALUES (:k, :v) "
                "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                {{":k", k}, {":v", v}}
            );
        };
        upsert("mysql_backup_host", host);
        upsert("mysql_backup_port", port);
        upsert("mysql_backup_user", user);
        if (!pass.empty()) {
            upsert("mysql_backup_pass_enc", CyberNexus::PinVault::encryptPinForLicense(pass, "CYBERNEXUS_MYSQL_MASTER_KEY"));
        }
        sendJson(res, {{"success", true}, {"message", "Đã lưu cấu hình MySQL Backup Server (mật khẩu đã mã hóa AES-256)!"}});
    });

    svr.Post("/api/admin/tenants/mysql_backup", [loadMysqlCfg, runMysqlWorker](const httplib::Request& req, httplib::Response& res) {
        json su = getSaSessionUser(req);
        if (su.is_null() || !su.is_object()) { sendJson(res, {{"success", false}, {"message", "Chưa đăng nhập SuperAdmin!"}}, 401); return; }
        auto& db = Database::instance();
        json body = parseBody(req);
        int64_t tid = body.value("tenant_id", int64_t(0));
        std::string action = body.value("action", "status");
        if (tid <= 0) { sendJson(res, {{"success", false}, {"message", "Thiếu tenant_id!"}}, 400); return; }
        auto tRow = db.queryRow("SELECT id, tenant_code, store_name, license_key, default_pin_enc, mysql_backup_enabled, mysql_schema, mysql_user, last_mysql_sync_at, last_mysql_sync_status, last_mysql_sync_summary, last_slave_db_stats FROM saas_tenants WHERE id = :id LIMIT 1", {{":id", tid}});
        if (tRow.is_null()) { sendJson(res, {{"success", false}, {"message", "Không tìm thấy quán!"}}, 404); return; }

        std::string tCode = (tRow.contains("tenant_code") && tRow["tenant_code"].is_string()) ? tRow["tenant_code"].get<std::string>() : "store";
        std::string codeLower = tCode;
        std::transform(codeLower.begin(), codeLower.end(), codeLower.begin(), [](unsigned char c) { return (char)std::tolower(c); });
        std::string schemaName = "cn_store_" + codeLower;
        std::string storeUser = codeLower;

        if (action == "toggle") {
            int enable = body.value("enabled", 0) ? 1 : 0;
            if (enable == 1) {
                std::string host, port, user, pass;
                loadMysqlCfg(db, host, port, user, pass);
                std::string lk = (tRow.contains("license_key") && tRow["license_key"].is_string()) ? tRow["license_key"].get<std::string>() : "";
                std::string pinEnc = (tRow.contains("default_pin_enc") && tRow["default_pin_enc"].is_string()) ? tRow["default_pin_enc"].get<std::string>() : "";
                std::string pin6 = CyberNexus::PinVault::decryptPinForLicense(pinEnc, lk);
                if (pin6.empty()) pin6 = "123456";
                json prov = runMysqlWorker({"provision", "--host", host, "--port", port, "--user", user, "--password", pass, "--schema", schemaName, "--store-user", storeUser, "--store-pass", pin6});
                if (!prov.value("success", false)) { sendJson(res, prov, 400); return; }
                db.execute("UPDATE saas_tenants SET mysql_backup_enabled = 1, mysql_schema = :sc, mysql_user = :su WHERE id = :id",
                    {{":sc", prov.value("schema", schemaName)}, {":su", prov.value("mysql_user", storeUser + "@localhost")}, {":id", tid}});
                sendJson(res, prov);
                return;
            } else {
                db.execute("UPDATE saas_tenants SET mysql_backup_enabled = 0 WHERE id = :id", {{":id", tid}});
                sendJson(res, {{"success", true}, {"message", "Đã TẮT chế độ sao lưu MySQL cho quán " + tCode + "!"}});
                return;
            }
        }

        if (action == "sync_now") {
            if (tRow.value("mysql_backup_enabled", 0) != 1) {
                sendJson(res, {{"success", false}, {"message", "Vui lòng BẬT chế độ sao lưu MySQL cho quán này trước khi đồng bộ!"}}, 400);
                return;
            }
            StoreTunnelManager::instance().enqueueCommand(tid, "SYNC_DB_BACKUP", {{"schema", schemaName}}, true);
            db.execute("UPDATE saas_tenants SET last_mysql_sync_status = 'pending' WHERE id = :id", {{":id", tid}});
            sendJson(res, {{"success", true}, {"message", "Đã gửi lệnh ĐỒNG BỘ CSDL tức thì xuống quán " + tCode + " (chỉ quán này thực thi)."}});
            return;
        }

        if (action == "verify") {
            bool pullFresh = body.value("pull_fresh", true);
            if (pullFresh) StoreTunnelManager::instance().enqueueCommand(tid, "CHECK_DB_SYNC", json::object(), true);
            std::string host, port, user, pass;
            loadMysqlCfg(db, host, port, user, pass);
            std::string slaveStats = (tRow.contains("last_slave_db_stats") && tRow["last_slave_db_stats"].is_string()) ? tRow["last_slave_db_stats"].get<std::string>() : "";
            json ver = runMysqlWorker({"verify", "--host", host, "--port", port, "--user", user, "--password", pass, "--schema", schemaName, "--slave-stats", slaveStats});
            ver["pull_dispatched"] = pullFresh;
            sendJson(res, ver, ver.value("success", false) ? 200 : 400);
            return;
        }

        sendJson(res, {{"success", true}, {"data", tRow}});
    });

    svr.Post("/api/slave/db_stats", [](const httplib::Request& req, httplib::Response& res) {
        try {
            std::string lKey = req.has_header("X-License-Key") ? req.get_header_value("X-License-Key") : "";
            json body = parseBody(req);
            if (lKey.empty()) lKey = body.value("license_key", "");
            if (lKey.empty()) { replyTunnelJson(res, {{"success", false}, {"message", "Thiếu license_key"}}, 400); return; }
            auto& db = Database::instance();
            auto tenant = db.queryRow("SELECT id FROM saas_tenants WHERE license_key = :k LIMIT 1", {{":k", lKey}});
            if (tenant.is_null()) { replyTunnelJson(res, {{"success", false}, {"message", "License Key không hợp lệ"}}, 403); return; }
            int64_t tid = tenant.value("id", int64_t(0));
            db.execute("UPDATE saas_tenants SET last_slave_db_stats = :s WHERE id = :id", {{":s", body.dump()}, {":id", tid}});
            replyTunnelJson(res, {{"success", true}});
        } catch (const std::exception& e) {
            replyTunnelJson(res, {{"success", false}, {"message", e.what()}}, 500);
        }
    });

    // Cloud Backup Upload from Slave (SQLite snapshot + On-Demand MySQL import)
    svr.Post("/api/slave/backup", [loadMysqlCfg, runMysqlWorker](const httplib::Request& req, httplib::Response& res) {
        try {
            std::string lKey = req.has_header("X-License-Key") ? req.get_header_value("X-License-Key") : "";
            std::string mid = req.has_header("X-Machine-Id") ? req.get_header_value("X-Machine-Id") : "";
            if (lKey.empty() || req.body.empty()) {
                replyTunnelJson(res, {{"success", false}, {"message", "Thiếu license_key hoặc dữ liệu backup!"}}, 400);
                return;
            }
            auto& db = Database::instance();
            auto tenant = db.queryRow("SELECT id, tenant_code, machine_id, mysql_backup_enabled, mysql_schema FROM saas_tenants WHERE license_key = :k LIMIT 1", {{":k", lKey}});
            if (tenant.is_null()) {
                replyTunnelJson(res, {{"success", false}, {"message", "License Key không hợp lệ!"}}, 403);
                return;
            }
            std::string boundMid = (tenant.contains("machine_id") && tenant["machine_id"].is_string()) ? tenant["machine_id"].get<std::string>() : "";
            if (!boundMid.empty() && !mid.empty() && boundMid != mid) {
                replyTunnelJson(res, {{"success", false}, {"message", "Hardware ID không khớp!"}}, 403);
                return;
            }
            std::string tCode = tenant.value("tenant_code", "STORE");
            fs::path backupRoot = SaleApp::Config::AppConfig::instance().getBaseDir() / "backups" / tCode;
            std::error_code ec;
            fs::create_directories(backupRoot, ec);
            auto now = std::time(nullptr);
            std::tm tmBuf{};
#ifdef _WIN32
            localtime_s(&tmBuf, &now);
#else
            localtime_r(&now, &tmBuf);
#endif
            char ts[32];
            std::strftime(ts, sizeof(ts), "%Y%m%d_%H%M%S", &tmBuf);
            std::string fname = std::string("store_local_") + ts + ".db";
            fs::path outPath = backupRoot / fname;
            std::ofstream ofs(outPath, std::ios::binary | std::ios::trunc);
            if (!ofs.is_open()) {
                replyTunnelJson(res, {{"success", false}, {"message", "Không thể ghi file backup trên Master!"}}, 500);
                return;
            }
            ofs.write(req.body.data(), static_cast<std::streamsize>(req.body.size()));
            ofs.close();

            int64_t tid = tenant.value("id", int64_t(0));
            bool triggerMysql = (tenant.value("mysql_backup_enabled", 0) == 1) && (req.has_header("X-Trigger-Mysql-Sync") && req.get_header_value("X-Trigger-Mysql-Sync") == "1");
            if (triggerMysql && tid > 0) {
                std::string codeLower = tCode;
                std::transform(codeLower.begin(), codeLower.end(), codeLower.begin(), [](unsigned char c) { return (char)std::tolower(c); });
                std::string schemaName = (tenant.contains("mysql_schema") && tenant["mysql_schema"].is_string()) ? tenant["mysql_schema"].get<std::string>() : "";
                if (schemaName.empty()) schemaName = "cn_store_" + codeLower;
                std::string host, port, user, pass;
                loadMysqlCfg(db, host, port, user, pass);
                std::string dbFileStr = outPath.string();
                std::thread([tid, schemaName, host, port, user, pass, dbFileStr, runMysqlWorker]() {
                    json imp = runMysqlWorker({"import", "--host", host, "--port", port, "--user", user, "--password", pass, "--schema", schemaName, "--sqlite", dbFileStr});
                    std::string st = imp.value("success", false) ? "ok" : "error";
                    std::string msg = imp.value("message", "");
                    try {
                        Database::instance().execute(
                            "UPDATE saas_tenants SET last_mysql_sync_at = datetime('now','localtime'), last_mysql_sync_status = :st, last_mysql_sync_summary = :sm WHERE id = :id",
                            {{":st", st}, {":sm", msg}, {":id", tid}}
                        );
                    } catch (...) {}
                }).detach();
            }

            replyTunnelJson(res, {
                {"success", true},
                {"message", triggerMysql ? "Đã nhận snapshot & đang đổ dữ liệu vào MySQL schema quán!" : "Đã sao lưu dữ liệu quán lên Master thành công!"},
                {"filename", fname},
                {"size_bytes", req.body.size()},
                {"mysql_import_started", triggerMysql}
            });
        } catch (const std::exception& e) {
            replyTunnelJson(res, {{"success", false}, {"message", e.what()}}, 500);
        }
    });
}

} // namespace SaleApp::Backend
