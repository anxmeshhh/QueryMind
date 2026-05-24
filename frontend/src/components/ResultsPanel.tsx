import { CopyButton } from "./CopyButton";
import { useState, useMemo } from "react";
import {
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Download,
  FileText,
  Layout,
  Layers,
  Sparkles,
  GitCompare,
  Database,
} from "lucide-react";
import { OptimizationFlow } from "./scan/OptimizationFlow";
import { QueryDiff } from "./QueryDiff";
import { ExplainVisualizer } from "./ExplainVisualizer";
import { SchemaERDInteractive } from "./SchemaERDInteractive";

export interface Issue {
  severity: "CRITICAL" | "MEDIUM" | "LOW";
  title: string;
  description: string;
}

export interface IndexRec {
  table: string;
  sql: string;
  note: string;
}

export interface GuardReport {
  safe: boolean;
  safety_score: number;
  warnings: any[];
  blocked: any[];
  approved: any[];
  unchanged_note?: string;
}

export interface AnalysisResult {
  scoreBefore: number;
  scoreAfter: number;
  improvement: string;
  issues: Issue[];
  optimizedSql: string;
  indexes: IndexRec[];
  guard?: GuardReport;
  plan?: any;
}

const sevStyles: Record<Issue["severity"], string> = {
  CRITICAL: "bg-critical/15 text-critical",
  MEDIUM: "bg-warning/15 text-warning",
  LOW: "bg-info/15 text-info",
};

