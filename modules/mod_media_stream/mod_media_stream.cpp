#define BUILDING_PLUGIN_DLL
#include "IModulePlugin.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <chrono>
#include <ctime>
#include <regex>
#include <iomanip>
#include "sqlite3.h"

namespace fs = std::filesystem;
using namespace CyberNexus;

class MediaStreamPlugin : public IModulePlugin {
private:
    sqlite3* m_db{nullptr};
    std::string m_appVersion{"1.0.0"};
    std::string m_baseDir{"."};

    // Helper: Execute SQL command
    bool execSql(const std::string& sql) {
        if (!m_db) return false;
        char* errMsg = nullptr;
        int rc = sqlite3_exec(m_db, sql.c_str(), nullptr, nullptr, &errMsg);
        if (rc != SQLITE_OK) {
            std::cerr << "[mod_media_stream SQL Error] " << (errMsg ? errMsg : "Unknown") << " | Query: " << sql << std::endl;
            if (errMsg) sqlite3_free(errMsg);
            return false;
        }
        return true;
    }

    // Helper: Query JSON array
    json queryAll(const std::string& sql) {
        json rows = json::array();
        if (!m_db) return rows;

        sqlite3_stmt* stmt = nullptr;
        if (sqlite3_prepare_v2(m_db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            return rows;
        }

        int cols = sqlite3_column_count(stmt);
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            json row = json::object();
            for (int i = 0; i < cols; ++i) {
                const char* colName = sqlite3_column_name(stmt, i);
                int type = sqlite3_column_type(stmt, i);
                if (type == SQLITE_INTEGER) {
                    row[colName] = sqlite3_column_int64(stmt, i);
                } else if (type == SQLITE_FLOAT) {
                    row[colName] = sqlite3_column_double(stmt, i);
                } else if (type == SQLITE_TEXT) {
                    const unsigned char* txt = sqlite3_column_text(stmt, i);
                    row[colName] = txt ? reinterpret_cast<const char*>(txt) : "";
                } else if (type == SQLITE_NULL) {
                    row[colName] = nullptr;
                }
            }
            rows.push_back(row);
        }
        sqlite3_finalize(stmt);
        return rows;
    }

    // Helper: Query single row
    json queryOne(const std::string& sql) {
        json arr = queryAll(sql);
        if (!arr.empty() && arr.is_array()) return arr[0];
        return json(nullptr);
    }

    void ensureTables() {
        if (!m_db) return;

        execSql(R"(
            CREATE TABLE IF NOT EXISTS media_tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                artist TEXT NOT NULL DEFAULT 'Various Artists',
                album TEXT DEFAULT 'Cyber Lounge',
                genre TEXT DEFAULT 'Acoustic',
                duration_sec INTEGER NOT NULL DEFAULT 180,
                file_path TEXT NOT NULL DEFAULT '',
                bitrate INTEGER DEFAULT 320,
                cover_image TEXT DEFAULT '',
                play_count INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        )");

        execSql(R"(
            CREATE TABLE IF NOT EXISTS media_jukebox_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER NOT NULL,
                track_title TEXT NOT NULL,
                track_artist TEXT NOT NULL,
                track_duration INTEGER DEFAULT 180,
                table_id INTEGER NOT NULL DEFAULT 0,
                table_name TEXT NOT NULL DEFAULT 'Tại Bàn',
                customer_phone TEXT DEFAULT '',
                is_priority INTEGER DEFAULT 0,
                vote_count INTEGER DEFAULT 1,
                status TEXT DEFAULT 'pending',
                requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                played_at DATETIME
            );
        )");

