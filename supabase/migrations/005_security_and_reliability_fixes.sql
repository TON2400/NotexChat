-- 005_security_and_reliability_fixes.sql
-- Remediates Priority 0 (AdminSigma101), Priority 1 (RLS, SECURITY DEFINER, disabled users, message tampering),
-- and Priority 2 (atomic registration, pagination index, expiration batching).

-- 1. Priority 0: Remove publicly disclosed bootstrap admin invite key
delete from public.invite_keys
where key = 'AdminSigma101';

-- 2. Track disabled user state in profiles for immediate RLS enforcement
alter table public.profiles
  add column if not exists disabled_at timestamptz;

-- Backfill disabled_at from auth.users.banned_until if any accounts are currently banned
update public.profiles p
set disabled_at = coalesce(p.disabled_at, now())
from auth.users u
where p.id = u.id
  and u.banned_until is not null
  and u.banned_until > now()
  and p.disabled_at is null;

-- 3. Helper functions for active user & admin verification
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and disabled_at is null
  );
$$;

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and disabled_at is null
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.get_current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p from public.profiles p
  where p.id = (select auth.uid()) and p.disabled_at is null;
$$;

revoke all on function public.get_current_profile() from public, anon;
grant execute on function public.get_current_profile() to authenticated;

-- 4. Restrict is_conversation_member so authenticated users can only query their own membership
create or replace function public.is_conversation_member(target_conversation uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = target_conversation
      and user_id = target_user
      and target_user = (select auth.uid())
      and (select public.is_active_user())
  );
$$;

revoke all on function public.is_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

-- 5. Protect both role and disabled_at on profiles
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.role is distinct from new.role or old.disabled_at is distinct from new.disabled_at)
     and coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'role and status changes are restricted';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.protect_profile_role() from public, anon, authenticated;

-- 6. Harden normalize_message_expiry trigger function with search_path and immutable fields on update
create or replace function public.normalize_message_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.conversation_id := old.conversation_id;
    new.sender_id := old.sender_id;
    new.created_at := old.created_at;
    new.expires_at := old.expires_at;
    return new;
  end if;
  new.created_at := coalesce(new.created_at, now());
  new.expires_at := new.created_at + interval '1 year';
  return new;
end;
$$;

revoke all on function public.normalize_message_expiry() from public, anon, authenticated;

drop trigger if exists normalize_message_expiry_trigger on public.messages;
create trigger normalize_message_expiry_trigger
before insert or update on public.messages
for each row execute function public.normalize_message_expiry();

-- 7. Update RLS policies and table grants
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and disabled_at is null)
  with check (id = (select auth.uid()) and disabled_at is null);

drop policy if exists conversations_member_select on public.conversations;
create policy conversations_member_select on public.conversations
  for select to authenticated
  using (
    (select public.is_active_user()) and (
      type = 'global' or (select public.is_conversation_member(id, (select auth.uid())))
    )
  );

drop policy if exists conversation_members_visible_select on public.conversation_members;
create policy conversation_members_visible_select on public.conversation_members
  for select to authenticated
  using (
    (select public.is_active_user()) and (
      user_id = (select auth.uid())
      or (select public.is_conversation_member(conversation_id, (select auth.uid())))
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id and c.type = 'global'
      )
    )
  );

drop policy if exists messages_visible_select on public.messages;
create policy messages_visible_select on public.messages
  for select to authenticated
  using (
    (select public.is_active_user())
    and expires_at > now()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (
        c.type = 'global' or (select public.is_conversation_member(c.id, (select auth.uid())))
      )
    )
  );

drop policy if exists messages_authorized_insert on public.messages;
create policy messages_authorized_insert on public.messages
  for insert to authenticated
  with check (
    (select public.is_active_user())
    and sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (
        c.type = 'global' or (select public.is_conversation_member(c.id, (select auth.uid())))
      )
    )
  );

-- Remove client-side message update/delete policies that permitted cross-conversation moves and expiry tampering
drop policy if exists messages_own_update on public.messages;
drop policy if exists messages_own_delete on public.messages;

-- Enforce least-privilege table grants
revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;

revoke all on public.conversation_members from anon, authenticated;
grant select on public.conversation_members to authenticated;

