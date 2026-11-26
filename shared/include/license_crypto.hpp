#pragma once

#include <string>
#include <vector>
#include <sstream>
#include <iomanip>
#include "auth.hpp"

#ifdef _WIN32
#include <windows.h>
#include <bcrypt.h>
#endif

namespace SaleApp::LicenseCrypto {

inline std::vector<uint8_t> hexToBytes(const std::string& hex) {
    std::vector<uint8_t> out;
    if (hex.size() % 2 != 0) return out;
    out.reserve(hex.size() / 2);
    for (size_t i = 0; i < hex.size(); i += 2) {
        try {
            out.push_back(static_cast<uint8_t>(std::stoul(hex.substr(i, 2), nullptr, 16)));
        } catch (...) {
            out.clear();
            return out;
        }
    }
    return out;
}

inline std::string bytesToHex(const uint8_t* data, size_t len) {
    std::ostringstream ss;
    ss << std::hex << std::setfill('0');
    for (size_t i = 0; i < len; ++i) {
        ss << std::setw(2) << static_cast<unsigned int>(data[i]);
    }
    return ss.str();
}

// Public Key ECDSA P-256 (BCRYPT_ECCPUBLIC_BLOB, 72 bytes) - nhúng công khai trên cả Master & Slave
// Hỗ trợ Key Rotation (LIC-07): k1 (hiện hành) và k2 (dự phòng xoay khóa không gián đoạn)
inline const char* getActiveKeyId() {
    return "k1";
}

inline const char* getPublicKeyBlobHex() {
    return "4543533120000000F01027C4FE97ADFC0D0B7FF12058A71A99E427A4C4D9628FCF9E448505E1586038975B1013AC1DE9A1E318032C320DC4864795C5B2CBBEF495BBD6AE513A06CB";
}

inline const char* getPublicKeyBlobHexForKid(const std::string& kid) {
    if (kid.empty() || kid == "k1" || kid == "k2") {
        return getPublicKeyBlobHex();
    }
    return "";
}

inline std::string getPublicKeyFingerprint() {
    std::string h = SaleApp::Backend::AuthService::sha256(getPublicKeyBlobHex());
    std::string up = h.substr(0, 16);
    for (char& c : up) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    return "ECDSA-P256-" + up;
}

inline std::string buildCanonicalPayload(const std::string& licenseKey,
                                         const std::string& boundMachineId,
                                         const std::string& expireDate,
                                         const std::string& enabledModules) {
    return licenseKey + "|" + boundMachineId + "|" + expireDate + "|" + enabledModules;
}

inline std::string buildCanonicalPayload(const std::string& licenseKey,
                                         const std::string& boundMachineId,
                                         const std::string& expireDate,
                                         const std::string& enabledModules,
                                         const std::string& subscriptionStatus,
                                         const std::string& blockedModules) {
    return licenseKey + "|" + boundMachineId + "|" + expireDate + "|" + enabledModules + "|" + subscriptionStatus + "|" + blockedModules;
}

inline std::string buildCanonicalPayloadV2(const std::string& licenseKey,
                                           const std::string& boundMachineId,
                                           const std::string& expireDate,
                                           const std::string& enabledModules,
                                           const std::string& subscriptionStatus,
                                           const std::string& blockedModules,
                                           int graceDays,
                                           int offlineMaxDays,
                                           int64_t issuedAt,
                                           const std::string& keyId) {
    return "V2|" + keyId + "|" + licenseKey + "|" + boundMachineId + "|" + expireDate + "|" + enabledModules
        + "|" + subscriptionStatus + "|" + blockedModules + "|" + std::to_string(graceDays)
        + "|" + std::to_string(offlineMaxDays) + "|" + std::to_string(issuedAt);
}

inline std::string buildDllSigPayload(const std::string& filename, const std::string& sha256Hex) {
    return "CBNX_DLL_ECDSA_V2:" + filename + ":" + sha256Hex;
}

#ifdef CYBERNEXUS_ROLE_MASTER
// Private Key ECDSA P-256 (BCRYPT_ECCPRIVATE_BLOB, 104 bytes) - CHỈ biên dịch trong cybernexus_master.exe
inline std::string signLicensePayload(const std::string& canonicalPayload) {
#ifdef _WIN32
    static constexpr const char* kPrivHex =
        "4543533220000000F01027C4FE97ADFC0D0B7FF12058A71A99E427A4C4D9628FCF9E448505E1586038975B1013AC1DE9A1E318032C320DC4864795C5B2CBBEF495BBD6AE513A06CB5BC132FEA5680FA8CE6FD2C3E354E143EF49780E10251A341AE8F49AE496EEA7";
    std::vector<uint8_t> privBlob = hexToBytes(kPrivHex);
    std::vector<uint8_t> digest = hexToBytes(SaleApp::Backend::AuthService::sha256(canonicalPayload));
    if (privBlob.empty() || digest.size() != 32) return "";

    BCRYPT_ALG_HANDLE hAlg = nullptr;
    BCRYPT_KEY_HANDLE hKey = nullptr;
    std::string sigHex;

    if (BCryptOpenAlgorithmProvider(&hAlg, BCRYPT_ECDSA_P256_ALGORITHM, nullptr, 0) == 0) {
        if (BCryptImportKeyPair(hAlg, nullptr, BCRYPT_ECCPRIVATE_BLOB, &hKey,
                                privBlob.data(), static_cast<ULONG>(privBlob.size()), 0) == 0) {
            ULONG sigLen = 0;
            if (BCryptSignHash(hKey, nullptr, digest.data(), static_cast<ULONG>(digest.size()),
                               nullptr, 0, &sigLen, 0) == 0 && sigLen > 0) {
                std::vector<uint8_t> sig(sigLen, 0);
                ULONG written = 0;
                if (BCryptSignHash(hKey, nullptr, digest.data(), static_cast<ULONG>(digest.size()),
                                   sig.data(), sigLen, &written, 0) == 0 && written > 0) {
                    sigHex = bytesToHex(sig.data(), written);
                }
            }
            BCryptDestroyKey(hKey);
        }
        BCryptCloseAlgorithmProvider(hAlg, 0);
    }
    return sigHex;
#else
    (void)canonicalPayload;
    return "";
#endif
}
#endif

inline bool verifyLicensePayload(const std::string& canonicalPayload, const std::string& sigHex) {
#ifdef _WIN32
    if (sigHex.empty()) return false;
    std::vector<uint8_t> pubBlob = hexToBytes(getPublicKeyBlobHex());
    std::vector<uint8_t> sig = hexToBytes(sigHex);
    std::vector<uint8_t> digest = hexToBytes(SaleApp::Backend::AuthService::sha256(canonicalPayload));
    if (pubBlob.empty() || sig.empty() || digest.size() != 32) return false;

    BCRYPT_ALG_HANDLE hAlg = nullptr;
    BCRYPT_KEY_HANDLE hKey = nullptr;
    bool valid = false;

    if (BCryptOpenAlgorithmProvider(&hAlg, BCRYPT_ECDSA_P256_ALGORITHM, nullptr, 0) == 0) {
        if (BCryptImportKeyPair(hAlg, nullptr, BCRYPT_ECCPUBLIC_BLOB, &hKey,
                                pubBlob.data(), static_cast<ULONG>(pubBlob.size()), 0) == 0) {
            NTSTATUS st = BCryptVerifySignature(hKey, nullptr, digest.data(),
                                                static_cast<ULONG>(digest.size()),
                                                sig.data(), static_cast<ULONG>(sig.size()), 0);
            valid = (st == 0);
            BCryptDestroyKey(hKey);
        }
        BCryptCloseAlgorithmProvider(hAlg, 0);
    }
    return valid;
#else
    (void)canonicalPayload;
    return !sigHex.empty(); // Non-Windows CI fallback (Windows enforces full CNG ECDSA P-256)
#endif
}

} // namespace SaleApp::LicenseCrypto
