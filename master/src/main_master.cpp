#include <iostream>
#include <fstream>
#include <filesystem>
#include <csignal>
#include "httplib.h"
#include "db.hpp"
#include "license.hpp"
#include "master_handlers.hpp"
#include "ConfigManager.hpp"

namespace fs = std::filesystem;
using namespace SaleApp::Backend;
using namespace SaleApp::Config;

static httplib::Server* g_server = nullptr;

void signalHandler(int signum) {
    std::cout << "\n[Master] Nhan tin hieu dung (" << signum << "), dang dong may chu an toan..." << std::endl;
    if (g_server) g_server->stop();
    Database::instance().close();
    std::cout << "[Master] May chu Master da dung hoan toan." << std::endl;
    exit(0);
}

int main(int argc, char* argv[]) {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
#endif

    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    // 1. Khoi tao ConfigManager cho role Master
    auto& config = AppConfig::instance();
    config.init("master", argc, argv);
    config.printBanner();

    // 2. Kich hoat SuperAdmin mode trong LicenseService
    LicenseService::instance().setSuperAdminMode(true);

    // 3. Mo CSDL Master
    std::string dbPath = config.getDatabasePath().string();
    if (!Database::instance().open(dbPath)) {
        std::cerr << "[CRITICAL Master] Khong the mo CSDL Master tai: " << dbPath << std::endl;
        return 1;
    }
    std::cout << "[DB Master] Mo CSDL Master thanh cong: " << dbPath << std::endl;

    // 4. Khoi tao HTTP Server
    httplib::Server svr;
    g_server = &svr;

    // Static files mount
    fs::path webDir = config.getWebDir();
    fs::path assetsDir = webDir / "assets";
    fs::path uploadsDir = config.getUploadsDir();

    if (fs::exists(assetsDir)) {
        svr.set_mount_point("/assets", assetsDir.string());
        std::cout << "[Master Static] Mount /assets -> " << assetsDir.string() << std::endl;
    }
    if (fs::exists(uploadsDir)) {
        svr.set_mount_point("/uploads", uploadsDir.string());
        std::cout << "[Master Static] Mount /uploads -> " << uploadsDir.string() << std::endl;
    }

    // Helper view server
    auto serveMasterView = [webDir](const httplib::Request& req, httplib::Response& res) {
        fs::path htmlPath = webDir / "super_admin.html";
        if (fs::exists(htmlPath)) {
            std::ifstream file(htmlPath, std::ios::binary);
            if (file) {
                std::stringstream buffer;
                buffer << file.rdbuf();
                res.status = 200;
                res.set_content(buffer.str(), "text/html; charset=utf-8");
                return;
            }
        }
        res.status = 404;
        res.set_content("<h1>404 Not Found - File super_admin.html khong ton tai trong " + webDir.string() + "</h1>", "text/html; charset=utf-8");
    };

    // Master Routes
    svr.Get("/", serveMasterView);
    svr.Get("/super_admin", serveMasterView);
    svr.Get("/super_admin.html", serveMasterView);
    svr.Get("/super_admin.php", serveMasterView);
    svr.Get("/master", serveMasterView);
    svr.Get("/master.html", serveMasterView);
    svr.Get("/licensing", serveMasterView);
    svr.Get("/platform", serveMasterView);

    // Chuyển hướng an toàn nếu truy cập login.html cũ trên cổng Master
    svr.Get("/login", [](const httplib::Request&, httplib::Response& res) {
        res.set_redirect("/super_admin");
    });
    svr.Get("/login.html", [](const httplib::Request&, httplib::Response& res) {
        res.set_redirect("/super_admin");
    });

    // Register all Master API routes
    MasterHandlers::registerRoutes(svr);

    // Health check
    svr.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content("{\"status\":\"healthy\",\"role\":\"master\",\"time\":" + std::to_string(std::time(nullptr)) + "}", "application/json");
    });

    std::cout << "==========================================================" << std::endl;
    std::cout << "  🚀 MAY CHU CYBERNEXUS MASTER SAN SANG:" << std::endl;
    std::cout << "     -> Cổng Quản Trị: http://" << config.getBindHost() << ":" << config.getBindPort() << "/super_admin" << std::endl;
    std::cout << "==========================================================" << std::endl;

    bool ok = svr.listen(config.getBindHost().c_str(), config.getBindPort());
    if (!ok) {
        std::cerr << "[Master Error] Khong the lang nghe tren port " << config.getBindPort() << std::endl;
        return 1;
    }
    return 0;
}
