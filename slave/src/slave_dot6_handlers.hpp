#pragma once

#include "httplib.h"
#include "nlohmann/json.hpp"
#include "db.hpp"
#include <string>

namespace SaleApp::Backend {

using json = nlohmann::json;

class Dot6Handlers {
public:
    static void ensureDot6Schema(Database& db);
    static void registerDot6Routes(httplib::Server& svr);

    static bool verifyManagerPin(Database& db, const std::string& rawPin, json& mgrOut);
    static std::string hmacSha256Hex(const std::string& key, const std::string& msg);
    static std::string getOrCreateStoreSecret(Database& db, const std::string& settingKey);
    static json loadReceiptTemplateCfg(Database& db);
    static bool isQrClientBlacklisted(Database& db, const std::string& clientIp, const std::string& phone, std::string& reasonOut);

    static bool processUnifiedAttendancePunch(
        Database& db,
        int64_t userId,
        const std::string& mode, // "checkin", "checkout", "auto"
        const std::string& source,
        const std::string& verifyMode,
        int64_t deviceId,
        const std::string& deviceName,
        const std::string& photoPath,
        const std::string& externalEventId,
        const std::string& tsIn,
        const std::string& noteIn,
        int cooldownSeconds,
        json& resultOut,
        std::string& errOut,
        int& httpCodeOut
    );

    static bool handleDot6Operations(const std::string& action, const httplib::Request& req, httplib::Response& res, Database& db, const json& body);
    static bool handleDot6Tables(const std::string& action, const httplib::Request& req, httplib::Response& res, Database& db, const json& body);
    static bool handleDot6Orders(const std::string& action, const httplib::Request& req, httplib::Response& res, Database& db, const json& body);

    static void runDot6PeriodicMaintenance();
};

} // namespace SaleApp::Backend
