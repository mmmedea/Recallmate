"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Download, FileText, FileUp, Loader2, ShieldCheck, Sparkles, BookOpen, Columns2 } from "lucide-react";
import { createReviewerArtifacts, downloadReviewerArtifact, readReviewerFile, REVIEWER_THEMES, type ReviewerArtifacts, type ReviewerSection } from "@/lib/reviewer/browser-reviewer";

export default function ReviewerPdfMaker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [artifacts, setArtifacts] = useState<ReviewerArtifacts | null>(null);
  const [preview, setPreview] = useState<ReviewerSection[]>([]);
  const [themeIndex, setThemeIndex] = useState(0);

  const createReviewer = async (file: File) => {
    setBusy(true); setError(""); setArtifacts(null); setPreview([]); setStatus("Reading every lesson section and picture…");
    try {
      const sections = await readReviewerFile(file);
      setPreview(sections);
      setStatus(`Formatting ${sections.length} retained section${sections.length === 1 ? "" : "s"} into true two-column Word and PDF files…`);
      const ready = await createReviewerArtifacts(file, sections, REVIEWER_THEMES[themeIndex]);
      setArtifacts(ready);
      setStatus("Your reviewer is ready. Choose PDF or Word below; nothing downloads until you click.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The reviewer could not be created.");
      setStatus("");
    } finally { setBusy(false); }
  };

  return <section className="reviewer-maker overflow-hidden rounded-[2rem] border border-[#c4b5fd]/20 bg-[#191523] text-white shadow-[0_28px_90px_rgba(8,5,18,.28)]">
    <div className="grid md:grid-cols-[0.9fr_1.1fr]">
      <div className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_90%_0%,rgba(244,63,94,.2),transparent_42%),radial-gradient(ellipse_at_0%_100%,rgba(167,139,250,.18),transparent_42%),linear-gradient(145deg,#21182d,#171321_65%,#261722)] p-6 text-white sm:p-8">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#c4b5fd]/25 bg-[#a78bfa]/15 text-[#dfd1ff]"><BookOpen className="h-5 w-5" /></span><div><p className="font-pixelify text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff9cab]">RECALLMATE STUDY TOOLS</p><p className="mt-0.5 font-nunito text-xs font-bold text-[#d9c8ff]">Reviewer studio</p></div></div>
        <h2 className="mt-5 font-fredoka text-3xl font-semibold leading-tight sm:text-4xl">Detailed two-column reviewer</h2>
        <p className="mt-4 font-quicksand text-sm leading-6 text-white/65">RecallMate keeps the lesson’s full readable detail and embedded pictures. It removes only course-information, learning-outcome/objective, and thank-you sections.</p>
        <ul className="mt-6 space-y-3 font-nunito text-sm text-white/80">
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#c4b5fd]" />Black-and-white, dense academic layout</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#c4b5fd]" />True continuous columns with running headers and page numbers</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#c4b5fd]" />PDF, PPT, and PPTX input</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9cab]" />PPTX and PDF processing stays in this browser</li>
        </ul>
      </div>
      <div className="flex flex-col justify-center bg-[#1d1928] p-6 sm:p-8">
        <fieldset className="mb-5"><legend className="font-fredoka text-lg font-semibold text-white">Choose an accent color</legend><p className="mt-1 font-quicksand text-xs text-white/50">Headings remain black. Color is used only for lines, borders, and callout backgrounds.</p><div className="mt-3 flex flex-wrap gap-2">{REVIEWER_THEMES.map((theme, index) => <button key={theme.name} type="button" aria-label={`${theme.name} reviewer accents`} aria-pressed={themeIndex === index} onClick={() => setThemeIndex(index)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 font-nunito text-xs font-extrabold transition ${themeIndex === index ? "border-[#c4b5fd] bg-[#a78bfa]/15 text-[#e6d9ff] ring-2 ring-[#a78bfa]/25" : "border-white/10 bg-white/[0.035] text-white/65 hover:border-[#c4b5fd]/50 hover:text-white"}`}><span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: `#${theme.accent}` }} />{theme.name}</button>)}</div></fieldset>
        <input ref={inputRef} type="file" accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void createReviewer(file); event.target.value = ""; }} />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="group min-h-56 rounded-[1.6rem] border-2 border-dashed border-[#a78bfa]/30 bg-[radial-gradient(ellipse_at_50%_0%,rgba(167,139,250,.13),transparent_65%),#171321] p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-[#c4b5fd]/70 hover:bg-[#211b2c] hover:shadow-[0_18px_45px_rgba(167,139,250,.10)] disabled:cursor-wait disabled:opacity-70">
          {busy ? <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#c4b5fd]" /> : <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[#c4b5fd]/25 bg-gradient-to-br from-[#a78bfa]/25 to-[#f43f5e]/15 text-[#e5d8ff] shadow-[0_0_32px_rgba(167,139,250,.14)]"><FileUp className="h-8 w-8" /></span>}
          <span className="mt-5 block font-fredoka text-xl font-semibold text-white">{busy ? "Creating your reviewer…" : "Choose lesson file"}</span>
          <span className="mt-2 block font-quicksand text-sm text-white/50">PDF, PPT, or PPTX • prepare PDF and Word</span>
        </button>
        {status && <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-[#a78bfa]/20 bg-[#a78bfa]/10 px-4 py-3 font-nunito text-sm font-semibold text-[#e4d8ff]"><Download className="mt-0.5 h-4 w-4 shrink-0" />{status}</p>}
        {artifacts && <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => downloadReviewerArtifact(artifacts.pdf, `${artifacts.baseName}-reviewer.pdf`)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#a78bfa] to-[#8b5cf6] px-4 font-nunito text-sm font-black text-[#160f22] shadow-lg shadow-[#8b5cf6]/20 transition hover:-translate-y-0.5"><Download className="h-4 w-4" />Download PDF</button>
          <button type="button" onClick={() => downloadReviewerArtifact(artifacts.docx, `${artifacts.baseName}-reviewer.docx`)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#fb7185]/30 bg-[#f43f5e]/10 px-4 font-nunito text-sm font-black text-[#ffb1bf] transition hover:-translate-y-0.5 hover:bg-[#f43f5e]/20"><FileText className="h-4 w-4" />Download Word</button>
        </div>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-[#fb7185]/25 bg-[#f43f5e]/10 px-4 py-3 font-nunito text-sm font-semibold text-[#ffb1bf]">{error}</p>}
        <p className="mt-4 text-xs leading-5 text-slate-500">For old .ppt files, text is preserved through secure extraction. Save as .pptx first when you need every embedded picture preserved exactly.</p>
      </div>
    </div>
    {preview.length > 0 && <div className="border-t border-[#c4b5fd]/15 bg-[#15111f] p-6 sm:p-8"><div className="mb-4 flex items-end justify-between gap-4"><div><p className="font-pixelify text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff9cab]">CONTENT PREVIEW</p><h3 className="mt-1 font-fredoka text-xl font-semibold text-white">What RecallMate kept</h3></div><span className="font-nunito text-xs font-bold text-white/45">{preview.length} sections</span></div><div className="grid gap-3 sm:grid-cols-2">{preview.slice(0, 6).map((section, index) => <article key={`${section.title}-${index}`} className="rounded-2xl border border-[#c4b5fd]/15 bg-[#201b2b] p-4 transition hover:-translate-y-0.5 hover:border-[#c4b5fd]/35"><h4 className="font-fredoka text-base font-semibold text-white">{section.title}</h4><p className="mt-2 line-clamp-3 font-quicksand text-xs leading-5 text-white/50">{section.text || `${section.images.length} preserved figure${section.images.length === 1 ? "" : "s"}`}</p></article>)}</div></div>}
  </section>;
}
