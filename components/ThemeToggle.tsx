"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <button type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-white/75 transition hover:scale-105 hover:border-[#c4b5fd]/30 hover:bg-white/[0.08]"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`} title={`Switch to ${isDark ? "light" : "dark"} mode`}>
      <span aria-hidden="true" className="font-fredoka text-xl leading-none text-[#fbbf24]">{isDark ? "☼" : "◐"}</span>
      <span className="hidden font-nunito text-xs font-extrabold sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
