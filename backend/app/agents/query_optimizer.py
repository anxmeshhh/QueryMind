"""Agent 7: Query Optimizer — rewrites SQL for better performance."""

from app.agents.parser_agent import optimize_with_sqlglot
from app.services.groq_client import ask_groq


def optimize_query(sql: str, metadata: dict, issues: list, dialect: str = "postgresql", project_schema: list = None) -> dict:
    """
    Optimize a SQL query using sqlglot structural optimization + AI rewriting.
    Returns optimized SQL and list of changes made.

    Args:
        sql: Original SQL query
        metadata: Parsed query metadata
        issues: Detected anti-patterns
        dialect: SQL dialect
        project_schema: Optional full project schema for context-aware optimization
    """
    # Step 1: sqlglot structural optimization
    structurally_optimized = optimize_with_sqlglot(sql, dialect)

    # Step 2: AI-powered optimization based on detected issues
    issue_descriptions = "\n".join(
        [f"- [{i['severity'].upper()}] {i['name']}: {i['message']}" for i in issues]
    )

    # Build project schema context for the AI
    schema_context = ""
    if project_schema:
        schema_parts = []
        for table in project_schema:
            if not isinstance(table, dict):
                continue
            t_name = table.get("name") or table.get("table") or "unknown"
            cols = table.get("columns") or []
            col_defs = []
            for c in cols:
                if isinstance(c, dict) and "name" in c:
                    pk_marker = " [PK]" if c.get("primary_key") else ""
                    col_defs.append(f"{c['name']} {c.get('type', '?')}{pk_marker}")
            
            idx_list = table.get("indexes") or []
            idx_defs = []
            for idx in idx_list:
                if isinstance(idx, dict):
                    idx_cols = idx.get("columns") or []
                    if isinstance(idx_cols, list):
                        idx_defs.append(f"INDEX({', '.join(idx_cols)})")

            fk_list = table.get("foreign_keys") or []
            fk_defs = []
            for fk in fk_list:
                if isinstance(fk, dict):
                    fk_defs.append(f"FK {fk.get('column', '?')} → {fk.get('ref_table', '?')}.{fk.get('ref_column', '?')}")

            row_count = table.get("rows")
            row_info = f" (~{row_count} rows)" if row_count is not None else ""

            line = f"  Table: {t_name}{row_info} — Columns: {', '.join(col_defs)}"
            if idx_defs:
                line += f"\n    Existing indexes: {', '.join(idx_defs)}"
            if fk_defs:
                line += f"\n    Foreign keys: {', '.join(fk_defs)}"
            schema_parts.append(line)

        if schema_parts:
            schema_context = "\n\nPROJECT DATABASE SCHEMA (all tables in the codebase):\n" + "\n".join(schema_parts)

    prompt = f"""You are a senior database engineer. Optimize this {dialect} SQL query for performance.

ORIGINAL QUERY:
{sql}

DETECTED ISSUES:
{issue_descriptions if issues else "No specific issues detected, but optimize for best practices."}

QUERY METADATA:
- Tables: {', '.join(t['name'] for t in metadata.get('tables', []))}
- Has implicit joins: {metadata.get('implicit_joins', False)}
- Has subqueries: {metadata.get('subqueries', 0)}
- Has ORDER BY: {metadata.get('has_order_by', False)}
- Has LIMIT: {metadata.get('has_limit', False)}
{schema_context}

CRITICAL RULES:
1. If the query is already well-written (uses explicit JOINs, proper indexes exist, no anti-patterns), return it largely unchanged. DO NOT over-optimize well-written queries.
2. Preserve all existing foreign key relationships — never suggest changes that would break referential integrity.
3. If the project schema shows existing indexes that cover the query's WHERE/JOIN columns, acknowledge them rather than suggesting duplicates.

OPTIMIZATION RULES:
1. Convert implicit JOINs (comma syntax) to explicit JOIN ... ON
2. Replace SELECT * with specific columns (use reasonable column names from schema if available)
3. Convert correlated subqueries to JOINs or CTEs
4. Add LIMIT if missing (suggest LIMIT 100)
5. Fix LIKE '%value' if possible
6. Convert NOT IN to NOT EXISTS
7. Convert large OFFSET to keyset pagination
8. Ensure SARGable predicates (no functions on indexed columns in WHERE)

Respond with ONLY the optimized SQL query. No explanation, no markdown, no code fences.
Just the raw SQL that can be executed directly."""

    try:
        optimized_sql = ask_groq(prompt).strip()
        # Clean up any markdown fencing
        if optimized_sql.startswith("```"):
            lines = optimized_sql.split("\n")
            optimized_sql = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        optimized_sql = optimized_sql.strip()
        if optimized_sql.startswith("sql"):
            optimized_sql = optimized_sql[3:].strip()
    except Exception:
        optimized_sql = structurally_optimized

    # Generate list of changes
    changes = _diff_changes(sql, optimized_sql)

    return {
        "original": sql,
        "optimized": optimized_sql,
        "changes": changes,
    }


def _diff_changes(original: str, optimized: str) -> list:
    """Detect what changed between original and optimized query."""
    changes = []
    orig_upper = original.upper()
    opt_upper = optimized.upper()

    if "SELECT *" in orig_upper and "SELECT *" not in opt_upper:
        changes.append("Replaced SELECT * with specific columns")
    if ", " in orig_upper.split("FROM")[0] if "FROM" in orig_upper else "" and "JOIN" in opt_upper:
        if "JOIN" not in orig_upper:
            changes.append("Converted implicit JOINs to explicit JOIN ... ON")
    if "LIMIT" not in orig_upper and "LIMIT" in opt_upper:
        changes.append("Added LIMIT clause")
    if orig_upper.count("SELECT") > opt_upper.count("SELECT"):
        changes.append("Simplified subqueries")
    if "WITH " in opt_upper and "WITH " not in orig_upper:
        changes.append("Extracted subqueries into CTEs")
    if "NOT EXISTS" in opt_upper and "NOT IN" in orig_upper:
        changes.append("Converted NOT IN to NOT EXISTS")

    if not changes:
        changes.append("Reformatted and optimized query structure")

    return changes
