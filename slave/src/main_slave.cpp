#include <iostream>
#include <fstream>
#include <filesystem>
#include <csignal>
#include <thread>
#include <chrono>
#include <atomic>
#include "httplib.h"
#include "db.hpp"
#include "license.hpp"
#include "auth.hpp"
#include "slave_handlers.hpp"
#include "slave_tunnel.h"
#include "slave_net_info.h"
#include "slave_updater.h"
#include "ConfigManager.hpp"
#include "PluginManager.hpp"
#include <random>

namespace fs = std::filesystem;
using namespace SaleApp::Backend;
using namespace SaleApp::Config;

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

    // 2. Chế độ Slave POS: SuperAdmin bị vô hiệu hóa 100%
    LicenseService::instance().setSuperAdminMode(false);

    // 3. Mở CSDL nội bộ của quán
    std::string dbPath = config.getDatabasePath().string();
    if (!Database::instance().open(dbPath)) {
        std::cerr << "[CRITICAL Slave] Khong the mo CSDL POS tai: " << dbPath << std::endl;
        return 1;
    }
    std::cout << "[DB Slave] Mo CSDL POS thanh cong: " << dbPath << std::endl;

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

    // BẢO MẬT KHO NHẠC: Mọi API Media/Jukebox và file nhạc tĩnh chỉ dành cho người dùng ĐÃ ĐĂNG NHẬP.
    // Khách vãng lai (chưa đăng nhập) không được truy cập kho nhạc / hàng đợi / EQ.
    svr.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        const std::string& p = req.path;
        bool isMediaPath = (p.rfind("/api/media", 0) == 0) || (p.rfind("/assets/media", 0) == 0);
        if (!isMediaPath) return httplib::Server::HandlerResponse::Unhandled;
        if (req.method == "OPTIONS") return httplib::Server::HandlerResponse::Unhandled;
        auto userOpt = AuthService::instance().authenticate(req);
        if (userOpt.has_value()) return httplib::Server::HandlerResponse::Unhandled;
        res.status = 401;
        res.set_header("Cache-Control", "no-store");
        res.set_content("{\"success\":false,\"authenticated\":false,\"message\":\"Vui lòng đăng nhập để truy cập kho nhạc Jukebox.\"}", "application/json; charset=utf-8");
        return httplib::Server::HandlerResponse::Handled;
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
                std::string target = "/login.html?redirect=" + viewName + ".html";
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
                std::string roleHome = "/customer.html";
                if (user.role == "admin" || user.is_super_admin) roleHome = "/admin.html";
                else if (user.role == "cashier") roleHome = "/index.html";
                else if (user.role == "waiter") roleHome = "/order.html";
                else if (user.role == "kitchen") roleHome = "/kitchen.html";
                res.status = 302;
                res.set_header("Location", roleHome);
                return;
            }

            serveView(viewName)(req, res);
        };
    };

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
        std::string target = "/index.html";
        if (u.role == "admin" || u.is_super_admin) target = "/admin.html";
        else if (u.role == "waiter") target = "/order.html";
        else if (u.role == "kitchen") target = "/kitchen.html";
        else if (u.role == "customer") target = "/customer.html";
        res.status = 302;
        res.set_header("Location", target);
    });
    // POS Thu Ngân: Chỉ Admin và Thu ngân (cashier)
    svr.Get("/index", serveProtectedView("index", "cashier"));
    svr.Get("/index.html", serveProtectedView("index", "cashier"));
    svr.Get("/index.php", serveProtectedView("index", "cashier"));

    // Quản Trị: Chỉ Admin
    svr.Get("/admin", serveProtectedView("admin", "admin"));
    svr.Get("/admin.html", serveProtectedView("admin", "admin"));
    svr.Get("/admin.php", serveProtectedView("admin", "admin"));

    // Bếp & Pha chế: Chỉ Admin, Thu ngân, Bếp (kitchen)
    svr.Get("/kitchen", serveProtectedView("kitchen", "kitchen"));
    svr.Get("/kitchen.html", serveProtectedView("kitchen", "kitchen"));
    svr.Get("/kitchen.php", serveProtectedView("kitchen", "kitchen"));

    // Phục vụ: Chỉ Admin, Thu ngân, Phục vụ (waiter)
    svr.Get("/order", serveProtectedView("order", "waiter"));
    svr.Get("/order.html", serveProtectedView("order", "waiter"));
    svr.Get("/order.php", serveProtectedView("order", "waiter"));

    // Menu Khách Hàng Gọi Món (Customer Menu - Quét QR xem menu tự do)
    svr.Get("/customer", serveView("customer"));
    svr.Get("/customer.html", serveView("customer"));
    svr.Get("/customer.php", serveView("customer"));

    svr.Get("/login", serveView("login"));
    svr.Get("/login.html", serveView("login"));
    svr.Get("/login.php", serveView("login"));

    // Đơn Online: Chỉ Admin và Thu ngân (cashier)
    svr.Get("/online_orders", serveProtectedView("online_orders", "cashier"));
    svr.Get("/online_orders.html", serveProtectedView("online_orders", "cashier"));
    svr.Get("/online_orders.php", serveProtectedView("online_orders", "cashier"));

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

    fs::path modulesDir = config.getBaseDir() / "modules";
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
            std::string mid = LicenseService::instance().getMachineId();

            try {
                httplib::Client cli(masterUrl);
                cli.set_connection_timeout(5, 0);
                cli.set_read_timeout(pollTimeoutSec + 15, 0);

                json netGeo = SlaveNetInfoService::instance().toJson();
                json runtime = {
                    {"uptime_sec", SlaveTunnelStatus::instance().getUptimeSec()},
                    {"active_orders", activeOrders},
                    {"db_ok", true},
                    {"app_version", "2.1.8"},
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
                    {"app_version", "2.1.8"},
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
                                if (!em.empty()) {
                                    Database::instance().execute(
                                        "UPDATE local_license_cache SET enabled_modules = :em, blocked_modules = :bm, "
                                        "subscription_status = :st, expire_date = :ex, card_fee_percent = :cfp, "
                                        "last_sync_at = datetime('now'), last_sync_status = 'online_ok' WHERE id = 1",
                                        {{":em", em}, {":bm", bm}, {":st", st}, {":ex", ex}, {":cfp", cfp}}
                                    );
                                }
                            } catch (...) {}
                        }

                        if (resp.contains("commands") && resp["commands"].is_array()) {
                            for (const auto& cmd : resp["commands"]) {
                                std::string cmdId = cmd.value("cmd_id", "");
                                std::string cmdType = cmd.value("type", "");
                                if (cmdType == "PING" && !cmdId.empty()) {
                                    json ackReq = {
                                        {"license_key", key},
                                        {"machine_id", mid},
                                        {"cmd_id", cmdId},
                                        {"ok", true},
                                        {"runtime", runtime}
                                    };
                                    httplib::Client ackCli(masterUrl);
                                    ackCli.set_connection_timeout(4, 0);
                                    ackCli.set_read_timeout(5, 0);
                                    ackCli.Post("/api/license/ack", ackReq.dump(), "application/json");
                                    SlaveTunnelStatus::instance().markAckSent();
                                } else if (cmdType == "SYNC_LICENSE") {
                                    LicenseService::instance().verifyLicenseOnline(key, mid);
                                } else if (cmdType == "STORE_NOTIFY" || cmdType == "OTA_UPDATE") {
                                    json payload = cmd.contains("payload") && cmd["payload"].is_object() ? cmd["payload"] : json::object();
                                    std::string nTitle = payload.value("title", cmdType == "OTA_UPDATE" ? "Có bản cập nhật mới từ Master" : "Thông báo từ Hệ thống");
                                    std::string nMsg = payload.value("message", "");
                                    std::string nVer = payload.value("version", "");
                                    bool autoApply = payload.value("auto_apply", false);
                                    std::string dlPath = payload.value("download_path", "/api/updates/download");

                                    SlaveUpdateManager::instance().recordNotification(
                                        cmdType == "OTA_UPDATE" ? "SYSTEM_UPDATE" : "SYSTEM_NOTIFY",
                                        nTitle, nMsg, nVer
                                    );
                                    if (cmdType == "OTA_UPDATE" && autoApply) {
                                        std::thread([masterUrl, dlPath]() {
                                            SlaveUpdateManager::instance().applyPatchFromMaster(masterUrl, dlPath);
                                        }).detach();
                                    }
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

    // Health check
    svr.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content("{\"status\":\"healthy\",\"role\":\"slave\",\"time\":" + std::to_string(std::time(nullptr)) + "}", "application/json");
    });

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
