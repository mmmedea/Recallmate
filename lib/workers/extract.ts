import { processFileServerSide } from '@/lib/server-parser';
import { orchestrateGeneration } from './orchestrator';

export async function handleExtractText(supabase: any, job: any) {
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', job.document_id)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    if (document.status === 'cancelled') {
       await supabase.from('ai_jobs').update({ status: 'cancelled' }).eq('id', job.id);
       return;
    }

    await supabase.from('documents').update({ status: 'extracting' }).eq('id', document.id);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('study_materials')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download file from storage');
    }

    const { data: checkDoc } = await supabase.from('documents').select('status').eq('id', document.id).single();
    if (checkDoc?.status === 'cancelled') {
      await supabase.from('ai_jobs').update({ status: 'cancelled' }).eq('id', job.id);
      return;
    }

    await supabase.from('documents').update({ status: 'analyzing' }).eq('id', document.id);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    
    // Extract text and chunk
    const chunks = await processFileServerSide(buffer, document.content_type, document.filename.match(/\.[0-9a-z]+$/i)?.[0] || '');
      
    const { data: checkDoc2 } = await supabase.from('documents').select('status').eq('id', document.id).single();
    if (checkDoc2?.status === 'cancelled') {
      await supabase.from('ai_jobs').update({ status: 'cancelled' }).eq('id', job.id);
      return;
    }

    await supabase.from('documents').update({ status: 'generating' }).eq('id', document.id);

    // Store chunks transactionally (clean up old chunks first in case of retry)
    await supabase.from('document_chunks').delete().eq('document_id', document.id);

    const chunksToInsert = chunks.map((chunk: any) => ({
      document_id: document.id,
      chunk_index: chunk.chunk_index,
      page_number: chunk.page_number,
      section_title: chunk.section_title,
      content: chunk.content,
      metadata: chunk.metadata
    }));

    if (chunksToInsert.length > 0) {
      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert(chunksToInsert);
        
      if (chunkError) {
        throw new Error('Failed to insert document chunks: ' + chunkError.message);
      }
    }

    const { data: checkDoc3 } = await supabase.from('documents').select('status').eq('id', document.id).single();
    if (checkDoc3?.status === 'cancelled') {
      await supabase.from('ai_jobs').update({ status: 'cancelled' }).eq('id', job.id);
      return;
    }

    // Complete Job
    await supabase.from('ai_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', job.id);
    await supabase.from('documents').update({ status: 'completed' }).eq('id', document.id);

    // Phase 6.4: Orchestrate follow-on generations based on user preferences.
    await orchestrateGeneration(supabase, document.user_id, document.id);
}

// Updated for Phase 6.4.1 auto_generate preference
