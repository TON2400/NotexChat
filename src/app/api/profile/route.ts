import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { displayNameSchema, passwordSchema } from "@/lib/validation/schemas";

export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  const body = await request.json().catch(() => null) as { displayName?: unknown; password?: unknown } | null;
  if (body?.displayName !== undefined) {
    const parsed = displayNameSchema.safeParse(body.displayName);
    if (!parsed.success) return NextResponse.json({ error: "ชื่อที่แสดงต้องมี 1-50 ตัวอักษร" }, { status: 400 });
    const { error } = await supabase.from("profiles").update({ display_name: parsed.data }).eq("id", user.id);
    if (error) return NextResponse.json({ error: "บันทึกชื่อไม่สำเร็จ" }, { status: 400 });
  }
  if (body?.password !== undefined) {
    const parsed = passwordSchema.safeParse(body.password);
    if (!parsed.success) return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    if (error) return NextResponse.json({ error: "เปลี่ยนรหัสผ่านไม่สำเร็จ" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
