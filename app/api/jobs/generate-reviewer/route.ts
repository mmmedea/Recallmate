import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ReviewerGenerator } from '@/lib/ai/reviewer-generator';
import { BillingService } from '@/lib/ai/billing';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { documentIds, format } = await req.json();

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: "Missing documentIds" }, { status: 400 });
    }

    if (format !== 'docx' && format !== 'pdf') {
      return NextResponse.json({ error: "Invalid format. Must be pdf or docx." }, { status: 400 });
    }

    // 1. Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (req.headers.get('host') ? `https://${req.headers.get('host')}` : 'http://localhost:3000');
        rendererUrl = `${baseUrl}/api/jobs/render`;
      }

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
    console.error("[generate-reviewer]", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
