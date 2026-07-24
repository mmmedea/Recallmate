"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import HeartsDisplay from "./HeartsDisplay";
import PremiumModal from "./PremiumModal";
import { useAppStore } from "@/lib/store";

export default function Navbar() {
  const [premiumOpen, setPremiumOpen] = useState(false);
  const isPremium = useAppStore((s) => s.isPremium);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-gray-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            RecallMate
          </Link>

          <div className="flex items-center gap-3">
            <HeartsDisplay />
            {!isPremium && (
              <button
                onClick={() => setPremiumOpen(true)}
                className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-800"
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