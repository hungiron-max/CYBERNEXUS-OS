#define BUILDING_PLUGIN_DLL
#include "IModulePlugin.hpp"
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <mutex>
#include <sstream>
#include <thread>
#include <unordered_map>
#include <vector>

namespace fs = std::filesystem;
using namespace CyberNexus;

namespace {
struct WifiSession {
    std::string ip;
    std::string mac;
    std::string name;
    std::string tier; // "free", "vip", "whitelist", "blocked"
    std::string order_code;
    std::time_t start_epoch{0};
    int duration_sec{600};
    int stage{0}; // 0=full, 1=70%, 2=90%, 3=expired
};
} // namespace

class NetworkQosPlugin : public IModulePlugin {
    std::string m_configPath = "config/router_qos.json";
    std::mutex m_mtx;
    std::unordered_map<std::string, WifiSession> m_sessions;
    std::atomic<bool> m_running{false};
    std::thread m_watcherThread;

    json m_cfg = {
        {"router_type", "simulation"},
        {"host", "172.16.0.1"},
        {"port", 22},
        {"username", "admin"},
        {"password", ""},
        {"unifi_site", "default"},
        {"vip_limit", "50M/50M"},
        {"basic_limit", "5M/5M"},
        {"free_minutes", 10},
        {"vip_minutes", 180},
        {"max_devices_per_order", 2},
        {"peak_mode_enabled", true},
        {"throttle_after_70_pct", true},
        {"whitelist_ips", json::array()}
    };

    void loadConfig() {
        try {
            if (fs::exists(m_configPath)) {
                std::ifstream f(m_configPath);
                json loaded;
                f >> loaded;
                if (loaded.is_object()) {
                    std::lock_guard<std::mutex> lk(m_mtx);
                    m_cfg.update(loaded);
                }
            }
        } catch (...) {}
    }

    void saveConfig() {
        try {
            fs::create_directories(fs::path(m_configPath).parent_path());
            std::lock_guard<std::mutex> lk(m_mtx);
            std::ofstream f(m_configPath);
            f << m_cfg.dump(2);
        } catch (...) {}
    }

