#pragma once

#include <string>
#include <filesystem>
#include <iostream>
#include <fstream>
#include <cstdlib>
#include "nlohmann/json.hpp"

#ifdef _WIN32
#include <windows.h>
#else
#include <unistd.h>
#include <limits.h>
#endif

namespace SaleApp::Config {

namespace fs = std::filesystem;
using json = nlohmann::json;

class AppConfig {
public:
    static AppConfig& instance() {
        static AppConfig inst;
        return inst;
    }

    // Initialize paths from exe location and optional config.json
    void init(const std::string& appRole, int argc = 0, char* argv[] = nullptr) {
        m_appRole = appRole;
        m_exeDir = detectExecutableDir();

        // 1. Set default base directory as the directory containing the exe
        m_baseDir = m_exeDir;

        // If running from build/ inside repo, try to locate project directory
        if (fs::exists(m_exeDir / "web") || fs::exists(m_exeDir / "database")) {
            m_baseDir = m_exeDir;
        } else if (fs::exists(m_exeDir / ".." / "web") || fs::exists(m_exeDir / ".." / "database")) {
            m_baseDir = fs::canonical(m_exeDir / "..");
        } else if (fs::exists(m_exeDir / ".." / ".." / appRole / "web")) {
            m_baseDir = fs::canonical(m_exeDir / ".." / ".." / appRole);
        }

        // 2. Default Ports & Bind Addresses
        m_bindHost = "0.0.0.0";
        m_bindPort = (appRole == "master") ? 8500 : 8501;

        // 3. Load from config.json if exists in exeDir or baseDir
        loadConfigFile();

        // 4. Override with Environment Variables (Support WAN / LAN / Containers)
        loadEnvironmentVariables();

        // 5. Override with Command Line Arguments
        parseCommandLine(argc, argv);

        // 6. Ensure default paths are absolute and directories exist
        resolvePaths();
    }

    // Getters
    const std::string& getRole() const { return m_appRole; }
    const std::string& getBindHost() const { return m_bindHost; }
    int getBindPort() const { return m_bindPort; }
    const fs::path& getBaseDir() const { return m_baseDir; }
    const fs::path& getWebDir() const { return m_webDir; }
    const fs::path& getUploadsDir() const { return m_uploadsDir; }
    const fs::path& getDatabasePath() const { return m_dbPath; }
    const std::string& getMasterServerUrl() const { return m_masterServerUrl; }
    const std::string& getTenantCode() const { return m_tenantCode; }

    void printBanner() const {
        std::cout << "==========================================================" << std::endl;
        std::cout << "  CYBERNEXUS OS — " << (m_appRole == "master" ? "MASTER SAAS PLATFORM" : "SLAVE STORE EDGE NODE") << std::endl;
        std::cout << "==========================================================" << std::endl;
        std::cout << "  [Config] Executable Dir: " << m_exeDir.string() << std::endl;
        std::cout << "  [Config] Base Dir:       " << m_baseDir.string() << std::endl;
        std::cout << "  [Config] Web Root Dir:   " << m_webDir.string() << std::endl;
        std::cout << "  [Config] Uploads Dir:    " << m_uploadsDir.string() << std::endl;
        std::cout << "  [Config] Database:       " << m_dbPath.string() << std::endl;
        std::cout << "  [Config] Listening On:   http://" << m_bindHost << ":" << m_bindPort << std::endl;
        if (m_appRole == "slave") {
            std::cout << "  [Config] Master URL:     " << m_masterServerUrl << std::endl;
            std::cout << "  [Config] Store Tenant:   " << m_tenantCode << std::endl;
        }
        std::cout << "==========================================================" << std::endl;
    }

private:
    AppConfig() = default;

    fs::path detectExecutableDir() {
#ifdef _WIN32
        char buffer[MAX_PATH];
        GetModuleFileNameA(NULL, buffer, MAX_PATH);
        return fs::path(buffer).parent_path();
#else
        char buffer[PATH_MAX];
        ssize_t len = readlink("/proc/self/exe", buffer, sizeof(buffer) - 1);
        if (len != -1) {
            buffer[len] = '\0';
            return fs::path(buffer).parent_path();
        }
        return fs::current_path();
#endif
    }

    void loadConfigFile() {
        std::vector<fs::path> candidateConfigs = {
            m_exeDir / "config.json",
            m_baseDir / "config.json",
            fs::current_path() / "config.json"
        };

        for (const auto& p : candidateConfigs) {
            if (fs::exists(p)) {
                try {
                    std::ifstream ifs(p);
                    if (ifs) {
                        json j = json::parse(ifs);
                        if (j.contains("bind_host") && j["bind_host"].is_string()) m_bindHost = j["bind_host"].get<std::string>();
                        if (j.contains("port") && j["port"].is_number()) m_bindPort = j["port"].get<int>();
                        if (j.contains("web_dir") && j["web_dir"].is_string()) m_customWebDir = j["web_dir"].get<std::string>();
                        if (j.contains("uploads_dir") && j["uploads_dir"].is_string()) m_customUploadsDir = j["uploads_dir"].get<std::string>();
                        if (j.contains("database_path") && j["database_path"].is_string()) m_customDbPath = j["database_path"].get<std::string>();
                        if (j.contains("master_server_url") && j["master_server_url"].is_string()) m_masterServerUrl = j["master_server_url"].get<std::string>();
                        if (j.contains("tenant_code") && j["tenant_code"].is_string()) m_tenantCode = j["tenant_code"].get<std::string>();
                        std::cout << "[Config] Loaded configuration from: " << p.string() << std::endl;
                        return;
                    }
                } catch (const std::exception& e) {
                    std::cerr << "[Config Warning] Failed to parse " << p.string() << ": " << e.what() << std::endl;
                }
            }
        }
    }

