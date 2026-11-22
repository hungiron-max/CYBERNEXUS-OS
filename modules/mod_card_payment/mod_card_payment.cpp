#define BUILDING_PLUGIN_DLL
#include "IModulePlugin.hpp"
#include "sqlite3.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <mutex>
#include <ctime>
#include <iomanip>
#include <random>
#include <cmath>
#include <algorithm>
#include <chrono>
#include <cstdlib>

namespace fs = std::filesystem;
using namespace CyberNexus;

class CardPaymentPlugin : public IModulePlugin {
private:
    sqlite3* m_db{nullptr};
    bool m_ownsDb{false};
    std::string m_appVersion;
    mutable std::mutex m_dbMutex;

    bool execSql(const std::string& sql) {
        std::lock_guard<std::mutex> lock(m_dbMutex);
        if (!m_db) return false;
        char* errMsg = nullptr;
        int rc = sqlite3_exec(m_db, sql.c_str(), nullptr, nullptr, &errMsg);
        if (rc != SQLITE_OK) {
            if (errMsg) sqlite3_free(errMsg);
            return false;
        }
        return true;
    }

    std::string sqlEscape(const std::string& s) const {
        std::string out;
        out.reserve(s.size() + 8);
        for (char c : s) {
            if (c == '\'') out += "''";
            else out += c;
        }
        return out;
    }

    json queryAll(const std::string& sql) const {
        std::lock_guard<std::mutex> lock(m_dbMutex);
        json arr = json::array();
        if (!m_db) return arr;

        sqlite3_stmt* stmt = nullptr;
        if (sqlite3_prepare_v2(m_db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            return arr;
        }

        int colCount = sqlite3_column_count(stmt);
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            json row = json::object();
            for (int i = 0; i < colCount; ++i) {
                const char* colName = sqlite3_column_name(stmt, i);
                int colType = sqlite3_column_type(stmt, i);
                if (colType == SQLITE_INTEGER) {
                    row[colName] = static_cast<int64_t>(sqlite3_column_int64(stmt, i));
                } else if (colType == SQLITE_FLOAT) {
                    row[colName] = sqlite3_column_double(stmt, i);
                } else if (colType == SQLITE_TEXT) {
                    const char* txt = reinterpret_cast<const char*>(sqlite3_column_text(stmt, i));
                    row[colName] = txt ? std::string(txt) : "";
                } else {
                    row[colName] = nullptr;
                }
            }
            arr.push_back(row);
        }
        sqlite3_finalize(stmt);
        return arr;
    }

    json queryOne(const std::string& sql) const {
        json all = queryAll(sql);
        if (!all.empty()) return all[0];
        return nullptr;
    }

    std::string generateRandomDigits(int len) const {
        static thread_local std::mt19937 rng(static_cast<unsigned int>(
            std::chrono::high_resolution_clock::now().time_since_epoch().count()));
        std::uniform_int_distribution<int> dist(0, 9);
        std::string s;
        for (int i = 0; i < len; ++i) {
            if (i == 0 && len > 1) {
                s += std::to_string(1 + (dist(rng) % 9));
            } else {
                s += std::to_string(dist(rng));
            }
        }
        return s;
    }

    std::string generateTxRef() const {
        std::time_t now = std::time(nullptr);
        std::tm tmNow{};
#ifdef _WIN32
        localtime_s(&tmNow, &now);
#else
        localtime_r(&now, &tmNow);
#endif
        char buf[32];
        std::strftime(buf, sizeof(buf), "%Y%m%d", &tmNow);
        return std::string("ECR-") + buf + "-" + generateRandomDigits(6);
    }

    void ensureTables() {
        // Ensure license cache columns for blocked_modules and card_fee_percent
        execSql("ALTER TABLE local_license_cache ADD COLUMN blocked_modules TEXT DEFAULT '[]';");
        execSql("ALTER TABLE local_license_cache ADD COLUMN card_fee_percent REAL DEFAULT 0.0;");

        // 1. Compatible Modern Terminals Catalog (Strict Whitelist of Modern SmartPOS / ECR Devices)
        execSql(R"(
            CREATE TABLE IF NOT EXISTS card_terminal_catalog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_code TEXT UNIQUE NOT NULL,
                brand TEXT NOT NULL,
                model_name TEXT NOT NULL,
                os_type TEXT NOT NULL,
                connection_type TEXT NOT NULL,
                default_port INTEGER DEFAULT 10009,
                protocol_family TEXT NOT NULL,
                pci_standard TEXT DEFAULT 'PCI PTS 6.x',
                supports_nfc INTEGER DEFAULT 1,
                supports_chip INTEGER DEFAULT 1,
                supports_qr INTEGER DEFAULT 1,
                verification_state TEXT DEFAULT 'SIMULATION_READY',
                is_blocked INTEGER DEFAULT 0
            );
        )");

        json catCount = queryOne("SELECT COUNT(*) as c FROM card_terminal_catalog");
        if (catCount.is_object() && catCount.value("c", 0) == 0) {
            execSql(R"(
                INSERT OR IGNORE INTO card_terminal_catalog
                (model_code, brand, model_name, os_type, connection_type, default_port, protocol_family, pci_standard, supports_nfc, supports_chip, supports_qr, verification_state, is_blocked)
                VALUES
                ('PAX_A920_PRO', 'PAX Technology', 'PAX A920 Pro (SmartPOS)', 'PayDroid (Android 10)', 'LAN / Wi-Fi TCP/IP', 10009, 'PAX POSLink Semi-Integrated ECR', 'PCI PTS 5.x SRED', 1, 1, 1, 'SIMULATION_READY', 0),
                ('PAX_A910S', 'PAX Technology', 'PAX A910S (SmartPOS)', 'PayDroid (Android 11)', 'LAN / Wi-Fi TCP/IP', 10009, 'PAX POSLink Semi-Integrated ECR', 'PCI PTS 6.x SRED', 1, 1, 1, 'SIMULATION_READY', 0),
                ('PAX_A35', 'PAX Technology', 'PAX A35 (Countertop PinPad)', 'PayDroid (Android 10)', 'Ethernet LAN TCP/IP', 10009, 'PAX POSLink Semi-Integrated ECR', 'PCI PTS 6.x SRED', 1, 1, 1, 'SIMULATION_READY', 0),
                ('SUNMI_P2_PRO', 'SUNMI', 'Sunmi P2 Pro (Smart Terminal)', 'SUNMI OS (Android)', 'LAN / Wi-Fi REST & TCP', 8989, 'SUNMI PaySDK / NEXO ECR JSON', 'PCI PTS 5.x SRED', 1, 1, 1, 'SIMULATION_READY', 0),
                ('SUNMI_P3', 'SUNMI', 'Sunmi P3 (Flagship SmartPOS)', 'SUNMI OS 4.0 (Android 11)', 'LAN / Wi-Fi REST & TCP', 8989, 'SUNMI PaySDK / NEXO ECR JSON', 'PCI PTS 6.x SRED', 1, 1, 1, 'SIMULATION_READY', 0),
                ('VERIFONE_V200C', 'Verifone', 'Verifone V200c (Countertop ECR)', 'Verifone Engage OS', 'Ethernet LAN TCP/IP', 5000, 'Verifone Concert / Semi-Integrated', 'PCI PTS 5.x SRED', 1, 1, 0, 'SIMULATION_READY', 0),
                ('VERIFONE_X990', 'Verifone', 'Verifone X990 (SmartPOS)', 'Android SmartPOS OS', 'LAN / Wi-Fi JSON API', 5000, 'Verifone SmartPOS ECR API', 'PCI PTS 5.x SRED', 1, 1, 1, 'SIMULATION_READY', 0),
                ('INGENICO_AXIUM_DX8000', 'Ingenico', 'Ingenico AXIUM DX8000', 'Android 10 AXIUM OS', 'LAN / Wi-Fi TCP/IP', 9500, 'Ingenico Semi-Integrated ECR', 'PCI PTS 6.x SRED', 1, 1, 1, 'SIMULATION_READY', 0),
                ('INGENICO_MOVE_5000', 'Ingenico', 'Ingenico Move/5000 (Dock LAN)', 'Telium TETRA OS', 'Ethernet Dock / Wi-Fi', 9500, 'Ingenico Telium Semi-Integrated', 'PCI PTS 5.x SRED', 1, 1, 0, 'SIMULATION_READY', 0),
                ('VNPAY_SMARTPOS', 'VNPAY / mPOS', 'VNPAY SmartPOS Pro All-in-One', 'Android SmartPOS', 'Cloud / LAN REST API', 443, 'VNPAY-POS Open ECR REST v2', 'PCI PTS 6.x SRED', 1, 1, 1, 'SIMULATION_READY', 0);
            )");
        }