    static bool isSafeHostOrIp(const std::string& s) {
        if (s.empty() || s.size() > 64) return false;
        for (char c : s) {
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '.' || c == '-' || c == ':')) {
                return false;
            }
        }
        return true;
    }

    bool isWhitelisted(const std::string& ip) {
        std::lock_guard<std::mutex> lk(m_mtx);
        if (!m_cfg.contains("whitelist_ips") || !m_cfg["whitelist_ips"].is_array()) return false;
        for (const auto& w : m_cfg["whitelist_ips"]) {
            if (w.is_string() && w.get<std::string>() == ip) return true;
        }
        return false;
    }

    static std::string execCapture(const std::string& cmd, int* exitCode = nullptr) {
#ifdef _WIN32
        FILE* pipe = _popen(cmd.c_str(), "r");
#else
        FILE* pipe = popen(cmd.c_str(), "r");
#endif
        if (!pipe) {
            if (exitCode) *exitCode = -1;
            return "";
        }
        char buf[1024];
        std::string output;
        while (fgets(buf, sizeof(buf), pipe) != nullptr) {
            output += buf;
        }
#ifdef _WIN32
        int rc = _pclose(pipe);
#else
        int rc = pclose(pipe);
#endif
        if (exitCode) *exitCode = rc;
        return output;
    }

    bool applyMikrotikRate(const std::string& ip, const std::string& limit, const std::string& comment, std::string& msgOut) {
        std::string host, user, pass;
        int port = 80;
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            host = m_cfg.value("host", "192.168.88.1");
            port = m_cfg.value("port", 80);
            user = m_cfg.value("username", "admin");
            pass = m_cfg.value("password", "");
        }
        httplib::Client cli(host, port);
        cli.set_connection_timeout(3, 0);
        cli.set_read_timeout(5, 0);
        cli.set_basic_auth(user, pass);

        json body = {
            {"name", "CBNX_" + ip},
            {"target", ip + "/32"},
            {"max-limit", limit},
            {"comment", comment}
        };
        auto res = cli.Put("/rest/queue/simple", body.dump(), "application/json");
        if (res && res->status >= 200 && res->status < 300) {
            msgOut = "MikroTik đã cấp " + limit + " cho " + ip;
            return true;
        }
        msgOut = "Không kết nối được MikroTik REST API (" + host + ":" + std::to_string(port) + ")";
        return false;
    }

    bool applyEdgeRouterRate(const std::string& ip, const std::string& rate, std::string& msgOut) {
        std::string host, user;
        int port = 22;
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            host = m_cfg.value("host", "172.16.0.1");
            user = m_cfg.value("username", "admin");
            port = m_cfg.value("port", 22);
        }
        if (!isSafeHostOrIp(host) || !isSafeHostOrIp(ip) || !isSafeHostOrIp(user)) {
            msgOut = "Tham số IP/Host EdgeRouter không hợp lệ!";
            return false;
        }
        std::string remoteCmd = "sudo tc class change dev eth0 parent 1: classid 1:10 htb rate " + rate + " || true";
        std::string cmd = "ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=3 -p "
            + std::to_string(port) + " " + user + "@" + host + " \"" + remoteCmd + "\"";
        int rc = std::system(cmd.c_str());
        if (rc == 0) {
            msgOut = "EdgeRouter SSH đã cập nhật (" + rate + ") cho " + ip;
            return true;
        }
        msgOut = "EdgeRouter SSH không phản hồi (kiểm tra SSH key hoặc IP " + host + ")";
        return false;
    }

    static std::string escapeCmdArg(const std::string& s) {
        std::string out;
        out.reserve(s.size() + 8);
        for (char c : s) {
            if (c == '"') out += "\\\"";
            else out += c;
        }
        return out;
    }

    std::string m_unifiCsrf;

    static std::string extractHeaderValue(const std::string& headers, const std::string& headerNameLower) {
        std::istringstream iss(headers);
        std::string line;
        while (std::getline(iss, line)) {
            if (!line.empty() && line.back() == '\r') line.pop_back();
            size_t colon = line.find(':');
            if (colon == std::string::npos) continue;
            std::string k = line.substr(0, colon);
            for (char& ch : k) ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
            if (k == headerNameLower) {
                std::string v = line.substr(colon + 1);
                size_t first = v.find_first_not_of(" \t");
                return (first == std::string::npos) ? "" : v.substr(first);
            }
        }
        return "";
    }

    bool unifiLogin(std::string& baseUrlOut, std::string& sitePrefixOut, std::string& cookieFileOut, std::string& errOut) {
        std::string host, user, pass, site;
        int port = 443;
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            host = m_cfg.value("host", "172.16.38.119");
            port = m_cfg.value("port", 443);
            user = m_cfg.value("username", "admin");
            pass = m_cfg.value("password", "");
            site = m_cfg.value("unifi_site", "default");
        }
        if (!isSafeHostOrIp(host) || !isSafeHostOrIp(site)) {
            errOut = "Cấu hình Host/Site UniFi không hợp lệ!";
            return false;
        }
        cookieFileOut = "config/unifi_cookie.txt";
        std::string hdrFile = "config/unifi_headers.txt";
        fs::create_directories("config");
        baseUrlOut = "https://" + host + ":" + std::to_string(port);
        std::string escLogin = escapeCmdArg(json({{"username", user}, {"password", pass}}).dump());

        int rc = 0;
        std::string lRes = execCapture("curl -sk -D \"" + hdrFile + "\" -c \"" + cookieFileOut + "\" -H \"Content-Type: application/json\" -d \"" + escLogin + "\" \"" + baseUrlOut + "/api/auth/login\"", &rc);
        if (lRes.find("\"unique_id\"") != std::string::npos || lRes.find("\"username\"") != std::string::npos) {
            sitePrefixOut = "/proxy/network/api/s/" + site;
            if (fs::exists(hdrFile)) {
                std::ifstream hf(hdrFile);
                std::string hdrText((std::istreambuf_iterator<char>(hf)), std::istreambuf_iterator<char>());
                std::string csrf = extractHeaderValue(hdrText, "x-updated-csrf-token");
                if (csrf.empty()) csrf = extractHeaderValue(hdrText, "x-csrf-token");
                std::lock_guard<std::mutex> lk(m_mtx);
                m_unifiCsrf = csrf;
            }
            return true;
        }
        std::string legRes = execCapture("curl -sk -D \"" + hdrFile + "\" -c \"" + cookieFileOut + "\" -H \"Content-Type: application/json\" -d \"" + escLogin + "\" \"" + baseUrlOut + "/api/login\"", &rc);
        if (legRes.find("\"ok\"") != std::string::npos || legRes.find("\"rc\":\"ok\"") != std::string::npos) {
            sitePrefixOut = "/api/s/" + site;
            return true;
        }
        errOut = "Không đăng nhập được UniFi Controller (" + host + ":" + std::to_string(port) + ")";
        return false;
    }

    bool fetchUnifiClients(json& devsOut, std::string& errOut) {
        std::string baseUrl, sitePrefix, cookieFile;
        if (!unifiLogin(baseUrl, sitePrefix, cookieFile, errOut)) return false;

        int rc = 0;
        std::string raw = execCapture("curl -sk -b \"" + cookieFile + "\" \"" + baseUrl + sitePrefix + "/stat/sta\"", &rc);
        json parsed = json::parse(raw, nullptr, false);
        if (parsed.is_discarded() || !parsed.contains("data") || !parsed["data"].is_array()) {
            errOut = "Không đọc được danh sách client từ UniFi Controller!";
            return false;
        }
        devsOut = json::array();
        std::time_t now = std::time(nullptr);
        for (const auto& c : parsed["data"]) {
            if (!c.is_object()) continue;
            std::string ip = c.value("ip", "");
            std::string mac = c.value("mac", "");
            std::string name = c.value("hostname", c.value("name", c.value("oui", "Khách WiFi")));
            if (ip.empty() || mac.empty()) continue;

            bool wl = isWhitelisted(ip);
            std::string tier = wl ? "whitelist" : "free";
            int remainingSec = 0, stage = 0;
            {
                std::lock_guard<std::mutex> lk(m_mtx);
                auto it = m_sessions.find(ip);
                if (it != m_sessions.end()) {
                    if (!wl) tier = it->second.tier;
                    stage = it->second.stage;
                    if (it->second.duration_sec > 0) {
                        remainingSec = std::max(0, static_cast<int>((it->second.start_epoch + it->second.duration_sec) - now));
                    }
                    if (it->second.mac.empty()) it->second.mac = mac;
                }
            }
            devsOut.push_back({
                {"mac", mac},
                {"ip", ip},
                {"name", name},
                {"tier", tier},
                {"whitelisted", wl},
                {"remaining_sec", remainingSec},
                {"stage", stage},
                {"status", "active"}
            });
        }
        return true;
    }

    std::string resolveMacFromUnifi(const std::string& targetIp) {
        if (targetIp.empty()) return "";
        json devs;
        std::string err;
        if (fetchUnifiClients(devs, err)) {
            for (const auto& d : devs) {
                if (d.value("ip", "") == targetIp) {
                    return d.value("mac", "");
                }
            }
        }
        return "";
    }

    bool applyUnifiGuestCmd(const std::string& ip, const std::string& macIn, const std::string& cmdName, int minutes, int downKbps, int upKbps, std::string& msgOut) {
        std::string mac = macIn;
        if (mac.empty()) {
            mac = resolveMacFromUnifi(ip);
        }
        if (mac.empty() || !isSafeHostOrIp(mac)) {
            msgOut = "Không tìm thấy MAC cho IP " + ip + " trên UniFi Controller!";
            return false;
        }
        std::string baseUrl, sitePrefix, cookieFile;
        if (!unifiLogin(baseUrl, sitePrefix, cookieFile, msgOut)) return false;

        json payload = {{"cmd", cmdName}, {"mac", mac}};
        if (cmdName == "authorize-guest") {
            payload["minutes"] = std::max(1, minutes);
            if (downKbps > 0) payload["down"] = downKbps;
            if (upKbps > 0) payload["up"] = upKbps;
        }
        int rc = 0;
        std::string csrfHeader;
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            if (!m_unifiCsrf.empty()) {
                csrfHeader = " -H \"X-CSRF-Token: " + escapeCmdArg(m_unifiCsrf) + "\"";
            }
        }
        std::string execCmd = "curl -sk -b \"" + cookieFile + "\" -H \"Content-Type: application/json\"" + csrfHeader + " -d \""
            + escapeCmdArg(payload.dump()) + "\" \"" + baseUrl + sitePrefix + "/cmd/stamgr\"";
        std::string resStr = execCapture(execCmd, &rc);
        if (resStr.find("\"ok\"") != std::string::npos || resStr.find("\"rc\":\"ok\"") != std::string::npos) {
            if (cmdName == "unauthorize-guest") {
                // Force reconnect so iOS/Android immediately re-probes Captive Portal
                std::string kickPayload = escapeCmdArg(json({{"cmd", "kick-sta"}, {"mac", mac}}).dump());
                execCapture("curl -sk -b \"" + cookieFile + "\" -H \"Content-Type: application/json\"" + csrfHeader + " -d \""
                    + kickPayload + "\" \"" + baseUrl + sitePrefix + "/cmd/stamgr\"", &rc);
            }
            msgOut = "UniFi Controller đã thực thi " + cmdName + " cho " + mac;
            return true;
        }
        msgOut = "UniFi Controller từ chối lệnh " + cmdName + " cho " + mac + (resStr.empty() ? "" : (": " + resStr.substr(0, 120)));
        return false;
    }

    bool applySpeedByRouterType(const std::string& ip, const std::string& mac, int minutes, int downKbps, int upKbps, bool unauthorize, std::string& msgOut) {
        std::string rType;
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            rType = m_cfg.value("router_type", "simulation");
        }
        if (rType == "unifi") {
            return applyUnifiGuestCmd(ip, mac, unauthorize ? "unauthorize-guest" : "authorize-guest", minutes, downKbps, upKbps, msgOut);
        }
        if (rType == "edgerouter") {
            std::string rate = unauthorize ? "8kbit" : (downKbps <= 0 ? "50mbit" : (std::to_string(std::max(1, downKbps / 1024)) + "mbit"));
            return applyEdgeRouterRate(ip, rate, msgOut);
        }
        if (rType == "mikrotik") {
            std::string limit = unauthorize ? "1k/1k" : (downKbps <= 0 ? "50M/50M" : (std::to_string(std::max(1, upKbps / 1024)) + "M/" + std::to_string(std::max(1, downKbps / 1024)) + "M"));
            return applyMikrotikRate(ip, limit, "CyberNexus QoS", msgOut);
        }
        msgOut = unauthorize ? ("Đã kết thúc phiên mô phỏng cho " + ip) : ("Đã cập nhật phiên mô phỏng cho " + ip);
        return true;
    }

    bool fetchEdgeRouterDevices(json& devsOut, std::string& errOut) {
        std::string host, user;
        int port = 22;
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            host = m_cfg.value("host", "172.16.0.1");
            user = m_cfg.value("username", "admin");
            port = m_cfg.value("port", 22);
        }
        if (!isSafeHostOrIp(host) || !isSafeHostOrIp(user)) {
            errOut = "IP hoặc User EdgeRouter không hợp lệ!";
            return false;
        }
        std::string cmd = "ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=3 -p "
            + std::to_string(port) + " " + user + "@" + host
            + " \"cat /var/run/dnsmasq-dhcp.leases 2>/dev/null || cat /config/dhcpd.leases 2>/dev/null\"";
        int rc = 0;
        std::string output = execCapture(cmd, &rc);
        if (rc != 0 && output.empty()) {
            errOut = "EdgeRouter SSH không phản hồi (kiểm tra IP " + host + ", Port " + std::to_string(port) + " hoặc SSH Key)";
            return false;
        }
        devsOut = json::array();
        if (output.find("lease ") != std::string::npos && output.find('{') != std::string::npos) {
            struct LeaseInfo { std::string ip, mac, name, state; };
            std::unordered_map<std::string, LeaseInfo> byIp;
            std::vector<std::string> order;
            std::istringstream iss(output);
            std::string line;
            LeaseInfo cur;
            bool inBlock = false;
            auto trimToken = [](std::string s) {
                while (!s.empty() && (s.back() == ';' || s.back() == '"' || s.back() == '\r' || s.back() == ' ')) s.pop_back();
                while (!s.empty() && (s.front() == '"' || s.front() == ' ')) s.erase(s.begin());
                return s;
            };
            while (std::getline(iss, line)) {
                std::istringstream ls(line);
                std::string t1, t2, t3;
                if (!(ls >> t1)) continue;
                if (t1 == "lease" && (ls >> t2)) {
                    cur = LeaseInfo{};
                    cur.ip = t2;
                    inBlock = true;
                } else if (inBlock && t1 == "}") {
                    if (!cur.ip.empty() && cur.state != "free" && cur.state != "abandoned") {
                        if (byIp.find(cur.ip) == byIp.end()) order.push_back(cur.ip);
                        byIp[cur.ip] = cur;
                    }
                    inBlock = false;
                } else if (inBlock) {
                    if (t1 == "hardware" && (ls >> t2 >> t3) && t2 == "ethernet") {
                        cur.mac = trimToken(t3);
                    } else if (t1 == "client-hostname") {
                        std::string rest;
                        std::getline(ls, rest);
                        cur.name = trimToken(rest);
                    } else if (t1 == "binding" && (ls >> t2 >> t3) && t2 == "state") {
                        cur.state = trimToken(t3);
                    }
                }
            }
            std::time_t now = std::time(nullptr);
            for (const auto& ipKey : order) {
                const auto& info = byIp[ipKey];
                bool wl = isWhitelisted(info.ip);
                std::string tier = wl ? "whitelist" : "free";
                int remainingSec = 0;
                int stage = 0;
                {
                    std::lock_guard<std::mutex> lk(m_mtx);
                    auto it = m_sessions.find(info.ip);
                    if (it != m_sessions.end()) {
                        if (!wl) tier = it->second.tier;
                        stage = it->second.stage;
                        if (it->second.duration_sec > 0) {
                            remainingSec = std::max(0, static_cast<int>((it->second.start_epoch + it->second.duration_sec) - now));
                        }
                        if (it->second.mac.empty()) it->second.mac = info.mac;
                    }
                }
                devsOut.push_back({
                    {"mac", info.mac},
                    {"ip", info.ip},
                    {"name", info.name.empty() ? "Thiết bị LAN" : info.name},
                    {"tier", tier},
                    {"whitelisted", wl},
                    {"remaining_sec", remainingSec},
                    {"stage", stage},
                    {"status", "bound"}
                });
            }
            return true;
        }
        return true;
    }

    bool startSessionForIp(const std::string& ip, const std::string& mac, const std::string& tier, const std::string& orderCode, int customMinutes, std::string* msgPtr = nullptr) {
        if (ip.empty()) {
            if (msgPtr) *msgPtr = "Thiếu IP thiết bị!";
            return false;
        }
        if (isWhitelisted(ip)) {
            if (msgPtr) *msgPtr = "Thiết bị đang nằm trong danh sách Nội bộ ∞";
            return true;
        }

        int freeMin = 10, vipMin = 180;
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            freeMin = std::max(1, m_cfg.value("free_minutes", 10));
            vipMin = std::max(5, m_cfg.value("vip_minutes", 180));
        }

        int mins = (tier == "vip" || tier == "vip_high_speed") ? (customMinutes > 0 ? customMinutes : vipMin)
                                                               : (customMinutes > 0 ? customMinutes : freeMin);
        std::string normTier = (tier == "vip" || tier == "vip_high_speed") ? "vip" : (tier == "blocked" ? "blocked" : "free");
        bool unauth = (normTier == "blocked");

        WifiSession s;
        s.ip = ip;
        s.mac = mac;
        s.tier = normTier;
        s.order_code = orderCode;
        s.start_epoch = std::time(nullptr);
        s.duration_sec = unauth ? 0 : (mins * 60);
        s.stage = 0;

        {
            std::lock_guard<std::mutex> lk(m_mtx);
            if (s.mac.empty() && m_sessions.count(ip)) s.mac = m_sessions[ip].mac;
            m_sessions[ip] = s;
        }

        std::string msg;
        bool ok = applySpeedByRouterType(s.ip, s.mac, mins, 0, 0, unauth, msg);
        if (msgPtr) *msgPtr = msg;
        return ok;
    }

    void watcherLoop() {
        while (m_running.load()) {
            for (int i = 0; i < 15 && m_running.load(); ++i) {
                std::this_thread::sleep_for(std::chrono::seconds(1));
            }
            if (!m_running.load()) break;

            bool peakMode = true;
            bool throttle70 = true;
            {
                std::lock_guard<std::mutex> lk(m_mtx);
                peakMode = m_cfg.value("peak_mode_enabled", true);
                throttle70 = m_cfg.value("throttle_after_70_pct", true);
            }

            std::vector<WifiSession> actions;
            std::time_t now = std::time(nullptr);
            {
                std::lock_guard<std::mutex> lk(m_mtx);
                for (auto it = m_sessions.begin(); it != m_sessions.end(); ) {
                    WifiSession& s = it->second;
                    if (s.tier == "whitelist" || s.tier == "blocked" || s.duration_sec <= 0) {
                        ++it;
                        continue;
                    }
                    double elapsed = static_cast<double>(now - s.start_epoch);
                    double ratio = elapsed / static_cast<double>(s.duration_sec);

                    if (ratio >= 1.0) {
                        // Silent expiration: unauthorize silently; reconnecting gives default free_minutes
                        s.stage = 3;
                        actions.push_back(s);
                        it = m_sessions.erase(it);
                        continue;
                    }
                    if (s.tier == "vip" && peakMode && throttle70) {
                        if (ratio >= 0.90 && s.stage < 2) {
                            s.stage = 2;
                            actions.push_back(s);
                        } else if (ratio >= 0.70 && s.stage < 1) {
                            s.stage = 1;
                            actions.push_back(s);
                        }
                    }
                    ++it;
                }
            }

            for (const auto& act : actions) {
                std::string msg;
                int remMins = std::max(1, static_cast<int>((act.start_epoch + act.duration_sec - now) / 60));
                if (act.stage == 3) {
                    applySpeedByRouterType(act.ip, act.mac, 1, 0, 0, true, msg);
                } else if (act.stage == 2) {
                    applySpeedByRouterType(act.ip, act.mac, remMins, 3072, 1536, false, msg);
                } else if (act.stage == 1) {
                    applySpeedByRouterType(act.ip, act.mac, remMins, 10240, 5120, false, msg);
                }
            }
        }
    }

