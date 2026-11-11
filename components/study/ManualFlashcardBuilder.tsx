"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";

type DraftCard = { id: string; front: string; back: string };
const blankCard = (): DraftCard => ({ id: crypto.randomUUID(), front: "", back: "" });

export default function ManualFlashcardBuilder() {
  const [title, setTitle] = useState("My flashcards");
  const [cards, setCards] = useState<DraftCard[]>([blankCard()]);
  const [status, setStatus] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const completeCards = useMemo(() => cards.filter(card => card.front.trim() && card.back.trim()), [cards]);

  const update = (id: string, field: "front" | "back", value: string) => {
    setCards(current => current.map(card => card.id === id ? { ...card, [field]: value } : card));
    setStatus("");
  };

  const save = () => {
    if (!completeCards.length) return setStatus("Add a front and back to at least one flashcard.");
    localStorage.setItem("recallmate-manual-flashcards", JSON.stringify({ title: title.trim() || "My flashcards", cards: completeCards, savedAt: new Date().toISOString() }));
    setStatus(`Saved ${completeCards.length} flashcard${completeCards.length === 1 ? "" : "s"} on this device.`);
  };

  const beginReview = () => {
    if (!completeCards.length) return setStatus("Complete at least one flashcard before reviewing.");
    save();
    setReviewIndex(0);
    setFlipped(false);
    setReviewing(true);
  };

  if (reviewing) {
    const card = completeCards[reviewIndex];
    return <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-5 shadow-xl shadow-indigo-500/10 dark:border-indigo-500/20 dark:from-slate-900 dark:to-indigo-950/40 sm:p-8">
      <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">{title || "My flashcards"}</p><h2 className="mt-1 text-2xl font-black dark:text-white">Card {reviewIndex + 1} of {completeCards.length}</h2></div><button type="button" onClick={() => setReviewing(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700 dark:text-white">Edit deck</button></div>
      <button type="button" aria-label="Flip flashcard" onClick={() => setFlipped(value => !value)} className="grid min-h-72 w-full place-items-center rounded-3xl border border-indigo-200 bg-white p-8 text-center shadow-lg transition duration-300 hover:-translate-y-1 dark:border-indigo-500/20 dark:bg-slate-950">
        <div><p className="mb-4 text-xs font-black uppercase tracking-[0.25em] text-indigo-500">{flipped ? "Answer" : "Question"}</p><p className="text-2xl font-black leading-relaxed text-slate-950 dark:text-white">{flipped ? card.back : card.front}</p><p className="mt-6 text-sm text-slate-500">Tap to flip</p></div>
      </button>
      <div className="mt-5 flex gap-3"><button type="button" onClick={() => { setReviewIndex(index => index === 0 ? completeCards.length - 1 : index - 1); setFlipped(false); }} className="min-h-11 flex-1 rounded-xl border border-slate-200 font-bold dark:border-slate-700 dark:text-white">Previous</button><button type="button" onClick={() => { setReviewIndex(index => (index + 1) % completeCards.length); setFlipped(false); }} className="min-h-11 flex-1 rounded-xl bg-indigo-600 font-bold text-white">Next card</button></div>
    </section>;
  }

  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
    <div className="mb-6"><p className="text-sm font-bold text-violet-600">Build your own deck</p><h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Manual flashcards</h2><p className="mt-2 text-sm text-slate-500">Write exactly what you want on the front and back, save it, then review with tap-to-flip cards.</p></div>
    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Deck name<input value={title} onChange={event => setTitle(event.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700" /></label>
    <div className="mt-5 space-y-4">{cards.map((card, index) => <article key={card.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/50">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-black dark:text-white">Flashcard {index + 1}</h3>{cards.length > 1 && <button type="button" aria-label={`Remove flashcard ${index + 1}`} onClick={() => setCards(current => current.filter(item => item.id !== card.id))} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 className="h-4 w-4" /></button>}</div>
      <div className="grid gap-3 md:grid-cols-2"><label className="text-sm font-bold text-slate-600 dark:text-slate-300">Front<textarea aria-label={`Flashcard ${index + 1} front`} value={card.front} onChange={event => update(card.id, "front", event.target.value)} rows={3} placeholder="Question, term, or concept" className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900" /></label><label className="text-sm font-bold text-slate-600 dark:text-slate-300">Back<textarea aria-label={`Flashcard ${index + 1} back`} value={card.back} onChange={event => update(card.id, "back", event.target.value)} rows={3} placeholder="Answer or explanation" className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900" /></label></div>
    </article>)}</div>
    <button type="button" onClick={() => setCards(current => [...current, blankCard()])} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-indigo-300 px-4 text-sm font-bold text-indigo-700 dark:border-indigo-500/40 dark:text-indigo-300"><Plus className="h-4 w-4" />Add another card</button>
    {status && <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${completeCards.length ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200" : "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"}`}>{status}</p>}
    <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={save} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-200 font-black text-indigo-700 dark:border-indigo-500/30 dark:text-indigo-300"><Save className="h-4 w-4" />Save flashcards</button><button type="button" onClick={beginReview} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 font-black text-white shadow-lg shadow-indigo-500/20"><RotateCcw className="h-4 w-4" />Review flashcards</button></div>
  </section>;
}
