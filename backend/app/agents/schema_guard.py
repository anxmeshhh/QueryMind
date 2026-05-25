"""Agent 6: Schema Integrity Guard — validates recommendations against existing schema.

Prevents QueryMind from recommending changes that would break a well-designed
database. Cross-references AI recommendations against the project's existing
indexes, foreign keys, and table relationships.
"""

import re


def validate_schema_safety(
    indexes: list,
    optimized_sql: str,
    project_schema: list,
    original_sql: str,
) -> dict:
    """
    Run safety checks on recommendations before presenting to the user.

    Returns:
        {
          "safe": bool,
          "safety_score": int (0-100),
          "warnings": [...],
          "blocked": [...],
          "approved": [...],
            "unchanged_note": str | None,
        }
    """
    warnings = []
    blocked = []
    approved = []

    # Normalize project schema
    table_map = _build_table_map(project_schema)
    existing_index_sets = _build_existing_index_map(project_schema)
    fk_map = _build_fk_map(project_schema)

    # ── Check 1: Duplicate Index Detection ──────────────────────
    for idx in indexes:
        if not isinstance(idx, dict):
            continue

        tbl = (idx.get("table") or "").lower()
        cols = idx.get("columns") or []
        if not isinstance(cols, list):
            cols = [cols]
        cols_lower = sorted([str(c).lower() for c in cols])
        cols_set = set(cols_lower)

        # Check for exact duplicate
        if tbl in existing_index_sets:
            for existing_set in existing_index_sets[tbl]:
                if cols_set == existing_set:
                    blocked.append({
                        "type": "duplicate_index",
                        "table": tbl,
                        "columns": cols,
                        "message": f"Index on {tbl}({', '.join(cols)}) already exists in schema. Skipped.",
                    })
                    break
            else:
                # Check for subset (existing index covers this one)
                for existing_set in existing_index_sets[tbl]:
                    if cols_set.issubset(existing_set):
                        warnings.append({
                            "type": "covered_by_existing",
                            "table": tbl,
                            "columns": cols,
                            "message": f"Columns ({', '.join(cols)}) are already covered by a wider index on {tbl}.",
                        })
                        break
                else:
                    approved.append(idx)
        else:
            # Table not in schema — can't validate, approve with caveat
            if tbl and tbl not in table_map:
                warnings.append({
                    "type": "unknown_table",
                    "table": tbl,
                    "message": f"Table '{tbl}' not found in project schema. Cannot validate index recommendation.",
                })
            approved.append(idx)

    # ── Check 2: Optimized SQL references valid tables/columns ──
    if optimized_sql and table_map:
        # Extract table names from optimized SQL
        sql_tables = re.findall(r'\b(?:FROM|JOIN|INTO|UPDATE)\s+(\w+)', optimized_sql, re.IGNORECASE)
        for sql_tbl in sql_tables:
            if sql_tbl.lower() not in table_map and sql_tbl.lower() not in ("select", "where", "and", "or", "on"):
                warnings.append({
                    "type": "missing_table_ref",
                    "table": sql_tbl,
                    "message": f"Optimized SQL references table '{sql_tbl}' which is not found in the project schema.",
                })

    # ── Check 3: FK Relationship Safety ─────────────────────────
    # Check if any index recommendation involves a FK column and flag it
    for idx in approved:
        if not isinstance(idx, dict):
            continue
        tbl = (idx.get("table") or "").lower()
        cols = idx.get("columns") or []
        if not isinstance(cols, list):
            cols = [cols]

        for col in cols:
            col_lower = str(col).lower()
            fk_key = f"{tbl}.{col_lower}"
            if fk_key in fk_map:
                ref = fk_map[fk_key]
                warnings.append({
                    "type": "fk_column_index",
                    "table": tbl,
                    "column": col,
                    "message": f"Column {tbl}.{col} is a foreign key referencing {ref}. Index is safe but note the relationship.",
                })

    # ── Check 4: Query Already Well-Optimized ───────────────────
    unchanged_note = None
    if original_sql and optimized_sql:
        # Normalize for comparison
        orig_norm = _normalize_sql(original_sql)
        opt_norm = _normalize_sql(optimized_sql)
        if orig_norm == opt_norm:
            unchanged_note = "Query is already well-optimized. No changes recommended."

    # ── Compute Safety Score ────────────────────────────────────
    safety_score = 100
    safety_score -= len(blocked) * 10
    safety_score -= len(warnings) * 5
    safety_score = max(0, min(100, safety_score))

    return {
        "safe": len(blocked) == 0 and safety_score >= 60,
        "safety_score": safety_score,
        "warnings": warnings,
        "blocked": blocked,
        "approved": approved,
        "unchanged_note": unchanged_note,
    }


def _build_table_map(schema: list) -> dict:
    """Build a {table_name_lower: table_dict} map from schema list."""
    result = {}
    for t in (schema or []):
        if not isinstance(t, dict):
            continue
        name = (t.get("name") or t.get("table") or "").lower()
        if name:
            result[name] = t
    return result


def _build_existing_index_map(schema: list) -> dict:
    """Build {table_name_lower: [set(col_lower), ...]} from schema."""
    result = {}
    for t in (schema or []):
        if not isinstance(t, dict):
            continue
        name = (t.get("name") or t.get("table") or "").lower()
        if not name:
            continue

        col_sets = []
        idx_src = t.get("indexes")
        if isinstance(idx_src, list):
            for idx in idx_src:
                if isinstance(idx, dict):
                    cols = idx.get("columns") or []
                    if isinstance(cols, list) and cols:
                        col_sets.append(set(c.lower() for c in cols))
                    elif "definition" in idx:
                        m = re.search(r"\(([^)]+)\)", str(idx["definition"]))
                        if m:
                            cols = [c.strip().strip('`"\'').lower() for c in m.group(1).split(",")]
                            col_sets.append(set(cols))
        # Also check primary key as implicit index
        pk = t.get("primary_key") or []
        if isinstance(pk, list) and pk:
            col_sets.append(set(c.lower() for c in pk))

        if col_sets:
            result[name] = col_sets

    return result


def _build_fk_map(schema: list) -> dict:
    """Build {table.column_lower: ref_table.ref_column} map."""
    result = {}
    for t in (schema or []):
        if not isinstance(t, dict):
            continue
        name = (t.get("name") or t.get("table") or "").lower()
        for fk in (t.get("foreign_keys") or []):
            if isinstance(fk, dict):
                col = fk.get("column", "").lower()
                ref_tbl = fk.get("ref_table", "").lower()
                ref_col = fk.get("ref_column", "").lower()
                if col and ref_tbl:
                    result[f"{name}.{col}"] = f"{ref_tbl}.{ref_col}"
    return result


def _normalize_sql(sql: str) -> str:
    """Normalize SQL for comparison: lowercase, collapse whitespace, strip semicolons."""
    s = sql.lower().strip().rstrip(";")
    s = re.sub(r'\s+', ' ', s)
    return s
