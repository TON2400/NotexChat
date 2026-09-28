import { ChatRoom } from "@/components/chat-room";

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  return <ChatRoom conversationId={conversationId} />;
}
