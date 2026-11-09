#define BUILDING_PLUGIN_DLL
#include "IModulePlugin.hpp"
#include <iostream>

using namespace CyberNexus;

class MediaStreamPlugin : public IModulePlugin {
public:
    ModuleMetadata getMetadata() const override {
        ModuleMetadata m;
        m.code = "mod_media_stream";
        m.name = "Máy Chủ Media Streaming & Jukebox Nội Bộ";
        m.version = "1.0.0";
        m.author = "SuperAdmin";
        m.category = "Media";
        m.description = "Phát nhạc/video chuẩn HTTP Range Requests, quản lý hàng đợi chọn bài Jukebox của khách.";
        m.monthly_price_vnd = 119000.0;
        m.is_core_required = false;
        m.dependencies = {};
        return m;
    }

    bool onLoad(const CoreContext& ctx) override {
        std::cout << "[mod_media_stream] Đã kích hoạt máy chủ Media Streaming & Audio Engine." << std::endl;
        return true;
    }

    void onUnload() override {
        std::cout << "[mod_media_stream] Đã giải phóng máy chủ Media Streaming." << std::endl;
    }

    void registerHttpRoutes(httplib::Server& svr) override {
        // GET /api/media/playlist - Danh sách bài hát
        svr.Get("/api/media/playlist", [](const httplib::Request& req, httplib::Response& res) {
            json data = {
                {"status", "success"},
                {"tracks", {
                    {{"id", 1}, {"title", "Lofi Chill Morning Coffee"}, {"duration", 215}, {"artist", "CyberNexus Sound"}},
                    {{"id", 2}, {"title", "Acoustic Pop Afternoon"}, {"duration", 184}, {"artist", "Indie Vibes"}}
                }}
            };
            res.set_content(data.dump(2), "application/json; charset=utf-8");
        });

        // POST /api/media/jukebox/vote - Khách vote bài
        svr.Post("/api/media/jukebox/vote", [](const httplib::Request& req, httplib::Response& res) {
            json data = {
                {"status", "success"},
                {"message", "Đã thêm bài hát vào hàng đợi Jukebox của quán."}
            };
            res.set_content(data.dump(2), "application/json; charset=utf-8");
        });
    }
};

extern "C" {
    CYBERNEXUS_PLUGIN_API IModulePlugin* createCyberNexusPlugin() {
        return new MediaStreamPlugin();
    }

    CYBERNEXUS_PLUGIN_API void destroyCyberNexusPlugin(IModulePlugin* p) {
        delete p;
    }
}
