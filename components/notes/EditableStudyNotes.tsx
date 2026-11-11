"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, FileUp, Heading2, Italic, List, ListOrdered, Save, Sparkles, Underline } from "lucide-react";
import { processFileClientSide } from "@/lib/client-parser";
import { buildEditableNotesHtml } from "@/lib/notes/structured-notes";
import { notesFromSource } from '@/lib/source/academic-source';
import { DiamondLoader } from "@/components/DiamondLoader";

const STORAGE_KEY = "recallmate-editable-study-notes";

export default function EditableStudyNotes() {
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("No notes yet");

  useEffect(() => {
    const savedNotes = localStorage.getItem(STORAGE_KEY);
    if (savedNotes) {
      setHtml(savedNotes);
      setSaved("Restored from this device");
      return;
    }
    const raw = sessionStorage.getItem("recallmate-content");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setHtml(buildEditableNotesHtml(parsed));
      setFileName(parsed.fileName || "Study notes");
    } catch {}
  }, []);

  useEffect(() => {
    if (!html) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, html);
      setSaved(`Autosaved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [html]);

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    window.document.execCommand(command, false, value);
    setHtml(editorRef.current?.innerHTML || "");
  };

  const generate = async (file: File) => {
    setBusy(true); setError(""); setFileName(file.name); setSaved("Reading file…");
    try {
      if (/\.docx$/i.test(file.name)) {
        const { extractDocxSource } = await import('@/lib/source/docx-source');
        const source = await extractDocxSource(await file.arrayBuffer(), file.name);
        const notes = notesFromSource(source);
        setHtml(notes.sourceHtml);
        localStorage.setItem(STORAGE_KEY, notes.sourceHtml);
        // Source IDs refer to this exact local file hash, not a fabricated DB document.
        localStorage.setItem(`${STORAGE_KEY}-source`, JSON.stringify({ fileName: file.name, sourceHash: source.source_hash, noteBlocks: notes.noteBlocks, coverage: notes.coverage }));
        setSaved(notes.coverage.unresolved ? 'Text preserved; some source elements need review.' : 'Source text and tables preserved. No outside information added.');
        return;
      }
      const text = await processFileClientSide(file);
      setSaved("Medea is organizing complete study notes…");
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, fileName: file.name, count: 5, difficulty: "easy", purpose: "notes" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Medea could not generate notes from this file.");
      const nextHtml = buildEditableNotesHtml(data);
      setHtml(nextHtml);
      localStorage.setItem(STORAGE_KEY, nextHtml);
      setSaved(data.notice || "Generated and saved - click anywhere in the page to edit");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The notes could not be generated.");
      setSaved("Generation stopped");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900">
    <input ref={inputRef} type="file" className="sr-only" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md,image/png,image/jpeg" onChange={event => { const file = event.target.files?.[0]; if (file) void generate(file); }} />
    <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-600"><Sparkles className="h-4 w-4" />Editable AI notes</p><h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Upload, generate, then edit like a document</h2><p className="mt-1 text-xs text-slate-500">{fileName || "PDF, PPTX, DOCX, text, and images"} · {saved}</p></div>
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60">{busy ? <DiamondLoader variant="inline" label="Generating notes" /> : <FileUp className="h-4 w-4" />}{busy ? "Generating notes…" : html ? "Upload another file" : "Upload file for notes"}</button>
    </div>
    {error && <p role="alert" className="m-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
    {html ? <>
      <div role="toolbar" aria-label="Note formatting" className="flex flex-wrap gap-1 border-b border-slate-200 p-3 dark:border-slate-800">{[
        ["bold", "Bold", Bold], ["italic", "Italic", Italic], ["underline", "Underline", Underline], ["formatBlock", "Heading", Heading2, "h2"], ["insertUnorderedList", "Bulleted list", List], ["insertOrderedList", "Numbered list", ListOrdered],
      ].map(([command, label, Icon, value]: any) => <button key={label} type="button" title={label} aria-label={label} onMouseDown={event => event.preventDefault()} onClick={() => runCommand(command, value)} className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Icon className="h-4 w-4" /></button>)}<span className="mx-2 h-8 w-px bg-slate-200 dark:bg-slate-700" /><button type="button" onClick={() => { localStorage.setItem(STORAGE_KEY, html); setSaved("Saved now"); }} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"><Save className="h-4 w-4" />Save</button></div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={event => setHtml(event.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: html }} aria-label="Editable study notes" className="prose prose-slate min-h-[460px] max-w-none p-6 outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/30 dark:prose-invert sm:p-10 [&_h1]:text-3xl [&_h1]:font-black [&_h2]:mt-8 [&_h2]:border-b [&_h2]:border-indigo-200 [&_h2]:pb-2 [&_h2]:text-lg [&_h2]:font-black [&_li]:my-1.5 [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 dark:[&_th]:border-slate-700 dark:[&_th]:bg-slate-800 dark:[&_td]:border-slate-700 [&_aside]:my-5 [&_aside]:rounded-xl [&_aside]:border [&_aside]:border-slate-300 [&_aside]:bg-slate-50 [&_aside]:p-4 dark:[&_aside]:border-slate-700 dark:[&_aside]:bg-slate-950/50" />
    </> : <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="m-5 grid min-h-72 w-[calc(100%-2.5rem)] place-items-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-indigo-500 hover:bg-indigo-50/40 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/40"><span><FileUp className="mx-auto h-12 w-12 text-indigo-500" /><strong className="mt-4 block text-xl text-slate-950 dark:text-white">Upload a lesson to generate editable notes</strong><span className="mt-2 block text-sm text-slate-500">Your notes stay editable and autosave on this device.</span></span></button>}
  </section>;
}
