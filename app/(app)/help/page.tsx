"use client";

import { useMemo, useState } from "react";
import { BookOpen, LifeBuoy, MessageCircleHeart, Search, Send, ShieldCheck, SlidersHorizontal, TriangleAlert, Workflow, X } from "lucide-react";

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
  const [supportType, setSupportType] = useState<"feedback" | "report" | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [supportStatus, setSupportStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const results = useMemo(() => articles.filter((article) => `${article.category} ${article.title} ${article.body}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const openSupport = (type: "feedback" | "report") => {
    setSupportType(type);
    setSubject("");
    setMessage("");
    setSupportStatus(null);
  };
  const submitSupport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supportType || !subject.trim() || !message.trim()) return;
    setIsSending(true);
    setSupportStatus(null);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: supportType, subject: subject.trim(), message: message.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "We couldn't send your message. Please try again.");
      setSupportStatus({ tone: "success", text: `Your ${supportType} was sent to RecallMate support.` });
      setSubject("");
      setMessage("");
    } catch (error) {
      setSupportStatus({ tone: "error", text: error instanceof Error ? error.message : "We couldn't send your message. Please try again." });
    } finally {
      setIsSending(false);
    }
  };
  return <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 font-nunito text-white motion-safe:animate-in motion-safe:fade-in duration-500">
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-[#a78bfa]/25 bg-[radial-gradient(ellipse_at_90%_5%,rgba(244,63,94,.16),transparent_38%),linear-gradient(130deg,#21182d,#171321_58%,#24131f)] p-7 text-white shadow-[0_24px_70px_rgba(8,5,18,.24)] sm:p-9">
      <div className="max-w-3xl"><div className="flex items-center gap-3"><img src="https://lh3.googleusercontent.com/d/1VBjuDg72zKakz032deRqbBJp0SYUFDuu=w1200" alt="RecallMate logo" className="h-12 w-12 rounded-2xl object-contain ring-1 ring-[#c4b5fd]/25" /><div><p className="font-pixelify text-[10px] font-bold uppercase tracking-[0.24em] text-[#ff8799]">SUPPORT & GUIDES</p><h1 className="mt-1 font-fredoka text-3xl font-semibold sm:text-4xl">How can we help you study smarter?</h1></div></div><p className="mt-3 text-indigo-100">Search product guides, security information, accessibility help, and study workflows.</p></div>
      <label className="mt-6 flex max-w-2xl items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-slate-900 shadow-lg"><Search className="h-5 w-5 text-[#a78bfa]" /><span className="sr-only">Search help</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search settings, reminders, Medea, security…" className="w-full bg-transparent outline-none" /></label>
    </section>
    <section aria-live="polite" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{results.map((article, index) => {
      const Icon = [BookOpen, SlidersHorizontal, ShieldCheck, Workflow, LifeBuoy, MessageCircleHeart][index % 6];
      return <article key={article.title} className="rounded-2xl border border-[#a78bfa]/25 bg-[#1b1726] p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#ff8293]/50 hover:shadow-lg"><Icon className="h-6 w-6 text-[#c4b5fd]" /><p className="mt-4 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-[#c4a7ff]">{article.category}</p><h2 className="mt-1 text-lg font-fredoka font-semibold text-white">{article.title}</h2><p className="mt-2 text-sm leading-6 text-[#c4bdce]">{article.body}</p></article>
    })}</section>
    {results.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">No guide matched that search. Ask Medea from the sidebar or try a broader phrase.</p>}
    <section className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-[#a78bfa]/25 bg-[#17131f] p-6"><h2 className="font-bold text-[#e7dcff]">Accessible by design</h2><p className="mt-2 text-sm text-[#c4bdce]">Help and core study workflows are keyboard accessible and designed for readable contrast. RecallMate follows your device's reduced-motion preference.</p></div><div className="rounded-2xl border border-[#ff526b]/30 bg-[#241722] p-6"><h2 className="font-bold text-[#ffe5ea]">Contact RecallMate</h2><p className="mt-2 text-sm text-[#e2cbd0]">Share an idea or report something broken. Your message is labeled and delivered to RecallMate support. Never include passwords or verification codes.</p><p className="mt-3 text-sm text-[#e2cbd0]">Email: <a className="font-bold text-[#c4a7ff] underline" href="mailto:recallmate.verify@gmail.com">recallmate.verify@gmail.com</a></p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => openSupport("feedback")} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#a78bfa] to-[#ff7185] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><MessageCircleHeart className="h-4 w-4" />Send feedback</button><button type="button" onClick={() => openSupport("report")} className="inline-flex items-center gap-2 rounded-xl border border-[#ff8293]/40 bg-[#160b12] px-4 py-2.5 text-sm font-bold text-[#ffdce2] transition hover:-translate-y-0.5 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-300"><TriangleAlert className="h-4 w-4" />Report a problem</button></div></div></section>
    {supportType && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSending) setSupportType(null); }}><section role="dialog" aria-modal="true" aria-labelledby="support-dialog-title" className="w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-6 shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom-4 dark:border-slate-700 dark:bg-slate-900 sm:rounded-3xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">RecallMate support</p><h2 id="support-dialog-title" className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{supportType === "feedback" ? "Send feedback" : "Report a problem"}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This will be clearly labeled as {supportType === "feedback" ? "user feedback" : "a user report"} for the RecallMate team.</p></div><button type="button" onClick={() => setSupportType(null)} disabled={isSending} aria-label="Close support form" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></div><form onSubmit={submitSupport} className="mt-6 space-y-4"><div><label htmlFor="support-subject" className="text-sm font-bold text-slate-800 dark:text-slate-200">Subject</label><input id="support-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} required className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div><div><label htmlFor="support-message" className="text-sm font-bold text-slate-800 dark:text-slate-200">Message</label><textarea id="support-message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={4000} rows={6} required className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div>{supportStatus && <p role="status" className={`rounded-xl px-3 py-2 text-sm font-medium ${supportStatus.tone === "success" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"}`}>{supportStatus.text}</p>}<button type="submit" disabled={isSending || !subject.trim() || message.trim().length < 10} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">{isSending ? "Sending…" : <><Send className="h-4 w-4" />Submit {supportType}</>}</button></form></section></div>}
  </main>;
}
