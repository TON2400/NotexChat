import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { identityEmail } from "@/lib/auth/identity";
import { registerSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลสมัครสมาชิกไม่ถูกต้อง" }, { status: 400 });

  const { username, password, inviteKey } = parsed.data;
  const admin = createServiceClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: identityEmail(username), password, email_confirm: true,
    user_metadata: { username },
  });
  if (createError || !created.user) {
    const duplicate = createError?.message.toLowerCase().includes("already") || createError?.status === 422;
    return NextResponse.json({ error: duplicate ? "Username นี้ถูกใช้แล้ว" : "ไม่สามารถสร้างบัญชีได้" }, { status: duplicate ? 409 : 400 });
  }

  const { data: invite, error: inviteError } = await admin.rpc("consume_invite_key", { p_key: inviteKey, p_user_id: created.user.id });
  if (inviteError || !invite) {
    await admin.auth.admin.deleteUser(created.user.id);
    const message = inviteError?.message.toLowerCase().includes("expired") ? "Invite key หมดอายุแล้ว" : inviteError?.message.toLowerCase().includes("already") ? "Invite key ถูกใช้ครบแล้ว" : "Invite key ไม่ถูกต้อง";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id, username, display_name: username, role: invite.role,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "ไม่สามารถสร้างโปรไฟล์ได้" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
