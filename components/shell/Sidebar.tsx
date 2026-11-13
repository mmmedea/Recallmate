"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationConfig } from "@/lib/navigation";
import { useAppStore } from "@/lib/store";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const LOGO_URL = "https://lh3.googleusercontent.com/d/1VBjuDg72zKakz032deRqbBJp0SYUFDuu=w1200";

export function Sidebar() {
  const pathname = usePathname();
  const { isSidebarOpen, toggleSidebar } = useAppStore();

  return (
    <aside className={cn(
      "hidden md:flex h-full shrink-0 flex-col border-r border-[#c4b5fd]/10 bg-[#15111f]/95 shadow-[12px_0_48px_rgba(8,5,18,.16)] backdrop-blur-2xl transition-[width] duration-300",
      isSidebarOpen ? "w-64" : "w-[5.25rem]"
    )}>
      <div className={cn("flex h-[4.5rem] shrink-0 items-center border-b border-white/[0.07] px-3", isSidebarOpen ? "gap-2" : "justify-center")}>
        <Link href="/dashboard" aria-label="RecallMate dashboard" className="flex min-w-0 items-center gap-2.5">
          <img src={LOGO_URL} alt="RecallMate logo" width="38" height="38" loading="eager" className="h-[38px] w-[38px] shrink-0 rounded-xl object-contain" />
          {isSidebarOpen && <span className="truncate font-fredoka text-[1.35rem] font-semibold tracking-tight text-white">Recall<span className="text-[#c4b5fd]">Mate</span></span>}
        </Link>
        <button type="button" onClick={toggleSidebar} aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"} aria-expanded={isSidebarOpen}
          className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/55 transition hover:bg-[#a78bfa]/15 hover:text-[#e5d8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b5fd]", isSidebarOpen ? "ml-auto" : "absolute right-2 top-[4.9rem] hidden")}>
          <Menu className="h-[19px] w-[19px]" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
        <p className={cn("mb-2 px-3 font-pixelify text-[9px] uppercase tracking-[0.22em] text-white/30", !isSidebarOpen && "text-center")}>{isSidebarOpen ? "WORKSPACE" : "MENU"}</p>
        {navigationConfig.main.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={!isSidebarOpen ? item.label : undefined}
              className={cn("group flex items-center gap-3 rounded-xl px-3 py-3 font-nunito text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b5fd]", active ? "border border-[#a78bfa]/25 bg-gradient-to-r from-[#a78bfa]/15 to-[#f43f5e]/[0.07] text-[#e8dcff] shadow-[inset_2px_0_0_#c4b5fd]" : "border border-transparent text-white/55 hover:bg-white/[0.05] hover:text-white", !isSidebarOpen && "justify-center px-2")}>
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-pixelify text-[10px]", active ? "bg-[#a78bfa]/20 text-[#e5d8ff]" : "bg-white/[0.05] text-white/35 group-hover:text-white/70")}>{item.symbol}</span>
              {isSidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col gap-1 pt-6">
          {navigationConfig.footer.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={!isSidebarOpen ? item.label : undefined}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-3 font-nunito text-sm font-bold transition", active ? "bg-white/[0.08] text-white" : "text-white/45 hover:bg-white/[0.05] hover:text-white", !isSidebarOpen && "justify-center px-2")}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] font-pixelify text-[10px] text-white/45">{item.symbol}</span>
              {isSidebarOpen && <span>{item.label}</span>}
            </Link>;
          })}
        </div>
      </nav>
    </aside>
  );
}
