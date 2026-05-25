<div align="center">

# QueryMind

### Agentic Database Engineering Platform

**Scan codebases. Connect live databases. Chat with your SQL. Get optimized rewrites — all in real-time.**

A full-stack, multi-agent query analysis system that discovers SQL across your project files, runs them through an 11-agent intelligence pipeline, and delivers scored optimizations with schema safety guarantees — all streamed live via Server-Sent Events.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.1-000000?logo=flask)](https://flask.palletsprojects.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TanStack](https://img.shields.io/badge/TanStack_Router-1.x-FF4154)](https://tanstack.com/router)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_&_DB-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Groq](https://img.shields.io/badge/Groq-LLaMA_3.1-FF6600)](https://groq.com)
[![Cloudflare](https://img.shields.io/badge/Cloudflare_Workers-Deploy-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)

</div>

---

## What It Does

QueryMind takes any SQL — whether you paste it directly, describe it in natural language, upload a project folder, clone a GitHub repo, or connect a live database — and runs it through a pipeline of specialized analysis agents. Each agent handles one concern (parsing, anti-patterns, indexing, optimization, performance prediction, schema safety), and their results combine into a scored, actionable report streamed to your browser in real-time.

### Three Analysis Modes

| Mode | What Happens |
|------|-------------|
| **⚡ Quick Analyze** | Paste SQL → instant analysis. Includes a **Natural Language** tab where you describe what you want in plain English and the system generates + analyzes the SQL for you. Features a Monaco SQL editor with schema-driven autocomplete. |
| **📁 Project Scanner** | Upload local files or enter a GitHub URL. The system traverses every file, extracts SQL statements and ORM schema definitions, infers database structure, and batch-analyzes all discovered queries with a visual optimization flow diagram. |
| **🔌 Live Database** | Connect to a running PostgreSQL, MySQL, or SQLite instance. Runs real `EXPLAIN` plans with an interactive execution plan visualizer, discovers the live schema with a draggable ERD canvas, and uses it as context for all analyses. |

### Plus: AI Chat Assistant

Open the **AI Chat** panel (`Ctrl+J`) to have a multi-turn conversation with QueryMind AI. It has full context of your current query, schema, and analysis results — ask it to explain, optimize, compare, or generate SQL interactively.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React 19)                        │
│  TanStack Router · TanStack Query · Tailwind CSS 4             │
│  Supabase Auth (Google/GitHub OAuth + OTP)                     │
│  Monaco Editor · Framer Motion · ReactFlow · Recharts          │
├────────────────────────────────────────────────────────────────┤
│               SSE (Server-Sent Events) Stream                  │
├────────────────────────────────────────────────────────────────┤
│                     BACKEND (Flask 3.1)                        │
│                                                                │
│  ┌──────────────┐  ┌───────────────────┐  ┌────────────────┐  │
│  │  Orchestrator │──│  11 Agent Pipeline │──│    Groq LLM    │  │
│  │  (SSE stream) │  │  (parallel exec)   │  │  (LLaMA 3.1)  │  │
│  └──────────────┘  └───────────────────┘  └────────────────┘  │
│                                                                │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │  SQL Parser  │  │ GitHub Scanner │  │  DB Connectors   │   │
│  │  (sqlglot)   │  │ (git clone)    │  │  (psycopg2/mysql)│   │
│  └─────────────┘  └────────────────┘  └──────────────────┘   │
│                                                                │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │  Rate Limiter│  │   Sanitizer    │  │  Schema Parser   │   │
│  │  (middleware)│  │ (SQL injection)│  │  (DDL → struct)  │   │
│  └─────────────┘  └────────────────┘  └──────────────────┘   │
├────────────────────────────────────────────────────────────────┤
│                   SUPABASE (PostgreSQL)                         │
│   Auth · user_profiles · analyses · analytics · RLS policies   │
└────────────────────────────────────────────────────────────────┘
```

---

## The 11 Agent Pipeline

When you submit a query, these agents execute (some in parallel) and stream their progress via SSE:

### Core Analysis Pipeline (Agents 1–6)

| # | Agent | What It Does | How It Works |
|---|-------|-------------|-------------|
| 1 | **Parser** | Breaks SQL into an AST (abstract syntax tree) | Uses `sqlglot` to extract tables, joins, clauses, subqueries, and query type |
| 2 | **Anti-Pattern Detector** | Finds 20+ known SQL anti-patterns | Rule-based engine with decorator pattern: `SELECT *`, implicit joins, missing `LIMIT`, cartesian products, `LIKE '%...'`, non-sargable conditions, missing aliases, etc. |
| 3 | **Index Advisor** | Suggests indexes to speed up the query | Groq LLM analyzes `WHERE`, `JOIN`, and `ORDER BY` columns against the schema; skips singleton/tiny tables |
| 4 | **Query Optimizer** | Rewrites the SQL for better performance | `sqlglot` structural optimizations + Groq LLM rewrite strategies: explicit joins, subquery elimination, pagination, column projection |
| 5 | **Performance Predictor** | Scores the query before and after (0–100) | Heuristic model combining anti-pattern severity, index coverage, and rewrite impact + AI-driven scoring with mock execution plan generation |
| 6 | **Schema Guard** | Validates that suggested indexes are safe | Detects duplicate indexes, subset coverage, naming conflicts, FK safety, and estimates storage impact |

> **Note:** Agents 3 and 4 (Index Advisor + Query Optimizer) run **in parallel** using Python's `concurrent.futures.ThreadPoolExecutor` for faster turnaround.

### Auxiliary Agents (Agents 7–11)

| # | Agent | What It Does | How It Works |
|---|-------|-------------|-------------|
| 7 | **File Scanner** | Extracts SQL from source files | Regex + AST-based extraction across `.py`, `.js`, `.ts`, `.java`, `.sql`, `.go`, `.rb`, `.php`, `.rs`, `.kt`, `.cs`, `.c`, `.cpp`; detects ORM models (SQLAlchemy, Django, Prisma, TypeORM) and `CREATE TABLE` DDL |
| 8 | **DB Connector** | Connects to live databases (read-only) | Handles PostgreSQL (`psycopg2`), MySQL (`mysql-connector`), and SQLite connections; enforces read-only transactions; provides schema discovery and `EXPLAIN` plan extraction |
| 9 | **NL-to-SQL** | Converts natural language to SQL | Groq LLM with schema context generates production-ready queries from English descriptions with confidence scoring |
| 10 | **AI Chat** | Multi-turn conversational assistant | Session-based chat with full conversation history sent to Groq; schema-aware, query-aware, result-aware; SQL extraction from responses; contextual follow-up suggestions |
| 11 | **AI Explain** | Human-readable query explainer + comparator | Step-by-step breakdown in logical execution order (FROM → WHERE → SELECT); identifies business logic; flags edge cases; query-to-query comparison with performance verdict |

---

## Key Features

### 🧠 AI Chat Assistant
Open the sliding chat panel (`Ctrl+J`) and have a conversation about your SQL. The AI has full context of your schema, current query, and analysis results. It can explain, optimize, compare, and generate SQL — with extracted SQL that you can inject directly into the editor.

### ✨ Natural Language to SQL
Describe what you need in plain English:
> *"Show me all users who signed up this week and haven't verified their email"*

The system generates a SQL query, assigns a confidence score, and immediately runs it through the full analysis pipeline.

### 🎬 Real-Time Agent Streaming
Every agent's progress is streamed to the browser via Server-Sent Events (SSE). You see each agent start, discover findings, and complete — live. No waiting for the full result.

### 📝 Monaco SQL Editor
Full-featured SQL editor powered by Monaco (the engine behind VS Code) with:
- Custom dark and light themes matching QueryMind's design system
- Schema-driven autocomplete — table names, column names, and SQL keywords
- Syntax highlighting, bracket matching, and code folding
- JetBrains Mono font with ligature support

### 📊 Query Diff Viewer
After optimization, the Results Panel shows an **inline diff** (additions in green, removals in red) or a **side-by-side** comparison of original vs. optimized SQL.

### 🔬 Execution Plan Visualizer
When connected to a live database, view an interactive execution plan tree:
- Parses PostgreSQL JSON/text, MySQL, and SQLite EXPLAIN output
- Node-based tree with cost, rows, width, and execution time metrics
- Bottleneck detection with automatic highlighting of expensive operations

### 🗂️ Interactive Schema ERD
After connecting a database or scanning a project, explore your schema on a draggable canvas:
- Zoomable, pannable entity-relationship diagram rendered on HTML5 Canvas
- PK/FK highlighting with relationship lines between tables
- Column type annotations and row count badges
- Dark/light theme support

### 🔍 Command Palette
Press `Ctrl+K` to open a VS Code-inspired command palette with:
- Navigation (Dashboard, Quick Analyze, Scanner, Live Database)
- Actions (Run Analysis, Toggle History, Open AI Chat, Clear Workspace)
- Export (Markdown Report, Index Script)
- Theme switching (Dark, Light, System)

### 📈 Query Complexity Calculator
Client-side, deterministic scoring (1–10) based on pattern analysis: JOINs, subqueries, window functions, CTEs, aggregates, UNION, HAVING, and more. Displayed as a badge with color-coded severity.

### 🌐 GitHub Repository Scanning
Enter a public GitHub URL → the backend shallow-clones the repo (`git clone --depth 1`), extracts source files (up to 50 files, 500KB each), and feeds them into the scanner. No manual file uploads needed.

### 🔗 Schema Sharing
When you connect a live database, the discovered schema is saved to `localStorage` and automatically shared with Quick Analyze and Project Scanner modes. This means every analysis has full schema context.

### 🎮 Gamification System
- **XP System**: Earn XP for every analysis (25 base + 10 per issue found)
- **10 Achievement Badges**: From "First Scan" to "Command Master"
- **Animated XP Toasts**: Popup notifications with level-up celebrations
- **Level Progression**: Level up every 100 XP, synced to Supabase

### 🔐 Authentication
- **Google OAuth** and **GitHub OAuth** via Supabase
- **OTP Email Verification** for new OAuth signups (6-digit code via SMTP)
- Profile auto-creation on first login with XP sync
- GitHub token capture for private repo access (optional)

### 📥 Export
- **Markdown Report**: Download a full analysis report as `.md`
- **Index Script**: Download all recommended indexes as a `.sql` file ready to execute

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
| httpx | 0.27 | Async HTTP client |
| python-dotenv | 1.0 | Environment variable management |
| gunicorn | 23.0 | Production WSGI server |

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI rendering |
| TypeScript | 5.8 | Type safety |
| TanStack Router | 1.x | File-based routing with type-safe navigation |
| TanStack Query | 5.x | Server state management |
| Tailwind CSS | 4.x | Utility-first styling with CSS variables design system |
| Monaco Editor | 4.7 | Full-featured SQL code editor (VS Code engine) |
| Framer Motion | 12.x | Animations, transitions, and panel sliding |
| ReactFlow | 11.x | Node-based optimization flow diagrams |
| Recharts | 2.x | Performance score charts and data visualization |
| Radix UI | Latest | 25+ accessible, unstyled UI primitives |
| cmdk | 1.1 | Command palette component |
| Supabase JS | 2.x | Auth and database client |
| Vite | 7.x | Build tool and dev server |
| Lucide React | 0.575 | Icon library |
| Sonner | 2.x | Toast notifications |
| Zod | 3.x | Schema validation |
| react-resizable-panels | 4.6 | Resizable split panes |
| input-otp | 1.4 | OTP input component |

### Infrastructure

| Service | Purpose |
|---------|---------|
| Supabase | Auth (OAuth + email), PostgreSQL database, Row Level Security |
| Groq Cloud | LLM inference API (free tier, ~500 RPM) |
| Cloudflare Workers | Frontend edge deployment (via Wrangler) |
| Render | Backend deployment (Flask + Gunicorn) |
| Gmail SMTP | OTP email delivery (optional) |

---

## Project Structure

```
querymind/
├── backend/
│   ├── app/
│   │   ├── agents/                     # The 11 analysis agents
│   │   │   ├── orchestrator.py         # Coordinates all agents, SSE streaming, parallel execution
│   │   │   ├── parser_agent.py         # Agent 1: SQL → AST via sqlglot
│   │   │   ├── antipattern_detector.py # Agent 2: 20+ rule-based SQL checks
│   │   │   ├── index_advisor.py        # Agent 3: LLM-powered index suggestions
│   │   │   ├── query_optimizer.py      # Agent 4: Structural + LLM SQL rewrites
│   │   │   ├── performance_predictor.py# Agent 5: Heuristic + AI scoring
│   │   │   ├── schema_guard.py         # Agent 6: Index safety validation
│   │   │   ├── file_scanner.py         # Agent 7: Extract SQL from source files
│   │   │   ├── db_connector.py         # Agent 8: Live DB connections + EXPLAIN
│   │   │   ├── nl_to_sql.py            # Agent 9: Natural language → SQL
│   │   │   ├── ai_chat.py             # Agent 10: Multi-turn chat assistant
│   │   │   └── ai_explain.py          # Agent 11: Query explainer + comparator
│   │   ├── api/
│   │   │   └── __init__.py            # Blueprint definitions and API metadata
│   │   ├── middleware/
│   │   │   └── __init__.py            # Rate limiter, JSON validator, request timer
│   │   ├── models/
│   │   │   └── __init__.py            # Dataclass models (AnalysisRequest, AntiPatternIssue, etc.)
│   │   ├── services/
│   │   │   ├── groq_client.py         # Groq LLM API wrapper (single + multi-turn)
│   │   │   └── github_scanner.py      # GitHub repo shallow cloner
│   │   ├── utils/
│   │   │   ├── sanitizer.py           # SQL injection prevention + connection validation
│   │   │   ├── schema_parser.py       # CREATE TABLE DDL → structured schema
│   │   │   └── sql_patterns.py        # Compiled regex patterns for SQL extraction
│   │   ├── config.py                  # Environment configuration + defaults
│   │   └── main.py                    # Flask app factory + all routes + middleware wiring
│   ├── tests/
│   │   └── test_agents.py             # Unit tests for parser, antipattern, sanitizer
│   ├── migrations.sql                 # Supabase database schema with RLS policies
│   ├── requirements.txt               # Python dependencies
│   ├── run.py                         # Development server entry point
│   └── .env.example                   # All environment variable keys
│
├── frontend/
│   ├── src/
│   │   ├── routes/                    # TanStack file-based routes
│   │   │   ├── __root.tsx             # Root layout (auth, toasts, shortcuts, OTP gate)
│   │   │   ├── index.tsx              # Landing / dashboard page
│   │   │   ├── quick.tsx              # Quick Analyze + NL-to-SQL (Monaco editor)
│   │   │   ├── scan.tsx               # Project Scanner + GitHub import + batch analysis
│   │   │   ├── connect.tsx            # Live Database connection + EXPLAIN + ERD
│   │   │   ├── login.tsx              # Email/password + Google/GitHub OAuth login
│   │   │   ├── signup.tsx             # Registration with password strength
│   │   │   └── sitemap[.]xml.ts       # Dynamic sitemap generation
│   │   ├── components/
│   │   │   ├── TopBar.tsx             # Navigation + XP bar + command palette trigger
│   │   │   ├── ResultsPanel.tsx       # Tabbed analysis results display
│   │   │   ├── QueryDiff.tsx          # Inline / side-by-side diff viewer
│   │   │   ├── ActivityLog.tsx        # Real-time SSE agent log stream
│   │   │   ├── MonacoEditor.tsx       # Custom Monaco SQL editor with schema autocomplete
│   │   │   ├── AiChat.tsx             # Sliding chat panel with streaming responses
│   │   │   ├── CommandPalette.tsx     # Ctrl+K command palette (cmdk)
│   │   │   ├── ExplainVisualizer.tsx  # Interactive execution plan tree
│   │   │   ├── SchemaERDInteractive.tsx # Draggable canvas ERD with zoom/pan
│   │   │   ├── HistoryDrawer.tsx      # Past analyses browser
│   │   │   ├── XpToast.tsx            # Animated XP gain notifications
│   │   │   ├── OnboardingTour.tsx     # First-time user walkthrough
│   │   │   ├── OtpVerification.tsx    # OTP email verification modal
│   │   │   ├── GitHubLinkPrompt.tsx   # GitHub account linking prompt
│   │   │   ├── KeyboardShortcuts.tsx  # Ctrl+/ shortcut overlay
│   │   │   ├── SectionHeader.tsx      # Reusable page section header
│   │   │   └── scan/
│   │   │       ├── BatchDashboard.tsx # Aggregate scan results + score cards
│   │   │       ├── OptimizationFlow.tsx # Visual node-based agent flow diagram
│   │   │       └── SchemaERD.tsx      # Schema entity summary cards
│   │   ├── hooks/
│   │   │   ├── useTheme.ts           # Dark/light/system theme management
│   │   │   ├── useKeyboardShortcuts.ts # Global keyboard shortcut handler
│   │   │   └── use-mobile.tsx         # Responsive breakpoint detection
│   │   ├── lib/
│   │   │   ├── api.ts                # Backend API client (SSE stream + REST)
│   │   │   ├── auth.tsx              # Auth context (Supabase + OTP + XP sync)
│   │   │   ├── complexity.ts         # Client-side SQL complexity calculator
│   │   │   ├── history.ts           # Supabase analysis history CRUD
│   │   │   ├── supabase.ts          # Supabase client initialization
│   │   │   └── utils.ts             # Tailwind class merging utilities
│   │   ├── components/ui/           # 46 Radix-based UI primitives (shadcn/ui)
│   │   └── styles.css               # Design system (CSS variables + utilities)
│   ├── wrangler.jsonc               # Cloudflare Workers deployment config
│   ├── vite.config.ts               # Vite + TanStack Start + Cloudflare config
│   └── package.json                 # Frontend dependencies
│
├── supabase_migration.sql            # Legacy migration file (see backend/migrations.sql)
└── .gitignore
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
git clone https://github.com/theanimeshgupta/querymind.git
cd querymind
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file (see `.env.example` for all keys):

```env
# Required
GROQ_API_KEY=your-groq-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# CORS — add your frontend URL
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Auth (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
FERNET_KEY=your-fernet-key
JWT_SECRET=your-jwt-secret

# Optional: Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: OTP via email (if not set, OTP codes print to console in dev mode)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=QueryMind<your-email@gmail.com>
```

Start the backend:

```bash
python run.py
# Server starts on http://localhost:5000
```

For production:

```bash
gunicorn app.main:app --bind 0.0.0.0:5000 --workers 4
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# App starts on http://localhost:5173
```

For production build:

```bash
npm run build
npm run preview
```

### 4. Database Setup

Run `backend/migrations.sql` in your Supabase SQL Editor (Dashboard → SQL Editor) to create the required tables, RLS policies, and auto-profile trigger:

- `analyses` — stores all optimization history (user-scoped via RLS)
- `analytics` — insert-only telemetry for aggregate metrics
- `user_profiles` — gamification data (XP, level, badges)

### 5. Deploy to Cloudflare & Production

QueryMind is designed with a modern, decoupled production architecture optimized for edge networks:

#### Production Deployment Tech Stack

* **Frontend Hosting (Edge CDN):**
  * **Platform:** [Cloudflare Pages](https://pages.cloudflare.com/) / [Cloudflare Workers](https://workers.cloudflare.com/)
  * **Build System:** Bun (v1.2.15+) or Node.js (via npm)
  * **Framework Target:** Vite + TanStack Start compiles down to a Cloudflare Workers target (`src/server.ts` entry point), leveraging Edge SSR.
  * **Assets:** Served directly from Cloudflare's global edge cache.

* **Backend Hosting (Application Server):**
  * **Platform:** [Render](https://render.com/) (Web Service) or AWS EC2
  * **WSGI Server:** `gunicorn app.main:app --bind 0.0.0.0:5000 --workers 4`
  * **Runtime:** Python 3.11+ (Gunicorn master-worker model manages concurrent query analysis streams).
  * **SSE Streaming Support:** Configured to prevent response buffering so agent logs stream in real-time.

* **Database & Auth (Backend-as-a-Service):**
  * **Platform:** [Supabase](https://supabase.com/) (Managed PostgreSQL)
  * **Auth Flow:** Supabase Gotrue JWT auth with support for GitHub/Google OAuth + transactional OTP emails via SMTP.
  * **Data Access Security:** Row-Level Security (RLS) policies guard all user workspace entries.

#### Deployment Commands

* **Deploy Frontend (Cloudflare):**
  ```bash
  cd frontend
  # Uses settings defined in wrangler.jsonc
  npx wrangler deploy
  ```
  *(Remember to set `BUN_VERSION` = `1.3.14` and `VITE_API_URL` in Cloudflare Variables settings if deploying using Bun).*

* **Deploy Backend (Render/Server):**
  Ensure the environment variables from `.env.example` are set in your platform dashboard, then run:
  ```bash
  gunicorn app.main:app --bind 0.0.0.0:$PORT --workers 4 --timeout 120
  ```

---

## API Endpoints

### Analysis (SSE Streams)

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| `POST` | `/api/v1/analyze` | Analyze a single SQL query | 30/min |
| `POST` | `/api/v1/scan` | Scan uploaded files for SQL | 30/min |
| `POST` | `/api/v1/analyze-batch` | Batch analyze multiple queries | 30/min |
| `POST` | `/api/v1/connect` | Test database connection + discover schema | 30/min |
| `POST` | `/api/v1/explain` | Run EXPLAIN on a live database | — |

### AI Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/nl-to-sql` | Convert natural language to SQL |
| `POST` | `/api/v1/chat` | AI chat with streaming SSE response |
| `POST` | `/api/v1/chat/clear` | Clear chat session history |
| `POST` | `/api/v1/explain-query` | Get step-by-step query explanation |
| `POST` | `/api/v1/compare-queries` | Compare two SQL queries side-by-side |

### Utilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/scan-github` | Clone and scan a public GitHub repository |
| `POST` | `/api/v1/send-otp` | Send OTP verification email |
| `POST` | `/api/v1/verify-otp` | Verify OTP code |
| `GET`  | `/api/v1/health` | Health check |

All SSE endpoints stream `data: {json}\n\n` formatted events with types: `agent_start`, `agent_done`, `agent_error`, `agent_finding`, `complete`, `error`.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` / `⌘+Enter` | Run analysis / Start scan |
| `Ctrl+K` / `⌘+K` | Open Command Palette |
| `Ctrl+J` / `⌘+J` | Open AI Chat |
| `Ctrl+H` / `⌘+H` | Toggle History Drawer |
| `Ctrl+/` / `⌘+/` | Show Keyboard Shortcuts |
| `Ctrl+1–4` / `⌘+1–4` | Navigate between pages |
| `Esc` | Close modals and panels |

---

## Security

| Layer | Protection |
|-------|-----------|
| **SQL Injection** | All user-submitted SQL is sanitized against blocked statements (`DROP`, `TRUNCATE`, `ALTER`, `GRANT`, `REVOKE`, `SHUTDOWN`). Live database connections enforce read-only transactions (`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`). |
| **Input Validation** | Query length capped at 50KB, schema at 200KB, connection strings at 500 chars with URI scheme allowlisting. JSON body validation via middleware decorator. |
| **Rate Limiting** | In-memory IP-based rate limiter (30 requests/60s window) applied to all analysis endpoints. |
| **Row Level Security** | Supabase RLS policies ensure users can only read/write their own `analyses`, `user_profiles`, and contribute to `analytics`. |
| **OTP Verification** | OAuth signups require email verification. OTP codes are never returned in production API responses (only in `DEBUG` mode). |
| **Security Headers** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Strict-Transport-Security` (HSTS). |
| **Parameter Sanitization** | SQL parameter placeholders (`%s`, `?`, `$1`, `:name`) are replaced before `sqlglot` parsing to prevent AST errors. |
| **Request Timing** | `X-Processing-Time` header on all responses for performance monitoring. |

---

## Data Models

The backend uses Python dataclasses as typed contracts for the data flowing through the pipeline:

| Model | Purpose |
|-------|---------|
| `AnalysisRequest` | Incoming SQL + dialect + schema context |
| `AntiPatternIssue` | Detected rule violation with severity + suggestion |
| `IndexRecommendation` | Suggested index with CREATE statement + reason |
| `SchemaGuardReport` | Safety score + warnings + blocked/approved indexes |
| `PerformancePrediction` | Before/after scores + bottleneck + scalability |
| `AnalysisResult` | Complete pipeline output (metadata + issues + indexes + optimization + performance + guard) |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with Flask, React, and a lot of SQL.**

*QueryMind — by [Animesh Gupta](https://github.com/theanimeshgupta)*

</div>