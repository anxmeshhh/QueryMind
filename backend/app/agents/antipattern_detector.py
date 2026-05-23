"""Agent 5: Anti-Pattern Detector — 20 rule-based SQL anti-pattern detection."""

import re
import sqlglot
from sqlglot import exp


RULES = []

def rule(rule_id, name, severity):
    """Decorator to register anti-pattern detection rules."""
    def decorator(func):
        RULES.append({"id": rule_id, "name": name, "severity": severity, "check": func})
        return func
    return decorator


@rule(1, "SELECT * usage", "medium")
def check_select_star(sql, parsed, metadata):
    if any(c["name"] == "*" for c in metadata.get("columns", [])):
        tables = len(metadata.get("tables", []))
        return {
            "message": f"SELECT * fetches all columns from {tables} table(s) — wastes I/O and memory",
            "suggestion": "Specify only the columns you need: SELECT col1, col2, ...",
        }

@rule(2, "Missing WHERE clause", "critical")
def check_missing_where(sql, parsed, metadata):
    if metadata.get("query_type") == "SELECT" and not metadata.get("conditions") and not metadata.get("has_aggregation"):
        return {
            "message": "SELECT without WHERE clause will scan the entire table",
            "suggestion": "Add a WHERE clause to filter results, or add LIMIT to cap rows",
        }

@rule(3, "Leading wildcard LIKE", "critical")
def check_leading_wildcard(sql, parsed, metadata):
    like_pattern = re.search(r"LIKE\s+['\"]%", sql, re.IGNORECASE)
    if like_pattern:
        return {
            "message": "Leading wildcard in LIKE (e.g., '%value') prevents index usage — causes full table scan",
            "suggestion": "Use a reverse index, full-text search, or restructure the query",
        }

@rule(4, "Functions on indexed columns", "critical")
def check_functions_on_columns(sql, parsed, metadata):
    patterns = [
        r"WHERE\s+\w+\s*\(\s*\w+\.",
        r"WHERE\s+(?:UPPER|LOWER|TRIM|YEAR|MONTH|DATE|CAST)\s*\(",
    ]
    for pat in patterns:
        if re.search(pat, sql, re.IGNORECASE):
            return {
                "message": "Applying functions to columns in WHERE prevents index usage",
                "suggestion": "Use SARGable predicates — filter on the raw column value instead",
            }

@rule(5, "Implicit JOIN syntax", "medium")
def check_implicit_join(sql, parsed, metadata):
    if metadata.get("implicit_joins"):
        return {
            "message": "Comma-separated tables in FROM is implicit JOIN — harder to read and error-prone",
            "suggestion": "Use explicit JOIN ... ON syntax for clarity and to prevent cartesian products",
        }

@rule(6, "Correlated subquery", "critical")
def check_correlated_subquery(sql, parsed, metadata):
    if metadata.get("subqueries", 0) > 0:
        # Check if subquery references outer table
        subquery_text = re.findall(r"\(\s*SELECT\s+.*?\)", sql, re.DOTALL | re.IGNORECASE)
        if subquery_text:
            outer_tables = [t["alias"] for t in metadata.get("tables", [])]
            for sq in subquery_text:
                if any(t + "." in sq for t in outer_tables if t):
                    return {
                        "message": "Correlated subquery executes for every row in the outer query — extremely slow",
                        "suggestion": "Convert to a JOIN or use a CTE (WITH clause) instead",
                    }

@rule(7, "Excessive OR conditions", "medium")
def check_or_chains(sql, parsed, metadata):
    or_count = sql.upper().count(" OR ")
    if or_count >= 3:
        return {
            "message": f"Found {or_count} OR conditions — may prevent optimizer from using indexes",
            "suggestion": "Replace OR chains with IN (...) or use UNION ALL for better index usage",
        }

@rule(8, "NOT IN with subquery", "medium")
def check_not_in_subquery(sql, parsed, metadata):
    if re.search(r"NOT\s+IN\s*\(\s*SELECT", sql, re.IGNORECASE):
        return {
            "message": "NOT IN with subquery can be very slow and handles NULLs incorrectly",
            "suggestion": "Use NOT EXISTS instead — it's faster and NULL-safe",
        }

@rule(9, "Missing LIMIT on large select", "medium")
def check_missing_limit(sql, parsed, metadata):
    if (metadata.get("query_type") == "SELECT"
        and not metadata.get("has_limit")
        and not metadata.get("has_aggregation")
        and len(metadata.get("tables", [])) > 0):
        return {
            "message": "SELECT without LIMIT could return millions of rows",
            "suggestion": "Add LIMIT to restrict result set size",
        }

@rule(10, "DISTINCT as band-aid", "medium")
def check_unnecessary_distinct(sql, parsed, metadata):
    if metadata.get("has_distinct") and metadata.get("joins"):
        return {
            "message": "DISTINCT with JOINs often masks a duplicate rows problem from incorrect joins",
            "suggestion": "Fix the JOIN conditions instead of using DISTINCT to hide duplicates",
        }

