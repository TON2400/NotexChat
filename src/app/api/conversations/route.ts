import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";

export async function GET() {
  const { supabase, user, profile } = await requireUser();
  const [{ data: users }, { data: global }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name").order("username"),
    supabase.from("conversations").select("id, type, created_at, direct_key").eq("type", "global").single(),
    supabase.from("conversation_members").select("conversation_id, user_id, joined_at").eq("user_id", user.id),
  ]);
  const ids = (memberships ?? []).map((membership) => membership.conversation_id);
  const { data: directConversations } = ids.length
    ? await supabase.from("conversations").select("id, type, created_at, direct_key").in("id", ids).eq("type", "direct")
    : { data: [] };
  const directIds = (directConversations ?? []).map((conversation) => conversation.id);
  const { data: members } = directIds.length
    ? await supabase.from("conversation_members").select("conversation_id, user_id").in("conversation_id", directIds).neq("user_id", user.id)
    : { data: [] };
  const userMap = new Map((users ?? []).map((item) => [item.id, item]));
  return NextResponse.json({
    me: { id: profile.id, username: profile.username, display_name: profile.display_name },
    users: users ?? [],
    global: global ?? null,
    conversations: (directConversations ?? []).map((conversation) => ({
      id: conversation.id, type: conversation.type, createdAt: conversation.created_at,
      otherUser: userMap.get(members?.find((member) => member.conversation_id === conversation.id)?.user_id ?? "") ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const { supabase } = await requireUser();
  const body = await request.json().catch(() => null) as { otherUserId?: string } | null;
  if (!body?.otherUserId) return NextResponse.json({ error: "ผู้รับไม่ถูกต้อง" }, { status: 400 });
  const { data, error } = await supabase.rpc("get_or_create_direct_conversation", { p_other_user: body.otherUserId });
  if (error || !data) return NextResponse.json({ error: "ไม่สามารถเปิดห้องสนทนาได้" }, { status: 400 });
  return NextResponse.json({ conversationId: data });
}
