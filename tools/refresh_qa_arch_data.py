#!/usr/bin/env python3
"""
CyberNexus QA Architecture & Codebase Data Refresher (DOC-14)
Re-scans the live repository and updates docs/qa_arch_codebase_data.js
with accurate file count, line count, byte size, symbols, APIs, tables, and latest OTA version,
while preserving all curated architecture notes & file roles.
"""
import json
import os
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCH_JS = ROOT / "docs" / "qa_arch_codebase_data.js"
TRACKER_JS = ROOT / "docs" / "qa_tracker_data.js"

SCAN_DIRS = ["shared", "slave/src", "slave/web", "master/src", "master/web", "modules", "launcher", "tools", "tests"]
SKIP_DIRS = {".git", "__pycache__", "node_modules", "build", "vendor", "third_party", "media", "uploads", "backups", "updates", "archive", "tmp", "dist"}
VALID_EXTS = {".cpp", ".c", ".hpp", ".h", ".js", ".html", ".css", ".py", ".rc"}
SKIP_SUFFIXES = (".min.js", ".min.css", ".map")
SKIP_FILES = {"sqlite3.c", "sqlite3.h", "sqlite3ext.h", "httplib.h", "json.hpp"}

LANG_MAP = {
    ".cpp": "C++", ".c": "C", ".hpp": "C++ Header", ".h": "C/C++ Header",
    ".js": "JavaScript", ".html": "HTML", ".css": "CSS", ".py": "Python", ".rc": "Windows RC"
}

AUTO_ROLES = {
    "slave/web/assets/js/admin_bom_studio.js": "BOM Studio tập trung (INV-01): thiết lập định mức theo đơn vị gốc ml/g/cái, nhân bản công thức, nhập quy đổi 1.5L/1L -> ml, xuất hủy & kiểm kê hao hụt.",
    "slave/web/assets/js/cn_station_nav.js": "Module điều hướng chuyển trạm dùng chung cho toàn bộ 6 trang Slave (UI-04): 1 thứ tự cố định, lọc tự động theo role & license.",
    "master/web/assets/js/super_admin_mysql_backup.js": "Giao diện Master điều khiển sao lưu & đồng bộ On-Demand SQLite -> MySQL theo từng quán (SYNC-01).",
    "tools/mysql_backup_sync.py": "Worker Python trên Master thực hiện test kết nối, khởi tạo schema/user cô lập từng quán, đồng bộ SQLite -> MySQL và đối soát On-Demand (SYNC-01).",
    "tools/release_ota.py": "Công cụ đóng gói OTA 1-Click chuẩn hóa: ký số ECDSA P-256 CNG, sinh web_integrity, auto cache-busting ?v=<ota>, tự cập nhật cây mã nguồn và cấm ghi đè version cũ.",
    "tools/refresh_qa_arch_data.py": "Script tự động quét lại toàn bộ mã nguồn dự án và cập nhật chính xác số file/dòng code vào docs/qa_arch_codebase_data.js (DOC-14)."
}


def extract_meta(text: str, ext: str):
    apis = sorted(set(re.findall(r'["\'](/api/[a-zA-Z0-9_./-]+)["\']', text)))[:15]
    tables = sorted(set(re.findall(r'(?:FROM|INTO|UPDATE|CREATE TABLE IF NOT EXISTS)\s+([a-z][a-z0-9_]{2,})', text, re.I)))[:15]
    symbols = []
    if ext in (".cpp", ".c", ".hpp", ".h"):
        symbols = sorted(set(re.findall(r'\b(?:class|struct)\s+([A-Z][A-Za-z0-9_]+)|::([a-zA-Z_][A-Za-z0-9_]*)\s*\(', text)))
        symbols = [a or b for a, b in symbols if (a or b)][:12]
    elif ext == ".js":
        symbols = sorted(set(re.findall(r'(?:async\s+)?([a-zA-Z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{', text)))
        symbols = [s for s in symbols if s not in ("if", "for", "while", "switch", "catch", "function")][:12]
    elif ext == ".py":
        symbols = sorted(set(re.findall(r'^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(', text, re.M)))[:12]
    return symbols, apis, tables


