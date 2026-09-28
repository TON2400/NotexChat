import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.from("invite_keys").select("id, key, role, max_uses, used_count, expires_at, created_at, disabled_at, created_by").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "โหลด invite keys ไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(request: Request) {
  const { profile } = await requireAdmin();
  const body = await request.json().catch(() => null) as { key?: string; role?: string; maxUses?: number; expiresAt?: string | null } | null;
  if (!body?.key?.trim() || (body.role !== "user" && body.role !== "admin") || !Number.isInteger(body.maxUses) || body.maxUses! < 1 || body.maxUses! > 1000) {
    return NextResponse.json({ error: "ข้อมูล invite key ไม่ถูกต้อง" }, { status: 400 });
  }
  const safeRole = body.role as "user" | "admin";
  const safeMaxUses = body.maxUses as number;
  const service = createServiceClient();
  const { error } = await service.from("invite_keys").insert({ key: body.key.trim(), role: safeRole, max_uses: safeMaxUses, expires_at: body.expiresAt || null, created_by: profile.id });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Invite key นี้มีอยู่แล้ว" : "สร้าง invite key ไม่สำเร็จ" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => null) as { id?: string; disabled?: boolean } | null;
  if (!body?.id || typeof body.disabled !== "boolean") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const service = createServiceClient();
  const { error } = await service.from("invite_keys").update({ disabled_at: body.disabled ? new Date().toISOString() : null }).eq("id", body.id);
  if (error) return NextResponse.json({ error: "เปลี่ยนสถานะ invite key ไม่สำเร็จ" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
