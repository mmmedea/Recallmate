"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationConfig } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const items = [...navigationConfig.main, ...navigationConfig.footer].filter(item => item.mobileVisible);
  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-white/10 bg-[#0b0a11]/95 pb-safe backdrop-blur-xl md:hidden">
      {items.map(item => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 font-nunito text-[9px] font-bold transition", active ? "text-[#d8c7ff]" : "text-white/40")}>
            <span className={cn("flex h-6 min-w-7 items-center justify-center rounded-lg px-1 font-pixelify text-[9px]", active ? "bg-[#a78bfa]/20 text-[#d8c7ff]" : "bg-white/[0.04]")}>{item.symbol}</span>
            <span className="max-w-full truncate px-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
