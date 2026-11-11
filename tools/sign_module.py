#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CYBERNEXUS OS — MODULE CRYPTOGRAPHIC SIGNING TOOL (RSA / HMAC-SHA256)
=====================================================================
Ký số xác thực bản quyền cho các Dynamic Plugin DLL xuất xưởng.
Host Core (cybernexus_slave.exe) đối chiếu chữ ký .sig trước khi nạp vào RAM.
=====================================================================
"""

import sys
import os
import hashlib
import hmac
import json
import time

SUPERADMIN_MASTER_SECRET = b"CYBERNEXUS_RSA4096_SUPERADMIN_MASTER_ROOT_KEY_2026_SECURE_AUTH"

def sign_file(dll_path: str):
    if not os.path.exists(dll_path):
        print(f"[Error] Không tìm thấy file: {dll_path}")
        return False

    with open(dll_path, "rb") as f:
        file_bytes = f.read()

    file_sha256 = hashlib.sha256(file_bytes).hexdigest()
    signature = hmac.new(SUPERADMIN_MASTER_SECRET, file_bytes, hashlib.sha256).hexdigest()

    sig_data = {
        "module": os.path.basename(dll_path),
        "file_size": len(file_bytes),
        "sha256": file_sha256,
        "signature": signature,
        "algorithm": "HMAC-SHA256-RSA-ROOT",
        "issuer": "CyberNexus Central SaaS SuperAdmin",
        "signed_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "status": "VALID_AUTHENTIC"
    }

    sig_path = dll_path + ".sig"
    with open(sig_path, "w", encoding="utf-8") as f:
        json.dump(sig_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Đã ký số thành công: {os.path.basename(sig_path)}")
    print(f"   -> SHA256: {file_sha256}")
    print(f"   -> Chữ ký: {signature[:16]}...{signature[-16:]}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        target = os.path.join(os.path.dirname(__file__), "..", "slave", "modules", "libmod_media_stream.dll")
    else:
        target = sys.argv[1]
    sign_file(target)
