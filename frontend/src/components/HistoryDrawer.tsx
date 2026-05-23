import { useState, useEffect } from "react";
import { X, Clock, Trash2, Copy, Check, Zap, FolderSearch, Database, ExternalLink } from "lucide-react";
import { fetchAnalyses, deleteAnalysis, type DBAnalysis } from "@/lib/history";
import { AnalysisResult } from "./ResultsPanel";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore?: (analysis: DBAnalysis) => void;
}

export function HistoryDrawer({ isOpen, onClose, onRestore }: HistoryDrawerProps) {
  const [history, setHistory] = useState<DBAnalysis[]>([]);
  const [selectedItem, setSelectedItem] = useState<DBAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      setSelectedItem(null);
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoading(true);
    const data = await fetchAnalyses();
    setHistory(data);
    setLoading(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this analysis?")) {
      const ok = await deleteAnalysis(id);
      if (ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        if (selectedItem?.id === id) {
          setSelectedItem(null);
        }
      }
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-xs">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer panel */}
      <div className="w-full max-w-[550px] bg-panel border-l border-border h-full flex flex-col qm-slide-up shadow-2xl">
        {/* Header */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background/50">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            <span className="text-sm font-semibold tracking-tight text-text-primary">
              Optimization History
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-text-disabled hover:text-text-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex">
          {selectedItem ? (
            /* DETAIL VIEW */
            <div className="flex-1 flex flex-col min-w-0 qm-fade-in bg-background/30">
              {/* Back to List */}
              <div className="h-10 border-b border-border px-3 flex items-center shrink-0">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-text-secondary hover:text-text-primary text-[13px] font-mono transition-colors"
                >
                  ← Back to history
                </button>
              </div>

              {/* Detail body */}
              <div className="flex-1 overflow-auto qm-scroll p-4 space-y-5 font-mono text-[13px]">
                {/* Mode & Date */}
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2">
                    {selectedItem.mode === "quick" && <Zap size={14} className="text-cyan-500" />}
                    {selectedItem.mode === "scan" && <FolderSearch size={14} className="text-emerald-500" />}
                    {selectedItem.mode === "connect" && <Database size={14} className="text-violet-500" />}
                    <span className="text-text-primary font-bold capitalize">
                      {selectedItem.mode} Mode ({selectedItem.dialect})
                    </span>
                  </div>
                  <span className="text-text-disabled text-xs">
                    {new Date(selectedItem.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Score Diff */}
                {(selectedItem.performance_score_before !== null && selectedItem.performance_score_after !== null) && (
                  <div className="bg-code border border-border rounded-lg p-4">
                    <div className="section-label mb-2">Performance Score</div>
                    <div className="flex items-center gap-3">
                      <span className="text-critical font-bold text-2xl">{selectedItem.performance_score_before}</span>
                      <span className="text-text-muted">→</span>
                      <span className="text-success font-bold text-2xl">{selectedItem.performance_score_after}</span>
                      <span className="text-success text-xs ml-auto">
                        +{selectedItem.performance_score_after - selectedItem.performance_score_before} points
                      </span>
                    </div>
                  </div>
                )}

                {/* Original SQL */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="section-label">Original SQL</span>
                    <button
                      onClick={() => handleCopy(selectedItem.original_query, 1)}
                      className="text-text-disabled hover:text-text-secondary flex items-center gap-1 text-[11px] transition-colors"
                    >
                      {copiedIndex === 1 ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                      {copiedIndex === 1 ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="bg-code border border-border rounded p-3 text-[12px] text-text-secondary overflow-x-auto select-all max-h-40 qm-scroll">
                    {selectedItem.original_query}
                  </pre>
                </div>

                {/* Optimized SQL */}
                {selectedItem.optimized_query && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="section-label">Optimized SQL</span>
                      <button
                        onClick={() => handleCopy(selectedItem.optimized_query || "", 2)}
                        className="text-text-disabled hover:text-text-secondary flex items-center gap-1 text-[11px] transition-colors"
                      >
                        {copiedIndex === 2 ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                        {copiedIndex === 2 ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="bg-code/60 border border-primary/30 rounded p-3 text-[12px] text-text-primary overflow-x-auto select-all max-h-40 qm-scroll qm-glow">
                      {selectedItem.optimized_query}
                    </pre>
                  </div>
                )}

                {/* Index Recommendations */}
                {selectedItem.index_recommendations && selectedItem.index_recommendations.length > 0 && (
                  <div>
                    <span className="section-label block mb-2">Index Recommendations</span>
                    <div className="space-y-2">
                      {selectedItem.index_recommendations.map((idx: any, i: number) => (
                        <div key={i} className="bg-panel border border-border rounded p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-primary font-bold text-xs">{idx.table}</span>
                            <button
                              onClick={() => handleCopy(idx.create_statement || idx.sql || "", i + 10)}
                              className="text-text-disabled hover:text-text-secondary text-[10px] flex items-center gap-1"
                            >
                              {copiedIndex === i + 10 ? <Check size={10} className="text-success" /> : <Copy size={10} />}
                              Copy
                            </button>
                          </div>
                          <code className="text-[11px] block bg-code p-1.5 rounded text-text-secondary overflow-x-auto mb-1">
                            {idx.create_statement || idx.sql}
                          </code>
                          <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                            {idx.reason || idx.note}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {onRestore && (
                  <div className="pt-3">
                    <button
                      onClick={() => {
                        onRestore(selectedItem);
                        onClose();
                      }}
                      className="w-full bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={14} />
                      Restore Workspace State
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* LIST VIEW */
            <div className="flex-1 overflow-auto qm-scroll p-3 space-y-2">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-text-disabled text-xs font-mono">Loading history...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <Clock size={28} className="text-text-disabled mb-2" />
                  <p className="text-text-secondary text-sm font-mono">No analysis history yet</p>
                  <p className="text-text-disabled text-xs font-mono mt-1">
                    Your completed optimizations will appear here.
                  </p>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="bg-code hover:bg-elevated/40 border border-border hover:border-text-muted/40 rounded-lg p-3 cursor-pointer transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.mode === "quick" && <Zap size={13} className="text-cyan-500" />}
                        {item.mode === "scan" && <FolderSearch size={13} className="text-emerald-500" />}
                        {item.mode === "connect" && <Database size={13} className="text-violet-500" />}
                        <span className="text-text-primary font-mono text-xs font-semibold capitalize">
                          {item.mode} ({item.dialect})
                        </span>
                      </div>
                      <span className="text-[10px] text-text-disabled font-mono">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* SQL Sneak Peek */}
                    <div className="text-[11px] text-text-muted font-mono truncate bg-panel px-2 py-1 rounded">
                      {item.original_query}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono mt-1">
                      {item.performance_score_before !== null ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-disabled">Score:</span>
                          <span className="text-critical font-bold">{item.performance_score_before}</span>
                          <span className="text-text-disabled">→</span>
                          <span className="text-success font-bold">{item.performance_score_after}</span>
                        </div>
                      ) : (
                        <span className="text-text-disabled">{item.issues_count} issues found</span>
                      )}

                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="text-text-disabled hover:text-critical p-1 transition-colors rounded"
                        title="Delete from history"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
