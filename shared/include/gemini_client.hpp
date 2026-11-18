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

inline std::string base64Encode(const std::string& in) {
    static const char* B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    out.reserve(((in.size() + 2) / 3) * 4);
    int val = 0, valb = -6;
    for (unsigned char c : in) {
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0) {
            out.push_back(B64[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    if (valb > -6) out.push_back(B64[((val << 8) >> (valb + 8)) & 0x3F]);
    while (out.size() % 4) out.push_back('=');
    return out;
}

inline std::string urlEncode(const std::string& value) {
    static const char* HEX = "0123456789ABCDEF";
    std::string out;
    out.reserve(value.size() * 2);
    for (unsigned char c : value) {
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
            c == '-' || c == '_' || c == '.' || c == '~') {
            out.push_back(static_cast<char>(c));
        } else {
            out.push_back('%');
            out.push_back(HEX[(c >> 4) & 0x0F]);
            out.push_back(HEX[c & 0x0F]);
        }
    }
    return out;
}

inline std::string detectImageMime(const std::string& bytes) {
    if (bytes.size() >= 4 && static_cast<unsigned char>(bytes[0]) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G') {
        return "image/png";
    }
    if (bytes.size() >= 12 && bytes.substr(0, 4) == "RIFF" && bytes.substr(8, 4) == "WEBP") {
        return "image/webp";
    }
    return "image/jpeg";
}

inline bool winHttpRequestEx(const std::string& host, int port, bool useHttps,
                             const std::string& path, const std::string& method,
                             const std::string& bodyUtf8, const std::string& bearerToken,
                             int& statusOut, std::string& respOut, std::string& errOut) {
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

    std::wstring hdrs = L"Content-Type: application/json; charset=utf-8\r\n";
    if (!bearerToken.empty()) {
        hdrs += L"Authorization: Bearer " + toWide(bearerToken) + L"\r\n";
    }
    BOOL sent = WinHttpSendRequest(
        hReq,
        hdrs.c_str(),
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

inline bool winHttpRequest(const std::string& host, int port, bool useHttps,
                           const std::string& path, const std::string& method,
                           const std::string& bodyUtf8, int& statusOut,
                           std::string& respOut, std::string& errOut) {
    return winHttpRequestEx(host, port, useHttps, path, method, bodyUtf8, "", statusOut, respOut, errOut);
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
    if (nm.find("lite") != std::string::npos) s.tierRank -= 5;
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
    for (const auto& fb : std::vector<std::string>{"gemini-2.5-flash", "gemini-3.1-flash-lite-preview", "gemini-3.1-flash-lite"}) {
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

inline void buildInvoiceOcrPromptAndSchema(const std::string& catalogHint, std::string& promptOut, json& schemaOut) {
    promptOut =
        "Bạn là chuyên gia kế toán kho F&B cho nhà hàng/quán cafe. Hãy đọc thật kỹ ảnh chứng từ mua hàng này "
        "(hóa đơn in nhiệt, phiếu mua hàng, phiếu xuất kho, hoặc giấy viết tay mua hàng) và trích xuất dữ liệu JSON.\n\n"
        "HƯỚNG DẪN ĐẶC BIỆT KHI ĐỌC CHỮ VIẾT TAY TIẾNG VIỆT:\n"
        "1. Tự nhận diện chiều ảnh: nếu ảnh bị chụp xoay ngang hoặc ngược, hãy tự đọc theo đúng chiều chữ.\n"
        "2. Phân biệt thật kỹ SỐ LƯỢNG và ĐƠN VỊ TÍNH viết liền nhau (ví dụ: '2 ổ' là quantity=2, unit='ổ', KHÔNG đọc nhầm thành 25). "
        "Các đơn vị F&B thường gặp: ổ, cái, ly, chai, lon, kg, g, lít, hộp, bịch, gói, vỉ, quả, bó, túi, thùng.\n"
        "3. Ví dụ mẫu (few-shot):\n"
        "   - 'Bánh mì 2 ổ 10.000' -> raw_name: 'Bánh mì', quantity: 2, unit: 'ổ', total_cost: 10000, unit_price: 5000\n"
        "   - 'Pate 0.5 kg 90.000' -> raw_name: 'Pate', quantity: 0.5, unit: 'kg', total_cost: 90000, unit_price: 180000\n"
        "   - 'Xúc xích 1 gói 45.000' -> raw_name: 'Xúc xích', quantity: 1, unit: 'gói', total_cost: 45000, unit_price: 45000\n"
        "4. Tiền VNĐ là số nguyên (10.000 = 10000). Nếu không ghi đơn giá thì tính unit_price = round(total_cost / quantity).\n"
        "5. Nếu trên giấy KHÔNG có tên nhà cung cấp/cửa hàng hoặc số hóa đơn, BẮT BUỘC để chuỗi rỗng \"\" (không tự bịa).";
    if (!catalogHint.empty()) {
        promptOut += "\n6. Danh mục nguyên liệu hiện có trong kho của quán (ưu tiên khớp tên & đơn vị nếu nhận ra chữ viết tắt/ngoáy): " + catalogHint;
    }

    schemaOut = {
        {"type", "OBJECT"},
        {"properties", {
            {"supplier", {{"type", "STRING"}}},
            {"invoice_no", {{"type", "STRING"}}},
            {"items", {
                {"type", "ARRAY"},
                {"items", {
                    {"type", "OBJECT"},
                    {"properties", {
                        {"raw_name", {{"type", "STRING"}}},
                        {"quantity", {{"type", "NUMBER"}}},
                        {"unit", {{"type", "STRING"}}},
                        {"unit_price", {{"type", "INTEGER"}}},
                        {"total_cost", {{"type", "INTEGER"}}}
                    }},
                    {"required", json::array({"raw_name", "quantity", "unit", "unit_price", "total_cost"})}
                }}
            }}
        }},
        {"required", json::array({"supplier", "invoice_no", "items"})}
    };
}

inline bool geminiGenerateContentText(const std::string& apiKey, const json& contentsJson, bool jsonMode,
                                      std::string& textOut, std::string& modelUsedOut, std::string& errOut,
                                      const json& responseSchema = json(), bool fastOcrMode = false) {
    static std::mutex pinMu;
    static std::unordered_map<std::string, std::string> pinnedModels;

    std::string rawContents = contentsJson.dump();
    bool hasImage = (rawContents.find("inlineData") != std::string::npos);
    std::string pinKey = apiKey + (hasImage ? ":ocr" : ":text");

    std::vector<std::string> models;
    {
        std::lock_guard<std::mutex> lk(pinMu);
        auto it = pinnedModels.find(pinKey);
        if (it != pinnedModels.end() && !it->second.empty()) {
            models.push_back(it->second);
        }
    }

    auto appendUnique = [&](const std::string& m) {
        if (!m.empty() && std::find(models.begin(), models.end(), m) == models.end()) {
            models.push_back(m);
        }
    };

    if (hasImage || fastOcrMode) {
        // Zero-overhead fast routing for Vision OCR: try proven fast & accurate models directly (no ListModels latency)
        for (const auto& m : std::vector<std::string>{"gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.8-flash", "gemini-3.1-flash-lite"}) {
            appendUnique(m);
        }
    } else {
        std::vector<std::string> discModels, imgUnused;
        resolveGeminiModelsForKey(apiKey, discModels, imgUnused);
        std::stable_sort(discModels.begin(), discModels.end(), [](const std::string& a, const std::string& b) {
            bool aLite = (a.find("3.1-flash-lite") != std::string::npos);
            bool bLite = (b.find("3.1-flash-lite") != std::string::npos);
            return aLite && !bLite;
        });
        for (const auto& m : discModels) appendUnique(m);
    }

    auto buildBody = [&](bool withOptionalExtras) -> std::string {
        json reqPayload = {{"contents", contentsJson}};
        json genCfg = {{"temperature", 0.1}};
        if (jsonMode) {
            genCfg["responseMimeType"] = "application/json";
        }
        if (withOptionalExtras) {
            if (!responseSchema.is_null() && !responseSchema.empty()) {
                genCfg["responseSchema"] = responseSchema;
            }
            if (fastOcrMode || hasImage) {
                genCfg["thinkingConfig"] = {{"thinkingBudget", 0}};
            }
        }
        reqPayload["generationConfig"] = genCfg;
        return reqPayload.dump();
    };

    std::string bodyFull = buildBody(true);
    std::string bodyCompat = buildBody(false);
    std::string primaryErr;
    bool triedDiscoveryFallback = false;

    for (size_t idx = 0; idx < models.size(); ++idx) {
        const std::string mdl = models[idx];
        int st = 0;
        std::string resp;
        if (!winHttpRequest("generativelanguage.googleapis.com", 443, true,
                            "/v1beta/models/" + mdl + ":generateContent?key=" + apiKey,
                            "POST", bodyFull, st, resp, errOut)) {
            return false;
        }
        // If model rejects thinkingConfig or responseSchema with 400, retry once with clean generationConfig
        if (st == 400 && bodyFull != bodyCompat) {
            int st2 = 0;
            std::string resp2;
            if (winHttpRequest("generativelanguage.googleapis.com", 443, true,
                               "/v1beta/models/" + mdl + ":generateContent?key=" + apiKey,
                               "POST", bodyCompat, st2, resp2, errOut)) {
                st = st2;
                resp = resp2;
            }
        }
        if (st >= 200 && st < 300) {
            try {
                json j = json::parse(resp);
                auto& parts = j["candidates"][0]["content"]["parts"];
                for (const auto& p : parts) {
                    if (p.contains("text")) {
                        textOut = p["text"].get<std::string>();
                        modelUsedOut = mdl;
                        {
                            std::lock_guard<std::mutex> lk(pinMu);
                            pinnedModels[pinKey] = mdl;
                        }
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
            // If static fast models hit 404, dynamically discover available models on this key once
            if (st == 404 && !triedDiscoveryFallback && (hasImage || fastOcrMode)) {
                triedDiscoveryFallback = true;
                std::vector<std::string> discModels, imgUnused;
                resolveGeminiModelsForKey(apiKey, discModels, imgUnused);
                std::stable_sort(discModels.begin(), discModels.end(), [](const std::string& a, const std::string& b) {
                    bool aLite = (a.find("lite") != std::string::npos);
                    bool bLite = (b.find("lite") != std::string::npos);
                    return !aLite && bLite;
                });
                for (const auto& dm : discModels) appendUnique(dm);
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

inline bool verifyProviderKey(const std::string& provider, const std::string& apiKey,
                              int& modelCountOut, std::vector<std::string>& sampleOut, std::string& errOut) {
    if (provider.empty() || provider == "gemini") {
        return geminiVerifyKey(apiKey, modelCountOut, sampleOut, errOut);
    }
    if (apiKey.empty()) { errOut = "Chưa nhập API Key!"; return false; }

    int st = 0;
    std::string resp;
    if (provider == "huggingface") {
        if (!winHttpRequestEx("huggingface.co", 443, true, "/api/whoami-v2", "GET", "", apiKey, st, resp, errOut)) {
            return false;
        }
        if (st >= 200 && st < 300) {
            modelCountOut = 1;
            sampleOut = {"black-forest-labs/FLUX.1-schnell"};
            return true;
        }
        errOut = "HuggingFace từ chối Token (HTTP " + std::to_string(st) + ")";
        return false;
    }
    if (provider == "pollinations") {
        if (!winHttpRequestEx("gen.pollinations.ai", 443, true, "/image/coffee?model=flux&width=64&height=64&nologo=true", "GET", "", apiKey, st, resp, errOut)) {
            return false;
        }
        if (st >= 200 && st < 300 && resp.size() > 100) {
            modelCountOut = 2;
            sampleOut = {"flux", "turbo"};
            return true;
        }
        errOut = "Pollinations từ chối Key (HTTP " + std::to_string(st) + ")";
        return false;
    }
    if (provider == "openai") {
        if (!winHttpRequestEx("api.openai.com", 443, true, "/v1/models", "GET", "", apiKey, st, resp, errOut)) {
            return false;
        }
        if (st >= 200 && st < 300) {
            modelCountOut = 2;
            sampleOut = {"gpt-image-1", "dall-e-3"};
            return true;
        }
        errOut = "OpenAI từ chối Key (HTTP " + std::to_string(st) + ")";
        return false;
    }
    errOut = "Nhà cung cấp không được hỗ trợ: " + provider;
    return false;
}

inline bool generateImageViaProvider(const std::string& provider, const std::string& apiKey, const std::string& prompt,
                                     std::string& outB64, std::string& outMime, std::string& modelUsedOut, std::string& errOut) {
    if (provider.empty() || provider == "gemini") {
        return geminiGenerateImageBase64(apiKey, prompt, outB64, outMime, modelUsedOut, errOut);
    }
    int st = 0;
    std::string resp;
    if (provider == "huggingface") {
        json payload = {{"inputs", prompt}};
        if (!winHttpRequestEx("router.huggingface.co", 443, true, "/hf-inference/models/black-forest-labs/FLUX.1-schnell",
                              "POST", payload.dump(), apiKey, st, resp, errOut)) {
            return false;
        }
        if (st >= 200 && st < 300 && resp.size() > 512 && resp[0] != '{') {
            outMime = detectImageMime(resp);
            outB64 = base64Encode(resp);
            modelUsedOut = "hf/FLUX.1-schnell";
            return !outB64.empty();
        }
        errOut = extractGeminiError(resp, st);
        return false;
    }
    if (provider == "pollinations") {
        if (!apiKey.empty() && apiKey != "free") {
            std::string path = "/image/" + urlEncode(prompt) + "?model=flux&width=800&height=600&nologo=true";
            if (winHttpRequestEx("gen.pollinations.ai", 443, true, path, "GET", "", apiKey, st, resp, errOut) &&
                st >= 200 && st < 300 && resp.size() > 512 && resp[0] != '{') {
                outMime = detectImageMime(resp);
                outB64 = base64Encode(resp);
                modelUsedOut = "pollinations/flux";
                return !outB64.empty();
            }
        }
        std::string freePath = "/prompt/" + urlEncode(prompt) + "?width=800&height=600&nologo=true";
        if (!winHttpRequestEx("image.pollinations.ai", 443, true, freePath, "GET", "", "", st, resp, errOut)) {
            return false;
        }
        if (st >= 200 && st < 300 && resp.size() > 512 && resp[0] != '{') {
            outMime = detectImageMime(resp);
            outB64 = base64Encode(resp);
            modelUsedOut = "pollinations/free";
            return !outB64.empty();
        }
        errOut = extractGeminiError(resp, st);
        return false;
    }
    if (provider == "openai") {
        json payload = {{"model", "gpt-image-1"}, {"prompt", prompt}, {"size", "1024x1024"}};
        if (!winHttpRequestEx("api.openai.com", 443, true, "/v1/images/generations", "POST", payload.dump(), apiKey, st, resp, errOut)) {
            return false;
        }
        if (st >= 200 && st < 300) {
            try {
                json j = json::parse(resp);
                if (j.contains("data") && !j["data"].empty() && j["data"][0].contains("b64_json")) {
                    outB64 = j["data"][0]["b64_json"].get<std::string>();
                    outMime = "image/png";
                    modelUsedOut = "openai/gpt-image-1";
                    return !outB64.empty();
                }
            } catch (...) {}
        }
        errOut = extractGeminiError(resp, st);
        return false;
    }
    errOut = "Provider tạo ảnh không hợp lệ: " + provider;
    return false;
}

inline std::string buildDishImagePrompt(const std::string& name, const std::string& catName, const std::string& styleTone) {
    std::string prompt = "Professional commercial food and beverage studio photography of Vietnamese cafe/restaurant dish: \"" + name + "\"";
    if (!catName.empty()) prompt += " (Category: " + catName + ")";
    if (styleTone == "bright") {
        prompt += ". Appetizing close-up shot on a bright clean light wood or white marble table, airy natural daylight, crisp bright background, shallow depth of field, high detail, photorealistic, no text, no watermark.";
    } else if (styleTone == "warm") {
        prompt += ". Appetizing close-up shot on a warm natural wood cafe table, soft daylight, balanced warm tones, shallow depth of field, high detail, photorealistic, no text, no watermark.";
    } else {
        prompt += ". Appetizing close-up shot, warm moody cafe lighting, shallow depth of field, high detail, photorealistic, clean aesthetic, no text, no watermark.";
    }
    return prompt;
}

inline bool parseHttpUrlParts(const std::string& url, std::string& hostOut, int& portOut, bool& tlsOut, std::string& pathOut) {
    tlsOut = (url.rfind("https://", 0) == 0);
    size_t start = tlsOut ? 8 : (url.rfind("http://", 0) == 0 ? 7 : std::string::npos);
    if (start == std::string::npos) return false;
    size_t slash = url.find('/', start);
    std::string hostPort = (slash == std::string::npos) ? url.substr(start) : url.substr(start, slash - start);
    pathOut = (slash == std::string::npos) ? "/" : url.substr(slash);
    size_t colon = hostPort.find(':');
    if (colon != std::string::npos) {
        hostOut = hostPort.substr(0, colon);
        try { portOut = std::stoi(hostPort.substr(colon + 1)); } catch (...) { portOut = tlsOut ? 443 : 80; }
    } else {
        hostOut = hostPort;
        portOut = tlsOut ? 443 : 80;
    }
    return !hostOut.empty();
}

inline bool fetchImageAsBase64(const std::string& url, std::string& outB64, std::string& outMime, std::string& errOut) {
    std::string host, path, resp;
    int port = 443, st = 0;
    bool tls = true;
    if (!parseHttpUrlParts(url, host, port, tls, path)) {
        errOut = "URL ảnh không hợp lệ.";
        return false;
    }
    if (!winHttpRequestEx(host, port, tls, path, "GET", "", "", st, resp, errOut)) {
        return false;
    }
    if (st >= 200 && st < 300 && resp.size() > 512 && resp[0] != '<' && resp[0] != '{') {
        outMime = detectImageMime(resp);
        outB64 = base64Encode(resp);
        return !outB64.empty();
    }
    errOut = "Không tải được ảnh (HTTP " + std::to_string(st) + ")";
    return false;
}

struct FoodImageCandidate {
    std::string thumbUrl;
    std::string fullUrl;
};

inline bool searchFoodImagesBing(const std::string& dishName, const std::string& catName, const std::string& styleTone,
                                 std::vector<FoodImageCandidate>& resultsOut, std::string& errOut) {
    resultsOut.clear();
    std::string q = dishName;
    if (!catName.empty() && catName.find("Tất cả") == std::string::npos) {
        q += " " + catName;
    }
    if (styleTone == "bright") q += " nền sáng";
    else if (styleTone == "dark") q += " nền tối";

    std::string path = "/images/async?q=" + urlEncode(q) + "&first=1&count=12&adlt=strict";
    int st = 0;
    std::string html;
    if (!winHttpRequestEx("www.bing.com", 443, true, path, "GET", "", "", st, html, errOut)) {
        return false;
    }
    if (st < 200 || st >= 300 || html.empty()) {
        errOut = "Lỗi tìm kiếm ảnh (HTTP " + std::to_string(st) + ")";
        return false;
    }
    size_t pos = 0;
    while (resultsOut.size() < 6) {
        size_t mKey = html.find("murl&quot;:&quot;", pos);
        if (mKey == std::string::npos) break;
        size_t mStart = mKey + 17;
        size_t mEnd = html.find("&quot;", mStart);
        if (mEnd == std::string::npos) break;
        std::string murl = html.substr(mStart, mEnd - mStart);

        std::string turl;
        size_t tKey = html.find("turl&quot;:&quot;", mEnd);
        if (tKey != std::string::npos && tKey - mEnd < 600) {
            size_t tStart = tKey + 17;
            size_t tEnd = html.find("&quot;", tStart);
            if (tEnd != std::string::npos) turl = html.substr(tStart, tEnd - tStart);
        }
        if (murl.rfind("http", 0) == 0) {
            resultsOut.push_back({turl.empty() ? murl : turl, murl});
        }
        pos = mEnd + 6;
    }
    if (resultsOut.empty()) {
        errOut = "Không tìm thấy ảnh phù hợp cho món \"" + dishName + "\"";
        return false;
    }
    return true;
}

} // namespace SaleApp::AI
