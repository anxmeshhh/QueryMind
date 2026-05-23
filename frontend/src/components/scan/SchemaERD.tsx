/**
 * SchemaERD — Reusable ERD schema diagram component.
 * Used by both /scan and /connect pages.
 */

import { Key, ArrowUpRight, Table2 } from "lucide-react";

export interface ERDTable {
  name: string;
  columns?: { name: string; type?: string }[];
  indexes?: any[];
  primary_key?: string[];
  foreign_keys?: { column: string; ref_table: string; ref_column: string }[];
}

interface SchemaERDProps {
  tables: ERDTable[];
  ormModels?: { name: string; orm: string }[];
  title?: string;
}

export function SchemaERD({ tables, ormModels = [], title = "Discovered Database Schema (ERD)" }: SchemaERDProps) {
  if (tables.length === 0) return null;

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="h-10 px-4 flex items-center justify-between border-b border-border">
        <span className="section-label flex items-center gap-1.5">
          <Table2 size={12} className="text-primary" /> {title}
        </span>
        <span className="text-[10px] font-mono text-text-disabled">
          {tables.length} tables · {tables.reduce((a, t) => a + (t.columns?.length || 0), 0)} columns
        </span>
      </div>
      <div className="p-6 qm-erd-grid">
        {tables.map((table, i) => (
          <div key={i} className="qm-schema-card qm-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="qm-schema-card-header">
              <span>{table.name}</span>
              {(table.indexes?.length ?? 0) > 0 && (
                <span className="text-[9px] bg-primary/10 text-primary px-1.5 rounded">
                  {table.indexes!.length} idx
                </span>
              )}
            </div>
            <div className="qm-schema-card-body">
              {(table.columns || []).slice(0, 8).map((col, j) => {
                const isPk = table.primary_key?.includes(col.name);
                const isFk = (table.foreign_keys || []).some((fk) => fk.column === col.name);
                return (
                  <div key={j} className="qm-schema-col">
                    {isPk && <Key size={10} className="text-yellow-500" />}
                    {isFk && !isPk && <ArrowUpRight size={10} className="text-blue-400" />}
                    {!isPk && !isFk && <span className="w-[10px]" />}
                    <span className={isPk ? "qm-schema-col-pk" : isFk ? "qm-schema-col-fk" : ""}>
                      {col.name}
                    </span>
                    <span className="qm-schema-col-type">{col.type || "?"}</span>
                  </div>
                );
              })}
              {(table.columns || []).length > 8 && (
                <div className="qm-schema-col text-text-disabled text-[10px]">
                  +{table.columns!.length - 8} more columns
                </div>
              )}
            </div>
            {/* FK Relationships */}
            {(table.foreign_keys || []).length > 0 && (
              <div className="px-4 py-2.5 border-t border-border space-y-1.5">
                {table.foreign_keys!.map((fk, k) => (
                  <div key={k} className="text-[10px] font-mono text-info flex items-center gap-1.5">
                    <ArrowUpRight size={9} /> {fk.column} → {fk.ref_table}.{fk.ref_column}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {ormModels.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <div className="text-[10px] font-mono text-text-muted">
            ORM Models Detected: {ormModels.map((m) => `${m.name} (${m.orm})`).join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}
