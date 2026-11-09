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

// Trình thông dịch & Render file giao diện PHP sang HTML chuẩn Liquid Glass (C++ Native)
static std::string renderPhpView(const std::string& filePath, int port) {
    std::ifstream file(filePath, std::ios::binary);
    if (!file.is_open()) return "<h1>404 Not Found - Không tìm thấy giao diện</h1>";

    std::stringstream buffer;
    buffer << file.rdbuf();
    std::string content = buffer.str();

    // Tìm thẻ <!DOCTYPE html> hoặc <html>
    size_t docPos = content.find("<!DOCTYPE");
    if (docPos == std::string::npos) docPos = content.find("<html");
    if (docPos != std::string::npos) {
        content = content.substr(docPos);
    }

    // Lấy thông tin cửa hàng từ CSDL SQLite
    auto& db = Database::instance();
    auto sName = db.queryScalar("SELECT setting_value FROM store_settings WHERE setting_key = 'store_name'");
    std::string storeName = (sName.is_string() && !sName.get<std::string>().empty()) ? sName.get<std::string>() : "Góc Phố Coffee & Tea";

    std::string lanUrl = "http://localhost:" + std::to_string(port);

    auto replaceAll = [](std::string& str, const std::string& from, const std::string& to) {
        size_t start_pos = 0;
        while ((start_pos = str.find(from, start_pos)) != std::string::npos) {
            str.replace(start_pos, from.length(), to);
            start_pos += to.length();
        }
    };

    // 1. Thay thế các biến thông tin quán
    replaceAll(content, "<?= htmlspecialchars(STORE_NAME) ?>", storeName);
    replaceAll(content, "<?= STORE_NAME ?>", storeName);
    replaceAll(content, "<?= htmlspecialchars(APP_NAME) ?>", "CyberNexus OS");
    replaceAll(content, "<?= APP_NAME ?>", "CyberNexus OS");
    replaceAll(content, "<?= htmlspecialchars(APP_SUBTITLE) ?>", "Hệ Thống Bán Hàng & Quản Trị Trà Sữa - Cafe");
    replaceAll(content, "<?= APP_SUBTITLE ?>", "Hệ Thống Bán Hàng & Quản Trị Trà Sữa - Cafe");
    replaceAll(content, "<?= APP_VERSION ?>", "v1.0 Liquid Glass C++ Native");
    replaceAll(content, "<?= htmlspecialchars(STORE_ADDRESS) ?>", "123 Đường Số 1, Phường 5, TP.HCM");
    replaceAll(content, "<?= STORE_ADDRESS ?>", "123 Đường Số 1, Phường 5, TP.HCM");
    replaceAll(content, "<?= htmlspecialchars(STORE_HOTLINE) ?>", "0901234567");
    replaceAll(content, "<?= STORE_HOTLINE ?>", "0901234567");
    replaceAll(content, "<?= $lanUrl ?>", lanUrl);
    replaceAll(content, "<?= $serverIp ?>", "127.0.0.1");
    replaceAll(content, "<?= $serverPort ?>", std::to_string(port));
    replaceAll(content, "<?= $storeLogoDataUri ?>", "");

    // 2. Thay thế an toàn các biến JavaScript để không bị lỗi cú pháp JS (SyntaxError)
    replaceAll(content, "<?= json_encode($currentUser) ?>", "null");
    replaceAll(content, "<?= $currentUser ? json_encode($currentUser) : 'null' ?>", "null");
    replaceAll(content, "<?= json_encode($orderContext) ?>", "{}");
    replaceAll(content, "<?= json_encode($paymentDetails) ?>", "{}");
    replaceAll(content, "<?= json_encode($wifiCredentials) ?>", "{\"ssid\":\"GocPho_Guest\",\"password\":\"88888888\"}");
    replaceAll(content, "<?= json_encode($slides) ?>", "[]");
    replaceAll(content, "<?= $vietqrEnabled ? 'true' : 'false' ?>", "true");

    // 3. Regex phòng vệ: Bất kỳ gán biến JS nào còn sót dạng `var x = <?= ... ?>;` đều được gán an toàn = null;
    std::regex assignRegex(R"(=\s*<\?=(?:[\s\S]*?)\?>\s*;)");
    content = std::regex_replace(content, assignRegex, "= null;");

    // 4. Loại bỏ các thẻ PHP logic còn lại
    std::regex phpTagRegex(R"((<\?(?:php|=)[\s\S]*?\?>))");
    content = std::regex_replace(content, phpTagRegex, "");

    return content;
}

int main(int argc, char* argv[]) {
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

    // 5. Trình phục vụ giao diện Web Liquid Glass (Tự động render không bao giờ tải file code)
    auto serveView = [port](const std::string& name) {
        return [port, name](const httplib::Request&, httplib::Response& res) {
            std::string html;
            std::string directPhp = name + ".php";
            std::string webPhp = "web/" + name + ".php";
            std::string directHtml = name + ".html";
            std::string webHtml = "web/" + name + ".html";

            if (fs::exists(webHtml)) {
                std::ifstream f(webHtml, std::ios::binary);
                std::stringstream ss; ss << f.rdbuf();
                html = ss.str();
            } else if (fs::exists(directHtml)) {
                std::ifstream f(directHtml, std::ios::binary);
                std::stringstream ss; ss << f.rdbuf();
                html = ss.str();
            } else if (fs::exists(directPhp)) {
                html = renderPhpView(directPhp, port);
            } else if (fs::exists(webPhp)) {
                html = renderPhpView(webPhp, port);
            } else {
                html = "<h1>404 Not Found - Khong tim thay trang " + name + "</h1>";
            }
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

    if (!svr.listen("0.0.0.0", port)) {
        std::cerr << "[Loi] Khong the lang nghe tren port " << port << std::endl;
    }

    return 0;
}
