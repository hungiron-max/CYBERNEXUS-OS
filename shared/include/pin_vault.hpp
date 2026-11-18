#pragma once

#include <algorithm>
#include <cctype>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <random>
#include <string>
#include <vector>

#include "auth.hpp"

namespace CyberNexus::PinVault {

inline bool isValidPin6(const std::string& pin) {
    if (pin.size() != 6) return false;
    return std::all_of(pin.begin(), pin.end(), [](unsigned char c) { return std::isdigit(c) != 0; });
}

inline std::string generateRandomPin6() {
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<int> dist(100000, 999999);
    return std::to_string(dist(gen));
}

inline std::string deriveStreamKey(const std::string& licenseKey) {
    return SaleApp::Backend::AuthService::sha256("CNX_OWNER_PIN_VAULT_V1|" + licenseKey);
}

inline std::string encryptPinForLicense(const std::string& pin6, const std::string& licenseKey) {
    if (!isValidPin6(pin6)) return "";
    std::string key = deriveStreamKey(licenseKey);
    std::string out;
    char buf[4];
    for (size_t i = 0; i < pin6.size(); ++i) {
        unsigned char b = static_cast<unsigned char>(pin6[i]) ^ static_cast<unsigned char>(key[i % key.size()]);
        std::snprintf(buf, sizeof(buf), "%02X", b);
        out += buf;
    }
    return out;
}

inline std::string decryptPinForLicense(const std::string& encHex, const std::string& licenseKey) {
    if (encHex.size() != 12) return "";
    std::string key = deriveStreamKey(licenseKey);
    std::string pin;
    for (size_t i = 0; i < 6; ++i) {
        unsigned int val = 0;
        if (std::sscanf(encHex.substr(i * 2, 2).c_str(), "%02X", &val) != 1) return "";
        char ch = static_cast<char>(static_cast<unsigned char>(val) ^ static_cast<unsigned char>(key[i % key.size()]));
        if (!std::isdigit(static_cast<unsigned char>(ch))) return "";
        pin.push_back(ch);
    }
    return pin;
}

inline bool writeDefaultOwnerPinFile(const std::filesystem::path& targetDir,
                                     const std::string& storeName,
                                     const std::string& storeCode,
                                     const std::string& pin6,
                                     bool isReset) {
    std::error_code ec;
    std::filesystem::create_directories(targetDir, ec);
    std::ofstream ofs(targetDir / "DEFAULT_OWNER_PIN.txt", std::ios::trunc);
    if (!ofs) return false;
    ofs << "==========================================================\n";
    ofs << "  CYBERNEXUS OS - MA PIN MAC DINH CHU QUAN (6 SO)\n";
    ofs << "==========================================================\n";
    ofs << "Quan:          " << storeName << " (" << storeCode << ")\n";
    ofs << "Trang thai:    " << (isReset ? "DA RESET VE MAC DINH TU MASTER" : "KHOI TAO BAN DAU") << "\n";
    ofs << "PIN mac dinh:  " << pin6 << "\n";
    ofs << "----------------------------------------------------------\n";
    ofs << "LUU Y BAO MAT:\n";
    ofs << "1. Ma PIN nay chi dung dang nhap DUY NHAT 1 LAN.\n";
    ofs << "2. Sau khi dang nhap, he thong bat buoc doi sang PIN 6 so moi.\n";
    ofs << "3. PIN moi KHONG DUOC PHEP trung voi 6 so mac dinh nay.\n";
    ofs << "4. Giu file nay o noi an toan, khong chia se cho nhan vien.\n";
    ofs << "==========================================================\n";
    return true;
}

} // namespace CyberNexus::PinVault
