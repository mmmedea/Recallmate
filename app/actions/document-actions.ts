'use server'

import { requireUser, requireEntitlement, checkRateLimit, SecurityError } from '@/lib/security'
import { UploadDocumentSchema } from '@/lib/validations'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

export async function createDocumentUploadSession(payload: { fileName: string; fileSize: number; contentType: string }) {
  try {
    const { supabase, user } = await requireUser()
    const validatedData = UploadDocumentSchema.parse(payload)
    await requireEntitlement()

    await checkRateLimit(`document-upload:${user.id}`, { limit: 10, windowSeconds: 60 }) 

    const documentId = uuidv4()
    
    // Sanitize filename
    const sanitizedName = validatedData.fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const storagePath = `${user.id}/${documentId}/${sanitizedName}`

    const { data: document, error } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        user_id: user.id,
        filename: validatedData.fileName,
        title: validatedData.fileName,
        storage_path: storagePath,
        content_type: validatedData.contentType,
        status: 'uploaded', // Initial state
      })
      .select()
      .single()

    if (error) throw error

    console.log(`[AUDIT] User ${user.id} initiated document upload session for ${documentId}`)
    return { success: true, documentId, storagePath }
  } catch (error: any) {
    console.error('[AUDIT] Failed document creation:', error.message)
    if (error instanceof SecurityError) {
      return { error: error.message, status: error.status }
    }
    if (error?.code === '42501') {
      return { error: 'Your account could not create this upload. Please refresh your session and try again.', status: 403 }
    }
    return { error: error?.message || 'The upload could not be created.', status: 500 }
  }
}

export async function confirmDocumentUpload(documentId: string, idempotencyKey: string) {
  try {
    const { supabase, user } = await requireUser()
    await checkRateLimit(`confirm-upload:${user.id}`, { limit: 10, windowSeconds: 60 })
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      throw new SecurityError('Invalid upload confirmation request', 400)
    }
    
    // Check ownership and current status
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docError || !document) throw new SecurityError('Document not found or unauthorized', 404)
    if (document.status !== 'uploaded' && document.status !== 'failed' && document.status !== 'cancelled') {
       throw new SecurityError(`Document is currently in ${document.status} state`, 400)
    }

    // Verify file exists and get size without downloading the entire file into Vercel memory
    const pathParts = document.storage_path.split('/');
    const fileName = pathParts.pop();
    const folderPath = pathParts.join('/');
    
    const { data: files, error: listError } = await supabase
      .storage
      .from('study_materials')
      .list(folderPath, {
        search: fileName
      });

    if (listError || !files || files.length === 0) {
      throw new SecurityError('Uploaded file not found in storage', 404);
    }
    
    const uploadedFile = files.find(f => f.name === fileName);
    if (!uploadedFile) {
      throw new SecurityError('Uploaded file not found in storage', 404);
    }

    const size = uploadedFile.metadata?.size || 0;
    if (size === 0) throw new SecurityError('File is empty', 400);
    if (size > 10 * 1024 * 1024) throw new SecurityError('File exceeds 10MB limit', 400);

    // Execute the service-role-only atomic RPC after the authenticated ownership and storage checks above.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !supabaseUrl) throw new SecurityError('Upload confirmation is not configured', 503)
    const admin = createAdminClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: jobId, error: rpcError } = await admin
      .rpc('confirm_document_upload', {
        p_document_id: documentId,
        p_user_id: user.id,
        p_idempotency_key: idempotencyKey
      })

    if (rpcError) {
      throw new Error(`Failed to confirm upload: ${rpcError.message}`)
    }

    console.log(`[AUDIT] User ${user.id} atomically confirmed upload for ${documentId}, job queued`)
    return { success: true, documentId, jobId: jobId }

  } catch (error: any) {
    console.error('[AUDIT] Failed upload confirmation:', error.message)
    
    if (error instanceof SecurityError) {
      return { error: error.message, status: error.status }
    }
    return { error: error.message || 'Internal Server Error', status: 500 }
  }
}