        execSql(R"(
            CREATE TABLE IF NOT EXISTS media_eq_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                preset_name TEXT NOT NULL UNIQUE,
                preamp_gain REAL DEFAULT 0.0,
                band_31hz REAL DEFAULT 0.0,
                band_62hz REAL DEFAULT 0.0,
                band_125hz REAL DEFAULT 0.0,
                band_250hz REAL DEFAULT 0.0,
                band_500hz REAL DEFAULT 0.0,
                band_1khz REAL DEFAULT 0.0,
                band_2khz REAL DEFAULT 0.0,
                band_4khz REAL DEFAULT 0.0,
                band_8khz REAL DEFAULT 0.0,
                band_16khz REAL DEFAULT 0.0,
                is_active INTEGER DEFAULT 0
            );
        )");

        // Seed tracks if empty
        json countRow = queryOne("SELECT COUNT(*) as c FROM media_tracks");
        if (countRow.is_object() && countRow.value("c", 0) == 0) {
            execSql(R"(
                INSERT INTO media_tracks (title, artist, album, genre, duration_sec, file_path) VALUES
                ('Baby Blue', 'Bad Boys Blue', 'Super 20', 'Eurodance', 228, 'assets/media/BABY_BLUE___BAD_BOYS_BLUE.MP3'),
                ('74 - 75', 'The Connells', 'Ring', 'Pop Rock', 278, 'assets/media/74-75-The-Connels.mp3'),
                ('Yesterday Once More', 'Carpenters', 'Now & Then', 'Pop Ballad', 238, 'assets/media/Yesterday-Once-More.mp3'),
                ('Trouble Is A Friend', 'Lenka', 'Lenka', 'Indie Pop', 216, 'assets/media/Trouble Is A Friend - Lenka.mp3'),
                ('The Day You Went Away', 'M2M', 'Shades of Purple', 'Teen Pop', 223, 'assets/media/The day you went away - M2M.mp3'),
                ('Circle In The Sand', 'Belinda Carlisle', 'Heaven on Earth', 'Pop Rock', 242, 'assets/media/Circle-In-The-Sand.mp3');
            )");
        }

        // Seed / Upgrade EQ presets with 15 Pro Studio Mastering Presets
        json eqCount = queryOne("SELECT COUNT(*) as c FROM media_eq_presets WHERE preset_name LIKE '%Cinema 3D%'");
        if (eqCount.is_object() && eqCount.value("c", 0) == 0) {
            execSql("DELETE FROM media_eq_presets;");
            execSql(R"(
                INSERT INTO media_eq_presets (preset_name, preamp_gain, band_31hz, band_62hz, band_125hz, band_250hz, band_500hz, band_1khz, band_2khz, band_4khz, band_8khz, band_16khz, is_active) VALUES
                ('🎵 Flat (Gốc)', 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1),
                ('💥 Bass Boost', -1.0, 6.5, 6.0, 4.5, 2.5, 0.5, 0.0, 0.0, 0.5, 1.0, 1.5, 0),
                ('🔈 Bass Reducer', 0.5, -6.0, -5.0, -3.5, -2.0, 0.0, 0.5, 1.0, 1.0, 1.0, 0.5, 0),
                ('🎤 Vocal Clarity', 0.0, -2.0, -1.0, 0.0, 1.5, 3.0, 4.5, 3.5, 2.5, 1.5, 1.0, 0),
                ('🎙️ Podcast / Voice', 0.5, -5.0, -3.0, 0.5, 2.0, 3.5, 4.0, 3.0, 1.5, 0.0, -1.0, 0),
                ('🎶 Pop', 0.0, 2.0, 3.0, 2.0, 0.5, -0.5, 1.5, 2.5, 3.0, 2.5, 2.0, 0),
                ('🎸 Rock / Metal', 0.0, 4.5, 4.0, 2.5, 0.0, -2.0, 0.5, 2.5, 4.0, 4.5, 4.0, 0),
                ('🎤 Hip-Hop / R&B', -0.5, 6.0, 6.5, 4.0, 1.5, 0.0, 1.0, 1.5, 2.0, 3.5, 4.0, 0),
                ('🎧 EDM / Dance', -0.5, 5.5, 6.0, 4.5, 1.0, -1.5, 0.5, 2.5, 4.5, 5.5, 6.0, 0),
                ('🎷 Jazz & Acoustic', 0.5, 1.5, 2.0, 1.5, 1.0, 1.5, 2.0, 1.5, 1.0, 1.5, 2.0, 0),
                ('🎻 Classical', 0.0, 2.0, 2.0, 1.5, 1.0, 0.0, 0.0, 0.5, 1.5, 2.0, 2.5, 0),
                ('🔊 Loudness', -1.0, 5.0, 4.5, 2.5, 0.0, -1.5, -1.0, 0.5, 2.0, 4.0, 5.0, 0),
                ('🎬 Cinema 3D', 0.0, 5.5, 4.0, 2.0, 0.0, 1.0, 1.5, 2.5, 4.0, 5.0, 5.5, 0),
                ('✨ Treble Sparkle', 0.0, -1.0, -0.5, 0.0, 0.0, 0.5, 1.5, 3.0, 5.0, 6.5, 7.0, 0),
                ('🎛️ Tùy Chỉnh (Custom)', 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0);
            )");
        }

        // Seed Jukebox queue with a playing song and queued songs if empty
        json queueCount = queryOne("SELECT COUNT(*) as c FROM media_jukebox_queue WHERE status = 'playing'");
        if (queueCount.is_object() && queueCount.value("c", 0) == 0) {
            execSql(R"(
                INSERT INTO media_jukebox_queue (track_id, track_title, track_artist, track_duration, table_name, status, requested_at, played_at) VALUES
                (1, 'Baby Blue', 'Bad Boys Blue', 228, 'Hệ Thống Quán (Mặc định)', 'playing', datetime('now', '-2 minutes'), datetime('now', '-2 minutes')),
                (2, '74 - 75', 'The Connells', 278, 'Bàn 02', 'pending', datetime('now', '-1 minutes'), NULL),
                (3, 'Yesterday Once More', 'Carpenters', 238, 'Bàn 05 (VIP)', 'pending', datetime('now'), NULL);
            )");
        }
    }

