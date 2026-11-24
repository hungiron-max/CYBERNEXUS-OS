#!/usr/bin/env python3
"""Build offline minified Tailwind v3 CSS for Slave and Master web apps."""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CLI = os.path.join(HERE, "tailwindcss.exe")


def build_all():
    if not os.path.exists(CLI):
        print(f"[TailwindBuild] SKIP: {CLI} not found")
        return False

    targets = [
        ("Slave", "tailwind.slave.config.js", os.path.join("..", "..", "slave", "web", "assets", "css", "app-tailwind.min.css")),
        ("Master", "tailwind.master.config.js", os.path.join("..", "..", "master", "web", "assets", "css", "app-tailwind.min.css")),
    ]
    for label, cfg, out_rel in targets:
        cmd = [CLI, "-c", cfg, "-i", "input.css", "-o", out_rel, "--minify"]
        res = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"[TailwindBuild] FAIL ({label}):\n{res.stderr}")
            sys.exit(res.returncode)
        out_abs = os.path.normpath(os.path.join(HERE, out_rel))
        print(f"[TailwindBuild] OK {label}: {os.path.basename(out_abs)} ({os.path.getsize(out_abs):,} bytes)")
    return True


if __name__ == "__main__":
    build_all()
