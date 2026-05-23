"""Agent 6: Index Advisor — recommends indexes based on query + schema analysis."""

from app.services.groq_client import ask_groq


def advise_indexes(sql: str, metadata: dict, schema: list = None, dialect: str = "postgresql") -> list:
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

    # Build schema context string
    schema_context = ""
    if schema:
        for table in schema:
            cols = ", ".join([f"{c['name']} {c['type']}" for c in table.get("columns", [])])
            idx = ", ".join([f"{i.get('name', 'idx')}({','.join(i.get('columns', []))})"
                           for i in table.get("indexes", [])])
            schema_context += f"\nTable: {table['name']} ({cols})"
            if idx:
                schema_context += f"\n  Existing indexes: {idx}"

    prompt = f"""Analyze this {dialect} SQL query and recommend indexes for performance.

QUERY:
{sql}

TABLES USED: {', '.join(t['name'] for t in metadata.get('tables', []))}
COLUMNS IN WHERE/JOIN/ORDER BY: {', '.join(used_columns) if used_columns else 'none detected'}
{f'SCHEMA:{schema_context}' if schema_context else ''}

Respond in this exact JSON format (no markdown, no explanation outside JSON):
[
  {{
    "table": "table_name",
    "columns": ["col1", "col2"],
    "type": "btree",
    "create_statement": "CREATE INDEX idx_name ON table(col1, col2);",
    "reason": "Short explanation of why this index helps"
  }}
]

Only recommend indexes that would genuinely improve this specific query.
If no indexes are needed, return an empty array [].
Return valid JSON only."""

    try:
        response = ask_groq(prompt)
        # Parse JSON from response
        import json
        # Try to extract JSON array from response
        text = response.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        recommendations = json.loads(text)
        if isinstance(recommendations, list):
            return recommendations
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
