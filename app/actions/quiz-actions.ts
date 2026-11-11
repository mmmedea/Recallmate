'use server'

import { requireUser, SecurityError } from '@/lib/security'
import { createClient } from '@/utils/supabase/server'

export type QuizQuestionViewModel = {
  id: string
  questionText: string
  options: string[]
}

export type QuizViewModel = {
  document: {
    id: string
    title: string
  }
  questions: QuizQuestionViewModel[]
  generation: {
    status: string
  }
  inProgressAttemptId?: string
}

export async function getQuizViewModel(documentId: string): Promise<{ success: boolean; data?: QuizViewModel; error?: string }> {
  try {
    const { supabase, user } = await requireUser()

    const { data: document, error } = await supabase
      .from('documents')
      .select(`
        id, 
        filename, 
        questions ( id, question_text, options ),
        ai_jobs ( operation, status )
      `)
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (error || !document) {
      throw new SecurityError('Document not found or unauthorized', 404)
    }

    const quizJob = (document.ai_jobs as any[])?.find(j => j.operation === 'generate_quiz')
    const status = quizJob?.status || 'not_requested'
    const questions = (document.questions as any[]) || []

    if (questions.length === 0 && status === 'completed') {
      return { success: false, error: 'Quiz generation is in an inconsistent state.' }
    }
    if (questions.length === 0) {
      return { success: false, error: `Quiz is not yet ready (Status: ${status}).` }
    }

    // Check for an in_progress attempt
    const { data: activeAttempt } = await supabase
      .from('quiz_attempts')
      .select('id')
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .is('completed_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const viewModel: QuizViewModel = {
      document: {
        id: document.id,
        title: document.filename
      },
      questions: questions.map(q => ({
        id: q.id,
        questionText: q.question_text,
        options: q.options
      })),
      generation: { status },
      inProgressAttemptId: activeAttempt?.id
    }

    return { success: true, data: viewModel }

  } catch (error: any) {
    if (error instanceof SecurityError) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Internal Server Error' }
  }
}

