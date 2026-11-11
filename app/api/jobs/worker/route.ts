import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleExtractText } from '@/lib/workers/extract';
import { handleGenerateNotes } from '@/lib/workers/generateNotes';
import { handleGenerateQuiz } from '@/lib/workers/generateQuiz';

export async function GET(req: NextRequest) {
  return executeWorker(req);
}

export async function POST(req: NextRequest) {
  return executeWorker(req);
}

async function executeWorker(req: NextRequest) {
  try {
    // 1. Authentication
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${cronSecret}`) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Service Role Client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Deliver due calendar reminders as in-app notifications. The cron runs this
    // endpoint; browser notifications remain an explicit client opt-in.
    const now = new Date().toISOString();
    const { data: reminders } = await supabase
      .from('calendar_reminders')
      .select('id,event_id,user_id,calendar_events(title, starts_at)')
      .is('delivered_at', null)
      .lte('remind_at', now)
      .limit(100);
    for (const reminder of reminders || []) {
      const event = Array.isArray(reminder.calendar_events) ? reminder.calendar_events[0] : reminder.calendar_events;
      if (!event) continue;
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: reminder.user_id,
        event_id: reminder.event_id,
        title: `Upcoming: ${event.title}`,
        body: `Scheduled for ${new Date(event.starts_at).toLocaleString()}`,
        kind: 'calendar',
      });
      if (!notificationError) await supabase.from('calendar_reminders').update({ delivered_at: now }).eq('id', reminder.id);
    }
    
    // Stale Job Recovery
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await supabase
      .from('ai_jobs')
      .update({ status: 'queued' })
      .eq('status', 'processing')
      .lt('started_at', fifteenMinsAgo);

    // Cleanup abandoned uploads
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await supabase
      .from('documents')
      .delete()
      .eq('status', 'uploaded')
      .lt('created_at', oneHourAgo);

    // Claim a job atomically
    const { data: jobs, error: claimError } = await supabase.rpc('claim_ai_job');

    if (claimError) {
      console.error('[WORKER] Failed to claim job:', claimError);
      return NextResponse.json({ error: 'Failed to claim job' }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ message: 'No queued jobs found' });
    }

    const job = jobs[0];
    console.log(`[WORKER] Claimed job ${job.id} for document ${job.document_id} [Operation: ${job.operation}]`);

    try {
      // Dispatch operation
      switch (job.operation) {
        case 'extract_text':
          await handleExtractText(supabase, job);
          break;
        case 'generate_notes':
          await handleGenerateNotes(supabase, job);
          break;
        case 'generate_quiz':
          await handleGenerateQuiz(supabase, job);
          break;
        default:
          throw new Error(`Unknown operation: ${job.operation}`);
      }

      return NextResponse.json({ success: true, jobId: job.id, operation: job.operation });
    } catch (operationError: any) {
      await failJob(supabase, job.id, job.document_id, operationError.message, job.operation);
      return NextResponse.json({ error: operationError.message }, { status: 500 });
    }

  } catch (err: any) {
    console.error('[WORKER] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
  }
}

async function failJob(supabase: any, jobId: string, documentId: string, errorMessage: string, operation: string) {
  let errorCode = 'PROCESSING_FAILED';
  if (errorMessage.includes('Unsupported file type')) {
    errorCode = 'UNSUPPORTED_FILE';
  }
  
  await supabase.from('ai_jobs').update({ status: 'failed' }).eq('id', jobId);
  
  // If the initial extraction fails, mark the document as failed
  if (operation === 'extract_text') {
    await supabase.from('documents').update({ status: 'failed', error_message: errorMessage, error_code: errorCode }).eq('id', documentId);
  }
}
