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
#include "embedded_web_assets.hpp"

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
    std::function<bool(const std::string&)> m_checkLicense;
    std::mutex m_mtx;

    bool requireModuleLicensed(httplib::Response& res) {
        if (m_checkLicense && !m_checkLicense("mod_network_qos")) {
            res.status = 403;
            res.set_content(json({
                {"status", "error"},
                {"code", "MODULE_DISABLED"},
                {"module", "mod_network_qos"},
                {"message", "Module Quản Trị Mạng & WiFi Marketing (mod_network_qos) đang bị TẮT hoặc KHÓA bản quyền từ Master!"}
            }).dump(), "application/json; charset=utf-8");
            return false;
        }
        return true;
    }
    std::unordered_map<std::string, WifiSession> m_sessions;
    std::atomic<bool> m_running{false};
    std::thread m_watcherThread;
    std::string m_unifiSessionKey;
    std::string m_unifiCachedBaseUrl;
    std::string m_unifiCachedSitePrefix;
    std::time_t m_unifiLastLoginEpoch{0};

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
        {"peak_windows", "08:00-11:30, 18:30-22:00"},
        {"whitelist_ips", json::array()},
        {"whitelist_macs", json::array()},
        {"guest_isolation_enabled", false},
        {"pos_server_ip", ""},
        {"pos_server_port", 8501},
        {"guest_ssid_name", ""},
        {"admin_ip_guard_enabled", false},
        {"erx_host", "172.16.0.1"},
        {"erx_port", 22},
        {"erx_user", "admin"},
        {"erx_pass", ""},
        {"dns_filter_profile", "off"},
        {"pos_priority_qos", false},
        {"wan_down_mbps", 100},
        {"wan_up_mbps", 100},
        {"auto_throttle_heavy_mb", 500},
        {"max_conn_per_guest", 150}
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

    static std::string toLowerCopy(std::string s) {
        std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
        return s;
    }

    bool isWhitelisted(const std::string& ip, const std::string& mac = "") {
        std::lock_guard<std::mutex> lk(m_mtx);
        if (!ip.empty() && m_cfg.contains("whitelist_ips") && m_cfg["whitelist_ips"].is_array()) {
            for (const auto& w : m_cfg["whitelist_ips"]) {
                if (w.is_string() && w.get<std::string>() == ip) return true;
            }
        }
        if (!mac.empty() && m_cfg.contains("whitelist_macs") && m_cfg["whitelist_macs"].is_array()) {
            std::string lowMac = toLowerCopy(mac);
            for (const auto& w : m_cfg["whitelist_macs"]) {
                if (w.is_string() && toLowerCopy(w.get<std::string>()) == lowMac) return true;
            }
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

    static std::string escapeCmdBatchVal(const std::string& s) {
        std::string out;
        out.reserve(s.size() * 2 + 4);
        for (char c : s) {
            if (c == '%') out += "%%";
            else if (c == '^' || c == '&' || c == '|' || c == '<' || c == '>' || c == '(' || c == ')' || c == '!') {
                out += '^';
                out += c;
            } else if (c != '\r' && c != '\n') {
                out += c;
            }
        }
        return out;
    }

    static std::string trimErrLine(const std::string& raw) {
        std::string s = raw;
        while (!s.empty() && (s.back() == '\r' || s.back() == '\n' || s.back() == ' ')) s.pop_back();
        for (char& c : s) { if (c == '\r' || c == '\n') c = ' '; }
        if (s.size() > 180) s = s.substr(0, 180) + "...";
        return s;
    }

    std::string execEdgeRouterSsh(const std::string& host, int port, const std::string& user, const std::string& pass, const std::string& remoteCmd, int* rcOut) {
        int rc = -1;
        std::string baseArgs = "-o StrictHostKeyChecking=no -o ConnectTimeout=4 -p " + std::to_string(port) + " " + user + "@" + host + " \"" + remoteCmd + "\"";
        // 1) Try passwordless SSH key first (fast, non-interactive)
        std::string out = execCapture("ssh -o BatchMode=yes " + baseArgs + " 2>&1", &rc);
        if (rc == 0) {
            if (rcOut) *rcOut = 0;
            return out;
        }
        // 2) If user provided a password, use OpenSSH SSH_ASKPASS_REQUIRE=force (works out-of-the-box on Windows OpenSSH)
        if (!pass.empty()) {
            fs::create_directories("config");
#ifdef _WIN32
            fs::path askPath = fs::absolute("config/edr_askpass.cmd");
            {
                std::ofstream af(askPath, std::ios::binary | std::ios::trunc);
                af << "@echo off\r\necho " << escapeCmdBatchVal(pass) << "\r\n";
            }
            std::string cmd = "cmd /c \"set SSH_ASKPASS=" + askPath.string()
                + "& set SSH_ASKPASS_REQUIRE=force& set DISPLAY=1& ssh -o NumberOfPasswordPrompts=1 -o PreferredAuthentications=password,keyboard-interactive "
                + baseArgs + " 2>&1\"";
            out = execCapture(cmd, &rc);
            std::error_code ec;
            fs::remove(askPath, ec);
#else
            fs::path askPath = fs::absolute("config/edr_askpass.sh");
            {
                std::ofstream af(askPath, std::ios::binary | std::ios::trunc);
                af << "#!/bin/sh\nprintf '%s\\n' '" << pass << "'\n";
            }
            std::system(("chmod 700 \"" + askPath.string() + "\"").c_str());
            std::string cmd = "SSH_ASKPASS=\"" + askPath.string() + "\" SSH_ASKPASS_REQUIRE=force DISPLAY=1 ssh -o NumberOfPasswordPrompts=1 " + baseArgs + " 2>&1";
            out = execCapture(cmd, &rc);
            std::error_code ec;
            fs::remove(askPath, ec);
#endif
        }
        if (rcOut) *rcOut = rc;
        return out;
    }

    bool applyEdgeRouterRate(const std::string& ip, const std::string& rate, std::string& msgOut) {
        std::string host, user, pass;
        int port = 22;
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            host = m_cfg.value("host", "172.16.0.1");
            user = m_cfg.value("username", "admin");
            pass = m_cfg.value("password", "");
            port = m_cfg.value("port", 22);
        }
        if (!isSafeHostOrIp(host) || !isSafeHostOrIp(ip) || !isSafeHostOrIp(user)) {
            msgOut = "Tham số IP/Host EdgeRouter không hợp lệ!";
            return false;
        }
        std::string remoteCmd = "sudo tc class change dev eth0 parent 1: classid 1:10 htb rate " + rate + " || true";
        int rc = -1;
        std::string out = execEdgeRouterSsh(host, port, user, pass, remoteCmd, &rc);
        if (rc == 0) {
            msgOut = "EdgeRouter SSH đã cập nhật (" + rate + ") cho " + ip;
            return true;
        }
        std::string detail = trimErrLine(out);
        msgOut = "EdgeRouter SSH lỗi (" + host + ":" + std::to_string(port) + ")" + (detail.empty() ? "" : ": " + detail);
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

    bool unifiLoginWithParams(const std::string& host, int port, const std::string& user, const std::string& pass, const std::string& site,
                              std::string& baseUrlOut, std::string& sitePrefixOut, std::string& cookieFileOut, std::string& errOut, bool forceRelogin = false) {
        if (!isSafeHostOrIp(host) || !isSafeHostOrIp(site) || port <= 0 || port > 65535) {
            errOut = "Cấu hình Host/Site/Port UniFi không hợp lệ!";
            return false;
        }
        cookieFileOut = "config/unifi_cookie.txt";
        std::string sessKey = host + ":" + std::to_string(port) + ":" + user + ":" + site;
        std::time_t nowEp = std::time(nullptr);
        if (!forceRelogin) {
            std::lock_guard<std::mutex> lk(m_mtx);
            if (!m_unifiSessionKey.empty() && m_unifiSessionKey == sessKey &&
                (nowEp - m_unifiLastLoginEpoch) < 900 && fs::exists(cookieFileOut)) {
                baseUrlOut = m_unifiCachedBaseUrl;
                sitePrefixOut = m_unifiCachedSitePrefix;
                return true;
            }
        }
        std::string hdrFile = "config/unifi_headers.txt";
        std::string reqFile = "config/unifi_login_req.json";
        fs::create_directories("config");
        {
            std::ofstream rf(reqFile, std::ios::binary | std::ios::trunc);
            rf << json({{"username", user}, {"password", pass}, {"remember", true}}).dump();
        }
        baseUrlOut = "https://" + host + ":" + std::to_string(port);

        auto tryEndpoint = [&](const std::string& ep, bool isUniFiOS, std::string& httpCodeOut, std::string& bodyOut) -> bool {
            int rc = 0;
            std::string cmd = "curl -sk --connect-timeout 5 --max-time 8 -w \"\\nHTTP_CODE:%{http_code}\" -D \""
                + hdrFile + "\" -c \"" + cookieFileOut + "\" -H \"Content-Type: application/json\" --data-binary \"@"
                + reqFile + "\" \"" + baseUrlOut + ep + "\" 2>&1";
            std::string raw = execCapture(cmd, &rc);
            httpCodeOut = "000";
            bodyOut = raw;
            size_t pos = raw.rfind("HTTP_CODE:");
            if (pos != std::string::npos) {
                httpCodeOut = trimErrLine(raw.substr(pos + 10));
                bodyOut = raw.substr(0, pos);
            }
            if (isUniFiOS) {
                if (httpCodeOut == "200" && (bodyOut.find("\"unique_id\"") != std::string::npos || bodyOut.find("\"username\"") != std::string::npos || bodyOut.find("\"id\"") != std::string::npos)) {
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
            } else {
                if (httpCodeOut == "200" && (bodyOut.find("\"rc\":\"ok\"") != std::string::npos || bodyOut.find("\"ok\"") != std::string::npos)) {
                    sitePrefixOut = "/api/s/" + site;
                    return true;
                }
            }
            return false;
        };

        std::string code1, body1, code2, body2;
        bool ok = false;
        // UniFi OS Server (443 / 11443) uses /api/auth/login; self-hosted UniFi Network (8443) uses /api/login
        if (port == 443 || port == 11443) {
            ok = tryEndpoint("/api/auth/login", true, code1, body1) || tryEndpoint("/api/login", false, code2, body2);
        } else {
            ok = tryEndpoint("/api/login", false, code1, body1) || tryEndpoint("/api/auth/login", true, code2, body2);
        }
        std::error_code ec;
        fs::remove(reqFile, ec);
        if (ok) {
            std::lock_guard<std::mutex> lk(m_mtx);
            m_unifiSessionKey = sessKey;
            m_unifiCachedBaseUrl = baseUrlOut;
            m_unifiCachedSitePrefix = sitePrefixOut;
            m_unifiLastLoginEpoch = std::time(nullptr);
            return true;
        }

        if (code1 == "000" && (code2.empty() || code2 == "000")) {
            errOut = "Không thể kết nối tới UniFi Controller (" + host + ":" + std::to_string(port) + " — Timeout hoặc bị từ chối cổng).";
        } else {
            std::string bestCode = (code1 != "000" && code1 != "404") ? code1 : code2;
            std::string bestBody = (code1 != "000" && code1 != "404") ? body1 : body2;
            if (bestCode == "429") {
                errOut = "UniFi OS Server tạm giới hạn tốc độ đăng nhập (HTTP 429). Vui lòng đợi 3–5 phút để UniFi mở khóa lại (từ bản v2026.11.23.06 hệ thống đã cache cookie 15 phút để không bao giờ bị 429 nữa).";
            } else {
                errOut = "UniFi Controller từ chối đăng nhập (" + host + ":" + std::to_string(port) + ", HTTP " + bestCode + "): " + trimErrLine(bestBody);
            }
        }
        return false;
    }

    bool unifiLogin(std::string& baseUrlOut, std::string& sitePrefixOut, std::string& cookieFileOut, std::string& errOut, bool forceRelogin = false) {
        std::string host, user, pass, site;
        int port = 8443;
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            host = m_cfg.value("host", "172.16.38.119");
            port = m_cfg.value("port", 8443);
            user = m_cfg.value("username", "admin");
            pass = m_cfg.value("password", "");
            site = m_cfg.value("unifi_site", "default");
        }
        return unifiLoginWithParams(host, port, user, pass, site, baseUrlOut, sitePrefixOut, cookieFileOut, errOut, forceRelogin);
    }

    bool fetchUnifiClients(json& devsOut, std::string& errOut) {
        std::string baseUrl, sitePrefix, cookieFile;
        if (!unifiLogin(baseUrl, sitePrefix, cookieFile, errOut, false)) return false;

        int rc = 0;
        std::string raw = execCapture("curl -sk --connect-timeout 5 --max-time 8 -b \"" + cookieFile + "\" \"" + baseUrl + sitePrefix + "/stat/sta\"", &rc);
        json parsed = json::parse(raw, nullptr, false);
        if (parsed.is_discarded() || !parsed.contains("data") || !parsed["data"].is_array()) {
            // Session cookie có thể vừa hết hạn -> đăng nhập lại đúng 1 lần duy nhất
            if (!unifiLogin(baseUrl, sitePrefix, cookieFile, errOut, true)) return false;
            raw = execCapture("curl -sk --connect-timeout 5 --max-time 8 -b \"" + cookieFile + "\" \"" + baseUrl + sitePrefix + "/stat/sta\"", &rc);
            parsed = json::parse(raw, nullptr, false);
            if (parsed.is_discarded() || !parsed.contains("data") || !parsed["data"].is_array()) {
                errOut = "Không đọc được danh sách client từ UniFi Controller!";
                return false;
            }
        }
        devsOut = json::array();
        std::time_t now = std::time(nullptr);
        std::unordered_map<std::string, bool> seenIps;
        for (const auto& c : parsed["data"]) {
            if (!c.is_object()) continue;
            std::string ip = c.value("ip", "");
            std::string mac = c.value("mac", "");
            std::string name = c.value("hostname", c.value("name", c.value("oui", "Khách WiFi")));
            if (ip.empty() || mac.empty()) continue;
            seenIps[ip] = true;

            bool wl = isWhitelisted(ip, mac);
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
            int64_t txBytes = c.value("tx_bytes", int64_t(0));
            int64_t rxBytes = c.value("rx_bytes", int64_t(0));
            double txMb = static_cast<double>(txBytes) / (1024.0 * 1024.0);
            double rxMb = static_cast<double>(rxBytes) / (1024.0 * 1024.0);
            double totalMb = txMb + rxMb;
            int rssi = c.value("rssi", 0);
            bool isWired = c.value("is_wired", false);
            std::string radio = c.value("radio", "");
            std::string connType = isWired ? "LAN Dây" : (radio == "na" ? "WiFi 5G" : "WiFi 2.4G");
            devsOut.push_back({
                {"mac", mac},
                {"ip", ip},
                {"name", name},
                {"tier", tier},
                {"whitelisted", wl},
                {"remaining_sec", remainingSec},
                {"stage", stage},
                {"tx_mb", std::round(txMb * 10.0) / 10.0},
                {"rx_mb", std::round(rxMb * 10.0) / 10.0},
                {"total_mb", std::round(totalMb * 10.0) / 10.0},
                {"rssi", rssi},
                {"conn_type", connType},
                {"status", "active"}
            });
        }
        // Đồng bộ thêm danh sách thiết bị đang bị Ban (blocked=true) trực tiếp từ UniFi /rest/user (bền vững kể cả sau khi restart Slave)
        std::unordered_map<std::string, bool> seenMacs;
        for (const auto& d : devsOut) {
            std::string dm = d.value("mac", "");
            if (!dm.empty()) seenMacs[dm] = true;
        }
        try {
            std::string rawUsers = execCapture("curl -sk --connect-timeout 4 --max-time 6 -b \"" + cookieFile + "\" \"" + baseUrl + sitePrefix + "/rest/user\"", &rc);
            json uParsed = json::parse(rawUsers, nullptr, false);
            if (!uParsed.is_discarded() && uParsed.contains("data") && uParsed["data"].is_array()) {
                for (const auto& u : uParsed["data"]) {
                    if (!u.is_object() || !u.value("blocked", false)) continue;
                    std::string umac = u.value("mac", "");
                    if (umac.empty() || seenMacs.count(umac)) continue;
                    seenMacs[umac] = true;
                    std::string uip = u.value("fixed_ip", u.value("last_ip", ""));
                    std::string uname = u.value("name", u.value("hostname", u.value("oui", "Thiết bị đang bị chặn")));
                    devsOut.push_back({
                        {"mac", umac},
                        {"ip", uip.empty() ? umac : uip},
                        {"name", uname},
                        {"tier", "blocked"},
                        {"whitelisted", false},
                        {"remaining_sec", 0},
                        {"stage", 3},
                        {"status", "blocked"}
                    });
                }
            }
        } catch (...) {}
        // Giữ lại các thiết bị đang ở trạng thái Đã chặn trong RAM nếu chưa có trong /rest/user
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            for (const auto& [sip, s] : m_sessions) {
                if (s.tier == "blocked" && !seenIps.count(sip) && (s.mac.empty() || !seenMacs.count(s.mac))) {
                    devsOut.push_back({
                        {"mac", s.mac},
                        {"ip", sip},
                        {"name", s.name.empty() ? "Thiết bị đang bị chặn" : s.name},
                        {"tier", "blocked"},
                        {"whitelisted", false},
                        {"remaining_sec", 0},
                        {"stage", 3},
                        {"status", "blocked"}
                    });
                }
            }
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
            msgOut = "Không tìm thấy địa chỉ MAC cho IP " + ip + " trên UniFi Controller!";
            return false;
        }
        std::string baseUrl, sitePrefix, cookieFile;
        if (!unifiLogin(baseUrl, sitePrefix, cookieFile, msgOut)) return false;

        std::string csrfHeader;
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            if (!m_unifiCsrf.empty()) {
                csrfHeader = " -H \"X-CSRF-Token: " + escapeCmdArg(m_unifiCsrf) + "\"";
            }
        }
        auto sendStamgr = [&](const json& payload, std::string& outResp) -> bool {
            std::string reqFile = "config/unifi_cmd_req.json";
            fs::create_directories("config");
            {
                std::ofstream rf(reqFile, std::ios::binary | std::ios::trunc);
                rf << payload.dump();
            }
            int rc = 0;
            std::string execCmd = "curl -sk --connect-timeout 5 --max-time 8 -b \"" + cookieFile
                + "\" -H \"Content-Type: application/json\"" + csrfHeader
                + " --data-binary \"@" + reqFile + "\" \"" + baseUrl + sitePrefix + "/cmd/stamgr\" 2>&1";
            outResp = execCapture(execCmd, &rc);
            std::error_code ec;
            fs::remove(reqFile, ec);
            return (outResp.find("\"ok\"") != std::string::npos || outResp.find("\"rc\":\"ok\"") != std::string::npos);
        };

        std::string resStr;
        if (cmdName == "kick-sta") {
            // NET-06: Ngắt mềm — hạ phiên Guest (nếu có) + đá rớt 1 nhịp, KHÔNG Ban cứng MAC
            std::string unauthResp;
            sendStamgr(json({{"cmd", "unauthorize-guest"}, {"mac", mac}}), unauthResp);
            bool kicked = sendStamgr(json({{"cmd", "kick-sta"}, {"mac", mac}}), resStr);
            if (kicked) {
                msgOut = "Đã NGẮT phiên kết nối (đá rớt mềm, không Ban) cho " + mac + "!";
                return true;
            }
            msgOut = "UniFi từ chối lệnh Ngắt (kick-sta) cho " + mac + (resStr.empty() ? "" : (": " + trimErrLine(resStr).substr(0, 140)));
            return false;
        }
        if (cmdName == "block-sta") {
            bool blocked = sendStamgr(json({{"cmd", "block-sta"}, {"mac", mac}}), resStr);
            std::string kickResp;
            sendStamgr(json({{"cmd", "kick-sta"}, {"mac", mac}}), kickResp);
            if (blocked) {
                msgOut = "Đã CHẶN (Ban MAC) thiết bị " + mac + " khỏi WiFi quán!";
                return true;
            }
            msgOut = "UniFi từ chối lệnh Chặn (block-sta) cho " + mac + (resStr.empty() ? "" : (": " + trimErrLine(resStr).substr(0, 140)));
            return false;
        }
        if (cmdName == "unblock-sta") {
            bool unblocked = sendStamgr(json({{"cmd", "unblock-sta"}, {"mac", mac}}), resStr);
            if (unblocked) {
                msgOut = "Đã MỞ CHẶN WiFi cho thiết bị " + mac + "!";
                return true;
            }
            msgOut = "UniFi từ chối lệnh Mở chặn (unblock-sta) cho " + mac + (resStr.empty() ? "" : (": " + trimErrLine(resStr).substr(0, 140)));
            return false;
        }

        // Cấp VIP / authorize-guest: luôn tự động gỡ chặn (unblock-sta) trước phòng trường hợp máy đang bị Ngắt
        std::string unblkResp;
        bool unblkOk = sendStamgr(json({{"cmd", "unblock-sta"}, {"mac", mac}}), unblkResp);
        json payload = {{"cmd", "authorize-guest"}, {"mac", mac}, {"minutes", std::max(1, minutes)}};
        if (downKbps > 0) payload["down"] = downKbps;
        if (upKbps > 0) payload["up"] = upKbps;
        bool authOk = sendStamgr(payload, resStr);
        if (authOk || unblkOk) {
            msgOut = "Đã cấp phiên WiFi VIP (" + std::to_string(std::max(1, minutes)) + " phút) cho " + mac + " trên UniFi!";
            return true;
        }
        msgOut = "UniFi Controller từ chối lệnh cấp VIP cho " + mac + (resStr.empty() ? "" : (": " + trimErrLine(resStr).substr(0, 140)));
        return false;
    }

    bool applySpeedByRouterType(const std::string& ip, const std::string& mac, int minutes, int downKbps, int upKbps, bool unauthorize, std::string& msgOut, bool isUnblockOnly = false, bool isSoftKick = false) {
        std::string rType;
        {
            std::lock_guard<std::mutex> lk(m_mtx);
            rType = m_cfg.value("router_type", "simulation");
        }
        if (rType == "unifi" || rType == "hybrid_erx_unifi") {
            std::string cmd = isSoftKick ? "kick-sta" : (unauthorize ? "block-sta" : (isUnblockOnly ? "unblock-sta" : "authorize-guest"));
            return applyUnifiGuestCmd(ip, mac, cmd, minutes, downKbps, upKbps, msgOut);
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
        bool isSoftKick = (tier == "kick" || tier == "disconnect");
        bool isUnblock = (tier == "unblock" || tier == "restore");
        bool isHardBan = (tier == "ban" || tier == "blocked");
        std::string normTier = (tier == "vip" || tier == "vip_high_speed") ? "vip" : (isHardBan ? "blocked" : "free");
        bool unauth = isHardBan;

        WifiSession s;
        s.ip = ip;
        s.mac = mac;
        s.tier = normTier;
        s.order_code = orderCode;
        s.start_epoch = std::time(nullptr);
        s.duration_sec = (unauth || isSoftKick) ? 0 : (mins * 60);
        s.stage = 0;

        {
            std::lock_guard<std::mutex> lk(m_mtx);
            if (s.mac.empty() && m_sessions.count(ip)) s.mac = m_sessions[ip].mac;
            if (isUnblock || isSoftKick) {
                m_sessions.erase(ip);
            } else {
                m_sessions[ip] = s;
            }
        }

        std::string msg;
        bool ok = applySpeedByRouterType(s.ip, s.mac, mins, 0, 0, unauth, msg, isUnblock, isSoftKick);
        if (msgPtr) *msgPtr = msg;
        return ok;
    }

    static bool isWithinPeakWindow(const std::string& windowsStr) {
        std::string trimmed = windowsStr;
        trimmed.erase(std::remove_if(trimmed.begin(), trimmed.end(), ::isspace), trimmed.end());
        if (trimmed.empty()) return true; // Empty = apply all day when toggle is ON

        std::time_t now = std::time(nullptr);
        std::tm lt{};
#ifdef _WIN32
        localtime_s(&lt, &now);
#else
        localtime_r(&now, &lt);
#endif
        int curMin = lt.tm_hour * 60 + lt.tm_min;

        std::istringstream ss(trimmed);
        std::string slot;
        auto parseHm = [](const std::string& hm) -> int {
            size_t c = hm.find(':');
            if (c == std::string::npos) return -1;
            try {
                int h = std::stoi(hm.substr(0, c));
                int m = std::stoi(hm.substr(c + 1));
                if (h < 0 || h > 23 || m < 0 || m > 59) return -1;
                return h * 60 + m;
            } catch (...) { return -1; }
        };
        while (std::getline(ss, slot, ',')) {
            size_t dash = slot.find('-');
            if (dash == std::string::npos) continue;
            int sMin = parseHm(slot.substr(0, dash));
            int eMin = parseHm(slot.substr(dash + 1));
            if (sMin < 0 || eMin < 0) continue;
            if (sMin <= eMin) {
                if (curMin >= sMin && curMin <= eMin) return true;
            } else {
                if (curMin >= sMin || curMin <= eMin) return true; // overnight window
            }
        }
        return false;
    }

    void watcherLoop() {
        while (m_running.load()) {
            for (int i = 0; i < 15 && m_running.load(); ++i) {
                std::this_thread::sleep_for(std::chrono::seconds(1));
            }
            if (!m_running.load()) break;

            bool peakMode = true;
            bool throttle70 = true;
            std::string peakWindows;
            {
                std::lock_guard<std::mutex> lk(m_mtx);
                peakMode = m_cfg.value("peak_mode_enabled", true);
                throttle70 = m_cfg.value("throttle_after_70_pct", true);
                peakWindows = m_cfg.value("peak_windows", "08:00-11:30, 18:30-22:00");
            }
            bool inPeakNow = peakMode && throttle70 && isWithinPeakWindow(peakWindows);

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
                    if (s.tier == "vip" && inPeakNow) {
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
        m_checkLicense = ctx.checkLicenseStatus;
        if (const char* envQos = std::getenv("CYBERNEXUS_QOS_CONFIG"); envQos && *envQos) {
            m_configPath = envQos;
        } else {
#ifdef _WIN32
            char exeBuf[MAX_PATH] = {};
            if (GetModuleFileNameA(nullptr, exeBuf, MAX_PATH) > 0) {
                fs::path absCfg = fs::path(exeBuf).parent_path() / "config" / "router_qos.json";
                if (!fs::exists(absCfg) && fs::exists("config/router_qos.json")) {
                    std::error_code ec;
                    fs::create_directories(absCfg.parent_path(), ec);
                    fs::copy_file("config/router_qos.json", absCfg, fs::copy_options::overwrite_existing, ec);
                }
                m_configPath = absCfg.string();
            }
#endif
        }
        loadConfig();
        m_running.store(true);
        m_watcherThread = std::thread(&NetworkQosPlugin::watcherLoop, this);
        std::cout << "[mod_network_qos] Khởi tạo WiFi Marketing & Time-Based QoS (" << m_cfg.value("router_type", "simulation") << ", cfg=" << m_configPath << ")..." << std::endl;
        return true;
    }

    void onUnload() override {
        m_running.store(false);
        if (m_watcherThread.joinable()) m_watcherThread.join();
        std::cout << "[mod_network_qos] Ngắt kết nối và giải phóng tài nguyên mạng." << std::endl;
    }

    void registerHttpRoutes(httplib::Server& svr) override {
        svr.Get("/api/network/config", [this](const httplib::Request&, httplib::Response& res) {
            if (!requireModuleLicensed(res)) return;
            json safeCfg;
            {
                std::lock_guard<std::mutex> lk(m_mtx);
                safeCfg = m_cfg;
            }
            if (safeCfg.contains("password") && safeCfg["password"].is_string() && !safeCfg["password"].get<std::string>().empty()) {
                safeCfg["password"] = "********";
            }
            if (safeCfg.contains("erx_pass") && safeCfg["erx_pass"].is_string() && !safeCfg["erx_pass"].get<std::string>().empty()) {
                safeCfg["erx_pass"] = "********";
            }
            res.set_content(json({{"status", "success"}, {"config", safeCfg}}).dump(2), "application/json; charset=utf-8");
        });

        svr.Post("/api/network/config", [this](const httplib::Request& req, httplib::Response& res) {
            if (!requireModuleLicensed(res)) return;
            try {
                json body = json::parse(req.body);
                {
                    std::lock_guard<std::mutex> lk(m_mtx);
                    for (auto it = body.begin(); it != body.end(); ++it) {
                        if (it.key() == "password" || it.key() == "erx_pass") {
                            std::string pw = it.value().is_string() ? it.value().get<std::string>() : "";
                            std::string existingPw = m_cfg.value(it.key(), "");
                            if (pw == "********" || (pw.empty() && !existingPw.empty())) continue;
                        }
                        m_cfg[it.key()] = it.value();
                    }
                    m_unifiLastLoginEpoch = 0;
                }
                saveConfig();
                res.set_content(json({{"status", "success"}, {"message", "Đã lưu cấu hình WiFi Marketing & Router QoS!"}}).dump(2), "application/json; charset=utf-8");
            } catch (const std::exception& e) {
                res.status = 400;
                res.set_content(json({{"status", "error"}, {"message", e.what()}}).dump(2), "application/json; charset=utf-8");
            }
        });

        svr.Post("/api/network/whitelist", [this](const httplib::Request& req, httplib::Response& res) {
            if (!requireModuleLicensed(res)) return;
            try {
                json body = json::parse(req.body);
                std::string ip = body.value("ip", "");
                std::string mac = toLowerCopy(body.value("mac", ""));
                if (ip.empty() && mac.empty()) {
                    res.status = 400;
                    res.set_content("{\"status\":\"error\",\"message\":\"Thiếu IP/MAC thiết bị\"}", "application/json; charset=utf-8");
                    return;
                }
                bool added = false;
                {
                    std::lock_guard<std::mutex> lk(m_mtx);
                    if (!m_cfg.contains("whitelist_ips") || !m_cfg["whitelist_ips"].is_array()) m_cfg["whitelist_ips"] = json::array();
                    if (!m_cfg.contains("whitelist_macs") || !m_cfg["whitelist_macs"].is_array()) m_cfg["whitelist_macs"] = json::array();
                    auto& ipArr = m_cfg["whitelist_ips"];
                    auto& macArr = m_cfg["whitelist_macs"];
                    bool hasIp = (!ip.empty() && std::find(ipArr.begin(), ipArr.end(), json(ip)) != ipArr.end());
                    bool hasMac = (!mac.empty() && std::find(macArr.begin(), macArr.end(), json(mac)) != macArr.end());
                    if (hasIp || hasMac) {
                        if (!ip.empty()) ipArr.erase(std::remove(ipArr.begin(), ipArr.end(), json(ip)), ipArr.end());
                        if (!mac.empty()) macArr.erase(std::remove(macArr.begin(), macArr.end(), json(mac)), macArr.end());
                        added = false;
                    } else {
                        if (!ip.empty()) ipArr.push_back(ip);
                        if (!mac.empty()) macArr.push_back(mac);
                        added = true;
                        if (!ip.empty()) m_sessions.erase(ip);
                    }
                }
                saveConfig();

                std::string routerMsg;
                if (added) {
                    // NET-07: Đẩy lệnh thẳng xuống UniFi/Router cấp quyền KHÔNG GIỚI HẠN (525600 phút = 1 năm, down=0/up=0 không bóp tốc độ)
                    applySpeedByRouterType(ip, mac, 525600, 0, 0, false, routerMsg, false, false);
                }
                std::string finalMsg = added
                    ? ("Đã ghim " + (!ip.empty() ? ip : mac) + " vào Nội bộ ∞ (Không giới hạn thời lượng trên Router)" + (routerMsg.empty() ? "" : " — " + routerMsg))
                    : ("Đã bỏ ghim Nội bộ cho " + (!ip.empty() ? ip : mac));
                res.set_content(json({
                    {"status", "success"},
                    {"whitelisted", added},
                    {"message", finalMsg}
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
                            std::string mac = l.value("mac-address", "");
                            bool wl = isWhitelisted(ip, mac);
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
            if (rType == "unifi" || rType == "hybrid_erx_unifi") {
                json devs = json::array();
                std::string errMsg;
                bool okU = fetchUnifiClients(devs, errMsg);
                if (rType == "hybrid_erx_unifi") {
                    // NET-10: Hợp nhất thêm thiết bị LAN dây từ DHCP Lease của EdgeRouter X nếu chưa có trong UniFi
                    json erxDevs = json::array();
                    std::string erxErr;
                    if (fetchEdgeRouterDevices(erxDevs, erxErr)) {
                        std::unordered_map<std::string, bool> seenIp;
                        for (const auto& d : devs) seenIp[d.value("ip", "")] = true;
                        for (auto& ed : erxDevs) {
                            std::string eip = ed.value("ip", "");
                            if (!eip.empty() && !seenIp.count(eip)) {
                                ed["conn_type"] = "LAN Dây (ER-X)";
                                devs.push_back(ed);
                            }
                        }
                    }
                }
                if (okU || !devs.empty()) {
                    res.set_content(json({{"status", "success"}, {"mode", rType}, {"devices", devs}, {"message", devs.empty() ? "Chưa có thiết bị nào đang kết nối." : ""}}).dump(2), "application/json; charset=utf-8");
                } else {
                    res.set_content(json({{"status", "error"}, {"mode", rType}, {"devices", json::array()}, {"message", errMsg}}).dump(2), "application/json; charset=utf-8");
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

        svr.Post("/api/network/isolation/apply", [this](const httplib::Request& req, httplib::Response& res) {
            if (!requireModuleLicensed(res)) return;
            try {
                json body = req.body.empty() ? json::object() : json::parse(req.body);
                bool enabled = body.value("guest_isolation_enabled", m_cfg.value("guest_isolation_enabled", false));
                std::string posIp = body.value("pos_server_ip", m_cfg.value("pos_server_ip", ""));
                int posPort = body.value("pos_server_port", m_cfg.value("pos_server_port", 8501));
                std::string guestSsid = body.value("guest_ssid_name", m_cfg.value("guest_ssid_name", ""));
                bool adminGuard = body.value("admin_ip_guard_enabled", m_cfg.value("admin_ip_guard_enabled", false));
                if (posPort <= 0 || posPort > 65535) posPort = 8501;

                std::string dnsProfile = body.value("dns_filter_profile", m_cfg.value("dns_filter_profile", "off"));
                bool posPriorityQos = body.value("pos_priority_qos", m_cfg.value("pos_priority_qos", false));
                std::string rType, host, user, pass, erxHost, erxUser, erxPass;
                int port = 22, erxPort = 22;
                {
                    std::lock_guard<std::mutex> lk(m_mtx);
                    m_cfg["guest_isolation_enabled"] = enabled;
                    m_cfg["pos_server_ip"] = posIp;
                    m_cfg["pos_server_port"] = posPort;
                    m_cfg["guest_ssid_name"] = guestSsid;
                    m_cfg["admin_ip_guard_enabled"] = adminGuard;
                    m_cfg["dns_filter_profile"] = dnsProfile;
                    m_cfg["pos_priority_qos"] = posPriorityQos;
                    rType = m_cfg.value("router_type", "simulation");
                    host = m_cfg.value("host", "");
                    port = m_cfg.value("port", 22);
                    user = m_cfg.value("username", "admin");
                    pass = m_cfg.value("password", "");
                    erxHost = m_cfg.value("erx_host", host);
                    erxPort = m_cfg.value("erx_port", 22);
                    erxUser = m_cfg.value("erx_user", "admin");
                    erxPass = m_cfg.value("erx_pass", "");
                }
                saveConfig();

                if (enabled && (posIp.empty() || !isSafeHostOrIp(posIp))) {
                    res.status = 400;
                    res.set_content(json({{"status", "error"}, {"message", "Vui lòng nhập IP Máy Chủ POS hợp lệ (VD: 172.16.38.119) để làm ngoại lệ duy nhất!"}}).dump(2), "application/json; charset=utf-8");
                    return;
                }

                if (rType == "unifi" || rType == "hybrid_erx_unifi") {
                    std::string baseUrl, sitePrefix, cookieFile, errOut;
                    if (!unifiLogin(baseUrl, sitePrefix, cookieFile, errOut, false)) {
                        res.status = 502;
                        res.set_content(json({{"status", "error"}, {"message", errOut}}).dump(2), "application/json; charset=utf-8");
                        return;
                    }
                    std::string csrfHeader;
                    {
                        std::lock_guard<std::mutex> lk(m_mtx);
                        if (!m_unifiCsrf.empty()) csrfHeader = " -H \"X-CSRF-Token: " + escapeCmdArg(m_unifiCsrf) + "\"";
                    }
                    auto putUnifiJson = [&](const std::string& ep, const json& payload, std::string& outResp) -> bool {
                        std::string reqFile = "config/unifi_iso_req.json";
                        fs::create_directories("config");
                        { std::ofstream rf(reqFile, std::ios::binary | std::ios::trunc); rf << payload.dump(); }
                        int rc = 0;
                        std::string cmd = "curl -sk --connect-timeout 5 --max-time 8 -X PUT -b \"" + cookieFile
                            + "\" -H \"Content-Type: application/json\"" + csrfHeader
                            + " --data-binary \"@" + reqFile + "\" \"" + baseUrl + sitePrefix + ep + "\" 2>&1";
                        outResp = execCapture(cmd, &rc);
                        std::error_code ec;
                        fs::remove(reqFile, ec);
                        return (outResp.find("\"ok\"") != std::string::npos || outResp.find("\"rc\":\"ok\"") != std::string::npos);
                    };

                    int rc = 0;
                    bool guestAccessOk = false;
                    int wlanUpdated = 0;
                    std::string detail;
                    // 1. Cấu hình Guest Access Restricted Subnets (chặn 10/8, 172.16/12, 192.168/16; chỉ mở duy nhất posIp/32)
                    std::string gaRaw = execCapture("curl -sk --connect-timeout 5 --max-time 8 -b \"" + cookieFile + "\" \"" + baseUrl + sitePrefix + "/rest/setting/guest_access\"", &rc);
                    json gaParsed = json::parse(gaRaw, nullptr, false);
                    if (!gaParsed.is_discarded() && gaParsed.contains("data") && gaParsed["data"].is_array() && !gaParsed["data"].empty()) {
                        json gaObj = gaParsed["data"][0];
                        std::string gaId = gaObj.value("_id", "");
                        if (!gaId.empty()) {
                            json putBody = {
                                {"restricted_subnet_1", enabled ? "192.168.0.0/16" : ""},
                                {"restricted_subnet_2", enabled ? "172.16.0.0/12" : ""},
                                {"restricted_subnet_3", enabled ? "10.0.0.0/8" : ""},
                                {"allowed_subnet_1", enabled ? (posIp + "/32") : ""}
                            };
                            std::string resp1;
                            guestAccessOk = putUnifiJson("/rest/setting/guest_access/" + gaId, putBody, resp1);
                            if (!guestAccessOk) detail = trimErrLine(resp1).substr(0, 120);
                        }
                    }
                    // 2. Bật/Tắt L2 Client Isolation trên SSID khách
                    std::string wlanRaw = execCapture("curl -sk --connect-timeout 5 --max-time 8 -b \"" + cookieFile + "\" \"" + baseUrl + sitePrefix + "/rest/wlanconf\"", &rc);
                    json wParsed = json::parse(wlanRaw, nullptr, false);
                    if (!wParsed.is_discarded() && wParsed.contains("data") && wParsed["data"].is_array()) {
                        for (const auto& w : wParsed["data"]) {
                            if (!w.is_object()) continue;
                            std::string wid = w.value("_id", "");
                            std::string wname = w.value("name", "");
                            bool isGuestWlan = w.value("is_guest", false);
                            bool matchSsid = (!guestSsid.empty() && toLowerCopy(wname) == toLowerCopy(guestSsid));
                            if (!wid.empty() && (matchSsid || (guestSsid.empty() && isGuestWlan))) {
                                std::string wResp;
                                if (putUnifiJson("/rest/wlanconf/" + wid, json({{"l2_isolation", enabled}}), wResp)) {
                                    wlanUpdated++;
                                }
                            }
                        }
                    }
                    std::string erxNote;
                    if (rType == "hybrid_erx_unifi" && isSafeHostOrIp(erxHost)) {
                        std::string dnsIp = (dnsProfile == "family") ? "1.1.1.3" : (dnsProfile == "malware" ? "1.1.1.2" : (dnsProfile == "adguard" ? "94.140.14.14" : ""));
                        std::string eScript = "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper begin && ";
                        if (enabled) {
                            eScript += "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN default-action accept && "
                                       "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 10 action accept && "
                                       "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 10 protocol tcp && "
                                       "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 10 destination address " + posIp + " && "
                                       "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 10 destination port " + std::to_string(posPort) + " && "
                                       "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 30 action drop && "
                                       "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 30 destination address 172.16.0.0/12 && "
                                       "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 31 action drop && "
                                       "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 31 destination address 192.168.0.0/16 && "
                                       "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 32 action drop && "
                                       "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 32 destination address 10.0.0.0/8 && ";
                        }
                        if (!dnsIp.empty()) {
                            eScript += "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set service dns forwarding name-server " + dnsIp + " && ";
                        }
                        if (posPriorityQos) {
                            eScript += "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set traffic-control smart-queue CBNX_POS_QOS wan-interface eth0 && ";
                        }
                        eScript += "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper commit && /opt/vyatta/sbin/vyatta-cfg-cmd-wrapper save && /opt/vyatta/sbin/vyatta-cfg-cmd-wrapper end";
                        int rcErx = -1;
                        std::string erxOut = execEdgeRouterSsh(erxHost, erxPort, erxUser, erxPass, eScript, &rcErx);
                        erxNote = (rcErx == 0) ? " | EdgeRouter X: Đã nạp Firewall L3/L4 + DNS/QoS thành công!" : (" | EdgeRouter X lỗi SSH: " + trimErrLine(erxOut).substr(0, 80));
                    }
                    std::string msg = enabled
                        ? ("Đã áp dụng Cô Lập LAN Khách trên UniFi: chặn RFC1918, chỉ mở POS " + posIp + "/32" + (wlanUpdated > 0 ? (" + L2 Isolation (" + std::to_string(wlanUpdated) + " SSID)") : "") + (adminGuard ? " + Khóa Admin Lớp 3" : "") + erxNote)
                        : ("Đã tắt chính sách Cô Lập LAN Khách trên UniFi." + erxNote);
                    res.status = guestAccessOk ? 200 : 502;
                    res.set_content(json({
                        {"status", guestAccessOk ? "success" : "error"},
                        {"guest_access_ok", guestAccessOk},
                        {"wlan_l2_updated", wlanUpdated},
                        {"message", guestAccessOk ? msg : ("Không thể cập nhật Guest Access trên UniFi: " + detail)}
                    }).dump(2), "application/json; charset=utf-8");
                    return;
                }

                if (rType == "edgerouter") {
                    std::string script = enabled
                        ? ("/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper begin && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN default-action accept && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 10 action accept && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 10 protocol tcp && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 10 destination address " + posIp + " && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 10 destination port " + std::to_string(posPort) + " && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 30 action drop && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 30 destination address 172.16.0.0/12 && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 31 action drop && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 31 destination address 192.168.0.0/16 && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 32 action drop && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper set firewall name GUEST_IN rule 32 destination address 10.0.0.0/8 && "
                           "/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper commit && /opt/vyatta/sbin/vyatta-cfg-cmd-wrapper save && /opt/vyatta/sbin/vyatta-cfg-cmd-wrapper end")
                        : ("/opt/vyatta/sbin/vyatta-cfg-cmd-wrapper begin && /opt/vyatta/sbin/vyatta-cfg-cmd-wrapper delete firewall name GUEST_IN && /opt/vyatta/sbin/vyatta-cfg-cmd-wrapper commit && /opt/vyatta/sbin/vyatta-cfg-cmd-wrapper save && /opt/vyatta/sbin/vyatta-cfg-cmd-wrapper end");
                    int rc = -1;
                    std::string out = execEdgeRouterSsh(host, port, user, pass, script, &rc);
                    res.status = (rc == 0) ? 200 : 502;
                    res.set_content(json({
                        {"status", (rc == 0) ? "success" : "error"},
                        {"message", (rc == 0)
                            ? ("Đã nạp bộ luật Firewall GUEST_IN lên EdgeRouter (" + host + ") — chỉ mở " + posIp + ":" + std::to_string(posPort) + ", chặn toàn bộ LAN khác!")
                            : ("EdgeRouter SSH lỗi: " + trimErrLine(out))}
                    }).dump(2), "application/json; charset=utf-8");
                    return;
                }

                res.set_content(json({
                    {"status", "success"},
                    {"message", "Đã lưu chính sách Cô Lập Mạng Khách (Máy Chủ POS: " + posIp + ":" + std::to_string(posPort) + ", Khóa Cổng Admin Lớp 3: " + std::string(adminGuard ? "BẬT" : "TẮT") + ")."}
                }).dump(2), "application/json; charset=utf-8");
            } catch (const std::exception& e) {
                res.status = 400;
                res.set_content(json({{"status", "error"}, {"message", e.what()}}).dump(2), "application/json; charset=utf-8");
            }
        });

        // NET-12: Network NOC Health & Telemetry (UniFi APs + EdgeRouter X + Top Heavy Clients + VLAN Guide)
        svr.Get("/api/network/noc", [this](const httplib::Request&, httplib::Response& res) {
            if (!requireModuleLicensed(res)) return;
            std::string rType, erxHost, erxUser, erxPass;
            int erxPort = 22;
            {
                std::lock_guard<std::mutex> lk(m_mtx);
                rType = m_cfg.value("router_type", "simulation");
                erxHost = m_cfg.value("erx_host", m_cfg.value("host", "172.16.0.1"));
                erxPort = m_cfg.value("erx_port", 22);
                erxUser = m_cfg.value("erx_user", "admin");
                erxPass = m_cfg.value("erx_pass", "");
            }
            json aps = json::array();
            json topClients = json::array();
            std::string unifiNote;
            if (rType == "unifi" || rType == "hybrid_erx_unifi") {
                std::string baseUrl, sitePrefix, cookieFile, errOut;
                if (unifiLogin(baseUrl, sitePrefix, cookieFile, errOut, false)) {
                    int rc = 0;
                    std::string devRaw = execCapture("curl -sk --connect-timeout 4 --max-time 6 -b \"" + cookieFile + "\" \"" + baseUrl + sitePrefix + "/stat/device\"", &rc);
                    json dp = json::parse(devRaw, nullptr, false);
                    if (!dp.is_discarded() && dp.contains("data") && dp["data"].is_array()) {
                        for (const auto& d : dp["data"]) {
                            if (!d.is_object()) continue;
                            int stNum = d.value("state", 0);
                            int staNum = d.value("num_sta", 0);
                            bool isUp = (stNum == 1 || staNum > 0 || d.value("adopted", false));
                            aps.push_back({
                                {"name", d.value("name", d.value("model", "UniFi AP"))},
                                {"model", d.value("model", "")},
                                {"ip", d.value("ip", "")},
                                {"online", isUp},
                                {"num_sta", staNum},
                                {"uptime", d.value("uptime", int64_t(0))}
                            });
                        }
                    }
                    json clients = json::array();
                    std::string cerr;
                    if (fetchUnifiClients(clients, cerr)) {
                        std::vector<json> sorted(clients.begin(), clients.end());
                        std::sort(sorted.begin(), sorted.end(), [](const json& a, const json& b) {
                            return a.value("total_mb", 0.0) > b.value("total_mb", 0.0);
                        });
                        for (size_t i = 0; i < std::min<size_t>(5, sorted.size()); ++i) topClients.push_back(sorted[i]);
                    }
                } else {
                    unifiNote = errOut;
                }
            }
            json erxStatus = {{"configured", (rType == "edgerouter" || rType == "hybrid_erx_unifi")}, {"online", false}, {"summary", ""}};
            if ((rType == "edgerouter" || rType == "hybrid_erx_unifi") && isSafeHostOrIp(erxHost)) {
                int rc = -1;
                std::string up = execEdgeRouterSsh(erxHost, erxPort, erxUser, erxPass, "uptime", &rc);
                erxStatus["online"] = (rc == 0 && !up.empty());
                // Lọc bỏ ASCII MOTD banner Ubiquiti, chỉ lấy dòng chứa 'load average' hoặc ' up '
                std::istringstream iss(up);
                std::string ln, cleanUp;
                while (std::getline(iss, ln)) {
                    if (ln.find("load average") != std::string::npos || ln.find(" up ") != std::string::npos) {
                        cleanUp = trimErrLine(ln);
                    }
                }
                erxStatus["summary"] = cleanUp.empty() ? "Online (SSH OK)" : cleanUp;
            }
            res.set_content(json({
                {"status", "success"},
                {"mode", rType},
                {"unifi_aps", aps},
                {"unifi_note", unifiNote},
                {"edgerouter", erxStatus},
                {"top_clients", topClients},
                {"vlan_guide", "VLAN 10 (Nội bộ POS/Máy in/Camera: 172.16.10.0/24) | VLAN 20 (WiFi Khách: 172.16.20.0/24 — GUEST_IN chỉ mở TCP POS:8501, chặn RFC1918 & ép DNS sạch 1.1.1.3)"}
            }).dump(2), "application/json; charset=utf-8");
        });

        svr.Post("/api/network/test-connection", [this](const httplib::Request& req, httplib::Response& res) {
            if (!requireModuleLicensed(res)) return;
            std::string rType, host, user, pass, site;
            int port = 22;
            {
                std::lock_guard<std::mutex> lk(m_mtx);
                rType = m_cfg.value("router_type", "simulation");
                host = m_cfg.value("host", "172.16.0.1");
                port = m_cfg.value("port", 22);
                user = m_cfg.value("username", "admin");
                pass = m_cfg.value("password", "");
                site = m_cfg.value("unifi_site", "default");
            }
            if (!req.body.empty()) {
                try {
                    json body = json::parse(req.body);
                    if (body.is_object()) {
                        if (body.contains("router_type") && body["router_type"].is_string()) rType = body["router_type"].get<std::string>();
                        if (body.contains("host") && body["host"].is_string() && !body["host"].get<std::string>().empty()) host = body["host"].get<std::string>();
                        if (body.contains("port") && body["port"].is_number_integer()) port = body["port"].get<int>();
                        if (body.contains("username") && body["username"].is_string() && !body["username"].get<std::string>().empty()) user = body["username"].get<std::string>();
                        if (body.contains("password") && body["password"].is_string()) {
                            std::string p = body["password"].get<std::string>();
                            if (!p.empty() && p != "********") pass = p;
                        }
                        if (body.contains("unifi_site") && body["unifi_site"].is_string() && !body["unifi_site"].get<std::string>().empty()) site = body["unifi_site"].get<std::string>();
                    }
                } catch (...) {}
            }

            if (rType == "simulation" || rType.empty()) {
                res.set_content(json({
                    {"status", "warning"},
                    {"simulation_mode", true},
                    {"mode", "simulation"},
                    {"latency_ms", 0},
                    {"message", "Đang ở chế độ MÔ PHỎNG — chưa nối Router vật lý. Chọn MikroTik REST / UniFi / EdgeRouter để kiểm tra thiết bị thật."}
                }).dump(2), "application/json; charset=utf-8");
                return;
            }

            auto t0 = std::chrono::steady_clock::now();
            if (rType == "mikrotik") {
                if (!isSafeHostOrIp(host) || port <= 0 || port > 65535) {
                    res.status = 400;
                    res.set_content(json({{"status", "error"}, {"simulation_mode", false}, {"mode", "mikrotik"}, {"message", "Host/Port MikroTik không hợp lệ!"}}).dump(2), "application/json; charset=utf-8");
                    return;
                }
                httplib::Client cli(host, port);
                cli.set_connection_timeout(3, 0);
                cli.set_read_timeout(4, 0);
                cli.set_basic_auth(user, pass);
                auto mRes = cli.Get("/rest/ip/dhcp-server/lease");
                auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
                if (mRes && mRes->status == 200) {
                    size_t leaseCnt = 0;
                    try {
                        json parsed = json::parse(mRes->body);
                        if (parsed.is_array()) leaseCnt = parsed.size();
                    } catch (...) {}
                    res.set_content(json({
                        {"status", "success"},
                        {"simulation_mode", false},
                        {"mode", "mikrotik"},
                        {"latency_ms", ms},
                        {"lease_count", leaseCnt},
                        {"message", "Kết nối MikroTik REST API (" + host + ":" + std::to_string(port) + ") thành công — " + std::to_string(leaseCnt) + " DHCP lease (" + std::to_string(ms) + "ms)."}
                    }).dump(2), "application/json; charset=utf-8");
                    return;
                }
                std::string err = mRes ? ("MikroTik trả mã HTTP " + std::to_string(mRes->status)) : ("Không kết nối được MikroTik REST API (" + host + ":" + std::to_string(port) + ")");
                res.status = 502;
                res.set_content(json({{"status", "error"}, {"simulation_mode", false}, {"mode", "mikrotik"}, {"latency_ms", ms}, {"message", err}}).dump(2), "application/json; charset=utf-8");
                return;
            }

            if (rType == "unifi" || rType == "hybrid_erx_unifi") {
                std::string baseUrl, sitePrefix, cookieFile, errMsg;
                bool okU = unifiLoginWithParams(host, port, user, pass, site, baseUrl, sitePrefix, cookieFile, errMsg);
                auto msU = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
                if (rType == "unifi") {
                    if (okU) {
                        res.set_content(json({{"status", "success"}, {"simulation_mode", false}, {"mode", "unifi"}, {"latency_ms", msU},
                            {"message", "Đăng nhập UniFi Controller (" + host + ":" + std::to_string(port) + ") thành công (" + std::to_string(msU) + "ms)."}}).dump(2), "application/json; charset=utf-8");
                        return;
                    }
                    res.status = 502;
                    res.set_content(json({{"status", "error"}, {"simulation_mode", false}, {"mode", "unifi"}, {"latency_ms", msU}, {"message", errMsg}}).dump(2), "application/json; charset=utf-8");
                    return;
                }
                // Hybrid Dual-Plane: test song song UniFi OS Server + EdgeRouter X SSH
                std::string erxH, erxU, erxP;
                int erxPt = 22;
                {
                    std::lock_guard<std::mutex> lk(m_mtx);
                    erxH = m_cfg.value("erx_host", "172.16.0.1");
                    erxPt = m_cfg.value("erx_port", 22);
                    erxU = m_cfg.value("erx_user", "admin");
                    erxP = m_cfg.value("erx_pass", "");
                }
                int rcE = -1;
                std::string outE = execEdgeRouterSsh(erxH, erxPt, erxU, erxP, "echo CBNX_OK", &rcE);
                bool okE = (rcE == 0 && outE.find("CBNX_OK") != std::string::npos);
                std::string msg = std::string("Hybrid Dual-Plane — UniFi (") + host + ":" + std::to_string(port) + "): " + (okU ? ("OK " + std::to_string(msU) + "ms") : ("LỖI: " + errMsg))
                    + " | EdgeRouter X (" + erxH + ":" + std::to_string(erxPt) + "): " + (okE ? "OK" : ("LỖI: " + trimErrLine(outE)));
                res.status = (okU && okE) ? 200 : (okU || okE ? 200 : 502);
                res.set_content(json({
                    {"status", (okU && okE) ? "success" : ((okU || okE) ? "warning" : "error")},
                    {"simulation_mode", false},
                    {"mode", "hybrid_erx_unifi"},
                    {"unifi_ok", okU},
                    {"edgerouter_ok", okE},
                    {"message", msg}
                }).dump(2), "application/json; charset=utf-8");
                return;
            }

            if (rType == "edgerouter") {
                if (!isSafeHostOrIp(host) || !isSafeHostOrIp(user) || port <= 0 || port > 65535) {
                    res.status = 400;
                    res.set_content(json({{"status", "error"}, {"simulation_mode", false}, {"mode", "edgerouter"}, {"message", "Host/User/Port EdgeRouter không hợp lệ!"}}).dump(2), "application/json; charset=utf-8");
                    return;
                }
                int rc = -1;
                std::string out = execEdgeRouterSsh(host, port, user, pass, "echo CBNX_OK", &rc);
                auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
                if (rc == 0 && out.find("CBNX_OK") != std::string::npos) {
                    res.set_content(json({
                        {"status", "success"},
                        {"simulation_mode", false},
                        {"mode", "edgerouter"},
                        {"latency_ms", ms},
                        {"message", "Kết nối EdgeRouter SSH (" + host + ":" + std::to_string(port) + ") thành công (" + std::to_string(ms) + "ms)."}
                    }).dump(2), "application/json; charset=utf-8");
                    return;
                }
                std::string detail = trimErrLine(out);
                res.status = 502;
                res.set_content(json({
                    {"status", "error"},
                    {"simulation_mode", false},
                    {"mode", "edgerouter"},
                    {"latency_ms", ms},
                    {"message", "EdgeRouter SSH thất bại (" + host + ":" + std::to_string(port) + ")" + (detail.empty() ? "" : ": " + detail)}
                }).dump(2), "application/json; charset=utf-8");
                return;
            }

            res.status = 400;
            res.set_content(json({{"status", "error"}, {"message", "Loại Router không được hỗ trợ: " + rType}}).dump(2), "application/json; charset=utf-8");
        });

        // ARCH-08: Serve WiFi Portal Add-on JS directly from signed C++ DLL
        svr.Get("/assets/js/wifi_portal.js", [](const httplib::Request&, httplib::Response& res) {
            res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            res.set_content(CyberNexusEmbeddedAssets::get_wifi_portal_js(), "application/javascript; charset=utf-8");
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
        } else if (eventType == "IPS_ABNORMAL_TRAFFIC") {
            // NET-13 & ANTISPAM-07: Tự động phản ứng leo thang từ Smart IPS (kick bậc 2 / ban bậc 3)
            std::string ip = eventPayload.value("ip", "");
            std::string act = eventPayload.value("action", "kick");
            std::string reason = eventPayload.value("reason", "IPS Auto-Defense");
            if (!ip.empty() && !isWhitelisted(ip)) {
                std::string outMsg;
                startSessionForIp(ip, "", (act == "ban" ? "ban" : "kick"), "IPS_AUTO", 0, &outMsg);
                std::cout << "[mod_network_qos][IPS] " << act << " IP=" << ip << " (" << reason << ") -> " << outMsg << std::endl;
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
