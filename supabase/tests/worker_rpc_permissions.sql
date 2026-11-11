-- Read-only assertions; never claim a real job as part of a security check.
do $$
declare v_signature text; v_role text;
begin
  foreach v_signature in array array[
    'public.claim_ai_job()',
    'public.confirm_document_upload(uuid,uuid,text)'
  ] loop
    foreach v_role in array array['anon','authenticated'] loop
      if has_function_privilege(v_role,v_signature,'execute') then
        raise exception 'Unexpected client execution: % %',v_role,v_signature;
      end if;
    end loop;
    if not has_function_privilege('service_role',v_signature,'execute') then
      raise exception 'Server access missing: %',v_signature;
    end if;
  end loop;
  if has_function_privilege('anon','public.search_document_chunks(text,uuid[],uuid,integer)','execute') then
    raise exception 'Anonymous retrieval execution';
  end if;
  if exists(select 1 from pg_proc where oid in (
    'public.claim_ai_job()'::regprocedure,
    'public.search_document_chunks(text,uuid[],uuid,integer)'::regprocedure
  ) and not coalesce(proconfig @> array['search_path=""'],false)) then
    raise exception 'Unsafe search path';
  end if;
end $$;
select 'PASS: worker/upload server-only; anonymous retrieval denied; search paths fixed' as result;