revoke all on public.messages from anon, authenticated;
grant select, insert (conversation_id, sender_id, content) on public.messages to authenticated;

revoke all on public.invite_keys from anon, authenticated;
grant select, insert, update on public.invite_keys to authenticated;

-- Use default replica identity on messages to avoid WAL bloat on bulk expiration deletes
alter table public.messages replica identity default;

-- Add deterministic pagination index (conversation_id, created_at desc, id desc)
create index if not exists messages_conversation_created_id_idx
  on public.messages (conversation_id, created_at desc, id desc);

-- 8. Pre-check and atomic registration functions (service_role only)
create or replace function public.check_registration_eligibility(p_username text, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invite_keys;
begin
  if exists (select 1 from public.profiles where lower(username) = lower(trim(p_username))) then
    raise exception 'username already taken';
  end if;

  select * into invite from public.invite_keys
  where key = p_key;

  if not found then raise exception 'invalid invite key'; end if;
  if invite.disabled_at is not null then raise exception 'invite key disabled'; end if;
  if invite.expires_at is not null and invite.expires_at <= now() then raise exception 'invite key expired'; end if;
  if invite.used_count >= invite.max_uses then raise exception 'invite key already used'; end if;
end;
$$;

revoke all on function public.check_registration_eligibility(text, text) from public, anon, authenticated;
grant execute on function public.check_registration_eligibility(text, text) to service_role;

create or replace function public.complete_user_registration(
  p_user_id uuid,
  p_username text,
  p_display_name text,
  p_key text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invite_keys;
  created_profile public.profiles;
begin
  if exists (select 1 from public.profiles where lower(username) = lower(trim(p_username))) then
    raise exception 'username already taken';
  end if;

  select * into invite from public.invite_keys
  where key = p_key
  for update;

  if not found then raise exception 'invalid invite key'; end if;
  if invite.disabled_at is not null then raise exception 'invite key disabled'; end if;
  if invite.expires_at is not null and invite.expires_at <= now() then raise exception 'invite key expired'; end if;
  if invite.used_count >= invite.max_uses then raise exception 'invite key already used'; end if;

  update public.invite_keys
  set used_count = used_count + 1
  where id = invite.id;

  insert into public.profiles (id, username, display_name, role)
  values (p_user_id, trim(p_username), trim(p_display_name), invite.role)
  returning * into created_profile;

  return created_profile;
end;
$$;

revoke all on function public.complete_user_registration(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_user_registration(uuid, text, text, text) to service_role;

-- 9. Harden get_or_create_direct_conversation and delete_expired_messages
create or replace function public.get_or_create_direct_conversation(p_other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  pair_key text;
  conversation_id uuid;
begin
  if current_user_id is null or not (select public.is_active_user()) then
    raise exception 'unauthorized';
  end if;
  if p_other_user is null or p_other_user = current_user_id then
    raise exception 'invalid recipient';
  end if;
  if not exists (select 1 from public.profiles where id = p_other_user and disabled_at is null) then
    raise exception 'user not found';
  end if;

  pair_key := least(current_user_id::text, p_other_user::text) || ':' || greatest(current_user_id::text, p_other_user::text);
  perform pg_advisory_xact_lock(hashtext(pair_key));

  select id into conversation_id from public.conversations where direct_key = pair_key;
  if conversation_id is null then
    insert into public.conversations(type, direct_key) values ('direct', pair_key) returning id into conversation_id;
    insert into public.conversation_members(conversation_id, user_id)
    values (conversation_id, current_user_id), (conversation_id, p_other_user);
  end if;
  return conversation_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

create or replace function public.delete_expired_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with expired as (
    select id from public.messages
    where expires_at <= now()
    limit 5000
  )
  delete from public.messages m
  using expired e
  where m.id = e.id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_expired_messages() from public, anon, authenticated;
grant execute on function public.delete_expired_messages() to service_role;

do $block$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $sql$ select case when exists (select 1 from cron.job where jobname = 'notex-expire-messages') then null else cron.schedule('notex-expire-messages', '17 3 * * *', 'select public.delete_expired_messages()') end $sql$;
  end if;
exception when duplicate_object then
  null;
end $block$;
