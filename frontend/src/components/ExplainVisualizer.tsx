/**
 * ExplainVisualizer — interactive execution plan tree visualizer.
 * Parses standard Postgres EXPLAIN (JSON/text) or SQLite EXPLAIN QUERY PLAN
 * and visualizes it as a node-based tree with metric highlighting.
 */

import { useState, useMemo } from "react";
import {
  Activity,
  Layers,
  ChevronRight,
  TrendingDown,
  Info,
  Sliders,
  DollarSign,
  Clock,
} from "lucide-react";

interface ExplainNode {
  name: string;
  cost?: string | number;
  rows?: string | number;
  width?: string | number;
  time?: string | number;
  detail?: string;
  children?: ExplainNode[];
  isHighlight?: boolean;
}

interface ExplainVisualizerProps {
  plan: any; // Can be array of strings, object, or JSON format
  dialect?: string;
}

export function ExplainVisualizer({ plan, dialect = "postgresql" }: ExplainVisualizerProps) {
  const [selectedNode, setSelectedNode] = useState<ExplainNode | null>(null);

  // Parse raw plan into structured tree
  const tree = useMemo(() => {
    if (!plan) return null;

    try {
      if (dialect === "postgresql" || dialect === "postgres") {
        return parsePostgresPlan(plan);
      } else if (dialect === "sqlite") {
        return parseSqlitePlan(plan);
      } else if (dialect === "mysql") {
        return parseMysqlPlan(plan);
      }
    } catch (e) {
      console.error("Failed to parse execution plan:", e);
    }

    // Fallback: simple text rendering nodes
    return {
      name: "Execution Plan Root",
      detail: Array.isArray(plan) ? plan.join("\n") : String(plan),
    };
  }, [plan, dialect]);

  // Set default selection to root
  useMemo(() => {
    if (tree) setSelectedNode(tree);
  }, [tree]);

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <Activity size={32} className="mb-2 opacity-50" />
        <span className="text-xs font-mono">No execution plan available. Run query on a live database to view plan.</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[60fr_40fr] gap-4 min-h-[350px]">
      {/* Tree Visualization panel */}
      <div className="bg-code border border-border rounded-xl p-4 flex flex-col justify-between overflow-auto qm-scroll">
        <div>
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Layers size={14} className="text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Visual Plan Nodes</span>
          </div>

          {tree && (
            <div className="pl-2 space-y-1">
              <TreeNode
                node={tree}
                selected={selectedNode}
                onSelect={setSelectedNode}
                depth={0}
              />
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border/50 text-[10px] text-text-disabled flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-critical/30 border border-critical" /> Bottleneck Alert
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-success/30 border border-success" /> Optimal Scan
          </span>
        </div>
      </div>

      {/* Node detail side panel */}
      <div className="bg-panel border border-border rounded-xl p-4 flex flex-col justify-between">
        {selectedNode ? (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono text-primary font-bold uppercase tracking-wider">Node Operation</div>
              <h4 className="text-base font-semibold text-text-primary mt-1">{selectedNode.name}</h4>
              {selectedNode.detail && (
                <p className="text-xs font-mono bg-code border border-border rounded-md p-2 mt-2 whitespace-pre-wrap text-text-secondary leading-relaxed">
                  {selectedNode.detail}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {selectedNode.cost !== undefined && (
                <MetricCard
                  label="Est. Cost"
                  value={selectedNode.cost}
                  icon={DollarSign}
                  desc="Total execution cost estimate"
                />
              )}
              {selectedNode.rows !== undefined && (
                <MetricCard
                  label="Est. Rows"
                  value={selectedNode.rows}
                  icon={Sliders}
                  desc="Number of output rows"
                />
              )}
              {selectedNode.time !== undefined && (
                <MetricCard
                  label="Exec Time"
                  value={`${selectedNode.time} ms`}
                  icon={Clock}
                  desc="Actual node execution time"
                  highlight={Number(selectedNode.time) > 10}
                />
              )}
              {selectedNode.width !== undefined && (
                <MetricCard
                  label="Row Width"
                  value={`${selectedNode.width} B`}
                  icon={Info}
                  desc="Estimated width in bytes"
                />
              )}
            </div>

            {selectedNode.isHighlight && (
              <div className="bg-critical/8 border border-critical/20 rounded-lg p-3 flex items-start gap-2.5">
                <TrendingDown size={16} className="text-critical shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-text-primary">Performance Alert</div>
                  <div className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                    This operation takes a high proportion of query time/cost. Scan operations or nested loops on large tables should be indexed.
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-text-muted text-xs">
            Select a plan node to view metrics
          </div>
        )}

        <div className="text-[10px] text-text-disabled text-right font-mono mt-4">
          Dialect: {dialect.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

function TreeNode({
  node,
  selected,
  onSelect,
  depth,
}: {
  node: ExplainNode;
  selected: ExplainNode | null;
  onSelect: (node: ExplainNode) => void;
  depth: number;
}) {
  const isSelected = selected === node;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col">
      <div
        onClick={() => onSelect(node)}
        className={`group flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-all border ${
          isSelected
            ? "bg-primary/10 border-primary/30 text-text-primary"
            : node.isHighlight
            ? "bg-critical/5 border-critical/20 hover:bg-critical/10 text-text-secondary"
            : "bg-elevated/40 border-transparent hover:bg-elevated/80 text-text-secondary"
        }`}
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasChildren && <ChevronRight size={12} className={`text-text-disabled transition-transform ${isSelected ? "rotate-90" : ""}`} />}
          <span className="font-mono text-xs truncate font-medium">
            {node.name}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 pl-2">
          {node.cost !== undefined && (
            <span className="text-[10px] font-mono text-text-disabled">
              cost: <span className="text-text-muted">{node.cost}</span>
            </span>
          )}
          {node.time !== undefined && (
            <span className="text-[10px] font-mono text-primary font-semibold">
              {node.time}ms
            </span>
          )}
        </div>
      </div>

      {hasChildren &&
        node.children!.map((child, i) => (
          <TreeNode
            key={i}
            node={child}
            selected={selected}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  desc,
  highlight = false,
}: {
  label: string;
  value: string | number;
  icon: typeof Info;
  desc: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border rounded-lg p-2.5 transition-all ${
        highlight
          ? "bg-critical/5 border-critical/20"
          : "bg-elevated/50 border-border hover:bg-elevated"
      }`}
      title={desc}
    >
      <div className="flex items-center justify-between text-text-disabled">
        <span className="text-[10px] uppercase font-mono tracking-wider">{label}</span>
        <Icon size={12} className="text-text-disabled" />
      </div>
      <div className={`text-sm font-mono font-bold mt-1 ${highlight ? "text-critical" : "text-text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

// ── Plan Parsers ───────────────────────────────────────────────

function parsePostgresPlan(plan: any): ExplainNode {
  // If plan is in JSON format
  if (Array.isArray(plan) && plan[0] && typeof plan[0] === "object" && plan[0]["Plan"]) {
    const rawPlan = plan[0]["Plan"];
    return convertPgJsonNode(rawPlan);
  }

  // Fallback: parse raw text rows
  const rows = Array.isArray(plan) ? plan : String(plan).split("\n");
  return parseTextPlan(rows);
}

function convertPgJsonNode(node: any): ExplainNode {
  const op = node["Node Type"] || "Operation";
  const cost = node["Total Cost"] || node["Startup Cost"] || 0;
  const rows = node["Plan Rows"] || 0;
  const time = node["Actual Total Time"] || undefined;
  const width = node["Plan Width"] || 0;

  // Detail keys
  const details = [];
  if (node["Relation Name"]) details.push(`Table: ${node["Relation Name"]}`);
  if (node["Index Name"]) details.push(`Index: ${node["Index Name"]}`);
  if (node["Filter"]) details.push(`Filter: ${node["Filter"]}`);
  if (node["Index Cond"]) details.push(`Index Cond: ${node["Index Cond"]}`);
  if (node["Join Type"]) details.push(`Join Type: ${node["Join Type"]}`);

  const children = node["Plans"] ? node["Plans"].map((c: any) => convertPgJsonNode(c)) : [];
  const isHighlight = op.toLowerCase().includes("scan") || cost > 500;

  return {
    name: op,
    cost,
    rows,
    width,
    time,
    detail: details.join("\n"),
    children,
    isHighlight,
  };
}

function parseTextPlan(rows: string[]): ExplainNode {
  const root: ExplainNode = { name: "Query Execution Root", children: [] };
  let current = root;

  rows.forEach((row) => {
    const trimmed = row.trim();
    if (!trimmed) return;

    // Look for cost estimates
    const costMatch = row.match(/cost=([\d.]+)\.\.([\d.]+)/);
    const rowsMatch = row.match(/rows=(\d+)/);

    let name = trimmed.split("  ")[0].replace("->", "").trim();
    if (name.includes("(")) name = name.split("(")[0].trim();

    const node: ExplainNode = {
      name,
      detail: trimmed,
      cost: costMatch ? costMatch[2] : undefined,
      rows: rowsMatch ? rowsMatch[1] : undefined,
      isHighlight: name.toLowerCase().includes("scan") || name.toLowerCase().includes("loop"),
    };

    if (root.children!.length === 0) {
      root.children!.push(node);
      current = node;
    } else {
      current.children = current.children || [];
      current.children.push(node);
    }
  });

  return root.children![0] || root;
}

function parseSqlitePlan(plan: any): ExplainNode {
  const rows = Array.isArray(plan) ? plan : String(plan).split("\n");
  const root: ExplainNode = { name: "SQLite Execution Plan", children: [] };

  rows.forEach((row) => {
    // Sqlite plan usually format like: (0, 0, 0, 'SCAN TABLE users') or raw text
    const clean = row.replace(/[()'"[\]]/g, "");
    const parts = clean.split(",");
    const opText = parts[parts.length - 1]?.trim() || clean;

    root.children!.push({
      name: opText.toUpperCase(),
      detail: row,
      isHighlight: opText.toLowerCase().includes("scan"),
    });
  });

  return root;
}

function parseMysqlPlan(plan: any): ExplainNode {
  // MySQL JSON or Table explain representation
  if (Array.isArray(plan)) {
    const root: ExplainNode = { name: "MySQL Execution Plan", children: [] };
    plan.forEach((step: any) => {
      const tbl = step["table"] || step["Table"] || "?";
      const type = step["type"] || step["Type"] || "Scan";
      const key = step["key"] || step["Key"] || "NULL";
      const rows = step["rows"] || step["Rows"] || 0;

      root.children!.push({
        name: `${type.toUpperCase()} ON ${tbl}`,
        detail: `Using index key: ${key}\nFiltered: ${step["filtered"] || "?"}%`,
        rows,
        isHighlight: type.toLowerCase() === "all",
      });
    });
    return root;
  }

  return { name: "MySQL Plan", detail: JSON.stringify(plan) };
}
