#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CYBERNEXUS OS — PROFESSIONAL 1-CLICK OTA RELEASE BUILDER (OTA-02 / OTA-03)
==========================================================================
Đóng gói bản vá OTA chuẩn sạch:
  1. Ký số ECDSA P-256 CNG cho toàn bộ 3 Plugin DLL bằng cybernexus_master.exe --sign-dll
  2. Cập nhật web_integrity.json (nếu có script generate_web_integrity.py)
  3. Đóng gói archive/<version>/patch.zip gồm Slave + Control Center + 3 DLL/.sig + web/ + locales/
  4. Sinh manifest.json sạch 100% ở trạng thái DRAFT (auto_publish=false, pushed_stores=[]),
     tuyệt đối KHÔNG kế thừa rác pushed_stores từ bản cũ.
  5. Chỉ xuất bản ra patch_latest.zip khi truyền cờ --publish (mặc định giữ DRAFT để test Pilot trước).
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLAVE_DIR = os.path.join(ROOT, "slave")
MASTER_DIR = os.path.join(ROOT, "master")
UPDATES_DIR = os.path.join(MASTER_DIR, "updates")
ARCHIVE_DIR = os.path.join(UPDATES_DIR, "archive")


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def sign_dlls_ecdsa():
    master_exe = os.path.join(MASTER_DIR, "cybernexus_master.exe")
    dlls = [
        os.path.join(SLAVE_DIR, "modules", "libmod_card_payment.dll"),
        os.path.join(SLAVE_DIR, "modules", "libmod_media_stream.dll"),
        os.path.join(SLAVE_DIR, "modules", "libmod_network_qos.dll"),
    ]
    missing = [d for d in dlls if not os.path.exists(d)]
    if missing:
        raise FileNotFoundError(f"Thiếu Plugin DLL: {missing}")
    if not os.path.exists(master_exe):
        raise FileNotFoundError(f"Thiếu {master_exe} để ký số ECDSA P-256 CNG!")

    env = os.environ.copy()
    env["PATH"] = r"C:\msys64\ucrt64\bin;C:\msys64\mingw64\bin;" + env.get("PATH", "")
    res = subprocess.run([master_exe, "--sign-dll"] + dlls, capture_output=True, text=True, env=env)
    if res.returncode != 0:
        raise RuntimeError(f"Ký số ECDSA thất bại:\n{res.stdout}\n{res.stderr}")
    for d in dlls:
        sig = json.load(open(d + ".sig", "r", encoding="utf-8"))
        if not sig.get("ecdsa_sig"):
            raise RuntimeError(f"File {d}.sig thiếu chữ ký ecdsa_sig!")
    print("[ReleaseOTA] Đã ký số ECDSA P-256 CNG hợp lệ cho 3/3 Plugin DLL.")


def collect_files():
    entries = []
    # Core binaries
    slave_exe = os.path.join(SLAVE_DIR, "cybernexus_slave.exe")
    cc_exe = os.path.join(ROOT, "CyberNexus_Control_Center.exe")
    if not os.path.exists(cc_exe):
        cc_exe = os.path.join(ROOT, "build", "CyberNexus_Control_Center.exe")
    if os.path.exists(cc_exe):
        entries.append((cc_exe, "CyberNexus_Control_Center.exe"))
    if os.path.exists(slave_exe):
        entries.append((slave_exe, "cybernexus_slave.exe"))
    else:
        raise FileNotFoundError(f"Thiếu {slave_exe}")

    # 3 Plugin DLLs + .sig
    mod_dir = os.path.join(SLAVE_DIR, "modules")
    for name in sorted(os.listdir(mod_dir)):
        if name.endswith(".dll") or name.endswith(".dll.sig"):
            entries.append((os.path.join(mod_dir, name), f"modules/{name}"))

    # Web assets & locales (loại trừ kho nhạc assets/media, uploads, backups & 4 file Add-on JS đã nhúng trong .dll)
    skip_dirs = {".git", "__pycache__", "node_modules", "media", "uploads", "backups", "tmp"}
    dll_embedded_js = {
        "web/assets/js/admin_media_dsp.js",
        "web/assets/js/pos-jukebox.js",
        "web/assets/js/jukebox-engine.js",
        "web/assets/js/wifi_portal.js",
    }
    for sub in ("web", "locales"):
        base = os.path.join(SLAVE_DIR, sub)
        if not os.path.isdir(base):
            continue
        for r, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            for fn in sorted(files):
                if fn.lower().endswith((".mp3", ".flac", ".ogg", ".m4a", ".mp4", ".db", ".sqlite")):
                    continue
                full = os.path.join(r, fn)
                rel = os.path.relpath(full, SLAVE_DIR).replace("\\", "/")
                if rel in dll_embedded_js:
                    continue
                entries.append((full, rel))
    return entries


