import { createClient } from "@/utils/supabase/server";
import type { AppBootstrap } from "@/lib/types/auth";

/**
 * Loads the minimal bootstrap data needed to render the authenticated shell.
 * Scope is intentionally narrow: identity + credits + entitlements only.
 * Documents, notes, and quiz data belong to the features that own them.
 */
export async function getUserBootstrap(userId: string): Promise<AppBootstrap> {
  const supabase = await createClient();

  // Fetch user profile and credits in parallel
  const [creditsResult, profileResult] = await Promise.all([
    supabase
      .from("user_credits")
      .select("credits_remaining, is_premium")
      .eq("user_id", userId)
      .single(),
    supabase.auth.getUser(),
  ]);

  const credits = creditsResult.data?.credits_remaining ?? 0;
  const isPremium = creditsResult.data?.is_premium ?? false;

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
  };
}
