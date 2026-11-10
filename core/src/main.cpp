#include <iostream>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <regex>
#include "httplib.h"
#include "db.hpp"
#include "auth.hpp"
#include "license.hpp"
#include "handlers.hpp"
#include "PluginManager.hpp"

namespace fs = std::filesystem;
using namespace SaleApp::Backend;
using namespace CyberNexus;

// Trình nạp và phục vụ giao diện HTML5 chuẩn Liquid Glass (100% C++ Native, không phụ thuộc PHP)
static std::string loadHtmlView(const std::string& name) {
    std::vector<std::string> candidates = {
        "web/" + name + ".html",
        name + ".html",
        "../web/" + name + ".html"
    };

    for (const auto& path : candidates) {
        if (fs::exists(path)) {
            std::ifstream f(path, std::ios::binary);
            std::stringstream ss; ss << f.rdbuf();
            return ss.str();
        }
    }
    return "<h1>404 Not Found - Không tìm thấy giao diện " + name + "</h1>";
}

int main(int argc, char* argv[]) {
    // Tự động chuyển working directory về thư mục gốc dự án
    try {
        fs::path exeDir = fs::absolute(argv[0]).parent_path();
        if (fs::exists(exeDir / "web")) {
            fs::current_path(exeDir);
        } else if (fs::exists(exeDir / "../web")) {
            fs::current_path(exeDir / "..");
        }
    } catch (...) {}

    int port = 8500;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--super-admin" || arg == "-s" || arg == "--master") {
            LicenseService::instance().setSuperAdminMode(true);
        } else if (arg == "--port" || arg == "-p") {
            if (i + 1 < argc) {
                try { port = std::stoi(argv[++i]); } catch (...) {}
            }
        }
    }

    std::cout << "==========================================================" << std::endl;
    std::cout << "        🚀 CYBERNEXUS OS — NATIVE MICROKERNEL HOST        " << std::endl;
    std::cout << "  Smart Venue Operating System (POS + Network + Media + AI)" << std::endl;
    std::cout << "  Version 1.0.0 (C++17 Standalone - Dynamic Module Engine) " << std::endl;
    std::cout << "  Chay thuan C++ Native doc lap - Hoan toan KHONG dung PHP " << std::endl;
    std::cout << "==========================================================" << std::endl;

    // 1. Xác định và mở Cơ sở dữ liệu SQLite
    std::string dbPath = "database/pos_database.sqlite";
    if (!fs::exists(dbPath)) dbPath = "database/cybernexus.db";
    if (!fs::exists(dbPath)) dbPath = "../database/pos_database.sqlite";
    if (!fs::exists(dbPath)) dbPath = "../database/cybernexus.db";

    if (!Database::instance().open(dbPath)) {
        std::cerr << "[CRITICAL] Khong the mo CSDL SQLite tai: " << dbPath << std::endl;
        Database::instance().open("pos_database.sqlite");
    } else {
        std::cout << "[DB] Mo thanh cong CSDL SQLite: " << dbPath << std::endl;
    }

    httplib::Server svr;

    // Thiết lập CORS và chống download mã nguồn
    svr.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With");
        res.set_header("Access-Control-Allow-Credentials", "true");

        if (req.method == "OPTIONS") {
            res.status = 204;
            return httplib::Server::HandlerResponse::Handled;
        }
        return httplib::Server::HandlerResponse::Unhandled;
    });

    // 2. Đăng ký toàn bộ API bán hàng & quản trị (POS, Bàn, Món, Doanh thu, Báo cáo, VietQR)
    ApiHandlers::registerRoutes(svr);

    // 3. Khởi tạo & nạp các Module Độc Lập qua PluginManager
    CoreContext ctx;
    ctx.dbHandle = nullptr;
    ctx.appVersion = "1.0.0";
    ctx.hardwareHash = "HW-NEXUS-F901";
    ctx.isSuperAdminMode = true;
    ctx.checkLicenseStatus = [](const std::string& modCode) -> bool {
        return LicenseService::instance().isModuleEnabled(modCode);
    };
    ctx.emitSystemEvent = [](const std::string& evt, const json& payload) {
        PluginManager::instance().dispatchEvent(evt, payload);
    };

    std::string modulesDir = "./modules";
    if (!fs::exists(modulesDir)) modulesDir = "./build/release/modules";
    if (!fs::exists(modulesDir)) modulesDir = "../build/release/modules";
    size_t loadedCount = PluginManager::instance().scanAndLoadDirectory(modulesDir, ctx);
    std::cout << "[Core] Tong so module doc lap duoc nap: " << loadedCount << std::endl;
    PluginManager::instance().registerAllActiveRoutes(svr);

    // 4. Mount các thư mục tài nguyên tĩnh (assets, img, uploads)
    if (fs::exists("assets")) {
        svr.set_mount_point("/assets", "assets");
        std::cout << "[Static] Mount /assets" << std::endl;
    } else if (fs::exists("web/assets")) {
        svr.set_mount_point("/assets", "web/assets");
    }

    if (fs::exists("img")) {
        svr.set_mount_point("/img", "img");
        std::cout << "[Static] Mount /img" << std::endl;
    } else if (fs::exists("web/img")) {
        svr.set_mount_point("/img", "web/img");
    }

    if (fs::exists("uploads")) {
        svr.set_mount_point("/uploads", "uploads");
        std::cout << "[Static] Mount /uploads" << std::endl;
    } else if (fs::exists("web/uploads")) {
        svr.set_mount_point("/uploads", "web/uploads");
    }

    // 5. Trình phục vụ giao diện Web Liquid Glass (100% C++ Native)
    auto serveView = [](const std::string& name) {
        return [name](const httplib::Request&, httplib::Response& res) {
            std::string html = loadHtmlView(name);
            res.set_content(html, "text/html; charset=utf-8");
        };
    };

    // Các Route giao diện chính
    svr.Get("/", serveView("index"));
    svr.Get("/index", serveView("index"));
    svr.Get("/index.html", serveView("index"));
    svr.Get("/index.php", serveView("index"));
    svr.Get("/pos", serveView("index"));

    svr.Get("/admin", serveView("admin"));
    svr.Get("/admin.html", serveView("admin"));
    svr.Get("/admin.php", serveView("admin"));

    svr.Get("/kitchen", serveView("kitchen"));
    svr.Get("/kitchen.html", serveView("kitchen"));
    svr.Get("/kitchen.php", serveView("kitchen"));

    svr.Get("/order", serveView("order"));
    svr.Get("/order.html", serveView("order"));
    svr.Get("/order.php", serveView("order"));

    svr.Get("/customer", serveView("customer"));
    svr.Get("/customer.html", serveView("customer"));
    svr.Get("/customer.php", serveView("customer"));

    svr.Get("/super_admin", serveView("super_admin"));
    svr.Get("/super_admin.html", serveView("super_admin"));
    svr.Get("/super_admin.php", serveView("super_admin"));

    svr.Get("/online_orders", serveView("online_orders"));
    svr.Get("/online_orders.html", serveView("online_orders"));
    svr.Get("/online_orders.php", serveView("online_orders"));

    // Bắt toàn bộ các request file .php để render HTML mượt mà, ngăn tuyệt đối việc tải file code
    svr.Get(R"(/([\w-]+)\.php)", [serveView](const httplib::Request& req, httplib::Response& res) {
        std::string viewName = req.matches[1];
        serveView(viewName)(req, res);
    });

    svr.Get("/favicon.ico", [](const httplib::Request&, httplib::Response& res) {
        res.status = 204;
    });

    std::cout << "==========================================================" << std::endl;
    std::cout << "  🚀 MAY CHU CYBERNEXUS C++ NATIVE SAN SANG (PORT " << port << "):" << std::endl;
    std::cout << "     -> Quay Ban Hang POS: http://localhost:" << port << "/index.php" << std::endl;
    std::cout << "     -> Man Hinh Bep KDS:  http://localhost:" << port << "/kitchen.php" << std::endl;
    std::cout << "     -> Nhan Vien Order:   http://localhost:" << port << "/order.php" << std::endl;
    std::cout << "     -> Menu Khach Hang:   http://localhost:" << port << "/customer.php" << std::endl;
    std::cout << "     -> Quan Tri Quan:     http://localhost:" << port << "/admin.php" << std::endl;
    std::cout << "     -> SuperAdmin Master: http://localhost:" << port << "/super_admin.php" << std::endl;
    std::cout << "==========================================================" << std::endl;

    std::cout << "[INFO] Bat dau svr.listen tren port " << port << std::endl;
    try {
        if (!svr.listen("0.0.0.0", port)) {
            std::cerr << "[Loi] svr.listen return false cho port " << port << std::endl;
        }
    } catch (const std::exception& e) {
        std::cerr << "[CRITICAL EXCEPTION] Trong svr.listen: " << e.what() << std::endl;
    } catch (...) {
        std::cerr << "[CRITICAL UNKNOWN EXCEPTION] Trong svr.listen!" << std::endl;
    }
    std::cout << "[INFO] svr.listen da ket thuc!" << std::endl;

    return 0;
}
