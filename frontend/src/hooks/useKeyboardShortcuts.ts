/**
 * useKeyboardShortcuts — global keyboard shortcut handler for QueryMind.
 */

import { useEffect } from "react";

interface ShortcutMap {
  /** Ctrl+Enter — run analysis/scan */
  onRun?: () => void;
  /** Ctrl+K — focus SQL input */
  onFocusInput?: () => void;
  /** Ctrl+H — toggle history drawer */
  onToggleHistory?: () => void;
  /** Escape — close modals/panels */
  onEscape?: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === "Enter" && shortcuts.onRun) {
        e.preventDefault();
        shortcuts.onRun();
      }

      if (ctrl && e.key === "k" && shortcuts.onFocusInput) {
        e.preventDefault();
        shortcuts.onFocusInput();
      }

      if (ctrl && e.key === "h" && shortcuts.onToggleHistory) {
        e.preventDefault();
        shortcuts.onToggleHistory();
      }

      if (e.key === "Escape" && shortcuts.onEscape) {
        shortcuts.onEscape();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
