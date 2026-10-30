# NotexChat — Security and Reliability Audit Report (Phase 1: Read-Only Audit)

> [!IMPORTANT]
> **Phase 1 Status: Read-Only Audit Completed.**
> No existing application source files or database migrations were modified during this audit. Review the findings and remediation plan below and approve before we proceed to Phase 2 (implementing fixes and migrations).

---

## Executive Summary & Priority 0: Admin Bootstrap (`AdminSigma101`)

### How `AdminSigma101` Is Validated and Whether It Can Still Be Used
1. **Seeding Mechanism:** Migration [004_seed_global_chat.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/004_seed_global_chat.sql#L5-L7) inserts a plaintext bootstrap key directly into `public.invite_keys`:
   ```sql
   insert into public.invite_keys(key, role, max_uses)
   values ('AdminSigma101', 'admin', 1)
   on conflict (key) do nothing;
   ```
2. **Public Exposure:** The plaintext key `AdminSigma101` is publicly documented in [004_seed_global_chat.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/004_seed_global_chat.sql#L5-L7), [README.md](file:///C:/Users/HP/Desktop/Notexchat/README.md#L28), and [DEPLOYMENT.md](file:///C:/Users/HP/Desktop/Notexchat/DEPLOYMENT.md#L9-L27).
3. **Validation Flow:**
   - When an unauthenticated caller sends `POST /api/register` ([route.ts](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/register/route.ts#L6-L36)), the server creates an `auth.users` account and calls `admin.rpc("consume_invite_key", { p_key: inviteKey, p_user_id: created.user.id })` using `SUPABASE_SERVICE_ROLE_KEY`.
   - `public.consume_invite_key` ([003_functions.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/003_functions.sql#L50-L74)) locks the matching `public.invite_keys` row (`FOR UPDATE`), checks `disabled_at is null`, `expires_at is null or expires_at > now()`, and `used_count < max_uses`, increments `used_count`, and returns the `invite_keys` record.
   - `POST /api/register` then inserts into `public.profiles` using `role: invite.role` (`'admin'`).
4. **Can an Unauthorized User Obtain Administrator Privileges?**
   - **Yes, in any newly provisioned or uninitialized environment** where `supabase db push` is run before an administrator manually consumes or disables `AdminSigma101`.
   - **Yes, if re-enabled in `/admin`:** The Admin Dashboard ([admin-dashboard.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/admin-dashboard.tsx#L14)) exposes an "เปิดใช้ / ปิดใช้" button on all invite keys.
   - **Yes, if already compromised prior to legitimate first use:** Because the repository is public (`https://github.com/TON2400/NotexChat.git`), we cannot assume from source code alone who consumed `AdminSigma101` in the live Supabase project.

### Live Supabase Project Checks Required (Unverified Without Live DB Access)
Run the following read-only queries in the **Supabase SQL Editor** on the live project before/during remediation:

```sql
-- 1. Check the live status of AdminSigma101 and all admin-role invite keys
SELECT id, key, role, max_uses, used_count, disabled_at, expires_at, created_at, created_by
FROM public.invite_keys
WHERE key = 'AdminSigma101' OR role = 'admin';

-- 2. Audit all existing administrator profiles and when they were created
SELECT p.id, p.username, p.display_name, p.role, p.created_at, p.updated_at, u.email, u.last_sign_in_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.role = 'admin'
ORDER BY p.created_at ASC;

-- 3. Check for orphaned auth.users without profiles (from partial /api/register failures)
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 4. Verify whether pg_cron is installed and notex-expire-messages is scheduled
SELECT extname FROM pg_extension WHERE extname = 'pg_cron';
```

### Safe Remediation Plan for Priority 0 (Without Exposing or Reusing Credentials)
1. **Disable & Delete `AdminSigma101` via Forward Migration (`005_security_and_reliability_fixes.sql`):**
   - Immediately disable and remove `AdminSigma101` (`DELETE FROM public.invite_keys WHERE key = 'AdminSigma101';`).
   - Remove the `AdminSigma101` seed statement from [004_seed_global_chat.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/004_seed_global_chat.sql#L5-L7) so new environments never seed a predictable admin key.
2. **Scrub Public Documentation:**
   - Remove `AdminSigma101` references from [README.md](file:///C:/Users/HP/Desktop/Notexchat/README.md#L28) and [DEPLOYMENT.md](file:///C:/Users/HP/Desktop/Notexchat/DEPLOYMENT.md#L9-L27).
3. **Safe Admin Bootstrap Workflow:**
   - Document and provide a safe SQL snippet for bootstrapping the first admin directly in the authenticated Supabase SQL Editor (generating a one-time random 32-byte hex invite key via `encode(gen_random_bytes(24), 'hex')` with a short expiration window, or promoting a specific verified username via SQL), ensuring no secret or bootstrap key is ever committed to git or exposed in client code.

---

## 1. Complete Findings Ranked by Severity and Confidence

| ID | Severity | Confidence | Category | Status | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-01** | **CRITICAL** | High | Priority 0: Bootstrap | Confirmed (Code) / Live State Unverified | Hardcoded public admin invite key `AdminSigma101` seeded by migration and documented in repo |
| **F-02** | **CRITICAL** | High | Priority 1: RLS / Authz | Confirmed | `messages_own_update` RLS policy + missing column grant restriction allows moving own messages into arbitrary private conversations and tampering with `expires_at` / `created_at` |
| **F-03** | **HIGH** | High | Priority 1: Authz / Session | Confirmed | Disabled (banned) users retain direct Supabase PostgREST and Realtime access until JWT expiration; API routes use `redirect()` instead of HTTP `401`/`403` JSON |
| **F-04** | **HIGH** | High | Priority 1 & 2: Registration | Confirmed | Non-atomic registration creates `auth.users` before checking invite key and burns `invite_keys.used_count` if `profiles` insert fails |
| **F-05** | **HIGH** | High | Priority 1: Admin Safety | Confirmed | `/api/admin/users` allows an admin to delete, disable, or demote their own account (self-lockout) |
| **F-06** | **HIGH** | High | Priority 1: Audit Bypass | Confirmed | Direct PostgREST `INSERT` on `public.messages` bypasses `/api/messages` and skips `public.message_metadata` IP hash / User-Agent logging |
| **F-07** | **HIGH** | High | Priority 1: `SECURITY DEFINER` | Confirmed | `public.is_conversation_member(target_conversation, target_user)` is callable by any `authenticated` user for arbitrary `target_user` UUIDs |
| **F-08** | **HIGH** | High | Priority 2: Reliability | Confirmed | Duplicate message submissions on rapid `Enter` keypress, overwrite race between initial load and Realtime, and permanent button lock on network error |
| **F-09** | **HIGH** | High | Priority 2: Reliability | Confirmed | Unhandled `fetch` / `response.json()` rejections across client components permanently freeze UI loading states and hide pagination on transient errors |
| **F-10** | **MEDIUM** | High | Priority 1: DB Privileges | Confirmed | Missing `REVOKE ALL FROM PUBLIC, anon` on `get_or_create_direct_conversation`, `protect_profile_role`, `normalize_message_expiry`, and tables `conversations`/`conversation_members`/`messages` |
| **F-11** | **MEDIUM** | High | Priority 1 & 2: Expiration | Confirmed (Code) / Live State Unverified | `messages_visible_select` RLS policy does not filter `expires_at > now()`; expired messages remain visible between cron runs or indefinitely if `pg_cron` was not enabled before migration |
| **F-12** | **MEDIUM** | High | Priority 1 & 2: Admin API | Confirmed | `GET /api/admin/users` only fetches `listUsers({ perPage: 100 })`, marking users >100 as `"unknown"` status; `/api/admin/invites` lacks schema validation on `expiresAt` |
| **F-13** | **MEDIUM** | High | Priority 2: Pagination & Realtime | Confirmed | Cursor pagination `.lt("created_at", ...)` drops messages sharing identical timestamps and lacks Realtime reconnect gap recovery |
| **F-14** | **MEDIUM** | High | Priority 1: API Hardening | Confirmed | State-changing cookie-authenticated API routes lack `Origin` CSRF validation |

---

## 2. Detailed Findings, Code References, Impact & Minimal Proposed Fixes

### F-01 [CRITICAL / High Confidence] — Publicly Disclosed Bootstrap Admin Invite Key (`AdminSigma101`)
- **Files & Code References:**
  - [004_seed_global_chat.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/004_seed_global_chat.sql#L5-L7)
  - [README.md](file:///C:/Users/HP/Desktop/Notexchat/README.md#L28)
  - [DEPLOYMENT.md](file:///C:/Users/HP/Desktop/Notexchat/DEPLOYMENT.md#L9-L27)
  - [route.ts (register)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/register/route.ts#L21-L30)
- **Confirmed vs. Unverified:** Confirmed in code and SQL migrations; live database redemption history requires the SQL verification queries listed in Priority 0 above.
- **Impact:** Full administrative takeover (`role = 'admin'`) if redeemed before the owner or in any newly deployed environment.
- **Minimal Proposed Fix:** Remove `AdminSigma101` from [004_seed_global_chat.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/004_seed_global_chat.sql#L5-L7), add a forward migration deleting/disabling `AdminSigma101`, and update documentation to use a one-time random SQL-generated invite key.

---

### F-02 [CRITICAL / High Confidence] — `messages_own_update` Policy & Table Grants Allow Cross-Conversation Message Injection and Expiry Tampering
- **Files & Code References:**
  - [002_rls.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/002_rls.sql#L92-L96)
  - [003_functions.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/003_functions.sql#L34-L48)
- **Confirmed Vulnerability Details:**
  1. In [002_rls.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/002_rls.sql#L92-L94):
     ```sql
     create policy messages_own_update on public.messages
       for update to authenticated using (sender_id = (select auth.uid()))
       with check (sender_id = (select auth.uid()));
     ```
  2. Unlike `public.profiles` (where column-level `grant update (display_name)` was applied), `public.messages` has no column-level restriction on `UPDATE`.
  3. `normalize_message_expiry_trigger` ([003_functions.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/003_functions.sql#L46-L48)) only fires `BEFORE INSERT`, not `BEFORE UPDATE`.
  4. **Exploit Path:** Any authenticated user can insert a message into `global` chat, then call `supabase.from('messages').update({ conversation_id: '<target_private_conversation_uuid>', expires_at: '2099-01-01T00:00:00Z', created_at: '...' }).eq('id', msgId)`. Because `messages_own_update` only checks `sender_id = auth.uid()`, PostgreSQL allows moving the message into a private direct conversation the user is **not** a member of, and allows bypassing the 1-year message expiration requirement.
- **Impact:** Unauthorized injection of messages into private conversations, manipulation of message timestamps/ordering, and bypass of data retention/expiration policy.
- **Minimal Proposed Fix:** Since NotexChat does not use client-side message editing or deletion, drop `messages_own_update` and `messages_own_delete` and revoke `UPDATE, DELETE` on `public.messages` from `anon, authenticated` (or if delete is retained, revoke `UPDATE` completely).

---

### F-03 [HIGH / High Confidence] — Disabled Users Retain Direct DB/Realtime Access Until JWT Expiry & API Routes Redirect Instead of Returning 401/403 JSON
- **Files & Code References:**
  - [server.ts (auth)](file:///C:/Users/HP/Desktop/Notexchat/src/lib/auth/server.ts#L13-L23)
  - [route.ts (admin/users)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/admin/users/route.ts#L23-L25)
  - [002_rls.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/002_rls.sql#L1-L97)
- **Confirmed Vulnerability Details:**
  1. When an admin disables a user in [route.ts (admin/users)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/admin/users/route.ts#L24), it sets `ban_duration: "876000h"` in `auth.users`. However, `public.profiles` has no `disabled_at` column, and RLS policies only check `auth.uid()`. Any existing JWT held by the banned user remains valid for direct Supabase PostgREST queries and Realtime WebSocket subscriptions until JWT expiration.
  2. All protected API route handlers (`GET/POST /api/conversations`, `POST /api/messages`, `PATCH /api/profile`, `GET/POST/PATCH /api/admin/invites`, `GET/PATCH /api/admin/users`) call `requireUser()` or `requireAdmin()`, which invoke Next.js `redirect("/login")` or `redirect("/chat")`. For `fetch()` calls, this returns a `307` redirect to an HTML page (`200 OK` with `text/html`), causing `response.json()` in client components to throw an unhandled `SyntaxError` rather than receiving a structured `401` / `403` JSON error.
- **Impact:** Banned users can continue reading/streaming messages via PostgREST/Realtime until token expiry; unauthenticated/unauthorized API calls receive HTML redirects instead of `401`/`403` JSON status codes.
- **Minimal Proposed Fix:**
  - Add `disabled_at timestamptz` to `public.profiles`, update it in `/api/admin/users` when disabling/enabling a user, and enforce `disabled_at is null` in `is_Active_user()` / `is_admin()` / `get_current_profile()` and RLS policies.
  - Add `requireApiUser()` and `requireApiAdmin()` in [server.ts](file:///C:/Users/HP/Desktop/Notexchat/src/lib/auth/server.ts) that return `{ error, response: NextResponse.json(..., { status: 401 | 403 }) }` for API routes while keeping `requireUser()` / `requireAdmin()` for Server Component pages/layouts.

---

### F-04 [HIGH / High Confidence] — Non-Atomic Registration & Invite Key Pre-Validation Missing in `/api/register`
- **Files & Code References:**
  - [route.ts (register)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/register/route.ts#L10-L35)
  - [003_functions.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/003_functions.sql#L50-L74)
- **Confirmed Vulnerability Details:**
  1. `POST /api/register` creates the `auth.users` account (line 12) **before** checking if the invite key is valid (line 21). Unauthenticated attackers without an invite key can flood `POST /api/register`, creating and deleting `auth.users` records on every request and temporarily locking usernames.
  2. `consume_invite_key` (line 21) commits `used_count = used_count + 1` in its own transaction before `admin.from("profiles").insert(...)` (line 28). If `profiles.insert` fails (or if two requests race with case-variant usernames like `Alice` and `alice` where `profiles_username_lower_idx` rejects the second), `deleteUser` removes the auth user, **but the invite key use is permanently lost (`used_count` is not decremented)**.
- **Impact:** Single-use invite keys can be permanently burned without creating a valid user profile; unauthenticated callers can trigger `auth.users` write amplification.
- **Minimal Proposed Fix:**
  - Create a `SECURITY DEFINER` function `public.validate_invite_key_and_username(p_key text, p_username text)` to pre-check that the invite key is usable and the username is not taken **before** calling `admin.auth.admin.createUser`.
  - Update `public.consume_invite_key` (or add `public.complete_user_registration(p_user_id uuid, p_username text, p_display_name text, p_key text)`) so consuming the invite key and inserting the row into `public.profiles` happen atomically inside a single PostgreSQL transaction.

---

### F-05 [HIGH / High Confidence] — Admin Self-Deletion, Self-Disable, and Self-Demotion in `/api/admin/users`
- **Files & Code References:**
  - [route.ts (admin/users)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/admin/users/route.ts#L15-L31)
  - [admin-dashboard.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/admin-dashboard.tsx#L14)
- **Confirmed Vulnerability Details:**
  - `PATCH /api/admin/users` does not check whether `body.userId === currentAdmin.id`. An admin can click "ลบ" (delete), "ปิดใช้" (disable), or "ลดเป็น user" (demote) on their own row in `/admin`.
- **Impact:** Permanent administrative lockout of the application.
- **Minimal Proposed Fix:** Reject `PATCH /api/admin/users` with `400 Bad Request` when `body.userId === adminProfile.id` (and disable self-action buttons in `AdminDashboard`).

---

### F-06 [HIGH / High Confidence] — Direct PostgREST `INSERT` on `public.messages` Bypasses `/api/messages` Metadata Logging
- **Files & Code References:**
  - [002_rls.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/002_rls.sql#L82-L90)
  - [route.ts (messages)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/messages/route.ts#L12-L24)
- **Confirmed Vulnerability Details:**
  - The browser has `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the user's JWT. Because `messages_authorized_insert` grants `INSERT` directly to `authenticated`, a user can call `supabase.from("messages").insert(...)` directly from browser DevTools, bypassing `POST /api/messages` and leaving no record in `public.message_metadata` (`sender_ip_hash`, `user_agent`, `platform`).
- **Impact:** Evasion of security audit metadata (`message_metadata`) for sent messages.
- **Minimal Proposed Fix:**
  - Check errors on `message_metadata` insert in `POST /api/messages` (or perform message + metadata insertion via a server-side/service-role call after verifying conversation access via `supabase`), and if strict metadata enforcement is required, revoke direct `INSERT` on `public.messages` from `authenticated` and insert via a `SECURITY DEFINER` RPC called by `/api/messages` (or keep RLS check via `create_message_with_metadata` granted to `service_role`).

---

### F-07 [HIGH / High Confidence] — `SECURITY DEFINER` Function `is_conversation_member` Leaks Arbitrary User Membership
- **Files & Code References:**
  - [002_rls.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/002_rls.sql#L17-L31)
- **Confirmed Vulnerability Details:**
  - `public.is_conversation_member(target_conversation uuid, target_user uuid)` is `SECURITY DEFINER` (bypasses RLS on `public.conversation_members`) and is granted `EXECUTE` to `authenticated`.
  - Any authenticated user can invoke `supabase.rpc("is_conversation_member", { target_conversation, target_user })` for **any** `target_user` UUID, probing who belongs to private conversations.
- **Impact:** Information disclosure of private conversation memberships.
- **Minimal Proposed Fix:** Restrict `public.is_conversation_member` so it only returns `true` when `target_user = (select auth.uid())`:
  ```sql
  select exists (
    select 1 from public.conversation_members
    where conversation_id = target_conversation
      and user_id = target_user
      and target_user = (select auth.uid())
  );
  ```

---

### F-08 [HIGH / High Confidence] — Duplicate Message Submissions & Initial Load Race Condition in `ChatRoom`
- **Files & Code References:**
  - [chat-room.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/chat-room.tsx#L8-L32)
- **Confirmed Reliability Details:**
  1. **Rapid Enter Keypress Duplicate Send:** `send()` checks React state `sending` (`if (!draft.trim() || sending) return; setSending(true);`). Because state updates are asynchronous, pressing `Enter` twice before React re-renders sends two identical `POST /api/messages` requests.
  2. **Initial Load Overwrites Realtime Messages:** `load()` and the Realtime channel subscription start simultaneously in `useEffect`. If a message arrives over Realtime before `load()` finishes, `setMessages(((data ?? []) ...).reverse())` overwrites `messages` state and drops the Realtime message.
  3. **Sender UI Relies Solely on Realtime:** `POST /api/messages` returns `{ message }`, but `ChatRoom.send()` ignores `result.message` and waits for Realtime to deliver the sender's own message. If Realtime lags or drops, the sent message disappears from the composer without appearing in the chat list.
- **Impact:** Duplicate messages stored and broadcast; or missing messages in the UI.
- **Minimal Proposed Fix:**
  - Use a synchronous `sendingRef = useRef(false)` lock in `send()`.
  - Append `result.message` (with current user's sender info) on successful `POST /api/messages` using a deduplicating merge helper `mergeMessages(current, incoming)`.
  - Use the same deduplicating `mergeMessages` helper when `load()` completes so Realtime messages received during initialization are never overwritten.

---

### F-09 [HIGH / High Confidence] — Unhandled Network / JSON Errors Freeze Client UI States
- **Files & Code References:**
  - [chat-room.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/chat-room.tsx#L12-L31)
  - [admin-dashboard.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/admin-dashboard.tsx#L9-L13)
  - [settings-form.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/settings-form.tsx#L6)
  - [users-list.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/users-list.tsx#L8)
  - [page.tsx (register)](file:///C:/Users/HP/Desktop/Notexchat/src/app/(auth)/register/page.tsx#L12)
  - [page.tsx (login)](file:///C:/Users/HP/Desktop/Notexchat/src/app/(auth)/login/page.tsx#L12)
- **Confirmed Reliability Details:**
  - None of the client form handlers wrap `fetch()` or `response.json()` in `try / catch / finally`. On network failure or non-JSON error responses, `sending` / `loading` remains `true` forever, permanently disabling submit buttons.
  - In `ChatRoom.loadOlder()` ([chat-room.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/chat-room.tsx#L30)), if the query fails, `data` is `null`, `older` is `[]`, and `setHasMore(older.length === 50)` sets `hasMore = false`, permanently hiding the "โหลดข้อความเก่า" button.
- **Impact:** Transient network errors permanently break the UI until a full browser refresh.
- **Minimal Proposed Fix:** Add `try / catch / finally` blocks around all network requests, safely parse JSON with `.catch(() => null)`, and check `error` in `loadOlder()` before updating `messages` or `hasMore`.

---

### F-10 [MEDIUM / High Confidence] — Least-Privilege Table & Function Grants (`SECURITY DEFINER` Hardening)
- **Files & Code References:**
  - [002_rls.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/002_rls.sql#L48-L100)
  - [003_functions.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/003_functions.sql#L1-L125)
- **Confirmed Vulnerability Details:**
  - `get_or_create_direct_conversation(uuid)` ([003_functions.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/003_functions.sql#L79-L107)) does not revoke default `PUBLIC` execute privileges (`anon` can execute it, though blocked by `if current_user_id is null`).
  - `normalize_message_expiry()` ([003_functions.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/003_functions.sql#L34-L43)) does not set `search_path = public`.
  - Tables `public.conversations`, `public.conversation_members`, and `public.messages` do not explicitly `REVOKE ALL FROM anon` (relying solely on RLS).
- **Minimal Proposed Fix:** Explicitly `REVOKE ALL` from `public, anon` on all functions and tables, grant only required privileges to `authenticated` / `service_role`, and set `search_path = public` on all functions.

---

### F-11 [MEDIUM / High Confidence] — Expired Messages Visible via RLS & `pg_cron` Scheduling Reliability
- **Files & Code References:**
  - [002_rls.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/002_rls.sql#L72-L80)
  - [003_functions.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/003_functions.sql#L109-L133)
- **Confirmed vs. Unverified:**
  - **Confirmed (Code):** `messages_visible_select` does not check `expires_at > now()`. Expired messages remain visible to clients until the daily `03:17 UTC` cron job runs (or forever if `pg_cron` was not enabled when migration `003` ran). Also, `alter table public.messages replica identity full` in `002_rls.sql` unnecessarily logs full old rows to WAL during bulk expiration deletes.
  - **Unverified (Live DB):** Whether `pg_cron` is currently active in the live Supabase instance.
- **Minimal Proposed Fix:**
  - Update `messages_visible_select` to include `expires_at > now()`.
  - Set `alter table public.messages replica identity default;` so `DELETE` operations do not bloat WAL.
  - Re-attempt `pg_cron` scheduling in the new migration (`005`) so projects that enabled `pg_cron` after `003` get the job scheduled.

---

### F-12 [MEDIUM / High Confidence] — `/api/admin/users` 100-User Pagination Cap & `/api/admin/invites` Input Validation
- **Files & Code References:**
  - [route.ts (admin/users)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/admin/users/route.ts#L10-L12)
  - [route.ts (admin/invites)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/admin/invites/route.ts#L15-L23)
- **Confirmed Details:**
  - `service.auth.admin.listUsers({ perPage: 100 })` only fetches page 1 (100 users). If a project has >100 users, remaining users get `status: "unknown"`, and the admin UI button offers to "ปิดใช้" (disable) them regardless of actual status.
  - `/api/admin/invites` does not validate `expiresAt` with Zod (`z.string().datetime()`) or validate `key` with `inviteKeySchema`.
- **Minimal Proposed Fix:**
  - Track `disabled_at` on `public.profiles` (and paginate `listUsers` as fallback) so user status is always accurate without N+1 or 100-user truncation.
  - Validate `/api/admin/invites` and `/api/admin/users` request bodies using Zod schemas in `src/lib/validation/schemas.ts`.

---

### F-13 [MEDIUM / High Confidence] — Cursor Pagination Timestamp Tie-Breaking & Realtime Reconnection Sync
- **Files & Code References:**
  - [chat-room.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/chat-room.tsx#L18-L30)
  - [001_initial_schema.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/001_initial_schema.sql#L52)
- **Confirmed Details:**
  - `loadOlder()` uses `.lt("created_at", oldest.created_at).order("created_at", { ascending: false }).limit(50)`. Messages created in the same millisecond at the page boundary are skipped.
  - If the WebSocket disconnects and reconnects, messages sent during the disconnect window are not fetched.
- **Minimal Proposed Fix:**
  - Order queries by `created_at DESC, id DESC`, use `.or(\`created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})\`)` for deterministic cursor pagination, and re-fetch latest messages when the Realtime channel transitions back to `SUBSCRIBED` after an error/reconnect.

---

### F-14 [MEDIUM / High Confidence] — Missing Same-Origin CSRF Verification on State-Changing API Routes
- **Files & Code References:**
  - [route.ts (messages)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/messages/route.ts)
  - [route.ts (profile)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/profile/route.ts)
  - [route.ts (admin/users)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/admin/users/route.ts)
  - [route.ts (admin/invites)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/admin/invites/route.ts)
  - [route.ts (logout)](file:///C:/Users/HP/Desktop/Notexchat/src/app/api/auth/logout/route.ts)
- **Confirmed Details:**
  - Cookie-authenticated `POST` and `PATCH` routes do not verify that the `Origin` header matches the request `Host`.
- **Minimal Proposed Fix:** Add a `verifySameOrigin(request: Request)` check in `src/lib/auth/server.ts` and enforce it on all state-changing route handlers.

---

## 3. Test Cases & Explicit Pass/Fail Criteria

| Test ID | Target | Test Case Description | Explicit Pass / Fail Criteria |
| :--- | :--- | :--- | :--- |
| **T-01** | Priority 0 (`AdminSigma101`) | Attempt `POST /api/register` with `inviteKey: "AdminSigma101"` after applying migration `005` | **PASS:** Returns HTTP `400` (`"Invite key ไม่ถูกต้อง"`), no `auth.users` or `profiles` row is created. **FAIL:** Account created or status `200`. |
| **T-02** | Unauthenticated API Access | Send unauthenticated `GET`/`POST`/`PATCH` requests to `/api/conversations`, `/api/messages`, `/api/profile`, `/api/admin/users`, `/api/admin/invites` | **PASS:** Every endpoint returns HTTP `401` with JSON `{ "error": "..." }` (not `307` HTML redirect). **FAIL:** Returns `307`, `200`, or non-JSON body. |
| **T-03** | Non-Admin Authenticated Access | As a `role = 'user'` account, call `GET`/`POST`/`PATCH /api/admin/invites`, `GET`/`PATCH /api/admin/users`, and query `supabase.from("invite_keys").select("*")` | **PASS:** API routes return HTTP `403` JSON; PostgREST returns `[]` / permission denied. **FAIL:** Any invite key or user admin action succeeds. |
| **T-04** | Non-Member Private Conversation Access | As User C (not in Direct Conversation A↔B), query `conversations`, `conversation_members`, `messages` for Conversation A↔B, call `POST /api/messages`, and subscribe to Realtime `messages:{convAB}` | **PASS:** `SELECT` returns 0 rows; `POST /api/messages` returns `403`; Realtime delivers 0 events. **FAIL:** Any row or event is returned or message inserted. |
| **T-05** | Cross-Conversation Message Move & Expiry Tampering (F-02) | As User A, insert a message in `global`, then call `supabase.from("messages").update({ conversation_id: convAB, expires_at: "2099-01-01T00:00:00Z" }).eq("id", msgId)` | **PASS:** PostgREST rejects the `UPDATE` (`permission denied` / policy violation) and row remains unchanged. **FAIL:** `conversation_id` or `expires_at` changes. |
| **T-06** | `is_conversation_member` Probing (F-07) | As User C, call `supabase.rpc("is_conversation_member", { target_conversation: convAB, target_user: userA.id })` | **PASS:** Returns `false` whenever `target_user !== auth.uid()`. **FAIL:** Returns `true` for another user's private conversation. |
| **T-07** | Role Spoofing & Profile Column Access | As User A (`role = 'user'`), attempt `supabase.from("profiles").update({ role: "admin" }).eq("id", userA.id)` and `supabase.from("profiles").select("role")` | **PASS:** Both fail with column privilege / trigger exception. **FAIL:** Role is read or updated via direct PostgREST. |
| **T-08** | Admin Self-Lockout Protection (F-05) | As Admin, send `PATCH /api/admin/users` with `{ userId: admin.id, action: "delete" | "disable" | "role", role: "user" }` | **PASS:** Returns HTTP `400` with error message and leaves admin account intact. **FAIL:** Admin deletes, disables, or demotes self. |
| **T-09** | Atomic Registration & Invite Key Conservation (F-04) | 1) Call `POST /api/register` with invalid invite key. 2) Call `POST /api/register` with existing username (case-insensitive) and a valid 1-use invite key | **PASS:** 1) No `auth.users` row created. 2) Returns `409`, and the 1-use invite key still has `used_count = 0`. **FAIL:** `used_count` increments when registration fails. |
| **T-10** | Concurrent Invite Redemption | Fire 5 concurrent `POST /api/register` requests using the same valid invite key with `max_uses = 1` and distinct usernames | **PASS:** Exactly 1 request returns `200 OK`, 4 return `400`, and `used_count = 1`. **FAIL:** More than 1 user is created or `used_count > 1`. |
| **T-11** | Rapid Enter / Duplicate Message Prevention (F-08) | Trigger two synchronous `send()` calls in `ChatRoom` within the same render tick | **PASS:** `sendingRef` blocks the second call; only 1 `POST /api/messages` request is sent. **FAIL:** 2 requests are sent. |
| **T-12** | Message Expiration Visibility (F-11) | Insert a message with `expires_at < now()` (via service role) and query `supabase.from("messages").select("*")` as an authenticated member | **PASS:** Expired message is excluded immediately by `messages_visible_select` RLS even before `delete_expired_messages()` runs. **FAIL:** Expired message is returned. |

### Verification Execution Status (Phase 1)
- **Executed in Phase 1 (Read-Only):**
  - `npm.cmd run typecheck` (`tsc --noEmit`) — Executed on current unmodified codebase (PASSED, exit code 0).
  - `npm.cmd run lint` (`eslint .`) — Executed on current unmodified codebase (PASSED, exit code 0).
- **Not Yet Executed (Requires Phase 2 Implementation / Live Supabase Project):**
  - Tests `T-01` through `T-12` have **not** been claimed as passed because no code or database changes have been applied yet in Phase 1.

---

## 4. Migrations Affecting Existing Production Data

We propose adding a new forward migration `supabase/migrations/005_security_and_reliability_fixes.sql` (and removing the `AdminSigma101` line from `004_seed_global_chat.sql` for clean future setups). Its impact on existing production data is:

| Migration Change | Production Data Impact | Risk & Mitigation |
| :--- | :--- | :--- |
| `DELETE FROM public.invite_keys WHERE key = 'AdminSigma101';` | Deletes the seeded `AdminSigma101` row from `public.invite_keys`. Existing users who already registered with it are **not** affected (`profiles` has no FK to `invite_keys`). | **Safe.** Prevents any future unauthorized use of `AdminSigma101`. |
| `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disabled_at timestamptz;` | Adds a nullable column (`NULL` for all existing rows). Does not lock or rewrite existing table pages in PostgreSQL 11+. | **Safe.** Existing active users remain active (`disabled_at IS NULL`). Note: If any users were previously banned in `auth.users`, we can optionally backfill `disabled_at` from `auth.users.banned_until`. |
| `DROP POLICY messages_own_update` / `REVOKE UPDATE, DELETE ON public.messages FROM authenticated` | Prevents authenticated users from mutating or moving existing messages via PostgREST. Does not alter or delete any stored messages. | **Safe.** Aligns database permissions with actual application behavior. |
| Update `messages_visible_select` to check `expires_at > now()` | Immediately hides any rows in `public.messages` where `expires_at <= now()` before the nightly cron deletes them. | **Safe.** Matches the 1-year retention rule; indexed by existing `messages_expires_idx` and `messages_conversation_created_idx`. |
| Update `is_conversation_member`, `is_admin`, `get_current_profile`, and add `complete_user_registration` | Replaces function definitions in-place (`CREATE OR REPLACE FUNCTION`). No table data is modified. | **Safe.** Zero downtime. |

---

## 5. Proposed Implementation Plan (Awaiting Your Approval)

Once you approve this plan, we will execute **Phase 2** and commit/push each logical step to `https://github.com/TON2400/Notexchat.git`:

1. **Step 1 (Git Commit — Audit Documentation):** Commit `NotexChat_Security_Reliability_Audit_Prompt.md` and this Audit Report (`NotexChat_Security_Reliability_Audit_Report.md`) to git and push to `origin`.
2. **Step 2 (Git Commit — Database Security & Reliability Migration `005` + Seed Cleanup):**
   - Remove `AdminSigma101` from [004_seed_global_chat.sql](file:///C:/Users/HP/Desktop/Notexchat/supabase/migrations/004_seed_global_chat.sql) and docs ([README.md](file:///C:/Users/HP/Desktop/Notexchat/README.md), [DEPLOYMENT.md](file:///C:/Users/HP/Desktop/Notexchat/DEPLOYMENT.md)).
   - Create `supabase/migrations/005_security_and_reliability_fixes.sql` fixing `AdminSigma101`, `profiles.disabled_at`, `messages_own_update`, `messages_visible_select` expiry filter, `is_conversation_member` authorization check, atomic registration RPC, and least-privilege grants.
3. **Step 3 (Git Commit — Server Auth, API Route Hardening & Atomic Registration):**
   - Update [src/lib/auth/server.ts](file:///C:/Users/HP/Desktop/Notexchat/src/lib/auth/server.ts) with `requireApiUser()`, `requireApiAdmin()`, and `verifySameOrigin()`.
   - Update `/api/register`, `/api/messages`, `/api/conversations`, `/api/profile`, `/api/auth/logout`, `/api/admin/users`, and `/api/admin/invites` (fixing F-03, F-04, F-05, F-06, F-12, F-14).
4. **Step 4 (Git Commit — Client Reliability, Deduplication, Pagination & Error Handling):**
   - Update [src/components/chat-room.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/chat-room.tsx), [src/components/admin-dashboard.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/admin-dashboard.tsx), [src/components/settings-form.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/settings-form.tsx), [src/components/users-list.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/components/users-list.tsx), [src/app/(auth)/login/page.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/app/(auth)/login/page.tsx), and [src/app/(auth)/register/page.tsx](file:///C:/Users/HP/Desktop/Notexchat/src/app/(auth)/register/page.tsx) (fixing F-08, F-09, F-13).
5. **Step 5 (Git Commit — Verification & Automated Tests):**
   - Run `npm run typecheck`, `npm run lint`, and `npm run build`, verify all checks pass, and push all commits to `https://github.com/TON2400/Notexchat.git`.
