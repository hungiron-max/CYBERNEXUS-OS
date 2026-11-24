#include <iostream>
#include <fstream>
#include <filesystem>
#include <csignal>
#include <cstdlib>
#include <thread>
#include <chrono>
#include <atomic>
#include "httplib.h"
#include "db.hpp"
#include "license.hpp"
#include "auth.hpp"
#include "slave_handlers.hpp"
#include "slave_tunnel.h"
#include "pin_vault.hpp"
#include "slave_net_info.h"
#include "slave_updater.h"
#include "ConfigManager.hpp"
#include "PluginManager.hpp"
#include <random>
#include <mutex>

namespace fs = std::filesystem;
using namespace SaleApp::Backend;
using namespace SaleApp::Config;

static std::mutex g_webIntegrityMtx;
static nlohmann::json g_lastWebIntegrityReport = {
    {"ok", true}, {"checked_count", 0}, {"mismatched_files", nlohmann::json::array()}, {"missing_files", nlohmann::json::array()}, {"checked_at", ""}
};

static nlohmann::json verifyWebIntegrity(const fs::path& webRoot) {
    nlohmann::json report = {
        {"ok", true},
        {"has_manifest", false},
        {"checked_count", 0},
        {"mismatched_files", nlohmann::json::array()},
        {"missing_files", nlohmann::json::array()},
        {"checked_at", ""}
    };
    std::time_t nowT = std::time(nullptr);
    char tBuf[32];
    std::strftime(tBuf, sizeof(tBuf), "%Y-%m-%d %H:%M:%S", std::localtime(&nowT));
    report["checked_at"] = std::string(tBuf);

    fs::path manifestPath = webRoot / "web_integrity.json";
    if (!fs::exists(manifestPath)) {
        std::lock_guard<std::mutex> lk(g_webIntegrityMtx);
        g_lastWebIntegrityReport = report;
        return report;
    }
    report["has_manifest"] = true;
    try {
        std::ifstream mf(manifestPath, std::ios::binary);
        nlohmann::json manifest;
        mf >> manifest;
        nlohmann::json filesMap = (manifest.is_object() && manifest.contains("files") && manifest["files"].is_object())
            ? manifest["files"] : manifest;
        int checked = 0;
        for (auto it = filesMap.begin(); it != filesMap.end(); ++it) {
            if (!it.value().is_string()) continue;
            std::string rel = it.key();
            if (rel == "version" || rel == "generated_at") continue;
            std::string expectedSha = it.value().get<std::string>();
            fs::path fp = webRoot / fs::u8path(rel);
            checked++;
            if (!fs::exists(fp)) {
                report["ok"] = false;
                report["missing_files"].push_back(rel);
                continue;
            }
            std::ifstream ifs(fp, std::ios::binary);
            std::string content((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
            std::string actualSha = SaleApp::Backend::AuthService::sha256(content);
            if (actualSha != expectedSha) {
                report["ok"] = false;
                report["mismatched_files"].push_back({{"file", rel}, {"expected", expectedSha}, {"actual", actualSha}});
            }
        }
        report["checked_count"] = checked;
    } catch (const std::exception& e) {
        report["ok"] = false;
        report["error"] = e.what();
    }
    {
        std::lock_guard<std::mutex> lk(g_webIntegrityMtx);
        g_lastWebIntegrityReport = report;
    }
    return report;
}

static httplib::Server* g_server = nullptr;

void signalHandler(int signum) {
    std::cout << "\n[Slave] Nhan tin hieu dung (" << signum << "), dang dong may chu an toan..." << std::endl;
    if (g_server) g_server->stop();
    Database::instance().close();
    std::cout << "[Slave] May chu POS Slave da dung hoan toan." << std::endl;
    exit(0);
}

int main(int argc, char* argv[]) {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
#endif

    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    // 1. Khoi tao ConfigManager cho role Slave
    auto& config = AppConfig::instance();
    config.init("slave", argc, argv);
    config.printBanner();

    // 2. Mở CSDL nội bộ của quán trước khi khởi tạo LicenseService để chạy migration schema đúng thứ tự
    std::string dbPath = config.getDatabasePath().string();
    if (!Database::instance().open(dbPath)) {
        std::cerr << "[CRITICAL Slave] Khong the mo CSDL POS tai: " << dbPath << std::endl;
        return 1;
    }
    std::cout << "[DB Slave] Mo CSDL POS thanh cong: " << dbPath << std::endl;

    // 3. Chế độ Slave POS: SuperAdmin bị vô hiệu hóa 100% & đảm bảo cột schema local_license_cache
    LicenseService::instance().setSuperAdminMode(false);
    LicenseService::instance().ensureTableExists();

    // Reset toàn bộ phiên đăng nhập & trạng thái online khi khởi động máy chủ mới
    AuthService::instance().clearAllSessions();
    try {
        Database::instance().execute("UPDATE users SET is_online = 0");
        Database::instance().execute(R"(
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_code TEXT NOT NULL,
                action_label TEXT NOT NULL,
                severity TEXT DEFAULT 'WARN',
                order_id INTEGER DEFAULT 0,
                order_code TEXT DEFAULT '',
                table_code TEXT DEFAULT '',
                amount_impact REAL DEFAULT 0,
                reason TEXT DEFAULT '',
                user_id INTEGER DEFAULT 0,
                user_name TEXT DEFAULT '',
                user_role TEXT DEFAULT '',
                details TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        )");
        Database::instance().execute(R"(
            CREATE TABLE IF NOT EXISTS pos_shifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shift_code TEXT NOT NULL,
                user_id INTEGER DEFAULT 0,
                user_name TEXT DEFAULT '',
                opened_at TEXT NOT NULL,
                closed_at TEXT DEFAULT NULL,
                opening_cash REAL DEFAULT 0,
                cash_sales REAL DEFAULT 0,
                banking_sales REAL DEFAULT 0,
                card_sales REAL DEFAULT 0,
                cash_in REAL DEFAULT 0,
                cash_out REAL DEFAULT 0,
                expected_cash REAL DEFAULT 0,
                actual_cash REAL DEFAULT 0,
                discrepancy REAL DEFAULT 0,
                note TEXT DEFAULT '',
                status TEXT DEFAULT 'open'
            )
        )");
        Database::instance().execute(R"(
            CREATE TABLE IF NOT EXISTS cash_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shift_id INTEGER DEFAULT 0,
                trans_type TEXT NOT NULL,
                category TEXT DEFAULT 'Chi phí tại quầy',
                amount REAL DEFAULT 0,
                reason TEXT DEFAULT '',
                user_id INTEGER DEFAULT 0,
                user_name TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        )");
        Database::instance().execute(R"(
            CREATE TABLE IF NOT EXISTS finance_expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                expense_date TEXT NOT NULL,
                category TEXT DEFAULT 'Khác',
                description TEXT DEFAULT '',
                supplier TEXT DEFAULT '',
                amount REAL DEFAULT 0,
                vat_amount REAL DEFAULT 0,
                created_by TEXT DEFAULT 'admin',
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        )");
    } catch (...) {}

    // 4. Khởi tạo HTTP Server
    httplib::Server svr;
    g_server = &svr;

    svr.set_default_headers({
        {"X-Content-Type-Options", "nosniff"},
        {"X-Frame-Options", "SAMEORIGIN"},
        {"Referrer-Policy", "strict-origin-when-cross-origin"},
        {"Access-Control-Allow-Origin", "*"},
        {"Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"},
        {"Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key"},
        {"Content-Security-Policy", "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' ws: wss: http://127.0.0.1:* http://localhost:*; object-src 'none'; base-uri 'self'; frame-ancestors 'self';"}
    });

    svr.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        res.status = 204;
    });

    // BẢO MẬT HARDWARE NODE-LOCK, TRẠNG THÁI THUÊ BAO (ARCH-04), SMART IPS 3 BẬC (NET-13) & KHO NHẠC:
    svr.set_payload_max_length(15 * 1024 * 1024); // ANTISPAM-07: Trần cứng 15MB cho upload nhạc Admin, API thường chặn > 2MB bên trong
    svr.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        const std::string& p = req.path;
        if (req.method == "OPTIONS") return httplib::Server::HandlerResponse::Unhandled;

        // ANTISPAM-07: Chống Payload Flood (> 2MB cho mọi API không phải upload media)
        bool isUploadPath = (p.find("/upload") != std::string::npos);
        if (!isUploadPath && req.body.size() > 2 * 1024 * 1024) {
            res.status = 413;
            res.set_content("{\"success\":false,\"code\":\"PAYLOAD_TOO_LARGE\",\"message\":\"Dữ liệu gửi lên vượt quá giới hạn an toàn (2MB)!\"}", "application/json; charset=utf-8");
            return httplib::Server::HandlerResponse::Handled;
        }

        // NET-13: Smart IPS & Auto-Ban 3 bậc (chỉ áp dụng cho IP không phải localhost / Nội bộ ∞)
        {
            const std::string& rip = req.remote_addr;
            bool isLocal = (rip.empty() || rip == "127.0.0.1" || rip == "::1" || rip == "localhost" || rip == "::ffff:127.0.0.1");
            if (!isLocal && p.rfind("/api/health", 0) != 0) {
                struct IpsState {
                    std::time_t winStart{0};
                    int winCount{0};
                    int strikes{0};
                    std::time_t quarantineUntil{0};
                };
                static std::mutex s_ipsMtx;
                static std::unordered_map<std::string, IpsState> s_ipsMap;
                static std::time_t s_wlRefresh{0};
                static std::vector<std::string> s_ipsWl;
                static std::string s_ipsPosIp;

                std::time_t nowIps = std::time(nullptr);
                bool isWhitelistedClient = false;
                {
                    std::lock_guard<std::mutex> lk(s_ipsMtx);
                    if (nowIps - s_wlRefresh >= 10) {
                        s_wlRefresh = nowIps;
                        s_ipsWl.clear();
                        s_ipsPosIp.clear();
                        try {
                            fs::path qCfg = SaleApp::Config::AppConfig::instance().getBaseDir() / "config" / "router_qos.json";
                            if (!fs::exists(qCfg)) qCfg = fs::path("config/router_qos.json");
                            if (fs::exists(qCfg)) {
                                std::ifstream qf(qCfg);
                                nlohmann::json qj = nlohmann::json::parse(qf, nullptr, false);
                                if (qj.is_object()) {
                                    s_ipsPosIp = qj.value("pos_server_ip", "");
                                    if (qj.contains("whitelist_ips") && qj["whitelist_ips"].is_array()) {
                                        for (const auto& w : qj["whitelist_ips"]) {
                                            if (w.is_string()) s_ipsWl.push_back(w.get<std::string>());
                                        }
                                    }
                                }
                            }
                        } catch (...) {}
                    }
                    if (!s_ipsPosIp.empty() && rip == s_ipsPosIp) isWhitelistedClient = true;
                    for (const auto& w : s_ipsWl) { if (w == rip) { isWhitelistedClient = true; break; } }

                    if (!isWhitelistedClient) {
                        auto& st = s_ipsMap[rip];
                        if (st.quarantineUntil > nowIps) {
                            res.status = 403;
                            res.set_content("{\"success\":false,\"code\":\"IPS_QUARANTINED\",\"message\":\"Thiết bị tạm thời bị cách ly do phát hiện lưu lượng bất thường tới Máy Chủ POS!\"}", "application/json; charset=utf-8");
                            return httplib::Server::HandlerResponse::Handled;
                        }
                        if (nowIps - st.winStart >= 10) {
                            st.winStart = nowIps;
                            st.winCount = 0;
                        }
                        st.winCount++;

                        // WAF Signature probe detection
                        std::string lowP = p;
                        std::transform(lowP.begin(), lowP.end(), lowP.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
                        bool isProbe = (lowP.find("/.env") != std::string::npos || lowP.find("/wp-admin") != std::string::npos ||
                                        lowP.find("/wp-login") != std::string::npos || lowP.find("/phpmyadmin") != std::string::npos ||
                                        lowP.find("..") != std::string::npos || lowP.find("<script") != std::string::npos ||
                                        lowP.find("union%20select") != std::string::npos);
                        bool isFlood = (st.winCount > 80);
                        if (isProbe || isFlood) {
                            st.strikes++;
                            std::string reason = isProbe ? ("WAF Probe: " + p.substr(0, 64)) : ("HTTP Flood (" + std::to_string(st.winCount) + " req/10s)");
                            int curStrikes = st.strikes;
                            if (curStrikes >= 2) {
                                st.quarantineUntil = nowIps + (curStrikes >= 3 ? 3600 : 900);
                            }
                            // Record incident & escalate to mod_network_qos outside lock via flag
                            try {
                                auto& db = Database::instance();
                                db.execute("CREATE TABLE IF NOT EXISTS security_incidents (id INTEGER PRIMARY KEY AUTOINCREMENT, client_ip TEXT, tier INTEGER, reason TEXT, created_at TEXT DEFAULT (datetime('now','localtime')))");
                                db.execute("INSERT INTO security_incidents (client_ip, tier, reason) VALUES (:ip, :t, :r)",
                                           {{":ip", rip}, {":t", std::min(3, curStrikes)}, {":r", reason}});
                            } catch (...) {}
                            if (curStrikes >= 2) {
                                CyberNexus::PluginManager::instance().dispatchEvent("IPS_ABNORMAL_TRAFFIC", {
                                    {"ip", rip},
                                    {"tier", std::min(3, curStrikes)},
                                    {"action", curStrikes >= 3 ? "ban" : "kick"},
                                    {"reason", reason}
                                });
                            }
                            res.status = (curStrikes == 1) ? 429 : 403;
                            res.set_content(nlohmann::json({
                                {"success", false},
                                {"code", curStrikes == 1 ? "IPS_RATE_LIMITED" : "IPS_BLOCKED"},
                                {"tier", std::min(3, curStrikes)},
                                {"message", "Phát hiện lưu lượng bất thường (" + reason + "). Hệ thống bảo vệ đã kích hoạt bậc " + std::to_string(std::min(3, curStrikes)) + "!"}
                            }).dump(), "application/json; charset=utf-8");
                            return httplib::Server::HandlerResponse::Handled;
                        }
                    }
                }
            }
        }

        std::string licCode, licReason;
        if (p.rfind("/api/", 0) == 0 &&
            p.rfind("/api/auth", 0) != 0 &&
            p.rfind("/api/license", 0) != 0 &&
            p.rfind("/api/wan_tunnel", 0) != 0 &&
            p.rfind("/api/health", 0) != 0 &&
            p.rfind("/api/system/integrity", 0) != 0 &&
            p.rfind("/api/system/updates", 0) != 0 &&
            !LicenseService::instance().isSystemActive(&licCode, &licReason)) {
            // LIC-04: Read-Only Lock cho trường hợp Hết hạn / Quá hạn Offline Lease (vẫn cho xem báo cáo, xuất dữ liệu)
            bool isReadOnlyEligible = (licCode == "LICENSE_EXPIRED" || licCode == "LICENSE_OFFLINE_LEASE_EXCEEDED");
            bool isSafeReadGet = (req.method == "GET") && (
                p.rfind("/api/orders", 0) == 0 || p.rfind("/api/shifts", 0) == 0 ||
                p.rfind("/api/reports", 0) == 0 || p.rfind("/api/settings", 0) == 0 ||
                p.rfind("/api/products", 0) == 0 || p.rfind("/api/categories", 0) == 0 ||
                p.rfind("/api/tables", 0) == 0 || p.rfind("/api/finance", 0) == 0
            );
            if (!(isReadOnlyEligible && isSafeReadGet)) {
                std::string boundMid, curMid;
                LicenseService::instance().isMachineMismatch(&boundMid, &curMid);
                res.status = 403;
                res.set_header("Cache-Control", "no-store");
                res.set_content(nlohmann::json({
                    {"success", false},
                    {"code", licCode.empty() ? "LICENSE_INACTIVE" : licCode},
                    {"error", licCode.empty() ? "LICENSE_INACTIVE" : licCode},
                    {"read_only_mode", isReadOnlyEligible},
                    {"machine_id", curMid},
                    {"bound_machine_id", boundMid},
                    {"message", licReason.empty() ? "Bản quyền cửa hàng không hợp lệ hoặc đã bị tạm khóa!" : licReason}
                }).dump(), "application/json; charset=utf-8");
                return httplib::Server::HandlerResponse::Handled;
            }
        }

        // LIC-02: Pre-Routing Module Guard tập trung cho cả 3 Plugin DLL (Defense-in-Depth Lớp 1)
        auto guardPluginPrefix = [&](const char* prefix, const char* modCode, const char* modLabel) -> bool {
            if (p.rfind(prefix, 0) == 0 && !LicenseService::instance().isModuleEnabled(modCode)) {
                res.status = 403;
                res.set_header("Cache-Control", "no-store");
                res.set_content(nlohmann::json({
                    {"success", false},
                    {"status", "error"},
                    {"code", "MODULE_DISABLED"},
                    {"module", modCode},
                    {"message", std::string("Module ") + modLabel + " (" + modCode + ") đang bị TẮT hoặc KHÓA từ Master!"}
                }).dump(), "application/json; charset=utf-8");
                return true;
            }
            return false;
        };
        if (guardPluginPrefix("/api/network/", "mod_network_qos", "Quản Trị Mạng & WiFi Marketing")) return httplib::Server::HandlerResponse::Handled;
        if (guardPluginPrefix("/api/media/", "mod_media_stream", "Âm Nhạc & Smart Jukebox")) return httplib::Server::HandlerResponse::Handled;
        if (guardPluginPrefix("/api/card_payment/", "mod_card_payment", "Thanh Toán Thẻ SmartPOS (ECR)")) return httplib::Server::HandlerResponse::Handled;

        // NET-09: Lớp 3 Admin/Staff IP Guard — khi bật, thiết bị Khách WiFi chỉ được truy cập trang QR Gọi Món (/customer.html) & WiFi Portal (/wifi.html)
        if (p == "/" || p == "/admin.html" || p == "/index.html" || p == "/kitchen.html" ||
            p == "/order.html" || p == "/online_orders.html" || p == "/attendance.html" || p == "/i18n_studio.html") {
            std::string rip = req.remote_addr;
            if (rip != "127.0.0.1" && rip != "::1" && rip != "localhost" && rip != "::ffff:127.0.0.1") {
                static std::mutex s_guardMtx;
                static std::time_t s_lastCheck = 0;
                static bool s_guardOn = false;
                static std::string s_posIp;
                static std::vector<std::string> s_wlIps;
                std::time_t nowG = std::time(nullptr);
                bool guardOn = false;
                std::string posIpCopy;
                std::vector<std::string> wlCopy;
                {
                    std::lock_guard<std::mutex> lk(s_guardMtx);
                    if (nowG - s_lastCheck >= 5) {
                        s_lastCheck = nowG;
                        s_guardOn = false;
                        s_posIp.clear();
                        s_wlIps.clear();
                        try {
                            fs::path qCfg = SaleApp::Config::AppConfig::instance().getBaseDir() / "config" / "router_qos.json";
                            if (!fs::exists(qCfg)) qCfg = fs::path("config/router_qos.json");
                            if (fs::exists(qCfg)) {
                                std::ifstream qf(qCfg);
                                nlohmann::json qj = nlohmann::json::parse(qf, nullptr, false);
                                if (qj.is_object()) {
                                    s_guardOn = qj.value("admin_ip_guard_enabled", false);
                                    s_posIp = qj.value("pos_server_ip", "");
                                    if (qj.contains("whitelist_ips") && qj["whitelist_ips"].is_array()) {
                                        for (const auto& w : qj["whitelist_ips"]) {
                                            if (w.is_string()) s_wlIps.push_back(w.get<std::string>());
                                        }
                                    }
                                }
                            }
                        } catch (...) {}
                    }
                    guardOn = s_guardOn;
                    posIpCopy = s_posIp;
                    wlCopy = s_wlIps;
                }
                if (guardOn) {
                    bool isAllowed = (!posIpCopy.empty() && rip == posIpCopy);
                    if (!isAllowed) {
                        for (const auto& w : wlCopy) { if (w == rip) { isAllowed = true; break; } }
                    }
                    if (!isAllowed) {
                        res.status = 302;
                        res.set_header("Location", "/customer.html");
                        res.set_content("Redirecting to Guest Order Portal...", "text/plain; charset=utf-8");
                        return httplib::Server::HandlerResponse::Handled;
                    }
                }
            }
        }

        bool isMediaPath = (p.rfind("/api/media", 0) == 0) || (p.rfind("/assets/media", 0) == 0);
        if (!isMediaPath) return httplib::Server::HandlerResponse::Unhandled;
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt.has_value()) {
            res.status = 401;
            res.set_header("Cache-Control", "no-store");
            res.set_content("{\"success\":false,\"authenticated\":false,\"message\":\"Vui lòng đăng nhập để truy cập kho nhạc Jukebox.\"}", "application/json; charset=utf-8");
            return httplib::Server::HandlerResponse::Handled;
        }
        // ANTISPAM-06: Chỉ Admin / Thu ngân mới được Skip, Xóa bài, Chỉnh EQ hoặc Ducking
        if (p == "/api/media/jukebox/skip" || p == "/api/media/jukebox/remove" || p == "/api/media/eq/apply" || p == "/api/media/ducking") {
            if (userOpt->role != "admin" && userOpt->role != "cashier" && !userOpt->is_super_admin) {
                res.status = 403;
                res.set_content("{\"success\":false,\"message\":\"Chỉ Chủ quán hoặc Thu ngân mới có quyền điều khiển Jukebox/EQ!\"}", "application/json; charset=utf-8");
                return httplib::Server::HandlerResponse::Handled;
            }
        }
        const_cast<httplib::Request&>(req).headers.erase("X-CN-Staff-Role");
        const_cast<httplib::Request&>(req).set_header("X-CN-Staff-Role", userOpt->role);
        return httplib::Server::HandlerResponse::Unhandled;
    });

    // Static files mount
    fs::path webDir = config.getWebDir();
    fs::path assetsDir = webDir / "assets";
    fs::path uploadsDir = config.getUploadsDir();

    if (fs::exists(assetsDir)) {
        svr.set_mount_point("/assets", assetsDir.string());
        std::cout << "[Slave Static] Mount /assets -> " << assetsDir.string() << std::endl;
    }
    fs::path baseMediaDir = config.getBaseDir() / "assets" / "media";
    try { fs::create_directories(baseMediaDir); } catch (...) {}
    svr.set_mount_point("/assets/media", baseMediaDir.string());
    std::cout << "[Slave Static] Mount /assets/media -> " << baseMediaDir.string() << std::endl;
    if (fs::exists(uploadsDir)) {
        svr.set_mount_point("/uploads", uploadsDir.string());
        std::cout << "[Slave Static] Mount /uploads -> " << uploadsDir.string() << std::endl;
    }
    if (fs::exists(webDir / "img")) {
        svr.set_mount_point("/img", (webDir / "img").string());
        std::cout << "[Slave Static] Mount /img -> " << (webDir / "img").string() << std::endl;
    }
    if (fs::exists(webDir / "locales")) {
        svr.set_mount_point("/locales", (webDir / "locales").string());
        std::cout << "[Slave Static] Mount /locales -> " << (webDir / "locales").string() << std::endl;
    }

    // Chống cache JS/CSS trên trình duyệt/điện thoại máy trạm để tự nhận bản vá OTA ngay không cần Ctrl+F5
    svr.set_post_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        auto endsWith = [&](const char* ext) {
            size_t elen = std::strlen(ext);
            return req.path.size() >= elen && req.path.compare(req.path.size() - elen, elen, ext) == 0;
        };
        if (endsWith(".js") || endsWith(".css")) {
            res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            res.set_header("Pragma", "no-cache");
        }
    });

    auto serveFavicon = [webDir](const char* fname, const char* mime) {
        return [webDir, fname, mime](const httplib::Request&, httplib::Response& res) {
            fs::path fp = webDir / fname;
            if (fs::exists(fp)) {
                std::ifstream ifs(fp, std::ios::binary);
                if (ifs) {
                    std::stringstream buf;
                    buf << ifs.rdbuf();
                    res.set_header("Cache-Control", "public, max-age=3600");
                    res.set_content(buf.str(), mime);
                    return;
                }
            }
            res.status = 404;
        };
    };
    svr.Get("/favicon.ico", serveFavicon("favicon.ico", "image/x-icon"));
    svr.Get("/favicon.png", serveFavicon("favicon.png", "image/png"));

    // Helper HTML view renderer (Luôn chống cache tuyệt đối để không bao giờ nạp lại trang cũ từ Disk Cache)
    auto serveView = [webDir](const std::string& viewName) {
        return [webDir, viewName](const httplib::Request&, httplib::Response& res) {
            res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            res.set_header("Pragma", "no-cache");
            res.set_header("Expires", "0");
            fs::path filePath = webDir / (viewName + ".html");
            if (fs::exists(filePath)) {
                std::ifstream file(filePath, std::ios::binary);
                if (file) {
                    std::stringstream buffer;
                    buffer << file.rdbuf();
                    res.status = 200;
                    res.set_content(buffer.str(), "text/html; charset=utf-8");
                    return;
                }
            }
            res.status = 404;
            res.set_content("<h1>404 Not Found - File " + viewName + ".html khong ton tai</h1>", "text/html; charset=utf-8");
        };
    };

    auto serveProtectedView = [serveView](const std::string& viewName, const std::string& requiredRole = "any") {
        return [serveView, viewName, requiredRole](const httplib::Request& req, httplib::Response& res) {
            res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            res.set_header("Pragma", "no-cache");
            res.set_header("Expires", "0");

            auto userOpt = AuthService::instance().authenticate(req);
            if (!userOpt.has_value()) {
                std::string cleanPath = (viewName == "index") ? "/pos" : ((viewName == "online_orders") ? "/online" : ((viewName == "customer") ? "/menu" : ("/" + viewName)));
                std::string target = "/login?redirect=" + cleanPath;
                res.status = 302;
                res.set_header("Location", target);
                res.set_header("Set-Cookie", AuthService::formatClearCookie("pos_token"));
                res.set_header("Set-Cookie", AuthService::formatClearCookie("PHPSESSID"));
                res.set_header("Set-Cookie", AuthService::formatClearCookie("pos_remember"));
                res.set_content(
                    "<!DOCTYPE html><html><head><meta charset='utf-8'><meta http-equiv='refresh' content='0;url=" + target + "'>"
                    "<script>try{localStorage.removeItem('pos_user');localStorage.removeItem('pos_token');sessionStorage.clear();}catch(e){}window.location.replace('" + target + "');</script></head>"
                    "<body style='background:#020617;color:#94a3b8;font-family:sans-serif;padding:30px;text-align:center;'>"
                    "<h3>🔒 Đang chuyển hướng đến trang đăng nhập POS...</h3>"
                    "</body></html>",
                    "text/html; charset=utf-8"
                );
                return;
            }

            const auto& user = userOpt.value();
            if (requiredRole != "all_authenticated" && !AuthService::instance().hasRole(user, requiredRole)) {
                std::string roleHome = "/menu";
                if (user.role == "admin" || user.is_super_admin) roleHome = "/admin";
                else if (user.role == "cashier") roleHome = "/pos";
                else if (user.role == "waiter") roleHome = "/order";
                else if (user.role == "kitchen") roleHome = "/kitchen";
                res.status = 302;
                res.set_header("Location", roleHome);
                return;
            }

            serveView(viewName)(req, res);
        };
    };

    // UI-07: Helper chuyển hướng từ .html cũ sang Clean URL (giữ nguyên query string như ?table=...)
    auto redirectClean = [](const std::string& cleanPath) {
        return [cleanPath](const httplib::Request& req, httplib::Response& res) {
            std::string dest = cleanPath;
            auto qPos = req.target.find('?');
            if (qPos != std::string::npos) {
                dest += req.target.substr(qPos);
            }
            res.status = 302;
            res.set_header("Location", dest);
        };
    };

    svr.Get("/manifest.webmanifest", [webDir](const httplib::Request&, httplib::Response& res) {
        fs::path mf = webDir / "manifest.webmanifest";
        if (fs::exists(mf)) {
            std::ifstream f(mf, std::ios::binary);
            std::stringstream buf;
            buf << f.rdbuf();
            res.set_content(buf.str(), "application/manifest+json; charset=utf-8");
            return;
        }
        res.status = 404;
    });

    // Client Store Views (100% Bắt buộc có phiên đăng nhập hợp lệ & Đúng phân quyền bộ phận)
    svr.Get("/", [serveView](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.set_header("Pragma", "no-cache");
        res.set_header("Expires", "0");
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt.has_value()) {
            // Khách vãng lai quét QR / gõ thẳng IP:Port -> hiển thị trực tiếp Menu khách hàng,
            // giữ nguyên thanh địa chỉ gọn gàng (chỉ IP:Port, không lộ đường dẫn /customer.html)
            serveView("customer")(req, res);
            return;
        }
        const auto& u = userOpt.value();
        std::string target = "/pos";
        if (u.role == "admin" || u.is_super_admin) target = "/admin";
        else if (u.role == "waiter") target = "/order";
        else if (u.role == "kitchen") target = "/kitchen";
        else if (u.role == "customer") target = "/menu";
        res.status = 302;
        res.set_header("Location", target);
    });
    // POS Thu Ngân: Chỉ Admin và Thu ngân (cashier)
    svr.Get("/pos", serveProtectedView("index", "cashier"));
    svr.Get("/index", redirectClean("/pos"));
    svr.Get("/index.html", redirectClean("/pos"));
    svr.Get("/index.php", redirectClean("/pos"));

    // Quản Trị: Chỉ Admin
    svr.Get("/admin", serveProtectedView("admin", "admin"));
    svr.Get("/admin.html", redirectClean("/admin"));
    svr.Get("/admin.php", redirectClean("/admin"));

    // Bếp & Pha chế: Chỉ Admin, Thu ngân, Bếp (kitchen)
    svr.Get("/kitchen", serveProtectedView("kitchen", "kitchen"));
    svr.Get("/kitchen.html", redirectClean("/kitchen"));
    svr.Get("/kitchen.php", redirectClean("/kitchen"));

    // Phục vụ: Chỉ Admin, Thu ngân, Phục vụ (waiter)
    svr.Get("/order", serveProtectedView("order", "waiter"));
    svr.Get("/order.html", redirectClean("/order"));
    svr.Get("/order.php", redirectClean("/order"));

    // Menu Khách Hàng Gọi Món (Customer Menu - Quét QR xem menu tự do, giữ tương thích QR cũ)
    svr.Get("/menu", serveView("customer"));
    svr.Get("/customer", redirectClean("/menu"));
    svr.Get("/customer.html", redirectClean("/menu"));
    svr.Get("/customer.php", redirectClean("/menu"));

    // Trang WiFi Marketing (Captive Portal)
    svr.Get("/wifi", serveView("wifi"));
    svr.Get("/wifi.html", redirectClean("/wifi"));

    // Trang Chấm Công Web & Kiosk Nhân Sự (Personal + PIN 6 + Webcam Selfie)
    svr.Get("/attendance", serveView("attendance"));
    svr.Get("/attendance.html", redirectClean("/attendance"));

    svr.Get("/login", serveView("login"));
    svr.Get("/login.html", redirectClean("/login"));
    svr.Get("/login.php", redirectClean("/login"));

    // Đơn Online: Chỉ Admin và Thu ngân (cashier)
    svr.Get("/online", serveProtectedView("online_orders", "cashier"));
    svr.Get("/online_orders", redirectClean("/online"));
    svr.Get("/online_orders.html", redirectClean("/online"));
    svr.Get("/online_orders.php", redirectClean("/online"));

    // Catch-all .php alias
    svr.Get(R"(/([\w-]+)\.php)", [serveProtectedView, serveView](const httplib::Request& req, httplib::Response& res) {
        std::string viewName = req.matches[1];
        if (viewName == "login") {
            serveView(viewName)(req, res);
        } else if (viewName == "customer") {
            serveProtectedView(viewName, "all_authenticated")(req, res);
        } else if (viewName == "admin") {
            serveProtectedView(viewName, "admin")(req, res);
        } else if (viewName == "kitchen") {
            serveProtectedView(viewName, "kitchen")(req, res);
        } else if (viewName == "order") {
            serveProtectedView(viewName, "waiter")(req, res);
        } else {
            serveProtectedView(viewName, "cashier")(req, res);
        }
    });

    // Register all Store POS APIs
    ApiHandlers::registerRoutes(svr);

    // 5. Nạp các Dynamic DLL Plugin (mod_pos_core, mod_network_qos, mod_media_stream...)
    CyberNexus::CoreContext ctx;
    ctx.dbHandle = Database::instance().getHandle();
    ctx.appVersion = "v2.5.0";
    ctx.hardwareHash = LicenseService::instance().getMachineId();
    ctx.isSuperAdminMode = false;
    ctx.checkLicenseStatus = [](const std::string& code) { return LicenseService::instance().isModuleEnabled(code); };
    ctx.emitSystemEvent = [](const std::string& type, const CyberNexus::json& payload) { CyberNexus::PluginManager::instance().dispatchEvent(type, payload); };

