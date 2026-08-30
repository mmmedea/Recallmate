"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./AccountMenu";
import { NotificationBell } from "./NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { navigationConfig } from "@/lib/navigation";
import type { AuthenticatedUser } from "@/lib/types/auth";
import HeartsDisplay from "@/components/HeartsDisplay";

interface TopBarProps {
  user: AuthenticatedUser;
  credits: { available: number };
}

export function TopBar({ user }: TopBarProps) {
  const { setMobileNavOpen } = useAppStore();
  const pathname = usePathname();

  const allRoutes = [...navigationConfig.main, ...navigationConfig.footer];
  const currentRoute = allRoutes.find((r) => r.href === pathname);
  const pageTitle = currentRoute ? currentRoute.label : "RecallMate";

  return (
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
        <h1 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <HeartsDisplay />
        <NotificationBell />
        <ThemeToggle />
        <AccountMenu user={user} />
      </div>
    </header>
  );
}
