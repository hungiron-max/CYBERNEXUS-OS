import hashlib
import json
import os
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTS = (".html", ".css", ".js")


def generate_for_web_dir(web_dir: str) -> int:
    if not os.path.isdir(web_dir):
        return 0
    files_map = {}
    for dp, _, fns in os.walk(web_dir):
        for fn in sorted(fns):
            if not fn.endswith(EXTS):
                continue
            fp = os.path.join(dp, fn)
            rel = os.path.relpath(fp, web_dir).replace("\\", "/")
            with open(fp, "rb") as f:
                files_map[rel] = hashlib.sha256(f.read()).hexdigest()
    manifest = {
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "count": len(files_map),
        "files": files_map,
    }
    out_path = os.path.join(web_dir, "web_integrity.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return len(files_map)


if __name__ == "__main__":
    import subprocess
    m_path = os.path.join(ROOT, "master", "web", "web_integrity.json")
    s_path = os.path.join(ROOT, "slave", "web", "web_integrity.json")
    m_cnt = generate_for_web_dir(os.path.join(ROOT, "master", "web"))
    s_cnt = generate_for_web_dir(os.path.join(ROOT, "slave", "web"))
    master_exe = next((p for p in [
        os.path.join(ROOT, "build", "cybernexus_master.exe"),
        os.path.join(ROOT, "master", "cybernexus_master.exe"),
    ] if os.path.exists(p)), None)
    if master_exe:
        subprocess.run([master_exe, "--sign-web", m_path, s_path], check=True)
    print(f"WEB_INTEGRITY_GENERATED: master={m_cnt}, slave={s_cnt}")
