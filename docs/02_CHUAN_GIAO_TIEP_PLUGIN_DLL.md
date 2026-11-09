# 🔌 CHUẨN GIAO TIẾP MODULE PLUGIN ĐỘC LẬP (.DLL / .SO)

> **Tài liệu đặc tả kỹ thuật dành cho nhà phát triển module của CYBERNEXUS OS**

---

## 1. CẤU TRÚC GIAO DIỆN (`IModulePlugin.hpp`)

Mọi module tính năng độc lập bắt buộc phải triển khai lớp trừu tượng `IModulePlugin`:

```cpp
#pragma once
#include "httplib.h"
#include "nlohmann/json.hpp"
#include <string>
#include <vector>

namespace CyberNexus {

using json = nlohmann::json;

struct ModuleMetadata {
    std::string code;                // Mã định danh: e.g. "mod_network_qos"
    std::string name;                // Tên hiển thị: "Quản Trị Băng Thông Router"
    std::string version;             // Phiên bản: "1.0.0"
    std::string author;              // Tác giả: "SuperAdmin"
    std::string category;            // "POS", "Network", "Media", "AI"
    std::string description;         // Mô tả chi tiết chức năng
    double monthly_price_vnd{0.0};   // Giá thuê bao tháng
    bool is_core_required{false};    // Có bắt buộc cho hệ thống không
    std::vector<std::string> dependencies; // Danh sách mã module phụ thuộc
};

struct CoreContext {
    void* dbHandle{nullptr};         // Con trỏ CSDL SQLite3
    std::string appVersion;          // Phiên bản Host Core
    std::string hardwareHash;        // Mã định danh phần cứng máy khách
    bool isSuperAdminMode{false};    // Cờ quyền tối cao
    std::function<bool(const std::string&)> checkLicenseStatus;
    std::function<void(const std::string&, const json&)> emitSystemEvent;
};

class IModulePlugin {
public:
    virtual ~IModulePlugin() = default;

    virtual ModuleMetadata getMetadata() const = 0;
    virtual bool onLoad(const CoreContext& ctx) = 0;
    virtual void onUnload() = 0;
    virtual void onHeartbeat(uint64_t tickCount) {}
    virtual void registerHttpRoutes(httplib::Server& svr) = 0;
    virtual void onSystemEvent(const std::string& eventType, const json& eventPayload) {}
};

typedef IModulePlugin* (*CreatePluginFunc)();
typedef void (*DestroyPluginFunc)(IModulePlugin*);

} // namespace CyberNexus
```

---

## 2. QUY ƯỚC EXPORT HÀM CỦA FILE THƯ VIỆN ĐỘNG

Trong mỗi file `.cpp` của module, hai hàm C-linkage bắt buộc phải được export:

```cpp
extern "C" {
    CYBERNEXUS_PLUGIN_API IModulePlugin* createCyberNexusPlugin() {
        return new MyCustomPlugin();
    }

    CYBERNEXUS_PLUGIN_API void destroyCyberNexusPlugin(IModulePlugin* p) {
        delete p;
    }
}
```

---

## 3. CƠ CHẾ GIAO TIẾP NỘI BỘ (EVENT BUS)

Các module không gọi trực tiếp hàm của nhau để tránh phụ thuộc chặt chẽ (Loose Coupling). Thay vào đó, chúng gửi và nhận các sự kiện qua **Event Bus**:

| Tên Sự Kiện | Module Phát | Module Nhận | Ý Nghĩa Nghiệp Vụ |
|---|---|---|---|
| `ORDER_PAID` | `mod_pos_core` | `mod_network_qos` | Khách thanh toán xong $\rightarrow$ Router tự động nâng tốc độ mạng lên VIP. |
| `ORDER_CREATED` | `mod_pos_core` | `mod_kds` | Có đơn mới $\rightarrow$ Màn hình Bếp KDS kêu chuông và hiện món. |
| `SONG_REQUESTED`| Web Client | `mod_media_stream` | Khách vote bài $\rightarrow$ AI lọc nội dung và thêm vào hàng đợi Jukebox. |
| `TRAFFIC_ABUSE` | `mod_network_qos` | `mod_ai_netshield`| Phát hiện kéo torrent/DDoS $\rightarrow$ AI lập tức cách ly thiết bị. |
