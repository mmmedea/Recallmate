"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MAX_HEARTS, HEART_REGEN_MINUTES, PREMIUM_PASSWORD } from "./constants";

interface AppState {
  hearts: number;
  lastHeartLostAt: number | null;
  isPremium: boolean;
  loseHeart: () => boolean;
  regenHearts: () => void;
  addHeart: (amount?: number) => void;
  unlockPremium: (password: string) => boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hearts: MAX_HEARTS,
      lastHeartLostAt: null,
      isPremium: false,

      loseHeart: () => {
        const { hearts, isPremium } = get();
        if (isPremium) return true;
        if (hearts <= 0) return false;
        set({ hearts: hearts - 1, lastHeartLostAt: Date.now() });
        return true;
      },

      addHeart: (amount = 1) => {
        const { hearts } = get();
        const newHearts = Math.min(MAX_HEARTS, hearts + amount);
        set({
          hearts: newHearts,
          lastHeartLostAt: newHearts >= MAX_HEARTS ? null : Date.now(),
        });
      },

      regenHearts: () => {
        const { hearts, lastHeartLostAt, isPremium } = get();
        if (isPremium || hearts >= MAX_HEARTS || !lastHeartLostAt) return;
        const minutesPassed = (Date.now() - lastHeartLostAt) / 60000;
        const heartsToRegen = Math.floor(minutesPassed / HEART_REGEN_MINUTES);
        if (heartsToRegen > 0) {
          const newHearts = Math.min(MAX_HEARTS, hearts + heartsToRegen);
          set({
            hearts: newHearts,
            lastHeartLostAt: newHearts >= MAX_HEARTS ? null : Date.now()
          });
        }
      },

      unlockPremium: (password: string) => {
        if (password.trim() === PREMIUM_PASSWORD) {
          set({ isPremium: true, hearts: MAX_HEARTS });
          return true;
        }
        return false;
      }
    }),
    { name: "recallmate-storage" }
  )
);