#!/usr/bin/env python3
"""
CyberNexus Live HTTP Smoke Test (INV-02)
Tests live Slave (127.0.0.1:8501) & Master (127.0.0.1:8500) endpoints with real auth cookies.
"""
import http.cookiejar
import json
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def make_client():
    cj = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def call(opener, url, method="GET", data=None):
    hdrs = {}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with opener.open(req, timeout=6) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def check(cond, label, detail=""):
    tag = "PASS" if cond else "FAIL"
    print(f"  [{tag}] {label}" + (f" -> {detail}" if detail else ""))
    if not cond:
        raise AssertionError(f"Check failed: {label} ({detail})")


def main():
    print("=== 1. SLAVE LIVE SMOKE TEST (127.0.0.1:8501) ===")
    unauth = make_client()
    for ep, payload in [
        ("/api/finance.php?action=save_tax_settings", {"pos_vat_mode": "none"}),
        ("/api/operations.php?action=save_material", {"name": "hack"}),
        ("/api/operations.php?action=save_recipes", {"product_id": 1, "items": []}),
    ]:
        st, _ = call(unauth, "http://127.0.0.1:8501" + ep, "POST", payload)
        check(st in (401, 403), f"SEC-20 unauth blocked {ep}", f"HTTP {st}")

    # Authenticate using local admin username/pin or password
    slave_cli = make_client()
    st, txt = call(slave_cli, "http://127.0.0.1:8501/api/auth?action=login", "POST", {"username": "admin", "password": "123"})
    if st != 200:
        # Try PIN login fallback for dev DB
        st, txt = call(slave_cli, "http://127.0.0.1:8501/api/auth?action=pin_login", "POST", {"pin": "123456"})
    print(f"  [INFO] Slave auth status={st}")

    st, txt = call(slave_cli, "http://127.0.0.1:8501/api/finance.php?action=get_tax_settings")
    j = json.loads(txt)
    check(st == 200 and "pos_vat_mode" in j.get("data", {}), "PAY-06 get_tax_settings", f"HTTP {st}")

    st, txt = call(slave_cli, "http://127.0.0.1:8501/api/operations.php?action=get_bom_matrix")
    j = json.loads(txt)
    check(st == 200 and j.get("success") is True and isinstance(j.get("data"), list), "INV-02 GET get_bom_matrix", f"HTTP {st}, count={len(j.get('data', []))}")

    for asset in ["/assets/js/cn_station_nav.js", "/assets/js/admin_bom_studio.js", "/assets/js/pos-jukebox.js", "/assets/css/liquid-glass.css"]:
        st, txt = call(unauth, "http://127.0.0.1:8501" + asset)
        check(st == 200 and len(txt) > 100, f"Static asset {asset}", f"HTTP {st} ({len(txt)}B)")

    # Verify all 6 Slave HTML files embed cn_station_nav.js
    for pg in ["index.html", "admin.html", "order.html", "kitchen.html", "online_orders.html", "attendance.html"]:
        html_txt = (ROOT / "slave" / "web" / pg).read_text(encoding="utf-8", errors="ignore")
        check("cn_station_nav.js" in html_txt, f"UI-04 {pg} embeds cn_station_nav.js")

    print("\n=== 2. MASTER LIVE SMOKE TEST (127.0.0.1:8500) ===")
    st, txt = call(unauth, "http://127.0.0.1:8500/api/admin/mysql_backup_config")
    check(st in (401, 403), "SYNC-01 Master auth guard", f"HTTP {st}")

    st, txt = call(unauth, "http://127.0.0.1:8500/api/updates/manifest")
    j = json.loads(txt)
    check(st == 200 and bool(j.get("version")), "OTA-04 /api/updates/manifest returns latest published", f"HTTP {st}, version={j.get('version')}")

    print("\nALL_LIVE_SMOKE_TESTS_PASSED")


if __name__ == "__main__":
    main()
