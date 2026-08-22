import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ReviewerGenerator } from '@/lib/ai/reviewer-generator';
import { renderReviewerPdf } from '@/lib/renderer/pdf';
import { renderReviewerDocx } from '@/lib/renderer/docx';
import { BillingService } from '@/lib/ai/billing';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { documentIds, format } = await req.json();

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: "Missing documentIds" }, { status: 400 });
    }

    if (format !== 'pdf' && format !== 'docx') {
      return NextResponse.json({ error: "Format must be pdf or docx" }, { status: 400 });
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
    
    // We execute inside a try/catch to refund credits on failure
    try {
      await billingService.reserveCredits(user.id, jobId, 50, "Reserve: Generate Reviewer");
      creditsReserved = true;

      // 4. Generate Structured Document (or hit cache)
      const { reviewerDocument, idempotencyHash } = await generator.generate({
        userId: user.id,
        documentIds,
        format
      });

      // 5. Check if THIS format is already rendered
      const { data: existingOutput } = await supabase
        .from('reviewer_outputs')
        .select('storage_path')
        .eq('user_id', user.id)
        .eq('idempotency_hash', idempotencyHash)
        .eq('format', format)
        .maybeSingle();

      if (existingOutput) {
        await billingService.finalizeCharge(user.id, jobId, 50, 0, "Cache hit: Reviewer fully rendered already");
        return NextResponse.json({ success: true, storagePath: existingOutput.storage_path, cached: true });
      }

      // 6. Render Binary
      let binaryBuffer: Buffer;
      if (format === 'pdf') {
        binaryBuffer = await renderReviewerPdf(reviewerDocument);
      } else {
        binaryBuffer = await renderReviewerDocx(reviewerDocument);
      }

      // 7. Store in Supabase
      const fileName = `${crypto.randomUUID()}.${format}`;
      const storagePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('reviewers')
        .upload(storagePath, binaryBuffer, { contentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // 8. Find ReviewerDocument ID to link
      const { data: docRecord } = await supabase.from('reviewer_documents')
         .select('id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();

      // 9. Save Output Record
      await supabase.from('reviewer_outputs').insert({
        user_id: user.id,
        reviewer_document_id: docRecord?.id,
        format,
        storage_path: storagePath,
        renderer_version: '1.0',
        layout_version: '1.0',
        idempotency_hash: idempotencyHash,
        file_size: binaryBuffer.byteLength
      });

      // 10. Finalize Charge
      await billingService.finalizeCharge(user.id, jobId, 50, 50, "Completed Reviewer Generation");

      return NextResponse.json({ success: true, storagePath });

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