        // 2. Store Terminal Adapter Configuration
        execSql(R"(
            CREATE TABLE IF NOT EXISTS card_terminal_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                model_code TEXT DEFAULT 'PAX_A920_PRO',
                acquirer_bank TEXT DEFAULT 'Vietcombank (VCB SmartPOS)',
                connection_mode TEXT DEFAULT 'LAN_TCP',
                terminal_ip TEXT DEFAULT '10.0.126.250',
                terminal_port INTEGER DEFAULT 10009,
                terminal_id_tid TEXT DEFAULT 'TID88901',
                merchant_id_mid TEXT DEFAULT 'MID000890123456',
                api_secret TEXT DEFAULT 'ECR-SECRET-KEY-2026',
                timeout_seconds INTEGER DEFAULT 60,
                customer_surcharge_percent REAL DEFAULT 0.0,
                simulation_mode INTEGER DEFAULT 1,
                sim_behavior TEXT DEFAULT 'AUTO_APPROVE',
                current_batch_no INTEGER DEFAULT 101,
                updated_at TEXT DEFAULT (datetime('now', 'localtime'))
            );
        )");

        json cfgRow = queryOne("SELECT id FROM card_terminal_config WHERE id = 1");
        if (cfgRow.is_null()) {
            execSql(R"(
                INSERT INTO card_terminal_config
                (id, model_code, acquirer_bank, connection_mode, terminal_ip, terminal_port, terminal_id_tid, merchant_id_mid, api_secret, timeout_seconds, customer_surcharge_percent, simulation_mode, sim_behavior, current_batch_no)
                VALUES
                (1, 'PAX_A920_PRO', 'Vietcombank (VCB SmartPOS)', 'LAN_TCP', '10.0.126.250', 10009, 'TID88901', 'MID000890123456', 'ECR-SECRET-KEY-2026', 60, 0.0, 1, 'AUTO_APPROVE', 101);
            )");
        }

        // 3. Card Transactions Log & Batch Settlement Table
        execSql(R"(
            CREATE TABLE IF NOT EXISTS card_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tx_ref TEXT UNIQUE NOT NULL,
                order_id INTEGER DEFAULT 0,
                table_code TEXT DEFAULT 'MV',
                base_amount REAL NOT NULL,
                surcharge_percent REAL DEFAULT 0.0,
                surcharge_amount REAL DEFAULT 0.0,
                total_charged REAL NOT NULL,
                master_fee_percent REAL DEFAULT 0.0,
                master_fee_amount REAL DEFAULT 0.0,
                terminal_model TEXT NOT NULL,
                acquirer_bank TEXT NOT NULL,
                tid TEXT NOT NULL,
                mid TEXT NOT NULL,
                card_scheme TEXT DEFAULT 'VISA',
                entry_mode TEXT DEFAULT 'NFC_TAP',
                masked_pan TEXT DEFAULT '**** **** **** 4829',
                cardholder_name TEXT DEFAULT 'KHACH HANG THE',
                approval_code TEXT DEFAULT '',
                rrn TEXT DEFAULT '',
                batch_no TEXT DEFAULT '000101',
                trace_no TEXT DEFAULT '000001',
                status TEXT DEFAULT 'APPROVED',
                response_code TEXT DEFAULT '00',
                response_message TEXT DEFAULT 'GIAO DICH THANH CONG (APPROVED)',
                is_simulation INTEGER DEFAULT 1,
                cashier_name TEXT DEFAULT 'Thu Ngân',
                void_reason TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                settled_at TEXT
            );
        )");
    }

    json getLicenseState() const {
        json row = queryOne("SELECT subscription_status, enabled_modules, blocked_modules, card_fee_percent FROM local_license_cache WHERE id = 1");
        bool isEnabled = false;
        bool isBlocked = false;
        double masterFeePercent = 0.0;

        if (!row.is_null() && row.is_object()) {
            std::string subStatus = row.value("subscription_status", "active");
            if (subStatus == "suspended") {
                isBlocked = true;
            }
            masterFeePercent = row.value("card_fee_percent", 0.0);

            std::string blockedRaw = row.value("blocked_modules", "[]");
            try {
                json bArr = json::parse(blockedRaw);
                if (bArr.is_array()) {
                    for (const auto& item : bArr) {
                        if (item.is_string()) {
                            std::string s = item.get<std::string>();
                            if (s == "mod_card_payment" || s == "card_payment") {
                                isBlocked = true;
                            }
                        }
                    }
                }
            } catch (...) {}

            std::string enabledRaw = row.value("enabled_modules", "[]");
            try {
                json eArr = json::parse(enabledRaw);
                if (eArr.is_array()) {
                    for (const auto& item : eArr) {
                        if (item.is_string()) {
                            std::string s = item.get<std::string>();
                            if (s == "mod_card_payment" || s == "card_payment") {
                                isEnabled = true;
                            }
                        }
                    }
                }
            } catch (...) {}
        }

        if (isBlocked) isEnabled = false;
        std::string stateStr = isBlocked ? "BLOCKED" : (isEnabled ? "ON" : "OFF");

        return {
            {"module_code", "mod_card_payment"},
            {"module_state", stateStr},
            {"is_enabled", isEnabled},
            {"is_blocked", isBlocked},
            {"master_fee_percent", masterFeePercent},
            {"monthly_price_vnd", 149000.0}
        };
    }

    json getSummaryMetrics() const {
        json todayRow = queryOne(R"(
            SELECT 
                COUNT(*) as today_count,
                COALESCE(SUM(CASE WHEN status IN ('APPROVED','SETTLED') THEN total_charged ELSE 0 END), 0) as today_total,
                COALESCE(SUM(CASE WHEN status IN ('APPROVED','SETTLED') THEN surcharge_amount ELSE 0 END), 0) as today_surcharge,
                COALESCE(SUM(CASE WHEN status IN ('APPROVED','SETTLED') THEN master_fee_amount ELSE 0 END), 0) as today_master_fee
            FROM card_transactions
            WHERE date(created_at) = date('now', 'localtime')
        )");

        json unsettledRow = queryOne(R"(
            SELECT 
                COUNT(*) as unsettled_count,
                COALESCE(SUM(total_charged), 0) as unsettled_total
            FROM card_transactions
            WHERE status = 'APPROVED'
        )");

        json monthRow = queryOne(R"(
            SELECT 
                COUNT(*) as month_count,
                COALESCE(SUM(CASE WHEN status IN ('APPROVED','SETTLED') THEN total_charged ELSE 0 END), 0) as month_total,
                COALESCE(SUM(CASE WHEN status IN ('APPROVED','SETTLED') THEN master_fee_amount ELSE 0 END), 0) as month_master_fee
            FROM card_transactions
            WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
        )");

        return {
            {"today_count", todayRow.is_object() ? todayRow.value("today_count", 0) : 0},
            {"today_total", todayRow.is_object() ? todayRow.value("today_total", 0.0) : 0.0},
            {"today_surcharge", todayRow.is_object() ? todayRow.value("today_surcharge", 0.0) : 0.0},
            {"today_master_fee", todayRow.is_object() ? todayRow.value("today_master_fee", 0.0) : 0.0},
            {"unsettled_count", unsettledRow.is_object() ? unsettledRow.value("unsettled_count", 0) : 0},
            {"unsettled_total", unsettledRow.is_object() ? unsettledRow.value("unsettled_total", 0.0) : 0.0},
            {"month_count", monthRow.is_object() ? monthRow.value("month_count", 0) : 0},
            {"month_total", monthRow.is_object() ? monthRow.value("month_total", 0.0) : 0.0},
            {"month_master_fee", monthRow.is_object() ? monthRow.value("month_master_fee", 0.0) : 0.0}
        };
    }

    static std::string normalizeSimBehaviorDb(const std::string& raw) {
        if (raw == "SIMULATE_DECLINE_51" || raw == "DECLINE_INSUFFICIENT") return "DECLINE_51";
        if (raw == "SIMULATE_EXPIRED" || raw == "DECLINE_EXPIRED") return "DECLINE_54";
        if (raw == "SIMULATE_TIMEOUT") return "TIMEOUT";
        return raw.empty() ? "AUTO_APPROVE" : raw;
    }

    static std::string normalizeSimBehaviorUi(const std::string& raw) {
        if (raw == "DECLINE_51" || raw == "DECLINE_INSUFFICIENT") return "SIMULATE_DECLINE_51";
        if (raw == "TIMEOUT" || raw == "DECLINE_91") return "SIMULATE_TIMEOUT";
        return raw.empty() ? "AUTO_APPROVE" : raw;
    }

    json enrichConfigForUi(json cfg) const {
        if (!cfg.is_object()) cfg = json::object();
        std::string sec = cfg.value("api_secret", "");
        if (sec.length() > 6) {
            cfg["api_secret_masked"] = sec.substr(0, 4) + "••••••••" + sec.substr(sec.length() - 2);
        } else {
            cfg["api_secret_masked"] = "••••••••";
        }
        cfg["connection_type"] = cfg.value("connection_mode", "LAN_TCP");
        cfg["tid"] = cfg.value("terminal_id_tid", "TID88901");
        cfg["mid"] = cfg.value("merchant_id_mid", "MID000890123456");
        cfg["simulation_behavior"] = normalizeSimBehaviorUi(cfg.value("sim_behavior", "AUTO_APPROVE"));
        cfg.erase("api_secret");
        return cfg;
    }

    static json enrichCatalogForUi(const json& catalog) {
        json out = json::array();
        if (!catalog.is_array()) return out;
        for (auto item : catalog) {
            if (!item.is_object()) continue;
            item["security_standard"] = item.value("pci_standard", "PCI PTS 6.x");
            item["protocol"] = item.value("protocol_family", "");
            std::string ifaces = item.value("connection_type", "LAN TCP/IP");
            if (item.value("supports_nfc", 1)) ifaces += ", NFC";
            if (item.value("supports_chip", 1)) ifaces += ", EMV Chip";
            if (item.value("supports_qr", 1)) ifaces += ", QR";
            item["supported_interfaces"] = ifaces;
            out.push_back(item);
        }
        return out;
    }

    static bool sendLanTcpEcr(const std::string& ip, int port, int timeoutSec, const json& reqJson,
                              json& respJsonOut, long long& latencyMsOut, std::string& errOut) {
        auto t0 = std::chrono::steady_clock::now();
        if (ip.empty() || port <= 0 || port > 65535) {
            errOut = "Địa chỉ IP hoặc Port ECR không hợp lệ (" + ip + ":" + std::to_string(port) + ")";
            latencyMsOut = 0;
            return false;
        }
#ifdef _WIN32
        WSADATA wsaData{};
        WSAStartup(MAKEWORD(2, 2), &wsaData);

        struct addrinfo hints{};
        hints.ai_family = AF_INET;
        hints.ai_socktype = SOCK_STREAM;
        hints.ai_protocol = IPPROTO_TCP;
        struct addrinfo* resInfo = nullptr;
        std::string portStr = std::to_string(port);
        if (getaddrinfo(ip.c_str(), portStr.c_str(), &hints, &resInfo) != 0 || !resInfo) {
            latencyMsOut = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
            errOut = "Không phân giải được IP/Host SmartPOS: " + ip + ":" + portStr;
            return false;
        }

        SOCKET sock = socket(resInfo->ai_family, resInfo->ai_socktype, resInfo->ai_protocol);
        if (sock == INVALID_SOCKET) {
            int wsaErr = WSAGetLastError();
            freeaddrinfo(resInfo);
            latencyMsOut = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
            errOut = "Không tạo được TCP Socket tới SmartPOS (WSA " + std::to_string(wsaErr) + ")";
            return false;
        }

        u_long nonBlock = 1;
        ioctlsocket(sock, FIONBIO, &nonBlock);
        int connRc = connect(sock, resInfo->ai_addr, static_cast<int>(resInfo->ai_addrlen));
        if (connRc == SOCKET_ERROR) {
            int wsaErr = WSAGetLastError();
            if (wsaErr != WSAEWOULDBLOCK && wsaErr != WSAEINPROGRESS) {
                closesocket(sock);
                freeaddrinfo(resInfo);
                latencyMsOut = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
                errOut = "Kết nối TCP SmartPOS thất bại (" + ip + ":" + portStr + ", WSA " + std::to_string(wsaErr) + ")";
                return false;
            }
            fd_set writeSet, errSet;
            FD_ZERO(&writeSet);
            FD_ZERO(&errSet);
            FD_SET(sock, &writeSet);
            FD_SET(sock, &errSet);
            timeval tv{};
            tv.tv_sec = std::max(2, std::min(timeoutSec, 5));
            tv.tv_usec = 0;
            int sel = select(0, nullptr, &writeSet, &errSet, &tv);
            if (sel <= 0 || FD_ISSET(sock, &errSet) || !FD_ISSET(sock, &writeSet)) {
                closesocket(sock);
                freeaddrinfo(resInfo);
                latencyMsOut = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
                errOut = "Hết thời gian kết nối tới máy SmartPOS LAN (" + ip + ":" + portStr + ")";
                return false;
            }
            int soErr = 0;
            int soLen = sizeof(soErr);
            getsockopt(sock, SOL_SOCKET, SO_ERROR, reinterpret_cast<char*>(&soErr), &soLen);
            if (soErr != 0) {
                closesocket(sock);
                freeaddrinfo(resInfo);
                latencyMsOut = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
                errOut = "SmartPOS từ chối kết nối TCP tại " + ip + ":" + portStr + " (SO_ERROR=" + std::to_string(soErr) + ")";
                return false;
            }
        }
        freeaddrinfo(resInfo);

        nonBlock = 0;
        ioctlsocket(sock, FIONBIO, &nonBlock);
        DWORD ioMs = static_cast<DWORD>(std::max(3, timeoutSec) * 1000);
        setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&ioMs), sizeof(ioMs));
        setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&ioMs), sizeof(ioMs));

        std::string wireOut = reqJson.dump() + "\n";
        size_t sentTotal = 0;
        while (sentTotal < wireOut.size()) {
            int s = send(sock, wireOut.data() + sentTotal, static_cast<int>(wireOut.size() - sentTotal), 0);
            if (s <= 0) {
                int wsaErr = WSAGetLastError();
                closesocket(sock);
                latencyMsOut = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
                errOut = "Gửi lệnh ECR qua TCP thất bại (WSA " + std::to_string(wsaErr) + ")";
                return false;
            }
            sentTotal += static_cast<size_t>(s);
        }

        std::string rawResp;
        char buf[2048];
        while (true) {
            int r = recv(sock, buf, sizeof(buf), 0);
            if (r > 0) {
                rawResp.append(buf, r);
                if (rawResp.find('\n') != std::string::npos || rawResp.size() > 65536) break;
            } else {
                break;
            }
        }
        closesocket(sock);
        latencyMsOut = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
        while (!rawResp.empty() && (rawResp.back() == '\n' || rawResp.back() == '\r' || rawResp.back() == '\x03')) rawResp.pop_back();
        if (!rawResp.empty() && rawResp.front() == '\x02') rawResp.erase(rawResp.begin());
        if (rawResp.empty()) {
            errOut = "SmartPOS đóng kết nối hoặc quá hạn đọc phản hồi từ " + ip + ":" + portStr;
            return false;
        }
        respJsonOut = json::parse(rawResp, nullptr, false);
        if (respJsonOut.is_discarded() || !respJsonOut.is_object()) {
            errOut = "Phản hồi TCP từ SmartPOS không đúng định dạng JSON: " + rawResp.substr(0, 100);
            return false;
        }
        return true;
