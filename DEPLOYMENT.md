# Notex chat deployment checklist

## Supabase

1. Create a project in Supabase.
2. Copy the project URL and publishable key from Project Settings > API.
3. Keep the service-role key private. It is used only by Next.js route handlers.
4. Link the project with the Supabase CLI and run `supabase db push`.
5. Confirm the `global` conversation and one `AdminSigma101` invite key exist.
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

Use `AdminSigma101` once on `/register` to create the first administrator. After that, visit `/admin` to create normal-user invite keys and disable the initial key if desired. Do not place the initial key in frontend code, screenshots, or public documentation outside this setup note.
