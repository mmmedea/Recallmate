"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiamondLoader } from "@/components/DiamondLoader";
import { useToast } from "@/hooks/use-toast";

export function DailyRewardActions({ canRestore, restoreCostCoins, onSuccess }: { canRestore: boolean; restoreCostCoins: number; onSuccess?: (payload: any) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const endpoint = canRestore ? "/api/economy/restore-streak" : "/api/economy/daily-reward";
  const label = canRestore ? `Restore for ${restoreCostCoins} coins` : "Claim reward";

  async function submit() {
    if (isPending) return;
    setIsPending(true);
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `dashboard-reward:${crypto.randomUUID()}`
          : `dashboard-reward:${Date.now()}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast({
          title: canRestore ? "Could not restore streak" : "Could not claim reward",
          description: typeof payload?.error === "string" ? payload.error : "Try again in a moment.",
          variant: "destructive",
        });
        return;
      }

      onSuccess?.(payload);
      toast({
        title: canRestore ? "Streak restored" : "Reward claimed",
        description: "Your dashboard balance has been refreshed.",
        variant: "success",
      });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={submit}
      disabled={isPending}
      className="min-h-11 rounded-2xl bg-violet-600 px-5 font-black text-white shadow-lg shadow-violet-500/20 hover:bg-violet-700"
    >
      {isPending ? (
        <>
          <DiamondLoader variant="inline" label={canRestore ? "Restoring streak" : "Claiming daily reward"} />
          {canRestore ? "Restoring…" : "Claiming…"}
        </>
      ) : (
        <>
          <Flame className="h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  );
}
