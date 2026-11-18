#define BUILDING_PLUGIN_DLL
#include "IModulePlugin.hpp"
#include <algorithm>
#include <cmath>
#include <iostream>
#include <string>

using namespace CyberNexus;

namespace {
double roundVnd(double v) {
    return std::round(v);
}

std::string maskSecret(const std::string& raw) {
    if (raw.empty()) return "";
    if (raw.size() <= 6) return std::string(raw.size(), '*');
    return raw.substr(0, 3) + std::string(raw.size() - 6, '*') + raw.substr(raw.size() - 3);
}
} // namespace

class FinanceAdminPlugin : public IModulePlugin {
public:
    ModuleMetadata getMetadata() const override {
        ModuleMetadata m;
        m.code = "mod_finance_admin";
        m.name = "Tài Chính, Sổ Quỹ, Kho AI & Bảo Mật Cấu Hình";
        m.version = "1.0.0";
        m.author = "SuperAdmin";
        m.category = "Finance";
        m.description = "Tổng hợp doanh thu, sổ quỹ, tính toán phiếu nhập kho AI OCR và chuẩn hóa/che giấu cấu hình nhạy cảm phía Native C++.";
        m.monthly_price_vnd = 0.0;
        m.is_core_required = true;
        m.dependencies = {"mod_pos_core"};
        return m;
    }

    bool onLoad(const CoreContext& ctx) override {
        std::cout << "[mod_finance_admin] Đã nạp thành công phân hệ Tài chính, Kho & Bảo mật cấu hình." << std::endl;
        return true;
    }

    void onUnload() override {
        std::cout << "[mod_finance_admin] Đã giải phóng phân hệ Tài chính & Bảo mật cấu hình." << std::endl;
    }

