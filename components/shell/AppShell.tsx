"use client";

import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import type { AppBootstrap } from "@/lib/types/auth";
import { useAppStore } from "@/lib/store";
import { MedeaLauncher } from "@/components/medea/MedeaLauncher";

export function AppShell({
  children,
  bootstrap,
}: {
  children: ReactNode;
  bootstrap: AppBootstrap;
}) {
  const setPremium = useAppStore((state) => state.setPremium);

  useEffect(() => {
    setPremium(bootstrap.entitlements.premium);
  }, [bootstrap.entitlements.premium, setPremium]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <Suspense fallback={null}><LegacyMedeaRequest /></Suspense>
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0">
        <TopBar user={bootstrap.user} credits={bootstrap.credits} economy={bootstrap.economy} isPremium={bootstrap.entitlements.premium} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0 relative">
          <div className="rm-page-enter mx-auto max-w-6xl px-4 py-6 md:p-8">
            {children}
          </div>
        </main>

        <MobileNav />
        <MedeaLauncher
          source="mobile-fab"
          className="rm-motion-press fixed bottom-20 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-black text-white shadow-2xl shadow-violet-500/30 ring-1 ring-white/20 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/40 md:hidden"
          aria-label="Open Medea AI"
        >
          <span className="relative grid h-6 w-6 place-items-center rounded-full bg-white/15">
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-violet-600" />
            <Sparkles className="h-4 w-4" />
          </span>
          Medea
        </MedeaLauncher>
      </div>
    </div>
  );
}

function LegacyMedeaRequest() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const router = useRouter();
  const openMedea = useAppStore(state => state.openMedea);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(query);
    if (params.get('medea') !== '1') {
      handled.current = null;
      return;
    }
    const key = `${pathname}?${query}`;
    if (handled.current === key) return;
    handled.current = key;
    openMedea({ source: 'legacy' });
    params.delete('medea');
    const remaining = params.toString();
    router.replace(`${pathname}${remaining ? `?${remaining}` : ''}${window.location.hash}`, { scroll: false });
  }, [pathname, query, router, openMedea]);

  return null;
}
