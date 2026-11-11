"use client";

import { useState } from "react";
import Link from "next/link";
import PremiumModal from "./PremiumModal";
import ThemeToggle from "./ThemeToggle";
import { RecallMateBrandLogo } from "@/components/brand/RecallMateLogo";
import { useAppStore } from "@/lib/store";

export default function Navbar() {
  const [premiumOpen, setPremiumOpen] = useState(false);
  const isPremium = useAppStore((s) => s.isPremium);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-gray-900 dark:text-white">
            <RecallMateBrandLogo size="sm" animated={false} showWordmark />
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Sign in
            </Link>
            {!isPremium && (
              <button
                type="button"
                onClick={() => setPremiumOpen(true)}
                className="rounded-full bg-gray-900 dark:bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-800 dark:hover:bg-indigo-500 transition-colors"
              >
                Go Premium
              </button>
            )}
          </div>
        </div>
      </header>
      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </>
  );
}
