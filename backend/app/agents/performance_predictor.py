"""Agent 8: Performance Predictor — estimates query cost, performance impact, and simulates explain plans."""

import json
from app.services.groq_client import ask_groq


def predict_performance(sql: str, optimized_sql: str, metadata: dict, issues: list, dialect: str = "postgresql") -> dict:
    """
    Predict performance score (0-100) for original and optimized queries.
    Uses AI reasoning + heuristic scoring, and adds a generated mock plan.
    """
    # Heuristic base score
    base_score = _heuristic_score(metadata, issues)
    mock_plan = generate_mock_plan(metadata, dialect)

    # AI-powered detailed analysis
    prompt = f"""You are a database performance expert. Score this SQL query's performance.

ORIGINAL QUERY:
{sql}

OPTIMIZED QUERY:
{optimized_sql}

ISSUES FOUND: {len(issues)}
{chr(10).join(f'- [{i["severity"]}] {i["name"]}' for i in issues[:5])}

Respond in this exact JSON format (no markdown, no code fences):
{{
  "score_before": <number 0-100>,
  "score_after": <number 0-100>,
  "scalability": "<short description of how query scales with data>",
  "bottleneck": "<main performance bottleneck>",
  "estimated_improvement": "<e.g., '3-5x faster'>"
}}

Scoring guide:
- 0-20: Critical (full table scans, cartesian products)
- 21-40: Poor (missing indexes, correlated subqueries)
- 41-60: Fair (suboptimal JOINs, unnecessary columns)
- 61-80: Good (mostly optimized, minor improvements possible)
- 81-100: Excellent (well-indexed, efficient, scalable)

Return valid JSON only."""

    try:
        response = ask_groq(prompt, max_tokens=256).strip()
        if response.startswith("```"):
            response = response.split("```")[1]
            if response.startswith("json"):
                response = response[4:]
        response = response.strip()

        result = json.loads(response)
        return {
            "score_before": result.get("score_before", base_score),
            "score_after": result.get("score_after", min(base_score + 30, 95)),
            "scalability": result.get("scalability", "Unknown"),
            "bottleneck": result.get("bottleneck", "See issues above"),
            "estimated_improvement": result.get("estimated_improvement", "Moderate"),
            "plan": mock_plan,
        }
    except Exception:
        # Fallback to heuristic
        return {
            "score_before": base_score,
            "score_after": min(base_score + 25, 92),
            "scalability": _estimate_scalability(metadata),
            "bottleneck": issues[0]["name"] if issues else "No major issues",
            "estimated_improvement": f"{max(1, (min(base_score+25,92) - base_score) * 100 // max(base_score,1))}% faster",
            "plan": mock_plan,
        }


def _heuristic_score(metadata: dict, issues: list) -> int:
    """Calculate a base performance score from issues and query structure."""
    score = 85  # Start optimistic

    # Deduct for issues by severity
    for issue in issues:
        if issue["severity"] == "critical":
            score -= 15
        elif issue["severity"] == "medium":
            score -= 8
        elif issue["severity"] == "low":
            score -= 3

    # Deduct for complexity
    if metadata.get("subqueries", 0) > 0:
        score -= 5 * metadata["subqueries"]
    if metadata.get("implicit_joins"):
        score -= 5
    if len(metadata.get("tables", [])) > 3:
        score -= 5
    if not metadata.get("has_limit") and not metadata.get("has_aggregation"):
        score -= 5

    return max(5, min(score, 100))


def _estimate_scalability(metadata: dict) -> str:
    """Rough scalability estimate."""
    tables = len(metadata.get("tables", []))
    subqueries = metadata.get("subqueries", 0)

    if subqueries > 1 or tables > 3:
        return "Degrades significantly at 10K+ rows per table"
    elif not metadata.get("has_limit"):
        return "May slow down at 100K+ rows without LIMIT"
    else:
        return "Should scale well to 500K+ rows with proper indexes"


