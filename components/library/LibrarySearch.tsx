"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DocumentLifecycleSummary } from "@/app/actions/document-lifecycle";

type Filter = "all" | "ready" | "processing" | "attention";

export default function LibrarySearch({ items, loadError }: { items: DocumentLifecycleSummary[]; loadError: string | null }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !normalized || item.document.filename.toLowerCase().includes(normalized);
      const status = item.extraction.status;
      const matchesFilter = filter === "all"
        || (filter === "ready" && status === "completed")
        || (filter === "processing" && ["uploaded", "queued", "analyzing", "generating", "processing"].includes(status))
        || (filter === "attention" && ["failed", "cancelled"].includes(status));
      return matchesQuery && matchesFilter;
    });
  }, [items, query, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All materials" },
    { id: "ready", label: "Ready" },
    { id: "processing", label: "Processing" },
    { id: "attention", label: "Needs attention" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-pixelify text-[10px] uppercase tracking-[0.22em] text-[#c4a7ff]">YOUR STUDY COLLECTION</p>
          <h1 className="mt-2 font-fredoka text-3xl font-semibold text-white sm:text-4xl">My Library</h1>
          <p className="mt-2 font-quicksand text-sm text-white/50">Search your uploaded materials and open their generated notes and practice quizzes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/upload?mode=flashcards" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-4 py-3 font-nunito text-sm font-extrabold text-[#d9c8ff] transition hover:bg-[#a78bfa]/20">Create flashcards</Link>
          <Link href="/upload" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#a78bfa] to-[#c4a7ff] px-5 py-3 font-nunito text-sm font-black text-[#170f23] transition hover:-translate-y-0.5 hover:brightness-110">+ Add material</Link>
        </div>
      </header>

      <section className="rounded-3xl border border-white/10 bg-[#111019] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="block flex-1">
            <span className="sr-only">Search your library</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by file or material name…" className="h-12 w-full rounded-xl border border-white/10 bg-[#0b0a11] px-4 font-nunito text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#a78bfa]/60 focus:ring-2 focus:ring-[#a78bfa]/15" />
          </label>
          <p className="font-quicksand text-xs text-white/45"><span className="font-fredoka text-lg text-white">{items.length}</span> materials in your library</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter library materials">
          {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`rounded-full border px-3.5 py-2 font-nunito text-xs font-extrabold transition ${filter === item.id ? "border-[#a78bfa]/40 bg-[#a78bfa]/15 text-[#e0d4ff]" : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.07] hover:text-white"}`}>{item.label}</button>)}
        </div>
      </section>

      {loadError && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 font-nunito text-sm text-rose-200">{loadError}</p>}

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#a78bfa]/25 bg-[#111019] px-6 py-14 text-center">
          <p className="font-fredoka text-xl font-semibold text-white">{items.length === 0 ? "Your library is ready for its first material." : "No matching materials."}</p>
          <p className="mx-auto mt-2 max-w-md font-quicksand text-sm leading-6 text-white/45">{items.length === 0 ? "Upload a PDF or document to generate notes and practice questions. You can also create flashcards yourself." : "Try a different search term or switch the status filter."}</p>
          {items.length === 0 && <Link href="/upload" className="mt-5 inline-flex rounded-xl bg-[#a78bfa]/15 px-5 py-2.5 font-nunito text-sm font-extrabold text-[#d9c8ff] transition hover:bg-[#a78bfa]/25">Upload your first material</Link>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const status = item.extraction.status;
            const failed = status === "failed" || status === "cancelled";
            const ready = status === "completed";
            const statusText = failed ? "Needs attention" : ready ? "Ready to study" : "Processing";
            const statusStyle = failed ? "border-rose-400/20 bg-rose-400/10 text-rose-200" : ready ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-[#a78bfa]/20 bg-[#a78bfa]/10 text-[#d9c8ff]";
            return (
              <article key={item.document.id} className="rounded-2xl border border-white/10 bg-[#111019] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#a78bfa]/35 hover:shadow-xl hover:shadow-[#8b5cf6]/10">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-pixelify text-[9px] uppercase tracking-[0.16em] text-white/35">STUDY MATERIAL</span>
                  <span className={`rounded-full border px-2.5 py-1 font-nunito text-[10px] font-extrabold ${statusStyle}`}>{statusText}</span>
                </div>
                <h2 className="mt-5 line-clamp-2 min-h-12 font-fredoka text-lg font-semibold text-white" title={item.document.filename}>{item.document.filename}</h2>
                <p className="mt-2 font-quicksand text-xs text-white/40">{new Date(item.document.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <Link href={`/documents/${item.document.id}`} className="rounded-lg bg-[#a78bfa]/15 px-3 py-2 font-nunito text-xs font-extrabold text-[#d9c8ff] transition hover:bg-[#a78bfa]/25">Open material</Link>
                  {item.notes.status === "ready" && <Link href={`/notes/${item.document.id}`} className="rounded-lg border border-white/10 px-3 py-2 font-nunito text-xs font-bold text-white/70 transition hover:bg-white/[0.06]">Notes</Link>}
                  {item.quiz.status === "ready" && <Link href={`/quiz/${item.document.id}`} className="rounded-lg border border-white/10 px-3 py-2 font-nunito text-xs font-bold text-white/70 transition hover:bg-white/[0.06]">Practice quiz</Link>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
