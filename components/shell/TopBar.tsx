"use client";

import { usePathname } from "next/navigation";
import { AccountMenu } from "./AccountMenu";
import { NotificationBell } from "./NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { navigationConfig } from "@/lib/navigation";
import type { AuthenticatedUser } from "@/lib/types/auth";

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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#0b0a11]/90 px-4 backdrop-blur-xl transition-colors duration-300">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open mobile navigation"
        >
          <span aria-hidden="true" className="text-lg">☰</span>
        </Button>
        <h1 className="font-fredoka text-sm font-semibold tracking-tight text-white">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />
        <AccountMenu user={user} />
      </div>
    </header>
  );
}
