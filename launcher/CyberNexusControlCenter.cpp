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
#include "sqlite3.h"

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
                std::string binName = sig.value("binary", "");
                std::string expHash = sig.value("sha256", "");
                fs::path binPath = modDir / binName;
                std::string actHash = fs::exists(binPath) ? sha256FileHex(binPath) : "";
                bool ok = !expHash.empty() && expHash == actHash;
                dllChecks.push_back({{"file", binName}, {"ok", ok}});
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

void openControlCenterWindow() {
    std::string url = "http://127.0.0.1:" + std::to_string(CONTROL_PORT) + "/";
    // Try Edge App Mode first for native Apple-like frameless window
    const char* edgePaths[] = {
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    };
    for (const char* ep : edgePaths) {
        if (fs::exists(ep)) {
            std::string args = "--app=" + url + " --window-size=1160,790";
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

std::string buildControlCenterHtml() {
    return R"HTML(<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CyberNexus OS — Control Center</title>
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
        <div class="title">CyberNexus Control Center</div>
        <div class="sub">Quản trị Master &amp; Slave không CMD • Chạy ngầm System Tray</div>
      </div>
    </div>
    <div class="toolbar">
      <button class="btn-green" onclick="act('/api/control/start-all')">▶ Khởi chạy tất cả</button>
      <button onclick="runDiag()">🛡 Kiểm tra Port &amp; Code</button>
      <button onclick="checkUpdates()">☁ Kiểm tra Update</button>
      <button class="btn-danger" onclick="quitAll()">⏻ Thoát Hệ Thống</button>
    </div>
  </div>

  <div class="grid" id="services-grid"></div>

  <div class="card">
    <div class="row">
      <div class="title" style="font-size:14px">Chẩn đoán Port, Toàn vẹn Code Web/DLL &amp; OTA</div>
      <div id="diag-status" class="sub">Bấm "Kiểm tra Port &amp; Code" để quét</div>
    </div>
    <div class="diag-box" id="diag-box"></div>
  </div>

  <div class="card">
    <div class="row">
      <div class="title" style="font-size:14px">Live Smart Console</div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="log-filter" onchange="renderLogs()" style="background:#0f172a;color:#e2e8f0;border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:11.5px">
          <option value="ALL">Tất cả log</option>
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
async function api(url, method='GET', body=null){
  const opt = {method, headers:{'Content-Type':'application/json'}};
  if(body) opt.body = JSON.stringify(body);
  const r = await fetch(url, opt);
  return r.json();
}
async function act(url, body){
  const res = await api(url, 'POST', body);
  if(res && !res.success && res.message) alert(res.message);
  await refresh();
}
async function refresh(){
  const st = await api('/api/control/status');
  const grid = document.getElementById('services-grid');
  const avail = (st.services || []).filter(s => s.available);
  grid.innerHTML = avail.map(s => `
    <div class="card">
      <div class="row">
        <div><div class="title" style="font-size:15px">${s.name}</div><div class="sub">${s.work_dir}</div></div>
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
             <button class="btn-primary" onclick="window.open('${s.web_url}','_blank')">🌐 Mở Web</button>`
          : `<button class="btn-green" onclick="act('/api/control/start',{id:'${s.id}'})">▶ Khởi chạy</button>`
        }
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
async function checkUpdates(){
  const r = await api('/api/control/updates');
  alert(r.summary || 'Đã kiểm tra phiên bản OTA.');
}
async function clearLogs(){ await api('/api/control/clear-logs','POST'); await refresh(); }
async function quitAll(){
  if(!confirm('Tắt toàn bộ Master/Slave và thoát CyberNexus Control Center?')) return;
  await api('/api/control/quit','POST');
  window.close();
}
refresh();
setInterval(refresh, 2500);
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

    svr.Get("/api/control/status", [](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lk(g_mtx);
        refreshServiceStatus(g_master);
        refreshServiceStatus(g_slave);
        auto makeSvc = [](const ServiceState& s) {
            return json{
                {"id", s.id},
                {"name", s.name},
                {"port", s.port},
                {"available", s.available},
                {"running", s.running},
                {"pid", s.pid},
                {"work_dir", s.workDir.string()},
                {"web_url", s.id == "master" ? "http://localhost:8500/super_admin" : "http://localhost:8501/admin.html"}
            };
        };
        json logArr = json::array();
        for (const auto& l : g_logs) {
            logArr.push_back({{"ts", l.ts}, {"service", l.service}, {"level", l.level}, {"text", l.text}});
        }
        res.set_content(json({{"success", true}, {"services", {makeSvc(g_master), makeSvc(g_slave)}}, {"logs", logArr}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/start", [](const httplib::Request& req, httplib::Response& res) {
        json body = json::parse(req.body, nullptr, false);
        std::string id = body.value("id", "");
        std::string err;
        bool ok = (id == "master") ? startService(g_master, err) : startService(g_slave, err);
        res.set_content(json({{"success", ok}, {"message", err}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/stop", [](const httplib::Request& req, httplib::Response& res) {
        json body = json::parse(req.body, nullptr, false);
        std::string id = body.value("id", "");
        if (id == "master") stopService(g_master);
        else if (id == "slave") stopService(g_slave);
        res.set_content(json({{"success", true}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/restart", [](const httplib::Request& req, httplib::Response& res) {
        json body = json::parse(req.body, nullptr, false);
        std::string id = body.value("id", "");
        ServiceState& s = (id == "master") ? g_master : g_slave;
        stopService(s);
        Sleep(400);
        std::string err;
        bool ok = startService(s, err);
        res.set_content(json({{"success", ok}, {"message", err}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/start-all", [](const httplib::Request&, httplib::Response& res) {
        std::string err;
        if (g_master.available) startService(g_master, err);
        if (g_slave.available) startService(g_slave, err);
        res.set_content(json({{"success", true}}).dump(), "application/json; charset=utf-8");
    });

    svr.Get("/api/control/ports", [](const httplib::Request&, httplib::Response& res) {
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
        json body = json::parse(req.body, nullptr, false);
        int p = body.value("port", 0);
        PortOwner po = inspectTcpPort(p);
        bool ok = po.inUse ? killPid(po.pid) : true;
        res.set_content(json({{"success", ok}, {"message", ok ? "Đã giải phóng port." : "Không thể dừng tiến trình (thử chạy quyền Admin)."}}).dump(), "application/json; charset=utf-8");
    });

    svr.Get("/api/control/integrity", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(json({{"success", true}, {"results", {checkServiceIntegrity(g_master), checkServiceIntegrity(g_slave)}}}).dump(), "application/json; charset=utf-8");
    });

    svr.Get("/api/control/updates", [](const httplib::Request&, httplib::Response& res) {
        std::string summary = "Không tìm thấy manifest OTA cục bộ.";
        if (g_master.available) {
            fs::path mp = g_master.workDir / "updates" / "manifest.json";
            if (fs::exists(mp)) {
                std::ifstream ifs(mp);
                json m = json::parse(ifs, nullptr, false);
                summary = "Master OTA mới nhất đang phát hành: v" + m.value("version", "?") + " — " + m.value("title", "");
            }
        } else if (g_slave.available) {
            fs::path vp = g_slave.workDir / "version.txt";
            std::string cur = "v2.1.0";
            if (fs::exists(vp)) { std::ifstream ifs(vp); std::getline(ifs, cur); }
            summary = "Slave Store hiện tại: " + cur + ". Mở Trang Quản Trị Quán → Cập nhật OTA để kiểm tra từ Master.";
        }
        res.set_content(json({{"success", true}, {"summary", summary}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/control/clear-logs", [](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lk(g_mtx);
        g_logs.clear();
        res.set_content("{\"success\":true}", "application/json");
    });

    svr.Post("/api/control/quit", [](const httplib::Request&, httplib::Response& res) {
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
    g_nid.hIcon = LoadIconW(nullptr, MAKEINTRESOURCEW(32512));
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
