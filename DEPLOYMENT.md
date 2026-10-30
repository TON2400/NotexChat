# Notex chat deployment checklist

## Supabase

1. Create a project in Supabase.
2. Copy the project URL and publishable key from Project Settings > API.
3. Keep the service-role key private. It is used only by Next.js route handlers.
4. Link the project with the Supabase CLI and run `supabase db push`.
5. Confirm the `global` conversation exists, then generate a one-time random admin invite key in the Supabase SQL Editor:

```sql
insert into public.invite_keys(key, role, max_uses, expires_at)
values (encode(gen_random_bytes(16), 'hex'), 'admin', 1, now() + interval '1 hour')
returning key;
```
6. Enable `pg_cron` if your project has it available, then re-run migrations if needed. Check that `public.delete_expired_messages()` is scheduled.

## Vercel

Add these environment variables for Production, Preview, and Development as appropriate:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
IP_HASH_SECRET
```

Import the GitHub repository, keep the framework preset as Next.js, and deploy. The application uses the App Router and does not require a separate backend, Docker image, Redis instance, or WebSocket server.

## First run

Use the one-time random admin invite key generated in the Supabase SQL Editor once on `/register` to create the first administrator. After that, visit `/admin` to create normal-user invite keys. Never commit plaintext invite keys to source control or public documentation.
