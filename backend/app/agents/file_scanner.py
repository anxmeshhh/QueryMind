"""Agent 7: File Scanner — scans code files for embedded SQL queries and schema definitions."""

import os
import re
from app.utils.sql_patterns import (
    EXTENSION_PATTERNS,
    SQL_STATEMENT_PATTERN,
    looks_like_sql,
)

# ── Schema DDL patterns ──────────────────────────────────────
CREATE_TABLE_PATTERN = re.compile(
    r"(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"']?\w+[`\"']?\s*\([^;]+\)\s*;?)",
    re.DOTALL | re.IGNORECASE,
)
CREATE_INDEX_PATTERN = re.compile(
    r"(CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+ON\s+\w+\s*\([^)]+\)\s*;?)",
    re.DOTALL | re.IGNORECASE,
)
ALTER_TABLE_PATTERN = re.compile(
    r"(ALTER\s+TABLE\s+\w+\s+(?:ADD|DROP|MODIFY|ALTER)\s+[^;]+;?)",
    re.DOTALL | re.IGNORECASE,
)

# ── ORM Model Detection ─────────────────────────────────────
# SQLAlchemy: Column(Integer, primary_key=True)
SQLALCHEMY_MODEL = re.compile(
    r"class\s+(\w+)\s*\(.*?(?:db\.Model|Base|DeclarativeBase).*?\):",
    re.IGNORECASE,
)
SQLALCHEMY_COLUMN = re.compile(
    r"(\w+)\s*=\s*(?:db\.)?Column\s*\(\s*([\w.]+)",
    re.IGNORECASE,
)

# Django: models.CharField(max_length=100)
DJANGO_MODEL = re.compile(
    r"class\s+(\w+)\s*\(\s*models\.Model\s*\):",
    re.IGNORECASE,
)
DJANGO_FIELD = re.compile(
    r"(\w+)\s*=\s*models\.\s*(\w+Field)",
    re.IGNORECASE,
)

# Prisma: model User { ... }
PRISMA_MODEL = re.compile(
    r"model\s+(\w+)\s*\{([^}]+)\}",
    re.DOTALL,
)


def scan_files(files: list) -> dict:
    """
    Scan uploaded code files for SQL queries and schema definitions.

    Args:
        files: list of dicts with 'name', 'content' keys

    Returns:
        dict with 'queries', 'connection_strings', 'schema_ddl', 'orm_models', 'file_stats'
    """
    discovered = []
    connection_strings = []
    schema_ddl = []       # Raw CREATE TABLE / CREATE INDEX / ALTER TABLE statements
    orm_models = []       # Detected ORM model definitions
    file_stats = []       # Per-file statistics

    for file_info in files:
        name = file_info["name"]
        content = file_info["content"]
        ext = os.path.splitext(name)[1].lower()
        line_count = content.count("\n") + 1

        file_queries = 0
        file_schemas = 0

        # ── Extract Schema DDL from any file ─────────────────
        for match in CREATE_TABLE_PATTERN.finditer(content):
            ddl = match.group(1).strip()
            line = content[: match.start()].count("\n") + 1
            schema_ddl.append({
                "ddl": ddl,
                "type": "CREATE TABLE",
                "file": name,
                "line": line,
            })
            file_schemas += 1

        for match in CREATE_INDEX_PATTERN.finditer(content):
            ddl = match.group(1).strip()
            line = content[: match.start()].count("\n") + 1
            schema_ddl.append({
                "ddl": ddl,
                "type": "CREATE INDEX",
                "file": name,
                "line": line,
            })
            file_schemas += 1

        for match in ALTER_TABLE_PATTERN.finditer(content):
            ddl = match.group(1).strip()
            line = content[: match.start()].count("\n") + 1
            schema_ddl.append({
                "ddl": ddl,
                "type": "ALTER TABLE",
                "file": name,
                "line": line,
            })
            file_schemas += 1

        # ── Detect ORM Models ────────────────────────────────
        if ext == ".py":
            orm_models.extend(_detect_sqlalchemy_models(content, name))
            orm_models.extend(_detect_django_models(content, name))
        elif ext in (".ts", ".tsx", ".js", ".jsx"):
            orm_models.extend(_detect_prisma_models(content, name))

        # ── Handle .sql files — entire file is SQL ───────────
        if ext == ".sql":
            for match in SQL_STATEMENT_PATTERN.finditer(content):
                sql = match.group(1).strip()
                if sql and len(sql) > 10:
                    line = content[: match.start()].count("\n") + 1
                    # Skip DDL statements (already captured above)
                    upper = sql.strip().upper()
                    if upper.startswith(("CREATE", "ALTER", "DROP")):
                        continue
                    discovered.append({
                        "sql": sql,
                        "file": name,
                        "line": line,
                        "language": "SQL",
                    })
                    file_queries += 1
            file_stats.append({
                "name": name, "ext": ext, "lines": line_count,
                "queries": file_queries, "schemas": file_schemas,
            })
            continue

        # ── Get patterns for this file type ──────────────────
        patterns = EXTENSION_PATTERNS.get(ext, [])
        if not patterns:
            file_stats.append({
                "name": name, "ext": ext, "lines": line_count,
                "queries": 0, "schemas": file_schemas,
            })
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
                        ".go": "Go",
                        ".rb": "Ruby",
                        ".php": "PHP",
                    }
                    discovered.append({
                        "sql": sql,
                        "file": name,
                        "line": line,
                        "language": lang_map.get(ext, "Unknown"),
                    })
                    file_queries += 1

        file_stats.append({
            "name": name, "ext": ext, "lines": line_count,
            "queries": file_queries, "schemas": file_schemas,
        })

    return {
        "queries": discovered,
        "connection_strings": connection_strings,
        "schema_ddl": schema_ddl,
        "orm_models": orm_models,
        "file_stats": file_stats,
    }


