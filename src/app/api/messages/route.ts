import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/supabase/server";
import { messageSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อความต้องมี 1-2000 ตัวอักษร" }, { status: 400 });
  const { conversationId, content } = parsed.data;
  const { data: message, error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, content }).select("*").single();
  if (error || !message) return NextResponse.json({ error: "คุณไม่มีสิทธิ์ส่งข้อความในห้องนี้" }, { status: 403 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  const hashSecret = process.env.IP_HASH_SECRET;
  const service = createServiceClient();
  await service.from("message_metadata").insert({
    message_id: message.id,
    sender_ip_hash: ip && hashSecret ? crypto.createHmac("sha256", hashSecret).update(ip).digest("hex") : null,
    user_agent: request.headers.get("user-agent"),
    client_type: "web",
    platform: request.headers.get("sec-ch-ua-platform"),
  });
  return NextResponse.json({ message });
}
