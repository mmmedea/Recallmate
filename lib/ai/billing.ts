import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

export type LedgerEntryType = 'RESERVATION' | 'CHARGE' | 'REFUND' | 'ADJUSTMENT';

export interface LedgerEntry {
  userId: string;
  jobId?: string;
  entryType: LedgerEntryType;
  credits: number; // positive means granting/refunding credits to user, negative means charging/reserving
  reason?: string;
}

export class BillingService {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient;
  }

  // Atomically writes to the ledger
  async recordLedgerEntry(entry: LedgerEntry): Promise<string> {
    const { data, error } = await this.supabase
      .from('ai_credit_ledger')
      .insert({
        user_id: entry.userId,
        job_id: entry.jobId || null,
        entry_type: entry.entryType,
        credits: entry.credits,
        reason: entry.reason
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error("Failed to record ledger entry:", error);
      throw new Error("Billing failure: Could not record ledger entry.");
    }

    return data.id;
  }

  // Helper for reserving credits
  async reserveCredits(userId: string, jobId: string, estimatedCost: number, reason: string = "Reservation for AI generation"): Promise<string> {
    // Check balance first
    const balance = await this.getUserBalance(userId);
    if (balance < estimatedCost) {
      throw new Error(`Insufficient credits. Required: ${estimatedCost}, Available: ${balance}`);
    }

    // Reservation is negative credits
    return this.recordLedgerEntry({
      userId,
      jobId,
      entryType: 'RESERVATION',
      credits: -estimatedCost,
      reason
    });
  }

  // Finalizes the charge by first refunding the reservation and applying the actual charge
  // Or simply applying an adjustment. Let's do Refund + Charge for strict auditable ledger.
  async finalizeCharge(userId: string, jobId: string, reservationAmount: number, actualCost: number, reason: string = "Finalized AI charge"): Promise<void> {
    // 1. Idempotency Check: Prevent duplicate finalization
    const { data: existingCharge } = await this.supabase
      .from('ai_credit_ledger')
      .select('id')
      .eq('job_id', jobId)
      .eq('entry_type', 'CHARGE')
      .maybeSingle();

    if (existingCharge) {
      console.log(`[Billing] Charge for job ${jobId} already finalized. Skipping.`);
      return;
    }

    // 2. Refund the exact reservation amount
    await this.recordLedgerEntry({
      userId,
      jobId,
      entryType: 'REFUND',
      credits: reservationAmount,
      reason: `Refund reservation for ${jobId}`
    });

    // 3. Apply actual charge
    await this.recordLedgerEntry({
      userId,
      jobId,
      entryType: 'CHARGE',
      credits: -actualCost,
      reason
    });
  }

  // Get current sum of credits
  async getUserBalance(userId: string): Promise<number> {
    // We could do this securely via an RPC or we can do it via a quick sum if we have service_role
    // Note: for production with huge ledgers, an RPC or materialized view is better.
    const { data, error } = await this.supabase
      .from('ai_credit_ledger')
      .select('credits')
      .eq('user_id', userId);
      
    if (error) {
       return 0;
    }
    
    return data.reduce((sum, row) => sum + (row.credits || 0), 0);
  }

  // Telemetry
  async logUsage(log: {
    userId: string;
    operation: string;
    provider: string;
    model: string;
    jobId?: string;
    requestId?: string;
    status: string;
    usageMetadata: any;
  }): Promise<void> {
    await this.supabase.from('ai_usage_logs').insert({
      user_id: log.userId,
      operation: log.operation,
      provider: log.provider,
      model: log.model,
      request_id: log.requestId,
      status: log.status,
      completed_at: log.status === 'completed' ? new Date().toISOString() : null,
      usage_metadata: log.usageMetadata
    });
  }
}
