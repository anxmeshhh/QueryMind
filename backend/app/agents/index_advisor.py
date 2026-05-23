"""Agent 6: Index Advisor — recommends indexes based on query + schema analysis."""

from app.services.groq_client import ask_groq


def advise_indexes(sql: str, metadata: dict, schema: any = None, dialect: str = "postgresql") -> list:
    """
    Analyze query columns against schema and recommend indexes.
    Uses schema context if available, otherwise uses AI reasoning.
    """
    # Collect columns used in WHERE, JOIN, ORDER BY, GROUP BY
    used_columns = set()
    for cond in metadata.get("conditions", []):
        # Extract column names from conditions
        parts = cond.split()
        for p in parts:
            if "." in p:
                used_columns.add(p)
            elif p.isidentifier():
                used_columns.add(p)

    for col in metadata.get("order_by_columns", []):
        used_columns.add(col)
    for col in metadata.get("group_by_columns", []):
        used_columns.add(col)

    # Build schema context string and identify small/singleton lookup tables
    schema_context = ""
    singleton_warnings = []
    
    if schema:
        # Normalize schema structure (supporting list of tables or DB connector dict)
        table_list = []
        if isinstance(schema, dict) and "tables" in schema:
            table_list = schema["tables"]
        elif isinstance(schema, list):
            table_list = schema

        for table in table_list:
            if not isinstance(table, dict):
                continue
                
            t_name = table.get("name") or table.get("table", "unknown")
            
            # Normalize columns
            cols_src = table.get("columns")
            cols_list = cols_src if isinstance(cols_src, list) else (table.get("column_details") or [])
            cols_def = ", ".join([f"{c['name']} {c['type']}" for c in cols_list if isinstance(c, dict) and "name" in c])
            
            # Normalize indexes
            idx_src = table.get("indexes")
            idx_list = idx_src if isinstance(idx_src, list) else (table.get("index_details") or [])
            idx_def = ""
            if idx_list:
                idx_names = []
                for idx_item in idx_list:
                    if isinstance(idx_item, dict):
                        # Extract name and cols
                        idx_name = idx_item.get("name") or idx_item.get("indexname") or "idx"
                        idx_cols = idx_item.get("columns") or []
                        if isinstance(idx_cols, list):
                            idx_names.append(f"{idx_name}({','.join(idx_cols)})")
                        else:
                            idx_names.append(idx_name)
                idx_def = ", ".join(idx_names)
            
            # Row counts & singleton checks
            row_count = table.get("rows")
            is_lookup_name = any(k in t_name.lower() for k in ["config", "setting", "singleton", "metadata", "sys_status", "lookup", "parameter"])
            
            # Build description
            table_desc = f"\nTable: {t_name} ({cols_def})"
            if row_count is not None:
                table_desc += f" — Estimated Rows: {row_count}"
            if idx_def:
                table_desc += f"\n  Existing indexes: {idx_def}"
                
            schema_context += table_desc
            
            # Flag lookups/singletons
            if is_lookup_name or (row_count is not None and row_count <= 100):
                singleton_warnings.append(f"- Table '{t_name}' is a singleton or tiny lookup table (Rows: {row_count if row_count is not None else 'N/A'}, Name pattern: {t_name}).")

    prompt = f"""Analyze this {dialect} SQL query and recommend indexes for performance.

QUERY:
{sql}

TABLES USED: {', '.join(t['name'] for t in metadata.get('tables', []))}
COLUMNS IN WHERE/JOIN/ORDER BY: {', '.join(used_columns) if used_columns else 'none detected'}
{f'SCHEMA CONTEXT:{schema_context}' if schema_context else ''}

{f'SINGLETON / LOOKUP TABLE DETECTIONS:' + chr(10) + chr(10).join(singleton_warnings) if singleton_warnings else ''}

CRITICAL RULES FOR SINGLETON / TINY TABLES:
1. If a table contains less than 100 rows, or is a singleton/metadata/config table, DO NOT recommend creating new indexes. Database planners will choose a sequential scan (full table scan) over an index scan anyway. Adding indexes to these tables slows down write operations and wastes resource cache.
2. If the user query filters/joins on a tiny or singleton lookup table, explicitly skip recommending indexes for it. If you must output a recommendation because the user queried it, instead return the JSON list item with a warning in the "reason" field indicating why index is omitted/unnecessary (e.g. "Index skipped: Table 'config' is a singleton/tiny metadata table; full table scan is faster.").

Respond in this exact JSON format (no markdown, no explanation outside JSON):
[
  {{
    "table": "table_name",
    "columns": ["col1", "col2"],
    "type": "btree",
    "create_statement": "CREATE INDEX idx_name ON table(col1, col2);",
    "reason": "Short explanation of why this index helps or why it is skipped"
  }}
]

Only recommend indexes that would genuinely improve this specific query.
If no indexes are needed, return an empty array [].
Return valid JSON only."""

    try:
        response = ask_groq(prompt)
        # Parse JSON from response
        import json
        import re
        # Try to extract JSON array from response
        text = response.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        recommendations = json.loads(text)
        if isinstance(recommendations, list):
            # Programmatic filter: check if recommended indexes already exist in the schema
            filtered_recs = []
            
            # Normalize table list from schema object
            table_list = []
            if schema:
                if isinstance(schema, dict) and "tables" in schema:
                    table_list = schema["tables"]
                elif isinstance(schema, list):
                    table_list = schema

            # Build map of existing indexes for each table: {table_name_lower: [set(columns_lower)]}
            existing_indexes_map = {}
            for t in table_list:
                if not isinstance(t, dict):
                    continue
                t_name = (t.get("name") or t.get("table") or "unknown").lower()
                idx_src = t.get("indexes")
                idx_list = idx_src if isinstance(idx_src, list) else (t.get("index_details") or [])
                
                col_sets = []
                for idx in idx_list:
                    if isinstance(idx, dict):
                        cols = idx.get("columns") or []
                        if isinstance(cols, list):
                            col_sets.append(set(c.lower() for c in cols))
                        elif "definition" in idx:
                            m = re.search(r"\(([^)]+)\)", idx["definition"])
                            if m:
                                cols = [c.strip().strip("`\"'").lower() for c in m.group(1).split(",")]
                                col_sets.append(set(cols))
                    elif isinstance(idx, str):
                        m = re.search(r"\(([^)]+)\)", idx)
                        if m:
                            cols = [c.strip().strip("`\"'").lower() for c in m.group(1).split(",")]
                            col_sets.append(set(cols))
                existing_indexes_map[t_name] = col_sets

            for rec in recommendations:
                if not isinstance(rec, dict):
                    continue
                tbl = rec.get("table", "").lower()
                rec_cols = rec.get("columns") or []
                if not isinstance(rec_cols, list):
                    rec_cols = [rec_cols]
                rec_cols_lower = [str(c).lower() for c in rec_cols]
                
                # Check if exact columns set exists in table's indexes
                if tbl in existing_indexes_map and rec_cols_lower:
                    rec_set = set(rec_cols_lower)
                    already_indexed = any(rec_set == ext_set for ext_set in existing_indexes_map[tbl])
                    if already_indexed:
                        rec["reason"] = f"Skipped (Index Already Exists): Columns ({', '.join(rec_cols)}) are already indexed on table {rec.get('table')}."
                        rec["create_statement"] = f"-- Index on {rec.get('table')}({', '.join(rec_cols)}) already exists in schema."
                filtered_recs.append(rec)
                
            return filtered_recs
        return []
    except Exception as e:
        # Fallback: generate basic recommendations from metadata
        return _fallback_recommendations(metadata, schema)


def _fallback_recommendations(metadata: dict, schema: list = None) -> list:
    """Generate basic index recommendations without AI."""
    recs = []
    tables = metadata.get("tables", [])

    # Recommend indexes for JOIN columns
    for join in metadata.get("joins", []):
        if join.get("table"):
            recs.append({
                "table": join["table"],
                "columns": ["(join column)"],
                "type": "btree",
                "create_statement": f"-- Add index on {join['table']} JOIN column",
                "reason": "JOIN column should be indexed for faster lookups",
            })

    # Recommend indexes for ORDER BY columns
    for col in metadata.get("order_by_columns", []):
        if tables:
            recs.append({
                "table": tables[0]["name"],
                "columns": [col],
                "type": "btree",
                "create_statement": f"CREATE INDEX idx_{tables[0]['name']}_{col} ON {tables[0]['name']}({col});",
                "reason": f"Eliminates filesort for ORDER BY {col}",
            })

    return recs
