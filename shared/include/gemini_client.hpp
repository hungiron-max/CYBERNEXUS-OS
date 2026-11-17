#pragma once

#include <string>
#include <vector>
#include <algorithm>
#include <cmath>
#include <cctype>
#include <mutex>
#include <unordered_map>
#include <chrono>
#include <nlohmann/json.hpp>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <winhttp.h>
#pragma comment(lib, "winhttp.lib")
#endif

namespace SaleApp::AI {

using json = nlohmann::json;

inline std::string base64Decode(const std::string& in) {
    static const int T[256] = {
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
        52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
        -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
        15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
        -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
        41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
    };
    std::string out;
    int val = 0, valb = -8;
    for (unsigned char c : in) {
        if (T[c] == -1) continue;
        val = (val << 6) + T[c];
        valb += 6;
        if (valb >= 0) {
            out.push_back(static_cast<char>((val >> valb) & 0xFF));
            valb -= 8;
        }
    }
    return out;
}

inline void parseDataUriImage(const std::string& input, std::string& outMime, std::string& outBase64) {
    outMime = "image/jpeg";
    outBase64 = input;
    auto comma = input.find(',');
    if (input.rfind("data:", 0) == 0 && comma != std::string::npos) {
        std::string header = input.substr(5, comma - 5);
        auto semi = header.find(';');
        std::string mime = (semi != std::string::npos) ? header.substr(0, semi) : header;
        if (!mime.empty()) outMime = mime;
        outBase64 = input.substr(comma + 1);
    }
}

inline bool winHttpRequest(const std::string& host, int port, bool useHttps,
                           const std::string& path, const std::string& method,
                           const std::string& bodyUtf8, int& statusOut,
                           std::string& respOut, std::string& errOut) {
#ifdef _WIN32
    statusOut = 0;
    respOut.clear();
    auto toWide = [](const std::string& s) -> std::wstring {
        if (s.empty()) return L"";
        int len = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), nullptr, 0);
        std::wstring ws(len, L'\0');
        MultiByteToWideChar(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), &ws[0], len);
        return ws;
    };
    HINTERNET hSession = WinHttpOpen(L"CyberNexus-AI/2.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (!hSession) { errOut = "WinHttpOpen failed"; return false; }
    WinHttpSetTimeouts(hSession, 10000, 15000, 60000, 90000);

    std::wstring wHost = toWide(host);
    HINTERNET hConnect = WinHttpConnect(hSession, wHost.c_str(), static_cast<INTERNET_PORT>(port), 0);
    if (!hConnect) {
        errOut = "WinHttpConnect failed";
        WinHttpCloseHandle(hSession);
        return false;
    }

    std::wstring wMethod = toWide(method);
    std::wstring wPath = toWide(path);
    DWORD flags = useHttps ? WINHTTP_FLAG_SECURE : 0;
    HINTERNET hReq = WinHttpOpenRequest(hConnect, wMethod.c_str(), wPath.c_str(), nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, flags);
    if (!hReq) {
        errOut = "WinHttpOpenRequest failed";
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        return false;
    }

    const wchar_t* hdr = L"Content-Type: application/json; charset=utf-8\r\n";
    BOOL sent = WinHttpSendRequest(
        hReq,
        hdr,
        static_cast<DWORD>(-1L),
        bodyUtf8.empty() ? WINHTTP_NO_REQUEST_DATA : const_cast<char*>(bodyUtf8.data()),
        static_cast<DWORD>(bodyUtf8.size()),
        static_cast<DWORD>(bodyUtf8.size()),
        0
    );
    if (!sent || !WinHttpReceiveResponse(hReq, nullptr)) {
        errOut = "Không thể kết nối HTTP/HTTPS (WinHTTP error " + std::to_string(GetLastError()) + ")";
        WinHttpCloseHandle(hReq);
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        return false;
    }

    DWORD dwStatus = 0, dwSize = sizeof(dwStatus);
    WinHttpQueryHeaders(hReq, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_HEADER_NAME_BY_INDEX, &dwStatus, &dwSize, WINHTTP_NO_HEADER_INDEX);
    statusOut = static_cast<int>(dwStatus);

    DWORD avail = 0;
    while (WinHttpQueryDataAvailable(hReq, &avail) && avail > 0) {
        std::string chunk(avail, '\0');
        DWORD readBytes = 0;
        if (WinHttpReadData(hReq, &chunk[0], avail, &readBytes) && readBytes > 0) {
            respOut.append(chunk.data(), readBytes);
        } else {
            break;
        }
    }

    WinHttpCloseHandle(hReq);
    WinHttpCloseHandle(hConnect);
    WinHttpCloseHandle(hSession);
    return true;
#else
    errOut = "WinHTTP only supported on Windows";
    return false;
#endif
}

