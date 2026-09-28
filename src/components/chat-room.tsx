"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MessageWithSender } from "@/types/chat";

export function ChatRoom({ conversationId }: { conversationId: string }) {
  const supabase = useMemo(() => createClient(), []); const [messages, setMessages] = useState<MessageWithSender[]>([]); const [me, setMe] = useState(""); const [title, setTitle] = useState("Conversation"); const [draft, setDraft] = useState(""); const [loading, setLoading] = useState(true); const [sending, setSending] = useState(false); const [error, setError] = useState(""); const [hasMore, setHasMore] = useState(true); const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      const boot = await fetch("/api/conversations"); const bootData = await boot.json();
      const conversation = conversationId === bootData.global?.id ? { type: "global", otherUser: null } : (bootData.conversations ?? []).find((item: { id: string }) => item.id === conversationId);
      if (!conversation) { setError("Conversation not found"); setLoading(false); return; }
      if (active) { setMe(bootData.me?.id ?? ""); setTitle(conversation.type === "global" ? "Global chat" : conversation.otherUser?.display_name || conversation.otherUser?.username || "Direct chat"); }
      const { data, error: messageError } = await supabase.from("messages").select("id, conversation_id, sender_id, content, created_at, expires_at, sender:profiles!messages_sender_id_fkey(username, display_name)").eq("conversation_id", conversationId).order("created_at", { ascending:false }).limit(50);
      if (messageError) { if (active) setError("โหลดข้อความไม่สำเร็จ"); } else if (active) { setMessages(((data ?? []) as unknown as MessageWithSender[]).reverse()); setHasMore((data ?? []).length === 50); }
      if (active) setLoading(false);
    }
    load();
    const channel = supabase.channel(`messages:${conversationId}`).on("postgres_changes", { event:"INSERT", schema:"public", table:"messages", filter:`conversation_id=eq.${conversationId}` }, async (payload) => {
      const row = payload.new as MessageWithSender; const { data: sender } = await supabase.from("profiles").select("username, display_name").eq("id", row.sender_id).single();
      setMessages((current) => current.some((item) => item.id === row.id) ? current : [...current, { ...row, sender }]);
    }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [conversationId, supabase]);

  async function loadOlder() { const oldest = messages[0]; if (!oldest) return; const { data } = await supabase.from("messages").select("id, conversation_id, sender_id, content, created_at, expires_at, sender:profiles!messages_sender_id_fkey(username, display_name)").eq("conversation_id", conversationId).lt("created_at", oldest.created_at).order("created_at", { ascending:false }).limit(50); const older = ((data ?? []) as unknown as MessageWithSender[]).reverse(); setMessages((current) => [...older, ...current]); setHasMore(older.length === 50); }
  async function send(event: FormEvent) { event.preventDefault(); if (!draft.trim() || sending) return; setSending(true); setError(""); const response = await fetch("/api/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ conversationId, content:draft }) }); const result = await response.json(); if (!response.ok) setError(result.error ?? "ส่งข้อความไม่สำเร็จ"); else setDraft(""); setSending(false); }
  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(event); } }
  return <section className="chat-layout"><header className="chat-header"><span className="conversation-avatar">{title === "Global chat" ? "#" : title.slice(0,1).toUpperCase()}</span><div><h2>{title}</h2><p>{title === "Global chat" ? "คุยกับสมาชิกทุกคน" : "ข้อความส่วนตัว"}</p></div></header><div className="message-scroll" ref={scrollRef}>{hasMore && !loading && <button className="secondary-button" style={{display:"block", margin:"0 auto 18px", fontSize:12}} onClick={loadOlder}>โหลดข้อความเก่า</button>}{loading ? <p className="muted" style={{textAlign:"center"}}>กำลังโหลด...</p> : error && !messages.length ? <p className="form-error">{error}</p> : <div className="message-list">{messages.map((message) => <article key={message.id} className={`message ${message.sender_id === me ? "own" : ""}`}><span className="avatar">{(message.sender?.display_name || message.sender?.username || "?").slice(0,1).toUpperCase()}</span><div className="message-bubble"><div className="message-author">{message.sender_id === me ? "คุณ" : message.sender?.display_name || message.sender?.username || "ผู้ใช้"}</div><div className="message-body">{message.content}</div></div><time className="message-time">{new Date(message.created_at).toLocaleTimeString("th-TH", {hour:"2-digit", minute:"2-digit"})}</time></article>)}</div>}</div><div className="composer"><form onSubmit={send}><textarea aria-label="ข้อความ" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} maxLength={2000} placeholder="เขียนข้อความ..." /> <button className="primary-button" disabled={sending || !draft.trim()}>ส่ง</button></form><div className="compose-hint">Enter เพื่อส่ง · Shift + Enter ขึ้นบรรทัดใหม่ · {draft.length}/2000</div>{error && messages.length > 0 && <p className="form-error" style={{marginBottom:0, marginTop:8}}>{error}</p>}</div></section>;
}