@rule(11, "ORDER BY non-indexed columns", "low")
def check_order_by_no_index(sql, parsed, metadata):
    if metadata.get("has_order_by") and metadata.get("order_by_columns"):
        return {
            "message": f"ORDER BY columns ({', '.join(metadata['order_by_columns'])}) may not be indexed — causes filesort",
            "suggestion": "Add an index on ORDER BY columns, or use a covering index",
        }

@rule(12, "Large OFFSET pagination", "critical")
def check_large_offset(sql, parsed, metadata):
    offset_match = re.search(r"OFFSET\s+(\d+)", sql, re.IGNORECASE)
    if offset_match and int(offset_match.group(1)) > 1000:
        return {
            "message": f"OFFSET {offset_match.group(1)} — database must scan and discard all skipped rows",
            "suggestion": "Use keyset/cursor pagination instead: WHERE id > last_seen_id LIMIT N",
        }

@rule(13, "Deeply nested subqueries", "medium")
def check_nested_subqueries(sql, parsed, metadata):
    if metadata.get("subqueries", 0) > 2:
        return {
            "message": f"Found {metadata['subqueries']} nested subqueries — reduces readability and optimizer effectiveness",
            "suggestion": "Refactor into CTEs (WITH clause) for better readability and potential optimization",
        }

@rule(14, "Cartesian product risk", "critical")
def check_cartesian_product(sql, parsed, metadata):
    tables = metadata.get("tables", [])
    joins = metadata.get("joins", [])
    conditions = metadata.get("conditions", [])
    if len(tables) > 1 and not joins and not conditions:
        return {
            "message": f"Multiple tables ({len(tables)}) with no JOIN or WHERE — creates a cartesian product",
            "suggestion": "Add JOIN conditions between tables to avoid explosive row multiplication",
        }

@rule(15, "Redundant conditions", "low")
def check_redundant(sql, parsed, metadata):
    conditions = metadata.get("conditions", [])
    if len(conditions) != len(set(conditions)) and len(conditions) > 1:
        return {
            "message": "Duplicate conditions detected in WHERE clause",
            "suggestion": "Remove redundant conditions to simplify the query",
        }

@rule(16, "HAVING without GROUP BY", "medium")
def check_having_no_group(sql, parsed, metadata):
    if re.search(r"\bHAVING\b", sql, re.IGNORECASE) and not metadata.get("group_by_columns"):
        return {
            "message": "HAVING without GROUP BY — HAVING is meant to filter aggregated groups",
            "suggestion": "Use WHERE for row-level filtering, HAVING for group-level filtering",
        }

@rule(17, "Inequality prevents index", "low")
def check_inequality(sql, parsed, metadata):
    if re.search(r"WHERE\s+.*?(?:!=|<>)", sql, re.IGNORECASE):
        return {
            "message": "!= or <> in WHERE clause may prevent index usage on that column",
            "suggestion": "Consider restructuring as a range condition or using NOT EXISTS",
        }

@rule(18, "Implicit type conversion", "medium")
def check_implicit_cast(sql, parsed, metadata):
    # Check for comparing string literal to likely numeric column
    if re.search(r"=\s*'?\d+'?(?:\s|$|;)", sql):
        if re.search(r"(?:id|_id|count|num|amount)\s*=\s*'\d+'", sql, re.IGNORECASE):
            return {
                "message": "Comparing numeric column with string literal causes implicit type conversion",
                "suggestion": "Use matching types: WHERE id = 123 (not '123')",
            }

@rule(19, "Scalar subquery in SELECT", "medium")
def check_scalar_subquery(sql, parsed, metadata):
    if re.search(r"SELECT\s+.*\(\s*SELECT\s+", sql, re.IGNORECASE):
        return {
            "message": "Scalar subquery in SELECT list executes once per row — very slow on large tables",
            "suggestion": "Convert to a JOIN with aggregation or use a CTE",
        }

@rule(20, "Missing aliases in multi-table query", "low")
def check_missing_aliases(sql, parsed, metadata):
    tables = metadata.get("tables", [])
    if len(tables) > 1:
        for t in tables:
            if t["name"] == t["alias"]:
                return {
                    "message": f"Table '{t['name']}' has no alias — reduces readability in multi-table queries",
                    "suggestion": "Add short aliases: FROM users u JOIN orders o ON ...",
                }


def detect_antipatterns(sql: str, metadata: dict) -> list:
    """Run all 20 anti-pattern rules and return detected issues."""
    from app.utils.sanitizer import sanitize_query_placeholders
    sanitized_sql = sanitize_query_placeholders(sql)
    try:
        parsed = sqlglot.parse_one(sanitized_sql)
    except Exception:
        parsed = None

    issues = []
    for rule_def in RULES:
        try:
            result = rule_def["check"](sql, parsed, metadata)
            if result:
                issues.append({
                    "rule_id": rule_def["id"],
                    "name": rule_def["name"],
                    "severity": rule_def["severity"],
                    "message": result["message"],
                    "suggestion": result["suggestion"],
                })
        except Exception:
            continue

    return issues