    void registerHttpRoutes(httplib::Server& svr) override {
        // POST /api/finance/summarize - Tổng hợp doanh thu, giá vốn, lợi nhuận thuần phía Native DLL
        svr.Post("/api/finance/summarize", [](const httplib::Request& req, httplib::Response& res) {
            json body = json::parse(req.body, nullptr, false);
            if (body.is_discarded() || !body.is_object()) {
                res.status = 400;
                res.set_content(json({{"success", false}, {"message", "Payload JSON không hợp lệ"}}).dump(), "application/json; charset=utf-8");
                return;
            }

            double revenue = body.value("revenue", 0.0);
            double cogs = body.value("cogs", 0.0);
            double operatingExpense = body.value("operating_expense", 0.0);
            double openingCash = body.value("opening_cash", 0.0);
            double cashIn = body.value("cash_in", 0.0);
            double cashOut = body.value("cash_out", 0.0);

            if (body.contains("orders") && body["orders"].is_array()) {
                revenue = 0.0;
                for (const auto& o : body["orders"]) {
                    if (o.is_object()) {
                        revenue += std::max(0.0, o.value("total", 0.0));
                    }
                }
            }
            if (body.contains("expenses") && body["expenses"].is_array()) {
                operatingExpense = 0.0;
                for (const auto& e : body["expenses"]) {
                    if (e.is_object()) {
                        operatingExpense += std::max(0.0, e.value("amount", 0.0));
                    }
                }
            }

            double grossProfit = roundVnd(revenue - cogs);
            double netProfit = roundVnd(grossProfit - operatingExpense);
            double marginPct = (revenue > 0.0) ? std::round((netProfit / revenue) * 10000.0) / 100.0 : 0.0;
            double closingCash = roundVnd(openingCash + cashIn - cashOut);

            json out = {
                {"success", true},
                {"engine", "mod_finance_admin.dll"},
                {"data", {
                    {"revenue", roundVnd(revenue)},
                    {"cogs", roundVnd(cogs)},
                    {"operating_expense", roundVnd(operatingExpense)},
                    {"gross_profit", grossProfit},
                    {"net_profit", netProfit},
                    {"profit_margin_pct", marginPct},
                    {"closing_cash", closingCash}
                }}
            };
            res.set_content(out.dump(2), "application/json; charset=utf-8");
        });

        // POST /api/inventory/calc-receipt - Tính toán phiếu nhập kho & đơn giá bình quân phía Native DLL
        svr.Post("/api/inventory/calc-receipt", [](const httplib::Request& req, httplib::Response& res) {
            json body = json::parse(req.body, nullptr, false);
            if (body.is_discarded() || !body.is_object() || !body.contains("items") || !body["items"].is_array()) {
                res.status = 400;
                res.set_content(json({{"success", false}, {"message", "Thiếu danh sách items nhập kho"}}).dump(), "application/json; charset=utf-8");
                return;
            }

            double vatRate = std::clamp(body.value("vat_rate", 0.0), 0.0, 100.0);
            double discount = std::max(0.0, body.value("discount", 0.0));
            double subtotal = 0.0;
            json normalizedItems = json::array();

            for (const auto& it : body["items"]) {
                if (!it.is_object()) continue;
                double qty = std::max(0.0, it.value("quantity", 0.0));
                double unitPrice = std::max(0.0, it.value("unit_price", 0.0));
                double lineTotal = roundVnd(qty * unitPrice);
                subtotal += lineTotal;
                json row = it;
                row["quantity"] = qty;
                row["unit_price"] = roundVnd(unitPrice);
                row["line_total"] = lineTotal;
                normalizedItems.push_back(row);
            }

            double afterDiscount = std::max(0.0, subtotal - discount);
            double vatAmount = roundVnd(afterDiscount * (vatRate / 100.0));
            double grandTotal = roundVnd(afterDiscount + vatAmount);

            json out = {
                {"success", true},
                {"engine", "mod_finance_admin.dll"},
                {"data", {
                    {"items", normalizedItems},
                    {"subtotal", roundVnd(subtotal)},
                    {"discount", roundVnd(discount)},
                    {"vat_rate", vatRate},
                    {"vat_amount", vatAmount},
                    {"grand_total", grandTotal}
                }}
            };
            res.set_content(out.dump(2), "application/json; charset=utf-8");
        });

        // POST /api/security/mask-config - Chuẩn hóa & che giấu khóa nhạy cảm trước khi trả về UI
        svr.Post("/api/security/mask-config", [](const httplib::Request& req, httplib::Response& res) {
            json body = json::parse(req.body, nullptr, false);
            if (body.is_discarded() || !body.is_object()) {
                res.status = 400;
                res.set_content(json({{"success", false}, {"message", "Payload JSON không hợp lệ"}}).dump(), "application/json; charset=utf-8");
                return;
            }
            json masked = body;
            for (const char* key : {"gemini_api_key", "sync_password", "api_secret", "router_password"}) {
                if (masked.contains(key) && masked[key].is_string()) {
                    masked[key] = maskSecret(masked[key].get<std::string>());
                }
            }
            res.set_content(json({{"success", true}, {"engine", "mod_finance_admin.dll"}, {"data", masked}}).dump(2), "application/json; charset=utf-8");
        });

        // POST /api/finance/pnl-metrics - Tính toàn bộ chỉ số P&L, VAT & điểm hòa vốn phía Native DLL
        svr.Post("/api/finance/pnl-metrics", [](const httplib::Request& req, httplib::Response& res) {
            json body = json::parse(req.body, nullptr, false);
            if (body.is_discarded() || !body.is_object()) {
                res.status = 400;
                res.set_content(json({{"success", false}, {"message", "Payload JSON không hợp lệ"}}).dump(), "application/json; charset=utf-8");
                return;
            }
            double grossRev = std::max(0.0, body.value("gross_revenue", 0.0));
            double discounts = std::max(0.0, body.value("discounts", 0.0));
            double refunds = std::max(0.0, body.value("refunds", 0.0));
            double cogs = std::max(0.0, body.value("cogs", 0.0));
            double payroll = std::max(0.0, body.value("payroll", 0.0));
            double opExpense = std::max(0.0, body.value("operating_expense", 0.0));
            double vatRate = std::clamp(body.value("vat_rate", 0.0), 0.0, 100.0);
            double cashIn = std::max(0.0, body.value("cash_in", 0.0));
            double cashOut = std::max(0.0, body.value("cash_out", 0.0));

            double netRev = std::max(0.0, roundVnd(grossRev - discounts - refunds));
            double grossProfit = roundVnd(netRev - cogs);
            double totalFixed = roundVnd(payroll + opExpense);
            double operatingProfit = roundVnd(grossProfit - totalFixed);
            double vatPayable = roundVnd(netRev * (vatRate / 100.0));
            double netProfit = roundVnd(operatingProfit - vatPayable);
            double gmRatio = (netRev > 0.0) ? ((netRev - cogs) / netRev) : 0.0;
            double breakEven = (gmRatio > 0.01) ? roundVnd(totalFixed / gmRatio) : 0.0;

            auto pct = [&](double num) {
                return (netRev > 0.0) ? (std::round((num / netRev) * 10000.0) / 100.0) : 0.0;
            };

            res.set_content(json({
                {"success", true},
                {"engine", "mod_finance_admin.dll"},
                {"data", {
                    {"net_revenue", netRev},
                    {"gross_profit", grossProfit},
                    {"operating_profit", operatingProfit},
                    {"vat_payable", vatPayable},
                    {"net_profit", netProfit},
                    {"cogs_ratio_pct", pct(cogs)},
                    {"expense_ratio_pct", pct(totalFixed)},
                    {"net_margin_pct", pct(netProfit)},
                    {"break_even_revenue", breakEven},
                    {"cashflow_net", roundVnd(cashIn - cashOut)}
                }}
            }).dump(2), "application/json; charset=utf-8");
        });

        // POST /api/hr/calculate-payroll - Tính bảng lương & khấu trừ đi trễ/thưởng phía Native DLL
        svr.Post("/api/hr/calculate-payroll", [](const httplib::Request& req, httplib::Response& res) {
            json body = json::parse(req.body, nullptr, false);
            if (body.is_discarded() || !body.is_object() || !body.contains("staff_list") || !body["staff_list"].is_array()) {
                res.status = 400;
                res.set_content(json({{"success", false}, {"message", "Thiếu danh sách nhân viên staff_list"}}).dump(), "application/json; charset=utf-8");
                return;
            }
            double penaltyPerMin = std::max(0.0, body.value("penalty_per_late_min", 0.0));
            double totalPayroll = 0.0;
            json rows = json::array();
            for (const auto& s : body["staff_list"]) {
                if (!s.is_object()) continue;
                double rate = std::max(0.0, s.value("hourly_rate", 0.0));
                double hours = std::max(0.0, s.value("total_hours", 0.0));
                int lateMins = std::max(0, s.value("late_minutes", 0));
                double bonus = std::max(0.0, s.value("bonus", 0.0));
                double deduction = std::max(0.0, s.value("deduction", 0.0));
                double basePay = roundVnd(rate * hours);
                double latePenalty = roundVnd(lateMins * penaltyPerMin);
                double netPay = std::max(0.0, roundVnd(basePay + bonus - deduction - latePenalty));
                totalPayroll += netPay;
                json row = s;
                row["base_pay"] = basePay;
                row["late_penalty"] = latePenalty;
                row["net_pay"] = netPay;
                rows.push_back(row);
            }
            res.set_content(json({
                {"success", true},
                {"engine", "mod_finance_admin.dll"},
                {"data", {{"rows", rows}, {"total_payroll", roundVnd(totalPayroll)}}}
            }).dump(2), "application/json; charset=utf-8");
        });
    }
};

extern "C" {
    CYBERNEXUS_PLUGIN_API IModulePlugin* createCyberNexusPlugin() {
        return new FinanceAdminPlugin();
    }

    CYBERNEXUS_PLUGIN_API void destroyCyberNexusPlugin(IModulePlugin* p) {
        delete p;
    }
}
