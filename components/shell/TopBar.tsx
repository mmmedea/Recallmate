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
  const { setMobileNavOpen } = useAppStore();
  const pathname = usePathname();
  const allRoutes = [...navigationConfig.main, ...navigationConfig.footer];
  const currentRoute = allRoutes.find((route) => route.href === pathname || (route.href !== "/dashboard" && pathname.startsWith(route.href + "/")));
  const pageTitle = currentRoute?.label ?? "RecallMate";

  return (
    <header className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between border-b border-[#c4b5fd]/10 bg-[#171321]/85 px-3 backdrop-blur-2xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl text-white/75 hover:bg-[#a78bfa]/10 hover:text-white md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open mobile navigation">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-fredoka text-base font-semibold tracking-tight text-white sm:text-lg">{pageTitle}</h1>
        </div>
      </div>
      <AccountMenu user={user} />
    </header>
  );
}
