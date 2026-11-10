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

    // Thiết lập CORS và chống download mã nguồn, tắt hoàn toàn cache để web chạy mượt cả ở chế độ thường lẫn ẩn danh
    svr.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With");
        res.set_header("Access-Control-Allow-Credentials", "true");
        res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.set_header("Pragma", "no-cache");
        res.set_header("Expires", "0");

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
    if (fs::exists("web/assets")) {
        svr.set_mount_point("/assets", "web/assets");
        std::cout << "[Static] Mount /assets -> web/assets" << std::endl;
    } else if (fs::exists("assets")) {
        svr.set_mount_point("/assets", "assets");
        std::cout << "[Static] Mount /assets -> assets" << std::endl;
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
    auto startTime = std::chrono::steady_clock::now();

    // API Trạng Thái Máy Chủ C++ (Public để Login UI hiển thị trạng thái)
    svr.Get("/api/system/status", [startTime, port](const httplib::Request&, httplib::Response& res) {
        auto now = std::chrono::steady_clock::now();
        auto uptimeSecs = std::chrono::duration_cast<std::chrono::seconds>(now - startTime).count();
        std::string machineId = SaleApp::Backend::LicenseService::instance().getMachineId();

        json resp = {
            {"success", true},
            {"status", "online"},
            {"port", port},
            {"uptime_seconds", uptimeSecs},
            {"version", "CyberNexus OS v1.0.0 (C++17 Standalone Microkernel)"},
            {"machine_id", machineId},
            {"db_status", "connected"},
            {"tamper_protection", "active"},
            {"active_sessions", SaleApp::Backend::AuthService::instance().activeSessionCount()}
        };
        res.set_header("Content-Type", "application/json; charset=utf-8");
        res.set_header("Cache-Control", "no-store, no-cache, must-revalidate");
        res.set_content(resp.dump(), "application/json; charset=utf-8");
    });

    // API Điều Khiển Máy Chủ C++ (Run/Stop/Restart/License - Yêu cầu Master PIN 9999 hoặc Admin Token)
    svr.Post("/api/system/control", [&svr, port](const httplib::Request& req, httplib::Response& res) {
        json body = json::object();
        try {
            if (!req.body.empty()) body = json::parse(req.body);
        } catch(...) {}

        std::string action = body.value("action", "");
        std::string pin = body.value("pin", "");

        // Kiểm tra quyền: yêu cầu Master PIN 9999 hoặc Token Admin
        bool authorized = false;
        if (pin == "9999") {
            authorized = true;
        } else {
            auto userOpt = SaleApp::Backend::AuthService::instance().authenticate(req);
            if (userOpt.has_value() && (userOpt->role == "admin" || userOpt->is_super_admin)) {
                authorized = true;
            }
        }

        if (!authorized) {
            json err = {
                {"success", false},
                {"message", "Mã PIN Quản Trị hoặc Token không đúng! Chỉ Chủ Quán (PIN 9999) mới có quyền điều khiển máy chủ."}
            };
            res.status = 403;
            res.set_content(err.dump(), "application/json; charset=utf-8");
            return;
        }

        if (action == "stop" || action == "shutdown") {
            json ok = {{"success", true}, {"message", "Đang dừng an toàn máy chủ CyberNexus C++ Native..."}};
            res.set_content(ok.dump(), "application/json; charset=utf-8");

            std::thread([&svr]() {
                std::this_thread::sleep_for(std::chrono::milliseconds(400));
                std::cout << "[System] Nhan lenh tat may chu tu Login Web. Dang graceful shutdown..." << std::endl;
                svr.stop();
                std::exit(0);
            }).detach();
            return;
        }

        if (action == "restart") {
            json ok = {{"success", true}, {"message", "Đang khởi động lại dịch vụ CyberNexus C++..."}};
            res.set_content(ok.dump(), "application/json; charset=utf-8");

            std::thread([&svr]() {
                std::this_thread::sleep_for(std::chrono::milliseconds(500));
                std::cout << "[System] Nhan lenh khoi dong lai tu Login Web. Dang respawn tien trinh..." << std::endl;
                #ifdef _WIN32
                STARTUPINFOA si = { sizeof(si) };
                PROCESS_INFORMATION pi;
                char exePath[MAX_PATH];
                GetModuleFileNameA(NULL, exePath, MAX_PATH);
                CreateProcessA(exePath, NULL, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi);
                CloseHandle(pi.hProcess);
                CloseHandle(pi.hThread);
                #endif
                svr.stop();
                std::exit(0);
            }).detach();
            return;
        }

        if (action == "activate_license") {
            std::string key = body.value("license_key", "");
            if (key.empty()) {
                res.status = 400;
                res.set_content(json({{"success", false}, {"message", "Vui lòng nhập License Key!"}}).dump(), "application/json; charset=utf-8");
                return;
            }
            auto actRes = SaleApp::Backend::LicenseService::instance().activateLicense(key);
            res.set_content(actRes.dump(), "application/json; charset=utf-8");
            return;
        }

        res.status = 400;
        res.set_content(json({{"success", false}, {"message", "Hành động không hợp lệ: " + action}}).dump(), "application/json; charset=utf-8");
    });

    auto serveView = [](const std::string& name) {
        return [name](const httplib::Request&, httplib::Response& res) {
            std::string html = loadHtmlView(name);
            res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            res.set_header("Pragma", "no-cache");
            res.set_header("Expires", "0");
            res.set_content(html, "text/html; charset=utf-8");
        };
    };

    // Module C++ Native bảo mật & xác thực truy cập các trang chức năng (Anti-Bypass Gateway)
    auto serveProtectedView = [serveView](const std::string& name, const std::string& requiredRole = "") {
        return [name, requiredRole, serveView](const httplib::Request& req, httplib::Response& res) {
            auto userOpt = SaleApp::Backend::AuthService::instance().authenticate(req);
            if (!userOpt.has_value()) {
                // CHẶN NGAY TẠI C++ MICROKERNEL: Tuyệt đối không gửi HTML của trang chức năng!
                std::string target = "/login.html?redirect=" + name + ".html";
                res.status = 302;
                res.set_header("Location", target);
                res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
                res.set_header("Pragma", "no-cache");
                res.set_header("Expires", "0");
                res.set_content(
                    "<!DOCTYPE html><html><head><meta charset='utf-8'>"
                    "<meta http-equiv='refresh' content='0;url=" + target + "'>"
                    "<script>window.location.replace('" + target + "');</script></head>"
                    "<body style='background:#020617;color:#94a3b8;font-family:sans-serif;padding:30px;text-align:center;'>"
                    "<h3>🔒 Yêu Cầu Xác Thực C++ Microkernel Gateway</h3>"
                    "<p>Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. Đang chuyển hướng đến trang đăng nhập...</p>"
                    "<p><a href='" + target + "' style='color:#38bdf8;'>Bấm vào đây nếu trình duyệt không tự chuyển</a></p>"
                    "</body></html>",
                    "text/html; charset=utf-8"
                );
                return;
            }

            // Kiểm tra quyền hạn theo vai trò (Role Check)
            if (!requiredRole.empty() && requiredRole != "any") {
                if (!SaleApp::Backend::AuthService::instance().hasRole(*userOpt, requiredRole)) {
                    res.status = 403;
                    res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
                    res.set_content(
                        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>403 Forbidden</title></head>"
                        "<body style='background:#0f172a;color:#f87171;font-family:sans-serif;padding:40px;text-align:center;'>"
                        "<h2>🔒 403 - Không Có Quyền Truy Cập</h2>"
                        "<p>Tài khoản của bạn (" + userOpt->role + ") không có quyền truy cập trang này.</p>"
                        "<p><a href='/login.html' style='color:#38bdf8;'>Quay lại trang đăng nhập</a></p></body></html>",
                        "text/html; charset=utf-8"
                    );
                    return;
                }
            }

            // Đã xác thực hợp lệ qua C++ AuthService -> Cho phép render HTML
            serveView(name)(req, res);
        };
    };

    // Tự động giải phóng và hủy mọi Service Worker cũ còn sót lại trong trình duyệt ở chế độ thường
    auto serveSelfDestructingSw = [](const httplib::Request&, httplib::Response& res) {
        res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.set_content(
            "// Self-destructing Service Worker\n"
            "self.addEventListener('install', function(e) { self.skipWaiting(); });\n"
            "self.addEventListener('activate', function(e) {\n"
            "  e.waitUntil(\n"
            "    caches.keys().then(function(keys) {\n"
            "      return Promise.all(keys.map(function(k) { return caches.delete(k); }));\n"
            "    }).then(function() {\n"
            "      return self.registration.unregister();\n"
            "    }).then(function() {\n"
            "      return self.clients.matchAll();\n"
            "    }).then(function(clients) {\n"
            "      clients.forEach(function(c) { if (c.url && 'navigate' in c) c.navigate(c.url); });\n"
            "    })\n"
            "  );\n"
            "});\n",
            "application/javascript; charset=utf-8"
        );
    };
    svr.Get("/customer-sw.js", serveSelfDestructingSw);
    svr.Get("/sw.js", serveSelfDestructingSw);

    // Tuyến đường gốc '/' -> Khởi chạy bắt buộc Login (nếu chưa xác thực)
    svr.Get("/", [](const httplib::Request& req, httplib::Response& res) {
        auto userOpt = SaleApp::Backend::AuthService::instance().authenticate(req);
        std::string target = "/login.html";
        if (userOpt.has_value()) {
            if (userOpt->role == "admin" || userOpt->is_super_admin) target = "/admin.html";
            else if (userOpt->role == "waiter") target = "/order.html";
            else if (userOpt->role == "kitchen") target = "/kitchen.html";
            else target = "/index.html";
        }
        res.status = 302;
        res.set_header("Location", target);
        res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.set_content(
            "<!DOCTYPE html><html><head><meta http-equiv='refresh' content='0;url=" + target + "'>"
            "<script>window.location.replace('" + target + "');</script></head></html>",
            "text/html; charset=utf-8"
        );
    });

    // Trang Đăng Nhập Riêng (Công khai)
    svr.Get("/login", serveView("login"));
    svr.Get("/login.html", serveView("login"));
    svr.Get("/login.php", serveView("login"));

    // Trang Menu Khách Hàng (Công khai - Guest / Customer tự do không cần login)
    svr.Get("/customer", serveView("customer"));
    svr.Get("/customer.html", serveView("customer"));
    svr.Get("/customer.php", serveView("customer"));

    // Các Trang Chức Năng Bắt Buộc Phải Xác Thực Bằng Module C++ Mới Vào Được:
    svr.Get("/index", serveProtectedView("index", "any"));
    svr.Get("/index.html", serveProtectedView("index", "any"));
    svr.Get("/index.php", serveProtectedView("index", "any"));
    svr.Get("/pos", serveProtectedView("index", "any"));

    svr.Get("/admin", serveProtectedView("admin", "admin"));
    svr.Get("/admin.html", serveProtectedView("admin", "admin"));
    svr.Get("/admin.php", serveProtectedView("admin", "admin"));

    svr.Get("/kitchen", serveProtectedView("kitchen", "any"));
    svr.Get("/kitchen.html", serveProtectedView("kitchen", "any"));
    svr.Get("/kitchen.php", serveProtectedView("kitchen", "any"));

    svr.Get("/order", serveProtectedView("order", "any"));
    svr.Get("/order.html", serveProtectedView("order", "any"));
    svr.Get("/order.php", serveProtectedView("order", "any"));

    svr.Get("/online_orders", serveProtectedView("online_orders", "any"));
    svr.Get("/online_orders.html", serveProtectedView("online_orders", "any"));
    svr.Get("/online_orders.php", serveProtectedView("online_orders", "any"));

    svr.Get("/super_admin", serveProtectedView("super_admin", "admin"));
    svr.Get("/super_admin.html", serveProtectedView("super_admin", "admin"));
    svr.Get("/super_admin.php", serveProtectedView("super_admin", "admin"));

    // Bắt toàn bộ các request file .php để render HTML mượt mà và bảo mật
    svr.Get(R"(/([\w-]+)\.php)", [serveProtectedView, serveView](const httplib::Request& req, httplib::Response& res) {
        std::string viewName = req.matches[1];
        if (viewName == "customer" || viewName == "login") {
            serveView(viewName)(req, res);
        } else if (viewName == "admin" || viewName == "super_admin") {
            serveProtectedView(viewName, "admin")(req, res);
        } else {
            serveProtectedView(viewName, "any")(req, res);
        }
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
