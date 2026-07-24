"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { MAX_HEARTS, HEART_REGEN_MINUTES } from "@/lib/constants";

export default function HeartsDisplay() {
  const { hearts, isPremium, lastHeartLostAt, regenHearts } = useAppStore();
  const [, forceRender] = useState(0);

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
      <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm">
        <Heart className="h-4 w-4 fill-white" />
        <span>Unlimited</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5">
        <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
        <span className="text-sm font-semibold text-rose-600">
          {hearts}/{MAX_HEARTS}
        </span>
      </div>
      {nextHeartIn() && (
        <span className="hidden text-xs text-gray-400 sm:inline">next in {nextHeartIn()}</span>
      )}
    </div>
  );
}