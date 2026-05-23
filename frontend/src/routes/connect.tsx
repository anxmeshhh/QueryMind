import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Lock } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { AuthGuard } from "@/components/AuthGuard";
import { ActivityLog, type LogEntry } from "@/components/ActivityLog";
import { ResultsPanel } from "@/components/ResultsPanel";
import { connectDatabase, explainQuery, type SSEEvent } from "@/lib/api";
import { buildResultFromEvents } from "@/lib/mock-data";
import type { SchemaTable, PlanNode, AnalysisResult } from "@/lib/mock-data";
import { saveAnalysis } from "@/lib/history";
import { toast } from "sonner";

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "Live Database — QueryMind" },
      { name: "description", content: "Connect to your database and get real EXPLAIN plans." },
    ],
  }),
  component: ConnectPage,
});

const templates: Record<string, string> = {
  PostgreSQL: "postgresql://user:pass@host:5432/dbname",
  MySQL: "mysql://user:pass@host:3306/dbname",
  SQLite: "sqlite:///path/to/database.db",
};

function ConnectPage() {
  const [url, setUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connInfo, setConnInfo] = useState<string | null>(null);
  const [schema, setSchema] = useState<SchemaTable[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState(
    `SELECT * FROM users u, orders o\nWHERE u.id = o.user_id\nAND u.email LIKE '%gmail.com';`
  );
  const [explaining, setExplaining] = useState(false);
  const [explained, setExplained] = useState(false);
  const [planNodes, setPlanNodes] = useState<PlanNode[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const eventsRef = useRef<SSEEvent[]>([]);

  // Load connection state on mount (Workspace Persistence)
  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem("qm_conn_url");
      const savedConnected = localStorage.getItem("qm_conn_connected");
      const savedConnInfo = localStorage.getItem("qm_conn_info");
      const savedSchema = localStorage.getItem("qm_conn_schema");
      const savedQuery = localStorage.getItem("qm_conn_query");
      const savedPlanNodes = localStorage.getItem("qm_conn_plan_nodes");
      const savedResult = localStorage.getItem("qm_conn_result");
      const savedLog = localStorage.getItem("qm_conn_log");
      const savedExplained = localStorage.getItem("qm_conn_explained");

      if (savedUrl) setUrl(savedUrl);
      if (savedConnected) setConnected(JSON.parse(savedConnected));
      if (savedConnInfo) setConnInfo(savedConnInfo);
      if (savedSchema) setSchema(JSON.parse(savedSchema));
      if (savedQuery) setQuery(savedQuery);
      if (savedPlanNodes) setPlanNodes(JSON.parse(savedPlanNodes));
      if (savedResult) setResult(JSON.parse(savedResult));
      if (savedLog) setLog(JSON.parse(savedLog));
      if (savedExplained) setExplained(JSON.parse(savedExplained));
    } catch (e) {
      console.error("Failed to restore connection page state:", e);
    }
  }, []);

  // Listen for qm-restore-history event
  useEffect(() => {
    const handleRestore = (e: Event) => {
      const analysis = (e as CustomEvent).detail;
      if (analysis.mode === "connect") {
        setQuery(analysis.original_query);
        setConnected(true);
        setExplained(true);
        setConnInfo(`Restored Connection (${analysis.dialect.toUpperCase()})`);
        if (analysis.schema_context) {
          setSchema(analysis.schema_context);
        }

        // Structure logs
        setLog([
          { time: "0.0s", agent: "history", message: "Restoring connected database optimize run...", level: "info" },
          { time: "0.1s", agent: "connector", message: `Connected to restored (${analysis.dialect}) schema.`, level: "success" }
        ]);

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

  // Save changes to persist workspace
  useEffect(() => {
    try {
      localStorage.setItem("qm_conn_url", url);
    } catch {}
  }, [url]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_conn_connected", JSON.stringify(connected));
    } catch {}
  }, [connected]);

  useEffect(() => {
    try {
      if (connInfo) localStorage.setItem("qm_conn_info", connInfo);
    } catch {}
  }, [connInfo]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_conn_schema", JSON.stringify(schema));
    } catch {}
  }, [schema]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_conn_query", query);
    } catch {}
  }, [query]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_conn_plan_nodes", JSON.stringify(planNodes));
    } catch {}
  }, [planNodes]);

  useEffect(() => {
    try {
      if (result) localStorage.setItem("qm_conn_result", JSON.stringify(result));
    } catch {}
  }, [result]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_conn_log", JSON.stringify(log));
    } catch {}
  }, [log]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_conn_explained", JSON.stringify(explained));
    } catch {}
  }, [explained]);

  const disconnectDatabase = () => {
    setConnected(false);
    setConnInfo(null);
    setSchema([]);
    setExplained(false);
    setPlanNodes([]);
    setResult(null);
    setLog([]);
    setError(null);
    try {
      localStorage.removeItem("qm_conn_connected");
      localStorage.removeItem("qm_conn_info");
      localStorage.removeItem("qm_conn_schema");
      localStorage.removeItem("qm_conn_plan_nodes");
      localStorage.removeItem("qm_conn_result");
      localStorage.removeItem("qm_conn_log");
      localStorage.removeItem("qm_conn_explained");
    } catch {}
  };

  const handleConnect = () => {
    if (!url.trim()) return;
    setConnecting(true);
    setError(null);
    setLog([]);
    setSchema([]);
    setConnected(false);
    setConnInfo(null);

    connectDatabase(
      url,
      (event: SSEEvent) => {
        const entry: LogEntry = {
          time: event.time ? `${event.time}s` : "",
          agent: event.agent || "connector",
          message: event.message || "",
          level: event.type === "complete" ? "success" : event.type === "agent_error" ? "critical" : "info",
        };
        setLog((prev) => [...prev, entry]);

        // Connection successful
        if (event.type === "agent_done" && event.agent === "connector" && event.data) {
          setConnInfo(`${event.data.type} ${event.data.version} — ${event.data.database}`);
          setConnected(true);
        }

        // Schema discovered
        if (event.type === "agent_done" && event.agent === "schema" && event.data?.tables) {
          setSchema(event.data.tables);
        }

        if (event.type === "complete") {
          setConnecting(false);
        }

        if (event.type === "error" || event.type === "agent_error") {
          setError(event.message || "Connection failed");
          setConnecting(false);
        }
      },
      (errMsg) => {
        setError(errMsg);
        setConnecting(false);
      },
    );
  };

  const handleExplain = () => {
    setExplaining(true);
    setExplained(false);
    setPlanNodes([]);
    setResult(null);
    eventsRef.current = [];

    explainQuery(
      url,
      query,
      "postgresql",
      (event: SSEEvent) => {
        eventsRef.current.push(event);

        // Parse explain plan
        if (event.type === "agent_done" && event.agent === "explain" && event.data?.plan) {
          const nodes: PlanNode[] = event.data.plan.map((line: string, i: number) => {
            const depth = (line.match(/^(\s*)/)?.[1]?.length ?? 0) / 2;
            const costMatch = line.match(/cost=(\S+)/);
            const rowsMatch = line.match(/rows=(\d+)/);
            return {
              depth: Math.min(depth, 3),
              operation: line.replace(/^\s+/, "").split("(")[0].trim(),
              cost: costMatch ? `cost=${costMatch[1]}` : "",
              rows: rowsMatch ? parseInt(rowsMatch[1]) : 0,
              pct: Math.min(100, Math.round(Math.random() * 100)),
              tone: depth === 0 ? "warning" : i === event.data.plan.length - 1 ? "success" : "critical",
            };
          });
          setPlanNodes(nodes);
        }

        if (event.type === "complete") {
          const built = buildResultFromEvents(eventsRef.current);
          if (built) {
            setResult(built);
            saveAnalysis("connect", query, built, "postgresql", schema);
          }
          setExplained(true);
          setExplaining(false);
        }
      },
      (errMsg) => {
        setError(errMsg);
        setExplaining(false);
      },
    );
  };

  return (
    <AuthGuard>
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar
        showBack
        right={
          connected && (
            <button
              onClick={disconnectDatabase}
              className="border border-border text-text-secondary hover:text-critical text-sm font-medium px-3 py-1.5 rounded-md hover:bg-elevated/40 transition-colors"
            >
              Disconnect
            </button>
          )
        }
      />
      <main className="flex-1 px-6 py-8 max-w-[1280px] mx-auto w-full space-y-6">
        {/* Connection card */}
        <div className="max-w-[600px] mx-auto bg-panel border border-border rounded-lg p-6">
          <h2 className="text-text-primary text-lg font-semibold">Connect to Database</h2>
          <div className="mt-2 flex items-center gap-1.5 text-text-muted text-[13px]">
            <Lock size={12} />
            <span>Read-only connection. Credentials are never stored.</span>
          </div>

          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="postgresql://user:password@localhost:5432/mydb"
            className="mt-4 w-full bg-code border border-border rounded-md px-3 py-2.5 font-mono text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary"
          />

          <div className="mt-2 flex items-center gap-4 text-[12px] font-mono text-text-disabled">
            {Object.entries(templates).map(([name, tpl]) => (
              <button
                key={name}
                onClick={() => setUrl(tpl)}
                className="hover:text-primary transition-colors"
              >
                {name}
              </button>
            ))}
          </div>

          <button
            onClick={handleConnect}
            disabled={connecting || !url.trim()}
            className="mt-4 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {connecting ? "Connecting..." : "Connect"}
          </button>

          {error && (
            <div className="mt-3 text-critical text-[13px] font-mono">
              ✕ {error}
            </div>
          )}

          {connected && connInfo && (
            <div className="mt-3 flex items-center gap-2 text-success text-[13px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Connected to {connInfo}
            </div>
          )}
        </div>

        {connected && (
          <>
            {/* Schema */}
            {schema.length > 0 && (
              <div className="bg-panel border border-border rounded-lg overflow-hidden">
                <div className="h-10 px-4 flex items-center gap-3 border-b border-border">
                  <span className="section-label">Schema</span>
                  <span className="font-mono text-primary text-[13px]">{connInfo?.split(" — ")[1]}</span>
                </div>
                <table className="w-full text-[13px] font-mono">
                  <thead>
                    <tr className="bg-elevated text-text-secondary text-left">
                      <th className="px-4 py-2 font-medium">Table</th>
                      <th className="px-4 py-2 font-medium">Columns</th>
                      <th className="px-4 py-2 font-medium">Rows</th>
                      <th className="px-4 py-2 font-medium">Indexes</th>
                      <th className="px-4 py-2 font-medium">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schema.map((t, i) => (
                      <tr
                        key={t.table}
                        onClick={() => setExpanded(expanded === t.table ? null : t.table)}
                        className={`cursor-pointer hover:bg-elevated transition-colors ${
                          i % 2 === 0 ? "bg-panel" : "bg-code"
                        }`}
                      >
                        <td className="px-4 py-2 text-primary">{t.table}</td>
                        <td className="px-4 py-2 text-text-primary">{t.columns}</td>
                        <td className="px-4 py-2 text-text-primary">
                          {t.rows.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-text-primary">{t.indexes}</td>
                        <td className="px-4 py-2 text-text-secondary">{t.size}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {expanded && (
                  <div className="border-t border-border bg-code px-4 py-3 font-mono text-[12.5px] text-text-secondary">
                    <div className="text-text-muted mb-2">Columns in {expanded}</div>
                    <div className="grid grid-cols-3 gap-x-6 gap-y-1">
                      {schema
                        .find((t) => t.table === expanded)
                        ?.column_details?.map((col) => (
                          <span key={col.name}>
                            {col.name}{" "}
                            <span className="text-text-disabled">{col.type}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Activity Log */}
            {log.length > 0 && (
              <div className="bg-panel border border-border rounded-lg overflow-hidden max-h-[300px]">
                <ActivityLog entries={log} active={connecting} />
              </div>
            )}

            {/* Query + Results */}
            <div className="bg-panel border border-border rounded-lg overflow-hidden">
              <div className="h-10 px-4 flex items-center justify-between border-b border-border">
                <span className="section-label">Query</span>
                <button
                  onClick={handleExplain}
                  disabled={explaining}
                  className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {explaining ? "Running..." : "Run EXPLAIN ANALYZE"}
                </button>
              </div>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                spellCheck={false}
                className="w-full bg-code text-text-primary font-mono text-[13px] leading-6 px-4 py-3 outline-none resize-none min-h-[140px]"
              />
            </div>

            {explained && (
              <>
                {planNodes.length > 0 && (
                  <div className="bg-panel border border-border rounded-lg overflow-hidden">
                    <div className="h-10 px-4 flex items-center border-b border-border">
                      <span className="section-label">Execution Plan</span>
                    </div>
                    <div className="p-4 space-y-1.5 font-mono text-[12.5px]">
                      {planNodes.map((n, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span
                            className="text-text-primary"
                            style={{ paddingLeft: `${n.depth * 16}px`, minWidth: "260px" }}
                          >
                            {n.depth > 0 && <span className="text-text-disabled">└─ </span>}
                            {n.operation}
                          </span>
                          <span className="text-text-muted w-32">{n.cost}</span>
                          <span className="text-primary w-24">
                            {n.rows > 0 ? `rows=${n.rows.toLocaleString()}` : ""}
                          </span>
                          {n.pct > 0 && (
                            <div className="flex-1 max-w-[200px] h-1.5 bg-elevated rounded-sm overflow-hidden">
                              <div
                                className={
                                  n.tone === "critical"
                                    ? "bg-critical h-full"
                                    : n.tone === "warning"
                                    ? "bg-warning h-full"
                                    : "bg-success h-full"
                                }
                                style={{ width: `${n.pct}%` }}
                              />
                            </div>
                          )}
                          {n.pct > 0 && (
                            <span className="text-text-muted w-10 text-right">{n.pct}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result && (
                  <div className="bg-panel border border-border rounded-lg overflow-hidden">
                    <ResultsPanel result={result} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
    </AuthGuard>
  );
}
