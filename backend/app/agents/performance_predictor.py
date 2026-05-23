"""Agent 8: Performance Predictor — estimates query cost and performance impact."""

import json
from app.services.groq_client import ask_groq


def predict_performance(sql: str, optimized_sql: str, metadata: dict, issues: list, dialect: str = "postgresql") -> dict:
    """
    Predict performance score (0-100) for original and optimized queries.
    Uses AI reasoning + heuristic scoring.
    """
    # Heuristic base score
    base_score = _heuristic_score(metadata, issues)

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
        response = ask_groq(prompt).strip()
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
        }
    except Exception:
        # Fallback to heuristic
        return {
            "score_before": base_score,
            "score_after": min(base_score + 25, 92),
            "scalability": _estimate_scalability(metadata),
            "bottleneck": issues[0]["name"] if issues else "No major issues",
            "estimated_improvement": f"{max(1, (min(base_score+25,92) - base_score) * 100 // max(base_score,1))}% faster",
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
