"use client";

import { useEffect, useState } from "react";
import { Heart, Plus, Crown } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { MAX_HEARTS, HEART_REGEN_MINUTES } from "@/lib/constants";
import FeynmanRechargeModal from "./FeynmanRechargeModal";

export default function HeartsDisplay() {
  const { hearts, isPremium, lastHeartLostAt, regenHearts } = useAppStore();
  const [, forceRender] = useState(0);
  const [feynmanOpen, setFeynmanOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      regenHearts();
      forceRender((n) => n + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [regenHearts]);

  const nextHeartIn = () => {
    if (!lastHeartLostAt || hearts >= MAX_HEARTS) return null;
    const cycleMs = HEART_REGEN_MINUTES * 60000;
    const elapsedMs = Date.now() - lastHeartLostAt;
    const remainingMs = cycleMs - (elapsedMs % cycleMs);
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isPremium) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-600 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-md border border-amber-300">
        <Crown className="h-4 w-4 fill-slate-950 text-slate-950" />
        <span>Unlimited ♾️</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => hearts < MAX_HEARTS && setFeynmanOpen(true)}
          title={hearts < MAX_HEARTS ? "Click to recharge +1 Heart with Feynman Technique" : `${hearts}/${MAX_HEARTS} Hearts Full`}
          className="flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 px-3 py-1.5 border border-rose-200 dark:border-rose-900/40 hover:scale-105 transition-all cursor-pointer"
        >
          <Heart className="h-4 w-4 fill-rose-500 text-rose-500 animate-pulse" />
          <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
            {hearts}/{MAX_HEARTS}
          </span>
          {hearts < MAX_HEARTS && (
            <Plus className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400 ml-0.5" />
          )}
        </button>

        {nextHeartIn() && (
          <span className="hidden text-xs text-slate-400 dark:text-slate-500 sm:inline">
            next in {nextHeartIn()}
          </span>
        )}
      </div>

      <FeynmanRechargeModal
        open={feynmanOpen}
        onClose={() => setFeynmanOpen(false)}
      />
    </>
  );
}