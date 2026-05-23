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
from app.agents.schema_guard import validate_schema_safety
from app.utils.schema_parser import parse_schema_sql


def _sse_event(data: dict) -> str:
    """Format a dict as an SSE event string."""
    return f"data: {json.dumps(data)}\n\n"


def run_quick_analysis(sql: str, schema_sql: str = "", dialect: str = "postgresql", project_schema: list = None):
    """
    Generator that runs the full analysis pipeline and yields SSE events.
    Used for Quick Analyze mode.

    Args:
        sql: The SQL query to analyze
        schema_sql: Optional CREATE TABLE statements as raw SQL
        dialect: SQL dialect (postgresql, mysql, sqlite)
        project_schema: Optional pre-parsed project schema context from a scan
    """
    start = time.time()

    # Parse schema if provided
    schema = parse_schema_sql(schema_sql) if schema_sql else []

    # Merge with project schema if available
    if project_schema:
        # Deduplicate by table name
        existing_names = {t.get("name", "").lower() for t in schema}
        for t in project_schema:
            name = (t.get("name") or t.get("table") or "").lower()
            if name and name not in existing_names:
                schema.append(t)
                existing_names.add(name)

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

    optimization = optimize_query(sql, metadata, issues, dialect, project_schema=schema)

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

    # ── Agent 6: Schema Integrity Guard ──────────────────
    t = time.time()
    yield _sse_event({"type": "agent_start", "agent": "guard", "message": "Validating schema safety..."})

    guard_report = validate_schema_safety(
        indexes=indexes,
        optimized_sql=optimization.get("optimized", sql),
        project_schema=schema,
        original_sql=sql,
    )

    guard_msg_parts = []
    if guard_report["blocked"]:
        guard_msg_parts.append(f"{len(guard_report['blocked'])} duplicate indexes blocked")
    if guard_report["warnings"]:
        guard_msg_parts.append(f"{len(guard_report['warnings'])} warnings")
    guard_msg_parts.append(f"Safety: {guard_report['safety_score']}/100")

    for blocked in guard_report["blocked"]:
        yield _sse_event({
            "type": "agent_finding", "agent": "guard",
            "severity": "medium",
            "message": f"⊘ {blocked['message']}",
        })

    for warning in guard_report["warnings"]:
        yield _sse_event({
            "type": "agent_finding", "agent": "guard",
            "severity": "low",
            "message": f"⚠ {warning['message']}",
        })

    if guard_report.get("unchanged_note"):
        yield _sse_event({
            "type": "agent_finding", "agent": "guard",
            "severity": "info",
            "message": f"✓ {guard_report['unchanged_note']}",
        })

    yield _sse_event({
        "type": "agent_done", "agent": "guard",
        "message": " · ".join(guard_msg_parts),
        "time": round(time.time() - t, 1),
        "data": guard_report,
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
            "guard": guard_report,
        },
    })


def run_scan_analysis(files: list):
    """
    Generator for Project Scan mode — scans files, extracts schema context, and yields SSE events.
    """
    start = time.time()

    yield _sse_event({"type": "agent_start", "agent": "scanner", "message": f"Scanning {len(files)} file(s)..."})

    result = scan_files(files)
    queries = result["queries"]
    conn_strings = result["connection_strings"]
    schema_ddl_list = result.get("schema_ddl", [])
    orm_models = result.get("orm_models", [])
    file_stats = result.get("file_stats", [])

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

    # ── Build Unified Project Schema ─────────────────────
    project_schema = []
    if schema_ddl_list:
        yield _sse_event({
            "type": "agent_start", "agent": "schema_builder",
            "message": f"Building project schema from {len(schema_ddl_list)} DDL statement(s)...",
        })

        combined_ddl = "\n".join(item["ddl"] for item in schema_ddl_list)
        project_schema = parse_schema_sql(combined_ddl)

        if project_schema:
            total_cols = sum(len(t.get("columns", [])) for t in project_schema)
            total_idx = sum(len(t.get("indexes", [])) for t in project_schema)
            total_fk = sum(len(t.get("foreign_keys", [])) for t in project_schema)
            yield _sse_event({
                "type": "agent_done", "agent": "schema_builder",
                "message": f"Built schema: {len(project_schema)} tables, {total_cols} columns, "
                           f"{total_idx} indexes, {total_fk} foreign keys",
                "data": {
                    "tables": project_schema,
                    "table_count": len(project_schema),
                    "column_count": total_cols,
                    "index_count": total_idx,
                    "fk_count": total_fk,
                },
            })

    if orm_models:
        yield _sse_event({
            "type": "agent_finding", "agent": "schema_builder",
            "message": f"Detected {len(orm_models)} ORM model definition(s): "
                       + ", ".join(f"{m['name']} ({m['orm']})" for m in orm_models[:5]),
        })

    yield _sse_event({
        "type": "complete",
        "message": f"Scan complete — {len(queries)} queries in {len(set(q['file'] for q in queries))} files",
        "time": round(time.time() - start, 1),
        "result": {
            "queries": queries,
            "connection_strings": conn_strings,
            "schema_ddl": schema_ddl_list,
            "orm_models": orm_models,
            "project_schema": project_schema,
            "file_stats": file_stats,
        },
    })


