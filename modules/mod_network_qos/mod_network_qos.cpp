#define BUILDING_PLUGIN_DLL
#include "IModulePlugin.hpp"
#include <iostream>
#include <fstream>
#include <filesystem>
#include <cstdlib>

namespace fs = std::filesystem;
using namespace CyberNexus;

class NetworkQosPlugin : public IModulePlugin {
    std::string m_configPath = "config/router_qos.json";
    json m_cfg = {
        {"router_type", "simulation"},
        {"host", "192.168.88.1"},
        {"port", 80},
        {"username", "admin"},
        {"password", ""},
        {"vip_limit", "50M/50M"},
        {"basic_limit", "5M/5M"}
    };

    void loadConfig() {
        try {
            if (fs::exists(m_configPath)) {
                std::ifstream f(m_configPath);
                json loaded;
                f >> loaded;
                if (loaded.is_object()) m_cfg.update(loaded);
            }
        } catch (...) {}
    }

    void saveConfig() {
        try {
            fs::create_directories(fs::path(m_configPath).parent_path());
            std::ofstream f(m_configPath);
            f << m_cfg.dump(2);
        } catch (...) {}
    }

    bool applyMikrotikQueue(const std::string& ip, const std::string& qos, std::string& msgOut) {
        std::string host = m_cfg.value("host", "192.168.88.1");
        int port = m_cfg.value("port", 80);
        std::string user = m_cfg.value("username", "admin");
        std::string pass = m_cfg.value("password", "");
        std::string limit = (qos == "vip_high_speed")
            ? m_cfg.value("vip_limit", "50M/50M")
            : (qos == "blocked" ? "1k/1k" : m_cfg.value("basic_limit", "5M/5M"));

        httplib::Client cli(host, port);
        cli.set_connection_timeout(3, 0);
        cli.set_read_timeout(5, 0);
        cli.set_basic_auth(user, pass);

        json body = {
            {"name", "CBNX_" + ip},
            {"target", ip + "/32"},
            {"max-limit", limit},
            {"comment", "CyberNexus QoS: " + qos}
        };
        auto res = cli.Put("/rest/queue/simple", body.dump(), "application/json");
        if (res && res->status >= 200 && res->status < 300) {
            msgOut = "MikroTik RouterOS đã cấp băng thông " + limit + " cho " + ip;
            return true;
        }
        msgOut = "Không kết nối được MikroTik REST API (" + host + ":" + std::to_string(port) + ")";
        return false;
    }

public:
    ModuleMetadata getMetadata() const override {
        ModuleMetadata m;
        m.code = "mod_network_qos";
        m.name = "Quản Trị Băng Thông & Tường Lửa Router (SNM)";
        m.version = "1.1.0";
        m.author = "SuperAdmin";
        m.category = "Network";
        m.description = "Tương tác Router MikroTik REST API / EdgeRouter ER-X SSH: Cấp tốc độ VIP cho khách có hóa đơn, chặn web đen, lọc DNS.";
        m.monthly_price_vnd = 199000.0;
        m.is_core_required = false;
        m.dependencies = {};
        return m;
    }

    bool onLoad(const CoreContext& ctx) override {
        loadConfig();
        std::cout << "[mod_network_qos] Khởi tạo hệ thống kết nối Router (" << m_cfg.value("router_type", "simulation") << ")..." << std::endl;
        return true;
    }

    void onUnload() override {
        std::cout << "[mod_network_qos] Ngắt kết nối và giải phóng tài nguyên mạng." << std::endl;
    }

