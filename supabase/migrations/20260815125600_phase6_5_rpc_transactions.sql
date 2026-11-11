-- ========================================================================================
-- RECALLMATE — PHASE 6.5: GENERATION RPCS
-- ========================================================================================
-- This migration script creates Postgres functions (RPCs) to handle transactional inserts
-- of generated AI data (Notes and Quizzes) and update the AI job status in one atomic step.
-- ========================================================================================

CREATE OR REPLACE FUNCTION public.save_generated_notes(
    p_job_id uuid,
    p_user_id uuid,
    p_document_id uuid,
    p_summary text,
    p_key_points text[],
    p_topics jsonb[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_note_id uuid;
    v_topic jsonb;
    v_source jsonb;
    v_source_chunk_index integer;
    v_first_source_chunk_id uuid;
BEGIN
    -- 1. Insert Note
    INSERT INTO public.notes (document_id, user_id, content)
    VALUES (
        p_document_id,
        p_user_id,
        '# Summary' || E'\n' || p_summary || E'\n\n' || '# Key Points' || E'\n' || array_to_string(p_key_points, E'\n- ')
    )
    RETURNING id INTO v_note_id;

    -- 2. Insert Topics
    FOREACH v_topic IN ARRAY p_topics
    LOOP
        -- Find the chunk_id for the first source chunk_index to map it.
        v_source_chunk_index := (v_topic->'sources'->0->>'chunkIndex')::integer;
        
        SELECT id INTO v_first_source_chunk_id
        FROM public.document_chunks
        WHERE document_id = p_document_id AND chunk_index = v_source_chunk_index;

        INSERT INTO public.topics (document_id, name, description, source_chunk_id)
        VALUES (
            p_document_id,
            v_topic->>'name',
            v_topic->>'description',
            v_first_source_chunk_id
        );
    END LOOP;

    -- 3. Update Job
    UPDATE public.ai_jobs
    SET status = 'completed'
    WHERE id = p_job_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.save_generated_quiz(
    p_job_id uuid,
    p_user_id uuid,
    p_document_id uuid,
    p_questions jsonb[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_question jsonb;
    v_source_chunk_index integer;
    v_first_source_chunk_id uuid;
    v_options_array text[];
    v_correct_answer_text text;
    v_correct_answer_index integer;
BEGIN
    -- 1. Insert Questions
    FOREACH v_question IN ARRAY p_questions
    LOOP
        v_source_chunk_index := (v_question->'sources'->0->>'chunkIndex')::integer;
        
        SELECT id INTO v_first_source_chunk_id
        FROM public.document_chunks
        WHERE document_id = p_document_id AND chunk_index = v_source_chunk_index;

        -- Extract text array
        SELECT array_agg(x::text) INTO v_options_array 
        FROM jsonb_array_elements_text(v_question->'options') x;
        
        v_correct_answer_index := (v_question->>'correctAnswerIndex')::integer;
        v_correct_answer_text := v_options_array[v_correct_answer_index + 1]; -- Postgres arrays are 1-indexed

        INSERT INTO public.questions (
            document_id, 
            question_text, 
            options, 
            correct_answer, 
            explanation, 
            difficulty, 
            source_chunk_id
        )
        VALUES (
            p_document_id,
            v_question->>'questionText',
            v_options_array,
            v_correct_answer_text,
            v_question->>'explanation',
            'medium',
            v_first_source_chunk_id
        );
    END LOOP;

    -- 2. Update Job
    UPDATE public.ai_jobs
    SET status = 'completed'
    WHERE id = p_job_id;
END;
$$;
