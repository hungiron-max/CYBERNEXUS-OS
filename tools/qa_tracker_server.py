#!/usr/bin/env python3
"""Local HTTP server for docs/13_BANG_THEO_DOI_KHUYET_TAT.html with live codebase refresh."""
import http.server
import json
import os
import subprocess
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(ROOT_DIR, "docs")
REFRESH_SCRIPT = os.path.join(ROOT_DIR, "tools", "refresh_qa_arch_data.py")
PORT = int(os.environ.get("QA_TRACKER_PORT", "8599"))


class QATrackerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOCS_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        if self.path.split("?")[0] == "/api/refresh_arch":
            try:
                proc = subprocess.run(
                    [sys.executable, REFRESH_SCRIPT],
                    cwd=ROOT_DIR,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=30,
                )
                if proc.returncode != 0:
                    payload = {
                        "success": False,
                        "error": proc.stderr.strip() or proc.stdout.strip() or f"Exit {proc.returncode}",
                    }
                    self._send_json(500, payload)
                    return

                arch_js = os.path.join(DOCS_DIR, "qa_arch_codebase_data.js")
                generated, files_cnt, total_lines = "", 0, 0
                with open(arch_js, "r", encoding="utf-8") as f:
                    raw = f.read()
                idx = raw.find("{")
                if idx != -1:
                    data = json.loads(raw[idx:].rstrip(";\r\n "))
                    generated = data.get("generated", "")
                    stats = data.get("codebase", {}).get("stats", {})
                    files_cnt = stats.get("files", 0)
                    total_lines = stats.get("total_lines", 0)

                self._send_json(200, {
                    "success": True,
                    "generated": generated,
                    "files": files_cnt,
                    "total_lines": total_lines,
                    "output": proc.stdout.strip(),
                })
            except Exception as exc:
                self._send_json(500, {"success": False, "error": str(exc)})
            return

        self._send_json(404, {"success": False, "error": "Not found"})

    def _send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), QATrackerHandler)
    print(f"[QATrackerServer] Listening on http://127.0.0.1:{PORT}/13_BANG_THEO_DOI_KHUYET_TAT.html", flush=True)
    httpd.serve_forever()
