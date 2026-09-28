create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

create table public.invite_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  role text not null default 'user' check (role in ('user', 'admin')),
  max_uses integer not null check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0 and used_count <= max_uses),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'global')),
  direct_key text unique,
  created_at timestamptz not null default now(),
  check ((type = 'global' and direct_key is null) or (type = 'direct' and direct_key is not null))
);

create unique index one_global_conversation_idx on public.conversations (type) where type = 'global';

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 year')
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_expires_idx on public.messages (expires_at);

create table public.message_metadata (
  message_id uuid primary key references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  sender_ip_hash text,
  user_agent text,
  client_type text,
  platform text
);
