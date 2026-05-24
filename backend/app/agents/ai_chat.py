"""AI Chat Agent — multi-turn conversational assistant for database engineering.

Provides a conversational interface that understands database context,
remembers conversation history, and can explain, optimize, compare,
and generate SQL with schema awareness.
"""

import json
import time
from app.services.groq_client import ask_groq


# In-memory session store (per-session chat history)
_sessions: dict = {}
MAX_HISTORY = 20  # Max messages per session


def _get_session(session_id: str) -> list:
    """Get or create a chat session."""
    if session_id not in _sessions:
        _sessions[session_id] = []
    return _sessions[session_id]


def _trim_history(history: list) -> list:
    """Keep only the most recent messages to fit context window."""
    if len(history) > MAX_HISTORY:
        # Always keep the system context (first message) + recent messages
        return history[:1] + history[-(MAX_HISTORY - 1):]
    return history


def _build_schema_context(schema: list) -> str:
    """Build a concise schema summary for the AI context."""
    if not schema:
        return ""

    parts = []
    for table in schema[:20]:  # Limit to 20 tables to save tokens
        if not isinstance(table, dict):
            continue
        name = table.get("name") or table.get("table") or "unknown"
        cols = table.get("columns") or table.get("column_details") or []
        if not isinstance(cols, list):
            cols = []
        col_strs = []
        for c in cols[:15]:  # Limit columns per table
            if isinstance(c, str):
                col_strs.append(c)
            elif isinstance(c, dict):
                pk = " PK" if c.get("primary_key") else ""
                col_strs.append(f"{c.get('name', '?')} {c.get('type', 'TEXT')}{pk}")

        row_count = table.get("rows")
        row_info = f" (~{row_count} rows)" if row_count else ""

        idx_count = table.get("indexes") or 0
        if isinstance(idx_count, list):
            idx_count = len(idx_count)

        parts.append(f"  {name}{row_info}: {', '.join(col_strs)} [{idx_count} indexes]")

    return "\n".join(parts)


def chat(
    session_id: str,
    message: str,
    schema: list = None,
    dialect: str = "postgresql",
    current_query: str = None,
    current_result: dict = None,
) -> dict:
    """
    Process a chat message and return AI response.

    Args:
        session_id: Unique session identifier for history tracking
        message: User's message
        schema: Database schema context (tables, columns, etc.)
        dialect: SQL dialect being used
        current_query: The SQL query currently in the editor
        current_result: The current analysis result (if any)

    Returns:
        {
            "response": "AI response text",
            "sql": "optional generated SQL",
            "suggestions": ["follow-up suggestion 1", ...],
            "session_id": "session_id"
        }
    """
    history = _get_session(session_id)

    # Build system prompt with context
    schema_context = _build_schema_context(schema) if schema else ""
    query_context = f"\n\nCURRENT QUERY IN EDITOR:\n```sql\n{current_query}\n```" if current_query else ""

    result_context = ""
    if current_result:
        result_context = f"\n\nLATEST ANALYSIS RESULTS:"
        if "performance" in current_result:
            perf = current_result["performance"]
            result_context += f"\n- Score: {perf.get('score_before', '?')} → {perf.get('score_after', '?')}"
        if "issues" in current_result:
            issues = current_result["issues"]
            result_context += f"\n- Issues found: {len(issues)}"
            for iss in issues[:5]:
                if isinstance(iss, dict):
                    result_context += f"\n  [{iss.get('severity', '?')}] {iss.get('name', '?')}: {iss.get('message', '')}"

    system_prompt = f"""You are QueryMind AI — an expert database engineer and SQL optimization assistant.
You help developers write better SQL, optimize queries, understand execution plans, and design better schemas.

RULES:
1. Be concise but thorough. Use code blocks for SQL.
2. When generating SQL, always use {dialect.upper()} syntax.
3. If the user asks to optimize or fix a query, provide the improved SQL in a code block.
4. When explaining concepts, use clear examples.
5. If you generate or suggest SQL, also briefly explain why it's better.
6. Reference the user's current schema and query context when relevant.
7. Suggest follow-up actions the user might want to take.

{f'DATABASE SCHEMA ({dialect}):{chr(10)}{schema_context}' if schema_context else 'No schema context available — suggest the user connect a database or paste CREATE TABLE statements.'}
{query_context}
{result_context}"""

    # Initialize session with system prompt if empty
    if not history:
        history.append({"role": "system", "content": system_prompt})
    else:
        # Update system prompt with latest context
        history[0] = {"role": "system", "content": system_prompt}

    # Add user message
    history.append({"role": "user", "content": message})

    # Trim history
    history = _trim_history(history)
    _sessions[session_id] = history

    try:
        # Build messages for Groq
        response_text = ask_groq(
            prompt=message,
            system=system_prompt,
            max_tokens=1024,
        )

        # Add assistant response to history
        history.append({"role": "assistant", "content": response_text})
        _sessions[session_id] = history

        # Extract SQL from response if present
        extracted_sql = _extract_sql(response_text)

        # Generate follow-up suggestions
        suggestions = _generate_suggestions(message, response_text, current_query)

        return {
            "response": response_text,
            "sql": extracted_sql,
            "suggestions": suggestions,
            "session_id": session_id,
        }

    except Exception as e:
        error_msg = f"I encountered an error: {str(e)}. Please try again."
        history.append({"role": "assistant", "content": error_msg})
        return {
            "response": error_msg,
            "sql": None,
            "suggestions": ["Try rephrasing your question", "Check your API connection"],
            "session_id": session_id,
        }


