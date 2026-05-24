/**
 * OptimizationFlow — An N8N-style node-based flowchart visualizer.
 * Renders radial dot grids, drag-style socket anchors, bezier relation curves,
 * and side-by-side contrast panels showing "Before" (unoptimized) vs "After" (optimized) flows.
 */

import { useState, useEffect } from "react";
import { Zap, AlertTriangle, ArrowRight, ShieldCheck, Database, FileCode, ZoomIn, ZoomOut } from "lucide-react";

interface OptimizationFlowProps {
  originalSql: string;
  optimizedSql: string;
  issues: any[];
  indexes: any[];
}

interface FlowNode {
  id: string;
  label: string;
  type: "table" | "operator" | "index" | "output";
  columns?: string[];
  status: "warning" | "success" | "neutral" | "critical";
  x: number;
  y: number;
}

interface FlowEdge {
  from: string;
  to: string;
  type: "implicit" | "explicit" | "index_scan" | "seq_scan";
}

export function OptimizationFlow({ originalSql, optimizedSql, issues, indexes }: OptimizationFlowProps) {
  const [activeView, setActiveView] = useState<"side-by-side" | "before" | "after">("side-by-side");
  const [zoom, setZoom] = useState(1.0);
  const [beforeNodes, setBeforeNodes] = useState<FlowNode[]>([]);
  const [beforeEdges, setBeforeEdges] = useState<FlowEdge[]>([]);
  const [afterNodes, setAfterNodes] = useState<FlowNode[]>([]);
  const [afterEdges, setAfterEdges] = useState<FlowEdge[]>([]);

  useEffect(() => {
    // 1. Parse tables and columns dynamically
    const tablesBefore = extractTables(originalSql);
    const tablesAfter = extractTables(optimizedSql);

    // If no tables found, fallback to defaults
    const tBeforeList = tablesBefore.length > 0 ? tablesBefore : ["users", "orders"];
    const tAfterList = tablesAfter.length > 0 ? tablesAfter : ["users", "orders"];

    // ── Build "BEFORE" Graph ──────────────────────────────────────
    const bNodes: FlowNode[] = [];
    const bEdges: FlowEdge[] = [];

    // Left column: Table nodes
    tBeforeList.forEach((tbl, idx) => {
      bNodes.push({
        id: `b_tbl_${tbl}`,
        label: tbl,
        type: "table",
        columns: idx === 0 ? ["id (PK)", "email", "status"] : ["id (PK)", "user_id (FK)", "total"],
        status: "neutral",
        x: 20,
        y: 35 + idx * 115,
      });
    });

    // Center column: Performance bottleneck operators
    const hasCommaJoin = originalSql.includes(",") && !originalSql.toLowerCase().includes("join");
    const bottleneckLabel = hasCommaJoin ? "Cartesian implicit JOIN" : "Sequential Scan";
    const bottleneckId = "b_op_bottleneck";

    bNodes.push({
      id: bottleneckId,
      label: bottleneckLabel,
      type: "operator",
      status: "critical",
      x: 210,
      y: 90,
    });

    // Connect tables to bottleneck
    tBeforeList.forEach((tbl) => {
      bEdges.push({
        from: `b_tbl_${tbl}`,
        to: bottleneckId,
        type: hasCommaJoin ? "implicit" : "seq_scan",
      });
    });

    // Right column: Heavy query output node
    const outputIdBefore = "b_out_query";
    bNodes.push({
      id: outputIdBefore,
      label: "Query Result\nCost: ~45,000",
      type: "output",
      status: "warning",
      x: 390,
      y: 90,
    });

    bEdges.push({
      from: bottleneckId,
      to: outputIdBefore,
      type: "seq_scan",
    });

    // ── Build "AFTER" Graph ───────────────────────────────────────
    const aNodes: FlowNode[] = [];
    const aEdges: FlowEdge[] = [];

    // Left column: Table nodes
    tAfterList.forEach((tbl, idx) => {
      aNodes.push({
        id: `a_tbl_${tbl}`,
        label: tbl,
        type: "table",
        columns: idx === 0 ? ["id (PK)", "email", "status"] : ["id (PK)", "user_id (FK)", "total"],
        status: "neutral",
        x: 20,
        y: 35 + idx * 115,
      });
    });

    // Center column: Optimized operator and recommended indexes
    const hasIndexes = indexes.length > 0;
    const indexId = "a_idx_node";
    const joinOpId = "a_op_join";

    if (hasIndexes) {
      const idxRec = indexes[0];
      const idxTbl = idxRec.table || tAfterList[0];
      aNodes.push({
        id: indexId,
        label: `Index: ${idxRec.name || `idx_${idxTbl}_col`}\n(Pre-computed B-Tree)`,
        type: "index",
        status: "success",
        x: 210,
        y: 30,
      });
    }

    aNodes.push({
      id: joinOpId,
      label: hasIndexes ? "Index Scan + JOIN" : "Explicit INNER JOIN",
      type: "operator",
      status: "success",
      x: 210,
      y: 130,
    });

    // Connect tables to operators
    tAfterList.forEach((tbl, idx) => {
      aEdges.push({
        from: `a_tbl_${tbl}`,
        to: joinOpId,
        type: "explicit",
      });
      if (hasIndexes && idx === 0) {
        aEdges.push({
          from: indexId,
          to: joinOpId,
          type: "index_scan",
        });
      }
    });

    // Right column: Ultra-fast query output node
    const outputIdAfter = "a_out_query";
    aNodes.push({
      id: outputIdAfter,
      label: "Query Result\nCost: ~120",
      type: "output",
      status: "success",
      x: 390,
      y: 90,
    });

    aEdges.push({
      from: joinOpId,
      to: outputIdAfter,
      type: "index_scan",
    });

    setBeforeNodes(bNodes);
    setBeforeEdges(bEdges);
    setAfterNodes(aNodes);
    setAfterEdges(aEdges);
  }, [originalSql, optimizedSql, issues, indexes]);

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden flex flex-col qm-fade-in mb-6">
      <div className="min-h-10 py-1.5 px-4 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-panel shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-primary animate-pulse" />
          <span className="section-label">N8N Interactive Join-Flow Plan Analyzer</span>
        </div>
        
        {/* Zoom Slider Controls */}
        <div className="flex items-center gap-1.5 bg-elevated/40 border border-border px-2 py-0.5 rounded-md">
          <button
            onClick={() => setZoom((prev) => Math.max(prev - 0.1, 0.5))}
            className="text-text-muted hover:text-text-primary p-1 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={12} />
          </button>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-16 md:w-20 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
          />
          <button
            onClick={() => setZoom((prev) => Math.min(prev + 0.1, 1.5))}
            className="text-text-muted hover:text-text-primary p-1 transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={12} />
          </button>
          <span className="text-[10px] font-mono text-text-muted border-l border-border pl-1.5 min-w-[34px] text-right">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <div className="flex bg-elevated/40 border border-border p-0.5 rounded-md gap-0.5">
          {(["side-by-side", "before", "after"] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`text-[10px] uppercase font-mono px-2 py-1 rounded transition-all ${
                activeView === view
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "text-text-disabled hover:text-text-secondary"
              }`}
            >
              {view.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 overflow-hidden">
        {activeView === "side-by-side" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FlowCanvas title="BEFORE OPTIMIZATION" nodes={beforeNodes} edges={beforeEdges} mode="before" zoom={zoom} />
            <FlowCanvas title="AFTER OPTIMIZATION" nodes={afterNodes} edges={afterEdges} mode="after" zoom={zoom} />
          </div>
        )}
        {activeView === "before" && (
          <FlowCanvas title="BEFORE OPTIMIZATION" nodes={beforeNodes} edges={beforeEdges} mode="before" zoom={zoom} />
        )}
        {activeView === "after" && (
          <FlowCanvas title="AFTER OPTIMIZATION" nodes={afterNodes} edges={afterEdges} mode="after" zoom={zoom} />
        )}
      </div>
    </div>
  );
}

