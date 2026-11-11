'use server'

import { requireUser, SecurityError } from '@/lib/security'
import { createClient } from '@/utils/supabase/server'

export type TopicViewModel = {
  id: string
  name: string
  description: string
  sourceChunkId: string
}

export type NotesViewModel = {
  document: {
    id: string
    title: string
  }
  notes: {
    id: string
    summary: string
    topics: TopicViewModel[]
  }
  generation: {
    status: string
  }
}

export async function getNotesViewModel(documentId: string): Promise<{ success: boolean; data?: NotesViewModel; error?: string }> {
  try {
    const { supabase, user } = await requireUser()

    // 1. Fetch the document and join notes, topics, and ai_jobs to enforce ownership 
    // and retrieve all necessary data in a single query.
    const { data: document, error } = await supabase
      .from('documents')
      .select(`
        id, 
        filename, 
        notes ( id, content ),
        topics ( id, name, description, source_chunk_id ),
        ai_jobs ( operation, status )
      `)
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (error || !document) {
      throw new SecurityError('Document not found or unauthorized', 404)
    }

    const notesJob = (document.ai_jobs as any[])?.find(j => j.operation === 'generate_notes')
    const status = notesJob?.status || 'not_requested'

    const note = (document.notes as any[])?.[0]
    const topics = (document.topics as any[]) || []

    if (!note && status === 'completed') {
      // Inconsistent state
      return { success: false, error: 'Notes generation is in an inconsistent state.' }
    }

    if (!note) {
      return { success: false, error: `Notes are not yet ready (Status: ${status}).` }
    }

    const viewModel: NotesViewModel = {
      document: {
        id: document.id,
        title: document.filename // In Phase 1 we mapped filename to title
      },
      notes: {
        id: note.id,
        summary: note.content,
        topics: topics.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description || '',
          sourceChunkId: t.source_chunk_id
        }))
      },
      generation: {
        status
      }
    }

    return { success: true, data: viewModel }

  } catch (error: any) {
    if (error instanceof SecurityError) {
      return { success: false, error: error.message }
    }
    console.error('[getNotesViewModel] error:', error)
    return { success: false, error: 'Internal Server Error' }
  }
}
