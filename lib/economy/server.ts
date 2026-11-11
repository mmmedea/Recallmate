import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { ECONOMY_HEART_CAP, getPhilippinesStudyDay, getReviewerCoinCostForDocuments } from "@/lib/economy/rules";

export type EconomySnapshot = {
  coins: number;
  hearts: number;
  heartCap: number;
  streak: number;
  longestStreak: number;
  canRestoreStreak: boolean;
  canClaimDailyReward: boolean;
  restoreCostCoins: number;
  lastClaimedDay: string | null;
  studyDay: string | null;
  state: "ok" | "unavailable";
};

export const ECONOMY_FALLBACK: EconomySnapshot = {
  coins: 0,
  hearts: ECONOMY_HEART_CAP,
  heartCap: ECONOMY_HEART_CAP,
  streak: 0,
  longestStreak: 0,
  canRestoreStreak: false,
  canClaimDailyReward: false,
  restoreCostCoins: 200,
  lastClaimedDay: null,
  studyDay: null,
  state: "unavailable",
};

function normalizeDateOnly(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value !== "string") return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function normalizeEconomyRow(row: any): EconomySnapshot {
  const studyDay = normalizeDateOnly(row?.study_day) ?? getPhilippinesStudyDay();
  const lastClaimedDay = normalizeDateOnly(row?.last_claimed_day);
  const canRestoreStreak = Boolean(row?.restore_available_for);
  return {
    coins: Number(row?.coins ?? 0),
    hearts: Number(row?.hearts ?? ECONOMY_HEART_CAP),
    heartCap: Number(row?.heart_cap ?? ECONOMY_HEART_CAP),
    streak: Number(row?.current_streak ?? 0),
    longestStreak: Number(row?.longest_streak ?? 0),
    canRestoreStreak,
    canClaimDailyReward: !canRestoreStreak && lastClaimedDay !== studyDay,
    restoreCostCoins: Number(row?.restore_cost_coins ?? 200),
    lastClaimedDay,
    studyDay,
    state: "ok",
  };
}

export async function getEconomySnapshot(userId: string): Promise<EconomySnapshot> {
  if (!isSupabaseAdminConfigured()) return ECONOMY_FALLBACK;

  try {
    const admin = createSupabaseAdminClient<any>();

    await admin.rpc("ensure_economy_account", {
      p_user_id: userId,
    });

    const { data, error } = await admin
      .from("economy_accounts")
      .select("coins, hearts, heart_cap, current_streak, longest_streak, last_claimed_day, restore_available_for")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return ECONOMY_FALLBACK;
    return normalizeEconomyRow(data);
  } catch {
    return ECONOMY_FALLBACK;
  }
}

export async function getTrustedDocumentSizesBytes(userId: string, documentIds: string[]) {
  const admin = createSupabaseAdminClient<any>();
  const { data: documents, error } = await admin
    .from("documents")
    .select("id, storage_path")
    .eq("user_id", userId)
    .in("id", documentIds);

  if (error) throw new Error(`Could not verify reviewer source documents: ${error.message}`);
  if (!documents || documents.length !== documentIds.length) throw new Error("One or more reviewer source documents were not found.");

  const sizes = await Promise.all(
    documents.map(async (document: { storage_path: string }) => {
      const pathParts = document.storage_path.split("/");
      const fileName = pathParts.pop();
      const folderPath = pathParts.join("/");
      const { data: files, error: listError } = await admin.storage
        .from("study_materials")
        .list(folderPath, { search: fileName });

      if (listError) throw new Error(`Could not verify source file size: ${listError.message}`);
      const file = files?.find((candidate) => candidate.name === fileName);
      const size = Number(file?.metadata?.size ?? 0);
      if (!Number.isFinite(size) || size <= 0) throw new Error("Could not verify source file size.");
      return size;
    }),
  );

  return sizes;
}

export async function getReviewerCoinCostForUserDocuments(userId: string, documentIds: string[]) {
  const sizes = await getTrustedDocumentSizesBytes(userId, documentIds);
  return getReviewerCoinCostForDocuments(sizes);
}
