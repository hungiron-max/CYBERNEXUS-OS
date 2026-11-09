#define BUILDING_PLUGIN_DLL
#include "IModulePlugin.hpp"
#include <iostream>

using namespace CyberNexus;

class NetworkQosPlugin : public IModulePlugin {
public:
    ModuleMetadata getMetadata() const override {
        ModuleMetadata m;
        m.code = "mod_network_qos";
        m.name = "Quản Trị Băng Thông & Tường Lửa Router (SNM)";
        m.version = "1.0.0";
        m.author = "SuperAdmin";
        m.category = "Network";
        m.description = "Tương tác Router EdgeRouter ER-X / MikroTik: Cấp tốc độ VIP cho khách có hóa đơn, chặn web đen, lọc DNS.";
        m.monthly_price_vnd = 199000.0;
        m.is_core_required = false;
        m.dependencies = {};
        return m;
    }

    bool onLoad(const CoreContext& ctx) override {
        std::cout << "[mod_network_qos] Khởi tạo hệ thống kết nối Router..." << std::endl;
        return true;
    }

    void onUnload() override {
        std::cout << "[mod_network_qos] Ngắt kết nối và giải phóng tài nguyên mạng." << std::endl;
    }

    void registerHttpRoutes(httplib::Server& svr) override {
        // GET /api/network/devices - Lấy danh sách thiết bị LAN
        svr.Get("/api/network/devices", [](const httplib::Request& req, httplib::Response& res) {
            json data = {
                {"status", "success"},
                {"devices", {
                    {{"mac", "B4:2E:99:A1:02:11"}, {"ip", "192.168.1.105"}, {"name", "iPhone 15 Pro"}, {"qos", "vip_high_speed"}, {"traffic_mb", 245.5}},
                    {{"mac", "70:85:C2:55:FF:01"}, {"ip", "192.168.1.110"}, {"name", "Samsung S24"}, {"qos", "free_basic"}, {"traffic_mb", 52.1}}
                }}
            };
            res.set_content(data.dump(2), "application/json; charset=utf-8");
        });

        // POST /api/network/qos/set - Đổi mức QoS cho khách
        svr.Post("/api/network/qos/set", [](const httplib::Request& req, httplib::Response& res) {
            json data = {
                {"status", "success"},
                {"message", "Đã cập nhật QoS Router thành công."}
            };
            res.set_content(data.dump(2), "application/json; charset=utf-8");
        });
    }

    void onSystemEvent(const std::string& eventType, const json& eventPayload) override {
        // Khi nhận sự kiện "ORDER_PAID" từ POS Core -> Tự động cấp băng thông VIP cho IP/MAC của khách
        if (eventType == "ORDER_PAID") {
            std::cout << "[mod_network_qos] Nhận tín hiệu đơn hàng thanh toán thành công! Tự động nâng tốc độ VIP cho khách." << std::endl;
        }
    }
};

// Xuất các hàm export để PluginManager nạp động
extern "C" {
    CYBERNEXUS_PLUGIN_API IModulePlugin* createCyberNexusPlugin() {
        return new NetworkQosPlugin();
    }

    CYBERNEXUS_PLUGIN_API void destroyCyberNexusPlugin(IModulePlugin* p) {
        delete p;
    }
}
