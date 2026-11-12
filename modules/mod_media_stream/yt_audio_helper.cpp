#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include "httplib.h"
#include "nlohmann/json.hpp"
#include <sqlite3.h>

#ifdef _WIN32
#include <windows.h>
#include <winhttp.h>
#endif

#include <atomic>
#include <chrono>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <memory>
#include <mutex>
#include <regex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace fs = std::filesystem;
using json = nlohmann::json;

namespace {

struct YtStreamCacheEntry {
    std::string streamUrl;
    std::string mimeType = "audio/mp4";
    long long contentLength = 0;
    std::chrono::steady_clock::time_point expiresAt;
};

struct YtDownloadJob {
    std::string jobId;
    int trackId = 0;
    std::string videoId;
    std::string title;
    std::string status = "queued"; // queued | downloading | completed | failed
    int progress = 0;
    std::string message;
    std::string filePath;
};

static std::mutex s_cacheMtx;
static std::unordered_map<std::string, YtStreamCacheEntry> s_ytCache;

static std::mutex s_jobsMtx;
static std::unordered_map<std::string, YtDownloadJob> s_jobs;

static std::mutex s_dbMtx;

static fs::path getExeDir() {
#ifdef _WIN32
    char buf[MAX_PATH] = {0};
    DWORD len = GetModuleFileNameA(nullptr, buf, MAX_PATH);
    if (len > 0) {
        return fs::path(std::string(buf, len)).parent_path();
    }
#endif
    return fs::current_path();
}

static fs::path getToolsDir() { return getExeDir() / "tools"; }
static fs::path getMediaDir() { return getExeDir() / "assets" / "media"; }
static fs::path getWebMediaDir() { return getExeDir() / "web" / "assets" / "media"; }

static std::string extractYtVideoId(const std::string& input) {
    std::string trimmed = input;
    // trim whitespace
    size_t first = trimmed.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    size_t last = trimmed.find_last_not_of(" \t\r\n");
    trimmed = trimmed.substr(first, last - first + 1);

    static const std::regex rawIdRe("^([A-Za-z0-9_-]{11})$");
    std::smatch m;
    if (std::regex_match(trimmed, m, rawIdRe)) {
        return m[1].str();
    }

    static const std::regex urlRe(
        R"((?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/|live/)|youtu\.be/)([A-Za-z0-9_-]{11}))",
        std::regex::icase
    );
    if (std::regex_search(trimmed, m, urlRe)) {
        return m[1].str();
    }
    return "";
}

static std::string sanitizeText(const std::string& s, size_t maxLen = 180) {
    std::string out;
    out.reserve(std::min(s.size(), maxLen));
    for (char c : s) {
        if (c == '\r' || c == '\n' || c == '\t') {
            out.push_back(' ');
        } else {
            out.push_back(c);
        }
        if (out.size() >= maxLen) break;
    }
    return out;
}

static int runProcessHidden(const std::string& cmdLine, std::string& outStdout, DWORD timeoutMs = 30000) {
    outStdout.clear();
#ifdef _WIN32
    SECURITY_ATTRIBUTES sa{};
    sa.nLength = sizeof(SECURITY_ATTRIBUTES);
    sa.bInheritHandle = TRUE;
    sa.lpSecurityDescriptor = nullptr;

    HANDLE hReadPipe = nullptr;
    HANDLE hWritePipe = nullptr;
    if (!CreatePipe(&hReadPipe, &hWritePipe, &sa, 0)) {
        return -1;
    }
    SetHandleInformation(hReadPipe, HANDLE_FLAG_INHERIT, 0);

    STARTUPINFOA si{};
    si.cb = sizeof(STARTUPINFOA);
    si.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    si.hStdOutput = hWritePipe;
    si.hStdError = hWritePipe;

    PROCESS_INFORMATION pi{};
    std::vector<char> cmdBuf(cmdLine.begin(), cmdLine.end());
    cmdBuf.push_back('\0');

    BOOL ok = CreateProcessA(
        nullptr,
        cmdBuf.data(),
        nullptr,
        nullptr,
        TRUE,
        CREATE_NO_WINDOW,
        nullptr,
        nullptr,
        &si,
        &pi
    );

    CloseHandle(hWritePipe);
    if (!ok) {
        CloseHandle(hReadPipe);
        return -2;
    }

    auto startTick = GetTickCount64();
    char buffer[4096];
    DWORD bytesRead = 0;
    bool timedOut = false;

    while (true) {
        DWORD avail = 0;
        if (PeekNamedPipe(hReadPipe, nullptr, 0, nullptr, &avail, nullptr) && avail > 0) {
            if (ReadFile(hReadPipe, buffer, sizeof(buffer), &bytesRead, nullptr) && bytesRead > 0) {
                outStdout.append(buffer, bytesRead);
                continue;
            }
        }
        DWORD waitRes = WaitForSingleObject(pi.hProcess, 50);
        if (waitRes == WAIT_OBJECT_0) {
            while (ReadFile(hReadPipe, buffer, sizeof(buffer), &bytesRead, nullptr) && bytesRead > 0) {
                outStdout.append(buffer, bytesRead);
            }
            break;
        }
        if (GetTickCount64() - startTick > timeoutMs) {
            timedOut = true;
            TerminateProcess(pi.hProcess, 1);
            break;
        }
    }

    DWORD exitCode = 1;
    if (!timedOut) {
        GetExitCodeProcess(pi.hProcess, &exitCode);
    } else {
        exitCode = 124;
    }

    CloseHandle(hReadPipe);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    return static_cast<int>(exitCode);
#else
    return -1;
#endif
}

static bool fetchYoutubeMeta(const std::string& videoId, json& outMeta, std::string& outErr) {
    fs::path ytdlp = getToolsDir() / "yt-dlp.exe";
    if (!fs::exists(ytdlp)) {
        outErr = "Không tìm thấy yt-dlp.exe trong thư mục tools/";
        return false;
    }

    std::string cmd = "\"" + ytdlp.string() + "\" --no-playlist -f \"bestaudio[ext=m4a]/bestaudio\" --dump-single-json --no-warnings \"https://www.youtube.com/watch?v=" + videoId + "\"";
    std::string output;
    int rc = runProcessHidden(cmd, output, 30000);
    if (rc != 0 || output.empty()) {
        outErr = "Không thể lấy thông tin video YouTube (mã lỗi " + std::to_string(rc) + ")";
        return false;
    }

    // Find JSON object start in case warnings appeared before '{'
    size_t jsonStart = output.find('{');
    if (jsonStart == std::string::npos) {
        outErr = "Dữ liệu trả về từ yt-dlp không hợp lệ";
        return false;
    }
    try {
        outMeta = json::parse(output.substr(jsonStart));
        return true;
    } catch (...) {
        outErr = "Lỗi phân tích JSON metadata từ yt-dlp";
        return false;
    }
}

static std::string mimeFromExt(const std::string& ext) {
    if (ext == "m4a" || ext == "mp4") return "audio/mp4";
    if (ext == "webm" || ext == "opus") return "audio/webm";
    if (ext == "ogg") return "audio/ogg";
    return "audio/mpeg";
}

static bool resolveYoutubeStreamUrl(const std::string& videoId, YtStreamCacheEntry& outEntry, std::string& outErr, bool forceRefresh = false) {
    if (!forceRefresh) {
        std::lock_guard<std::mutex> lk(s_cacheMtx);
        auto it = s_ytCache.find(videoId);
        if (it != s_ytCache.end() && std::chrono::steady_clock::now() < it->second.expiresAt) {
            outEntry = it->second;
            return true;
        }
    }

    json meta;
    if (!fetchYoutubeMeta(videoId, meta, outErr)) {
        return false;
    }

    std::string streamUrl = meta.value("url", "");
    if (streamUrl.empty()) {
        outErr = "yt-dlp không trả về URL audio stream";
        return false;
    }

    YtStreamCacheEntry entry;
    entry.streamUrl = streamUrl;
    entry.mimeType = mimeFromExt(meta.value("ext", "m4a"));
    if (meta.contains("filesize") && meta["filesize"].is_number_integer()) {
        entry.contentLength = meta["filesize"].get<long long>();
    } else if (meta.contains("filesize_approx") && meta["filesize_approx"].is_number_integer()) {
        entry.contentLength = meta["filesize_approx"].get<long long>();
    }
    entry.expiresAt = std::chrono::steady_clock::now() + std::chrono::hours(3);

    {
        std::lock_guard<std::mutex> lk(s_cacheMtx);
        s_ytCache[videoId] = entry;
    }
    outEntry = entry;
    return true;
}

#ifdef _WIN32
struct WinHttpHandles {
    HINTERNET hSession = nullptr;
    HINTERNET hConnect = nullptr;
    HINTERNET hRequest = nullptr;
    ~WinHttpHandles() {
        if (hRequest) WinHttpCloseHandle(hRequest);
        if (hConnect) WinHttpCloseHandle(hConnect);
        if (hSession) WinHttpCloseHandle(hSession);
    }
};

static std::wstring utf8ToWide(const std::string& s) {
    if (s.empty()) return L"";
    int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), nullptr, 0);
    std::wstring w(n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), w.data(), n);
    return w;
}

