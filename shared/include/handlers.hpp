#pragma once

#include "httplib.h"
#include "nlohmann/json.hpp"

namespace SaleApp::Backend {

using json = nlohmann::json;

class ApiHandlers {
public:
    static void registerRoutes(httplib::Server& svr);

    // Helpers
    static void sendJson(httplib::Response& res, const json& data, int statusCode = 200);
    static void sendError(httplib::Response& res, const std::string& message, int statusCode = 400);
    static json parseBody(const httplib::Request& req);

    // Individual Handlers
    static void handleAuth(const httplib::Request& req, httplib::Response& res);
    static void handleCategories(const httplib::Request& req, httplib::Response& res);
    static void handleProducts(const httplib::Request& req, httplib::Response& res);
    static void handleTables(const httplib::Request& req, httplib::Response& res);
    static void handleOrders(const httplib::Request& req, httplib::Response& res);
    static void handleReports(const httplib::Request& req, httplib::Response& res);
    static void handleFinance(const httplib::Request& req, httplib::Response& res);
    static void handleSettings(const httplib::Request& req, httplib::Response& res);
    static void handleUsers(const httplib::Request& req, httplib::Response& res);
    static void handleOperations(const httplib::Request& req, httplib::Response& res);
    static void handleLicense(const httplib::Request& req, httplib::Response& res);
    static void handleLicenseClient(const httplib::Request& req, httplib::Response& res);
    static void handleSuperAdmin(const httplib::Request& req, httplib::Response& res);
    static void handleAdvertising(const httplib::Request& req, httplib::Response& res);
    static void handleMediaTracks(const httplib::Request& req, httplib::Response& res);
};

} // namespace SaleApp::Backend

