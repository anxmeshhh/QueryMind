"""Unit tests for QueryMind backend analysis agents and utilities."""

import unittest
import sys
import os

# Add parent dir to sys.path so we can import app modules directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agents.antipattern_detector import detect_antipatterns
from app.agents.parser_agent import parse_query
from app.utils.sanitizer import sanitize_sql


class TestQueryMindAgents(unittest.TestCase):
    """Test suite verifying parser engines, sanitizers, and rule-based detectors."""

    def test_sql_sanitizer(self):
        """Verify that blocked statements are flagged and valid queries are sanitized."""
        sql = "   SELECT * FROM users;   "
        clean_sql = sanitize_sql(sql)
        self.assertEqual(clean_sql, "SELECT * FROM users;")

        # Test blocked statement raising ValueError
        with self.assertRaises(ValueError):
            sanitize_sql("DROP TABLE users;")

    def test_implicit_join_detection(self):
        """Verify that comma-separated implicit joins are flagged."""
        sql = "SELECT * FROM users u, orders o WHERE u.id = o.user_id;"
        metadata = parse_query(sql)
        issues = detect_antipatterns(sql, metadata)
        implicit_join_issues = [i for i in issues if "implicit" in i["name"].lower() or "join" in i["name"].lower() or i["rule_id"] == 4]
        self.assertTrue(len(implicit_join_issues) > 0)

    def test_select_all_detection(self):
        """Verify that SELECT * statements are successfully identified."""
        sql = "SELECT * FROM products WHERE price > 100;"
        metadata = parse_query(sql)
        issues = detect_antipatterns(sql, metadata)
        select_star_issues = [i for i in issues if i["rule_id"] == 1 or "select *" in i["name"].lower()]
        self.assertTrue(len(select_star_issues) > 0)

    def test_non_sargable_like_wildcard(self):
        """Verify that leading wildcards in LIKE comparisons are marked as poor index search candidates."""
        sql = "SELECT * FROM employees WHERE email LIKE '%@gmail.com';"
        metadata = parse_query(sql)
        issues = detect_antipatterns(sql, metadata)
        wildcard_issues = [i for i in issues if "like" in i["name"].lower() or "wildcard" in i["name"].lower() or i["rule_id"] == 5]
        self.assertTrue(len(wildcard_issues) > 0)


if __name__ == "__main__":
    unittest.main()