def chat_stream(
    session_id: str,
    message: str,
    schema: list = None,
    dialect: str = "postgresql",
    current_query: str = None,
    current_result: dict = None,
):
    """
    Generator that yields SSE events for streaming chat responses.
    """
    yield _sse_event({"type": "chat_start", "message": "Thinking..."})

    result = chat(
        session_id=session_id,
        message=message,
        schema=schema,
        dialect=dialect,
        current_query=current_query,
        current_result=current_result,
    )

    yield _sse_event({
        "type": "chat_response",
        "response": result["response"],
        "sql": result.get("sql"),
        "suggestions": result.get("suggestions", []),
        "session_id": result["session_id"],
    })

    yield _sse_event({"type": "chat_complete"})


def clear_session(session_id: str):
    """Clear chat history for a session."""
    _sessions.pop(session_id, None)
    return {"status": "cleared", "session_id": session_id}


def _extract_sql(text: str) -> str | None:
    """Extract the first SQL code block from AI response."""
    import re
    # Match ```sql ... ``` blocks
    match = re.search(r'```sql\s*\n(.*?)\n```', text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    # Match ``` ... ``` blocks that look like SQL
    match = re.search(r'```\s*\n((?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH|EXPLAIN).*?)\n```', text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None


def _generate_suggestions(user_msg: str, response: str, current_query: str = None) -> list:
    """Generate contextual follow-up suggestions."""
    suggestions = []
    msg_lower = user_msg.lower()
    resp_lower = response.lower()

    if "optimize" in msg_lower or "improve" in msg_lower:
        suggestions.append("Explain the optimization changes")
        suggestions.append("What indexes would help this query?")
    elif "explain" in msg_lower:
        suggestions.append("How can I optimize this?")
        suggestions.append("What are the potential bottlenecks?")
    elif "index" in msg_lower:
        suggestions.append("Will this index slow down writes?")
        suggestions.append("Show me the CREATE INDEX statement")
    elif "write" in msg_lower or "query" in msg_lower or "generate" in msg_lower:
        suggestions.append("Optimize this query")
        suggestions.append("Explain this query step by step")

    if "join" in resp_lower:
        suggestions.append("Are there better JOIN strategies?")
    if "subquery" in resp_lower:
        suggestions.append("Convert subqueries to CTEs")

    # Default suggestions if none matched
    if not suggestions:
        suggestions = [
            "Optimize my current query",
            "Explain what this query does",
            "Suggest better indexes",
        ]

    return suggestions[:3]


def _sse_event(data: dict) -> str:
    """Format a dict as an SSE event string."""
    return f"data: {json.dumps(data)}\n\n"