public:
    ModuleMetadata getMetadata() const override {
        ModuleMetadata m;
        m.code = "mod_media_stream";
        m.name = "Máy Chủ Media Streaming & Jukebox Nội Bộ";
        m.version = "1.0.0";
        m.author = "SuperAdmin";
        m.category = "Media";
        m.description = "Phát nhạc/video chuẩn HTTP Range Requests, bộ 10-Band EQ chuyên nghiệp và Jukebox thông minh tương tác 2 chiều cho khách chọn bài tại bàn.";
        m.monthly_price_vnd = 119000.0;
        m.is_core_required = false;
        m.dependencies = {};
        return m;
    }

    bool onLoad(const CoreContext& ctx) override {
        m_appVersion = ctx.appVersion;
        // Mở kết nối SQLite độc lập an toàn bên trong DLL (WAL Mode)
        std::string dbPath = "./database/store_local.db";
        if (sqlite3_open_v2(dbPath.c_str(), &m_db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nullptr) != SQLITE_OK) {
            std::cerr << "[mod_media_stream Error] Khong the mo CSDL tai " << dbPath << std::endl;
        } else {
            execSql("PRAGMA journal_mode = WAL;");
            ensureTables();
        }
        std::cout << "[mod_media_stream] Kích hoạt Media Streaming, 10-Band DSP Equalizer và Smart Jukebox Engine." << std::endl;
        return true;
    }

    void onUnload() override {
        if (m_db) {
            sqlite3_close(m_db);
            m_db = nullptr;
        }
        std::cout << "[mod_media_stream] Giải phóng máy chủ Media Streaming." << std::endl;
    }

    void registerHttpRoutes(httplib::Server& svr) override {
        // ==========================================
        // 1. GET /api/media/tracks - Kho thư viện bài hát
        // ==========================================
        svr.Get("/api/media/tracks", [this](const httplib::Request& req, httplib::Response& res) {
            std::string kw = req.has_param("kw") ? req.get_param_value("kw") : "";
            std::string genre = req.has_param("genre") ? req.get_param_value("genre") : "";

            std::string sql = "SELECT * FROM media_tracks WHERE is_active = 1";
            if (!kw.empty()) {
                sql += " AND (title LIKE '%" + kw + "%' OR artist LIKE '%" + kw + "%')";
            }
            if (!genre.empty() && genre != "all") {
                sql += " AND genre = '" + genre + "'";
            }
            sql += " ORDER BY play_count DESC, id ASC";

            json tracks = queryAll(sql);
            json out = {
                {"success", true},
                {"count", tracks.size()},
                {"tracks", tracks}
            };
            res.set_content(out.dump(), "application/json; charset=utf-8");
        });

        // ==========================================
        // 2. GET /api/media/jukebox/status - Trạng thái Jukebox thời gian thực
        // ==========================================
        svr.Get("/api/media/jukebox/status", [this](const httplib::Request& req, httplib::Response& res) {
            // Lấy bài đang phát
            json nowPlaying = queryOne(R"(
                SELECT q.*, COALESCE(t.cover_image, '') as cover_image, COALESCE(t.genre, 'Lossless') as genre, COALESCE(t.file_path, '') as file_path 
                FROM media_jukebox_queue q
                LEFT JOIN media_tracks t ON q.track_id = t.id
                WHERE q.status = 'playing' 
                ORDER BY q.id DESC LIMIT 1
            )");

            // If nowPlaying has no valid file_path or track was removed, link to first available track
            if (nowPlaying.is_object() && nowPlaying.value("file_path", "").empty()) {
                json firstTrack = queryOne("SELECT id, title, artist, duration_sec, file_path, genre FROM media_tracks WHERE is_active = 1 LIMIT 1");
                if (firstTrack.is_object()) {
                    int64_t qId = nowPlaying.value("id", 0LL);
                    int64_t trId = firstTrack.value("id", 0LL);
                    std::string trTitle = firstTrack.value("title", "");
                    std::string trArtist = firstTrack.value("artist", "");
                    int trDur = firstTrack.value("duration_sec", 180);
                    execSql("UPDATE media_jukebox_queue SET track_id = " + std::to_string(trId) + 
                            ", track_title = '" + trTitle + "', track_artist = '" + trArtist + "', track_duration = " + std::to_string(trDur) + 
                            " WHERE id = " + std::to_string(qId));
                    nowPlaying = queryOne(R"(
                        SELECT q.*, COALESCE(t.cover_image, '') as cover_image, COALESCE(t.genre, 'Lossless') as genre, COALESCE(t.file_path, '') as file_path 
                        FROM media_jukebox_queue q
                        LEFT JOIN media_tracks t ON q.track_id = t.id
                        WHERE q.id = )" + std::to_string(qId));
                }
            }

            // Lấy danh sách hàng đợi
            json queue = queryAll(R"(
                SELECT q.*, COALESCE(t.cover_image, '') as cover_image, COALESCE(t.genre, 'Lossless') as genre
                FROM media_jukebox_queue q
                LEFT JOIN media_tracks t ON q.track_id = t.id
                WHERE q.status = 'pending'
                ORDER BY q.is_priority DESC, q.vote_count DESC, q.id ASC
                LIMIT 15
            )");

            // Lấy lịch sử 5 bài vừa phát
            json history = queryAll(R"(
                SELECT q.*, COALESCE(t.genre, 'Lossless') as genre
                FROM media_jukebox_queue q
                LEFT JOIN media_tracks t ON q.track_id = t.id
                WHERE q.status IN ('played', 'skipped')
                ORDER BY q.id DESC
                LIMIT 5
            )");

            json out = {
                {"success", true},
                {"is_active", true},
                {"now_playing", nowPlaying.is_null() ? json(nullptr) : nowPlaying},
                {"queue", queue},
                {"history", history},
                {"server_time", std::time(nullptr)}
            };
            res.set_content(out.dump(), "application/json; charset=utf-8");
        });

        // ==========================================
        // 3. POST /api/media/jukebox/request - Khách gửi yêu cầu bài hát tại bàn
        // ==========================================
        svr.Post("/api/media/jukebox/request", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                json body = json::parse(req.body);
                int64_t trackId = body.value("track_id", 0);
                std::string tableName = body.value("table_name", "Khách tại bàn");
                int64_t tableId = body.value("table_id", 0);
                std::string phone = body.value("phone", "");
                int isPriority = body.value("is_priority", 0);

                if (trackId <= 0) {
                    res.set_content("{\"success\":false,\"message\":\"Vui lòng chọn bài hát hợp lệ!\"}", "application/json; charset=utf-8");
                    return;
                }

                // 1. Kiểm tra bài hát có tồn tại không
                json track = queryOne("SELECT * FROM media_tracks WHERE id = " + std::to_string(trackId) + " AND is_active = 1");
                if (track.is_null()) {
                    res.set_content("{\"success\":false,\"message\":\"Bài hát không có trong kho bài của quán!\"}", "application/json; charset=utf-8");
                    return;
                }

                // 2. Chống SPAM: Cooldown bàn (15 phút nếu không phải VIP)
                if (isPriority == 0 && tableId > 0) {
                    json recentReq = queryOne(
                        "SELECT id FROM media_jukebox_queue WHERE table_id = " + std::to_string(tableId) + 
                        " AND requested_at >= datetime('now', '-15 minutes') LIMIT 1"
                    );
                    if (!recentReq.is_null()) {
                        res.set_content("{\"success\":false,\"message\":\"Bàn của bạn vừa yêu cầu bài hát. Vui lòng đợi 15 phút trước khi chọn bài tiếp theo!\"}", "application/json; charset=utf-8");
                        return;
                    }
                }

                // 3. Chống Duplicate: Bài đang phát hoặc có trong hàng đợi
                json dupCheck = queryOne(
                    "SELECT id FROM media_jukebox_queue WHERE track_id = " + std::to_string(trackId) + 
                    " AND status IN ('playing', 'pending') LIMIT 1"
                );
                if (!dupCheck.is_null()) {
                    res.set_content("{\"success\":false,\"message\":\"Bài hát này đang phát hoặc đã có trong hàng đợi chờ! Hãy chọn bài khác nhé.\"}", "application/json; charset=utf-8");
                    return;
                }

                // Thêm vào queue
                std::string title = track.value("title", "Bài hát");
                std::string artist = track.value("artist", "Ca sĩ");
                int duration = track.value("duration_sec", 180);

                // Escape single quote
                auto sanitize = [](std::string s) {
                    size_t pos = 0;
                    while ((pos = s.find("'", pos)) != std::string::npos) {
                        s.replace(pos, 1, "''");
                        pos += 2;
                    }
                    return s;
                };

                std::string insertSql = "INSERT INTO media_jukebox_queue (track_id, track_title, track_artist, track_duration, table_id, table_name, customer_phone, is_priority, status) VALUES (" +
                    std::to_string(trackId) + ", '" + sanitize(title) + "', '" + sanitize(artist) + "', " + std::to_string(duration) + ", " +
                    std::to_string(tableId) + ", '" + sanitize(tableName) + "', '" + sanitize(phone) + "', " + std::to_string(isPriority) + ", 'pending')";

                if (execSql(insertSql)) {
                    // Cập nhật play_count
                    execSql("UPDATE media_tracks SET play_count = play_count + 1 WHERE id = " + std::to_string(trackId));

                    // Lấy vị trí trong hàng đợi
                    json countQueue = queryOne("SELECT COUNT(*) as c FROM media_jukebox_queue WHERE status = 'pending'");
                    int pos = countQueue.is_object() ? countQueue.value("c", 1) : 1;

                    json out = {
                        {"success", true},
                        {"message", isPriority ? "Đã ưu tiên đưa bài lên đầu danh sách phát!" : "Yêu cầu thành công! Bài hát đã vào hàng đợi quán."},
                        {"queue_position", pos},
                        {"track", {{"title", title}, {"artist", artist}}}
                    };
                    res.set_content(out.dump(), "application/json; charset=utf-8");
                } else {
                    res.set_content("{\"success\":false,\"message\":\"Không thể lưu yêu cầu vào hàng đợi CSDL!\"}", "application/json; charset=utf-8");
                }
            } catch (const std::exception& e) {
                res.set_content("{\"success\":false,\"message\":\"Lỗi dữ liệu yêu cầu: " + std::string(e.what()) + "\"}", "application/json; charset=utf-8");
            }
        });

        // ==========================================
        // 4. POST /api/media/jukebox/vote - Bầu chọn (Vote up) bài hát
        // ==========================================
        svr.Post("/api/media/jukebox/vote", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                json body = json::parse(req.body);
                int64_t queueId = body.value("queue_id", 0);
                if (queueId <= 0) {
                    res.set_content("{\"success\":false,\"message\":\"Thiếu mã queue_id!\"}", "application/json; charset=utf-8");
                    return;
                }

                execSql("UPDATE media_jukebox_queue SET vote_count = vote_count + 1 WHERE id = " + std::to_string(queueId));
                json updated = queryOne("SELECT vote_count FROM media_jukebox_queue WHERE id = " + std::to_string(queueId));
                int votes = updated.is_object() ? updated.value("vote_count", 1) : 1;

                json out = {
                    {"success", true},
                    {"message", "Đã bầu chọn bài hát! Điểm số tăng lên #" + std::to_string(votes)},
                    {"votes", votes}
                };
                res.set_content(out.dump(), "application/json; charset=utf-8");
            } catch (...) {
                res.set_content("{\"success\":false,\"message\":\"Lỗi thực thi vote bài!\"}", "application/json; charset=utf-8");
            }
        });

        // ==========================================
        // 5. POST /api/media/jukebox/skip - Bỏ qua bài hát đang phát (Admin / Host)
        // ==========================================
        svr.Post("/api/media/jukebox/skip", [this](const httplib::Request& req, httplib::Response& res) {
            // Chuyển bài đang phát thành skipped
            execSql("UPDATE media_jukebox_queue SET status = 'skipped' WHERE status = 'playing'");

            // Đưa bài pending đầu tiên lên thành playing
            json nextSong = queryOne("SELECT id FROM media_jukebox_queue WHERE status = 'pending' ORDER BY is_priority DESC, vote_count DESC, id ASC LIMIT 1");
            if (!nextSong.is_null()) {
                int64_t nextId = nextSong.value("id", 0);
                execSql("UPDATE media_jukebox_queue SET status = 'playing', played_at = datetime('now') WHERE id = " + std::to_string(nextId));
            } else {
                // Hết bài trong queue -> Chèn bài mặc định
                execSql(R"(
                    INSERT INTO media_jukebox_queue (track_id, track_title, track_artist, track_duration, table_name, status, played_at)
                    SELECT id, title, artist, duration_sec, 'Quán Tự Động', 'playing', datetime('now')
                    FROM media_tracks ORDER BY RANDOM() LIMIT 1
                )");
            }

            res.set_content("{\"success\":true,\"message\":\"Đã chuyển sang bài hát kế tiếp!\"}", "application/json; charset=utf-8");
        });

        // ==========================================
        // 5b. POST /api/media/jukebox/remove - Xóa bài hát khỏi hàng đợi
        // ==========================================
        svr.Post("/api/media/jukebox/remove", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                json body = json::parse(req.body);
                int64_t queueId = body.value("queue_id", 0);
                if (queueId == 0) queueId = body.value("id", 0);
                if (queueId <= 0) {
                    res.set_content("{\"success\":false,\"message\":\"Thiếu mã queue_id!\"}", "application/json; charset=utf-8");
                    return;
                }
                execSql("DELETE FROM media_jukebox_queue WHERE id = " + std::to_string(queueId));
                res.set_content("{\"success\":true,\"message\":\"Đã xóa bài hát khỏi hàng đợi thành công!\"}", "application/json; charset=utf-8");
            } catch (...) {
                res.set_content("{\"success\":false,\"message\":\"Lỗi xóa bài hát khỏi hàng đợi!\"}", "application/json; charset=utf-8");
            }
        });

        // ==========================================
        // 6. GET /api/media/eq/presets - Lấy thông số 10-Band EQ & Presets
        // ==========================================
        svr.Get("/api/media/eq/presets", [this](const httplib::Request& req, httplib::Response& res) {
            json presets = queryAll("SELECT * FROM media_eq_presets ORDER BY id ASC");
            json active = queryOne("SELECT * FROM media_eq_presets WHERE is_active = 1 LIMIT 1");
            if (active.is_null() && !presets.empty()) active = presets[0];

            json out = {
                {"success", true},
                {"presets", presets},
                {"active", active}
            };
            res.set_content(out.dump(), "application/json; charset=utf-8");
        });

        // ==========================================
        // 7. POST /api/media/eq/apply - Lưu / Kích hoạt EQ Preset
        // ==========================================
        svr.Post("/api/media/eq/apply", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                json body = json::parse(req.body);
                std::string presetName = body.value("preset_name", "Custom Studio");
                double preamp = body.value("preamp_gain", body.value("preamp", 0.0));
                json b = body.contains("bands") ? body["bands"] : json::object();

                double b31 = body.value("band_31hz", b.value("31hz", 0.0));
                double b62 = body.value("band_62hz", b.value("62hz", 0.0));
                double b125 = body.value("band_125hz", b.value("125hz", 0.0));
                double b250 = body.value("band_250hz", b.value("250hz", 0.0));
                double b500 = body.value("band_500hz", b.value("500hz", 0.0));
                double b1k = body.value("band_1khz", b.value("1khz", 0.0));
                double b2k = body.value("band_2khz", b.value("2khz", 0.0));
                double b4k = body.value("band_4khz", b.value("4khz", 0.0));
                double b8k = body.value("band_8khz", b.value("8khz", 0.0));
                double b16k = body.value("band_16khz", b.value("16khz", 0.0));

                execSql("UPDATE media_eq_presets SET is_active = 0");

                if (body.contains("preset_id") && body["preset_id"].is_number()) {
                    int pid = body["preset_id"];
                    execSql("UPDATE media_eq_presets SET is_active = 1 WHERE id = " + std::to_string(pid));
                } else {
                    // Cập nhật preset hiện tại hoặc insert Custom
                    json existing = queryOne("SELECT id FROM media_eq_presets WHERE preset_name = '" + presetName + "'");
                    if (!existing.is_null()) {
                        std::string upSql = "UPDATE media_eq_presets SET preamp_gain = " + std::to_string(preamp) + 
                            ", band_31hz = " + std::to_string(b31) + ", band_62hz = " + std::to_string(b62) +
                            ", band_125hz = " + std::to_string(b125) + ", band_250hz = " + std::to_string(b250) +
                            ", band_500hz = " + std::to_string(b500) + ", band_1khz = " + std::to_string(b1k) +
                            ", band_2khz = " + std::to_string(b2k) + ", band_4khz = " + std::to_string(b4k) +
                            ", band_8khz = " + std::to_string(b8k) + ", band_16khz = " + std::to_string(b16k) +
                            ", is_active = 1 WHERE preset_name = '" + presetName + "'";
                        execSql(upSql);
                    } else {
                        std::string inSql = "INSERT INTO media_eq_presets (preset_name, preamp_gain, band_31hz, band_62hz, band_125hz, band_250hz, band_500hz, band_1khz, band_2khz, band_4khz, band_8khz, band_16khz, is_active) VALUES ('" +
                            presetName + "', " + std::to_string(preamp) + ", " + std::to_string(b31) + ", " + std::to_string(b62) + ", " +
                            std::to_string(b125) + ", " + std::to_string(b250) + ", " + std::to_string(b500) + ", " + std::to_string(b1k) + ", " +
                            std::to_string(b2k) + ", " + std::to_string(b4k) + ", " + std::to_string(b8k) + ", " + std::to_string(b16k) + ", 1)";
                        execSql(inSql);
                    }
                }

                res.set_content("{\"success\":true,\"message\":\"Đã áp dụng cấu hình Equalizer thành công!\"}", "application/json; charset=utf-8");
            } catch (const std::exception& e) {
                res.set_content("{\"success\":false,\"message\":\"Lỗi áp dụng Equalizer: " + std::string(e.what()) + "\"}", "application/json; charset=utf-8");
            }
        });

        // ==========================================
        // 8. POST /api/media/ducking - Hạ âm lượng khi POS / KDS gọi món
        // ==========================================
        svr.Post("/api/media/ducking", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                json body = json::parse(req.body.empty() ? "{}" : req.body);
                int durationSec = body.value("duration_sec", 4);
                double duckLevel = body.value("duck_level", 0.2); // 20% âm lượng gốc (-14dB)
                
                std::cout << "[mod_media_stream] Auto-Ducking kích hoạt: Hạ âm lượng xuống " << (duckLevel * 100)
                          << "% trong " << durationSec << " giây để gọi món." << std::endl;

                json out = {
                    {"success", true},
                    {"message", "Đã kích hoạt Auto-Ducking âm lượng thành công!"},
                    {"duck_level", duckLevel},
                    {"duration_sec", durationSec}
                };
                res.set_content(out.dump(), "application/json; charset=utf-8");
            } catch (...) {
                res.set_content("{\"success\":false,\"message\":\"Lỗi kích hoạt Auto-Ducking\"}", "application/json; charset=utf-8");
            }
        });
    }

    void onSystemEvent(const std::string& eventType, const json& eventPayload) override {
        // Tích hợp VIP Pass khi hóa đơn POS thanh toán trên 200k
        if (eventType == "ORDER_PAID") {
            double total = eventPayload.value("total_amount", 0.0);
            std::string tableName = eventPayload.value("table_name", "");
            if (tableName.empty()) tableName = eventPayload.value("table_code", "Bàn VIP");
            if (total >= 200000.0) {
                std::cout << "[mod_media_stream] Khách " << tableName << " thanh toán " << total 
                          << " VND -> Tự động kích hoạt VIP Priority Jukebox Pass!" << std::endl;
                std::string sql = "UPDATE media_jukebox_queue SET is_priority = 1 WHERE status = 'pending' AND (table_name = '" + tableName + "' OR table_name LIKE '%" + tableName + "%')";
                execSql(sql);
            }
        }
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
