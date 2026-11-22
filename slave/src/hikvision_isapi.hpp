#pragma once

#include "httplib.h"
#include "nlohmann/json.hpp"
#include <algorithm>
#include <array>
#include <cctype>
#include <cstdint>
#include <cstring>
#include <iomanip>
#include <random>
#include <sstream>
#include <string>

namespace SaleApp::Hikvision {

using json = nlohmann::json;

namespace detail {

inline std::string md5Hex(const std::string& input) {
    static const uint32_t K[64] = {
        0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
        0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
        0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
        0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
        0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
        0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
        0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
        0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391
    };
    static const uint32_t R[64] = {
        7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
        5, 9,14,20,5, 9,14,20,5, 9,14,20,5, 9,14,20,
        4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
        6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21
    };
    std::vector<uint8_t> msg(input.begin(), input.end());
    uint64_t bitLen = static_cast<uint64_t>(msg.size()) * 8ULL;
    msg.push_back(0x80);
    while ((msg.size() % 64) != 56) msg.push_back(0x00);
    for (int i = 0; i < 8; ++i) msg.push_back(static_cast<uint8_t>((bitLen >> (8 * i)) & 0xFF));

    uint32_t h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476;
    auto rotl = [](uint32_t x, uint32_t c) { return (x << c) | (x >> (32 - c)); };

    for (size_t offset = 0; offset < msg.size(); offset += 64) {
        uint32_t w[16]{};
        for (int i = 0; i < 16; ++i) {
            size_t j = offset + static_cast<size_t>(i) * 4;
            w[i] = static_cast<uint32_t>(msg[j]) |
                   (static_cast<uint32_t>(msg[j + 1]) << 8) |
                   (static_cast<uint32_t>(msg[j + 2]) << 16) |
                   (static_cast<uint32_t>(msg[j + 3]) << 24);
        }
        uint32_t a = h0, b = h1, c = h2, d = h3;
        for (int i = 0; i < 64; ++i) {
            uint32_t f = 0, g = 0;
            if (i < 16) { f = (b & c) | ((~b) & d); g = i; }
            else if (i < 32) { f = (d & b) | ((~d) & c); g = (5 * i + 1) % 16; }
            else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
            else { f = c ^ (b | (~d)); g = (7 * i) % 16; }
            uint32_t tmp = d;
            d = c; c = b;
            b = b + rotl(a + f + K[i] + w[g], R[i]);
            a = tmp;
        }
        h0 += a; h1 += b; h2 += c; h3 += d;
    }

    uint32_t digest[4] = {h0, h1, h2, h3};
    std::ostringstream oss;
    oss << std::hex << std::setfill('0');
    for (uint32_t word : digest) {
        for (int i = 0; i < 4; ++i) {
            oss << std::setw(2) << ((word >> (8 * i)) & 0xFF);
        }
    }
    return oss.str();
}

inline std::string extractAttr(const std::string& header, const std::string& key) {
    std::string pattern1 = key + "=\"";
    size_t pos = header.find(pattern1);
    if (pos != std::string::npos) {
        size_t s = pos + pattern1.size();
        size_t e = header.find('"', s);
        if (e != std::string::npos) return header.substr(s, e - s);
    }
    std::string pattern2 = key + "=";
    pos = header.find(pattern2);
    if (pos != std::string::npos) {
        size_t s = pos + pattern2.size();
        size_t e = header.find_first_of(", ", s);
        return (e == std::string::npos) ? header.substr(s) : header.substr(s, e - s);
    }
    return "";
}

inline std::string extractXmlTag(const std::string& xml, const std::string& tag) {
    std::string openT = "<" + tag + ">";
    std::string closeT = "</" + tag + ">";
    size_t s = xml.find(openT);
    if (s == std::string::npos) return "";
    s += openT.size();
    size_t e = xml.find(closeT, s);
    if (e == std::string::npos) return "";
    return xml.substr(s, e - s);
}

inline std::string makeCnonce() {
    static const char HEX[] = "0123456789abcdef";
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<int> d(0, 15);
    std::string out;
    for (int i = 0; i < 16; ++i) out += HEX[d(gen)];
    return out;
}

} // namespace detail

class IsapiClient {
public:
    static bool request(const std::string& host,
                        int port,
                        const std::string& username,
                        const std::string& password,
                        const std::string& method,
                        const std::string& path,
                        const std::string& body,
                        const std::string& contentType,
                        int& statusOut,
                        std::string& respBodyOut,
                        std::string& errOut) {
        statusOut = 0;
        respBodyOut.clear();
        if (host.empty() || port <= 0) {
            errOut = "Thiếu địa chỉ IP hoặc Port thiết bị Hikvision!";
            return false;
        }
        httplib::Client cli(host, port);
        cli.set_connection_timeout(4, 0);
        cli.set_read_timeout(6, 0);

        auto sendOnce = [&](const httplib::Headers& hdrs) -> httplib::Result {
            if (method == "GET") return cli.Get(path, hdrs);
            if (method == "PUT") return cli.Put(path, hdrs, body, contentType);
            return cli.Post(path, hdrs, body, contentType);
        };

        auto res1 = sendOnce({});
        if (!res1) {
            errOut = "Không thể kết nối tới Hikvision tại " + host + ":" + std::to_string(port);
            return false;
        }
        if (res1->status != 401) {
            statusOut = res1->status;
            respBodyOut = res1->body;
            return true;
        }

        std::string wwwAuth = res1->get_header_value("WWW-Authenticate");
        if (wwwAuth.empty()) wwwAuth = res1->get_header_value("www-authenticate");
        std::string lowAuth = wwwAuth;
        std::transform(lowAuth.begin(), lowAuth.end(), lowAuth.begin(), ::tolower);
        if (lowAuth.find("digest") == std::string::npos) {
            // Try Basic auth fallback if device challenges Basic
            httplib::Client cliBasic(host, port);
            cliBasic.set_connection_timeout(4, 0);
            cliBasic.set_read_timeout(6, 0);
            cliBasic.set_basic_auth(username, password);
            auto rBasic = (method == "GET") ? cliBasic.Get(path) : ((method == "PUT") ? cliBasic.Put(path, body, contentType) : cliBasic.Post(path, body, contentType));
            if (!rBasic) { errOut = "Digest/Basic auth connection error"; return false; }
            statusOut = rBasic->status;
            respBodyOut = rBasic->body;
            return true;
        }

        std::string realm = detail::extractAttr(wwwAuth, "realm");
        std::string nonce = detail::extractAttr(wwwAuth, "nonce");
        std::string qop   = detail::extractAttr(wwwAuth, "qop");
        std::string opaque = detail::extractAttr(wwwAuth, "opaque");
        std::string cnonce = detail::makeCnonce();
        std::string nc = "00000001";

        std::string ha1 = detail::md5Hex(username + ":" + realm + ":" + password);
        std::string ha2 = detail::md5Hex(method + ":" + path);
        std::string responseHex;
        bool useAuthQop = (qop.find("auth") != std::string::npos);
        if (useAuthQop) {
            responseHex = detail::md5Hex(ha1 + ":" + nonce + ":" + nc + ":" + cnonce + ":auth:" + ha2);
        } else {
            responseHex = detail::md5Hex(ha1 + ":" + nonce + ":" + ha2);
        }

        std::ostringstream authHdr;
        authHdr << "Digest username=\"" << username << "\", realm=\"" << realm
                << "\", nonce=\"" << nonce << "\", uri=\"" << path << "\"";
        if (useAuthQop) {
            authHdr << ", qop=auth, nc=" << nc << ", cnonce=\"" << cnonce << "\"";
        }
        if (!opaque.empty()) {
            authHdr << ", opaque=\"" << opaque << "\"";
        }
        authHdr << ", response=\"" << responseHex << "\"";

        auto res2 = sendOnce({{"Authorization", authHdr.str()}});
        if (!res2) {
            errOut = "Mất kết nối khi xác thực Digest với Hikvision!";
            return false;
        }
        statusOut = res2->status;
        respBodyOut = res2->body;
        if (statusOut == 401) {
            errOut = "Sai tên đăng nhập hoặc mật khẩu thiết bị Hikvision (HTTP 401 Digest)!";
            return false;
        }
        return true;
    }

