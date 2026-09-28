export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & Pick<Profile, "id" | "username" | "display_name">; Update: Partial<Profile>; Relationships: [] };
      invite_keys: { Row: InviteKey; Insert: Partial<InviteKey> & Pick<InviteKey, "key" | "role" | "max_uses">; Update: Partial<InviteKey>; Relationships: [] };
      conversations: { Row: Conversation; Insert: Partial<Conversation>; Update: Partial<Conversation>; Relationships: [] };
      conversation_members: { Row: ConversationMember; Insert: ConversationMember; Update: Partial<ConversationMember>; Relationships: [] };
      messages: { Row: Message; Insert: Partial<Message> & Pick<Message, "conversation_id" | "sender_id" | "content">; Update: Partial<Message>; Relationships: [] };
      message_metadata: { Row: MessageMetadata; Insert: Partial<MessageMetadata> & Pick<MessageMetadata, "message_id">; Update: Partial<MessageMetadata>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      get_current_profile: { Args: Record<string, never>; Returns: Profile };
      get_or_create_direct_conversation: { Args: { p_other_user: string }; Returns: string };
      consume_invite_key: { Args: { p_key: string; p_user_id: string }; Returns: InviteKey };
      delete_expired_messages: { Args: Record<string, never>; Returns: number };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = { id: string; username: string; display_name: string; role: "user" | "admin"; created_at: string; updated_at: string };
export type InviteKey = { id: string; key: string; created_by: string | null; role: "user" | "admin"; max_uses: number; used_count: number; expires_at: string | null; created_at: string; disabled_at: string | null };
export type Conversation = { id: string; type: "direct" | "global"; direct_key: string | null; created_at: string };
export type ConversationMember = { conversation_id: string; user_id: string; joined_at: string };
export type Message = { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; expires_at: string };
export type MessageMetadata = { message_id: string; created_at: string; sender_ip_hash: string | null; user_agent: string | null; client_type: string | null; platform: string | null };
