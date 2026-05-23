"""Natural Language to SQL agent — converts plain English to SQL queries."""

import json
from app.services.groq_client import ask_groq


def natural_language_to_sql(
    prompt: str,
    dialect: str = "postgresql",
    schema: list = None,
) -> dict:
    """
    Convert a natural language description to a SQL query.
    
    Returns:
        {
            "sql": "SELECT ...",
            "explanation": "This query ...",
            "tables_used": ["users", "orders"],
            "confidence": 0.85
        }
    """
    schema_context = ""
    if schema:
        table_lines = []
        for t in schema:
            name = t.get("name") or t.get("table", "unknown")
            cols = t.get("columns") or t.get("column_details", [])
            col_strs = []
            for c in cols:
                if isinstance(c, str):
                    col_strs.append(c)
                elif isinstance(c, dict):
                    col_strs.append(f"{c.get('name', '?')} {c.get('type', 'TEXT')}")
            table_lines.append(f"  {name}({', '.join(col_strs)})")
        schema_context = "\n\nAvailable tables:\n" + "\n".join(table_lines)

    system = (
        f"You are a SQL expert. Convert natural language to {dialect.upper()} SQL. "
        "Return ONLY valid JSON with keys: sql, explanation, tables_used, confidence. "
        "confidence is 0.0-1.0. Do not wrap in markdown."
    )

    user_prompt = f"Convert to SQL ({dialect}):\n\"{prompt}\"{schema_context}"

    try:
        raw = ask_groq(user_prompt, system=system, max_tokens=512)
        
        # Parse JSON from response
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            raw = raw.rsplit("```", 1)[0]
        
        result = json.loads(raw)
        return {
            "sql": result.get("sql", ""),
            "explanation": result.get("explanation", ""),
            "tables_used": result.get("tables_used", []),
            "confidence": min(1.0, max(0.0, float(result.get("confidence", 0.7)))),
        }
    except json.JSONDecodeError:
        # Fallback: try to extract SQL from raw text
        if "SELECT" in raw.upper() or "INSERT" in raw.upper():
            return {
                "sql": raw.strip(),
                "explanation": "Generated from natural language input",
                "tables_used": [],
                "confidence": 0.5,
            }
        return {
            "sql": "",
            "explanation": "Failed to generate SQL from the given description",
            "tables_used": [],
            "confidence": 0.0,
        }
    except Exception as e:
        return {
            "sql": "",
            "explanation": f"Error: {str(e)}",
            "tables_used": [],
            "confidence": 0.0,
        }
