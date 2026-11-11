import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { estimateTokens } from "./provider";

export type ContextResult = {
  content: string;
  strategy: 'full' | 'hierarchical' | 'retrieval';
  validChunkIndices: Set<number>;
  tokenEstimate: number;
};

const FULL_CONTEXT_THRESHOLD = parseInt(process.env.AI_FULL_CONTEXT_TOKEN_THRESHOLD || '30000', 10);
const MAX_CONTEXT_TOKENS = parseInt(process.env.AI_MAX_CONTEXT_TOKENS || '1048576', 10); // 1M Flash context

/**
 * Retrieves the context for a document, strictly enforcing authorization.
 */
export async function getDocumentContext(
  supabase: ReturnType<typeof createClient<Database>>,
  documentId: string,
  userId: string,
  operation: 'generate_notes' | 'generate_quiz' | 'chat'
): Promise<ContextResult> {
  
  // 1. Authorization: Verify the document belongs to the user
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', userId)
    .single();

  if (docError || !doc) {
    throw new Error('Authorization failed: Document not found or does not belong to user.');
  }

  // 2. Fetch all chunks (ordered)
  // RLS is already in effect, but we explicitly filter by documentId.
  const { data: chunks, error: chunksError } = await supabase
    .from('document_chunks')
    .select('chunk_index, section_title, content, token_count')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true });

  if (chunksError || !chunks || chunks.length === 0) {
    throw new Error('Context Engine Error: No chunks found for document.');
  }

  const validChunkIndices = new Set<number>();
  let totalTokenEstimate = 0;
  
  // Try to sum the pre-calculated token_count if available, otherwise we will count it
  for (const chunk of chunks) {
    totalTokenEstimate += chunk.token_count || Math.ceil(chunk.content.length / 4);
    validChunkIndices.add(chunk.chunk_index);
  }

  // 3. Strategy Selection
  if (totalTokenEstimate <= FULL_CONTEXT_THRESHOLD) {
    // Strategy A: Full Context
    const content = chunks.map(c => `[Chunk ${c.chunk_index}] ${c.section_title ? `(${c.section_title})` : ''}\n${c.content}`).join('\n\n');
    
    // Exact token count estimation
    const exactTokens = await estimateTokens(content, operation);

    return {
      content,
      strategy: 'full',
      validChunkIndices,
      tokenEstimate: exactTokens
    };
  } else {
    // Strategy B: Hierarchical / Bounded Retrieval
    // For Phase 6.5, we will assemble a hierarchical summary or bounded section retrieval.
    // Instead of naive even-sampling, we will prioritize section boundaries, introduction, and conclusion.
    
    let boundedContent = "DOCUMENT TOO LARGE FOR FULL CONTEXT. EXTRACTING KEY SECTIONS:\n\n";
    let currentTokens = await estimateTokens(boundedContent, operation);
    const selectedChunks = new Set<number>();

    // Always include the first few chunks (Intro) and last few chunks (Conclusion)
    const criticalIndices = new Set([
      0, 1, 2, 
      chunks.length - 3, chunks.length - 2, chunks.length - 1
    ]);

    for (const chunk of chunks) {
      // Prioritize chunks with distinct section titles (headings) or critical boundaries
      if (criticalIndices.has(chunk.chunk_index) || chunk.section_title) {
        const chunkText = `[Chunk ${chunk.chunk_index}] ${chunk.section_title ? `(${chunk.section_title})` : ''}\n${chunk.content}\n\n`;
        const chunkTokens = chunk.token_count || await estimateTokens(chunkText, operation);
        
        if (currentTokens + chunkTokens <= FULL_CONTEXT_THRESHOLD) {
          boundedContent += chunkText;
          currentTokens += chunkTokens;
          selectedChunks.add(chunk.chunk_index);
        }
      }
    }

    // Exact count of what we actually assembled
    const exactTokens = await estimateTokens(boundedContent, operation);

    return {
      content: boundedContent,
      strategy: 'hierarchical',
      validChunkIndices: selectedChunks, // Only validate citations against what was actually sent!
      tokenEstimate: exactTokens
    };
  }
}
