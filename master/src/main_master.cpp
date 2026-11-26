#include <iostream>
#include <fstream>
#include <filesystem>
#include <csignal>
#include "httplib.h"
#include "db.hpp"
#include "auth.hpp"
#include "license.hpp"
#include "license_crypto.hpp"
#include "master_handlers.hpp"
#include "master_tunnel.h"
#include "ConfigManager.hpp"

namespace fs = std::filesystem;
using namespace SaleApp::Backend;
using namespace SaleApp::Config;

static httplib::Server* g_server = nullptr;

void signalHandler(int signum) {
    std::cout << "\n[Master] Nhan tin hieu dung (" << signum << "), dang dong may chu an toan..." << std::endl;
    StoreTunnelManager::instance().requestShutdown();
    if (g_server) g_server->stop();
    Database::instance().close();
    std::cout << "[Master] May chu Master da dung hoan toan." << std::endl;
    exit(0);
}

int main(int argc, char* argv[]) {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
#endif

    // [SEC-10] Offline utility mode: sign DLL files with Master ECDSA P-256 CNG private key
    if (argc >= 3 && std::string(argv[1]) == "--sign-dll") {
        for (int i = 2; i < argc; ++i) {
            std::string dllPath = argv[i];
            std::ifstream ifs(dllPath, std::ios::binary);
            if (!ifs) {
                std::cerr << "[SignDLL] Cannot open file: " << dllPath << std::endl;
                return 2;
            }
            std::string bytes((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
            if (bytes.empty()) {
                std::cerr << "[SignDLL] Empty file: " << dllPath << std::endl;
                return 3;
            }
            std::string sha256 = SaleApp::Backend::AuthService::sha256(bytes);
            std::string filename = fs::path(dllPath).filename().string();
            std::string canonical = SaleApp::LicenseCrypto::buildDllSigPayload(filename, sha256);
            std::string sigHex = SaleApp::LicenseCrypto::signLicensePayload(canonical);
            if (sigHex.empty() || !SaleApp::LicenseCrypto::verifyLicensePayload(canonical, sigHex)) {
                std::cerr << "[SignDLL] ECDSA sign/verify failed for: " << dllPath << std::endl;
                return 4;
            }
            nlohmann::json sigDoc = {
                {"version", 2},
                {"algorithm", "ECDSA-P256-SHA256"},
                {"key_fingerprint", SaleApp::LicenseCrypto::getPublicKeyFingerprint()},
                {"file", filename},
                {"sha256", sha256},
                {"ecdsa_sig", sigHex},
                {"signed_by", "CyberNexus-SuperAdmin"}
            };
            std::ofstream ofs(dllPath + ".sig", std::ios::binary | std::ios::trunc);
            if (!ofs) {
                std::cerr << "[SignDLL] Cannot write .sig file: " << dllPath << ".sig" << std::endl;
                return 5;
            }
            ofs << sigDoc.dump(2);
            std::cout << "[SignDLL] OK " << filename << " sha256=" << sha256.substr(0, 16) << "... fp=" << SaleApp::LicenseCrypto::getPublicKeyFingerprint() << std::endl;
        }
        return 0;
    }

    // [SEC-INT-01] Sign web_integrity.json manifests with Master ECDSA P-256 CNG private key
    if (argc >= 3 && std::string(argv[1]) == "--sign-web") {
        for (int i = 2; i < argc; ++i) {
            std::string manPath = argv[i];
            std::ifstream ifs(manPath, std::ios::binary);
            if (!ifs) {
                std::cerr << "[SignWeb] Cannot open manifest: " << manPath << std::endl;
                return 2;
            }
            nlohmann::json man;
            try { ifs >> man; } catch (...) {
                std::cerr << "[SignWeb] Invalid JSON: " << manPath << std::endl;
                return 3;
            }
            nlohmann::json filesObj = (man.is_object() && man.contains("files") && man["files"].is_object()) ? man["files"] : nlohmann::json::object();
            std::string canon = "CBNX_WEB_ECDSA_V1:" + std::to_string(filesObj.size()) + ":" + SaleApp::Backend::AuthService::sha256(filesObj.dump());
            std::string sigHex = SaleApp::LicenseCrypto::signLicensePayload(canon);
            if (sigHex.empty() || !SaleApp::LicenseCrypto::verifyLicensePayload(canon, sigHex)) {
                std::cerr << "[SignWeb] ECDSA sign/verify failed for: " << manPath << std::endl;
                return 4;
            }
            man["algorithm"] = "ECDSA-P256-SHA256";
            man["key_fingerprint"] = SaleApp::LicenseCrypto::getPublicKeyFingerprint();
            man["ecdsa_sig"] = sigHex;
            std::ofstream ofs(manPath, std::ios::binary | std::ios::trunc);
            if (!ofs) {
                std::cerr << "[SignWeb] Cannot write manifest: " << manPath << std::endl;
                return 5;
            }
            ofs << man.dump(2) << "\n";
            std::cout << "[SignWeb] OK " << manPath << " files=" << filesObj.size() << " fp=" << SaleApp::LicenseCrypto::getPublicKeyFingerprint() << std::endl;
        }
        return 0;
    }

    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    // 1. Khoi tao ConfigManager cho role Master
    auto& config = AppConfig::instance();
    config.init("master", argc, argv);
    config.printBanner();

    // 2. Kich hoat SuperAdmin mode trong LicenseService
    LicenseService::instance().setSuperAdminMode(true);

    // 3. Mo CSDL Master
    std::string dbPath = config.getDatabasePath().string();
    if (!Database::instance().open(dbPath)) {
        std::cerr << "[CRITICAL Master] Khong the mo CSDL Master tai: " << dbPath << std::endl;
        return 1;
    }
    std::cout << "[DB Master] Mo CSDL Master thanh cong: " << dbPath << std::endl;

    // Khởi tạo các bảng Quản trị Đại lý Phân phối & Sổ quỹ Ví Đại lý
    try {
        Database::instance().execute(R"(
            CREATE TABLE IF NOT EXISTS saas_resellers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reseller_code TEXT UNIQUE NOT NULL,
                company_name TEXT NOT NULL,
                contact_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT DEFAULT '',
                tier TEXT DEFAULT 'silver',
                discount_percent REAL DEFAULT 25.0,
                wallet_balance REAL DEFAULT 0.0,
                status TEXT DEFAULT 'active',
                notes TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        )");
        Database::instance().execute(R"(
            CREATE TABLE IF NOT EXISTS saas_reseller_wallet_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reseller_id INTEGER NOT NULL,
                reseller_code TEXT DEFAULT '',
                trans_type TEXT NOT NULL,
                amount REAL NOT NULL,
                balance_before REAL DEFAULT 0.0,
                balance_after REAL DEFAULT 0.0,
                license_key TEXT DEFAULT '',
                store_name TEXT DEFAULT '',
                note TEXT DEFAULT '',
                created_by TEXT DEFAULT 'superadmin',
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        )");
        Database::instance().execute(R"(
            CREATE TABLE IF NOT EXISTS saas_pending_commands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cmd_id TEXT UNIQUE NOT NULL,
                tenant_id INTEGER NOT NULL,
                cmd_type TEXT NOT NULL,
                payload_json TEXT DEFAULT '{}',
                status TEXT DEFAULT 'pending',
                created_ms INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                delivered_at TEXT DEFAULT ''
            )
        )");
        StoreTunnelManager::instance().loadPendingFromDb();
        // Đảm bảo bảng saas_tenants có đủ cột mở rộng mà không gây log duplicate column name
        {
            auto cols = Database::instance().query("PRAGMA table_info(saas_tenants)");
            auto hasCol = [&](const std::string& name) {
                for (const auto& c : cols) {
                    if (c.value("name", "") == name) return true;
                }
                return false;
            };
            const std::pair<const char*, const char*> extraCols[] = {
                {"reseller_id", "INTEGER DEFAULT 0"},
                {"price_charged", "REAL DEFAULT 0.0"},
                {"blocked_modules", "TEXT DEFAULT '[]'"},
                {"card_fee_percent", "REAL DEFAULT 0.0"},
                {"lan_ip", "TEXT DEFAULT ''"},
                {"wan_ip", "TEXT DEFAULT ''"},
                {"geo_lat", "REAL DEFAULT 0"},
                {"geo_lng", "REAL DEFAULT 0"},
                {"geo_label", "TEXT DEFAULT ''"},
                {"geo_source", "TEXT DEFAULT 'ip'"},
                {"default_pin_sha256", "TEXT DEFAULT ''"},
                {"default_pin_enc", "TEXT DEFAULT ''"},
                {"pin_reset_pending", "INTEGER DEFAULT 0"},
                {"legal_entity_name", "TEXT DEFAULT ''"},
                {"tax_id_or_cccd", "TEXT DEFAULT ''"},
                {"representative_role", "TEXT DEFAULT 'Chủ hộ kinh doanh'"},
                {"billing_address", "TEXT DEFAULT ''"},
                {"workflow_stage", "TEXT DEFAULT 'pending_contract'"},
                {"payment_confirmed", "INTEGER DEFAULT 0"},
                {"payment_confirmed_by", "TEXT DEFAULT ''"},
                {"payment_confirmed_at", "TEXT DEFAULT ''"},
                {"trial_started_at", "TEXT DEFAULT ''"},
                {"handover_at", "TEXT DEFAULT ''"},
                {"warranty_until", "TEXT DEFAULT ''"},
                {"workflow_override", "INTEGER DEFAULT 0"},
                {"deleted_at", "TEXT DEFAULT ''"},
                {"deleted_reason", "TEXT DEFAULT ''"},
                {"mysql_backup_enabled", "INTEGER DEFAULT 0"},
                {"mysql_schema", "TEXT DEFAULT ''"},
                {"mysql_user", "TEXT DEFAULT ''"},
                {"last_mysql_sync_at", "TEXT DEFAULT ''"},
                {"last_mysql_sync_status", "TEXT DEFAULT ''"},
                {"last_mysql_sync_summary", "TEXT DEFAULT ''"},
                {"last_slave_db_stats", "TEXT DEFAULT ''"}
            };
            for (const auto& [col, def] : extraCols) {
                if (!hasCol(col)) {
                    try { Database::instance().execute(std::string("ALTER TABLE saas_tenants ADD COLUMN ") + col + " " + def); } catch (...) {}
                }
            }
        }

        // Đảm bảo cửa hàng mặc định GP001 (id=1) có kích hoạt sẵn mod_card_payment nếu chưa có trong enabled_modules / blocked_modules
        try {
            auto tRow = Database::instance().queryRow("SELECT id, enabled_modules, blocked_modules FROM saas_tenants WHERE id = 1 LIMIT 1");
            if (!tRow.is_null()) {
                std::string emStr = tRow.value("enabled_modules", "[]");
                std::string bmStr = tRow.value("blocked_modules", "[]");
                if (emStr.find("mod_card_payment") == std::string::npos && bmStr.find("mod_card_payment") == std::string::npos) {
                    json emArr = json::parse(emStr, nullptr, false);
                    if (emArr.is_array()) {
                        emArr.push_back("mod_card_payment");
                        Database::instance().execute("UPDATE saas_tenants SET enabled_modules = :em WHERE id = 1", {{":em", emArr.dump()}});
                    }
                }
            }
        } catch (...) {}
    } catch (const std::exception& e) {
        std::cerr << "[DB Master Init Resellers Warning] " << e.what() << std::endl;
    }

    // 4. Khoi tao HTTP Server (ThreadPool 128 workers cho Reverse Long-Polling dien rong WAN)
    httplib::Server svr;
    svr.new_task_queue = [] { return new httplib::ThreadPool(128); };
    g_server = &svr;

    svr.set_default_headers({
        {"X-Content-Type-Options", "nosniff"},
        {"X-Frame-Options", "SAMEORIGIN"},
        {"Referrer-Policy", "strict-origin-when-cross-origin"},
        {"Access-Control-Allow-Origin", "*"},
        {"Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"},
        {"Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key"},
        {"Content-Security-Policy", "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: blob: https://img.vietqr.io https://api.vietqr.io https:; media-src 'self' data: blob:; connect-src 'self' ws: wss: https://api.vietqr.io https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self';"}
    });

    svr.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        res.status = 204;
    });

    // Static files mount
    fs::path webDir = config.getWebDir();
    fs::path assetsDir = webDir / "assets";
    fs::path uploadsDir = config.getUploadsDir();

    if (fs::exists(assetsDir)) {
        svr.set_mount_point("/assets", assetsDir.string());
        std::cout << "[Master Static] Mount /assets -> " << assetsDir.string() << std::endl;
    }
    if (fs::exists(uploadsDir)) {
        svr.set_mount_point("/uploads", uploadsDir.string());
        std::cout << "[Master Static] Mount /uploads -> " << uploadsDir.string() << std::endl;
    }
    if (fs::exists(webDir / "locales")) {
        svr.set_mount_point("/locales", (webDir / "locales").string());
        std::cout << "[Master Static] Mount /locales -> " << (webDir / "locales").string() << std::endl;
    }

    fs::path packagesDir = config.getBaseDir() / "packages";
    if (!fs::exists(packagesDir)) {
        try { fs::create_directories(packagesDir); } catch (...) {}
    }
    svr.set_mount_point("/packages", packagesDir.string());
    std::cout << "[Master Static] Mount /packages -> " << packagesDir.string() << std::endl;

    svr.Get("/api/download_package", [packagesDir](const httplib::Request& req, httplib::Response& res) {
        std::string rel = req.get_param_value("file");
        if (rel.rfind("packages/", 0) == 0) rel = rel.substr(9);
        else if (rel.rfind("/packages/", 0) == 0) rel = rel.substr(10);
        if (rel.empty()) { res.status = 400; return; }
        std::error_code ec;
        fs::path rootCan = fs::weakly_canonical(packagesDir, ec);
        fs::path targetCan = fs::weakly_canonical(packagesDir / fs::path(rel), ec);
        std::string rootStr = rootCan.string();
        std::string targetStr = targetCan.string();
        if (ec || targetStr.rfind(rootStr, 0) != 0 || !fs::exists(targetCan, ec) || !fs::is_regular_file(targetCan, ec)) {
            res.status = 404;
            res.set_content("File not found", "text/plain; charset=utf-8");
            return;
        }
        auto fileSize = static_cast<size_t>(fs::file_size(targetCan, ec));
        std::string fname = targetCan.filename().string();
        res.set_header("Content-Disposition", "attachment; filename=\"" + fname + "\"");
        res.set_header("X-Content-Type-Options", "nosniff");
        auto ifs = std::make_shared<std::ifstream>(targetCan, std::ios::binary);
        if (!ifs || !(*ifs)) { res.status = 500; return; }
        res.set_content_provider(
            fileSize,
            "application/octet-stream",
            [ifs](size_t offset, size_t length, httplib::DataSink& sink) {
                std::vector<char> buf((std::min)(length, size_t(65536)));
                ifs->clear();
                ifs->seekg(static_cast<std::streamoff>(offset));
                size_t toRead = (std::min)(length, buf.size());
                ifs->read(buf.data(), static_cast<std::streamsize>(toRead));
                auto got = static_cast<size_t>(ifs->gcount());
                if (got == 0) return false;
                return sink.write(buf.data(), got);
            }
        );
    });

    // Helper view server
    auto serveMasterView = [webDir](const httplib::Request& req, httplib::Response& res) {
        fs::path htmlPath = webDir / "super_admin.html";
        if (fs::exists(htmlPath)) {
            std::ifstream file(htmlPath, std::ios::binary);
            if (file) {
                std::stringstream buffer;
                buffer << file.rdbuf();
                res.status = 200;
                res.set_content(buffer.str(), "text/html; charset=utf-8");
                return;
            }
        }
        res.status = 404;
        res.set_content("<h1>404 Not Found - File super_admin.html khong ton tai trong " + webDir.string() + "</h1>", "text/html; charset=utf-8");
    };

    // Master Routes
    auto serveFavicon = [webDir](const char* fname, const char* mime) {
        return [webDir, fname, mime](const httplib::Request&, httplib::Response& res) {
            fs::path fp = webDir / fname;
            if (fs::exists(fp)) {
                std::ifstream ifs(fp, std::ios::binary);
                if (ifs) {
                    std::stringstream buf;
                    buf << ifs.rdbuf();
                    res.set_header("Cache-Control", "public, max-age=3600");
                    res.set_content(buf.str(), mime);
                    return;
                }
            }
            res.status = 404;
        };
    };
    svr.Get("/favicon.ico", serveFavicon("favicon.ico", "image/x-icon"));
    svr.Get("/favicon.png", serveFavicon("favicon.png", "image/png"));
    svr.Get("/", serveMasterView);
    svr.Get("/super_admin", serveMasterView);
    svr.Get("/super_admin.html", [](const httplib::Request&, httplib::Response& res) { res.set_redirect("/super_admin"); });
    svr.Get("/super_admin.php", [](const httplib::Request&, httplib::Response& res) { res.set_redirect("/super_admin"); });
    svr.Get("/master", serveMasterView);
    svr.Get("/master.html", [](const httplib::Request&, httplib::Response& res) { res.set_redirect("/super_admin"); });
    svr.Get("/licensing", serveMasterView);
    svr.Get("/platform", serveMasterView);

    // Chuyển hướng an toàn nếu truy cập login.html cũ trên cổng Master
    svr.Get("/login", [](const httplib::Request&, httplib::Response& res) {
        res.set_redirect("/super_admin");
    });
    svr.Get("/login.html", [](const httplib::Request&, httplib::Response& res) {
        res.set_redirect("/super_admin");
    });

    // Register all Master API routes
    MasterHandlers::registerRoutes(svr);

    // Health check
    svr.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content("{\"status\":\"healthy\",\"role\":\"master\",\"time\":" + std::to_string(std::time(nullptr)) + "}", "application/json");
    });

    std::cout << "==========================================================" << std::endl;
    std::cout << "  🚀 MAY CHU CYBERNEXUS MASTER SAN SANG:" << std::endl;
    std::cout << "     -> Cổng Quản Trị: http://" << config.getBindHost() << ":" << config.getBindPort() << "/super_admin" << std::endl;
    std::cout << "==========================================================" << std::endl;

    svr.set_payload_max_length(105ULL * 1024ULL * 1024ULL);
    bool ok = svr.listen(config.getBindHost().c_str(), config.getBindPort());
    if (!ok) {
        std::cerr << "[Master Error] Khong the lang nghe tren port " << config.getBindPort() << std::endl;
        return 1;
    }
    return 0;
}
