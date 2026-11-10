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
#include "ConfigManager.hpp"
#include "PluginManager.hpp"

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

    // 4. Khởi tạo HTTP Server
    httplib::Server svr;
    g_server = &svr;

    // Static files mount
    fs::path webDir = config.getWebDir();
    fs::path assetsDir = webDir / "assets";
    fs::path uploadsDir = config.getUploadsDir();

    if (fs::exists(assetsDir)) {
        svr.set_mount_point("/assets", assetsDir.string());
        std::cout << "[Slave Static] Mount /assets -> " << assetsDir.string() << std::endl;
    }
    if (fs::exists(uploadsDir)) {
        svr.set_mount_point("/uploads", uploadsDir.string());
        std::cout << "[Slave Static] Mount /uploads -> " << uploadsDir.string() << std::endl;
    }
    if (fs::exists(webDir / "img")) {
        svr.set_mount_point("/img", (webDir / "img").string());
        std::cout << "[Slave Static] Mount /img -> " << (webDir / "img").string() << std::endl;
    }

    // Helper HTML view renderer
    auto serveView = [webDir](const std::string& viewName) {
        return [webDir, viewName](const httplib::Request&, httplib::Response& res) {
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

    auto serveProtectedView = [serveView](const std::string& viewName, const std::string& requiredRole = "") {
        return [serveView, viewName, requiredRole](const httplib::Request& req, httplib::Response& res) {
            auto userOpt = AuthService::instance().authenticate(req);
            if (!userOpt.has_value()) {
                std::string target = "/login.html?redirect=" + viewName + ".html";
                res.status = 302;
                res.set_header("Location", target);
                res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
                res.set_content(
                    "<!DOCTYPE html><html><head><meta charset='utf-8'><meta http-equiv='refresh' content='0;url=" + target + "'>"
                    "<script>window.location.replace('" + target + "');</script></head>"
                    "<body style='background:#020617;color:#94a3b8;font-family:sans-serif;padding:30px;text-align:center;'>"
                    "<h3>🔒 Đang chuyển hướng đến trang đăng nhập POS...</h3>"
                    "</body></html>",
                    "text/html; charset=utf-8"
                );
                return;
            }

            const auto& user = userOpt.value();
            if (requiredRole == "admin" && user.role != "admin") {
                res.status = 403;
                res.set_content("<h1>403 Forbidden - Bạn không có quyền truy cập trang quản trị này</h1>", "text/html; charset=utf-8");
                return;
            }

            serveView(viewName)(req, res);
        };
    };

    // Client Store Views
    svr.Get("/", serveProtectedView("index", "any"));
    svr.Get("/index.html", serveProtectedView("index", "any"));
    svr.Get("/index.php", serveProtectedView("index", "any"));

    svr.Get("/admin", serveProtectedView("admin", "admin"));
    svr.Get("/admin.html", serveProtectedView("admin", "admin"));
    svr.Get("/admin.php", serveProtectedView("admin", "admin"));

    svr.Get("/kitchen", serveProtectedView("kitchen", "staff"));
    svr.Get("/kitchen.html", serveProtectedView("kitchen", "staff"));
    svr.Get("/kitchen.php", serveProtectedView("kitchen", "staff"));

    svr.Get("/order", serveProtectedView("order", "staff"));
    svr.Get("/order.html", serveProtectedView("order", "staff"));
    svr.Get("/order.php", serveProtectedView("order", "staff"));

    svr.Get("/customer", serveView("customer"));
    svr.Get("/customer.html", serveView("customer"));
    svr.Get("/customer.php", serveView("customer"));

    svr.Get("/login", serveView("login"));
    svr.Get("/login.html", serveView("login"));
    svr.Get("/login.php", serveView("login"));

    svr.Get("/online_orders.html", serveProtectedView("online_orders", "staff"));
    svr.Get("/online_orders.php", serveProtectedView("online_orders", "staff"));

    // Catch-all .php alias
    svr.Get(R"(/([\w-]+)\.php)", [serveProtectedView, serveView](const httplib::Request& req, httplib::Response& res) {
        std::string viewName = req.matches[1];
        if (viewName == "customer" || viewName == "login") {
            serveView(viewName)(req, res);
        } else if (viewName == "admin") {
            serveProtectedView(viewName, "admin")(req, res);
        } else {
            serveProtectedView(viewName, "any")(req, res);
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

            for (int i = 0; i < 1800 && s_heartbeatRunning; ++i) {
                std::this_thread::sleep_for(std::chrono::seconds(1));
            }
        }
    });
    heartbeatThread.detach();

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
