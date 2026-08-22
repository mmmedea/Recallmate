-- ========================================================================================
-- RECALLMATE — PHASE 6.6: RAG RPC UPDATE
-- ========================================================================================

DROP FUNCTION IF EXISTS public.search_document_chunks(text, uuid[], uuid, integer);

CREATE OR REPLACE FUNCTION public.search_document_chunks(
    p_query text, 
    p_authorized_document_ids uuid[], 
    p_user_id uuid, 
    p_limit integer DEFAULT 20
) 
RETURNS TABLE(
    id uuid, 
    document_id uuid, 
    chunk_index integer, 
    content text,
    page_number integer,
    section_title text,
    score real
)
LANGUAGE plpgsql
AS $$
begin
  -- If called from an authenticated client (not service_role), enforce auth matches p_user_id
  if auth.role() = 'authenticated' and auth.uid() != p_user_id then
    raise exception 'Unauthorized user mismatch';
  end if;

  if p_query is null or p_query = '' then
    -- Full-context retrieval: return all chunks for the given documents in order
    return query
    select 
      dc.id,
      dc.document_id,
      dc.chunk_index,
      dc.content,
      dc.page_number,
      dc.section_title,
      1.0::real as score
    from public.document_chunks dc
    join public.documents d on d.id = dc.document_id
    where d.user_id = p_user_id -- Strict JOIN
      and dc.document_id = any(p_authorized_document_ids)
    order by dc.document_id, dc.chunk_index asc
    limit p_limit;
  else
    -- Lexical retrieval: return most relevant chunks
    return query
    select 
      dc.id,
      dc.document_id,
      dc.chunk_index,
      dc.content,
      dc.page_number,
      dc.section_title,
      ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', p_query))::real as score
    from public.document_chunks dc
    join public.documents d on d.id = dc.document_id
    where d.user_id = p_user_id -- Strict JOIN
      and dc.document_id = any(p_authorized_document_ids)
      and to_tsvector('english', dc.content) @@ plainto_tsquery('english', p_query)
    order by score desc, dc.chunk_index asc
    limit p_limit;
  end if;
end;
$$;
