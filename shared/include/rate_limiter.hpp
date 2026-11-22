#pragma once

#include <algorithm>
#include <array>
#include <chrono>
#include <cctype>
#include <cstdint>
#include <deque>
#include <mutex>
#include <sstream>
#include <string>
#include <unordered_map>

namespace SaleApp::Security {

class RateLimiter {
public:
    static RateLimiter& instance() {
        static RateLimiter inst;
        return inst;
    }

    /** Sliding-window request limiter. Returns true if allowed, false with retryAfterSecOut > 0 if throttled. */
    bool allow(const std::string& bucket,
               const std::string& key,
               int maxRequests,
               int windowSec,
               int& retryAfterSecOut) {
        retryAfterSecOut = 0;
        if (maxRequests <= 0 || windowSec <= 0) return true;
        auto now = std::chrono::steady_clock::now();
        std::string fullKey = bucket + ":" + key;

        std::lock_guard<std::mutex> lk(m_mtx);
        maybePruneLocked(now);
        auto& dq = m_windows[fullKey];
        auto cutoff = now - std::chrono::seconds(windowSec);
        while (!dq.empty() && dq.front() <= cutoff) {
            dq.pop_front();
        }
        if (static_cast<int>(dq.size()) >= maxRequests) {
            auto waitSec = std::chrono::duration_cast<std::chrono::seconds>(
                (dq.front() + std::chrono::seconds(windowSec)) - now
            ).count();
            retryAfterSecOut = static_cast<int>(std::max<int64_t>(1, waitSec));
            return false;
        }
        dq.push_back(now);
        return true;
    }

    /** Returns true if the failure key is currently locked out. */
    bool isLocked(const std::string& bucket, const std::string& key, int& retryAfterSecOut) {
        retryAfterSecOut = 0;
        auto now = std::chrono::steady_clock::now();
        std::string fullKey = bucket + ":" + key;

        std::lock_guard<std::mutex> lk(m_mtx);
        auto it = m_failures.find(fullKey);
        if (it == m_failures.end()) return false;
        if (it->second.lockedUntil > now) {
            auto waitSec = std::chrono::duration_cast<std::chrono::seconds>(it->second.lockedUntil - now).count();
            retryAfterSecOut = static_cast<int>(std::max<int64_t>(1, waitSec));
            return true;
        }
        return false;
    }

    /** Records an auth/PIN failure and activates lockSec lockout when maxFailures happen within windowSec. */
    void recordFailure(const std::string& bucket,
                       const std::string& key,
                       int maxFailures,
                       int windowSec,
                       int lockSec) {
        auto now = std::chrono::steady_clock::now();
        std::string fullKey = bucket + ":" + key;

        std::lock_guard<std::mutex> lk(m_mtx);
        maybePruneLocked(now);
        auto& st = m_failures[fullKey];
        auto cutoff = now - std::chrono::seconds(windowSec);
        while (!st.attempts.empty() && st.attempts.front() <= cutoff) {
            st.attempts.pop_front();
        }
        st.attempts.push_back(now);
        if (static_cast<int>(st.attempts.size()) >= maxFailures) {
            st.lockedUntil = now + std::chrono::seconds(lockSec);
        }
    }

    void clearFailures(const std::string& bucket, const std::string& key) {
        std::lock_guard<std::mutex> lk(m_mtx);
        m_failures.erase(bucket + ":" + key);
    }

private:
    RateLimiter() : m_lastPrune(std::chrono::steady_clock::now()) {}

    struct FailState {
        std::deque<std::chrono::steady_clock::time_point> attempts;
        std::chrono::steady_clock::time_point lockedUntil{};
    };

    void maybePruneLocked(std::chrono::steady_clock::time_point now) {
        if (now - m_lastPrune < std::chrono::minutes(5)) return;
        m_lastPrune = now;
        auto staleCutoff = now - std::chrono::hours(1);
        for (auto it = m_windows.begin(); it != m_windows.end();) {
            if (it->second.empty() || it->second.back() < staleCutoff) {
                it = m_windows.erase(it);
            } else {
                ++it;
            }
        }
        for (auto it = m_failures.begin(); it != m_failures.end();) {
            bool expiredLock = (it->second.lockedUntil <= now);
            bool staleAttempts = (it->second.attempts.empty() || it->second.attempts.back() < staleCutoff);
            if (expiredLock && staleAttempts) {
                it = m_failures.erase(it);
            } else {
                ++it;
            }
        }
    }

