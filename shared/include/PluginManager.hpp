#pragma once
/**
 * ============================================================================
 * CYBERNEXUS OS — DYNAMIC PLUGIN LOADER & RUNTIME MANAGER
 * ============================================================================
 * Manages runtime dynamic loading/unloading of Windows .DLL / Linux .SO plugins.
 * Enforces RSA cryptographic signature verification and SuperAdmin remote control.
 * ============================================================================
 */

#include "IModulePlugin.hpp"
#include <unordered_map>
#include <memory>
#include <string>
#include <vector>
#include <mutex>

#ifdef _WIN32
#include <windows.h>
typedef HMODULE PluginHandle;
#else
#include <dlfcn.h>
typedef void* PluginHandle;
#endif

namespace CyberNexus {

struct LoadedPluginRecord {
    std::string filePath;
    PluginHandle handle{nullptr};
    std::shared_ptr<IModulePlugin> instance{nullptr};
    ModuleMetadata metadata;
    bool isLicensed{false};
    bool isEnabled{false};
    uint64_t loadTimestamp{0};
};

class PluginManager {
public:
    static PluginManager& instance();

    // 1. Quét & Nạp động toàn bộ các file DLL từ thư mục /modules
    size_t scanAndLoadDirectory(const std::string& modulesDir, const CoreContext& ctx);

    // 2. Nạp hoặc cập nhật nóng 1 file DLL cụ thể (Hot-Reload)
    bool loadPlugin(const std::string& dllFilePath, const CoreContext& ctx);

    // 3. Tháo gỡ nóng một Module khỏi bộ nhớ RAM
    bool unloadPlugin(const std::string& moduleCode);

    // 4. Bật / Tắt module theo lệnh SuperAdmin (Feature Toggle)
    bool setModuleState(const std::string& moduleCode, bool enabled);

    // 5. Đăng ký các Route của các Plugin đang hoạt động vào Web Server
    void registerAllActiveRoutes(httplib::Server& svr);

    // 6. Phát sự kiện toàn cục (Event Bus) tới tất cả các Module
    void dispatchEvent(const std::string& eventType, const json& eventPayload);

    // 7. Xác thực chữ ký số mật mã học RSA của SuperAdmin
    bool verifyPluginSignature(const std::string& dllFilePath);

    // 8. Lấy bảng ma trận trạng thái tất cả Module để gửi lên Admin/SuperAdmin Dashboard
    json getModulesStatusMatrix() const;

private:
    PluginManager() = default;
    ~PluginManager();

    std::unordered_map<std::string, LoadedPluginRecord> m_plugins;
    mutable std::mutex m_mutex;
};

} // namespace CyberNexus
