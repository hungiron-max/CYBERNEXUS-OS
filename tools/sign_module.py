#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CYBERNEXUS OS — MODULE CRYPTOGRAPHIC SIGNING TOOL (ECDSA P-256 CNG v2)
======================================================================
Gọi cybernexus_master.exe --sign-dll để ký số ECDSA P-256 CNG chuẩn v2
cho các Dynamic Plugin DLL. Host Core (PluginManager) đối chiếu .sig trước khi nạp.
======================================================================
"""

import sys
import os
import subprocess

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sign_file(dll_path: str) -> bool:
    if not os.path.exists(dll_path):
        print(f"[Error] Không tìm thấy file: {dll_path}")
        return False

    master_exe = next((p for p in (
        os.path.join(ROOT_DIR, "build", "cybernexus_master.exe"),
        os.path.join(ROOT_DIR, "master", "cybernexus_master.exe"),
    ) if os.path.exists(p)), None)
    if not master_exe:
        print("[Error] Không tìm thấy cybernexus_master.exe để ký ECDSA P-256 v2!")
        return False

    res = subprocess.run([master_exe, "--sign-dll", dll_path], check=False)
    return res.returncode == 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        target = os.path.join(ROOT_DIR, "slave", "modules", "libmod_media_stream.dll")
    else:
        target = sys.argv[1]
    sys.exit(0 if sign_file(target) else 1)
