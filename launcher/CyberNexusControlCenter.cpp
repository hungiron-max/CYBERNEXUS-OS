#ifdef _WIN32

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shellapi.h>
#include <iphlpapi.h>
#include <psapi.h>

#include "httplib.h"
#include "nlohmann/json.hpp"
#include "auth.hpp"
#include "license_crypto.hpp"
#include "pos_bcrypt.h"
#include "embedded_favicons.hpp"
#include "sqlite3.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <deque>
#include <filesystem>
#include <fstream>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace fs = std::filesystem;
using json = nlohmann::json;

namespace {

constexpr UINT WM_TRAYICON = WM_APP + 1;
constexpr UINT ID_TRAY_OPEN = 1001;
constexpr UINT ID_TRAY_START_ALL = 1002;
constexpr UINT ID_TRAY_STOP_ALL = 1003;
constexpr UINT ID_TRAY_QUIT = 1004;
constexpr int CONTROL_PORT = 8599;

struct LogLine {
    std::string ts;
    std::string service;
    std::string level;
    std::string text;
};

struct ServiceState {
    std::string id;       // "master" or "slave"
    std::string name;
    int port = 0;
    fs::path exePath;
    fs::path workDir;
    bool available = false;
    bool running = false;
    DWORD pid = 0;
    HANDLE hProcess = nullptr;
    HANDLE hReadPipe = nullptr;
    std::chrono::steady_clock::time_point startedAt;
};

std::mutex g_mtx;
std::deque<LogLine> g_logs;
ServiceState g_master{"master", "CyberNexus Master SaaS", 8500};
ServiceState g_slave{"slave", "CyberNexus Slave Store", 8501};
std::atomic<bool> g_running{true};
HWND g_hwnd = nullptr;
NOTIFYICONDATAW g_nid{};
httplib::Server* g_svr = nullptr;

std::string nowTimeStr() {
    SYSTEMTIME st{};
    GetLocalTime(&st);
    char buf[16];
    std::snprintf(buf, sizeof(buf), "%02d:%02d:%02d", st.wHour, st.wMinute, st.wSecond);
    return std::string(buf);
}

std::string classifyLogLevel(const std::string& line) {
    if (line.find("[ERROR]") != std::string::npos || line.find("[DB Error]") != std::string::npos ||
        line.find("Failed") != std::string::npos || line.find("khong the") != std::string::npos) {
        return "ERROR";
    }
    if (line.find("[WARN]") != std::string::npos || line.find("Warning") != std::string::npos) {
        return "WARN";
    }
    return "INFO";
}

void pushLog(const std::string& svc, const std::string& rawLine, const std::string& forcedLevel = "") {
    std::string clean = rawLine;
    while (!clean.empty() && (clean.back() == '\r' || clean.back() == '\n')) clean.pop_back();
    if (clean.empty()) return;
    std::lock_guard<std::mutex> lk(g_mtx);
    std::string lvl = forcedLevel.empty() ? classifyLogLevel(clean) : forcedLevel;
    g_logs.push_back({nowTimeStr(), svc, lvl, clean});
    while (g_logs.size() > 600) g_logs.pop_front();
}

struct PortOwner {
    bool inUse = false;
    DWORD pid = 0;
    std::string processName;
};

std::string getProcessNameByPid(DWORD pid) {
    if (pid == 0) return "";
    HANDLE hProc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (!hProc) return "PID " + std::to_string(pid);
    char buf[MAX_PATH] = {0};
    DWORD sz = MAX_PATH;
    std::string out = "PID " + std::to_string(pid);
    if (QueryFullProcessImageNameA(hProc, 0, buf, &sz)) {
        out = fs::path(buf).filename().string();
    }
    CloseHandle(hProc);
    return out;
}

PortOwner inspectTcpPort(int targetPort) {
    PortOwner res{};
    DWORD size = 0;
    GetExtendedTcpTable(nullptr, &size, FALSE, AF_INET, TCP_TABLE_OWNER_PID_LISTENER, 0);
    if (size == 0) return res;
    std::vector<BYTE> buf(size);
    if (GetExtendedTcpTable(buf.data(), &size, FALSE, AF_INET, TCP_TABLE_OWNER_PID_LISTENER, 0) != NO_ERROR) {
        return res;
    }
    auto* tbl = reinterpret_cast<MIB_TCPTABLE_OWNER_PID*>(buf.data());
    for (DWORD i = 0; i < tbl->dwNumEntries; ++i) {
        int port = ntohs(static_cast<u_short>(tbl->table[i].dwLocalPort));
        if (port == targetPort) {
            res.inUse = true;
            res.pid = tbl->table[i].dwOwningPid;
            res.processName = getProcessNameByPid(res.pid);
            return res;
        }
    }
    return res;
}

bool killPid(DWORD pid) {
    if (pid == 0 || pid == GetCurrentProcessId()) return false;
    HANDLE hProc = OpenProcess(PROCESS_TERMINATE | SYNCHRONIZE, FALSE, pid);
    if (!hProc) return false;
    BOOL ok = TerminateProcess(hProc, 0);
    if (ok) WaitForSingleObject(hProc, 3000);
    CloseHandle(hProc);
    return ok == TRUE;
}

void pipeReaderThread(std::string svcId, HANDLE hRead, HANDLE hProc) {
    char buf[2048];
    std::string pending;
    DWORD bytesRead = 0;
    while (ReadFile(hRead, buf, sizeof(buf) - 1, &bytesRead, nullptr) && bytesRead > 0) {
        buf[bytesRead] = '\0';
        pending += buf;
        size_t pos = 0;
        while ((pos = pending.find('\n')) != std::string::npos) {
            pushLog(svcId, pending.substr(0, pos));
            pending.erase(0, pos + 1);
        }
    }
    if (!pending.empty()) pushLog(svcId, pending);
    CloseHandle(hRead);

    std::lock_guard<std::mutex> lk(g_mtx);
    ServiceState& s = (svcId == "master") ? g_master : g_slave;
    if (s.hProcess == hProc) {
        s.running = false;
        s.pid = 0;
        CloseHandle(s.hProcess);
        s.hProcess = nullptr;
        s.hReadPipe = nullptr;
    }
    g_logs.push_back({nowTimeStr(), svcId, "WARN", "Tiến trình " + s.name + " đã dừng."});
}

void refreshServiceStatus(ServiceState& s) {
    if (!s.available) return;
    if (s.hProcess) {
        DWORD code = 0;
        if (GetExitCodeProcess(s.hProcess, &code) && code == STILL_ACTIVE) {
            s.running = true;
            return;
        }
        CloseHandle(s.hProcess);
        s.hProcess = nullptr;
        s.running = false;
        s.pid = 0;
    }
    PortOwner po = inspectTcpPort(s.port);
    if (po.inUse && (po.processName.find("cybernexus") != std::string::npos)) {
        s.running = true;
        s.pid = po.pid;
    } else {
        s.running = false;
        s.pid = 0;
    }
}

bool startService(ServiceState& s, std::string& errOut) {
    std::lock_guard<std::mutex> lk(g_mtx);
    refreshServiceStatus(s);
    if (!s.available) {
        errOut = "Không tìm thấy file thực thi: " + s.exePath.string();
        return false;
    }
    if (s.running) return true;

    PortOwner po = inspectTcpPort(s.port);
    if (po.inUse) {
        errOut = "Port " + std::to_string(s.port) + " đang bị chiếm bởi " + po.processName + " (PID " + std::to_string(po.pid) + ")";
        return false;
    }

    SECURITY_ATTRIBUTES sa{};
    sa.nLength = sizeof(sa);
    sa.bInheritHandle = TRUE;
    HANDLE hRead = nullptr, hWrite = nullptr;
    if (!CreatePipe(&hRead, &hWrite, &sa, 0)) {
        errOut = "Không thể tạo Pipe đọc log.";
        return false;
    }
    SetHandleInformation(hRead, HANDLE_FLAG_INHERIT, 0);

    STARTUPINFOW si{};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
    si.hStdOutput = hWrite;
    si.hStdError = hWrite;
    si.wShowWindow = SW_HIDE;

    PROCESS_INFORMATION pi{};
    std::wstring cmd = L"\"" + s.exePath.wstring() + L"\"";
    std::wstring dir = s.workDir.wstring();
    BOOL ok = CreateProcessW(nullptr, cmd.data(), nullptr, nullptr, TRUE,
                             CREATE_NO_WINDOW, nullptr, dir.c_str(), &si, &pi);
    CloseHandle(hWrite);
    if (!ok) {
        CloseHandle(hRead);
        errOut = "CreateProcess thất bại (mã lỗi " + std::to_string(GetLastError()) + ")";
        return false;
    }
    CloseHandle(pi.hThread);
    s.hProcess = pi.hProcess;
    s.hReadPipe = hRead;
    s.pid = pi.dwProcessId;
    s.running = true;
    s.startedAt = std::chrono::steady_clock::now();

    std::thread(pipeReaderThread, s.id, hRead, pi.hProcess).detach();
    return true;
}

void stopService(ServiceState& s) {
    DWORD pidToKill = 0;
    HANDLE hProc = nullptr;
    {
        std::lock_guard<std::mutex> lk(g_mtx);
        refreshServiceStatus(s);
        pidToKill = s.pid;
        hProc = s.hProcess;
    }
    if (hProc) {
        TerminateProcess(hProc, 0);
        WaitForSingleObject(hProc, 3000);
    } else if (pidToKill > 0) {
        killPid(pidToKill);
    }
    std::lock_guard<std::mutex> lk(g_mtx);
    s.running = false;
    s.pid = 0;
    g_logs.push_back({nowTimeStr(), s.id, "INFO", "Đã dừng " + s.name + "."});
}

void discoverServices() {
    wchar_t exeBuf[MAX_PATH] = {0};
    GetModuleFileNameW(nullptr, exeBuf, MAX_PATH);
    fs::path baseDir = fs::path(exeBuf).parent_path();

    auto findExe = [&](const std::string& exeName, const std::string& subDir, ServiceState& st) {
        std::vector<fs::path> candidates = {
            baseDir / exeName,
            baseDir / subDir / exeName,
            baseDir.parent_path() / subDir / exeName
        };
        for (const auto& c : candidates) {
            if (fs::exists(c)) {
                st.exePath = fs::weakly_canonical(c);
                st.workDir = st.exePath.parent_path();
                st.available = true;
                return;
            }
        }
    };
    findExe("cybernexus_master.exe", "master", g_master);
    findExe("cybernexus_slave.exe", "slave", g_slave);
}

std::string sha256FileHex(const fs::path& p) {
    std::ifstream ifs(p, std::ios::binary);
    if (!ifs) return "";
    std::ostringstream ss;
    ss << ifs.rdbuf();
    return SaleApp::Backend::AuthService::sha256(ss.str());
}

json checkServiceIntegrity(const ServiceState& s) {
    json out = {{"service", s.id}, {"available", s.available}};
    if (!s.available) return out;

    // 1. Check DLL .sig manifests (Slave)
    json dllChecks = json::array();
    fs::path modDir = s.workDir / "modules";
    if (fs::exists(modDir)) {
        for (const auto& entry : fs::directory_iterator(modDir)) {
            if (entry.path().extension() == ".sig") {
                std::ifstream ifs(entry.path());
                json sig = json::parse(ifs, nullptr, false);
                std::string binName = sig.value("file", sig.value("binary", ""));
                std::string expHash = sig.value("sha256", "");
                std::string ecdsaSig = sig.value("ecdsa_sig", "");
                fs::path binPath = modDir / binName;
                std::string actHash = fs::exists(binPath) ? sha256FileHex(binPath) : "";
                bool hashOk = !expHash.empty() && expHash == actHash;
                bool sigOk = !ecdsaSig.empty() && SaleApp::LicenseCrypto::verifyLicensePayload(
                    SaleApp::LicenseCrypto::buildDllSigPayload(binName, actHash), ecdsaSig);
                bool ok = hashOk && sigOk;
                dllChecks.push_back({{"file", binName}, {"ok", ok}, {"hash_ok", hashOk}, {"ecdsa_ok", sigOk}});
            }
        }
    }
    out["dlls"] = dllChecks;

    // 2. Check web_integrity.json
    fs::path webDir = s.workDir / "web";
    fs::path manifestPath = webDir / "web_integrity.json";
    json webSummary = {{"has_manifest", false}, {"verified", 0}, {"modified", json::array()}, {"missing", json::array()}};
    if (fs::exists(manifestPath)) {
        std::ifstream ifs(manifestPath);
        json wm = json::parse(ifs, nullptr, false);
        if (wm.is_object() && wm.contains("files") && wm["files"].is_object()) {
            webSummary["has_manifest"] = true;
            int verified = 0;
            for (auto& [rel, expectedSha] : wm["files"].items()) {
                fs::path fp = webDir / fs::path(rel);
                if (!fs::exists(fp)) {
                    webSummary["missing"].push_back(rel);
                } else if (sha256FileHex(fp) != expectedSha.get<std::string>()) {
                    webSummary["modified"].push_back(rel);
                } else {
                    verified++;
                }
            }
            webSummary["verified"] = verified;
        }
    }
    out["web"] = webSummary;

    // 3. Check SQLite DB quick_check
    fs::path dbPath = s.workDir / "database" / (s.id == "master" ? "cybernexus_master.db" : "store_local.db");
    std::string dbStatus = "not_found";
    if (fs::exists(dbPath)) {
        sqlite3* db = nullptr;
        if (sqlite3_open_v2(dbPath.string().c_str(), &db, SQLITE_OPEN_READONLY, nullptr) == SQLITE_OK) {
            sqlite3_stmt* stmt = nullptr;
            if (sqlite3_prepare_v2(db, "PRAGMA quick_check;", -1, &stmt, nullptr) == SQLITE_OK) {
                if (sqlite3_step(stmt) == SQLITE_ROW) {
                    const unsigned char* txt = sqlite3_column_text(stmt, 0);
                    dbStatus = txt ? reinterpret_cast<const char*>(txt) : "error";
                }
                sqlite3_finalize(stmt);
            }
            sqlite3_close(db);
        } else {
            dbStatus = "open_failed";
        }
    }
    out["database"] = dbStatus;
    return out;
}

std::string buildControlCenterHtml();

static std::mutex g_ccAuthMtx;
static std::string g_ccToken;
static int g_ccFailCount = 0;
static std::time_t g_ccLockedUntil = 0;

void clearCcSession() {
    std::lock_guard<std::mutex> lk(g_ccAuthMtx);
    g_ccToken.clear();
}

bool requireCcAuth(const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> lk(g_ccAuthMtx);
    std::string tok = req.has_header("X-CC-Session") ? req.get_header_value("X-CC-Session") : "";
    if (!g_ccToken.empty() && tok == g_ccToken) return true;
    res.status = 401;
    res.set_content("{\"success\":false,\"locked\":true,\"message\":\"Phiên đã khóa. Vui lòng đăng nhập lại Control Center!\"}", "application/json; charset=utf-8");
    return false;
}

bool verifyCcCredential(const std::string& secret) {
    if (secret.empty()) return false;
    if (g_master.available) {
        fs::path dbPath = g_master.workDir / "database" / "cybernexus_master.db";
        if (!fs::exists(dbPath)) return false;
        sqlite3* db = nullptr;
        bool ok = false;
        if (sqlite3_open_v2(dbPath.string().c_str(), &db, SQLITE_OPEN_READONLY, nullptr) == SQLITE_OK) {
            sqlite3_stmt* st = nullptr;
            std::string storedHash;
            bool hasRow = false;
            if (sqlite3_prepare_v2(db, "SELECT setting_value FROM saas_settings WHERE setting_key='super_admin_password_hash' LIMIT 1", -1, &st, nullptr) == SQLITE_OK) {
                if (sqlite3_step(st) == SQLITE_ROW) {
                    hasRow = true;
                    const unsigned char* h = sqlite3_column_text(st, 0);
                    if (h && h[0]) storedHash = reinterpret_cast<const char*>(h);
                }
                sqlite3_finalize(st);
            }
            if (!storedHash.empty()) {
                ok = (pos_bcrypt_checkpw(secret.c_str(), storedHash.c_str()) == 0);
            } else if (!hasRow || storedHash.empty()) {
                ok = (secret == "superadmin");
            }
            sqlite3_close(db);
        }
        return ok;
    }
    if (g_slave.available) {
        fs::path dbPath = g_slave.workDir / "database" / "store_local.db";
        if (!fs::exists(dbPath)) return false;
        sqlite3* db = nullptr;
        bool ok = false;
        std::string sha = SaleApp::Backend::AuthService::sha256(secret);
        if (sqlite3_open_v2(dbPath.string().c_str(), &db, SQLITE_OPEN_READONLY, nullptr) == SQLITE_OK) {
            sqlite3_stmt* st = nullptr;
            if (sqlite3_prepare_v2(db, "SELECT pin_code, default_pin_sha256 FROM users WHERE role='admin' AND status='active'", -1, &st, nullptr) == SQLITE_OK) {
                while (sqlite3_step(st) == SQLITE_ROW) {
                    const unsigned char* p1 = sqlite3_column_text(st, 0);
                    const unsigned char* p2 = sqlite3_column_text(st, 1);
                    std::string pin = p1 ? reinterpret_cast<const char*>(p1) : "";
                    std::string dsha = p2 ? reinterpret_cast<const char*>(p2) : "";
                    if ((!pin.empty() && pin != "__USED_ONETIME__" && pin == secret) || (!dsha.empty() && dsha == sha)) {
                        ok = true;
                        break;
                    }
                }
                sqlite3_finalize(st);
            }
            sqlite3_close(db);
        }
        return ok;
    }
    return false;
}

void openControlCenterWindow() {
    clearCcSession();
    std::string url = "http://127.0.0.1:" + std::to_string(CONTROL_PORT) + "/";
    // Try Edge App Mode first for native Apple-like frameless window
    const char* edgePaths[] = {
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    };
    for (const char* ep : edgePaths) {
        if (fs::exists(ep)) {
            char localApp[MAX_PATH] = {0};
            GetEnvironmentVariableA("LOCALAPPDATA", localApp, MAX_PATH);
            std::string profileDir = std::string(localApp[0] ? localApp : "C:\\Temp") + "\\CyberNexusControlEdge";
            std::string args = "--app=" + url + " --window-size=1160,790 --disable-features=Translate --disable-translate --user-data-dir=\"" + profileDir + "\"";
            ShellExecuteA(nullptr, "open", ep, args.c_str(), nullptr, SW_SHOWNORMAL);
            return;
        }
    }
    ShellExecuteA(nullptr, "open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

LRESULT CALLBACK TrayWndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    if (msg == WM_TRAYICON) {
        if (lp == WM_LBUTTONDBLCLK) {
            openControlCenterWindow();
        } else if (lp == WM_RBUTTONUP) {
            POINT pt{};
            GetCursorPos(&pt);
            HMENU hMenu = CreatePopupMenu();
            AppendMenuW(hMenu, MF_STRING, ID_TRAY_OPEN, L"Mở CyberNexus Control Center");
            AppendMenuW(hMenu, MF_SEPARATOR, 0, nullptr);
            AppendMenuW(hMenu, MF_STRING, ID_TRAY_START_ALL, L"Khởi chạy Tất Cả");
            AppendMenuW(hMenu, MF_STRING, ID_TRAY_STOP_ALL, L"Dừng Tất Cả Dịch Vụ");
            AppendMenuW(hMenu, MF_SEPARATOR, 0, nullptr);
            AppendMenuW(hMenu, MF_STRING, ID_TRAY_QUIT, L"Thoát Hệ Thống (Quit All)");
            SetForegroundWindow(hwnd);
            TrackPopupMenu(hMenu, TPM_BOTTOMALIGN | TPM_LEFTALIGN, pt.x, pt.y, 0, hwnd, nullptr);
            DestroyMenu(hMenu);
        }
        return 0;
    }
    if (msg == WM_COMMAND) {
        UINT id = LOWORD(wp);
        if (id == ID_TRAY_OPEN) openControlCenterWindow();
        else if (id == ID_TRAY_START_ALL) {
            std::string e;
            if (g_master.available) startService(g_master, e);
            if (g_slave.available) startService(g_slave, e);
        } else if (id == ID_TRAY_STOP_ALL) {
            if (g_slave.available) stopService(g_slave);
            if (g_master.available) stopService(g_master);
        } else if (id == ID_TRAY_QUIT) {
            g_running = false;
            PostQuitMessage(0);
        }
        return 0;
    }
    if (msg == WM_DESTROY) {
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

std::string readCcExternalLocale(const std::string& lang) {
    if (lang != "vi" && lang != "en") return "{}";
    fs::path exeDir;
    wchar_t exeBuf[MAX_PATH]{};
    if (GetModuleFileNameW(nullptr, exeBuf, MAX_PATH) > 0) {
        exeDir = fs::path(exeBuf).parent_path();
    }
    std::vector<fs::path> candidates;
    if (!exeDir.empty()) {
        candidates.push_back(exeDir / "locales" / (lang + ".json"));
        candidates.push_back(exeDir / "web" / "locales" / (lang + ".json"));
    }
    if (g_slave.available && !g_slave.workDir.empty()) {
        candidates.push_back(g_slave.workDir / "locales" / (lang + ".json"));
        candidates.push_back(g_slave.workDir / "web" / "locales" / (lang + ".json"));
    }
    if (g_master.available && !g_master.workDir.empty()) {
        candidates.push_back(g_master.workDir / "locales" / (lang + ".json"));
        candidates.push_back(g_master.workDir / "web" / "locales" / (lang + ".json"));
    }
    for (const auto& p : candidates) {
        std::error_code ec;
        if (fs::exists(p, ec) && fs::is_regular_file(p, ec)) {
            std::ifstream ifs(p, std::ios::binary);
            if (ifs) {
                std::ostringstream ss;
                ss << ifs.rdbuf();
                return ss.str();
            }
        }
    }
    return "{}";
}

std::string buildControlCenterHtml() {
    return R"HTML(<!DOCTYPE html>
<html lang="vi" translate="no" class="notranslate">
<head>
<meta charset="UTF-8">
<meta name="google" content="notranslate">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CyberNexus OS — Control Center</title>
<link rel="icon" type="image/png" href="/favicon.png?v=20261118">
<link rel="icon" type="image/x-icon" href="/favicon.ico?v=20261118">
<style>
:root{color-scheme:dark;--bg:#0b0f19;--card:rgba(22,29,46,.78);--border:rgba(255,255,255,.09);--text:#f1f5f9;--muted:#94a3b8;--green:#10b981;--red:#ef4444;--amber:#f59e0b;--sky:#38bdf8;}
*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif}
body{margin:0;background:radial-gradient(circle at 15% 10%,#172554 0%,#0b0f19 52%,#05070d 100%);color:var(--text);min-height:100vh;padding:20px}
.wrap{max-width:1120px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 18px;border-radius:18px;background:var(--card);border:1px solid var(--border);backdrop-filter:blur(18px)}
.brand{display:flex;align-items:center;gap:12px;min-width:0}
.logo{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#38bdf8,#6366f1);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:17px;box-shadow:0 8px 20px rgba(56,189,248,.25);flex-shrink:0}
.title{font-size:16px;font-weight:700;letter-spacing:-.2px;white-space:nowrap}
.sub{font-size:12px;color:var(--muted)}
.toolbar{display:flex;gap:8px;flex-wrap:nowrap;align-items:center;flex-shrink:0}
@media(max-width:900px){.topbar{flex-wrap:wrap}.toolbar{flex-wrap:wrap}}
button{cursor:pointer;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);padding:8px 12px;border-radius:11px;font-size:12.5px;font-weight:600;transition:.16s;white-space:nowrap}
button:hover{background:rgba(255,255,255,.13);transform:translateY(-1px)}
.btn-primary{background:linear-gradient(135deg,#0ea5e9,#2563eb);border-color:transparent}
.btn-danger{background:rgba(239,68,68,.16);color:#fca5a5;border-color:rgba(239,68,68,.3)}
.btn-green{background:rgba(16,185,129,.18);color:#6ee7b7;border-color:rgba(16,185,129,.35)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:16px 18px;backdrop-filter:blur(18px);display:flex;flex-direction:column;gap:12px}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px}
.pill{padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.3px}
.pill.on{background:rgba(16,185,129,.18);color:#34d399;border:1px solid rgba(16,185,129,.35)}
.pill.off{background:rgba(148,163,184,.14);color:#94a3b8;border:1px solid rgba(148,163,184,.25)}
.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:rgba(0,0,0,.22);padding:10px;border-radius:12px;font-size:12px}
.meta span{color:var(--muted);display:block;font-size:10.5px}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.diag-box{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;font-size:12px}
.diag-item{background:rgba(0,0,0,.22);padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.05)}
.console{background:#050811;border:1px solid var(--border);border-radius:16px;padding:12px 14px;height:250px;overflow-y:auto;font-family:"Cascadia Code",Consolas,monospace;font-size:11.5px;line-height:1.55}
.log-INFO{color:#cbd5e1}.log-WARN{color:#fbbf24}.log-ERROR{color:#f87171}
.tag{display:inline-block;padding:0 5px;border-radius:4px;font-size:10px;margin-right:6px;background:rgba(255,255,255,.07)}
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <div class="brand">
      <div class="logo">CN</div>
      <div>
        <div class="title" data-i18n="cc.title">CyberNexus Control Center</div>
        <div class="sub" data-i18n="cc.subtitle">Quản trị Master &amp; Slave không CMD • Chạy ngầm System Tray</div>
      </div>
    </div>
    <div class="toolbar">
      <div style="display:inline-flex;gap:3px;padding:3px;border-radius:10px;background:rgba(15,23,42,.75);border:1px solid var(--border);">
        <button id="cc-lang-vi" type="button" onclick="setCcLang('vi')" style="padding:5px 8px;font-size:11px;border-radius:7px;border:none;background:#0ea5e9;color:#082f49;">VI</button>
        <button id="cc-lang-en" type="button" onclick="setCcLang('en')" style="padding:5px 8px;font-size:11px;border-radius:7px;border:none;background:transparent;color:#cbd5e1;">EN</button>
      </div>
      <button class="btn-green" onclick="act('/api/control/start-all')" data-i18n="cc.start_all">▶ Khởi chạy tất cả</button>
      <button onclick="runDiag()" data-i18n="cc.diag_btn">🛡 Kiểm tra Port &amp; Code</button>
      <button id="btn-check-updates" style="position:relative;" onclick="checkUpdates()"><span data-i18n="cc.check_updates">☁ Kiểm tra Update</span><span id="cc-upd-dot" style="display:none;position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:999px;background:#ef4444;border:2px solid #0b1120;box-shadow:0 0 8px #ef4444;"></span></button>
      <button class="btn-danger" onclick="quitAll()" data-i18n="cc.quit_all">⏻ Thoát Hệ Thống</button>
    </div>
  </div>

  <div id="cc-lock-overlay" style="position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(4,8,18,0.94);backdrop-filter:blur(14px);">
    <div style="width:100%;max-width:390px;border-radius:18px;border:1px solid rgba(56,189,248,0.35);background:linear-gradient(160deg,#0f172a,#090e1c);box-shadow:0 24px 60px rgba(0,0,0,0.7);padding:26px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div class="logo">CN</div>
        <div>
          <div id="cc-lock-title" style="font-size:15px;font-weight:800;color:#fff;" data-i18n="cc.unlock_title">Mở Khóa Control Center</div>
          <div id="cc-lock-sub" style="font-size:11.5px;color:#94a3b8;" data-i18n="cc.unlock_sub">Xác thực quyền quản trị để tiếp tục</div>
        </div>
      </div>
      <div id="cc-lock-hint" style="display:none;margin-bottom:12px;padding:9px 11px;border-radius:10px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);color:#6ee7b7;font-size:11.5px;line-height:1.45;"></div>
      <form onsubmit="submitCcLogin(event)" style="display:flex;flex-direction:column;gap:12px;">
        <input id="cc-lock-input" type="password" autocomplete="off" placeholder="Nhập mã PIN 6 số Chủ Quán" style="width:100%;padding:11px 14px;border-radius:11px;background:#020617;border:1px solid rgba(148,163,184,0.3);color:#fff;font-size:15px;text-align:center;letter-spacing:0.25em;outline:none;" />
        <div id="cc-lock-err" style="display:none;padding:8px 10px;border-radius:9px;background:rgba(244,63,94,0.14);border:1px solid rgba(244,63,94,0.4);color:#fda4af;font-size:12px;"></div>
        <button type="submit" class="btn-primary" style="width:100%;padding:11px;font-size:13px;" data-i18n="cc.unlock_btn">🔓 Mở Khóa</button>
      </form>
    </div>
  </div>

  <div class="grid" id="services-grid"></div>

  <div class="card">
    <div class="row">
      <div class="title" style="font-size:14px" data-i18n="cc.diag_title">Chẩn đoán Port, Toàn vẹn Code Web/DLL &amp; OTA</div>
      <div id="diag-status" class="sub" data-i18n="cc.diag_hint">Bấm "Kiểm tra Port &amp; Code" để quét</div>
    </div>
    <div class="diag-box" id="diag-box"></div>
  </div>

  <div class="card">
    <div class="row">
      <div class="title" style="font-size:14px" data-i18n="cc.console_title">Live Smart Console</div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="log-filter" onchange="renderLogs()" style="background:#0f172a;color:#e2e8f0;border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:11.5px">
          <option value="ALL" data-i18n="cc.filter_all">Tất cả log</option>
          <option value="ERROR">Chỉ xem Lỗi</option>
          <option value="WARN">Cảnh báo &amp; Lỗi</option>
        </select>
        <button onclick="clearLogs()" style="padding:5px 10px;font-size:11.5px">Xóa Console</button>
      </div>
    </div>
    <div class="console" id="console-box"></div>
  </div>
</div>
<script>
let allLogs = [];
let _ccToken = '';
let _ccUnlocked = false;
let _ccMode = 'slave';
let _ccLang = localStorage.getItem('cnx_cc_lang') || 'vi';
let _ccDict = {};
function ccT(key, fb) {
  const parts = String(key || '').split('.');
  let cur = _ccDict;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') { cur = undefined; break; }
    cur = cur[p];
  }
  return (typeof cur === 'string' && cur.length) ? cur : (fb || key);
}
function applyCcI18n() {
  document.documentElement.lang = _ccLang;
  const bVi = document.getElementById('cc-lang-vi');
  const bEn = document.getElementById('cc-lang-en');
  if (bVi) { bVi.style.background = _ccLang === 'vi' ? '#0ea5e9' : 'transparent'; bVi.style.color = _ccLang === 'vi' ? '#082f49' : '#cbd5e1'; }
  if (bEn) { bEn.style.background = _ccLang === 'en' ? '#0ea5e9' : 'transparent'; bEn.style.color = _ccLang === 'en' ? '#082f49' : '#cbd5e1'; }
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (!el.dataset.i18nDef) el.dataset.i18nDef = el.textContent;
    el.textContent = ccT(k, el.dataset.i18nDef);
  });
}
async function setCcLang(lang) {
  _ccLang = (lang === 'en') ? 'en' : 'vi';
  try { localStorage.setItem('cnx_cc_lang', _ccLang); } catch (e) { console.debug('ccLangSave', e); }
  try {
    const r = await fetch('/api/control/locales/' + _ccLang, { cache: 'no-store' });
    if (r.ok) _ccDict = await r.json();
  } catch (e) { console.debug('ccLocaleFetch', e); }
  applyCcI18n();
}
function showLockScreen(mode, pinHint) {
  _ccMode = mode || 'slave';
  _ccUnlocked = false;
  _ccToken = '';
  const ov = document.getElementById('cc-lock-overlay');
  const inp = document.getElementById('cc-lock-input');
  const sub = document.getElementById('cc-lock-sub');
  const hint = document.getElementById('cc-lock-hint');
  if (ov) ov.style.display = 'flex';
  if (mode === 'master') {
    if (sub) sub.textContent = 'Nhập mật khẩu SuperAdmin để mở Control Center';
    if (inp) { inp.placeholder = 'Mật khẩu SuperAdmin'; inp.style.letterSpacing = 'normal'; inp.removeAttribute('maxlength'); }
  } else {
    if (sub) sub.textContent = 'Nhập mã PIN 6 số của Chủ Quán (Admin)';
    if (inp) { inp.placeholder = '••••••'; inp.style.letterSpacing = '0.35em'; inp.setAttribute('maxlength', '6'); }
  }
  if (hint) {
    if (pinHint && mode !== 'master') {
      hint.textContent = '🔑 Quán vừa được Reset PIN từ Master. Chủ quán mở file DEFAULT_OWNER_PIN.txt trong thư mục cài đặt để lấy PIN 6 số.';
      hint.style.display = 'block';
    } else {
      hint.style.display = 'none';
    }
  }
  if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 50); }
}
async function submitCcLogin(e) {
  e.preventDefault();
  const inp = document.getElementById('cc-lock-input');
  const err = document.getElementById('cc-lock-err');
  const secret = (inp ? inp.value : '').trim();
  if (!secret) return;
  const r = await fetch('/api/control/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret })
  });
  const d = await r.json();
  if (d.success && d.token) {
    _ccToken = d.token;
    _ccUnlocked = true;
    if (err) err.style.display = 'none';
    document.getElementById('cc-lock-overlay').style.display = 'none';
    await refresh();
    pollUpdateBadge(true);
  } else {
    if (err) { err.textContent = d.message || 'Sai thông tin đăng nhập!'; err.style.display = 'block'; }
    if (inp) { inp.value = ''; inp.focus(); }
  }
}
async function checkCcAuth() {
  const r = await fetch('/api/control/auth-status');
  const d = await r.json();
  if (!d.unlocked || !_ccToken) {
    showLockScreen(d.mode, d.pin_reset_hint);
    return false;
  }
  return true;
}
async function api(url, method='GET', body=null){
  const headers = {'Content-Type':'application/json'};
  if (_ccToken) headers['X-CC-Session'] = _ccToken;
  const opt = {method, headers};
  if(body) opt.body = JSON.stringify(body);
  const r = await fetch(url, opt);
  if (r.status === 401) {
    await checkCcAuth();
    return { success: false, locked: true };
  }
  return r.json();
}
async function act(url, body){
  const res = await api(url, 'POST', body);
  if(res && !res.success && res.message) showCcModal({ title: 'Thông báo hệ thống', message: res.message });
  await refresh();
}
async function refresh(){
  const st = await api('/api/control/status');
  const grid = document.getElementById('services-grid');
  const avail = (st.services || []).filter(s => s.available);
  grid.innerHTML = avail.map(s => `
    <div class="card">
      <div class="row">
        <div><div class="title" style="font-size:15px">${s.pin_reset_ready ? '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;margin-right:6px" title="Đã nhận file PIN 6 số mặc định từ Master"></span>' : ''}${s.name}</div><div class="sub">${s.work_dir}</div></div>
        <span class="pill ${s.running ? 'on' : 'off'}">${s.running ? 'ĐANG CHẠY' : 'ĐÃ DỪNG'}</span>
      </div>
      <div class="meta">
        <div><span>PORT</span><b>${s.port}</b></div>
        <div><span>PID</span><b>${s.pid || '—'}</b></div>
        <div><span>TRẠNG THÁI</span><b>${s.running ? 'Online' : 'Offline'}</b></div>
      </div>
      <div class="actions">
        ${s.running
          ? `<button class="btn-danger" onclick="act('/api/control/stop',{id:'${s.id}'})">■ Dừng</button>
             <button onclick="act('/api/control/restart',{id:'${s.id}'})">↻ Khởi động lại</button>
             <button class="btn-primary" onclick="openKiosk('${s.web_url}')" title="Mở ứng dụng toàn màn hình (F11 để thu nhỏ)">⛶ Open</button>`
          : `<button class="btn-green" onclick="act('/api/control/start',{id:'${s.id}'})">▶ Khởi chạy</button>`
        }
        ${s.pin_reset_ready ? `<button class="btn-green" onclick="act('/api/control/open-pin-file')">● Mở File PIN 6 Số</button>` : ''}
      </div>
    </div>`).join('');
  allLogs = st.logs || [];
  renderLogs();
}
function renderLogs(){
  const f = document.getElementById('log-filter').value;
  const box = document.getElementById('console-box');
  const stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 24;
  const rows = allLogs.filter(l => f==='ALL' || (f==='ERROR' && l.level==='ERROR') || (f==='WARN' && l.level!=='INFO'));
  box.innerHTML = rows.map(l => `<div class="log-${l.level}"><span class="tag">${l.ts}</span><span class="tag">${l.service.toUpperCase()}</span>${l.text.replace(/</g,'&lt;')}</div>`).join('');
  if(stick) box.scrollTop = box.scrollHeight;
}
async function openKiosk(url){
  const res = await api('/api/control/open-kiosk', 'POST', { url });
  if (res && res.success) {
    showLockScreen(_ccMode || 'slave', false);
  }
}
async function runDiag(){
  document.getElementById('diag-status').textContent = 'Đang quét Port, DLL .sig, Web SHA-256 & SQLite...';
  const [ports, integ] = await Promise.all([api('/api/control/ports'), api('/api/control/integrity')]);
  const box = document.getElementById('diag-box');
  let html = ports.ports.map(p => `<div class="diag-item"><b>Port ${p.port}</b><br>${p.in_use ? `Đang dùng bởi <b>${p.process_name}</b> (PID ${p.pid}) ${!p.is_cybernexus ? `<br><button onclick="act('/api/control/free-port',{port:${p.port}})" style="margin-top:6px;padding:4px 8px;font-size:11px" class="btn-danger">Giải phóng Port</button>` : ''}` : '<span style="color:#34d399">Trống (Sẵn sàng)</span>'}</div>`).join('');
  html += integ.results.filter(r => r.available).map(r => {
    const dllBad = (r.dlls||[]).filter(d=>!d.ok).length;
    const webMod = r.web && r.web.has_manifest ? (r.web.modified.length + r.web.missing.length) : -1;
    return `<div class="diag-item"><b>Toàn vẹn ${r.service.toUpperCase()}</b><br>SQLite: <b>${r.database}</b><br>DLL .sig: ${r.dlls.length ? (dllBad===0 ? `<span style="color:#34d399">${r.dlls.length}/${r.dlls.length} Hợp lệ</span>` : `<span style="color:#f87171">${dllBad} DLL sai chữ ký!</span>`) : 'N/A'}<br>Web Code: ${webMod===-1 ? 'Chưa có manifest' : (webMod===0 ? `<span style="color:#34d399">${r.web.verified} file chuẩn</span>` : `<span style="color:#fbbf24">${r.web.modified.length} sửa, ${r.web.missing.length} thiếu</span>`)}</div>`;
  }).join('');
  box.innerHTML = html;
  document.getElementById('diag-status').textContent = 'Đã quét xong lúc ' + new Date().toLocaleTimeString();
}
function showCcModal({ title, message, confirmText = '', cancelText = 'Đóng', onConfirm = null }) {
  let m = document.getElementById('cc-custom-modal');
  if (m) m.remove();
  m = document.createElement('div');
  m.id = 'cc-custom-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,0.78);backdrop-filter:blur(8px);';
  m.innerHTML = `
    <div style="width:100%;max-width:440px;border-radius:16px;border:1px solid rgba(56,189,248,0.32);background:linear-gradient(160deg,#0f172a,#090e1c);box-shadow:0 24px 60px rgba(0,0,0,0.65);padding:20px;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;">
      <div style="font-size:15px;font-weight:700;color:#38bdf8;margin-bottom:8px;">${title || 'CyberNexus Control Center'}</div>
      <div id="cc-m-msg" style="font-size:13px;line-height:1.55;color:#cbd5e1;white-space:pre-line;margin-bottom:18px;"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button id="cc-m-cancel" type="button" style="padding:8px 14px;border-radius:9px;border:1px solid rgba(148,163,184,0.25);background:#1e293b;color:#cbd5e1;font-size:12.5px;font-weight:600;cursor:pointer;">${cancelText}</button>
        ${confirmText ? `<button id="cc-m-ok" type="button" style="padding:8px 16px;border-radius:9px;border:none;background:linear-gradient(90deg,#0ea5e9,#2563eb);color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;">${confirmText}</button>` : ''}
      </div>
    </div>`;
  document.body.appendChild(m);
  document.getElementById('cc-m-msg').textContent = message || '';
  document.getElementById('cc-m-cancel').onclick = () => m.remove();
  if (confirmText && document.getElementById('cc-m-ok')) {
    document.getElementById('cc-m-ok').onclick = async () => { m.remove(); if (onConfirm) await onConfirm(); };
  }
}
let _startupAutoUpdateDone = false;
async function runOtaApplyWithProgress(ver) {
  const pm = document.createElement('div');
  pm.id = 'cc-prog-modal';
  pm.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,0.85);backdrop-filter:blur(8px);';
  pm.innerHTML = `
    <div style="width:100%;max-width:440px;border-radius:16px;border:1px solid rgba(56,189,248,0.35);background:linear-gradient(160deg,#0f172a,#090e1c);padding:22px;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;">
      <div style="font-size:15px;font-weight:700;color:#38bdf8;margin-bottom:6px;">Đang cập nhật OTA v${ver || ''}</div>
      <div id="cc-prog-step" style="font-size:12.5px;color:#94a3b8;margin-bottom:12px;">1/5 Đang tải gói cập nhật &amp; kiểm tra SHA-256...</div>
      <div style="width:100%;height:8px;border-radius:999px;background:#1e293b;overflow:hidden;">
        <div id="cc-prog-bar" style="width:18%;height:100%;background:linear-gradient(90deg,#06b6d4,#3b82f6);transition:width 0.4s ease;"></div>
      </div>
    </div>`;
  document.body.appendChild(pm);
  const steps = [
    [32, '2/5 Đang kiểm tra chữ ký toàn vẹn SHA-256...'],
    [55, '3/5 Đang sao lưu dự phòng (Rollback Snapshot)...'],
    [76, '4/5 Đang dừng Slave an toàn & cài đặt bản mới...'],
    [92, '5/5 Đang khởi động lại & kiểm tra Healthcheck...']
  ];
  let si = 0;
  const stTimer = setInterval(() => {
    if (si < steps.length) {
      const bar = document.getElementById('cc-prog-bar');
      const lbl = document.getElementById('cc-prog-step');
      if (bar) bar.style.width = steps[si][0] + '%';
      if (lbl) lbl.textContent = steps[si][1];
      si++;
    }
  }, 1200);
  document.getElementById('diag-status').textContent = 'Đang tải & cập nhật OTA ' + (ver || '') + '...';
  const ap = await api('/api/control/apply-update','POST');
  clearInterval(stTimer);
  pm.remove();
  document.getElementById('diag-status').textContent = ap.message || 'Hoàn tất cập nhật';
  const dot = document.getElementById('cc-upd-dot');
  if (dot && ap.success) dot.style.display = 'none';
  showCcModal({ title: ap.success ? 'Cập nhật thành công' : 'Cập nhật thất bại', message: ap.message || 'Đã cập nhật xong!' });
  await refresh();
}
async function pollUpdateBadge(isStartup = false) {
  try {
    const r = await api('/api/control/updates');
    const dot = document.getElementById('cc-upd-dot');
    const btn = document.getElementById('btn-check-updates');
    if (dot) dot.style.display = r.has_update ? 'block' : 'none';
    if (btn) btn.title = r.has_update ? `Có bản cập nhật mới v${r.latest_version || ''}` : 'Kiểm tra cập nhật OTA';
    if (isStartup && !_startupAutoUpdateDone) {
      _startupAutoUpdateDone = true;
      if (r.has_update && (r.active_orders_count || 0) === 0) {
        await runOtaApplyWithProgress(r.latest_version);
      }
    }
  } catch (e) { console.debug('pollUpdateBadge', e); }
}
async function checkUpdates(){
  const r = await api('/api/control/updates');
  const dot = document.getElementById('cc-upd-dot');
  if (dot) dot.style.display = r.has_update ? 'block' : 'none';
  if(r.has_update){
    const warnOrders = (r.active_orders_count > 0)
      ? `\n\n⚠️ CẢNH BÁO: Quán đang có ${r.active_orders_count} đơn hàng chưa hoàn tất! Khuyên đợi thanh toán xong hãy cập nhật.`
      : '\n\n✅ Không có đơn hàng đang mở — An toàn để cập nhật.';
    showCcModal({
      title: ccT('cc.ota_title', 'Cập nhật OTA mới'),
      message: (r.summary || '') + warnOrders + '\n\nBạn có muốn tải và cập nhật OTA ngay không?',
      confirmText: 'Tải & Cập nhật ngay',
      cancelText: ccT('common.cancel', 'Để sau'),
      onConfirm: () => runOtaApplyWithProgress(r.latest_version)
    });
    return;
  }
  showCcModal({ title: ccT('cc.ota_check_title', 'Kiểm tra phiên bản OTA'), message: r.summary || 'Hệ thống đang ở phiên bản mới nhất.' });
}
async function clearLogs(){ await api('/api/control/clear-logs','POST'); await refresh(); }
async function quitAll(){
  showCcModal({
    title: ccT('common.confirm_title', 'Xác nhận thoát'),
    message: 'Tắt toàn bộ Master/Slave và thoát CyberNexus Control Center?',
    confirmText: 'Thoát hệ thống',
    cancelText: ccT('common.cancel', 'Hủy'),
    onConfirm: async () => { await api('/api/control/quit','POST'); window.close(); }
  });
}
setCcLang(_ccLang);
checkCcAuth().then(ok => { if (ok) { refresh(); pollUpdateBadge(true); } });
setInterval(() => { if (_ccUnlocked) refresh(); }, 2500);
setInterval(() => { if (_ccUnlocked) pollUpdateBadge(false); }, 20000);
</script>
</body>
</html>)HTML";
}

} // namespace

int WINAPI wWinMain(HINSTANCE hInst, HINSTANCE, PWSTR, int) {
    HANDLE hMutex = CreateMutexW(nullptr, TRUE, L"CyberNexusControlCenterSingleInstance");
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        openControlCenterWindow();
        if (hMutex) CloseHandle(hMutex);
        return 0;
    }

    discoverServices();

    // Auto-start discovered services cleanly without CMD
    {
        std::string err;
        if (g_master.available) {
            if (!startService(g_master, err)) pushLog("master", err, "ERROR");
        }
        if (g_slave.available) {
            if (!startService(g_slave, err)) pushLog("slave", err, "ERROR");
        }
    }

    httplib::Server svr;
    g_svr = &svr;

    svr.Get("/", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(buildControlCenterHtml(), "text/html; charset=utf-8");
    });

    svr.Get(R"(/api/control/locales/(vi|en))", [](const httplib::Request& req, httplib::Response& res) {
        std::string lang = req.matches.size() > 1 ? req.matches[1].str() : "vi";
        res.set_header("Cache-Control", "no-store");
        res.set_content(readCcExternalLocale(lang), "application/json; charset=utf-8");
    });

    svr.Get("/favicon.ico", [](const httplib::Request&, httplib::Response& res) {
        if (g_master.available && !g_slave.available) {
            res.set_content(reinterpret_cast<const char*>(CyberNexus::Icons::MASTER_FAVICON_ICO),
                            CyberNexus::Icons::MASTER_FAVICON_ICO_len, "image/x-icon");
        } else {
            res.set_content(reinterpret_cast<const char*>(CyberNexus::Icons::STORE_FAVICON_ICO),
                            CyberNexus::Icons::STORE_FAVICON_ICO_len, "image/x-icon");
        }
    });
    svr.Get("/favicon.png", [](const httplib::Request&, httplib::Response& res) {
        if (g_master.available && !g_slave.available) {
            res.set_content(reinterpret_cast<const char*>(CyberNexus::Icons::MASTER_FAVICON_PNG),
                            CyberNexus::Icons::MASTER_FAVICON_PNG_len, "image/png");
        } else {
            res.set_content(reinterpret_cast<const char*>(CyberNexus::Icons::STORE_FAVICON_PNG),
                            CyberNexus::Icons::STORE_FAVICON_PNG_len, "image/png");
        }
    });

    svr.Get("/api/control/auth-status", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lk(g_ccAuthMtx);
        std::string tok = req.has_header("X-CC-Session") ? req.get_header_value("X-CC-Session") : "";
        bool unlocked = !g_ccToken.empty() && tok == g_ccToken;
        bool pinHint = (g_slave.available && fs::exists(g_slave.workDir / "owner_pin_reset.flag"));
        std::string mode = g_master.available ? "master" : "slave";
        res.set_content(json({{"success", true}, {"unlocked", unlocked}, {"mode", mode}, {"pin_reset_hint", pinHint}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/login", [](const httplib::Request& req, httplib::Response& res) {
        json body = json::parse(req.body, nullptr, false);
        std::string secret = body.value("secret", "");
        std::time_t now = std::time(nullptr);
        {
            std::lock_guard<std::mutex> lk(g_ccAuthMtx);
            if (g_ccLockedUntil > now) {
                res.status = 429;
                res.set_content(json({{"success", false}, {"message", "Nhập sai quá nhiều lần. Vui lòng thử lại sau " + std::to_string(g_ccLockedUntil - now) + " giây!"}}).dump(), "application/json; charset=utf-8");
                return;
            }
        }
        if (verifyCcCredential(secret)) {
            std::string newTok = SaleApp::Backend::AuthService::sha256(
                std::to_string(now) + "|" + std::to_string(GetTickCount64()) + "|CNCC"
            );
            std::lock_guard<std::mutex> lk(g_ccAuthMtx);
            g_ccToken = newTok;
            g_ccFailCount = 0;
            g_ccLockedUntil = 0;
            res.set_content(json({{"success", true}, {"token", newTok}}).dump(), "application/json; charset=utf-8");
            return;
        }
        std::lock_guard<std::mutex> lk(g_ccAuthMtx);
        g_ccFailCount++;
        if (g_ccFailCount >= 5) {
            g_ccLockedUntil = now + 30;
            g_ccFailCount = 0;
        }
        res.status = 401;
        res.set_content(json({{"success", false}, {"message", g_master.available ? "Sai mật khẩu SuperAdmin!" : "Sai mã PIN 6 số của Chủ Quán!"}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/lock", [](const httplib::Request&, httplib::Response& res) {
        clearCcSession();
        res.set_content("{\"success\":true}", "application/json");
    });

    svr.Get("/api/control/status", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        std::lock_guard<std::mutex> lk(g_mtx);
        refreshServiceStatus(g_master);
        refreshServiceStatus(g_slave);
        auto makeSvc = [](const ServiceState& s) {
            bool pinReady = (s.id == "slave" && s.available && fs::exists(s.workDir / "owner_pin_reset.flag"));
            return json{
                {"id", s.id},
                {"name", s.name},
                {"port", s.port},
                {"available", s.available},
                {"running", s.running},
                {"pid", s.pid},
                {"pin_reset_ready", pinReady},
                {"work_dir", s.workDir.string()},
                {"web_url", s.id == "master" ? "http://localhost:8500/super_admin" : "http://localhost:8501/admin"}
            };
        };
        json logArr = json::array();
        for (const auto& l : g_logs) {
            logArr.push_back({{"ts", l.ts}, {"service", l.service}, {"level", l.level}, {"text", l.text}});
        }
        res.set_content(json({{"success", true}, {"services", {makeSvc(g_master), makeSvc(g_slave)}}, {"logs", logArr}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/start", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        json body = json::parse(req.body, nullptr, false);
        std::string id = body.value("id", "");
        std::string err;
        bool ok = (id == "master") ? startService(g_master, err) : startService(g_slave, err);
        res.set_content(json({{"success", ok}, {"message", err}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/stop", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        json body = json::parse(req.body, nullptr, false);
        std::string id = body.value("id", "");
        if (id == "master") stopService(g_master);
        else if (id == "slave") stopService(g_slave);
        res.set_content(json({{"success", true}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/restart", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        json body = json::parse(req.body, nullptr, false);
        std::string id = body.value("id", "");
        ServiceState& s = (id == "master") ? g_master : g_slave;
        stopService(s);
        Sleep(400);
        std::string err;
        bool ok = startService(s, err);
        res.set_content(json({{"success", ok}, {"message", err}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/start-all", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        std::string err;
        if (g_master.available) startService(g_master, err);
        if (g_slave.available) startService(g_slave, err);
        res.set_content(json({{"success", true}}).dump(), "application/json; charset=utf-8");
    });

    svr.Get("/api/control/ports", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        json arr = json::array();
        std::vector<int> portsToCheck;
        if (g_master.available) portsToCheck.push_back(8500);
        if (g_slave.available) portsToCheck.push_back(8501);
        portsToCheck.push_back(CONTROL_PORT);
        for (int p : portsToCheck) {
            PortOwner po = inspectTcpPort(p);
            bool isCn = po.processName.find("cybernexus") != std::string::npos ||
                        po.processName.find("CyberNexus") != std::string::npos;
            arr.push_back({{"port", p}, {"in_use", po.inUse}, {"pid", po.pid}, {"process_name", po.processName}, {"is_cybernexus", isCn}});
        }
        res.set_content(json({{"success", true}, {"ports", arr}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/free-port", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        json body = json::parse(req.body, nullptr, false);
        int p = body.value("port", 0);
        PortOwner po = inspectTcpPort(p);
        bool ok = po.inUse ? killPid(po.pid) : true;
        res.set_content(json({{"success", ok}, {"message", ok ? "Đã giải phóng port." : "Không thể dừng tiến trình (thử chạy quyền Admin)."}}).dump(), "application/json; charset=utf-8");
    });

    svr.Get("/api/control/integrity", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        res.set_content(json({{"success", true}, {"results", {checkServiceIntegrity(g_master), checkServiceIntegrity(g_slave)}}}).dump(), "application/json; charset=utf-8");
    });

    svr.Get("/api/control/updates", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        std::string summary = "Không tìm thấy manifest OTA cục bộ.";
        bool hasUpdate = false;
        std::string curVer = "v2.3.0";
        std::string latestVer;
        int activeOrdersCount = 0;
        if (g_master.available) {
            fs::path mp = g_master.workDir / "updates" / "manifest.json";
            if (fs::exists(mp)) {
                std::ifstream ifs(mp);
                json m = json::parse(ifs, nullptr, false);
                summary = "Master OTA mới nhất đang phát hành: v" + m.value("version", "?") + " — " + m.value("title", "");
            }
        } else if (g_slave.available) {
            fs::path vp = g_slave.workDir / "version.txt";
            if (fs::exists(vp)) { std::ifstream ifs(vp); std::getline(ifs, curVer); }
            std::string masterUrl = "http://127.0.0.1:8500";
            fs::path cfgPath = g_slave.workDir / "config.json";
            if (fs::exists(cfgPath)) {
                std::ifstream cfs(cfgPath);
                json cfg = json::parse(cfs, nullptr, false);
                if (cfg.is_object() && !cfg.value("master_server_url", "").empty()) {
                    masterUrl = cfg.value("master_server_url", masterUrl);
                }
            }
            fs::path dbPath = g_slave.workDir / "database" / "store_local.db";
            if (fs::exists(dbPath)) {
                sqlite3* db = nullptr;
                if (sqlite3_open_v2(dbPath.string().c_str(), &db, SQLITE_OPEN_READONLY, nullptr) == SQLITE_OK) {
                    sqlite3_stmt* stmt = nullptr;
                    if (sqlite3_prepare_v2(db, "SELECT setting_value FROM store_settings WHERE setting_key='master_url' LIMIT 1", -1, &stmt, nullptr) == SQLITE_OK) {
                        if (sqlite3_step(stmt) == SQLITE_ROW) {
                            const unsigned char* u = sqlite3_column_text(stmt, 0);
                            if (u && u[0]) masterUrl = reinterpret_cast<const char*>(u);
                        }
                        sqlite3_finalize(stmt);
                    }
                    sqlite3_stmt* ost = nullptr;
                    if (sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM orders WHERE status IN ('pending','preparing','ready')", -1, &ost, nullptr) == SQLITE_OK) {
                        if (sqlite3_step(ost) == SQLITE_ROW) activeOrdersCount = sqlite3_column_int(ost, 0);
                        sqlite3_finalize(ost);
                    }
                    sqlite3_close(db);
                }
            }
            // 1. Kiểm tra thông báo OTA đã được Master đẩy riêng xuống Slave cục bộ trước
            httplib::Client localSlave("127.0.0.1", g_slave.port > 0 ? g_slave.port : 8501);
            localSlave.set_connection_timeout(2, 0);
            localSlave.set_read_timeout(3, 0);
            if (auto sr = localSlave.Get("/api/system/updates")) {
                if (sr->status == 200) {
                    json sj = json::parse(sr->body, nullptr, false);
                    if (sj.is_object()) {
                        std::string appVer = sj.value("applied_version", "");
                        if (!appVer.empty()) curVer = appVer;
                        if (sj.value("has_update", false)) {
                            hasUpdate = true;
                            latestVer = sj.value("latest_version", "");
                            std::string ut = sj.value("update_title", "Bản cập nhật OTA mới từ Master");
                            summary = "Có bản cập nhật OTA được Master đẩy xuống: v" + latestVer + " (Hiện tại: " + curVer + ")\n" + ut;
                        }
                    }
                }
            }
            // 2. Nếu chưa có lệnh đẩy riêng, kiểm tra bản vá đại trà đã duyệt trên Master (/api/updates/latest)
            if (!hasUpdate) {
                while (!masterUrl.empty() && masterUrl.back() == '/') masterUrl.pop_back();
                httplib::Client cli(masterUrl);
                cli.set_connection_timeout(4, 0);
                cli.set_read_timeout(6, 0);
                if (auto r = cli.Get("/api/updates/latest")) {
                    if (r->status == 200) {
                        json resJ = json::parse(r->body, nullptr, false);
                        if (resJ.value("has_patch", false) && resJ.contains("manifest") && resJ["manifest"].is_object()) {
                            json m = resJ["manifest"];
                            latestVer = m.value("version", "");
                            std::string title = m.value("title", "");
                            if (!latestVer.empty() && curVer != latestVer && curVer != ("v" + latestVer)) {
                                hasUpdate = true;
                                summary = "Có bản cập nhật OTA mới: v" + latestVer + " (Hiện tại: " + curVer + ")\n" + title;
                            } else {
                                summary = "Máy quán đang ở bản mới nhất (" + curVer + ").";
                            }
                        } else {
                            summary = "Máy quán đang ở bản mới nhất (" + curVer + "). Chưa có bản OTA đại trà mới.";
                        }
                    } else {
                        summary = "Master trả HTTP " + std::to_string(r->status) + " khi kiểm tra OTA tại " + masterUrl;
                    }
                } else {
                    summary = "Không kết nối được Master tại " + masterUrl + " để kiểm tra OTA (Hiện tại: " + curVer + ").";
                }
            }
        }
        res.set_content(json({{"success", true}, {"has_update", hasUpdate}, {"active_orders_count", activeOrdersCount}, {"current_version", curVer}, {"latest_version", latestVer}, {"summary", summary}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/apply-update", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        if (!g_slave.available) {
            res.set_content("{\"success\":false,\"message\":\"Chỉ áp dụng cho máy Store\"}", "application/json; charset=utf-8");
            return;
        }
        std::string masterUrl = "http://127.0.0.1:8500";
        fs::path cfgPath = g_slave.workDir / "config.json";
        if (fs::exists(cfgPath)) {
            std::ifstream cfs(cfgPath);
            json cfg = json::parse(cfs, nullptr, false);
            if (cfg.is_object() && !cfg.value("master_server_url", "").empty()) masterUrl = cfg.value("master_server_url", masterUrl);
        }
        fs::path dbPath = g_slave.workDir / "database" / "store_local.db";
        if (fs::exists(dbPath)) {
            sqlite3* db = nullptr;
            if (sqlite3_open_v2(dbPath.string().c_str(), &db, SQLITE_OPEN_READONLY, nullptr) == SQLITE_OK) {
                sqlite3_stmt* stmt = nullptr;
                if (sqlite3_prepare_v2(db, "SELECT setting_value FROM store_settings WHERE setting_key='master_url' LIMIT 1", -1, &stmt, nullptr) == SQLITE_OK) {
                    if (sqlite3_step(stmt) == SQLITE_ROW) {
                        const unsigned char* u = sqlite3_column_text(stmt, 0);
                        if (u && u[0]) masterUrl = reinterpret_cast<const char*>(u);
                    }
                    sqlite3_finalize(stmt);
                }
                sqlite3_close(db);
            }
        }
        std::string dlPath = "/api/updates/download";
        std::string latestVer = "";
        {
            httplib::Client localSlave("127.0.0.1", g_slave.port > 0 ? g_slave.port : 8501);
            localSlave.set_connection_timeout(2, 0);
            localSlave.set_read_timeout(3, 0);
            if (auto sr = localSlave.Get("/api/system/updates")) {
                if (sr->status == 200) {
                    json sj = json::parse(sr->body, nullptr, false);
                    if (sj.is_object() && sj.value("has_update", false)) {
                        if (!sj.value("download_path", "").empty()) dlPath = sj.value("download_path", dlPath);
                        latestVer = sj.value("latest_version", "");
                    }
                }
            }
        }
        while (!masterUrl.empty() && masterUrl.back() == '/') masterUrl.pop_back();
        httplib::Client cli(masterUrl);
        cli.set_connection_timeout(5, 0);
        cli.set_read_timeout(60, 0);
        if (latestVer.empty()) {
            auto mr = cli.Get("/api/updates/latest");
            if (mr && mr->status == 200) {
                json rj = json::parse(mr->body, nullptr, false);
                if (rj.contains("manifest") && rj["manifest"].is_object()) {
                    latestVer = rj["manifest"].value("version", "");
                }
            }
        }
        auto zr = cli.Get(dlPath);
        if (!zr || zr->status != 200 || zr->body.size() < 512) {
            res.set_content(json({{"success", false}, {"message", "Không tải được gói OTA từ " + masterUrl}}).dump(), "application/json; charset=utf-8");
            return;
        }
        // Kiểm tra toàn vẹn SHA-256 trước khi dừng Slave
        if (zr->has_header("X-Package-SHA256")) {
            std::string expectedHash = zr->get_header_value("X-Package-SHA256");
            std::string actualHash = SaleApp::Backend::AuthService::sha256(zr->body);
            if (!expectedHash.empty() && expectedHash != actualHash) {
                res.set_content(json({{"success", false}, {"message", "Gói OTA bị hỏng hoặc sai chữ ký SHA-256! Đã hủy để bảo vệ POS."}}).dump(), "application/json; charset=utf-8");
                return;
            }
        }
        wchar_t tmpBuf[MAX_PATH] = {0};
        GetTempPathW(MAX_PATH, tmpBuf);
        fs::path tmpZip = fs::path(tmpBuf) / L"cnx_ota_patch.zip";
        fs::path stageDir = fs::path(tmpBuf) / L"cnx_ota_stage";
        std::error_code ecode;
        fs::remove_all(stageDir, ecode);
        fs::create_directories(stageDir, ecode);
        {
            std::ofstream ofs(tmpZip, std::ios::binary | std::ios::trunc);
            ofs.write(zr->body.data(), zr->body.size());
        }
        // Giải nén vào thư mục tạm trước
        std::wstring psCmd = L"powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"Expand-Archive -LiteralPath '"
            + tmpZip.wstring() + L"' -DestinationPath '" + stageDir.wstring() + L"' -Force\"";
        STARTUPINFOW si{}; si.cb = sizeof(si); si.dwFlags = STARTF_USESHOWWINDOW; si.wShowWindow = SW_HIDE;
        PROCESS_INFORMATION pi{};
        BOOL ok = CreateProcessW(nullptr, psCmd.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, nullptr, &si, &pi);
        DWORD ec = 1;
        if (ok) {
            WaitForSingleObject(pi.hProcess, 120000);
            GetExitCodeProcess(pi.hProcess, &ec);
            CloseHandle(pi.hProcess); CloseHandle(pi.hThread);
        }
        fs::remove(tmpZip, ecode);
        if (ec != 0) {
            fs::remove_all(stageDir, ecode);
            res.set_content(json({{"success", false}, {"message", "Giải nén gói OTA thất bại! POS vẫn đang hoạt động bình thường."}}).dump(), "application/json; charset=utf-8");
            return;
        }
        // Sao lưu dự phòng (Rollback Snapshot)
        fs::path backupDir = g_slave.workDir / "backup_prev";
        fs::remove_all(backupDir, ecode);
        fs::create_directories(backupDir, ecode);
        for (const auto& item : {"cybernexus_slave.exe", "CyberNexus_Control_Center.exe", "version.txt"}) {
            if (fs::exists(g_slave.workDir / item)) {
                fs::copy_file(g_slave.workDir / item, backupDir / item, fs::copy_options::overwrite_existing, ecode);
            }
        }
        if (fs::exists(g_slave.workDir / "web")) {
            fs::copy(g_slave.workDir / "web", backupDir / "web", fs::copy_options::recursive | fs::copy_options::overwrite_existing, ecode);
        }
        if (fs::exists(g_slave.workDir / "modules")) {
            fs::copy(g_slave.workDir / "modules", backupDir / "modules", fs::copy_options::recursive | fs::copy_options::overwrite_existing, ecode);
        }
        // Dừng Slave có kiểm soát & chép file an toàn
        stopService(g_slave);
        Sleep(700);
        for (const auto& entry : fs::recursive_directory_iterator(stageDir, ecode)) {
            if (!entry.is_regular_file()) continue;
            fs::path rel = fs::relative(entry.path(), stageDir, ecode);
            std::string relStr = rel.generic_string();
            fs::path dest = g_slave.workDir / rel;
            // Always deploy official signed DLLs + .sig from OTA (LicenseService enforces ON/OFF/BLOCK dynamically)
            if (dest.has_parent_path()) fs::create_directories(dest.parent_path(), ecode);
            if (relStr == "CyberNexus_Control_Center.exe" && fs::exists(dest)) {
                fs::path oldCc = g_slave.workDir / "CyberNexus_Control_Center.exe.old";
                fs::remove(oldCc, ecode);
                MoveFileExW(dest.wstring().c_str(), oldCc.wstring().c_str(), MOVEFILE_REPLACE_EXISTING);
            }
            fs::copy_file(entry.path(), dest, fs::copy_options::overwrite_existing, ecode);
        }
        fs::remove_all(stageDir, ecode);
        if (!latestVer.empty()) {
            std::ofstream vfs(g_slave.workDir / "version.txt", std::ios::trunc);
            vfs << latestVer;
            if (fs::exists(dbPath)) {
                sqlite3* db = nullptr;
                if (sqlite3_open(dbPath.string().c_str(), &db) == SQLITE_OK) {
                    sqlite3_stmt* ust = nullptr;
                    if (sqlite3_prepare_v2(db,
                        "INSERT INTO store_settings (setting_key, setting_value) VALUES ('ota_applied_version', ?) "
                        "ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value",
                        -1, &ust, nullptr) == SQLITE_OK) {
                        sqlite3_bind_text(ust, 1, latestVer.c_str(), -1, SQLITE_TRANSIENT);
                        sqlite3_step(ust);
                        sqlite3_finalize(ust);
                    }
                    sqlite3_exec(db, "UPDATE app_notifications SET is_read_cashier = 1, is_read_waiter = 1 WHERE type = 'SYSTEM_UPDATE';", nullptr, nullptr, nullptr);
                    sqlite3_close(db);
                }
            }
        }
        std::string startErr;
        bool started = startService(g_slave, startErr);
        bool healthy = false;
        if (started) {
            httplib::Client hc("127.0.0.1", g_slave.port > 0 ? g_slave.port : 8501);
            hc.set_connection_timeout(1, 0);
            hc.set_read_timeout(2, 0);
            for (int i = 0; i < 20; ++i) {
                if (auto hr = hc.Get("/api/settings.php")) {
                    if (hr->status == 200) { healthy = true; break; }
                }
                Sleep(500);
            }
        }
        if (!healthy) {
            // Auto-Rollback từ backup_prev/
            stopService(g_slave);
            Sleep(500);
            if (fs::exists(backupDir / "cybernexus_slave.exe")) {
                fs::copy_file(backupDir / "cybernexus_slave.exe", g_slave.workDir / "cybernexus_slave.exe", fs::copy_options::overwrite_existing, ecode);
            }
            if (fs::exists(backupDir / "web")) {
                fs::copy(backupDir / "web", g_slave.workDir / "web", fs::copy_options::recursive | fs::copy_options::overwrite_existing, ecode);
            }
            if (fs::exists(backupDir / "modules")) {
                fs::copy(backupDir / "modules", g_slave.workDir / "modules", fs::copy_options::recursive | fs::copy_options::overwrite_existing, ecode);
            }
            if (fs::exists(backupDir / "version.txt")) {
                fs::copy_file(backupDir / "version.txt", g_slave.workDir / "version.txt", fs::copy_options::overwrite_existing, ecode);
                std::ifstream oldVfs(backupDir / "version.txt");
                std::string oldVer;
                if (std::getline(oldVfs, oldVer) && !oldVer.empty() && fs::exists(dbPath)) {
                    sqlite3* rdb = nullptr;
                    if (sqlite3_open(dbPath.string().c_str(), &rdb) == SQLITE_OK) {
                        sqlite3_stmt* ust = nullptr;
                        if (sqlite3_prepare_v2(rdb,
                            "INSERT INTO store_settings (setting_key, setting_value) VALUES ('ota_applied_version', ?) "
                            "ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value",
                            -1, &ust, nullptr) == SQLITE_OK) {
                            sqlite3_bind_text(ust, 1, oldVer.c_str(), -1, SQLITE_TRANSIENT);
                            sqlite3_step(ust);
                            sqlite3_finalize(ust);
                        }
                        sqlite3_close(rdb);
                    }
                }
            }
            startService(g_slave, startErr);
            res.set_content(json({{"success", false}, {"message", "Bản mới khởi động lỗi! Hệ thống đã tự động Rollback về bản cũ an toàn."}}).dump(), "application/json; charset=utf-8");
            return;
        }
        res.set_content(json({{"success", true}, {"message", "Đã cập nhật OTA " + latestVer + ", xác thực Healthcheck OK và khởi động lại Slave thành công!"}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/clear-logs", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        std::lock_guard<std::mutex> lk(g_mtx);
        g_logs.clear();
        res.set_content("{\"success\":true}", "application/json");
    });

    svr.Post("/api/control/open-kiosk", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        clearCcSession();
        json body = json::parse(req.body, nullptr, false);
        std::string url = body.value("url", "http://127.0.0.1:8501");
        std::wstring wurl(url.begin(), url.end());
        wchar_t tmpBuf[MAX_PATH] = {0};
        GetTempPathW(MAX_PATH, tmpBuf);
        fs::path profileDir = fs::path(tmpBuf) / L"cnx_kiosk_profile";
        std::error_code ec;
        fs::create_directories(profileDir, ec);

        auto collectChromeWins = []() {
            std::vector<HWND> list;
            EnumWindows([](HWND hw, LPARAM lp) -> BOOL {
                if (!IsWindowVisible(hw) || GetWindow(hw, GW_OWNER) != nullptr) return TRUE;
                wchar_t cls[64] = {0};
                if (GetClassNameW(hw, cls, 64) > 0 && wcscmp(cls, L"Chrome_WidgetWin_1") == 0) {
                    reinterpret_cast<std::vector<HWND>*>(lp)->push_back(hw);
                }
                return TRUE;
            }, reinterpret_cast<LPARAM>(&list));
            return list;
        };
        std::vector<HWND> beforeWins = collectChromeWins();

        std::wstring args = L"--app=" + wurl + L" --start-fullscreen --no-first-run --disable-features=Translate --user-data-dir=\"" + profileDir.wstring() + L"\"";
        HINSTANCE r = ShellExecuteW(nullptr, L"open", L"msedge.exe", args.c_str(), nullptr, SW_SHOWNORMAL);
        if (reinterpret_cast<INT_PTR>(r) <= 32) {
            ShellExecuteW(nullptr, L"open", L"chrome.exe", args.c_str(), nullptr, SW_SHOWNORMAL);
        }

        // Gắn icon CyberNexus (resource 101) lên cửa sổ Edge --app để thay thế icon địa cầu mặc định trên Titlebar & Taskbar
        std::thread([beforeWins, collectChromeWins]() {
            HICON hBig = reinterpret_cast<HICON>(LoadImageW(GetModuleHandleW(nullptr), MAKEINTRESOURCEW(101), IMAGE_ICON, GetSystemMetrics(SM_CXICON), GetSystemMetrics(SM_CYICON), LR_SHARED));
            HICON hSmall = reinterpret_cast<HICON>(LoadImageW(GetModuleHandleW(nullptr), MAKEINTRESOURCEW(101), IMAGE_ICON, GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_SHARED));
            if (!hBig && !hSmall) return;

            HWND target = nullptr;
            for (int i = 0; i < 60 && !target; ++i) {
                Sleep(200);
                auto nowWins = collectChromeWins();
                for (HWND hw : nowWins) {
                    if (std::find(beforeWins.begin(), beforeWins.end(), hw) == beforeWins.end()) {
                        if (GetWindowTextLengthW(hw) > 0) {
                            target = hw;
                            break;
                        }
                    }
                }
            }
            if (!target) return;

            auto applyIcon = [target, hBig, hSmall]() {
                if (hBig) SendMessageTimeoutW(target, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(hBig), SMTO_ABORTIFHUNG, 150, nullptr);
                if (hSmall) SendMessageTimeoutW(target, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(hSmall), SMTO_ABORTIFHUNG, 150, nullptr);
            };
            applyIcon();
            // Giữ icon ổn định qua các lần chuyển trang (VD: login.html -> admin.html)
            for (int tick = 0; tick < 600 && IsWindow(target); ++tick) {
                Sleep(1000);
                if (!IsWindow(target)) break;
                DWORD_PTR curSmall = 0;
                if (SendMessageTimeoutW(target, WM_GETICON, ICON_SMALL, 0, SMTO_ABORTIFHUNG, 100, &curSmall)) {
                    if (reinterpret_cast<HICON>(curSmall) != hSmall) applyIcon();
                }
            }
        }).detach();

        HWND ccWin = FindWindowW(nullptr, L"CyberNexus OS \u2014 Control Center");
        if (ccWin) PostMessageW(ccWin, WM_CLOSE, 0, 0);
        res.set_content("{\"success\":true}", "application/json");
    });

    svr.Post("/api/control/open-pin-file", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        std::error_code ec;
        fs::path pinFile = g_slave.workDir / "DEFAULT_OWNER_PIN.txt";
        fs::remove(g_slave.workDir / "owner_pin_reset.flag", ec);
        if (fs::exists(pinFile)) {
            ShellExecuteW(nullptr, L"open", pinFile.wstring().c_str(), nullptr, g_slave.workDir.wstring().c_str(), SW_SHOWNORMAL);
            res.set_content("{\"success\":true}", "application/json");
        } else {
            res.set_content("{\"success\":false,\"message\":\"Không tìm thấy file DEFAULT_OWNER_PIN.txt\"}", "application/json");
        }
    });

    svr.Post("/api/control/quit", [](const httplib::Request& req, httplib::Response& res) {
        if (!requireCcAuth(req, res)) return;
        res.set_content("{\"success\":true}", "application/json");
        std::thread([]() {
            Sleep(200);
            if (g_slave.available) stopService(g_slave);
            if (g_master.available) stopService(g_master);
            g_running = false;
            if (g_hwnd) PostMessageW(g_hwnd, WM_CLOSE, 0, 0);
        }).detach();
    });

    std::thread httpThread([&]() {
        svr.listen("127.0.0.1", CONTROL_PORT);
    });

    WNDCLASSW wc{};
    wc.lpfnWndProc = TrayWndProc;
    wc.hInstance = hInst;
    wc.lpszClassName = L"CyberNexusControlCenterTray";
    RegisterClassW(&wc);
    g_hwnd = CreateWindowW(wc.lpszClassName, L"CyberNexus Control Center", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, hInst, nullptr);

    g_nid.cbSize = sizeof(g_nid);
    g_nid.hWnd = g_hwnd;
    g_nid.uID = 1;
    g_nid.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    g_nid.uCallbackMessage = WM_TRAYICON;
    HICON hAppIcon = LoadIconW(hInst, MAKEINTRESOURCEW(101));
    g_nid.hIcon = hAppIcon ? hAppIcon : LoadIconW(nullptr, MAKEINTRESOURCEW(32512));
    wcscpy_s(g_nid.szTip, L"CyberNexus OS Control Center");
    Shell_NotifyIconW(NIM_ADD, &g_nid);

    openControlCenterWindow();

    MSG msg{};
    while (g_running && GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    Shell_NotifyIconW(NIM_DELETE, &g_nid);
    svr.stop();
    if (httpThread.joinable()) httpThread.join();
    if (hMutex) CloseHandle(hMutex);
    return 0;
}

#endif
