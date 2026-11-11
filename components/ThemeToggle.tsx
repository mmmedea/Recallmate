"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:scale-105 transition-all border border-slate-200 dark:border-slate-700"
      aria-label={mounted ? `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode` : "Theme mode"}
      title={mounted ? `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode` : "Theme mode"}
    >
      {!mounted ? <Moon className="w-5 h-5 text-indigo-600" /> : resolvedTheme === "dark" ? (
        <Sun className="w-5 h-5 text-amber-400" />
      ) : (
        <Moon className="w-5 h-5 text-indigo-600" />
      )}
      <span className="hidden sm:inline text-xs font-bold">{mounted && resolvedTheme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
