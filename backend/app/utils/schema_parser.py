"""Parse CREATE TABLE statements into structured schema models."""

import re


def parse_schema_sql(schema_sql: str) -> list:
    """
    Parse CREATE TABLE SQL into structured schema.
    Returns list of table dicts with columns, indexes, etc.
    """
    tables = []
    # Find all CREATE TABLE blocks
    table_pattern = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"']?(\w+)[`\"']?\s*\((.*?)\)\s*;?",
        re.DOTALL | re.IGNORECASE,
    )

    for match in table_pattern.finditer(schema_sql):
        table_name = match.group(1)
        body = match.group(2)
        columns = []
        indexes = []
        primary_key = None
        foreign_keys = []

        # Split by comma but respect parentheses
        parts = _split_columns(body)

        for part in parts:
            part = part.strip()
            if not part:
                continue

            upper = part.upper().strip()

            # PRIMARY KEY constraint
            if upper.startswith("PRIMARY KEY"):
                pk_match = re.search(r"\(([^)]+)\)", part)
                if pk_match:
                    primary_key = [c.strip().strip("`\"'") for c in pk_match.group(1).split(",")]
                continue

            # FOREIGN KEY constraint
            if upper.startswith("FOREIGN KEY"):
                fk_match = re.search(
                    r"FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(\w+)\s*\(([^)]+)\)",
                    part,
                    re.IGNORECASE,
                )
                if fk_match:
                    foreign_keys.append({
                        "column": fk_match.group(1).strip().strip("`\"'"),
                        "ref_table": fk_match.group(2).strip().strip("`\"'"),
                        "ref_column": fk_match.group(3).strip().strip("`\"'"),
                    })
                continue

            # INDEX / UNIQUE constraint
            if upper.startswith(("INDEX", "UNIQUE", "KEY")):
                idx_match = re.search(r"\(([^)]+)\)", part)
                if idx_match:
                    idx_cols = [c.strip().strip("`\"'") for c in idx_match.group(1).split(",")]
                    indexes.append({
                        "columns": idx_cols,
                        "unique": "UNIQUE" in upper,
                    })
                continue

            # CONSTRAINT
            if upper.startswith("CONSTRAINT"):
                if "FOREIGN KEY" in upper:
                    fk_match = re.search(
                        r"FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(\w+)\s*\(([^)]+)\)",
                        part,
                        re.IGNORECASE,
                    )
                    if fk_match:
                        foreign_keys.append({
                            "column": fk_match.group(1).strip().strip("`\"'"),
                            "ref_table": fk_match.group(2).strip().strip("`\"'"),
                            "ref_column": fk_match.group(3).strip().strip("`\"'"),
                        })
                continue

            # Regular column definition
            col = _parse_column(part)
            if col:
                columns.append(col)
                if col.get("primary_key"):
                    primary_key = [col["name"]]

        tables.append({
            "name": table_name,
            "columns": columns,
            "indexes": indexes,
            "primary_key": primary_key or [],
            "foreign_keys": foreign_keys,
        })

    return tables


def _split_columns(body: str) -> list:
    """Split column definitions respecting parentheses nesting."""
    parts = []
    depth = 0
    current = []
    for char in body:
        if char == "(":
            depth += 1
            current.append(char)
        elif char == ")":
            depth -= 1
            current.append(char)
        elif char == "," and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
    if current:
        parts.append("".join(current))
    return parts


def _parse_column(definition: str) -> dict | None:
    """Parse a single column definition like 'id INT PRIMARY KEY NOT NULL'."""
    parts = definition.strip().split()
    if len(parts) < 2:
        return None

    name = parts[0].strip("`\"'")
    # Skip if name is a SQL keyword (it's a constraint, not a column)
    if name.upper() in ("CHECK", "CONSTRAINT", "UNIQUE", "INDEX", "KEY"):
        return None

    data_type = parts[1].upper()
    # Handle types like VARCHAR(255)
    if len(parts) > 2 and parts[2].startswith("("):
        data_type += parts[2]

    upper_def = definition.upper()
    return {
        "name": name,
        "type": data_type,
        "nullable": "NOT NULL" not in upper_def,
        "primary_key": "PRIMARY KEY" in upper_def,
        "references": None,  # Will be filled by FK constraints
    }