export function ResultsPanel({
  result,
  originalSql = "SELECT * FROM users u, orders o WHERE u.id = o.user_id;",
}: {
  result: AnalysisResult | null;
  originalSql?: string;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "diff" | "plan" | "erd">("overview");

  // Load global schema from localStorage for ERD tab
  const schemaData = useMemo(() => {
    try {
      const raw = localStorage.getItem("qm_global_schema");
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }, [activeTab]);

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-text-disabled font-mono text-sm">
        Results
      </div>
    );
  }

  const guard = result.guard;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Tabs Header */}
      <div className="flex border-b border-border bg-panel shrink-0">
        <TabButton
          active={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          icon={Layout}
          label="Overview"
        />
        <TabButton
          active={activeTab === "diff"}
          onClick={() => setActiveTab("diff")}
          icon={GitCompare}
          label="Diff"
        />
        <TabButton
          active={activeTab === "plan"}
          onClick={() => setActiveTab("plan")}
          icon={Layers}
          label="Execution Plan"
        />
        <TabButton
          active={activeTab === "erd"}
          onClick={() => setActiveTab("erd")}
          icon={Database}
          label="Schema ERD"
        />
      </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-auto qm-scroll p-5 space-y-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Score Card */}
            <div className="bg-panel border border-border rounded-xl p-5">
              <div className="section-label mb-3">Performance Score Impact</div>
              <div className="flex items-center gap-4">
                <div className="font-mono font-bold text-[44px] leading-none text-critical">
                  {result.scoreBefore}
                </div>
                <div className="text-text-muted text-xl">→</div>
                <div className="font-mono font-bold text-[44px] leading-none text-success">
                  {result.scoreAfter}
                </div>
              </div>
              <div className="mt-3 flex h-1.5 gap-1">
                <div
                  className="bg-critical rounded-sm"
                  style={{ width: `${result.scoreBefore}%` }}
                />
                <div
                  className="bg-success rounded-sm"
                  style={{ width: `${result.scoreAfter - result.scoreBefore}%` }}
                />
                <div
                  className="bg-elevated rounded-sm"
                  style={{ width: `${100 - result.scoreAfter}%` }}
                />
              </div>
              <div className="mt-2 text-success text-xs font-mono">
                Estimated {result.improvement}
              </div>
            </div>

            {/* Schema Guard Report */}
            {guard && (
              <div className="bg-panel border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {guard.safe ? (
                      <ShieldCheck size={14} className="text-success" />
                    ) : (
                      <ShieldAlert size={14} className="text-warning" />
                    )}
                    <span className="section-label">Schema Guard Integrity</span>
                  </div>
                  <div
                    className={`qm-safety-badge ${
                      guard.safety_score >= 80
                        ? "qm-safety-safe"
                        : guard.safety_score >= 50
                        ? "qm-safety-warn"
                        : "qm-safety-danger"
                    }`}
                  >
                    {guard.safety_score}/100
                  </div>
                </div>

                <div className="space-y-2">
                  {guard.unchanged_note && (
                    <div className="bg-success/8 border border-success/15 rounded-md px-3 py-2 text-success text-[12px] font-mono flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                      {guard.unchanged_note}
                    </div>
                  )}
                  {guard.blocked.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono text-text-disabled uppercase tracking-wider">
                        Blocked (duplicates)
                      </div>
                      {guard.blocked.map((b, i) => (
                        <div
                          key={i}
                          className="bg-critical/8 border border-critical/15 rounded-md px-3 py-1.5 text-critical text-[11px] font-mono"
                        >
                          {typeof b === "object" ? b.message : b}
                        </div>
                      ))}
                    </div>
                  )}
                  {guard.warnings.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono text-text-disabled uppercase tracking-wider">
                        Warnings
                      </div>
                      {guard.warnings.map((w, i) => (
                        <div
                          key={i}
                          className="bg-warning/8 border border-warning/15 rounded-md px-3 py-1.5 text-warning text-[11px] font-mono"
                        >
                          {typeof w === "object" ? w.message : w}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Interactive Optimization Flowchart */}
            <div className="bg-panel border border-border rounded-xl p-5">
              <OptimizationFlow
                originalSql={originalSql}
                optimizedSql={result.optimizedSql}
                issues={result.issues}
                indexes={result.indexes}
              />
            </div>

            {/* Issues */}
            <div className="bg-panel border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2 bg-elevated/20 border-b border-border">
                <span className="section-label">Issues Found</span>
                <span className="text-[11px] font-mono bg-secondary text-text-secondary px-1.5 py-0.5 rounded">
                  {result.issues.length}
                </span>
              </div>
              <div className="divide-y divide-border">
                {result.issues.length === 0 ? (
                  <div className="p-4 text-center text-xs text-text-muted font-mono">
                    No query issues detected.
                  </div>
                ) : (
                  result.issues.map((issue, i) => <IssueRow key={i} issue={issue} />)
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "diff" && (
          <div className="space-y-6">
            {/* Optimized Query with Diff Viewer */}
            <div className="bg-panel border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                <span className="section-label">Side-by-Side Diff</span>
                <CopyButton text={result.optimizedSql} />
              </div>
              <QueryDiff original={originalSql} optimized={result.optimizedSql} />
            </div>

            {/* Recommended Indexes */}
            <div className="bg-panel border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2 bg-elevated/20 border-b border-border">
                <span className="section-label">Recommended Indexes</span>
                <span className="text-[11px] font-mono bg-secondary text-text-secondary px-1.5 py-0.5 rounded">
                  {result.indexes.length}
                </span>
              </div>
              <div className="p-4 space-y-4">
                {result.indexes.length === 0 ? (
                  <div className="text-center text-xs text-text-muted font-mono">
                    No index recommendations needed.
                  </div>
                ) : (
                  result.indexes.map((idx, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[13px] text-primary">{idx.table}</span>
                        <CopyButton text={idx.sql} />
                      </div>
                      <div className="bg-code border border-border rounded-md px-3 py-2 font-mono text-[12px] text-text-primary overflow-x-auto qm-scroll">
                        {idx.sql}
                      </div>
                      <div className="text-text-secondary text-xs">{idx.note}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Export Actions */}
            <div className="bg-panel border border-border rounded-xl p-4 space-y-2">
              <div className="section-label mb-2">Export Data</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => exportAsMarkdown(result)}
                  className="flex items-center justify-center gap-1.5 bg-code border border-border rounded-md py-2.5 text-text-secondary text-[12px] font-mono hover:bg-elevated hover:text-primary transition-all"
                >
                  <FileText size={12} />
                  Markdown Report
                </button>
                <button
                  onClick={() => exportIndexScript(result)}
                  className="flex items-center justify-center gap-1.5 bg-code border border-border rounded-md py-2.5 text-text-secondary text-[12px] font-mono hover:bg-elevated hover:text-primary transition-all"
                >
                  <Download size={12} />
                  Index Script (.sql)
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "plan" && (
          <ExplainVisualizer plan={result.plan} />
        )}

        {activeTab === "erd" && (
          <SchemaERDInteractive schema={schemaData} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Layout;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-mono font-medium border-b border-r border-border transition-colors ${
        active ? "bg-background text-text-primary border-b-transparent" : "text-text-muted hover:text-text-secondary bg-panel"
      }`}
    >
      <Icon size={13} className={active ? "text-primary" : "text-text-disabled"} />
      <span>{label}</span>
    </button>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-elevated">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-elevated/60 transition-colors text-left"
      >
        <ChevronRight
          size={14}
          className={`text-text-muted transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span
          className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
            sevStyles[issue.severity]
          }`}
        >
          {issue.severity}
        </span>
        <span className="text-text-primary text-sm">{issue.title}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pl-12 text-text-secondary text-[13px] leading-relaxed">
          {issue.description}
        </div>
      )}
    </div>
  );
}

export function CodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="bg-code border-t border-border overflow-x-auto qm-scroll">
      <pre className="font-mono text-[13px] leading-6 py-3">
        {lines.map((ln, i) => (
          <div key={i} className="flex">
            <span className="text-text-disabled w-10 text-right pr-3 select-none shrink-0">
              {i + 1}
            </span>
            <span className="text-text-primary whitespace-pre">{ln || " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

// ── Export helpers ──────────────────────────────

function exportAsMarkdown(result: AnalysisResult) {
  const lines: string[] = [
    "# QueryMind — Analysis Report",
    "",
    `## Performance Score: ${result.scoreBefore} → ${result.scoreAfter}`,
    `Estimated improvement: ${result.improvement}`,
    "",
  ];

  if (result.guard) {
    lines.push(`## Schema Guard — Safety: ${result.guard.safety_score}/100`);
    if (result.guard.unchanged_note) lines.push(`> ${result.guard.unchanged_note}`);
    if (result.guard.blocked.length > 0) {
      lines.push("### Blocked Indexes");
      result.guard.blocked.forEach((b) => lines.push(`- ❌ ${b}`));
    }
    if (result.guard.warnings.length > 0) {
      lines.push("### Warnings");
      result.guard.warnings.forEach((w) => lines.push(`- ⚠️ ${w}`));
    }
    lines.push("");
  }

  if (result.issues.length > 0) {
    lines.push("## Issues Found");
    result.issues.forEach((issue) => {
      lines.push(`### [${issue.severity}] ${issue.title}`);
      lines.push(issue.description);
      lines.push("");
    });
  }

  if (result.optimizedSql) {
    lines.push("## Optimized Query");
    lines.push("```sql");
    lines.push(result.optimizedSql);
    lines.push("```");
    lines.push("");
  }

  if (result.indexes.length > 0) {
    lines.push("## Recommended Indexes");
    result.indexes.forEach((idx) => {
      lines.push(`### ${idx.table}`);
      lines.push("```sql");
      lines.push(idx.sql);
      lines.push("```");
      lines.push(idx.note);
      lines.push("");
    });
  }

  downloadFile("querymind-report.md", lines.join("\n"));
}

function exportIndexScript(result: AnalysisResult) {
  const lines = [
    "-- QueryMind — Recommended Index Script",
    `-- Generated: ${new Date().toISOString()}`,
    `-- Performance: ${result.scoreBefore} → ${result.scoreAfter}`,
    "",
    ...result.indexes.map((idx) => `-- ${idx.note}\n${idx.sql};\n`),
  ];
  downloadFile("querymind-indexes.sql", lines.join("\n"));
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
