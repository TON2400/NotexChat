import type { Message, Profile } from "@/types/database";

export type MessageWithSender = Message & { sender: Pick<Profile, "username" | "display_name"> | null };
export type ConversationSummary = { id: string; type: "direct" | "global"; createdAt: string; otherUser: Pick<Profile, "id" | "username" | "display_name"> | null };
