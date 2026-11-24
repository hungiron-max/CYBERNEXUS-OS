#!/usr/bin/env python3
"""
CyberNexus Master On-Demand SQLite -> MySQL Backup & Provisioning Worker (SYNC-01)
Supports MySQL 8.x & MariaDB via PyMySQL, mysql-connector-python, or mysql.exe CLI.
On-Demand Only: invoked exclusively by Master Server when SuperAdmin triggers Provision / Verify / Sync.
"""
import argparse
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path


def sanitize_ident(name: str, max_len: int = 48) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_]", "_", str(name or "").strip().lower())
    clean = re.sub(r"_+", "_", clean).strip("_")
    if not clean or not clean[0].isalpha():
        clean = "cn_" + clean
    return clean[:max_len]


def sql_escape(val) -> str:
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "1" if val else "0"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (bytes, bytearray)):
        return "X'" + val.hex() + "'"
    s = str(val)
    s = s.replace("\\", "\\\\").replace("'", "\\'").replace("\0", "").replace("\r", "\\r").replace("\n", "\\n")
    return "'" + s + "'"


class MysqlDriver:
    def __init__(self, host: str, port: int, user: str, password: str, database: str = ""):
        self.host = host or "127.0.0.1"
        self.port = int(port or 3306)
        self.user = user or "root"
        self.password = password or ""
        self.database = database or ""
        self.mode = None
        self.conn = None
        self.mysql_bin = self._find_mysql_cli()

        try:
            import pymysql  # type: ignore
            self.conn = pymysql.connect(
                host=self.host, port=self.port, user=self.user, password=self.password,
                database=self.database or None, charset="utf8mb4", autocommit=True,
                connect_timeout=8
            )
            self.mode = "pymysql"
            return
        except ImportError:
            pass
        except Exception as e:
            raise RuntimeError(f"PyMySQL connection failed: {e}")

        try:
            import mysql.connector  # type: ignore
            self.conn = mysql.connector.connect(
                host=self.host, port=self.port, user=self.user, password=self.password,
                database=self.database or None, charset="utf8mb4", autocommit=True,
                connection_timeout=8
            )
            self.mode = "mysql_connector"
            return
        except ImportError:
            pass
        except Exception as e:
            raise RuntimeError(f"mysql-connector failed: {e}")

        if self.mysql_bin:
            self.mode = "cli"
            return

        raise RuntimeError(
            "Không tìm thấy driver MySQL (pymysql / mysql-connector-python) hoặc mysql.exe trên máy chủ Master! "
            "Hãy cài 'pip install pymysql' hoặc thêm mysql.exe vào PATH."
        )

    @staticmethod
    def _find_mysql_cli() -> str:
        p = shutil.which("mysql")
        if p:
            return p
        candidates = [
            r"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe",
            r"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
            r"C:\Program Files\MariaDB 11.4\bin\mysql.exe",
            r"C:\Program Files\MariaDB 10.11\bin\mysql.exe",
            r"C:\xampp\mysql\bin\mysql.exe",
            r"C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysql.exe",
        ]
        for c in candidates:
            if os.path.isfile(c):
                return c
        return ""

    def execute_sql_script(self, sql_script: str, db_name: str = "") -> str:
        target_db = db_name or self.database
        if self.mode in ("pymysql", "mysql_connector"):
            cur = self.conn.cursor()
            if target_db:
                cur.execute(f"USE `{sanitize_ident(target_db)}`")
            out_lines = []
            for stmt in [s.strip() for s in sql_script.split(";\n") if s.strip()]:
                cur.execute(stmt)
                if cur.description:
                    for row in cur.fetchall():
                        out_lines.append("\t".join("" if v is None else str(v) for v in row))
            cur.close()
            return "\n".join(out_lines)

        cmd = [
            self.mysql_bin,
            f"--host={self.host}",
            f"--port={self.port}",
            f"--user={self.user}",
            "--default-character-set=utf8mb4",
            "--batch",
            "--skip-column-names",
        ]
        if target_db:
            cmd.append(sanitize_ident(target_db))
        env = os.environ.copy()
        if self.password:
            env["MYSQL_PWD"] = self.password
        proc = subprocess.run(
            cmd, input=sql_script.encode("utf-8"),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, timeout=180
        )
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="replace").strip()
            raise RuntimeError(err or f"mysql CLI exited with code {proc.returncode}")
        return proc.stdout.decode("utf-8", errors="replace").strip()

    def close(self):
        if self.conn:
            try:
                self.conn.close()
            except Exception:
                pass


