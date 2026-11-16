#include "PluginManager.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <array>
#include <cstdint>
#include <filesystem>
#include <chrono>

namespace fs = std::filesystem;

namespace CyberNexus {

namespace {
static std::string sha256Hex(const uint8_t* data, size_t len) {
    static const uint32_t K[64] = {
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    };
    uint32_t h[8] = {0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19};
    auto rotr = [](uint32_t x, uint32_t n) { return (x >> n) | (x << (32 - n)); };
    std::vector<uint8_t> msg(data, data + len);
    uint64_t bitLen = static_cast<uint64_t>(len) * 8ULL;
    msg.push_back(0x80);
    while ((msg.size() % 64) != 56) msg.push_back(0);
    for (int i = 7; i >= 0; --i) msg.push_back(static_cast<uint8_t>((bitLen >> (i * 8)) & 0xff));

    for (size_t off = 0; off < msg.size(); off += 64) {
        uint32_t w[64]{};
        for (int i = 0; i < 16; ++i) {
            w[i] = (uint32_t(msg[off + i*4]) << 24) | (uint32_t(msg[off + i*4 + 1]) << 16) |
                   (uint32_t(msg[off + i*4 + 2]) << 8) | uint32_t(msg[off + i*4 + 3]);
        }
        for (int i = 16; i < 64; ++i) {
            uint32_t s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >> 3);
            uint32_t s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >> 10);
            w[i] = w[i-16] + s0 + w[i-7] + s1;
        }
        uint32_t a=h[0], b=h[1], c=h[2], d=h[3], e=h[4], f=h[5], g=h[6], hh=h[7];
        for (int i = 0; i < 64; ++i) {
            uint32_t S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            uint32_t ch = (e & f) ^ ((~e) & g);
            uint32_t t1 = hh + S1 + ch + K[i] + w[i];
            uint32_t S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
            uint32_t t2 = S0 + maj;
            hh=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
        }
        h[0]+=a; h[1]+=b; h[2]+=c; h[3]+=d; h[4]+=e; h[5]+=f; h[6]+=g; h[7]+=hh;
    }
    std::ostringstream oss;
    for (int i = 0; i < 8; ++i) oss << std::hex << std::setw(8) << std::setfill('0') << h[i];
    return oss.str();
}

static std::string computeFileSha256(const std::string& path) {
    std::ifstream f(path, std::ios::binary);
    if (!f) return "";
    std::vector<uint8_t> buf((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
    return sha256Hex(buf.data(), buf.size());
}
} // namespace

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
    // Kiểm tra xem có file chữ ký .sig đi kèm không (ví dụ: libmod_pos_core.dll.sig)
    std::string sigPath = dllFilePath + ".sig";
    if (!fs::exists(sigPath)) {
        std::cout << "[Security Guard] Cảnh báo: File " << dllFilePath << " chưa có chữ ký số của SuperAdmin (.sig)." << std::endl;
        return true;
    }

    try {
        std::ifstream sf(sigPath);
        json sigJson;
        sf >> sigJson;
        std::string expectedHash = sigJson.value("sha256", "");
        std::string sigToken = sigJson.value("sig", "");
        std::string actualHash = computeFileSha256(dllFilePath);
        std::string payload = "CBNX_SIG_V1:" + actualHash + ":SAAS_2026";
        std::string expectedSig = sha256Hex(reinterpret_cast<const uint8_t*>(payload.data()), payload.size());

        if (actualHash.empty() || actualHash != expectedHash || sigToken != expectedSig) {
            std::cerr << "[Security Guard] CHẶN NẠP MODULE: Chữ ký số .sig không khớp hoặc file DLL đã bị chỉnh sửa: " << dllFilePath << std::endl;
            return false;
        }
        std::cout << "[Security Guard] Đã xác thực chữ ký số .sig hợp lệ: " << fs::path(dllFilePath).filename().string() << std::endl;
        return true;
    } catch (...) {
        std::cerr << "[Security Guard] Lỗi đọc file chữ ký số .sig: " << sigPath << std::endl;
        return false;
    }
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
