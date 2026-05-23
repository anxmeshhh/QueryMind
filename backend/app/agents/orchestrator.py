"""Orchestrator — coordinates all agents and streams results via SSE."""

import json
import time

from app.agents.parser_agent import parse_query
from app.agents.antipattern_detector import detect_antipatterns
from app.agents.index_advisor import advise_indexes
from app.agents.query_optimizer import optimize_query
from app.agents.performance_predictor import predict_performance
from app.agents.file_scanner import scan_files
from app.agents.db_connector import connect_and_execute, discover_schema, test_connection
from app.utils.schema_parser import parse_schema_sql


def _sse_event(data: dict) -> str:
    """Format a dict as an SSE event string."""
    return f"data: {json.dumps(data)}\n\n"


def run_quick_analysis(sql: str, schema_sql: str = "", dialect: str = "postgresql"):
    """
    Generator that runs the full analysis pipeline and yields SSE events.
    Used for Quick Analyze mode.
    """
    start = time.time()

    # Parse schema if provided
    schema = parse_schema_sql(schema_sql) if schema_sql else []

    # ── Agent 1: Parse ───────────────────────────────────
    t = time.time()
    yield _sse_event({"type": "agent_start", "agent": "parser", "message": "Parsing SQL query into AST..."})

    metadata = parse_query(sql, dialect)

    if not metadata.get("valid"):
        yield _sse_event({"type": "agent_error", "agent": "parser", "message": f"Parse error: {metadata.get('error')}"})
        yield _sse_event({"type": "complete", "error": metadata.get("error")})
        return

    tables_str = ", ".join(t["name"] for t in metadata.get("tables", []))
    join_count = len(metadata.get("joins", []))
    join_info = "implicit joins" if metadata.get("implicit_joins") else f"{join_count} joins"
    order_info = "ORDER BY" if metadata.get("has_order_by") else "no ORDER BY"
    yield _sse_event({
        "type": "agent_done", "agent": "parser",
        "message": f"Parsed → {len(metadata['tables'])} tables ({tables_str}), {join_info}, {metadata['query_type']} with {order_info}",
        "time": round(time.time() - t, 1),
        "data": metadata,
    })

    # ── Agent 2: Anti-Pattern Detection ──────────────────
    t = time.time()
    yield _sse_event({"type": "agent_start", "agent": "rules", "message": "Scanning for anti-patterns..."})

    issues = detect_antipatterns(sql, metadata)

    for issue in issues:
        sev = "●" if issue["severity"] == "critical" else "○"
        yield _sse_event({
            "type": "agent_finding", "agent": "rules",
            "severity": issue["severity"],
            "message": f"{sev} {issue['severity'].upper()}: {issue['name']}",
        })

    critical = sum(1 for i in issues if i["severity"] == "critical")
    medium = sum(1 for i in issues if i["severity"] == "medium")
    low = sum(1 for i in issues if i["severity"] == "low")
    yield _sse_event({
        "type": "agent_done", "agent": "rules",
        "message": f"Found {len(issues)} issues ({critical} critical, {medium} medium, {low} low)",
        "time": round(time.time() - t, 1),
        "data": issues,
    })

    # ── Agent 3: Index Advisor ───────────────────────────
    t = time.time()
    yield _sse_event({"type": "agent_start", "agent": "index", "message": "Analyzing index requirements..."})

    indexes = advise_indexes(sql, metadata, schema, dialect)

    for idx in indexes:
        yield _sse_event({
            "type": "agent_finding", "agent": "index",
            "message": f"{idx.get('table', '?')}.({', '.join(idx.get('columns', []))}) → {idx.get('reason', 'recommended')}",
        })

    yield _sse_event({
        "type": "agent_done", "agent": "index",
        "message": f"Recommended {len(indexes)} index(es)",
        "time": round(time.time() - t, 1),
        "data": indexes,
    })

    # ── Agent 4: Query Optimizer ─────────────────────────
    t = time.time()
    yield _sse_event({"type": "agent_start", "agent": "optimize", "message": "Optimizing query..."})

    optimization = optimize_query(sql, metadata, issues, dialect)

    for change in optimization.get("changes", []):
        yield _sse_event({
            "type": "agent_finding", "agent": "optimize",
            "message": change,
        })

    yield _sse_event({
        "type": "agent_done", "agent": "optimize",
        "message": f"Applied {len(optimization.get('changes', []))} optimization(s)",
        "time": round(time.time() - t, 1),
        "data": optimization,
    })

    # ── Agent 5: Performance Predictor ───────────────────
    t = time.time()
    yield _sse_event({"type": "agent_start", "agent": "predict", "message": "Estimating performance impact..."})

    performance = predict_performance(sql, optimization.get("optimized", sql), metadata, issues, dialect)

    yield _sse_event({
        "type": "agent_done", "agent": "predict",
        "message": f"Score: {performance['score_before']} → {performance['score_after']} "
                   f"({performance.get('estimated_improvement', 'improved')})",
        "time": round(time.time() - t, 1),
        "data": performance,
    })

    # ── Complete ─────────────────────────────────────────
    total_time = round(time.time() - start, 1)
    yield _sse_event({
        "type": "complete",
        "message": f"Analysis complete — {len(issues)} issues, {len(indexes)} indexes, "
                   f"{len(optimization.get('changes', []))} optimizations",
        "time": total_time,
        "result": {
            "metadata": metadata,
            "issues": issues,
            "indexes": indexes,
            "optimization": optimization,
            "performance": performance,
        },
    })


