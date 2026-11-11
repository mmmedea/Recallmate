import { NextRequest, NextResponse } from 'next/server';
import { ReviewerGenerator } from '@/lib/ai/reviewer-generator';
import { ReviewerAIConfigurationError, assertReviewerAIConfigured } from '@/lib/ai/config';
import { SUPABASE_ADMIN_CONFIG_ERROR_CODE, createSupabaseAdminClient, isSupabaseAdminConfigError } from '@/lib/supabase/admin';
import { getTrustedDocumentSizesBytes } from '@/lib/economy/server';
import { getReviewerCoinCostForDocuments } from '@/lib/economy/rules';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { documentIds, format, reviewerOptions = {} } = await req.json();

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
    const supabase = createSupabaseAdminClient<any>();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reviewerFileSizes = await getTrustedDocumentSizesBytes(user.id, documentIds);
    const reviewerCoinCost = getReviewerCoinCostForDocuments(reviewerFileSizes);
    const requestIdempotencyKey = req.headers.get('idempotency-key') || crypto.randomUUID();
    const reservationKey = crypto
      .createHash('sha256')
      .update(JSON.stringify({ userId: user.id, documentIds, format, reviewerOptions, reviewerFileSizes, requestIdempotencyKey }))
      .digest('hex');
    let coinsReserved = false;
    let outputId: string | undefined;
    assertReviewerAIConfigured();

    // 3. Setup Generator
    const generator = new ReviewerGenerator(supabase);
    
    try {
      const { error: reserveError } = await supabase.rpc('reserve_reviewer_generation', {
        p_user_id: user.id,
        p_file_size_bytes: reviewerFileSizes.reduce((sum, size) => sum + size, 0),
        p_idempotency_key: `reviewer-reserve:${reservationKey}`,
        p_document_ids: documentIds,
        p_format: format,
      });

      if (reserveError) {
        throw new Error(`Reviewer billing failed: ${reserveError.message}`);
      }
      coinsReserved = true;

      // 4. Generate Structured Document (or hit cache)
      const { reviewerDocument, documentId, idempotencyHash, generationMetadata } = await generator.generate({
        userId: user.id,
        documentIds,
        format,
        reviewerOptions
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
        await supabase.rpc('finalize_reviewer_generation', {
          p_user_id: user.id,
          p_reservation_key: `reviewer-reserve:${reservationKey}`,
          p_success: true,
          p_idempotency_key: `reviewer-finalize:${reservationKey}`,
        });
        return NextResponse.json({ success: true, storagePath: existingOutput.storage_path, cached: true });
      }

      // Create output record
      const storagePath = `${user.id}/${crypto.randomUUID()}.${format}`;
      outputId = existingOutput?.id;

      if (!existingOutput) {
         const { data: outRecord, error: insertError } = await supabase.from('reviewer_outputs').insert({
            user_id: user.id,
            reviewer_document_id: documentId,
            format,
            storage_path: storagePath,
            idempotency_hash: idempotencyHash,
            renderer_version: '1.0-pending',
            layout_version: '1.0-pending',
            status: 'rendering',
            economy_reservation_key: `reviewer-reserve:${reservationKey}`,
            coin_cost: reviewerCoinCost,
            metadata: {
              jobState: 'rendering',
              fileSizeBytes: reviewerFileSizes.reduce((sum, size) => sum + size, 0),
              sourceDocuments: documentIds.length,
              finalCoinPrice: reviewerCoinCost,
              generation: generationMetadata || null,
            },
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

      await supabase.rpc('finalize_reviewer_generation', {
        p_user_id: user.id,
        p_reservation_key: `reviewer-reserve:${reservationKey}`,
        p_success: true,
        p_idempotency_key: `reviewer-finalize:${reservationKey}`,
      });

      if (outputId) {
        await supabase.from('reviewer_outputs').update({
          status: 'completed',
        }).eq('id', outputId);
      }

      return NextResponse.json({ success: true, storagePath: renderData.storagePath });

    } catch (err: any) {
      console.error("[generate-reviewer] failed", err);
      if (coinsReserved) {
        await supabase.rpc('finalize_reviewer_generation', {
          p_user_id: user.id,
          p_reservation_key: `reviewer-reserve:${reservationKey}`,
          p_success: false,
          p_idempotency_key: `reviewer-refund:${reservationKey}`,
        });
      }
      if (outputId) {
        await supabase.from('reviewer_outputs').update({
          status: 'refunded',
          metadata: {
            jobState: 'refunded',
            failure: err?.message || "Reviewer generation failed",
            refunded: coinsReserved,
          },
        }).eq('id', outputId);
      }
      throw err;
    }

  } catch (error: any) {
    console.error("[generate-reviewer]", error);
    if (isSupabaseAdminConfigError(error)) {
      return NextResponse.json(
        { error: "This operation is temporarily unavailable. Please try again later.", code: SUPABASE_ADMIN_CONFIG_ERROR_CODE },
        { status: 503 },
      );
    }
    if (error instanceof ReviewerAIConfigurationError) {
      return NextResponse.json(
        { error: "Reviewer Maker is temporarily unavailable. Your coins were not charged.", code: "REVIEWER_AI_UNAVAILABLE" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
