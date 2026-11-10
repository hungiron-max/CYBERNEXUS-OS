#pragma once

#include "httplib.h"
#include "nlohmann/json.hpp"
#include "db.hpp"
#include "body_parser.hpp"
#include "auth.hpp"

namespace SaleApp::Backend {

using json = nlohmann::json;

class MasterHandlers {
public:
    static void registerRoutes(httplib::Server& svr);

    static void handleSuperAdmin(const httplib::Request& req, httplib::Response& res);
    static void handleLicenseVerification(const httplib::Request& req, httplib::Response& res);

    static void sendJson(httplib::Response& res, const json& data, int statusCode = 200);
    static void sendError(httplib::Response& res, const std::string& message, int statusCode = 400);

    static json parseBody(const httplib::Request& req);
    static std::string getAction(const httplib::Request& req, const json& body);
    static std::string getString(const json& j, const std::string& key, const std::string& def = "");
    static int64_t getInt(const json& j, const std::string& key, int64_t def = 0);
};

} // namespace SaleApp::Backend
