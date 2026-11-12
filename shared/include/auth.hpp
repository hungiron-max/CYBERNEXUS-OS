#pragma once

#include <string>
#include <unordered_map>
#include <mutex>
#include <chrono>
#include <optional>
#include "httplib.h"
#include "nlohmann/json.hpp"

namespace SaleApp::Backend {

using json = nlohmann::json;

struct SessionUser {
    int64_t id = 0;
    std::string user_code;
    std::string username;
    std::string fullname;
    std::string role; // admin, cashier, waiter, kitchen, customer
    bool is_super_admin = false;
    std::chrono::system_clock::time_point loginTime;
    std::chrono::system_clock::time_point lastActiveTime;
};

class AuthService {
public:
    static AuthService& instance();

    // Verify user login credentials (by username or user_code)
    json login(const std::string& usernameOrCode, const std::string& password);
    json loginPin(const std::string& pin);

    // Create session token (Thread-safe)
    std::string createSession(const SessionUser& user);
    bool validateSession(const std::string& token, SessionUser& outUser);
    void destroySession(const std::string& token);
    void touchSession(const std::string& token);
    size_t activeSessionCount();

    // Extract session from HTTP request (Cookie: pos_token / PHPSESSID or Authorization: Bearer)
    std::optional<SessionUser> authenticate(const httplib::Request& req);
    std::string extractToken(const httplib::Request& req);

    // Cookie helpers (Session cookie by default: maxAgeSecs = 0 -> expires when browser closes)
    static std::string formatCookie(const std::string& name, const std::string& value, int maxAgeSecs = 0);
    static std::string formatClearCookie(const std::string& name);
    void clearAllSessions();

    // Role check helper
    bool hasRole(const SessionUser& user, const std::string& requiredRole);

    // Cryptography helpers
    static std::string sha256(const std::string& input);
    static std::string hashPassword(const std::string& password);

private:
    AuthService();

    std::unordered_map<std::string, SessionUser> m_sessions;
    std::mutex m_mutex;
    const std::chrono::hours m_sessionTtl{24 * 7}; // 7 days session lifetime
};

} // namespace SaleApp::Backend
