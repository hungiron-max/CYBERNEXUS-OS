#include <iostream>
#include <filesystem>
#include "httplib.h"
#include "PluginManager.hpp"
#include "db.hpp"

namespace fs = std::filesystem;
using namespace CyberNexus;

int main(int argc, char* argv[]) {
    int port = 8500;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--port" || arg == "-p") {
            if (i + 1 < argc) {
                try { port = std::stoi(argv[++i]); } catch (...) {}
            }
        }
    }

    std::cout << "==========================================================" << std::endl;
    std::cout << "        🚀 CYBERNEXUS OS — NATIVE MICROKERNEL HOST        " << std::endl;
    std::cout << "  Smart Venue Operating System (POS + Network + Media + AI)" << std::endl;
    std::cout << "  Version 1.0.0 (C++17 Standalone - Dynamic Module Engine) " << std::endl;
    std::cout << "==========================================================" << std::endl;

    // 1. Khởi tạo Cơ sở dữ liệu SQLite nhúng
    std::string dbDir = "./database";
    if (!fs::exists(dbDir)) {
        try { fs::create_directories(dbDir); } catch (...) {}
    }
    std::string dbPath = dbDir + "/cybernexus.db";
    auto& db = Database::instance();
    if (!db.open(dbPath)) {
        std::cerr << "[Core] Lỗi: Không thể khởi tạo database SQLite tại: " << dbPath << std::endl;
    } else {
        db.initUnifiedSchema();
    }

    httplib::Server svr;

    // 2. Thiết lập thư mục phục vụ giao diện Web tĩnh (Liquid Glass UI)
    std::string webDir = "./web";
    if (!fs::exists(webDir)) {
        webDir = "../web";
    }
    if (fs::exists(webDir)) {
        svr.set_mount_point("/", webDir);
        std::cout << "[Core] Đã mount thư mục Web UI Liquid Glass: " << webDir << std::endl;
    }

    // 3. Khởi tạo ngữ cảnh CoreContext
    CoreContext ctx;
    ctx.dbHandle = db.getRawHandle();
    ctx.appVersion = "1.0.0";
    ctx.hardwareHash = "HW-NEXUS-F901";
    ctx.isSuperAdminMode = true; // Chế độ Master của SuperAdmin
    ctx.checkLicenseStatus = [](const std::string& moduleCode) {
        return true; // Mặc định chấp thuận trong phiên bản khởi tạo
    };
    ctx.emitSystemEvent = [](const std::string& evt, const json& payload) {
        PluginManager::instance().dispatchEvent(evt, payload);
    };

    // 4. Quét và nạp động toàn bộ các file DLL từ thư mục /modules
    std::string modulesDir = "./modules";
    if (!fs::exists(modulesDir)) {
        modulesDir = "../modules";
    }
    std::cout << "[Core] Đang quét thư mục module: " << modulesDir << std::endl;
    size_t loadedCount = PluginManager::instance().scanAndLoadDirectory(modulesDir, ctx);
    std::cout << "[Core] Tổng số module độc lập được nạp thành công: " << loadedCount << std::endl;

    // 5. Đăng ký các Route API cốt lõi của Host Core
    svr.Get("/api/system/status", [](const httplib::Request& req, httplib::Response& res) {
        json status = {
            {"system", "cybernexus-os"},
            {"version", "1.0.0"},
            {"status", "ONLINE"},
            {"database", "SQLite 3 WAL"},
            {"architecture", "Microkernel C++17"}
        };
        res.set_content(status.dump(2), "application/json; charset=utf-8");
    });

    // API tra cứu ma trận module cho SuperAdmin Dashboard
    svr.Get("/api/admin/modules", [](const httplib::Request& req, httplib::Response& res) {
        json matrix = PluginManager::instance().getModulesStatusMatrix();
        res.set_content(matrix.dump(2), "application/json; charset=utf-8");
    });

    // API bật/tắt module nóng từ xa (Feature Toggle)
    svr.Post(R"(/api/admin/modules/(\w+)/toggle)", [](const httplib::Request& req, httplib::Response& res) {
        std::string modCode = req.matches[1];
        bool enable = (req.get_param_value("enable") == "true" || req.get_param_value("enable") == "1");
        bool success = PluginManager::instance().setModuleState(modCode, enable);
        json reply = {
            {"module", modCode},
            {"enabled", enable},
            {"success", success}
        };
        res.set_content(reply.dump(2), "application/json; charset=utf-8");
    });

    // 6. Cho phép các Plugin độc lập tự đăng ký Route của riêng mình
    PluginManager::instance().registerAllActiveRoutes(svr);

    std::cout << "==========================================================" << std::endl;
    std::cout << "  🚀 Máy chủ cybernexus-os đang chạy tại:                 " << std::endl;
    std::cout << "     -> Quầy Bán Hàng POS: http://localhost:" << port << "/index.html" << std::endl;
    std::cout << "     -> Màn Hình Bếp KDS: http://localhost:" << port << "/kitchen.html" << std::endl;
    std::cout << "     -> Nhân Viên Order:  http://localhost:" << port << "/order.html" << std::endl;
    std::cout << "     -> Menu Khách Hàng:  http://localhost:" << port << "/customer.html" << std::endl;
    std::cout << "     -> SuperAdmin Portal:http://localhost:" << port << "/super_admin.html" << std::endl;
    std::cout << "==========================================================" << std::endl;

    svr.listen("0.0.0.0", port);
    return 0;
}
