#pragma once
/**
 * ============================================================================
 * CYBERNEXUS OS — HIGH PERFORMANCE EMBEDDED SQLITE3 ENGINE
 * ============================================================================
 * Thread-safe SQLite3 wrapper with WAL mode, JSON serialization and transactions.
 * ============================================================================
 */

#include <string>
#include <vector>
#include <mutex>
#include <memory>
#include <optional>
#include <sqlite3.h>
#include "nlohmann/json.hpp"

namespace CyberNexus {

using json = nlohmann::json;

class Database {
public:
    static Database& instance();

    bool open(const std::string& dbPath);
    void close();
    bool isOpen() const;

    // Execute statement (INSERT/UPDATE/DELETE/CREATE)
    // Returns lastInsertRowId if ok, or -1 on error
    int64_t execute(const std::string& sql, const std::vector<std::pair<std::string, json>>& params = {});

    // Query multiple rows returning a json array of objects
    json query(const std::string& sql, const std::vector<std::pair<std::string, json>>& params = {});

    // Query single row returning a json object or null
    json queryRow(const std::string& sql, const std::vector<std::pair<std::string, json>>& params = {});

    // Query scalar value (e.g. SELECT COUNT(*) or SELECT setting_value)
    json queryScalar(const std::string& sql, const std::vector<std::pair<std::string, json>>& params = {});

    // Initialize or verify Unified Schema
    bool initUnifiedSchema();

    // Transactions
    bool beginTransaction();
    bool commit();
    bool rollback();

    sqlite3* getRawHandle() const { return m_db; }
    std::string getLastError() const;

private:
    Database() = default;
    ~Database();
    Database(const Database&) = delete;
    Database& operator=(const Database&) = delete;

    bool bindParams(sqlite3_stmt* stmt, const std::vector<std::pair<std::string, json>>& params);

    sqlite3* m_db = nullptr;
    mutable std::recursive_mutex m_mutex;
    std::string m_lastError;
};

} // namespace CyberNexus
