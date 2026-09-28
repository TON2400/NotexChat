import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.from("profiles").select("id, username, display_name, role, created_at, updated_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "โหลดผู้ใช้ไม่สำเร็จ" }, { status: 500 });
  const { data: authData } = await service.auth.admin.listUsers({ perPage: 100 });
  const status = new Map((authData.users ?? []).map((item) => [item.id, item.banned_until ? "disabled" : "active"]));
  return NextResponse.json({ users: (data ?? []).map((item) => ({ ...item, status: status.get(item.id) ?? "unknown" })) });
}

export async function PATCH(request: Request) {
  await requireAdmin();
  const service = createServiceClient();
  const body = await request.json().catch(() => null) as { userId?: string; action?: string; role?: string } | null;
  if (!body?.userId) return NextResponse.json({ error: "ผู้ใช้ไม่ถูกต้อง" }, { status: 400 });
  if (body.action === "delete") {
    const { error } = await service.auth.admin.deleteUser(body.userId);
    if (error) return NextResponse.json({ error: "ลบบัญชีไม่สำเร็จ" }, { status: 400 });
  } else if (body.action === "disable" || body.action === "enable") {
    const { error } = await service.auth.admin.updateUserById(body.userId, { ban_duration: body.action === "disable" ? "876000h" : "none" });
    if (error) return NextResponse.json({ error: "เปลี่ยนสถานะบัญชีไม่สำเร็จ" }, { status: 400 });
  } else if (body.action === "role" && (body.role === "user" || body.role === "admin")) {
    const { error } = await service.from("profiles").update({ role: body.role }).eq("id", body.userId);
    if (error) return NextResponse.json({ error: "เปลี่ยน role ไม่สำเร็จ" }, { status: 400 });
  } else return NextResponse.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
