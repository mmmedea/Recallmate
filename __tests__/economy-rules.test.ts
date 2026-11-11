import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DAILY_STREAK_REWARDS,
  ECONOMY_HEART_CAP,
  HEART_SHOP,
  NEW_USER_COIN_GRANT,
  PREMIUM_ACTIVATION_COIN_GRANT,
  STREAK_RESTORE_COST_COINS,
  getPhilippinesStudyDay,
  getReviewerCoinCost,
  getReviewerCoinCostForDocuments,
  getRewardForStreak,
} from "@/lib/economy/rules";

describe("RecallMate economy rules", () => {
  it("locks the approved daily reward cycle", () => {
    expect(DAILY_STREAK_REWARDS).toEqual([
      { day: 1, hearts: 3, coins: 0 },
      { day: 2, hearts: 0, coins: 500 },
      { day: 3, hearts: 5, coins: 0 },
      { day: 4, hearts: 0, coins: 1000 },
      { day: 5, hearts: 5, coins: 500 },
      { day: 6, hearts: 6, coins: 0 },
      { day: 7, hearts: 0, coins: 2000 },
    ]);
    expect(getRewardForStreak(8)).toEqual({ day: 1, hearts: 3, coins: 0 });
  });

  it("calculates the study day with an 8 AM Philippines reset", () => {
    expect(getPhilippinesStudyDay(new Date("2026-09-09T23:59:00+08:00"))).toBe("2026-09-09");
    expect(getPhilippinesStudyDay(new Date("2026-09-10T07:59:00+08:00"))).toBe("2026-09-09");
    expect(getPhilippinesStudyDay(new Date("2026-09-10T08:00:00+08:00"))).toBe("2026-09-10");
  });

  it("keeps the approved grants and heart shop prices", () => {
    expect(ECONOMY_HEART_CAP).toBe(15);
    expect(NEW_USER_COIN_GRANT).toBe(1000);
    expect(PREMIUM_ACTIVATION_COIN_GRANT).toBe(5000);
    expect(STREAK_RESTORE_COST_COINS).toBe(200);
    expect(HEART_SHOP.addFive).toEqual({ hearts: 5, coins: 200 });
    expect(HEART_SHOP.refillToCap).toEqual({ hearts: 15, coins: 500 });
  });

  it("prices Reviewer Maker by trusted total source-file size", () => {
    const mb = 1024 * 1024;

    expect(getReviewerCoinCost(5 * mb)).toBe(500);
    expect(getReviewerCoinCost(5 * mb + 1)).toBe(650);
    expect(getReviewerCoinCost(15 * mb + 1)).toBe(800);
    expect(getReviewerCoinCost(30 * mb + 1)).toBe(1000);
    expect(() => getReviewerCoinCost(50 * mb + 1)).toThrow(/50MB/i);
    expect(getReviewerCoinCostForDocuments([2 * mb, 4 * mb])).toBe(650);
  });

  it("keeps production economy hardening in the migration contract", () => {
    const migration = readFileSync("supabase/migrations/20260909093000_harden_economy_acceptance_edges.sql", "utf8");

    expect(migration).toContain("Heart refill is only available below the 15-heart cap");
    expect(migration).toContain("metadata->>'reservationKey' = p_reservation_key");
    expect(migration).toContain("grant_premium_bonus_from_entitlement_trigger");
    expect(migration).toContain("after insert or update of tier on public.user_entitlements");
  });
});
