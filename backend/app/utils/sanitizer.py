"""Input sanitization and validation utilities."""

from app.config import Config

# Dangerous SQL statements that should never be executed
BLOCKED_STATEMENTS = {"DROP", "TRUNCATE", "ALTER", "GRANT", "REVOKE", "SHUTDOWN"}

# Only these are allowed for live database mode
ALLOWED_STATEMENTS = {"SELECT", "EXPLAIN", "WITH", "SHOW", "DESCRIBE"}


def sanitize_sql(sql: str) -> str:
    """Strip and validate SQL input, raise ValueError if dangerous."""
    sql = sql.strip()
    if not sql:
        raise ValueError("SQL query cannot be empty")
    if len(sql) > Config.MAX_QUERY_LENGTH:
        raise ValueError(f"Query too long (max {Config.MAX_QUERY_LENGTH} chars)")

    first_word = sql.split()[0].upper() if sql.split() else ""
    if first_word in BLOCKED_STATEMENTS:
        raise ValueError(f"'{first_word}' statements are not allowed")

    return sql


def sanitize_schema(schema_sql: str) -> str:
    """Validate schema SQL input."""
    if not schema_sql:
        return ""
    schema_sql = schema_sql.strip()
    if len(schema_sql) > Config.MAX_SCHEMA_LENGTH:
        raise ValueError(f"Schema too long (max {Config.MAX_SCHEMA_LENGTH} chars)")
    return schema_sql


def validate_connection_string(conn_str: str) -> str:
    """Validate database connection string format."""
    conn_str = conn_str.strip()
    if not conn_str:
        raise ValueError("Connection string cannot be empty")
    if len(conn_str) > 500:
        raise ValueError("Connection string too long")

    valid_prefixes = ("postgresql://", "postgres://", "mysql://", "sqlite:///")
    if not any(conn_str.startswith(p) for p in valid_prefixes):
        raise ValueError("Unsupported database. Use postgresql://, mysql://, or sqlite:///")

    return conn_str


def is_safe_for_execution(sql: str) -> bool:
    """Check if SQL is safe to execute on a live database (read-only)."""
    first_word = sql.strip().split()[0].upper() if sql.strip().split() else ""
    return first_word in ALLOWED_STATEMENTS


def sanitize_query_placeholders(sql: str) -> str:
    """
    Temporarily replace common parameter placeholders (%s, %d, ?, $1, :name)
    with standard SQL literals so sqlglot can parse the AST without syntax errors.
    """
    import re
    # 1. Replace %s and %d (often used in Python DBAPI)
    processed = re.sub(r'%\s*s\b', "'QM_PARAM'", sql)
    processed = re.sub(r'%\s*d\b', "1", processed)

    # 2. Replace positional ? placeholders
    processed = re.sub(r'\?', "'QM_PARAM'", processed)

    # 3. Replace PostgreSQL positional placeholders like $1, $2, $3...
    processed = re.sub(r'\$\d+', "'QM_PARAM'", processed)

    # 4. Replace named parameters like :email, :password, :id
    # Negative lookbehind for a colon ensures we don't match postgres cast operators (::text)
    processed = re.sub(r'(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)', "'QM_PARAM'", processed)

    return processed