    static bool testDeviceInfo(const std::string& host,
                               int port,
                               const std::string& user,
                               const std::string& pass,
                               json& infoOut,
                               std::string& errOut) {
        int st = 0;
        std::string resp;
        if (!request(host, port, user, pass, "GET", "/ISAPI/System/deviceInfo", "", "application/xml", st, resp, errOut)) {
            return false;
        }
        if (st < 200 || st >= 300) {
            errOut = "Hikvision trả mã HTTP " + std::to_string(st);
            return false;
        }
        json parsed = json::parse(resp, nullptr, false);
        if (parsed.is_object()) {
            infoOut = parsed.contains("DeviceInfo") ? parsed["DeviceInfo"] : parsed;
        } else {
            infoOut = {
                {"deviceName", detail::extractXmlTag(resp, "deviceName")},
                {"model", detail::extractXmlTag(resp, "model")},
                {"serialNumber", detail::extractXmlTag(resp, "serialNumber")},
                {"firmwareVersion", detail::extractXmlTag(resp, "firmwareVersion")},
                {"macAddress", detail::extractXmlTag(resp, "macAddress")}
            };
        }
        if (infoOut.value("model", "").empty()) infoOut["model"] = "DS-K1T343MX";
        return true;
    }

    static bool syncUserToDevice(const std::string& host,
                                 int port,
                                 const std::string& user,
                                 const std::string& pass,
                                 const std::string& empNo,
                                 const std::string& fullName,
                                 std::string& errOut) {
        json payload = {
            {"UserInfo", {
                {"employeeNo", empNo},
                {"name", fullName},
                {"userType", "normal"},
                {"Valid", {
                    {"enable", true},
                    {"beginTime", "2024-01-01T00:00:00"},
                    {"endTime", "2035-12-31T23:59:59"}
                }},
                {"doorRight", "1"},
                {"RightPlan", json::array({{{"doorNo", 1}, {"planTemplateNo", "1"}}})}
            }}
        };
        int st = 0;
        std::string resp;
        if (!request(host, port, user, pass, "PUT", "/ISAPI/AccessControl/UserInfo/SetUp?format=json",
                     payload.dump(), "application/json", st, resp, errOut)) {
            return false;
        }
        if (st >= 200 && st < 300) return true;
        // Fallback to /Record for older firmware
        if (!request(host, port, user, pass, "POST", "/ISAPI/AccessControl/UserInfo/Record?format=json",
                     payload.dump(), "application/json", st, resp, errOut)) {
            return false;
        }
        if (st >= 200 && st < 300) return true;
        errOut = "Đồng bộ User " + empNo + " thất bại (HTTP " + std::to_string(st) + ")";
        return false;
    }

