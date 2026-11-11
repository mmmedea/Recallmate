import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

export type RetrievedChunk = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number?: number;
  section_title?: string;
  score: number;
};

export type RetrievalRequest = {
  userId: string;
  documentId: string;
  query?: string;
  limit?: number;
  maxTokens?: number;
};

export type RetrievedContext = {
  chunks: RetrievedChunk[];
  totalTokens: number;
  retrievalMethod: "lexical" | "hybrid";
};

export interface DocumentRetriever {
  retrieveRelevantChunks(input: RetrievalRequest): Promise<RetrievedContext>;
}

// Ensure you instantiate the Supabase client correctly with service role or user JWT 
// depending on where this is called. Since the RPC strictly checks `auth.uid() = p_user_id` 
// when not service_role, passing the correct client is important.
export class LexicalRetriever implements DocumentRetriever {
  private supabase: ReturnType<typeof createClient<Database>>;
  private RELEVANCE_THRESHOLD = 0.01; // Minimum ts_rank score to consider a chunk relevant

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient;
  }

  async retrieveRelevantChunks(input: RetrievalRequest): Promise<RetrievedContext> {
    if (!input.documentId) {
      return { chunks: [], totalTokens: 0, retrievalMethod: "lexical" };
    }

    const { data, error } = await this.supabase.rpc('search_document_chunks', {
      p_query: input.query || '',
      p_authorized_document_ids: [input.documentId],
      p_user_id: input.userId,
      p_limit: input.limit || 20,
    });

    if (error) {
      console.error("LexicalRetriever Error:", error);
      throw new Error(`Retrieval failed: ${error.message}`);
    }

    let chunks = data as RetrievedChunk[] || [];
    
    // Apply relevance gating if there's a query
    if (input.query) {
      chunks = chunks.filter(c => c.score >= this.RELEVANCE_THRESHOLD);
    }

    // Sort by chunk index to maintain narrative order within the context window
    chunks.sort((a, b) => a.chunk_index - b.chunk_index);

    // Apply token budget
    let totalTokens = 0;
    const maxTokens = input.maxTokens || 16000;
    const finalChunks: RetrievedChunk[] = [];
    
    // Rough estimate: 1 token ~= 4 characters
    for (const chunk of chunks) {
      const estimatedTokens = Math.ceil(chunk.content.length / 4);
      if (totalTokens + estimatedTokens > maxTokens) {
        break; // Stop adding chunks once we hit the budget
      }
      totalTokens += estimatedTokens;
      finalChunks.push(chunk);
    }

    return {
      chunks: finalChunks,
      totalTokens,
      retrievalMethod: "lexical"
    };
  }
}