static std::string wideToUtf8(const std::wstring& w) {
    if (w.empty()) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), static_cast<int>(w.size()), nullptr, 0, nullptr, nullptr);
    std::string s(n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.c_str(), static_cast<int>(w.size()), s.data(), n, nullptr, nullptr);
    return s;
}

static bool openWinHttpStream(
    const std::string& url,
    const std::string& rangeHeader,
    std::shared_ptr<WinHttpHandles>& outHandles,
    int& outStatus,
    long long& outContentLength,
    std::string& outContentType,
    std::string& outContentRange
) {
    std::wstring wUrl = utf8ToWide(url);
    URL_COMPONENTS urlComp{};
    urlComp.dwStructSize = sizeof(urlComp);
    wchar_t hostBuf[512] = {0};
    wchar_t pathBuf[4096] = {0};
    wchar_t extraBuf[4096] = {0};
    urlComp.lpszHostName = hostBuf;
    urlComp.dwHostNameLength = 512;
    urlComp.lpszUrlPath = pathBuf;
    urlComp.dwUrlPathLength = 4096;
    urlComp.lpszExtraInfo = extraBuf;
    urlComp.dwExtraInfoLength = 4096;

    if (!WinHttpCrackUrl(wUrl.c_str(), static_cast<DWORD>(wUrl.size()), 0, &urlComp)) {
        return false;
    }

    std::wstring fullPath = std::wstring(urlComp.lpszUrlPath, urlComp.dwUrlPathLength) +
                            std::wstring(urlComp.lpszExtraInfo, urlComp.dwExtraInfoLength);
    if (fullPath.empty()) fullPath = L"/";

    auto handles = std::make_shared<WinHttpHandles>();
    handles->hSession = WinHttpOpen(
        L"Mozilla/5.0 (Windows NT 10.0; Win64; x64) CyberNexusMedia/1.0",
        WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
        WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS,
        0
    );
    if (!handles->hSession) return false;

    WinHttpSetTimeouts(handles->hSession, 10000, 10000, 15000, 30000);

    handles->hConnect = WinHttpConnect(handles->hSession, hostBuf, urlComp.nPort, 0);
    if (!handles->hConnect) return false;

    DWORD flags = (urlComp.nScheme == INTERNET_SCHEME_HTTPS) ? WINHTTP_FLAG_SECURE : 0;
    handles->hRequest = WinHttpOpenRequest(
        handles->hConnect,
        L"GET",
        fullPath.c_str(),
        nullptr,
        WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES,
        flags
    );
    if (!handles->hRequest) return false;

    if (!rangeHeader.empty()) {
        std::wstring hdr = L"Range: " + utf8ToWide(rangeHeader) + L"\r\n";
        WinHttpAddRequestHeaders(handles->hRequest, hdr.c_str(), static_cast<DWORD>(hdr.size()), WINHTTP_ADDREQ_FLAG_ADD);
    }

    if (!WinHttpSendRequest(handles->hRequest, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0)) {
        return false;
    }
    if (!WinHttpReceiveResponse(handles->hRequest, nullptr)) {
        return false;
    }

    DWORD statusCode = 0;
    DWORD statusSize = sizeof(statusCode);
    WinHttpQueryHeaders(handles->hRequest, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_HEADER_NAME_BY_INDEX, &statusCode, &statusSize, WINHTTP_NO_HEADER_INDEX);
    outStatus = static_cast<int>(statusCode);

    wchar_t clBuf[64] = {0};
    DWORD clSize = sizeof(clBuf);
    outContentLength = -1;
    if (WinHttpQueryHeaders(handles->hRequest, WINHTTP_QUERY_CONTENT_LENGTH, WINHTTP_HEADER_NAME_BY_INDEX, clBuf, &clSize, WINHTTP_NO_HEADER_INDEX)) {
        try {
            outContentLength = std::stoll(wideToUtf8(clBuf));
        } catch (...) {
            outContentLength = -1;
        }
    }

    wchar_t ctBuf[256] = {0};
    DWORD ctSize = sizeof(ctBuf);
    if (WinHttpQueryHeaders(handles->hRequest, WINHTTP_QUERY_CONTENT_TYPE, WINHTTP_HEADER_NAME_BY_INDEX, ctBuf, &ctSize, WINHTTP_NO_HEADER_INDEX)) {
        outContentType = wideToUtf8(ctBuf);
    }

    wchar_t crBuf[256] = {0};
    DWORD crSize = sizeof(crBuf);
    if (WinHttpQueryHeaders(handles->hRequest, WINHTTP_QUERY_CONTENT_RANGE, WINHTTP_HEADER_NAME_BY_INDEX, crBuf, &crSize, WINHTTP_NO_HEADER_INDEX)) {
        outContentRange = wideToUtf8(crBuf);
    }

    outHandles = handles;
    return true;
}
#endif