def collect_live_files(existing_by_path: dict):
    entries = []
    seen = set()

    def add_file(fp: Path):
        rel = fp.relative_to(ROOT).as_posix()
        if rel in seen:
            return
        seen.add(rel)
        try:
            raw = fp.read_bytes()
            txt = raw.decode("utf-8", errors="ignore")
        except Exception:
            return
        lines = len(txt.splitlines())
        bsize = len(raw)
        top_folder = "(root)" if "/" not in rel else rel.split("/")[0] + "/"
        ext = fp.suffix.lower()
        lang = "CMake" if fp.name == "CMakeLists.txt" else LANG_MAP.get(ext, ext.lstrip(".").upper() or "Text")
        prev = existing_by_path.get(rel, {})
        symbols, apis, tables = extract_meta(txt, ext)
        role = prev.get("role") or AUTO_ROLES.get(rel) or f"Mã nguồn {lang} thuộc phân hệ {top_folder}"
        entries.append({
            "path": rel,
            "folder": top_folder,
            "lang": lang,
            "lines": lines,
            "bytes": bsize,
            "role": role,
            "symbols": symbols if symbols else prev.get("symbols", []),
            "deps": prev.get("deps", []),
            "apis": apis if apis else prev.get("apis", []),
            "tables": tables if tables else prev.get("tables", []),
        })

    cm = ROOT / "CMakeLists.txt"
    if cm.is_file():
        add_file(cm)

    for rel_dir in SCAN_DIRS:
        base = ROOT / rel_dir
        if not base.is_dir():
            continue
        for r, dirs, files in os.walk(base):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
            for fn in sorted(files):
                low = fn.lower()
                if low in SKIP_FILES or any(low.endswith(sfx) for sfx in SKIP_SUFFIXES):
                    continue
                fp = Path(r) / fn
                if fp.suffix.lower() in VALID_EXTS or fn == "CMakeLists.txt":
                    add_file(fp)

    entries.sort(key=lambda x: (x["folder"] != "(root)", x["path"]))
    return entries


def main():
    text = ARCH_JS.read_text(encoding="utf-8")
    m = re.match(r"^(window\.QA_ARCH_CODEBASE\s*=\s*)(\{.*\})(;?\s*)$", text, re.S)
    if not m:
        raise SystemExit("Cannot parse docs/qa_arch_codebase_data.js")
    prefix, body, suffix = m.groups()
    data = json.loads(body)

    # Read latest OTA from qa_tracker_data.js if available
    latest_ota = data.get("arch", {}).get("overview", {}).get("ota", "")
    if TRACKER_JS.is_file():
        tt = TRACKER_JS.read_text(encoding="utf-8")
        tm = re.match(r"^window\.QA_TRACKER_DATA\s*=\s*(\{.*\});?\s*$", tt, re.S)
        if tm:
            td = json.loads(tm.group(1))
            latest_ota = td.get("meta", {}).get("latest_ota") or latest_ota

    existing_files = {f["path"]: f for f in data.get("codebase", {}).get("files", []) if "path" in f}
    live_files = collect_live_files(existing_files)
    total_lines = sum(f["lines"] for f in live_files)
    folders = len(set(f["folder"] for f in live_files))

    now_vn = datetime.now().strftime("%d/%m/%Y %H:%M")
    data["generated"] = now_vn
    if "arch" in data and "overview" in data["arch"] and latest_ota:
        data["arch"]["overview"]["ota"] = latest_ota

    cb = data.setdefault("codebase", {})
    cb["files"] = live_files
    st = cb.setdefault("stats", {})
    st["files"] = len(live_files)
    st["total_lines"] = total_lines
    st["folders"] = folders

    out = prefix + json.dumps(data, ensure_ascii=False, indent=1) + (suffix if suffix.strip() else ";\n")
    ARCH_JS.write_text(out, encoding="utf-8")
    print(f"[RefreshQAArch] Updated qa_arch_codebase_data.js: {len(live_files)} files · {total_lines:,} lines · {folders} folders · OTA={latest_ota}")


if __name__ == "__main__":
    main()
