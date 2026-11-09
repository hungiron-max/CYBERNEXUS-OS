#include "db.hpp"
#include <iostream>

namespace SaleApp::Backend {

Database& Database::instance() {
    static Database s_instance;
    return s_instance;
}

Database::~Database() {
    close();
}

bool Database::open(const std::string& dbPath) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    close();

    int rc = sqlite3_open(dbPath.c_str(), &m_db);
    if (rc != SQLITE_OK) {
        m_lastError = sqlite3_errmsg(m_db);
        std::cerr << "[DB Error] Cannot open database " << dbPath << ": " << m_lastError << std::endl;
        sqlite3_close(m_db);
        m_db = nullptr;
        return false;
    }

    // Tối ưu hóa SQLite cho POS đa luồng: WAL mode, Normal sync, Foreign Keys
    sqlite3_exec(m_db, "PRAGMA foreign_keys = ON;", nullptr, nullptr, nullptr);
    sqlite3_exec(m_db, "PRAGMA journal_mode = WAL;", nullptr, nullptr, nullptr);
    sqlite3_exec(m_db, "PRAGMA synchronous = NORMAL;", nullptr, nullptr, nullptr);
    sqlite3_busy_timeout(m_db, 5000); // 5s timeout on lock

    std::cout << "[DB Info] SQLite opened successfully: " << dbPath << std::endl;
    return true;
}

void Database::close() {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    if (m_db) {
        sqlite3_close(m_db);
        m_db = nullptr;
    }
}

bool Database::isOpen() const {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    return m_db != nullptr;
}

std::string Database::getLastError() const {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    return m_lastError;
}

bool Database::bindParams(sqlite3_stmt* stmt, const std::vector<std::pair<std::string, json>>& params) {
    for (const auto& [name, val] : params) {
        int idx = sqlite3_bind_parameter_index(stmt, name.c_str());
        if (idx == 0) continue;

        if (val.is_null()) {
            sqlite3_bind_null(stmt, idx);
        } else if (val.is_boolean()) {
            sqlite3_bind_int(stmt, idx, val.get<bool>() ? 1 : 0);
        } else if (val.is_number_integer()) {
            sqlite3_bind_int64(stmt, idx, val.get<int64_t>());
        } else if (val.is_number_float()) {
            sqlite3_bind_double(stmt, idx, val.get<double>());
        } else if (val.is_string()) {
            std::string s = val.get<std::string>();
            sqlite3_bind_text(stmt, idx, s.c_str(), -1, SQLITE_TRANSIENT);
        } else {
            std::string s = val.dump();
            sqlite3_bind_text(stmt, idx, s.c_str(), -1, SQLITE_TRANSIENT);
        }
    }
    return true;
}

int64_t Database::execute(const std::string& sql, const std::vector<std::pair<std::string, json>>& params) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    if (!m_db) return -1;

    sqlite3_stmt* stmt = nullptr;
    int rc = sqlite3_prepare_v2(m_db, sql.c_str(), -1, &stmt, nullptr);
    if (rc != SQLITE_OK) {
        m_lastError = sqlite3_errmsg(m_db);
        std::cerr << "[DB Error] Prepare failed: " << m_lastError << " | SQL: " << sql << std::endl;
        return -1;
    }

    bindParams(stmt, params);

    rc = sqlite3_step(stmt);
    if (rc != SQLITE_DONE && rc != SQLITE_ROW) {
        m_lastError = sqlite3_errmsg(m_db);
        std::cerr << "[DB Error] Step failed: " << m_lastError << " | SQL: " << sql << std::endl;
        sqlite3_finalize(stmt);
        return -1;
    }

    sqlite3_finalize(stmt);
    return sqlite3_last_insert_rowid(m_db);
}

static json extractRow(sqlite3_stmt* stmt, int colCount) {
    json row = json::object();
    for (int i = 0; i < colCount; ++i) {
        std::string colName = sqlite3_column_name(stmt, i);
        int colType = sqlite3_column_type(stmt, i);

        switch (colType) {
            case SQLITE_INTEGER:
                row[colName] = sqlite3_column_int64(stmt, i);
                break;
            case SQLITE_FLOAT:
                row[colName] = sqlite3_column_double(stmt, i);
                break;
            case SQLITE_TEXT: {
                const unsigned char* text = sqlite3_column_text(stmt, i);
                row[colName] = text ? std::string(reinterpret_cast<const char*>(text)) : "";
                break;
            }
            case SQLITE_BLOB: {
                const char* blob = reinterpret_cast<const char*>(sqlite3_column_blob(stmt, i));
                int bytes = sqlite3_column_bytes(stmt, i);
                row[colName] = blob ? std::string(blob, bytes) : "";
                break;
            }
            case SQLITE_NULL:
            default:
                row[colName] = nullptr;
                break;
        }
    }
    return row;
}

json Database::query(const std::string& sql, const std::vector<std::pair<std::string, json>>& params) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    json result = json::array();
    if (!m_db) return result;

    sqlite3_stmt* stmt = nullptr;
    int rc = sqlite3_prepare_v2(m_db, sql.c_str(), -1, &stmt, nullptr);
    if (rc != SQLITE_OK) {
        m_lastError = sqlite3_errmsg(m_db);
        std::cerr << "[DB Error] Prepare query failed: " << m_lastError << " | SQL: " << sql << std::endl;
        return result;
    }

    bindParams(stmt, params);

    int colCount = sqlite3_column_count(stmt);
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        result.push_back(extractRow(stmt, colCount));
    }

    sqlite3_finalize(stmt);
    return result;
}

json Database::queryRow(const std::string& sql, const std::vector<std::pair<std::string, json>>& params) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    if (!m_db) return nullptr;

    sqlite3_stmt* stmt = nullptr;
    int rc = sqlite3_prepare_v2(m_db, sql.c_str(), -1, &stmt, nullptr);
    if (rc != SQLITE_OK) {
        m_lastError = sqlite3_errmsg(m_db);
        return nullptr;
    }

    bindParams(stmt, params);

    json result = nullptr;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        result = extractRow(stmt, sqlite3_column_count(stmt));
    }

    sqlite3_finalize(stmt);
    return result;
}

json Database::queryScalar(const std::string& sql, const std::vector<std::pair<std::string, json>>& params) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    if (!m_db) return nullptr;

    sqlite3_stmt* stmt = nullptr;
    int rc = sqlite3_prepare_v2(m_db, sql.c_str(), -1, &stmt, nullptr);
    if (rc != SQLITE_OK) {
        m_lastError = sqlite3_errmsg(m_db);
        return nullptr;
    }

    bindParams(stmt, params);

    json result = nullptr;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        int colType = sqlite3_column_type(stmt, 0);
        switch (colType) {
            case SQLITE_INTEGER: result = sqlite3_column_int64(stmt, 0); break;
            case SQLITE_FLOAT: result = sqlite3_column_double(stmt, 0); break;
            case SQLITE_TEXT: {
                const unsigned char* text = sqlite3_column_text(stmt, 0);
                result = text ? std::string(reinterpret_cast<const char*>(text)) : "";
                break;
            }
            default: result = nullptr; break;
        }
    }

    sqlite3_finalize(stmt);
    return result;
}

bool Database::beginTransaction() {
    return execute("BEGIN TRANSACTION;") >= 0;
}

bool Database::commit() {
    return execute("COMMIT;") >= 0;
}

bool Database::rollback() {
    return execute("ROLLBACK;") >= 0;
}

} // namespace SaleApp::Backend

