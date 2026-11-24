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
    assert len(sigs) >= 3, f"Expected >=3 .sig files in slave/modules, found {sigs}"
    verified_dlls = 0
    for sig_name in sigs:
        sig_path = os.path.join(mod_dir, sig_name)
        sig_data = json.load(open(sig_path, "r", encoding="utf-8"))
        has_v2 = bool(sig_data.get("sha256") and sig_data.get("ecdsa_sig") and sig_data.get("version") == 2)
        has_v1 = bool(sig_data.get("sha256") and sig_data.get("sig"))
        assert has_v2 or has_v1, f"Invalid .sig JSON: {sig_name}"
        dll_path = sig_path[:-4]  # strip .sig
        if os.path.exists(dll_path):
            h = hashlib.sha256(open(dll_path, "rb").read()).hexdigest()
            assert sig_data["sha256"] == h, f"SHA256 mismatch for {os.path.basename(dll_path)}"
            if has_v1 and not has_v2:
                expected_sig = hashlib.sha256(f"CBNX_SIG_V1:{h}:SAAS_2026".encode()).hexdigest()
                assert sig_data["sig"] == expected_sig, f"Signature mismatch for {os.path.basename(dll_path)}"
            verified_dlls += 1
    print(f"PASS: {len(sigs)} .sig manifests valid ({verified_dlls} local DLL binaries verified)")