static bool queryTrackById(sqlite3* db, int trackId, std::string& outSourceType, std::string& outFilePath, std::string& outYtId, std::string& outSourceUrl) {
    std::lock_guard<std::mutex> lk(s_dbMtx);
    sqlite3_stmt* stmt = nullptr;
    const char* sql = "SELECT COALESCE(source_type,'local'), COALESCE(file_path,''), COALESCE(yt_video_id,''), COALESCE(source_url,'') FROM media_tracks WHERE id = ? LIMIT 1;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return false;
    sqlite3_bind_int(stmt, 1, trackId);
    bool found = false;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        found = true;
        auto colStr = [&](int idx) -> std::string {
            const unsigned char* t = sqlite3_column_text(stmt, idx);
            return t ? reinterpret_cast<const char*>(t) : "";
        };
        outSourceType = colStr(0);
        outFilePath = colStr(1);
        outYtId = colStr(2);
        outSourceUrl = colStr(3);
    }
    sqlite3_finalize(stmt);
    return found;
}

static int findTrackByYtId(sqlite3* db, const std::string& videoId) {
    std::lock_guard<std::mutex> lk(s_dbMtx);
    sqlite3_stmt* stmt = nullptr;
    const char* sql = "SELECT id FROM media_tracks WHERE yt_video_id = ? AND is_active = 1 LIMIT 1;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return 0;
    sqlite3_bind_text(stmt, 1, videoId.c_str(), -1, SQLITE_TRANSIENT);
    int id = 0;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        id = sqlite3_column_int(stmt, 0);
    }
    sqlite3_finalize(stmt);
    return id;
}

