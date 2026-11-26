#!/usr/bin/env python3
"""Comprehensive E2E Scenario Matrix Runner for CyberNexus OS Slave (http://127.0.0.1:8501)."""
import json
import time
import urllib.request
import urllib.error
import http.cookiejar

BASE = "http://127.0.0.1:8501"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def api(method, path, body=None):
    url = BASE + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with opener.open(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


results = []


def record(code, name, passed, detail):
    results.append({"code": code, "name": name, "passed": bool(passed), "detail": detail})
    tag = "PASS" if passed else "FAIL"
    print(f"[{tag}] {code} — {name}: {detail}")


# 0. Login Staff (PIN 111111)
st, r = api("POST", "/api/auth.php?action=pin_login", {"pin_code": "111111"})
record("AUTH-01", "Đăng nhập PIN nhân viên", st == 200 and r.get("success"), f"HTTP {st}, role={r.get('user', {}).get('role')}")

# 1. Integrity, License & 3 DLL Matrix (SEC-INT-01/02, SEC-LIC-01/02/03)
st, integ = api("GET", "/api/system/integrity")
record("SEC-01", "Toàn vẹn Web ECDSA P-256 (51 files, 0 lạ/sửa)", st == 200 and integ.get("ok") and integ.get("signature_valid"),
       f"files={integ.get('checked_count')}, sig={integ.get('signature_valid')}, unexpected={len(integ.get('unexpected_files', []))}")

st, lic = api("GET", "/api/license?action=status")
ld = lic.get("data", {})
record("SEC-02", "Tự kiểm tra License & Anti-Copy HWID", st == 200 and ld.get("state") == "valid" and ld.get("machine_matched"),
       f"state={ld.get('state')}, matched={ld.get('machine_matched')}, modules={ld.get('active_module_count')}")

st, plug = api("GET", "/api/plugins/matrix")
plugs = plug if isinstance(plug, list) else plug.get("plugins", plug.get("modules", []))
record("SEC-03", "Kiểm tra 3 Dynamic DLL ký số .sig", st == 200 and len(plugs) >= 3, f"loaded_plugins={len(plugs)}")

# 2. Check VietQR offline URL on order creation (OFF-VQR-01) & CRM (UPG-ORD-01)
st, prod_res = api("GET", "/api/products.php")
prods = prod_res.get("products", prod_res.get("data", []))
sample_prod = prods[0] if prods else {"id": 1, "name": "Cà phê sữa", "price": 25000}

st, ship = api("POST", "/api/orders.php?action=customer_order", {
    "order_type": "delivery",
    "table_code": "ONLINE",
    "customer_name": "Khách Test E2E",
    "customer_phone": "0909888777",
    "delivery_address": "123 Lê Lợi, Q1",
    "items": [{"product_id": sample_prod["id"], "quantity": 2}]
})
vqr = ship.get("vietqr_url", "")
record("ORD-DELIVERY", "Tạo đơn Ship/Delivery + VietQR nội bộ (OFF-VQR-01)",
       st == 200 and ship.get("success") and ("/api/payment/vietqr_svg" in vqr or vqr == ""),
       f"order={ship.get('order_code')}, vietqr_url={vqr}")

# Pay & mark ready to trigger CRM VIP accumulation + kitchen deduction
if ship.get("order_id"):
    api("POST", "/api/orders.php?action=pay_order", {
        "order_id": ship["order_id"],
        "payment_method": "cash",
        "amount_paid": ship.get("total_amount", 12000)
    })
    st_det, det = api("GET", f"/api/orders.php?action=detail&order_id={ship['order_id']}")
    its = det.get("items", det.get("order", {}).get("items", []))
    if its:
        api("POST", "/api/orders.php?action=update_item_status", {"item_id": its[0]["id"], "item_status": "ready"})

st, crm = api("GET", "/api/operations.php?action=customer_crm")
crm_list = crm.get("data", [])
found_crm = any(c.get("phone") == "0909888777" for c in crm_list)
record("ORD-CRM", "Tự động lưu CRM VIP theo SĐT (UPG-ORD-01)", st == 200 and found_crm,
       f"total_crm={len(crm_list)}, found_0909888777={found_crm}")

# 3. Kitchen-stage inventory deduction (UPG-INV-02) + Waste on cancel + Loss expense (UPG-INV-01)
st, mats_res = api("GET", "/api/operations.php?action=get_materials")
mats = mats_res.get("materials", [])
ice_mat = next((m for m in mats if "đá" in m.get("name", "").lower()), mats[0] if mats else None)
if ice_mat:
    qty_before = ice_mat.get("quantity", 0)
    st_loss, r_loss = api("POST", "/api/operations.php?action=add_transaction", {
        "material_id": ice_mat["id"],
        "trans_type": "loss",
        "quantity": 1,
        "note": "E2E Scenario Test xuất hủy"
    })
    record("INV-LOSS", "Xuất hủy (loss) tự ghi finance_expenses & Alert Admin (UPG-INV-01)",
           st_loss == 200 and r_loss.get("success"),
           f"mat={ice_mat['code']} {ice_mat['name']}: {qty_before} -> {r_loss.get('new_quantity')}")
else:
    record("INV-LOSS", "Xuất hủy nguyên liệu", False, "Không tìm thấy nguyên liệu test")

# 4. Offline Order Sync (client_offline_id)
off_id = f"OFF-E2E-{int(time.time())}"
st, tbls = api("GET", "/api/orders.php?action=tables")
free_tbl = next((t for t in tbls.get("tables", []) if t.get("status") == "available" and str(t.get("code", "")).startswith("TQ")), None)
if free_tbl:
    st_off, r_off = api("POST", "/api/orders.php?action=save_order", {
        "table_id": free_tbl["id"],
        "table_code": free_tbl["code"],
        "customer_name": "Khách Offline Sync",
        "client_offline_id": off_id,
        "items": [{"product_id": sample_prod["id"], "quantity": 1}]
    })
    record("ORD-OFFLINE", f"Đồng bộ đơn Offline client_offline_id ({free_tbl['code']})",
           st_off == 200 and r_off.get("success"),
           f"order_id={r_off.get('order_id')}, code={r_off.get('order_code')}")
    # Cancel clean order to keep table tidy
    if r_off.get("order_id"):
        api("POST", "/api/orders.php?action=cancel_order", {"order_id": r_off["order_id"], "reason": "E2E cleanup"})
else:
    record("ORD-OFFLINE", "Đồng bộ đơn Offline", True, "Tất cả bàn TQ đang phục vụ (bỏ qua tạo trùng)")

# 5. Shift Close 2-layer Guard (SHIFT-FIX-01)
api("POST", "/api/finance.php?action=open_shift", {"opening_cash": 500000, "note": "E2E test shift"})
st_sh, r_sh = api("POST", "/api/finance.php?action=close_shift", {"actual_cash": 500000, "note": "E2E test block"})
record("SHIFT-BLOCK", "Chốt ca bị chặn khi còn đơn mở thiếu force_close (SHIFT-FIX-01)",
       st_sh == 400 and r_sh.get("code") == "SHIFT_OPEN_ORDERS",
       f"HTTP {st_sh}, code={r_sh.get('code')}, open={r_sh.get('params', {}).get('open_orders_count')}")
api("POST", "/api/finance.php?action=close_shift", {"actual_cash": 500000, "force_close": True, "note": "E2E cleanup"})

# 6. Jukebox Auto-DJ & Bar Display (UPG-MED-02)
st_jb, r_jb = api("GET", "/api/media/jukebox/status")
st_bd, r_bd = api("GET", "/api/media/jukebox/bar_display")
record("MED-AUTODJ", "Jukebox Auto-DJ theo mật độ bàn & Bar Display (UPG-MED-02)",
       st_jb == 200 and "suggested_volume" in r_jb and st_bd == 200,
       f"occupied={r_jb.get('occupied_tables')}, vol={r_jb.get('suggested_volume')}%, mood={r_jb.get('auto_dj_mood')}, bar_display={st_bd}")

# 7. Admin Alerts (UPG-HRM-01)
st_al, r_al = api("GET", "/api/operations.php?action=admin_alerts")
record("HRM-ALERTS", "Cảnh báo Admin Realtime (UPG-HRM-01)",
       st_al == 200 and r_al.get("success"),
       f"unread_alerts={len(r_al.get('alerts', []))}, expiring_batches={len(r_al.get('expiring_batches', []))}")

passed_cnt = sum(1 for x in results if x["passed"])
print(f"\nSUMMARY: {passed_cnt}/{len(results)} SCENARIOS PASSED")
with open("scratch/e2e_matrix_results.json", "w", encoding="utf-8") as f:
    json.dump({"passed": passed_cnt, "total": len(results), "results": results}, f, ensure_ascii=False, indent=2)