inline bool winHttpUrlPostJson(const std::string& fullUrl, const std::string& bodyUtf8,
                               int& statusOut, std::string& respOut, std::string& errOut) {
    bool useHttps = (fullUrl.rfind("https://", 0) == 0);
    std::string rest = fullUrl;
    if (useHttps) rest = rest.substr(8);
    else if (rest.rfind("http://", 0) == 0) rest = rest.substr(7);

    auto slashPos = rest.find('/');
    std::string hostPort = (slashPos == std::string::npos) ? rest : rest.substr(0, slashPos);
    std::string path = (slashPos == std::string::npos) ? "/" : rest.substr(slashPos);

    int port = useHttps ? 443 : 80;
    std::string host = hostPort;
    auto colonPos = hostPort.rfind(':');
    if (colonPos != std::string::npos) {
        host = hostPort.substr(0, colonPos);
        try { port = std::stoi(hostPort.substr(colonPos + 1)); } catch (...) {}
    }
    return winHttpRequest(host, port, useHttps, path, "POST", bodyUtf8, statusOut, respOut, errOut);
}

inline std::string extractGeminiError(const std::string& rawResp, int status) {
    try {
        json j = json::parse(rawResp);
        if (j.contains("error") && j["error"].contains("message")) {
            return j["error"]["message"].get<std::string>();
        }
    } catch (...) {}
    return "HTTP " + std::to_string(status);
}

struct GeminiModelScore {
    std::string name;
    int major = 0;
    int minor = 0;
    int tierRank = 0; // higher = preferred (flash > pro, stable > preview/exp)
};

inline GeminiModelScore scoreGeminiModel(const std::string& nm) {
    GeminiModelScore s;
    s.name = nm;
    // Parse version numbers right after "gemini-" (e.g. gemini-3.8-flash -> 3, 8; gemini-3-flash -> 3, 0)
    size_t pos = nm.find("gemini-");
    if (pos != std::string::npos) {
        size_t i = pos + 7;
        while (i < nm.size() && std::isdigit(static_cast<unsigned char>(nm[i]))) {
            s.major = s.major * 10 + (nm[i] - '0');
            ++i;
        }
        if (i < nm.size() && nm[i] == '.') {
            ++i;
            while (i < nm.size() && std::isdigit(static_cast<unsigned char>(nm[i]))) {
                s.minor = s.minor * 10 + (nm[i] - '0');
                ++i;
            }
        }
    }
    if (nm.find("flash") != std::string::npos) s.tierRank += 20;
    if (nm.find("3.1-flash-lite") != std::string::npos) s.tierRank += 50;
    if (nm.find("preview") == std::string::npos && nm.find("exp") == std::string::npos) s.tierRank += 10;
    if (nm.find("-latest") != std::string::npos) s.tierRank -= 2;
    return s;
}

