import os
import re
import json
import hashlib
import zipfile
import tempfile
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def check_module_sigs():
    mod_dir = os.path.join(ROOT, "slave", "modules")
    sigs = [f for f in os.listdir(mod_dir) if f.endswith(".sig")]
    assert len(sigs) >= 4, f"Expected >=4 .sig files in slave/modules, found {sigs}"
    verified_dlls = 0
    for sig_name in sigs:
        sig_path = os.path.join(mod_dir, sig_name)
        sig_data = json.load(open(sig_path, "r", encoding="utf-8"))
        assert sig_data.get("sha256") and sig_data.get("sig"), f"Invalid .sig JSON: {sig_name}"
        dll_path = sig_path[:-4]  # strip .sig
        if os.path.exists(dll_path):
            h = hashlib.sha256(open(dll_path, "rb").read()).hexdigest()
            expected_sig = hashlib.sha256(f"CBNX_SIG_V1:{h}:SAAS_2026".encode()).hexdigest()
            assert sig_data["sha256"] == h, f"SHA256 mismatch for {os.path.basename(dll_path)}"
            assert sig_data["sig"] == expected_sig, f"Signature mismatch for {os.path.basename(dll_path)}"
            verified_dlls += 1
    print(f"PASS: {len(sigs)} .sig manifests valid ({verified_dlls} local DLL binaries verified)")

def check_js_syntax():
    js_files = [
        "slave/web/assets/js/admin.js",
        "slave/web/assets/js/pos.js",
        "slave/web/assets/js/online_orders.js",
        "master/web/assets/js/super_admin.js",
    ]
    for rel in js_files:
        p = os.path.join(ROOT, rel.replace("/", os.sep))
        r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
        assert r.returncode == 0, f"JS syntax error in {rel}: {r.stderr}"
    html_files = [
        "slave/web/order.html",
        "slave/web/kitchen.html",
        "slave/web/customer.html",
        "slave/web/wifi.html",
    ]
    for rel in html_files:
        p = os.path.join(ROOT, rel.replace("/", os.sep))
        txt = open(p, "r", encoding="utf-8").read()
        for idx, blk in enumerate(re.findall(r"<script(?:\s+[^>]*)?>(.*?)</script>", txt, re.S)):
            if not blk.strip():
                continue
            tmp = os.path.join(tempfile.gettempdir(), f"reg_{os.path.basename(p)}_{idx}.js")
            open(tmp, "w", encoding="utf-8").write(blk)
            r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
            assert r.returncode == 0, f"Inline JS error in {rel} script#{idx}: {r.stderr}"
    print("PASS: All JS & HTML inline script syntax verified")

def check_ota_package():
    mf_path = os.path.join(ROOT, "master", "updates", "manifest.json")
    zip_path = os.path.join(ROOT, "master", "updates", "patch_latest.zip")
    mf = json.load(open(mf_path, "r", encoding="utf-8"))
    assert mf.get("version"), "Missing version in manifest.json"
    with zipfile.ZipFile(zip_path, "r") as zf:
        names = set(zf.namelist())
        for f in mf.get("files", []):
            assert f in names, f"Missing {f} in patch_latest.zip"
    print(f"PASS: OTA manifest & zip verified (v{mf['version']})")

if __name__ == "__main__":
    check_module_sigs()
    check_js_syntax()
    check_ota_package()
    print("ALL_REGRESSION_CHECKS_PASSED")
