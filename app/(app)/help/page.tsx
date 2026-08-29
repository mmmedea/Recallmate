"use client";

import { useMemo, useState } from "react";
import { BookOpen, LifeBuoy, Search, ShieldCheck, SlidersHorizontal, Sparkles, Workflow } from "lucide-react";

const articles = [
  { category: "Account & profile", title: "Identity, email and profile management", body: "Manage your username, profile, sign-in email, notification email, password, and account ownership from Settings. Sensitive changes require fresh verification." },
  { category: "Preferences & accessibility", title: "Appearance and accessible navigation", body: "RecallMate supports light and dark themes, keyboard navigation, readable contrast, responsive layouts, and reduced-motion system preferences." },
  { category: "Security", title: "Sessions and sensitive actions", body: "Password, email, and account deletion actions use reauthentication-aware flows. Never share verification codes or passwords with anyone." },
  { category: "Study planner", title: "Notes, reminders and calendar sync", body: "Create color-coded notes and reminders, label important or urgent work, move between years, add a single event to Google Calendar, or export the full year as an ICS file." },
  { category: "Workspace & integrations", title: "Connected services", body: "Use explicit OAuth consent for connected services. RecallMate only requests access needed for the feature you choose and never asks you to paste private access tokens into study content." },
  { category: "Medea AI", title: "Getting help from Medea", body: "Ask Medea for friendly explanations, math and science reasoning, definitions, study plans, and help with your uploaded materials. Double-check high-stakes answers with a teacher or trusted source." },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => articles.filter((article) => `${article.category} ${article.title} ${article.body}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 motion-safe:animate-in motion-safe:fade-in duration-500">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 text-white shadow-xl">
      <div className="max-w-3xl"><p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-indigo-100"><Sparkles className="h-4 w-4" />RecallMate Help Center</p><h1 className="mt-3 text-4xl font-black">How can we help you study smarter?</h1><p className="mt-3 text-indigo-100">Search product guides, security information, accessibility help, and study workflows.</p></div>
      <label className="mt-6 flex max-w-2xl items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-slate-900 shadow-lg"><Search className="h-5 w-5 text-indigo-600" /><span className="sr-only">Search help</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search settings, reminders, Medea, security…" className="w-full bg-transparent outline-none" /></label>
    </section>
    <section aria-live="polite" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{results.map((article, index) => {
      const Icon = [BookOpen, SlidersHorizontal, ShieldCheck, Workflow, LifeBuoy, Sparkles][index % 6];
      return <article key={article.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"><Icon className="h-6 w-6 text-indigo-500" /><p className="mt-4 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{article.category}</p><h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{article.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{article.body}</p></article>
    })}</section>
    {results.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">No guide matched that search. Ask Medea from the sidebar or try a broader phrase.</p>}
    <section className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20"><h2 className="font-bold text-emerald-900 dark:text-emerald-200">Accessible by design</h2><p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">Help and core study workflows are keyboard accessible and designed for readable contrast. RecallMate follows your device's reduced-motion preference.</p></div><div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-900 dark:bg-violet-950/20"><h2 className="font-bold text-violet-900 dark:text-violet-200">Support escalation</h2><p className="mt-2 text-sm text-violet-800 dark:text-violet-300">Start with Medea and these guides. For account or privacy issues, use the support contact configured by your RecallMate administrator. Never include passwords or verification codes.</p></div></section>
  </main>;
}
