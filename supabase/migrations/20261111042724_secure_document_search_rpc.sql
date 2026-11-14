-- Recreate the retrieval RPC because its deployed return shape is missing
-- page metadata and relevance scores expected by the application.
-- No database objects depend on this function (verified before preparing this migration).
DROP FUNCTION IF EXISTS public.search_document_chunks(text, uuid[], uuid, integer);

CREATE FUNCTION public.search_document_chunks(
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
DECLARE
    v_claims jsonb := auth.jwt();
    v_query text := COALESCE(p_query, '');
    v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
BEGIN
    -- Service-role workers may search on behalf of a job owner.
    -- Browser/user JWTs must identify the same non-anonymous account.
    IF COALESCE(v_claims->>'role', '') <> 'service_role' THEN
        IF auth.uid() IS NULL
           OR auth.uid() IS DISTINCT FROM p_user_id
           OR COALESCE(v_claims->>'is_anonymous', 'false') = 'true' THEN
            RAISE EXCEPTION 'Unauthorized' USING errcode = '42501';
        END IF;
    END IF;

    IF length(v_query) > 1000
       OR COALESCE(cardinality(p_authorized_document_ids), 0) < 1
       OR cardinality(p_authorized_document_ids) > 20 THEN
        RAISE EXCEPTION 'Search request exceeds allowed limits';
    END IF;

    IF v_query = '' THEN
        RETURN QUERY
        SELECT dc.id, dc.document_id, dc.chunk_index, dc.content,
               dc.page_number, dc.section_title, 1.0::real
        FROM public.document_chunks dc
        JOIN public.documents d ON d.id = dc.document_id
        WHERE d.user_id = p_user_id
          AND dc.document_id = ANY(p_authorized_document_ids)
        ORDER BY dc.document_id, dc.chunk_index ASC
        LIMIT v_limit;
    ELSE
        RETURN QUERY
        SELECT dc.id, dc.document_id, dc.chunk_index, dc.content,
               dc.page_number, dc.section_title,
               ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', v_query))::real
        FROM public.document_chunks dc
        JOIN public.documents d ON d.id = dc.document_id
        WHERE d.user_id = p_user_id
          AND dc.document_id = ANY(p_authorized_document_ids)
          AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', v_query)
        ORDER BY 7 DESC, dc.chunk_index ASC
        LIMIT v_limit;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.search_document_chunks(text, uuid[], uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_document_chunks(text, uuid[], uuid, integer) TO authenticated, service_role;
