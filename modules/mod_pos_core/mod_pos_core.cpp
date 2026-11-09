#define BUILDING_PLUGIN_DLL
#include "IModulePlugin.hpp"
#include <iostream>

using namespace CyberNexus;

class PosCorePlugin : public IModulePlugin {
public:
    ModuleMetadata getMetadata() const override {
        ModuleMetadata m;
        m.code = "mod_pos_core";
        m.name = "POS Bán Hàng & Quản Lý Bàn (F&B)";
        m.version = "1.0.0";
        m.author = "SuperAdmin";
        m.category = "POS";
        m.description = "Bán hàng cảm ứng, chia bàn, tạo giỏ hàng, in bill nhiệt 80mm/58mm và xuất hóa đơn.";
        m.monthly_price_vnd = 149000.0;
        m.is_core_required = true;
        m.dependencies = {};
        return m;
    }

    bool onLoad(const CoreContext& ctx) override {
        std::cout << "[mod_pos_core] Đã nạp thành công phân hệ Bán hàng & Quản lý bàn POS." << std::endl;
        return true;
    }

    void onUnload() override {
        std::cout << "[mod_pos_core] Đã giải phóng phân hệ Bán hàng POS." << std::endl;
    }

    void registerHttpRoutes(httplib::Server& svr) override {
        // GET /api/pos/tables - Danh sách bàn
        svr.Get("/api/pos/tables", [](const httplib::Request& req, httplib::Response& res) {
            json data = {
                {"status", "success"},
                {"tables", {
                    {{"id", 1}, {"name", "Bàn TQ 01"}, {"status", "occupied"}, {"total_amount", 125000}},
                    {{"id", 2}, {"name", "Bàn TQ 02"}, {"status", "empty"}, {"total_amount", 0}},
                    {{"id", 3}, {"name", "Mang Về MV1"}, {"status", "empty"}, {"total_amount", 0}}
                }}
            };
            res.set_content(data.dump(2), "application/json; charset=utf-8");
        });

        // POST /api/pos/orders/create - Tạo đơn bán hàng
        svr.Post("/api/pos/orders/create", [](const httplib::Request& req, httplib::Response& res) {
            json data = {
                {"status", "success"},
                {"order_id", 1001},
                {"message", "Đã tạo đơn thành công."}
            };
            res.set_content(data.dump(2), "application/json; charset=utf-8");
        });
    }
};

extern "C" {
    CYBERNEXUS_PLUGIN_API IModulePlugin* createCyberNexusPlugin() {
        return new PosCorePlugin();
    }

    CYBERNEXUS_PLUGIN_API void destroyCyberNexusPlugin(IModulePlugin* p) {
        delete p;
    }
}
