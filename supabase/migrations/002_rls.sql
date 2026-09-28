create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_conversation_member(target_conversation uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = target_conversation and user_id = target_user
  );
$$;

revoke all on function public.is_conversation_member(uuid, uuid) from public;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.invite_keys enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_metadata enable row level security;

create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select (id, username, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy invite_keys_admin_select on public.invite_keys
  for select to authenticated using ((select public.is_admin()));
create policy invite_keys_admin_insert on public.invite_keys
  for insert to authenticated with check ((select public.is_admin()));
create policy invite_keys_admin_update on public.invite_keys
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy conversations_member_select on public.conversations
  for select to authenticated using (
    type = 'global' or (select public.is_conversation_member(id, (select auth.uid())))
  );

create policy conversation_members_visible_select on public.conversation_members
  for select to authenticated using (
    user_id = (select auth.uid()) or (select public.is_conversation_member(conversation_id, (select auth.uid()))) or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.type = 'global'
    )
  );

create policy messages_visible_select on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (
        c.type = 'global' or (select public.is_conversation_member(c.id, (select auth.uid())))
      )
    )
  );

create policy messages_authorized_insert on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid()) and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (
        c.type = 'global' or (select public.is_conversation_member(c.id, (select auth.uid())))
      )
    )
  );

create policy messages_own_update on public.messages
  for update to authenticated using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));
create policy messages_own_delete on public.messages
  for delete to authenticated using (sender_id = (select auth.uid()));

revoke all on public.message_metadata from anon, authenticated;
revoke all on public.invite_keys from anon;

alter table public.messages replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
exception when undefined_object then
  null;
end $$;
