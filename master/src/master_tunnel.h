#pragma once

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <deque>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>
#include "nlohmann/json.hpp"

namespace SaleApp::Backend {

struct TunnelCommand {
    std::string cmd_id;
    std::string type; // "PING", "SYNC_LICENSE", "STORE_NOTIFY", "OTA_UPDATE"
    int64_t created_ms = 0;
    nlohmann::json payload = nlohmann::json::object();
};

struct AckWaiter {
    std::mutex mtx;
    std::condition_variable cv;
    bool completed = false;
    bool ok = false;
    int64_t ack_ms = 0;
    nlohmann::json runtime = nlohmann::json::object();
};

struct StoreTunnelState {
    std::mutex mtx;
    std::condition_variable cv_poll;
    int active_polls = 0;
    int64_t last_seen_ms = 0;
    int64_t last_ping_latency_ms = -1;
    std::string last_ip;
    std::string last_app_version;
    int store_port = 8501;
    nlohmann::json last_runtime = nlohmann::json::object();
    std::deque<TunnelCommand> pending_commands;
};

class StoreTunnelManager {
public:
    static StoreTunnelManager& instance() {
        static StoreTunnelManager inst;
        return inst;
    }

    static int64_t nowMs() {
        return std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now().time_since_epoch()
        ).count();
    }

    std::shared_ptr<StoreTunnelState> getOrCreateState(int64_t tenantId) {
        std::lock_guard<std::mutex> lk(map_mtx_);
        auto it = states_.find(tenantId);
        if (it != states_.end()) return it->second;
        auto st = std::make_shared<StoreTunnelState>();
        states_[tenantId] = st;
        return st;
    }

    std::shared_ptr<StoreTunnelState> getStateIfExists(int64_t tenantId) {
        std::lock_guard<std::mutex> lk(map_mtx_);
        auto it = states_.find(tenantId);
        return (it != states_.end()) ? it->second : nullptr;
    }

    bool isStoreOnline(int64_t tenantId) {
        auto st = getStateIfExists(tenantId);
        if (!st) return false;
        std::lock_guard<std::mutex> lk(st->mtx);
        return st->active_polls > 0;
    }

    int64_t getLastLatencyMs(int64_t tenantId) {
        auto st = getStateIfExists(tenantId);
        if (!st) return -1;
        std::lock_guard<std::mutex> lk(st->mtx);
        return st->last_ping_latency_ms;
    }

    nlohmann::json getLastRuntime(int64_t tenantId) {
        auto st = getStateIfExists(tenantId);
        if (!st) return nlohmann::json::object();
        std::lock_guard<std::mutex> lk(st->mtx);
        return st->last_runtime;
    }

    void requestShutdown() {
        shutting_down_.store(true);
        std::vector<std::shared_ptr<StoreTunnelState>> all;
        {
            std::lock_guard<std::mutex> lk(map_mtx_);
            for (auto& kv : states_) all.push_back(kv.second);
        }
        for (auto& st : all) {
            st->cv_poll.notify_all();
        }
    }

    bool isShuttingDown() const {
        return shutting_down_.load();
    }

    // Called by Slave Long-Polling endpoint (/api/license/poll)
    std::vector<TunnelCommand> waitForCommands(
        int64_t tenantId,
        const std::string& ip,
        const std::string& appVersion,
        int storePort,
        const nlohmann::json& runtime,
        int pollTimeoutSec
    ) {
        auto st = getOrCreateState(tenantId);
        std::unique_lock<std::mutex> lk(st->mtx);
        st->active_polls++;
        st->last_seen_ms = nowMs();
        if (!ip.empty()) st->last_ip = ip;
        if (!appVersion.empty()) st->last_app_version = appVersion;
        if (storePort > 0) st->store_port = storePort;
        if (runtime.is_object() && !runtime.empty()) st->last_runtime = runtime;

        if (st->pending_commands.empty() && !shutting_down_.load()) {
            st->cv_poll.wait_for(lk, std::chrono::seconds(pollTimeoutSec), [&]() {
                return !st->pending_commands.empty() || shutting_down_.load();
            });
        }

        std::vector<TunnelCommand> out;
        while (!st->pending_commands.empty()) {
            out.push_back(std::move(st->pending_commands.front()));
            st->pending_commands.pop_front();
        }
        st->active_polls--;
        if (st->active_polls < 0) st->active_polls = 0;
        st->last_seen_ms = nowMs();
        return out;
    }