inline void resolveGeminiModelsForKey(const std::string& apiKey,
                                        std::vector<std::string>& textModelsOut,
                                        std::vector<std::string>& imageModelsOut) {
    struct CachedModels {
        std::vector<std::string> textModels;
        std::vector<std::string> imageModels;
        std::chrono::steady_clock::time_point fetchedAt;
    };
    static std::mutex cacheMu;
    static std::unordered_map<std::string, CachedModels> cache;

    auto now = std::chrono::steady_clock::now();
    {
        std::lock_guard<std::mutex> lk(cacheMu);
        auto it = cache.find(apiKey);
        if (it != cache.end() && (now - it->second.fetchedAt) < std::chrono::minutes(10)) {
            textModelsOut = it->second.textModels;
            imageModelsOut = it->second.imageModels;
            return;
        }
    }

    std::vector<GeminiModelScore> textScored, imgScored;
    int st = 0;
    std::string resp, errIgnore;
    if (winHttpRequest("generativelanguage.googleapis.com", 443, true, "/v1beta/models?key=" + apiKey, "GET", "", st, resp, errIgnore)
        && st >= 200 && st < 300) {
        try {
            json j = json::parse(resp);
            if (j.contains("models") && j["models"].is_array()) {
                for (const auto& m : j["models"]) {
                    std::string nm = m.value("name", "");
                    if (nm.rfind("models/", 0) == 0) nm = nm.substr(7);
                    if (nm.rfind("gemini-", 0) != 0) continue;

                    bool supportsGen = false;
                    if (m.contains("supportedGenerationMethods") && m["supportedGenerationMethods"].is_array()) {
                        for (const auto& meth : m["supportedGenerationMethods"]) {
                            if (meth.is_string() && meth.get<std::string>() == "generateContent") {
                                supportsGen = true;
                                break;
                            }
                        }
                    }
                    if (!supportsGen) continue;
                    if (nm.find("tts") != std::string::npos || nm.find("audio") != std::string::npos ||
                        nm.find("embedding") != std::string::npos || nm.find("robotics") != std::string::npos ||
                        nm.find("computer-use") != std::string::npos || nm.find("deep-research") != std::string::npos) {
                        continue;
                    }

                    if (nm.find("image") != std::string::npos) {
                        imgScored.push_back(scoreGeminiModel(nm));
                    } else if (nm.find("flash") != std::string::npos || nm.find("pro") != std::string::npos) {
                        textScored.push_back(scoreGeminiModel(nm));
                    }
                }
            }
        } catch (...) {}
    }

    auto cmpScore = [](const GeminiModelScore& a, const GeminiModelScore& b) {
        bool aLite31 = (a.name.find("3.1-flash-lite") != std::string::npos);
        bool bLite31 = (b.name.find("3.1-flash-lite") != std::string::npos);
        if (aLite31 != bLite31) return aLite31;
        if (a.major != b.major) return a.major > b.major;
        if (a.minor != b.minor) return a.minor > b.minor;
        if (a.tierRank != b.tierRank) return a.tierRank > b.tierRank;
        return a.name < b.name;
    };
    std::sort(textScored.begin(), textScored.end(), cmpScore);
    std::sort(imgScored.begin(), imgScored.end(), cmpScore);

    textModelsOut.clear();
    for (const auto& s : textScored) {
        textModelsOut.push_back(s.name);
        if (textModelsOut.size() >= 6) break;
    }
    for (const auto& fb : std::vector<std::string>{"gemini-3.1-flash-lite-preview", "gemini-3.1-flash-lite", "gemini-2.5-flash"}) {
        if (std::find(textModelsOut.begin(), textModelsOut.end(), fb) == textModelsOut.end()) {
            textModelsOut.push_back(fb);
        }
    }

    imageModelsOut.clear();
    for (const auto& s : imgScored) {
        imageModelsOut.push_back(s.name);
        if (imageModelsOut.size() >= 6) break;
    }
    for (const auto& fb : std::vector<std::string>{
             "gemini-3.8-flash-image", "gemini-3.1-flash-image-preview", "gemini-3.1-flash-image",
             "gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"
         }) {
        if (std::find(imageModelsOut.begin(), imageModelsOut.end(), fb) == imageModelsOut.end()) {
            imageModelsOut.push_back(fb);
        }
    }

    if (!textScored.empty() || !imgScored.empty()) {
        std::lock_guard<std::mutex> lk(cacheMu);
        cache[apiKey] = CachedModels{textModelsOut, imageModelsOut, now};
    }
}

inline bool geminiVerifyKey(const std::string& apiKey, int& modelCountOut, std::vector<std::string>& sampleOut, std::string& errOut) {
    if (apiKey.empty()) { errOut = "Chưa nhập Gemini API Key!"; return false; }
    int st = 0;
    std::string resp;
    if (!winHttpRequest("generativelanguage.googleapis.com", 443, true, "/v1beta/models?key=" + apiKey, "GET", "", st, resp, errOut)) {
        return false;
    }
    if (st < 200 || st >= 300) {
        errOut = extractGeminiError(resp, st);
        return false;
    }
    try {
        json j = json::parse(resp);
        if (j.contains("models") && j["models"].is_array()) {
            modelCountOut = static_cast<int>(j["models"].size());
            std::vector<GeminiModelScore> scored;
            for (const auto& m : j["models"]) {
                std::string nm = m.value("name", "");
                if (nm.rfind("models/", 0) == 0) nm = nm.substr(7);
                if (nm.rfind("gemini-", 0) == 0) {
                    scored.push_back(scoreGeminiModel(nm));
                }
            }
            std::sort(scored.begin(), scored.end(), [](const GeminiModelScore& a, const GeminiModelScore& b) {
                if (a.major != b.major) return a.major > b.major;
                if (a.minor != b.minor) return a.minor > b.minor;
                return a.tierRank > b.tierRank;
            });
            sampleOut.clear();
            for (const auto& s : scored) {
                sampleOut.push_back(s.name);
                if (sampleOut.size() >= 5) break;
            }
            return true;
        }
    } catch (...) {}
    errOut = "Phản hồi không hợp lệ từ Google Gemini";
    return false;
}