static int insertTrack(
    sqlite3* db,
    const std::string& title,
    const std::string& artist,
    const std::string& genre,
    int durationSec,
    const std::string& filePath,
    int bitrate,
    const std::string& coverImage,
    const std::string& sourceType,
    const std::string& sourceUrl,
    const std::string& ytVideoId
) {
    std::lock_guard<std::mutex> lk(s_dbMtx);
    sqlite3_stmt* stmt = nullptr;
    const char* sql =
        "INSERT INTO media_tracks (title, artist, album, genre, duration_sec, file_path, bitrate, cover_image, is_active, source_type, source_url, yt_video_id) "
        "VALUES (?, ?, 'YouTube Audio', ?, ?, ?, ?, ?, 1, ?, ?, ?);";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return 0;
    sqlite3_bind_text(stmt, 1, title.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 2, artist.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 3, genre.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 4, durationSec > 0 ? durationSec : 180);
    sqlite3_bind_text(stmt, 5, filePath.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 6, bitrate);
    sqlite3_bind_text(stmt, 7, coverImage.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 8, sourceType.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 9, sourceUrl.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 10, ytVideoId.c_str(), -1, SQLITE_TRANSIENT);

    int newId = 0;
    if (sqlite3_step(stmt) == SQLITE_DONE) {
        newId = static_cast<int>(sqlite3_last_insert_rowid(db));
    }
    sqlite3_finalize(stmt);

    // If stream mode / hybrid mode without file_path yet, set file_path = /api/media/stream-yt?id=<newId>
    if (newId > 0 && filePath.empty()) {
        std::string streamPath = "/api/media/stream-yt?id=" + std::to_string(newId);
        sqlite3_stmt* up = nullptr;
        if (sqlite3_prepare_v2(db, "UPDATE media_tracks SET file_path = ? WHERE id = ?;", -1, &up, nullptr) == SQLITE_OK) {
            sqlite3_bind_text(up, 1, streamPath.c_str(), -1, SQLITE_TRANSIENT);
            sqlite3_bind_int(up, 2, newId);
            sqlite3_step(up);
            sqlite3_finalize(up);
        }
    }
    return newId;
}

static bool upgradeTrackToLocal(sqlite3* db, int trackId, const std::string& relPath) {
    std::lock_guard<std::mutex> lk(s_dbMtx);
    sqlite3_stmt* stmt = nullptr;
    const char* sql = "UPDATE media_tracks SET file_path = ?, source_type = 'local', bitrate = 192 WHERE id = ?;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) return false;
    sqlite3_bind_text(stmt, 1, relPath.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 2, trackId);
    bool ok = (sqlite3_step(stmt) == SQLITE_DONE);
    sqlite3_finalize(stmt);
    return ok;
}

static std::string startOfflineDownloadJob(
    sqlite3* db,
    int existingTrackId,
    const std::string& videoId,
    const std::string& title,
    const std::string& artist,
    const std::string& genre,
    int durationSec,
    const std::string& coverImage
) {
    std::string jobId = "yt_" + videoId + "_" + std::to_string(
        std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count() % 100000
    );

    {
        std::lock_guard<std::mutex> lk(s_jobsMtx);
        YtDownloadJob job;
        job.jobId = jobId;
        job.trackId = existingTrackId;
        job.videoId = videoId;
        job.title = title;
        job.status = "downloading";
        job.progress = 15;
        job.message = "Đang tải audio từ YouTube và convert MP3...";
        s_jobs[jobId] = job;
    }

    std::thread([db, jobId, existingTrackId, videoId, title, artist, genre, durationSec, coverImage]() {
        auto updateJob = [&](const std::string& status, int progress, const std::string& msg, int tid = 0, const std::string& fp = "") {
            std::lock_guard<std::mutex> lk(s_jobsMtx);
            auto it = s_jobs.find(jobId);
            if (it != s_jobs.end()) {
                it->second.status = status;
                it->second.progress = progress;
                it->second.message = msg;
                if (tid > 0) it->second.trackId = tid;
                if (!fp.empty()) it->second.filePath = fp;
            }
        };

        fs::path toolsDir = getToolsDir();
        fs::path ytdlp = toolsDir / "yt-dlp.exe";
        fs::path ffmpeg = toolsDir / "ffmpeg.exe";
        if (!fs::exists(ytdlp) || !fs::exists(ffmpeg)) {
            updateJob("failed", 0, "Thiếu yt-dlp.exe hoặc ffmpeg.exe trong tools/");
            return;
        }

        std::error_code ec;
        fs::path mediaDir = getMediaDir();
        fs::path webMediaDir = getWebMediaDir();
        fs::create_directories(mediaDir, ec);
        fs::create_directories(webMediaDir, ec);

        std::string baseName = "yt_" + videoId;
        fs::path outTpl = mediaDir / (baseName + ".%(ext)s");
        fs::path finalMp3 = mediaDir / (baseName + ".mp3");
        fs::path webMp3 = webMediaDir / (baseName + ".mp3");
        std::string relPath = "assets/media/" + baseName + ".mp3";

        std::string cmd = "\"" + ytdlp.string() + "\" --no-playlist -x --audio-format mp3 --audio-quality 192K "
                          "--ffmpeg-location \"" + toolsDir.string() + "\" "
                          "-o \"" + outTpl.string() + "\" "
                          "\"https://www.youtube.com/watch?v=" + videoId + "\"";

        std::string output;
        int rc = runProcessHidden(cmd, output, 180000);
        if (rc != 0 || !fs::exists(finalMp3) || fs::file_size(finalMp3, ec) < 4096) {
            updateJob("failed", 0, "Tải/Convert MP3 thất bại (mã " + std::to_string(rc) + ")");
            return;
        }

        updateJob("converting", 85, "Đang đồng bộ kho nhạc offline...");
        fs::copy_file(finalMp3, webMp3, fs::copy_options::overwrite_existing, ec);

        int finalTrackId = existingTrackId;
        if (finalTrackId > 0) {
            upgradeTrackToLocal(db, finalTrackId, relPath);
        } else {
            finalTrackId = insertTrack(
                db,
                title,
                artist,
                genre,
                durationSec,
                relPath,
                192,
                coverImage,
                "local",
                "https://www.youtube.com/watch?v=" + videoId,
                videoId
            );
        }

        updateJob("completed", 100, "Đã lưu Offline MP3 thành công!", finalTrackId, relPath);
    }).detach();

    return jobId;
}