def check_js_syntax():
    js_files = [
        "slave/web/assets/js/admin.js",
        "slave/web/assets/js/admin_inline_ext.js",
        "slave/web/assets/js/pos.js",
        "slave/web/assets/js/pos-jukebox.js",
        "slave/web/assets/js/online_orders.js",
        "slave/web/assets/js/online_orders_page.js",
        "slave/web/assets/js/customer_app.js",
        "slave/web/assets/js/order_waiter.js",
        "slave/web/assets/js/kitchen_kds.js",
        "slave/web/assets/js/wifi_portal.js",
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

def check_frontend_integrity():
    """QA-01: Static guardrails for Tailwind CSS, inline JS handlers, C++ API actions, and duplicate HTML IDs."""
    from collections import Counter

    tw_prefixes = (
        "sm:", "md:", "lg:", "xl:", "2xl:", "hover:", "focus:", "active:", "group-hover:",
        "bg-", "text-", "border-", "from-", "via-", "to-", "p-", "px-", "py-", "pt-", "pb-", "pl-", "pr-",
        "m-", "mx-", "my-", "mt-", "mb-", "ml-", "mr-", "w-", "h-", "min-w-", "max-w-", "min-h-", "max-h-",
        "grid", "col-span-", "flex", "gap-", "space-x-", "space-y-", "rounded", "shadow", "z-",
        "inset-", "top-", "bottom-", "left-", "right-", "overflow-", "truncate", "opacity-",
        "transition", "duration-", "animate-", "cursor-", "items-", "justify-", "shrink", "grow",
    )
    allowed_non_tw = {"bottom-sheet", "border-bottom", "py-0.2", "active:scale-98", "backdrop-blur-xs", "z-1"}

    areas = [
        ("Slave", os.path.join(ROOT, "slave", "web"), [
            os.path.join(ROOT, "slave", "src", "slave_handlers.cpp"),
            os.path.join(ROOT, "slave", "src", "slave_dot6_handlers.cpp"),
            os.path.join(ROOT, "slave", "src", "slave_license_handlers.cpp"),
            os.path.join(ROOT, "slave", "src", "main_slave.cpp"),
        ]),
        ("Master", os.path.join(ROOT, "master", "web"), [
            os.path.join(ROOT, "master", "src", "master_handlers.cpp"),
            os.path.join(ROOT, "master", "src", "master_license.cpp"),
            os.path.join(ROOT, "master", "src", "main_master.cpp"),
        ]),
    ]

    for label, web_dir, cpp_paths in areas:
        css_path = os.path.join(web_dir, "assets", "css", "app-tailwind.min.css")
        css_txt = open(css_path, "r", encoding="utf-8", errors="ignore").read()
        defined_css = {re.sub(r"\\(.)", r"\1", s) for s in re.findall(r"\.((?:\\.|[a-zA-Z0-9_-])+)", css_txt)}

        cpp_txt = "\n".join(open(p, "r", encoding="utf-8", errors="ignore").read() for p in cpp_paths if os.path.exists(p))
        cpp_actions = set(re.findall(r'action\s*==\s*"([a-zA-Z0-9_]+)"', cpp_txt))

        html_files = [os.path.join(web_dir, f) for f in sorted(os.listdir(web_dir)) if f.endswith(".html")]
        js_dir = os.path.join(web_dir, "assets", "js")
        js_files = [os.path.join(js_dir, f) for f in sorted(os.listdir(js_dir)) if f.endswith(".js")] if os.path.exists(js_dir) else []

        all_code = "\n".join(open(p, "r", encoding="utf-8", errors="ignore").read() for p in js_files + html_files)
        defined_methods = set(re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\([^)]*\)\s*\{|:\s*(?:async\s+)?function|\s*=\s*(?:async\s*)?\()", all_code))
        defined_methods |= set(re.findall(r"\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=", all_code))

        missing_tw = []
        missing_methods = []
        missing_actions = []
        dup_ids = []
        broken_assets = []

        for hp in html_files:
            txt = open(hp, "r", encoding="utf-8", errors="ignore").read()
            ids = re.findall(r'(?<![a-zA-Z0-9_-])id\s*=\s*["\']([^"\']+)["\']', txt)
            for k, v in Counter(ids).items():
                if v > 1:
                    dup_ids.append(f"{os.path.basename(hp)}:#{k}({v})")
            for m in re.finditer(r'<(?:script|link|img)\b[^>]+(?:src|href)\s*=\s*["\']([^"\']+)["\']', txt, re.I):
                url = m.group(1).split("?")[0].split("#")[0].strip()
                if not url or url.startswith(("http://", "https://", "//", "data:", "blob:", "javascript:", "${", "/api/")):
                    continue
                if url == "i18n_studio_data.js":
                    continue
                if not os.path.exists(os.path.join(web_dir, url.lstrip("/").replace("/", os.sep))):
                    broken_assets.append(f"{os.path.basename(hp)}:{url}")

        for p in html_files + js_files:
            txt = open(p, "r", encoding="utf-8", errors="ignore").read()
            fn = os.path.basename(p)
            for m in re.finditer(r'class\s*=\s*["\']([^"\'${}]+)["\']', txt):
                for cls in m.group(1).split():
                    if cls in defined_css or cls in allowed_non_tw:
                        continue
                    if not re.match(r"^[a-zA-Z0-9_:\[\]\./-]+$", cls):
                        continue
                    if cls.endswith("-"):
                        continue
                    if "[" in cls or cls.startswith(tw_prefixes):
                        missing_tw.append(f"{fn}:{cls}")
            for m in re.finditer(r'\bon(?:click|change|input|submit)\s*=\s*["\']([A-Z][a-zA-Z0-9_]*)\.([a-zA-Z0-9_]+)\s*\(', txt):
                if m.group(2) not in defined_methods:
                    missing_methods.append(f"{fn}:{m.group(1)}.{m.group(2)}()")
            for m in re.finditer(r'api/[a-zA-Z0-9_.]+\?[^"\'`\s]*\baction=([a-zA-Z0-9_]+)', txt):
                if m.group(1) not in cpp_actions:
                    missing_actions.append(f"{fn}:action={m.group(1)}")

        assert not dup_ids, f"[{label}] Duplicate HTML IDs: {dup_ids[:10]}"
        assert not broken_assets, f"[{label}] Broken local assets: {broken_assets[:10]}"
        assert not missing_methods, f"[{label}] Missing JS handlers: {missing_methods[:10]}"
        assert not missing_actions, f"[{label}] Missing C++ API actions: {missing_actions[:10]}"
        assert not missing_tw, f"[{label}] Missing Tailwind classes in app-tailwind.min.css: {missing_tw[:15]}"
    print("PASS: Frontend integrity verified (0 missing Tailwind, 0 broken handlers, 0 API mismatches, 0 broken assets, 0 duplicate IDs)")


if __name__ == "__main__":
    check_module_sigs()
    check_js_syntax()
    check_frontend_integrity()
    check_ota_package()
    print("ALL_REGRESSION_CHECKS_PASSED")
