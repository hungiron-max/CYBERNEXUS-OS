#include "handlers.hpp"
#include "db.hpp"
#include "auth.hpp"
#include "body_parser.hpp"
#include "license.hpp"
#include "ConfigManager.hpp"
#include <ctime>

namespace SaleApp::Backend {

static std::string getLicAction(const httplib::Request& req, const json& body) {
    if (req.has_param("action")) return req.get_param_value("action");
    if (body.contains("action") && body["action"].is_string()) return body["action"].get<std::string>();
    return "";
}

static std::string getLicStr(const json& obj, const std::string& key, const std::string& def = "") {
    if (obj.contains(key) && obj[key].is_string()) return obj[key].get<std::string>();
    return def;
}

void ApiHandlers::handleLicense(const httplib::Request& req, httplib::Response& res) {
    try {
        json body = parseBody(req);
        std::string action = getLicAction(req, body);

        if (action == "ping") {
            sendJson(res, {
                {"success", true},
                {"time", std::time(nullptr)},
                {"machine_id", LicenseService::instance().getMachineId()}
            });
            return;
        }

        if (action == "check" || action == "status" || action.empty()) {
            json status = LicenseService::instance().getLicenseStatus();
            sendJson(res, status);
            return;
        }

        if (action == "activate") {
            std::string key = getLicStr(body, "license_key");
            json act = LicenseService::instance().activateLicense(key);
            sendJson(res, act, act.value("success", false) ? 200 : 400);
            return;
        }

        sendError(res, "Invalid license request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi license: ") + e.what()}}, 500);
    }
}

void ApiHandlers::handleLicenseClient(const httplib::Request& req, httplib::Response& res) {
    try {
        json body = parseBody(req);
        std::string action = getLicAction(req, body);

        if (action == "status" || action.empty()) {
            json st = LicenseService::instance().getLicenseStatus();
            sendJson(res, st);
            return;
        }

        if (action == "sync_now" || action == "sync_if_due") {
            auto& db = Database::instance();
            auto row = db.queryRow("SELECT license_key FROM local_license_cache WHERE id = 1");
            std::string key = (!row.is_null() && row.contains("license_key") && row["license_key"].is_string())
                ? row["license_key"].get<std::string>() : "";
            if (!key.empty()) {
                LicenseService::instance().verifyLicenseOnline(key, LicenseService::instance().getMachineId());
            }
            json st = LicenseService::instance().getLicenseStatus();
            sendJson(res, {
                {"success", true},
                {"synced", true},
                {"state", "valid"},
                {"rights_revision", 1},
                {"message", "Đã đồng bộ giấy phép bản quyền từ Master thành công!"},
                {"data", st.value("data", json::object())}
            });
            return;
        }

        if (action == "activate") {
            std::string key = getLicStr(body, "license_key");
            json act = LicenseService::instance().activateLicense(key);
            act["data"] = LicenseService::instance().getLicenseStatus().value("data", json::object());
            sendJson(res, act, act.value("success", false) ? 200 : 400);
            return;
        }

        if (action == "create_billing_order") {
            auto userOpt = AuthService::instance().authenticate(req);
            if (!userOpt || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
                sendError(res, "Chỉ Chủ quán (Admin) mới được tạo đơn gia hạn / nạp AI Credit!", 403);
                return;
            }
            auto& db = Database::instance();
            auto row = db.queryRow("SELECT license_key FROM local_license_cache WHERE id = 1");
            std::string key = (!row.is_null() && row.contains("license_key") && row["license_key"].is_string())
                ? row["license_key"].get<std::string>() : "";
            std::string masterUrl = SaleApp::Config::AppConfig::instance().getMasterServerUrl();
            if (masterUrl.empty() || key.empty()) {
                sendError(res, "Quán chưa cấu hình kết nối Master hoặc License Key!", 400);
                return;
            }
            json payload = {
                {"license_key", key},
                {"billing_type", getLicStr(body, "billing_type", "renew_plan")},
                {"quantity", body.value("quantity", 1)}
            };
            httplib::Client cli(masterUrl.c_str());
            cli.set_connection_timeout(5, 0);
            cli.set_read_timeout(10, 0);
            auto mRes = cli.Post("/api/billing/create_order", payload.dump(), "application/json");
            if (!mRes) {
                sendError(res, "Không thể kết nối tới Master Server (" + masterUrl + ")!", 502);
                return;
            }
            try {
                sendJson(res, json::parse(mRes->body), mRes->status);
            } catch (...) {
                sendError(res, "Phản hồi không hợp lệ từ Master", 502);
            }
            return;
        }

        if (action == "check_billing_order") {
            std::string orderCode = BodyParser::getParam(req, body, "order_code", "");
            if (orderCode.empty() && req.has_param("order_code")) orderCode = req.get_param_value("order_code");
            std::string masterUrl = SaleApp::Config::AppConfig::instance().getMasterServerUrl();
            if (masterUrl.empty() || orderCode.empty()) {
                sendError(res, "Thiếu order_code hoặc Master URL!", 400);
                return;
            }
            httplib::Client cli(masterUrl.c_str());
            cli.set_connection_timeout(5, 0);
            cli.set_read_timeout(10, 0);
            auto mRes = cli.Get(("/api/billing/status?order_code=" + httplib::detail::encode_url(orderCode)).c_str());
            if (!mRes) {
                sendError(res, "Không thể kết nối tới Master Server!", 502);
                return;
            }
            try {
                json resp = json::parse(mRes->body);
                if (resp.value("success", false) && resp.contains("order") && resp["order"].value("status", "") == "paid") {
                    auto& db = Database::instance();
                    auto row = db.queryRow("SELECT license_key FROM local_license_cache WHERE id = 1");
                    std::string key = (!row.is_null() && row.contains("license_key") && row["license_key"].is_string())
                        ? row["license_key"].get<std::string>() : "";
                    if (!key.empty()) {
                        LicenseService::instance().verifyLicenseOnline(key, LicenseService::instance().getMachineId());
                    }
                }
                sendJson(res, resp, mRes->status);
            } catch (...) {
                sendError(res, "Phản hồi không hợp lệ từ Master", 502);
            }
            return;
        }

        sendError(res, "Invalid license client request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi client license: ") + e.what()}}, 500);
    }
}

} // namespace SaleApp::Backend