static bool serveLocalAudioFile(const fs::path& filePath, const httplib::Request& req, httplib::Response& res) {
    std::error_code ec;
    if (!fs::exists(filePath, ec) || !fs::is_regular_file(filePath, ec)) {
        return false;
    }
    auto fileSize = static_cast<long long>(fs::file_size(filePath, ec));
    if (fileSize <= 0) return false;

    std::string ext = filePath.extension().string();
    std::string mime = "audio/mpeg";
    if (ext == ".m4a") mime = "audio/mp4";
    else if (ext == ".wav") mime = "audio/wav";
    else if (ext == ".ogg") mime = "audio/ogg";
    else if (ext == ".flac") mime = "audio/flac";

    long long start = 0;
    long long end = fileSize - 1;
    bool isRange = false;

    std::string rangeHdr = req.get_header_value("Range");
    if (rangeHdr.rfind("bytes=", 0) == 0) {
        std::string spec = rangeHdr.substr(6);
        size_t dash = spec.find('-');
        if (dash != std::string::npos) {
            isRange = true;
            std::string s1 = spec.substr(0, dash);
            std::string s2 = spec.substr(dash + 1);
            try {
                if (!s1.empty()) start = std::stoll(s1);
                if (!s2.empty()) end = std::stoll(s2);
            } catch (...) {}
            if (start < 0) start = 0;
            if (end >= fileSize) end = fileSize - 1;
            if (start > end) {
                res.status = 416;
                return true;
            }
        }
    }

    long long len = end - start + 1;
    std::ifstream ifs(filePath, std::ios::binary);
    if (!ifs) return false;
    ifs.seekg(start);

    std::string data(static_cast<size_t>(len), '\0');
    ifs.read(data.data(), len);
    data.resize(static_cast<size_t>(ifs.gcount()));

    res.set_header("Accept-Ranges", "bytes");
    if (isRange) {
        res.status = 206;
        res.set_header("Content-Range", "bytes " + std::to_string(start) + "-" + std::to_string(start + static_cast<long long>(data.size()) - 1) + "/" + std::to_string(fileSize));
    } else {
        res.status = 200;
    }
    res.set_content(std::move(data), mime);
    return true;
}

} // namespace

void preResolveNextYoutubeTrack(sqlite3* db) {
    if (!db) return;
    std::string nextYtId;
    {
        std::lock_guard<std::mutex> lk(s_dbMtx);
        sqlite3_stmt* stmt = nullptr;
        const char* sql =
            "SELECT COALESCE(t.yt_video_id, '') FROM media_jukebox_queue q "
            "JOIN media_tracks t ON q.track_id = t.id "
            "WHERE q.status = 'pending' AND t.source_type = 'youtube' AND COALESCE(t.yt_video_id, '') != '' "
            "ORDER BY q.votes DESC, q.id ASC LIMIT 1;";
        if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) == SQLITE_OK) {
            if (sqlite3_step(stmt) == SQLITE_ROW) {
                const unsigned char* txt = sqlite3_column_text(stmt, 0);
                if (txt) nextYtId = reinterpret_cast<const char*>(txt);
            }
            sqlite3_finalize(stmt);
        }
    }
    if (nextYtId.empty()) return;

    {
        std::lock_guard<std::mutex> lk(s_cacheMtx);
        auto it = s_ytCache.find(nextYtId);
        if (it != s_ytCache.end() && std::chrono::steady_clock::now() < it->second.expiresAt) {
            return;
        }
    }

    std::thread([nextYtId]() {
        YtStreamCacheEntry dummy;
        std::string err;
        resolveYoutubeStreamUrl(nextYtId, dummy, err, false);
    }).detach();
}