    void loadEnvironmentVariables() {
        if (const char* envHost = std::getenv("CYBERNEXUS_HOST")) m_bindHost = envHost;
        if (const char* envPort = std::getenv("CYBERNEXUS_PORT")) {
            try { m_bindPort = std::stoi(envPort); } catch (...) {}
        }
        if (const char* envWeb = std::getenv("CYBERNEXUS_WEB_DIR")) m_customWebDir = envWeb;
        if (const char* envUpload = std::getenv("CYBERNEXUS_UPLOADS_DIR")) m_customUploadsDir = envUpload;
        if (const char* envDb = std::getenv("CYBERNEXUS_DB_PATH")) m_customDbPath = envDb;
        if (const char* envMaster = std::getenv("CYBERNEXUS_MASTER_URL")) m_masterServerUrl = envMaster;
        if (const char* envTenant = std::getenv("CYBERNEXUS_TENANT_CODE")) m_tenantCode = envTenant;
    }

    void parseCommandLine(int argc, char* argv[]) {
        if (!argv || argc <= 1) return;
        for (int i = 1; i < argc; ++i) {
            std::string arg = argv[i];
            if ((arg == "-p" || arg == "--port") && i + 1 < argc) {
                try { m_bindPort = std::stoi(argv[++i]); } catch (...) {}
            } else if ((arg == "-h" || arg == "--host") && i + 1 < argc) {
                m_bindHost = argv[++i];
            } else if ((arg == "-d" || arg == "--database") && i + 1 < argc) {
                m_customDbPath = argv[++i];
            } else if ((arg == "-w" || arg == "--web") && i + 1 < argc) {
                m_customWebDir = argv[++i];
            } else if ((arg == "-u" || arg == "--uploads") && i + 1 < argc) {
                m_customUploadsDir = argv[++i];
            } else if ((arg == "-m" || arg == "--master") && i + 1 < argc) {
                m_masterServerUrl = argv[++i];
            }
        }
    }

    // Helper to resolve a path relative to baseDir if it's relative
    fs::path resolveRelativeToBase(const std::string& pathStr) {
        fs::path p(pathStr);
        if (p.is_absolute()) return p;
        return m_baseDir / p;
    }

    void resolvePaths() {
        // Resolve Web Directory
        if (!m_customWebDir.empty()) {
            m_webDir = resolveRelativeToBase(m_customWebDir);
        } else if (fs::exists(m_baseDir / "web")) {
            m_webDir = m_baseDir / "web";
        } else if (fs::exists(m_exeDir / "web")) {
            m_webDir = m_exeDir / "web";
        } else {
            m_webDir = m_baseDir / "web";
        }

        // Resolve Uploads Directory
        if (!m_customUploadsDir.empty()) {
            m_uploadsDir = resolveRelativeToBase(m_customUploadsDir);
        } else if (fs::exists(m_baseDir / "uploads")) {
            m_uploadsDir = m_baseDir / "uploads";
        } else {
            m_uploadsDir = m_baseDir / "uploads";
        }
        try { fs::create_directories(m_uploadsDir); } catch (...) {}

        // Resolve Database Path
        if (!m_customDbPath.empty()) {
            m_dbPath = resolveRelativeToBase(m_customDbPath);
        } else {
            std::string defaultDbName = (m_appRole == "master") ? "cybernexus_master.db" : "store_local.db";
            fs::path dbFolder = m_baseDir / "database";
            try { fs::create_directories(dbFolder); } catch (...) {}
            m_dbPath = dbFolder / defaultDbName;

            // Fallback: check if existing database exists in candidate locations
            if (!fs::exists(m_dbPath)) {
                if (m_appRole == "master") {
                    if (fs::exists(m_baseDir / "database" / "cybernexus.db")) {
                        m_dbPath = m_baseDir / "database" / "cybernexus.db";
                    }
                } else {
                    if (fs::exists(m_baseDir / "database" / "pos_database.sqlite")) {
                        m_dbPath = m_baseDir / "database" / "pos_database.sqlite";
                    }
                }
            }
        }

        if (m_masterServerUrl.empty()) {
            m_masterServerUrl = "http://127.0.0.1:8500";
        }
        if (m_tenantCode.empty()) {
            m_tenantCode = "GP001";
        }
    }

    std::string m_appRole = "slave";
    std::string m_bindHost = "0.0.0.0";
    int m_bindPort = 8501;
    fs::path m_exeDir;
    fs::path m_baseDir;
    fs::path m_webDir;
    fs::path m_uploadsDir;
    fs::path m_dbPath;
    std::string m_customWebDir;
    std::string m_customUploadsDir;
    std::string m_customDbPath;
    std::string m_masterServerUrl;
    std::string m_tenantCode;
};

} // namespace SaleApp::Config
