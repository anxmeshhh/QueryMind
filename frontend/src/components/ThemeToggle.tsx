/**
 * ThemeToggle — cycles between dark / light / system with animated icon transitions.
 */

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { motion, AnimatePresence } from "framer-motion";

const iconMap: Record<Theme, typeof Sun> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

const labelMap: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

const cycle: Theme[] = ["dark", "light", "system"];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const next = () => {
    const idx = cycle.indexOf(theme);
    setTheme(cycle[(idx + 1) % cycle.length]);
  };

  const Icon = iconMap[theme];

  return (
    <button
      onClick={next}
      className="relative flex items-center gap-1.5 text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-elevated transition-all"
      title={`Theme: ${labelMap[theme]} — Click to cycle`}
      aria-label={`Switch theme. Current: ${labelMap[theme]}`}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.15 }}
        >
          <Icon size={15} />
        </motion.span>
      </AnimatePresence>
      <span className="text-[10px] font-mono hidden sm:inline">
        {labelMap[theme]}
      </span>
    </button>
  );
}
