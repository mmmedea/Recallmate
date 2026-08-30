-- Authenticated students must be able to create and manage only their own uploads.
drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
  on public.documents for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own documents" on public.documents;
create policy "Users can update own documents"
  on public.documents for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own documents" on public.documents;
create policy "Users can delete own documents"
  on public.documents for delete to authenticated
  using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
