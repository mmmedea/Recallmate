"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Flame, Heart } from "lucide-react";

type WalletState = { coins: number; hearts: number; current_streak: number };

export default function EconomyWallet() {
  const [wallet, setWallet] = useState<WalletState | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/economy/state", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = await response.json();
      if (!result?.account) return;
      setWallet({
        coins: Number(result.account.coins ?? 0),
        hearts: Number(result.account.hearts ?? 0),
        current_streak: Number(result.account.current_streak ?? 0),
      });
    } catch {
      // Keep the header stable if the economy endpoint is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2" aria-label="Study wallet" aria-live="polite">
      <span title="Hearts" className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-300">
        <Heart className="h-3.5 w-3.5 fill-current motion-safe:animate-pulse" />{wallet?.hearts ?? "…"}
      </span>
      <span title="Coins" className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300">
        <Coins className="h-3.5 w-3.5" />{wallet ? wallet.coins.toLocaleString() : "…"}
      </span>
      <span title="Current study streak" className="group relative inline-flex items-center gap-1 rounded-full border border-orange-300 bg-gradient-to-r from-orange-50 to-amber-100 px-2 py-1 text-xs font-extrabold text-orange-800 shadow-sm dark:border-orange-800 dark:from-orange-950/70 dark:to-amber-950/60 dark:text-orange-200">
        <Flame className="h-3.5 w-3.5 fill-orange-500 text-orange-600 motion-safe:animate-[streak-flame_1.5s_ease-in-out_infinite] dark:text-orange-300" />
        <span>{wallet?.current_streak ?? "…"}</span>
        {wallet && wallet.current_streak > 0 && <span className="pointer-events-none absolute -inset-0.5 -z-10 rounded-full bg-orange-400/20 blur-sm motion-safe:animate-pulse" />}
      </span>
    </div>
  );
}
