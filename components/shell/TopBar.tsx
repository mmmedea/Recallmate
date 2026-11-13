"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./AccountMenu";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { navigationConfig } from "@/lib/navigation";
import type { AuthenticatedUser } from "@/lib/types/auth";

interface TopBarProps {
  user: AuthenticatedUser;
  credits: { available: number };
}

export function TopBar({ user }: TopBarProps) {
  const { toggleSidebar, setMobileNavOpen } = useAppStore();
  const pathname = usePathname();
  const allRoutes = [...navigationConfig.main, ...navigationConfig.footer];
  const currentRoute = allRoutes.find((route) => route.href === pathname || (route.href !== "/dashboard" && pathname.startsWith(route.href + "/")));
  const pageTitle = currentRoute?.label ?? "RecallMate";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.08] bg-[#0b0912]/85 px-3 backdrop-blur-2xl sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" className="hidden rounded-xl text-white/75 hover:bg-[#a78bfa]/10 hover:text-white md:inline-flex" onClick={toggleSidebar} aria-label="Toggle sidebar menu">
          <Menu className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-xl text-white/75 hover:bg-[#a78bfa]/10 hover:text-white md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open mobile navigation">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <p className="hidden font-pixelify text-[9px] uppercase tracking-[0.2em] text-[#ff7185]/80 sm:block">RECALLMATE WORKSPACE</p>
          <h1 className="truncate font-fredoka text-base font-semibold tracking-tight text-white sm:text-lg">{pageTitle}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <AccountMenu user={user} />
      </div>
    </header>
  );
}
