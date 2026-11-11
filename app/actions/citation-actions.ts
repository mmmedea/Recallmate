'use server'

import { requireUser, SecurityError } from '@/lib/security'
import { createClient } from '@/utils/supabase/server'

export type Citation = {
  chunkId: string
  documentId: string
  label: string
  excerpt: string
  page?: number
}

export async function getCitation(chunkId: string, documentId: string): Promise<{ success: boolean; data?: Citation; error?: string }> {
  try {
    const { supabase, user } = await requireUser()

    // Enforce ownership:
    // 1. Chunk must belong to the requested documentId.
    // 2. The documentId must belong to the current user.
    const { data: chunk, error } = await supabase
      .from('document_chunks')
      .select(`
        id, chunk_index, page_number, section_title, content,
        documents!inner ( id, user_id )
      `)
      .eq('id', chunkId)
      .eq('document_id', documentId)
      .eq('documents.user_id', user.id)
      .single()

    if (error || !chunk) {
      throw new SecurityError('Citation not found or unauthorized', 404)
    }

    // Build the citation view model
    const label = chunk.section_title 
      ? `Section: ${chunk.section_title}`
      : chunk.page_number 
        ? `Page ${chunk.page_number}` 
        : `Chunk ${chunk.chunk_index + 1}`

    // Truncate excerpt if it's too long
    const MAX_EXCERPT_LENGTH = 300
    let excerpt = chunk.content
    if (excerpt.length > MAX_EXCERPT_LENGTH) {
      excerpt = excerpt.substring(0, MAX_EXCERPT_LENGTH).trim() + '...'
    }

    const citation: Citation = {
      chunkId: chunk.id,
      documentId: documentId,
      label,
      excerpt,
      page: chunk.page_number || undefined
    }

    return { success: true, data: citation }

  } catch (error: any) {
    if (error instanceof SecurityError) {
      return { success: false, error: error.message }
    }
    console.error('[getCitation] error:', error)
    return { success: false, error: 'Internal Server Error' }
  }
}
