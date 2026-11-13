"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Flame, Heart } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type WalletState = { coins: number; hearts: number; current_streak: number };

export default function EconomyWallet() {
  const [wallet, setWallet] = useState<WalletState | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/economy/state", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = await response.json();
      setWallet({
        coins: result.account.coins,
        hearts: result.account.hearts,
        current_streak: result.account.current_streak,
      });
    } catch {
      // Keep the header stable if the economy endpoint is temporarily unavailable.
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2" aria-label="Study wallet">
      <span title="Hearts" className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-300">
        <Heart className="h-3.5 w-3.5 fill-current" />{wallet?.hearts ?? "—"}
      </span>
      <span title="Coins" className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300">
        <Coins className="h-3.5 w-3.5" />{wallet ? wallet.coins.toLocaleString() : "—"}
      </span>
      <span title="Current study streak" className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/50 dark:text-orange-300">
        <Flame className="h-3.5 w-3.5" />{wallet?.current_streak ?? "—"}
      </span>
    </div>
  );
}
