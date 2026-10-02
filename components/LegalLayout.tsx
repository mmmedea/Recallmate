import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import { Footer } from "@/components/Footer";
export { LegalSection } from "@/components/legal/LegalSection";

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6 md:py-16">
        <h1 className="text-3xl font-black sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated: {updated}</p>
        <div className="mt-10 space-y-10 leading-relaxed text-slate-700 dark:text-slate-300">
          {children}
          <p className="border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            This document is general information, not legal advice. Please have it reviewed by a qualified lawyer for your specific circumstances.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
