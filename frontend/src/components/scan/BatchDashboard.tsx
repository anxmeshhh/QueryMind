/**
 * BatchDashboard — Reusable aggregate analysis dashboard.
 * Shows 5-metric grid, safety score, unchanged notice, optimization diffs, and index script.
 * Used by both /scan and /connect pages.
 */

import { useState } from "react";
import { ShieldCheck, RefreshCw, Play, CheckCircle2, Download, FileText } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { CodeBlock } from "@/components/ResultsPanel";
import { OptimizationFlow } from "./OptimizationFlow";

export interface CodebaseOptimization {
  file: string;
  line: string;
  original: string;
  optimized: string;
  scoreBefore: number;
  scoreAfter: number;
  issues: any[];
  indexes: any[];
  guard?: any;
}

export interface AggregateImpact {
  avgScoreBefore: number;
  avgScoreAfter: number;
  speedupFactor: string;
  totalIssuesCount: number;
  uniqueIndexes: any[];
  optimizations: CodebaseOptimization[];
  unchangedCount: number;
  blockedIndexes: number;
  safetyScore: number;
}

interface BatchDashboardProps {
  aggregate: AggregateImpact;
  selectedOpt: CodebaseOptimization | null;
  onSelectOpt: (opt: CodebaseOptimization) => void;
  onRecompute?: () => void;
  analyzingAll?: boolean;
}

