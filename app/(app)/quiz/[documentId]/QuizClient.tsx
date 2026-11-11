'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startQuizAttempt, recordQuizAnswer, completeQuizAttempt, QuizViewModel } from '@/app/actions/quiz-actions'
import { CitationBadge } from '@/components/CitationBadge'
import { ArrowLeft, CheckCircle2, XCircle, ArrowRight, RotateCcw } from 'lucide-react'
import Link from 'next/link'

interface QuizClientProps {
  viewModel: QuizViewModel
}

export function QuizClient({ viewModel }: QuizClientProps) {
  const router = useRouter()
  const { document, questions, inProgressAttemptId } = viewModel
  const [attemptId, setAttemptId] = useState<string | null>(inProgressAttemptId || null)
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // State for the currently viewed question
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    correctAnswer: string;
    explanation: string;
    sourceChunkId?: string;
  } | null>(null)

  // Completion state
  const [isCompleted, setIsCompleted] = useState(false)
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleStart = async () => {
    setIsSubmitting(true)
    setError(null)
    const res = await startQuizAttempt(document.id)
    if (res.success && res.attemptId) {
      setAttemptId(res.attemptId)
    } else {
      setError(res.error || 'Failed to start quiz')
    }
    setIsSubmitting(false)
  }

  const handleCheckAnswer = async () => {
    if (!selectedAnswer || !attemptId) return

    setIsSubmitting(true)
    setError(null)
    const questionId = questions[currentIndex].id
    const res = await recordQuizAnswer(attemptId, questionId, selectedAnswer)

    if (res.success) {
      setFeedback({
        isCorrect: !!res.isCorrect,
        correctAnswer: res.correctAnswer!,
        explanation: res.explanation!,
        sourceChunkId: res.sourceChunkId
      })
    } else {
      setError(res.error || 'Failed to record answer')
    }
    setIsSubmitting(false)
  }

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSelectedAnswer('')
      setFeedback(null)
    } else {
      await handleComplete()
    }
  }

  const handleComplete = async () => {
    if (!attemptId) return
    setIsSubmitting(true)
    const res = await completeQuizAttempt(attemptId)
    if (res.success) {
      setIsCompleted(true)
      setFinalScore(res.score ?? null)
    } else {
      setError(res.error || 'Failed to complete quiz')
    }
    setIsSubmitting(false)
  }

  if (isCompleted) {
    return (
      <div className="max-w-2xl mx-auto p-6 md:p-12 text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Quiz Completed!</h1>
        <p className="text-lg text-slate-600 mb-8">
          You scored <span className="font-bold text-2xl text-blue-600 mx-1">{finalScore}</span> out of {questions.length}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
           <button
             onClick={() => {
               setAttemptId(null)
               setCurrentIndex(0)
               setSelectedAnswer('')
               setFeedback(null)
               setIsCompleted(false)
               setFinalScore(null)
             }}
             className="w-full sm:w-auto px-6 py-3 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
           >
             <RotateCcw className="w-4 h-4" /> Try Again
           </button>
           <Link
             href={`/documents/${document.id}`}
             className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
           >
             Back to Study Hub
           </Link>
        </div>
      </div>
    )
  }

  if (!attemptId) {
    return (
      <div className="max-w-3xl mx-auto p-6 mt-10">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{document.title} - Quiz</h1>
          <p className="text-slate-500 mb-8">{questions.length} Questions</p>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button
            onClick={handleStart}
            disabled={isSubmitting}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {inProgressAttemptId ? 'Resume Quiz' : 'Start Quiz'}
          </button>
        </div>
      </div>
    )
  }

  const question = questions[currentIndex]
  const isLocked = !!feedback

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link 
          href={`/documents/${document.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Exit
        </Link>
        <span className="text-sm font-medium text-slate-500">
          Question {currentIndex + 1} of {questions.length}
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900 mb-8 leading-snug">
            {question.questionText}
          </h2>

          <div className="space-y-3 mb-8">
            {question.options.map((opt, i) => {
              const isSelected = selectedAnswer === opt
              let optClass = "flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer "
              
              if (isLocked) {
                optClass += " cursor-default "
                if (feedback.correctAnswer === opt) {
                  optClass += " border-green-500 bg-green-50 text-green-900"
                } else if (isSelected) {
                  optClass += " border-red-500 bg-red-50 text-red-900"
                } else {
                  optClass += " border-slate-100 opacity-50"
                }
              } else {
                optClass += isSelected 
                  ? " border-blue-600 bg-blue-50" 
                  : " border-slate-200 hover:border-blue-300 hover:bg-slate-50"
              }

              return (
                <label key={i} className={optClass}>
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={opt}
                    checked={isSelected}
                    disabled={isLocked || isSubmitting}
                    onChange={() => setSelectedAnswer(opt)}
                    className="sr-only"
                  />
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? (isLocked ? (feedback.isCorrect ? 'border-green-500 bg-green-500' : 'border-red-500 bg-red-500') : 'border-blue-600 bg-blue-600') : 'border-slate-300'
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className="font-medium text-lg flex-1">{opt}</span>
                </label>
              )
            })}
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {!isLocked ? (
            <div className="flex justify-end">
              <button
                onClick={handleCheckAnswer}
                disabled={!selectedAnswer || isSubmitting}
                className="px-6 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Check Answer
              </button>
            </div>
          ) : (
            <div className="mt-8 pt-8 border-t border-slate-100 animate-in slide-in-from-bottom-2 fade-in duration-300">
              <div className="flex items-start gap-4 mb-4">
                {feedback.isCorrect ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-1" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-1" />
                )}
                <div>
                  <h3 className={`text-lg font-bold ${feedback.isCorrect ? 'text-green-700' : 'text-red-700'} mb-2`}>
                    {feedback.isCorrect ? 'Correct!' : 'Incorrect'}
                  </h3>
                  <p className="text-slate-700 leading-relaxed mb-4">{feedback.explanation}</p>
                  
                  {feedback.sourceChunkId && (
                    <CitationBadge chunkId={feedback.sourceChunkId} documentId={document.id} />
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {currentIndex < questions.length - 1 ? 'Next Question' : 'Complete Quiz'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