def map_sqlite_type(col_type: str, is_pk: bool) -> str:
    t = (col_type or "").upper()
    if is_pk and "INT" in t:
        return "BIGINT"
    if "INT" in t:
        return "BIGINT"
    if any(k in t for k in ("REAL", "FLOA", "DOUB", "NUM", "DEC")):
        return "DOUBLE"
    if "BLOB" in t:
        return "LONGBLOB"
    if is_pk:
        return "VARCHAR(191)"
    return "LONGTEXT"


def cmd_test(drv: MysqlDriver):
    ver = drv.execute_sql_script("SELECT VERSION();\n")
    return {"success": True, "driver": drv.mode, "version": ver.strip(), "message": f"Kết nối MySQL thành công ({ver.strip()} via {drv.mode})!"}


def cmd_provision(drv: MysqlDriver, schema: str, store_user: str, store_pass: str):
    schema = sanitize_ident(schema, 56)
    store_user = sanitize_ident(store_user, 32)
    if not store_pass:
        store_pass = "123456"

    drv.execute_sql_script(f"CREATE DATABASE IF NOT EXISTS `{schema}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n")

    upgraded_pass = False
    final_pass = store_pass
    try:
        drv.execute_sql_script(
            f"CREATE USER IF NOT EXISTS '{store_user}'@'localhost' IDENTIFIED BY {sql_escape(final_pass)};\n"
            f"ALTER USER '{store_user}'@'localhost' IDENTIFIED BY {sql_escape(final_pass)};\n"
        )
    except RuntimeError as e:
        if "1819" in str(e) or "policy" in str(e).lower():
            final_pass = f"CN@{store_pass}#{store_user.upper()}"
            upgraded_pass = True
            drv.execute_sql_script(
                f"CREATE USER IF NOT EXISTS '{store_user}'@'localhost' IDENTIFIED BY {sql_escape(final_pass)};\n"
                f"ALTER USER '{store_user}'@'localhost' IDENTIFIED BY {sql_escape(final_pass)};\n"
            )
        else:
            raise

    drv.execute_sql_script(
        f"GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP ON `{schema}`.* TO '{store_user}'@'localhost';\n"
        f"FLUSH PRIVILEGES;\n"
    )
    return {
        "success": True,
        "schema": schema,
        "mysql_user": f"{store_user}@localhost",
        "password_policy_upgraded": upgraded_pass,
        "message": (
            f"Đã khởi tạo schema `{schema}` và user `{store_user}@localhost`!"
            + (" (MySQL policy yêu cầu mật khẩu mạnh -> đã dùng định dạng CN@<PIN>#<CODE>)" if upgraded_pass else " (Mật khẩu khởi tạo = PIN mặc định của quán)")
        ),
    }


def cmd_import(drv: MysqlDriver, schema: str, sqlite_path: str):
    schema = sanitize_ident(schema, 56)
    if not os.path.isfile(sqlite_path):
        raise RuntimeError(f"Không tìm thấy file SQLite snapshot: {sqlite_path}")

    drv.execute_sql_script(f"CREATE DATABASE IF NOT EXISTS `{schema}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n")
    sconn = sqlite3.connect(sqlite_path)
    scur = sconn.cursor()

    tables = [
        r[0] for r in scur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
    ]

    tables_synced = 0
    rows_synced = 0
    table_counts = {}

    for tbl in tables:
        safe_tbl = sanitize_ident(tbl, 60)
        cols_info = scur.execute(f'PRAGMA table_info("{tbl}")').fetchall()
        if not cols_info:
            continue
        col_defs = []
        col_names = []
        pk_cols = []
        for cid, cname, ctype, notnull, dflt, pk in cols_info:
            sc = sanitize_ident(cname, 60)
            col_names.append((cname, sc))
            mtype = map_sqlite_type(ctype, bool(pk))
            col_defs.append(f"`{sc}` {mtype} NULL")
            if pk:
                pk_cols.append(f"`{sc}`")

        pk_clause = f", PRIMARY KEY ({', '.join(pk_cols)})" if len(pk_cols) == 1 else ""
        ddl = (
            f"SET FOREIGN_KEY_CHECKS = 0;\n"
            f"DROP TABLE IF EXISTS `{safe_tbl}`;\n"
            f"CREATE TABLE `{safe_tbl}` ({', '.join(col_defs)}{pk_clause}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n"
        )
        drv.execute_sql_script(ddl, db_name=schema)

        raw_cols_sql = ", ".join(f'"{c[0]}"' for c in col_names)
        mysql_cols_sql = ", ".join(f"`{c[1]}`" for c in col_names)
        rows = scur.execute(f'SELECT {raw_cols_sql} FROM "{tbl}"').fetchall()
        batch_size = 200
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            vals_sql = ",\n".join(
                "(" + ", ".join(sql_escape(v) for v in row) + ")"
                for row in batch
            )
            ins = f"SET FOREIGN_KEY_CHECKS = 0;\nINSERT INTO `{safe_tbl}` ({mysql_cols_sql}) VALUES\n{vals_sql};\n"
            drv.execute_sql_script(ins, db_name=schema)

        tables_synced += 1
        rows_synced += len(rows)
        table_counts[safe_tbl] = len(rows)

    drv.execute_sql_script("SET FOREIGN_KEY_CHECKS = 1;\n", db_name=schema)
    sconn.close()
    return {
        "success": True,
        "schema": schema,
        "tables_synced": tables_synced,
        "rows_synced": rows_synced,
        "table_counts": table_counts,
        "message": f"Đã đồng bộ {tables_synced} bảng ({rows_synced} dòng) vào MySQL schema `{schema}`!",
    }


