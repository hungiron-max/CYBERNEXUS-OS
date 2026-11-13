#pragma once

#include <chrono>
#include <ctime>
#include <mutex>
#include <string>
#include <vector>
#include "httplib.h"
#include "nlohmann/json.hpp"
#include "db.hpp"

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#include <iphlpapi.h>
#endif

namespace SaleApp::Backend {

struct StoreNetGeoInfo {
    std::string lan_ip;
    std::string wan_ip;
    double geo_lat = 0.0;
    double geo_lng = 0.0;
    std::string geo_label;
    std::string geo_source = "ip"; // "gps" | "ip"
};

class SlaveNetInfoService {
public:
    static SlaveNetInfoService& instance() {
        static SlaveNetInfoService inst;
        return inst;
    }

    static std::string detectLanIp() {
#ifdef _WIN32
        ULONG outBufLen = 15000;
        std::vector<unsigned char> buf(outBufLen);
        PIP_ADAPTER_ADDRESSES pAddresses = reinterpret_cast<PIP_ADAPTER_ADDRESSES>(buf.data());
        ULONG flags = GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER;
        DWORD dwRet = GetAdaptersAddresses(AF_INET, flags, nullptr, pAddresses, &outBufLen);
        if (dwRet == ERROR_BUFFER_OVERFLOW) {
            buf.resize(outBufLen);
            pAddresses = reinterpret_cast<PIP_ADAPTER_ADDRESSES>(buf.data());
            dwRet = GetAdaptersAddresses(AF_INET, flags, nullptr, pAddresses, &outBufLen);
        }
        std::string fallbackIp;
        if (dwRet == NO_ERROR) {
            for (PIP_ADAPTER_ADDRESSES cur = pAddresses; cur != nullptr; cur = cur->Next) {
                if (cur->OperStatus != IfOperStatusUp) continue;
                if (cur->IfType == IF_TYPE_SOFTWARE_LOOPBACK) continue;
                for (PIP_ADAPTER_UNICAST_ADDRESS ua = cur->FirstUnicastAddress; ua != nullptr; ua = ua->Next) {
                    if (!ua->Address.lpSockaddr || ua->Address.lpSockaddr->sa_family != AF_INET) continue;
                    char ipStr[INET_ADDRSTRLEN] = {0};
                    sockaddr_in* sa = reinterpret_cast<sockaddr_in*>(ua->Address.lpSockaddr);
                    if (inet_ntop(AF_INET, &(sa->sin_addr), ipStr, sizeof(ipStr))) {
                        std::string ip(ipStr);
                        if (ip == "127.0.0.1" || ip.rfind("169.254.", 0) == 0) continue;
                        if (ip.rfind("192.168.", 0) == 0 || ip.rfind("10.", 0) == 0 || ip.rfind("172.", 0) == 0) {
                            return ip;
                        }
                        if (fallbackIp.empty()) fallbackIp = ip;
                    }
                }
            }
        }
        return fallbackIp.empty() ? "127.0.0.1" : fallbackIp;
#else
        return "127.0.0.1";
#endif
    }

    StoreNetGeoInfo getInfo(bool forceRefresh = false) {
        std::lock_guard<std::mutex> lk(mtx_);
        int64_t nowSec = static_cast<int64_t>(std::time(nullptr));

        // Always detect LAN IP freshly (very fast local syscall)
        info_.lan_ip = detectLanIp();

        // Check pinned GPS from store_settings
        loadPinnedGeoFromDbLocked();

        if (forceRefresh || info_.wan_ip.empty() || (nowSec - last_wan_fetch_sec_ > 3600)) {
            fetchWanAndGeoLocked();
            last_wan_fetch_sec_ = nowSec;
        }
        return info_;
    }

