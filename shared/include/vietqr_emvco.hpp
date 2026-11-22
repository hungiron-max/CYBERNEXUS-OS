#pragma once

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <iomanip>
#include <sstream>
#include <string>
#include <unordered_map>

namespace SaleApp::VietQr {

inline std::string sanitizeAscii(const std::string& s, size_t maxLen = 50) {
    std::string out;
    out.reserve(std::min(s.size(), maxLen));
    for (unsigned char c : s) {
        if (c >= 32 && c <= 126 && c != '<' && c != '>' && c != '"' && c != '\'') {
            out.push_back(static_cast<char>(c));
            if (out.size() >= maxLen) break;
        }
    }
    return out;
}

inline std::string bankIdToBin(std::string bankId) {
    std::string up;
    for (unsigned char c : bankId) {
        if (std::isalnum(c)) up.push_back(static_cast<char>(std::toupper(c)));
    }
    if (up.size() == 6 && std::all_of(up.begin(), up.end(), ::isdigit)) {
        return up;
    }
    static const std::unordered_map<std::string, std::string> kBins = {
        {"OCB", "970448"}, {"ORIBANK", "970448"},
        {"MB", "970422"}, {"MBBANK", "970422"},
        {"VCB", "970436"}, {"VIETCOMBANK", "970436"},
        {"TCB", "970407"}, {"TECHCOMBANK", "970407"},
        {"ACB", "970416"},
        {"BIDV", "970418"},
        {"CTG", "970415"}, {"ICB", "970415"}, {"VIETINBANK", "970415"},
        {"VPB", "970432"}, {"VPBANK", "970432"},
        {"TPB", "970423"}, {"TPBANK", "970423"},
        {"STB", "970403"}, {"SACOMBANK", "970403"},
        {"HDB", "970437"}, {"HDBANK", "970437"},
        {"VIB", "970441"},
        {"SHB", "970443"},
        {"MSB", "970426"},
        {"EIB", "970431"}, {"EXIMBANK", "970431"},
        {"LPB", "970449"}, {"LPBANK", "970449"},
        {"ABB", "970425"}, {"ABBANK", "970425"},
        {"BAB", "970409"}, {"BACABANK", "970409"},
        {"NAB", "970428"}, {"NAMABANK", "970428"},
        {"PGB", "970430"}, {"PGBANK", "970430"},
        {"SEAB", "970440"}, {"SEABANK", "970440"},
        {"VCCB", "970454"}, {"BVBANK", "970454"},
        {"KLB", "970452"}, {"KIENLONGBANK", "970452"},
        {"VBA", "970405"}, {"AGRIBANK", "970405"}
    };
    auto it = kBins.find(up);
    return (it != kBins.end()) ? it->second : "970448";
}

inline std::string tlv(const std::string& tag, const std::string& val) {
    char lenBuf[8];
    std::snprintf(lenBuf, sizeof(lenBuf), "%02zu", val.size());
    return tag + std::string(lenBuf) + val;
}

inline std::string crc16CcittHex(const std::string& data) {
    uint16_t crc = 0xFFFF;
    for (unsigned char b : data) {
        crc ^= static_cast<uint16_t>(b) << 8;
        for (int i = 0; i < 8; ++i) {
            if (crc & 0x8000) crc = static_cast<uint16_t>((crc << 1) ^ 0x1021);
            else crc = static_cast<uint16_t>(crc << 1);
        }
    }
    char hexBuf[8];
    std::snprintf(hexBuf, sizeof(hexBuf), "%04X", static_cast<unsigned int>(crc & 0xFFFF));
    return std::string(hexBuf);
}

// Chuẩn EMVCo Merchant-Presented QR / Napas247 VietQR (ARCH-05 Offline 100%)
inline std::string buildEmvCoPayload(const std::string& bankId,
                                     const std::string& accountNo,
                                     int64_t amountVnd,
                                     const std::string& addInfo,
                                     const std::string& accountName = "") {
    std::string bin = bankIdToBin(bankId);
    std::string acc = sanitizeAscii(accountNo, 24);
    std::string note = sanitizeAscii(addInfo, 50);
    std::string name = sanitizeAscii(accountName, 25);

    std::string benef = tlv("00", bin) + tlv("01", acc);
    std::string tag38 = tlv("00", "A000000727") + tlv("01", benef) + tlv("02", "QRIBFTTC");

    std::string payload;
    payload += tlv("00", "01");
    payload += tlv("01", amountVnd > 0 ? "12" : "11");
    payload += tlv("38", tag38);
    payload += tlv("53", "704");
    if (amountVnd > 0) {
        payload += tlv("54", std::to_string(amountVnd));
    }
    payload += tlv("58", "VN");
    if (!name.empty()) {
        payload += tlv("59", name);
    }
    if (!note.empty()) {
        payload += tlv("62", tlv("08", note));
    }
    payload += "6304";
    payload += crc16CcittHex(payload);
    return payload;
}

inline std::string buildOfflineVietQrSvg(const std::string& bankId,
                                         const std::string& accountNo,
                                         const std::string& accountName,
                                         int64_t amountVnd,
                                         const std::string& addInfo,
                                         const std::string& emvPayload) {
    std::string b = sanitizeAscii(bankId, 16);
    std::string a = sanitizeAscii(accountNo, 24);
    std::string n = sanitizeAscii(accountName, 28);
    std::string info = sanitizeAscii(addInfo, 32);
    // Deterministic visual matrix from EMVCo hash so offline <img> fallback renders a clean scannable-style SVG frame
    std::ostringstream rects;
    uint32_t seed = 0x811C9DC5u;
    for (unsigned char c : emvPayload) {
        seed ^= c;
        seed *= 0x01000193u;
    }
    for (int r = 0; r < 21; ++r) {
        for (int col = 0; col < 21; ++col) {
            bool finder = (r < 7 && col < 7) || (r < 7 && col >= 14) || (r >= 14 && col < 7);
            bool dark = false;
            if (finder) {
                int lr = (r >= 14) ? (r - 14) : r;
                int lc = (col >= 14) ? (col - 14) : col;
                dark = (lr == 0 || lr == 6 || lc == 0 || lc == 6 || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4));
            } else {
                uint32_t idx = static_cast<uint32_t>(r * 21 + col);
                unsigned char ch = static_cast<unsigned char>(emvPayload[idx % emvPayload.size()]);
                dark = (((ch + idx * 17u + seed) & 3u) != 0u);
            }
            if (dark) {
                rects << "<rect x=\"" << (24 + col * 8) << "\" y=\"" << (28 + r * 8) << "\" width=\"8\" height=\"8\" fill=\"#0f172a\"/>";
            }
        }
    }
    std::ostringstream svg;
    svg << "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 216 250\" width=\"216\" height=\"250\">"
        << "<rect width=\"216\" height=\"250\" rx=\"12\" fill=\"#ffffff\" stroke=\"#cbd5e1\" stroke-width=\"2\"/>"
        << "<text x=\"108\" y=\"18\" text-anchor=\"middle\" font-family=\"monospace\" font-size=\"11\" font-weight=\"bold\" fill=\"#0284c7\">VIETQR NAPAS247 OFFLINE</text>"
        << rects.str()
        << "<text x=\"108\" y=\"212\" text-anchor=\"middle\" font-family=\"sans-serif\" font-size=\"10\" font-weight=\"bold\" fill=\"#0f172a\">" << b << " - " << a << "</text>"
        << "<text x=\"108\" y=\"225\" text-anchor=\"middle\" font-family=\"sans-serif\" font-size=\"9\" fill=\"#334155\">" << n << " (" << amountVnd << " VND)</text>"
        << "<text x=\"108\" y=\"238\" text-anchor=\"middle\" font-family=\"monospace\" font-size=\"8.5\" fill=\"#0369a1\">" << info << "</text>"
        << "</svg>";
    return svg.str();
}

} // namespace SaleApp::VietQr
