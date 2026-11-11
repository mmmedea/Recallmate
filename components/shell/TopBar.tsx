"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Coins, Flame, Heart, Menu, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./AccountMenu";
import { NotificationBell } from "./NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { navigationConfig } from "@/lib/navigation";
import type { AuthenticatedUser } from "@/lib/types/auth";
import PremiumModal from "@/components/PremiumModal";
import { RecallMateBrandLogo } from "@/components/brand/RecallMateLogo";
import { MedeaLauncher } from "@/components/medea/MedeaLauncher";

interface TopBarProps {
  user: AuthenticatedUser;
  credits: { available: number };
  economy?: {
    coins: number;
    hearts: number;
    heartCap: number;
    streak: number;
    state: "ok" | "unavailable";
  };
  isPremium?: boolean;
}

export function TopBar({ user, economy, isPremium: serverPremium = false }: TopBarProps) {
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [liveEconomy, setLiveEconomy] = useState(economy);
  const { setMobileNavOpen, isPremium: localPremium } = useAppStore();
  const pathname = usePathname();

  useEffect(() => {
    setLiveEconomy(economy);
  }, [economy]);

  useEffect(() => {
    const handleEconomyUpdate = (event: Event) => {
      const detail = (event as CustomEvent<Partial<NonNullable<TopBarProps["economy"]>>>).detail;
      if (!detail || typeof detail !== "object") return;
      setLiveEconomy((current) => current ? { ...current, ...detail } : current);
    };
    window.addEventListener("recallmate:economy-updated", handleEconomyUpdate);
    return () => window.removeEventListener("recallmate:economy-updated", handleEconomyUpdate);
  }, []);

  const allRoutes = [...navigationConfig.main, ...navigationConfig.footer];
  const currentRoute = allRoutes.find((r) => r.href === pathname);
  const pageTitle = currentRoute ? currentRoute.label : "RecallMate";
  const isPremium = serverPremium || localPremium;
  const economyAvailable = liveEconomy?.state === "ok";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 backdrop-blur-md transition-colors duration-300">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open mobile navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <RecallMateBrandLogo size="sm" animated={false} className="md:hidden" />
          <h1 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            {pageTitle}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <MedeaLauncher
            source="topbar"
            className="hidden items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200 sm:inline-flex"
            aria-label="Open Medea AI"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Medea
          </MedeaLauncher>
          <div className="flex items-center gap-1 sm:gap-2" aria-label="Account economy">
            <EconomyPill href="/settings#heart-shop" icon={<Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />} label="Hearts" value={economyAvailable && liveEconomy ? `${liveEconomy.hearts}/${liveEconomy.heartCap}` : "—"} muted={!economyAvailable} />
            <EconomyPill href="/settings#wallet" icon={<Coins className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />} label="Coins" value={economyAvailable && liveEconomy ? liveEconomy.coins.toLocaleString() : "—"} compactValue={economyAvailable && liveEconomy ? compactNumber(liveEconomy.coins) : "—"} muted={!economyAvailable} />
            <EconomyPill href="/dashboard?streak=1" icon={<Flame className="h-3.5 w-3.5 fill-orange-500 text-orange-500 drop-shadow-[0_0_4px_rgba(249,115,22,0.55)]" />} label="Streak" value={economyAvailable && liveEconomy ? `${liveEconomy.streak}` : "—"} muted={!economyAvailable} />
          </div>
          {!isPremium && (
            <button
              type="button"
              onClick={() => setPremiumOpen(true)}
              className="hidden rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 sm:inline-flex"
            >
              Go Premium
            </button>
          )}
          <NotificationBell />
          <ThemeToggle />
          <AccountMenu user={user} />
        </div>
      </header>
      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </>
  );
}

function EconomyPill({ label, value, compactValue, icon, href, muted = false }: { label: string; value: string; compactValue?: string; icon: ReactNode; href: string; muted?: boolean }) {
  const content = (
    <span
      className={`inline-flex min-h-8 items-center gap-1 rounded-full border bg-white px-2 text-xs font-black shadow-sm transition hover:border-violet-300 hover:text-violet-700 dark:bg-white/10 dark:hover:text-violet-200 sm:gap-1.5 sm:px-2.5 ${
        muted
          ? "border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400"
          : "border-violet-200 text-slate-800 dark:border-violet-400/20 dark:text-white"
      }`}
      title={`${label}: ${value}`}
    >
      <span aria-hidden="true" className={muted ? "grayscale opacity-60" : ""}>{icon}</span>
      <span className="hidden sm:inline">{value}</span>
      <span className="sm:hidden">{compactValue ?? value}</span>
    </span>
  );

  return (
    <Link href={href} aria-label={`${label}: ${value}`}>
      {content}
    </Link>
  );
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${Math.floor(value / 100_000) / 10}M`;
  if (value >= 1_000) return `${Math.floor(value / 100) / 10}K`;
  return value.toLocaleString();
}
