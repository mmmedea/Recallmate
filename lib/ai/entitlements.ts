import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { BillingService } from "./billing";
import { estimateTokens } from "./provider";

export type AIEntitlementContext = {
  userId: string;
  documentId: string;
  operation: string;
};

/**
 * Validates that the user has enough credits to run the expected job,
 * and records a reservation in the ledger to prevent parallel over-consumption.
 * 
 * Returns the amount reserved.
 */
export async function authorizeCredits(
  supabase: ReturnType<typeof createClient<Database>>,
  context: AIEntitlementContext,
  jobId: string,
  model: string,
  inputContent: string
): Promise<number> {
  const billing = new BillingService(supabase);
  
  // 1. Estimate Tokens (cheap local or API call)
  const estimatedInputTokens = await estimateTokens(model, inputContent);
  
  // 2. We assume some output based on operation (e.g. notes = 1000, quiz = 1500)
  const estimatedOutputTokens = context.operation === 'generate_quiz' ? 1500 : 1000;
  
  // 3. Convert tokens to a credit cost (Example formula: 1 credit per 1000 input tokens + 2 credits per 1000 output tokens)
  const estimatedCost = Math.ceil((estimatedInputTokens / 1000) * 1 + (estimatedOutputTokens / 1000) * 2) || 1;

  // 4. Reserve credits. Will throw if insufficient balance.
  await billing.reserveCredits(context.userId, jobId, estimatedCost, `Reserved for ${context.operation}`);

  return estimatedCost;
}

/**
 * Reconciles the actual usage after execution.
 * Records the exact consumed amount to the usage ledger and updates billing.
 */
export async function reconcileCredits(
  supabase: ReturnType<typeof createClient<Database>>,
  context: AIEntitlementContext,
  jobId: string,
  model: string,
  reservationAmount: number,
  actualUsage: { inputTokens: number; outputTokens: number; cachedTokens: number; thoughtsTokens: number }
): Promise<void> {
  const billing = new BillingService(supabase);

  // 1. Calculate actual cost
  // E.g. cached tokens cost less, thoughts cost output token rates.
  const actualCost = Math.ceil(
    (actualUsage.inputTokens / 1000) * 1 + 
    (actualUsage.outputTokens / 1000) * 2 +
    (actualUsage.thoughtsTokens / 1000) * 2 // Thoughts treated as output
  ) || 1;

  // 2. Finalize charge (refunds reservation, charges actual)
  await billing.finalizeCharge(context.userId, jobId, reservationAmount, actualCost, `Completed ${context.operation}`);

  // 3. Log to immutable usage ledger
  // Note: the original billing.ts has `logUsage` which wrote to ai_usage_logs, but we updated the schema.
  await supabase.from('ai_usage_logs').insert({
    user_id: context.userId,
    job_id: jobId,
    operation: context.operation,
    provider: 'google',
    model,
    input_tokens: actualUsage.inputTokens,
    output_tokens: actualUsage.outputTokens,
    thoughts_tokens: actualUsage.thoughtsTokens,
    cached_tokens: actualUsage.cachedTokens,
    credits_consumed: actualCost,
    status: 'completed',
    created_at: new Date().toISOString()
  });
}