def main():
    ap = argparse.ArgumentParser(description="CyberNexus 1-Click Clean OTA Release Builder")
    ap.add_argument("--version", required=True, help="Phiên bản OTA (VD: 2026.11.23.04)")
    ap.add_argument("--title", default="", help="Tiêu đề ngắn gọn của bản phát hành")
    ap.add_argument("--notes", required=True, help="Ghi chú thay đổi (Release Notes)")
    ap.add_argument("--target-tenant", default="", help="Mã quán nếu là bản vá riêng (để trống = Đại trà)")
    ap.add_argument("--publish", action="store_true", help="Duyệt phát hành Đại trà ngay (mặc định: DRAFT chưa đẩy)")
    args = ap.parse_args()

    ver = args.version.strip().lstrip("vV")
    target_tenant = args.target_tenant.strip()
    if args.publish and target_tenant:
        raise ValueError("Không thể --publish đại trà cho bản vá riêng theo quán!")

    out_dir = os.path.join(ARCHIVE_DIR, ver)
    if os.path.exists(os.path.join(out_dir, "patch.zip")):
        raise FileExistsError(f"Phiên bản OTA v{ver} đã tồn tại trong archive/! Quy tắc bảo mật: KHÔNG được ghi đè số phiên bản cũ — hãy tăng số phiên bản mới.")

    sign_dlls_ecdsa()

    # UI-05: Auto-rebuild offline minified Tailwind v3 CSS for Slave & Master
    tw_tool = os.path.join(ROOT, "tools", "tailwind", "build_tailwind.py")
    if os.path.exists(tw_tool):
        subprocess.run([sys.executable, tw_tool], check=True)

    # Regenerate web_integrity.json if tool exists
    web_int_tool = os.path.join(ROOT, "tools", "generate_web_integrity.py")
    if os.path.exists(web_int_tool):
        subprocess.run([sys.executable, web_int_tool], check=False)

    # DOC-14: Auto-refresh QA Architecture Codebase tree stats (file count & line count)
    arch_tool = os.path.join(ROOT, "tools", "refresh_qa_arch_data.py")
    if os.path.exists(arch_tool):
        subprocess.run([sys.executable, arch_tool], check=False)

    entries = collect_files()
    out_dir = os.path.join(ARCHIVE_DIR, ver)
    os.makedirs(out_dir, exist_ok=True)
    zip_path = os.path.join(out_dir, "patch.zip")

    import re as _re
    asset_re = _re.compile(r'((?:src|href)="assets/(?:js|css)/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?(")')
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for src, arcname in entries:
            if arcname.startswith("web/") and arcname.endswith(".html"):
                # ARCH-07: Auto Cache-Busting theo phiên bản OTA để máy quán tự nhận JS/CSS mới không cần Ctrl+F5
                with open(src, "r", encoding="utf-8", errors="ignore") as hf:
                    html_txt = hf.read()
                stamped = asset_re.sub(rf'\1?v={ver}\2', html_txt)
                zf.writestr(arcname, stamped.encode("utf-8"))
            else:
                zf.write(src, arcname)

    zip_sha = sha256_file(zip_path)
    zip_size = os.path.getsize(zip_path)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    manifest = {
        "version": ver,
        "title": args.title or f"CyberNexus POS v{ver}",
        "notes": args.notes,
        "release_notes": args.notes,
        "created_at": now_str,
        "release_date": now_str,
        "target_tenant": target_tenant,
        "release_status": "published" if args.publish else "draft",
        "auto_publish": bool(args.publish and not target_tenant),
        "pushed_stores": ["ALL"] if args.publish else [],
        "sha256": zip_sha,
        "size_bytes": zip_size,
        "files": [arc for _, arc in entries],
    }

    mf_path = os.path.join(out_dir, "manifest.json")
    with open(mf_path, "w", encoding="utf-8") as mf:
        json.dump(manifest, mf, ensure_ascii=False, indent=2)

    if args.publish:
        shutil.copy2(zip_path, os.path.join(UPDATES_DIR, "patch_latest.zip"))
        shutil.copy2(mf_path, os.path.join(UPDATES_DIR, "manifest.json"))

    # OTA-04: Slave local is always the latest dev build -> sync ota_applied_version in slave/database/store_local.db
    local_db = os.path.join(SLAVE_DIR, "database", "store_local.db")
    if os.path.exists(local_db):
        try:
            import sqlite3
            conn = sqlite3.connect(local_db, timeout=5)
            conn.execute(
                "INSERT INTO store_settings (setting_key, setting_value) VALUES ('ota_applied_version', ?) "
                "ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value",
                (ver,)
            )
            conn.commit()
            conn.close()
        except Exception:
            pass

    print(f"[ReleaseOTA] OK v{ver} | status={manifest['release_status'].upper()} | files={len(entries)} | size={zip_size:,} bytes | sha256={zip_sha[:16]}...")


if __name__ == "__main__":
    main()