export async function startQuizAttempt(documentId: string): Promise<{ success: boolean; attemptId?: string; error?: string }> {
  try {
    const { supabase, user } = await requireUser()

    // 1. Authorize document and get canonical question count + batch ID
    // We grab the batch ID from the first question, assuming they all share one per generation run.
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select(`
        id, 
        questions!inner(id, generation_batch_id)
      `)
      .eq('id', documentId)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (docError || !doc) {
      throw new SecurityError('Document not found or no questions available', 404)
    }

    const questions = doc.questions as any[]
    const totalQuestions = questions.length
    const batchId = questions[0]?.generation_batch_id

    if (totalQuestions === 0 || !batchId) {
      throw new SecurityError('Quiz has no valid questions', 400)
    }

    // 2. Check for an existing in-progress attempt to resume deterministically
    // It must match the current generation_batch_id
    const { data: existingAttempt } = await supabase
      .from('quiz_attempts')
      .select('id')
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .eq('generation_batch_id', batchId)
      .is('completed_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      
    if (existingAttempt) {
      return { success: true, attemptId: existingAttempt.id }
    }

    // 3. Create a new attempt tied to this batch
    const { data: newAttempt, error: insertError } = await supabase
      .from('quiz_attempts')
      .insert({
        user_id: user.id,
        document_id: documentId,
        generation_batch_id: batchId,
        total_questions: totalQuestions,
        score: 0
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    return { success: true, attemptId: newAttempt.id }
  } catch (error: any) {
    if (error instanceof SecurityError) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Internal Server Error' }
  }
}

export async function recordQuizAnswer(
  attemptId: string, 
  questionId: string, 
  selectedAnswer: string
): Promise<{ 
  success: boolean; 
  isCorrect?: boolean; 
  correctAnswer?: string; 
  explanation?: string; 
  sourceChunkId?: string; 
  error?: string 
}> {
  try {
    const { supabase, user } = await requireUser()

    // 1. Verify Attempt Ownership and Status
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .select('user_id, completed_at, document_id, generation_batch_id')
      .eq('id', attemptId)
      .single()

    if (attemptError || !attempt) throw new SecurityError('Attempt not found', 404)
    if (attempt.user_id !== user.id) throw new SecurityError('Unauthorized', 403)
    if (attempt.completed_at) throw new SecurityError('Attempt is already completed', 400)

    // 2. Load the canonical question 
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('document_id, options, correct_answer, explanation, source_chunk_id, generation_batch_id')
      .eq('id', questionId)
      .single()

    if (questionError || !question) throw new SecurityError('Question not found', 404)
    
    // Ensure question belongs to the same document and the same quiz generation version
    if (question.document_id !== attempt.document_id || question.generation_batch_id !== attempt.generation_batch_id) {
       throw new SecurityError('Question does not belong to this quiz attempt version', 400)
    }

    // 3. Validate the selected answer is one of the options
    const options = question.options as string[]
    if (!options.includes(selectedAnswer)) {
      throw new SecurityError('Invalid selected answer', 400)
    }

    const isCorrect = selectedAnswer === question.correct_answer

    // 4. Persist Answer
    const { error: insertError } = await supabase
      .from('quiz_answers')
      .insert({
        attempt_id: attemptId,
        question_id: questionId,
        selected_answer: selectedAnswer,
        is_correct: isCorrect
      })

    if (insertError) {
      if (insertError.code === '23505') {
         return {
           success: true,
           isCorrect,
           correctAnswer: question.correct_answer,
           explanation: question.explanation || '',
           sourceChunkId: question.source_chunk_id
         }
      }
      throw insertError
    }

    // 5. Return authoritative feedback
    return {
      success: true,
      isCorrect,
      correctAnswer: question.correct_answer,
      explanation: question.explanation || '',
      sourceChunkId: question.source_chunk_id
    }

  } catch (error: any) {
    if (error instanceof SecurityError) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Internal Server Error' }
  }
}

export async function completeQuizAttempt(attemptId: string): Promise<{ success: boolean; score?: number; error?: string }> {
  try {
    const { supabase, user } = await requireUser()

    // 1. Verify Attempt Ownership and get status atomically
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .select('user_id, completed_at, score, total_questions')
      .eq('id', attemptId)
      .single()

    if (attemptError || !attempt) throw new SecurityError('Attempt not found', 404)
    if (attempt.user_id !== user.id) throw new SecurityError('Unauthorized', 403)
    
    // Idempotent return if already completed
    if (attempt.completed_at) {
       return { success: true, score: attempt.score }
    }

    // 2. Load all answers for this attempt to calculate the score
    const { data: answers, error: answersError } = await supabase
      .from('quiz_answers')
      .select('is_correct')
      .eq('attempt_id', attemptId)
      
    if (answersError) throw answersError

    // 3. Reject completion if not all questions are answered
    if (answers.length < attempt.total_questions) {
      throw new SecurityError(`Cannot complete quiz. ${attempt.total_questions - answers.length} questions remaining.`, 400)
    }

    const correctCount = answers.filter(a => a.is_correct).length

    // 4. Atomically update the attempt status (in_progress -> completed)
    const { data: updatedAttempt, error: updateError } = await supabase
      .from('quiz_attempts')
      .update({ 
         completed_at: new Date().toISOString(),
         score: correctCount
      })
      .eq('id', attemptId)
      .is('completed_at', null) // Concurrency check
      .select('score')
      .single()

    if (updateError) {
      const { data: current } = await supabase.from('quiz_attempts').select('score').eq('id', attemptId).single()
      return { success: true, score: current?.score || correctCount }
    }

    return { success: true, score: updatedAttempt.score }

  } catch (error: any) {
    if (error instanceof SecurityError) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Internal Server Error' }
  }
}
