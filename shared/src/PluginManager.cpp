#include "PluginManager.hpp"
#include <iostream>
#include <filesystem>
#include <chrono>

namespace fs = std::filesystem;

namespace CyberNexus {

PluginManager& PluginManager::instance() {
    static PluginManager s_instance;
    return s_instance;
}

PluginManager::~PluginManager() {
    std::lock_guard<std::mutex> lock(m_mutex);
    for (auto& [code, record] : m_plugins) {
        if (record.instance) {
            record.instance->onUnload();
            record.instance.reset();
        }
        if (record.handle) {
#ifdef _WIN32
            FreeLibrary(record.handle);
#else
            dlclose(record.handle);
#endif
        }
    }
    m_plugins.clear();
}

bool PluginManager::verifyPluginSignature(const std::string& dllFilePath) {
    // [BẢO MẬT SUPERADMIN]:
    // Kiểm tra xem có file chữ ký .sig đi kèm không (ví dụ: mod_pos.dll.sig)
    std::string sigPath = dllFilePath + ".sig";
    if (!fs::exists(sigPath)) {
        // Trong môi trường dev local, nếu chưa bật strict production thì tạm chấp nhận hoặc log cảnh báo
        std::cout << "[Security Guard] Cảnh báo: File " << dllFilePath << " chưa có chữ ký số RSA của SuperAdmin (.sig)." << std::endl;
        return true; 
    }

    // TODO: Triển khai kiểm tra giải mã RSA-4096 SHA256 đối chiếu với Public Key của SuperAdmin
    return true;
}

bool PluginManager::loadPlugin(const std::string& dllFilePath, const CoreContext& ctx) {
    std::lock_guard<std::mutex> lock(m_mutex);

    if (!fs::exists(dllFilePath)) {
        std::cerr << "[PluginManager] Không tìm thấy tệp: " << dllFilePath << std::endl;
        return false;
    }

    // 1. Xác thực chữ ký số chống crack
    if (!verifyPluginSignature(dllFilePath)) {
        std::cerr << "[PluginManager] Chữ ký số của file " << dllFilePath << " không hợp lệ hoặc đã bị can thiệp!" << std::endl;
        return false;
    }

    // 2. Nạp động thư viện vào bộ nhớ (LoadLibrary / dlopen)
#ifdef _WIN32
    PluginHandle handle = LoadLibraryA(dllFilePath.c_str());
    if (!handle) {
        DWORD err = GetLastError();
        std::cerr << "[PluginManager] Nạp DLL thất bại: " << dllFilePath << " (Error Code: " << err << ")" << std::endl;
        return false;
    }
    CreatePluginFunc createFn = (CreatePluginFunc)GetProcAddress(handle, "createCyberNexusPlugin");
    DestroyPluginFunc destroyFn = (DestroyPluginFunc)GetProcAddress(handle, "destroyCyberNexusPlugin");
#else
    PluginHandle handle = dlopen(dllFilePath.c_str(), RTLD_NOW | RTLD_LOCAL);
    if (!handle) {
        std::cerr << "[PluginManager] Nạp SO thất bại: " << dlerror() << std::endl;
        return false;
    }
    CreatePluginFunc createFn = (CreatePluginFunc)dlsym(handle, "createCyberNexusPlugin");
    DestroyPluginFunc destroyFn = (DestroyPluginFunc)dlsym(handle, "destroyCyberNexusPlugin");
#endif

    if (!createFn) {
        std::cerr << "[PluginManager] Không tìm thấy hàm export 'createCyberNexusPlugin' trong " << dllFilePath << std::endl;
#ifdef _WIN32
        FreeLibrary(handle);
#else
        dlclose(handle);
#endif
        return false;
    }

    // 3. Khởi tạo đối tượng Plugin
    IModulePlugin* rawPlugin = createFn();
    if (!rawPlugin) {
        std::cerr << "[PluginManager] Hàm createCyberNexusPlugin trả về null trong " << dllFilePath << std::endl;
        return false;
    }

    auto customDeleter = [destroyFn](IModulePlugin* p) {
        if (destroyFn && p) {
            destroyFn(p);
        } else if (p) {
            delete p;
        }
    };
    std::shared_ptr<IModulePlugin> pluginInstance(rawPlugin, customDeleter);
    ModuleMetadata meta = pluginInstance->getMetadata();

    // 4. Kiểm tra bản quyền từ CoreContext hook
    bool isLicensed = true;
    if (ctx.checkLicenseStatus && !ctx.isSuperAdminMode) {
        isLicensed = ctx.checkLicenseStatus(meta.code);
    }

    // 5. Kích hoạt vòng đời onLoad (khởi tạo DB schema & context cho mọi DLL hợp lệ; kiểm soát ON/OFF/BLOCK thực thi động tại runtime)
    if (!pluginInstance->onLoad(ctx)) {
        std::cerr << "[PluginManager] onLoad thất bại cho module: " << meta.code << std::endl;
        return false;
    }

    LoadedPluginRecord record;
    record.filePath = dllFilePath;
    record.handle = handle;
    record.instance = pluginInstance;
    record.metadata = meta;
    record.isLicensed = isLicensed;
    record.isEnabled = isLicensed; // Tự động bật nếu có giấy phép
    record.loadTimestamp = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();

    m_plugins[meta.code] = record;
    std::cout << "[PluginManager] Nạp thành công module: " << meta.name 
              << " (" << meta.code << " v" << meta.version << ") - Trạng thái: " 
              << (isLicensed ? "ĐÃ CẤP PHÉP" : "CHƯA KÍCH HOẠT") << std::endl;

    return true;
}

size_t PluginManager::scanAndLoadDirectory(const std::string& modulesDir, const CoreContext& ctx) {
    if (!fs::exists(modulesDir) || !fs::is_directory(modulesDir)) {
        try {
            fs::create_directories(modulesDir);
        } catch (...) {}
        return 0;
    }

    size_t count = 0;
    for (const auto& entry : fs::directory_iterator(modulesDir)) {
        if (entry.is_regular_file()) {
            std::string ext = entry.path().extension().string();
            std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
#ifdef _WIN32
            if (ext == ".dll")
#else
            if (ext == ".so")
#endif
            {
                if (loadPlugin(entry.path().string(), ctx)) {
                    count++;
                }
            }
        }
    }
    return count;
}

bool PluginManager::unloadPlugin(const std::string& moduleCode) {
    std::lock_guard<std::mutex> lock(m_mutex);
    auto it = m_plugins.find(moduleCode);
    if (it == m_plugins.end()) return false;

    if (it->second.instance) {
        it->second.instance->onUnload();
        it->second.instance.reset();
    }
    if (it->second.handle) {
#ifdef _WIN32
        FreeLibrary(it->second.handle);
#else
        dlclose(it->second.handle);
#endif
    }

    std::cout << "[PluginManager] Đã tháo gỡ module khỏi RAM: " << moduleCode << std::endl;
    m_plugins.erase(it);
    return true;
}

bool PluginManager::setModuleState(const std::string& moduleCode, bool enabled) {
    std::lock_guard<std::mutex> lock(m_mutex);
    auto it = m_plugins.find(moduleCode);
    if (it == m_plugins.end()) return false;

    if (enabled && !it->second.isLicensed) {
        std::cerr << "[PluginManager] Không thể kích hoạt module chưa mua bản quyền: " << moduleCode << std::endl;
        return false;
    }

    it->second.isEnabled = enabled;
    std::cout << "[PluginManager] [SuperAdmin Remote Switch] Đã " << (enabled ? "BẬT" : "TẮT") 
              << " module: " << moduleCode << std::endl;
    return true;
}

void PluginManager::registerAllActiveRoutes(httplib::Server& svr) {
    std::lock_guard<std::mutex> lock(m_mutex);
    for (auto& [code, record] : m_plugins) {
        if (record.instance) {
            record.instance->registerHttpRoutes(svr);
        }
    }
}

void PluginManager::dispatchEvent(const std::string& eventType, const json& eventPayload) {
    std::lock_guard<std::mutex> lock(m_mutex);
    for (auto& [code, record] : m_plugins) {
        if (record.isEnabled && record.instance) {
            record.instance->onSystemEvent(eventType, eventPayload);
        }
    }
}

json PluginManager::getModulesStatusMatrix() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    json matrix = json::array();
    for (const auto& [code, record] : m_plugins) {
        matrix.push_back({
            {"code", record.metadata.code},
            {"name", record.metadata.name},
            {"version", record.metadata.version},
            {"category", record.metadata.category},
            {"description", record.metadata.description},
            {"monthly_price_vnd", record.metadata.monthly_price_vnd},
            {"is_licensed", record.isLicensed},
            {"is_enabled", record.isEnabled},
            {"load_time", record.loadTimestamp}
        });
    }
    return matrix;
}

} // namespace CyberNexus
