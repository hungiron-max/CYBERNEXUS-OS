import os
import json
import hashlib
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOD_DIRS = [
    os.path.join(ROOT, "slave", "modules"),
    os.path.join(ROOT, "release", "modules"),
]

def sign_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    file_hash = h.hexdigest()
    payload = f"CBNX_SIG_V1:{file_hash}:SAAS_2026".encode("utf-8")
    sig = hashlib.sha256(payload).hexdigest()
    sig_data = {
        "file": os.path.basename(path),
        "sha256": file_hash,
        "sig": sig,
        "signed_by": "CyberNexus-SuperAdmin",
    }
    sig_path = path + ".sig"
    with open(sig_path, "w", encoding="utf-8") as sf:
        json.dump(sig_data, sf, indent=2)
    return sig_path

if __name__ == "__main__":
    count = 0
    for d in MOD_DIRS:
        if not os.path.isdir(d):
            continue
        for ext in ("*.dll", "*.so"):
            for p in glob.glob(os.path.join(d, ext)):
                sp = sign_file(p)
                print("SIGNED:", sp)
                count += 1
    print(f"TOTAL_SIGNED={count}")
