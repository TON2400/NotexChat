create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role and coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'role changes are restricted';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger
before update on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.get_current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.get_current_profile() from public, anon;
grant execute on function public.get_current_profile() to authenticated;

create or replace function public.normalize_message_expiry()
returns trigger
language plpgsql
as $$
begin
  new.created_at := coalesce(new.created_at, now());
  new.expires_at := new.created_at + interval '1 year';
  return new;
end;
$$;

drop trigger if exists normalize_message_expiry_trigger on public.messages;
create trigger normalize_message_expiry_trigger
before insert on public.messages
for each row execute function public.normalize_message_expiry();

create or replace function public.consume_invite_key(p_key text, p_user_id uuid)
returns public.invite_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invite_keys;
begin
  select * into invite from public.invite_keys
  where key = p_key
  for update;

  if not found then raise exception 'invalid invite key'; end if;
  if invite.disabled_at is not null then raise exception 'invite key disabled'; end if;
  if invite.expires_at is not null and invite.expires_at <= now() then raise exception 'invite key expired'; end if;
  if invite.used_count >= invite.max_uses then raise exception 'invite key already used'; end if;

  update public.invite_keys
  set used_count = used_count + 1
  where id = invite.id
  returning * into invite;
  return invite;
end;
$$;

revoke all on function public.consume_invite_key(text, uuid) from public, anon, authenticated;
grant execute on function public.consume_invite_key(text, uuid) to service_role;

create or replace function public.get_or_create_direct_conversation(p_other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  pair_key text;
  conversation_id uuid;
begin
  if current_user_id is null then raise exception 'unauthorized'; end if;
  if p_other_user is null or p_other_user = current_user_id then raise exception 'invalid recipient'; end if;
  if not exists (select 1 from public.profiles where id = p_other_user) then raise exception 'user not found'; end if;

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

grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

create or replace function public.delete_expired_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare deleted_count integer;
begin
  delete from public.messages where expires_at < now();
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
