/**
 * QueryDiff — inline diff view comparing original vs optimized SQL.
 * Highlights additions in green, removals in red, unchanged in gray.
 */

import { useState } from "react";
import { CopyButton } from "./CopyButton";
import { GitCompare, Columns2, AlignLeft } from "lucide-react";

function computeDiff(original: string, optimized: string): { type: "same" | "add" | "remove"; text: string }[] {
  const origLines = original.trim().split("\n");
  const optLines = optimized.trim().split("\n");
  const result: { type: "same" | "add" | "remove"; text: string }[] = [];

  const maxLen = Math.max(origLines.length, optLines.length);
  let oi = 0, ni = 0;

  while (oi < origLines.length || ni < optLines.length) {
    const origLine = oi < origLines.length ? origLines[oi] : undefined;
    const optLine = ni < optLines.length ? optLines[ni] : undefined;

    if (origLine !== undefined && optLine !== undefined) {
      if (origLine.trim() === optLine.trim()) {
        result.push({ type: "same", text: optLine });
        oi++;
        ni++;
      } else {
        result.push({ type: "remove", text: origLine });
        result.push({ type: "add", text: optLine });
        oi++;
        ni++;
      }
    } else if (origLine !== undefined) {
      result.push({ type: "remove", text: origLine });
      oi++;
    } else if (optLine !== undefined) {
      result.push({ type: "add", text: optLine });
      ni++;
    }
  }

  return result;
}

export function QueryDiff({ original, optimized }: { original: string; optimized: string }) {
  const [mode, setMode] = useState<"diff" | "side">("diff");
  const diff = computeDiff(original, optimized);

  const hasChanges = diff.some((d) => d.type !== "same");

  if (!hasChanges) {
    return (
      <div className="text-text-muted text-[12px] font-mono px-4 py-3 bg-code border-t border-border">
        No structural changes — query is already optimized.
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <div className="flex items-center justify-between px-4 py-2 bg-panel/50 border-b border-border">
        <div className="flex items-center gap-2">
          <GitCompare size={13} className="text-primary" />
          <span className="text-text-primary text-[12px] font-semibold">Query Diff</span>
          <span className="text-text-disabled text-[10px] font-mono">
            {diff.filter((d) => d.type === "remove").length} removed · {diff.filter((d) => d.type === "add").length} added
          </span>
        </div>
        <div className="flex items-center gap-1 bg-elevated border border-border rounded-md p-0.5">
          <button
            onClick={() => setMode("diff")}
            className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all flex items-center gap-1 ${
              mode === "diff" ? "bg-primary/15 text-primary" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <AlignLeft size={10} /> Inline
          </button>
          <button
            onClick={() => setMode("side")}
            className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all flex items-center gap-1 ${
              mode === "side" ? "bg-primary/15 text-primary" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Columns2 size={10} /> Side-by-side
          </button>
        </div>
      </div>

      {mode === "diff" ? (
        <div className="bg-code overflow-x-auto qm-scroll">
          <pre className="font-mono text-[12px] leading-6 py-2">
            {diff.map((line, i) => (
              <div
                key={i}
                className={`px-4 ${
                  line.type === "add"
                    ? "bg-success/8 text-success"
                    : line.type === "remove"
                    ? "bg-critical/8 text-critical line-through opacity-70"
                    : "text-text-secondary"
                }`}
              >
                <span className="inline-block w-5 text-text-disabled select-none shrink-0">
                  {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
                </span>
                {line.text || " "}
              </div>
            ))}
          </pre>
        </div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-border bg-code">
          <div className="overflow-x-auto qm-scroll">
            <div className="px-3 py-1.5 border-b border-border text-[10px] font-mono text-critical flex items-center justify-between">
              <span>Original</span>
              <CopyButton text={original} />
            </div>
            <pre className="font-mono text-[12px] leading-6 py-2 px-4 text-text-secondary">
              {original.trim().split("\n").map((ln, i) => (
                <div key={i}>{ln || " "}</div>
              ))}
            </pre>
          </div>
          <div className="overflow-x-auto qm-scroll">
            <div className="px-3 py-1.5 border-b border-border text-[10px] font-mono text-success flex items-center justify-between">
              <span>Optimized</span>
              <CopyButton text={optimized} />
            </div>
            <pre className="font-mono text-[12px] leading-6 py-2 px-4 text-success">
              {optimized.trim().split("\n").map((ln, i) => (
                <div key={i}>{ln || " "}</div>
              ))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
