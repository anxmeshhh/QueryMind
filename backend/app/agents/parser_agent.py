"""Agent 4: SQL Parser — parse SQL into AST using sqlglot."""

import sqlglot
from sqlglot import exp
import re


def parse_query(sql: str, dialect: str = "postgres") -> dict:
    """
    Parse SQL query into structured metadata using sqlglot AST.
    Returns tables, columns, joins, conditions, subqueries, etc.
    """
    dialect_map = {
        "postgresql": "postgres",
        "mysql": "mysql",
        "sqlite": "sqlite",
        "postgres": "postgres",
    }
    dialect_key = dialect_map.get(dialect.lower(), "postgres")

    from app.utils.sanitizer import sanitize_query_placeholders
    sanitized_sql = sanitize_query_placeholders(sql)

    try:
        parsed = sqlglot.parse_one(sanitized_sql, dialect=dialect_key)
    except Exception as e:
        return {
            "error": f"Syntax error: {str(e)}",
            "valid": False,
            "query_type": None,
            "tables": [],
            "columns": [],
            "joins": [],
            "conditions": [],
            "subqueries": 0,
            "has_aggregation": False,
            "has_order_by": False,
            "has_limit": False,
            "has_distinct": False,
        }

    # Query type
    query_type = type(parsed).__name__.upper()
    if isinstance(parsed, exp.Select):
        query_type = "SELECT"
    elif isinstance(parsed, exp.Insert):
        query_type = "INSERT"
    elif isinstance(parsed, exp.Update):
        query_type = "UPDATE"
    elif isinstance(parsed, exp.Delete):
        query_type = "DELETE"

    # Extract tables
    tables = []
    for table in parsed.find_all(exp.Table):
        table_name = table.name
        alias = table.alias or table_name
        tables.append({"name": table_name, "alias": alias})

    # Extract columns (SELECT list)
    columns = []
    if isinstance(parsed, exp.Select):
        for expr in parsed.expressions:
            if isinstance(expr, exp.Star):
                columns.append({"name": "*", "table": None})
            elif isinstance(expr, exp.Column):
                columns.append({
                    "name": expr.name,
                    "table": expr.table or None,
                })
            else:
                columns.append({"name": str(expr), "table": None})

    # Extract JOINs
    joins = []
    for join in parsed.find_all(exp.Join):
        join_type = "INNER"
        if join.args.get("side"):
            join_type = str(join.args["side"]).upper()
        join_table = None
        for t in join.find_all(exp.Table):
            join_table = t.name
            break
        joins.append({
            "type": f"{join_type} JOIN",
            "table": join_table,
        })

    # Check for implicit joins (comma-separated FROM)
    implicit_joins = False
    sql_upper = sql.upper()
    if "FROM" in sql_upper:
        parts = re.split(r"\bFROM\b", sql_upper, maxsplit=1)
        if len(parts) > 1:
            from_part = parts[1]
            for keyword in ["WHERE", "JOIN", "GROUP BY", "ORDER BY", "LIMIT", "HAVING", "UNION"]:
                from_part = re.split(rf"\b{keyword}\b", from_part, maxsplit=1)[0]
            if "," in from_part:
                implicit_joins = True

    # Extract WHERE conditions
    conditions = []
    where = parsed.find(exp.Where)
    if where:
        for cond in where.find_all(exp.EQ, exp.GT, exp.LT, exp.GTE, exp.LTE, exp.Like, exp.NEQ):
            conditions.append(str(cond))

    # Count subqueries
    subqueries = len(list(parsed.find_all(exp.Subquery)))

    # Aggregation
    has_aggregation = bool(list(parsed.find_all(exp.AggFunc)))

    # ORDER BY
    has_order_by = parsed.find(exp.Order) is not None

    # LIMIT
    has_limit = parsed.find(exp.Limit) is not None

    # DISTINCT
    has_distinct = False
    if isinstance(parsed, exp.Select) and parsed.args.get("distinct"):
        has_distinct = True

    # GROUP BY columns
    group_by_cols = []
    group = parsed.find(exp.Group)
    if group:
        for col in group.find_all(exp.Column):
            group_by_cols.append(col.name)

    # ORDER BY columns
    order_by_cols = []
    order = parsed.find(exp.Order)
    if order:
        for col in order.find_all(exp.Column):
            order_by_cols.append(col.name)

    return {
        "valid": True,
        "query_type": query_type,
        "tables": tables,
        "columns": columns,
        "joins": joins,
        "implicit_joins": implicit_joins,
        "conditions": conditions,
        "subqueries": subqueries,
        "has_aggregation": has_aggregation,
        "has_order_by": has_order_by,
        "has_limit": has_limit,
        "has_distinct": has_distinct,
        "group_by_columns": group_by_cols,
        "order_by_columns": order_by_cols,
    }


def optimize_with_sqlglot(sql: str, dialect: str = "postgres") -> str:
    """Use sqlglot's built-in optimizer for structural improvements."""
    dialect_map = {
        "postgresql": "postgres",
        "mysql": "mysql",
        "sqlite": "sqlite",
        "postgres": "postgres",
    }
    dialect_key = dialect_map.get(dialect.lower(), "postgres")

    try:
        optimized = sqlglot.transpile(sql, read=dialect_key, write=dialect_key, pretty=True)[0]
        return optimized
    except Exception:
        return sql
