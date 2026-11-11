import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderReviewerDocx } from '@/lib/renderer/docx';
import { GeneratedReviewerDocument } from '@/lib/ai/schemas';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const payloadString = await req.text();
    const signature = req.headers.get('x-worker-signature');
    const expectedSignature = crypto.createHmac('sha256', process.env.CRON_SECRET!).update(payloadString).digest('hex');

    if (!signature || signature !== expectedSignature) {
      return NextResponse.json({ error: "Unauthorized Signature" }, { status: 401 });
    }

    const { reviewerDocument, format, user_id, storagePath, reviewerOutputId } = JSON.parse(payloadString);

    if (format !== 'docx') {
      return NextResponse.json({ error: "Only DOCX rendering is supported currently." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Render Binary
    let binaryBuffer: Buffer;
    binaryBuffer = await renderReviewerDocx(reviewerDocument as GeneratedReviewerDocument);
    
    const { error: uploadError } = await supabase.storage
      .from('reviewers')
      .upload(storagePath, binaryBuffer, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: true });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    // Save Output Record
    await supabase.from('reviewer_outputs').update({
      renderer_version: '1.0',
      layout_version: '1.0',
      file_size: binaryBuffer.byteLength
    }).eq('id', reviewerOutputId);

    return NextResponse.json({ success: true, storagePath });
  } catch (error: any) {
    console.error("[render worker]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
