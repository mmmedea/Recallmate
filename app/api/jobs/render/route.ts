import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderReviewerPdf } from '@/lib/renderer/pdf';
import { renderReviewerDocx } from '@/lib/renderer/docx';
import { GeneratedReviewerDocument } from '@/lib/ai/schemas';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { reviewerDocument, format, user_id, idempotencyHash } = await req.json();

    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Render Binary
    let binaryBuffer: Buffer;
    if (format === 'pdf') {
      binaryBuffer = await renderReviewerPdf(reviewerDocument as GeneratedReviewerDocument);
    } else {
      binaryBuffer = await renderReviewerDocx(reviewerDocument as GeneratedReviewerDocument);
    }

    // Store in Supabase
    const fileName = `${crypto.randomUUID()}.${format}`;
    const storagePath = `${user_id}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('reviewers')
      .upload(storagePath, binaryBuffer, { contentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    // Find ReviewerDocument ID to link
    const { data: docRecord } = await supabase.from('reviewer_documents')
       .select('id').eq('user_id', user_id).order('created_at', { ascending: false }).limit(1).single();

    // Save Output Record
    await supabase.from('reviewer_outputs').insert({
      user_id,
      reviewer_document_id: docRecord?.id,
      format,
      storage_path: storagePath,
      renderer_version: '1.0',
      layout_version: '1.0',
      idempotency_hash: idempotencyHash,
      file_size: binaryBuffer.byteLength
    });

    return NextResponse.json({ success: true, storagePath });
  } catch (error: any) {
    console.error("[render worker]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
