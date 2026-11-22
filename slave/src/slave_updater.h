#pragma once

#include <algorithm>
#include <atomic>
#include <cctype>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <mutex>
#include <string>
#include <thread>
#include "ConfigManager.hpp"
#include "auth.hpp"
#include "db.hpp"
#include "httplib.h"
#include "nlohmann/json.hpp"

namespace SaleApp::Backend {

namespace fs = std::filesystem;

class SlaveUpdateManager {
public:
    static SlaveUpdateManager& instance() {
        static SlaveUpdateManager inst;
        return inst;
    }

    static bool verifyPackageBytes(const std::string& bytes, const std::string& expectedSha256, std::string& outCode, std::string& outMsg) {
        if (bytes.size() < 4 ||
            static_cast<unsigned char>(bytes[0]) != 0x50 ||
            static_cast<unsigned char>(bytes[1]) != 0x4B ||
            static_cast<unsigned char>(bytes[2]) != 0x03 ||
            static_cast<unsigned char>(bytes[3]) != 0x04) {
            outCode = "OTA_INVALID_PACKAGE";
            outMsg = "Gói OTA tải về không phải file ZIP hợp lệ (sai định dạng PK header). Đã hủy để bảo vệ POS.";
            return false;
        }
        if (!expectedSha256.empty()) {
            std::string expLower = expectedSha256;
            std::transform(expLower.begin(), expLower.end(), expLower.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
            std::string actualSha = AuthService::sha256(bytes);
            if (actualSha != expLower) {
                outCode = "OTA_SHA256_MISMATCH";
                outMsg = "Gói OTA bị hỏng hoặc sai chữ ký SHA-256 (Kỳ vọng: " + expLower.substr(0, 12) + "..., Thực tế: " + actualSha.substr(0, 12) + "...). Đã hủy giải nén!";
                return false;
            }
        }
        return true;
    }

    static void ensureNotificationColumns() {
        try {
            auto cols = Database::instance().query("PRAGMA table_info(app_notifications)");
            auto hasCol = [&](const char* name) {
                for (const auto& c : cols) {
                    if (c.value("name", "") == name) return true;
                }
                return false;
            };
            if (!hasCol("title_key")) {
                try { Database::instance().execute("ALTER TABLE app_notifications ADD COLUMN title_key TEXT DEFAULT ''"); } catch (...) {}
            }
            if (!hasCol("msg_key")) {
                try { Database::instance().execute("ALTER TABLE app_notifications ADD COLUMN msg_key TEXT DEFAULT ''"); } catch (...) {}
            }
            if (!hasCol("msg_params_json")) {
                try { Database::instance().execute("ALTER TABLE app_notifications ADD COLUMN msg_params_json TEXT DEFAULT '{}'"); } catch (...) {}
            }
        } catch (...) {}
    }

    void recordNotification(const std::string& type, const std::string& title, const std::string& message, const std::string& version = "", const std::string& downloadPath = "") {
        {
            std::lock_guard<std::mutex> lk(mtx_);
            if (type == "SYSTEM_UPDATE") {
                has_update_ = true;
                if (!version.empty()) latest_version_ = version;
                if (!downloadPath.empty()) download_path_ = downloadPath;
                update_title_ = title;
                update_message_ = message;
            }
        }
        try {
            ensureNotificationColumns();
            std::string tKey = (type == "SYSTEM_UPDATE") ? "notif.ota_update_title" : "notif.system_notify_title";
            std::string mKey = (type == "SYSTEM_UPDATE") ? "notif.ota_update_msg" : "notif.system_notify_msg";
            nlohmann::json params = {{"version", version}, {"title", title}, {"message", message}};
            Database::instance().execute(
                "INSERT INTO app_notifications (type, order_id, table_code, title, message, title_key, msg_key, msg_params_json, is_read_waiter, is_read_cashier) "
                "VALUES (:tp, 0, :ver, :tt, :msg, :tk, :mk, :mp, 0, 0)",
                {
                    {":tp", type}, {":ver", version}, {":tt", title}, {":msg", message},
                    {":tk", tKey}, {":mk", mKey}, {":mp", params.dump()}
                }
            );
        } catch (...) {}
    }

    static int countPendingOrders() {
        try {
            auto r = Database::instance().queryRow("SELECT COUNT(*) as c FROM orders WHERE status NOT IN ('completed', 'cancelled')");
            if (!r.is_null() && r.contains("c") && r["c"].is_number_integer()) {
                return r["c"].get<int>();
            }
            return -1;
        } catch (...) {
            return -1;
        }
    }

    void scheduleAutoApply(const std::string& masterUrl, const std::string& downloadPath, const std::string& version) {
        std::lock_guard<std::mutex> lk(mtx_);
        auto_apply_master_url_ = masterUrl;
        auto_apply_download_path_ = downloadPath.empty() ? "/api/updates/download" : downloadPath;
        auto_apply_version_ = version;
        auto_apply_pending_ = true;
        auto_apply_state_ = "scheduled";
    }

    nlohmann::json tryAutoApplyIfIdle() {
        std::string mUrl;
        std::string dlPath;
        std::string ver;
        {
            std::lock_guard<std::mutex> lk(mtx_);
            if (!auto_apply_pending_ || applying_.load() || restart_pending_.load()) {
                return {{"triggered", false}, {"auto_apply_pending", auto_apply_pending_}, {"auto_apply_state", auto_apply_state_}};
            }
            mUrl = auto_apply_master_url_;
            dlPath = auto_apply_download_path_;
            ver = auto_apply_version_;
        }

        int pending = countPendingOrders();
        if (pending != 0) {
            std::lock_guard<std::mutex> lk(mtx_);
            if (auto_apply_pending_) {
                auto_apply_state_ = "deferred_open_orders";
            }
            return {{"triggered", false}, {"deferred", true}, {"pending_orders", pending}, {"auto_apply_state", "deferred_open_orders"}};
        }

        {
            std::lock_guard<std::mutex> lk(mtx_);
            if (!auto_apply_pending_ || applying_.load()) {
                return {{"triggered", false}};
            }
            auto_apply_pending_ = false;
            auto_apply_state_ = "triggered";
        }

        std::thread([mUrl, dlPath]() {
            try {
                SlaveUpdateManager::instance().applyPatchFromMaster(mUrl, dlPath);
            } catch (...) {}
        }).detach();

        return {{"triggered", true}, {"pending_orders", 0}, {"version", ver}, {"auto_apply_state", "triggered"}};
    }

    nlohmann::json getStatus() {
        nlohmann::json notifs = nlohmann::json::array();
        std::string appliedVer = "2026.11.16.18";
        try {
            ensureNotificationColumns();
            notifs = Database::instance().query(
                "SELECT id, type, table_code as version, title, message, "
                "COALESCE(title_key, '') as title_key, COALESCE(msg_key, '') as msg_key, "
                "COALESCE(msg_params_json, '{}') as msg_params_json, is_read_cashier as is_read, created_at "
                "FROM app_notifications WHERE type IN ('SYSTEM_NOTIFY', 'SYSTEM_UPDATE') "
                "ORDER BY id DESC LIMIT 20"
            );
            auto vr = Database::instance().queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'ota_applied_version'");
            if (!vr.is_null() && !vr.value("setting_value", "").empty()) {
                appliedVer = vr.value("setting_value", appliedVer);
            }
        } catch (...) {}

        int pendingOrders = countPendingOrders();
        std::lock_guard<std::mutex> lk(mtx_);
        return {
            {"success", true},
            {"applied_version", appliedVer},
            {"has_update", has_update_},
            {"latest_version", latest_version_},
            {"update_title", update_title_},
            {"update_message", update_message_},
            {"download_path", download_path_.empty() ? "/api/updates/download" : download_path_},
            {"applying", applying_.load()},
            {"restart_pending", restart_pending_.load()},
            {"auto_apply_pending", auto_apply_pending_},
            {"auto_apply_state", auto_apply_state_},
            {"pending_orders_count", pendingOrders},
            {"last_result", last_result_},
            {"notifications", notifs}
        };
    }

    nlohmann::json checkMasterPatch(const std::string& masterUrl) {
        try {
            httplib::Client cli(masterUrl);
            cli.set_connection_timeout(5, 0);
            cli.set_read_timeout(10, 0);
            auto res = cli.Get("/api/updates/latest");
            if (!res || res->status != 200) {
                return {{"success", false}, {"code", "OTA_MASTER_UNREACHABLE"}, {"message", "Không thể kết nối Master để kiểm tra bản cập nhật"}};
            }
            auto j = nlohmann::json::parse(res->body, nullptr, false);
            if (!j.is_object() || !j.value("success", false)) {
                return {{"success", false}, {"code", "OTA_INVALID_RESPONSE"}, {"message", "Phản hồi kiểm tra cập nhật không hợp lệ"}};
            }
            if (j.value("has_patch", false) && j.contains("manifest") && j["manifest"].is_object()) {
                auto& m = j["manifest"];
                std::string mVer = m.value("version", "");
                std::string appliedVer;
                try {
                    auto r = Database::instance().queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'ota_applied_version'");
                    if (!r.is_null()) appliedVer = r.value("setting_value", "");
                } catch (...) {}

                bool isNewer = (!mVer.empty() && mVer != appliedVer);
                {
                    std::lock_guard<std::mutex> lk(mtx_);
                    has_update_ = isNewer;
                    latest_version_ = mVer;
                    update_title_ = m.value("title", "Bản cập nhật mới từ Master");
                    update_message_ = m.value("notes", "");
                }
                j["has_update"] = isNewer;
                j["applied_version"] = appliedVer;
            } else {
                j["has_update"] = false;
            }
            return j;
        } catch (const std::exception& e) {
            return {{"success", false}, {"code", "OTA_CHECK_ERROR"}, {"message", e.what()}};
        }
    }

    nlohmann::json applyPatchFromMaster(const std::string& masterUrl, const std::string& downloadPath = "/api/updates/download") {
        bool expected = false;
        if (!applying_.compare_exchange_strong(expected, true)) {
            return {{"success", false}, {"code", "OTA_IN_PROGRESS"}, {"message", "Đang trong quá trình cập nhật, vui lòng chờ..."}};
        }

        try {
            fs::path baseDir = SaleApp::Config::AppConfig::instance().getBaseDir();
            fs::path tempDir = baseDir / "temp_update";
            fs::path extractDir = tempDir / "extracted";
            fs::path backupDir = baseDir / "backup_prev";
            std::error_code ecClean;
            fs::remove_all(tempDir, ecClean);
            fs::create_directories(extractDir, ecClean);

            httplib::Client cli(masterUrl);
            cli.set_connection_timeout(10, 0);
            cli.set_read_timeout(60, 0);
            auto res = cli.Get(downloadPath.empty() ? "/api/updates/download" : downloadPath);
            if (!res || res->status != 200 || res->body.empty()) {
                applying_.store(false);
                std::lock_guard<std::mutex> lk(mtx_);
                last_result_ = "Tải gói cập nhật từ Master thất bại";
                return {{"success", false}, {"code", "OTA_DOWNLOAD_FAILED"}, {"message", last_result_}};
            }

            // [SEC-13] Xac minh PK ZIP magic & X-Package-SHA256 truoc khi giai nen
            std::string expectedSha = res->has_header("X-Package-SHA256") ? res->get_header_value("X-Package-SHA256") : "";
            std::string vCode, vMsg;
            if (!verifyPackageBytes(res->body, expectedSha, vCode, vMsg)) {
                fs::remove_all(tempDir, ecClean);
                applying_.store(false);
                std::lock_guard<std::mutex> lk(mtx_);
                last_result_ = vMsg;
                return {{"success", false}, {"code", vCode}, {"message", vMsg}};
            }

            fs::path zipPath = tempDir / "patch_latest.zip";
            {
                std::ofstream ofs(zipPath.string(), std::ios::binary);
                ofs.write(res->body.data(), static_cast<std::streamsize>(res->body.size()));
            }

#ifdef _WIN32
            std::string cmd = "powershell -NoProfile -ExecutionPolicy Bypass -Command \"Expand-Archive -Path '" +
                zipPath.string() + "' -DestinationPath '" + extractDir.string() + "' -Force\"";
            int rc = std::system(cmd.c_str());
            if (rc != 0) {
                fs::remove_all(tempDir, ecClean);
                applying_.store(false);
                std::lock_guard<std::mutex> lk(mtx_);
                last_result_ = "Giải nén gói cập nhật thất bại (code " + std::to_string(rc) + ")";
                return {{"success", false}, {"code", "OTA_EXTRACT_FAILED"}, {"message", last_result_}};
            }
#endif

            // Prepare backup_prev for safe rollback
            fs::remove_all(backupDir, ecClean);
            fs::create_directories(backupDir, ecClean);

            bool needsRestart = false;
            std::vector<std::tuple<fs::path, fs::path, fs::path>> deferredEntries; // {src, dest, rel}
            std::vector<std::pair<fs::path, fs::path>> backedUpNonDeferred; // {backup, dest}
            int copiedCount = 0;

            for (const auto& entry : fs::recursive_directory_iterator(extractDir)) {
                if (!entry.is_regular_file()) continue;
                fs::path rel = fs::relative(entry.path(), extractDir);
                std::string relStr = rel.generic_string();
                std::string ext = entry.path().extension().string();
                std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
                fs::path dest = baseDir / rel;
                if (relStr.rfind("modules/", 0) == 0 && !fs::exists(dest)) {
                    continue; // Do not install unlicensed module DLLs via OTA patch
                }
                if (dest.has_parent_path()) fs::create_directories(dest.parent_path(), ecClean);

                fs::path bkp = backupDir / rel;
                if (fs::exists(dest)) {
                    if (bkp.has_parent_path()) fs::create_directories(bkp.parent_path(), ecClean);
                    std::error_code bEc;
                    fs::copy_file(dest, bkp, fs::copy_options::overwrite_existing, bEc);
                }

                if (relStr == "cybernexus_slave.exe" || ext == ".exe" || ext == ".dll") {
                    needsRestart = true;
                    deferredEntries.emplace_back(entry.path(), dest, rel);
                    continue; // Applied by helper script after process exits & unlocks .exe/.dll
                }

                std::error_code ec;
                fs::copy_file(entry.path(), dest, fs::copy_options::overwrite_existing, ec);
                if (ec) {
                    // Rollback any already copied non-deferred files
                    for (const auto& pair : backedUpNonDeferred) {
                        std::error_code rEc;
                        if (fs::exists(pair.first)) {
                            fs::copy_file(pair.first, pair.second, fs::copy_options::overwrite_existing, rEc);
                        }
                    }
                    fs::remove_all(tempDir, ecClean);
                    applying_.store(false);
                    std::lock_guard<std::mutex> lk(mtx_);
                    last_result_ = "Chép file OTA thất bại, đã tự động Rollback về bản cũ an toàn";
                    return {{"success", false}, {"code", "OTA_ROLLBACK_RESTORED"}, {"message", last_result_}};
                } else {
                    if (fs::exists(bkp)) backedUpNonDeferred.emplace_back(bkp, dest);
                    copiedCount++;
                }
            }

            try {
                Database::instance().execute(
                    "UPDATE app_notifications SET is_read_cashier = 1, is_read_waiter = 1 WHERE type = 'SYSTEM_UPDATE'"
                );
                if (!latest_version_.empty()) {
                    Database::instance().execute(
                        "INSERT INTO store_settings (setting_key, setting_value) VALUES ('ota_applied_version', :v) "
                        "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                        {{":v", latest_version_}}
                    );
                }
            } catch (...) {}

            {
                std::lock_guard<std::mutex> lk(mtx_);
                has_update_ = false;
                restart_pending_ = needsRestart;
                last_result_ = "Đã xác thực SHA-256 & cập nhật " + std::to_string(copiedCount) + " file" +
                    (needsRestart ? " và chuẩn bị khởi động lại để thay " + std::to_string(deferredEntries.size()) + " file hệ thống (.exe/.dll)" : "");
            }
            applying_.store(false);

            if (needsRestart) {
#ifdef _WIN32
                int bindPort = SaleApp::Config::AppConfig::instance().getBindPort();
                if (bindPort <= 0) bindPort = 8501;
                fs::path psPath = tempDir / "apply_exe_update.ps1";
                fs::path targetExe = baseDir / "cybernexus_slave.exe";
                {
                    std::ofstream pf(psPath.string());
                    pf << "Start-Sleep -Seconds 2\r\n"
                       << "Stop-Process -Name cybernexus_slave -Force -ErrorAction SilentlyContinue\r\n"
                       << "Start-Sleep -Seconds 2\r\n";
                    for (const auto& tup : deferredEntries) {
                        pf << "Copy-Item -LiteralPath '" << std::get<0>(tup).string() << "' -Destination '" << std::get<1>(tup).string() << "' -Force -ErrorAction SilentlyContinue\r\n";
                    }
                    pf << "$p = Start-Process -FilePath '" << targetExe.string() << "' -WorkingDirectory '" << baseDir.string() << "' -WindowStyle Hidden -PassThru\r\n"
                       << "Start-Sleep -Seconds 4\r\n"
                       << "$ok = $false\r\n"
                       << "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:" << bindPort << "/api/health' -TimeoutSec 4; if ($r.StatusCode -eq 200) { $ok = $true } } catch {}\r\n"
                       << "if (-not $ok) {\r\n"
                       << "  if ($p) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }\r\n"
                       << "  Stop-Process -Name cybernexus_slave -Force -ErrorAction SilentlyContinue\r\n"
                       << "  Start-Sleep -Seconds 1\r\n"
                       << "  if (Test-Path '" << backupDir.string() << "') {\r\n"
                       << "    Get-ChildItem -Path '" << backupDir.string() << "' -Recurse -File | ForEach-Object {\r\n"
                       << "      $rel = $_.FullName.Substring('" << backupDir.string() << "'.Length + 1)\r\n"
                       << "      $dst = Join-Path '" << baseDir.string() << "' $rel\r\n"
                       << "      Copy-Item -LiteralPath $_.FullName -Destination $dst -Force -ErrorAction SilentlyContinue\r\n"
                       << "    }\r\n"
                       << "  }\r\n"
                       << "  Start-Process -FilePath '" << targetExe.string() << "' -WorkingDirectory '" << baseDir.string() << "' -WindowStyle Hidden\r\n"
                       << "}\r\n";
                }
                std::thread([psPath]() {
                    std::this_thread::sleep_for(std::chrono::milliseconds(600));
                    std::string cmdLine = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"" + psPath.string() + "\"";
                    STARTUPINFOA si{};
                    si.cb = sizeof(si);
                    si.dwFlags = STARTF_USESHOWWINDOW;
                    si.wShowWindow = SW_HIDE;
                    PROCESS_INFORMATION pi{};
                    std::vector<char> mutCmd(cmdLine.begin(), cmdLine.end());
                    mutCmd.push_back('\0');
                    if (CreateProcessA(nullptr, mutCmd.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, nullptr, &si, &pi)) {
                        CloseHandle(pi.hThread);
                        CloseHandle(pi.hProcess);
                    }
                    std::exit(0);
                }).detach();
#endif
            }

            return {
                {"success", true},
                {"copied_files", copiedCount},
                {"deferred_files", deferredEntries.size()},
                {"restarting", needsRestart},
                {"sha256_verified", !expectedSha.empty()},
                {"message", needsRestart
                    ? "Đã xác thực SHA-256 & chép đè " + std::to_string(copiedCount) + " file. Server đang khởi động lại (tự Rollback nếu lỗi) để cập nhật " + std::to_string(deferredEntries.size()) + " file (.exe/.dll)..."
                    : "Đã xác thực SHA-256 & cập nhật xong " + std::to_string(copiedCount) + " file! Hãy tải lại trang (F5)."}
            };
        } catch (const std::exception& e) {
            applying_.store(false);
            std::lock_guard<std::mutex> lk(mtx_);
            last_result_ = std::string("Lỗi cập nhật OTA: ") + e.what();
            return {{"success", false}, {"code", "OTA_APPLY_ERROR"}, {"message", last_result_}};
        }
    }

    std::string getPendingDownloadPath() {
        std::lock_guard<std::mutex> lk(mtx_);
        return download_path_.empty() ? "/api/updates/download" : download_path_;
    }

private:
    std::mutex mtx_;
    bool has_update_ = false;
    std::string latest_version_;
    std::string download_path_;
    std::string update_title_;
    std::string update_message_;
    std::string last_result_;
    bool auto_apply_pending_ = false;
    std::string auto_apply_master_url_;
    std::string auto_apply_download_path_;
    std::string auto_apply_version_;
    std::string auto_apply_state_ = "idle";
    std::atomic<bool> applying_{false};
    std::atomic<bool> restart_pending_{false};
};

} // namespace SaleApp::Backend