def _detect_sqlalchemy_models(content: str, filename: str) -> list:
    """Detect SQLAlchemy model classes and their columns."""
    models = []
    for model_match in SQLALCHEMY_MODEL.finditer(content):
        model_name = model_match.group(1)
        # Find the class body
        start = model_match.end()
        # Get indented block after class declaration
        lines = content[start:].split("\n")
        columns = []
        for line in lines:
            col_match = SQLALCHEMY_COLUMN.search(line)
            if col_match:
                columns.append({
                    "name": col_match.group(1),
                    "type": col_match.group(2),
                })
            # Stop at next class or function at same indent level
            if line.strip() and not line.startswith((" ", "\t")) and len(columns) > 0:
                break

        if columns:
            models.append({
                "name": model_name,
                "orm": "SQLAlchemy",
                "columns": columns,
                "file": filename,
                "line": content[: model_match.start()].count("\n") + 1,
            })
    return models


def _detect_django_models(content: str, filename: str) -> list:
    """Detect Django model classes and their fields."""
    models = []
    for model_match in DJANGO_MODEL.finditer(content):
        model_name = model_match.group(1)
        start = model_match.end()
        lines = content[start:].split("\n")
        columns = []
        for line in lines:
            field_match = DJANGO_FIELD.search(line)
            if field_match:
                columns.append({
                    "name": field_match.group(1),
                    "type": field_match.group(2),
                })
            if line.strip() and not line.startswith((" ", "\t")) and len(columns) > 0:
                break

        if columns:
            models.append({
                "name": model_name,
                "orm": "Django",
                "columns": columns,
                "file": filename,
                "line": content[: model_match.start()].count("\n") + 1,
            })
    return models


def _detect_prisma_models(content: str, filename: str) -> list:
    """Detect Prisma model definitions."""
    models = []
    for match in PRISMA_MODEL.finditer(content):
        model_name = match.group(1)
        body = match.group(2)
        columns = []
        for line in body.strip().split("\n"):
            parts = line.strip().split()
            if len(parts) >= 2 and not parts[0].startswith(("//", "@", "@@")):
                columns.append({
                    "name": parts[0],
                    "type": parts[1],
                })

        if columns:
            models.append({
                "name": model_name,
                "orm": "Prisma",
                "columns": columns,
                "file": filename,
                "line": content[: match.start()].count("\n") + 1,
            })
    return models
