#define BUILDING_PLUGIN_DLL
#include "IModulePlugin.hpp"
#include <algorithm>
#include <cmath>
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

        // POST /api/pos/calculate-cart - Tính tiền giỏ hàng, giảm giá, phí dịch vụ & thuế phía Native DLL
        svr.Post("/api/pos/calculate-cart", [](const httplib::Request& req, httplib::Response& res) {
            json body = json::parse(req.body, nullptr, false);
            if (body.is_discarded() || !body.is_object() || !body.contains("items") || !body["items"].is_array()) {
                res.status = 400;
                res.set_content(json({{"success", false}, {"message", "Thiếu danh sách items"}}).dump(), "application/json; charset=utf-8");
                return;
            }
            double subtotal = 0.0;
            int totalQty = 0;
            for (const auto& item : body["items"]) {
                if (!item.is_object()) continue;
                int qty = std::max(0, item.value("qty", item.value("quantity", 0)));
                double price = std::max(0.0, item.value("price", 0.0));
                double itemDiscPct = std::clamp(item.value("discount_pct", 0.0), 0.0, 100.0);
                double line = std::round(price * qty * (1.0 - itemDiscPct / 100.0));
                subtotal += line;
                totalQty += qty;
            }
            double discountAmount = std::max(0.0, body.value("discount_amount", 0.0));
            double discountPct = std::clamp(body.value("discount_pct", 0.0), 0.0, 100.0);
            if (discountPct > 0.0 && discountAmount == 0.0) {
                discountAmount = std::round(subtotal * (discountPct / 100.0));
            }
            discountAmount = std::min(subtotal, discountAmount);
            double afterDiscount = std::max(0.0, subtotal - discountAmount);
            double servicePct = std::clamp(body.value("service_fee_pct", 0.0), 0.0, 100.0);
            double taxPct = std::clamp(body.value("tax_rate", 0.0), 0.0, 100.0);
            double serviceFee = std::round(afterDiscount * (servicePct / 100.0));
            double taxAmount = std::round((afterDiscount + serviceFee) * (taxPct / 100.0));
            double grandTotal = std::round(afterDiscount + serviceFee + taxAmount);

            json out = {
                {"success", true},
                {"engine", "mod_pos_core.dll"},
                {"data", {
                    {"total_qty", totalQty},
                    {"subtotal", std::round(subtotal)},
                    {"discount_amount", std::round(discountAmount)},
                    {"service_fee", serviceFee},
                    {"tax_amount", taxAmount},
                    {"grand_total", grandTotal}
                }}
            };
            res.set_content(out.dump(2), "application/json; charset=utf-8");
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
