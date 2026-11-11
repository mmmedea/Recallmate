import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Orchestrates the follow-on AI generation steps after a document is extracted.
 * Reads the user's auto_generate preference and queues jobs accordingly.
 */
export async function orchestrateGeneration(supabase: SupabaseClient, userId: string, documentId: string) {
    // 1. Read user preferences for auto_generate
    const { data: prefs, error: prefsError } = await supabase
        .from('preferences')
        .select('auto_generate')
        .eq('user_id', userId)
        .single();

    if (prefsError && prefsError.code !== 'PGRST116') {
        console.error('[ORCHESTRATOR] Failed to fetch preferences:', prefsError);
        // Default to true if preference table exists but errors
    }

    // Default is true if row not found (PGRST116) or missing
    const shouldAutoGenerate = prefs?.auto_generate ?? true;

    if (!shouldAutoGenerate) {
        console.log(`[ORCHESTRATOR] User ${userId} has auto_generate=false. Skipping automatic generation for document ${documentId}.`);
        return;
    }

    console.log(`[ORCHESTRATOR] Auto-generating notes and quiz for document ${documentId}.`);

    // 2. Queue follow-on jobs (using generation_version 1 for initial generation)
    const { error: insertError } = await supabase.from('ai_jobs').insert([
        {
            user_id: userId,
            document_id: documentId,
            operation: 'generate_notes',
            status: 'queued',
            idempotency_key: `generate_notes_${documentId}`,
            generation_version: 1
        },
        {
            user_id: userId,
            document_id: documentId,
            operation: 'generate_quiz',
            status: 'queued',
            idempotency_key: `generate_quiz_${documentId}`,
            generation_version: 1
        }
    ]);

    if (insertError) {
        // Log but don't fail the extraction job, the user can manually retry
        console.error('[ORCHESTRATOR] Failed to queue generation jobs:', insertError);
    }
}
