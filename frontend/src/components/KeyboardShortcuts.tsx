/**
 * KeyboardShortcutsOverlay — shows a modal with all available shortcuts.
 * Triggered by pressing Ctrl+/ or Cmd+/ from anywhere in the app.
 */

import { useState, useEffect } from "react";
import { X, Keyboard } from "lucide-react";

const shortcuts = [
  { keys: ["Ctrl", "Enter"], action: "Run analysis / Start scan" },
  { keys: ["Ctrl", "K"], action: "Focus search input" },
  { keys: ["Ctrl", "H"], action: "Toggle history drawer" },
  { keys: ["Ctrl", "/"], action: "Show keyboard shortcuts" },
  { keys: ["Ctrl", "Enter"], action: "Generate SQL (in Natural Language tab)" },
  { keys: ["Esc"], action: "Close modals and panels" },
];

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-[380px] bg-panel border border-border rounded-xl shadow-2xl shadow-black/30 qm-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-primary" />
            <span className="text-text-primary text-sm font-semibold">Keyboard Shortcuts</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-text-disabled hover:text-text-secondary transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-text-secondary text-[13px]">{s.action}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <span key={j}>
                    <kbd className="bg-elevated border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-text-primary min-w-[24px] text-center inline-block">
                      {k}
                    </kbd>
                    {j < s.keys.length - 1 && <span className="text-text-disabled text-[10px] mx-0.5">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border">
          <span className="text-text-disabled text-[10px] font-mono">Press Ctrl+/ to toggle this overlay</span>
        </div>
      </div>
    </div>
  );
}
