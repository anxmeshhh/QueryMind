"""Agent 2: Database Connector — read-only connection to live databases."""

import sqlite3
from app.utils.sanitizer import is_safe_for_execution
from app.config import Config


def connect_and_execute(connection_string: str, query: str) -> dict:
    """
    Connect to a database, run EXPLAIN ANALYZE, return results.
    SECURITY: Read-only, query allowlist, timeout enforced.
    """
    if not is_safe_for_execution(query):
        raise ValueError("Only SELECT/EXPLAIN queries are allowed on live databases")

    db_type = _detect_db_type(connection_string)

    if db_type == "postgresql":
        return _execute_postgres(connection_string, query)
    elif db_type == "mysql":
        return _execute_mysql(connection_string, query)
    elif db_type == "sqlite":
        return _execute_sqlite(connection_string, query)
    else:
        raise ValueError(f"Unsupported database type: {db_type}")


def discover_schema(connection_string: str) -> dict:
    """Auto-discover database schema: tables, columns, indexes, row counts."""
    db_type = _detect_db_type(connection_string)

    if db_type == "postgresql":
        return _discover_postgres(connection_string)
    elif db_type == "mysql":
        return _discover_mysql(connection_string)
    elif db_type == "sqlite":
        return _discover_sqlite(connection_string)
    else:
        raise ValueError(f"Unsupported database type: {db_type}")


def test_connection(connection_string: str) -> dict:
    """Test database connection and return basic info."""
    db_type = _detect_db_type(connection_string)
    try:
        if db_type == "postgresql":
            import psycopg2
            conn = psycopg2.connect(connection_string, connect_timeout=Config.DB_CONNECT_TIMEOUT)
            cur = conn.cursor()
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            cur.execute("SELECT current_database();")
            db_name = cur.fetchone()[0]
            cur.close()
            conn.close()
            return {"status": "connected", "type": "PostgreSQL", "version": version.split(",")[0], "database": db_name}

        elif db_type == "mysql":
            import mysql.connector
            params = _parse_mysql_url(connection_string)
            conn = mysql.connector.connect(**params, connect_timeout=Config.DB_CONNECT_TIMEOUT)
            cur = conn.cursor()
            cur.execute("SELECT VERSION();")
            version = cur.fetchone()[0]
            cur.execute("SELECT DATABASE();")
            db_name = cur.fetchone()[0]
            cur.close()
            conn.close()
            return {"status": "connected", "type": "MySQL", "version": version, "database": db_name}

        elif db_type == "sqlite":
            path = connection_string.replace("sqlite:///", "")
            conn = sqlite3.connect(path, timeout=Config.DB_CONNECT_TIMEOUT)
            cur = conn.cursor()
            cur.execute("SELECT sqlite_version();")
            version = cur.fetchone()[0]
            cur.close()
            conn.close()
            return {"status": "connected", "type": "SQLite", "version": version, "database": path.split("/")[-1]}

    except Exception as e:
        return {"status": "error", "error": str(e)}


def _detect_db_type(conn_str: str) -> str:
    if conn_str.startswith(("postgresql://", "postgres://")):
        return "postgresql"
    elif conn_str.startswith("mysql://"):
        return "mysql"
    elif conn_str.startswith("sqlite:///"):
        return "sqlite"
    return "unknown"


