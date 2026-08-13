"use client";

import { create } from "zustand";
import { persist, StateStorage, createJSONStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";
import { MAX_HEARTS, HEART_REGEN_MINUTES } from "./constants";
import type { OTPState, OTPFlowContext } from "./types/auth";

// Re-export for convenience
export type { OTPState, OTPFlowContext } from "./types/auth";

export interface ChatContextItem {
  id: string;
  source_type: "document" | "image" | "youtube_link" | "audio";
  source_name: string;
  extracted_text: string;
  summary?: string;
  timestamp: number;
}

interface AppState {
  // ==========================================
  // CLIENT STATE (Authoritative in Zustand)
  // ==========================================
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
  isMobileNavOpen: boolean;
  setMobileNavOpen: (isOpen: boolean) => void;
  chatDrawerOpen: boolean;
  setChatDrawerOpen: (isOpen: boolean) => void;

  // OTP UI State moved to useOTPStore

  activeChatContext: ChatContextItem[];
  addChatContext: (item: Omit<ChatContextItem, "id" | "timestamp">) => void;
  clearChatContext: () => void;

  // ==========================================
  // DEPRECATED: SERVER STATE (To be removed in 6.x)
  // ==========================================
  // These properties belong to the backend. They remain here temporarily
  // to ensure Phase 5 functionality is untouched during the 6.1 Foundation.
  hearts: number;
  lastHeartLostAt: number | null;
  isPremium: boolean;
  loseHeart: () => boolean;
  regenHearts: () => void;
  addHeart: (amount?: number) => void;
  unlockPremium: (password: string) => Promise<boolean>;
}

// Custom IndexedDB Storage for Zustand
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // CLIENT STATE
      isSidebarOpen: true,
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      isMobileNavOpen: false,
      setMobileNavOpen: (isOpen) => set({ isMobileNavOpen: isOpen }),
      chatDrawerOpen: false,
      setChatDrawerOpen: (isOpen) => set({ chatDrawerOpen: isOpen }),
      activeChatContext: [],

      // DEPRECATED SERVER STATE
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

      unlockPremium: async (password: string) => {
        try {
          const res = await fetch("/api/premium/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            set({ isPremium: true, hearts: MAX_HEARTS });
            return true;
          }
          return false;
        } catch (e) {
          console.error(e);
          return false;
        }
      },

      addChatContext: (item) => {
        const newItem: ChatContextItem = {
          ...item,
          id: Date.now().toString(),
          timestamp: Date.now(),
        };
        set((state) => ({
          activeChatContext: [...state.activeChatContext, newItem],
        }));
      },

      clearChatContext: () => {
        set({ activeChatContext: [] });
      },
    }),
    {
      name: "recallmate-storage",
      storage: createJSONStorage(() => idbStorage),
    }
  )
);

interface OTPStoreState {
  otpState: OTPState;
  setOTPState: (state: OTPState) => void;
  otpFlowContext: OTPFlowContext | null;
  setOTPFlowContext: (ctx: OTPFlowContext | null) => void;
}

export const useOTPStore = create<OTPStoreState>()(
  persist(
    (set) => ({
      otpState: "idle",
      setOTPState: (state) => set({ otpState: state }),
      otpFlowContext: null,
      setOTPFlowContext: (ctx) => set({ otpFlowContext: ctx }),
    }),
    {
      name: "recallmate-otp-storage",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

// Setup persistent heart regeneration on window focus
if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    useAppStore.getState().regenHearts();
  });
}