export async function getDocumentStatus(documentId: string) {
  try {
    const { supabase, user } = await requireUser()
    const { data: document, error } = await supabase
      .from('documents')
      .select('status, error_message')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (error || !document) throw new Error('Document not found')
    
    return { success: true, status: document.status, error: document.error_message }
  } catch (error: any) {
    return { error: error.message || 'Internal Server Error' }
  }
}

export async function cancelDocumentProcessing(documentId: string) {
  try {
    const { supabase, user } = await requireUser()
    
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('status, storage_path')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()
      
    if (docError || !document) throw new SecurityError('Document not found', 404)
    
    if (['completed', 'failed', 'cancelled'].includes(document.status)) {
       throw new SecurityError(`Cannot cancel document in ${document.status} state`, 400)
    }

    const { error } = await supabase
      .from('documents')
      .update({ status: 'cancelled' })
      .eq('id', documentId)
      
    if (error) throw error
    
    // Attempt to clean up storage if possible
    if (document.storage_path) {
      await supabase.storage.from('study_materials').remove([document.storage_path])
    }
    
    return { success: true }
  } catch (error: any) {
    if (error instanceof SecurityError) {
      return { error: error.message, status: error.status }
    }
    return { error: 'Internal Server Error' }
  }
}

import { DocumentLifecycleSummary, computeDocumentLifecycleSummary } from './document-lifecycle'

export async function getDocumentLifecycle(documentId: string): Promise<{ success: boolean; data?: DocumentLifecycleSummary; error?: string; status?: number }> {
  try {
    const { supabase, user } = await requireUser()
    
    // Fetch document and related jobs/outputs
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(`
        id, filename, created_at, status, error_message,
        ai_jobs ( id, operation, status ),
        notes ( id ),
        questions ( id ),
        conversations ( updated_at )
      `)
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docError || !document) throw new SecurityError('Document not found', 404)

    const summary = computeDocumentLifecycleSummary(
      document,
      document.ai_jobs || [],
      (document.notes as any[])?.[0]?.id || null,
      (document.questions as any[])?.[0]?.id || null,
      (document.conversations as any[])?.[0]?.updated_at || null
    )

    return { success: true, data: summary }
  } catch (error: any) {
    if (error instanceof SecurityError) {
      return { success: false, error: error.message, status: error.status }
    }
    return { success: false, error: 'Internal Server Error' }
  }
}

export async function getRecentDocuments(): Promise<{ success: boolean; data?: DocumentLifecycleSummary[]; error?: string }> {
  try {
    const { supabase, user } = await requireUser()
    
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        id, filename, created_at, status, error_message,
        ai_jobs ( id, operation, status ),
        notes ( id ),
        questions ( id ),
        conversations ( updated_at )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    const summaries = (documents || []).map(doc => 
      computeDocumentLifecycleSummary(
        doc,
        doc.ai_jobs || [],
        (doc.notes as any[])?.[0]?.id || null,
        (doc.questions as any[])?.[0]?.id || null,
        (doc.conversations as any[])?.[0]?.updated_at || null
      )
    )

    return { success: true, data: summaries }
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' }
  }
}

export async function retryDocumentExtraction(documentId: string) {
  try {
    const { supabase, user } = await requireUser();
    
    // 1. Check current document state and chunks (for inconsistency)
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select(`
        id, status,
        document_chunks ( id )
      `)
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();
      
    if (docError || !docData) throw new SecurityError('Document not found', 404);
    
    const hasChunks = docData.document_chunks && docData.document_chunks.length > 0;
    const isFailed = ['failed', 'cancelled'].includes(docData.status);
    const isInconsistent = docData.status === 'completed' && !hasChunks;
    
    if (!isFailed && !isInconsistent) {
      // Already queued, extracting, or truly completed. Safe idempotent return.
      return { success: true }; 
    }
    
    // Atomic update of document status
    const { data: updatedDoc, error: updateError } = await supabase
      .from('documents')
      .update({ status: 'queued', error_message: null })
      .eq('id', documentId)
      .eq('status', docData.status) // Atomic concurrency check (must still be in the state we saw)
      .select('id');
      
    if (updateError) throw updateError;
    
    // We update the extraction job to 'queued' unconditionally for this document ID,
    // handling cases where it was failed, cancelled, or incorrectly marked completed.
    await supabase
      .from('ai_jobs')
      .update({ status: 'queued', error_message: null })
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .eq('operation', 'extract_text')
      .in('status', ['failed', 'cancelled', 'completed']);
        
    return { success: true };
    
  } catch (error: any) {
    if (error instanceof SecurityError) {
      return { success: false, error: error.message, status: error.status };
    }
    return { success: false, error: 'Internal Server Error' };
  }
}