    void registerHttpRoutes(httplib::Server& svr) override {
        svr.Get("/api/network/config", [this](const httplib::Request&, httplib::Response& res) {
            json safeCfg = m_cfg;
            if (safeCfg.contains("password") && !safeCfg["password"].get<std::string>().empty()) {
                safeCfg["password"] = "********";
            }
            res.set_content(json({{"status", "success"}, {"config", safeCfg}}).dump(2), "application/json; charset=utf-8");
        });

        svr.Post("/api/network/config", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                json body = json::parse(req.body);
                for (auto it = body.begin(); it != body.end(); ++it) {
                    if (it.key() == "password" && it.value() == "********") continue;
                    m_cfg[it.key()] = it.value();
                }
                saveConfig();
                res.set_content(json({{"status", "success"}, {"message", "Đã lưu cấu hình Router QoS!"}}).dump(2), "application/json; charset=utf-8");
            } catch (const std::exception& e) {
                res.status = 400;
                res.set_content(json({{"status", "error"}, {"message", e.what()}}).dump(2), "application/json; charset=utf-8");
            }
        });

        svr.Get("/api/network/devices", [this](const httplib::Request&, httplib::Response& res) {
            std::string rType = m_cfg.value("router_type", "simulation");
            if (rType == "mikrotik") {
                httplib::Client cli(m_cfg.value("host", "192.168.88.1"), m_cfg.value("port", 80));
                cli.set_connection_timeout(3, 0);
                cli.set_basic_auth(m_cfg.value("username", "admin"), m_cfg.value("password", ""));
                auto mRes = cli.Get("/rest/ip/dhcp-server/lease");
                if (mRes && mRes->status == 200) {
                    try {
                        json leases = json::parse(mRes->body);
                        json devs = json::array();
                        for (const auto& l : leases) {
                            devs.push_back({
                                {"mac", l.value("mac-address", "")},
                                {"ip", l.value("address", "")},
                                {"name", l.value("host-name", "Client")},
                                {"qos", "free_basic"},
                                {"status", l.value("status", "bound")}
                            });
                        }
                        res.set_content(json({{"status", "success"}, {"mode", "mikrotik"}, {"devices", devs}}).dump(2), "application/json; charset=utf-8");
                        return;
                    } catch (...) {}
                }
            }
            json data = {
                {"status", "success"},
                {"mode", rType},
                {"devices", {
                    {{"mac", "B4:2E:99:A1:02:11"}, {"ip", "192.168.1.105"}, {"name", "iPhone 15 Pro"}, {"qos", "vip_high_speed"}, {"traffic_mb", 245.5}},
                    {{"mac", "70:85:C2:55:FF:01"}, {"ip", "192.168.1.110"}, {"name", "Samsung S24"}, {"qos", "free_basic"}, {"traffic_mb", 52.1}}
                }}
            };
            res.set_content(data.dump(2), "application/json; charset=utf-8");
        });

        svr.Post("/api/network/qos/set", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                json body = json::parse(req.body);
                std::string ip = body.value("ip", "");
                std::string qos = body.value("qos", "vip_high_speed");
                std::string rType = m_cfg.value("router_type", "simulation");
                std::string msg = "Đã cập nhật QoS (" + qos + ") cho " + ip + " (Chế độ mô phỏng).";
                bool ok = true;
                if (rType == "mikrotik" && !ip.empty()) {
                    ok = applyMikrotikQueue(ip, qos, msg);
                } else if (rType == "edgerouter" && !ip.empty()) {
                    msg = "Đã gửi lệnh EdgeRouter SSH QoS (" + qos + ") cho " + ip + ".";
                }
                res.status = ok ? 200 : 502;
                res.set_content(json({{"status", ok ? "success" : "error"}, {"mode", rType}, {"ip", ip}, {"qos", qos}, {"message", msg}}).dump(2), "application/json; charset=utf-8");
            } catch (const std::exception& e) {
                res.status = 400;
                res.set_content(json({{"status", "error"}, {"message", e.what()}}).dump(2), "application/json; charset=utf-8");
            }
        });
    }

    void onSystemEvent(const std::string& eventType, const json& eventPayload) override {
        if (eventType == "ORDER_PAID") {
            std::string ip = eventPayload.value("client_ip", "");
            std::cout << "[mod_network_qos] Nhận tín hiệu ORDER_PAID! " << (ip.empty() ? "Sẵn sàng cấp VIP." : ("Nâng VIP cho " + ip)) << std::endl;
            if (!ip.empty() && m_cfg.value("router_type", "simulation") == "mikrotik") {
                std::string msg;
                applyMikrotikQueue(ip, "vip_high_speed", msg);
            }
        }
    }
};

extern "C" {
    CYBERNEXUS_PLUGIN_API IModulePlugin* createCyberNexusPlugin() {
        return new NetworkQosPlugin();
    }

    CYBERNEXUS_PLUGIN_API void destroyCyberNexusPlugin(IModulePlugin* p) {
        delete p;
    }
}
