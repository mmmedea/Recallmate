"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileText, FileUp, Image as ImageIcon, Palette, ShieldCheck, SlidersHorizontal } from "lucide-react";
import GenerationLoader from "@/components/GenerationLoader";
import { createReviewerArtifacts, downloadReviewerArtifact, readReviewerFileWithReport, REVIEWER_THEMES, type ReviewerArtifacts, type ReviewerRemovedSection, type ReviewerSection, type ReviewerTheme } from "@/lib/reviewer/browser-reviewer";

type ReviewerDepth = "comprehensive" | "compact";

type ReviewerOptions = {
  importantImages: boolean;
  speakerNotes: boolean;
  tables: boolean;
  formulas: boolean;
  dedupe: boolean;
  removeObjectives: boolean;
  removeIntro: boolean;
  removeClosing: boolean;
  removeDecorative: boolean;
};

const DEFAULT_OPTIONS: ReviewerOptions = {
  importantImages: true,
  speakerNotes: true,
  tables: true,
  formulas: true,
  dedupe: true,
  removeObjectives: false,
  removeIntro: true,
  removeClosing: true,
  removeDecorative: true,
};

function customTint(hex: string) {
  const safe = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const mix = (channel: string) => Math.round(Number.parseInt(channel, 16) * 0.14 + 255 * 0.86).toString(16).padStart(2, "0").toUpperCase();
  return `${mix(safe.slice(0, 2))}${mix(safe.slice(2, 4))}${mix(safe.slice(4, 6))}`;
}

function partHeader(index: number, file: File, depth: ReviewerDepth): ReviewerSection {
  return {
    title: `SOURCE INFORMATION · FILE ${index + 1}`,
    text: `Source file: ${file.name}\nReviewer mode: ${depth === "comprehensive" ? "Reference — preserve all unique academic facts and only reorganize/rewrite for study flow" : "Summary — tighten prose while preserving formulas, values, key tables, figures, and instructor notes"}`,
    images: [],
    tables: [],
    sourceFileId: file.name,
    sourceOrigin: "generated_part_header",
  };
}

function applyReviewerOptions(sections: ReviewerSection[], options: ReviewerOptions) {
  return sections.map(section => ({
    ...section,
    images: options.importantImages ? section.images : [],
    tables: options.tables ? section.tables : [],
  }));
}

function reviewerMetrics(files: File[], sections: ReviewerSection[]) {
  const studySections = sections.filter(section => section.sourceOrigin !== "generated_part_header");
  return {
    files: files.length,
    sections: studySections.length,
    images: studySections.reduce((sum, section) => sum + section.images.length, 0),
    tables: studySections.reduce((sum, section) => sum + (section.tables?.length || 0), 0),
    bullets: studySections.reduce((sum, section) => sum + section.text.split(/\r?\n/).filter(line => line.trim().startsWith("•")).length, 0),
  };
}

function removedReasonLabel(reason: ReviewerRemovedSection["reason"]) {
  if (reason === "DROP_OBJECTIVES") return "Learning objectives";
  if (reason === "DROP_CLOSING") return "Closing/Q&A";
  if (reason === "DROP_ADMIN") return "Intro/admin";
  if (reason === "DROP_DECORATIVE") return "Decorative";
  return "Needs review";
}

function shouldAutoRestoreRemoved(section: ReviewerRemovedSection, options: ReviewerOptions) {
  if (section.reason === "DROP_OBJECTIVES") return !options.removeObjectives;
  if (section.reason === "DROP_CLOSING") return !options.removeClosing;
  if (section.reason === "DROP_ADMIN") return !options.removeIntro;
  if (section.reason === "DROP_DECORATIVE") return !options.removeDecorative;
  return false;
}

function removedToReviewerSection(section: ReviewerRemovedSection): ReviewerSection {
  return {
    title: `RESTORED · ${section.title}`,
    text: section.text,
    images: [],
    tables: [],
    sourceFileId: section.sourceFileName,
    sourcePageOrSlide: section.sourcePageOrSlide,
    sourceOrigin: "restored_source",
  };
}

