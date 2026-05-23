import { CopyButton } from "./CopyButton";

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

export interface AnalysisResult {
  scoreBefore: number;
  scoreAfter: number;
  improvement: string;
  issues: Issue[];
  optimizedSql: string;
  indexes: IndexRec[];
}

const sevStyles: Record<Issue["severity"], string> = {
  CRITICAL: "bg-critical/15 text-critical",
  MEDIUM: "bg-warning/15 text-warning",
  LOW: "bg-info/15 text-info",
};

import { useState } from "react";
import { ChevronRight } from "lucide-react";

export function ResultsPanel({ result }: { result: AnalysisResult | null }) {
  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-text-disabled font-mono text-sm">
        Results
      </div>
    );
  }

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
      <div>
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
