# NotexChat --- Security and Reliability Audit Prompt

ใช้ Prompt นี้กับ Agy CLI เพื่อให้ Agent ตรวจสอบ Repository ของ NotexChat ก่อน
โดยเป็น **Read-only Audit** เท่านั้น
ยังไม่ให้แก้ไขไฟล์หรือฐานข้อมูลจนกว่าจะตรวจสอบรายงานและอนุมัติแผนก่อน

``` text
# NotexChat — Security and Reliability Audit

## Context
This is an existing Next.js App Router + TypeScript + Supabase application.
Do not rewrite the architecture or migrate to another backend framework.
Preserve current product behavior unless a change is necessary to fix a verified issue.

## Phase 1: Read-only audit
Inspect the complete repository, including:
- All API routes and server actions
- Supabase client/server initialization
- All SQL migrations, RLS policies, triggers and SECURITY DEFINER functions
- Authentication, registration, invite-key and admin workflows
- Conversation membership, message CRUD and Realtime subscriptions
- Message expiration and scheduled database jobs
- Environment variable usage and client/server boundaries

Do not modify any files or database during this phase.

## Priority 0: Admin bootstrap
The public repository documents the initial invite key `AdminSigma101`.
Determine how this key is validated, whether it can still be used, and whether an unauthorized user can obtain administrator privileges.

Do not assume the production database state from source code.
Identify which checks require access to the live Supabase project.
Propose a safe remediation plan without exposing or reusing any credentials.

## Priority 1: Authorization
Verify that authorization is enforced server-side and by database policies where appropriate.
Test or design tests for:
- Unauthenticated requests
- Authenticated non-members accessing private conversations
- Attempts to spoof sender IDs or modify roles
- Unauthorized access to profiles, messages, memberships and invite keys
- Direct Supabase API access and Realtime subscriptions
- Misuse of privileged server credentials

Review SECURITY DEFINER functions for execution privileges, search_path safety, and authorization assumptions.

## Priority 2: Reliability
Review duplicate message submissions, network errors, Realtime reconnection, pagination, concurrent invite redemption, and expiration jobs.

## Required output
1. Findings ranked by severity and confidence.
2. Exact file paths and code references supporting each finding.
3. Distinguish confirmed vulnerabilities from unverified risks.
4. Explain the likely impact and a minimal proposed fix for each finding.
5. Provide test cases and explicit pass/fail criteria.
6. Identify migrations that could affect existing production data.
7. Do not claim a test passed unless it was actually executed.

Stop after presenting the audit and proposed plan. Wait for approval before implementing changes.
```

## วิธีใช้

1.  เปิด Terminal ในโฟลเดอร์ Repository ของ NotexChat
2.  เรียกใช้ Agy CLI
3.  ส่ง Prompt ด้านบนให้ Agent
4.  ตรวจรายงาน โดยเฉพาะ Findings ที่เกี่ยวกับ Admin, Invite Key, RLS และ
    Service Role
5.  **อย่าเพิ่งอนุมัติให้แก้โค้ดหรือรัน Migration** จนกว่าจะตรวจสอบแผนและผลกระทบแล้ว