    std::mutex m_mtx;
    std::chrono::steady_clock::time_point m_lastPrune;
    std::unordered_map<std::string, std::deque<std::chrono::steady_clock::time_point>> m_windows;
    std::unordered_map<std::string, FailState> m_failures;
};

/** Blocks SSRF against localhost, loopback, RFC1918 private LAN, link-local / cloud metadata, and non-HTTP(S) schemes. */
inline bool isPrivateOrLocalUrl(const std::string& url, std::string* reasonOut = nullptr) {
    auto fail = [&](const char* r) {
        if (reasonOut) *reasonOut = r;
        return true;
    };
    if (url.empty()) return fail("URL trống");
    std::string low = url;
    std::transform(low.begin(), low.end(), low.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });

    size_t schemeEnd = std::string::npos;
    if (low.rfind("http://", 0) == 0) schemeEnd = 7;
    else if (low.rfind("https://", 0) == 0) schemeEnd = 8;
    else return fail("Chỉ cho phép giao thức http:// hoặc https://");

    size_t authEnd = low.find_first_of("/?#", schemeEnd);
    std::string authority = (authEnd == std::string::npos) ? low.substr(schemeEnd) : low.substr(schemeEnd, authEnd - schemeEnd);
    size_t atPos = authority.rfind('@');
    if (atPos != std::string::npos) authority = authority.substr(atPos + 1);
    if (authority.empty()) return fail("Thiếu tên miền/host trong URL");

    std::string host = authority;
    if (host.front() == '[') {
        size_t closeBr = host.find(']');
        if (closeBr == std::string::npos) return fail("Địa chỉ IPv6 không hợp lệ");
        host = host.substr(1, closeBr - 1);
    } else {
        size_t colonPos = host.rfind(':');
        if (colonPos != std::string::npos) host = host.substr(0, colonPos);
    }
    if (host.empty()) return fail("Host trống");

    if (host == "localhost" ||
        (host.size() > 10 && host.compare(host.size() - 10, 10, ".localhost") == 0) ||
        (host.size() > 6 && host.compare(host.size() - 6, 6, ".local") == 0) ||
        (host.size() > 9 && host.compare(host.size() - 9, 9, ".internal") == 0)) {
        return fail("Chặn truy cập localhost/mạng nội bộ");
    }
    if (host == "::1" || host == "::" || host.rfind("fe80:", 0) == 0 ||
        host.rfind("fc", 0) == 0 || host.rfind("fd", 0) == 0 ||
        host.rfind("::ffff:", 0) == 0) {
        return fail("Chặn địa chỉ IPv6 nội bộ/loopback");
    }

    // Parse dotted IPv4 or numeric single-integer / hex / octal IP bypass forms
    bool allDigits = !host.empty() && std::all_of(host.begin(), host.end(), [](unsigned char c) { return std::isdigit(c) != 0; });
    if (allDigits || host.rfind("0x", 0) == 0) {
        return fail("Chặn địa chỉ IP dạng số nguyên/hex");
    }

    std::array<int, 4> octets{};
    int partIdx = 0;
    std::stringstream ss(host);
    std::string seg;
    bool isIpv4 = true;
    while (std::getline(ss, seg, '.')) {
        if (partIdx >= 4 || seg.empty() || !std::all_of(seg.begin(), seg.end(), [](unsigned char c) { return std::isdigit(c) != 0; })) {
            isIpv4 = false;
            break;
        }
        try {
            int val = std::stoi(seg);
            if (val < 0 || val > 255) {
                isIpv4 = false;
                break;
            }
            octets[partIdx++] = val;
        } catch (...) {
            isIpv4 = false;
            break;
        }
    }
    if (isIpv4 && partIdx == 4) {
        int a = octets[0], b = octets[1];
        if (a == 0 || a == 10 || a == 127) return fail("Chặn IP loopback/10.x/0.x nội bộ");
        if (a == 169 && b == 254) return fail("Chặn link-local / cloud metadata (169.254.x.x)");
        if (a == 172 && b >= 16 && b <= 31) return fail("Chặn IP private 172.16-31.x.x");
        if (a == 192 && b == 168) return fail("Chặn IP LAN 192.168.x.x");
        if (a == 100 && b >= 64 && b <= 127) return fail("Chặn CGNAT nội bộ 100.64.x.x");
    }
    return false;
}

} // namespace SaleApp::Security
