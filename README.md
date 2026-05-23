<div align="center">

# QueryMind

### Database Engineering Platform

**Scan codebases. Connect live databases. Detect anti-patterns. Get optimized rewrites.**

A full-stack, multi-agent query analysis system that discovers SQL across your project files, runs them through a 9-agent intelligence pipeline, and delivers scored optimizations with schema safety guarantees — all streamed in real-time.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.1-000000?logo=flask)](https://flask.palletsprojects.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TanStack](https://img.shields.io/badge/TanStack_Router-1.x-FF4154)](https://tanstack.com/router)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_&_DB-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)

</div>

---

## What It Does

QueryMind takes any SQL — whether you paste it directly, upload a project folder, clone a GitHub repo, or connect a live database — and runs it through a pipeline of specialized analysis agents. Each agent handles one concern (parsing, anti-patterns, indexing, optimization, performance prediction, schema safety), and their results combine into a scored, actionable report.

### Three Ways In

| Mode | What Happens |
|------|-------------|
| **Quick Analyze** | Paste SQL → instant analysis. Supports a **Natural Language** tab where you describe what you want in plain English and the system generates + analyzes the SQL for you. |
| **Project Scanner** | Upload local files or enter a GitHub URL. The system traverses every file, extracts SQL statements, infers schema from ORM models, and batch-analyzes all discovered queries. |
| **Live Database** | Connect to a running PostgreSQL, MySQL, or SQLite instance. Runs real `EXPLAIN` plans, discovers the live schema, and uses it as context for all analyses. |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React 19)                    │
│  TanStack Router · TanStack Query · Tailwind CSS 4       │
│  Supabase Auth (Google/GitHub OAuth + OTP)                │
├──────────────────────────────────────────────────────────┤
│              SSE (Server-Sent Events) Stream              │
├──────────────────────────────────────────────────────────┤
│                    BACKEND (Flask 3.1)                    │
│                                                          │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │  Orchestrator│──│  9 Agent Pipeline │──│ Groq LLM   │  │
│  │  (SSE stream)│  │  (parallel exec)  │  │ (LLaMA 3.1)│  │
│  └─────────────┘  └──────────────────┘  └────────────┘  │
│                                                          │
│  ┌────────────┐  ┌───────────────┐  ┌─────────────────┐ │
│  │ SQL Parser  │  │ GitHub Scanner│  │ DB Connectors   │ │
│  │ (sqlglot)   │  │ (git clone)   │  │ (psycopg2/mysql)│ │
│  └────────────┘  └───────────────┘  └─────────────────┘ │
├──────────────────────────────────────────────────────────┤
│                  SUPABASE (PostgreSQL)                    │
│  Auth · user_profiles · analyses · saved_queries · RLS   │
└──────────────────────────────────────────────────────────┘
```

---

## The 9 Agent Pipeline

When you submit a query, these agents execute (some in parallel) and stream their progress via SSE:

| # | Agent | What It Does | How It Works |
|---|-------|-------------|-------------|
| 1 | **Parser** | Breaks SQL into an AST (abstract syntax tree) | Uses `sqlglot` to extract tables, joins, clauses, and query type |
| 2 | **Anti-Pattern Detector** | Finds 20+ known SQL anti-patterns | Rule-based engine: `SELECT *`, implicit joins, missing `LIMIT`, cartesian products, `LIKE '%...'`, etc. |
| 3 | **Index Advisor** | Suggests indexes to speed up the query | Groq LLM analyzes `WHERE`, `JOIN`, and `ORDER BY` columns against the schema |
| 4 | **Query Optimizer** | Rewrites the SQL for better performance | Groq LLM applies rewrite strategies: explicit joins, subquery elimination, pagination |
| 5 | **Performance Predictor** | Scores the query before and after (0–100) | Heuristic model combining anti-pattern severity, index coverage, and rewrite impact |
| 6 | **Schema Guard** | Validates that suggested indexes are safe | Detects duplicate indexes, naming conflicts, and estimates storage impact |
| 7 | **File Scanner** | Extracts SQL from source files | Regex + AST-based extraction across `.py`, `.js`, `.ts`, `.java`, `.sql`, `.go`, `.rb`, `.php` |
| 8 | **Schema Builder** | Infers schema from ORM models and DDL | Parses SQLAlchemy, Django, Prisma, TypeORM, and raw `CREATE TABLE` statements |
| 9 | **NL-to-SQL** | Converts natural language to SQL | Groq LLM with schema context generates production-ready queries from English descriptions |

Agents 3 and 4 (Index Advisor + Query Optimizer) run **in parallel** using Python's `concurrent.futures` for faster turnaround.

---

## Key Features

### Natural Language to SQL
Describe what you need in plain English:
> *"Show me all users who signed up this week and haven't verified their email"*

The system generates a SQL query, assigns a confidence score, and immediately runs it through the full analysis pipeline.

### Real-Time Streaming
Every agent's progress is streamed to the browser via Server-Sent Events (SSE). You see each agent start, find issues, and complete — live. No waiting for the full result.

### Query Diff Viewer
After optimization, the Results Panel shows an **inline diff** (additions in green, removals in red) or a **side-by-side** comparison of original vs. optimized SQL.

### GitHub Repository Scanning
Enter a public GitHub URL → the backend shallow-clones the repo, extracts source files, and feeds them into the scanner. No manual file uploads needed.

### Schema Sharing
When you connect a live database, the discovered schema is saved and automatically shared with Quick Analyze and Project Scanner modes. This means every analysis has full schema context.

### Gamification
- **XP System**: Earn XP for every analysis (25 base + 10 per issue found)
- **10 Achievement Badges**: From "First Scan" to "Command Master"
- **XP Toast Notifications**: Animated popups when you earn XP
- **Level Progression**: Level up every 100 XP

### Authentication
- **Google OAuth** and **GitHub OAuth** via Supabase
- **OTP Email Verification** for new signups (6-digit code via Gmail SMTP)
- JWT access tokens with 15-minute expiry and 7-day refresh tokens

### Export
- **Markdown Report**: Download a full analysis report as `.md`
- **Index Script**: Download all recommended indexes as a `.sql` file

---

## Tech Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11+ | Runtime |
| Flask | 3.1 | HTTP server, SSE streaming, REST API |
| sqlglot | 25.8 | SQL parsing, AST generation, dialect translation |
| Groq SDK | 0.11 | LLM inference (LLaMA 3.1 8B Instant) |
| psycopg2 | 2.9 | PostgreSQL live connection |
| mysql-connector | 9.0 | MySQL live connection |
| python-dotenv | 1.0 | Environment variable management |
| gunicorn | 23.0 | Production WSGI server |

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI rendering |
| TypeScript | 5.8 | Type safety |
| TanStack Router | 1.x | File-based routing with type-safe navigation |
| TanStack Query | 5.x | Server state management |
| Tailwind CSS | 4.x | Utility-first styling |
| Radix UI | Latest | Accessible, unstyled UI primitives |
| Supabase JS | 2.x | Auth, database client |
| Vite | 7.x | Build tool and dev server |
| Lucide React | 0.575 | Icon library |
| Sonner | 2.x | Toast notifications |
| Recharts | 2.x | Data visualization |
| input-otp | 1.4 | OTP input component |
| Zod | 3.x | Schema validation |

### Infrastructure

| Service | Purpose |
|---------|---------|
| Supabase | Auth (OAuth + email), PostgreSQL database, Row Level Security |
| Groq Cloud | LLM inference API (free tier, ~500 RPM) |
| Gmail SMTP | OTP email delivery |

---

## Project Structure

```
querymind/
├── backend/
│   ├── app/
│   │   ├── agents/                # The 9 analysis agents
│   │   │   ├── orchestrator.py    # Coordinates all agents, SSE streaming
│   │   │   ├── parser_agent.py    # SQL → AST via sqlglot
│   │   │   ├── antipattern_detector.py  # 20+ rule-based checks
│   │   │   ├── index_advisor.py   # LLM-powered index suggestions
│   │   │   ├── query_optimizer.py # LLM-powered SQL rewrites
│   │   │   ├── performance_predictor.py # Score estimation
│   │   │   ├── schema_guard.py    # Index safety validation
│   │   │   ├── file_scanner.py    # Extract SQL from source files
│   │   │   ├── db_connector.py    # Live DB connections + EXPLAIN
│   │   │   └── nl_to_sql.py       # Natural language → SQL
│   │   ├── services/
│   │   │   ├── groq_client.py     # Groq LLM API wrapper
│   │   │   └── github_scanner.py  # GitHub repo cloner
│   │   ├── utils/
│   │   │   ├── sanitizer.py       # SQL injection prevention
│   │   │   ├── schema_parser.py   # CREATE TABLE DDL parser
│   │   │   └── sql_patterns.py    # Regex patterns for SQL extraction
│   │   ├── config.py              # Environment configuration
│   │   └── main.py                # Flask app factory + all routes
│   ├── tests/                     # Unit tests
│   ├── requirements.txt
│   └── .env                       # API keys and secrets
│
├── frontend/
│   ├── src/
│   │   ├── routes/                # TanStack file-based routes
│   │   │   ├── __root.tsx         # Root layout (auth, toasts, shortcuts)
│   │   │   ├── index.tsx          # Landing page
│   │   │   ├── quick.tsx          # Quick Analyze + NL-to-SQL
│   │   │   ├── scan.tsx           # Project Scanner + GitHub import
│   │   │   ├── connect.tsx        # Live Database connection
│   │   │   ├── login.tsx          # Email/password + OAuth login
│   │   │   └── signup.tsx         # Registration
│   │   ├── components/
│   │   │   ├── TopBar.tsx         # Navigation + gamification
│   │   │   ├── ResultsPanel.tsx   # Analysis results display
│   │   │   ├── QueryDiff.tsx      # Inline/side-by-side diff viewer
│   │   │   ├── ActivityLog.tsx    # Real-time agent log stream
│   │   │   ├── HistoryDrawer.tsx  # Past analyses browser
│   │   │   ├── XpToast.tsx        # XP gain notifications
│   │   │   ├── OnboardingTour.tsx # First-time user walkthrough
│   │   │   ├── OtpVerification.tsx# OTP email verification
│   │   │   ├── KeyboardShortcuts.tsx # Ctrl+/ shortcut overlay
│   │   │   ├── SectionHeader.tsx  # Reusable page header
│   │   │   └── scan/
│   │   │       ├── BatchDashboard.tsx  # Aggregate scan results
│   │   │       ├── OptimizationFlow.tsx # Visual agent flow diagram
│   │   │       └── SchemaERD.tsx  # Schema entity cards
│   │   ├── lib/
│   │   │   ├── api.ts             # Backend API client (SSE + REST)
│   │   │   ├── auth.tsx           # Auth context (Supabase + OTP)
│   │   │   ├── history.ts         # Supabase analysis history
│   │   │   └── supabase.ts        # Supabase client init
│   │   └── styles.css             # Design system (CSS variables + utilities)
│   └── package.json
│
└── supabase_migration.sql         # Database schema with RLS policies
```

---

## Getting Started

### Prerequisites
- **Python 3.11+** and **pip**
- **Node.js 18+** and **npm**
- **Git** (for GitHub repo scanning)
- A [Groq](https://console.groq.com) API key (free tier works)
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/querymind.git
cd querymind
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file:

```env
# Groq LLM
GROQ_API_KEY="your-groq-api-key"
GROQ_MODEL="llama-3.1-8b-instant"

