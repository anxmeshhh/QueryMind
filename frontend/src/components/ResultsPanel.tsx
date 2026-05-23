import { CopyButton } from "./CopyButton";
import { useState } from "react";
import { ChevronRight, ShieldCheck, ShieldAlert, Download, FileText } from "lucide-react";

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
  warnings: string[];
  blocked: string[];
  approved: string[];
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
}

const sevStyles: Record<Issue["severity"], string> = {
  CRITICAL: "bg-critical/15 text-critical",
  MEDIUM: "bg-warning/15 text-warning",
  LOW: "bg-info/15 text-info",
};

export function ResultsPanel({ result }: { result: AnalysisResult | null }) {
  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-text-disabled font-mono text-sm">
        Results
      </div>
    );
  }

  const guard = result.guard;

  return (
    <div className="h-full overflow-auto qm-scroll">
      {/* Score */}
      <div className="px-4 py-5 border-b border-border">
        <div className="section-label mb-3">Score</div>
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
        <div className="border-b border-border">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {guard.safe ? (
                <ShieldCheck size={14} className="text-success" />
              ) : (
                <ShieldAlert size={14} className="text-warning" />
              )}
              <span className="section-label">Schema Guard</span>
            </div>
            <div className={`qm-safety-badge ${
              guard.safety_score >= 80 ? "qm-safety-safe" :
              guard.safety_score >= 50 ? "qm-safety-warn" : "qm-safety-danger"
            }`}>
              {guard.safety_score}/100
            </div>
          </div>

          <div className="px-4 pb-3 space-y-2">
            {guard.unchanged_note && (
              <div className="bg-success/8 border border-success/15 rounded-md px-3 py-2 text-success text-[12px] font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                {guard.unchanged_note}
              </div>
            )}
            {guard.blocked.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-text-disabled uppercase tracking-wider">Blocked (duplicates)</div>
                {guard.blocked.map((b, i) => (
                  <div key={i} className="bg-critical/8 border border-critical/15 rounded-md px-3 py-1.5 text-critical text-[11px] font-mono">
                    {b}
                  </div>
                ))}
              </div>
            )}
            {guard.warnings.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-text-disabled uppercase tracking-wider">Warnings</div>
                {guard.warnings.map((w, i) => (
                  <div key={i} className="bg-warning/8 border border-warning/15 rounded-md px-3 py-1.5 text-warning text-[11px] font-mono">
                    {w}
                  </div>
                ))}
              </div>
            )}
            {guard.approved.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-text-disabled uppercase tracking-wider">Approved</div>
                {guard.approved.map((a, i) => (
                  <div key={i} className="bg-success/8 border border-success/15 rounded-md px-3 py-1.5 text-success text-[11px] font-mono">
                    ✓ {a}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Issues */}
      <div className="border-b border-border">
        <div className="px-4 py-3 flex items-center gap-2">
          <span className="section-label">Issues</span>
          <span className="text-[11px] font-mono bg-secondary text-text-secondary px-1.5 py-0.5 rounded">
            {result.issues.length}
          </span>
        </div>
        <div>
          {result.issues.map((issue, i) => (
            <IssueRow key={i} issue={issue} />
          ))}
        </div>
      </div>

      {/* Optimized Query */}
      <div className="border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="section-label">Optimized Query</span>
          <CopyButton text={result.optimizedSql} />
        </div>
        <CodeBlock code={result.optimizedSql} />
      </div>

      {/* Indexes */}
      <div className="border-b border-border">
        <div className="px-4 py-3 flex items-center gap-2">
          <span className="section-label">Indexes</span>
          <span className="text-[11px] font-mono bg-secondary text-text-secondary px-1.5 py-0.5 rounded">
            {result.indexes.length}
          </span>
        </div>
        <div className="px-4 pb-4 space-y-3">
          {result.indexes.map((idx, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[13px] text-primary">{idx.table}</span>
                <CopyButton text={idx.sql} />
              </div>
              <div className="bg-code border border-border rounded-md px-3 py-2 font-mono text-[12.5px] text-text-primary overflow-x-auto qm-scroll">
                {idx.sql}
              </div>
              <div className="text-text-secondary text-xs">{idx.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Actions */}
      <div className="px-4 py-4 space-y-2">
        <div className="section-label mb-2">Export</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => exportAsMarkdown(result)}
            className="flex items-center justify-center gap-1.5 bg-code border border-border rounded-md py-2 text-text-secondary text-[12px] font-mono hover:bg-elevated hover:text-primary transition-all"
          >
            <FileText size={12} />
            Markdown Report
          </button>
          <button
            onClick={() => exportIndexScript(result)}
            className="flex items-center justify-center gap-1.5 bg-code border border-border rounded-md py-2 text-text-secondary text-[12px] font-mono hover:bg-elevated hover:text-primary transition-all"
          >
            <Download size={12} />
            Index Script (.sql)
          </button>
        </div>
      </div>
    </div>
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
        <div className="px-4 pb-3 pl-12 text-text-secondary text-[13px]">
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
