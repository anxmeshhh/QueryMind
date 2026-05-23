import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { TopBar } from "@/components/TopBar";
import { AuthGuard } from "@/components/AuthGuard";
import { ActivityLog, type LogEntry } from "@/components/ActivityLog";
import { ResultsPanel, type AnalysisResult } from "@/components/ResultsPanel";
import { sampleQueries, buildResultFromEvents } from "@/lib/mock-data";
import { analyzeQuery, type SSEEvent } from "@/lib/api";

export const Route = createFileRoute("/quick")({
  head: () => ({
    meta: [
      { title: "Quick Analyze — QueryMind" },
      { name: "description", content: "Paste a SQL query and get instant performance analysis." },
    ],
  }),
  component: QuickPage,
});

const DEFAULT_QUERY = `SELECT * FROM users u, orders o
WHERE u.id = o.user_id
AND u.email LIKE '%gmail.com'
ORDER BY o.created_at DESC`;

const DEFAULT_SCHEMA = `-- Optional: paste CREATE TABLE statements
CREATE TABLE users (
  id INT PRIMARY KEY,
  email VARCHAR(255),
  name VARCHAR(100)
);`;

function QuickPage() {
  const [tab, setTab] = useState<"query" | "schema">("query");
  const [query, setQuery] = useState("");
  const [schema, setSchema] = useState("");
  const [dialect, setDialect] = useState("PostgreSQL");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const eventsRef = useRef<SSEEvent[]>([]);

  const runAnalysis = () => {
    const sql = query.trim() || DEFAULT_QUERY;
    if (!query.trim()) setQuery(DEFAULT_QUERY);

    setRunning(true);
    setLog([]);
    setResult(null);
    setError(null);
    eventsRef.current = [];

    abortRef.current = analyzeQuery(
      sql,
      dialect,
      schema,
      (event: SSEEvent) => {
        eventsRef.current.push(event);

        // Convert SSE event to log entry
        const agentLevel = (e: SSEEvent): LogEntry["level"] => {
          if (e.type === "agent_error" || e.type === "error") return "critical";
          if (e.severity === "critical") return "critical";
          if (e.severity === "medium") return "warning";
          if (e.agent === "index" || e.agent === "optimize") return "index";
          if (e.type === "complete") return "success";
          return "info";
        };

        const entry: LogEntry = {
          time: event.time ? `${event.time}s` : "",
          agent: event.agent || "system",
          message: event.message || "",
          level: agentLevel(event),
        };

        setLog((prev) => [...prev, entry]);

        // On complete, build the result
        if (event.type === "complete") {
          const built = buildResultFromEvents(eventsRef.current);
          if (built) setResult(built);
          setRunning(false);
        }

        if (event.type === "error") {
          setError(event.message || "Unknown error");
          setRunning(false);
        }
      },
      (errMsg) => {
        setError(errMsg);
        setRunning(false);
        setLog((prev) => [
          ...prev,
          { time: "", agent: "error", message: errMsg, level: "critical" },
        ]);
      },
    );
  };

  const dialectSelect = (
    <div className="relative">
      <select
        value={dialect}
        onChange={(e) => setDialect(e.target.value)}
        className="bg-card border border-border text-text-primary text-sm font-mono px-3 py-1.5 rounded-md appearance-none pr-8 focus:outline-none focus:border-primary"
      >
        <option>PostgreSQL</option>
        <option>MySQL</option>
        <option>SQLite</option>
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">
        ▾
      </span>
    </div>
  );

  const runButton = (
    <button
      onClick={runAnalysis}
      disabled={running}
      className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
    >
      {running ? "Analyzing..." : "Run Analysis"}
    </button>
  );

  return (
    <AuthGuard>
    <div className="h-screen flex flex-col bg-background">
      <TopBar showBack center={dialectSelect} right={runButton} />
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[35fr_30fr_35fr] min-h-0">
        {/* Left: Editor */}
        <section className="flex flex-col border-r border-border min-h-0">
          <div className="flex border-b border-border shrink-0">
            <TabBtn active={tab === "query"} onClick={() => setTab("query")}>
              Query
            </TabBtn>
            <TabBtn active={tab === "schema"} onClick={() => setTab("schema")}>
              Schema
            </TabBtn>
          </div>
          <div className="flex-1 min-h-0 relative bg-code">
            <CodeEditor
              value={tab === "query" ? query : schema}
              onChange={tab === "query" ? setQuery : setSchema}
              placeholder={tab === "query" ? `-- Paste your SQL query here\n${DEFAULT_QUERY}` : DEFAULT_SCHEMA}
            />
          </div>
          {tab === "query" && (
            <div className="border-t border-border px-3 py-2 flex items-center gap-4 text-[12px] font-mono text-text-muted shrink-0">
              {Object.keys(sampleQueries).map((name) => (
                <button
                  key={name}
                  onClick={() => setQuery(sampleQueries[name])}
                  className="hover:text-primary transition-colors"
                >
                  ▸ {name}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Middle: Log */}
        <section className="border-r border-border min-h-0 flex flex-col">
          <ActivityLog entries={log} active={running} />
        </section>

        {/* Right: Results */}
        <section className="min-h-0 flex flex-col">
          {error && (
            <div className="p-4 text-critical text-sm font-mono border-b border-border">
              Error: {error}
            </div>
          )}
          <ResultsPanel result={result} />
        </section>
      </div>
    </div>
    </AuthGuard>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 h-10 text-sm transition-colors relative ${
        active ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
      }`}
    >
      {children}
      {active && (
        <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-primary" />
      )}
    </button>
  );
}

function CodeEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const lines = (value || placeholder).split("\n");
  return (
    <div className="absolute inset-0 flex overflow-auto qm-scroll">
      <div className="select-none text-right pr-3 pl-3 py-3 font-mono text-[13px] text-text-disabled leading-6 shrink-0 sticky left-0 bg-code">
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="flex-1 bg-transparent text-text-primary placeholder:text-[#3f3f46] font-mono text-[13px] leading-6 py-3 pr-4 outline-none resize-none min-h-full"
      />
    </div>
  );
}
