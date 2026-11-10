#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include "nlohmann/json.hpp"

namespace SaleApp::Backend {

using json = nlohmann::json;

struct SaasModule {
    std::string code;
    std::string name;
    std::string desc;
    std::string icon;
    std::string badge;
    std::string badge_color;
    std::string category;
    bool required = false;
    bool addon = false;
    double price_month = 0.0;
    std::vector<std::string> requires;
};

class LicenseService {
public:
    static LicenseService& instance();

    // 1. Hardware ID (Bước 5.1)
    std::string getMachineId();

    // 2. 14 Modules Catalog & Matrix
    const std::vector<SaasModule>& getCatalog() const;
    json getModuleMatrix(const std::vector<std::string>& enabledModules) const;
    bool isModuleValid(const std::string& code) const;
    std::vector<std::string> getModuleRequirements(const std::string& code) const;

    // 3. Dynamic Module Guard (Kiểm tra quyền truy cập tính năng)
    bool isModuleEnabled(const std::string& moduleCode);
    std::vector<std::string> getEnabledModules(int64_t tenantId = 0);

    // 4. Super Admin Module Switch (Bước 5.3)
    bool isSuperAdminMode() const;
    void setSuperAdminMode(bool enabled);
    json toggleModule(int64_t tenantId, const std::string& moduleCode, bool enabled);
    json setAllModules(int64_t tenantId, const std::string& mode);

    // 5. License Status & Evaluation (Bước 5.2, 5.4)
    json getLicenseStatus(int64_t tenantId = 0);
    json activateLicense(const std::string& licenseKey);
    json verifyLicenseOnline(const std::string& licenseKey, const std::string& machineId);

private:
    LicenseService();
    void initCatalog();

    std::vector<SaasModule> m_catalog;
    std::unordered_map<std::string, size_t> m_catalogIndex;
    std::string m_cachedMachineId;
    bool m_superAdminMode = false;
};

} // namespace SaleApp::Backend

