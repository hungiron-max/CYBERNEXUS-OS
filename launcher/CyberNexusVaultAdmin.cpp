#ifdef _WIN32

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shellapi.h>
#include <commdlg.h>

#include "httplib.h"
#include "nlohmann/json.hpp"
#include "auth.hpp"
#include "pos_bcrypt.h"
#include "pin_vault.hpp"
#include "embedded_favicons.hpp"
#include "sqlite3.h"

#include <atomic>
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

constexpr int VAULT_PORT = 8598;
std::mutex g_mtx;
std::atomic<bool> g_unlocked{false};
std::atomic<bool> g_running{true};
fs::path g_baseDir;
fs::path g_masterDbPath;
fs::path g_keyFilePath;
fs::path g_customStoreDbPath;

std::string bcryptHashStr(const std::string& plain) {
    return SaleApp::Backend::AuthService::hashPassword(plain);
}

std::vector<json> querySqlite(const fs::path& dbPath, const std::string& sql) {
    std::vector<json> rows;
    if (!fs::exists(dbPath)) return rows;
    sqlite3* db = nullptr;
    if (sqlite3_open_v2(dbPath.string().c_str(), &db, SQLITE_OPEN_READONLY, nullptr) != SQLITE_OK) return rows;
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) == SQLITE_OK) {
        int cols = sqlite3_column_count(stmt);
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            json r = json::object();
            for (int i = 0; i < cols; ++i) {
                const char* cname = sqlite3_column_name(stmt, i);
                int ctype = sqlite3_column_type(stmt, i);
                if (ctype == SQLITE_INTEGER) r[cname] = sqlite3_column_int64(stmt, i);
                else if (ctype == SQLITE_FLOAT) r[cname] = sqlite3_column_double(stmt, i);
                else if (ctype == SQLITE_NULL) r[cname] = nullptr;
                else {
                    const unsigned char* txt = sqlite3_column_text(stmt, i);
                    r[cname] = txt ? reinterpret_cast<const char*>(txt) : "";
                }
            }
            rows.push_back(r);
        }
        sqlite3_finalize(stmt);
    }
    sqlite3_close(db);
    return rows;
}

bool execSqlite(const fs::path& dbPath, const std::string& sql, const std::vector<std::string>& params, std::string& errOut) {
    if (!fs::exists(dbPath)) { errOut = "Không tìm thấy DB: " + dbPath.string(); return false; }
    sqlite3* db = nullptr;
    if (sqlite3_open_v2(dbPath.string().c_str(), &db, SQLITE_OPEN_READWRITE, nullptr) != SQLITE_OK) {
        errOut = "Không mở được DB (kiểm tra quyền hoặc lock).";
        return false;
    }
    sqlite3_busy_timeout(db, 3000);
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
        errOut = sqlite3_errmsg(db);
        sqlite3_close(db);
        return false;
    }
    for (size_t i = 0; i < params.size(); ++i) {
        sqlite3_bind_text(stmt, static_cast<int>(i + 1), params[i].c_str(), -1, SQLITE_TRANSIENT);
    }
    int rc = sqlite3_step(stmt);
    if (rc != SQLITE_DONE && rc != SQLITE_ROW) {
        errOut = sqlite3_errmsg(db);
        sqlite3_finalize(stmt);
        sqlite3_close(db);
        return false;
    }
    sqlite3_finalize(stmt);
    sqlite3_close(db);
    return true;
}

void discoverPaths() {
    wchar_t buf[MAX_PATH] = {0};
    GetModuleFileNameW(nullptr, buf, MAX_PATH);
    g_baseDir = fs::path(buf).parent_path();
    g_keyFilePath = g_baseDir / "vault_admin.key";
    std::vector<fs::path> masterCandidates = {
        g_baseDir / "database" / "cybernexus_master.db",
        g_baseDir / "master" / "database" / "cybernexus_master.db",
        g_baseDir.parent_path() / "master" / "database" / "cybernexus_master.db"
    };
    for (const auto& c : masterCandidates) {
        if (fs::exists(c)) { g_masterDbPath = fs::weakly_canonical(c); break; }
    }
    std::vector<fs::path> storeCandidates = {
        g_baseDir / "database" / "store_local.db",
        g_baseDir / "slave" / "database" / "store_local.db",
        g_baseDir.parent_path() / "slave" / "database" / "store_local.db"
    };
    for (const auto& c : storeCandidates) {
        if (fs::exists(c)) { g_customStoreDbPath = fs::weakly_canonical(c); break; }
    }
}