inline bool geminiGenerateContentText(const std::string& apiKey, const json& contentsJson, bool jsonMode,
                                      std::string& textOut, std::string& modelUsedOut, std::string& errOut) {
    std::vector<std::string> models, imgUnused;
    resolveGeminiModelsForKey(apiKey, models, imgUnused);
    json reqPayload = {{"contents", contentsJson}};
    if (jsonMode) {
        reqPayload["generationConfig"] = {{"responseMimeType", "application/json"}};
    }
    std::string bodyStr = reqPayload.dump();
    std::string primaryErr;
    for (const auto& mdl : models) {
        int st = 0;
        std::string resp;
        if (!winHttpRequest("generativelanguage.googleapis.com", 443, true,
                            "/v1beta/models/" + mdl + ":generateContent?key=" + apiKey,
                            "POST", bodyStr, st, resp, errOut)) {
            return false;
        }
        if (st >= 200 && st < 300) {
            try {
                json j = json::parse(resp);
                auto& parts = j["candidates"][0]["content"]["parts"];
                for (const auto& p : parts) {
                    if (p.contains("text")) {
                        textOut = p["text"].get<std::string>();
                        modelUsedOut = mdl;
                        return true;
                    }
                }
            } catch (...) {}
            if (primaryErr.empty()) primaryErr = "AI không trả về văn bản hợp lệ";
        } else {
            std::string curErr = extractGeminiError(resp, st);
            if (primaryErr.empty() || (st != 404 && primaryErr.find("not found") != std::string::npos)) {
                primaryErr = curErr;
            }
            if (st == 400 || st == 401 || st == 403) {
                errOut = primaryErr;
                return false;
            }
        }
    }
    errOut = primaryErr.empty() ? "Không gọi được model Gemini nào khả dụng." : primaryErr;
    return false;
}

inline bool geminiGenerateImageBase64(const std::string& apiKey, const std::string& prompt,
                                      std::string& outB64, std::string& outMime, std::string& modelUsedOut, std::string& errOut) {
    std::vector<std::string> textUnused, geminiImgModels;
    resolveGeminiModelsForKey(apiKey, textUnused, geminiImgModels);
    std::string primaryErr;
    for (const auto& mdl : geminiImgModels) {
        json reqPayload = {
            {"contents", json::array({{{"parts", json::array({{{"text", prompt}}})}}})},
            {"generationConfig", {{"responseModalities", json::array({"IMAGE", "TEXT"})}}}
        };
        int st = 0;
        std::string resp;
        if (!winHttpRequest("generativelanguage.googleapis.com", 443, true,
                            "/v1beta/models/" + mdl + ":generateContent?key=" + apiKey,
                            "POST", reqPayload.dump(), st, resp, errOut)) {
            return false;
        }
        if (st >= 200 && st < 300) {
            try {
                json j = json::parse(resp);
                auto& parts = j["candidates"][0]["content"]["parts"];
                for (const auto& p : parts) {
                    if (p.contains("inlineData") && p["inlineData"].contains("data")) {
                        outMime = p["inlineData"].value("mimeType", "image/png");
                        outB64 = p["inlineData"]["data"].get<std::string>();
                        modelUsedOut = mdl;
                        if (!outB64.empty()) return true;
                    }
                }
            } catch (...) {}
            if (primaryErr.empty()) primaryErr = "Model " + mdl + " không trả về dữ liệu ảnh.";
        } else {
            std::string curErr = extractGeminiError(resp, st);
            // Keep non-404 errors (e.g. 429 quota/billing) so fallback 404s don't mask the real reason
            if (primaryErr.empty() || (st != 404 && primaryErr.find("not found") != std::string::npos)) {
                primaryErr = curErr;
            }
            if (st == 400 || st == 401 || st == 403) {
                errOut = primaryErr;
                return false;
            }
        }
    }
    errOut = primaryErr.empty() ? "Không có model tạo ảnh Gemini khả dụng cho API Key này." : primaryErr;
    return false;
}

} // namespace SaleApp::AI
