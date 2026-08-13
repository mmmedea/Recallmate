"use client";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import type { AppBootstrap } from "@/lib/types/auth";

export function AppShell({
  children,
  bootstrap,
}: {
  children: React.ReactNode;
  bootstrap: AppBootstrap;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0">
        <TopBar user={bootstrap.user} credits={bootstrap.credits} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0 relative">
          <div className="mx-auto max-w-6xl px-4 py-6 md:p-8">
            {children}
          </div>
        </main>

        <MobileNav />
      </div>
    </div>
  );
}
