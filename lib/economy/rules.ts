export const ECONOMY_HEART_CAP = 15;
export const HEART_REGEN_MINUTES = 30;
export const STREAK_RESTORE_COST_COINS = 200;
export const NEW_USER_COIN_GRANT = 1_000;
export const PREMIUM_ACTIVATION_COIN_GRANT = 5_000;

export const DAILY_STREAK_REWARDS = [
  { day: 1, hearts: 3, coins: 0 },
  { day: 2, hearts: 0, coins: 500 },
  { day: 3, hearts: 5, coins: 0 },
  { day: 4, hearts: 0, coins: 1_000 },
  { day: 5, hearts: 5, coins: 500 },
  { day: 6, hearts: 6, coins: 0 },
  { day: 7, hearts: 0, coins: 2_000 },
] as const;

export const HEART_SHOP = {
  addFive: { hearts: 5, coins: 200 },
  refillToCap: { hearts: ECONOMY_HEART_CAP, coins: 500 },
} as const;

export type DailyReward = (typeof DAILY_STREAK_REWARDS)[number];

export function getPhilippinesStudyDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const hour = Number(values.hour);
  const studyDayUtc = Date.UTC(year, month - 1, day) - (hour < 8 ? 24 * 60 * 60 * 1000 : 0);
  return new Date(studyDayUtc).toISOString().slice(0, 10);
}

export function getRewardForStreak(streakCount: number): DailyReward {
  const day = (((Math.max(1, streakCount) - 1) % 7) + 1) as DailyReward["day"];
  return DAILY_STREAK_REWARDS[day - 1];
}

export function getReviewerCoinCost(fileSizeBytes: number): number {
  const sizeInMb = fileSizeBytes / (1024 * 1024);
  if (sizeInMb <= 5) return 500;
  if (sizeInMb <= 15) return 650;
  if (sizeInMb <= 30) return 800;
  if (sizeInMb <= 50) return 1_000;
  throw new Error("Reviewer Maker supports files up to 50MB.");
}

export function getReviewerCoinCostForDocuments(fileSizesBytes: number[]): number {
  if (fileSizesBytes.length === 0) throw new Error("At least one source document is required.");
  const totalBytes = fileSizesBytes.reduce((sum, size) => sum + Math.max(0, size), 0);
  return getReviewerCoinCost(totalBytes);
}
