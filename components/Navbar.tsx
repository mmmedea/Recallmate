"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import HeartsDisplay from "./HeartsDisplay";
import PremiumModal from "./PremiumModal";
import ThemeToggle from "./ThemeToggle";
import { useAppStore } from "@/lib/store";

export default function Navbar() {
  const [premiumOpen, setPremiumOpen] = useState(false);
  const isPremium = useAppStore((s) => s.isPremium);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-[#0b1325]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex min-h-[77px] max-w-[1480px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 font-extrabold tracking-tight text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-950/40">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <span className="text-lg">RecallMate</span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-3">
            <HeartsDisplay />
            <ThemeToggle />
            <Link href="/login" className="rounded-full border border-slate-700 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 sm:px-5">
              Sign in
            </Link>
            {!isPremium && (
              <button onClick={() => setPremiumOpen(true)} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-extrabold text-white shadow-lg shadow-indigo-950/30 transition-colors hover:bg-indigo-500">
                Go Premium
              </button>
            )}
          </nav>
        </div>
      </header>
      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </>
  );
}
