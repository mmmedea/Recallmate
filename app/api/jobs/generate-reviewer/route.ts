import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ReviewerGenerator } from '@/lib/ai/reviewer-generator';
import { BillingService } from '@/lib/ai/billing';
import crypto from 'crypto';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const requestSchema = z.object({ documentIds: z.array(z.string().uuid()).min(1).max(10), format: z.enum(['docx', 'pdf']), instructions: z.string().max(4000).optional().default('') }).strict();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid reviewer generation request.' }, { status: 400 });
    const { documentIds, format, instructions } = parsed.data;

    // 1. Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ') || authHeader.length > 8192) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.slice(7).trim();
    if (!token || token.includes(' ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await checkRateLimit(user.id);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Reviewer generation is not configured.' }, { status: 503 });

    // 2. Billing Check (Reserve 50 credits per reviewer generation)
    const billingService = new BillingService(supabase);
    const jobId = crypto.randomUUID();
    let creditsReserved = false;

    // 3. Setup Generator
    const generator = new ReviewerGenerator(supabase);
    
    try {
      await billingService.reserveCredits(user.id, jobId, 50, "Reserve: Generate Reviewer");
      creditsReserved = true;

      // 4. Generate Structured Document (or hit cache)
      const { reviewerDocument, documentId, idempotencyHash } = await generator.generate({
        userId: user.id,
        documentIds,
        format,
        instructions
      });

      // 5. Check if THIS format is already rendered
      const { data: existingOutput } = await supabase
        .from('reviewer_outputs')
        .select('storage_path, file_size, id')
        .eq('user_id', user.id)
        .eq('idempotency_hash', idempotencyHash)
        .eq('format', format)
        .maybeSingle();

      if (existingOutput && existingOutput.file_size !== null) {
        await billingService.finalizeCharge(user.id, jobId, 50, 0, "Cache hit: Reviewer fully rendered already");
        return NextResponse.json({ success: true, storagePath: existingOutput.storage_path, cached: true });
      }

      // Create output record
      const storagePath = `${user.id}/${crypto.randomUUID()}.${format}`;
      let outputId = existingOutput?.id;

      if (!existingOutput) {
         const { data: outRecord, error: insertError } = await supabase.from('reviewer_outputs').insert({
            user_id: user.id,
            reviewer_document_id: documentId,
            format,
            storage_path: storagePath,
            idempotency_hash: idempotencyHash,
            renderer_version: '1.0-pending',
            layout_version: '1.0-pending'
         }).select('id').single();
         if (insertError) throw new Error("Failed to create reviewer output record: " + insertError.message);
         outputId = outRecord?.id;
      }

      // 6. Invoke Isolated Renderer Route
      let rendererUrl = "";
      let rendererSecret = process.env.CRON_SECRET;
      
      if (format === 'pdf') {
        if (!process.env.PDF_WORKER_URL) {
          throw new Error("PDF Worker URL is not configured. PDFs are currently unavailable.");
        }
        rendererUrl = process.env.PDF_WORKER_URL;
        rendererSecret = process.env.WORKER_SECRET || process.env.CRON_SECRET;
      } else {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!baseUrl) throw new Error('NEXT_PUBLIC_APP_URL is not configured.');
        const parsedBaseUrl = new URL(baseUrl);
        if (parsedBaseUrl.protocol !== 'https:' && parsedBaseUrl.hostname !== 'localhost') throw new Error('Invalid application URL configuration.');
        rendererUrl = new URL('/api/jobs/render', parsedBaseUrl).toString();
      }

      if (!rendererSecret || rendererSecret.length < 32) throw new Error('Renderer secret is not configured securely.');

      // Sign the payload so worker trusts us
      const payloadString = JSON.stringify({
        reviewerOutputId: outputId,
        storagePath,
        format,
        user_id: user.id,
        reviewerDocument
      });
      const signature = crypto.createHmac('sha256', rendererSecret!).update(payloadString).digest('hex');

      const renderRes = await fetch(rendererUrl, {
        method: 'POST',
        signal: AbortSignal.timeout(120_000),
        headers: {
          'Content-Type': 'application/json',
          'X-Worker-Signature': signature
        },
        body: payloadString
      });

      const renderData = await renderRes.json();
      
      if (!renderRes.ok) {
        throw new Error(renderData.error || "Renderer worker failed");
      }

      // 10. Finalize Charge
      await billingService.finalizeCharge(user.id, jobId, 50, 50, "Completed Reviewer Generation");

      return NextResponse.json({ success: true, storagePath: renderData.storagePath });

    } catch (err: any) {
      if (creditsReserved) {
        await billingService.finalizeCharge(user.id, jobId, 50, 0, "Failed Reviewer Generation - Refunded");
      }
      throw err;
    }

  } catch (error: any) {
    const status = Number.isInteger(error?.status) ? error.status : error?.message === 'Rate limit exceeded' ? 429 : 500;
    if (status >= 500) console.error('[generate-reviewer] failed:', error);
    return NextResponse.json({ error: status === 429 ? 'Rate limit exceeded. Please try again later.' : status === 401 ? 'Unauthorized' : 'Reviewer generation failed.' }, { status });
  }
}