    static bool pullAcsEvents(const std::string& host,
                              int port,
                              const std::string& user,
                              const std::string& pass,
                              const std::string& startIso,
                              const std::string& endIso,
                              json& eventsOut,
                              std::string& errOut) {
        eventsOut = json::array();
        json cond = {
            {"AcsEventCond", {
                {"searchID", "cbnx_poll_1"},
                {"searchResultPosition", 0},
                {"maxResults", 100},
                {"major", 5},
                {"minor", 0},
                {"startTime", startIso},
                {"endTime", endIso}
            }}
        };
        int st = 0;
        std::string resp;
        if (!request(host, port, user, pass, "POST", "/ISAPI/AccessControl/AcsEvent?format=json",
                     cond.dump(), "application/json", st, resp, errOut)) {
            return false;
        }
        if (st < 200 || st >= 300) {
            errOut = "AcsEvent trả HTTP " + std::to_string(st);
            return false;
        }
        json j = json::parse(resp, nullptr, false);
        if (j.is_object() && j.contains("AcsEvent") && j["AcsEvent"].contains("InfoList") && j["AcsEvent"]["InfoList"].is_array()) {
            eventsOut = j["AcsEvent"]["InfoList"];
        }
        return true;
    }

    static bool parseIncomingEvent(const httplib::Request& req, json& evtOut, std::string& pictureBytesOut) {
        evtOut = json::object();
        pictureBytesOut.clear();
        // Multipart upload from Hikvision HTTP Listening Host (AccessControllerEvent JSON + optional Picture image)
        if (!req.files.empty()) {
            for (const auto& kv : req.files) {
                const auto& f = kv.second;
                if (f.content_type.find("json") != std::string::npos ||
                    kv.first.find("Event") != std::string::npos ||
                    kv.first.find("event") != std::string::npos ||
                    kv.first.find("json") != std::string::npos ||
                    (!f.content.empty() && f.content[0] == '{')) {
                    json p = json::parse(f.content, nullptr, false);
                    if (p.is_object()) evtOut = p;
                } else if (f.content_type.find("image") != std::string::npos ||
                           kv.first.find("Picture") != std::string::npos ||
                           kv.first.find("picture") != std::string::npos ||
                           kv.first.find("image") != std::string::npos) {
                    pictureBytesOut = f.content;
                }
            }
        }
        if (evtOut.empty() && !req.body.empty()) {
            json p = json::parse(req.body, nullptr, false);
            if (p.is_object()) evtOut = p;
        }
        if (evtOut.contains("AccessControllerEvent") && evtOut["AccessControllerEvent"].is_object()) {
            json inner = evtOut["AccessControllerEvent"];
            if (!inner.contains("dateTime") && evtOut.contains("dateTime")) {
                inner["dateTime"] = evtOut["dateTime"];
            }
            evtOut = inner;
        }
        return !evtOut.empty();
    }
};

} // namespace SaleApp::Hikvision