public:
    ModuleMetadata getMetadata() const override {
        ModuleMetadata m;
        m.code = "mod_network_qos";
        m.name = "Quản Trị WiFi Marketing & Băng Thông Thông Minh (SNM)";
        m.version = "2.0.0";
        m.author = "SuperAdmin";
        m.category = "Network";
        m.description = "Quản lý WiFi theo thời gian (Free/VIP), tự động giảm tốc mềm sau 70%/90% thời gian VIP, Whitelist thiết bị quán, hỗ trợ UniFi Controller / EdgeRouter X / MikroTik.";
        m.monthly_price_vnd = 199000.0;
        m.is_core_required = false;
        m.dependencies = {};
        return m;
    }

    bool onLoad(const CoreContext& ctx) override {
        loadConfig();
        m_running.store(true);
        m_watcherThread = std::thread(&NetworkQosPlugin::watcherLoop, this);
        std::cout << "[mod_network_qos] Khởi tạo WiFi Marketing & Time-Based QoS (" << m_cfg.value("router_type", "simulation") << ")..." << std::endl;
        return true;
    }

    void onUnload() override {
        m_running.store(false);
        if (m_watcherThread.joinable()) m_watcherThread.join();
        std::cout << "[mod_network_qos] Ngắt kết nối và giải phóng tài nguyên mạng." << std::endl;
    }

    void registerHttpRoutes(httplib::Server& svr) override {
        svr.Get("/api/network/config", [this](const httplib::Request&, httplib::Response& res) {
            json safeCfg;
            {
                std::lock_guard<std::mutex> lk(m_mtx);
                safeCfg = m_cfg;
            }
            if (safeCfg.contains("password") && safeCfg["password"].is_string() && !safeCfg["password"].get<std::string>().empty()) {
                safeCfg["password"] = "********";
            }
            res.set_content(json({{"status", "success"}, {"config", safeCfg}}).dump(2), "application/json; charset=utf-8");
        });

        svr.Post("/api/network/config", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                json body = json::parse(req.body);
                {
                    std::lock_guard<std::mutex> lk(m_mtx);
                    for (auto it = body.begin(); it != body.end(); ++it) {
                        if (it.key() == "password" && it.value() == "********") continue;
                        m_cfg[it.key()] = it.value();
                    }
                }
                saveConfig();
                res.set_content(json({{"status", "success"}, {"message", "Đã lưu cấu hình WiFi Marketing & Router QoS!"}}).dump(2), "application/json; charset=utf-8");
            } catch (const std::exception& e) {
                res.status = 400;
                res.set_content(json({{"status", "error"}, {"message", e.what()}}).dump(2), "application/json; charset=utf-8");
            }
        });

        svr.Post("/api/network/whitelist", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                json body = json::parse(req.body);
                std::string ip = body.value("ip", "");
                if (ip.empty()) {
                    res.status = 400;
                    res.set_content("{\"status\":\"error\",\"message\":\"Thiếu IP thiết bị\"}", "application/json; charset=utf-8");
                    return;
                }
                bool added = false;
                {
                    std::lock_guard<std::mutex> lk(m_mtx);
                    if (!m_cfg.contains("whitelist_ips") || !m_cfg["whitelist_ips"].is_array()) {
                        m_cfg["whitelist_ips"] = json::array();
                    }
                    auto& arr = m_cfg["whitelist_ips"];
                    auto pos = std::find(arr.begin(), arr.end(), json(ip));
                    if (pos != arr.end()) {
                        arr.erase(pos);
                        added = false;
                    } else {
                        arr.push_back(ip);
                        added = true;
                        m_sessions.erase(ip);
                    }
                }
                saveConfig();
                res.set_content(json({
                    {"status", "success"},
                    {"whitelisted", added},
                    {"message", added ? ("Đã ghim " + ip + " vào danh sách Nội bộ (Không giới hạn)") : ("Đã bỏ ghim Nội bộ cho " + ip)}
                }).dump(2), "application/json; charset=utf-8");
            } catch (const std::exception& e) {
                res.status = 400;
                res.set_content(json({{"status", "error"}, {"message", e.what()}}).dump(2), "application/json; charset=utf-8");
            }
        });

        svr.Get("/api/network/devices", [this](const httplib::Request&, httplib::Response& res) {
            std::string rType;
            {
                std::lock_guard<std::mutex> lk(m_mtx);
                rType = m_cfg.value("router_type", "simulation");
            }
            if (rType == "mikrotik") {
                std::string host, user, pass;
                int port = 80;
                {
                    std::lock_guard<std::mutex> lk(m_mtx);
                    host = m_cfg.value("host", "192.168.88.1");
                    port = m_cfg.value("port", 80);
                    user = m_cfg.value("username", "admin");
                    pass = m_cfg.value("password", "");
                }
                httplib::Client cli(host, port);
                cli.set_connection_timeout(3, 0);
                cli.set_basic_auth(user, pass);
                auto mRes = cli.Get("/rest/ip/dhcp-server/lease");
                if (mRes && mRes->status == 200) {
                    try {
                        json leases = json::parse(mRes->body);
                        json devs = json::array();
                        std::time_t now = std::time(nullptr);
                        for (const auto& l : leases) {
                            std::string ip = l.value("address", "");
                            bool wl = isWhitelisted(ip);
                            std::string tier = wl ? "whitelist" : "free";
                            int remainingSec = 0, stage = 0;
                            {
                                std::lock_guard<std::mutex> lk(m_mtx);
                                auto it = m_sessions.find(ip);
                                if (it != m_sessions.end()) {
                                    if (!wl) tier = it->second.tier;
                                    stage = it->second.stage;
                                    if (it->second.duration_sec > 0) {
                                        remainingSec = std::max(0, static_cast<int>((it->second.start_epoch + it->second.duration_sec) - now));
                                    }
                                }
                            }
                            devs.push_back({
                                {"mac", l.value("mac-address", "")},
                                {"ip", ip},
                                {"name", l.value("host-name", "Client")},
                                {"tier", tier},
                                {"whitelisted", wl},
                                {"remaining_sec", remainingSec},
                                {"stage", stage},
                                {"status", l.value("status", "bound")}
                            });
                        }
                        res.set_content(json({{"status", "success"}, {"mode", "mikrotik"}, {"devices", devs}}).dump(2), "application/json; charset=utf-8");
                        return;
                    } catch (...) {}
                }
                res.set_content(json({{"status", "error"}, {"mode", "mikrotik"}, {"devices", json::array()}, {"message", "Không kết nối được MikroTik REST API để quét thiết bị LAN."}}).dump(2), "application/json; charset=utf-8");
                return;
            }
            if (rType == "edgerouter") {
                json devs = json::array();
                std::string errMsg;
                if (fetchEdgeRouterDevices(devs, errMsg)) {
                    res.set_content(json({{"status", "success"}, {"mode", "edgerouter"}, {"devices", devs}}).dump(2), "application/json; charset=utf-8");
                } else {
                    res.set_content(json({{"status", "error"}, {"mode", "edgerouter"}, {"devices", json::array()}, {"message", errMsg}}).dump(2), "application/json; charset=utf-8");
                }
                return;
            }
            if (rType == "unifi") {
                json devs = json::array();
                std::string errMsg;
                if (fetchUnifiClients(devs, errMsg)) {
                    res.set_content(json({{"status", "success"}, {"mode", "unifi"}, {"devices", devs}, {"message", devs.empty() ? "Chưa có thiết bị WiFi nào đang kết nối." : ""}}).dump(2), "application/json; charset=utf-8");
                } else {
                    res.set_content(json({{"status", "error"}, {"mode", "unifi"}, {"devices", json::array()}, {"message", errMsg}}).dump(2), "application/json; charset=utf-8");
                }
                return;
            }
            res.set_content(json({
                {"status", "success"},
                {"mode", rType},
                {"devices", json::array()},
                {"message", "Đang ở chế độ Mô phỏng — hãy chọn EdgeRouter SSH, UniFi Controller hoặc MikroTik REST và bấm Lưu Router để quét thiết bị LAN thật."}
            }).dump(2), "application/json; charset=utf-8");
        });

        svr.Post("/api/network/qos/set", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                json body = json::parse(req.body);
                std::string ip = body.value("ip", "");
                std::string mac = body.value("mac", "");
                std::string qos = body.value("qos", "vip_high_speed");
                std::string detailMsg;
                bool ok = startSessionForIp(ip, mac, qos, "", 0, &detailMsg);
                if (detailMsg.empty()) {
                    detailMsg = (qos == "vip_high_speed" || qos == "vip")
                        ? ("Đã cấp phiên WiFi VIP cho " + ip)
                        : (qos == "blocked" ? ("Đã ngắt kết nối " + ip) : ("Đã chuyển " + ip + " về phiên Miễn phí"));
                }
                res.status = ok ? 200 : 502;
                res.set_content(json({{"status", ok ? "success" : "error"}, {"ip", ip}, {"qos", qos}, {"message", detailMsg}}).dump(2), "application/json; charset=utf-8");
            } catch (const std::exception& e) {
                res.status = 400;
                res.set_content(json({{"status", "error"}, {"message", e.what()}}).dump(2), "application/json; charset=utf-8");
            }
        });
    }

    void onSystemEvent(const std::string& eventType, const json& eventPayload) override {
        if (eventType == "WIFI_UNLOCK_SESSION") {
            std::string ip = eventPayload.value("client_ip", "");
            std::string mac = eventPayload.value("mac", "");
            std::string mode = eventPayload.value("mode", "free");
            std::string orderCode = eventPayload.value("order_code", "");
            int mins = eventPayload.value("minutes", 0);
            startSessionForIp(ip, mac, mode, orderCode, mins);
        } else if (eventType == "ORDER_PAID") {
            std::string ip = eventPayload.value("client_ip", "");
            std::string oc = eventPayload.value("order_code", "");
            if (!ip.empty()) {
                startSessionForIp(ip, "", "vip", oc, 0);
            }
        }
    }
};

extern "C" {
    CYBERNEXUS_PLUGIN_API IModulePlugin* createCyberNexusPlugin() {
        return new NetworkQosPlugin();
    }

    CYBERNEXUS_PLUGIN_API void destroyCyberNexusPlugin(IModulePlugin* p) {
        delete p;
    }
}
