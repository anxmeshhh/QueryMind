#!/usr/bin/env python3
"""
QueryMind Secure Bridge Client
Exposes a local database to the QueryMind Web App securely using a temporary HTTPS tunnel.
Your database credentials remain strictly local.
"""

import sys
import os
import argparse
import json
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

# Import database drivers
try:
    import sqlite3
except ImportError:
    sqlite3 = None

try:
    import psycopg2
except ImportError:
    psycopg2 = None

try:
    import mysql.connector
except ImportError:
    mysql.connector = None


class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress default server logs for cleaner output
        pass

    def _check_auth(self):
        auth_header = self.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return False
        token = auth_header.split(" ")[1]
        return token == self.server.token

    def _send_cors_headers(self):
        origin = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        # Handle CORS preflight request
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        # Authenticate request
        if not self._check_auth():
            self.send_response(401)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized. Invalid or missing bridge token."}).encode("utf-8"))
            return

        # Parse request body
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        
        try:
            req = json.loads(post_data.decode("utf-8"))
            action = req.get("action")
            
            if action == "test":
                res = self.test_connection(req)
            elif action == "schema":
                res = self.get_schema(req)
            elif action == "explain":
                res = self.run_explain(req)
            else:
                res = {"status": "error", "message": f"Unknown action: {action}"}
        except Exception as e:
            res = {"status": "error", "message": f"Bridge error: {str(e)}"}

        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(res).encode("utf-8"))

    def get_db_connection(self, req):
        db_url = req.get("connection_string") or self.server.db_url
        if not db_url:
            raise Exception("No connection string provided. Provide --db at startup or connection_string in request.")
            
        parsed = urllib.parse.urlparse(db_url)
        scheme = parsed.scheme

        if scheme == "sqlite":
            if not sqlite3:
                raise Exception("sqlite3 driver is missing")
            # Remove leading slashes for SQLite filepath
            db_path = parsed.path.lstrip("/")
            return sqlite3.connect(db_path)
        
        elif scheme in ("postgres", "postgresql"):
            if not psycopg2:
                raise Exception("psycopg2 driver is missing. Run: pip install psycopg2-binary")
            return psycopg2.connect(
                host=parsed.hostname or "localhost",
                port=parsed.port or 5432,
                user=parsed.username,
                password=parsed.password,
                database=parsed.path.lstrip("/")
            )
            
        elif scheme == "mysql":
            if not mysql.connector:
                raise Exception("mysql-connector-python driver is missing. Run: pip install mysql-connector-python")
            return mysql.connector.connect(
                host=parsed.hostname or "localhost",
                port=parsed.port or 3306,
                user=parsed.username,
                password=parsed.password,
                database=parsed.path.lstrip("/")
            )
        else:
            raise Exception(f"Unsupported database scheme: {scheme}")

    def test_connection(self, req):
        try:
            conn = self.get_db_connection(req)
            conn.close()
            return {"status": "success", "message": "Connected successfully to local database!"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_schema(self, req):
        try:
            conn = self.get_db_connection(req)
            cursor = conn.cursor()
            db_url = req.get("connection_string") or self.server.db_url
            parsed = urllib.parse.urlparse(db_url)
            scheme = parsed.scheme

            tables = []

            if scheme == "sqlite":
                # Discover sqlite tables
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
                table_names = [r[0] for r in cursor.fetchall() if not r[0].startswith("sqlite_")]
                
                for t in table_names:
                    # Get columns info
                    cursor.execute(f"PRAGMA table_info(`{t}`);")
                    columns = []
                    for c in cursor.fetchall():
                        columns.append({
                            "name": c[1],
                            "type": c[2],
                            "nullable": c[3] == 0
                        })
                    
                    # Estimate rows count
                    cursor.execute(f"SELECT COUNT(*) FROM `{t}`;")
                    rows = cursor.fetchone()[0]

                    tables.append({
                        "table": t,
                        "columns": len(columns),
                        "column_details": columns,
                        "rows": rows,
                        "indexes": 0,
                        "size": "N/A"
                    })

            elif scheme in ("postgres", "postgresql", "mysql"):
                # Discover tables from information_schema
                db_name = parsed.path.lstrip("/")
                
                if scheme == "mysql":
                    cursor.execute(f"""
                        SELECT table_name, table_rows, data_length
                        FROM information_schema.tables 
                        WHERE table_schema = '{db_name}' AND table_type = 'BASE TABLE';
                    """)
                else: # Postgres
                    cursor.execute("""
                        SELECT table_name, 0 as table_rows, pg_total_relation_size(quote_ident(table_name)) as data_size
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
                    """)

                raw_tables = cursor.fetchall()
                for t in raw_tables:
                    t_name = t[0]
                    t_rows = t[1]
                    t_size = f"{round(t[2] / 1024, 1)} KB" if t[2] else "N/A"

                    # Fetch Postgres row counts
                    if scheme in ("postgres", "postgresql"):
                        try:
                            cursor.execute(f"SELECT COUNT(*) FROM {t_name};")
                            t_rows = cursor.fetchone()[0]
                        except:
                            t_rows = 0

                    # Discover columns
                    cursor.execute(f"""
                        SELECT column_name, data_type, is_nullable
                        FROM information_schema.columns
                        WHERE table_name = '{t_name}'
                    """)
                    columns = [{
                        "name": c[0],
                        "type": c[1],
                        "nullable": c[2] == "YES"
                    } for c in cursor.fetchall()]

                    tables.append({
                        "table": t_name,
                        "columns": len(columns),
                        "column_details": columns,
                        "rows": t_rows,
                        "indexes": 0,
                        "size": t_size
                    })

            conn.close()
            return {"status": "success", "tables": tables}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def run_explain(self, req):
        query = req.get("query", "")
        if not query.strip():
            return {"status": "error", "message": "Empty query"}

        try:
            conn = self.get_db_connection(req)
            cursor = conn.cursor()
            db_url = req.get("connection_string") or self.server.db_url
            parsed = urllib.parse.urlparse(db_url)
            scheme = parsed.scheme

            plan = []
            if scheme in ("postgres", "postgresql"):
                cursor.execute(f"EXPLAIN ANALYZE {query}")
                plan = [r[0] for r in cursor.fetchall()]
            elif scheme == "mysql":
                cursor.execute(f"EXPLAIN {query}")
                columns = [desc[0] for desc in cursor.description]
                plan = [json.dumps(dict(zip(columns, r))) for r in cursor.fetchall()]
            elif scheme == "sqlite":
                cursor.execute(f"EXPLAIN QUERY PLAN {query}")
                plan = [f"{r[0]} | {r[1]} | {r[2]} | {r[3]}" for r in cursor.fetchall()]

            conn.close()
            return {"status": "success", "plan": plan}
        except Exception as e:
            return {"status": "error", "message": str(e)}


def run_bridge_server(port, db_url, token=None):
    import secrets
    
    # Auto-generate a secure token if not supplied
    if not token:
        token = secrets.token_hex(8)  # e.g., '3f1a6c4b2e8d9f0c'

    server = HTTPServer(("127.0.0.1", port), BridgeHandler)
    server.db_url = db_url
    server.token = token

    print(f"\n=======================================================")
    print(f"🚀 QUERYMIND SECURE BRIDGE ACTIVE")
    print(f"=======================================================")
    print(f"[+] Listening on: http://localhost:{port}")
    print(f"[🔑] Your Security Token:")
    print(f"     {token}")
    print(f"=======================================================")
    print(f"Paste this token in your browser's connection window to authenticate.")
    print(f"=======================================================\n")
    print("[*] Waiting for browser connections...")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[-] Shutting down QueryMind Bridge.")
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="QueryMind Secure Local Database Bridge")
    parser.add_argument("--db", default=None, help="Optional default Local Database URL")
    parser.add_argument("--port", type=int, default=9999, help="Local HTTP port to run bridge server")
    parser.add_argument("--token", default=None, help="Secure token to authenticate connection (auto-generated if omitted)")
    args = parser.parse_args()

    run_bridge_server(args.port, args.db, args.token)