def generate_mock_plan(metadata: dict, dialect: str = "postgresql") -> list:
    """
    Generate a highly realistic mock explain plan tree structure for PostgreSQL,
    MySQL or SQLite, matching the target query's metadata.
    """
    dialect = dialect.lower()
    tables = metadata.get("tables", [])
    joins = metadata.get("joins", [])
    has_limit = metadata.get("has_limit", False)
    has_order_by = metadata.get("has_order_by", False)
    has_agg = metadata.get("has_aggregation", False)

    if dialect in ["postgresql", "postgres"]:
        # PostgreSQL JSON format
        subplans = []
        for i, tbl in enumerate(tables):
            name = tbl.get("name", "table")
            alias = tbl.get("alias", "")
            
            # First table is typically Seq Scan, subsequent tables are Seq Scan or Index Scan
            scan_type = "Seq Scan" if i == 0 else "Index Scan"
            idx_name = f"idx_{name}_pkey" if scan_type == "Index Scan" else ""
            
            plan_node = {
                "Node Type": scan_type,
                "Relation Name": name,
                "Alias": alias or name,
                "Startup Cost": 0.00 if scan_type == "Seq Scan" else 0.25,
                "Total Cost": 85.00 if scan_type == "Seq Scan" else 8.15,
                "Plan Rows": 1250 if scan_type == "Seq Scan" else 1,
                "Plan Width": 32,
            }
            if idx_name:
                plan_node["Index Name"] = idx_name
                plan_node["Index Cond"] = f"({alias or name}.id = join_col)"
            else:
                plan_node["Filter"] = "(status = 'active')"
                
            subplans.append(plan_node)

        # Merge subplans using Nested Loops or Hash Joins
        root_plan = subplans[0] if subplans else {
            "Node Type": "Result",
            "Startup Cost": 0.00,
            "Total Cost": 0.01,
            "Plan Rows": 1,
            "Plan Width": 8
        }

        for sub in subplans[1:]:
            root_plan = {
                "Node Type": "Nested Loop",
                "Startup Cost": 0.25,
                "Total Cost": root_plan.get("Total Cost", 10.0) + sub.get("Total Cost", 10.0) + 5.0,
                "Plan Rows": root_plan.get("Plan Rows", 1) * sub.get("Plan Rows", 1),
                "Plan Width": root_plan.get("Plan Width", 8) + sub.get("Plan Width", 8),
                "Plans": [root_plan, sub]
            }

        # Apply sort / limits / aggregates
        if has_agg:
            root_plan = {
                "Node Type": "Aggregate",
                "Strategy": "Sorted",
                "Total Cost": root_plan.get("Total Cost", 10.0) + 15.0,
                "Plan Rows": 1,
                "Plan Width": 16,
                "Plans": [root_plan]
            }
        elif has_order_by:
            root_plan = {
                "Node Type": "Sort",
                "Sort Key": ["sort_key"],
                "Total Cost": root_plan.get("Total Cost", 10.0) + 20.0,
                "Plan Rows": root_plan.get("Plan Rows", 1),
                "Plan Width": root_plan.get("Plan Width", 8),
                "Plans": [root_plan]
            }

        if has_limit:
            root_plan = {
                "Node Type": "Limit",
                "Total Cost": min(10.0, root_plan.get("Total Cost", 10.0)),
                "Plan Rows": 10,
                "Plan Width": root_plan.get("Plan Width", 8),
                "Plans": [root_plan]
            }

        return [{"Plan": root_plan}]

    elif dialect == "mysql":
        # MySQL JSON / explain table format
        plan_rows = []
        for i, tbl in enumerate(tables):
            name = tbl.get("name", "table")
            plan_rows.append({
                "id": 1,
                "select_type": "SIMPLE",
                "table": name,
                "partitions": None,
                "type": "ALL" if i == 0 else "ref",
                "possible_keys": f"PRIMARY,idx_{name}_lookup",
                "key": "PRIMARY" if i > 0 else "NULL",
                "key_len": "4" if i > 0 else None,
                "ref": "const" if i > 0 else None,
                "rows": 1000 if i == 0 else 1,
                "filtered": 100.0 if i > 0 else 10.0,
                "Extra": "Using where" if i == 0 else "Using index"
            })
        return plan_rows

    else:
        # SQLite text output steps
        plan_steps = []
        for i, tbl in enumerate(tables):
            name = tbl.get("name", "table")
            if i == 0:
                plan_steps.append(f"SCAN TABLE {name} AS {tbl.get('alias', name)}")
            else:
                plan_steps.append(f"SEARCH TABLE {name} AS {tbl.get('alias', name)} USING INTKEY INDEX (rowid=?)")
        if has_order_by:
            plan_steps.append("USE TEMP B-TREE FOR ORDER BY")
        return plan_steps
