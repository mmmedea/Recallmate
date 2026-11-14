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
    <div className="recallmate-shell flex h-screen overflow-hidden bg-[#08070d] transition-colors duration-200">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0">
        <TopBar user={bootstrap.user} credits={bootstrap.credits} />

        {/* Main Content Area */}
        <main className="recallmate-main relative flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>

        <MobileNav />
      </div>
    </div>
  );
}
