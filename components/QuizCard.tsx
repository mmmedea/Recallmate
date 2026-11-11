"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { DiamondLoader } from "@/components/DiamondLoader";

type IdentificationFeedback = {
  correct: boolean;
  answer: string;
  explanation: string;
  sourceEvidence: string;
};

export default function QuizCard({ item, difficulty, onResult }: any) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [identificationFeedback, setIdentificationFeedback] = useState<IdentificationFeedback | null>(null);
  const [identificationError, setIdentificationError] = useState<string | null>(null);
  const [userOverride, setUserOverride] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);

  const isIdentification = item.type === "identification";
  const activeDifficulty = item.difficulty || difficulty;

  useEffect(() => {
    setSelectedChoice(null);
    setAnswerText("");
    setIdentificationFeedback(null);
    setIdentificationError(null);
    setUserOverride(false);
    setIsSubmitting(false);
    submitting.current = false;
  }, [item.id, item.question]);

  const isAnswered = isIdentification ? identificationFeedback !== null : selectedChoice !== null;
  const isCorrect = isIdentification
    ? Boolean(identificationFeedback?.correct || userOverride)
    : selectedChoice === item.correctAnswer;

  const handleSelect = (key: string) => {
    if (isAnswered) return;
    setSelectedChoice(key);
  };

  const handleCheckIdentification = async () => {
    if (!item.answerId || !answerText.trim() || submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    setIdentificationError(null);
    try {
      const response = await fetch("/api/quiz/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId: item.answerId, answer: answerText }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not check this answer. Please retry.");
      setIdentificationFeedback(payload);
    } catch (error) {
      setIdentificationError(error instanceof Error ? error.message : "Could not check this answer. Please retry.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (!isAnswered || submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      await onResult(isCorrect);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 md:p-8">
      <div className="mb-6">
        <span className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${
          activeDifficulty === "easy" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" :
          activeDifficulty === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" :
          "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
        }`}>
          {activeDifficulty} Level{isIdentification ? " · Identification" : ""}
        </span>
        <h3 className="text-xl font-bold leading-snug text-slate-900 dark:text-white">{item.question}</h3>
      </div>

      {isIdentification ? (
        <div className="mb-6 space-y-3">
          <label htmlFor={`identification-${item.id}`} className="block text-sm font-bold text-slate-700 dark:text-slate-300">Your answer</label>
          <textarea
            id={`identification-${item.id}`}
            aria-label="Your answer"
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            disabled={isAnswered || isSubmitting}
            rows={2}
            maxLength={500}
            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          {!isAnswered ? (
            <button
              type="button"
              onClick={() => void handleCheckIdentification()}
              disabled={isSubmitting || !answerText.trim()}
              aria-busy={isSubmitting}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <span className="inline-flex items-center gap-2"><DiamondLoader variant="inline" label="Checking answer" />Checking answer…</span> : "Check answer"}
            </button>
          ) : null}
          {identificationError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">{identificationError}</div> : null}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Object.entries(item.options || {}).map(([key, value]) => {
            let buttonStyle = "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-slate-800";
            if (isAnswered) {
              if (key === item.correctAnswer) buttonStyle = "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-300";
              else if (key === selectedChoice) buttonStyle = "border-rose-500 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-950/30 dark:text-rose-300";
              else buttonStyle = "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500";
            }
            return (
              <button key={key} type="button" onClick={() => handleSelect(key)} disabled={isAnswered} className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left font-medium transition-all ${buttonStyle}`}>
                <span className="mt-0.5 font-black">{key}.</span>
                <span className="flex-1">{String(value)}</span>
                {isAnswered && key === item.correctAnswer ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : null}
                {isAnswered && key === selectedChoice && key !== item.correctAnswer ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" /> : null}
              </button>
            );
          })}
        </div>
      )}

      {isAnswered ? (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`rounded-2xl border p-5 ${isCorrect ? "border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20" : "border-rose-100 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20"}`}>
            <div className="mb-2 flex items-start gap-2">
              <AlertCircle className={`mt-0.5 h-5 w-5 ${isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />
              <div>
                <span className={`block font-bold ${isCorrect ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"}`}>
                  {userOverride ? "Marked correct by you." : isCorrect ? "Correct!" : "Incorrect."}
                </span>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {isIdentification ? identificationFeedback?.explanation : item.explanation}
                </p>
              </div>
            </div>
            {isIdentification ? (
              <p className="ml-7 mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Answer: {identificationFeedback?.answer}</p>
            ) : null}
            {isIdentification && !identificationFeedback?.correct && !userOverride ? (
              <button type="button" onClick={() => setUserOverride(true)} className="ml-7 mt-3 text-sm font-bold text-indigo-700 underline underline-offset-2 dark:text-indigo-300">I was right</button>
            ) : null}
            {isIdentification && identificationFeedback?.sourceEvidence ? (
              <div className="ml-7 mt-3 border-l-2 border-slate-300 pl-3 text-xs italic text-slate-500 dark:border-slate-700 dark:text-slate-400">“{identificationFeedback.sourceEvidence}”</div>
            ) : null}
            {!isIdentification && item.sourceCitation ? (
              <div className="ml-7 mt-3 border-l-2 border-slate-300 pl-3 text-xs italic text-slate-500 dark:border-slate-700 dark:text-slate-400">“{item.sourceCitation}”{item.pageNumber ? ` — ${item.pageNumber}` : ""}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 font-bold text-white shadow-md transition-colors hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {isSubmitting ? <><DiamondLoader variant="inline" label="Saving quiz progress" />Saving…</> : <>Continue <ArrowRight className="h-5 w-5" /></>}
          </button>
        </div>
      ) : null}
    </div>
  );
}
