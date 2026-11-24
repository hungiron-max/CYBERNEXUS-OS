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
#include <algorithm>
#include <cctype>
#include "sqlite3.h"
#include "embedded_web_assets.hpp"

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
                source_type TEXT DEFAULT 'local',
                source_url TEXT DEFAULT '',
                yt_video_id TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        )");
        execSql("ALTER TABLE media_tracks ADD COLUMN source_type TEXT DEFAULT 'local';");
        execSql("ALTER TABLE media_tracks ADD COLUMN source_url TEXT DEFAULT '';");
        execSql("ALTER TABLE media_tracks ADD COLUMN yt_video_id TEXT DEFAULT '';");

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
                requester_ip TEXT DEFAULT '',
                requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                played_at DATETIME
            );
        )");
        execSql("ALTER TABLE media_jukebox_queue ADD COLUMN requester_ip TEXT DEFAULT ''");

        execSql(R"(
            CREATE TABLE IF NOT EXISTS media_jukebox_votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                queue_id INTEGER NOT NULL,
                voter_key TEXT NOT NULL,
                voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(queue_id, voter_key)
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

        // MED-01: Do NOT seed ghost tracks or ghost queue rows when audio files do not exist on disk.
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

        // MED-01: Do NOT seed ghost playing/pending queue items on startup.
    }

    bool isTrackPlayableOnDisk(const json& track) const {
        if (!track.is_object()) return false;
        std::string srcType = track.value("source_type", "local");
        std::string ytId = track.value("yt_video_id", "");
        if (srcType == "youtube" && !ytId.empty()) return true;
        std::string fp = track.value("file_path", "");
        if (fp.empty()) return false;
        if (fp.rfind("http://", 0) == 0 || fp.rfind("https://", 0) == 0) return true;
        while (!fp.empty() && fp[0] == '/') fp.erase(fp.begin());
        std::error_code ec;
        if (std::filesystem::exists(fp, ec)) return true;
        if (std::filesystem::exists("web/" + fp, ec)) return true;
        if (std::filesystem::exists("./" + fp, ec)) return true;
        if (std::filesystem::exists("./web/" + fp, ec)) return true;
        return false;
    }

    static std::string toLowerTrim(const std::string& s) {
        std::string r = s;
        std::transform(r.begin(), r.end(), r.begin(), [](unsigned char c) { return (char)std::tolower(c); });
        while (!r.empty() && std::isspace((unsigned char)r.front())) r.erase(r.begin());
        while (!r.empty() && std::isspace((unsigned char)r.back())) r.pop_back();
        return r;
    }

    json getActiveScheduleInfo(int& outRemSec, bool& outMasterEnabled) {
        outRemSec = -1;
        outMasterEnabled = true;
        json mRow = queryOne("SELECT setting_value FROM store_settings WHERE setting_key = 'jukebox_schedule_enabled' LIMIT 1");
        if (mRow.is_object() && mRow.value("setting_value", "1") == "0") {
            outMasterEnabled = false;
            return nullptr;
        }
        std::time_t nowT = std::time(nullptr);
        std::tm lt{};
#ifdef _WIN32
        localtime_s(&lt, &nowT);
#else
        localtime_r(&nowT, &lt);
#endif
        int nowSec = lt.tm_hour * 3600 + lt.tm_min * 60 + lt.tm_sec;
        char hhmmBuf[8];
        std::snprintf(hhmmBuf, sizeof(hhmmBuf), "%02d:%02d", lt.tm_hour, lt.tm_min);
        std::string hhmm(hhmmBuf);

        json schedules = queryAll("SELECT * FROM media_time_schedules WHERE is_active = 1 ORDER BY start_time ASC, id ASC");
        for (const auto& sl : schedules) {
            std::string st = sl.value("start_time", "");
            std::string en = sl.value("end_time", "");
            if (st.size() != 5 || en.size() != 5) continue;
            bool inRange = (st <= en) ? (hhmm >= st && hhmm <= en) : (hhmm >= st || hhmm <= en);
            if (inRange) {
                int enH = std::stoi(en.substr(0, 2));
                int enM = std::stoi(en.substr(3, 2));
                int endSec = enH * 3600 + enM * 60 + 59;
                int rem = (st <= en)
                    ? (endSec - nowSec)
                    : ((hhmm >= st) ? ((86400 - nowSec) + endSec) : (endSec - nowSec));
                outRemSec = std::max(0, rem);
                return sl;
            }
        }
        return nullptr;
    }

    int computeQueueTotalSec(int& outPlayingRem, int& outPendingSec) {
        outPlayingRem = 0;
        outPendingSec = 0;
        json np = queryOne("SELECT track_duration, CAST((julianday('now') - julianday(COALESCE(played_at, datetime('now')))) * 86400 AS INTEGER) as elapsed FROM media_jukebox_queue WHERE status = 'playing' ORDER BY id DESC LIMIT 1");
        if (np.is_object()) {
            int dur = std::max(0, np.value("track_duration", 180));
            int el = std::max(0, np.value("elapsed", 0));
            outPlayingRem = std::max(0, dur - el);
        }
        json pend = queryOne("SELECT COALESCE(SUM(track_duration), 0) as s FROM media_jukebox_queue WHERE status = 'pending'");
        if (pend.is_object()) {
            outPendingSec = std::max(0, pend.value("s", 0));
        }
        return outPlayingRem + outPendingSec;
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
            execSql("PRAGMA busy_timeout = 5000;");
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
            auto escSql = [](const std::string& s) {
                std::string r;
                r.reserve(s.size());
                for (char c : s) {
                    if (c == '\'') r += "''";
                    else if (c != '\0') r += c;
                }
                return r;
            };

            std::string sql = "SELECT * FROM media_tracks WHERE is_active = 1";
            if (!kw.empty()) {
                std::string ekw = escSql(kw);
                sql += " AND (title LIKE '%" + ekw + "%' OR artist LIKE '%" + ekw + "%')";
            }
            if (!genre.empty() && genre != "all") {
                sql += " AND genre = '" + escSql(genre) + "'";
            }
            sql += " ORDER BY play_count DESC, id ASC";

            json rawTracks = queryAll(sql);
            bool playableOnly = req.has_param("playable_only") && req.get_param_value("playable_only") == "1";
            json tracks = json::array();
            for (auto& t : rawTracks) {
                bool ok = isTrackPlayableOnDisk(t);
                t["file_exists"] = ok;
                if (playableOnly && !ok) continue;
                tracks.push_back(t);
            }
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
                SELECT q.*, COALESCE(t.cover_image, '') as cover_image, COALESCE(t.genre, 'Lossless') as genre,
                       COALESCE(t.file_path, '') as file_path, COALESCE(t.source_type, 'local') as source_type,
                       COALESCE(t.yt_video_id, '') as yt_video_id
                FROM media_jukebox_queue q
                LEFT JOIN media_tracks t ON q.track_id = t.id
                WHERE q.status = 'playing' 
                ORDER BY q.id DESC LIMIT 1
            )");

            // MED-01: Clear ghost now_playing if underlying audio file does not exist on disk
            if (nowPlaying.is_object() && !isTrackPlayableOnDisk(nowPlaying)) {
                int64_t ghostQid = nowPlaying.value("id", 0LL);
                if (ghostQid > 0) {
                    execSql("UPDATE media_jukebox_queue SET status = 'skipped' WHERE id = " + std::to_string(ghostQid));
                }
                nowPlaying = nullptr;
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

            int slotRemSec = -1;
            bool masterSchedOn = true;
            json activeSlot = getActiveScheduleInfo(slotRemSec, masterSchedOn);
            int playingRemSec = 0, pendingSec = 0;
            int queueTotalSec = computeQueueTotalSec(playingRemSec, pendingSec);
            bool queueLockedBySlot = (masterSchedOn && activeSlot.is_object() && slotRemSec >= 0 && queueTotalSec >= (slotRemSec - 60));

            json out = {
                {"success", true},
                {"is_active", true},
                {"now_playing", nowPlaying.is_null() ? json(nullptr) : nowPlaying},
                {"queue", queue},
                {"history", history},
                {"schedule_master_enabled", masterSchedOn},
                {"active_schedule", activeSlot.is_null() ? json(nullptr) : activeSlot},
                {"slot_remaining_sec", slotRemSec},
                {"queue_total_sec", queueTotalSec},
                {"queue_locked_by_slot", queueLockedBySlot},
                {"server_time", std::time(nullptr)}
            };
            res.set_content(out.dump(), "application/json; charset=utf-8");
        });

        // ==========================================
        // 3. POST /api/media/jukebox/request - Khách gửi yêu cầu bài hát tại bàn
        // ==========================================
        svr.Post("/api/media/jukebox/request", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                // ANTISPAM-06: Kiểm tra công tắc Bật/Tắt quyền khách chọn nhạc Jukebox
                json jbAllow = queryOne("SELECT setting_value FROM store_settings WHERE setting_key = 'jukebox_guest_enabled' LIMIT 1");
                if (jbAllow.is_object() && jbAllow.value("setting_value", "1") == "0") {
                    res.status = 403;
                    res.set_content("{\"success\":false,\"message\":\"Jukebox đang ở chế độ quán tự phát nhạc. Vui lòng thử lại sau nhé!\"}", "application/json; charset=utf-8");
                    return;
                }

                json body = json::parse(req.body);
                int64_t trackId = body.value("track_id", 0);
                std::string tableName = body.value("table_name", "Khách tại bàn");
                int64_t tableId = body.value("table_id", 0);
                std::string phone = body.value("phone", "");
                // ANTISPAM-06: Tuyệt đối KHÔNG tin is_priority từ client gửi lên (chỉ tự bật = 1 qua sự kiện ORDER_PAID)
                int isPriority = 0;

                if (trackId <= 0) {
                    res.set_content("{\"success\":false,\"message\":\"Vui lòng chọn bài hát hợp lệ!\"}", "application/json; charset=utf-8");
                    return;
                }

                // 1. Kiểm tra bài hát có tồn tại và có file phát được thật trên đĩa không (MED-01)
                json track = queryOne("SELECT * FROM media_tracks WHERE id = " + std::to_string(trackId) + " AND is_active = 1");
                if (track.is_null()) {
                    res.status = 404;
                    res.set_content("{\"success\":false,\"message\":\"Bài hát không có trong kho bài của quán!\"}", "application/json; charset=utf-8");
                    return;
                }
                if (!isTrackPlayableOnDisk(track)) {
                    res.status = 400;
                    res.set_content("{\"success\":false,\"missing_file\":true,\"message\":\"Không tìm thấy file âm thanh của bài hát này trên máy chủ! Vui lòng tải lại file hoặc chọn bài khác.\"}", "application/json; charset=utf-8");
                    return;
                }

                // 1b. MED-02 & MED-04: Khóa thể loại theo khung giờ cho Khách bàn; Admin/Thu ngân có thể vượt khung giờ (force_override)
                std::string staffRole = req.get_header_value("X-CN-Staff-Role");
                bool isStaffOverride = (staffRole == "admin" || staffRole == "cashier") && body.value("force_override", true);
                int slotRemSec = -1;
                bool masterSchedOn = true;
                json activeSlot = getActiveScheduleInfo(slotRemSec, masterSchedOn);
                if (masterSchedOn && activeSlot.is_object() && !isStaffOverride) {
                    std::string reqGenre = activeSlot.value("genre", "");
                    std::string trkGenre = track.value("genre", "");
                    if (!reqGenre.empty() && toLowerTrim(reqGenre) != toLowerTrim(trkGenre)) {
                        res.status = 400;
                        json errOut = {
                            {"success", false},
                            {"slot_genre_mismatch", true},
                            {"allowed_genre", reqGenre},
                            {"message", "Khung giờ hiện tại (" + activeSlot.value("name", "") + " " + activeSlot.value("start_time", "") + "-" + activeSlot.value("end_time", "") + ") chỉ nhận nhạc thể loại \"" + reqGenre + "\"!"}
                        };
                        res.set_content(errOut.dump(), "application/json; charset=utf-8");
                        return;
                    }
                    int playingRem = 0, pendingSec = 0;
                    int curQueueTotal = computeQueueTotalSec(playingRem, pendingSec);
                    int trkDur = std::max(30, track.value("duration_sec", 180));
                    if (slotRemSec >= 0 && (curQueueTotal >= (slotRemSec - 60) || (curQueueTotal + trkDur) > (slotRemSec + 60))) {
                        res.status = 400;
                        json errOut = {
                            {"success", false},
                            {"queue_locked_by_slot", true},
                            {"slot_remaining_sec", slotRemSec},
                            {"queue_total_sec", curQueueTotal},
                            {"message", "Hàng đợi đã đủ phát sát mốc kết thúc khung giờ " + activeSlot.value("name", "") + " (" + activeSlot.value("end_time", "") + ", dung sai ±60s). Tạm khóa thêm bài cho đến khung giờ tiếp theo!"}
                        };
                        res.set_content(errOut.dump(), "application/json; charset=utf-8");
                        return;
                    }
                }

                auto sanitize = [](std::string s) {
                    size_t pos = 0;
                    while ((pos = s.find("'", pos)) != std::string::npos) {
                        s.replace(pos, 1, "''");
                        pos += 2;
                    }
                    return s;
                };

                // ANTISPAM-06: Dùng đúng req.remote_addr thật, tuyệt đối KHÔNG tin header X-Forwarded-For từ client
                std::string clientIp = req.remote_addr.empty() ? "unknown_client" : req.remote_addr;

                // 2a. Cooldown 60 giây giữa 2 lần thêm bài của cùng 1 thiết bị
                json recentReq = queryOne(
                    "SELECT id FROM media_jukebox_queue WHERE requester_ip = '" + sanitize(clientIp) +
                    "' AND requested_at >= datetime('now', '-60 seconds') LIMIT 1"
                );
                if (!recentReq.is_null()) {
                    res.status = 429;
                    res.set_content("{\"success\":false,\"cooldown\":true,\"message\":\"Bạn vừa yêu cầu một bài hát. Vui lòng đợi 60 giây trước khi chọn bài tiếp theo!\"}", "application/json; charset=utf-8");
                    return;
                }

                // 2b. Giới hạn mỗi thiết bị tối đa 3 bài đang chờ & tổng hàng đợi tối đa 25 bài
                json activeReq = queryOne(
                    "SELECT COUNT(*) as c FROM media_jukebox_queue WHERE requester_ip = '" + sanitize(clientIp) +
                    "' AND status = 'pending'"
                );
                int pendingByClient = activeReq.is_object() ? activeReq.value("c", 0) : 0;
                if (pendingByClient >= 3) {
                    res.status = 429;
                    res.set_content("{\"success\":false,\"limit_reached\":true,\"message\":\"Mỗi thiết bị chỉ được yêu cầu tối đa 3 bài đang chờ! Vui lòng đợi các bài trước phát xong.\"}", "application/json; charset=utf-8");
                    return;
                }
                json totalPending = queryOne("SELECT COUNT(*) as c FROM media_jukebox_queue WHERE status = 'pending'");
                if (totalPending.is_object() && totalPending.value("c", 0) >= 25) {
                    res.status = 429;
                    res.set_content("{\"success\":false,\"queue_full\":true,\"message\":\"Hàng đợi nhạc quán đang đầy (tối đa 25 bài). Vui lòng thử lại sau ít phút!\"}", "application/json; charset=utf-8");
                    return;
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

                std::string insertSql = "INSERT INTO media_jukebox_queue (track_id, track_title, track_artist, track_duration, table_id, table_name, customer_phone, is_priority, status, requester_ip) VALUES (" +
                    std::to_string(trackId) + ", '" + sanitize(title) + "', '" + sanitize(artist) + "', " + std::to_string(duration) + ", " +
                    std::to_string(tableId) + ", '" + sanitize(tableName) + "', '" + sanitize(phone) + "', " + std::to_string(isPriority) + ", 'pending', '" + sanitize(clientIp) + "')";

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
        // 4. POST /api/media/jukebox/vote - Bầu chọn (Vote up) bài hát (mỗi IP/khách chỉ vote 1 lần / bài)
        // ==========================================
        svr.Post("/api/media/jukebox/vote", [this](const httplib::Request& req, httplib::Response& res) {
            try {
                json jbAllow = queryOne("SELECT setting_value FROM store_settings WHERE setting_key = 'jukebox_guest_enabled' LIMIT 1");
                if (jbAllow.is_object() && jbAllow.value("setting_value", "1") == "0") {
                    res.status = 403;
                    res.set_content("{\"success\":false,\"message\":\"Chức năng bình chọn nhạc khách hàng đang tạm khóa!\"}", "application/json; charset=utf-8");
                    return;
                }
                json body = json::parse(req.body);
                int64_t queueId = body.value("queue_id", 0);
                if (queueId <= 0) {
                    res.set_content("{\"success\":false,\"message\":\"Thiếu mã queue_id!\"}", "application/json; charset=utf-8");
                    return;
                }

                json qItem = queryOne("SELECT id, status, vote_count, COALESCE(requester_ip, '') as requester_ip FROM media_jukebox_queue WHERE id = " + std::to_string(queueId));
                if (qItem.is_null() || qItem.value("status", "") != "pending") {
                    res.set_content("{\"success\":false,\"message\":\"Bài hát không còn nằm trong hàng đợi để bình chọn!\"}", "application/json; charset=utf-8");
                    return;
                }

                auto sanitize = [](std::string s) {
                    size_t pos = 0;
                    while ((pos = s.find("'", pos)) != std::string::npos) {
                        s.replace(pos, 1, "''");
                        pos += 2;
                    }
                    return s;
                };

                // ANTISPAM-06: Dùng req.remote_addr thật, cấm giả mạo X-Forwarded-For & cấm tự vote bài mình vừa thêm
                std::string voterKey = req.remote_addr.empty() ? "unknown_voter" : req.remote_addr;
                if (!qItem.value("requester_ip", "").empty() && qItem.value("requester_ip", "") == voterKey) {
                    res.status = 400;
                    res.set_content("{\"success\":false,\"message\":\"Bạn không thể tự bình chọn cho bài hát do chính mình vừa thêm!\"}", "application/json; charset=utf-8");
                    return;
                }
                json recentVotes = queryOne(
                    "SELECT COUNT(*) as c FROM media_jukebox_votes WHERE voter_key = '" + sanitize(voterKey) +
                    "' AND voted_at >= datetime('now', '-15 minutes')"
                );
                if (recentVotes.is_object() && recentVotes.value("c", 0) >= 5) {
                    res.status = 429;
                    res.set_content("{\"success\":false,\"message\":\"Bạn đã dùng hết 5 lượt bình chọn trong 15 phút. Vui lòng đợi ít phút!\"}", "application/json; charset=utf-8");
                    return;
                }

                json already = queryOne(
                    "SELECT id FROM media_jukebox_votes WHERE queue_id = " + std::to_string(queueId) +
                    " AND voter_key = '" + sanitize(voterKey) + "' LIMIT 1"
                );
                if (!already.is_null()) {
                    int currentVotes = qItem.value("vote_count", 1);
                    json out = {
                        {"success", false},
                        {"already_voted", true},
                        {"message", "Bạn đã bình chọn bài hát này rồi! Mỗi thiết bị chỉ được vote 1 lần cho 1 bài trong hàng chờ."},
                        {"votes", currentVotes}
                    };
                    res.set_content(out.dump(), "application/json; charset=utf-8");
                    return;
                }

                execSql("INSERT INTO media_jukebox_votes (queue_id, voter_key) VALUES (" + std::to_string(queueId) + ", '" + sanitize(voterKey) + "')");
                execSql("UPDATE media_jukebox_queue SET vote_count = vote_count + 1 WHERE id = " + std::to_string(queueId));
                json updated = queryOne("SELECT vote_count FROM media_jukebox_queue WHERE id = " + std::to_string(queueId));
                int votes = updated.is_object() ? updated.value("vote_count", 1) : 1;

                json out = {
                    {"success", true},
                    {"voted", true},
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

            // Đưa bài pending hợp lệ đầu tiên (có file thật trên đĩa) lên thành playing
            json pendingList = queryAll(R"(
                SELECT q.id, COALESCE(t.file_path, '') as file_path, COALESCE(t.source_type, 'local') as source_type, COALESCE(t.yt_video_id, '') as yt_video_id
                FROM media_jukebox_queue q
                LEFT JOIN media_tracks t ON q.track_id = t.id
                WHERE q.status = 'pending'
                ORDER BY q.is_priority DESC, q.vote_count DESC, q.id ASC
                LIMIT 15
            )");
            int64_t nextId = 0;
            for (const auto& pItem : pendingList) {
                if (isTrackPlayableOnDisk(pItem)) {
                    nextId = pItem.value("id", int64_t(0));
                    break;
                } else {
                    execSql("UPDATE media_jukebox_queue SET status = 'skipped' WHERE id = " + std::to_string(pItem.value("id", int64_t(0))));
                }
            }

            if (nextId > 0) {
                execSql("UPDATE media_jukebox_queue SET status = 'playing', played_at = datetime('now') WHERE id = " + std::to_string(nextId));
            } else {
                // Hết bài trong queue -> MED-01 & MED-02: Chọn bài có file thật & ưu tiên đúng thể loại khung giờ đang bật
                int slotRemSec = -1;
                bool masterSchedOn = true;
                json activeSlot = getActiveScheduleInfo(slotRemSec, masterSchedOn);
                std::string targetGenre = (masterSchedOn && activeSlot.is_object()) ? activeSlot.value("genre", "") : "";

                json allPlayable = queryAll("SELECT id, title, artist, duration_sec, genre, file_path, COALESCE(source_type, 'local') as source_type, COALESCE(yt_video_id, '') as yt_video_id FROM media_tracks WHERE is_active = 1 ORDER BY RANDOM()");
                json picked = nullptr;
                json fallback = nullptr;
                for (const auto& tr : allPlayable) {
                    if (!isTrackPlayableOnDisk(tr)) continue;
                    if (fallback.is_null()) fallback = tr;
                    if (!targetGenre.empty() && toLowerTrim(tr.value("genre", "")) == toLowerTrim(targetGenre)) {
                        picked = tr;
                        break;
                    }
                }
                if (picked.is_null()) picked = fallback;
                if (picked.is_object()) {
                    auto esc = [](std::string s) {
                        size_t pos = 0;
                        while ((pos = s.find("'", pos)) != std::string::npos) { s.replace(pos, 1, "''"); pos += 2; }
                        return s;
                    };
                    execSql(
                        "INSERT INTO media_jukebox_queue (track_id, track_title, track_artist, track_duration, table_name, status, played_at) VALUES (" +
                        std::to_string(picked.value("id", int64_t(0))) + ", '" + esc(picked.value("title", "")) + "', '" +
                        esc(picked.value("artist", "")) + "', " + std::to_string(picked.value("duration_sec", 180)) +
                        ", 'Quán Tự Động', 'playing', datetime('now'))"
                    );
                }
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

        extern void registerYoutubeAudioRoutes(httplib::Server& svr, sqlite3* db);
        registerYoutubeAudioRoutes(svr, m_db);

        // ARCH-08: Serve Media/Jukebox Add-on JS directly from signed C++ DLL
        svr.Get("/assets/js/admin_media_dsp.js", [](const httplib::Request&, httplib::Response& res) {
            res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            res.set_content(CyberNexusEmbeddedAssets::get_admin_media_dsp_js(), "application/javascript; charset=utf-8");
        });
        svr.Get("/assets/js/pos-jukebox.js", [](const httplib::Request&, httplib::Response& res) {
            res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            res.set_content(CyberNexusEmbeddedAssets::get_pos_jukebox_js(), "application/javascript; charset=utf-8");
        });
        svr.Get("/assets/js/jukebox-engine.js", [](const httplib::Request&, httplib::Response& res) {
            res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            res.set_content(CyberNexusEmbeddedAssets::get_jukebox_engine_js(), "application/javascript; charset=utf-8");
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
