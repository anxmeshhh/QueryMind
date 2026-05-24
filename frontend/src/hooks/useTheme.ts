/**
 * Theme management hook — dark / light / system with localStorage persistence.
 */

import { useState, useEffect, useCallback } from "react";

export type Theme = "dark" | "light" | "system";

const STORAGE_KEY = "qm_theme";

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "system")
      return stored;
  } catch {}
  return "dark";
}

function applyTheme(resolved: "dark" | "light") {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(resolved);
  root.setAttribute("data-theme", resolved);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() => {
    const t = getStoredTheme();
    return t === "system" ? getSystemTheme() : t;
  });

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {}
  }, []);

  // Apply theme whenever it changes
  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  // Apply on mount
  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    applyTheme(resolved);
  }, []);

  return {
    theme,
    setTheme,
    resolvedTheme,
    isDark: resolvedTheme === "dark",
  };
}
