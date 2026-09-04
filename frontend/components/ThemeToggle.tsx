"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`h-9 w-9 rounded-xl border border-slate-200/60 dark:border-white/[0.08] bg-slate-100/50 dark:bg-white/[0.03] ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] text-slate-600 dark:text-white/70 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:border-cyan-300/30 dark:hover:text-cyan-300 hover:shadow-cyan-500/10 active:scale-95 ${className}`}
      aria-label={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
      title={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
    >
      <div className="relative h-4 w-4">
        <Sun
          size={16}
          className={`absolute inset-0 transition-all duration-300 transform ${
            isDark
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100 text-amber-500"
          }`}
        />
        <Moon
          size={16}
          className={`absolute inset-0 transition-all duration-300 transform ${
            isDark
              ? "rotate-0 scale-100 opacity-100 text-cyan-300"
              : "-rotate-90 scale-0 opacity-0"
          }`}
        />
      </div>
    </button>
  );
}
