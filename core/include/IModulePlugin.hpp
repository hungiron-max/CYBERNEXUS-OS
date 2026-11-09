#pragma once
/**
 * ============================================================================
 * CYBERNEXUS OS — DYNAMIC PLUGIN INTERFACE SPECIFICATION
 * ============================================================================
 * Standard C++17 Interface for Independent Dynamic Library Modules (.dll / .so)
 * Allows modular compilation, hot-reloading, license enforcement, and OTA updates.
 * Copyright (c) 2026 SuperAdmin. All rights reserved.
 * ============================================================================
 */

#include <string>
#include <vector>
#include <memory>
#include <functional>
#include "httplib.h"
#include "nlohmann/json.hpp"

#ifdef _WIN32
    #ifdef BUILDING_PLUGIN_DLL
        #define CYBERNEXUS_PLUGIN_API __declspec(dllexport)
    #else
        #define CYBERNEXUS_PLUGIN_API __declspec(dllimport)
    #endif
#else
    #define CYBERNEXUS_PLUGIN_API __attribute__((visibility("default")))
#endif

namespace CyberNexus {

using json = nlohmann::json;

/**
 * Metadata descriptor for each dynamically loaded module
 */
struct ModuleMetadata {
    std::string code;                // Unique ID: e.g. "mod_pos_core", "mod_network_qos"
    std::string name;                // Display name: e.g. "POS Bán Hàng & In Hóa Đơn"
    std::string version;             // Semantic versioning: "1.0.0"
    std::string author;              // "SuperAdmin"
    std::string category;            // Category: "POS", "Network", "Media", "AI"
    std::string description;         // Full description
    double monthly_price_vnd{0.0};   // Pricing for monthly subscription
    bool is_core_required{false};    // Whether system requires this module to operate
    std::vector<std::string> dependencies; // Required prerequisites codes
};

/**
 * Core runtime context passed to plugins upon initialization
 */
struct CoreContext {
    void* dbHandle{nullptr};         // SQLite3 database handle
    std::string appVersion;          // Host Core version
    std::string hardwareHash;        // Unique client hardware fingerprint
    bool isSuperAdminMode{false};    // Master privilege override
    std::function<bool(const std::string&)> checkLicenseStatus; // Hook to verify module active
    std::function<void(const std::string&, const json&)> emitSystemEvent; // Event bus dispatcher
};

/**
 * Standard Plugin Abstract Base Class
 */
class IModulePlugin {
public:
    virtual ~IModulePlugin() = default;

    // 1. Identity & Catalog metadata
    virtual ModuleMetadata getMetadata() const = 0;

    // 2. Lifecycle management
    virtual bool onLoad(const CoreContext& ctx) = 0;
    virtual void onUnload() = 0;
    virtual void onHeartbeat(uint64_t tickCount) {}

    // 3. Register HTTP & WebSocket routes with Host Core
    virtual void registerHttpRoutes(httplib::Server& svr) = 0;

    // 4. Global Event & AI dispatch hooks
    virtual void onSystemEvent(const std::string& eventType, const json& eventPayload) {}
};

// Exported factory function signatures for dynamic loader (GetProcAddress / dlsym)
typedef IModulePlugin* (*CreatePluginFunc)();
typedef void (*DestroyPluginFunc)(IModulePlugin*);

} // namespace CyberNexus