function formatReviewerMakerError(cause: unknown) {
  const technical = cause instanceof Error ? cause.message : "The reviewer could not be created.";
  if (/column-major table transposition|Reviewer QA failed|Reviewer structural QA failed/i.test(technical)) {
    return {
      message: "Some table formatting needs attention. RecallMate paused the download only where a source table could not be interpreted safely without changing study information.",
      details: technical,
    };
  }
  return { message: technical, details: "" };
}

export default function ReviewerPdfMaker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [artifacts, setArtifacts] = useState<ReviewerArtifacts | null>(null);
  const [preview, setPreview] = useState<ReviewerSection[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [themeIndex, setThemeIndex] = useState(0);
  const [customColor, setCustomColor] = useState("#C63392");
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [depth, setDepth] = useState<ReviewerDepth>("comprehensive");
  const [options, setOptions] = useState<ReviewerOptions>(DEFAULT_OPTIONS);
  const [removed, setRemoved] = useState<ReviewerRemovedSection[]>([]);

  const selectedTheme: ReviewerTheme = useMemo(() => {
    if (!useCustomColor) return REVIEWER_THEMES[themeIndex];
    const accent = customColor.replace("#", "").toUpperCase().padEnd(6, "0").slice(0, 6);
    return { name: "Custom", accent, tint: customTint(accent) };
  }, [customColor, themeIndex, useCustomColor]);

  const metrics = reviewerMetrics(files, preview);

  const updateOption = (key: keyof ReviewerOptions) => {
    setOptions(current => ({ ...current, [key]: !current[key] }));
    setArtifacts(null);
  };

  const buildArtifactsForSections = async (selectedFiles: File[], allSections: ReviewerSection[]) => {
    const stats = reviewerMetrics(selectedFiles, allSections);
    setStatus(`Building ${stats.sections} retained sections from ${stats.files} source file${stats.files === 1 ? "" : "s"} with ${stats.tables} table${stats.tables === 1 ? "" : "s"} and ${stats.images} important image${stats.images === 1 ? "" : "s"}…`);
    const outputFile = selectedFiles.length === 1
      ? selectedFiles[0]
      : new File([""], "RecallMate_Multi_Source_Reviewer.pdf", { type: "application/pdf" });
    const ready = await createReviewerArtifacts(outputFile, allSections, selectedTheme, { dedupeImages: options.dedupe });
    setArtifacts(ready);
    const repaired = ready.qualityReport.repairs.length;
    setStatus(repaired
      ? `Reviewer ready. Repaired ${repaired} table${repaired === 1 ? "" : "s"} while preserving the original information. Preview retained and removed source blocks below, then download PDF or editable DOCX.`
      : "Reviewer ready. Preview retained and removed source blocks below, then download PDF or editable DOCX.");
  };

  const createReviewer = async (selectedFiles: File[]) => {
    if (!selectedFiles.length) return;
    setBusy(true);
    setError("");
    setErrorDetails("");
    setArtifacts(null);
    setPreview([]);
    setRemoved([]);
    setFiles(selectedFiles);
    setStatus("Extracting content from the original source files…");
    try {
      const allSections: ReviewerSection[] = [];
      const sourceInfoSections: ReviewerSection[] = [];
      const removedSections: ReviewerRemovedSection[] = [];
      for (const [index, file] of selectedFiles.entries()) {
        setStatus(`Structuring tables, bullets, diagrams, figures, and section hierarchy from ${file.name}…`);
        const report = await readReviewerFileWithReport(file);
        const restored = report.removed.filter(section => shouldAutoRestoreRemoved(section, options)).map(removedToReviewerSection);
        const stillRemoved = report.removed.filter(section => !shouldAutoRestoreRemoved(section, options));
        const sections = applyReviewerOptions([...report.sections, ...restored], options);
        removedSections.push(...stillRemoved);
        allSections.push(...sections);
        sourceInfoSections.push(partHeader(index, file, depth));
      }
      allSections.push(...sourceInfoSections);
      setPreview(allSections);
      setRemoved(removedSections);
      await buildArtifactsForSections(selectedFiles, allSections);
    } catch (cause) {
      const formatted = formatReviewerMakerError(cause);
      setError(formatted.message);
      setErrorDetails(formatted.details);
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const restoreRemovedSections = async () => {
    if (!removed.length || !files.length) return;
    setBusy(true);
    setError("");
    setErrorDetails("");
    setArtifacts(null);
    try {
      const restoredSections = [...preview, ...removed.map(removedToReviewerSection)];
      setPreview(restoredSections);
      setRemoved([]);
      await buildArtifactsForSections(files, restoredSections);
    } catch (cause) {
      const formatted = formatReviewerMakerError(cause);
      setError(formatted.message || "The removed source blocks could not be restored.");
      setErrorDetails(formatted.details);
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  return <section className="overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900">
    <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
      <div className="bg-slate-950 p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Reviewer maker</p>
        <h2 className="mt-2 text-3xl font-black">Exam-ready PDF & DOCX reviewer</h2>
        <p className="mt-4 text-sm leading-6 text-slate-300">Built as a source-faithful Reference Reviewer: dense two-column layout, strong section bars, compact tables, NOTE callouts, running headers, and page numbers.</p>
        <ul className="mt-6 space-y-3 text-sm text-slate-200">
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Source information is kept after the study content</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Black readable body text with your chosen accent color</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Tables stay as row-bound tables; bullets stay as bullets</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />PDF, DOCX, PPT, PPTX, and image input</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Structural QA runs before download buttons appear</li>
        </ul>
      </div>

      <div className="space-y-5 p-6 sm:p-8">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,image/gif,image/webp"
          className="sr-only"
          onChange={event => {
            const selected = Array.from(event.target.files || []);
            if (selected.length) void createReviewer(selected);
            event.target.value = "";
          }}
        />

        <button type="button" onClick={() => inputRef.current?.click()} className="group w-full rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:-translate-y-1 hover:border-slate-950 hover:bg-white dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-white dark:hover:bg-slate-950">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950"><FileUp className="h-8 w-8" /></span>
          <span className="mt-5 block text-xl font-black text-slate-950 dark:text-white">Upload study materials</span>
          <span className="mt-2 block text-sm text-slate-500">Drop or browse PDF, DOCX, PPT, PPTX, PNG, JPEG, GIF, or WEBP</span>
        </button>

        {files.length > 0 && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Selected</p>
          <div className="mt-3 space-y-2">
            {files.map(file => <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm dark:bg-slate-900">
              <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{file.name}</span>
              <span className="shrink-0 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>)}
          </div>
        </div>}

        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <legend className="flex items-center gap-2 px-2 text-sm font-black text-slate-950 dark:text-white"><SlidersHorizontal className="h-4 w-4" />Output mode</legend>
            <div className="mt-2 grid gap-2">
              {(["comprehensive", "compact"] as const).map(value => <button key={value} type="button" aria-pressed={depth === value} onClick={() => { setDepth(value); setArtifacts(null); }} className={`rounded-xl border px-4 py-3 text-left text-sm transition ${depth === value ? "border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20 dark:bg-indigo-950/40 dark:text-indigo-100" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>
                <span className="block font-black">{value === "comprehensive" ? "Reference" : "Summary"}</span>
                <span className="mt-1 block text-xs opacity-75">{value === "comprehensive" ? "Preserve every unique academic fact; reorganize only." : "Shorten prose only; keep formulas, values, key tables, figures, and notes."}</span>
              </button>)}
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <legend className="flex items-center gap-2 px-2 text-sm font-black text-slate-950 dark:text-white"><Palette className="h-4 w-4" />Theme Color</legend>
            <div className="mt-3 flex flex-wrap gap-2">{REVIEWER_THEMES.map((theme, index) => <button key={theme.name} type="button" aria-label={`${theme.name} reviewer accents`} aria-pressed={!useCustomColor && themeIndex === index} onClick={() => { setUseCustomColor(false); setThemeIndex(index); setArtifacts(null); }} className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-black ${!useCustomColor && themeIndex === index ? "border-slate-950 ring-2 ring-slate-400 dark:border-white" : "border-slate-200 dark:border-slate-700"}`}><span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: `#${theme.accent}` }} />{theme.name}</button>)}</div>
            <label className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={useCustomColor} onChange={event => { setUseCustomColor(event.target.checked); setArtifacts(null); }} />
              Custom
              <input type="color" value={customColor} onChange={event => { setCustomColor(event.target.value); setUseCustomColor(true); setArtifacts(null); }} className="ml-auto h-8 w-10 cursor-pointer rounded bg-transparent" aria-label="Custom reviewer accent color" />
            </label>
          </fieldset>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <legend className="px-2 text-sm font-black text-slate-950 dark:text-white">Include</legend>
            <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {[
                ["importantImages", "Important images and diagrams"],
                ["speakerNotes", "Speaker notes when available"],
                ["tables", "Native tables"],
                ["formulas", "Formulas and numerical values"],
              ].map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={options[key as keyof ReviewerOptions]} onChange={() => updateOption(key as keyof ReviewerOptions)} />{label}</label>)}
              <label className="flex items-center gap-2"><input type="checkbox" checked={!options.removeObjectives} onChange={() => updateOption("removeObjectives")} />Study / learning objectives</label>
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <legend className="px-2 text-sm font-black text-slate-950 dark:text-white">Smart cleanup</legend>
            <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <label className="flex items-center gap-2"><input type="checkbox" checked={options.dedupe} onChange={() => updateOption("dedupe")} />Remove exact duplicate figures</label>
              {[
                ["removeIntro", "Welcome, intro, and agenda filler"],
                ["removeClosing", "Thank-you, Q&A, and contact slides"],
                ["removeDecorative", "Decorative-only images"],
              ].map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={options[key as keyof ReviewerOptions]} onChange={() => updateOption(key as keyof ReviewerOptions)} />{label}</label>)}
            </div>
          </fieldset>
        </div>

        {busy && <GenerationLoader title="Creating your source-preserving reviewer" status={status} steps={["Extracting content", "Structuring tables", "Analyzing study material", "Building reviewer", "Checking accuracy", "Repairing tables when needed", "Preparing PDF / DOCX"]} />}
        {status && !busy && <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100"><Download className="mt-0.5 h-4 w-4 shrink-0" />{status}</p>}
        {error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
          <p>{error}</p>
          {errorDetails && <details className="mt-3 rounded-lg border border-rose-200 bg-white/70 p-3 text-xs font-medium dark:border-rose-400/20 dark:bg-slate-950/40">
            <summary className="cursor-pointer font-black">View technical details</summary>
            <p className="mt-2 whitespace-pre-wrap break-words">{errorDetails}</p>
          </details>}
        </div>}
        {artifacts && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">Reviewer ready</p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">{Math.round(artifacts.qualityReport.coverage * 1000) / 10}% source coverage · content QA {artifacts.qualityReport.contentQA} · layout QA {artifacts.qualityReport.layoutQA} · PDF/DOCX parity {artifacts.qualityReport.parityQA}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => downloadReviewerArtifact(artifacts.pdf, `${artifacts.baseName}-reviewer.pdf`)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"><Download className="h-4 w-4" />Download PDF</button>
              <button type="button" onClick={() => downloadReviewerArtifact(artifacts.docx, `${artifacts.baseName}-reviewer.docx`)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><FileText className="h-4 w-4" />Download DOCX</button>
            </div>
          </div>
        </div>}
        <p className="text-xs leading-5 text-slate-500">For old .ppt files, text is preserved through secure extraction. Save as .pptx first when you need every embedded picture preserved exactly.</p>
      </div>
    </div>

    {preview.length > 0 && <div className="border-t border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950/40 sm:p-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Reviewer Preview</p>
          <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">What RecallMate will keep</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 sm:grid-cols-4">
          <span className="rounded-full bg-white px-3 py-1 dark:bg-slate-900">{metrics.sections} sections</span>
          <span className="rounded-full bg-white px-3 py-1 dark:bg-slate-900">{metrics.tables} tables</span>
          <span className="rounded-full bg-white px-3 py-1 dark:bg-slate-900">{metrics.images} figures</span>
          <span className="rounded-full bg-white px-3 py-1 dark:bg-slate-900">{metrics.bullets} bullets</span>
        </div>
      </div>
      {artifacts?.qualityReport && <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-950 dark:text-white">Source processing QA</p>
            <p className="mt-1 text-xs text-slate-500">Downloads are enabled only after content coverage, layout structure, and PDF/DOCX parity pass.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100">
            {Math.round(artifacts.qualityReport.coverage * 1000) / 10}% coverage
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {artifacts.qualityReport.metrics.slice(0, 8).map(metric => <div key={metric.label} className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700">
            <p className="font-black text-slate-900 dark:text-white">{metric.label}</p>
            <p className="mt-1 text-slate-500">{metric.output}/{metric.source} retained</p>
            <p className={`mt-2 inline-flex rounded-full px-2 py-0.5 font-black ${metric.status === "pass" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100" : metric.status === "warn" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100" : "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-100"}`}>{metric.status}</p>
          </div>)}
        </div>
      </div>}
      {removed.length > 0 && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-amber-950 dark:text-amber-100">Removed from reviewer preview</p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">These source blocks looked like objectives, intro/admin, decorative, or closing material. Restore them if RecallMate removed real study content.</p>
          </div>
          <button type="button" onClick={restoreRemovedSections} disabled={busy} className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-900 transition hover:-translate-y-0.5 disabled:opacity-60 dark:border-amber-400/40 dark:bg-slate-950 dark:text-amber-100">
            Restore all removed
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {removed.slice(0, 6).map((section, index) => <article key={`${section.title}-${section.sourcePageOrSlide}-${index}`} className="rounded-xl border border-amber-200 bg-white/80 p-3 text-xs dark:border-amber-400/20 dark:bg-slate-950/60">
            <p className="font-black text-slate-950 dark:text-white">{section.title}</p>
            <p className="mt-1 text-amber-700 dark:text-amber-200">{removedReasonLabel(section.reason)}{section.sourcePageOrSlide ? ` · slide/page ${section.sourcePageOrSlide}` : ""}</p>
            <p className="mt-2 line-clamp-2 text-slate-600 dark:text-slate-300">{section.text}</p>
          </article>)}
        </div>
        {removed.length > 6 && <p className="mt-3 text-xs font-semibold text-amber-800 dark:text-amber-200">Showing first 6 removed blocks. Restore all will include every removed block.</p>}
      </div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {preview.slice(0, 8).map((section, index) => <article key={`${section.title}-${index}`} className={`rounded-2xl border p-4 ${section.sourceOrigin === "generated_part_header" ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-black">{section.title}</h4>
            {section.images.length > 0 && <ImageIcon className="h-4 w-4 shrink-0 text-indigo-500" />}
          </div>
          <p className="mt-2 line-clamp-3 text-xs leading-5 opacity-75">{section.text || `${section.images.length} preserved figure${section.images.length === 1 ? "" : "s"}`}</p>
          {(section.tables?.length || 0) > 0 && <p className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-300">{section.tables?.length} table{section.tables?.length === 1 ? "" : "s"} preserved</p>}
        </article>)}
      </div>
      {preview.length > 8 && <p className="mt-4 text-xs font-semibold text-slate-500">Showing first 8 preview blocks. The generated PDF/DOCX includes the full retained source structure.</p>}
    </div>}
  </section>;
}