#ifdef _WIN32
    _putenv_s("CYBERNEXUS_DB_PATH", config.getDatabasePath().string().c_str());
#else
    setenv("CYBERNEXUS_DB_PATH", config.getDatabasePath().string().c_str(), 1);
#endif

    fs::path modulesDir = config.getBaseDir() / "modules";
    if (const char* envMods = std::getenv("CYBERNEXUS_MODULES_DIR"); envMods && *envMods) {
        modulesDir = envMods;
    }
    size_t nPlugins = CyberNexus::PluginManager::instance().scanAndLoadDirectory(modulesDir.string(), ctx);
    CyberNexus::PluginManager::instance().registerAllActiveRoutes(svr);
    std::cout << "[Slave Plugins] Da quet va nap " << nPlugins << " dynamic plugin DLL tu: " << modulesDir.string() << std::endl;

    // Plugins Matrix API
    svr.Get("/api/plugins/matrix", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(CyberNexus::PluginManager::instance().getModulesStatusMatrix().dump(2), "application/json; charset=utf-8");
    });

    // 6. Background Heartbeat Worker Thread (Auto-Sync License với Master mỗi 30 phút)
    static std::atomic<bool> s_heartbeatRunning{true};
    std::thread heartbeatThread([]() {
        std::this_thread::sleep_for(std::chrono::seconds(5));
        while (s_heartbeatRunning) {
            try {
                auto& db = Database::instance();
                auto row = db.queryRow("SELECT license_key FROM local_license_cache WHERE id = 1");
                if (!row.is_null() && row.contains("license_key") && !row["license_key"].is_null()) {
                    std::string key = row["license_key"].get<std::string>();
                    if (!key.empty() && key.find("UNLICENSED") == std::string::npos) {
                        std::string mid = LicenseService::instance().getMachineId();
                        auto res = LicenseService::instance().verifyLicenseOnline(key, mid);
                        if (res.value("success", false)) {
                            std::cout << "[Heartbeat] Dong bo dinh ky voi Master thanh cong." << std::endl;
                        }
                    }
                }
            } catch (...) {}

            int hbSec = SlaveTunnelStatus::instance().getHeartbeatIntervalSec();
            if (hbSec < 60) hbSec = 1800;
            for (int i = 0; i < hbSec && s_heartbeatRunning; ++i) {
                std::this_thread::sleep_for(std::chrono::seconds(1));
            }
        }
    });
    heartbeatThread.detach();

    // [HR-03 + SEC-15] Background Maintenance Thread (Chạy autoProcessShifts mỗi 2 phút & auto_apply OTA khi 0 đơn pending mỗi 5s)
    std::thread shiftMaintThread([]() {
        std::this_thread::sleep_for(std::chrono::seconds(2));
        int tick = 0;
        while (s_heartbeatRunning) {
            if (tick % 24 == 2) {
                try {
                    SaleApp::Backend::ApiHandlers::runPeriodicShiftMaintenance();
                } catch (...) {}
            }
            try {
                SlaveUpdateManager::instance().tryAutoApplyIfIdle();
            } catch (...) {}
            ++tick;
            for (int i = 0; i < 5 && s_heartbeatRunning; ++i) {
                std::this_thread::sleep_for(std::chrono::seconds(1));
            }
        }
    });
    shiftMaintThread.detach();

    // 7. Reverse Long-Polling Worker Thread (Xuyên NAT/WAN để Master kiểm tra Online & đẩy lệnh tức thì)
    SlaveTunnelStatus::instance().setStartTimeNow();
    std::thread tunnelThread([]() {
        std::this_thread::sleep_for(std::chrono::seconds(2));
        std::mt19937 rng(static_cast<unsigned int>(std::time(nullptr)));
        int retryCount = 0;
        int retryBaseSec = 5;
        int retryMaxSec = 60;
        int pollTimeoutSec = 25;

        while (s_heartbeatRunning) {
            if (!SlaveTunnelStatus::instance().isEnabled()) {
                SlaveTunnelStatus::instance().markDisconnected("Đã tắt kênh WAN từ cấu hình", 0);
                for (int i = 0; i < 3 && s_heartbeatRunning && !SlaveTunnelStatus::instance().consumeReconnectRequest(); ++i) {
                    std::this_thread::sleep_for(std::chrono::seconds(1));
                }
                continue;
            }

            std::string key;
            int activeOrders = 0;
            try {
                auto& db = Database::instance();
                auto row = db.queryRow("SELECT license_key FROM local_license_cache WHERE id = 1");
                if (!row.is_null() && row.contains("license_key") && !row["license_key"].is_null()) {
                    key = row["license_key"].get<std::string>();
                }
                auto cntRow = db.queryRow("SELECT COUNT(*) as c FROM orders WHERE status IN ('pending','preparing','ready')");
                if (!cntRow.is_null() && cntRow.contains("c") && cntRow["c"].is_number()) {
                    activeOrders = cntRow["c"].get<int>();
                }
            } catch (...) {}

            if (key.empty() || key.find("UNLICENSED") != std::string::npos) {
                SlaveTunnelStatus::instance().markDisconnected("Chưa kích hoạt License Key", 0);
                for (int i = 0; i < 10 && s_heartbeatRunning && !SlaveTunnelStatus::instance().consumeReconnectRequest(); ++i) {
                    std::this_thread::sleep_for(std::chrono::seconds(1));
                }
                continue;
            }

            std::string masterUrl = AppConfig::instance().getMasterServerUrl();
            if (masterUrl.empty()) masterUrl = "http://127.0.0.1:8500";
            std::string fbUrl = AppConfig::instance().getMasterFallbackUrl();
            if (retryCount >= 1 && !fbUrl.empty() && fbUrl != masterUrl && (retryCount % 2 == 1)) {
                masterUrl = fbUrl;
            }
            std::string mid = LicenseService::instance().getMachineId();

            std::string curAppVer = "2.1.8";
            try {
                std::ifstream vfs(AppConfig::instance().getBaseDir() / "version.txt");
                std::string vl;
                if (std::getline(vfs, vl) && !vl.empty()) {
                    while (!vl.empty() && (vl.back() == '\r' || vl.back() == '\n' || vl.back() == ' ')) vl.pop_back();
                    if (!vl.empty()) curAppVer = vl;
                }
            } catch (...) {}

            try {
                httplib::Client cli(masterUrl);
                cli.set_connection_timeout(5, 0);
                cli.set_read_timeout(pollTimeoutSec + 15, 0);

                json netGeo = SlaveNetInfoService::instance().toJson();
                json runtime = {
                    {"uptime_sec", SlaveTunnelStatus::instance().getUptimeSec()},
                    {"active_orders", activeOrders},
                    {"db_ok", true},
                    {"app_version", curAppVer},
                    {"lan_ip", netGeo.value("lan_ip", "")},
                    {"wan_ip", netGeo.value("wan_ip", "")},
                    {"geo_lat", netGeo.value("geo_lat", 0.0)},
                    {"geo_lng", netGeo.value("geo_lng", 0.0)},
                    {"geo_label", netGeo.value("geo_label", "")},
                    {"geo_source", netGeo.value("geo_source", "ip")}
                };
                json pollReq = {
                    {"license_key", key},
                    {"machine_id", mid},
                    {"app_version", curAppVer},
                    {"port", AppConfig::instance().getBindPort()},
                    {"net_geo", netGeo},
                    {"runtime", runtime}
                };

                auto res = cli.Post("/api/license/poll", pollReq.dump(), "application/json");
                if (res && res->status == 200) {
                    json resp = json::parse(res->body, nullptr, false);
                    if (resp.is_object() && resp.value("success", false)) {
                        retryCount = 0;
                        int nextHb = 1800;
                        if (resp.contains("config") && resp["config"].is_object()) {
                            auto& cfg = resp["config"];
                            pollTimeoutSec = std::max(10, std::min(55, cfg.value("poll_timeout_sec", 25)));
                            retryBaseSec = std::max(2, std::min(60, cfg.value("retry_base_sec", 5)));
                            retryMaxSec = std::max(10, std::min(300, cfg.value("retry_max_sec", 60)));
                            nextHb = std::max(60, cfg.value("heartbeat_interval_sec", 1800));
                        }
                        SlaveTunnelStatus::instance().markConnected(pollTimeoutSec, nextHb);

                        if (resp.contains("license") && resp["license"].is_object()) {
                            try {
                                auto& lic = resp["license"];
                                std::string em = lic.value("enabled_modules", "");
                                std::string bm = lic.value("blocked_modules", "[]");
                                std::string st = lic.value("subscription_status", "active");
                                std::string ex = lic.value("expire_date", "2028-12-31");
                                double cfp = lic.value("card_fee_percent", 0.0);
                                std::string licSig = lic.value("license_signature", "");
                                if (!em.empty()) {
                                    bool updated = Database::instance().execute(
                                        "UPDATE local_license_cache SET enabled_modules = :em, blocked_modules = :bm, "
                                        "subscription_status = :st, expire_date = :ex, card_fee_percent = :cfp, "
                                        "last_sync_at = datetime('now'), last_sync_status = 'online_ok', "
                                        "license_signature = CASE WHEN :sig != '' THEN :sig ELSE COALESCE(license_signature, '') END WHERE id = 1",
                                        {{":em", em}, {":bm", bm}, {":st", st}, {":ex", ex}, {":cfp", cfp}, {":sig", licSig}}
                                    );
                                    if (updated && !licSig.empty()) {
                                        try {
                                            Database::instance().execute("INSERT INTO store_settings (setting_key, setting_value) VALUES ('cnx_ecdsa_enrolled', '1') ON CONFLICT(setting_key) DO UPDATE SET setting_value = '1'");
                                        } catch (...) {}
                                    }
                                }
                            } catch (...) {}
                        }

                        if (resp.contains("commands") && resp["commands"].is_array()) {
                            for (const auto& cmd : resp["commands"]) {
                                std::string cmdId = cmd.value("cmd_id", "");
                                std::string cmdType = cmd.value("type", "");
                                bool cmdOk = true;
                                bool sendAckAfter = false;
                                bool triggerAutoApplyAfterAck = false;

                                if (cmdType == "PING" && !cmdId.empty()) {
                                    sendAckAfter = true;
                                } else if (cmdType == "SYNC_LICENSE") {
                                    LicenseService::instance().verifyLicenseOnline(key, mid);
                                    sendAckAfter = !cmdId.empty();
                                } else if (cmdType == "SYNC_DB_BACKUP") {
                                    // SYNC-01: On-demand SQLite snapshot -> upload to Master (only when Master commands)
                                    try {
                                        namespace fs = std::filesystem;
                                        fs::path backupDir = AppConfig::instance().getBaseDir() / "backups";
                                        std::error_code ec;
                                        fs::create_directories(backupDir, ec);
                                        fs::path snapPath = backupDir / "master_sync_tmp.db";
                                        fs::remove(snapPath, ec);
                                        std::string escapedPath = snapPath.string();
                                        size_t pos = 0;
                                        while ((pos = escapedPath.find("'", pos)) != std::string::npos) { escapedPath.replace(pos, 1, "''"); pos += 2; }
                                        Database::instance().execute("VACUUM INTO '" + escapedPath + "'");
                                        std::ifstream ifs(snapPath, std::ios::binary);
                                        if (ifs.is_open()) {
                                            std::string payload((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
                                            ifs.close();
                                            httplib::Client bcli(masterUrl);
                                            bcli.set_connection_timeout(10);
                                            bcli.set_read_timeout(60);
                                            httplib::Headers bhdrs = {
                                                {"X-License-Key", key},
                                                {"X-Machine-Id", mid},
                                                {"X-Trigger-Mysql-Sync", "1"}
                                            };
                                            auto bres = bcli.Post("/api/slave/backup", bhdrs, payload, "application/octet-stream");
                                            cmdOk = (bres && bres->status == 200);
                                        } else {
                                            cmdOk = false;
                                        }
                                        fs::remove(snapPath, ec);
                                    } catch (...) {
                                        cmdOk = false;
                                    }
                                    sendAckAfter = !cmdId.empty();
                                } else if (cmdType == "CHECK_DB_SYNC") {
                                    // SYNC-01: On-demand lightweight table row-count check -> report to Master
                                    try {
                                        json tables = json::object();
                                        auto tblRows = Database::instance().query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
                                        for (const auto& tr : tblRows) {
                                            std::string tn = tr.value("name", "");
                                            if (tn.empty()) continue;
                                            try {
                                                auto cnt = Database::instance().queryScalar("SELECT COUNT(*) FROM \"" + tn + "\"");
                                                tables[tn] = cnt.is_number() ? cnt.get<int64_t>() : 0;
                                            } catch (...) {}
                                        }
                                        json statsBody = {{"license_key", key}, {"machine_id", mid}, {"tables", tables}};
                                        httplib::Client scli(masterUrl);
                                        scli.set_connection_timeout(8);
                                        scli.set_read_timeout(15);
                                        httplib::Headers shdrs = {{"X-License-Key", key}, {"X-Machine-Id", mid}};
                                        auto sres = scli.Post("/api/slave/db_stats", shdrs, statsBody.dump(), "application/json");
                                        cmdOk = (sres && sres->status == 200);
                                    } catch (...) {
                                        cmdOk = false;
                                    }
                                    sendAckAfter = !cmdId.empty();
                                } else if (cmdType == "UPDATE_MASTER_URL") {
                                    json payload = cmd.contains("payload") && cmd["payload"].is_object() ? cmd["payload"] : json::object();
                                    std::string newPrimary = payload.value("master_server_url", "");
                                    std::string newFallback = payload.value("master_fallback_url", "");
                                    if (!newPrimary.empty()) {
                                        AppConfig::instance().persistMasterUrls(newPrimary, newFallback);
                                        std::cout << "[Slave Config] Updated Master URL -> " << newPrimary << " (fallback: " << newFallback << ")" << std::endl;
                                    } else {
                                        cmdOk = false;
                                    }
                                    sendAckAfter = !cmdId.empty();
                                } else if (cmdType == "STORE_NOTIFY" || cmdType == "OTA_UPDATE") {
                                    json payload = cmd.contains("payload") && cmd["payload"].is_object() ? cmd["payload"] : json::object();
                                    std::string nTitle = payload.value("title", cmdType == "OTA_UPDATE" ? "Có bản cập nhật mới từ Master" : "Thông báo từ Hệ thống");
                                    std::string nMsg = payload.value("message", "");
                                    std::string nVer = payload.value("version", "");
                                    bool autoApply = payload.value("auto_apply", false);
                                    std::string dlPath = payload.value("download_path", "/api/updates/download");

                                    SlaveUpdateManager::instance().recordNotification(
                                        cmdType == "OTA_UPDATE" ? "SYSTEM_UPDATE" : "SYSTEM_NOTIFY",
                                        nTitle, nMsg, nVer, dlPath
                                    );
                                    if (cmdType == "OTA_UPDATE" && autoApply) {
                                        SlaveUpdateManager::instance().scheduleAutoApply(masterUrl, dlPath, nVer);
                                        triggerAutoApplyAfterAck = true;
                                    }
                                    sendAckAfter = !cmdId.empty();
                                } else if (cmdType == "SYNC_THEME") {
                                    json payload = cmd.contains("payload") && cmd["payload"].is_object() ? cmd["payload"] : json::object();
                                    std::string themeStr = payload.contains("theme_json")
                                        ? (payload["theme_json"].is_string() ? payload["theme_json"].get<std::string>() : payload["theme_json"].dump())
                                        : "";
                                    try {
                                        Database::instance().execute(
                                            "INSERT INTO store_settings (setting_key, setting_value) VALUES ('theme_json', :tj) "
                                            "ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value",
                                            {{":tj", themeStr}}
                                        );
                                        std::cout << "[Theme Studio] Da dong bo giao dien moi tu Master!\n";
                                    } catch (...) {
                                        cmdOk = false;
                                    }
                                    sendAckAfter = !cmdId.empty();
                                } else if (cmdType == "RESET_OWNER_PIN") {
                                    json payload = cmd.contains("payload") && cmd["payload"].is_object() ? cmd["payload"] : json::object();
                                    std::string pin6 = payload.value("pin6", "");
                                    std::string pinSha = payload.value("pin_sha256", "");
                                    std::string sName = payload.value("store_name", "CYBERNEXUS STORE");
                                    std::string sCode = payload.value("store_code", "STORE");
                                    if (CyberNexus::PinVault::isValidPin6(pin6)) {
                                        if (pinSha.empty()) pinSha = SaleApp::Backend::AuthService::sha256(pin6);
                                        auto& dbLocal = SaleApp::Backend::Database::instance();
                                        auto uCols = dbLocal.query("PRAGMA table_info(users)");
                                        auto hasU = [&](const std::string& c) {
                                            for (const auto& r : uCols) if (r.value("name", "") == c) return true;
                                            return false;
                                        };
                                        if (!hasU("default_pin_sha256")) try { dbLocal.execute("ALTER TABLE users ADD COLUMN default_pin_sha256 TEXT DEFAULT ''"); } catch (...) {}
                                        if (!hasU("pin_must_change")) try { dbLocal.execute("ALTER TABLE users ADD COLUMN pin_must_change INTEGER DEFAULT 0"); } catch (...) {}
                                        dbLocal.execute(
                                            "UPDATE users SET pin_code = :p, default_pin_sha256 = :h, pin_must_change = 1 WHERE id = 1 OR role = 'admin'",
                                            {{":p", pin6}, {":h", pinSha}}
                                        );
                                        fs::path baseDir = SaleApp::Config::AppConfig::instance().getBaseDir();
                                        CyberNexus::PinVault::writeDefaultOwnerPinFile(baseDir, sName, sCode, pin6, true);
                                        std::ofstream flagOut(baseDir / "owner_pin_reset.flag", std::ios::trunc);
                                        if (flagOut) {
                                            flagOut << "DEFAULT_OWNER_PIN.txt";
                                        }
                                        std::cout << "[PinVault] Da nhan lenh RESET_OWNER_PIN tu Master va tao file DEFAULT_OWNER_PIN.txt" << std::endl;
                                        cmdOk = true;
                                    } else {
                                        cmdOk = false;
                                    }
                                    sendAckAfter = !cmdId.empty();
                                }

                                if (sendAckAfter && !cmdId.empty()) {
                                    json ackReq = {
                                        {"license_key", key},
                                        {"machine_id", mid},
                                        {"cmd_id", cmdId},
                                        {"cmd_type", cmdType},
                                        {"ok", cmdOk},
                                        {"runtime", runtime}
                                    };
                                    httplib::Client ackCli(masterUrl);
                                    ackCli.set_connection_timeout(4, 0);
                                    ackCli.set_read_timeout(5, 0);
                                    ackCli.Post("/api/license/ack", ackReq.dump(), "application/json");
                                    SlaveTunnelStatus::instance().markAckSent();
                                }
                                if (triggerAutoApplyAfterAck) {
                                    SlaveUpdateManager::instance().tryAutoApplyIfIdle();
                                }
                            }
                        }
                        if (SlaveTunnelStatus::instance().consumeReconnectRequest()) {
                            continue;
                        }
                        continue; // Immediately open next Long-Poll cycle
                    }
                }
                std::string errMsg = res ? ("HTTP " + std::to_string(res->status)) : "Không kết nối được tới Master";
                retryCount++;
                SlaveTunnelStatus::instance().markDisconnected(errMsg, retryCount);
            } catch (const std::exception& e) {
                retryCount++;
                SlaveTunnelStatus::instance().markDisconnected(e.what(), retryCount);
            } catch (...) {
                retryCount++;
                SlaveTunnelStatus::instance().markDisconnected("Lỗi kết nối Master", retryCount);
            }

            // Exponential backoff + random jitter (0..3s) to prevent Thundering Herd on WAN
            int shift = std::min(retryCount - 1, 5);
            int delay = std::min(retryMaxSec, retryBaseSec * (1 << std::max(0, shift)));
            int jitter = std::uniform_int_distribution<int>(0, 3)(rng);
            int totalWait = delay + jitter;
            for (int i = 0; i < totalWait && s_heartbeatRunning && !SlaveTunnelStatus::instance().consumeReconnectRequest(); ++i) {
                std::this_thread::sleep_for(std::chrono::seconds(1));
            }
        }
    });
    tunnelThread.detach();

    svr.Post("/api/system/control", [&svr](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt.has_value() || userOpt->role != "admin") {
            res.status = 403;
            res.set_content("{\"success\":false,\"message\":\"Chỉ Chủ quán (Admin) mới có quyền điều khiển máy chủ!\"}", "application/json; charset=utf-8");
            return;
        }
        nlohmann::json body = nlohmann::json::object();
        if (!req.body.empty()) body = nlohmann::json::parse(req.body, nullptr, false);
        std::string act = body.is_object() ? body.value("action", "") : "";
        if (act == "stop" || act == "shutdown") {
            res.set_content("{\"success\":true,\"message\":\"Máy chủ C++ đang dừng an toàn...\"}", "application/json; charset=utf-8");
            std::thread([&svr]() {
                std::this_thread::sleep_for(std::chrono::milliseconds(300));
                s_heartbeatRunning.store(false);
                svr.stop();
            }).detach();
            return;
        }
        res.status = 400;
        res.set_content("{\"success\":false,\"message\":\"Lệnh điều khiển không hợp lệ.\"}", "application/json; charset=utf-8");
    });

    // Health check & Web Integrity check (SEC-19)
    verifyWebIntegrity(webDir);
    svr.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content("{\"status\":\"healthy\",\"role\":\"slave\",\"time\":" + std::to_string(std::time(nullptr)) + "}", "application/json");
    });
    svr.Get("/api/system/integrity", [webDir](const httplib::Request& req, httplib::Response& res) {
        bool useCached = req.has_param("cached") && req.get_param_value("cached") == "1";
        nlohmann::json rep;
        if (!useCached) {
            rep = verifyWebIntegrity(webDir);
        } else {
            std::lock_guard<std::mutex> lk(g_webIntegrityMtx);
            rep = g_lastWebIntegrityReport;
        }
        bool isOk = rep.value("ok", false);
        rep["success"] = isOk;
        if (!isOk) {
            try {
                Database::instance().execute(R"(
                    INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                    VALUES ('WEB_INTEGRITY_TAMPERED', 'Cảnh báo file JS/HTML bị chỉnh sửa trái phép', 'CRITICAL', 0, 'INTEGRITY', 'SYSTEM', 0, 'sha256_mismatch', 0, 'System Watchdog', 'system', :dtl, datetime('now','localtime'))
                )", {{":dtl", rep.dump()}});
            } catch (...) {}
        }
        res.set_content(rep.dump(), "application/json; charset=utf-8");
    });

    svr.set_payload_max_length(105ULL * 1024ULL * 1024ULL);

    std::cout << "==========================================================" << std::endl;
    std::cout << "  🚀 MAY CHU CYBERNEXUS POS SLAVE SAN SANG:" << std::endl;
    std::cout << "     -> Quay Ban Hang POS: http://" << config.getBindHost() << ":" << config.getBindPort() << "/index.html" << std::endl;
    std::cout << "     -> Man Hinh Bep KDS:  http://" << config.getBindHost() << ":" << config.getBindPort() << "/kitchen.html" << std::endl;
    std::cout << "     -> Quan Tri Quán:     http://" << config.getBindHost() << ":" << config.getBindPort() << "/admin.html" << std::endl;
    std::cout << "     -> Menu Khach Hang:   http://" << config.getBindHost() << ":" << config.getBindPort() << "/customer.html" << std::endl;
    std::cout << "==========================================================" << std::endl;

    bool ok = svr.listen(config.getBindHost().c_str(), config.getBindPort());
    if (!ok) {
        std::cerr << "[Slave Error] Khong the lang nghe tren port " << config.getBindPort() << std::endl;
        return 1;
    }
    return 0;
}
