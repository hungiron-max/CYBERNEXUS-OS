import os
import sys
import json
import time
import socket
import shutil
import sqlite3
import tempfile
import subprocess
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]

def find_slave_binary():
    if sys.platform == "win32":
        candidates = [
            os.path.join(ROOT, "build", "Release", "cybernexus_slave.exe"),
            os.path.join(ROOT, "build", "cybernexus_slave.exe"),
            os.path.join(ROOT, "slave", "cybernexus_slave.exe"),
        ]
    else:
        candidates = [
            os.path.join(ROOT, "build", "cybernexus_slave"),
            os.path.join(ROOT, "build", "Release", "cybernexus_slave"),
        ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    raise FileNotFoundError(f"cybernexus_slave binary not found in {candidates}")

def http_req(base_url, path, method="GET", body=None, token=""):
    url = base_url + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="ignore")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}

def run_e2e():
    bin_path = find_slave_binary()
    port = get_free_port()
    base_url = f"http://127.0.0.1:{port}"

    with tempfile.TemporaryDirectory() as tmpdir:
        os.makedirs(os.path.join(tmpdir, "uploads"), exist_ok=True)
        os.makedirs(os.path.join(tmpdir, "modules"), exist_ok=True)
        # Copy signed modules if available
        src_mods = os.path.join(ROOT, "slave", "modules")
        if os.path.isdir(src_mods):
            for f in os.listdir(src_mods):
                if f.endswith((".dll", ".so", ".sig")):
                    shutil.copy2(os.path.join(src_mods, f), os.path.join(tmpdir, "modules", f))

        cfg = {
            "role": "slave",
            "bind_host": "127.0.0.1",
            "port": port,
            "web_dir": os.path.join(ROOT, "slave", "web"),
            "uploads_dir": os.path.join(tmpdir, "uploads"),
            "database_path": os.path.join(tmpdir, "e2e_slave.db"),
        }
        with open(os.path.join(tmpdir, "config.json"), "w", encoding="utf-8") as f:
            json.dump(cfg, f)

        db_path = os.path.join(tmpdir, "e2e_slave.db")
        # Seed minimal clean tables so E2E works on any fresh CI runner (Windows & Linux)
        conn = sqlite3.connect(db_path)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS saas_settings (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS store_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT);
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, user_code TEXT, username TEXT UNIQUE, password_hash TEXT, fullname TEXT, role TEXT, status TEXT DEFAULT 'active', is_online INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, sort_order INTEGER DEFAULT 0, status TEXT DEFAULT 'active');
            CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT, category_id INTEGER DEFAULT 1, sale_price REAL DEFAULT 25000, unit TEXT DEFAULT 'ly', status TEXT DEFAULT 'active', is_available INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS tables_areas (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT, area_type TEXT DEFAULT 'TAI_QUAN', status TEXT DEFAULT 'free', active_order_id INTEGER, guest_count INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')));
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT, order_code TEXT, table_id INTEGER, table_code TEXT,
                customer_name TEXT DEFAULT '', guest_count INTEGER DEFAULT 1, subtotal REAL DEFAULT 0,
                discount_type TEXT DEFAULT 'amount', discount_value REAL DEFAULT 0, discount_amount REAL DEFAULT 0,
                vat_percent REAL DEFAULT 0, vat_amount REAL DEFAULT 0, total_amount REAL DEFAULT 0,
                status TEXT DEFAULT 'pending', payment_status TEXT DEFAULT 'unpaid', kitchen_status TEXT DEFAULT 'pending',
                payment_method TEXT DEFAULT 'cash', cash_received REAL DEFAULT 0, change_amount REAL DEFAULT 0,
                kitchen_ready_at TEXT, served_at TEXT, paid_at TEXT, completed_at TEXT,
                kitchen_user_id INTEGER DEFAULT 0, kitchen_user_name TEXT DEFAULT '',
                served_user_id INTEGER DEFAULT 0, served_user_name TEXT DEFAULT '',
                prep_time_minutes INTEGER DEFAULT 0, deliver_time_minutes INTEGER DEFAULT 0,
                user_id INTEGER DEFAULT 1, user_name TEXT DEFAULT 'Admin', note TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id INTEGER,
                product_code TEXT DEFAULT '', product_name TEXT, quantity INTEGER DEFAULT 1,
                unit_price REAL DEFAULT 0, subtotal REAL DEFAULT 0, toppings_json TEXT DEFAULT '[]', note TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS kitchen_service_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, order_code TEXT, table_code TEXT,
                action TEXT, action_label TEXT, user_id INTEGER, user_name TEXT, user_role TEXT,
                duration_seconds INTEGER DEFAULT 0, note TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime'))
            );
            CREATE TABLE IF NOT EXISTS app_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, order_id INTEGER, table_code TEXT,
                title TEXT, message TEXT, is_read_waiter INTEGER DEFAULT 0, is_read_cashier INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );
            CREATE TABLE IF NOT EXISTS materials (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT, unit TEXT DEFAULT 'kg', stock_qty REAL DEFAULT 10, min_stock_qty REAL DEFAULT 2);
            INSERT INTO users (id, user_code, username, password_hash, fullname, role, status) VALUES (1, 'ADMIN', 'admin', 'admin123', 'Chủ Quán E2E', 'admin', 'active');
            INSERT INTO categories (id, name) VALUES (1, 'Cà Phê');
            INSERT INTO products (id, code, name, category_id, sale_price) VALUES (1, 'CF01', 'Cà Phê Sữa Đá', 1, 29000);
            INSERT INTO tables_areas (id, code, name, area_type) VALUES (1, 'TQ1', 'Bàn Tại Quán 01', 'TAI_QUAN');
        """)
        conn.commit()
        conn.close()

        uploads_dir = os.path.join(tmpdir, "uploads")
        web_dir = os.path.join(ROOT, "slave", "web")
        log_path = os.path.join(tmpdir, "slave_e2e.log")
        log_fp = open(log_path, "w", encoding="utf-8")
        proc = subprocess.Popen(
            [
                bin_path,
                "--host", "127.0.0.1",
                "--port", str(port),
                "--database", db_path,
                "--web", web_dir,
                "--uploads", uploads_dir,
            ],
            cwd=tmpdir,
            stdout=log_fp,
            stderr=subprocess.STDOUT,
        )
        try:
            # Wait for server ready
            ready = False
            for _ in range(40):
                try:
                    st, res = http_req(base_url, "/api/license?action=ping")
                    if st == 200 and res.get("success"):
                        ready = True
                        break
                except Exception:
                    pass
                time.sleep(0.25)
            if not ready:
                log_fp.flush()
                print("--- SLAVE LOG ---\n" + open(log_path, "r", encoding="utf-8", errors="replace").read())
            assert ready, "cybernexus_slave failed to start in time"

            # 1. Login as seeded superadmin
            st, login_res = http_req(
                base_url,
                "/api/auth?action=login",
                method="POST",
                body={"username": "superadmin", "password": "admin123"},
            )
            assert st == 200 and login_res.get("success"), f"Login failed: {st} {login_res}"
            token = login_res.get("token") or login_res.get("data", {}).get("token", "")
            assert token, f"Missing token in login response: {login_res}"

            # 2. Check /api/tables SLA fields
            st, tbl_res = http_req(base_url, "/api/tables", token=token)
            assert st == 200 and tbl_res.get("success"), f"Tables failed: {tbl_res}"
            assert "active_sla" in tbl_res, "Missing active_sla in /api/tables"
            tables = tbl_res.get("data", [])
            assert len(tables) > 0, "Expected seeded tables"
            first_tbl = tables[0]

            # 3. Create order -> Rush -> Kitchen Ready -> Waiter Served -> Submit Review
            st, prods_res = http_req(base_url, "/api/products", token=token)
            assert st == 200 and prods_res.get("success")
            prods = prods_res.get("data", [])
            assert len(prods) > 0, "Expected seeded products"
            p0 = prods[0]

            st, ord_res = http_req(
                base_url,
                "/api/orders?action=save_order",
                method="POST",
                token=token,
                body={
                    "table_id": first_tbl["id"],
                    "table_code": first_tbl["code"],
                    "items": [{"id": p0["id"], "name": p0["name"], "price": p0.get("sale_price", 25000), "quantity": 1}],
                },
            )
            assert st == 200 and ord_res.get("success"), f"save_order failed: {ord_res}"
            order_id = ord_res["order_id"]

            st, rush_res = http_req(base_url, "/api/orders?action=rush_kitchen", method="POST", token=token, body={"order_id": order_id})
            assert st == 200 and rush_res.get("success") and rush_res.get("rush_count") == 1, f"rush_kitchen failed: {rush_res}"

            st, ready_res = http_req(base_url, "/api/orders?action=kitchen_ready", method="POST", token=token, body={"order_id": order_id})
            assert st == 200 and ready_res.get("success"), f"kitchen_ready failed: {ready_res}"

            st, srv_res = http_req(base_url, "/api/orders?action=waiter_served", method="POST", token=token, body={"order_id": order_id})
            assert st == 200 and srv_res.get("success"), f"waiter_served failed: {srv_res}"

            st, rev_res = http_req(base_url, "/api/orders?action=submit_review", method="POST", body={"order_id": order_id, "rating": 5, "comment": "Rất ngon"})
            assert st == 200 and rev_res.get("success"), f"submit_review failed: {rev_res}"

            # 4. Verify KPI Dashboard recorded rush (-5) & 5-star (+5)
            st, kpi_res = http_req(base_url, "/api/operations?action=get_kpi_dashboard", token=token)
            assert st == 200 and kpi_res.get("success"), f"get_kpi_dashboard failed: {kpi_res}"
            assert len(kpi_res.get("recent_reviews", [])) >= 1, "Expected review in KPI dashboard"
            assert len(kpi_res.get("recent_logs", [])) >= 2, "Expected KPI logs"

            # 5. Verify AI Copilot offline summary
            st, cop_res = http_req(base_url, "/api/ai/copilot", method="POST", token=token, body={"question": "Doanh thu hôm nay?", "use_ai": False})
            assert st == 200 and cop_res.get("success") and cop_res.get("answer"), f"copilot failed: {cop_res}"

            # 6. Verify Router QoS config & devices (if mod_network_qos DLL loaded)
            st, net_res = http_req(base_url, "/api/network/devices", token=token)
            if st == 200:
                assert net_res.get("status") == "success"

            # 7. Verify WiFi Marketing Portal Info & Unlock
            st, wp_res = http_req(base_url, "/api/wifi/portal_info")
            assert st == 200 and wp_res.get("success"), f"wifi portal_info failed: {wp_res}"
            st, wu_res = http_req(base_url, "/api/wifi/unlock", method="POST", body={"mode": "free", "customer_name": "Test", "phone": "0909123456"})
            assert st == 200 and wu_res.get("success") and wu_res.get("tier") in ("free", "free_basic"), f"wifi unlock failed: {wu_res}"

            print("E2E_API_TESTS_PASSED")
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except Exception:
                proc.kill()
            try:
                log_fp.close()
            except Exception:
                pass

if __name__ == "__main__":
    run_e2e()
