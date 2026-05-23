import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { ResultsPanel } from "@/components/ResultsPanel";
import { mockResult, schemaTables, planNodes } from "@/lib/mock-data";

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
  const [connected, setConnected] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState(
    `SELECT * FROM users u, orders o\nWHERE u.id = o.user_id\nAND u.email LIKE '%gmail.com';`
  );
  const [explained, setExplained] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar showBack />
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
            placeholder="postgresql://user:pass@host:5432/dbname"
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
            onClick={() => setConnected(true)}
            className="mt-4 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            Connect
          </button>

          {connected && (
            <div className="mt-3 flex items-center gap-2 text-success text-[13px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Connected to PostgreSQL 16.2 — mydb
            </div>
          )}
        </div>

        {connected && (
          <>
            {/* Schema */}
            <div className="bg-panel border border-border rounded-lg overflow-hidden">
              <div className="h-10 px-4 flex items-center gap-3 border-b border-border">
                <span className="section-label">Schema</span>
                <span className="font-mono text-primary text-[13px]">mydb</span>
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
                  {schemaTables.map((t, i) => (
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
                    <span>id <span className="text-text-disabled">INT PRIMARY KEY</span></span>
                    <span>email <span className="text-text-disabled">VARCHAR(255)</span></span>
                    <span>name <span className="text-text-disabled">VARCHAR(100)</span></span>
                    <span>created_at <span className="text-text-disabled">TIMESTAMP</span></span>
                    <span>updated_at <span className="text-text-disabled">TIMESTAMP</span></span>
                  </div>
                </div>
              )}
            </div>

            {/* Query + Results */}
            <div className="bg-panel border border-border rounded-lg overflow-hidden">
              <div className="h-10 px-4 flex items-center justify-between border-b border-border">
                <span className="section-label">Query</span>
                <button
                  onClick={() => setExplained(true)}
                  className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-primary/90 transition-colors"
                >
                  Run EXPLAIN ANALYZE
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

                <div className="bg-panel border border-border rounded-lg overflow-hidden">
                  <ResultsPanel result={mockResult} />
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
