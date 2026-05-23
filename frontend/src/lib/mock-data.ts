/**
 * Shared types and sample query templates.
 * NO mock data — all real data comes from the backend via SSE.
 */

import type { LogEntry } from "@/components/ActivityLog";
import type { AnalysisResult } from "@/components/ResultsPanel";

export type { LogEntry, AnalysisResult };

export interface DiscoveredQuery {
  severity: "critical" | "warning" | "success";
  path: string;
  preview: string;
  language: string;
  sql: string;
}

export interface SchemaTable {
  table: string;
  columns: number;
  rows: number;
  indexes: number;
  size: string;
  column_details?: { name: string; type: string; nullable: boolean }[];
  index_details?: any[];
  primary_key?: string[];
  foreign_keys?: any[];
}

export interface PlanNode {
  depth: number;
  operation: string;
  cost: string;
  rows: number;
  pct: number;
  tone: "critical" | "warning" | "success";
}

/** Sample queries for the "try it" buttons — these are just starter templates */
export const sampleQueries: Record<string, string> = {
  "Slow Join": `SELECT * FROM users u, orders o
WHERE u.id = o.user_id
AND u.email LIKE '%gmail.com'
ORDER BY o.created_at DESC`,
  "N+1 Query": `SELECT * FROM posts
WHERE author_id IN (
  SELECT id FROM users WHERE status = 'active'
)`,
  "Full Scan": `SELECT *
FROM events
WHERE LOWER(event_name) = 'signup'
  AND created_at > '2024-01-01'`,
};

/**
 * Convert SSE events into an AnalysisResult for the ResultsPanel.
 */
export function buildResultFromEvents(events: any[]): AnalysisResult | null {
  const completeEvent = events.find((e) => e.type === "complete" && e.result);
  if (!completeEvent?.result) return null;

  const { issues, indexes, optimization, performance, guard } = completeEvent.result;

  return {
    scoreBefore: performance?.score_before ?? 50,
    scoreAfter: performance?.score_after ?? 75,
    improvement: performance?.estimated_improvement ?? "improved",
    issues: (issues ?? []).map((i: any) => ({
      severity: (i.severity?.toUpperCase() ?? "MEDIUM") as "CRITICAL" | "MEDIUM" | "LOW",
      title: i.name ?? "Issue",
      description: `${i.message ?? ""}\n${i.suggestion ?? ""}`.trim(),
    })),
    optimizedSql: optimization?.optimized ?? "",
    indexes: (indexes ?? []).map((idx: any) => ({
      table: idx.table ?? "",
      sql: idx.create_statement ?? "",
      note: idx.reason ?? "",
    })),
    guard: guard ? {
      safe: guard.safe ?? true,
      safety_score: guard.safety_score ?? 100,
      warnings: guard.warnings ?? [],
      blocked: guard.blocked ?? [],
      approved: guard.approved ?? [],
      unchanged_note: guard.unchanged_note,
    } : undefined,
  };
}