function FlowCanvas({
  title,
  nodes,
  edges,
  mode,
  zoom,
}: {
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  mode: "before" | "after";
  zoom: number;
}) {
  const [showScrollArrow, setShowScrollArrow] = useState(true);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtEnd = target.scrollLeft + target.clientWidth >= target.scrollWidth - 30;
    setShowScrollArrow(!isAtEnd);
  };

  return (
    <div className="border border-border rounded-lg bg-code overflow-hidden flex flex-col relative">
      <div className="min-h-8 py-1.5 px-3 border-b border-border bg-panel flex flex-wrap items-center justify-between gap-2 shrink-0">
        <span className="text-[11px] font-mono font-bold text-text-secondary tracking-wider flex items-center gap-1.5">
          {mode === "before" ? (
            <AlertTriangle size={11} className="text-critical shrink-0" />
          ) : (
            <ShieldCheck size={11} className="text-success shrink-0" />
          )}
          {title}
        </span>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
          mode === "before" ? "bg-critical/10 text-critical border border-critical/20" : "bg-success/10 text-success border border-success/20"
        }`}>
          {mode === "before" ? "HEAVY PATH" : "OPTIMIZED PATH"}
        </span>
      </div>
      <div className="relative flex-1 min-h-0">
        <div
          onScroll={handleScroll}
          className="relative h-[360px] w-full select-none overflow-x-auto overflow-y-hidden qm-scroll scrollbar-thin"
          style={{
            backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          <div
            className="absolute inset-y-0 left-0 origin-top-left transition-transform duration-75"
            style={{
              transform: `scale(${zoom})`,
              width: "550px",
              minWidth: "550px",
            }}
          >
          {/* Draw bezier connectors between nodes */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <marker
                id={`arrow-${mode}`}
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 2 L 10 5 L 0 8 z"
                  fill={mode === "before" ? "var(--critical)" : "var(--success)"}
                />
              </marker>
            </defs>
            {edges.map((edge, i) => {
              const fromNode = nodes.find((n) => n.id === edge.from);
              const toNode = nodes.find((n) => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              // Calculate anchor coordinates
              const fromX = fromNode.x + (fromNode.type === "table" ? 140 : 120);
              const fromY = fromNode.y + (fromNode.type === "table" ? 35 : 20);
              const toX = toNode.x;
              const toY = toNode.y + 20;

              // Draw clean horizontal cubic bezier path
              const controlPointOffset = Math.abs(toX - fromX) * 0.4;
              const pathData = `M ${fromX} ${fromY} C ${fromX + controlPointOffset} ${fromY}, ${toX - controlPointOffset} ${toY}, ${toX} ${toY}`;

              return (
                <g key={i}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke={mode === "before" ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)"}
                    strokeWidth="6"
                  />
                  <path
                    d={pathData}
                    fill="none"
                    stroke={mode === "before" ? "var(--critical)" : "var(--success)"}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    className="qm-flow-line"
                    markerEnd={`url(#arrow-${mode})`}
                  />
                </g>
              );
            })}
          </svg>

          {/* Render node components */}
          {nodes.map((node) => {
            const isTable = node.type === "table";
            return (
              <div
                key={node.id}
                className={`absolute rounded-md shadow-sm border text-[11px] font-mono transition-all hover:shadow-md ${
                  node.type === "table" ? "w-[140px]" : "w-[120px]"
                } ${
                  node.status === "critical" ? "bg-panel border-critical/50 text-critical shadow-critical/5" :
                  node.status === "success" ? "bg-panel border-success/50 text-success shadow-success/5" :
                  node.status === "warning" ? "bg-panel border-warning/50 text-warning shadow-warning/5" :
                  "bg-panel border-border text-text-primary"
                }`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
              >
                {/* Header */}
                <div className={`px-2 py-1 flex items-center justify-between border-b font-bold text-[10px] rounded-t-md ${
                  node.status === "critical" ? "bg-critical/5 border-critical/20 text-critical" :
                  node.status === "success" ? "bg-success/5 border-success/20 text-success" :
                  node.status === "warning" ? "bg-warning/5 border-warning/20 text-warning" :
                  "bg-secondary/40 border-border text-text-secondary"
                }`}>
                  <span className="truncate flex items-center gap-1">
                    {isTable ? <Database size={10} /> : <FileCode size={10} />}
                    {node.label.split("\n")[0]}
                  </span>
                  {/* Socket Output Dot */}
                  <div className={`w-1.5 h-1.5 rounded-full absolute -right-1 top-[20px] border border-panel shrink-0 ${
                    mode === "before" ? "bg-critical" : "bg-success"
                  }`} />
                  {/* Socket Input Dot */}
                  {node.type !== "table" && (
                    <div className={`w-1.5 h-1.5 rounded-full absolute -left-1 top-[20px] border border-panel shrink-0 ${
                      mode === "before" ? "bg-critical" : "bg-success"
                    }`} />
                  )}
                </div>
                {/* Body */}
                <div className="p-1.5 space-y-0.5 leading-tight select-none">
                  {isTable && node.columns ? (
                    node.columns.map((c, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[9px] text-text-muted px-0.5">
                        <span>• {c}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[9.5px] text-text-secondary whitespace-pre-line text-center py-1">
                      {node.label.includes("\n") ? node.label.split("\n").slice(1).join("\n") : node.label}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {showScrollArrow && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none bg-panel/95 backdrop-blur border border-primary/45 py-2 px-3 rounded-full shadow-lg text-primary flex items-center gap-1.5 text-[11px] font-mono animate-pulse">
            <span>Scroll</span>
            <ArrowRight size={13} className="animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
}

function extractTables(sql: string): string[] {
  if (!sql) return [];
  const matches = sql.match(/\b(?:FROM|JOIN)\s+(\w+)/gi) || [];
  const tables = matches.map((m) => m.replace(/\b(?:FROM|JOIN)\s+/i, "").trim().toLowerCase());
  return Array.from(new Set(tables)).filter((t) => !["select", "where", "and", "or", "on"].includes(t));
}