# Supabase
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-anon-key"

# Auth
FERNET_KEY="your-fernet-key"
JWT_SECRET="your-jwt-secret"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# SMTP for OTP (optional)
OTP_ENABLED="true"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="QueryMind<your-email@gmail.com>"
```

Start the backend:

```bash
python run.py
# Server starts on http://localhost:5000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# App starts on http://localhost:5173
```

### 4. Database Setup

Run `supabase_migration.sql` in your Supabase SQL Editor to create the required tables and RLS policies.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/analyze` | Analyze a SQL query (SSE stream) |
| `POST` | `/api/v1/scan` | Scan uploaded files for SQL (SSE stream) |
| `POST` | `/api/v1/analyze-batch` | Batch analyze multiple queries (SSE stream) |
| `POST` | `/api/v1/connect` | Test database connection |
| `POST` | `/api/v1/explain` | Run EXPLAIN on a live database (SSE stream) |
| `POST` | `/api/v1/nl-to-sql` | Convert natural language to SQL |
| `POST` | `/api/v1/scan-github` | Clone and scan a GitHub repository |
| `POST` | `/api/v1/send-otp` | Send OTP verification email |
| `POST` | `/api/v1/verify-otp` | Verify OTP code |
| `GET`  | `/api/v1/health` | Health check |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Run analysis / Start scan |
| `Ctrl+K` | Focus search input |
| `Ctrl+H` | Toggle history drawer |
| `Ctrl+/` | Show keyboard shortcuts |
| `Esc` | Close modals and panels |

---

## Security

- **SQL Injection Prevention**: All user-submitted SQL is sanitized before processing. Live database connections use parameterized queries and read-only transactions.
- **Row Level Security**: Supabase RLS ensures users can only access their own data.
- **Connection String Validation**: Database URIs are validated against an allowlist of supported schemes.
- **Rate Limiting**: API endpoints are rate-limited (30/min for analyze, 10/min for scan, 5/min for connect).
- **OTP Verification**: New OAuth signups require email verification before account activation.
- **PII Encryption**: Sensitive fields use Fernet symmetric encryption.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with Flask, React, and a lot of SQL.**

</div>