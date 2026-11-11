-- Close anonymous caller-supplied user-id access to document retrieval.
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
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF auth.role() NOT IN ('authenticated', 'service_role')
       OR (auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM p_user_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_query IS NULL OR p_query = '' THEN
        RETURN QUERY
        SELECT dc.id, dc.document_id, dc.chunk_index, dc.content,
               dc.page_number, dc.section_title, 1.0::real
        FROM public.document_chunks dc
        JOIN public.documents d ON d.id = dc.document_id
        WHERE d.user_id = p_user_id
          AND dc.document_id = ANY(p_authorized_document_ids)
        ORDER BY dc.document_id, dc.chunk_index ASC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
    ELSE
        RETURN QUERY
        SELECT dc.id, dc.document_id, dc.chunk_index, dc.content,
               dc.page_number, dc.section_title,
               ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', p_query))::real
        FROM public.document_chunks dc
        JOIN public.documents d ON d.id = dc.document_id
        WHERE d.user_id = p_user_id
          AND dc.document_id = ANY(p_authorized_document_ids)
          AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', p_query)
        ORDER BY 7 DESC, dc.chunk_index ASC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.search_document_chunks(text, uuid[], uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_document_chunks(text, uuid[], uuid, integer) TO authenticated, service_role;