void openVaultWindow() {
    std::string url = "http://127.0.0.1:" + std::to_string(VAULT_PORT) + "/";
    const char* edgePaths[] = {
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    };
    for (const char* ep : edgePaths) {
        if (fs::exists(ep)) {
            char localApp[MAX_PATH] = {0};
            GetEnvironmentVariableA("LOCALAPPDATA", localApp, MAX_PATH);
            std::string profileDir = std::string(localApp[0] ? localApp : "C:\\Temp") + "\\CyberNexusVaultEdge";
            std::string args = "--app=" + url + " --window-size=1140,780 --user-data-dir=\"" + profileDir + "\"";
            ShellExecuteA(nullptr, "open", ep, args.c_str(), nullptr, SW_SHOWNORMAL);
            return;
        }
    }
    ShellExecuteA(nullptr, "open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

std::string buildVaultHtml() {
    return R"HTML(<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>CyberNexus Vault Admin (Developer Only)</title>
<link rel="icon" type="image/png" href="/favicon.png?v=20261118">
<link rel="icon" type="image/x-icon" href="/favicon.ico?v=20261118">
<style>
:root{color-scheme:dark;--bg:#090d16;--card:rgba(20,27,45,.86);--border:rgba(255,255,255,.1);--text:#f1f5f9;--muted:#94a3b8;}
*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body{margin:0;background:radial-gradient(circle at 20% 0%,#311042 0%,#090d16 55%);color:var(--text);min-height:100vh;padding:20px}
.wrap{max-width:1080px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px 18px}
.row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.tabs{display:flex;gap:8px}
button{cursor:pointer;border:1px solid var(--border);background:rgba(255,255,255,.07);color:var(--text);padding:7px 12px;border-radius:10px;font-size:12.5px;font-weight:600}
button:hover{background:rgba(255,255,255,.14)}
.btn-primary{background:linear-gradient(135deg,#8b5cf6,#6366f1);border-color:transparent}
.btn-green{background:rgba(16,185,129,.2);color:#6ee7b7;border-color:rgba(16,185,129,.35)}
.btn-amber{background:rgba(245,158,11,.2);color:#fcd34d;border-color:rgba(245,158,11,.35)}
.btn-danger{background:rgba(239,68,68,.2);color:#fca5a5;border-color:rgba(239,68,68,.35)}
input{background:#050811;border:1px solid var(--border);color:var(--text);padding:8px 11px;border-radius:10px;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px}
th,td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left}
th{color:var(--muted);font-size:11px;text-transform:uppercase}
.hidden{display:none}
.badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(56,189,248,.16);color:#7dd3fc}
</style>
</head>
<body>
<div class="wrap">
  <div class="card row">
    <div>
      <div style="font-size:16px;font-weight:800">🔐 CyberNexus Vault Admin <span class="badge">TOOL NỘI BỘ NHÀ PHÁT TRIỂN</span></div>
      <div style="font-size:12px;color:var(--muted)" id="db-info">Đọc, tạo &amp; reset toàn bộ Mật khẩu / PIN 6 số trong hệ thống</div>
    </div>
    <button class="btn-danger" onclick="quitApp()">⏻ Thoát Tool</button>
  </div>

  <div id="lock-screen" class="card" style="max-width:460px;margin:40px auto;width:100%">
    <div style="font-size:15px;font-weight:700;margin-bottom:8px" id="lock-title">Nhập Master Recovery Key để mở khóa</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px" id="lock-sub">Tool chỉ mở khi xác thực khóa riêng của nhà phát triển.</div>
    <input type="password" id="vault-pass" placeholder="Nhập Master Recovery Key..." style="width:100%;margin-bottom:10px" onkeydown="if(event.key==='Enter')unlockVault()" />
    <button class="btn-primary" style="width:100%" onclick="unlockVault()">Mở Khóa Vault</button>
  </div>

  <div id="main-ui" class="hidden" style="display:flex;flex-direction:column;gap:14px">
    <div class="tabs">
      <button class="btn-primary" onclick="showTab('master')">1. Tài Khoản Master</button>
      <button onclick="showTab('tenants')">2. Quán &amp; PIN 6 Số Mặc Định</button>
      <button onclick="showTab('store')">3. Cứu Hộ Offline DB Quán</button>
    </div>

    <div id="tab-master" class="card">
      <div class="row">
        <b>Tài khoản SuperAdmin &amp; Nhân Sự Master</b>
        <button class="btn-green" onclick="createMasterStaff()">+ Tạo Tài Khoản Master</button>
      </div>
      <table><thead><tr><th>ID</th><th>Username</th><th>Họ tên</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody id="tb-master"></tbody></table>
    </div>

    <div id="tab-tenants" class="card hidden">
      <div class="row"><b>Danh sách Quán &amp; PIN Chủ Quán 6 Số Mặc Định</b><button onclick="loadAll()">↻ Làm mới</button></div>
      <table><thead><tr><th>Mã</th><th>Tên Quán</th><th>Email</th><th>PIN Mặc Định (6 số)</th><th>Thao tác</th></tr></thead><tbody id="tb-tenants"></tbody></table>
    </div>

    <div id="tab-store" class="card hidden">
      <div class="row">
        <b>Cứu hộ trực tiếp file <code>store_local.db</code></b>
        <div style="display:flex;gap:8px;flex:1;max-width:620px">
          <input id="store-db-path" style="flex:1" placeholder="Đường dẫn tới store_local.db..." />
          <button class="btn-primary" onclick="loadStoreUsers()">Nạp DB Quán</button>
        </div>
      </div>
      <table><thead><tr><th>ID</th><th>Username</th><th>Họ tên</th><th>Role</th><th>PIN (6 số)</th><th>Cờ 1-lần</th><th>Thao tác</th></tr></thead><tbody id="tb-store"></tbody></table>
    </div>
  </div>
</div>
<script>
async function api(url, method='GET', body=null){
  const o={method,headers:{'Content-Type':'application/json'}};
  if(body) o.body=JSON.stringify(body);
  return (await fetch(url,o)).json();
}
async function checkInit(){
  const s = await api('/api/vault/status');
  if(!s.has_key){
    document.getElementById('lock-title').textContent = 'Thiết lập Master Recovery Key lần đầu';
    document.getElementById('lock-sub').textContent = 'Nhập mật khẩu bảo vệ cho chính Tool Vault Admin này (tối thiểu 6 ký tự).';
  }
  if(s.unlocked){
    document.getElementById('lock-screen').classList.add('hidden');
    document.getElementById('main-ui').classList.remove('hidden');
    document.getElementById('store-db-path').value = s.store_db || '';
    await loadAll();
  }
}
async function unlockVault(){
  const p = document.getElementById('vault-pass').value;
  const r = await api('/api/vault/unlock','POST',{passphrase:p});
  if(!r.success){ alert(r.message||'Sai khóa!'); return; }
  document.getElementById('lock-screen').classList.add('hidden');
  document.getElementById('main-ui').classList.remove('hidden');
  await checkInit();
}
function showTab(name){
  ['master','tenants','store'].forEach(t=>document.getElementById('tab-'+t).classList.toggle('hidden', t!==name));
}
async function loadAll(){
  const d = await api('/api/vault/data');
  if(!d.success) return;
  document.getElementById('db-info').textContent = 'Master DB: ' + (d.master_db||'Chưa tìm thấy');
  const mRows = (d.master_accounts||[]).map(u=>`<tr><td>${u.id}</td><td><b>${u.username}</b></td><td>${u.fullname||''}</td><td>${u.role}</td><td>${u.status}</td>
    <td><button class="btn-amber" onclick="resetMasterPass('${u.kind}',${u.id},'${u.username}')">Đổi Mật Khẩu</button></td></tr>`).join('');
  document.getElementById('tb-master').innerHTML = mRows;
  const tRows = (d.tenants||[]).map(t=>`<tr><td><b>${t.tenant_code}</b></td><td>${t.store_name}</td><td>${t.email||'—'}</td><td><b style="color:#6ee7b7">${t.default_pin||'Chưa sinh'}</b></td>
    <td><button class="btn-green" onclick="regenPin(${t.id})">Sinh / Cấp lại PIN 6 số</button></td></tr>`).join('');
  document.getElementById('tb-tenants').innerHTML = tRows;
  await loadStoreUsers();
}
async function loadStoreUsers(){
  const dbp = document.getElementById('store-db-path').value.trim();
  const d = await api('/api/vault/store-users','POST',{db_path:dbp});
  const rows = (d.users||[]).map(u=>`<tr><td>${u.id}</td><td><b>${u.username}</b></td><td>${u.fullname||''}</td><td>${u.role}</td><td><b>${u.pin_code||''}</b></td><td>${u.pin_must_change||0}</td>
    <td><button class="btn-amber" onclick="resetStoreUser(${u.id},'${u.username}')">Đặt Pass &amp; PIN 6 số</button></td></tr>`).join('');
  document.getElementById('tb-store').innerHTML = rows || '<tr><td colspan="7">Chưa nạp được DB quán.</td></tr>';
}
async function resetMasterPass(kind, id, uname){
  const np = prompt('Nhập mật khẩu mới cho [' + uname + '] (tối thiểu 6 ký tự):');
  if(!np || np.length<6) return;
  const r = await api('/api/vault/reset-master','POST',{kind,id,new_password:np});
  alert(r.message||'Xong');
}
async function createMasterStaff(){
  const u = prompt('Username mới:'); if(!u) return;
  const f = prompt('Họ tên:', u); if(!f) return;
  const p = prompt('Mật khẩu (tối thiểu 6 ký tự):'); if(!p || p.length<6) return;
  const r = await api('/api/vault/create-master-staff','POST',{username:u,fullname:f,password:p});
  alert(r.message||'Xong'); await loadAll();
}
async function regenPin(tid){
  const r = await api('/api/vault/tenant-pin','POST',{tenant_id:tid});
  alert(r.message||'Đã cập nhật'); await loadAll();
}
async function resetStoreUser(uid, uname){
  const np = prompt('Mật khẩu mới cho [' + uname + '] (để trống nếu giữ nguyên):');
  const pin = prompt('Mã PIN 6 số mới cho [' + uname + '] (để trống nếu giữ nguyên):');
  if(!np && !pin) return;
  const dbp = document.getElementById('store-db-path').value.trim();
  const r = await api('/api/vault/reset-store-user','POST',{db_path:dbp,user_id:uid,new_password:np||'',new_pin:pin||''});
  alert(r.message||'Xong'); await loadStoreUsers();
}
async function quitApp(){ await api('/api/vault/quit','POST'); window.close(); }
checkInit();
</script>
</body>
</html>)HTML";
}

} // namespace

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    discoverPaths();
    httplib::Server svr;

    svr.Get("/", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(buildVaultHtml(), "text/html; charset=utf-8");
    });

    svr.Get("/favicon.ico", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(reinterpret_cast<const char*>(CyberNexus::Icons::VAULT_FAVICON_ICO),
                        CyberNexus::Icons::VAULT_FAVICON_ICO_len, "image/x-icon");
    });

    svr.Get("/favicon.png", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(reinterpret_cast<const char*>(CyberNexus::Icons::VAULT_FAVICON_PNG),
                        CyberNexus::Icons::VAULT_FAVICON_PNG_len, "image/png");
    });

    svr.Get("/api/vault/status", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(json({
            {"success", true},
            {"has_key", fs::exists(g_keyFilePath)},
            {"unlocked", g_unlocked.load()},
            {"master_db", g_masterDbPath.string()},
            {"store_db", g_customStoreDbPath.string()}
        }).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/vault/unlock", [](const httplib::Request& req, httplib::Response& res) {
        json body = json::parse(req.body, nullptr, false);
        std::string pass = body.value("passphrase", "");
        if (pass.size() < 6) {
            res.set_content("{\"success\":false,\"message\":\"Key phải có ít nhất 6 ký tự!\"}", "application/json; charset=utf-8");
            return;
        }
        if (!fs::exists(g_keyFilePath)) {
            std::ofstream ofs(g_keyFilePath, std::ios::trunc);
            ofs << bcryptHashStr(pass);
            g_unlocked = true;
            res.set_content("{\"success\":true}", "application/json");
            return;
        }
        std::ifstream ifs(g_keyFilePath);
        std::string stored;
        std::getline(ifs, stored);
        if (pos_bcrypt_checkpw(pass.c_str(), stored.c_str()) == 0) {
            g_unlocked = true;
            res.set_content("{\"success\":true}", "application/json");
        } else {
            res.set_content("{\"success\":false,\"message\":\"Sai Master Recovery Key!\"}", "application/json; charset=utf-8");
        }
    });

    svr.Get("/api/vault/data", [](const httplib::Request&, httplib::Response& res) {
        if (!g_unlocked) { res.status = 403; return; }
        json accounts = json::array();
        auto su = querySqlite(g_masterDbPath, "SELECT setting_value FROM saas_settings WHERE setting_key='super_admin_username' LIMIT 1");
        std::string saUser = su.empty() ? "superadmin" : su[0].value("setting_value", "superadmin");
        accounts.push_back({{"kind", "superadmin"}, {"id", 0}, {"username", saUser}, {"fullname", "Tổng Quản Trị Tối Cao"}, {"role", "super_admin"}, {"status", "active"}});
        for (const auto& r : querySqlite(g_masterDbPath, "SELECT id, username, fullname, role, status FROM saas_staff_users ORDER BY id ASC")) {
            json row = r; row["kind"] = "staff";
            accounts.push_back(row);
        }
        json tenants = json::array();
        for (const auto& t : querySqlite(g_masterDbPath, "SELECT id, tenant_code, store_name, email, license_key, default_pin_enc FROM saas_tenants ORDER BY id ASC")) {
            json row = t;
            row["default_pin"] = CyberNexus::PinVault::decryptPinForLicense(t.value("default_pin_enc", ""), t.value("license_key", ""));
            tenants.push_back(row);
        }
        res.set_content(json({{"success", true}, {"master_db", g_masterDbPath.string()}, {"master_accounts", accounts}, {"tenants", tenants}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/vault/reset-master", [](const httplib::Request& req, httplib::Response& res) {
        if (!g_unlocked) { res.status = 403; return; }
        json body = json::parse(req.body, nullptr, false);
        std::string kind = body.value("kind", "");
        int64_t id = body.value("id", int64_t(0));
        std::string np = body.value("new_password", "");
        std::string h = bcryptHashStr(np);
        std::string err;
        bool ok = false;
        if (kind == "superadmin") {
            ok = execSqlite(g_masterDbPath, "INSERT INTO saas_settings (setting_key, setting_value) VALUES ('super_admin_password_hash', ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value", {h}, err);
        } else {
            ok = execSqlite(g_masterDbPath, "UPDATE saas_staff_users SET password_hash = ? WHERE id = ?", {h, std::to_string(id)}, err);
        }
        res.set_content(json({{"success", ok}, {"message", ok ? "Đã đổi mật khẩu thành công!" : err}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/vault/create-master-staff", [](const httplib::Request& req, httplib::Response& res) {
        if (!g_unlocked) { res.status = 403; return; }
        json body = json::parse(req.body, nullptr, false);
        std::string u = body.value("username", "");
        std::string f = body.value("fullname", u);
        std::string p = body.value("password", "");
        std::string err;
        bool ok = execSqlite(g_masterDbPath,
            "INSERT INTO saas_staff_users (username, password_hash, fullname, role, department, permissions, status) VALUES (?, ?, ?, 'super_admin', 'Quản Trị Tối Cao', '[\"all\"]', 'active')",
            {u, bcryptHashStr(p), f}, err);
        res.set_content(json({{"success", ok}, {"message", ok ? "Đã tạo tài khoản Master mới!" : err}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/vault/tenant-pin", [](const httplib::Request& req, httplib::Response& res) {
        if (!g_unlocked) { res.status = 403; return; }
        json body = json::parse(req.body, nullptr, false);
        int64_t tid = body.value("tenant_id", int64_t(0));
        auto rows = querySqlite(g_masterDbPath, "SELECT license_key FROM saas_tenants WHERE id = " + std::to_string(tid));
        if (rows.empty()) { res.set_content("{\"success\":false,\"message\":\"Không thấy quán\"}", "application/json"); return; }
        std::string lk = rows[0].value("license_key", "");
        std::string pin6 = CyberNexus::PinVault::generateRandomPin6();
        std::string err;
        bool ok = execSqlite(g_masterDbPath, "UPDATE saas_tenants SET default_pin_sha256 = ?, default_pin_enc = ? WHERE id = ?",
                             {SaleApp::Backend::AuthService::sha256(pin6), CyberNexus::PinVault::encryptPinForLicense(pin6, lk), std::to_string(tid)}, err);
        res.set_content(json({{"success", ok}, {"message", ok ? ("PIN 6 số mặc định mới: " + pin6) : err}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/vault/store-users", [](const httplib::Request& req, httplib::Response& res) {
        if (!g_unlocked) { res.status = 403; return; }
        json body = json::parse(req.body, nullptr, false);
        fs::path dbp = body.value("db_path", "");
        if (dbp.empty()) dbp = g_customStoreDbPath;
        auto rows = querySqlite(dbp, "SELECT id, username, fullname, role, pin_code, COALESCE(pin_must_change,0) AS pin_must_change FROM users WHERE status != 'deleted' ORDER BY id ASC");
        res.set_content(json({{"success", true}, {"users", rows}}).dump(), "application/json; charset=utf-8");
    });

    svr.Post("/api/vault/reset-store-user", [](const httplib::Request& req, httplib::Response& res) {
        if (!g_unlocked) { res.status = 403; return; }
        json body = json::parse(req.body, nullptr, false);
        fs::path dbp = body.value("db_path", "");
        int64_t uid = body.value("user_id", int64_t(0));
        std::string np = body.value("new_password", "");
        std::string pin = body.value("new_pin", "");
        std::string err;
        if (!np.empty()) {
            if (!execSqlite(dbp, "UPDATE users SET password = ? WHERE id = ?", {bcryptHashStr(np), std::to_string(uid)}, err)) {
                res.set_content(json({{"success", false}, {"message", err}}).dump(), "application/json; charset=utf-8");
                return;
            }
        }
        if (!pin.empty()) {
            if (!CyberNexus::PinVault::isValidPin6(pin)) {
                res.set_content("{\"success\":false,\"message\":\"PIN phải gồm đúng 6 chữ số!\"}", "application/json; charset=utf-8");
                return;
            }
            if (!execSqlite(dbp, "UPDATE users SET pin_code = ?, pin_must_change = 0 WHERE id = ?", {pin, std::to_string(uid)}, err)) {
                res.set_content(json({{"success", false}, {"message", err}}).dump(), "application/json; charset=utf-8");
                return;
            }
        }
        res.set_content("{\"success\":true,\"message\":\"Đã cập nhật mật khẩu/PIN quán thành công!\"}", "application/json; charset=utf-8");
    });

    svr.Post("/api/vault/quit", [&](const httplib::Request&, httplib::Response& res) {
        res.set_content("{\"success\":true}", "application/json");
        g_running = false;
        std::thread([&]() { Sleep(150); svr.stop(); }).detach();
    });

    std::thread([]() { openVaultWindow(); }).detach();
    svr.listen("127.0.0.1", VAULT_PORT);
    return 0;
}

#endif