export function BatchDashboard({
  aggregate,
  selectedOpt,
  onSelectOpt,
  onRecompute,
  analyzingAll,
}: BatchDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-text-primary text-lg font-mono font-bold flex items-center gap-2">
          <ShieldCheck className="text-success" />
          Whole-Codebase Database Impact Analysis
        </h2>
        {onRecompute && (
          <button
            onClick={onRecompute}
            disabled={analyzingAll}
            className="border border-border text-text-secondary hover:text-primary text-xs font-mono px-3 py-1.5 rounded hover:bg-elevated/40 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={12} />
            Recompute Dashboard
          </button>
        )}
      </div>

      {/* Grid 1: High Level Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          label="PERFORMANCE BOOSTER"
          value={`${aggregate.speedupFactor}x`}
          color="text-success"
          sub="Avg latency reduction"
        />
        <div className="bg-panel border border-border rounded-lg p-5 flex flex-col justify-between qm-stat-card">
          <span className="font-mono text-xs text-text-disabled">QUALITY SCORE</span>
          <div className="my-3 flex items-center gap-3">
            <span className="text-3xl font-mono font-bold text-critical">{aggregate.avgScoreBefore}</span>
            <span className="text-text-disabled text-lg">➔</span>
            <span className="text-3xl font-mono font-bold text-success">{aggregate.avgScoreAfter}</span>
          </div>
          <span className="font-mono text-xs text-text-secondary">Calculated quality boost</span>
        </div>
        <MetricCard
          label="ANTI-PATTERNS"
          value={String(aggregate.totalIssuesCount)}
          color="text-warning"
          sub="Vulnerabilities corrected"
        />
        <div className="bg-panel border border-border rounded-lg p-5 flex flex-col justify-between qm-stat-card">
          <span className="font-mono text-xs text-text-disabled">INDEX SCHEMAS</span>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-4xl font-mono font-bold text-primary leading-none">
              {aggregate.uniqueIndexes.length}
            </span>
            {aggregate.blockedIndexes > 0 && (
              <span className="text-xs font-mono text-text-muted">({aggregate.blockedIndexes} dup blocked)</span>
            )}
          </div>
          <span className="font-mono text-xs text-text-secondary">Missing indexes advised</span>
        </div>
        <div className="bg-panel border border-border rounded-lg p-5 flex flex-col justify-between qm-stat-card">
          <span className="font-mono text-xs text-text-disabled">SCHEMA SAFETY</span>
          <div className="my-3 flex items-center gap-2">
            <span className={`text-4xl font-mono font-bold leading-none ${
              aggregate.safetyScore >= 80 ? "text-success" :
              aggregate.safetyScore >= 50 ? "text-warning" : "text-critical"
            }`}>
              {aggregate.safetyScore}
            </span>
            <span className="text-text-disabled text-sm">/100</span>
          </div>
          <div className={`qm-safety-badge ${
            aggregate.safetyScore >= 80 ? "qm-safety-safe" :
            aggregate.safetyScore >= 50 ? "qm-safety-warn" : "qm-safety-danger"
          }`}>
            {aggregate.safetyScore >= 80 ? "✓ Safe" : aggregate.safetyScore >= 50 ? "⚠ Caution" : "✗ Risk"}
          </div>
        </div>
      </div>

      {/* Unchanged Queries Notice */}
      {aggregate.unchangedCount > 0 && (
        <div className="bg-code border border-success/20 rounded-lg px-4 py-3 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-success shrink-0" />
          <div className="font-mono text-xs">
            <span className="text-success font-bold">{aggregate.unchangedCount}</span>
            <span className="text-text-secondary"> queries are already well-optimized — no changes recommended.</span>
          </div>
        </div>
      )}

      {/* Grid 2: Optimization Diffs + Index Script */}
      <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-4 min-h-[500px]">
        {/* Left: Optimization list */}
        <div className="bg-panel border border-border rounded-lg flex flex-col overflow-hidden">
          <div className="h-10 px-4 flex items-center border-b border-border">
            <span className="section-label">Query Optimization Diffs</span>
          </div>
          <div className="flex-1 overflow-auto qm-scroll divide-y divide-elevated">
            {aggregate.optimizations.map((opt, i) => (
              <button
                key={i}
                onClick={() => onSelectOpt(opt)}
                className={`w-full px-4 py-3 text-left hover:bg-elevated/40 transition-colors ${
                  selectedOpt === opt ? "bg-elevated/60 border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-primary truncate max-w-[200px]">
                    {opt.file}:{opt.line}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <span className="text-critical">{opt.scoreBefore}</span>
                    <span className="text-text-disabled">→</span>
                    <span className="text-success">{opt.scoreAfter}</span>
                  </div>
                </div>
                <div className="text-xs font-mono text-text-muted truncate">
                  {opt.original.slice(0, 60)}{opt.original.length > 60 ? "..." : ""}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Selected optimization detail */}
        <div className="bg-panel border border-border rounded-lg flex flex-col overflow-hidden">
          {selectedOpt ? (
            <>
              <div className="h-10 px-4 flex items-center justify-between border-b border-border shrink-0">
                <span className="section-label">
                  {selectedOpt.file}:{selectedOpt.line}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-critical">{selectedOpt.scoreBefore}</span>
                  <span className="text-text-disabled text-xs">→</span>
                  <span className="text-xs font-mono text-success">{selectedOpt.scoreAfter}</span>
                  <CopyButton text={selectedOpt.optimized} />
                </div>
              </div>
              <div className="flex-1 overflow-auto qm-scroll">
                <div className="px-4 py-2 border-b border-elevated">
                  <div className="text-[10px] font-mono text-text-disabled uppercase mb-1">Original</div>
                  <pre className="text-[12px] font-mono text-text-muted whitespace-pre-wrap">{selectedOpt.original}</pre>
                </div>
                <div className="px-4 py-2 border-b border-elevated">
                  <div className="text-[10px] font-mono text-text-disabled uppercase mb-1">Optimized</div>
                  <pre className="text-[12px] font-mono text-success whitespace-pre-wrap">{selectedOpt.optimized}</pre>
                </div>
                <div className="px-4 py-3 border-b border-elevated">
                  <OptimizationFlow
                    originalSql={selectedOpt.original}
                    optimizedSql={selectedOpt.optimized}
                    issues={selectedOpt.issues}
                    indexes={selectedOpt.indexes}
                  />
                </div>
                {selectedOpt.issues.length > 0 && (
                  <div className="px-4 py-2 border-b border-elevated">
                    <div className="text-[10px] font-mono text-text-disabled uppercase mb-1">Issues ({selectedOpt.issues.length})</div>
                    {selectedOpt.issues.map((issue: any, j: number) => (
                      <div key={j} className="text-[11px] font-mono text-warning mb-1">
                        • {issue.title || issue.name || issue.message || (typeof issue === "object" ? (issue.description || JSON.stringify(issue)) : issue)}
                      </div>
                    ))}
                  </div>
                )}
                {selectedOpt.indexes.length > 0 && (
                  <div className="px-4 py-2">
                    <div className="text-[10px] font-mono text-text-disabled uppercase mb-1">Indexes ({selectedOpt.indexes.length})</div>
                    {selectedOpt.indexes.map((idx: any, j: number) => (
                      <div key={j} className="bg-code rounded p-2 mb-1 text-[11px] font-mono text-primary">
                        {idx.create_statement || idx.sql || JSON.stringify(idx)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-disabled font-mono text-sm">
              Select a query to view optimization details
            </div>
          )}
        </div>
      </div>

      {/* Unified Index Script */}
      {aggregate.uniqueIndexes.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="h-10 px-4 flex items-center justify-between border-b border-border">
            <span className="section-label">Deployable Index Script</span>
            <div className="flex items-center gap-2">
              <CopyButton text={aggregate.uniqueIndexes.map((idx) => (idx.create_statement || idx.sql || "") + ";").join("\n")} />
              <button
                onClick={() => downloadIndexScript(aggregate)}
                className="flex items-center gap-1 text-[11px] font-mono text-text-secondary hover:text-primary transition-colors"
              >
                <Download size={11} /> .sql
              </button>
            </div>
          </div>
          <CodeBlock
            code={aggregate.uniqueIndexes
              .map((idx, i) => `-- Index ${i + 1}: ${idx.reason || idx.note || ""}\n${idx.create_statement || idx.sql || ""};`)
              .join("\n\n")}
          />
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
  return (
    <div className="bg-panel border border-border rounded-lg p-5 flex flex-col justify-between qm-stat-card">
      <span className="font-mono text-xs text-text-disabled">{label}</span>
      <div className="my-3">
        <span className={`text-4xl font-mono font-bold leading-none ${color}`}>{value}</span>
      </div>
      <span className="font-mono text-xs text-text-secondary">{sub}</span>
    </div>
  );
}

function downloadIndexScript(aggregate: AggregateImpact) {
  const content = [
    "-- QueryMind — Recommended Index Script",
    `-- Generated: ${new Date().toISOString()}`,
    `-- Score: ${aggregate.avgScoreBefore} → ${aggregate.avgScoreAfter}`,
    "",
    ...aggregate.uniqueIndexes.map((idx) => `-- ${idx.reason || idx.note || ""}\n${idx.create_statement || idx.sql || ""};`),
  ].join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "querymind-indexes.sql";
  a.click();
  URL.revokeObjectURL(url);
}
