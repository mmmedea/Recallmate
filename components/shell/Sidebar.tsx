"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, PanelLeftClose, PanelLeftOpen, MessageCircle } from "lucide-react";
import { navigationConfig } from "@/lib/navigation";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { isSidebarOpen, toggleSidebar, setChatDrawerOpen } = useAppStore();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 transition-all duration-300 relative",
        isSidebarOpen ? "w-64" : "w-20"
      )}
    >
      <div className="flex h-14 items-center border-b border-slate-200 dark:border-slate-800 px-4 justify-between">
        <Link 
          href="/" 
          className={cn("flex items-center gap-2 font-extrabold text-slate-900 dark:text-white transition-opacity", !isSidebarOpen && "opacity-0 hidden")}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          RecallMate
        </Link>
        {!isSidebarOpen && (
          <Link href="/" className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
        {navigationConfig.main.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive 
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-50",
                !isSidebarOpen && "justify-center px-0"
              )}
              title={!isSidebarOpen ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {isSidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}

        <div className="mt-auto flex flex-col gap-1 pt-4">
          <button
            onClick={() => setChatDrawerOpen(true)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40",
              !isSidebarOpen && "justify-center px-0"
            )}
            title={!isSidebarOpen ? "Ask Medea" : undefined}
          >
            <MessageCircle className="h-5 w-5 shrink-0" />
            {isSidebarOpen && <span>Ask Medea</span>}
          </button>
          {navigationConfig.footer.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive 
                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-50",
                  !isSidebarOpen && "justify-center px-0"
                )}
                title={!isSidebarOpen ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isSidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
        <button
          onClick={toggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={isSidebarOpen}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
