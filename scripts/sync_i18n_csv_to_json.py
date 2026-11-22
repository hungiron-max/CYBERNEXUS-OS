#!/usr/bin/env python3
"""
CyberNexus OS — Multi-Language CSV <-> JSON Localization Compiler (I18N-03 / I18N-07)
Reads docs/SYSTEM_MESSAGES_I18N.csv, preserves baseline runtime namespaces
(common, customer, wifi, api, notif, pos, kds, waiter, admin, login, online, super_admin, cc),
and generates/verifies:
  - slave/web/locales/<lang>.json
  - slave/locales/<lang>.json
  - master/web/locales/<lang>.json
  - master/locales/<lang>.json
  - docs/i18n_studio_data.js (offline JS dataset for 16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html)
"""

import argparse
import csv
import datetime
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "docs", "SYSTEM_MESSAGES_I18N.csv")
SLAVE_WEB_LOCALES_DIR = os.path.join(ROOT, "slave", "web", "locales")
SLAVE_ROOT_LOCALES_DIR = os.path.join(ROOT, "slave", "locales")
MASTER_WEB_LOCALES_DIR = os.path.join(ROOT, "master", "web", "locales")
MASTER_ROOT_LOCALES_DIR = os.path.join(ROOT, "master", "locales")
STUDIO_DATA_JS = os.path.join(ROOT, "docs", "i18n_studio_data.js")

META_COLS = {"group", "key", "source_file", "origin"}
MASTER_ONLY_PREFIXES = ("01_", "02_", "09_", "10_")
SLAVE_ONLY_PREFIXES = ("03_", "04_", "05_", "06_", "07_", "08_", "11_")
BASELINE_SECTIONS = (
    "common", "customer", "wifi", "api", "notif", "pos",
    "kds", "waiter", "admin", "login", "online", "super_admin", "cc",
)


def nest_dict(flat: dict) -> dict:
    tree: dict = {}
    for dotted_key, val in flat.items():
        parts = dotted_key.split(".")
        cur = tree
        for p in parts[:-1]:
            if p not in cur or not isinstance(cur[p], dict):
                cur[p] = {}
            cur = cur[p]
        cur[parts[-1]] = val
    return tree


def col_to_lang(col: str) -> str:
    return "vi" if col == "edited" else col


def load_baseline_sections(root_locales_dir: str, web_locales_dir: str, lang: str) -> dict:
    for candidate_lang in (lang, "en", "vi"):
        for d in (root_locales_dir, web_locales_dir):
            p = os.path.join(d, f"{candidate_lang}.json")
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, dict) and isinstance(data.get("api"), dict):
                        return {k: data[k] for k in BASELINE_SECTIONS if k in data and isinstance(data[k], dict)}
                except Exception:
                    pass
    return {}


def infer_comp_and_field(key: str, grp: str, src: str, ori: str) -> tuple:
    k = key.lower()
    g = grp.lower()
    comp = "api_msg"
    if ".th_" in k or ".col_" in k or "_col" in k:
        comp = "table_col"
    elif ".label_" in k or ".ph_" in k or ".option_" in k or "placeholder" in k or "lbl_" in k:
        comp = "form_label"
    elif ".button_" in k or ".btn_" in k or "button" in k:
        comp = "button"
    elif ".h1_" in k or ".h2_" in k or ".h3_" in k or ".h4_" in k or "modal" in k or "title" in k:
        comp = "modal_title"
    elif k.startswith("receipt.") or "receipt" in g:
        comp = "receipt_tpl"
    elif k.startswith("db.") or "database" in g:
        comp = "db_entity"
    base_src = os.path.basename(src) if src else grp
    short_ori = (ori[:40] + "…") if len(ori) > 40 else ori
    return comp, f"{base_src} • {short_ori or key}"


