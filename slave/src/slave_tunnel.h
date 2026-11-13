#pragma once

#include <atomic>
#include <chrono>
#include <ctime>
#include <iomanip>
#include <mutex>
#include <sstream>
#include <string>
#include "nlohmann/json.hpp"

namespace SaleApp::Backend {

class SlaveTunnelStatus {
public:
    static SlaveTunnelStatus& instance() {
        static SlaveTunnelStatus inst;
        return inst;
    }

    static std::string currentIsoLocal() {
        auto t = std::time(nullptr);
        std::tm tm{};
#ifdef _WIN32
        localtime_s(&tm, &t);
#else
        localtime_r(&t, &tm);
#endif
        std::ostringstream oss;
        oss << std::put_time(&tm, "%Y-%m-%d %H:%M:%S");
        return oss.str();
    }

    void markConnected(int pollSec, int heartbeatSec) {
        std::lock_guard<std::mutex> lk(mtx_);
        connected_ = true;
        last_seen_at_ = currentIsoLocal();
        last_error_.clear();
        retry_count_ = 0;
        poll_timeout_sec_ = pollSec;
        heartbeat_interval_sec_ = heartbeatSec;
    }

    void markAckSent() {
        std::lock_guard<std::mutex> lk(mtx_);
        last_ping_ack_at_ = currentIsoLocal();
        ping_count_++;
    }

    void markDisconnected(const std::string& err, int retries) {
        std::lock_guard<std::mutex> lk(mtx_);
        connected_ = false;
        last_error_ = err;
        retry_count_ = retries;
    }

    void setEnabled(bool en) {
        enabled_.store(en);
    }

    bool isEnabled() const {
        return enabled_.load();
    }

    void requestReconnect() {
        reconnect_requested_.store(true);
    }

    bool consumeReconnectRequest() {
        return reconnect_requested_.exchange(false);
    }

    void setStartTimeNow() {
        start_epoch_ = std::time(nullptr);
    }

    int64_t getUptimeSec() const {
        return std::max<int64_t>(0, static_cast<int64_t>(std::time(nullptr) - start_epoch_));
    }

    int getHeartbeatIntervalSec() const {
        std::lock_guard<std::mutex> lk(mtx_);
        return heartbeat_interval_sec_;
    }

    nlohmann::json toJson(const std::string& masterUrl) const {
        std::lock_guard<std::mutex> lk(mtx_);
        return {
            {"enabled", enabled_.load()},
            {"connected", connected_},
            {"master_url", masterUrl},
            {"last_seen_at", last_seen_at_},
            {"last_ping_ack_at", last_ping_ack_at_},
            {"ping_count", ping_count_},
            {"retry_count", retry_count_},
            {"last_error", last_error_},
            {"poll_timeout_sec", poll_timeout_sec_},
            {"heartbeat_interval_sec", heartbeat_interval_sec_},
            {"uptime_sec", getUptimeSec()}
        };
    }

private:
    SlaveTunnelStatus() { start_epoch_ = std::time(nullptr); }

    mutable std::mutex mtx_;
    bool connected_ = false;
    std::string last_seen_at_;
    std::string last_ping_ack_at_;
    std::string last_error_;
    int64_t ping_count_ = 0;
    int retry_count_ = 0;
    int poll_timeout_sec_ = 25;
    int heartbeat_interval_sec_ = 1800;
    std::time_t start_epoch_ = 0;
    std::atomic<bool> enabled_{true};
    std::atomic<bool> reconnect_requested_{false};
};

} // namespace SaleApp::Backend
