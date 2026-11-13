#pragma once

#include <atomic>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <mutex>
#include <string>
#include <thread>
#include "ConfigManager.hpp"
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

    void recordNotification(const std::string& type, const std::string& title, const std::string& message, const std::string& version = "") {
        {
            std::lock_guard<std::mutex> lk(mtx_);
            if (type == "SYSTEM_UPDATE") {
                has_update_ = true;
                if (!version.empty()) latest_version_ = version;
                update_title_ = title;
                update_message_ = message;
            }
        }
        try {
            Database::instance().execute(
                "INSERT INTO app_notifications (type, order_id, table_code, title, message, is_read_waiter, is_read_cashier) "
                "VALUES (:tp, 0, :ver, :tt, :msg, 0, 0)",
                {{":tp", type}, {":ver", version}, {":tt", title}, {":msg", message}}
            );
        } catch (...) {}
    }

    nlohmann::json getStatus() {
        nlohmann::json notifs = nlohmann::json::array();
        try {
            notifs = Database::instance().query(
                "SELECT id, type, table_code as version, title, message, is_read_cashier as is_read, created_at "
                "FROM app_notifications WHERE type IN ('SYSTEM_NOTIFY', 'SYSTEM_UPDATE') "
                "ORDER BY id DESC LIMIT 20"
            );
        } catch (...) {}

        std::lock_guard<std::mutex> lk(mtx_);
        return {
            {"success", true},
            {"has_update", has_update_},
            {"latest_version", latest_version_},
            {"update_title", update_title_},
            {"update_message", update_message_},
            {"applying", applying_.load()},
            {"restart_pending", restart_pending_.load()},
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
                return {{"success", false}, {"message", "Không thể kết nối Master để kiểm tra bản cập nhật"}};
            }
            auto j = nlohmann::json::parse(res->body, nullptr, false);
            if (!j.is_object() || !j.value("success", false)) {
                return {{"success", false}, {"message", "Phản hồi kiểm tra cập nhật không hợp lệ"}};
            }
            if (j.value("has_patch", false) && j.contains("manifest") && j["manifest"].is_object()) {
                auto& m = j["manifest"];
                std::lock_guard<std::mutex> lk(mtx_);
                has_update_ = true;
                latest_version_ = m.value("version", "");
                update_title_ = m.value("title", "Bản cập nhật mới từ Master");
                update_message_ = m.value("notes", "");
            }
            return j;
        } catch (const std::exception& e) {
            return {{"success", false}, {"message", e.what()}};
        }
    }

    nlohmann::json applyPatchFromMaster(const std::string& masterUrl, const std::string& downloadPath = "/api/updates/download") {
        bool expected = false;
        if (!applying_.compare_exchange_strong(expected, true)) {
            return {{"success", false}, {"message", "Đang trong quá trình cập nhật, vui lòng chờ..."}};
        }

        try {
            fs::path baseDir = SaleApp::Config::AppConfig::instance().getBaseDir();
            fs::path tempDir = baseDir / "temp_update";
            fs::path extractDir = tempDir / "extracted";
            fs::remove_all(tempDir);
            fs::create_directories(extractDir);

            httplib::Client cli(masterUrl);
            cli.set_connection_timeout(10, 0);
            cli.set_read_timeout(60, 0);
            auto res = cli.Get(downloadPath.empty() ? "/api/updates/download" : downloadPath);
            if (!res || res->status != 200 || res->body.empty()) {
                applying_.store(false);
                std::lock_guard<std::mutex> lk(mtx_);
                last_result_ = "Tải gói cập nhật từ Master thất bại";
                return {{"success", false}, {"message", last_result_}};
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
                applying_.store(false);
                std::lock_guard<std::mutex> lk(mtx_);
                last_result_ = "Giải nén gói cập nhật thất bại (code " + std::to_string(rc) + ")";
                return {{"success", false}, {"message", last_result_}};
            }
#endif

            bool hasExeUpdate = false;
            fs::path stagedExePath;
            int copiedCount = 0;

            for (const auto& entry : fs::recursive_directory_iterator(extractDir)) {
                if (!entry.is_regular_file()) continue;
                fs::path rel = fs::relative(entry.path(), extractDir);
                std::string relStr = rel.generic_string();
                if (relStr == "cybernexus_slave.exe") {
                    hasExeUpdate = true;
                    stagedExePath = entry.path();
                    continue; // Applied by helper script after process exits
                }
                fs::path dest = baseDir / rel;
                if (dest.has_parent_path()) fs::create_directories(dest.parent_path());
                fs::copy_file(entry.path(), dest, fs::copy_options::overwrite_existing);
                copiedCount++;
            }

            {
                std::lock_guard<std::mutex> lk(mtx_);
                has_update_ = false;
                restart_pending_ = hasExeUpdate;
                last_result_ = "Đã cập nhật " + std::to_string(copiedCount) + " file" +
                    (hasExeUpdate ? " và chuẩn bị khởi động lại cybernexus_slave.exe" : "");
            }
            applying_.store(false);

            if (hasExeUpdate) {
#ifdef _WIN32
                fs::path batPath = tempDir / "apply_exe_update.bat";
                fs::path targetExe = baseDir / "cybernexus_slave.exe";
                {
                    std::ofstream bf(batPath.string());
                    bf << "@echo off\r\n"
                       << "timeout /t 2 /nobreak >nul\r\n"
                       << "taskkill /F /IM cybernexus_slave.exe >nul 2>&1\r\n"
                       << "timeout /t 1 /nobreak >nul\r\n"
                       << "copy /Y \"" << stagedExePath.string() << "\" \"" << targetExe.string() << "\" >nul\r\n"
                       << "cd /d \"" << baseDir.string() << "\"\r\n"
                       << "start \"CyberNexus OS - Slave Store\" \"" << targetExe.string() << "\"\r\n"
                       << "exit\r\n";
                }
                std::thread([batPath]() {
                    std::this_thread::sleep_for(std::chrono::milliseconds(600));
                    std::string launchCmd = "cmd /c start \"\" /min \"" + batPath.string() + "\"";
                    std::system(launchCmd.c_str());
                    std::exit(0);
                }).detach();
#endif
            }

            return {
                {"success", true},
                {"copied_files", copiedCount},
                {"restarting", hasExeUpdate},
                {"message", hasExeUpdate
                    ? "Đã chép đè " + std::to_string(copiedCount) + " file. Server đang tự khởi động lại để áp dụng cybernexus_slave.exe mới (3 giây)..."
                    : "Đã cập nhật xong " + std::to_string(copiedCount) + " file! Hãy tải lại trang (F5)."}
            };
        } catch (const std::exception& e) {
            applying_.store(false);
            std::lock_guard<std::mutex> lk(mtx_);
            last_result_ = std::string("Lỗi cập nhật OTA: ") + e.what();
            return {{"success", false}, {"message", last_result_}};
        }
    }

private:
    std::mutex mtx_;
    bool has_update_ = false;
    std::string latest_version_;
    std::string update_title_;
    std::string update_message_;
    std::string last_result_;
    std::atomic<bool> applying_{false};
    std::atomic<bool> restart_pending_{false};
};

} // namespace SaleApp::Backend
