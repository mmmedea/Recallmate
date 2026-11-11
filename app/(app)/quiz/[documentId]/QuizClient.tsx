'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CitationBadge } from '@/components/CitationBadge';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { DiamondLoader } from '@/components/DiamondLoader';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

interface FSRSItem {
  learningItemId: string;
  questionId: string;
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  sourceChunkId?: string;
  state: number;
}

export function QuizClient({ documentId }: { documentId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<FSRSItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [exhaustionModes, setExhaustionModes] = useState<string[]>([]);
  const [emptyMessage, setEmptyMessage] = useState("There are no more flashcards due for review right now.");
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    correctAnswer: string;
    explanation: string;
    sourceChunkId?: string;
    heartsAfter?: number;
  } | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const [isFinished, setIsFinished] = useState(false);
  const [needsHearts, setNeedsHearts] = useState(false);
  const [walletPending, setWalletPending] = useState(false);
  const [walletError, setWalletError] = useState('');
  const walletInFlight = useRef(false);
  const purchaseKey = useRef<string | null>(null);

  async function resumeWithHearts(purchase: boolean) {
    if (walletInFlight.current) return;
    walletInFlight.current = true;
    setWalletPending(true);
    setWalletError('');
    try {
      if (purchase) {
        purchaseKey.current ??= `quiz-heart-shop:${uuidv4()}`;
        const response = await fetch('/api/economy/heart-shop', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'add_five', idempotencyKey: purchaseKey.current }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not buy hearts. Please retry.');
      }
      const response = await fetch('/api/economy/wallet', { cache: 'no-store' });
      const wallet = await response.json();
      if (!response.ok || wallet.economy?.state !== 'ok') throw new Error('Could not verify your wallet. Please retry.');
      window.dispatchEvent(new CustomEvent('recallmate:economy-updated', { detail: {
        hearts: wallet.economy.hearts, heartCap: wallet.economy.heartCap,
      } }));
      if (wallet.premium || wallet.economy.hearts > 0) {
        purchaseKey.current = null;
        setNeedsHearts(false);
      } else setWalletError('No hearts available yet. Buy hearts or check again after regeneration.');
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : 'Could not refresh your wallet.');
    } finally {
      walletInFlight.current = false;
      setWalletPending(false);
    }
  }

  // Fetch session on mount
  useEffect(() => {
    async function startSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const res = await fetch('/api/learning/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ documentId, requestedSize: 10 })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start session');

        if (data.items.length === 0) {
          setExhausted(Boolean(data.exhausted));
          setExhaustionModes(Array.isArray(data.modes) ? data.modes : []);
          setEmptyMessage(data.message || 'There are no more flashcards due for review right now.');
          setIsFinished(true);
        } else {
          setItems(data.items);
          setSessionId(data.sessionId);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    startSession();
  }, [documentId, supabase]);

  if (loading) {
    return <DiamondLoader variant="section" label="Preparing your study session" className="min-h-[50vh]" />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Error</h2>
        <p className="text-slate-500 mb-6">{error}</p>
        <Link href={`/documents/${documentId}`} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md">
          <ArrowLeft className="w-4 h-4" /> Back to Study Hub
        </Link>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="mb-8 flex justify-center">
          <div className="h-24 w-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-12 w-12" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
          {exhausted ? "All unique questions completed" : "You're all caught up!"}
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 mb-10">
          {emptyMessage}
        </p>
        {exhausted && exhaustionModes.length > 0 ? (
          <div className="mb-10 grid gap-3 sm:grid-cols-2">
            {exhaustionModes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => mode.toLowerCase().includes("generate") ? router.push(`/documents/${documentId}`) : router.push(`/documents/${documentId}/review`)}
                className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-200"
              >
                {mode}
              </button>
            ))}
          </div>
        ) : null}
        <Link 
          href={`/documents/${documentId}`}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Study Hub
        </Link>
      </div>
    );
  }

  if (needsHearts) return (
    <section className="mx-auto max-w-xl space-y-4 p-8 text-center" aria-label="Quiz paused">
      <h1 className="text-2xl font-bold">You're out of hearts</h1>
      <p>Your progress is saved. Add hearts to continue this quiz.</p>
      {walletError ? <p role="alert">{walletError}</p> : null}
      <button type="button" disabled={walletPending} onClick={() => void resumeWithHearts(true)} className="rounded-xl bg-rose-600 px-5 py-3 font-bold text-white disabled:opacity-50">❤️ +5 hearts · 200 coins</button>
      <button type="button" disabled={walletPending} onClick={() => void resumeWithHearts(false)} className="block w-full rounded-xl border p-3">Check balance and resume</button>
    </section>
  );

  const currentQuestion = items[currentIndex];

  const handleSelectAnswer = (option: string) => {
    if (feedback || isSubmitting) return; // Prevent changing answer after grading
    setSelectedAnswer(option);
    
    const isCorrect = option === currentQuestion.options[currentQuestion.correctAnswerIndex];
    setFeedback({
      isCorrect,
      correctAnswer: currentQuestion.options[currentQuestion.correctAnswerIndex],
      explanation: currentQuestion.explanation,
      sourceChunkId: currentQuestion.sourceChunkId,
    });
  };

  const handleRate = async (rating: number) => {
    if (submitting.current || !feedback || !sessionId) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch('/api/learning/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          learningItemId: currentQuestion.learningItemId,
          reviewSessionId: sessionId,
          requestId: uuidv5(`quiz-review:${sessionId}:${currentQuestion.learningItemId}`, uuidv5.URL),
          wasCorrect: feedback!.isCorrect,
          rating
        })
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = payload;
        if (err.code === 'NO_HEARTS') setNeedsHearts(true);
        throw new Error(err.error || 'Failed to submit review');
      }

      const heartsAfter = Number(payload?.economy?.hearts);
      if (Number.isFinite(heartsAfter)) {
        setFeedback((current) => current ? { ...current, heartsAfter } : current);
        window.dispatchEvent(new CustomEvent('recallmate:economy-updated', {
          detail: {
            hearts: heartsAfter,
            heartCap: Number(payload?.economy?.heartCap ?? 15),
          },
        }));
      }

      // Advance
      if (currentIndex + 1 < items.length) {
        setCurrentIndex(currentIndex + 1);
        setSelectedAnswer('');
        setFeedback(null);
        if (heartsAfter === 0 && !payload.premium) setNeedsHearts(true);
      } else {
        setIsFinished(true);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link 
          href={`/documents/${documentId}`}
          className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="text-sm font-medium text-slate-500">
          Due: {currentIndex + 1} / {items.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-10 overflow-hidden">
        <div 
          className="bg-indigo-600 h-2 transition-all duration-300 ease-out"
          style={{ width: `${(currentIndex / items.length) * 100}%` }}
        ></div>
      </div>

      {/* Question Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-6">
        <div className="p-8">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-8 leading-relaxed">
            {currentQuestion.questionText}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedAnswer === option;
              let btnClass = "w-full text-left p-4 rounded-xl border-2 transition-all text-sm md:text-base font-medium ";
              
              if (!feedback) {
                btnClass += "border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-700 dark:text-slate-300";
              } else {
                const isCorrectOption = idx === currentQuestion.correctAnswerIndex;
                if (isCorrectOption) {
                  btnClass += "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100";
                } else if (isSelected && !isCorrectOption) {
                  btnClass += "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100";
                } else {
                  btnClass += "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 opacity-50";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectAnswer(option)}
                  disabled={feedback !== null || isSubmitting}
                  className={btnClass}
                >
                  <div className="flex items-start">
                    <span className="flex-shrink-0 w-6 text-slate-400">{String.fromCharCode(65 + idx)}.</span>
                    <span>{option}</span>
                    
                    {feedback && idx === currentQuestion.correctAnswerIndex && (
                      <CheckCircle2 className="w-5 h-5 ml-auto text-emerald-500 flex-shrink-0" />
                    )}
                    {feedback && isSelected && idx !== currentQuestion.correctAnswerIndex && (
                      <XCircle className="w-5 h-5 ml-auto text-red-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Feedback & FSRS Rating */}
      {feedback && (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-start gap-4 mb-4">
            {feedback.isCorrect ? (
              <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            ) : (
              <div className="h-10 w-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            )}
            <div>
              <h3 className={`text-lg font-bold ${feedback.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {feedback.isCorrect ? 'Correct!' : 'Incorrect'}
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
                {feedback.explanation}
              </p>
              {!feedback.isCorrect && Number.isFinite(feedback.heartsAfter) ? (
                <p className="mt-2 text-sm font-semibold text-rose-600 dark:text-rose-300">
                  One heart used · {feedback.heartsAfter} remaining
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-center text-sm font-medium text-slate-500 mb-4">How hard was this to recall?</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => handleRate(1)}
                disabled={isSubmitting}
                className="py-3 px-4 rounded-xl border border-red-200 bg-red-50 text-red-700 font-medium hover:bg-red-100 transition-colors disabled:opacity-50 flex flex-col items-center gap-1"
              >
                <span>Again</span>
                <span className="text-xs opacity-70">&lt; 1m</span>
              </button>
              
              <button
                onClick={() => handleRate(2)}
                disabled={isSubmitting}
                className="py-3 px-4 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 font-medium hover:bg-orange-100 transition-colors disabled:opacity-50 flex flex-col items-center gap-1"
              >
                <span>Hard</span>
                <span className="text-xs opacity-70">{feedback.isCorrect ? 'Correct' : 'Wrong'}</span>
              </button>
              
              <button
                onClick={() => handleRate(3)}
                disabled={isSubmitting}
                className="py-3 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50 flex flex-col items-center gap-1"
              >
                <span>Good</span>
                <span className="text-xs opacity-70">Default</span>
              </button>
              
              <button
                onClick={() => handleRate(4)}
                disabled={isSubmitting}
                className="py-3 px-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 flex flex-col items-center gap-1"
              >
                <span>Easy</span>
                <span className="text-xs opacity-70">Too simple</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
