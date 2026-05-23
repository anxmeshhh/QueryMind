import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Trash2, HelpCircle, Database } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { AuthGuard } from "@/components/AuthGuard";
import { ActivityLog, type LogEntry } from "@/components/ActivityLog";
import { ResultsPanel, type AnalysisResult } from "@/components/ResultsPanel";
import { sampleQueries, buildResultFromEvents } from "@/lib/mock-data";
import { analyzeQuery, type SSEEvent } from "@/lib/api";
import { saveAnalysis } from "@/lib/history";
import { toast } from "sonner";

interface QuickSearch {
  q?: string;
}

export const Route = createFileRoute("/quick")({
  validateSearch: (search: Record<string, unknown>): QuickSearch => {
    return {
      q: typeof search.q === "string" ? search.q : undefined,
    };
  },
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
  const { q } = Route.useSearch();
  
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
  const [hasGlobalSchema, setHasGlobalSchema] = useState(false);

  // Load state on mount (restoring from search parameter or localStorage)
  useEffect(() => {
    // Load global schema from Connect/Scan (cross-mode sharing)
    try {
      const globalSchema = localStorage.getItem("qm_global_schema");
      if (globalSchema) {
        const tables = JSON.parse(globalSchema);
        if (Array.isArray(tables) && tables.length > 0) {
          setHasGlobalSchema(true);
        }
      }
    } catch {}

    if (q) {
      setQuery(q);
      // Auto-trigger analysis for imported queries
      setTimeout(() => {
        runAnalysisWithQuery(q, dialect, schema);
      }, 150);
    } else {
      try {
        const savedQuery = localStorage.getItem("qm_quick_query");
        const savedSchema = localStorage.getItem("qm_quick_schema");
        const savedDialect = localStorage.getItem("qm_quick_dialect");
        const savedLog = localStorage.getItem("qm_quick_log");
        const savedResult = localStorage.getItem("qm_quick_result");

        if (savedQuery) setQuery(savedQuery);
        if (savedSchema) setSchema(savedSchema);
        if (savedDialect) setDialect(savedDialect);
        if (savedLog) setLog(JSON.parse(savedLog));
        if (savedResult) setResult(JSON.parse(savedResult));
      } catch (e) {
        console.error("Failed to restore quick page workspace:", e);
      }
    }
  }, [q]);

  // Listen for qm-restore-history event
  useEffect(() => {
    const handleRestore = (e: Event) => {
      const analysis = (e as CustomEvent).detail;
      if (analysis.mode === "quick") {
        setQuery(analysis.original_query);
        setDialect(analysis.dialect === "mysql" ? "MySQL" : analysis.dialect === "sqlite" ? "SQLite" : "PostgreSQL");
        
        // Structure simulated logs
        const restoredLogs: LogEntry[] = [
          { time: "0.0s", agent: "history", message: "Restoring past optimization run...", level: "info" },
          { time: "0.2s", agent: "history", message: `Found ${analysis.issues_count} issue(s) and ${analysis.index_recommendations?.length || 0} index suggestion(s).`, level: "success" }
        ];
        setLog(restoredLogs);

        const restoredResult: AnalysisResult = {
          scoreBefore: analysis.performance_score_before || 50,
          scoreAfter: analysis.performance_score_after || 90,
          improvement: `${Math.round(((analysis.performance_score_after || 90) - (analysis.performance_score_before || 50)) / (analysis.performance_score_before || 50) * 100)}% speedup`,
          issues: analysis.issues || [],
          optimizedSql: analysis.optimized_query || "",
          indexes: analysis.index_recommendations || [],
        };
        setResult(restoredResult);
        setError(null);
        toast.success("Workspace state restored from history");
      } else {
        toast.info(`Restore not supported on this view. Navigate to /${analysis.mode} first.`);
      }
    };

    window.addEventListener("qm-restore-history", handleRestore);
    return () => window.removeEventListener("qm-restore-history", handleRestore);
  }, []);

  // Persist workspace changes
  useEffect(() => {
    try {
      localStorage.setItem("qm_quick_query", query);
    } catch {}
  }, [query]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_quick_schema", schema);
    } catch {}
  }, [schema]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_quick_dialect", dialect);
    } catch {}
  }, [dialect]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_quick_log", JSON.stringify(log));
    } catch {}
  }, [log]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_quick_result", JSON.stringify(result));
    } catch {}
  }, [result]);

  const clearQuickWorkspace = () => {
    setQuery("");
    setSchema("");
    setLog([]);
    setResult(null);
    setError(null);
    try {
      localStorage.removeItem("qm_quick_query");
      localStorage.removeItem("qm_quick_schema");
      localStorage.removeItem("qm_quick_log");
      localStorage.removeItem("qm_quick_result");
    } catch {}
  };

  const runAnalysisWithQuery = (targetSql: string, targetDialect: string, targetSchema: string) => {
    const sql = targetSql.trim() || DEFAULT_QUERY;
    setRunning(true);
    setLog([]);
    setResult(null);
    setError(null);
    eventsRef.current = [];

    // If no manual schema, inject global schema from Connect/Scan
    let effectiveSchema = targetSchema;
    if (!effectiveSchema.trim() && hasGlobalSchema) {
      try {
        const globalSchema = localStorage.getItem("qm_global_schema");
        if (globalSchema) {
          const tables = JSON.parse(globalSchema);
          // Convert schema tables to CREATE TABLE DDL for the backend
          effectiveSchema = tables.map((t: any) => {
            const cols = (t.column_details || t.columns || []).map((c: any) =>
              typeof c === "string" ? c : `${c.name} ${c.type || "TEXT"}${c.nullable === false ? " NOT NULL" : ""}`
            ).join(", ");
            return `CREATE TABLE ${t.table || t.name} (${cols});`;
          }).join("\n");
        }
      } catch {}
    }

    abortRef.current = analyzeQuery(
      sql,
      targetDialect,
      effectiveSchema,
      (event: SSEEvent) => {
        eventsRef.current.push(event);

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

        if (event.type === "complete") {
          const built = buildResultFromEvents(eventsRef.current);
          if (built) {
            setResult(built);
            // Save analysis history to DB asynchronously
            saveAnalysis("quick", sql, built, targetDialect, targetSchema);
          }
          setRunning(false);
        }

        if (event.type === "error") {
          setError(event.message || "Unknown error occurred");
          setRunning(false);
        }
      },
      (errMsg) => {
        setError(errMsg);
        setRunning(false);
        setLog((prev) => [
          ...prev,
          { time: "", agent: "Error Handler", message: errMsg, level: "critical" },
        ]);
      },
    );
  };

  const runAnalysis = () => {
    runAnalysisWithQuery(query, dialect, schema);
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

  const right = (
    <div className="flex items-center gap-2">
      {(query.trim() || schema.trim() || result) && (
        <button
          onClick={clearQuickWorkspace}
          className="border border-border text-text-secondary hover:text-critical text-sm font-medium px-3 py-1.5 rounded-md hover:bg-elevated/40 transition-colors flex items-center gap-1.5"
          title="Clear sandbox inputs and results"
        >
          <Trash2 size={13} />
          <span>Clear Sandbox</span>
        </button>
      )}
      <button
        onClick={runAnalysis}
        disabled={running}
        className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {running ? "Analyzing..." : "Run Analysis"}
      </button>
    </div>
  );

  return (
    <AuthGuard>
      <div className="h-screen flex flex-col bg-background">
        <TopBar showBack center={dialectSelect} right={right} />
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[35fr_30fr_35fr] min-h-0">
          {/* Left: Editor */}
          <section className="flex flex-col border-r border-border min-h-0">
            <div className="flex border-b border-border shrink-0">
              <TabBtn active={tab === "query"} onClick={() => setTab("query")}>
                Query
              </TabBtn>
              <TabBtn active={tab === "schema"} onClick={() => setTab("schema")}>
                <span className="flex items-center gap-1.5">
                  Schema
                  {hasGlobalSchema && !schema.trim() && (
                    <span className="flex items-center gap-1 text-[9px] bg-success/15 text-success px-1.5 py-0.5 rounded-full" title="Using schema from Connect or Scan">
                      <Database size={8} /> Linked
                    </span>
                  )}
                </span>
              </TabBtn>
            </div>
            <div className="flex-1 relative bg-code">
              {tab === "query" ? (
                <CodeEditor
                  value={query}
                  onChange={setQuery}
                  placeholder={DEFAULT_QUERY}
                />
              ) : (
                <CodeEditor
                  value={schema}
                  onChange={setSchema}
                  placeholder={DEFAULT_SCHEMA}
                />
              )}
            </div>
          </section>

          {/* Middle: Streaming logs */}
          <section className="flex flex-col border-r border-border min-h-0">
            <div className="h-10 border-b border-border px-4 flex items-center shrink-0">
              <span className="section-label">Agentic Pipelines Logs</span>
            </div>
            <div className="flex-1 min-h-0 bg-panel">
              <ActivityLog entries={log} active={running} />
            </div>
          </section>

          {/* Right: Results */}
          <section className="min-h-0 flex flex-col bg-background">
            {error && (
              <div className="p-4 text-critical text-sm font-mono border-b border-border bg-panel">
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
      className={`px-4 h-10 text-sm font-mono font-medium border-r border-border relative transition-colors ${
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
