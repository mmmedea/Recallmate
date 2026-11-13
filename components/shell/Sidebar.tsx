"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationConfig } from "@/lib/navigation";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { isSidebarOpen, toggleSidebar, setChatDrawerOpen } = useAppStore();

  return (
    <aside className={cn("hidden md:flex flex-col border-r border-white/10 bg-[#0b0a11] transition-all duration-300", isSidebarOpen ? "w-64" : "w-20")}>
      <div className="flex h-16 items-center border-b border-white/10 px-4">
        <Link href="/dashboard" aria-label="RecallMate dashboard" className={cn("flex items-center gap-3", !isSidebarOpen && "mx-auto")}>
          <img src="https://lh3.googleusercontent.com/d/1VBjuDg72zKakz032deRqbBJp0SYUFDuu=w1200" alt="RecallMate logo" width="40" height="40" loading="eager" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
          {isSidebarOpen && <span className="font-fredoka text-xl font-semibold tracking-tight text-white">Recall<span className="text-[#c4b5fd]">Mate</span></span>}
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
        <p className={cn("mb-2 px-3 font-pixelify text-[9px] uppercase tracking-[0.22em] text-white/30", !isSidebarOpen && "text-center")}>{isSidebarOpen ? "WORKSPACE" : "MENU"}</p>
        {navigationConfig.main.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={!isSidebarOpen ? item.label : undefined}
              className={cn("group flex items-center gap-3 rounded-xl px-3 py-3 font-nunito text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b5fd]", active ? "border border-[#a78bfa]/25 bg-[#a78bfa]/15 text-[#e0d4ff]" : "border border-transparent text-white/55 hover:bg-white/[0.05] hover:text-white", !isSidebarOpen && "justify-center px-2")}>
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-pixelify text-[10px]", active ? "bg-[#a78bfa]/20 text-[#d9c8ff]" : "bg-white/[0.05] text-white/35 group-hover:text-white/70")}>{item.symbol}</span>
              {isSidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}

        <div className="mt-auto flex flex-col gap-1 pt-6">
          <button onClick={() => setChatDrawerOpen(true)} title={!isSidebarOpen ? "Ask Medea" : undefined}
            className={cn("flex items-center gap-3 rounded-xl border border-[#f43f5e]/20 bg-gradient-to-r from-[#a78bfa]/10 to-[#f43f5e]/10 px-3 py-3 text-left font-nunito text-sm font-extrabold text-[#e2d5ff] transition hover:border-[#c4b5fd]/50 hover:from-[#a78bfa]/20 hover:to-[#f43f5e]/15", !isSidebarOpen && "justify-center px-2")}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f43f5e]/15 font-pixelify text-[10px] text-[#ff9aaa]">AI</span>
            {isSidebarOpen && <span>Ask Medea</span>}
          </button>
          {navigationConfig.footer.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={!isSidebarOpen ? item.label : undefined}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-3 font-nunito text-sm font-bold transition", active ? "bg-white/10 text-white" : "text-white/45 hover:bg-white/[0.05] hover:text-white", !isSidebarOpen && "justify-center px-2")}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] font-pixelify text-[10px] text-white/45">{item.symbol}</span>
              {isSidebarOpen && <span>{item.label}</span>}
            </Link>;
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-3">
        <button onClick={toggleSidebar} aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"} aria-expanded={isSidebarOpen}
          className="flex h-9 w-full items-center justify-center rounded-xl font-nunito text-xs font-bold text-white/45 transition hover:bg-white/[0.06] hover:text-white">
          {isSidebarOpen ? "← Collapse" : "→"}
        </button>
      </div>
    </aside>
  );
}
