import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { BillingService } from "./billing";
import { estimateTokens } from "./provider";
import type { AIOperation, AIProvider } from "./config";

export type AIEntitlementContext = {
  userId: string;
  documentId: string;
  operation: Exclude<AIOperation, "extract_text">;
};

/**
 * Reserves credits before generation so concurrent jobs cannot spend the
 * same balance. The reservation is recorded against the unique job ID.
 */
export async function authorizeCredits(
  supabase: ReturnType<typeof createClient<Database>>,
  context: AIEntitlementContext,
  jobId: string,
  model: string,
  inputContent: string
): Promise<number> {
  const billing = new BillingService(supabase);
  const estimatedInputTokens = await estimateTokens(inputContent, context.operation);
  const estimatedOutputTokens = context.operation === "generate_quiz" ? 1500 : 1000;
  const estimatedCost =
    Math.ceil((estimatedInputTokens / 1000) + (estimatedOutputTokens / 1000) * 2) || 1;

  await billing.reserveCredits(
    context.userId,
    jobId,
    estimatedCost,
    `Reserved for ${context.operation} using ${model}`
  );

  return estimatedCost;
}

/**
 * Settles the reservation and records provider usage using the columns that
 * actually exist in ai_usage_logs. Token details belong in usage_metadata;
 * request_id links the telemetry row to its originating AI job.
 */
export async function reconcileCredits(
  supabase: ReturnType<typeof createClient<Database>>,
  context: AIEntitlementContext,
  jobId: string,
  model: string,
  provider: AIProvider,
  reservationAmount: number,
  actualUsage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    thoughtsTokens: number;
  }
): Promise<void> {
  const actualCost =
    Math.ceil(
      actualUsage.inputTokens / 1000 +
      (actualUsage.outputTokens / 1000) * 2 +
      (actualUsage.thoughtsTokens / 1000) * 2
    ) || 1;

  await new BillingService(supabase).finalizeCharge(
    context.userId,
    jobId,
    reservationAmount,
    actualCost,
    `Completed ${context.operation}`
  );

  const { error } = await supabase.from("ai_usage_logs").insert({
    user_id: context.userId,
    operation: context.operation,
    provider,
    model,
    request_id: jobId,
    status: "completed",
    completed_at: new Date().toISOString(),
    usage_metadata: {
      input_tokens: actualUsage.inputTokens,
      output_tokens: actualUsage.outputTokens,
      cached_tokens: actualUsage.cachedTokens,
      thoughts_tokens: actualUsage.thoughtsTokens,
      credits_consumed: actualCost,
    },
  });

  if (error) {
    // Billing has already been settled. Telemetry failure must not trigger a
    // second settlement attempt or mark a successfully generated job failed.
    console.error("[AI usage] Failed to persist usage telemetry:", error);
  }
}
