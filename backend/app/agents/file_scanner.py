"""Agent 1: File Scanner — scans code files for embedded SQL queries."""

import os
from app.utils.sql_patterns import (
    EXTENSION_PATTERNS,
    SQL_STATEMENT_PATTERN,
    looks_like_sql,
)


def scan_files(files: list) -> dict:
    """
    Scan uploaded code files for SQL queries.

    Args:
        files: list of dicts with 'name', 'content' keys

    Returns:
        dict with 'queries' list and 'connection_strings' list
    """
    discovered = []
    connection_strings = []

    for file_info in files:
        name = file_info["name"]
        content = file_info["content"]
        ext = os.path.splitext(name)[1].lower()

        # Handle .sql files — entire file is SQL
        if ext == ".sql":
            for match in SQL_STATEMENT_PATTERN.finditer(content):
                sql = match.group(1).strip()
                if sql and len(sql) > 10:
                    line = content[: match.start()].count("\n") + 1
                    discovered.append({
                        "sql": sql,
                        "file": name,
                        "line": line,
                        "language": "SQL",
                    })
            continue

        # Get patterns for this file type
        patterns = EXTENSION_PATTERNS.get(ext, [])
        if not patterns:
            continue

        for pattern in patterns:
            for match in pattern.finditer(content):
                sql = match.group(1).strip()
                if not sql:
                    continue

                line = content[: match.start()].count("\n") + 1

                # Check if it's a connection string
                if any(
                    sql.startswith(p)
                    for p in ("postgresql://", "postgres://", "mysql://", "sqlite:///")
                ):
                    connection_strings.append({
                        "url": sql,
                        "file": name,
                        "line": line,
                    })
                    continue

                # Validate it looks like SQL
                if looks_like_sql(sql):
                    lang_map = {
                        ".py": "Python",
                        ".js": "JavaScript",
                        ".ts": "TypeScript",
                        ".tsx": "TypeScript",
                        ".jsx": "JavaScript",
                        ".java": "Java",
                        ".env": "Config",
                    }
                    discovered.append({
                        "sql": sql,
                        "file": name,
                        "line": line,
                        "language": lang_map.get(ext, "Unknown"),
                    })

    return {
        "queries": discovered,
        "connection_strings": connection_strings,
    }