export async function retryStudyGeneration(documentId: string, operation: 'generate_notes' | 'generate_quiz') {
  try {
    const { supabase, user } = await requireUser();
    
    // 1. Verify operation allowlist strictly at runtime
    if (operation !== 'generate_notes' && operation !== 'generate_quiz') {
      throw new SecurityError('Invalid operation', 400);
    }

    // 2. Verify ownership and get document extraction status
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('status')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) throw new SecurityError('Document not found', 404);
    if (document.status !== 'completed') {
      throw new SecurityError('Cannot generate study materials until document extraction is completed', 400);
    }

    // 2. Check billing / rate limits for this operation
    await checkRateLimit(user.id);

    // 3. Concurrency-safe Idempotency Strategy
    // First, try to update an existing failed/cancelled job (same generation version)
    const { data: updatedJobs, error: updateError } = await supabase
      .from('ai_jobs')
      .update({ status: 'queued', error_message: null })
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .eq('operation', operation)
      .in('status', ['failed', 'cancelled'])
      .select();

    if (updateError) throw updateError;
    if (updatedJobs && updatedJobs.length > 0) {
      console.log(`[AUDIT] User ${user.id} retried existing ${operation} job for ${documentId}`);
      return { success: true, jobId: updatedJobs[0].id };
    }

    // 4. If no job was updated, check its current state and outputs for INCONSISTENT recovery
    const { data: docData, error: selectError } = await supabase
      .from('documents')
      .select(`
        ai_jobs ( id, status, operation ),
        notes ( id ),
        questions ( id )
      `)
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (selectError) throw selectError;

    const existingJob = (docData.ai_jobs || []).find((j: any) => j.operation === operation);

    if (existingJob) {
      if (['queued', 'processing'].includes(existingJob.status)) {
        // Already in progress, idempotent success
        return { success: true, jobId: existingJob.id }; 
      }
      
      if (existingJob.status === 'completed') {
        const hasNotes = docData.notes && docData.notes.length > 0;
        const hasQuiz = docData.questions && docData.questions.length > 0;
        const hasOutput = operation === 'generate_notes' ? hasNotes : hasQuiz;
        
        if (hasOutput) {
          // Truly completed and output exists, idempotent success
          return { success: true, jobId: existingJob.id };
        } else {
          // INCONSISTENT: completed but no output. Attempt safe atomic recovery.
          const { data: recoveredJobs, error: recoverError } = await supabase
            .from('ai_jobs')
            .update({ status: 'queued', error_message: null })
            .eq('id', existingJob.id)
            .eq('user_id', user.id)
            .eq('status', 'completed') // Concurrency lock: only update if still 'completed'
            .select();
            
          if (recoverError) throw recoverError;
          console.log(`[AUDIT] User ${user.id} safely recovered INCONSISTENT ${operation} job for ${documentId}`);
          return { success: true, jobId: existingJob.id };
        }
      }
    } else {
      // 5. Job doesn't exist (e.g. auto_generate was false). INSERT a new job (version 1)
      const idempotencyKey = `${operation}_${documentId}`;
      const { data: newJob, error: insertError } = await supabase
        .from('ai_jobs')
        .insert({
          user_id: user.id,
          document_id: documentId,
          operation: operation,
          status: 'queued',
          idempotency_key: idempotencyKey,
          generation_version: 1
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') { 
           // Race condition: another request inserted it just now
           return { success: true };
        }
        throw insertError;
      }

      console.log(`[AUDIT] User ${user.id} initiated new ${operation} job for ${documentId}`);
      return { success: true, jobId: newJob.id };
    }
  } catch (error: any) {
    console.error(`[AUDIT] Failed ${operation}:`, error.message);
    if (error instanceof SecurityError) {
      return { success: false, error: error.message, status: error.status };
    }
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}