def collect_data():
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"Missing CSV source: {CSV_PATH}")

    rows_raw = []
    with open(CSV_PATH, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        lang_cols = [c for c in fieldnames if c not in META_COLS]
        langs = [col_to_lang(c) for c in lang_cols]

        per_lang_all = {lg: {} for lg in langs}
        per_lang_slave = {lg: {} for lg in langs}
        per_lang_master = {lg: {} for lg in langs}
        non_empty_counts = {lg: 0 for lg in langs}

        for row in reader:
            grp = (row.get("group") or "").strip()
            key = (row.get("key") or "").strip()
            src = (row.get("source_file") or "").strip()
            ori = (row.get("origin") or "").strip()
            if not key:
                continue

            translations = {}
            vi_val = (row.get("edited") or ori).strip()
            en_val = (row.get("en") or vi_val).strip()

            for c in lang_cols:
                lg = col_to_lang(c)
                raw_val = (row.get(c) or "").strip()
                if raw_val:
                    non_empty_counts[lg] += 1
                if lg == "vi":
                    val = raw_val or ori
                elif lg == "en":
                    val = raw_val or vi_val
                else:
                    val = raw_val or en_val or vi_val
                translations[lg] = val

            comp_type, field_name = infer_comp_and_field(key, grp, src, ori)
            rows_raw.append({
                "group": grp,
                "key": key,
                "comp_type": comp_type,
                "field_name": field_name,
                "source_file": src,
                "origin": ori,
                "translations": translations,
                "raw": {col_to_lang(c): (row.get(c) or "").strip() for c in lang_cols},
                "status": "approved" if en_val else "pending",
            })

            is_shared = key.startswith(("common.", "nav.")) or grp.startswith("00_")
            is_master_only = (not is_shared) and grp.startswith(MASTER_ONLY_PREFIXES)
            is_slave_only = (not is_shared) and grp.startswith(SLAVE_ONLY_PREFIXES)
            for lg in langs:
                val = translations[lg]
                per_lang_all[lg][key] = val
                if not is_master_only:
                    per_lang_slave[lg][key] = val
                if not is_slave_only:
                    per_lang_master[lg][key] = val

    active_langs = [lg for lg in langs if lg in ("vi", "en") or non_empty_counts.get(lg, 0) > 0]
    return rows_raw, langs, active_langs, per_lang_all, per_lang_slave, per_lang_master


def build_json_bytes(flat_scoped: dict, flat_all: dict, baseline: dict, lang: str) -> str:
    payload = {
        "meta": {"lang": lang, "csv_entries": len(flat_all)},
        "_meta": {"lang": lang, "entries": len(flat_scoped)},
    }
    for sec in BASELINE_SECTIONS:
        if sec in baseline:
            payload[sec] = baseline[sec]
    payload["csv_messages"] = dict(flat_all)
    for k, v in nest_dict(flat_scoped).items():
        if k in payload and isinstance(payload[k], dict) and isinstance(v, dict):
            merged = dict(payload[k])
            merged.update(v)
            payload[k] = merged
        elif k not in payload:
            payload[k] = v
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="Verify locale JSON files match CSV without overwriting")
    args = ap.parse_args()

    rows_raw, all_langs, active_langs, all_map, slave_map, master_map = collect_data()

    targets = []
    for lg in active_langs:
        slave_base = load_baseline_sections(SLAVE_ROOT_LOCALES_DIR, SLAVE_WEB_LOCALES_DIR, lg)
        master_base = load_baseline_sections(MASTER_ROOT_LOCALES_DIR, MASTER_WEB_LOCALES_DIR, lg)
        slave_bytes = build_json_bytes(slave_map[lg], all_map[lg], slave_base, lg)
        master_bytes = build_json_bytes(master_map[lg], all_map[lg], master_base, lg)
        targets.append((os.path.join(SLAVE_WEB_LOCALES_DIR, f"{lg}.json"), slave_bytes))
        targets.append((os.path.join(SLAVE_ROOT_LOCALES_DIR, f"{lg}.json"), slave_bytes))
        targets.append((os.path.join(MASTER_WEB_LOCALES_DIR, f"{lg}.json"), master_bytes))
        targets.append((os.path.join(MASTER_ROOT_LOCALES_DIR, f"{lg}.json"), master_bytes))

    studio_payload = {
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "languages": all_langs,
        "rows": rows_raw,
    }
    studio_js = (
        "// Auto-generated by scripts/sync_i18n_csv_to_json.py — Do not edit manually\n"
        "window.I18N_STUDIO_SEED = "
        + json.dumps(studio_payload, ensure_ascii=False, indent=2)
        + ";\n"
    )

    if args.check:
        mismatches = []
        for path, expected in targets:
            if not os.path.exists(path):
                mismatches.append(f"MISSING: {path}")
                continue
            with open(path, "r", encoding="utf-8") as f:
                actual = f.read()
            if actual != expected:
                mismatches.append(f"OUT_OF_SYNC: {path}")
        if mismatches:
            for m in mismatches:
                print(m, file=sys.stderr)
            print("I18N_CHECK_FAILED", file=sys.stderr)
            sys.exit(1)
        print(f"I18N_CHECK_OK csv_rows={len(rows_raw)} json_files={len(targets)}")
        sys.exit(0)

    for d in (SLAVE_WEB_LOCALES_DIR, SLAVE_ROOT_LOCALES_DIR, MASTER_WEB_LOCALES_DIR, MASTER_ROOT_LOCALES_DIR):
        os.makedirs(d, exist_ok=True)
    for path, content in targets:
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
    with open(STUDIO_DATA_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write(studio_js)
    print(f"Synced {len(rows_raw)} i18n entries across {active_langs} ({len(targets)} JSON files) + {STUDIO_DATA_JS}")


if __name__ == "__main__":
    main()
