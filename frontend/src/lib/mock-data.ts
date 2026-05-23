import type { LogEntry } from "@/components/ActivityLog";
import type { AnalysisResult } from "@/components/ResultsPanel";

export const sampleQueries: Record<string, string> = {
  "Slow Join": `SELECT * FROM users u, orders o
WHERE u.id = o.user_id
AND u.email LIKE '%gmail.com'
ORDER BY o.created_at DESC`,
  "N+1 Query": `SELECT * FROM posts WHERE author_id = 42;
SELECT * FROM comments WHERE post_id = 1;
SELECT * FROM comments WHERE post_id = 2;
SELECT * FROM comments WHERE post_id = 3;`,
  "Full Scan": `SELECT *
FROM events
WHERE LOWER(event_name) = 'signup'
  AND created_at > '2024-01-01';`,
};

export const analysisLog: LogEntry[] = [
  { time: "00:00.2s", agent: "parser", message: "Parsed SQL → 2 tables, 1 implicit join, SELECT with ORDER BY", level: "info" },
  { time: "00:00.5s", agent: "rules", message: "● CRITICAL: SELECT * across joined tables", level: "critical" },
  { time: "00:00.5s", agent: "rules", message: "● CRITICAL: Leading wildcard LIKE '%gmail.com'", level: "critical" },
  { time: "00:00.6s", agent: "rules", message: "○ MEDIUM: Implicit JOIN syntax (comma-separated tables)", level: "warning" },
  { time: "00:01.2s", agent: "index", message: "orders.user_id → missing index for JOIN condition", level: "index" },
  { time: "00:01.2s", agent: "index", message: "orders.created_at → missing index for ORDER BY", level: "index" },
  { time: "00:02.1s", agent: "optimize", message: "Rewrote query: implicit→explicit JOINs, column pruning, added LIMIT", level: "index" },
  { time: "00:03.4s", agent: "predict", message: "Score: 34 → 87 (+156% improvement)", level: "info" },
  { time: "00:03.4s", agent: "done", message: "Analysis complete — 3 issues, 2 indexes, 1 rewrite", level: "success" },
];

export const mockResult: AnalysisResult = {
  scoreBefore: 34,
  scoreAfter: 87,
  improvement: "+156% improvement",
  issues: [
    {
      severity: "CRITICAL",
      title: "SELECT * on joined tables",
      description:
        "Fetching all columns from 2 joined tables wastes I/O. Specify only needed columns.",
    },
    {
      severity: "CRITICAL",
      title: "Leading wildcard in LIKE",
      description:
        "LIKE '%gmail.com' prevents index usage on email column, causing full table scan.",
    },
    {
      severity: "MEDIUM",
      title: "Implicit JOIN syntax",
      description:
        "Comma-separated tables are error-prone. Use explicit JOIN ... ON syntax.",
    },
  ],
  optimizedSql: `SELECT u.id, u.email, u.name,
       o.id AS order_id, o.total, o.created_at
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE u.email LIKE '%gmail.com'
ORDER BY o.created_at DESC
LIMIT 100;`,
  indexes: [
    {
      table: "orders",
      sql: "CREATE INDEX idx_orders_user_id ON orders(user_id);",
      note: "Speeds up JOIN on user_id — est. 4x improvement",
    },
    {
      table: "orders",
      sql: "CREATE INDEX idx_orders_created_at ON orders(created_at DESC);",
      note: "Eliminates sort for ORDER BY",
    },
  ],
};

export const scanLog: LogEntry[] = [
  { time: "00:00.3s", agent: "scanner", message: "Scanning 8 files...", level: "info" },
  { time: "00:00.4s", agent: "scanner", message: "models/user.py → 3 queries found", level: "warning" },
  { time: "00:00.5s", agent: "scanner", message: "routes/orders.py → 5 queries found", level: "warning" },
  { time: "00:00.6s", agent: "scanner", message: "utils/reports.py → 2 queries found", level: "warning" },
  { time: "00:00.7s", agent: "scanner", message: ".env → DATABASE_URL detected (PostgreSQL)", level: "index" },
  { time: "00:01.2s", agent: "done", message: "10 queries discovered in 4 files", level: "success" },
];

export interface DiscoveredQuery {
  severity: "critical" | "warning" | "success";
  path: string;
  preview: string;
  language: string;
}

export const discoveredQueries: DiscoveredQuery[] = [
  { severity: "critical", path: "routes/orders.py:142", preview: "SELECT * FROM orders, users WHERE orders.user_id = users.id AND ...", language: "Python" },
  { severity: "critical", path: "models/user.py:23", preview: "SELECT * FROM users WHERE email LIKE '%' + domain + '%'", language: "Python" },
  { severity: "critical", path: "routes/orders.py:201", preview: "SELECT id FROM products; -- looped per cart item", language: "Python" },
  { severity: "warning", path: "utils/reports.py:88", preview: "SELECT COUNT(*) FROM events WHERE LOWER(name) = 'signup'", language: "Python" },
  { severity: "warning", path: "models/user.py:45", preview: "UPDATE users SET last_seen = NOW() WHERE id IN (...)", language: "Python" },
  { severity: "warning", path: "routes/orders.py:67", preview: "SELECT * FROM orders ORDER BY created_at DESC", language: "Python" },
  { severity: "warning", path: "routes/orders.py:88", preview: "SELECT total FROM orders WHERE status != 'cancelled'", language: "Python" },
  { severity: "success", path: "models/user.py:67", preview: "SELECT id, email FROM users WHERE id = $1", language: "Python" },
  { severity: "success", path: "utils/reports.py:104", preview: "SELECT COUNT(*) FROM orders WHERE id = $1", language: "Python" },
  { severity: "success", path: "routes/orders.py:34", preview: "INSERT INTO orders (user_id, total) VALUES ($1, $2)", language: "Python" },
];

export interface SchemaTable {
  table: string;
  columns: number;
  rows: number;
  indexes: number;
  size: string;
}

export const schemaTables: SchemaTable[] = [
  { table: "users", columns: 8, rows: 52431, indexes: 3, size: "12.4 MB" },
  { table: "orders", columns: 12, rows: 248019, indexes: 2, size: "67.8 MB" },
  { table: "products", columns: 6, rows: 5230, indexes: 1, size: "2.1 MB" },
  { table: "reviews", columns: 5, rows: 89412, indexes: 1, size: "18.3 MB" },
];

export interface PlanNode {
  depth: number;
  operation: string;
  cost: string;
  rows: number;
  pct: number;
  tone: "critical" | "warning" | "success";
}

export const planNodes: PlanNode[] = [
  { depth: 0, operation: "Seq Scan on users", cost: "cost=0..1250", rows: 52431, pct: 71, tone: "warning" },
  { depth: 1, operation: "Filter: email LIKE", cost: "", rows: 0, pct: 0, tone: "warning" },
  { depth: 1, operation: "Hash Join", cost: "cost=1250..8750", rows: 248019, pct: 100, tone: "critical" },
  { depth: 2, operation: "Seq Scan orders", cost: "cost=0..4500", rows: 248019, pct: 89, tone: "critical" },
];
