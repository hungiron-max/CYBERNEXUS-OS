#include "db.hpp"
#include <iostream>

namespace CyberNexus {

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

    // Tối ưu hóa SQLite đa luồng: WAL mode, Normal sync, Foreign Keys
    sqlite3_exec(m_db, "PRAGMA foreign_keys = ON;", nullptr, nullptr, nullptr);
    sqlite3_exec(m_db, "PRAGMA journal_mode = WAL;", nullptr, nullptr, nullptr);
    sqlite3_exec(m_db, "PRAGMA synchronous = NORMAL;", nullptr, nullptr, nullptr);
    sqlite3_busy_timeout(m_db, 5000);

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

    int64_t lastId = sqlite3_last_insert_rowid(m_db);
    sqlite3_finalize(stmt);
    return lastId;
}

json Database::query(const std::string& sql, const std::vector<std::pair<std::string, json>>& params) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    json results = json::array();
    if (!m_db) return results;

    sqlite3_stmt* stmt = nullptr;
    int rc = sqlite3_prepare_v2(m_db, sql.c_str(), -1, &stmt, nullptr);
    if (rc != SQLITE_OK) {
        m_lastError = sqlite3_errmsg(m_db);
        std::cerr << "[DB Error] Prepare failed: " << m_lastError << " | SQL: " << sql << std::endl;
        return results;
    }

    bindParams(stmt, params);

    int colCount = sqlite3_column_count(stmt);
    while (sqlite3_step(stmt) == SQLITE_ROW) {
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
                    row[colName] = text ? reinterpret_cast<const char*>(text) : "";
                    break;
                }
                case SQLITE_NULL:
                    row[colName] = nullptr;
                    break;
                default:
                    row[colName] = "";
                    break;
            }
        }
        results.push_back(row);
    }

    sqlite3_finalize(stmt);
    return results;
}

json Database::queryRow(const std::string& sql, const std::vector<std::pair<std::string, json>>& params) {
    json arr = query(sql, params);
    if (!arr.empty() && arr.is_array()) {
        return arr[0];
    }
    return json(nullptr);
}

json Database::queryScalar(const std::string& sql, const std::vector<std::pair<std::string, json>>& params) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    if (!m_db) return json(nullptr);

    sqlite3_stmt* stmt = nullptr;
    int rc = sqlite3_prepare_v2(m_db, sql.c_str(), -1, &stmt, nullptr);
    if (rc != SQLITE_OK) {
        m_lastError = sqlite3_errmsg(m_db);
        return json(nullptr);
    }

    bindParams(stmt, params);

    json result = json(nullptr);
    if (sqlite3_step(stmt) == SQLITE_ROW && sqlite3_column_count(stmt) > 0) {
        int colType = sqlite3_column_type(stmt, 0);
        switch (colType) {
            case SQLITE_INTEGER:
                result = sqlite3_column_int64(stmt, 0);
                break;
            case SQLITE_FLOAT:
                result = sqlite3_column_double(stmt, 0);
                break;
            case SQLITE_TEXT: {
                const unsigned char* text = sqlite3_column_text(stmt, 0);
                result = text ? reinterpret_cast<const char*>(text) : "";
                break;
            }
            default:
                result = json(nullptr);
                break;
        }
    }

    sqlite3_finalize(stmt);
    return result;
}

bool Database::beginTransaction() {
    return execute("BEGIN TRANSACTION;") != -1;
}

bool Database::commit() {
    return execute("COMMIT;") != -1;
}

bool Database::rollback() {
    return execute("ROLLBACK;") != -1;
}

bool Database::initUnifiedSchema() {
    std::string ddl = R"(
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            pin_code TEXT DEFAULT '',
            fullname TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            role TEXT DEFAULT 'cashier',
            fund_balance REAL DEFAULT 0.0,
            loyalty_points INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT DEFAULT 'fa-mug-hot',
            sort_order INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active'
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            name TEXT NOT NULL,
            price REAL DEFAULT 0.0,
            cost_price REAL DEFAULT 0.0,
            unit TEXT DEFAULT 'ly',
            is_topping INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (category_id) REFERENCES categories(id)
        );

        CREATE TABLE IF NOT EXISTS tables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            area TEXT DEFAULT 'Tại Quán',
            status TEXT DEFAULT 'empty',
            current_order_id INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_code TEXT UNIQUE NOT NULL,
            user_id INTEGER,
            table_id INTEGER,
            subtotal REAL DEFAULT 0.0,
            discount REAL DEFAULT 0.0,
            total_amount REAL DEFAULT 0.0,
            payment_method TEXT DEFAULT 'cash',
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            price REAL DEFAULT 0.0,
            topping_note TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (order_id) REFERENCES orders(id)
        );

        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mac_address TEXT UNIQUE NOT NULL,
            last_ip TEXT DEFAULT '',
            device_name TEXT DEFAULT '',
            os_platform TEXT DEFAULT 'Unknown',
            user_id INTEGER,
            table_id INTEGER,
            qos_profile TEXT DEFAULT 'free_basic',
            is_blocked INTEGER DEFAULT 0,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS media_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist TEXT DEFAULT '',
            file_path TEXT NOT NULL,
            duration INTEGER DEFAULT 0,
            media_type TEXT DEFAULT 'audio',
            play_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS jukebox_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            media_id INTEGER NOT NULL,
            requested_by_user_id INTEGER,
            table_id INTEGER,
            priority_vote INTEGER DEFAULT 1,
            status TEXT DEFAULT 'waiting',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS store_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    )";

    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    if (!m_db) return false;

    char* errMsg = nullptr;
    int rc = sqlite3_exec(m_db, ddl.c_str(), nullptr, nullptr, &errMsg);
    if (rc != SQLITE_OK) {
        if (errMsg) {
            m_lastError = errMsg;
            sqlite3_free(errMsg);
        }
        std::cerr << "[DB Error] initUnifiedSchema failed: " << m_lastError << std::endl;
        return false;
    }

    // Nạp dữ liệu mẫu ban đầu nếu bảng settings trống
    auto check = queryScalar("SELECT COUNT(*) FROM store_settings WHERE setting_key = 'store_name'");
    if (check.is_number_integer() && check.get<int64_t>() == 0) {
        execute("INSERT INTO store_settings (setting_key, setting_value) VALUES ('store_name', 'CyberNexus Gaming & Coffee');");
        execute("INSERT INTO store_settings (setting_key, setting_value) VALUES ('vietqr_bank_id', 'MB');");
        execute("INSERT INTO store_settings (setting_key, setting_value) VALUES ('vietqr_account_no', '0987654321');");
        execute("INSERT INTO store_settings (setting_key, setting_value) VALUES ('vietqr_account_name', 'CYBERNEXUS OS');");

        // Tạo tài khoản admin mặc định
        execute("INSERT INTO users (username, password_hash, pin_code, fullname, role) VALUES ('admin', 'admin123', '9999', 'Quản Trị Viên', 'admin');");
        execute("INSERT INTO users (username, password_hash, pin_code, fullname, role) VALUES ('cashier', '123456', '1111', 'Thu Ngân 01', 'cashier');");
    }

    return true;
}

} // namespace CyberNexus
