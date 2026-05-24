"""AI Query Explainer — converts SQL queries into human-readable explanations.

Takes any SQL query and produces a step-by-step breakdown that a junior
developer can understand, including business logic identification and
edge case warnings.
"""

import json
from app.services.groq_client import ask_groq


def explain_query(sql: str, dialect: str = "postgresql", schema: list = None) -> dict:
    """
    Generate a human-readable explanation of a SQL query.

    Returns:
        {
            "summary": "One-line description of what the query does",
            "steps": [
                {"step": 1, "operation": "FROM/JOIN", "description": "..."},
                ...
            ],
            "business_logic": "What business question this query answers",
            "edge_cases": ["potential issue 1", ...],
            "complexity": "simple|moderate|complex",
            "tables_involved": ["table1", "table2"]
        }
    """
    schema_context = ""
    if schema:
        parts = []
        for table in schema[:10]:
            if not isinstance(table, dict):
                continue
            name = table.get("name") or table.get("table") or "unknown"
            cols = table.get("columns") or table.get("column_details") or []
            if not isinstance(cols, list):
                cols = []
            col_strs = []
            for c in cols[:10]:
                if isinstance(c, str):
                    col_strs.append(c)
                elif isinstance(c, dict):
                    col_strs.append(f"{c.get('name', '?')} {c.get('type', '?')}")
            parts.append(f"  {name}({', '.join(col_strs)})")
        schema_context = f"\n\nSCHEMA CONTEXT:\n" + "\n".join(parts)

    prompt = f"""Explain this {dialect.upper()} SQL query in a way that a junior developer can understand.

QUERY:
```sql
{sql}
```
{schema_context}

Respond in this exact JSON format (no markdown wrapping, no code fences):
{{
  "summary": "One sentence describing what this query does",
  "steps": [
    {{
      "step": 1,
      "operation": "FROM",
      "clause": "FROM users u",
      "description": "Start by accessing the users table, aliased as 'u'"
    }}
  ],
  "business_logic": "What business question or use case this query serves",
  "edge_cases": [
    "Description of potential edge case or NULL handling issue"
  ],
  "complexity": "simple|moderate|complex",
  "tables_involved": ["table1", "table2"]
}}

RULES:
1. Break down the query in logical execution order (FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT)
2. Explain each step in plain English, not SQL jargon
3. Identify the business purpose of the query
4. Flag any potential edge cases (NULLs, empty results, performance concerns)
5. Rate complexity as simple (1-2 tables, basic filters), moderate (3+ tables or subqueries), or complex (CTEs, window functions, recursive)

Return valid JSON only."""

    try:
        response = ask_groq(prompt, max_tokens=768, json_mode=True).strip()

        # Clean markdown fencing if present
        if response.startswith("```"):
            lines = response.split("\n")
            response = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        response = response.strip()
        if response.startswith("json"):
            response = response[4:].strip()

        result = json.loads(response)

        return {
            "summary": result.get("summary", "Query explanation unavailable"),
            "steps": result.get("steps", []),
            "business_logic": result.get("business_logic", ""),
            "edge_cases": result.get("edge_cases", []),
            "complexity": result.get("complexity", "moderate"),
            "tables_involved": result.get("tables_involved", []),
        }

    except json.JSONDecodeError:
        # Fallback: return the raw text as summary
        return {
            "summary": response if response else "Could not parse explanation",
            "steps": [],
            "business_logic": "",
            "edge_cases": [],
            "complexity": "unknown",
            "tables_involved": [],
        }
    except Exception as e:
        return {
            "summary": f"Error generating explanation: {str(e)}",
            "steps": [],
            "business_logic": "",
            "edge_cases": [],
            "complexity": "unknown",
            "tables_involved": [],
        }


def compare_queries(sql_a: str, sql_b: str, dialect: str = "postgresql") -> dict:
    """
    Compare two SQL queries and explain their differences.

    Returns:
        {
            "summary": "Overall comparison summary",
            "differences": [
                {"aspect": "JOINs", "query_a": "...", "query_b": "...", "verdict": "..."}
            ],
            "performance_verdict": "Which query is likely faster and why",
            "recommendation": "Which query to prefer and why"
        }
    """
    prompt = f"""Compare these two {dialect.upper()} SQL queries and explain their differences.

QUERY A:
```sql
{sql_a}
```

QUERY B:
```sql
{sql_b}
```

Respond in this exact JSON format (no markdown, no code fences):
{{
  "summary": "One sentence comparing the two queries",
  "differences": [
    {{
      "aspect": "Category of difference (e.g., JOINs, Filters, Columns, Structure)",
      "query_a": "What Query A does for this aspect",
      "query_b": "What Query B does for this aspect",
      "verdict": "Which approach is better and why"
    }}
  ],
  "performance_verdict": "Which query is likely faster and why",
  "recommendation": "Which query to prefer overall and why"
}}

Return valid JSON only."""

    try:
        response = ask_groq(prompt, max_tokens=768, json_mode=True).strip()
        if response.startswith("```"):
            response = response.split("```")[1]
            if response.startswith("json"):
                response = response[4:]
        response = response.strip()

        result = json.loads(response)
        return {
            "summary": result.get("summary", ""),
            "differences": result.get("differences", []),
            "performance_verdict": result.get("performance_verdict", ""),
            "recommendation": result.get("recommendation", ""),
        }
    except Exception as e:
        return {
            "summary": f"Error comparing queries: {str(e)}",
            "differences": [],
            "performance_verdict": "",
            "recommendation": "",
        }