def run_scan_analysis(files: list):
    """
    Generator for Project Scan mode — scans files and yields SSE events.
    """
    start = time.time()

    yield _sse_event({"type": "agent_start", "agent": "scanner", "message": f"Scanning {len(files)} file(s)..."})

    result = scan_files(files)
    queries = result["queries"]
    conn_strings = result["connection_strings"]

    for q in queries:
        yield _sse_event({
            "type": "agent_finding", "agent": "scanner",
            "message": f"{q['file']}:{q['line']} → found SQL query ({q['language']})",
        })

    for cs in conn_strings:
        yield _sse_event({
            "type": "agent_finding", "agent": "scanner",
            "message": f"{cs['file']} → DATABASE_URL detected",
        })

    yield _sse_event({
        "type": "complete",
        "message": f"Scan complete — {len(queries)} queries in {len(set(q['file'] for q in queries))} files",
        "time": round(time.time() - start, 1),
        "result": {
            "queries": queries,
            "connection_strings": conn_strings,
        },
    })


def run_connect_test(connection_string: str):
    """Test database connection and discover schema."""
    yield _sse_event({"type": "agent_start", "agent": "connector", "message": "Testing connection..."})

    conn_result = test_connection(connection_string)

    if conn_result["status"] == "error":
        yield _sse_event({"type": "agent_error", "agent": "connector", "message": conn_result["error"]})
        yield _sse_event({"type": "complete", "error": conn_result["error"]})
        return

    yield _sse_event({
        "type": "agent_done", "agent": "connector",
        "message": f"Connected to {conn_result['type']} {conn_result['version']} — {conn_result['database']}",
        "data": conn_result,
    })

    # Discover schema
    yield _sse_event({"type": "agent_start", "agent": "schema", "message": "Discovering schema..."})

    try:
        schema = discover_schema(connection_string)
        total_tables = len(schema.get("tables", []))
        total_rows = sum(t.get("rows", 0) for t in schema.get("tables", []))
        yield _sse_event({
            "type": "agent_done", "agent": "schema",
            "message": f"Found {total_tables} tables, ~{total_rows:,} total rows",
            "data": schema,
        })
    except Exception as e:
        yield _sse_event({"type": "agent_error", "agent": "schema", "message": str(e)})

    yield _sse_event({"type": "complete", "result": {"connection": conn_result, "schema": schema}})


def run_explain_analysis(connection_string: str, sql: str, dialect: str = "postgresql"):
    """Run EXPLAIN ANALYZE on a live database and return full analysis."""
    # First run the explain
    yield _sse_event({"type": "agent_start", "agent": "explain", "message": "Running EXPLAIN ANALYZE..."})

    try:
        explain_result = connect_and_execute(connection_string, sql)
        yield _sse_event({
            "type": "agent_done", "agent": "explain",
            "message": "Execution plan retrieved",
            "data": explain_result,
        })
    except Exception as e:
        yield _sse_event({"type": "agent_error", "agent": "explain", "message": str(e)})
        yield _sse_event({"type": "complete", "error": str(e)})
        return

    # Then run the full analysis pipeline
    yield from run_quick_analysis(sql, "", dialect)