def _parse_mysql_url(url: str) -> dict:
    """Parse mysql://user:pass@host:port/db into connection params."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 3306,
        "user": parsed.username or "root",
        "password": parsed.password or "",
        "database": parsed.path.lstrip("/"),
    }


def _execute_postgres(conn_str: str, query: str) -> dict:
    import psycopg2
    conn = psycopg2.connect(conn_str, connect_timeout=Config.DB_CONNECT_TIMEOUT)
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor()
    cur.execute(f"SET statement_timeout = '{Config.DB_QUERY_TIMEOUT}s';")

    explain_query = query.strip().rstrip(";")
    if not explain_query.upper().startswith("EXPLAIN"):
        explain_query = f"EXPLAIN ANALYZE {explain_query}"

    cur.execute(explain_query)
    plan_rows = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return {"plan": plan_rows, "type": "postgresql"}


def _execute_mysql(conn_str: str, query: str) -> dict:
    import mysql.connector
    params = _parse_mysql_url(conn_str)
    conn = mysql.connector.connect(**params, connect_timeout=Config.DB_CONNECT_TIMEOUT)
    cur = conn.cursor()

    explain_query = query.strip().rstrip(";")
    if not explain_query.upper().startswith("EXPLAIN"):
        explain_query = f"EXPLAIN {explain_query}"

    cur.execute(explain_query)
    columns = [desc[0] for desc in cur.description]
    rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    cur.close()
    conn.close()
    return {"plan": rows, "type": "mysql"}


def _execute_sqlite(conn_str: str, query: str) -> dict:
    path = conn_str.replace("sqlite:///", "")
    conn = sqlite3.connect(path, timeout=Config.DB_CONNECT_TIMEOUT)
    cur = conn.cursor()

    explain_query = query.strip().rstrip(";")
    if not explain_query.upper().startswith("EXPLAIN"):
        explain_query = f"EXPLAIN QUERY PLAN {explain_query}"

    cur.execute(explain_query)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return {"plan": [str(row) for row in rows], "type": "sqlite"}


def _discover_postgres(conn_str: str) -> dict:
    import psycopg2
    conn = psycopg2.connect(conn_str, connect_timeout=Config.DB_CONNECT_TIMEOUT)
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor()

    # Get tables
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    table_names = [row[0] for row in cur.fetchall()]

    tables = []
    for tname in table_names:
        # Columns
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position;
        """, (tname,))
        columns = [{"name": r[0], "type": r[1], "nullable": r[2] == "YES"} for r in cur.fetchall()]

        # Row count
        cur.execute(f"SELECT reltuples::bigint FROM pg_class WHERE relname = %s;", (tname,))
        row_count = cur.fetchone()
        row_count = max(0, row_count[0]) if row_count else 0

        # Indexes
        cur.execute("""
            SELECT indexname, indexdef FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = %s;
        """, (tname,))
        indexes = [{"name": r[0], "definition": r[1]} for r in cur.fetchall()]

        # Primary key discovery with safety
        primary_key = []
        try:
            cur.execute("""
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = %s::regclass AND i.indisprimary;
            """, (tname,))
            primary_key = [row[0] for row in cur.fetchall()]
        except Exception:
            try: conn.rollback()
            except: pass

        # Foreign key discovery with safety
        foreign_keys = []
        try:
            cur.execute("""
                SELECT
                    kcu.column_name,
                    ccu.table_name AS ref_table,
                    ccu.column_name AS ref_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = %s;
            """, (tname,))
            foreign_keys = [{"column": r[0], "ref_table": r[1], "ref_column": r[2]} for r in cur.fetchall()]
        except Exception:
            try: conn.rollback()
            except: pass

        # Table size
        cur.execute(f"SELECT pg_size_pretty(pg_total_relation_size(%s));", (tname,))
        size = cur.fetchone()
        size = size[0] if size else "0 bytes"

        tables.append({
            "table": tname,
            "columns": len(columns),
            "column_details": columns,
            "rows": int(row_count),
            "indexes": len(indexes),
            "index_details": indexes,
            "primary_key": primary_key,
            "foreign_keys": foreign_keys,
            "size": size,
        })

    cur.close()
    conn.close()
    return {"tables": tables, "type": "postgresql"}


def _discover_mysql(conn_str: str) -> dict:
    import mysql.connector
    params = _parse_mysql_url(conn_str)
    conn = mysql.connector.connect(**params, connect_timeout=Config.DB_CONNECT_TIMEOUT)
    cur = conn.cursor()
    db = params["database"]

    cur.execute(f"SHOW TABLES FROM `{db}`;")
    table_names = [row[0] for row in cur.fetchall()]

    tables = []
    for tname in table_names:
        cur.execute(f"DESCRIBE `{tname}`;")
        columns = [{"name": r[0], "type": r[1], "nullable": r[2] == "YES"} for r in cur.fetchall()]

        cur.execute(f"SELECT COUNT(*) FROM `{tname}`;")
        row_count = cur.fetchone()[0]

        cur.execute(f"SHOW INDEX FROM `{tname}`;")
        indexes = cur.fetchall()

        tables.append({
            "table": tname,
            "columns": len(columns),
            "column_details": columns,
            "rows": row_count,
            "indexes": len(set(r[2] for r in indexes)) if indexes else 0,
            "size": "N/A",
        })

    cur.close()
    conn.close()
    return {"tables": tables, "type": "mysql"}


def _discover_sqlite(conn_str: str) -> dict:
    path = conn_str.replace("sqlite:///", "")
    conn = sqlite3.connect(path, timeout=Config.DB_CONNECT_TIMEOUT)
    cur = conn.cursor()

    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    table_names = [row[0] for row in cur.fetchall()]

    tables = []
    for tname in table_names:
        cur.execute(f"PRAGMA table_info(`{tname}`);")
        columns = [{"name": r[1], "type": r[2], "nullable": r[3] == 0} for r in cur.fetchall()]

        cur.execute(f"SELECT COUNT(*) FROM `{tname}`;")
        row_count = cur.fetchone()[0]

        cur.execute(f"PRAGMA index_list(`{tname}`);")
        indexes = cur.fetchall()

        tables.append({
            "table": tname,
            "columns": len(columns),
            "column_details": columns,
            "rows": row_count,
            "indexes": len(indexes),
            "size": "N/A",
        })

    cur.close()
    conn.close()
    return {"tables": tables, "type": "sqlite"}
