-- ========================================================================================
-- RECALLMATE — STRICT RETRIEVAL RPC
-- ========================================================================================

-- INVARIANT: No retrieval query may return a chunk unless the authenticated principal 
-- is authorized for its parent document. Authorization must be part of retrieval itself.

create or replace function public.search_document_chunks(
  p_query text,
  p_authorized_document_ids uuid[],
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text
)
language plpgsql
security invoker
as $$
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
      dc.content
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
      dc.content
    from public.document_chunks dc
    join public.documents d on d.id = dc.document_id
    where d.user_id = p_user_id -- Strict JOIN
      and dc.document_id = any(p_authorized_document_ids)
      and to_tsvector('english', dc.content) @@ plainto_tsquery('english', p_query)
    order by ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', p_query)) desc, dc.chunk_index asc
    limit p_limit;
  end if;
end;
$$;
