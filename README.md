# QueryMind — AI Database Query Optimizer

An 8-agent AI pipeline that analyzes SQL queries, detects anti-patterns, recommends indexes, and optimizes performance.

## Features

- **⚡ Quick Analyze** — Paste SQL, get instant AI-powered analysis
- **📁 Scan Project** — Upload code files, auto-discover all SQL queries
- **🔌 Live Database** — Connect to PostgreSQL/MySQL/SQLite for real EXPLAIN plans

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Flask, Python, sqlglot, Groq AI |
| Frontend | React 19, TanStack Router, TailwindCSS 4, TypeScript |
| AI | Groq (Llama 3.3 70B) |
| Database | Supabase (PostgreSQL) |

## 8 Analysis Agents

1. **File Scanner** — Regex-based SQL detection in Python/JS/Java code
2. **Database Connector** — Read-only live DB connections
3. **Schema Discovery** — Auto-discovers tables, columns, indexes
4. **SQL Parser** — sqlglot AST parsing (30+ dialects)
5. **Anti-Pattern Detector** — 20 deterministic rules
6. **Index Advisor** — AI-powered index recommendations
7. **Query Optimizer** — sqlglot + AI query rewriting
8. **Performance Predictor** — Cost estimation and scoring

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Add your GROQ_API_KEY to .env
python -m app.main
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/analyze` | Quick analysis (SSE stream) |
| POST | `/api/v1/scan` | Project file scan (SSE stream) |
| POST | `/api/v1/connect` | Database connection + schema (SSE stream) |
| POST | `/api/v1/explain` | EXPLAIN ANALYZE + full analysis (SSE stream) |

## Security

- Read-only database connections
- Input sanitization (DDL blocking, size limits)
- Security headers (CSP, HSTS, X-Frame-Options)
- CORS whitelist
- No credential storage

## License

MIT