    // Push fire-and-forget command (e.g. SYNC_LICENSE, STORE_NOTIFY, OTA_UPDATE)
    bool enqueueCommand(int64_t tenantId, const std::string& type, const nlohmann::json& payload = nlohmann::json::object(), bool queueIfOffline = false) {
        auto st = queueIfOffline ? getOrCreateState(tenantId) : getStateIfExists(tenantId);
        if (!st) return false;
        std::lock_guard<std::mutex> lk(st->mtx);
        bool online = st->active_polls > 0;
        if (!online && !queueIfOffline) return false;
        TunnelCommand cmd;
        cmd.cmd_id = generateCmdId(tenantId);
        cmd.type = type;
        cmd.created_ms = nowMs();
        cmd.payload = payload;
        st->pending_commands.push_back(std::move(cmd));
        st->cv_poll.notify_all();
        return online;
    }

    // Active On-Demand PING: wake poll -> wait for /api/license/ack
    struct PingResult {
        bool online = false;
        int64_t latency_ms = -1;
        std::string reason;
        nlohmann::json runtime = nlohmann::json::object();
    };

    PingResult pingStore(int64_t tenantId, int timeoutMs) {
        PingResult res;
        auto st = getStateIfExists(tenantId);
        if (!st) {
            res.reason = "Chưa có kết nối kênh từ Store (Store đang tắt hoặc chưa bật kênh WAN)";
            return res;
        }

        std::string cmdId = generateCmdId(tenantId);
        auto waiter = std::make_shared<AckWaiter>();
        {
            std::lock_guard<std::mutex> lk(waiters_mtx_);
            waiters_[cmdId] = waiter;
        }

        int64_t tStart = nowMs();
        {
            std::lock_guard<std::mutex> lk(st->mtx);
            if (st->active_polls <= 0) {
                std::lock_guard<std::mutex> wlk(waiters_mtx_);
                waiters_.erase(cmdId);
                res.reason = "Store đang offline (không có phiên Long-Polling hoạt động)";
                return res;
            }
            TunnelCommand cmd;
            cmd.cmd_id = cmdId;
            cmd.type = "PING";
            cmd.created_ms = tStart;
            st->pending_commands.push_back(std::move(cmd));
            st->cv_poll.notify_all();
        }

        {
            std::unique_lock<std::mutex> wlk(waiter->mtx);
            waiter->cv.wait_for(wlk, std::chrono::milliseconds(timeoutMs), [&]() {
                return waiter->completed;
            });
            if (waiter->completed && waiter->ok) {
                res.online = true;
                res.latency_ms = std::max<int64_t>(1, waiter->ack_ms - tStart);
                res.runtime = waiter->runtime;
                res.reason = "OK";
            } else {
                res.online = false;
                res.reason = "Quá thời gian chờ phản hồi từ Store (" + std::to_string(timeoutMs) + "ms)";
            }
        }

        {
            std::lock_guard<std::mutex> wlk(waiters_mtx_);
            waiters_.erase(cmdId);
        }

        if (res.online) {
            std::lock_guard<std::mutex> lk(st->mtx);
            st->last_ping_latency_ms = res.latency_ms;
            if (res.runtime.is_object() && !res.runtime.empty()) {
                st->last_runtime = res.runtime;
            }
        }
        return res;
    }

    // Called by Slave ACK endpoint (/api/license/ack)
    bool completeAck(const std::string& cmdId, bool ok, const nlohmann::json& runtime) {
        std::shared_ptr<AckWaiter> waiter;
        {
            std::lock_guard<std::mutex> wlk(waiters_mtx_);
            auto it = waiters_.find(cmdId);
            if (it == waiters_.end()) return false;
            waiter = it->second;
        }
        {
            std::lock_guard<std::mutex> lk(waiter->mtx);
            waiter->completed = true;
            waiter->ok = ok;
            waiter->ack_ms = nowMs();
            waiter->runtime = runtime;
        }
        waiter->cv.notify_all();
        return true;
    }

private:
    StoreTunnelManager() = default;

    std::string generateCmdId(int64_t tenantId) {
        uint64_t seq = cmd_seq_.fetch_add(1) + 1;
        return "CMD-" + std::to_string(tenantId) + "-" + std::to_string(seq) + "-" + std::to_string(nowMs());
    }

    std::mutex map_mtx_;
    std::unordered_map<int64_t, std::shared_ptr<StoreTunnelState>> states_;
    std::mutex waiters_mtx_;
    std::unordered_map<std::string, std::shared_ptr<AckWaiter>> waiters_;
    std::atomic<uint64_t> cmd_seq_{0};
    std::atomic<bool> shutting_down_{false};
};

} // namespace SaleApp::Backend