def run_batch_analysis(queries: list, project_schema: list = None, dialect: str = "postgresql"):
    """
    Generator for batch analysis — runs full pipeline on each query
    with shared project schema context. Yields SSE events for progress.
    """
    start = time.time()
    total = len(queries)

    yield _sse_event({
        "type": "batch_start",
        "message": f"Starting batch analysis of {total} queries with project context...",
        "data": {"total": total},
    })

    results = []
    for i, q in enumerate(queries):
        sql = q.get("sql", "")
        file_ref = q.get("file", "unknown")
        line_ref = q.get("line", 0)

        yield _sse_event({
            "type": "batch_progress",
            "message": f"[{i+1}/{total}] Analyzing {file_ref}:{line_ref}...",
            "data": {"current": i + 1, "total": total, "file": file_ref, "line": line_ref},
        })

        try:
            # Run the full analysis pipeline with project context
            metadata = parse_query(sql, dialect)
            if not metadata.get("valid"):
                results.append({
                    "file": file_ref, "line": line_ref, "sql": sql,
                    "error": metadata.get("error", "Parse failed"),
                })
                continue

            issues = detect_antipatterns(sql, metadata)
            indexes = advise_indexes(sql, metadata, project_schema, dialect)
            optimization = optimize_query(sql, metadata, issues, dialect, project_schema=project_schema)
            performance = predict_performance(
                sql, optimization.get("optimized", sql), metadata, issues, dialect
            )
            guard = validate_schema_safety(
                indexes, optimization.get("optimized", sql), project_schema or [], sql
            )

            results.append({
                "file": file_ref,
                "line": line_ref,
                "sql": sql,
                "optimized": optimization.get("optimized", sql),
                "score_before": performance.get("score_before", 50),
                "score_after": performance.get("score_after", 75),
                "issues": issues,
                "indexes": guard.get("approved", indexes),
                "blocked_indexes": guard.get("blocked", []),
                "changes": optimization.get("changes", []),
                "guard": guard,
                "improvement": performance.get("estimated_improvement", ""),
            })

            yield _sse_event({
                "type": "batch_item_done",
                "message": f"[{i+1}/{total}] {file_ref}:{line_ref} — "
                           f"Score {performance.get('score_before', '?')} → {performance.get('score_after', '?')} "
                           f"({len(issues)} issues, {len(guard.get('approved', []))} indexes)",
                "data": results[-1],
            })

        except Exception as e:
            results.append({
                "file": file_ref, "line": line_ref, "sql": sql,
                "error": str(e),
            })
            yield _sse_event({
                "type": "batch_item_error",
                "message": f"[{i+1}/{total}] {file_ref}:{line_ref} — Error: {str(e)}",
            })

    # ── Aggregate results ────────────────────────────────
    valid_results = [r for r in results if "error" not in r]
    if valid_results:
        avg_before = round(sum(r["score_before"] for r in valid_results) / len(valid_results))
        avg_after = round(sum(r["score_after"] for r in valid_results) / len(valid_results))
        total_issues = sum(len(r["issues"]) for r in valid_results)
        total_indexes = sum(len(r["indexes"]) for r in valid_results)
        total_blocked = sum(len(r.get("blocked_indexes", [])) for r in valid_results)

        # Count unchanged (well-optimized) queries
        unchanged = sum(1 for r in valid_results if r.get("guard", {}).get("unchanged_note"))

        aggregate = {
            "avg_score_before": avg_before,
            "avg_score_after": avg_after,
            "total_issues": total_issues,
            "total_indexes_recommended": total_indexes,
            "total_indexes_blocked": total_blocked,
            "unchanged_queries": unchanged,
            "total_analyzed": len(valid_results),
            "total_errors": len(results) - len(valid_results),
        }
    else:
        aggregate = {
            "avg_score_before": 0, "avg_score_after": 0,
            "total_issues": 0, "total_indexes_recommended": 0,
            "total_indexes_blocked": 0, "unchanged_queries": 0,
            "total_analyzed": 0, "total_errors": len(results),
        }

    yield _sse_event({
        "type": "complete",
        "message": f"Batch analysis complete — {len(valid_results)} queries analyzed",
        "time": round(time.time() - start, 1),
        "result": {
            "results": results,
            "aggregate": aggregate,
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
