import { ProviderAdapter } from '@/lib/ai/provider';
import { getDocumentContext } from '@/lib/ai/context-engine';
import { authorizeCredits, reconcileCredits } from '@/lib/ai/entitlements';
import { ModelRegistry } from '@/lib/ai/config';
import { QuizGenAISchema, ZodQuizSchema } from '@/lib/ai/schemas';
import { validateQuizBusinessRules, ValidationError } from '@/lib/ai/validation';

export async function handleGenerateQuiz(supabase: any, job: any) {
  let reservationAmount = 0;
  let providerUsage: any = null;

  try {
    // 1. Fetch Document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, user_id, title')
      .eq('id', job.document_id)
      .single();

    if (docError || !document) {
      throw new ValidationError("Document not found or inaccessible.");
    }

    // 2. Context Engine (Auth-aware, hierarchical retrieval)
    const contextResult = await getDocumentContext(supabase, document.id, document.user_id, 'generate_quiz');
    
    // 3. Entitlements (Authorize credits)
    reservationAmount = await authorizeCredits(
      supabase,
      { userId: document.user_id, documentId: document.id, operation: 'generate_quiz' },
      job.id,
      ModelRegistry.generate_quiz.model,
      contextResult.content
    );

    // 4. Prompt Assembly
    const systemInstruction = `You are Medea, an expert educational tutor.
Create a rigorous multiple choice quiz testing key concepts from the provided document.
- Generate at least 5 questions.
- Every question MUST have exactly 4 options.
- Options must be distinct.
- You MUST provide the index (0-3) of the correct answer.
- You MUST provide a detailed explanation of why the answer is correct.
- You MUST ground all questions in the source text.
- You MUST provide accurate chunkIndex citations for every question based on the chunk headers in the text.`;
    
    const prompt = `DOCUMENT CONTENT:
${contextResult.content}`;

    // 5. Provider Execution (Structured JSON)
    const providerResult = await ProviderAdapter.executeStructuredGeneration(
      'generate_quiz',
      systemInstruction,
      prompt,
      QuizGenAISchema
    );
    providerUsage = providerResult.usage;

    // 6. Schema Validation
    const parsedData = ZodQuizSchema.safeParse(providerResult.data);
    if (!parsedData.success) {
      throw new ValidationError("Provider output failed structural Zod validation: " + parsedData.error.message);
    }
    const quiz = parsedData.data;

    // 7. Business & Educational Validation
    validateQuizBusinessRules(quiz, contextResult.validChunkIndices);

    // 8. Database Persistence Transaction
    const { error: txError } = await supabase.rpc('save_generated_quiz', {
      p_job_id: job.id,
      p_user_id: document.user_id,
      p_document_id: document.id,
      p_questions: quiz.questions.map(q => ({
        questionText: q.question,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
        explanation: q.explanation,
        sources: q.sources
      }))
    });

    if (txError) {
      throw new Error(`Database error saving quiz: ${txError.message}`);
    }

    // Phase 6.7: Initialize learning items for the new questions
    const { error: learningInitError } = await supabase.rpc('ensure_learning_items', {
      p_user_id: document.user_id,
      p_document_id: document.id
    });
    if (learningInitError) {
      console.warn(`[Phase 6.7] Failed to initialize learning items: ${learningInitError.message}`);
    }

    // 9. Reconcile Credits
    await reconcileCredits(
      supabase,
      { userId: document.user_id, documentId: document.id, operation: 'generate_quiz' },
      job.id,
      ModelRegistry.generate_quiz.model,
      reservationAmount,
      providerUsage
    );

  } catch (error: any) {
    let errorCode = 'UNKNOWN';
    if (error instanceof ValidationError) {
      errorCode = 'VALIDATION_ERROR';
    } else if (error.message.includes('ProviderAdapter') || error.message.includes('GoogleGenAI')) {
      errorCode = 'PROVIDER_ERROR';
    } else if (error.message.includes('Database error')) {
      errorCode = 'DATABASE_ERROR';
    } else if (error.message.includes('Insufficient credits')) {
      errorCode = 'QUOTA_EXCEEDED';
    }

    console.error(`[generateQuiz] Job ${job.id} failed:`, error);

    // Mark job as failed with error code
    await supabase.from('ai_jobs').update({
      status: 'failed',
      error_code: errorCode,
      error_details: error.message
    }).eq('id', job.id);

    // Reconcile credits if provider actually ran but validation/DB failed
    if (providerUsage && reservationAmount > 0) {
      try {
        await reconcileCredits(
          supabase,
          { userId: job.user_id, documentId: job.document_id, operation: 'generate_quiz' },
          job.id,
          ModelRegistry.generate_quiz.model,
          reservationAmount,
          providerUsage
        );
      } catch (e) {
        console.error(`[generateQuiz] Failed to reconcile credits on error for job ${job.id}:`, e);
      }
    } else if (!providerUsage && reservationAmount > 0) {
      // Refund completely if provider didn't run
      try {
        const { BillingService } = await import('@/lib/ai/billing');
        const billing = new BillingService(supabase);
        await billing.recordLedgerEntry({
          userId: job.user_id,
          jobId: job.id,
          entryType: 'REFUND',
          credits: reservationAmount,
          reason: `Refund due to failure before provider: ${error.message}`
        });
      } catch (e) {
         console.error(`[generateQuiz] Failed to refund credits on error for job ${job.id}:`, e);
      }
    }
  }
}
