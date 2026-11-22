#pragma once

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <random>
#include <sstream>
#include <string>
#include <vector>

namespace SaleApp::Security {

enum class UploadKind {
    Image,
    Video,
    Audio,
    Document,
    MediaImageOrVideo
};

struct ValidatedUpload {
    bool ok = false;
    std::string ext;
    std::string mime;
    std::string error;
    bool isVideo = false;
};

class UploadGuard {
public:
    static constexpr size_t MAX_IMAGE_BYTES    = 10ULL * 1024ULL * 1024ULL;   // 10 MB
    static constexpr size_t MAX_DOC_BYTES      = 15ULL * 1024ULL * 1024ULL;   // 15 MB
    static constexpr size_t MAX_AUDIO_BYTES    = 30ULL * 1024ULL * 1024ULL;   // 30 MB
    static constexpr size_t MAX_VIDEO_BYTES    = 100ULL * 1024ULL * 1024ULL;  // 100 MB

    static std::string extractLowerExt(const std::string& filename) {
        size_t slash = filename.find_last_of("/\\");
        std::string base = (slash == std::string::npos) ? filename : filename.substr(slash + 1);
        size_t dot = base.find_last_of('.');
        if (dot == std::string::npos) return "";
        std::string ext = base.substr(dot);
        std::transform(ext.begin(), ext.end(), ext.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
        return ext;
    }

    static bool isBlacklistedExt(const std::string& ext) {
        static const char* kBanned[] = {
            ".svg", ".svgz", ".html", ".htm", ".xhtml", ".js", ".mjs", ".cjs",
            ".php", ".phtml", ".asp", ".aspx", ".jsp", ".exe", ".dll", ".so",
            ".bat", ".cmd", ".ps1", ".vbs", ".wsf", ".scr", ".com", ".msi", ".sh"
        };
        for (const char* b : kBanned) {
            if (ext == b) return true;
        }
        return false;
    }

    static bool looksLikeScriptOrHtml(const std::string& bytes) {
        size_t n = std::min<size_t>(bytes.size(), 512);
        std::string head = bytes.substr(0, n);
        std::transform(head.begin(), head.end(), head.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
        return head.find("<svg") != std::string::npos ||
               head.find("<script") != std::string::npos ||
               head.find("<!doctype html") != std::string::npos ||
               head.find("<html") != std::string::npos ||
               head.find("<?php") != std::string::npos;
    }

    static bool sniffMagic(const std::string& bytes, std::string& extOut, std::string& mimeOut, bool& isVideoOut) {
        isVideoOut = false;
        const size_t n = bytes.size();
        auto u = [&](size_t i) -> unsigned char { return static_cast<unsigned char>(bytes[i]); };

        if (n >= 2 && u(0) == 'M' && u(1) == 'Z') return false; // PE/EXE/DLL hard block

        // JPEG: FF D8 FF
        if (n >= 3 && u(0) == 0xFF && u(1) == 0xD8 && u(2) == 0xFF) {
            extOut = ".jpg"; mimeOut = "image/jpeg"; return true;
        }
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (n >= 8 && u(0) == 0x89 && u(1) == 0x50 && u(2) == 0x4E && u(3) == 0x47 &&
            u(4) == 0x0D && u(5) == 0x0A && u(6) == 0x1A && u(7) == 0x0A) {
            extOut = ".png"; mimeOut = "image/png"; return true;
        }
        // WEBP: RIFF....WEBP
        if (n >= 12 && bytes.compare(0, 4, "RIFF") == 0 && bytes.compare(8, 4, "WEBP") == 0) {
            extOut = ".webp"; mimeOut = "image/webp"; return true;
        }
        // GIF: GIF87a / GIF89a
        if (n >= 6 && (bytes.compare(0, 6, "GIF87a") == 0 || bytes.compare(0, 6, "GIF89a") == 0)) {
            extOut = ".gif"; mimeOut = "image/gif"; return true;
        }
        // PDF: %PDF-
        if (n >= 5 && bytes.compare(0, 5, "%PDF-") == 0) {
            extOut = ".pdf"; mimeOut = "application/pdf"; return true;
        }
        // DOCX / ZIP container: PK\x03\x04
        if (n >= 4 && u(0) == 0x50 && u(1) == 0x4B && u(2) == 0x03 && u(3) == 0x04) {
            extOut = ".docx"; mimeOut = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; return true;
        }
        // MP4: ....ftyp
        if (n >= 12 && bytes.compare(4, 4, "ftyp") == 0) {
            extOut = ".mp4"; mimeOut = "video/mp4"; isVideoOut = true; return true;
        }
        // WebM (EBML): 1A 45 DF A3
        if (n >= 4 && u(0) == 0x1A && u(1) == 0x45 && u(2) == 0xDF && u(3) == 0xA3) {
            extOut = ".webm"; mimeOut = "video/webm"; isVideoOut = true; return true;
        }
        // WAV: RIFF....WAVE
        if (n >= 12 && bytes.compare(0, 4, "RIFF") == 0 && bytes.compare(8, 4, "WAVE") == 0) {
            extOut = ".wav"; mimeOut = "audio/wav"; return true;
        }
        // FLAC: fLaC
        if (n >= 4 && bytes.compare(0, 4, "fLaC") == 0) {
            extOut = ".flac"; mimeOut = "audio/flac"; return true;
        }
        // OGG: OggS
        if (n >= 4 && bytes.compare(0, 4, "OggS") == 0) {
            extOut = ".ogg"; mimeOut = "audio/ogg"; return true;
        }
        // MP3: ID3 tag or MPEG sync frame (FF FB / FF F3 / FF F2 / FF FA / FF E3)
        if ((n >= 3 && bytes.compare(0, 3, "ID3") == 0) ||
            (n >= 2 && u(0) == 0xFF && (u(1) & 0xE0) == 0xE0)) {
            extOut = ".mp3"; mimeOut = "audio/mpeg"; return true;
        }
        return false;
    }

    static ValidatedUpload validate(const std::string& rawBytes,
                                    const std::string& originalFilename,
                                    UploadKind kind) {
        ValidatedUpload res;
        if (rawBytes.empty()) {
            res.error = "Dữ liệu tệp tin rỗng!";
            return res;
        }
        std::string reqExt = extractLowerExt(originalFilename);
        if (isBlacklistedExt(reqExt)) {
            res.error = "Từ chối loại tệp nguy hiểm (" + reqExt + ")!";
            return res;
        }
        if (looksLikeScriptOrHtml(rawBytes)) {
            res.error = "Phát hiện nội dung HTML/SVG/Script trong tệp tải lên!";
            return res;
        }

        std::string mExt, mMime;
        bool mVid = false;
        bool hasMagic = sniffMagic(rawBytes, mExt, mMime, mVid);

        if (kind == UploadKind::Image) {
            if (!hasMagic || (mExt != ".jpg" && mExt != ".png" && mExt != ".webp" && mExt != ".gif")) {
                res.error = "Tệp ảnh không hợp lệ (chỉ chấp nhận JPEG, PNG, WebP chuẩn Magic Bytes)!";
                return res;
            }
            if (!reqExt.empty() && reqExt != ".jpg" && reqExt != ".jpeg" && reqExt != ".png" && reqExt != ".webp" && reqExt != ".gif") {
                res.error = "Phần mở rộng ảnh không được phép (" + reqExt + ")!";
                return res;
            }
            if (rawBytes.size() > MAX_IMAGE_BYTES) {
                res.error = "Ảnh vượt quá giới hạn tối đa 10MB!";
                return res;
            }
            res.ok = true; res.ext = mExt; res.mime = mMime; return res;
        }

        if (kind == UploadKind::Video || kind == UploadKind::MediaImageOrVideo) {
            bool okImg = (mExt == ".jpg" || mExt == ".png" || mExt == ".webp");
            bool okVid = (mExt == ".mp4" || mExt == ".webm");
            if (!hasMagic || (kind == UploadKind::Video ? !okVid : (!okImg && !okVid))) {
                res.error = "Định dạng media không hợp lệ (chỉ cho phép JPG/PNG/WebP/MP4/WebM theo Magic Bytes)!";
                return res;
            }
            size_t limit = okVid ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
            if (rawBytes.size() > limit) {
                res.error = okVid ? "Video vượt quá giới hạn 100MB!" : "Ảnh vượt quá giới hạn 10MB!";
                return res;
            }
            res.ok = true; res.ext = mExt; res.mime = mMime; res.isVideo = okVid; return res;
        }

        if (kind == UploadKind::Audio) {
            if (!hasMagic || (mExt != ".mp3" && mExt != ".wav" && mExt != ".flac" && mExt != ".ogg")) {
                res.error = "File nhạc không đúng chữ ký Magic Bytes (chỉ cho phép MP3/WAV/FLAC/OGG)!";
                return res;
            }
            if (!reqExt.empty() && reqExt != ".mp3" && reqExt != ".wav" && reqExt != ".flac" && reqExt != ".ogg") {
                res.error = "Phần mở rộng âm thanh không hợp lệ (" + reqExt + ")!";
                return res;
            }
            if (rawBytes.size() > MAX_AUDIO_BYTES) {
                res.error = "Tệp nhạc vượt quá giới hạn 30MB!";
                return res;
            }
            res.ok = true; res.ext = mExt; res.mime = mMime; return res;
        }

        // Document: PDF, DOCX (ZIP with .docx ext), JPG, PNG, TXT (printable UTF-8 text without script tags)
        if (rawBytes.size() > MAX_DOC_BYTES) {
            res.error = "Hồ sơ vượt quá giới hạn 15MB!";
            return res;
        }
        if (hasMagic) {
            if (mExt == ".pdf" || mExt == ".jpg" || mExt == ".png") {
                res.ok = true; res.ext = mExt; res.mime = mMime; return res;
            }
            if (mExt == ".docx" && reqExt == ".docx") {
                res.ok = true; res.ext = ".docx"; res.mime = mMime; return res;
            }
        }
        if (reqExt == ".txt") {
            bool hasNull = (rawBytes.find('\0') != std::string::npos);
            if (!hasNull) {
                res.ok = true; res.ext = ".txt"; res.mime = "text/plain"; return res;
            }
        }
        res.error = "Tệp hồ sơ không hợp lệ (chỉ chấp nhận PDF, DOCX, PNG, JPG, TXT an toàn)!";
        return res;
    }

    static std::string makeRandomUuidName(const std::string& prefix, const std::string& ext) {
        static const char HEX[] = "0123456789abcdef";
        std::random_device rd;
        std::mt19937_64 gen(rd());
        std::uniform_int_distribution<int> dis(0, 15);
        std::string rnd;
        rnd.reserve(24);
        for (int i = 0; i < 24; ++i) rnd += HEX[dis(gen)];
        std::string safePre;
        for (char c : prefix) {
            if (std::isalnum(static_cast<unsigned char>(c)) || c == '_' || c == '-') safePre += c;
        }
        if (safePre.empty()) safePre = "file";
        std::string cleanExt = ext;
        if (!cleanExt.empty() && cleanExt[0] != '.') cleanExt = "." + cleanExt;
        return safePre + "_" + rnd + cleanExt;
    }

    static bool isPathContainedInDir(const std::filesystem::path& baseDir, const std::filesystem::path& candidatePath) {
        namespace fs = std::filesystem;
        std::error_code ec;
        fs::path baseCan = fs::weakly_canonical(baseDir, ec);
        if (ec) return false;
        fs::path candCan = fs::weakly_canonical(candidatePath, ec);
        if (ec) return false;
        auto bIt = baseCan.begin();
        auto cIt = candCan.begin();
        for (; bIt != baseCan.end(); ++bIt, ++cIt) {
            if (cIt == candCan.end() || *bIt != *cIt) return false;
        }
        return true;
    }

    static bool writeSafeFile(const std::filesystem::path& targetDir,
                              const std::string& safeFilename,
                              const std::string& bytes,
                              std::filesystem::path& fullPathOut,
                              std::string& errOut) {
        namespace fs = std::filesystem;
        if (safeFilename.find("..") != std::string::npos ||
            safeFilename.find('/') != std::string::npos ||
            safeFilename.find('\\') != std::string::npos) {
            errOut = "Tên tệp chứa ký tự điều hướng thư mục không hợp lệ!";
            return false;
        }
        std::error_code ec;
        fs::create_directories(targetDir, ec);
        fullPathOut = targetDir / safeFilename;
        if (!isPathContainedInDir(targetDir, fullPathOut)) {
            errOut = "Phát hiện Path Traversal vượt ra ngoài thư mục lưu trữ!";
            return false;
        }
        std::ofstream ofs(fullPathOut, std::ios::binary);
        if (!ofs) {
            errOut = "Không thể ghi tệp tin lên máy chủ!";
            return false;
        }
        ofs.write(bytes.data(), bytes.size());
        ofs.close();
        return ofs.good();
    }
};

} // namespace SaleApp::Security
