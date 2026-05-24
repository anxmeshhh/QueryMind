import unittest
from unittest.mock import patch
from app.agents.ai_chat import chat, _extract_sql
from app.agents.ai_explain import explain_query, compare_queries


class TestAiAgents(unittest.TestCase):
    @patch("app.agents.ai_chat.ask_groq")
    def test_ai_chat_response(self, mock_ask_groq):
        mock_ask_groq.return_value = "Here is the SQL you need: ```sql\nSELECT * FROM test;\n```"
        
        res = chat(
            session_id="test_session",
            message="give me a select query on test",
            schema=[{"name": "test", "columns": ["id"]}]
        )
        
        self.assertIn("Here is the SQL", res["response"])
        self.assertEqual(res["sql"], "SELECT * FROM test;")
        self.assertTrue(len(res["suggestions"]) > 0)

    def test_extract_sql(self):
        text = "This is a query:\n```sql\nSELECT id FROM users;\n```\nHope this helps!"
        sql = _extract_sql(text)
        self.assertEqual(sql, "SELECT id FROM users;")

        text_plain = "Here is another:\n```\nSELECT * FROM posts;\n```"
        sql_plain = _extract_sql(text_plain)
        self.assertEqual(sql_plain, "SELECT * FROM posts;")

    @patch("app.agents.ai_explain.ask_groq")
    def test_explain_query(self, mock_ask_groq):
        mock_ask_groq.return_value = """
        {
          "summary": "Retrieve all rows from users",
          "steps": [
            {"step": 1, "operation": "FROM", "clause": "FROM users", "description": "Scan the users table"}
          ],
          "business_logic": "View list of users",
          "edge_cases": ["Full table scan if unindexed"],
          "complexity": "simple",
          "tables_involved": ["users"]
        }
        """
        res = explain_query("SELECT * FROM users;")
        self.assertEqual(res["summary"], "Retrieve all rows from users")
        self.assertEqual(res["complexity"], "simple")
        self.assertEqual(res["tables_involved"], ["users"])

    @patch("app.agents.ai_explain.ask_groq")
    def test_compare_queries(self, mock_ask_groq):
        mock_ask_groq.return_value = """
        {
          "summary": "Queries are different in join structure",
          "differences": [
            {"aspect": "JOIN type", "query_a": "INNER JOIN", "query_b": "LEFT JOIN", "verdict": "Use inner join for matching rows"}
          ],
          "performance_verdict": "Query A is faster",
          "recommendation": "Use Query A"
        }
        """
        res = compare_queries("SELECT * FROM a INNER JOIN b ON a.id = b.id", "SELECT * FROM a LEFT JOIN b ON a.id = b.id")
        self.assertEqual(res["performance_verdict"], "Query A is faster")
        self.assertEqual(res["recommendation"], "Use Query A")


if __name__ == "__main__":
    unittest.main()
