import { createClient } from "@/utils/supabase/server";
import type { AppBootstrap } from "@/lib/types/auth";
import { getEconomySnapshot } from "@/lib/economy/server";

/**
 * Loads the minimal bootstrap data needed to render the authenticated shell.
 * Scope is intentionally narrow: identity + credits + entitlements only.
 * Documents, notes, and quiz data belong to the features that own them.
 */
export async function getUserBootstrap(userId: string): Promise<AppBootstrap> {
  const supabase = await createClient();

  // Fetch user profile and credits in parallel
  const [entitlementsResult, profileResult, economy] = await Promise.all([
    supabase
      .from("user_entitlements")
      .select("credits_remaining, tier")
      .eq("user_id", userId)
      .single(),
    supabase.auth.getUser(),
    getEconomySnapshot(userId),
  ]);

  const credits = entitlementsResult.data?.credits_remaining ?? 0;
  const tier = entitlementsResult.data?.tier ?? "free";
  const isPremium = tier === "premium" || tier === "pro";

  const email = profileResult.data?.user?.email ?? null;

  return {
    user: {
      id: userId,
      email,
    },
    entitlements: {
      premium: isPremium,
      canChat: isPremium || credits > 0,
      canGenerateNotes: isPremium || credits > 0,
      canGenerateQuiz: isPremium || credits > 0,
    },
    credits: {
      available: credits,
    },
    economy: {
      coins: economy.coins,
      hearts: economy.hearts,
      heartCap: economy.heartCap,
      streak: economy.streak,
      longestStreak: economy.longestStreak,
      canRestoreStreak: economy.canRestoreStreak,
      canClaimDailyReward: economy.canClaimDailyReward,
      restoreCostCoins: economy.restoreCostCoins,
      lastClaimedDay: economy.lastClaimedDay,
      studyDay: economy.studyDay,
      state: economy.state,
    },
  };
}
