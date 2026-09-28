# Notex chat

Private text-only chat built with Next.js App Router, TypeScript, Supabase Auth, PostgreSQL RLS, and Supabase Realtime.

## Local development

1. Create a Supabase project and install the Supabase CLI.
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server/Vercel only)
   - `IP_HASH_SECRET` (server/Vercel only)
3. Link the project and apply migrations:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

4. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The first registration must use `AdminSigma101`; that key is seeded by migration, can be used once, and is never shipped to client JavaScript.

## Deploy to Vercel Hobby

1. Push this repository to GitHub and import it into Vercel.
2. Add the same four environment variables in Vercel Project Settings. Never add `SUPABASE_SERVICE_ROLE_KEY` to a `NEXT_PUBLIC_*` variable.
3. Apply the migrations to the linked production Supabase project with `supabase db push`.
4. Deploy. Vercel runs `npm run build` automatically.

The expiration migration schedules `public.delete_expired_messages()` at 03:17 UTC when the `pg_cron` extension is available. If it is not available in the project, enable `pg_cron` in Supabase Dashboard, then run the migrations again. The browser never performs cleanup.

## How to use

- Register with a username, password, and invite key.
- Sign in using the username and password.
- `Global chat` is shared by all authenticated profiles.
- Open `ผู้ใช้งาน`, select a profile, and Notex creates or reuses one direct conversation for that pair.
- Press Enter to send; Shift + Enter adds a newline. Messages are limited to 2,000 characters and load 50 at a time.
- Change display name or password in `ตั้งค่า`. Passwords are handled only by Supabase Auth.
- Admins can manage users and invite keys at `/admin`.

## Security notes

- Invite validation and atomic usage counting happen in a `SECURITY DEFINER` PostgreSQL function called only by the server-role route.
- RLS controls profile, conversation, membership, and message access. Client checks are only for UX.
- Message metadata is private and stores an HMAC IP hash when `IP_HASH_SECRET` is present; plaintext IP addresses are not stored.
- Message metadata cascades with its message. Messages are normalized to expire one year after creation.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```
