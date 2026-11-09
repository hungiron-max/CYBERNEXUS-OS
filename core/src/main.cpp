#include <iostream>
#include <filesystem>
#include "httplib.h"
#include "PluginManager.hpp"

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

    httplib::Server svr;

    // 1. Khởi tạo ngữ cảnh CoreContext
    CoreContext ctx;
    ctx.appVersion = "1.0.0";
    ctx.hardwareHash = "HW-NEXUS-DEMO-F901";
    ctx.isSuperAdminMode = true; // Chế độ Master của SuperAdmin
    ctx.checkLicenseStatus = [](const std::string& moduleCode) {
        return true; // Mặc định chấp thuận trong phiên bản khởi tạo
    };
    ctx.emitSystemEvent = [](const std::string& evt, const json& payload) {
        PluginManager::instance().dispatchEvent(evt, payload);
    };

    // 2. Quét và nạp động toàn bộ các file DLL từ thư mục /modules
    std::string modulesDir = "./modules";
    if (!fs::exists(modulesDir)) {
        modulesDir = "../modules";
    }
    std::cout << "[Core] Đang quét thư mục module: " << modulesDir << std::endl;
    size_t loadedCount = PluginManager::instance().scanAndLoadDirectory(modulesDir, ctx);
    std::cout << "[Core] Tổng số module độc lập được nạp thành công: " << loadedCount << std::endl;

    // 3. Đăng ký các Route API cốt lõi của Host Core
    svr.Get("/", [](const httplib::Request& req, httplib::Response& res) {
        json status = {
            {"system", "CYBERNEXUS OS"},
            {"version", "1.0.0"},
            {"status", "ONLINE"},
            {"message", "Hệ thống vận hành không gian số đa năng đang hoạt động thông suốt."}
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

    // 4. Cho phép các Plugin độc lập tự đăng ký Route của riêng mình
    PluginManager::instance().registerAllActiveRoutes(svr);

    std::cout << "[Core] Máy chủ API đang lắng nghe tại cổng http://localhost:" << port << std::endl;
    std::cout << "[Core] Sẵn sàng phục vụ kết nối POS, Bếp KDS, Router ER-X và Media Streaming." << std::endl;

    svr.listen("0.0.0.0", port);
    return 0;
}
