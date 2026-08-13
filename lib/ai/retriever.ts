import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

export type RetrievedChunk = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
};

export type RetrievalRequest = {
  userId: string;
  authorizedDocumentIds: string[];
  query?: string;
  limit?: number;
};

export interface DocumentRetriever {
  search(input: RetrievalRequest): Promise<RetrievedChunk[]>;
}

// Ensure you instantiate the Supabase client correctly with service role or user JWT 
// depending on where this is called. Since the RPC strictly checks `auth.uid() = p_user_id` 
// when not service_role, passing the correct client is important.
export class LexicalRetriever implements DocumentRetriever {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient;
  }

  async search(input: RetrievalRequest): Promise<RetrievedChunk[]> {
    if (!input.authorizedDocumentIds || input.authorizedDocumentIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase.rpc('search_document_chunks', {
      p_query: input.query || '',
      p_authorized_document_ids: input.authorizedDocumentIds,
      p_user_id: input.userId,
      p_limit: input.limit || 20,
    });

    if (error) {
      console.error("LexicalRetriever Error:", error);
      throw new Error(`Retrieval failed: ${error.message}`);
    }

    return data || [];
  }
}