#else
        (void)timeoutSec;
        (void)reqJson;
        (void)respJsonOut;
        latencyMsOut = 0;
        errOut = "LAN TCP ECR yêu cầu Windows Winsock runtime";
        return false;
#endif
    }

    static bool sendWifiRestEcr(const std::string& ip, int port, const std::string& secret, const std::string& path,
                               int timeoutSec, const json& reqJson, json& respJsonOut, long long& latencyMsOut, std::string& errOut) {
        auto t0 = std::chrono::steady_clock::now();
        if (ip.empty() || port <= 0 || port > 65535) {
            errOut = "IP/Port Wi-Fi REST ECR không hợp lệ";
            latencyMsOut = 0;
            return false;
        }
        httplib::Client cli(ip, port);
        cli.set_connection_timeout(std::max(2, std::min(timeoutSec, 5)), 0);
        cli.set_read_timeout(std::max(3, timeoutSec), 0);
        httplib::Headers hdrs;
        if (!secret.empty()) hdrs.emplace("X-ECR-Secret", secret);
        auto res = cli.Post(path.c_str(), hdrs, reqJson.dump(), "application/json");
        latencyMsOut = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
        if (!res) {
            errOut = "Không kết nối được Wi-Fi REST SmartPOS (" + ip + ":" + std::to_string(port) + path + ")";
            return false;
        }
        respJsonOut = json::parse(res->body, nullptr, false);
        if (respJsonOut.is_discarded() || !respJsonOut.is_object()) {
            errOut = "HTTP " + std::to_string(res->status) + " từ SmartPOS không trả JSON hợp lệ";
            return false;
        }
        if (res->status >= 500) {
            errOut = respJsonOut.value("message", "SmartPOS HTTP " + std::to_string(res->status));
            return false;
        }
        return true;
    }

    static bool sendUsbSerialEcr(const std::string& comPortIn, int timeoutSec, const json& reqJson,
                                 json& respJsonOut, long long& latencyMsOut, std::string& errOut) {
        auto t0 = std::chrono::steady_clock::now();
        std::string portUpper = comPortIn;
        for (char& c : portUpper) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
        bool validCom = (portUpper.rfind("COM", 0) == 0 && portUpper.size() >= 4 && portUpper.size() <= 6);
        if (validCom) {
            for (size_t i = 3; i < portUpper.size(); ++i) {
                if (!std::isdigit(static_cast<unsigned char>(portUpper[i]))) { validCom = false; break; }
            }
        }
        if (!validCom) {
            latencyMsOut = 0;
            errOut = "Tên cổng USB-CDC COM không hợp lệ (ví dụ: COM3, nhập thực tế vào ô IP/COM): " + comPortIn;
            return false;
        }
#ifdef _WIN32
        std::string devPath = "\\\\.\\" + portUpper;
        HANDLE hCom = CreateFileA(devPath.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
        if (hCom == INVALID_HANDLE_VALUE) {
            DWORD gle = GetLastError();
            latencyMsOut = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
            errOut = "Không mở được cổng nối tiếp " + portUpper + " (Win32 Error " + std::to_string(gle) + ")";
            return false;
        }
        DCB dcb{};
        dcb.DCBlength = sizeof(dcb);
        if (GetCommState(hCom, &dcb)) {
            dcb.BaudRate = CBR_115200;
            dcb.ByteSize = 8;
            dcb.Parity = NOPARITY;
            dcb.StopBits = ONESTOPBIT;
            SetCommState(hCom, &dcb);
        }
        COMMTIMEOUTS tos{};
        tos.ReadIntervalTimeout = 50;
        tos.ReadTotalTimeoutConstant = static_cast<DWORD>(std::max(3, timeoutSec) * 1000);
        tos.ReadTotalTimeoutMultiplier = 10;
        tos.WriteTotalTimeoutConstant = 3000;
        tos.WriteTotalTimeoutMultiplier = 10;
        SetCommTimeouts(hCom, &tos);

        std::string frame = "\x02" + reqJson.dump() + "\x03\n";
        DWORD written = 0;
        if (!WriteFile(hCom, frame.data(), static_cast<DWORD>(frame.size()), &written, nullptr) || written == 0) {
            DWORD gle = GetLastError();
            CloseHandle(hCom);
            latencyMsOut = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
            errOut = "Ghi dữ liệu ra cổng " + portUpper + " thất bại (Win32 Error " + std::to_string(gle) + ")";
            return false;
        }
        std::string rawResp;
        char buf[1024];
        DWORD readBytes = 0;
        while (ReadFile(hCom, buf, sizeof(buf), &readBytes, nullptr) && readBytes > 0) {
            rawResp.append(buf, readBytes);
            if (rawResp.find('\n') != std::string::npos || rawResp.find('\x03') != std::string::npos || rawResp.size() > 65536) break;
        }
        CloseHandle(hCom);
        latencyMsOut = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
        while (!rawResp.empty() && (rawResp.back() == '\n' || rawResp.back() == '\r' || rawResp.back() == '\x03')) rawResp.pop_back();
        if (!rawResp.empty() && rawResp.front() == '\x02') rawResp.erase(rawResp.begin());
        if (rawResp.empty()) {
            errOut = "Không nhận được phản hồi từ thiết bị SmartPOS trên " + portUpper;
            return false;
        }
        respJsonOut = json::parse(rawResp, nullptr, false);
        if (respJsonOut.is_discarded() || !respJsonOut.is_object()) {
            errOut = "Phản hồi COM từ SmartPOS không đúng định dạng JSON";
            return false;
        }
        return true;
#else
        (void)timeoutSec;
        (void)reqJson;
        (void)respJsonOut;
        latencyMsOut = 0;
        errOut = "USB_CDC COM chỉ hỗ trợ trên Windows";
        return false;
#endif
    }

    static bool dispatchTerminalCommand(const std::string& connMode, const std::string& ipOrCom, int port,
                                        const std::string& secret, int timeoutSec, const std::string& restPath,
                                        const json& reqJson, json& respJsonOut, long long& latencyMsOut, std::string& errOut) {
        if (connMode == "WIFI_REST" || connMode == "REST") {
            return sendWifiRestEcr(ipOrCom, port, secret, restPath, timeoutSec, reqJson, respJsonOut, latencyMsOut, errOut);
        }
        if (connMode == "USB_CDC" || connMode == "SERIAL_COM") {
            return sendUsbSerialEcr(ipOrCom, timeoutSec, reqJson, respJsonOut, latencyMsOut, errOut);
        }
        return sendLanTcpEcr(ipOrCom, port, timeoutSec, reqJson, respJsonOut, latencyMsOut, errOut);
    }

public:
    ModuleMetadata getMetadata() const override {
        ModuleMetadata m;
        m.code = "mod_card_payment";
        m.name = "Cổng Cà Thẻ Tín Dụng & SmartPOS Ngân Hàng";
        m.version = "1.0.0";
        m.author = "SuperAdmin";
        m.category = "Payment";
        m.description = "Tích hợp tự động máy cà thẻ đời mới (PAX, Sunmi, Verifone, Ingenico, VNPAY SmartPOS) qua LAN TCP/IP & REST API; tự đẩy số tiền sang máy POS, đối soát lô (Batch Settlement) và báo cáo phí thẻ.";
        m.monthly_price_vnd = 149000.0;
        m.is_core_required = false;
        m.dependencies = {"pos_core"};
        return m;
    }

    bool onLoad(const CoreContext& ctx) override {
        m_appVersion = ctx.appVersion;
        // DLL compiles its own static sqlite3.c, so open DB path directly instead of sharing exe sqlite3*.
        std::string dbPath = "./database/store_local.db";
        if (const char* envDb = std::getenv("CYBERNEXUS_DB_PATH"); envDb && *envDb) {
            dbPath = envDb;
        }
        if (sqlite3_open_v2(dbPath.c_str(), &m_db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nullptr) != SQLITE_OK) {
            std::cerr << "[mod_card_payment Error] Khong the mo CSDL tai " << dbPath << std::endl;
            return false;
        }
        m_ownsDb = true;
        sqlite3_busy_timeout(m_db, 5000);
        execSql("PRAGMA journal_mode = WAL;");
        ensureTables();
        std::cout << "[mod_card_payment] Kích hoạt Cổng Cà Thẻ Tín Dụng & SmartPOS Adapter (LAN TCP / Wi-Fi REST / USB-CDC COM + Simulation)." << std::endl;
        return true;
    }

    void onUnload() override {
        std::lock_guard<std::mutex> lock(m_dbMutex);
        if (m_db && m_ownsDb) {
            sqlite3_close(m_db);
        }
        m_db = nullptr;
        m_ownsDb = false;
        std::cout << "[mod_card_payment] Đã đóng kết nối Cổng Cà Thẻ Tín Dụng." << std::endl;
    }

    void registerHttpRoutes(httplib::Server& svr) override {
        // 1. GET /api/card/status - Lấy trạng thái bản quyền ON/OFF/BLOCK, cấu hình adapter & danh mục máy đời mới
        svr.Get("/api/card/status", [this](const httplib::Request&, httplib::Response& res) {
            json lic = getLicenseState();
            json rawCfg = queryOne("SELECT * FROM card_terminal_config WHERE id = 1");
            json rawCatalog = queryAll("SELECT * FROM card_terminal_catalog ORDER BY id ASC");
            json catalog = enrichCatalogForUi(rawCatalog);
            json summary = getSummaryMetrics();
            json cfg = enrichConfigForUi(rawCfg);
            bool isSim = (cfg.value("simulation_mode", 1) != 0);

            json out = {
                {"success", true},
                {"license", lic},
                {"module_state", lic["module_state"]},
                {"is_enabled", lic["is_enabled"]},
                {"is_blocked", lic["is_blocked"]},
                {"simulation_mode", isSim},
                {"master_fee_percent", lic["master_fee_percent"]},
                {"config", cfg},
                {"catalog", catalog},
                {"compatible_terminals", catalog},
                {"summary", summary}
            };
            res.set_content(out.dump(), "application/json; charset=utf-8");
        });

        // 2. POST /api/card/config - Lưu cấu hình thiết bị SmartPOS & Adapter
        svr.Post("/api/card/config", [this](const httplib::Request& req, httplib::Response& res) {
            json lic = getLicenseState();
            if (lic.value("is_blocked", false)) {
                res.status = 403;
                res.set_content("{\"success\":false,\"state\":\"BLOCKED\",\"message\":\"Module Cổng Cà Thẻ Tín Dụng đang bị KHÓA (BLOCKED) bởi Trung tâm Điều hành Master!\"}", "application/json; charset=utf-8");
                return;
            }
            if (!lic.value("is_enabled", false)) {
                res.status = 403;
                res.set_content("{\"success\":false,\"state\":\"OFF\",\"message\":\"Module Cổng Cà Thẻ Tín Dụng chưa được bật bản quyền từ Master!\"}", "application/json; charset=utf-8");
                return;
            }

            try {
                json body = json::parse(req.body);
                json prevCfg = queryOne("SELECT * FROM card_terminal_config WHERE id = 1");
                std::string modelCode = body.value("model_code", prevCfg.value("model_code", "PAX_A920_PRO"));

                // Kiểm tra bắt buộc thuộc danh mục máy đời mới tương thích
                json modelRow = queryOne("SELECT * FROM card_terminal_catalog WHERE model_code = '" + sqlEscape(modelCode) + "' LIMIT 1");
                if (modelRow.is_null()) {
                    res.status = 400;
                    res.set_content("{\"success\":false,\"message\":\"Đời máy không nằm trong danh sách thiết bị đời mới tương thích! Vui lòng chọn dòng máy SmartPOS/ECR được hỗ trợ.\"}", "application/json; charset=utf-8");
                    return;
                }
                if (modelRow.value("is_blocked", 0) != 0) {
                    res.status = 400;
                    res.set_content("{\"success\":false,\"message\":\"Model máy này hiện đang bị tạm ngưng hỗ trợ bởi Master!\"}", "application/json; charset=utf-8");
                    return;
                }

                std::string acquirerBank = body.value("acquirer_bank", prevCfg.value("acquirer_bank", "Vietcombank (VCB SmartPOS)"));
                std::string connMode = body.contains("connection_mode")
                    ? body.value("connection_mode", "LAN_TCP")
                    : body.value("connection_type", prevCfg.value("connection_mode", "LAN_TCP"));
                std::string termIp = body.value("terminal_ip", prevCfg.value("terminal_ip", "10.0.126.250"));
                int termPort = body.value("terminal_port", modelRow.value("default_port", prevCfg.value("terminal_port", 10009)));
                std::string tid = body.contains("terminal_id_tid")
                    ? body.value("terminal_id_tid", "TID88901")
                    : body.value("tid", prevCfg.value("terminal_id_tid", "TID88901"));
                std::string mid = body.contains("merchant_id_mid")
                    ? body.value("merchant_id_mid", "MID000890123456")
                    : body.value("mid", prevCfg.value("merchant_id_mid", "MID000890123456"));
                std::string secret = body.contains("api_secret")
                    ? body.value("api_secret", "")
                    : body.value("secret_key", "");
                int timeoutSec = std::max(5, std::min(180, body.value("timeout_seconds", prevCfg.value("timeout_seconds", 60))));
                double surchargePct = std::max(0.0, std::min(10.0, body.value("customer_surcharge_percent", prevCfg.value("customer_surcharge_percent", 0.0))));
                int simMode = prevCfg.value("simulation_mode", 1);
                if (body.contains("simulation_mode")) {
                    if (body["simulation_mode"].is_boolean()) simMode = body["simulation_mode"].get<bool>() ? 1 : 0;
                    else if (body["simulation_mode"].is_number_integer()) simMode = body["simulation_mode"].get<int>() != 0 ? 1 : 0;
                    else if (body["simulation_mode"].is_string()) simMode = (body["simulation_mode"].get<std::string>() == "0" || body["simulation_mode"].get<std::string>() == "false") ? 0 : 1;
                }
                std::string simBehavior = body.contains("sim_behavior")
                    ? body.value("sim_behavior", "AUTO_APPROVE")
                    : body.value("simulation_behavior", prevCfg.value("sim_behavior", "AUTO_APPROVE"));
                simBehavior = normalizeSimBehaviorDb(simBehavior);

                std::string secretSql = "";
                if (!secret.empty() && secret.find("••") == std::string::npos) {
                    secretSql = ", api_secret = '" + sqlEscape(secret) + "'";
                }

                std::ostringstream sql;
                sql << "UPDATE card_terminal_config SET "
                    << "model_code = '" << sqlEscape(modelCode) << "', "
                    << "acquirer_bank = '" << sqlEscape(acquirerBank) << "', "
                    << "connection_mode = '" << sqlEscape(connMode) << "', "
                    << "terminal_ip = '" << sqlEscape(termIp) << "', "
                    << "terminal_port = " << termPort << ", "
                    << "terminal_id_tid = '" << sqlEscape(tid) << "', "
                    << "merchant_id_mid = '" << sqlEscape(mid) << "', "
                    << "timeout_seconds = " << timeoutSec << ", "
                    << "customer_surcharge_percent = " << surchargePct << ", "
                    << "simulation_mode = " << simMode << ", "
                    << "sim_behavior = '" << sqlEscape(simBehavior) << "'"
                    << secretSql << ", "
                    << "updated_at = datetime('now', 'localtime') WHERE id = 1;";

                execSql(sql.str());

                json saved = enrichConfigForUi(queryOne("SELECT * FROM card_terminal_config WHERE id = 1"));
                json out = {
                    {"success", true},
                    {"simulation_mode", simMode != 0},
                    {"message", "Đã lưu cấu hình Adapter " + modelRow.value("model_name", modelCode) + (simMode ? " (Chế độ Mô phỏng)!" : " (Kết nối Thiết bị Thật " + connMode + " " + termIp + ":" + std::to_string(termPort) + ")!")},
                    {"config", saved}
                };
                res.set_content(out.dump(), "application/json; charset=utf-8");
            } catch (const std::exception& e) {
                res.status = 400;
                res.set_content(json({{"success", false}, {"message", std::string("Lỗi dữ liệu cấu hình: ") + e.what()}}).dump(), "application/json; charset=utf-8");
            }
        });

        // 3. POST /api/card/test-connection - Kiểm tra kết nối Handshake ECR với máy POS (Mô phỏng hoặc LAN TCP / Wi-Fi REST / USB-CDC COM)
        svr.Post("/api/card/test-connection", [this](const httplib::Request& req, httplib::Response& res) {
            json lic = getLicenseState();
            if (!lic.value("is_enabled", false)) {
                res.status = 403;
                res.set_content(json({
                    {"success", false},
                    {"state", lic["module_state"]},
                    {"message", lic.value("is_blocked", false)
                        ? "Module đang bị KHÓA (BLOCKED) bởi Master!"
                        : "Module chưa được cấp phép (OFF) trên Master!"}
                }).dump(), "application/json; charset=utf-8");
                return;
            }

            json cfg = queryOne("SELECT * FROM card_terminal_config WHERE id = 1");
            std::string modelCode = cfg.value("model_code", "PAX_A920_PRO");
            std::string connMode = cfg.value("connection_mode", "LAN_TCP");
            std::string termIp = cfg.value("terminal_ip", "10.0.126.250");
            int termPort = cfg.value("terminal_port", 10009);
            std::string tid = cfg.value("terminal_id_tid", "TID88901");
            std::string mid = cfg.value("merchant_id_mid", "MID000890123456");
            std::string secret = cfg.value("api_secret", "");
            int simMode = cfg.value("simulation_mode", 1);

            if (!req.body.empty()) {
                try {
                    json b = json::parse(req.body);
                    if (b.is_object()) {
                        if (b.contains("model_code") && b["model_code"].is_string()) modelCode = b["model_code"].get<std::string>();
                        if (b.contains("connection_mode") && b["connection_mode"].is_string()) connMode = b["connection_mode"].get<std::string>();
                        else if (b.contains("connection_type") && b["connection_type"].is_string()) connMode = b["connection_type"].get<std::string>();
                        if (b.contains("terminal_ip") && b["terminal_ip"].is_string() && !b["terminal_ip"].get<std::string>().empty()) termIp = b["terminal_ip"].get<std::string>();
                        if (b.contains("terminal_port") && b["terminal_port"].is_number_integer()) termPort = b["terminal_port"].get<int>();
                        if (b.contains("simulation_mode")) {
                            if (b["simulation_mode"].is_boolean()) simMode = b["simulation_mode"].get<bool>() ? 1 : 0;
                            else if (b["simulation_mode"].is_number_integer()) simMode = b["simulation_mode"].get<int>() != 0 ? 1 : 0;
                        }
                    }
                } catch (...) {}
            }

            json modelRow = queryOne("SELECT * FROM card_terminal_catalog WHERE model_code = '" + sqlEscape(modelCode) + "' LIMIT 1");
            if (modelRow.is_null()) {
                res.status = 400;
                res.set_content("{\"success\":false,\"message\":\"Model máy không hợp lệ hoặc không thuộc thế hệ SmartPOS đời mới!\"}", "application/json; charset=utf-8");
                return;
            }
            std::string modelName = modelRow.value("model_name", modelCode);

            if (simMode != 0) {
                json out = {
                    {"success", true},
                    {"status", "CONNECTED"},
                    {"simulation_mode", true},
                    {"terminal_name", modelName},
                    {"firmware", "ECR-Sim v3.2"},
                    {"latency_ms", 12},
                    {"message", "Bắt tay ECR Handshake thành công (CHẾ ĐỘ MÔ PHỎNG — CHƯA NỐI THIẾT BỊ THẬT)!"},
                    {"handshake", {
                        {"terminal_model", modelName},
                        {"brand", modelRow.value("brand", "")},
                        {"os_type", modelRow.value("os_type", "")},
                        {"protocol", modelRow.value("protocol_family", "")},
                        {"pci_standard", modelRow.value("pci_standard", "PCI PTS 6.x")},
                        {"endpoint", termIp + ":" + std::to_string(termPort)},
                        {"tid", tid},
                        {"mid", mid},
                        {"acquirer_bank", cfg.value("acquirer_bank", "Vietcombank")},
                        {"latency_ms", 12},
                        {"status", "READY_FOR_SALE"}
                    }}
                };
                res.set_content(out.dump(), "application/json; charset=utf-8");
                return;
            }

            json echoReq = {
                {"cmd", "ECHO"},
                {"model_code", modelCode},
                {"tid", tid},
                {"mid", mid}
            };
            json hwResp;
            long long latMs = 0;
            std::string errMsg;
            if (!dispatchTerminalCommand(connMode, termIp, termPort, secret, 4, "/ecr/echo", echoReq, hwResp, latMs, errMsg)) {
                res.status = 502;
                res.set_content(json({
                    {"success", false},
                    {"status", "DISCONNECTED"},
                    {"simulation_mode", false},
                    {"connection_mode", connMode},
                    {"endpoint", termIp + ":" + std::to_string(termPort)},
                    {"latency_ms", latMs},
                    {"message", errMsg}
                }).dump(), "application/json; charset=utf-8");
                return;
            }

            std::string hwStatus = hwResp.value("status", "CONNECTED");
            bool hwOk = hwResp.value("success", hwResp.value("ok", (hwStatus == "CONNECTED" || hwStatus == "READY_FOR_SALE" || hwStatus == "OK")));
            if (!hwOk) {
                res.status = 502;
                res.set_content(json({
                    {"success", false},
                    {"status", "DISCONNECTED"},
                    {"simulation_mode", false},
                    {"latency_ms", latMs},
                    {"message", hwResp.value("message", "SmartPOS từ chối gói tin ECHO HANDSHAKE.")}
                }).dump(), "application/json; charset=utf-8");
                return;
            }

            std::string fw = hwResp.value("firmware", "SmartPOS-ECR v1.0");
            std::string hwName = hwResp.value("terminal_name", modelName);
            json out = {
                {"success", true},
                {"status", "CONNECTED"},
                {"simulation_mode", false},
                {"connection_mode", connMode},
                {"terminal_name", hwName},
                {"firmware", fw},
                {"latency_ms", latMs},
                {"message", "Kết nối thiết bị thật thành công (" + connMode + " • " + termIp + (connMode == "USB_CDC" ? "" : (":" + std::to_string(termPort))) + ")!"},
                {"handshake", {
                    {"terminal_model", hwName},
                    {"brand", modelRow.value("brand", "")},
                    {"protocol", modelRow.value("protocol_family", "")},
                    {"endpoint", termIp + (connMode == "USB_CDC" ? "" : (":" + std::to_string(termPort)))},
                    {"tid", tid},
                    {"mid", mid},
                    {"latency_ms", latMs},
                    {"firmware", fw},
                    {"status", "READY_FOR_SALE"}
                }}
            };
            res.set_content(out.dump(), "application/json; charset=utf-8");
        });

        // 4. POST /api/card/charge - Đẩy lệnh thanh toán tự động sang máy cà thẻ (Auto Semi-Integrated ECR Sale)
        svr.Post("/api/card/charge", [this](const httplib::Request& req, httplib::Response& res) {
            json lic = getLicenseState();
            if (lic.value("is_blocked", false)) {
                res.status = 403;
                res.set_content("{\"success\":false,\"state\":\"BLOCKED\",\"message\":\"Module Cổng Cà Thẻ Tín Dụng đang bị KHÓA CƯỠNG CHẾ (BLOCKED) bởi Master!\"}", "application/json; charset=utf-8");
                return;
            }
            if (!lic.value("is_enabled", false)) {
                res.status = 403;
                res.set_content("{\"success\":false,\"state\":\"OFF\",\"message\":\"Cửa hàng chưa bật bản quyền Module Cổng Cà Thẻ Tín Dụng (mod_card_payment)!\"}", "application/json; charset=utf-8");
                return;
            }

            try {
                json body = json::parse(req.body);
                double baseAmount = 0.0;
                if (body.contains("amount")) {
                    if (body["amount"].is_number()) baseAmount = body["amount"].get<double>();
                    else if (body["amount"].is_string()) baseAmount = std::stod(body["amount"].get<std::string>());
                }
                if (baseAmount <= 0) {
                    res.status = 400;
                    res.set_content("{\"success\":false,\"message\":\"Số tiền thanh toán thẻ phải lớn hơn 0!\"}", "application/json; charset=utf-8");
                    return;
                }

                int64_t orderId = body.value("order_id", 0LL);
                std::string tableCode = body.value("table_code", "MV");
                std::string cashierName = body.value("cashier_name", "Thu Ngân");
                std::string schemeHint = body.value("card_scheme", "VISA");
                std::string entryHint = body.value("entry_mode", "NFC_TAP");
                std::string simOverride = body.value("sim_result", "");

                json cfg = queryOne("SELECT * FROM card_terminal_config WHERE id = 1");
                std::string modelCode = cfg.value("model_code", "PAX_A920_PRO");
                json modelRow = queryOne("SELECT * FROM card_terminal_catalog WHERE model_code = '" + sqlEscape(modelCode) + "' LIMIT 1");
                std::string modelName = modelRow.is_object() ? modelRow.value("model_name", modelCode) : modelCode;

                double surchargePct = cfg.value("customer_surcharge_percent", 0.0);
                double surchargeAmt = std::round((baseAmount * surchargePct) / 100.0);
                double totalCharged = baseAmount + surchargeAmt;

                double masterFeePct = lic.value("master_fee_percent", 0.0);
                double masterFeeAmt = std::round((totalCharged * masterFeePct) / 100.0);

                std::string tid = cfg.value("terminal_id_tid", "TID88901");
                std::string mid = cfg.value("merchant_id_mid", "MID000890123456");
                std::string bank = cfg.value("acquirer_bank", "Vietcombank (VCB SmartPOS)");
                int batchNum = cfg.value("current_batch_no", 101);

                std::string behavior = !simOverride.empty() ? simOverride : cfg.value("sim_behavior", "AUTO_APPROVE");
                std::string txRef = generateTxRef();
                std::string last4 = body.value("last4", generateRandomDigits(4));
                if (last4.length() != 4) last4 = generateRandomDigits(4);
                std::string maskedPan = "**** **** **** " + last4;
                std::string approvalCode = generateRandomDigits(6);
                std::string rrn = generateRandomDigits(12);
                std::string traceNo = generateRandomDigits(6);
                char batchBuf[16];
                std::snprintf(batchBuf, sizeof(batchBuf), "%06d", batchNum);
                std::string batchStr(batchBuf);

                std::string status = "APPROVED";
                std::string respCode = "00";
                std::string respMsg = "GIAO DỊCH THÀNH CÔNG (APPROVED)";
                int isSimTx = (cfg.value("simulation_mode", 1) != 0) ? 1 : 0;
                std::string cardholderName = "CHU THE NGAN HANG";

                if (isSimTx == 0) {
                    std::string connMode = cfg.value("connection_mode", "LAN_TCP");
                    std::string termIp = cfg.value("terminal_ip", "10.0.126.250");
                    int termPort = cfg.value("terminal_port", 10009);
                    std::string secret = cfg.value("api_secret", "");
                    int timeoutSec = cfg.value("timeout_seconds", 60);

                    json saleReq = {
                        {"cmd", "SALE"},
                        {"tx_ref", txRef},
                        {"amount", totalCharged},
                        {"base_amount", baseAmount},
                        {"surcharge_amount", surchargeAmt},
                        {"currency", "VND"},
                        {"order_id", orderId},
                        {"table_code", tableCode},
                        {"tid", tid},
                        {"mid", mid},
                        {"batch_no", batchStr},
                        {"card_scheme", schemeHint},
                        {"entry_mode", entryHint}
                    };
                    json hwResp;
                    long long latMs = 0;
                    std::string errMsg;
                    if (!dispatchTerminalCommand(connMode, termIp, termPort, secret, timeoutSec, "/ecr/sale", saleReq, hwResp, latMs, errMsg)) {
                        res.status = 502;
                        res.set_content(json({
                            {"success", false},
                            {"status", "ERROR"},
                            {"response_code", "91"},
                            {"is_simulation", 0},
                            {"message", "Lỗi kết nối máy SmartPOS thật: " + errMsg}
                        }).dump(), "application/json; charset=utf-8");
                        return;
                    }

                    bool hwApproved = hwResp.value("approved", hwResp.value("success", hwResp.value("status", "") == "APPROVED"));
                    respCode = hwResp.value("response_code", hwApproved ? "00" : "05");
                    status = hwResp.value("status", hwApproved ? "APPROVED" : "DECLINED");
                    respMsg = hwResp.value("response_message", hwResp.value("message", hwApproved ? "GIAO DỊCH THÀNH CÔNG (SMARTPOS)" : "MÁY POS TỪ CHỐI GIAO DỊCH"));
                    approvalCode = hwResp.value("approval_code", hwApproved ? approvalCode : "");
                    if (hwResp.contains("rrn") && hwResp["rrn"].is_string() && !hwResp["rrn"].get<std::string>().empty()) rrn = hwResp["rrn"].get<std::string>();
                    if (hwResp.contains("trace_no") && hwResp["trace_no"].is_string() && !hwResp["trace_no"].get<std::string>().empty()) traceNo = hwResp["trace_no"].get<std::string>();
                    if (hwResp.contains("masked_pan") && hwResp["masked_pan"].is_string() && !hwResp["masked_pan"].get<std::string>().empty()) maskedPan = hwResp["masked_pan"].get<std::string>();
                    if (hwResp.contains("card_scheme") && hwResp["card_scheme"].is_string() && !hwResp["card_scheme"].get<std::string>().empty()) schemeHint = hwResp["card_scheme"].get<std::string>();
                    if (hwResp.contains("entry_mode") && hwResp["entry_mode"].is_string() && !hwResp["entry_mode"].get<std::string>().empty()) entryHint = hwResp["entry_mode"].get<std::string>();
                    if (hwResp.contains("cardholder_name") && hwResp["cardholder_name"].is_string() && !hwResp["cardholder_name"].get<std::string>().empty()) cardholderName = hwResp["cardholder_name"].get<std::string>();
                } else {
                    if (behavior == "DECLINE_INSUFFICIENT" || behavior == "DECLINE_51" || behavior == "SIMULATE_DECLINE_51") {
                        status = "DECLINED";
                        respCode = "51";
                        respMsg = "TỪ CHỐI (51): Tài khoản thẻ không đủ số dư hoặc vượt hạn mức";
                        approvalCode = "";
                    } else if (behavior == "DECLINE_EXPIRED" || behavior == "DECLINE_54" || behavior == "SIMULATE_EXPIRED") {
                        status = "DECLINED";
                        respCode = "54";
                        respMsg = "TỪ CHỐI (54): Thẻ đã hết hạn sử dụng";
                        approvalCode = "";
                    } else if (behavior == "TIMEOUT" || behavior == "DECLINE_91" || behavior == "SIMULATE_TIMEOUT") {
                        status = "DECLINED";
                        respCode = "91";
                        respMsg = "LỖI KẾT NỐI (91): Quá thời gian chờ khách chạm/quẹt thẻ trên thiết bị POS";
                        approvalCode = "";
                    }
                }

                std::ostringstream ins;
                ins << "INSERT INTO card_transactions ("
                    << "tx_ref, order_id, table_code, base_amount, surcharge_percent, surcharge_amount, total_charged, "
                    << "master_fee_percent, master_fee_amount, terminal_model, acquirer_bank, tid, mid, "
                    << "card_scheme, entry_mode, masked_pan, cardholder_name, approval_code, rrn, batch_no, trace_no, "
                    << "status, response_code, response_message, is_simulation, cashier_name"
                    << ") VALUES ("
                    << "'" << sqlEscape(txRef) << "', "
                    << orderId << ", "
                    << "'" << sqlEscape(tableCode) << "', "
                    << baseAmount << ", "
                    << surchargePct << ", "
                    << surchargeAmt << ", "
                    << totalCharged << ", "
                    << masterFeePct << ", "
                    << masterFeeAmt << ", "
                    << "'" << sqlEscape(modelName) << "', "
                    << "'" << sqlEscape(bank) << "', "
                    << "'" << sqlEscape(tid) << "', "
                    << "'" << sqlEscape(mid) << "', "
                    << "'" << sqlEscape(schemeHint) << "', "
                    << "'" << sqlEscape(entryHint) << "', "
                    << "'" << sqlEscape(maskedPan) << "', "
                    << "'" << sqlEscape(cardholderName) << "', "
                    << "'" << sqlEscape(approvalCode) << "', "
                    << "'" << sqlEscape(rrn) << "', "
                    << "'" << sqlEscape(batchStr) << "', "
                    << "'" << sqlEscape(traceNo) << "', "
                    << "'" << sqlEscape(status) << "', "
                    << "'" << sqlEscape(respCode) << "', "
                    << "'" << sqlEscape(respMsg) << "', "
                    << isSimTx << ", "
                    << "'" << sqlEscape(cashierName) << "'"
                    << ");";

                execSql(ins.str());

                json txRecord = queryOne("SELECT * FROM card_transactions WHERE tx_ref = '" + sqlEscape(txRef) + "' LIMIT 1");
                bool ok = (status == "APPROVED");

                json out = {
                    {"success", ok},
                    {"is_simulation", isSimTx != 0},
                    {"status", status},
                    {"response_code", respCode},
                    {"message", respMsg},
                    {"transaction", txRecord}
                };
                res.status = ok ? 200 : 402;
                res.set_content(out.dump(), "application/json; charset=utf-8");
            } catch (const std::exception& e) {
                res.status = 400;
                res.set_content(json({{"success", false}, {"message", std::string("Lỗi xử lý giao dịch thẻ: ") + e.what()}}).dump(), "application/json; charset=utf-8");
            }
        });

        // 5. POST /api/card/void - Hủy giao dịch thẻ (Void Transaction) có ghi nhật ký Audit
        svr.Post("/api/card/void", [this](const httplib::Request& req, httplib::Response& res) {
            json lic = getLicenseState();
            if (!lic.value("is_enabled", false)) {
                res.status = 403;
                res.set_content("{\"success\":false,\"message\":\"Module đang tắt hoặc bị khóa bởi Master!\"}", "application/json; charset=utf-8");
                return;
            }

            try {
                json body = json::parse(req.body);
                int64_t txId = 0;
                if (body.contains("id") && body["id"].is_number()) txId = body["id"].get<int64_t>();
                else if (body.contains("transaction_id") && body["transaction_id"].is_number()) txId = body["transaction_id"].get<int64_t>();
                std::string txRef = body.value("tx_ref", "");
                std::string reason = body.value("reason", "");

                if (reason.empty()) {
                    res.status = 400;
                    res.set_content("{\"success\":false,\"message\":\"Bắt buộc phải nhập lý do hủy giao dịch thẻ (Void) để ghi Audit!\"}", "application/json; charset=utf-8");
                    return;
                }

                std::string whereClause = txId > 0 ? ("id = " + std::to_string(txId)) : ("tx_ref = '" + sqlEscape(txRef) + "'");
                json row = queryOne("SELECT * FROM card_transactions WHERE " + whereClause + " LIMIT 1");
                if (row.is_null()) {
                    res.status = 404;
                    res.set_content("{\"success\":false,\"message\":\"Không tìm thấy giao dịch thẻ cần hủy!\"}", "application/json; charset=utf-8");
                    return;
                }

                if (row.value("status", "") != "APPROVED") {
                    res.status = 400;
                    res.set_content("{\"success\":false,\"message\":\"Chỉ có thể Void giao dịch đang ở trạng thái APPROVED (chưa kết toán lô)!\"}", "application/json; charset=utf-8");
                    return;
                }

                json cfg = queryOne("SELECT * FROM card_terminal_config WHERE id = 1");
                if (row.value("is_simulation", 1) == 0 || (cfg.is_object() && cfg.value("simulation_mode", 1) == 0)) {
                    json voidReq = {
                        {"cmd", "VOID"},
                        {"tx_ref", row.value("tx_ref", "")},
                        {"trace_no", row.value("trace_no", "")},
                        {"approval_code", row.value("approval_code", "")},
                        {"rrn", row.value("rrn", "")},
                        {"amount", row.value("total_charged", 0.0)},
                        {"reason", reason},
                        {"tid", cfg.value("terminal_id_tid", "TID88901")},
                        {"mid", cfg.value("merchant_id_mid", "MID000890123456")}
                    };
                    json hwResp;
                    long long latMs = 0;
                    std::string errMsg;
                    if (!dispatchTerminalCommand(cfg.value("connection_mode", "LAN_TCP"), cfg.value("terminal_ip", ""),
                                                 cfg.value("terminal_port", 10009), cfg.value("api_secret", ""),
                                                 cfg.value("timeout_seconds", 30), "/ecr/void", voidReq, hwResp, latMs, errMsg)) {
                        res.status = 502;
                        res.set_content(json({{"success", false}, {"message", "SmartPOS từ chối/lỗi Void: " + errMsg}}).dump(), "application/json; charset=utf-8");
                        return;
                    }
                    if (!hwResp.value("success", hwResp.value("ok", true))) {
                        res.status = 502;
                        res.set_content(json({{"success", false}, {"message", hwResp.value("message", "SmartPOS từ chối lệnh Void giao dịch")}}).dump(), "application/json; charset=utf-8");
                        return;
                    }
                }

                execSql("UPDATE card_transactions SET status = 'VOIDED', void_reason = '" + sqlEscape(reason) + "' WHERE id = " + std::to_string(row.value("id", 0LL)));

                // Ghi vào bảng audit_logs của cửa hàng
                std::string auditDesc = "Void giao dịch thẻ " + row.value("tx_ref", "") + " (" + row.value("card_scheme", "VISA") + " " + row.value("masked_pan", "") + ") - Lý do: " + reason;
                execSql("INSERT INTO audit_logs (action_type, target_code, amount, reason, actor_name, created_at) VALUES ('VOID_CARD_TX', '" +
                        sqlEscape(row.value("tx_ref", "")) + "', " + std::to_string(row.value("total_charged", 0.0)) + ", '" +
                        sqlEscape(auditDesc) + "', 'Admin / Thu Ngân', datetime('now', 'localtime'));");

                res.set_content("{\"success\":true,\"message\":\"Đã hủy (VOID) giao dịch thẻ và ghi nhận vào Nhật ký Kiểm toán!\"}", "application/json; charset=utf-8");
            } catch (const std::exception& e) {
                res.status = 400;
                res.set_content(json({{"success", false}, {"message", e.what()}}).dump(), "application/json; charset=utf-8");
            }
        });

        // 6. POST /api/card/settle - Kết toán lô cuối ngày (Batch Settlement)
        svr.Post("/api/card/settle", [this](const httplib::Request&, httplib::Response& res) {
            json lic = getLicenseState();
            if (!lic.value("is_enabled", false)) {
                res.status = 403;
                res.set_content("{\"success\":false,\"message\":\"Module đang tắt hoặc bị khóa bởi Master!\"}", "application/json; charset=utf-8");
                return;
            }

            json unsettled = queryOne("SELECT COUNT(*) as c, COALESCE(SUM(total_charged), 0) as total FROM card_transactions WHERE status = 'APPROVED'");
            int cnt = unsettled.is_object() ? unsettled.value("c", 0) : 0;
            double totalAmt = unsettled.is_object() ? unsettled.value("total", 0.0) : 0.0;

            if (cnt == 0) {
                res.set_content("{\"success\":true,\"settled_count\":0,\"settled_total\":0,\"message\":\"Không có giao dịch nào đang chờ kết toán lô (Batch trống).\"}", "application/json; charset=utf-8");
                return;
            }

            json cfg = queryOne("SELECT * FROM card_terminal_config WHERE id = 1");
            if (cfg.is_object() && cfg.value("simulation_mode", 1) == 0) {
                json settleReq = {
                    {"cmd", "SETTLE"},
                    {"batch_no", cfg.value("current_batch_no", 101)},
                    {"tx_count", cnt},
                    {"total_amount", totalAmt},
                    {"tid", cfg.value("terminal_id_tid", "TID88901")},
                    {"mid", cfg.value("merchant_id_mid", "MID000890123456")}
                };
                json hwResp;
                long long latMs = 0;
                std::string errMsg;
                if (!dispatchTerminalCommand(cfg.value("connection_mode", "LAN_TCP"), cfg.value("terminal_ip", ""),
                                             cfg.value("terminal_port", 10009), cfg.value("api_secret", ""),
                                             cfg.value("timeout_seconds", 60), "/ecr/settle", settleReq, hwResp, latMs, errMsg)) {
                    res.status = 502;
                    res.set_content(json({{"success", false}, {"message", "Kết toán lô (Settle) tới SmartPOS thất bại: " + errMsg}}).dump(), "application/json; charset=utf-8");
                    return;
                }
                if (!hwResp.value("success", hwResp.value("ok", true))) {
                    res.status = 502;
                    res.set_content(json({{"success", false}, {"message", hwResp.value("message", "SmartPOS từ chối kết toán lô (Settle)")}}).dump(), "application/json; charset=utf-8");
                    return;
                }
            }

            execSql("UPDATE card_transactions SET status = 'SETTLED', settled_at = datetime('now', 'localtime') WHERE status = 'APPROVED';");
            execSql("UPDATE card_terminal_config SET current_batch_no = current_batch_no + 1, updated_at = datetime('now', 'localtime') WHERE id = 1;");

            json out = {
                {"success", true},
                {"settled_count", cnt},
                {"settled_total", totalAmt},
                {"message", "Đã kết toán lô (Batch Settlement) thành công " + std::to_string(cnt) + " giao dịch với ngân hàng!"}
            };
            res.set_content(out.dump(), "application/json; charset=utf-8");
        });

        // 7. GET /api/card/transactions - Danh sách giao dịch thẻ & thống kê đối soát
        svr.Get("/api/card/transactions", [this](const httplib::Request& req, httplib::Response& res) {
            std::string statusFilter = req.has_param("status") ? req.get_param_value("status") : "";
            std::string schemeFilter = req.has_param("scheme") ? req.get_param_value("scheme") : "";

            std::string sql = "SELECT * FROM card_transactions WHERE 1=1";
            if (!statusFilter.empty() && statusFilter != "ALL") {
                sql += " AND status = '" + sqlEscape(statusFilter) + "'";
            }
            if (!schemeFilter.empty() && schemeFilter != "ALL") {
                sql += " AND card_scheme = '" + sqlEscape(schemeFilter) + "'";
            }
            sql += " ORDER BY id DESC LIMIT 200";

            json list = queryAll(sql);
            json summary = getSummaryMetrics();
            json lic = getLicenseState();

            json out = {
                {"success", true},
                {"license", lic},
                {"summary", summary},
                {"transactions", list}
            };
            res.set_content(out.dump(), "application/json; charset=utf-8");
        });
    }
};

extern "C" {
    CYBERNEXUS_PLUGIN_API IModulePlugin* createCyberNexusPlugin() {
        return new CardPaymentPlugin();
    }

    CYBERNEXUS_PLUGIN_API void destroyCyberNexusPlugin(IModulePlugin* p) {
        delete p;
    }
}
