/**
 * CommandPalette — Cmd+K / Ctrl+K searchable command palette.
 * Inspired by VS Code, Linear, Vercel.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  FolderSearch,
  Database,
  Search,
  Clock,
  Trash2,
  Download,
  FileText,
  Sun,
  Moon,
  Monitor,
  MessageSquare,
  Keyboard,
  Home,
  Play,
  X,
} from "lucide-react";
import { useTheme, type Theme } from "@/hooks/useTheme";

interface CommandPaletteProps {
  onRunAnalysis?: () => void;
  onClearWorkspace?: () => void;
  onToggleHistory?: () => void;
  onExportMarkdown?: () => void;
  onExportIndexes?: () => void;
  onToggleChat?: () => void;
}

export function CommandPalette({
  onRunAnalysis,
  onClearWorkspace,
  onToggleHistory,
  onExportMarkdown,
  onExportIndexes,
  onToggleChat,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const runAction = useCallback(
    (fn: () => void) => {
      fn();
      setOpen(false);
    },
    []
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[540px] z-[101]"
          >
            <Command
              className="bg-panel border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
              label="Command Palette"
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 border-b border-border">
                <Search size={16} className="text-text-muted shrink-0" />
                <Command.Input
                  ref={inputRef}
                  placeholder="Type a command or search..."
                  className="w-full bg-transparent py-3.5 text-sm text-text-primary placeholder:text-text-disabled outline-none font-sans"
                />
                <button
                  onClick={() => setOpen(false)}
                  className="text-text-disabled hover:text-text-muted transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Results */}
              <Command.List className="max-h-[340px] overflow-y-auto p-2 qm-scroll">
                <Command.Empty className="py-8 text-center text-text-muted text-sm">
                  No results found.
                </Command.Empty>

                {/* Navigation */}
                <Command.Group
                  heading={
                    <span className="text-[10px] font-mono text-text-disabled uppercase tracking-wider px-2">
                      Navigation
                    </span>
                  }
                >
                  <CommandItem
                    icon={Home}
                    label="Go to Dashboard"
                    shortcut="⌘1"
                    onSelect={() => runAction(() => navigate({ to: "/" }))}
                  />
                  <CommandItem
                    icon={Zap}
                    label="Quick Analyze"
                    shortcut="⌘2"
                    onSelect={() => runAction(() => navigate({ to: "/quick" }))}
                  />
                  <CommandItem
                    icon={FolderSearch}
                    label="Project Scanner"
                    shortcut="⌘3"
                    onSelect={() => runAction(() => navigate({ to: "/scan" }))}
                  />
                  <CommandItem
                    icon={Database}
                    label="Live Database"
                    shortcut="⌘4"
                    onSelect={() =>
                      runAction(() => navigate({ to: "/connect" }))
                    }
                  />
                </Command.Group>

                {/* Actions */}
                <Command.Group
                  heading={
                    <span className="text-[10px] font-mono text-text-disabled uppercase tracking-wider px-2">
                      Actions
                    </span>
                  }
                >
                  {onRunAnalysis && (
                    <CommandItem
                      icon={Play}
                      label="Run Analysis"
                      shortcut="⌘↵"
                      onSelect={() => runAction(onRunAnalysis)}
                    />
                  )}
                  {onToggleHistory && (
                    <CommandItem
                      icon={Clock}
                      label="Toggle History"
                      shortcut="⌘H"
                      onSelect={() => runAction(onToggleHistory)}
                    />
                  )}
                  {onToggleChat && (
                    <CommandItem
                      icon={MessageSquare}
                      label="Open AI Chat"
                      shortcut="⌘J"
                      onSelect={() => runAction(onToggleChat)}
                    />
                  )}
                  {onClearWorkspace && (
                    <CommandItem
                      icon={Trash2}
                      label="Clear Workspace"
                      onSelect={() => runAction(onClearWorkspace)}
                    />
                  )}
                </Command.Group>

                {/* Export */}
                {(onExportMarkdown || onExportIndexes) && (
                  <Command.Group
                    heading={
                      <span className="text-[10px] font-mono text-text-disabled uppercase tracking-wider px-2">
                        Export
                      </span>
                    }
                  >
                    {onExportMarkdown && (
                      <CommandItem
                        icon={FileText}
                        label="Export Markdown Report"
                        onSelect={() => runAction(onExportMarkdown)}
                      />
                    )}
                    {onExportIndexes && (
                      <CommandItem
                        icon={Download}
                        label="Export Index Script"
                        onSelect={() => runAction(onExportIndexes)}
                      />
                    )}
                  </Command.Group>
                )}

                {/* Theme */}
                <Command.Group
                  heading={
                    <span className="text-[10px] font-mono text-text-disabled uppercase tracking-wider px-2">
                      Theme
                    </span>
                  }
                >
                  <CommandItem
                    icon={Moon}
                    label="Dark Mode"
                    onSelect={() => runAction(() => setTheme("dark"))}
                    active={theme === "dark"}
                  />
                  <CommandItem
                    icon={Sun}
                    label="Light Mode"
                    onSelect={() => runAction(() => setTheme("light"))}
                    active={theme === "light"}
                  />
                  <CommandItem
                    icon={Monitor}
                    label="System Theme"
                    onSelect={() => runAction(() => setTheme("system"))}
                    active={theme === "system"}
                  />
                </Command.Group>
              </Command.List>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border px-4 py-2">
                <div className="flex items-center gap-3 text-text-disabled text-[10px] font-mono">
                  <span className="flex items-center gap-1">
                    <Keyboard size={10} /> Navigate
                  </span>
                  <span>↵ Select</span>
                  <span>Esc Close</span>
                </div>
                <span className="text-text-disabled text-[10px] font-mono">
                  QueryMind
                </span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CommandItem({
  icon: Icon,
  label,
  shortcut,
  onSelect,
  active,
}: {
  icon: typeof Zap;
  label: string;
  shortcut?: string;
  onSelect: () => void;
  active?: boolean;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors data-[selected=true]:bg-elevated/80 data-[selected=true]:text-text-primary text-text-secondary hover:bg-elevated/40"
    >
      <Icon
        size={15}
        className={active ? "text-primary" : "text-text-muted"}
      />
      <span className="flex-1">{label}</span>
      {active && (
        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      )}
      {shortcut && (
        <span className="text-[10px] font-mono text-text-disabled bg-secondary/60 px-1.5 py-0.5 rounded">
          {shortcut}
        </span>
      )}
    </Command.Item>
  );
}

/** Trigger button for the command palette — renders in TopBar */
export function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "k",
            metaKey: true,
            ctrlKey: true,
            bubbles: true,
          })
        );
      }}
      className="hidden sm:flex items-center gap-2 bg-elevated/50 border border-border rounded-lg px-2.5 py-1.5 text-text-disabled hover:text-text-muted hover:bg-elevated hover:border-border transition-all"
      title="Command Palette (Ctrl+K)"
    >
      <Search size={12} />
      <span className="text-[11px] font-mono">Search...</span>
      <span className="text-[10px] font-mono bg-secondary/80 text-text-disabled px-1 py-px rounded ml-2">
        ⌘K
      </span>
    </button>
  );
}