void registerYoutubeAudioRoutes(httplib::Server& svr, sqlite3* db) {
    // 1. Preview YouTube video metadata (Audio only)
    svr.Post("/api/media/youtube/preview", [](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = json::parse(req.body);
            std::string url = body.value("url", "");
            std::string videoId = extractYtVideoId(url);
            if (videoId.empty()) {
                res.status = 400;
                res.set_content("{\"success\":false,\"message\":\"Link YouTube không hợp lệ\"}", "application/json; charset=utf-8");
                return;
            }

            json meta;
            std::string err;
            if (!fetchYoutubeMeta(videoId, meta, err)) {
                res.status = 500;
                res.set_content(json({{"success", false}, {"message", err}}).dump(), "application/json; charset=utf-8");
                return;
            }

            std::string title = sanitizeText(meta.value("title", "YouTube Audio"));
            std::string artist = sanitizeText(meta.value("artist", meta.value("uploader", meta.value("channel", "YouTube"))));
            int duration = meta.value("duration", 180);
            std::string thumb = meta.value("thumbnail", "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg");

            // Cache stream url immediately so subsequent add/play is instant
            std::string streamUrl = meta.value("url", "");
            if (!streamUrl.empty()) {
                std::lock_guard<std::mutex> lk(s_cacheMtx);
                YtStreamCacheEntry entry;
                entry.streamUrl = streamUrl;
                entry.mimeType = mimeFromExt(meta.value("ext", "m4a"));
                if (meta.contains("filesize") && meta["filesize"].is_number_integer()) {
                    entry.contentLength = meta["filesize"].get<long long>();
                }
                entry.expiresAt = std::chrono::steady_clock::now() + std::chrono::hours(3);
                s_ytCache[videoId] = entry;
            }

            res.set_content(json({
                {"success", true},
                {"video_id", videoId},
                {"title", title},
                {"artist", artist},
                {"duration_sec", duration},
                {"thumbnail", thumb}
            }).dump(), "application/json; charset=utf-8");
        } catch (...) {
            res.status = 400;
            res.set_content("{\"success\":false,\"message\":\"Payload không hợp lệ\"}", "application/json; charset=utf-8");
        }
    });

    // 2. Add YouTube Audio to library (mode: hybrid | stream | offline)
    svr.Post("/api/media/youtube/add", [db](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = json::parse(req.body);
            std::string url = body.value("url", "");
            std::string mode = body.value("mode", "hybrid");
            std::string videoId = extractYtVideoId(url);
            if (videoId.empty()) {
                res.status = 400;
                res.set_content("{\"success\":false,\"message\":\"Link YouTube không hợp lệ\"}", "application/json; charset=utf-8");
                return;
            }

            int existingId = findTrackByYtId(db, videoId);
            if (existingId > 0) {
                res.set_content(json({
                    {"success", true},
                    {"already_exists", true},
                    {"track_id", existingId},
                    {"message", "Bài hát YouTube này đã có trong kho nhạc (#" + std::to_string(existingId) + ")"}
                }).dump(), "application/json; charset=utf-8");
                return;
            }

            std::string title = sanitizeText(body.value("title", ""));
            std::string artist = sanitizeText(body.value("artist", ""));
            std::string genre = sanitizeText(body.value("genre", "YouTube"));
            int durationSec = body.value("duration_sec", 0);
            std::string cover = body.value("thumbnail", "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg");

            if (title.empty() || durationSec <= 0) {
                json meta;
                std::string err;
                if (!fetchYoutubeMeta(videoId, meta, err)) {
                    res.status = 500;
                    res.set_content(json({{"success", false}, {"message", err}}).dump(), "application/json; charset=utf-8");
                    return;
                }
                if (title.empty()) title = sanitizeText(meta.value("title", "YouTube Audio"));
                if (artist.empty()) artist = sanitizeText(meta.value("artist", meta.value("uploader", "YouTube")));
                if (durationSec <= 0) durationSec = meta.value("duration", 180);
                if (cover.empty()) cover = meta.value("thumbnail", "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg");

                std::string streamUrl = meta.value("url", "");
                if (!streamUrl.empty()) {
                    std::lock_guard<std::mutex> lk(s_cacheMtx);
                    YtStreamCacheEntry entry;
                    entry.streamUrl = streamUrl;
                    entry.mimeType = mimeFromExt(meta.value("ext", "m4a"));
                    entry.expiresAt = std::chrono::steady_clock::now() + std::chrono::hours(3);
                    s_ytCache[videoId] = entry;
                }
            }
            if (artist.empty()) artist = "YouTube";

            std::string canonicalUrl = "https://www.youtube.com/watch?v=" + videoId;

            if (mode == "stream") {
                int newId = insertTrack(db, title, artist, genre, durationSec, "", 128, cover, "youtube", canonicalUrl, videoId);
                res.set_content(json({
                    {"success", newId > 0},
                    {"track_id", newId},
                    {"mode", "stream"},
                    {"message", "Đã thêm bài hát (YouTube Stream) vào kho nhạc!"}
                }).dump(), "application/json; charset=utf-8");
                return;
            }

            if (mode == "offline") {
                std::string jobId = startOfflineDownloadJob(db, 0, videoId, title, artist, genre, durationSec, cover);
                res.set_content(json({
                    {"success", true},
                    {"mode", "offline"},
                    {"job_id", jobId},
                    {"message", "Đang tải và chuyển đổi sang MP3 offline..."}
                }).dump(), "application/json; charset=utf-8");
                return;
            }

            // Default: hybrid (insert as stream right away + download MP3 in background)
            int newId = insertTrack(db, title, artist, genre, durationSec, "", 128, cover, "youtube", canonicalUrl, videoId);
            std::string jobId = startOfflineDownloadJob(db, newId, videoId, title, artist, genre, durationSec, cover);
            res.set_content(json({
                {"success", newId > 0},
                {"track_id", newId},
                {"mode", "hybrid"},
                {"job_id", jobId},
                {"message", "Đã thêm vào kho (phát ngay được) & đang tải MP3 offline ở nền!"}
            }).dump(), "application/json; charset=utf-8");
        } catch (...) {
            res.status = 400;
            res.set_content("{\"success\":false,\"message\":\"Dữ liệu không hợp lệ\"}", "application/json; charset=utf-8");
        }
    });

    // 3. Upgrade existing YouTube stream track to Offline MP3
    svr.Post("/api/media/youtube/download-offline", [db](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = json::parse(req.body);
            int trackId = body.value("track_id", 0);
            if (trackId <= 0) {
                res.status = 400;
                res.set_content("{\"success\":false,\"message\":\"Thiếu track_id\"}", "application/json; charset=utf-8");
                return;
            }

            std::string srcType, filePath, ytId, srcUrl;
            if (!queryTrackById(db, trackId, srcType, filePath, ytId, srcUrl)) {
                res.status = 404;
                res.set_content("{\"success\":false,\"message\":\"Không tìm thấy bài hát\"}", "application/json; charset=utf-8");
                return;
            }
            if (srcType == "local" && filePath.find("assets/media/") != std::string::npos) {
                res.set_content("{\"success\":true,\"already_local\":true,\"message\":\"Bài hát đã được lưu Offline\"}", "application/json; charset=utf-8");
                return;
            }
            if (ytId.empty()) ytId = extractYtVideoId(srcUrl);
            if (ytId.empty()) {
                res.status = 400;
                res.set_content("{\"success\":false,\"message\":\"Bài hát không có YouTube Video ID\"}", "application/json; charset=utf-8");
                return;
            }

            std::string jobId = startOfflineDownloadJob(db, trackId, ytId, "", "", "YouTube", 180, "");
            res.set_content(json({
                {"success", true},
                {"track_id", trackId},
                {"job_id", jobId},
                {"message", "Đang tải về MP3 Offline..."}
            }).dump(), "application/json; charset=utf-8");
        } catch (...) {
            res.status = 400;
            res.set_content("{\"success\":false,\"message\":\"Yêu cầu không hợp lệ\"}", "application/json; charset=utf-8");
        }
    });

    // 4. Check background download job status
    svr.Get("/api/media/youtube/job-status", [](const httplib::Request& req, httplib::Response& res) {
        std::string jobId = req.get_param_value("job_id");
        std::lock_guard<std::mutex> lk(s_jobsMtx);
        if (!jobId.empty()) {
            auto it = s_jobs.find(jobId);
            if (it == s_jobs.end()) {
                res.status = 404;
                res.set_content("{\"success\":false,\"message\":\"Không tìm thấy job\"}", "application/json; charset=utf-8");
                return;
            }
            const auto& j = it->second;
            res.set_content(json({
                {"success", true},
                {"job", {
                    {"job_id", j.jobId},
                    {"track_id", j.trackId},
                    {"video_id", j.videoId},
                    {"status", j.status},
                    {"progress", j.progress},
                    {"message", j.message},
                    {"file_path", j.filePath}
                }}
            }).dump(), "application/json; charset=utf-8");
            return;
        }

        json arr = json::array();
        for (const auto& [k, j] : s_jobs) {
            arr.push_back({
                {"job_id", j.jobId},
                {"track_id", j.trackId},
                {"video_id", j.videoId},
                {"title", j.title},
                {"status", j.status},
                {"progress", j.progress},
                {"message", j.message},
                {"file_path", j.filePath}
            });
        }
        res.set_content(json({{"success", true}, {"jobs", arr}}).dump(), "application/json; charset=utf-8");
    });

    // 5. Self-update yt-dlp.exe
    svr.Post("/api/media/youtube/update-ytdlp", [](const httplib::Request&, httplib::Response& res) {
        fs::path ytdlp = getToolsDir() / "yt-dlp.exe";
        if (!fs::exists(ytdlp)) {
            res.status = 404;
            res.set_content("{\"success\":false,\"message\":\"Không tìm thấy yt-dlp.exe\"}", "application/json; charset=utf-8");
            return;
        }
        std::string cmd = "\"" + ytdlp.string() + "\" -U";
        std::string out;
        int rc = runProcessHidden(cmd, out, 60000);
        res.set_content(json({
            {"success", rc == 0},
            {"exit_code", rc},
            {"output", out},
            {"message", rc == 0 ? "Cập nhật yt-dlp hoàn tất" : "Cập nhật yt-dlp thất bại"}
        }).dump(), "application/json; charset=utf-8");
    });

    // 6. Proxy stream audio bytes from YouTube CDN (or serve local MP3 if upgraded)
    svr.Get("/api/media/stream-yt", [db](const httplib::Request& req, httplib::Response& res) {
        std::string idStr = req.get_param_value("id");
        int trackId = 0;
        try { trackId = std::stoi(idStr); } catch (...) {}
        if (trackId <= 0) {
            res.status = 400;
            res.set_content("{\"success\":false,\"message\":\"Missing track id\"}", "application/json; charset=utf-8");
            return;
        }

        std::string srcType, filePath, ytId, srcUrl;
        if (!queryTrackById(db, trackId, srcType, filePath, ytId, srcUrl)) {
            res.status = 404;
            res.set_content("{\"success\":false,\"message\":\"Track not found\"}", "application/json; charset=utf-8");
            return;
        }

        // If hybrid download finished and upgraded track to local file, serve local file directly
        if (srcType == "local" && !filePath.empty() && filePath.rfind("/api/", 0) != 0) {
            fs::path localPath = getExeDir() / filePath;
            if (!fs::exists(localPath)) {
                localPath = getExeDir() / "web" / filePath;
            }
            if (serveLocalAudioFile(localPath, req, res)) {
                return;
            }
        }

        if (ytId.empty()) ytId = extractYtVideoId(srcUrl);
        if (ytId.empty()) {
            res.status = 400;
            res.set_content("{\"success\":false,\"message\":\"No YouTube video id\"}", "application/json; charset=utf-8");
            return;
        }

#ifdef _WIN32
        std::string rangeHdr = req.get_header_value("Range");
        YtStreamCacheEntry entry;
        std::string err;
        if (!resolveYoutubeStreamUrl(ytId, entry, err, false)) {
            res.status = 502;
            res.set_content(json({{"success", false}, {"message", err}}).dump(), "application/json; charset=utf-8");
            return;
        }

        std::shared_ptr<WinHttpHandles> handles;
        int status = 0;
        long long contentLen = -1;
        std::string contentType, contentRange;
        bool ok = openWinHttpStream(entry.streamUrl, rangeHdr, handles, status, contentLen, contentType, contentRange);

        // Retry once if cached signed CDN URL expired (403/410)
        if (!ok || status == 403 || status == 410) {
            if (resolveYoutubeStreamUrl(ytId, entry, err, true)) {
                handles.reset();
                ok = openWinHttpStream(entry.streamUrl, rangeHdr, handles, status, contentLen, contentType, contentRange);
            }
        }

        if (!ok || !handles || (status != 200 && status != 206)) {
            res.status = 502;
            res.set_content("{\"success\":false,\"message\":\"Upstream YouTube stream error\"}", "application/json; charset=utf-8");
            return;
        }

        if (contentType.empty()) contentType = entry.mimeType;
        res.status = status;
        res.set_header("Accept-Ranges", "bytes");
        res.set_header("Cache-Control", "no-store");
        if (!contentRange.empty()) {
            res.set_header("Content-Range", contentRange);
        }

        if (contentLen > 0) {
            res.set_content_provider(
                static_cast<size_t>(contentLen),
                contentType,
                [handles](size_t /*offset*/, size_t length, httplib::DataSink& sink) -> bool {
                    char buf[32768];
                    size_t toRead = std::min(length, sizeof(buf));
                    DWORD bytesRead = 0;
                    if (!WinHttpReadData(handles->hRequest, buf, static_cast<DWORD>(toRead), &bytesRead)) {
                        return false;
                    }
                    if (bytesRead == 0) {
                        sink.done();
                        return true;
                    }
                    return sink.write(buf, bytesRead);
                },
                [handles](bool /*success*/) mutable {
                    handles.reset();
                }
            );
        } else {
            res.set_chunked_content_provider(
                contentType,
                [handles](size_t /*offset*/, httplib::DataSink& sink) -> bool {
                    char buf[32768];
                    DWORD bytesRead = 0;
                    if (!WinHttpReadData(handles->hRequest, buf, sizeof(buf), &bytesRead)) {
                        return false;
                    }
                    if (bytesRead == 0) {
                        sink.done();
                        return true;
                    }
                    return sink.write(buf, bytesRead);
                },
                [handles](bool /*success*/) mutable {
                    handles.reset();
                }
            );
        }
#else
        res.status = 501;
        res.set_content("{\"success\":false,\"message\":\"Not supported on this OS\"}", "application/json; charset=utf-8");
#endif
    });
}