def cmd_verify(drv: MysqlDriver, schema: str, slave_stats_json: str):
    schema = sanitize_ident(schema, 56)
    slave_counts = {}
    if slave_stats_json:
        try:
            data = json.loads(slave_stats_json)
            if isinstance(data, dict):
                slave_counts = data.get("tables", data)
        except Exception:
            pass

    out = drv.execute_sql_script(
        f"SELECT table_name FROM information_schema.tables WHERE table_schema = {sql_escape(schema)} ORDER BY table_name;\n"
    )
    mysql_tables = [line.strip() for line in out.splitlines() if line.strip()]
    mysql_counts = {}
    for t in mysql_tables:
        cnt_str = drv.execute_sql_script(f"SELECT COUNT(*) FROM `{sanitize_ident(t)}`;\n", db_name=schema)
        try:
            mysql_counts[t] = int(cnt_str.strip().splitlines()[0])
        except Exception:
            mysql_counts[t] = 0

    diffs = []
    all_keys = sorted(set(mysql_counts.keys()) | set(slave_counts.keys()))
    for k in all_keys:
        sc = int(slave_counts.get(k, 0) or 0)
        mc = int(mysql_counts.get(k, 0) or 0)
        if sc != mc:
            diffs.append({"table": k, "slave_rows": sc, "mysql_rows": mc, "delta": sc - mc})

    return {
        "success": True,
        "schema": schema,
        "in_sync": len(diffs) == 0 and len(mysql_tables) > 0,
        "mysql_table_count": len(mysql_tables),
        "mysql_counts": mysql_counts,
        "slave_counts": slave_counts,
        "diffs": diffs,
        "message": (
            f"Schema `{schema}` khớp 100% ({len(mysql_tables)} bảng)!"
            if (len(diffs) == 0 and len(mysql_tables) > 0)
            else f"Phát hiện lệch {len(diffs)} bảng giữa Slave và Master MySQL `{schema}` — nên bấm Đồng bộ ngay."
        ),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["test", "provision", "import", "verify"])
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=3306)
    ap.add_argument("--user", default="root")
    ap.add_argument("--password", default="")
    ap.add_argument("--schema", default="")
    ap.add_argument("--store-user", default="")
    ap.add_argument("--store-pass", default="")
    ap.add_argument("--sqlite", default="")
    ap.add_argument("--slave-stats", default="")
    args = ap.parse_args()

    drv = None
    try:
        drv = MysqlDriver(args.host, args.port, args.user, args.password)
        if args.action == "test":
            res = cmd_test(drv)
        elif args.action == "provision":
            res = cmd_provision(drv, args.schema, args.store_user, args.store_pass)
        elif args.action == "import":
            res = cmd_import(drv, args.schema, args.sqlite)
        else:
            res = cmd_verify(drv, args.schema, args.slave_stats)
        print(json.dumps(res, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "message": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        if drv:
            drv.close()


if __name__ == "__main__":
    main()