    void savePinnedLocation(double lat, double lng, const std::string& label, const std::string& source = "gps") {
        auto& db = Database::instance();
        auto upsert = [&](const std::string& k, const std::string& v) {
            auto existing = db.queryRow("SELECT id FROM store_settings WHERE setting_key = :k LIMIT 1", {{":k", k}});
            if (existing.is_null()) {
                db.execute("INSERT INTO store_settings (setting_key, setting_value) VALUES (:k, :v)", {{":k", k}, {":v", v}});
            } else {
                db.execute("UPDATE store_settings SET setting_value = :v WHERE setting_key = :k", {{":k", k}, {":v", v}});
            }
        };
        upsert("store_geo_lat", std::to_string(lat));
        upsert("store_geo_lng", std::to_string(lng));
        upsert("store_geo_label", label);
        upsert("store_geo_source", source);

        std::lock_guard<std::mutex> lk(mtx_);
        info_.geo_lat = lat;
        info_.geo_lng = lng;
        if (!label.empty()) info_.geo_label = label;
        info_.geo_source = source;
    }

    nlohmann::json toJson(bool forceRefresh = false) {
        auto i = getInfo(forceRefresh);
        return {
            {"lan_ip", i.lan_ip},
            {"wan_ip", i.wan_ip},
            {"geo_lat", i.geo_lat},
            {"geo_lng", i.geo_lng},
            {"geo_label", i.geo_label},
            {"geo_source", i.geo_source}
        };
    }

private:
    SlaveNetInfoService() = default;

    void loadPinnedGeoFromDbLocked() {
        try {
            auto& db = Database::instance();
            auto getVal = [&](const char* k) -> std::string {
                auto r = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = :k LIMIT 1", {{":k", k}});
                return (!r.is_null() && r.contains("setting_value") && !r["setting_value"].is_null())
                    ? r["setting_value"].get<std::string>() : "";
            };
            std::string latS = getVal("store_geo_lat");
            std::string lngS = getVal("store_geo_lng");
            std::string lblS = getVal("store_geo_label");
            std::string srcS = getVal("store_geo_source");
            if (!latS.empty() && !lngS.empty()) {
                double lat = std::stod(latS);
                double lng = std::stod(lngS);
                if (lat != 0.0 && lng != 0.0) {
                    info_.geo_lat = lat;
                    info_.geo_lng = lng;
                    if (!lblS.empty()) info_.geo_label = lblS;
                    info_.geo_source = srcS.empty() ? "gps" : srcS;
                }
            }
        } catch (...) {}
    }

    void fetchWanAndGeoLocked() {
        try {
            httplib::Client cli("http://ip-api.com");
            cli.set_connection_timeout(3, 0);
            cli.set_read_timeout(4, 0);
            auto res = cli.Get("/json/?fields=status,country,regionName,city,lat,lon,isp,query");
            if (res && res->status == 200) {
                auto j = nlohmann::json::parse(res->body, nullptr, false);
                if (j.is_object() && j.value("status", "") == "success") {
                    info_.wan_ip = j.value("query", "");
                    // Only overwrite geo if user has NOT pinned exact GPS
                    if (info_.geo_source != "gps" || (info_.geo_lat == 0.0 && info_.geo_lng == 0.0)) {
                        info_.geo_lat = j.value("lat", 0.0);
                        info_.geo_lng = j.value("lon", 0.0);
                        std::string city = j.value("city", "");
                        std::string region = j.value("regionName", "");
                        std::string isp = j.value("isp", "");
                        std::string lbl = city;
                        if (!region.empty() && region != city) lbl += (lbl.empty() ? "" : ", ") + region;
                        if (!isp.empty()) lbl += (lbl.empty() ? "" : " • ") + isp;
                        info_.geo_label = lbl;
                        info_.geo_source = "ip";
                    }
                }
            }
        } catch (...) {}
    }

    std::mutex mtx_;
    StoreNetGeoInfo info_;
    int64_t last_wan_fetch_sec_ = 0;
};

} // namespace SaleApp::Backend
