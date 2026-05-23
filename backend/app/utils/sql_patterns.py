"""Compiled regex patterns for detecting SQL queries in source code files."""

import re

# ─── Python patterns ───────────────────────────────────────
PYTHON_PATTERNS = [
    # cursor.execute("SELECT ...")
    re.compile(
        r'''cursor\s*\.\s*(?:execute|executemany)\s*\(\s*(?:f?["']{1,3})(.*?)(?:["']{1,3})''',
        re.DOTALL | re.IGNORECASE,
    ),
    # db.session.execute(text("SELECT ..."))
    re.compile(
        r'''\.execute\s*\(\s*text\s*\(\s*["'](.*?)["']''',
        re.DOTALL | re.IGNORECASE,
    ),
    # Model.objects.raw("SELECT ...")
    re.compile(
        r'''\.raw\s*\(\s*["'](.*?)["']''',
        re.DOTALL | re.IGNORECASE,
    ),
    # Triple-quoted SQL strings
    re.compile(
        r'''"""((?:SELECT|INSERT|UPDATE|DELETE|WITH|EXPLAIN)\b.*?)"""''',
        re.DOTALL | re.IGNORECASE,
    ),
    re.compile(
        r"""'''((?:SELECT|INSERT|UPDATE|DELETE|WITH|EXPLAIN)\b.*?)'''""",
        re.DOTALL | re.IGNORECASE,
    ),
    # Single/double quoted SQL
    re.compile(
        r'''["']((?:SELECT|INSERT|UPDATE|DELETE|WITH)\s+.*?)["']''',
        re.DOTALL | re.IGNORECASE,
    ),
]

# ─── JavaScript / TypeScript patterns ──────────────────────
JS_PATTERNS = [
    # pool.query("SELECT ...") / connection.execute("SELECT ...")
    re.compile(
        r'''\.(?:query|execute)\s*\(\s*[`"'](.*?)[`"']''',
        re.DOTALL | re.IGNORECASE,
    ),
    # prisma.$queryRaw`SELECT ...`
    re.compile(
        r'''\$queryRaw\s*`(.*?)`''',
        re.DOTALL | re.IGNORECASE,
    ),
    # sequelize.query("SELECT ...")
    re.compile(
        r'''sequelize\.query\s*\(\s*["'](.*?)["']''',
        re.DOTALL | re.IGNORECASE,
    ),
    # Template literal SQL
    re.compile(
        r'''`((?:SELECT|INSERT|UPDATE|DELETE|WITH)\s+.*?)`''',
        re.DOTALL | re.IGNORECASE,
    ),
]

# ─── Java patterns ─────────────────────────────────────────
JAVA_PATTERNS = [
    # stmt.executeQuery("SELECT ...")
    re.compile(
        r'''executeQuery\s*\(\s*"(.*?)"''',
        re.DOTALL | re.IGNORECASE,
    ),
    # @Query("SELECT ...")
    re.compile(
        r'''@Query\s*\(\s*(?:value\s*=\s*)?"(.*?)"''',
        re.DOTALL | re.IGNORECASE,
    ),
]

# ─── Config / ENV patterns ─────────────────────────────────
ENV_PATTERNS = [
    # DATABASE_URL=postgresql://...
    re.compile(
        r'''DATABASE_URL\s*=\s*(.+)''',
        re.IGNORECASE,
    ),
    # Connection URIs
    re.compile(
        r'''((?:postgresql|mysql|sqlite)://\S+)''',
        re.IGNORECASE,
    ),
]

# ─── Raw SQL file patterns ─────────────────────────────────
SQL_STATEMENT_PATTERN = re.compile(
    r'''((?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN)\b[^;]*;?)''',
    re.DOTALL | re.IGNORECASE,
)

# Map file extensions to pattern lists
EXTENSION_PATTERNS = {
    ".py": PYTHON_PATTERNS,
    ".js": JS_PATTERNS,
    ".ts": JS_PATTERNS,
    ".tsx": JS_PATTERNS,
    ".jsx": JS_PATTERNS,
    ".java": JAVA_PATTERNS,
    ".env": ENV_PATTERNS,
}

# SQL keywords for validation
SQL_KEYWORDS = {"SELECT", "INSERT", "UPDATE", "DELETE", "WITH", "EXPLAIN", "CREATE", "ALTER", "DROP"}

def looks_like_sql(text: str) -> bool:
    """Check if a string looks like a SQL statement."""
    stripped = text.strip().upper()
    return any(stripped.startswith(kw) for kw in SQL_KEYWORDS) and len(text) > 10
